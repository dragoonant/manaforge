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

// ---- Mana ---------------------------------------------------------------------------------------
test('Simian Spirit Guide: exile it from your hand for {R} — a mana ability that works from the hand', () => {
  let s = setup({ me: { hand: ['simian-spirit-guide', 'burst-lightning'] } });
  ok(can(s, 'mana', 'simian-spirit-guide'), 'offered at priority');
  s = cast(s, 'burst-lightning', player(1), 'auto');
  ok(exile(s, 0).includes('simian-spirit-guide'), 'exiled to pay'); s = resolveAll(s);
  eq(s.players[1].life, 18);
});
test('Lion\'s Eye Diamond: discard your hand and sacrifice it for three mana of one color; not while an effect asks for mana', () => {
  let s = setup({ me: { hand: ['opt', 'burst-lightning'], bf: ['lions-eye-diamond'] } });
  s = act(s, 'mana', 'lions-eye-diamond'); s = answer(s, ['RRR']);
  eq(s.players[0].pool.R, 3); eq(s.players[0].hand.length, 0, 'hand discarded'); ok(grave(s, 0).includes('lions-eye-diamond'));
  ok(!MF.manaSources(setup({ me: { bf: ['lions-eye-diamond'] } }), 0, undefined).some(m => m.id === 'lions-eye-diamond'), 'not for an effect\'s payment');
});
test('Mox Diamond: discard a land card as it would enter, or it goes to the graveyard (CR 614.1a)', () => {
  let s = setup({ me: { hand: ['mox-diamond', 'mox-diamond', W] } });
  s = cast(s, 'mox-diamond'); s = resolveAll(s, (q, st) => viewId(q, st, W));
  ok(find(s, 'mox-diamond', 'bf', 0) != null && grave(s, 0).includes(W), 'the Plains discarded, the Mox entered');
  s = cast(s, 'mox-diamond'); s = resolveAll(s);
  ok(grave(s, 0).includes('mox-diamond'), 'no land left: to the graveyard');
});
test('Flooded Strand: pay 1 life, sacrifice it, put a Plains or Island card onto the battlefield', () => {
  let s = setup({ me: { bf: ['flooded-strand'], lib: [R, U, B] } });
  s = activate(s, 'flooded-strand'); s = resolveAll(s, (q, st) => viewId(q, st, U));
  eq(s.players[0].life, 19); ok(find(s, U, 'bf', 0) != null, 'an Island');
});
test('Rite of Flame: {R}{R}, plus {R} for each Rite of Flame in each graveyard', () => {
  let s = setup({ me: { hand: ['rite-of-flame'], bf: [R], grave: ['rite-of-flame'] }, opp: { grave: ['rite-of-flame'] } });
  s = cast(s, 'rite-of-flame', 'auto'); s = resolveAll(s);
  eq(s.players[0].pool.R, 4);
});
test('Manamorphose: two mana in any combination of colors, and a card', () => {
  let s = setup({ me: { hand: ['manamorphose'], bf: [R, G] } });
  s = cast(s, 'manamorphose', 'R', 'auto'); s = resolveAll(s, 'U', 'B');
  eq([s.players[0].pool.U, s.players[0].pool.B], [1, 1]); eq(s.players[0].hand.length, 1);
});
test('Culling Ritual: destroy each nonland permanent with mana value 2 or less; {B} or {G} for each', () => {
  let s = setup({ me: { hand: ['culling-ritual'], bf: [B, B, G, G, 'sol-ring'] }, opp: { bf: ['ignoble-hierarch', 'grand-abolisher', 'ranger-captain-of-eos'] } });
  s = cast(s, 'culling-ritual', 'auto'); s = resolveAll(s, 'BBG');
  eq([s.players[0].pool.B, s.players[0].pool.G], [2, 1], 'Sol Ring, Ignoble Hierarch and Grand Abolisher: three');
  ok(find(s, 'ranger-captain-of-eos', 'bf', 1) != null, 'mana value 3 survives');
});
test('Exalted: a creature attacking alone gets +1/+1 for each instance', () => {
  let s = setup({ me: { bf: ['ignoble-hierarch', 'noble-hierarch', 'ragavan-nimble-pilferer'] } });
  s = toStep(s, 'attackers'); s = answer(s, [(q, st) => viewId(q, st, 'ragavan-nimble-pilferer'), 'done']);
  s = resolveAll(s, q => q.opts[0].id);
  eq(MF.chars(s, find(s, 'ragavan-nimble-pilferer', 'bf')).p, 4, '2 + 1 + 1');
});
test('Gemstone Caverns: the player who doesn\'t start may begin with it, with a luck counter; it then taps for any color', () => {
  let s = setup({ me: { bf: [{ id: 'gemstone-caverns', ctr: { luck: 1 } }, 'gemstone-caverns'] } });
  const srcs = MF.manaSources(s, 0, { any: true }).filter(m => m.id === 'gemstone-caverns');
  eq(srcs.map(m => m.cols.length).sort(), [1, 5]);
});
test('City of Traitors: sacrificed when you play another land', () => {
  let s = setup({ me: { bf: ['city-of-traitors'], hand: [R] } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'land')); s = resolveAll(s);
  ok(grave(s, 0).includes('city-of-traitors'));
});
test('Food Chain: exile a creature for 1 + its mana value in one color, only for creature spells', () => {
  let s = setup({ me: { bf: ['food-chain', 'ranger-captain-of-eos'] } });
  s = act(s, 'mana', 'food-chain'); s = answer(s, [(q, st) => viewId(q, st, 'ranger-captain-of-eos'), 'G']);
  eq(s.players[0].pool.G, 4); eq(s.players[0].poolCre.G, 4);
});
test('Mox Amber: one mana of a color among your legendary creatures', () => {
  let s = setup({ me: { bf: ['mox-amber', 'ragavan-nimble-pilferer'] } });
  eq(MF.manaSources(s, 0, { any: true }).find(m => m.id === 'mox-amber').cols, ['R']);
});
test('Deathrite Shaman: exile a land card from a graveyard for one mana of any color (an ability with a target uses the stack, CR 605.1a)', () => {
  let s = setup({ me: { bf: ['deathrite-shaman'] }, opp: { grave: [U] } });
  s = activate(s, 'deathrite-shaman', 0, (q, st) => viewId(q, st, U)); s = resolveAll(s, 'G');
  eq(s.players[0].pool.G, 1); ok(exile(s, 1).includes(U));
});
test('Rain of Filth: your lands gain "Sacrifice this land: Add {B}." until end of turn', () => {
  let s = setup({ me: { hand: ['rain-of-filth'], bf: [B, R] } });
  s = cast(s, 'rain-of-filth', 'auto'); s = resolveAll(s);
  eq(MF.manaSources(s, 0, { any: true }).filter(m => m.id === R && m.cols.includes('B')).length, 1, 'the untapped Mountain can be sacrificed for {B}');
});
test('Forbidden Orchard: tapping it for mana gives target opponent a 1/1 Spirit', () => {
  let s = setup({ me: { bf: ['forbidden-orchard'] } });
  s = act(s, 'mana', 'forbidden-orchard'); s = answer(s, ['U']);
  s = resolveAll(s, player(1));
  eq(findAll(s, 'token-spirit-1-1-c', 'bf', 1).length, 1);
});
test('Jeska\'s Will: with a commander you may choose both — {R} for each card in the opponent\'s hand, and three cards to play this turn', () => {
  let s = setup({ commander: true, me: { identity: ['R'], hand: ['jeskas-will'], bf: [R, R, R, { id: 'najeela-the-blade-blossom', cmdr: true }], lib: [R, R, R, R] }, opp: { hand: [U, U, U, U, U] } });
  s = cast(s, 'jeskas-will', 'both', player(1), 'auto'); s = resolveAll(s);
  eq(s.players[0].pool.R, 5); eq(s.players[0].exile.length, 3);
});

