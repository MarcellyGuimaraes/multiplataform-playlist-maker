# Spec Delta

## Purpose

Permite ouvir uma playlist do começo ao fim sem intervenção: as faixas são emendadas automaticamente entre YouTube, Spotify e SoundCloud. Inclui controles de anterior/próxima, repetir, aleatório e autoplay, sempre usando os players oficiais no navegador.

## ADDED Requirements

### Requirement: Início da reprodução por ação de quem ouve
A primeira faixa de uma sessão de escuta SHALL começar apenas por uma ação explícita (acionar "Tocar" em uma faixa ou nos controles do player). O app MUST NOT iniciar a reprodução sozinho ao abrir uma playlist, seja na tela de edição ou no link público.

#### Scenario: Abrir a playlist
- **WHEN** alguém abre uma playlist com faixas
- **THEN** nenhum player toca até que a pessoa acione "Tocar" em alguma faixa

### Requirement: Avanço automático ao fim da faixa
Com o autoplay ligado, quando a plataforma informar que a faixa atual terminou, o sistema SHALL carregar a próxima faixa da fila no player oficial da plataforma dela e solicitar o início da reprodução, inclusive quando a próxima faixa é de outra plataforma. Para o Spotify, que não emite evento de fim, o término SHALL ser inferido pelo progresso informado pelo player ter alcançado a duração da faixa. Sem login no Spotify, o fim da prévia de 30 segundos conta como fim da faixa.

#### Scenario: Faixa do YouTube termina e a próxima é do SoundCloud
- **WHEN** o autoplay está ligado, uma faixa do YouTube termina e a próxima na fila é do SoundCloud
- **THEN** o player do YouTube é substituído pelo widget oficial do SoundCloud com a próxima faixa, a reprodução dela é solicitada e ela aparece marcada como "tocando" na lista

#### Scenario: Prévia do Spotify termina
- **WHEN** o autoplay está ligado e a prévia de 30 segundos de uma faixa do Spotify chega ao fim, para quem não tem login
- **THEN** o app avança para a próxima faixa da fila

#### Scenario: Autoplay desligado
- **WHEN** o autoplay está desligado e a faixa atual termina
- **THEN** o app não carrega nem toca outra faixa sozinho

### Requirement: Anterior e próxima
O player SHALL oferecer controles "anterior" e "próxima", acessíveis por teclado, que carregam e tocam a faixa adjacente na fila atual, independentemente do autoplay estar ligado. Com "repetir" desligado, "anterior" MUST ficar indisponível na primeira faixa da fila e "próxima" MUST ficar indisponível na última. Com "repetir" ligado, os dois controles SHALL dar a volta na fila.

#### Scenario: Pular para a próxima
- **WHEN** a segunda de quatro faixas está tocando e a pessoa aciona "próxima"
- **THEN** a terceira faixa é carregada e tocada

#### Scenario: Limites sem repetir
- **WHEN** a primeira faixa da fila está tocando e "repetir" está desligado
- **THEN** "anterior" está indisponível

#### Scenario: Volta com repetir
- **WHEN** a última faixa da fila está tocando, "repetir" está ligado e a pessoa aciona "próxima"
- **THEN** a primeira faixa da fila é carregada e tocada

### Requirement: Fim da playlist e repetir
Com "repetir" desligado, ao terminar a última faixa da fila a reprodução SHALL parar, mantendo a última faixa selecionada no player. Com "repetir" ligado e o autoplay ligado, ao terminar a última faixa o sistema SHALL continuar pela primeira faixa da fila.

#### Scenario: Fim sem repetir
- **WHEN** a última faixa termina com autoplay ligado e "repetir" desligado
- **THEN** nenhuma outra faixa é carregada e a reprodução para

#### Scenario: Fim com repetir
- **WHEN** a última faixa termina com autoplay e "repetir" ligados
- **THEN** a primeira faixa da fila é carregada e tocada

### Requirement: Modo aleatório
Com o modo aleatório ligado, a fila SHALL seguir uma permutação aleatória das faixas da playlist, em que cada faixa aparece exatamente uma vez por ciclo e a faixa atual permanece como a atual. Ao desligar o modo aleatório, a fila SHALL voltar à ordem da playlist, continuando a partir da faixa que estiver tocando. A ordem da playlist salva MUST NOT ser alterada pelo modo aleatório.

