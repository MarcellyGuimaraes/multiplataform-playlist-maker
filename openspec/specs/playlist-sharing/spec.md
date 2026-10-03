# playlist-sharing Specification

## Purpose
Permite compartilhar uma playlist por um link público baseado em token, que dá a quem recebe uma visualização somente leitura com reprodução pelos players embutidos.

## Requirements

### Requirement: Link público de compartilhamento
Cada playlist SHALL ter um link público formado a partir do seu token de compartilhamento. O token MUST ser gerado aleatoriamente com pelo menos 128 bits de entropia, ser seguro para URL e ser distinto do identificador interno da playlist. A interface de edição SHALL oferecer uma ação para copiar esse link.

#### Scenario: Copiar link
- **WHEN** a usuária aciona "copiar link público" em uma playlist
- **THEN** a URL pública contendo o token de compartilhamento é copiada para a área de transferência

#### Scenario: Token não revela o identificador interno
- **WHEN** o link público é inspecionado
- **THEN** ele não contém o identificador interno da playlist

### Requirement: Visualização compartilhada somente leitura
Ao abrir o link público, o sistema SHALL exibir o nome da playlist e suas faixas na ordem atual, com rótulos, metadados em cache e reprodução pelos players embutidos, sem nenhum controle de edição. A resposta pública MUST NOT incluir o identificador interno da playlist nem qualquer dado que permita usar as operações de escrita.

#### Scenario: Abrir link válido
- **WHEN** alguém abre o link público de uma playlist com 4 faixas
- **THEN** vê o nome e as 4 faixas na ordem atual, pode tocar cada uma pelo player embutido e não vê ações de adicionar, renomear, reordenar, remover ou excluir

#### Scenario: Alterações refletidas
- **WHEN** a dona adiciona uma faixa e alguém recarrega o link público em seguida
- **THEN** a nova faixa aparece na visualização compartilhada

#### Scenario: Token inexistente
- **WHEN** alguém abre um link público com um token que não corresponde a nenhuma playlist
- **THEN** o sistema exibe uma página de "playlist não encontrada" sem revelar se o token já existiu

### Requirement: Regenerar link público
O sistema SHALL permitir gerar um novo token de compartilhamento para uma playlist, após confirmação na interface. O token anterior MUST deixar de funcionar imediatamente.

#### Scenario: Link antigo invalidado
- **WHEN** a usuária regenera o link público de uma playlist
- **THEN** o link novo passa a exibir a playlist e o link antigo passa a responder "não encontrado"

### Requirement: Edição sem autenticação no MVP
No MVP não há autenticação: as operações de escrita SHALL ser endereçadas pelo identificador interno da playlist, que é exibido apenas na interface de edição. Quem conhece apenas o link público MUST NOT conseguir editar a playlist por meio dele.

#### Scenario: Tentativa de escrita com token público
- **WHEN** uma requisição de escrita (adicionar, remover, reordenar, renomear ou excluir) usa o token de compartilhamento no lugar do identificador interno
- **THEN** o sistema responde "não encontrado" e nada é alterado
