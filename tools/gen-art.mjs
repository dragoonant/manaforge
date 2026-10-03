#!/usr/bin/env node
// tools/gen-art.mjs — the paid run (FLUX.1-schnell through Hugging Face, provider nscale).
//
//   --dry-run        ZERO network calls; prints the plan
//   --limit N        cap a paid run at N renders
//   --only a,b,c     only these art keys
//   --force <key>    regenerate that one key (archives the old file first)
//   default          IDEMPOTENT: a key that already has art/cards/<key>.{webp,png,jpg} is skipped
//
// SAMPLE THREE, LOOK AT THEM, THEN RUN THE BATCH.
// Delivery format: if cwebp is on PATH the PNG is encoded to .webp; with no encoder (no npm
// dependencies are allowed) the API's bytes are saved with their TRUE extension. Masters go to
// art/masters/ (gitignored). Tokens are never printed or written anywhere.
import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from './load.mjs';

const run = promisify(execFile);
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes('--dry-run');
const FORCE_KEY = opt('--force');
const LIMIT = Number(opt('--limit')) || Infinity;
const ONLY = (opt('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);

const PROVIDER = 'nscale';
const ENDPOINT = `https://router.huggingface.co/${PROVIDER}/v1/images/generations`;
const MODEL = 'black-forest-labs/FLUX.1-schnell';
const SIZE = '768x1088';
const OUT = join(ROOT, 'art', 'cards'), MASTERS = join(ROOT, 'art', 'masters'), ARCHIVE = join(ROOT, 'art', 'archive');
const EXTS = ['.webp', '.png', '.jpg'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function existing(key) {
  for (const e of EXTS) { try { if ((await stat(join(OUT, key + e))).size > 1000) return key + e; } catch {} }
  return null;
}

const plan = JSON.parse(await readFile(args.includes('--prompts') ? args[args.indexOf('--prompts') + 1] : join(ROOT, 'tools', 'art-prompts.json'), 'utf8'));
let todo = plan;
if (ONLY.length) todo = todo.filter((p) => ONLY.includes(p.key));
if (FORCE_KEY) todo = plan.filter((p) => p.key === FORCE_KEY);
const work = [];
for (const p of todo) if (FORCE_KEY || !(await existing(p.key))) work.push(p);
const capped = work.slice(0, LIMIT);

console.log(`${plan.length} keys in the plan, ${todo.length} selected, ${work.length} outstanding, this run: ${capped.length}`);
console.log(`model ${MODEL}, size ${SIZE}, provider ${PROVIDER}`);

if (DRY) {
  for (const p of capped) console.log(`  would generate ${p.key}\n      ${p.prompt.slice(0, 140)}...`);
  console.log('\n--dry-run: no network calls were made, nothing was spent.');
  process.exit(0);
}
if (!capped.length) { console.log('nothing to do.'); process.exit(0); }

// ---- token discovery: env, tokens.txt / tokens.txt.txt, only ----
async function findToken() {
  if (process.env.HF_TOKEN && process.env.HF_TOKEN.trim()) return process.env.HF_TOKEN.trim();
  // The tokens file lives in the project folder (handoff 8.19). A git worktree sits inside it at
  // .claude/worktrees/<name>; its project folder is the part of the path before that.
  const project = ROOT.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0];
  const files = [join(project, 'tokens.txt.txt'), join(project, 'tokens.txt')];
  for (const f of files) {
    let txt; try { txt = await readFile(f, 'utf8'); } catch { continue; }
    const m = txt.match(/hf_[A-Za-z0-9]{10,}/);
    if (m) return m[0];
    const kv = txt.match(/^\s*(?:HF_TOKEN|hugging\s*face|hf)\s*[:=]\s*(\S+)\s*$/im);
    if (kv) return kv[1].replace(/^["']|["']$/g, '');
  }
  return null;
}
const TOKEN = await findToken();
if (!TOKEN) {
  console.error('No Hugging Face token found. Looked in: (1) the HF_TOKEN environment variable, ' +
    '(2) tokens.txt / tokens.txt.txt in the project root (lines like HF=hf_... and EL=sk_...)');
  process.exit(2);
}

function sniff(buf) {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return '.png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  return null;
}

async function generate(prompt) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, prompt, size: SIZE, response_format: 'b64_json' })
      });
      if (res.status === 429 || res.status >= 500) { lastErr = new Error('HTTP ' + res.status); await sleep(2000 * 2 ** attempt); continue; }
      if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160).replaceAll(TOKEN, '***')), { fatal: true });
      const j = await res.json();
      const d = j.data && j.data[0];
      if (d && d.b64_json) return Buffer.from(d.b64_json, 'base64');
      if (d && d.url) return Buffer.from(await (await fetch(d.url)).arrayBuffer());
      throw Object.assign(new Error('no image in the response'), { fatal: true });
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e; await sleep(2000 * 2 ** attempt);
    }
  }
  throw lastErr || new Error('failed after retries');
}

async function tryCwebp(src, dst) {
  try { await run('cwebp', ['-q', '82', '-quiet', src, '-o', dst]); return true; } catch { return false; }
}

await mkdir(OUT, { recursive: true }); await mkdir(MASTERS, { recursive: true });
let ok = 0, failed = 0, bytes = 0;
for (let i = 0; i < capped.length; i++) {
  const p = capped[i];
  process.stdout.write(`[${i + 1}/${capped.length}] ${p.key} ... `);
  try {
    const buf = await generate(p.prompt);
    const ext = sniff(buf);
    if (!ext) throw new Error('response bytes are not WebP, PNG or JPEG');
    await writeFile(join(MASTERS, p.key + ext), buf);
    const prior = await existing(p.key);
    if (prior) { await mkdir(ARCHIVE, { recursive: true }); await rename(join(OUT, prior), join(ARCHIVE, `${p.key}.${Date.now()}${prior.slice(p.key.length)}`)); }
    let final = join(OUT, p.key + ext);
    if (ext !== '.webp' && await tryCwebp(join(MASTERS, p.key + ext), join(OUT, p.key + '.webp'))) final = join(OUT, p.key + '.webp');
    else await writeFile(final, buf);
    const s = await stat(final); bytes += s.size; ok++;
    console.log(`ok ${(s.size / 1024).toFixed(0)}kb ${final.slice(final.lastIndexOf('.'))}`);
  } catch (e) { failed++; console.log('FAIL ' + e.message); }
  if (i < capped.length - 1) await sleep(1500);
}
console.log(`\n${ok} generated, ${failed} failed, ${(bytes / 1048576).toFixed(1)} MB`);
if (ok) console.log('now run: node tools/write-manifest.mjs');
process.exit(failed ? 1 : 0);
