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

// ---------- Arabian Nights / Antiquities lands ----------
const mana = (colors, amount = 1) => ({ cost: { tap: true }, mana: { colors, amount } });
const subtypeSpec = (st) => ({ kind: 'perm', test: (g, p) => g.isCreature(p) && g.hasSubtype(p, st) });
const urza = (self, others) => ({
  affects: (g, src, t) => t === src,
  setAbilities: (g, src) => [mana(['C'], others.every((n) => g.players[src.controller].bf.some((p) => p.card.def.name === n)) ? (self === "Urza's Tower" ? 3 : 2) : 1)],
});
// base P/T before additive bonuses (mirrors Game.pt: printed -> setPT statics -> setPT mods)
const basePT = (g, t) => {
  let bp = +t.card.def.power || 0, bt = +t.card.def.toughness || 0;
  for (const { src, e } of g.statics()) if (e.setPT && g.applies(e, src, t)) { const r = e.setPT(g, src, t); bp = r[0]; bt = r[1]; }
  for (const m of t.mods) if (m.setPT) { bp = m.setPT[0]; bt = m.setPT[1]; }
  return [bp, bt];
};
Object.assign(ABILITIES, {
  'Bazaar of Baghdad': [{ cost: { tap: true }, ai: 'draw', text: 'Draw two cards, then discard three cards.',
    resolve: (g, it) => { g.draw(it.controller, 2); g.discardChoice(it.controller, 3); } }],
  'City of Brass': [mana(['W', 'U', 'B', 'R', 'G'])],
  'Diamond Valley': [{ cost: { tap: true, sacOther: 'creature' }, ai: 'heal', text: "You gain life equal to the sacrificed creature's toughness.",
    resolve: (g, it) => { const s = it.paid?.sacrificed?.[0]; if (s) g.gainLife(it.controller, Math.max(0, g.toughness(s))); } }],
  'Elephant Graveyard': [mana(['C']), { cost: { tap: true }, targets: [subtypeSpec('Elephant')], ai: 'utility', text: 'Regenerate target Elephant.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t) g.regenerate(t); } }],
  'Island of Wak-Wak': [{ cost: { tap: true }, targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && g.kw(p).has('flying') }], ai: 'utility', text: 'Target creature with flying has base power 0 until end of turn.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t) g.addMod(t, { setPT: [0, basePT(g, t)[1]] }); } }],
  'Library of Alexandria': [mana(['C']), { cost: { tap: true }, ai: 'draw', text: 'Draw a card. Activate only if you have exactly seven cards in hand.',
    condition: (g, perm, pid) => g.players[perm.controller].hand.length === 7, resolve: (g, it) => { if (g.players[it.controller].hand.length === 7) g.draw(it.controller, 1); } }],
  "Mishra's Factory": [mana(['C']),
    { cost: { mana: '{1}' }, ai: 'utility', text: 'This land becomes a 2/2 Assembly-Worker artifact creature until end of turn. It\'s still a land.',
      resolve: (g, it) => g.addMod(it.source, { setPT: [2, 2], addTypes: ['Artifact', 'Creature'], addSubtypes: ['Assembly-Worker'], until: 'eot' }) },
    { cost: { tap: true }, targets: [subtypeSpec('Assembly-Worker')], ai: 'pump', text: 'Target Assembly-Worker creature gets +1/+1 until end of turn.',
      resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t) g.addMod(t, { p: 1, t: 1 }); } }],
  "Mishra's Workshop": [{ cost: { tap: true }, mana: { colors: ['C'], amount: 3, restrict: 'Artifact' } }],
  Desert: [mana(['C']), { cost: { tap: true }, targets: ['attackingCreature'], timing: 'endCombat', ai: 'removal', text: 'This land deals 1 damage to target attacking creature. Activate only during the end of combat step.',
    resolve: (g, it) => { if (g.perm(it.targets[0])) g.damage(it.source, it.targets[0], 1); } }],
  Oasis: [{ cost: { tap: true }, targets: ['creature'], ai: 'utility', text: 'Prevent the next 1 damage that would be dealt to target creature this turn.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t) g.preventDamage({ kind: 'perm', id: t.id }, 1, { until: 'eot' }); } }],
  'Strip Mine': [mana(['C']), { cost: { tap: true, sac: true }, targets: ['land'], ai: 'landhate', text: 'Destroy target land.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && g.isLand(t)) g.destroy(t); } }],
  "Urza's Mine": [mana(['C'])], "Urza's Power Plant": [mana(['C'])], "Urza's Tower": [mana(['C'])],
});
Object.assign(TRIGGERS, {
  // "whenever this land becomes tapped, it deals 1 damage to you"
  'City of Brass': { onAnyTap: (g, perm, tapped) => { if (tapped === perm) g.damage(perm, { kind: 'player', id: perm.controller }, 1); } },
});
Object.assign(STATIC, {
  "Urza's Mine": urza("Urza's Mine", ["Urza's Power Plant", "Urza's Tower"]),
  "Urza's Power Plant": urza("Urza's Power Plant", ["Urza's Mine", "Urza's Tower"]),
  "Urza's Tower": urza("Urza's Tower", ["Urza's Mine", "Urza's Power Plant"]),
});
IMPLEMENTED.push("Mishra's Workshop", 'Desert', 'Bazaar of Baghdad', 'City of Brass', 'Diamond Valley', 'Elephant Graveyard', 'Island of Wak-Wak', 'Library of Alexandria', "Mishra's Factory", 'Oasis', 'Strip Mine', "Urza's Mine", "Urza's Power Plant", "Urza's Tower");
