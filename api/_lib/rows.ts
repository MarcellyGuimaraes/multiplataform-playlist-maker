// Conversão das linhas do banco (snake_case) para os formatos da API (camelCase).
import type { Platform } from '../../shared/parseTrackUrl.js';
import type { PlaylistDetail, PlaylistSummary, SharedTrack, Track } from '../../shared/types.js';

type Timestamp = string | Date;

export type PlaylistRow = {
  id: string;
  name: string;
  share_token: string;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type PlaylistSummaryRow = Pick<PlaylistRow, 'id' | 'name' | 'updated_at'> & { track_count: number | string };

export type TrackRow = {
  id: string;
  playlist_id: string;
  original_url: string;
  canonical_url: string;
  platform: Platform;
  external_id: string;
  label: string;
  position: number;
  meta_title: string | null;
  meta_artist: string | null;
  meta_thumbnail_url: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

const iso = (v: Timestamp) => new Date(v).toISOString();

export const toSummary = (r: PlaylistSummaryRow): PlaylistSummary => ({
  id: r.id,
  name: r.name,
  trackCount: Number(r.track_count),
  updatedAt: iso(r.updated_at),
});

export const toTrack = (r: TrackRow): Track => ({
  id: r.id,
  originalUrl: r.original_url,
  canonicalUrl: r.canonical_url,
  platform: r.platform,
  externalId: r.external_id,
  label: r.label,
  position: r.position,
  title: r.meta_title,
  artist: r.meta_artist,
  thumbnailUrl: r.meta_thumbnail_url,
  createdAt: iso(r.created_at),
});

export const toSharedTrack = (r: TrackRow): SharedTrack => {
  const { id: _id, createdAt: _createdAt, ...rest } = toTrack(r);
  return rest;
};

export const toPlaylist = (r: PlaylistRow, tracks: TrackRow[]): PlaylistDetail => ({
  id: r.id,
  name: r.name,
  shareToken: r.share_token,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
  tracks: tracks.map(toTrack),
});
