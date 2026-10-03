# Design

## Context

Projeto greenfield: a pasta do repositório está vazia (exceto `openspec/`). A motivação está em `proposal.md` (Why) e os requisitos em `specs/`. Restrições que moldam o desenho:

- Tudo precisa caber nos planos gratuitos de **Vercel (Hobby)** e **Neon (Free, scale-to-zero)**.
- O banco só pode ser acessado pela API; a connection string vive apenas em variável de ambiente do servidor.
- Nenhum áudio passa pelo sistema; o servidor só faz oEmbed e resolução de link curto (ver `specs/embedded-playback`).
- Sem autenticação no MVP (decisão da usuária); escrita é endereçada pelo id interno, leitura pública pelo token.

## Goals / Non-Goals

**Goals:**
- Um único repositório, um único deploy na Vercel (front estático + funções em `/api`).
- Parsing de URL puro e testável, compartilhado entre front (validação instantânea) e API (fonte da verdade).
- Cold start aceitável com Neon scale-to-zero (driver HTTP, sem pool TCP).

**Non-Goals:**
- Framework de backend completo, ORM, cache distribuído, filas.
- Detecção automática de faixas quebradas (ex.: job periódico checando oEmbed).
- Otimizar para muitos usuários ou concorrência alta.

## Decisions

### 1. Stack: Vite + React + TypeScript, funções Vercel em `/api`
SPA gerada pelo Vite, servida como estático; funções Node em `api/` (convenção de arquivos da Vercel). Roteamento do front com React Router; `vercel.json` com rewrite de rotas não-`/api` para `index.html`.
- *Alternativas:* Next.js (mais convenções e peso do que o necessário para uma SPA com meia dúzia de endpoints); Cloudflare Pages (viável, mas a usuária escolheu Vercel).

### 2. Acesso ao banco com `@neondatabase/serverless` (driver HTTP) e SQL puro
Consultas via tagged template `sql\`...\`` do driver, parametrizadas. Sem ORM. Migrações como arquivos `.sql` numerados em `db/migrations/`, aplicadas por um script Node (`npm run db:migrate`) que registra as versões numa tabela `schema_migrations`.
- *Por quê:* o driver HTTP não mantém conexões, então funciona bem com funções efêmeras e com o compute do Neon dormindo. Duas tabelas não justificam ORM.
- *Alternativas:* Drizzle/Prisma (mais dependências e build); `pg` com pool (pior em serverless).

### 3. Modelo de dados
```sql
create table playlists (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 100),
  share_token  text not null unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table tracks (
  id            uuid primary key default gen_random_uuid(),
  playlist_id   uuid not null references playlists(id) on delete cascade,
  original_url  text not null check (char_length(original_url) <= 2048),
  canonical_url text not null check (char_length(canonical_url) <= 2048),
  platform      text not null check (platform in ('youtube','spotify','soundcloud')),
  external_id   text not null,
  label         text not null default '' check (char_length(label) <= 200),
  position      integer not null,
  meta_title    text,
  meta_artist   text,
  meta_thumbnail_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index tracks_playlist_position on tracks (playlist_id, position);
```
- `position` é inteiro denso (0..n-1) reescrito por inteiro em cada reordenação/remoção. Com playlists pessoais (dezenas a poucas centenas de faixas) isso é trivial e mais simples que ordenação fracionária.
- Sem `unique (playlist_id, position)` para evitar conflitos transitórios durante a reescrita; a ordem é garantida pela transação.
- Toda escrita em faixas atualiza `playlists.updated_at` (usado na ordenação da lista).
- *Alternativa:* `position` fracionária/lexorank — desnecessária nessa escala.

### 4. Token de compartilhamento
`crypto.randomBytes(16)` codificado em base64url (22 caracteres, 128 bits). Gerado na criação e ao regenerar. O `id` (UUID) nunca aparece em respostas da rota pública.

