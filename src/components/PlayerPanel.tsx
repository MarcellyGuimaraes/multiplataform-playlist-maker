import type { SharedTrack } from '../../shared/types';
import type { Playback } from '../player/usePlayback';
import { EmbedPlayer } from './EmbedPlayer';
import { PlaybackControls } from './PlaybackControls';

/** Player da faixa atual com os controles de reprodução contínua. Usado nas telas de edição e pública. */
export function PlayerPanel({ track, playback }: { track: SharedTrack | null; playback: Playback }) {
  if (!track) return null;
  return (
    <EmbedPlayer
      track={track}
      request={playback.request}
      events={playback.events}
      status={playback.status}
      autoplay={playback.prefs.autoplay}
    >
      <PlaybackControls {...playback} />
    </EmbedPlayer>
  );
}
