// Despacho de todas as rotas da API a partir de uma única função serverless (api/index.ts).
// O plano Hobby da Vercel aceita no máximo 12 funções por deploy, e cada arquivo em api/ seria uma.
// Os handlers ficam em api/_routes/ (pastas com "_" não viram função) e são escolhidos por esta tabela.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import login from '../_routes/auth/login.js';
import logout from '../_routes/auth/logout.js';
import me from '../_routes/auth/me.js';
import passwordResetConfirm from '../_routes/auth/password-reset/confirm.js';
import passwordReset from '../_routes/auth/password-reset/index.js';
import signup from '../_routes/auth/signup.js';
import playlistById from '../_routes/playlists/[id]/index.js';
import shareToken from '../_routes/playlists/[id]/share-token.js';
import trackById from '../_routes/playlists/[id]/tracks/[trackId].js';
import tracks from '../_routes/playlists/[id]/tracks/index.js';
import tracksOrder from '../_routes/playlists/[id]/tracks/order.js';
import visibility from '../_routes/playlists/[id]/visibility.js';
import playlists from '../_routes/playlists/index.js';
import shared from '../_routes/shared/[token].js';
import { notFound } from './http.js';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

// Caminhos relativos a /api. ":nome" vira parâmetro em req.query, como no roteamento por arquivos.
// Rotas fixas vêm antes das que têm parâmetro no mesmo ponto (tracks/order antes de tracks/:trackId).
const ROUTES: [string, Handler][] = [
  ['auth/signup', signup],
  ['auth/login', login],
  ['auth/logout', logout],
  ['auth/me', me],
  ['auth/password-reset', passwordReset],
  ['auth/password-reset/confirm', passwordResetConfirm],
  ['playlists', playlists],
  ['playlists/:id', playlistById],
  ['playlists/:id/share-token', shareToken],
  ['playlists/:id/visibility', visibility],
  ['playlists/:id/tracks', tracks],
  ['playlists/:id/tracks/order', tracksOrder],
  ['playlists/:id/tracks/:trackId', trackById],
  ['shared/:token', shared],
];

const COMPILED = ROUTES.map(([path, handler]) => ({ segments: path.split('/'), handler }));

/** Encontra o handler de um caminho relativo a /api (ex.: "playlists/abc/tracks") e seus parâmetros. */
export function matchApiRoute(path: string): { handler: Handler; params: Record<string, string> } | null {
  const parts = path.split('/').filter(Boolean);
  for (const { segments, handler } of COMPILED) {
    if (segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = segments.every((seg, i) => {
      if (!seg.startsWith(':')) return seg === parts[i];
      try {
        params[seg.slice(1)] = decodeURIComponent(parts[i]);
        return true;
      } catch {
        return false; // escape % malformado: trata como rota inexistente
      }
    });
    if (ok) return { handler, params };
  }
  return null;
}

/**
 * Caminho pedido, relativo a /api. Na Vercel, o rewrite do vercel.json manda /api/<caminho> para esta
 * função com ?path=<caminho>; no servidor de desenvolvimento e nos testes, ele vem na própria URL.
 */
function requestedPath(req: VercelRequest): string {
  const fromRewrite = req.query.path;
  if (typeof fromRewrite === 'string') return fromRewrite;
  if (Array.isArray(fromRewrite)) return fromRewrite.join('/');
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  return pathname.replace(/^\/api\/?/, '');
}

export async function dispatch(req: VercelRequest, res: VercelResponse) {
  const match = matchApiRoute(requestedPath(req));
  if (!match) return notFound(res, 'Rota não encontrada.');
  const { path: _path, ...query } = req.query;
  req.query = { ...query, ...match.params };
  return match.handler(req, res);
}
