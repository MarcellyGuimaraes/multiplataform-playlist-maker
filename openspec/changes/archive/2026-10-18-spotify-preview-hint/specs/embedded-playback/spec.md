# Spec Delta

## ADDED Requirements

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
