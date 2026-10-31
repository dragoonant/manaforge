// Kujo — "Zellix, of Halaster" (Commander, PLAN D21): the Commander variant (CR 903) and the deck's cards.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, play, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const U = 'island', B = 'swamp';
const viewId = (q, st, id) => q.opts.find(o => o.iid != null && MF.view(st).cards[o.iid].id === id).id;
const oppTurn = s => { s = MF.clone(s); s.ap = 1; s.priority = 1; return MF.run(s); };
const lib = (s, seat) => s.players[seat].lib.map(i => s.cards[i].id);
const grave = (s, seat) => s.players[seat].grave.map(i => s.cards[i].id);
const act = (s, type, id, extra) => { const a = MF.legalActions(s).find(l => l.type === type && MF.view(s).cards[l.iid].id === id && (!extra || Object.keys(extra).every(k => l[k] === extra[k]))); if (!a) throw new Error('no ' + type + ' for ' + id); return MF.apply(s, a); };

// ---- The Commander variant -------------------------------------------------------------------
test('CR 903.6-903.8: commanders start in the command zone at 40 life; cast from there, each with its own {2} tax', () => {
  let s = setup({ commander: true, me: { command: ['zellix-sanity-flayer', 'scion-of-halaster'], bf: [U, U, U, B, B, B, B, B, B, B] }, opp: { command: ['zellix-sanity-flayer', 'scion-of-halaster'] } });
  eq(s.players[0].life, 40);
  eq(MF.manaStr(MF.costOf(s, 0, find(s, 'zellix-sanity-flayer', 'command', 0))), '{2}{U}', 'no tax the first time');
  s = act(s, 'cast', 'zellix-sanity-flayer'); s = answer(s, ['auto']); s = resolveAll(s);
  ok(find(s, 'zellix-sanity-flayer', 'bf', 0), 'on the battlefield');
  eq(MF.manaStr(MF.costOf(s, 0, find(s, 'scion-of-halaster', 'command', 0))), '{1}{B}', 'the other commander is counted on its own (CR 702.124d)');
  eq(s.players[0].cmdCasts['zellix-sanity-flayer'], 1);
});
test('CR 903.9a: a commander put into a graveyard may go to the command zone (a state-based action); the tax then grows', () => {
  let s = setup({ commander: true, me: { bf: [{ id: 'zellix-sanity-flayer', cmdr: true }, U, U, U, U, U, U, U], cmdCasts: { 'zellix-sanity-flayer': 1 } }, opp: { command: [] } });
  const z = find(s, 'zellix-sanity-flayer', 'bf');
  s = MF.clone(s); MF.destroy(s, z, 'test'); s = MF.run(s);
  eq(s.pending.q.kind, 'commandZone');
  s = answer(s, ['command']);
  const c = find(s, 'zellix-sanity-flayer', 'command', 0);
  eq(MF.manaStr(MF.costOf(s, 0, c)), '{4}{U}', '{2} for the one earlier cast');
});
test('CR 903.9b: a commander that would go to its owner\'s hand may go to the command zone instead (Hullbreaker Horror bounces it)', () => {
  let s = setup({ commander: true, me: { hand: ['dark-ritual'], bf: ['hullbreaker-horror', B] }, opp: { bf: [{ id: 'zellix-sanity-flayer', cmdr: true }] } });
  s = cast(s, 'dark-ritual'); s = answer(s, [q => 1, (q, st) => tgt(find(st, 'zellix-sanity-flayer', 'bf', 1))]);
  s = resolveAll(s, 'command');
  ok(find(s, 'zellix-sanity-flayer', 'command', 1), 'its owner chose the command zone');
});
test('CR 704.6c: 21 combat damage from one commander loses the game', () => {
  let s = setup({ commander: true, me: { bf: [{ id: 'zellix-sanity-flayer', cmdr: true }] }, opp: { life: 40 } });
  s = MF.clone(s); s.players[1].cmdDmg['0:zellix-sanity-flayer'] = 19; s = MF.run(s);
  s = toStep(s, 'attackers'); s = answer(s, [q => q.opts.find(o => o.iid != null).id, 'done']);
  for (let g = 0; g < 20 && s.winner == null; g++) s = MF.apply(s, { type: 'pass' });
  eq(s.winner, 0, '19 + 2 = 21');
  eq(logs(s, 'lose')[0].why, 'commander');
});
test('Command Tower and Arcane Signet: one mana of a colour in the commanders\' combined identity (CR 903.4f, 702.124c)', () => {
  let s = setup({ commander: true, me: { bf: ['command-tower', 'arcane-signet'] } });
  const ct = MF.manaSources(s, 0, { any: true }).filter(m => m.id === 'command-tower');
  eq(ct[0].cols, ['U', 'B']);
  s = MF.clone(s); s.players[0].identity = []; s = MF.run(s);
  eq(MF.manaSources(s, 0, { any: true }).filter(m => m.id === 'arcane-signet').length, 0, 'no commander identity: no mana');
});

