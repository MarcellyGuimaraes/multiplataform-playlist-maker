// Resolve links curtos on.soundcloud.com seguindo apenas os cabeçalhos de redirecionamento.
// Nenhum corpo de resposta é lido e nenhuma mídia é baixada.
import { PARSE_ERRORS, parseTrackUrl, type ParsedTrack, type ParseError } from '../../shared/parseTrackUrl.js';

export const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 4000;

export async function resolveShortLink(
  shortUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedTrack | ParseError> {
  let current = shortUrl;
  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    let location: string | null;
    try {
      location = await nextLocation(current, fetchImpl);
    } catch {
      return { kind: 'error', message: PARSE_ERRORS.invalidId };
    }
    if (!location) break;
    current = new URL(location, current).toString();
    const parsed = parseTrackUrl(current);
    if (parsed.kind === 'track' || parsed.kind === 'error') return parsed;
  }
  return { kind: 'error', message: PARSE_ERRORS.invalidId };
}

async function nextLocation(url: string, fetchImpl: typeof fetch): Promise<string | null> {
  const request = (method: 'HEAD' | 'GET') =>
    fetchImpl(url, { method, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
  let res = await request('HEAD');
  if (res.status === 405) {
    res = await request('GET');
    await res.body?.cancel();
  }
  return res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
}
