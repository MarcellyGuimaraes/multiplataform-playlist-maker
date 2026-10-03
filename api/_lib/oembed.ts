// Metadados via endpoints oEmbed públicos (sem chave de API). Só texto e URL de thumbnail; nunca mídia.
import type { ParsedTrack, Platform } from '../../shared/parseTrackUrl.js';

export type TrackMetadata = { title: string | null; artist: string | null; thumbnailUrl: string | null };

export const EMPTY_METADATA: TrackMetadata = { title: null, artist: null, thumbnailUrl: null };

export const OEMBED_TIMEOUT_MS = 4000;

const ENDPOINTS: Record<Platform, (url: string) => string> = {
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  spotify: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  soundcloud: (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`,
};

const text = (v: unknown, max = 500): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

const httpsUrl = (v: unknown): string | null => {
  if (typeof v !== 'string' || v.length > 2048) return null;
  try {
    return new URL(v).protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
};

/** Busca título/autor/thumbnail. Qualquer falha ou timeout resulta em metadados vazios, nunca em erro. */
export async function fetchMetadata(
  track: Pick<ParsedTrack, 'platform' | 'canonicalUrl'>,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = OEMBED_TIMEOUT_MS,
): Promise<TrackMetadata> {
  try {
    const res = await fetchImpl(ENDPOINTS[track.platform](track.canonicalUrl), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return EMPTY_METADATA;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      title: text(data.title),
      artist: text(data.author_name),
      thumbnailUrl: httpsUrl(data.thumbnail_url),
    };
  } catch {
    return EMPTY_METADATA;
  }
}
