// Hash de senha com scrypt (node:crypto). Formato guardado: scrypt$N$r$p$<salt b64>$<hash b64>.
// Os parâmetros ficam na string para permitir aumentar o custo no futuro sem invalidar hashes antigos.
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

/**
 * Hash de uma senha aleatória descartada. Usado quando o e-mail não tem conta, para que o login
 * gaste o mesmo tempo de um scrypt real e a latência não revele se a conta existe.
 */
const DUMMY_HASH =
  'scrypt$16384$8$1$bTm49jRLik9dZ/vW4ozLQg==$6/GuxRvS6lHSi87WegwYjtp6T/N5Fjsu9hd34MIk4soWhfJBfgYGFapfvdJ8iYN12HlI3E24mtQzpbjEiBSb0A==';

function derive(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, keyB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await derive(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(key, expected);
}

/** Gasta o tempo de uma verificação real e sempre falha. */
export async function verifyAgainstDummy(password: string): Promise<false> {
  await verifyPassword(password, DUMMY_HASH);
  return false;
}
