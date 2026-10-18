# Spec Delta

## MODIFIED Requirements

### Requirement: Criar playlist
O sistema SHALL permitir que uma pessoa logada crie uma playlist informando um nome. O nome MUST ter de 1 a 100 caracteres após remover espaços nas bordas. Ao ser criada, a playlist SHALL receber um identificador interno único, SHALL ter como dona a conta da sessão, SHALL nascer com visibilidade privada e sem token de compartilhamento, e SHALL começar sem faixas. Visitantes MUST NOT conseguir criar playlists; na interface, a ação de criar SHALL levar o visitante ao login.

#### Scenario: Criação com nome válido
- **WHEN** a usuária logada cria uma playlist com o nome "Ao vivo favoritas"
- **THEN** o sistema persiste a playlist com esse nome, sem faixas, privada, sem token de compartilhamento e com ela como dona, e a exibe para edição

#### Scenario: Nome vazio ou só espaços
- **WHEN** a usuária logada tenta criar uma playlist com o nome "   "
- **THEN** o sistema rejeita a operação com uma mensagem de erro de validação e não cria nenhuma playlist

#### Scenario: Nome longo demais
- **WHEN** a usuária logada tenta criar uma playlist com um nome de 101 caracteres
- **THEN** o sistema rejeita a operação com uma mensagem de erro de validação

#### Scenario: Visitante tenta criar pela API
- **WHEN** uma requisição sem sessão válida tenta criar uma playlist
- **THEN** o sistema responde com erro de "não autenticado" e não cria nenhuma playlist

#### Scenario: Visitante aciona criar na interface
- **WHEN** um visitante aciona a ação de criar playlist na tela inicial
- **THEN** a interface o leva para a tela de login

### Requirement: Listar playlists
A tela inicial SHALL listar playlists de acordo com a sessão, cada uma com nome e quantidade de faixas, ordenadas da atualizada mais recentemente para a mais antiga:
- Para visitantes, SHALL listar apenas as playlists públicas de todas as contas, que abrem pela visualização compartilhada somente leitura.
- Para quem está logada, SHALL listar primeiro "Minhas playlists" (todas as suas, públicas e privadas, com a indicação da visibilidade de cada uma), que abrem para edição, e depois as playlists públicas das outras contas, que abrem pela visualização compartilhada.

Playlists privadas de outras contas MUST NOT aparecer em nenhuma listagem. Para playlists de outras contas, a listagem MUST NOT incluir o identificador interno nem dados da conta dona.

#### Scenario: Visitante vê só públicas
- **WHEN** um visitante abre a tela inicial e existem uma playlist pública e uma privada
- **THEN** só a pública aparece, e abri-la mostra a visualização compartilhada sem controles de edição

#### Scenario: Lista com playlists
- **WHEN** Maria, logada, abre a tela inicial; ela tem uma playlist privada e uma pública, e Ana tem uma pública e uma privada
- **THEN** em "Minhas playlists" aparecem as duas de Maria com seus selos de visibilidade, e na seção de públicas aparece só a pública de Ana

#### Scenario: Listagem não expõe ids de outras contas
- **WHEN** a resposta da listagem é inspecionada por quem não é dona de uma playlist pública listada
- **THEN** essa entrada não contém o identificador interno da playlist nem o e-mail da dona

#### Scenario: Nenhuma playlist
- **WHEN** a usuária logada abre a tela inicial e ainda não tem playlists
- **THEN** a seção "Minhas playlists" exibe um estado vazio com a ação de criar a primeira playlist

#### Scenario: Nenhuma playlist pública
- **WHEN** um visitante abre a tela inicial e não existe nenhuma playlist pública
- **THEN** o sistema exibe um estado vazio convidando a entrar ou criar uma conta

### Requirement: Renomear playlist
O sistema SHALL permitir que a dona altere o nome de uma playlist sua, aplicando as mesmas regras de validação da criação. Renomear MUST NOT alterar a visibilidade, o token de compartilhamento nem as faixas.

