import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '../../shared/types';
import { api } from '../api/client';

type AuthState = {
  /** undefined enquanto a sessão carrega; null para visitante. */
  user: AuthUser | null | undefined;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Marca a sessão como encerrada (ex.: a API respondeu 401). */
  forget: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/** Carrega a sessão atual (GET /api/auth/me) na montagem e expõe login, cadastro e logout. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((r) => active && setUser(r.user))
      .catch(() => active && setUser(null));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser((await api.login(email, password)).user);
  }, []);
  const signup = useCallback(async (email: string, password: string) => {
    setUser((await api.signup(email, password)).user);
  }, []);
  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);
  const forget = useCallback(() => setUser(null), []);

  const value = useMemo(() => ({ user, login, signup, logout, forget }), [user, login, signup, logout, forget]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}
