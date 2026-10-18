# Tasks

## 1. Dados e API

- [x] 1.1 Criar `db/migrations/003_youtube_alternative.sql` (coluna `youtube_alt_id` com check do formato e constraint "só Spotify"), adicionar `youtubeAltId` a `Track`/`SharedTrack` em `shared/types.ts` e ao `TrackRow`/`toTrack` em `api/_lib/rows.ts`; verificar com `npx vitest run tests/api` passando (os testes usam PGlite com as migrações reais) e um teste em `tests/api/tracks.test.ts` mostrando `youtubeAltId: null` numa faixa nova.
- [x] 1.2 Estender `updateTrackSchema` (`label?`, `youtubeAlt?: string | null`, ao menos um) e o `PATCH` de faixa conforme a decisão 2 do design; cobrir em `shared/schemas.test.ts` e `tests/api/tracks.test.ts`: cadastrar com `youtu.be/…` e com `youtube.com/watch?v=…`, trocar, remover com `null`, rótulo intacto ao mexer na versão e vice-versa, link do SoundCloud e playlist do YouTube rejeitados (400), faixa do YouTube/SoundCloud rejeitada (400); e em `tests/api/ownership.test.ts`: outra conta → 404 sem alteração.
- [x] 1.3 Verificar em `tests/api/shared.test.ts` que a resposta pública inclui `youtubeAltId` e continua sem `id` de faixa; rodar `npx vitest run tests/api shared`.
- [x] 1.4 Aplicar a migração no Neon de desenvolvimento com `npm run db:migrate` (lendo o `.env`) e verificar que `schema_migrations` registra `003_youtube_alternative`.

## 2. Edição pela dona

- [x] 2.1 Adicionar `api.updateTrack(playlistId, trackId, patch)` em `src/api/client.ts` (com `updateTrackLabel` passando a usá-lo), `onSaveYoutubeAlt` em `TrackEditActions` e a interface da decisão 3 em `TrackList` (só para faixa do Spotify com `edit`), ligada na `PlaylistPage`; cobrir em `tests/ui/flows.test.tsx` (ou teste de componente): cadastrar, ver o link "Versão no YouTube", trocar, remover, erro de validação exibido e nenhum controle na visualização compartilhada nem em faixa do YouTube.

## 3. Troca no player

- [x] 3.1 Implementar em `usePlayback` a decisão 4 (`youtubeAltFor`, `source` no `LoadRequest`, `preferYoutube`, `noSwitchFor`, `backToSpotify`) e passar `youtubeAltFor` nas duas páginas; cobrir em `usePlayback.test.ts`: prévia com alternativa troca a fonte e emite novo pedido do mesmo id; prévia sem alternativa só liga `preview`; faixa seguinte com alternativa começa pelo YouTube; `onPreview(false)` e `backToSpotify` desligam a preferência; depois de voltar, nova prévia na mesma faixa não troca; fim e erro com `source = 'youtube'` avançam/pulam como antes; detector de bloqueio armado na troca.
- [x] 3.2 Implementar no `EmbedPlayer` a faixa efetiva e o aviso "Tocando pelo YouTube" com "Voltar ao Spotify" (decisão 5), e `ownerView` com a sugestão para a dona (decisão 6) via `PlayerPanel`; cobrir em `components.test.tsx` com as fábricas falsas: troca destrói o Spotify e monta o YouTube com o id alternativo; metadados e link do Spotify continuam; botão chama `backToSpotify`; sugestão só com `ownerView`.

## 4. Documentação e verificação

- [x] 4.1 Atualizar o `README.md` (seção do Spotify e limitações): como cadastrar a versão no YouTube, quando o player troca sozinho, "Voltar ao Spotify" e a migração 003 no roteiro de banco.
- [x] 4.2 Rodar `npm run build` e `npx vitest run` e verificar que terminam sem erros.
- [x] 4.3 Com `npm run dev` (Neon de desenvolvimento migrado), num navegador sem login no Spotify: cadastrar uma versão no YouTube numa faixa do Spotify, tocar a playlist e verificar que o player troca para o YouTube, mostra o aviso, toca completa e avança ao fim; "Voltar ao Spotify" volta à prévia com o aviso por navegador; uma segunda faixa do Spotify com versão começa direto pelo YouTube; o link público faz a mesma troca; faixa sem versão mostra o aviso com a sugestão só para a dona. Encerrar o servidor de dev ao terminar.
- [x] 4.4 Com login no Spotify (Chrome), tocar a mesma playlist e verificar que a faixa toca completa pelo Spotify, sem troca para o YouTube. Encerrar o servidor de dev ao terminar.
