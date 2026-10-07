// Postgres real em memória (PGlite) com as migrações do projeto aplicadas, para testar o SQL dos handlers.
import signup from '../api/auth/signup.js';
import { openPglite } from '../scripts/pglite.js';
import { call, cookieFrom } from './helpers.js';

export async function createTestDb() {
  const { db, sql } = await openPglite();
  const reset = () => db.exec('truncate users, tracks, playlists cascade');
  return { db, sql, reset };
}

/** Cadastra uma conta pela rota real (exige getSql apontando para o PGlite) e devolve o cookie de sessão. */
export async function signupAs(email: string, password = 'segredo123') {
  const res = await call(signup, { method: 'POST', body: { email, password } });
  if (res.statusCode !== 201) throw new Error(`Cadastro falhou: ${JSON.stringify(res.body)}`);
  return cookieFrom(res);
}
