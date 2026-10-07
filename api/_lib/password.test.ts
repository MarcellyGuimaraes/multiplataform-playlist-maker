import { describe, expect, it } from 'vitest';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password.js';

describe('hashPassword / verifyPassword', () => {
  it('verifica a senha correta e rejeita a errada', async () => {
    const hash = await hashPassword('segredo123');
    expect(await verifyPassword('segredo123', hash)).toBe(true);
    expect(await verifyPassword('segredo124', hash)).toBe(false);
  });

  it('gera hashes diferentes para a mesma senha, sem conter a senha', async () => {
    const a = await hashPassword('segredo123');
    const b = await hashPassword('segredo123');
    expect(a).not.toBe(b);
    expect(a).not.toContain('segredo123');
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it('rejeita hash em formato desconhecido', async () => {
    expect(await verifyPassword('x', 'md5$abc')).toBe(false);
  });

  it('o hash fixo nunca aceita senha', async () => {
    expect(await verifyAgainstDummy('qualquer')).toBe(false);
  });
});
