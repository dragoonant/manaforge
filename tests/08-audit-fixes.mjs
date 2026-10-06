// The per-card audit of 2026-10-06: one test per defect found and fixed.
import { MF, test, eq, ok, setup, find, findAll, pt, logs, cast, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const lands = (n, id) => Array(n).fill(id || 'island');

test('A land with two mana abilities makes one mana (CR 106.1): a lone Caves of Koilos cannot pay {1}{B}', () => {
  let s = setup({ me: { hand: ['go-for-the-throat'], bf: ['caves-of-koilos'] }, opp: { bf: ['warren-elder'] } });
  ok(!MF.legalActions(s).some(a => a.type === 'cast'), 'Go for the Throat is not offered');
  eq(MF.manaAvailable(s, 0), 1);
});
test('The solver finds the payment a two-ability land allows: Verge for {W}, Swamp for {B} (Pest Control)', () => {
  let s = setup({ me: { hand: ['pest-control'], bf: ['bleachbone-verge', 'swamp'] } });
  s = cast(s, 'pest-control'); s = resolveAll(s);
  eq(logs(s, 'undone').length, 0); ok(s.players[0].grave.some(i => s.cards[i].id === 'pest-control'), 'it resolved');
});
test('Mind Spring with Stormcatch Mentor: X counts the cost reduction (CR 601.2f) — five Islands allow X = 4', () => {
  let s = setup({ me: { hand: ['mind-spring'], bf: ['stormcatch-mentor', ...lands(5)] } });
  s = MF.apply(s, MF.legalActions(s).find(l => l.type === 'cast'));
  eq(Math.max(...s.pending.q.opts.map(o => o.id)), 4);
});
test('Fecund Greenshell: a land not put onto the battlefield goes into the hand (its ruling)', () => {
  let s = setup({ me: { hand: ['fecund-greenshell'], bf: lands(5, 'forest'), lib: ['island', 'plains'] } });
  s = cast(s, 'fecund-greenshell'); s = resolveAll(s, 'no');
  ok(s.players[0].hand.some(i => s.cards[i].id === 'island'), 'the Island is in hand'); eq(s.cards[s.players[0].lib[0]].id, 'plains');
});
test('Burrowguard Mentor: its */* is defined in every zone (CR 604.3), not only on the battlefield', () => {
  let s = setup({ me: { hand: ['burrowguard-mentor'], bf: ['warren-elder', 'warren-elder'] } });
  eq(pt(s, find(s, 'burrowguard-mentor')), [2, 2]);
});
test('Screaming Nemesis dealt damage by two blockers at once triggers once for the total (CR 510.2, its ruling)', () => {
  let s = setup({ me: { bf: ['screaming-nemesis'] }, opp: { bf: ['hired-claw', 'hired-claw'] } });
  const n = find(s, 'screaming-nemesis'); const [b1, b2] = findAll(s, 'hired-claw', 'bf');
  s = toStep(s, 'attackers'); s = answer(s, [n, 'done']);
  s = toStep(s, 'blockers', b1 + '>' + n, b2 + '>' + n, 'done');
  s = toStep(s, 'damage', q => q.opts[0].id);
  s = resolveAll(s, player(1));
  eq(logs(s, 'trigger').filter(e => e.c === 'screaming-nemesis').length, 1, 'one trigger'); eq(s.players[1].life, 18, 'two damage to the opponent');
});
test('Alania copies the offspring paid for the original (CR 707.10, its ruling)', () => {
  let s = setup({ me: { hand: ['coruscation-mage'], bf: ['alania-divergent-storm', ...lands(8, 'mountain')] } });
  s = cast(s, 'coruscation-mage', 'yes');
  s = resolveAll(s, player(1), 'yes', q => q.opts[0].id, q => q.opts[0].id, q => q.opts[0].id);
  eq(findAll(s, 'coruscation-mage', 'bf').length, 4, 'the Mage, its offspring, the copy and the copy’s offspring');
});
test('Alania: a target with no legal new choice stays unchanged (CR 707.10c) — no crash', () => {
  let s = setup({ me: { hand: ['rabid-gnaw'], bf: ['alania-divergent-storm', 'thieving-otter', ...lands(8, 'mountain')] }, opp: { bf: ['warren-elder'] } });
  const elder = find(s, 'warren-elder');
  s = cast(s, 'rabid-gnaw', tgt(find(s, 'thieving-otter')), tgt(elder));
  s = answer(s, [player(1)]);
  s = MF.clone(s); s.bf = s.bf.filter(i => i !== elder); s.cards[elder].zone = 'moved'; s.cards[elder].to = null; s = MF.run(s);
  s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  s = answer(s, ['yes', 'keep']);
  ok(!s.pending, 'only the first target was asked about'); eq(logs(s, 'copy').length, 1);
});
test('Alania copies a spell that has left the stack, as it last existed (her ruling)', () => {
  let s = setup({ me: { hand: ['flame-lash'], bf: ['alania-divergent-storm', ...lands(8, 'mountain')] } });
  s = cast(s, 'flame-lash', player(1));
  s = answer(s, [player(1)]);
  s = MF.clone(s); const L = s.stack.find(l => l.kind === 'spell'); s.stack = s.stack.filter(l => l !== L); MF.move(s, L.iid, 'grave'); s = MF.run(s);
  s = resolveAll(s, 'yes', 'keep');
  eq(s.players[1].life, 16, 'the copy deals 4'); ok(logs(s, 'copy')[0].gone, 'logged as copied from the last known spell');
});
test('Hop to It with Serra Redeemer: three identical Rabbit triggers are not a choice to order (CLAUDE.md rule 11)', () => {
  let s = setup({ me: { hand: ['hop-to-it'], bf: ['serra-redeemer', 'plains', 'plains', 'plains'] } });
  s = cast(s, 'hop-to-it'); s = resolveAll(s);
  eq(findAll(s, 'token-rabbit-1-1-w', 'bf').map(i => pt(s, i)), [[3, 3], [3, 3], [3, 3]]);
});
test('Break Out with no creature among the six: nothing is asked; the look is logged for its player', () => {
  let s = setup({ me: { hand: ['break-out'], bf: ['forest', 'mountain'], lib: ['opt', 'forest', 'forest', 'forest', 'forest', 'forest', 'island'] } });
  s = cast(s, 'break-out'); s = resolveAll(s);
  eq(logs(s, 'lookedAt').length, 1); eq(s.cards[s.players[0].lib[0]].id, 'island');
});
