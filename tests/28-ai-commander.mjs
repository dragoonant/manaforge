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
test('AI: Commander mulligan (behind MF.aiWeights.cmdMulligan, off since its A/B) — fast mana counts as a land; a two-source hand with a tutor is kept', () => {
  const q = (s) => ({ who: 0, kind: 'mulligan', mulls: 0, opts: [{ id: 'keep' }, { id: 'mull' }] });
  const was = MF.aiWeights.cmdMulligan; MF.aiWeights.cmdMulligan = 1;
  try {
  let s = setup({ commander: true, me: { identity: ['U', 'B'], hand: [U, 'sol-ring', 'demonic-tutor', 'opt', 'force-of-will', 'opt', 'brain-freeze'] } });
  eq(MF.aiPolicy(s, q(s)), 'keep');
  let t = setup({ commander: true, me: { identity: ['U', 'B'], hand: [U, 'opt', 'opt', 'force-of-will', 'brain-freeze', 'gamble', 'silence'] } });
  eq(MF.aiPolicy(t, q(t)), 'mull', 'one source');
  } finally { MF.aiWeights.cmdMulligan = was; }
});
test('AI: Silence before the Oracle line when the opponent holds cards', () => {
  let s = setup({ me: { hand: ['thassas-oracle', 'demonic-consultation', 'silence'], bf: [U, U, B, 'plains'], lib: Array(20).fill(U) }, opp: { hand: ['force-of-will', U] } });
  const a = MF.ai.choose(s);
  eq(a.type === 'cast' && s.cards[a.iid].id, 'silence');
  s = aiPlay(s, x => x.winner != null);
  eq(s.winner, 0);
});
test('AI: Isochron Scepter with Dramatic Reversal and rocks mills the opponent out with Zellix', () => {
  let s = setup({ me: { bf: ['isochron-scepter', 'sol-ring', 'mana-vault', 'arcane-signet', 'zellix-sanity-flayer', U, B], grave: [] }, opp: { lib: Array(40).fill(R) } });
  const sc = find(s, 'isochron-scepter', 'bf'); s = MF.clone(s);
  const dr = s.nid++; s.cards[dr] = { iid: dr, id: 'dramatic-reversal', owner: 0, ctrl: 0, zone: 'exile', ts: s.ts++, tapped: false, dmg: 0, dt: false, ctr: {}, att: null, ctlTurn: 0 }; s.players[0].exile.push(dr); s.cards[sc].exiled = [dr];
  s = MF.run(s);
  s = aiPlay(s, x => x.players[1].lib.length === 0, 1500);
  eq(s.players[1].lib.length, 0);
});
test('AI: Najeela with five colours open in combat activates for an extra combat', () => {
  let s = setup({ me: { bf: ['najeela-the-blade-blossom', 'token-warrior-1-1-w', 'token-warrior-1-1-w', 'plains', U, B, R, 'forest'] }, opp: { life: 12 } });
  s = aiPlay(s, x => x.log.some(e => e.t === 'extraCombatAdded') || x.winner != null, 600);
  ok(s.log.some(e => e.t === 'extraCombatAdded') || s.winner === 0, 'an additional combat (or the game already won)');
});
test('AI: Ad Nauseam into Thassa\'s Oracle and Demonic Consultation (played out on reshuffled libraries first)', () => {
  let s = setup({ commander: true, me: { identity: ['U', 'B'], hand: ['ad-nauseam'], bf: [B, B, B, U, U, U, B, B], lib: ['thassas-oracle', 'demonic-consultation'].concat(Array(14).fill(U)) } });
  s = aiPlay(s, x => x.winner != null, 1500);
  eq(s.winner, 0);
});
test('AI: Food Chain with Squee — loops creature mana, recasts Terra from the command zone until its library is milled, then Thassa\'s Oracle', () => {
  let s = setup({ commander: true, me: { identity: ['U', 'R', 'G'], command: ['terra-magical-adept-esper-terra'], hand: ['thassas-oracle'], bf: ['food-chain', 'squee-the-immortal', U, U, R, 'forest'], lib: Array(22).fill(U) } });
  s = aiPlay(s, x => x.winner != null, 4000);
  eq(s.winner, 0);
  ok(logs(s, 'winBy').length === 1, 'by Thassa\'s Oracle');
});
