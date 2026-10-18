import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '../../api/_lib/db.js';
import playlists from '../../api/_routes/playlists/index.js';
import playlistById from '../../api/_routes/playlists/[id]/index.js';
import shareToken from '../../api/_routes/playlists/[id]/share-token.js';
import { call, fakeSql, fakeSqlAs, MARIA, SESSION_COOKIE, type TestUser } from '../helpers.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

const ID = '3f1c2b8e-9a4d-4c6e-8b2a-1d5e7f9a0b3c';
const NOW = new Date('2026-10-02T12:00:00Z');
const playlistRow = {
  id: ID,
  name: 'Ao vivo',
  visibility: 'public',
  share_token: 'tok_tok_tok_tok_tok_12',
  created_at: NOW,
  updated_at: NOW,
};

let sql: ReturnType<typeof fakeSql>;
const useSql = (...responses: unknown[][]) => {
  sql = fakeSql(responses);
  vi.mocked(getSql).mockReturnValue(sql as unknown as ReturnType<typeof getSql>);
};
/** Como useSql, com a consulta de sessão (logada ou visitante) enfileirada primeiro. */
const useSqlAs = (user: TestUser | null, ...responses: unknown[][]) => {
  sql = fakeSqlAs(user, ...responses);
  vi.mocked(getSql).mockReturnValue(sql as unknown as ReturnType<typeof getSql>);
};

beforeEach(() => vi.mocked(getSql).mockReset());

const mineRow = (id: string, name: string, visibility: 'public' | 'private', track_count = 0) => ({
  id, name, updated_at: NOW, visibility, share_token: visibility === 'public' ? `tok_${name}`.padEnd(22, '_') : null, track_count,
});
const publicRow = (name: string, track_count = 0) => ({ name, updated_at: NOW, share_token: `pub_${name}`.padEnd(22, '_'), track_count });

describe('GET /api/playlists', () => {
  it('visitante: mine vazio e só as públicas, sem consultar as de ninguém por dona', async () => {
    useSqlAs(null, [publicRow('A', 3), { ...publicRow('B'), updated_at: new Date('2026-01-01') }]);
    const res = await call(playlists, { method: 'GET', cookie: SESSION_COOKIE });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      mine: [],
      public: [
        { name: 'A', trackCount: 3, updatedAt: NOW.toISOString(), shareToken: 'pub_A_________________' },
        { name: 'B', trackCount: 0, updatedAt: '2026-01-01T00:00:00.000Z', shareToken: 'pub_B_________________' },
      ],
    });
    expect(sql.calls).toHaveLength(2);
    expect(sql.calls[1].text).toMatch(/where p\.visibility = 'public'/);
    expect(sql.calls[1].text).toMatch(/order by p\.updated_at desc/);
    expect(sql.calls[1].values).toContain(null); // nenhuma dona a excluir
  });

  it('visitante sem cookie não consulta sessão', async () => {
    useSql([]);
    const res = await call(playlists, { method: 'GET' });
    expect(res.body).toEqual({ mine: [], public: [] });
    expect(sql.calls).toHaveLength(1);
  });

  it('logada: as suas (com visibilidade) e as públicas das outras contas', async () => {
    useSqlAs(MARIA, [mineRow(ID, 'Minha', 'private', 2), mineRow('p2', 'Aberta', 'public')], [publicRow('DeAna', 1)]);
    const res = await call(playlists, { method: 'GET', cookie: SESSION_COOKIE });
    expect(res.body).toEqual({
      mine: [
        { id: ID, name: 'Minha', trackCount: 2, updatedAt: NOW.toISOString(), visibility: 'private', shareToken: null },
        { id: 'p2', name: 'Aberta', trackCount: 0, updatedAt: NOW.toISOString(), visibility: 'public', shareToken: 'tok_Aberta____________' },
      ],
      public: [{ name: 'DeAna', trackCount: 1, updatedAt: NOW.toISOString(), shareToken: 'pub_DeAna_____________' }],
    });
    expect(sql.calls[1].text).toMatch(/where p\.owner_id = \$\?/);
    expect(sql.calls[1].values).toEqual([MARIA.id]);
    // as públicas excluem as da própria sessão
    expect(sql.calls[2].text).toMatch(/owner_id is distinct from \$\?::uuid/);
    expect(sql.calls[2].values).toContain(MARIA.id);
  });

  it('públicas de outras contas não trazem id nem dados da dona', async () => {
    useSqlAs(MARIA, [], [publicRow('DeAna')]);
    const res = await call(playlists, { method: 'GET', cookie: SESSION_COOKIE });
    const [entry] = (res.body as { public: Record<string, unknown>[] }).public;
    expect(Object.keys(entry).sort()).toEqual(['name', 'shareToken', 'trackCount', 'updatedAt']);
    expect(sql.calls[2].text).not.toMatch(/select p\.id|owner_id,|email/);
  });
});

