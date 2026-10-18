# Tasks

## 1. Investigação

- [x] 1.1 Com o diff atual (logs `[spotify-dbg]` ainda presentes), rodar `npm run dev`, abrir uma playlist compartilhada com faixa do Spotify (ex.: `/s/EPw6UZIokV2Hh1d5bY-1Kw`) logada no Spotify e reproduzir a tela branca; verificar no console se aparece "prévia detectada: recarregando" e se chega um novo `<- embed {"type":"ready"}` depois, e no DevTools (Elements) qual `src`/documento o iframe tem. Registrar o resultado em `design.md` e encerrar o servidor de dev ao terminar.
- [x] 1.2 Verificar como o embed decide a prévia (código do embed, cookies, shim do Firefox) e testar no Chrome com e sem login; registrar os achados em `design.md` e encerrar o servidor de dev e os navegadores de teste ao terminar.

## 2. Remover a recarga

- [x] 2.1 Restaurar `src/player/adapters/spotify.ts` e `spotify.test.ts` do último commit (sem recarga, `previewOnlySession`, `resetPreviewRetry` nem logs) e verificar com `grep -rn "spotify-dbg\|reloadAndPlay\|previewOnlySession" src` sem resultados e `npx vitest run src/player/adapters/spotify.test.ts` passando.

## 3. Detectar a prévia

- [x] 3.1 Adicionar `onPreview?(isPreview: boolean)` a `PlayerEvents` e, no adaptador do Spotify, `PREVIEW_MAX_MS = 30_000` e a classificação por `load()`: emite no primeiro `playback_update` com `duration > 0` e de novo só quando a classificação muda. Cobrir em `spotify.test.ts`: prévia → `onPreview(true)` uma vez e nenhum comando ou troca de `src` extra; faixa completa → `onPreview(false)`; prévia seguida de duração completa (shim do Firefox) → `true` e depois `false`; nova faixa reclassifica; o fim da prévia ainda gera `onEnded`.
- [x] 3.2 Em `usePlayback`, guardar `preview` (ligado/desligado por `onPreview`, zerado a cada nova faixa pedida ao player) e expô-lo em `Playback`; cobrir em `usePlayback.test.ts` (liga, desliga, zera ao avançar e ao escolher outra faixa) e verificar com `npx vitest run src/player`.

## 4. Aviso por navegador

- [x] 4.1 Criar `spotifyPreviewHint(userAgent)` com os três textos de `design.md` (celular/Safari, Firefox desktop, demais) e testá-la com uma tabela de UAs reais: Firefox Windows, Firefox Android, Chrome Windows, Chrome Android, Edge, Safari macOS, Safari iPhone, Chrome iOS (`CriOS`).
- [x] 4.2 Repassar `preview` do `PlayerPanel` ao `EmbedPlayer` e exibir o aviso (`notice`, `role="status"`) só para faixa do Spotify com `preview` verdadeiro, mantendo o aviso geral; cobrir em teste de componente (aparece com prévia, some sem prévia, não aparece em YouTube/SoundCloud) e verificar com `npx vitest run`.
- [x] 4.3 Atualizar as limitações do Spotify no `README.md`: comportamento por navegador (Chrome/Edge, Firefox com clique, anônimo/Brave, Safari/celular) e que o app avisa quando toca a prévia.

## 5. Verificação

- [x] 5.1 Rodar `npm run build` (ou o typecheck do projeto) e `npx vitest run` e verificar que terminam sem erros.
- [x] 5.2 Com `npm run dev`, no Chrome logado no Spotify, tocar uma faixa do Spotify pelo app: toca completa, sem aviso de prévia e sem recarga. Em janela anônima do Chrome: toca a prévia, aparece o aviso de "demais navegadores" e o autoplay avança ao fim dela. Encerrar o servidor de dev ao terminar.
- [x] 5.3 No Firefox da dona do projeto, logada no Spotify (de preferência num site em que ainda não houve clique no player): o app toca a prévia e mostra o aviso do Firefox; clicar no play dentro do player faz o embed recarregar com a faixa completa e o aviso some; a próxima faixa do Spotify, tocada pelo app, já vem completa sem clique. Encerrar o servidor de dev ao terminar.
- [x] 5.4 Se houver um celular disponível, tocar uma faixa do Spotify no app e verificar o aviso de celular; caso contrário, registrar no README que Safari/celular não foram verificados em aparelho.
