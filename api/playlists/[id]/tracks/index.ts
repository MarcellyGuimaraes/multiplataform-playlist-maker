import { parseTrackUrl } from '../../../../shared/parseTrackUrl.js';
import { addTrackSchema } from '../../../../shared/schemas.js';
import { getSql } from '../../../_lib/db.js';
import { badRequest, isUuid, notFound, param, parseBody, route } from '../../../_lib/http.js';
import { fetchMetadata } from '../../../_lib/oembed.js';
import { resolveShortLink } from '../../../_lib/resolveShortLink.js';
import { toTrack, type TrackRow } from '../../../_lib/rows.js';

/** Adiciona uma faixa ao final da playlist a partir de um link colado. Só referências são gravadas. */
export default route({
  async POST(req, res) {
    const id = param(req, 'id');
    if (!isUuid(id)) return notFound(res, 'Playlist não encontrada.');
    const body = parseBody(req, res, addTrackSchema);
    if (!body) return;

    const first = parseTrackUrl(body.url);
    const parsed = first.kind === 'short-link' ? await resolveShortLink(first.url) : first;
    if (parsed.kind === 'error') return badRequest(res, parsed.message);

    const meta = await fetchMetadata(parsed);
    const sql = getSql();
    const [row] = (await sql`
      with p as (select id from playlists where id = ${id}),
      ins as (
        insert into tracks (
          playlist_id, original_url, canonical_url, platform, external_id, label, position,
          meta_title, meta_artist, meta_thumbnail_url
        )
        select
          p.id, ${body.url}, ${parsed.canonicalUrl}, ${parsed.platform}, ${parsed.externalId}, ${body.label},
          coalesce((select max(position) + 1 from tracks where playlist_id = p.id), 0),
          ${meta.title}, ${meta.artist}, ${meta.thumbnailUrl}
        from p
        returning *
      ),
      touch as (update playlists set updated_at = now() where id in (select playlist_id from ins))
      select * from ins
    `) as TrackRow[];
    if (!row) return notFound(res, 'Playlist não encontrada.');
    return res.status(201).json(toTrack(row));
  },
});
