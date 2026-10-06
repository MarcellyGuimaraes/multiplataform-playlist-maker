# Design

## Context

Motivação em `proposal.md`; requisitos em `specs/continuous-playback` e `specs/embedded-playback`. Estado atual do código:

- `src/components/EmbedPlayer.tsx` renderiza um `<iframe>` "cego" (URL de `src/embed.ts`), recriado via `key` a cada troca de faixa. O app não sabe quando a faixa termina. O iframe não declara `allow="autoplay"`.
- `PlaylistPage` guarda `currentId`; `SharedPage` guarda `currentIndex`. Não existe noção de fila.
- `vercel.json` define CSP só com `frame-src` (YouTube nocookie, open.spotify.com, w.soundcloud.com), `object-src` e `base-uri`. Não há `script-src`, então scripts externos não são bloqueados hoje.
- Testes: Vitest, jsdom para componentes (`src/components/components.test.tsx`) e fluxos de UI com o fetch roteado para os handlers reais (`tests/ui/flows.test.tsx`).

Nada muda em API, banco ou migrações. O trabalho é todo no front.

## Goals / Non-Goals

**Goals:**
- Detectar fim, erro e início de reprodução nos três players oficiais, e mandar carregar e tocar a próxima faixa.
- Lógica de fila pura e testável, separada dos SDKs.
- Maximizar a chance de o navegador permitir o início automático, sem nunca contorná-lo.
- Um único componente de player e um único conjunto de controles, usados nas telas de edição e pública.

**Non-Goals:**
- Reprodução garantida em segundo plano ou com tela bloqueada.
- Media Session API, atalhos globais de teclado, crossfade, pré-carregamento da próxima faixa.
- Retomar a sessão (faixa e posição) após recarregar a página.

## Decisions

### 1. Fila como módulo puro (`src/player/queue.ts`)
Funções sem estado React:
- `buildOrder(trackIds, { shuffle, currentId, seed? })` → ordem efetiva. No aleatório, Fisher–Yates com a faixa atual fixada como atual (vai para a primeira posição da permutação).
- `nextId(order, currentId, { repeat })` / `prevId(...)` → id ou `null` (fim sem repetir).
- `reconcileOrder(prevOrder, trackIds, shuffle)` → mantém a permutação existente quando a lista muda: remove ids que sumiram e acrescenta os novos ao fim da permutação. Sem aleatório, a ordem é sempre a da playlist.

A permutação é gerada uma vez ao ligar o aleatório e reaproveitada a cada volta com "repetir". Não é reembaralhada a cada ciclo, o que deixa o comportamento previsível e testável.
- *Alternativa:* escolher uma faixa aleatória a cada avanço. Foi descartada porque viola "cada faixa uma vez por ciclo".

### 2. Adaptadores por plataforma com interface comum (`src/player/adapters/`)
```ts
interface PlatformPlayer {
  load(track: EmbeddableTrack, opts: { autoplay: boolean }): void; // reaproveita o player quando possível
  destroy(): void;
}
type PlayerEvents = { onPlaying(): void; onPaused(): void; onEnded(): void; onError(reason: string): void };
```
- **YouTube** (`youtube.ts`): `YT.Player` com `host: 'https://www.youtube-nocookie.com'`, `playerVars: { autoplay, rel: 0 }`. `onStateChange` mapeia `ENDED → onEnded`, `PLAYING → onPlaying`, `PAUSED → onPaused`. `onError` (códigos 2/5/100/101/150) mapeia para `onError`. Troca de faixa no mesmo player via `loadVideoById` (toca) ou `cueVideoById` (não toca).
- **SoundCloud** (`soundcloud.ts`): `<iframe allow="autoplay">` do widget + `SC.Widget(iframe)`. Eventos `FINISH`, `PLAY`, `PAUSE` e `ERROR`. Troca via `widget.load(canonicalUrl, { auto_play, callback })`.
- **Spotify** (`spotify.ts`): **mesmo iframe do MVP** (`open.spotify.com/embed/track/<id>`, sem parâmetros), controlado pelas mensagens que o embed troca com a página: ele envia `{ type: 'ready' }`, `{ type: 'playback_update', payload }` e `{ type: 'error', payload: { recoverable } }` para `window.parent`, e aceita `{ command: 'play' | 'play_from_start' | ... }`. É o protocolo que a Spotify iFrame API usa internamente (verificado no código do embed). O adaptador filtra por `origin === 'https://open.spotify.com'` e `source === iframe.contentWindow`. O embed não tem evento de fim, então o fim é inferido no listener `playback_update` (`{ isPaused, position, duration }`): dispara `onEnded` quando `duration > 0` e `position >= duration - 1000ms`, ou quando o player volta a `position 0` pausado e o último progresso estava nos 5 s finais (o progresso chega em saltos). Dispara uma única vez por faixa, com flag rearmada a cada troca de faixa. `onPlaying` quando `isPaused === false` e a posição avança. Troca de faixa: muda o `src` do mesmo iframe (o embed recarrega e manda `ready` de novo) e, com `autoplay`, envia `play` ao receber o `ready`; a mesma faixa de novo envia `play_from_start`. Erro irrecuperável do embed (`recoverable: false`) vira `onError`.
  - **Por que não a Spotify iFrame API:** a primeira versão usava `IFrameAPI.createController`. No navegador da dona do projeto, com login no Spotify, o iframe criado pela API tocava só a prévia de 30 s, enquanto o iframe simples do MVP toca a faixa completa (teste A/B lado a lado). Ela escolheu manter o iframe do MVP. O custo é depender de um protocolo de mensagens que o Spotify não documenta; se ele mudar, o adaptador cai no comportamento manual (o iframe continua tocando).
