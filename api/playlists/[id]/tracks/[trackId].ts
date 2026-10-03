import { updateTrackSchema } from '../../../../shared/schemas.js';
import { getSql } from '../../../_lib/db.js';
import { isUuid, notFound, param, parseBody, route } from '../../../_lib/http.js';
import { toTrack, type TrackRow } from '../../../_lib/rows.js';

const TRACK_NOT_FOUND = 'Faixa não encontrada.';

// Toda operação filtra por playlist_id E id: uma faixa de outra playlist responde "não encontrado".
export default route({
  async PATCH(req, res) {
    const id = param(req, 'id');
    const trackId = param(req, 'trackId');
    if (!isUuid(id) || !isUuid(trackId)) return notFound(res, TRACK_NOT_FOUND);
    const body = parseBody(req, res, updateTrackSchema);
    if (!body) return;
    const sql = getSql();
    const [row] = (await sql`
      with upd as (
        update tracks set label = ${body.label}, updated_at = now()
        where id = ${trackId} and playlist_id = ${id}
        returning *
      ),
      touch as (update playlists set updated_at = now() where id in (select playlist_id from upd))
      select * from upd
    `) as TrackRow[];
    if (!row) return notFound(res, TRACK_NOT_FOUND);
    return res.status(200).json(toTrack(row));
  },

  async DELETE(req, res) {
    const id = param(req, 'id');
    const trackId = param(req, 'trackId');
    if (!isUuid(id) || !isUuid(trackId)) return notFound(res, TRACK_NOT_FOUND);
    const sql = getSql();
    // Remove e recompacta as posições (0..n-1) das restantes num único comando atômico.
    // As CTEs enxergam o estado anterior ao delete, por isso a faixa removida é excluída de "ranked".
    const [result] = (await sql`
      with del as (
        delete from tracks where id = ${trackId} and playlist_id = ${id} returning id
      ),
      ranked as (
        select id, (row_number() over (order by position, created_at) - 1)::int as pos
        from tracks
        where playlist_id = ${id} and id not in (select id from del)
      ),
      compact as (
        update tracks t set position = ranked.pos
        from ranked
        where t.id = ranked.id and t.position <> ranked.pos and exists (select 1 from del)
      ),
      touch as (update playlists set updated_at = now() where id = ${id} and exists (select 1 from del))
      select count(*)::int as deleted from del
    `) as { deleted: number }[];
    if (!result || result.deleted === 0) return notFound(res, TRACK_NOT_FOUND);
    return res.status(204).end();
  },
});
