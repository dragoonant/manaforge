// The presentation director (handoff 10; Mallet-42k lessons §4). The engine is always ahead: each
// render replaces the board at once, and this module turns the jump into motion. Before a render it
// records where every card was; after it, it plays the difference — a card that moved slides from
// its old place, a permanent that left the battlefield leaves a ghost that flashes and flies to the
// graveyard, exile or a hand, a new one arrives from where it was cast, damage and life float as
// numbers. It reads the log for what happened; it never decides anything. The driver waits for
// `busy` before the opponent acts, so a turn can be followed. Motion: on, or off (also off by
// default under prefers-reduced-motion).
(function () {
  'use strict';
  const MF = window.MF;
  const A = MF.anim = { on: true, seen: 0, busyUntil: 0 };
  try { const m = localStorage.getItem('mf-motion'); A.on = m ? m === 'on' : !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* storage unavailable: on */ }
  A.toggle = function () { A.on = !A.on; try { localStorage.setItem('mf-motion', A.on ? 'on' : 'off'); } catch (e) { /* not persisted */ } };

  const SEL = '.field [data-iid], .hand [data-iid], .stack [data-iid]';
  // Where every card is now, by object id; the box that moves is its permanent (so a tapped card's
  // rotation stays its own), an attachment's own slot, or the card itself.
  A.capture = function () {
    const els = {};
    for (const el of document.querySelectorAll(SEL)) {
      const iid = +el.getAttribute('data-iid'); if (els[iid]) continue;
      const box = el.closest('.attached') || el.closest('.perm') || el;
      els[iid] = { r: box.getBoundingClientRect(), html: box.outerHTML, cid: el.getAttribute('data-cid'), where: el.closest('.field') ? 'bf' : el.closest('.hand') ? 'hand' : 'stack', tapped: el.classList.contains('tapped'), seat: el.closest('.side') ? (el.closest('.side').classList.contains('me') ? 'me' : 'opp') : null };
    }
    return { els: els };
  };
  A.reset = function (s) { A.seen = s ? s.log.length : 0; A.prev = null; A.busyUntil = 0; const fx = document.getElementById('fx'); if (fx) fx.innerHTML = ''; };

  function layer() { let fx = document.getElementById('fx'); if (!fx) { fx = document.createElement('div'); fx.id = 'fx'; document.body.appendChild(fx); } return fx; }
  // Removed by a timer, not onfinish: a hidden tab never finishes an animation (handoff 10).
  const expire = (el, ms) => setTimeout(() => el.remove(), ms + 50);
  const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  function float(text, r, cls, delay) {                                                        // a number rising from a card or a life total
    const d = document.createElement('div'); d.className = 'fxnum ' + cls; d.textContent = text;
    const c = center(r); d.style.left = c.x + 'px'; d.style.top = c.y + 'px';
    layer().appendChild(d);
    d.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-90%) scale(1.15)', opacity: 1, offset: .2 }, { transform: 'translate(-50%,-220%) scale(1)', opacity: 0 }], { duration: 1100, delay: delay, easing: 'ease-out', fill: 'both' }); expire(d, delay + 1100);
    return delay + 1100;
  }

  // ui: { human }, v: the view after the action, fresh: its new log entries. Returns how long the motion runs (ms).
  A.play = function (before, v, human) {
    const fresh = v.log.slice(A.seen); A.seen = v.log.length;
    if (!A.on || !before) return 0;
    const after = A.capture().els, was = before.els;
    let busy = 0;
    const seatOf = side => side === 'me' ? human : 1 - human;
    const panel = seat => document.querySelector(`.ppanel[data-seat="${seat}"]`);
    const zoneLink = (seat, z) => { const p = panel(seat); return p && p.querySelector(`[data-view="${z}:${seat}"]`); };
    const boxOf = iid => { const el = document.querySelector(SEL.split(', ').map(q => q.replace('[data-iid]', `[data-iid="${iid}"]`)).join(', ')); return el && (el.closest('.attached') || el.closest('.perm') || el); };

    // 1. Cards on screen before and after: slide from the old place; a tap or untap turns.
    const gone = [];
    for (const k in was) {
      const w = was[k], n = after[k];
      if (!n) { gone.push(+k); continue; }
      const box = boxOf(k); if (!box) continue;
      const dx = w.r.left - n.r.left, dy = w.r.top - n.r.top;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) { box.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.7,.3,1)' }); busy = Math.max(busy, 320); }
      if (w.tapped !== n.tapped) { const card = box.querySelector('.card') || box; card.animate([{ transform: w.tapped ? 'rotate(90deg)' : 'rotate(0deg)' }, { transform: n.tapped ? 'rotate(90deg)' : 'rotate(0deg)' }], { duration: 260, easing: 'ease-out' }); busy = Math.max(busy, 260); }
    }
    // 2. New on the battlefield or the stack: it arrives from a card of the same name that just left
    // the hand or the stack (a new object, CR 400.7), or from its controller's panel.
    const used = new Set();
    for (const k in after) {
      if (was[k]) continue;
      const n = after[k]; if (n.where === 'hand') continue;
      const src = gone.find(g => !used.has(g) && was[g].cid === n.cid && was[g].where !== 'bf' && (n.where === 'bf' || was[g].where === 'hand'));
      let from;
      if (src != null) { used.add(src); from = was[src].r; }
      else { const p = n.seat ? panel(seatOf(n.seat)) : null; from = p ? p.getBoundingClientRect() : null; }
      const box = boxOf(k); if (!box) continue;
      const kf = from ? [{ transform: `translate(${center(from).x - center(n.r).x}px,${center(from).y - center(n.r).y}px) scale(.7)`, opacity: .4 }, { transform: 'none', opacity: 1 }] : [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }];
      box.animate(kf, { duration: 420, easing: 'cubic-bezier(.2,.7,.3,1)' }); busy = Math.max(busy, 420);
      if (n.where === 'bf') box.animate([{ filter: 'brightness(1.8)' }, { filter: 'none' }], { duration: 600, easing: 'ease-out' });
    }
    // 3. Left the battlefield: a ghost at its last place flashes for how it left, then flies to where it went.
    const how = cid => { const e = fresh.slice().reverse().find(x => x.c === cid && ['destroy', 'sacrifice', 'exiled', 'exiledInstead', 'bounce', 'tokenGone', 'dies', 'toLibrary', 'milled'].includes(x.t)); return e ? e.t : null; };
    let gi = 0;
    for (const g of gone) {
      const w = was[g]; if (w.where !== 'bf' || used.has(g)) continue;
      const c = v.cards[g], owner = c ? c.owner : seatOf(w.seat), t = how(w.cid);
      const dest = t === 'exiled' || t === 'exiledInstead' ? zoneLink(owner, 'exile') : t === 'bounce' ? (owner === human ? document.querySelector('.hand') : panel(owner)) : t === 'tokenGone' ? null : t === 'toLibrary' ? panel(owner) : zoneLink(owner, 'grave');
      const ghost = document.createElement('div'); ghost.className = 'fxghost'; ghost.innerHTML = w.html;
      Object.assign(ghost.style, { left: w.r.left + 'px', top: w.r.top + 'px', width: w.r.width + 'px', height: w.r.height + 'px' });
      layer().appendChild(ghost);
      const tint = t === 'exiled' || t === 'exiledInstead' ? 'brightness(2.4) saturate(0)' : t === 'bounce' ? 'brightness(1.4) hue-rotate(160deg)' : 'brightness(.9) sepia(1) saturate(5) hue-rotate(-30deg)';
      const to = dest ? dest.getBoundingClientRect() : w.r, dx = center(to).x - center(w.r).x, dy = center(to).y - center(w.r).y;
      const delay = gi++ * 90;
      ghost.animate([
        { transform: 'none', filter: 'none', opacity: 1 },
        { transform: 'translateX(-4px) rotate(-2deg)', filter: tint, opacity: 1, offset: .12 },
        { transform: 'translateX(4px) rotate(2deg)', filter: tint, opacity: 1, offset: .24 },
        { transform: 'none', filter: tint, opacity: 1, offset: .38 },
        { transform: dest ? `translate(${dx}px,${dy}px) scale(.25)` : 'scale(.6)', filter: tint, opacity: 0 },
      ], { duration: 1000, delay: delay, easing: 'ease-in', fill: 'both' }); expire(ghost, delay + 1000);
      busy = Math.max(busy, delay + 1000);
    }
    // 4. Numbers: damage to a creature over it (where it was, if it has since died), life over the panel.
    let ni = 0;
    for (const e of fresh) {
      let r = null, text = null, cls = 'hurt';
      if (e.t === 'damageCreature') {
        const k = Object.keys(was).find(i => was[i].where === 'bf' && was[i].cid === e.c) || Object.keys(after).find(i => after[i].where === 'bf' && after[i].cid === e.c);
        if (k == null) continue;
        const b = boxOf(k); r = b ? b.getBoundingClientRect() : (was[k] || after[k]).r; text = '−' + e.n;
      } else if (e.t === 'damage' || e.t === 'lifeLoss' || e.t === 'life') {
        const p = panel(e.who); if (!p) continue;
        const lifeEl = p.querySelector('.plife') || p; r = lifeEl.getBoundingClientRect();
        text = (e.t === 'life' ? '+' : '−') + (e.lost != null ? e.lost : e.n); cls = e.t === 'life' ? 'heal' : 'hurt';
        lifeEl.animate([{ transform: 'scale(1.35)', color: e.t === 'life' ? '#7be29b' : '#ff6b6b' }, { transform: 'none' }], { duration: 700, delay: ni * 120, easing: 'ease-out', fill: 'backwards' });
      } else continue;
      busy = Math.max(busy, float(text, r, cls, ni++ * 120) - 300);                          // the next action may start as a number fades
    }
    A.busyUntil = Date.now() + busy;
    return busy;
  };
})();
