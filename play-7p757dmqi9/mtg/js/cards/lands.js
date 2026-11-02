// Card module: lands. See docs/CARD_MODULE_CONTRACT.md.
// Catalogue non-basic lands: the ten original dual lands only (no Library, Maze, Workshop etc. in data).
const DUALS = {
  'Underground Sea': ['U', 'B'], 'Volcanic Island': ['U', 'R'], 'Plateau': ['R', 'W'], 'Tundra': ['W', 'U'],
  'Taiga': ['R', 'G'], 'Badlands': ['B', 'R'], 'Bayou': ['B', 'G'], 'Savannah': ['G', 'W'],
  'Scrubland': ['W', 'B'], 'Tropical Island': ['G', 'U'],
};
export const EFFECTS = {};
export const ABILITIES = Object.fromEntries(Object.entries(DUALS).map(([n, colors]) => [n, [{ cost: { tap: true }, mana: { colors, amount: 1 } }]]));
export const TRIGGERS = {};
export const STATIC = {};
export const IMPLEMENTED = Object.keys(DUALS);
