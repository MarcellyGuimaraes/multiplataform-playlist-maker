import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Cabeçalho global: "Entrar" para visitantes; e-mail e "Sair" para quem está logada. */
export function SiteHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function exit() {
    setError(null);
    try {
      await logout();
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível sair.');
    }
  }

  return (
    <header className="site-header">
      <Link to="/" className="site-title">
        Playlist Multiplataforma
      </Link>
      {user === undefined ? null : user ? (
        <div className="site-account">
          <span className="muted">{user.email}</span>
          <button type="button" className="secondary" onClick={exit}>
            Sair
          </button>
        </div>
      ) : (
        <Link to="/entrar" className="site-account">
          Entrar
        </Link>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}
