import type { Platform } from '../../shared/parseTrackUrl';
import type { SharedTrack } from '../../shared/types';

export type EmbeddableTrack = Pick<SharedTrack, 'platform' | 'externalId' | 'canonicalUrl'>;

/** Eventos de estado que os adaptadores repassam a partir das APIs oficiais de player. */
export type PlayerEvents = {
  onPlaying(): void;
  onPaused(): void;
  onEnded(): void;
  onError(reason: string): void;
};

/** Player de uma plataforma montado num contêiner. Reaproveitável entre faixas da mesma plataforma. */
export interface PlatformPlayer {
  load(track: EmbeddableTrack, opts: { autoplay: boolean }): void;
  destroy(): void;
}

export type PlayerFactory = (container: HTMLElement, events: PlayerEvents) => Promise<PlatformPlayer>;

export type PlayerFactories = Record<Platform, PlayerFactory>;

/** Atributo `allow` para iframes de player: autoplay delegado para a troca automática de faixa. */
export const IFRAME_ALLOW = 'autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write';
