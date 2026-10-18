// Testes dos handlers de faixas contra um Postgres real (PGlite), com o fetch externo (oEmbed) simulado.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '../../api/_lib/db.js';
import playlists from '../../api/playlists/index.js';
import playlistById from '../../api/playlists/[id]/index.js';
import addTrack from '../../api/playlists/[id]/tracks/index.js';
import trackById from '../../api/playlists/[id]/tracks/[trackId].js';
import reorder from '../../api/playlists/[id]/tracks/order.js';
import type { PlaylistDetail, Track } from '../../shared/types.js';
import { call, type FakeReqInit } from '../helpers.js';
import { createTestDb, signupAs } from '../pgdb.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const SP = 'https://open.spotify.com/intl-pt/track/4uLU6hMCjMI75M1A2tKUQC?si=xyz';
const SC = 'https://soundcloud.com/artista-pequeno/demo-2024';
const MISSING = '00000000-0000-4000-8000-000000000000';

let testDb: Awaited<ReturnType<typeof createTestDb>>;
const fetchMock = vi.fn();
/** Cookie da dona das playlists criadas pelos helpers abaixo. */
let maria: string;

/** Chama o handler com a sessão de Maria, salvo se `init.cookie` disser outra coisa. */
const callAs = (handler: Parameters<typeof call>[0], init: FakeReqInit) => call(handler, { cookie: maria, ...init });

beforeAll(async () => {
  testDb = await createTestDb();
  vi.mocked(getSql).mockReturnValue(testDb.sql as unknown as ReturnType<typeof getSql>);
});
afterAll(() => testDb.db.close());

beforeEach(async () => {
  await testDb.reset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () =>
    Response.json({ title: 'Título oEmbed', author_name: 'Autor', thumbnail_url: 'https://img.example/t.jpg' }),
  );
  vi.stubGlobal('fetch', fetchMock);
  maria = await signupAs('maria@exemplo.com');
});

async function newPlaylist(name = 'Teste') {
  const res = await callAs(playlists, { method: 'POST', body: { name } });
  return res.body as PlaylistDetail;
}
async function add(playlistId: string, url: string, label?: string) {
  return callAs(addTrack, { method: 'POST', query: { id: playlistId }, body: { url, label } });
}
async function detail(playlistId: string) {
  return (await callAs(playlistById, { method: 'GET', query: { id: playlistId } })).body as PlaylistDetail;
}
const order = (p: PlaylistDetail) => p.tracks.map((t) => [t.position, t.label]);

describe('POST /api/playlists/[id]/tracks', () => {
  it('adiciona com rótulo, metadados e URL original sem espaços nas bordas', async () => {
    const p = await newPlaylist();
    const res = await add(p.id, `  ${YT}&t=42s  `, 'Radiohead – Weird Fishes (ao vivo, Lollapalooza 2016)');
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      platform: 'youtube',
      externalId: 'dQw4w9WgXcQ',
      originalUrl: `${YT}&t=42s`,
      canonicalUrl: YT,
      label: 'Radiohead – Weird Fishes (ao vivo, Lollapalooza 2016)',
      position: 0,
      title: 'Título oEmbed',
      artist: 'Autor',
      thumbnailUrl: 'https://img.example/t.jpg',
      youtubeAltId: null,
    });
  });

  it('adiciona sem rótulo e sempre no final', async () => {
    const p = await newPlaylist();
    await add(p.id, YT, 'a');
    await add(p.id, SP, 'b');
    const res = await add(p.id, SC);
    expect(res.body).toMatchObject({ platform: 'soundcloud', label: '', position: 2 });
    expect(order(await detail(p.id))).toEqual([[0, 'a'], [1, 'b'], [2, '']]);
  });

  it('aceita a mesma faixa mais de uma vez', async () => {
    const p = await newPlaylist();
    await add(p.id, YT);
    expect((await add(p.id, YT)).statusCode).toBe(201);
    expect((await detail(p.id)).tracks).toHaveLength(2);
  });

  it('falha no oEmbed não impede a adição', async () => {
    fetchMock.mockImplementation(async () => new Response('erro', { status: 500 }));
    const p = await newPlaylist();
    const res = await add(p.id, SP);
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ platform: 'spotify', title: null, artist: null, thumbnailUrl: null });
  });

  it('resolve link curto do SoundCloud e guarda a URL canônica', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith('https://on.soundcloud.com/')
        ? new Response(null, { status: 302, headers: { location: 'https://soundcloud.com/Artista/Faixa?ref=x' } })
        : Response.json({ title: 'Faixa' }),
    );
    const p = await newPlaylist();
    const res = await add(p.id, 'https://on.soundcloud.com/AbC123');
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      originalUrl: 'https://on.soundcloud.com/AbC123',
      canonicalUrl: 'https://soundcloud.com/artista/faixa',
      externalId: 'artista/faixa',
    });
  });

  it.each([
    ['link de álbum', 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3', /faixas individuais/],
    ['outra plataforma', 'https://www.deezer.com/track/12345', /YouTube, Spotify e SoundCloud/],
    ['texto', 'radiohead weird fishes', /não parece um link/],
  ])('rejeita %s com 400 e não grava nada', async (_name, url, message) => {
    const p = await newPlaylist();
    const res = await add(p.id, url);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'validation', message: expect.stringMatching(message) } });
    expect((await detail(p.id)).tracks).toHaveLength(0);
  });

  it('rejeita rótulo de 201 caracteres', async () => {
    const p = await newPlaylist();
    expect((await add(p.id, YT, 'a'.repeat(201))).statusCode).toBe(400);
  });

  it('playlist inexistente responde 404', async () => {
    expect((await add(MISSING, YT)).statusCode).toBe(404);
  });

  it('atualiza o updated_at da playlist', async () => {
    const p = await newPlaylist();
    await add(p.id, YT);
    expect(new Date((await detail(p.id)).updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(p.updatedAt).getTime());
  });
});

