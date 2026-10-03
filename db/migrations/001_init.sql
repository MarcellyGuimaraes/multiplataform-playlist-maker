-- Playlists e referências a faixas. Nunca há áudio aqui: só links, ids e metadados textuais.
create table playlists (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 100),
  share_token  text not null unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table tracks (
  id                 uuid primary key default gen_random_uuid(),
  playlist_id        uuid not null references playlists(id) on delete cascade,
  original_url       text not null check (char_length(original_url) <= 2048),
  canonical_url      text not null check (char_length(canonical_url) <= 2048),
  platform           text not null check (platform in ('youtube', 'spotify', 'soundcloud')),
  external_id        text not null,
  label              text not null default '' check (char_length(label) <= 200),
  position           integer not null check (position >= 0),
  meta_title         text,
  meta_artist        text,
  meta_thumbnail_url text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index tracks_playlist_position on tracks (playlist_id, position);
