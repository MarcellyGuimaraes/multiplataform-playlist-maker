// Posse das playlists com duas contas reais (Maria e Ana) sobre Postgres (PGlite).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '../../api/_lib/db.js';
import playlists from '../../api/_routes/playlists/index.js';
import playlistById from '../../api/_routes/playlists/[id]/index.js';
import addTrack from '../../api/_routes/playlists/[id]/tracks/index.js';
import trackById from '../../api/_routes/playlists/[id]/tracks/[trackId].js';
import type { PlaylistDetail, Track } from '../../shared/types.js';
import { call } from '../helpers.js';
import { createTestDb, signupAs } from '../pgdb.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let maria: string;
let ana: string;

beforeAll(async () => {
  testDb = await createTestDb();
  vi.mocked(getSql).mockReturnValue(testDb.sql as unknown as ReturnType<typeof getSql>);
});
afterAll(() => testDb.db.close());
beforeEach(async () => {
  await testDb.reset();
  maria = await signupAs('maria@exemplo.com');
  ana = await signupAs('ana@exemplo.com');
});

async function create(cookie: string, name: string) {
  return (await call(playlists, { method: 'POST', body: { name }, cookie })).body as PlaylistDetail;
}

describe('/api/playlists/[id] com duas contas', () => {
  it('a dona abre, renomeia e exclui a sua', async () => {
    const p = await create(maria, 'Mix');
    expect(p).toMatchObject({ name: 'Mix', visibility: 'private', shareToken: null, tracks: [] });

    const got = await call(playlistById, { method: 'GET', query: { id: p.id }, cookie: maria });
    expect(got.statusCode).toBe(200);
    const renamed = await call(playlistById, { method: 'PATCH', query: { id: p.id }, body: { name: 'Mix de domingo' }, cookie: maria });
    expect(renamed.body).toMatchObject({ name: 'Mix de domingo', visibility: 'private', shareToken: null });
    expect((await call(playlistById, { method: 'DELETE', query: { id: p.id }, cookie: maria })).statusCode).toBe(204);
  });

  it.each(['private', 'public'] as const)(
    'outra conta recebe 404 em GET, PATCH e DELETE de uma playlist %s, e nada muda',
    async (visibility) => {
      const p = await create(maria, 'De Maria');
      if (visibility === 'public') {
        await testDb.sql`update playlists set visibility = 'public', share_token = 'AAAAAAAAAAAAAAAAAAAAAA' where id = ${p.id}`;
      }
      const results = [
        await call(playlistById, { method: 'GET', query: { id: p.id }, cookie: ana }),
        await call(playlistById, { method: 'PATCH', query: { id: p.id }, body: { name: 'hack' }, cookie: ana }),
        await call(playlistById, { method: 'DELETE', query: { id: p.id }, cookie: ana }),
      ];
      expect(results.map((r) => r.statusCode)).toEqual([404, 404, 404]);
      // mesmo corpo de uma playlist inexistente
      const missing = await call(playlistById, {
        method: 'GET',
        query: { id: '00000000-0000-4000-8000-000000000000' },
        cookie: ana,
      });
      expect(results[0].body).toEqual(missing.body);

      const after = (await call(playlistById, { method: 'GET', query: { id: p.id }, cookie: maria })).body as PlaylistDetail;
      expect(after.name).toBe('De Maria');
    },
  );

  it('sem sessão: 401 em GET, PATCH e DELETE, e nada muda', async () => {
    const p = await create(maria, 'De Maria');
    const results = [
      await call(playlistById, { method: 'GET', query: { id: p.id } }),
      await call(playlistById, { method: 'PATCH', query: { id: p.id }, body: { name: 'hack' } }),
      await call(playlistById, { method: 'DELETE', query: { id: p.id } }),
    ];
    expect(results.map((r) => r.statusCode)).toEqual([401, 401, 401]);
    expect(await testDb.sql`select name from playlists`).toEqual([{ name: 'De Maria' }]);
  });
});

describe('GET /api/playlists com duas contas', () => {
  it('cada uma vê as suas e só as públicas da outra; visitante vê só as públicas', async () => {
    const mPriv = await create(maria, 'Maria privada');
    const mPub = await create(maria, 'Maria pública');
    const aPub = await create(ana, 'Ana pública');
    await create(ana, 'Ana privada');
    await testDb.sql`
      update playlists set visibility = 'public', share_token = left(md5(id::text), 22) where id in (${mPub.id}, ${aPub.id})
    `;

    type List = { mine: { id: string; name: string; visibility: string }[]; public: { name: string }[] };
    const asMaria = (await call(playlists, { method: 'GET', cookie: maria })).body as List;
    expect(asMaria.mine.map((p) => [p.name, p.visibility]).sort()).toEqual([
      ['Maria privada', 'private'],
      ['Maria pública', 'public'],
    ]);
    expect(asMaria.mine.map((p) => p.id)).toContain(mPriv.id);
    expect(asMaria.public.map((p) => p.name)).toEqual(['Ana pública']);
    expect(JSON.stringify(asMaria.public)).not.toContain(aPub.id);
    expect(JSON.stringify(asMaria.public)).not.toContain('ana@exemplo.com');

    const visitor = (await call(playlists, { method: 'GET' })).body as List;
    expect(visitor.mine).toEqual([]);
    expect(visitor.public.map((p) => p.name).sort()).toEqual(['Ana pública', 'Maria pública']);
  });
});

describe('versão no YouTube com duas contas', () => {
  it('outra conta recebe 404 ao cadastrar ou remover versão numa faixa de Maria, e nada muda', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ title: 'T' })));
    const p = await create(maria, 'De Maria');
    const t = (
      await call(addTrack, {
        method: 'POST',
        query: { id: p.id },
        body: { url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' },
        cookie: maria,
      })
    ).body as Track;
    const results = [
      await call(trackById, {
        method: 'PATCH',
        query: { id: p.id, trackId: t.id },
        body: { youtubeAlt: 'https://youtu.be/dQw4w9WgXcQ' },
        cookie: ana,
      }),
      await call(trackById, { method: 'PATCH', query: { id: p.id, trackId: t.id }, body: { youtubeAlt: null }, cookie: ana }),
    ];
    expect(results.map((r) => r.statusCode)).toEqual([404, 404]);
    expect(await testDb.sql`select youtube_alt_id from tracks`).toEqual([{ youtube_alt_id: null }]);
    vi.unstubAllGlobals();
  });
});
