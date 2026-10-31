// The championship Commander decks (PLAN D22): each test is named for the card or the CR section.
import { MF, test, eq, ok, setup, find, findAll, logs, cast, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const U = 'island', R = 'mountain', W = 'plains', G = 'forest', B = 'swamp';
const viewId = (q, st, id) => q.opts.find(o => o.iid != null && MF.view(st).cards[o.iid].id === id).id;
const oppTurn = s => { s = MF.clone(s); s.ap = 1; s.priority = 1; return MF.run(s); };
const grave = (s, seat) => s.players[seat].grave.map(i => s.cards[i].id);
const exile = (s, seat) => s.players[seat].exile.map(i => s.cards[i].id);
const act = (s, type, id, extra) => { const a = MF.legalActions(s).find(l => l.type === type && MF.view(s).cards[l.iid].id === id && (!extra || Object.keys(extra).every(k => l[k] === extra[k]))); if (!a) throw new Error('no ' + type + ' for ' + id + (extra ? ' ' + JSON.stringify(extra) : '')); return MF.apply(s, a); };
const can = (s, type, id, extra) => MF.legalActions(s).some(l => l.type === type && MF.view(s).cards[l.iid].id === id && (!extra || Object.keys(extra).every(k => l[k] === extra[k])));
// The opponent casts a spell (it is their priority on their own turn), then priority passes to seat 0.
const oppCasts = (s, id, ...script) => { s = act(s, 'cast', id); s = answer(s, script); return MF.apply(s, { type: 'pass' }); };
const stackIds = s => s.stack.map(L => L.id);

// ---- Alternative costs (CR 118.9) ---------------------------------------------------------------
test('Force of Will: pay 1 life and exile a blue card from your hand instead of its mana cost; counter target spell', () => {
  let s = setup({ me: { hand: ['force-of-will', 'spell-pierce'] }, opp: { hand: ['burst-lightning'], bf: [R] } });
  s = oppTurn(s);
  s = oppCasts(s, 'burst-lightning', player(0));
  ok(!can(s, 'cast', 'force-of-will', { via: undefined }), 'no mana for its cost');
  s = act(s, 'cast', 'force-of-will', { via: 'altCost' });
  s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].zone === 'stack' && st.cards[o.iid].id === 'burst-lightning').id, (q, st) => viewId(q, st, 'spell-pierce')]);
  s = resolveAll(s);
  eq(s.players[0].life, 19, 'one life paid, no damage');
  ok(exile(s, 0).includes('spell-pierce'), 'the blue card exiled');
  ok(grave(s, 1).includes('burst-lightning'), 'Burst countered');
});
test('Fierce Guardianship: free only while you control a commander (CR 903.3)', () => {
  let s = setup({ commander: true, me: { hand: ['fierce-guardianship'], identity: ['U', 'R'] }, opp: { hand: ['burst-lightning'], bf: [R] } });
  s = oppTurn(s); s = oppCasts(s, 'burst-lightning', player(0));
  ok(!can(s, 'cast', 'fierce-guardianship', { via: 'altCost' }), 'no commander on the battlefield');
  let t = setup({ commander: true, me: { hand: ['fierce-guardianship'], bf: [{ id: 'kraum-ludevics-opus', cmdr: true }], identity: ['U', 'R'] }, opp: { hand: ['burst-lightning'], bf: [R] } });
  t = oppTurn(t); t = oppCasts(t, 'burst-lightning', player(0));
  t = act(t, 'cast', 'fierce-guardianship', { via: 'altCost' }); t = answer(t, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'burst-lightning').id]);
  t = resolveAll(t);
  eq(t.players[0].life, 40, 'countered for free');
});
test('Force of Negation: the free way only on an opponent\'s turn; the countered spell is exiled', () => {
  let s = setup({ me: { hand: ['force-of-negation', 'spell-pierce', 'opt'] }, opp: { hand: ['opt'], bf: [U] } });
  ok(!MF.altCostOk(s, 0, find(s, 'force-of-negation', 'hand', 0), MF.cards['force-of-negation']), 'not on your own turn');
  s = oppTurn(s); s = oppCasts(s, 'opt');
  s = act(s, 'cast', 'force-of-negation', { via: 'altCost' });
  s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].owner === 1).id, (q, st) => viewId(q, st, 'spell-pierce')]);
  s = resolveAll(s);
  ok(exile(s, 1).includes('opt'), 'the opponent\'s Opt exiled instead of going to the graveyard');
});
test('Mindbreak Trap: {0} once an opponent cast three spells this turn; it exiles spells that can\'t be countered', () => {
  let s = setup({ me: { hand: ['mindbreak-trap'] }, opp: { hand: ['dark-ritual', 'dark-ritual', 'hexing-squelcher'], bf: [B, B, R] } });
  s = oppTurn(s);
  s = act(s, 'cast', 'dark-ritual'); s = answer(s, ['auto']); s = resolveAll(s);
  ok(!can(s, 'cast', 'mindbreak-trap', { via: 'altCost' }), 'one spell is not enough');
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  s = act(s, 'cast', 'dark-ritual'); s = answer(s, ['auto']); s = resolveAll(s);
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  s = act(s, 'cast', 'hexing-squelcher'); s = answer(s, ['auto']); s = MF.apply(s, { type: 'pass' });
  ok(can(s, 'cast', 'mindbreak-trap', { via: 'altCost' }), 'three spells this turn');
  s = act(s, 'cast', 'mindbreak-trap', { via: 'altCost' }); s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'hexing-squelcher').id, 'done']);
  s = resolveAll(s);
  ok(exile(s, 1).includes('hexing-squelcher'), '"can\'t be countered" does not stop exile');
});
test('Flare of Duplication: sacrifice a nontoken red creature instead; copy target instant and choose new targets', () => {
  let s = setup({ me: { hand: ['flare-of-duplication', 'burst-lightning'], bf: [R, 'ragavan-nimble-pilferer'] }, opp: { bf: ['ignoble-hierarch', 'noble-hierarch'] } });
  s = cast(s, 'burst-lightning', (q, st) => viewId(q, st, 'ignoble-hierarch'), 'auto');
  s = act(s, 'cast', 'flare-of-duplication', { via: 'altCost' });
  s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'burst-lightning').id, (q, st) => viewId(q, st, 'ragavan-nimble-pilferer')]);
  s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  s = answer(s, ['new', (q, st) => viewId(q, st, 'noble-hierarch')]);
  s = resolveAll(s);
  ok(grave(s, 0).includes('ragavan-nimble-pilferer'), 'Ragavan sacrificed');
  ok(grave(s, 1).includes('ignoble-hierarch') && grave(s, 1).includes('noble-hierarch'), 'both Hierarchs dead');
});

