import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { SharedPlaylist } from '../../shared/types';
import { NotFound } from '../App';
import { ApiError, api } from '../api/client';
import { PlayerPanel } from '../components/PlayerPanel';
import { TrackList } from '../components/TrackList';
import { usePlayback } from '../player/usePlayback';

// A resposta pública não tem ids de faixa: a posição serve de chave na fila.
const keyOf = (position: number) => String(position);

/** Visualização pública: só leitura e reprodução, sem nenhum controle de edição. */
export function SharedPage() {
  const { token = '' } = useParams();
  const [playlist, setPlaylist] = useState<SharedPlaylist | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playback = usePlayback(playlist ? playlist.tracks.map((t) => keyOf(t.position)) : []);

  useEffect(() => {
    api
      .getShared(token)
      .then(setPlaylist)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : 'Erro ao carregar a playlist.');
      });
  }, [token]);

  if (notFound) return <NotFound message="Playlist não encontrada." />;
  if (!playlist) {
    return (
      <main className="page">
        {error ? <p className="error" role="alert">{error}</p> : <p className="muted">Carregando…</p>}
      </main>
    );
  }

  const index = playlist.tracks.findIndex((t) => keyOf(t.position) === playback.currentId);
  const current = index >= 0 ? playlist.tracks[index] : null;

  return (
    <main className="page">
      <header className="page-header">
        <h1>{playlist.name}</h1>
        <p className="muted">
          Playlist compartilhada · {playlist.tracks.length} {playlist.tracks.length === 1 ? 'faixa' : 'faixas'}
        </p>
      </header>
      <PlayerPanel track={current} playback={playback} />
      <TrackList
        tracks={playlist.tracks}
        currentIndex={index >= 0 ? index : null}
        onPlay={(i) => playback.play(keyOf(playlist.tracks[i].position))}
        emptyState="Esta playlist ainda não tem faixas."
      />
    </main>
  );
}
