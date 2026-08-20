# Deploy

> Guia completo para deploy e operação do bot. O método primário é **AWS SAM**
> (Lambda + API Gateway + EventBridge). O deploy no Render está disponível
> como referência histórica (legado).

## 🚀 Deploy via AWS SAM (primário)

### Visão geral

| Item | Detalhe |
|---|---|
| IaC | AWS SAM (`template.yaml`) |
| Runtime | AWS Lambda (Node.js 20.x) |
| HTTP | Amazon API Gateway — HTTP API (`/webhook`) |
| Agendamento | Amazon EventBridge (cron diário) |
| Cache | Amazon S3 (`cache.json`) |
| Scripts npm | `npm run sam:build`, `npm run sam:deploy` |

### Pré-requisitos

- AWS CLI configurado (`aws configure`)
- [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam_cli.html) instalado

### 1. Build

```bash
sam build          # ou: npm run sam:build
```

### 2. Deploy (primeira vez — modo guiado)

```bash
sam deploy --guided   # ou: npm run sam:deploy (sem o --guided)
```

Responda às perguntas:

| Prompt | Sugerido |
|---|---|
| `Stack name` | `maceio-cine-bot` |
| `AWS Region` | sua região preferida (ex.: `us-east-1`) |
| `TelegramBotToken` | token do bot (via @BotFather) |
| `OMDbApiKey` | opcional |
| `TMDbApiKey` | opcional |
| `WebhookUrl` | **deixe vazio** na primeira vez (definimos manualmente abaixo) |

### 3. Registrar o webhook no Telegram

Copie a URL de saída (`WebhookUrl`) do stack e registre no Telegram:

```bash
WEBHOOK=$(aws cloudformation describe-stacks \
  --stack-name maceio-cine-bot \
  --query "Stacks[0].Outputs[?OutputKey=='WebhookUrl'].OutputValue" \
  --output text)

curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -F "url=${WEBHOOK}"
```

> 💡 **Dica:** para registrar automaticamente em cada deploy, basta passar
> o `WebhookUrl` no `sam deploy --guided`. O Lambda `BotFunction` chama
> `bot.setWebHook()` no cold start quando a variável `WEBHOOK_URL` está definida.

### 4. Deploys subsequentes

```bash
sam build && sam deploy    # ou: npm run sam:build && npm run sam:deploy
```

### 5. Desenvolvimento local

```bash
# Build local
sam build

# Invocar handler de webhook com evento de teste
sam local invoke "BotFunction" -e events/webhook-event.json

# Invocar cache warming localmente
sam local invoke "WarmFunction"

# Simular API Gateway localmente (HTTP API)
sam local start-api
```

### Configuração (samconfig.toml)

```toml
version = 0.1
[default.deploy.parameters]
stack_name = "maceio-cine-bot"
capabilities = "CAPABILITY_IAM"
resolve_s3 = true
confirm_changeset = false
```

---

## ☁️ Deploy no Render (legado)

> Esta seção está arquivada. O deploy primário agora é via **AWS SAM** (acima).
> Mantida apenas como referência histórica.

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
