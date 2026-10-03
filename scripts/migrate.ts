// Aplica as migrações pendentes de db/migrations em ordem, registrando cada uma em schema_migrations.
// Uso: DATABASE_URL=... npm run db:migrate   (ou um arquivo .env na raiz)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida (exporte a variável ou crie um .env).');
  process.exit(1);
}

const dir = join(import.meta.dirname, '..', 'db', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const pool = new Pool({ connectionString: url });
const client = await pool.connect();

try {
  await client.query(
    'create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())',
  );
  const { rows } = await client.query<{ version: string }>('select version from schema_migrations');
  const applied = new Set(rows.map((r) => r.version));
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) console.log('Nenhuma migração pendente.');
  for (const file of pending) {
    await client.query('begin');
    try {
      await client.query(readFileSync(join(dir, file), 'utf8'));
      await client.query('insert into schema_migrations (version) values ($1)', [file]);
      await client.query('commit');
      console.log(`Aplicada: ${file}`);
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
  }
} finally {
  client.release();
  await pool.end();
}
