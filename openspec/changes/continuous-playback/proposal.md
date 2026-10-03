# Proposal

## Why

O MVP está em produção, mas cada faixa precisa ser iniciada à mão: quando uma música termina, nada acontece. Para uma playlist ser ouvida de fato — inclusive por quem recebe o link público — o app precisa emendar as faixas sozinho, atravessando YouTube, Spotify e SoundCloud, sem deixar de usar exclusivamente os players oficiais.

## What Changes

- **BREAKING (comportamento):** remove o requisito do MVP "Sem reprodução contínua automática". Ao fim de uma faixa, o app passa a carregar e tentar tocar a próxima automaticamente.
- Os players embutidos passam a ser controlados pelas interfaces oficiais de player de cada plataforma, rodando no navegador: YouTube IFrame Player API, SoundCloud Widget API e, no Spotify, as mensagens do próprio iframe de embed do MVP (o mesmo protocolo que a Spotify iFrame API usa por baixo). Isso serve para detectar fim de faixa, erro e início de reprodução, e para mandar tocar a próxima. Nenhum áudio passa pelo servidor.
- Controles no player: **anterior**, **próxima**, **autoplay liga/desliga** (ligado por padrão), **repetir playlist** e **modo aleatório**. As preferências ficam salvas no navegador de quem ouve.
- No fim da playlist, a reprodução para. Com "repetir" ligado, volta para a primeira faixa (ou para a primeira da ordem embaralhada).
- Faixa indisponível (vídeo removido, som tirado do ar) é pulada automaticamente quando a plataforma informa o erro.
- Quando o navegador bloquear o início automático (política de autoplay), o app mostra a faixa seguinte carregada com um aviso para tocar manualmente, sem perder a posição na fila.
- A reprodução contínua vale tanto na tela de edição quanto no link público somente leitura.
- A fila acompanha mudanças feitas na playlist durante a reprodução (adicionar, remover, reordenar).

**Fora do escopo:** reprodução em segundo plano garantida (abas inativas e telas bloqueadas seguem as regras de cada navegador), controles de mídia do sistema (Media Session), crossfade, contornar a prévia de 30 s do Spotify ou as políticas de autoplay dos navegadores.

## Capabilities

### New Capabilities
- `continuous-playback`: fila de reprodução, avanço automático ao fim da faixa, anterior/próxima, autoplay liga/desliga, repetir, aleatório, faixas indisponíveis, autoplay bloqueado e persistência das preferências no navegador.

### Modified Capabilities
- `embedded-playback`: remove "Sem reprodução contínua automática" passa a permitir o controle dos players embutidos pelas interfaces oficiais de player, executadas no navegador, e exige que o Spotify mantenha o iframe de embed do MVP (faixa completa para quem tem login).

## Impact

- **Código (só front):** novo módulo de fila em `src/`, adaptadores por plataforma para as APIs oficiais de player, refatoração de `src/components/EmbedPlayer.tsx`, controles de reprodução e integração em `src/pages/PlaylistPage.tsx` e `src/pages/SharedPage.tsx`.
- **Sem mudanças** em API, banco ou migrações.
- **Dependências externas:** scripts oficiais carregados sob demanda no navegador (`www.youtube.com/iframe_api` e `w.soundcloud.com/player/api.js`; o Spotify não carrega script). Nenhum pacote npm novo é necessário.
- **Limitações conhecidas:** Safari/iOS e abas em segundo plano podem bloquear o início automático. O Spotify não emite um evento explícito de "fim de faixa", então o fim é inferido pelo progresso. Sem login no Spotify, a prévia de 30 s conta como faixa terminada.
