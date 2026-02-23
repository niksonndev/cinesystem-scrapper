[🤖 Acessar Cinesystem Bot no Telegram](https://t.me/Cinesystemfilmes_bot)

# Cinesystem Maceió - Scraper de Programação

Scraper de programação do [Cinesystem Maceió no Ingresso.com](https://www.ingresso.com/cinema/cinesystem-maceio?city=maceio).

Extrai filmes, horários e preços (inteira + meia) usando **arquitetura híbrida**:

- 🚀 **API** para filmes + horários (rápido: 0.1s)
- 🎯 **Playwright** para preços dinâmicos (quando solicitado: 68s)

## Características

✅ **Filmes + Sessões via API** - Rápido e confiável
✅ **Preços (inteira/meia)** - Extraídos dinamicamente
✅ **Suporte a datas** - Consulte programação específica
✅ **JSON estruturado** - Fácil de processar
✅ **Sem autenticação** - API pública

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

### Comando Básico

```bash
node src/index.js scrape [precio] [data]
```

### Exemplos

#### 1. **Filmes + Horários (sem preços)** - Rápido

```bash
node src/index.js scrape
# Output: 15 filmes em ~0.1 segundos
```

#### 2. **Filmes + Horários + Preços** - Completo

```bash
node src/index.js scrape prices
# Output: 15 filmes + 32 sessões com preços em ~68 segundos
```

#### 3. **Data Específica** (sem preços)

```bash
node src/index.js scrape 23/02/2026
# Output: programação para 23 de fevereiro
```

#### 4. **Data + Preços**

```bash
node src/index.js scrape prices 23/02/2026
# Nota: Preços só estão disponíveis para hoje (Ingresso.com)
```

## Saída

Os dados são salvos em `data/state.json`:

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

## Arquitetura

### `src/api.js` - Cliente da API Ingresso

- Acessa `https://api-content.ingresso.com`
- Descomprime respostas (gzip/deflate/brotli)
- Deduplica filmes por nome
- Filtra por data ou retorna apenas hoje

### `src/scraper.js` - Orquestração

- Obtém filmes + sessões via API
- Se `extractPrices=true`, abre Playwright para extrair preços do modal
- Retorna dados estruturados

### `src/index.js` - CLI

- Interface de linha de comando
- Salva resultado em JSON
- Exibe programação formatada

## Performance

| Operação                | Tempo  | Nota                             |
| ----------------------- | ------ | -------------------------------- |
| Filmes + Sessões (API)  | ~0.1s  | Muito rápido                     |
| Com Preços (Playwright) | ~68s   | Necessário para preços dinâmicos |
| Mudança de data         | +5-10s | Dependendo de filmes disponíveis |

## Limitações

- ⚠️ **Preços para datas futuras**: O site não exibe botões de preço para datas além de hoje
- ⚠️ **Sessões ausentes**: Se o site mostrar "Sem sessões", retorna lista vazia

## Desenvolvimento

O código está organizado de forma limpa com funções bem definidas:

- **API requests** com suporte a compressão
- **Deduplicação** automática de filmes
- **Extração dinâmica** de preços via DOM evaluation
- **Tratamento de erros** robusto

## Bot Telegram

Um bot interativo que fornece acesso à programação de filmes via Telegram.

### Usar Localmente

```bash
npm run bot:listen
```

O bot iniciará com:

- ✅ Health check na porta 3000 (ou PORT env)
- 🤖 Polling contínuo para receber comandos
- 🎬 Botões para filmes de hoje e amanhã
- 💰 Extração automática de preços

### Comandos Disponíveis

- `/start` - Menu principal com botões
- 🎬 Filmes de Hoje - Lista filmes de hoje com preços
- 📅 Filmes de Amanhã - Lista filmes de amanhã com preços
- ❓ Como Funciona - Informações do bot

## Deploy no Render

### Pré-requisitos

1. Conta no [Render.com](https://render.com)
2. Token do Bot Telegram (de @BotFather)

### Passos

1. **Conectar repositório Git ao Render**
   - Novo "Web Service"
   - Selecionar seu repositório GitHub

2. **Configurar Build Command**

   ```
   npm run install-browsers
   ```

3. **Configurar Start Command**

   ```
   npm run bot:listen
   ```

4. **Adicionar Environment Variables**

   ```
   TELEGRAM_BOT_TOKEN=sua_token_aqui
   ```

5. **Deploy**
   - Render detecará automaticamente PORT (default 3000)
   - Bot iniciará e ficará online 24/7

### Verificar Status

- GET `https://seu-app.render.com/` deve retornar JSON com status
- Teste o bot no Telegram enviando `/start`

## Autor

Scraper construído com Playwright + Node.js nativo (sem dependências desnecessárias).
