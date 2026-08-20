# Deploy — Render

> Guia completo para deploy e operação do bot no Render.

## Visão geral

| Item              | Detalhe                                                          |
| ----------------- | ---------------------------------------------------------------- |
| Plataforma        | [Render](https://render.com)                                     |
| Tipo de serviço   | Web Service (com health check HTTP)                              |
| Start Command     | `npm run bot:listen` (`node src/bot.js`)                         |
| Build Command     | `npm ci`                                                         |
| Runtime           | Node.js (imagem `node:20-slim`, via Dockerfile)                  |

## 🟢 Status da produção

| Item             | Detalhe                                                        |
| ---------------- | -------------------------------------------------------------- |
| URL do serviço   | https://cinesystem-scrapper.onrender.com                       |
| Health check     | `GET https://cinesystem-scrapper.onrender.com/`                |
| Porta            | Dinâmica via `process.env.PORT` (fallback `10000`)             |

### Resposta do health check

```json
{
  "status": "✅ Bot está online!",
  "timestamp": "2026-08-19T10:30:00.000Z",
  "memory": { "heapUsed": "45.23", "heapTotal": "67.89", "rss": "89.12" }
}
```

## Como configurar

### 1. Crie um Web Service

Conecte ao repositório GitHub e configure:

- **Build Command:** `npm ci`
- **Start Command:** `npm run bot:listen`

### 2. Variáveis de ambiente

| Variável             | Obrigatória | Descrição                              |
| -------------------- | ----------- | -------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | ✅ Sim      | Token do bot obtido via [@BotFather](https://t.me/BotFather) |
| `OMDb_API_KEY`       | Não         | Notas IMDb/RT                            |
| `TMDB_API_KEY`       | Não         | Fallback TMDb                            |
| `PORT`               | Não         | Injetado automaticamente pelo Render   |
| `RENDER_EXTERNAL_URL`| Não         | Injetado pelo Render (usado para auto-ping) |

> ⚠️ O Render injeta `PORT` e `RENDER_EXTERNAL_URL` automaticamente — **não** defina `PORT`
> manualmente nas variáveis do serviço.

### 3. Health check

O Render usa a URL raiz (`https://cinesystem-scrapper.onrender.com/`) para verificar
se o container está saudável. O servidor Express escuta em `0.0.0.0` na porta `PORT`.

## Auto-ping (keep-alive)

Para evitar que o serviço grátis do Render "desligue" por inatividade,
o bot faz um self-ping a cada **10 minutos**:

```js
// src/bot.js
const selfUrl = process.env.RENDER_EXTERNAL_URL;
if (selfUrl) {
  setInterval(async () => {
    const res = await fetch(selfUrl);
    console.log(`🔄 Auto-ping ${selfUrl} → ${res.status}`);
  }, 10 * 60 * 1000);
}
```

## Graceful shutdown (SIGTERM/SIGINT)

O bot escuta sinais de desligamento para encerrar limpo:

```js
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

- Para o polling do Telegram (`bot.stopPolling()`)
- Fecha o servidor Express (`server.close()`)
- Exit code `0`

## Verificação via curl (sem conta Telegram)

```bash
# Identidade do bot
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"

# Comandos registrados (devem ser 4)
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands"

# Polling mode (webhook URL deve estar vazia)
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"

# Health check
curl -s https://cinesystem-scrapper.onrender.com/
```

## Docker

```bash
docker build -t maceio-cine-bot .
docker run -e TELEGRAM_BOT_TOKEN=seu_token maceio-cine-bot
```

O `Dockerfile` usa `node:20-slim` e roda `npm run bot:listen` por padrão.

## Monitoramento de logs

- Health check e graceful shutdown logam para `stdout` (visíveis no painel do Render).
- Erros de polling são tratados com retry exponencial (até 5 tentativas) —
  útil para detectar conflito de instância (`409 Conflict`).
