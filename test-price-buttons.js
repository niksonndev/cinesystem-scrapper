import { chromium } from 'playwright';

const CINEMA_URL = 'https://www.ingresso.com/cinema/cinesystem-maceio';

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(CINEMA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const priceButtons = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll('button[aria-label*="preço"]'),
    );
    console.log(`Encontrados ${buttons.length} botões com aria-label*="preço"`);

    // Procura por outros seletores
    const allButtons = Array.from(document.querySelectorAll('button'));
    const priceRelated = allButtons.filter(
      (b) =>
        b.getAttribute('aria-label')?.toLowerCase().includes('preço') ||
        b.getAttribute('aria-label')?.toLowerCase().includes('price') ||
        b.getAttribute('aria-label')?.toLowerCase().includes('modal'),
    );

    return {
      totalButtons: allButtons.length,
      priceButtonsAria: buttons.length,
      priceRelated: priceRelated.length,
      samples: priceRelated.slice(0, 3).map((b) => ({
        tag: 'button',
        ariaLabel: b.getAttribute('aria-label'),
        classes: b.className.slice(0, 50),
      })),
    };
  });

  console.log(JSON.stringify(priceButtons, null, 2));
  await browser.close();
}

test().catch(console.error);
