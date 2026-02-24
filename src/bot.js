#!/usr/bin/env node

/**
 * Bot Telegram Reativo - Modo Polling
 * Escuta comandos e responde dinamicamente
 * Uso: npm run bot:listen
 */

import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import { config } from 'dotenv';
import { fetchNormalized } from './api.js';
import { denormalize } from './normalize.js';
import NormalizedCache from './cache.js';

config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN não configurado no .env');
}

const bot = new TelegramBot(token, { polling: true });

const PORT = process.env.PORT || 3000;
const app = express();
const cache = new NormalizedCache();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: '✅ Bot está online!',
    timestamp: new Date().toISOString(),
  });
});

const getDateString = (daysOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
};

/**
 * Busca filmes para uma data, usando cache normalizado quando disponível.
 * @returns {{ movies: Array, date: string, fromCache: boolean }}
 */
async function getMoviesForDate(date = null) {
  const targetDate = date || getDateString(0);

  const cached = cache.getSessions(targetDate);
  if (cached) {
    const movies = denormalize(cache.getAllMovies(), cached.items);
    return { movies, date: targetDate, fromCache: true };
  }

  const normalized = await fetchNormalized(date);
  cache.mergeMovies(normalized.movies);
  cache.setSessions(normalized.date, normalized.sessions, normalized.fetchedAt);

  const movies = denormalize(normalized.movies, normalized.sessions);
  return { movies, date: normalized.date, fromCache: false };
}