### 5. API REST
| Método | Rota | Uso |
|---|---|---|
| GET | `/api/playlists` | lista (nome, contagem, updated_at) |
| POST | `/api/playlists` | cria `{ name }` |
| GET | `/api/playlists/:id` | playlist + faixas (inclui `shareToken`) |
| PATCH | `/api/playlists/:id` | renomeia `{ name }` |
| DELETE | `/api/playlists/:id` | exclui (cascade) |
| POST | `/api/playlists/:id/share-token` | regenera token |
| POST | `/api/playlists/:id/tracks` | adiciona `{ url, label? }` |
| PATCH | `/api/playlists/:id/tracks/:trackId` | edita `{ label }` |
| DELETE | `/api/playlists/:id/tracks/:trackId` | remove |
| PUT | `/api/playlists/:id/tracks/order` | reordena `{ trackIds: [...] }` |
| GET | `/api/shared/:token` | leitura pública (sem ids internos de playlist) |

- Escritas em faixa filtram sempre por `playlist_id = :id AND id = :trackId`, o que garante "não encontrado" para faixa de outra playlist e para uso do token no lugar do id (token não é UUID válido → 404).
- Reordenação: dentro de uma transação, compara o conjunto recebido com o atual; divergência → 409; senão reescreve `position` com `UPDATE ... FROM unnest($ids) WITH ORDINALITY`.
- Erros em formato `{ error: { code, message } }` com 400 (validação), 404, 409, 500 (mensagem genérica; detalhes só no log do servidor).
- Validação de payload com `zod`, compartilhando os limites (100/200/2048) com o front.
- *Alternativa:* uma única função "catch-all" com roteador — possível, mas arquivos por rota da Vercel são mais diretos.

### 6. Parsing de URL em módulo puro compartilhado (`shared/parseTrackUrl.ts`)
Função `parseTrackUrl(input) → { platform, externalId, canonicalUrl } | { error }` baseada em `new URL()` + checagem de host + regex do caminho, sem rede. Cobre os formatos da spec `track-links`. O front usa para feedback imediato; a API sempre revalida.
- Links curtos `on.soundcloud.com` retornam `{ needsResolution: true }`; só a API resolve, com `fetch(url, { method: 'HEAD', redirect: 'manual' })` seguindo até 3 redirecionamentos e reaplicando o parser à URL final. Nada de corpo de resposta é lido.
- `original_url` guarda o que foi colado (trimado); `canonical_url` (persistida) é usada para montar o embed/oEmbed — essencial para links curtos do SoundCloud, cujo `original_url` não serve ao widget.

### 7. Metadados via oEmbed público, com timeout
| Plataforma | Endpoint | Campos |
|---|---|---|
| YouTube | `https://www.youtube.com/oembed?format=json&url=` | title, author_name, thumbnail_url |
| Spotify | `https://open.spotify.com/oembed?url=` | title, thumbnail_url (sem autor) |
| SoundCloud | `https://soundcloud.com/oembed?format=json&url=` | title, author_name, thumbnail_url |

Timeout de 4 s por `AbortController`; qualquer falha → metadados `null` e a faixa é salva mesmo assim. São endpoints públicos, sem chave — não são as APIs de dados restritas excluídas pela proposta. A thumbnail é guardada como URL (não baixamos a imagem).

### 8. Players embutidos
Componente `<EmbedPlayer track>` com um `<iframe>` por plataforma:
- YouTube: `https://www.youtube-nocookie.com/embed/{id}`
- Spotify: `https://open.spotify.com/embed/track/{id}`
- SoundCloud: `https://w.soundcloud.com/player/?url={encodeURIComponent(canonicalUrl)}`

Um único player montado por vez (estado `currentTrackId` na página), sem `autoplay` em parâmetro e sem SDKs (IFrame API / Widget API ficam para a melhoria de reprodução contínua). Ao lado do player: rótulo, metadados em cache, link original e, para Spotify, o aviso sobre login/prévia de 30 s.
- `Content-Security-Policy` com `frame-src` restrito a esses três domínios.

