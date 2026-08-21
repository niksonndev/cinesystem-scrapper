# Arquitetura

> Documentação técnica da arquitetura do **Maceió Cine Bot**.

## Visão geral

Aplicação Node.js (ES Modules) que consulta a API pública do Ingresso.com e
expõe a programação de cinemas de Maceió via bot do Telegram. Sem banco de dados —
usa **cache persistido no S3** (produção, via Lambda) ou **arquivo JSON local**
(`data/cache.json` em desenvolvimento) e **Mapas em memória**.

```
┌──────────────┐        HTTP (headers browser-like)      ┌──────────────────┐
│  API do      │ GET /v0/sessions/city/{city}/...        │ src/api.js       │
│  Ingresso.com │ ————————————————————————————————→      │  fetchNormalized │
│  (pública,   │ GET /v0/sessions/city/{city}/...        │  fetchUpcoming   │
│   sem token)  │ —————                                  │                  │
└──────────────┘                                         └────────┬─────────┘
                                                                  │
        ┌──────────────────────────────────────────────────────┼──────────────────┐
        │                                                      │                  │
   ┌────▼─────┐                                          ┌─────▼─────┐      ┌─────▼─────┐
   │ src/     │                                     ┌──►│ src/      │      │ src/      │
   │ index.js │  (CLI — verificação)                │   │ normalize │      │ bot.js    │
   │  • fetch │────────────────────────────┐        │   │  .js      │◄──── │  (entry)  │
   │  • print │                              │        │   │           │      │  Express  │
   └──────────┘                              │        │   └─────┬─────┘      │  polling  │
                                             │        │         │          │  health   │
                                             │   ┌────▼────┐  │  denormalize│          │  check    │
                                             │   │ cache.  │  │             │          └─────┬─────┘
                                             │   │ json    │◄─┘ mergeMovies │                  │
                                             │   └─────────┘                │                  │
                                             │   setSessions                │                  │
                                             │   setUpcoming                │                  │
                                             │                              │                  │
                                        ┌────▼──────────────────────────────▼────▼──────┐     │
                                        │ Memory cache (ratings, ratings.js)          │     │
                                        └─────────────────────────────────────────────┘     │
                                                                                              │
                                                            ┌─────────────────────────────┐  │
                                                            │ Telegram API                │  │
                                                            │  /start /hoje /proximos     │  │
                                                            │  inline keyboards, carrossel│  │
                                                            └─────────────────────────────┘  │
                                                                                             │
                              └────────────────────────────────────────────────────────────┘
```

## Módulos (`src/`)

| Módulo          | Responsabilidade                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `api.js`        | Cliente HTTP (Axios) para a API pública do Ingresso.com. Busca sessões e lançamentos por `theaterId`. |
| `normalize.js`  | Separa dados **estáticos** de filmes dos **dinâmicos** de sessões. Contém `denormalize()`.      |
| `cache.js`      | Persistência em JSON (`data/cache.json`) ou S3 (`@aws-sdk/client-s3`): filmes, sessões, lançamentos. |
| `data.js`       | Orquestra `cache ↔ api ↔ normalize` com lógica de cache hit antes de chamar a API.               |
| `cinemas.js`    | Definição dos 3 cinemas suportados e preferências por usuário (Map em memória).                  |
| `format.js`     | Formatação de mensagens Markdown para Telegram (cards, preços, datas).                          |
| `ratings.js`    | Busca notas (IMDb/RT via OMDb, fallback TMDb) com cache em memória (TTL 24h).                   |
| `keyboards.js`  | Builders de teclados inline do Telegram.                                                        |
| `handlers.js`   | Handlers de comandos (`/start`, `/hoje`, `/proximos`, `/cinemas`, `/atualizar`) e callbacks.   |
| `bot.js`        | Entry point local (polling + Express health). Produção usa `lambda.js`.                        |
| `lambda.js`     | Entry point AWS Lambda (webhook + `fetchHandler` cron).                                          |
| `index.js`      | CLI para verificação manual (fetch + console). Sem token.                                       |

## Fluxo de dados

### 1. Filmes de hoje (`/hoje`, `filmes_hoje`)

```
handlers.js
  └─ getMoviesForDate(cache, date, theaterId)        ← src/data.js
       ├─ cache.getSessions(date, theaterId) → HIT? devolve do cache.json
       └─ MISS → api.fetchNormalized(date, theaterId)
                    └─ normalize.normalizeSessionsResponse(raw)
                         ├─ mergeMovies() → cache.movies (estático)
                         ├─ setSessions()  → cache.sessions (dinâmico)
                         └─ denormalize(movies, sessions) → array de filmes + sessões
                        └─ format.formatSingleMovieCard() → mensagem Telegram
```

### 2. Próximos lançamentos (`/proximos`, `proximos_lancamentos`)

```
handlers.js
  └─ getUpcomingMovies(cache, theaterId)             ← src/data.js
       ├─ cache.getUpcoming(theaterId) → HIT? devolve do cache.json
       └─ MISS → api.fetchUpcoming(theaterId)
                    └─ normalize.normalizeUpcomingFromSessions(futureDates, todayIds)
                         └─ setUpcoming() → cache.upcoming
                        └─ format.formatSingleUpcomingCard() → mensagem Telegram
```

## Teatros suportados

| `theaterId` | Cinema     | Shopping                    |
| ----------- | ---------- | --------------------------- |
| `1162`      | Cinesystem | Parque Shopping Maceió      |
| `1230`      | Centerplex | Shopping Pátio Maceió       |
| `924`       | Kinoplex   | Maceió Shopping             |

ID da cidade na API: `53` (Maceió).

## Entry points (`package.json`)

| Script              | Comando              | Propósito                                           |
| ------------------- | -------------------- | --------------------------------------------------- |
| `npm start`         | `node src/index.js`  | CLI — valida a pipeline (fetch + console). Sem token. |
| `npm run bot:listen`| `node src/bot.js`    | Desenvolvimento local: bot (polling) + Express health. Exige token. |
| `npm run sam:build` | `sam build`          | Build da aplicação AWS SAM (Lambda).                 |
| `npm run sam:deploy`| `sam deploy`         | Deploy para AWS (produção).                          |