// Função auxiliar: Formata filmes para exibição no Telegram
const formatMoviesForTelegram = (movies, dateStr) => {
  if (!movies || movies.length === 0) {
    return '📭 *Nenhum filme em cartaz para esta data.*';
  }

  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];

  // Converter YYYY-MM-DD para formato português
  let dataPt = 'data não disponível';
  if (dateStr && typeof dateStr === 'string') {
    const [year, month, day] = dateStr.split('-');
    if (year && month && day) {
      const monthIdx = parseInt(month) - 1;
      dataPt = `${parseInt(day)} de ${meses[monthIdx]} de ${year}`;
    }
  }

  let message = `*🎬 PROGRAMAÇÃO - CINESYSTEM MACEIÓ*\n`;
  message += `📅 Data: ${dataPt}\n\n`;

  const FORMAT_ICONS = { '2D': '🎞', 'Cinépic': '🖥', 'VIP': '⭐' };

  movies.forEach((filme) => {
    message += `*🎭 ${filme.name}*\n`;

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

// URL de imagem placeholder
const MAIN_IMAGE_URL =
  'https://imgs.search.brave.com/RR3QyRyk8txiCmdUFGV3jlLc6hEyUR29hg2Gyb_m5iw/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9wb3J0/YWxob3J0b2xhbmRp/YS5jb20uYnIvd3At/Y29udGVudC91cGxv/YWRzLzIwMjUvMDMv/Y2luZXN5c3RlbS1o/b3J0b2xhbmRpYS0z/NTB4MjUwLmpwZw';

// Construir inline keyboard
const getMainKeyboard = () => {
  return {
    inline_keyboard: [
      [
        { text: '🎬 Filmes de Hoje', callback_data: 'filmes_hoje' },
        { text: '📅 Filmes de Amanhã', callback_data: 'filmes_amanha' },
      ],
      [{ text: '❓ Como Funciona', callback_data: 'como_funciona' }],
    ],
  };
};

// Definir menu de comandos
const setCommands = async () => {
  try {
    await bot.setMyCommands([
      { command: 'start', description: 'Iniciar e testar o bot' },
      { command: 'atualizar', description: 'Buscar dados novos (ignora cache)' },
    ]);
    console.log('✅ Menu de comandos configurado');
  } catch (err) {
    console.error('❌ Erro ao configurar menu de comandos:', err.message);
  }
};

// Handler para /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const caption = `*🎬 Bem-vindo ao Cinesystem Bot!*

Aqui você encontra a programação dos filmes em cartaz no Cinesystem Maceió.

Escolha uma opção abaixo para começar:`;

  try {
    await bot.sendPhoto(chatId, MAIN_IMAGE_URL, {
      caption,
      parse_mode: 'Markdown',
      reply_markup: getMainKeyboard(),
    });
    console.log(
      `✅ Mensagem /start com keyboard enviada para: ${msg.from.username || chatId}`,
    );
  } catch (err) {
    console.error(`❌ Erro ao responder /start para ${chatId}:`, err.message);
  }
});

// Handler para /atualizar - força refresh ignorando cache
bot.onText(/\/atualizar/, async (msg) => {
  const chatId = msg.chat.id;

  const loadingMsg = await bot.sendMessage(
    chatId,
    '🔄 Atualizando programação de hoje...',
  );

  try {
    console.log(`📡 /atualizar solicitado por ${msg.from.username || chatId}`);

    const normalized = await fetchNormalized();
    cache.mergeMovies(normalized.movies);
    cache.setSessions(normalized.date, normalized.sessions, normalized.fetchedAt);

    const movies = denormalize(normalized.movies, normalized.sessions);
    const response = formatMoviesForTelegram(movies, normalized.date);

    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });

    console.log(`✅ /atualizar enviado para ${msg.from.username || chatId}`);
  } catch (err) {
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, `❌ Erro ao atualizar: ${err.message}`);
    console.error(`❌ Erro em /atualizar para ${chatId}:`, err.message);
  }
});

// Handler para cliques nos botões (callback_query)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const callbackData = query.data;
  const queryId = query.id;

  // Responder ao clique (remove "loading" do botão)
  try {
    await bot.answerCallbackQuery(queryId);
  } catch (err) {
    console.error('❌ Erro ao responder callback:', err.message);
  }

  // Processar cada opção
  let response = '';

  try {
    switch (callbackData) {
      case 'filmes_hoje': {
        console.log(`⏳ Buscando filmes de hoje para ${chatId}...`);

        let loadingMsg = null;
        const cachedToday = cache.getSessions(getDateString(0));
        if (!cachedToday) {
          loadingMsg = await bot.sendMessage(
            chatId,
            '⏳ Buscando filmes de hoje... Aguarde um momento!',
          );
        }

        const today = await getMoviesForDate();

        if (loadingMsg) {
          await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        }

        response = formatMoviesForTelegram(today.movies, today.date);
        if (today.fromCache) {
          response += '\n\n_Dados fornecidos pelo cache_';
        }
        break;
      }

      case 'filmes_amanha': {
        const tomorrowDate = getDateString(1);
        console.log(`⏳ Buscando filmes de amanhã (${tomorrowDate}) para ${chatId}...`);

        let loadingMsg = null;
        const cachedTomorrow = cache.getSessions(tomorrowDate);
        if (!cachedTomorrow) {
          loadingMsg = await bot.sendMessage(
            chatId,
            '⏳ Buscando filmes de amanhã... Aguarde um momento!',
          );
        }

        const tomorrow = await getMoviesForDate(tomorrowDate);

        if (loadingMsg) {
          await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        }

        response = formatMoviesForTelegram(tomorrow.movies, tomorrow.date);
        if (tomorrow.fromCache) {
          response += '\n\n_Dados fornecidos pelo cache_';
        }
        break;
      }

      case 'como_funciona':
        response =
          '❓ *Como Funciona*\n\n' +
          'Este bot fornece informações sobre os filmes em cartaz no Cinesystem Maceió.\n\n' +
          '💡 *Funcionalidades:*\n' +
          '🎬 Filmes de Hoje - Veja os filmes em exibição hoje\n' +
          '📅 Filmes de Amanhã - Veja os filmes em exibição amanhã\n' +
          '💰 Preços - Os preços são extraídos automaticamente\n\n' +
          '_Para usar, basta clicar nos botões acima._';
        break;

      default:
        response = '❓ Opção não reconhecida.';
    }
  } catch (err) {
    console.error(`❌ Erro ao processar ${callbackData}:`, err.message);
    response = `❌ Erro ao buscar filmes: ${err.message}`;
  }

  try {
    await bot.sendMessage(chatId, response, {
      parse_mode: 'Markdown',
    });
    console.log(
      `✅ Resposta enviada para callback: ${callbackData} de ${query.from.username || chatId}`,
    );
  } catch (err) {
    console.error(`❌ Erro ao enviar resposta para ${chatId}:`, err.message);
  }
});

// Handler para mensagens de texto genéricas
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  // Ignora mensagens que já foram processadas por outros handlers
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }

  // Exibir em log que recebeu mensagem
  if (msg.text) {
    console.log(
      `📨 Mensagem recebida de ${msg.from.username || chatId}: "${msg.text}"`,
    );
  }
});

// Handler de erro
bot.on('polling_error', (err) => {
  console.error('❌ Erro de polling:', err.message);

  // Se outro bot está rodando com o mesmo token, aguarda antes de reintentar
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

  // Iniciar servidor Express
  app.listen(PORT, () => {
    console.log(`✅ Servidor escutando na porta ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/`);
  });

  console.log('🚀 Bot iniciado em modo polling...');
  console.log('Aguardando mensagens. Envie /start ou outros comandos.');
})();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Desligando bot...');
  bot.stopPolling();
  app.close(() => {
    console.log('✅ Servidor Express encerrado');
    process.exit(0);
  });
});
