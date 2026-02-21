# Cinesystem Maceió - Scraper de programação

Programa em Node.js + Playwright que acessa a [programação do Cinesystem Maceió no Ingresso.com](https://www.ingresso.com/cinema/cinesystem-maceio?city=maceio), extrai filmes e horários, detecta mudanças (filme novo, sessão removida) e permite automação futura.

## Requisitos

- Node.js 18+
- npm ou yarn

## Instalação

```bash
cd cinesystem-scraper
npm install
npx playwright install chromium
```

## Uso

| Comando | Descrição |
|--------|-----------|
| `npm start` ou `node src/index.js` | Extrai programação, salva estado, compara com o anterior e exibe mudanças |
| `npm run scrape` | Apenas extrai e salva em `data/state.json` (não altera o "previous") |
| `npm run check` | Compara o estado atual com o anterior (sem fazer novo scrape) |
| `npm run telegram` | Envia a programação do dia para o seu Telegram (usa o estado já salvo) |
| `npm run telegram:refresh` | Atualiza a programação (scrape), salva e envia para o Telegram |

### Exemplos

```bash
# Primeira execução: só salva o estado
node src/index.js scrape

# Próximas execuções: scrape + diff (detecta mudanças)
node src/index.js

# Enviar programação do dia para o Telegram (estado já salvo)
npm run telegram

# Atualizar programação e enviar para o Telegram
npm run telegram:refresh
```

## Telegram

Para receber a programação do dia no Telegram, configure o **token do bot** e o **chat ID**. Você pode usar um arquivo `.env` (recomendado) ou variáveis de ambiente no terminal.

### Opção 1: arquivo `.env` (recomendado)

1. Copie o exemplo e edite com seus dados:
   ```bash
   cp .env.example .env
   ```
2. No `.env`, preencha:
   - **TELEGRAM_BOT_TOKEN** — Crie um bot com [@BotFather](https://t.me/BotFather) (`/newbot`) e cole o token.
   - **TELEGRAM_CHAT_ID** — ID do chat para onde o bot vai enviar (veja abaixo como obter).

O arquivo `.env` já está no `.gitignore`; não será commitado.

### Opção 2: export no terminal

```bash
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
export TELEGRAM_CHAT_ID="987654321"
npm run telegram
```

Ou em uma linha: `TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..." npm run telegram`

### Como obter o Chat ID

- Envie uma mensagem qualquer para o seu bot (ou adicione o bot a um grupo e envie uma mensagem no grupo).
- Acesse no navegador: `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates`.
- Na resposta JSON, procure `"chat":{"id": 123456789}` — esse número é o `TELEGRAM_CHAT_ID`.

A mensagem enviada lista todos os filmes e horários do dia em formato legível (HTML no Telegram).

## Detecção de mudanças

- **Filmes novos**: filmes que aparecem na programação e não estavam no estado anterior.
- **Filmes removidos**: filmes que sumiram da programação.
- **Sessões adicionadas/removidas**: horários novos ou removidos por filme.

O estado é salvo em:

- `data/state.json` — programação atual
- `data/previous.json` — programação da última execução (usada para o diff)

## Automação

Você pode rodar o scraper em um cron (Linux/macOS): por exemplo, a cada 6 horas. Quando houver mudanças, o script sai com código 1, aí você pode encadear com um script que envia notificação (Telegram, e-mail, etc.).

## Observação

Se o site exibir "Ainda não temos sessões", o scraper retorna lista vazia e trata como estado válido. Quando o cinema voltar a exibir sessões, a próxima execução detectará as mudanças.
