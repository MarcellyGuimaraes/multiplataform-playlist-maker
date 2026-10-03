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

export function fakeReq(init: { method: string; query?: Record<string, string>; body?: unknown }): VercelRequest {
  return { method: init.method, url: '/api/test', query: init.query ?? {}, body: init.body } as unknown as VercelRequest;
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

export async function call(
  handler: (req: VercelRequest, res: VercelResponse) => unknown,
  init: Parameters<typeof fakeReq>[0],
) {
  const res = fakeRes();
  await handler(fakeReq(init), res);
  return res;
}
