# Playlist Multiplataforma

App pessoal para montar playlists que misturam faixas do **YouTube**, **Spotify** e **SoundCloud**, e compartilhá-las por link público somente leitura.

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

- **Políticas de autoplay dos navegadores.** Safari/iOS e algumas configurações de outros navegadores podem impedir o início automático da próxima faixa, principalmente ao trocar de plataforma. Nesse caso a faixa fica carregada com o aviso "toque em play para continuar", e a fila segue depois disso. Faixas seguidas da mesma plataforma reaproveitam o mesmo player, o que costuma evitar o bloqueio.
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

   A saída deve listar `Aplicada: 001_init.sql`. Rodar de novo imprime `Nenhuma migração pendente.`

> A `DATABASE_URL` é segredo de servidor. **Nunca** use o prefixo `VITE_` nela — variáveis com esse prefixo são embutidas no JavaScript entregue ao navegador.

## Desenvolvimento local

```bash
npm install
npm run dev           # front + API em http://localhost:5173
```

O `npm run dev` serve também as funções de `api/` (plugin `scripts/vite-dev-api.ts`, que imita o roteamento por arquivos da Vercel; só existe no servidor de desenvolvimento):

- **sem `DATABASE_URL`** → usa um Postgres local em disco ([PGlite](https://pglite.dev)) na pasta `.dev-db/`, com as migrações aplicadas automaticamente. Não precisa de conta em lugar nenhum. Para zerar os dados, apague `.dev-db/`.
- **com `DATABASE_URL` no `.env`** → usa o Neon de verdade.

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
- `api/_lib/*.test.ts` — oEmbed e resolução de link curto com `fetch` simulado.
- `tests/api/*.test.ts` — handlers da API. Os de faixas e compartilhamento rodam contra um **Postgres real em memória** ([PGlite](https://pglite.dev)) com a migração aplicada, então o SQL é exercitado de verdade.
- `src/components/*.test.tsx` — player, controles de reprodução e lista somente leitura.
- `src/player/*.test.ts` — fila (limites, repetir, aleatório), preferências, carregador de SDK, estado de reprodução (com temporizadores) e os três adaptadores, com SDKs falsos.
- `tests/ui/*.test.tsx` — fluxos de ponta a ponta da interface (jsdom): páginas React reais com o `fetch` roteado para os handlers reais sobre PGlite.

## Deploy (Vercel)

1. Crie um projeto na Vercel importando este repositório (framework: Vite; `vercel.json` já define build e rotas).
2. Em **Settings → Environment Variables**, adicione `DATABASE_URL` para *Production* e *Preview*.
3. Faça o deploy. As rotas `/p/:id` e `/s/:token` são servidas pela SPA; `/api/*` são as funções.

Rollback: promova o deploy anterior no painel da Vercel (as migrações do MVP são aditivas).

## API

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/playlists` | lista (nome, contagem de faixas) |
| POST | `/api/playlists` | cria `{ name }` |
| GET | `/api/playlists/:id` | playlist + faixas |
| PATCH | `/api/playlists/:id` | renomeia `{ name }` |
| DELETE | `/api/playlists/:id` | exclui (faixas juntas) |
| POST | `/api/playlists/:id/share-token` | gera novo link público |
| POST | `/api/playlists/:id/tracks` | adiciona `{ url, label? }` |
| PATCH | `/api/playlists/:id/tracks/:trackId` | edita `{ label }` |
| DELETE | `/api/playlists/:id/tracks/:trackId` | remove |
| PUT | `/api/playlists/:id/tracks/order` | reordena `{ trackIds }` (conjunto exato, senão 409) |
| GET | `/api/shared/:token` | leitura pública (sem ids internos) |

## Segurança e limitações

- **Sem autenticação.** Quem souber o id interno de uma playlist (UUID na URL `/p/:id`) pode editá-la. O link público (`/s/:token`) usa um token aleatório de 128 bits, distinto do id, e não dá acesso a nenhuma escrita. Se um link público vazar, use **Gerar novo link** para invalidá-lo.
- Adição de faixas apenas colando links — não há busca de músicas.
- **Metadados do SoundCloud podem vir vazios.** O endpoint oEmbed do SoundCloud fica atrás de um WAF que responde com desafio anti-bot (HTTP 202 sem corpo) a requisições de servidor. Nesse caso a faixa é adicionada normalmente, sem título/artista/thumbnail em cache — use o rótulo para identificá-la. YouTube e Spotify não têm esse problema.