// ---- Counterspells --------------------------------------------------------------------------------
test('Flusterstorm: counter target instant or sorcery unless its controller pays {1}; storm copies', () => {
  let s = setup({ me: { hand: ['flusterstorm'], bf: [U] }, opp: { hand: ['burst-lightning'], bf: [R] } });
  s = oppTurn(s); s = oppCasts(s, 'burst-lightning', player(0));
  s = act(s, 'cast', 'flusterstorm'); s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'burst-lightning').id, 'auto']);
  eq(s.stack.length, 3, 'Burst, Flusterstorm and its storm trigger (one spell before it)');
  s = resolveAll(s, 'keep');
  eq(s.players[0].life, 20, 'Burst countered: the opponent could not pay');
});
test('Swan Song and An Offer You Can\'t Refuse: the countered spell\'s controller gets the tokens', () => {
  let s = setup({ me: { hand: ['swan-song', 'an-offer-you-cant-refuse'], bf: [U, U] }, opp: { hand: ['opt', 'sleight-of-hand'], bf: [U, U] } });
  s = oppTurn(s); s = oppCasts(s, 'opt');
  s = act(s, 'cast', 'swan-song'); s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'opt').id, 'auto']); s = resolveAll(s);
  eq(findAll(s, 'token-bird-2-2-u-flying', 'bf', 1).length, 1, 'a 2/2 flying Bird for the opponent');
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  s = oppCasts(s, 'sleight-of-hand');
  s = act(s, 'cast', 'an-offer-you-cant-refuse'); s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'sleight-of-hand').id, 'auto']); s = resolveAll(s);
  eq(findAll(s, 'token-treasure', 'bf', 1).length, 2, 'two Treasures for the opponent');
});
test('Pyroblast: any spell may be targeted; only a blue one is countered (checked on resolution)', () => {
  let s = setup({ me: { hand: ['pyroblast', 'pyroblast'], bf: [R, R] }, opp: { hand: ['burst-lightning'], bf: [R] } });
  s = oppTurn(s); s = oppCasts(s, 'burst-lightning', player(0));
  s = act(s, 'cast', 'pyroblast'); s = answer(s, [0, (q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'burst-lightning').id, 'auto']);
  s = resolveAll(s);
  eq(s.players[0].life, 18, 'Burst Lightning is red: it resolves');
  eq(logs(s, 'notColor').length, 1);
});
test('Pact of Negation: free; at your next upkeep pay {3}{U}{U} or lose the game', () => {
  let s = setup({ me: { hand: ['pact-of-negation'], bf: [U, U, U, U] }, opp: { hand: ['opt'], bf: [U] } });
  s = oppTurn(s); s = oppCasts(s, 'opt');
  s = act(s, 'cast', 'pact-of-negation'); s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'opt').id]); s = resolveAll(s);
  ok(grave(s, 1).includes('opt'), 'countered');
  s = toStep(s, 'upkeep');
  for (let g = 0; g < 10 && !(s.pending && s.pending.q.kind === 'pactPay') && s.winner == null; g++) s = MF.apply(s, { type: 'pass' });
  eq(s.winner, 1, 'four lands cannot pay {3}{U}{U}: the game is lost');
});
test('Vexing Bauble: a spell cast with no mana spent is countered', () => {
  let s = setup({ me: { bf: ['vexing-bauble'] }, opp: { hand: ['pact-of-negation', 'opt'], bf: [U] } });
  s = oppTurn(s);
  s = act(s, 'cast', 'opt'); s = answer(s, ['auto']);
  eq(s.stack.length, 1, 'Opt was paid for: no trigger');
  s = act(s, 'cast', 'pact-of-negation'); s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'opt').id]);
  eq(s.stack.length, 3, 'Opt, the Pact and Vexing Bauble\'s trigger');
  s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  ok(grave(s, 1).includes('pact-of-negation'), 'the Pact is countered: no mana was spent on it');
});