// ---- Mill: the door, its replacements and its triggers ----------------------------------------
test('Zellix: Hive Mind makes a Horror when a player mills one or more creature cards — once per mill', () => {
  let s = setup({ me: { bf: ['zellix-sanity-flayer', U] }, opp: { lib: ['aphetto-alchemist', 'narcomoeba', U, U, U] } });
  s = activate(s, 'zellix-sanity-flayer', 1, player(1)); s = resolveAll(s, q => 'no');
  eq(grave(s, 1).length, 3, 'three milled');
  eq(findAll(s, 'token-horror-1-1-b', 'bf').length, 1, 'one Horror for the one mill');
});
test('Bruvac doubles and The Water Crystal adds four; the milling player orders them (CR 616.1)', () => {
  let t = setup({ me: { bf: ['bruvac-the-grandiloquent', 'the-water-crystal', 'zellix-sanity-flayer', U] }, opp: { lib: Array(40).fill(U) } });
  t = activate(t, 'zellix-sanity-flayer', 1, player(1));
  t = MF.apply(t, { type: 'pass' }); t = MF.apply(t, { type: 'pass' });
  eq(t.pending.q.kind, 'millOrder'); eq(t.pending.q.who, 1, 'the milling player chooses');
  t = answer(t, ['millDouble:0']);
  eq(t.players[1].grave.length, 10, '3 × 2 + 4');
});
test('Narcomoeba: put into the graveyard from the library, it may come onto the battlefield (CR 113.6m)', () => {
  let s = setup({ me: { bf: ['zellix-sanity-flayer', U], lib: ['narcomoeba', U, U, U] } });
  s = activate(s, 'zellix-sanity-flayer', 1, player(0)); s = resolveAll(s, 0, 'yes');
  ok(find(s, 'narcomoeba', 'bf', 0), 'it came back');
});
test('Scion of Halaster: a commander creature I own replaces my first draw each turn — two looked at, one to the graveyard, then a draw', () => {
  let s = setup({ commander: true, me: { bf: ['scion-of-halaster', { id: 'zellix-sanity-flayer', cmdr: true }], lib: ['sol-ring', 'narcomoeba', 'island', 'swamp'] } });
  s = MF.clone(s); s.step = 'upkeep'; s = MF.run(s);
  s = toStep(s, 'main1', (q, st) => viewId(q, st, 'narcomoeba'), 'yes');
  ok(s.players[0].hand.some(i => s.cards[i].id === 'sol-ring'), 'the other card was drawn');
  ok(find(s, 'narcomoeba', 'bf'), 'Narcomoeba went from library to graveyard, and came back');
});
test('The Master of Lake-town and Mindcrank: losing life mills that many', () => {
  let s = setup({ me: { bf: ['mindcrank'], hand: ['dark-ritual'] }, opp: { lib: Array(10).fill(U), bf: ['the-master-of-lake-town'] } });
  s = MF.clone(s); MF.loseLife(s, 1, 2, 'effect', null); s = MF.run(s); s = resolveAll(s);
  eq(s.players[1].grave.length, 4, 'two triggers, two cards each');
});
test('The Mindskinner: damage my sources would deal to an opponent is prevented and they mill that many', () => {
  let s = setup({ me: { bf: ['the-mindskinner', 'syr-konrad-the-grim', B, B] }, opp: { lib: Array(10).fill(U) } });
  s = toStep(s, 'attackers'); s = answer(s, [(q, st) => viewId(q, st, 'the-mindskinner'), 'done']);
  s = toStep(s, 'main2');
  eq(s.players[1].life, 20, 'no damage');
  eq(s.players[1].grave.length, 10, 'ten milled');
});

// ---- Mana ---------------------------------------------------------------------------------------
test('Sol Ring, Mana Vault, Ancient Tomb: several mana from one tap; the proposal uses them (CR 605.3b)', () => {
  let s = setup({ me: { bf: ['sol-ring', 'ancient-tomb'], hand: ['consecrated-sphinx'] } });
  ok(!MF.canCast(s, 0, find(s, 'consecrated-sphinx')), '{4}{U}{U} is beyond four colourless');
  s = setup({ me: { bf: ['sol-ring', 'mana-vault', U], hand: ['thassas-oracle', 'fabricate'] } });
  s = cast(s, 'fabricate'); s = answer(s, ['auto']);
  ok(s.cards[find(s, 'sol-ring')].tapped && !s.cards[find(s, 'mana-vault')].tapped, 'the fewest multi-mana abilities: Sol Ring and the Island, not Mana Vault');
  eq(s.stack.length, 1);
});
test('Ancient Tomb deals 2 damage to you as it adds {C}{C}', () => {
  let s = setup({ me: { bf: ['ancient-tomb'] } });
  s = act(s, 'mana', 'ancient-tomb');
  eq(s.players[0].pool.C, 2); eq(s.players[0].life, 18);
});
test('Cabal Coffers with Urborg: {2},{T}: {B} for each Swamp — Urborg makes every land a Swamp (CR 305.6)', () => {
  let s = setup({ me: { bf: ['cabal-coffers', 'urborg-tomb-of-yawgmoth', U, U, 'underground-sea'] } });
  ok(MF.chars(s, find(s, 'cabal-coffers')).subtypes.includes('Swamp'), 'Coffers is a Swamp');
  ok(MF.manaSources(s, 0, { any: true }).some(m => m.iid === find(s, 'island') && m.cols.includes('B')), 'an Island taps for {B}');
  s = act(s, 'mana', 'cabal-coffers'); s = answer(s, ['auto']);
  eq(s.players[0].pool.B, 5, 'five Swamps');
});
test('Darkwater Catacombs and Sunken Ruins: mana abilities with a mana cost, each paid by mana made before it', () => {
  let s = setup({ me: { bf: ['darkwater-catacombs', 'sunken-ruins', U], hand: ['fabricate', 'consuming-aberration'] } });
  ok(!MF.canCast(s, 0, find(s, 'consuming-aberration')), 'each nets one mana: three in all, not five');
  ok(MF.canCast(s, 0, find(s, 'fabricate')), 'Island pays Darkwater\'s {1}; Darkwater\'s {B} pays Ruins\' {U/B}');
  s = cast(s, 'fabricate'); s = answer(s, ['auto']);
  ok(s.stack.length === 1 && !s.pending, 'cast'); eq(s.players[0].pool, { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
});
test('Phyrexian Tower: {T}, sacrifice a creature: {B}{B} — which creature is asked', () => {
  let s = setup({ me: { bf: ['phyrexian-tower', 'narcomoeba', 'ruin-crab'] } });
  s = act(s, 'mana', 'phyrexian-tower', { ab: 1 });
  eq(s.pending.q.kind, 'sacrificeCost'); s = answer(s, [(q, st) => viewId(q, st, 'ruin-crab')]);
  eq(s.players[0].pool.B, 2); ok(find(s, 'ruin-crab', 'grave'), 'sacrificed');
});
test('Chrome Mox: imprint a nonartifact, nonland card; it taps for that card\'s colours', () => {
  let s = setup({ me: { hand: ['chrome-mox', 'dark-ritual', U] } });
  s = cast(s, 'chrome-mox'); s = resolveAll(s, (q, st) => viewId(q, st, 'dark-ritual'));
  const m = MF.manaSources(s, 0, { any: true }).find(x => x.id === 'chrome-mox');
  eq(m.cols, ['B']);
});
test('Mox Opal: metalcraft — any colour only with three or more artifacts', () => {
  let s = setup({ me: { bf: ['mox-opal', 'sol-ring'] } });
  ok(!MF.manaSources(s, 0, { any: true }).some(m => m.id === 'mox-opal'), 'two artifacts');
  s = setup({ me: { bf: ['mox-opal', 'sol-ring', 'mana-vault'] } });
  ok(MF.manaSources(s, 0, { any: true }).some(m => m.id === 'mox-opal'), 'three');
});
test('Fellwar Stone, Exotic Orchard, Reflecting Pool: the colours other lands could produce (CR 106.7)', () => {
  let s = setup({ me: { bf: ['fellwar-stone', 'exotic-orchard', 'reflecting-pool', 'ancient-tomb'] }, opp: { bf: ['underground-sea'] } });
  eq(MF.manaSources(s, 0, { any: true }).find(m => m.id === 'fellwar-stone').cols, ['U', 'B']);
  eq(MF.manaSources(s, 0, { any: true }).find(m => m.id === 'exotic-orchard').cols, ['U', 'B']);
  eq(MF.manaSources(s, 0, { any: true }).find(m => m.id === 'reflecting-pool').cols, ['U', 'B', 'C'], 'the Orchard\'s colours and the Tomb\'s colourless');
});
test('Dark Ritual and Cabal Ritual (threshold: seven cards in the graveyard)', () => {
  let s = setup({ me: { bf: [B, B], hand: ['dark-ritual', 'cabal-ritual'], grave: Array(7).fill(U) } });
  s = cast(s, 'dark-ritual'); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[0].pool.B, 3);
  s = cast(s, 'cabal-ritual'); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[0].pool.B, 6, 'three, less {1}{B}, plus five: the threshold');
});

