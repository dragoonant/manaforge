// Sultai (Ardyn, the Usurper), Arena top-ranked Standard after the Hobbit release.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const U = 'island', B = 'swamp', G = 'forest';
const oppTurn = s => { s = MF.clone(s); s.ap = 1; s.priority = 1; return MF.run(s); };

test('Superior Spider-Man: enters as a copy of a creature card in a graveyard, named Superior Spider-Man and a 4/4 Spider Human Hero too; then that card is exiled', () => {
  let s = setup({ me: { hand: ['superior-spider-man'], bf: [U, U, B, B] }, opp: { grave: ['terror-of-the-peaks'] } });
  const card = find(s, 'terror-of-the-peaks', 'grave');
  s = cast(s, 'superior-spider-man'); s = resolveAll(s, card);
  const sm = find(s, 'superior-spider-man', 'bf'), ch = MF.chars(s, sm);
  eq(ch.name, 'Superior Spider-Man'); eq(pt(s, sm), [4, 4]); ok(has(s, sm, 'flying'), 'Terror’s flying');
  ok(['Dragon', 'Spider', 'Human', 'Hero'].every(t => ch.subtypes.includes(t)), 'all four types'); ok(find(s, 'terror-of-the-peaks', 'exile'), 'the card exiled');
});
test('Bringer of the Last Gift: if cast — everyone sacrifices their other creatures, then returns the creature cards that were already in graveyards', () => {
  let s = setup({ me: { hand: ['bringer-of-the-last-gift'], bf: [B, B, B, B, B, B, B, B, 'oblivious-bookworm'], grave: ['kiora-the-rising-tide'] }, opp: { bf: ['formidable-speaker'], grave: ['terror-of-the-peaks'] } });
  s = cast(s, 'bringer-of-the-last-gift'); s = resolveAll(s, q => q.opts[0].id, q => q.opts[0].id, q => q.opts[0].id, q => q.opts[0].id, q => q.opts[0].id);   // Kiora returns: her loot, and Terror's trigger
  ok(find(s, 'kiora-the-rising-tide', 'bf', 0) && find(s, 'terror-of-the-peaks', 'bf', 1), 'returned'); ok(find(s, 'oblivious-bookworm', 'grave') && find(s, 'formidable-speaker', 'grave'), 'the sacrificed stay');
  ok(find(s, 'bringer-of-the-last-gift', 'bf'), 'Bringer stays');
});
test('Formidable Speaker: may discard to search for a creature card, revealed; {1},{T}: untap another permanent', () => {
  let s = setup({ me: { hand: ['formidable-speaker', U], bf: [G, G, G], lib: [B, 'kiora-the-rising-tide', B] } });
  s = cast(s, 'formidable-speaker'); s = resolveAll(s, q => q.opts.find(o => o.iid != null).id, q => q.opts.find(o => o.iid != null).id);
  eq(s.players[0].hand.map(i => s.cards[i].id), ['kiora-the-rising-tide']); ok(logs(s, 'reveal').length === 1, 'revealed');
});
test('Oblivious Bookworm: at my end step, may draw; then discard (nothing turns face down in this engine)', () => {
  let s = setup({ me: { bf: ['oblivious-bookworm'], hand: [B], lib: [U, U] } });
  s = toStep(s, 'end', 'done'); s = resolveAll(s, 'yes', q => q.opts.find(o => o.iid != null).id);
  eq(s.players[0].hand.length, 1); eq(s.players[0].grave.length, 1);
});
test('Jadzi: enters prepared (CR 722.3); the copy of Oracle’s Gift is cast from exile and unprepares her', () => {
  let s = setup({ me: { hand: ['jadzi-steward-of-fate-oracles-gift'], bf: [U, U, U, U, U, U], lib: [U, U, B, B] } });
  s = cast(s, 'jadzi-steward-of-fate-oracles-gift'); s = resolveAll(s, q => q.opts.find(o => o.iid != null).id, q => q.opts.find(o => o.iid != null).id);
  const j = find(s, 'jadzi-steward-of-fate-oracles-gift', 'bf'); ok(s.cards[j].prepared, 'prepared');
  const a = MF.legalActions(s).find(l => l.type === 'cast' && s.cards[l.iid].prepCopy); ok(a, 'the copy can be cast');
  s = answer(MF.apply(s, a), [1]); s = resolveAll(s);
  eq(findAll(s, 'token-fractal-0-0-gu', 'bf').length, 1); eq(pt(s, findAll(s, 'token-fractal-0-0-gu', 'bf')[0]), [1, 1]);
  ok(!s.cards[j].prepared, 'unprepared'); ok(!MF.legalActions(s).some(l => l.type === 'cast' && s.cards[l.iid].prepCopy), 'no second copy');
});
test('Kiora: draw two, discard two; threshold — attacking with seven cards in my graveyard, may create Scion of the Deep', () => {
  let s = setup({ me: { bf: [{ id: 'kiora-the-rising-tide' }], grave: [U, U, U, U, U, U, U] } });
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'kiora-the-rising-tide'), 'done']); s = resolveAll(s, 'yes');
  const sc = find(s, 'token-scion-of-the-deep', 'bf'); eq(pt(s, sc), [8, 8]); ok(MF.chars(s, sc).supers.includes('Legendary'), 'legendary');
});
test('Terror of the Peaks: a creature entering deals its power; opponents pay 3 life more to target it', () => {
  let s = setup({ me: { hand: ['kiora-the-rising-tide'], bf: ['terror-of-the-peaks', U, U, U], lib: [U, U, U] }, opp: { hand: ['lightning-strike'], bf: ['mountain', 'mountain'] } });
  s = cast(s, 'kiora-the-rising-tide'); s = resolveAll(s, q => q.opts.find(o => o.iid != null) ? q.opts.find(o => o.iid != null).id : q.opts[0].id, player(1), q => q.opts.find(o => o.iid != null).id, q => q.opts.find(o => o.iid != null).id);
  eq(s.players[1].life, 17, 'Kiora’s 3 power');
  s = oppTurn(s); s = cast(s, 'lightning-strike', tgt(find(s, 'terror-of-the-peaks')));
  eq(s.players[1].life, 14, '3 life paid to target it');
});
test('Wistfulness: evoke (CR 702.74a) — sacrificed when it enters; {U}{U} spent draws two then discards', () => {
  let s = setup({ me: { hand: ['wistfulness', B], bf: [U, U], lib: [B, B, B] } });
  const a = MF.legalActions(s).find(l => l.type === 'cast' && l.via === 'evoke'); ok(a, 'evoke offered');
  s = answer(MF.apply(s, a), ['U', 'U']); s = resolveAll(s, q => q.opts[0].id, q => q.opts.find(o => o.iid != null).id);
  ok(find(s, 'wistfulness', 'grave'), 'sacrificed'); eq(s.players[0].hand.length, 2, 'drew two, discarded one');
});
test('Ardyn: Demons have menace, lifelink, haste; at my combat, a creature card from a graveyard becomes a 5/5 black Demon token copy', () => {
  let s = setup({ me: { bf: ['ardyn-the-usurper'] }, opp: { grave: ['formidable-speaker'] } });
  s = toStep(s, 'boc'); s = resolveAll(s, tgt(find(s, 'formidable-speaker')));
  const tk = s.bf.find(i => s.cards[i].tok); eq(pt(s, tk), [5, 5]); eq(MF.chars(s, tk).subtypes, ['Demon']); eq(MF.chars(s, tk).colors, ['B']);
  ok(has(s, tk, 'menace') && has(s, tk, 'lifelink') && has(s, tk, 'haste'), 'a Demon: Ardyn’s grant');
});
