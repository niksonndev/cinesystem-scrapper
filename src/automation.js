/**
 * API para automação: executar scrape + diff e retornar resultado estruturado.
 * Use em scripts externos (cron, notificações, etc.).
 */

import { scrape } from './scraper.js';
import { loadPrevious, rotateState } from './storage.js';
import { detectChanges } from './changes.js';

/**
 * Executa scrape, persiste estado e retorna programação atual + diff.
 * @param {{ headless?: boolean }} options
 * @returns {Promise<{ current: { movies: Array<{ name: string, sessions: string[] }>, scrapedAt: string }, changes: ReturnType<typeof detectChanges> }>}
 */
export async function runAndGetChanges(options = {}) {
  const result = await scrape({ headless: options.headless !== false });
  const previous = await loadPrevious();
  const current = { movies: result.movies, scrapedAt: result.scrapedAt };

  await rotateState(current);
  const changes = detectChanges(
    previous ? { movies: previous.movies } : null,
    { movies: result.movies },
  );

  return { current, changes };
}
