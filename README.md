# 🎬 Maceió Cine Bot

> Bot de Telegram que consulta a programação dos cinemas de Maceió em tempo real, com horários, preços e link direto para compra de ingressos.

[Testar no Telegram](https://t.me/MaceioCine_bot)

---

## 🟢 Status do Deploy

O bot está **hospedado no [Render](https://render.com)** e permanece estável em produção.

| Item | Detalhe |
| --- | --- |
| 🌐 **URL do serviço** | https://cinesystem-scrapper.onrender.com |
| 📡 **Health check** | `GET https://cinesystem-scrapper.onrender.com/` — retorna status e timestamp em JSON |
| 🔌 **Porta** | Dinâmica via `process.env.PORT` (fallback `10000`), conforme exigido pelo Render |
| 📋 **Logs** | Health check e graceful shutdown (SIGTERM/SIGINT) para monitoramento da estabilidade do container |

---

## ✨ Funcionalidades

🎥 **Filmes de Hoje** — Programação completa com horários, formatos (2D, 3D, Cinépic, VIP) e preços

🏢 **Múltiplos Cinemas** — Suporte a 3 redes de cinema em Maceió:

| Cinema | Shopping |
| --- | --- |
| Cinesystem | Parque Shopping Maceió |
| Centerplex | Shopping Pátio Maceió |
| Kinoplex | Maceió Shopping |

🆕 **Próximos Lançamentos** — Filmes futuros com datas de estreia e pré-vendas

🎫 **Compra Direta** — Botão inline que redireciona para a página do cinema no Ingresso.com

⚡ **Cache Inteligente** — Cache diário por cinema com expiração automática à meia-noite (fuso `America/Maceio`), evitando requisições desnecessárias

🔄 **Normalização de Dados** — Preços, horários e tipos de sala normalizados a partir da API

---

## 🤖 Preview

Teste agora mesmo no Telegram: **[@@MaceioCine_bot](https://t.me/MaceioCine_bot)**

```
Usuário: /start
Bot:     Olá! Eu sou o seu guia de cinema em Maceió. 🍿
         Escolha abaixo qual cinema você deseja consultar:

         [ Cinesystem (Parque Shopping Maceió) ]
         [ Centerplex (Shopping Pátio Maceió)  ]
         [ Kinoplex (Maceió Shopping)           ]

Usuário: clica em "Cinesystem"
Bot:     ✅ Cinema selecionado: Cinesystem (Parque Shopping Maceió)

         [ 🎬 Filmes de Hoje ] [ 🆕 Próximos Lançamentos ]
         [ 🔄 Trocar de Cinema                            ]

Usuário: clica em "Filmes de Hoje"
Bot:     🎬 PROGRAMAÇÃO
         📍 Cinesystem (Parque Shopping Maceió)
         📅 24 de fevereiro de 2026

         🎭 Avatar: Fogo E Cinzas
            🎞 2D: 14:30, 17:45, 20:45 — R$ 55,86
            ⭐ VIP: 21:00 — R$ 72,00
         ...

         [ 🎫 Comprar Ingressos           ]
         [ ⬅️ Voltar ao menu ] [ 🔄 Trocar cinema ]
```

---

## 📋 Comandos

| Comando | Descrição |
| --- | --- |
| `/start` | Iniciar o bot e escolher cinema |
| `/hoje` | Filmes em cartaz no cinema selecionado |
| `/proximos` | Lançamentos futuros e pré-vendas |
| `/cinemas` | Trocar de cinema selecionado |

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
| --- | --- |
| **Node.js** | Runtime do bot e da CLI |
| **Telegram Bot API** | Bot via [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) (modo polling) |
| **Axios** | Requisições HTTP para a API do Ingresso.com |
| **Express** | Servidor HTTP para health check (porta dinâmica) |
| **dotenv** | Gerenciamento de variáveis de ambiente |

---

## 🚀 Como Rodar

### Rodar localmente

**1. Clone o repositório**

```bash
git clone https://github.com/seu-usuario/maceio-cinema-bot.git
cd maceio-cinema-bot
```

**2. Instale as dependências**

```bash
npm install
```

**3. Configure as variáveis de ambiente**

```bash
cp .env.example .env
```

Edite o `.env` e defina o token do bot (obtido via [@BotFather](https://t.me/BotFather)):

```env
TELEGRAM_BOT_TOKEN=seu_token_aqui
```

Opcionalmente, defina `PORT` (padrão local: `10000`). No Render, a porta é injetada automaticamente.

**4. Inicie o bot**

```bash
npm run bot:listen
```

O bot ficará escutando comandos no Telegram. O health check estará em `http://localhost:10000/` (ou na porta definida em `PORT`).

---

## 📂 Arquitetura

O projeto é uma aplicação Node.js com 11 módulos em `src/`. Veja a
[documentação completa de arquitetura](docs/architecture.md) para detalhes sobre
fluxos de dados e responsabilidades.

| Módulo          | Responsabilidade curta                                           |
| --------------- | ---------------------------------------------------------------- |
| `api.js`        | Cliente HTTP (Axios) para a API pública do Ingresso.com          |
| `normalize.js`  | Separa dados estáticos de filmes dos dinâmicos de sessões        |
| `cache.js`      | Cache JSON (`data/cache.json`) com expiração diária por cinema     |
| `data.js`       | Orquestra cache ↔ API ↔ normalize (cache hit antes da API)        |
| `cinemas.js`    | Definição dos 3 cinemas + preferências por usuário                |
| `format.js`     | Formatação de mensagens Telegram (Markdown)                       |
| `ratings.js`    | Notas IMDb/RT (OMDb) + fallback TMDb, cache 24h                   |
| `keyboards.js`  | Builders de teclados inline do Telegram                           |
| `handlers.js`   | Handlers de comandos e callbacks                                 |
| `bot.js`        | Entry point (polling + Express + graceful shutdown)               |
| `index.js`      | CLI para verificação rápida via terminal                          |

Veja também os documentos técnicos na pasta [`docs/`](./docs):

- [`docs/architecture.md`](docs/architecture.md) — fluxos de dados e módulos
- [`docs/data-model.md`](docs/data-model.md) — estrutura completa de `cache.json`
- [`docs/caching.md`](docs/caching.md) — regras de expiração e TTL
- [`docs/api-reference.md`](docs/api-reference.md) — endpoints e contratos
- [`docs/deployment.md`](docs/deployment.md) — deploy no Render
- [`docs/development.md`](docs/development.md) — como rodar localmente

---

## 🔧 Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Sim | — | Token do bot obtido via @BotFather |
| `PORT` | Não | `10000` | Porta do servidor (health check). No Render use a porta dinâmica `process.env.PORT` — o código já usa fallback `10000` |
| `OMDb_API_KEY` | Não | — | Chave da [OMDb](https://www.omdbapi.com/apikey.aspx) para buscar notas do IMDb e Rotten Tomatoes. Se não definida, essas notas não são exibidas. |
| `TMDB_API_KEY` | Não | — | Chave da [TMDb](https://www.themoviedb.org/settings/api). Usada como **fallback** para exibir nota TMDb quando a OMDb não retorna dados. |

---

## 🐳 Docker

```bash
docker build -t maceio-cine-bot .
docker run -e TELEGRAM_BOT_TOKEN=seu_token maceio-cine-bot
```

---

## ☁️ Deploy no Render

O bot está hospedado no [Render](https://render.com). Veja o
[guia completo de deploy](docs/deployment.md) para instruções detalhadas.

Resumo rápido: crie um **Web Service** conectado ao repositório, configure
`npm ci` como build command e `npm run bot:listen` como start command. O Render
injectiona `PORT` automaticamente — o código já usa `process.env.PORT` com
fallback `10000`.

---

## 📄 Licença

MIT
