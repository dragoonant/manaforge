// tools/art-style-audition.mjs — an art-direction audition: the same cards in several candidate
// styles, for the owner to choose from (PLAN D10, revised 2026-10-04). Writes
// scratch/audition/prompts.json for tools/gen-art-sdxl.py --prompts ... --out scratch/audition.
//
// Owner's brief, 2026-10-04: warriors, fighters and mages trying to kill or undo each other —
// never cute; a "master grade" super-deformed build for characters; lands are pure landscape with
// no characters; take cues from the real cards' art direction without copying any illustration.
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './load.mjs';

// Cues from the setting's art direction, in our own words: painterly fantasy realism, animal-folk
// soldiers and mages in practical medieval kit, oversized flora for scale, dramatic natural light.
const CARDS = {
  'rabid-bite': {
    kind: 'sorcery',
    subject: 'a ferocious rabbit berserker in scarred leather armour leaping straight at the viewer mid-attack, jaws wide with bared fangs, claws out, an enemy sword spinning away',
    setting: 'violent ambush bursting out of towering grass, dust and torn leaves flying, motion blur',
  },
  'byrke-long-ear-of-the-law': {
    kind: 'creature',
    subject: 'a grim veteran rabbit knight-commander with long battle-torn ears and a scarred muzzle, dented steel plate armour, round shield raised, spear levelled at the enemy, roaring an order',
    setting: 'on a battlefield beneath giant oak roots, arrows and embers in the air, smoke behind',
  },
  'mountain': {
    kind: 'land',
    subject: 'a towering range of jagged red-rock mountains with a smouldering volcanic peak, glowing lava seams down the cliffs',
    setting: 'vast epic landscape under a burning storm sky, deep valley in shadow',
  },
};

// Five candidate directions. SD = super-deformed; each is a different reading of "master grade".
export const STYLES = {
  A: { name: 'Painterly war SD', short: 'master grade super deformed warrior, three heads tall, heroic armoured figure, ',
       style: 'oil painting, epic fantasy trading card art, dramatic rim lighting, rich detailed brushwork, battle-worn, intense menacing expression, dark heroic mood' },
  B: { name: 'Model-kit SD', short: 'master grade SD figure, compact heroic proportions, highly detailed armour plating, ',
       style: 'premium scale model kit aesthetic, sharp panel lines, metallic sheen, battle damage and weathering, dynamic action pose, cinematic lighting, fierce' },
  C: { name: 'Battle anime SD', short: 'super deformed battle anime warrior, three heads tall, fierce glare, ',
       style: 'intense action anime key art, bold ink outlines, hard cel shading, speed lines, impact flash, dramatic camera angle, aggressive and dangerous' },
  D: { name: 'Grim dark SD', short: 'super deformed grim warrior, stocky three heads tall, scarred and armoured, ',
       style: 'grim dark fantasy painting, muted earthy palette, gritty textures, smoke and blood-red light, brutal violent mood, chiaroscuro' },
  E: { name: 'Classic fantasy SD', short: 'chunky super deformed fantasy soldier, four heads tall, detailed gear, ',
       style: 'classic fantasy card illustration, luminous painterly realism, warm natural sunlight and deep shadow, storybook epic scale, serious and dangerous' },
};
// Lands take the style's look but never a figure.
const LAND_STYLE = {
  A: 'oil painting at blazing sunset, epic fantasy landscape art, rich detailed brushwork, ominous towering scale',
  B: 'night scene, molten lava glowing against black rock, hyper detailed, cinematic lighting, dramatic scale',
  C: 'action anime background art, bold flat shapes, hard cel shading, bright red sky, intense saturated colour',
  D: 'grim dark fantasy landscape painting, ash falling, grey smoke, muted earthy palette, desolate wasteland',
  E: 'classic fantasy landscape illustration at dawn, luminous painterly realism, golden light and deep shadow',
};

const out = [];
for (const [v, st] of Object.entries(STYLES)) for (const [key, c] of Object.entries(CARDS)) {
  const land = c.kind === 'land';
  out.push({
    key: `${v}-${key}`, card: `${v}-${key}`,   // a seed per variant: the same seed made the five columns near-identical (2026-10-04)
    cardId: key, variant: v, variantName: st.name,
    short: land ? 'landscape painting, scenery, ' : st.short,
    subject: c.subject, setting: c.setting, style: land ? LAND_STYLE[v] : st.style,
    negativeExtra: land ? 'person, people, character, creature, animal, figure, rider, warrior, face, house, cottage, building, village' : '',
  });
}
await mkdir(join(ROOT, 'scratch', 'audition'), { recursive: true });
await writeFile(join(ROOT, 'scratch', 'audition', 'prompts.json'), JSON.stringify(out, null, 2));
console.log(`${out.length} audition prompts written to scratch/audition/prompts.json`);
