// Visibilidade e ciclo de vida do token de compartilhamento contra um Postgres real (PGlite).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '../../api/_lib/db.js';
import playlists from '../../api/_routes/playlists/index.js';
import shareTokenRoute from '../../api/_routes/playlists/[id]/share-token.js';
import visibilityRoute from '../../api/_routes/playlists/[id]/visibility.js';
import type { PlaylistDetail, Visibility } from '../../shared/types.js';
import { call } from '../helpers.js';
import { createTestDb, signupAs } from '../pgdb.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let maria: string;
let playlist: PlaylistDetail;

beforeAll(async () => {
  testDb = await createTestDb();
  vi.mocked(getSql).mockReturnValue(testDb.sql as unknown as ReturnType<typeof getSql>);
});
afterAll(() => testDb.db.close());
beforeEach(async () => {
  await testDb.reset();
  maria = await signupAs('maria@exemplo.com');
  playlist = (await call(playlists, { method: 'POST', body: { name: 'Mix' }, cookie: maria })).body as PlaylistDetail;
});

const setVisibility = (visibility: Visibility | string, cookie: string | null = maria, id = playlist.id) =>
  call(visibilityRoute, { method: 'PUT', query: { id }, body: { visibility }, cookie: cookie ?? undefined });
const tokenOf = (res: Awaited<ReturnType<typeof setVisibility>>) => (res.body as PlaylistDetail).shareToken;

describe('PUT /api/playlists/[id]/visibility', () => {
  it('publicar gera token de 128 bits distinto do id', async () => {
    const res = await setVisibility('public');
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: playlist.id, name: 'Mix', visibility: 'public' });
    expect(tokenOf(res)).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(tokenOf(res)).not.toContain(playlist.id);
  });

  it('privar zera o token', async () => {
    await setVisibility('public');
    const res = await setVisibility('private');
    expect(res.body).toMatchObject({ visibility: 'private', shareToken: null });
    expect(await testDb.sql`select share_token from playlists`).toEqual([{ share_token: null }]);
  });

  it('republicar gera token diferente do anterior', async () => {
    const first = tokenOf(await setVisibility('public'));
    await setVisibility('private');
    const second = tokenOf(await setVisibility('public'));
    expect(second).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(second).not.toBe(first);
  });

  it('publicar o que já é público mantém o token (idempotente)', async () => {
    const first = tokenOf(await setVisibility('public'));
    expect(tokenOf(await setVisibility('public'))).toBe(first);
  });

  it('privar o que já é privado continua sem token', async () => {
    expect((await setVisibility('private')).body).toMatchObject({ visibility: 'private', shareToken: null });
  });

  it('não altera nome nem faixas', async () => {
    await testDb.sql`
      insert into tracks (playlist_id, original_url, canonical_url, platform, external_id, position)
      values (${playlist.id}, 'u', 'u', 'youtube', 'x', 0)
    `;
    await setVisibility('public');
    expect(await testDb.sql`select name from playlists`).toEqual([{ name: 'Mix' }]);
    expect(await testDb.sql`select count(*)::int as n from tracks`).toEqual([{ n: 1 }]);
  });

  it('outra conta recebe 404 e nada muda', async () => {
    const ana = await signupAs('ana@exemplo.com');
    const res = await setVisibility('public', ana);
    expect(res.statusCode).toBe(404);
    expect(await testDb.sql`select visibility, share_token from playlists`).toEqual([
      { visibility: 'private', share_token: null },
    ]);
  });

  it('visitante recebe 401', async () => {
    expect((await setVisibility('public', null)).statusCode).toBe(401);
  });

  it('valor inválido responde 400; id que não é UUID responde 404', async () => {
    expect((await setVisibility('unlisted')).statusCode).toBe(400);
    expect((await setVisibility('public', maria, 'AAAAAAAAAAAAAAAAAAAAAA')).statusCode).toBe(404);
  });
});

describe('POST /api/playlists/[id]/share-token', () => {
  const regenerate = (cookie: string | undefined = maria) =>
    call(shareTokenRoute, { method: 'POST', query: { id: playlist.id }, cookie });

  it('pública da dona: token novo, diferente do anterior', async () => {
    const before = tokenOf(await setVisibility('public'));
    const res = await regenerate();
    expect(res.statusCode).toBe(200);
    const { shareToken } = res.body as { shareToken: string };
    expect(shareToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(shareToken).not.toBe(before);
  });

  it('privada da dona: 409 e continua sem token', async () => {
    const res = await regenerate();
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: { code: 'conflict' } });
    expect(await testDb.sql`select visibility, share_token from playlists`).toEqual([
      { visibility: 'private', share_token: null },
    ]);
  });

  it('outra conta recebe 404 mesmo com a playlist pública, e o token não muda', async () => {
    const before = tokenOf(await setVisibility('public'));
    const ana = await signupAs('ana@exemplo.com');
    expect((await regenerate(ana)).statusCode).toBe(404);
    expect(await testDb.sql`select share_token from playlists`).toEqual([{ share_token: before }]);
  });
});
