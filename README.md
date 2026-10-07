# Playlist Multiplataforma

App para montar playlists que misturam faixas do **YouTube**, **Spotify** e **SoundCloud**, e compartilhá-las por link público somente leitura.

## Contas e visibilidade

- **Contas com e-mail e senha.** Cadastro, login e logout em `/cadastro`, `/entrar` e pelo botão **Sair**. A sessão fica num cookie `HttpOnly` (`SameSite=Lax`, `Secure` fora do dev local) e dura 30 dias. A senha é guardada só como hash `scrypt` com salt.
- **Esqueci a senha.** Em `/esqueci-senha`, a pessoa recebe por e-mail um link de uso único que vale por 1 hora. A resposta é a mesma exista ou não a conta. Redefinir a senha encerra todas as sessões da conta.
- **Toda playlist tem uma dona.** Criar exige estar logada (para visitantes, **Criar playlist** leva ao login). Só a dona abre a edição, renomeia, exclui, muda a visibilidade e mexe nas faixas. Para outra conta, a playlist responde "não encontrada", nunca "proibido".
- **Pública ou privada.** Toda playlist nasce **privada**. Ao torná-la **pública**, ela ganha um link `/s/:token` e passa a aparecer na tela inicial de todo mundo. Ao torná-la privada, o link é apagado e o antigo passa a responder "não encontrada"; publicar de novo gera um link diferente. **Gerar novo link** só existe em playlist pública.
- **Tela inicial.** Visitantes veem as playlists públicas de todas as contas (abrem pelo link público, somente leitura). Quem está logada vê **Minhas playlists** (com o selo Pública/Privada) e, abaixo, as públicas das outras pessoas.

## Princípio central

O banco guarda apenas **referências** às faixas (link, plataforma, identificador, rótulo e metadados textuais). A reprodução acontece no navegador, pelos **players embutidos oficiais** de cada plataforma. O servidor nunca hospeda, baixa, armazena ou redistribui áudio — as únicas chamadas dele às plataformas são consultas oEmbed públicas (título/autor/thumbnail) e a resolução de redirecionamento de links curtos `on.soundcloud.com`.

> **Spotify:** o embed só toca a faixa completa para quem tem login feito no Spotify no navegador; sem login, toca uma prévia de 30 segundos. Isso é regra da plataforma e não é contornado.

## Stack

- **Front:** Vite + React + TypeScript (SPA em `src/`)
- **API:** funções serverless da Vercel em `api/` (a única parte que fala com o banco)
- **Banco:** Neon Postgres via `@neondatabase/serverless` (driver HTTP), SQL puro
- **Compartilhado:** `shared/` — parser de links, schemas de validação e tipos usados por front e API

## Reprodução contínua

Ao terminar uma faixa, o app carrega e toca a próxima sozinho, inclusive quando ela é de outra plataforma. Funciona na tela de edição e no link público.

