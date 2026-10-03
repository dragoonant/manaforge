// Replays a bug report (the JSON the game's "Copy bug report" button produces) and says where it
// went wrong: ILLEGAL (an action the engine would not offer), THREW (apply raised), DIVERGED (the
// log length differs from the one recorded), or OK.
//   node tools/replay-report.mjs report.json [--tail N]
//   node tools/replay-report.mjs --selftest
import fs from 'node:fs';
import { loadEngine } from './load.mjs';
const MF = loadEngine();
const same = (a, b) => a.type === b.type && a.id === b.id && a.iid === b.iid && a.ab === b.ab;

export function replay(rep) {
  let s = MF.newGame({ seed: rep.seed, decks: rep.decks });
  for (let i = 0; i < rep.actions.length; i++) {
    const a = rep.actions[i];
    if (!MF.legalActions(s).some(l => same(l, a))) return { verdict: 'ILLEGAL', at: i, action: a, s };
    try { s = MF.apply(s, a); } catch (e) { return { verdict: 'THREW', at: i, action: a, error: e, s }; }
  }
  if (rep.log != null && rep.log !== s.log.length) return { verdict: 'DIVERGED', at: rep.actions.length, s, expected: rep.log, got: s.log.length };
  return { verdict: 'OK', s };
}

if (process.argv.includes('--selftest')) {
  const ids = Object.values(MF.decks).filter(d => d.registered).map(d => d.id);
  let s = MF.newGame({ seed: 4242, decks: [ids[0], ids[1]] });
  const actions = [];
  while (s.winner == null && actions.length < 300) { const a = MF.ai.choose(s); actions.push(a); s = MF.apply(s, a); }
  const good = replay({ seed: 4242, decks: [ids[0], ids[1]], actions, log: s.log.length });
  const bad1 = replay({ seed: 4242, decks: [ids[0], ids[1]], actions: actions.slice(0, 20).concat([{ type: 'cast', iid: 99999 }]) });
  const bad2 = replay({ seed: 4243, decks: [ids[0], ids[1]], actions: actions.slice(0, 40), log: 1 });
  const ok = good.verdict === 'OK' && bad1.verdict === 'ILLEGAL' && bad2.verdict !== 'OK';
  console.log(`selftest: replay ${good.verdict}, bad action ${bad1.verdict}, wrong seed ${bad2.verdict} -> ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}
const file = process.argv[2];
if (!file) { console.log('usage: node tools/replay-report.mjs report.json [--tail N]'); process.exit(2); }
const rep = JSON.parse(fs.readFileSync(file, 'utf8'));
const r = replay(rep);
const tail = process.argv.includes('--tail') ? +process.argv[process.argv.indexOf('--tail') + 1] : 25;
console.log(r.verdict + (r.at != null ? ' at action ' + r.at + ' ' + JSON.stringify(r.action || '') : '') + (r.error ? '\n' + r.error.stack.split('\n').slice(0, 6).join('\n') : ''));
for (const e of r.s.log.slice(-tail)) { const { t, turn, ...rest } = e; console.log(String(turn).padStart(2), t.padEnd(14), JSON.stringify(rest)); }
if (r.s.pending) console.log('pending:', JSON.stringify(r.s.pending.q).slice(0, 400));
