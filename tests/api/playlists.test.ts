import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '../../api/_lib/db.js';
import playlists from '../../api/playlists/index.js';
import playlistById from '../../api/playlists/[id]/index.js';
import shareToken from '../../api/playlists/[id]/share-token.js';
import { call, fakeSql } from '../helpers.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

const ID = '3f1c2b8e-9a4d-4c6e-8b2a-1d5e7f9a0b3c';
const NOW = new Date('2026-10-02T12:00:00Z');
const playlistRow = { id: ID, name: 'Ao vivo', share_token: 'tok_tok_tok_tok_tok_12', created_at: NOW, updated_at: NOW };

let sql: ReturnType<typeof fakeSql>;
const useSql = (...responses: unknown[][]) => {
  sql = fakeSql(responses);
  vi.mocked(getSql).mockReturnValue(sql as unknown as ReturnType<typeof getSql>);
};

beforeEach(() => vi.mocked(getSql).mockReset());

describe('GET /api/playlists', () => {
  it('lista com contagem de faixas, mais recente primeiro', async () => {
    useSql([
      { id: 'b', name: 'B', updated_at: NOW, track_count: 3 },
      { id: 'a', name: 'A', updated_at: new Date('2026-01-01'), track_count: 0 },
    ]);
    const res = await call(playlists, { method: 'GET' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { id: 'b', name: 'B', trackCount: 3, updatedAt: NOW.toISOString() },
      { id: 'a', name: 'A', trackCount: 0, updatedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    expect(sql.calls[0].text).toMatch(/order by p\.updated_at desc/);
  });

  it('lista vazia', async () => {
    useSql([]);
    const res = await call(playlists, { method: 'GET' });
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/playlists', () => {
  it('cria com nome válido, sem faixas e com token próprio', async () => {
    useSql([playlistRow]);
    const res = await call(playlists, { method: 'POST', body: { name: '  Ao vivo  ' } });
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ id: ID, name: 'Ao vivo', shareToken: playlistRow.share_token, tracks: [] });
    const [name, token] = sql.calls[0].values as string[];
    expect(name).toBe('Ao vivo');
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(token).not.toBe(ID);
  });

  it('rejeita nome vazio sem tocar no banco', async () => {
    useSql();
    const res = await call(playlists, { method: 'POST', body: { name: '   ' } });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'validation' } });
    expect(sql.calls).toHaveLength(0);
  });

  it('rejeita nome com 101 caracteres', async () => {
    useSql();
    const res = await call(playlists, { method: 'POST', body: { name: 'a'.repeat(101) } });
    expect(res.statusCode).toBe(400);
    expect(sql.calls).toHaveLength(0);
  });
});

describe('/api/playlists/[id]', () => {
  it('GET retorna playlist com faixas ordenadas', async () => {
    useSql(
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
    const res = await call(playlistById, { method: 'GET', query: { id: ID } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: ID,
      shareToken: playlistRow.share_token,
      tracks: [{ id: 't1', platform: 'youtube', label: 'ao vivo', title: 'T', artist: 'A', position: 0 }],
    });
    expect(sql.calls[1].text).toMatch(/order by position/);
  });

  it('GET de id inexistente responde 404', async () => {
    useSql([]);
    const res = await call(playlistById, { method: 'GET', query: { id: ID } });
    expect(res.statusCode).toBe(404);
  });

  it.each(['GET', 'PATCH', 'DELETE'])('%s com id que não é UUID responde 404 sem consultar o banco', async (method) => {
    useSql();
    const res = await call(playlistById, { method, query: { id: 'tok_tok_tok_tok_tok_12' }, body: { name: 'x' } });
    expect(res.statusCode).toBe(404);
    expect(sql.calls).toHaveLength(0);
  });

  it('PATCH renomeia e atualiza updated_at', async () => {
    useSql([{ ...playlistRow, name: 'Mix de domingo' }]);
    const res = await call(playlistById, { method: 'PATCH', query: { id: ID }, body: { name: 'Mix de domingo' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ name: 'Mix de domingo', shareToken: playlistRow.share_token });
    expect(sql.calls[0].text).toMatch(/updated_at = now\(\)/);
    expect(sql.calls[0].text).not.toMatch(/share_token =/);
  });

  it('PATCH com nome inválido responde 400', async () => {
    useSql();
    const res = await call(playlistById, { method: 'PATCH', query: { id: ID }, body: { name: '' } });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH de playlist inexistente responde 404', async () => {
    useSql([]);
    const res = await call(playlistById, { method: 'PATCH', query: { id: ID }, body: { name: 'x' } });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE remove e responde 204', async () => {
    useSql([{ id: ID }]);
    const res = await call(playlistById, { method: 'DELETE', query: { id: ID } });
    expect(res.statusCode).toBe(204);
    expect(sql.calls[0].text).toMatch(/delete from playlists/);
  });

  it('DELETE de playlist inexistente responde 404', async () => {
    useSql([]);
    const res = await call(playlistById, { method: 'DELETE', query: { id: ID } });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/playlists/[id]/share-token', () => {
  it('troca o token por um novo valor aleatório', async () => {
    useSql([{ share_token: 'novo_novo_novo_novo_12' }]);
    const res = await call(shareToken, { method: 'POST', query: { id: ID } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ shareToken: 'novo_novo_novo_novo_12' });
    const [newToken] = sql.calls[0].values as string[];
    expect(newToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newToken).not.toBe(playlistRow.share_token);
    expect(sql.calls[0].text).toMatch(/update playlists set share_token =/);
  });

  it('playlist inexistente responde 404', async () => {
    useSql([]);
    const res = await call(shareToken, { method: 'POST', query: { id: ID } });
    expect(res.statusCode).toBe(404);
  });
});