describe('PATCH/DELETE /api/playlists/[id]/tracks/[trackId]', () => {
  it('edita só o rótulo', async () => {
    const p = await newPlaylist();
    const t = (await add(p.id, YT, 'velho')).body as Track;
    const res = await callAs(trackById, {
      method: 'PATCH',
      query: { id: p.id, trackId: t.id },
      body: { label: 'versão acústica' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ...t, label: 'versão acústica' });
  });

  it('remove a faixa do meio mantendo a ordem relativa e posições contíguas', async () => {
    const p = await newPlaylist();
    await add(p.id, YT, 'a');
    const b = (await add(p.id, SP, 'b')).body as Track;
    await add(p.id, SC, 'c');
    const res = await callAs(trackById, { method: 'DELETE', query: { id: p.id, trackId: b.id } });
    expect(res.statusCode).toBe(204);
    expect(order(await detail(p.id))).toEqual([[0, 'a'], [1, 'c']]);
  });

  it('não remove nem edita faixa de outra playlist', async () => {
    const a = await newPlaylist('A');
    const b = await newPlaylist('B');
    const tb = (await add(b.id, YT, 'de B')).body as Track;
    const del = await callAs(trackById, { method: 'DELETE', query: { id: a.id, trackId: tb.id } });
    const patch = await callAs(trackById, { method: 'PATCH', query: { id: a.id, trackId: tb.id }, body: { label: 'x' } });
    expect(del.statusCode).toBe(404);
    expect(patch.statusCode).toBe(404);
    expect(order(await detail(b.id))).toEqual([[0, 'de B']]);
  });

  it('remover faixa inexistente responde 404 sem mexer nas posições', async () => {
    const p = await newPlaylist();
    await add(p.id, YT, 'a');
    const res = await callAs(trackById, { method: 'DELETE', query: { id: p.id, trackId: MISSING } });
    expect(res.statusCode).toBe(404);
    expect(order(await detail(p.id))).toEqual([[0, 'a']]);
  });
});

describe('PATCH /api/playlists/[id]/tracks/[trackId]: versão no YouTube', () => {
  const patch = (playlistId: string, trackId: string, body: unknown) =>
    callAs(trackById, { method: 'PATCH', query: { id: playlistId, trackId }, body });
  async function spotifyTrack(label = 'original') {
    const p = await newPlaylist();
    const t = (await add(p.id, SP, label)).body as Track;
    return { p, t };
  }

  it.each([
    ['youtu.be', 'https://youtu.be/dQw4w9WgXcQ'],
    ['youtube.com/watch', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s'],
  ])('cadastra com link %s guardando só o id, sem mexer no resto', async (_name, url) => {
    const { p, t } = await spotifyTrack();
    const res = await patch(p.id, t.id, { youtubeAlt: url });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ...t, youtubeAltId: 'dQw4w9WgXcQ' });
    expect((await detail(p.id)).tracks[0]).toEqual({ ...t, youtubeAltId: 'dQw4w9WgXcQ' });
  });

  it('troca e depois remove com null', async () => {
    const { p, t } = await spotifyTrack();
    await patch(p.id, t.id, { youtubeAlt: 'https://youtu.be/dQw4w9WgXcQ' });
    const swapped = await patch(p.id, t.id, { youtubeAlt: 'https://youtu.be/aaaaaaaaaaa' });
    expect(swapped.body).toMatchObject({ youtubeAltId: 'aaaaaaaaaaa', label: 'original' });
    const removed = await patch(p.id, t.id, { youtubeAlt: null });
    expect(removed.statusCode).toBe(200);
    expect(removed.body).toEqual({ ...t, youtubeAltId: null });
  });

  it('editar o rótulo mantém a versão, e mexer na versão mantém o rótulo', async () => {
    const { p, t } = await spotifyTrack();
    await patch(p.id, t.id, { youtubeAlt: 'https://youtu.be/dQw4w9WgXcQ' });
    const relabeled = await patch(p.id, t.id, { label: 'novo' });
    expect(relabeled.body).toMatchObject({ label: 'novo', youtubeAltId: 'dQw4w9WgXcQ' });
    const both = await patch(p.id, t.id, { label: 'outro', youtubeAlt: null });
    expect(both.body).toMatchObject({ label: 'outro', youtubeAltId: null });
  });

  it.each([
    ['link do SoundCloud', SC],
    ['playlist do YouTube', 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG'],
    ['link do Spotify', SP],
    ['texto', 'não é link'],
  ])('rejeita %s com 400 e nada muda', async (_name, url) => {
    const { p, t } = await spotifyTrack();
    const res = await patch(p.id, t.id, { youtubeAlt: url });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'validation', message: 'Cole o link de um vídeo do YouTube.' } });
    expect((await detail(p.id)).tracks[0]).toEqual(t);
  });

  it.each([
    ['YouTube', YT],
    ['SoundCloud', SC],
  ])('faixa do %s não aceita versão alternativa (400)', async (_name, url) => {
    const p = await newPlaylist();
    const t = (await add(p.id, url)).body as Track;
    const res = await patch(p.id, t.id, { youtubeAlt: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { message: 'Só faixas do Spotify aceitam versão no YouTube.' } });
    expect((await detail(p.id)).tracks[0]).toEqual(t);
  });

  it('o banco recusa versão alternativa em faixa que não é do Spotify', async () => {
    const p = await newPlaylist();
    await add(p.id, YT);
    await expect(testDb.sql`update tracks set youtube_alt_id = 'dQw4w9WgXcQ'`).rejects.toThrow(
      /tracks_youtube_alt_only_spotify/,
    );
  });

  it('corpo sem nenhum campo responde 400', async () => {
    const { p, t } = await spotifyTrack();
    expect((await patch(p.id, t.id, {})).statusCode).toBe(400);
  });

  it('faixa inexistente responde 404', async () => {
    const p = await newPlaylist();
    expect((await patch(p.id, MISSING, { youtubeAlt: 'https://youtu.be/dQw4w9WgXcQ' })).statusCode).toBe(404);
  });
});