- Os scripts oficiais são carregados sob demanda, uma única vez, por `loadScript(src, readyGlobal)` em `src/player/sdk.ts`, com timeout de 10 s. Se o script falhar, cai no iframe "cego" atual (reprodução manual) e mostra um aviso.
  - YouTube: `https://www.youtube.com/iframe_api` (callback global `onYouTubeIframeAPIReady`)
  - SoundCloud: `https://w.soundcloud.com/player/api.js` (`window.SC`)
  - Spotify: nenhum script (ver acima)
- *Alternativa:* usar só `postMessage` com todos os iframes, sem os SDKs. Foi descartada para YouTube e SoundCloud, cujos SDKs oficiais funcionam e são o caminho suportado. No Spotify, foi adotada pelo motivo acima.

### 3. Reaproveitar o player da mesma plataforma; recriar ao trocar de plataforma
Faixas consecutivas da mesma plataforma reutilizam o mesmo iframe (`loadVideoById` / `widget.load` / troca de `src` no iframe do Spotify). Isso preserva a ativação do usuário dentro do iframe e aumenta muito a chance de o autoplay ser aceito, além de evitar piscar a tela. Ao trocar de plataforma, o adaptador anterior faz `destroy()` e o novo é criado, então continua havendo um único player ativo (requisito existente). Todos os iframes criados declaram `allow="autoplay; encrypted-media; fullscreen; picture-in-picture"`: o YT.Player já inclui `autoplay`; os do SoundCloud e do Spotify são criados por nós.

### 4. Estado de reprodução num hook (`src/player/usePlayback.ts`)
`usePlayback(tracks)` concentra: `currentId`, `order`, `status` (`idle | loading | playing | paused | blocked | unavailable | ended`), preferências e ações (`play(id)`, `next()`, `prev()`, `toggleAutoplay/Repeat/Shuffle()`), além dos handlers que o player chama (`onEnded`, `onError`, `onPlaying`).
- `onEnded`: se o autoplay está ligado, vai para `nextId`; se for `null`, `status = 'ended'`.
- `onError`: `status = 'unavailable'`; com autoplay ligado, agenda `next()` em 3 s (cancelado se a pessoa agir antes ou trocar de faixa).
- **Autoplay bloqueado:** após um `load` automático, um timer de 5 s espera `onPlaying`. Se não chegar, `status = 'blocked'` (o aviso "toque em play para continuar" aparece). O `onPlaying` posterior limpa o estado e a fila segue.
- `play(id)` por clique sempre carrega com `autoplay: true`, porque é ação de quem ouve.
- A lista vem como prop. Um `useEffect` sobre os ids aplica `reconcileOrder`; se a faixa atual sumiu, `currentId = null` (fecha o player).
- `SharedPage` passa a usar ids sintéticos (posição) como chave, já que a resposta pública não tem ids de faixa.

