import axios from 'axios';

const BASE_URL = 'https://api-content.ingresso.com';
const CITY_ID = 53; // Maceió
const THEATER_ID = 1162; // Cinesystem Maceió

/**
 * Retorna data de hoje em Maceió no formato YYYY-MM-DD
 */
function getTodayInMaceioISO() {
  return new Date().toLocaleString('en-CA', {
    timeZone: 'America/Maceio',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Formato de data de entrada (DD/MM/YYYY) para API (YYYY-MM-DD)
 * @param {string} date - Formato: DD/MM/YYYY
 * @returns {string} - Formato: YYYY-MM-DD
 */
function formatDateToAPI(date) {
  if (!date) return null;
  const [day, month, year] = date.split('/');
  return `${year}-${month}-${day}`;
}

/**
 * Resolve a data alvo:
 * - Se a data for informada (DD/MM/YYYY), converte para YYYY-MM-DD
 * - Caso contrário, tenta usar a API de datas disponíveis do cinema
 * - Se falhar, usa a data de hoje em Maceió
 */
async function resolveTargetDate(headers, date) {
  if (date) {
    return formatDateToAPI(date);
  }

  try {
    console.log('📅 Buscando datas disponíveis na API...');
    const datesResponse = await axios.get(
      `${BASE_URL}/v0/sessions/city/${CITY_ID}/theater/${THEATER_ID}/dates/partnership/home`,
      { headers },
    );

    let availableDates = [];

    if (Array.isArray(datesResponse.data)) {
      availableDates = datesResponse.data;
    } else if (Array.isArray(datesResponse.data?.dates)) {
      availableDates = datesResponse.data.dates;
    }

    if (availableDates.length === 0) {
      console.warn('⚠️ Nenhuma data disponível retornada pela API, usando hoje em Maceió.');
      return getTodayInMaceioISO();
    }

    // Tenta encontrar a data marcada como "hoje" / "isToday"
    const todayEntry =
      availableDates.find((d) => d.isToday || d.today) || availableDates[0];

    const apiDate = todayEntry.date || todayEntry;
    console.log(`📅 Data alvo da API: ${apiDate}`);
    return apiDate;
  } catch (err) {
    console.warn(
      `⚠️ Erro ao buscar datas disponíveis, usando hoje em Maceió: ${err.message}`,
    );
    return getTodayInMaceioISO();
  }
}

/**
 * Busca filmes com preços da API de eventos e sessões
 * @param {string|null} date - Data no formato DD/MM/YYYY (opcional, padrão: hoje)
 * @returns {Promise<Array>} - Array de filmes com sessões e preços
 */
export async function getMoviesWithPrices(date = null) {
  try {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    };

    // 1. Resolve data alvo usando o endpoint de datas
    const targetDate = await resolveTargetDate(headers, date);

    // 2. Busca eventos do cinema (filmes em cartaz)
    console.log('🎬 Buscando eventos...');
    const eventsResponse = await axios.get(
      `${BASE_URL}/v0/sessions/city/${CITY_ID}/theater/${THEATER_ID}`,
      { headers },
    );

    if (!Array.isArray(eventsResponse.data)) {
      throw new Error('Invalid API response: expected array of events');
    }

    console.log(`📅 Data alvo: ${targetDate}`);
    console.log(`📽️  ${eventsResponse.data.length} eventos encontrados`);

    // 3. Para cada evento, busca sessões com preços usando a nova URL
    const movieMap = new Map();
    let sessionCount = 0;

    for (const event of eventsResponse.data) {
      try {
        const sessionsResponse = await axios.get(
          `${BASE_URL}/v0/sessions/city/${CITY_ID}/event/${event.id}/partnership/home/groupBy/sessionType`,
          {
            params: { date: targetDate },
            headers,
          },
        );

        // Filtra apenas cinema_id === 1162 (Cinesystem Maceió)
        const sessions = sessionsResponse.data.sessions || [];

        for (const sessionGroup of sessions) {
          if (sessionGroup.cinemaId !== THEATER_ID) continue;

          const movieKey = event.title.toLowerCase().trim();
          if (!movieMap.has(movieKey)) {
            movieMap.set(movieKey, {
              name: event.title,
              sessions: [],
            });
          }

          const movieEntry = movieMap.get(movieKey);
          for (const session of sessionGroup.sessions || []) {
            movieEntry.sessions.push({
              time: session.time,
              sessionId: session.id,
              priceInteira: session.price?.fullPrice,
              priceMeia: session.price?.halfPrice,
              gratuito: !session.price?.fullPrice,
            });
            sessionCount++;
          }
        }
      } catch (err) {
        // Se um evento falhar, continua com o próximo
        console.warn(
          `⚠️  Erro ao buscar sessões para evento ${event.id}: ${err.message}`,
        );
      }
    }

    const movies = Array.from(movieMap.values());
    console.log(
      `✅ ${movies.length} filmes, ${sessionCount} sessões encontradas`,
    );

    return movies;
  } catch (err) {
    console.error('❌ Erro ao buscar filmes com preços:', err.message);
    throw err;
  }
}

export default { getMoviesWithPrices };
