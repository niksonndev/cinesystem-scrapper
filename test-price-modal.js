import { chromium } from 'playwright';

const CINEMA_URL = 'https://www.ingresso.com/cinema/cinesystem-maceio';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(CINEMA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Encontra primeiro botão de preço e clica
  const priceBtn = await page.$('button[aria-label*="preço"]');
  if (priceBtn) {
    console.log('Clicando no botão de preço...');
    await priceBtn.click();
    await page.waitForTimeout(1000);

    // Examina modal
    const modalText = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return 'Modal não encontrado';
      return modal.innerText;
    });

    console.log('--- CONTEÚDO DO MODAL ---');
    console.log(modalText);
    console.log('--- FIM ---');
  }

  await browser.close();
}

test().catch(console.error);
