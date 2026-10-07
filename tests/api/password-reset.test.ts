// Recuperação de senha contra um Postgres real (PGlite), com o envio de e-mail simulado.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashToken } from '../../api/_lib/auth.js';
import { getSql } from '../../api/_lib/db.js';
import { sendPasswordResetEmail } from '../../api/_lib/mailer.js';
import login from '../../api/auth/login.js';
import me from '../../api/auth/me.js';
import requestReset from '../../api/auth/password-reset/index.js';
import confirmReset from '../../api/auth/password-reset/confirm.js';
import signup from '../../api/auth/signup.js';
import { call, cookieFrom } from '../helpers.js';
import { createTestDb } from '../pgdb.js';

vi.mock('../../api/_lib/db.js', () => ({ getSql: vi.fn() }));
vi.mock('../../api/_lib/mailer.js', () => ({ sendPasswordResetEmail: vi.fn() }));

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let sessionCookie: string;

beforeAll(async () => {
  testDb = await createTestDb();
  vi.mocked(getSql).mockReturnValue(testDb.sql as unknown as ReturnType<typeof getSql>);
});
afterAll(() => testDb.db.close());
beforeEach(async () => {
  await testDb.reset();
  vi.mocked(sendPasswordResetEmail).mockReset().mockResolvedValue();
  vi.stubEnv('APP_URL', 'https://playlists.exemplo.com/');
  const res = await call(signup, { method: 'POST', body: { email: 'maria@exemplo.com', password: 'segredo123' } });
  sessionCookie = cookieFrom(res);
});

const ask = (email: string) => call(requestReset, { method: 'POST', body: { email } });
const confirm = (token: string, password = 'novaSenha99') =>
  call(confirmReset, { method: 'POST', body: { token, password } });
const loginWith = (password: string) =>
  call(login, { method: 'POST', body: { email: 'maria@exemplo.com', password } });

/** Pede a redefinição e devolve o token do link "enviado". */
async function requestToken() {
  await ask('maria@exemplo.com');
  const link = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)![1];
  return new URL(link).hash.slice(1);
}

describe('POST /api/auth/password-reset', () => {
  it('resposta neutra idêntica com e sem conta; só envia e-mail para quem tem conta', async () => {
    const withAccount = await ask(' Maria@Exemplo.com');
    const without = await ask('ninguem@exemplo.com');
    expect(withAccount.statusCode).toBe(202);
    expect(without.statusCode).toBe(202);
    expect(without.body).toEqual(withAccount.body);
    expect(withAccount.body).toEqual({ message: 'Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha.' });
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(await testDb.sql`select 1 from password_resets`).toHaveLength(1);
  });

  it('link com o token no fragmento; o banco guarda só o hash, válido por 1 hora', async () => {
    await ask('maria@exemplo.com');
    const [to, link] = vi.mocked(sendPasswordResetEmail).mock.calls[0];
    expect(to).toBe('maria@exemplo.com');
    expect(link).toMatch(/^https:\/\/playlists\.exemplo\.com\/redefinir-senha#[A-Za-z0-9_-]{43}$/);
    const token = new URL(link).hash.slice(1);
    const [row] = (await testDb.sql`
      select token_hash, round(extract(epoch from expires_at - now()) / 60)::int as minutes from password_resets
    `) as { token_hash: string; minutes: number }[];
    expect(row.token_hash).toBe(hashToken(token));
    expect(row.minutes).toBe(60);
  });

  it('falha no envio não muda a resposta', async () => {
    vi.mocked(sendPasswordResetEmail).mockRejectedValue(new Error('SMTP fora do ar'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await ask('maria@exemplo.com');
    expect(res.statusCode).toBe(202);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('POST /api/auth/password-reset/confirm', () => {
  it('troca a senha: a nova funciona e a antiga não', async () => {
    const res = await confirm(await requestToken());
    expect(res.statusCode).toBe(204);
    expect((await loginWith('novaSenha99')).statusCode).toBe(200);
    expect((await loginWith('segredo123')).statusCode).toBe(401);
  });

  it('apaga todas as sessões da conta', async () => {
    expect((await call(me, { method: 'GET', cookie: sessionCookie })).body).toMatchObject({ user: { email: 'maria@exemplo.com' } });
    await confirm(await requestToken());
    expect((await call(me, { method: 'GET', cookie: sessionCookie })).body).toEqual({ user: null });
    expect(await testDb.sql`select 1 from sessions`).toHaveLength(0);
  });

  it('token reutilizado é rejeitado e a senha não muda de novo', async () => {
    const token = await requestToken();
    await confirm(token);
    const again = await confirm(token, 'terceira999');
    expect(again.statusCode).toBe(400);
    expect(again.body).toEqual({ error: { code: 'validation', message: 'Link inválido ou expirado. Peça um novo.' } });
    expect((await loginWith('novaSenha99')).statusCode).toBe(200);
  });

  it('token expirado é rejeitado e a senha não muda', async () => {
    const token = await requestToken();
    await testDb.sql`update password_resets set expires_at = now() - interval '1 second'`;
    const res = await confirm(token);
    expect(res.statusCode).toBe(400);
    expect((await loginWith('segredo123')).statusCode).toBe(200);
    expect((await call(me, { method: 'GET', cookie: sessionCookie })).body).toMatchObject({ user: { email: 'maria@exemplo.com' } });
  });

  it('token inexistente ou malformado é rejeitado com a mesma mensagem', async () => {
    const a = await confirm('A'.repeat(43));
    const b = await confirm('../x');
    expect(a.statusCode).toBe(400);
    expect(b.body).toEqual(a.body);
  });

  it('nova senha passa pelas regras do cadastro', async () => {
    const token = await requestToken();
    const res = await confirm(token, '1234567');
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { message: 'A senha deve ter pelo menos 8 caracteres.' } });
    // o token continua valendo
    expect((await confirm(token)).statusCode).toBe(204);
  });
});
