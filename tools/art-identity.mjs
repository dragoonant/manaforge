// tools/art-identity.mjs — WHO is on each card, and WHAT is happening (PLAN D10, revised D14).
//
// Owner's brief (2026-10-04): warriors, fighters and mages trying to kill or undo each other —
// never cute. A master-grade super-deformed build for characters. Lands are pure landscape with
// no characters. Take cues from the real cards' art direction (animal-folk soldiers and mages in
// practical medieval kit, oversized flora for scale) without copying any illustration.
// Chosen direction: D, Grim Dark (scratch/audition-sheet.jpg).
//
//   WHO    one visual clause per named character, written once.
//   CARDS  one entry per art key: { who?, subject, setting, land? }. A land entry gets the land
//          style and every living thing in the negative prompt.
//
// THREE CONSTANTS that never move:
//   1. no text is ever rendered in an image
//   2. no official illustration is reproduced, traced or used as an input
//   3. no real artist, studio, franchise, set or game is named in a prompt (the lint enforces it)
// A wanted key with no entry here FAILS the build. There is no generic fallback.

export const WHO = {
  byrke:
    'a grim veteran rabbit knight-commander with long battle-torn ears and a scarred muzzle, dented steel plate armour, round iron shield and a long spear',
  finneas:
    'a hard-eyed rabbit ranger with notched ears, a hooded leaf-green cloak over scale mail, a war bow of black yew',
  bria:
    'a vicious otter cutthroat with a scarred snout, a sea-soaked leather coat and a curved dagger in each paw',
  alania:
    'a fearsome otter storm-sorceress in torn crimson-and-blue robes, eyes blazing white, lightning crawling up her arms',
};

