import { destroySession } from '../../_lib/auth.js';
import { route } from '../../_lib/http.js';

/** Invalida a sessão no servidor e expira o cookie. Sem sessão, responde igual. */
export default route({
  async POST(req, res) {
    await destroySession(req, res);
    return res.status(204).end();
  },
});
