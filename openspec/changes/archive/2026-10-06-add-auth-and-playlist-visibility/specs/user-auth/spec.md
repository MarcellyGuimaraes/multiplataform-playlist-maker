# Spec Delta

## Purpose

Permite que cada pessoa tenha uma conta com e-mail e senha, mantenha uma sessão no navegador e recupere o acesso por e-mail, servindo de base para a posse e a privacidade das playlists.

## ADDED Requirements

### Requirement: Cadastro com e-mail e senha
O sistema SHALL permitir criar uma conta informando e-mail e senha. O e-mail MUST ser normalizado (sem espaços nas bordas e em minúsculas) antes de validar e gravar, MUST ter formato válido e MUST ser único entre as contas. A senha MUST ter de 8 a 128 caracteres. Após o cadastro, a pessoa SHALL ficar logada automaticamente.

#### Scenario: Cadastro válido
- **WHEN** alguém se cadastra com "Maria@Exemplo.com " e a senha "segredo123"
- **THEN** o sistema cria a conta com o e-mail "maria@exemplo.com", inicia uma sessão e exibe a tela inicial logada

#### Scenario: E-mail já cadastrado
- **WHEN** alguém tenta se cadastrar com um e-mail que já tem conta, com qualquer combinação de maiúsculas e minúsculas
- **THEN** o sistema rejeita o cadastro com uma mensagem de conflito e não cria outra conta

#### Scenario: Senha curta demais
- **WHEN** alguém tenta se cadastrar com a senha "1234567"
- **THEN** o sistema rejeita o cadastro com uma mensagem de erro de validação

#### Scenario: E-mail inválido
- **WHEN** alguém tenta se cadastrar com o e-mail "maria@"
- **THEN** o sistema rejeita o cadastro com uma mensagem de erro de validação

### Requirement: Armazenamento seguro de senha
A senha MUST ser guardada apenas como hash gerado por uma função de derivação de chave lenta, com salt aleatório por conta. A senha em texto puro e o hash MUST NOT aparecer em nenhuma resposta da API nem nos logs.

#### Scenario: Senha não armazenada em texto puro
- **WHEN** a conta de "maria@exemplo.com" com a senha "segredo123" é inspecionada no banco
- **THEN** o valor guardado não contém "segredo123" e é diferente do valor guardado para outra conta com a mesma senha

#### Scenario: Respostas sem dados de senha
- **WHEN** qualquer rota de autenticação responde com sucesso ou erro
- **THEN** a resposta não contém a senha nem o hash

### Requirement: Login
O sistema SHALL permitir entrar com e-mail e senha. Com credenciais corretas, o sistema SHALL iniciar uma sessão. Com e-mail inexistente ou senha incorreta, o sistema MUST responder com a mesma mensagem genérica ("E-mail ou senha inválidos"), sem indicar qual dos dois está errado.

#### Scenario: Login correto
- **WHEN** a dona de "maria@exemplo.com" entra com a senha correta
- **THEN** o sistema inicia uma sessão e exibe a tela inicial logada

#### Scenario: Senha incorreta
- **WHEN** alguém entra com "maria@exemplo.com" e uma senha errada
- **THEN** o sistema responde "E-mail ou senha inválidos" e não inicia sessão

#### Scenario: E-mail sem conta
- **WHEN** alguém entra com um e-mail que não tem conta
- **THEN** o sistema responde exatamente a mesma mensagem do caso de senha incorreta

### Requirement: Sessão por cookie
A sessão SHALL ser identificada por um valor aleatório com pelo menos 128 bits de entropia, enviado ao navegador em um cookie `HttpOnly`, `SameSite=Lax` e, fora do ambiente de desenvolvimento local, `Secure`. A sessão SHALL expirar 30 dias após ser criada. O sistema SHALL oferecer uma forma de consultar quem está logado, que responde sem dados de conta quando não há sessão válida.

#### Scenario: Sessão persiste entre recarregamentos
- **WHEN** a usuária logada recarrega a página
- **THEN** continua logada

#### Scenario: Sessão expirada
- **WHEN** uma requisição usa um cookie de sessão criado há mais de 30 dias
- **THEN** o sistema trata a requisição como de visitante

#### Scenario: Cookie inexistente ou adulterado
- **WHEN** uma requisição envia um cookie de sessão que não corresponde a nenhuma sessão
- **THEN** o sistema trata a requisição como de visitante

#### Scenario: Cookie inacessível ao JavaScript
- **WHEN** o cookie de sessão é emitido
- **THEN** ele tem o atributo `HttpOnly`

### Requirement: Logout
O sistema SHALL permitir sair da conta. O logout MUST invalidar a sessão no servidor, e não apenas apagar o cookie no navegador.

#### Scenario: Sair
- **WHEN** a usuária logada sai da conta
- **THEN** a tela inicial passa a ser a de visitante

#### Scenario: Cookie antigo após logout
- **WHEN** alguém reenvia o cookie de uma sessão que já saiu
- **THEN** o sistema trata a requisição como de visitante

### Requirement: Pedido de redefinição de senha
O sistema SHALL permitir pedir a redefinição de senha informando o e-mail. Se houver conta com esse e-mail, o sistema SHALL enviar a ele um link com um token de redefinição de uso único, com pelo menos 128 bits de entropia, válido por 1 hora. A resposta ao pedido MUST ser a mesma exista ou não a conta ("Se o e-mail estiver cadastrado, enviamos um link"). O token MUST ser guardado no banco apenas como hash.

#### Scenario: Pedido para e-mail cadastrado
- **WHEN** alguém pede a redefinição para "maria@exemplo.com", que tem conta
- **THEN** o sistema envia um e-mail com o link de redefinição e mostra a mensagem neutra

#### Scenario: Pedido para e-mail sem conta
- **WHEN** alguém pede a redefinição para um e-mail sem conta
- **THEN** nenhum e-mail é enviado e o sistema mostra exatamente a mesma mensagem neutra

### Requirement: Redefinir senha com o token
Com um token de redefinição válido, o sistema SHALL permitir definir uma nova senha, aplicando as mesmas regras de validação do cadastro. Ao redefinir, o token MUST deixar de valer e todas as sessões existentes da conta MUST ser invalidadas. Depois disso, a pessoa SHALL entrar com a nova senha.

#### Scenario: Redefinição bem-sucedida
- **WHEN** a usuária abre o link recebido dentro de 1 hora e define a senha "novaSenha99"
- **THEN** o login com "novaSenha99" funciona e o login com a senha anterior falha

#### Scenario: Sessões antigas encerradas
- **WHEN** a senha é redefinida enquanto a conta estava logada em outro navegador
- **THEN** a sessão do outro navegador passa a ser tratada como de visitante

#### Scenario: Token reutilizado
- **WHEN** alguém tenta usar de novo um token que já redefiniu a senha
- **THEN** o sistema rejeita com uma mensagem de link inválido ou expirado

#### Scenario: Token expirado
- **WHEN** alguém usa um token emitido há mais de 1 hora
- **THEN** o sistema rejeita com uma mensagem de link inválido ou expirado e a senha não muda

### Requirement: Credenciais de e-mail só no servidor
As credenciais usadas para enviar e-mails MUST existir apenas no ambiente do servidor e MUST NOT ser incluídas no código entregue ao navegador nem nas respostas da API.

#### Scenario: Bundle sem credenciais de e-mail
- **WHEN** o código entregue ao navegador é inspecionado
- **THEN** ele não contém o usuário nem a senha de app usados no envio de e-mails
