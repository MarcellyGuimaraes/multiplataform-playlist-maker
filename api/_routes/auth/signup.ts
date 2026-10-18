import { signupSchema } from '../../../shared/schemas.js';
import type { AuthUser } from '../../../shared/types.js';
import { createSession } from '../../_lib/auth.js';
import { getSql } from '../../_lib/db.js';
import { conflict, parseBody, route } from '../../_lib/http.js';
import { hashPassword } from '../../_lib/password.js';

/** Cria a conta e já inicia a sessão. E-mail repetido responde 409 (troca consciente, ver design). */
export default route({
  async POST(req, res) {
    const body = parseBody(req, res, signupSchema);
    if (!body) return;
    const passwordHash = await hashPassword(body.password);
    const sql = getSql();
    const [user] = (await sql`
      insert into users (email, password_hash) values (${body.email}, ${passwordHash})
      on conflict (email) do nothing
      returning id, email
    `) as AuthUser[];
    if (!user) return conflict(res, 'Este e-mail já tem conta.');
    await createSession(res, user.id);
    return res.status(201).json({ user: { id: user.id, email: user.email } satisfies AuthUser });
  },
});