// ---- The combo pieces ---------------------------------------------------------------------------
test('Isochron Scepter + Dramatic Reversal: imprint, then {2},{T}: cast a copy free; it untaps my nonland permanents', () => {
  let s = setup({ me: { bf: ['sol-ring', U, U, U], hand: ['isochron-scepter', 'dramatic-reversal'] } });
  s = cast(s, 'isochron-scepter'); s = answer(s, ['auto']); s = resolveAll(s, (q, st) => viewId(q, st, 'dramatic-reversal'));
  ok(find(s, 'dramatic-reversal', 'exile'), 'imprinted');
  s = act(s, 'act', 'isochron-scepter'); s = answer(s, ['auto']);
  s = resolveAll(s, 'yes', 'yes');
  ok(!s.cards[find(s, 'isochron-scepter')].tapped, 'the Scepter untapped itself');
  ok(find(s, 'dramatic-reversal', 'exile'), 'the card stays imprinted');
  eq(findAll(s, 'dramatic-reversal', 'grave').length, 0, 'the copy ceased to exist (CR 704.5e)');
});
test('Brain Freeze: storm copies it for each other spell cast before it this turn, by either player (CR 702.40a)', () => {
  let s = setup({ me: { bf: [U, B, B, B], hand: ['dark-ritual', 'dark-ritual', 'brain-freeze'] }, opp: { lib: Array(30).fill(U) } });
  s = cast(s, 'dark-ritual'); s = answer(s, ['auto']); s = resolveAll(s);
  s = cast(s, 'dark-ritual'); s = answer(s, ['auto']); s = resolveAll(s);
  s = cast(s, 'brain-freeze', player(1)); s = answer(s, ['auto']);
  s = resolveAll(s, 'keep', 'keep');
  eq(s.players[1].grave.length, 9, 'three copies in all, three cards each');
});
test('Thassa\'s Oracle: devotion to blue at least the library wins the game (CR 104.2b)', () => {
  let s = setup({ me: { bf: [U, U], hand: ['thassas-oracle'], lib: [U] } });
  s = cast(s, 'thassas-oracle'); s = answer(s, ['auto']); s = resolveAll(s, 'none');
  eq(s.winner, 0);
});
test('Doomsday: five of library and graveyard on top in the order chosen, the rest exiled, half the life lost', () => {
  let s = setup({ me: { life: 20, bf: [B, B, B], hand: ['doomsday'], lib: ['sol-ring', 'thassas-oracle', U, B, 'fabricate', 'mox-opal', 'skullclamp'], grave: ['dark-ritual'] } });
  s = cast(s, 'doomsday'); s = answer(s, ['auto']);
  const picks = ['thassas-oracle', 'dark-ritual', 'sol-ring', 'fabricate', 'mox-opal'];
  s = resolveAll(s, ...picks.map(id => (q, st) => viewId(q, st, id)), ...picks.slice(0, 4).map(id => (q, st) => viewId(q, st, id)));
  eq(lib(s, 0), picks);
  eq(s.players[0].life, 10);
  ok(find(s, 'skullclamp', 'exile'), 'the rest exiled');
});
test('Animate Dead: the card returns under my control with the Aura attached, -1/-0; when the Aura leaves, it is sacrificed', () => {
  let s = setup({ me: { bf: [B, B], hand: ['animate-dead'] }, opp: { grave: ['consecrated-sphinx'] } });
  s = cast(s, 'animate-dead', (q, st) => viewId(q, st, 'consecrated-sphinx')); s = answer(s, ['auto']); s = resolveAll(s);
  const sph = find(s, 'consecrated-sphinx', 'bf', 0), ad = find(s, 'animate-dead', 'bf');
  eq(s.cards[ad].att, sph); eq(pt(s, sph), [3, 6]);
  s = MF.clone(s); MF.destroy(s, ad, 'test'); s = MF.run(s); s = resolveAll(s);
  ok(find(s, 'consecrated-sphinx', 'grave', 1), 'sacrificed, to its owner\'s graveyard');
});
test('Reanimate: any graveyard, and I lose life equal to its mana value', () => {
  let s = setup({ me: { bf: [B], hand: ['reanimate'] }, opp: { grave: ['consecrated-sphinx'] } });
  s = cast(s, 'reanimate', (q, st) => viewId(q, st, 'consecrated-sphinx')); s = answer(s, ['auto']); s = resolveAll(s);
  ok(find(s, 'consecrated-sphinx', 'bf', 0)); eq(s.players[0].life, 14);
});
test('Dread Return: flashback by sacrificing three creatures (CR 702.34a), then exiled', () => {
  let s = setup({ me: { bf: ['narcomoeba', 'ruin-crab', 'hedron-crab'], grave: ['dread-return', 'consecrated-sphinx'] } });
  s = act(s, 'cast', 'dread-return', { via: 'flashback' });
  s = answer(s, [(q, st) => viewId(q, st, 'consecrated-sphinx'), (q, st) => viewId(q, st, 'narcomoeba'), (q, st) => viewId(q, st, 'ruin-crab'), (q, st) => viewId(q, st, 'hedron-crab')]);
  s = resolveAll(s);
  ok(find(s, 'consecrated-sphinx', 'bf')); ok(find(s, 'dread-return', 'exile'));
});
test('Yawgmoth\'s Will: lands and spells from my graveyard this turn; cards going to my graveyard are exiled instead (itself too)', () => {
  let s = setup({ me: { bf: [B, B, B, B], hand: ['yawgmoths-will'], grave: ['dark-ritual', U] } });
  s = cast(s, 'yawgmoths-will'); s = answer(s, ['auto']); s = resolveAll(s);
  ok(find(s, 'yawgmoths-will', 'exile'), 'it exiled itself');
  s = play(s, 'island'); s = act(s, 'cast', 'dark-ritual'); s = answer(s, ['auto']); s = resolveAll(s);
  ok(find(s, 'dark-ritual', 'exile'), 'exiled instead of the graveyard');
});
test('Mnemonic Betrayal: cast an opponent\'s exiled card with any mana; the rest return at the next end step', () => {
  let s = setup({ me: { bf: [U, B, B, B, B], hand: ['mnemonic-betrayal'] }, opp: { grave: ['dark-ritual', 'sol-ring'] } });
  s = cast(s, 'mnemonic-betrayal'); s = answer(s, ['auto']); s = resolveAll(s);
  ok(find(s, 'mnemonic-betrayal', 'exile'), 'it exiles itself');
  s = act(s, 'cast', 'sol-ring'); s = answer(s, ['auto']); s = resolveAll(s);
  ok(find(s, 'sol-ring', 'bf', 0), 'cast, under my control');
  s = toStep(s, 'end'); s = resolveAll(s);
  ok(find(s, 'dark-ritual', 'grave', 1), 'returned to its owner\'s graveyard');
});
test('Necropotence: skip my draw step; pay 1 life: a card face down, into my hand at my next end step', () => {
  let s = setup({ me: { bf: ['necropotence'], lib: ['sol-ring', U, U, U] } });
  s = activate(s, 'necropotence'); s = resolveAll(s);
  eq(s.players[0].life, 19); ok(s.cards[find(s, 'sol-ring', 'exile')].faceDown, 'face down');
  s = toStep(s, 'end'); s = resolveAll(s);
  ok(s.players[0].hand.some(i => s.cards[i].id === 'sol-ring'), 'into my hand');
  s = toStep(s, 'upkeep'); s = MF.clone(s); s.ap = 0; s.turn++; s.step = 'upkeep'; s.sub = 0; s.priority = null; s = MF.run(s);
  s = toStep(s, 'main1');
  ok(logs(s, 'skipStep').some(e => e.step === 'draw' && e.who === 0), 'my draw step was skipped');
});

