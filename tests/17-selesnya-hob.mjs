// Selesnya (Llanowar Elves), Arena top-ranked Standard after the Hobbit release.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const G = 'forest', W = 'plains';

test('Multiversal Passage: choose a basic land type as it enters (CR 614.12a); it is that type and taps for its color (CR 305.7)', () => {
  let s = setup({ me: { hand: ['multiversal-passage'] } });
  s = play(s, 'multiversal-passage'); s = answer(s, ['Plains', 'pay']); s = resolveAll(s);
  const m = find(s, 'multiversal-passage');
  ok(!s.cards[m].tapped, 'paid 2 life: untapped'); eq(s.players[0].life, 18);
  ok(MF.chars(s, m).subtypes.includes('Plains'), 'a Plains'); ok(MF.chars(s, m).ab.some(a => a.k === 'mana' && a.cols[0] === 'W'), 'taps for {W}');
  let t = setup({ me: { hand: ['multiversal-passage'] } });
  t = play(t, 'multiversal-passage'); t = answer(t, ['Forest', 'tapped']); ok(t.cards[find(t, 'multiversal-passage')].tapped, 'didn’t pay: tapped');
});
test('Brightglass Gearhulk: may search for up to two artifact/creature/enchantment cards with mana value 1 or less', () => {
  let s = setup({ me: { hand: ['brightglass-gearhulk'], bf: [G, G, W, W], lib: ['llanowar-elves', 'skateboard', 'seam-rip', 'ouroboroid', G] } });
  s = cast(s, 'brightglass-gearhulk'); s = resolveAll(s, 'yes', q => q.opts.find(o => o.iid != null && s.cards[o.iid].id === 'llanowar-elves').id, q => q.opts.find(o => o.iid != null && s.cards[o.iid].id === 'seam-rip').id);
  eq(s.players[0].hand.map(i => s.cards[i].id).sort(), ['llanowar-elves', 'seam-rip']);
  const h = find(s, 'brightglass-gearhulk'); ok(has(s, h, 'firstStrike') && has(s, h, 'trample'), 'first strike, trample');
});
test('Pawpatch Recruit: when an opponent targets my creature, a +1/+1 counter on another creature I control', () => {
  let s = setup({ me: { bf: ['pawpatch-recruit', 'llanowar-elves'] }, opp: { hand: ['lightning-strike'], bf: ['mountain', 'mountain'] } });
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  const p = find(s, 'pawpatch-recruit'), e = find(s, 'llanowar-elves');
  s = cast(s, 'lightning-strike', tgt(p));
  eq(s.pending.q.opts.map(o => o.id), [tgt(e)], 'only the other creature');
  s = answer(s, [tgt(e)]); s = resolveAll(s);
  eq(s.cards[e].ctr['+1/+1'], 1);
});
test('Leatherhead: enters with a hexproof counter (CR 122.1b); on combat damage, remove a counter to destroy an artifact or enchantment', () => {
  let s = setup({ me: { hand: ['leatherhead-swamp-stalker'], bf: [G, G, G, G] }, opp: { bf: ['skateboard'] } });
  s = cast(s, 'leatherhead-swamp-stalker'); s = resolveAll(s);
  const l = find(s, 'leatherhead-swamp-stalker'); ok(has(s, l, 'hexproof'), 'hexproof from the counter');
  s = MF.clone(s); s.cards[l].ctlTurn = 0; s = MF.run(s);
  s = toStep(s, 'attackers'); s = answer(s, [l, 'done']);
  s = toStep(s, 'main2', 'hexproof', tgt(find(s, 'skateboard')));
  ok(!has(s, l, 'hexproof'), 'the counter is gone'); ok(find(s, 'skateboard', 'grave'), 'Skateboard destroyed'); eq(s.players[1].life, 15);
});
test('Spider Manifestation: untaps when I cast a spell with mana value 4 or greater', () => {
  let s = setup({ me: { hand: ['ouroboroid'], bf: ['spider-manifestation', G, G, G] } });
  const sp = find(s, 'spider-manifestation');
  s = cast(s, 'ouroboroid', 'tap:' + sp + ':0:G');
  ok(s.cards[sp].tapped, 'paid with it'); s = resolveAll(s);
  ok(!s.cards[sp].tapped, 'untapped by its trigger');
});
test('Ouroboroid: at the beginning of my combat, X +1/+1 counters on each of my creatures, X its power, fixed once', () => {
  let s = setup({ me: { bf: ['ouroboroid', 'llanowar-elves'] } });
  s = toStep(s, 'boc'); s = resolveAll(s);
  eq(pt(s, find(s, 'ouroboroid')), [2, 4]); eq(pt(s, find(s, 'llanowar-elves')), [2, 2]);
});
test('Seam Rip: exiles an opposing nonland permanent with mana value 2 or less until it leaves (CR 610.3); it returns to the battlefield', () => {
  let s = setup({ me: { hand: ['seam-rip'], bf: [W] }, opp: { bf: ['skateboard'], hand: ['banishing-light'] } });
  s = cast(s, 'seam-rip'); s = resolveAll(s, tgt(find(s, 'skateboard')));
  ok(find(s, 'skateboard', 'exile'), 'exiled');
  s = MF.clone(s); MF.sacrifice(s, find(s, 'seam-rip')); s = MF.run(s);
  ok(find(s, 'skateboard', 'bf', 1), 'back on the battlefield under its owner’s control');
});
test('Jennifer Walters: opponents can’t cast spells during my turn; {3}{G}{W}{W} transforms her; the back face can be cast directly (CR 712.8f)', () => {
  let s = setup({ me: { hand: ['jennifer-walters-the-sensational-she-hulk'], bf: [W, W, G, G, G, W, W, G, G] }, opp: { hand: ['lightning-strike'], bf: ['mountain', 'mountain'] } });
  const acts = MF.legalActions(s).filter(a => a.type === 'cast');
  ok(acts.some(a => a.alt) && acts.some(a => !a.alt), 'either face');
  s = cast(s, 'jennifer-walters-the-sensational-she-hulk'); s = resolveAll(s);
  const j = find(s, 'jennifer-walters-the-sensational-she-hulk');
  eq(MF.chars(s, j).mv, 2);
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  ok(!MF.legalActions(s).some(a => a.type === 'cast'), 'the opponent can’t cast spells in my turn');
  s = MF.clone(s); s.priority = 0; s = MF.run(s);
  s = activate(s, 'jennifer-walters-the-sensational-she-hulk'); s = resolveAll(s);
  eq(MF.chars(s, j).name, 'The Sensational She-Hulk'); eq(pt(s, j), [6, 6]); ok(has(s, j, 'reach') && has(s, j, 'trample'), 'reach, trample');
  eq(MF.chars(s, j).mv, 6, 'a modal double-faced permanent has only the face that is up (CR 712.8f)');
});
test('The Sensational She-Hulk cast as its back face: mana value 6; damage to my creature lets her deal that much, once each turn', () => {
  let s = setup({ me: { hand: ['jennifer-walters-the-sensational-she-hulk'], bf: [W, W, G, G, G, W, 'llanowar-elves'] }, opp: { hand: ['lightning-strike', 'lightning-strike'], bf: ['mountain', 'mountain', 'mountain', 'mountain'] } });
  const a = MF.legalActions(s).find(l => l.type === 'cast' && l.alt);
  s = answer(MF.apply(s, a), []); s = resolveAll(s);
  const j = find(s, 'jennifer-walters-the-sensational-she-hulk');
  eq(MF.chars(s, j).name, 'The Sensational She-Hulk'); eq(MF.chars(s, j).mv, 6);
  s = MF.clone(s); s.ap = 1; s.priority = 1; s = MF.run(s);
  s = cast(s, 'lightning-strike', tgt(j));
  s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  s = answer(s, [player(1)]); s = resolveAll(s, 'yes');
  eq(s.players[1].life, 17, 'she dealt 3');
  s = cast(s, 'lightning-strike', tgt(j)); s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  s = answer(s, [player(1)]); s = resolveAll(s);
  eq(s.players[1].life, 17, 'only once each turn'); ok(logs(s, 'onceDone').length === 1, 'logged');
});
test('Outcaster Trailblazer: entering adds one mana of any color; plot (CR 702.170) — cast it free on a later turn', () => {
  let s = setup({ me: { hand: ['outcaster-trailblazer'], bf: [G, G, G] } });
  ok(MF.legalActions(s).some(a => a.type === 'plot'), 'plot offered');
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'plot')); s = answer(s, []);
  ok(find(s, 'outcaster-trailblazer', 'exile'), 'plotted'); ok(!MF.legalActions(s).some(a => a.type === 'cast'), 'not this turn');
  s = MF.clone(s); s.turn += 2; for (const i of s.bf) s.cards[i].tapped = true; s = MF.run(s);
  const c = MF.legalActions(s).find(a => a.type === 'cast'); ok(c, 'castable free on a later turn, lands tapped');
  s = answer(MF.apply(s, c), []); s = resolveAll(s, 'W');
  eq(s.players[0].pool.W, 1, 'added {W}');
});
test('Outcaster Trailblazer: another creature with power 4 or greater entering draws a card', () => {
  let s = setup({ me: { hand: ['leatherhead-swamp-stalker'], bf: ['outcaster-trailblazer', G, G, G, G], lib: [G, G] } });
  s = cast(s, 'leatherhead-swamp-stalker'); s = resolveAll(s);
  eq(s.players[0].hand.length, 1);
});
