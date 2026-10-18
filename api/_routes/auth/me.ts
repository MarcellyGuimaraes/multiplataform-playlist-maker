import type { AuthUser } from '../../../shared/types.js';
import { getSessionUser } from '../../_lib/auth.js';
import { route } from '../../_lib/http.js';

/** Quem está logada. Visitante recebe 200 com { user: null }, não 401, para a carga inicial do front. */
export default route({
  async GET(req, res) {
    const user = await getSessionUser(req);
    const body: { user: AuthUser | null } = { user: user && { id: user.id, email: user.email } };
    return res.status(200).json(body);
  },
});
