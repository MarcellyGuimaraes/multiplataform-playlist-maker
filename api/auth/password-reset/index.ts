import { passwordResetRequestSchema } from '../../../shared/schemas.js';
import { hashToken, newSecretToken } from '../../_lib/auth.js';
import { getSql } from '../../_lib/db.js';
import { parseBody, route } from '../../_lib/http.js';
import { sendPasswordResetEmail } from '../../_lib/mailer.js';

export const RESET_REQUESTED = 'Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha.';

/** Endereço público do app para montar o link. Sem APP_URL, assume o dev local. */
const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');

/**
 * Pede a redefinição. A resposta é a mesma exista ou não a conta, e mesmo se o envio falhar.
 * O token vai no fragmento (#) do link: nunca chega ao servidor, aos logs nem ao Referer.
 */
export default route({
  async POST(req, res) {
    const body = parseBody(req, res, passwordResetRequestSchema);
    if (!body) return;
    const sql = getSql();
    const [user] = (await sql`select id, email from users where email = ${body.email}`) as { id: string; email: string }[];
    if (user) {
      const token = newSecretToken();
      await sql`
        insert into password_resets (token_hash, user_id, expires_at)
        values (${hashToken(token)}, ${user.id}, now() + interval '1 hour')
      `;
      try {
        await sendPasswordResetEmail(user.email, `${appUrl()}/redefinir-senha#${token}`);
      } catch (err) {
        console.error('[api] falha ao enviar e-mail de redefinição', err);
      }
    }
    return res.status(202).json({ message: RESET_REQUESTED });
  },
});