describe('PUT /api/playlists/[id]/tracks/order', () => {
  async function threeTracks() {
    const p = await newPlaylist();
    const ids: string[] = [];
    for (const [url, label] of [[YT, 'a'], [SP, 'b'], [SC, 'c']]) {
      ids.push(((await add(p.id, url, label)).body as Track).id);
    }
    return { p, ids };
  }
  const put = (id: string, trackIds: unknown) => callAs(reorder, { method: 'PUT', query: { id }, body: { trackIds } });

  it('move a terceira faixa para o topo e persiste', async () => {
    const { p, ids } = await threeTracks();
    const res = await put(p.id, [ids[2], ids[0], ids[1]]);
    expect(res.statusCode).toBe(204);
    expect(order(await detail(p.id))).toEqual([[0, 'c'], [1, 'a'], [2, 'b']]);
  });

  it('rejeita com 409 quando falta uma faixa', async () => {
    const { p, ids } = await threeTracks();
    const res = await put(p.id, [ids[1], ids[0]]);
    expect(res.statusCode).toBe(409);
    expect(order(await detail(p.id))).toEqual([[0, 'a'], [1, 'b'], [2, 'c']]);
  });

  it('rejeita com 409 quando inclui faixa de outra playlist', async () => {
    const { p, ids } = await threeTracks();
    const other = await newPlaylist('Outra');
    const foreign = ((await add(other.id, YT)).body as Track).id;
    const res = await put(p.id, [ids[0], ids[1], foreign]);
    expect(res.statusCode).toBe(409);
    expect(order(await detail(p.id))).toEqual([[0, 'a'], [1, 'b'], [2, 'c']]);
  });

  it('rejeita com 409 quando há faixa repetida', async () => {
    const { p, ids } = await threeTracks();
    expect((await put(p.id, [ids[0], ids[0], ids[1]])).statusCode).toBe(409);
  });

  it('rejeita com 409 lista vazia para playlist com faixas', async () => {
    const { p } = await threeTracks();
    expect((await put(p.id, [])).statusCode).toBe(409);
  });

  it('aceita lista vazia para playlist vazia', async () => {
    const p = await newPlaylist();
    expect((await put(p.id, [])).statusCode).toBe(204);
  });

  it('playlist inexistente responde 404', async () => {
    expect((await put(MISSING, [])).statusCode).toBe(404);
  });

  it('ids que não são UUID respondem 400', async () => {
    const p = await newPlaylist();
    expect((await put(p.id, ['x'])).statusCode).toBe(400);
  });
});

