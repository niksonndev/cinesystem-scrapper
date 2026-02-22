import { chromium } from 'playwright';

const CINEMA_URL = 'https://www.ingresso.com/cinema/cinesystem-maceio';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(CINEMA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Fecha modal de localização se existir
  const locationModal = await page.$('[role="dialog"]');
  if (locationModal) {
    console.log('Fechando modal de localização...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  //Encontra botão de preço específico
  const priceBtn = await page.$('button[aria-label="Abrir modal de preços"]');
  if (priceBtn) {
    console.log('Encontrou botão de preço, clicando...');
    await priceBtn.click();
    await page.waitForTimeout(1200);

    // Examina modal
    const modalText = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return 'Modal não encontrado';
      return modal.innerText;
    });

    console.log('--- CONTEÚDO DO MODAL ---');
    console.log(modalText);
    console.log('--- FIM ---');
  } else {
    console.log('Botão de preço não encontrado');
  }

  await browser.close();
}

test().catch(console.error);
