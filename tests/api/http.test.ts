import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { isUuid, newShareToken, parseBody, route } from '../../api/_lib/http.js';
import { call, fakeReq, fakeRes, type FakeReqInit } from '../helpers.js';

describe('route', () => {
  it('despacha pelo método', async () => {
    const handler = route({ GET: (_req, res) => res.status(200).json({ ok: true }) });
    const res = await call(handler, { method: 'GET' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('responde 405 com Allow para método não suportado', async () => {
    const res = await call(route({ GET: () => {}, POST: () => {} }), { method: 'DELETE' });
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('GET, POST');
    expect(res.body).toEqual({ error: { code: 'method_not_allowed', message: expect.any(String) } });
  });

  it('rejeita escrita com corpo que não é JSON sem chamar o handler', async () => {
    const handler = vi.fn();
    const r = route({ POST: handler, PUT: handler, PATCH: handler, DELETE: handler, GET: handler });
    const cases: FakeReqInit[] = [
      { method: 'POST', body: 'name=x', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
      { method: 'PUT', body: '{"a":1}', headers: { 'content-type': 'text/plain' } },
      { method: 'PATCH', body: { name: 'x' }, headers: {} },
      { method: 'DELETE', headers: { 'content-type': 'multipart/form-data', 'content-length': '12' } },
      { method: 'POST', headers: { 'content-type': 'application/jsonp', 'content-length': '2' } },
    ];
    for (const init of cases) {
      const res = await call(r, init);
      expect(res.statusCode).toBe(415);
      expect(res.body).toMatchObject({ error: { code: 'validation' } });
    }
    expect(handler).not.toHaveBeenCalled();

    // JSON (com charset), escrita sem corpo e leitura passam
    await call(r, { method: 'POST', body: { a: 1 }, headers: { 'content-type': 'application/json; charset=utf-8' } });
    await call(r, { method: 'POST' });
    await call(r, { method: 'GET', headers: { 'content-type': 'text/plain' } });
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('converte exceção em 500 genérico sem vazar detalhes', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = route({
      GET: () => {
        throw new Error('connect ECONNREFUSED postgresql://user:segredo@ep-x.neon.tech/db');
      },
    });
    const res = await call(handler, { method: 'GET' });
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/neon|segredo|postgres|ECONNREFUSED|at /);
    expect(res.body).toEqual({ error: { code: 'internal', message: 'Erro interno. Tente novamente.' } });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('parseBody', () => {
  const schema = z.object({ name: z.string().min(1, 'Nome obrigatório.') });

  it('retorna os dados válidos', () => {
    const res = fakeRes();
    expect(parseBody(fakeReq({ method: 'POST', body: { name: 'x' } }), res, schema)).toEqual({ name: 'x' });
  });

  it('responde 400 com a primeira mensagem de erro', () => {
    const res = fakeRes();
    expect(parseBody(fakeReq({ method: 'POST', body: { name: '' } }), res, schema)).toBeNull();
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { code: 'validation', message: 'Nome obrigatório.' } });
  });

  it('trata corpo ausente como objeto vazio', () => {
    const res = fakeRes();
    expect(parseBody(fakeReq({ method: 'POST' }), res, schema)).toBeNull();
    expect(res.statusCode).toBe(400);
  });
});

describe('isUuid', () => {
  it('aceita UUID e rejeita token de compartilhamento', () => {
    expect(isUuid('3f1c2b8e-9a4d-4c6e-8b2a-1d5e7f9a0b3c')).toBe(true);
    expect(isUuid(newShareToken())).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe('newShareToken', () => {
  it('gera 22 caracteres base64url (128 bits) e valores distintos', () => {
    const a = newShareToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(a, 'base64url')).toHaveLength(16);
    expect(newShareToken()).not.toBe(a);
  });
});
