// Montagem do player de uma plataforma, com fallback para o iframe simples se o SDK oficial não carregar.
import type { Platform } from '../../shared/parseTrackUrl';
import { EMBED_HEIGHT, embedUrl } from '../embed';
import { createSoundCloudPlayer } from './adapters/soundcloud';
import { createSpotifyPlayer } from './adapters/spotify';
import { createYouTubePlayer } from './adapters/youtube';
import { IFRAME_ALLOW, type PlatformPlayer, type PlayerEvents, type PlayerFactories } from './types';

export const defaultFactories: PlayerFactories = {
  youtube: createYouTubePlayer,
  spotify: createSpotifyPlayer,
  soundcloud: createSoundCloudPlayer,
};

/** Iframe sem controle: toca, mas o app não sabe quando termina (reprodução manual, como no MVP). */
export function createBlindPlayer(container: HTMLElement, platform: Platform): PlatformPlayer {
  const iframe = document.createElement('iframe');
  iframe.width = '100%';
  iframe.height = String(EMBED_HEIGHT[platform]);
  iframe.allow = IFRAME_ALLOW;
  iframe.style.border = '0';
  container.appendChild(iframe);
  return {
    load(track) {
      iframe.title = `Player (${track.platform})`;
      iframe.src = embedUrl(track);
    },
    destroy() {
      container.replaceChildren();
    },
  };
}

export type MountedPlayer = { player: PlatformPlayer; degraded: boolean };

export async function mountPlayer(
  factories: PlayerFactories,
  platform: Platform,
  container: HTMLElement,
  events: PlayerEvents,
): Promise<MountedPlayer> {
  try {
    return { player: await factories[platform](container, events), degraded: false };
  } catch (err) {
    console.warn(`[player] SDK de ${platform} indisponível, usando iframe simples`, err);
    container.replaceChildren();
    return { player: createBlindPlayer(container, platform), degraded: true };
  }
}