// ---- Creatures -------------------------------------------------------------------------------
test('Painter\'s Servant + Grindstone: every card is the chosen colour, so Grindstone repeats until the library is gone', () => {
  let s = setup({ me: { hand: ['painters-servant'], bf: ['grindstone', U, U, U, U, U] }, opp: { lib: Array(12).fill(U).concat(['sol-ring', 'ancient-tomb']) } });
  s = cast(s, 'painters-servant'); s = answer(s, ['auto']); s = resolveAll(s, 'B');
  ok(MF.chars(s, s.players[1].lib[0]).colors.includes('B'), 'a card in a library is black');
  s = activate(s, 'grindstone', null, player(1)); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[1].lib.length, 0, 'milled out');
});
test('Phenax: not a creature below seven devotion to blue and black; its creatures mill X (X = toughness)', () => {
  let s = setup({ me: { bf: ['phenax-god-of-deception', 'consuming-aberration'] }, opp: { lib: Array(20).fill(U), grave: [U, U, U] } });
  ok(!MF.chars(s, find(s, 'phenax-god-of-deception')).types.includes('Creature'), 'devotion 4');
  s = activate(s, 'consuming-aberration', null, player(1)); s = resolveAll(s);
  eq(s.players[1].grave.length, 6, 'toughness 3 (three cards in their graveyard)');
  s = setup({ me: { bf: ['phenax-god-of-deception', 'consuming-aberration', 'thassas-oracle', 'narcomoeba'] }, opp: { grave: [U] } });
  ok(MF.chars(s, find(s, 'phenax-god-of-deception')).types.includes('Creature'), 'devotion 7');
});
test('Raul: once during each of my turns, cast a spell from among cards milled this turn', () => {
  let s = setup({ me: { bf: ['raul-trouble-shooter', B, B], lib: ['dark-ritual', 'dark-ritual', U] } });
  s = act(s, 'act', 'raul-trouble-shooter'); s = resolveAll(s);
  s = act(s, 'cast', 'dark-ritual', { via: 'raul' }); s = answer(s, ['auto']); s = resolveAll(s);
  ok(!MF.legalActions(s).some(a => a.type === 'cast' && a.via === 'raul'), 'only once each turn');
});
test('Emry: affinity for artifacts; {T}: I may cast target artifact card in my graveyard this turn', () => {
  let s = setup({ me: { bf: [{ id: 'emry-lurker-of-the-loch' }, U], grave: ['sol-ring'] } });
  s = activate(s, 'emry-lurker-of-the-loch', null, (q, st) => viewId(q, st, 'sol-ring')); s = resolveAll(s);
  s = act(s, 'cast', 'sol-ring'); s = answer(s, ['auto']); s = resolveAll(s);
  ok(find(s, 'sol-ring', 'bf'));
});
test('Hullbreaker Horror: whenever I cast a spell, up to one mode — bounce a spell I don\'t control, or a nonland permanent', () => {
  let s = setup({ me: { bf: ['hullbreaker-horror', B], hand: ['dark-ritual'] }, opp: { bf: ['sol-ring'] } });
  s = cast(s, 'dark-ritual');
  eq(s.pending.q.opts.map(o => o.id), [1, 'none'], 'no spell of theirs: only the permanent mode, or none');
  s = answer(s, [1, (q, st) => viewId(q, st, 'sol-ring')]); s = resolveAll(s);
  ok(s.players[1].hand.some(i => s.cards[i].id === 'sol-ring'), 'bounced');
});
test('Braids: sacrifice at my end step; the opponent sacrifices one that shares a type or loses 2 life and I draw', () => {
  let s = setup({ step: 'main2', me: { bf: ['braids-arisen-nightmare', 'sol-ring'] }, opp: { bf: [U] } });
  s = toStep(s, 'end', (q, st) => viewId(q, st, 'sol-ring')); s = resolveAll(s, (q, st) => viewId(q, st, 'sol-ring'));
  eq(s.players[1].life, 18); eq(s.players[0].hand.length, 1);
});
test('Captain N\'ghathrod: Horrors have menace; at my end step, a creature card put into the opponent\'s graveyard from their library this turn comes to me', () => {
  let s = setup({ step: 'main2', me: { bf: ['captain-nghathrod', 'zellix-sanity-flayer', U] }, opp: { lib: ['consecrated-sphinx', U, U] } });
  ok(has(s, find(s, 'zellix-sanity-flayer'), 'menace'));
  s = activate(s, 'zellix-sanity-flayer', 1, player(1)); s = resolveAll(s);
  s = toStep(s, 'end'); eq(s.pending.q.opts.filter(o => o.iid != null).length, 1, 'only the card put there from the library this turn');
  s = resolveAll(s, (q, st) => viewId(q, st, 'consecrated-sphinx'));
  ok(find(s, 'consecrated-sphinx', 'bf', 0), 'stolen');
});
test('Consuming Aberration: whenever I cast a spell, the opponent reveals until a land and puts them all into the graveyard', () => {
  let s = setup({ me: { bf: ['consuming-aberration', B], hand: ['dark-ritual'] }, opp: { lib: ['sol-ring', 'dark-ritual', U, U], grave: [B] } });
  s = cast(s, 'dark-ritual'); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[1].grave.length, 4); eq(pt(s, find(s, 'consuming-aberration')), [4, 4], 'a CDA: the cards in my opponent\'s graveyard');
});
test('Syr Konrad: a creature card milled, a creature dying, a creature card leaving my graveyard — 1 damage each', () => {
  let s = setup({ me: { bf: ['syr-konrad-the-grim', B, B], grave: ['narcomoeba'] }, opp: { lib: ['consecrated-sphinx', 'aphetto-alchemist', U] } });
  s = activate(s, 'syr-konrad-the-grim'); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[1].life, 19, 'the Sphinx put into a graveyard from the library');
});
test('Undead Alchemist: an opponent\'s creature card milled is exiled and becomes a Zombie; Zombies\' combat damage mills instead', () => {
  let s = setup({ me: { bf: ['undead-alchemist', 'zellix-sanity-flayer', U] }, opp: { lib: ['consecrated-sphinx', U, U, U, U, U, U, U] } });
  s = activate(s, 'zellix-sanity-flayer', 1, player(1)); s = resolveAll(s, 0);
  ok(find(s, 'consecrated-sphinx', 'exile'), 'exiled'); eq(findAll(s, 'token-zombie-2-2-b', 'bf').length, 1);
});
test('Unctus: my other blue creatures loot when they become tapped; {U/P}: a creature becomes a blue artifact', () => {
  let s = setup({ me: { bf: ['unctus-grand-metatect', 'zellix-sanity-flayer', U], hand: [B], lib: [U, U, U] } });
  s = activate(s, 'zellix-sanity-flayer', 1, player(1)); s = answer(s, ['auto']);
  eq(s.stack.length, 2, 'the loot trigger is on the stack above Zellix\'s ability');
});
test('Duskmantle Guildmage: this turn, whenever a card goes to an opponent\'s graveyard, they lose 1 life', () => {
  let s = setup({ me: { bf: ['duskmantle-guildmage', U, U, B, U, U, B, B] }, opp: { lib: Array(5).fill(U) } });
  s = activate(s, 'duskmantle-guildmage', 0); s = answer(s, ['auto']); s = resolveAll(s);
  s = activate(s, 'duskmantle-guildmage', 1, player(1)); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[1].life, 18);
});
test('Eater of the Dead: {0}: if tapped, exile a creature card from a graveyard and untap', () => {
  let s = setup({ me: { bf: [{ id: 'eater-of-the-dead', tapped: true }] }, opp: { grave: ['consecrated-sphinx'] } });
  s = activate(s, 'eater-of-the-dead', null, (q, st) => viewId(q, st, 'consecrated-sphinx')); s = resolveAll(s);
  ok(find(s, 'consecrated-sphinx', 'exile')); ok(!s.cards[find(s, 'eater-of-the-dead')].tapped);
});
test('Guiltfeeder: fear; attacking unblocked, the defending player loses 1 life for each card in their graveyard', () => {
  let s = setup({ me: { bf: ['guiltfeeder'] }, opp: { grave: [U, U, U], bf: ['ruin-crab'] } });
  ok(!MF.canBlock(s, find(s, 'ruin-crab'), find(s, 'guiltfeeder')), 'a blue creature can\'t block it');
  s = toStep(s, 'attackers'); s = answer(s, [(q, st) => viewId(q, st, 'guiltfeeder'), 'done']);
  s = toStep(s, 'main2');
  eq(s.players[1].life, 17, 'a 0/4: no combat damage, and 1 for each of the three cards in their graveyard');
});
test('Manic Scribe: delirium — at each opponent\'s upkeep, they mill three', () => {
  let s = setup({ me: { bf: ['manic-scribe'], grave: ['sol-ring', U, 'dark-ritual', 'doomsday', 'narcomoeba'] }, opp: { lib: Array(10).fill(U) } });
  s = oppTurn(s); s = MF.clone(s); s.step = 'upkeep'; s.sub = 0; s.priority = null; s = MF.run(s); s = resolveAll(s);
  eq(s.players[1].grave.length, 3);
});
test('Consecrated Sphinx: whenever an opponent draws, I may draw two', () => {
  let s = setup({ me: { bf: ['consecrated-sphinx'], lib: [U, U, U] }, opp: { lib: [U, U] } });
  s = MF.clone(s); MF.draw(s, 1, 1); s = MF.run(s); s = resolveAll(s, 'yes');
  eq(s.players[0].hand.length, 2);
});
test('Aphetto Alchemist: morph — cast face down for {3} as a nameless 2/2; turn face up for {U}; {T}: untap an artifact or creature', () => {
  let s = setup({ me: { hand: ['aphetto-alchemist'], bf: [U, U, U, U] } });
  s = act(s, 'cast', 'aphetto-alchemist', { via: 'morph' }); s = answer(s, ['auto']); s = resolveAll(s);
  const a = find(s, 'aphetto-alchemist', 'bf'); const ch = MF.chars(s, a);
  eq([ch.name, ch.p, ch.t, ch.ab.length], ['', 2, 2, 0]);
  s = MF.apply(s, { type: 'turnUp', iid: a }); s = answer(s, ['auto']);
  eq(MF.chars(s, a).name, 'Aphetto Alchemist');
});

