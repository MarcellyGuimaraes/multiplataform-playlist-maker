// Sessão opaca guardada no banco. O cookie `sid` leva 32 bytes aleatórios (base64url);
// o banco guarda só o sha256 desse valor, então um vazamento da tabela não gera cookies válidos.
// O cookie é lido do cabeçalho (não de req.cookies) para o dev, a Vercel e os testes se comportarem igual.
import { createHash, randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSql } from './db.js';
import { unauthorized } from './http.js';

export type SessionUser = { id: string; email: string };

export const SESSION_COOKIE = 'sid';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 dias, sem renovação automática
const SESSION_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** sha256 em base64url: usado para tokens de sessão e de redefinição de senha. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('base64url');

/** Token aleatório de 256 bits em base64url (43 caracteres). */
export const newSecretToken = () => randomBytes(32).toString('base64url');

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in cookies) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  }
  return cookies;
}

const isSecure = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

export function sessionCookie(value: string, maxAge: number): string {
  const attrs = [`${SESSION_COOKIE}=${value}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${maxAge}`];
  if (isSecure()) attrs.push('Secure');
  return attrs.join('; ');
}

function readSessionToken(req: VercelRequest): string | null {
  const token = parseCookies(req.headers?.cookie)[SESSION_COOKIE];
  return token && SESSION_TOKEN.test(token) ? token : null;
}

/** Cria a sessão no banco e envia o cookie. */
export async function createSession(res: VercelResponse, userId: string) {
  const token = newSecretToken();
  const sql = getSql();
  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${hashToken(token)}, ${userId}, now() + interval '30 days')
  `;
  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_MAX_AGE));
}

/** Conta da sessão atual, ou null para visitante (sem cookie, cookie adulterado ou sessão expirada). */
export async function getSessionUser(req: VercelRequest): Promise<SessionUser | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  const sql = getSql();
  const [user] = (await sql`
    select u.id, u.email
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()
  `) as SessionUser[];
  return user ?? null;
}

/** Como getSessionUser, mas responde 401 e retorna null quando não há sessão válida. */
export async function requireUser(req: VercelRequest, res: VercelResponse): Promise<SessionUser | null> {
  const user = await getSessionUser(req);
  if (!user) unauthorized(res);
  return user;
}

/** Apaga a sessão no servidor (não só no navegador) e expira o cookie. */
export async function destroySession(req: VercelRequest, res: VercelResponse) {
  const token = readSessionToken(req);
  if (token) {
    const sql = getSql();
    await sql`delete from sessions where token_hash = ${hashToken(token)}`;
  }
  res.setHeader('Set-Cookie', sessionCookie('', 0));
}
