// Gruul Delirium (Pro Tour Final Fantasy, #35 — Shintaro Ishimura): one behaviour test per new card.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const F = 'forest', M = 'mountain';
const DELIRIUM = ['lightning-strike', 'forest', 'quaketusk-boar', 'colossification'];          // instant, land, creature, enchantment: four card types

test('Patchwork Beastie: can’t attack or block without delirium; may mill a card at your upkeep', () => {
  let s = setup({ me: { bf: ['patchwork-beastie'] } });
  ok(!MF.canAttack(s, find(s, 'patchwork-beastie')), 'no delirium: cannot attack');
  s = setup({ me: { bf: ['patchwork-beastie'], grave: DELIRIUM } });
  ok(MF.canAttack(s, find(s, 'patchwork-beastie')), 'delirium: can attack');
  let t = setup({ me: { bf: ['patchwork-beastie'], lib: ['opt', F, F, F, F, F] } });
  t = toStep(t, 'end', 'done'); t = toStep(t, 'upkeep', 'done');
  t = toStep(t, 'upkeep');
  while (t.ap !== 0 || t.step !== 'upkeep' || !(t.pending || t.stack.length)) t = t.pending ? answer(t, ['done']) : MF.apply(t, { type: 'pass' });
  t = resolveAll(t, 'yes');
  ok(t.players[0].grave.some(i => t.cards[i].id === 'opt'), 'milled Opt at the upkeep');
});
test('Wildfire Wickerfolk: +1/+1 and trample only with delirium', () => {
  let s = setup({ me: { bf: ['wildfire-wickerfolk'] } });
  eq(pt(s, find(s, 'wildfire-wickerfolk')), [3, 2]);
  s = setup({ me: { bf: ['wildfire-wickerfolk'], grave: DELIRIUM } });
  eq(pt(s, find(s, 'wildfire-wickerfolk')), [4, 3]); ok(has(s, find(s, 'wildfire-wickerfolk'), 'trample'), 'trample');
});
test('Violent Urge: +1/+0 and first strike; with delirium also double strike', () => {
  let s = setup({ me: { hand: ['violent-urge'], bf: ['warren-elder', M] } });
  const e = find(s, 'warren-elder');
  s = cast(s, 'violent-urge', tgt(e)); s = resolveAll(s);
  ok(has(s, e, 'firstStrike') && !has(s, e, 'doubleStrike'), 'first strike only');
  s = setup({ me: { hand: ['violent-urge'], bf: ['warren-elder', M], grave: DELIRIUM } });
  s = cast(s, 'violent-urge', tgt(find(s, 'warren-elder'))); s = resolveAll(s);
  ok(has(s, find(s, 'warren-elder'), 'doubleStrike'), 'double strike with delirium');
});
test('Bushwhack: modal (CR 700.2) — a basic land to hand, or a fight (CR 701.14)', () => {
  let s = setup({ me: { hand: ['bushwhack'], bf: [F], lib: ['forest', 'opt'] } });
  s = cast(s, 'bushwhack', 0); s = resolveAll(s, q => q.opts.find(o => o.iid != null).id);
  ok(s.players[0].hand.some(i => s.cards[i].id === 'forest'), 'Forest to hand');
  let t = setup({ me: { hand: ['bushwhack'], bf: [F, 'quaketusk-boar'] }, opp: { bf: ['warren-elder'] } });
  t = cast(t, 'bushwhack', 1, tgt(find(t, 'quaketusk-boar')), tgt(find(t, 'warren-elder'))); t = resolveAll(t);
  ok(t.players[1].grave.some(i => t.cards[i].id === 'warren-elder'), 'the Elder died'); eq(t.cards[find(t, 'quaketusk-boar')].dmg, 2, 'the Boar took 2');
});
test('Bushwhack: the fight mode is not offered with no creature of yours (CR 700.2a)', () => {
  let s = setup({ me: { hand: ['bushwhack'], bf: [F] }, opp: { bf: ['warren-elder'] } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'cast'));
  eq(s.pending.q.opts.map(o => o.id), [0], 'only the search mode');
});
test('Seed of Hope: mill two, may take a milled permanent card, gain 2', () => {
  let s = setup({ me: { hand: ['seed-of-hope'], bf: [F], lib: ['quaketusk-boar', 'opt', F] } });
  s = cast(s, 'seed-of-hope'); s = resolveAll(s, q => q.opts.find(o => o.iid != null).id);
  ok(s.players[0].hand.some(i => s.cards[i].id === 'quaketusk-boar'), 'the Boar to hand'); ok(s.players[0].grave.some(i => s.cards[i].id === 'opt'), 'Opt stays milled'); eq(s.players[0].life, 22);
});
test('Break Out: a creature of mana value 2 or less may go onto the battlefield with haste; the rest to the bottom', () => {
  let s = setup({ me: { hand: ['break-out'], bf: [F, M], lib: ['opt', 'wildfire-wickerfolk', F, F, F, F, 'island'] } });
  s = cast(s, 'break-out'); s = resolveAll(s, (q, st) => q.opts.find(o => o.iid != null && MF.view(st).cards[o.iid].id === 'wildfire-wickerfolk').id, 'yes');
  const w = find(s, 'wildfire-wickerfolk', 'bf');
  ok(has(s, w, 'haste'), 'haste'); eq(s.cards[s.players[0].lib[0]].id, 'island', 'the seventh card is now on top');
});
test('Keen-Eyed Curator: {1}: exile target card from a graveyard; four card types exiled with it → +4/+4 and trample', () => {
  let s = setup({ me: { bf: ['keen-eyed-curator', F, F, F, F] }, opp: { grave: DELIRIUM } });
  const k = find(s, 'keen-eyed-curator');
  for (let n = 0; n < 4; n++) { s = activate(s, 'keen-eyed-curator', null, q => q.opts[0].id); s = resolveAll(s); }
  eq(s.players[1].exile.length, 4); eq(pt(s, k), [7, 7]); ok(has(s, k, 'trample'), 'trample');
});
test('Fear of Missing Out: enters → discard, then draw; first attack with delirium untaps and adds a combat phase (CR 500.8)', () => {
  let s = setup({ me: { hand: ['fear-of-missing-out', F], bf: [M, M], lib: ['opt', F, F] } });
  s = cast(s, 'fear-of-missing-out'); s = resolveAll(s, q => q.opts[0].id);
  eq(s.players[0].hand.length, 1, 'discarded one, drew one');
  let t = setup({ me: { bf: ['fear-of-missing-out'], grave: DELIRIUM } });
  const f = find(t, 'fear-of-missing-out');
  t = toStep(t, 'attackers'); t = answer(t, [f, 'done']); t = resolveAll(t, tgt(f));
  ok(!t.cards[f].tapped, 'untapped'); eq(t.extraCombat, 1);
  t = toStep(t, 'eoc', 'done');
  t = MF.apply(t, { type: 'pass' }); t = MF.apply(t, { type: 'pass' });
  eq(t.step, 'boc', 'a second combat phase'); ok(logs(t, 'extraCombat').length === 1);
});
