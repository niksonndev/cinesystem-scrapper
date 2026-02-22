import https from 'https';
import zlib from 'zlib';

const THEATER_ID = 1162; // Cinesystem Maceió
const CITY_ID = 53; // Maceió
const BASE_URL = 'https://api-content.ingresso.com';

/**
 * Faz uma requisição HTTP com suporte a gzip/deflate
 */
function fetchAPI(path, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + path;
    const options = {
      method: 'GET',
      timeout,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        Connection: 'keep-alive',
        Host: 'api-content.ingresso.com',
        Origin: 'https://www.ingresso.com',
        Referer: 'https://www.ingresso.com/cinema/cinesystem-maceio',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    };

    const req = https.request(url, options, (res) => {
      let stream = res;

      // Descomprimir se necessário
      if (res.headers['content-encoding'] === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (res.headers['content-encoding'] === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (res.headers['content-encoding'] === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      let data = '';

      stream.on('data', (chunk) => {
        data += chunk;
      });

      stream.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error(`JSON Parse Error: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Obtém programação completa (filmes + sessões) da API
 * Estrutura: [{date, movies: [{title, rooms: [{sessions: [{id, time, ...}]}]}]}]
 */
export async function getProgrammingFromAPI(date = null) {
  try {
    const response = await fetchAPI(
      `/v0/sessions/city/${CITY_ID}/theater/${THEATER_ID}`,
    );

    if (!Array.isArray(response)) {
      throw new Error('Invalid API response format');
    }

    // Filtra pela data se especificada
    let dates = response;
    if (date) {
      // Converte DD/MM/YYYY para YYYY-MM-DD
      const [day, month, year] = date.split('/');
      const formattedDate = `${year}-${month}-${day}`;
      dates = response.filter((d) => d.date === formattedDate);
    } else {
      // Se nenhuma data especificada, usa apenas hoje
      dates = response.filter((d) => d.isToday === true);
    }

    // Transforma estrutura da API para estrutura padrão do scraper
    // Usa Map para deduplascar filmes por nome
    const moviesMap = new Map();

    for (const dateItem of dates) {
      for (const movieData of dateItem.movies) {
        const movieName = movieData.title;
        const key = movieName.toLowerCase().trim();

        // Obtém ou cria entry do filme
        if (!moviesMap.has(key)) {
          moviesMap.set(key, {
            name: movieName,
            sessions: [],
            sessionIds: new Set(), // para evitar duplicatas
          });
        }

        const movieEntry = moviesMap.get(key);

        // Extrai sessões de todos os rooms
        if (movieData.rooms && Array.isArray(movieData.rooms)) {
          for (const room of movieData.rooms) {
            if (room.sessions && Array.isArray(room.sessions)) {
              for (const session of room.sessions) {
                // Evita duplicatas comparando sessionId
                if (!movieEntry.sessionIds.has(session.id)) {
                  movieEntry.sessionIds.add(session.id);
                  movieEntry.sessions.push({
                    time: session.time,
                    sessionId: session.id,
                  });
                }
              }
            }
          }
        }
      }
    }

    // Converte Map para Array, remove sessionIds (auxiliar)
    const movies = Array.from(moviesMap.values()).map((m) => ({
      name: m.name,
      sessions: m.sessions,
    }));

    return movies;
  } catch (err) {
    console.error('Erro ao buscar programação da API:', err.message);
    return null;
  }
}

export default { getProgrammingFromAPI };
