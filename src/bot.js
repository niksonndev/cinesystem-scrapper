#!/usr/bin/env node

/**
 * Bot Telegram Reativo - Modo Polling
 * Suporta múltiplas redes de cinema em Maceió
 * Uso: npm run bot:listen
 */

import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import { config } from 'dotenv';
import { fetchNormalized, fetchUpcoming } from './api.js';
import { denormalize } from './normalize.js';
import NormalizedCache from './cache.js';
import { getMovieRatings, formatRatingsLine } from './ratings.js';

config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN não configurado no .env');
}

const bot = new TelegramBot(token, {
  polling: {
    interval: 1000,
    params: { timeout: 30 },
  },
});

const PORT = process.env.PORT || 10000;
const app = express();
let server;
const cache = new NormalizedCache();

// --- Configuração de cinemas ---

const CINEMAS = [
  { id: '1162', name: 'Cinesystem', label: 'Cinesystem (Parque Shopping Maceió)', url: 'https://www.ingresso.com/cinema/cinesystem-maceio?city=maceio' },
  { id: '1230', name: 'Centerplex', label: 'Centerplex (Shopping Pátio Maceió)', url: 'https://www.ingresso.com/cinema/centerplex-shopping-patio-maceio?city=maceio' },
  { id: '924', name: 'Kinoplex', label: 'Kinoplex (Maceió Shopping)', url: 'https://www.ingresso.com/cinema/kinoplex-maceio?city=maceio' },
];

// Preferência de cinema por usuário (chatId → theaterId)
const userPreferences = new Map();

function getUserCinema(chatId) {
  const theaterId = userPreferences.get(chatId);
  if (!theaterId) return null;
  return CINEMAS.find((c) => c.id === theaterId) || null;
}

const getCinemaKeyboard = () => ({
  inline_keyboard: CINEMAS.map((c) => [
    { text: c.label, callback_data: `cinema_${c.id}` },
  ]),
});

function askCinemaFirst(chatId) {
  return bot.sendMessage(
    chatId,
    '⚠️ Você ainda não escolheu um cinema. Escolha abaixo qual cinema deseja consultar:',
    { reply_markup: getCinemaKeyboard() },
  );
}

// --- Health check ---

app.get('/', (req, res) => {
  const mem = process.memoryUsage();
  const memMB = {
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2),
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2),
    rss: (mem.rss / 1024 / 1024).toFixed(2),
  };
  console.log('📡 Health check recebido (Render)', memMB);
  res.json({
    status: '✅ Bot está online!',
    timestamp: new Date().toISOString(),
    memory: memMB,
  });
});

// --- Helpers ---

const getDateString = (daysOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
};

async function getMoviesForDate(date = null, theaterId = '1162') {
  const targetDate = date || getDateString(0);

  const cached = cache.getSessions(targetDate, theaterId);
  if (cached) {
    const movies = denormalize(cache.getAllMovies(), cached.items);
    return { movies, date: targetDate, fromCache: true };
  }

  const normalized = await fetchNormalized(date, theaterId);
  cache.mergeMovies(normalized.movies);
  cache.setSessions(normalized.date, normalized.sessions, normalized.fetchedAt, theaterId);

  const movies = denormalize(normalized.movies, normalized.sessions);
  return { movies, date: normalized.date, fromCache: false };
}

async function getUpcomingMovies(theaterId = '1162') {
  const cached = cache.getUpcoming(theaterId);
  if (cached) {
    return { items: cached.items, fromCache: true };
  }

  const result = await fetchUpcoming(theaterId);
  cache.setUpcoming(result.items, result.fetchedAt, theaterId);
  return { items: result.items, fromCache: false };
}

// --- Formatação ---

const FORMAT_LABELS = { '2D': '2D', 'Cinépic': 'Cinépic', 'VIP': 'VIP', '3D': '3D' };