// ---- Casting prohibitions and permissions -------------------------------------------------------
test('Silence: your opponents can\'t cast spells this turn', () => {
  let s = setup({ me: { hand: ['silence'], bf: [W] }, opp: { hand: ['opt'], bf: [U] } });
  s = cast(s, 'silence', 'auto'); s = resolveAll(s);
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  ok(!can(s, 'cast', 'opt'), 'Opt is forbidden');
  ok(/can’t cast/.test(MF.whyNot(s, 1, find(s, 'opt', 'hand', 1))), MF.whyNot(s, 1, find(s, 'opt', 'hand', 1)));
});
test('Orim\'s Chant, kicked: the target player can\'t cast spells and creatures can\'t attack this turn', () => {
  let s = setup({ me: { hand: ['orims-chant'], bf: [W, W, 'ragavan-nimble-pilferer'] } });
  s = cast(s, 'orims-chant', 'yes', player(1), 'auto'); s = resolveAll(s);
  ok(!MF.canAttack(s, find(s, 'ragavan-nimble-pilferer', 'bf')), 'no attacks');
});
test('Grand Abolisher: during your turn, opponents can\'t cast spells or activate artifact abilities (mana abilities too)', () => {
  let s = setup({ me: { bf: ['grand-abolisher'] }, opp: { hand: ['burst-lightning'], bf: [R, 'sol-ring'] } });
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  ok(!can(s, 'cast', 'burst-lightning'), 'no spells');
  ok(!MF.manaSources(s, 1, { any: true }).some(m => m.id === 'sol-ring'), 'Sol Ring can\'t be tapped');
});
test('Dosan the Falling Leaf: players can cast spells only during their own turns', () => {
  let s = setup({ me: { bf: ['dosan-the-falling-leaf'] }, opp: { hand: ['burst-lightning'], bf: [R] } });
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  ok(!can(s, 'cast', 'burst-lightning'), 'not on my turn');
});
test('Ranger-Captain of Eos: sacrifice it — your opponents can\'t cast noncreature spells this turn', () => {
  let s = setup({ me: { bf: ['ranger-captain-of-eos'] }, opp: { hand: ['burst-lightning', 'ragavan-nimble-pilferer'], bf: [R] } });
  s = activate(s, 'ranger-captain-of-eos'); s = resolveAll(s);
  s = MF.clone(s); s.priority = 1; s.ap = 1; s = MF.run(s);
  ok(!can(s, 'cast', 'burst-lightning'), 'a noncreature spell is forbidden');
  ok(can(s, 'cast', 'ragavan-nimble-pilferer'), 'a creature is not');
});
test('Borne Upon a Wind: spells this turn as though they had flash; Valley Floodcaller: noncreature spells', () => {
  let s = setup({ me: { hand: ['borne-upon-a-wind', 'gamble'], bf: [U, U, R] } });
  s = oppTurn(s); s = MF.clone(s); s.priority = 0; s = MF.run(s);
  ok(!can(s, 'cast', 'gamble'), 'a sorcery on the opponent\'s turn');
  s = act(s, 'cast', 'borne-upon-a-wind'); s = answer(s, ['auto']); s = resolveAll(s);
  s = MF.clone(s); s.priority = 0; s = MF.run(s);
  ok(can(s, 'cast', 'gamble'), 'now it may be cast');
  let t = setup({ me: { hand: ['gamble', 'ragavan-nimble-pilferer'], bf: [R, R, 'valley-floodcaller'] } });
  t = oppTurn(t); t = MF.clone(t); t.priority = 0; t = MF.run(t);
  ok(can(t, 'cast', 'gamble') && !can(t, 'cast', 'ragavan-nimble-pilferer'), 'noncreature only');
});
test('Trickbind: split second — nothing but mana abilities while it is on the stack; the ability is countered and its source locked', () => {
  let s = setup({ me: { hand: ['trickbind', 'burst-lightning'], bf: [U, U, R] }, opp: { bf: ['ranger-captain-of-eos', 'sol-ring'] } });
  s = oppTurn(s);
  s = act(s, 'act', 'ranger-captain-of-eos'); s = MF.apply(s, { type: 'pass' });
  s = act(s, 'cast', 'trickbind'); s = answer(s, [q => q.opts.find(o => o.lid != null).id, 'auto']);
  ok(!can(s, 'cast', 'burst-lightning'), 'split second: no Burst');
  s = resolveAll(s);
  eq(logs(s, 'countered').filter(e => e.ab).length, 1, 'the ability is countered');
});
test('Veil of Summer: draw if an opponent cast a blue spell; your spells can\'t be countered this turn', () => {
  let s = setup({ me: { hand: ['veil-of-summer', 'burst-lightning'], bf: [G, R], lib: [W, W] }, opp: { hand: ['opt', 'negate'], bf: [U, U, U] } });
  s = oppTurn(s); s = oppCasts(s, 'opt'); s = resolveAll(s, q => q.opts[q.opts.length - 1].id);
  s = MF.clone(s); s.ap = 0; s.priority = 0; s = MF.run(s);
  s = act(s, 'cast', 'veil-of-summer'); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[0].hand.length, 2, 'drew a card (Burst and the new card)');
  s = cast(s, 'burst-lightning', player(1), 'auto');
  s = MF.apply(s, { type: 'pass' });
  s = act(s, 'cast', 'negate'); s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'burst-lightning').id, 'auto']);
  s = resolveAll(s);
  eq(s.players[1].life, 18, 'Burst Lightning resolved');
  eq(logs(s, 'cantCounter').length, 1);
});

