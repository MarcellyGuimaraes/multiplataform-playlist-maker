// Plugin de desenvolvimento: serve a API dentro do `vite dev` pela mesma função única do deploy
// (api/index.ts, que despacha as rotas). Sem DATABASE_URL usa um Postgres local (PGlite em .dev-db/);
// com ela, usa o Neon.
// Só roda no servidor de desenvolvimento — não entra no build nem no deploy.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { loadEnv, type Plugin } from 'vite';

/** Marca que a DATABASE_URL em process.env foi copiada do .env por este plugin. */
const FROM_ENV_FILE = '__DEV_API_DATABASE_URL_FROM_ENV_FILE';

/** Usuário e host da connection string, sem a senha — para o log mostrar qual banco está em uso. */
export function describeDbUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${decodeURIComponent(u.username)}@${u.hostname}${u.pathname}`;
  } catch {
    return 'DATABASE_URL inválida';
  }
}

export function devApi(): Plugin {
  return {
    name: 'dev-api',
    // O Vitest também sobe um servidor Vite; lá a API não é necessária.
    apply: (_config, { command }) => command === 'serve' && !process.env.VITEST,
    async configureServer(server) {
      const root = server.config.root;
      // O loadEnv do Vite dá prioridade ao que já está em process.env. Se o valor atual foi posto por
      // este plugin (lido do .env num início anterior do mesmo processo), descarta-o para que uma edição
      // do .env passe a valer quando o Vite reinicia — senão o valor antigo ficaria preso até matar o processo.
      if (process.env[FROM_ENV_FILE]) {
        delete process.env.DATABASE_URL;
        delete process.env[FROM_ENV_FILE];
      }
      const env = loadEnv(server.config.mode, root, '');
      if (env.DATABASE_URL && !process.env.DATABASE_URL) {
        process.env.DATABASE_URL = env.DATABASE_URL;
        process.env[FROM_ENV_FILE] = '1';
      }

      let localSql: unknown;
      if (!process.env.DATABASE_URL) {
        const { openPglite } = await import('./pglite.js');
        localSql = (await openPglite(join(root, '.dev-db'), join(root, 'db', 'migrations'))).sql;
        server.config.logger.info('  [dev-api] Banco: PGlite local em .dev-db/ (sem DATABASE_URL)');
      } else {
        server.config.logger.info(`  [dev-api] Banco: Neon — ${describeDbUrl(process.env.DATABASE_URL)}`);
      }

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        try {
          if (localSql) {
            const db = await server.ssrLoadModule('/api/_lib/db.ts');
            db.overrideSql(localSql);
          }
          const mod = await server.ssrLoadModule('/api/index.ts');
          const query = Object.fromEntries(url.searchParams);
          let body: unknown;
          try {
            body = await readJsonBody(req);
          } catch {
            return sendJson(res, 400, { error: { code: 'validation', message: 'JSON inválido.' } });
          }
          await mod.default(Object.assign(req, { query, body, cookies: {} }), vercelResponse(res));
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          next(err);
        }
      });
    },
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (!(req.headers['content-type'] ?? '').includes('application/json')) return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : undefined;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function vercelResponse(res: ServerResponse) {
  const vres = Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return vres;
    },
    json(body: unknown) {
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
      return vres;
    },
    send(body: unknown) {
      res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
      return vres;
    },
  });
  return vres;
}