const formatUpcomingForTelegram = async (items, cinemaLabel, limit = 10) => {
  if (!items || items.length === 0) {
    return '📭 *Nenhum lançamento próximo encontrado.*';
  }

  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Maceio' }),
  );
  const todayStr = now.toISOString().split('T')[0];

  const sliced = items.slice(0, limit);

  let message = `*🆕 PRÓXIMOS LANÇAMENTOS*\n📍 ${cinemaLabel}\n\n`;

  const ratingsPromises = sliced.map((movie) => getMovieRatings(movie.title));
  const ratingsList = await Promise.all(ratingsPromises);

  sliced.forEach((movie, index) => {
    const diffDays = Math.ceil(
      (new Date(movie.firstDate) - new Date(todayStr)) / 86400000,
    );

    let quando;
    if (diffDays === 1) {
      quando = `amanhã (${movie.firstDateFormatted})`;
    } else if (diffDays <= 7) {
      quando = `nesta *${movie.firstDateDayOfWeek}* (${movie.firstDateFormatted})`;
    } else {
      quando = `em ${movie.firstDateFormatted} (${movie.firstDateDayOfWeek})`;
    }

    const preSale = movie.inPreSale ? ' 🔥 PRÉ-VENDA' : '';
    const genreTag = movie.genres?.length ? ` _${movie.genres.join(', ')}_` : '';
    const formatTag = movie.formats?.length
      ? ` | ${movie.formats.map((f) => FORMAT_LABELS[f] || f).join(', ')}`
      : '';
    const priceTag = movie.priceFrom
      ? ` | A partir de R$ ${movie.priceFrom.toFixed(2).replace('.', ',')}`
      : '';

    message += `🎬 *${movie.title}*${preSale}\n`;
    const ratingsLine = formatRatingsLine(ratingsList[index]);
    if (ratingsLine) message += `   ${ratingsLine.trim()}\n`;
    message += `   📅 Estreia ${quando}\n`;
    message += `  ${genreTag}${formatTag}${priceTag}\n\n`;
  });

  if (items.length > limit) {
    message += `_...e mais ${items.length - limit} lançamento(s)._\n`;
  }

  return message;
};

const formatMoviesForTelegram = async (movies, dateStr, cinemaLabel) => {
  if (!movies || movies.length === 0) {
    return '📭 *Nenhum filme em cartaz para esta data.*';
  }

  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];

  let dataPt = 'data não disponível';
  if (dateStr && typeof dateStr === 'string') {
    const [year, month, day] = dateStr.split('-');
    if (year && month && day) {
      const monthIdx = parseInt(month) - 1;
      dataPt = `${parseInt(day)} de ${meses[monthIdx]} de ${year}`;
    }
  }

  let message = `*🎬 PROGRAMAÇÃO*\n📍 ${cinemaLabel}\n`;
  message += `📅 ${dataPt}\n\n`;

  const FORMAT_ICONS = { '2D': '🎞', 'Cinépic': '🖥', 'VIP': '⭐' };

  const ratingsPromises = movies.map((filme) => getMovieRatings(filme.name));
  const ratingsList = await Promise.all(ratingsPromises);

  movies.forEach((filme, index) => {
    message += `*🎭 ${filme.name}*\n`;
    const ratingsLine = formatRatingsLine(ratingsList[index]);
    if (ratingsLine) message += ratingsLine;

    if (!filme.sessions || filme.sessions.length === 0) {
      message += '\n';
      return;
    }

    const byFormat = new Map();
    for (const s of filme.sessions) {
      const key = s.format || '2D';
      if (!byFormat.has(key)) byFormat.set(key, []);
      byFormat.get(key).push(s);
    }

    for (const [format, sessions] of byFormat) {
      const icon = FORMAT_ICONS[format] || '🎬';
      const times = sessions.map((s) => s.time).join(', ');

      const ref = sessions.find((s) => s.priceInteira);
      let priceTag = '';
      if (ref?.gratuito) {
        priceTag = ' — Gratuito ✨';
      } else if (ref?.priceInteira) {
        priceTag = ` — R$ ${ref.priceInteira.toFixed(2).replace('.', ',')}`;
      }

      message += `   ${icon} *${format}:* ${times}${priceTag}\n`;
    }

    message += '\n';
  });

  return message;
};

