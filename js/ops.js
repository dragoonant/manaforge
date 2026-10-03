// The effect vocabulary. tools/build-cards.mjs compiles Oracle text into these filters,
// conditions, values and ops; an op with no handler or no describer is rejected at load
// (MF.validate), so neither half can be forgotten.
(function () {
  'use strict';
  const MF = window.MF;
  const I = (s, iid) => s.cards[iid];
  const P = (s, seat) => s.players[seat];
  const log = MF.log;

  // -------------------------------------------------------------------------------------------
  // Filters. One grammar for "creature you control with power 2 or less", "nonland permanent an
  // opponent controls", "any target". `ch` is the object's characteristics (from MF.chars, or a
  // layer-in-progress table inside the characteristics door).
  // -------------------------------------------------------------------------------------------
  MF.matchChars = function (s, iid, ch, f, who, srcIid) {
    if (!f) return true;
    if (f.any) return ch.types.some(t => t === 'Creature' || t === 'Planeswalker' || t === 'Battle');   // CR 115.4: "any target"
    if (f.player) return false;
    if (f.types && !f.types.some(t => ch.types.includes(t))) return false;
    if (f.notTypes && f.notTypes.some(t => ch.types.includes(t))) return false;
    if (f.subtypes && !f.subtypes.some(t => ch.subtypes.includes(t))) return false;
    if (f.ctrl === 'you' && ch.ctrl !== who) return false;
    if (f.ctrl === 'opp' && ch.ctrl === who) return false;
    if (f.other && iid === srcIid) return false;
    if (f.kw && !ch.kw[f.kw]) return false;
    if (f.notKw && ch.kw[f.notKw]) return false;
    if (f.powLE != null && !(ch.p <= f.powLE)) return false;
    if (f.powGE != null && !(ch.p >= f.powGE)) return false;
    if (f.ptGE != null && !(ch.p >= f.ptGE || ch.t >= f.ptGE)) return false;
    if (f.touGtPow && !(ch.t > ch.p)) return false;
    if (f.counter && !((I(s, iid).ctr[f.counter] || 0) > 0)) return false;
    if (f.tok && !I(s, iid).tok) return false;
    if (f.tokOrSub && !(I(s, iid).tok || ch.subtypes.includes(f.tokOrSub))) return false;
    if (f.mvLE != null && !(ch.mv <= f.mvLE)) return false;
    return true;
  };
  MF.matchPlayer = function (s, seat, f, who) {
    if (f.any) return true;
    if (!f.player) return false;
    if (f.player === 'opp') return seat !== who;
    if (f.player === 'you') return seat === who;
    return true;
  };
  MF.slotTakesPlayers = f => !!(f.any || f.player);
  MF.slotTakesObjects = f => !!(f.any || !f.player);
  const countMine = (s, who, f, src, table) => s.bf.filter(i => { const ch = table ? table[i] : MF.chars(s, i); return MF.matchChars(s, i, ch, Object.assign({ ctrl: 'you' }, f), who, src); }).length;

  // -------------------------------------------------------------------------------------------
  // Conditions. x = { s, ctrl, src, L, ev, t, flags }. A static's condition is read inside the
  // characteristics door with the table so far (MF.condStatic), never by calling back into it.
  // -------------------------------------------------------------------------------------------
  const CONDS = {
    control: (x, c, table) => countMine(x.s, x.ctrl, c.f, x.src, table) >= (c.n || 1),
    totalPower: x => x.s.bf.filter(i => I(x.s, i).ctrl === x.ctrl && MF.isType(x.s, i, 'Creature')).reduce((a, i) => a + Math.max(0, MF.chars(x.s, i).p), 0) >= x.c.n,
    did: x => !!x.flags.did,
    enteredOther: x => (P(x.s, x.ctrl).h.enteredIids || []).some(i => i !== x.src),
    offspringPaid: x => { const c = I(x.s, x.src); return !!(c && c.offspringPaid); },
    // Alania: "if it's the first instant spell, the first sorcery spell, or the first Otter spell
    // other than Alania you've cast this turn" — counted from this turn's cast record up to that spell.
    firstOfKind: x => {
      const ev = x.ev, list = P(x.s, x.ctrl).h.castList || [];
      const k = list.findIndex(e => e.lid === ev.lid); if (k < 0) return false;
      const me = list[k], before = list.slice(0, k), srcName = x.lki ? x.lki.name : MF.chars(x.s, x.src).name;
      if (me.types.includes('Instant') && !before.some(e => e.types.includes('Instant'))) return true;
      if (me.types.includes('Sorcery') && !before.some(e => e.types.includes('Sorcery'))) return true;
      const otter = e => e.subtypes.includes('Otter') && e.name !== srcName;
      if (otter(me) && !before.some(otter)) return true;
      return false;
    },
  };
  MF.conds = CONDS;
  MF.cond = function (x, c) {
    if (!c) return true;
    const f = CONDS[c.c];
    if (!f) throw new Error('no condition handler: ' + c.c);
    return f(Object.assign({}, x, { c: c }), c, null);
  };
  MF.condStatic = function (s, src, c, table) {
    const f = CONDS[c.c];
    if (!f) throw new Error('no condition handler: ' + c.c);
    return f({ s: s, ctrl: table[src].ctrl, src: src, c: c, flags: {} }, c, table);
  };

  // Values: a literal, or { v: name } read when the effect is applied (CR 608.2h).
  const VALS = {
    creatures: (x, v, table) => countMine(x.s, x.ctrl, { types: ['Creature'] }, x.src, table),
    x: x => x.L.x || 0,
    power: (x, v) => { const r = MF.resolveRefs(x, v.of)[0]; return r != null ? MF.chars(x.s, r).p : (x.lastPower != null ? x.lastPower : 0); },
  };
  MF.vals = VALS;
  const num = MF.num = function (x, v) { if (typeof v === 'number') return v; const f = VALS[v.v]; if (!f) throw new Error('no value: ' + v.v); return f(x, v, null); };
  MF.valueStatic = function (s, src, v, table) { const f = VALS[v.v]; if (!f) throw new Error('no value: ' + v.v); return f({ s: s, ctrl: table[src].ctrl, src: src }, v, table); };

  // -------------------------------------------------------------------------------------------
  // Trigger matching (CR 603.2). `src` is the source's characteristics or its last known
  // information; `a` is the compiled ability.
  // -------------------------------------------------------------------------------------------
  const subject = (s, iid, src, who, evIid) => {
    if (who === 'self') return evIid === iid;
    if (who.or) return who.or.some(w => subject(s, iid, src, w, evIid));
    const c = s.cards[evIid]; if (!c || c.zone !== 'bf') return false;
    return MF.matchChars(s, evIid, MF.chars(s, evIid), who, src.ctrl, iid);
  };
  MF.trigMatch = function (s, iid, src, a, ev) {
    switch (ev.t) {
      case 'enters': case 'attacks': case 'blocks': case 'becomesBlocked': return subject(s, iid, src, a.who, ev.iid);
      case 'cast': return ev.ctrl === src.ctrl && (!a.spell || ((!a.spell.notTypes || !a.spell.notTypes.some(t => ev.types.includes(t))) && (!a.spell.types || a.spell.types.some(t => ev.types.includes(t)))));
      case 'dealsDamage': return ev.src === iid && (!a.toOpp || (ev.to.p != null && ev.to.p !== src.ctrl)) && (!a.combat || ev.combat);
      case 'sacrificed': case 'dies': case 'leaves': return ev.iid === iid;
      case 'beginStep': return ev.step === a.step && (!a.yours || ev.ap === src.ctrl);
      case 'gainLife': return ev.who === src.ctrl;
      default: return false;
    }
  };
  MF.PROWESS = { k: 'trig', on: 'cast', ops: [{ o: 'pump', on: 'self', p: 1, t: 1 }] };   // CR 702.108a

  // -------------------------------------------------------------------------------------------
  // References: which objects an op acts on.
  //   { t: n }   the objects chosen for target slot n (legal ones only, CR 608.2b)
  //   'self'     the source, if it is still the object it was
  //   'enchanted' / 'equipped'  what the source is attached to
  //   'ev'       the object the trigger event names ("that creature")
  //   { each: f } every permanent matching f, as the effect begins (CR 611.2c)
  //   'it'       the card the previous op moved ("that card")
  // -------------------------------------------------------------------------------------------
  MF.resolveRefs = function (x, r) {
    const s = x.s;
    const onBf = i => i != null && s.cards[i] && s.cards[i].zone === 'bf';
    if (r == null) return [];
    if (r === 'self') return onBf(x.src) ? [x.src] : [];
    if (r === 'enchanted' || r === 'equipped') { const c = s.cards[x.src]; return c && c.zone === 'bf' && onBf(c.att) ? [c.att] : []; }
    if (r === 'ev') return onBf(x.ev && x.ev.iid) ? [x.ev.iid] : [];
    if (r === 'it') return x.it != null ? [x.it] : [];
    if (r.t != null) return (x.t[r.t] || []).filter(q => q && q.c != null).map(q => q.c);
    if (r.each) return s.bf.filter(i => MF.matchChars(s, i, MF.chars(s, i), r.each, x.ctrl, x.src));
    throw new Error('unknown reference ' + JSON.stringify(r));
  };
  const players = (x, r) => {
    if (r === 'you') return [x.ctrl];
    if (r === 'eachOpp') return [1 - x.ctrl];
    if (r && r.t != null) return (x.t[r.t] || []).filter(q => q && q.p != null).map(q => q.p);
    return [];
  };
  // The damage source's characteristics: the object if it is still where it was, else its last
  // known information (CR 608.2h). A spell deals damage from the stack.
  function srcChars(x, from) {
    const s = x.s;
    if (from === 'self') {
      const c = s.cards[x.src];
      if (c && (c.zone === 'bf' || c.zone === 'stack')) return Object.assign({ id: c.id }, MF.chars(s, x.src));
      if (x.lki) return Object.assign({ iid: x.src }, x.lki, { kw: x.lki.kw, ctrl: x.lki.ctrl });
      return null;
    }
    const r = MF.resolveRefs(x, from)[0];
    return r != null ? Object.assign({ id: s.cards[r].id }, MF.chars(s, r)) : null;
  }

  // -------------------------------------------------------------------------------------------
  // Ops
  // -------------------------------------------------------------------------------------------
  const OPS = {
    counter(x, op) {                                                                           // CR 122.1
      for (const i of MF.resolveRefs(x, op.on)) {
        const c = I(x.s, i); const n = num(x, op.n);
        c.ctr[op.kind] = (c.ctr[op.kind] || 0) + n;
        log(x.s, 'counter', { who: c.ctrl, c: c.id, n: n, kind: op.kind, src: x.L ? x.L.srcId || I(x.s, x.src).id : null });
        MF.emit(x.s, { t: 'counterPut', iid: i, n: n, kind: op.kind });
      }
    },
    doubleCounters(x, op) {                                                                    // "double the number of +1/+1 counters on it" (CR 701.10e: put that many more)
      for (const i of MF.resolveRefs(x, op.on)) {
        const c = I(x.s, i), n = c.ctr[op.kind] || 0;
        if (!n) continue;
        c.ctr[op.kind] = 2 * n;
        log(x.s, 'counter', { who: c.ctrl, c: c.id, n: n, kind: op.kind, src: x.L.srcId });
      }
    },
    tap(x, op) { for (const i of MF.resolveRefs(x, op.on)) { const c = I(x.s, i); if (!c.tapped) { c.tapped = true; log(x.s, 'tapped', { who: c.ctrl, c: c.id }); } } },
    pump(x, op) {                                                                              // "gets +N/+N until end of turn", "gains <keyword>"
      const iids = MF.resolveRefs(x, op.on);
      const p = op.p == null ? 0 : num(x, op.p), t = op.t == null ? 0 : num(x, op.t);
      for (const i of iids) {
        if (p || t) x.s.effects.push({ k: 'pt', iid: i, p: p, t: t, until: 'eot', ts: x.s.ts++ });
        if (op.grant) x.s.effects.push({ k: 'grant', iid: i, kws: op.grant.slice(), until: 'eot', ts: x.s.ts++ });
      }
      if (iids.length) log(x.s, 'pump', { who: x.ctrl, cs: iids.map(i => I(x.s, i).id), p: p, tou: t, grant: op.grant || null, src: x.L ? x.L.srcId || x.L.id : null, all: !!(op.on && op.on.each) });
    },
    unblockable(x, op) { for (const i of MF.resolveRefs(x, op.on)) { x.s.effects.push({ k: 'unblockable', iid: i, until: 'eot' }); log(x.s, 'unblockable', { c: I(x.s, i).id }); } },
    scry(x, op) {                                                                              // CR 701.22a
      const s = x.s, p = P(s, x.ctrl), n = Math.min(num(x, op.n), p.lib.length);
      if (n <= 0) return;
      const look = p.lib.slice(0, n), bottom = [], top = [];
      for (const iid of look) {
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'scry', n: n, k: look.indexOf(iid) + 1, src: x.src, opts: [{ id: 'top', iid: iid }, { id: 'bottom', iid: iid }] });
        (a === 'top' ? top : bottom).push(iid);
      }
      const order = (arr, where) => {                                                          // "in any order": asked when there are two or more distinguishable cards
        const out = [], left = arr.slice();
        while (left.length > 1 && new Set(left.map(i => I(s, i).id)).size > 1) {
          const a = MF.ask(x.x, { who: x.ctrl, kind: 'scryOrder', where: where, opts: left.map(i => ({ id: i, iid: i })) });
          out.push(a); left.splice(left.indexOf(a), 1);
        }
        return out.concat(left);
      };
      const topOrder = order(top, 'top'), botOrder = order(bottom, 'bottom');
      p.lib.splice(0, n);
      p.lib.unshift.apply(p.lib, topOrder);
      p.lib.push.apply(p.lib, botOrder);
      log(s, 'scry', { who: x.ctrl, n: n, top: top.length, bottom: bottom.length });
    },
    token(x, op) {                                                                             // CR 111.1
      const s = x.s, n = num(x, op.n);
      for (let k = 0; k < n; k++) {
        const iid = s.nid++;
        s.cards[iid] = { iid: iid, id: op.id, owner: x.ctrl, ctrl: x.ctrl, zone: 'bf', ts: s.ts++, tapped: false, dmg: 0, dt: false, ctr: {}, att: null, ctlTurn: s.turn, tok: true };
        s.bf.push(iid);
        noteEntered(s, iid);
        log(s, 'token', { who: x.ctrl, c: op.id });
        MF.emit(s, { t: 'enters', iid: iid, ctrl: x.ctrl });
      }
    },
    // Offspring (CR 702.175a): "create a token that's a copy of it, except it's 1/1".
    tokenCopy(x, op) {
      const s = x.s, src = MF.resolveRefs(x, op.of)[0];
      const base = src != null ? I(s, src) : null;
      const id = base ? base.id : x.lki.id, copy = base && base.copy ? base.copy : null;
      const iid = s.nid++;
      const except = Object.assign({}, copy ? copy.except : {}, op.except);
      s.cards[iid] = { iid: iid, id: id, owner: x.ctrl, ctrl: x.ctrl, zone: 'bf', ts: s.ts++, tapped: false, dmg: 0, dt: false, ctr: {}, att: null, ctlTurn: s.turn, tok: true, copy: { id: copy ? copy.id : id, except: except } };
      s.bf.push(iid);
      noteEntered(s, iid);
      log(s, 'tokenCopy', { who: x.ctrl, c: id });
      MF.emit(s, { t: 'enters', iid: iid, ctrl: x.ctrl });
    },
    destroy(x, op) { for (const i of MF.resolveRefs(x, op.on)) MF.destroy(x.s, i, 'effect'); },
    damage(x, op) {                                                                            // CR 120
      const sc = srcChars(x, op.from);
      if (!sc) { log(x.s, 'noSource', { src: x.L.srcId || x.L.id }); return; }               // the source is gone and has no last known information: nothing deals the damage
      const n = num(x, op.n);
      for (const seat of players(x, op.to)) MF.dealDamage(x.s, { srcChars: sc, to: { p: seat }, n: n });
      if (op.to !== 'eachOpp' && op.to !== 'you') for (const i of MF.resolveRefs(x, op.to)) MF.dealDamage(x.s, { srcChars: sc, to: { c: i }, n: n });
    },
    draw(x, op) { for (const who of op.who ? players(x, op.who) : [x.ctrl]) MF.draw(x.s, who, num(x, op.n)); },
    discard(x, op) {                                                                           // "then discard a card": the player chooses
      const s = x.s, p = P(s, x.ctrl);
      for (let k = 0; k < op.n && p.hand.length; k++) {
        const iid = MF.ask(x.x, { who: x.ctrl, kind: 'discard', src: x.src, left: op.n - k, opts: p.hand.map(i => ({ id: i, iid: i })) });
        MF.discard(s, iid);
      }
    },
    gain(x, op) { MF.gainLife(x.s, x.ctrl, num(x, op.n), { name: x.L ? MF.cards[x.L.srcId || x.L.id].name : null }); },
    // Fecund Greenshell: "look at the top card of your library. If it's a land card, you may put it
    // onto the battlefield tapped. Otherwise, put it into your hand."
    lookTop(x, op) {
      const s = x.s, p = P(s, x.ctrl);
      if (!p.lib.length) return;
      const top = p.lib[0], d = MF.def(s, top);
      if (d.types.includes(op.type)) {
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'lookTop', src: x.src, opts: [{ id: 'yes', iid: top }, { id: 'no', iid: top }] });
        if (a === 'yes') { log(s, 'putOnto', { who: x.ctrl, c: d.id, tapped: true, from: 'library' }); MF.move(s, top, 'bf', { ctrl: x.ctrl, tapped: true }); }
        else log(s, 'lookedKept', { who: x.ctrl });
      } else { log(s, 'toHand', { who: x.ctrl, c: d.id, revealed: false, from: 'library' }); MF.move(s, top, 'hand'); }
    },
    // Clifftop Lookout: "reveal cards from the top of your library until you reveal a land card.
    // Put that card onto the battlefield tapped and the rest on the bottom of your library in a random order."
    revealUntil(x, op) {
      const s = x.s, p = P(s, x.ctrl), shown = [];
      let hit = null;
      for (const iid of p.lib) { shown.push(iid); if (MF.def(s, iid).types.includes(op.type)) { hit = iid; break; } }
      log(s, 'reveal', { who: x.ctrl, cs: shown.map(i => I(s, i).id) });
      const rest = shown.filter(i => i !== hit);
      if (hit != null) { const n = MF.move(s, hit, 'bf', { ctrl: x.ctrl, tapped: true }); log(s, 'putOnto', { who: x.ctrl, c: I(s, n).id, tapped: true, from: 'library' }); }
      for (const i of rest) p.lib.splice(p.lib.indexOf(i), 1);
      MF.shuffle(s, rest);
      p.lib.push.apply(p.lib, rest);
      if (rest.length) log(s, 'toBottom', { who: x.ctrl, n: rest.length, random: true });
    },
    // Alania's Pathmaker: "exile the top card of your library. Until the end of your next turn, you may play that card."
    impulse(x, op) {
      const s = x.s, p = P(s, x.ctrl);
      if (!p.lib.length) return;
      const id = I(s, p.lib[0]).id;
      const n = MF.move(s, p.lib[0], 'exile');
      const turn = s.ap === x.ctrl ? s.turn + 2 : s.turn + 1;                                   // the end of your next turn
      s.effects.push({ k: 'mayPlay', iid: n, who: x.ctrl, until: 'endOfTurn', turn: turn });
      log(s, 'impulse', { who: x.ctrl, c: id, until: turn });
      x.it = n;
    },
    attach(x, op) {                                                                            // CR 701.3, 702.6a
      const src = I(x.s, x.src), to = MF.resolveRefs(x, op.on)[0];
      if (!src || src.zone !== 'bf' || to == null) return;
      src.att = to; src.ts = x.s.ts++;                                                          // CR 613.7e
      log(x.s, 'attach', { who: x.ctrl, c: src.id, to: I(x.s, to).id });
    },
    may(x, op) {                                                                               // "you may": asked on resolution (CR 608.2d)
      const a = MF.ask(x.x, { who: x.ctrl, kind: 'may', src: x.src, what: op.what, opts: [{ id: 'yes' }, { id: 'no' }] });
      x.flags.did = a === 'yes';
      if (x.flags.did) MF.runOps(x, op.ops);
    },
    if(x, op) { if (MF.cond(x, op.cond)) MF.runOps(x, op.ops); },
    // Alania: "copy that spell. You may choose new targets for the copy." (CR 707.10, 707.10c)
    copySpell(x, op) {
      const s = x.s, L0 = s.stack.find(L => L.lid === x.ev.lid);
      if (!L0) { log(s, 'copyGone', { who: x.ctrl }); return; }                               // the spell has left the stack: there is nothing to copy (CR 707.10: last known information is not used for a copy of a spell that is gone in this engine — see DEVIATIONS)
      const c0 = I(s, L0.iid), iid = s.nid++;
      s.cards[iid] = { iid: iid, id: c0.id, owner: x.ctrl, ctrl: x.ctrl, zone: 'stack', ts: s.ts++, tapped: false, dmg: 0, dt: false, ctr: {}, att: null, ctlTurn: s.turn, copySpell: true };
      const L = { lid: s.lid++, kind: 'spell', ctrl: x.ctrl, iid: iid, id: c0.id, t: JSON.parse(JSON.stringify(L0.t)), x: L0.x, copy: true, spent: 0, from: 'copy' };
      const d = MF.cards[c0.id], sp = d.ab.find(a => a.k === 'spell'), aura = d.ab.find(a => a.k === 'enchant');
      const slots = sp && sp.tg ? sp.tg : aura ? [{ f: aura.f }] : [];
      if (slots.length) {
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'newTargets', src: iid, opts: [{ id: 'keep' }, { id: 'new' }] });
        if (a === 'new') L.t = MF.chooseTargets(x.x, x.ctrl, iid, slots, 'copy', false);
      }
      s.stack.push(L);
      log(s, 'copy', { who: x.ctrl, c: c0.id, tg: L.t.map(sl => sl.map(r => MF.refLabel(s, r))) });
    },
  };
  function noteEntered(s, iid) {                                                               // turn history: "if another creature entered the battlefield under your control this turn"
    const c = I(s, iid); if (!MF.isType(s, iid, 'Creature')) return;
    const h = P(s, c.ctrl).h; (h.enteredIids = h.enteredIids || []).push(iid);
  }
  MF.noteEntered = noteEntered;
  MF.ops = OPS;
  MF.runOps = function (x, ops) {
    for (const op of ops) {
      const f = OPS[op.o];
      if (!f) throw new Error('no op handler: ' + op.o);
      f(x, op);
      if (x.s.winner != null) return;
    }
  };

  // Mockingbird: "You may have this creature enter as a copy of any creature on the battlefield
  // with mana value less than or equal to the amount of mana spent to cast this creature, except
  // it's a Bird in addition to its other types and it has flying." (CR 707.2, 707.9a-b)
  MF.askEnterAsCopy = function (x, a, L) {
    const s = x.s;
    const opts = s.bf.filter(i => MF.isType(s, i, 'Creature') && MF.chars(s, i).mv <= (L.spent || 0)).map(i => ({ id: i, iid: i }));
    if (!opts.length) return null;                                                             // nothing it could copy: not a choice
    opts.push({ id: 'no' });
    const ans = MF.ask(x.x, { who: L.ctrl, kind: 'enterAsCopy', src: L.iid, spent: L.spent || 0, opts: opts });
    if (ans === 'no') return null;
    const t = I(s, ans);
    const base = t.copy ? t.copy : { id: t.id, except: {} };                                  // CR 707.2: the copiable values, including an earlier copy effect
    const except = Object.assign({}, base.except);
    except.addSubtypes = (except.addSubtypes || []).concat(a.except.addSubtypes || []);
    except.kw = (except.kw || []).concat(a.except.kw || []);
    log(s, 'enterAsCopy', { who: L.ctrl, c: L.id, of: t.id });
    return { id: base.id, except: except };
  };
  // CR 303.4: an Aura can be attached only to what its enchant ability allows.
  MF.auraCanEnchant = function (s, aura, target) {
    const en = MF.chars(s, aura).ab.find(a => a.k === 'enchant');
    if (!en) return false;
    return MF.matchChars(s, target, MF.chars(s, target), en.f, MF.chars(s, aura).ctrl, aura);
  };

  // Cost changes printed on cards (CR 601.2f): "This spell costs {1} less to cast if ...",
  // "Instant and sorcery spells you cast cost {1} less to cast."
  MF.costMods.push(function (s, who, iid, ch, cost) {
    for (const a of ch.ab) if (a.k === 'costLess' && MF.cond({ s: s, ctrl: who, src: iid, flags: {} }, a.cond)) cost.g -= a.n;
    for (const p of s.bf) {
      const pc = I(s, p); if (pc.ctrl !== who) continue;
      for (const a of MF.chars(s, p).ab) if (a.k === 'costLessFor' && a.spell.types.some(t => ch.types.includes(t))) cost.g -= a.n;
    }
  });

  // -------------------------------------------------------------------------------------------
  // Load-time validation: refuse to run rather than play a card wrongly.
  // -------------------------------------------------------------------------------------------
  const ABKINDS = ['mana', 'act', 'trig', 'static', 'cda', 'noUntap', 'etbTapped', 'enchant', 'costLess', 'costLessFor', 'spell', 'offspring', 'enterAsCopy'];
  MF.validate = function () {
    const bad = [];
    const walkOps = (id, ops) => { for (const op of ops || []) { if (!OPS[op.o]) bad.push(id + ': op with no handler: ' + op.o); if (!MF.describeOp || !MF.describeOp[op.o]) bad.push(id + ': op with no describer: ' + op.o); if (op.ops) walkOps(id, op.ops); if (op.cond && !CONDS[op.cond.c]) bad.push(id + ': no condition ' + op.cond.c); } };
    for (const id in MF.cards) {
      const d = MF.cards[id];
      if (d.un) continue;
      for (const a of d.ab) {
        if (!ABKINDS.includes(a.k)) bad.push(id + ': ability kind with no rule: ' + a.k);
        walkOps(id, a.ops);
        if (a.cond && !CONDS[a.cond.c]) bad.push(id + ': no condition ' + a.cond.c);
      }
      for (const k in d.kw) if (!MF.KEYWORDS.includes(k)) bad.push(id + ': keyword with no rule: ' + k);
    }
    for (const id in MF.decks) {
      const deck = MF.decks[id];
      if (!deck.registered) continue;
      let n = 0;
      for (const e of deck.main) {
        n += e.n;
        const d = MF.cards[e.id];
        if (!d) bad.push(id + ': unknown card ' + e.id);
        else if (d.un) bad.push(id + ': unimplemented card ' + e.id + ' (' + d.un + ')');
        if (MF.defects[e.id]) bad.push(id + ': defective card ' + e.id);
        if (d && !d.supers.includes('Basic') && e.n > 4 && deck.format === 'constructed') bad.push(id + ': more than four ' + e.id);   // CR 100.2a
      }
      if (n < deck.min) bad.push(id + ': ' + n + ' cards, fewer than ' + deck.min);
      for (const t of deck.tokens || []) if (!MF.cards[t]) bad.push(id + ': token not in the pack ' + t);
    }
    if (bad.length) throw new Error('MF.validate refused:\n  ' + bad.join('\n  '));
    return true;
  };
})();
