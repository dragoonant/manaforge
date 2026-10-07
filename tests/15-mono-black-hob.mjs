// Mono-Black (Desolation Prowler), Arena top-ranked Standard after the Hobbit release.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const B = 'swamp', U = 'island';
const lands = (n, id) => Array(n).fill(id);

test('Realm of Koh: a Spirit token that can’t block and can’t be blocked by non-Spirits', () => {
  let s = setup({ me: { bf: ['realm-of-koh', B, B, B, B] }, opp: { bf: ['warren-elder'] } });
  s = activate(s, 'realm-of-koh', 2); s = resolveAll(s);
  const sp = find(s, 'token-spirit-1-1-c-this-token-can-t-block-or-be-blocked-by-non-spirit-creatures', 'bf');
  ok(MF.restricted(s, sp, 'block'), 'can’t block'); ok(!MF.canBlock(s, find(s, 'warren-elder'), sp), 'a non-Spirit can’t block it');
});
test('Nighthowl Pursuer: +2/+2 when it attacks while I control power 4 or more — checked as it triggers', () => {
  let s = setup({ me: { bf: ['nighthowl-pursuer', 'quaketusk-boar'] } });
  const n = find(s, 'nighthowl-pursuer');
  s = toStep(s, 'attackers'); s = answer(s, [n, 'done']); s = resolveAll(s);
  eq(pt(s, n), [3, 3]);
  let t = setup({ me: { bf: ['nighthowl-pursuer'] } });
  t = toStep(t, 'attackers'); t = answer(t, [find(t, 'nighthowl-pursuer'), 'done']); eq(t.stack.length, 0, 'no trigger');
});
test('Desolation Prowler: pay 2 life for +2/+2, only once each turn', () => {
  let s = setup({ me: { bf: ['desolation-prowler'] } });
  s = activate(s, 'desolation-prowler'); s = resolveAll(s);
  eq(pt(s, find(s, 'desolation-prowler')), [4, 4]); eq(s.players[0].life, 18);
  ok(!MF.legalActions(s).some(a => a.type === 'act'), 'once each turn');
});
test('Forsaken Miner: committing a crime (CR 700.13) — pay {B} to return it from the graveyard', () => {
  let s = setup({ me: { hand: ['dissection-practice'], bf: [B, B], grave: ['forsaken-miner'] } });
  s = cast(s, 'dissection-practice', player(1)); s = resolveAll(s, 'yes');
  ok(find(s, 'forsaken-miner', 'bf'), 'returned'); eq(logs(s, 'trigger').filter(e => e.c === 'forsaken-miner').length, 1);
});
test('Sunset Saboteur: ward—discard a card (the opponent is asked); attacking gives an opposing creature a +1/+1 counter', () => {
  let s = setup({ me: { bf: ['sunset-saboteur'] }, opp: { hand: ['lightning-strike', U], bf: ['mountain', 'mountain', 'warren-elder'] } });
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  s = cast(s, 'lightning-strike', tgt(find(s, 'sunset-saboteur'))); s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  eq(s.pending.q.kind, 'wardPay'); s = answer(s, ['pay', q => q.opts[0].id]); s = resolveAll(s);
  ok(s.players[0].grave.some(i => s.cards[i].id === 'sunset-saboteur'), 'they discarded, so the Strike resolved');
});
test('Corpses of the Lost: a 3/2 hasty Skeleton Pirate; at my end step, having descended, pay 1 life to return it to hand', () => {
  let s = setup({ me: { hand: ['corpses-of-the-lost'], bf: [B, B, B], lib: [B, B] } });
  s = cast(s, 'corpses-of-the-lost'); s = resolveAll(s);
  const sk = find(s, 'token-skeleton-pirate-2-2-b', 'bf'); eq(pt(s, sk), [3, 2]); ok(has(s, sk, 'haste'), 'haste');
  s = MF.clone(s); s.players[0].h.descended = true; s = MF.run(s);
  s = toStep(s, 'end', 'done'); s = resolveAll(s, 'yes');
  ok(s.players[0].hand.some(i => s.cards[i].id === 'corpses-of-the-lost'), 'back in hand'); eq(s.players[0].life, 19);
});
test('Gollum: choose odd or even as it enters (CR 614.12a); opponents’ spells of that quality give a mode not chosen before', () => {
  let s = setup({ me: { hand: ['gollum-riddle-master'], bf: [B, B], lib: ['opt', B, B] }, opp: { hand: ['opt', 'opt'], bf: [U, U], lib: [U, U, U] } });
  s = cast(s, 'gollum-riddle-master'); s = resolveAll(s, 'odd');
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  s = cast(s, 'opt'); s = answer(s, [2]); s = resolveAll(s, 'top');
  eq(s.players[0].hand.length, 1, 'drew');
  s = MF.clone(s); s.priority = 1; s.stack = []; s = MF.run(s);
  s = cast(s, 'opt'); eq(s.pending.q.opts.map(o => o.id), [0, 1], 'draw is used');
});
test('Dark Knight’s Greatsword: job select (CR 702.182a) — a Hero token wearing it, +3/+0 and a Knight; equip by paying 3 life', () => {
  let s = setup({ me: { hand: ['dark-knights-greatsword'], bf: [B, B, B, 'warren-elder'] } });
  s = cast(s, 'dark-knights-greatsword'); s = resolveAll(s);
  const h = find(s, 'token-hero-1-1-c', 'bf'); eq(pt(s, h), [4, 1]); ok(MF.chars(s, h).subtypes.includes('Knight'), 'a Knight');
  s = activate(s, 'dark-knights-greatsword', null, tgt(find(s, 'warren-elder'))); s = resolveAll(s);
  eq(pt(s, find(s, 'warren-elder')), [5, 2]); eq(s.players[0].life, 17);
});
test('Dissection Practice: target opponent loses 1, I gain 1, up to one creature +1/+1 and up to one -1/-1', () => {
  let s = setup({ me: { hand: ['dissection-practice'], bf: [B, 'warren-elder'] }, opp: { bf: ['heartfire-hero'] } });
  s = cast(s, 'dissection-practice', player(1), tgt(find(s, 'warren-elder')), tgt(find(s, 'heartfire-hero'))); s = resolveAll(s);
  eq(s.players[1].life, 19); eq(s.players[0].life, 21); eq(pt(s, find(s, 'warren-elder')), [3, 3]);
  ok(s.players[1].grave.some(i => s.cards[i].id === 'heartfire-hero'), 'the Hero died');
});
