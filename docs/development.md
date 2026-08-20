# Development — Como rodar localmente

> Guia para desenvolvedores que desejam rodar, testar e debugar o projeto localmente.

## Pré-requisitos

| Ferramenta  | Versão  |
| ----------- | ------- |
| Node.js     | >= 20   |
| npm         | >= 10   |

## 1. Clone e instale

```bash
git clone https://github.com/seu-usuario/maceio-cinema-bot.git
cd maceio-cinema-bot

npm install
# ou, para instalação determinística (como no Render):
npm ci
```

## 2. Configure variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env`:

```env
TELEGRAM_BOT_TOKEN=seu_token_aqui        # obrigatório para o bot (via @BotFather)
OMDb_API_KEY=sua_chave_omdb              # opcional (notas IMDb/RT)
TMDB_API_KEY=sua_chave_tmdb              # opcional (fallback TMDb)
# PORT = 10000                           # opcional, padrão local
```

> 💡 Apenas `TELEGRAM_BOT_TOKEN` é obrigatório para `npm run bot:listen`.
> A CLI (`npm start`) funciona **sem nenhum token**.

## 3. Scripts

| Script             | Comando               | Descrição                                                     |
| ------------------ | --------------------- | ------------------------------------------------------------- |
| `start`            | `node src/index.js`   | CLI — valida a pipeline (fetch + console). Sem tokens.        |
| `bot:listen`       | `node src/bot.js`     | Bot Telegram (polling) + Express health check. Exige token.  |
| `lint`             | `eslint src/`         | Lint (ESLint + Prettier).                                     |
| `lint:fix`         | `eslint src/ --fix`   | Lint + correção automática.                                   |
| `format`           | `prettier --write src/` | Formatação automática.                                    |
| `format:check`     | `prettier --check src/` | Verifica formatação.                                    |

## 4. Como validar a pipeline sem Telegram

```bash
npm start
```

Isso executa `src/index.js`, que:
1. Faz fetch da programação de hoje (Cinesystem, teatro `1162`).
2. Normaliza os dados.
3. Imprime no console a lista de filmes e sessões.

Este é o método **recomendado** para validar que a codebase funciona — não requer
nenhum token.

## 5. Como rodar o bot

```bash
npm run bot:listen
```

- O bot inicia em **polling mode** (sem webhook).
- Health check disponível em `http://localhost:10000/`.
- No Telegram, envie `/start` e escolha um cinema.

### Debug: verificar conexão

Com o bot rodando e `TELEGRAM_BOT_TOKEN` no `.env`:

```bash
# Identidade
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
# Comandos (devem ser 4)
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands"
# Webhook (deve estar vazio para polling)
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
# Health check local
curl -s http://localhost:10000/
```

## 6. Lint e formatação

O projeto usa ESLint + Prettier:

```bash
npm run lint         # verifica erros
npm run lint:fix     # corrige automaticamente
npm run format       # formata todos os arquivos
npm run format:check # verifica formatação
```

## 7. Estrutura de diretórios

```
maceio-cinema-bot/
├── src/                    # Código fonte (ES Modules)
│   ├── api.js              # Cliente da API Ingresso.com
│   ├── normalize.js        # Normalização / desnormalização
│   ├── cache.js            # Cache JSON persistido
│   ├── data.js             # Camada de acesso a dados (cache ↔ API)
│   ├── cinemas.js          # Definição de cinemas + preferências
│   ├── format.js           # Formatação de mensagens Telegram
│   ├── ratings.js          # Busca de notas (OMDb/TMDb)
│   ├── keyboards.js        # Teclados inline do Telegram
│   ├── handlers.js         # Handlers de comandos e callbacks
│   ├── bot.js              # Entry point do bot (polling + Express)
│   └── index.js            # CLI (verificação manual)
├── docs/                   # Documentação técnica
│   ├── architecture.md
│   ├── data-model.md
│   ├── caching.md
│   ├── api-reference.md
│   ├── deployment.md
│   └── development.md
├── data/                   # Diretório criado em runtime (não commitado)
│   └── cache.json          # Cache persistido
├── .env.example            # Template de variáveis
├── Dockerfile
├── eslint.config.js
├── package.json
└── README.md               # Visão geral para usuários
```

## 8. Fluxo de desenvolvimento recomendado

```bash
# 1. Valida pipeline sem Telegram
npm start

# 2. Lint + format
npm run lint:fix
npm run format

# 3. Roda o bot localmente
npm run bot:listen
# (envia /start no Telegram para testar interativamente)
```

## 9. Observações

- **Nenhum banco de dados** — o estado é mantido em `data/cache.json` + Maps em memória.
- O diretório `data/` é criado automaticamente na primeira execução.
- O cache expira na virada do dia (fuso `America/Maceio`) — rode `npm start` após
  meia-noite para renovar os dados.
