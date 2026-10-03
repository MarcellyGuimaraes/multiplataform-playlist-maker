# Proposal

## Why

Nenhuma plataforma de streaming cobre todo o gosto musical da usuária: versões ao vivo existem só no YouTube, artistas pequenos só no SoundCloud e o restante está no Spotify. Falta um lugar único para montar playlists que misturem faixas das três plataformas e compartilhá-las por link — sem hospedar áudio, mantendo o app legal, barato e dentro dos termos de uso de cada plataforma.

## What Changes

- Novo app web (projeto greenfield) para uso pessoal, composto por SPA em React + camada fina de API serverless + banco Neon Postgres.
- Criar, nomear, renomear e listar playlists.
- Adicionar faixas colando um link do YouTube, Spotify ou SoundCloud; a API detecta a plataforma, extrai o identificador externo e rejeita links não suportados.
- Rótulo livre por faixa (para distinguir versões), além de metadados em cache (título, artista, thumbnail) capturados via oEmbed público no momento da adição, preservados mesmo se o link quebrar na origem.
- Listar, reordenar e remover faixas de uma playlist.
- Reprodução de cada faixa pelo player embutido oficial da sua plataforma (iframe), dentro do app, uma faixa por vez, sem autoplay contínuo.
- Link público de compartilhamento por token aleatório, com visualização somente leitura.
- Princípios invioláveis: o sistema nunca hospeda, baixa, armazena ou redistribui áudio; não usa APIs de dados restritas/pagas (Spotify Web API, SoundCloud API) para busca; não contorna a limitação de prévia de 30 s do embed do Spotify para ouvintes não logados.
- A connection string do Neon fica apenas no servidor; o front fala exclusivamente com a API.

**Fora do escopo (melhorias futuras):** autenticação de usuário, proteção de edição por dono, reprodução contínua/autoplay via SDKs de player, busca de músicas, playlists colaborativas.

## Capabilities

### New Capabilities
- `playlist-management`: criação, nomeação, listagem, renomeação e exclusão de playlists.
- `track-links`: adição de faixas por link com detecção de plataforma, extração do identificador, rótulo livre, metadados em cache, listagem, reordenação e remoção.
- `embedded-playback`: reprodução de faixas pelos players embutidos oficiais de YouTube, Spotify e SoundCloud, incluindo o tratamento de faixas indisponíveis e a ressalva da prévia do Spotify.
- `playlist-sharing`: geração de link público por token e visualização somente leitura da playlist compartilhada.

### Modified Capabilities
<!-- Nenhuma: projeto novo, sem specs existentes. -->

## Impact

- **Código:** repositório novo — front (Vite + React + TypeScript), funções serverless em `/api` (Vercel), módulo compartilhado de parsing de URLs, migrações SQL.
- **APIs novas:** endpoints REST para playlists e faixas, e um endpoint público de leitura por token de compartilhamento.
- **Dependências externas:** Neon Postgres (plano gratuito), Vercel (plano Hobby), driver `@neondatabase/serverless`, endpoints oEmbed públicos de YouTube, Spotify e SoundCloud (sem chave de API).
- **Segurança:** sem autenticação no MVP — qualquer pessoa com a URL do app e o id de uma playlist pode editá-la; o link público expõe apenas o token de compartilhamento, nunca o id interno. Risco aceito conscientemente para uso pessoal.
- **Custos:** tudo deve caber nos níveis gratuitos de Neon e Vercel.
