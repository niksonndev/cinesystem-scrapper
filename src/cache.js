/**
 * Sistema de cache para filmes do Cinesystem
 * Armazena resultados de scraping em arquivo JSON
 * Expira quando virada o dia (compara data do scrapedAt com data atual)
 */

import fs from 'fs';

class MovieCache {
  constructor() {
    this.cacheFile = 'data/movies-cache.json';
    this.cache = { hoje: null, amanha: null };
  }

  /**
   * Retorna uma data ISO (YYYY-MM-DD) considerando o fuso de Maceió
   * @param {number} offsetDays - Quantidade de dias a somar (0 = hoje, 1 = amanhã, etc.)
   */
  getMaceioISODate(offsetDays = 0) {
    const now = new Date();
    // Converte para o horário de Maceió
    const maceioNow = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Maceio' }),
    );
    maceioNow.setDate(maceioNow.getDate() + offsetDays);
    return maceioNow.toISOString().split('T')[0];
  }

  /**
   * Carrega cache do arquivo
   */
  load() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8');
        this.cache = JSON.parse(data);
      }
    } catch (err) {
      // Arquivo não existe ou é inválido - inicializa vazio
      console.warn('⚠️  Erro ao carregar cache:', err.message);
      this.cache = { hoje: null, amanha: null };
    }
  }

  /**
   * Salva cache no arquivo
   */
  save() {
    try {
      if (!fs.existsSync('data')) {
        fs.mkdirSync('data', { recursive: true });
      }
      fs.writeFileSync(
        this.cacheFile,
        JSON.stringify(this.cache, null, 2),
        'utf-8'
      );
    } catch (err) {
      console.error('❌ Erro ao salvar cache:', err.message);
    }
  }

  /**
   * Extrai data do formato ISO (YYYY-MM-DD)
   * @param {string} isoDateTime - Ex: 2026-02-23T15:29:40.529Z
   * @returns {string} - Ex: 2026-02-23
   */
  extractDateFromISO(isoDateTime) {
    if (!isoDateTime) return null;
    return isoDateTime.split('T')[0];
  }

  /**
   * Verifica se cache ainda é válido para hoje
   * Compara a data do scrapedAt com a data atual
   * @param {object} cached - { movies, scrapedAt }
   * @param {boolean} forceRefresh - ignora data e força novo fetch
   * @returns {boolean} true se cache é válido
   */
  isCacheValid(cached, forceRefresh = false) {
    if (!cached || !cached.scrapedAt) return false;
    if (forceRefresh) return false;

    const cachedDate = this.extractDateFromISO(cached.scrapedAt);
    const todayDate = this.getMaceioISODate(0);

    return cachedDate === todayDate;
  }

  /**
   * Retorna filmes de hoje do cache (se válido)
   * @param {boolean} forceRefresh - ignora cache válido, força novo fetch
   * @returns {object|null} { movies, scrapedAt } ou null se expirado
   */
  getToday(forceRefresh = false) {
    if (!this.cache.hoje) return null;

    if (!this.isCacheValid(this.cache.hoje, forceRefresh)) {
      const cachedDate = this.extractDateFromISO(this.cache.hoje.scrapedAt);
      const todayDate = new Date().toISOString().split('T')[0];

      if (forceRefresh) {
        console.log('🔄 Force refresh ativado, buscando dados novos...');
      } else if (cachedDate !== todayDate) {
        console.log(`📅 Cache expirado (${cachedDate} → ${todayDate}), buscando dados novos...`);
      }

      return null;
    }

    console.log('✅ Usando cache válido para hoje');
    return {
      movies: this.cache.hoje.movies,
      scrapedAt: this.cache.hoje.scrapedAt,
    };
  }

  /**
   * Retorna filmes de amanhã do cache (se válido)
   * @param {boolean} forceRefresh - ignora cache válido, força novo fetch
   * @returns {object|null} { movies, scrapedAt } ou null se expirado
   */
  getAmanha(forceRefresh = false) {
    if (!this.cache.amanha) return null;

    if (!this.isCacheValid(this.cache.amanha, forceRefresh)) {
      const cachedDate = this.extractDateFromISO(this.cache.amanha.scrapedAt);
      const tomorrowDateStr = this.getMaceioISODate(1);

      if (forceRefresh) {
        console.log('🔄 Force refresh ativado, buscando dados novos...');
      } else if (cachedDate !== tomorrowDateStr) {
        console.log(`📅 Cache expirado, buscando dados novos...`);
      }

      return null;
    }

    console.log('✅ Usando cache válido para amanhã');
    return {
      movies: this.cache.amanha.movies,
      scrapedAt: this.cache.amanha.scrapedAt,
    };
  }

  /**
   * Salva filmes de hoje no cache
   * @param {array} movies - lista de filmes
   * @param {string} scrapedAt - data ISO de quando foi feito o scrape
   */
  setToday(movies, scrapedAt) {
    this.cache.hoje = {
      movies,
      scrapedAt,
    };
    this.save();
    const date = this.extractDateFromISO(scrapedAt);
    console.log(`💾 Cache de Filmes de Hoje salvo (data: ${date})`);
  }

  /**
   * Salva filmes de amanhã no cache
   * @param {array} movies - lista de filmes
   * @param {string} scrapedAt - data ISO de quando foi feito o scrape
   */
  setAmanha(movies, scrapedAt) {
    this.cache.amanha = {
      movies,
      scrapedAt,
    };
    this.save();
    const date = this.extractDateFromISO(scrapedAt);
    console.log(`💾 Cache de Filmes de Amanhã salvo (data: ${date})`);
  }
}

export default MovieCache;

