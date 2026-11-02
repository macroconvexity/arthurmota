// Card module: lands. See docs/CARD_MODULE_CONTRACT.md.
// Catalogue non-basic lands: the ten original dual lands only (no Library, Maze, Workshop etc. in data).
const DUALS = {
  'Underground Sea': ['U', 'B'], 'Volcanic Island': ['U', 'R'], 'Plateau': ['R', 'W'], 'Tundra': ['W', 'U'],
  'Taiga': ['R', 'G'], 'Badlands': ['B', 'R'], 'Bayou': ['B', 'G'], 'Savannah': ['G', 'W'],
  'Scrubland': ['W', 'B'], 'Tropical Island': ['G', 'U'],
};
export const EFFECTS = {};
const mana1 = (c) => ({ cost: { tap: true }, mana: { colors: [c], amount: 1 } });
const legendary = { kind: 'perm', test: (g, p) => g.isCreature(p) && !!p.card.def.supertypes?.includes('Legendary') };
const WALKS = ['plainswalk', 'islandwalk', 'swampwalk', 'mountainwalk', 'forestwalk', 'legendary landwalk'];
// "loses X until end of turn": engine mod removeKw (applied after statics and grants)
const lose = (g, perm, kws) => g.addMod(perm, { removeKw: kws });
export const ABILITIES = {
  ...Object.fromEntries(Object.entries(DUALS).map(([n, colors]) => [n, [{ cost: { tap: true }, mana: { colors, amount: 1 } }]])),
  Hammerheim: [mana1('R'), { cost: { tap: true }, targets: ['creature'], ai: 'utility', text: 'Target creature loses all landwalk abilities until end of turn.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t) lose(g, t, WALKS); } }],
  Karakas: [mana1('W'), { cost: { tap: true }, targets: [legendary], ai: 'removal', text: "Return target legendary creature to its owner's hand.",
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && g.isCreature(t) && t.card.def.supertypes?.includes('Legendary')) g.bounce(t); } }],
  Pendelhaven: [mana1('G'), { cost: { tap: true }, targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && g.power(p) === 1 && g.toughness(p) === 1 }], ai: 'pump', text: 'Target 1/1 creature gets +1/+2 until end of turn.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && g.power(t) === 1 && g.toughness(t) === 1) g.addMod(t, { p: 1, t: 2 }); } }],
  Urborg: [mana1('B'), { cost: { tap: true }, targets: ['creature'], ai: 'utility', text: 'Target creature loses first strike or swampwalk until end of turn.',
    resolve: (g, it) => {
      const t = g.perm(it.targets[0]); if (!t) return;
      g.ask(it.controller, { type: 'pick', prompt: 'Urborg: first strike or swampwalk?', options: [{ value: 'first strike', label: 'First strike' }, { value: 'swampwalk', label: 'Swampwalk' }], min: 1, max: 1, source: it.source.card.id }, ([k]) => lose(g, t, [k]));
    } }],
  Tolaria: [mana1('U'), { cost: { tap: true }, targets: ['creature'], timing: 'anyUpkeep', ai: 'utility', text: 'Target creature loses banding until end of turn. Activate only during any upkeep step.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t) lose(g, t, ['banding', 'bandswith:*']); } }],
};
export const TRIGGERS = {
  'The Tabernacle at Pendrell Vale': {
    // each creature's controller pays {1} at their upkeep or the creature is destroyed
    onUpkeep: (g, perm, pid) => {
      for (const c of g.players[pid].bf.filter((p) => g.isCreature(p))) {
        g.mayPay(pid, '{1}', { prompt: `Pay {1} to keep ${c.card.def.name}? (The Tabernacle)`, source: perm.card.id }, (paid) => { if (!paid && g.perm(c.id)) g.destroy(c); });
      }
    },
  },
};
export const STATIC = {};
// "<Colour> legendary creatures you control have 'bands with other legendary creatures'" (engine keyword bandswith:legendary)
const BANDERS = { "Adventurers' Guildhouse": 'G', 'Cathedral of Serra': 'W', 'Mountain Stronghold': 'R', "Seafarer's Quay": 'U', 'Unholy Citadel': 'B' };
for (const [n, c] of Object.entries(BANDERS)) STATIC[n] = { affects: (g, src, t) => t.controller === src.controller && g.isCreature(t) && !!t.card.def.supertypes?.includes('Legendary') && g.colors(t).includes(c), kw: 'bandswith:legendary' };
export const IMPLEMENTED = [...Object.keys(BANDERS), ...Object.keys(DUALS), 'Hammerheim', 'Karakas', 'Pendelhaven', 'Urborg', 'Tolaria', 'The Tabernacle at Pendrell Vale'];
