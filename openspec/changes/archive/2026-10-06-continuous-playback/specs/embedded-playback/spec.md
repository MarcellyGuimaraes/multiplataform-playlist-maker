# Spec Delta

## ADDED Requirements

### Requirement: Controle dos players pelas interfaces oficiais
O sistema SHALL controlar os players embutidos oficiais apenas pelas interfaces que as próprias plataformas oferecem no navegador: a YouTube IFrame Player API, a SoundCloud Widget API e, no Spotify, as mensagens que o iframe de embed oficial troca com a página. Essas mensagens são o mesmo protocolo que a Spotify iFrame API usa internamente. O controle SHALL se limitar a carregar faixas, solicitar reprodução e receber eventos de estado (início, pausa, progresso, fim e erro). O servidor MUST NOT participar da reprodução, e as APIs de dados restritas das plataformas MUST NOT ser usadas.

#### Scenario: Detectar o fim de uma faixa
- **WHEN** uma faixa termina de tocar no player embutido
- **THEN** o app recebe essa informação pela interface oficial do player da plataforma, no navegador, sem nenhuma requisição à API do app

### Requirement: Spotify mantém o iframe de embed do MVP
O player do Spotify SHALL continuar sendo o mesmo iframe de embed oficial usado no MVP (`open.spotify.com/embed/track/<id>`, sem parâmetros adicionais), para que quem tem login no Spotify continue ouvindo a faixa completa. O sistema MUST NOT trocar esse iframe por outro que limite a reprodução à prévia.

#### Scenario: Ouvinte com login no Spotify
- **WHEN** alguém com login no Spotify neste navegador toca uma faixa do Spotify no app
- **THEN** a faixa toca completa, como no MVP, e o avanço automático continua funcionando ao fim dela

## REMOVED Requirements

### Requirement: Sem reprodução contínua automática
**Reason**: Substituído pela reprodução contínua (capability `continuous-playback`). Ao fim de uma faixa, o app passa a carregar e tocar a próxima, controlando os players pelas interfaces oficiais de player.
**Migration**: Quem prefere o comportamento anterior pode desligar o autoplay no player. A preferência fica salva no navegador.
