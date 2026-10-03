# track-links Specification

## Purpose
Permite adicionar faixas a uma playlist colando links do YouTube, Spotify ou SoundCloud, guardando apenas referências (URL, plataforma, identificador externo, rótulo e metadados em cache), além de listar, reordenar e remover essas faixas.

## Requirements

### Requirement: Detecção de plataforma e extração do identificador
Ao receber um link, o sistema SHALL identificar a plataforma e extrair o identificador externo da faixa conforme os formatos suportados abaixo. Espaços nas bordas MUST ser ignorados e a URL MUST ter no máximo 2048 caracteres.

- **YouTube** — hosts `youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com` e `youtu.be`; formatos `/watch?v=<id>`, `youtu.be/<id>`, `/shorts/<id>`, `/live/<id>` e `/embed/<id>`. O identificador é o id de vídeo de 11 caracteres (`A-Z`, `a-z`, `0-9`, `-`, `_`). Parâmetros extras (ex.: `t`, `list`, `si`) MUST ser ignorados para fins de identificação.
- **Spotify** — `open.spotify.com/track/<id>` (inclusive com prefixo de localidade, como `/intl-pt/track/<id>`) e a URI `spotify:track:<id>`. O identificador é o id base62 de 22 caracteres. Links de álbum, playlist, artista, episódio ou podcast MUST ser rejeitados.
- **SoundCloud** — `soundcloud.com/<usuario>/<faixa>` (também `www.` e `m.`) e links curtos `on.soundcloud.com/<codigo>`, que o servidor SHALL resolver para a URL canônica seguindo redirecionamentos HTTP, sem baixar áudio. O identificador é o caminho canônico `<usuario>/<faixa>` em minúsculas. Links de sets/álbuns (`/sets/`), perfis, likes ou reposts MUST ser rejeitados.

#### Scenario: Link do YouTube com parâmetros extras
- **WHEN** a usuária cola `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123`
- **THEN** o sistema detecta a plataforma `youtube` com identificador externo `dQw4w9WgXcQ`

#### Scenario: Link curto do YouTube
- **WHEN** a usuária cola `https://youtu.be/dQw4w9WgXcQ?si=abc`
- **THEN** o sistema detecta a plataforma `youtube` com identificador externo `dQw4w9WgXcQ`

#### Scenario: Link de faixa do Spotify com localidade
- **WHEN** a usuária cola `https://open.spotify.com/intl-pt/track/4uLU6hMCjMI75M1A2tKUQC?si=xyz`
- **THEN** o sistema detecta a plataforma `spotify` com identificador externo `4uLU6hMCjMI75M1A2tKUQC`

#### Scenario: Link de álbum do Spotify
- **WHEN** a usuária cola `https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3`
- **THEN** o sistema rejeita o link com a mensagem de que apenas faixas individuais são suportadas

#### Scenario: Link de faixa do SoundCloud
- **WHEN** a usuária cola `https://soundcloud.com/Artista-Pequeno/demo-2024?in=foo`
- **THEN** o sistema detecta a plataforma `soundcloud` com identificador externo `artista-pequeno/demo-2024`

#### Scenario: Link de set do SoundCloud
- **WHEN** a usuária cola `https://soundcloud.com/artista/sets/ep-1`
- **THEN** o sistema rejeita o link com a mensagem de que apenas faixas individuais são suportadas

#### Scenario: Link de plataforma não suportada
- **WHEN** a usuária cola `https://www.deezer.com/track/12345` ou um texto que não é URL
- **THEN** o sistema rejeita a entrada informando que só links de YouTube, Spotify e SoundCloud são aceitos, e nenhuma faixa é criada

### Requirement: Adicionar faixa por link
O sistema SHALL permitir adicionar uma faixa a uma playlist apenas colando um link suportado, com rótulo livre opcional de até 200 caracteres. A faixa adicionada SHALL ir para o final da playlist e SHALL armazenar a URL original, a plataforma, o identificador externo, o rótulo e os metadados em cache. O sistema MUST NOT oferecer busca de músicas nem usar APIs de dados restritas ou pagas das plataformas (como a Spotify Web API ou a SoundCloud API). O sistema SHALL aceitar a mesma faixa mais de uma vez na mesma playlist.

#### Scenario: Adição com rótulo
- **WHEN** a usuária cola um link válido do YouTube com o rótulo "Radiohead – Weird Fishes (ao vivo, Lollapalooza 2016)"
- **THEN** a faixa é criada no final da playlist com esse rótulo, a plataforma `youtube`, o identificador extraído e a URL original exatamente como colada (sem espaços nas bordas)