// --- Keyboards e botões ---

function getBackButtonMarkup(cinemaUrl) {
  const rows = [];
  if (cinemaUrl) {
    rows.push([{ text: '🎫 Comprar Ingressos', url: cinemaUrl }]);
  }
  rows.push([
    { text: '⬅️ Voltar ao menu', callback_data: 'voltar_menu' },
    { text: '🔄 Trocar cinema', callback_data: 'trocar_cinema' },
  ]);
  return { inline_keyboard: rows };
}

function sendWithBackButton(chatId, text, cinemaUrl) {
  return bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: getBackButtonMarkup(cinemaUrl),
  });
}

const getMainKeyboard = () => ({
  inline_keyboard: [
    [
      { text: '🎬 Filmes de Hoje', callback_data: 'filmes_hoje' },
      { text: '📅 Filmes de Amanhã', callback_data: 'filmes_amanha' },
    ],
    [{ text: '🆕 Próximos Lançamentos', callback_data: 'proximos_lancamentos' }],
    [{ text: '🔄 Trocar de Cinema', callback_data: 'trocar_cinema' }],
  ],
});

// --- Configuração de comandos ---

const setCommands = async () => {
  try {
    await bot.setMyCommands([
      { command: 'start', description: 'Iniciar o bot e escolher cinema' },
      { command: 'hoje', description: 'Filmes em cartaz no cinema selecionado' },
      { command: 'proximos', description: 'Lançamentos futuros e pré-vendas' },
      { command: 'cinemas', description: 'Trocar de cinema selecionado' },
    ]);
    console.log('✅ Menu de comandos configurado');
  } catch (err) {
    console.error('❌ Erro ao configurar menu de comandos:', err.message);
  }
};

// --- Command Handlers ---

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    await bot.sendMessage(
      chatId,
      'Olá! Eu sou o seu guia de cinema em Maceió. 🍿\nEscolha abaixo qual cinema você deseja consultar:',
      { reply_markup: getCinemaKeyboard() },
    );
    console.log(`✅ /start enviado para ${msg.from.username || chatId}`);
  } catch (err) {
    console.error(`❌ Erro em /start para ${chatId}:`, err.message);
  }
});

bot.onText(/\/hoje/, async (msg) => {
  const chatId = msg.chat.id;
  const cinema = getUserCinema(chatId);
  if (!cinema) return askCinemaFirst(chatId);

  const loadingMsg = await bot.sendMessage(chatId, '⏳ Buscando filmes de hoje...');

  try {
    const { movies, date } = await getMoviesForDate(null, cinema.id);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await sendWithBackButton(chatId, await formatMoviesForTelegram(movies, date, cinema.label), cinema.url);
    console.log(`✅ /hoje enviado para ${msg.from.username || chatId} (${cinema.name})`);
  } catch (err) {
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, `❌ Erro ao buscar filmes: ${err.message}`);
    console.error(`❌ Erro em /hoje para ${chatId}:`, err.message);
  }
});

bot.onText(/\/proximos/, async (msg) => {
  const chatId = msg.chat.id;
  const cinema = getUserCinema(chatId);
  if (!cinema) return askCinemaFirst(chatId);

  const loadingMsg = await bot.sendMessage(chatId, '⏳ Buscando próximos lançamentos...');

  try {
    const { items } = await getUpcomingMovies(cinema.id);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await sendWithBackButton(chatId, await formatUpcomingForTelegram(items, cinema.label), cinema.url);
    console.log(`✅ /proximos enviado para ${msg.from.username || chatId} (${cinema.name}, ${items.length} filmes)`);
  } catch (err) {
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, `❌ Erro ao buscar lançamentos: ${err.message}`);
    console.error(`❌ Erro em /proximos para ${chatId}:`, err.message);
  }
});

