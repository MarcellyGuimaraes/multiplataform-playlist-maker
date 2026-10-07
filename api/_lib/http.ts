import { randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { z } from 'zod';
import type { ApiErrorBody, ApiErrorCode } from '../../shared/types.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

export function sendError(res: VercelResponse, status: number, code: ApiErrorCode, message: string) {
  const body: ApiErrorBody = { error: { code, message } };
  return res.status(status).json(body);
}

export const badRequest = (res: VercelResponse, message: string) => sendError(res, 400, 'validation', message);
export const unauthorized = (res: VercelResponse, message = 'Entre na sua conta para continuar.') =>
  sendError(res, 401, 'unauthorized', message);
export const notFound =(res: VercelResponse, message = 'Não encontrado.') => sendError(res, 404, 'not_found', message);
export const conflict = (res: VercelResponse, message: string) => sendError(res, 409, 'conflict', message);

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hasBody(req: VercelRequest): boolean {
  const length = Number(req.headers['content-length'] ?? 0);
  return length > 0 || req.headers['transfer-encoding'] !== undefined || (req.body !== undefined && req.body !== '');
}

const isJson = (req: VercelRequest) => /^application\/json\s*(;|$)/i.test(req.headers['content-type'] ?? '');

/**
 * Despacha por método HTTP e converte qualquer exceção em 500 genérico.
 * O detalhe do erro vai só para o log do servidor, nunca para a resposta.
 * Escritas com corpo precisam ser JSON: isso exige preflight CORS em requisições de outros sites
 * (reforço contra CSRF, além do cookie SameSite=Lax).
 */
export function route(methods: Partial<Record<string, Handler>>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const handler = methods[req.method ?? ''];
    if (!handler) {
      res.setHeader('Allow', Object.keys(methods).join(', '));
      return sendError(res, 405, 'method_not_allowed', 'Método não permitido.');
    }
    if (WRITE_METHODS.has(req.method ?? '') && hasBody(req) && !isJson(req)) {
      return sendError(res, 415, 'validation', 'Envie os dados em JSON.');
    }
    try {
      res.setHeader('Cache-Control', 'no-store');
      return await handler(req, res);
    } catch (err) {
      console.error(`[api] ${req.method} ${req.url}`, err);
      if (!res.headersSent) return sendError(res, 500, 'internal', 'Erro interno. Tente novamente.');
    }
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Lê um parâmetro de rota dinâmica (ex.: [id]) de req.query. */
export function param(req: VercelRequest, name: string): string | undefined {
  const v = req.query[name];
  return typeof v === 'string' ? v : undefined;
}

/** Valida o corpo com zod; em caso de erro responde 400 com a primeira mensagem e retorna null. */
export function parseBody<S extends z.ZodType>(req: VercelRequest, res: VercelResponse, schema: S): z.infer<S> | null {
  const result = schema.safeParse(req.body ?? {});
  if (result.success) return result.data;
  badRequest(res, result.error.issues[0]?.message ?? 'Dados inválidos.');
  return null;
}

/** Token público de compartilhamento: 128 bits aleatórios, base64url (22 caracteres). */
export const newShareToken = () => randomBytes(16).toString('base64url');