### 5. Preferências em `localStorage` (`src/player/preferences.ts`)
Chave única `playback-prefs:v1` → `{ autoplay, repeat, shuffle }`. Leitura e escrita em `try/catch`, com fallback para os padrões (autoplay ligado, repeat e shuffle desligados). Vale para todas as playlists no navegador, nada vai ao servidor.

### 6. UI
- `EmbedPlayer` passa a receber `{ track, autoplay, events }` e monta um contêiner onde o adaptador cria o iframe. Mantém rótulo, metadados, link original e aviso do Spotify (requisitos existentes). Acrescenta avisos de `unavailable` e `blocked` (`role="status"`).
- Novo `PlaybackControls`: botões ⏮ anterior / ⏭ próxima (desabilitados nos limites sem repetir) e três toggles com `aria-pressed` (Autoplay, Repetir, Aleatório).
- `TrackList` continua igual: "Tocar" chama `playback.play(id)` e o destaque usa `currentId`.

### 7. CSP
Hoje não há `script-src`, então os três scripts carregam. O `frame-src` já cobre os iframes, porque o YouTube usa `host` nocookie. Não vamos endurecer a CSP com `script-src` nesta change: os SDKs carregam scripts secundários de domínios variados (ex.: `www.youtube.com/s/player/...`, `open.spotifycdn.com`), e uma lista incompleta quebraria a reprodução em produção. A verificação no navegador real (tarefas) confirma que nenhuma diretiva atual bloqueia os SDKs.

### 8. Testes
- `queue.ts`: testes unitários (limites, repetir, aleatório com seed, cada faixa uma vez por ciclo, reconciliação).
- Adaptadores: testes em jsdom com SDKs falsos instalados em `window` (`YT`, `SC`) e, no Spotify, mensagens simuladas do embed (inclusive de outra origem, que devem ser ignoradas), disparando eventos e verificando o mapeamento, inclusive a inferência de fim do Spotify e o disparo único.
- `usePlayback`: avanço, fim sem/com repetir, erro → pula em 3 s e bloqueado em 5 s, com fake timers.
- Fluxo de UI: o registro de adaptadores é injetável (`PlayerAdapterProvider`), e os testes usam um adaptador falso para simular "terminou" e verificar que a próxima faixa fica marcada como tocando, nas telas de edição e pública.
- Verificação manual no navegador real: os SDKs e as políticas de autoplay não são reproduzíveis em jsdom.

## Risks / Trade-offs

- [Política de autoplay: Safari/iOS e algumas configurações do Chrome bloqueiam o início sem gesto] → reaproveitar o iframe da mesma plataforma, `allow="autoplay"` e, quando bloqueado, aviso com a faixa já carregada (spec "Início automático bloqueado").
- [Trocar de plataforma cria um iframe novo, onde o autoplay é mais frágil] → aceito; o aviso de bloqueio cobre o caso. Pré-criar players ocultos violaria "um player ativo por vez".
- [Spotify sem evento de fim; a heurística de progresso pode disparar cedo ou não disparar] → margem de 1 s, disparo único por faixa e testes com sequências reais de `playback_update`. "Próxima" manual sempre funciona.
- [Spotify: protocolo de mensagens do embed não documentado] → é o mesmo que a iFrame API oficial consome, então tende a ser estável; se mudar, o iframe continua tocando e só o avanço automático do Spotify para de funcionar. Erros do Spotify só são detectados quando o embed os informa.
- [Abas em segundo plano: timers e players são estrangulados pelo navegador] → fora do escopo; a reprodução continua quando possível.
- [Mudanças nos SDKs das plataformas] → adaptadores isolados atrás de uma interface pequena; se o script falhar, cai no iframe manual.
- [A heurística de 5 s pode marcar como "bloqueado" uma rede lenta] → o aviso some no primeiro `onPlaying`; nenhum estado é perdido.

## Migration Plan

Só front, sem mudança de dados. Deploy normal na Vercel; testar no Preview em Chrome desktop, Firefox e um celular antes de promover. Rollback: promover o deploy anterior.

## Open Questions

- Ajustar os tempos de 3 s (pular indisponível) e 5 s (detectar bloqueio) após uso real. São constantes isoladas e não mudam specs nem tarefas.
