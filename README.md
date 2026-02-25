[Acessar Cinesystem Bot no Telegram](https://t.me/Cinesystemfilmes_bot)

# Cinesystem Maceió - Bot & Scraper

Bot Telegram + CLI que consulta a programação do [Cinesystem Maceió](https://www.ingresso.com/cinema/cinesystem-maceio?city=maceio) usando a API pública do Ingresso.com.

Extrai filmes, horários e preços (inteira + meia) diretamente via API — sem browser headless, sem Playwright.

## Funcionalidades

- **Filmes, sessões e preços via API** — respostas em menos de 1 segundo
- **Bot Telegram interativo** — botões inline para hoje e amanhã
- **Cache diário** — evita requisições repetidas no mesmo dia (expira à meia-noite de Maceió)
- **CLI** — consulta rápida pelo terminal com saída JSON
- **Docker-ready** — imagem leve (`node:20-slim`)

## Requisitos

- Node.js 18+
- Token de bot Telegram (via [@BotFather](https://t.me/BotFather))

## Instalação

```bash
git clone <repo-url>
cd cinesystem-scrapper
npm install
cp .env.example .env
# Edite .env e configure TELEGRAM_BOT_TOKEN
```

## Uso

### Bot Telegram

```bash
npm run bot:listen
```

O bot inicia com:

- Health check na porta 3000 (configurável via `PORT`)
- Polling contínuo para receber comandos do Telegram
- Cache automático por dia (fuso de Maceió)

#### Comandos do Bot

| Comando / Botão | Descrição |
| --- | --- |
| `/start` | Menu principal com botões inline |
| `/atualizar` | Busca dados novos ignorando o cache |
| Filmes de Hoje | Lista filmes de hoje com preços |
| Filmes de Amanhã | Lista filmes de amanhã com preços |
| Como Funciona | Informações sobre o bot |

### CLI

```bash
npm start                    # Programação de hoje
npm start -- 25/02/2026     # Data específica (DD/MM/YYYY)
```

A saída é salva em `data/state.json`.

## Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Sim | — | Token do bot obtido via @BotFather |
| `PORT` | Não | `3000` | Porta do servidor Express (health check) |

## Arquitetura

```
src/
├── api.js       # Cliente da API Ingresso.com (axios)
├── scraper.js   # Wrapper de orquestração sobre a API
├── cache.js     # Cache em arquivo JSON com expiração diária
├── bot.js       # Bot Telegram (polling + Express)
└── index.js     # CLI
```

### `api.js` — Cliente da API

- Consulta `https://api-content.ingresso.com`
- Resolve automaticamente a data disponível no cinema
- Busca eventos (filmes) e sessões com preços por filme
- Filtra sessões pelo ID do Cinesystem Maceió (`1162`)
- Deduplica filmes por nome

### `scraper.js` — Orquestração

- Wrapper fino sobre `api.js`
- Retorna `{ movies, noSessions, scrapedAt }`

### `cache.js` — Cache Diário

- Armazena resultados em `data/movies-cache.json`
- Mantém cache separado para "hoje" e "amanhã"
- Expira automaticamente na virada do dia (fuso `America/Maceio`)

### `bot.js` — Bot Telegram

- Modo polling (sem webhook)
- Express server para health check
- Inline keyboard com opções de hoje / amanhã / info
- Comando `/atualizar` para forçar refresh

### `index.js` — CLI

- Aceita data opcional como argumento (`DD/MM/YYYY`)
- Salva resultado em `data/state.json`
- Exibe programação formatada no terminal

## Saída JSON

```json
{
  "movies": [
    {
      "name": "Avatar: Fogo E Cinzas",
      "sessions": [
        {
          "time": "20:45",
          "sessionId": "84078366",
          "priceInteira": 55.86,
          "priceMeia": 27.93,
          "gratuito": false
        }
      ]
    }
  ],
  "scrapedAt": "2026-02-22T13:34:38.702Z"
}
```

## Docker

```bash
docker build -t cinesystem-bot .
docker run -e TELEGRAM_BOT_TOKEN=seu_token cinesystem-bot
```

O Dockerfile usa `node:20-slim` e executa `npm run bot:listen`.

## Deploy no Render

1. Criar um **Web Service** conectado ao repositório GitHub
2. **Build Command:** `npm ci`
3. **Start Command:** `npm run bot:listen`
4. **Environment Variables:** configurar `TELEGRAM_BOT_TOKEN`
5. Render detecta `PORT` automaticamente (padrão `3000`)

### Verificar Status

- `GET https://seu-app.render.com/` retorna JSON com status do bot
- Teste enviando `/start` ao bot no Telegram

## Dependências

| Pacote | Uso |
| --- | --- |
| `axios` | Requisições HTTP para API do Ingresso.com |
| `node-telegram-bot-api` | Integração com a API do Telegram |
| `express` | Servidor HTTP para health check |
| `dotenv` | Carregamento de variáveis de ambiente |

## Licença

MIT
