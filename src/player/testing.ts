// Só para testes: adaptadores de player falsos que registram as chamadas e expõem os eventos.
import type { Platform } from '../../shared/parseTrackUrl';
import { embedUrl } from '../embed';
import type { PlayerEvents, PlayerFactories, PlayerFactory } from './types';

export type FakeLogEntry =
  | { platform: Platform; action: 'mount' | 'destroy' }
  | { platform: Platform; action: 'load'; id: string; autoplay: boolean };

export function createFakeFactories() {
  const log: FakeLogEntry[] = [];
  let lastEvents: PlayerEvents | null = null;

  const make =
    (platform: Platform): PlayerFactory =>
    async (container, events) => {
      lastEvents = events;
      const iframe = document.createElement('iframe');
      iframe.title = `fake ${platform}`;
      container.appendChild(iframe);
      log.push({ platform, action: 'mount' });
      return {
        load(track, { autoplay }) {
          iframe.src = embedUrl(track);
          log.push({ platform, action: 'load', id: track.externalId, autoplay });
        },
        destroy() {
          log.push({ platform, action: 'destroy' });
          container.replaceChildren();
        },
      };
    };

  const factories: PlayerFactories = { youtube: make('youtube'), spotify: make('spotify'), soundcloud: make('soundcloud') };
  return {
    factories,
    log,
    /** Eventos do player montado mais recentemente (para simular fim, erro, início). */
    events: () => {
      if (!lastEvents) throw new Error('Nenhum player montado ainda');
      return lastEvents;
    },
    loads: () => log.filter((e): e is Extract<FakeLogEntry, { action: 'load' }> => e.action === 'load'),
  };
}
