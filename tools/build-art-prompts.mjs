#!/usr/bin/env node
// tools/build-art-prompts.mjs — build tools/art-prompts.json from the registered decks, and LINT it.
//
//   node tools/build-art-prompts.mjs             build (exit 1 on a missing CARDS entry or a lint error)
//   node tools/build-art-prompts.mjs --selftest  prove the lint rejects known-bad prompts (exit 0 when it does)
//
// The lint REFUSES TO WRITE the file when any prompt breaks a rule. Each rule is a thing that has
// gone wrong in an earlier project:
//   - a count above two (words or digits): renders unreliably
//   - crowd words: the subject becomes unreadable
//   - text-magnet nouns (sign, banner, label, scroll...): the model draws letters
//   - negations (no, not, without, never...): they summon what they negate
//   - forbidden proper nouns (franchise / set / artist / studio / game): never named in a prompt
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './load.mjs';
import { WHO, CARDS } from './art-identity.mjs';
import { wantedKeys } from './art-keys.mjs';

// PLAN D10. One STYLE constant, byte-identical on every prompt. Changing it means re-paying for
// every render.
// The style leads the prompt: on the first samples, with it at the end, the subject won and only
// a character with a face came out super-deformed (scratch/samples-v1, 2026-10-03).
export const STYLE =
  'super deformed chibi figure, two heads tall, giant round head on a tiny stubby body, big sparkling eyes, ' +
  'cute toy-like rounded shapes, polished cel shading, clean thick ink outlines, trading card illustration, ' +
  'soft painterly storybook background, vivid saturated colour';

const RULES = [
  [/\b(three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|hundred|thousand|[3-9]|\d{2,})\b/i, 'count above two renders unreliably'],
  [/\b(many|crowd|crowds|group of|several|army|horde|swarm)\b/i, 'crowd word makes the subject unreadable'],
  [/\b(sign|signs|signage|signpost|banner|banners|poster|logo|logos|label|labels|text|lettering|letter|letters|words|word|title|titles|caption|subtitle|newspaper|book|books|page|pages|scroll|scrolls|placard|billboard|nameplate|watermark|signature|inscription|inscriptions|writing|written|typography|font|map|maps)\b/i, 'text-magnet noun, the model will render letters'],
  [/\b(no|not|without|never|none|avoid|exclude|excluding|absent|lacking|free of|don't|doesn't|cannot|can't)\b/i, 'negation, negations summon what they negate'],
  [/\b(magic the gathering|magic: the gathering|mtg|wizards of the coast|wizards|bloomburrow|planeswalker|flesh and blood|one piece|pokemon|yu-?gi-?oh|hearthstone|marvel|disney|pixar|ghibli|sanrio|artstation|rutkowski|in the style of|style of|dungeons and dragons|warhammer|redwall|beatrix potter)\b/i, 'names a real franchise, set, artist, studio or game'],
];
export function lint(key, prompt) {
  const errs = [];
  for (const [re, why] of RULES) { const m = prompt.match(re); if (m) errs.push(`${key}: "${m[0]}" — ${why}`); }
  if (!prompt.includes(STYLE)) errs.push(`${key}: the STYLE constant is missing or altered`);
  if (prompt.length > 900) errs.push(`${key}: prompt is ${prompt.length} chars, over the 900 cap`);
  return errs;
}

const args = process.argv.slice(2);
if (args.includes('--selftest')) {
  const styleErrs = lint('STYLE', STYLE);
  const bad = [
    ['three rabbits', 'three rabbits charging across a field. ' + STYLE + '.'],
    ['negation', 'a knight without a helmet. ' + STYLE + '.'],
    ['text magnet', 'an otter holding a scroll. ' + STYLE + '.'],
    ['proper noun', 'an otter from Bloomburrow. ' + STYLE + '.'],
    ['style drift', 'a knight standing. watercolour.'],
  ];
  let caught = 0;
  for (const [name, p] of bad) { const e = lint(name, p); if (e.length) caught++; else console.error(`selftest: lint FAILED to reject "${name}"`); }
  const ok = caught === bad.length && !styleErrs.length;
  console.log(`selftest: ${caught}/${bad.length} known-bad prompts rejected, STYLE ${styleErrs.length ? 'DIRTY: ' + styleErrs.join('; ') : 'clean'} -> ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}

const keys = await wantedKeys();
const missing = [], unknown = [], prompts = [];
for (const key of keys) {
  const e = CARDS[key];
  if (!e) { missing.push(key); continue; }
  if (e.who && !WHO[e.who]) { unknown.push(`${key} (who "${e.who}")`); continue; }
  const subject = e.who ? `${WHO[e.who]}, ${e.subject}` : e.subject;
  prompts.push({ key, prompt: `${STYLE}. ${subject}, ${e.setting}.` });
}
if (missing.length || unknown.length) {
  if (missing.length) console.error(`${missing.length} wanted key(s) have no CARDS entry in tools/art-identity.mjs:\n  ` + missing.join('\n  '));
  if (unknown.length) console.error('unknown WHO reference:\n  ' + unknown.join('\n  '));
  process.exit(1);
}
const errs = [...lint('STYLE', STYLE), ...prompts.flatMap((p) => lint(p.key, p.prompt))];
if (errs.length) {
  console.error(`LINT FAILED — ${errs.length} violation(s). tools/art-prompts.json was NOT written.\n`);
  errs.forEach((e) => console.error('  ' + e));
  process.exit(1);
}
await writeFile(join(ROOT, 'tools', 'art-prompts.json'), JSON.stringify(prompts, null, 2) + '\n');
console.log(`${prompts.length} prompts written to tools/art-prompts.json, lint clean.`);
