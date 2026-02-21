/**
 * Detecção de mudanças entre dois estados da programação.
 */

/**
 * Normaliza nome do filme para comparação.
 * @param {string} name
 */
function norm(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Compara estado anterior com atual e retorna mudanças.
 * @param {{ movies: Array<{ name: string, sessions: string[] }> } | null} previous
 * @param {{ movies: Array<{ name: string, sessions: string[] }> }} current
 * @returns {{ addedMovies: string[], removedMovies: string[], addedSessions: Array<{ movie: string, times: string[] }>, removedSessions: Array<{ movie: string, times: string[] }>, summary: string }}
 */
export function detectChanges(previous, current) {
  const addedMovies = [];
  const removedMovies = [];
  const addedSessions = [];
  const removedSessions = [];

  const prevMap = new Map();
  if (previous && previous.movies) {
    for (const m of previous.movies) {
      prevMap.set(norm(m.name), { name: m.name, sessions: new Set(m.sessions || []) });
    }
  }

  const currMap = new Map();
  if (current && current.movies) {
    for (const m of current.movies) {
      currMap.set(norm(m.name), { name: m.name, sessions: new Set(m.sessions || []) });
    }
  }

  // Filmes novos
  for (const [key, data] of currMap) {
    if (!prevMap.has(key)) addedMovies.push(data.name);
  }

  // Filmes removidos
  for (const [key, data] of prevMap) {
    if (!currMap.has(key)) removedMovies.push(data.name);
  }

  // Sessões adicionadas/removidas por filme
  for (const [key, curr] of currMap) {
    const prev = prevMap.get(key);
    if (!prev) continue;

    const added = [...curr.sessions].filter(t => !prev.sessions.has(t));
    const removed = [...prev.sessions].filter(t => !curr.sessions.has(t));
    if (added.length) addedSessions.push({ movie: curr.name, times: added });
    if (removed.length) removedSessions.push({ movie: curr.name, times: removed });
  }

  const parts = [];
  if (addedMovies.length) parts.push(`${addedMovies.length} filme(s) novo(s)`);
  if (removedMovies.length) parts.push(`${removedMovies.length} filme(s) removido(s)`);
  if (addedSessions.length) parts.push('sessões adicionadas');
  if (removedSessions.length) parts.push('sessões removidas');
  const summary = parts.length ? parts.join(', ') : 'Nenhuma mudança';

  return {
    addedMovies,
    removedMovies,
    addedSessions,
    removedSessions,
    summary,
    hasChanges: addedMovies.length > 0 || removedMovies.length > 0 || addedSessions.length > 0 || removedSessions.length > 0,
  };
}
