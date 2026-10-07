// Azorius Omniscience (Shaun Henry), Pro Tour Final Fantasy.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const W = 'plains', U = 'island';

test('Omniscience: spells from my hand cost no mana (CR 118.9); X is 0 (CR 107.3b)', () => {
  let s = setup({ me: { hand: ['marang-river-regent-coil-and-catch', 'abuelos-awakening'], bf: ['omniscience'] } });
  const free = MF.legalActions(s).filter(a => a.type === 'cast' && a.via === 'free').map(a => s.cards[a.iid].id).sort();
  eq(free, ['abuelos-awakening', 'marang-river-regent-coil-and-catch'].filter(id => id !== 'abuelos-awakening'), 'Abuelo’s Awakening needs a target in my graveyard');
  s = answer(MF.apply(s, MF.legalActions(s).find(a => a.via === 'free')), []); s = resolveAll(s, q => q.opts.find(o => o.id === 'done') ? 'done' : q.opts[0].id);
  ok(find(s, 'marang-river-regent-coil-and-catch', 'bf'), 'a free six-drop');
});
test('Abuelo’s Awakening: an artifact or non-Aura enchantment returns as a 1/1 Spirit with flying and X more +1/+1 counters', () => {
  let s = setup({ me: { hand: ['abuelos-awakening'], bf: [W, W, W, W, W, W], grave: ['omniscience', 'scrollshift'] } });
  s = cast(s, 'abuelos-awakening', 2, tgt(find(s, 'omniscience'))); s = resolveAll(s);
  const o = find(s, 'omniscience', 'bf');
  ok(MF.chars(s, o).types.includes('Creature') && MF.chars(s, o).subtypes.includes('Spirit'), 'a Spirit creature'); eq(pt(s, o), [3, 3]); ok(has(s, o, 'flying'), 'flying');
});
test('Fallaji Archaeologist: mill three; take a noncreature, nonland card — or, if not, a +1/+1 counter', () => {
  let s = setup({ me: { hand: ['fallaji-archaeologist'], bf: [U, U], lib: [W, 'fallaji-archaeologist', U, W] } });
  s = cast(s, 'fallaji-archaeologist'); s = resolveAll(s);
  eq(pt(s, find(s, 'fallaji-archaeologist', 'bf')), [1, 4], 'nothing to take: the counter');
  let t = setup({ me: { hand: ['fallaji-archaeologist'], bf: [U, U], lib: [W, 'scrollshift', U, W] } });
  t = cast(t, 'fallaji-archaeologist'); t = resolveAll(t, q => q.opts.find(o => o.iid != null).id);
  ok(t.players[0].hand.some(i => t.cards[i].id === 'scrollshift'), 'took Scrollshift'); eq(pt(t, find(t, 'fallaji-archaeologist', 'bf')), [0, 3]);
});
test('Roiling Dragonstorm: loots on entering; returns to hand when a Dragon I control enters', () => {
  let s = setup({ me: { hand: ['roiling-dragonstorm', 'marang-river-regent-coil-and-catch', W], bf: [U, U, U, U, U, U, U, U], lib: [W, W, W] } });
  s = cast(s, 'roiling-dragonstorm'); s = resolveAll(s, q => q.opts.find(o => o.iid != null && s.cards[o.iid].id === 'plains').id);
  s = cast(s, 'marang-river-regent-coil-and-catch'); s = resolveAll(s, q => q.opts.find(o => o.id === 'done') ? 'done' : q.opts[0].id, q => q.opts[0].id);
  ok(s.players[0].hand.some(i => s.cards[i].id === 'roiling-dragonstorm'), 'back in hand');
});
test('Oracle of Tragedy: a modal trigger on entering or dying — shuffle up to four cards with mana value 3 or greater back', () => {
  let s = setup({ me: { hand: ['oracle-of-tragedy'], bf: [U, U], grave: ['omniscience', 'scrollshift', 'fallaji-archaeologist'] } });
  s = cast(s, 'oracle-of-tragedy'); s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  eq(s.pending.q.kind, 'mode'); s = answer(s, [1]);
  eq(s.pending.q.opts.filter(o => o.iid != null).map(o => s.cards[o.iid].id).sort(), ['omniscience', 'scrollshift'], 'mana value 3 or more');
  s = answer(s, [q => q.opts.find(o => o.iid != null).id, q => q.opts.find(o => o.iid != null) ? q.opts.find(o => o.iid != null).id : 'done']); s = resolveAll(s);
  eq(s.players[0].grave.map(i => s.cards[i].id), ['fallaji-archaeologist']);
});
test('Scrollshift: exile one of my permanents and return it — a new object (CR 400.7); draw', () => {
  let s = setup({ me: { hand: ['scrollshift'], bf: [W, W, W, { id: 'fallaji-archaeologist', ctr: { '+1/+1': 2 } }], lib: [W, W, U, U] } });
  const f = find(s, 'fallaji-archaeologist');
  s = cast(s, 'scrollshift', tgt(f)); s = resolveAll(s, q => q.opts.find(o => o.iid != null) ? q.opts.find(o => o.iid != null).id : 'none');
  const n = find(s, 'fallaji-archaeologist', 'bf'); ok(n !== f, 'a new object'); ok(!(s.cards[n].ctr['+1/+1'] > 1), 'counters gone');
});
test('Ephara’s Dispersal: {2} less if it targets an attacking creature; bounce, surveil 2', () => {
  let s = setup({ me: { hand: ['epharas-dispersal'], bf: [U], lib: [W, W, W] }, opp: { bf: ['oracle-of-tragedy'] } });
  s = MF.clone(s); s.ap = 1; s.priority = 1; s.cards[find(s, 'oracle-of-tragedy')].ctlTurn = 0; s = MF.run(s);
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'oracle-of-tragedy'), 'done']); s = toStep(s, 'attackers');
  s = MF.clone(s); s.priority = 0; s = MF.run(s);
  ok(MF.legalActions(s).some(a => a.type === 'cast'), 'one Island is enough');
  s = cast(s, 'epharas-dispersal', tgt(find(s, 'oracle-of-tragedy'))); s = resolveAll(s, 'top', 'top', q => q.opts[0].id);
  ok(s.players[1].hand.some(i => s.cards[i].id === 'oracle-of-tragedy'), 'bounced');
});
test('Jace, the Perfected Mind: compleated — {U/P} paid with 2 life, it enters with two fewer loyalty (CR 702.150a); [−X] mills three times X', () => {
  let s = setup({ me: { hand: ['jace-the-perfected-mind'], bf: [U, U, U] }, opp: { lib: Array(12).fill(W) } });
  s = cast(s, 'jace-the-perfected-mind', 'life'); s = resolveAll(s);
  const j = find(s, 'jace-the-perfected-mind'); eq(s.cards[j].ctr.loyalty, 3); eq(s.players[0].life, 18);
  s = activate(s, 'jace-the-perfected-mind', 3, 2, player(1)); s = resolveAll(s);   // X first (CR 601.2b), then the target
  eq(s.players[1].grave.length, 6); eq(s.cards[j].ctr.loyalty, 1);
});
