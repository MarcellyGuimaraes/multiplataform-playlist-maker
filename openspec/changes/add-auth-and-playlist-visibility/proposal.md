# Proposal

## Why

Hoje não existe autenticação: a tela inicial lista todas as playlists com o identificador interno, e esse identificador basta para editar ou excluir qualquer uma delas. Na prática, qualquer visitante altera qualquer playlist. Além disso, não há como manter uma playlist só para si. Contas com e-mail e senha, dona por playlist e visibilidade pública/privada resolvem as duas coisas e são a base para as próximas telas do produto.

## What Changes

- Cadastro, login e logout com e-mail e senha, com sessão em cookie `httpOnly` guardada no banco.
- Recuperação de senha por link enviado por e-mail (conta Google/Gmail via SMTP), com token de uso único que expira em 1 hora.
- Toda playlist passa a ter uma dona. Só a dona pode renomear, excluir, mudar a visibilidade e mexer nas faixas (adicionar, remover, reordenar e editar o rótulo). **BREAKING**
- Criar playlist exige estar logada. Para visitantes, a ação de criar leva ao login. **BREAKING**
- Nova propriedade de visibilidade (`public` | `private`). Toda playlist nasce privada.
- O token de compartilhamento só existe enquanto a playlist é pública: tornar pública gera um token novo, tornar privada apaga o token, e o link antigo passa a responder "não encontrado". Regenerar o link só é possível em playlist pública. **BREAKING**
- A tela inicial muda conforme a sessão. Visitantes veem as playlists públicas de todo mundo, que abrem pelo link público somente leitura. Quem está logada vê "Minhas playlists" (públicas e privadas, com o selo de cada uma) e, abaixo, as públicas das outras pessoas.
- Uma playlist privada de outra pessoa é tratada como inexistente: a API responde "não encontrado", nunca "proibido".
- Remoção do requisito "Edição sem autenticação no MVP". **BREAKING**
- Migração destrutiva: as playlists e faixas existentes são apagadas, porque não têm dona. **BREAKING**

Fora do escopo: página de perfil, troca de senha logada, favoritos, "compartilhadas com você", estado "não listada", novas plataformas e o novo layout completo da tela.

## Capabilities

### New Capabilities
- `user-auth`: contas com e-mail e senha, sessão por cookie, logout, recuperação de senha por e-mail e as regras de segurança dessas operações.

### Modified Capabilities
- `playlist-management`: criar exige sessão e define a dona; a playlist nasce privada sem token; a listagem passa a depender da sessão e da visibilidade; renomear, excluir e editar faixas ficam restritos à dona; nova operação de alterar a visibilidade.
- `playlist-sharing`: o link público passa a existir só para playlists públicas, com um ciclo de vida do token ligado à visibilidade; regenerar exige playlist pública; o requisito "Edição sem autenticação no MVP" é substituído por uma regra de posse.

## Impact

- **Banco**: nova migração `002_auth_visibility.sql` que apaga os dados atuais, cria as tabelas `users`, `sessions` e `password_resets`, adiciona `owner_id` e `visibility` em `playlists` e torna `share_token` anulável.
- **API**: novas rotas `api/auth/*` (cadastro, login, logout, sessão atual, pedido e confirmação de redefinição de senha); todas as rotas em `api/playlists/**` passam a ler a sessão e checar a dona; nova rota (ou campo no `PATCH`) para mudar a visibilidade; `api/shared/[token].ts` só encontra playlists públicas.
- **Infra de dev**: `scripts/vite-dev-api.ts` hoje passa `cookies: {}`, então precisa repassar os cookies da requisição e permitir `Set-Cookie`.
- **Front**: contexto de sessão, telas de login, cadastro, "esqueci a senha" e "nova senha", home dividida por sessão, controle de visibilidade e selo Pública/Privada; `PlaylistPage` deixa de mostrar o link quando a playlist é privada.
- **Dependências**: `nodemailer` para envio de e-mail. O hash de senha usa `scrypt` do `node:crypto`, sem dependência nova.
- **Ambiente**: novas variáveis só de servidor, como `SMTP_USER`, `SMTP_APP_PASSWORD` e `APP_URL` (para montar o link de redefinição).
- **Testes**: os testes de API em `tests/api/*` precisam de um helper de sessão autenticada, e surgem testes de autorização entre duas usuárias.
