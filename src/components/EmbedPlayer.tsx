import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Platform } from '../../shared/parseTrackUrl';
import type { SharedTrack } from '../../shared/types';
import { PLATFORM_NAME, displayDetails, displayName } from '../embed';
import { usePlayerFactories } from '../player/PlayerAdapterContext';
import { mountPlayer } from '../player/registry';
import type { PlatformPlayer, PlayerEvents } from '../player/types';
import type { LoadRequest, PlaybackStatus } from '../player/usePlayback';
import { PlatformBadge } from './PlatformBadge';

type Props = {
  track: SharedTrack;
  request: LoadRequest | null;
  events: PlayerEvents;
  status?: PlaybackStatus;
  autoplay?: boolean;
  /** Controles de reprodução exibidos dentro do painel do player. */
  children?: ReactNode;
};

type Mounted = { platform: Platform; player: PlatformPlayer; host: HTMLElement };

/**
 * Player embutido oficial da faixa atual, controlado pela API oficial de player da plataforma.
 * O áudio vai direto da plataforma para o navegador. Faixas seguidas da mesma plataforma reaproveitam
 * o mesmo player; ao trocar de plataforma, o anterior é destruído (um único player ativo).
 * Rótulo, metadados em cache e link original ficam sempre visíveis, mesmo que o player não consiga tocar.
 */
export function EmbedPlayer({ track, request, events, status, autoplay, children }: Props) {
  const factories = usePlayerFactories();
  const containerRef = useRef<HTMLDivElement>(null);
  const mounted = useRef<Mounted | null>(null);
  const [degraded, setDegraded] = useState(false);

  const eventsRef = useRef(events);
  eventsRef.current = events;
  const stableEvents = useMemo<PlayerEvents>(
    () => ({
      onPlaying: () => eventsRef.current.onPlaying(),
      onPaused: () => eventsRef.current.onPaused(),
      onEnded: () => eventsRef.current.onEnded(),
      onError: (reason) => eventsRef.current.onError(reason),
    }),
    [],
  );

  const trackRef = useRef(track);
  trackRef.current = track;

  useEffect(() => {
    if (!request) return;
    const target = trackRef.current;
    let cancelled = false;

    const current = mounted.current;
    if (current && current.platform === target.platform) {
      current.player.load(target, { autoplay: request.autoplay });
      return;
    }

    current?.player.destroy();
    current?.host.remove();
    mounted.current = null;

    // Cada montagem usa seu próprio elemento: uma montagem cancelada não apaga a seguinte.
    const host = document.createElement('div');
    containerRef.current!.appendChild(host);
    void mountPlayer(factories, target.platform, host, stableEvents).then(({ player, degraded: d }) => {
      if (cancelled) {
        player.destroy();
        host.remove();
        return;
      }
      mounted.current = { platform: target.platform, player, host };
      setDegraded(d);
      player.load(target, { autoplay: request.autoplay });
    });

    return () => {
      cancelled = true;
      // Montagem ainda pendente: o próximo pedido decide o que fazer com o player atual.
      if (!mounted.current) host.remove();
    };
  }, [request, factories, stableEvents]);

  useEffect(
    () => () => {
      mounted.current?.player.destroy();
      mounted.current?.host.remove();
      mounted.current = null;
    },
    [],
  );

  const name = displayName(track);
  const details = displayDetails(track);
  return (
    <section className="player" aria-label="Tocando agora">
      <div ref={containerRef} className="player-embed" style={{ minHeight: 152 }} />
      {children}
      <PlayerNotice status={status} autoplay={autoplay} degraded={degraded} />
      <div className="player-info">
        {track.thumbnailUrl && <img className="thumb" src={track.thumbnailUrl} alt="" loading="lazy" />}
        <div>
          <p className="track-name">{name}</p>
          {details && <p className="track-details">{details}</p>}
          <p className="track-details">
            <PlatformBadge platform={track.platform} />{' '}
            <a href={track.originalUrl} target="_blank" rel="noopener noreferrer">
              Abrir no {PLATFORM_NAME[track.platform]}
            </a>
          </p>
        </div>
      </div>
      {track.platform === 'spotify' && (
        <p className="notice" role="note">
          O Spotify só toca a faixa completa para quem tem login feito na conta Spotify neste navegador.
          Sem login, toca apenas uma prévia de 30 segundos.
        </p>
      )}
    </section>
  );
}

function PlayerNotice({ status, autoplay, degraded }: { status?: PlaybackStatus; autoplay?: boolean; degraded: boolean }) {
  let text: string | null = null;
  if (status === 'unavailable') {
    text = autoplay
      ? 'Esta faixa está indisponível na plataforma. Pulando para a próxima…'
      : 'Esta faixa está indisponível na plataforma.';
  } else if (status === 'blocked') {
    text = 'O navegador bloqueou o início automático. Toque em play no player para continuar.';
  } else if (status === 'ended') {
    text = 'Fim da reprodução.';
  } else if (degraded) {
    text = 'Não foi possível carregar o controle oficial deste player: avance as faixas manualmente.';
  }
  return (
    <p className={text ? 'player-status' : 'player-status is-empty'} role="status">
      {text}
    </p>
  );
}
