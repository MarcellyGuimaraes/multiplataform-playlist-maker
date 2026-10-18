// Cliente tipado da API. O front nunca fala com o banco: tudo passa por /api.
// O cookie de sessão é HttpOnly e vai sozinho (fetch usa credentials: 'same-origin' por padrão).
import type {
  ApiErrorBody,
  ApiErrorCode,
  AuthUser,
  PlaylistDetail,
  PlaylistList,
  SharedPlaylist,
  Track,
  Visibility,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'network',
    message: string,
  ) {
    super(message);
  }
}

/** Sessão ausente ou expirada: a tela deve levar ao login. */
export const isUnauthorized = (e: unknown): e is ApiError => e instanceof ApiError && e.status === 401;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network', 'Sem conexão com o servidor. Verifique sua internet e tente de novo.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    if (res.status === 401) {
      throw new ApiError(401, 'unauthorized', err?.message ?? 'Entre na sua conta para continuar.');
    }
    throw new ApiError(res.status, err?.code ?? 'internal', err?.message ?? 'Erro inesperado. Tente novamente.');
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  me: () => request<{ user: AuthUser | null }>('GET', '/auth/me'),
  signup: (email: string, password: string) =>
    request<{ user: AuthUser }>('POST', '/auth/signup', { email, password }),
  login: (email: string, password: string) => request<{ user: AuthUser }>('POST', '/auth/login', { email, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  requestPasswordReset: (email: string) => request<{ message: string }>('POST', '/auth/password-reset', { email }),
  confirmPasswordReset: (token: string, password: string) =>
    request<void>('POST', '/auth/password-reset/confirm', { token, password }),

  listPlaylists: () => request<PlaylistList>('GET', '/playlists'),
  createPlaylist: (name: string) => request<PlaylistDetail>('POST', '/playlists', { name }),
  getPlaylist: (id: string) => request<PlaylistDetail>('GET', `/playlists/${enc(id)}`),
  renamePlaylist: (id: string, name: string) =>
    request<Omit<PlaylistDetail, 'tracks'>>('PATCH', `/playlists/${enc(id)}`, { name }),
  deletePlaylist: (id: string) => request<void>('DELETE', `/playlists/${enc(id)}`),
  setVisibility: (id: string, visibility: Visibility) =>
    request<Omit<PlaylistDetail, 'tracks'>>('PUT', `/playlists/${enc(id)}/visibility`, { visibility }),
  regenerateShareToken: (id: string) =>
    request<{ shareToken: string }>('POST', `/playlists/${enc(id)}/share-token`),

  addTrack: (playlistId: string, url: string, label: string) =>
    request<Track>('POST', `/playlists/${enc(playlistId)}/tracks`, { url, label }),
  /** Edita rótulo e/ou versão no YouTube (link para cadastrar ou trocar, null para remover). */
  updateTrack: (playlistId: string, trackId: string, patch: { label?: string; youtubeAlt?: string | null }) =>
    request<Track>('PATCH', `/playlists/${enc(playlistId)}/tracks/${enc(trackId)}`, patch),
  updateTrackLabel: (playlistId: string, trackId: string, label: string) =>
    api.updateTrack(playlistId, trackId, { label }),
  deleteTrack: (playlistId: string, trackId: string) =>
    request<void>('DELETE', `/playlists/${enc(playlistId)}/tracks/${enc(trackId)}`),
  reorderTracks: (playlistId: string, trackIds: string[]) =>
    request<void>('PUT', `/playlists/${enc(playlistId)}/tracks/order`, { trackIds }),

  getShared: (token: string) => request<SharedPlaylist>('GET', `/shared/${enc(token)}`),
};

/** URL pública de compartilhamento a partir do token. */
export const shareUrl = (token: string) => `${window.location.origin}/s/${token}`;
