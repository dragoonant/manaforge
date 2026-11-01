// The words the player reads: js/text.js run against the engine's states. A prompt or log line that
// throws takes the whole table down (js/ui.js render -> the crash modal), so each test here is a
// state the page once could not draw.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from '../tools/load.mjs';
import { MF, test, eq, ok, setup, find, cast, activate, answer, resolveAll, player } from './harness.mjs';
const U = 'island', B = 'swamp', R = 'mountain', G = 'forest';
const box = { window: { MF: MF }, console: console };
vm.createContext(box); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/text.js'), 'utf8'), box, { filename: 'js/text.js' });
const T = MF.text;
const plain = h => h.replace(/<[^>]*>/g, '');
const clean = (h, what) => { ok(typeof h === 'string' && !/\bundefined\b|\bNaN\b|\[object|\bnull\b/.test(plain(h)), what + ' reads cleanly: ' + plain(String(h))); return plain(h); };
// Everything the page would say about this state, from both seats.
function speak(s) {
  for (const e of s.log) for (const v of [0, 1]) clean(T.logLine(e, v), 'log ' + e.t);
  if (s.winner == null) clean(T.passLabel(s, MF.whoActs(s)), 'the Pass label');
  if (!s.pending) return null;
  const q = s.pending.q, p = T.prompt(s, q, q.who);
  clean(p.title, q.kind + ' title'); clean(p.body, q.kind + ' body');
  for (const k in p.labels) clean(p.labels[k], q.kind + ' label');
  return p;
}
const passUntil = (s, f) => { for (let g = 0; g < 50 && !f(s); g++) s = MF.apply(s, { type: 'pass' }); ok(f(s), 'reached the state'); return s; };

test('Tainted Pact: the "put it into your hand?" prompt names the exiled card (the question is asked before the move is kept)', () => {
  let s = setup({ me: { hand: ['tainted-pact'], bf: [B, B], lib: [U, 'opt', U] } });
  s = cast(s, 'tainted-pact', 'auto'); s = passUntil(s, t => t.pending);
  eq(s.pending.q.kind, 'taintedTake');
  ok(speak(s).title.includes('Island'), 'the prompt names the Island');
});
test('Lion\'s Eye Diamond: discarding the hand as a cost has a log line', () => {
  let s = setup({ me: { hand: ['opt', 'burst-lightning'], bf: ['lions-eye-diamond'] } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'mana' && s.cards[a.iid].id === 'lions-eye-diamond')); s = answer(s, ['RRR']);
  ok(s.log.some(e => e.t === 'discardHand'), 'logged'); speak(s);
});
test('Start your engines! (CR 702.179d): Pass names the speed trigger, which has no source card', () => {
  let s = setup({ me: { hand: ['lightning-strike'], bf: ['perilous-snare', 'mountain', 'mountain', 'token-doombot'] } });
  s = cast(s, 'lightning-strike', player(1));
  s = passUntil(s, t => t.stack.length && t.stack[t.stack.length - 1].srcId === 'speed');
  ok(T.passLabel(s, MF.whoActs(s)).includes('Speed'), 'the label names it'); speak(s);
});
test('Korvold: "sacrifice another permanent" has a prompt and labels its choices', () => {
  let s = setup({ me: { hand: ['korvold-fae-cursed-king'], bf: [B, R, G, 'sol-ring', 'sol-ring'], lib: ['plains', 'plains', 'plains'] } });
  s = cast(s, 'korvold-fae-cursed-king', 'auto'); s = passUntil(s, t => t.pending);
  eq(s.pending.q.kind, 'sacrifice');
  const p = speak(s); ok(p.title.includes('Korvold'), 'names its source'); eq(p.labels[s.pending.q.opts[0].id], 'Sacrifice this');
  s = resolveAll(s, s.pending.q.opts[0].id); speak(s);
});
test('A noncreature token (Map, CR 111.10s) is logged without a power and toughness', () => {
  let s = setup({ me: { hand: ['spyglass-siren'], bf: [U, U], lib: ['opt', U] } });
  s = cast(s, 'spyglass-siren'); s = resolveAll(s);
  ok(s.log.some(e => e.t === 'token' && e.c === 'token-map'), 'a Map was made');
  speak(s);
});
test('Vivi Ornitier: the payment prompt says "use", not "tap" ({0}, no {T})', () => {
  let s = setup({ me: { hand: ['lightning-strike'], bf: [{ id: 'vivi-ornitier', ctr: { '+1/+1': 2 } }] } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'cast')); s = MF.apply(s, { type: 'answer', id: player(1) });
  eq(s.pending.q.kind, 'pay'); ok(speak(s).labels.auto.startsWith('Pay: use Vivi'), 'use');
});
test('United Battlefront: looking at seven and taking none has its own line, and the opponent learns only the count', () => {
  let s = setup({ me: { hand: ['united-battlefront'], bf: ['plains', 'plains', 'plains', 'plains'], lib: [U, U, U, U, U, U, U, U] } });
  s = cast(s, 'united-battlefront', 'auto'); s = resolveAll(s);
  const e = s.log.find(l => l.t === 'digOntoNone'); ok(e, 'logged');
  ok(!plain(T.logLine(e, 1)).includes('Island'), 'the opponent is not told the cards'); speak(s);
});
