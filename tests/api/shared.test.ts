// Visualização pública por token e garantia de que o token não serve para escrita (PGlite real).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '../../api/_lib/db.js';
import playlists from '../../api/playlists/index.js';
import playlistById from '../../api/playlists/[id]/index.js';
import shareTokenRoute from '../../api/playlists/[id]/share-token.js';
import addTrack from '../../api/playlists/[id]/tracks/index.js';
import trackById from '../../api/playlists/[id]/tracks/[trackId].js';
import reorder from '../../api/playlists/[id]/tracks/order.js';
import shared from '../../api/shared/[token].js';
import type { PlaylistDetail, SharedPlaylist, Track } from '../../shared/types.js';
import { call } from '../helpers.js';
import { createTestDb } from '../pgdb.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  testDb = await createTestDb();
  vi.mocked(getSql).mockReturnValue(testDb.sql as unknown as ReturnType<typeof getSql>);
});
afterAll(() => testDb.db.close());
beforeEach(async () => {
  await testDb.reset();
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ title: 'T', author_name: 'A' })));
});

async function playlistWithTracks() {
  const p = (await call(playlists, { method: 'POST', body: { name: 'Compartilhada' } })).body as PlaylistDetail;
  const t1 = (
    await call(addTrack, { method: 'POST', query: { id: p.id }, body: { url: 'https://youtu.be/dQw4w9WgXcQ', label: 'um' } })
  ).body as Track;
  await call(addTrack, {
    method: 'POST',
    query: { id: p.id },
    body: { url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', label: 'dois' },
  });
  return { p, t1 };
}
const view = (token: string) => call(shared, { method: 'GET', query: { token } });

describe('GET /api/shared/[token]', () => {
  it('retorna nome e faixas na ordem, sem ids internos', async () => {
    const { p, t1 } = await playlistWithTracks();
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
    expect(Object.keys(body)).toEqual(['name', 'tracks']);
  });

  it('reflete alterações feitas pela dona', async () => {
    const { p } = await playlistWithTracks();
    await call(addTrack, {
      method: 'POST',
      query: { id: p.id },
      body: { url: 'https://soundcloud.com/a/b', label: 'três' },
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

  it('token regenerado: novo funciona, antigo responde 404', async () => {
    const { p } = await playlistWithTracks();
    const res = await call(shareTokenRoute, { method: 'POST', query: { id: p.id } });
    const { shareToken } = res.body as { shareToken: string };
    expect(shareToken).not.toBe(p.shareToken);
    expect((await view(shareToken)).statusCode).toBe(200);
    expect((await view(p.shareToken)).statusCode).toBe(404);
  });

  it('playlist excluída: link público responde 404', async () => {
    const { p } = await playlistWithTracks();
    await call(playlistById, { method: 'DELETE', query: { id: p.id } });
    expect((await view(p.shareToken)).statusCode).toBe(404);
  });
});

describe('token público não permite escrita', () => {
  it('todas as rotas de escrita com o token no lugar do id respondem 404 e nada muda', async () => {
    const { p, t1 } = await playlistWithTracks();
    const token = p.shareToken;
    const results = await Promise.all([
      call(addTrack, { method: 'POST', query: { id: token }, body: { url: 'https://youtu.be/dQw4w9WgXcQ' } }),
      call(trackById, { method: 'DELETE', query: { id: token, trackId: t1.id } }),
      call(trackById, { method: 'PATCH', query: { id: token, trackId: t1.id }, body: { label: 'x' } }),
      call(reorder, { method: 'PUT', query: { id: token }, body: { trackIds: [t1.id] } }),
      call(playlistById, { method: 'PATCH', query: { id: token }, body: { name: 'hack' } }),
      call(playlistById, { method: 'DELETE', query: { id: token } }),
      call(shareTokenRoute, { method: 'POST', query: { id: token } }),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([404, 404, 404, 404, 404, 404, 404]);

    const after = (await call(playlistById, { method: 'GET', query: { id: p.id } })).body as PlaylistDetail;
    expect(after.name).toBe('Compartilhada');
    expect(after.shareToken).toBe(token);
    expect(after.tracks.map((t) => t.label)).toEqual(['um', 'dois']);
  });
});