bot.onText(/\/cinemas/, async (msg) => {
  const chatId = msg.chat.id;
  const current = getUserCinema(chatId);
  const text = current
    ? `🎬 Cinema atual: *${current.label}*\nEscolha outro cinema:`
    : '🎬 Escolha o cinema que deseja consultar:';

  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: getCinemaKeyboard(),
  });
});

bot.onText(/\/atualizar/, async (msg) => {
  const chatId = msg.chat.id;
  const cinema = getUserCinema(chatId);
  if (!cinema) return askCinemaFirst(chatId);

  const loadingMsg = await bot.sendMessage(chatId, '🔄 Atualizando programação de hoje...');

  try {
    const normalized = await fetchNormalized(null, cinema.id);
    cache.mergeMovies(normalized.movies);
    cache.setSessions(normalized.date, normalized.sessions, normalized.fetchedAt, cinema.id);

    const movies = denormalize(normalized.movies, normalized.sessions);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await sendWithBackButton(chatId, await formatMoviesForTelegram(movies, normalized.date, cinema.label), cinema.url);
    console.log(`✅ /atualizar enviado para ${msg.from.username || chatId} (${cinema.name})`);
  } catch (err) {
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, `❌ Erro ao atualizar: ${err.message}`);
    console.error(`❌ Erro em /atualizar para ${chatId}:`, err.message);
  }
});

// --- Callback Query Handler ---

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const callbackData = query.data;

  try {
    await bot.answerCallbackQuery(query.id);
  } catch (err) {
    console.error('❌ Erro ao responder callback:', err.message);
  }

  try {
    // Seleção de cinema
    if (callbackData.startsWith('cinema_')) {
      const theaterId = callbackData.replace('cinema_', '');
      const cinema = CINEMAS.find((c) => c.id === theaterId);
      if (!cinema) {
        await bot.sendMessage(chatId, '❌ Cinema não encontrado.');
        return;
      }

      userPreferences.set(chatId, theaterId);
      await bot.sendMessage(
        chatId,
        `✅ Cinema selecionado: *${cinema.label}*\n\nEscolha uma opção:`,
        { parse_mode: 'Markdown', reply_markup: getMainKeyboard() },
      );
      console.log(`🎬 ${query.from.username || chatId} selecionou ${cinema.name}`);
      return;
    }

    if (callbackData === 'trocar_cinema') {
      const current = getUserCinema(chatId);
      const text = current
        ? `🎬 Cinema atual: *${current.label}*\nEscolha outro cinema:`
        : '🎬 Escolha o cinema que deseja consultar:';
      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: getCinemaKeyboard(),
      });
      return;
    }

    // Callbacks de filmes exigem cinema selecionado
    const cinema = getUserCinema(chatId);
    if (!cinema) {
      await askCinemaFirst(chatId);
      return;
    }

    let response = '';

    switch (callbackData) {
      case 'filmes_hoje': {
        let loadingMsg = null;
        const cachedToday = cache.getSessions(getDateString(0), cinema.id);
        if (!cachedToday) {
          loadingMsg = await bot.sendMessage(
            chatId,
            '⏳ Buscando filmes de hoje... Aguarde um momento!',
          );
        }

        const today = await getMoviesForDate(null, cinema.id);
        if (loadingMsg) {
          await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        }

        response = await formatMoviesForTelegram(today.movies, today.date, cinema.label);
        break;
      }

      case 'filmes_amanha': {
        const tomorrowDate = getDateString(1);
        let loadingMsg = null;
        const cachedTomorrow = cache.getSessions(tomorrowDate, cinema.id);
        if (!cachedTomorrow) {
          loadingMsg = await bot.sendMessage(
            chatId,
            '⏳ Buscando filmes de amanhã... Aguarde um momento!',
          );
        }

        const tomorrow = await getMoviesForDate(tomorrowDate, cinema.id);
        if (loadingMsg) {
          await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        }

        response = await formatMoviesForTelegram(tomorrow.movies, tomorrow.date, cinema.label);
        break;
      }

      case 'proximos_lancamentos': {
        let loadingMsg = null;
        if (!cache.getUpcoming(cinema.id)) {
          loadingMsg = await bot.sendMessage(
            chatId,
            '⏳ Buscando próximos lançamentos...',
          );
        }

        const { items } = await getUpcomingMovies(cinema.id);
        if (loadingMsg) {
          await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        }

        response = await formatUpcomingForTelegram(items, cinema.label);
        break;
      }

      case 'voltar_menu': {
        await bot.sendMessage(
          chatId,
          `*🎬 ${cinema.label}*\n\nEscolha uma opção:`,
          { parse_mode: 'Markdown', reply_markup: getMainKeyboard() },
        );
        return;
      }

      case 'como_funciona':
        response =
          '❓ *Como Funciona*\n\n' +
          'Este bot fornece informações sobre filmes em cartaz nos cinemas de Maceió.\n\n' +
          '💡 *Funcionalidades:*\n' +
          '🎬 Filmes de Hoje — Veja os filmes em exibição hoje\n' +
          '📅 Filmes de Amanhã — Veja os filmes em exibição amanhã\n' +
          '🆕 Próximos Lançamentos — Veja o que está chegando\n' +
          '🔄 Trocar Cinema — Mude o cinema selecionado\n' +
          '💰 Preços — Extraídos automaticamente da API\n\n';
        break;

      default:
        response = '❓ Opção não reconhecida.';
    }

    await sendWithBackButton(chatId, response, cinema.url);
    console.log(`✅ Callback ${callbackData} respondido para ${query.from.username || chatId}`);
  } catch (err) {
    console.error(`❌ Erro ao processar ${callbackData}:`, err.message);
    await bot.sendMessage(chatId, `❌ Erro ao processar: ${err.message}`).catch(() => {});
  }
});

