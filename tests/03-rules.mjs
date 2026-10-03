// Rules the engine keeps, each named for its CR section.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';

test('CR 608.2b: a spell whose only target became illegal does nothing (and the log says so)', () => {
  let s = setup({ me: { hand: ['giant-growth'], bf: ['warren-elder', 'forest'] } });
  const e = find(s, 'warren-elder');
  s = cast(s, 'giant-growth', tgt(e));
  s = MF.clone(s); MF.move(s, e, 'grave'); s = MF.run(s);                                        // the target leaves before the spell resolves
  s = resolveAll(s);
  eq(logs(s, 'fizzle').length, 1, 'fizzle logged');
  ok(s.players[0].grave.some(i => s.cards[i].id === 'giant-growth'), 'the spell went to the graveyard');
});
test('CR 400.7: an object that changes zones is a new object — an old target does not follow it', () => {
  let s = setup({ me: { hand: ['giant-growth'], bf: ['warren-elder', 'forest'] } });
  const e = find(s, 'warren-elder');
  s = cast(s, 'giant-growth', tgt(e));
  s = MF.clone(s); const n1 = MF.move(s, e, 'hand'); const n2 = MF.move(s, n1, 'bf'); s = MF.run(s);
  ok(n2 !== e, 'a new iid');
  s = resolveAll(s);
  eq(pt(s, n2), [2, 2], 'the returned Elder is not pumped');
});
test('CR 704.5g: lethal damage destroys; damage wears off at cleanup (CR 514.2)', () => {
  let s = setup({ me: { hand: ['flame-lash'], bf: ['mountain', 'mountain', 'mountain', 'mountain'] }, opp: { bf: ['fecund-greenshell'] } });
  const g = find(s, 'fecund-greenshell');
  s = cast(s, 'flame-lash', tgt(g)); s = resolveAll(s);
  eq(s.cards[g].dmg, 4, 'survives 4 damage on a 4/6');
  s = toStep(s, 'upkeep', 'done');
  eq(s.cards[g].dmg, 0, 'damage removed');
});
test('CR 702.7b, 510.4: first strike deals damage in its own step, before regular damage', () => {
  let s = setup({ me: { bf: [{ id: 'thieving-otter' }, { id: 'sword-of-vengeance', att: 0 }] }, opp: { bf: ['alanias-pathmaker'] } });
  const o = find(s, 'thieving-otter'), pm = find(s, 'alanias-pathmaker');
  s = toStep(s, 'attackers'); s = answer(s, [o, 'done']);
  s = toStep(s, 'blockers', (q) => q.opts.find(x => x.iid === pm).id, 'done');
  s = toStep(s, 'fsdamage');
  eq(s.pending && s.pending.q.kind, 'assign', 'trample (from the Sword): the split is asked');
  s = answer(s, [q => q.opts[q.opts.length - 1].id]);                                          // lethal (2) to the blocker, 2 to the player
  eq(s.players[1].life, 18, 'two trampled over');
  ok(s.players[1].grave.some(i => s.cards[i].id === 'alanias-pathmaker'), 'the 4/2 blocker died to first-strike damage');
  s = toStep(s, 'main2');
  eq(s.cards[o].zone, 'bf', 'the Otter survived: its blocker never dealt regular damage');
});
test('CR 704.5j: the legend rule — the controller chooses which to keep', () => {
  let s = setup({ me: { hand: ['finneas-ace-archer'], bf: ['finneas-ace-archer', 'forest', 'plains'] } });
  const old = find(s, 'finneas-ace-archer', 'bf');
  s = cast(s, 'finneas-ace-archer'); s = resolveAll(s, old);
  eq(findAll(s, 'finneas-ace-archer', 'bf').length, 1); ok(s.cards[old].zone === 'bf', 'kept the chosen one');
});
test('CR 302.6: a creature without haste cannot attack the turn it comes under your control', () => {
  let s = setup({ me: { hand: ['thieving-otter'], bf: ['island', 'island', 'island'] } });
  s = cast(s, 'thieving-otter'); s = resolveAll(s);
  const o = find(s, 'thieving-otter', 'bf');
  ok(!MF.canAttack(s, o), 'summoning sick');
});
test('CR 103.5: London mulligan — draw seven, put one on the bottom per mulligan', () => {
  const ids = Object.values(MF.decks).filter(d => d.registered).map(d => d.id);
  let s = MF.newGame({ seed: 9, decks: ids });
  s = MF.apply(s, { type: 'answer', id: 'me' });
  const first = s.pending.q.who;
  s = MF.apply(s, { type: 'answer', id: 'mull' });
  s = MF.apply(s, { type: 'answer', id: 'keep' });                                             // the other player keeps
  eq(s.pending.q.kind, 'mulligan'); eq(s.players[first].hand.length, 7);
  s = MF.apply(s, { type: 'answer', id: 'keep' });
  eq(s.pending.q.kind, 'bottom');
  const b = s.pending.q.opts[0].id;
  s = MF.apply(s, { type: 'answer', id: b });
  eq(s.players[first].hand.length, 6); eq(s.players[first].lib[s.players[first].lib.length - 1], s.cards[b].to, 'on the bottom');
});
test('CR 514.1: discard to seven at cleanup, the player choosing', () => {
  let s = setup({ me: { hand: Array(9).fill('plains'), bf: [] } });
  s = toStep(s, 'cleanup');
  eq(s.pending.q.kind, 'discardHand');
  s = answer(s, [q => q.opts[0].id, q => q.opts[0].id]);
  eq(s.players[0].hand.length, 7);
});
test('CR 103.8a: the player who goes first skips their first draw', () => {
  const ids = Object.values(MF.decks).filter(d => d.registered).map(d => d.id);
  let s = MF.newGame({ seed: 3, decks: ids });
  s = MF.apply(s, { type: 'answer', id: 'me' });
  while (s.pending) s = MF.apply(s, { type: 'answer', id: 'keep' });
  const first = s.ap;
  while (s.step !== 'main1') s = MF.apply(s, { type: 'pass' });
  eq(s.players[first].hand.length, 7, 'no draw on turn 1');
});
test('Cost door (PLAN D8): the solver finds a payment through two-colour lands; identical basics are one option', () => {
  let s = setup({ me: { hand: ['rabid-gnaw'], bf: ['swiftwater-cliffs', 'island', 'island', 'island'] }, opp: { bf: ['warren-elder'] } });
  ok(MF.canCast(s, 0, find(s, 'rabid-gnaw')) === false, 'no target of mine: cannot cast');
  let t = setup({ me: { hand: ['flame-lash'], bf: ['swiftwater-cliffs', 'island', 'island', 'island'] } });
  ok(MF.canCast(t, 0, find(t, 'flame-lash')), '{3}{R} payable only by tapping the Cliffs for red');
  t = MF.apply(t, MF.legalActions(t).find(a => a.type === 'cast'));
  t = MF.apply(t, { type: 'answer', id: player(1) });
  eq(t.pending.q.kind, 'pay');
  const islands = t.pending.q.opts.filter(o => o.iid != null && t.cards[o.iid].id === 'island');
  eq(islands.length, 1, 'three identical Islands are one option');
  const auto = t.pending.q.opts.find(o => o.id === 'auto');
  ok(auto.taps.some(x => t.cards[x.iid].id === 'swiftwater-cliffs' && x.col === 'R'), 'the proposal taps the Cliffs for red');
});
test('CR 603.3b: two of your triggers at once — you choose the order', () => {
  let s = setup({ me: { hand: ['flame-lash'], bf: ['stormcatch-mentor', 'coruscation-mage', 'mountain', 'mountain', 'mountain'] } });
  s = cast(s, 'flame-lash', player(1));
  eq(s.pending && s.pending.q.kind, 'trigOrder', 'asked to order prowess and the Mage’s ping');
});
