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

/**
 * Orientação mostrada quando o Spotify toca só a prévia, conforme o navegador. O embed decide pelos cookies
 * de login que recebe: no celular e no Safari ele toca só a prévia; o Firefox particiona os cookies, mas
 * libera o login com um clique no play dentro do player; nos demais, falta login ou o navegador o bloqueia.
 */
export function spotifyPreviewHint(userAgent: string): string {
  // Celular primeiro: o embed toca só a prévia no celular, qualquer que seja o navegador.
  const mobile = /Android|iPhone|iPad|iPod|Mobile/.test(userAgent);
  const safari = /Safari\//.test(userAgent) && !/Chrome|Chromium|Edg\//.test(userAgent);
  if (mobile || safari) {
    return 'Neste navegador o Spotify toca só a prévia de 30 segundos no player embutido.';
  }
  if (/Firefox\//.test(userAgent)) {
    return 'O Firefox esconde do player do Spotify o seu login. Se você tem login no Spotify neste navegador, clique uma vez no play dentro do player para liberar a faixa completa (vale por 30 dias neste site).';
  }
  return 'Tocando a prévia de 30 segundos. Para ouvir a faixa completa, faça login no Spotify neste navegador. Se você já tem login, o navegador está bloqueando-o neste site (janela anônima ou cookies de terceiros bloqueados).';
}
