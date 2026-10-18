# Design

## Context

O app é um SPA em React (Vite) com funções serverless da Vercel em `api/**` e Postgres no Neon, acessado pelo driver HTTP (`getSql()`). No dev local, `scripts/vite-dev-api.ts` imita o roteamento da Vercel e usa PGlite quando não há `DATABASE_URL`. Todo erro passa por `route()`/`sendError()` em `api/_lib/http.ts`, com mensagens em pt-BR e códigos em `ApiErrorCode`.

Restrições que moldam o desenho:
- Não há servidor de sessão em memória: cada invocação serverless é independente, então a sessão tem que estar no banco ou ser autocontida.
- O plugin de dev passa `cookies: {}` para os handlers, então ler `req.cookies` funcionaria na Vercel mas não no dev.
- Os testes de API usam `fakeReq`/`fakeRes`/`fakeSql` (`tests/helpers.ts`), sem banco real nos testes de rota.
- `vercel.json` já define `Referrer-Policy: strict-origin-when-cross-origin`.

Motivação: ver proposal.md, seção Why. Requisitos: ver os specs desta change.

## Goals / Non-Goals

**Goals:**
- Um único ponto de leitura da sessão (`getSessionUser`/`requireUser`), usado por todas as rotas.
- Checagem de posse na própria query SQL (`... where id = $id and owner_id = $user`), sem uma leitura extra antes da escrita.
- Nenhuma dependência nova além do `nodemailer`.
- Dev local funcionando sem SMTP configurado.

**Non-Goals:**
- Limite de tentativas (rate limiting) de login e de pedidos de redefinição.
- Verificação do e-mail no cadastro.
- Troca de senha logada, troca de e-mail, exclusão de conta.
- Login social.

## Decisions

### 1. Sessão opaca no banco, não JWT
O cookie `sid` guarda 32 bytes aleatórios em base64url. O banco guarda só o `sha256` desse valor em `sessions.token_hash`, junto com `user_id` e `expires_at` (criação + 30 dias, sem renovação automática).
- **Por quê:** o logout e a redefinição de senha precisam revogar sessões de verdade (specs "Logout" e "Redefinir senha com o token"). Com JWT isso exigiria uma lista de revogação, o que acaba sendo uma tabela de sessões de qualquer jeito.
- **Hash do token:** se a tabela vazar, os valores guardados não servem como cookie.
- **Alternativa descartada:** cookie assinado com o `user_id`. É mais simples, mas não revoga a sessão.
- Cookie: `sid=<valor>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`, mais `Secure` quando `NODE_ENV === 'production'` ou `VERCEL` estiver definido. O dev roda em `http://localhost`.
- Sessões expiradas são ignoradas na leitura (`where expires_at > now()`). A limpeza física pode ser feita oportunamente no login (`delete ... where expires_at < now()`), sem precisar de cron.

### 2. Cookies lidos do cabeçalho
`api/_lib/auth.ts` lê `req.headers.cookie` com um parser pequeno, em vez de `req.cookies`. Assim o dev, a Vercel e os testes (`fakeReq` ganha um campo `cookie` opcional) se comportam igual, sem mexer na emulação de `cookies` do plugin. O `Set-Cookie` é escrito com `res.setHeader`, que o `fakeRes` e o plugin de dev já suportam.

### 3. Hash de senha com `scrypt` do `node:crypto`
Formato guardado: `scrypt$N$r$p$<salt b64>$<hash b64>`, com N=16384, r=8, p=1, salt de 16 bytes e chave de 64 bytes. A comparação usa `timingSafeEqual`. Como os parâmetros ficam na string, dá para aumentar o custo no futuro e regravar o hash no próximo login.
- **Alternativas:** `bcrypt` e `argon2` exigem binários nativos ou WASM, o que é atrito na Vercel e no Windows do dev. O `scrypt` é nativo e adequado para senhas.
- **Limite de 128 caracteres** na senha: limita o custo por requisição.
- **E-mail sem conta no login:** o sistema calcula um `scrypt` contra um hash fixo para igualar o tempo de resposta e não revelar pela latência que o e-mail não existe.

