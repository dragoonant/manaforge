// node tools/test.mjs [filter]   Each test is named for the card or the rule it checks.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './load.mjs';
const dir = path.join(ROOT, 'tests');
for (const f of fs.readdirSync(dir).filter(f => /^\d\d-.*\.mjs$/.test(f)).sort()) await import(pathToFileURL(path.join(dir, f)).href);
const h = await import(pathToFileURL(path.join(dir, 'harness.mjs')).href);
process.exit(h.runAll(process.argv[2]) ? 1 : 0);
