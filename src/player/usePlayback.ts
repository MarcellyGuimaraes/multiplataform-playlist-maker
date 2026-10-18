// Estado de reprodução: faixa atual, fila, status, preferências e reações aos eventos dos players.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPrefs, savePrefs, type PlaybackPrefs } from './preferences';
import { buildOrder, nextId, prevId, reconcileOrder, type Rng } from './queue';
import type { PlayerEvents } from './types';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'blocked' | 'unavailable' | 'ended';

/**
 * Fonte de uma faixa do Spotify: o próprio Spotify ou a versão no YouTube cadastrada pela dona.
 * Faixas de outras plataformas ignoram a fonte.
 */
export type TrackSource = 'spotify' | 'youtube';

/** Pedido de carga para o player. `nonce` muda a cada pedido, inclusive para a mesma faixa. */
export type LoadRequest = { id: string; autoplay: boolean; nonce: number; source: TrackSource };

type Options = {
  rng?: Rng;
  /** Id do vídeo da versão no YouTube da faixa, ou null se ela não tiver. */
  youtubeAltFor?: (id: string) => string | null;
};

/** Espera antes de pular uma faixa indisponível (com autoplay ligado). */
export const SKIP_UNAVAILABLE_MS = 3000;
/** Espera por "tocando" após um avanço automático antes de considerar o autoplay bloqueado. */
export const BLOCKED_TIMEOUT_MS = 5000;

export function usePlayback(trackIds: readonly string[], { rng, youtubeAltFor }: Options = {}) {
  const [prefs, setPrefs] = useState<PlaybackPrefs>(loadPrefs);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>(() => [...trackIds]);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [request, setRequest] = useState<LoadRequest | null>(null);
  /** O player do Spotify informou que a faixa atual está tocando só a prévia. */
  const [preview, setPreview] = useState(false);

  // Os eventos dos players chegam de forma assíncrona: leem sempre o estado mais recente.
  const latest = useRef({ prefs, currentId, order, status, request });
  latest.current = { prefs, currentId, order, status, request };
  const altFor = useRef(youtubeAltFor);
  altFor.current = youtubeAltFor;
  const hasAlt = useCallback((id: string) => Boolean(altFor.current?.(id)), []);

  /** Já houve prévia do Spotify nesta página: faixas com versão no YouTube começam direto por ela. */
  const preferYoutube = useRef(false);
  /** Faixa em que a pessoa voltou ao Spotify: nela não há nova troca para o YouTube. */
  const noSwitchFor = useRef<string | null>(null);

  const skipTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const blockedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nonce = useRef(0);

  const clearTimers = useCallback(() => {
    clearTimeout(skipTimer.current);
    clearTimeout(blockedTimer.current);
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  /** Carrega a faixa na fonte dada. `auto`: sem clique novo, então arma o detector de bloqueio. */
  const load = useCallback(
    (id: string, source: TrackSource, { auto }: { auto: boolean }) => {
      clearTimers();
      setCurrentId(id);
      setStatus('loading');
      setPreview(false);
      setRequest({ id, autoplay: true, nonce: ++nonce.current, source });
      if (auto) {
        blockedTimer.current = setTimeout(() => {
          if (latest.current.status !== 'playing') setStatus('blocked');
        }, BLOCKED_TIMEOUT_MS);
      }
    },
    [clearTimers],
  );

  const goTo = useCallback(
    (id: string, { auto }: { auto: boolean }) => {
      if (noSwitchFor.current !== id) noSwitchFor.current = null;
      load(id, preferYoutube.current && hasAlt(id) ? 'youtube' : 'spotify', { auto });
    },
    [load, hasAlt],
  );

  const stop = useCallback(() => {
    clearTimers();
    setCurrentId(null);
    setRequest(null);
    setStatus('idle');
    setPreview(false);
  }, [clearTimers]);

  // A fila acompanha mudanças na playlist; se a faixa atual sumiu, o player fecha.
  const idsKey = trackIds.join('\n');
  useEffect(() => {
    setOrder((prev) => reconcileOrder(prev, trackIds, latest.current.prefs.shuffle));
    const current = latest.current.currentId;
    if (current !== null && !trackIds.includes(current)) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, stop]);

  const advance = useCallback(
    (auto: boolean) => {
      const { order: o, currentId: cur, prefs: p } = latest.current;
      const n = nextId(o, cur, { repeat: p.repeat });
      if (n === null) {
        clearTimers();
        setStatus('ended');
      } else goTo(n, { auto });
    },
    [clearTimers, goTo],
  );

  const updatePrefs = useCallback((patch: Partial<PlaybackPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const actions = useMemo(
    () => ({
      /** Ação de quem ouve: carrega e toca a faixa. */
      play: (id: string) => goTo(id, { auto: false }),
      next: () => advance(false),
      prev: () => {
        const { order: o, currentId: cur, prefs: p } = latest.current;
        const id = prevId(o, cur, { repeat: p.repeat });
        if (id !== null) goTo(id, { auto: false });
      },
      toggleAutoplay: () => updatePrefs({ autoplay: !latest.current.prefs.autoplay }),
      toggleRepeat: () => updatePrefs({ repeat: !latest.current.prefs.repeat }),
      /** Sai da versão no YouTube e volta ao embed do Spotify na mesma faixa, sem nova troca nela. */
      backToSpotify: () => {
        const id = latest.current.currentId;
        if (id === null) return;
        noSwitchFor.current = id;
        preferYoutube.current = false;
        load(id, 'spotify', { auto: false });
      },
      toggleShuffle: () => {
        const shuffle = !latest.current.prefs.shuffle;
        updatePrefs({ shuffle });
        setOrder(buildOrder(trackIds, { shuffle, currentId: latest.current.currentId, rng }));
      },
    }),
    // trackIds é lido na hora de embaralhar; idsKey captura mudanças de conteúdo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goTo, advance, load, updatePrefs, idsKey, rng],
  );

  // Handlers chamados pelos adaptadores de player.
  const events = useMemo<PlayerEvents>(
    () => ({
      onPlaying: () => {
        clearTimeout(blockedTimer.current);
        setStatus('playing');
      },
      onPaused: () => {
        if (latest.current.status === 'playing') setStatus('paused');
      },
      onEnded: () => {
        if (latest.current.prefs.autoplay) advance(true);
        else {
          clearTimers();
          setStatus('ended');
        }
      },
      onError: (reason) => {
        console.info(`[player] faixa indisponível (${reason})`);
        clearTimers();
        setStatus('unavailable');
        if (latest.current.prefs.autoplay) {
          skipTimer.current = setTimeout(() => advance(true), SKIP_UNAVAILABLE_MS);
        }
      },
      onPreview: (isPreview) => {
        const { currentId: id, request: req } = latest.current;
        if (!isPreview) {
          setPreview(false);
          preferYoutube.current = false;
          return;
        }
        if (id === null || noSwitchFor.current === id) {
          setPreview(true);
          return;
        }
        preferYoutube.current = true;
        // A troca acontece sem um clique novo: o detector de bloqueio fica armado, como num avanço automático.
        if (req?.source === 'spotify' && hasAlt(id)) load(id, 'youtube', { auto: true });
        else setPreview(true);
      },
    }),
    [advance, clearTimers, load, hasAlt],
  );

  const repeat = prefs.repeat;
  return {
    currentId,
    order,
    status,
    request,
    preview,
    prefs,
    canPrev: prevId(order, currentId, { repeat }) !== null,
    canNext: currentId !== null && nextId(order, currentId, { repeat }) !== null,
    ...actions,
    events,
  };
}

export type Playback = ReturnType<typeof usePlayback>;
