

## V5 — personalização e logo
- A cor secundária agora define o fundo principal e áreas de navegação.
- A logo pode ser enviada diretamente do computador (PNG/JPG/WEBP/SVG, até 3 MB). Os arquivos ficam em `server/uploads` e são servidos em `/uploads`.
- Após atualizar, execute `npm install` na raiz para instalar a dependência `multer`. Não é necessário criar outro banco. Faça backup antes de substituir arquivos de uma instalação existente.

## V6 — persistência de identidade visual e temas
- As configurações da empresa são recarregadas da API autenticada após login e na inicialização da sessão; o banco MySQL é a fonte de verdade para nome, cores e logo.
- O tema claro/escuro fica salvo em `localStorage` e o seletor permanece no canto superior direito. Alternar tema restaura a paleta padrão correspondente (claro: branco/cinza com azul; escuro: azul-marinho com azul). Ao salvar a identidade visual nas Configurações, a paleta personalizada da empresa volta a ser aplicada.
- A logo enviada fica no banco como caminho `/uploads/...` e o arquivo é salvo em `server/uploads`. Inclua essa pasta em backups e use armazenamento persistente na hospedagem.

## Configurar o assistente com OpenAI
1. Copie `server/.env.example` para `server/.env` (não para `client/.env`).
2. Cole a chave como `OPENAI_API_KEY=sua_chave_completa`, sem `Bearer`, sem espaços antes/depois e sem publicar o arquivo.
3. Deixe `OPENAI_MODEL=gpt-4o-mini`, a menos que tenha confirmado acesso a outro modelo.
4. Confira se o faturamento/créditos da Plataforma API está ativo; a assinatura do ChatGPT é cobrada separadamente.
5. Pare e inicie novamente o projeto com `npm run dev`. A chave é lida pelo backend e não deve ter prefixo `VITE_`.
6. Se falhar, o assistente agora mostra uma mensagem de diagnóstico (chave inválida, falta de cota, acesso ao modelo ou conexão). O terminal do backend registra o código da API, nunca a chave.

## OficinaPro Sounds (V8)

O menu **Sounds** permite incorporar um link público de música, álbum ou playlist do Spotify ou Deezer. O player é mantido no layout principal para continuar montado ao navegar entre as telas. A seleção fica salva no `localStorage` do navegador; ao fechar/remover o player, a reprodução é interrompida.

- Spotify: use um link direto `open.spotify.com/track/...`, `/album/...` ou `/playlist/...`.
- Deezer: use um link direto `deezer.com/track/...`, `/album/...` ou `/playlist/...`.
- A reprodução precisa ser iniciada pelo usuário no player incorporado; o navegador pode bloquear autoplay. A disponibilidade de faixas e controles depende das regras e da conta da plataforma.
- Esta versão incorpora os players oficiais; ela **não implementa OAuth nativo dentro do OficinaPro** nem guarda credenciais das plataformas. Login, quando solicitado, é tratado pelo player/serviço oficial. OAuth próprio exigiria cadastrar aplicativos nas plataformas e configurar client IDs, redirect URIs e fluxo de autorização.

