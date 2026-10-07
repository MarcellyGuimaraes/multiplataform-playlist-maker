// Sessão por cookie (api/_lib/auth.ts) contra um Postgres real (PGlite).
import type { VercelRequest } from '@vercel/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSession,
  destroySession,
  getSessionUser,
  hashToken,
  parseCookies,
  requireUser,
  sessionCookie,
} from '../../api/_lib/auth.js';
import { getSql } from '../../api/_lib/db.js';
import { fakeRes } from '../helpers.js';
import { createTestDb } from '../pgdb.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

beforeAll(async () => {
  testDb = await createTestDb();
  vi.mocked(getSql).mockReturnValue(testDb.sql as unknown as ReturnType<typeof getSql>);
});
afterAll(() => testDb.db.close());
beforeEach(async () => {
  await testDb.reset();
  [{ id: userId }] = (await testDb.sql`
    insert into users (email, password_hash) values ('maria@exemplo.com', 'x') returning id
  `) as { id: string }[];
});
afterEach(() => vi.unstubAllEnvs());

const reqWithCookie = (cookie?: string) => ({ headers: cookie ? { cookie } : {} }) as VercelRequest;

/** Cria uma sessão e devolve o valor do cookie `sid`. */
async function login() {
  const res = fakeRes();
  await createSession(res, userId);
  return parseCookies(res.headers['set-cookie'].split(';')[0]).sid;
}

describe('sessão', () => {
  it('sessão válida identifica a conta', async () => {
    const sid = await login();
    expect(sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await getSessionUser(reqWithCookie(`outro=1; sid=${sid}`))).toEqual({ id: userId, email: 'maria@exemplo.com' });
  });

  it('o banco guarda só o hash do cookie', async () => {
    const sid = await login();
    const rows = (await testDb.sql`select token_hash from sessions`) as { token_hash: string }[];
    expect(rows).toEqual([{ token_hash: hashToken(sid) }]);
    expect(rows[0].token_hash).not.toBe(sid);
  });

  it('sessão criada há mais de 30 dias é tratada como visitante', async () => {
    const sid = await login();
    await testDb.sql`update sessions set expires_at = now() - interval '1 second'`;
    expect(await getSessionUser(reqWithCookie(`sid=${sid}`))).toBeNull();
  });

  it('expira 30 dias após a criação', async () => {
    await login();
    const [{ days }] = (await testDb.sql`
      select round(extract(epoch from expires_at - created_at) / 86400)::int as days from sessions
    `) as { days: number }[];
    expect(days).toBe(30);
  });

  it('sem cookie, cookie inexistente ou adulterado é visitante', async () => {
    const sid = await login();
    const tampered = (sid[0] === 'A' ? 'B' : 'A') + sid.slice(1);
    expect(await getSessionUser(reqWithCookie())).toBeNull();
    expect(await getSessionUser(reqWithCookie(`sid=${'A'.repeat(43)}`))).toBeNull();
    expect(await getSessionUser(reqWithCookie(`sid=${tampered}`))).toBeNull();
    expect(await getSessionUser(reqWithCookie(`sid=${sid}x`))).toBeNull();
    expect(await getSessionUser(reqWithCookie(`sid=' or 1=1 --`))).toBeNull();
  });

  it('requireUser responde 401 para visitante', async () => {
    const res = fakeRes();
    expect(await requireUser(reqWithCookie(), res)).toBeNull();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'unauthorized' } });
  });

  it('destroySession apaga a sessão no servidor e expira o cookie', async () => {
    const sid = await login();
    const res = fakeRes();
    await destroySession(reqWithCookie(`sid=${sid}`), res);
    expect(res.headers['set-cookie']).toMatch(/^sid=; .*Max-Age=0/);
    expect(await getSessionUser(reqWithCookie(`sid=${sid}`))).toBeNull();
    expect(await testDb.sql`select 1 from sessions`).toHaveLength(0);
  });
});

describe('atributos do cookie', () => {
  it('HttpOnly, SameSite=Lax, Path=/ e 30 dias; sem Secure no dev local', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL', '');
    const res = fakeRes();
    await createSession(res, userId);
    const cookie = res.headers['set-cookie'];
    expect(cookie).toMatch(/; HttpOnly(;|$)/);
    expect(cookie).toMatch(/; SameSite=Lax(;|$)/);
    expect(cookie).toMatch(/; Path=\/(;|$)/);
    expect(cookie).toMatch(/; Max-Age=2592000(;|$)/);
    expect(cookie).not.toMatch(/Secure/);
  });

  it('Secure em produção ou na Vercel', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(sessionCookie('x', 1)).toMatch(/; Secure$/);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL', '1');
    expect(sessionCookie('x', 1)).toMatch(/; Secure$/);
  });
});

describe('parseCookies', () => {
  it('lê pares, ignora lixo e mantém o primeiro valor repetido', () => {
    expect(parseCookies('a=1; b = 2 ;; =x; c; a=3; d=%41')).toEqual({ a: '1', b: '2', d: 'A' });
    expect(parseCookies(undefined)).toEqual({});
  });
});