### 4. Modelo de dados (migração `002_auth_visibility.sql`)
```
users            id uuid pk, email text unique (já normalizado), password_hash text,
                 created_at timestamptz
sessions         token_hash text pk, user_id uuid -> users on delete cascade,
                 expires_at timestamptz, created_at timestamptz
password_resets  token_hash text pk, user_id uuid -> users on delete cascade,
                 expires_at timestamptz, used_at timestamptz null
playlists        + owner_id uuid not null -> users on delete cascade
                 + visibility text not null default 'private'
                   check (visibility in ('public','private'))
                 share_token: drop not null (unique continua; o Postgres aceita vários NULL)
                 + check ((visibility = 'public') = (share_token is not null))
índices          playlists (owner_id, updated_at desc)
                 playlists (updated_at desc) where visibility = 'public'
```
A migração começa com `delete from tracks; delete from playlists;`, porque os dados atuais não têm dona (decisão confirmada). O `check` que amarra visibilidade e token torna impossível, no banco, uma playlist privada com link ou uma pública sem link.

### 5. Visibilidade e token numa única escrita
Nova rota `PUT /api/playlists/:id/visibility` com corpo `{ visibility: 'public' | 'private' }`, no mesmo estilo de `share-token.ts`:
```
update playlists set
  visibility  = $v,
  share_token = case when $v = 'public'
                     then (case when visibility = 'public' then share_token else $novoToken end)
                     else null end,
  updated_at  = now()
where id = $id and owner_id = $user
returning ...
```
Tornar pública uma playlist que já é pública mantém o token (operação idempotente). Passar de privada para pública sempre gera token novo. `POST /share-token` ganha `and visibility = 'public'` e responde 409 (`conflict`) quando a playlist é da dona mas está privada. Isso exige distinguir os casos: se o `update` não afetar linhas, um `select` por `id and owner_id` decide entre 404 e 409.
- **Alternativa:** pôr `visibility` no `PATCH` de renomear. Foi descartada porque mistura validações e porque o `playlistNameSchema` exige `name`.

### 6. Autorização: 401 para visitante, 404 para outra conta
Novo código `unauthorized` (401) em `ApiErrorCode`. `requireUser(req, res)` responde 401 e retorna `null` quando não há sessão válida. Para outra conta, a própria query com `owner_id = $user` não encontra linhas e a rota responde o 404 que já existe. Nenhum código novo é necessário para isso, e não há como distinguir "não existe" de "não é sua".
- As rotas de faixas (`tracks/index`, `tracks/[trackId]`, `tracks/order`) passam a juntar com `playlists` filtrando `owner_id`. Exemplo: o CTE `p` de `tracks/index.ts` vira `select id from playlists where id = $id and owner_id = $user`.

### 7. Formato da listagem
`GET /api/playlists` deixa de retornar um array e passa a retornar:
```
{ mine:   PlaylistSummary[]          // id, name, trackCount, updatedAt, visibility, shareToken|null
  public: PublicPlaylistSummary[] }  // name, trackCount, updatedAt, shareToken  (sem id, sem dona)
```
Para visitantes, `mine` é `[]`. `public` exclui as da própria sessão, para não repetir a mesma playlist nas duas seções. O card público linka para `/s/:token`, e o card de `mine` linka para `/p/:id`. `PlaylistDetail` ganha `visibility`, e `shareToken` vira `string | null`.
- **Limite:** `public` retorna no máximo as 50 mais recentes. Paginação fica para depois, sem mudar o contrato do spec.

### 8. Rotas de autenticação
```
POST /api/auth/signup                  {email, password} -> 201 {user} + Set-Cookie
POST /api/auth/login                   {email, password} -> 200 {user} + Set-Cookie
POST /api/auth/logout                  -> 204, apaga a sessão e envia o cookie com Max-Age=0
GET  /api/auth/me                      -> 200 {user} | 200 {user: null}
POST /api/auth/password-reset          {email}           -> 202 mensagem neutra
POST /api/auth/password-reset/confirm  {token, password} -> 204
```
`user` = `{ id, email }`. Os schemas zod ficam em `shared/schemas.ts` (`emailSchema`, `passwordSchema`), reaproveitados no front. `me` responde 200 com `null`, e não 401, para o front distinguir "visitante" de "erro" sem tratar exceção na carga inicial.
- **Cadastro com e-mail existente → 409** com "Este e-mail já tem conta". É uma troca consciente: revela que o e-mail existe, mas sem isso a pessoa fica sem saber por que não consegue se cadastrar. O login e a recuperação continuam neutros, conforme os specs.

### 9. Recuperação de senha
- O token tem 32 bytes aleatórios em base64url. O banco guarda o `sha256` em `password_resets`, com `expires_at = now() + 1h`.
- O link é `${APP_URL}/redefinir-senha#<token>`. Como o token vai no **fragmento**, ele nunca chega ao servidor, aos logs da Vercel nem ao cabeçalho `Referer`. O front lê `location.hash` e envia o token no corpo do `confirm`.
- O `confirm` roda numa transação (`Pool` do Neon, como no `scripts/migrate.ts`, ou um `sql.transaction`): marca `used_at` com a condição `used_at is null and expires_at > now()`, atualiza `password_hash` e apaga todas as `sessions` da conta.
- Um novo pedido não invalida tokens anteriores ainda válidos. Isso é aceitável, porque todos expiram em 1h e o uso de qualquer um apaga as sessões.

