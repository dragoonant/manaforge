// The board. Everything clickable is built from MF.legalActions; every number shown is read from
// the engine (MF.chars, MF.costOf, MF.whyNot). The page is rebuilt from the state on every change.
// While a question is pending the board shows the partial run that asked it (MF.view).
(function () {
  'use strict';
  const MF = window.MF, T = MF.text, esc = T.esc;
  const ui = MF.ui = { s: null, human: 0, setup: null, actions: [], menu: null, modal: null, timer: null, passUntil: null, recent: [], spot: null, stops: null, peek: false };
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
    const d = MF.cards[id];
    let p = d.power, t = d.toughness, badges = '', cls = ['card', 'sz-' + (o.size || 'md')];
    if (o.iid != null && v && v.cards[o.iid] && v.cards[o.iid].zone === 'bf') {
      const c = v.cards[o.iid], ch = MF.chars(v, o.iid);
      if (ch.p != null) { p = ch.p; t = ch.t; }
      if (c.ctr['+1/+1']) badges += `<div class="badge b-ctr">+${c.ctr['+1/+1']}</div>`;
      if (c.ctr['-1/-1']) badges += `<div class="badge b-ctrm">−${c.ctr['-1/-1']}</div>`;
      if (c.dmg) badges += `<div class="badge b-dmg">${c.dmg} dmg</div>`;
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
    }
    const shownId = o.iid != null && v && v.cards[o.iid] && v.cards[o.iid].copy ? v.cards[o.iid].copy.id : id;
    const sd = MF.cards[shownId];
    if (o.acts && o.acts.length) cls.push('legal');
    if (o.cls) cls.push(o.cls);
    const pt = p != null ? `<div class="pt ${p > d.power || t > d.toughness ? 'up' : ''} ${(typeof d.power === 'number' && p < d.power) || (typeof d.toughness === 'number' && t < d.toughness) ? 'down' : ''}">${p}/${t}</div>` : '';
    const attrs = [`data-cid="${esc(shownId)}"`];
    if (o.iid != null) attrs.push(`data-iid="${o.iid}"`);
    if (o.acts && o.acts.length) attrs.push(`data-acts='${esc(JSON.stringify(o.acts))}'`);
    if (o.why) attrs.push(`data-why="${esc(o.why)}"`);
    return `<div class="${cls.join(' ')}" ${attrs.join(' ')}>
      <div class="art" style="background-image:${MF.art.css(shownId)}"></div>
      <div class="top"><span class="nm">${esc(sd.name)}</span><span class="cost">${T.symbols(sd.mana)}</span></div>
      <div class="bot"><span class="tl">${esc(sd.token ? 'Token ' + sd.typeLine.replace(/^Token /, '') : sd.typeLine)}</span>${pt}</div>
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
          const label = prompt.labels[o.id] || (q.kind === 'scry' ? (o.id === 'top' ? 'Keep on top' : 'Put on the bottom') : q.kind === 'lookTop' ? (o.id === 'yes' ? 'Put it onto the battlefield tapped' : 'Leave it on top') : q.kind === 'attack' ? 'Attack with this' : q.kind === 'target' ? 'Target this' : q.kind === 'trigOrder' ? 'Put this on the stack next' : q.kind === 'bottom' ? 'Put on the bottom' : (q.kind === 'discard' || q.kind === 'discardHand') ? 'Discard this' : 'Choose');
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
          const d = MF.cards[s.cards[a.iid].id], cost = MF.spellCost(s, ui.human, a.iid, { x: 0, alt: a.alt }); delete cost.xs;
          add(a.iid, a, 'Cast ' + (a.alt ? d.alt.name + ' (' + (d.alt.kind === 'omen' ? 'Omen' : 'Adventure') + ')' : d.name) + ' — ' + MF.manaStr(cost));
        }
        else if (a.type === 'act') { const ab = MF.chars(s, a.iid).ab[a.ab]; add(a.iid, a, (ab.equip ? 'Equip (' + ab.cost.mana + ')' : 'Activate: ' + MF.describeAbility(ab)).slice(0, 90)); }
        else if (a.type === 'pass') btns.push({ a: a, label: T.passLabel(s, ui.human), cls: 'primary' });
      }
      btns.push({ ui: 'passTurn', label: 'Pass to end of turn', cls: 'ghost' });
      for (const e of s.effects) if (e.k === 'mayPlay' && e.who === ui.human && s.cards[e.iid] && s.cards[e.iid].zone === 'exile' && !tray.includes(e.iid)) tray.push(e.iid);
    }
    return { m: m, btns: btns, prompt: prompt, tray: tray };
  }

  // ---------------------------------------------------------------------------------------------
  // The board
  // ---------------------------------------------------------------------------------------------
  function permHTML(v, iid, am) {
    const att = v.bf.filter(i => v.cards[i].att === iid);
    const c = v.cards[iid];
    const why = null;
    return `<div class="perm ${c.tapped ? 'is-tapped' : ''}">${face(v, c.id, { iid: iid, acts: am.m[iid], why: why })}${att.map(i => `<div class="attached">${face(v, v.cards[i].id, { iid: i, acts: am.m[i], size: 'sm' })}</div>`).join('')}</div>`;
  }
  function sideHTML(s, v, seat, am) {
    const p = v.players[seat], mine = seat === ui.human;
    const perms = v.bf.filter(i => v.cards[i].ctrl === seat && !(v.cards[i].att != null && v.cards[i].att >= 0 && v.cards[v.cards[i].att] && v.cards[v.cards[i].att].zone === 'bf'));
    const lands = perms.filter(i => MF.isType(v, i, 'Land')), others = perms.filter(i => !MF.isType(v, i, 'Land'));
    const creatures = others.filter(i => MF.isType(v, i, 'Creature')), rest = others.filter(i => !MF.isType(v, i, 'Creature'));
    const pk = 'p' + seat;
    const pool = T.poolStr(p.pool);
    const panel = `<div class="ppanel ${s.ap === seat ? 'active' : ''} ${am.m[pk] ? 'legal' : ''}" data-seat="${seat}" ${am.m[pk] ? `data-acts='${esc(JSON.stringify(am.m[pk]))}'` : ''}>
        <div class="pname">${mine ? 'You' : 'Opponent'}<span class="pdeck">${esc(MF.decks[p.deckId].name)}</span></div>
        <div class="plife" title="Life">${p.life}</div>
        ${pool ? `<div class="ppool" title="Mana pool — empties at the end of each step">${pool}</div>` : ''}
        <div class="pzones">
          <span class="pz" title="Library">Library ${p.lib.length}</span>
          ${mine ? '' : `<span class="pz" title="Cards in hand">Hand ${p.hand.length}</span>`}
          <span class="pz click" data-view="grave:${seat}">Graveyard ${p.grave.length}</span>
          <span class="pz click" data-view="exile:${seat}">Exile ${p.exile.length}</span>
        </div>
      </div>`;
    const row = (ids, cls, label) => `<div class="bfrow ${cls}">${ids.length ? ids.map(i => permHTML(v, i, am)).join('') : `<div class="bfempty">${label}</div>`}</div>`;
    const field = mine
      ? row(creatures.concat(rest), 'front', 'no creatures') + row(lands, 'lands', 'no lands')
      : row(lands, 'lands', 'no lands') + row(creatures.concat(rest), 'front', 'no creatures');
    return `<div class="side ${mine ? 'me' : 'opp'}">${panel}<div class="field">${field}</div></div>`;
  }
  function stackHTML(s, v, am) {
    if (!v.stack.length) return `<div class="stack empty"><div class="zl">Stack</div><div class="stackempty">empty</div></div>`;
    const items = v.stack.slice().reverse().map((L, k) => {
      const id = L.kind === 'spell' ? L.id : L.srcId;
      const tgs = (L.t || []).flat().filter(Boolean);
      const tl = tgs.map(r => r.p != null ? (r.p === ui.human ? 'you' : 'the opponent') : (v.cards[r.c] ? MF.cards[v.cards[r.c].id].name : '(gone)')).join(', ');
      const hl = tgs.filter(r => r.c != null).map(r => r.c).concat(tgs.filter(r => r.p != null).map(r => 'p' + r.p));
      const what = L.kind === 'spell' ? (L.copy ? 'copy of a spell' : 'spell') : L.kind === 'trig' ? (L.inl === 'prowess' ? 'prowess' : 'triggered ability') : 'activated ability';
      return `<div class="layer ${k === 0 ? 'top' : ''}" data-hl='${esc(JSON.stringify(hl))}'>${face(v, id, { iid: L.kind === 'spell' ? L.iid : null, size: 'sm', acts: L.kind === 'spell' ? am.m[L.iid] : null })}
        <div class="linfo"><b>${esc(MF.cards[id].name)}</b><br>${what} · ${L.ctrl === ui.human ? 'yours' : 'opponent’s'}${tl ? '<br>→ ' + esc(tl) : ''}${L.x ? '<br>X = ' + L.x : ''}</div></div>`;
    }).join('');
    return `<div class="stack"><div class="zl">Stack — top first (${v.stack.length})</div>${items}</div>`;
  }
  function stepsHTML(s) {
    const mineTurn = s.ap === ui.human, key = mineTurn ? 'me' : 'opp';
    return `<div class="steps"><span class="whose ${mineTurn ? 'mine' : ''}">${mineTurn ? 'Your turn' : 'Opponent’s turn'} ${s.turn}</span>${Object.keys(STEP_SHORT).map(st =>
      `<span class="st ${s.step === st ? 'now' : ''} ${ui.stops[key][st] ? 'stop' : ''}" data-stop="${key}:${st}" title="${ui.stops[key][st] ? 'The game stops here for you when you can act. Click to stop stopping.' : 'Click to make the game stop here when you can act.'}">${STEP_SHORT[st]}</span>`).join('')}</div>`;
  }
  function promptHTML(s, am) {
    if (s.winner != null) {
      const title = s.winner === 'draw' ? 'The game is a draw' : s.winner === ui.human ? 'You win' : 'You lose';
      return `<div class="prompt over"><div class="ptitle">${title}</div><div class="pbtns"><button class="btn primary" data-ui="again">Play again</button> <button class="btn" data-ui="menu">Menu</button> <button class="btn ghost" data-ui="bug">Copy bug report</button></div></div>`;
    }
    const who = MF.whoActs(s);
    if (who !== ui.human) return `<div class="prompt wait"><div class="ptitle">The opponent is thinking…</div><div class="pbody">${MF.stepName(s)}</div></div>`;
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
    return `<div class="prompt mine ${ui.peek ? 'peek' : ''}"><div class="ptext"><div class="ptitle">${title}</div><div class="pbody">${body}</div></div>${tray}<div class="pbtns">${btns}</div><button class="btn tiny peekbtn" data-ui="peek" title="Escape">${ui.peek ? 'Show prompt' : 'Hide'}</button></div>`;
  }
  function handHTML(s, v, am) {
    const p = v.players[ui.human];
    const canAsk = s.priority === ui.human && !s.pending;
    return `<div class="hand">${p.hand.map(i => face(v, v.cards[i].id, { iid: i, acts: am.m[i], size: 'hand', why: !am.m[i] && canAsk ? MF.whyNot(s, ui.human, i) : null })).join('') || '<div class="bfempty">no cards in hand</div>'}</div>`;
  }
  function logHTML(v) {
    const from = Math.max(0, v.log.length - 60);
    let h = '';
    for (let i = v.log.length - 1; i >= from; i--) { const e = v.log[i]; h += `<div class="ll t-${e.t} ${e.who === ui.human ? 'lme' : e.who === 1 - ui.human ? 'lopp' : ''}">${T.logLine(e, ui.human)}</div>`; }   // newest first (CARD-LOG-AND-TARGETING-SPEC §5)
    const recent = ui.recent.slice(-10).reverse().map(r => `<div class="rc ${r.who === ui.human ? 'mine' : ''}">${face(null, r.id, { size: 'xs' })}</div>`).join('');
    return `<div class="log"><div class="loghead">Recently played</div><div class="recent">${recent || '<span class="dim">nothing yet</span>'}</div><div class="loghead">Log <span>newest first</span></div><div class="loglines">${h}</div></div>`;
  }
  function modalHTML(v, am) {
    if (!ui.modal) return '';
    const [zone, seatS] = ui.modal.split(':'), seat = +seatS, p = v.players[seat];
    const ids = zone === 'grave' ? p.grave.slice().reverse() : p.exile;
    return `<div class="modal" data-ui="closemodal"><div class="mbox"><div class="mtitle">${seat === ui.human ? 'Your' : 'The opponent’s'} ${zone === 'grave' ? 'graveyard (top first)' : 'exile'} — ${T.plural(ids.length, 'card')}</div>
      <div class="mcards">${ids.map(i => face(v, v.cards[i].id, { iid: i, acts: am.m[i] })).join('') || '<div class="empty">nothing here</div>'}</div><button class="btn" data-ui="closemodal">Close</button></div></div>`;
  }
  function render() {
    const s = ui.s, v = MF.view(s), am = actionMap(s);
    const app = document.getElementById('app');
    app.innerHTML = `<div class="game">
      <div class="board">
        ${sideHTML(s, v, 1 - ui.human, am)}
        <div class="mid">${stepsHTML(v)}${stackHTML(s, v, am)}</div>
        ${sideHTML(s, v, ui.human, am)}
        ${promptHTML(s, am)}
        ${handHTML(s, v, am)}
      </div>
      <div class="sidebar">
        <div class="topbar"><span class="brand">MANAFORGE</span><button class="btn tiny" data-ui="howto">How to play</button><button class="btn tiny" data-ui="menu">Menu</button></div>
        ${logHTML(v)}
      </div>
      ${ui.spot ? `<div class="spot">${face(null, ui.spot.id, { size: 'lg' })}<div class="spotlbl">${esc(ui.spot.label)}</div></div>` : ''}
      ${modalHTML(v, am)}
      ${ui.menu ? `<div class="cmenu" style="left:${ui.menu.x}px;top:${ui.menu.y}px">${ui.menu.items.map((it, i) => `<button class="btn" data-menu="${i}" ${it.hl != null ? `data-hl='${esc(JSON.stringify([it.hl]))}'` : ''}>${T.symbols(it.label)}</button>`).join('')}<button class="btn ghost" data-menu="-1">Never mind</button></div>` : ''}
      <svg id="arrows" class="arrows"></svg>
      <div id="zoom" class="zoom"></div>
    </div>`;
    drawArrows(v, s.pending && s.pending.q);
  }
  ui.render = render;

  // Combat arrows: attacker → defending player, blocker → attacker (CARD-LOG-AND-TARGETING-SPEC §14).
  function drawArrows(v, q) {
    const svg = document.getElementById('arrows'); if (!svg || !v.combat) return;
    // A declaration in progress is drawn as a proposal (amber); a declared one in red and blue.
    if (q && q.kind === 'attack') for (const i of q.chosen) { const el = document.querySelector('.field [data-iid="' + i + '"]'); if (el) el.classList.add('aiming'); }
    const at = iid => { const el = document.querySelector(`.field [data-iid="${iid}"]`); return el ? el.getBoundingClientRect() : null; };
    const pr = seat => { const el = document.querySelector(`.ppanel[data-seat="${seat}"]`); return el ? el.getBoundingClientRect() : null; };
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
    const text = rules(d.text) + (d.alt ? `<div class="zalt"><b>${esc(d.alt.name)}</b> <span class="zcost">${T.symbols(d.alt.mana)}</span><br><i>${esc(d.alt.typeLine)}</i><br>${rules(d.alt.text)}</div>` : '');
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
    if (e.key === 'Escape') { if (ui.modal || ui.menu) { ui.modal = null; ui.menu = null; } else ui.peek = !ui.peek; render(); }   // Escape toggles peek (CARD-LOG-AND-TARGETING-SPEC §13)
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
    const legal = MF.legalActions(s);
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
      }, ui.spot ? 1200 : visible ? 380 : 60);
      return;
    }
    if (!s.pending && !shouldStop(s)) {
      const p = MF.legalActions(s).find(a => a.type === 'pass');
      ui.timer = setTimeout(() => dispatch(p), visible ? 300 : 40);
    } else if (ui.spot) ui.timer = setTimeout(() => { ui.spot = null; render(); }, 1400);
  }
  ui.begin = function (setup, state) {
    clearTimeout(ui.timer);
    ui.setup = setup; ui.human = setup.human; ui.actions = []; ui.spot = null; ui.modal = null; ui.menu = null; ui.recent = []; ui.passUntil = null; ui.peek = false;
    ui.stops = loadStops();
    ui.s = state;
    step(false);
  };
  ui.dispatch = dispatch;                                                                    // for the page tests (tools and the browser console)
  ui.stop = function () { clearTimeout(ui.timer); ui.s = null; };
})();
