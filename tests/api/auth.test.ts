// Rotas de conta (cadastro, login, logout, sessão atual) contra um Postgres real (PGlite).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSql } from '../../api/_lib/db.js';
import login from '../../api/_routes/auth/login.js';
import logout from '../../api/_routes/auth/logout.js';
import me from '../../api/_routes/auth/me.js';
import signup from '../../api/_routes/auth/signup.js';
import { call, cookieFrom, type FakeRes } from '../helpers.js';
import { createTestDb } from '../pgdb.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  testDb = await createTestDb();
  vi.mocked(getSql).mockReturnValue(testDb.sql as unknown as ReturnType<typeof getSql>);
});
afterAll(() => testDb.db.close());
beforeEach(() => testDb.reset());

const PASSWORD = 'segredo123';
const doSignup = (email: string, password = PASSWORD) => call(signup, { method: 'POST', body: { email, password } });
const doLogin = (email: string, password = PASSWORD) => call(login, { method: 'POST', body: { email, password } });
const whoAmI = (cookie?: string) => call(me, { method: 'GET', cookie });

/** Nenhuma resposta pode conter a senha nem o hash guardado. */
async function expectNoSecrets(res: FakeRes, password = PASSWORD) {
  const raw = JSON.stringify(res.body ?? null) + JSON.stringify(res.headers);
  expect(raw).not.toContain(password);
  expect(raw).not.toMatch(/scrypt|password_?hash/i);
  for (const { password_hash } of (await testDb.sql`select password_hash from users`) as { password_hash: string }[]) {
    expect(raw).not.toContain(password_hash.split('$').at(-1));
  }
}

describe('POST /api/auth/signup', () => {
  it('cadastro válido normaliza o e-mail, guarda só o hash e já loga', async () => {
    const res = await doSignup('Maria@Exemplo.com ');
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ user: { id: expect.any(String), email: 'maria@exemplo.com' } });
    await expectNoSecrets(res);

    const [row] = (await testDb.sql`select email, password_hash from users`) as { email: string; password_hash: string }[];
    expect(row.email).toBe('maria@exemplo.com');
    expect(row.password_hash).not.toContain(PASSWORD);

    expect((await whoAmI(cookieFrom(res))).body).toEqual(res.body);
  });

  it('mesma senha em duas contas gera hashes diferentes', async () => {
    await doSignup('maria@exemplo.com');
    await doSignup('ana@exemplo.com');
    const rows = (await testDb.sql`select password_hash from users`) as { password_hash: string }[];
    expect(rows[0].password_hash).not.toBe(rows[1].password_hash);
  });

  it('e-mail já cadastrado (com outras maiúsculas) responde 409 e não cria conta nem sessão', async () => {
    await doSignup('maria@exemplo.com');
    const res = await doSignup('MARIA@exemplo.com', 'outraSenha1');
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: { code: 'conflict', message: 'Este e-mail já tem conta.' } });
    expect(res.headers['set-cookie']).toBeUndefined();
    await expectNoSecrets(res, 'outraSenha1');
    expect(await testDb.sql`select 1 from users`).toHaveLength(1);
  });

  it.each([
    ['senha curta', 'maria@exemplo.com', '1234567'],
    ['e-mail inválido', 'maria@', PASSWORD],
  ])('%s responde 400', async (_name, email, password) => {
    const res = await doSignup(email, password);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'validation' } });
    expect(await testDb.sql`select 1 from users`).toHaveLength(0);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => doSignup('maria@exemplo.com'));

  it('credenciais corretas iniciam sessão', async () => {
    const res = await doLogin(' Maria@exemplo.com');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ user: { id: expect.any(String), email: 'maria@exemplo.com' } });
    await expectNoSecrets(res);
    expect(((await whoAmI(cookieFrom(res))).body as { user: unknown }).user).toEqual((res.body as { user: unknown }).user);
  });

  it('senha errada e e-mail sem conta respondem exatamente igual, sem sessão', async () => {
    const wrong = await doLogin('maria@exemplo.com', 'senhaErrada1');
    const missing = await doLogin('ninguem@exemplo.com', 'senhaErrada1');
    for (const res of [wrong, missing]) {
      expect(res.statusCode).toBe(401);
      expect(res.headers['set-cookie']).toBeUndefined();
      await expectNoSecrets(res, 'senhaErrada1');
    }
    expect(wrong.body).toEqual({ error: { code: 'unauthorized', message: 'E-mail ou senha inválidos.' } });
    expect(missing.body).toEqual(wrong.body);
  });
});

describe('POST /api/auth/logout e GET /api/auth/me', () => {
  it('me sem sessão responde 200 com user null', async () => {
    const res = await whoAmI();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it('logout apaga a sessão no servidor: o cookie antigo vira visitante', async () => {
    const cookie = cookieFrom(await doSignup('maria@exemplo.com'));
    const res = await call(logout, { method: 'POST', cookie });
    expect(res.statusCode).toBe(204);
    expect(res.headers['set-cookie']).toMatch(/^sid=; .*Max-Age=0/);
    expect(await testDb.sql`select 1 from sessions`).toHaveLength(0);
    expect((await whoAmI(cookie)).body).toEqual({ user: null });
  });

  it('logout sem sessão responde 204', async () => {
    expect((await call(logout, { method: 'POST' })).statusCode).toBe(204);
  });

  it('logout de uma sessão não derruba as outras da mesma conta', async () => {
    const a = cookieFrom(await doSignup('maria@exemplo.com'));
    const b = cookieFrom(await doLogin('maria@exemplo.com'));
    await call(logout, { method: 'POST', cookie: a });
    expect((await whoAmI(b)).body).toMatchObject({ user: { email: 'maria@exemplo.com' } });
  });
});
