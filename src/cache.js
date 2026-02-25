/**
 * Cache normalizado para dados do Ingresso.com
 *
 * Estrutura do arquivo:
 * {
 *   movies: { [movieId]: MovieStatic },           // dados estáticos (raro mudar)
 *   sessions: { [date]: { fetchedAt, items } },   // dados dinâmicos por data
 *   upcoming: { fetchedAt, items },               // próximos lançamentos
 *   moviesUpdatedAt: ISO string
 * }
 *
 * Regras de expiração:
 * - Sessões expiram na virada do dia (fuso America/Maceio)
 * - Filmes estáticos são atualizados apenas quando uma nova sessão traz um filme desconhecido
 */

import fs from 'fs';

const CACHE_FILE = 'data/cache.json';

class NormalizedCache {
  constructor() {
    this.data = { movies: {}, sessions: {}, upcoming: null, moviesUpdatedAt: null };
  }

  getMaceioDate(offsetDays = 0) {
    const now = new Date();
    const maceio = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Maceio' }),
    );
    maceio.setDate(maceio.getDate() + offsetDays);
    return maceio.toISOString().split('T')[0];
  }

  load() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        this.data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      }
    } catch (err) {
      console.warn('⚠️  Cache corrompido, reinicializando:', err.message);
      this.data = { movies: {}, sessions: {}, upcoming: null, moviesUpdatedAt: null };
    }
  }

  save() {
    try {
      if (!fs.existsSync('data')) {
        fs.mkdirSync('data', { recursive: true });
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('❌ Erro ao salvar cache:', err.message);
    }
  }

  /**
   * Mescla filmes estáticos no cache.
   * Só sobrescreve se o filme ainda não existe — evita writes desnecessários.
   * @returns {number} Quantidade de filmes novos adicionados
   */
  mergeMovies(movies) {
    let added = 0;
    for (const [id, movie] of Object.entries(movies)) {
      if (!this.data.movies[id]) {
        this.data.movies[id] = movie;
        added++;
      }
    }
    if (added > 0) {
      this.data.moviesUpdatedAt = new Date().toISOString();
      console.log(`💾 ${added} filme(s) novo(s) adicionado(s) ao cache estático`);
    }
    return added;
  }

  /**
   * Salva sessões dinâmicas para uma data específica.
   */
  setSessions(date, sessions, fetchedAt) {
    this.data.sessions[date] = { fetchedAt, items: sessions };
    this.purgeOldSessions();
    this.save();
    console.log(`💾 ${sessions.length} sessão(ões) salva(s) para ${date}`);
  }

  /**
   * Retorna sessões de uma data se o cache for válido (mesmo dia em Maceió).
   * @returns {{ items: Array, fetchedAt: string } | null}
   */
  getSessions(date) {
    const cached = this.data.sessions[date];
    if (!cached?.fetchedAt) return null;

    const cachedDay = cached.fetchedAt.split('T')[0];
    const today = this.getMaceioDate(0);

    if (cachedDay !== today) {
      console.log(`📅 Cache de sessões para ${date} expirado (${cachedDay} → ${today})`);
      delete this.data.sessions[date];
      return null;
    }

    console.log(`✅ Cache hit: sessões de ${date}`);
    return cached;
  }

  /**
   * Retorna um filme estático pelo ID.
   */
  getMovie(id) {
    return this.data.movies[id] ?? null;
  }

  /**
   * Retorna todos os filmes estáticos.
   */
  getAllMovies() {
    return this.data.movies;
  }

  /**
   * Salva próximos lançamentos no cache.
   */
  setUpcoming(items, fetchedAt) {
    this.data.upcoming = { fetchedAt, items };
    this.save();
    console.log(`💾 ${items.length} lançamento(s) salvo(s) no cache`);
  }

  /**
   * Retorna próximos lançamentos se o cache for válido (mesmo dia em Maceió).
   * @returns {{ items: Array, fetchedAt: string } | null}
   */
  getUpcoming() {
    const cached = this.data.upcoming;
    if (!cached?.fetchedAt) return null;

    const cachedDay = cached.fetchedAt.split('T')[0];
    const today = this.getMaceioDate(0);

    if (cachedDay !== today) {
      console.log(`📅 Cache de lançamentos expirado (${cachedDay} → ${today})`);
      this.data.upcoming = null;
      return null;
    }

    console.log('✅ Cache hit: próximos lançamentos');
    return cached;
  }

  /**
   * Remove sessões de datas passadas.
   */
  purgeOldSessions() {
    const today = this.getMaceioDate(0);
    for (const date of Object.keys(this.data.sessions)) {
      if (date < today) {
        delete this.data.sessions[date];
      }
    }
  }
}

export default NormalizedCache;
