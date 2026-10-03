// Headless games with invariants after every step. A crash gate, not a balance instrument.
//   node tools/sim.mjs [--games N] [--seed S] [--policy random|ai] [--verbose]
import { loadEngine } from './load.mjs';
const MF = loadEngine();
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const games = +arg('games', 50), seed0 = +arg('seed', 1), policy = arg('policy', 'random'), verbose = process.argv.includes('--verbose');
const ids = Object.values(MF.decks).filter(d => d.registered).map(d => d.id);
let rs = 12345; const rnd = n => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs % n; };
const STEPS = MF.STEPS;
function check(s, prev, where) {
  const bad = m => { throw new Error('INVARIANT ' + m + ' @ ' + where); };
  const seen = new Set();
  for (const p of s.players) {
    for (const k in p.pool) if (!(p.pool[k] >= 0)) bad('negative mana');
    if (Number.isNaN(p.life)) bad('NaN life');
    for (const z of ['hand', 'lib', 'grave', 'exile']) for (const i of p[z]) { if (seen.has(i)) bad('an object is in two zones'); seen.add(i); if (s.cards[i].zone !== z) bad('zone mismatch ' + i + ' ' + z + '/' + s.cards[i].zone); }
    if (p.landsPlayed > 1) bad('two land drops');
  }
  for (const i of s.bf) { if (seen.has(i)) bad('an object is in two zones'); seen.add(i); if (s.cards[i].zone !== 'bf') bad('battlefield zone mismatch'); }
  for (const L of s.stack) if (L.iid != null && s.cards[L.iid].zone !== 'stack') bad('stack object not on the stack');
  if (prev && prev.turn === s.turn && s.step !== 'pregame' && prev.step !== 'pregame' && STEPS.indexOf(s.step) < STEPS.indexOf(prev.step) && !(prev.step === 'cleanup')) bad('steps went backwards ' + prev.step + ' -> ' + s.step);
  if (s.winner == null) {
    const l = MF.legalActions(s); if (!l.length) bad('no legal action'); if (MF.whoActs(s) == null) bad('nobody acts');
    if (s.pending && !s.pending.q.opts.length) bad('a pending decision with no answer');
  }
}
const pick = s => {
  const legal = MF.legalActions(s);
  if (policy === 'ai') return MF.ai.choose(s);
  // A sim policy never picks cancel or undo: those loop.
  const ok = legal.filter(l => l.type !== 'cancel' && l.id !== 'undo');
  const np = ok.filter(l => l.type !== 'pass' && l.id !== 'done' && l.id !== 'no');
  return (np.length && rnd(3) > 0) ? np[rnd(np.length)] : ok.find(l => l.type === 'pass' || l.id === 'done') || ok[rnd(ok.length)];
};
const t0 = Date.now(); const wins = {}; let steps = 0, turns = 0, capped = 0;
for (let g = 0; g < games; g++) {
  const a = ids[g % ids.length], b = ids[(g + 1) % ids.length];
  let s = MF.newGame({ seed: seed0 + g, decks: g % 2 ? [b, a] : [a, b] });
  const acts = [];
  try {
    for (let n = 0; s.winner == null; n++) {
      if (s.turn > 60 || n > 20000) { capped++; break; }
      const act = pick(s);
      acts.push(act);
      const prev = s;
      s = MF.apply(s, act); steps++;
      check(s, prev, 'game ' + g + ' step ' + n);
    }
  } catch (e) {
    console.log('FAILED game', g, 'seed', seed0 + g, 'decks', s.players.map(p => p.deckId).join(' v '), 'after', acts.length, 'actions');
    console.log(e.stack.split('\n').slice(0, 8).join('\n'));
    console.log('last actions:', JSON.stringify(acts.slice(-6)));
    console.log(s.log.slice(-14).map(e => JSON.stringify(e)).join('\n'));
    process.exit(1);
  }
  turns += s.turn;
  const w = s.winner == null ? 'capped' : s.winner === 'draw' ? 'draw' : s.players[s.winner].deckId;
  wins[w] = (wins[w] || 0) + 1;
  if (verbose) console.log('game', g, s.players.map(p => p.deckId + ' ' + p.life).join(' | '), 'turns', s.turn, '->', w);
}
console.log(`${games} games, 0 violations, ${steps} steps, mean turns ${(turns / games).toFixed(1)}, capped ${capped}, ${((Date.now() - t0) / steps).toFixed(2)} ms/step`);
console.log('wins:', JSON.stringify(wins));
