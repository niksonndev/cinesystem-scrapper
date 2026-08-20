/**
 * Camada de acesso a dados com cache para filmes e lançamentos.
 */

import { fetchNormalized, fetchUpcoming } from './api.js';
import { denormalize } from './normalize.js';

export function getDateString(daysOffset = 0) {
  const now = new Date();
  const maceio = new Date(now.toLocaleString('en-US', { timeZone: 'America/Maceio' }));
  maceio.setDate(maceio.getDate() + daysOffset);
  return maceio.toISOString().split('T')[0];
}

export async function getMoviesForDate(cache, date = null, theaterId = '1162') {
  const targetDate = date || getDateString(0);

  const cached = cache.getSessions(targetDate, theaterId);
  if (cached) {
    const movies = denormalize(cache.getAllMovies(), cached.items);
    return { movies, date: targetDate, fromCache: true };
  }

  const normalized = await fetchNormalized(date, theaterId);
  cache.mergeMovies(normalized.movies);
  await cache.setSessions(normalized.date, normalized.sessions, normalized.fetchedAt, theaterId);

  const movies = denormalize(normalized.movies, normalized.sessions);
  return { movies, date: normalized.date, fromCache: false };
}

export async function getUpcomingMovies(cache, theaterId = '1162') {
  const cached = cache.getUpcoming(theaterId);
  if (cached) {
    return { items: cached.items, fromCache: true };
  }

  const result = await fetchUpcoming(theaterId);
  await cache.setUpcoming(result.items, result.fetchedAt, theaterId);
  return { items: result.items, fromCache: false };
}