- **Controles no player:** anterior, próxima, **Autoplay** (ligado por padrão), **Repetir** (ao fim da última faixa, volta à primeira) e **Aleatório** (cada faixa toca uma vez por ciclo; a ordem salva da playlist não muda). As preferências ficam só no navegador de quem ouve (`localStorage`, chave `playback-prefs:v1`).
- **Como funciona:** YouTube e SoundCloud são controlados pelas APIs oficiais de player, carregadas no navegador sob demanda — [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) e [SoundCloud Widget API](https://developers.soundcloud.com/docs/api/html5-widget). O Spotify usa o mesmo iframe de embed do MVP, controlado pelas mensagens que o próprio embed troca com a página (o protocolo que a [Spotify iFrame API](https://developer.spotify.com/documentation/embeds/references/iframe-api) usa por baixo). Não usamos o script da iFrame API porque o iframe criado por ela tocava só a prévia de 30 s mesmo com login. Código em `src/player/` (fila em `queue.ts`, estado em `usePlayback.ts`, adaptadores em `adapters/`). O servidor não participa da reprodução.
- A primeira faixa sempre começa por um clique em **Tocar**: abrir uma playlist não toca nada sozinho.

**Limitações:**

- **Políticas de autoplay dos navegadores.** Safari/iOS e algumas configurações de outros navegadores podem impedir o início automático da próxima faixa, principalmente ao trocar de plataforma. Nesse caso a faixa fica carregada com o aviso "toque em play para continuar", e a fila segue depois disso. Faixas seguidas da mesma plataforma reaproveitam o mesmo player, o que costuma evitar o bloqueio. Na verificação manual de outubro de 2026, no Firefox desktop e num celular, o início automático não foi bloqueado em nenhum caso.
- **Abas em segundo plano e tela bloqueada** podem pausar ou atrasar a troca de faixa, conforme o navegador.
- **Spotify:** o embed não avisa quando a faixa termina; o fim é inferido pelo progresso (o fim da prévia de 30 s, para quem não tem login, também conta). Faixas indisponíveis só são puladas quando o embed informa o erro; se não pular, use **Próxima**. O protocolo de mensagens do embed não é documentado pelo Spotify: se mudar, o player continua tocando, mas o avanço automático do Spotify para. YouTube e SoundCloud pulam faixas indisponíveis automaticamente após ~3 s.
- Se o script oficial de uma plataforma não carregar, o player volta ao iframe simples (toca, mas sem avanço automático) e mostra um aviso.

## Configuração do banco (Neon)

1. Crie uma conta em <https://neon.tech> e um projeto no plano gratuito (região próxima, ex.: `sa-east-1`).
2. No painel do projeto, em **Connect**, copie a connection string (formato `postgresql://...neon.tech/neondb?sslmode=require`).
3. Na raiz do repositório, crie um arquivo `.env` (já ignorado pelo git) a partir do exemplo:

   ```bash
   cp .env.example .env
   # edite .env e cole sua connection string em DATABASE_URL
   ```

4. Aplique as migrações:

   ```bash
   npm install
   npm run db:migrate
   ```

   A saída deve listar `Aplicada: 001_init.sql` e `Aplicada: 002_auth_visibility.sql`. Rodar de novo imprime `Nenhuma migração pendente.`

> A `DATABASE_URL` é segredo de servidor. **Nunca** use o prefixo `VITE_` nela — variáveis com esse prefixo são embutidas no JavaScript entregue ao navegador.

> **Atenção: a migração `002_auth_visibility.sql` apaga todas as playlists e faixas existentes**, porque elas não têm dona. Ela é irreversível: antes de aplicá-la num banco com dados que importam, faça backup ou crie um branch do Neon. No dev local com PGlite, ela também apaga o que estiver em `.dev-db/`.

## E-mail de redefinição de senha (Gmail)

O link de "esqueci a senha" é enviado por SMTP do Gmail, com uma **senha de app** do Google (não a senha normal da conta). As três variáveis ficam só no servidor — **nunca** com prefixo `VITE_`:

| Variável | Uso |
|---|---|
| `SMTP_USER` | endereço Gmail que envia os e-mails (ex.: uma conta dedicada a isso) |
| `SMTP_APP_PASSWORD` | senha de app dessa conta (16 caracteres) |
| `APP_URL` | endereço público do app, sem barra no final, usado para montar o link (ex.: `https://seu-app.vercel.app`; no dev, `http://localhost:5173`) |

Para gerar a senha de app:

1. Na conta Google que vai enviar, ative a **verificação em 2 etapas** (Conta Google → Segurança). Sem ela, o Google não oferece senhas de app.
2. Abra <https://myaccount.google.com/apppasswords>, crie uma senha de app (ex.: "Playlist") e copie os 16 caracteres.
3. Preencha `SMTP_USER`, `SMTP_APP_PASSWORD` e `APP_URL` nas variáveis de ambiente da Vercel. Localmente, o `.env` vale para o `npx vercel dev`; o `npm run dev` só lê a `DATABASE_URL` do `.env`, então para enviar e-mail de verdade nele é preciso exportar as três variáveis no shell antes de iniciá-lo.

**Sem `SMTP_USER`** (o padrão do `.env.example`), nada é enviado: o link de redefinição só aparece no console do servidor (`[mailer] ... Link de redefinição para ...`). É assim que o fluxo é testado no dev local. Sem `APP_URL`, o link usa `http://localhost:5173`.

## Desenvolvimento local

```bash
npm install
npm run dev           # front + API em http://localhost:5173
```

O `npm run dev` serve também as funções de `api/` (plugin `scripts/vite-dev-api.ts`, que imita o roteamento por arquivos da Vercel; só existe no servidor de desenvolvimento):

- **sem `DATABASE_URL`** → usa um Postgres local em disco ([PGlite](https://pglite.dev)) na pasta `.dev-db/`, com as migrações aplicadas automaticamente. Não precisa de conta em lugar nenhum. Para zerar os dados, apague `.dev-db/`.
- **com `DATABASE_URL` no `.env`** → usa o Neon de verdade.

Para testar as contas localmente, cadastre-se em `/cadastro`. Em "esqueci a senha", copie do terminal do `npm run dev` o link registrado pelo `[mailer]` (sem `SMTP_USER` nenhum e-mail é enviado).

Para reproduzir exatamente o ambiente da Vercel (opcional):

```bash
npx vercel login && npx vercel link   # uma vez
npx vercel dev                        # http://localhost:3000, usando o .env
```

## Testes

```bash
npm test
```

- `shared/*.test.ts` — parser de links (todos os formatos aceitos e rejeitados) e limites de validação.
- `api/_lib/*.test.ts` — oEmbed e resolução de link curto com `fetch` simulado, hash de senha e envio de e-mail (com `nodemailer` simulado).
- `tests/api/*.test.ts` — handlers da API. Os de contas, sessão, redefinição de senha, posse (duas contas), visibilidade, faixas e compartilhamento rodam contra um **Postgres real em memória** ([PGlite](https://pglite.dev)) com as migrações aplicadas, então o SQL é exercitado de verdade.
- `src/components/*.test.tsx` — player, controles de reprodução e lista somente leitura.
- `src/player/*.test.ts` — fila (limites, repetir, aleatório), preferências, carregador de SDK, estado de reprodução (com temporizadores) e os três adaptadores, com SDKs falsos.
- `tests/ui/*.test.tsx` — fluxos de ponta a ponta da interface (jsdom): páginas React reais com o `fetch` roteado para os handlers reais sobre PGlite (com os cookies de sessão), e testes de componente das telas de conta, da tela inicial e do controle de visibilidade com `fetch` simulado.

## Deploy (Vercel)

1. Crie um projeto na Vercel importando este repositório (framework: Vite; `vercel.json` já define build e rotas).
2. Em **Settings → Environment Variables**, adicione `DATABASE_URL`, `SMTP_USER`, `SMTP_APP_PASSWORD` e `APP_URL` para *Production* e *Preview* (em *Preview*, `APP_URL` deve apontar para o endereço do preview, ou os links de redefinição levarão à produção).
3. Faça o deploy. As rotas `/p/:id`, `/s/:token`, `/entrar`, `/cadastro`, `/esqueci-senha` e `/redefinir-senha` são servidas pela SPA; `/api/*` são as funções.
4. Aplique as migrações (`npm run db:migrate`). Lembre que a `002` apaga as playlists existentes — faça backup ou um branch do Neon antes.

Rollback: promova o deploy anterior no painel da Vercel. **Depois da migração 002 isso não basta**: o código anterior não funciona com o schema novo (`owner_id` obrigatório), então voltar exige restaurar o backup feito antes da migração.

## API

| Método | Rota | Uso |
|---|---|---|
| POST | `/api/auth/signup` | cadastra `{ email, password }` e já loga (409 se o e-mail tem conta) |
| POST | `/api/auth/login` | entra `{ email, password }` (401 genérico se errar) |
| POST | `/api/auth/logout` | sai (apaga a sessão no servidor) |
| GET | `/api/auth/me` | `{ user }` da sessão, ou `{ user: null }` |
| POST | `/api/auth/password-reset` | pede o link `{ email }` (resposta sempre neutra, 202) |
| POST | `/api/auth/password-reset/confirm` | nova senha `{ token, password }` |
| GET | `/api/playlists` | `{ mine, public }`: as da sessão e as públicas das outras contas (sem id nem dona) |
| POST | `/api/playlists` | cria `{ name }` (logada; nasce privada) |
| GET | `/api/playlists/:id` | playlist + faixas (só a dona) |
| PATCH | `/api/playlists/:id` | renomeia `{ name }` (só a dona) |
| DELETE | `/api/playlists/:id` | exclui, faixas juntas (só a dona) |
| PUT | `/api/playlists/:id/visibility` | `{ visibility: 'public' \| 'private' }` (só a dona) |
| POST | `/api/playlists/:id/share-token` | gera novo link público (só a dona; 409 se privada) |
| POST | `/api/playlists/:id/tracks` | adiciona `{ url, label? }` (só a dona) |
| PATCH | `/api/playlists/:id/tracks/:trackId` | edita `{ label }` (só a dona) |
| DELETE | `/api/playlists/:id/tracks/:trackId` | remove (só a dona) |
| PUT | `/api/playlists/:id/tracks/order` | reordena `{ trackIds }` (só a dona; conjunto exato, senão 409) |
| GET | `/api/shared/:token` | leitura pública de playlist pública (sem ids internos nem dona) |

Rotas "só a dona": sem sessão respondem **401**; com sessão de outra conta, **404** (igual a uma playlist inexistente). Escritas com corpo precisam de `content-type: application/json` (senão **415**).

## Segurança e limitações

- **Só a dona edita.** Toda escrita exige a sessão da conta dona; conhecer o id interno não basta. O link público (`/s/:token`) usa um token aleatório de 128 bits, distinto do id, existe só enquanto a playlist é pública e não dá acesso a nenhuma escrita. Se um link público vazar, use **Gerar novo link** ou torne a playlist privada.
- **Sem limite de tentativas.** Ainda não há rate limiting no login nem nos pedidos de redefinição; o custo do `scrypt` e o limite de envio do Gmail são os únicos freios.
- **Cadastro revela se o e-mail já tem conta** (responde "Este e-mail já tem conta."). É uma troca consciente; login e "esqueci a senha" respondem igual exista ou não a conta.
- **E-mail não é verificado no cadastro.**
- Adição de faixas apenas colando links — não há busca de músicas.
- **Metadados do SoundCloud podem vir vazios.** O endpoint oEmbed do SoundCloud fica atrás de um WAF que responde com desafio anti-bot (HTTP 202 sem corpo) a requisições de servidor. Nesse caso a faixa é adicionada normalmente, sem título/artista/thumbnail em cache — use o rótulo para identificá-la. YouTube e Spotify não têm esse problema.
