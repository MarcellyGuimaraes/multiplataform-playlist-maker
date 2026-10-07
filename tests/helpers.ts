// Utilitários de teste: req/res falsos no formato da Vercel e um cliente SQL falso com respostas enfileiradas.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export type FakeRes = VercelResponse & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
};

export function fakeRes(): FakeRes {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    headersSent: false,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      res.headersSent = true;
      return res;
    },
    send(body: unknown) {
      res.body = body;
      res.headersSent = true;
      return res;
    },
    end() {
      res.headersSent = true;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
  };
  return res as unknown as FakeRes;
}

export type FakeReqInit = {
  method: string;
  query?: Record<string, string>;
  body?: unknown;
  /** Cabeçalhos explícitos; sem eles, um corpo presente vai como application/json. */
  headers?: Record<string, string>;
  /** Valor do cabeçalho Cookie (ex.: `sid=...`). */
  cookie?: string;
};

export function fakeReq(init: FakeReqInit): VercelRequest {
  const headers: Record<string, string> = {
    ...(init.headers ?? (init.body === undefined ? {} : { 'content-type': 'application/json' })),
    ...(init.cookie === undefined ? {} : { cookie: init.cookie }),
  };
  return { method: init.method, url: '/api/test', query: init.query ?? {}, body: init.body, headers } as unknown as VercelRequest;
}

export type SqlCall = { text: string; values: unknown[] };

/** Cliente SQL falso: cada chamada consome a próxima resposta da fila e é registrada em `calls`. */
export function fakeSql(responses: unknown[][] = []) {
  const queue = [...responses];
  const calls: SqlCall[] = [];
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join('$?').replace(/\s+/g, ' ').trim(), values });
    if (queue.length === 0) throw new Error(`Consulta inesperada: ${strings.join('$?')}`);
    return Promise.resolve(queue.shift());
  };
  return Object.assign(sql, { calls, queue });
}

/** Par `nome=valor` do Set-Cookie de uma resposta, pronto para reenviar no cabeçalho Cookie. */
export function cookieFrom(res: FakeRes): string {
  const header = res.headers['set-cookie'];
  if (!header) throw new Error('A resposta não enviou Set-Cookie.');
  return header.split(';')[0];
}

export type TestUser ={ id: string; email: string };

export const MARIA: TestUser = { id: '11111111-1111-4111-8111-111111111111', email: 'maria@exemplo.com' };
export const ANA: TestUser = { id: '22222222-2222-4222-8222-222222222222', email: 'ana@exemplo.com' };

/** Cookie de sessão com formato válido; com o fakeSql, quem decide a conta é a resposta enfileirada. */
export const SESSION_COOKIE = `sid=${'s'.repeat(43)}`;

/**
 * fakeSql cuja primeira resposta é a consulta de sessão: `user` para uma usuária logada,
 * null para visitante (sessão inexistente). As demais respostas seguem na ordem.
 */
export function fakeSqlAs(user: TestUser | null, ...responses: unknown[][]) {
  return fakeSql([user ? [user] : [], ...responses]);
}

export async function call(
  handler: (req: VercelRequest, res: VercelResponse) => unknown,
  init: Parameters<typeof fakeReq>[0],
) {
  const res = fakeRes();
  await handler(fakeReq(init), res);
  return res;
}
