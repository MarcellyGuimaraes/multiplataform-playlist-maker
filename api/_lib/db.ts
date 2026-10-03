import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export type Sql = NeonQueryFunction<false, false>;

let client: Sql | undefined;

/** Cliente SQL (driver HTTP do Neon). Só existe no servidor; a URL vem do ambiente da função. */
export function getSql(): Sql {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não configurada');
    client = neon(url);
  }
  return client;
}

/** Substitui o cliente (usado só pelo servidor de desenvolvimento local com PGlite). */
export function overrideSql(sql: Sql) {
  client = sql;
}
