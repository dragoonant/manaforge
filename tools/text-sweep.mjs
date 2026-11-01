// The words sweep: plays random, mixed and AI games across random deck pairs and runs js/text.js on
// every state — each log line from both seats, each question's prompt, the Pass label — as the page
// does when it draws. A throw there takes the table down (js/ui.js render -> the crash modal), and
// "undefined", "NaN", "null" or "[object" in the words is a defect too. Engine throws (an AI
// roll-out included) are recorded as well. Keeps going after a failure: one line per distinct
// failure, with the count, and a bug report for the shortest game that hit it, which
// tools/replay-report.mjs replays.
//   node tools/text-sweep.mjs [--games N] [--seed S] [--ms budget] [--deck ID] [--out file.json]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadEngine, ROOT } from './load.mjs';
const MF = loadEngine();
const box = { window: { MF: MF }, console: console };
vm.createContext(box); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/text.js'), 'utf8'), box, { filename: 'js/text.js' });
const T = MF.text;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const games = +arg('games', 40), seed0 = +arg('seed', 1), ms = +arg('ms', 0), only = arg('deck', null), outFile = arg('out', null);
const ids = Object.values(MF.decks).filter(d => d.registered).map(d => d.id), cmd = id => !!MF.decks[id].commanders;   // CR 903: a Commander deck plays only another Commander deck
let rs = seed0 * 977 + 3; const rnd = n => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs % n; };
const fails = {};
function fail(e, rep, what) {
  const at = (String(e.stack).split('\n').find(l => /js\/\w+\.js:\d+/.test(l)) || '').match(/js\/\w+\.js:\d+/);
  const k = what + ': ' + String(e.message).replace(/\d+/g, 'N').slice(0, 110) + ' @ ' + (at ? at[0] : '?');
  const o = fails[k] = fails[k] || { n: 0, stack: String(e.stack).split('\n').slice(0, 6).join('\n'), report: null };
  o.n++; if (!o.report || rep.actions.length < o.report.actions.length) o.report = rep;
}
const words = (h, what) => { const t = String(h).replace(/<[^>]*>/g, ''); if (typeof h !== 'string' || /\bundefined\b|\bNaN\b|\[object|\bnull\b/.test(t)) throw new Error('suspicious words in ' + what + ': ' + t.slice(0, 160)); };
const t0 = Date.now(); let steps = 0, prompts = 0, lines = 0, g;
for (g = 0; g < games; g++) {
  if (ms && Date.now() - t0 > ms) break;
  const a = only || ids[rnd(ids.length)], same = ids.filter(x => cmd(x) === cmd(a)), b = same[rnd(same.length)];
  const seed = seed0 * 100000 + g, decks = [a, b], acts = [], pol = [rnd(3), rnd(3)];   // per seat: 0 random, 1 mixed, 2 the AI
  const rep = who => ({ v: 1, seed: seed, decks: decks, human: who, actions: acts.slice(), log: null });
  let s = MF.newGame({ seed: seed, decks: decks }), said = 0;
  try {
    for (let n = 0; s.winner == null && s.turn <= 35 && n < 6000; n++) {
      const who = MF.whoActs(s);
      for (; said < s.log.length; said++) for (const v of [0, 1]) { try { words(T.logLine(s.log[said], v), 'log ' + s.log[said].t); lines++; } catch (e) { fail(e, rep(v), 'log ' + s.log[said].t); } }
      if (s.pending) { const q = s.pending.q; try { const p = T.prompt(s, q, q.who); words(p.title, q.kind); words(p.body, q.kind); for (const k in p.labels) words(p.labels[k], q.kind); prompts++; } catch (e) { fail(e, rep(q.who), 'prompt ' + q.kind); } }
      const L = MF.legalActions(s); let act;
      if (L.some(l => l.type === 'pass')) try { words(T.passLabel(s, who), 'the Pass label'); } catch (e) { fail(e, rep(who), 'the Pass label'); }   // the page labels Pass only when it is offered
      if (pol[who] === 2 || (pol[who] === 1 && rnd(10) < 4)) act = MF.ai.choose(s);
      else {
        const can = rnd(25) === 0 ? L : L.filter(l => l.type !== 'cancel' && l.id !== 'undo');   // a cancel now and then: the page offers it
        const np = can.filter(l => l.type !== 'pass' && l.id !== 'done' && l.id !== 'no');
        act = (np.length && rnd(3) > 0) ? np[rnd(np.length)] : can.find(l => l.type === 'pass' || l.id === 'done') || can[rnd(can.length)] || L[0];
      }
      acts.push(act); s = MF.apply(s, act); steps++;
    }
  } catch (e) { fail(e, rep(0), 'engine'); }   // the last action is the one that threw (or the AI threw choosing the next)
}
const out = Object.entries(fails).map(([k, o]) => ({ failure: k, n: o.n, stack: o.stack, report: o.report }));
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`${g} games, ${steps} steps, ${prompts} prompts, ${lines} log lines, ${((Date.now() - t0) / 1000).toFixed(0)}s: ${out.length ? out.length + ' distinct failures' : 'no failures'}`);
for (const o of out) console.log(`  [${o.n}] ${o.failure}\n     report: ${JSON.stringify(o.report).length > 4000 ? '(long; --out writes it)' : JSON.stringify(o.report)}`);
process.exit(out.length ? 1 : 0);
