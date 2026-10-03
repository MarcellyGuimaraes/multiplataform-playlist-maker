import { playlistNameSchema } from '../../shared/schemas.js';
import { getSql } from '../_lib/db.js';
import { newShareToken, parseBody, route } from '../_lib/http.js';
import { toPlaylist, toSummary, type PlaylistRow, type PlaylistSummaryRow } from '../_lib/rows.js';

export default route({
  async GET(_req, res) {
    const sql = getSql();
    const rows = (await sql`
      select p.id, p.name, p.updated_at, count(t.id)::int as track_count
      from playlists p
      left join tracks t on t.playlist_id = p.id
      group by p.id
      order by p.updated_at desc
    `) as PlaylistSummaryRow[];
    return res.status(200).json(rows.map(toSummary));
  },

  async POST(req, res) {
    const body = parseBody(req, res, playlistNameSchema);
    if (!body) return;
    const sql = getSql();
    const [row] = (await sql`
      insert into playlists (name, share_token)
      values (${body.name}, ${newShareToken()})
      returning id, name, share_token, created_at, updated_at
    `) as PlaylistRow[];
    return res.status(201).json(toPlaylist(row, []));
  },
});
