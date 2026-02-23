#!/usr/bin/env node

/**
 * Bot Telegram Reativo - Modo Polling
 * Escuta comandos e responde dinamicamente
 * Uso: npm run bot:listen
 */

import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import { config } from 'dotenv';
import { scrape } from './scraper.js';

config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN não configurado no .env');
}

const bot = new TelegramBot(token, { polling: true });

// Configurar Express Server
const PORT = process.env.PORT || 3000;
const app = express();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: '✅ Bot está online!',
    timestamp: new Date().toISOString(),
  });
});

// Função auxiliar: Calcula data em formato DD/MM/YYYY
const getDateString = (daysOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

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

  movies.forEach((filme) => {
    message += `*🎭 ${filme.name}*\n`;

    if (filme.sessions && filme.sessions.length > 0) {
      // Pegar apenas a 1ª sessão com preço válido para referência
      const firstSessionWithPrice = filme.sessions.find(
        (s) => s.gratuito || s.priceInteira,
      );

      if (firstSessionWithPrice) {
        let priceInfo = '';
        if (firstSessionWithPrice.gratuito) {
          priceInfo = 'Gratuito ✨';
        } else if (firstSessionWithPrice.priceInteira) {
          const preco = firstSessionWithPrice.priceInteira
            .toFixed(2)
            .replace('.', ',');
          priceInfo = `💰 R$ ${preco}`;
        } else {
          priceInfo = '(preço não disponível)';
        }

        // Listar todos os horários
        const times = filme.sessions.map((s) => s.time).join(', ');
        message += `   *Sessões:* ${times}\n`;
        message += `   *Preço:* ${priceInfo}\n`;
      } else {
        // Nenhuma sessão com preço
        const times = filme.sessions.map((s) => s.time).join(', ');
        message += `   *Sessões:* ${times}\n`;
        message += `   *Preço:* (não disponível)\n`;
      }
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
        // Extrair filmes de hoje com preços
        console.log(`⏳ Buscando filmes de hoje para ${chatId}...`);

        // Enviar mensagem de carregamento
        const loadingMsg = await bot.sendMessage(
          chatId,
          '⏳ Buscando filmes de hoje com preços... Aguarde um pouco, no máximo 60 segundos!',
        );

        const result = await scrape({
          headless: true,
          extractPrices: true,
        });

        response = formatMoviesForTelegram(result.movies, result.scrapedAt);

        // Deletar mensagem de carregamento
        try {
          await bot.deleteMessage(chatId, loadingMsg.message_id);
        } catch (e) {
          // Ignorar erro se não conseguir deletar
        }
        break;
      }

      case 'filmes_amanha': {
        // Extrair filmes de amanhã com preços
        const tomorrowDate = getDateString(1);
        console.log(
          `⏳ Buscando filmes de amanhã (${tomorrowDate}) para ${chatId}...`,
        );

        // Enviar mensagem de carregamento
        const loadingMsg = await bot.sendMessage(
          chatId,
          '⏳ Buscando filmes de amanhã com preços... Aguarde (~60s)',
        );

        const result = await scrape({
          headless: true,
          date: tomorrowDate,
          extractPrices: true,
        });

        response = formatMoviesForTelegram(result.movies, result.scrapedAt);

        // Deletar mensagem de carregamento
        try {
          await bot.deleteMessage(chatId, loadingMsg.message_id);
        } catch (e) {
          // Ignorar erro se não conseguir deletar
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
