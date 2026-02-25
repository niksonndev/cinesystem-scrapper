/**
 * Scraper da programação do Cinesystem Maceió (Ingresso.com)
 * Obtém filmes e horários da API, extrai preços via Playwright.
 */

import { getProgrammingFromAPI } from './api.js';

const CINEMA_URL = 'https://www.ingresso.com/cinema/cinesystem-maceio';

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
    try {
      await page.keyboard.press('Escape').catch(() => {});
    } catch (_) {}
    return { gratuito: true };
  }
}

/**
 * Abre a página do cinema e extrai a programação via API + Playwright para preços.
 * @param {object} options - { headless: boolean, date?: string (DD/MM/YYYY), extractPrices?: boolean }
 * @returns {Promise<{ movies, noSessions, raw, scrapedAt }>}
 */
export async function scrape(options = {}) {
  // Obtém filmes + sessões da API (rápido e confiável)
  const apiMovies = await getProgrammingFromAPI(options.date);

  if (!apiMovies || apiMovies.length === 0) {
    return {
      movies: [],
      noSessions: true,
      raw: 'Nenhum filme encontrado na API',
      scrapedAt: new Date().toISOString(),
    };
  }

  // Se não precisa extrair preços, retorna dados da API
  if (options.extractPrices !== true) {
    return {
      movies: apiMovies,
      noSessions: false,
      raw: '',
      scrapedAt: new Date().toISOString(),
    };
  }

  // Extrai preços usando Playwright (se solicitado)
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    headless: options.headless !== false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
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

    // Extrai preços para cada sessão
    let sessionCount = 0;
    const priceButtons = await page.$$(
      'button[aria-label="Abrir modal de preços"]',
    );

    if (priceButtons.length === 0 && options.date) {
      console.log('⚠ Aviso: Nenhum botão de preços encontrado.');
      console.log('(Os preços só são disponíveis para sessões de hoje)');
    }

    // Mapeia sessionId -> button para acesso rápido
    const buttonToSession = new Map();

    for (const btn of priceButtons) {
      try {
        const sessionIds = await btn.evaluate((button) => {
          const card = button.closest('[class*="bg-ing-neutral-600"]');
          if (!card) return [];
          const links = card.querySelectorAll('a[href*="sessionId"]');
          return Array.from(links)
            .map((link) => {
              const match = link.href.match(/sessionId=(\d+)/);
              return match ? match[1] : null;
            })
            .filter(Boolean);
        });

        if (sessionIds.length > 0) {
          for (const sid of sessionIds) {
            buttonToSession.set(sid, btn);
          }
        }
      } catch (_) {}
    }

    // Extrai preços e adiciona aos dados da API
    for (const movie of apiMovies) {
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
    await browser.close();

    return {
      movies: apiMovies,
      noSessions: false,
      raw: '',
      scrapedAt: new Date().toISOString(),
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
