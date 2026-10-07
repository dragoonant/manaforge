// Dimir Midrange (Pro Tour Final Fantasy): planeswalkers, ninjutsu, transforming cards, and each new card.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const U = 'island', B = 'swamp';
const lands = (n, id) => Array(n).fill(id);
// Pass (declining attacks and blocks) until the opponent's draw step.
const toOppDraw = s => { for (let g = 0; g < 400 && !(s.ap === 1 && s.step === 'draw'); g++) s = s.pending ? MF.apply(s, { type: 'answer', id: s.pending.q.opts.some(o => o.id === 'done') ? 'done' : s.pending.q.opts[0].id }) : MF.apply(s, { type: 'pass' }); if (!(s.ap === 1 && s.step === 'draw')) throw new Error('never reached the opponent’s draw'); return s; };
const loyaltyAb = (s, iid, n) => MF.chars(s, iid).ab.findIndex(a => a.loyalty === n);

test('Kaito: enters with 4 loyalty (CR 306.5b); on my turn a 3/4 Ninja creature with hexproof; loyalty abilities once a turn (606.3)', () => {
  let s = setup({ me: { hand: ['kaito-bane-of-nightmares'], bf: [...lands(2, U), ...lands(2, B)], lib: ['opt', U, U, U] }, opp: { bf: ['warren-elder'] } });
  s = cast(s, 'kaito-bane-of-nightmares'); s = resolveAll(s);
  const k = find(s, 'kaito-bane-of-nightmares', 'bf');
  eq(s.cards[k].ctr.loyalty, 4); eq(MF.chars(s, k).types, ['Creature']); eq(pt(s, k), [3, 4]); ok(has(s, k, 'hexproof'), 'hexproof');
  s = activate(s, 'kaito-bane-of-nightmares', loyaltyAb(s, k, 1)); s = resolveAll(s);
  eq(s.cards[k].ctr.loyalty, 5); eq((s.emblems || []).length, 1); eq(pt(s, k), [4, 5], 'the emblem pumps Ninjas, Kaito included');
  ok(!MF.legalActions(s).some(a => a.type === 'act' && a.iid === k), 'once a turn');
});
test('Kaito on the opponent’s turn is a planeswalker: attacked (CR 508.1b), damage removes loyalty (120.3c), 0 loyalty → graveyard (704.5i)', () => {
  let s = setup({ me: { bf: ['quaketusk-boar'] }, opp: { bf: [{ id: 'kaito-bane-of-nightmares', ctr: { loyalty: 4 } }] } });
  const k = find(s, 'kaito-bane-of-nightmares');
  eq(MF.chars(s, k).types, ['Planeswalker'], 'not a creature on my turn');
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'quaketusk-boar'), 'done', 'c' + k]);
  s = toStep(s, 'eoc');
  ok(s.players[1].grave.some(i => s.cards[i].id === 'kaito-bane-of-nightmares'), '5 damage, 4 loyalty: gone'); eq(s.players[1].life, 20);
});
test('Kaito: ninjutsu (CR 702.49) — return an unblocked attacker; he enters tapped and attacking, deals combat damage', () => {
  let s = setup({ me: { hand: ['kaito-bane-of-nightmares'], bf: ['warren-elder', U, B, B] } });
  const e = find(s, 'warren-elder');
  s = toStep(s, 'attackers'); s = answer(s, [e, 'done']); s = toStep(s, 'blockers');
  s = activate(s, 'kaito-bane-of-nightmares', null, e); s = resolveAll(s);
  const k = find(s, 'kaito-bane-of-nightmares', 'bf'); ok(s.combat.attackers.includes(k) && s.cards[k].tapped, 'attacking');
  ok(s.players[0].hand.some(i => s.cards[i].id === 'warren-elder'), 'the Elder returned');
  s = toStep(s, 'eoc'); eq(s.players[1].life, 17);
});
test('Sheoldred: I draw → gain 2; the opponent draws → they lose 2', () => {
  let s = setup({ me: { hand: ['opt'], bf: ['sheoldred-the-apocalypse', U], lib: ['opt', U] }, opp: { lib: ['opt', U, U] } });
  s = cast(s, 'opt'); s = resolveAll(s, 'top');
  eq(s.players[0].life, 22);
  s = toOppDraw(s);
  s = resolveAll(s); eq(s.players[1].life, 18);
});
test('Cecil: damage makes me lose that much; at half my starting life it untaps and transforms (CR 701.27) into a lifelinker', () => {
  let s = setup({ me: { bf: ['cecil-dark-knight-cecil-redeemed-paladin'], life: 11 } });
  const c = find(s, 'cecil-dark-knight-cecil-redeemed-paladin');
  s = toStep(s, 'attackers'); s = answer(s, [c, 'done']); s = toStep(s, 'eoc'); s = resolveAll(s);
  eq(s.players[0].life, 9); ok(s.cards[c].transformed, 'transformed'); ok(!s.cards[c].tapped, 'untapped');
  eq(MF.chars(s, c).name, 'Cecil, Redeemed Paladin'); ok(has(s, c, 'lifelink'), 'lifelink'); eq(pt(s, c), [4, 4]); eq(MF.chars(s, c).mv, 1, 'mana value of the front face (CR 712.8e)');
});
test('Azure Beastbinder: power 2+ can’t block it; its attack strips a creature to a vanilla 2/2 until my next turn', () => {
  let s = setup({ me: { bf: ['azure-beastbinder'] }, opp: { bf: ['quaketusk-boar', 'heartfire-hero'] } });
  const a = find(s, 'azure-beastbinder'), boar = find(s, 'quaketusk-boar');
  s = toStep(s, 'attackers'); s = answer(s, [a, 'done']); s = resolveAll(s, tgt(boar));
  eq(pt(s, boar), [2, 2]); ok(!has(s, boar, 'trample'), 'lost trample');
  ok(!MF.canBlock(s, boar, a), 'power 2 can’t block it'); ok(MF.canBlock(s, find(s, 'heartfire-hero'), a), 'power 1 can');
});
test('Enduring Curiosity: a creature of mine deals combat damage to a player → draw', () => {
  let s = setup({ me: { bf: ['enduring-curiosity', 'warren-elder'], lib: ['opt', U] } });
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'warren-elder'), 'done']); s = toStep(s, 'eoc'); s = resolveAll(s);
  eq(s.players[0].hand.length, 1);
});
test('Faerie Mastermind: the opponent’s second card drawn in a turn → I draw', () => {
  let s = setup({ me: { bf: ['faerie-mastermind', ...lands(8, U)], lib: ['opt', U, U, U] }, opp: { lib: ['opt', U, U] } });
  s = activate(s, 'faerie-mastermind', 1); s = resolveAll(s);
  eq(s.players[0].hand.length, 1, 'their first card this turn: no trigger');
  s = activate(s, 'faerie-mastermind', 1); s = resolveAll(s);
  eq(s.players[0].hand.length, 3, 'the activation, then the Mastermind trigger');
});
test('Floodpits Drowner: tap and stun on entering; {1}{U},{T}: shuffle itself and a stunned creature into their libraries', () => {
  let s = setup({ me: { hand: ['floodpits-drowner'], bf: lands(4, U) }, opp: { bf: ['quaketusk-boar'] } });
  s = cast(s, 'floodpits-drowner'); s = resolveAll(s, tgt(find(s, 'quaketusk-boar')));
  const b = find(s, 'quaketusk-boar'); ok(s.cards[b].tapped, 'tapped'); eq(s.cards[b].ctr.stun, 1);
  s.cards[find(s, 'floodpits-drowner')].ctlTurn = 0;
  s = activate(s, 'floodpits-drowner', null, tgt(b)); s = resolveAll(s);
  ok(s.players[1].lib.some(i => s.cards[i].id === 'quaketusk-boar') && s.players[0].lib.some(i => s.cards[i].id === 'floodpits-drowner'), 'both shuffled in');
});
test('Vren: an opponent’s creature that would die is exiled; at each end step, a Rat per such creature, +1/+1 for each other Rat', () => {
  let s = setup({ me: { hand: ['cut-down', 'cut-down'], bf: ['vren-the-relentless', B, B] }, opp: { bf: ['warren-elder', 'heartfire-hero'] } });
  s = cast(s, 'cut-down', tgt(find(s, 'warren-elder'))); s = resolveAll(s); s = cast(s, 'cut-down', tgt(find(s, 'heartfire-hero'))); s = resolveAll(s);
  eq(s.players[1].exile.length, 2); eq(s.players[1].grave.length, 0);
  s = toStep(s, 'end', 'done'); s = resolveAll(s);
  const rats = findAll(s, 'token-rat-1-1-b-this-token-gets-for-each-other-rat-you-control', 'bf'); eq(rats.length, 2);
  eq(pt(s, rats[0]), [3, 3], '1/1 + Vren (a Rat) + the other token');
});
test('Gix’s Command: choose two (CR 700.2d) — destroy power 2 or less, and the opponent sacrifices their greatest power', () => {
  let s = setup({ me: { hand: ['gixs-command'], bf: lands(5, B) }, opp: { bf: ['warren-elder', 'quaketusk-boar', 'vivi-ornitier'] } });
  s = cast(s, 'gixs-command', 1, 3); s = resolveAll(s, q => q.opts[0].id);
  eq(s.bf.filter(i => MF.isType(s, i, 'Creature')).length, 0, 'the Elder and Vivi destroyed, the Boar sacrificed');
});
test('Restless Reef: becomes a 4/4 Shark with deathtouch until end of turn; when it attacks, target player mills four', () => {
  let s = setup({ me: { bf: ['restless-reef', U, U, B, B] }, opp: { lib: ['opt', U, U, U, U, U] } });
  const r = find(s, 'restless-reef');
  s = activate(s, 'restless-reef', 2); s = resolveAll(s);
  eq(pt(s, r), [4, 4]); ok(has(s, r, 'deathtouch'), 'deathtouch'); ok(MF.chars(s, r).subtypes.includes('Shark'), 'a Shark');
  s = toStep(s, 'attackers'); s = answer(s, [r, 'done']); s = resolveAll(s, player(1));
  eq(s.players[1].grave.length, 4);
});
