import { fetchNormalized } from './api.js';
import { denormalize } from './normalize.js';

/**
 * Busca programação do cinema e retorna no formato legado (desnormalizado).
 * @param {object} options - { date?: string (YYYY-MM-DD) }
 * @returns {Promise<{ movies, noSessions, scrapedAt }>}
 */
export async function scrape(options = {}) {
  const normalized = await fetchNormalized(options.date);
  const movies = denormalize(normalized.movies, normalized.sessions);

  return {
    movies,
    noSessions: movies.length === 0,
    scrapedAt: normalized.date,
    _normalized: normalized,
  };
}
