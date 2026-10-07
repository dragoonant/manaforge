// tools/policy-sweep.mjs — random play at priority, the AI's own policy for every question, in every registered deck.
// The policies run only inside AI roll-outs, so a policy that answers something illegal shows up only here.
//   node tools/policy-sweep.mjs [games]
import { loadEngine } from './load.mjs';
const MF = loadEngine();
const ids = Object.values(MF.decks).filter(d => d.registered).map(d => d.id);
const games = +(process.argv[2] || 60);
let r = 777; const rnd = n => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r % n; };
const kinds = {};
for (let g = 0; g < games; g++) {
  const a = ids[g % ids.length], b = ids[(g * 3 + 1) % ids.length];
  let s = MF.newGame({ seed: 4000 + g, decks: [a, b] });
  try {
    for (let n = 0; s.winner == null && s.turn < 40 && n < 20000; n++) {
      if (s.pending) {
        const q = s.pending.q, ans = MF.aiPolicy(s, q);
        kinds[q.kind] = (kinds[q.kind] || 0) + 1;
        const id = ans !== undefined ? ans : q.opts[rnd(q.opts.length)].id;
        if (!q.opts.some(o => o.id === id)) throw new Error('policy for ' + q.kind + ' answered ' + JSON.stringify(id) + ', not an option: ' + JSON.stringify(q.opts.map(o => o.id)));
        s = MF.apply(s, { type: 'answer', id: id });
      } else {
        const L = MF.legalActions(s).filter(l => l.type !== 'cancel');
        const np = L.filter(l => l.type !== 'pass');
        s = MF.apply(s, np.length && rnd(3) > 0 ? np[rnd(np.length)] : L.find(l => l.type === 'pass'));
      }
    }
  } catch (e) { console.log('FAILED game', g, a, 'v', b, '\n', e.stack.split('\n').slice(0, 6).join('\n')); process.exit(1); }
}
console.log(games + ' games, every policy answer legal. Question kinds seen: ' + Object.keys(kinds).length);
