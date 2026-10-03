// Testes dos handlers de faixas contra um Postgres real (PGlite), com o fetch externo (oEmbed) simulado.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '../../api/_lib/db.js';
import playlists from '../../api/playlists/index.js';
import playlistById from '../../api/playlists/[id]/index.js';
import addTrack from '../../api/playlists/[id]/tracks/index.js';
import trackById from '../../api/playlists/[id]/tracks/[trackId].js';
import reorder from '../../api/playlists/[id]/tracks/order.js';
import type { PlaylistDetail, Track } from '../../shared/types.js';
import { call } from '../helpers.js';
import { createTestDb } from '../pgdb.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const SP = 'https://open.spotify.com/intl-pt/track/4uLU6hMCjMI75M1A2tKUQC?si=xyz';
const SC = 'https://soundcloud.com/artista-pequeno/demo-2024';
const MISSING = '00000000-0000-4000-8000-000000000000';

let testDb: Awaited<ReturnType<typeof createTestDb>>;
const fetchMock = vi.fn();

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
});

async function newPlaylist(name = 'Teste') {
  const res = await call(playlists, { method: 'POST', body: { name } });
  return res.body as PlaylistDetail;
}
async function add(playlistId: string, url: string, label?: string) {
  return call(addTrack, { method: 'POST', query: { id: playlistId }, body: { url, label } });
}
async function detail(playlistId: string) {
  return (await call(playlistById, { method: 'GET', query: { id: playlistId } })).body as PlaylistDetail;
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
    const res = await call(trackById, {
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
    const res = await call(trackById, { method: 'DELETE', query: { id: p.id, trackId: b.id } });
    expect(res.statusCode).toBe(204);
    expect(order(await detail(p.id))).toEqual([[0, 'a'], [1, 'c']]);
  });

  it('não remove nem edita faixa de outra playlist', async () => {
    const a = await newPlaylist('A');
    const b = await newPlaylist('B');
    const tb = (await add(b.id, YT, 'de B')).body as Track;
    const del = await call(trackById, { method: 'DELETE', query: { id: a.id, trackId: tb.id } });
    const patch = await call(trackById, { method: 'PATCH', query: { id: a.id, trackId: tb.id }, body: { label: 'x' } });
    expect(del.statusCode).toBe(404);
    expect(patch.statusCode).toBe(404);
    expect(order(await detail(b.id))).toEqual([[0, 'de B']]);
  });

  it('remover faixa inexistente responde 404 sem mexer nas posições', async () => {
    const p = await newPlaylist();
    await add(p.id, YT, 'a');
    const res = await call(trackById, { method: 'DELETE', query: { id: p.id, trackId: MISSING } });
    expect(res.statusCode).toBe(404);
    expect(order(await detail(p.id))).toEqual([[0, 'a']]);
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
  const put = (id: string, trackIds: unknown) => call(reorder, { method: 'PUT', query: { id }, body: { trackIds } });

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
    expect((await call(playlistById, { method: 'DELETE', query: { id: p.id } })).statusCode).toBe(204);
    const rows = await testDb.sql`select count(*)::int as n from tracks`;
    expect(rows[0].n).toBe(0);
  });
});
