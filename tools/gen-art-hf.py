"""tools/gen-art-hf.py — card art from Stable Diffusion XL base 1.0 hosted through Hugging Face (PLAN D23).

The same model, prompts, seeds, size and negative prompt as tools/gen-art-sdxl.py, rendered by Hugging
Face's inference router with the fal-ai provider (`fal-ai/fast-sdxl`, the SDXL base 1.0 weights) instead
of the local GPU. Needs HF_API_KEY in the environment; the account behind it is billed per image.

  python3 tools/gen-art-hf.py [--only a,b] [--limit N] [--force KEY] [--jobs 4] [--dry-run]

Reads tools/art-prompts.json (built and linted by tools/build-art-prompts.mjs). For each key with no
art/cards/<key>.{png,jpg,webp}: the PNG master goes to art/masters/<key>.png (gitignored) and the
delivery JPEG, 560 px wide at quality 86 (as tools/shrink-art.ps1 makes it), to art/cards/<key>.jpg.
IDEMPOTENT. Then run: node tools/write-manifest.mjs

The hosted endpoint takes one prompt for both SDXL text encoders, so it gets the second encoder's
text from gen-art-sdxl.py: the short style, the subject, the setting and the full style.
"""
import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
URL = 'https://router.huggingface.co/fal-ai/fal-ai/fast-sdxl'
WIDTH, HEIGHT = 832, 1216      # as gen-art-sdxl.py
STEPS, GUIDANCE = 30, 7.5
DELIVERY_W, QUALITY = 560, 86  # as shrink-art.ps1
# The negative prompt, copied from gen-art-sdxl.py (owner, 2026-10-04: never cute).
NEGATIVE = ('text, letters, words, watermark, signature, logo, caption, frame, border, card frame, blurry, low quality, '
            'jpeg artifacts, deformed, extra limbs, extra fingers, mutated hands, bad anatomy, cropped, photorealistic, '
            'tall slender body, ornate border, panel frame, vignette frame, monochrome, black and white, uncolored line art, coloring book, sketch, washed out, '
            'cute, kawaii, adorable, smiling, happy, hugging, childish, kids illustration, plush toy, mascot')
SHORT = 'chibi super deformed character art, giant head, tiny body, cel shaded, thick outlines, '

ap = argparse.ArgumentParser()
ap.add_argument('--only', default='')
ap.add_argument('--limit', type=int, default=10 ** 9)
ap.add_argument('--force', default='')
ap.add_argument('--seed-offset', type=int, default=0)
ap.add_argument('--jobs', type=int, default=4)
ap.add_argument('--dry-run', action='store_true')
args = ap.parse_args()

plan = json.load(open(os.path.join(ROOT, 'tools', 'art-prompts.json'), encoding='utf-8'))
cards, masters, archive = (os.path.join(ROOT, 'art', d) for d in ('cards', 'masters', 'archive'))


def existing(key):
    for ext in ('.png', '.jpg', '.webp'):
        p = os.path.join(cards, key + ext)
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            return p
    return None


only = [k.strip() for k in args.only.split(',') if k.strip()]
todo = [p for p in plan if p['key'] == args.force] if args.force else [p for p in plan if (not only or p['key'] in only)]
work = [p for p in todo if args.force or not existing(p['key'])][:args.limit]
print(f'{len(plan)} keys in the plan, this run: {len(work)}; {WIDTH}x{HEIGHT}, {STEPS} steps, via {URL}', flush=True)
if args.dry_run:
    for p in work:
        print('  would generate', p['key'])
    sys.exit(0)
if not work:
    print('nothing to do.')
    sys.exit(0)
token = os.environ.get('HF_API_KEY')
if not token:
    sys.exit('HF_API_KEY is not set')

from PIL import Image  # noqa: E402

os.makedirs(cards, exist_ok=True)
os.makedirs(masters, exist_ok=True)


def call(body):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    for attempt in range(4):
        try:
            res = json.loads(urllib.request.urlopen(req, timeout=180).read())
            with urllib.request.urlopen(res['images'][0]['url'], timeout=180) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError, KeyError) as e:
            if attempt == 3:
                raise
            time.sleep(2 * 2 ** attempt)


def render(p):
    key = p['key']
    seed = (int(hashlib.sha1(p.get('card', key).encode()).hexdigest()[:8], 16) + args.seed_offset) % (2 ** 31)   # gen-art-sdxl.py's seed, kept within the endpoint's range
    short = p.get('short', SHORT)
    negative = NEGATIVE + (', ' + p['negativeExtra'] if p.get('negativeExtra') else '')
    t0 = time.time()
    png = call({'prompt': short + p['subject'] + ', ' + p['setting'] + ', ' + p['style'], 'negative_prompt': negative,
                'image_size': {'width': WIDTH, 'height': HEIGHT}, 'num_inference_steps': STEPS, 'guidance_scale': GUIDANCE,
                'seed': seed, 'num_images': 1, 'enable_safety_checker': False, 'format': 'png'})
    prior = existing(key)
    if prior:
        os.makedirs(archive, exist_ok=True)
        os.replace(prior, os.path.join(archive, f'{key}.{int(time.time())}{os.path.splitext(prior)[1]}'))
    master = os.path.join(masters, key + '.png')
    with open(master, 'wb') as f:
        f.write(png)
    img = Image.open(master).convert('RGB')
    img.resize((DELIVERY_W, round(img.height * DELIVERY_W / img.width)), Image.BICUBIC).save(os.path.join(cards, key + '.jpg'), 'JPEG', quality=QUALITY)
    return f'{key} ok {time.time() - t0:.1f}s'


def safe(p):
    try:
        return True, render(p)
    except Exception as e:   # one failed key is reported and the run goes on; a re-run picks it up (idempotent)
        return False, f'{p["key"]} FAILED: {e}'


ok, failed = 0, []
with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as ex:
    for i, (good, msg) in enumerate(ex.map(safe, work)):
        ok += good
        if not good:
            failed.append(msg)
        print(f'[{i + 1}/{len(work)}] {msg}', flush=True)
print(f'{ok} generated, {len(failed)} failed. Now: node tools/write-manifest.mjs')
sys.exit(1 if failed else 0)