// Handler para mensagens de texto genéricas
bot.on('message', (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;

  if (msg.text) {
    console.log(
      `📨 Mensagem recebida de ${msg.from.username || msg.chat.id}: "${msg.text}"`,
    );
  }
});

// Handler de erro
bot.on('polling_error', (err) => {
  console.error('❌ Erro de polling:', err.message);

  if (err.code === 409 || err.message.includes('terminated by other')) {
    console.log('⏳ Outra instância do bot detectada, aguardando 5 segundos antes de reintentar...');
    setTimeout(() => {
      console.log('🔄 Tentando reconectar ao Telegram...');
    }, 5000);
  }
});

// Inicializar
(async () => {
  await cache.load();
  await setCommands();

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Bot subiu na porta ${PORT} (host 0.0.0.0)`);
    console.log(`📡 Health check: http://0.0.0.0:${PORT}/`);
  });

  // Auto-ping para evitar idling no Render (polling do Telegram não gera tráfego HTTP)
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
    setInterval(async () => {
      try {
        const res = await fetch(selfUrl);
        console.log(`🔄 Auto-ping ${selfUrl} → ${res.status}`);
      } catch (err) {
        console.error('❌ Auto-ping falhou:', err.message);
      }
    }, PING_INTERVAL_MS);
    console.log(`⏱️ Auto-ping ativo a cada 10 min → ${selfUrl}`);
  }

  console.log('🚀 Bot iniciado em modo polling...');
  console.log('Aguardando mensagens. Envie /start para começar.');
})();

// Graceful shutdown (SIGTERM em container, SIGINT local)
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n👋 Desligando bot (sinal recebido: ${signal})...`);
  bot.stopPolling();
  if (server) {
    server.close(() => {
      console.log('✅ Servidor encerrado');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