### 9. Front: telas e reordenação
Rotas: `/` (lista + criar), `/p/:id` (edição), `/s/:token` (somente leitura, reutiliza os componentes de lista e player sem ações). Reordenação com botões "subir/descer" (acessível e sem dependência) e, opcionalmente, arrastar com `@dnd-kit/sortable`; ambos chamam o mesmo `PUT .../order`. Estado de servidor com fetch simples + recarga após mutação (sem biblioteca de cache no MVP).

### 10. Testes
Vitest para `parseTrackUrl` (tabela com todos os exemplos da spec, inclusive negativos) e para os handlers da API. Os handlers que dependem de SQL não trivial (faixas, compartilhamento) rodam contra **PGlite** (Postgres em WASM) com a migração real aplicada, em vez de um cliente mockado — mocks não validariam as CTEs de inserção no fim, recompactação e reordenação. Fluxos da interface rodam em jsdom com o `fetch` roteado para os handlers reais. Teste manual de ponta a ponta no deploy de preview.

### 11. Modo de desenvolvimento local sem contas
Plugin do Vite (`scripts/vite-dev-api.ts`, só em `vite dev`) que descobre as funções de `api/` pelo mesmo roteamento por arquivos da Vercel e as executa via `ssrLoadModule`. Sem `DATABASE_URL`, injeta um cliente PGlite persistido em `.dev-db/` por `overrideSql()` em `api/_lib/db.ts`; com ela, usa o Neon. Não entra no build nem no deploy.
- *Alternativa:* exigir `vercel dev` (precisa de login e projeto vinculado na Vercel e de um banco Neon só para desenvolver).

## Risks / Trade-offs

- [Sem autenticação: quem souber o id interno edita] → id é UUID não exposto no link público; escrita por token retorna 404; aceito para uso pessoal e documentado. Autenticação é a próxima melhoria.
- [Token público vaza] → regenerar token invalida o link antigo.
- [Cold start do Neon (~0,5–1 s) após inatividade] → driver HTTP; UI mostra carregamento; aceitável para uso pessoal.
- [oEmbed muda formato ou bloqueia] → falha é tolerada (faixa salva sem metadados); rótulo livre cobre a identificação. **Observado na implementação:** o oEmbed do SoundCloud responde com desafio de WAF (`x-amzn-waf-action: challenge`, HTTP 202 vazio) a requisições de servidor, então faixas do SoundCloud tendem a ficar sem metadados em cache. Possível melhoria futura: buscar o oEmbed no navegador (o endpoint tem CORS aberto) e enviar os metadados junto com a adição.
- [Plataforma muda formato de URL] → parser isolado e coberto por testes, fácil de atualizar.
- [Iframes não informam falha de reprodução de forma confiável] → metadados e link original sempre visíveis ao lado do player (spec `embedded-playback`).
- [Spotify sem login toca só 30 s] → regra da plataforma; apenas avisamos, não contornamos.
- [Reescrever `position` de todas as faixas a cada reordenação] → custo irrelevante na escala pessoal.

## Migration Plan

Projeto novo, sem dados a migrar. Deploy:
1. Criar projeto no Neon e obter `DATABASE_URL`.
2. Rodar `npm run db:migrate` localmente apontando para o Neon.
3. Criar projeto na Vercel ligado ao repositório, configurar `DATABASE_URL` (Production e Preview) como variável de ambiente de servidor (sem prefixo `VITE_`).
4. Deploy; validar no preview e promover. Rollback = reverter para o deploy anterior na Vercel (migrações do MVP são aditivas).

## Open Questions

- Usar o branch de banco do Neon para previews da Vercel ou o mesmo banco? Pode ser decidido no deploy sem afetar specs nem tarefas.
