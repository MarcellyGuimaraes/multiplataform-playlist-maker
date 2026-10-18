# Spec Delta

## ADDED Requirements

### Requirement: Troca para a versão no YouTube quando o Spotify toca a prévia
Quando o embed do Spotify informar que está tocando uma prévia (duração da faixa carregada de até 30 segundos) e a faixa tiver versão no YouTube cadastrada, o sistema SHALL substituir o player do Spotify pelo player oficial do YouTube com o vídeo alternativo, mantendo a mesma faixa como atual na fila, e SHALL pedir o início da reprodução. A prévia tocada antes da troca MUST NOT contar como fim da faixa. O fim do vídeo alternativo SHALL contar como fim da faixa para o avanço automático, e um erro do vídeo alternativo SHALL ser tratado como faixa indisponível.

Enquanto a versão no YouTube estiver tocando, o sistema SHALL exibir junto ao player que a faixa está tocando pelo YouTube porque o Spotify só liberou a prévia neste navegador, e SHALL oferecer uma ação para voltar ao Spotify. Voltar ao Spotify SHALL montar de novo o embed do Spotify na mesma faixa e MUST NOT trocar de novo para o YouTube nessa faixa.

Depois que uma prévia do Spotify for detectada, as faixas do Spotify carregadas em seguida que tiverem versão no YouTube SHALL começar direto pelo YouTube enquanto a página estiver aberta. Esse comportamento SHALL ser desfeito quando a pessoa voltar ao Spotify ou quando o embed do Spotify informar a duração completa de uma faixa.

#### Scenario: Prévia com versão no YouTube
- **WHEN** uma faixa do Spotify com versão no YouTube é tocada e o embed informa duração de até 30 segundos
- **THEN** o player do Spotify dá lugar ao player do YouTube com o vídeo alternativo, que começa a tocar, e o app mostra que a faixa está tocando pelo YouTube

#### Scenario: Fim do vídeo alternativo
- **WHEN** o vídeo alternativo chega ao fim com o autoplay ligado
- **THEN** o app avança para a próxima faixa da fila

#### Scenario: Faixa completa no Spotify
- **WHEN** uma faixa do Spotify com versão no YouTube é tocada e o embed informa a duração completa
- **THEN** a faixa continua no Spotify e não há troca

#### Scenario: Voltar ao Spotify
- **WHEN** a versão no YouTube está tocando e a pessoa aciona voltar ao Spotify
- **THEN** o embed do Spotify volta na mesma faixa e, mesmo que toque a prévia, não há nova troca para o YouTube nessa faixa

#### Scenario: Próximas faixas começam pelo YouTube
- **WHEN** uma prévia já foi detectada nesta página e a fila avança para outra faixa do Spotify com versão no YouTube
- **THEN** a faixa começa direto pelo player do YouTube, sem passar pela prévia do Spotify

#### Scenario: Faixa sem versão no YouTube
- **WHEN** uma faixa do Spotify sem versão no YouTube toca a prévia
- **THEN** não há troca: a prévia toca e o aviso de prévia por navegador é exibido

## MODIFIED Requirements

### Requirement: Ressalva da prévia do Spotify
O sistema SHALL exibir, junto ao player do Spotify, um aviso de que a faixa completa só toca se o ouvinte estiver logado na sua conta Spotify no navegador, e que caso contrário o Spotify toca apenas uma prévia de 30 segundos. O sistema MUST NOT tentar contornar essa limitação dentro do Spotify. Tocar a versão no YouTube que a dona cadastrou para a faixa não é contorno: é outro vídeo, em outra plataforma, tocado pelo player oficial dela.

#### Scenario: Aviso exibido
- **WHEN** a usuária seleciona uma faixa da plataforma `spotify`
- **THEN** o app exibe o embed oficial do Spotify acompanhado do aviso sobre login e prévia de 30 segundos

### Requirement: Aviso quando o Spotify toca a prévia
Quando o embed do Spotify informar que está tocando uma prévia (duração da faixa carregada de até 30 segundos) e a faixa não tiver versão no YouTube cadastrada, o sistema SHALL exibir junto ao player um aviso com a orientação adequada ao navegador em uso:
- no Firefox: que basta clicar uma vez no play dentro do player do Spotify para ele reconhecer o login da conta Spotify neste navegador;
- no Safari e em navegadores de celular: que nesse navegador o Spotify toca apenas a prévia no player embutido;
- nos demais navegadores: que a faixa completa exige login no Spotify neste navegador e que, se já houver login, o navegador está bloqueando-o neste site (por exemplo, janela anônima ou cookies de terceiros bloqueados).

Quando quem vê o aviso é a dona da playlist, na tela de edição, o aviso SHALL sugerir também cadastrar uma versão no YouTube para a faixa.

O aviso SHALL deixar de ser exibido quando o embed passar a informar a duração completa da faixa e quando outra faixa for carregada. O sistema MUST NOT recarregar ou recriar o embed do Spotify por causa da prévia, e MUST NOT tentar obter a faixa completa pelo Spotify de nenhuma outra forma; a única troca permitida é para a versão no YouTube cadastrada, conforme "Troca para a versão no YouTube quando o Spotify toca a prévia". Sem versão no YouTube, a prévia continua tocando normalmente e o fim dela continua contando como fim da faixa.

#### Scenario: Prévia no Firefox
- **WHEN** uma faixa do Spotify sem versão no YouTube é tocada no Firefox e o embed informa duração de até 30 segundos
- **THEN** o player continua tocando a prévia, sem recarga, e o app exibe junto a ele a orientação de clicar no play dentro do player do Spotify

#### Scenario: Clique no player libera a faixa completa
- **WHEN** o aviso de prévia está visível e o embed passa a informar a duração completa da faixa
- **THEN** o aviso de prévia deixa de ser exibido

#### Scenario: Prévia no Safari ou no celular
- **WHEN** uma faixa do Spotify sem versão no YouTube toca a prévia no Safari ou num navegador de celular
- **THEN** o app exibe que nesse navegador o Spotify toca apenas a prévia no player embutido

#### Scenario: Prévia em outro navegador
- **WHEN** uma faixa do Spotify sem versão no YouTube toca a prévia no Chrome ou no Edge
- **THEN** o app exibe que a faixa completa exige login no Spotify neste navegador e que, havendo login, o navegador o está bloqueando neste site

#### Scenario: Sugestão para a dona
- **WHEN** a dona toca, na tela de edição, uma faixa do Spotify sem versão no YouTube e o embed informa a prévia
- **THEN** o aviso inclui a sugestão de cadastrar uma versão no YouTube para essa faixa

#### Scenario: Faixa completa
- **WHEN** o embed do Spotify informa a duração completa da faixa
- **THEN** nenhum aviso de prévia é exibido e o embed não é recarregado

#### Scenario: Troca de faixa
- **WHEN** o aviso de prévia está visível e outra faixa é carregada
- **THEN** o aviso some até que o embed informe de novo uma prévia
