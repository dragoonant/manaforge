// Orzhov (Amalia Benavides Aguirre), Arena top-ranked Standard after the Hobbit release.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const W = 'plains', B = 'swamp', R = 'mountain';
const lands = (n, id) => Array(n).fill(id);
const toMyNext = (s, step, ...sc) => { s = toStep(s, 'end', ...sc); s = resolveAll(s); for (let g = 0; g < 8 && !(s.ap === 0 && s.step === step); g++) { s = toStep(s, step === 'main1' ? 'main1' : step, 'done', 'done'); if (s.ap !== 0) { s = toStep(s, 'end', 'done', 'done'); s = resolveAll(s); } } return s; };

test('Haliya: it or another creature or artifact entering gains 1; at my end step, draw if I gained 3 or more this turn', () => {
  let s = setup({ me: { hand: ['haliya-guided-by-light', 'hop-to-it'], bf: lands(6, W), lib: ['opt', W] } });
  s = cast(s, 'haliya-guided-by-light'); s = resolveAll(s);
  s = cast(s, 'hop-to-it'); s = resolveAll(s);
  eq(s.players[0].life, 24, '1 + 3');
  s = toStep(s, 'end', 'done'); s = resolveAll(s);
  eq(s.players[0].hand.length, 1, 'drew at the end step');
});
test('Haliya: warp {W} (CR 702.185) — exiled at the end step, castable from exile only on a later turn', () => {
  let s = setup({ me: { hand: ['haliya-guided-by-light'], bf: [W, W, W] } });
  const a = MF.legalActions(s).find(l => l.via === 'warp'); ok(a, 'warp offered');
  s = MF.apply(s, a); s = answer(s, []); s = resolveAll(s);
  s = toStep(s, 'end', q => q.opts[0].id); s = resolveAll(s);
  const h = find(s, 'haliya-guided-by-light', 'exile'); ok(h, 'exiled');
  ok(!MF.legalActions(s).some(l => l.iid === h), 'not this turn');
  ok(s.effects.some(e => e.k === 'mayPlay' && e.iid === h && e.afterTurn === s.turn), 'castable after this turn');
  const t2 = MF.clone(s); t2.turn++; for (const i of t2.bf) t2.cards[i].tapped = false; ok(MF.legalActions(MF.run(Object.assign(t2, { step: 'main1', ap: 0, priority: 0, stack: [] }))).some(l => l.iid === h), 'castable on a later turn');
});
test('Essence Channeler: flying and vigilance once I’ve lost life this turn; +1/+1 per life gain; its counters move when it dies', () => {
  let s = setup({ me: { hand: ['cut-down'], bf: ['essence-channeler', 'hinterland-sanctifier', 'warren-elder', B] } });
  const e = find(s, 'essence-channeler');
  ok(!has(s, e, 'flying'), 'no flying yet');
  s = MF.clone(s); MF.loseLife(s, 0, 1, 'effect', null); s = MF.run(s);
  ok(has(s, e, 'flying') && has(s, e, 'vigilance'), 'flying and vigilance');
  s = MF.clone(s); MF.gainLife(s, 0, 2, { name: 'test' }); s = MF.run(s); s = resolveAll(s);
  eq(s.cards[e].ctr['+1/+1'], 1, 'one counter per life-gain event');
  s = cast(s, 'cut-down', tgt(e)); s = resolveAll(s, tgt(find(s, 'warren-elder')));
  eq(pt(s, find(s, 'warren-elder')), [3, 3], 'the Elder got its counter');
});
test('Amalia: ward—pay 3 life (CR 702.21) — the opponent is asked; declining counters their spell', () => {
  let s = setup({ me: { bf: ['amalia-benavides-aguirre'] }, opp: { hand: ['lightning-strike'], bf: [R, R] } });
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  s = cast(s, 'lightning-strike', tgt(find(s, 'amalia-benavides-aguirre')));
  s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  eq(s.pending.q.kind, 'wardPay'); eq(s.pending.q.who, 1);
  s = answer(s, ['decline']); s = resolveAll(s);
  ok(find(s, 'amalia-benavides-aguirre', 'bf'), 'Amalia survives'); eq(logs(s, 'countered').length, 1);
});
test('Amalia: whenever I gain life she explores (CR 701.44); at exactly 20 power, all other creatures are destroyed', () => {
  let s = setup({ me: { bf: [{ id: 'amalia-benavides-aguirre', ctr: { '+1/+1': 17 } }, 'warren-elder'], lib: ['opt', W] }, opp: { bf: ['quaketusk-boar'] } });
  s = MF.clone(s); MF.gainLife(s, 0, 1, { name: 'test' }); s = MF.run(s); s = resolveAll(s, 'top');
  eq(pt(s, find(s, 'amalia-benavides-aguirre')), [20, 20]);
  eq(s.bf.filter(i => MF.isType(s, i, 'Creature')).length, 1, 'everything else destroyed');
  let t = setup({ me: { bf: ['amalia-benavides-aguirre'], lib: [W, 'opt'] } });
  t = MF.clone(t); MF.gainLife(t, 0, 1, { name: 'test' }); t = MF.run(t); t = resolveAll(t);
  ok(t.players[0].hand.some(i => t.cards[i].id === 'plains'), 'a land goes to hand'); eq(pt(t, find(t, 'amalia-benavides-aguirre')), [2, 2]);
});
test('Lunar Convocation: end step — gained life: each opponent loses 1; gained and lost: a 1/1 flying Bat; {1}{B}, pay 2 life: draw', () => {
  let s = setup({ me: { bf: ['lunar-convocation', B, B], lib: ['opt', W, W] } });
  s = MF.clone(s); MF.gainLife(s, 0, 1, { name: 'test' }); MF.loseLife(s, 0, 1, 'effect', null); s = MF.run(s);
  s = activate(s, 'lunar-convocation'); s = resolveAll(s);
  eq(s.players[0].life, 18); eq(s.players[0].hand.length, 1);
  s = toStep(s, 'end', q => q.opts[0].id); s = resolveAll(s);
  eq(s.players[1].life, 19); eq(findAll(s, 'token-bat-1-1-b-flying', 'bf').length, 1);
});
test('Case of the Uneaten Feast: creatures entering gain 1; solved at my end step with 5 life gained (CR 719.3); then creature cards are castable from my graveyard', () => {
  let s = setup({ me: { hand: ['hop-to-it', 'hop-to-it'], bf: ['case-of-the-uneaten-feast', ...lands(7, W)], grave: ['warren-elder'] } });
  s = cast(s, 'hop-to-it'); s = resolveAll(s); s = cast(s, 'hop-to-it'); s = resolveAll(s);
  const cs = find(s, 'case-of-the-uneaten-feast');
  ok(!MF.legalActions(s).some(a => a.type === 'act' && a.iid === cs), 'not solved yet: no sacrifice ability');
  s = toStep(s, 'end', 'done'); s = resolveAll(s);
  ok(s.cards[cs].solved, 'solved');
  let t = setup({ me: { bf: [{ id: 'case-of-the-uneaten-feast' }, W, W], grave: ['warren-elder'] } });
  t.cards[find(t, 'case-of-the-uneaten-feast')].solved = true;
  t = activate(t, 'case-of-the-uneaten-feast'); t = resolveAll(t);
  ok(MF.legalActions(t).some(a => a.type === 'cast' && t.cards[a.iid].id === 'warren-elder'), 'the Elder can be cast from the graveyard');
});
test('Moseo: a Pest that gains 1 when it attacks; infusion returns a creature card with mana value up to the life gained', () => {
  let s = setup({ me: { hand: ['moseo-veins-new-dean'], bf: [B, B, B], grave: ['warren-elder', 'quaketusk-boar'] } });
  s = cast(s, 'moseo-veins-new-dean'); s = resolveAll(s);
  const pest = findAll(s, 'token-pest-1-1-bg-whenever-this-token-attacks-you-gain-life', 'bf'); eq(pest.length, 1);
  s = MF.clone(s); MF.gainLife(s, 0, 2, { name: 'test' }); s = MF.run(s);
  s = toStep(s, 'end');
  eq(s.pending.q.opts.filter(o => o.iid != null).map(o => s.cards[o.iid].id), ['warren-elder'], 'mana value 2 or less only');
  s = answer(s, [s.pending.q.opts.find(o => o.iid != null).id]); s = resolveAll(s);
  ok(find(s, 'warren-elder', 'bf'), 'returned');
});
test('Deep-Cavern Bat: look at their hand, exile a nonland card until the Bat leaves (CR 610.3)', () => {
  let s = setup({ me: { hand: ['deep-cavern-bat', 'cut-down'], bf: [B, B, B] }, opp: { hand: ['lightning-strike', R] } });
  s = cast(s, 'deep-cavern-bat'); s = resolveAll(s, player(1), q => q.opts.find(o => o.iid != null).id);
  ok(s.players[1].exile.some(i => s.cards[i].id === 'lightning-strike'), 'exiled'); eq(logs(s, 'lookHand').length, 1);
  s = cast(s, 'cut-down', tgt(find(s, 'deep-cavern-bat'))); s = resolveAll(s);
  ok(s.players[1].hand.some(i => s.cards[i].id === 'lightning-strike'), 'back in hand');
});
test('Aunt May: another creature entering gains 1 (not a Spider: no counter)', () => {
  let s = setup({ me: { hand: ['warren-elder'], bf: ['aunt-may', W, W] } });
  s = cast(s, 'warren-elder'); s = resolveAll(s);
  eq(s.players[0].life, 21); eq(pt(s, find(s, 'warren-elder')), [2, 2]);
});
test('Enduring Innocence: draws once a turn for small creatures entering; dies → returns as an enchantment, not a creature', () => {
  let s = setup({ me: { hand: ['hop-to-it', 'hop-to-it', 'cut-down'], bf: ['enduring-innocence', ...lands(7, W), B], lib: ['opt', W, W] } });
  s = cast(s, 'hop-to-it'); s = resolveAll(s); s = cast(s, 'hop-to-it'); s = resolveAll(s);
  eq(s.players[0].hand.length, 2, 'one draw this turn (Cut Down and the drawn card)');
  s = cast(s, 'cut-down', tgt(find(s, 'enduring-innocence'))); s = resolveAll(s);
  const e = find(s, 'enduring-innocence', 'bf'); ok(e, 'returned');
  eq(MF.chars(s, e).types, ['Enchantment']); eq(MF.chars(s, e).subtypes, []);
});
test('Starscape Cleric: whenever I gain life, each opponent loses 1; it can’t block', () => {
  let s = setup({ me: { bf: ['starscape-cleric'] } });
  s = MF.clone(s); MF.gainLife(s, 0, 3, { name: 'test' }); s = MF.run(s); s = resolveAll(s);
  eq(s.players[1].life, 19); ok(MF.restricted(s, find(s, 'starscape-cleric'), 'block'), 'can’t block');
});
