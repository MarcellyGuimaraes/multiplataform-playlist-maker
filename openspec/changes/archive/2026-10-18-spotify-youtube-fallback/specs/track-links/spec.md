# Spec Delta

## ADDED Requirements

### Requirement: Versão no YouTube de faixa do Spotify
A dona de uma playlist SHALL poder cadastrar, numa faixa do Spotify, uma versão alternativa no YouTube, colando o link de um vídeo do YouTube. O link SHALL ser validado pelas mesmas regras de detecção de links do YouTube; links de outras plataformas, de playlists ou que não identifiquem um vídeo MUST ser rejeitados com mensagem de erro de validação. O sistema SHALL guardar apenas o identificador do vídeo. A dona SHALL poder trocar o vídeo cadastrado por outro ou remover a versão alternativa. Faixas do YouTube e do SoundCloud MUST NOT aceitar versão alternativa.

O cadastro é manual: o sistema MUST NOT procurar vídeos sozinho, sugerir vídeos nem consultar APIs de dados das plataformas para isso. Cadastrar, trocar ou remover a versão alternativa MUST NOT alterar o rótulo, a URL, a plataforma, o identificador externo, os metadados ou a posição da faixa, e SHALL seguir as mesmas regras de acesso das demais edições de faixa (só a dona; o token público não serve).

Na lista de faixas da tela de edição, faixas do Spotify com versão alternativa SHALL indicar que têm versão no YouTube, com link para o vídeo. A resposta da visualização pública SHALL incluir o identificador do vídeo alternativo, para que a reprodução funcione no link compartilhado.

#### Scenario: Cadastrar versão no YouTube
- **WHEN** a dona cola `https://youtu.be/dQw4w9WgXcQ` como versão no YouTube de uma faixa do Spotify
- **THEN** a faixa passa a ter a versão alternativa com o vídeo `dQw4w9WgXcQ` e os demais dados da faixa permanecem iguais

#### Scenario: Link que não é vídeo do YouTube
- **WHEN** a dona cola um link do SoundCloud ou um link de playlist do YouTube como versão alternativa
- **THEN** o sistema rejeita com mensagem de erro de validação e nada é alterado

#### Scenario: Trocar e remover
- **WHEN** a dona troca o vídeo alternativo por outro link do YouTube e, depois, remove a versão alternativa
- **THEN** a faixa passa a ter o novo vídeo e, depois, fica sem versão alternativa

#### Scenario: Faixa que não é do Spotify
- **WHEN** alguém tenta cadastrar versão alternativa numa faixa do YouTube ou do SoundCloud
- **THEN** o sistema rejeita com mensagem de erro de validação

#### Scenario: Outra conta ou token público
- **WHEN** uma requisição tenta cadastrar versão alternativa numa faixa de playlist de outra conta, ou usando o token público
- **THEN** o sistema responde "não encontrado" e nada é alterado

#### Scenario: Indicação na lista da dona
- **WHEN** a dona abre a edição de uma playlist com uma faixa do Spotify que tem versão no YouTube
- **THEN** a faixa mostra que tem versão no YouTube, com link para o vídeo e as ações de trocar e remover
