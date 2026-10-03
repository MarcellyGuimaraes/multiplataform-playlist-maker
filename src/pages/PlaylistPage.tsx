import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PLAYLIST_NAME_MAX } from '../../shared/limits';
import { playlistNameSchema } from '../../shared/schemas';
import type { PlaylistDetail, Track } from '../../shared/types';
import { NotFound } from '../App';
import { ApiError, api, shareUrl } from '../api/client';
import { AddTrackForm } from '../components/AddTrackForm';
import { EmbedPlayer } from '../components/EmbedPlayer';
import { SortableItem, SortableTracks } from '../components/SortableTracks';
import { TrackList } from '../components/TrackList';
import { displayName } from '../embed';

const withPositions = (tracks: Track[]) => tracks.map((t, position) => ({ ...t, position }));

export function PlaylistPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPlaylist(await api.getPlaylist(id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError(e instanceof Error ? e.message : 'Erro ao carregar a playlist.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Executa uma mutação mostrando o erro; em caso de falha recarrega o estado do servidor. */
  async function mutate(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A operação falhou.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (notFound) return <NotFound message="Playlist não encontrada." />;
  if (!playlist) {
    return (
      <main className="page">
        {error ? <p className="error" role="alert">{error}</p> : <p className="muted">Carregando…</p>}
      </main>
    );
  }

  const tracks = playlist.tracks;
  const setTracks = (next: Track[]) => setPlaylist((p) => (p ? { ...p, tracks: withPositions(next) } : p));
  const currentIndex = tracks.findIndex((t) => t.id === currentId);
  const current = currentIndex >= 0 ? tracks[currentIndex] : null;

  async function addTrack(url: string, label: string) {
    const track = await api.addTrack(id, url, label);
    setPlaylist((p) => (p ? { ...p, tracks: [...p.tracks, track] } : p));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= tracks.length || from === to) return;
    const next = [...tracks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setTracks(next); // otimista; em erro, mutate() recarrega do servidor
    void mutate(() => api.reorderTracks(id, next.map((t) => t.id)));
  }

  function remove(index: number) {
    const track = tracks[index];
    void mutate(async () => {
      await api.deleteTrack(id, track.id);
      setTracks(tracks.filter((t) => t.id !== track.id));
      if (track.id === currentId) setCurrentId(null);
    });
  }

  async function saveLabel(index: number, label: string) {
    const updated = await api.updateTrackLabel(id, tracks[index].id, label);
    setTracks(tracks.map((t) => (t.id === updated.id ? updated : t)));
  }

  return (
    <main className="page">
      <p>
        <Link to="/">← Minhas playlists</Link>
      </p>
      <PlaylistHeader
        playlist={playlist}
        busy={busy}
        onRename={(name) =>
          mutate(async () => {
            const updated = await api.renamePlaylist(id, name);
            setPlaylist((p) => (p ? { ...p, name: updated.name } : p));
          })
        }
        onDelete={() =>
          mutate(async () => {
            await api.deletePlaylist(id);
            navigate('/');
          })
        }
        onRegenerate={() =>
          mutate(async () => {
            const { shareToken } = await api.regenerateShareToken(id);
            setPlaylist((p) => (p ? { ...p, shareToken } : p));
          })
        }
      />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <AddTrackForm onAdd={addTrack} />

      {current && <EmbedPlayer track={current} />}

      <SortableTracks ids={tracks.map((t) => t.id)} disabled={busy} onMove={move}>
        <TrackList
          tracks={tracks}
          currentIndex={currentIndex >= 0 ? currentIndex : null}
          onPlay={(i) => setCurrentId(tracks[i].id)}
          itemKey={(t) => t.id}
          busy={busy}
          edit={{ onMove: move, onDelete: remove, onSaveLabel: saveLabel }}
          renderItem={(track, _i, content, key) => (
            <SortableItem key={key} id={track.id} label={displayName(track)}>
              {content}
            </SortableItem>
          )}
          emptyState="Esta playlist ainda não tem faixas. Cole um link acima para adicionar a primeira."
        />
      </SortableTracks>
    </main>
  );
}

type HeaderProps = {
  playlist: PlaylistDetail;
  busy: boolean;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onRegenerate: () => Promise<void>;
};

function PlaylistHeader({ playlist, busy, onRename, onDelete, onRegenerate }: HeaderProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(playlist.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const link = shareUrl(playlist.shareToken);

  async function submitRename(e: FormEvent) {
    e.preventDefault();
    const parsed = playlistNameSchema.safeParse({ name: draft });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0].message);
      return;
    }
    await onRename(parsed.data.name);
    setRenaming(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus('Link copiado!');
    } catch {
      setCopyStatus('Não foi possível copiar automaticamente. Selecione o link acima e copie.');
    }
  }

  return (
    <header className="page-header">
      {renaming ? (
        <form className="inline-form" onSubmit={submitRename} noValidate>
          <input
            aria-label="Nome da playlist"
            value={draft}
            maxLength={PLAYLIST_NAME_MAX + 20}
            onChange={(e) => {
              setDraft(e.target.value);
              setNameError(null);
            }}
            autoFocus
          />
          <button type="submit" disabled={busy}>
            Salvar
          </button>
          <button type="button" className="secondary" onClick={() => setRenaming(false)}>
            Cancelar
          </button>
          {nameError && (
            <p className="error" role="alert">
              {nameError}
            </p>
          )}
        </form>
      ) : (
        <div className="title-row">
          <h1>{playlist.name}</h1>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setDraft(playlist.name);
              setRenaming(true);
            }}
          >
            Renomear
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Excluir a playlist "${playlist.name}" e todas as suas faixas? Isso não pode ser desfeito.`)) {
                void onDelete();
              }
            }}
          >
            Excluir
          </button>
        </div>
      )}

      <div className="share card">
        <label className="grow">
          Link público (somente leitura)
          <input type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </label>
        <button type="button" onClick={copy}>
          Copiar link público
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            if (window.confirm('Gerar um novo link público? O link atual deixará de funcionar.')) {
              setCopyStatus(null);
              void onRegenerate();
            }
          }}
        >
          Gerar novo link
        </button>
        <p className="hint ok" aria-live="polite">
          {copyStatus ?? ' '}
        </p>
      </div>
    </header>
  );
}
