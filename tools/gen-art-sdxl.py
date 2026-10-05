"""tools/gen-art-sdxl.py — card art on the local GPU with Stable Diffusion XL base 1.0 (PLAN D13).

Runs with the Python environment of the owner's Hunyuan3D-2 install (torch + diffusers), against
the SDXL weights fetched there by fetch_sdxl.py (~/.cache/hy3dgen/sdxl):

  C:/Users/antho/Hunyuan3D-2/.venv/Scripts/python.exe tools/gen-art-sdxl.py [--only a,b] [--limit N] [--force KEY] [--dry-run]

Reads tools/art-prompts.json (built and linted by tools/build-art-prompts.mjs). Writes
art/cards/<key>.png and a copy to art/masters/ (gitignored); then run tools/shrink-art.ps1 and
tools/write-manifest.mjs. IDEMPOTENT: a key that already has art/cards/<key>.{png,jpg,webp} is
skipped. No network calls.

SDXL has two text encoders and each reads only 77 tokens. The card's subject goes to the first
(`prompt`); the style and the setting go to the second (`prompt_2`), so neither is cut off.
"""
import argparse
import hashlib
import json
import os
import shutil
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SDXL = os.path.expanduser('~/.cache/hy3dgen/sdxl')
WIDTH, HEIGHT = 832, 1216      # an SDXL training bucket close to the card's 5:7
STEPS, GUIDANCE = 30, 7.5
SHORT = 'chibi super deformed character art, giant head, tiny body, cel shaded, thick outlines, '   # a prompt may carry its own `short`
# The negative prompt is where "no text" belongs: in the positive prompt a negation summons what it negates.
NEGATIVE = ('text, letters, words, watermark, signature, logo, caption, frame, border, card frame, blurry, low quality, '
            'jpeg artifacts, deformed, extra limbs, extra fingers, mutated hands, bad anatomy, cropped, photorealistic, '
            'tall slender body, ornate border, panel frame, vignette frame, monochrome, black and white, uncolored line art, coloring book, sketch, washed out, '
            'cute, kawaii, adorable, smiling, happy, hugging, childish, kids illustration, plush toy, mascot')   # owner, 2026-10-04: never cute

ap = argparse.ArgumentParser()
ap.add_argument('--only', default='')
ap.add_argument('--limit', type=int, default=10 ** 9)
ap.add_argument('--force', default='')
ap.add_argument('--seed-offset', type=int, default=0)
ap.add_argument('--dry-run', action='store_true')
ap.add_argument('--prompts', default=os.path.join('tools', 'art-prompts.json'))
ap.add_argument('--out', default=os.path.join('art', 'cards'))
args = ap.parse_args()

plan = json.load(open(os.path.join(ROOT, args.prompts), encoding='utf-8'))
only = [k.strip() for k in args.only.split(',') if k.strip()]
out_dir = os.path.join(ROOT, args.out)
masters = os.path.join(ROOT, 'art', 'masters')
archive = os.path.join(ROOT, 'art', 'archive')


def existing(key):
    for ext in ('.png', '.jpg', '.webp'):
        p = os.path.join(out_dir, key + ext)
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            return p
    return None


todo = [p for p in plan if (not only or p['key'] in only)]
if args.force:
    todo = [p for p in plan if p['key'] == args.force]
work = [p for p in todo if args.force or not existing(p['key'])][:args.limit]
print(f'{len(plan)} keys in the plan, {len(todo)} selected, this run: {len(work)}; {WIDTH}x{HEIGHT}, {STEPS} steps', flush=True)
if args.dry_run:
    for p in work:
        print('  would generate', p['key'], '\n     prompt  :', p['subject'][:110], '\n     prompt_2:', (p['style'] + ', ' + p['setting'])[:110])
    print('--dry-run: nothing was generated.')
    sys.exit(0)
if not work:
    print('nothing to do.')
    sys.exit(0)
for sub in ('base', 'vae-fp16-fix'):
    if not os.path.isdir(os.path.join(SDXL, sub)):
        sys.exit('SDXL weights not found at ' + os.path.join(SDXL, sub) + ' (run fetch_sdxl.py in Hunyuan3D-2)')

import torch  # noqa: E402  (imported late so --dry-run needs no GPU stack)
from diffusers import AutoencoderKL, StableDiffusionXLPipeline  # noqa: E402

vae = AutoencoderKL.from_pretrained(os.path.join(SDXL, 'vae-fp16-fix'), torch_dtype=torch.float16)
pipe = StableDiffusionXLPipeline.from_pretrained(os.path.join(SDXL, 'base'), vae=vae, torch_dtype=torch.float16, variant='fp16').to('cuda')
pipe.set_progress_bar_config(disable=True)
os.makedirs(out_dir, exist_ok=True)
os.makedirs(masters, exist_ok=True)
ok = 0
for i, p in enumerate(work):
    key = p['key']
    seed = int(hashlib.sha1(p.get('card', key).encode()).hexdigest()[:8], 16) + args.seed_offset   # a card always renders from the same seed, so audition variants differ only in style
    short = p.get('short', SHORT)
    negative = NEGATIVE + (', ' + p['negativeExtra'] if p.get('negativeExtra') else '')
    t0 = time.time()
    # Both encoders lead with a short form of the style and carry the subject; the second also
    # carries the full style and the setting. (Sending the subject to one encoder and the style to
    # the other lost both: sample round one, 2026-10-03.)
    img = pipe(prompt=short + p['subject'], prompt_2=short + p['subject'] + ', ' + p['setting'] + ', ' + p['style'], negative_prompt=negative,
               num_inference_steps=STEPS, guidance_scale=GUIDANCE, width=WIDTH, height=HEIGHT,
               generator=torch.Generator('cuda').manual_seed(seed)).images[0]
    prior = existing(key)
    if prior:
        os.makedirs(archive, exist_ok=True)
        shutil.move(prior, os.path.join(archive, f'{key}.{int(time.time())}{os.path.splitext(prior)[1]}'))
    dst = os.path.join(out_dir, key + '.png')
    img.save(dst)
    shutil.copyfile(dst, os.path.join(masters, key + '.png'))
    ok += 1
    print(f'[{i + 1}/{len(work)}] {key} ok {time.time() - t0:.1f}s', flush=True)
print(f'{ok} generated. Now: powershell -File tools/shrink-art.ps1; node tools/write-manifest.mjs')
