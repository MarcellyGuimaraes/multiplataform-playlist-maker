import { useState, type ReactNode } from 'react';
import { TRACK_LABEL_MAX } from '../../shared/limits';
import type { SharedTrack } from '../../shared/types';
import { displayDetails, displayName } from '../embed';
import { PlatformBadge } from './PlatformBadge';

export type TrackEditActions = {
  onMove: (from: number, to: number) => void;
  onDelete: (index: number) => void;
  onSaveLabel: (index: number, label: string) => Promise<void>;
};

type Props<T extends SharedTrack> = {
  tracks: T[];
  currentIndex: number | null;
  onPlay: (index: number) => void;
  /** Sem `edit`, a lista é somente leitura (visualização compartilhada). */
  edit?: TrackEditActions;
  busy?: boolean;
  /** Chave estável de cada item (padrão: posição). */
  itemKey?: (track: T, index: number) => string | number;
  /** Permite envolver cada item (ex.: para arrastar e soltar). */
  renderItem?: (track: T, index: number, content: ReactNode, key: string | number) => ReactNode;
  emptyState?: ReactNode;
};

export function TrackList<T extends SharedTrack>({
  tracks,
  currentIndex,
  onPlay,
  edit,
  busy,
  itemKey = (track) => track.position,
  renderItem,
  emptyState,
}: Props<T>) {
  if (tracks.length === 0) return <div className="empty">{emptyState ?? 'Nenhuma faixa ainda.'}</div>;
  return (
    <ol className="track-list">
      {tracks.map((track, i) => {
        const key = itemKey(track, i);
        const content = (
          <TrackItem
            key={key}
            track={track}
            index={i}
            total={tracks.length}
            playing={i === currentIndex}
            onPlay={() => onPlay(i)}
            edit={edit}
            busy={busy}
          />
        );
        return renderItem ? renderItem(track, i, content, key) : <li key={key}>{content}</li>;
      })}
    </ol>
  );
}

type ItemProps = {
  track: SharedTrack;
  index: number;
  total: number;
  playing: boolean;
  onPlay: () => void;
  edit?: TrackEditActions;
  busy?: boolean;
};

function TrackItem({ track, index, total, playing, onPlay, edit, busy }: ItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(track.label);
  const [error, setError] = useState<string | null>(null);
  const name = displayName(track);
  const details = displayDetails(track);

  async function save() {
    if (!edit) return;
    setError(null);
    try {
      await edit.onSaveLabel(index, draft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o rótulo.');
    }
  }

  return (
    <div className={`track${playing ? ' is-playing' : ''}`}>
      <span className="track-pos" aria-hidden="true">
        {index + 1}
      </span>
      {track.thumbnailUrl ? (
        <img className="thumb" src={track.thumbnailUrl} alt="" loading="lazy" />
      ) : (
        <span className="thumb thumb-empty" aria-hidden="true">
          ♪
        </span>
      )}
      <div className="track-main">
        {editing ? (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <input
              aria-label="Rótulo da faixa"
              value={draft}
              maxLength={TRACK_LABEL_MAX}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={busy}>
              Salvar
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setDraft(track.label);
                setEditing(false);
                setError(null);
              }}
            >
              Cancelar
            </button>
            {error && <p className="error">{error}</p>}
          </form>
        ) : (
          <p className="track-name">{name}</p>
        )}
        <p className="track-details">
          <PlatformBadge platform={track.platform} /> {details}{' '}
          <a href={track.originalUrl} target="_blank" rel="noopener noreferrer" className="muted-link">
            link original
          </a>
        </p>
      </div>
      <div className="track-actions">
        <button
          type="button"
          onClick={onPlay}
          aria-pressed={playing}
          aria-label={`${playing ? 'Tocando' : 'Tocar'}: ${name}`}
        >
          {playing ? 'Tocando' : 'Tocar'}
        </button>
        {edit && (
          <>
            <button
              type="button"
              className="icon"
              onClick={() => edit.onMove(index, index - 1)}
              disabled={busy || index === 0}
              aria-label={`Subir: ${name}`}
            >
              ↑
            </button>
            <button
              type="button"
              className="icon"
              onClick={() => edit.onMove(index, index + 1)}
              disabled={busy || index === total - 1}
              aria-label={`Descer: ${name}`}
            >
              ↓
            </button>
            {!editing && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setDraft(track.label);
                  setEditing(true);
                }}
                aria-label={`Editar rótulo: ${name}`}
              >
                Rótulo
              </button>
            )}
            <button
              type="button"
              className="danger"
              onClick={() => edit.onDelete(index)}
              disabled={busy}
              aria-label={`Remover: ${name}`}
            >
              Remover
            </button>
          </>
        )}
      </div>
    </div>
  );
}
