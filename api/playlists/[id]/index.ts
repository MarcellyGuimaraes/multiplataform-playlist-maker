import { playlistNameSchema } from '../../../shared/schemas.js';
import { getSql } from '../../_lib/db.js';
import { isUuid, notFound, param, parseBody, route } from '../../_lib/http.js';
import { toPlaylist, type PlaylistRow, type TrackRow } from '../../_lib/rows.js';

const PLAYLIST_NOT_FOUND = 'Playlist não encontrada.';

export default route({
  async GET(req, res) {
    const id = param(req, 'id');
    if (!isUuid(id)) return notFound(res, PLAYLIST_NOT_FOUND);
    const sql = getSql();
    const [playlist] = (await sql`
      select id, name, share_token, created_at, updated_at from playlists where id = ${id}
    `) as PlaylistRow[];
    if (!playlist) return notFound(res, PLAYLIST_NOT_FOUND);
    const tracks = (await sql`
      select * from tracks where playlist_id = ${id} order by position, created_at
    `) as TrackRow[];
    return res.status(200).json(toPlaylist(playlist, tracks));
  },

  async PATCH(req, res) {
    const id = param(req, 'id');
    if (!isUuid(id)) return notFound(res, PLAYLIST_NOT_FOUND);
    const body = parseBody(req, res, playlistNameSchema);
    if (!body) return;
    const sql = getSql();
    const [playlist] = (await sql`
      update playlists set name = ${body.name}, updated_at = now()
      where id = ${id}
      returning id, name, share_token, created_at, updated_at
    `) as PlaylistRow[];
    if (!playlist) return notFound(res, PLAYLIST_NOT_FOUND);
    const { tracks: _tracks, ...rest } = toPlaylist(playlist, []);
    return res.status(200).json(rest);
  },

  async DELETE(req, res) {
    const id = param(req, 'id');
    if (!isUuid(id)) return notFound(res, PLAYLIST_NOT_FOUND);
    const sql = getSql();
    // As faixas saem junto (on delete cascade) e o token de compartilhamento deixa de existir.
    const deleted = await sql`delete from playlists where id = ${id} returning id`;
    if (deleted.length === 0) return notFound(res, PLAYLIST_NOT_FOUND);
    return res.status(204).end();
  },
});
