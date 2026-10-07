// Azorius (Perilous Snare), Arena top-ranked Standard after the Hobbit release.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const W = 'plains', U = 'island';
const oppTurn = s => { s = MF.clone(s); s.ap = 1; s.priority = 1; return MF.run(s); };
const viewId = (q, st, id) => q.opts.find(o => o.iid != null && MF.view(st).cards[o.iid].id === id).id;

test('Castle Doom: its coloured mana pays only for artifact spells (CR 106.6); {3},{T}, sacrifice an artifact: Doombot', () => {
  let s = setup({ me: { bf: ['castle-doom', 'candy-trail', W, W, W] } });
  const cd = find(s, 'castle-doom');
  eq(MF.manaSources(s, 0, { artifact: false }).filter(m => m.iid === cd).map(m => m.cols.join('')), ['C']);
  eq(MF.manaSources(s, 0, { artifact: true }).filter(m => m.iid === cd).length, 2);
  s = activate(s, 'castle-doom', 2, q => q.opts[0].id); s = resolveAll(s);
  const db = find(s, 'token-doombot', 'bf'); eq(pt(s, db), [3, 3]); ok(MF.chars(s, db).types.includes('Artifact'), 'an artifact creature');
});
test('Petrified Hamlet: choose a land card name (CR 201.4) — those lands tap for {C} and their other activated abilities can’t be activated', () => {
  let s = setup({ me: { hand: ['petrified-hamlet'] }, opp: { bf: ['castle-doom', W, W, W, 'candy-trail'] } });
  s = play(s, 'petrified-hamlet'); s = resolveAll(s, 'Castle Doom');
  eq(s.cards[find(s, 'petrified-hamlet')].chosenName, 'Castle Doom');
  s = oppTurn(s); ok(!MF.legalActions(s).some(a => a.type === 'act' && s.cards[a.iid].id === 'castle-doom'), 'Doombot can’t be made');
  ok(MF.chars(s, find(s, 'castle-doom')).ab.filter(a => a.k === 'mana' && a.cols[0] === 'C').length === 2, 'and it has another {C} ability');
});
test('Fomori Vault: look at X (my artifacts), one to hand, the rest on the bottom at random', () => {
  let s = setup({ me: { hand: [U], bf: ['fomori-vault', 'candy-trail', 'cryogen-relic', W, W, W], lib: ['torpor-orb', W, U, W] } });
  s = activate(s, 'fomori-vault', 1, q => q.opts[0].id); s = resolveAll(s, (q, st) => viewId(q, st, 'torpor-orb'));
  ok(s.players[0].hand.some(i => s.cards[i].id === 'torpor-orb'), 'took it from the top two');
});
test('United Battlefront: up to two noncreature, nonland permanents with mana value 3 or less onto the battlefield', () => {
  let s = setup({ me: { hand: ['united-battlefront'], bf: [W, W, W, W], lib: ['torpor-orb', W, 'castle-doom', 'cryogen-relic', 'pinnacle-starcage', U, U, W] } });
  s = cast(s, 'united-battlefront'); s = resolveAll(s, (q, st) => viewId(q, st, 'torpor-orb'), (q, st) => viewId(q, st, 'cryogen-relic'));
  ok(find(s, 'torpor-orb', 'bf') && find(s, 'cryogen-relic', 'bf'), 'both'); eq(s.players[0].lib.length, 5, 'one untouched + five on the bottom, less the card Cryogen Relic drew');
});
test('Simulacrum Synthesizer: another artifact with mana value 3 or more makes a Construct that counts artifacts', () => {
  let s = setup({ me: { hand: ['pinnacle-starcage'], bf: ['simulacrum-synthesizer', W, W, W] } });
  s = cast(s, 'pinnacle-starcage'); s = resolveAll(s, q => q.opts[0].id);
  const c = find(s, 'token-construct', 'bf'); eq(pt(s, c), [3, 3], 'three artifacts: Synthesizer, Starcage, itself');
});
test('Perilous Snare: start your engines! — speed 1 (CR 702.179a), +1 when an opponent loses life on my turn, once a turn; max speed enables its ability', () => {
  let s = setup({ me: { hand: ['lightning-strike', 'lightning-strike'], bf: ['perilous-snare', 'mountain', 'mountain', 'mountain', 'mountain', 'token-doombot'] } });
  eq(s.players[0].speed, 1);
  s = cast(s, 'lightning-strike', player(1)); s = resolveAll(s); eq(s.players[0].speed, 2);
  s = cast(s, 'lightning-strike', player(1)); s = resolveAll(s); eq(s.players[0].speed, 2, 'once each turn');
  s = MF.clone(s); s.players[0].speed = 4; s = MF.run(s);
  ok(MF.legalActions(s).some(a => a.type === 'act' && s.cards[a.iid].id === 'perilous-snare'), 'max speed');
});
test('Repurposing Bay: sacrifice another artifact; fetch an artifact with mana value one more', () => {
  let s = setup({ me: { bf: ['repurposing-bay', 'candy-trail', W, W], lib: ['cryogen-relic', 'torpor-orb', W] } });
  s = activate(s, 'repurposing-bay', null, (q, st) => viewId(q, st, 'candy-trail')); s = resolveAll(s, (q, st) => viewId(q, st, 'cryogen-relic'));
  ok(find(s, 'cryogen-relic', 'bf'), 'mana value 2 for mana value 1');
});
test('Pinnacle Starcage: exiles every artifact and creature with mana value 2 or less until it leaves; {6}{W}{W} turns them into Robots', () => {
  let s = setup({ me: { hand: ['pinnacle-starcage'], bf: [W, W, W, W, W, W, W, W, W, W, W, 'candy-trail'] }, opp: { bf: ['cryogen-relic', 'perilous-snare'] } });
  s = cast(s, 'pinnacle-starcage'); s = resolveAll(s);
  ok(find(s, 'candy-trail', 'exile') && find(s, 'cryogen-relic', 'exile') && find(s, 'perilous-snare', 'bf'), 'two-drops gone, the three-drop stays');
  s = activate(s, 'pinnacle-starcage'); s = resolveAll(s, q => q.opts[0].id);
  eq(findAll(s, 'token-robot', 'bf').length, 2); ok(find(s, 'pinnacle-starcage', 'grave'), 'sacrificed'); ok(find(s, 'cryogen-relic', 'grave'), 'to its owner’s graveyard');
});
test('The Mind Stone: harness (CR 701.64); then its ∞ ability flickers a permanent at my end step', () => {
  let s = setup({ me: { bf: ['the-mind-stone', W, W, W, W, W, W, { id: 'braided-net-braided-quipu', ctr: { net: 1 } }] } });
  s = activate(s, 'the-mind-stone', 1); s = resolveAll(s);
  ok(s.cards[find(s, 'the-mind-stone')].harnessed, 'harnessed');
  s = toStep(s, 'end', tgt(find(s, 'braided-net-braided-quipu'))); s = resolveAll(s);   // no creatures: no attack question
  eq(s.cards[find(s, 'braided-net-braided-quipu', 'bf')].ctr.net, 3, 'a new object: three net counters again');
});
test('Cryogen Relic: draws on entering and leaving; sacrifice it to stun a tapped creature', () => {
  let s = setup({ me: { hand: ['cryogen-relic'], bf: [U, U, U, U], lib: [W, W, W] }, opp: { bf: [{ id: 'token-doombot', tapped: true }] } });
  s = cast(s, 'cryogen-relic'); s = resolveAll(s); eq(s.players[0].hand.length, 1);
  s = activate(s, 'cryogen-relic', null, tgt(find(s, 'token-doombot'))); s = resolveAll(s);
  eq(s.players[0].hand.length, 2, 'left the battlefield: drew'); eq(s.cards[find(s, 'token-doombot')].ctr.stun, 1);
});
test('Spring-Loaded Sawblades: 5 damage to a tapped opposing creature; craft with an artifact into Bladewheel Chariot (CR 702.167)', () => {
  let s = setup({ me: { hand: ['spring-loaded-sawblades-bladewheel-chariot'], bf: [W, W, W, W, W, W, 'candy-trail'] }, opp: { bf: [{ id: 'token-doombot', tapped: true }] } });
  s = cast(s, 'spring-loaded-sawblades-bladewheel-chariot'); s = resolveAll(s, tgt(find(s, 'token-doombot')));
  ok(!s.bf.some(i => s.cards[i].id === 'token-doombot'), 'destroyed');
  s = activate(s, 'spring-loaded-sawblades-bladewheel-chariot', null, (q, st) => viewId(q, st, 'candy-trail')); s = resolveAll(s);
  const ch = find(s, 'spring-loaded-sawblades-bladewheel-chariot', 'bf'); eq(MF.chars(s, ch).name, 'Bladewheel Chariot'); eq(pt(s, ch), [5, 5]);
});
test('Braided Net: three net counters; tap a permanent whose abilities stay off while it remains tapped', () => {
  let s = setup({ me: { hand: ['braided-net-braided-quipu'], bf: [U, U, U] }, opp: { bf: ['torpor-orb'] } });
  s = cast(s, 'braided-net-braided-quipu'); s = resolveAll(s);
  const bn = find(s, 'braided-net-braided-quipu'); eq(s.cards[bn].ctr.net, 3);
  s = MF.clone(s); s.cards[bn].ctlTurn = 0; s = MF.run(s);
  s = activate(s, 'braided-net-braided-quipu', null, tgt(find(s, 'torpor-orb'))); s = resolveAll(s);
  ok(s.cards[find(s, 'torpor-orb')].tapped, 'tapped (a land isn’t a legal target: nonland)'); ok(s.effects.some(e => e.k === 'lockTapped'), 'locked');
});
test('Dusk Rose Reliquary: sacrifice an artifact or creature as it is cast; exile an opposing artifact or creature until it leaves', () => {
  let s = setup({ me: { hand: ['dusk-rose-reliquary'], bf: [W, 'candy-trail'] }, opp: { bf: ['cryogen-relic'] } });
  s = cast(s, 'dusk-rose-reliquary', (q, st) => viewId(q, st, 'candy-trail')); s = resolveAll(s, tgt(find(s, 'cryogen-relic')));
  ok(find(s, 'candy-trail', 'grave') && find(s, 'cryogen-relic', 'exile'), 'paid and exiled');
});
test('Torpor Orb: a creature entering triggers nothing', () => {
  let s = setup({ me: { hand: ['kiora-the-rising-tide'], bf: ['torpor-orb', U, U, U], lib: [W, W, W] } });
  s = cast(s, 'kiora-the-rising-tide'); s = resolveAll(s);
  eq(s.players[0].hand.length, 0, 'no loot');
});
test('The Fire Crystal: red spells cost {1} less; creatures have haste; a token copy sacrificed at the next end step', () => {
  let s = setup({ me: { hand: ['lightning-strike'], bf: ['the-fire-crystal', 'mountain', 'mountain', 'mountain', 'mountain', 'mountain', 'mountain', { id: 'token-doombot', sick: true }] } });
  eq(MF.costOf(s, 0, find(s, 'lightning-strike')).g, 0); ok(has(s, find(s, 'token-doombot'), 'haste'), 'haste');
  s = activate(s, 'the-fire-crystal', null, tgt(find(s, 'token-doombot'))); s = resolveAll(s);
  eq(findAll(s, 'token-doombot', 'bf').length, 2);
  s = toStep(s, 'end', 'done'); s = resolveAll(s); eq(findAll(s, 'token-doombot', 'bf').length, 1, 'the copy is sacrificed');
});
