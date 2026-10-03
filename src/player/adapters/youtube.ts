// YouTube IFrame Player API (oficial). https://developers.google.com/youtube/iframe_api_reference
import { EMBED_HEIGHT } from '../../embed';
import { loadSdk } from '../sdk';
import type { PlayerFactory } from '../types';

type YTPlayer = {
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  destroy(): void;
};

type YTNamespace = {
  loaded?: number;
  Player: new (
    el: HTMLElement,
    opts: {
      host?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

// Valores de YT.PlayerState.
export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 } as const;

function loadYouTube(): Promise<YTNamespace> {
  const w = window as YTWindow;
  return loadSdk<YTNamespace>('youtube', 'https://www.youtube.com/iframe_api', {
    waitReady: (resolve) => {
      if (w.YT?.Player && w.YT.loaded === 1) return resolve(w.YT);
      const previous = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(w.YT!);
      };
    },
  });
}

export const createYouTubePlayer: PlayerFactory = async (container, events) => {
  const YT = await loadYouTube();
  const mount = document.createElement('div');
  container.appendChild(mount);

  let player!: YTPlayer;
  await new Promise<void>((resolve) => {
    player = new YT.Player(mount, {
      host: 'https://www.youtube-nocookie.com',
      width: '100%',
      height: EMBED_HEIGHT.youtube,
      playerVars: { rel: 0, playsinline: 1 },
      events: {
        onReady: () => resolve(),
        onStateChange: ({ data }) => {
          if (data === YT_STATE.ENDED) events.onEnded();
          else if (data === YT_STATE.PLAYING) events.onPlaying();
          else if (data === YT_STATE.PAUSED) events.onPaused();
        },
        // 2: id inválido · 5: erro HTML5 · 100: removido/privado · 101/150: embed proibido pelo dono
        onError: ({ data }) => events.onError(`youtube:${data}`),
      },
    });
  });

  return {
    load(track, { autoplay }) {
      if (autoplay) player.loadVideoById(track.externalId);
      else player.cueVideoById(track.externalId);
    },
    destroy() {
      player.destroy();
      container.replaceChildren();
    },
  };
};
