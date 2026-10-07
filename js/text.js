// Every player-facing sentence: log lines and prompts. One line per engine log type and one prompt
// per question kind; a type or kind with none fails tools/check-pages.mjs, because an event the
// player cannot read did not happen as far as they can tell. The engine logs by seat; second
// person is applied here, at the last moment (CARD-LOG-AND-TARGETING-SPEC §2).
(function () {
  'use strict';
  const MF = window.MF;
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');   // both quote kinds: attributes are written with either
  // Mana symbols, drawn by this project in CSS (docs/rights.md rule 1).
  const sym = t => {
    if (t === 'T') return '<span class="ms ms-T" title="tap">⟳</span>';
    if (/^[WUBRG]\/P$/.test(t)) return `<span class="ms ms-${t[0]}" title="Phyrexian ${MF.COLOR_NAME[t[0]]}: its colour or 2 life">ϕ</span>`;   // CR 107.4f
    if (/^[WUBRG]\/[WUBRG]$/.test(t)) { const v = k => 'var(--m' + k + ')'; return `<span class="ms ms-h" style="--h1:${v(t[0])};--h2:${v(t[2])}" title="${MF.COLOR_NAME[t[0]]} or ${MF.COLOR_NAME[t[2]]}"></span>`; }   // CR 107.4e
    if (/^[WUBRGC]$/.test(t)) return `<span class="ms ms-${t}" title="${MF.COLOR_NAME[t]}">${t === 'C' ? '◇' : ''}</span>`;
    return `<span class="ms ms-N">${esc(t)}</span>`;
  };
  const symbols = str => esc(str).replace(/\{([^}]+)\}/g, (m, t) => sym(t));
  const cname = id => MF.cards[id] ? MF.cards[id].name : id;
  const tag = id => id == null ? '' : `<b class="cn" data-cid="${esc(id)}">${esc(cname(id))}</b>`;
  const list = ids => ids.map(tag).join(', ');
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const T = MF.text = { esc: esc, symbols: symbols, sym: sym, cname: cname, tag: tag, plural: plural };
  T.who = (seat, v) => seat === v ? 'You' : 'The opponent';
  T.whose = (seat, v) => seat === v ? 'your' : 'the opponent’s';
  T.v = (seat, v, you, they) => seat === v ? you : they;
  const W = T.who, V = T.v;
  const tgs = tg => (tg || []).flat().map(r => r.p != null ? (r.p === T._viewer ? 'you' : 'the opponent') : tag(r.c)).join(', ');
  const STEP_WORD = { upkeep: 'upkeep', boc: 'beginning of combat', eoc: 'end of combat', end: 'end step' };
  const AB_NAME = (id, ab, inl) => inl === 'prowess' ? 'prowess' : '';

  const LINES = {
    first: (e, v) => `${W(e.who, v)} chose ${e.first === e.who ? V(e.who, v, 'to go first', 'to go first') : 'for ' + (e.first === v ? 'you' : 'the opponent') + ' to go first'}. The first player skips their first draw.`,
    draw: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'draw', 'draws')} ${plural(e.n, 'card')}.`,
    mulligan: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'take', 'takes')} a mulligan (${e.n} so far) and ${V(e.who, v, 'draw', 'draws')} a new seven.`,
    keep: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'keep', 'keeps')} ${plural(e.n, 'card')}.`,
    bottomed: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'put', 'puts')} ${plural(e.n, 'card')} on the bottom of the library.`,
    turn: (e, v) => `<span class="turnline">Turn ${e.n} — ${e.who === v ? 'your turn' : 'the opponent’s turn'}</span>`,
    land: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'play', 'plays')} ${tag(e.c)}${e.from === 'exile' ? ' from exile' : ''}.`,
    cast: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'cast', 'casts')} ${e.face ? '<b>' + esc(e.face) + '</b> (' + (e.alt === 'omen' ? 'the Omen of ' : e.alt === 'door' ? 'the door of ' : e.alt === 'mdfc' ? 'the back face of ' : e.alt === 'prepare' ? 'the prepared copy from ' : 'the Adventure of ') + tag(e.c) + ')' : tag(e.c)}${e.gift ? ', promising a gift' : ''}${e.bargained ? ', bargained' : ''}${e.harmonize ? ' from the graveyard with harmonize' : ''}${e.sneak ? ' for its sneak cost' : ''}${e.warp ? ' for its warp cost' : ''}${e.via === 'flashback' ? ' with flashback' : e.via === 'mayhem' ? ' with mayhem' : e.via === 'free' ? ' without paying its mana cost' : e.impending ? ' for its impending cost' : e.evoked ? ' for its evoke cost' : ''}${e.x != null ? ' with X = ' + e.x : ''}${e.from === 'exile' ? ' from exile' : ''}${e.offspring ? ', paying offspring' : ''}${e.kicked ? ', kicked' : ''}${(e.tg || []).flat().length ? ', targeting ' + tgs(e.tg) : ''}.`,
    omenShuffle: (e, v) => `${tag(e.c)} is shuffled into ${T.whose(e.who, v)} library (Omen).`,
    adventureExile: (e, v) => `${tag(e.c)} goes on an adventure: exiled, and ${e.who === v ? 'you' : 'the opponent'} may cast the creature from exile later.`,
    animate: (e) => `${tag(e.c)} becomes a ${e.p}/${e.tou} creature with ${e.kws.map(k => MF.KWNAME[k]).join(', ')} and all creature types. It’s still a land.`,
    role: (e) => `A ${tag(e.c)} token is attached to ${tag(e.to)}.`,
    noLifeGain: (e, v) => `${W(e.who, v)} can’t gain life for the rest of the game.`,
    lifeLoss: (e, v) => `${W(e.who, v)} ${e.why === 'pay' ? V(e.who, v, 'pay', 'pays') : V(e.who, v, 'lose', 'loses')} ${e.n} life${e.asked != null && e.asked !== e.n ? ' (' + e.asked + ', doubled by Bloodletter of Aclazotz)' : ''}${e.c ? ' (' + tag(e.c) + ')' : ''}. Life ${e.life}.`,
    unlock: (e, v) => `${W(e.who, v)} ${e.entering ? V(e.who, v, 'enter', 'enters') + ' ' + tag(e.c) + ' with <b>' + esc(e.door) + '</b> unlocked' : V(e.who, v, 'unlock', 'unlocks') + ' <b>' + esc(e.door) + '</b> of ' + tag(e.c)}.`,
    cycle: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'cycle', 'cycles')} ${tag(e.c)}.`,
    gift: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'give', 'gives')} ${e.to === v ? 'you' : 'the opponent'} a gift: a card.`,
    revealHand: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'reveal', 'reveals')} ${e.who === v ? 'your' : 'their'} hand: ${e.cs.length ? list(e.cs) : 'no cards'}.`,
    handPickNone: (e, v) => `<span class="notice">There is no card of that kind to choose.</span>`,
    exiledFromHand: (e, v) => `${tag(e.c)} is exiled from ${T.whose(e.who, v)} hand${e.by ? ' by ' + tag(e.by) : ''}${e.until ? ' until it leaves the battlefield' : ''}.`,
    mayCastExiled: (e, v) => `${W(e.who, v)} may cast ${tag(e.c)} while it remains exiled, spending mana of any type.`,
    stunUntap: (e) => `${tag(e.c)} stays tapped: a stun counter is removed instead (${e.left} left).`,
    returnGone: (e) => `<span class="notice">${tag(e.c)} is no longer in the graveyard; nothing returns.</span>`,
    surveil: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'surveil', 'surveils')} ${e.n}: ${e.top} kept on top${e.grave.length ? ', ' + list(e.grave) + ' to the graveyard' : ''}.`,
    searchNothing: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'search', 'searches')} and ${V(e.who, v, 'find', 'finds')} nothing to take.`,
    untapped: (e) => `${tag(e.c)} untaps.`,
    manaCombo: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'activate', 'activates')} ${tag(e.c)} for ${e.cols.split('').map(sym).join('')}.`,
    removeCounters: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'remove', 'removes')} ${e.n} ${e.ctr} counters from ${tag(e.c)}.`,
    exiledInstead: (e, v) => e.finality ? `${tag(e.c)} would go to the graveyard, and is exiled instead (finality counter).` : `${tag(e.c)} would die, and is exiled instead.`,
    prevented: (e, v) => `${e.n} combat damage to ${tag(e.c)} is prevented.`,
    exiledGrave: (e, v) => `${T.whose(e.who, v)[0].toUpperCase() + T.whose(e.who, v).slice(1)} graveyard is exiled: ${e.cs.map(tag).join(', ')}.`,
    endTurn: (e, v) => `${tag(e.c)} ends the turn: the stack is exiled, and the game skips to the cleanup step.`,
    exiledInsteadOfGrave: (e, v) => `${tag(e.c)} is exiled instead of going to the graveyard.`,
    becomesCreature: (e, v) => `${tag(e.c)} becomes a ${e.p}/${e.tou} creature in addition to its other types.`,
    prepared: (e, v) => `${tag(e.c)} is prepared: a copy of ${esc(e.spell)} waits in exile, castable while it stays prepared.`,
    unprepared: (e, v) => `${tag(e.c)} is no longer prepared.`,
    forage: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'forage', 'forages')}: ${e.food ? 'a Food is sacrificed' : e.cs.map(tag).join(', ') + ' exiled from the graveyard'}.`,
    forageCast: (e, v) => `Until end of turn, ${W(e.who, v)} may cast creature spells from ${T.whose(e.who, v)} graveyard by foraging.`,
    enduring: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'have', 'has')} an enduring story for the rest of the game (CR 702.195).`,
    leyline: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'begin', 'begins')} the game with ${tag(e.c)} on the battlefield.`,
    lore: (e, v) => `${tag(e.c)} gets a lore counter (${e.n}).`,
    sagaDone: (e, v) => `${tag(e.c)} has read its final chapter and is sacrificed.`,
    exiledCost: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'exile', 'exiles')} ${tag(e.c)} to pay a cost.`,
    earthbend: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'earthbend', 'earthbends')} ${e.n}: ${tag(e.c)} becomes a 0/0 creature with haste and gets ${e.n} +1/+1 counters.`,
    addMana: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'add', 'adds')} ${('{' + e.col + '}').repeat(e.n)}${e.c ? ' from ' + tag(e.c) : ''}.`,
    crewed: (e, v) => `${tag(e.c)} is crewed and becomes an artifact creature until end of turn.`,
    cantCounter: (e, v) => `${tag(e.c)} can’t be countered.`,
    harmonizeExile: (e, v) => `${tag(e.c)} is exiled (cast with ${e.via || 'harmonize'}).`,
    bounce: (e, v) => `${tag(e.c)} returns to ${T.whose(e.who, v)} hand.`,
    countered: (e, v) => `${T.whose(e.who, v)[0].toUpperCase() + T.whose(e.who, v).slice(1)} ${tag(e.c)}${e.ab ? '’s ability' : ''} is countered${e.by ? ' by ' + tag(e.by) : ''}.`,
    paidToSave: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'pay', 'pays')} ${symbols(e.mana)}; ${tag(e.c)} is not countered.`,
    lookPick: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'look', 'looks')} at ${plural(e.n, 'card')}, ${V(e.who, v, 'put', 'puts')} ${e.took} into hand and ${e.bottom} on the bottom.`,
    chose: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'choose', 'chooses')} <b>${e.choice}</b> for ${tag(e.c)}.`,
    modesSpent: (e, v) => `<span class="notice">${tag(e.c)}’s ability does nothing: every mode has been chosen.</span>`,
    blight: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'blight', 'blights')} ${e.n}: ${tag(e.c)} gets a -1/-1 counter.`,
    loyalty: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'activate', 'activates')} a loyalty ability of ${tag(e.c)} (${e.n > 0 ? '+' + e.n : e.n === 0 ? '0' : '−' + (-e.n)}; loyalty ${e.left}).`,
    loyaltyLoss: (e, v) => `${tag(e.srcId)} deals <b>${e.n}</b> damage to ${tag(e.c)}: loyalty ${e.left}.`,
    ninjutsuReturn: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'return', 'returns')} the unblocked ${tag(e.c)} to hand for the ninjutsu of ${tag(e.card)}.`,
    ninjutsuGone: (e, v) => `<span class="notice">${tag(e.c)} is no longer in hand; it doesn’t enter.</span>`,
    shuffledIn: (e, v) => `${e.cs ? e.cs.map(tag).join(', ') + (e.cs.length > 1 ? ' are' : ' is') : tag(e.c) + ' is'} shuffled into ${T.whose(e.who, v)} library${e.from ? ' from ' + T.whose(e.who, v) + ' graveyard' : ''}.`,
    transformed: (e, v) => `${tag(e.c)} transforms into <b>${esc(e.face)}</b>.`,
    emblem: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'get', 'gets')} an emblem: “${esc(e.text)}”${e.c ? ' (' + tag(e.c) + ')' : ''}.`,
    loseAbilities: (e, v) => `${tag(e.c)} loses all abilities${e.pt ? ' and is ' + e.pt.join('/') : ''} until ${e.who === v ? 'the opponent’s' : 'your'} next turn.`,
    lookHand: (e, v) => e.by === v ? `You look at the opponent’s hand: ${e.cs.length ? list(e.cs) : 'no cards'}.` : `The opponent looks at your hand.`,
    explore: (e, v) => e.card == null ? `${tag(e.c)} explores: the library is empty; it gets a +1/+1 counter.` : `${tag(e.c)} explores, revealing ${tag(e.card)}${e.land ? ' — a land, put into hand' : ''}.`,
    warpExile: (e, v) => `${tag(e.c)} is exiled (warp); ${e.who === v ? 'you' : 'its owner'} may cast it from exile on a later turn.`,
    solved: (e, v) => `${tag(e.c)} is solved.`,
    graveCastable: (e, v) => `${W(e.who, v)} may cast creature cards from ${T.whose(e.who, v)} graveyard this turn (${plural(e.n, 'card')}).`,
    wardPaid: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'pay', 'pays')} the ward cost of ${tag(e.c)}.`,
    returnFromExile: (e, v) => e.to === 'bf' ? `${tag(e.c)} returns from exile to the battlefield under ${T.whose(e.who, v)} control.` : `${tag(e.c)} returns from exile to ${T.whose(e.who, v)} hand.`,
    plot: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'plot', 'plots')} ${tag(e.c)}: it is exiled face up, to be cast on a later turn without paying its mana cost.`,
    onceDone: (e, v) => `${tag(e.c)} has already done this this turn.`,
    nthResolution: (e, v) => `${tag(e.c)}’s ability has resolved ${['once', 'twice', 'three times'][e.n - 1] || e.n + ' times'} this turn${e.n > 3 ? ' — no further effect' : ''}.`,
    sneakReturn: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'return', 'returns')} the unblocked ${tag(e.c)} to hand to pay the sneak cost.`,
    delayedMade: (e, v) => `${tag(e.c)}: ${e.on === 'attackWith' ? 'whenever ' + (e.who === v ? 'you attack' : 'the opponent attacks') + ' this turn, it makes attacking Warriors' : 'a delayed ability is set'}.`,
    levelUp: (e, v) => `${tag(e.c)} becomes level ${e.n}.`,
    lookedAt: (e, v) => e.who === v ? `You look at ${list(e.cs)} — no ${e.type.toLowerCase()} card among them.` : `The opponent looks at the top ${plural(e.cs.length, 'card')} of their library and reveals no ${e.type.toLowerCase()} card.`,
    mill: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'mill', 'mills')} ${list(e.cs)}.`,
    extraCombatAdded: (e, v) => `There will be an additional combat phase after this one.`,
    extraCombat: (e, v) => `<span class="turnline">Additional combat phase</span>`,
    fight: (e) => `${tag(e.a)} fights ${tag(e.b)}.`,
    noFight: () => `<span class="notice">The fight does not happen: one of the two is gone or is no longer a creature.</span>`,
    exiled: (e, v) => `${tag(e.c)} is exiled${e.fromStack ? ' from the stack' : e.from === 'bf' ? (e.until ? ' until its exiler leaves the battlefield' : '') : e.from === 'hand' ? ' from ' + T.whose(e.who, v) + ' hand' : ' from ' + T.whose(e.who, v) + ' graveyard'}${e.by && e.by !== e.c ? ' by ' + tag(e.by) : ''}.`,
    noGain: (e, v) => `<span class="notice">${W(e.who, v)} can’t gain life: ${e.n} life is not gained.</span>`,
    activate: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'activate', 'activates')} ${tag(e.c)}${(e.tg || []).flat().length ? ', targeting ' + tgs(e.tg) : ''}.`,
    mana: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'tap', 'taps')} ${tag(e.c)} for ${sym(e.col)}.`,
    pay: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'pay', 'pays')} ${symbols(e.mana)}.`,
    manaEmpties: (e, v) => `${plural(e.n, 'unspent mana')} empties from ${T.whose(e.who, v)} mana pool.`,
    damage: (e, v) => `${tag(e.srcId)} deals <b>${e.n}</b> ${e.combat ? 'combat ' : ''}damage to ${e.who === v ? 'you' : 'the opponent'}${e.lost != null ? ', who ' + V(e.who, v, 'lose', 'loses') + ' <b>' + e.lost + '</b> life (doubled by Bloodletter of Aclazotz)' : ''}. Life ${e.life}.`,
    damageCreature: (e) => `${tag(e.srcId)} deals <b>${e.n}</b> ${e.combat ? 'combat ' : ''}damage to ${tag(e.c)}.`,
    life: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'gain', 'gains')} ${e.n} life${e.src ? ' (' + esc(e.src) + ')' : ''}. Life ${e.life}.`,
    attackers: (e, v) => e.cs.length ? `${W(e.who, v)} ${V(e.who, v, 'attack', 'attacks')} with ${list(e.cs)}.` : `${W(e.who, v)} ${V(e.who, v, 'do', 'does')} not attack.`,
    blockers: (e, v) => e.pairs.length ? `${W(e.who, v)} ${V(e.who, v, 'block', 'blocks')}: ${e.pairs.map(p => tag(p[0]) + ' blocks ' + tag(p[1])).join('; ')}.` : `${W(e.who, v)} ${V(e.who, v, 'do', 'does')} not block.`,
    sbaGrave: (e) => `${tag(e.c)} is put into the graveyard${e.why === 'toughness' ? ' (toughness 0 or less)' : e.why === 'aura' ? ' (the Aura is attached to nothing legal)' : ''}.`,
    destroy: (e) => `${tag(e.c)} is destroyed${e.why === 'lethal' ? ' (lethal damage)' : e.why === 'deathtouch' ? ' (deathtouch)' : ''}.`,
    indestructible: (e) => `${tag(e.c)} is indestructible and survives.`,
    lose: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'lose', 'loses')}: ${e.why === 'life' ? 'life is 0 or less' : 'drew from an empty library'}.`,
    win: (e, v) => e.who === 'draw' ? `<b>The game is a draw.</b>` : `<b>${W(e.who, v)} ${V(e.who, v, 'win', 'wins')} the game.</b>`,
    tokenGone: (e) => `The ${tag(e.c)} token ceases to exist.`,
    unattach: (e) => `${tag(e.c)} becomes unattached.`,
    legendRule: (e, v) => `Legend rule: ${tag(e.c)} is put into ${T.whose(e.who, v)} graveyard.`,
    trigNoTarget: (e) => `<span class="notice">${tag(e.c)}’s ability had no legal target and was removed.</span>`,
    trigger: (e) => `${tag(e.c)}${e.inl === 'prowess' ? '’s prowess' : ''} triggers${(e.tg || []).flat().length ? ', targeting ' + tgs(e.tg) : ''}.`,
    discard: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'discard', 'discards')} ${tag(e.c)}.`,
    sacrifice: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'sacrifice', 'sacrifices')} ${tag(e.c)}.`,
    undone: (e, v) => `<span class="notice">${W(e.who, v)} could not complete that; it is reversed (${esc(e.why)}).</span>`,
    fizzle: (e) => `<span class="notice">${tag(e.c)} ${e.ab ? '’s ability ' : ''}does nothing: all its targets became illegal.</span>`,
    resolve: (e) => `${tag(e.c)} resolves.`,
    trigIf: (e) => `<span class="notice">${tag(e.c)}’s ability does nothing: its condition is no longer true.</span>`,
    resolveAb: (e) => `${tag(e.c)}’s ${e.trig ? 'triggered' : 'activated'} ability resolves.`,
    counter: (e) => `${tag(e.c)} gets ${e.n === 1 ? 'a ' + e.kind + ' counter' : e.n + ' ' + e.kind + ' counters'}.`,
    tapped: (e) => `${tag(e.c)} becomes tapped.`,
    pump: (e) => `${e.all ? 'Each of ' : ''}${list(e.cs)} ${e.cs.length > 1 || e.all ? 'get' : 'gets'}${e.p || e.tou ? ' ' + (e.p >= 0 ? '+' : '') + e.p + '/' + (e.tou >= 0 ? '+' : '') + e.tou : ''}${e.grant ? (e.p || e.tou ? ' and' : '') + ' ' + e.grant.map(k => MF.KWNAME[k]).join(', ') : ''} until end of turn.`,
    unblockable: (e) => `${tag(e.c)} can’t be blocked this turn.`,
    scry: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'scry', 'scries')} ${e.n}: ${e.top} on top, ${e.bottom} on the bottom.`,
    token: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'create', 'creates')} a${e.tapped ? ' tapped' : ''}${e.attacking ? ' and attacking' : ''} ${MF.cards[e.c].power}/${MF.cards[e.c].toughness} ${tag(e.c)} token.`,
    tokenCopy: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'create', 'creates')} a 1/1 token copy of ${tag(e.c)}.`,
    noSource: () => `<span class="notice">The damage source is gone; no damage is dealt.</span>`,
    putOnto: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'put', 'puts')} ${tag(e.c)} onto the battlefield${e.tapped ? ' tapped' : ''}${e.attacking ? ' and attacking' : ''} from the ${e.from}${e.ctr ? ' with ' + Object.entries(e.ctr).map(([k, n]) => n + ' ' + k + ' counter' + (n === 1 ? '' : 's')).join(', ') : ''}.`,
    toHand: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'put', 'puts')} ${e.who === v || e.revealed ? tag(e.c) : 'the card'} into ${T.whose(e.who, v)} hand.`,
    reveal: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'reveal', 'reveals')} ${list(e.cs)}.`,
    toBottom: (e, v) => `${plural(e.n, 'card')} ${e.n === 1 ? 'goes' : 'go'} to the bottom of ${T.whose(e.who, v)} library${e.random ? ' in a random order' : ''}.`,
    impulse: (e, v) => e.from === 'graveyard' ? `${W(e.who, v)} ${V(e.who, v, 'exile', 'exiles')} ${tag(e.c)} at random from the graveyard and may play it this turn.` : `${W(e.who, v)} ${V(e.who, v, 'exile', 'exiles')} ${tag(e.c)} from the top of the library and may play it ${e.until === e.turn ? 'this turn' : 'until the end of ' + (e.who === v ? 'your' : 'their') + ' next turn'}.`,
    attach: (e) => `${tag(e.c)} is attached to ${tag(e.to)}.`,
    copy: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'copy', 'copies')} ${tag(e.c)}${e.gone ? ' (as it last existed on the stack)' : ''}${(e.tg || []).flat().length ? ', targeting ' + tgs(e.tg) : ''}.`,
    enterAsCopy: (e) => `${tag(e.c)} enters as a copy of ${tag(e.of)}.`,
  };
  T.lines = LINES;
  T.logLine = function (e, viewer) {
    const f = LINES[e.t];
    if (!f) throw new Error('log type with no player-facing line: ' + e.t);
    T._viewer = viewer;
    return f(e, viewer);
  };

  // Prompts. Each says what is being asked, about which card, with the numbers, and what
  // declining does (owner's rule 14). `labels` names the buttons.
  const C = (s, iid) => { const c = MF.view(s).cards[iid]; return c ? tag(c.id) : 'it'; };
  const oracle = (s, iid) => { const c = MF.view(s).cards[iid]; return c ? `<div class="ptext-oracle">${symbols(MF.cards[c.id].text).replace(/\n/g, '<br>')}</div>` : ''; };
  const mana = need => symbols(MF.manaStr(need));
  const PROMPTS = {
    first: () => ({ title: 'You choose who goes first', body: 'The player who goes first skips the draw of their first turn (CR 103.8a).', labels: { me: 'I go first', opp: 'The opponent goes first' } }),
    mulligan: (s, q) => ({ title: q.mulls ? `Keep these 7, putting ${q.mulls} on the bottom?` : 'Keep this opening hand?', body: `Your hand is shown below. A mulligan shuffles it away and draws a new seven; each mulligan so far means one more card goes to the bottom when you keep (London mulligan, CR 103.5). Mulligans so far: <b>${q.mulls}</b>.`, labels: { keep: q.mulls ? `Keep — then bottom ${q.mulls}` : 'Keep this hand', mull: `Mulligan (to ${7 - q.mulls - 1})` } }),
    bottom: (s, q) => ({ title: `Put ${plural(q.left, 'card')} on the bottom`, body: `Click a card in your hand to put it on the bottom of your library. ${q.total > 1 ? 'The first one you choose goes deepest.' : ''}`, labels: {} }),
    discardHand: (s, q) => ({ title: `Discard to seven: ${plural(q.left, 'card')} to go`, body: 'Your hand is over the maximum hand size of seven at cleanup (CR 514.1). Click a card in your hand to discard it.', labels: {} }),
    discard: (s, q) => ({ title: `${C(s, q.src)}: discard a card`, body: 'Click a card in your hand to discard it.', labels: {} }),
    pay: (s, q) => {
      const auto = q.opts.find(o => o.id === 'auto');
      const plan = auto.taps.map(t => tag(MF.view(s).cards[t.iid].id) + ' ' + sym(t.col)).join(', ');
      return { title: `Pay ${mana(q.need)} for ${C(s, q.src)}`, body: `In your pool: ${poolStr(q.pool) || 'nothing'}. The suggested payment taps ${plan || 'nothing more'}. Or click your untapped lands one at a time.`, labels: { auto: 'Pay: tap ' + auto.taps.map(t => MF.cards[MF.view(s).cards[t.iid].id].name).join(', ') } };
    },
    spend: (s, q) => ({ title: `Which mana pays the generic part of ${mana(q.need)}?`, body: 'Your pool holds more than one kind of mana beyond the coloured symbols. Choose what to spend; the rest stays in your pool until the step ends.', labels: Object.fromEntries(q.opts.map(o => [o.id, 'Spend ' + Object.entries(o.plan).filter(([k, n]) => n).map(([k, n]) => n + '× ' + MF.COLOR_NAME[k]).join(' + ')])) }),
    target: (s, q) => {
      const d = MF.cards[MF.view(s).cards[q.src].id];
      const slotText = q.n > 1 ? ` (${q.picked.length} of up to ${q.n} chosen)` : '';
      return { title: `Choose a target for ${C(s, q.src)}${slotText}`, body: `Glowing cards and players can be chosen. ${q.upTo || q.picked.length ? 'You may stop choosing.' : ''}${oracle(s, q.src)}`, labels: { ...Object.fromEntries(q.opts.filter(o => o.lid != null).map(o => [o.id, 'Target ' + (MF.cards[o.abSrc] ? MF.cards[o.abSrc].name : 'that') + '’s ability on the stack'])), done: q.picked.length ? 'Done choosing targets' : 'Choose no target', p0: T._viewer === 0 ? 'Target yourself' : 'Target the opponent', p1: T._viewer === 1 ? 'Target yourself' : 'Target the opponent' } };
    },
    attack: (s, q) => ({ title: q.chosen.length ? `Attacking with ${plural(q.chosen.length, 'creature')}` : 'Declare attackers', body: 'Click your creatures to attack with them; attacking taps a creature unless it has vigilance. Then confirm. Creatures with summoning sickness (entered this turn, without haste) cannot attack.', labels: { done: q.chosen.length ? `Attack with ${plural(q.chosen.length, 'creature')}` : 'Don’t attack', undo: 'Undo the last' } }),
    block: (s, q) => { const n = Object.keys(q.assign).length; return { title: n ? `Blocking with ${plural(n, 'creature')}` : 'Declare blockers', body: 'Click one of your untapped creatures, then choose which attacker it blocks. Flying attackers can be blocked only by flying or reach; menace needs two or more blockers.', labels: { done: n ? `Confirm ${plural(n, 'block')}` : 'Don’t block', undo: 'Undo the last' } }; },
    assign: (s, q) => ({ title: `${C(s, q.src)}: assign combat damage`, body: `${q.left} damage left to assign. How much goes to ${C(s, q.to)}? Lethal for it is <b>${q.lethal}</b>.${q.trample ? ' With trample, the rest goes to the defending player once every blocker has lethal damage.' : ' The rest goes to the other blockers.'}`, labels: Object.fromEntries(q.opts.map(o => [o.id, o.n + ' to ' + MF.cards[MF.view(s).cards[q.to].id].name + (q.trample ? ', ' + (q.left - o.n) + ' on' : '')])) }),
    legend: (s, q) => ({ title: 'Legend rule: keep one', body: 'You control two legendary permanents with the same name. Choose the one to keep; the other goes to the graveyard (CR 704.5j).', labels: {} }),
    trigOrder: (s, q) => ({ title: 'Order your triggered abilities', body: `Several of your abilities triggered at once. Click the one to put on the stack next — ${q.placed ? q.placed + ' placed so far; ' : ''}the first you choose resolves <b>last</b> (CR 603.3b).`, labels: Object.fromEntries(q.opts.map(o => [o.id, MF.cards[o.trig.src].name + (o.trig.inl === 'prowess' ? ' — prowess' : '')])) }),
    x: (s, q) => ({ title: `Choose X for ${C(s, q.src)}`, body: `X is announced before you pay (CR 601.2b).${oracle(s, q.src)}`, labels: Object.fromEntries(q.opts.map(o => [o.id, 'X = ' + o.id])) }),
    mode: (s, q) => ({ title: q.of ? `Choose mode ${q.n} of ${q.of} for ${C(s, q.src)}` : `Choose a mode for ${C(s, q.src)}`, body: `Choose one; the mode is chosen as you cast it (CR 700.2). A mode whose targets can’t be chosen isn’t offered.${oracle(s, q.src)}`, labels: Object.fromEntries(q.opts.map(o => [o.id, o.text])) }),
    manaCombo: (s, q) => ({ title: `${C(s, q.src)}: which ${q.amount} mana?`, body: `It adds ${q.amount} mana in any combination of ${q.cols.map(sym).join(' and ')}.`, labels: Object.fromEntries(q.opts.map(o => [o.id, 'Add ' + o.id.split('').map(k => '{' + k + '}').join('')])) }),
    harmonizeTap: (s, q) => ({ title: `Harmonize ${C(s, q.src)}: tap a creature?`, body: 'You may tap one untapped creature you control; the generic part of the harmonize cost is reduced by its power (CR 702.180). Click a glowing creature, or tap none.', labels: { none: 'Tap no creature' } }),
    bargain: (s, q) => ({ title: `Bargain ${C(s, q.src)}?`, body: `You may sacrifice an artifact, enchantment or token as you cast it (CR 702.166). Click a glowing one, or don’t bargain.${oracle(s, q.src)}`, labels: { none: 'Don’t bargain' } }),
    payOrCounter: (s, q) => ({ title: `${C(s, q.src)}: pay ${symbols(q.pay)} or your ${C(s, q.spell)} is countered`, body: 'If you pay, your spell stays on the stack.', labels: { pay: 'Pay ' + q.pay.replace(/[{}]/g, ''), decline: 'Don’t pay — it is countered' } }),
    lookPick: (s, q) => ({ title: `${C(s, q.src)}: choose a card for your hand (${q.k} of ${q.take})`, body: `Only you see these ${q.n} cards. The ones you don’t take go to the bottom of your library.`, labels: {} }),
    sneakReturn: (s, q) => ({ title: `Sneak ${C(s, q.src)}: return an unblocked attacker`, body: 'To pay the sneak cost, return one of your unblocked attacking creatures to your hand (CR 702.190). Click a glowing creature.', labels: {} }),
    sacToken: (s, q) => ({ title: `${C(s, q.src)}: sacrifice a token`, body: 'Sacrificing a token is part of the cost. Click a glowing token.', labels: {} }),
    enterChoice: (s, q) => q.what === 'creatureType'
      ? ({ title: `${tag(q.c)} is entering: choose a creature type`, body: 'Any creature type may be chosen (CR 205.3m). The types among your own cards are listed first.', labels: Object.fromEntries(q.opts.map(o => [o.id, o.id])) })
      : q.what === 'basicType'
      ? ({ title: `${tag(q.c)} is entering: choose a basic land type`, body: 'It becomes that land type and taps for its colour (CR 305.7). Then you may pay 2 life, or it enters tapped.', labels: Object.fromEntries(q.opts.map(o => [o.id, o.id + ' (' + { Plains: 'white', Island: 'blue', Swamp: 'black', Mountain: 'red', Forest: 'green' }[o.id] + ')'])) })
      : ({ title: `${tag(q.c)} is entering: choose odd or even`, body: 'Zero is even. Its ability refers to the quality you choose.', labels: { odd: 'Odd', even: 'Even' } }),
    mayPay: (s, q) => ({ title: `${C(s, q.src)}: pay ${q.mana ? symbols(q.mana) : q.life + ' life'}?`, body: `If you pay, the rest happens.${oracle(s, q.src)}`, labels: { yes: 'Pay ' + (q.mana ? q.mana.replace(/[{}]/g, '') : q.life + ' life'), no: 'Don’t pay' } }),
    addCostYes: (s, q) => ({ title: `${C(s, q.src)}: pay the additional cost?`, body: q.what === 'blight' ? `You may blight ${q.n}: put ${q.n} -1/-1 counter on a creature you control (CR 701.68).${oracle(s, q.src)}` : `Teamwork ${q.n}: you may tap creatures you control with total power ${q.n} or more (CR 702.194).${oracle(s, q.src)}`, labels: { yes: q.what === 'blight' ? 'Blight ' + q.n : 'Use teamwork', no: 'Don’t pay it' } }),
    blightOn: (s, q) => ({ title: `Blight ${q.n}: which creature gets the -1/-1 counter?`, body: 'Click one of your glowing creatures.', labels: {} }),
    crewTap: (s, q) => ({ title: `Crew ${q.n} ${C(s, q.src)}: tap creatures (total power ${q.total} so far)`, body: `Tap other untapped creatures you control with total power ${q.n} or more (CR 702.122). Click a glowing creature.`, labels: { done: 'Done — crew it' } }),
    spreeMode: (s, q) => ({ title: `${C(s, q.src)}: choose ${q.chosen.length ? 'another mode, or finish' : 'a mode'} (spree)`, body: `Choose one or more modes; each adds its cost (CR 702.172).${q.chosen.length ? ' Chosen so far: ' + q.chosen.map(i => '(' + (i + 1) + ')').join(', ') + '.' : ''}${oracle(s, q.src)}`, labels: Object.fromEntries(q.opts.map(o => [o.id, o.id === 'done' ? 'Done choosing' : '+' + o.cost.replace(/[{}]/g, '') + ' — ' + o.text])) }),
    phyrexian: (s, q) => ({ title: `${C(s, q.src)}: pay ${symbols('{' + q.col + '/P}')} with ${MF.COLOR_NAME[q.col]} mana or 2 life?`, body: `A Phyrexian symbol is paid with its colour or with 2 life, announced before paying (CR 107.4f, 601.2b); only what you can pay is offered. Your life: ${q.life}.${oracle(s, q.src)}`, labels: { mana: 'Pay ' + MF.COLOR_NAME[q.col] + ' mana', life: 'Pay 2 life' } }),
    mayDiscard: (s, q) => ({ title: `${C(s, q.src)}: discard a card?`, body: `If you discard one, the rest happens.${oracle(s, q.src)}`, labels: { none: 'Discard nothing' } }),
    exileFromGrave: (s, q) => ({ title: `${C(s, q.src)}: exile a card from your graveyard${q.n ? ' (' + q.k + ' of ' + q.n + ')' : ''}`, body: 'Exiling it is part of the cost. Click a glowing card in your graveyard.', labels: {} }),
    forage: (s, q) => ({ title: `Forage to cast ${C(s, q.src)} from your graveyard`, body: 'Exile three other cards from your graveyard, or sacrifice a Food (CR 701.61). It enters with a finality counter.', labels: { exile: 'Exile three cards from my graveyard', food: 'Sacrifice a Food' } }),
    leyline: (s, q) => ({ title: `Begin the game with ${tag(q.c)} on the battlefield?`, body: 'It is in your opening hand; you may put it onto the battlefield before the first turn (CR 103.6a).', labels: { yes: 'Put it onto the battlefield', no: 'Keep it in my hand' } }),
    freeEquip: (s, q) => ({ title: `${C(s, q.src)}: equip for {0}?`, body: `You have an enduring story and this is your first equip ability this turn: you may pay {0} instead of ${symbols(q.cost)}.`, labels: { free: 'Pay {0}', pay: 'Pay ' + q.cost.replace(/[{}]/g, '') } }),
    hybrid: (s, q) => ({ title: `${C(s, q.src)}: pay ${symbols('{' + q.sym[0] + '/' + q.sym[1] + '}')} with which colour?`, body: `A hybrid symbol is paid with either colour; you announce which before paying (CR 601.2b). Only the colours your mana can pay are offered.${q.n > 1 ? ' Symbol ' + q.k + ' of ' + q.n + '.' : ''}`, labels: Object.fromEntries(q.opts.map(o => [o.id, 'Pay it with ' + MF.COLOR_NAME[o.id]])) }),
    manaColor: (s, q) => ({ title: `${C(s, q.src)}: add one mana of which color?`, body: 'The mana goes into your mana pool; it empties as the step ends.', labels: Object.fromEntries(q.opts.map(o => [o.id, 'Add ' + MF.COLOR_NAME[o.id]])) }),
    tutorUpTo: (s, q) => ({ title: `${C(s, q.src)}: choose card ${q.k} of up to ${q.n}`, body: 'Only you see your library. Click a glowing card; the ones you take are revealed and go into your hand, then your library is shuffled.', labels: { done: 'Done searching' } }),
    removeCounterKind: (s, q) => ({ title: `${C(s, q.src)}: remove a counter?`, body: `If you remove one, its reflexive ability triggers.${oracle(s, q.src)}`, labels: Object.fromEntries(q.opts.map(o => [o.id, o.id === 'none' ? 'Remove nothing' : 'Remove a ' + o.id + ' counter (' + o.n + ' on it)'])) }),
    teamworkTap: (s, q) => ({ title: `Teamwork ${q.n}: tap creatures (total power ${q.total} so far)`, body: `Tap creatures you control until their total power is ${q.n} or more.`, labels: { done: 'Done tapping' } }),
    discardOrSac: (s, q) => ({ title: `${C(s, q.src)}: discard a card or sacrifice a permanent`, body: `An additional cost to cast it; you choose which.${oracle(s, q.src)}`, labels: { discard: 'Discard a card', sac: 'Sacrifice a permanent' } }),
    sacrificeCost: (s, q) => ({ title: `${C(s, q.src)}: sacrifice a permanent`, body: 'Sacrificing it is part of the cost. Click one of your glowing permanents.', labels: {} }),
    discardOrLife: (s, q) => ({ title: `${C(s, q.src)}: discard a card or pay ${q.life} life`, body: `An additional cost to cast it. Your life: ${s.players[q.who].life}.`, labels: { discard: 'Discard a card', life: 'Pay ' + q.life + ' life' } }),
    attackWhom: (s, q) => ({ title: `${C(s, q.src)} attacks whom?`, body: 'The defending player controls a planeswalker. Choose the player or a planeswalker for this attacker (CR 508.1b).', labels: Object.fromEntries(q.opts.map(o => [o.id, o.seat != null ? 'Attack the opponent' : 'Attack ' + MF.cards[MF.view(s).cards[o.iid].id].name])) }),
    ninjutsuReturn: (s, q) => ({ title: `Ninjutsu ${C(s, q.src)}: return an unblocked attacker`, body: 'Return one of your unblocked attacking creatures to your hand; this enters tapped and attacking in its place (CR 702.49).', labels: {} }),
    chooseObj: (s, q) => ({ title: `${C(s, q.src)}: choose up to one creature`, body: `Not targeted: chosen as it resolves.${oracle(s, q.src)}`, labels: { none: 'Choose none' } }),
    chooseFromGrave: (s, q) => ({ title: `${C(s, q.src)}: choose a card (${q.k} of up to ${q.n})`, body: 'Click a glowing card in your graveyard.', labels: { done: 'Done choosing' } }),
    sacrificeOne: (s, q) => ({ title: `${C(s, q.src)}: sacrifice a creature`, body: 'Choose which of your creatures with the greatest power to sacrifice.', labels: {} }),
    gift: (s, q) => ({ title: `${C(s, q.src)}: promise a gift?`, body: `Gift a ${q.what}: if you promise it, the opponent draws a card as this resolves, before its other effects (CR 702.174).${oracle(s, q.src)}`, labels: { yes: 'Promise the gift — the opponent draws a card', no: 'No gift' } }),
    handPick: (s, q) => ({ title: `${C(s, q.src)}: choose a card from ${q.from === T._viewer ? 'your' : 'the opponent’s'} hand`, body: `${q.then === 'exileUntil' ? 'Only you see their hand.' : 'The hand is revealed.'} Click the card to ${q.then === 'discard' ? 'make them discard' : 'exile'}${q.then === 'exileUntil' ? ' until this creature leaves the battlefield' : ''}.${oracle(s, q.src)}`, labels: { none: 'Exile nothing' } }),
    exploreGrave: (s, q) => ({ title: `${C(s, q.src)} explores: ${C(s, q.card)} is not a land`, body: 'It gets a +1/+1 counter. Keep the revealed card on top of your library, or put it into your graveyard (CR 701.44).', labels: { grave: 'Put it into the graveyard', top: 'Keep it on top' } }),
    wardPay: (s, q) => ({ title: `Ward: ${q.discard ? 'discard a card' : 'pay ' + (q.life != null ? q.life + ' life' : symbols(q.mana))}, or what targeted ${C(s, q.src)} is countered`, body: `${C(s, q.src)} has ward (CR 702.21). Your life: ${s.players[q.who].life}.`, labels: { pay: q.discard ? 'Discard a card' : 'Pay ' + (q.life != null ? q.life + ' life' : q.mana.replace(/[{}]/g, '')), decline: 'Don’t pay — it is countered' } }),
    pickMilled: (s, q) => ({ title: `${C(s, q.src)}: take a milled ${q.type} card?`, body: `You may put a ${q.type} card from among the cards you just milled into your hand.`, labels: { none: 'Take nothing' } }),
    dig: (s, q) => ({ title: `${C(s, q.src)}: the top ${q.n} cards of your library`, body: `Only you see these. You may reveal a ${q.type.toLowerCase()} card from among them; the rest go to the bottom in a random order.`, labels: { none: `Reveal no ${q.type.toLowerCase()}` } }),
    payLifeOrTap: (s, q) => ({ title: `${tag(q.c)} is entering: pay ${q.life} life?`, body: `If you pay ${q.life} life it enters untapped; if you don’t, it enters tapped (CR 614.12). Your life: ${s.players[q.who].life}.`, labels: { pay: `Pay ${q.life} life — enter untapped`, tapped: 'Enter tapped' } }),
    surveil: (s, q) => ({ title: `Surveil ${q.n}: card ${q.k} of ${q.n}`, body: 'Only you see these. Keep the card shown on top of your library, or put it into your graveyard.', labels: { top: 'Keep it on top', grave: 'Put it into the graveyard' } }),
    search: (s, q) => ({ title: `${C(s, q.src)}: search your library for a ${q.what}`, body: 'Choose one; your library is shuffled afterwards. You may find nothing.', labels: { none: 'Take nothing' } }),
    kicker: (s, q) => ({ title: `Kick ${C(s, q.src)} for an additional ${symbols(q.cost)}?`, body: `Kicker is an optional additional cost (CR 702.33).${oracle(s, q.src)}`, labels: { yes: 'Kick it — pay ' + q.cost.replace(/[{}]/g, '') + ' more', no: 'Cast it unkicked' } }),
    chooseKw: (s, q) => ({ title: `${C(s, q.src)}: choose what ${C(s, q.on)} gains`, body: 'It gains your choice until end of turn.', labels: Object.fromEntries(q.opts.map(o => [o.id, 'Give it ' + MF.KWNAME[o.id]])) }),
    discardUpTo: (s, q) => ({ title: `${C(s, q.src)}: discard up to ${q.n} cards`, body: `Click a card in your hand to discard it; you then draw as many as you discarded. ${q.done ? q.done + ' discarded so far.' : ''}`, labels: { done: q.done ? `Done — draw ${q.done}` : 'Discard nothing' } }),
    offspring: (s, q) => ({ title: `Pay offspring ${symbols(q.cost)} for ${C(s, q.src)}?`, body: 'If you pay it, when this creature enters you create a 1/1 token copy of it.', labels: { yes: 'Pay offspring ' + q.cost.replace(/[{}]/g, ''), no: 'Don’t pay it' } }),
    scry: (s, q) => ({ title: `Scry ${q.n}: card ${q.k} of ${q.n}`, body: 'Only you see these. Put the card shown on the top or the bottom of your library.', labels: { top: 'Keep it on top', bottom: 'Put it on the bottom' } }),
    scryOrder: (s, q) => ({ title: `Order the cards going to the ${q.where}`, body: q.where === 'top' ? 'Click the card you will draw first.' : 'Click the card that goes deepest first.', labels: {} }),
    lookTop: (s, q) => ({ title: `${C(s, q.src)}: the top card is a land`, body: 'You may put it onto the battlefield tapped. If you don’t, it goes into your hand.', labels: { yes: 'Put it onto the battlefield tapped', no: 'Put it into my hand' } }),
    may: (s, q) => q.what === 'oppDrawCopy'
      ? ({ title: `${C(s, q.src)}: copy that spell?`, body: 'If you let the opponent draw a card, you copy the spell, and may choose new targets for the copy.', labels: { yes: 'Opponent draws a card — copy it', no: 'Don’t copy' } })
      : q.what === 'discard' ? ({ title: `${C(s, q.src)}: discard a card?`, body: `You may discard a card.${oracle(s, q.src)}`, labels: { yes: 'Discard a card', no: 'Don’t discard' } })
      : q.what === 'returnFromGrave' ? ({ title: `${C(s, q.src)}: return it from your graveyard?`, body: `You may return this card from your graveyard to the battlefield.${oracle(s, q.src)}`, labels: { yes: 'Return it to the battlefield', no: 'Leave it' } })
      : q.what === 'search' ? ({ title: `${C(s, q.src)}: search for a basic land?`, body: 'You may search your library for a basic land card and put it onto the battlefield tapped, then shuffle.', labels: { yes: 'Search', no: 'Don’t search' } })
      : q.what === 'onceEachTurn' ? ({ title: `${C(s, q.src)}: deal ${q.n} damage${q.tgt ? ' to ' + (q.tgt.p != null ? (q.tgt.p === q.who ? 'yourself' : 'the opponent') : tag(MF.view(s).cards[q.tgt.c].id)) : ''}?`, body: `You may do this only once each turn. If you decline, you can still do it later this turn.${oracle(s, q.src)}`, labels: { yes: `Deal ${q.n} damage`, no: 'Not now' } })
      : q.what === 'searchCards' ? ({ title: `${C(s, q.src)}: search your library?`, body: `You may search for the cards it names, reveal them and put them into your hand, then shuffle.${oracle(s, q.src)}`, labels: { yes: 'Search', no: 'Don’t search' } })
      : q.what === 'mill' ? ({ title: `${C(s, q.src)}: mill a card?`, body: `You may put the top card of your library into your graveyard.${oracle(s, q.src)}`, labels: { yes: 'Mill the top card', no: 'Don’t mill' } })
      : q.what === 'digOnto' ? ({ title: `Put ${tag(q.c)} onto the battlefield?`, body: 'Its mana value is low enough: it may go onto the battlefield and gain haste until end of turn. Otherwise it goes into your hand.', labels: { yes: 'Onto the battlefield, with haste', no: 'Into my hand' } })
      : ({ title: `${C(s, q.src)}`, body: oracle(s, q.src), labels: { yes: 'Yes', no: 'No' } }),
    newTargets: (s, q) => ({ title: `Change ${q.slots > 1 ? 'target ' + (q.slot + 1) + ' of ' + q.slots : 'the target'} of the copy of ${C(s, q.src)}?`, body: 'You may keep the original target or choose a new one (CR 707.10c). A target with no legal new choice stays as it is.', labels: { keep: 'Keep this target', new: 'Choose a new target' } }),
    enterAsCopy: (s, q) => q.fromGrave ? ({ title: `${C(s, q.src)}: enter as a copy of a creature card in a graveyard?`, body: `Click a glowing card in either graveyard; it keeps its own name and becomes a 4/4 Spider Human Hero in addition, and the card is then exiled.${oracle(s, q.src)}`, labels: { no: 'Enter as itself' } }) : ({ title: `${C(s, q.src)}: enter as a copy?`, body: `It may enter as a copy of a creature with mana value ${q.spent} or less (the mana spent to cast it), and it is also a Bird with flying. Click a glowing creature, or decline.`, labels: { no: 'Enter as itself' } }),
  };
  const poolStr = p => p ? ['W', 'U', 'B', 'R', 'G', 'C'].map(k => sym(k).repeat(p[k] || 0)).join('') : '';
  T.poolStr = poolStr;
  T.prompts = PROMPTS;
  T.prompt = function (s, q, viewer) {
    const f = PROMPTS[q.kind];
    if (!f) throw new Error('question kind with no prompt: ' + q.kind);
    T._viewer = viewer;
    return f(s, q);
  };
  // What Pass means right now, in words.
  T.passLabel = function (s, me) {
    if (s.stack.length) {
      const L = s.stack[s.stack.length - 1];
      const id = L.kind === 'spell' ? L.id : L.srcId;
      return `Pass — let ${MF.cards[id].name}${L.kind === 'spell' ? '' : '’s ability'} resolve`;
    }
    if (s.ap !== me) return 'Pass';
    return { upkeep: 'Pass — to draw', draw: 'Pass — to main phase', main1: 'Pass — to combat', boc: 'Pass — declare attackers', attackers: 'Pass — to blockers', blockers: 'Pass — to damage', fsdamage: 'Pass — regular damage', damage: 'Pass — end combat', eoc: 'Pass — to second main', main2: 'Pass — end turn', end: 'Pass — end turn', cleanup: 'Pass' }[s.step];
  };
  void AB_NAME; void STEP_WORD;
})();
