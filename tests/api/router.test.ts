// Despacho das rotas pela função única da API (api/index.ts).
import { describe, expect, it, vi } from 'vitest';
import { dispatch, matchApiRoute } from '../../api/_lib/router.js';
import confirm from '../../api/_routes/auth/password-reset/confirm.js';
import passwordReset from '../../api/_routes/auth/password-reset/index.js';
import playlistById from '../../api/_routes/playlists/[id]/index.js';
import trackById from '../../api/_routes/playlists/[id]/tracks/[trackId].js';
import tracks from '../../api/_routes/playlists/[id]/tracks/index.js';
import tracksOrder from '../../api/_routes/playlists/[id]/tracks/order.js';
import playlists from '../../api/_routes/playlists/index.js';
import shared from '../../api/_routes/shared/[token].js';
import { fakeReq, fakeRes } from '../helpers.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

describe('matchApiRoute', () => {
  it.each([
    ['playlists', playlists, {}],
    ['playlists/', playlists, {}],
    ['playlists/p1', playlistById, { id: 'p1' }],
    ['playlists/p1/tracks', tracks, { id: 'p1' }],
    ['playlists/p1/tracks/order', tracksOrder, { id: 'p1' }],
    ['playlists/p1/tracks/t1', trackById, { id: 'p1', trackId: 't1' }],
    ['auth/password-reset', passwordReset, {}],
    ['auth/password-reset/confirm', confirm, {}],
    ['shared/abc%2Fdef', shared, { token: 'abc/def' }],
  ])('%s', (path, handler, params) => {
    expect(matchApiRoute(path)).toEqual({ handler, params });
  });

  it.each(['', 'nada', 'playlists/p1/tracks/t1/extra', 'auth', 'shared/%E0%A4%A'])('"%s" não existe', (path) => {
    expect(matchApiRoute(path)).toBeNull();
  });
});

describe('dispatch', () => {
  it('lê o caminho do rewrite (?path=) e entrega só os parâmetros da rota em req.query', async () => {
    const req = fakeReq({ method: 'POST', query: { path: 'shared/x', extra: '1' } });
    const res = fakeRes();
    await dispatch(req, res);
    expect(res.statusCode).toBe(405); // o handler de shared/:token só aceita GET
    expect(req.query).toEqual({ extra: '1', token: 'x' });
  });

  it('sem ?path=, usa o caminho da URL (servidor de desenvolvimento)', async () => {
    const req = Object.assign(fakeReq({ method: 'POST' }), { url: '/api/shared/x?y=1' });
    const res = fakeRes();
    await dispatch(req, res);
    expect(res.statusCode).toBe(405);
    expect(req.query).toEqual({ token: 'x' });
  });

  it('rota inexistente responde 404 em JSON', async () => {
    const res = fakeRes();
    await dispatch(fakeReq({ method: 'GET', query: { path: 'nada' } }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found', message: 'Rota não encontrada.' } });
  });
});