#### Scenario: Adição sem rótulo
- **WHEN** a usuária adiciona um link válido sem rótulo
- **THEN** a faixa é criada com rótulo vazio e é exibida usando o título em cache ou, na falta dele, a URL original

#### Scenario: Rótulo longo demais
- **WHEN** a usuária tenta adicionar uma faixa com rótulo de 201 caracteres
- **THEN** o sistema rejeita a operação com uma mensagem de erro de validação

#### Scenario: Adição em playlist inexistente
- **WHEN** uma requisição tenta adicionar faixa a uma playlist cujo identificador não existe
- **THEN** o sistema responde com erro de "não encontrado"

### Requirement: Metadados em cache
No momento da adição, o sistema SHALL tentar obter título, artista/autor e URL da thumbnail pelos endpoints públicos de oEmbed da plataforma e SHALL armazená-los junto à faixa. Esses metadados MUST permanecer armazenados mesmo que a faixa deixe de existir na origem. Se a consulta de metadados falhar ou exceder o tempo limite, a faixa SHALL ser adicionada assim mesmo, com os campos de metadados vazios.

#### Scenario: Metadados obtidos
- **WHEN** a usuária adiciona um link de SoundCloud cujo oEmbed responde com título, autor e thumbnail
- **THEN** a faixa é salva com esses três valores em cache

#### Scenario: Falha na consulta de metadados
- **WHEN** a usuária adiciona um link válido e o oEmbed da plataforma responde com erro ou não responde a tempo
- **THEN** a faixa é adicionada com metadados vazios e a usuária vê a faixa na lista normalmente

#### Scenario: Faixa removida na origem depois de adicionada
- **WHEN** um vídeo do YouTube adicionado com metadados é removido do YouTube
- **THEN** a playlist continua exibindo rótulo, título, artista e thumbnail em cache da faixa

### Requirement: Editar rótulo de faixa
O sistema SHALL permitir alterar o rótulo de uma faixa existente, com o mesmo limite de 200 caracteres. A edição MUST NOT alterar URL, plataforma, identificador externo, metadados ou posição.

#### Scenario: Rótulo alterado
- **WHEN** a usuária altera o rótulo de uma faixa para "versão acústica"
- **THEN** o novo rótulo é persistido e os demais dados da faixa permanecem iguais

### Requirement: Listar faixas
O sistema SHALL listar as faixas de uma playlist na ordem definida, exibindo para cada uma o rótulo (quando houver), o título e o artista em cache, a thumbnail em cache, a plataforma e um link para a URL original.

#### Scenario: Playlist com faixas de três plataformas
- **WHEN** a usuária abre uma playlist com uma faixa de cada plataforma
- **THEN** as três faixas aparecem na ordem salva, cada uma com indicação da sua plataforma e seus dados em cache

#### Scenario: Playlist vazia
- **WHEN** a usuária abre uma playlist sem faixas
- **THEN** o sistema exibe um estado vazio com o campo para colar um link

### Requirement: Reordenar faixas
O sistema SHALL permitir mudar a posição das faixas de uma playlist. Uma reordenação MUST conter exatamente o conjunto de faixas atual da playlist; caso contrário, SHALL ser rejeitada sem alterar nada. A nova ordem MUST persistir entre sessões e ser refletida no link público.

#### Scenario: Mover faixa para o topo
- **WHEN** a usuária move a terceira faixa para a primeira posição
- **THEN** a nova ordem é persistida e, ao recarregar a página, a faixa aparece em primeiro

#### Scenario: Reordenação com conjunto divergente
- **WHEN** uma requisição de reordenação omite uma faixa existente ou inclui uma faixa de outra playlist
- **THEN** o sistema rejeita a requisição com erro de conflito e a ordem atual não muda

### Requirement: Remover faixa
O sistema SHALL permitir remover uma faixa de uma playlist. As faixas restantes MUST manter sua ordem relativa.

#### Scenario: Remoção de faixa do meio
- **WHEN** a usuária remove a segunda de três faixas
- **THEN** restam duas faixas, na mesma ordem relativa de antes

#### Scenario: Remoção de faixa de outra playlist
- **WHEN** uma requisição tenta remover, pela playlist A, uma faixa que pertence à playlist B
- **THEN** o sistema responde com erro de "não encontrado" e nada é removido
