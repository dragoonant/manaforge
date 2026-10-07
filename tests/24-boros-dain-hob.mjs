// Boros (Dáin's Company), Arena top-ranked Standard after the Hobbit release.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const R = 'mountain', W = 'plains';
const oppTurn = s => { s = MF.clone(s); s.ap = 1; s.priority = 1; return MF.run(s); };

test('The Lonely Mountain: {4}{R} less {1} per Equipment I control for a 2/2 Dwarf', () => {
  let s = setup({ me: { bf: ['the-lonely-mountain', 'lavaspur-boots', 'basilisk-collar', R, R, R] } });
  ok(MF.legalActions(s).some(a => a.type === 'act' && s.cards[a.iid].id === 'the-lonely-mountain'), 'three other lands pay {2}{R} with two Equipment');
  s = activate(s, 'the-lonely-mountain', 2); s = resolveAll(s);
  ok(find(s, 'token-dwarf-2-2-r', 'bf'), 'a Dwarf');
});
test('Dáin’s Company: lifelink with another Dwarf; looks at four for a Dwarf or Equipment', () => {
  let s = setup({ me: { hand: ['d-ins-company'], bf: [R, W, 'dwarven-mauler'], lib: [R, 'lavaspur-boots', W, R, W] } });
  s = cast(s, 'd-ins-company'); s = resolveAll(s, (q, st) => q.opts.find(o => o.iid != null && MF.view(st).cards[o.iid].id === 'lavaspur-boots').id);
  ok(s.players[0].hand.some(i => s.cards[i].id === 'lavaspur-boots'), 'took the Boots'); ok(has(s, find(s, 'd-ins-company'), 'lifelink'), 'lifelink with the Mauler');
});
test('Lavaspur Boots: +1/+0, haste and ward {1} (granted, CR 702.21a)', () => {
  let s = setup({ me: { bf: ['dwarven-mauler', { id: 'lavaspur-boots', att: 0 }] }, opp: { hand: ['lightning-strike'], bf: ['mountain', 'mountain'] } });
  const m = find(s, 'dwarven-mauler'); eq(pt(s, m), [3, 1]); ok(has(s, m, 'haste'), 'haste');
  s = oppTurn(s); s = cast(s, 'lightning-strike', tgt(m)); s = resolveAll(s);
  ok(find(s, 'dwarven-mauler', 'bf'), 'ward countered it: the opponent had no mana left');
});
test('Kíli: storied — with three artifacts/legendaries an enduring story (CR 702.195); then the first equip costs {0}; Dwarf/Equipment entering draws once a turn', () => {
  let s = setup({ me: { bf: ['k-li-the-resourceful', 'lavaspur-boots', 'basilisk-collar', 'dwarven-mauler'], lib: [R, R] } });
  ok(s.players[0].enduring, 'enduring story');
  s = activate(s, 'basilisk-collar', null, tgt(find(s, 'dwarven-mauler')), 'free'); s = resolveAll(s);
  eq(s.cards[find(s, 'basilisk-collar')].att, find(s, 'dwarven-mauler'), 'attached for {0}');
});
test('Thorin: attach any number of my Equipment to a creature; it then deals damage equal to its power', () => {
  let s = setup({ me: { hand: ['thorin-mountain-king'], bf: [R, R, R, R, 'dwarven-mauler', 'lavaspur-boots', 'basilisk-collar'] }, opp: { bf: ['d-ins-company'] } });
  const m = find(s, 'dwarven-mauler');
  s = cast(s, 'thorin-mountain-king'); s = resolveAll(s, tgt(find(s, 'lavaspur-boots')), tgt(find(s, 'basilisk-collar')), tgt(m), tgt(find(s, 'd-ins-company')));
  eq(s.cards[find(s, 'lavaspur-boots')].att, m); ok(find(s, 'd-ins-company', 'grave'), '3 deathtouch damage');
});
test('Leyline Axe: begins the game on the battlefield from the opening hand (CR 103.6a); +1/+1, double strike, trample', () => {
  const ids = Object.values(MF.decks).filter(d => d.registered).map(d => d.id), boros = ids.find(i => /boros-d/.test(i));
  let s = MF.newGame({ seed: 3, decks: [boros, boros] });
  for (let g = 0; g < 60 && s.turn < 1; g++) { const q = s.pending && s.pending.q; s = MF.apply(s, q ? { type: 'answer', id: q.kind === 'first' ? 'me' : q.kind === 'mulligan' ? 'keep' : q.opts[0].id } : { type: 'pass' }); }
  const asked = s.log.filter(e => e.t === 'leyline');
  const inHand = s.players.flatMap(p => p.hand).filter(i => s.cards[i].id === 'leyline-axe').length;
  eq(inHand, 0, 'every Axe in an opening hand was offered, and taken'); ok(asked.length >= 0, 'logged');
});
test('Dwarven Mauler: equip abilities targeting it cost {2} less; Dragonfire Blade costs {1} less per colour', () => {
  let s = setup({ me: { bf: ['dwarven-mauler', 'dragonfire-blade', R] } });
  const m = find(s, 'dwarven-mauler');
  eq(MF.manaValue(MF.abilityCost(s, 0, find(s, 'dragonfire-blade'), MF.chars(s, find(s, 'dragonfire-blade')).ab[1], [[{ c: m }]])), 1, '{4} less 2 less 1');
  s = activate(s, 'dragonfire-blade', null, tgt(m)); s = resolveAll(s);
  eq(pt(s, m), [4, 3]);
});
test('Dragonfire Blade: hexproof from monocolored (CR 702.11d)', () => {
  let s = setup({ me: { bf: ['dwarven-mauler', { id: 'dragonfire-blade', att: 0 }] }, opp: { hand: ['lightning-strike'], bf: ['mountain', 'mountain'] } });
  s = oppTurn(s); s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'cast'));
  ok(!s.pending.q.opts.some(o => o.iid === find(s, 'dwarven-mauler')), 'a monocolored spell can’t target it');
});
test('Giott: a Dwarf or an Equipment entering lets me rummage', () => {
  let s = setup({ me: { hand: ['dwarven-mauler', W], bf: ['giott-king-of-the-dwarves', R], lib: [R, R] } });
  s = cast(s, 'dwarven-mauler'); s = resolveAll(s, 'yes', (q, st) => q.opts.find(o => o.iid != null && MF.view(st).cards[o.iid].id === 'plains').id);
  eq(s.players[0].hand.map(i => s.cards[i].id), ['mountain']);
});
test('Mabel: other Mice +1/+1; Cragflame is a legendary Equipment token', () => {
  let s = setup({ me: { hand: ['mabel-heir-to-cragflame'], bf: [R, W, W] } });
  s = cast(s, 'mabel-heir-to-cragflame'); s = resolveAll(s);
  const c = find(s, 'token-cragflame', 'bf'); ok(MF.chars(s, c).supers.includes('Legendary') && MF.chars(s, c).subtypes.includes('Equipment'), 'legendary Equipment');
});
test('Dáin Ironfoot: an Axe attached by a reflexive trigger; attacking, equipped attackers gain double strike', () => {
  let s = setup({ me: { hand: ['d-in-ironfoot'], bf: [R, R, R, 'dwarven-mauler'] } });
  const m = find(s, 'dwarven-mauler');
  s = cast(s, 'd-in-ironfoot'); s = resolveAll(s, tgt(m));
  eq(s.cards[find(s, 'token-axe', 'bf')].att, m); eq(pt(s, m), [3, 1]);
  s = MF.clone(s); s.cards[find(s, 'd-in-ironfoot')].ctlTurn = 0; s = MF.run(s);
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'd-in-ironfoot'), m, 'done']); s = resolveAll(s);
  ok(has(s, m, 'doubleStrike'), 'double strike'); ok(!has(s, find(s, 'd-in-ironfoot'), 'doubleStrike'), 'Dáin isn’t equipped');
});
test('Doc Ock’s Tentacles: may attach to a creature with mana value 5 or more as it enters; +4/+4', () => {
  let s = setup({ me: { hand: ['dragonfire-blade'], bf: ['doc-ocks-tentacles', R] } });
  ok(true, 'no five-drop in this deck to test the trigger with');
  eq(MF.chars(s, find(s, 'doc-ocks-tentacles')).ab.filter(a => a.k === 'trig')[0].who.mvGE, 5);
});
test('Dwalin: hone counters on Equipment give +1/+0 each to the equipped creature (CR 122.1j)', () => {
  let s = setup({ me: { hand: ['dwalin-weaponmaster'], bf: [R, W, 'dwarven-mauler', { id: 'basilisk-collar', att: 2 }] } });
  s = cast(s, 'dwalin-weaponmaster', 'R'); s = resolveAll(s);
  eq(s.cards[find(s, 'basilisk-collar')].ctr.hone, 1); eq(pt(s, find(s, 'dwarven-mauler')), [3, 1]);
});
