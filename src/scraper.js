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
 * Extrai preços de uma sessão clicando no botão de preços
 * @param {import('playwright').Page} page
 * @param {import('playwright').ElementHandle} button - botão de preço a clicar
 * @returns {Promise<{ inteira?: number, meia?: number, gratuito: boolean }>}
 */
async function extractSessionPrice(page, button) {
  try {
    // Fecha modal anterior
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);

    // Clica no botão
    await button.click();

    // Espera menos - o modal é rápido
    await page.waitForTimeout(600);

    const priceData = await page.evaluate(() => {
      const modals = document.querySelectorAll('[role="dialog"]');
      if (!modals.length) return { gratuito: true };

      // Procura o modal correto (com Inteira/Meia)
      let targetModal = null;
      for (const modal of modals) {
        const text = modal.innerText || '';
        if (text.includes('Inteira')) {
          targetModal = modal;
          break;
        }
      }

      if (!targetModal && modals.length > 0) {
        for (const modal of modals) {
          const text = modal.innerText || '';
          if (!text.includes('Maceió') && text.length > 100) {
            targetModal = modal;
            break;
          }
        }
      }

      if (!targetModal) return { gratuito: true };

      const text = targetModal.innerText || '';
      const prices = {};

      const inteirMatch = text.match(/^Inteira:\s*R\$\s*([\d.,]+)/m);
      const meiaMatch = text.match(/^Meia:\s*R\$\s*([\d.,]+)/m);

      if (inteirMatch) {
        const valor = inteirMatch[1].replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(valor);
        if (!isNaN(parsed) && parsed > 0) prices.inteira = parsed;
      }

      if (meiaMatch) {
        const valor = meiaMatch[1].replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(valor);
        if (!isNaN(parsed) && parsed > 0) prices.meia = parsed;
      }

      prices.gratuito = !inteirMatch && !meiaMatch;
      return prices;
    });

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);

    return priceData;
  } catch (err) {
    try { await page.keyboard.press('Escape').catch(() => {}); } catch (_) {}
    return { gratuito: true };
  }
}

/**
 * Extrai programação da página usando Playwright com suporte a preços.
 * @param {import('playwright').Page} page
 * @param {boolean} extractPrices - se deve extrair preços (mais lento)
 * @returns {Promise<{ movies: Array, noSessions: boolean, raw: string }>}
 */
export async function extractProgramming(page, extractPrices = false) {
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

        // Extrai horários com IDs de sessão
        const sessions = [];
        const links = card.querySelectorAll('a[href*="sessionId"]');
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          const timeEl = link.querySelector('span') || link;
          const time = (timeEl.textContent || '').trim();

          // Extrai sessionId da URL
          const sessionMatch = href.match(/sessionId=(\d+)/);
          const sessionId = sessionMatch ? sessionMatch[1] : null;

          // Validar que é um horário válido
          if (/^\d{1,2}:\d{2}$/.test(time)) {
            sessions.push({ time, sessionId });
          }
        }

        if (sessions.length > 0) {
          movies.push({ name, sessions });
        }
      }
      // Se encontrou filmes com este seletor, continue verificando
      if (movies.length > 2) break;
    }

    // Filtra filmes válidos
    const filtered = movies.filter((m) => isLikelyMovieTitle(m.name));

    const final = filtered.length ? filtered : movies;
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
      last.sessions = [
        ...new Set([...(last.sessions || []), ...times]),
      ].sort((a, b) => {
        const timeA = typeof a === 'string' ? a : a.time;
        const timeB = typeof b === 'string' ? b : b.time;
        return timeA.localeCompare(timeB);
      });
    } else if (isLikelyMovieTitleNode(name)) {
      merged.push({ name, sessions: [...(item.sessions || [])].sort() });
    }
  }

  // Se a ordem da página for diferente, incluir filmes que tenham só nome
  if (merged.length === 0 && raw.length > 0) {
    for (const item of raw) {
      const name = (item.name || '').trim();
      if (isLikelyMovieTitleNode(name)) {
        merged.push({ name, sessions: [...(item.sessions || [])].sort() });
      }
    }
  }

  // Extrai preços se solicitado (otimizado)
  if (extractPrices && merged.length > 0) {
    console.log('Extraindo preços...');
    let sessionCount = 0;
    const priceButtons = await page.$$('button[aria-label="Abrir modal de preços"]');

    // Mapeia botão -> sessionId para acesso rápido
    const buttonToSession = new Map();

    for (const btn of priceButtons) {
      try {
        const sessionIds = await btn.evaluate((button) => {
          const card = button.closest('[class*="bg-ing-neutral-600"]');
          if (!card) return [];
          const links = card.querySelectorAll('a[href*="sessionId"]');
          return Array.from(links).map(link => {
            const match = link.href.match(/sessionId=(\d+)/);
            return match ? match[1] : null;
          }).filter(Boolean);
        });

        if (sessionIds.length > 0) {
          for (const sid of sessionIds) {
            buttonToSession.set(sid, btn);
          }
        }
      } catch (_) {}
    }

    // Extrai preços usando o mapa
    for (const movie of merged) {
      if (!Array.isArray(movie.sessions)) continue;

      for (const session of movie.sessions) {
        if (typeof session !== 'object') continue;
        const btn = buttonToSession.get(session.sessionId);

        if (btn) {
          try {
            const priceData = await extractSessionPrice(page, btn);
            session.priceInteira = priceData.inteira;
            session.priceMeia = priceData.meia;
            session.gratuito = priceData.gratuito;
            sessionCount++;
          } catch (_) {}
        }
      }
    }

    console.log(`✓ ${sessionCount} sessões com preço.`);
  }

  return {
    movies: merged,
    noSessions: result.noSessions || false,
    raw: result.raw || '',
  };
}

/**
 * Abre a página do cinema e extrai a programação.
 * @param {object} options - { headless: boolean, date?: string (DD/MM/YYYY), extractPrices?: boolean }
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

    const { movies, noSessions, raw } = await extractProgramming(
      page,
      options.extractPrices === true,
    );
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
