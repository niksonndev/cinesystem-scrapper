/**
 * Análise detalhada de preços - interativo com Playwright
 * Executa: node src/detailed-price-analysis.js
 */

const CINEMA_URL = 'https://www.ingresso.com/cinema/cinesystem-maceio';

export async function analyzeDetailedPrices(options = {}) {
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

    console.log('\n=== ANÁLISE DETALHADA DE PREÇOS ===\n');
    console.log('Abrindo página...');
    await page.goto(CINEMA_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Aguarda a página estabilizar
    await page.waitForTimeout(2000);

    console.log('Página carregada!');

    // Inspeciona a estrutura HTML original dos cards de cinema
    const moviesData = await page.evaluate(() => {
      const movies = [];

      // Encontra todos os containers de filme
      const movieContainers = document.querySelectorAll(
        'div[class*="bg-ing-neutral-600"]',
      );

      console.log(`Encontrados ${movieContainers.length} containers de filme`);

      for (const container of movieContainers) {
        const movieInfo = {
          title: '',
          duration: '',
          genre: '',
          sessions: [],
          html_structure: '',
        };

        // Extrai título
        const titleEl = container.querySelector('h3 a, h2 a');
        if (titleEl) movieInfo.title = titleEl.textContent.trim();

        // Extrai duração
        const durationEl = container.querySelector('[class*="italic"]');
        if (durationEl) movieInfo.duration = durationEl.textContent.trim();

        // Extrai gênero
        const genreEl = container.querySelector('[class*="text-xs"]');
        if (genreEl && !genreEl.textContent.includes(':')) {
          movieInfo.genre = genreEl.textContent.trim();
        }

        // Extrai todas as informações visíveis
        const allText = container.innerText || container.textContent;
        movieInfo.full_text = allText.substring(0, 500);

        // Procura por padrões de preço, meia, inteira
        const priceKeywords = ['meia', 'inteira', 'estudante'];
        priceKeywords.forEach((keyword) => {
          if (allText.toLowerCase().includes(keyword)) {
            movieInfo.price_keywords = movieInfo.price_keywords || [];
            movieInfo.price_keywords.push(keyword);
          }
        });

        // Extrai todos os links (que podem levar a checkout com preços)
        const links = container.querySelectorAll('a');
        const sessionTimeElements = container.querySelectorAll(
          'span[data-testid="animated-label"]',
        );

        for (const timeEl of sessionTimeElements) {
          const time = timeEl.innerText.trim();
          if (/^\d{1,2}:\d{2}$/.test(time)) {
            movieInfo.sessions.push(time);
          }
        }

        // Procura por elementos com classe contendo "price"
        const priceElements = container.querySelectorAll(
          '[class*="price"], [class*="Price"]',
        );
        movieInfo.has_price_elements = priceElements.length > 0;

        // Extrai HTML dos botões de compra
        const buyButtons = container.querySelectorAll(
          'a[href*="checkout.ingresso.com"]',
        );
        movieInfo.buy_buttons_count = buyButtons.length;

        // Procura por padrões de modal
        const modals = container.querySelectorAll(
          '[class*="modal"], [class*="Modal"]',
        );
        movieInfo.has_price_modal = modals.length > 0;

        if (movieInfo.title) {
          movies.push(movieInfo);
        }
      }

      return {
        total_movies: movies.length,
        movies: movies,
      };
    });

    console.log('\n--- FILMES ENCONTRADOS ---');
    console.log(JSON.stringify(moviesData, null, 2));

    // Agora procura por modais de preço
    console.log('\n--- PROCURANDO ESTRUTURAS DE PREÇO ---\n');

    // Clica no primeiro botão de preço (ícone de preço)
    const priceButtons = await page
      .locator('button[aria-label="Abrir modal de preços"]')
      .all();

    if (priceButtons.length > 0) {
      console.log(`Encontrados ${priceButtons.length} botões de preço`);
      console.log('Clicando no primeiro botão de preço...');

      await priceButtons[0].click();
      await page.waitForTimeout(1000);

      // Extrai a modal de preço
      const modalHTML = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
          return {
            html: modal.outerHTML.substring(0, 2000),
            text: modal.innerText,
          };
        }
        return null;
      });

      if (modalHTML) {
        console.log('\n--- MODAL DE PREÇO ENCONTRADA ---');
        console.log('Texto da modal:');
        console.log(modalHTML.text);
        console.log('\nHTML (primeiros 2000 caracteres):');
        console.log(modalHTML.html);
      } else {
        console.log('Nenhuma modal encontrada');
      }
    } else {
      console.log('Nenhum botão de preço encontrado');
    }

    // Procura por qualquer elemento contendo "R" ou "meia"
    console.log('\n--- PROCURANDO POR PALAVRAS-CHAVE ---\n');

    const textAnalysis = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      const keywords = {
        inteira: (bodyText.match(/inteira|full_price|fullPrice/gi) || [])
          .length,
        meia: (bodyText.match(/meia|half_price|halfPrice|meia-entrada/gi) || [])
          .length,
        estudante: (bodyText.match(/estudante|student/gi) || []).length,
        gratuito: (bodyText.match(/gratuito|free|grátis/gi) || []).length,
        desconto: (bodyText.match(/desconto|promoção|promocao|promo/gi) || [])
          .length,
        reais: (bodyText.match(/reais|R\$|\br\s*\d/gi) || []).length,
      };

      return keywords;
    });

    console.log('Contagem de palavras-chave encontradas:');
    console.log(JSON.stringify(textAnalysis, null, 2));

    // Procura por atributos data ou classes relacionadas a preço
    console.log('\n--- ESTRUTURAS DE DADOS ---\n');

    const dataStructures = await page.evaluate(() => {
      const result = {
        data_attributes: {},
        special_classes: {},
      };

      // Procura por atributos data-*
      const allElements = document.querySelectorAll(
        '[data-price], [data-valor], [data-session]',
      );
      for (const el of allElements) {
        const attrs = el.dataset;
        Object.keys(attrs).forEach((key) => {
          if (
            key.toLowerCase().includes('price') ||
            key.toLowerCase().includes('valor')
          ) {
            result.data_attributes[key] = attrs[key];
          }
        });
      }

      // Procura por classes especiais
      const classKeywords = ['price', 'valor', 'ingresso', 'session', 'ticket'];
      classKeywords.forEach((keyword) => {
        const matching = document.querySelectorAll(`[class*="${keyword}"]`);
        if (matching.length > 0) {
          result.special_classes[keyword] = {
            count: matching.length,
            samples: Array.from(matching)
              .slice(0, 2)
              .map((el) => ({
                tag: el.tagName,
                text: el.textContent?.substring(0, 100),
                className: el.className,
              })),
          };
        }
      });

      return result;
    });

    console.log(JSON.stringify(dataStructures, null, 2));

    await browser.close();

    return {
      success: true,
      moviesData,
      textAnalysis,
      dataStructures,
    };
  } catch (err) {
    console.error('Erro durante análise:', err);
    await browser.close();
    throw err;
  }
}

// Executa se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeDetailedPrices({ headless: !process.argv.includes('--show') })
    .then(() => {
      console.log('\nAnálise concluída!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Falha:', err);
      process.exit(1);
    });
}

export default analyzeDetailedPrices;
