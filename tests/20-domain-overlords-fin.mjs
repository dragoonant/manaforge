// Domain Overlords (Edgar Magalhaes), Pro Tour Final Fantasy.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const W = 'plains', U = 'island', G = 'forest';
const oppTurn = s => { s = MF.clone(s); s.ap = 1; s.priority = 1; return MF.run(s); };

test('High Noon: each player can cast only one spell each turn; sacrifice it for 5 damage', () => {
  let s = setup({ me: { hand: ['get-lost', 'get-lost'], bf: ['high-noon', W, W, W, W, 'mountain', 'mountain', 'mountain', 'mountain'] }, opp: { bf: ['zur-eternal-schemer', 'beza-the-bounding-spring'] } });
  s = cast(s, 'get-lost', tgt(find(s, 'zur-eternal-schemer'))); s = resolveAll(s);
  ok(!MF.legalActions(s).some(a => a.type === 'cast'), 'a second spell is not offered'); ok(/High Noon/.test(MF.whyNot(s, 0, find(s, 'get-lost', 'hand'))), 'and why');
  s = activate(s, 'high-noon', null, tgt(find(s, 'beza-the-bounding-spring'))); s = resolveAll(s);
  ok(find(s, 'beza-the-bounding-spring', 'grave'), '5 damage from the sacrificed enchantment');
});
test('Cavern of Souls: choose a creature type; its coloured mana pays only for that type, and that spell can’t be countered', () => {
  let s = setup({ me: { hand: ['cavern-of-souls', 'overlord-of-the-hauntwoods', 'leyline-binding'], bf: [G, G, G, G], lib: ['beza-the-bounding-spring'] } });
  s = play(s, 'cavern-of-souls');
  eq(s.pending.q.kind, 'enterChoice'); ok(s.pending.q.opts.length > 300, 'every creature type'); eq(s.pending.q.opts[0].id, 'Avatar', 'mine first');
  s = answer(s, ['Avatar']); s = resolveAll(s);
  const cav = find(s, 'cavern-of-souls');
  eq(MF.manaSources(s, 0, { creature: false }).filter(m => m.iid === cav).map(m => m.cols.join('')), ['C'], 'only {C} for a noncreature spell');
  eq(MF.manaSources(s, 0, { creature: true, subtypes: ['Avatar', 'Horror'] }).filter(m => m.iid === cav).length, 2, 'any colour for an Avatar');
  s = cast(s, 'overlord-of-the-hauntwoods', 'tap:' + cav + ':2:W');
  const L = s.stack[s.stack.length - 1]; ok(L.uncounterable, 'can’t be countered');
});
test('Overlord of the Hauntwoods: a tapped Everywhere token with every basic land type; domain counts five', () => {
  let s = setup({ me: { hand: ['overlord-of-the-hauntwoods', 'leyline-binding'], bf: [G, G, G, G, G] } });
  s = cast(s, 'overlord-of-the-hauntwoods'); s = resolveAll(s);
  const e = find(s, 'token-everywhere', 'bf'); ok(s.cards[e].tapped, 'tapped');
  eq(MF.chars(s, e).subtypes, ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']);
  eq(MF.costOf(s, 0, find(s, 'leyline-binding')).g, 0, '{5}{W} less five: {W}');
});
test('Zur: enchantment creatures I control have deathtouch, lifelink, hexproof; {1}{W} animates a non-Aura enchantment with base P/T = its mana value', () => {
  let s = setup({ me: { bf: ['zur-eternal-schemer', 'authority-of-the-consuls', 'temporary-lockdown', W, W] } });
  const t = find(s, 'temporary-lockdown');
  s = activate(s, 'zur-eternal-schemer', null, tgt(t)); s = resolveAll(s);
  ok(MF.chars(s, t).types.includes('Creature'), 'a creature'); eq(pt(s, t), [3, 3]); ok(has(s, t, 'deathtouch') && has(s, t, 'hexproof'), 'Zur’s grant');
});
test('Ride’s End: costs {3} less if it targets a tapped permanent (CR 601.2f, after the targets)', () => {
  let s = setup({ me: { hand: ['rides-end'], bf: [W, W] }, opp: { bf: [{ id: 'beza-the-bounding-spring', tapped: true }, 'zur-eternal-schemer'] } });
  ok(MF.legalActions(s).some(a => a.type === 'cast'), 'castable with two lands: a tapped target exists');
  s = cast(s, 'rides-end', tgt(find(s, 'beza-the-bounding-spring'))); s = resolveAll(s);
  ok(find(s, 'beza-the-bounding-spring', 'exile'), 'exiled');
  let t = setup({ me: { hand: ['rides-end'], bf: [W, W] }, opp: { bf: ['zur-eternal-schemer'] } });
  ok(!MF.legalActions(t).some(a => a.type === 'cast'), 'no tapped target: {4}{W}');
});
test('Authority of the Consuls: creatures my opponents control enter tapped, and I gain 1 life', () => {
  let s = setup({ me: { bf: ['authority-of-the-consuls'] }, opp: { hand: ['zur-eternal-schemer'], bf: [W, U, 'swamp'] } });
  s = oppTurn(s); s = cast(s, 'zur-eternal-schemer'); s = resolveAll(s);
  ok(s.cards[find(s, 'zur-eternal-schemer')].tapped, 'tapped'); eq(s.players[0].life, 21);
});
test('Leyline Binding: flash; exiles an opposing nonland permanent until it leaves', () => {
  let s = setup({ me: { hand: ['leyline-binding'], bf: [W, U, 'swamp', 'mountain', G, W] }, opp: { bf: ['zur-eternal-schemer'] } });
  eq(MF.costOf(s, 0, find(s, 'leyline-binding')).g, 0, 'five basic types');
  s = cast(s, 'leyline-binding'); s = resolveAll(s, tgt(find(s, 'zur-eternal-schemer')));
  ok(find(s, 'zur-eternal-schemer', 'exile'), 'exiled');
});
