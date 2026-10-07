import { visibilitySchema } from '../../../shared/schemas.js';
import { requireUser } from '../../_lib/auth.js';
import { getSql } from '../../_lib/db.js';
import { isUuid, newShareToken, notFound, param, parseBody, route } from '../../_lib/http.js';
import { toPlaylist, type PlaylistRow } from '../../_lib/rows.js';

/**
 * Alterna entre pública e privada numa única escrita. Privada → pública sempre gera token novo;
 * pública → privada apaga o token (o link antigo passa a responder 404); tornar pública uma playlist
 * que já é pública mantém o token. Nome e faixas não mudam.
 */
export default route({
  async PUT(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;
    const id = param(req, 'id');
    if (!isUuid(id)) return notFound(res, 'Playlist não encontrada.');
    const body = parseBody(req, res, visibilitySchema);
    if (!body) return;
    const sql = getSql();
    const [row] = (await sql`
      update playlists set
        visibility  = ${body.visibility},
        share_token = case when ${body.visibility}::text = 'public'
                           then (case when visibility = 'public' then share_token else ${newShareToken()} end)
                           else null end,
        updated_at  = now()
      where id = ${id} and owner_id = ${user.id}
      returning id, name, visibility, share_token, created_at, updated_at
    `) as PlaylistRow[];
    if (!row) return notFound(res, 'Playlist não encontrada.');
    const { tracks: _tracks, ...rest } = toPlaylist(row, []);
    return res.status(200).json(rest);
  },
});
