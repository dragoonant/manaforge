// Card art. A generated painting when one exists (data/art-manifest.js, added by the art
// pipeline); until then, and always as the fallback, a deterministic SVG seeded from the card id
// (CARD-PRESENTATION-SPEC §3). No official illustration is ever used (docs/rights.md).
(function () {
  'use strict';
  const MF = window.MF;
  const PAL = {
    W: ['#f4ead2', '#d9c48f', '#a88f52'], U: ['#9cc7ee', '#3f78b5', '#1d3b66'], B: ['#9b8aa5', '#4c3d57', '#1d1624'],
    R: ['#f2a37a', '#c4492b', '#5e1b12'], G: ['#a9d38a', '#4f8a3a', '#1f3d1c'], C: ['#d0d4d8', '#8a9097', '#3f454c'],
  };
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let t = seed; return () => { t = (t + 0x6D2B79F5) | 0; let r = Math.imul(t ^ (t >>> 15), t | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  const cache = {};
  function svgFor(id) {
    const d = MF.cards[id];
    const cols = d.colors.length ? d.colors : (d.types.includes('Land') ? landColors(d) : ['C']);
    const r = rng(hash(id));
    const a = PAL[cols[0]], b = PAL[cols[cols.length - 1]];
    let shapes = '';
    // Sky, a sun, layered hills — a landscape for lands, a figure silhouette for creatures.
    shapes += `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a[0]}"/><stop offset=".55" stop-color="${b[1]}"/><stop offset="1" stop-color="${a[2]}"/></linearGradient>
      <radialGradient id="s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe8" stop-opacity=".95"/><stop offset="1" stop-color="#fffbe8" stop-opacity="0"/></radialGradient></defs>
      <rect width="100" height="140" fill="url(#g)"/>
      <circle cx="${20 + r() * 60}" cy="${18 + r() * 30}" r="${14 + r() * 14}" fill="url(#s)"/>`;
    for (let k = 0; k < 3; k++) {
      const y = 70 + k * 18 + r() * 8, c = k === 2 ? a[2] : k === 1 ? b[2] : b[1];
      let pth = `M0 ${y}`;
      for (let x = 0; x <= 100; x += 10) pth += ` L${x} ${y - r() * (22 - k * 5)}`;
      shapes += `<path d="${pth} L100 140 L0 140 Z" fill="${c}" opacity="${0.75 + k * 0.1}"/>`;
    }
    if (d.types.includes('Creature')) {
      const cx = 35 + r() * 30, h = 40 + Math.min(40, (d.power || 2) * 6);
      shapes += `<ellipse cx="${cx}" cy="${118 - h * 0.45}" rx="${10 + r() * 6}" ry="${h * 0.42}" fill="#0b0b10" opacity=".55"/><circle cx="${cx}" cy="${118 - h * 0.9}" r="${6 + r() * 3}" fill="#0b0b10" opacity=".55"/>`;
    } else if (!d.types.includes('Land')) {
      for (let k = 0; k < 7; k++) shapes += `<circle cx="${r() * 100}" cy="${20 + r() * 80}" r="${1 + r() * 3}" fill="#fff" opacity="${0.3 + r() * 0.5}"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice">${shapes}</svg>`;
  }
  function landColors(d) {
    const out = [];
    for (const a of d.ab) if (a.k === 'mana') for (const c of a.cols) if (!out.includes(c)) out.push(c);
    return out.length ? out : ['C'];
  }
  MF.art = {
    css: function (id) {
      const man = MF.artManifest;                                                              // filled by the art pipeline; absent until then
      if (man && man[id]) return `url('${man[id]}')`;
      if (!cache[id]) cache[id] = `url('data:image/svg+xml;utf8,${encodeURIComponent(svgFor(id))}')`;
      return cache[id];
    },
    missing: function () { const man = MF.artManifest; return Object.keys(MF.cards).filter(id => !(man && man[id])); },
  };
})();
