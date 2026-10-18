# Tasks

## 1. Banco e configuração

- [x] 1.1 Criar `db/migrations/002_auth_visibility.sql` (apaga `tracks`/`playlists`, cria `users`, `sessions`, `password_resets`, adiciona `owner_id`, `visibility`, `share_token` anulável, o check visibilidade↔token e os índices) e verificar que `npm run dev` sem `DATABASE_URL` aplica a migração no PGlite sem erro
- [x] 1.2 Adicionar `nodemailer` (e `@types/nodemailer`) ao `package.json` e verificar que `npm install` e `npm run build` passam
- [x] 1.3 Documentar `SMTP_USER`, `SMTP_APP_PASSWORD` e `APP_URL` no `.env.example` (só servidor, sem `VITE_`) e verificar que nenhuma delas é referenciada em `src/`

## 2. Núcleo de autenticação no servidor

- [x] 2.1 Criar `api/_lib/password.ts` (hash/verify com `scrypt`, formato com parâmetros, `timingSafeEqual`, hash fixo para igualar o tempo) e verificar com teste unitário: verifica a senha correta, rejeita a errada e gera hashes diferentes para a mesma senha
- [x] 2.2 Criar `api/_lib/auth.ts` (parser de cookie, `createSession`, `getSessionUser`, `requireUser`, `destroySession`, `Set-Cookie` com `HttpOnly`/`SameSite=Lax`/`Secure` condicional) e verificar com testes: sessão válida, expirada, inexistente, cookie adulterado e atributos do cookie
- [x] 2.3 Adicionar `unauthorized` (401) a `ApiErrorCode` e o helper em `http.ts`; adicionar `emailSchema` e `passwordSchema` (normalização, 8–128) em `shared/schemas.ts`; verificar com casos novos em `shared/schemas.test.ts`
- [x] 2.4 Fazer `route()` rejeitar escritas com corpo cujo `content-type` não seja JSON e verificar com caso novo em `tests/api/http.test.ts`
- [x] 2.5 Estender `tests/helpers.ts` (`fakeReq` com cookie; helper que enfileira a consulta de sessão para uma usuária) e verificar que os testes existentes continuam compilando

## 3. Rotas de conta

- [x] 3.1 Criar `api/auth/signup.ts`, `login.ts`, `logout.ts` e `me.ts` conforme o design e verificar com `tests/api/auth.test.ts`: cadastro válido loga, e-mail duplicado dá 409, login com mensagem genérica idêntica nos dois casos de falha, logout apaga a sessão, `me` sem sessão retorna `{user: null}`, e nenhuma resposta contém senha ou hash
- [x] 3.2 Criar `api/_lib/mailer.ts` (Gmail SMTP via `nodemailer`; sem `SMTP_USER`, só registra o link no console) e verificar que o fallback registra o link sem tentar conectar
- [x] 3.3 Criar `api/auth/password-reset/index.ts` e `confirm.ts` (token com hash, 1h, uso único, link com `#token`, transação que troca a senha e apaga sessões) e verificar com testes: resposta neutra igual com e sem conta, token expirado e reutilizado rejeitados, sessões apagadas após redefinir

## 4. Posse e visibilidade nas rotas de playlist

- [x] 4.1 Atualizar `rows.ts` e `shared/types.ts` (`visibility`, `shareToken: string | null`, `PublicPlaylistSummary`, nova forma da listagem) e verificar que `npm run build` passa
- [x] 4.2 `POST /api/playlists`: exigir sessão, gravar `owner_id`, nascer privada sem token; `GET /api/playlists`: retornar `{mine, public}` conforme a sessão, sem id nem dona nas públicas alheias. Verificar com `tests/api/playlists.test.ts` atualizado: visitante 401 ao criar, listagem de visitante, listagem logada e ausência de `id` em `public`
- [x] 4.3 `GET/PATCH/DELETE /api/playlists/:id` filtrando `owner_id`: 401 sem sessão, 404 para outra conta. Verificar com testes de duas usuárias
- [x] 4.4 Rotas de faixas (`tracks/index`, `tracks/[trackId]`, `tracks/order`) filtrando `owner_id` e verificar em `tests/api/tracks.test.ts` que outra conta recebe 404 e visitante recebe 401 sem alterar nada
- [x] 4.5 Criar `PUT /api/playlists/:id/visibility` (token novo ao publicar, `null` ao privar, idempotente quando já pública) e verificar com testes: publicar gera token, privar zera, republicar gera token diferente, outra conta recebe 404
- [x] 4.6 `POST /share-token`: só dona e só pública (409 se privada) e verificar com testes
- [x] 4.7 `GET /api/shared/:token`: buscar só `visibility = 'public'` e verificar em `tests/api/shared.test.ts` que o token de uma playlist que foi privada responde 404 e que a resposta não contém id nem dados da dona

## 5. Front: sessão e telas de conta

- [x] 5.1 Tratar 401 em `src/api/client.ts` e adicionar os métodos de auth, visibilidade e a nova listagem; verificar que `npm run build` passa
- [x] 5.2 Criar `AuthProvider` (carrega `me` na montagem) e o botão Entrar/Sair no cabeçalho; verificar com teste de componente: visitante vê "Entrar", logada vê o e-mail e "Sair"
- [x] 5.3 Criar as páginas `/entrar` (com `?voltar=`), `/cadastro`, `/esqueci-senha` e `/redefinir-senha` (lê o token de `location.hash`) com validação pelos schemas compartilhados; verificar com testes de componente dos erros de validação e da mensagem neutra

## 6. Front: home e edição

- [x] 6.1 `HomePage` por sessão: visitante vê as públicas (link `/s/:token`) e "Criar" leva a `/entrar?voltar=/`; logada vê "Minhas playlists" com selo Pública/Privada e, abaixo, as públicas das outras contas, com estados vazios. Verificar com testes de componente das duas variantes
- [x] 6.2 `PlaylistPage`: controle de visibilidade; "copiar link" e "regenerar" só quando pública; redirecionar para `/entrar` em 401. Verificar com teste de componente de que a playlist privada não mostra link e que publicar faz o link aparecer
- [x] 6.3 Atualizar o `README.md` (contas, visibilidade, variáveis de SMTP e senha de app do Gmail, aviso de que a migração 002 apaga dados) e verificar que os passos descritos batem com o `.env.example`

## 7. Verificação integrada

- [x] 7.1 Rodar `npm test` e `npm run build` sem falhas
- [x] 7.2 No `npm run dev` (PGlite), percorrer o fluxo com duas contas: cadastrar Maria, criar playlist (nasce privada), publicar, abrir `/s/:token` em janela anônima, entrar como Ana e confirmar que vê a pública e não a privada de Maria, privar e confirmar 404 no link antigo, sair, "esqueci a senha" e usar o link registrado no console para redefinir
- [x] 7.3 Inspecionar o `dist/` gerado e confirmar a ausência de `DATABASE_URL`, `SMTP_USER` e `SMTP_APP_PASSWORD` e dos seus valores
