-- Contas, sessões, redefinição de senha, dona e visibilidade das playlists.
-- DESTRUTIVA: as playlists e faixas existentes não têm dona e são apagadas.
delete from tracks;
delete from playlists;

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- Só o sha256 do valor do cookie é guardado: se a tabela vazar, os valores não servem como cookie.
create table sessions (
  token_hash  text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create table password_resets (
  token_hash  text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz
);

alter table playlists
  add column owner_id uuid not null references users(id) on delete cascade,
  add column visibility text not null default 'private' check (visibility in ('public', 'private')),
  alter column share_token drop not null,
  -- Pública sempre tem link; privada nunca tem.
  add constraint playlists_visibility_token check ((visibility = 'public') = (share_token is not null));

create index playlists_owner_updated on playlists (owner_id, updated_at desc);
create index playlists_public_updated on playlists (updated_at desc) where visibility = 'public';