describe('POST /api/playlists', () => {
  it('logada: cria privada, sem token, sem faixas e com ela como dona', async () => {
    useSqlAs(MARIA, [{ ...playlistRow, visibility: 'private', share_token: null }]);
    const res = await call(playlists, { method: 'POST', body: { name: '  Ao vivo  ' }, cookie: SESSION_COOKIE });
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ id: ID, name: 'Ao vivo', visibility: 'private', shareToken: null, tracks: [] });
    expect(sql.calls[1].text).toMatch(/insert into playlists \(owner_id, name\)/);
    expect(sql.calls[1].values).toEqual([MARIA.id, 'Ao vivo']);
  });

  it('visitante recebe 401 e nada é criado', async () => {
    useSqlAs(null);
    const res = await call(playlists, { method: 'POST', body: { name: 'Ao vivo' }, cookie: SESSION_COOKIE });
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'unauthorized' } });
    expect(sql.calls).toHaveLength(1); // só a consulta de sessão
  });

  it('sem cookie recebe 401 sem tocar no banco', async () => {
    useSql();
    const res = await call(playlists, { method: 'POST', body: { name: 'Ao vivo' } });
    expect(res.statusCode).toBe(401);
    expect(sql.calls).toHaveLength(0);
  });

  it('rejeita nome vazio sem gravar', async () => {
    useSqlAs(MARIA);
    const res = await call(playlists, { method: 'POST', body: { name: '   ' }, cookie: SESSION_COOKIE });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'validation' } });
    expect(sql.calls).toHaveLength(1);
  });

  it('rejeita nome com 101 caracteres', async () => {
    useSqlAs(MARIA);
    const res = await call(playlists, { method: 'POST', body: { name: 'a'.repeat(101) }, cookie: SESSION_COOKIE });
    expect(res.statusCode).toBe(400);
    expect(sql.calls).toHaveLength(1);
  });
});

