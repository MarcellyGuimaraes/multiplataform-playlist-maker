// Formatos das respostas da API, compartilhados entre servidor e front.
import type { Platform } from './parseTrackUrl.js';

export type Visibility = 'public' | 'private';

/** Playlist da própria conta na listagem. Só pública tem token. */
export type PlaylistSummary = {
  id: string;
  name: string;
  trackCount: number;
  updatedAt: string;
  visibility: Visibility;
  shareToken: string | null;
};

/** Playlist pública de outra conta na listagem: sem id interno e sem dados da dona. */
export type PublicPlaylistSummary = {
  name: string;
  trackCount: number;
  updatedAt: string;
  shareToken: string;
};

/** GET /api/playlists. Para visitantes, `mine` é vazio; `public` exclui as da própria sessão. */
export type PlaylistList = { mine: PlaylistSummary[]; public: PublicPlaylistSummary[] };

export type Track = {
  id: string;
  originalUrl: string;
  canonicalUrl: string;
  platform: Platform;
  externalId: string;
  label: string;
  position: number;
  title: string | null;
  artist: string | null;
  thumbnailUrl: string | null;
  /** Id do vídeo do YouTube cadastrado como versão alternativa. Só faixas do Spotify têm. */
  youtubeAltId: string | null;
  createdAt: string;
};

export type PlaylistDetail = {
  id: string;
  name: string;
  visibility: Visibility;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
  tracks: Track[];
};

/** Faixa na visualização pública: sem nenhum identificador interno. */
export type SharedTrack = Omit<Track, 'id' | 'createdAt'>;

/** Playlist na visualização pública: sem id interno nem token. */
export type SharedPlaylist = { name: string; tracks: SharedTrack[] };

/** Conta logada, como a API a expõe: nunca inclui senha nem hash. */
export type AuthUser = { id: string; email: string };

export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };

export type ApiErrorCode = 'validation' | 'unauthorized' | 'not_found' | 'conflict' | 'method_not_allowed' | 'internal';
