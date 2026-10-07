// Golgari Graveyard (Jody Keith), Pro Tour Final Fantasy.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const B = 'swamp', G = 'forest';

test('Huskburster Swarm: {1} less for each creature card I own in exile and in my graveyard (CR 601.2f)', () => {
  let s = setup({ me: { hand: ['huskburster-swarm'], grave: ['town-greeter', 'gnawing-vermin', B] } });
  s = MF.clone(s); const ex = s.nid++; s.cards[ex] = { iid: ex, id: 'rubblebelt-maverick', owner: 0, ctrl: 0, zone: 'exile', ts: s.ts++, tapped: false, dmg: 0, dt: false, ctr: {}, att: null, ctlTurn: 0, tok: false }; s.players[0].exile.push(ex); s = MF.run(s);
  eq(MF.costOf(s, 0, find(s, 'huskburster-swarm')).g, 4, '{7} less three');
});
test('Diamond Weapon: costs less per permanent card in my graveyard; combat damage to it is prevented (CR 615)', () => {
  let s = setup({ me: { bf: ['diamond-weapon'], grave: [B, 'town-greeter', 'overwhelming-remorse'] }, opp: { bf: ['qarsi-revenant'] } });
  const dw = find(s, 'diamond-weapon');
  eq(pt(s, dw), [8, 8]); ok(has(s, dw, 'reach'), 'reach');
  s = MF.clone(s); s.ap = 1; s.priority = 1; s.cards[find(s, 'qarsi-revenant')].ctlTurn = 0; s = MF.run(s);
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'qarsi-revenant'), 'done']);
  s = toStep(s, 'blockers'); s = answer(s, [dw + '>' + find(s, 'qarsi-revenant'), 'done']);
  s = toStep(s, 'main2');
  ok(find(s, 'diamond-weapon', 'bf'), 'deathtouch damage was prevented, so it survives'); eq(logs(s, 'prevented').length, 1);
  let t = setup({ me: { hand: ['diamond-weapon'], grave: [B, 'town-greeter', 'overwhelming-remorse'] } });
  eq(MF.costOf(t, 0, find(t, 'diamond-weapon')).g, 5, 'Land and creature count; an instant doesn’t');
});
test('Qarsi Revenant: renew from the graveyard (CR 113.6m) — flying, deathtouch and lifelink counters (CR 122.1b)', () => {
  let s = setup({ me: { bf: ['town-greeter', B, B, B], grave: ['qarsi-revenant'] } });
  const tg = find(s, 'town-greeter');
  s = activate(s, 'qarsi-revenant', null, tgt(tg)); s = resolveAll(s);
  ok(has(s, tg, 'flying') && has(s, tg, 'deathtouch') && has(s, tg, 'lifelink'), 'all three'); ok(find(s, 'qarsi-revenant', 'exile'), 'exiled as the cost');
});
test('Up the Beanstalk: draws on entering and whenever I cast a spell with mana value 5 or greater', () => {
  let s = setup({ me: { hand: ['up-the-beanstalk', 'harvester-of-misery'], bf: [G, G, B, B, B, B, B], lib: [B, B, B] } });
  s = cast(s, 'up-the-beanstalk'); s = resolveAll(s); eq(s.players[0].hand.length, 2);
  s = cast(s, 'harvester-of-misery'); s = resolveAll(s); eq(s.players[0].hand.length, 2, 'drew for a five-drop');
});
test('Hollow Marauder: the opponent discards; if not mana value 4 or more, I draw', () => {
  let s = setup({ me: { hand: ['hollow-marauder'], bf: [B, B, B, B, B, B, B], lib: [B, B] }, opp: { hand: ['lightning-strike', 'huskburster-swarm'] } });
  s = cast(s, 'hollow-marauder'); s = resolveAll(s, player(1), q => q.opts.find(o => s.cards[o.iid] && s.cards[o.iid].id === 'lightning-strike').id);
  eq(s.players[0].hand.length, 1, 'they discarded a two-drop: I drew');
  let t = setup({ me: { hand: ['hollow-marauder'], bf: [B, B, B, B, B, B, B], lib: [B, B] }, opp: { hand: ['huskburster-swarm'] } });
  t = cast(t, 'hollow-marauder'); t = resolveAll(t, player(1), q => q.opts[0].id);
  eq(t.players[0].hand.length, 0, 'mana value 8: no draw');
});
test('Town Greeter: mill four; may take a land from among them', () => {
  let s = setup({ me: { hand: ['town-greeter'], bf: [G, G], lib: ['gnawing-vermin', B, 'seed-of-hope', G, B] } });
  s = cast(s, 'town-greeter'); s = resolveAll(s, q => q.opts.find(o => o.iid != null).id);
  eq(s.players[0].hand.map(i => s.cards[i].id), ['swamp']); eq(s.players[0].grave.length, 3);
});
test('Harvester of Misery: other creatures get -2/-2; discard it from hand for -2/-2 on a target', () => {
  let s = setup({ me: { hand: ['harvester-of-misery'], bf: [B, B, B, B, B, 'town-greeter'] }, opp: { bf: ['huskburster-swarm'] } });
  s = cast(s, 'harvester-of-misery'); s = resolveAll(s);
  ok(find(s, 'town-greeter', 'grave'), 'my 1/1 died'); eq(pt(s, find(s, 'huskburster-swarm')), [4, 4]); eq(pt(s, find(s, 'harvester-of-misery')), [5, 4]);
  let t = setup({ me: { hand: ['harvester-of-misery'], bf: [B, B] }, opp: { bf: ['town-greeter'] } });
  t = activate(t, 'harvester-of-misery', null, tgt(find(t, 'town-greeter'))); t = resolveAll(t);
  ok(find(t, 'harvester-of-misery', 'grave'), 'discarded as the cost'); ok(find(t, 'town-greeter', 'grave'), 'killed');
});
test('Souls of the Lost: discard a card or sacrifice a permanent as it is cast; */*+1 from permanent cards in my graveyard (CR 604.3)', () => {
  let s = setup({ me: { hand: ['souls-of-the-lost', B], bf: [B, B, 'town-greeter'], grave: ['gnawing-vermin', 'overwhelming-remorse'] } });
  eq(pt(s, find(s, 'souls-of-the-lost')), [1, 2], 'in hand: one permanent card');
  s = cast(s, 'souls-of-the-lost', 'sac', find(s, 'town-greeter')); s = resolveAll(s);
  eq(pt(s, find(s, 'souls-of-the-lost')), [2, 3]);
});
test('Rubblebelt Maverick: surveil 2 on entering; {G}, exile it from the graveyard: a +1/+1 counter', () => {
  let s = setup({ me: { bf: [G, 'town-greeter'], grave: ['rubblebelt-maverick'] } });
  s = activate(s, 'rubblebelt-maverick', null, tgt(find(s, 'town-greeter'))); s = resolveAll(s);
  eq(pt(s, find(s, 'town-greeter')), [2, 2]);
});
test('Overwhelming Remorse: {1} less per creature card in my graveyard; exiles a creature', () => {
  let s = setup({ me: { hand: ['overwhelming-remorse'], bf: [B, B], grave: ['town-greeter', 'gnawing-vermin', 'souls-of-the-lost'] }, opp: { bf: ['huskburster-swarm'] } });
  eq(MF.costOf(s, 0, find(s, 'overwhelming-remorse')).g, 1);
  s = cast(s, 'overwhelming-remorse', tgt(find(s, 'huskburster-swarm'))); s = resolveAll(s);
  ok(find(s, 'huskburster-swarm', 'exile'), 'exiled');
});
test('Overlord of the Balemurk: impending (CR 702.176) — not a creature with time counters; one removed each end step; enters: mill four, return a non-Avatar creature', () => {
  let s = setup({ me: { hand: ['overlord-of-the-balemurk'], bf: [B, B], lib: ['town-greeter', B, B, B, B, B], grave: [] } });
  const a = MF.legalActions(s).find(l => l.type === 'cast' && l.via === 'impending'); ok(a, 'impending offered');
  s = answer(MF.apply(s, a), []); s = resolveAll(s, q => q.opts.find(o => o.iid != null) ? q.opts.find(o => o.iid != null).id : 'done');
  const o = find(s, 'overlord-of-the-balemurk');
  ok(!MF.chars(s, o).types.includes('Creature'), 'not a creature'); eq(s.cards[o].ctr.time, 5);
  ok(s.players[0].hand.some(i => s.cards[i].id === 'town-greeter'), 'returned Town Greeter');
  s = toStep(s, 'end'); s = resolveAll(s); eq(s.cards[o].ctr.time, 4, 'one removed at my end step');
  s = MF.clone(s); s.cards[o].ctr.time = 0; s = MF.run(s);
  ok(MF.chars(s, o).types.includes('Creature'), 'a 5/5 creature once the last is gone'); eq(pt(s, o), [5, 5]);
});
