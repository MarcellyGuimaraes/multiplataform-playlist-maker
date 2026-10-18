import { passwordResetConfirmSchema } from '../../../../shared/schemas.js';
import { hashToken } from '../../../_lib/auth.js';
import { getSql } from '../../../_lib/db.js';
import { badRequest, parseBody, route } from '../../../_lib/http.js';
import { hashPassword } from '../../../_lib/password.js';

const INVALID_LINK = 'Link inválido ou expirado. Peça um novo.';
const RESET_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Define a nova senha com um token válido. Marcar o token como usado, trocar a senha e apagar todas as
 * sessões da conta acontecem num único comando (atômico no Postgres): ou tudo muda, ou nada muda.
 * A condição `used_at is null` no update garante o uso único mesmo com duas confirmações simultâneas.
 */
export default route({
  async POST(req, res) {
    const body = parseBody(req, res, passwordResetConfirmSchema);
    if (!body) return;
    if (!RESET_TOKEN.test(body.token)) return badRequest(res, INVALID_LINK);
    const passwordHash = await hashPassword(body.password);
    const sql = getSql();
    const [result] = (await sql`
      with used as (
        update password_resets set used_at = now()
        where token_hash = ${hashToken(body.token)} and used_at is null and expires_at > now()
        returning user_id
      ),
      upd as (
        update users set password_hash = ${passwordHash}
        where id in (select user_id from used)
      ),
      del as (
        delete from sessions where user_id in (select user_id from used)
      )
      select count(*)::int as n from used
    `) as { n: number }[];
    if (!result || result.n === 0) return badRequest(res, INVALID_LINK);
    return res.status(204).end();
  },
});
