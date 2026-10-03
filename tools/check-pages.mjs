// The page gate. Refuses: a script the page names that is not on disk, or one on disk the page
// does not name; either silent-fallback form; an engine log type with no player-facing line; a
// question kind with no prompt; a CR citation not in the rules text. Each check is here because
// the bypass has happened in an earlier project.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, scriptList } from './load.mjs';
const bad = [];
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const list = scriptList().filter(f => f !== '<!-- ui -->');
for (const f of list) if (!fs.existsSync(path.join(ROOT, f))) bad.push('index.html names a missing script: ' + f);
if (!scriptList().includes('<!-- ui -->')) bad.push('index.html lost its <!-- ui --> marker (tools/load.mjs needs it)');

const js = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'));
for (const f of js) {
  if (!list.includes('js/' + f)) bad.push('js/' + f + ' is not in index.html');
  read('js/' + f).split('\n').forEach((l, i) => {
    if (/MF\.[A-Za-z.]+\s*\|\|\s*(\{\}|\[\])/.test(l)) bad.push(`js/${f}:${i + 1} silent fallback (|| {}): ${l.trim()}`);
    if (/if\s*\(\s*!\s*(window\.)?MF\.[A-Za-z]+\s*\)/.test(l)) bad.push(`js/${f}:${i + 1} silent fallback (if (!MF.x)): ${l.trim()}`);
  });
}

const engine = ['js/engine.js', 'js/ops.js'].map(read).join('\n');
const text = read('js/text.js');
const hasKey = k => new RegExp('\\n\\s+' + k + ':').test(text);
const logTypes = new Set([...engine.matchAll(/\b(?:MF\.)?log\(\s*(?:x\.)?s,\s*'([A-Za-z0-9_]+)'/g)].map(m => m[1]));
for (const t of logTypes) if (!hasKey(t)) bad.push('engine log type with no line in js/text.js: ' + t);
const kinds = new Set([...engine.matchAll(/ask\([^,]+,\s*\{\s*who:[^}]*?kind:\s*'([A-Za-z0-9_]+)'/g)].map(m => m[1]));   // questions asked (a stack object's kind is not one)
if (kinds.size < 10) bad.push('found only ' + kinds.size + ' question kinds: the scan is broken');
for (const k of kinds) if (!hasKey(k)) bad.push('question kind with no prompt in js/text.js: ' + k);

try { execFileSync(process.execPath, [path.join(ROOT, 'tools/rules-index.mjs'), '--check'], { stdio: 'pipe' }); }
catch (e) { bad.push('rules-index: ' + String(e.stdout || e.message).trim()); }

if (bad.length) { console.log('check-pages: ' + bad.length + ' problem(s)\n  ' + bad.join('\n  ')); process.exit(1); }
console.log(`check-pages: clean (${list.length} scripts, ${logTypes.size} log types, ${kinds.size} question kinds)`);
