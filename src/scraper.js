/**
 * Scraper da programação do Cinesystem Maceió (Ingresso.com)
 * Extrai filmes e horários de sessão da página.
 */

const CINEMA_URL = 'https://www.ingresso.com/cinema/cinesystem-maceio';

/** Padrões que não são nomes de filme (usado pós-extração no Node) */
const SKIP_PATTERNS = [
  /^toda a programação$/i,
  /^você também pode gostar$/i,
  /^sessões?$/i,
  /^detalhes$/i,
  /^programação$/i,
  /^filmes?$/i,
  /ingresso\.com|^cinema[s]?$/i,
  /^comprar ingresso$/i,
  /^ver mais$/i,
  /^horários?$/i,
  /^entrar$/i,
  /^maceió$/i,
  /^hoje$/i,
  /^(seg|ter|qua|qui|sex|sáb|dom)$/i,
  /^\d{1,2}\/\d{1,2}$/, // 21/02
  /^\d+h\d{2}$/i, // 3h17, 1h48
  /^(dublado|legendado|nacional|vip|normal|cinepic)$/i,
  /^cinemas?$/i,
  /^teatro$/i,
  /^eventos?$/i,
  /^notícias?$/i,
  /^ver no mapa$/i,
  /^estreia\s+\d/i,
  /^estamos em maceió|percebemos que você|queremos sugerir|localização está certa/i,
  /^sim, estou em|não, estou em outra/i,
  /^cinesystem maceió$/i,
  /^av\.\s|endereço|loja \d/i,
  /^baixe nosso|como podemos ajudar|menu|institucional|políticas|redes sociais/i,
  /^formas de pagamento|crédito|débito|troque seus pontos|selo do consumidor/i,
  /^ver todos?$/i,
  /^movieid\.com$/i,
  /^venda ingressos online$/i,
];

function isLikelyMovieTitleNode(name) {
  const n = (name || '').trim();
  if (n.length < 4 || n.length > 120) return false;
  if (SKIP_PATTERNS.some((re) => re.test(n))) return false;
  if (/^\d{1,2}:\d{2}/.test(n)) return false;
  if (/^\d+$/.test(n)) return false;
  return true;
}

/**
 * Extrai programação da página usando Playwright.
 * @param {import('playwright').Page} page
 * @returns {Promise<{ movies: Array<{ name: string, sessions: string[] }>, raw: string }>}
 */
