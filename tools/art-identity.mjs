// tools/art-identity.mjs — WHO is on each card, and WHERE (PLAN D10: super-deformed versions of
// what each card shows, described in this project's own words).
//
//   WHO    one visual clause per named character, written once, so a character looks the same on
//          every card they appear on.
//   CARDS  one entry per art key (the card id): { who?, subject, setting }.
//
// THREE CONSTANTS that never move:
//   1. no text is ever rendered in an image
//   2. no official illustration is reproduced, traced or used as an input: a prompt describes the
//      card's subject in original prose
//   3. no real artist, studio, franchise, set or game is named in a prompt (the lint enforces it)
// A wanted key with no entry here FAILS the build. There is no generic fallback.

export const WHO = {
  byrke:
    'an elderly stern rabbit lawkeeper with extremely long upright ears and a white muzzle, ' +
    'in polished green-and-silver plate armour with a round wooden shield and a short spear',
  finneas:
    'a young cheerful rabbit archer with long tan ears and a leaf-green hooded cloak, drawing a carved wooden longbow',
  bria:
    'a sly sleek otter rogue with glossy brown fur, a sea-blue bandana and a curved dagger in each paw, grinning',
  alania:
    'a graceful otter storm-wizard with silver-tipped fur and flowing blue-and-crimson robes, crackling lightning swirling around her paws',
};

const V = 'in a lush storybook woodland valley of animal folk';

