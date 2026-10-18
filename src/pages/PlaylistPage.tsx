import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PLAYLIST_NAME_MAX } from '../../shared/limits';
import { playlistNameSchema } from '../../shared/schemas';
import type { PlaylistDetail, Track, Visibility } from '../../shared/types';
import { NotFound } from '../App';
import { ApiError, api, isUnauthorized, shareUrl } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AddTrackForm } from '../components/AddTrackForm';
import { PlayerPanel } from '../components/PlayerPanel';
import { SortableItem, SortableTracks } from '../components/SortableTracks';
import { TrackList } from '../components/TrackList';
import { displayName } from '../embed';
import { usePlayback } from '../player/usePlayback';

const withPositions = (tracks: Track[]) => tracks.map((t, position) => ({ ...t, position }));

export function PlaylistPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const playback = usePlayback(playlist ? playlist.tracks.map((t) => t.id) : [], {
    youtubeAltFor: (trackId) => playlist?.tracks.find((t) => t.id === trackId)?.youtubeAltId ?? null,
  });
  const { forget } = useAuth();

  /** Sem sessão (ou sessão expirada): vai para o login e volta para cá depois. */
  const toLogin = useCallback(() => {
    forget();
    navigate(`/entrar?voltar=${encodeURIComponent(`/p/${id}`)}`, { replace: true });
  }, [forget, navigate, id]);

  const load = useCallback(async () => {
    try {
      setPlaylist(await api.getPlaylist(id));
    } catch (e) {
      if (isUnauthorized(e)) toLogin();
      else if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError(e instanceof Error ? e.message : 'Erro ao carregar a playlist.');
    }
  }, [id, toLogin]);

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
      if (isUnauthorized(e)) return toLogin();
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
  const currentIndex = tracks.findIndex((t) => t.id === playback.currentId);
  const current = currentIndex >= 0 ? tracks[currentIndex] : null;

  /** Para ações cujo erro aparece no próprio formulário: 401 ainda leva ao login. */
  async function orLogin<T>(action: Promise<T>): Promise<T> {
    try {
      return await action;
    } catch (e) {
      if (isUnauthorized(e)) toLogin();
      throw e;
    }
  }

  async function addTrack(url: string, label: string) {
    const track = await orLogin(api.addTrack(id, url, label));
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
    });
  }

  async function saveLabel(index: number, label: string) {
    const updated = await orLogin(api.updateTrackLabel(id, tracks[index].id, label));
    setTracks(tracks.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function saveYoutubeAlt(index: number, url: string | null) {
    const updated = await orLogin(api.updateTrack(id, tracks[index].id, { youtubeAlt: url }));
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
        onSetVisibility={(visibility) =>
          mutate(async () => {
            const updated = await api.setVisibility(id, visibility);
            setPlaylist((p) => (p ? { ...p, visibility: updated.visibility, shareToken: updated.shareToken } : p));
          })
        }
      />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <AddTrackForm onAdd={addTrack} />

      <PlayerPanel track={current} playback={playback} ownerView />

      <SortableTracks ids={tracks.map((t) => t.id)} disabled={busy} onMove={move}>
        <TrackList
          tracks={tracks}
          currentIndex={currentIndex >= 0 ? currentIndex : null}
          onPlay={(i) => playback.play(tracks[i].id)}
          itemKey={(t) => t.id}
          busy={busy}
          edit={{ onMove: move, onDelete: remove, onSaveLabel: saveLabel, onSaveYoutubeAlt: saveYoutubeAlt }}
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
  onSetVisibility: (visibility: Visibility) => Promise<void>;
};

function PlaylistHeader({ playlist, busy, onRename, onDelete, onRegenerate, onSetVisibility }: HeaderProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(playlist.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  // Só playlist pública tem link; privada não oferece nada para copiar.
  const link = playlist.visibility === 'public' && playlist.shareToken ? shareUrl(playlist.shareToken) : null;

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
    if (!link) return;
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
        <p className="grow visibility-status">
          <span className={`visibility-badge is-${playlist.visibility}`}>
            {playlist.visibility === 'public' ? 'Pública' : 'Privada'}
          </span>{' '}
          <span className="muted">
            {playlist.visibility === 'public'
              ? 'Aparece na tela inicial e pode ser aberta por quem tiver o link.'
              : 'Só você vê esta playlist.'}
          </span>
        </p>
        {playlist.visibility === 'public' ? (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Tornar a playlist privada? O link público atual deixará de funcionar.')) {
                setCopyStatus(null);
                void onSetVisibility('private');
              }
            }}
          >
            Tornar privada
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void onSetVisibility('public')}>
            Tornar pública
          </button>
        )}

        {link && (
          <>
            <label className="share-link">
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
          </>
        )}
      </div>
    </header>
  );
}
