import { getSql } from '../../_lib/db.js';
import { isUuid, newShareToken, notFound, param, route } from '../../_lib/http.js';

/** Gera um novo token público; o anterior deixa de funcionar imediatamente. */
export default route({
  async POST(req, res) {
    const id = param(req, 'id');
    if (!isUuid(id)) return notFound(res, 'Playlist não encontrada.');
    const sql = getSql();
    const [row] = (await sql`
      update playlists set share_token = ${newShareToken()} where id = ${id} returning share_token
    `) as { share_token: string }[];
    if (!row) return notFound(res, 'Playlist não encontrada.');
    return res.status(200).json({ shareToken: row.share_token });
  },
});
