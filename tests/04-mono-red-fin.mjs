// Mono-Red Aggro (Pro Tour Final Fantasy, 1st — Ken Yukuhiro): one behaviour test per card.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const M = 'mountain', mts = n => Array(n).fill(M);

test('Burst Lightning: 2 damage; kicked (CR 702.33) 4 damage', () => {
  let s = setup({ me: { hand: ['burst-lightning'], bf: mts(5) } });
  s = cast(s, 'burst-lightning', 'no', player(1)); s = resolveAll(s);
  eq(s.players[1].life, 18, 'unkicked');
  s = setup({ me: { hand: ['burst-lightning'], bf: mts(5) } });
  s = cast(s, 'burst-lightning', 'yes', player(1)); s = resolveAll(s);
  eq(s.players[1].life, 16, 'kicked'); eq(s.bf.filter(i => s.cards[i].tapped).length, 5, 'paid {4}{R}');
});
test('Burst Lightning: the kicker question is not asked when the kicker cannot be paid', () => {
  let s = setup({ me: { hand: ['burst-lightning'], bf: mts(2) } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'cast'));
  eq(s.pending.q.kind, 'target');
});
test('Lightning Strike: 3 damage to any target', () => {
  let s = setup({ me: { hand: ['lightning-strike'], bf: mts(2) } });
  s = cast(s, 'lightning-strike', player(1)); s = resolveAll(s);
  eq(s.players[1].life, 17);
});
test('Magebane Lizard: a player casting a noncreature spell is dealt damage equal to their noncreature spells this turn', () => {
  let s = setup({ me: { hand: ['lightning-strike', 'burst-lightning'], bf: mts(4) }, opp: { bf: ['magebane-lizard'] } });
  s = cast(s, 'lightning-strike', player(1)); s = resolveAll(s);
  eq(s.players[0].life, 19, 'first noncreature spell: 1');
  s = cast(s, 'burst-lightning', player(1)); s = resolveAll(s);                                 // two lands left: kicker cannot be paid, so it is not asked
  eq(s.players[0].life, 17, 'second: 2 more');
});
test('Manifold Mouse: at the beginning of combat on your turn, target Mouse gains your choice of double strike or trample', () => {
  let s = setup({ me: { bf: ['manifold-mouse'] } });
  const m = find(s, 'manifold-mouse');
  s = toStep(s, 'boc', tgt(m));
  s = resolveAll(s, 'doubleStrike');
  ok(has(s, m, 'doubleStrike'), 'double strike'); ok(!has(s, m, 'trample'), 'not trample');
});
test('Monstrous Rage: +2/+0 and a Monster Role (+1/+1, trample); a second Role replaces the first (CR 704.5z)', () => {
  let s = setup({ me: { hand: ['monstrous-rage', 'monstrous-rage'], bf: ['hired-claw', M, M] } });
  const c = find(s, 'hired-claw');
  s = cast(s, 'monstrous-rage', tgt(c)); s = resolveAll(s);
  eq(pt(s, c), [4, 3]); ok(has(s, c, 'trample'), 'trample from the Role');
  eq(findAll(s, 'token-role-monster', 'bf').length, 1);
  s = cast(s, 'monstrous-rage', tgt(c)); s = resolveAll(s);
  eq(findAll(s, 'token-role-monster', 'bf').length, 1, 'only the newest Role stays');
  eq(pt(s, c), [6, 3], 'two +2/+0, one Role');
});
test('Emberheart Challenger: valiant exiles the top card, playable this turn — only the first targeting each turn; prowess', () => {
  let s = setup({ me: { hand: ['monstrous-rage', 'lightning-strike'], bf: ['emberheart-challenger', ...mts(3)], lib: ['mountain', 'burst-lightning', M, M] } });
  const e = find(s, 'emberheart-challenger');
  s = cast(s, 'monstrous-rage', tgt(e));
  s = resolveAll(s, q => q.opts[0].id);                                                         // order valiant and prowess
  const ex = find(s, 'mountain', 'exile');
  ok(MF.legalActions(s).some(a => a.type === 'land' && a.iid === ex), 'the exiled Mountain can be played this turn');
  eq(pt(s, e), [6, 4], '2/2 +2/+0, Role +1/+1, prowess +1/+1');
  s = cast(s, 'lightning-strike', player(1)); s = resolveAll(s);
  eq(s.players[0].exile.length, 1, 'no second valiant trigger this turn (Lightning Strike targeted a player anyway)');
});
test('Rockface Village: its red mana pays only for creature spells; {R},{T}: a Lizard/Mouse/Otter/Raccoon gets +1/+0 and haste', () => {
  let s = setup({ me: { hand: ['burst-lightning', 'heartfire-hero'], bf: ['rockface-village'] } });
  ok(!MF.canCast(s, 0, find(s, 'burst-lightning')), 'cannot pay {R} for an instant with it');
  ok(MF.canCast(s, 0, find(s, 'heartfire-hero')), 'can pay {R} for a creature');
  let t = setup({ me: { bf: ['rockface-village', M, { id: 'heartfire-hero', sick: true }] } });
  const h = find(t, 'heartfire-hero');
  t = activate(t, 'rockface-village', null, tgt(h)); t = resolveAll(t);
  ok(has(t, h, 'haste'), 'haste'); eq(pt(t, h), [3, 2], '1/1, valiant counter, +1/+0');
});
test('Heartfire Hero + Self-Destruct: X damage both ways; the Hero dies and deals its last known power to each opponent', () => {
  let s = setup({ me: { hand: ['self-destruct'], bf: ['rockface-village', M, M, M, 'heartfire-hero'] } });
  const h = find(s, 'heartfire-hero');
  s = activate(s, 'rockface-village', null, tgt(h)); s = resolveAll(s);                         // valiant: +1/+1 counter; +1/+0 → 3/2
  s = cast(s, 'self-destruct', tgt(h), player(1)); s = resolveAll(s);
  ok(s.players[0].grave.some(i => s.cards[i].id === 'heartfire-hero'), 'the Hero died');
  eq(s.players[1].life, 20 - 3 - 3, '3 from Self-Destruct, 3 from the dies trigger');
});
test('Hired Claw: attacking with a Lizard pings target opponent; {1}{R}: counter only if an opponent lost life, once per turn', () => {
  let s = setup({ me: { bf: ['hired-claw', ...mts(4)] } });
  const c = find(s, 'hired-claw');
  ok(!MF.legalActions(s).some(a => a.type === 'act'), 'no opponent has lost life yet');
  s = toStep(s, 'attackers'); s = answer(s, [c, 'done']);
  s = resolveAll(s, player(1));
  eq(s.players[1].life, 19, 'the attack trigger');
  s = toStep(s, 'main2', 'done');
  s = activate(s, 'hired-claw'); s = resolveAll(s);
  eq(s.cards[c].ctr['+1/+1'], 1);
  ok(!MF.legalActions(s).some(a => a.type === 'act'), 'only once each turn');
});
test('Soulstone Sanctuary: {4}: a 3/3 vigilance creature with all creature types, still a land', () => {
  let s = setup({ me: { bf: ['soulstone-sanctuary', ...mts(4)] } });
  const l = find(s, 'soulstone-sanctuary');
  s = activate(s, 'soulstone-sanctuary', 1); s = resolveAll(s);
  const ch = MF.chars(s, l);
  ok(ch.types.includes('Land') && ch.types.includes('Creature'), 'land creature'); eq([ch.p, ch.t], [3, 3]); ok(ch.kw.vigilance, 'vigilance');
  ok(MF.matchChars(s, l, ch, { subtypes: ['Lizard'] }, 0, null), 'it is a Lizard (all creature types)');
});
test('Twinmaw Stormbrood // Charring Bite: cast as an Omen (CR 720) — 5 damage to a creature without flying, then shuffled into the library', () => {
  let s = setup({ me: { hand: ['twinmaw-stormbrood-charring-bite'], bf: mts(2) }, opp: { bf: ['quaketusk-boar'] } });
  const a = MF.legalActions(s).find(l => l.type === 'cast' && l.alt);
  ok(a, 'the Omen is offered'); ok(!MF.legalActions(s).some(l => l.type === 'cast' && !l.alt), 'the creature ({5}{W}) is not castable here');
  const lib0 = s.players[0].lib.length;
  s = MF.apply(s, a); s = answer(s, [tgt(find(s, 'quaketusk-boar'))]); s = resolveAll(s);
  ok(s.players[1].grave.some(i => s.cards[i].id === 'quaketusk-boar'), 'the Boar died');
  eq(s.players[0].lib.length, lib0 + 1, 'shuffled into the library'); eq(s.players[0].grave.length, 0, 'not in the graveyard');
});
test('Tersa Lightshatter: discard up to two, then draw that many; attacking with seven in the graveyard exiles one at random, playable', () => {
  let s = setup({ me: { hand: ['tersa-lightshatter', M, M], bf: mts(3) } });
  s = cast(s, 'tersa-lightshatter'); s = resolveAll(s, (q, st) => q.opts.find(o => o.iid != null).id, (q, st) => q.opts.find(o => o.iid != null).id);
  eq(s.players[0].grave.length, 2, 'discarded two'); eq(s.players[0].hand.length, 2, 'drew two');
  let t = setup({ me: { bf: ['tersa-lightshatter'], grave: Array(7).fill('lightning-strike') } });
  t = toStep(t, 'attackers'); t = answer(t, [find(t, 'tersa-lightshatter'), 'done']); t = resolveAll(t);
  eq(t.players[0].exile.length, 1, 'one card exiled'); ok(t.effects.some(e => e.k === 'mayPlay' && e.turn === t.turn), 'playable this turn');
});
test('Screaming Nemesis: dealt damage → that much to any other target; a player hit this way cannot gain life again', () => {
  let s = setup({ me: { hand: ['burst-lightning'], bf: mts(1) }, opp: { bf: ['screaming-nemesis', 'blossoming-sands'], hand: [] } });
  s = cast(s, 'burst-lightning', tgt(find(s, 'screaming-nemesis')));
  s = resolveAll(s, player(0));                                                                 // the opponent's Nemesis aims back at you
  eq(s.players[0].life, 18, 'Nemesis dealt the 2 it was dealt');
  ok(s.players[0].noGain, 'you can no longer gain life');
  s = MF.clone(s); MF.gainLife(s, 0, 3, null); eq(s.players[0].life, 18, 'life gain does nothing');
});
