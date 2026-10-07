// Izzet Prowess (Pro Tour Final Fantasy, #2 — Ian Robb): one behaviour test per new card or rule.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const U = 'island', R = 'mountain';
const lands = (n, id) => Array(n).fill(id);

test('Stormchaser’s Talent: an Otter on entering; Level 2 returns an instant or sorcery card; Level 3 makes Otters (CR 716.2a)', () => {
  let s = setup({ me: { hand: ['stormchasers-talent', 'opt'], bf: lands(13, U), grave: ['lightning-strike', 'forest'] } });
  s = cast(s, 'stormchasers-talent'); s = resolveAll(s);
  const otter = findAll(s, 'token-otter-1-1-ur-prowess', 'bf'); eq(otter.length, 1); ok(has(s, otter[0], 'prowess'), 'prowess');
  const tal = find(s, 'stormchasers-talent', 'bf');
  ok(!MF.legalActions(s).some(a => a.type === 'act' && a.iid === tal && MF.chars(s, tal).ab[a.ab].levelUp === 3), 'Level 3 is not offered at level 1');
  s = activate(s, 'stormchasers-talent', MF.chars(s, tal).ab.findIndex(a => a.levelUp === 2)); s = resolveAll(s, q => q.opts.find(o => o.iid != null && MF.view(s).cards[o.iid].id === 'lightning-strike').id);
  eq(s.cards[tal].level, 2); ok(s.players[0].hand.some(i => s.cards[i].id === 'lightning-strike'), 'Lightning Strike returned');
  s = activate(s, 'stormchasers-talent', MF.chars(s, tal).ab.findIndex(a => a.levelUp === 3)); s = resolveAll(s);
  s = cast(s, 'opt', 'auto', 0); s = resolveAll(s, 'top');
  eq(findAll(s, 'token-otter-1-1-ur-prowess', 'bf').length, 2, 'casting Opt at level 3 made an Otter');
});
test('Torch the Tower: 2 damage; bargained (a token sacrificed), 3 damage and scry 1; what it damaged is exiled if it would die', () => {
  let s = setup({ me: { hand: ['torch-the-tower'], bf: [R] }, opp: { bf: ['warren-elder'] } });
  s = cast(s, 'torch-the-tower', tgt(find(s, 'warren-elder'))); s = resolveAll(s);
  ok(s.players[1].exile.some(i => s.cards[i].id === 'warren-elder'), '2 damage kills the 2/2: exiled instead of dying'); eq(logs(s, 'exiledInstead').length, 1);
  let t = setup({ me: { hand: ['torch-the-tower'], bf: [R, 'token-rabbit-1-1-w'], lib: ['opt', U] }, opp: { bf: ['stormcatch-mentor'] } });
  t = cast(t, 'torch-the-tower', find(t, 'token-rabbit-1-1-w'), tgt(find(t, 'stormcatch-mentor'))); t = resolveAll(t, 'top');
  eq(logs(t, 'damageCreature')[0].n, 3, 'bargained: 3 damage'); eq(logs(t, 'scry').length, 1);
});
test('Vivi Ornitier: {0}: X mana in any mix of {U}/{R} (X = power), once a turn on my turn; noncreature spells grow it and ping', () => {
  let s = setup({ me: { hand: ['lightning-strike'], bf: [{ id: 'vivi-ornitier', ctr: { '+1/+1': 2 } }] } });
  ok(MF.legalActions(s).some(a => a.type === 'cast'), 'Vivi alone pays {1}{R}');
  s = cast(s, 'lightning-strike', player(1)); s = resolveAll(s);
  eq(s.players[1].life, 16, '1 from Vivi, 3 from the Strike'); eq(s.cards[find(s, 'vivi-ornitier')].ctr['+1/+1'], 3);
  eq(MF.manaSources(s, 0).length, 0, 'only once each turn');
  let t = setup({ me: { hand: ['lightning-strike'], bf: [{ id: 'vivi-ornitier', ctr: { '+1/+1': 2 } }] } });
  t = MF.apply(t, MF.legalActions(t).find(a => a.type === 'cast')); t = MF.apply(t, { type: 'answer', id: player(1) });
  t = MF.apply(t, { type: 'answer', id: t.pending.q.opts.find(o => String(o.id).startsWith('combo:')).id });
  eq(t.pending.q.kind, 'manaCombo'); eq(t.pending.q.opts.map(o => o.id), ['UU', 'UR', 'RR'], 'every combination is offered');
});
test('Wild Ride: harmonize from the graveyard (CR 702.180), tapping a creature to cut the generic cost; then it is exiled', () => {
  let s = setup({ me: { grave: ['wild-ride'], bf: ['quaketusk-boar', 'warren-elder', R, R] } });
  ok(MF.legalActions(s).some(a => a.type === 'cast' && a.via === 'harmonize'), 'castable from the graveyard');
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'cast' && a.via === 'harmonize'));
  s = answer(s, [find(s, 'quaketusk-boar'), tgt(find(s, 'warren-elder'))]); s = resolveAll(s);
  ok(s.cards[find(s, 'quaketusk-boar')].tapped, 'the Boar was tapped'); ok(s.players[0].exile.some(i => s.cards[i].id === 'wild-ride'), 'exiled');
  eq(pt(s, find(s, 'warren-elder')), [5, 2]);
});
test('Into the Flood Maw: a creature to hand; with the gift, a tapped Fish for them and any nonland permanent instead (CR 702.174m)', () => {
  let s = setup({ me: { hand: ['into-the-flood-maw'], bf: [U] }, opp: { bf: ['warren-elder', 'sword-of-vengeance'] } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'cast')); s = answer(s, ['no']);
  ok(!s.pending.q.opts.some(o => o.id === tgt(find(s, 'sword-of-vengeance'))), 'no gift: creatures only');
  let t = setup({ me: { hand: ['into-the-flood-maw'], bf: [U] }, opp: { bf: ['warren-elder', 'sword-of-vengeance'] } });
  t = cast(t, 'into-the-flood-maw', 'yes', tgt(find(t, 'sword-of-vengeance'))); t = resolveAll(t);
  ok(t.players[1].hand.some(i => t.cards[i].id === 'sword-of-vengeance'), 'the Sword returned'); const fish = findAll(t, 'token-fish-1-1-u', 'bf', 1); eq(fish.length, 1); ok(t.cards[fish[0]].tapped, 'tapped Fish');
});
test('Spell Pierce: counter a noncreature spell unless its controller pays {2} — they are asked (CR 118.12a)', () => {
  const run = ans => {
    let s = setup({ me: { hand: ['lightning-strike'], bf: [R, R, R, R] }, opp: { hand: ['spell-pierce'], bf: [U] } });
    s = cast(s, 'lightning-strike', player(1)); s = MF.apply(s, { type: 'pass' });
    s = cast(s, 'spell-pierce', tgt(s.stack[0].iid)); s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
    s = answer(s, [ans]); return resolveAll(s);
  };
  let s = run('decline'); eq(s.players[1].life, 20); eq(logs(s, 'countered').length, 1);
  s = run('pay'); eq(s.players[1].life, 17, 'paid: the Strike resolves');
});
test('Cori-Steel Cutter: the second spell each turn makes a Monk with prowess, and the Cutter may be attached to it', () => {
  let s = setup({ me: { hand: ['opt', 'opt'], bf: ['cori-steel-cutter', U, U], lib: lands(5, U) } });
  s = cast(s, 'opt'); s = resolveAll(s, 'top');
  s = cast(s, 'opt'); s = resolveAll(s, 'yes', 'top');
  const monk = find(s, 'token-monk-1-1-w-prowess', 'bf'); eq(s.cards[find(s, 'cori-steel-cutter')].att, monk);
  ok(has(s, monk, 'trample') && has(s, monk, 'haste'), 'equipped: trample and haste');
});
test('Stock Up: two of the top five to hand, the rest to the bottom in an order I choose', () => {
  let s = setup({ me: { hand: ['stock-up'], bf: [U, U, U], lib: ['opt', 'lightning-strike', 'forest', U, R, 'plains'] } });
  s = cast(s, 'stock-up'); s = resolveAll(s, q => q.opts.find(o => MF.view(s).cards[o.iid].id === 'opt').id, q => q.opts.find(o => MF.view(s).cards[o.iid].id === 'lightning-strike').id, q => q.opts[0].id, q => q.opts[0].id);
  eq(s.players[0].hand.map(i => s.cards[i].id).sort(), ['lightning-strike', 'opt']); eq(s.cards[s.players[0].lib[0]].id, 'plains');
});
test('Sleight of Hand: one of the top two to hand, the other to the bottom', () => {
  let s = setup({ me: { hand: ['sleight-of-hand'], bf: [U], lib: ['opt', 'forest', 'plains'] } });
  s = cast(s, 'sleight-of-hand'); s = resolveAll(s, q => q.opts.find(o => MF.view(s).cards[o.iid].id === 'forest').id);
  ok(s.players[0].hand.some(i => s.cards[i].id === 'forest'), 'Forest'); eq(s.cards[s.players[0].lib[s.players[0].lib.length - 1]].id, 'opt');
});
test('Drake Hatcher: combat damage puts that many incubation counters on it; remove three for a 2/2 flying Drake', () => {
  let s = setup({ me: { bf: [{ id: 'drake-hatcher', ctr: { incubation: 2 } }] } });
  const d = find(s, 'drake-hatcher');
  ok(!MF.legalActions(s).some(a => a.type === 'act'), 'two counters are not enough');
  s = toStep(s, 'attackers'); s = answer(s, [d, 'done']); s = toStep(s, 'eoc');
  eq(s.cards[d].ctr.incubation, 3);
  s = activate(s, 'drake-hatcher'); s = resolveAll(s);
  const k = find(s, 'token-drake-2-2-u-flying', 'bf'); ok(has(s, k, 'flying'), 'flying Drake'); eq(s.cards[d].ctr.incubation, 0);
});
