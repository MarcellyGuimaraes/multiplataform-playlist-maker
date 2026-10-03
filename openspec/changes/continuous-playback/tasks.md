# Tasks

## 1. Fila e preferências (lógica pura)

- [x] 1.1 Implementar `src/player/queue.ts` (`buildOrder`, `nextId`, `prevId`, `reconcileOrder`) com testes cobrindo limites sem repetir, volta com repetir, aleatório com seed (faixa atual fixada e cada faixa exatamente uma vez por ciclo), desligar o aleatório continuando da faixa atual, e reconciliação ao adicionar, remover e reordenar
- [x] 1.2 Implementar `src/player/preferences.ts` (`playback-prefs:v1` em `localStorage`, padrões autoplay ligado e repeat/shuffle desligados, `try/catch` em leitura e escrita) e verificar com testes que valores salvos são lidos, que JSON inválido cai nos padrões e que `localStorage` lançando exceção não quebra

## 2. Adaptadores das APIs oficiais de player

- [x] 2.1 Implementar `src/player/sdk.ts` (`loadScript` com carregamento único, espera do global de prontidão e timeout de 10 s) e verificar com testes jsdom que duas chamadas inserem um só `<script>` e que o timeout rejeita
- [x] 2.2 Definir a interface `PlatformPlayer`/`PlayerEvents` e implementar `src/player/adapters/youtube.ts` (`YT.Player` com host nocookie, `loadVideoById`/`cueVideoById` na mesma instância, mapeamento de ENDED/PLAYING/PAUSED e erros 2/5/100/101/150), verificando com teste que usa um `window.YT` falso
- [x] 2.3 Implementar `src/player/adapters/soundcloud.ts` (iframe do widget com `allow="autoplay"`, `SC.Widget`, eventos FINISH/PLAY/PAUSE/ERROR e `widget.load(url, { auto_play })` na mesma instância), verificando com teste que usa um `window.SC` falso
- [x] 2.4 Implementar `src/player/adapters/spotify.ts` (`createController`, `loadUri` + `play()`, fim inferido por `playback_update` com margem de 1 s e disparo único por faixa, rearmado a cada `loadUri`), verificando com teste que reproduz sequências de eventos: fim normal, fim da prévia de 30 s, pausa no meio (sem fim) e eventos repetidos após o fim (um só `onEnded`)
- [x] 2.5 Implementar o fallback de SDK indisponível (falha ou timeout do script → iframe "cego" com reprodução manual e aviso) e verificar com teste em que o script falha
- [x] 2.6 Trocar o adaptador do Spotify pelo iframe de embed do MVP controlado pelas mensagens do embed (ready/playback_update/error e comandos play/play_from_start), sem o script da iFrame API — que tocava só a prévia com login, conforme teste A/B no navegador da dona —, verificando com testes de mensagens simuladas (inclusive de outra origem) e atualizando spec, design e proposal

## 3. Estado de reprodução

- [x] 3.1 Implementar `src/player/usePlayback.ts` (currentId, ordem, status, preferências, `play`/`next`/`prev`/toggles, handlers `onEnded`/`onPlaying`/`onError`) e verificar com testes de hook: avanço com autoplay, parada com autoplay desligado, fim sem e com repetir, e anterior/próxima nos limites
- [x] 3.2 Adicionar a lógica temporal (erro → `unavailable` e próxima em 3 s com autoplay, cancelada por ação manual; carregamento automático sem `onPlaying` em 5 s → `blocked`, limpo pelo próximo `onPlaying`) e verificar com fake timers
- [x] 3.3 Reconciliar a fila quando a lista de faixas muda (adicionar, remover, reordenar; remover a faixa atual fecha o player) e verificar com testes de hook que re-renderizam com listas diferentes

## 4. Interface do player

- [x] 4.1 Refatorar `src/components/EmbedPlayer.tsx` para montar o adaptador da plataforma num contêiner (reaproveitando a instância entre faixas da mesma plataforma e destruindo ao trocar), mantendo rótulo, metadados, link original e aviso do Spotify, e verificar que os testes existentes de `components.test.tsx` continuam passando, adaptados ao adaptador falso
- [x] 4.2 Criar `PlayerAdapterProvider` (registro de adaptadores injetável, com os reais por padrão) e verificar com teste que o `EmbedPlayer` usa o adaptador injetado
- [x] 4.3 Criar `src/components/PlaybackControls.tsx` (anterior, próxima, toggles Autoplay/Repetir/Aleatório com `aria-pressed`, limites desabilitados sem repetir) e os avisos `unavailable`/`blocked` com `role="status"`, e verificar com testes de componente estados, rótulos acessíveis e navegação por teclado
- [ ] 4.4 Ajustar estilos em `src/styles.css` (controles no player sticky, avisos, foco visível, layout em 360 px de largura) e verificar no `npm run dev` em larguras de celular e desktop

## 5. Integração nas telas

- [x] 5.1 Integrar `usePlayback` e `PlaybackControls` em `src/pages/PlaylistPage.tsx` (substituindo `currentId` local; "Tocar" chama `play(id)`) e verificar com o fluxo de UI usando o adaptador falso: tocar a primeira, simular fim, a segunda fica marcada "tocando"; reordenar no meio altera a próxima; remover a atual fecha o player
- [x] 5.2 Integrar em `src/pages/SharedPage.tsx` com as mesmas regras e ids sintéticos por posição, e verificar com o fluxo de UI que a reprodução contínua e os controles funcionam e que nenhum controle de edição aparece
- [x] 5.3 Verificar com o fluxo de UI que abrir uma playlist não toca nada sozinho e que as preferências persistem entre recarregamentos

## 6. Documentação

- [x] 6.1 Atualizar o `README.md` (reprodução contínua, controles, limitações de autoplay em Safari/iOS e segundo plano, fim inferido no Spotify, faixas do Spotify indisponíveis não puladas sozinhas) e conferir que os comandos documentados continuam válidos

## 7. Verificação em navegador real e deploy

- [ ] 7.1 No `npm run dev`, em Chrome desktop, montar uma playlist YouTube → SoundCloud → Spotify → YouTube e confirmar o avanço automático entre plataformas, anterior/próxima, repetir, aleatório e o liga/desliga do autoplay; registrar no DevTools que nenhuma requisição de mídia vai para `/api` e que a CSP não bloqueia os SDKs
- [ ] 7.2 Confirmar com um vídeo removido do YouTube que o aviso aparece e a faixa é pulada em cerca de 3 s, e, sem login no Spotify, que o fim da prévia de 30 s avança
- [ ] 7.3 Testar em Firefox e num celular (Safari/iOS ou Chrome Android), registrar no README se o início automático é bloqueado e confirmar que o aviso "toque em play" aparece e a fila continua
- [ ] 7.4 Fazer deploy de Preview na Vercel (com confirmação da dona), repetir o roteiro 7.1 no link público e promover para produção
