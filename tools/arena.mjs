// The arena: AI against AI, both seats, with behaviour counters (handoff 7.4). A crash gate and a
// behaviour check — never a balance instrument (CLAUDE.md regime 2).
//   node tools/arena.mjs [--games N] [--seed S]
import { loadEngine } from './load.mjs';
const MF = loadEngine();
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const games = +arg('games', 20), seed0 = +arg('seed', 1000);
const ids = Object.values(MF.decks).filter(d => d.registered).map(d => d.id);
const C = { firstWins: 0, decisive: 0, capped: 0, turns: 0, ownTurns: 0, emptyTurns: 0, landTurns5: 0, landsPlayed5: 0, unspent: 0, attackChances: 0, attacked: 0, blockersAvail: 0, blocksMade: 0, instWindows: 0, instUsed: 0, casts: 0 };
const t0 = Date.now();
for (let g = 0; g < games; g++) {
  const decks = g % 2 ? [ids[1], ids[0]] : [ids[0], ids[1]];
  let s = MF.newGame({ seed: seed0 + g, decks: decks });
  let turnActs = null, lastTurn = -1;
  for (let n = 0; s.winner == null; n++) {
    if (s.turn > 40) { C.capped++; break; }
    if (s.turn !== lastTurn && s.turn >= 1) {
      if (turnActs) { C.ownTurns++; if (!turnActs.land && !turnActs.cast && !turnActs.attack) C.emptyTurns++; }
      turnActs = { land: false, cast: false, attack: false }; lastTurn = s.turn;
    }
    const q = s.pending && s.pending.q;
    if (q && q.kind === 'attack' && !q.chosen.length) C.attackChances += q.opts.filter(o => o.id !== 'done').length;
    if (q && q.kind === 'block' && !Object.keys(q.assign).length) C.blockersAvail += new Set(q.opts.filter(o => o.iid != null).map(o => o.iid)).size;
    if (!q && s.priority != null && s.priority !== s.ap) {
      const inst = MF.legalActions(s).filter(a => a.type === 'cast');
      if (inst.length) C.instWindows++;
    }
    if (s.step === 'cleanup' && !q && s.priority == null) { /* not reached: cleanup has no priority */ }
    const a = MF.ai.choose(s);
    if (!q && s.priority != null && s.priority !== s.ap && a.type === 'cast') C.instUsed++;
    const before = s.log.length;
    s = MF.apply(s, a);
    for (const e of s.log.slice(before)) {
      if (e.t === 'land' && e.who === s.ap) { turnActs.land = true; if (s.turn <= 10) { C.landsPlayed5++; } }
      if (e.t === 'cast') { C.casts++; if (e.who === s.ap) turnActs.cast = true; }
      if (e.t === 'attackers' && e.cs.length) { turnActs.attack = true; C.attacked += e.cs.length; }
      if (e.t === 'blockers') C.blocksMade += e.pairs.length;
      if (e.t === 'turn') {                                                                     // mana left unspent: untapped lands as the previous turn ended
        const prev = 1 - e.who;
        C.unspent += s.bf.filter(i => s.cards[i].ctrl === prev && MF.isType(s, i, 'Land') && !s.cards[i].tapped).length;
        if (e.n <= 10) C.landTurns5++;
      }
    }
  }
  C.turns += s.turn;
  if (s.winner === 0 || s.winner === 1) { C.decisive++; if (s.winner === s.players.findIndex((p, i) => i === firstOf(s))) C.firstWins++; }
}
function firstOf(s) { const e = s.log.find(e => e.t === 'first'); return e.first; }
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : 'n/a';
console.log(`${games} games, ${C.decisive} decisive, ${C.capped} capped at turn 40, mean turns ${(C.turns / games).toFixed(1)}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`first player wins ${pct(C.firstWins, C.decisive)} of decisive games`);
console.log(`lands played per turn, turns 1-10 (5 each): ${(C.landsPlayed5 / Math.max(1, C.landTurns5)).toFixed(2)}`);
console.log(`untapped lands left as a turn ends: ${(C.unspent / Math.max(1, C.ownTurns)).toFixed(2)} per turn`);
console.log(`attacks per creature able to attack: ${pct(C.attacked, C.attackChances)}`);
console.log(`blocks per creature able to block: ${pct(C.blocksMade, C.blockersAvail)}`);
console.log(`turns with no land, spell or attack: ${pct(C.emptyTurns, C.ownTurns)}`);
console.log(`opponent's-turn priority windows with a castable spell: ${C.instWindows}, used ${pct(C.instUsed, C.instWindows)}`);
console.log(`spells cast per game: ${(C.casts / games).toFixed(1)}`);
