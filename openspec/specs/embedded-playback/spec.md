# embedded-playback Specification

## Purpose
Reproduz as faixas dentro do app exclusivamente pelos players embutidos oficiais de YouTube, Spotify e SoundCloud, sem que o sistema jamais hospede, baixe ou redistribua áudio.

## Requirements

### Requirement: Reprodução por player embutido oficial
Ao selecionar uma faixa para tocar, o sistema SHALL exibir o player embutido oficial da plataforma da faixa, montado a partir do identificador externo armazenado: o player de iframe do YouTube, o embed de faixa do Spotify ou o widget do SoundCloud. Apenas um player SHALL estar ativo por vez; selecionar outra faixa MUST substituir o player anterior.

#### Scenario: Tocar faixa do YouTube
- **WHEN** a usuária seleciona uma faixa da plataforma `youtube`
- **THEN** o app exibe o player embutido oficial do YouTube carregado com o vídeo daquele identificador

#### Scenario: Tocar faixa do SoundCloud
- **WHEN** a usuária seleciona uma faixa da plataforma `soundcloud`
- **THEN** o app exibe o widget oficial do SoundCloud carregado com a URL canônica daquela faixa

#### Scenario: Trocar de faixa
- **WHEN** um player do Spotify está ativo e a usuária seleciona uma faixa do YouTube
- **THEN** o player do Spotify é removido e o player do YouTube é exibido no lugar

### Requirement: Controle dos players pelas interfaces oficiais
O sistema SHALL controlar os players embutidos oficiais apenas pelas interfaces que as próprias plataformas oferecem no navegador: a YouTube IFrame Player API, a SoundCloud Widget API e, no Spotify, as mensagens que o iframe de embed oficial troca com a página. Essas mensagens são o mesmo protocolo que a Spotify iFrame API usa internamente. O controle SHALL se limitar a carregar faixas, solicitar reprodução e receber eventos de estado (início, pausa, progresso, fim e erro). O servidor MUST NOT participar da reprodução, e as APIs de dados restritas das plataformas MUST NOT ser usadas.

#### Scenario: Detectar o fim de uma faixa
- **WHEN** uma faixa termina de tocar no player embutido
- **THEN** o app recebe essa informação pela interface oficial do player da plataforma, no navegador, sem nenhuma requisição à API do app

### Requirement: Spotify mantém o iframe de embed do MVP
O player do Spotify SHALL continuar sendo o mesmo iframe de embed oficial usado no MVP (`open.spotify.com/embed/track/<id>`, sem parâmetros adicionais), para que quem tem login no Spotify continue ouvindo a faixa completa. O sistema MUST NOT trocar esse iframe por outro que limite a reprodução à prévia.

#### Scenario: Ouvinte com login no Spotify
- **WHEN** alguém com login no Spotify neste navegador toca uma faixa do Spotify no app
- **THEN** a faixa toca completa, como no MVP, e o avanço automático continua funcionando ao fim dela

### Requirement: Ressalva da prévia do Spotify
O sistema SHALL exibir, junto ao player do Spotify, um aviso de que a faixa completa só toca se o ouvinte estiver logado na sua conta Spotify no navegador, e que caso contrário o Spotify toca apenas uma prévia de 30 segundos. O sistema MUST NOT tentar contornar essa limitação.

#### Scenario: Aviso exibido
- **WHEN** a usuária seleciona uma faixa da plataforma `spotify`
- **THEN** o app exibe o embed oficial do Spotify acompanhado do aviso sobre login e prévia de 30 segundos

### Requirement: Aviso quando o Spotify toca a prévia
Quando o embed do Spotify informar que está tocando uma prévia (duração da faixa carregada de até 30 segundos), o sistema SHALL exibir junto ao player um aviso com a orientação adequada ao navegador em uso:
- no Firefox: que basta clicar uma vez no play dentro do player do Spotify para ele reconhecer o login da conta Spotify neste navegador;
- no Safari e em navegadores de celular: que nesse navegador o Spotify toca apenas a prévia no player embutido;
- nos demais navegadores: que a faixa completa exige login no Spotify neste navegador e que, se já houver login, o navegador está bloqueando-o neste site (por exemplo, janela anônima ou cookies de terceiros bloqueados).

O aviso SHALL deixar de ser exibido quando o embed passar a informar a duração completa da faixa e quando outra faixa for carregada. O sistema MUST NOT recarregar, recriar ou trocar o embed do Spotify por causa da prévia, e MUST NOT tentar obter a faixa completa de nenhuma outra forma; a prévia continua tocando normalmente e o fim dela continua contando como fim da faixa.

#### Scenario: Prévia no Firefox
- **WHEN** uma faixa do Spotify é tocada no Firefox e o embed informa duração de até 30 segundos
- **THEN** o player continua tocando a prévia, sem recarga, e o app exibe junto a ele a orientação de clicar no play dentro do player do Spotify

#### Scenario: Clique no player libera a faixa completa
- **WHEN** o aviso de prévia está visível e o embed passa a informar a duração completa da faixa
- **THEN** o aviso de prévia deixa de ser exibido

#### Scenario: Prévia no Safari ou no celular
- **WHEN** uma faixa do Spotify toca a prévia no Safari ou num navegador de celular
- **THEN** o app exibe que nesse navegador o Spotify toca apenas a prévia no player embutido

#### Scenario: Prévia em outro navegador
- **WHEN** uma faixa do Spotify toca a prévia no Chrome ou no Edge
- **THEN** o app exibe que a faixa completa exige login no Spotify neste navegador e que, havendo login, o navegador o está bloqueando neste site

#### Scenario: Faixa completa
- **WHEN** o embed do Spotify informa a duração completa da faixa
- **THEN** nenhum aviso de prévia é exibido e o embed não é recarregado

#### Scenario: Troca de faixa
- **WHEN** o aviso de prévia está visível e outra faixa é carregada
- **THEN** o aviso some até que o embed informe de novo uma prévia

### Requirement: Faixa indisponível na origem
Como o app não consegue garantir a detecção de falhas dentro dos players de terceiros, o sistema SHALL sempre exibir, junto ao player, o rótulo, os metadados em cache e um link para a URL original da faixa, de forma que a usuária saiba qual era a faixa mesmo quando o player embutido não conseguir tocá-la.

#### Scenario: Vídeo removido do YouTube
- **WHEN** a usuária seleciona uma faixa cujo vídeo foi removido do YouTube e o player embutido mostra erro
- **THEN** o app continua exibindo rótulo, título, artista e thumbnail em cache e o link original da faixa

### Requirement: Nenhum áudio passa pelo sistema
O sistema MUST NOT hospedar, baixar, armazenar, transcodificar, fazer proxy ou redistribuir áudio ou vídeo em nenhuma hipótese. As únicas requisições do servidor às plataformas SHALL ser consultas de metadados oEmbed e resolução de redirecionamento de links curtos. O áudio SHALL fluir diretamente entre a plataforma de origem e o navegador do ouvinte, via player embutido.

#### Scenario: Armazenamento contém só referências
- **WHEN** o banco de dados e os arquivos publicados do app são inspecionados
- **THEN** eles contêm apenas URLs, identificadores, rótulos e metadados textuais/URLs de thumbnail, e nenhum arquivo ou fluxo de mídia

#### Scenario: Reprodução não passa pela API
- **WHEN** uma faixa está tocando no app
- **THEN** nenhuma requisição de mídia é feita à API do app; o tráfego de mídia vai direto para o domínio da plataforma
