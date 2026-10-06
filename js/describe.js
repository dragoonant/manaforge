// What the engine will do with a compiled card, in words. tools/audit-cards.mjs diffs this
// against the Oracle text; the interface shows it under "What the engine reads". Every op needs
// a describer here or MF.validate refuses to load.
(function () {
  'use strict';
  const MF = window.MF;
  const KWNAME = { flying: 'flying', reach: 'reach', firstStrike: 'first strike', doubleStrike: 'double strike', deathtouch: 'deathtouch', lifelink: 'lifelink', trample: 'trample', vigilance: 'vigilance', haste: 'haste', menace: 'menace', defender: 'defender', flash: 'flash', hexproof: 'hexproof', indestructible: 'indestructible', prowess: 'prowess', shroud: 'shroud' };
  MF.KWNAME = KWNAME;
  const N = n => typeof n === 'number' ? String(n) : n.v === 'x' ? 'X' : n.v === 'creatures' ? 'the number of creatures you control' : n.v === 'power' ? 'its power' : n.v === 'castNoncreature' ? 'the number of noncreature spells that player has cast this turn' : n.v === 'evAmount' ? 'that much' : n.v === 'kicked' ? n.no + ' (' + n.yes + ' if kicked)' : '?';
  function filt(f) {
    if (!f) return 'anything';
    if (f.any) return 'any target';
    if (f.player) return f.player === 'opp' ? 'opponent' : f.player === 'you' ? 'you' : 'player';
    const w = [];
    if (f.other) w.push('other');
    if (f.notTypes) w.push('non' + f.notTypes.join('/').toLowerCase());
    w.push(f.types ? f.types.join('/').toLowerCase() : f.subtypes ? f.subtypes.join('/') : f.tok ? 'token' : 'permanent');
    if (f.ctrl === 'you') w.push('you control'); if (f.ctrl === 'opp') w.push('an opponent controls');
    if (f.powLE != null) w.push('with power ' + f.powLE + ' or less');
    if (f.powGE != null) w.push('with power ' + f.powGE + ' or greater');
    if (f.ptGE != null) w.push('with power or toughness ' + f.ptGE + ' or greater');
    if (f.touGtPow) w.push('with toughness greater than its power');
    if (f.counter) w.push('with a ' + f.counter + ' counter');
    if (f.kw) w.push('with ' + KWNAME[f.kw]); if (f.notKw) w.push('without ' + KWNAME[f.notKw]);
    if (f.tokOrSub) w.push('that is a token or a ' + f.tokOrSub);
    return w.join(' ');
  }
  MF.describeFilter = filt;
  let curTg = [];
  function ref(r) {
    if (r === 'self') return 'this';
    if (r === 'enchanted') return 'the enchanted creature';
    if (r === 'equipped') return 'the equipped creature';
    if (r === 'ev') return 'that creature';
    if (r === 'it') return 'that card';
    if (r === 'eachOpp') return 'each opponent';
    if (r === 'you') return 'you';
    if (r.t != null) { const sl = curTg[r.t] || {}; return (sl.upTo ? 'up to ' + sl.n + ' ' : '') + (sl.f && sl.f.any ? 'any target' : 'target ' + filt(sl.f)) + ' [' + (r.t + 1) + ']'; }
    if (r.each) return 'each ' + filt(r.each);
    return JSON.stringify(r);
  }
  const C = {
    control: c => 'you control ' + (c.n > 1 ? c.n + ' or more ' : 'a ') + filt(c.f),
    totalPower: c => 'creatures you control have total power ' + c.n + ' or greater',
    did: () => 'you did',
    enteredOther: () => 'another creature entered the battlefield under your control this turn',
    offspringPaid: () => 'its offspring cost was paid',
    firstOfKind: () => 'that spell is your first instant, first sorcery, or first Otter spell other than this this turn',
    kicked: () => 'this spell was kicked',
    graveCount: c => 'there are ' + c.n + ' or more cards in your graveyard',
    oppLostLife: () => 'an opponent lost life this turn',
  };
  const cond = c => (C[c.c] ? C[c.c](c) : c.c);
  MF.describeCond = cond;
  const D = MF.describeOp = {
    counter: op => 'put ' + N(op.n) + ' ' + op.kind + ' counter' + (op.n === 1 ? '' : 's') + ' on ' + ref(op.on),
    doubleCounters: op => 'double the ' + op.kind + ' counters on ' + ref(op.on),
    tap: op => 'tap ' + ref(op.on),
    pump: op => { const pt = (op.p != null || op.t != null) && (op.p !== 0 || op.t !== 0); return ref(op.on) + (pt ? ' gets ' + sgn(op.p) + '/' + sgn(op.t) : '') + (op.grant ? (pt ? ' and' : '') + ' gains ' + op.grant.map(k => KWNAME[k]).join(', ') : '') + ' until end of turn'; },
    unblockable: op => ref(op.on) + ' can’t be blocked this turn',
    scry: op => 'scry ' + N(op.n),
    token: op => 'create ' + N(op.n) + ' ' + MF.cards[op.id].power + '/' + MF.cards[op.id].toughness + ' ' + MF.cards[op.id].colors.map(c => MF.COLOR_NAME[c]).join(' ') + ' ' + MF.cards[op.id].name + ' creature token' + (op.n === 1 ? '' : 's'),
    tokenCopy: op => 'create a token copy of ' + ref(op.of) + (op.except && op.except.pt ? ', except it is ' + op.except.pt.join('/') : ''),
    destroy: op => 'destroy ' + ref(op.on),
    damage: op => ref(op.from) + ' deals ' + N(op.n) + ' damage to ' + ref(op.to),
    draw: op => (op.who ? ref(op.who) + ' draws ' : 'draw ') + N(op.n) + ' card' + (op.n === 1 ? '' : 's'),
    discard: op => 'discard ' + op.n + ' card' + (op.n === 1 ? '' : 's') + ' of your choice',
    gain: op => 'gain ' + N(op.n) + ' life',
    lookTop: op => 'look at the top card of your library; if it is a ' + op.type.toLowerCase() + ', you may put it onto the battlefield tapped, otherwise put it into your hand',
    revealUntil: op => 'reveal from the top until a ' + op.type.toLowerCase() + '; put it onto the battlefield tapped, the rest on the bottom in a random order',
    impulse: () => 'exile the top card of your library; you may play it until the end of your next turn',
    attach: op => 'attach this to ' + ref(op.on),
    may: op => 'you may: ' + ops(op.ops),
    if: op => 'if ' + cond(op.cond) + ': ' + ops(op.ops),
    copySpell: () => 'copy that spell; you may choose new targets for the copy',
    pumpChoice: op => ref(op.on) + ' gains your choice of ' + op.kws.map(k => KWNAME[k]).join(' or ') + ' until end of turn',
    animate: op => ref(op.on) + ' becomes a ' + op.p + '/' + op.t + ' creature with ' + op.kws.map(k => KWNAME[k]).join(', ') + (op.allTypes ? ' and all creature types' : '') + ', still a land',
    role: op => 'create a ' + op.role + ' Role token attached to ' + ref(op.on),
    discardUpTo: op => 'discard up to ' + op.n + ' cards, then draw that many',
    graveImpulse: () => 'exile a card at random from your graveyard; you may play it this turn',
    noLifeGain: op => 'a player dealt damage this way can’t gain life for the rest of the game',
  };
  const sgn = v => v == null ? '+0' : typeof v === 'number' ? (v >= 0 ? '+' + v : String(v)) : '+' + N(v);
  function ops(list) { return (list || []).map(op => D[op.o](op)).join('; then '); }
  const EV = { enters: 'enters', attacks: 'attacks', cast: 'you cast', dealsDamage: 'deals damage', sacrificed: 'you sacrifice it', beginStep: 'at the beginning of', dies: 'dies', dealtDamage: 'is dealt damage', targeted: 'becomes the target of a spell or ability you control for the first time each turn' };
  function who(w) { if (w === 'self') return 'this'; if (w && w.or) return w.or.map(who).join(' or '); return 'a ' + filt(w); }
  MF.describeAbility = function (a) {
    curTg = a.tg || [];
    switch (a.k) {
      case 'mana': return (a.cost.tap ? '{T}' : '') + ': add ' + a.cols.map(c => '{' + c + '}').join(' or ');
      case 'act': return [a.cost.mana, a.cost.tap ? '{T}' : '', a.cost.sacSelf ? 'sacrifice this' : ''].filter(Boolean).join(', ') + ': ' + ops(a.ops) + (a.sorcery ? ' (only as a sorcery)' : '');
      case 'trig': {
        let e;
        if (a.on === 'cast') e = 'Whenever ' + (a.anyPlayer ? 'a player casts' : 'you cast') + ' a ' + (a.spell && a.spell.notTypes ? 'non' + a.spell.notTypes.join('').toLowerCase() + ' ' : '') + 'spell';
        else if (a.on === 'beginStep') e = 'At the beginning of ' + ({ boc: 'combat', upkeep: 'upkeep', end: 'the end step' }[a.step] || a.step) + (a.yours ? ' on your turn' : '');
        else if (a.on === 'attackWith') e = 'Whenever you attack with one or more ' + a.sub + 's';
        else if (a.on === 'dealsDamage') e = 'Whenever this deals damage' + (a.toOpp ? ' to an opponent' : '');
        else if (a.on === 'sacrificed') e = 'When you sacrifice this';
        else e = 'Whenever ' + who(a.who) + ' ' + EV[a.on];
        return e + (a.cond ? ', if ' + cond(a.cond) : '') + ': ' + ops(a.ops);
      }
      case 'static': return (a.cond ? 'As long as ' + cond(a.cond) + ', ' : '') + (typeof a.affects === 'string' ? (a.affects === 'self' ? 'this' : 'the ' + a.affects + ' creature') : 'each ' + filt(a.affects)) + (a.p || a.t ? ' gets ' + sgn(a.p) + '/' + sgn(a.t) : '') + (a.grant ? ' has ' + a.grant.map(k => KWNAME[k]).join(', ') : '');
      case 'cda': return 'power and toughness each equal ' + N(a.v);
      case 'noUntap': return 'the enchanted creature doesn’t untap during its controller’s untap step';
      case 'etbTapped': return 'enters tapped';
      case 'enchant': return 'enchant ' + filt(a.f);
      case 'costLess': return 'costs {' + a.n + '} less if ' + cond(a.cond);
      case 'costLessFor': return a.spell.types.join(' and ').toLowerCase() + ' spells you cast cost {' + a.n + '} less';
      case 'spell': return ops(a.ops);
      case 'offspring': return 'offspring ' + a.cost + ' (an optional additional cost)';
      case 'kicker': return 'kicker ' + a.cost + ' (an optional additional cost)';
      case 'enterAsCopy': return 'may enter as a copy of a creature with mana value up to the mana spent, except it is also a ' + a.except.addSubtypes.join(' ') + ' and has ' + a.except.kw.map(k => KWNAME[k]).join(', ');
      default: return a.k;
    }
  };
  MF.describeCard = function (d) {
    const kws = Object.keys(d.kw).map(k => KWNAME[k] + (d.kw[k] > 1 ? ' ×' + d.kw[k] : ''));
    return (kws.length ? [kws.join(', ')] : []).concat(d.ab.map(MF.describeAbility));
  };
})();
