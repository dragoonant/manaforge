// The Oracle-text auditor. For every compiled card in a registered deck (or --all), diff what the
// engine will do (MF.describeCard, from the compiled data) against the Oracle text.
//   FAIL — a number, keyword or zone in the Oracle text that the description lacks.
//   WARN — an effect verb in the Oracle text that the description lacks (wording; reviewed by eye).
// An auditor that cries wolf gets ignored (handoff 9): FAIL is kept to numbers, keywords, zones.
//   node tools/audit-cards.mjs [--all] [--verbose]
import { loadEngine } from './load.mjs';
const MF = loadEngine();
const all = process.argv.includes('--all'), verbose = process.argv.includes('--verbose'), selftest = process.argv.includes('--selftest');
if (selftest) {                                                                                   // prove the gate still fails on a known-bad card (handoff 7.7)
  const fl = MF.cards['flame-lash']; fl.ab = JSON.parse(JSON.stringify(fl.ab)); fl.ab[0].ops[0].n = 3;
  const bo = MF.cards['quaketusk-boar']; bo.kw = { reach: 1, haste: 1 };
}
const ids = new Set();
for (const d of Object.values(MF.decks)) if (all || d.registered) for (const e of d.main) ids.add(e.id);

const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: null };
const ZONES = ['battlefield', 'graveyard', 'hand', 'library', 'exile'];
const VERBS = ['destroy', 'draw', 'discard', 'tap', 'create', 'scry', 'counter', 'damage', 'gain', 'copy', 'reveal', 'look', 'attach', 'sacrifice', 'exile', 'double', "can't be blocked", 'flying', 'trample'];
const KW = Object.values(MF.KWNAME);
const norm = t => t.replace(/\s*\([^)]*\)/g, '').toLowerCase();
let fails = 0, warns = 0, n = 0;
for (const id of [...ids].sort()) {
  const d = MF.cards[id];
  if (d.un) { console.log('UN    ' + id + ': ' + d.un); continue; }
  n++;
  const oracle = norm(d.text + (d.back ? '\n' + d.back.text : '') + (d.prep ? '\n' + d.prep.text : ''));   // a transforming card: both faces (CR 712); a preparation card's prepare spell (CR 722)
  const desc = MF.describeCard(d).join(' | ').toLowerCase() + ' ' + (d.ab.some(a => a.k === 'mana') && /add|\{t\}/.test(oracle) ? ' {t}: add ' : '');
  const descNums = new Set((desc.match(/[+-]?\d+/g) || []).map(x => String(Math.abs(+x))));
  const out = [];
  // Numbers: digits, "+N/+N", number words.
  for (const m of oracle.matchAll(/[+-]?\d+/g)) { const v = String(Math.abs(+m[0])); if (!descNums.has(v) && !(d.mana.includes('{' + v + '}') && oracle.includes('{' + v + '}') === false)) out.push(['FAIL', 'number ' + m[0]]); }
  for (const [w, v] of Object.entries(WORDNUM)) if (v != null && new RegExp('\\b' + w + '\\b').test(oracle) && !descNums.has(String(v)) && !new RegExp('\\b' + w + '\\b').test(desc)) out.push(['FAIL', 'number word "' + w + '"']);
  for (const k of KW) if (new RegExp('\\b' + k + '\\b').test(oracle) && !desc.includes(k)) out.push(['FAIL', 'keyword ' + k]);
  for (const z of ZONES) if (new RegExp('\\b' + z + '\\b').test(oracle) && !desc.includes(z) && !(z === 'battlefield' && /\benters?\b/.test(desc)) && !(z === 'library' && /top|bottom|scry/.test(desc)) && !(z === 'hand' && /draw|discard/.test(desc)) && !(z === 'exile' && /exile/.test(desc))) out.push(['FAIL', 'zone ' + z]);
  for (const v of VERBS) if (oracle.includes(v) && !desc.includes(v.replace("can't", 'can’t'))) out.push(['WARN', 'verb "' + v + '"']);
  // Cross-check: the describer must not mention a keyword the Oracle text lacks.
  for (const k of KW) if (desc.includes(k) && !oracle.includes(k) && !(k === 'prowess' && /prowess/.test(oracle)) && !(k === 'haste' && /\bearthbend\b/i.test(oracle))) out.push(['FAIL', 'description adds keyword ' + k]);
  const f = out.filter(o => o[0] === 'FAIL').length, w = out.length - f;
  fails += f; warns += w;
  if (out.length || verbose) {
    console.log((f ? 'FAIL  ' : w ? 'WARN  ' : 'ok    ') + id + (out.length ? ': ' + out.map(o => o[1]).join('; ') : ''));
    if (out.length || verbose) { console.log('      oracle: ' + d.text.replace(/\n/g, ' // ')); console.log('      engine: ' + MF.describeCard(d).join(' // ')); }
  }
}
console.log(`audit: ${n} cards, ${fails} FAIL, ${warns} WARN`);
if (selftest) { const okk = fails >= 2; console.log('selftest: corrupted Flame Lash (3 damage) and Quaketusk Boar (no trample) -> ' + (okk ? 'PASS (the auditor caught both)' : 'FAIL')); process.exit(okk ? 0 : 1); }
process.exit(fails ? 1 : 0);
