# Cache — Estratégia e Regras de Expiração

> O cache evita requisições desnecessárias à API do Ingresso.com, reduzindo
> latência e dependência externa.

## Armazenamento

| Tipo              | Onde               | Persistido? | Expira?                                   |
| ----------------- | ------------------ | ----------- | ----------------------------------------- |
| Filmes estáticos  | S3 (prod) / JSON   | ✅ Sim      | Nunca expira (atualizado sob demanda)     |
| Sessões           | S3 (prod) / JSON   | ✅ Sim      | Expira à meia-noite (fuso `America/Maceio`) |
| Lançamentos       | S3 (prod) / JSON   | ✅ Sim      | Expira à meia-noite (fuso `America/Maceio`) |
| Ratings           | Map em memória     | ❌ Não      | 24h (`CACHE_TTL_MS`)                      |
| Preferências      | Map em memória     | ❌ Não      | Perdido em reinício                       |

> Em produção (AWS Lambda), `S3_BUCKET` e `CACHE_KEY` são injetadas via
> `template.yaml`. Localmente (modo dev), o cache recai para `data/cache.json`.

## Arquivo: `cache.json` (S3 em prod / `data/cache.json` em dev)

```
data/cache.json
├── movies        → { movieId: MovieStatic }    (estático)
├── sessions      → { theaterId: { date: { fetchedAt, items } } }  (dinâmico)
├── upcoming      → { theaterId: { fetchedAt, items } }            (dinâmico)
└── moviesUpdatedAt → ISO string
```

## Regras de expiração

### Sessões e lançamentos — expiração diária

Implementada em `src/cache.js`:

- `getSessions(date, theaterId)` → compara `fetchedAt` com o dia atual em `America/Maceio`. Se o dia for diferente, **deleta a entrada** e retorna `null` (cache miss → força nova requisição).
- `getUpcoming(theaterId)` → mesma lógica.
- `purgeOldSessions()` → remove todas as sessões com `date < today` (chamado após `setSessions`).

```js
// cache.js — trecho simplificado
const cachedDay = this.toMaceioDateStr(cached.fetchedAt); // converte para YYYY-MM-DD em Maceió
const today = this.getMaceioDate(0);                      // hoje em Maceió
if (cachedDay !== today) {
  delete theaterSessions[date];
  return null; // expirado
}
return cached;  // válido
```

### Filmes estáticos — atualização sob demanda

- `mergeMovies(movies)` **nunca sobrescreve** um filme já existente.
- Só adiciona `movieId`s **novos** e atualiza `moviesUpdatedAt`.
- Isso elimina writes desnecessários — os dados estáticos mudam raramente.

## Lógica de cache hit/miss

Implementada em `src/data.js`:

```js
// getMoviesForDate()
const cached = cache.getSessions(targetDate, theaterId);
if (cached) {
  // ✅ CACHE HIT — sem requisição à API
  return { movies: denormalize(...), fromCache: true };
}
// ❌ CACHE MISS — fetch + normalize + save
const normalized = await fetchNormalized(date, theaterId);
cache.mergeMovies(normalized.movies);
cache.setSessions(normalized.date, normalized.sessions, normalized.fetchedAt, theaterId);
```

## Estratégia de 3 cinemas

O cache é **indexado por `theaderId`**, permitindo que os 3 cinemas (Cinesystem `1162`,
Centerplex `1230`, Kinoplex `924`) mantenham sessões/lançamentos independentes, cada um
com sua própria expiração diária.

## Cache de ratings (in-memory)

```js
// src/ratings.js
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const memoryCache = new Map();             // key: "title|year" → { at, data }
```

- Busca IMDb/RT via OMDb; se falhar, fallback TMDb.
- Resultado cacheado por 24h para evitar chamadas repetidas.
- Perdido em reinício do processo (não afeta funcionalidade — apenas re-faz a busca).

## Diretório `data/`

- Criado automaticamente (`fs.mkdirSync('data', { recursive: true })`) no primeiro `save()`.
- Contém **apenas** `cache.json` (o antigo `state.json` foi removido — era código morto).
