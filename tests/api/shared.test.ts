// Visualização pública por token e garantia de que o token não serve para escrita (PGlite real).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '../../api/_lib/db.js';
import playlists from '../../api/playlists/index.js';
import playlistById from '../../api/playlists/[id]/index.js';
import shareTokenRoute from '../../api/playlists/[id]/share-token.js';
import addTrack from '../../api/playlists/[id]/tracks/index.js';
import trackById from '../../api/playlists/[id]/tracks/[trackId].js';
import reorder from '../../api/playlists/[id]/tracks/order.js';
import visibilityRoute from '../../api/playlists/[id]/visibility.js';
import shared from '../../api/shared/[token].js';
import type { PlaylistDetail, SharedPlaylist, Track } from '../../shared/types.js';
import { call } from '../helpers.js';
import { createTestDb, signupAs } from '../pgdb.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let maria: string;

beforeAll(async () => {
  testDb = await createTestDb();
  vi.mocked(getSql).mockReturnValue(testDb.sql as unknown as ReturnType<typeof getSql>);
});
afterAll(() => testDb.db.close());
beforeEach(async () => {
  await testDb.reset();
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ title: 'T', author_name: 'A' })));
  maria = await signupAs('maria@exemplo.com');
});

const setVisibility = async (id: string, visibility: 'public' | 'private') =>
  (await call(visibilityRoute, { method: 'PUT', query: { id }, body: { visibility }, cookie: maria })).body as PlaylistDetail;

