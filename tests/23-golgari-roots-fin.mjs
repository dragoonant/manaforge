// Golgari Roots (Eli Kassis), Pro Tour Final Fantasy.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const B = 'swamp', G = 'forest';

test('Agatha’s Soul Cauldron: exile a creature card → a +1/+1 counter; creatures with counters gain its activated abilities; any colour pays for them', () => {
  let s = setup({ me: { bf: ['agathas-soul-cauldron', 'llanowar-elves', B], grave: ['scavenging-ooze'] }, opp: { grave: ['haywire-mite'] } });
  const el = find(s, 'llanowar-elves');
  s = activate(s, 'agathas-soul-cauldron', null, tgt(find(s, 'scavenging-ooze'))); s = resolveAll(s, tgt(el));
  eq(s.cards[el].ctr['+1/+1'], 1);
  const abs = MF.chars(s, el).ab.filter(a => a.k === 'act'); ok(abs.length === 1, 'the Ooze’s ability');
  s = MF.clone(s); s.cards[el].ctlTurn = 0; s = MF.run(s);
  s = activate(s, 'llanowar-elves', MF.chars(s, el).ab.indexOf(abs[0]), tgt(find(s, 'haywire-mite')), 'auto'); s = resolveAll(s);
  ok(find(s, 'haywire-mite', 'exile'), 'paid {G} with a Swamp'); eq(s.cards[el].ctr['+1/+1'], 2);
});
test('Molt Tender: {T}: mill; {T}, exile a card from your graveyard: one mana of any colour — which card is asked', () => {
  let s = setup({ me: { hand: ['haywire-mite'], bf: ['molt-tender'], grave: [B, G] } });
  s = MF.clone(s); s.cards[find(s, 'molt-tender')].ctlTurn = 0; s = MF.run(s);
  s = cast(s, 'haywire-mite', 'tap:' + find(s, 'molt-tender') + ':1:G', q => q.opts[0].id); s = resolveAll(s);
  ok(find(s, 'haywire-mite', 'bf'), 'cast'); eq(s.players[0].exile.length, 1);
});
test('Coati Scavenger: descend 4 — returns a permanent card if four permanent cards are in my graveyard', () => {
  let s = setup({ me: { hand: ['coati-scavenger'], bf: [G, G, G], grave: [B, G, 'haywire-mite', 'cache-grab', 'molt-tender'] } });
  s = cast(s, 'coati-scavenger'); s = resolveAll(s, tgt(find(s, 'molt-tender')));
  ok(s.players[0].hand.some(i => s.cards[i].id === 'molt-tender'), 'returned');
  let t = setup({ me: { hand: ['coati-scavenger'], bf: [G, G, G], grave: [B, G, 'cache-grab'] } });
  t = cast(t, 'coati-scavenger'); t = resolveAll(t); eq(t.stack.length, 0, 'no trigger with three');
});
test('Scavenging Ooze: exile a card; a creature card gives a counter and 1 life', () => {
  let s = setup({ me: { bf: ['scavenging-ooze', G, G] }, opp: { grave: ['haywire-mite', B] } });
  s = activate(s, 'scavenging-ooze', null, tgt(find(s, 'haywire-mite'))); s = resolveAll(s);
  eq(pt(s, find(s, 'scavenging-ooze')), [3, 3]); eq(s.players[0].life, 21);
  s = activate(s, 'scavenging-ooze', null, tgt(find(s, B, 'grave'))); s = resolveAll(s);
  eq(pt(s, find(s, 'scavenging-ooze')), [3, 3], 'a land: nothing');
});
test('Insidious Roots: creature tokens tap for any colour; creature cards leaving my graveyard make a Plant and grow Plants', () => {
  let s = setup({ me: { bf: ['insidious-roots', 'agathas-soul-cauldron'], grave: ['molt-tender'] } });
  s = activate(s, 'agathas-soul-cauldron', null, tgt(find(s, 'molt-tender'))); s = resolveAll(s, q => q.opts[0].id);
  const pl = find(s, 'token-plant-0-1-g', 'bf'); eq(pt(s, pl), [1, 2]);
  ok(MF.chars(s, pl).ab.some(a => a.k === 'mana' && a.cols.length === 5), 'taps for any colour');
});
test('Osteomancer Adept: forage (CR 701.61) to cast a creature from the graveyard; it enters with a finality counter', () => {
  let s = setup({ me: { bf: ['osteomancer-adept', B, B, G], grave: ['coati-scavenger', B, G, 'cache-grab'] } });
  s = MF.clone(s); s.cards[find(s, 'osteomancer-adept')].ctlTurn = 0; s = MF.run(s);
  s = activate(s, 'osteomancer-adept'); s = resolveAll(s);
  const a = MF.legalActions(s).find(l => l.type === 'cast' && l.via === 'forage'); ok(a, 'forage offered');
  s = answer(MF.apply(s, a), ['exile', (q, st) => q.opts.find(o => MF.view(st).cards[o.iid].id === 'swamp').id, (q, st) => q.opts.find(o => MF.view(st).cards[o.iid].id === 'forest').id, (q, st) => q.opts.find(o => MF.view(st).cards[o.iid].id === 'cache-grab').id]); s = resolveAll(s);
  const c = find(s, 'coati-scavenger', 'bf'); eq(s.cards[c].ctr.finality, 1); eq(s.players[0].exile.length, 3);
});
test('Tyvar: creatures’ abilities ignore summoning sickness; −2 mills three and may return a creature card with mana value 2 or less', () => {
  let s = setup({ me: { bf: [{ id: 'tyvar-jubilant-brawler', ctr: { loyalty: 3 } }, { id: 'molt-tender', sick: true }], lib: ['haywire-mite', B, G] } });
  ok(MF.legalActions(s).some(a => a.type === 'act' && s.cards[a.iid].id === 'molt-tender'), 'a summoning-sick Molt Tender can tap');
  s = activate(s, 'tyvar-jubilant-brawler', 2); s = resolveAll(s, (q, st) => q.opts.find(o => o.iid != null && MF.view(st).cards[o.iid].id === 'haywire-mite').id);
  ok(find(s, 'haywire-mite', 'bf'), 'onto the battlefield');
});
test('Great Arashin City: {1}{B}, {T}, exile a creature card from my graveyard: a 1/1 white Spirit', () => {
  let s = setup({ me: { bf: ['great-arashin-city', B, B], grave: ['molt-tender', G] } });
  s = activate(s, 'great-arashin-city', 2, q => q.opts[0].id); s = resolveAll(s);
  ok(find(s, 'token-spirit-1-1-w', 'bf'), 'a Spirit'); ok(find(s, 'molt-tender', 'exile'), 'the creature card, the only choice');
});
test('Cache Grab: mill four, take a permanent card; a Squirrel means a Food', () => {
  let s = setup({ me: { hand: ['cache-grab'], bf: [G, G, 'osteomancer-adept'], lib: [B, 'molt-tender', G, B, G] } });
  s = cast(s, 'cache-grab'); s = resolveAll(s, (q, st) => q.opts.find(o => o.iid != null && MF.view(st).cards[o.iid].id === 'molt-tender').id);
  ok(s.players[0].hand.some(i => s.cards[i].id === 'molt-tender'), 'took it'); ok(find(s, 'token-food', 'bf'), 'Osteomancer is a Squirrel: Food');
});
test('Haywire Mite: {G}, sacrifice: exile a noncreature artifact or enchantment; dies: gain 2', () => {
  let s = setup({ me: { bf: ['haywire-mite', G] }, opp: { bf: ['insidious-roots'] } });
  s = activate(s, 'haywire-mite', null, tgt(find(s, 'insidious-roots'))); s = resolveAll(s);
  ok(find(s, 'insidious-roots', 'exile'), 'exiled'); eq(s.players[0].life, 22);
});
test('Dredger’s Insight: mill four on entering and take an artifact, creature or land; gain 1 when such cards leave my graveyard', () => {
  let s = setup({ me: { hand: ['dredgers-insight'], bf: [G, G], lib: ['cache-grab', B, 'molt-tender', 'cache-grab', G] } });
  s = cast(s, 'dredgers-insight'); s = resolveAll(s, (q, st) => q.opts.find(o => o.iid != null && MF.view(st).cards[o.iid].id === 'molt-tender').id);
  eq(s.players[0].life, 21, 'Molt Tender left the graveyard');
});
