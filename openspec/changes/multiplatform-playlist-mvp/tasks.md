# Tasks

## 1. Estrutura do projeto

- [x] 1.1 Inicializar o projeto Vite + React + TypeScript na raiz (`package.json`, `src/`, `index.html`, `tsconfig`) e verificar que `npm run dev` sobe a página inicial
- [x] 1.2 Adicionar dependências (`@neondatabase/serverless`, `zod`, `react-router-dom`, `@vercel/node` e, como dev, `vitest`, `vercel`) e verificar que `npm install` e `npm run build` concluem sem erros
- [x] 1.3 Criar as pastas `api/`, `shared/`, `db/migrations/` e `scripts/`, configurar o Vitest e o alias de import de `shared/` para front e API, e verificar que um teste vazio roda com `npm test`
- [ ] 1.4 Criar `vercel.json` com rewrite de rotas não-`/api` para `index.html` e header CSP (`frame-src` só para youtube-nocookie.com, open.spotify.com e w.soundcloud.com), `.env.example` com `DATABASE_URL` e `.gitignore` cobrindo `.env*`, e verificar com `vercel dev` que `/p/qualquer` serve a SPA

## 2. Banco de dados

- [ ] 2.1 Escrever `db/migrations/001_init.sql` com as tabelas `playlists` e `tracks`, constraints e índice conforme o design, e verificar aplicando-o num branch do Neon sem erros
- [ ] 2.2 Implementar `scripts/migrate.ts` (`npm run db:migrate`) que aplica migrações pendentes registrando-as em `schema_migrations`, e verificar que uma segunda execução não reaplica nada
- [x] 2.3 Criar `api/_lib/db.ts` exportando o cliente `sql` lido de `process.env.DATABASE_URL` (apenas servidor) e verificar com `npm run build` + busca no `dist/` que nenhuma string `DATABASE_URL`/`neon.tech` aparece no bundle do front
- [ ] 2.4 Documentar no `README.md` como criar o projeto Neon, configurar `DATABASE_URL` e rodar as migrações, e verificar seguindo os passos num banco limpo

## 3. Parsing de links (módulo compartilhado)

- [x] 3.1 Implementar `shared/limits.ts` (nome 100, rótulo 200, URL 2048) e os schemas `zod` de payload em `shared/schemas.ts`, com testes cobrindo limites e trim de espaços
- [x] 3.2 Implementar `shared/parseTrackUrl.ts` para YouTube (watch, youtu.be, shorts, live, embed, hosts m./music.) ignorando parâmetros extras, e verificar com testes de tabela incluindo os exemplos da spec `track-links`
- [x] 3.3 Estender o parser para Spotify (`/track/`, prefixo `intl-xx`, URI `spotify:track:`) rejeitando álbum/playlist/artista/episódio, e verificar com testes positivos e negativos
- [x] 3.4 Estender o parser para SoundCloud (`<usuario>/<faixa>` em minúsculas, hosts www./m., sinalização `needsResolution` para `on.soundcloud.com`) rejeitando sets, perfis, likes e reposts, e verificar com testes
- [x] 3.5 Cobrir entradas inválidas (texto não-URL, outra plataforma, URL > 2048) com mensagens de erro em pt-BR e verificar com testes que nenhuma retorna plataforma

## 4. Serviços externos do servidor (oEmbed e link curto)

- [x] 4.1 Implementar `api/_lib/oembed.ts` com os três endpoints oEmbed, timeout de 4 s via `AbortController` e mapeamento para `{ title, artist, thumbnailUrl }` (nulos em falha), e verificar com testes usando `fetch` mockado para sucesso, erro HTTP e timeout
- [x] 4.2 Implementar `api/_lib/resolveShortLink.ts` para `on.soundcloud.com` com `HEAD` e `redirect: 'manual'` (máx. 3 saltos, sem ler corpo), reaplicando o parser na URL final, e verificar com testes mockados incluindo redirecionamento para set (rejeitado)

## 5. API de playlists

- [x] 5.1 Criar `api/_lib/http.ts` com helpers de resposta `{ error: { code, message } }` (400/404/409/500 genérico, log do detalhe no servidor), validação de UUID e geração de token base64url de 16 bytes, com testes unitários
- [x] 5.2 Implementar `GET`/`POST /api/playlists` (lista com contagem ordenada por `updated_at desc`; criação com token) e verificar com testes de handler (sql mockado) para criação válida, nome vazio e nome com 101 caracteres
- [x] 5.3 Implementar `GET`/`PATCH`/`DELETE /api/playlists/[id]` (detalhe com faixas ordenadas e `shareToken`, renomear, excluir em cascata) e verificar com testes cobrindo 404 para id inexistente e para id que não é UUID
- [x] 5.4 Implementar `POST /api/playlists/[id]/share-token` (regenera token) e verificar com teste que o token muda e o antigo deixa de ser encontrado

