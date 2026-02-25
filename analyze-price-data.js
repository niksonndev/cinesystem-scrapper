import { chromium } from 'playwright';

const CINEMA_URL = 'https://www.ingresso.com/cinema/cinesystem-maceio';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(CINEMA_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  // Analisa o DOM para encontrar dados de preço sem clicar
  const priceData = await page.evaluate(() => {
    // Procura por buttons de preço e analisa estrutura parent
    const priceButtons = document.querySelectorAll(
      'button[aria-label*="preço"]',
    );
    const analysis = {
      totalButtons: priceButtons.length,
      buttonStructure: [],
      sessionLinks: [],
    };

    // Analisa primeiro botão para entender a estrutura
    if (priceButtons.length > 0) {
      const btn = priceButtons[0];
      const card = btn.closest('[class*="bg-ing-neutral-600"]');

      if (card) {
        // Procura por elementos que possam conter preço
        const possiblePriceElements = card.querySelectorAll(
          '[class*="price"], [class*="Price"], span, p, div',
        );
        const textContent = card.innerText.slice(0, 300);

        analysis.buttonStructure = {
          parentCardFound: !!card,
          cardClass: card.className.slice(0, 50),
          possiblePriceElements: possiblePriceElements.length,
          textPreview: textContent,
          hasVisiblePrice: textContent.includes('R$'),
        };
      }

      // Procura links de sessão no card
      const card2 = btn.closest('[class*="bg-ing-neutral-600"]');
      if (card2) {
        const links = card2.querySelectorAll('a[href*="sessionId"]');
        analysis.sessionLinks = links.length;
      }
    }

    return analysis;
  });

  console.log('=== ANÁLISE DE ESTRUTURA ===');
  console.log(JSON.stringify(priceData, null, 2));

  await browser.close();
}

test().catch(console.error);
