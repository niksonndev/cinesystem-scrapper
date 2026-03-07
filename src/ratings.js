/**
 * Busca notas de filmes (IMDb e Rotten Tomatoes) via OMDb API.
 * Opcional: se OMDb_API_KEY não estiver definida, as notas não são exibidas.
 */

import axios from 'axios';

const OMDb_BASE = 'https://www.omdbapi.com/';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const memoryCache = new Map();

function cacheKey(title, year) {
  const t = (title || '').trim().toLowerCase();
  const y = year ? String(year) : '';
  return `${t}|${y}`;
}

/**
 * Extrai nota do Rotten Tomatoes do array Ratings da OMDb.
 * @param {Array} ratings - Array de { Source, Value }
 * @returns {string|null} Ex: "85%" ou null
 */
function extractRottenTomatoes(ratings) {
  if (!Array.isArray(ratings)) return null;
  const rt = ratings.find(
    (r) => r.Source && r.Source.toLowerCase().includes('rotten tomatoes'),
  );
  if (!rt || !rt.Value) return null;
  const value = String(rt.Value).trim();
  if (value === 'N/A') return null;
  return value;
}

/**
 * Busca nota de um filme na OMDb (IMDb e Rotten Tomatoes).
 *
 * @param {string} title - Título do filme
 * @param {number|string|null} [year] - Ano (opcional, melhora a precisão)
 * @returns {Promise<{ imdb: string, rottenTomatoes: string|null }|null>}
 */
export async function getMovieRatings(title, year = null) {
  const apiKey = process.env.OMDb_API_KEY;
  if (!apiKey) return null;

  const key = cacheKey(title, year);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const params = {
      apikey: apiKey,
      t: title,
      type: 'movie',
      r: 'json',
    };
    if (year) params.y = year;

    const { data } = await axios.get(OMDb_BASE, {
      params,
      timeout: 5000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; MaceioCineBot/1.0)',
      },
    });

    if (!data || data.Response === 'False') {
      memoryCache.set(key, { at: Date.now(), data: null });
      return null;
    }

    const imdb = data.imdbRating && data.imdbRating !== 'N/A'
      ? String(data.imdbRating).trim()
      : null;
    const rottenTomatoes = extractRottenTomatoes(data.Ratings || []);

    const result =
      imdb || rottenTomatoes
        ? { imdb: imdb || null, rottenTomatoes: rottenTomatoes || null }
        : null;

    memoryCache.set(key, { at: Date.now(), data: result });
    return result;
  } catch (err) {
    console.warn(`⚠️ OMDb: erro ao buscar "${title}":`, err.message);
    return null;
  }
}

/**
 * Formata linha de notas para exibição no Telegram.
 * @param {{ imdb: string|null, rottenTomatoes: string|null }|null} ratings
 * @returns {string} Ex: "⭐ IMDB 7.5 | 🍅 RT 85%" ou ""
 */
export function formatRatingsLine(ratings) {
  if (!ratings) return '';
  const parts = [];
  if (ratings.imdb) parts.push(`⭐ IMDB ${ratings.imdb}`);
  if (ratings.rottenTomatoes) parts.push(`🍅 RT ${ratings.rottenTomatoes}`);
  if (parts.length === 0) return '';
  return parts.join(' | ') + '\n';
}

export default { getMovieRatings, formatRatingsLine };