// ---- Spells ----------------------------------------------------------------------------------
test('Demonic Tutor, Vampiric Tutor, Mystical Tutor, Imperial Seal, Fabricate, Diabolic Intent', () => {
  let s = setup({ me: { bf: [B, B, U, U, 'narcomoeba'], hand: ['vampiric-tutor', 'diabolic-intent'], lib: [U, 'sol-ring', 'doomsday', B] } });
  s = cast(s, 'vampiric-tutor'); s = answer(s, ['auto']); s = resolveAll(s, (q, st) => viewId(q, st, 'doomsday'));
  eq(lib(s, 0)[0], 'doomsday'); eq(s.players[0].life, 18);
  s = cast(s, 'diabolic-intent', (q, st) => viewId(q, st, 'narcomoeba')); s = answer(s, ['auto']); s = resolveAll(s, (q, st) => viewId(q, st, 'sol-ring'));
  ok(s.players[0].hand.some(i => s.cards[i].id === 'sol-ring')); ok(find(s, 'narcomoeba', 'grave'));
});
test('Mind Grind: X can\'t be 0; each opponent reveals until X lands and puts them all into the graveyard', () => {
  let s = setup({ me: { bf: [U, B, B, B], hand: ['mind-grind'] }, opp: { lib: ['sol-ring', U, 'dark-ritual', U, U] } });
  s = cast(s, 'mind-grind'); eq(s.pending.q.opts[0].id, 1, 'X starts at 1');
  s = answer(s, [2, 'auto']); s = resolveAll(s);
  eq(s.players[1].grave.length, 4);
});
test('Tasha\'s Hideous Laughter: exile from the top until total mana value 20 or more', () => {
  let s = setup({ me: { bf: [U, U, U], hand: ['tashas-hideous-laughter'] }, opp: { lib: Array(5).fill('consecrated-sphinx').concat([U]) } });
  s = cast(s, 'tashas-hideous-laughter'); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[1].exile.length, 4, '6 + 6 + 6 + 6 = 24');
});
test('Maddening Cacophony: kicked, each opponent mills half their library, rounded up', () => {
  let s = setup({ me: { bf: Array(6).fill(U).concat([B]), hand: ['maddening-cacophony'] }, opp: { lib: Array(9).fill(U) } });
  s = cast(s, 'maddening-cacophony', 'yes'); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[1].grave.length, 5);
});
test('Fractured Sanity: cycling it makes each opponent mill four (CR 702.29d) before the draw', () => {
  let s = setup({ me: { bf: [U, U], hand: ['fractured-sanity'], lib: [U] }, opp: { lib: Array(10).fill(U) } });
  s = act(s, 'act', 'fractured-sanity'); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[1].grave.length, 4); eq(s.players[0].hand.length, 1);
});
test('Unearth: a creature card with mana value 3 or less from my graveyard to the battlefield', () => {
  let s = setup({ me: { bf: [B], hand: ['unearth'], grave: ['narcomoeba', 'consecrated-sphinx'] } });
  s = cast(s, 'unearth'); eq(s.pending.q.opts.filter(o => o.iid != null).length, 1, 'not the Sphinx');
});