// ---- Triggered and activated abilities -------------------------------------------------------------
test('Esper Sentinel: an opponent\'s first noncreature spell each turn draws you a card unless they pay {X} (X = its power)', () => {
  let s = setup({ me: { bf: ['esper-sentinel'], lib: [W, W] }, opp: { hand: ['opt', 'opt'], bf: [U, U] } });
  s = oppTurn(s); s = act(s, 'cast', 'opt'); s = answer(s, ['auto']);
  s = MF.apply(s, { type: 'pass' }); s = resolveAll(s, 'no', q => q.opts[q.opts.length - 1].id);
  eq(s.players[0].hand.length, 1, 'the opponent declined to pay {1}: a card');
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  s = act(s, 'cast', 'opt'); s = answer(s, ['auto']);
  eq(s.stack.length, 1, 'the second noncreature spell: no trigger');
});
test('Smothering Tithe: whenever an opponent draws, they may pay {2}; if they don\'t, you create a Treasure', () => {
  let s = setup({ me: { bf: ['smothering-tithe'] }, opp: { lib: [U, U] } });
  s = MF.clone(s); MF.draw(s, 1, 1); s = MF.run(s);
  s = resolveAll(s);
  eq(findAll(s, 'token-treasure', 'bf', 0).length, 1, 'no mana to pay: a Treasure');
});
test('Lotho, Corrupt Shirriff: a player\'s second spell each turn — lose 1 life and create a Treasure', () => {
  let s = setup({ me: { bf: ['lotho-corrupt-shirriff', R, R], hand: ['burst-lightning', 'burst-lightning'] } });
  s = cast(s, 'burst-lightning', player(1), 'auto'); s = resolveAll(s);
  s = cast(s, 'burst-lightning', player(1), 'auto'); s = resolveAll(s);
  eq(s.players[0].life, 19); eq(findAll(s, 'token-treasure', 'bf', 0).length, 1);
});
test('Kraum: an opponent\'s second spell each turn draws you a card; Vial Smasher: your first spell each turn deals its mana value', () => {
  let s = setup({ me: { bf: ['kraum-ludevics-opus', 'vial-smasher-the-fierce', R, R], hand: ['burst-lightning'], lib: [W] } });
  s = cast(s, 'burst-lightning', player(1), 'auto'); s = resolveAll(s);
  eq(s.players[1].life, 17, 'Vial Smasher 1 + Burst Lightning 2');
});
test('Partner: two commanders that both have partner are a legal pair (CR 702.124h)', () => {
  for (const id of ['cedh-kraum-tymna', 'cedh-thrasios-vial-smasher']) { const d = MF.decks[id]; ok(d && d.commanders.length === 2, id); }
});
test('Storm-Kiln Artist: +1/+0 for each artifact; magecraft makes a Treasure when you cast or copy an instant or sorcery', () => {
  let s = setup({ me: { bf: ['storm-kiln-artist', 'sol-ring', R], hand: ['burst-lightning'] } });
  eq(MF.chars(s, find(s, 'storm-kiln-artist', 'bf')).p, 3, '2 + Sol Ring');
  s = cast(s, 'burst-lightning', player(1), 'auto'); s = resolveAll(s);
  eq(findAll(s, 'token-treasure', 'bf', 0).length, 1);
});
test('Korvold: when it enters, sacrifice another permanent; whenever you sacrifice one, a +1/+1 counter and a card', () => {
  let s = setup({ me: { hand: ['korvold-fae-cursed-king'], bf: [B, R, G, 'sol-ring', 'sol-ring'], lib: [W, W, W] } });
  s = cast(s, 'korvold-fae-cursed-king', 'auto'); s = resolveAll(s, (q, st) => q.opts.find(o => o.iid != null && st.cards[o.iid].id === 'sol-ring').id);
  const k = find(s, 'korvold-fae-cursed-king', 'bf');
  eq(s.cards[k].ctr['+1/+1'], 1); eq(s.players[0].hand.length, 1);
});
test('Mayhem Devil: whenever a player sacrifices a permanent, 1 damage to any target', () => {
  let s = setup({ me: { bf: ['mayhem-devil', 'lions-eye-diamond'] } });
  s = act(s, 'mana', 'lions-eye-diamond'); s = answer(s, ['RRR']);
  s = resolveAll(s, player(1));
  eq(s.players[1].life, 19);
});
test('Ragavan: combat damage to a player makes a Treasure and exiles their top card, castable this turn; dash returns it', () => {
  let s = setup({ me: { hand: ['ragavan-nimble-pilferer'], bf: [R, R] }, opp: { lib: ['burst-lightning', U] } });
  s = act(s, 'cast', 'ragavan-nimble-pilferer', { via: 'dash' }); s = answer(s, ['auto']); s = resolveAll(s);
  s = toStep(s, 'attackers'); s = answer(s, [(q, st) => viewId(q, st, 'ragavan-nimble-pilferer'), 'done']);
  s = toStep(s, 'main2');
  eq(findAll(s, 'token-treasure', 'bf', 0).length, 1); ok(exile(s, 1).includes('burst-lightning'));
  ok(can(s, 'cast', 'burst-lightning'), 'the opponent\'s card is castable with the Treasure');
  s = toStep(s, 'end'); s = resolveAll(s);
  ok(find(s, 'ragavan-nimble-pilferer', 'hand', 0) != null, 'dash: back to hand at the end step');
});
test('Najeela: a Warrior attacking brings a tapped and attacking 1/1 Warrior; WUBRG gives an additional combat', () => {
  let s = setup({ me: { bf: ['najeela-the-blade-blossom'] } });
  s = toStep(s, 'attackers'); s = answer(s, [(q, st) => viewId(q, st, 'najeela-the-blade-blossom'), 'done']);
  s = resolveAll(s, 'yes');
  eq(findAll(s, 'token-warrior-1-1-w', 'bf', 0).length, 1);
  ok(s.combat.attackers.length === 2, 'the token is attacking');
});
test('Tymna the Weaver: in your postcombat main phase, pay 1 life per opponent dealt combat damage to draw that many', () => {
  let s = setup({ me: { bf: ['tymna-the-weaver'], lib: [W, W] } });
  s = toStep(s, 'attackers'); s = answer(s, [(q, st) => viewId(q, st, 'tymna-the-weaver'), 'done']);
  s = toStep(s, 'main2', 'yes');
  s = resolveAll(s, 'yes');
  eq(s.players[0].hand.length, 1); eq(s.players[0].life, 21, 'lifelink 2, then 1 life paid: 20 + 2 - 1');
});
test('Thrasios: {4}: scry 1, then a land on top goes onto the battlefield tapped; otherwise draw', () => {
  let s = setup({ me: { bf: ['thrasios-triton-hero', U, U, U, U], lib: [W, 'opt'] } });
  s = activate(s, 'thrasios-triton-hero', null, 'auto'); s = resolveAll(s, q => q.opts.find(o => o.id === 'top' || o.id === 'keep' || o.id === 'done').id);
  ok(findAll(s, W, 'bf', 0).length === 1, 'the Plains entered tapped');
});
test('Wishclaw Talisman: search for a card; an opponent gains control of it; only during your turn', () => {
  let s = setup({ me: { bf: ['wishclaw-talisman', R], lib: [U, 'opt'] } });
  s.cards[find(s, 'wishclaw-talisman', 'bf')].ctr.wish = 3;
  s = activate(s, 'wishclaw-talisman', null, 'auto'); s = resolveAll(s, (q, st) => viewId(q, st, 'opt'));
  ok(find(s, 'opt', 'hand', 0) != null); eq(s.cards[find(s, 'wishclaw-talisman', 'bf')].ctrl, 1);
});
test('Swords to Plowshares: exile target creature; its controller gains life equal to its power', () => {
  let s = setup({ me: { hand: ['swords-to-plowshares'], bf: [W] }, opp: { bf: ['korvold-fae-cursed-king'] } });
  s = cast(s, 'swords-to-plowshares', (q, st) => viewId(q, st, 'korvold-fae-cursed-king'), 'auto'); s = resolveAll(s);
  eq(s.players[1].life, 24);
});
test('Gloomshrieker: if it would die, it is exiled instead', () => {
  let s = setup({ me: { bf: ['gloomshrieker'] } });
  s = MF.clone(s); MF.destroy(s, find(s, 'gloomshrieker', 'bf'), 'test'); s = MF.run(s);
  ok(exile(s, 0).includes('gloomshrieker'));
});
test('Squee, the Immortal: cast from the graveyard or from exile', () => {
  let s = setup({ me: { grave: ['squee-the-immortal'], bf: [R, R, R] } });
  ok(can(s, 'cast', 'squee-the-immortal'), 'from the graveyard');
});
test('Dragon\'s Rage Channeler: surveil 1 on a noncreature spell; with delirium a 3/3 flier', () => {
  let s = setup({ me: { bf: ['dragons-rage-channeler'], grave: ['opt', 'ragavan-nimble-pilferer', U, 'sol-ring'] } });
  const d = find(s, 'dragons-rage-channeler', 'bf');
  eq(MF.chars(s, d).p, 3); ok(MF.chars(s, d).kw.flying);
});
test('Underworld Breach: cast a card from your graveyard for its mana cost plus exiling three others; sacrificed at end step', () => {
  let s = setup({ me: { bf: ['underworld-breach', R], grave: ['burst-lightning', U, U, U] } });
  s = act(s, 'cast', 'burst-lightning', { via: 'escape' }); s = answer(s, [player(1), q => q.opts[0].id, q => q.opts[0].id, q => q.opts[0].id, 'auto']);
  s = resolveAll(s);
  eq(s.players[1].life, 18); eq(s.players[0].exile.length, 3);
  s = toStep(s, 'end'); s = resolveAll(s); ok(grave(s, 0).includes('underworld-breach'), 'sacrificed at the end step');
});
