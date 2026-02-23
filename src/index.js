#!/usr/bin/env node

/**
 * CLI para scraping de programação do Cinesystem Maceió.
 * Uso:
 *   node src/index.js scrape [data]              → extrai filmes + sessões (API)
 *   node src/index.js scrape prices [data]       → extrai filmes + sessões + preços
 *   node src/index.js scrape prices debug [data] → com navegador visual para debugar
 *
 * Exemplos:
 *   node src/index.js scrape                         → hoje, sem preços (0.1s)
 *   node src/index.js scrape prices                 → hoje, com preços (68s)
 *   node src/index.js scrape 23/02/2026             → data específica, sem preços
 *   node src/index.js scrape prices 23/02/2026      → data específica, com preços
 *   node src/index.js scrape prices debug           → com navegador visual
 *   node src/index.js scrape prices debug 23/02/2026 → com navegador visual + data
 */

import { scrape } from './scraper.js';
import fs from 'fs/promises';

const command = process.argv[2];
const subArg = process.argv[3];

async function saveState(data) {
  const stateFile = 'data/state.json';
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(data, null, 2));
}

async function main() {
  if (!command || command === 'scrape') {
    const withPrices = subArg === 'prices';
    const debugMode = process.argv[4] === 'debug';
    const date = withPrices
      ? debugMode
        ? process.argv[5]
        : process.argv[4]
      : subArg;

    console.log('Extraindo programação...');
    if (withPrices) console.log('(com extração de preços)');
    if (debugMode) console.log('🔍 Modo DEBUG: Navegador visual será exibido');

    const result = await scrape({
      headless: debugMode ? false : true,
      date,
      extractPrices: withPrices,
    });

    if (date && !withPrices) {
      console.log(`Programação para: ${date}`);
    }

    await saveState({ movies: result.movies, scrapedAt: result.scrapedAt });
    console.log('Salvo em data/state.json');
    console.log('Filmes:', result.movies.length);

    if (result.noSessions) {
      console.log('(Página indicou: sem sessões no momento)');
    }

    result.movies.forEach((m) => {
      const sessionsList = m.sessions
        .map((s) => {
          if (typeof s === 'string') return s;
          let str = s.time || '';
          if (s.priceInteira !== undefined) {
            str += ` (R$ ${s.priceInteira.toFixed(2)})`;
          }
          if (s.priceMeia !== undefined) {
            str += ` / meia: R$ ${s.priceMeia.toFixed(2)}`;
          }
          return str;
        })
        .join(', ');
      console.log(`  - ${m.name}: ${m.sessions.length} sessão(ões)`);
      console.log(`    ${sessionsList}`);
    });
    return;
  }

  console.error(`Comando desconhecido: ${command}`);
  console.error('Use: node src/index.js scrape [prices] [data]');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