// ---- Artifacts, enchantments, lands -------------------------------------------------------------
test('Altar of Dementia: sacrifice a creature — target player mills cards equal to its power', () => {
  let s = setup({ me: { bf: ['altar-of-dementia', 'consecrated-sphinx'] }, opp: { lib: Array(10).fill(U) } });
  s = activate(s, 'altar-of-dementia', null, player(1), (q, st) => viewId(q, st, 'consecrated-sphinx')); s = resolveAll(s);
  eq(s.players[1].grave.length, 4);
});
test('Altar of the Brood and Skullclamp', () => {
  let s = setup({ me: { bf: ['altar-of-the-brood', 'skullclamp', 'narcomoeba', B], hand: ['dark-ritual'], lib: [U, U] }, opp: { lib: Array(5).fill(U) } });
  s = activate(s, 'skullclamp', null, (q, st) => viewId(q, st, 'narcomoeba')); s = answer(s, ['auto']); s = resolveAll(s);
  s = resolveAll(s);
  eq(s.players[0].hand.length, 3, 'Narcomoeba died (1/0): two cards');
});
test('Riverchurn Monument: exhaust — each mills its graveyard\'s size; only once', () => {
  let s = setup({ me: { bf: ['riverchurn-monument', U, U, U, U] }, opp: { lib: Array(10).fill(U), grave: [U, U, U] } });
  s = activate(s, 'riverchurn-monument', 1, player(1), 'done'); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[1].grave.length, 6);
  ok(!MF.legalActions(s).some(a => a.type === 'act' && a.ab === 1), 'exhausted');
});
test('Mystic Remora: cumulative upkeep {1}; an opponent\'s noncreature spell draws me a card unless they pay {4}', () => {
  let s = setup({ me: { bf: ['mystic-remora'], lib: [U, U] }, opp: { hand: ['dark-ritual'], bf: [B] } });
  s = oppTurn(s); s = cast(s, 'dark-ritual'); s = answer(s, ['auto']);
  s = resolveAll(s, 'yes');
  eq(s.players[0].hand.length, 1);
});
test('Rhystic Study: the caster may pay {1}; if they do, no card', () => {
  let s = setup({ me: { bf: ['rhystic-study'], lib: [U, U] }, opp: { hand: ['dark-ritual'], bf: [B, B] } });
  s = oppTurn(s); s = cast(s, 'dark-ritual'); s = answer(s, ['auto']);
  s = resolveAll(s, 'pay', 'auto');
  eq(s.players[0].hand.length, 0);
});
test('Bloodchief Ascension: three quest counters — a card into an opponent\'s graveyard drains 2', () => {
  let s = setup({ me: { bf: [{ id: 'bloodchief-ascension', ctr: { quest: 3 } }, 'zellix-sanity-flayer', U] }, opp: { lib: Array(5).fill(U) } });
  s = activate(s, 'zellix-sanity-flayer', 1, player(1)); s = resolveAll(s, 'yes', 'yes', 'yes');
  eq(s.players[1].life, 14); eq(s.players[0].life, 26);
});
test('Memory Erosion and Mesmeric Orb', () => {
  let s = setup({ me: { bf: ['memory-erosion', 'mesmeric-orb'] }, opp: { hand: ['dark-ritual'], bf: [B], lib: Array(10).fill(U) } });
  s = oppTurn(s); s = cast(s, 'dark-ritual'); s = answer(s, ['auto']); s = resolveAll(s);
  eq(s.players[1].grave.length, 3, 'two, and the Ritual');
});
test('Polluted Cistern // Dim Oubliette: cards milled into my graveyard drain per card type; unlocking the other door reanimates', () => {
  let s = setup({ me: { bf: [{ id: 'polluted-cistern-dim-oubliette' }, 'zellix-sanity-flayer', U], lib: ['sol-ring', 'dark-ritual', 'narcomoeba', U] } });
  s = MF.clone(s); s.cards[find(s, 'polluted-cistern-dim-oubliette')].unlocked = [true, false]; s = MF.run(s);
  s = activate(s, 'zellix-sanity-flayer', 1, player(0)); s = resolveAll(s, 0, 0, 'no');
  eq(s.players[1].life, 17, 'artifact, instant, creature');
});
test('Urza\'s Saga: I — {C}; II — Constructs; III — an artifact with mana cost {0} or {1} onto the battlefield', () => {
  let s = setup({ me: { hand: ['urzas-saga'], lib: ['mox-opal', 'mesmeric-orb', U] } });
  s = play(s, 'urzas-saga'); s = resolveAll(s);
  ok(MF.manaSources(s, 0, { any: true }).some(m => m.id === 'urzas-saga'), 'it gained {T}: Add {C}');
  s = MF.clone(s); s.cards[find(s, 'urzas-saga')].ctr.lore = 2; MF.emit(s, { t: 'lore', iid: find(s, 'urzas-saga'), before: 1, after: 3 }); s = MF.run(s);
  s = resolveAll(s, 0, (q, st) => viewId(q, st, 'mox-opal'));
  ok(find(s, 'mox-opal', 'bf'), 'found it');
});
test('Polluted Delta: pay 1 life, sacrifice: an Island or Swamp card, basic or not', () => {
  let s = setup({ me: { bf: ['polluted-delta'], lib: ['underground-sea', U] } });
  s = activate(s, 'polluted-delta'); s = resolveAll(s, (q, st) => viewId(q, st, 'underground-sea'));
  ok(find(s, 'underground-sea', 'bf')); eq(s.players[0].life, 19);
});
test('Academy Ruins and Codex Shredder', () => {
  let s = setup({ me: { bf: ['academy-ruins', 'codex-shredder', U, U, U, U, U, U], grave: ['sol-ring'] } });
  s = activate(s, 'academy-ruins', 1, (q, st) => viewId(q, st, 'sol-ring')); s = answer(s, ['auto']); s = resolveAll(s);
  eq(lib(s, 0)[0], 'sol-ring');
});
test('Morphic Pool enters tapped in a two-player game', () => {
  let s = setup({ me: { hand: ['morphic-pool'] } });
  s = play(s, 'morphic-pool'); ok(s.cards[find(s, 'morphic-pool')].tapped);
});
test('Captain N\'ghathrod: only a Horror\'s combat damage mills (regression: any creature of mine once did)', () => {
  let s = setup({ me: { bf: ['captain-nghathrod', 'guiltfeeder', 'zellix-sanity-flayer'] }, opp: { lib: Array(20).fill(U) } });
  s = toStep(s, 'attackers'); s = answer(s, [(q, st) => viewId(q, st, 'zellix-sanity-flayer'), (q, st) => viewId(q, st, 'guiltfeeder'), 'done']);
  s = toStep(s, 'main2', 'done');
  eq(s.players[1].grave.length, 2, 'Zellix (a Horror) dealt 2 and milled 2; Guiltfeeder (a Horror, 0 power) dealt none');
});
test('Morph history: a permanent entering face down, or one turned face up, is remembered for the turn (Oblivious Bookworm reads it)', () => {
  let s = setup({ me: { hand: ['aphetto-alchemist'], bf: [U, U, U, U] } });
  ok(!MF.cond({ s: s, ctrl: 0, src: null, flags: {} }, { c: 'faceDownThisTurn' }), 'nothing yet');
  s = act(s, 'cast', 'aphetto-alchemist', { via: 'morph' }); s = answer(s, ['auto']); s = resolveAll(s);
  ok(MF.cond({ s: s, ctrl: 0, src: null, flags: {} }, { c: 'faceDownThisTurn' }), 'it entered face down');
  eq(logs(s, 'castFaceDown').length, 1); ok(!logs(s, 'cast').some(e => e.c === 'aphetto-alchemist'), 'the cast is logged without its name');
});
test('CR 733: a mana ability at priority whose own cost can\'t be completed is reversed (Sunken Ruins: its only blue source tapped for {C})', () => {
  let s = setup({ me: { bf: ['sunken-ruins', 'talisman-of-dominance'] } });
  s = act(s, 'mana', 'sunken-ruins', { ab: 1 });
  s = MF.apply(s, { type: 'answer', id: 'UB' }); s = MF.apply(s, { type: 'answer', id: 'U' });
  eq(s.pending.q.kind, 'pay'); ok(!s.pending.q.opts.some(o => o.iid === find(s, 'sunken-ruins')), 'it doesn\'t pay its own cost');
  s = MF.apply(s, { type: 'answer', id: s.pending.q.opts.find(o => o.col === 'C').id });
  ok(!s.pending && s.priority === 0, 'back to priority'); ok(logs(s, 'undone').length >= 1, 'the action was reversed');
  eq(s.players[0].pool, { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
});
test('Captain N\'ghathrod: combat damage to a blocking creature mills nothing — only damage to a player (regression)', () => {
  let s = setup({ me: { bf: ['captain-nghathrod', 'zellix-sanity-flayer'] }, opp: { bf: ['hedron-crab', 'ruin-crab'], lib: Array(20).fill(U) } });
  s = toStep(s, 'attackers'); s = answer(s, [(q, st) => viewId(q, st, 'zellix-sanity-flayer'), 'done']);
  s = toStep(s, 'main2', (q, st) => q.opts.find(o => o.iid != null).id, (q, st) => q.opts.find(o => o.iid != null).id, 'done', q => q.opts[0].id);   // both Crabs block (menace)
  eq(s.players[1].lib.length, 20, 'Zellix\'s combat damage went to the Crabs: nothing milled');
});
test('Deals-damage triggers keep their "to a player" and "combat" conditions (regression: a stray comment once dropped them for every deck)', () => {
  const ab = { k: 'trig', on: 'dealsDamage', who: 'self', combat: true, toPlayer: true };
  const ev = (to, combat) => ({ t: 'dealsDamage', src: 7, srcCtrl: 0, srcTypes: ['Creature'], srcSubtypes: [], to: to, n: 2, combat: combat });
  const s = setup({});
  ok(MF.trigMatch(s, 7, { ctrl: 0 }, ab, ev({ p: 1 }, true)), 'combat damage to a player');
  ok(!MF.trigMatch(s, 7, { ctrl: 0 }, ab, ev({ c: 99 }, true)), 'not to a creature');
  ok(!MF.trigMatch(s, 7, { ctrl: 0 }, ab, ev({ p: 1 }, false)), 'not noncombat damage');
});
