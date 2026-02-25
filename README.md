# 🎬 Maceió Cine Bot

> Bot de Telegram que consulta a programação dos cinemas de Maceió em tempo real, com horários, preços e link direto para compra de ingressos.

[Testar no Telegram](https://t.me/MaceioCine_bot)

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
| **Node.js** | Runtime do bot e CLI |
| **node-telegram-bot-api** | Integração com a API do Telegram (polling) |
| **Axios** | Requisições HTTP para a API do Ingresso.com |
| **Express** | Servidor HTTP para health check |
| **dotenv** | Gerenciamento de variáveis de ambiente |

---

## 🚀 Como Rodar

**1. Clone o repositório**

```bash
git clone https://github.com/seu-usuario/cinesystem-scrapper.git
cd cinesystem-scrapper
```

**2. Instale as dependências**

```bash
npm install
```

**3. Configure o ambiente**

```bash
cp .env.example .env
```

Edite o `.env` e adicione o token do seu bot (obtido via [@BotFather](https://t.me/BotFather)):

```env
TELEGRAM_BOT_TOKEN=seu_token_aqui
```

**4. Inicie o bot**

```bash
npm run bot:listen
```

O bot estará escutando comandos no Telegram e um health check ficará disponível em `http://localhost:3000`.

---

## 📂 Arquitetura

```
src/
├── api.js        # Cliente da API Ingresso.com (multi-cinema)
├── normalize.js  # Normalização de filmes, sessões e preços
├── cache.js      # Cache em JSON com expiração diária por cinema
├── bot.js        # Bot Telegram (polling + Express + inline keyboards)
└── index.js      # CLI para consulta rápida via terminal
```

| Módulo | Responsabilidade |
| --- | --- |
| `api.js` | Busca sessões e lançamentos por `theaterId` na API do Ingresso.com |
| `normalize.js` | Transforma dados brutos em estrutura normalizada (filmes + sessões) |
| `cache.js` | Armazena dados por cinema e data, expira na virada do dia em Maceió |
| `bot.js` | Gerencia comandos, seleção de cinema, formatação e envio de mensagens |
| `index.js` | CLI que salva a programação em `data/state.json` |

---

## 🔧 Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Sim | — | Token do bot obtido via @BotFather |
| `PORT` | Não | `3000` | Porta do servidor Express (health check) |

---

## 🐳 Docker

```bash
docker build -t maceio-cine-bot .
docker run -e TELEGRAM_BOT_TOKEN=seu_token maceio-cine-bot
```

---

## ☁️ Deploy no Render

1. Crie um **Web Service** conectado ao repositório
2. **Build Command:** `npm ci`
3. **Start Command:** `npm run bot:listen`
4. **Environment Variables:** configure `TELEGRAM_BOT_TOKEN`
5. Acesse `https://seu-app.render.com/` para verificar o status

---

## 📄 Licença

MIT
