// Spotify: o mesmo iframe de embed oficial do MVP (open.spotify.com/embed/track/<id>), controlado pelas
// mensagens que o próprio embed troca com a página — o mesmo protocolo que a Spotify iFrame API usa por baixo.
// Não usamos o script da iFrame API: o iframe criado por ela tocava só a prévia de 30 s mesmo com login,
// enquanto o iframe simples toca a faixa completa (verificado no navegador da dona do projeto).
//
// Mensagens do embed para a página: { type: 'ready' }, { type: 'playback_update', payload },
// { type: 'error', payload: { code, message, recoverable } }. Comandos da página: { command: 'play' } etc.
// O embed não emite evento de fim: o fim é inferido pelo progresso em `playback_update`.
import { EMBED_HEIGHT } from '../../embed';
import { IFRAME_ALLOW, type EmbeddableTrack, type PlayerEvents, type PlayerFactory } from '../types';

export type PlaybackUpdate = { isPaused: boolean; isBuffering?: boolean; position: number; duration: number };

export const SPOTIFY_ORIGIN = 'https://open.spotify.com';

/** Margem antes do fim em que a faixa é considerada terminada (o progresso chega em saltos). */
export const END_MARGIN_MS = 1000;
/** Se o player volta a 0 pausado e o último progresso estava nesta janela final, também é fim. */
export const RESET_WINDOW_MS = 5000;

/** Mesma URL do iframe do MVP, sem parâmetros extras. */
export const spotifyEmbedSrc = (track: EmbeddableTrack) =>
  `${SPOTIFY_ORIGIN}/embed/track/${encodeURIComponent(track.externalId)}`;

/**
 * Converte a sequência de `playback_update` em eventos de início, pausa e fim.
 * Fim: progresso alcançou a duração (margem de 1 s) ou voltou a 0 pausado vindo dos últimos 5 s.
 * O fim é emitido uma única vez por faixa; `reset()` rearma ao carregar outra.
 */
export function createProgressTracker(events: PlayerEvents) {
  let ended = false;
  let playing = false;
  let lastPosition = 0;
  return {
    reset() {
      ended = false;
      playing = false;
      lastPosition = 0;
    },
    update({ isPaused, position, duration }: PlaybackUpdate) {
      if (ended) return;
      const within = (pos: number, margin: number) => duration > 0 && pos >= duration - margin;
      if (within(position, END_MARGIN_MS) || (isPaused && position === 0 && within(lastPosition, RESET_WINDOW_MS))) {
        ended = true;
        playing = false;
        events.onEnded();
        return;
      }
      if (!isPaused && !playing && position >= lastPosition) {
        playing = true;
        events.onPlaying();
      } else if (isPaused && playing) {
        playing = false;
        events.onPaused();
      }
      lastPosition = position;
    },
  };
}

type EmbedMessage =
  | { type: 'ready' }
  | { type: 'playback_update'; payload: PlaybackUpdate }
  | { type: 'error'; payload?: { code?: string; message?: string; recoverable?: boolean } };

export const createSpotifyPlayer: PlayerFactory = async (container, events) => {
  const tracker = createProgressTracker(events);
  const iframe = document.createElement('iframe');
  iframe.title = 'Player do Spotify';
  iframe.width = '100%';
  iframe.height = String(EMBED_HEIGHT.spotify);
  iframe.allow = IFRAME_ALLOW;
  iframe.style.border = '0';
  container.appendChild(iframe);

  let ready = false;
  let playWhenReady = false;

  const send = (command: string) => iframe.contentWindow?.postMessage({ command }, SPOTIFY_ORIGIN);

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== SPOTIFY_ORIGIN || e.source !== iframe.contentWindow) return;
    const msg = e.data as EmbedMessage | null;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'ready') {
      ready = true;
      if (playWhenReady) {
        playWhenReady = false;
        send('play');
      }
    } else if (msg.type === 'playback_update' && msg.payload) {
      tracker.update(msg.payload);
    } else if (msg.type === 'error' && !msg.payload?.recoverable) {
      events.onError(`spotify:${msg.payload?.message ?? 'erro'}`);
    }
  };
  window.addEventListener('message', onMessage);

  return {
    load(track, { autoplay }) {
      tracker.reset();
      const src = spotifyEmbedSrc(track);
      if (iframe.src === src && ready) {
        // Mesma faixa de novo: atribuir o mesmo src não recarrega o iframe.
        if (autoplay) send('play_from_start');
        return;
      }
      // Trocar o src recarrega o embed, que manda `ready` de novo.
      ready = false;
      playWhenReady = autoplay;
      iframe.src = src;
    },
    destroy() {
      window.removeEventListener('message', onMessage);
      container.replaceChildren();
    },
  };
};
