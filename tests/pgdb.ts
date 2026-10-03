// Postgres real em memória (PGlite) com a migração do projeto aplicada, para testar o SQL dos handlers.
import { openPglite } from '../scripts/pglite.js';

export async function createTestDb() {
  const { db, sql } = await openPglite();
  const reset = () => db.exec('truncate tracks, playlists cascade');
  return { db, sql, reset };
}
