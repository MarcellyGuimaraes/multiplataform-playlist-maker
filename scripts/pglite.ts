// Postgres real via PGlite (WASM), com as migrações do projeto aplicadas.
// Usado pelos testes (em memória) e pelo modo de desenvolvimento local sem Neon (persistido em disco).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

export async function openPglite(
  dataDir?: string,
  migrationsDir = join(import.meta.dirname, '..', 'db', 'migrations'),
) {
  const db = new PGlite(dataDir);
  await db.exec(
    'create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())',
  );
  const applied = new Set(
    (await db.query<{ version: string }>('select version from schema_migrations')).rows.map((r) => r.version),
  );
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(readFileSync(join(migrationsDir, file), 'utf8'));
      await tx.query('insert into schema_migrations (version) values ($1)', [file]);
    });
  }

  /** Tagged template no mesmo formato do `sql` do driver do Neon (retorna as linhas). */
  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce((acc, part, i) => acc + `$${i}` + part);
    return (await db.query(text, values)).rows as Record<string, unknown>[];
  };

  return { db, sql };
}
