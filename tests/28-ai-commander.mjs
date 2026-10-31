// The AI with the championship Commander decks (PLAN D24): win lines it must find, threats it must stop.
import { MF, test, eq, ok, setup, find, logs } from './harness.mjs';
const U = 'island', B = 'swamp', R = 'mountain';
// Let the AI play both seats until `done(s)` or the turn ends.
const aiPlay = (s, done, limit = 400) => { const t0 = s.turn; for (let k = 0; k < limit && s.winner == null && !done(s) && s.turn === t0; k++) s = MF.apply(s, MF.ai.choose(s)); return s; };

test('AI: Thassa\'s Oracle with Demonic Consultation — it exiles its library and wins the same turn', () => {
  let s = setup({ me: { hand: ['thassas-oracle', 'demonic-consultation', U], bf: [U, U, B], lib: Array(30).fill(U).concat(['sol-ring']) } });
  s = aiPlay(s, x => x.winner != null);
  eq(s.winner, 0, 'it wins');
  ok(logs(s, 'winBy').length === 1, 'by Thassa\'s Oracle');
});
test('AI: Thassa\'s Oracle with Tainted Pact (a singleton library) — it wins', () => {
  let s = setup({ me: { hand: ['thassas-oracle', 'tainted-pact'], bf: [U, U, B, B], lib: ['sol-ring', 'opt', 'force-of-will', 'mox-diamond', 'brain-freeze', 'gamble'] } });
  s = aiPlay(s, x => x.winner != null);
  eq(s.winner, 0);
});
test('AI: without the mana for both, it doesn\'t start the Oracle line (exiling its own library would lose)', () => {
  let s = setup({ me: { hand: ['thassas-oracle', 'demonic-consultation'], bf: [B], lib: Array(30).fill(U) } });
  ok(MF.aiPlanLine(s, 0) == null, 'no line');
  s = aiPlay(s, () => false);
  ok(s.players[0].lib.length > 20, 'its library is intact');
});
test('AI: Underworld Breach, Lion\'s Eye Diamond and Brain Freeze — it mills the opponent\'s library away', () => {
  let s = setup({ me: { hand: ['underworld-breach', 'lions-eye-diamond', 'brain-freeze', 'opt', 'gamble'], bf: [R, U, U, B], grave: [U, U, U, B, B, B], lib: Array(70).fill(U) }, opp: { lib: Array(60).fill(R) } });
  s = aiPlay(s, x => x.players[1].lib.length === 0, 900);
  eq(s.players[1].lib.length, 0, 'the opponent\'s library is empty');
});
test('AI: it counters an opponent\'s tutor with Force of Will\'s alternative cost', () => {
  let s = setup({ me: { hand: ['force-of-will', 'opt'] }, opp: { hand: ['demonic-tutor'], bf: [B, B] } });
  s = MF.clone(s); s.ap = 1; s.priority = 1; s = MF.run(s);
  const a = MF.legalActions(s).find(l => l.type === 'cast' && s.cards[l.iid].id === 'demonic-tutor'); s = MF.apply(s, a);
  while (s.pending) s = MF.apply(s, MF.ai.choose(s));
  s = MF.apply(s, { type: 'pass' });
  eq(MF.whoActs(s), 0);
  const c = MF.ai.choose(s);
  ok(c.type === 'cast' && s.cards[c.iid].id === 'force-of-will', 'it casts Force of Will: ' + JSON.stringify(c));
});
test('AI: a tutor finds the missing piece of a win line (Demonic Tutor gets Demonic Consultation to go with Thassa\'s Oracle)', () => {
  let s = setup({ me: { hand: ['demonic-tutor', 'thassas-oracle'], bf: [B, B], lib: [U, 'sol-ring', 'demonic-consultation', 'force-of-will', U, U] } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'cast' && s.cards[a.iid].id === 'demonic-tutor'));
  const inHand = st => st.players[0].hand.some(i => st.cards[i].id === 'demonic-consultation');
  for (let k = 0; k < 30 && !inHand(s) && s.turn === 3; k++) s = MF.apply(s, MF.ai.choose(s));
  ok(inHand(s), 'Consultation is in hand');
});
test('AI: it doesn\'t cast Final Fortune or a Pact it can\'t pay for (the loss is past its one-turn horizon)', () => {
  let s = setup({ me: { hand: ['final-fortune', 'summoners-pact'], bf: [R, R], lib: [U, U, 'the-cabbage-merchant'] } });
  for (let k = 0; k < 40 && s.turn === 3 && s.winner == null; k++) s = MF.apply(s, MF.ai.choose(s));
  ok(s.players[0].hand.length === 2, 'both still in hand: ' + s.players[0].hand.map(i => s.cards[i].id));
});