/** Playlist de Maria com duas faixas, já pública. */
async function publicPlaylistWithTracks() {
  const created = (await call(playlists, { method: 'POST', body: { name: 'Compartilhada' }, cookie: maria })).body as PlaylistDetail;
  const t1 = (
    await call(addTrack, {
      method: 'POST',
      query: { id: created.id },
      body: { url: 'https://youtu.be/dQw4w9WgXcQ', label: 'um' },
      cookie: maria,
    })
  ).body as Track;
  await call(addTrack, {
    method: 'POST',
    query: { id: created.id },
    body: { url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', label: 'dois' },
    cookie: maria,
  });
  const p = await setVisibility(created.id, 'public');
  return { p: { ...p, shareToken: p.shareToken! }, t1 };
}
const view = (token: string, cookie?: string) => call(shared, { method: 'GET', query: { token }, cookie });

describe('GET /api/shared/[token]', () => {
  it('retorna nome e faixas na ordem, sem ids internos nem dados da dona', async () => {
    const { p, t1 } = await publicPlaylistWithTracks();
    const res = await view(p.shareToken);
    expect(res.statusCode).toBe(200);
    const body = res.body as SharedPlaylist;
    expect(body.name).toBe('Compartilhada');
    expect(body.tracks.map((t) => [t.position, t.label, t.platform])).toEqual([
      [0, 'um', 'youtube'],
      [1, 'dois', 'spotify'],
    ]);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(p.id);
    expect(raw).not.toContain(t1.id);
    expect(raw).not.toContain(p.shareToken);
    expect(raw).not.toContain('maria@exemplo.com');
    const [{ id: ownerId }] = (await testDb.sql`select id from users`) as { id: string }[];
    expect(raw).not.toContain(ownerId);
    expect(Object.keys(body)).toEqual(['name', 'tracks']);
  });

  it('abre igual para visitante e para outra conta logada', async () => {
    const { p } = await publicPlaylistWithTracks();
    const ana = await signupAs('ana@exemplo.com');
    expect((await view(p.shareToken, ana)).body).toEqual((await view(p.shareToken)).body);
  });

  it('reflete alterações feitas pela dona', async () => {
    const { p } = await publicPlaylistWithTracks();
    await call(addTrack, {
      method: 'POST',
      query: { id: p.id },
      body: { url: 'https://soundcloud.com/a/b', label: 'três' },
      cookie: maria,
    });
    expect(((await view(p.shareToken)).body as SharedPlaylist).tracks).toHaveLength(3);
  });

  it('token inexistente ou malformado responde 404 genérico', async () => {
    const a = await view('AAAAAAAAAAAAAAAAAAAAAA');
    const b = await view('../../etc');
    expect(a.statusCode).toBe(404);
    expect(b.statusCode).toBe(404);
    expect(a.body).toEqual(b.body);
  });

  it('playlist que foi privada: o token antigo responde o mesmo 404 de um inexistente', async () => {
    const { p } = await publicPlaylistWithTracks();
    await setVisibility(p.id, 'private');
    const res = await view(p.shareToken);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual((await view('AAAAAAAAAAAAAAAAAAAAAA')).body);
  });

  it('o banco recusa playlist privada com token', async () => {
    // Além do filtro por visibilidade na consulta, o check do banco torna esse estado impossível.
    await expect(
      testDb.sql`insert into playlists (owner_id, name, visibility, share_token)
                 select id, 'x', 'private', 'BBBBBBBBBBBBBBBBBBBBBB' from users`,
    ).rejects.toThrow(/playlists_visibility_token/);
  });

  it('republicar: link novo funciona e o antigo continua 404', async () => {
    const { p } = await publicPlaylistWithTracks();
    await setVisibility(p.id, 'private');
    const again = await setVisibility(p.id, 'public');
    expect(again.shareToken).not.toBe(p.shareToken);
    expect((await view(again.shareToken!)).statusCode).toBe(200);
    expect((await view(p.shareToken)).statusCode).toBe(404);
  });

  it('token regenerado: novo funciona, antigo responde 404', async () => {
    const { p } = await publicPlaylistWithTracks();
    const res = await call(shareTokenRoute, { method: 'POST', query: { id: p.id }, cookie: maria });
    const { shareToken } = res.body as { shareToken: string };
    expect(shareToken).not.toBe(p.shareToken);
    expect((await view(shareToken)).statusCode).toBe(200);
    expect((await view(p.shareToken)).statusCode).toBe(404);
  });

  it('playlist excluída: link público responde 404', async () => {
    const { p } = await publicPlaylistWithTracks();
    await call(playlistById, { method: 'DELETE', query: { id: p.id }, cookie: maria });
    expect((await view(p.shareToken)).statusCode).toBe(404);
  });
});

describe('token público não permite escrita', () => {
  it.each([
    ['da dona', () => maria],
    ['de outra conta', () => signupAs('ana@exemplo.com')],
  ])('com sessão %s, toda rota de escrita com o token no lugar do id responde 404 e nada muda', async (_name, session) => {
    const { p, t1 } = await publicPlaylistWithTracks();
    const cookie = await session();
    const token = p.shareToken;
    const results = await Promise.all([
      call(addTrack, { method: 'POST', query: { id: token }, body: { url: 'https://youtu.be/dQw4w9WgXcQ' }, cookie }),
      call(trackById, { method: 'DELETE', query: { id: token, trackId: t1.id }, cookie }),
      call(trackById, { method: 'PATCH', query: { id: token, trackId: t1.id }, body: { label: 'x' }, cookie }),
      call(reorder, { method: 'PUT', query: { id: token }, body: { trackIds: [t1.id] }, cookie }),
      call(playlistById, { method: 'PATCH', query: { id: token }, body: { name: 'hack' }, cookie }),
      call(playlistById, { method: 'DELETE', query: { id: token }, cookie }),
      call(shareTokenRoute, { method: 'POST', query: { id: token }, cookie }),
      call(visibilityRoute, { method: 'PUT', query: { id: token }, body: { visibility: 'private' }, cookie }),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([404, 404, 404, 404, 404, 404, 404, 404]);

    const after = (await call(playlistById, { method: 'GET', query: { id: p.id }, cookie: maria })).body as PlaylistDetail;
    expect(after.name).toBe('Compartilhada');
    expect(after.visibility).toBe('public');
    expect(after.shareToken).toBe(token);
    expect(after.tracks.map((t) => t.label)).toEqual(['um', 'dois']);
  });
});
