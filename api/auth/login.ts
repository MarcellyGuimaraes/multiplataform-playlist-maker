import { loginSchema } from '../../shared/schemas.js';
import type { AuthUser } from '../../shared/types.js';
import { createSession } from '../_lib/auth.js';
import { getSql } from '../_lib/db.js';
import { parseBody, route, unauthorized } from '../_lib/http.js';
import { verifyAgainstDummy, verifyPassword } from '../_lib/password.js';

const INVALID = 'E-mail ou senha inválidos.';

/** Mesma mensagem (e o mesmo custo de scrypt) para e-mail sem conta e senha errada. */
export default route({
  async POST(req, res) {
    const body = parseBody(req, res, loginSchema);
    if (!body) return;
    const sql = getSql();
    const [row] = (await sql`
      select id, email, password_hash from users where email = ${body.email}
    `) as (AuthUser & { password_hash: string })[];
    const ok = row ? await verifyPassword(body.password, row.password_hash) : await verifyAgainstDummy(body.password);
    if (!row || !ok) return unauthorized(res, INVALID);
    // Limpeza oportunista das sessões vencidas, sem precisar de cron.
    await sql`delete from sessions where expires_at < now()`;
    await createSession(res, row.id);
    return res.status(200).json({ user: { id: row.id, email: row.email } satisfies AuthUser });
  },
});
