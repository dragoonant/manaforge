// Fetches a championship event's Standard decklists and final standings from magic.gg, and picks
// the best-finishing list of each of the top N archetypes (PLAN D15: 10 distinct archetypes per era).
//
//   node tools/fetch-championship.mjs <event-key> [--n 10]
//
// Event keys and their pages are listed in EVENTS below, with the date they were fetched. Raw pages
// go to scratch/web/championship/<key>/; the parsed result to scratch/data/championship-<key>.json.
// magic.gg serves each deck as a <deck-list deck-title=player subtitle=archetype> element with
// <main-deck> and <side-board> lines "N Card Name".
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './load.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
export const EVENTS = {
  'pt-fin': {
    name: 'Pro Tour Magic: The Gathering—FINAL FANTASY', date: '2025-06-20', era: 'fin', format: 'Standard',
    lists: ['a-c', 'd-g', 'h-k', 'l-n', 'o-s', 't-z'].map(r => 'https://magic.gg/decklists/pro-tour-magic-the-gathering-final-fantasy-standard-decklists-' + r),
    standings: 'https://magic.gg/news/pro-tour-magic-the-gathering-final-fantasy-final-standings',
  },
  // PLAN D15: no championship-level Standard event has run since The Hobbit (the September 2026
  // Regional Championship and China Open pages are labelled Standard but carry Modern lists). The
  // owner chose Wizards' weekly top-ranked Arena Traditional Standard lists instead. They carry no
  // archetype label and no individual rank, so archetypes are found by clustering (see cluster()).
  'arena-hob': {
    name: 'MTG Arena Traditional Standard (Bo3), Platinum–Mythic, weekly published lists', date: '2026-08-17..2026-10-05', era: 'hob', format: 'Standard', cluster: true,
    lists: ['august-17', 'august-24', 'august-31', 'september-7', 'september-14', 'september-21', 'september-28', 'october-5'].map(d => 'https://magic.gg/decklists/traditional-standard-ranked-decklists-' + d + '-2026'),
  },
};
const GUILD = { '': 'Colorless', W: 'Mono-White', U: 'Mono-Blue', B: 'Mono-Black', R: 'Mono-Red', G: 'Mono-Green', WU: 'Azorius', UB: 'Dimir', BR: 'Rakdos', RG: 'Gruul', WG: 'Selesnya', WB: 'Orzhov', UR: 'Izzet', BG: 'Golgari', WR: 'Boros', UG: 'Simic', WUB: 'Esper', UBR: 'Grixis', BRG: 'Jund', WRG: 'Naya', WUG: 'Bant', WBG: 'Abzan', WUR: 'Jeskai', UBG: 'Sultai', WBR: 'Mardu', URG: 'Temur' };
// Archetypes by clustering: a deck's colours are those of its nonland spells (a colour needs 8 or
// more copies to count); within a colour group, decks join the cluster whose seed shares the most
// nonland cards with them (Jaccard ≥ 0.4). The cluster's list is its medoid — the deck most like
// the others — and it is named by colours and its most-played nonland card, not by a guessed label.
function cluster(decks, atomic) {
  // Double-faced and split cards are filed under "Front // Back"; lists name the front face.
  const byFace = {};
  for (const k in atomic) { byFace[k] = atomic[k]; for (const f of atomic[k]) if (f.faceName && !byFace[f.faceName]) byFace[f.faceName] = atomic[k]; }
  const colorsOf = name => { const c = byFace[name] || byFace[name.split(' // ')[0]]; if (!c) return null; return c[0]; };
  const unknown = new Set();
  for (const d of decks) {
    const cnt = {}; d.spells = new Set();
    for (const e of d.main) {
      const c = colorsOf(e.name); if (!c) { unknown.add(e.name); continue; }
      if (c.types.includes('Land')) continue;
      d.spells.add(e.name);
      for (const k of c.colors) cnt[k] = (cnt[k] || 0) + e.n;
    }
    d.colors = 'WUBRG'.split('').filter(k => (cnt[k] || 0) >= 8).join('');
  }
  const jac = (a, b) => { let i = 0; for (const x of a.spells) if (b.spells.has(x)) i++; return i / (a.spells.size + b.spells.size - i || 1); };
  // A deck joins the same-coloured cluster it is most like on average (≥ 0.3); compared with the
  // first deck only, 283 lists split into 175 clusters (2026-10-05). Two passes settle the edges.
  let clusters = [];
  for (let pass = 0; pass < 2; pass++) {
    const prev = clusters; clusters = [];
    const seeds = pass ? prev.filter(c => c.decks.length > 1) : [];
    for (const c of seeds) clusters.push({ colors: c.colors, decks: [], ref: c.decks });
    for (const d of decks) {
      let best = null, bs = 0.3;
      for (const c of clusters) if (c.colors === d.colors) { const ref = c.ref || c.decks; const s = ref.reduce((a, o) => a + jac(o, d), 0) / ref.length; if (s >= bs) { bs = s; best = c; } }
      if (best) best.decks.push(d); else clusters.push({ colors: d.colors, decks: [d] });
    }
    clusters = clusters.filter(c => c.decks.length);
    for (const c of clusters) delete c.ref;
  }
  for (const c of clusters) {
    c.medoid = c.decks.map(d => [d, c.decks.reduce((a, o) => a + jac(d, o), 0)]).sort((a, b) => b[1] - a[1])[0][0];
    const freq = {}; for (const d of c.decks) for (const x of d.spells) freq[x] = (freq[x] || 0) + 1;
    c.signature = Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    c.name = (GUILD[c.colors] || c.colors) + ' (' + c.signature + ')';
  }
  return { clusters: clusters.sort((a, b) => b.decks.length - a.decks.length), unknown: [...unknown] };
}
const ent = s => s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
const norm = s => ent(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

async function get(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) return fs.readFileSync(file, 'utf8');
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(url + ': HTTP ' + res.status);
  const t = await res.text();
  fs.writeFileSync(file, t);
  return t;
}
export function parseDecks(html) {
  const out = [];
  for (const m of html.matchAll(/<deck-list\s+([^>]*)>([\s\S]*?)<\/deck-list>/g)) {
    const attr = k => { const a = m[1].match(new RegExp(k + '="([^"]*)"')); return a ? ent(a[1]) : null; };
    const block = (tag) => { const b = m[2].match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>')); return b ? b[1].split('\n').map(l => l.trim()).filter(Boolean).map(l => { const x = l.match(/^(\d+)\s+(.+)$/); if (!x) throw new Error('decklist line: ' + l); return { n: +x[1], name: ent(x[2]) }; }) : []; };
    out.push({ player: attr('deck-title'), archetype: attr('subtitle'), main: block('main-deck'), side: block('side-board') });
  }
  return out;
}
export function parseStandings(html) {
  const text = html.replace(/<[^>]+>/g, '\n').split('\n').map(s => ent(s)).filter(Boolean);
  const rows = [];
  // Rows read: rank, points, first name, last name, ...
  for (let i = 0; i + 3 < text.length; i++) {
    if (/^\d+$/.test(text[i]) && /^\d+$/.test(text[i + 1]) && !/^\d+$/.test(text[i + 2]) && !/^\$/.test(text[i + 2])) {
      const rank = +text[i];
      if (rank === rows.length + 1) { rows.push({ rank, points: +text[i + 1], name: text[i + 2] + ' ' + text[i + 3] }); i += 3; }
    }
  }
  return rows;
}

if (process.argv[1] && process.argv[1].endsWith('fetch-championship.mjs')) {
  const key = process.argv[2], ev = EVENTS[key];
  if (!ev) { console.log('events: ' + Object.keys(EVENTS).join(', ')); process.exit(2); }
  const n = process.argv.includes('--n') ? +process.argv[process.argv.indexOf('--n') + 1] : 10;
  const dir = path.join(ROOT, 'scratch', 'web', 'championship', key); fs.mkdirSync(dir, { recursive: true });
  const decks = [];
  for (const [i, u] of ev.lists.entries()) decks.push(...parseDecks(await get(u, path.join(dir, 'lists-' + i + '.html'))).map(d => Object.assign(d, { week: u.match(/decklists-(.+)$/)[1] })));
  if (ev.cluster) {
    const atomic = JSON.parse(fs.readFileSync(path.join(ROOT, 'scratch', 'data', 'AtomicCards.json'), 'utf8')).data;
    const full = decks.filter(d => d.main.reduce((a, e) => a + e.n, 0) >= 60);
    const { clusters, unknown } = cluster(full, atomic);
    if (unknown.length) console.log('names not in AtomicCards: ' + unknown.join('; '));
    const picks = clusters.slice(0, n).map(c => Object.assign({ archetype: c.name, players: c.decks.length, rank: null, player: 'Platinum–Mythic rank player (' + c.medoid.week + ')' }, { main: c.medoid.main, side: c.medoid.side, cards: c.medoid.main.reduce((a, e) => a + e.n, 0) }));
    const out = { event: key, name: ev.name, date: ev.date, era: ev.era, format: ev.format, fetched: new Date().toISOString().slice(0, 10), sources: ev.lists, decks: full.length, clusters: clusters.length, picks };
    fs.writeFileSync(path.join(ROOT, 'scratch', 'data', 'championship-' + key + '.json'), JSON.stringify(out, null, 1));
    console.log(`${key}: ${full.length} decklists of 60+, ${clusters.length} clusters`);
    for (const c of clusters.slice(0, n + 4)) console.log(`  ${String(c.decks.length).padStart(3)}  ${c.name}`);
    process.exit(0);
  }
  const standings = parseStandings(await get(ev.standings, path.join(dir, 'standings.html')));
  const rankOf = new Map(standings.map(r => [norm(r.name), r.rank]));
  let unmatched = 0;
  for (const d of decks) { d.rank = rankOf.get(norm(d.player)); if (d.rank == null) { unmatched++; d.rank = 9999; } d.cards = d.main.reduce((a, e) => a + e.n, 0); }
  const best = {};
  for (const d of decks) if (d.cards >= 60 && (!best[d.archetype] || d.rank < best[d.archetype].rank)) best[d.archetype] = d;
  const counts = {}; for (const d of decks) counts[d.archetype] = (counts[d.archetype] || 0) + 1;
  const picks = Object.values(best).sort((a, b) => a.rank - b.rank).slice(0, n);
  const out = { event: key, name: ev.name, date: ev.date, era: ev.era, format: ev.format, fetched: new Date().toISOString().slice(0, 10), sources: ev.lists.concat([ev.standings]), decks: decks.length, standings: standings.length, unmatched, picks: picks.map(d => Object.assign({ players: counts[d.archetype] }, d)) };
  fs.writeFileSync(path.join(ROOT, 'scratch', 'data', 'championship-' + key + '.json'), JSON.stringify(out, null, 1));
  console.log(`${key}: ${decks.length} decklists, ${standings.length} standings rows, ${unmatched} decks unmatched to a rank, ${Object.keys(best).length} archetypes`);
  for (const d of picks) console.log(`  #${String(d.rank).padStart(4)}  ${d.archetype.padEnd(26)} ${d.player}  (${counts[d.archetype]} in the field)`);
}
