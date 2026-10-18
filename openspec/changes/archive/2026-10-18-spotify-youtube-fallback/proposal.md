# Proposal

## Why

O player embutido do Spotify só toca a faixa completa quando recebe o login da pessoa. No Safari, no celular, em janela anônima, no Brave e, sem um clique no player, no Firefox, ele toca só a prévia de 30 segundos. A investigação da change arquivada `2026-10-18-spotify-preview-hint` mostrou que o app não consegue mudar isso: o próprio Spotify decide ao carregar o player, e o player próprio do Spotify (Web Playback SDK) exige Premium de quem ouve e não pode ser liberado ao público por um projeto deste porte. Hoje o app só avisa. Isso tira o sentido de uma playlist multiplataforma para quem ouve nesses navegadores, e mandar a pessoa para o Spotify também tira.

A saída é deixar a dona indicar, para cada faixa do Spotify, um vídeo do YouTube com a mesma música. Quando o Spotify só der a prévia, o player passa sozinho a tocar esse vídeo, que toca completo em qualquer navegador e sem login.

## What Changes

- **Versão no YouTube para faixas do Spotify:** a dona pode colar, numa faixa do Spotify da sua playlist, um link de vídeo do YouTube como versão alternativa, e pode trocar ou remover esse link depois. O link é validado como vídeo do YouTube. Não há busca: o app não procura vídeos sozinho e não usa nenhuma API de dados.
- **Troca automática para o YouTube:** quando o embed do Spotify informa que está tocando a prévia e a faixa tem versão no YouTube, o player troca sozinho para o player do YouTube com esse vídeo, na mesma posição da fila, e pede a reprodução. O fim do vídeo conta como fim da faixa para o avanço automático.
- **Indicação e volta ao Spotify:** enquanto a versão do YouTube toca, o player mostra que a faixa está tocando pelo YouTube e oferece voltar ao Spotify. Isso serve, por exemplo, para quem está no Firefox e quer clicar no player do Spotify para liberar o login.
- **Menos pisca nas faixas seguintes:** depois que uma prévia é detectada, as próximas faixas do Spotify que tiverem versão no YouTube começam direto pelo YouTube enquanto a página estiver aberta. Voltar ao Spotify, ou o Spotify tocar uma faixa completa, desfaz isso.
- **Aviso de prévia:** quando a faixa não tem versão no YouTube, continua aparecendo o aviso por navegador da change anterior. Para a dona, o aviso sugere cadastrar uma versão no YouTube.
- A versão no YouTube também vale no link público: quem ouve pela playlist compartilhada tem a mesma troca.

**Fora do escopo:** busca automática de vídeos (YouTube Data API), versões alternativas para faixas de YouTube ou SoundCloud e troca para o YouTube por outro motivo que não seja a prévia, como faixa indisponível.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `track-links`: novo requisito para cadastrar, trocar, remover e exibir a versão no YouTube de uma faixa do Spotify.
- `embedded-playback`: novo requisito de troca automática para a versão no YouTube quando o Spotify toca a prévia, com a indicação e a volta ao Spotify. O requisito "Aviso quando o Spotify toca a prévia" passa a valer só para faixas sem versão no YouTube e ganha a sugestão para a dona.

## Impact

- **Banco:** migração nova `003_youtube_alternative.sql` com a coluna `youtube_alt_id` em `tracks`. A migração precisa ser aplicada no Neon de desenvolvimento e no de produção.
- **API:** `PATCH /api/playlists/:id/tracks/:trackId` passa a aceitar a versão no YouTube (link para cadastrar ou trocar, `null` para remover), só em faixas do Spotify. As respostas de faixa, inclusive a pública, passam a incluir o identificador do vídeo alternativo.
- **Shared:** `shared/types.ts` (campo novo em `Track`/`SharedTrack`), `shared/schemas.ts` (validação do PATCH) e reuso de `parseTrackUrl` para validar o link.
- **Front:** edição da versão no YouTube em `TrackList` e no cliente da API; troca de plataforma do player em `usePlayback`, `EmbedPlayer` e `PlayerPanel`; indicação "tocando pelo YouTube" com botão de voltar.
- **Docs:** `README.md` (como funciona a versão no YouTube).
- Sem dependências novas, sem chave de API e sem chamadas novas do servidor às plataformas.
