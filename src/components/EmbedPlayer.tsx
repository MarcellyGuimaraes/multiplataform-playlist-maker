import type { SharedTrack } from '../../shared/types';
import { EMBED_HEIGHT, PLATFORM_NAME, displayDetails, displayName, embedUrl } from '../embed';
import { PlatformBadge } from './PlatformBadge';

/**
 * Player embutido oficial da faixa selecionada. O áudio vai direto da plataforma para o navegador.
 * Rótulo, metadados em cache e link original ficam sempre visíveis, mesmo que o player não consiga tocar.
 */
export function EmbedPlayer({ track }: { track: SharedTrack }) {
  const name = displayName(track);
  const details = displayDetails(track);
  return (
    <section className="player" aria-label="Tocando agora">
      <iframe
        // key força recriar o iframe ao trocar de faixa: um único player ativo por vez.
        key={`${track.platform}:${track.externalId}`}
        title={`Player do ${PLATFORM_NAME[track.platform]}: ${name}`}
        src={embedUrl(track)}
        width="100%"
        height={EMBED_HEIGHT[track.platform]}
        allow="encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
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
