// Estado de reprodução: faixa atual, fila, status, preferências e reações aos eventos dos players.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPrefs, savePrefs, type PlaybackPrefs } from './preferences';
import { buildOrder, nextId, prevId, reconcileOrder, type Rng } from './queue';
import type { PlayerEvents } from './types';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'blocked' | 'unavailable' | 'ended';

/** Pedido de carga para o player. `nonce` muda a cada pedido, inclusive para a mesma faixa. */
export type LoadRequest = { id: string; autoplay: boolean; nonce: number };

/** Espera antes de pular uma faixa indisponível (com autoplay ligado). */
export const SKIP_UNAVAILABLE_MS = 3000;
/** Espera por "tocando" após um avanço automático antes de considerar o autoplay bloqueado. */
export const BLOCKED_TIMEOUT_MS = 5000;

export function usePlayback(trackIds: readonly string[], { rng }: { rng?: Rng } = {}) {
  const [prefs, setPrefs] = useState<PlaybackPrefs>(loadPrefs);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>(() => [...trackIds]);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [request, setRequest] = useState<LoadRequest | null>(null);

  // Os eventos dos players chegam de forma assíncrona: leem sempre o estado mais recente.
  const latest = useRef({ prefs, currentId, order, status });
  latest.current = { prefs, currentId, order, status };

  const skipTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const blockedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nonce = useRef(0);

  const clearTimers = useCallback(() => {
    clearTimeout(skipTimer.current);
    clearTimeout(blockedTimer.current);
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const goTo = useCallback(
    (id: string, { auto }: { auto: boolean }) => {
      clearTimers();
      setCurrentId(id);
      setStatus('loading');
      setRequest({ id, autoplay: true, nonce: ++nonce.current });
      if (auto) {
        blockedTimer.current = setTimeout(() => {
          if (latest.current.status !== 'playing') setStatus('blocked');
        }, BLOCKED_TIMEOUT_MS);
      }
    },
    [clearTimers],
  );

  const stop = useCallback(() => {
    clearTimers();
    setCurrentId(null);
    setRequest(null);
    setStatus('idle');
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
      toggleShuffle: () => {
        const shuffle = !latest.current.prefs.shuffle;
        updatePrefs({ shuffle });
        setOrder(buildOrder(trackIds, { shuffle, currentId: latest.current.currentId, rng }));
      },
    }),
    // trackIds é lido na hora de embaralhar; idsKey captura mudanças de conteúdo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goTo, advance, updatePrefs, idsKey, rng],
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
    }),
    [advance, clearTimers],
  );

  const repeat = prefs.repeat;
  return {
    currentId,
    order,
    status,
    request,
    prefs,
    canPrev: prevId(order, currentId, { repeat }) !== null,
    canNext: currentId !== null && nextId(order, currentId, { repeat }) !== null,
    ...actions,
    events,
  };
}

export type Playback = ReturnType<typeof usePlayback>;