#### Scenario: Renomear com sucesso
- **WHEN** a dona renomeia a playlist "Mix" para "Mix de domingo"
- **THEN** o sistema persiste o novo nome, mantém faixas, visibilidade e token, e atualiza o horário de modificação

#### Scenario: Renomear playlist inexistente
- **WHEN** uma requisição tenta renomear uma playlist cujo identificador não existe
- **THEN** o sistema responde com erro de "não encontrado" e nada é alterado

#### Scenario: Renomear playlist de outra conta
- **WHEN** Ana, logada, tenta renomear uma playlist de Maria usando o identificador interno
- **THEN** o sistema responde com erro de "não encontrado" e nada é alterado

### Requirement: Excluir playlist
O sistema SHALL permitir que a dona exclua uma playlist sua após confirmação explícita na interface. A exclusão MUST remover também todas as faixas da playlist e invalidar seu link de compartilhamento, se houver.

#### Scenario: Exclusão confirmada
- **WHEN** a dona exclui uma playlist pública com 5 faixas e confirma
- **THEN** a playlist e suas 5 faixas deixam de existir e o link público dela passa a responder "não encontrado"

#### Scenario: Exclusão cancelada
- **WHEN** a dona inicia a exclusão e cancela a confirmação
- **THEN** nada é removido

#### Scenario: Excluir playlist de outra conta
- **WHEN** Ana, logada, tenta excluir uma playlist de Maria usando o identificador interno
- **THEN** o sistema responde com erro de "não encontrado" e nada é removido

## ADDED Requirements

### Requirement: Acesso restrito à dona
A leitura de uma playlist pelo identificador interno (a visão de edição) e toda operação de escrita sobre ela ou suas faixas (renomear, excluir, alterar a visibilidade, regenerar o link, adicionar, remover, reordenar e editar o rótulo de faixas) SHALL ser permitida apenas à conta dona, com sessão válida. Sem sessão, o sistema MUST responder "não autenticado". Com sessão de outra conta, o sistema MUST responder "não encontrado", igual ao de uma playlist inexistente, sem revelar que ela existe nem se é pública ou privada.

#### Scenario: Dona abre para edição
- **WHEN** Maria, logada, abre a visão de edição da sua playlist
- **THEN** o sistema retorna a playlist com faixas, visibilidade e, se pública, o token de compartilhamento

#### Scenario: Outra conta tenta abrir pelo id
- **WHEN** Ana, logada, requisita a visão de edição de uma playlist de Maria pelo identificador interno
- **THEN** o sistema responde "não encontrado", seja a playlist pública ou privada

#### Scenario: Outra conta tenta adicionar faixa
- **WHEN** Ana, logada, tenta adicionar uma faixa a uma playlist de Maria
- **THEN** o sistema responde "não encontrado" e a playlist de Maria não muda

#### Scenario: Visitante tenta escrever
- **WHEN** uma requisição sem sessão tenta reordenar as faixas de uma playlist existente
- **THEN** o sistema responde "não autenticado" e nada é alterado

### Requirement: Alterar visibilidade
O sistema SHALL permitir que a dona alterne a visibilidade de uma playlist sua entre pública e privada. A interface de edição e o card em "Minhas playlists" SHALL indicar a visibilidade atual. Alterar a visibilidade MUST NOT alterar o nome nem as faixas.

#### Scenario: Tornar pública
- **WHEN** a dona torna pública uma playlist privada
- **THEN** a playlist passa a aparecer na tela inicial de visitantes e de outras contas, e ganha um link público

#### Scenario: Tornar privada
- **WHEN** a dona torna privada uma playlist pública
- **THEN** a playlist deixa de aparecer para visitantes e outras contas e o link público dela passa a responder "não encontrado"

#### Scenario: Selo de visibilidade
- **WHEN** a dona vê "Minhas playlists" com uma playlist pública e uma privada
- **THEN** cada card exibe a indicação "Pública" ou "Privada" correspondente