### 10. Envio de e-mail pelo Gmail
`api/_lib/mailer.ts` usa `nodemailer` com `host: smtp.gmail.com`, `port: 465`, `secure: true` e autenticação `SMTP_USER` / `SMTP_APP_PASSWORD` (senha de app do Google, que exige verificação em 2 etapas na conta). Novas variáveis no `.env.example`, sem prefixo `VITE_`: `SMTP_USER`, `SMTP_APP_PASSWORD`, `APP_URL`.
- **Dev sem SMTP:** se `SMTP_USER` não estiver definido, o mailer só faz `console.info` do link. Assim o fluxo pode ser testado localmente sem credenciais.
- O pedido de redefinição responde 202 mesmo se o envio falhar. A falha vai para o log do servidor, para não diferenciar a resposta por existência de conta.
- **Alternativa:** a API do Gmail com OAuth. É mais robusta, mas exige um projeto no Google Cloud e refresh token, o que é desproporcional para recuperação de senha.

### 11. Front
- `AuthProvider` (contexto) chama `GET /api/auth/me` na montagem e expõe `user`, `login`, `signup`, `logout`. A `HomePage` renderiza a variante de visitante ou a de logada.
- Novas rotas: `/entrar`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`. O `/entrar` aceita `?voltar=` para retornar após o login, por exemplo quando o visitante clicou em "Criar".
- `/p/:id` sem sessão redireciona para `/entrar`. Uma resposta 404 mostra o `NotFound` que já existe.
- `PlaylistPage` ganha o controle de visibilidade e mostra "copiar link" e "regenerar" só quando a playlist é pública.
- `fetch` usa o padrão `credentials: 'same-origin'`, que já envia o cookie, então o `client.ts` não precisa mudar a chamada. Ele só passa a tratar 401 como `ApiError` com código `unauthorized`.

### 12. CSRF
`SameSite=Lax` impede que outros sites enviem o cookie em requisições `POST`/`PUT`/`PATCH`/`DELETE`, e nenhuma rota `GET` altera estado. Como reforço barato, `route()` rejeita escritas com corpo cujo `content-type` não seja `application/json`, o que exige preflight CORS em requisições cross-site, que a API não autoriza.

## Risks / Trade-offs

- **[Força bruta no login e spam de redefinição, sem rate limiting]** → O `scrypt` encarece cada tentativa. O limite de envios do Gmail funciona como um teto natural. Um rate limit por IP/e-mail numa tabela fica registrado como próxima melhoria.
- **[A migração apaga dados]** → É a decisão confirmada. A migração é irreversível, então rodar antes num branch do Neon ou fazer backup antes de aplicar em produção.
- **[Cadastro revela que o e-mail existe]** → Troca aceita (decisão 8). Login e recuperação continuam neutros.
- **[Senha de app do Gmail vazar]** → Ela fica só nas variáveis de ambiente do servidor, e o spec exige ausência no bundle. Usar uma conta Google dedicada ao envio reduz o impacto.
- **[Gmail marcar como spam ou limitar envios]** → O volume esperado (só recuperações) é baixo. Se crescer, troca-se o transporte do `mailer.ts` por um provedor transacional sem mexer nas rotas.
- **[Neon HTTP sem transação interativa]** → Para o `confirm`, usar `sql.transaction([...])` com instruções condicionais ou o `Pool`. Validar no teste que um token usado não redefine duas vezes.
- **[Testes existentes quebram com o novo formato da listagem e a exigência de sessão]** → Atualizar `tests/api/*` com um helper que injeta o cookie e enfileira a resposta da consulta de sessão no `fakeSql`.

## Migration Plan

1. Fazer backup ou criar um branch do Neon de produção.
2. Fazer deploy do código e das variáveis (`SMTP_USER`, `SMTP_APP_PASSWORD`, `APP_URL`) na Vercel.
3. Rodar `npm run db:migrate` (aplica `002_auth_visibility.sql`, que apaga os dados atuais).
4. Testar em produção: cadastro, login, criar playlist privada, publicar, abrir `/s/:token` em aba anônima, privar e confirmar 404, e "esqueci a senha" recebendo o e-mail.

**Rollback:** reverter o deploy. O schema novo não é compatível com o código anterior (`owner_id not null`), então voltar exige restaurar o backup do passo 1.
