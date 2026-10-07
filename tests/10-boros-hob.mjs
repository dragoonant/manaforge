// Boros (Belladonna Took), Arena top-ranked Standard after the Hobbit release: one test per new card or rule.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const W = 'plains', R = 'mountain';
const lands = (n, id) => Array(n).fill(id);
const warriors = s => findAll(s, 'token-warrior-1-1-r', 'bf');

test('Voice of Victory: mobilize 2 (CR 702.181a) — two tapped attacking Warriors, unblocked, sacrificed at the next end step', () => {
  let s = setup({ me: { bf: ['voice-of-victory'] } });
  const v = find(s, 'voice-of-victory');
  s = toStep(s, 'attackers'); s = answer(s, [v, 'done']); s = resolveAll(s);
  eq(warriors(s).length, 2); ok(warriors(s).every(i => s.cards[i].tapped && s.combat.attackers.includes(i)), 'tapped and attacking');
  eq(logs(s, 'trigger').filter(e => e.c === 'voice-of-victory').length, 1, 'the tokens entering attacking did not trigger "attacks"');
  s = toStep(s, 'eoc'); eq(s.players[1].life, 17, '1 + 1 + 1');
  s = toStep(s, 'end'); s = resolveAll(s);
  eq(warriors(s).length, 0, 'sacrificed at the end step');
});
test('Voice of Victory: the opponent can’t cast spells during my turn (CR 601.3)', () => {
  let s = setup({ me: { hand: ['opt'], bf: ['voice-of-victory', 'island'] }, opp: { hand: ['lightning-strike'], bf: [R, R] } });
  s = cast(s, 'opt'); s = MF.apply(s, { type: 'pass' });
  eq(s.priority, 1); ok(!MF.legalActions(s).some(a => a.type === 'cast'), 'no casting for the opponent');
});
test('Stadium Headliner: sacrificed, it deals damage equal to the creatures I control — counted on resolution (its ruling)', () => {
  let s = setup({ me: { bf: ['stadium-headliner', 'warren-elder', 'warren-elder', R, R] }, opp: { bf: ['quaketusk-boar'] } });
  s = activate(s, 'stadium-headliner', 1, tgt(find(s, 'quaketusk-boar'))); s = resolveAll(s);
  eq(logs(s, 'damageCreature')[0].n, 2, 'two Elders remain (the Headliner was sacrificed as the cost)');
});
test('Belladonna Took: tokens entering — gain 1, then draw, then +1/+1 counters; identical triggers are not ordered', () => {
  let s = setup({ me: { hand: ['hop-to-it'], bf: ['belladonna-took', W, W, W], lib: ['opt', W] } });
  s = cast(s, 'hop-to-it'); s = resolveAll(s);
  eq(s.players[0].life, 21); eq(s.players[0].hand.length, 1); eq(pt(s, find(s, 'belladonna-took')), [3, 3]);
});
test('Frontline Rush: modal — +X/+X where X is the number of creatures I control', () => {
  let s = setup({ me: { hand: ['frontline-rush'], bf: ['warren-elder', 'warren-elder', R, W] } });
  s = cast(s, 'frontline-rush', 1, tgt(find(s, 'warren-elder'))); s = resolveAll(s);
  eq(pt(s, find(s, 'warren-elder')), [4, 4]);
});
test('Song of Totentanz: X Rats that can’t block; my creatures gain haste until end of turn', () => {
  let s = setup({ me: { hand: ['song-of-totentanz'], bf: [R, R, R] } });
  s = cast(s, 'song-of-totentanz', 2); s = resolveAll(s);
  const rats = findAll(s, 'token-rat-1-1-b-this-token-can-t-block', 'bf'); eq(rats.length, 2);
  ok(rats.every(i => has(s, i, 'haste')), 'haste'); ok(MF.restricted(s, rats[0], 'block'), 'can’t block');
});
test('The Last Ronin’s Technique: sneak (CR 702.190) — return an unblocked attacker, three Ninja Turtles enter tapped and attacking', () => {
  let s = setup({ me: { hand: ['the-last-ronins-technique'], bf: ['warren-elder', W, W] } });
  const e = find(s, 'warren-elder');
  ok(!MF.legalActions(s).some(a => a.via === 'sneak'), 'no sneak in the main phase');
  s = toStep(s, 'attackers'); s = answer(s, [e, 'done']); s = toStep(s, 'blockers');
  const a = MF.legalActions(s).find(l => l.via === 'sneak'); ok(a, 'sneak offered in the declare blockers step');
  s = MF.apply(s, a); s = answer(s, [e]); s = resolveAll(s);
  ok(s.players[0].hand.some(i => s.cards[i].id === 'warren-elder'), 'the Elder returned to hand');
  const turtles = findAll(s, 'token-ninja-turtle-spirit-1-1-w', 'bf'); eq(turtles.length, 3); ok(turtles.every(i => s.combat.attackers.includes(i) && s.combat.blocked[i] === false), 'unblocked attackers');
  s = toStep(s, 'eoc'); eq(s.players[1].life, 17);
});
test('The Last Ronin’s Technique cast normally: three untapped Ninja Turtles, not attacking', () => {
  let s = setup({ me: { hand: ['the-last-ronins-technique'], bf: lands(4, W) } });
  s = cast(s, 'the-last-ronins-technique'); s = resolveAll(s);
  ok(findAll(s, 'token-ninja-turtle-spirit-1-1-w', 'bf').every(i => !s.cards[i].tapped), 'untapped');
});
test('Political Triumph: each creature entering scries 1 and adds a plan counter; the fourth sacrifices it, draws, and pumps', () => {
  let s = setup({ me: { hand: ['hop-to-it'], bf: [{ id: 'political-triumph', ctr: { plan: 1 } }, W, W, W], lib: ['opt', W, W, W, W, W] } });
  s = cast(s, 'hop-to-it'); s = resolveAll(s, 'top', 'top', 'top');
  ok(s.players[0].grave.some(i => s.cards[i].id === 'political-triumph'), 'sacrificed'); eq(s.players[0].hand.length, 1);
  ok(findAll(s, 'token-rabbit-1-1-w', 'bf').every(i => pt(s, i)[0] === 2), 'each Rabbit got a counter');
});
test('Warleader’s Call: creatures I control get +1/+1; each creature entering deals 1 to each opponent', () => {
  let s = setup({ me: { hand: ['hop-to-it'], bf: ['warleaders-call', W, W, W] } });
  s = cast(s, 'hop-to-it'); s = resolveAll(s);
  eq(s.players[1].life, 17); ok(findAll(s, 'token-rabbit-1-1-w', 'bf').every(i => pt(s, i)[0] === 2), '2/2 Rabbits');
});
test('Fountainport: Fish for 1 life; Treasure; sacrifice a token to draw; a Treasure pays any colour (CR 111.10a)', () => {
  let s = setup({ me: { hand: ['opt'], bf: ['fountainport', ...lands(8, R)], lib: ['opt', R, R] } });
  s = activate(s, 'fountainport', 3); s = resolveAll(s);
  const tr = find(s, 'token-treasure', 'bf'); ok(tr, 'a Treasure');
  s = cast(s, 'opt', 'tap:' + tr + ':0:U'); s = resolveAll(s, 'top');
  ok(s.players[0].grave.some(i => s.cards[i].id === 'opt'), 'Opt paid with the Treasure'); eq(findAll(s, 'token-treasure', 'bf').length, 0, 'the Treasure was sacrificed');
  let t = setup({ me: { bf: ['fountainport', 'token-rabbit-1-1-w', ...lands(4, R)], lib: ['opt', R] } });
  t = activate(t, 'fountainport', 1, find(t, 'token-rabbit-1-1-w')); t = resolveAll(t);
  eq(t.players[0].hand.length, 1); eq(findAll(t, 'token-rabbit-1-1-w', 'bf').length, 0);
});
test('Dalkovan Encampment: whenever I attack this turn, two attacking Warriors — sacrificed at the next end step', () => {
  let s = setup({ me: { bf: ['dalkovan-encampment', 'warren-elder', W, W, W] } });
  s = activate(s, 'dalkovan-encampment', 2); s = resolveAll(s);
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'warren-elder'), 'done']); s = resolveAll(s);
  eq(warriors(s).length, 2); ok(warriors(s).every(i => s.combat.attackers.includes(i)), 'attacking');
  s = toStep(s, 'end'); s = resolveAll(s); eq(warriors(s).length, 0);
});
