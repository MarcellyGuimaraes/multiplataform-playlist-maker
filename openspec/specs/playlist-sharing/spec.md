# playlist-sharing Specification

## Purpose
Permite compartilhar uma playlist por um link público baseado em token, que dá a quem recebe uma visualização somente leitura com reprodução pelos players embutidos.

## Requirements

### Requirement: Link público de compartilhamento
Apenas playlists públicas SHALL ter link público, formado a partir do seu token de compartilhamento. O token MUST ser gerado aleatoriamente com pelo menos 128 bits de entropia, ser seguro para URL e ser distinto do identificador interno da playlist. Sempre que uma playlist passar de privada para pública, o sistema SHALL gerar um token novo, nunca reaproveitar um anterior. Quando uma playlist passar a ser privada, o sistema MUST apagar o token, que deixa de funcionar imediatamente. A interface de edição SHALL oferecer a ação de copiar o link somente quando a playlist for pública.

#### Scenario: Copiar link
- **WHEN** a dona aciona "copiar link público" em uma playlist pública
- **THEN** a URL pública contendo o token de compartilhamento é copiada para a área de transferência

#### Scenario: Playlist privada sem link
- **WHEN** a dona abre a edição de uma playlist privada
- **THEN** a interface não oferece link público para copiar

#### Scenario: Token não revela o identificador interno
- **WHEN** o link público é inspecionado
- **THEN** ele não contém o identificador interno da playlist

#### Scenario: Privar invalida o link
- **WHEN** a dona torna privada uma playlist pública cujo link já foi enviado a alguém
- **THEN** esse link passa a responder "não encontrado"

#### Scenario: Republicar gera link novo
- **WHEN** a dona torna privada e depois pública de novo uma playlist
- **THEN** a playlist ganha um link com token diferente do anterior, e o link anterior continua respondendo "não encontrado"

### Requirement: Visualização compartilhada somente leitura
Ao abrir o link público de uma playlist pública, qualquer pessoa, logada ou não, SHALL ver o nome da playlist e suas faixas na ordem atual, com rótulos, metadados em cache e reprodução pelos players embutidos, sem nenhum controle de edição. A resposta pública MUST NOT incluir o identificador interno da playlist, dados da conta dona nem qualquer dado que permita usar as operações de escrita.

#### Scenario: Abrir link válido
- **WHEN** alguém abre o link público de uma playlist pública com 4 faixas
- **THEN** vê o nome e as 4 faixas na ordem atual, pode tocar cada uma pelo player embutido e não vê ações de adicionar, renomear, reordenar, remover, excluir ou mudar a visibilidade

#### Scenario: Alterações refletidas
- **WHEN** a dona adiciona uma faixa e alguém recarrega o link público em seguida
- **THEN** a nova faixa aparece na visualização compartilhada

#### Scenario: Token inexistente
- **WHEN** alguém abre um link público com um token que não corresponde a nenhuma playlist pública
- **THEN** o sistema exibe uma página de "playlist não encontrada" sem revelar se o token já existiu nem se a playlist existe como privada

### Requirement: Regenerar link público
O sistema SHALL permitir que a dona gere um novo token de compartilhamento para uma playlist pública sua, após confirmação na interface. O token anterior MUST deixar de funcionar imediatamente. Para uma playlist privada, a operação MUST ser rejeitada sem criar token.

#### Scenario: Link antigo invalidado
- **WHEN** a dona regenera o link público de uma playlist pública
- **THEN** o link novo passa a exibir a playlist e o link antigo passa a responder "não encontrado"

#### Scenario: Regenerar em playlist privada
- **WHEN** a dona tenta regenerar o link de uma playlist privada
- **THEN** o sistema rejeita a operação com uma mensagem de conflito e a playlist continua sem token

### Requirement: Link público não concede escrita
O token de compartilhamento SHALL dar acesso apenas à visualização somente leitura. Nenhuma operação de escrita MUST aceitar o token no lugar do identificador interno, mesmo com uma sessão válida.

#### Scenario: Tentativa de escrita com token público
- **WHEN** uma requisição de escrita (adicionar, remover, reordenar, renomear, excluir ou mudar a visibilidade) usa o token de compartilhamento no lugar do identificador interno
- **THEN** o sistema responde "não encontrado" e nada é alterado
