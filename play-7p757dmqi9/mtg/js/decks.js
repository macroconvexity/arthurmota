import { isImplemented } from './cards.js?v=20261102145746';

// BEGIN GENERATED DECKS (node test/build_decks.mjs --write)
export const DECK_LISTS = {
  "White Weenie (W)": { "Savannah Lions": 4, "Pearled Unicorn": 3, "Serra Angel": 3, "Swords to Plowshares": 4, Armageddon: 2, "Healing Salve": 1, Disenchant: 1, "Wall of Swords": 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, Juggernaut: 1, Onulet: 1, "Northern Paladin": 1, Plains: 15 },
  "Blue Skies (U)": { "Air Elemental": 3, "Mahamoti Djinn": 2, "Prodigal Sorcerer": 3, Counterspell: 4, "Ancestral Recall": 1, Unsummon: 3, "Psionic Blast": 3, "Merfolk of the Pearl Trident": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 15 },
  "Black Shadows (B)": { "Hypnotic Specter": 3, "Royal Assassin": 2, Terror: 3, "Black Knight": 3, "Sengir Vampire": 1, "Bog Wraith": 2, "Drudge Skeletons": 2, "Scathe Zombies": 3, "Frozen Shade": 2, Sinkhole: 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Jet": 1, Swamp: 14 },
  "Red Burn (R)": { "Lightning Bolt": 4, "Hurloon Minotaur": 3, "Mons's Goblin Raiders": 3, "Gray Ogre": 3, "Hill Giant": 3, "Fire Elemental": 3, "Shivan Dragon": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, Mountain: 15 },
  "Green Stompy (G)": { "Llanowar Elves": 4, "Birds of Paradise": 2, "Grizzly Bears": 4, "Giant Spider": 3, "Craw Wurm": 3, "War Mammoth": 3, "Ironroot Treefolk": 2, "Giant Growth": 4, "Sol Ring": 1, "Black Lotus": 1, "Mox Emerald": 1, Forest: 12 },
  "Fire & Light (R/W)": { "Savannah Lions": 3, "Pearled Unicorn": 2, "Serra Angel": 2, "Hill Giant": 2, "Gray Ogre": 2, "Shivan Dragon": 2, "Earth Elemental": 1, "Lightning Bolt": 4, "Swords to Plowshares": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, "Mox Pearl": 1, Plateau: 3, Mountain: 6, Plains: 6 },
  "Tides & Shadows (U/B)": { "Prodigal Sorcerer": 3, "Hypnotic Specter": 3, "Royal Assassin": 2, "Mahamoti Djinn": 2, "Air Elemental": 2, Counterspell: 4, Terror: 4, "Ancestral Recall": 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Underground Sea": 3, Island: 7, Swamp: 5 },
  "Wild Growth (G/R)": { "Llanowar Elves": 4, "Birds of Paradise": 3, "Grizzly Bears": 4, "Giant Spider": 3, "Craw Wurm": 3, "Hill Giant": 2, "Shivan Dragon": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Emerald": 1, "Mox Ruby": 1, Taiga: 3, Forest: 9, Mountain: 3 },
  "Azorius Control (W/U)": { "Serra Angel": 3, "Mahamoti Djinn": 2, "Prodigal Sorcerer": 3, Counterspell: 4, "Swords to Plowshares": 4, "Wrath of God": 2, Balance: 1, "Ancestral Recall": 1, Disenchant: 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, Tundra: 3, Plains: 6, Island: 6 },
  "Rakdos Aggro (B/R)": { "Hypnotic Specter": 3, "Royal Assassin": 2, "Lightning Bolt": 4, Terror: 4, "Hurloon Minotaur": 3, "Fire Elemental": 3, "Shivan Dragon": 2, Sinkhole: 2, "Sol Ring": 1, "Black Lotus": 1, Badlands: 3, Swamp: 6, Mountain: 6 },
  "Selesnya Rush (G/W)": { "Llanowar Elves": 4, "Savannah Lions": 4, "Serra Angel": 3, "Grizzly Bears": 4, "Giant Spider": 3, "War Mammoth": 2, "Swords to Plowshares": 4, "Sol Ring": 1, "Black Lotus": 1, "Mox Emerald": 1, "Mox Pearl": 1, Savannah: 3, Forest: 4, Plains: 5 },
  "Simic Tempo (G/U)": { "Llanowar Elves": 4, "Birds of Paradise": 2, "Grizzly Bears": 3, "Giant Spider": 3, "Air Elemental": 3, "Mahamoti Djinn": 2, "Prodigal Sorcerer": 3, Counterspell: 4, "Sol Ring": 1, "Black Lotus": 1, "Mox Emerald": 1, "Mox Sapphire": 1, "Tropical Island": 3, Forest: 3, Island: 6 },
  "Auras & Armor (W/U)": { "Savannah Lions": 3, "White Knight": 3, "Northern Paladin": 2, "Serra Angel": 2, "Lord of Atlantis": 2, "Serendib Efreet": 2, "Holy Strength": 4, Flight: 4, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, Tundra: 3, Plains: 7, Island: 4 },
  "Artifact Fire (R)": { "Mana Vault": 1, Juggernaut: 3, "Obsianus Golem": 2, "Clockwork Beast": 1, "Icy Manipulator": 2, "Jayemdae Tome": 2, "Rocket Launcher": 1, Ornithopter: 2, "Dragon Engine": 2, Fireball: 3, Disintegrate: 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, Mountain: 15 },
  "Fireball Control (U/R)": { Fireball: 3, Disintegrate: 3, "Lightning Bolt": 4, Counterspell: 3, "Prodigal Sorcerer": 3, "Serendib Efreet": 3, "Air Elemental": 2, "Wall of Fire": 2, "Sol Ring": 1, "Black Lotus": 1, "Volcanic Island": 3, Island: 6, Mountain: 6 },
  "Black Control (W/B)": { "Swords to Plowshares": 2, Terror: 3, "Wrath of God": 1, "Royal Assassin": 2, "Sengir Vampire": 2, "Black Knight": 3, "White Knight": 3, "Hypnotic Specter": 2, "Serra Angel": 2, "Northern Paladin": 2, "Pearled Unicorn": 2, "Scathe Zombies": 2, Scrubland: 3, Plains: 5, Swamp: 6 },
  "Auras of Might (G/B)": { "Llanowar Elves": 4, "Grizzly Bears": 3, "Black Knight": 3, "Hypnotic Specter": 4, "Royal Assassin": 3, "Unholy Strength": 2, Regeneration: 1, Terror: 4, "Sol Ring": 1, "Black Lotus": 1, "Mox Emerald": 1, "Mox Jet": 1, Bayou: 3, Forest: 2, Swamp: 7 },
  "Dragon Stompers (R/G)": { "Llanowar Elves": 4, "Rock Hydra": 3, "Dragon Whelp": 3, "Kird Ape": 4, "Shivan Dragon": 3, "Hill Giant": 2, Fireball: 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, "Mox Emerald": 1, Taiga: 3, Mountain: 10, Forest: 1 },
  "Bands of Brothers (G/W)": { "Benalish Hero": 3, "Mesa Pegasus": 4, "Timber Wolves": 4, Crusade: 2, "White Knight": 3, "Savannah Lions": 3, "Serra Angel": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Emerald": 1, "Mox Pearl": 1, Savannah: 3, Forest: 1, Plains: 10 },
  "Troll Bridge (B/R)": { "Sedge Troll": 4, "Uthden Troll": 4, "Black Knight": 3, "Hypnotic Specter": 2, "Lightning Bolt": 4, Terror: 3, "Fire Elemental": 2, "Hill Giant": 2, "Sol Ring": 1, "Black Lotus": 1, Badlands: 3, Swamp: 5, Mountain: 6 },
  "Time & Tide (U/G)": { "Time Walk": 1, Braingeyser: 1, "Ancestral Recall": 1, "Power Sink": 1, Counterspell: 3, "Llanowar Elves": 4, "Birds of Paradise": 2, "Serendib Efreet": 3, "Water Elemental": 2, "Air Elemental": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, "Mox Emerald": 1, "Tropical Island": 3, Island: 10, Forest: 2 },
  "Mind Rot (U/B)": { "Mind Twist": 4, "Hypnotic Specter": 4, "Black Knight": 3, "Phantom Monster": 2, Counterspell: 3, Terror: 3, "Air Elemental": 2, "Sengir Vampire": 2, "Sol Ring": 1, "Black Lotus": 1, "Underground Sea": 3, Island: 4, Swamp: 8 },
  "Wrath & Burn (R/W)": { "Wrath of God": 2, Armageddon: 1, "Lightning Bolt": 3, "Swords to Plowshares": 3, "Serra Angel": 3, "Wall of Swords": 2, "Shivan Dragon": 2, "Fire Elemental": 2, Fireball: 2, "Benalish Hero": 2, "Pearled Unicorn": 2, "Hill Giant": 2, Plateau: 3, Mountain: 5, Plains: 6 },
  "Artifact Ramp (U)": { "Mana Vault": 1, "Basalt Monolith": 1, Juggernaut: 3, "Obsianus Golem": 2, "Clockwork Beast": 2, "Icy Manipulator": 2, "Jayemdae Tome": 2, Counterspell: 3, "Mahamoti Djinn": 2, "Air Elemental": 3, "Ancestral Recall": 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 15 },
};
export const DECK_META = {
  "White Weenie (W)": { name: "White Weenie (W)", colors: ["W"], archetype: "aggro", blurb: "Cheap white creatures and Swords to Plowshares try to win before anything big lands.", aiLevelHint: "normal", rating: 42 },
  "Blue Skies (U)": { name: "Blue Skies (U)", colors: ["U"], archetype: "tempo", blurb: "Flyers and Counterspell: bounce, counter, and fly over the top.", aiLevelHint: "hard", rating: 53 },
  "Black Shadows (B)": { name: "Black Shadows (B)", colors: ["B"], archetype: "midrange", blurb: "Hypnotic Specter, Black Knight and Terror grind the opponent down in the dark.", aiLevelHint: "normal", rating: 48 },
  "Red Burn (R)": { name: "Red Burn (R)", colors: ["R"], archetype: "burn", blurb: "Lightning Bolt and fat red bodies, aimed at the face when it is lethal.", aiLevelHint: "normal", rating: 49 },
  "Green Stompy (G)": { name: "Green Stompy (G)", colors: ["G"], archetype: "stompy", blurb: "Mana elves into oversized green creatures backed by Giant Growth.", aiLevelHint: "normal", rating: 38 },
  "Fire & Light (R/W)": { name: "Fire & Light (R/W)", colors: ["R","W"], archetype: "midrange", blurb: "Bolt and Swords clear the way for Serra Angel and Shivan Dragon.", aiLevelHint: "normal", rating: 60 },
  "Tides & Shadows (U/B)": { name: "Tides & Shadows (U/B)", colors: ["U","B"], archetype: "control", blurb: "Counterspell, Terror and Prodigal Sorcerer control the board while Specters bite.", aiLevelHint: "hard", rating: 59 },
  "Wild Growth (G/R)": { name: "Wild Growth (G/R)", colors: ["G","R"], archetype: "ramp", blurb: "Llanowar Elves and Birds of Paradise power out Shivan Dragon and burn.", aiLevelHint: "normal", rating: 46 },
  "Azorius Control (W/U)": { name: "Azorius Control (W/U)", colors: ["W","U"], archetype: "control", blurb: "Wrath of God, Swords and Counterspell, finished by Serra Angel and Mahamoti Djinn.", aiLevelHint: "hard", rating: 63 },
  "Rakdos Aggro (B/R)": { name: "Rakdos Aggro (B/R)", colors: ["B","R"], archetype: "aggro", blurb: "Burn, Terror and efficient attackers punish slow hands.", aiLevelHint: "normal", rating: 56 },
  "Selesnya Rush (G/W)": { name: "Selesnya Rush (G/W)", colors: ["G","W"], archetype: "aggro", blurb: "Green and white beaters rush in with Swords to Plowshares for blockers.", aiLevelHint: "normal", rating: 47 },
  "Simic Tempo (G/U)": { name: "Simic Tempo (G/U)", colors: ["G","U"], archetype: "tempo", blurb: "Elves ramp into flyers while Counterspell and Unsummon keep the opponent a step behind.", aiLevelHint: "hard", rating: 49 },
  "Auras & Armor (W/U)": { name: "Auras & Armor (W/U)", colors: ["W","U"], archetype: "auras", blurb: "Holy Strength, Flight and Lance turn one creature into a must-answer threat.", aiLevelHint: "normal", rating: 41 },
  "Artifact Fire (R)": { name: "Artifact Fire (R)", colors: ["R"], archetype: "artifacts", blurb: "Juggernaut, Icy Manipulator and big X burn spells.", aiLevelHint: "normal", rating: 41 },
  "Fireball Control (U/R)": { name: "Fireball Control (U/R)", colors: ["U","R"], archetype: "control", blurb: "Fireball, Disintegrate and Counterspell: answer everything, then burn the opponent out.", aiLevelHint: "hard", rating: 43 },
  "Black Control (W/B)": { name: "Black Control (W/B)", colors: ["W","B"], archetype: "midrange", blurb: "Knights of both colours backed by a few removal spells.", aiLevelHint: "normal", rating: 55 },
  "Auras of Might (G/B)": { name: "Auras of Might (G/B)", colors: ["G","B"], archetype: "auras", blurb: "Unholy Strength, Aspect of Wolf and Regeneration make resilient attackers.", aiLevelHint: "normal", rating: 57 },
  "Dragon Stompers (R/G)": { name: "Dragon Stompers (R/G)", colors: ["R","G"], archetype: "ramp", blurb: "Rock Hydra, Dragon Whelp and Fireball, fuelled by Llanowar Elves.", aiLevelHint: "normal", rating: 52 },
  "Bands of Brothers (G/W)": { name: "Bands of Brothers (G/W)", colors: ["G","W"], archetype: "banding", blurb: "Benalish Hero, Mesa Pegasus and Timber Wolves attack in bands and divide damage as they like.", aiLevelHint: "hard", rating: 40 },
  "Troll Bridge (B/R)": { name: "Troll Bridge (B/R)", colors: ["B","R"], archetype: "regeneration", blurb: "Sedge Troll and Uthden Troll regenerate through combat while burn finishes the job.", aiLevelHint: "hard", rating: 52 },
  "Time & Tide (U/G)": { name: "Time & Tide (U/G)", colors: ["U","G"], archetype: "extra turns", blurb: "Time Walk, Timetwister and Braingeyser dig deep behind mana elves and counters.", aiLevelHint: "hard", rating: 46 },
  "Mind Rot (U/B)": { name: "Mind Rot (U/B)", colors: ["U","B"], archetype: "discard", blurb: "Mind Twist and Hypnotic Specter empty the opponent's hand before the creatures arrive.", aiLevelHint: "hard", rating: 54 },
  "Wrath & Burn (R/W)": { name: "Wrath & Burn (R/W)", colors: ["R","W"], archetype: "control", blurb: "Wrath of God and Armageddon reset the game, Bolt and Serra Angel close it.", aiLevelHint: "hard", rating: 58 },
  "Artifact Ramp (U)": { name: "Artifact Ramp (U)", colors: ["U"], archetype: "artifact ramp", blurb: "Mana Vault, Sol Ring and Basalt Monolith accelerate Juggernaut and Mahamoti Djinn.", aiLevelHint: "hard", rating: 50 },
};
// END GENERATED DECKS

// Build a list of card defs from {cardName: count}. Basic lands get a random art among the printed variants.
export function buildDeckFrom(counts, byName, rng = Math.random) {
  const out = [];
  for (const [n, k] of Object.entries(counts)) {
    const variants = byName[n];
    if (!variants) throw new Error('card not in catalogue: ' + n);
    for (let i = 0; i < k; i++) out.push(variants[Math.floor(rng() * variants.length)]);
  }
  return out;
}
export const buildDeck = (name, byName, rng) => buildDeckFrom(DECK_LISTS[name], byName, rng);

const RESTRICTED = new Set(['Black Lotus', 'Mox Pearl', 'Mox Sapphire', 'Mox Jet', 'Mox Ruby', 'Mox Emerald', 'Sol Ring', 'Ancestral Recall', 'Time Walk', 'Timetwister', 'Library of Alexandria', 'Demonic Tutor']);
const BASICS = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']);
export const copyLimit = (name) => (BASICS.has(name) ? 99 : RESTRICTED.has(name) ? 1 : 4);

export function indexCards(cards) {
  const byName = {};
  for (const c of cards) {
    c.art = `assets/cards/${c.set}/${c.number}_${c.identifiers.scryfallId}.jpg`;
    (byName[c.name] ||= []).push(c);
  }
  return byName;
}

export function coverage(cards) {
  const ok = cards.filter(isImplemented);
  return { implemented: ok.length, total: cards.length };
}

// ---- UI support -----------------------------------------------------------------------------
// describeDeck(name[, byName]) -> {name, colors, archetype, blurb, aiLevelHint, rating, size, lands, keyCards[, avgCmc, creatures]}
// `byName` (from indexCards) is optional; with it the card-based stats are filled in.
export function describeDeck(name, byName) {
  const list = DECK_LISTS[name]; if (!list) return null;
  const meta = DECK_META[name] || { name, colors: [], archetype: 'custom', blurb: '', aiLevelHint: 'normal', rating: 50 };
  const entries = Object.entries(list);
  const size = entries.reduce((a, [, k]) => a + k, 0);
  const lands = entries.filter(([n]) => BASICS.has(n) || (byName?.[n]?.[0].types || []).includes('Land')).reduce((a, [, k]) => a + k, 0);
  const keyCards = entries.filter(([n]) => !BASICS.has(n) && !RESTRICTED.has(n) && !(byName?.[n]?.[0].types || []).includes('Land')).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n);
  const out = { ...meta, size, lands, keyCards };
  if (byName) {
    const spells = entries.filter(([n]) => byName[n] && !byName[n][0].types.includes('Land'));
    const n = spells.reduce((a, [, k]) => a + k, 0) || 1;
    out.avgCmc = Math.round((spells.reduce((a, [nm, k]) => a + (byName[nm][0].manaValue || 0) * k, 0) / n) * 10) / 10;
    out.creatures = spells.filter(([nm]) => byName[nm][0].types.includes('Creature')).reduce((a, [, k]) => a + k, 0);
  }
  return out;
}

// pickOpponent(playerDeckName, level, {mirror, rng}) -> deck name.
// Never the mirror unless {mirror:true}. The AI's skill level shifts its effective strength, so an easy AI gets a
// stronger deck and a hard AI a weaker one, aiming at an even match against the player's deck rating.
const LEVEL_BONUS = { easy: -8, normal: 0, hard: 8 };
export function pickOpponent(playerDeckName, level = 'normal', opts = {}) {
  const rng = opts.rng || Math.random;
  const names = Object.keys(DECK_LISTS);
  if (opts.mirror && DECK_LISTS[playerDeckName]) return playerDeckName;
  let pool = names.filter((n) => n !== playerDeckName); if (!pool.length) pool = names;
  const mine = DECK_META[playerDeckName]?.rating ?? 50;
  const target = mine - (LEVEL_BONUS[level] ?? 0);
  const ranked = pool.map((n) => ({ n, d: Math.abs((DECK_META[n]?.rating ?? 50) - target) })).sort((a, b) => a.d - b.d || a.n.localeCompare(b.n));
  const top = ranked.slice(0, Math.min(4, ranked.length));
  return top[Math.floor(rng() * top.length)].n;
}
