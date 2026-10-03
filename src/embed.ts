// URLs dos players embutidos oficiais e helpers de exibição de faixa.
import type { Platform } from '../shared/parseTrackUrl';
import type { SharedTrack } from '../shared/types';

type EmbeddableTrack = Pick<SharedTrack, 'platform' | 'externalId' | 'canonicalUrl'>;

/** Monta a URL do iframe oficial de cada plataforma. Sem autoplay e sem SDKs de controle. */
export function embedUrl(track: EmbeddableTrack): string {
  switch (track.platform) {
    case 'youtube':
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(track.externalId)}?rel=0`;
    case 'spotify':
      return `https://open.spotify.com/embed/track/${encodeURIComponent(track.externalId)}`;
    case 'soundcloud':
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.canonicalUrl)}&auto_play=false&visual=false`;
  }
}

export const EMBED_HEIGHT: Record<Platform, number> = { youtube: 315, spotify: 152, soundcloud: 166 };

export const PLATFORM_NAME: Record<Platform, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
};

/** Nome principal: rótulo > título em cache > URL original. */
export function displayName(track: Pick<SharedTrack, 'label' | 'title' | 'originalUrl'>): string {
  return track.label || track.title || track.originalUrl;
}

/** Linha secundária: título em cache (quando o rótulo ocupa o nome principal) e artista. */
export function displayDetails(track: Pick<SharedTrack, 'label' | 'title' | 'artist'>): string {
  const parts = [track.label ? track.title : null, track.artist].filter(Boolean);
  return parts.join(' · ');
}