describe('/api/playlists/[id]', () => {
  const asMaria = { cookie: SESSION_COOKIE };

  it('GET da dona retorna playlist com faixas ordenadas, visibilidade e token', async () => {
    useSqlAs(
      MARIA,
      [playlistRow],
      [
        {
          id: 't1', playlist_id: ID, original_url: 'https://youtu.be/dQw4w9WgXcQ',
          canonical_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', platform: 'youtube',
          external_id: 'dQw4w9WgXcQ', label: 'ao vivo', position: 0, meta_title: 'T', meta_artist: 'A',
          meta_thumbnail_url: null, created_at: NOW, updated_at: NOW,
        },
      ],
    );
    const res = await call(playlistById, { method: 'GET', query: { id: ID }, ...asMaria });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: ID,
      visibility: 'public',
      shareToken: playlistRow.share_token,
      tracks: [{ id: 't1', platform: 'youtube', label: 'ao vivo', title: 'T', artist: 'A', position: 0 }],
    });
    expect(sql.calls[1].text).toMatch(/where id = \$\? and owner_id = \$\?/);
    expect(sql.calls[1].values).toEqual([ID, MARIA.id]);
    expect(sql.calls[2].text).toMatch(/order by position/);
  });

  it('GET de id inexistente (ou de outra conta) responde 404', async () => {
    useSqlAs(MARIA, []);
    const res = await call(playlistById, { method: 'GET', query: { id: ID }, ...asMaria });
    expect(res.statusCode).toBe(404);
  });

  it.each(['GET', 'PATCH', 'DELETE'])('%s sem sessão responde 401 sem tocar em playlists', async (method) => {
    useSqlAs(null);
    const res = await call(playlistById, { method, query: { id: ID }, body: { name: 'x' }, ...asMaria });
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'unauthorized' } });
    expect(sql.calls).toHaveLength(1);
  });

  it.each(['GET', 'PATCH', 'DELETE'])('%s com id que não é UUID responde 404 sem consultar playlists', async (method) => {
    useSqlAs(MARIA);
    const res = await call(playlistById, { method, query: { id: 'tok_tok_tok_tok_tok_12' }, body: { name: 'x' }, ...asMaria });
    expect(res.statusCode).toBe(404);
    expect(sql.calls).toHaveLength(1);
  });

  it('PATCH renomeia e atualiza updated_at sem mexer em visibilidade e token', async () => {
    useSqlAs(MARIA, [{ ...playlistRow, name: 'Mix de domingo' }]);
    const res = await call(playlistById, { method: 'PATCH', query: { id: ID }, body: { name: 'Mix de domingo' }, ...asMaria });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ name: 'Mix de domingo', visibility: 'public', shareToken: playlistRow.share_token });
    expect(sql.calls[1].text).toMatch(/updated_at = now\(\)/);
    expect(sql.calls[1].text).toMatch(/owner_id = \$\?/);
    expect(sql.calls[1].text).not.toMatch(/share_token =|visibility =/);
  });

  it('PATCH com nome inválido responde 400', async () => {
    useSqlAs(MARIA);
    const res = await call(playlistById, { method: 'PATCH', query: { id: ID }, body: { name: '' }, ...asMaria });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH de playlist inexistente responde 404', async () => {
    useSqlAs(MARIA, []);
    const res = await call(playlistById, { method: 'PATCH', query: { id: ID }, body: { name: 'x' }, ...asMaria });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE remove e responde 204', async () => {
    useSqlAs(MARIA, [{ id: ID }]);
    const res = await call(playlistById, { method: 'DELETE', query: { id: ID }, ...asMaria });
    expect(res.statusCode).toBe(204);
    expect(sql.calls[1].text).toMatch(/delete from playlists where id = \$\? and owner_id = \$\?/);
  });

  it('DELETE de playlist inexistente responde 404', async () => {
    useSqlAs(MARIA, []);
    const res = await call(playlistById, { method: 'DELETE', query: { id: ID }, ...asMaria });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/playlists/[id]/share-token', () => {
  const asMaria = { cookie: SESSION_COOKIE };

  it('troca o token de uma playlist pública da dona por um novo valor aleatório', async () => {
    useSqlAs(MARIA, [{ share_token: 'novo_novo_novo_novo_12' }]);
    const res = await call(shareToken, { method: 'POST', query: { id: ID }, ...asMaria });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ shareToken: 'novo_novo_novo_novo_12' });
    const [newToken, id, owner] = sql.calls[1].values as string[];
    expect(newToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newToken).not.toBe(playlistRow.share_token);
    expect([id, owner]).toEqual([ID, MARIA.id]);
    expect(sql.calls[1].text).toMatch(/update playlists set share_token = \$\? where id = \$\? and owner_id = \$\? and visibility = 'public'/);
  });

  it('playlist privada da dona responde 409', async () => {
    useSqlAs(MARIA, [], [{ '?column?': 1 }]);
    const res = await call(shareToken, { method: 'POST', query: { id: ID }, ...asMaria });
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: { code: 'conflict' } });
  });

  it('playlist inexistente ou de outra conta responde 404', async () => {
    useSqlAs(MARIA, [], []);
    const res = await call(shareToken, { method: 'POST', query: { id: ID }, ...asMaria });
    expect(res.statusCode).toBe(404);
  });

  it('visitante responde 401', async () => {
    useSqlAs(null);
    const res = await call(shareToken, { method: 'POST', query: { id: ID }, ...asMaria });
    expect(res.statusCode).toBe(401);
    expect(sql.calls).toHaveLength(1);
  });
});
