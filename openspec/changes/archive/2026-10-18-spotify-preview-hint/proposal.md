# Proposal

## Why

Mesmo com login no Spotify, o player do Spotify às vezes toca só a prévia de 30 s dentro do app. Uma alteração não commitada tentou resolver recarregando o embed uma vez quando detectava a prévia, partindo da hipótese de que o embed avisava `ready` antes de reconhecer o login. A investigação (registrada em `design.md`) derrubou essa hipótese:

- O embed do Spotify decide entre prévia e faixa completa **uma vez, ao carregar**, com base na sessão que o servidor do Spotify monta a partir dos cookies enviados com o iframe. Recarregar com os mesmos cookies dá o mesmo resultado.
- No **Chrome/Edge** com configuração padrão, o cookie de login chega ao embed e a faixa toca completa de primeira, sem recarga (testado).
- No **Firefox**, a Total Cookie Protection entrega ao embed cookies particionados, sem o login. O próprio Firefox tem um ajuste para o embed do Spotify que libera o login, mas só depois de um **clique da pessoa** no play da prévia dentro do player; um `play` mandado pelo app não conta.
- Em **janela anônima, com cookies de terceiros bloqueados, no Brave**, e pelo código do embed também no **Safari e no celular**, o embed toca a prévia e não há o que o app possa fazer.

Ou seja, a recarga automática não traz a faixa completa em nenhum navegador: só faz o player piscar. O que ajuda de verdade é dizer à pessoa, no momento em que a prévia aparece, o que ela pode fazer no navegador que está usando.

## What Changes

- **Remoção da recarga automática** do embed do Spotify e dos logs de diagnóstico temporários (`[spotify-dbg ...]`). O adaptador volta ao comportamento do último commit: o embed nunca é recarregado nem trocado por causa da prévia.
- **Aviso de prévia por navegador:** quando o embed do Spotify informa que está tocando uma prévia (duração de até 30 s), o app mostra junto ao player um aviso com a orientação para o navegador em uso:
  - Firefox: clicar uma vez no play dentro do player do Spotify para ele reconhecer o login (a liberação vale por 30 dias neste site);
  - Safari e celulares: o Spotify só toca a prévia no player embutido neste navegador;
  - demais navegadores (Chrome, Edge etc.): para ouvir completa, é preciso login no Spotify neste navegador; se já há login, o navegador está bloqueando-o neste site (janela anônima ou cookies de terceiros bloqueados).
- O aviso some quando o embed passa a tocar a faixa completa (por exemplo, depois do clique no Firefox) e ao trocar de faixa.
- O aviso geral do Spotify sobre login e prévia continua como está.

**Fora do escopo:** tocar a faixa por outra plataforma quando o Spotify só der a prévia (alternativa pelo YouTube, a ser proposta em outra change) e o Spotify Web Playback SDK (exige Premium de quem ouve e, desde fevereiro de 2026, limita apps fora do modo estendido a 5 usuários).

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `embedded-playback`: novo requisito de aviso específico por navegador quando o embed do Spotify toca a prévia, com a proibição explícita de recarregar ou trocar o embed por causa da prévia.

## Impact

- `src/player/adapters/spotify.ts` e `spotify.test.ts`: volta ao último commit (sem recarga nem logs) e passa a avisar quando a faixa carregada está tocando prévia ou completa.
- `src/player/types.ts`: novo evento opcional de prévia em `PlayerEvents`.
- `src/player/usePlayback.ts`: guarda se a faixa atual está em prévia, zerando ao trocar de faixa.
- `src/components/EmbedPlayer.tsx` e um helper novo para escolher o texto pelo navegador: exibição do aviso.
- `README.md`: limitações do Spotify por navegador.
- Sem impacto em servidor, banco, API ou nos adaptadores de YouTube e SoundCloud.
