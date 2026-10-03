// The art keys the game wants: every card in a registered deck, and every token one creates.
// Shared by tools/build-art-prompts.mjs and tools/check-art.mjs so the two cannot disagree.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './load.mjs';
export async function loadData(rel) { const w = { MF: {} }; new Function('window', await readFile(join(ROOT, rel), 'utf8'))(w); return w.MF; }
export async function wantedKeys(extraDecks = []) {
  const { decks } = await loadData('data/decks.js');
  const ids = new Set();
  for (const d of Object.values(decks)) {
    if (!d.registered && !extraDecks.includes(d.id)) continue;
    for (const e of d.main) ids.add(e.id);
    for (const t of d.tokens || []) ids.add(t);
  }
  return [...ids].sort();
}
