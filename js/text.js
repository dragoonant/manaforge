// Every player-facing sentence: log lines and prompts. One line per engine log type and one prompt
// per question kind; a type or kind with none fails tools/check-pages.mjs, because an event the
// player cannot read did not happen as far as they can tell. The engine logs by seat; second
// person is applied here, at the last moment (CARD-LOG-AND-TARGETING-SPEC §2).
(function () {
  'use strict';
  const MF = window.MF;
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // Mana symbols, drawn by this project in CSS (docs/rights.md rule 1).
  const sym = t => {
    if (t === 'T') return '<span class="ms ms-T" title="tap">⟳</span>';
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
    cast: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'cast', 'casts')} ${e.face ? '<b>' + esc(e.face) + '</b> (the ' + (e.alt === 'omen' ? 'Omen' : e.alt === 'door' ? 'door' : 'Adventure') + ' of ' + tag(e.c) + ')' : tag(e.c)}${e.gift ? ', promising a gift' : ''}${e.x != null ? ' with X = ' + e.x : ''}${e.from === 'exile' ? ' from exile' : ''}${e.offspring ? ', paying offspring' : ''}${e.kicked ? ', kicked' : ''}${(e.tg || []).flat().length ? ', targeting ' + tgs(e.tg) : ''}.`,
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
    exiledFromHand: (e, v) => `${tag(e.c)} is exiled from ${T.whose(e.who, v)} hand${e.by ? ' by ' + tag(e.by) : ''}.`,
    mayCastExiled: (e, v) => `${W(e.who, v)} may cast ${tag(e.c)} while it remains exiled, spending mana of any type.`,
    stunUntap: (e) => `${tag(e.c)} stays tapped: a stun counter is removed instead (${e.left} left).`,
    returnGone: (e) => `<span class="notice">${tag(e.c)} is no longer in the graveyard; nothing returns.</span>`,
    surveil: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'surveil', 'surveils')} ${e.n}: ${e.top} kept on top${e.grave.length ? ', ' + list(e.grave) + ' to the graveyard' : ''}.`,
    searchNothing: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'search', 'searches')} and ${V(e.who, v, 'find', 'finds')} nothing to take.`,
    untapped: (e) => `${tag(e.c)} untaps.`,
    lookedAt: (e, v) => e.who === v ? `You look at ${list(e.cs)} — no ${e.type.toLowerCase()} card among them.` : `The opponent looks at the top ${plural(e.cs.length, 'card')} of their library and reveals no ${e.type.toLowerCase()} card.`,
    mill: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'mill', 'mills')} ${list(e.cs)}.`,
    extraCombatAdded: (e, v) => `There will be an additional combat phase after this one.`,
    extraCombat: (e, v) => `<span class="turnline">Additional combat phase</span>`,
    fight: (e) => `${tag(e.a)} fights ${tag(e.b)}.`,
    noFight: () => `<span class="notice">The fight does not happen: one of the two is gone or is no longer a creature.</span>`,
    exiled: (e, v) => `${tag(e.c)} is exiled from ${T.whose(e.who, v)} graveyard${e.by ? ' by ' + tag(e.by) : ''}.`,
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
    token: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'create', 'creates')} a ${MF.cards[e.c].power}/${MF.cards[e.c].toughness} ${tag(e.c)} token.`,
    tokenCopy: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'create', 'creates')} a 1/1 token copy of ${tag(e.c)}.`,
    noSource: () => `<span class="notice">The damage source is gone; no damage is dealt.</span>`,
    putOnto: (e, v) => `${W(e.who, v)} ${V(e.who, v, 'put', 'puts')} ${tag(e.c)} onto the battlefield${e.tapped ? ' tapped' : ''} from the ${e.from}${e.ctr ? ' with ' + Object.entries(e.ctr).map(([k, n]) => n + ' ' + k + ' counter' + (n === 1 ? '' : 's')).join(', ') : ''}.`,
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
      return { title: `Choose a target for ${C(s, q.src)}${slotText}`, body: `Glowing cards and players can be chosen. ${q.upTo || q.picked.length ? 'You may stop choosing.' : ''}${oracle(s, q.src)}`, labels: { done: q.picked.length ? 'Done choosing targets' : 'Choose no target', p0: T._viewer === 0 ? 'Target yourself' : 'Target the opponent', p1: T._viewer === 1 ? 'Target yourself' : 'Target the opponent' } };
    },
    attack: (s, q) => ({ title: q.chosen.length ? `Attacking with ${plural(q.chosen.length, 'creature')}` : 'Declare attackers', body: 'Click your creatures to attack with them; attacking taps a creature unless it has vigilance. Then confirm. Creatures with summoning sickness (entered this turn, without haste) cannot attack.', labels: { done: q.chosen.length ? `Attack with ${plural(q.chosen.length, 'creature')}` : 'Don’t attack', undo: 'Undo the last' } }),
    block: (s, q) => { const n = Object.keys(q.assign).length; return { title: n ? `Blocking with ${plural(n, 'creature')}` : 'Declare blockers', body: 'Click one of your untapped creatures, then choose which attacker it blocks. Flying attackers can be blocked only by flying or reach; menace needs two or more blockers.', labels: { done: n ? `Confirm ${plural(n, 'block')}` : 'Don’t block', undo: 'Undo the last' } }; },
    assign: (s, q) => ({ title: `${C(s, q.src)}: assign combat damage`, body: `${q.left} damage left to assign. How much goes to ${C(s, q.to)}? Lethal for it is <b>${q.lethal}</b>.${q.trample ? ' With trample, the rest goes to the defending player once every blocker has lethal damage.' : ' The rest goes to the other blockers.'}`, labels: Object.fromEntries(q.opts.map(o => [o.id, o.n + ' to ' + MF.cards[MF.view(s).cards[q.to].id].name + (q.trample ? ', ' + (q.left - o.n) + ' on' : '')])) }),
    legend: (s, q) => ({ title: 'Legend rule: keep one', body: 'You control two legendary permanents with the same name. Choose the one to keep; the other goes to the graveyard (CR 704.5j).', labels: {} }),
    trigOrder: (s, q) => ({ title: 'Order your triggered abilities', body: `Several of your abilities triggered at once. Click the one to put on the stack next — ${q.placed ? q.placed + ' placed so far; ' : ''}the first you choose resolves <b>last</b> (CR 603.3b).`, labels: Object.fromEntries(q.opts.map(o => [o.id, MF.cards[o.trig.src].name + (o.trig.inl === 'prowess' ? ' — prowess' : '')])) }),
    x: (s, q) => ({ title: `Choose X for ${C(s, q.src)}`, body: `X is announced before you pay (CR 601.2b).${oracle(s, q.src)}`, labels: Object.fromEntries(q.opts.map(o => [o.id, 'X = ' + o.id])) }),
    mode: (s, q) => ({ title: `Choose a mode for ${C(s, q.src)}`, body: `Choose one; the mode is chosen as you cast it (CR 700.2). A mode whose targets can’t be chosen isn’t offered.${oracle(s, q.src)}`, labels: Object.fromEntries(q.opts.map(o => [o.id, o.text])) }),
    gift: (s, q) => ({ title: `${C(s, q.src)}: promise a gift?`, body: `Gift a ${q.what}: if you promise it, the opponent draws a card as this resolves, before its other effects (CR 702.174).${oracle(s, q.src)}`, labels: { yes: 'Promise the gift — the opponent draws a card', no: 'No gift' } }),
    handPick: (s, q) => ({ title: `${C(s, q.src)}: choose a card from ${q.from === T._viewer ? 'your' : 'the opponent’s'} hand`, body: `The hand is revealed. Click the card to ${q.then === 'discard' ? 'make them discard' : 'exile'}.${oracle(s, q.src)}`, labels: {} }),
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
      : q.what === 'mill' ? ({ title: `${C(s, q.src)}: mill a card?`, body: `You may put the top card of your library into your graveyard.${oracle(s, q.src)}`, labels: { yes: 'Mill the top card', no: 'Don’t mill' } })
      : q.what === 'digOnto' ? ({ title: `Put ${tag(q.c)} onto the battlefield?`, body: 'Its mana value is low enough: it may go onto the battlefield and gain haste until end of turn. Otherwise it goes into your hand.', labels: { yes: 'Onto the battlefield, with haste', no: 'Into my hand' } })
      : ({ title: `${C(s, q.src)}`, body: oracle(s, q.src), labels: { yes: 'Yes', no: 'No' } }),
    newTargets: (s, q) => ({ title: `Change ${q.slots > 1 ? 'target ' + (q.slot + 1) + ' of ' + q.slots : 'the target'} of the copy of ${C(s, q.src)}?`, body: 'You may keep the original target or choose a new one (CR 707.10c). A target with no legal new choice stays as it is.', labels: { keep: 'Keep this target', new: 'Choose a new target' } }),
    enterAsCopy: (s, q) => ({ title: `${C(s, q.src)}: enter as a copy?`, body: `It may enter as a copy of a creature with mana value ${q.spent} or less (the mana spent to cast it), and it is also a Bird with flying. Click a glowing creature, or decline.`, labels: { no: 'Enter as itself' } }),
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
