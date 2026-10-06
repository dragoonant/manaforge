// tools/art-restyle.mjs — keep the painted art in step with each card's style (PLAN D17).
// tools/art-rendered-styles.json records the style every image in art/cards/ was painted in.
//   node tools/art-restyle.mjs --prune    delete images painted in a style other than the card's
//                                         assigned one, so tools/gen-art-sdxl.py repaints them
//   node tools/art-restyle.mjs --record   record the assigned style for every image not yet recorded
//                                         (run after rendering)
//   node tools/art-restyle.mjs            report only
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './load.mjs';
const REC = join(ROOT, 'tools', 'art-rendered-styles.json');
const prompts = JSON.parse(await readFile(join(ROOT, 'tools', 'art-prompts.json'), 'utf8'));
const rec = existsSync(REC) ? JSON.parse(await readFile(REC, 'utf8')) : {};
const img = k => join(ROOT, 'art', 'cards', k + '.jpg');
const prune = process.argv.includes('--prune'), record = process.argv.includes('--record');
let stale = [], fresh = [];
for (const p of prompts) {
  if (!existsSync(img(p.key))) continue;
  if (!rec[p.key]) { if (record) { rec[p.key] = p.styleId; fresh.push(p.key); } continue; }
  if (rec[p.key] !== p.styleId) stale.push(p.key);
}
if (prune) for (const k of stale) { await unlink(img(k)); delete rec[k]; }
if (prune || record) await writeFile(REC, JSON.stringify(Object.fromEntries(Object.entries(rec).sort()), null, 1) + '\n');
console.log(`${prune ? 'pruned' : 'stale'} ${stale.length}${stale.length ? ' (' + stale.join(', ') + ')' : ''}; ${record ? 'recorded ' + fresh.length : 'unrecorded ' + prompts.filter(p => existsSync(img(p.key)) && !rec[p.key]).length}`);
