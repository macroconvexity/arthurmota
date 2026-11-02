// Card behaviour registry. Everything not listed here is either a vanilla / keyword-only permanent or is not playable yet.
export const COLORS = ['W', 'U', 'B', 'R', 'G'];
export const KEYWORDS = ['flying', 'first strike', 'double strike', 'vigilance', 'defender', 'reach', 'trample', 'haste', 'flash', 'fear', 'banding', 'shroud', 'indestructible',
  'plainswalk', 'islandwalk', 'swampwalk', 'mountainwalk', 'forestwalk'];
const COLOR_WORDS = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };

const mana = (colors, amount = 1, extra = {}) => ({ cost: { tap: true, ...extra }, mana: { colors, amount } });
const ANY = COLORS;

// spec kinds: any | creature | player | land | spell | tappedCreature | nonartifactNonblackCreature | artifactOrEnchantment
const EFFECTS_BASE = {
  'Lightning Bolt': { targets: ['any'], text: '3 damage', resolve: (g, it) => g.damage(it, it.targets[0], 3) },
  'Counterspell': { targets: ['spell'], text: 'counter', resolve: (g, it) => g.counterSpell(it.targets[0]) },
  'Giant Growth': { targets: ['creature'], text: '+3/+3', resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { p: 3, t: 3 }) },
  'Terror': { targets: ['nonartifactNonblackCreature'], resolve: (g, it) => g.destroy(g.perm(it.targets[0])) },
  'Swords to Plowshares': { targets: ['creature'], resolve: (g, it) => { const p = g.perm(it.targets[0]); const n = g.power(p); g.exile(p); g.gainLife(p.card.owner, n); } },
  'Wrath of God': { targets: [], resolve: (g) => { g.emit({ type: 'sweep' }); for (const pl of g.players) for (const p of [...pl.bf]) if (g.isCreature(p)) g.destroy(p); } },
  'Ancestral Recall': { targets: ['player'], resolve: (g, it) => g.draw(it.targets[0].id, 3) },
  'Dark Ritual': { targets: [], resolve: (g, it) => { g.players[it.controller].pool.B += 3; } },
  'Stone Rain': { targets: ['land'], resolve: (g, it) => g.destroy(g.perm(it.targets[0])) },
  'Disenchant': { targets: ['artifactOrEnchantment'], resolve: (g, it) => g.destroy(g.perm(it.targets[0])) },
  'Healing Salve': { targets: ['player'], text: 'gain 3', resolve: (g, it) => g.gainLife(it.targets[0].id, 3) },
};

const ABILITIES_BASE = {
  'Mox Pearl': [mana(['W'])], 'Mox Sapphire': [mana(['U'])], 'Mox Jet': [mana(['B'])],
  'Mox Ruby': [mana(['R'])], 'Mox Emerald': [mana(['G'])],
  'Llanowar Elves': [mana(['G'])], 'Fyndhorn Elves': [mana(['G'])],
  'Birds of Paradise': [mana(ANY)],
  'Sol Ring': [mana(['C'], 2)],
  'Black Lotus': [mana(ANY, 3, { sac: true })],
  'Prodigal Sorcerer': [{ cost: { tap: true }, targets: ['any'], text: '1 damage', resolve: (g, it) => g.damage(it, it.targets[0], 1) }],
  'Shivan Dragon': [{ cost: { mana: '{R}' }, text: '+1/+0', resolve: (g, it) => g.addMod(it.source, { p: 1 }) }],
};

const TRIGGERS_BASE = {
  // name -> hook called when this permanent deals combat damage to a player
  'Hypnotic Specter': { onDamagePlayer: (g, perm, target) => g.discardRandom(target.id) },
};

import * as white from './cards/white.js?v=20261102163450';
import * as blue from './cards/blue.js?v=20261102163450';
import * as black from './cards/black.js?v=20261102163450';
import * as red from './cards/red.js?v=20261102163450';
import * as green from './cards/green.js?v=20261102163450';
import * as artifacts from './cards/artifacts.js?v=20261102163450';
import * as lands from './cards/lands.js?v=20261102163450';
import * as enchantments from './cards/enchantments.js?v=20261102163450';

// enchantments first: a colour module that defines the same card wins
const MODULES = [enchantments, white, blue, black, red, green, artifacts, lands];
const merge = (base, key) => Object.assign({}, base, ...MODULES.map((m) => m[key] || {}));
export const EFFECTS = merge(EFFECTS_BASE, 'EFFECTS');
export const ABILITIES = merge(ABILITIES_BASE, 'ABILITIES');
export const TRIGGERS = merge(TRIGGERS_BASE, 'TRIGGERS');
export const STATIC = merge({}, 'STATIC');
const IMPLEMENTED = new Set(MODULES.flatMap((m) => m.IMPLEMENTED || []));

const BASIC = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };

export function abilitiesOf(def) {
  if (BASIC[def.name]) return [mana([BASIC[def.name]])];
  return ABILITIES[def.name] || [];
}

const KW_CACHE = new WeakMap();
// One text line -> list of keywords, or null when any part is not a plain keyword (so the card needs module code).
function parseKwLine(raw) {
  const l = raw.replace(/\(.*?\)/g, '').trim().toLowerCase().replace(/\.$/, '');
  if (!l) return [];
  const out = [];
  for (const part of l.split(/\s*[,;]\s*/)) {
    if (KEYWORDS.includes(part)) { out.push(part); continue; }
    const m = part.match(/^protection from (white|blue|black|red|green)$/);
    if (m) { out.push('pro:' + COLOR_WORDS[m[1]]); continue; }
    return null;
  }
  return out;
}
export function keywordsOf(def) {
  let kw = KW_CACHE.get(def);
  if (!kw) {
    kw = new Set();
    for (const raw of (def.text || '').split('\n')) for (const k of parseKwLine(raw) || []) kw.add(k);
    KW_CACHE.set(def, kw);
  }
  return new Set(kw);
}

// "Enchant creature" -> target spec for the aura, or null.
const AURA_SPECS = { creature: 'creature', land: 'land', artifact: 'artifact', enchantment: 'enchantment', wall: 'wall', 'creature card in a graveyard': 'graveyardCreature' };
export function auraSpecOf(def) {
  if (!(def.types || []).includes('Enchantment')) return null;
  const first = (def.text || '').split('\n')[0].replace(/\(.*?\)/g, '').trim().toLowerCase();
  const m = first.match(/^enchant (.+)$/);
  return m ? AURA_SPECS[m[1]] || null : null;
}

export function isImplemented(def) {
  const t = def.types || [];
  if (IMPLEMENTED.has(def.name)) return true;
  if (t.includes('Land')) return !!BASIC[def.name] || !!ABILITIES[def.name];
  if (t.includes('Instant') || t.includes('Sorcery')) return !!EFFECTS[def.name];
  if (t.includes('Creature') || t.includes('Artifact')) {
    if (ABILITIES[def.name] || TRIGGERS[def.name] || STATIC[def.name]) return true;
    return !hasUnknownLines(def);
  }
  return false; // enchantments only through IMPLEMENTED
}

function hasUnknownLines(def) {
  for (const raw of (def.text || '').split('\n')) if (parseKwLine(raw) === null) return true;
  return false;
}
