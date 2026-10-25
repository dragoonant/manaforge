// The board. Everything clickable is built from MF.legalActions; every number shown is read from
// the engine (MF.chars, MF.costOf, MF.whyNot). The page is rebuilt from the state on every change.
// While a question is pending the board shows the partial run that asked it (MF.view).
(function () {
  'use strict';
  const MF = window.MF, T = MF.text, esc = T.esc;
  const ui = MF.ui = { s: null, human: 0, setup: null, actions: [], menu: null, modal: null, timer: null, passUntil: null, recent: [], spot: null, stops: null, peek: false, drawer: false, resultClosed: false, bannerTurn: null };
  // PLAN D4: where the game stops for you when you could do something. me = your turn, opp = theirs.
  const DEFAULT_STOPS = { me: { upkeep: 0, draw: 0, main1: 1, boc: 0, attackers: 1, blockers: 1, fsdamage: 0, damage: 0, eoc: 0, main2: 1, end: 0 }, opp: { upkeep: 0, draw: 0, main1: 0, boc: 0, attackers: 1, blockers: 1, fsdamage: 0, damage: 0, eoc: 0, main2: 0, end: 1 } };
  const STEP_SHORT = { upkeep: 'Upkeep', draw: 'Draw', main1: 'Main 1', boc: 'Combat', attackers: 'Attack', blockers: 'Block', fsdamage: 'First strike', damage: 'Damage', eoc: 'End combat', main2: 'Main 2', end: 'End' };
  function loadStops() { try { const j = JSON.parse(localStorage.getItem('mf-stops')); if (j && j.me && j.opp) return j; } catch (e) { /* storage unavailable: defaults */ } return JSON.parse(JSON.stringify(DEFAULT_STOPS)); }
  function saveStops() { try { localStorage.setItem('mf-stops', JSON.stringify(ui.stops)); } catch (e) { /* not persisted */ } }

  // ---------------------------------------------------------------------------------------------
  // The card renderer: one function, three sizes (CARD-PRESENTATION-SPEC §0.4). Art edge to edge,
  // text floating on it with shadow only.
  // ---------------------------------------------------------------------------------------------
  function face(v, id, o) {
    o = o || {};
    const up = o.iid != null && v && v.cards[o.iid] && v.cards[o.iid].zone === 'bf' && v.cards[o.iid].transformed && MF.cards[id].back;   // CR 712.8e: the back face's characteristics
    const pc = o.iid != null && v && v.cards[o.iid] && v.cards[o.iid].prepCopy && MF.cards[id].prep;   // CR 722.3c: the copy in exile is its prepare spell
    const d = up ? Object.assign({}, MF.cards[id], MF.cards[id].back, { mana: '' }) : pc ? Object.assign({}, MF.cards[id], MF.cards[id].prep) : MF.cards[id];
    let p = d.power, t = d.toughness, badges = '', cls = ['card', 'sz-' + (o.size || 'md')];
    if (o.iid != null && v && v.cards[o.iid] && v.cards[o.iid].zone !== 'bf' && d.ab.some(a => a.k === 'cda')) { const ch0 = MF.chars(v, o.iid); if (ch0.p != null) { p = ch0.p; t = ch0.t; } }   // CR 604.3: a CDA works in every zone
    if (o.iid != null && v && v.cards[o.iid] && v.cards[o.iid].zone === 'bf') {
      const c = v.cards[o.iid], ch = MF.chars(v, o.iid);
      if (ch.p != null) { p = ch.p; t = ch.t; }
      else if (!ch.types.includes('Creature') && !ch.subtypes.includes('Vehicle')) { p = null; t = null; }   // not a creature now (impending, CR 702.176a): no power or toughness shown
      if (c.impended && c.ctr.time > 0) badges += `<div class="badge b-lock" title="Impending (CR 702.176a): not a creature while it has a time counter; one is removed at your end step">not a creature</div>`;
      if (c.ctr['+1/+1']) badges += `<div class="badge b-ctr">+${c.ctr['+1/+1']}</div>`;
      if (c.ctr['-1/-1']) badges += `<div class="badge b-ctrm">−${c.ctr['-1/-1']}</div>`;
      if (c.ctr.loyalty != null) badges += `<div class="badge b-loy" title="Loyalty (CR 306.5c)">${c.ctr.loyalty}</div>`;
      if (c.transformed) badges += `<div class="badge b-copy" title="Transformed: its back face is up (CR 712); front: ${esc(MF.cards[c.id].name)}">transformed</div>`;
      for (const k of Object.keys(c.ctr)) if (c.ctr[k] > 0 && !['+1/+1', '-1/-1', 'loyalty', 'stun'].includes(k)) badges += `<div class="badge b-ctr" title="${esc(k)} counters">${c.ctr[k]} ${esc(k)}</div>`;
      if (c.prepared) badges += `<div class="badge b-kw" title="Prepared (CR 722.3): a copy of its prepare spell waits in exile; casting it unprepares this">prepared</div>`;
      if (c.chosen) badges +=`<div class="badge b-kw" title="Chosen as it entered (CR 614.12a)">chosen: ${esc(c.chosen)}</div>`;
      if (c.dmg) badges +=`<div class="badge b-dmg">${c.dmg} dmg</div>`;
      if (ch.types.includes('Creature') && c.ctrl === v.ap && !ch.kw.haste && !(c.ctlTurn < v.turn)) badges += `<div class="badge b-sick" title="Summoning sick: it came under your control this turn (CR 302.6)">zzz</div>`;
      if (ch.noUntap) badges += `<div class="badge b-lock" title="Doesn’t untap during its controller’s untap step">locked</div>`;
      if (ch.unblockable) badges += `<div class="badge b-unb">unblockable</div>`;
      const kws = Object.keys(ch.kw).filter(k => !d.kw[k] || ch.kw[k] > d.kw[k]);
      if (kws.length) badges += `<div class="badge b-kw">${kws.map(k => MF.KWNAME[k]).join(', ')}</div>`;
      if (c.tapped) cls.push('tapped');
      if (c.tok) cls.push('token');
      if (v.combat && v.combat.attackers.includes(o.iid)) cls.push('attacking');
      if (v.combat && v.combat.blocks[o.iid]) cls.push('blocking');
      if (c.copy) badges += `<div class="badge b-copy" title="A copy of ${esc(MF.cards[c.copy.id].name)}">copy</div>`;
      if (d.doors) badges += `<div class="badge b-doors">${d.doors.map((f, k) => `<span class="${(c.unlocked || [])[k] ? 'dopen' : 'dlock'}" title="${esc(f.name)}: ${(c.unlocked || [])[k] ? 'unlocked' : 'locked — unlock it for ' + esc(f.mana) + ' in your main phase'}">${(c.unlocked || [])[k] ? '◨' : '▣'} ${esc(f.name)}</span>`).join('')}</div>`;   // CR 709.5
      if (c.ctr.stun) badges += `<div class="badge b-stun" title="Stun counters: when it would untap, a counter is removed instead (CR 122.1d)">${c.ctr.stun} stun</div>`;
    }
    const shownId = o.iid != null && v && v.cards[o.iid] && v.cards[o.iid].copy ? v.cards[o.iid].copy.id : id;
    const sd = shownId === id ? d : MF.cards[shownId];
    if (o.acts && o.acts.some(x => x.a.type !== 'mana')) cls.push('legal');                  // a land that can only add mana is clickable, not highlighted
    if (o.cls) cls.push(o.cls);
    const pt = p != null ? `<div class="pt ${p > d.power || t > d.toughness ? 'up' : ''} ${(typeof d.power === 'number' && p < d.power) || (typeof d.toughness === 'number' && t < d.toughness) ? 'down' : ''}">${p}/${t}</div>` : '';
    let tl = sd.token ? 'Token ' + sd.typeLine.replace(/^Token /, '') : sd.typeLine;
    if (o.iid != null && v && v.cards[o.iid] && v.cards[o.iid].zone === 'bf') { const ch = MF.chars(v, o.iid); tl = (v.cards[o.iid].tok ? 'Token ' : '') + ch.supers.concat(ch.types).join(' ') + (ch.subtypes.length ? ' — ' + ch.subtypes.join(' ') : ''); }   // the types it has now (layer 4), not the printed line
    const attrs = [`data-cid="${esc(shownId)}"`];
    if (o.iid != null) attrs.push(`data-iid="${o.iid}"`);
    if (o.acts && o.acts.length) attrs.push(`data-acts='${esc(JSON.stringify(o.acts))}'`);
    if (o.why) attrs.push(`data-why="${esc(o.why)}"`);
    return `<div class="${cls.join(' ')}" ${attrs.join(' ')}>
      <div class="art" style="background-image:${MF.art.css(shownId)}"></div>
      <div class="top"><span class="nm">${esc(sd.name)}</span><span class="cost">${T.symbols(sd.mana)}</span></div>
      <div class="bot"><span class="tl">${esc(tl)}</span>${pt}</div>
      ${badges}${o.tag ? `<div class="ctag">${o.tag}</div>` : ''}
    </div>`;
  }
  const back = (n, cls) => `<div class="card sz-sm back ${cls || ''}">${n != null ? `<div class="cnt">${n}</div>` : ''}</div>`;
  ui.face = face;

  // ---------------------------------------------------------------------------------------------
  // What the human may do right now, keyed by the card (or player) it is done with.
  // ---------------------------------------------------------------------------------------------
  function actionMap(s) {
    const m = {}, btns = [], tray = [];
    const v = MF.view(s);
    if (s.winner != null || MF.whoActs(s) !== ui.human) return { m: m, btns: btns, prompt: null, tray: tray };
    const add = (key, a, label, hl) => { (m[key] = m[key] || []).push({ a: a, label: label, hl: hl == null ? null : hl }); };
    let prompt = null;
    if (s.pending) {
      const q = s.pending.q; prompt = T.prompt(s, q, ui.human);
      for (const o of q.opts) {
        const a = { type: 'answer', id: o.id };
        if (q.kind === 'block' && o.iid != null) { add(o.iid, a, 'Block ' + MF.cards[v.cards[o.att].id].name, o.att); continue; }
        if (q.kind === 'pay' && o.iid != null) { add(o.iid, a, 'Tap for ' + MF.COLOR_NAME[o.col] + ' mana'); continue; }
        if (o.seat != null) { add('p' + o.seat, a, prompt.labels[o.id] || 'Choose'); btns.push({ a: a, label: prompt.labels[o.id] || 'Choose', cls: '' }); continue; }
        if (o.iid != null) {
          const label = prompt.labels[o.id] || (q.kind === 'scry' ? (o.id === 'top' ? 'Keep on top' : 'Put on the bottom') : q.kind === 'lookTop' ? (o.id === 'yes' ? 'Put it onto the battlefield tapped' : 'Put it into my hand') : q.kind === 'attack' ? 'Attack with this' : q.kind === 'target' ? 'Target this' : q.kind === 'trigOrder' ? 'Put this on the stack next' : q.kind === 'bottom' ? 'Put on the bottom' : (q.kind === 'discard' || q.kind === 'discardHand') ? 'Discard this' : 'Choose');
          add(o.iid, a, label);
          const c = v.cards[o.iid];
          const onBoard = c && (c.zone === 'bf' || (c.zone === 'hand' && c.owner === ui.human));
          if (!onBoard && !tray.includes(o.iid)) tray.push(o.iid);
          continue;
        }
        btns.push({ a: a, label: prompt.labels[o.id] || String(o.id), cls: ['done', 'yes', 'keep', 'auto'].includes(o.id) ? 'primary' : o.id === 'undo' ? 'ghost' : '' });
      }
      if (q.cancel) btns.push({ a: { type: 'cancel' }, label: 'Cancel', cls: 'ghost' });
    } else {
      for (const a of MF.legalActions(s)) {
        if (a.type === 'land') add(a.iid, a, 'Play ' + MF.cards[s.cards[a.iid].id].name);
        else if (a.type === 'cast') {
          const d = MF.cards[s.cards[a.iid].id], cost = MF.spellCost(s, ui.human, a.iid, { x: 0, alt: a.alt, door: a.door, anyMana: MF.anyManaFor(s, a.iid), via: a.via }); cost.x = cost.xs; delete cost.xs;   // show {X} in the label (it is announced as the spell is cast)
          if (s.cards[a.iid].zone !== 'hand' && !tray.includes(a.iid)) tray.push(a.iid);                // castable from a graveyard or exile: shown in the tray
          if (a.via === 'flashback' || a.via === 'mayhem') { add(a.iid, a, 'Cast ' + d.name + ' with ' + a.via + ' — ' + MF.manaStr(cost)); continue; }
          if (a.via === 'forage') { add(a.iid, a, 'Cast ' + d.name + ' from your graveyard by foraging — ' + MF.manaStr(cost) + ' (enters with a finality counter)'); if (!tray.includes(a.iid)) tray.push(a.iid); continue; }
          if (a.via === 'evoke') { add(a.iid, a, 'Evoke ' + d.name + ' — ' + MF.manaStr(cost) + ' (sacrificed when it enters)'); continue; }
          if (s.cards[a.iid].prepCopy) { add(a.iid, a, 'Cast the prepared copy of ' + d.prep.name + ' — ' + MF.manaStr(cost) + ' (unprepares ' + d.name + ')'); continue; }
          if (a.via === 'free') { add(a.iid, a, 'Cast ' + d.name + ' without paying its mana cost (Omniscience)'); continue; }
          if (a.via === 'impending') { const im = d.ab.find(x => x.k === 'impending'); add(a.iid, a, 'Cast ' + d.name + ' for its impending cost — ' + MF.manaStr(cost) + ' (enters with ' + im.n + ' time counters; not a creature until the last is removed)'); continue; }
          if (a.via === 'warp') { add(a.iid, a, 'Cast ' + d.name + ' for its warp cost — ' + MF.manaStr(cost) + ' (exiled at end step; recast later)'); continue; }
          if (a.via === 'sneak') { add(a.iid, a, 'Cast ' + d.name + ' for its sneak cost — ' + MF.manaStr(cost) + ' (return an unblocked attacker)'); continue; }
          if (a.via === 'harmonize') { add(a.iid, a, 'Cast ' + d.name + ' with harmonize — ' + MF.manaStr(cost) + ' (tap a creature to reduce it)'); if (!tray.includes(a.iid)) tray.push(a.iid); continue; }
          add(a.iid, a, 'Cast ' + (a.door != null ? d.doors[a.door].name + ' (door)' : a.alt ? d.alt.name + ' (' + (d.alt.kind === 'omen' ? 'Omen' : d.alt.kind === 'mdfc' ? 'back face' : 'Adventure') + ')' : d.name) + ' — ' + (MF.isPlotted(s, a.iid) ? 'free (plotted)' : MF.manaStr(cost)));
        }
        else if (a.type === 'plot') { const p = MF.cards[s.cards[a.iid].id].ab.find(x => x.k === 'plot'); add(a.iid, a, 'Plot ' + MF.cards[s.cards[a.iid].id].name + ' — ' + MF.manaStr(MF.parseMana(p.cost)) + ' (cast it free on a later turn)'); }
        else if (a.type === 'unlock') { const f = MF.cards[s.cards[a.iid].id].doors[a.door]; add(a.iid, a, 'Unlock ' + f.name + ' — ' + f.mana); }
        else if (a.type === 'act') { const ab = MF.chars(s, a.iid).ab[a.ab]; if (s.cards[a.iid].zone === 'grave' && !tray.includes(a.iid)) tray.push(a.iid);   // a graveyard ability (CR 113.6m): shown in the tray
 add(a.iid, a, (ab.equip ? 'Equip (' + ab.cost.mana + ')' : ab.cycling ? 'Cycle — pay ' + ab.cost.mana + ', discard it, draw a card' : ab.levelUp ? 'Level ' + ab.levelUp + ' — ' + ab.cost.mana : ab.loyalty != null ? MF.describeAbility(ab) : ab.ninjutsu ? 'Ninjutsu — ' + ab.cost.mana + ', return an unblocked attacker' : 'Activate: ' + MF.describeAbility(ab)).slice(0, 90)); }
        else if (a.type === 'mana') { const ab = MF.chars(s, a.iid).ab[a.ab]; add(a.iid, a, 'Add mana now: ' + MF.describeAbility(ab) + ' (it empties as the step ends)'); }   // CR 605.3a
        else if (a.type === 'pass') btns.push({ a: a, label: T.passLabel(s, ui.human), cls: 'primary' });
      }
      btns.push({ ui: 'passTurn', label: 'Pass to end of turn', cls: 'ghost' });
      for (const e of s.effects) if (e.k === 'mayPlay' && e.who === ui.human && s.cards[e.iid] && s.cards[e.iid].zone === 'exile' && !tray.includes(e.iid)) tray.push(e.iid);
    }
    return { m: m, btns: btns, prompt: prompt, tray: tray };
  }

  // ---------------------------------------------------------------------------------------------
  // The table (PLAN D19): the opponent's hand peeking in at the top, the drawn mat (js/boardart.js
  // places every zone), and the dock — what just happened | your hand | what the game waits for.
  // The skeleton is built once per game; each render refills the zones.
  // ---------------------------------------------------------------------------------------------
  function permHTML(v, iid, am) {
    const att = v.bf.filter(i => v.cards[i].att === iid);
    const c = v.cards[iid];
    return `<div class="perm ${c.tapped ? 'is-tapped' : ''} ${att.length ? 'has-att' : ''}">${face(v, c.id, { iid: iid, acts: am.m[iid] })}${att.map(i => `<div class="attached">${face(v, v.cards[i].id, { iid: i, acts: am.m[i], size: 'sm' })}</div>`).join('')}</div>`;
  }
  // A player's plate: life, mana pool, and what else is theirs but not a card (speed, emblems).
  function plateHTML(s, v, seat, am) {
    const p = v.players[seat], mine = seat === ui.human, pk = 'p' + seat;
    const pool = T.poolStr(p.pool), chips = [];
    if (!mine) chips.push(`<span class="chip" title="Cards in the opponent’s hand">Hand ${p.hand.length}</span>`);
    if (p.speed != null) chips.push(`<span class="chip" title="Speed (CR 702.179): rises once on your turn when an opponent loses life; 4 is max speed">Speed ${p.speed}${p.speed >= 4 ? ' (max)' : ''}</span>`);
    if (p.enduring) chips.push('<span class="chip" title="Enduring story (CR 702.195)">Enduring story</span>');
    for (const em of (v.emblems || []).filter(em => em.ctrl === seat)) chips.push(`<span class="chip emblem" title="Emblem (CR 114)">Emblem: ${esc(em.text)}</span>`);
    return `<div class="ppanel ${mine ? 'mine' : 'theirs'} ${s.ap === seat ? 'active' : ''} ${am.m[pk] ? 'legal' : ''}" data-seat="${seat}" ${am.m[pk] ? `data-acts='${esc(JSON.stringify(am.m[pk]))}'` : ''}>
        <div class="plife" title="Life">${p.life}</div>
        <div class="pname">${mine ? 'You' : 'Opponent'}</div>
        <div class="pdeck" title="${esc(MF.decks[p.deckId].name)}">${esc(MF.decks[p.deckId].name)}</div>
        <div class="ppool" title="Mana pool — empties at the end of each step">${pool || '<span class="pool-empty">no mana floating</span>'}</div>
        ${chips.length ? `<div class="pchips">${chips.join('')}</div>` : ''}
      </div>`;
  }
  // The piles. A library is backs and a count; a graveyard or exile shows its newest card face up
  // and opens its viewer on a click (CR 404.2, 406.3: both are public).
  function libraryHTML(v, seat) {
    const n = v.players[seat].lib.length;
    return `<div class="pile lib" title="Library: ${T.plural(n, 'card')}">${n ? Array.from({ length: Math.min(3, n) }, (_, k) => `<div class="cardback" style="--d:${k}"></div>`).join('') : '<div class="pile-empty"></div>'}<span class="pcount">${n}</span></div>`;
  }
  function openPileHTML(v, seat, zone) {
    const ids = v.players[seat][zone], top = ids[ids.length - 1];
    const label = (seat === ui.human ? 'Your ' : 'The opponent’s ') + (zone === 'grave' ? 'graveyard' : 'exile');
    return `<div class="pile open ${zone}" data-view="${zone}:${seat}" title="${label}: ${T.plural(ids.length, 'card')} — click to look through">${top != null ? face(v, v.cards[top].id, { iid: top }) : '<div class="pile-empty"></div>'}<span class="pcount">${ids.length}</span></div>`;
  }
  function fieldOf(v, seat) {
    const perms = v.bf.filter(i => v.cards[i].ctrl === seat && !(v.cards[i].att != null && v.cards[i].att >= 0 && v.cards[v.cards[i].att] && v.cards[v.cards[i].att].zone === 'bf'));
    const lands = perms.filter(i => MF.isType(v, i, 'Land')), others = perms.filter(i => !MF.isType(v, i, 'Land'));
    return { lands: lands, front: others.filter(i => MF.isType(v, i, 'Creature')).concat(others.filter(i => !MF.isType(v, i, 'Creature'))) };
  }
  function stackHTML(s, v, am) {
    return v.stack.slice().reverse().map((L, k) => {
      const id = L.kind === 'spell' ? L.id : L.srcId;
      const tgs = (L.t || []).flat().filter(Boolean);
      const tl = tgs.map(r => r.p != null ? (r.p === ui.human ? 'you' : 'the opponent') : (v.cards[r.c] ? MF.cards[v.cards[r.c].id].name : '(gone)')).join(', ');
      const hl = tgs.filter(r => r.c != null).map(r => r.c).concat(tgs.filter(r => r.p != null).map(r => 'p' + r.p));
      const what = L.kind === 'spell' ? (L.copy ? 'copy of a spell' : 'spell') : L.kind === 'trig' ? (L.inl === 'prowess' ? 'prowess' : 'triggered ability') : 'activated ability';
      return `<div class="layer ${k === 0 ? 'top' : ''} ${L.ctrl === ui.human ? 'mine' : 'theirs'}" data-hl='${esc(JSON.stringify(hl))}'>${face(v, id, { iid: L.kind === 'spell' ? L.iid : null, size: 'sm', acts: L.kind === 'spell' ? am.m[L.iid] : null })}
        <div class="linfo"><b>${esc(MF.cards[id].name)}</b><span>${what} · ${L.ctrl === ui.human ? 'yours' : 'opponent’s'}</span>${tl ? `<span class="ltgt">→ ${esc(tl)}</span>` : ''}${L.x ? `<span>X = ${L.x}</span>` : ''}</div></div>`;
    }).join('') + (v.stack.length ? `<div class="stack-note">${v.stack.length > 1 ? 'top first · ' : ''}resolves when both players pass</div>` : '');
  }
  function stepsHTML(s) {
    const mineTurn = s.ap === ui.human, key = mineTurn ? 'me' : 'opp';
    return `<div class="steps"><span class="whose ${mineTurn ? 'mine' : ''}">${s.step === 'pregame' ? 'Before the game' : (mineTurn ? 'Your turn' : 'Opponent’s turn') + ' ' + s.turn}</span>${Object.keys(STEP_SHORT).map(st =>
      `<span class="st ${s.step === st ? 'now' : ''} ${ui.stops[key][st] ? 'stop' : ''}" data-stop="${key}:${st}" title="${ui.stops[key][st] ? 'The game stops here for you when you can act. Click to stop stopping.' : 'Click to make the game stop here when you can act.'}">${STEP_SHORT[st]}</span>`).join('')}</div>`;
  }
  function promptHTML(s, am) {
    if (s.winner != null) {
      const title = s.winner === 'draw' ? 'The game is a draw' : s.winner === ui.human ? 'You win' : 'You lose';
      return `<div class="prompt over"><div class="ptext"><div class="ptitle">${title}</div></div><div class="pbtns"><button class="btn primary" data-ui="again">Play again</button> <button class="btn" data-ui="menu">New game</button> <button class="btn ghost" data-ui="bug">Copy bug report</button></div></div>`;
    }
    const who = MF.whoActs(s);
    if (who !== ui.human) return `<div class="prompt wait"><div class="ptext"><div class="ptitle">The opponent is thinking…</div><div class="pbody">${MF.stepName(s)}</div></div></div>`;
    let title, body;
    if (am.prompt) { title = am.prompt.title; body = am.prompt.body; }
    else {
      title = `${MF.stepName(s)} — your priority`;
      const any = Object.keys(am.m).length;
      body = s.stack.length ? (any ? 'You may respond with a glowing card, or pass to let the top of the stack resolve.' : 'Nothing to respond with.') : (any ? 'Glowing cards can be played. Hover any card to read it.' : 'Nothing can be played right now.');
    }
    const v = MF.view(s);
    const tray = am.tray.length ? `<div class="tray">${am.tray.map(i => face(v, v.cards[i].id, { iid: i, acts: am.m[i] })).join('')}</div>` : '';
    const btns = am.btns.map(b => b.ui ? `<button class="btn ${b.cls}" data-ui="${b.ui}">${esc(b.label)}</button>` : `<button class="btn ${b.cls}" data-acts='${esc(JSON.stringify([{ a: b.a, label: b.label }]))}'>${T.symbols(b.label)}</button>`).join('');
    return `<div class="prompt mine ${ui.peek ? 'peek' : ''}"><button class="btn tiny peekbtn" data-ui="peek" title="Escape">${ui.peek ? 'Show prompt' : 'Hide'}</button><div class="ptext"><div class="ptitle">${title}</div><div class="pbody">${body}</div></div>${tray}<div class="pbtns">${btns}</div></div>`;
  }
  function handHTML(s, v, am) {
    const p = v.players[ui.human];
    const canAsk = s.priority === ui.human && !s.pending;
    return p.hand.map(i => face(v, v.cards[i].id, { iid: i, acts: am.m[i], size: 'hand', why: !am.m[i] && canAsk ? MF.whyNot(s, ui.human, i) : null })).join('') || '<div class="hand-empty">no cards in hand</div>';
  }
  function enemyHandHTML(v) {
    const n = v.players[1 - ui.human].hand.length;
    return `<div id="enemy-hand">${Array.from({ length: Math.min(n, 12) }, () => '<div class="cardback"></div>').join('')}<span class="ehand-count">${T.plural(n, 'card')} in hand</span></div>`;
  }
  function feedHTML(v) {
    return v.log.slice(-4).map((e, k, a) => `<div class="feed-line ${e.who === ui.human ? 'you' : e.who === 1 - ui.human ? 'them' : ''} ${k === a.length - 1 ? 'latest' : ''}">${T.logLine(e, ui.human)}</div>`).join('');
  }
  function logHTML(v) {
    const from = Math.max(0, v.log.length - 80);
    let h = '';
    for (let i = v.log.length - 1; i >= from; i--) { const e = v.log[i]; h += `<div class="ll t-${e.t} ${e.who === ui.human ? 'lme' : e.who === 1 - ui.human ? 'lopp' : ''}">${T.logLine(e, ui.human)}</div>`; }   // newest first (CARD-LOG-AND-TARGETING-SPEC §5)
    const recent = ui.recent.slice(-10).reverse().map(r => `<div class="rc ${r.who === ui.human ? 'mine' : ''}">${face(null, r.id, { size: 'xs' })}</div>`).join('');
    return `<div class="loghead">Recently played</div><div class="recent">${recent || '<span class="dim">nothing yet</span>'}</div><div class="loghead">Log <span>newest first</span></div><div class="loglines">${h}</div>`;
  }
  function drawerHTML(v) {
    return `<div class="drawer-head"><span class="brand">MANAFORGE</span><button class="btn tiny" data-ui="drawer" title="Close (L or Escape)">✕ Close</button></div>
      <div class="drawer-controls">
        <button class="btn" data-ui="motion" title="Cards slide, die and fly to their zones; damage floats">Motion: ${MF.anim.on ? 'on' : 'off'}</button>
        <button class="btn" data-ui="howto">How to play</button>
        <button class="btn" data-ui="menu" title="Leave this game and choose new decks">New game</button>
        <button class="btn ghost" data-ui="bug" title="Copy this game’s seed and actions: it replays exactly">Copy bug report</button>
      </div>${logHTML(v)}`;
  }
  function modalHTML(v, am) {
    if (!ui.modal) return '';
    const [zone, seatS] = ui.modal.split(':'), seat = +seatS, p = v.players[seat];
    const ids = zone === 'grave' ? p.grave.slice().reverse() : p.exile;
    return `<div class="modal" data-ui="closemodal"><div class="mbox"><div class="mtitle">${seat === ui.human ? 'Your' : 'The opponent’s'} ${zone === 'grave' ? 'graveyard (top first)' : 'exile'} — ${T.plural(ids.length, 'card')}</div>
      <div class="mcards">${ids.map(i => face(v, v.cards[i].id, { iid: i, acts: am.m[i] })).join('') || '<div class="empty">nothing here</div>'}</div><button class="btn" data-ui="closemodal">Close</button></div></div>`;
  }
  function resultHTML(s) {
    if (s.winner == null || ui.resultClosed) return '';
    const won = s.winner === ui.human, draw = s.winner === 'draw';
    const cls = draw ? 'is-draw' : won ? 'is-win' : 'is-loss';
    return `<div class="modal result-wrap"><div class="mbox result ${cls}">
      <div class="result-kicker">${draw ? 'A draw' : won ? 'You win' : 'You lose'}</div>
      <div class="result-title">${draw ? 'Stalemate' : won ? 'Victory' : 'Defeat'}</div>
      <div class="result-flavour">${draw ? 'Both fires go out together.' : won ? 'The forge is yours. Your opponent’s spark is spent.' : 'Your spark gutters out… for now.'}</div>
      <div class="result-sub">Turn ${s.turn}. Seed ${ui.setup.seed} — the same seed and the same choices replay the same game.</div>
      <div class="pbtns"><button class="btn primary" data-ui="again">Play again</button><button class="btn" data-ui="menu">New game</button><button class="btn ghost" data-ui="closeresult">Look at the table</button><button class="btn ghost" data-ui="bug">Copy bug report</button></div>
    </div></div>`;
  }

  const ZONES = [['theirs', 'opp'], ['mine', 'me']];
  function skeleton() {
    const BA = MF.boardArt, z = (side, k, cls, inner) => `<div class="mat-zone ${k}-zone ${cls || ''}" style="${BA.place(side, k)}">${inner || ''}</div>`;
    let mat = BA.svg();
    for (const [side, who] of ZONES) {
      mat += z(side, 'plate', '', `<div id="${who}-plate"></div>`);
      mat += z(side, 'front', '', `<div id="${who}-front" class="field row" data-side="${who}"></div>`);
      mat += z(side, 'lands', '', `<div id="${who}-lands" class="field row lands" data-side="${who}"></div>`);
      mat += z(side, 'library', 'pile-zone ' + side, `<div id="${who}-library"></div>`);
      mat += z(side, 'grave', 'pile-zone ' + side, `<div id="${who}-grave"></div>`);
      mat += z(side, 'exile', 'pile-zone ' + side, `<div id="${who}-exile"></div>`);
    }
    mat += z('shared', 'stack', '', '<div id="stack" class="stack"></div>');
    mat += z('shared', 'steps', '', '<div id="steps"></div>');
    return `<div class="game">
      <div id="table">
        <div id="enemy-hand-bar"></div>
        <div id="mat">${mat}</div>
        <div id="dock">
          <div id="dock-left"><div id="turnbadge"></div><div id="feed"></div></div>
          <div id="hand-wrap"><div id="hand" class="hand" data-side="me"></div></div>
          <div id="dock-right"></div>
        </div>
      </div>
      <button id="log-handle" class="btn" data-ui="drawer" title="Log and settings (L)">Log</button>
      <div id="drawer"></div>
      <div id="overlays"></div>
      <div id="turn-banner" aria-live="polite"></div>
      <svg id="arrows" class="arrows"></svg>
      <div id="zoom" class="zoom"></div>
    </div>`;
  }
  const set = (id, html) => { document.getElementById(id).innerHTML = html; };

  // A row wider than its zone shrinks its cards (to 55%), then scrolls; the hand overlaps instead.
  function fit(row, overlap) {
    if (overlap) {
      row.style.setProperty('--ov', '0px');
      const cards = row.children.length, over = row.scrollWidth - row.clientWidth;
      if (over > 0 && cards > 1) row.style.setProperty('--ov', -Math.ceil(over / (cards - 1) + 2) + 'px');
      return;
    }
    row.style.setProperty('--k', '1');
    const need = row.scrollWidth, room = row.clientWidth;
    if (need > room + 1) row.style.setProperty('--k', Math.max(0.55, room / need * 0.98).toFixed(3));
  }

  function render() {
    const s = ui.s, v = MF.view(s), am = actionMap(s);
    const app = document.getElementById('app');
    const before = ui.animReady ? MF.anim.capture() : null;                                  // the presentation director (js/anim.js) plays the difference
    if (!document.getElementById('table')) app.innerHTML = skeleton();
    const table = document.getElementById('table');
    table.classList.toggle('my-turn', s.ap === ui.human); table.classList.toggle('their-turn', s.ap !== ui.human);
    set('enemy-hand-bar', enemyHandHTML(v));
    for (const [, who] of ZONES) {
      const seat = who === 'me' ? ui.human : 1 - ui.human, f = fieldOf(v, seat);
      set(who + '-plate', plateHTML(s, v, seat, am));
      set(who + '-front', f.front.map(i => permHTML(v, i, am)).join(''));
      set(who + '-lands', f.lands.map(i => permHTML(v, i, am)).join(''));
      set(who + '-library', libraryHTML(v, seat));
      set(who + '-grave', openPileHTML(v, seat, 'grave'));
      set(who + '-exile', openPileHTML(v, seat, 'exile'));
    }
    set('stack', stackHTML(s, v, am));
    document.getElementById('stack').classList.toggle('has-items', v.stack.length > 0);
    set('steps', stepsHTML(v));
    set('turnbadge', s.step === 'pregame' ? 'Before the game' : `${s.ap === ui.human ? 'Your turn' : 'Opponent’s turn'} ${s.turn} · ${STEP_SHORT[s.step] || MF.stepName(s)}`);
    set('feed', feedHTML(v));
    set('hand', handHTML(s, v, am));
    set('dock-right', promptHTML(s, am));
    const drawer = document.getElementById('drawer');
    drawer.classList.toggle('open', !!ui.drawer);
    document.getElementById('log-handle').classList.toggle('on', !!ui.drawer);
    drawer.innerHTML = drawerHTML(v);
    set('overlays', (ui.spot ? `<div class="spot">${face(null, ui.spot.id, { size: 'lg' })}<div class="spotlbl">${esc(ui.spot.label)}</div></div>` : '') + modalHTML(v, am) + resultHTML(s) +
      (ui.menu ? `<div class="cmenu" style="left:${ui.menu.x}px;top:${ui.menu.y}px">${ui.menu.items.map((it, i) => `<button class="btn" data-menu="${i}" ${it.hl != null ? `data-hl='${esc(JSON.stringify([it.hl]))}'` : ''}>${T.symbols(it.label)}</button>`).join('')}<button class="btn ghost" data-menu="-1">Never mind</button></div>` : ''));
    document.getElementById('zoom').classList.remove('on');
    for (const id of ['opp-front', 'opp-lands', 'me-front', 'me-lands']) fit(document.getElementById(id));
    fit(document.getElementById('hand'), true);
    drawArrows(v, s.pending && s.pending.q);
    turnBanner(s);
    MF.anim.play(before, v, ui.human); ui.animReady = true;
  }
  ui.render = render;

  // A ribbon across the table when a turn begins (view only: the step bar and the log say it too).
  function turnBanner(s) {
    if (s.step === 'pregame' || ui.bannerTurn === s.turn) return;
    ui.bannerTurn = s.turn;
    if (!MF.anim.on) return;
    const b = document.getElementById('turn-banner');
    b.innerHTML = `<div class="tb-ribbon ${s.ap === ui.human ? 'mine' : 'theirs'}"><span class="tb-kicker">Turn ${s.turn}</span><span class="tb-title">${s.ap === ui.human ? 'Your turn' : 'Opponent’s turn'}</span></div>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(ui.bannerTimer); ui.bannerTimer = setTimeout(() => b.classList.remove('show'), 1500);
    MF.anim.busyUntil = Math.max(MF.anim.busyUntil, Date.now() + 900);                          // the opponent waits for the ribbon
  }

  // Combat arrows: attacker → defending player, blocker → attacker (CARD-LOG-AND-TARGETING-SPEC §14).
  function drawArrows(v, q) {
    const svg = document.getElementById('arrows'); if (!svg) return;
    svg.innerHTML = '';
    if (!v.combat) return;
    // A declaration in progress is drawn as a proposal (amber); a declared one in red and blue.
    if (q && q.kind === 'attack') for (const i of q.chosen) { const el = document.querySelector('.field [data-iid="' + i + '"]'); if (el) el.classList.add('aiming'); }
    const at = iid => { const el = document.querySelector(`.field [data-iid="${iid}"]`); return el ? el.getBoundingClientRect() : null; };
    const pr = seat => { const el = document.querySelector(`.ppanel[data-seat="${seat}"] .plife`); return el ? el.getBoundingClientRect() : null; };
    let h = '<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>';
    const line = (a, b, cls) => { if (!a || !b) return; const x1 = a.left + a.width / 2, y1 = a.top + a.height / 2, x2 = b.left + b.width / 2, y2 = b.top + b.height / 2; h += `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ah)"/>`; };
    for (const a of v.combat.attackers) { if (!(v.combat.blockedBy[a] || []).length) line(at(a), pr(1 - v.ap), 'atk'); }
    for (const b in v.combat.blocks) for (const a of v.combat.blocks[b]) line(at(+b), at(a), 'blk');
    if (q && q.kind === 'block') for (const b in q.assign) line(at(+b), at(q.assign[b]), 'aim');
    if (q && q.kind === 'attack') for (const a of q.chosen) line(at(a), pr(1 - v.ap), 'aim');
    svg.innerHTML = h;
  }
  // ---------------------------------------------------------------------------------------------
  // The preview: ONE delegated listener (handoff 9). Any element carrying data-cid can be read.
  // ---------------------------------------------------------------------------------------------
  const GLOSSARY = {
    flying: 'Flying — can’t be blocked except by creatures with flying or reach.', reach: 'Reach — can block creatures with flying.',
    vigilance: 'Vigilance — attacking doesn’t cause this creature to tap.', trample: 'Trample — damage beyond what is lethal to its blockers is dealt to the defending player.',
    haste: 'Haste — can attack and use {T} abilities the turn it comes under your control.', firstStrike: 'First strike — deals combat damage before creatures without first strike.',
    doubleStrike: 'Double strike — deals both first-strike and regular combat damage.', deathtouch: 'Deathtouch — any damage it deals to a creature is enough to destroy it.',
    lifelink: 'Lifelink — damage it deals also causes you to gain that much life.', menace: 'Menace — can’t be blocked except by two or more creatures.',
    prowess: 'Prowess — whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.',
    defender: 'Defender — can’t attack.', flash: 'Flash — can be cast any time you could cast an instant.', hexproof: 'Hexproof — can’t be the target of spells or abilities your opponents control.',
    indestructible: 'Indestructible — isn’t destroyed by lethal damage or “destroy” effects.',
  };
  const TEXT_GLOSS = { 'Scry': 'Scry N — look at the top N cards of your library, then put any of them on the bottom and the rest on top in any order.', 'Offspring': 'Offspring — an optional additional cost; if paid, a 1/1 token copy of the creature is created when it enters.', 'Equip': 'Equip — attach this to target creature you control. Equip only as a sorcery.', 'Enchant': 'Enchant — what this Aura can be attached to.', 'Food': 'Food — an artifact you can sacrifice for life.' };
  function zoomHTML(el) {
    const id = el.getAttribute('data-cid'), d = MF.cards[id], s = ui.s;
    const iid = el.getAttribute('data-iid'), why = el.getAttribute('data-why');
    const v = s ? MF.view(s) : null;
    let live = '';
    if (iid != null && v && v.cards[iid] && v.cards[iid].zone === 'bf') {
      const c = v.cards[iid], ch = MF.chars(v, +iid), bits = [];
      if (ch.p != null && (ch.p !== d.power || ch.t !== d.toughness)) bits.push(`Now <b>${ch.p}/${ch.t}</b> (printed ${d.power}/${d.toughness})`);
      if (c.dmg) bits.push(`${c.dmg} damage marked`);
      for (const k in c.ctr) if (c.ctr[k]) bits.push(`${c.ctr[k]} ${k} counter${c.ctr[k] > 1 ? 's' : ''}`);
      const gained = Object.keys(ch.kw).filter(k => !d.kw[k]); if (gained.length) bits.push('Has ' + gained.map(k => MF.KWNAME[k]).join(', '));
      if (c.tapped) bits.push('Tapped');
      if (c.copy) bits.push('A copy of ' + esc(MF.cards[c.copy.id].name));
      if (c.tok) bits.push('A token');
      if (c.att != null && c.att >= 0 && v.cards[c.att]) bits.push('Attached to ' + esc(MF.cards[v.cards[c.att].id].name));
      bits.push(c.ctrl === ui.human ? 'You control it' : 'The opponent controls it');
      live = `<div class="zlive">${bits.join(' · ')}</div>`;
    }
    const kwKeys = new Set(Object.keys(d.kw));
    for (const k in GLOSSARY) if (new RegExp('\\b' + MF.KWNAME[k] + '\\b', 'i').test(d.text)) kwKeys.add(k);
    const help = [...kwKeys].filter(k => GLOSSARY[k]).map(k => `<div class="zkw">${T.symbols(GLOSSARY[k])}</div>`).concat(Object.keys(TEXT_GLOSS).filter(k => d.text.includes(k)).map(k => `<div class="zkw">${TEXT_GLOSS[k]}</div>`)).join('');
    const tokens = [...new Set((JSON.stringify(d.ab).match(/token-[a-z0-9-]+/g) || []))];
    const rules = t => T.symbols(t).replace(/\(([^)]*)\)/g, '<i>($1)</i>').replace(/\n/g, '<br>');
    // An Adventure or Omen card shows both faces (CR 715.2, 720.2).
    // A Room shows each door with its own name and cost (CR 709.5).
    if (d.doors) {
      const c = iid != null && v ? v.cards[iid] : null, onBf = c && c.zone === 'bf';
      const doorsHtml = d.doors.map((f, k) => `<div class="zalt"><b>${esc(f.name)}</b> <span class="zcost">${T.symbols(f.mana)}</span>${onBf ? ` — <i>${(c.unlocked || [])[k] ? 'unlocked' : 'locked'}</i>` : ''}<br>${rules(f.text)}</div>`).join('');
      return `<div class="zcard">${face(null, id, { size: 'lg' })}${tokens.map(t => `<div class="ztok">Creates:${face(null, t, { size: 'sm' })}</div>`).join('')}</div>
      <div class="ztext"><div class="zname">${esc(d.name)} <span class="zcost">${T.symbols(d.mana)}</span></div><div class="ztype">${esc(d.typeLine)}</div>
      <div class="zrules">${doorsHtml}<div class="zkw">Room — cast one door; it enters unlocked. In your main phase with the stack empty you may pay a locked door’s cost to unlock it (CR 709.5e).</div></div>
      ${live}${why ? `<div class="zwhy">Can’t play now: ${T.symbols(why)}</div>` : ''}</div>`;
    }
    const text = rules(d.text) + (d.back ? `<div class="zalt"><b>${esc(d.back.name)}</b> (transformed)<br><i>${esc(d.back.typeLine)}</i><br>${rules(d.back.text)}${d.back.power != null ? '<br>' + d.back.power + '/' + d.back.toughness : ''}</div>` : '') + (d.alt ? `<div class="zalt"><b>${esc(d.alt.name)}</b> <span class="zcost">${T.symbols(d.alt.mana)}</span><br><i>${esc(d.alt.typeLine)}</i><br>${rules(d.alt.text)}</div>` : '');
    return `<div class="zcard">${face(null, id, { size: 'lg' })}${tokens.map(t => `<div class="ztok">Creates:${face(null, t, { size: 'sm' })}</div>`).join('')}</div>
      <div class="ztext"><div class="zname">${esc(d.name)} <span class="zcost">${T.symbols(d.mana)}</span></div><div class="ztype">${esc(d.typeLine)}</div>
      <div class="zrules">${text || '<i>No rules text.</i>'}</div>
      ${d.power != null ? `<div class="zstats">${d.power}/${d.toughness}</div>` : ''}
      ${live}${why ? `<div class="zwhy">Can’t play now: ${T.symbols(why)}</div>` : ''}${help ? `<div class="zgloss">${help}</div>` : ''}</div>`;
  }
  document.addEventListener('mouseover', e => {
    const z = document.getElementById('zoom');
    // hover a menu item or stack layer: highlight what it means (owner's rule 17)
    document.querySelectorAll('.hl').forEach(n => n.classList.remove('hl'));
    const h = e.target.closest && e.target.closest('[data-hl]');
    if (h) for (const k of JSON.parse(h.getAttribute('data-hl'))) { const n = typeof k === 'string' ? document.querySelector(`.ppanel[data-seat="${k.slice(1)}"]`) : document.querySelector(`.field [data-iid="${k}"]`); if (n) n.classList.add('hl'); }
    if (!z) return;
    const el = e.target.closest && e.target.closest('[data-cid]');
    if (!el || el.closest('#zoom') || el.closest('.cmenu')) { z.classList.remove('on'); return; }
    z.innerHTML = zoomHTML(el);
    const r = el.getBoundingClientRect();
    z.classList.toggle('left', r.left > window.innerWidth * 0.45);
    z.classList.add('on');
  });

  // ---------------------------------------------------------------------------------------------
  // Clicks. Clicking a card with exactly one thing to do does it; with several, a menu asks.
  // ---------------------------------------------------------------------------------------------
  document.addEventListener('click', e => {
    if (!ui.s) return;
    const t = e.target;
    const mi = t.closest('[data-menu]');
    if (mi) { const i = +mi.getAttribute('data-menu'); const it = ui.menu.items[i]; ui.menu = null; if (it) dispatch(it.a); else render(); return; }
    if (ui.menu) { ui.menu = null; render(); return; }
    const st = t.closest('[data-stop]');
    if (st) { const [k, step] = st.getAttribute('data-stop').split(':'); ui.stops[k][step] = ui.stops[k][step] ? 0 : 1; saveStops(); render(); return; }
    const u = t.closest('[data-ui]');
    if (u) {
      const k = u.getAttribute('data-ui');
      if (k === 'closemodal') { if (t === u || t.tagName === 'BUTTON') { ui.modal = null; render(); return; } if (!t.closest('[data-acts]')) return; ui.modal = null; }
      if (k === 'again') return MF.main.start(ui.setup, true);
      if (k === 'menu') return MF.main.menu();
      if (k === 'motion') { MF.anim.toggle(); render(); return; }
      if (k === 'drawer') { ui.drawer = !ui.drawer; render(); return; }
      if (k === 'closeresult') { ui.resultClosed = true; render(); return; }
      if (k === 'howto') return MF.main.howto();
      if (k === 'bug') return MF.main.bugReport();
      if (k === 'peek') { ui.peek = !ui.peek; render(); return; }
      if (k === 'passTurn') { ui.passUntil = ui.s.turn; const p = MF.legalActions(ui.s).find(a => a.type === 'pass'); if (p) dispatch(p); return; }
    }
    const a = t.closest('[data-acts]');
    if (a) {
      const items = JSON.parse(a.getAttribute('data-acts'));
      if (items.length === 1) return dispatch(items[0].a);
      ui.menu = { items: items, x: Math.min(e.clientX, window.innerWidth - 300), y: Math.max(10, Math.min(e.clientY, window.innerHeight - 44 * (items.length + 1) - 20)) };
      render(); return;
    }
    const vz = t.closest('[data-view]');
    if (vz) { ui.modal = vz.getAttribute('data-view'); render(); }
  });
  document.addEventListener('keydown', e => {
    if (!ui.s || e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') { if (ui.modal || ui.menu) { ui.modal = null; ui.menu = null; } else if (ui.drawer) ui.drawer = false; else ui.peek = !ui.peek; render(); }   // Escape toggles peek (CARD-LOG-AND-TARGETING-SPEC §13)
    if (e.key === 'l' || e.key === 'L') { ui.drawer = !ui.drawer; render(); }
    if (e.key === ' ') {
      e.preventDefault();
      const b = actionMap(ui.s).btns.find(b => b.cls === 'primary' && b.a);
      if (b) dispatch(b.a);
    }
  });

  // ---------------------------------------------------------------------------------------------
  // The driver. The opponent's moves are shown at a pace a person can follow; every wait is
  // bounded by a timer. Priority windows are passed for you unless a stop says otherwise.
  // ---------------------------------------------------------------------------------------------
  function shouldStop(s) {
    const legal = MF.legalActions(s).filter(a => a.type !== 'mana');                         // tapping for mana alone doesn't make a window
    if (legal.length === 1 && legal[0].type === 'pass') return false;                          // nothing legal: not a window (owner's rule 9)
    if (s.stack.length) {
      const top = s.stack[s.stack.length - 1];
      return top.ctrl !== ui.human;                                                           // the opponent put something on the stack and you can respond
    }
    if (ui.passUntil === s.turn) return false;
    return !!ui.stops[s.ap === ui.human ? 'me' : 'opp'][s.step];
  }
  function dispatch(a) {
    clearTimeout(ui.timer);
    const before = ui.s.log.length, actor = MF.whoActs(ui.s);
    ui.actions.push(a);
    try { ui.s = MF.apply(ui.s, a); }
    catch (err) { MF.main.crash(err); return; }
    const fresh = ui.s.log.slice(before);
    ui.spot = null;
    for (const e of fresh) if (e.t === 'cast' || e.t === 'land' || e.t === 'activate') ui.recent.push({ id: e.c, who: e.who });
    if (actor !== ui.human) {
      const e = fresh.find(e => (e.t === 'cast' || e.t === 'activate') && e.who !== ui.human);
      if (e) ui.spot = { id: e.c, label: 'The opponent ' + (e.t === 'cast' ? 'casts ' : 'activates ') + MF.cards[e.c].name };
    }
    if (ui.passUntil != null && ui.passUntil !== ui.s.turn) ui.passUntil = null;
    if (a.type !== 'pass') ui.peek = false;
    step(fresh.length > 0);
  }
  function step(visible) {
    try { render(); } catch (err) { MF.main.crash(err); return; }                              // a drawing error shows the bug report; it never freezes the table silently
    const s = ui.s;
    if (s.winner != null) return;
    const who = MF.whoActs(s);
    if (who !== ui.human) {
      ui.timer = setTimeout(() => {
        let a;
        try { a = MF.ai.choose(ui.s); } catch (err) { MF.main.crash(err); return; }
        dispatch(a);
      }, Math.max(ui.spot ? 1200 : visible ? 380 : 60, MF.anim.busyUntil - Date.now()));   // the opponent waits for the motion it caused (Mallet-42k §4)
      return;
    }
    if (!s.pending && !shouldStop(s)) {
      const p = MF.legalActions(s).find(a => a.type === 'pass');
      ui.timer = setTimeout(() => dispatch(p), Math.max(visible ? 300 : 40, MF.anim.busyUntil - Date.now()));
    } else if (ui.spot) ui.timer = setTimeout(() => { ui.spot = null; render(); }, 1400);
  }
  ui.begin = function (setup, state) {
    clearTimeout(ui.timer);
    ui.setup = setup; ui.human = setup.human; ui.actions = []; ui.spot = null; ui.modal = null; ui.menu = null; ui.recent = []; ui.passUntil = null; ui.peek = false; ui.resultClosed = false; ui.bannerTurn = null;
    document.getElementById('app').innerHTML = '';                                            // a fresh table: render() builds the skeleton
    ui.stops = loadStops();
    ui.s = state; ui.animReady = false; MF.anim.reset(state);
    step(false);
  };
  ui.dispatch = dispatch;
  let resizeT = null;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (ui.s) render(); }, 120); });   // arrows and row fitting are measured in pixels                                                                    // for the page tests (tools and the browser console)
  ui.stop = function () { clearTimeout(ui.timer); ui.s = null; };
})();
