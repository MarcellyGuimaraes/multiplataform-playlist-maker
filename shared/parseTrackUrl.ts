// Detecção de plataforma e extração do identificador de faixa a partir de um link colado.
// Função pura, sem rede: usada no front (feedback imediato) e na API (fonte da verdade).
import { TRACK_URL_MAX } from './limits.js';

export type Platform = 'youtube' | 'spotify' | 'soundcloud';

export const PLATFORMS: readonly Platform[] = ['youtube', 'spotify', 'soundcloud'];

export type ParsedTrack = {
  kind: 'track';
  platform: Platform;
  externalId: string;
  canonicalUrl: string;
};

/** Link curto do SoundCloud: precisa ser resolvido no servidor (seguindo redirecionamentos). */
export type ShortLink = { kind: 'short-link'; platform: 'soundcloud'; url: string };

export type ParseError = { kind: 'error'; message: string };

export type ParseResult = ParsedTrack | ShortLink | ParseError;

export const PARSE_ERRORS = {
  empty: 'Cole um link do YouTube, Spotify ou SoundCloud.',
  tooLong: `O link deve ter no máximo ${TRACK_URL_MAX} caracteres.`,
  notUrl: 'Isso não parece um link. Cole um link do YouTube, Spotify ou SoundCloud.',
  unsupported: 'Só são aceitos links do YouTube, Spotify e SoundCloud.',
  notTrack: 'Apenas faixas individuais são suportadas (não álbuns, playlists, sets, perfis ou episódios).',
  invalidId: 'Não foi possível identificar a faixa nesse link.',
} as const;

const fail = (message: string): ParseError => ({ kind: 'error', message });

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SOUNDCLOUD_SLUG = /^[a-z0-9_-]+$/;

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
const SOUNDCLOUD_HOSTS = new Set(['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com']);

// Primeiros segmentos de caminho do SoundCloud que são páginas do site, não usuários.
const SOUNDCLOUD_RESERVED_ROOTS = new Set([
  'discover', 'search', 'stream', 'you', 'upload', 'charts', 'pages', 'terms-of-use',
  'mobile', 'settings', 'messages', 'notifications', 'people', 'tags', 'stations', 'feed',
]);
// Segundos segmentos que indicam listas/abas de perfil, não uma faixa.
const SOUNDCLOUD_RESERVED_SECOND = new Set([
  'sets', 'likes', 'reposts', 'tracks', 'albums', 'popular-tracks', 'followers',
  'following', 'comments', 'spotlight', 'playlists', 'toptracks',
]);

export function parseTrackUrl(input: string): ParseResult {
  const raw = input.trim();
  if (!raw) return fail(PARSE_ERRORS.empty);
  if (raw.length > TRACK_URL_MAX) return fail(PARSE_ERRORS.tooLong);

  const spotifyUri = /^spotify:([a-z]+):([^:?#\s]+)$/i.exec(raw);
  if (spotifyUri) return spotifyTrack(spotifyUri[1].toLowerCase(), spotifyUri[2]);

  const url = toUrl(raw);
  if (!url) return fail(PARSE_ERRORS.notUrl);

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') return youtubeTrack(segments[0]);
  if (YOUTUBE_HOSTS.has(host)) return parseYouTube(url, segments);
  if (host === 'open.spotify.com') return parseSpotify(segments);
  if (host === 'on.soundcloud.com') {
    return segments.length > 0
      ? { kind: 'short-link', platform: 'soundcloud', url: url.toString() }
      : fail(PARSE_ERRORS.invalidId);
  }
  if (SOUNDCLOUD_HOSTS.has(host)) return parseSoundCloud(segments);
  return fail(PARSE_ERRORS.unsupported);
}

function toUrl(raw: string): URL | null {
  // Aceita links colados sem esquema, como "youtu.be/abc".
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url;
  } catch {
    return null;
  }
}

function parseYouTube(url: URL, segments: string[]): ParseResult {
  const [first, second] = segments;
  if (first === 'watch') return youtubeTrack(url.searchParams.get('v') ?? undefined);
  if (first === 'shorts' || first === 'live' || first === 'embed') return youtubeTrack(second);
  if (first === 'playlist' || first === 'channel' || first === 'c' || first?.startsWith('@')) {
    return fail(PARSE_ERRORS.notTrack);
  }
  return fail(PARSE_ERRORS.invalidId);
}

function youtubeTrack(id: string | undefined): ParseResult {
  if (!id || !YOUTUBE_ID.test(id)) return fail(PARSE_ERRORS.invalidId);
  return {
    kind: 'track',
    platform: 'youtube',
    externalId: id,
    canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
  };
}

function parseSpotify(segments: string[]): ParseResult {
  const rest = /^intl-[a-z]{2}(-[a-z]{2})?$/i.test(segments[0] ?? '') ? segments.slice(1) : segments;
  const [type, id] = rest;
  if (!type) return fail(PARSE_ERRORS.invalidId);
  return spotifyTrack(type.toLowerCase(), id);
}

function spotifyTrack(type: string, id: string | undefined): ParseResult {
  if (type !== 'track') return fail(PARSE_ERRORS.notTrack);
  if (!id || !SPOTIFY_ID.test(id)) return fail(PARSE_ERRORS.invalidId);
  return {
    kind: 'track',
    platform: 'spotify',
    externalId: id,
    canonicalUrl: `https://open.spotify.com/track/${id}`,
  };
}

function parseSoundCloud(segments: string[]): ParseResult {
  const parts = segments.map((s) => s.toLowerCase());
  const [user, track] = parts;
  if (!user || SOUNDCLOUD_RESERVED_ROOTS.has(user)) return fail(PARSE_ERRORS.notTrack);
  if (!track || SOUNDCLOUD_RESERVED_SECOND.has(track) || parts.length > 2) {
    return fail(PARSE_ERRORS.notTrack);
  }
  if (!SOUNDCLOUD_SLUG.test(user) || !SOUNDCLOUD_SLUG.test(track)) return fail(PARSE_ERRORS.invalidId);
  const externalId = `${user}/${track}`;
  return {
    kind: 'track',
    platform: 'soundcloud',
    externalId,
    canonicalUrl: `https://soundcloud.com/${externalId}`,
  };
}
