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
 * @param {boolean} debugMode - se verdadeiro, pausa para visualização
 * @returns {Promise<{ inteira?: number, meia?: number, gratuito: boolean }>}
 */
async function extractSessionPrice(page, button, debugMode = false) {
  try {
    // Fecha modal anterior
    try {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
    } catch (_) {
      // Contexto pode ter sido destruído, ignora
    }

    try {
      // Clica no botão
      await button.click();

      // Em modo debug, pausa antes de clicar
      if (debugMode) {
        console.log('⏸️  Pausando 2s para visualizar modal... (modo DEBUG)');
        await page.waitForTimeout(2000);
      } else {
        // Espera o modal aparecer - aumentado para 1s
        await page.waitForTimeout(1000);
      }
    } catch (clickErr) {
      // Se clicar falhar (contexto destruído), retorna gratuito
      if (clickErr.message && clickErr.message.includes('context')) {
        console.warn('⚠ Contexto destruído ao clicar no botão de preço');
        return { gratuito: true };
      }
      throw clickErr;
    }

    try {
      const priceData = await page.evaluate(() => {
        const modals = document.querySelectorAll('[role="dialog"]');
        if (!modals.length) {
          console.warn('⚠ DEBUG: Nenhum modal encontrado. Tentando console.log do conteúdo da página...');
          return { gratuito: true };
        }

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

      try {
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(150);
      } catch (_) {
        // Contexto pode ter sido destruído, ok
      }

      return priceData;
    } catch (evalErr) {
      // Se evaluate falhar (contexto destruído), retorna gratuito
      if (evalErr.message && evalErr.message.includes('context')) {
        console.warn('⚠ Contexto destruído ao extrair preço');
        return { gratuito: true };
      }
      console.warn('⚠ Erro ao avaliar preço. Capturando conteúdo da página para debug...');
      try {
        const pageContent = await page.content();
        console.log('📄 Conteúdo da página (primeiros 1500 caracteres):', pageContent.substring(0, 1500));
      } catch (contentErr) {
        console.warn('⚠ Não foi possível capturar conteúdo da página:', contentErr.message);
      }
      throw evalErr;
    }
  } catch (err) {
    console.warn('⚠ Erro ao extrair preço de sessão:', err.message);
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

  // Tenta extrair preços com retry em caso de contexto destruído
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`📍 Tentativa ${attempt}/2 de extrair preços...`);
      return await extractPricesFromPlaywright(apiMovies, options);
    } catch (err) {
      lastError = err;
      if (err.message && err.message.includes('context')) {
        console.warn(
          `⚠ Contexto destruído na tentativa ${attempt}, tentando novamente...`,
        );
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Aguarda 2s antes de retry
          continue;
        }
      }
      throw err;
    }
  }

  throw lastError;
}

/**
 * Função auxiliar que extrai preços usando Playwright
 */
async function extractPricesFromPlaywright(apiMovies, options) {
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

    // Navegar com tratamento para timeout
    // Tenta networkidle primeiro, fallback para domcontentloaded se der timeout
    try {
      console.log('📍 Navegando para página com waitUntil: networkidle...');
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Em modo debug, pausa 2s para visualizar a página carregada
      if (options.headless === false) {
        console.log('⏸️  Pausando 2s para visualizar... (modo DEBUG)');
        await page.waitForTimeout(2000);
      }
    } catch (timeoutErr) {
      if (timeoutErr.message && timeoutErr.message.includes('Timeout')) {
        console.warn('⚠ Timeout com networkidle, tentando com domcontentloaded...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Em modo debug, pausa 2s
        if (options.headless === false) {
          console.log('⏸️  Pausando 2s para visualizar... (modo DEBUG)');
          await page.waitForTimeout(2000);
        }
      } else {
        throw timeoutErr;
      }
    }

    // Aguardar até 10 segundos por botões de preço aparecerem
    // Isso garante que a mudança de data foi processada
    try {
      await page.waitForSelector('button[aria-label="Abrir modal de preços"]', {
        timeout: 10000,
      });
    } catch (e) {
      console.log(
        '⚠ Nenhum seletor de preço encontrado após 10s (pode ser data sem sessões)',
      );
    }

    // Extrai preços para cada sessão
    let sessionCount = 0;
    const priceButtons = await page.$$(
      'button[aria-label="Abrir modal de preços"]',
    );

    if (options.headless === false) {
      console.log(`🔍 DEBUG: Encontrados ${priceButtons.length} botões de preço na página`);
    }

    if (priceButtons.length === 0 && options.date) {
      console.log('⚠ Aviso: Nenhum botão de preços encontrado.');
      console.log('(Os preços só são disponíveis para sessões de hoje)');
      console.log('📄 Capturando conteúdo da página para debug...');
      try {
        const pageContent = await page.content();
        console.log('📄 Conteúdo da página (primeiros 2000 caracteres):', pageContent.substring(0, 2000));
      } catch (contentErr) {
        console.warn('⚠ Não foi possível capturar conteúdo da página:', contentErr.message);
      }
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
            if (options.headless === false) {
              console.log(`🔍 DEBUG: Processando ${movie.name} - ${session.time}`);
            }
            const priceData = await extractSessionPrice(page, btn, options.headless === false);
            session.priceInteira = priceData.inteira;
            session.priceMeia = priceData.meia;
            session.gratuito = priceData.gratuito;
            sessionCount++;
            if (options.headless === false) {
              console.log(`  ✓ Extraído: Inteira R$ ${priceData.inteira || 'N/A'}, Meia R$ ${priceData.meia || 'N/A'}`);
            }
          } catch (err) {
            console.warn(
              `⚠ Erro ao extrair preço da sessão ${session.sessionId}:`,
              err.message,
            );
          }
        }
      }
    }

    console.log(`✓ ${sessionCount} sessões com preço.`);

    if (options.headless === false) {
      console.log('\n🔍 RESUMO DO DEBUG:');
      console.log(`  - Botões encontrados: ${priceButtons.length}`);
      console.log(`  - Sessões processadas: ${sessionCount}`);
      console.log(`  - Filmes totais: ${apiMovies.length}`);
      console.log('  ⏸️  Navegador será fechado em 3 segundos...\n');
      await page.waitForTimeout(3000);
    }

    await browser.close();

    return {
      movies: apiMovies,
      noSessions: false,
      raw: '',
      scrapedAt: new Date().toISOString(),
    };
  } catch (err) {
    try {
      await browser.close();
    } catch (_) {}
    throw err;
  }
}
