// What the engine will do with a compiled card, in words. tools/audit-cards.mjs diffs this
// against the Oracle text; the interface shows it under "What the engine reads". Every op needs
// a describer here or MF.validate refuses to load.
(function () {
  'use strict';
  const MF = window.MF;
  const KWNAME = { flying: 'flying', reach: 'reach', firstStrike: 'first strike', doubleStrike: 'double strike', deathtouch: 'deathtouch', lifelink: 'lifelink', trample: 'trample', vigilance: 'vigilance', haste: 'haste', menace: 'menace', defender: 'defender', flash: 'flash', hexproof: 'hexproof', indestructible: 'indestructible', prowess: 'prowess', shroud: 'shroud' };
  MF.KWNAME = KWNAME;
  const VN = { halfX: 'half X, rounded down', oppsLostLife: 'the number of opponents who lost life this turn', oppExiledCreatures: 'the number of creatures exiled under your opponents’ control this turn', gainedThisTurn: 'the life you gained this turn', countOthers: 'the number of other matching permanents you control' };
  const N = n => typeof n === 'number' ? String(n) : VN[n.v] ? VN[n.v] : n.v === 'x' ? 'X' : n.v === 'creatures' ? 'the number of creatures you control' : n.v === 'lands' ? 'the number of lands you control' : n.v === 'graveCount' ? 'the number of permanent cards in your graveyard' : n.v === 'creLeftYou' ? 'the number of creatures that left the battlefield under your control this turn' : n.v === 'countYou' ? 'the number of ' + filt(n.f) + 's you control' : n.v === 'power' ? 'its power' : n.v === 'castNoncreature' ? 'the number of noncreature spells that player has cast this turn' : n.v === 'evAmount' ? 'that much' : n.v === 'kicked' ? n.no + ' (' + n.yes + ' if kicked)' : '?';
  function filt(f) {
    if (!f) return 'anything';
    if (f.any) return 'any target';
    if (f.card) return (f.notSubtypes ? 'non-' + f.notSubtypes.join('/') + ' ' : '') + (f.types ? f.types.join(' or ').toLowerCase() + ' ' : '') + (f.mvGE != null ? '[mana value ' + f.mvGE + ' or greater] ' : '') + 'card' + (f.mvLEv ? ' with mana value X or less (X = the life you gained this turn)' : f.mvLE != null ? ' with mana value ' + f.mvLE + ' or less' : '') + ' from ' + (f.own ? 'your graveyard' : 'a graveyard');
    if (f.ability) return 'activated or triggered ability';
    if (f.spell && f.mvIs != null) return 'spell with mana value ' + f.mvIs;
    if (f.spell) return (f.notTypes ? f.notTypes.map(x => 'non' + x.toLowerCase()).join(' ') + ' ' : '') + 'spell';
    if (f.player) return f.player === 'opp' ? 'opponent' : f.player === 'you' ? 'you' : 'player';
    const w = [];
    if (f.other) w.push('other');
    if (f.allTypes) return w.concat([f.allTypes.join(' ').toLowerCase()]).join(' ') + (f.ctrl === 'you' ? ' you control' : '');
    if (f.typesOrSub) w.push(f.typesOrSub.types.join('/').toLowerCase() + ' or ' + f.typesOrSub.subtypes.join('/'));
    if (f.notTypes) w.push('non' + f.notTypes.join('/').toLowerCase());
    if (f.supers) w.push(f.supers.join(' ').toLowerCase()); if (f.notSupers) w.push('non' + f.notSupers.join('').toLowerCase());
    w.push(f.subtypes ? f.subtypes.join('/') + (f.types && !f.types.includes('Creature') ? ' ' + f.types.join('/').toLowerCase() : '') : f.types ? f.types.join('/').toLowerCase() : f.tok ? 'token' : 'permanent');   // "Lizard, Mouse, Otter, or Raccoon you control"
    if (f.ctrl === 'you') w.push('you control'); if (f.ctrl === 'opp') w.push('an opponent controls');
    if (f.powLE != null) w.push('with power ' + f.powLE + ' or less');
    if (f.powGE != null) w.push('with power ' + f.powGE + ' or greater');
    if (f.ptGE != null) w.push('with power or toughness ' + f.ptGE + ' or greater');
    if (f.touGtPow) w.push('with toughness greater than its power');
    if (f.counter) w.push('with a ' + f.counter + ' counter');
    if (f.mvLE != null && !f.card) w.push('with mana value ' + f.mvLE + ' or less');
    if (f.mvLEv) w.push('with mana value less than or equal to ' + N(f.mvLEv));
    if (f.kw) w.push('with ' + KWNAME[f.kw]); if (f.notKw) w.push('without ' + KWNAME[f.notKw]);
    if (f.tokOrSub) w.push('that is a token or a ' + f.tokOrSub);
    if (f.attacking) w.push('attacking');
    if (f.notSubtypes) w.unshift(f.notSubtypes.length === 5 ? 'non-outlaw' : 'non-' + f.notSubtypes.join('/'));
    if (f.tok && f.types) w.push('token');
    if (f.mvLE != null) w.push('with mana value ' + f.mvLE + ' or less');
    if (f.ptSumLE != null) w.push('with total power and toughness ' + f.ptSumLE + ' or less');
    return w.join(' ');
  }
  MF.describeFilter = filt;
  let curTg = [], named = new Set();
  function ref(r) {
    if (r === 'self') return 'this';
    if (r === 'enchanted') return 'the enchanted creature';
    if (r === 'equipped') return 'the equipped creature';
    if (r === 'ev') return 'that creature';
    if (r === 'it') return 'that card';
    if (r === 'eachOpp') return 'each opponent';
    if (r === 'you') return 'you';
    if (r === 'evPlayer') return 'that player';
    if (r.t != null && named.has(r.t)) return 'it [' + (r.t + 1) + ']';
    if (r.t != null) named.add(r.t);
    if (r.t != null) { const sl = curTg[r.t] || {}; return (sl.upTo ? 'up to ' + sl.n + ' ' : '') + (sl.f && sl.f.any ? 'any target' : 'target ' + filt(sl.f)) + ' [' + (r.t + 1) + ']'; }
    if (r.each && r.each.ctrlOfT != null) return 'each creature target player [' + (r.each.ctrlOfT + 1) + '] controls';
    if (r.each) return 'each ' + filt(r.each);
    return JSON.stringify(r);
  }
  const C = {
    control: c => 'you control ' + (c.n > 1 ? c.n + ' or more ' + filt(c.f) : (/^[aeiou]/i.test(filt(c.f)) ? 'an ' : 'a ') + filt(c.f)),
    totalPower: c => 'creatures you control have total power ' + c.n + ' or greater',
    did: () => 'you did',
    enteredOther: () => 'another creature entered the battlefield under your control this turn',
    offspringPaid: () => 'its offspring cost was paid',
    firstOfKind: () => 'that spell is your first instant, first sorcery, or first Otter spell other than this this turn',
    kicked: () => 'this spell was kicked',
    graveCount: c => 'there are ' + c.n + ' or more cards in your graveyard',
    oppLostLife: () => 'an opponent lost life this turn',
    controlAtMost: c => 'you control ' + (c.n === 2 ? 'two' : c.n) + ' or fewer ' + filt(c.f) + 's',
    earlyTurn: c => 'it is your first, second, or third turn of the game',
    enteredThisTurn: () => 'this land entered this turn',
    any: c => c.of.map(cond).join(' or '),
    graveTypes: c => 'there are ' + c.n + ' or more card types among cards in your graveyard',
    exiledWithTypes: c => 'there are ' + c.n + ' or more card types among cards exiled with this',
    lifeOverStart: c => c.n === 1 ? 'your life total is greater than your starting life total' : 'your life total is at least ' + c.n + ' greater than your starting life total',
    giftPromised: () => 'the gift was promised',
    noCounters: () => 'it had no counters on it',
    bargained: () => 'this spell was bargained',
    sneakPaid: () => 'this spell’s sneak cost was paid',
    gainedAtLeast: c => c.n === 1 ? 'you gained life this turn' : 'you’ve gained ' + c.n + ' or more life this turn',
    lostLifeThisTurn: () => 'you’ve lost life this turn',
    all: c => c.of.map(cond).join(' and '),
    evIs: c => 'it is a ' + filt(c.f),
    lkiType: c => 'it was a ' + c.type.toLowerCase(),
    selfPowerIs: c => 'its power is exactly ' + c.n,
    notSolved: () => 'this Case is not solved',
    descended: () => 'you descended this turn',
    castFromGrave: () => 'this spell was cast from a graveyard',
    targetsAttacking: () => 'it targets an attacking creature',
    anyGraveAtLeast: c => 'a graveyard has ' + c.n + ' or more cards in it',
    targetsTapped: () => 'it targets a tapped permanent',
    oppMore: c => 'an opponent ' + ({ lands: 'controls more lands', life: 'has more life', creatures: 'controls more creatures', hand: 'has more cards in hand' })[c.what] + ' than you',
    impendingTime: () => 'its impending cost was paid and it has a time counter on it',
    counterAtLeast: c => 'it has ' + (['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][c.n] || c.n) + ' or more ' + c.kind + ' counters on it',
    oppLifeLE: c => 'an opponent has ' + c.n + ' or less life',
    addCostPaid: () => 'this spell’s additional cost was paid',
    hasCounter: c => 'it has one or more ' + c.kind + ' counters',
    lifeAtMostHalfStart: () => 'your life total is less than or equal to half your starting life total',
    yourTurn: () => 'it is your turn',
  };
  const cond = c => (C[c.c] ? C[c.c](c) : c.c);
  MF.describeCond = cond;
  const D = MF.describeOp = {
    counter: op => 'put ' + (op.n && op.n.v === 'evAmount' ? 'that many' : N(op.n)) + ' ' + op.kind + ' counter' + (op.n === 1 ? '' : 's') + ' on ' + ref(op.on),
    doubleCounters: op => 'double the ' + op.kind + ' counters on ' + ref(op.on),
    tap: op => 'tap ' + ref(op.on),
    pump: op => { if (op.p && op.p.v === 'power') return 'double the power of ' + ref(op.on) + ' until end of turn'; if (op.until === 'yourNext') return 'until your next turn, ' + ref(op.on) + ' gets ' + sgn(op.p) + '/' + sgn(op.t); const pt = (op.p != null || op.t != null) && (op.p !== 0 || op.t !== 0); return ref(op.on) + (pt ? ' gets ' + sgn(op.p) + '/' + sgn(op.t) : '') + (op.grant ? (pt ? ' and' : '') + ' gains ' + op.grant.map(k => KWNAME[k]).join(', ') : '') + ' until end of turn'; },
    unblockable: op => ref(op.on) + ' can’t be blocked this turn',
    scry: op => 'scry ' + N(op.n),
    token: op => { const d = MF.cards[op.id], kws = Object.keys(d.kw); if (!d.types.includes('Creature')) return (op.forCtrlOf ? 'its controller [' + (op.forCtrlOf.t + 1) + '] creates ' : 'create ') + N(op.n) + ' ' + (op.tapped ? 'tapped ' : '') + d.name + ' token' + (op.n === 1 ? '' : 's') + (d.text ? ' (“' + d.text + '”)' : d.types.includes('Land') ? ' (a ' + d.types.join(' ').toLowerCase() + ' — ' + d.subtypes.join(' ') + ')' : ''); return (op.forCtrlOf ? 'its controller [' + (op.forCtrlOf.t + 1) + '] creates ' : 'create ') + N(op.n) + ' ' + d.power + '/' + d.toughness + ' ' + d.colors.map(c => MF.COLOR_NAME[c]).join(' and ') + ' ' + d.name + ' creature token' + (op.n === 1 ? '' : 's') + (kws.length ? ' with ' + kws.map(k => KWNAME[k]).join(', ') : '') + (d.text && !kws.length ? ' with “' + d.text + '”' : '') + (op.attacking ? ' that are tapped and attacking' : '') + (op.attackingIf ? '; if ' + cond(op.attackingIf) + ', they enter tapped and attacking' : '') + (op.sacEnd ? '; sacrifice them at the beginning of the next end step' : ''); },
    tokenCopy: op => 'create a token that’s a copy of ' + ref(op.of) + (op.except && op.except.pt ? ', except it is ' + op.except.pt.join('/') : ''),
    destroy: op => 'destroy ' + ref(op.on),
    damage: op => ref(op.from) + ' deals ' + N(op.n) + ' damage to ' + ref(op.to),
    draw: op => (op.who ? ref(op.who) + ' draws ' : 'draw ') + N(op.n) + ' card' + (op.n === 1 ? '' : 's'),
    discard: op => 'discard ' + op.n + ' card' + (op.n === 1 ? '' : 's') + ' of your choice',
    gain: op => (op.forCtrlOf ? 'its controller [' + (op.forCtrlOf.t + 1) + '] gains ' : 'gain ') + N(op.n) + ' life',
    becomeCreatureMV: op => ref(op.on) + ' becomes a creature in addition to its other types with base power and base toughness each equal to its mana value',
    exileGrave: op => 'exile ' + ref(op.who) + '’s graveyard',
    endTurn: () => 'end the turn (exile everything on the stack, including this; skip to the cleanup step)',
    lookTop: op => 'look at the top card of your library; if it is a ' + op.type.toLowerCase() + ', you may put it onto the battlefield tapped, otherwise put it into your hand',
    revealUntil: op => 'reveal from the top until a ' + op.type.toLowerCase() + '; put it onto the battlefield tapped, the rest on the bottom in a random order',
    impulse: op => 'exile the top card of your library; you may play it ' + (op.until === 'eot' ? 'until end of turn' : op.until === 'nextEndStep' ? 'until your next end step' : 'until the end of your next turn'),
    attach: op => 'attach this to ' + ref(op.on),
    may: op => 'you may: ' + ops(op.ops),
    if: op => 'if ' + cond(op.cond) + ': ' + ops(op.ops) + (op.else ? '; otherwise: ' + ops(op.else) : ''),
    loseLife: op => (op.who === 'you' ? 'you lose ' : ref(op.who) + ' loses ') + (op.half ? 'half their life, rounded up' : N(op.n) + ' life'),
    handPick: op => op.look ? 'look at ' + ref(op.who) + '’s hand; you may exile a nonland card from it until this leaves the battlefield' : ref(op.who) + ' reveals their hand; you choose a ' + (op.f.notTypes || []).map(x => 'non' + x.toLowerCase()).join(', ') + ' card from it; ' + (op.then === 'discard' ? 'that player discards it' : 'exile it' + (op.castIfGift ? '; if the gift was promised, you may cast it while it remains exiled, spending mana of any type' : '')),
    bounce: op => 'return ' + ref(op.on) + ' to its owner’s hand',
    graveToHand: op => 'return ' + ref(op.on) + ' to your hand',
    counterUnless: op => 'counter ' + ref(op.on) + ' unless its controller pays ' + op.pay + (op.payIf ? ' (' + op.payIf.pay + ' instead if this spell was cast using teamwork)' : '') + (op.exile ? '; if that spell is countered this way, exile it instead of putting it into its owner’s graveyard' : ''),
    lookPick: op => 'look at the top ' + op.n + ' cards of your library; put ' + op.take + ' of them into your hand and the rest on the bottom in any order',
    dieExile: () => 'if a permanent dealt damage by this would die this turn, exile it instead',
    mayPay: op => 'you may pay ' + (op.mana || op.life + ' life') + '; if you do: ' + ops(op.ops),
    tutor: () => 'search your library for a card, put it into your hand, shuffle',
    discardRandom: () => 'discard a card at random',
    selfFromGrave: () => 'return this card from your graveyard to the battlefield',
    removeCounter: op => 'remove ' + op.n + ' ' + op.kind + ' counter from this',
    earthbend: op => 'earthbend ' + op.n + ': ' + ref(op.on) + ' becomes a 0/0 creature with haste that’s still a land and gets ' + op.n + ' +1/+1 counters; when it dies or is exiled, return it to the battlefield tapped',
    returnLand: () => 'return that land to the battlefield tapped',
    exileTransformOnto: op => 'if this spell was cast from a graveyard, exile it, then put it onto the battlefield transformed with ' + Object.keys(op.ctr).map(k => 'a ' + k + ' counter').join(' and ') + ' on it',
    revealTopToHand: () => 'reveal the top card of your library; if it’s a permanent card, put it into your hand',
    addMana: op => 'add ' + ('{' + op.col + '}').repeat(op.n),
    exileUntilLeaves: op => 'exile ' + ref(op.on) + ' until this leaves the battlefield',
    tutorUpTo: op => 'search your library for up to ' + N(op.n) + ' ' + op.f.types.join(', ').toLowerCase() + ' cards with mana value ' + op.f.mvLE + ' or less, reveal them, put them into your hand, then shuffle',
    mayRemoveAnyCounter: op => 'you may remove a counter of any kind from this; when you do: ' + MF.describeAbility(Object.assign({}, op.then.ab, { k: 'reflexiveBody' })),
    mayOnce: op => 'you may (only once each turn): ' + ops(op.ops),
    addManaAny: () => 'add one mana of any color',
    becomeCreature: () => 'this becomes an artifact creature until end of turn',
    reflexive: op => 'when you do: ' + MF.describeAbility(Object.assign({}, op.ab, { k: 'reflexiveBody' })),
    counterTarget: op => 'counter ' + ref(op.on),
    counterAbility: op => 'counter ' + ref(op.on) + (op.loseWhile ? '; if it was an ability of an artifact, creature or planeswalker, that permanent loses all abilities for as long as this remains on the battlefield' : ''),
    shuffleIntoLib: op => 'shuffle this and ' + ref(op.on[1]) + ' into their owners’ libraries',
    transform: () => 'transform this',
    emblem: op => 'you get an emblem with “' + op.text + '”',
    choose: op => 'choose up to one ' + filt(op.f) + ' (not targeted)',
    chooseFromGrave: op => op.fs ? 'you may return ' + op.fs.map(f => 'a ' + (f.notSubtypes ? 'non-' + f.notSubtypes.join('/') + ' ' : '') + f.types.join('/').toLowerCase() + ' card').join(' or ') + ' from your graveyard to your hand' : 'return up to ' + op.n + ' ' + op.types.join('/').toLowerCase() + ' cards from your graveyard to your hand',
    discardOrFeed: op => 'up to one target opponent [' + (op.on.t + 1) + '] discards a card; if they didn’t discard a card with mana value ' + op.mvGE + ' or greater, draw a card',
    sacGreatestPower: () => 'each opponent sacrifices a creature with the greatest power among creatures they control',
    loseAbilities: op => op.whileSrc ? ref(op.on) + ' loses all abilities for as long as this remains on the battlefield' : ref(op.on) + ' loses all abilities until your next turn; if it is a creature, it has base power and toughness ' + op.basePT.join('/') + ' until your next turn',
    ninjutsuEnter: () => 'put this card onto the battlefield from your hand tapped and attacking',
    explore: () => 'this explores (reveal the top card: a land goes to your hand; otherwise a +1/+1 counter on this, and you may put the card into your graveyard)',
    moveCounters: op => 'put its counters on ' + ref(op.to),
    graveToBattlefield: op => 'return ' + ref(op.on) + ' to the battlefield' + (op.grantAb ? '; it gains “this creature attacks each combat if able” and “when this creature deals combat damage to a player, sacrifice it”' : ''),
    graveCastable: () => 'creature cards in your graveyard gain “You may cast this card from your graveyard” until end of turn',
    solve: () => 'this Case becomes solved',
    warpExile: () => 'exile it; its owner may cast it from exile on a later turn',
    wardCounter: op => 'counter that spell or ability unless its controller ' + (op.discard ? 'discards a card' : 'pays ' + (op.life != null ? op.life + ' life' : op.mana)),
    delayed: op => (op.on === 'attackWith' ? 'whenever you attack' : 'at ' + op.on) + (op.duration === 'turn' ? ' this turn' : '') + ': ' + ops(op.ops),
    sacThese: () => 'sacrifice them',
    sacrificeSelf: () => 'sacrifice this',
    nthResolution: op => op.branches.map((b, i) => ['the first', 'the second', 'the third'][i] + ' time this ability resolves this turn: ' + ops(b)).join('; '),
    levelUp: op => 'this Class becomes level ' + op.n,
    returnFromGrave: op => 'return it from the graveyard to the battlefield' + (op.tapped ? ' tapped' : '') + ' under its owner’s control' + (op.ctr ? ' with ' + Object.entries(op.ctr).map(([k, n]) => n + ' ' + k + ' counters').join(', ') + ' on it' : ''),
    copySpell: () => 'copy that spell; you may choose new targets for the copy',
    pumpChoice: op => ref(op.on) + ' gains your choice of ' + op.kws.map(k => KWNAME[k]).join(' or ') + ' until end of turn',
    animate: op => ref(op.on) + ' becomes a ' + op.p + '/' + op.t + ' creature with ' + op.kws.map(k => KWNAME[k]).join(', ') + (op.allTypes ? ' and all creature types' : '') + ', still a land',
    role: op => 'create a ' + op.role + ' Role token attached to ' + ref(op.on),
    discardUpTo: op => 'discard up to ' + op.n + ' cards, then draw that many',
    graveImpulse: () => 'exile a card at random from your graveyard; you may play it this turn',
    noLifeGain: op => 'a player dealt damage this way can’t gain life for the rest of the game',
    surveil: op => 'surveil ' + N(op.n),
    searchBasic: op => (op.whoT != null ? 'its controller may ' : '') + 'search ' + (op.whoT != null ? 'their' : 'your') + ' library for a basic land card, ' + (op.toHand ? 'reveal it, put it into your hand' : 'put it onto the battlefield' + (op.tapped ? ' tapped' : '')) + ', then shuffle',
    untapIt: () => 'untap that land',
    mill: op => (op.who ? ref(op.who) + ' mills ' : 'mill ') + (op.n && op.n.mult ? op.n.mult + ' times X' : N(op.n)) + ' card' + (op.n === 1 ? '' : 's'),
    reanimateAs: op => 'return ' + ref(op.on) + ' to the battlefield with X additional +1/+1 counters on it; it’s a ' + op.as.pt.join('/') + ' ' + op.as.subtypes.join(' ') + ' ' + op.as.types.join(' ').toLowerCase() + ' with ' + op.as.kw.join(', ') + ' in addition to its other types',
    shuffleGraveIntoLib: op => 'shuffle ' + ref(op.on) + ' into your library',
    flicker: op => 'exile ' + ref(op.on) + ', then return it to the battlefield under its owner’s control',
    pickMilled: op => 'you may put a ' + (op.type === 'noncreatureNonland' ? 'noncreature, nonland' : op.type) + ' card from among the milled cards into your hand' + (op.ifSub ? '; if it’s a ' + op.ifSub.sub + ' card, you gain ' + op.ifSub.gain + ' life' : '') + (op.elseOps ? '; if you don’t: ' + ops(op.elseOps) : ''),
    exile: op => 'exile ' + ref(op.on) + (op.link ? ' (linked: cards exiled with this)' : ''),
    dig: op => 'look at the top ' + op.n + ' cards; you may reveal a ' + op.type.toLowerCase() + ' card; if its mana value is ' + op.bfMvMax + ' or less you may put it onto the battlefield (it gains ' + (op.grant || []).map(k => KWNAME[k]).join(', ') + ' until end of turn), otherwise into your hand; the rest on the bottom in a random order',
    untap: op => 'untap ' + ref(op.on),
    extraCombat: () => 'after this phase, there is an additional combat phase',
    fight: op => ref(op.a) + ' fights ' + ref(op.b),
  };
  const sgn = v => v == null ? '+0' : typeof v === 'number' ? (v >= 0 ? '+' + v : String(v)) : '+' + N(v);
  function ops(list) { return (list || []).map(op => D[op.o](op)).join('; then '); }
  const EV = { enters: 'enters', attacks: 'attacks', cast: 'you cast', dealsDamage: 'deals damage', sacrificed: 'you sacrifice it', beginStep: 'at the beginning of', dies: 'dies', dealtDamage: 'is dealt damage', targeted: 'becomes the target of a spell or ability you control for the first time each turn' };
  const art = t => (/^[aeiou]/i.test(t) ? 'an ' : 'a ') + t;
  function who(w) { if (w === 'self') return 'this'; if (w && w.self) return 'this (if it is ' + filt(Object.assign({ types: ['Creature'] }, w.self)).replace(/^creature /, '') + ')'; if (w && w.or) return w.or.map(who).join(' or '); return art(filt(w)); }
  MF.describeAbility = function (a) {
    curTg = a.tg || []; named = new Set();
    if (a.solved) { const b = Object.assign({}, a); delete b.solved; return 'Solved — ' + MF.describeAbility(b); }   // CR 719.3c
    if (a.level > 1) { const b = Object.assign({}, a); delete b.level; return 'Level ' + a.level + ': ' + MF.describeAbility(b); }   // CR 716.2a
    switch (a.k) {
      case 'mana': if (a.combo) return a.cost.mana + ': add X mana in any combination of ' + a.cols.map(c => '{' + c + '}').join(' and/or ') + ', where X is this creature’s power (only during your turn, only once each turn)';
        return [a.cost.tap ? '{T}' : '', a.cost.life ? 'pay ' + a.cost.life + ' life' : ''].filter(Boolean).join(', ') + ': add ' + (a.cols.length === 5 ? 'one mana of any color' : a.cols.map(c => '{' + c + '}').join(' or ')) + (a.only === 'chosenType' ? ' (spend only on a creature spell of the chosen type; that spell can’t be countered)' : a.only ? ' (spend only on a creature spell)' : '') + (a.cond ? ' — only if ' + cond(a.cond) : '') + (a.selfDamage ? '; this deals ' + a.selfDamage + ' damage to you' : '');
      case 'etbPayOrTap': return 'as this enters, you may pay ' + a.life + ' life; if you don’t, it enters tapped';
      case 'act': if (a.loyalty === 'X') return '[−X]: ' + ops(a.ops) + ' (loyalty ability: X is chosen as you activate it)';
        if (a.loyalty != null) return '[' + (a.loyalty > 0 ? '+' + a.loyalty : a.loyalty === 0 ? '0' : '−' + (-a.loyalty)) + ']: ' + ops(a.ops) + ' (loyalty ability: once a turn, as a sorcery)';
        if (a.ninjutsu) return 'ninjutsu ' + a.cost.mana + ' (' + a.cost.mana + ', return an unblocked attacker you control to hand: put this onto the battlefield from your hand tapped and attacking)';
        if (a.levelUp) return a.cost.mana + ': Level ' + a.levelUp + ' (as a sorcery, only while level ' + (a.levelUp - 1) + ')';
        if (a.cost.removeCtr) return 'remove ' + a.cost.removeCtr.n + ' ' + a.cost.removeCtr.kind + ' counters from this: ' + ops(a.ops);
        if (a.cycling) return 'cycling ' + a.cost.mana + ' (' + a.cost.mana + ', discard this card from your hand: draw a card)';
        if (a.equip && a.cost.life) return 'equip — pay ' + a.cost.life + ' life (only once each turn, as a sorcery)';
        return [a.cost.mana, a.cost.tap ? '{T}' : '', a.cost.sacSelf ? 'sacrifice this' : '', a.cost.sacToken ? 'sacrifice a token' : '', a.cost.discard ? 'discard a card' : '', a.cost.discardSelf ? 'discard this card' : '', a.cost.life ? 'pay ' + a.cost.life + ' life' : '', a.cost.exileSelf ? (a.zone === 'grave' ? 'exile this card from your graveyard' : 'exile this') : '', a.cost.crew ? 'crew ' + a.cost.crew + ' (tap any number of other untapped creatures you control with total power ' + a.cost.crew + ' or more)' : ''].filter(Boolean).join(', ') + ': ' + ops(a.ops) + (a.sorcery ? ' (only as a sorcery)' : '') + (a.cond ? ' (activate only if ' + cond(a.cond) + ')' : '') + (a.oncePerTurn ? ' (only once each turn)' : '') + (a.once ? ' (only once)' : '');
      case 'evasion': return a.blockerNot.notSubtypes ? 'this can’t be blocked by non-' + a.blockerNot.notSubtypes.join('/') + ' creatures' : 'this can’t be blocked by ' + filt(Object.assign({ types: ['Creature'] }, a.blockerNot)).replace('creature', 'creatures');
      case 'oppDieExile': return 'if a creature an opponent controls would die, exile it instead';
      case 'enterChoice': return 'as this enters, choose ' + (a.what === 'basicType' ? 'a basic land type' : a.what === 'creatureType' ? 'a creature type' : 'odd or even');
      case 'oneSpellPerTurn': return 'each player can’t cast more than one spell each turn';
      case 'oppCreaturesEnterTapped': return 'creatures your opponents control enter tapped';
      case 'reflexiveBody': return (a.cond ? 'if ' + cond(a.cond) + ', ' : '') + ops(a.ops);
      case 'etbCounters': return 'this enters with ' + a.n + ' ' + a.kind + ' counters on it';
      case 'flashback': return 'flashback ' + a.cost + ' (you may cast this from your graveyard for ' + a.cost + '; then exile it)';
      case 'mayhem': return 'mayhem ' + a.cost + ' (if you discarded this card this turn, you may cast it from your graveyard for ' + a.cost + ')';
      case 'mustAttack': return 'this attacks each combat if able';
      case 'addCost': return a.what === 'blight' ? 'as an additional cost, you may blight ' + a.n + ' (put ' + a.n + ' -1/-1 counter on a creature you control)' : a.what === 'teamwork' ? 'teamwork ' + a.n + ' (as an additional cost, you may tap creatures you control with total power ' + a.n + ' or more)' : a.what === 'discardOrSac' ? 'as an additional cost, discard a card or sacrifice a permanent' : 'as an additional cost, discard a card or pay ' + a.life + ' life';
      case 'warp': return 'warp ' + a.cost + ' (you may cast this from your hand for ' + a.cost + '; exile it at the beginning of the next end step, and you may cast it from exile on a later turn)';
      case 'sneak': return 'sneak ' + a.cost + ' (you may cast this for ' + a.cost + ' during your declare blockers step by returning an unblocked attacker you control to its owner’s hand)';
      case 'oppNoCast': return 'your opponents can’t cast spells during your turn';
      case 'bargain': return 'bargain (you may sacrifice an artifact, enchantment or token as you cast this)';
      case 'harmonize': return 'harmonize ' + a.cost + ' (you may cast this from your graveyard for ' + a.cost + ', tapping up to one creature you control to reduce the generic cost by its power; then exile it)';
      case 'hexproofFrom': return 'hexproof from ' + a.types.map(x => x.toLowerCase() + 's').join(' and ');
      case 'lifeLossDouble': return 'if an opponent would lose life during your turn, they lose twice that much life instead';
      case 'gift': return 'gift a ' + a.what + ' (you may promise an opponent a gift as you cast this; if you do, they draw a card before its other effects)';
      case 'trig': {
        if (a.ward) return 'ward — ' + ops(a.ops);
        if (a.solveTrig) return 'to solve — ' + cond(a.cond.of[0]) + ' (checked at the beginning of your end step)';
        let e;
        if (a.on === 'cast') e = 'Whenever ' + (a.anyPlayer ? 'a player casts' : 'you cast') + ' a ' + (a.spell && a.spell.notTypes ? 'non' + a.spell.notTypes.join('').toLowerCase() + ' ' : '') + 'spell' + (a.spell && a.spell.mvGE != null ? ' with mana value ' + a.spell.mvGE + ' or greater' : '');
        else if (a.on === 'beginStep') e = 'At the beginning of ' + (a.yours ? 'your ' : '') + ({ boc: 'combat', upkeep: 'upkeep', end: 'end step' }[a.step] || a.step);
        else if (a.on === 'attackWith') e = 'Whenever you attack with one or more ' + a.sub + 's';
        else if (a.on === 'dealsDamage') e = 'Whenever this deals ' + (a.combat ? 'combat ' : '') + 'damage' + (a.toOpp ? ' to an opponent' : a.toPlayer ? ' to a player' : '');
        else if (a.on === 'unlock') e = 'When you unlock this door';
        else if (a.on === 'gainLife') e = 'Whenever you gain life';
        else if (a.on === 'crime') e = 'Whenever you commit a crime' + (a.zone === 'grave' ? ' (this works from your graveyard)' : '');
        else if (a.on === 'cast' && a.chosenParity) e = 'Whenever an opponent casts a spell with mana value of the chosen quality';
        else if (a.jobSelect) e = 'Job select — when this enters';
        else if (a.on === 'attacks' && a.evCond) e = 'Whenever this attacks while ' + cond(a.evCond);
        else if (a.on === 'discardBatch') e = 'Whenever you discard one or more cards';
        else if (a.on === 'discarded') e = 'Whenever you discard a card';
        else if (a.on === 'leftGraveBatch') e = 'Whenever one or more cards leave your graveyard';
        else if (a.on === 'toGraveBatch') e = 'Whenever one or more permanent cards are put into your graveyard from anywhere' + (a.evCond ? ' while ' + cond(a.evCond).replace('it has', 'this has') : '');
        else if (a.on === 'attackWith' && !a.sub) e = 'Whenever you attack';
        else if (a.on === 'enters' && a.zone === 'grave') e = 'Whenever ' + who(a.who) + ' enters (this works from your graveyard)';
        else if (a.on === 'search') e = 'Whenever ' + (a.opp ? 'an opponent searches their library' : 'you search your library');
        else if (a.on === 'drawCard') e = 'Whenever ' + (a.opp ? 'an opponent draws' : 'you draw') + (a.nth ? ' their second card each turn' : ' a card');
        else if (a.on === 'dealsDamage' && a.who && a.who !== 'self') e = 'Whenever ' + who(a.who) + ' deals ' + (a.combat ? 'combat ' : '') + 'damage' + (a.toPlayer ? ' to a player' : '');
        else if (a.on === 'beginStep' && !a.yours && a.step === 'end') e = 'At the beginning of each end step';
        else if (a.mobilize) e = 'Mobilize ' + a.mobilize + ' — whenever this attacks';
        else if (a.on === 'counterPut' && a.nth) e = 'When the ' + ['first', 'second', 'third', 'fourth', 'fifth'][a.nth - 1] + ' ' + a.ctrKind + ' counter is put on this';
        else if (a.on === 'levelUp') e = 'When this Class becomes level ' + a.level;
        else if (a.on === 'cast' && a.nth) e = 'Whenever you cast your second spell each turn';
        else if (a.on === 'cast' && a.spell && a.spell.types) e = 'Whenever you cast ' + (/^[aeiou]/i.test(a.spell.types[0]) ? 'an ' : 'a ') + a.spell.types.join(' or ').toLowerCase() + ' spell';
        else if (a.on === 'attacks' && a.defMostLife) e = 'Whenever this attacks the player with the most life or tied for most life';
        else if (a.on === 'attacks' && a.youMostLife) e = 'Whenever this attacks while you have the most life or are tied for most life';
        else if (a.on === 'sacrificed') e = 'When you sacrifice this';
        else e = 'Whenever ' + who(a.who) + ' ' + EV[a.on];
        if (a.modes && !a.uniqueModes) return e + ', choose one — ' + a.modes.map((m, i) => { curTg = m.tg || []; named = new Set(); return '(' + (i + 1) + ') ' + ops(m.ops); }).join(' / ');
        if (a.modes) return e + ', choose one that hasn’t been chosen — ' + a.modes.map((m, i) => '(' + (i + 1) + ') ' + ops(m.ops)).join(' / ');
        return e + (a.cond ? ', if ' + cond(a.cond) : '') + ': ' + ops(a.ops) + (a.oncePerTurn ? ' (only once each turn)' : '');
      }
      case 'static': if (a.addSubtypes) return 'the equipped creature gets ' + sgn(a.p) + '/' + sgn(a.t) + ' and is a ' + a.addSubtypes.join(' ') + ' in addition to its other types';
        if (a.setTypes) return (a.cond ? 'As long as ' + cond(a.cond) + ', ' : '') + 'this is a ' + a.setPT.join('/') + ' ' + a.setTypes.subtypes.join(' ') + ' creature' + (a.grant ? ' and has ' + a.grant.map(k => KWNAME[k]).join(', ') : '');
        if (a.pv) return 'this gets +1/+1 for each other ' + filt(a.pv.f).replace(' you control', '') + ' you control';
        return (a.cond ? 'As long as ' + cond(a.cond) + ', ' : '') + (typeof a.affects === 'string' ? (a.affects === 'self' ? 'this' : 'the ' + a.affects + ' creature') : 'each ' + filt(a.affects)) + (a.p || a.t ? ' gets ' + sgn(a.p) + '/' + sgn(a.t) : '') + (a.grant ? (a.p || a.t ? ' and' : '') + ' has ' + a.grant.map(k => KWNAME[k]).join(', ') : '') + (a.grantAb ? ' and ' + a.grantAb.map(g => MF.describeAbility(g)).join(', ') : '');
      case 'cda': return a.tPlus ? 'power is equal to ' + N(a.v) + ' and toughness is equal to that number plus ' + a.tPlus : (a.t === false ? 'power is equal to ' : 'power and toughness each equal ') + N(a.v);
      case 'costLessPer': if (a.domain) return 'domain — this spell costs {1} less to cast for each basic land type among lands you control';
        return 'this spell costs {1} less to cast for each ' + (a.f.types.length > 2 ? 'permanent' : a.f.types.join('/').toLowerCase()) + ' card ' + (a.zones.length > 1 ? 'you own in exile and in your graveyard' : 'in your graveyard');
      case 'preventCombatToSelf': return 'prevent all combat damage that would be dealt to this';
      case 'impending': return 'impending ' + a.n + '—' + a.cost + ' (you may cast it for ' + a.cost + '; it enters with ' + a.n + ' time counters and isn’t a creature while it has any)';
      case 'castFree': return 'you may cast spells from your hand without paying their mana costs';
      case 'compleated': return 'compleated (a Phyrexian symbol may be paid with 2 life; if life was paid, this enters with two fewer loyalty counters)';
      case 'chosenLandType': return 'this is the chosen basic land type (and taps for its color)';
      case 'plot': return 'plot ' + a.cost + ' (exile it from your hand for this cost as a sorcery; on a later turn, cast it as a sorcery without paying its mana cost)';
      case 'extraLand': return 'you may play ' + a.n + ' additional land on each of your turns';
      case 'landsFromGrave': return 'you may play lands from your graveyard';
      case 'uncounterable': return 'this spell can’t be countered';
      case 'affinity': return 'affinity for ' + filt(a.f) + 's (costs {1} less for each one you control)';
      case 'maxBlockers': return 'can’t be blocked by more than ' + N(a.n) + ' creature';
      case 'noUntap': return 'the enchanted creature doesn’t untap during its controller’s untap step';
      case 'etbTapped': return 'enters tapped' + (a.unless ? ' unless ' + cond(a.unless) : '');
      case 'enchant': return 'enchant ' + filt(a.f);
      case 'costLess': return 'costs {' + a.n + '} less if ' + cond(a.cond);
      case 'costLessFor': return a.spell.types.join(' and ').toLowerCase() + ' spells you cast cost {' + a.n + '} less';
      case 'spell': if (a.spree) return 'spree — choose one or more; each adds its cost: ' + a.modes.map((m, i) => { curTg = m.tg || []; named = new Set(); return '(+' + m.cost + ') ' + ops(m.ops); }).join(' / ');
        if (a.choose) return 'choose ' + a.choose + ' — ' + a.modes.map((m, i) => '(' + (i + 1) + ') ' + ops(m.ops)).join(' / ');
        if (a.gift) { const base = ops(a.ops); curTg = a.gift.tg || []; named = new Set(); return base + '; if the gift was promised, instead: ' + ops(a.gift.ops); }
        if (a.modes) return 'choose one — ' + a.modes.map((m, i) => { curTg = m.tg || []; return '(' + (i + 1) + ') ' + ops(m.ops); }).join(' / '); return ops(a.ops);
      case 'restrict': return 'this can’t ' + [a.attack ? 'attack' : '', a.block ? 'block' : ''].filter(Boolean).join(' or ') + (a.unless ? ' unless ' + cond(a.unless) : '');
      case 'offspring': return 'offspring ' + a.cost + ' (an optional additional cost)';
      case 'kicker': return 'kicker ' + a.cost + ' (an optional additional cost)';
      case 'enterAsCopy': return 'may enter as a copy of a creature with mana value up to the mana spent, except it is also a ' + a.except.addSubtypes.join(' ') + ' and has ' + a.except.kw.map(k => KWNAME[k]).join(', ');
      default: return a.k;
    }
  };
  MF.describeCard = function (d) {
    const kws = Object.keys(d.kw).map(k => KWNAME[k] + (d.kw[k] > 1 ? ' ×' + d.kw[k] : ''));
    if (d.doors) return d.ab.map(a => d.doors[a.door].name + ' (door, while unlocked): ' + MF.describeAbility(a));   // CR 709.5
    if (d.back) { const bk = Object.keys(d.back.kw).map(k => KWNAME[k]); return (kws.length ? [kws.join(', ')] : []).concat(d.ab.map(MF.describeAbility)).concat(['Transformed (' + d.back.name + '): ' + bk.concat(d.back.ab.map(MF.describeAbility)).join('; ')]); }   // CR 712
    return (kws.length ? [kws.join(', ')] : []).concat(d.ab.map(MF.describeAbility));
  };
})();
