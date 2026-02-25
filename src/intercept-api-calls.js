/**
 * Intercepta requisições de API para encontrar endpoint de preços
 * Executa: node src/intercept-api-calls.js
 */

const CINEMA_URL = 'https://www.ingresso.com/cinema/cinesystem-maceio';

export async function interceptAPIcalls(options = {}) {
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
    const interceptedRequests = [];

    // Monitora todas as requisições de rede
    page.on('response', async (response) => {
      const url = response.url();

      // Filtra apenas requisições relevantes (API, não assets)
      if (
        (url.includes('api') ||
          url.includes('graphql') ||
          url.includes('price') ||
          url.includes('session') ||
          url.includes('ingresso')) &&
        !url.includes('.css') &&
        !url.includes('.js') &&
        !url.includes('.png') &&
        !url.includes('.jpg') &&
        !url.includes('.webp')
      ) {
        try {
          const status = response.status();
          const contentType = response.headers()['content-type'] || '';

          interceptedRequests.push({
            url: url.substring(0, 200),
            method: response.request().method(),
            status,
            contentType,
            timestamp: new Date().toISOString(),
          });

          // Se é JSON, tenta capturar a resposta (limitado para não sobrecarregar)
          if (contentType.includes('json') && status === 200) {
            try {
              const text = await response.text();
              if (text.length < 5000) {
                // Evita respostas muito grandes
                console.log(`\n[API Response]`);
                console.log(`URL: ${url.substring(0, 150)}`);
                console.log(`Resposta (primeiros 500 chars):`);
                console.log(text.substring(0, 500));
              }
            } catch (e) {
              // Ignora erros na leitura de resposta
            }
          }
        } catch (e) {
          // Ignora erros
        }
      }
    });

    console.log('\n=== INTERCEPTANDO CHAMADAS DE API ===\n');
    console.log('Abrindo página...');
    await page.goto(CINEMA_URL, { waitUntil: 'networkidle', timeout: 30000 });

    console.log('Página carregada! Aguardando requisições pendentes...');
    await page.waitForTimeout(3000);

    console.log('\n--- RESUMO DE REQUISIÇÕES INTERCEPTADAS ---\n');
    console.log(
      `Total de requisições capturadas: ${interceptedRequests.length}\n`,
    );

    // Agrupa por tipo de URL
    const byCategory = {};
    for (const req of interceptedRequests) {
      const category = req.url.split('/')[2]; // Host
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(req);
    }

    for (const [category, reqs] of Object.entries(byCategory)) {
      console.log(`\n${category}:`);
      reqs.forEach((req) => {
        console.log(`  [${req.status}] ${req.method} ${req.url}`);
      });
    }

    // Salva relatório
    const fs = await import('fs').then((m) => m.promises);
    await fs.writeFile(
      './data/api-calls-intercepted.json',
      JSON.stringify(interceptedRequests, null, 2),
    );

    console.log('\n\nRelatório salvo em: ./data/api-calls-intercepted.json');

    await browser.close();

    return interceptedRequests;
  } catch (err) {
    console.error('Erro:', err);
    await browser.close();
    throw err;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  interceptAPIcalls({ headless: !process.argv.includes('--show') })
    .then(() => {
      console.log('\nMonitoramento concluído!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Falha:', err);
      process.exit(1);
    });
}

export default interceptAPIcalls;
