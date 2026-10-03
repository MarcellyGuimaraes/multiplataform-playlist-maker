// Cliente tipado da API. O front nunca fala com o banco: tudo passa por /api.
import type {
  ApiErrorBody,
  ApiErrorCode,
  PlaylistDetail,
  PlaylistSummary,
  SharedPlaylist,
  Track,
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
    throw new ApiError(res.status, err?.code ?? 'internal', err?.message ?? 'Erro inesperado. Tente novamente.');
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  listPlaylists: () => request<PlaylistSummary[]>('GET', '/playlists'),
  createPlaylist: (name: string) => request<PlaylistDetail>('POST', '/playlists', { name }),
  getPlaylist: (id: string) => request<PlaylistDetail>('GET', `/playlists/${enc(id)}`),
  renamePlaylist: (id: string, name: string) =>
    request<Omit<PlaylistDetail, 'tracks'>>('PATCH', `/playlists/${enc(id)}`, { name }),
  deletePlaylist: (id: string) => request<void>('DELETE', `/playlists/${enc(id)}`),
  regenerateShareToken: (id: string) =>
    request<{ shareToken: string }>('POST', `/playlists/${enc(id)}/share-token`),

  addTrack: (playlistId: string, url: string, label: string) =>
    request<Track>('POST', `/playlists/${enc(playlistId)}/tracks`, { url, label }),
  updateTrackLabel: (playlistId: string, trackId: string, label: string) =>
    request<Track>('PATCH', `/playlists/${enc(playlistId)}/tracks/${enc(trackId)}`, { label }),
  deleteTrack: (playlistId: string, trackId: string) =>
    request<void>('DELETE', `/playlists/${enc(playlistId)}/tracks/${enc(trackId)}`),
  reorderTracks: (playlistId: string, trackIds: string[]) =>
    request<void>('PUT', `/playlists/${enc(playlistId)}/tracks/order`, { trackIds }),

  getShared: (token: string) => request<SharedPlaylist>('GET', `/shared/${enc(token)}`),
};

/** URL pública de compartilhamento a partir do token. */
export const shareUrl = (token: string) => `${window.location.origin}/s/${token}`;