export async function extractProgramming(page) {
  // Aguarda a página estabilizar (conteúdo dinâmico)
  await page.waitForLoadState('networkidle').catch(() => {});

  const result = await page.evaluate(() => {
    function isLikelyMovieTitle(name) {
      const n = (name || '').trim();
      if (n.length < 4 || n.length > 120) return false;
      if (/^\d{1,2}:\d{2}/.test(n)) return false;
      if (/^\d+h\d{2}$/i.test(n)) return false;
      if (/^(seg|ter|qua|qui|sex|sáb|dom|hoje)$/i.test(n)) return false;
      if (/^(dublado|legendado|nacional|vip|normal|cinepic)$/i.test(n))
        return false;
      if (/^\d{1,2}\/\d{1,2}$/.test(n)) return false;
      return true;
    }

    const movies = [];
    const seen = new Set();

    // Mensagem de "sem sessões"
    const noSessions = document.body.innerText.includes(
      'Ainda não temos sessões',
    );
    if (noSessions) {
      return {
        movies: [],
        noSessions: true,
        raw: document.body.innerText.slice(0, 2000),
      };
    }

    // Estratégia 1: elementos que parecem títulos de filme (h2, h3, [class*="movie"], [class*="title"])
    const titleSelectors = [
      'h2[class*="title"], h3[class*="title"]',
      '[data-testid*="movie"], [data-testid*="title"]',
      '[class*="movie-title"], [class*="MovieTitle"]',
      '.movie-title',
      'h2',
      'h3',
    ];

    let titleElements = [];
    for (const sel of titleSelectors) {
      try {
        const el = document.querySelectorAll(sel);
        if (el.length) titleElements = Array.from(el);
        if (titleElements.length) break;
      } catch (_) {}
    }

    // Estratégia 2: horários (botões, links com horário tipo 14:30, 16:00)
    const timeRegex = /\b(\d{1,2}:\d{2})\b/g;

    function extractSessionsFromContainer(container) {
      const text = container ? container.innerText : document.body.innerText;
      const times = [];
      let m;
      while ((m = timeRegex.exec(text)) !== null) {
        const t = m[1];
        if (!times.includes(t)) times.push(t);
      }
      return times;
    }

    // Tentar estrutura: cada filme em um card/container com título + lista de horários
    const cardSelectors = [
      '[class*="bg-ing-neutral-600"]', // Seletor correto para a estrutura atual do Ingresso
      '[class*="movie-card"], [class*="MovieCard"]',
      '[class*="session-card"], [class*="SessionCard"]',
      '[data-testid*="movie"], [data-testid*="session"]',
      'article',
      '[class*="card"]',
      'section',
    ];

    for (const cardSel of cardSelectors) {
      const cards = document.querySelectorAll(cardSel);
      if (cards.length < 2) continue;

      for (const card of cards) {
        const titleEls = card.querySelectorAll(
          'h2, h3, h4, [class*="title"], [class*="Title"]',
        );
        let name = '';
        for (const el of titleEls) {
          const t = (el.textContent || '').trim();
          if (t && isLikelyMovieTitle(t) && t.length > (name.length || 0))
            name = t;
        }
        if (!name) continue;

        const key = name.toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(key)) continue;
        seen.add(key);

        const sessions = extractSessionsFromContainer(card);
        movies.push({ name, sessions: [...sessions].sort() });
      }
      // Se encontrou filmes com este seletor, continue verificando com os próximos
      // em caso de falsos positivos no primeiro seletor
      if (movies.length > 2) break;
    }

    // Filtra filmes válidos (remove UI labels que passaram)
    const filtered = movies.filter((m) => isLikelyMovieTitle(m.name));

    // Fallback: pegar todo o texto e tentar extrair pares filme + horários
    if (filtered.length === 0) {
      const bodyText = document.body.innerText;
      const lines = bodyText
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      let currentMovie = null;
      for (const line of lines) {
        if (line.match(/^\d{1,2}:\d{2}(\s|$)/)) {
          if (currentMovie)
            currentMovie.sessions.push(line.match(/(\d{1,2}:\d{2})/)[1]);
        } else if (
          line.length > 2 &&
          line.length < 150 &&
          !line.includes('Ingresso') &&
          !line.includes('Cinema')
        ) {
          if (
            currentMovie &&
            (currentMovie.sessions.length || currentMovie.name) &&
            isLikelyMovieTitle(currentMovie.name)
          ) {
            filtered.push({
              name: currentMovie.name,
              sessions: [...currentMovie.sessions].sort(),
            });
          }
          currentMovie = { name: line, sessions: [] };
        }
      }
      if (
        currentMovie &&
        (currentMovie.sessions.length || currentMovie.name) &&
        isLikelyMovieTitle(currentMovie.name)
      ) {
        filtered.push({
          name: currentMovie.name,
          sessions: [...currentMovie.sessions].sort(),
        });
      }
    }

    const final = filtered.length
      ? filtered
      : movies.filter((m) => isLikelyMovieTitle(m.name));
    return {
      movies: final,
      noSessions: false,
      raw: document.body.innerText.slice(0, 3000),
    };
  });

  // Associa sessões de blocos "DUBLADO"/"LEGENDADO" ao filme anterior
  const raw = result.movies || [];
  const merged = [];
  for (const item of raw) {
    const name = (item.name || '').trim();
    const isTypeBlock =
      /^(dublado|legendado|nacional|vip|normal|cinepic)$/i.test(name) &&
      (item.sessions || []).length > 0;
    if (isTypeBlock && merged.length > 0) {
      const last = merged[merged.length - 1];
      const times = item.sessions || [];
      last.sessions = [...new Set([...(last.sessions || []), ...times])].sort();
    } else if (isLikelyMovieTitleNode(name)) {
      merged.push({ name, sessions: [...(item.sessions || [])].sort() });
    }
  }

  // Se a ordem da página for diferente (tipo antes do título), incluir filmes que tenham só nome
  if (merged.length === 0 && raw.length > 0) {
    for (const item of raw) {
      const name = (item.name || '').trim();
      if (isLikelyMovieTitleNode(name)) {
        merged.push({ name, sessions: [...(item.sessions || [])].sort() });
      }
    }
  }

  return {
    movies: merged,
    noSessions: result.noSessions || false,
    raw: result.raw || '',
  };
}

/**
 * Abre a página do cinema e extrai a programação.
 * @param {object} options - { headless: boolean, date?: string (DD/MM/YYYY) }
 * @returns {Promise<{ movies, noSessions, raw, scrapedAt }>}
 */
export async function scrape(options = {}) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    headless: options.headless !== false,
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  try {
    const page = await context.newPage();
    let url = CINEMA_URL;
    if (options.date) {
      url += `?date=${options.date}`;
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const { movies, noSessions, raw } = await extractProgramming(page);
    await browser.close();

    return {
      movies,
      noSessions,
      raw,
      scrapedAt: new Date().toISOString(),
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
