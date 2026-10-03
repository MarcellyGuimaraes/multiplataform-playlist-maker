// Formatos das respostas da API, compartilhados entre servidor e front.
import type { Platform } from './parseTrackUrl.js';

export type PlaylistSummary = {
  id: string;
  name: string;
  trackCount: number;
  updatedAt: string;
};

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
  createdAt: string;
};

export type PlaylistDetail = {
  id: string;
  name: string;
  shareToken: string;
  createdAt: string;
  updatedAt: string;
  tracks: Track[];
};

/** Faixa na visualização pública: sem nenhum identificador interno. */
export type SharedTrack = Omit<Track, 'id' | 'createdAt'>;

/** Playlist na visualização pública: sem id interno nem token. */
export type SharedPlaylist = { name: string; tracks: SharedTrack[] };

export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };

export type ApiErrorCode = 'validation' | 'not_found' | 'conflict' | 'method_not_allowed' | 'internal';
