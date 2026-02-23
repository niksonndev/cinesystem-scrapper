#!/usr/bin/env node

/**
 * CLI para consultar a programação do Cinesystem Maceió via API oficial.
 *
 * Uso:
 *   node src/index.js [data]
 *
 * Exemplos:
 *   node src/index.js                 → hoje (segundo API / fuso de Maceió)
 *   node src/index.js 23/02/2026      → data específica (DD/MM/YYYY)
 */

import fs from 'fs/promises';
import { getMoviesWithPrices } from './api.js';

async function saveState(data) {
  const stateFile = 'data/state.json';
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(data, null, 2));
}

async function main() {
  const date = process.argv[2] || null;

  console.log('📡 Consultando programação do Cinesystem Maceió via API...');
  if (date) {
    console.log(`📅 Data solicitada: ${date} (DD/MM/YYYY)`);
  } else {
    console.log('📅 Nenhuma data informada, usando data atual da API.');
  }

  const movies = await getMoviesWithPrices(date);
  const scrapedAt = new Date().toISOString();

  await saveState({ movies, scrapedAt });
  console.log('✅ Resultado salvo em data/state.json');
  console.log(`📽️  Filmes: ${movies.length}`);

  if (!movies || movies.length === 0) {
    console.log('⚠️  Nenhuma sessão encontrada para esta data');
    return;
  }

  movies.forEach((m) => {
    const sessionsList = (m.sessions || [])
      .map((s) => {
        if (typeof s === 'string') return s;
        let str = s.time || '';
        if (s.priceInteira !== undefined && s.priceInteira !== null) {
          str += ` (R$ ${Number(s.priceInteira).toFixed(2)})`;
        }
        if (s.priceMeia !== undefined && s.priceMeia !== null) {
          str += ` / meia: R$ ${Number(s.priceMeia).toFixed(2)})`;
        }
        return str;
      })
      .join(', ');
    console.log(`  🎬 ${m.name}: ${(m.sessions || []).length} sessão(ões)`);
    console.log(`     ${sessionsList}`);
  });
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(2);
});
