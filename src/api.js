import axios from 'axios';
import { normalizeSessionsResponse, normalizeUpcomingFromSessions } from './normalize.js';

const BASE_URL = 'https://api-content.ingresso.com';
const CITY_ID = 53; // Maceió
const THEATER_ID = 1162; // Cinesystem Maceió
/* const THEATER_ID = 638; // Kinoplex Maceió Shoppin
const THEATER_ID = 852; // Centerplex Pátio Maceió */

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
};

function getTodayInMaceioISO() {
  return new Date().toLocaleString('en-CA', {
    timeZone: 'America/Maceio',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Resolve a data alvo:
 * - Se informada (YYYY-MM-DD), usa diretamente
 * - Caso contrário, usa a data de hoje no fuso de Maceió
 */
function resolveTargetDate(date) {
  return date || getTodayInMaceioISO();
}

/**
 * Busca sessões de um cinema para uma data e retorna dados normalizados.
 *
 * @param {string|null} date - Data YYYY-MM-DD (null = hoje)
 * @returns {Promise<{ movies, sessions, date, fetchedAt }>} Dados normalizados
 */
export async function fetchNormalized(date = null) {
  const targetDate = await resolveTargetDate(date);

  console.log(`🎬 Buscando sessões para ${targetDate}...`);
  const { data: response } = await axios.get(
    `${BASE_URL}/v0/sessions/city/${CITY_ID}/theater/${THEATER_ID}/partnership/home/groupBy/sessionType`,
    { params: { date: targetDate }, headers: HEADERS },
  );

  const normalized = normalizeSessionsResponse(response);
  normalized.date = targetDate;

  console.log(
    `✅ ${Object.keys(normalized.movies).length} filmes, ${normalized.sessions.length} sessões`,
  );

  return normalized;
}

/**
 * Busca próximos lançamentos exclusivos do Cinesystem Maceió.
 *
 * Usa o endpoint de sessões sem filtro de data (retorna todas as datas
 * disponíveis em uma única chamada), identifica filmes que ainda não
 * estão em cartaz hoje, e extrai dados relevantes para a UI.
 *
 * @returns {Promise<{ items: Array, fetchedAt: string }>}
 */
export async function fetchUpcoming() {
  console.log('🆕 Buscando próximos lançamentos do Cinesystem Maceió...');

  const { data: response } = await axios.get(
    `${BASE_URL}/v0/sessions/city/${CITY_ID}/theater/${THEATER_ID}`,
    { headers: HEADERS },
  );

  const allDates = Array.isArray(response) ? response : [];
  const today = getTodayInMaceioISO();

  const todayEntry = allDates.find((d) => d.date === today);
  const todayMovieIds = new Set((todayEntry?.movies || []).map((m) => m.id));

  const futureDates = allDates.filter((d) => d.date > today);

  const items = normalizeUpcomingFromSessions(futureDates, todayMovieIds);
  console.log(`✅ ${items.length} lançamento(s) futuro(s)`);

  return { items, fetchedAt: new Date().toISOString() };
}

export default { fetchNormalized, fetchUpcoming };
