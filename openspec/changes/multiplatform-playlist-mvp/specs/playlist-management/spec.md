# Spec Delta

## Purpose

Permite criar, nomear, listar, renomear e excluir playlists que agrupam referências a faixas de várias plataformas, com todo acesso a dados passando por uma API no servidor.

## ADDED Requirements

### Requirement: Criar playlist
O sistema SHALL permitir criar uma playlist informando um nome. O nome MUST ter de 1 a 100 caracteres após remover espaços nas bordas. Ao ser criada, a playlist SHALL receber um identificador interno único e um token público de compartilhamento distinto do identificador interno, e SHALL começar sem faixas.

#### Scenario: Criação com nome válido
- **WHEN** a usuária cria uma playlist com o nome "Ao vivo favoritas"
- **THEN** o sistema persiste a playlist com esse nome, sem faixas, com identificador interno e token de compartilhamento próprios, e a exibe para edição

#### Scenario: Nome vazio ou só espaços
- **WHEN** a usuária tenta criar uma playlist com o nome "   "
- **THEN** o sistema rejeita a operação com uma mensagem de erro de validação e não cria nenhuma playlist

#### Scenario: Nome longo demais
- **WHEN** a usuária tenta criar uma playlist com um nome de 101 caracteres
- **THEN** o sistema rejeita a operação com uma mensagem de erro de validação

### Requirement: Listar playlists
O sistema SHALL listar todas as playlists existentes com nome e quantidade de faixas, ordenadas da atualizada mais recentemente para a mais antiga, e SHALL permitir abrir uma playlist por vez para edição.

#### Scenario: Lista com playlists
- **WHEN** a usuária abre a tela inicial e existem duas playlists
- **THEN** o sistema exibe as duas com nome e quantidade de faixas, a mais recentemente atualizada primeiro

#### Scenario: Nenhuma playlist
- **WHEN** a usuária abre a tela inicial e não existe nenhuma playlist
- **THEN** o sistema exibe um estado vazio com a ação de criar a primeira playlist

### Requirement: Renomear playlist
O sistema SHALL permitir alterar o nome de uma playlist existente, aplicando as mesmas regras de validação da criação. Renomear MUST NOT alterar o token de compartilhamento nem as faixas.

#### Scenario: Renomear com sucesso
- **WHEN** a usuária renomeia a playlist "Mix" para "Mix de domingo"
- **THEN** o sistema persiste o novo nome, mantém faixas e token, e atualiza o horário de modificação

#### Scenario: Renomear playlist inexistente
- **WHEN** uma requisição tenta renomear uma playlist cujo identificador não existe
- **THEN** o sistema responde com erro de "não encontrado" e nada é alterado

### Requirement: Excluir playlist
O sistema SHALL permitir excluir uma playlist após confirmação explícita na interface. A exclusão MUST remover também todas as faixas da playlist e invalidar seu link de compartilhamento.

#### Scenario: Exclusão confirmada
- **WHEN** a usuária exclui uma playlist com 5 faixas e confirma
- **THEN** a playlist e suas 5 faixas deixam de existir e o link público dela passa a responder "não encontrado"

#### Scenario: Exclusão cancelada
- **WHEN** a usuária inicia a exclusão e cancela a confirmação
- **THEN** nada é removido

### Requirement: Acesso a dados exclusivamente pelo servidor
Toda leitura e escrita de playlists e faixas SHALL passar pela API do servidor. As credenciais do banco de dados MUST existir apenas no ambiente do servidor e MUST NOT ser incluídas no código, nos arquivos estáticos ou nas respostas enviadas ao navegador.

#### Scenario: Bundle do front sem credenciais
- **WHEN** o código entregue ao navegador é inspecionado
- **THEN** ele não contém a connection string do banco nem qualquer credencial de acesso direto ao banco

#### Scenario: Erro interno sem vazamento
- **WHEN** ocorre uma falha de conexão com o banco durante uma requisição
- **THEN** a API responde com um erro genérico, sem incluir connection string, host do banco ou stack trace na resposta
