import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PLAYLIST_NAME_MAX } from '../../shared/limits';
import { playlistNameSchema } from '../../shared/schemas';
import type { PlaylistList, PlaylistSummary, PublicPlaylistSummary } from '../../shared/types';
import { api, isUnauthorized } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const trackCount = (n: number) => `${n} ${n === 1 ? 'faixa' : 'faixas'}`;

/**
 * Tela inicial conforme a sessão. Visitante: só as playlists públicas, abertas pelo link público.
 * Logada: "Minhas playlists" (com o selo de visibilidade) e, abaixo, as públicas das outras contas.
 */
export function HomePage() {
  const { user, forget } = useAuth();
  const [list, setList] = useState<PlaylistList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (user === undefined) return;
    let active = true;
    setList(null);
    setLoadError(null);
    api
      .listPlaylists()
      .then((l) => active && setList(l))
      .catch((e: Error) => active && setLoadError(e.message));
    return () => {
      active = false;
    };
  }, [user]);

  const loading = user === undefined || (!list && !loadError);

  return (
    <main className="page">
      <header className="page-header">
        <h1>{user ? 'Minhas playlists' : 'Playlists públicas'}</h1>
        <p className="muted">YouTube, Spotify e SoundCloud no mesmo lugar.</p>
      </header>

      {user ? (
        <CreateForm onUnauthorized={forget} />
      ) : (
        user === null && (
          <div className="card inline-form">
            <span className="grow">Quer montar a sua? Entre para criar playlists.</span>
            <Link to="/entrar?voltar=%2F" className="button">
              Criar playlist
            </Link>
          </div>
        )
      )}

      {loadError && (
        <p className="error" role="alert">
          {loadError}
        </p>
      )}
      {loading && !loadError && <p className="muted">Carregando…</p>}

      {list && user && (
        <>
          {list.mine.length === 0 ? (
            <div className="empty">Você ainda não tem playlists. Crie a primeira acima.</div>
          ) : (
            <MineList playlists={list.mine} />
          )}
          <section className="home-section" aria-labelledby="public-heading">
            <h2 id="public-heading">Públicas de outras pessoas</h2>
            {list.public.length === 0 ? (
              <div className="empty">Ainda não há playlists públicas de outras pessoas.</div>
            ) : (
              <PublicList playlists={list.public} />
            )}
          </section>
        </>
      )}

      {list && user === null &&
        (list.public.length === 0 ? (
          <div className="empty">
            Ainda não há playlists públicas. <Link to="/entrar">Entre</Link> ou <Link to="/cadastro">crie uma conta</Link>{' '}
            para montar a sua.
          </div>
        ) : (
          <PublicList playlists={list.public} />
        ))}
    </main>
  );
}

function CreateForm({ onUnauthorized }: { onUnauthorized: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
      if (isUnauthorized(err)) {
        onUnauthorized();
        navigate('/entrar?voltar=%2F');
        return;
      }
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar a playlist.');
      setCreating(false);
    }
  }

  return (
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
  );
}

function MineList({ playlists }: { playlists: PlaylistSummary[] }) {
  return (
    <ul className="playlist-list">
      {playlists.map((p) => (
        <li key={p.id}>
          <Link to={`/p/${p.id}`} className="card playlist-link">
            <span className="track-name">{p.name}</span>
            <span className="playlist-meta">
              <span className={`visibility-badge is-${p.visibility}`}>
                {p.visibility === 'public' ? 'Pública' : 'Privada'}
              </span>
              <span className="muted">{trackCount(p.trackCount)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PublicList({ playlists }: { playlists: PublicPlaylistSummary[] }) {
  return (
    <ul className="playlist-list">
      {playlists.map((p) => (
        <li key={p.shareToken}>
          <Link to={`/s/${p.shareToken}`} className="card playlist-link">
            <span className="track-name">{p.name}</span>
            <span className="muted">{trackCount(p.trackCount)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