export const CARDS = {
  // ---- Hare Raising (green-white rabbits) ----
  'byrke-long-ear-of-the-law': { who: 'byrke', subject: 'roaring an order with the spear levelled at the enemy', setting: 'on a battlefield beneath giant oak roots, arrows and embers in the air, smoke behind' },
  'serra-redeemer': { subject: 'a stern armoured war-angel with battle-scarred white wings and a burning sword, descending to shield a wounded rabbit soldier', setting: 'through smoke and ash over a ruined battlefield, harsh light breaking through clouds' },
  'colossification': { subject: 'an armoured badger warrior swelling into a towering giant, armour plates splitting, veins of green power erupting across its body, roaring', setting: 'trees snapping around it in a dark storm-lashed forest' },
  'fecund-greenshell': { subject: 'a massive ancient war-turtle with a mossy spiked shell like a fortress, scarred beak, standing its ground', setting: 'in a churned muddy river ford under a grey sky' },
  'finneas-ace-archer': { who: 'finneas', subject: 'drawing the bow at full stretch, an arrow aimed straight at the viewer', setting: 'crouched on a high gnarled branch above a burning forest, smoke rising' },
  'pileated-provisioner': { subject: 'a woodpecker bird soldier with a long sharp beak, red crest and black-and-white feathers, a dented iron cap and a supply harness, wings spread in a dive', setting: 'over a war camp among giant pine trunks, ash in the air' },
  'warren-elder': { subject: 'a grizzled old rabbit war-priest in a chain hood raising a gnarled staff, a fierce blessing of pale light flaring over battered soldiers', setting: 'at the barricaded mouth of a burrow fortress, torches and smoke' },
  'rabbit-response': { subject: 'an armoured rabbit militia captain bursting out of a burrow gate with a spear and shield, rallying with a war cry', setting: 'flaming arrows streaking overhead, mud and smoke at a fortified hillside' },
  'carrot-cake': { subject: 'a battered soldier’s ration crate split open on a war-camp table, a hunk of carrot cake beside a dented helmet and a bloodied dagger', setting: 'inside a dim canvas field tent lit by a single lantern' },
  'repel-calamity': { subject: 'a rabbit knight in heavy plate bracing a glowing tower shield as a monstrous horned beast smashes into it, sparks exploding', setting: 'on a rocky mountain pass in a storm' },
  'hop-to-it': { subject: 'a pair of young rabbit recruits in mismatched armour charging out of a burrow with spears, grim faces', setting: 'into a smoky battlefield at dusk, drifting smoke behind' },
  'druid-of-the-spade': { subject: 'a hulking rabbit druid-warrior swinging a heavy iron spade like a war axe, roots and thorns erupting from the earth where it strikes', setting: 'in a churned battlefield garden at night' },
  'treeguard-duo': { subject: 'a scarred frog warrior and an armoured rabbit warrior back to back with shields locked, weapons raised against unseen attackers', setting: 'beneath an enormous ancient tree, falling leaves and drifting smoke' },
  'rabid-bite': { subject: 'a ferocious rabbit berserker in scarred leather armour leaping straight at the viewer mid-attack, jaws wide with bared fangs, claws out, an enemy sword spinning away', setting: 'violent ambush bursting out of towering grass, dust and torn leaves flying, motion blur' },
  'giant-growth': { subject: 'a squirrel soldier suddenly surging to enormous size mid-battle, armour straps bursting, green power blazing in its eyes, roaring', setting: 'towering over a smoky skirmish in a dark forest' },
  'clifftop-lookout': { subject: 'a grim frog sentry in a weathered cloak holding a brass spyglass and a spear, watching for enemies', setting: 'on a wind-lashed cliff edge above a dark valley at dusk' },
  'burrowguard-mentor': { subject: 'a broad scarred rabbit sergeant in heavy armour bellowing at recruits, a notched sword pointed forward', setting: 'in a muddy training yard outside a burrow fortress, rain falling' },
  'token-rabbit-1-1-w': { subject: 'a lone grim rabbit militia soldier in a battered helmet gripping a short spear', setting: 'standing in trampled grass with smoke behind' },
  'blossoming-sands': { land: true, subject: 'a desolate sandy riverbank with pale wildflowers pushing through scorched dunes, broken stones half buried', setting: 'under a hazy ash-grey sky, harsh light' },
  'plains': { land: true, subject: 'wide windswept grasslands under a vast stormy sky, a lone dead tree on a low hill', setting: 'grey light breaking through heavy clouds' },
  'forest': { land: true, subject: 'a dark primeval forest of colossal moss-covered trees and twisted roots', setting: 'thin shafts of grey light through mist' },
  // ---- Otter Limits (blue-red otters) ----
  'bria-riptide-rogue': { who: 'bria', subject: 'riding the crest of a crashing wave, daggers raised to strike', setting: 'over a black storm-tossed river, spray and lightning' },
  'mockingbird': { subject: 'a sinister grey mockingbird spy in a ragged cloak, its silhouette warping into the shape of a larger predator', setting: 'perched on a broken fence post in fog at night' },
  'mind-spring': { subject: 'an otter sorcerer half submerged in a glowing pool, eyes burning blue as torrents of arcane knowledge pour into its skull', setting: 'in a dark flooded cavern' },
  'alania-divergent-storm': { who: 'alania', subject: 'splitting a lightning bolt in two and hurling both at the enemy', setting: 'on a rocky island amid a raging storm lake' },
  'sword-of-vengeance': { subject: 'a cruel silver longsword with a blood-red gem in the hilt, driven point-first into a scorched stump, flames licking along its edge', setting: 'on a burned battlefield at night, embers rising' },
  'thieving-otter': { subject: 'a ruthless otter thief in a dark hood slipping away with a stolen jewelled dagger, a knife held back in warning', setting: 'along a moonlit riverbank market, lanterns and shadows' },
  'bellowing-crier': { subject: 'a bloated frog herald in battered armour bellowing a war call through a dented horn', setting: 'atop a palisade wall at dawn, smoke rising behind' },
  'waterspout-warden': { subject: 'an armoured frog soldier with a spear erupting out of a lake on a roaring column of water, ready to strike', setting: 'above a dark lake under storm clouds' },
  'pearl-of-wisdom': { subject: 'a scarred otter scholar-mage clutching a glowing pearl, cold blue light carving its grim face out of the dark', setting: 'deep underwater among black kelp and drifting bones' },
  'charmed-sleep': { subject: 'a weasel warrior lying slumped on the ground in an enchanted sleep, eyes shut, sword fallen beside it, ghostly blue chains binding its body', setting: 'on a misty battlefield at night' },
  'alanias-pathmaker': { subject: 'a battle-worn otter wizard tearing open a crackling portal of red and blue fire with a staff', setting: 'at a fork in a dark forest trail, sparks and smoke' },
  'flame-lash': { subject: 'an otter battle-mage cracking a whip of roaring fire through the air, the lash streaking toward the viewer', setting: 'on a dark stormy riverbank, embers swirling' },
  'coruscation-mage': { subject: 'a wild-eyed otter mage hurling crackling sparks of red and blue lightning from both paws, a smaller copy of itself mirroring the attack', setting: 'on a rotting river dock at night' },
  'quaketusk-boar': { subject: 'a massive furious war boar with huge stone tusks and plated armour charging forward, the ground cracking under its hooves', setting: 'on a rocky hillside trail, dust and debris flying' },
  'rabid-gnaw': { subject: 'a feral otter warrior lunging with bared teeth and a jagged knife at a startled lizard soldier', setting: 'in reeds at the water’s edge, spray and mud flying' },
  'stormcatch-mentor': { subject: 'a stern otter battle-mage catching a bolt of lightning in an iron gauntlet, sparks scorching its armour', setting: 'on a windswept hilltop at dusk, storm overhead' },
  'swiftwater-cliffs': { land: true, subject: 'towering red cliffs with a thundering blue waterfall plunging into a foaming river gorge', setting: 'at a dark stormy dusk, mist rising' },
  'island': { land: true, subject: 'a cold grey lake with a lone wooded island of jagged rocks and dead trees', setting: 'under a low overcast sky, fog on the water' },
  'mountain': { land: true, subject: 'a towering range of jagged red-rock mountains with a smouldering volcanic peak, glowing lava seams down the cliffs', setting: 'vast epic landscape under a burning storm sky, deep valley in shadow' },
};
