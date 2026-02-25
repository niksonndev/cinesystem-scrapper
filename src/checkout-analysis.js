/**
 * Análise de URLs e preços - extrai URLs de checkout
 */

const CINEMA_URL = 'https://www.ingresso.com/cinema/cinesystem-maceio';

export async function analyzeCheckoutURLs(options = {}) {
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

    console.log('\n=== ANÁLISE DE URLs E PREÇOS ===\n');
    await page.goto(CINEMA_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Extrai todas as URLs de checkout e informações de sessão
    const checkoutData = await page.evaluate(() => {
      const sessions = [];

      const links = document.querySelectorAll(
        'a[href*="checkout.ingresso.com"]',
      );

      for (const link of links) {
        const href = link.getAttribute('href');
        const text = link.innerText.trim();
        const parent = link.closest('div[class*="bg-ing-neutral"]');

        let movieTitle = 'Unknown';
        if (parent) {
          const titleEl = parent.querySelector('h3 a, h2 a');
          if (titleEl) movieTitle = titleEl.textContent.trim();
        }

        // Extrai sessionId da URL
        const sessionMatch = href.match(/sessionId=(\d+)/);
        const sessionId = sessionMatch ? sessionMatch[1] : null;

        sessions.push({
          movieTitle,
          time: text,
          sessionId,
          fullURL: href,
        });
      }

      return { total_sessions: sessions.length, sessions };
    });

    console.log('--- URLs DE CHECKOUT ENCONTRADAS ---\n');
    console.log(`Total de sessões: ${checkoutData.total_sessions}\n`);

    // Agrupa por filme
    const byMovie = {};
    for (const session of checkoutData.sessions) {
      if (!byMovie[session.movieTitle]) {
        byMovie[session.movieTitle] = [];
      }
      byMovie[session.movieTitle].push(session);
    }

    // Mostra informações estruturadas
    console.log('--- ESTRUTURA DE FILME + SESSÃO + URL ---\n');
    for (const [movie, sessions] of Object.entries(byMovie)) {
      console.log(`Filme: ${movie}`);
      sessions.forEach((s) => {
        console.log(`  Horário: ${s.time}`);
        console.log(`  Session ID: ${s.sessionId}`);
        console.log(`  URL: ${s.fullURL}`);
        console.log('');
      });
    }

    // Agora visita uma página de checkout para ver se os preços aparecem
    if (checkoutData.sessions.length > 0) {
      console.log(
        '\n--- VISITANDO PÁGINA DE CHECKOUT PARA EXTRAIR PREÇOS ---\n',
      );
      const firstSession = checkoutData.sessions[0];
      const checkoutURL = firstSession.fullURL;

      console.log(`Visitando: ${checkoutURL.substring(0, 80)}...`);

      await page
        .goto(checkoutURL, { waitUntil: 'networkidle', timeout: 30000 })
        .catch(() => {});

      await page.waitForTimeout(2000);

      const checkoutPageData = await page.evaluate(() => {
        const data = {
          page_title: document.title,
          url: window.location.href,
          bodyText: document.body.innerText.substring(0, 2000),
          movieTitle: '',
          sessionTime: '',
          prices: [],
        };

        // Procura por padrões de preço
        const pricePatterns = [/R\$\s*[\d.,]+/g, /(\d+),(\d{2})/g];

        const allText = document.body.innerText;
        for (const pattern of pricePatterns) {
          const matches = allText.match(pattern);
          if (matches) {
            data.prices.push(...new Set(matches));
          }
        }

        // Procura por "meia" ou "inteira"
        if (allText.includes('meia')) data.has_meia = true;
        if (allText.includes('inteira')) data.has_inteira = true;
        if (allText.includes('estudante')) data.has_estudante = true;

        return data;
      });

      console.log('\n--- DADOS DA PÁGINA DE CHECKOUT ---');
      console.log(`Título da página: ${checkoutPageData.page_title}`);
      console.log(`URL: ${checkoutPageData.url}`);
      console.log(`Tem "MEIA": ${checkoutPageData.has_meia}`);
      console.log(`Tem "INTEIRA": ${checkoutPageData.has_inteira}`);
      console.log(`Tem "ESTUDANTE": ${checkoutPageData.has_estudante}`);
      console.log(
        `\nPreços encontrados: ${JSON.stringify(checkoutPageData.prices, null, 2)}`,
      );
      console.log(`\nPrimeiros 500 caracteres do texto:`);
      console.log(checkoutPageData.bodyText);
    }

    // Salva o resultado em JSON
    const fs = await import('fs').then((m) => m.promises);
    await fs.writeFile(
      './data/checkout-analysis.json',
      JSON.stringify(checkoutData, null, 2),
    );
    console.log('\n\nDados salvos em: ./data/checkout-analysis.json');

    await browser.close();

    return checkoutData;
  } catch (err) {
    console.error('Erro:', err);
    await browser.close();
    throw err;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeCheckoutURLs({ headless: !process.argv.includes('--show') })
    .then(() => {
      console.log('\nAnálise concluída!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Falha:', err);
      process.exit(1);
    });
}

export default analyzeCheckoutURLs;
