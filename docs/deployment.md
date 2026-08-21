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

# Invocar fetch + S3 cache update localmente
sam local invoke "FetchFunction"

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

## Visão geral (legado)

| Item              | Detalhe                                                          |
| ----------------- | ---------------------------------------------------------------- |
| Plataforma        | [Render](https://render.com)                                     |
| Tipo de serviço   | Web Service (com health check HTTP)                              |
| Start Command     | `npm run bot:listen` (`node src/bot.js`)                         |
| Build Command     | `npm ci`                                                         |
| Runtime           | Node.js (imagem `node:20-slim`)                                  |
| Cache             | `data/cache.json` (local ao container — perdido em reinício)     |

> ⚠️ Em produção, o deploy primário agora é **AWS SAM** (acima). O cache
> local `data/cache.json` não é persistente em containers epêmeros.

## Graceful shutdown (SIGTERM/SIGINT)

O bot escuta sinais de desligamento para encerrar limpo (modo polling local):

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

# Webhook info (para Lambda: deve ter a URL do API Gateway; para polling: vazia)
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"

# Health check (modo local)
curl -s http://localhost:10000/
```

## Monitoramento de logs

- Health check e graceful shutdown logam para `stdout`.
- Erros de polling (modo local) são tratados com retry exponencial (até 5 tentativas) —
  útil para debug de instâncias concorrentes.
