// Fetches the five championship Commander (cEDH) decklists of PLAN D22 from EDHTop16 and writes each
// as a list file in data/lists/, which tools/build-cards.mjs compiles like a friend's list (PLAN D21).
//
//   node tools/fetch-cedh.mjs
//
// EDHTop16 (https://edhtop16.com) publishes the standings and decklists of competitive Commander
// tournaments. Each decklist page carries its cards in the page's embedded data as
// {"count":N, ..., "card":{"id":..,"name":"Card Name","type":..}} — the 98 or 99 cards of the deck
// without its commanders, which the tournament page names. Raw pages go to
// scratch/web/cedh/<tid>--<deck>.html. The picks below were chosen on 2026-10-31 (PLAN D22): from the
// top 16 of the 16 largest open events of 2026 on EDHTop16, the best-placed list of each commander,
// five different commanders, a 100-card deck each.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './load.mjs';

export const PICKS = [
  { tid: 'd-grid-on-the-stack', deck: 'z0rVgKt4HGOWE57DB3qolitDrri1', event: 'Just Jam D-Grid', date: '2026-05-30', players: 200, standing: 1, record: '4-1-3', player: 'Matt Hayes', commanders: ['Kraum, Ludevic\'s Opus', 'Tymna the Weaver'], name: 'Kraum & Tymna', file: 'cedh-kraum-tymna' },
  { tid: 'the-fishbowl-san-diego-copy-1767729472000', deck: 'EkjAv5v9icSG7jTKu4vBewlX6RO2', event: 'The Fish Bowl 7', date: '2026-06-27', players: 209, standing: 1, record: '6-2-1', player: 'Joe Holland', commanders: ['Thrasios, Triton Hero', 'Vial Smasher the Fierce'], name: 'Thrasios & Vial Smasher', file: 'cedh-thrasios-vial-smasher' },
  { tid: 'cedh-uk-open-benfest-iii', deck: '4CRipOBe3HdnR3NN4NQNImyZu8J2', event: 'cEDH UK Open — Benfest III', date: '2026-09-12', players: 156, standing: 3, record: '4-2-3', player: 'Janos Nado', commanders: ['Scion of the Ur-Dragon'], name: 'Scion of the Ur-Dragon', file: 'cedh-scion' },
  { tid: 'commandergeddon-10-brought-to-you-by-jenes-mtg', deck: 'Tn7hc9tJIjhoDu0yDp7OHtJRG3i2', event: 'Commandergeddon 10', date: '2026-06-05', players: 173, standing: 7, record: '3-3-1', player: 'Dan Cross', commanders: ['Najeela, the Blade-Blossom'], name: 'Najeela', file: 'cedh-najeela' },
  { tid: 'pittsburgh-2026-tcedh-10k-25000', deck: '9XwMYS3gwrTGnhaRXEF6QkpXc5K2', event: 'Pittsburgh 2026 — t/cEDH $10k–$25,000', date: '2026-07-11', players: 195, standing: 8, record: '3-3-2', player: 'Nicholas Benson', commanders: ['Terra, Magical Adept'], name: 'Terra', file: 'cedh-terra' },
];

const UA = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) manaforge' } };
async function get(url, file) {
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, UA);
    if (r.ok) { const t = await r.text(); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, t); return t; }
    await new Promise(z => setTimeout(z, 2000 * 2 ** i));
  }
  throw new Error('fetch failed: ' + url);
}
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

if (process.argv[1] && process.argv[1].endsWith('fetch-cedh.mjs')) {
  const today = new Date().toISOString().slice(0, 10);
  for (const p of PICKS) {
    const url = 'https://edhtop16.com/tournament/' + p.tid + '/decklist/' + p.deck, raw = path.join(ROOT, 'scratch/web/cedh', p.tid + '--' + p.deck + '.html');
    const fetched = fs.existsSync(raw) ? fs.statSync(raw).mtime.toISOString().slice(0, 10) : today;
    const page = await get(url, raw);
    const items = [...page.matchAll(/\{"count":(\d+),"spice":[^,]*,"commanderPlayRate":[^,]*,"card":\{"id":"[^"]*","name":"((?:[^"\\]|\\.)*)","type":"((?:[^"\\]|\\.)*)"/g)].map(m => ({ n: +m[1], name: JSON.parse('"' + m[2] + '"') }));
    const total = items.reduce((a, e) => a + e.n, 0) + p.commanders.length;
    if (total !== 100) throw new Error(p.file + ': ' + total + ' cards, not 100 (CR 903.5a)');
    const lines = [
      `# ${p.name} — ${ord(p.standing)} of ${p.players} at ${p.event}, ${p.date} (championship Commander, PLAN D22).`,
      `# Played by ${p.player}, ${p.record} (wins-losses-draws). Decklist as published on EDHTop16:`,
      `# ${url}`,
      `# Written by tools/fetch-cedh.mjs; do not edit by hand.`,
      `# player: ${p.player}`, `# name: ${p.name}`, `# group: cedh`, `# event: ${p.event}`, `# standing: ${p.standing}`,
      `# players: ${p.players}`, `# record: ${p.record}`, `# date: ${p.date}`, `# source: ${url}`, `# received: ${fetched}`,
      'Commander', ...p.commanders.map(c => '1 ' + c),
      'Deck', ...items.sort((a, b) => a.name.localeCompare(b.name)).map(e => e.n + ' ' + e.name),
    ];
    fs.writeFileSync(path.join(ROOT, 'data/lists', p.file + '.txt'), lines.join('\n') + '\n');
    console.log(p.file, total, 'cards');
  }
}
