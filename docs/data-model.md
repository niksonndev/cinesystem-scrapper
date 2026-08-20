# Modelo de Dados

> Referência completa das estruturas de dados usadas internamente e persistidas.

## 1. Cache persistente — `data/cache.json`

Gerenciado pela classe `NormalizedCache` (`src/cache.js`). É o **único estado persistido em disco**.

```jsonc
{
  "movies": {
    "12345": {
      "id": 12345,
      "title": "Avatar: Fogo E Cinzas",
      "originalTitle": "Avatar: The Way of Water",
      "urlKey": "avatar-fogo-e-cinzas",
      "duration": 192,            // minutos
      "contentRating": "14",     // classificação etária (ex.: "14", "16", "L")
      "ratingColor": null,
      "genres": ["Ação", "Aventura"],
      "distributor": "20th Century Studios",
      "poster": "https://...",    // PosterPortrait
      "backdrop": "https://...",  // PosterHorizontal
      "trailer": "https://...",
      "tags": ["3D"],
      "isReexhibition": false,
      "inPreSale": false          // em pré-venda
    }
  },

  "sessions": {
    "1162": {                     // theaterId (Cinesystem)
      "2026-08-19": {
        "fetchedAt": "2026-08-19T10:30:00.000Z",
        "items": [
          {
            "id": "sess_001",
            "movieId": 12345,
            "time": "14:30",
            "price": 55.86,       // preço bruto (inteira)
            "room": "Sala 5",
            "format": "2D",       // 2D | 3D | Cinépic | VIP
            "audio": "Dublado",   // Dublado | Legendado | null
            "checkoutUrl": "https://ingresso.com/..."
          }
        ]
      }
    },
    "1230": { },                    // Centerplex
    "924":  { }                     // Kinoplex
  },

  "upcoming": {
    "1162": {
      "fetchedAt": "2026-08-19T10:31:00.000Z",
      "items": [
        {
          "id": 67890,
          "title": "Vingadores: Ultimato 2",
          "originalTitle": null,
          "contentRating": "14",
          "genres": ["Ação"],
          "poster": "https://...",
          "inPreSale": true,
          "formats": ["2D", "3D"],
          "priceFrom": 45.00,
          "firstDate": "2026-08-25",            // YYYY-MM-DD
          "firstDateFormatted": "25 de agosto de 2026",
          "firstDateDayOfWeek": "segunda-feira",
          "siteURL": "https://ingresso.com/..."
        }
      ]
    }
  },

  "moviesUpdatedAt": "2026-08-19T10:30:00.000Z"  // última atualização de filmes estáticos
}
```

### Campos por tipo

#### `MovieStatic` (dados estáticos — raramente mudam)

Extraído por `extractMovieStatic()` em `src/normalize.js`. São idênticos independentemente de data/cinema.

#### `Session` (dados dinâmicos — mudam por dia/horário)

Extraído por `extractSessions()` em `src/normalize.js`. Cada sessão tem apenas os dados relevantes à data/teatro consultado.

#### `UpcomingItem` (lançamentos futuros)

Extraído por `normalizeUpcomingFromSessions()`. Identifica filmes que **ainda não estão em cartaz hoje** e que têm pré-venda ativa.

---

## 2. Estrutura de exibição (denormalizada)

Produzida pela função `denormalize(movies, sessions)` em `src/normalize.js`. É o formato consumido pela camada de formatação (`format.js`).

```js
{
  id: 12345,
  title: "Avatar: Fogo E Cinzas",
  originalTitle: "Avatar: The Way of Water",
  // ... demais campos de MovieStatic ...
  duration: 192,
  genres: ["Ação", "Aventura"],
  poster: "https://...",
  backdrop: "https://...",
  // campos adicionados por denormalize():
  name: "Avatar: Fogo E Cinzas",     // alias de title
  sessions: [
    {
      time: "14:30",
      sessionId: "sess_001",
      priceInteira: 55.86,
      priceMeia: 27.93,            // priceInteira / 2 (toFixed 2)
      gratuito: false,             // true quando price é null/0
      room: "Sala 5",
      format: "2D",
      audio: "Dublado"
    }
  ]
}
```

> 📌 `denormalize()` agrupa sessões por `movieId` e junta com os dados estáticos do filme, produzindo um array pronto para renderização no bot.

---

## 3. Ratings (in-memory)

Estrutura temporária mantida em `src/ratings.js`:

```js
// memoryCache: Map<string, { at: number, data: RatingsResult | null }>
// cacheKey = `${title.toLowerCase()}|${year ?? ''}`
// TTL: 24h (CACHE_TTL_MS)

RatingsResult = {
  imdb: "7.5" | null,        // da OMDb
  rottenTomatoes: "85%" | null, // da OMDb
  tmdb: "7.3" | null        // fallback da TMDb
}
```

⚠️ **Não persistido em disco** — perdido em reinício do processo.

---

## 4. Preferências de usuários (in-memory)

Estrutura temporária em `src/cinemas.js`:

```js
// Map<chatId, theaterId>
// Ex.: { 123456789: "1162", 987654321: "924" }
```

⚠️ **Não persistido** — o usuário precisa reselecionar o cinema após reinício do bot.

---

## 5. Variáveis de ambiente

| Variável            | Obrigatória | Padrão    | Descrição                                    |
| ------------------- | ----------- | --------- | -------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | Sim        | —         | Token do bot (via @BotFather).              |
| `PORT`              | Não         | `10000`   | Porta do Express (health check).             |
| `OMDb_API_KEY`      | Não         | —         | Busca IMDb/RT.                               |
| `TMDB_API_KEY`      | Não         | —         | Fallback TMDb quando OMDb falha.            |
| `RENDER_EXTERNAL_URL` | Não       | —         | URL do serviço no Render (para auto-ping).  |