## 6. API de faixas

- [x] 6.1 Implementar `POST /api/playlists/[id]/tracks` (valida, resolve link curto, busca oEmbed, insere no fim com `position = count`, atualiza `updated_at` da playlist) e verificar com testes para rótulo, sem rótulo, rótulo de 201 caracteres, link inválido e falha de oEmbed (faixa salva com metadados nulos)
- [x] 6.2 Implementar `PATCH`/`DELETE /api/playlists/[id]/tracks/[trackId]` (editar rótulo; remover e recompactar posições numa transação), filtrando sempre por `playlist_id`, e verificar com testes incluindo 404 para faixa de outra playlist
- [x] 6.3 Implementar `PUT /api/playlists/[id]/tracks/order` com checagem de conjunto idêntico (409 caso contrário) e reescrita de `position` via `unnest ... with ordinality` numa transação, e verificar com testes para ordem válida, faixa omitida e faixa de outra playlist
- [ ] 6.4 Verificar contra um banco Neon real (via `vercel dev`) o fluxo adicionar 3 faixas de plataformas diferentes → reordenar → remover → recarregar, conferindo as posições no banco

## 7. API pública de compartilhamento

- [x] 7.1 Implementar `GET /api/shared/[token]` retornando nome e faixas (rótulo, plataforma, external_id, URL original/canônica, metadados) sem o id da playlist, com 404 genérico para token inexistente, e verificar com testes que a resposta não contém o UUID da playlist
- [x] 7.2 Verificar com testes que rotas de escrita chamadas com o token público no lugar do id respondem 404 e não alteram nada

## 8. Front: lista e edição de playlists

- [x] 8.1 Criar `src/api/client.ts` (fetch tipado para todas as rotas, tratamento do formato de erro) e o roteamento `/`, `/p/:id`, `/s/:token`, e verificar navegando entre as rotas no `npm run dev` com API mockada ou `vercel dev`
- [x] 8.2 Implementar a tela `/` com lista (nome, contagem), estado vazio e formulário de criação com validação de nome, e verificar manualmente criação válida, nome vazio e estado vazio
- [x] 8.3 Implementar na tela `/p/:id` o cabeçalho com renomear, excluir com confirmação e "copiar link público" + "regenerar link" com confirmação, e verificar manualmente cada ação e o link copiado

## 9. Front: faixas

- [x] 9.1 Implementar o formulário "colar link + rótulo" usando `parseTrackUrl` para feedback imediato (plataforma detectada ou erro) e chamando a API, e verificar manualmente com um link de cada plataforma e um link de álbum do Spotify
- [x] 9.2 Implementar a lista de faixas (thumbnail, rótulo, título/artista em cache, ícone de plataforma, link original; fallback título → URL quando sem rótulo) com estado vazio, e verificar manualmente com faixa sem metadados
- [x] 9.3 Implementar edição de rótulo inline, remoção e reordenação com botões subir/descer (acessíveis por teclado) chamando a API, e verificar que a ordem persiste ao recarregar
- [ ] 9.4 Adicionar arrastar-e-soltar com `@dnd-kit/sortable` reutilizando a mesma chamada de reordenação, e verificar manualmente que arrastar e botões produzem o mesmo resultado persistido

## 10. Front: reprodução e visualização compartilhada

- [x] 10.1 Implementar `<EmbedPlayer>` com iframes oficiais (youtube-nocookie, embed de faixa do Spotify, widget do SoundCloud com URL canônica), sem autoplay e com um único player ativo, e verificar com teste de componente que a URL do iframe é montada corretamente para cada plataforma
- [ ] 10.2 Exibir junto ao player o rótulo, metadados em cache, link original e, para Spotify, o aviso sobre login/prévia de 30 s, e verificar manualmente com um vídeo removido do YouTube e com Spotify deslogado
- [x] 10.3 Implementar a tela `/s/:token` reutilizando lista e player sem nenhum controle de edição, com página de "playlist não encontrada", e verificar manualmente com token válido, token inexistente e token regenerado

## 11. Deploy e verificação integrada

- [ ] 11.1 Criar o projeto na Vercel, configurar `DATABASE_URL` como variável de servidor (Production e Preview), rodar migrações no Neon de produção e fazer deploy, verificando que o app abre na URL pública
- [ ] 11.2 Executar no deploy o roteiro de ponta a ponta: criar playlist, adicionar faixas das três plataformas (incluindo link curto do SoundCloud), rotular, reordenar, remover, tocar cada uma, abrir o link público em janela anônima e confirmar ausência de controles de edição
- [ ] 11.3 Conferir no DevTools que nenhuma requisição de mídia vai para `/api`, que o bundle não contém credenciais e que a CSP bloqueia iframes de outros domínios, e registrar o resultado no `README.md`
