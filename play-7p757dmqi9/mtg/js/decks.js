import { isImplemented } from './cards.js?v=202611021207';

// BEGIN GENERATED DECKS (node test/build_decks.mjs --write)
export const DECK_LISTS = {
  "White Weenie (W)": { "Savannah Lions": 4, "Pearled Unicorn": 3, "Serra Angel": 3, "Swords to Plowshares": 4, Armageddon: 2, "Healing Salve": 1, Disenchant: 1, "Wall of Swords": 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, Juggernaut: 1, Onulet: 1, "Northern Paladin": 1, Plains: 15 },
  "Blue Skies (U)": { "Air Elemental": 3, "Mahamoti Djinn": 2, "Prodigal Sorcerer": 3, Counterspell: 4, "Ancestral Recall": 1, Unsummon: 3, "Psionic Blast": 3, "Merfolk of the Pearl Trident": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 15 },
  "Black Shadows (B)": { "Hypnotic Specter": 4, "Royal Assassin": 3, Terror: 4, "Black Knight": 4, "Sengir Vampire": 3, "Bog Wraith": 2, "Drudge Skeletons": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Jet": 1, Swamp: 15 },
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
  "Black Control (W/B)": { "Swords to Plowshares": 2, Terror: 3, "Wrath of God": 1, "Royal Assassin": 2, "Sengir Vampire": 2, "Black Knight": 3, "White Knight": 3, "Hypnotic Specter": 2, "Serra Angel": 2, "Northern Paladin": 2, "Pearled Unicorn": 2, "Sol Ring": 1, Scrubland: 3, Plains: 6, Swamp: 6 },
  "Auras of Might (G/B)": { "Llanowar Elves": 4, "Birds of Paradise": 2, "Grizzly Bears": 3, "Black Knight": 3, "Hypnotic Specter": 3, "Aspect of Wolf": 3, "Unholy Strength": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Emerald": 1, "Mox Jet": 1, Bayou: 3, Forest: 5, Swamp: 7 },
  "Dragon Stompers (R/G)": { "Llanowar Elves": 4, "Rock Hydra": 3, "Dragon Whelp": 3, "Kird Ape": 4, "Shivan Dragon": 3, "Hill Giant": 2, Fireball: 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, "Mox Emerald": 1, Taiga: 3, Mountain: 10, Forest: 1 },
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
