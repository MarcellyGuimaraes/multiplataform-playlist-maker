import { playlistNameSchema } from '../../../shared/schemas.js';
import type { PlaylistList } from '../../../shared/types.js';
import { getSessionUser, requireUser } from '../../_lib/auth.js';
import { getSql } from '../../_lib/db.js';
import { parseBody, route } from '../../_lib/http.js';
import {
  toPlaylist,
  toPublicSummary,
  toSummary,
  type PlaylistRow,
  type PlaylistSummaryRow,
  type PublicPlaylistSummaryRow,
} from '../../_lib/rows.js';

/** Quantas públicas de outras contas a listagem retorna (as mais recentes). */
const PUBLIC_LIMIT = 50;

export default route({
  async GET(req, res) {
    const user = await getSessionUser(req);
    const sql = getSql();
    const mine = user
      ? ((await sql`
          select p.id, p.name, p.updated_at, p.visibility, p.share_token, count(t.id)::int as track_count
          from playlists p
          left join tracks t on t.playlist_id = p.id
          where p.owner_id = ${user.id}
          group by p.id
          order by p.updated_at desc
        `) as PlaylistSummaryRow[])
      : [];
    // Públicas das outras contas: a consulta não seleciona id nem dona.
    const pub = (await sql`
      select p.name, p.updated_at, p.share_token, count(t.id)::int as track_count
      from playlists p
      left join tracks t on t.playlist_id = p.id
      where p.visibility = 'public' and p.owner_id is distinct from ${user?.id ?? null}::uuid
      group by p.id
      order by p.updated_at desc
      limit ${PUBLIC_LIMIT}
    `) as PublicPlaylistSummaryRow[];
    const body: PlaylistList = { mine: mine.map(toSummary), public: pub.map(toPublicSummary) };
    return res.status(200).json(body);
  },

  async POST(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;
    const body = parseBody(req, res, playlistNameSchema);
    if (!body) return;
    const sql = getSql();
    // Nasce privada e sem token de compartilhamento (padrões da tabela).
    const [row] = (await sql`
      insert into playlists (owner_id, name)
      values (${user.id}, ${body.name})
      returning id, name, visibility, share_token, created_at, updated_at
    `) as PlaylistRow[];
    return res.status(201).json(toPlaylist(row, []));
  },
});
