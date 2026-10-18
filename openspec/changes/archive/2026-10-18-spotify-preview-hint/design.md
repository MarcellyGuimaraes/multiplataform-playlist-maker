# Design

## Context

O adaptador `src/player/adapters/spotify.ts` usa o iframe simples do embed (`open.spotify.com/embed/track/<id>`) e conversa com ele por `postMessage` (`ready`, `playback_update`, `error` / comandos `play`, `play_from_start`). Uma alteração não commitada tentou corrigir a "prévia com login" recarregando o embed uma vez quando o primeiro `playback_update` trazia `0 < duration <= 30_000`, com logs `[spotify-dbg]` para diagnóstico. A dona do projeto viu o player ficar branco uma vez e, em outro teste no Firefox, viu o embed piscar e tocar a prévia de novo. A investigação abaixo mudou o plano.

### Achados da investigação (2026-10-06 e 2026-10-18)

**Como o embed decide a prévia.** O HTML de `open.spotify.com/embed/track/<id>` já vem do servidor com a sessão montada a partir dos cookies da requisição (`__NEXT_DATA__` → `session: { accessToken, isAnonymous }`). O código do embed escolhe o modo de reprodução uma vez, na carga: prévia quando `!accessToken || isAnonymous`, e também há condições para `isMobile` e `isSafari` na mesma regra. O token só é renovado por `/embed/api/token` ao expirar; o modo não é reavaliado. Recarregar o embed com os mesmos cookies dá o mesmo modo.

**Cookies.** O login do Spotify é o cookie `sp_dc` (domínio `.spotify.com`, `SameSite=None; Secure`). Navegadores que enviam cookies de terceiros o mandam junto com o iframe; navegadores que os bloqueiam ou particionam, não.

**Chrome 155, perfil de teste logado (Playwright via CDP), 2 rodadas:** o embed carregou com `isAnonymous: false`, o primeiro `playback_update` com duração veio com `duration: 114472` (faixa completa) e não houve recarga. Sem login, a mesma playlist tocou a prévia (`duration: 25591`). Não existe "corrida no login" no Chrome.

**Firefox.** A Total Cookie Protection entrega ao embed cookies particionados, sem `sp_dc`; o console mostra "Partitioned cookie or storage access was provided to open.spotify.com/embed/…" (visto no Firefox da dona do projeto e reproduzido no Firefox 153 do Playwright, sem login). O Firefox traz um shim próprio para esse caso (`browser/extensions/webcompat/shims/spotify-embed.js`, bug 1792395), ativo quando o particionamento dinâmico está ligado: ao receber um clique `isTrusted` no botão de play **da prévia** dentro do embed, chama `document.requestStorageAccess()`, recarrega o embed e clica no play completo. Um `play` enviado por `postMessage` não é clique e não aciona o shim. Pela MDN, a liberação vale 30 dias para o par (site do app, open.spotify.com): nas cargas seguintes, o embed já recebe os cookies. Isso explica o que a dona do projeto via: no MVP (play sempre clicado dentro do embed) tocava completo; "pausar e despausar à mão" resolvia; a recarga feita pelo app tocava a prévia de novo. A confirmação ponta a ponta do clique no Firefox com login fica para o teste manual.

**Outros navegadores.** Janela anônima e "bloquear cookies de terceiros" no Chrome/Edge e o Brave (padrão) não enviam `sp_dc`. O embed não chama a Storage Access API por conta própria (não há `requestStorageAccess`/`hasStorageAccess` no código dele), então nesses casos não há liberação por clique. Safari e celular caem na regra `isSafari`/`isMobile` do embed. Nada disso foi testado em aparelho real.

**Tela branca.** Não foi reproduzida em nenhum teste (Chromium headless, Chrome logado, Firefox). Sem a recarga, o caminho que a causaria deixa de existir.

**Alternativas fora do embed.** O Spotify Web Playback SDK toca a faixa completa em qualquer navegador, mas exige Premium de quem ouve, login OAuth no app e, desde fevereiro de 2026, limita apps em modo de desenvolvimento a 5 usuários (o modo estendido exige empresa com 250 mil usuários ativos por mês). Tocar a mesma música pelo YouTube quando o Spotify só der a prévia funcionaria em qualquer navegador, mas muda o produto e as specs: fica para outra change.

## Goals / Non-Goals

