/**
 * Inspector de Preços - Analisa a estrutura HTML dos preços de ingressos
 * Executa: node src/price-inspector.js
 */

const CINEMA_URL = 'https://www.ingresso.com/cinema/cinesystem-maceio';

export async function inspectPrices(options = {}) {
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({
    headless: options.headless !== false,
    // Se headless === false, abre a janela do navegador
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  try {
    const page = await context.newPage();

    console.log('\n--- ABRINDO PÁGINA ---');
    await page.goto(CINEMA_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Aguarda a página estabilizar
    await page.waitForTimeout(2000);

    console.log('Página carregada com sucesso!');

    // Inspeciona a estrutura de preços
    const priceAnalysis = await page.evaluate(() => {
      console.log('Iniciando análise de preços...');

      // 1. Procura por elementos que contenham valores monetários (R$)
      const bodyText = document.body.innerText;
      const priceMatches = bodyText.match(/R?\$\s*[\d.,]+/g) || [];
      console.log(
        `Encontrados ${priceMatches.length} valores monetários no texto`,
      );

      // 2. Procura por elementos com class/id/data relacionados a preço
      const priceSelectors = [
        '[class*="price"]',
        '[class*="Price"]',
        '[class*="valor"]',
        '[class*="Valor"]',
        '[id*="price"]',
        '[id*="Price"]',
        '[data-testid*="price"]',
        '[data-testid*="Price"]',
      ];

      const priceElements = {};
      for (const selector of priceSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            priceElements[selector] = {
              count: elements.length,
              samples: Array.from(elements)
                .slice(0, 3)
                .map((el) => ({
                  tag: el.tagName,
                  text:
                    el.innerText?.substring(0, 100) ||
                    el.textContent?.substring(0, 100),
                  html: el.outerHTML.substring(0, 200),
                })),
            };
          }
        } catch (e) {
          // Ignore selector errors
        }
      }

      // 3. Procura por botões/elementos que pareçam ser de compra
      const buySelectors = [
        'button:contains("compra")',
        '[class*="buy"]',
        '[class*="ingresso"]',
        '[class*="ticket"]',
        'button',
      ];

      const buttons = document.querySelectorAll('button');
      const buyButtons = Array.from(buttons)
        .filter((btn) => {
          const text = btn.innerText?.toLowerCase() || '';
          return (
            text.includes('compra') ||
            text.includes('ingresso') ||
            text.includes('comprar')
          );
        })
        .map((btn) => ({
          text: btn.innerText?.substring(0, 100),
          classes: btn.className,
          html: btn.outerHTML.substring(0, 300),
        }))
        .slice(0, 5);

      // 4. Procura por estruturas de cards de filmes
      const movieCards = {};
      const cardSelectors = [
        '[class*="bg-ing-neutral"]',
        '[class*="movie"]',
        '[class*="film"]',
        '[class*="card"]',
        'article',
        'section',
      ];

      for (const selector of cardSelectors) {
        try {
          const cards = document.querySelectorAll(selector);
          if (cards.length >= 2 && cards.length <= 20) {
            const sample = cards[0];
            movieCards[selector] = {
              count: cards.length,
              html: sample.outerHTML.substring(0, 500),
              innerText: sample.innerText?.substring(0, 300),
            };
          }
        } catch (e) {
          // Ignore
        }
      }

      // 5. Procura por estrutura específica de sessão/preço
      const sessionStructure = {};

      // Verifica se há elementos que pareçam ser sessões com preço
      const allDivs = document.querySelectorAll('div, button, span');
      const pricePatterns = [];

      for (const el of allDivs) {
        const text = el.innerText || el.textContent || '';
        // Procura por padrões como "10:00 - R$ 50,00"
        if (
          /\d{1,2}:\d{2}.*R?\$|\d{1,2}:\d{2}.*[\d.,]+/.test(text) &&
          text.length < 200
        ) {
          pricePatterns.push({
            text: text,
            tag: el.tagName,
            classes: el.className,
            parent: el.parentElement?.tagName,
            parentClasses: el.parentElement?.className,
          });
        }
      }

      return {
        pageTitle: document.title,
        priceMatches: [...new Set(priceMatches)].slice(0, 20),
        priceElements,
        buyButtons,
        movieCards,
        pricePatterns: pricePatterns.slice(0, 10),
        totalElements: document.querySelectorAll('*').length,
        hasIngressoContent: bodyText.includes('ingresso'),
      };
    });

    // 6. Inspeciona DOM estruturado
    const structuredHTML = await page.evaluate(() => {
      // Procura por estruturas de filme + preço
      const analysis = [];

      // Estratégia 1: Procura por elementos h2/h3 (títulos) próximos a preços
      const titles = document.querySelectorAll('h2, h3');

      for (const title of titles) {
        const titleText = title.innerText?.trim() || '';

        // Se parece ser um título de filme
        if (titleText.length > 3 && titleText.length < 100) {
          const parent = title.closest(
            'div, section, article, [class*="card"]',
          );

          if (parent) {
            const parentHTML = parent.outerHTML;
            const parentText = parent.innerText || '';

            // Procura por preços dentro do container
            const priceMatches =
              parentText.match(/R?\$\s*[\d.,]+|[\d.,]+\s*r/gi) || [];

            if (priceMatches.length > 0 || titleText) {
              analysis.push({
                title: titleText,
                prices: priceMatches,
                containerHTML: parentHTML.substring(0, 1000),
                containerText: parentText.substring(0, 500),
              });
            }
          }
        }
      }

      return {
        moviePriceStructures: analysis.slice(0, 5),
      };
    });

    console.log('\n--- RESULTADO DA ANÁLISE ---\n');
    console.log(JSON.stringify(priceAnalysis, null, 2));
    console.log('\n--- ESTRUTURA DE FILME + PREÇO ---\n');
    console.log(JSON.stringify(structuredHTML, null, 2));

    // 7. Faz screenshot para visualização
    if (options.screenshot !== false) {
      const screenshotPath = './data/price-inspection.png';
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`\nScreenshot salvo em: ${screenshotPath}`);
    }

    // 8. Salva o HTML completo para inspeção
    const htmlPath = './data/page-structure.html';
    const pageHTML = await page.content();
    const fs = await import('fs').then((m) => m.promises);
    await fs.writeFile(htmlPath, pageHTML);
    console.log(`HTML completo salvo em: ${htmlPath}`);

    await browser.close();

    return {
      priceAnalysis,
      structuredHTML,
      success: true,
    };
  } catch (err) {
    console.error('Erro durante inspeção:', err);
    await browser.close();
    throw err;
  }
}

// Executa se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const headless = process.argv.includes('--headless') !== false;
  console.log(`Iniciando inspeção de preços (headless: ${headless})...`);
  inspectPrices({ headless: !process.argv.includes('--show') })
    .then(() => {
      console.log('\nAnálise concluída!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Falha na análise:', err);
      process.exit(1);
    });
}

export default inspectPrices;
