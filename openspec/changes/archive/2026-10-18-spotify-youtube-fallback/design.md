# Design

## Context

- **Prévia do Spotify:** a change arquivada `2026-10-18-spotify-preview-hint` deixou o adaptador do Spotify emitindo `onPreview(true|false)` a partir do primeiro `playback_update` com duração (≤ 30 s = prévia). Ele emite de novo quando a classificação muda. `usePlayback` guarda `preview`, e o `EmbedPlayer` mostra o aviso por navegador (`spotifyPreviewHint`).
- **Player:** `usePlayback` emite `LoadRequest { id, autoplay, nonce }`. O `EmbedPlayer` lê a faixa atual (`trackRef`), reaproveita o player quando a plataforma é a mesma e, quando muda, destrói o anterior e monta o novo (`mountPlayer`). Ele repassa os eventos por um wrapper estável (`stableEvents`). O adaptador do YouTube carrega por `externalId` (`loadVideoById`).
- **Dados:** a tabela `tracks` guarda plataforma, `external_id`, URL original e canônica, rótulo e metadados. O `PATCH /api/playlists/:id/tracks/:trackId` só edita o rótulo, filtra pela dona (`owner_id`) e usa `updateTrackSchema`. A rota pública `api/shared/[token].ts` faz `select *` e converte com `toSharedTrack`. `parseTrackUrl` (em `shared/`) já valida links do YouTube e rejeita playlists e outros formatos.
- **Testes:** os handlers rodam contra PGlite em `tests/api/*.test.ts` (com `tracks.test.ts`, `ownership.test.ts`, `shared.test.ts`). A interface roda em jsdom em `src/components/components.test.tsx` e `tests/ui/*.test.tsx`. O player tem testes em `src/player/*.test.ts`.
- **Decisões da dona do projeto:** o vídeo alternativo é **colado manualmente pela dona**, sem busca nem API. Quando o Spotify só der a prévia, o player **troca sozinho** para o YouTube.

## Goals / Non-Goals

**Goals:**
- Faixa do Spotify com versão no YouTube toca completa em qualquer navegador, sem login e sem sair do app.
- Cadastro simples, só para a dona, sem chave de API nem chamada nova do servidor a plataformas.
- Na troca, a fila, o autoplay e o tratamento de erro continuam funcionando.

**Non-Goals:**
- Busca automática de vídeos (YouTube Data API) ou sugestões.
- Versões alternativas para faixas que não são do Spotify, ou troca por outro motivo (faixa indisponível etc.).
- Lembrar a preferência "começar pelo YouTube" entre recarregamentos da página.

## Decisions

1. **Coluna `youtube_alt_id` em `tracks`.** Migração `db/migrations/003_youtube_alternative.sql`:
   ```sql
   alter table tracks
     add column youtube_alt_id text
       check (youtube_alt_id ~ '^[A-Za-z0-9_-]{11}$'),
     add constraint tracks_youtube_alt_only_spotify
       check (youtube_alt_id is null or platform = 'spotify');
   ```
   A migração é aditiva e não mexe nos dados. Guardamos só o id do vídeo, que basta para montar o player e o link (`https://www.youtube.com/watch?v=<id>`). `Track`/`SharedTrack` ganham `youtubeAltId: string | null`, mapeado em `toTrack`. Como a rota pública usa `toSharedTrack`, o campo aparece no link compartilhado sem outra mudança.
   - *Alternativa:* uma tabela separada de alternativas, com várias por faixa. É mais flexível, mas não há pedido para isso.

2. **`PATCH` de faixa aceita `youtubeAlt`.** `updateTrackSchema` passa a ser `{ label?: string; youtubeAlt?: string | null }`, com pelo menos um dos dois. O handler:
   - com `youtubeAlt` string: roda `parseTrackUrl` e exige `kind === 'track'` e `platform === 'youtube'`. Senão, responde 400 de validação com a mensagem do parser ou "Cole o link de um vídeo do YouTube.";
   - busca a faixa filtrando pela dona, como hoje. Se não existir, responde 404. Se `platform !== 'spotify'` e vier `youtubeAlt`, responde 400 "Só faixas do Spotify aceitam versão no YouTube.";
   - atualiza só os campos enviados (`label` e/ou `youtube_alt_id`), mais `updated_at` da faixa e da playlist, no mesmo estilo de CTE de hoje.
   A constraint do banco garante a regra do Spotify mesmo se o handler falhar.
   - *Alternativa:* uma rota própria (`PUT .../youtube-alt`). Isso repetiria a verificação de dona e de faixa; o `PATCH` já é "editar faixa".

