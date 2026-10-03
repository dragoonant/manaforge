#!/usr/bin/env node
// tools/check-art.mjs — the gate. Exit 1 if a manifest entry points to a missing, zero-length or
// wrong-case file, or a file in art/cards is not in the manifest. Prints (never fails on) the
// cards in registered decks that have no art yet: they show the procedural fallback.
import { readdir, stat } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { ROOT } from './load.mjs';
import { loadData, wantedKeys } from './art-keys.mjs';

let fails = 0;
const fail = (m) => { console.error('FAIL  ' + m); fails++; };
const manifest = (await loadData('data/art-manifest.js')).artManifest;
if (!manifest) { console.error('FAIL  data/art-manifest.js does not define window.MF.artManifest'); process.exit(1); }

const listings = new Map();
async function names(dir) {
  if (!listings.has(dir)) { try { listings.set(dir, new Set(await readdir(join(ROOT, dir)))); } catch { listings.set(dir, new Set()); } }
  return listings.get(dir);
}
for (const [k, rel] of Object.entries(manifest)) {
  let st;
  try { st = await stat(join(ROOT, rel)); } catch { fail(`art ${k}: ${rel} does not exist`); continue; }
  if (st.size === 0) { fail(`art ${k}: ${rel} is zero length`); continue; }
  if (!(await names(dirname(rel))).has(basename(rel))) fail(`art ${k}: ${rel} differs in CASE from the file on disk`);
}
const declared = new Set(Object.values(manifest));
for (const f of await names('art/cards')) if (!declared.has('art/cards/' + f)) fail(`art/cards/${f} is not in the manifest (run tools/write-manifest.mjs)`);

const wanted = await wantedKeys();
const lacking = wanted.filter((k) => !manifest[k]);
console.log(`${wanted.length - lacking.length} of ${wanted.length} illustrated`);
if (lacking.length) console.log('no art yet: ' + lacking.join(', '));
console.log(`${Object.keys(manifest).length} art entries, ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