#### Scenario: Ciclo aleatório completo
- **WHEN** o modo aleatório está ligado numa playlist de 5 faixas e o autoplay avança até o fim da fila
- **THEN** cada uma das 5 faixas tocou exatamente uma vez

#### Scenario: Desligar o aleatório
- **WHEN** a terceira faixa da playlist está tocando no modo aleatório e a pessoa desliga o modo aleatório
- **THEN** a próxima faixa passa a ser a quarta da playlist, e a ordem salva da playlist não mudou

### Requirement: Preferências de reprodução no navegador
O player SHALL oferecer interruptores de autoplay, "repetir" e modo aleatório, com o estado de cada um exposto de forma acessível. Os valores padrão MUST ser: autoplay ligado, "repetir" desligado e aleatório desligado. As escolhas SHALL ser lembradas apenas no navegador de quem ouve, valendo para todas as playlists naquele navegador, e MUST NOT ser enviadas ao servidor. Se o armazenamento do navegador estiver indisponível, o player SHALL funcionar com os valores padrão.

#### Scenario: Preferência lembrada
- **WHEN** a pessoa desliga o autoplay e recarrega a página
- **THEN** o autoplay continua desligado

#### Scenario: Armazenamento indisponível
- **WHEN** o navegador bloqueia o armazenamento local, por exemplo numa janela privada restrita
- **THEN** o player funciona com autoplay ligado, "repetir" e aleatório desligados, sem erro

### Requirement: Faixa indisponível durante a reprodução
Quando o player da plataforma informar um erro de reprodução (por exemplo, vídeo removido ou bloqueado para embed), o sistema SHALL exibir um aviso de que a faixa está indisponível, mantendo visíveis o rótulo, os metadados em cache e o link original. Com o autoplay ligado, SHALL avançar automaticamente para a próxima faixa após cerca de 3 segundos. Com o autoplay desligado, SHALL permanecer na faixa com o aviso.

#### Scenario: Vídeo removido no meio da fila
- **WHEN** o autoplay está ligado e o player do YouTube informa erro ao carregar a próxima faixa
- **THEN** o app mostra o aviso de faixa indisponível e, após cerca de 3 segundos, avança para a faixa seguinte

### Requirement: Início automático bloqueado pelo navegador
Se, após carregar a próxima faixa automaticamente, a reprodução não começar em até cerca de 5 segundos (por exemplo, pela política de autoplay do navegador), o sistema SHALL manter essa faixa carregada e selecionada e exibir um aviso pedindo para acionar o play. Quando a reprodução começar, o aviso SHALL sumir e a fila SHALL seguir normalmente. O sistema MUST NOT tentar contornar as políticas de autoplay do navegador.

#### Scenario: Autoplay bloqueado
- **WHEN** a próxima faixa é carregada automaticamente e o navegador impede o início da reprodução
- **THEN** a faixa fica selecionada no player com o aviso "toque em play para continuar" e, ao tocar, o avanço automático continua nas faixas seguintes

### Requirement: Fila acompanha mudanças na playlist
Na tela de edição, a fila SHALL refletir a lista de faixas atual durante a reprodução: faixas adicionadas entram na fila, faixas removidas saem dela e reordenações alteram qual é a próxima faixa. Remover a faixa que está tocando SHALL parar a reprodução e fechar o player.

#### Scenario: Reordenar durante a reprodução
- **WHEN** a primeira de três faixas está tocando e a pessoa move a terceira para a segunda posição
- **THEN** ao fim da faixa atual, toca a faixa que agora está na segunda posição

#### Scenario: Remover a faixa atual
- **WHEN** a pessoa remove a faixa que está tocando
- **THEN** a reprodução para e o player é fechado

### Requirement: Reprodução contínua no link público
A visualização compartilhada SHALL oferecer a mesma reprodução contínua e os mesmos controles de reprodução (anterior, próxima, autoplay, repetir e aleatório), sem nenhum controle de edição.

#### Scenario: Ouvir pelo link público
- **WHEN** alguém abre o link público, toca a primeira faixa e o autoplay está ligado
- **THEN** as faixas seguintes tocam em sequência, e nenhuma ação de edição é exibida
