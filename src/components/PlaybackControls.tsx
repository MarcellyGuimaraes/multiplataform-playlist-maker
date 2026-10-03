import type { Playback } from '../player/usePlayback';

type Props = Pick<
  Playback,
  'prefs' | 'canPrev' | 'canNext' | 'prev' | 'next' | 'toggleAutoplay' | 'toggleRepeat' | 'toggleShuffle'
>;

export function PlaybackControls({ prefs, canPrev, canNext, prev, next, toggleAutoplay, toggleRepeat, toggleShuffle }: Props) {
  return (
    <div className="playback-controls" role="group" aria-label="Controles de reprodução">
      <div className="playback-nav">
        <button type="button" className="secondary" onClick={prev} disabled={!canPrev} aria-label="Faixa anterior">
          ⏮ Anterior
        </button>
        <button type="button" className="secondary" onClick={next} disabled={!canNext} aria-label="Próxima faixa">
          Próxima ⏭
        </button>
      </div>
      <div className="playback-toggles">
        <Toggle label="Autoplay" pressed={prefs.autoplay} onClick={toggleAutoplay} />
        <Toggle label="Repetir" pressed={prefs.repeat} onClick={toggleRepeat} />
        <Toggle label="Aleatório" pressed={prefs.shuffle} onClick={toggleShuffle} />
      </div>
    </div>
  );
}

function Toggle({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`toggle${pressed ? ' is-on' : ''}`} aria-pressed={pressed} onClick={onClick}>
      {label}
    </button>
  );
}
