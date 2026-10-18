-- Versão no YouTube de uma faixa do Spotify, cadastrada pela dona. Guarda só o id do vídeo.
-- Aditiva: o código antigo ignora a coluna.
alter table tracks
  add column youtube_alt_id text
    check (youtube_alt_id ~ '^[A-Za-z0-9_-]{11}$'),
  add constraint tracks_youtube_alt_only_spotify
    check (youtube_alt_id is null or platform = 'spotify');
