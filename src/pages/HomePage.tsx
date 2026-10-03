import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PLAYLIST_NAME_MAX } from '../../shared/limits';
import { playlistNameSchema } from '../../shared/schemas';
import type { PlaylistSummary } from '../../shared/types';
import { api } from '../api/client';

export function HomePage() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<PlaylistSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .listPlaylists()
      .then(setPlaylists)
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const parsed = playlistNameSchema.safeParse({ name });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0].message);
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const playlist = await api.createPlaylist(parsed.data.name);
      navigate(`/p/${playlist.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar a playlist.');
      setCreating(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Minhas playlists</h1>
        <p className="muted">YouTube, Spotify e SoundCloud no mesmo lugar.</p>
      </header>

      <form className="card inline-form" onSubmit={create} noValidate>
        <label className="grow">
          Nova playlist
          <input
            type="text"
            placeholder="Nome da playlist"
            value={name}
            maxLength={PLAYLIST_NAME_MAX + 20}
            onChange={(e) => {
              setName(e.target.value);
              setFormError(null);
            }}
            aria-invalid={formError ? true : undefined}
            aria-describedby="create-error"
          />
        </label>
        <button type="submit" disabled={creating}>
          {creating ? 'Criando…' : 'Criar'}
        </button>
        <p id="create-error" className="error" role="alert">
          {formError}
        </p>
      </form>

      {loadError && (
        <p className="error" role="alert">
          {loadError}
        </p>
      )}
      {!playlists && !loadError && <p className="muted">Carregando…</p>}
      {playlists?.length === 0 && (
        <div className="empty">Você ainda não tem playlists. Crie a primeira acima.</div>
      )}
      {playlists && playlists.length > 0 && (
        <ul className="playlist-list">
          {playlists.map((p) => (
            <li key={p.id}>
              <Link to={`/p/${p.id}`} className="card playlist-link">
                <span className="track-name">{p.name}</span>
                <span className="muted">
                  {p.trackCount} {p.trackCount === 1 ? 'faixa' : 'faixas'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
