// tools/art-styles.mjs — the card-art styles (PLAN D17). Magic's art comes from many artists, so the
// cards do too: each card is painted in one of these styles, chosen by a stable hash of its art key
// (styleFor), so the mix is spread across a deck and never changes between runs.
//
// A–E are the five directions of the 2026-10-04 audition (tools/art-style-audition.mjs); F–O were
// added on 2026-10-05. Every style keeps the owner's brief (D14): compact armoured (about 2.8 head-heights)
// warriors and mages who are trying to kill or undo each other, stern and never soft; lands are landscape
// only. Each is a byte-identical constant: tools/build-art-prompts.mjs lints that a prompt carries
// its style unaltered. No style names an artist, studio, franchise or game.
export const STYLES = {
  A: { name: 'Painterly war', short: 'highly detailed painted miniature warrior, about 2.8 head-heights tall, very broad shoulders, short thick legs, heroic armoured figure, ',
       style: 'oil painting, epic fantasy trading card art, dramatic rim lighting, rich detailed brushwork, battle-worn, intense menacing expression, dark heroic mood',
       land: 'oil painting at blazing sunset, epic fantasy landscape art, rich detailed brushwork, ominous towering scale' },
  B: { name: 'Model kit', short: 'highly detailed model-kit figure, about 2.8 head-heights tall, very broad shoulders, short thick legs, highly detailed armour plating, ',
       style: 'premium scale model kit aesthetic, sharp panel lines, metallic sheen, battle damage and weathering, dynamic action pose, cinematic lighting, fierce',
       land: 'night scene, molten lava glowing against black rock, hyper detailed, cinematic lighting, dramatic scale' },
  C: { name: 'Battle anime', short: 'battle anime warrior, about 2.8 head-heights tall, very broad shoulders, short thick legs, fierce glare, ',
       style: 'intense action anime key art, bold ink outlines, hard cel shading, speed lines, impact flash, dramatic camera angle, aggressive and dangerous',
       land: 'action anime background art, bold flat shapes, hard cel shading, bright red sky, intense saturated colour' },
  D: { name: 'Grim dark', short: 'grim stocky warrior, about 2.8 head-heights tall, very broad shoulders, short thick legs, scarred and armoured, ',
       style: 'grim dark fantasy painting, muted earthy palette, gritty textures, smoke and blood-red light, brutal violent mood, chiaroscuro',
       land: 'grim dark fantasy landscape painting, ash falling, grey smoke, muted earthy palette, desolate wasteland' },
  E: { name: 'Classic fantasy', short: 'chunky fantasy soldier, about 3.5 head-heights tall, very broad shoulders, short thick legs, detailed gear, ',
       style: 'classic fantasy card illustration, luminous painterly realism, warm natural sunlight and deep shadow, storybook epic scale, serious and dangerous',
       land: 'classic fantasy landscape illustration at dawn, luminous painterly realism, golden light and deep shadow' },
  F: { name: 'Ink and watercolour', short: 'stocky fighter, about 2.8 head-heights tall, very broad shoulders, short thick legs, battle-scarred, ',
       style: 'loose ink and watercolour illustration, bleeding pigment washes, deep crimson and indigo, splattered paint, raw violent energy',
       land: 'loose ink and watercolour landscape, bleeding pigment washes, deep indigo and rust, splattered paint, brooding sky' },
  G: { name: 'Gritty comic', short: 'heavily armoured brawler, about 2.8 head-heights tall, very broad shoulders, short thick legs, snarling, ',
       style: 'gritty comic book art, heavy black inks, halftone shading, vivid flat colour, dynamic foreshortening, explosive action',
       land: 'gritty comic book landscape panel, heavy black inks, halftone shading, vivid flat colour, ominous sky' },
  H: { name: 'Gothic horror', short: 'stocky dark knight, about 2.8 head-heights tall, very broad shoulders, short thick legs, spiked plate armour, ',
       style: 'gothic horror painting, candlelit deep shadows, rich crimson and black, baroque detail, dread and menace',
       land: 'gothic horror landscape painting, moonlit ruins and dead trees, rich crimson and black, deep shadow, dread' },
  I: { name: 'Pulp barbarian', short: 'barbarian warrior, about 2.8 head-heights tall, very broad shoulders, short thick legs, muscular and scarred, ',
       style: 'retro pulp fantasy airbrush painting, saturated sunset colours, glossy highlights, savage heroic energy, mid-swing',
       land: 'retro pulp fantasy airbrush landscape, saturated sunset colours, glossy highlights, towering alien rock' },
  J: { name: 'Concept art', short: 'stocky soldier, about 2.8 head-heights tall, very broad shoulders, short thick legs, layered armour, ',
       style: 'modern digital concept art, cinematic volumetric lighting, atmospheric depth, highly detailed, teal and orange palette, tense battle moment',
       land: 'modern digital environment concept art, cinematic volumetric lighting, atmospheric haze, epic scale, teal and orange palette' },
  K: { name: 'Impasto', short: 'chunky war-scarred fighter, about 2.8 head-heights tall, very broad shoulders, short thick legs, battered armour, ',
       style: 'thick impasto oil paint, palette knife texture, bold heavy strokes, smouldering orange and black, raw brutality',
       land: 'thick impasto oil landscape, palette knife texture, bold heavy strokes, smouldering orange and black sky' },
  L: { name: 'Frost and steel', short: 'knight, about 2.8 head-heights tall, very broad shoulders, short thick legs, frost-rimed steel armour, ',
       style: 'cold moonlit fantasy painting, frost and steel, hard specular highlights, pale blue and silver palette, bleak winter war',
       land: 'cold moonlit fantasy landscape painting, frost and snow, pale blue and silver palette, bleak winter desolation' },
  M: { name: 'Gouache folk-tale', short: 'stocky hooded raider, about 2.8 head-heights tall, very broad shoulders, short thick legs, crude weapons, ',
       style: 'matte gouache painting, strong graphic silhouettes, ominous dusk palette, savage folk-tale menace',
       land: 'matte gouache landscape painting, strong graphic silhouettes, ominous dusk palette, gnarled trees' },
  N: { name: 'Hellfire', short: 'infernal warrior, about 2.8 head-heights tall, very broad shoulders, short thick legs, horned black armour, ',
       style: 'infernal fantasy painting, roaring firelight from below, black smoke and embers, demonic red and gold, terrifying scale',
       land: 'infernal fantasy landscape painting, rivers of fire, black smoke and embers, demonic red and gold sky' },
  O: { name: 'Arcane', short: 'battle mage, about 2.8 head-heights tall, very broad shoulders, short thick legs, armoured robes, ',
       style: 'arcane fantasy painting, glowing spell light, violet and cyan magic energy, crackling arcs of power, deadly sorcery duel',
       land: 'arcane fantasy landscape painting, glowing ley lines in the earth, violet and cyan sky, crackling arcs of power' },
};
export const STYLE_IDS = Object.keys(STYLES);
// A stable spread: FNV-1a of the art key, modulo the number of styles.
export function styleFor(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return STYLE_IDS[h % STYLE_IDS.length];
}
