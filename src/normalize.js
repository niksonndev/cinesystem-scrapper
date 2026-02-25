/**
 * Normalização de dados da API do Ingresso.com
 *
 * Separa dados estáticos de filmes (que mudam raramente) dos dados
 * dinâmicos de sessões (que mudam por dia/horário), eliminando a
 * redundância massiva do endpoint de sessões.
 *
 * Payload original: ~112KB (15 filmes, 32 sessões)
 * Payload normalizado: ~8KB (mesmos dados úteis para UI)
 *
 * Também normaliza próximos lançamentos a partir do endpoint de sessões,
 * identificando filmes que ainda não estão em cartaz hoje.
 */

/**
 * Extrai dados estáticos de um filme da resposta da API.
 * Esses dados são idênticos independente da data ou cinema consultado.
 *
 * @param {object} raw - Objeto de filme cru da API
 * @returns {object} Dados estáticos normalizados
 */
export function extractMovieStatic(raw) {
  const poster = raw.images?.find((i) => i.type === 'PosterPortrait')?.url ?? null;
  const backdrop = raw.images?.find((i) => i.type === 'PosterHorizontal')?.url ?? null;
  const trailer = raw.trailers?.[0]?.url ?? null;

  return {
    id: raw.id,
    title: raw.title,
    originalTitle: raw.originalTitle || null,
    urlKey: raw.urlKey,
    duration: Number(raw.duration) || null,
    contentRating: raw.contentRating || null,
    ratingColor: raw.ratingDetails?.color ?? null,
    genres: raw.genres ?? [],
    distributor: raw.distributor || null,
    poster,
    backdrop,
    trailer,
    tags: (raw.completeTags || raw.tags || []).map((t) =>
      typeof t === 'string' ? t : t.name,
    ),
    isReexhibition: raw.isReexhibition ?? false,
    inPreSale: raw.inPreSale ?? false,
  };
}

/**
 * Extrai sessões dinâmicas de um filme.
 * Cada sessão contém apenas os dados que mudam por dia/cinema.
 *
 * @param {string} movieId - ID do filme pai
 * @param {Array} sessionTypes - Array de sessionTypes da API
 * @returns {Array} Sessões normalizadas
 */
export function extractSessions(movieId, sessionTypes) {
  const sessions = [];

  for (const group of sessionTypes || []) {
    for (const s of group.sessions || []) {
      const format = s.types?.find((t) => t.name !== 'Dublado' && t.name !== 'Legendado')?.alias ?? '2D';
      const audio = s.types?.find((t) => t.name === 'Dublado' || t.name === 'Legendado')?.alias ?? null;

      sessions.push({
        id: s.id,
        movieId,
        time: s.time,
        price: s.price ?? null,
        room: s.room || null,
        format,
        audio,
        checkoutUrl: s.siteURL || null,
      });
    }
  }

  return sessions;
}

/**
 * Normaliza a resposta completa do endpoint de sessões agrupadas por sessionType.
 *
 * Entrada: resposta de /v0/sessions/city/{city}/theater/{theater}/partnership/home/groupBy/sessionType?date={date}
 * Saída: { movies: Map<id, MovieStatic>, sessions: Session[], date, fetchedAt }
 *
 * @param {object|Array} apiResponse - Resposta crua da API
 * @returns {{ movies: Record<string, object>, sessions: Array, date: string, fetchedAt: string }}
 */
export function normalizeSessionsResponse(apiResponse) {
  const data = Array.isArray(apiResponse) ? apiResponse[0] : apiResponse;

  if (!data?.movies) {
    return { movies: {}, sessions: [], date: null, fetchedAt: new Date().toISOString() };
  }

  const movies = {};
  const sessions = [];

  for (const rawMovie of data.movies) {
    if (!movies[rawMovie.id]) {
      movies[rawMovie.id] = extractMovieStatic(rawMovie);
    }

    const movieSessions = extractSessions(rawMovie.id, rawMovie.sessionTypes);
    sessions.push(...movieSessions);
  }

  return {
    movies,
    sessions,
    date: data.date || null,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Normaliza próximos lançamentos a partir das sessões futuras do cinema.
 * Percorre todas as datas futuras, identifica filmes que não estão em
 * cartaz hoje (novidades), e extrai apenas os campos úteis para a UI.
 *
 * @param {Array} futureDates - Array de objetos { date, movies, ... } de datas futuras
 * @param {Set<string>} todayMovieIds - IDs dos filmes em cartaz hoje
 * @returns {Array} Filmes novos, ordenados pela primeira data de exibição
 */
export function normalizeUpcomingFromSessions(futureDates, todayMovieIds) {
  const seen = new Map();

  for (const dateEntry of futureDates) {
    const movies = dateEntry.movies || [];

    for (const raw of movies) {
      if (todayMovieIds.has(raw.id) || seen.has(raw.id)) continue;

      const poster = raw.images?.find((i) => i.type === 'PosterPortrait')?.url ?? null;

      const formats = new Set();
      let minPrice = null;

      const sessionGroups = raw.sessionTypes || raw.rooms || [];
      for (const group of sessionGroups) {
        for (const s of group.sessions || []) {
          for (const t of s.types || []) {
            if (t.name !== 'Dublado' && t.name !== 'Legendado') {
              formats.add(t.alias);
            }
          }
          if (s.price && (minPrice === null || s.price < minPrice)) {
            minPrice = s.price;
          }
        }
      }

      seen.set(raw.id, {
        id: raw.id,
        title: raw.title,
        contentRating: raw.contentRating || null,
        genres: raw.genres ?? [],
        poster,
        inPreSale: raw.inPreSale ?? false,
        formats: [...formats],
        priceFrom: minPrice,
        firstDate: dateEntry.date,
        firstDateFormatted: dateEntry.dateFormatted,
        firstDateDayOfWeek: dateEntry.dayOfWeek,
        siteURL: raw.siteURLByTheater || raw.siteURL || null,
      });
    }
  }

  return [...seen.values()];
}

/**
 * Reconstrói a visão desnormalizada para consumidores que esperam
 * o formato { movies: [{ name, sessions: [...] }] }.
 *
 * @param {Record<string, object>} movies - Mapa de filmes estáticos
 * @param {Array} sessions - Array de sessões dinâmicas
 * @returns {Array} Lista de filmes com sessões embutidas
 */
export function denormalize(movies, sessions) {
  const grouped = new Map();

  for (const session of sessions) {
    if (!grouped.has(session.movieId)) {
      const movie = movies[session.movieId];
      if (!movie) continue;
      grouped.set(session.movieId, {
        ...movie,
        name: movie.title,
        sessions: [],
      });
    }

    const entry = grouped.get(session.movieId);
    entry.sessions.push({
      time: session.time,
      sessionId: session.id,
      priceInteira: session.price,
      priceMeia: session.price ? +(session.price / 2).toFixed(2) : null,
      gratuito: !session.price,
      room: session.room,
      format: session.format,
      audio: session.audio,
    });
  }

  return Array.from(grouped.values());
}