**Goals:**
- Tirar a recarga automática e os logs de diagnóstico, voltando ao comportamento do último commit.
- Quando o Spotify tocar a prévia, dizer à pessoa, no navegador dela, o que fazer (ou que nada pode ser feito ali).
- Testes em jsdom para detecção da prévia, estado na reprodução e escolha do texto.

**Non-Goals:**
- Obter a faixa completa por outro meio (Web Playback SDK, outra plataforma, parâmetros no embed).
- Detectar login no Spotify por cookies, Web API ou SDK.
- Mudar o comportamento de YouTube e SoundCloud ou o aviso geral do Spotify.

## Decisions

1. **Restaurar o adaptador do último commit.** `spotify.ts` e `spotify.test.ts` voltam ao estado de `HEAD`, descartando a recarga, `previewOnlySession`, `resetPreviewRetry` e os logs. A detecção nova é escrita em cima dessa base.
   - *Alternativa descartada:* corrigir a recarga trocando o elemento iframe e com tempo limite para o `ready` (plano anterior desta change). Não traz a faixa completa em nenhum navegador, porque o modo é decidido pelos cookies, e faz o player piscar à toa.

2. **O adaptador informa se a faixa carregada está em prévia.** `PlayerEvents` ganha o evento opcional `onPreview(isPreview: boolean)`, só emitido pelo Spotify. A cada `load()`, o adaptador esquece a classificação; no primeiro `playback_update` com `duration > 0`, classifica (`duration <= PREVIEW_MAX_MS = 30_000` → prévia) e emite. Depois disso, só emite de novo se a classificação mudar, o que cobre o shim do Firefox (o embed recarrega sozinho e passa a informar a duração completa). A detecção vale para qualquer play, do app ou de dentro do embed. O tracker de fim continua recebendo todos os updates, então o fim da prévia segue avançando a fila.
   - *Alternativa:* deduzir no componente a partir do status. Não há como: só o adaptador vê a duração.
   - Uma faixa que tenha de fato até 30 s geraria um aviso falso; é raro e o texto não atrapalha a reprodução.

3. **Estado em `usePlayback`.** O hook guarda `preview: boolean`, ligado e desligado por `onPreview` e zerado sempre que uma nova faixa é pedida ao player. Exposto em `Playback` e repassado ao `EmbedPlayer` pelo `PlayerPanel`.

4. **Texto escolhido pelo navegador numa função pura.** `spotifyPreviewHint(userAgent)` em `src/embed.ts` (ou arquivo vizinho) devolve o texto:
   - celular (`Android|iPhone|iPad|iPod|Mobile` no UA, o que inclui Firefox e Chrome no celular) ou Safari de desktop (`Safari/` sem `Chrome|Chromium|Edg/`): "Neste navegador o Spotify toca só a prévia de 30 segundos no player embutido.";
   - Firefox de desktop (`Firefox/`): "O Firefox esconde do player do Spotify o seu login. Se você tem login no Spotify neste navegador, clique uma vez no play dentro do player para liberar a faixa completa (vale por 30 dias neste site).";
   - demais: "Tocando a prévia de 30 segundos. Para ouvir a faixa completa, faça login no Spotify neste navegador. Se você já tem login, o navegador está bloqueando-o neste site (janela anônima ou cookies de terceiros bloqueados)."
   A ordem importa: celular antes de Firefox, porque o embed força a prévia no celular independentemente do navegador. Textos finais podem ser ajustados na implementação, mantendo o sentido da spec.
   - *Alternativa:* detectar recursos em vez do UA. Não há recurso que diga "este navegador particiona cookies do Spotify"; o UA é suficiente para escolher um texto de ajuda.

5. **Exibição.** Em `EmbedPlayer`, quando a faixa é do Spotify e `preview` é verdadeiro, um parágrafo `className="notice"` com `role="status"` mostra o texto, acima do aviso geral, que não muda.

## Risks / Trade-offs

- [UA impreciso ou falsificado] → só escolhe o texto de ajuda; no pior caso a orientação não serve para aquele navegador, sem afetar a reprodução.
- [O Firefox pode mudar ou remover o shim] → o aviso deixaria de ser verdadeiro no Firefox; o teste manual desta change e o README registram a data da verificação.
- [Safari e celular não foram testados em aparelho real] → a regra vem do código do embed; o teste manual verifica num celular, se houver um disponível.
- [O texto de Chrome/Edge mistura "sem login" e "login bloqueado"] → o app não consegue distinguir os dois casos; o texto cobre ambos.

## Migration Plan

Só front-end, sem dados. Reverter = reverter o commit.
