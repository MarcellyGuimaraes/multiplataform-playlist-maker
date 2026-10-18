import { playlistNameSchema } from '../../../../shared/schemas.js';
import { requireUser } from '../../../_lib/auth.js';
import { getSql } from '../../../_lib/db.js';
import { isUuid, notFound, param, parseBody, route } from '../../../_lib/http.js';
import { toPlaylist, type PlaylistRow, type TrackRow } from '../../../_lib/rows.js';

const PLAYLIST_NOT_FOUND = 'Playlist não encontrada.';

// Só a dona acessa pelo id: toda consulta filtra owner_id, então a playlist de outra conta
// responde o mesmo 404 de uma inexistente, seja ela pública ou privada.
export default route({
  async GET(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;
    const id = param(req, 'id');
    if (!isUuid(id)) return notFound(res, PLAYLIST_NOT_FOUND);
    const sql = getSql();
    const [playlist] = (await sql`
      select id, name, visibility, share_token, created_at, updated_at
      from playlists where id = ${id} and owner_id = ${user.id}
    `) as PlaylistRow[];
    if (!playlist) return notFound(res, PLAYLIST_NOT_FOUND);
    const tracks = (await sql`
      select * from tracks where playlist_id = ${id} order by position, created_at
    `) as TrackRow[];
    return res.status(200).json(toPlaylist(playlist, tracks));
  },

  async PATCH(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;
    const id = param(req, 'id');
    if (!isUuid(id)) return notFound(res, PLAYLIST_NOT_FOUND);
    const body = parseBody(req, res, playlistNameSchema);
    if (!body) return;
    const sql = getSql();
    const [playlist] = (await sql`
      update playlists set name = ${body.name}, updated_at = now()
      where id = ${id} and owner_id = ${user.id}
      returning id, name, visibility, share_token, created_at, updated_at
    `) as PlaylistRow[];
    if (!playlist) return notFound(res, PLAYLIST_NOT_FOUND);
    const { tracks: _tracks, ...rest } = toPlaylist(playlist, []);
    return res.status(200).json(rest);
  },

  async DELETE(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;
    const id = param(req, 'id');
    if (!isUuid(id)) return notFound(res, PLAYLIST_NOT_FOUND);
    const sql = getSql();
    // As faixas saem junto (on delete cascade) e o token de compartilhamento deixa de existir.
    const deleted = await sql`delete from playlists where id = ${id} and owner_id = ${user.id} returning id`;
    if (deleted.length === 0) return notFound(res, PLAYLIST_NOT_FOUND);
    return res.status(204).end();
  },
});
