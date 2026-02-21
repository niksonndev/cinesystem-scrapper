/**
 * Persistência do estado da programação (JSON em data/).
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const STATE_FILE = join(DATA_DIR, 'state.json');
const PREVIOUS_FILE = join(DATA_DIR, 'previous.json');

export async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

/**
 * @param {{ movies: Array<{ name: string, sessions: string[] }>, scrapedAt: string }} state
 */
export async function saveState(state) {
  await ensureDataDir();
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Salva o estado atual como "previous" antes de atualizar (para diff).
 */
export async function rotateState(newState) {
  await ensureDataDir();
  try {
    const current = await readFile(STATE_FILE, 'utf8');
    await writeFile(PREVIOUS_FILE, current, 'utf8');
  } catch (_) {
    // first run, no previous
  }
  await saveState(newState);
}

/**
 * @returns {Promise<{ movies: Array<{ name: string, sessions: string[] }>, scrapedAt: string } | null>}
 */
export async function loadState() {
  try {
    const data = await readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (_) {
    return null;
  }
}

/**
 * @returns {Promise<{ movies: Array<{ name: string, sessions: string[] }>, scrapedAt: string } | null>}
 */
export async function loadPrevious() {
  try {
    const data = await readFile(PREVIOUS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (_) {
    return null;
  }
}

export { STATE_FILE, PREVIOUS_FILE, DATA_DIR };
