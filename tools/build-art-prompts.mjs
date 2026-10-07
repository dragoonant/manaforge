#!/usr/bin/env node
// tools/build-art-prompts.mjs — build tools/art-prompts.json from the registered decks, and LINT it.
//
//   node tools/build-art-prompts.mjs             build (exit 1 on a missing CARDS entry or a lint error)
//   node tools/build-art-prompts.mjs --selftest  prove the lint rejects known-bad prompts (exit 0 when it does)
//
// The lint REFUSES TO WRITE the file when any card's words break a rule. Each rule is a thing that
// has gone wrong in an earlier project:
//   - a count above two (words or digits): renders unreliably
//   - crowd words: the subject becomes unreadable
//   - text-magnet nouns (sign, banner, label, scroll...): the model draws letters
//   - negations (no, not, without, never...): they summon what they negate — they belong in the
//     negative prompt, which tools/gen-art-sdxl.py builds
//   - forbidden proper nouns (franchise / set / artist / studio / game): never named in a prompt
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './load.mjs';
import { WHO, CARDS } from './art-identity.mjs';
import { wantedKeys } from './art-keys.mjs';
import { STYLES, styleFor } from './art-styles.mjs';

// PLAN D17 (2026-10-05): each card takes one of the fifteen styles in tools/art-styles.mjs, by a
// stable hash of its key, so the art reads as many artists' work. The constants below are style D
// (D14), kept for the selftest.
// PLAN D14: direction D, "Grim Dark", chosen by the owner from the audition of 2026-10-04
// (scratch/audition-sheet.jpg). These constants are byte-identical on every prompt of their kind;
// they were reviewed as a whole, so the count rule does not apply to "three heads tall" inside them.
export const STYLE = 'grim dark fantasy painting, muted earthy palette, gritty textures, smoke and blood-red light, brutal violent mood, chiaroscuro';
export const SHORT = 'super deformed grim warrior, stocky three heads tall, scarred and armoured, ';
export const LAND_STYLE = 'grim dark fantasy landscape painting, ash falling, grey smoke, muted earthy palette, desolate wasteland';
export const LAND_SHORT = 'landscape painting, scenery, ';
export const OBJECT_SHORT = 'fantasy still life painting of a single object, ';
// For lands, everything living goes in the negative prompt (owner, 2026-10-04: no characters in lands).
export const LAND_NEGATIVE = 'person, people, character, creature, animal, figure, rider, warrior, face, house, cottage, building, village';

const RULES = [
  [/\b(three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|hundred|thousand|[3-9]|\d{2,})\b/i, 'count above two renders unreliably'],
  [/\b(many|crowd|crowds|group of|several|army|horde|swarm)\b/i, 'crowd word makes the subject unreadable'],
  [/\b(sign|signs|signage|signpost|banner|banners|poster|logo|logos|label|labels|text|lettering|letter|letters|words|word|title|titles|caption|subtitle|newspaper|book|books|page|pages|scroll|scrolls|placard|billboard|nameplate|watermark|signature|inscription|inscriptions|writing|written|typography|font|map|maps)\b/i, 'text-magnet noun, the model will render letters'],
  [/\b(no|not|without|never|none|avoid|exclude|excluding|absent|lacking|free of|don't|doesn't|cannot|can't)\b/i, 'negation, negations summon what they negate'],
  [/\b(magic the gathering|magic: the gathering|mtg|wizards of the coast|wizards|bloomburrow|planeswalker|flesh and blood|one piece|pokemon|yu-?gi-?oh|hearthstone|marvel|disney|pixar|ghibli|sanrio|artstation|rutkowski|in the style of|style of|dungeons and dragons|warhammer|redwall|beatrix potter)\b/i, 'names a real franchise, set, artist, studio or game'],
  [/\b(cute|kawaii|adorable|chibi|plush|cuddly|hug|hugging|smiling)\b/i, 'cute word: the owner wants warriors and mages, never cute (2026-10-04)'],
];
// Lint a card's own words (subject and setting), plus the prompt as a whole for the style check.
export function lint(key, words, prompt, style) {
  const errs = [];
  for (const [re, why] of RULES) { const m = words.match(re); if (m) errs.push(`${key}: "${m[0]}" — ${why}`); }
  if (prompt != null && !prompt.includes(style)) errs.push(`${key}: the style constant is missing or altered`);
  if (prompt != null && prompt.length > 900) errs.push(`${key}: prompt is ${prompt.length} chars, over the 900 cap`);
  return errs;
}

const args = process.argv.slice(2);
if (args.includes('--selftest')) {
  const bad = [
    ['three rabbits', 'three rabbits charging across a field'],
    ['negation', 'a knight without a helmet'],
    ['text magnet', 'an otter holding a scroll'],
    ['proper noun', 'an otter from Bloomburrow'],
    ['cute', 'a cute rabbit hugging a friend'],
  ];
  let caught = 0;
  for (const [name, w] of bad) { if (lint(name, w, null).length) caught++; else console.error(`selftest: lint FAILED to reject "${name}"`); }
  const drift = lint('style drift', 'a knight standing', 'a knight standing. watercolour.', STYLE).length > 0;
  const ok = caught === bad.length && drift;
  console.log(`selftest: ${caught}/${bad.length} known-bad words rejected, style drift ${drift ? 'rejected' : 'MISSED'} -> ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}

const keys = await wantedKeys();
const missing = [], unknown = [], prompts = [];
for (const key of keys) {
  const e = CARDS[key];
  if (!e) { missing.push(key); continue; }
  if (e.who && !WHO[e.who]) { unknown.push(`${key} (who "${e.who}")`); continue; }
  const subject = e.who ? `${WHO[e.who]}, ${e.subject}` : e.subject;
  const sid = styleFor(key), st = STYLES[sid];
  // An object card (a Treasure, an Equipment shown alone) takes the style but no figure: the style's character lead-in would put a warrior in front of it.
  const land = !!e.land, object = !!e.object, style = land ? st.land : st.style, short = land ? LAND_SHORT : object ? OBJECT_SHORT : st.short;
  // The parts travel too: SDXL reads 77 tokens per text encoder; tools/gen-art-sdxl.py leads both
  // encoders with `short` + subject and gives the second the setting and the full style (PLAN D13).
  prompts.push({ key, styleId: sid, land, prompt: `${short}${subject}, ${e.setting}. ${style}.`, subject, setting: e.setting, style, short, negativeExtra: land || object ? LAND_NEGATIVE : '' });
}
if (missing.length || unknown.length) {
  if (missing.length) console.error(`${missing.length} wanted key(s) have no CARDS entry in tools/art-identity.mjs:\n  ` + missing.join('\n  '));
  if (unknown.length) console.error('unknown WHO reference:\n  ' + unknown.join('\n  '));
  process.exit(1);
}
const errs = prompts.flatMap((p) => lint(p.key, p.subject + ' ' + p.setting, p.prompt, p.style));
if (errs.length) {
  console.error(`LINT FAILED — ${errs.length} violation(s). tools/art-prompts.json was NOT written.\n`);
  errs.forEach((e) => console.error('  ' + e));
  process.exit(1);
}
await writeFile(join(ROOT, 'tools', 'art-prompts.json'), JSON.stringify(prompts, null, 2) + '\n');
const mix = {}; for (const p of prompts) mix[p.styleId] = (mix[p.styleId] || 0) + 1;
console.log(`${prompts.length} prompts written to tools/art-prompts.json (${prompts.filter(p => p.land).length} lands), lint clean. Styles: ${Object.keys(mix).sort().map(k => k + ' ' + mix[k]).join(', ')}.`);