export const CARDS = {
  // ---- Hare Raising (green-white rabbits) ----
  'byrke-long-ear-of-the-law': { who: 'byrke', subject: 'raising the spear in a solemn salute as golden light falls on a pair of rabbit soldiers beside him', setting: 'before a great hollow-oak courthouse ' + V },
  'serra-redeemer': { subject: 'a kind angel with white feathered wings and a halo of soft light, cradling a small glowing rabbit soldier', setting: 'descending through sunbeams over meadow hills ' + V },
  'colossification': { subject: 'an ordinary small badger growing to colossal size, glowing green vines and golden light spiralling up its body', setting: 'towering above treetops ' + V },
  'fecund-greenshell': { subject: 'a gentle giant turtle whose mossy shell is a whole garden of ferns, flowers and saplings', setting: 'wading through a shallow green river ' + V },
  'finneas-ace-archer': { who: 'finneas', subject: 'loosing an arrow trailing a ribbon of green light', setting: 'perched on a high tree branch at golden hour ' + V },
  'pileated-provisioner': { subject: 'a red-crested woodpecker bird courier with black-and-white feathers and a long beak, a little leather satchel of acorns on its back, wings spread in flight', setting: 'flying between tall pine trunks ' + V },
  'warren-elder': { subject: 'an old rabbit cleric with a gnarled staff, raising a paw as warm light washes over a pair of younger rabbits', setting: 'at the round door of a cosy burrow ' + V },
  'rabbit-response': { subject: 'a pair of rabbit militia leaping into action with spears and pots for helmets, glowing with sudden courage', setting: 'bursting out of their burrow entrance ' + V },
  'carrot-cake': { subject: 'a tall frosted carrot cake on a wooden stand, a tiny rabbit peeking out from behind it licking frosting from a paw', setting: 'on a picnic blanket in a sunny glade ' + V },
  'repel-calamity': { subject: 'a small rabbit knight bracing a shining shield as a huge shadowy beast recoils from a flash of white light', setting: 'on a rocky hillside path ' + V },
  'hop-to-it': { subject: 'a pair of excited baby rabbits tumbling out of a burrow mid-hop, a third pair of ears poking up behind them', setting: 'in a flowery spring meadow ' + V },
  'druid-of-the-spade': { subject: 'a sturdy rabbit druid gardener holding a big iron spade, sprouts and roots curling up around the blade', setting: 'in a tilled vegetable patch ' + V },
  'treeguard-duo': { subject: 'a stout frog warrior and a rabbit warrior standing back to back with wooden shields, leaves swirling around them', setting: 'beneath an enormous guardian tree ' + V },
  'rabid-bite': { subject: 'a fierce rabbit lunging forward with bared teeth at a startled weasel, motion lines streaking behind it', setting: 'in tall grass ' + V },
  'giant-growth': { subject: 'a tiny squirrel suddenly swelling to huge size, bursting with green glowing energy, surprised expression', setting: 'among mushrooms and ferns ' + V },
  'clifftop-lookout': { subject: 'a little frog scout with a brass spyglass standing on a ledge, pointing excitedly at distant land', setting: 'atop a mossy cliff overlooking rolling valleys ' + V },
  'burrowguard-mentor': { subject: 'a broad-shouldered rabbit soldier sergeant drilling a pair of young recruits with wooden practice swords', setting: 'in a training yard outside a burrow fort ' + V },
  'blossoming-sands': { subject: 'a sunny sandy riverbank where wildflowers bloom across the dunes, a rabbit family resting in the shade', setting: 'under a warm afternoon sky ' + V },
  'plains': { subject: 'wide golden meadows of tall grass and wildflowers with a single round burrow door in a hillside', setting: 'under a bright blue sky with puffy clouds ' + V },
  'forest': { subject: 'a deep green forest of giant mossy trees with little lantern-lit homes built into the roots', setting: 'in soft dappled morning light ' + V },
  'token-rabbit-1-1-w': { subject: 'a single small brave white rabbit in a tiny helmet holding a twig spear', setting: 'standing on a mossy stone ' + V },
  // ---- Otter Limits (blue-red otters) ----
  'bria-riptide-rogue': { who: 'bria', subject: 'surfing the crest of a curling wave', setting: 'on a sparkling river rapid ' + V },
  'mockingbird': { subject: 'a cheeky little grey mockingbird bard in a feathered cap, shimmering as it mimics the shape of a bigger animal', setting: 'perched on a fence post ' + V },
  'mind-spring': { subject: 'a young otter scholar floating in a glowing blue spring as swirling ideas of light pour into its head', setting: 'in a misty forest grotto ' + V },
  'alania-divergent-storm': { who: 'alania', subject: 'splitting a bolt of lightning into a pair of mirrored bolts', setting: 'on a rocky island amid a stormy lake ' + V },
  'sword-of-vengeance': { subject: 'an ornate silver sword with a glowing red gem in the hilt, standing upright in a mossy stump, fiery light around its edge', setting: 'in a quiet woodland shrine ' + V },
  'thieving-otter': { subject: 'a mischievous otter tiptoeing away with an armful of stolen shiny trinkets', setting: 'along a moonlit riverbank market ' + V },
  'bellowing-crier': { subject: 'a plump frog town crier puffing out a huge throat sac, bellowing news with a brass handbell', setting: 'on a lily-pad town square ' + V },
  'waterspout-warden': { subject: 'a frog soldier with a spear riding a spinning column of water up into the air', setting: 'above a wide blue lake ' + V },
  'pearl-of-wisdom': { subject: 'a young otter holding up a glowing pearl, its soft light reflected in her wide amazed eyes', setting: 'underwater among kelp and bubbles ' + V },
  'charmed-sleep': { subject: 'a fierce weasel warrior curled up fast asleep, drifting blue sparkles and dreamy bubbles around it', setting: 'in a hollow log ' + V },
  'alanias-pathmaker': { subject: 'an adventurous otter wizard with a lantern staff opening a shimmering portal of red and blue light', setting: 'at a fork in a forest trail ' + V },
  'flame-lash': { subject: 'an otter sorcerer cracking a whip of roaring fire through the air', setting: 'on a dark stormy riverbank ' + V },
  'coruscation-mage': { subject: 'a small otter mage juggling crackling sparks of red and blue lightning, a tiny copy of itself copying its pose', setting: 'on a wooden river dock ' + V },
  'quaketusk-boar': { subject: 'a massive furious boar with huge stone tusks charging forward, the ground cracking under its hooves', setting: 'on a rocky hillside trail ' + V },
  'rabid-gnaw': { subject: 'a feral otter biting into the tail of a startled lizard, teeth flashing', setting: 'in reeds at the water’s edge ' + V },
  'stormcatch-mentor': { subject: 'a wise otter teacher catching a bolt of lightning in a glass jar while a young apprentice watches in awe', setting: 'on a windy hilltop at dusk ' + V },
  'swiftwater-cliffs': { subject: 'tall red cliffs with a rushing blue waterfall pouring into a foaming river below', setting: 'at sunset ' + V },
  'island': { subject: 'a calm blue lake with a small wooded island and a tiny otter house on stilts', setting: 'under a soft pastel sky ' + V },
  'mountain': { subject: 'a scenic landscape of jagged red-rock mountain peaks and a smoking volcano summit, a tiny cottage on a ledge', setting: 'under a fiery orange sky ' + V },
};
