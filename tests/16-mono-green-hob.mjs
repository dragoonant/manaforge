// Mono-Green (Earthbender Ascension), Arena top-ranked Standard after the Hobbit release.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const G = 'forest';
// Pass (declining attacks) until my next precombat main phase, where the Saga's lore counter goes on (CR 714.3b).
function nextMain(s) {
  const turn = s.turn;
  for (let g = 0; g < 400; g++) {
    if (s.turn > turn && s.ap === 0 && s.step === 'main1' && (s.priority != null || s.pending)) return s;
    if (s.pending) { const q = s.pending.q; s = MF.apply(s, { type: 'answer', id: q.opts.some(o => o.id === 'done') ? 'done' : q.opts[0].id }); continue; }
    s = MF.apply(s, { type: 'pass' });
  }
  throw new Error('never reached my next main phase');
}

test('Icetill Explorer: an additional land each turn (CR 305.2), lands from the graveyard, and landfall mills', () => {
  let s = setup({ me: { hand: [G, G, G], bf: ['icetill-explorer'], grave: ['ba-sing-se'], lib: [G, G, G] } });
  s = play(s, G); s = resolveAll(s);
  eq(s.players[0].grave.length, 2, 'milled one');
  s = play(s, 'ba-sing-se'); s = resolveAll(s);
  ok(find(s, 'ba-sing-se', 'bf'), 'played from the graveyard');
  ok(!MF.legalActions(s).some(a => a.type === 'land'), 'two lands, no third');
});
test('Ba Sing Se: enters tapped unless I control a basic land', () => {
  let s = setup({ me: { hand: ['ba-sing-se'] } });
  s = play(s, 'ba-sing-se'); s = resolveAll(s); ok(s.cards[find(s, 'ba-sing-se')].tapped, 'tapped');
  let t = setup({ me: { hand: ['ba-sing-se'], bf: [G] } });
  t = play(t, 'ba-sing-se'); t = resolveAll(t); ok(!t.cards[find(t, 'ba-sing-se')].tapped, 'untapped');
});
test('Earthbend 2 (CR 701.66a): a 0/0 hasty land creature with two counters; when it dies it returns tapped', () => {
  let s = setup({ me: { bf: ['ba-sing-se', G, G, G] }, opp: { hand: ['lightning-strike'], bf: ['mountain', 'mountain'] } });
  const f = find(s, G);
  s = activate(s, 'ba-sing-se', null, tgt(f)); s = resolveAll(s);
  eq(pt(s, f), [2, 2]); ok(has(s, f, 'haste'), 'haste'); ok(MF.chars(s, f).types.includes('Land'), 'still a land');
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  s = cast(s, 'lightning-strike', tgt(f)); s = resolveAll(s);
  const back = findAll(s, G, 'bf').find(i => i !== f && s.cards[i].tapped && !MF.chars(s, i).types.includes('Creature'));
  ok(back != null, 'returned tapped, a plain land again');
});
test('Earthbender Ascension: earthbend, fetch a basic tapped; at four quest counters landfall gives a counter and trample', () => {
  let s = setup({ me: { hand: ['earthbender-ascension', G], bf: [G, G, G, 'sazhs-chocobo'], lib: [G, G] } });
  const land = find(s, G, 'bf');
  s = cast(s, 'earthbender-ascension'); s = resolveAll(s, tgt(land), q => q.opts.find(o => o.iid != null).id, q => q.opts[0].id);   // the fetched Forest: order the two landfall triggers
  eq(pt(s, land), [2, 2]); eq(findAll(s, G, 'bf').length, 4);
  const asc = find(s, 'earthbender-ascension', 'bf');
  eq(s.cards[asc].ctr.quest, 1, 'the fetched land is landfall');
  s = MF.clone(s); s.cards[asc].ctr.quest = 3; s = MF.run(s);
  const ch = find(s, 'sazhs-chocobo');
  s = play(s, G); s = resolveAll(s, q => q.opts[0].id, tgt(ch));
  eq(s.cards[asc].ctr.quest, 4); ok(has(s, ch, 'trample'), 'trample'); eq(s.cards[ch].ctr['+1/+1'], 3, 'landfall twice + the reflexive one');
});
test('Mightform Harmonizer: landfall doubles a creature’s power (CR 701.10b)', () => {
  let s = setup({ me: { hand: [G], bf: ['mightform-harmonizer', 'surrak-elusive-hunter'] } });
  const su = find(s, 'surrak-elusive-hunter');
  s = play(s, G); s = resolveAll(s, tgt(su));
  eq(pt(s, su), [8, 3]);
});
test('Sapling Nursery: affinity for Forests; landfall makes a 3/4 reach Treefolk; exile it to give indestructible', () => {
  let s = setup({ me: { hand: ['sapling-nursery', G], bf: [G, G, G, G, G, G] } });
  eq(MF.costOf(s, 0, find(s, 'sapling-nursery')).g, 0, 'six Forests pay for the generic part');
  s = cast(s, 'sapling-nursery'); s = resolveAll(s);
  s = play(s, G); s = resolveAll(s);
  const tf = s.bf.find(i => MF.chars(s, i).subtypes.includes('Treefolk'));
  eq(pt(s, tf), [3, 4]); ok(has(s, tf, 'reach'), 'reach');
  s = activate(s, 'sapling-nursery'); s = resolveAll(s);
  ok(has(s, tf, 'indestructible'), 'indestructible'); ok(find(s, 'sapling-nursery', 'exile'), 'exiled as a cost');
});
test('Esper Origins: flashback from the graveyard comes back transformed — a Saga creature with a finality counter', () => {
  let s = setup({ me: { grave: ['esper-origins-summon-esper-maduin'], bf: [G, G, G, G], lib: ['sazhs-chocobo', G, G] } });
  const a = MF.legalActions(s).find(l => l.type === 'cast' && l.via === 'flashback');
  ok(a, 'flashback offered');
  s = answer(MF.apply(s, a), []); s = resolveAll(s, 'grave', 'grave');
  const e = find(s, 'esper-origins-summon-esper-maduin', 'bf');
  ok(MF.chars(s, e).types.includes('Creature'), 'a creature'); eq(pt(s, e), [4, 4]); eq(s.cards[e].ctr.finality, 1); eq(s.cards[e].ctr.lore, 1);
  eq(s.players[0].life, 22);
});
test('Esper Maduin: chapters I–III (CR 714), then sacrificed; finality exiles it', () => {
  let s = setup({ me: { bf: [{ id: 'esper-origins-summon-esper-maduin', ctr: { lore: 0, finality: 1 } }, 'sazhs-chocobo'], lib: ['sazhs-chocobo', G, G, G, G] } });
  const e = find(s, 'esper-origins-summon-esper-maduin');
  s = MF.clone(s); s.cards[e].transformed = true; s = MF.run(s);
  s = nextMain(s); s = resolveAll(s);
  eq(s.cards[e].ctr.lore, 1); ok(s.players[0].hand.some(i => s.cards[i].id === 'sazhs-chocobo'), 'chapter I put the permanent card into hand');
  s = MF.clone(s); s.cards[e].ctr.lore = 2; s = MF.run(s);
  s = nextMain(s); s = resolveAll(s);
  const ch = find(s, 'sazhs-chocobo', 'bf'); ok(has(s, ch, 'trample'), 'chapter III: trample'); eq(pt(s, ch)[0], 2);
  ok(find(s, 'esper-origins-summon-esper-maduin', 'exile'), 'sacrificed after III, exiled by its finality counter');
});
test('Lumbering Worldwagon: power = my lands; crew 4 taps creatures with total power 4', () => {
  let s = setup({ me: { bf: ['lumbering-worldwagon', 'surrak-elusive-hunter', G, G, G] } });
  const w = find(s, 'lumbering-worldwagon');
  ok(!MF.chars(s, w).types.includes('Creature'), 'not a creature until crewed');
  s = activate(s, 'lumbering-worldwagon', null, find(s, 'surrak-elusive-hunter'), 'done'); s = resolveAll(s);
  ok(MF.chars(s, w).types.includes('Creature'), 'crewed'); eq(pt(s, w)[0], 3);
  ok(s.cards[find(s, 'surrak-elusive-hunter')].tapped, 'crew tapped Surrak');
});
test('Meltstriders Resolve: fights on entering; can’t be blocked by more than one creature (CR 509.1b)', () => {
  let s = setup({ me: { hand: ['meltstriders-resolve'], bf: ['surrak-elusive-hunter', G, G] }, opp: { bf: ['warren-elder', 'warren-elder'] } });
  const su = find(s, 'surrak-elusive-hunter'), we = findAll(s, 'warren-elder');
  s = cast(s, 'meltstriders-resolve', tgt(su)); s = resolveAll(s, tgt(we[0]));
  ok(!s.bf.includes(we[0]), 'fought and killed one'); eq(pt(s, su), [4, 5]);
});
test('Surrak: can’t be countered (CR 113.6g); draws when an opponent targets my creature', () => {
  let s = setup({ me: { bf: ['surrak-elusive-hunter'], lib: [G, G] }, opp: { hand: ['lightning-strike'], bf: ['mountain', 'mountain'] } });
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  s = cast(s, 'lightning-strike', tgt(find(s, 'surrak-elusive-hunter'))); s = resolveAll(s);
  eq(s.players[0].hand.length, 1, 'drew a card');
});
test('Meltstriders Resolve: a second blocker for the enchanted creature is never offered; undo removes the last one declared', () => {
  let s = setup({ me: { bf: ['surrak-elusive-hunter', { id: 'meltstriders-resolve', att: 0 }] }, opp: { bf: ['warren-elder', 'warren-elder', 'warren-elder'] } });
  const su = find(s, 'surrak-elusive-hunter'), we = findAll(s, 'warren-elder');
  s = toStep(s, 'attackers'); s = answer(s, [su, 'done']); s = toStep(s, 'blockers');
  eq(s.pending.q.kind, 'block');
  s = answer(s, [we[2] + '>' + su]);
  ok(!s.pending.q.opts.some(o => o.att === su), 'no second blocker offered'); ok(s.pending.q.opts.some(o => o.id === 'done'), 'one blocker is legal');
  s = answer(s, ['undo']); eq(Object.keys(s.pending.q.assign).length, 0, 'undone');
});
test('Log lines name the face a permanent shows: Summon: Esper Maduin triggers, not Esper Origins', () => {
  let s = setup({ me: { bf: [{ id: 'esper-origins-summon-esper-maduin', ctr: { lore: 1, finality: 1 } }], lib: [G, G, G, G] } });
  s = MF.clone(s); s.cards[find(s, 'esper-origins-summon-esper-maduin')].transformed = true; s = MF.run(s);
  for (let g = 0; g < 400 && !(s.turn > 3 && s.ap === 0 && s.step === 'main1'); g++) s = MF.apply(s, s.pending ? { type: 'answer', id: s.pending.q.opts.some(o => o.id === 'done') ? 'done' : s.pending.q.opts[0].id } : { type: 'pass' });
  const tr = logs(s, 'trigger').find(e => e.c === 'esper-origins-summon-esper-maduin'); ok(tr, 'it triggered'); eq(tr.cf, 'Summon: Esper Maduin');
});
