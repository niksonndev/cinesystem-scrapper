#!/usr/bin/env node
import 'dotenv/config';

/**
 * CLI e ponto de entrada para automação.
 * Uso:
 *   node src/index.js           → scrape, salva estado, mostra mudanças
 *   node src/index.js scrape    → só extrai e salva (sem rotacionar previous)
 *   node src/index.js check     → só compara estado atual com previous (sem scrape)
 *   node src/index.js telegram  → envia programação do dia para o Telegram (usa state salvo)
 *   node src/index.js telegram refresh → faz scrape, salva e envia para o Telegram
 *   node src/index.js run       → mesmo que padrão (para cron/automação)
 */

import { scrape } from './scraper.js';
import { loadState, loadPrevious, saveState, rotateState } from './storage.js';
import { detectChanges } from './changes.js';
import { sendProgramacao } from './telegram.js';

const command = process.argv[2] || 'run';
const subArg = process.argv[3];

async function main() {
  if (command === 'scrape') {
    console.log('Extraindo programação...');
    const result = await scrape({ headless: true });
    await saveState({ movies: result.movies, scrapedAt: result.scrapedAt });
    console.log('Salvo em data/state.json');
    console.log('Filmes:', result.movies.length);
    if (result.noSessions) console.log('(Página indicou: sem sessões no momento)');
    result.movies.forEach(m => {
      console.log(`  - ${m.name}: ${m.sessions.length} sessão(ões)`, m.sessions.length ? m.sessions.join(', ') : '');
    });
    return;
  }

  if (command === 'check') {
    const current = await loadState();
    const previous = await loadPrevious();
    if (!current) {
      console.log('Nenhum estado salvo. Rode primeiro: node src/index.js scrape');
      return;
    }
    const diff = detectChanges(previous, current);
    console.log('Mudanças:', diff.summary);
    if (diff.addedMovies.length) console.log('Filmes novos:', diff.addedMovies);
    if (diff.removedMovies.length) console.log('Filmes removidos:', diff.removedMovies);
    if (diff.addedSessions.length) console.log('Sessões adicionadas:', diff.addedSessions);
    if (diff.removedSessions.length) console.log('Sessões removidas:', diff.removedSessions);
    return;
  }

  if (command === 'telegram') {
    let state = null;
    if (subArg === 'refresh') {
      console.log('Atualizando programação...');
      const result = await scrape({ headless: true });
      state = { movies: result.movies, scrapedAt: result.scrapedAt };
      await saveState(state);
      console.log('Estado salvo.');
    } else {
      state = await loadState();
    }
    if (!state) {
      console.error('Nenhum estado salvo. Rode: node src/index.js scrape   ou   node src/index.js telegram refresh');
      process.exit(2);
    }
    const result = await sendProgramacao(state);
    if (result.ok) {
      console.log('Programação enviada para o Telegram.');
    } else {
      console.error('Erro ao enviar para o Telegram:', result.error);
      process.exit(2);
    }
    return;
  }

  // run (default): scrape, rotate previous, save new state, report changes
  console.log('Extraindo programação e verificando mudanças...');
  const result = await scrape({ headless: true });
  const previous = await loadPrevious();
  const current = { movies: result.movies, scrapedAt: result.scrapedAt };

  await rotateState(current);
  const diff = detectChanges(
    previous ? { movies: previous.movies } : null,
    { movies: result.movies },
  );

  console.log('Resultado:', result.movies.length, 'filme(s)');
  if (result.noSessions) console.log('(Página indicou: sem sessões no momento)');
  result.movies.forEach(m => {
    console.log(`  - ${m.name}: ${m.sessions.length} sessão(ões)`, m.sessions.length ? m.sessions.join(', ') : '');
  });
  console.log('\nMudanças:', diff.summary);
  if (diff.hasChanges) {
    if (diff.addedMovies.length) console.log('  Filmes novos:', diff.addedMovies);
    if (diff.removedMovies.length) console.log('  Filmes removidos:', diff.removedMovies);
    if (diff.addedSessions.length) console.log('  Sessões adicionadas:', diff.addedSessions);
    if (diff.removedSessions.length) console.log('  Sessões removidas:', diff.removedSessions);
  }

  // Para automação: exit code 0 = sem mudanças, 1 = houve mudanças (ex.: notificação)
  if (diff.hasChanges) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