3. **Edição na lista (`TrackList`).** Só para faixa do Spotify e só com `edit`, o item mostra:
   - sem versão: botão "Versão no YouTube", que abre um campo para colar o link, com "Salvar" e "Cancelar", no mesmo padrão da edição de rótulo;
   - com versão: o texto "Versão no YouTube" com link para o vídeo, e os botões "Trocar" e "Remover".
   `TrackEditActions` ganha `onSaveYoutubeAlt(index, url | null)`. O cliente ganha `api.updateTrack(playlistId, trackId, patch)`, e `updateTrackLabel` passa a usá-lo. Erros de validação aparecem embaixo do campo, como no rótulo.

4. **Fonte da faixa no `usePlayback`.** O hook passa a receber, além dos ids, uma função `youtubeAltFor(id) => string | null`, montada pela página a partir das faixas. O estado novo:
   - `source: 'spotify' | 'youtube'` da faixa atual, que vai no `LoadRequest` como `source`;
   - `preferYoutube` (ref de sessão): ligado na primeira prévia detectada, desligado por `backToSpotify()` ou por `onPreview(false)`;
   - `noSwitchFor` (ref): id da faixa em que a pessoa voltou ao Spotify. É zerado ao carregar outra faixa.

   Regras:
   - `goTo(id)`: `source = preferYoutube && youtubeAltFor(id) ? 'youtube' : 'spotify'`. Isso vale só para faixas do Spotify; as outras plataformas ignoram `source`.
   - `onPreview(true)`: se a faixa atual tem alternativa, `source === 'spotify'` e `noSwitchFor !== id`, liga `preferYoutube`, troca `source` para `'youtube'` e emite um novo pedido para o mesmo id (novo `nonce`, `autoplay: true`). Arma o detector de bloqueio como num avanço automático, porque a troca acontece sem um clique novo. Se não houver troca, liga `preview` (o aviso).
   - `onPreview(false)`: desliga `preview` e `preferYoutube`.
   - `backToSpotify()`: `source = 'spotify'`, `noSwitchFor = id`, desliga `preferYoutube` e emite um novo pedido. Fica exposto em `Playback`.
   - `onEnded` e `onError` continuam iguais. O fim e o erro do vídeo alternativo valem para a faixa atual.

5. **`EmbedPlayer` toca a faixa efetiva.** Com `request.source === 'youtube'` e `track.youtubeAltId`, a faixa passada ao player vira `{ platform: 'youtube', externalId: youtubeAltId, canonicalUrl: 'https://www.youtube.com/watch?v=<id>' }`. A troca de plataforma reaproveita o fluxo atual de destruir e montar. O efeito passa a usar a plataforma efetiva, não `track.platform`. Rótulo, metadados e link "Abrir no Spotify" continuam sendo os da faixa do Spotify. Quando `source === 'youtube'`, aparece uma faixa de aviso (`notice`, `role="status"`) com "Tocando pelo YouTube: o Spotify só liberou a prévia neste navegador." e o botão "Voltar ao Spotify", que chama `backToSpotify`. O aviso geral do Spotify continua visível.

6. **Sugestão para a dona.** O `PlayerPanel` recebe `ownerView` (verdadeiro na `PlaylistPage`, falso na `SharedPage`) e repassa ao `EmbedPlayer`. Com prévia, sem alternativa e `ownerView`, o aviso por navegador ganha a frase "Para tocar completa em qualquer navegador, cadastre uma versão no YouTube para esta faixa."

## Risks / Trade-offs

- [O navegador bloqueia o início automático do YouTube depois da troca, sem clique novo] → o detector de bloqueio já mostra "toque em play para continuar". O iframe do YouTube já usa `allow="autoplay"`, e a troca acontece segundos depois do clique em Tocar ou de um avanço da fila.
- [O vídeo cadastrado é de outra versão ou é removido do YouTube] → a escolha é da dona, e ela pode trocar o vídeo. Vídeo indisponível cai no tratamento de erro do YouTube, que pula a faixa.
- [A pessoa ouve a prévia por 1 a 3 s antes da troca] → a detecção só acontece no primeiro progresso com duração. Nas faixas seguintes, `preferYoutube` evita isso.
- [`preferYoutube` pode levar ao YouTube alguém que, no Firefox, liberaria o Spotify com um clique] → o botão "Voltar ao Spotify" desliga a preferência, e o aviso do Firefox volta a aparecer nas faixas sem alternativa.
- [Mudar `updateTrackSchema` afeta a edição de rótulo] → os testes atuais de rótulo continuam valendo, e os testes novos cobrem a combinação.

## Migration Plan

1. Aplicar `003_youtube_alternative.sql` (`npm run db:migrate`) no Neon de desenvolvimento antes de testar com `npm run dev`, e no Neon de produção antes do deploy. A migração é aditiva e compatível com o código antigo.
2. Deploy do front e da API juntos.
3. Rollback: reverter o deploy. A coluna pode ficar, porque o código antigo a ignora, ou ser removida com `alter table tracks drop column youtube_alt_id`.