describe('DELETE /api/playlists/[id] com faixas', () => {
  it('remove playlist e faixas em cascata', async () => {
    const p = await newPlaylist();
    await add(p.id, YT);
    await add(p.id, SP);
    expect((await callAs(playlistById, { method: 'DELETE', query: { id: p.id } })).statusCode).toBe(204);
    const rows = await testDb.sql`select count(*)::int as n from tracks`;
    expect(rows[0].n).toBe(0);
  });
});

describe('faixas: só a dona escreve', () => {
  async function mariasPlaylist() {
    const p = await newPlaylist('De Maria');
    const a = (await add(p.id, YT, 'a')).body as Track;
    const b = (await add(p.id, SP, 'b')).body as Track;
    return { p, a, b };
  }
  const writes = (playlistId: string, a: Track, b: Track, cookie: string | undefined) => [
    callAs(addTrack, { method: 'POST', query: { id: playlistId }, body: { url: SC, label: 'intrusa' }, cookie }),
    callAs(trackById, { method: 'PATCH', query: { id: playlistId, trackId: a.id }, body: { label: 'x' }, cookie }),
    callAs(trackById, { method: 'DELETE', query: { id: playlistId, trackId: a.id }, cookie }),
    callAs(reorder, { method: 'PUT', query: { id: playlistId }, body: { trackIds: [b.id, a.id] }, cookie }),
  ];

  it('outra conta recebe 404 em adicionar, editar rótulo, remover e reordenar, e nada muda', async () => {
    const { p, a, b } = await mariasPlaylist();
    const ana = await signupAs('ana@exemplo.com');
    const before = await detail(p.id);
    const results = [];
    for (const req of writes(p.id, a, b, ana)) results.push(await req);
    expect(results.map((r) => r.statusCode)).toEqual([404, 404, 404, 404]);
    expect(await detail(p.id)).toEqual(before);
  });

  it('visitante recebe 401 em adicionar, editar rótulo, remover e reordenar, e nada muda', async () => {
    const { p, a, b } = await mariasPlaylist();
    const before = await detail(p.id);
    fetchMock.mockClear();
    const results = [];
    for (const req of writes(p.id, a, b, undefined)) results.push(await req);
    expect(results.map((r) => r.statusCode)).toEqual([401, 401, 401, 401]);
    expect(results[0].body).toMatchObject({ error: { code: 'unauthorized' } });
    expect(fetchMock).not.toHaveBeenCalled(); // nem consulta oEmbed
    expect(await detail(p.id)).toEqual(before);
  });

  it('outra conta não reordena nem com a lista exata das faixas', async () => {
    const { p, a, b } = await mariasPlaylist();
    const ana = await signupAs('ana@exemplo.com');
    const res = await callAs(reorder, { method: 'PUT', query: { id: p.id }, body: { trackIds: [b.id, a.id] }, cookie: ana });
    expect(res.statusCode).toBe(404);
    expect(order(await detail(p.id))).toEqual([[0, 'a'], [1, 'b']]);
  });
});
