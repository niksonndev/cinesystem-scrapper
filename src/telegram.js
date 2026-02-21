/**
 * Envio da programação do dia para o Telegram via Bot API.
 * Variáveis de ambiente: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

const TELEGRAM_API = 'https://api.telegram.org/bot';

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Formata a programação em texto para o Telegram (HTML).
 * @param {{ movies: Array<{ name: string, sessions: string[] }>, scrapedAt?: string }} state
 * @returns {string}
 */
export function formatProgramacao(state) {
  if (!state?.movies?.length) {
    return '🎬 <b>Cinesystem Maceió</b>\n\nNenhuma sessão encontrada para hoje (ou programação ainda não atualizada).';
  }

  const lines = ['🎬 <b>Cinesystem Maceió – Programação do dia</b>\n'];

  for (const movie of state.movies) {
    const name = escapeHtml(movie.name);
    const sessions = (movie.sessions || []).sort();
    const horarios = sessions.length ? sessions.join(', ') : '—';
    lines.push(`<b>${name}</b>\n${horarios}\n`);
  }

  if (state.scrapedAt) {
    const date = new Date(state.scrapedAt);
    lines.push(`\n<i>Atualizado: ${date.toLocaleString('pt-BR')}</i>`);
  }

  return lines.join('');
}

/**
 * Envia a mensagem para o chat do Telegram.
 * @param {string} text - Texto da mensagem (HTML)
 * @param {{ botToken: string, chatId: string }} options
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendMessage(text, { botToken, chatId }) {
  const url = `${TELEGRAM_API}${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      error: data.description || `HTTP ${res.status}`,
    };
  }

  if (!data.ok) {
    return {
      ok: false,
      error: data.description || 'Resposta inválida da API',
    };
  }

  return { ok: true };
}

/**
 * Carrega credenciais das variáveis de ambiente.
 * @returns {{ botToken: string, chatId: string } | { missing: string[] }}
 */
export function getTelegramConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const missing = [];

  if (!botToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (!chatId) missing.push('TELEGRAM_CHAT_ID');

  if (missing.length) {
    return { missing };
  }

  return { botToken, chatId };
}

/**
 * Envia a programação do dia para o Telegram.
 * Usa estado em memória ou carrega de loadState (feito pelo caller).
 * @param {{ movies: Array<{ name: string, sessions: string[] }>, scrapedAt?: string }} state
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendProgramacao(state) {
  const config = getTelegramConfig();
  if ('missing' in config) {
    return {
      ok: false,
      error: `Variáveis de ambiente faltando: ${config.missing.join(', ')}. Veja o README.`,
    };
  }

  const text = formatProgramacao(state);
  return sendMessage(text, config);
}
