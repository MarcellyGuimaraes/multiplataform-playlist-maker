import { getSql } from '../_lib/db.js';
import { notFound, param, route } from '../_lib/http.js';
import { toSharedTrack, type TrackRow } from '../_lib/rows.js';
import type { SharedPlaylist } from '../../shared/types.js';

const SHARE_TOKEN = /^[A-Za-z0-9_-]{22}$/;
const NOT_FOUND = 'Playlist não encontrada.';

/**
 * Leitura pública por token. A resposta não inclui o id interno da playlist nem ids de faixas,
 * então não serve para chamar nenhuma rota de escrita.
 */
export default route({
  async GET(req, res) {
    const token = param(req, 'token');
    if (!token || !SHARE_TOKEN.test(token)) return notFound(res, NOT_FOUND);
    const sql = getSql();
    const [playlist] = (await sql`select id, name from playlists where share_token = ${token}`) as {
      id: string;
      name: string;
    }[];
    if (!playlist) return notFound(res, NOT_FOUND);
    const tracks = (await sql`
      select * from tracks where playlist_id = ${playlist.id} order by position, created_at
    `) as TrackRow[];
    const body: SharedPlaylist = { name: playlist.name, tracks: tracks.map(toSharedTrack) };
    return res.status(200).json(body);
  },
});
