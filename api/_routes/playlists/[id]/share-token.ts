import { requireUser } from '../../../_lib/auth.js';
import { getSql } from '../../../_lib/db.js';
import { conflict, isUuid, newShareToken, notFound, param, route } from '../../../_lib/http.js';

/**
 * Gera um novo token público; o anterior deixa de funcionar imediatamente.
 * Só a dona, e só em playlist pública: privada responde 409 e continua sem token.
 */
export default route({
  async POST(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;
    const id = param(req, 'id');
    if (!isUuid(id)) return notFound(res, 'Playlist não encontrada.');
    const sql = getSql();
    const [row] = (await sql`
      update playlists set share_token = ${newShareToken()}
      where id = ${id} and owner_id = ${user.id} and visibility = 'public'
      returning share_token
    `) as { share_token: string }[];
    if (row) return res.status(200).json({ shareToken: row.share_token });
    // Nada mudou: distingue "privada da própria conta" (409) de "não existe ou é de outra conta" (404).
    const [own] = await sql`select 1 from playlists where id = ${id} and owner_id = ${user.id}`;
    if (own) return conflict(res, 'Torne a playlist pública para ter um link de compartilhamento.');
    return notFound(res, 'Playlist não encontrada.');
  },
});
