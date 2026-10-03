// One behaviour test per card in Hare Raising (BLB Starter Kit). Each asserts the side effect.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const lands = (n, id) => Array(n).fill(id || 'plains');
const P = 'plains', F = 'forest';

test('Byrke, Long Ear of the Law: enters, +1/+1 counter on each of up to two targets; attack doubles counters', () => {
  let s = setup({ me: { hand: ['byrke-long-ear-of-the-law'], bf: [...lands(3, P), ...lands(3, F), 'warren-elder', 'druid-of-the-spade'] } });
  const elder = find(s, 'warren-elder'), druid = find(s, 'druid-of-the-spade');
  s = cast(s, 'byrke-long-ear-of-the-law');
  s = resolveAll(s, tgt(elder), tgt(druid));                                                     // the ETB trigger asks for up to two targets as it goes on the stack
  eq(s.cards[elder].ctr['+1/+1'], 1, 'Warren Elder counters'); eq(s.cards[druid].ctr['+1/+1'], 1, 'Druid counters');
  ok(MF.view(s).bf.some(i => s.cards[i].id === 'byrke-long-ear-of-the-law'), 'Byrke on the battlefield');
  s = toStep(s, 'attackers');
  s = answer(s, [elder, 'done']);
  s = resolveAll(s);
  eq(s.cards[elder].ctr['+1/+1'], 2, 'doubled on attack');
  eq(s.cards[druid].ctr['+1/+1'], 1, 'a creature that did not attack keeps its counter');
});
test('Byrke: "up to two" may take one target or none', () => {
  let s = setup({ me: { hand: ['byrke-long-ear-of-the-law'], bf: [...lands(3, P), ...lands(3, F), 'warren-elder'] } });
  const elder = find(s, 'warren-elder');
  s = cast(s, 'byrke-long-ear-of-the-law');
  s = resolveAll(s, tgt(elder), 'done');
  eq(s.cards[elder].ctr['+1/+1'], 1);
});
test('Serra Redeemer: another creature with power 2 or less entering gets two counters; a bigger one does not', () => {
  let s = setup({ me: { hand: ['warren-elder', 'treeguard-duo'], bf: ['serra-redeemer', ...lands(4, P), ...lands(3, F)] } });
  s = cast(s, 'warren-elder'); s = resolveAll(s);
  const elder = find(s, 'warren-elder', 'bf');
  eq(s.cards[elder].ctr['+1/+1'], 2, 'Warren Elder (2/2) gets two');
  s = cast(s, 'treeguard-duo'); s = resolveAll(s, q => q.opts[0].id);
  const duo = find(s, 'treeguard-duo', 'bf');
  eq(s.cards[duo].ctr['+1/+1'] || 0, 0, 'Treeguard Duo (3/4) gets none');
});
test('Colossification: taps the enchanted creature as it enters; +20/+20', () => {
  let s = setup({ me: { hand: ['colossification'], bf: [...lands(2, P), ...lands(5, F), 'warren-elder'] }, opp: { bf: ['thieving-otter'] } });
  const otter = find(s, 'thieving-otter');
  s = cast(s, 'colossification', tgt(otter));
  s = resolveAll(s);
  eq(pt(s, otter), [22, 22]); ok(s.cards[otter].tapped, 'tapped');
});
test('Fecund Greenshell: ten lands give +2/+2; a creature with toughness > power entering looks at the top card', () => {
  let s = setup({ me: { hand: ['fecund-greenshell'], bf: [...lands(5, P), ...lands(4, F)], lib: [F, P, P] } });
  s = cast(s, 'fecund-greenshell');
  s = resolveAll(s, 'yes');                                                                       // top is a Forest: put it onto the battlefield tapped
  const g = find(s, 'fecund-greenshell', 'bf');
  eq(s.bf.filter(i => MF.isType(s, i, 'Land')).length, 10, 'ten lands');
  eq(pt(s, g), [6, 8], 'its own +2/+2');
  ok(s.cards[s.bf.find(i => s.cards[i].id === 'forest' && s.cards[i].tapped && s.cards[i].ctlTurn === 3)], 'the Forest entered tapped');
});
test('Fecund Greenshell: a nonland top card goes to hand', () => {
  let s = setup({ me: { hand: ['fecund-greenshell'], bf: [...lands(5, F)], lib: ['giant-growth', P] } });
  s = cast(s, 'fecund-greenshell'); s = resolveAll(s);
  ok(s.players[0].hand.some(i => s.cards[i].id === 'giant-growth'), 'Giant Growth to hand');
});
test('Finneas, Ace Archer: counters on each other token or Rabbit; draw if total power ≥ 10', () => {
  let s = setup({ me: { bf: ['finneas-ace-archer', 'warren-elder', 'treeguard-duo', 'token-rabbit-1-1-w'] } });
  const elder = find(s, 'warren-elder'), duo = find(s, 'treeguard-duo'), rab = find(s, 'token-rabbit-1-1-w');
  const hand0 = s.players[0].hand.length;
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'finneas-ace-archer'), 'done']); s = resolveAll(s);
  eq(s.cards[elder].ctr['+1/+1'], 1, 'Rabbit Cleric'); eq(s.cards[rab].ctr['+1/+1'], 1, 'token'); eq(s.cards[duo].ctr['+1/+1'] || 0, 1, 'Treeguard Duo is a Frog Rabbit');
  eq(s.players[0].hand.length, hand0 + 1, 'total power 2 + 3 + 4 + 2 = 11: draw a card');
});
test('Finneas: draws when creatures you control total 10 or more power', () => {
  let s = setup({ me: { bf: ['finneas-ace-archer', 'fecund-greenshell', 'treeguard-duo'] } });
  const h0 = s.players[0].hand.length;
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'finneas-ace-archer'), 'done']); s = resolveAll(s);
  eq(s.players[0].hand.length, h0 + 1, 'Finneas 2 + Greenshell 4 + Duo 4 (with counter) = 10');
});
test('Pileated Provisioner: a counter on target creature you control without flying (not on a flier)', () => {
  let s = setup({ me: { hand: ['pileated-provisioner'], bf: [...lands(5, P), 'warren-elder', 'serra-redeemer'] } });
  s = cast(s, 'pileated-provisioner');
  s = resolveAll(s, q => { ok(!q.opts.some(o => o.iid === find(s, 'serra-redeemer')), 'Serra Redeemer (flying) is not offered'); return tgt(find(s, 'warren-elder')); });
  eq(s.cards[find(s, 'warren-elder')].ctr['+1/+1'], 1);
});
test('Warren Elder: {3}{W}: creatures you control get +1/+1 until end of turn', () => {
  let s = setup({ me: { bf: ['warren-elder', 'druid-of-the-spade', ...lands(4, P)] } });
  s = activate(s, 'warren-elder'); s = resolveAll(s);
  eq(pt(s, find(s, 'warren-elder')), [3, 3]); eq(pt(s, find(s, 'druid-of-the-spade')), [3, 4]);
  s = toStep(s, 'upkeep', 'done');
  eq(pt(s, find(s, 'warren-elder')), [2, 2], 'ends at cleanup');
});
test('Rabbit Response: +2/+1 to your creatures; scry 2 only if you control a Rabbit', () => {
  let s = setup({ me: { hand: ['rabbit-response'], bf: ['warren-elder', ...lands(4, P)], lib: ['plains', 'forest', 'giant-growth'] } });
  s = cast(s, 'rabbit-response'); s = resolveAll(s, 'bottom', 'top');
  eq(pt(s, find(s, 'warren-elder')), [4, 3]);
  eq(logs(s, 'scry').length, 1, 'scried');
  eq(s.cards[s.players[0].lib[s.players[0].lib.length - 1]].id, 'plains', 'the first card went to the bottom');
  let t = setup({ me: { hand: ['rabbit-response'], bf: ['fecund-greenshell', ...lands(4, P)] } });
  t = cast(t, 'rabbit-response'); t = resolveAll(t);
  eq(logs(t, 'scry').length, 0, 'no Rabbit, no scry');
});
test('Carrot Cake: enters → a Rabbit and scry 1; {2},{T}, sacrifice → gain 3, and the sacrifice trigger makes a Rabbit and scries', () => {
  let s = setup({ me: { hand: ['carrot-cake'], bf: [...lands(4, P)] } });
  s = cast(s, 'carrot-cake'); s = resolveAll(s, 'top');
  eq(findAll(s, 'token-rabbit-1-1-w', 'bf').length, 1, 'one Rabbit');
  s = activate(s, 'carrot-cake'); s = resolveAll(s, 'top');
  eq(findAll(s, 'token-rabbit-1-1-w', 'bf').length, 2, 'a second Rabbit from the sacrifice');
  eq(s.players[0].life, 23, 'gained 3');
  eq(logs(s, 'scry').length, 2);
});
test('Repel Calamity: destroys power-or-toughness-4 creature; a 3/3 is not a legal target', () => {
  let s = setup({ me: { hand: ['repel-calamity'], bf: [...lands(2, P)] }, opp: { bf: ['quaketusk-boar', 'thieving-otter'] } });
  s = cast(s, 'repel-calamity', q => { ok(!q.opts.some(o => o.iid === find(s, 'thieving-otter')), 'Thieving Otter (2/2) not offered'); return tgt(find(s, 'quaketusk-boar')); });
  s = resolveAll(s);
  ok(s.players[1].grave.some(i => s.cards[i].id === 'quaketusk-boar'), 'Boar destroyed');
});
test('Hop to It: three 1/1 white Rabbit tokens', () => {
  let s = setup({ me: { hand: ['hop-to-it'], bf: [...lands(3, P)] } });
  s = cast(s, 'hop-to-it'); s = resolveAll(s);
  const r = findAll(s, 'token-rabbit-1-1-w', 'bf');
  eq(r.length, 3); eq(pt(s, r[0]), [1, 1]); eq(MF.chars(s, r[0]).colors, ['W']);
});
test('Druid of the Spade: +2/+0 and trample only while you control a token', () => {
  let s = setup({ me: { hand: ['hop-to-it'], bf: ['druid-of-the-spade', ...lands(3, P)] } });
  const d = find(s, 'druid-of-the-spade');
  eq(pt(s, d), [2, 3]); ok(!has(s, d, 'trample'), 'no trample');
  s = cast(s, 'hop-to-it'); s = resolveAll(s);
  eq(pt(s, d), [4, 3]); ok(has(s, d, 'trample'), 'trample');
});
test('Treeguard Duo: target creature you control gains vigilance and gets +X/+X, X = creatures you control', () => {
  let s = setup({ me: { hand: ['treeguard-duo'], bf: ['warren-elder', 'druid-of-the-spade', ...lands(4, F)] } });
  const e = find(s, 'warren-elder');
  s = cast(s, 'treeguard-duo'); s = resolveAll(s, tgt(e));
  eq(pt(s, e), [5, 5], 'three creatures'); ok(has(s, e, 'vigilance'), 'vigilance');
});
test('Rabid Bite: your creature deals damage equal to its power to a creature you don’t control', () => {
  let s = setup({ me: { hand: ['rabid-bite'], bf: ['treeguard-duo', ...lands(2, F)] }, opp: { bf: ['thieving-otter'] } });
  s = cast(s, 'rabid-bite', tgt(find(s, 'treeguard-duo')), tgt(find(s, 'thieving-otter')));
  s = resolveAll(s);
  ok(s.players[1].grave.some(i => s.cards[i].id === 'thieving-otter'), 'Otter died to 3 damage');
  eq(s.cards[find(s, 'treeguard-duo')].dmg, 0, 'one-way: no damage back');
});
test('Giant Growth: +3/+3 until end of turn', () => {
  let s = setup({ me: { hand: ['giant-growth'], bf: ['warren-elder', F] } });
  s = cast(s, 'giant-growth', tgt(find(s, 'warren-elder'))); s = resolveAll(s);
  eq(pt(s, find(s, 'warren-elder')), [5, 5]);
});
test('Clifftop Lookout: reveal until a land, put it onto the battlefield tapped, the rest on the bottom', () => {
  let s = setup({ me: { hand: ['clifftop-lookout'], bf: [...lands(3, F)], lib: ['giant-growth', 'hop-to-it', 'plains', 'forest'] } });
  s = cast(s, 'clifftop-lookout'); s = resolveAll(s);
  const pl = s.bf.find(i => s.cards[i].id === 'plains');
  ok(pl != null && s.cards[pl].tapped, 'Plains entered tapped');
  const lib = s.players[0].lib.map(i => s.cards[i].id);
  eq(lib[0], 'forest', 'the next card is untouched'); eq(lib.slice(1).sort(), ['giant-growth', 'hop-to-it'], 'the two revealed nonlands are at the bottom');
});
test('Burrowguard Mentor: power and toughness equal the number of creatures you control', () => {
  let s = setup({ me: { hand: ['hop-to-it'], bf: ['burrowguard-mentor', 'warren-elder', ...lands(3, P)] } });
  eq(pt(s, find(s, 'burrowguard-mentor')), [2, 2]);
  s = cast(s, 'hop-to-it'); s = resolveAll(s);
  eq(pt(s, find(s, 'burrowguard-mentor')), [5, 5]);
});
test('Blossoming Sands: enters tapped, gain 1, taps for {G} or {W} (a choice)', () => {
  let s = setup({ me: { hand: ['blossoming-sands', 'giant-growth'], bf: [] } });
  s = play(s, 'blossoming-sands'); s = resolveAll(s);
  const b = find(s, 'blossoming-sands', 'bf');
  ok(s.cards[b].tapped, 'entered tapped'); eq(s.players[0].life, 21);
});
