// The championship decks' land cycles: one test per frame.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';

test('Fast land (Spirebluff Canal): untapped with two or fewer other lands, tapped with three', () => {
  let s = setup({ me: { hand: ['spirebluff-canal'], bf: ['island', 'mountain'] } });
  s = play(s, 'spirebluff-canal'); ok(!s.cards[find(s, 'spirebluff-canal', 'bf')].tapped, 'untapped');
  s = setup({ me: { hand: ['spirebluff-canal'], bf: ['island', 'mountain', 'island'] } });
  s = play(s, 'spirebluff-canal'); ok(s.cards[find(s, 'spirebluff-canal', 'bf')].tapped, 'tapped');
});
test('Shock land (Watery Grave): the player chooses — pay 2 life and enter untapped, or enter tapped (CR 614.12a)', () => {
  let s = setup({ me: { hand: ['watery-grave'] } });
  s = play(s, 'watery-grave'); eq(s.pending.q.kind, 'payLifeOrTap');
  s = answer(s, ['pay']); ok(!s.cards[find(s, 'watery-grave', 'bf')].tapped, 'untapped'); eq(s.players[0].life, 18);
  s = setup({ me: { hand: ['watery-grave'] } });
  s = play(s, 'watery-grave'); s = answer(s, ['tapped']); ok(s.cards[find(s, 'watery-grave', 'bf')].tapped, 'tapped'); eq(s.players[0].life, 20);
});
test('Surveil land (Thundering Falls): enters tapped; surveil 1 puts the card in the graveyard or keeps it on top (CR 701.25a)', () => {
  let s = setup({ me: { hand: ['thundering-falls'], lib: ['opt', 'island', 'island'] } });
  s = play(s, 'thundering-falls'); s = resolveAll(s, 'grave');
  ok(s.cards[find(s, 'thundering-falls', 'bf')].tapped, 'tapped'); ok(s.players[0].grave.some(i => s.cards[i].id === 'opt'), 'Opt milled');
});
test('Verge (Riverpyre Verge): {R} always; {U} only if you control an Island or a Mountain', () => {
  let s = setup({ me: { bf: ['riverpyre-verge'] } });
  eq(MF.manaSources(s, 0).map(m => m.cols.join('')), ['R'], 'red only');
  s = setup({ me: { bf: ['riverpyre-verge', 'mountain'] } });
  ok(MF.manaSources(s, 0).some(m => m.iid === find(s, 'riverpyre-verge') && m.cols.includes('U')), 'blue with a Mountain');
});
test('Pain land (Shivan Reef): {C} is free; {U} or {R} deals 1 damage to you', () => {
  let s = setup({ me: { hand: ['opt'], bf: ['shivan-reef'], lib: ['island', 'island'] } });
  s = cast(s, 'opt', q => q.opts.find(o => o.id.startsWith('tap:') && o.col === 'U').id); s = resolveAll(s, 'top');
  eq(s.players[0].life, 19);
});
test('Fabled Passage: sacrifice, search for a basic land, put it onto the battlefield tapped, untap it with four or more lands', () => {
  let s = setup({ me: { bf: ['fabled-passage', 'island', 'island', 'island', 'island'], lib: ['mountain', 'opt'] } });
  s = activate(s, 'fabled-passage'); s = resolveAll(s, q => q.opts.find(o => o.iid != null).id);
  const m = find(s, 'mountain', 'bf');
  ok(!s.cards[m].tapped, 'untapped: five lands'); ok(s.players[0].grave.some(i => s.cards[i].id === 'fabled-passage'), 'sacrificed');
});
test('Starting Town: untapped on your first three turns; {T}, pay 1 life: any color', () => {
  let s = setup({ me: { hand: ['starting-town'] } });
  s = play(s, 'starting-town'); ok(!s.cards[find(s, 'starting-town', 'bf')].tapped, 'early: untapped');
  ok(MF.manaSources(s, 0).some(m => m.cols.length === 5), 'any color');
});
test('CR 605.3a: a mana ability at priority — Shivan Reef asks the colour, the mana floats, the player keeps priority, then pays Opt', () => {
  let s = setup({ me: { hand: ['opt'], bf: ['shivan-reef'], lib: ['island', 'island'] } });
  const reef = find(s, 'shivan-reef');
  const a = MF.legalActions(s).find(l => l.type === 'mana' && l.iid === reef && MF.chars(s, reef).ab[l.ab].cols.length > 1);
  ok(a, 'the {U}/{R} ability is offered at priority');
  s = MF.apply(s, a); eq(s.pending.q.kind, 'manaColor'); eq(s.pending.q.opts.map(o => o.id), ['U', 'R']);
  s = MF.apply(s, { type: 'answer', id: 'U' });
  eq(s.players[0].pool.U, 1); eq(s.players[0].life, 19); eq(s.priority, 0); ok(s.cards[reef].tapped, 'tapped');
  s = cast(s, 'opt'); s = resolveAll(s, 'top');
  eq(s.players[0].pool.U, 0); ok(s.players[0].grave.some(i => s.cards[i].id === 'opt'), 'Opt paid from the pool and resolved');
});
test('CR 500.4: floated mana empties as the step ends, and the log says so', () => {
  let s = setup({ me: { bf: ['island'] } });
  s = MF.apply(s, MF.legalActions(s).find(l => l.type === 'mana'));
  eq(s.players[0].pool.U, 1);
  s = toStep(s, 'boc');
  eq(s.players[0].pool.U, 0); eq(logs(s, 'manaEmpties').length, 1);
});
