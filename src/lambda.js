#!/usr/bin/env node
/**
 * AWS Lambda entry point — Telegram webhook mode.
 *
 * Substitui o polling (`src/bot.js`) por API Gateway HTTP API + Lambda.
 * O Telegram envia POSTs para a URL do API Gateway → esta Lambda processa
 * o update via `bot.processUpdate()`.
 *
 * Handlers exportados:
 *   - handler()     → invocado pelo API Gateway (webhook)
 *   - warmHandler() → invocado pelo EventBridge (cron diário, cache warming)
 *
 * Uso:
 *   sam build && sam deploy --guided
 *   (ou) npm run bot:listen  ← modo polling local (src/bot.js)
 */

import TelegramBot from 'node-telegram-bot-api';
import { config } from 'dotenv';
import NormalizedCache from './cache.js';
import { registerHandlers } from './handlers.js';
import { fetchNormalized, fetchUpcoming } from './api.js';

// Carrega .env em desenvolvimento local (sam local invoke)
config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN não configurado');
}

// Bot em modo webhook (sem polling, sem servidor HTTP interno)
const bot = new TelegramBot(token, { polling: false });
const cache = new NormalizedCache();

// Estado de cold start — evita re-inicializar handlers a cada invoke (warm)
let initialized = false;

async function initialize() {
  if (initialized) return;
  initialized = true;
  await cache.load();
  await registerHandlers(bot, cache);

  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await bot.setWebHook(webhookUrl);
      console.log(`✅ Webhook definido: ${webhookUrl}`);
    } catch (err) {
      console.warn('⚠️  Erro ao definir webhook:', err.message);
    }
  }
}

/**
 * Handler principal — invocado pelo API Gateway a cada update do Telegram.
 *
 * @param {object} event - Evento do API Gateway HTTP API (event.body = JSON string)
 * @returns {object} Resposta HTTP 200/500
 */
export async function handler(event) {
  await initialize();
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    await bot.processUpdate(body);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('❌ Erro no handler:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}

/**
 * Handler de cache warming — invocado pelo EventBridge (cron diário).
 *
 * Pré-carrega sessões e lançamentos para todos os teatros suportados,
 * salvando no S3 (ou data/cache.json localmente).
 * Evita cold-start fetch e garante dados frescos à meia-noite em Maceió.
 *
 * @returns {object} Resposta 200
 */
export async function warmHandler() {
  await initialize();

  const THEATERS = ['1162', '1230', '924']; // Cinesystem, Centerplex, Kinoplex
  let totalMovies = 0;

  for (const theaterId of THEATERS) {
    try {
      const normalized = await fetchNormalized(null, theaterId);
      cache.mergeMovies(normalized.movies);
      await cache.setSessions(
        normalized.date,
        normalized.sessions,
        normalized.fetchedAt,
        theaterId,
      );
      totalMovies += Object.keys(normalized.movies).length;
    } catch (err) {
      console.error(`❌ Erro ao atualizar sessões do teatro ${theaterId}:`, err.message);
    }

    try {
      const result = await fetchUpcoming(theaterId);
      await cache.setUpcoming(result.items, result.fetchedAt, theaterId);
    } catch (err) {
      console.error(`❌ Erro ao atualizar lançamentos do teatro ${theaterId}:`, err.message);
    }
  }

  console.log(`✅ Cache warming concluído — ${totalMovies} filmes processados`);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, totalMovies }),
  };
}
