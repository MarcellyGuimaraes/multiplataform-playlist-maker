import type { SharedTrack } from '../../shared/types';
import type { Playback } from '../player/usePlayback';
import { EmbedPlayer } from './EmbedPlayer';
import { PlaybackControls } from './PlaybackControls';

type Props = {
  track: SharedTrack | null;
  playback: Playback;
  /** Tela de edição da dona (não a pública): o aviso de prévia sugere cadastrar uma versão no YouTube. */
  ownerView?: boolean;
};

/** Player da faixa atual com os controles de reprodução contínua. Usado nas telas de edição e pública. */
export function PlayerPanel({ track, playback, ownerView = false }: Props) {
  if (!track) return null;
  return (
    <EmbedPlayer
      track={track}
      request={playback.request}
      events={playback.events}
      status={playback.status}
      autoplay={playback.prefs.autoplay}
      preview={playback.preview}
      onBackToSpotify={playback.backToSpotify}
      ownerView={ownerView}
    >
      <PlaybackControls {...playback} />
    </EmbedPlayer>
  );
}
