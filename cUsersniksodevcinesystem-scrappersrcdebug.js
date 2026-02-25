import { chromium } from 'playwright';

const CINEMA_URL = 'https://www.ingresso.com/cinema/cinesystem-maceio?city=maceio';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  try {
    const page = await context.newPage();
    await page.goto(CINEMA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const html = await page.content();
    const fs = await import('fs').then(m => m.promises);
    
    await fs.writeFile('html_raw.html', html, 'utf-8');
    
    const allText = await page.evaluate(() => document.body.innerText);
    await fs.writeFile('page_text.txt', allText, 'utf-8');
    
    // Análise de estrutura
    const structure = await page.evaluate(() => {
      const titles = [];
      
      // Procurar por h2, h3, h4
      document.querySelectorAll('h2, h3, h4').forEach(el => {
        titles.push({
          tag: el.tagName,
          text: el.textContent.trim(),
          class: el.className
        });
      });
      
      // Procurar por elementos com "movie"
      document.querySelectorAll('[class*="movie"], [class*="Movie"], [data-testid*="movie"]').forEach(el => {
        titles.push({
          tag: el.tagName,
          text: el.textContent.trim().substring(0, 100),
          class: el.className,
          selector: 'movie-class'
        });
      });
      
      return titles.filter(t => t.text.length > 5);
    });
    
    console.log('Estrutura encontrada:');
    console.log(JSON.stringify(structure, null, 2));
    
    console.log('\nHTML salvo em: html_raw.html');
    console.log('Texto da página salvo em: page_text.txt');
    
    await browser.close();
  } catch (err) {
    console.error('Erro:', err);
    await browser.close();
    process.exit(1);
  }
}

debug();
