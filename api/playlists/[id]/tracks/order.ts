import { reorderSchema } from '../../../../shared/schemas.js';
import { getSql } from '../../../_lib/db.js';
import { conflict, isUuid, notFound, param, parseBody, route } from '../../../_lib/http.js';

/**
 * Reordena as faixas. O corpo deve conter exatamente o conjunto atual de faixas da playlist;
 * caso contrário responde 409 e nada muda. Validação e escrita acontecem num único comando atômico.
 */
export default route({
  async PUT(req, res) {
    const id = param(req, 'id');
    if (!isUuid(id)) return notFound(res, 'Playlist não encontrada.');
    const body = parseBody(req, res, reorderSchema);
    if (!body) return;
    const sql = getSql();
    const [result] = (await sql`
      with input as (
        select t.id, (t.ord - 1)::int as pos
        from unnest(${body.trackIds}::uuid[]) with ordinality as t(id, ord)
      ),
      cur as (select id from tracks where playlist_id = ${id}),
      ok as (
        select
          (select count(*) from input) = (select count(*) from cur)
          and (select count(distinct id) from input) = (select count(*) from input)
          and not exists (select 1 from input where id not in (select id from cur))
          as valid
      ),
      upd as (
        update tracks t set position = input.pos, updated_at = now()
        from input, ok
        where ok.valid and t.id = input.id and t.playlist_id = ${id}
      ),
      touch as (
        update playlists set updated_at = now()
        where id = ${id} and (select valid from ok)
      )
      select
        exists (select 1 from playlists where id = ${id}) as found,
        (select valid from ok) as valid
    `) as { found: boolean; valid: boolean }[];
    if (!result?.found) return notFound(res, 'Playlist não encontrada.');
    if (!result.valid) {
      return conflict(res, 'A lista enviada não corresponde às faixas atuais da playlist. Recarregue e tente de novo.');
    }
    return res.status(204).end();
  },
});
