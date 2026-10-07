// Azorius Control (Mitchell Tamblyn), Pro Tour Final Fantasy.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const W = 'plains', U = 'island';
const oppTurn = s => { s = MF.clone(s); s.priority = 1; return MF.run(s); };

test('Three Steps Ahead: spree (CR 702.172) — two modes, both costs added; targets of each chosen as it is cast', () => {
  let s = setup({ me: { hand: ['three-steps-ahead'], bf: [U, U, U, U, U], lib: [U, U, U] }, opp: { hand: ['lightning-strike'], bf: ['mountain', 'mountain'] } });
  s = oppTurn(s); s = cast(s, 'lightning-strike', player(0));
  const ls = find(s, 'lightning-strike');
  s = MF.apply(s, { type: 'pass' });
  s = cast(s, 'three-steps-ahead', 0, 2, tgt(ls));   // mode 1 has no legal target, so after two modes nothing is left to choose
  eq(s.players[0].pool.U + s.bf.filter(i => !s.cards[i].tapped).length, 0, '{U} + {1}{U} + {2}: all five lands');
  s = resolveAll(s, q => q.opts[0].id);
  ok(find(s, 'lightning-strike', 'grave', 1), 'countered'); eq(s.players[0].life, 20); eq(s.players[0].hand.length, 1, 'drew two, discarded one');
});
test('Dreams of Laguna: surveil 1, then draw; flashback from the graveyard', () => {
  let s = setup({ me: { grave: ['dreams-of-laguna'], bf: [U, U, U, U], lib: [W, U, W] } });
  const a = MF.legalActions(s).find(l => l.type === 'cast' && l.via === 'flashback'); ok(a, 'flashback');
  s = answer(MF.apply(s, a), []); s = resolveAll(s, 'grave');
  eq(s.players[0].hand.map(i => s.cards[i].id), ['island']); ok(find(s, 'dreams-of-laguna', 'exile'), 'exiled after flashback');
});
test('Kutzil’s Flanker: a modal enters trigger (CR 700.2a) — the mode is chosen as it goes on the stack', () => {
  let s = setup({ me: { hand: ['kutzils-flanker'], bf: [W, W, W, 'cathar-commando'] }, opp: { grave: ['lightning-strike', 'mountain'] } });
  let t = setup({ me: { hand: ['kutzils-flanker'], bf: [W, W, W] }, opp: { grave: ['lightning-strike', 'mountain'] } });
  t = cast(t, 'kutzils-flanker'); t = MF.apply(t, { type: 'pass' }); t = MF.apply(t, { type: 'pass' });
  eq(t.pending.q.kind, 'mode'); t = answer(t, [2, player(1)]); t = resolveAll(t);
  eq(t.players[1].grave.length, 0); eq(t.players[1].exile.length, 2);
});
test('Kutzil’s Flanker: +1/+1 counters for each creature that left the battlefield under my control this turn', () => {
  let s = setup({ me: { hand: ['kutzils-flanker'], bf: [W, W, W, 'cathar-commando', 'cathar-commando'] } });
  s = MF.clone(s); for (const i of findAll(s, 'cathar-commando')) MF.sacrifice(s, i); s = MF.run(s);
  s = cast(s, 'kutzils-flanker'); s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  s = answer(s, [0]); s = resolveAll(s);
  eq(pt(s, find(s, 'kutzils-flanker')), [5, 3]);
});
test('Get Lost: destroys a creature, enchantment or planeswalker; its controller creates two Maps', () => {
  let s = setup({ me: { hand: ['get-lost'], bf: [W, W] }, opp: { bf: ['temporary-lockdown'] } });
  s = cast(s, 'get-lost', tgt(find(s, 'temporary-lockdown'))); s = resolveAll(s);
  eq(s.bf.filter(i => s.cards[i].id === 'token-map' && s.cards[i].ctrl === 1).length, 2, 'the opponent’s Maps');
});
test('Beza: each clause checks its own comparison as it resolves', () => {
  let s = setup({ me: { hand: ['beza-the-bounding-spring'], bf: [W, W, W, W], life: 10, lib: [W, W] }, opp: { bf: [U, U, U, U, U, 'cathar-commando'], hand: [U, U] } });
  s = cast(s, 'beza-the-bounding-spring'); s = resolveAll(s);
  ok(findAll(s, 'token-treasure', 'bf', 0).length === 1, 'Treasure: they have more lands'); eq(s.players[0].life, 14, '4 life: they have more');
  eq(findAll(s, 'token-fish-1-1-u', 'bf', 0).length, 0, 'no Fish: I have Beza, they have one creature'); eq(s.players[0].hand.length, 1, 'drew: they have more cards');
});
test('No More Lies: countered when they can’t pay {3}, and exiled instead of going to the graveyard', () => {
  let s = setup({ me: { hand: ['no-more-lies'], bf: [W, U] }, opp: { hand: ['lightning-strike'], bf: ['mountain', 'mountain'] } });
  s = oppTurn(s); s = cast(s, 'lightning-strike', player(0)); s = MF.apply(s, { type: 'pass' });
  s = cast(s, 'no-more-lies', tgt(find(s, 'lightning-strike'))); s = resolveAll(s);
  ok(find(s, 'lightning-strike', 'exile'), 'exiled'); eq(s.players[0].life, 20);
});
test('Lay Down Arms: only a creature with mana value up to my Plains count; its controller gains 3', () => {
  let s = setup({ me: { hand: ['lay-down-arms'], bf: [W, W] }, opp: { bf: ['beza-the-bounding-spring', 'cathar-commando'] } });
  s = cast(s, 'lay-down-arms', q => { eq(q.opts.map(o => s.cards[o.iid].id), ['cathar-commando']); return q.opts[0].id; }); s = resolveAll(s);
  ok(find(s, 'cathar-commando', 'exile'), 'exiled'); eq(s.players[1].life, 23);
});
test('Temporary Lockdown: exiles each nonland permanent with mana value 2 or less until it leaves (CR 610.3)', () => {
  let s = setup({ me: { hand: ['temporary-lockdown'], bf: [W, W, W, 'cathar-commando'] }, opp: { bf: ['beza-the-bounding-spring', 'kutzils-flanker', 'get-lost'] } });
  s = cast(s, 'temporary-lockdown'); s = resolveAll(s);
  ok(find(s, 'cathar-commando', 'exile') && find(s, 'beza-the-bounding-spring', 'bf'), 'two-drop gone, four-drop stays');
  s = MF.clone(s); MF.destroy(s, find(s, 'temporary-lockdown'), 'effect'); s = MF.run(s);
  ok(find(s, 'cathar-commando', 'bf', 0), 'back');
});
test('Marang River Regent: returns up to two other nonland permanents', () => {
  let s = setup({ me: { hand: ['marang-river-regent-coil-and-catch'], bf: [U, U, U, U, U, U] }, opp: { bf: ['beza-the-bounding-spring', 'cathar-commando', W] } });
  s = cast(s, 'marang-river-regent-coil-and-catch'); s = resolveAll(s, tgt(find(s, 'beza-the-bounding-spring')), tgt(find(s, 'cathar-commando')), q => q.opts.find(o => o.id === 'done') ? 'done' : q.opts[0].id);
  eq(s.players[1].hand.length, 2);
});
test('Ultima: destroy all artifacts and creatures, then end the turn (CR 724.1) — the stack is exiled and the end step is skipped', () => {
  let s = setup({ me: { hand: ['ultima', 'lay-down-arms'], bf: [W, W, W, W, W, W, 'cathar-commando'] }, opp: { bf: ['beza-the-bounding-spring'] } });
  s = cast(s, 'ultima'); s = resolveAll(s);
  ok(find(s, 'cathar-commando', 'grave') && find(s, 'beza-the-bounding-spring', 'grave'), 'both destroyed'); ok(find(s, 'ultima', 'exile'), 'Ultima exiled');
  eq(s.ap, 1, 'the opponent’s turn now'); ok(logs(s, 'endTurn').length === 1, 'logged');
});
