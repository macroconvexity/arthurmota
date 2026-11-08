import { isImplemented } from './cards.js?v=20261108114946';

// BEGIN GENERATED DECKS (node test/build_decks.mjs --write)
export const DECK_LISTS = {
  "White Weenie (W)": { "Savannah Lions": 4, "Pearled Unicorn": 4, "Serra Angel": 4, "Swords to Plowshares": 4, Armageddon: 4, "Healing Salve": 2, Disenchant: 2, "Wall of Swords": 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, "Argivian Blacksmith": 1, "Moorish Cavalry": 1, "Northern Paladin": 1, "Argivian Archaeologist": 1, "War Elephant": 1, "White Knight": 1, "King Suleiman": 1, "Mesa Pegasus": 1, "Repentant Blacksmith": 1, "Samite Healer": 1, "Veteran Bodyguard": 1, Plains: 21 },
  "Blue Skies (U)": { "Air Elemental": 4, "Mahamoti Djinn": 4, "Prodigal Sorcerer": 4, Counterspell: 4, "Ancestral Recall": 1, Unsummon: 4, "Psionic Blast": 4, "Merfolk of the Pearl Trident": 4, "Phantom Monster": 4, "Water Elemental": 2, Timetwister: 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 21 },
  "Black Shadows (B)": { "Hypnotic Specter": 4, "Royal Assassin": 4, Terror: 4, "Black Knight": 4, "Sengir Vampire": 2, "Bog Wraith": 4, "Drudge Skeletons": 4, "Scathe Zombies": 4, "Frozen Shade": 3, Sinkhole: 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Jet": 1, Swamp: 21 },
  "Red Burn (R)": { "Lightning Bolt": 4, "Hurloon Minotaur": 4, "Mons's Goblin Raiders": 4, "Gray Ogre": 4, "Hill Giant": 4, "Fire Elemental": 4, "Shivan Dragon": 4, "Roc of Kher Ridges": 3, "Orcish Artillery": 3, "Stone Rain": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, Mountain: 21 },
  "Green Stompy (G)": { "Llanowar Elves": 4, "Birds of Paradise": 4, "Grizzly Bears": 4, "Giant Spider": 4, "Craw Wurm": 4, "War Mammoth": 4, "Ironroot Treefolk": 4, "Giant Growth": 4, "Scryb Sprites": 4, "Ley Druid": 4, Forest: 19, "Erhnam Djinn": 1 },
  "Fire & Light (R/W)": { "Savannah Lions": 4, "Pearled Unicorn": 4, "Serra Angel": 4, "Hill Giant": 4, "Gray Ogre": 4, "Shivan Dragon": 4, "Earth Elemental": 2, "Lightning Bolt": 4, "Swords to Plowshares": 4, "Wrath of God": 1, "Healing Salve": 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, "Mox Pearl": 1, Plateau: 3, Mountain: 8, Plains: 9 },
  "Tides & Shadows (U/B)": { "Prodigal Sorcerer": 4, "Hypnotic Specter": 4, "Royal Assassin": 4, "Mahamoti Djinn": 4, "Air Elemental": 4, Counterspell: 4, Terror: 4, "Ancestral Recall": 1, "Dark Ritual": 4, Sinkhole: 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Underground Sea": 3, Island: 8, Swamp: 9 },
  "Wild Growth (G/R)": { "Llanowar Elves": 4, "Birds of Paradise": 4, "Grizzly Bears": 4, "Giant Spider": 4, "Craw Wurm": 4, "Hill Giant": 4, "Shivan Dragon": 4, "Lightning Bolt": 4, "Giant Growth": 4, "Stone Rain": 4, Taiga: 3, Forest: 12, Mountain: 4, "Mijae Djinn": 1 },
  "Azorius Control (W/U)": { "Serra Angel": 4, "Mahamoti Djinn": 4, "Prodigal Sorcerer": 4, Counterspell: 4, "Swords to Plowshares": 4, "Wrath of God": 1, Disenchant: 1, "Air Elemental": 4, "White Knight": 4, "Pearled Unicorn": 3, "Water Elemental": 3, "Sol Ring": 1, Tundra: 3, Plains: 9, Island: 11 },
  "Rakdos Aggro (B/R)": { "Hypnotic Specter": 4, "Royal Assassin": 4, "Lightning Bolt": 4, Terror: 4, "Hurloon Minotaur": 4, "Fire Elemental": 4, "Shivan Dragon": 4, Sinkhole: 4, "Stone Rain": 1, "Dark Ritual": 3, "Sol Ring": 1, "Black Lotus": 1, Badlands: 3, Swamp: 9, Mountain: 10 },
  "Selesnya Rush (G/W)": { "Llanowar Elves": 4, "Savannah Lions": 4, "Serra Angel": 4, "Grizzly Bears": 4, "Giant Spider": 4, "War Mammoth": 4, "Swords to Plowshares": 4, "Giant Growth": 4, "Pearled Unicorn": 4, Armageddon: 4, "Sol Ring": 1, Savannah: 3, Forest: 8, Plains: 8 },
  "Simic Tempo (G/U)": { "Llanowar Elves": 4, "Birds of Paradise": 4, "Grizzly Bears": 4, "Giant Spider": 4, "Air Elemental": 4, "Mahamoti Djinn": 4, "Prodigal Sorcerer": 4, Counterspell: 4, Unsummon: 4, "Giant Growth": 4, "Ancestral Recall": 1, "Tropical Island": 3, Forest: 6, Island: 10 },
  "Auras & Armor (W/U)": { "Savannah Lions": 4, "White Knight": 4, "Northern Paladin": 3, "Serra Angel": 3, "Lord of Atlantis": 3, "Serendib Efreet": 2, "Holy Strength": 4, Flight: 4, Lance: 2, "Holy Armor": 2, "Swords to Plowshares": 3, "Control Magic": 1, Counterspell: 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, Tundra: 3, Plains: 10, Island: 6 },
  "Artifact Fire (R)": { "Mana Vault": 1, Juggernaut: 4, "Obsianus Golem": 4, "Clockwork Beast": 2, "Icy Manipulator": 3, "Jayemdae Tome": 2, "Rocket Launcher": 1, Ornithopter: 2, "Dragon Engine": 2, Fireball: 3, Disintegrate: 3, "Lightning Bolt": 4, Shatter: 1, "Fire Elemental": 2, "Shivan Dragon": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, Mountain: 21 },
  "Fireball Control (U/R)": { Fireball: 4, Disintegrate: 4, "Lightning Bolt": 4, Counterspell: 4, "Prodigal Sorcerer": 4, "Serendib Efreet": 4, "Air Elemental": 4, "Wall of Fire": 3, "Psionic Blast": 1, "Dragon Whelp": 3, "Sol Ring": 1, "Black Lotus": 1, "Volcanic Island": 3, Island: 10, Mountain: 10 },
  "Black Control (W/B)": { "Swords to Plowshares": 3, Terror: 4, "Wrath of God": 1, "Royal Assassin": 3, "Sengir Vampire": 3, "Black Knight": 4, "White Knight": 4, "Hypnotic Specter": 3, "Serra Angel": 3, "Northern Paladin": 3, "Pearled Unicorn": 3, "Scathe Zombies": 3, Scrubland: 3, Plains: 9, Swamp: 11 },
  "Auras of Might (G/B)": { "Llanowar Elves": 4, "Grizzly Bears": 4, "Black Knight": 4, "Hypnotic Specter": 4, "Royal Assassin": 4, "Unholy Strength": 4, Regeneration: 4, Terror: 4, "Giant Growth": 4, "Sengir Vampire": 4, "Mind Twist": 1, Bayou: 3, Forest: 4, Swamp: 12 },
  "Dragon Stompers (R/G)": { "Llanowar Elves": 4, "Rock Hydra": 4, "Dragon Whelp": 4, "Kird Ape": 4, "Shivan Dragon": 4, "Hill Giant": 4, Fireball: 4, "Lightning Bolt": 4, "Giant Growth": 4, Firebreathing: 4, Taiga: 3, Mountain: 14, Forest: 2, "Mijae Djinn": 1 },
  "Bands of Brothers (G/W)": { "Benalish Hero": 4, "Mesa Pegasus": 4, "Timber Wolves": 4, Crusade: 3, "White Knight": 4, "Savannah Lions": 4, "Serra Angel": 4, "Grizzly Bears": 3, "War Mammoth": 2, "Swords to Plowshares": 3, "Giant Growth": 2, "Llanowar Elves": 3, "Sol Ring": 1, Savannah: 3, Forest: 5, Plains: 11 },
  "Troll Bridge (B/R)": { "Sedge Troll": 4, "Uthden Troll": 4, "Black Knight": 4, "Hypnotic Specter": 4, "Lightning Bolt": 4, Terror: 4, "Fire Elemental": 4, "Hill Giant": 4, Disintegrate: 3, "Sol Ring": 1, "Black Lotus": 1, Badlands: 3, Swamp: 9, Mountain: 11 },
  "Time & Tide (U/G)": { "Time Walk": 1, Braingeyser: 1, "Ancestral Recall": 1, "Power Sink": 2, Counterspell: 4, "Llanowar Elves": 4, "Birds of Paradise": 4, "Serendib Efreet": 4, "Water Elemental": 3, "Air Elemental": 4, "Giant Spider": 4, "Mahamoti Djinn": 3, "Prodigal Sorcerer": 4, "Giant Growth": 2, "Tropical Island": 3, Island: 12, Forest: 4 },
  "Mind Rot (U/B)": { "Mind Twist": 1, "Hypnotic Specter": 4, "Black Knight": 4, "Phantom Monster": 4, Counterspell: 4, Terror: 4, "Air Elemental": 4, "Sengir Vampire": 4, "Royal Assassin": 3, "Serendib Efreet": 3, "Sol Ring": 1, "Black Lotus": 1, "Underground Sea": 3, Island: 8, Swamp: 12 },
  "Wrath & Burn (R/W)": { "Wrath of God": 3, Armageddon: 1, "Lightning Bolt": 4, "Swords to Plowshares": 4, "Serra Angel": 4, "Wall of Swords": 3, "Shivan Dragon": 3, "Fire Elemental": 3, Fireball: 3, "Benalish Hero": 3, "Pearled Unicorn": 2, "Hill Giant": 2, Plateau: 3, Mountain: 10, Plains: 12 },
  "Artifact Ramp (U)": { "Mana Vault": 1, "Basalt Monolith": 1, Juggernaut: 4, "Obsianus Golem": 4, "Clockwork Beast": 4, "Icy Manipulator": 3, "Jayemdae Tome": 3, Counterspell: 4, "Mahamoti Djinn": 3, "Air Elemental": 3, "Ancestral Recall": 1, Braingeyser: 1, "Prodigal Sorcerer": 2, Ornithopter: 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 21 },
  "Hellfire Legends (B/R)": { "Barktooth Warbeard": 1, "Axelrod Gunnarson": 1, "Rohgahh of Kher Keep": 1, "Lady Orca": 1, "Boris Devilboon": 1, "Tor Wauki": 1, "Pavel Maliki": 1, "Chain Lightning": 4, "Lightning Bolt": 4, Terror: 4, "Hypnotic Specter": 4, "Black Knight": 4, "Dark Ritual": 4, "Hill Giant": 3, "Royal Assassin": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Jet": 1, Badlands: 3, Swamp: 12, Mountain: 6 },
  "Gruul Legends (R/G)": { "Jerrard of the Closed Fist": 1, "Livonya Silone": 1, "Marhault Elsdragon": 1, Stangg: 1, "Sunastian Falconer": 1, "The Lady of the Mountain": 1, "Llanowar Elves": 4, "Birds of Paradise": 4, "Chain Lightning": 4, "Lightning Bolt": 4, "Giant Growth": 4, "Wolverine Pack": 4, "Grizzly Bears": 4, "Shivan Dragon": 3, "Fire Elemental": 3, Taiga: 3, Mountain: 7, Forest: 9, "Hill Giant": 1 },
  "Selesnya Legends (G/W)": { "Gabriel Angelfire": 1, "Jasmine Boreal": 1, "Kei Takahashi": 1, "Lady Caleria": 1, "Lord Magnus": 1, "Sir Shandlar of Eberyn": 1, "Torsten Von Ursus": 1, "Llanowar Elves": 4, "Birds of Paradise": 4, "Swords to Plowshares": 4, "Serra Angel": 4, "Savannah Lions": 4, "Giant Growth": 4, "Thunder Spirit": 3, "Keepers of the Faith": 3, "Grizzly Bears": 4, Savannah: 3, Forest: 6, Plains: 10 },
  "Azorius Legends (W/U)": { "Ayesha Tanaka": 1, "Gosta Dirk": 1, "Hunding Gjornersen": 1, "Jedit Ojanen": 1, "Kasimir the Lone Wolf": 1, "Rasputin Dreamweaver": 1, "Tobias Andrion": 1, Counterspell: 4, "Force Spike": 4, "Swords to Plowshares": 4, "Wrath of God": 4, "Serra Angel": 4, "Remove Soul": 4, "Mahamoti Djinn": 2, "Air Elemental": 4, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, Tundra: 3, Plains: 8, Island: 9 },
  "Dimir Legends (U/B)": { Nebuchadnezzar: 1, "Princess Lucrezia": 1, "Ramirez DePietro": 1, "Ramses Overdark": 1, "Riven Turnbull": 1, "Sivitri Scarzam": 1, "Ur-Drago": 1, Counterspell: 4, Terror: 4, "Force Spike": 4, "Hypnotic Specter": 4, "Black Knight": 4, "Psionic Blast": 4, "Air Elemental": 4, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, "Underground Sea": 3, Island: 8, Swamp: 8, "Juzám Djinn": 1, "Serendib Djinn": 1, "Junún Efreet": 1 },
  "Moat Prison (W)": { Moat: 2, "Land Tax": 1, "Wrath of God": 3, "Swords to Plowshares": 4, Balance: 1, "Northern Paladin": 3, "White Knight": 4, "Serra Angel": 4, "Mesa Pegasus": 4, "Wall of Light": 3, "Divine Offering": 2, "Healing Salve": 1, "Holy Day": 2, "Wall of Swords": 2, "Sol Ring": 1, "Black Lotus": 1, Plains: 22 },
  "Force Spike Tempo (U)": { "Force Spike": 3, "Remove Soul": 2, Counterspell: 3, Boomerang: 2, "Air Elemental": 4, "Azure Drake": 3, "Zephyr Falcon": 3, "Segovian Leviathan": 3, "Time Elemental": 2, "Water Elemental": 3, "Mahamoti Djinn": 2, "Prodigal Sorcerer": 3, "Serendib Efreet": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 21 },
  "Abyss Artifacts (B)": { "The Abyss": 2, "Nether Void": 2, Ornithopter: 4, "Obsianus Golem": 4, Juggernaut: 4, "Clockwork Beast": 3, "Dragon Engine": 3, "Primal Clay": 2, Terror: 3, Sinkhole: 2, "Hypnotic Specter": 3, "Icy Manipulator": 2, "Jayemdae Tome": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Jet": 1, Swamp: 21 },
  "Storm Burn (R)": { "Chain Lightning": 4, "Lightning Bolt": 4, "Storm World": 1, Backdraft: 2, Pyrotechnics: 2, Fireball: 3, Disintegrate: 3, "Mountain Yeti": 3, "Tempest Efreet": 2, "Crimson Manticore": 3, "Hyperion Blacksmith": 2, "Aerathi Berserker": 2, "Frost Giant": 2, "Fire Elemental": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, Mountain: 22 },
  "Rampage Stompers (G)": { "Craw Giant": 2, "Wolverine Pack": 4, "Llanowar Elves": 4, "Birds of Paradise": 4, "Moss Monster": 4, "Durkwood Boars": 4, "Elven Riders": 2, "Giant Turtle": 3, "Grizzly Bears": 4, "Giant Spider": 4, "Giant Growth": 4, "Craw Wurm": 2, Forest: 19 },
  "Esper Elders (W/U/B)": { Chromium: 1, "Dakkon Blackblade": 1, Halfdane: 1, "Lady Evangela": 1, Counterspell: 4, "Swords to Plowshares": 4, Terror: 4, "Wrath of God": 2, "Serra Angel": 4, "Hypnotic Specter": 3, "Black Knight": 3, "Mahamoti Djinn": 3, "Air Elemental": 3, "Force Spike": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, Tundra: 2, Scrubland: 2, "Underground Sea": 2, Plains: 4, Island: 6, Swamp: 5 },
  "Alpha · White Weenie (W)": { "Savannah Lions": 4, "White Knight": 4, "Benalish Hero": 4, "Pearled Unicorn": 4, "Northern Paladin": 4, "Serra Angel": 3, Crusade: 3, "Swords to Plowshares": 4, Armageddon: 2, Disenchant: 2, "Wrath of God": 1, "Holy Strength": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, Plains: 20 },
  "Alpha · Blue Control (U)": { Counterspell: 4, "Air Elemental": 4, "Prodigal Sorcerer": 4, "Mahamoti Djinn": 3, Unsummon: 4, "Psionic Blast": 3, "Control Magic": 2, "Water Elemental": 2, "Phantasmal Forces": 2, "Ancestral Recall": 1, "Time Walk": 1, Timetwister: 1, Braingeyser: 1, "Mana Short": 1, "Power Sink": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 22 },
  "Alpha · Black Discard (B)": { "Hypnotic Specter": 4, "Black Knight": 4, Terror: 4, "Royal Assassin": 4, Sinkhole: 3, "Mind Twist": 1, "Demonic Tutor": 1, "Dark Ritual": 4, "Sengir Vampire": 2, Pestilence: 2, "Bog Wraith": 2, "Drudge Skeletons": 2, "Frozen Shade": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Jet": 1, Swamp: 22 },
  "Alpha · Red Burn (R)": { "Lightning Bolt": 4, Fireball: 4, Disintegrate: 4, "Hill Giant": 3, "Fire Elemental": 3, "Shivan Dragon": 3, "Dragon Whelp": 3, "Hurloon Minotaur": 3, "Gray Ogre": 2, Fork: 1, "Wheel of Fortune": 1, "Red Elemental Blast": 2, "Stone Rain": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, Mountain: 22 },
  "Alpha · Green Stompy (G)": { "Llanowar Elves": 4, "Birds of Paradise": 4, "Grizzly Bears": 4, "Giant Spider": 4, "War Mammoth": 4, "Craw Wurm": 4, "Ironroot Treefolk": 3, "Force of Nature": 3, "Giant Growth": 4, Channel: 1, Regrowth: 2, Berserk: 3, Fastbond: 1, Forest: 19 },
  "Alpha · Fire & Light (R/W)": { "Savannah Lions": 4, "White Knight": 4, "Serra Angel": 4, "Northern Paladin": 3, "Hill Giant": 2, "Fire Elemental": 2, "Shivan Dragon": 2, "Lightning Bolt": 4, "Swords to Plowshares": 4, "Wrath of God": 1, Balance: 1, Fireball: 3, Armageddon: 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, "Mox Pearl": 1, Plateau: 4, Mountain: 6, Plains: 11 },
  "Alpha · Artifact Control (U)": { Juggernaut: 3, "Obsianus Golem": 2, "Icy Manipulator": 3, "Jayemdae Tome": 2, Counterspell: 4, "Air Elemental": 4, "Mahamoti Djinn": 2, "Prodigal Sorcerer": 3, "Control Magic": 2, "Water Elemental": 3, Unsummon: 3, "Phantasmal Forces": 2, "Psionic Blast": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 22 },
  "Beta · White Weenie (W)": { "Savannah Lions": 4, "White Knight": 4, "Benalish Hero": 4, "Pearled Unicorn": 4, "Northern Paladin": 4, "Serra Angel": 3, Crusade: 3, "Swords to Plowshares": 4, Armageddon: 2, Disenchant: 2, "Wrath of God": 1, "Holy Strength": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, Plains: 20 },
  "Beta · Blue Control (U)": { Counterspell: 4, "Air Elemental": 4, "Prodigal Sorcerer": 4, "Mahamoti Djinn": 3, Unsummon: 4, "Psionic Blast": 3, "Control Magic": 2, "Water Elemental": 2, "Phantasmal Forces": 2, "Ancestral Recall": 1, "Time Walk": 1, Timetwister: 1, Braingeyser: 1, "Mana Short": 1, "Power Sink": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 22 },
  "Beta · Black Discard (B)": { "Hypnotic Specter": 4, "Black Knight": 4, Terror: 4, "Royal Assassin": 4, Sinkhole: 3, "Mind Twist": 1, "Demonic Tutor": 1, "Dark Ritual": 4, "Sengir Vampire": 2, Pestilence: 2, "Bog Wraith": 2, "Drudge Skeletons": 2, "Frozen Shade": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Jet": 1, Swamp: 22 },
  "Beta · Red Burn (R)": { "Lightning Bolt": 4, Fireball: 4, Disintegrate: 4, "Hill Giant": 3, "Fire Elemental": 3, "Shivan Dragon": 3, "Dragon Whelp": 3, "Hurloon Minotaur": 3, "Gray Ogre": 2, Fork: 1, "Wheel of Fortune": 1, "Red Elemental Blast": 2, "Stone Rain": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, Mountain: 22 },
  "Beta · Green Stompy (G)": { "Llanowar Elves": 4, "Birds of Paradise": 4, "Grizzly Bears": 4, "Giant Spider": 4, "War Mammoth": 4, "Craw Wurm": 4, "Ironroot Treefolk": 3, "Force of Nature": 3, "Giant Growth": 4, Channel: 1, Regrowth: 2, Berserk: 3, Fastbond: 1, Forest: 19 },
  "Beta · Fireball Control (U/R)": { "Prodigal Sorcerer": 4, "Air Elemental": 4, Counterspell: 4, Fireball: 4, "Lightning Bolt": 4, Disintegrate: 4, "Psionic Blast": 2, "Fire Elemental": 2, "Shivan Dragon": 2, "Mahamoti Djinn": 1, "Ancestral Recall": 1, "Time Walk": 1, Unsummon: 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, "Mox Ruby": 1, "Volcanic Island": 4, Island: 10, Mountain: 7 },
  "Beta · Artifact Control (U)": { Juggernaut: 3, "Obsianus Golem": 2, "Icy Manipulator": 3, "Jayemdae Tome": 2, Counterspell: 4, "Air Elemental": 4, "Mahamoti Djinn": 2, "Prodigal Sorcerer": 3, "Control Magic": 2, "Water Elemental": 3, Unsummon: 3, "Phantasmal Forces": 2, "Psionic Blast": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 22 },
  "Unlimited · White Weenie (W)": { "Savannah Lions": 4, "White Knight": 4, "Benalish Hero": 4, "Pearled Unicorn": 4, "Northern Paladin": 4, "Serra Angel": 3, Crusade: 3, "Swords to Plowshares": 4, Armageddon: 2, Disenchant: 2, "Wrath of God": 1, "Holy Strength": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, Plains: 20 },
  "Unlimited · Blue Control (U)": { Counterspell: 4, "Air Elemental": 4, "Prodigal Sorcerer": 4, "Mahamoti Djinn": 3, Unsummon: 4, "Psionic Blast": 3, "Control Magic": 2, "Water Elemental": 2, "Phantasmal Forces": 2, "Ancestral Recall": 1, "Time Walk": 1, Timetwister: 1, Braingeyser: 1, "Mana Short": 1, "Power Sink": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 22 },
  "Unlimited · Black Discard (B)": { "Hypnotic Specter": 4, "Black Knight": 4, Terror: 4, "Royal Assassin": 4, Sinkhole: 3, "Mind Twist": 1, "Demonic Tutor": 1, "Dark Ritual": 4, "Sengir Vampire": 2, Pestilence: 2, "Bog Wraith": 2, "Drudge Skeletons": 2, "Frozen Shade": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Jet": 1, Swamp: 22 },
  "Unlimited · Red Burn (R)": { "Lightning Bolt": 4, Fireball: 4, Disintegrate: 4, "Hill Giant": 3, "Fire Elemental": 3, "Shivan Dragon": 3, "Dragon Whelp": 3, "Hurloon Minotaur": 3, "Gray Ogre": 2, Fork: 1, "Wheel of Fortune": 1, "Red Elemental Blast": 2, "Stone Rain": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, Mountain: 22 },
  "Unlimited · Green Stompy (G)": { "Llanowar Elves": 4, "Birds of Paradise": 4, "Grizzly Bears": 4, "Giant Spider": 4, "War Mammoth": 4, "Craw Wurm": 4, "Ironroot Treefolk": 3, "Force of Nature": 3, "Giant Growth": 4, Channel: 1, Regrowth: 2, Berserk: 3, Fastbond: 1, Forest: 19 },
  "Unlimited · Tides & Shadows (U/B)": { Counterspell: 4, Terror: 4, "Hypnotic Specter": 4, "Black Knight": 4, "Air Elemental": 4, "Prodigal Sorcerer": 4, "Sengir Vampire": 2, "Psionic Blast": 4, "Royal Assassin": 3, "Ancestral Recall": 1, "Mind Twist": 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Underground Sea": 4, Island: 8, Swamp: 9 },
  "Unlimited · Artifact Control (U)": { Juggernaut: 3, "Obsianus Golem": 2, "Icy Manipulator": 3, "Jayemdae Tome": 2, Counterspell: 4, "Air Elemental": 4, "Mahamoti Djinn": 2, "Prodigal Sorcerer": 3, "Control Magic": 2, "Water Elemental": 3, Unsummon: 3, "Phantasmal Forces": 2, "Psionic Blast": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 22 },
  "Arabian Nights · Desert Cavalry (W)": { "Moorish Cavalry": 3, "War Elephant": 3, "Army of Allah": 2, "King Suleiman": 1, "Mesa Pegasus": 2, "Savannah Lions": 4, "White Knight": 4, "Benalish Hero": 3, "Pearled Unicorn": 3, "Northern Paladin": 3, "Serra Angel": 3, Crusade: 2, "Swords to Plowshares": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, Plains: 21 },
  "Arabian Nights · Sea & Sand Tempo (U)": { "Serendib Efreet": 4, "Flying Men": 4, "Old Man of the Sea": 2, "Island Fish Jasconius": 1, Sindbad: 1, Counterspell: 4, "Air Elemental": 3, "Prodigal Sorcerer": 3, "Mahamoti Djinn": 2, Unsummon: 3, "Psionic Blast": 2, "Control Magic": 2, "Water Elemental": 2, "Phantasmal Forces": 2, "Ancestral Recall": 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 21 },
  "Arabian Nights · Djinn Discard (B)": { "Juzám Djinn": 4, "Junún Efreet": 3, "Hasran Ogress": 2, "Khabál Ghoul": 2, Oubliette: 2, "Hypnotic Specter": 4, "Black Knight": 4, Terror: 4, "Royal Assassin": 3, Sinkhole: 3, "Mind Twist": 1, "Dark Ritual": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Jet": 1, Swamp: 22 },
  "Arabian Nights · Sandstorm Burn (R)": { "Mijae Djinn": 1, "Ydwen Efreet": 1, "Bird Maiden": 2, "Desert Nomads": 2, "Rukh Egg": 1, Fireball: 3, "Lightning Bolt": 3, Disintegrate: 3, "Hill Giant": 3, "Fire Elemental": 3, "Shivan Dragon": 3, "Dragon Whelp": 3, "Hurloon Minotaur": 3, "Gray Ogre": 2, Fork: 1, "Wheel of Fortune": 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, Mountain: 22 },
  "Arabian Nights · Erhnam Stompy (G)": { "Erhnam Djinn": 4, "Ifh-Bíff Efreet": 4, "Ghazbán Ogre": 4, "Wyluli Wolf": 4, "Desert Twister": 2, "Llanowar Elves": 4, "Birds of Paradise": 4, "Grizzly Bears": 4, "Giant Spider": 3, "War Mammoth": 3, "Craw Wurm": 3, "Ironroot Treefolk": 2, Forest: 19 },
  "Arabian Nights · Djinn Control (U/B)": { "Juzám Djinn": 4, "Serendib Efreet": 4, "Old Man of the Sea": 1, Counterspell: 4, Terror: 4, "Hypnotic Specter": 3, "Black Knight": 3, "Air Elemental": 2, "Prodigal Sorcerer": 3, "Sengir Vampire": 1, "Psionic Blast": 2, "Royal Assassin": 2, "Ancestral Recall": 1, "Mind Twist": 1, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, "Mox Jet": 1, "City of Brass": 4, "Underground Sea": 4, Island: 5, Swamp: 8 },
  "Arabian Nights · Bazaar Artifacts (U)": { "Serendib Efreet": 3, "Flying Carpet": 2, "Dancing Scimitar": 2, "Ebony Horse": 1, "Library of Alexandria": 1, "Brass Man": 1, "Jandor's Saddlebags": 1, Juggernaut: 3, "Obsianus Golem": 2, "Icy Manipulator": 3, "Jayemdae Tome": 2, Counterspell: 4, "Air Elemental": 4, "Mahamoti Djinn": 2, "Prodigal Sorcerer": 3, "Control Magic": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 21 },
  "Antiquities · Artisan Defenders (W)": { "Argivian Blacksmith": 4, "Martyrs of Korlis": 3, "Yotian Soldier": 3, "Circle of Protection: Artifacts": 2, "Reverse Polarity": 1, "Su-Chi": 3, Triskelion: 3, "Savannah Lions": 4, "White Knight": 4, "Benalish Hero": 3, "Pearled Unicorn": 3, "Northern Paladin": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, Plains: 21 },
  "Antiquities · Monolith Reactor (U)": { "Power Artifact": 4, "Basalt Monolith": 4, Braingeyser: 1, "Sage of Lat-Nam": 4, "Transmute Artifact": 3, Counterspell: 4, "Air Elemental": 4, "Prodigal Sorcerer": 4, "Mahamoti Djinn": 2, Unsummon: 3, "Psionic Blast": 2, "Control Magic": 2, "Water Elemental": 2, "Sol Ring": 1, "Black Lotus": 1, Island: 19 },
  "Antiquities · Phyrexian Rack (B)": { "Yawgmoth Demon": 4, "Priest of Yawgmoth": 3, "Phyrexian Gremlins": 2, "Xenic Poltergeist": 2, "The Rack": 3, "Hypnotic Specter": 4, "Black Knight": 4, Terror: 4, "Royal Assassin": 3, Sinkhole: 3, "Mind Twist": 1, "Demonic Tutor": 1, "Dark Ritual": 4, "Sol Ring": 1, "Black Lotus": 1, "Mox Jet": 1, Swamp: 19 },
  "Antiquities · Artifact Smash (R)": { Atog: 3, "Goblin Artisans": 2, "Dwarven Weaponsmith": 2, Detonate: 3, "Artifact Blast": 2, Shatterstorm: 1, "Orcish Mechanics": 3, "Lightning Bolt": 4, Fireball: 4, Disintegrate: 3, "Hill Giant": 3, "Fire Elemental": 3, "Shivan Dragon": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, Mountain: 21 },
  "Antiquities · Urza Druids (G)": { "Citanul Druid": 4, "Argothian Treefolk": 4, "Argothian Pixies": 4, "Gaea's Avenger": 3, Crumble: 3, Powerleech: 3, "Llanowar Elves": 4, "Birds of Paradise": 3, "Grizzly Bears": 4, "Giant Spider": 3, "War Mammoth": 3, "Craw Wurm": 3, Forest: 19 },
  "Antiquities · Workshop Robots (C)": { "Mishra's Workshop": 4, "Mishra's Factory": 4, "Strip Mine": 4, "Su-Chi": 4, Triskelion: 4, Juggernaut: 3, "Winter Orb": 2, "Mishra's War Machine": 2, "Colossus of Sardia": 2, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, "Black Lotus": 1, "Sol Ring": 1, "Mana Vault": 1, "Icy Manipulator": 3, "Obsianus Golem": 2, "Jayemdae Tome": 2, Counterspell: 4, "Air Elemental": 4, "Mahamoti Djinn": 2, "Prodigal Sorcerer": 3, "Control Magic": 2, Onulet: 1 },
  "Legends · Moat Prison (W)": { Moat: 2, "Land Tax": 2, Kismet: 1, "Keepers of the Faith": 3, "Thunder Spirit": 3, "Tundra Wolves": 3, "Wall of Light": 3, "Amrou Kithkin": 3, "Savannah Lions": 4, "White Knight": 4, "Benalish Hero": 3, "Pearled Unicorn": 3, "Northern Paladin": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, Plains: 20 },
  "Legends · Force Spike Tempo (U)": { "Force Spike": 4, "Mana Drain": 4, "Remove Soul": 3, "Flash Counter": 2, Boomerang: 3, "Azure Drake": 3, "Zephyr Falcon": 3, "Segovian Leviathan": 2, "Time Elemental": 2, Counterspell: 4, "Air Elemental": 3, "Prodigal Sorcerer": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Sapphire": 1, Island: 21 },
  "Legends · Void & Abyss (B)": { "The Abyss": 1, "Nether Void": 1, "Hell Swarm": 1, "Walking Dead": 2, "Wall of Putrid Flesh": 2, Abomination: 2, "Fallen Angel": 2, "Syphon Soul": 3, "Infernal Medusa": 2, "Shimian Night Stalker": 2, "Hypnotic Specter": 4, "Black Knight": 4, Terror: 4, "Royal Assassin": 3, Sinkhole: 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Jet": 1, Swamp: 21 },
  "Legends · Storm Burn (R)": { "Chain Lightning": 4, "Storm World": 1, Backdraft: 2, Pyrotechnics: 2, "Mountain Yeti": 3, "Tempest Efreet": 2, "Crimson Manticore": 3, "Frost Giant": 2, "Aerathi Berserker": 2, "Hyperion Blacksmith": 2, "Lightning Bolt": 4, Fireball: 4, Disintegrate: 2, "Hill Giant": 2, "Sol Ring": 1, "Black Lotus": 1, "Mox Ruby": 1, Mountain: 22 },
  "Legends · Rampage Stompers (G)": { "Craw Giant": 3, "Wolverine Pack": 4, "Moss Monster": 4, "Durkwood Boars": 4, "Elven Riders": 3, "Giant Turtle": 3, "Cat Warriors": 3, "Llanowar Elves": 4, "Birds of Paradise": 3, "Grizzly Bears": 4, "Giant Spider": 3, "War Mammoth": 3, Forest: 19 },
  "Legends · Gruul Legends (R/G)": { "Jerrard of the Closed Fist": 1, "Livonya Silone": 1, "Marhault Elsdragon": 1, Stangg: 1, "Sunastian Falconer": 1, "The Lady of the Mountain": 1, "Tuknir Deathlock": 1, "Llanowar Elves": 4, "Birds of Paradise": 4, "Lightning Bolt": 4, "Giant Growth": 4, "Hill Giant": 4, "Shivan Dragon": 3, Fireball: 3, "War Mammoth": 4, "Grizzly Bears": 4, "City of Brass": 4, Taiga: 4, Mountain: 5, Forest: 6 },
  "Legends · Azorius Legends (W/U)": { "Ayesha Tanaka": 1, "Gosta Dirk": 1, "Hunding Gjornersen": 1, "Jedit Ojanen": 1, "Kasimir the Lone Wolf": 1, "Rasputin Dreamweaver": 1, "Tobias Andrion": 1, "Force Spike": 4, "Mana Drain": 4, Counterspell: 4, "Swords to Plowshares": 4, "Serra Angel": 4, "Wrath of God": 1, "Air Elemental": 2, "Mahamoti Djinn": 1, "White Knight": 3, "Prodigal Sorcerer": 3, "Sol Ring": 1, "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "City of Brass": 4, Tundra: 4, Plains: 5, Island: 6 },
  "Singularity (UBRG)": { "Black Lotus": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, "City of Brass": 4, "Ancestral Recall": 4, "Time Walk": 4, Timetwister: 4, "Wheel of Fortune": 4, "Demonic Tutor": 4, Channel: 4, Fireball: 4, "Power Artifact": 4, "Basalt Monolith": 4 },
  "Pearl Prison (W)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, Plains: 8, Balance: 4, "Swords to Plowshares": 4, Disenchant: 4, Armageddon: 4, Moat: 4, "Serra Angel": 4, "Wrath of God": 4 },
  "Sapphire Reactor (U)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, Island: 8, "Ancestral Recall": 4, "Time Walk": 4, Timetwister: 4, "Mana Drain": 4, "Power Artifact": 4, "Basalt Monolith": 4, Braingeyser: 4 },
  "Jet Void (B)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, Swamp: 8, "Dark Ritual": 4, "Demonic Tutor": 4, "Mind Twist": 4, Sinkhole: 4, "Hypnotic Specter": 4, "Juzám Djinn": 4, "Nether Void": 4 },
  "Ruby Vise (R)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, Mountain: 8, "Wheel of Fortune": 4, "Lightning Bolt": 4, "Chain Lightning": 4, Fork: 4, Fireball: 4, "Black Vise": 4, "Artifact Blast": 4 },
  "Emerald Colossus (G)": { "Black Lotus": 4, "Mox Emerald": 4, "Sol Ring": 4, Forest: 16, Channel: 4, "Concordant Crossroads": 4, Regrowth: 4, "Sylvan Library": 4, Berserk: 4, "Erhnam Djinn": 4, "Colossus of Sardia": 4, Crumble: 4 },
  "Workshop Zero (C)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, "Mishra's Workshop": 4, "Mishra's Factory": 4, "Strip Mine": 4, Juggernaut: 4, "Su-Chi": 4, Triskelion: 4, "Winter Orb": 4, "Relic Barrier": 4, "Icy Manipulator": 4 },
  "Balanced Reactor (W/U)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, Tundra: 4, "City of Brass": 4, "Ancestral Recall": 4, "Time Walk": 4, Timetwister: 4, Balance: 4, "Power Artifact": 4, "Basalt Monolith": 4, Braingeyser: 4 },
  "Abyssal Reactor (U/B)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, "Underground Sea": 4, "City of Brass": 4, "Ancestral Recall": 4, "Time Walk": 4, Timetwister: 4, "Demonic Tutor": 4, "Power Artifact": 4, "Basalt Monolith": 4, Braingeyser: 4 },
  "Basalt Fire (U/R)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, "Volcanic Island": 4, "City of Brass": 4, "Ancestral Recall": 4, "Time Walk": 4, Timetwister: 4, "Wheel of Fortune": 4, "Power Artifact": 4, "Basalt Monolith": 4, Fireball: 4 },
  "Regrowth Reactor (U/G)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, "Tropical Island": 4, "City of Brass": 4, "Ancestral Recall": 4, "Time Walk": 4, Timetwister: 4, Regrowth: 4, "Power Artifact": 4, "Basalt Monolith": 4, Braingeyser: 4 },
  "Void Balance (W/B)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, Scrubland: 4, "City of Brass": 4, Balance: 4, "Swords to Plowshares": 4, Disenchant: 4, "Demonic Tutor": 4, "Mind Twist": 4, "Nether Void": 4, "The Rack": 4 },
  "Sunfire Balance (W/R)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, Plateau: 4, "City of Brass": 4, Balance: 4, "Swords to Plowshares": 4, "Wheel of Fortune": 4, "Lightning Bolt": 4, "Chain Lightning": 4, Fork: 4, "Black Vise": 4 },
  "Erhnamgeddon Unbound (W/G)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, Savannah: 4, "City of Brass": 4, Balance: 4, "Swords to Plowshares": 4, Armageddon: 4, Regrowth: 4, "Sylvan Library": 4, "Erhnam Djinn": 4, Berserk: 4 },
  "Demonic Wheel (B/R)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, Badlands: 4, "City of Brass": 4, "Demonic Tutor": 4, "Mind Twist": 4, "Wheel of Fortune": 4, "Lightning Bolt": 4, "Chain Lightning": 4, Fork: 4, "Juzám Djinn": 4 },
  "Bayou Twist (B/G)": { "Black Lotus": 4, "Mox Jet": 4, "Mox Emerald": 4, "Sol Ring": 4, Bayou: 4, Swamp: 6, Forest: 6, "Dark Ritual": 4, "Demonic Tutor": 4, "Mind Twist": 4, Sinkhole: 4, Regrowth: 4, "Erhnam Djinn": 4, "Juzám Djinn": 4 },
  "Channel Firestorm (R/G)": { "Black Lotus": 4, "Mox Pearl": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, Taiga: 4, Forest: 4, Channel: 4, Fireball: 4, "Wheel of Fortune": 4, Regrowth: 4, "Lightning Bolt": 4, "Chain Lightning": 4, Fork: 4 },
  "Turbo Twister / Channel (Power)": { "Black Lotus": 4, "Mox Sapphire": 4, "Mox Jet": 4, "Mox Ruby": 4, "Mox Emerald": 4, "Mox Pearl": 4, "Sol Ring": 4, "Ancestral Recall": 4, "Time Walk": 4, Timetwister: 4, "Wheel of Fortune": 4, "Demonic Tutor": 4, Balance: 4, Channel: 4, Fireball: 4 },
  "Singularity (UBRG) [Restricted]": { "Black Lotus": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, "City of Brass": 4, "Ancestral Recall": 1, "Time Walk": 1, Timetwister: 1, "Wheel of Fortune": 1, "Demonic Tutor": 1, Channel: 1, Fireball: 4, "Power Artifact": 4, "Basalt Monolith": 4, Island: 8, Swamp: 1, Mountain: 3, Forest: 1, "Icy Manipulator": 2, "Mana Drain": 2, "Hypnotic Specter": 2, "Lightning Bolt": 2, Regrowth: 2, Juggernaut: 2, Counterspell: 2, Terror: 2, "Chain Lightning": 2, "Sylvan Library": 2 },
  "Pearl Prison (W) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, Plains: 17, Balance: 1, "Swords to Plowshares": 4, Disenchant: 4, Armageddon: 4, Moat: 4, "Serra Angel": 4, "Wrath of God": 4, "Icy Manipulator": 2, Juggernaut: 2, "Su-Chi": 2, Triskelion: 2, "Jayemdae Tome": 2, "Obsianus Golem": 2 },
  "Sapphire Reactor (U) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, Island: 17, "Ancestral Recall": 1, "Time Walk": 1, Timetwister: 1, "Mana Drain": 4, "Power Artifact": 4, "Basalt Monolith": 4, Braingeyser: 1, "Icy Manipulator": 2, Juggernaut: 2, Counterspell: 2, "Su-Chi": 2, "Force Spike": 2, Triskelion: 2, "Mana Short": 2, "Jayemdae Tome": 2, "Control Magic": 2, "Obsianus Golem": 2, "Air Elemental": 1 },
  "Jet Void (B) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, Swamp: 17, "Dark Ritual": 4, "Demonic Tutor": 1, "Mind Twist": 1, Sinkhole: 4, "Hypnotic Specter": 4, "Juzám Djinn": 4, "Nether Void": 4, "Icy Manipulator": 2, Juggernaut: 2, Terror: 2, "Su-Chi": 2, Triskelion: 2, "Jayemdae Tome": 2, "Obsianus Golem": 2, Ornithopter: 1 },
  "Ruby Vise (R) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, Mountain: 17, "Wheel of Fortune": 1, "Lightning Bolt": 4, "Chain Lightning": 4, Fork: 4, Fireball: 4, "Black Vise": 4, "Artifact Blast": 4, "Icy Manipulator": 2, Juggernaut: 2, "Su-Chi": 2, Triskelion: 2, "Jayemdae Tome": 2, "Obsianus Golem": 2 },
  "Emerald Colossus (G) [Restricted]": { "Black Lotus": 1, "Mox Emerald": 1, "Sol Ring": 1, Forest: 20, Channel: 1, "Concordant Crossroads": 4, Regrowth: 4, "Sylvan Library": 4, Berserk: 4, "Erhnam Djinn": 4, "Colossus of Sardia": 4, Crumble: 4, "Icy Manipulator": 2, Juggernaut: 2, "Su-Chi": 2, Triskelion: 2 },
  "Workshop Zero (C) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, "Mishra's Workshop": 4, "Mishra's Factory": 4, "Strip Mine": 4, Juggernaut: 4, "Su-Chi": 4, Triskelion: 4, "Winter Orb": 4, "Relic Barrier": 4, "Icy Manipulator": 4, "Jayemdae Tome": 4, "Obsianus Golem": 2, Ornithopter: 2, "Black Vise": 2, "Disrupting Scepter": 2, "Howling Mine": 2, "Ankh of Mishra": 2, "Crystal Rod": 2 },
  "Balanced Reactor (W/U) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, Tundra: 4, "City of Brass": 4, "Ancestral Recall": 1, "Time Walk": 1, Timetwister: 1, Balance: 1, "Power Artifact": 4, "Basalt Monolith": 4, Braingeyser: 1, Plains: 1, Island: 8, "Icy Manipulator": 2, "Swords to Plowshares": 2, "Mana Drain": 2, Juggernaut: 2, "Wrath of God": 2, Counterspell: 2, "Su-Chi": 2, Disenchant: 2, "Force Spike": 2, Triskelion: 2, "Serra Angel": 2, "Mana Short": 2 },
  "Abyssal Reactor (U/B) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, "Underground Sea": 4, "City of Brass": 4, "Ancestral Recall": 1, "Time Walk": 1, Timetwister: 1, "Demonic Tutor": 1, "Power Artifact": 4, "Basalt Monolith": 4, Braingeyser: 1, Island: 8, Swamp: 1, "Icy Manipulator": 2, "Mana Drain": 2, "Hypnotic Specter": 2, Juggernaut: 2, Counterspell: 2, Terror: 2, "Su-Chi": 2, "Force Spike": 2, Sinkhole: 2, Triskelion: 2, "Mana Short": 2, "Dark Ritual": 2 },
  "Basalt Fire (U/R) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, "Volcanic Island": 4, "City of Brass": 4, "Ancestral Recall": 1, "Time Walk": 1, Timetwister: 1, "Wheel of Fortune": 1, "Power Artifact": 4, "Basalt Monolith": 4, Fireball: 4, Island: 6, Mountain: 3, "Icy Manipulator": 2, "Mana Drain": 2, "Lightning Bolt": 2, Juggernaut: 2, Counterspell: 2, "Chain Lightning": 2, "Su-Chi": 2, "Force Spike": 2, Triskelion: 2, "Mana Short": 2, Fork: 1 },
  "Regrowth Reactor (U/G) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, "Tropical Island": 4, "City of Brass": 4, "Ancestral Recall": 1, "Time Walk": 1, Timetwister: 1, Regrowth: 4, "Power Artifact": 4, "Basalt Monolith": 4, Braingeyser: 1, Island: 7, Forest: 2, "Icy Manipulator": 2, "Mana Drain": 2, Juggernaut: 2, Counterspell: 2, "Sylvan Library": 2, "Su-Chi": 2, "Force Spike": 2, "Erhnam Djinn": 2, Triskelion: 2, "Mana Short": 2, Berserk: 1 },
  "Void Balance (W/B) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, Scrubland: 4, "City of Brass": 4, Balance: 1, "Swords to Plowshares": 4, Disenchant: 4, "Demonic Tutor": 1, "Mind Twist": 1, "Nether Void": 4, "The Rack": 4, Plains: 5, Swamp: 4, "Icy Manipulator": 2, "Hypnotic Specter": 2, Juggernaut: 2, "Wrath of God": 2, Terror: 2, "Su-Chi": 2, Sinkhole: 2, Triskelion: 2, "Serra Angel": 2 },
  "Sunfire Balance (W/R) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, Plateau: 4, "City of Brass": 4, Balance: 1, "Swords to Plowshares": 4, "Wheel of Fortune": 1, "Lightning Bolt": 4, "Chain Lightning": 4, Fork: 4, "Black Vise": 4, Plains: 2, Mountain: 7, "Icy Manipulator": 2, Juggernaut: 2, "Wrath of God": 2, "Su-Chi": 2, Disenchant: 2, Fireball: 2, Triskelion: 2, "Serra Angel": 1 },
  "Erhnamgeddon Unbound (W/G) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, Savannah: 4, "City of Brass": 4, Balance: 1, "Swords to Plowshares": 4, Armageddon: 4, Regrowth: 4, "Sylvan Library": 4, "Erhnam Djinn": 4, Berserk: 4, Plains: 3, Forest: 6, "Icy Manipulator": 2, Juggernaut: 2, "Wrath of God": 2, "Su-Chi": 2, Disenchant: 2, Triskelion: 2 },
  "Demonic Wheel (B/R) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, Badlands: 4, "City of Brass": 4, "Demonic Tutor": 1, "Mind Twist": 1, "Wheel of Fortune": 1, "Lightning Bolt": 4, "Chain Lightning": 4, Fork: 4, "Juzám Djinn": 4, Swamp: 3, Mountain: 6, "Icy Manipulator": 2, "Hypnotic Specter": 2, Juggernaut: 2, Terror: 2, "Su-Chi": 2, Sinkhole: 2, Fireball: 2, Triskelion: 2, "Dark Ritual": 2 },
  "Bayou Twist (B/G) [Restricted]": { "Black Lotus": 1, "Mox Jet": 1, "Mox Emerald": 1, "Sol Ring": 1, Bayou: 4, Swamp: 6, Forest: 6, "Dark Ritual": 4, "Demonic Tutor": 1, "Mind Twist": 1, Sinkhole: 4, Regrowth: 4, "Erhnam Djinn": 4, "Juzám Djinn": 4, "City of Brass": 3, "Icy Manipulator": 2, "Hypnotic Specter": 2, Juggernaut: 2, Terror: 2, "Sylvan Library": 2, "Su-Chi": 2, Triskelion: 2, Berserk: 1 },
  "Channel Firestorm (R/G) [Restricted]": { "Black Lotus": 1, "Mox Pearl": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, Taiga: 4, Forest: 5, Channel: 1, Fireball: 4, "Wheel of Fortune": 1, Regrowth: 4, "Lightning Bolt": 4, "Chain Lightning": 4, Fork: 4, "City of Brass": 4, Mountain: 4, "Icy Manipulator": 2, Juggernaut: 2, "Sylvan Library": 2, "Su-Chi": 2, "Erhnam Djinn": 2, Triskelion: 2, Berserk: 2, "Jayemdae Tome": 1 },
  "Turbo Twister / Channel (Power) [Restricted]": { "Black Lotus": 1, "Mox Sapphire": 1, "Mox Jet": 1, "Mox Ruby": 1, "Mox Emerald": 1, "Mox Pearl": 1, "Sol Ring": 1, "Ancestral Recall": 1, "Time Walk": 1, Timetwister: 1, "Wheel of Fortune": 1, "Demonic Tutor": 1, Balance: 1, Channel: 1, Fireball: 4, "City of Brass": 4, Plains: 1, Island: 3, Swamp: 1, Mountain: 5, Forest: 3, "Icy Manipulator": 2, "Swords to Plowshares": 2, "Mana Drain": 2, "Hypnotic Specter": 2, "Lightning Bolt": 2, Regrowth: 2, Juggernaut: 2, "Wrath of God": 2, Counterspell: 2, Terror: 2, "Chain Lightning": 2, "Sylvan Library": 2, "Su-Chi": 1 },
};
export const DECK_META = {
  "White Weenie (W)": { name: "White Weenie (W)", colors: ["W"], archetype: "aggro", blurb: "Cheap white creatures and Swords to Plowshares try to win before anything big lands.", aiLevelHint: "normal", rating: 34, pool: "classic" },
  "Blue Skies (U)": { name: "Blue Skies (U)", colors: ["U"], archetype: "tempo", blurb: "Flyers and Counterspell: bounce, counter, and fly over the top.", aiLevelHint: "hard", rating: 60, pool: "classic" },
  "Black Shadows (B)": { name: "Black Shadows (B)", colors: ["B"], archetype: "midrange", blurb: "Hypnotic Specter, Black Knight and Terror grind the opponent down in the dark.", aiLevelHint: "normal", rating: 53, pool: "classic" },
  "Red Burn (R)": { name: "Red Burn (R)", colors: ["R"], archetype: "burn", blurb: "Lightning Bolt and fat red bodies, aimed at the face when it is lethal.", aiLevelHint: "normal", rating: 53, pool: "classic" },
  "Green Stompy (G)": { name: "Green Stompy (G)", colors: ["G"], archetype: "stompy", blurb: "Mana elves into oversized green creatures backed by Giant Growth.", aiLevelHint: "normal", rating: 37, pool: "classic" },
  "Fire & Light (R/W)": { name: "Fire & Light (R/W)", colors: ["R","W"], archetype: "midrange", blurb: "Bolt and Swords clear the way for Serra Angel and Shivan Dragon.", aiLevelHint: "normal", rating: 56, pool: "classic" },
  "Tides & Shadows (U/B)": { name: "Tides & Shadows (U/B)", colors: ["U","B"], archetype: "control", blurb: "Counterspell, Terror and Prodigal Sorcerer control the board while Specters bite.", aiLevelHint: "hard", rating: 61, pool: "classic" },
  "Wild Growth (G/R)": { name: "Wild Growth (G/R)", colors: ["G","R"], archetype: "ramp", blurb: "Llanowar Elves and Birds of Paradise power out Shivan Dragon and burn.", aiLevelHint: "normal", rating: 41, pool: "classic" },
  "Azorius Control (W/U)": { name: "Azorius Control (W/U)", colors: ["W","U"], archetype: "control", blurb: "Wrath of God, Swords and Counterspell, finished by Serra Angel and Mahamoti Djinn.", aiLevelHint: "hard", rating: 59, pool: "classic" },
  "Rakdos Aggro (B/R)": { name: "Rakdos Aggro (B/R)", colors: ["B","R"], archetype: "aggro", blurb: "Burn, Terror and efficient attackers punish slow hands.", aiLevelHint: "normal", rating: 60, pool: "classic" },
  "Selesnya Rush (G/W)": { name: "Selesnya Rush (G/W)", colors: ["G","W"], archetype: "aggro", blurb: "Green and white beaters rush in with Swords to Plowshares for blockers.", aiLevelHint: "normal", rating: 50, pool: "classic" },
  "Simic Tempo (G/U)": { name: "Simic Tempo (G/U)", colors: ["G","U"], archetype: "tempo", blurb: "Elves ramp into flyers while Counterspell and Unsummon keep the opponent a step behind.", aiLevelHint: "hard", rating: 50, pool: "classic" },
  "Auras & Armor (W/U)": { name: "Auras & Armor (W/U)", colors: ["W","U"], archetype: "auras", blurb: "Holy Strength, Flight and Lance turn one creature into a must-answer threat.", aiLevelHint: "normal", rating: 40, pool: "classic" },
  "Artifact Fire (R)": { name: "Artifact Fire (R)", colors: ["R"], archetype: "artifacts", blurb: "Juggernaut, Icy Manipulator and big X burn spells.", aiLevelHint: "normal", rating: 46, pool: "classic" },
  "Fireball Control (U/R)": { name: "Fireball Control (U/R)", colors: ["U","R"], archetype: "control", blurb: "Fireball, Disintegrate and Counterspell: answer everything, then burn the opponent out.", aiLevelHint: "hard", rating: 52, pool: "classic" },
  "Black Control (W/B)": { name: "Black Control (W/B)", colors: ["W","B"], archetype: "midrange", blurb: "Knights of both colours backed by a few removal spells.", aiLevelHint: "normal", rating: 52, pool: "classic" },
  "Auras of Might (G/B)": { name: "Auras of Might (G/B)", colors: ["G","B"], archetype: "auras", blurb: "Unholy Strength, Aspect of Wolf and Regeneration make resilient attackers.", aiLevelHint: "normal", rating: 52, pool: "classic" },
  "Dragon Stompers (R/G)": { name: "Dragon Stompers (R/G)", colors: ["R","G"], archetype: "ramp", blurb: "Rock Hydra, Dragon Whelp and Fireball, fuelled by Llanowar Elves.", aiLevelHint: "normal", rating: 34, pool: "classic" },
  "Bands of Brothers (G/W)": { name: "Bands of Brothers (G/W)", colors: ["G","W"], archetype: "banding", blurb: "Benalish Hero, Mesa Pegasus and Timber Wolves attack in bands and divide damage as they like.", aiLevelHint: "hard", rating: 43, pool: "classic" },
  "Troll Bridge (B/R)": { name: "Troll Bridge (B/R)", colors: ["B","R"], archetype: "regeneration", blurb: "Sedge Troll and Uthden Troll regenerate through combat while burn finishes the job.", aiLevelHint: "hard", rating: 54, pool: "classic" },
  "Time & Tide (U/G)": { name: "Time & Tide (U/G)", colors: ["U","G"], archetype: "extra turns", blurb: "Time Walk, Timetwister and Braingeyser dig deep behind mana elves and counters.", aiLevelHint: "hard", rating: 52, pool: "classic" },
  "Mind Rot (U/B)": { name: "Mind Rot (U/B)", colors: ["U","B"], archetype: "discard", blurb: "Mind Twist and Hypnotic Specter empty the opponent's hand before the creatures arrive.", aiLevelHint: "hard", rating: 61, pool: "classic" },
  "Wrath & Burn (R/W)": { name: "Wrath & Burn (R/W)", colors: ["R","W"], archetype: "control", blurb: "Wrath of God and Armageddon reset the game, Bolt and Serra Angel close it.", aiLevelHint: "hard", rating: 64, pool: "classic" },
  "Artifact Ramp (U)": { name: "Artifact Ramp (U)", colors: ["U"], archetype: "artifact ramp", blurb: "Mana Vault, Sol Ring and Basalt Monolith accelerate Juggernaut and Mahamoti Djinn.", aiLevelHint: "hard", rating: 52, pool: "classic" },
  "Hellfire Legends (B/R)": { name: "Hellfire Legends (B/R)", colors: ["B","R"], archetype: "legends", blurb: "Barktooth Warbeard, Axelrod Gunnarson and friends ride Chain Lightning and Terror into the late game.", aiLevelHint: "hard", rating: 47, pool: "classic" },
  "Gruul Legends (R/G)": { name: "Gruul Legends (R/G)", colors: ["R","G"], archetype: "legends", blurb: "Elves ramp into Jerrard, Stangg and the Lady of the Mountain, with Chain Lightning for reach.", aiLevelHint: "hard", rating: 44, pool: "classic" },
  "Selesnya Legends (G/W)": { name: "Selesnya Legends (G/W)", colors: ["G","W"], archetype: "legends", blurb: "Gabriel Angelfire, Jasmine Boreal and Lord Magnus lead green-white beaters with Swords on call.", aiLevelHint: "normal", rating: 51, pool: "classic" },
  "Azorius Legends (W/U)": { name: "Azorius Legends (W/U)", colors: ["W","U"], archetype: "legends", blurb: "Counterspell and Force Spike protect Gosta Dirk, Kasimir and Jedit Ojanen.", aiLevelHint: "hard", rating: 61, pool: "classic" },
  "Dimir Legends (U/B)": { name: "Dimir Legends (U/B)", colors: ["U","B"], archetype: "legends", blurb: "Ur-Drago, Ramses Overdark and Nebuchadnezzar behind counters and Terror.", aiLevelHint: "hard", rating: 49, pool: "classic" },
  "Moat Prison (W)": { name: "Moat Prison (W)", colors: ["W"], archetype: "prison", blurb: "Moat keeps the ground shut while Land Tax, Wrath of God and flyers do the work.", aiLevelHint: "hard", rating: 39, pool: "classic" },
  "Force Spike Tempo (U)": { name: "Force Spike Tempo (U)", colors: ["U"], archetype: "tempo", blurb: "Force Spike, Remove Soul and Boomerang tax every play while small flyers peck.", aiLevelHint: "hard", rating: 52, pool: "classic" },
  "Abyss Artifacts (B)": { name: "Abyss Artifacts (B)", colors: ["B"], archetype: "prison", blurb: "The Abyss and Nether Void punish creature decks, while artifact creatures dodge the Abyss.", aiLevelHint: "hard", rating: 54, pool: "classic" },
  "Storm Burn (R)": { name: "Storm Burn (R)", colors: ["R"], archetype: "burn", blurb: "Chain Lightning, Bolt and Storm World punish slow hands; rampage giants finish.", aiLevelHint: "normal", rating: 43, pool: "classic" },
  "Rampage Stompers (G)": { name: "Rampage Stompers (G)", colors: ["G"], archetype: "stompy", blurb: "Wolverine Pack and Craw Giant trample over chump blockers with rampage.", aiLevelHint: "normal", rating: 40, pool: "classic" },
  "Esper Elders (W/U/B)": { name: "Esper Elders (W/U/B)", colors: ["W","U","B"], archetype: "elder dragon", blurb: "Chromium and friends on a Tundra, Scrubland and Underground Sea mana base.", aiLevelHint: "hard", rating: 56, pool: "classic" },
  "Alpha · White Weenie (W)": { name: "Alpha · White Weenie (W)", colors: ["W"], archetype: "aggro", blurb: "Cheap efficient creatures and removal try to end the game before the opponent stabilises. Built only from Alpha (and older) cards.", aiLevelHint: "normal", rating: 63, pool: "era", edition: "LEA", keyCards: ["Savannah Lions","White Knight","Benalish Hero"] },
  "Alpha · Blue Control (U)": { name: "Alpha · Blue Control (U)", colors: ["U"], archetype: "control", blurb: "Counterspells, removal and a few big finishers keep the board under control. Built only from Alpha (and older) cards.", aiLevelHint: "hard", rating: 48, pool: "era", edition: "LEA", keyCards: ["Counterspell","Air Elemental","Prodigal Sorcerer"] },
  "Alpha · Black Discard (B)": { name: "Alpha · Black Discard (B)", colors: ["B"], archetype: "discard", blurb: "Discard and removal grind the opponent down while a handful of creatures close the game. Built only from Alpha (and older) cards.", aiLevelHint: "hard", rating: 50, pool: "era", edition: "LEA", keyCards: ["Hypnotic Specter","Black Knight","Terror"] },
  "Alpha · Red Burn (R)": { name: "Alpha · Red Burn (R)", colors: ["R"], archetype: "burn", blurb: "Burn spells clear the way and finish the game from hand. Built only from Alpha (and older) cards.", aiLevelHint: "normal", rating: 60, pool: "era", edition: "LEA", keyCards: ["Lightning Bolt","Fireball","Disintegrate"] },
  "Alpha · Green Stompy (G)": { name: "Alpha · Green Stompy (G)", colors: ["G"], archetype: "stompy", blurb: "Mana creatures into oversized green beasts, with Giant Growth as a trick. Built only from Alpha (and older) cards.", aiLevelHint: "normal", rating: 33, pool: "era", edition: "LEA", keyCards: ["Llanowar Elves","Birds of Paradise","Grizzly Bears"] },
  "Alpha · Fire & Light (R/W)": { name: "Alpha · Fire & Light (R/W)", colors: ["R","W"], archetype: "midrange", blurb: "A balanced mix of creatures and removal with a few powerful finishers. Built only from Alpha (and older) cards.", aiLevelHint: "normal", rating: 69, pool: "era", edition: "LEA", keyCards: ["Savannah Lions","White Knight","Serra Angel"] },
  "Alpha · Artifact Control (U)": { name: "Alpha · Artifact Control (U)", colors: ["U"], archetype: "artifacts", blurb: "Artifacts do the heavy lifting while a few spells protect them. Built only from Alpha (and older) cards.", aiLevelHint: "hard", rating: 52, pool: "era", edition: "LEA", keyCards: ["Juggernaut","Obsianus Golem","Icy Manipulator"] },
  "Beta · White Weenie (W)": { name: "Beta · White Weenie (W)", colors: ["W"], archetype: "aggro", blurb: "Cheap efficient creatures and removal try to end the game before the opponent stabilises. Built only from Beta (and older) cards.", aiLevelHint: "normal", rating: 62, pool: "era", edition: "LEB", keyCards: ["Savannah Lions","White Knight","Benalish Hero"] },
  "Beta · Blue Control (U)": { name: "Beta · Blue Control (U)", colors: ["U"], archetype: "control", blurb: "Counterspells, removal and a few big finishers keep the board under control. Built only from Beta (and older) cards.", aiLevelHint: "hard", rating: 48, pool: "era", edition: "LEB", keyCards: ["Counterspell","Air Elemental","Prodigal Sorcerer"] },
  "Beta · Black Discard (B)": { name: "Beta · Black Discard (B)", colors: ["B"], archetype: "discard", blurb: "Discard and removal grind the opponent down while a handful of creatures close the game. Built only from Beta (and older) cards.", aiLevelHint: "hard", rating: 49, pool: "era", edition: "LEB", keyCards: ["Hypnotic Specter","Black Knight","Terror"] },
  "Beta · Red Burn (R)": { name: "Beta · Red Burn (R)", colors: ["R"], archetype: "burn", blurb: "Burn spells clear the way and finish the game from hand. Built only from Beta (and older) cards.", aiLevelHint: "normal", rating: 59, pool: "era", edition: "LEB", keyCards: ["Lightning Bolt","Fireball","Disintegrate"] },
  "Beta · Green Stompy (G)": { name: "Beta · Green Stompy (G)", colors: ["G"], archetype: "stompy", blurb: "Mana creatures into oversized green beasts, with Giant Growth as a trick. Built only from Beta (and older) cards.", aiLevelHint: "normal", rating: 39, pool: "era", edition: "LEB", keyCards: ["Llanowar Elves","Birds of Paradise","Grizzly Bears"] },
  "Beta · Fireball Control (U/R)": { name: "Beta · Fireball Control (U/R)", colors: ["U","R"], archetype: "control", blurb: "Counterspells, removal and a few big finishers keep the board under control. Volcanic Island is the Beta dual land.", aiLevelHint: "hard", rating: 67, pool: "era", edition: "LEB", keyCards: ["Prodigal Sorcerer","Air Elemental","Counterspell"] },
  "Beta · Artifact Control (U)": { name: "Beta · Artifact Control (U)", colors: ["U"], archetype: "artifacts", blurb: "Artifacts do the heavy lifting while a few spells protect them. Built only from Beta (and older) cards.", aiLevelHint: "hard", rating: 50, pool: "era", edition: "LEB", keyCards: ["Juggernaut","Obsianus Golem","Icy Manipulator"] },
  "Unlimited · White Weenie (W)": { name: "Unlimited · White Weenie (W)", colors: ["W"], archetype: "aggro", blurb: "Cheap efficient creatures and removal try to end the game before the opponent stabilises. Built only from Unlimited (and older) cards.", aiLevelHint: "normal", rating: 59, pool: "era", edition: "2ED", keyCards: ["Savannah Lions","White Knight","Benalish Hero"] },
  "Unlimited · Blue Control (U)": { name: "Unlimited · Blue Control (U)", colors: ["U"], archetype: "control", blurb: "Counterspells, removal and a few big finishers keep the board under control. Built only from Unlimited (and older) cards.", aiLevelHint: "hard", rating: 55, pool: "era", edition: "2ED", keyCards: ["Counterspell","Air Elemental","Prodigal Sorcerer"] },
  "Unlimited · Black Discard (B)": { name: "Unlimited · Black Discard (B)", colors: ["B"], archetype: "discard", blurb: "Discard and removal grind the opponent down while a handful of creatures close the game. Built only from Unlimited (and older) cards.", aiLevelHint: "hard", rating: 52, pool: "era", edition: "2ED", keyCards: ["Hypnotic Specter","Black Knight","Terror"] },
  "Unlimited · Red Burn (R)": { name: "Unlimited · Red Burn (R)", colors: ["R"], archetype: "burn", blurb: "Burn spells clear the way and finish the game from hand. Built only from Unlimited (and older) cards.", aiLevelHint: "normal", rating: 61, pool: "era", edition: "2ED", keyCards: ["Lightning Bolt","Fireball","Disintegrate"] },
  "Unlimited · Green Stompy (G)": { name: "Unlimited · Green Stompy (G)", colors: ["G"], archetype: "stompy", blurb: "Mana creatures into oversized green beasts, with Giant Growth as a trick. Built only from Unlimited (and older) cards.", aiLevelHint: "normal", rating: 37, pool: "era", edition: "2ED", keyCards: ["Llanowar Elves","Birds of Paradise","Grizzly Bears"] },
  "Unlimited · Tides & Shadows (U/B)": { name: "Unlimited · Tides & Shadows (U/B)", colors: ["U","B"], archetype: "control", blurb: "Counterspells, removal and a few big finishers keep the board under control. Built only from Unlimited (and older) cards.", aiLevelHint: "hard", rating: 61, pool: "era", edition: "2ED", keyCards: ["Counterspell","Terror","Hypnotic Specter"] },
  "Unlimited · Artifact Control (U)": { name: "Unlimited · Artifact Control (U)", colors: ["U"], archetype: "artifacts", blurb: "Artifacts do the heavy lifting while a few spells protect them. Built only from Unlimited (and older) cards.", aiLevelHint: "hard", rating: 47, pool: "era", edition: "2ED", keyCards: ["Juggernaut","Obsianus Golem","Icy Manipulator"] },
  "Arabian Nights · Desert Cavalry (W)": { name: "Arabian Nights · Desert Cavalry (W)", colors: ["W"], archetype: "aggro", blurb: "Cheap efficient creatures and removal try to end the game before the opponent stabilises. Showcases Arabian Nights cards such as Moorish Cavalry, War Elephant, Army of Allah.", aiLevelHint: "normal", rating: 46, pool: "era", edition: "ARN", keyCards: ["Moorish Cavalry","War Elephant","King Suleiman"] },
  "Arabian Nights · Sea & Sand Tempo (U)": { name: "Arabian Nights · Sea & Sand Tempo (U)", colors: ["U"], archetype: "control", blurb: "Counterspells, removal and a few big finishers keep the board under control. Showcases Arabian Nights cards such as Serendib Efreet, Flying Men, Old Man of the Sea.", aiLevelHint: "hard", rating: 60, pool: "era", edition: "ARN", keyCards: ["Serendib Efreet","Old Man of the Sea","Counterspell"] },
  "Arabian Nights · Djinn Discard (B)": { name: "Arabian Nights · Djinn Discard (B)", colors: ["B"], archetype: "discard", blurb: "Discard and removal grind the opponent down while a handful of creatures close the game. Showcases Arabian Nights cards such as Juzám Djinn, Junún Efreet, Hasran Ogress.", aiLevelHint: "hard", rating: 53, pool: "era", edition: "ARN", keyCards: ["Juzám Djinn","Junún Efreet","Hypnotic Specter"] },
  "Arabian Nights · Sandstorm Burn (R)": { name: "Arabian Nights · Sandstorm Burn (R)", colors: ["R"], archetype: "burn", blurb: "Burn spells clear the way and finish the game from hand. Showcases Arabian Nights cards such as Mijae Djinn, Ydwen Efreet, Bird Maiden.", aiLevelHint: "normal", rating: 64, pool: "era", edition: "ARN", keyCards: ["Mijae Djinn","Ydwen Efreet","Lightning Bolt"] },
  "Arabian Nights · Erhnam Stompy (G)": { name: "Arabian Nights · Erhnam Stompy (G)", colors: ["G"], archetype: "stompy", blurb: "Mana creatures into oversized green beasts, with Giant Growth as a trick. Showcases Arabian Nights cards such as Erhnam Djinn, Ifh-Bíff Efreet, Ghazbán Ogre.", aiLevelHint: "normal", rating: 51, pool: "era", edition: "ARN", keyCards: ["Erhnam Djinn","Ifh-Bíff Efreet","Giant Growth"] },
  "Arabian Nights · Djinn Control (U/B)": { name: "Arabian Nights · Djinn Control (U/B)", colors: ["U","B"], archetype: "control", blurb: "Counterspells, removal and a few big finishers keep the board under control. Showcases Arabian Nights cards such as Juzám Djinn, Serendib Efreet, Old Man of the Sea.", aiLevelHint: "hard", rating: 64, pool: "era", edition: "ARN", keyCards: ["Juzám Djinn","Serendib Efreet","Counterspell"] },
  "Arabian Nights · Bazaar Artifacts (U)": { name: "Arabian Nights · Bazaar Artifacts (U)", colors: ["U"], archetype: "artifacts", blurb: "Artifacts do the heavy lifting while a few spells protect them. Showcases Arabian Nights cards such as Serendib Efreet, Flying Carpet, Dancing Scimitar.", aiLevelHint: "hard", rating: 42, pool: "era", edition: "ARN", keyCards: ["Flying Carpet","Dancing Scimitar","Ebony Horse"] },
  "Antiquities · Artisan Defenders (W)": { name: "Antiquities · Artisan Defenders (W)", colors: ["W"], archetype: "aggro", blurb: "Cheap efficient creatures and removal try to end the game before the opponent stabilises. Showcases Antiquities cards such as Argivian Blacksmith, Martyrs of Korlis, Yotian Soldier.", aiLevelHint: "normal", rating: 40, pool: "era", edition: "ATQ", keyCards: ["Martyrs of Korlis","Su-Chi","Triskelion"] },
  "Antiquities · Monolith Reactor (U)": { name: "Antiquities · Monolith Reactor (U)", colors: ["U"], archetype: "control", blurb: "Counterspells, removal and a few big finishers keep the board under control. Showcases Antiquities cards such as Power Artifact, Basalt Monolith, Braingeyser.", aiLevelHint: "hard", rating: 28, pool: "era", edition: "ATQ", keyCards: ["Power Artifact","Basalt Monolith","Braingeyser"] },
  "Antiquities · Phyrexian Rack (B)": { name: "Antiquities · Phyrexian Rack (B)", colors: ["B"], archetype: "discard", blurb: "Discard and removal grind the opponent down while a handful of creatures close the game. Showcases Antiquities cards such as Yawgmoth Demon, Priest of Yawgmoth, Phyrexian Gremlins.", aiLevelHint: "hard", rating: 46, pool: "era", edition: "ATQ", keyCards: ["Yawgmoth Demon","The Rack","Priest of Yawgmoth"] },
  "Antiquities · Artifact Smash (R)": { name: "Antiquities · Artifact Smash (R)", colors: ["R"], archetype: "burn", blurb: "Burn spells clear the way and finish the game from hand. Showcases Antiquities cards such as Atog, Goblin Artisans, Dwarven Weaponsmith.", aiLevelHint: "normal", rating: 46, pool: "era", edition: "ATQ", keyCards: ["Atog","Detonate","Lightning Bolt"] },
  "Antiquities · Urza Druids (G)": { name: "Antiquities · Urza Druids (G)", colors: ["G"], archetype: "stompy", blurb: "Mana creatures into oversized green beasts, with Giant Growth as a trick. Showcases Antiquities cards such as Citanul Druid, Argothian Treefolk, Argothian Pixies.", aiLevelHint: "normal", rating: 25, pool: "era", edition: "ATQ", keyCards: ["Argothian Treefolk","Citanul Druid","Giant Growth"] },
  "Antiquities · Workshop Robots (C)": { name: "Antiquities · Workshop Robots (C)", colors: [], archetype: "artifacts", blurb: "Artifacts do the heavy lifting while a few spells protect them. Showcases Antiquities cards such as Mishra's Workshop, Mishra's Factory, Strip Mine.", aiLevelHint: "hard", rating: 42, pool: "era", edition: "ATQ", keyCards: ["Mishra's Workshop","Mishra's Factory","Su-Chi"] },
  "Legends · Moat Prison (W)": { name: "Legends · Moat Prison (W)", colors: ["W"], archetype: "aggro", blurb: "Cheap efficient creatures and removal try to end the game before the opponent stabilises. Showcases Legends cards such as Moat, Land Tax, Kismet.", aiLevelHint: "normal", rating: 41, pool: "era", edition: "LEG", keyCards: ["Moat","Land Tax","Serra Angel"] },
  "Legends · Force Spike Tempo (U)": { name: "Legends · Force Spike Tempo (U)", colors: ["U"], archetype: "control", blurb: "Counterspells, removal and a few big finishers keep the board under control. Showcases Legends cards such as Force Spike, Mana Drain, Remove Soul.", aiLevelHint: "hard", rating: 38, pool: "era", edition: "LEG", keyCards: ["Mana Drain","Force Spike","Segovian Leviathan"] },
  "Legends · Void & Abyss (B)": { name: "Legends · Void & Abyss (B)", colors: ["B"], archetype: "discard", blurb: "Discard and removal grind the opponent down while a handful of creatures close the game. Showcases Legends cards such as The Abyss, Nether Void, Hell Swarm.", aiLevelHint: "hard", rating: 43, pool: "era", edition: "LEG", keyCards: ["Nether Void","The Abyss","Fallen Angel"] },
  "Legends · Storm Burn (R)": { name: "Legends · Storm Burn (R)", colors: ["R"], archetype: "burn", blurb: "Burn spells clear the way and finish the game from hand. Showcases Legends cards such as Chain Lightning, Storm World, Backdraft.", aiLevelHint: "normal", rating: 46, pool: "era", edition: "LEG", keyCards: ["Chain Lightning","Storm World","Frost Giant"] },
  "Legends · Rampage Stompers (G)": { name: "Legends · Rampage Stompers (G)", colors: ["G"], archetype: "stompy", blurb: "Mana creatures into oversized green beasts, with Giant Growth as a trick. Showcases Legends cards such as Craw Giant, Wolverine Pack, Moss Monster.", aiLevelHint: "normal", rating: 45, pool: "era", edition: "LEG", keyCards: ["Wolverine Pack","Craw Giant","Moss Monster"] },
  "Legends · Gruul Legends (R/G)": { name: "Legends · Gruul Legends (R/G)", colors: ["R","G"], archetype: "ramp", blurb: "Mana creatures power out big threats and burn. Showcases Legends cards such as Jerrard of the Closed Fist, Livonya Silone, Marhault Elsdragon.", aiLevelHint: "normal", rating: 48, pool: "era", edition: "LEG", keyCards: ["Jerrard of the Closed Fist","Stangg","The Lady of the Mountain"] },
  "Legends · Azorius Legends (W/U)": { name: "Legends · Azorius Legends (W/U)", colors: ["W","U"], archetype: "control", blurb: "Counterspells, removal and a few big finishers keep the board under control. Showcases Legends cards such as Ayesha Tanaka, Gosta Dirk, Hunding Gjornersen.", aiLevelHint: "hard", rating: 59, pool: "era", edition: "LEG", keyCards: ["Gosta Dirk","Jedit Ojanen","Kasimir the Lone Wolf"] },
  "Singularity (UBRG)": { name: "Singularity (UBRG)", colors: ["U","B","R","G"], archetype: "combo", blurb: "Two kill routes, Channel plus Fireball and Power Artifact plus Basalt Monolith, found by the best draw spells and Demonic Tutor.", aiLevelHint: "hard", rating: 72, pool: "unrestricted", unrestricted: true },
  "Pearl Prison (W)": { name: "Pearl Prison (W)", colors: ["W"], archetype: "prison", blurb: "Moxen into Balance, Moat and Armageddon, closed out by Serra Angel.", aiLevelHint: "hard", rating: 58, pool: "unrestricted", unrestricted: true },
  "Sapphire Reactor (U)": { name: "Sapphire Reactor (U)", colors: ["U"], archetype: "combo", blurb: "Power Artifact and Basalt Monolith make endless mana, Braingeyser turns it into a kill, Mana Drain keeps it safe.", aiLevelHint: "hard", rating: 68, pool: "unrestricted", unrestricted: true },
  "Jet Void (B)": { name: "Jet Void (B)", colors: ["B"], archetype: "discard", blurb: "Mind Twist off fast mana, then Sinkhole and Nether Void while Specter and Juzám Djinn beat down.", aiLevelHint: "hard", rating: 58, pool: "unrestricted", unrestricted: true },
  "Ruby Vise (R)": { name: "Ruby Vise (R)", colors: ["R"], archetype: "burn", blurb: "Turbo burn: Wheel of Fortune refills, Black Vise punishes draws and Artifact Blast hits key artifacts.", aiLevelHint: "hard", rating: 56, pool: "unrestricted", unrestricted: true },
  "Emerald Colossus (G)": { name: "Emerald Colossus (G)", colors: ["G"], archetype: "ramp", blurb: "Channel into Colossus of Sardia or Erhnam Djinn, with Concordant Crossroads and Berserk for sudden kills.", aiLevelHint: "hard", rating: 52, pool: "unrestricted", unrestricted: true },
  "Workshop Zero (C)": { name: "Workshop Zero (C)", colors: [], archetype: "prison", blurb: "Mishra's Workshop and Moxen flood the board with robots under Winter Orb and Strip Mine.", aiLevelHint: "hard", rating: 56, pool: "unrestricted", unrestricted: true },
  "Balanced Reactor (W/U)": { name: "Balanced Reactor (W/U)", colors: ["W","U"], archetype: "combo", blurb: "The Basalt Monolith loop with Balance as a protective reset.", aiLevelHint: "hard", rating: 64, pool: "unrestricted", unrestricted: true },
  "Abyssal Reactor (U/B)": { name: "Abyssal Reactor (U/B)", colors: ["U","B"], archetype: "combo", blurb: "Demonic Tutor makes the Power Artifact, Basalt Monolith and Braingeyser combo extremely consistent.", aiLevelHint: "hard", rating: 68, pool: "unrestricted", unrestricted: true },
  "Basalt Fire (U/R)": { name: "Basalt Fire (U/R)", colors: ["U","R"], archetype: "combo", blurb: "Endless mana from Basalt Monolith, then Fireball for lethal damage.", aiLevelHint: "hard", rating: 67, pool: "unrestricted", unrestricted: true },
  "Regrowth Reactor (U/G)": { name: "Regrowth Reactor (U/G)", colors: ["U","G"], archetype: "combo", blurb: "The blue infinite-mana core with Regrowth to recover any missing piece.", aiLevelHint: "hard", rating: 64, pool: "unrestricted", unrestricted: true },
  "Void Balance (W/B)": { name: "Void Balance (W/B)", colors: ["W","B"], archetype: "prison", blurb: "Balance, Mind Twist and Nether Void strip resources, The Rack punishes empty hands.", aiLevelHint: "hard", rating: 60, pool: "unrestricted", unrestricted: true },
  "Sunfire Balance (W/R)": { name: "Sunfire Balance (W/R)", colors: ["W","R"], archetype: "burn", blurb: "Balance resets the board, Wheel of Fortune and burn finish.", aiLevelHint: "hard", rating: 60, pool: "unrestricted", unrestricted: true },
  "Erhnamgeddon Unbound (W/G)": { name: "Erhnamgeddon Unbound (W/G)", colors: ["W","G"], archetype: "aggro", blurb: "Fast mana puts Erhnam Djinn out early while Balance and Armageddon break the opponent's mana.", aiLevelHint: "hard", rating: 58, pool: "unrestricted", unrestricted: true },
  "Demonic Wheel (B/R)": { name: "Demonic Wheel (B/R)", colors: ["B","R"], archetype: "burn", blurb: "Demonic Tutor finds Mind Twist, Wheel of Fortune or burn, with Juzám Djinn as a clock.", aiLevelHint: "hard", rating: 62, pool: "unrestricted", unrestricted: true },
  "Bayou Twist (B/G)": { name: "Bayou Twist (B/G)", colors: ["B","G"], archetype: "discard", blurb: "Tutor into Mind Twist, then Sinkhole and the Djinns close without any draw-seven.", aiLevelHint: "hard", rating: 52, pool: "unrestricted", unrestricted: true },
  "Channel Firestorm (R/G)": { name: "Channel Firestorm (R/G)", colors: ["R","G"], archetype: "combo", blurb: "Channel plus Fireball is the fastest non-blue kill, with Wheel of Fortune to find the pieces.", aiLevelHint: "hard", rating: 64, pool: "unrestricted", unrestricted: true },
  "Turbo Twister / Channel (Power)": { name: "Turbo Twister / Channel (Power)", colors: ["W","U","B","R","G"], archetype: "combo", blurb: "Unrestricted power: five Moxen, Lotus and Sol Ring into Timetwister, Wheel, Channel and Fireball.", aiLevelHint: "hard", rating: 66, pool: "unrestricted", unrestricted: true },
  "Singularity (UBRG) [Restricted]": { name: "Singularity (UBRG) [Restricted]", colors: ["U","B","R","G"], archetype: "combo", blurb: "Two kill routes, Channel plus Fireball and Power Artifact plus Basalt Monolith, found by the best draw spells and Demonic Tutor. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 68, pool: "restricted", format: "restricted", twinOf: "Singularity (UBRG)" },
  "Pearl Prison (W) [Restricted]": { name: "Pearl Prison (W) [Restricted]", colors: ["W"], archetype: "prison", blurb: "Moxen into Balance, Moat and Armageddon, closed out by Serra Angel. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 54, pool: "restricted", format: "restricted", twinOf: "Pearl Prison (W)" },
  "Sapphire Reactor (U) [Restricted]": { name: "Sapphire Reactor (U) [Restricted]", colors: ["U"], archetype: "combo", blurb: "Power Artifact and Basalt Monolith make endless mana, Braingeyser turns it into a kill, Mana Drain keeps it safe. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 64, pool: "restricted", format: "restricted", twinOf: "Sapphire Reactor (U)" },
  "Jet Void (B) [Restricted]": { name: "Jet Void (B) [Restricted]", colors: ["B"], archetype: "discard", blurb: "Mind Twist off fast mana, then Sinkhole and Nether Void while Specter and Juzám Djinn beat down. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 54, pool: "restricted", format: "restricted", twinOf: "Jet Void (B)" },
  "Ruby Vise (R) [Restricted]": { name: "Ruby Vise (R) [Restricted]", colors: ["R"], archetype: "burn", blurb: "Turbo burn: Wheel of Fortune refills, Black Vise punishes draws and Artifact Blast hits key artifacts. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 52, pool: "restricted", format: "restricted", twinOf: "Ruby Vise (R)" },
  "Emerald Colossus (G) [Restricted]": { name: "Emerald Colossus (G) [Restricted]", colors: ["G"], archetype: "ramp", blurb: "Channel into Colossus of Sardia or Erhnam Djinn, with Concordant Crossroads and Berserk for sudden kills. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 48, pool: "restricted", format: "restricted", twinOf: "Emerald Colossus (G)" },
  "Workshop Zero (C) [Restricted]": { name: "Workshop Zero (C) [Restricted]", colors: [], archetype: "prison", blurb: "Mishra's Workshop and Moxen flood the board with robots under Winter Orb and Strip Mine. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 52, pool: "restricted", format: "restricted", twinOf: "Workshop Zero (C)" },
  "Balanced Reactor (W/U) [Restricted]": { name: "Balanced Reactor (W/U) [Restricted]", colors: ["W","U"], archetype: "combo", blurb: "The Basalt Monolith loop with Balance as a protective reset. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 60, pool: "restricted", format: "restricted", twinOf: "Balanced Reactor (W/U)" },
  "Abyssal Reactor (U/B) [Restricted]": { name: "Abyssal Reactor (U/B) [Restricted]", colors: ["U","B"], archetype: "combo", blurb: "Demonic Tutor makes the Power Artifact, Basalt Monolith and Braingeyser combo extremely consistent. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 64, pool: "restricted", format: "restricted", twinOf: "Abyssal Reactor (U/B)" },
  "Basalt Fire (U/R) [Restricted]": { name: "Basalt Fire (U/R) [Restricted]", colors: ["U","R"], archetype: "combo", blurb: "Endless mana from Basalt Monolith, then Fireball for lethal damage. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 63, pool: "restricted", format: "restricted", twinOf: "Basalt Fire (U/R)" },
  "Regrowth Reactor (U/G) [Restricted]": { name: "Regrowth Reactor (U/G) [Restricted]", colors: ["U","G"], archetype: "combo", blurb: "The blue infinite-mana core with Regrowth to recover any missing piece. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 60, pool: "restricted", format: "restricted", twinOf: "Regrowth Reactor (U/G)" },
  "Void Balance (W/B) [Restricted]": { name: "Void Balance (W/B) [Restricted]", colors: ["W","B"], archetype: "prison", blurb: "Balance, Mind Twist and Nether Void strip resources, The Rack punishes empty hands. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 56, pool: "restricted", format: "restricted", twinOf: "Void Balance (W/B)" },
  "Sunfire Balance (W/R) [Restricted]": { name: "Sunfire Balance (W/R) [Restricted]", colors: ["W","R"], archetype: "burn", blurb: "Balance resets the board, Wheel of Fortune and burn finish. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 56, pool: "restricted", format: "restricted", twinOf: "Sunfire Balance (W/R)" },
  "Erhnamgeddon Unbound (W/G) [Restricted]": { name: "Erhnamgeddon Unbound (W/G) [Restricted]", colors: ["W","G"], archetype: "aggro", blurb: "Fast mana puts Erhnam Djinn out early while Balance and Armageddon break the opponent's mana. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 54, pool: "restricted", format: "restricted", twinOf: "Erhnamgeddon Unbound (W/G)" },
  "Demonic Wheel (B/R) [Restricted]": { name: "Demonic Wheel (B/R) [Restricted]", colors: ["B","R"], archetype: "burn", blurb: "Demonic Tutor finds Mind Twist, Wheel of Fortune or burn, with Juzám Djinn as a clock. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 58, pool: "restricted", format: "restricted", twinOf: "Demonic Wheel (B/R)" },
  "Bayou Twist (B/G) [Restricted]": { name: "Bayou Twist (B/G) [Restricted]", colors: ["B","G"], archetype: "discard", blurb: "Tutor into Mind Twist, then Sinkhole and the Djinns close without any draw-seven. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 48, pool: "restricted", format: "restricted", twinOf: "Bayou Twist (B/G)" },
  "Channel Firestorm (R/G) [Restricted]": { name: "Channel Firestorm (R/G) [Restricted]", colors: ["R","G"], archetype: "combo", blurb: "Channel plus Fireball is the fastest non-blue kill, with Wheel of Fortune to find the pieces. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 60, pool: "restricted", format: "restricted", twinOf: "Channel Firestorm (R/G)" },
  "Turbo Twister / Channel (Power) [Restricted]": { name: "Turbo Twister / Channel (Power) [Restricted]", colors: ["W","U","B","R","G"], archetype: "combo", blurb: "Five Moxen, Lotus and Sol Ring into Timetwister, Wheel, Channel and Fireball. Restricted version: the Power cards and draw engines are cut to one copy each.", aiLevelHint: "hard", rating: 62, pool: "restricted", format: "restricted", twinOf: "Turbo Twister / Channel (Power)" },
};
// old twin names ('<Name> (R)') from saved state -> current names; use resolveDeckName()
export const LEGACY_DECK_NAMES = {
  "Singularity (UBRG) (R)": "Singularity (UBRG) [Restricted]",
  "Pearl Prison (W) (R)": "Pearl Prison (W) [Restricted]",
  "Sapphire Reactor (U) (R)": "Sapphire Reactor (U) [Restricted]",
  "Jet Void (B) (R)": "Jet Void (B) [Restricted]",
  "Ruby Vise (R) (R)": "Ruby Vise (R) [Restricted]",
  "Emerald Colossus (G) (R)": "Emerald Colossus (G) [Restricted]",
  "Workshop Zero (C) (R)": "Workshop Zero (C) [Restricted]",
  "Balanced Reactor (W/U) (R)": "Balanced Reactor (W/U) [Restricted]",
  "Abyssal Reactor (U/B) (R)": "Abyssal Reactor (U/B) [Restricted]",
  "Basalt Fire (U/R) (R)": "Basalt Fire (U/R) [Restricted]",
  "Regrowth Reactor (U/G) (R)": "Regrowth Reactor (U/G) [Restricted]",
  "Void Balance (W/B) (R)": "Void Balance (W/B) [Restricted]",
  "Sunfire Balance (W/R) (R)": "Sunfire Balance (W/R) [Restricted]",
  "Erhnamgeddon Unbound (W/G) (R)": "Erhnamgeddon Unbound (W/G) [Restricted]",
  "Demonic Wheel (B/R) (R)": "Demonic Wheel (B/R) [Restricted]",
  "Bayou Twist (B/G) (R)": "Bayou Twist (B/G) [Restricted]",
  "Channel Firestorm (R/G) (R)": "Channel Firestorm (R/G) [Restricted]",
  "Turbo Twister / Channel (Power) (R)": "Turbo Twister / Channel (Power) [Restricted]",
  "White Weenie (W) [Restricted]": "White Weenie (W)",
  "White Weenie (W) (R)": "White Weenie (W)",
  "Blue Skies (U) [Restricted]": "Blue Skies (U)",
  "Blue Skies (U) (R)": "Blue Skies (U)",
  "Black Shadows (B) [Restricted]": "Black Shadows (B)",
  "Black Shadows (B) (R)": "Black Shadows (B)",
  "Red Burn (R) [Restricted]": "Red Burn (R)",
  "Red Burn (R) (R)": "Red Burn (R)",
  "Green Stompy (G) [Restricted]": "Green Stompy (G)",
  "Green Stompy (G) (R)": "Green Stompy (G)",
  "Fire & Light (R/W) [Restricted]": "Fire & Light (R/W)",
  "Fire & Light (R/W) (R)": "Fire & Light (R/W)",
  "Tides & Shadows (U/B) [Restricted]": "Tides & Shadows (U/B)",
  "Tides & Shadows (U/B) (R)": "Tides & Shadows (U/B)",
  "Wild Growth (G/R) [Restricted]": "Wild Growth (G/R)",
  "Wild Growth (G/R) (R)": "Wild Growth (G/R)",
  "Azorius Control (W/U) [Restricted]": "Azorius Control (W/U)",
  "Azorius Control (W/U) (R)": "Azorius Control (W/U)",
  "Rakdos Aggro (B/R) [Restricted]": "Rakdos Aggro (B/R)",
  "Rakdos Aggro (B/R) (R)": "Rakdos Aggro (B/R)",
  "Selesnya Rush (G/W) [Restricted]": "Selesnya Rush (G/W)",
  "Selesnya Rush (G/W) (R)": "Selesnya Rush (G/W)",
  "Simic Tempo (G/U) [Restricted]": "Simic Tempo (G/U)",
  "Simic Tempo (G/U) (R)": "Simic Tempo (G/U)",
  "Auras & Armor (W/U) [Restricted]": "Auras & Armor (W/U)",
  "Auras & Armor (W/U) (R)": "Auras & Armor (W/U)",
  "Artifact Fire (R) [Restricted]": "Artifact Fire (R)",
  "Artifact Fire (R) (R)": "Artifact Fire (R)",
  "Fireball Control (U/R) [Restricted]": "Fireball Control (U/R)",
  "Fireball Control (U/R) (R)": "Fireball Control (U/R)",
  "Black Control (W/B) [Restricted]": "Black Control (W/B)",
  "Black Control (W/B) (R)": "Black Control (W/B)",
  "Auras of Might (G/B) [Restricted]": "Auras of Might (G/B)",
  "Auras of Might (G/B) (R)": "Auras of Might (G/B)",
  "Dragon Stompers (R/G) [Restricted]": "Dragon Stompers (R/G)",
  "Dragon Stompers (R/G) (R)": "Dragon Stompers (R/G)",
  "Bands of Brothers (G/W) [Restricted]": "Bands of Brothers (G/W)",
  "Bands of Brothers (G/W) (R)": "Bands of Brothers (G/W)",
  "Troll Bridge (B/R) [Restricted]": "Troll Bridge (B/R)",
  "Troll Bridge (B/R) (R)": "Troll Bridge (B/R)",
  "Time & Tide (U/G) [Restricted]": "Time & Tide (U/G)",
  "Time & Tide (U/G) (R)": "Time & Tide (U/G)",
  "Mind Rot (U/B) [Restricted]": "Mind Rot (U/B)",
  "Mind Rot (U/B) (R)": "Mind Rot (U/B)",
  "Wrath & Burn (R/W) [Restricted]": "Wrath & Burn (R/W)",
  "Wrath & Burn (R/W) (R)": "Wrath & Burn (R/W)",
  "Artifact Ramp (U) [Restricted]": "Artifact Ramp (U)",
  "Artifact Ramp (U) (R)": "Artifact Ramp (U)",
  "Hellfire Legends (B/R) [Restricted]": "Hellfire Legends (B/R)",
  "Hellfire Legends (B/R) (R)": "Hellfire Legends (B/R)",
  "Gruul Legends (R/G) [Restricted]": "Gruul Legends (R/G)",
  "Gruul Legends (R/G) (R)": "Gruul Legends (R/G)",
  "Selesnya Legends (G/W) [Restricted]": "Selesnya Legends (G/W)",
  "Selesnya Legends (G/W) (R)": "Selesnya Legends (G/W)",
  "Azorius Legends (W/U) [Restricted]": "Azorius Legends (W/U)",
  "Azorius Legends (W/U) (R)": "Azorius Legends (W/U)",
  "Dimir Legends (U/B) [Restricted]": "Dimir Legends (U/B)",
  "Dimir Legends (U/B) (R)": "Dimir Legends (U/B)",
  "Moat Prison (W) [Restricted]": "Moat Prison (W)",
  "Moat Prison (W) (R)": "Moat Prison (W)",
  "Force Spike Tempo (U) [Restricted]": "Force Spike Tempo (U)",
  "Force Spike Tempo (U) (R)": "Force Spike Tempo (U)",
  "Abyss Artifacts (B) [Restricted]": "Abyss Artifacts (B)",
  "Abyss Artifacts (B) (R)": "Abyss Artifacts (B)",
  "Storm Burn (R) [Restricted]": "Storm Burn (R)",
  "Storm Burn (R) (R)": "Storm Burn (R)",
  "Rampage Stompers (G) [Restricted]": "Rampage Stompers (G)",
  "Rampage Stompers (G) (R)": "Rampage Stompers (G)",
  "Esper Elders (W/U/B) [Restricted]": "Esper Elders (W/U/B)",
  "Esper Elders (W/U/B) (R)": "Esper Elders (W/U/B)",
  "Alpha · White Weenie (W) [Restricted]": "Alpha · White Weenie (W)",
  "Alpha · White Weenie (W) (R)": "Alpha · White Weenie (W)",
  "Alpha · Blue Control (U) [Restricted]": "Alpha · Blue Control (U)",
  "Alpha · Blue Control (U) (R)": "Alpha · Blue Control (U)",
  "Alpha · Black Discard (B) [Restricted]": "Alpha · Black Discard (B)",
  "Alpha · Black Discard (B) (R)": "Alpha · Black Discard (B)",
  "Alpha · Red Burn (R) [Restricted]": "Alpha · Red Burn (R)",
  "Alpha · Red Burn (R) (R)": "Alpha · Red Burn (R)",
  "Alpha · Green Stompy (G) [Restricted]": "Alpha · Green Stompy (G)",
  "Alpha · Green Stompy (G) (R)": "Alpha · Green Stompy (G)",
  "Alpha · Fire & Light (R/W) [Restricted]": "Alpha · Fire & Light (R/W)",
  "Alpha · Fire & Light (R/W) (R)": "Alpha · Fire & Light (R/W)",
  "Alpha · Artifact Control (U) [Restricted]": "Alpha · Artifact Control (U)",
  "Alpha · Artifact Control (U) (R)": "Alpha · Artifact Control (U)",
  "Beta · White Weenie (W) [Restricted]": "Beta · White Weenie (W)",
  "Beta · White Weenie (W) (R)": "Beta · White Weenie (W)",
  "Beta · Blue Control (U) [Restricted]": "Beta · Blue Control (U)",
  "Beta · Blue Control (U) (R)": "Beta · Blue Control (U)",
  "Beta · Black Discard (B) [Restricted]": "Beta · Black Discard (B)",
  "Beta · Black Discard (B) (R)": "Beta · Black Discard (B)",
  "Beta · Red Burn (R) [Restricted]": "Beta · Red Burn (R)",
  "Beta · Red Burn (R) (R)": "Beta · Red Burn (R)",
  "Beta · Green Stompy (G) [Restricted]": "Beta · Green Stompy (G)",
  "Beta · Green Stompy (G) (R)": "Beta · Green Stompy (G)",
  "Beta · Fireball Control (U/R) [Restricted]": "Beta · Fireball Control (U/R)",
  "Beta · Fireball Control (U/R) (R)": "Beta · Fireball Control (U/R)",
  "Beta · Artifact Control (U) [Restricted]": "Beta · Artifact Control (U)",
  "Beta · Artifact Control (U) (R)": "Beta · Artifact Control (U)",
  "Unlimited · White Weenie (W) [Restricted]": "Unlimited · White Weenie (W)",
  "Unlimited · White Weenie (W) (R)": "Unlimited · White Weenie (W)",
  "Unlimited · Blue Control (U) [Restricted]": "Unlimited · Blue Control (U)",
  "Unlimited · Blue Control (U) (R)": "Unlimited · Blue Control (U)",
  "Unlimited · Black Discard (B) [Restricted]": "Unlimited · Black Discard (B)",
  "Unlimited · Black Discard (B) (R)": "Unlimited · Black Discard (B)",
  "Unlimited · Red Burn (R) [Restricted]": "Unlimited · Red Burn (R)",
  "Unlimited · Red Burn (R) (R)": "Unlimited · Red Burn (R)",
  "Unlimited · Green Stompy (G) [Restricted]": "Unlimited · Green Stompy (G)",
  "Unlimited · Green Stompy (G) (R)": "Unlimited · Green Stompy (G)",
  "Unlimited · Tides & Shadows (U/B) [Restricted]": "Unlimited · Tides & Shadows (U/B)",
  "Unlimited · Tides & Shadows (U/B) (R)": "Unlimited · Tides & Shadows (U/B)",
  "Unlimited · Artifact Control (U) [Restricted]": "Unlimited · Artifact Control (U)",
  "Unlimited · Artifact Control (U) (R)": "Unlimited · Artifact Control (U)",
  "Arabian Nights · Desert Cavalry (W) [Restricted]": "Arabian Nights · Desert Cavalry (W)",
  "Arabian Nights · Desert Cavalry (W) (R)": "Arabian Nights · Desert Cavalry (W)",
  "Arabian Nights · Sea & Sand Tempo (U) [Restricted]": "Arabian Nights · Sea & Sand Tempo (U)",
  "Arabian Nights · Sea & Sand Tempo (U) (R)": "Arabian Nights · Sea & Sand Tempo (U)",
  "Arabian Nights · Djinn Discard (B) [Restricted]": "Arabian Nights · Djinn Discard (B)",
  "Arabian Nights · Djinn Discard (B) (R)": "Arabian Nights · Djinn Discard (B)",
  "Arabian Nights · Sandstorm Burn (R) [Restricted]": "Arabian Nights · Sandstorm Burn (R)",
  "Arabian Nights · Sandstorm Burn (R) (R)": "Arabian Nights · Sandstorm Burn (R)",
  "Arabian Nights · Erhnam Stompy (G) [Restricted]": "Arabian Nights · Erhnam Stompy (G)",
  "Arabian Nights · Erhnam Stompy (G) (R)": "Arabian Nights · Erhnam Stompy (G)",
  "Arabian Nights · Djinn Control (U/B) [Restricted]": "Arabian Nights · Djinn Control (U/B)",
  "Arabian Nights · Djinn Control (U/B) (R)": "Arabian Nights · Djinn Control (U/B)",
  "Arabian Nights · Bazaar Artifacts (U) [Restricted]": "Arabian Nights · Bazaar Artifacts (U)",
  "Arabian Nights · Bazaar Artifacts (U) (R)": "Arabian Nights · Bazaar Artifacts (U)",
  "Antiquities · Artisan Defenders (W) [Restricted]": "Antiquities · Artisan Defenders (W)",
  "Antiquities · Artisan Defenders (W) (R)": "Antiquities · Artisan Defenders (W)",
  "Antiquities · Monolith Reactor (U) [Restricted]": "Antiquities · Monolith Reactor (U)",
  "Antiquities · Monolith Reactor (U) (R)": "Antiquities · Monolith Reactor (U)",
  "Antiquities · Phyrexian Rack (B) [Restricted]": "Antiquities · Phyrexian Rack (B)",
  "Antiquities · Phyrexian Rack (B) (R)": "Antiquities · Phyrexian Rack (B)",
  "Antiquities · Artifact Smash (R) [Restricted]": "Antiquities · Artifact Smash (R)",
  "Antiquities · Artifact Smash (R) (R)": "Antiquities · Artifact Smash (R)",
  "Antiquities · Urza Druids (G) [Restricted]": "Antiquities · Urza Druids (G)",
  "Antiquities · Urza Druids (G) (R)": "Antiquities · Urza Druids (G)",
  "Antiquities · Workshop Robots (C) [Restricted]": "Antiquities · Workshop Robots (C)",
  "Antiquities · Workshop Robots (C) (R)": "Antiquities · Workshop Robots (C)",
  "Legends · Moat Prison (W) [Restricted]": "Legends · Moat Prison (W)",
  "Legends · Moat Prison (W) (R)": "Legends · Moat Prison (W)",
  "Legends · Force Spike Tempo (U) [Restricted]": "Legends · Force Spike Tempo (U)",
  "Legends · Force Spike Tempo (U) (R)": "Legends · Force Spike Tempo (U)",
  "Legends · Void & Abyss (B) [Restricted]": "Legends · Void & Abyss (B)",
  "Legends · Void & Abyss (B) (R)": "Legends · Void & Abyss (B)",
  "Legends · Storm Burn (R) [Restricted]": "Legends · Storm Burn (R)",
  "Legends · Storm Burn (R) (R)": "Legends · Storm Burn (R)",
  "Legends · Rampage Stompers (G) [Restricted]": "Legends · Rampage Stompers (G)",
  "Legends · Rampage Stompers (G) (R)": "Legends · Rampage Stompers (G)",
  "Legends · Gruul Legends (R/G) [Restricted]": "Legends · Gruul Legends (R/G)",
  "Legends · Gruul Legends (R/G) (R)": "Legends · Gruul Legends (R/G)",
  "Legends · Azorius Legends (W/U) [Restricted]": "Legends · Azorius Legends (W/U)",
  "Legends · Azorius Legends (W/U) (R)": "Legends · Azorius Legends (W/U)",
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

// ---- formats ---------------------------------------------------------------------------------
// 'unrestricted': max 4 copies per name (basics unlimited). 'restricted': old-school restricted list, 1 copy each (not banned).
// RESTRICTED is the single editable list of restricted cards.
// every premade deck has exactly 60 cards; the deck builder enforces this as the minimum
export const DECK_SIZE = 60;
export const MIN_DECK = 60;
export const RESTRICTED = new Set([
  'Black Lotus', 'Mox Pearl', 'Mox Sapphire', 'Mox Jet', 'Mox Ruby', 'Mox Emerald', 'Ancestral Recall', 'Time Walk', 'Timetwister', 'Sol Ring',
  'Demonic Tutor', 'Library of Alexandria', 'Wheel of Fortune', 'Balance', 'Channel', 'Mind Twist', 'Braingeyser',
]);
export const FORMATS = ['restricted', 'unrestricted'];
const BASICS = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']);
export const copyLimit = (name, fmt = 'unrestricted') => (BASICS.has(name) ? 99 : fmt === 'restricted' && RESTRICTED.has(name) ? 1 : 4);
// ---- editions (cumulative cutoff by release order) ------------------------------------------
export const EDITIONS = [
  { id: 'all', label: 'All Editions' }, { id: 'LEA', label: 'Alpha' }, { id: 'LEB', label: 'Beta' },
  { id: '2ED', label: 'Unlimited' }, { id: 'ARN', label: 'Arabian Nights' }, { id: 'ATQ', label: 'Antiquities' }, { id: 'LEG', label: 'Legends' },
];
const EDITION_ORDER = ['LEA', 'LEB', '2ED', 'ARN', 'ATQ', 'LEG'];
// a card (catalogue def, canonical = oldest printing in `set`) is allowed at cutoff X iff its set is not newer than X
export function cardAllowed(def, edition = 'all') {
  if (!edition || edition === 'all') return true;
  const cut = EDITION_ORDER.indexOf(edition), at = EDITION_ORDER.indexOf(def?.set);
  return cut >= 0 && at >= 0 && at <= cut;
}
// a card NAME is allowed when any of its printings is (basic lands exist in Alpha and Beta)
function nameAllowed(name, edition, byName) {
  if (!edition || edition === 'all') return true;
  const defs = byName?.[name]; if (!defs) return false;
  return defs.some((d) => cardAllowed(d, edition));
}
// counts: {cardName: n}. Legal when every entry is within the format's copy limit and (optionally) the edition cutoff.
// byName (from indexCards) is optional; without it the catalogue of the last indexCards() call is used.
export const isLegal = (counts, fmt = 'unrestricted', edition = 'all', byName) => {
  if (!Object.entries(counts).every(([n, k]) => k <= copyLimit(n, fmt))) return false;
  if (!edition || edition === 'all') return true;
  const idx = byName || CATALOGUE_BY_NAME; if (!idx) return false;
  return Object.keys(counts).every((n) => nameAllowed(n, edition, idx));
};
// formats a premade deck is legal in, computed from its list
export const deckFormats = (name) => (DECK_LISTS[name] ? FORMATS.filter((f) => isLegal(DECK_LISTS[name], f)) : []);
// edition ids in which a premade deck is legal ('all' is always included)
export const deckEditions = (name, byName) => (DECK_LISTS[name] ? EDITIONS.map((e) => e.id).filter((e) => isLegal(DECK_LISTS[name], 'unrestricted', e, byName)) : []);
// random premade deck legal in `fmt` AND `opts.edition`, drawn by AI level (opts: {edition, rng, byName, exclude}):
//   easy   -> the lower-rated third of the legal decks, never combo / Power-9 decks (pool unrestricted / restricted, archetype combo)
//   normal -> the middle two thirds (ratings between the 1/6 and 5/6 quantiles)
//   hard   -> every legal deck
// Falls back gracefully (fmt only, then any deck) when a slice is empty.
const isPowerDeck = (n) => { const m = DECK_META[n]; return !!m && (m.pool === 'unrestricted' || m.pool === 'restricted' || m.unrestricted || m.archetype === 'combo'); };
export function pickOpponentDeck(fmt = 'unrestricted', level = 'normal', opts = {}) {
  const rng = opts.rng || Math.random, ed = opts.edition || 'all';
  const names = Object.keys(DECK_LISTS);
  const ready = (n) => !opts.byName || isDeckReady(n, opts.byName);
  const rating = (n) => DECK_META[n]?.rating ?? 50;
  const slice = (pool) => {
    if (level !== 'easy' && level !== 'normal') return pool;
    const sorted = [...pool].sort((a, b) => rating(a) - rating(b) || a.localeCompare(b));
    if (level === 'easy') {
      const calm = sorted.filter((n) => !isPowerDeck(n));
      return calm.slice(0, Math.max(1, Math.ceil(calm.length / 3)));
    }
    const lo = Math.floor(sorted.length / 6), hi = Math.ceil((sorted.length * 5) / 6);
    return sorted.slice(lo, hi);
  };
  const tiers = [
    (n) => isLegal(DECK_LISTS[n], fmt, ed, opts.byName) && n !== opts.exclude && ready(n),
    (n) => isLegal(DECK_LISTS[n], fmt, ed, opts.byName) && n !== opts.exclude,
    (n) => isLegal(DECK_LISTS[n], fmt) && n !== opts.exclude && ready(n),
    (n) => isLegal(DECK_LISTS[n], fmt),
  ];
  for (const t of tiers) { const pool = slice(names.filter(t)); if (pool.length) return pool[Math.floor(rng() * pool.length)]; }
  for (const t of tiers) { const pool = names.filter(t); if (pool.length) return pool[Math.floor(rng() * pool.length)]; }
  return null;
}

let CATALOGUE_BY_NAME = null;   // set by indexCards; used by isLegal / deckEditions when no byName is passed
export function indexCards(cards) {
  const byName = {};
  for (const c of cards) {
    c.art = `assets/cards/${c.set}/${c.number}_${c.identifiers.scryfallId}.jpg`;
    (byName[c.name] ||= []).push(c);
  }
  CATALOGUE_BY_NAME = byName;
  return byName;
}

// true when every card of the deck is playable (use to hide or grey out decks while cards are still being implemented)
export function isDeckReady(name, byName) {
  const list = DECK_LISTS[name]; if (!list) return false;
  return Object.keys(list).every((n) => byName[n] && isImplemented(byName[n][0]));
}
export function readyDecks(byName) { return Object.keys(DECK_LISTS).filter((n) => isDeckReady(n, byName)); }

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
  const keyCards = entries.filter(([n]) => !BASICS.has(n) && !(byName?.[n]?.[0].types || []).includes('Land')).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n);
  const out = { ...meta, size, lands, keyCards: meta.keyCards || keyCards };
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
  const myPool = DECK_META[playerDeckName]?.pool || 'classic';
  let pool = names.filter((n) => n !== playerDeckName && (DECK_META[n]?.pool || 'classic') === myPool && (!opts.byName || isDeckReady(n, opts.byName)));
  if (!pool.length) pool = names.filter((n) => n !== playerDeckName); if (!pool.length) pool = names;
  const mine = DECK_META[playerDeckName]?.rating ?? 50;
  const target = mine - (LEVEL_BONUS[level] ?? 0);
  const ranked = pool.map((n) => ({ n, d: Math.abs((DECK_META[n]?.rating ?? 50) - target) })).sort((a, b) => a.d - b.d || a.n.localeCompare(b.n));
  const top = ranked.slice(0, Math.min(4, ranked.length));
  return top[Math.floor(rng() * top.length)].n;
}

// Saved games / custom decks may still carry an old twin name ('<Name> (R)'); resolve to the current deck name (unknown names pass through).
export const resolveDeckName = (name) => (DECK_LISTS[name] ? name : LEGACY_DECK_NAMES[name] || name);
