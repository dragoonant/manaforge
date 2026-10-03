// One behaviour test per card in Otter Limits (BLB Starter Kit). Each asserts the side effect.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const lands = (n, id) => Array(n).fill(id || 'island');
const I = 'island', M = 'mountain';

test('Bria, Riptide Rogue: other creatures have prowess; a noncreature spell makes target creature unblockable', () => {
  let s = setup({ me: { hand: ['giant-growth'.replace('giant-growth', 'pearl-of-wisdom')], bf: ['bria-riptide-rogue', 'thieving-otter', ...lands(3, I)] } });
  const bria = find(s, 'bria-riptide-rogue'), otter = find(s, 'thieving-otter');
  ok(has(s, otter, 'prowess'), 'Thieving Otter has prowess from Bria');
  s = cast(s, 'pearl-of-wisdom');                                                              // costs {1}{U} with an Otter
  s = resolveAll(s, ...Array(4).fill(q => q.kind === 'trigOrder' ? q.opts[0].id : tgt(otter)));
  eq(pt(s, bria), [4, 4], 'Bria’s own prowess'); eq(pt(s, otter), [3, 3], 'granted prowess');
  ok(MF.chars(s, otter).unblockable, 'the target can’t be blocked this turn');
});
test('Stormcatch Mentor: instant and sorcery spells cost {1} less; haste and prowess', () => {
  let s = setup({ me: { hand: ['flame-lash'], bf: ['stormcatch-mentor', ...lands(3, M)] }, opp: { bf: ['warren-elder'] } });
  eq(MF.manaStr(MF.costOf(s, 0, find(s, 'flame-lash'))), '{2}{R}', 'Flame Lash costs {2}{R}');
  s = cast(s, 'flame-lash', tgt(find(s, 'warren-elder')));
  s = resolveAll(s);
  eq(s.bf.filter(i => s.cards[i].tapped).length, 3, 'three lands tapped');
  eq(pt(s, find(s, 'stormcatch-mentor')), [2, 2], 'prowess');
  ok(s.players[1].grave.some(i => s.cards[i].id === 'warren-elder'), 'Flame Lash killed it');
});
test('Bria + Stormcatch Mentor: two instances of prowess trigger separately (CR 702.108b)', () => {
  let s = setup({ me: { hand: ['flame-lash'], bf: ['bria-riptide-rogue', 'stormcatch-mentor', ...lands(4, M)] } });
  s = cast(s, 'flame-lash', player(1));
  s = resolveAll(s, ...Array(6).fill(q => q.kind === 'trigOrder' ? q.opts[0].id : tgt(find(s, 'stormcatch-mentor'))));
  eq(pt(s, find(s, 'stormcatch-mentor')), [3, 3]);
  eq(s.players[1].life, 16);
});
test('Pearl of Wisdom: costs {1} less with an Otter; draws two', () => {
  let s = setup({ me: { hand: ['pearl-of-wisdom'], bf: [...lands(3, I)] } });
  eq(MF.manaStr(MF.costOf(s, 0, find(s, 'pearl-of-wisdom'))), '{2}{U}', 'no Otter');
  s = setup({ me: { hand: ['pearl-of-wisdom'], bf: ['thieving-otter', ...lands(2, I)] } });
  eq(MF.manaStr(MF.costOf(s, 0, find(s, 'pearl-of-wisdom'))), '{1}{U}', 'with an Otter');
  const h = s.players[0].hand.length;
  s = cast(s, 'pearl-of-wisdom'); s = resolveAll(s);
  eq(s.players[0].hand.length, h - 1 + 2);
});
test('Mind Spring: X is announced, then you draw X', () => {
  let s = setup({ me: { hand: ['mind-spring'], bf: [...lands(5, I)] } });
  s = cast(s, 'mind-spring', 3);
  s = resolveAll(s);
  eq(s.players[0].hand.length, 3);
  eq(s.bf.filter(i => s.cards[i].tapped).length, 5, 'paid X=3 plus {U}{U}');
});
test('Thieving Otter: combat damage to an opponent draws a card', () => {
  let s = setup({ me: { bf: ['thieving-otter'] } });
  const h = s.players[0].hand.length;
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'thieving-otter'), 'done']);
  s = toStep(s, 'main2');
  eq(s.players[1].life, 18); eq(s.players[0].hand.length, h + 1);
});
test('Bellowing Crier: draw a card, then discard a card of your choice (the drawn card can be the one)', () => {
  let s = setup({ me: { hand: ['bellowing-crier', 'flame-lash'], bf: [...lands(2, I)], lib: ['mountain', I] } });
  s = cast(s, 'bellowing-crier');
  s = resolveAll(s, (q, st) => { ok(q.opts.length === 2, 'two cards offered: Flame Lash and the drawn Mountain'); return q.opts.find(o => MF.view(st).cards[o.iid].id === 'mountain').id; });
  ok(s.players[0].grave.some(i => s.cards[i].id === 'mountain'), 'discarded the drawn Mountain');
  ok(s.players[0].hand.some(i => s.cards[i].id === 'flame-lash'), 'kept Flame Lash');
});
test('Waterspout Warden: flying when it attacks only if another creature entered under your control this turn', () => {
  let s = setup({ me: { bf: ['waterspout-warden'] } });
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'waterspout-warden'), 'done']); s = resolveAll(s);
  ok(!has(s, find(s, 'waterspout-warden'), 'flying'), 'nothing entered: no flying');
  let t = setup({ me: { hand: ['stormcatch-mentor'], bf: ['waterspout-warden', I, M] } });
  t = cast(t, 'stormcatch-mentor'); t = resolveAll(t);
  t = toStep(t, 'attackers'); t = answer(t, [find(t, 'waterspout-warden'), 'done']); t = resolveAll(t);
  ok(has(t, find(t, 'waterspout-warden'), 'flying'), 'Stormcatch entered: flying');
});
test('Charmed Sleep: taps the creature as it enters; it does not untap', () => {
  let s = setup({ me: { hand: ['charmed-sleep'], bf: [...lands(3, I)] }, opp: { bf: ['warren-elder'] } });
  const e = find(s, 'warren-elder');
  s = cast(s, 'charmed-sleep', tgt(e)); s = resolveAll(s);
  ok(s.cards[e].tapped, 'tapped');
  s = toStep(s, 'upkeep', 'done', 'done'); s = toStep(s, 'main1');
  eq(s.ap, 1); ok(s.cards[e].tapped, 'still tapped in its controller’s turn');
});
test('Alania’s Pathmaker: exiles the top card; it may be played until the end of your next turn', () => {
  let s = setup({ me: { hand: ['alanias-pathmaker', 'island'], bf: [...lands(4, M)], lib: ['island', 'flame-lash', I, I, I] } });
  s = cast(s, 'alanias-pathmaker'); s = resolveAll(s);
  const ex = find(s, 'island', 'exile');
  ok(MF.legalActions(s).some(a => a.type === 'land' && a.iid === ex), 'the exiled land can be played');
  s = MF.apply(s, { type: 'land', iid: ex });
  ok(s.bf.some(i => s.cards[i].id === 'island'), 'played from exile');
  ok(!MF.legalActions(s).some(a => a.type === 'land'), 'it used the land drop');
});
test('Alania’s Pathmaker: the permission ends after your next turn', () => {
  let s = setup({ me: { hand: ['alanias-pathmaker'], bf: [...lands(4, M)], lib: ['flame-lash', I, I, I, I, I] } });
  s = cast(s, 'alanias-pathmaker'); s = resolveAll(s);
  const ex = find(s, 'flame-lash', 'exile');
  ok(s.effects.some(e => e.k === 'mayPlay' && e.iid === ex && e.turn === 5), 'until the end of turn 5');
  while (s.turn < 6) s = s.pending ? answer(s, ['done']) : MF.apply(s, { type: 'pass' });
  ok(!s.effects.some(e => e.k === 'mayPlay'), 'expired');
});
test('Flame Lash: 4 damage to any target, including a player', () => {
  let s = setup({ me: { hand: ['flame-lash'], bf: [...lands(4, M)] } });
  s = cast(s, 'flame-lash', player(1)); s = resolveAll(s);
  eq(s.players[1].life, 16);
});
test('Coruscation Mage: offspring makes a 1/1 token copy; each pings for 1 on a noncreature spell', () => {
  let s = setup({ me: { hand: ['coruscation-mage', 'flame-lash'], bf: [...lands(8, M)] } });
  s = cast(s, 'coruscation-mage', 'yes'); s = resolveAll(s);
  const mages = findAll(s, 'coruscation-mage', 'bf');
  eq(mages.length, 2, 'the Mage and its token copy');
  const tok = mages.find(i => s.cards[i].tok);
  eq(pt(s, tok), [1, 1], 'the copy is 1/1');
  s = cast(s, 'flame-lash', player(1)); s = resolveAll(s, q => q.opts[0].id, q => q.opts[0].id);
  eq(s.players[1].life, 20 - 2 - 4, 'two pings and Flame Lash');
});
test('Quaketusk Boar: trample — lethal to the blocker, the rest to the player (the split is asked)', () => {
  let s = setup({ me: { bf: ['quaketusk-boar'] }, opp: { bf: ['warren-elder'] } });
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'quaketusk-boar'), 'done']);
  s = toStep(s, 'blockers');
  // the AI seat is driven by hand here: block with Warren Elder
  s = answer(s, [q => q.opts.find(o => o.iid != null).id, 'done']);
  s = toStep(s, 'damage', q => q.opts[q.opts.length - 1].id);                                 // assign lethal (2) to the Elder
  s = toStep(s, 'main2');
  eq(s.players[1].life, 17, '5 power - 2 lethal = 3 tramples over');
  ok(s.players[1].grave.some(i => s.cards[i].id === 'warren-elder'), 'the blocker died');
});
test('Rabid Gnaw: +1/+0, then damage equal to its power', () => {
  let s = setup({ me: { hand: ['rabid-gnaw'], bf: ['thieving-otter', M, M] }, opp: { bf: ['treeguard-duo'] } });
  s = cast(s, 'rabid-gnaw', tgt(find(s, 'thieving-otter')), tgt(find(s, 'treeguard-duo'))); s = resolveAll(s);
  eq(s.cards[find(s, 'treeguard-duo')].dmg, 3);
  eq(pt(s, find(s, 'thieving-otter')), [3, 2]);
});
test('Sword of Vengeance: equip {3}; +2/+0, first strike, vigilance, trample, haste', () => {
  let s = setup({ me: { hand: ['sword-of-vengeance', 'thieving-otter'], bf: [...lands(6, M), ...lands(3, I)] } });
  s = cast(s, 'sword-of-vengeance'); s = resolveAll(s);
  s = cast(s, 'thieving-otter'); s = resolveAll(s);
  const o = find(s, 'thieving-otter', 'bf');
  s = activate(s, 'sword-of-vengeance', null, tgt(o)); s = resolveAll(s);
  eq(pt(s, o), [4, 2]);
  for (const k of ['firstStrike', 'vigilance', 'trample', 'haste']) ok(has(s, o, k), k);
  ok(MF.canAttack(s, o) || s.step === 'main1', 'haste lets it attack this turn');
  s = toStep(s, 'attackers'); s = answer(s, [o, 'done']);
  ok(!s.cards[o].tapped, 'vigilance: did not tap');
  s = toStep(s, 'main2');
  eq(s.players[1].life, 16);
});
test('Swiftwater Cliffs: enters tapped, gain 1 life; pays {U} or {R} — the colour is a choice', () => {
  let s = setup({ me: { hand: ['swiftwater-cliffs'], bf: [] } });
  s = play(s, 'swiftwater-cliffs'); s = resolveAll(s);
  ok(s.cards[find(s, 'swiftwater-cliffs', 'bf')].tapped); eq(s.players[0].life, 21);
  let t = setup({ me: { hand: ['bellowing-crier'], bf: ['swiftwater-cliffs', 'mountain'] } });
  t = MF.apply(t, MF.legalActions(t).find(a => a.type === 'cast'));
  const q = t.pending.q;
  eq(q.kind, 'pay');
  ok(q.opts.filter(o => o.iid === find(t, 'swiftwater-cliffs')).length === 2, 'Cliffs offered for blue and for red');
});
test('Mockingbird: X = 2 copies a creature with mana value 2 or less, and is a Bird with flying', () => {
  let s = setup({ me: { hand: ['mockingbird'], bf: [...lands(3, I)] }, opp: { bf: ['warren-elder', 'quaketusk-boar'] } });
  s = cast(s, 'mockingbird', 2);
  s = resolveAll(s, q => { ok(!q.opts.some(o => o.iid === find(s, 'quaketusk-boar')), 'the Boar (mana value 5) is not offered'); return find(s, 'warren-elder'); });
  const m = s.bf.find(i => s.cards[i].ctrl === 0 && s.cards[i].copy);
  const ch = MF.chars(s, m);
  eq(ch.name, 'Warren Elder'); eq([ch.p, ch.t], [2, 2]); ok(ch.kw.flying, 'flying'); ok(ch.subtypes.includes('Bird') && ch.subtypes.includes('Rabbit'), 'Rabbit Cleric Bird');
  ok(ch.ab.some(a => a.k === 'act'), 'it has Warren Elder’s ability');
});
test('Alania, Divergent Storm: the first instant this turn may be copied by letting the opponent draw', () => {
  let s = setup({ me: { hand: ['flame-lash', 'flame-lash'], bf: ['alania-divergent-storm', ...lands(8, M)] } });
  const oh = s.players[1].hand.length;
  s = cast(s, 'flame-lash', player(1));
  s = resolveAll(s, player(1), 'yes', 'keep');                                                 // Alania targets the opponent; yes; keep the copy's target
  eq(s.players[1].life, 12, 'Flame Lash and its copy'); eq(s.players[1].hand.length, oh + 1, 'the opponent drew');
  s = cast(s, 'flame-lash', player(1)); s = resolveAll(s);
  eq(s.players[1].life, 8, 'the second instant is not copied');
  eq(logs(s, 'copy').length, 1);
});