// ---- Changing targets, control and copies (CR 115.7, 701.12, 707.10) ----------------------------
test('Misdirection: change the target of a spell with a single target (exile a blue card)', () => {
  let s = setup({ me: { hand: ['misdirection', 'spell-pierce'] }, opp: { hand: ['burst-lightning'], bf: [R, 'ignoble-hierarch'] } });
  s = oppTurn(s); s = oppCasts(s, 'burst-lightning', player(0));
  s = act(s, 'cast', 'misdirection', { via: 'altCost' }); s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'burst-lightning').id, (q, st) => viewId(q, st, 'spell-pierce')]);
  s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  s = answer(s, [(q, st) => viewId(q, st, 'ignoble-hierarch')]);
  s = resolveAll(s);
  eq(s.players[0].life, 20); ok(grave(s, 1).includes('ignoble-hierarch'), 'the Burst hit the opponent\'s Hierarch');
});
test('Commandeer: gain control of target noncreature spell (exile two blue cards)', () => {
  let s = setup({ me: { hand: ['commandeer', 'spell-pierce', 'opt'] }, opp: { hand: ['burst-lightning'], bf: [R] } });
  s = oppTurn(s); s = oppCasts(s, 'burst-lightning', player(0));
  s = act(s, 'cast', 'commandeer', { via: 'altCost' }); s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'burst-lightning').id, (q, st) => viewId(q, st, 'spell-pierce'), (q, st) => viewId(q, st, 'opt')]);
  s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  s = answer(s, [player(1)]);
  s = resolveAll(s);
  eq(s.players[1].life, 18, 'my Burst now, at the opponent');
});
test('Redirect Lightning: pay 5 life or {2}; change the target of a spell or ability with a single target', () => {
  let s = setup({ me: { hand: ['redirect-lightning'], bf: [R] }, opp: { hand: ['burst-lightning'], bf: [R, 'noble-hierarch'] } });
  s = oppTurn(s); s = oppCasts(s, 'burst-lightning', player(0));
  s = act(s, 'cast', 'redirect-lightning');
  eq(s.pending.q.kind, 'lifeOrMana'); eq(s.pending.q.opts.map(o => o.id), ['life'], 'one Mountain can\'t pay {R}{2}');
  s = answer(s, ['life', (q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'burst-lightning').id, 'auto']);
  s = resolveAll(s, (q, st) => viewId(q, st, 'noble-hierarch'));
  eq(s.players[0].life, 15, 'five life paid'); ok(grave(s, 1).includes('noble-hierarch'));
});
test('Sink into Stupor: return a spell an opponent controls to its owner\'s hand; its back face is a land', () => {
  let s = setup({ me: { hand: ['sink-into-stupor-soporific-springs'], bf: [U, U, U] }, opp: { hand: ['burst-lightning'], bf: [R] } });
  s = oppTurn(s); s = oppCasts(s, 'burst-lightning', player(0));
  s = act(s, 'cast', 'sink-into-stupor-soporific-springs'); s = answer(s, [(q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'burst-lightning').id, 'auto']);
  s = resolveAll(s);
  ok(find(s, 'burst-lightning', 'hand', 1), 'back in hand'); eq(s.players[0].life, 20);
  let t = setup({ me: { hand: ['sink-into-stupor-soporific-springs'] } });
  ok(MF.legalActions(t).some(a => a.type === 'land' && a.alt), 'Soporific Springs can be played as a land');
});
