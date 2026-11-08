import { COLORS, EFFECTS, ABILITIES, TRIGGERS, STATIC, COUNTER_ABILITIES, abilitiesOf as defAbilities, keywordsOf, auraSpecOf } from './cards.js?v=20261108130645';

export const STEPS = ['untap', 'upkeep', 'draw', 'main1', 'attackers', 'blockers', 'damage', 'main2', 'end'];
const NOLOST = new Set();
const MAX_X = 200; // engine-level bound for X in spells
const LOOP_LIMIT = 400; // casts + activations per step: stops unbounded mana loops (Power Artifact + Basalt Monolith) from hanging bots
const emptyPool = () => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
const COLOR_WORD = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };
const WALKS = { plainswalk: 'Plains', islandwalk: 'Island', swampwalk: 'Swamp', mountainwalk: 'Mountain', forestwalk: 'Forest' };
const asArr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function parseCost(mc = '', x = 0) {
  const c = { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const m of mc.matchAll(/\{([^}]+)\}/g)) {
    const s = m[1];
    if (/^\d+$/.test(s)) c.generic += +s;
    else if (COLORS.includes(s)) c[s]++;
    else if (s === 'C') c.generic++;
    else if (s === 'X') c.generic += x;
  }
  c.total = c.generic + COLORS.reduce((a, k) => a + c[k], 0);
  return c;
}
const addGeneric = (c, n) => { if (n > 0) { c.generic += n; c.total += n; } else if (n < 0) { const d = Math.min(c.generic, -n); c.generic -= d; c.total -= d; } return c; };
const cmcOf = (def) => def.manaValue ?? parseCost(def.manaCost).total;

// ---------- target spec table ----------
// perm specs: (g, perm, ctx) => bool ; ctx = {pid, source, card}
const isTypeP = (t) => (g, p) => g.hasType(p, t);
const PERM_SPECS = {
  creature: (g, p) => g.isCreature(p),
  land: (g, p) => g.isLand(p),
  artifact: isTypeP('Artifact'),
  enchantment: isTypeP('Enchantment'),
  permanent: () => true,
  nonlandPermanent: (g, p) => !g.isLand(p),
  wall: (g, p) => g.isCreature(p) && g.hasSubtype(p, 'Wall'),
  tappedCreature: (g, p) => g.isCreature(p) && p.tapped,
  untappedCreature: (g, p) => g.isCreature(p) && !p.tapped,
  attackingCreature: (g, p) => g.isCreature(p) && g.combat.attackers.includes(p.id),
  blockingCreature: (g, p) => g.isCreature(p) && Object.values(g.combat.blocks).some((b) => b.includes(p.id)),
  flyingCreature: (g, p) => g.isCreature(p) && g.kw(p).has('flying'),
  creatureWithoutFlying: (g, p) => g.isCreature(p) && !g.kw(p).has('flying'),
  creatureLE2Power: (g, p) => g.isCreature(p) && g.power(p) <= 2,
  creaturePowerLE2: (g, p) => g.isCreature(p) && g.power(p) <= 2,
  artifactCreature: (g, p) => g.isCreature(p) && g.hasType(p, 'Artifact'),
  nonartifactNonblackCreature: (g, p) => g.isCreature(p) && !g.hasType(p, 'Artifact') && !g.colors(p).includes('B'),
  artifactOrEnchantment: (g, p) => g.hasType(p, 'Artifact') || g.hasType(p, 'Enchantment'),
  artifactOrCreature: (g, p) => g.hasType(p, 'Artifact') || g.isCreature(p),
  artifactCreatureOrLand: (g, p) => g.hasType(p, 'Artifact') || g.isCreature(p) || g.isLand(p),
  yourCreature: (g, p, c) => g.isCreature(p) && p.controller === c.pid,
  attackingCreatureYouControl: (g, p, c) => g.isCreature(p) && p.controller === c.pid && g.combat.attackers.includes(p.id),
  creatureYouControl: (g, p, c) => g.isCreature(p) && p.controller === c.pid,
  opponentCreature: (g, p, c) => g.isCreature(p) && p.controller !== c.pid,
  basicLand: (g, p) => g.isLand(p) && p.card.def.supertypes?.includes('Basic'),
  nonbasicLand: (g, p) => g.isLand(p) && !p.card.def.supertypes?.includes('Basic'),
  creatureYouControlToughnessLessThanSourcePower: (g, p, c) => g.isCreature(p) && p.controller === c.pid && c.source && g.toughness(p) < g.power(c.source),
};
const SPELL_SPECS = {
  spell: () => true,
  creatureSpell: (g, s) => s.card.def.types.includes('Creature'),
  instantOrSorcerySpell: (g, s) => s.card.def.types.some((t) => t === 'Instant' || t === 'Sorcery'),
  permanentSpell: (g, s) => !s.card.def.types.some((t) => t === 'Instant' || t === 'Sorcery'),
};
const CARD_SPECS = {
  graveyardCreature: (g, c) => c.def.types.includes('Creature'),
  myGraveyardCreature: (g, c, x) => c.def.types.includes('Creature') && c.owner === x.pid,
  graveyardCard: () => true,
  myGraveyardCard: (g, c, x) => c.owner === x.pid,
  creatureCardInYourGraveyard: (g, c, x) => c.def.types.includes('Creature') && c.owner === x.pid,
  artifactCardInYourGraveyard: (g, c, x) => c.def.types.includes('Artifact') && c.owner === x.pid,
};

let CATALOGUE = null;
export function setCatalogue(list) { CATALOGUE = list; }
// Small seedable PRNG whose state can be saved (use it as opts.rng for games you want to serialize).
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.getState = () => a; f.setState = (v) => { a = v >>> 0; };
  return f;
}
const defRef = (d) => ({ name: d.name, set: d.set, number: d.number });

export class Game {
  constructor(decks, opts = {}) {
    this.rngCalls = 0; this.logSeq = 0; this.undoEpoch = 0; this.undoSnap = null; this.undoFor = opts.undo === true ? [0, 1] : Array.isArray(opts.undo) ? [...opts.undo] : [];
    this.rng = this.wrapRng(opts.rng || makeRng((Math.random() * 4294967296) >>> 0));
    this.names = opts.names || ['You', 'Opponent'];
    this.auto = new Set(opts.auto || []);   // players whose choices are answered automatically
    this.log = []; this.logEvents = [];
    this.events = [];       // UI animation hints
    this.nextId = 1;
    this.players = [0, 1].map((i) => ({ id: i, name: this.names[i], life: 20, library: [], hand: [], bf: [], gy: [], ex: [], pool: emptyPool(), poolR: [], landPlayed: false, landsPlayed: 0, drewEmpty: false, skip: { untap: 0, draw: 0, turn: 0 }, spellsCast: [], enteredNonToken: [], drawnThisTurn: [], mods: [], damageTaken: 0, damageFrom: [], castLog: [], entered: 0, prevTurn: { cast: [], entered: 0 }, drawsThisTurn: 0, poison: 0 }));
    for (const i of [0, 1]) {
      this.players[i].library = this.shuffle(decks[i].map((def) => ({ id: this.nextId++, def, owner: i, art: def.art })));
    }
    this.stack = [];
    this.turn = 0;
    this.active = opts.first ?? (this.rng() < 0.5 ? 0 : 1);
    this.first = this.active;
    this.winner = null;
    this.waiting = null;
    this.combat = { attackers: [], blocks: {}, blocked: [], bands: [] };
    this.asks = []; this.curAsk = null; this.idle = []; this.inAsk = false; this.prevWaiting = null;
    this.delayed = []; this.shields = []; this.extraTurns = []; this.ghosts = []; this.pendingCallbacks = []; this.ver = 0; this.deathWatch = []; this.turnSpells = []; this.blockLog = []; this.ts = 0; this.legendPending = new Set(); this.damageLog = []; this.currentController = null;
    this.diedThisTurn = 0; this.noCombatDamage = false;
    this.inSba = false; this.sbaAgain = false; this._tyGuard = false; this._depth = 0;
    this.opts = opts; this.mull = null;
    for (const i of [0, 1]) this.draw(i, 7, true);
    if (opts.mulligan) {
      // opening-hand flow: coin flip (the winner plays first), then keep / London mulligan for both players
      this.emit({ type: 'coin', winner: this.first });
      this.say(`${this.players[this.first].name} wins the coin flip and plays first.`, { kind: 'coin', player: this.first });
      this.mull = { count: [0, 0], kept: [false, false] };
      this.nextMulligan();
    } else this.startTurn();
  }

  // ---------- mulligan (opts.mulligan) ----------
  mullAuto(pid) { return this.opts.autoMulligan === true || (Array.isArray(this.opts.autoMulligan) && this.opts.autoMulligan.includes(pid)); }
  autoKeep(pid) {
    const m = this.mull, hand = this.players[pid].hand, size = hand.length;
    const lands = hand.filter((c) => c.def.types.includes('Land')).length;
    return m.count[pid] >= 6 || size <= 4 || (lands >= 2 && lands <= size - 2);
  }
  autoBottom(pid, n) {
    const hand = this.players[pid].hand, lands = hand.filter((c) => c.def.types.includes('Land')).length;
    const score = (c) => (c.def.types.includes('Land') ? (lands > 4 ? 5 : -1) : cmcOf(c.def));
    return [...hand].sort((a, b) => score(b) - score(a)).slice(0, n);
  }
  nextMulligan() {
    const m = this.mull; if (!m) return;
    for (const pid of [this.first, this.opp(this.first)]) {
      if (m.kept[pid]) continue;
      if (this.mullAuto(pid)) {
        let guard = 0;
        while (!this.autoKeep(pid) && guard++ < 8) this.doMulligan(pid);
        const n = m.count[pid];
        if (n > 0) this.doBottom(pid, this.autoBottom(pid, n));
        m.kept[pid] = true; continue;
      }
      this.waiting = { kind: 'mulligan', player: pid, hand: [...this.players[pid].hand], count: m.count[pid], canMulligan: m.count[pid] < 6 };
      return;
    }
    this.mull = null; this.waiting = null; this.startTurn();
  }
  doMulligan(pid) {
    const p = this.players[pid], m = this.mull;
    p.library.push(...p.hand); p.hand = []; this.shuffle(p.library);
    this.draw(pid, 7, true); m.count[pid]++;
    this.emit({ type: 'mulligan', pid, count: m.count[pid] });
    this.say(`${p.name} takes a mulligan (${m.count[pid]}).`, { kind: 'mulligan', player: pid });
  }
  doBottom(pid, cards) {
    const p = this.players[pid];
    for (const c of cards) { p.hand = p.hand.filter((x) => x !== c); p.library.unshift(c); }
    this.say(`${p.name} puts ${cards.length} card${cards.length === 1 ? '' : 's'} on the bottom of the library.`, { kind: 'mulligan', player: pid });
  }
  keepHand(pid) {
    const w = this.waiting; if (w?.kind !== 'mulligan' || w.player !== pid) return false;
    const n = this.mull.count[pid];
    if (n > 0) { this.waiting = { kind: 'bottom', player: pid, n, hand: [...this.players[pid].hand] }; return true; }
    this.mull.kept[pid] = true; this.say(`${this.players[pid].name} keeps.`, { kind: 'mulligan', player: pid }); this.nextMulligan(); return true;
  }
  mulligan(pid) {
    const w = this.waiting; if (w?.kind !== 'mulligan' || w.player !== pid || !w.canMulligan) return false;
    this.doMulligan(pid);
    this.waiting = { kind: 'mulligan', player: pid, hand: [...this.players[pid].hand], count: this.mull.count[pid], canMulligan: this.mull.count[pid] < 6 };
    return true;
  }
  bottomCards(pid, cards) {
    const w = this.waiting; if (w?.kind !== 'bottom' || w.player !== pid) return false;
    const hand = this.players[pid].hand;
    const cs = cards.map((c) => (typeof c === 'object' ? c : hand.find((x) => x.id === c)));
    if (cs.length !== w.n || cs.some((c) => !c || !hand.includes(c)) || new Set(cs).size !== cs.length) return false;
    this.doBottom(pid, cs);
    this.mull.kept[pid] = true; this.say(`${this.players[pid].name} keeps.`, { kind: 'mulligan', player: pid }); this.nextMulligan(); return true;
  }


  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  shuffleLibrary(pid) { this.shuffle(this.players[pid].library); this.emit({ type: 'shuffle', pid }); }
  // text log (g.log) plus structured entries (g.logEvents): {turn, step, player, kind, text, cardIds}
  // counts rng uses so undo can tell whether anything random happened since a snapshot
  wrapRng(base) {
    const f = () => { this.rngCalls++; return base(); };
    if (base.getState) { f.getState = base.getState; f.setState = base.setState; }
    return f;
  }
  say(m, meta = {}) {
    this.logSeq++;
    this.log.push(m); if (this.log.length > 200) this.log.shift();
    this.logEvents.push({ turn: this.turn, step: this.step, player: meta.player ?? this.active, kind: meta.kind || 'info', text: m, cardIds: meta.cards || [] });
    if (this.logEvents.length > 600) this.logEvents.shift();
  }
  emit(e) { this.events.push(e); if (this.events.length > 400) this.events.shift(); }
  opp(p) { return 1 - p; }
  flip() { const won = this.rng() < 0.5; this.emit({ type: 'flip', won }); this.say(`Coin flip: ${won ? 'won' : 'lost'}.`); return won; }
  divide(total, parts) { return Array(parts).fill(Math.floor(total / Math.max(1, parts))); }

  // ---------- lookups ----------
  perm(ref) { if (ref == null) return null; const id = ref.id ?? ref; for (const p of this.players) { const x = p.bf.find((q) => q.id === id); if (x) return x; } return null; }
  allPerms() { return this.players.flatMap((p) => p.bf); }
  host(aura) { return aura.attachedTo != null ? this.perm(aura.attachedTo) : null; }
  refText(r) {
    if (r.kind === 'player') return this.players[r.id].name;
    if (r.kind === 'perm') return this.perm(r)?.card.def.name ?? '?';
    if (r.kind === 'card') return this.findCard(r.id)?.def.name ?? '?';
    return this.stack.find((s) => s.id === r.id)?.card.def.name ?? '?';
  }
  counterAbility(ref) { this.counterSpell(ref); }
  findCard(id) { for (const p of this.players) for (const z of ['hand', 'library', 'gy', 'ex']) { const c = p[z].find((x) => x.id === id); if (c) return c; } return null; }

  // ---------- continuous effects ----------
  // Raw static entries, cached while the battlefield membership is unchanged (ver is bumped by newPerm/leave/setController/ghost changes).
  rawStatics() {
    const sig = `${this.ver}:${this.players[0].bf.length}:${this.players[1].bf.length}:${this.ghosts.length}`;
    if (this._stSig === sig) return this._stRaw;
    const out = [];
    for (const pl of this.players) for (const src of pl.bf) {
      const s = STATIC[src.card.def.name]; if (!s) continue;
      for (const e of asArr(s)) out.push({ src, e });
    }
    for (const gh of this.ghosts) for (const e of gh.ents) out.push({ src: gh.src, e });
    this._stSig = sig; this._stRaw = out;
    this._stFlags = { types: out.some(({ e }) => e.addTypes || e.setSubtypes || e.addSubtypes), lose: out.some(({ e }) => e.loseAbilities), colors: out.some(({ e }) => e.setColors || e.addColors) };
    return out;
  }
  statics() {
    const out = this.rawStatics();
    if (out.length && this._stFlags.lose && !this._lg) { const lost = this.lostSet(); if (lost.size) return out.filter((x) => !lost.has(x.src)); }
    return out;
  }
  rule(key, ...args) { for (const { src, e } of this.statics()) if (e[key] && e[key](this, src, ...args)) return true; return false; }
  ruleSum(key, ...args) { let n = 0; for (const { src, e } of this.statics()) if (e[key]) n += e[key](this, src, ...args) || 0; return n; }
  ruleVals(key, ...args) { const o = []; for (const { src, e } of this.statics()) if (e[key]) { const v = e[key](this, src, ...args); if (v != null && v !== false) o.push(v); } return o; }
  applies(e, src, p) { return e.affects ? !!e.affects(this, src, p) : false; }
  types(p) {
    const base = p.card.def.types;
    this.rawStatics();
    if (this._tyGuard || (!this._stFlags.types && !p.mods.some((m) => m.addTypes))) return base;
    this._tyGuard = true;
    try {
      let t = base;
      for (const { src, e } of this.statics()) if (e.addTypes && this.applies(e, src, p)) t = [...new Set([...t, ...e.addTypes])];
      for (const m of p.mods || []) if (m.addTypes) t = [...new Set([...t, ...m.addTypes])];
      return t;
    } finally { this._tyGuard = false; }
  }
  subtypes(p) {
    const base = p.card.def.subtypes || [];
    this.rawStatics();
    if (this._tyGuard || (!this._stFlags.types && !p.mods.some((m) => m.setSubtypes || m.addSubtypes))) return base;
    this._tyGuard = true;
    try {
      let t = base;
      for (const { src, e } of this.statics()) if ((e.setSubtypes || e.addSubtypes) && this.applies(e, src, p)) t = e.setSubtypes ? [...e.setSubtypes] : [...new Set([...t, ...e.addSubtypes])];
      for (const m of p.mods || []) if (m.setSubtypes) t = [...m.setSubtypes]; else if (m.addSubtypes) t = [...new Set([...t, ...m.addSubtypes])];
      return t;
    } finally { this._tyGuard = false; }
  }
  hasType(p, t) { return this.types(p).includes(t); }
  hasSubtype(p, t) { return this.subtypes(p).includes(t); }
  isCreature(p) { return this.hasType(p, 'Creature'); }
  isLand(p) { return this.hasType(p, 'Land'); }
  colors(p) {
    if (p.colorOverride) return p.colorOverride;
    let c = p.card.def.colors || [];
    if (p.mods) for (const m of p.mods) { if (m.setColors) c = [...m.setColors]; else if (m.addColors) c = [...new Set([...c, ...m.addColors])]; }
    if (this._depth > 3 || !p.mods) return c;
    this.rawStatics(); if (!this._stFlags.colors) return c;
    this._depth++;
    try { for (const { src, e } of this.statics()) if ((e.setColors || e.addColors) && this.applies(e, src, p)) c = e.setColors ? [...e.setColors] : [...new Set([...c, ...e.addColors])]; } finally { this._depth--; }
    return c;
  }
  pt(p) {
    let bp = +p.card.def.power || 0, bt = +p.card.def.toughness || 0;
    const st = this._depth > 3 ? [] : this.statics();
    this._depth++;
    try {
      for (const { src, e } of st) if (e.setPT && this.applies(e, src, p)) { const r = e.setPT(this, src, p); bp = r[0]; bt = r[1]; }
      for (const m of p.mods) if (m.setPT) { bp = m.setPT[0]; bt = m.setPT[1]; }
      for (const [k, n] of Object.entries(p.counters || {})) { const m = k.match(/^([+-]\d+)\/([+-]\d+)$/); if (m) { bp += n * +m[1]; bt += n * +m[2]; } }
      for (const m of p.mods) { bp += m.p || 0; bt += m.t || 0; }
      for (const { src, e } of st) {
        if (e.power == null && e.toughness == null) continue;
        if (!this.applies(e, src, p)) continue;
        bp += typeof e.power === 'function' ? e.power(this, src, p) : e.power || 0;
        bt += typeof e.toughness === 'function' ? e.toughness(this, src, p) : e.toughness || 0;
      }
    } finally { this._depth--; }
    if (p.mods.some((m) => m.swapPT)) [bp, bt] = [bt, bp];
    return [bp, bt];
  }
  power(p) { return this.pt(p)[0]; }
  toughness(p) { return this.pt(p)[1]; }
  kw(p) {
    const k = keywordsOf(p.card.def);
    for (const m of p.mods || []) for (const x of asArr(m.kw)) k.add(x);
    if (this._depth > 3) return k;
    this._depth++;
    try {
      for (const { src, e } of this.statics()) {
        if (!(e.kw || e.removeKw) || !this.applies(e, src, p)) continue;
        for (const x of asArr(typeof e.kw === 'function' ? e.kw(this, src, p) : e.kw)) k.add(x);
        for (const x of asArr(e.removeKw)) k.delete(x);
      }
    } finally { this._depth--; }
    for (const m of p.mods || []) for (const x of asArr(m.removeKw)) { if (x.endsWith('*')) { for (const y of [...k]) if (y.startsWith(x.slice(0, -1))) k.delete(y); } else k.delete(x); }
    if (p.textChange) {
      for (const x of [...k]) {
        const w = Object.entries(WALKS).find(([kk]) => kk === x);
        if (w && p.textChange.land?.[w[1]]) { k.delete(x); k.add(p.textChange.land[w[1]].toLowerCase() + 'walk'); }
        if (x.startsWith('pro:') && p.textChange.color?.[x.slice(4)]) { k.delete(x); k.add('pro:' + p.textChange.color[x.slice(4)]); }
      }
    }
    return k;
  }
  // Magical Hack / Sleight of Mind: only keyword text (landwalk, protection) is rewritten; card code cannot be re-targeted
  changeText(perm, kind, from, to) { const t = (perm.textChange ||= { land: {}, color: {} }); const m = t[kind]; const prev = Object.entries(m).find(([, v]) => v === from); if (prev) m[prev[0]] = to; else m[from] = to; this.emit({ type: 'buff', id: perm.id }); }
  kwCard(card) { return keywordsOf(card.def); }
  abilitiesOf(p) {
    let base = this.lostSet().has(p) ? [] : defAbilities(p.card.def);
    for (const [cn, n] of Object.entries(p.counters || {})) if (n > 0 && COUNTER_ABILITIES[cn]) base = [...base, ...COUNTER_ABILITIES[cn]];
    for (const { src, e } of this.statics()) {
      if (!(e.setAbilities || e.addAbilities) || !this.applies(e, src, p)) continue;
      if (e.setAbilities) base = asArr(e.setAbilities(this, src, p));
      else base = [...base, ...asArr(e.addAbilities(this, src, p))];
    }
    return base;
  }
  attackedThisTurn(p) { return p.attackedTurn === this.turn; }
  addMod(p, m) { if (p) { p.mods.push({ until: 'eot', ...m }); this.emit({ type: 'buff', id: p.id }); } }
  addPlayerMod(pid, m) { this.players[pid].mods.push({ until: 'eot', ...m }); }
  addCounters(p, name, n = 1) {
    if (!p) return;
    p.counters ||= {};
    p.counters[name] = (p.counters[name] || 0) + n;
    if (p.counters[name] <= 0) delete p.counters[name];
    this.emit({ type: 'buff', id: p.id });
    this.sba();
  }

  // ---------- events ----------
  self(perm, ev, ...args) {
    if (this.lostSet().has(perm)) return undefined;
    const h = TRIGGERS[perm.card.def.name]?.[ev]; const x = perm.extraTriggers?.[ev];
    const r = h ? h(this, perm, ...args) : undefined;
    if (x) x(this, perm, ...args);
    for (const m of perm.mods || []) if (typeof m[ev] === 'function') m[ev](this, perm, ...args);
    return r;
  }
  // one-shot watcher: fn(g, perm) when that creature dies (before end of turn when opts.until === 'eot', the default)
  whenDies(perm, fn, opts = {}) { this.deathWatch.push({ id: perm.id, fn, until: opts.until || 'eot' }); }
  gyAbove(card) { const gy = this.players[card.owner].gy; return gy.slice(gy.indexOf(card) + 1); }
  fire(ev, ...args) {
    for (const pid of [this.active, this.opp(this.active)]) {
      const lost = this.lostSet();
      for (const perm of [...this.players[pid].bf]) {
        if (this.winner) return;
        if (lost.has(perm)) continue;
        const h = TRIGGERS[perm.card.def.name]?.[ev]; const x = perm.extraTriggers?.[ev];
        const mh = perm.mods.filter((m) => typeof m[ev] === 'function');
        if ((h || x || mh.length) && this.players[perm.controller].bf.includes(perm)) { if (h) h(this, perm, ...args); if (x) x(this, perm, ...args); for (const m of mh) m[ev](this, perm, ...args); }
      }
      for (const card of [...this.players[pid].gy]) {
        const h = TRIGGERS[card.def.name]?.gy?.[ev];
        if (h && this.players[pid].gy.includes(card)) h(this, card, ...args);
      }
      for (const card of [...this.players[pid].ex]) {
        const h = TRIGGERS[card.def.name]?.ex?.[ev];
        if (h && this.players[pid].ex.includes(card)) h(this, card, ...args);
      }
    }
  }
  // triggered ability on the stack (opt-in): g.trigger(sourcePerm, 'text', (g, item) => {...}, {targets})
  trigger(src, text, fn, opts = {}) {
    const item = { id: this.nextId++, kind: 'ability', card: src.card, source: src, controller: opts.controller ?? src.controller, targets: opts.targets || [], specs: [], effect: { text, resolve: (g, it) => fn(g, it), trigger: true }, x: 0, choices: {} };
    this.stack.push(item); this.say(`${src.card.def.name} triggers: ${text}`); this.emit({ type: 'cast', id: src.card.id });
    return item;
  }
  lostSet() {
    if (this._lg) return NOLOST;
    const raw = this.rawStatics();
    if (!this._stFlags.lose) return NOLOST;
    const ents = raw.filter(({ e }) => e.loseAbilities);
    if (!ents.length) return NOLOST;
    this._lg = true;
    try { const set = new Set(); for (const p of this.allPerms()) if (ents.some(({ src, e }) => this.applies(e, src, p))) set.add(p); return set; } finally { this._lg = false; }
  }
  delay(when, fn, opts = {}) { this.delayed.push({ when, fn, pid: opts.pid ?? this.active, turn: this.turn }); }
  runDelayed(when, pid) {
    const due = this.delayed.filter((d) => d.when === when && ((when !== 'upkeep' && when !== 'main') || d.pid === pid));
    this.delayed = this.delayed.filter((d) => !due.includes(d));
    for (const d of due) d.fn(this);
  }

  // ---------- choices ----------
  ask(pid, req, cb) {
    this.asks.push({ pid, req, cb });
    this.pumpAsk();
  }
  pumpAsk() {
    while (!this.curAsk && this.asks.length) {
      if (this.winner) { this.asks = []; break; }
      const a = this.asks.shift();
      if (this.auto.has(a.pid)) { a.cb(this.autoFor(a.req)); continue; }
      if (!this.inAsk) { this.inAsk = true; this.prevWaiting = this.waiting; }
      this.curAsk = a;
      this.waiting = { kind: 'choice', player: a.pid, type: a.req.type, prompt: a.req.prompt || '', ...a.req, options: a.req.options };
    }
    this.settle();
  }
  settle() {
    if (this.curAsk || this.asks.length) return;
    const q = this.idle; this.idle = [];
    const wasIn = this.inAsk;
    this.inAsk = false;
    if (q.length) { for (const fn of q) fn(); }
    else if (wasIn && !this.winner) this.waiting = this.prevWaiting;
    this.prevWaiting = null;
  }
  whenIdle(fn) { if (this.curAsk || this.asks.length) this.idle.push(fn); else fn(); }
  autoFor(req) {
    if (req.auto !== undefined) return typeof req.auto === 'function' ? req.auto(this) : req.auto;
    if (req.type === 'yesno') return false;
    if (req.type === 'cardName') return req.names[0];
    if (req.type === 'number') return req.min ?? 0;
    const opts = [...req.options].sort((a, b) => (b.score || 0) - (a.score || 0));
    return opts.slice(0, Math.min(req.max ?? 1, Math.max(req.min ?? 1, 1))).map((o) => o.value);
  }
  autoAnswer() { return this.curAsk ? this.autoFor(this.curAsk.req) : undefined; }
  choose(pid, answer) {
    const a = this.curAsk; if (!a || a.pid !== pid) return false;
    const r = a.req; let v = answer;
    if (r.type === 'yesno') v = !!answer;
    else if (r.type === 'cardName') { v = String(answer); r._set ||= new Set(r.names); if (!r._set.has(v)) return false; }
    else if (r.type === 'number') { v = Math.floor(+answer); if (!(v >= (r.min ?? 0) && v <= (r.max ?? Infinity))) return false; }
    else {
      if (!Array.isArray(answer)) v = [answer];
      const vals = new Set(r.options.map((o) => o.value));
      if (new Set(v).size !== v.length || !v.every((x) => vals.has(x)) || v.length < (r.min ?? 1) || v.length > (r.max ?? 1)) return false;
    }
    this.curAsk = null; this.waiting = null;
    a.cb(v);
    this.pumpAsk();
    return true;
  }
  // "you may pay cost" helper: cb(paid). Skips the question when the player cannot pay.
  mayPay(pid, cost, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    const c = typeof cost === 'string' ? parseCost(cost) : cost;
    if (!this.canPay(pid, c)) return cb(false);
    this.ask(pid, { type: 'yesno', prompt: opts.prompt || `Pay ${typeof cost === 'string' ? cost : 'the cost'}?`, source: opts.source, auto: opts.auto ?? true }, (yes) => {
      if (yes && this.pay(pid, c)) cb(true); else cb(false);
    });
  }
  pickCards(pid, cards, opts, cb) {
    cb ||= opts.cb;
    const options = cards.map((c) => ({ value: c.id, label: c.def.name, card: c.def, score: opts.score ? opts.score(c) : 0 }));
    this.ask(pid, { type: 'pick', prompt: opts.prompt || 'Choose', options, min: opts.min ?? 1, max: opts.max ?? opts.min ?? 1, source: opts.source }, (ids) => cb(ids.map((id) => cards.find((c) => c.id === id))));
  }
  pickPerms(pid, perms, opts, cb) {
    const options = perms.map((p) => ({ value: p.id, label: p.card.def.name, card: p.card.def, ref: { kind: 'perm', id: p.id }, score: opts.score ? opts.score(p) : 0 }));
    this.ask(pid, { type: 'pick', prompt: opts.prompt || 'Choose', options, min: opts.min ?? 1, max: opts.max ?? opts.min ?? 1, source: opts.source, auto: opts.auto }, (ids) => cb(ids.map((id) => this.perm(id)).filter(Boolean)));
  }
  // choose a damage source (Circle of Protection): permanents and spells matching pred
  chooseSource(pid, pred, opts, cb) {
    const srcs = [...this.allPerms().filter(pred), ...this.stack.filter((s) => pred(s))];
    if (!srcs.length) return cb(null);
    const options = srcs.map((s) => ({ value: s.card.id, label: s.card.def.name, card: s.card.def, score: 0 }));
    this.ask(pid, { type: 'pick', prompt: opts.prompt || 'Choose a source', options, min: 1, max: 1, source: opts.source }, ([id]) => cb(id));
  }
  // chosen discard
  // onDiscarded(g, card, pid, causeController) is a hook on the discarded card itself (Psychic Purge); onAnyDiscard is broadcast
  afterDiscard(pid, card) { const cause = { controller: this.currentController, kind: this.currentKind || (this.step === 'cleanup' ? 'cleanup' : null) }; TRIGGERS[card.def.name]?.onDiscarded?.(this, card, pid, cause); this.fire('onAnyDiscard', pid, card, cause); }
  discardChoice(pid, n, cb) {
    const p = this.players[pid]; n = Math.min(n, p.hand.length);
    if (!n) return cb?.([]);
    this.pickCards(pid, p.hand, { prompt: `Discard ${n} card${n > 1 ? 's' : ''}`, min: n, score: (c) => -cmcOf(c.def) }, (cs) => {
      for (const c of cs) { p.hand = p.hand.filter((x) => x !== c); p.gy.push(c); this.say(`${p.name} discards ${c.def.name}.`); this.afterDiscard(pid, c); }
      cb?.(cs);
    });
  }
  search(pid, pred, opts = {}, cb) {
    const p = this.players[pid]; const zone = opts.zone || 'library';
    const matches = p[zone].filter((c) => pred(c));
    const count = opts.count ?? 1;
    const done = (cards) => {
      for (const c of cards) {
        p[zone] = p[zone].filter((x) => x !== c);
        const to = opts.to || 'hand';
        if (to === 'bf') this.putOntoBattlefield(c, pid, { from: null }); else p[to].push(c);
        this.say(`${p.name} ${to === 'bf' ? 'puts' : 'takes'} ${c.def.name}${to === 'hand' ? ' into hand' : ''}.`);
      }
      if (zone === 'library' && opts.shuffle !== false) this.shuffleLibrary(pid);
      cb?.(cards);
    };
    if (!matches.length) return done([]);
    const min = opts.optional === false ? Math.min(count, matches.length) : (opts.optional ? 0 : Math.min(count, matches.length));
    const options = matches.map((c) => ({ value: c.id, label: c.def.name, card: c.def, score: cmcOf(c.def) }));
    this.ask(pid, { type: 'pick', prompt: opts.prompt || 'Search your library', options, min, max: Math.min(count, matches.length), source: opts.source }, (ids) => done(ids.map((id) => matches.find((c) => c.id === id))));
  }

  // ---------- zones ----------
  draw(pid, n = 1, silent) {
    this.undoBarrier();
    const p = this.players[pid];
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      if (!silent) {
        p.drawsThisTurn++; if (this.step === 'draw' && this.active === pid) p.drawsThisStep = (p.drawsThisStep || 0) + 1;
        const ctx = { n: p.drawsThisTurn, nth: p.drawsThisTurn, step: this.step, active: this.active, drawsThisStep: p.drawsThisStep || 0, firstInDrawStep: this.step === 'draw' && this.active === pid && p.drawsThisStep === 1 };
        if (this.ruleVals('replaceDraw', pid, ctx).length) continue;
      }
      if (!p.library.length) { p.drewEmpty = true; continue; }
      const c = p.library.pop(); p.hand.push(c); drawn++; p.lastDrawn = { card: c, turn: this.turn }; if (!silent) (p.drawnThisTurn ||= []).push(c.id);
    }
    if (!silent) { this.say(`${p.name} draws ${n > 1 ? n + ' cards' : 'a card'}.`, { kind: 'draw', player: pid }); if (drawn) this.fire('onDraw', pid, drawn); }
  }
  reveal(viewer, target, zone = 'hand') {
    this.undoBarrier(); this.emit({ type: 'reveal', viewer, target, zone, cards: this.players[target][zone].map((c) => ({ id: c.id, name: c.def.name })) }); }
  // Drain Power: `from` activates a mana ability of each land (choosing colours), then `to` gets all the mana in from's pool
  drainMana(from, to, cb) {
    const lands = this.players[from].bf.filter((l) => this.isLand(l) && !l.tapped && this.abilitiesOf(l).some((a) => a.mana && a.cost.tap && !a.cost.mana));
    const step = (i) => {
      if (i >= lands.length) { const fp = this.players[from].pool, tp = this.players[to].pool; for (const k of Object.keys(fp)) { tp[k] += fp[k]; fp[k] = 0; } this.say(`${this.players[to].name} adds the drained mana.`); cb?.(); return; }
      const l = lands[i]; const ab = this.abilitiesOf(l).find((a) => a.mana && a.cost.tap && !a.cost.mana);
      const produce = (c) => { l.tapped = true; this.emit({ type: 'tap', id: l.id }); this.addMana(from, c, ab.mana.amount); this.fire('onManaTapped', l, from, [c]); this.fire('onAnyTap', l); step(i + 1); };
      if (ab.mana.colors.length === 1) return produce(ab.mana.colors[0]);
      this.ask(from, { type: 'pick', prompt: `Choose a colour for ${l.card.def.name}`, options: ab.mana.colors.map((c) => ({ value: c, label: c })), min: 1, max: 1, auto: [ab.mana.colors[0]] }, ([c]) => produce(c));
    };
    step(0);
  }
  undoBarrier() { this.undoEpoch++; this.undoSnap = null; }
  mill(pid, n) {
    this.undoBarrier(); const p = this.players[pid]; for (let i = 0; i < n && p.library.length; i++) p.gy.push(p.library.pop()); }
  discardRandom(pid) {
    const p = this.players[pid]; if (!p.hand.length) return;
    const c = p.hand.splice(Math.floor(this.rng() * p.hand.length), 1)[0]; p.gy.push(c);
    this.say(`${p.name} discards ${c.def.name}.`); this.afterDiscard(pid, c);
  }
  gainLife(pid, n) {
    if (n <= 0) return;
    const rep = this.ruleVals('replaceLifeGain', pid, n)[0];
    if (rep) return;
    this.players[pid].life += n; this.emit({ type: 'heal', pid }); this.say(`${this.players[pid].name} gains ${n} life.`, { kind: 'life', player: pid });
    this.fire('onLifeGain', pid, n);
  }
  loseLife(pid, n) {
    if (n <= 0) return;
    this.players[pid].life -= n; this.emit({ type: 'dmg', target: { kind: 'player', id: pid }, n });
    this.say(`${this.players[pid].name} loses ${n} life.`, { kind: 'life', player: pid });
    this.fire('onLifeLoss', pid, n);
    this.sba();
  }
  // restrict: 'Artifact' | 'Creature' | ... (card type of the spell it may pay for) or (g, card) => bool. Restricted mana only pays spells.
  addMana(pid, colour, n = 1, restrict = null) { if (restrict) this.players[pid].poolR.push({ c: colour, n, only: restrict }); else this.players[pid].pool[colour] += n; }
  restrictOk(restrict, ctx) { return !!ctx?.card && (typeof restrict === 'function' ? restrict(this, ctx.card) : restrict === 'any' || ctx.card.def.types.includes(restrict)); }
  newPerm(card, controller, opts = {}) {
    const perm = { id: card.id, card, controller, baseCtl: controller, tapped: !!opts.tapped, sick: true, damage: 0, mods: [], counters: {}, attachedTo: opts.attachedTo ?? null, attacking: false, regen: 0, used: {}, x: opts.x ?? 0, enteredTurn: this.turn, damagedBy: [], ts: ++this.ts };
    if (opts.targetRef) perm.targetRef = opts.targetRef;
    if (opts.played) perm.played = true;
    this.players[controller].bf.push(perm); this.ver++;
    if (!card.token) { this.players[controller].entered++; this.players[controller].enteredNonToken.push(this.turn); if (this.players[controller].enteredNonToken.length > 30) this.players[controller].enteredNonToken.shift(); }
    if (!opts.tapped && this.rule('entersTapped', perm)) perm.tapped = true;
    this.emit({ type: 'enter', id: perm.id });
    if (opts.counters) for (const [k, n] of Object.entries(opts.counters)) perm.counters[k] = n;
    if (!opts.silent) { this.self(perm, 'onEnter'); this.fire('onAnyEnter', perm); }
    return perm;
  }
  putOntoBattlefield(card, controller, opts = {}) {
    if (opts.from !== null) for (const pl of this.players) for (const z of ['hand', 'library', 'gy', 'ex']) { const i = pl[z].indexOf(card); if (i >= 0) pl[z].splice(i, 1); }
    this.say(`${card.def.name} enters the battlefield under ${this.players[controller].name}'s control.`, { kind: 'enter', cards: [card.id], player: controller });
    return this.newPerm(card, controller, opts);
  }
  reanimate(pid, card, opts) { return this.putOntoBattlefield(card, pid, opts); }
  createToken(pid, spec) {
    const kwLines = (spec.kw || []).map(cap).join('\n');
    const def = {
      name: spec.name, manaCost: '', manaValue: 0, types: spec.types || ['Creature'], subtypes: spec.subtypes || [], supertypes: spec.supertypes || [], colors: spec.colors || [],
      text: [spec.text || '', kwLines].filter(Boolean).join('\n'), power: String(spec.power ?? 0), toughness: String(spec.toughness ?? 0), token: true, type: spec.type || 'Token', art: spec.art,
    };
    const card = { id: this.nextId++, def, owner: pid, token: true, art: spec.art };
    this.say(`${this.players[pid].name} creates a ${spec.name} token.`);
    const perm = this.newPerm(card, pid, { silent: true });
    for (const k of spec.grant || []) this.addMod(perm, { kw: k, until: 'forever' });
    this.emit({ type: 'token', id: perm.id });
    this.self(perm, 'onEnter'); this.fire('onAnyEnter', perm);
    return perm;
  }
  // opts.unblock: attackers that were blocked only by this creature become unblocked (False Orders, Imprison)
  removeFromCombat(perm, opts = {}) {
    this.combat.attackers = this.combat.attackers.filter((a) => a !== perm.id);
    delete this.combat.blocks[perm.id];
    for (const k of Object.keys(this.combat.blocks)) {
      const had = this.combat.blocks[k].includes(perm.id);
      this.combat.blocks[k] = this.combat.blocks[k].filter((b) => b !== perm.id);
      if (opts.unblock && had && !this.combat.blocks[k].length) { this.combat.blocked = this.combat.blocked.filter((a) => a !== +k); delete this.combat.blocks[k]; }
    }
    perm.attacking = false;
  }
  leave(perm, zone, opts = {}) {
    const pl = this.players[perm.controller];
    if (!pl.bf.includes(perm)) return false;
    const wasCreature = this.isCreature(perm);
    if (zone === 'gy' && !this.lostSet().has(perm)) { const r = TRIGGERS[perm.card.def.name]?.replaceDie?.(this, perm); if (r) zone = r; }
    for (const a of this.allPerms()) if (a.attachedTo === perm.id) this.self(a, 'onHostLeave', perm, zone);
    { const ents = asArr(STATIC[perm.card.def.name]).filter((e) => e.lingers); if (ents.length) this.ghosts.push({ src: perm, ents }); }
    pl.bf = pl.bf.filter((x) => x !== perm); this.ver++;
    for (const e of [...(this.phased || [])]) if (e.until === perm.id) this.phaseIn(e);
    this.removeFromCombat(perm);
    if (zone === 'gy' && perm.mods.some((m) => m.exileOnDie)) zone = 'ex';
    if (!perm.card.token) this.players[perm.card.owner][zone === 'lib' ? 'library' : zone].push(perm.card);
    this.shields = this.shields.filter((s) => !(s.ref && s.ref.kind === 'perm' && s.ref.id === perm.id));
    if (zone === 'gy') { if (wasCreature) this.diedThisTurn++; }
    // auras fall off
    for (const a of this.allPerms()) if (a.attachedTo === perm.id) this.leave(a, 'gy');
    this.self(perm, 'onLeave', zone);
    if (zone === 'gy') {
      if (wasCreature) this.self(perm, 'onDie');
      perm.leftBy = opts.cause || 'sba';
      this.fire('onAnyDie', perm, perm.leftBy);
      if (wasCreature) this.fire('onCreatureDies', perm);
      if (wasCreature && this.deathWatch.length) { const dw = this.deathWatch.filter((d) => d.id === perm.id); this.deathWatch = this.deathWatch.filter((d) => d.id !== perm.id); for (const d of dw) d.fn(this, perm); }
    }
    if (perm.card.baseDef) { perm.card.def = perm.card.baseDef; delete perm.card.baseDef; }
    this.sba();
    return true;
  }
  destroy(perm, opts = {}) {
    if (!perm || !this.perm(perm)) return false;
    if (this.kw(perm).has('indestructible')) return false;
    { const rd = perm.mods.find((m) => m.replaceDestroy && m.replaceDestroy(this, perm)); if (rd) { perm.mods = perm.mods.filter((m) => m !== rd); return false; } }
    const canRegen = !opts.noRegen && !perm.mods.some((m) => m.noRegen);
    if (canRegen && (perm.regen > 0 || this.rule('autoRegen', perm) || TRIGGERS[perm.card.def.name]?.autoRegen?.(this, perm))) {
      if (perm.regen > 0) perm.regen--; perm.damage = 0; perm.tapped = true; this.removeFromCombat(perm);
      this.say(`${perm.card.def.name} regenerates.`); this.emit({ type: 'regen', id: perm.id });
      return false;
    }
    this.say(`${perm.card.def.name} is destroyed.`, { kind: 'die', cards: [perm.id], player: perm.controller }); this.emit({ type: 'die', id: perm.id });
    this.leave(perm, 'gy', { cause: 'destroy' });
    return true;
  }
  sacrifice(perm) { if (!perm || !this.perm(perm)) return false; this.say(`${this.players[perm.controller].name} sacrifices ${perm.card.def.name}.`, { kind: 'die', cards: [perm.id], player: perm.controller }); this.emit({ type: 'die', id: perm.id }); return this.leave(perm, 'gy', { cause: 'sacrifice' }); }
  exile(perm) { if (!perm || !this.perm(perm)) return; this.say(`${perm.card.def.name} is exiled.`, { kind: 'exile', cards: [perm.id], player: perm.controller }); this.leave(perm, 'ex'); }
  bounce(perm) { if (!perm || !this.perm(perm)) return; this.say(`${perm.card.def.name} returns to hand.`, { kind: 'bounce', cards: [perm.id], player: perm.controller }); this.emit({ type: 'bounce', id: perm.id }); this.leave(perm, 'hand'); }
  regenerate(perm) { if (perm && perm.mods.some((m) => m.noRegen)) { this.say(`${perm.card.def.name} can't be regenerated.`); return; } if (perm) { perm.regen = (perm.regen || 0) + 1; this.say(`${perm.card.def.name} gets a regeneration shield.`); } }
  // Phasing (Oubliette): the permanent and its Auras leave every query without leave/enter events until `until` (a permanent) leaves the battlefield.
  phaseOut(perm, opts = {}) {
    if (!perm || !this.perm(perm)) return;
    const group = [perm, ...this.allPerms().filter((a) => a.attachedTo === perm.id)];
    for (const x of group) {
      this.removeFromCombat(x);
      const pl = this.players[x.controller]; pl.bf = pl.bf.filter((q) => q !== x);
      (this.phased ||= []).push({ perm: x, host: perm.id, until: opts.until?.id ?? null, tap: !!opts.tap });
      this.emit({ type: 'phase', id: x.id, out: true });
    }
    this.ver++; this.say(`${perm.card.def.name} phases out.`, { kind: 'info', cards: [perm.id] });
  }
  phaseIn(entry) {
    const x = entry.perm; this.phased = this.phased.filter((e) => e !== entry);
    this.players[x.controller].bf.push(x); this.ver++;
    if (entry.tap && entry.host === x.id) x.tapped = true;
    this.emit({ type: 'phase', id: x.id, out: false });
  }
  attach(aura, host) { aura.attachedTo = host.id; this.emit({ type: 'attach', id: aura.id, host: host.id }); }
  // opts.permanent: new base controller; opts.until:'eot': control reverts at cleanup (Disharmony)
  setController(perm, pid, opts = {}) {
    if (pid !== perm.controller && this.rule('cantGainControl', perm, pid)) return;
    if (opts.until === 'eot' && pid !== perm.baseCtl) perm.tempCtl = pid;
    if (perm.controller === pid) { if (opts.permanent) perm.baseCtl = pid; return; }
    const from = this.players[perm.controller];
    from.bf = from.bf.filter((x) => x !== perm);
    this.removeFromCombat(perm);
    perm.controller = pid; perm.sick = true; perm.tapped = perm.tapped;
    if (opts.permanent) perm.baseCtl = pid;
    this.players[pid].bf.push(perm); this.ver++;
    this.emit({ type: 'control', id: perm.id, to: pid });
    this.say(`${this.players[pid].name} gains control of ${perm.card.def.name}.`);
  }
  counterSpell(ref) {
    const i = this.stack.findIndex((s) => s.id === ref.id); if (i < 0) return;
    const [s] = this.stack.splice(i, 1); this.emit({ type: 'counter', id: s.card.id });
    if (s.kind === 'spell' && !s.copy) this.players[s.card.owner].gy.push(s.card);
    this.say(`${s.card.def.name} is countered.`, { kind: 'counter', cards: [s.card.id], player: s.controller });
  }

  tap(perm, silent) { if (perm.tapped) return; perm.tapped = true; this.emit({ type: 'tap', id: perm.id }); this.self(perm, 'onTap'); if (!silent) this.fire('onAnyTap', perm); }
  untapPerm(perm) { if (!perm.tapped) return; perm.tapped = false; this.emit({ type: 'untap', id: perm.id }); this.self(perm, 'onUntap'); }
  addPoison(pid, n = 1) { this.players[pid].poison += n; this.say(`${this.players[pid].name} gets ${n} poison counter${n > 1 ? 's' : ''}.`, { kind: 'life', player: pid }); this.sba(); }
  // Divine Intervention: nobody wins. winner = {id:-1, draw:true, reason:'draw'}
  drawGame(reason = 'draw') { if (this.winner) return; this.winner = { id: -1, draw: true, reason }; this.waiting = null; this.curAsk = null; this.asks = []; this.say('The game is a draw.'); }
  // "counter target spell unless its controller pays {n}" (Force Spike, Nether Void, In the Eye of Chaos). cb(paid) optional.
  counterUnlessPays(item, n, cb) {
    if (!this.stack.some((s) => s.id === item.id)) return cb?.(true);
    const c = { generic: n, W: 0, U: 0, B: 0, R: 0, G: 0, total: n };
    if (n <= 0) return cb?.(true);
    this.mayPay(item.controller, c, { prompt: `Pay {${n}} or ${item.card.def.name} is countered`, source: item.card.id, auto: true }, (paid) => { if (!paid) this.counterSpell({ id: item.id }); cb?.(paid); });
  }
  // "choose a card name": cb(name). The list is opts.catalogue (defs or names) if given to the Game, else setCatalogue(), else every implemented card.
  catalogueNames() {
    const src = this.opts?.catalogue || CATALOGUE;
    if (src) return [...new Set(src.map((c) => (typeof c === 'string' ? c : c.name)))].sort();
    return [...new Set([...Object.keys(EFFECTS), ...Object.keys(ABILITIES), ...Object.keys(TRIGGERS), ...Object.keys(STATIC), 'Plains', 'Island', 'Swamp', 'Mountain', 'Forest'])].sort();
  }
  nameCard(pid, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    const names = this.catalogueNames();
    this.ask(pid, { type: 'cardName', prompt: opts.prompt || 'Choose a card name', names, source: opts.source, auto: opts.auto ?? names[0] }, cb);
  }
  topRevealed(pid) { return this.rule('revealTop', pid) ? this.players[pid].library[this.players[pid].library.length - 1] || null : null; }
  handsRevealed(pid) { return pid == null ? this.rule('revealHand', 0) || this.rule('revealHand', 1) : this.rule('revealHand', pid); }
  // which zones the UI must show face up (Field of Dreams, Revelation)
  revealed(pid) { return { hand: this.rule('revealHand', pid), top: this.rule('revealTop', pid) }; }
  playerActedLastTurn(pid) { const t = this.players[pid].prevTurn; return t.cast.length > 0 || t.entered > 0; }
  loseGame(pid, reason = 'effect') { if (this.winner) return; this.winner = { id: 1 - pid, reason }; this.waiting = null; this.curAsk = null; this.asks = []; this.say(`${this.players[pid].name} loses the game.`); }
  // enter-as-a-copy / Clone: the card keeps its identity, def is swapped until it leaves the battlefield
  becomeCopy(perm, def, opts = {}) {
    const card = perm.card; card.baseDef ||= card.def;
    card.def = { ...def, types: [...new Set([...def.types, ...(opts.addTypes || [])])], colors: opts.colors || def.colors };
    if (opts.keepColors) card.def.colors = card.baseDef.colors;
    if (opts.extraTriggers) perm.extraTriggers = { ...(perm.extraTriggers || {}), ...opts.extraTriggers };
    perm.kw = null; this.say(`${card.baseDef.name} becomes a copy of ${def.name}.`); this.emit({ type: 'buff', id: perm.id });
  }
  setPriority(pid) { const w = { kind: 'priority', player: pid }; if (this.curAsk || this.asks.length) this.prevWaiting = w; else this.waiting = w; }

  // ---------- damage ----------
  srcColors(src) { if (!src) return []; if (src.card) return this.colors(src); return src.colors || []; }
  preventDamage(ref, amount, opts = {}) { this.shields.push({ ref, n: amount, sourceId: opts.sourceId, sourceColor: opts.sourceColor, filter: opts.filter, until: opts.until || 'eot', once: opts.once, keep: opts.keep, combatOnly: opts.combatOnly, redirect: opts.redirect, onPrevent: opts.onPrevent }); }
  preventNext(ref, n, opts = {}) { this.preventDamage(ref, n, opts); }
  preventCombatDamage() { this.noCombatDamage = true; }
  applyPrevention(src, ref, n, opts) {
    if (opts.combat && this.noCombatDamage) { this.emit({ type: 'prevent', target: ref, n }); return 0; }
    if (ref.kind === 'perm') {
      const t = this.perm(ref);
      if (t) {
        const kw = this.kw(t);
        if (this.srcColors(src).some((c) => kw.has('pro:' + c))) { this.emit({ type: 'prevent', target: ref, n }); return 0; }
      }
    }
    for (const s of [...this.shields]) {
      if (n <= 0) break;
      if (s.ref && (s.ref.kind !== ref.kind || s.ref.id !== ref.id)) continue;
      if (s.combatOnly && !opts.combat) continue;
      if (s.redirect && opts.redirected) continue;
      if (s.sourceId != null && s.sourceId !== src?.card?.id) continue;
      if (s.sourceColor && !this.srcColors(src).includes(s.sourceColor)) continue;
      if (s.filter && !s.filter(src)) continue;
      const avail = Math.max(0, n - (s.keep || 0));
      const used = Math.min(avail, s.n); n -= used; s.n -= used;
      this.emit({ type: 'prevent', target: ref, n: used });
      if (s.onPrevent && used > 0) (this.pendingCallbacks ||= []).push(() => s.onPrevent(this, used, src, ref));
      if (s.redirect && used > 0) { const r = s.redirect; if (typeof r === 'function') (this.pendingCallbacks ||= []).push(() => r(this, src, used, ref)); else { this.pendingRedirects = (this.pendingRedirects || []); this.pendingRedirects.push([src, r, used]); } }
      if (s.n <= 0 || s.once) this.shields = this.shields.filter((x) => x !== s);
    }
    const t = ref.kind === 'perm' ? this.perm(ref) : null;
    for (const { src: ss, e } of this.statics()) if (e.preventDamage && n > 0) n = e.preventDamage(this, ss, { src, target: ref, n, combat: !!opts.combat, perm: t });
    return Math.max(0, n);
  }
  damage(src, ref, n, opts = {}) {
    if (n <= 0) return 0;
    n = this.applyPrevention(src, ref, n, opts);
    if (this.pendingRedirects?.length) { const rd = this.pendingRedirects; this.pendingRedirects = []; for (const [rs, rr, rn] of rd) this.damage(rs, rr, rn, { ...opts, noSba: true, redirected: true }); }
    this.lastPrevented = 0;
    if (this.pendingCallbacks?.length) { const cbs = this.pendingCallbacks; this.pendingCallbacks = []; for (const f of cbs) f(); }
    if (n <= 0) { if (!opts.noSba) this.sba(); return 0; }
    if (ref.kind === 'player') { const pl = this.players[ref.id]; pl.life -= n; pl.damageTaken += n; }
    else { const p = this.perm(ref); if (!p) return 0; p.damage += n; if (src?.card && !p.damagedBy.includes(src.card.id)) p.damagedBy.push(src.card.id); }
    if (src?.kind === 'spell') { const ts = this.turnSpells.find((x) => x.card === src.card); if (ts) ts.damageDealt += n; }
    this.damageLog.push({ src: src?.card?.id ?? null, def: src?.card?.def ?? null, types: src?.card ? (src.mods ? this.types(src) : src.card.def.types) : [], controller: src?.controller ?? null, target: ref, n });
    const rec = src?.card ? { src: src.card.id, def: src.card.def, types: src.mods ? this.types(src) : src.card.def.types, colors: this.colors(src), n } : { src: null, def: null, types: [], colors: [], n };
    if (ref.kind === 'player') this.players[ref.id].damageFrom.push(rec); else { const t = this.perm(ref); if (t) (t.damageFrom ||= []).push(rec); }
    this.emit({ type: 'dmg', target: ref, n, from: src?.card?.id });
    this.say(`${n} damage to ${this.refText(ref)}.`, { kind: 'damage', cards: [src?.card?.id, ref.kind === 'perm' ? ref.id : null].filter((x) => x != null), player: src?.controller });
    const sp = src && src.card ? this.perm(src.card.id) : null;
    if (sp) this.self(sp, 'onDealDamage', ref, n);
    if (ref.kind === 'perm') { const t = this.perm(ref); if (t) this.self(t, 'onDealtDamage', src, n); }
    this.fire('onDamaged', ref, n, src);
    if (!opts.noSba) this.sba();
    return n;
  }

  // ---------- state-based actions ----------
  auraHostOk(a) {
    const spec = a.auraSpec ?? (a.auraSpec = auraSpecOf(a.card.def));
    if (!spec || spec === 'graveyardCreature') return true;
    const h = this.host(a); if (!h) return false;
    if (PERM_SPECS[spec] && !PERM_SPECS[spec](this, h, { pid: a.controller })) return false;
    const kw = this.kw(h);
    if (!asArr(STATIC[a.card.def.name]).some((e) => e.ignoreProtection) && this.colors(a).some((c) => kw.has('pro:' + c))) return false;
    return true;
  }
  sba() {
    if (this.inSba) { this.sbaAgain = true; return; }
    this.inSba = true;
    try {
      let guard = 0;
      do {
        this.sbaAgain = false;
        // control effects
        const sts = this.statics().filter(({ e }) => e.control);
        for (const p of this.allPerms()) {
          let want = p.tempCtl ?? p.baseCtl;
          for (const { src, e } of sts) if (this.applies(e, src, p)) { const c = e.control(this, src, p); if (c != null && !this.rule('cantGainControl', p, c)) want = c; }
          if (want !== p.controller) { this.setController(p, want); this.sbaAgain = true; }
        }
        for (const pl of this.players) for (const p of [...pl.bf]) {
          if (!pl.bf.includes(p)) continue;
          if (p.counters['+1/+1'] && p.counters['-1/-1']) { const m = Math.min(p.counters['+1/+1'], p.counters['-1/-1']); p.counters['+1/+1'] -= m; p.counters['-1/-1'] -= m; for (const k of ['+1/+1', '-1/-1']) if (!p.counters[k]) delete p.counters[k]; }
          if (this.isCreature(p)) {
            const t = this.toughness(p);
            if (t <= 0) { this.say(`${p.card.def.name} is put into the graveyard.`); this.emit({ type: 'die', id: p.id }); this.leave(p, 'gy'); this.sbaAgain = true; }
            else if (p.damage >= t) { this.destroy(p); this.sbaAgain = true; }
          }
        }
        for (const p of this.allPerms()) if (p.attachedTo != null && auraSpecOf(p.card.def) && !this.auraHostOk(p)) { this.say(`${p.card.def.name} falls off.`); this.leave(p, 'gy'); this.sbaAgain = true; }
        for (const pl of this.players) {
          const groups = {};
          for (const p of pl.bf) if (p.card.def.supertypes?.includes('Legendary')) (groups[p.card.def.name] ||= []).push(p);
          for (const [name, grp] of Object.entries(groups)) {
            const key = `${pl.id}:${name}`;
            if (grp.length < 2 || this.legendPending.has(key)) continue;
            this.legendPending.add(key); this.emit({ type: 'legendRule', name, ids: grp.map((x) => x.id), player: pl.id });
            this.pickPerms(pl.id, grp, { prompt: `Legend rule: choose the ${name} to keep`, min: 1, max: 1, score: (p) => p.ts }, ([keep]) => {
              this.legendPending.delete(key);
              for (const p of grp) if (p !== keep && this.perm(p)) { this.say(`${name}: legend rule.`, { kind: 'die', cards: [p.id], player: pl.id }); this.leave(p, 'gy'); }
              this.sbaAgain = true;
            });
          }
        }
        { // world rule: only the newest World permanent stays
          const worlds = this.allPerms().filter((p) => p.card.def.supertypes?.includes('World')).sort((a, b) => b.ts - a.ts);
          for (const w of worlds.slice(1)) { this.emit({ type: 'worldRule', name: w.card.def.name, ids: [w.id], player: w.controller }); this.say(`${w.card.def.name}: world rule.`, { kind: 'die', cards: [w.id], player: w.controller }); this.leave(w, 'gy'); this.sbaAgain = true; }
        }
        for (const p of this.allPerms()) { const h = TRIGGERS[p.card.def.name]?.onState; if (h) h(this, p); }
        for (const pl of this.players) {
          if (pl.poison >= 10 && !this.winner) { this.winner = { id: 1 - pl.id, reason: 'poison' }; this.waiting = null; this.curAsk = null; this.asks = []; this.say(`${this.players[1 - pl.id].name} wins.`); }
          if ((pl.life <= 0 && !this.rule('cantLose', pl.id)) || pl.drewEmpty) {
            if (!this.winner) { this.winner = { id: 1 - pl.id, reason: pl.life <= 0 ? 'life' : 'deck' }; this.waiting = null; this.curAsk = null; this.asks = []; this.say(`${this.players[1 - pl.id].name} wins.`); }
          }
        }
      } while (this.sbaAgain && guard++ < 50);
    } finally { this.inSba = false; }
  }

  // ---------- mana ----------
  manaSources(pid) {
    const ck = this._msc ? `${pid}:${this._mctx?.card?.id ?? ''}` : null;
    if (ck && this._msc.has(ck)) return this._msc.get(ck).map((x) => ({ ...x }));
    const out = this.manaSourcesRaw(pid);
    if (ck) this._msc.set(ck, out.map((x) => ({ ...x })));
    return out;
  }
  manaSourcesRaw(pid) {
    const out = [];
    for (const perm of this.players[pid].bf) {
      const abs = this.abilitiesOf(perm); let otherTap = null;
      for (const ab of abs) {
        if (!ab.mana || ab.cost.mana) continue;
        if (ab.mana.restrict && !this.restrictOk(ab.mana.restrict, this._mctx)) continue;
        if (ab.cost.tap && (perm.tapped || (this.isCreature(perm) && perm.sick && !this.kw(perm).has('haste')))) continue;
        const conv = perm.mods.filter((m) => m.manaConvert);
        const opts = conv.length ? ab.mana.colors.map((c) => conv.reduce((x, m) => m.manaConvert[x] || x, c)) : ab.mana.colors;
        const cc = ab.cost.counter && (typeof ab.cost.counter === 'string' ? { type: ab.cost.counter, n: 1 } : ab.cost.counter);
        let uses = 1;
        if (cc) { uses = Math.floor((perm.counters?.[cc.type] || 0) / cc.n); if (ab.cost.tap) uses = Math.min(uses, 1); }
        if (otherTap === null) otherTap = abs.some((x) => !x.mana && x.cost?.tap) ? 0.5 : 0; // lands with their own tap abilities (manlands) are tapped last
        const rk = ab.cost.sac ? 100 : cc ? 60 : this.isCreature(perm) ? 50 : ab.mana.colors.length + otherTap;
        if (ab.cost.sacOther) { // Priest of Yawgmoth / Ashnod's Altar: one entry per sacrificial candidate
          for (const cand of this.extraCandidates(this.players[pid] === undefined ? pid : pid, perm, ab.cost.sacOther, perm)) out.push({ perm, ab, opts, amount: typeof ab.mana.amount === 'function' ? ab.mana.amount(this, { sacrificed: [cand] }) : ab.mana.amount, counterCost: null, sacChoice: cand, rank: 90 + (typeof ab.mana.amount === 'function' ? 0 : 0) });
          continue;
        }
        for (let u = 0; u < uses; u++) out.push({ perm, ab, opts, amount: typeof ab.mana.amount === 'function' ? ab.mana.amount(this, { sacrificed: [] }) : ab.mana.amount, counterCost: cc || null, rank: rk });
      }
    }
    return out.sort((a, b) => a.rank - b.rank);
  }
  // mana abilities that cost mana (Celestial Prism: {2},{T}: add one mana of any colour)
  converters(pid, excl) {
    const out = [];
    for (const perm of this.players[pid].bf) for (const ab of this.abilitiesOf(perm)) {
      if (!ab.mana || !ab.cost.mana || ab.cost.sac) continue;
      if (ab.cost.tap && (perm.tapped || (this.isCreature(perm) && perm.sick && !this.kw(perm).has('haste')))) continue;
      if (!excl.has(perm)) out.push({ perm, ab, opts: ab.mana.colors, amount: ab.mana.amount });
    }
    return out;
  }
  // Manual mana: tap a permanent's mana ability into the pool (floating mana). colour picks one of several; returns false if impossible.
  tapForMana(pid, permId, a3 = 0, a4 = null, choices = {}) {
    // accepted forms: (pid, permId, idx, colour) or (pid, permId, colour, idx)
    let idx = typeof a3 === 'number' ? a3 : (typeof a4 === 'number' ? a4 : 0), colour = typeof a3 === 'string' ? a3 : typeof a4 === 'string' ? a4 : null;
    const perm = this.players[pid].bf.find((p) => p.id === permId); if (!perm || this.winner) return false;
    const ab = this.abilitiesOf(perm)[idx]; if (!ab?.mana || ab.cost.mana) return false;
    if (ab.mana.restrict === undefined && false) return false;
    if (ab.cost.tap && (perm.tapped || (this.isCreature(perm) && perm.sick && !this.kw(perm).has('haste')))) return false;
    const cc = ab.cost.counter && (typeof ab.cost.counter === 'string' ? { type: ab.cost.counter, n: 1 } : ab.cost.counter);
    if (cc && !(perm.counters?.[cc.type] >= cc.n)) return false;
    let sac = null;
    if (ab.cost.sacOther) {
      const cands = this.extraCandidates(pid, perm, ab.cost.sacOther, perm);
      sac = choices.sac != null ? cands.find((c) => c.id === choices.sac) : cands.sort((x, y) => cmcOf(y.card.def) - cmcOf(x.card.def))[0];
      if (!sac) return false;
    }
    const c = colour && ab.mana.colors.includes(colour) ? colour : ab.mana.colors[0];
    const amount = typeof ab.mana.amount === 'function' ? ab.mana.amount(this, { sacrificed: sac ? [sac] : [] }) : ab.mana.amount;
    if (cc) this.addCounters(perm, cc.type, -cc.n);
    if (ab.cost.tap) { perm.tapped = true; this.emit({ type: 'tap', id: perm.id }); }
    if (sac) this.sacrifice(sac);
    this.addMana(pid, c, amount, ab.mana.restrict || null);
    if (ab.cost.sac) this.leave(perm, 'gy');
    this.fire('onAbilityActivated', { id: 0, kind: 'ability', mana: true, source: perm, controller: pid, tapCost: !!ab.cost.tap });
    if (ab.cost.tap) { this.fire('onManaTapped', perm, pid, [c]); this.fire('onAnyTap', perm); }
    return true;
  }
  // pay-life-as-mana (Channel) and converters are layered on top of the plain planner
  planPayment(pid, cost, excl = new Set(), depth = 0) {
    if (depth === 0 && this.players[pid].mods.some((m) => m.anyMana) && cost.total > cost.generic) cost = { generic: cost.total, W: 0, U: 0, B: 0, R: 0, G: 0, total: cost.total };
    let plan = this.planPlain(pid, cost);
    if (plan) { plan.cost = cost; return plan; }
    if (depth < 2) {
      for (const c of this.converters(pid, excl)) {
        if (c.amount !== 1) continue;
        const cands = [...c.opts.filter((k) => cost[k] > 0), ...(cost.generic > 0 ? ['_'] : [])];
        for (const col of cands) {
          const c2 = { ...cost }; if (col === '_') c2.generic--; else c2[col]--;
          const cc = parseCost(c.ab.cost.mana); for (const k of ['generic', ...COLORS]) c2[k] += cc[k];
          c2.total = c2.generic + COLORS.reduce((a, k) => a + c2[k], 0);
          const ex2 = new Set([...excl, c.perm]);
          const sub = this.planPayment(pid, c2, ex2, depth + 1);
          if (sub) { sub.conv = [...(sub.conv || []), c]; return sub; }
        }
      }
    }
    if (depth === 0 && this.players[pid].mods.some((m) => m.channel)) {
      for (let k = 1; k <= Math.min(cost.generic, this.players[pid].life - 1); k++) {
        const c2 = { ...cost, generic: cost.generic - k, total: cost.total - k };
        const sub = this.planPayment(pid, c2, excl, 1);
        if (sub) { sub.life = k; return sub; }
      }
    }
    return null;
  }
  planPlain(pid, cost) {
    const pool = { ...this.players[pid].pool };
    const need = { W: cost.W, U: cost.U, B: cost.B, R: cost.R, G: cost.G };
    for (const c of COLORS) { const u = Math.min(pool[c], need[c]); need[c] -= u; pool[c] -= u; }
    const poolLeft = Object.values(pool).reduce((a, b) => a + b, 0);
    const g0 = Math.max(0, cost.generic - poolLeft);
    const pips = COLORS.flatMap((c) => Array(need[c]).fill(c));
    const srcs = this.manaSources(pid);
    if (g0 + pips.length > srcs.reduce((n, x) => n + x.amount, 0)) return null; // cannot possibly be covered (skips the exhaustive search)
    const used = new Set(); const tp = new Set(); const assign = new Map(); const cap = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    const dfs = (i) => {
      if (i === pips.length) {
        let remain = g0 - Object.values(cap).reduce((a, b) => a + b, 0);
        const extra = []; const tpl = new Set(tp);
        for (const s of srcs) { if (remain <= 0) break; if (!used.has(s) && !(s.ab.cost.tap && tpl.has(s.perm))) { extra.push(s); if (s.ab.cost.tap) tpl.add(s.perm); remain -= s.amount; } }
        return remain <= 0 ? [...used, ...extra] : null;
      }
      const c = pips[i];
      if (cap[c] > 0) { cap[c]--; const r = dfs(i + 1); if (r) return r; cap[c]++; }
      for (const s of srcs) {
        if (used.has(s) || !s.opts.includes(c) || (s.ab.cost.tap && tp.has(s.perm))) continue;
        used.add(s); assign.set(s, c); cap[c] += s.amount - 1; if (s.ab.cost.tap) tp.add(s.perm);
        const r = dfs(i + 1); if (r) return r;
        cap[c] -= s.amount - 1; used.delete(s); assign.delete(s); if (s.ab.cost.tap) tp.delete(s.perm);
      }
      return null;
    };
    const taps = dfs(0);
    return taps ? { taps, assign, needFromPool: { W: cost.W - need.W, U: cost.U - need.U, B: cost.B - need.B, R: cost.R - need.R, G: cost.G - need.G }, g0 } : null;
  }
  // ctx = {card} when paying for a spell: lets restricted mana (Mishra's Workshop, Metamorphosis) count
  canPay(pid, cost, ctx = null) {
    if (cost.total === 0) return true;
    const pl = this.players[pid], saved = this._mctx, savedPool = { ...pl.pool };
    this._mctx = ctx;
    try { for (const e of pl.poolR) if (this.restrictOk(e.only, ctx)) pl.pool[e.c] += e.n; return !!this.planPayment(pid, cost); } finally { this._mctx = saved; pl.pool = savedPool; }
  }
  pay(pid, cost0, ctx = null) {
    if (cost0.total === 0) return true;
    const pl = this.players[pid], saved = this._mctx; this._mctx = ctx;
    const moved = [];
    try {
      pl.poolR = pl.poolR.filter((e) => { if (this.restrictOk(e.only, ctx)) { pl.pool[e.c] += e.n; moved.push(e); return false; } return true; });
      const ok = this.payInner(pid, cost0);
      // unused restricted mana stays restricted
      for (const e of moved) { const back = Math.min(e.n, pl.pool[e.c]); if (back > 0) { pl.pool[e.c] -= back; pl.poolR.push({ ...e, n: back }); } }
      return ok;
    } finally { this._mctx = saved; }
  }
  payInner(pid, cost0) {
    const plan = this.planPayment(pid, cost0); if (!plan) return false;
    const cost = plan.cost;
    if (plan.life) { this.players[pid].life -= plan.life; this.say(`${this.players[pid].name} pays ${plan.life} life for mana.`); }
    for (const c of plan.conv || []) { c.perm.tapped = true; this.emit({ type: 'tap', id: c.perm.id }); }
    const pool = this.players[pid].pool;
    for (const c of COLORS) pool[c] -= plan.needFromPool[c];
    let left = plan.g0 === cost.generic ? 0 : cost.generic - plan.g0;
    for (const c of [...COLORS, 'C']) { const u = Math.min(pool[c], left); pool[c] -= u; left -= u; }
    { // mana produced beyond what the cost needed floats in the pool (as colourless), e.g. Basalt Monolith paying a {1} ability
      const pipsFromSrc = COLORS.reduce((n, c) => n + cost[c] - plan.needFromPool[c], 0);
      const produced = plan.taps.reduce((n, t) => n + t.amount, 0);
      const excess = produced - (pipsFromSrc + plan.g0);
      if (excess > 0) pool.C += excess;
    }
    for (const s of plan.taps) if (s.counterCost) this.addCounters(s.perm, s.counterCost.type, -s.counterCost.n);
    for (const s of plan.taps) if (s.sacChoice && this.perm(s.sacChoice)) this.sacrifice(s.sacChoice);
    for (const s of plan.taps) if (s.ab.cost.sac) this.fire('onAbilityActivated', { id: 0, kind: 'ability', mana: true, source: s.perm, controller: pid, tapCost: !!s.ab.cost.tap });
    for (const s of plan.taps) { if (s.ab.cost.tap) { s.perm.tapped = true; this.emit({ type: 'tap', id: s.perm.id }); } if (s.ab.cost.sac) { this.leave(s.perm, 'gy'); } }
    for (const c of plan.conv || []) { this.fire('onManaTapped', c.perm, pid, [c.opts[0]]); this.fire('onAnyTap', c.perm); }
    for (const s of plan.taps) if (s.ab.cost.tap) { this.fire('onManaTapped', s.perm, pid, [plan.assign.get(s) || s.opts[0]]); this.fire('onAnyTap', s.perm); }
    return true;
  }

  // ---------- targeting ----------
  specInfo(spec) {
    if (typeof spec === 'function') return { kind: spec.kind || 'perm', test: spec };
    if (spec && typeof spec === 'object') return { kind: spec.kind || 'perm', test: spec.test || (() => true) };
    if (spec === 'any') return { kind: 'any' };
    if (spec === 'player') return { kind: 'player' };
    if (spec === 'opponent') return { kind: 'player', test: (g, pl, c) => pl.id !== c.pid };
    if (spec === 'activatedAbility') return { kind: 'ability', test: (g, it) => !it.effect?.trigger };
    if (spec === 'artifactAbility') return { kind: 'ability', test: (g, it) => !it.effect?.trigger && it.source && g.hasType(it.source, 'Artifact') };
    if (PERM_SPECS[spec]) return { kind: 'perm', test: PERM_SPECS[spec] };
    if (SPELL_SPECS[spec]) return { kind: 'spell', test: SPELL_SPECS[spec] };
    if (CARD_SPECS[spec]) return { kind: 'card', test: CARD_SPECS[spec] };
    let m = spec.match(/^(white|blue|black|red|green)(Creature|Permanent|Spell)$/);
    if (m) {
      const c = COLOR_WORD[m[1]];
      if (m[2] === 'Spell') return { kind: 'spell', test: (g, s) => g.srcColors(s).includes(c) };
      if (m[2] === 'Creature') return { kind: 'perm', test: (g, p) => g.isCreature(p) && g.colors(p).includes(c) };
      return { kind: 'perm', test: (g, p) => g.colors(p).includes(c) };
    }
    m = spec.match(/^non(White|Blue|Black|Red|Green)Creature$/);
    if (m) { const c = COLOR_WORD[m[1].toLowerCase()]; return { kind: 'perm', test: (g, p) => g.isCreature(p) && !g.colors(p).includes(c) }; }
    return { kind: 'none' };
  }
  validTargets(spec, pid, sourceId, srcCard, chosen = [], x = 0) {
    const out = [];
    const info = this.specInfo(spec);
    const sourcePerm = sourceId != null ? this.perm(sourceId) : null;
    const card = srcCard || sourcePerm?.card || (sourceId != null ? this.stack.find((s) => s.id === sourceId)?.card : null);
    const colors = card ? this.srcColors(sourcePerm || { card }) : [];
    const ctx = { pid, source: sourcePerm, card, targets: chosen, x };
    const sourceKind = sourcePerm || (sourceId != null && this.stack.some((x) => x.id === sourceId && x.kind === 'ability')) ? 'ability' : 'spell';
    const addPlayers = () => this.players.forEach((p) => out.push({ kind: 'player', id: p.id }));
    const isAura = card && !!auraSpecOf(card.def);
    const permOk = (p) => { if (this.rule('cantBeTargeted', p, sourceKind, card)) return false; if (isAura && this.rule('cantBeEnchanted', p, card)) return false; if (sourcePerm && p.id === sourcePerm.id && info.selfExcluded) return false; const kw = this.kw(p); if (kw.has('shroud')) return false; return !colors.some((c) => kw.has('pro:' + c)); };
    const addPerms = (f) => this.players.forEach((pl) => pl.bf.forEach((p) => f(p) && permOk(p) && out.push({ kind: 'perm', id: p.id })));
    switch (info.kind) {
      case 'any': addPlayers(); addPerms((p) => this.isCreature(p)); break;
      case 'player': this.players.forEach((p) => { if (!info.test || info.test(this, p, ctx)) out.push({ kind: 'player', id: p.id }); }); break;
      case 'ability': this.stack.filter((s) => s.kind === 'ability' && s.id !== sourceId && info.test(this, s, ctx)).forEach((s) => out.push({ kind: 'ability', id: s.id })); break;
      case 'perm': addPerms((p) => info.test(this, p, ctx)); break;
      case 'spell': this.stack.filter((s) => s.kind === 'spell' && s.id !== sourceId && info.test(this, s, ctx)).forEach((s) => out.push({ kind: 'spell', id: s.id })); break;
      case 'card': for (const pl of this.players) for (const c of pl.gy) if (info.test(this, c, ctx)) out.push({ kind: 'card', id: c.id }); break;
      default: break;
    }
    return out;
  }
  targetLegal(t, spec, it) {
    if (t.kind === 'player') return true;
    if (t.kind === 'spell' || t.kind === 'ability') return this.stack.some((s) => s.id === t.id);
    if (t.kind === 'card') return this.players.some((p) => p.gy.some((c) => c.id === t.id));
    if (!this.perm(t)) return false;
    if (spec == null) return true;
    return this.validTargets(spec, it.controller, it.source?.id ?? it.id, it.card, [], it.x || 0).some((r) => r.kind === t.kind && r.id === t.id);
  }

  // ---------- casting info ----------
  effectOf(card) { return EFFECTS[card.def.name]; }
  castInfo(card, mode) {
    const d = card.def; const eff = EFFECTS[d.name];
    const aura = auraSpecOf(d);
    let targets = eff?.targets ? [...eff.targets] : [];
    const modes = eff?.modes || null;
    if (modes && mode != null) targets = [...modes[mode].targets];
    if (!eff?.targets && aura) targets = [aura];
    if (eff?.aura && !targets.length && aura) targets = [aura];
    return { targets, multi: eff?.multi || null, modes, hasX: /\{X\}/.test(d.manaCost || '') || !!eff?.x, aura: !!aura };
  }
  spellCost(pid, card, x = 0, nTargets = 1, mode) {
    const info = this.castInfo(card, mode);
    const c = parseCost(card.def.manaCost, x);
    if (EFFECTS[card.def.name]?.xColor && x > 0) { c.generic -= x; c[EFFECTS[card.def.name].xColor] += x; }
    if (info.multi?.extraCost && nTargets > 1) { const e = parseCost(info.multi.extraCost); addGeneric(c, e.generic * (nTargets - 1)); }
    addGeneric(c, this.ruleSum('spellCostIncrease', card, pid));
    return c;
  }
  // Highest X the player can pay (pool mana included), found by binary search (payment is monotonic in X), bounded by MAX_X.
  maxX(pid, card) {
    const hadCache = !!this._msc; if (!hadCache) this._msc = new Map();
    try {
      const ok = (x) => this.canPay(pid, this.spellCost(pid, card, x, 1), { card });
      if (!ok(0)) return 0;
      if (ok(MAX_X)) return MAX_X;
      let lo = 0, hi = MAX_X; // ok(lo), !ok(hi)
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ok(mid)) lo = mid; else hi = mid; }
      return lo;
    } finally { if (!hadCache) this._msc = null; }
  }

  // ---------- actions ----------
  hasMainTiming(pid) { return this.active === pid && (this.step === 'main1' || this.step === 'main2') && this.stack.length === 0; }
  landDrops(pid) { return 1 + this.ruleSum('extraLandPlays', pid); }
  canPlayLand(pid, card) {
    const p = this.players[pid];
    return !this.winner && !(card.cantPlayUntilTurn > this.turn) && !this.rule('cantPlayLand', card, pid) && this.waiting?.kind === 'priority' && this.waiting.player === pid && card.def.types.includes('Land') && this.hasMainTiming(pid) && p.landsPlayed < this.landDrops(pid) && p.hand.includes(card);
  }
  canCast(pid, card) {
    const d = card.def;
    if (this.winner || this.waiting?.kind !== 'priority' || this.waiting.player !== pid || !this.players[pid].hand.includes(card)) return false;
    if (d.types.includes('Land') || card.cantPlayUntilTurn > this.turn || this.rule('cantCast', card, pid)) return false;
    const fast = d.types.includes('Instant') || this.kwCard(card).has('flash');
    if (!fast && !this.hasMainTiming(pid)) return false;
    const eff = EFFECTS[d.name];
    if (eff?.castWhen && !eff.castWhen(this, pid, card)) return false;
    const info = this.castInfo(card, eff?.modes ? this.firstCastableMode(pid, card) : undefined);
    if (eff?.modes && this.firstCastableMode(pid, card) == null) return false;
    if (info.hasX && info.targets.some((sp) => typeof sp !== 'string')) { // target availability may depend on X (Detonate): some affordable X must work
      const mx = Math.min(this.maxX(pid, card), 20);
      for (const spec of info.targets) { let ok = false; for (let x = 0; x <= mx && !ok; x++) ok = this.validTargets(spec, pid, null, card, [], x).length > 0; if (!ok) return false; }
    } else for (const spec of info.targets) if (!this.validTargets(spec, pid, null, card).length) return false;
    if (info.multi && info.multi.min > 0 && !this.validTargets(info.multi.spec, pid, null, card).length) return false;
    if (eff?.cost && !this.extraCostPayable(pid, null, eff.cost)) return false;
    return this.canPay(pid, this.spellCost(pid, card, 0, 1), { card });
  }
  firstCastableMode(pid, card) {
    const eff = EFFECTS[card.def.name];
    for (let i = 0; i < eff.modes.length; i++) if (eff.modes[i].targets.every((s) => this.validTargets(s, pid, null, card).length)) return i;
    return null;
  }
  playLand(pid, card) {
    if (!this.canPlayLand(pid, card)) return false;
    const p = this.players[pid]; p.hand = p.hand.filter((c) => c !== card); p.landsPlayed++; p.landPlayed = p.landsPlayed >= this.landDrops(pid);
    this.say(`${p.name} plays ${card.def.name}.`, { kind: 'play', cards: [card.id], player: pid });
    const perm = this.newPerm(card, pid, { silent: true, played: true });
    this.self(perm, 'onEnter'); this.fire('onAnyEnter', perm); this.sba();
    p.lastLand = { perm, turn: this.turn, logLen: this.logEvents.length };
    this.passes = 0; return true;
  }
  cast(pid, card, targets = [], x = 0, extra = {}) {
    if (this.stepActions >= LOOP_LIMIT || !this.canCast(pid, card)) return false;
    const eff = EFFECTS[card.def.name];
    const mode = eff?.modes ? (extra.mode ?? this.firstCastableMode(pid, card)) : undefined;
    const info = this.castInfo(card, mode);
    const specs = [...info.targets];
    if (info.multi) {
      let division = null;
      if (info.multi.divide) {
        const N = info.multi.divide === 'x' ? x : info.multi.divide;
        division = extra.division || (() => { const base = Math.floor(N / Math.max(1, targets.length)); return targets.map((_, i) => base + (i === 0 ? N - base * targets.length : 0)); })();
        if (division.length !== targets.length || division.some((d) => !(d >= 1)) || division.reduce((a, b) => a + b, 0) !== N) return false;
        extra = { ...extra, _division: division };
      }
      const mn = info.multi.min === 'x' ? x : info.multi.min ?? 1, mx = info.multi.max === 'x' ? x : info.multi.max ?? Infinity;
      if (targets.length < mn || targets.length > mx) return false;
      specs.length = 0; for (let i = 0; i < targets.length; i++) specs.push(info.multi.spec);
    } else if (targets.length !== specs.length) return false;
    for (let i = 0; i < specs.length; i++) {
      if (!this.validTargets(specs[i], pid, null, card, targets.slice(0, i), x).some((r) => r.kind === targets[i].kind && r.id === targets[i].id)) return false;
    }
    if (info.hasX && x > this.maxX(pid, card)) return false;
    const cost = this.spellCost(pid, card, info.hasX ? x : 0, targets.length, mode);
    if (!this.canPay(pid, cost, { card })) return false;
    this.stepActions++;
    const snap = this.captureUndo(pid, card.id);
    let paidExtra = null;
    if (eff?.cost) { paidExtra = this.payExtraCosts(pid, null, eff.cost, extra.choices || {}); if (!paidExtra) return false; }
    this.pay(pid, cost, { card });
    const p = this.players[pid]; p.hand = p.hand.filter((c) => c !== card);
    const item = { id: card.id, kind: 'spell', card, controller: pid, targets, specs, effect: eff, x: info.hasX ? x : 0, mode, paid: paidExtra, division: extra._division };
    this.stack.push(item); p.castLog.push({ id: card.id, types: card.def.types, colors: this.colors({ card, mods: [] }), mv: cmcOf(card.def) });
    p.spellsCast.push({ turn: this.turn, card, types: card.def.types }); if (p.spellsCast.length > 30) p.spellsCast.shift();
    this.turnSpells.push({ card, controller: pid, types: card.def.types, damageDealt: 0 });
    p.mods = p.mods.filter((m) => !(m.anyMana && m.oneSpell));
    this.say(`${p.name} casts ${card.def.name}${targets.length ? ' targeting ' + targets.map((t) => this.refText(t)).join(', ') : ''}.`, { kind: 'cast', cards: [card.id, ...targets.map((t) => (t.kind === 'player' ? null : t.id)).filter((x) => x != null)], player: pid });
    this.emit({ type: 'cast', id: card.id });
    this.passes = 0; this.setPriority(pid);
    this.fire('onSpellCast', item);
    this.commitUndo(snap);
    return true;
  }
  // ---- costs shared by spells and abilities ----
  extraCandidates(pid, perm, spec, selfPerm) {
    const f = typeof spec === 'function' ? spec : (g, p) => (PERM_SPECS[spec] ? PERM_SPECS[spec](g, p, { pid }) : g.hasType(p, spec) || g.hasSubtype(p, spec));
    return this.players[pid].bf.filter((p) => p !== selfPerm && f(this, p, selfPerm));
  }
  extraCostPayable(pid, perm, cost) {
    const pl = this.players[pid];
    if (cost.sacOther && cost.sacN !== 'any' && !this.extraCandidates(pid, perm, cost.sacOther, perm).length) return false;
    if (cost.tapOther && this.extraCandidates(pid, perm, cost.tapOther, perm).filter((p) => !p.tapped).length < (cost.tapN || 1)) return false;
    if (cost.counter) { const cc = typeof cost.counter === 'string' ? { type: cost.counter, n: 1 } : cost.counter; if (!perm || !(perm.counters?.[cc.type] >= cc.n)) return false; }
    if (cost.life && pl.life <= cost.life) return false;
    if (cost.discard && pl.hand.length < cost.discard) return false;
    if (cost.discardRandom && pl.hand.length < cost.discardRandom) return false;
    return true;
  }
  costChoices(pid, perm, ab) {
    const c = ab.cost || {}; const out = {};
    if (c.sacOther) out.sac = this.extraCandidates(pid, perm, c.sacOther, perm);
    if (c.tapOther) out.tapOther = this.extraCandidates(pid, perm, c.tapOther, perm).filter((p) => !p.tapped);
    if (c.discard) out.discard = [...this.players[pid].hand];
    return out;
  }
  // returns {sacrificed:[perm snapshots]} or null if the choices are invalid. Choices default to the cheapest legal ones.
  payExtraCosts(pid, perm, cost, choices) {
    const pl = this.players[pid]; const paid = { sacrificed: [], tapped: [], discarded: [] };
    if (!this.extraCostPayable(pid, perm, cost)) return null;
    let sac = null, taps = [], dis = [];
    let sacMany = null;
    if (cost.sacOther && cost.sacN === 'any') {
      const cands = this.extraCandidates(pid, perm, cost.sacOther, perm);
      sacMany = (choices.sac || []).map((id) => cands.find((c) => c.id === id));
      if (sacMany.some((c) => !c)) return null;
    } else if (cost.sacOther) {
      const cands = this.extraCandidates(pid, perm, cost.sacOther, perm);
      sac = choices.sac != null ? cands.find((p) => p.id === choices.sac) : cands.sort((a, b) => cmcOf(a.card.def) - cmcOf(b.card.def))[0];
      if (!sac) return null;
    }
    if (cost.tapOther) {
      const cands = this.extraCandidates(pid, perm, cost.tapOther, perm).filter((p) => !p.tapped);
      const n = cost.tapN || 1;
      taps = choices.tapOther ? choices.tapOther.map((id) => cands.find((p) => p.id === id)) : cands.slice(0, n);
      if (taps.length !== n || taps.some((t) => !t) || new Set(taps).size !== n) return null;
    }
    if (cost.discard) {
      dis = choices.discard ? choices.discard.map((id) => pl.hand.find((c) => c.id === id)) : [...pl.hand].sort((a, b) => cmcOf(a.def) - cmcOf(b.def)).slice(0, cost.discard);
      if (dis.length !== cost.discard || dis.some((c) => !c)) return null;
    }
    if (sac) { paid.sacrificed.push(sac); this.sacrifice(sac); }
    for (const c of sacMany || []) { paid.sacrificed.push(c); if (cost.sacExile) this.exile(c); else this.sacrifice(c); }
    for (const t of taps) { this.tap(t); paid.tapped.push(t); }
    for (const c of dis) { pl.hand = pl.hand.filter((x) => x !== c); pl.gy.push(c); paid.discarded.push(c); this.say(`${pl.name} discards ${c.def.name}.`); }
    for (let i = 0; i < (cost.discardRandom || 0); i++) { const c = pl.hand.splice(Math.floor(this.rng() * pl.hand.length), 1)[0]; pl.gy.push(c); paid.discarded.push(c); this.say(`${pl.name} discards ${c.def.name} at random.`); this.afterDiscard(pid, c); }
    if (cost.counter) { const cc = typeof cost.counter === 'string' ? { type: cost.counter, n: 1 } : cost.counter; this.addCounters(perm, cc.type, -cc.n); }
    if (cost.life) { pl.life -= cost.life; this.say(`${pl.name} pays ${cost.life} life.`); }
    return paid;
  }
  abilityTimingOk(pid, perm, ab, idx) {
    const t = ab.timing || ab.when;
    if (t) {
      if (typeof t === 'function') { if (!t(this, perm, pid)) return false; }
      else if (t === 'upkeep') { if (this.step !== 'upkeep' || this.active !== pid) return false; }
      else if (t === 'myTurn') { if (this.active !== pid) return false; }
      else if (t === 'sorcery') { if (!this.hasMainTiming(pid)) return false; }
      else if (t === 'combat') { if (!['attackers', 'blockers', 'damage'].includes(this.step) || !this.combat.attackers.length) return false; }
      else if (t === 'endCombat') { if (!this.combatEnding) return false; }
      else if (t === 'anyUpkeep') { if (this.step !== 'upkeep') return false; }
    }
    if (ab.limit && (perm.used[idx] || 0) >= ab.limit) return false;
    if (ab.condition && !ab.condition(this, perm, pid)) return false;
    return true;
  }
  abCost(pid, perm, ab, x = 0) {
    const c = parseCost(ab.cost.mana || '', x);
    addGeneric(c, this.ruleSum('abilityCostIncrease', perm, ab));
    return c;
  }
  activatable(pid) {
    const out = [];
    if (this.winner || this.waiting?.kind !== 'priority' || this.waiting.player !== pid) return out;
    for (const pl of this.players) for (const perm of pl.bf) {
      const abs = this.abilitiesOf(perm);
      abs.forEach((ab, idx) => {
        if (ab.mana) return;
        if (perm.controller !== pid && !ab.anyPlayer) return;
        const cost = ab.cost || {};
        if (cost.tap && (perm.tapped || (this.isCreature(perm) && perm.sick && !this.kw(perm).has('haste')))) return;
        { const mc0 = this.abCost(pid, perm, ab, 0); if (mc0.total && !this.canPay(pid, mc0)) return; }
        if (!this.extraCostPayable(pid, perm, cost)) return;
        if (!this.abilityTimingOk(pid, perm, ab, idx)) return;
        if (ab.targets && ab.targets.some((s) => !this.validTargets(s, pid, perm.id).length)) return;
        out.push({ perm, ab, idx });
      });
    }
    return out;
  }
  abilityInfo(perm, idx) {
    const ab = this.abilitiesOf(perm)[idx]; if (!ab) return null;
    const c = ab.cost || {};
    return { ab, targets: ab.targets || [], multi: ab.multi || null, hasX: !!c.x || /\{X\}/.test(c.mana || ''), needs: { sac: !!c.sacOther, tapOther: !!c.tapOther, discard: !!c.discard } };
  }
  activate(pid, permId, idx, targets = [], choices = {}) {
    if (this.stepActions >= LOOP_LIMIT) { if (this.stepActions === LOOP_LIMIT) { this.say('Too many actions this step (loop guard).'); this.stepActions++; } return false; }
    const a = this.activatable(pid).find((x) => x.perm.id === permId && x.idx === idx); if (!a) return false;
    const ab = a.ab; const cost = ab.cost || {};
    const specs = ab.multi ? targets.map(() => ab.multi.spec) : ab.targets || [];
    if (!ab.multi && targets.length !== specs.length) return false;
    for (let i = 0; i < specs.length; i++) {
      if (!this.validTargets(specs[i], pid, a.perm.id, null, targets.slice(0, i)).some((r) => r.kind === targets[i]?.kind && r.id === targets[i]?.id)) return false;
    }
    const x = choices.x || 0;
    const mc = this.abCost(pid, a.perm, ab, x);
    if (mc.total && !this.canPay(pid, mc)) return false;
    const snap = this.captureUndo(pid, a.perm.id);
    const paid = this.payExtraCosts(pid, a.perm, cost, choices); if (!paid) return false;
    if (mc.total) this.pay(pid, mc);
    if (cost.tap) this.tap(a.perm);
    a.perm.used[idx] = (a.perm.used[idx] || 0) + 1;
    if (cost.sac) this.sacrifice(a.perm);
    this.stack.push({ id: this.nextId++, kind: 'ability', card: a.perm.card, source: a.perm, controller: pid, targets, specs, effect: ab, abIdx: idx, x, choices, paid, tapCost: !!cost.tap });
    this.say(`${this.players[pid].name} activates ${a.perm.card.def.name}.`, { kind: 'activate', cards: [a.perm.id], player: pid });
    this.passes = 0; this.setPriority(pid);
    this.stepActions++;
    this.fire('onActivate', this.stack[this.stack.length - 1]); this.fire('onAbilityActivated', this.stack[this.stack.length - 1]);
    this.commitUndo(snap);
    return true;
  }
  hasResponse(pid) {
    const p = this.players[pid];
    this.waiting = this.waiting?.player === pid ? this.waiting : { kind: 'priority', player: pid };
    return p.hand.some((c) => this.canCast(pid, c)) || this.activatable(pid).length > 0;
  }

  // ---------- priority & stack ----------
  pass(pid) {
    if (this.mull && (this.waiting?.kind === 'mulligan' || this.waiting?.kind === 'bottom') && this.waiting.player === pid) {
      if (this.waiting.kind === 'mulligan') { if (this.autoKeep(pid) || !this.waiting.canMulligan) this.keepHand(pid); else this.mulligan(pid); } else this.bottomCards(pid, this.autoBottom(pid, this.waiting.n));
      return;
    }
    if (this.waiting?.kind === 'choice' && this.waiting.player === pid) { this.choose(pid, this.autoAnswer()); return; } // bots that only know pass()
    if (this.waiting?.kind !== 'priority' || this.waiting.player !== pid) return;
    this.passes++;
    if (this.passes >= 2) {
      this.passes = 0;
      if (this.stack.length) { this.resolveTop(); if (!this.winner) this.whenIdle(() => { this.waiting = { kind: 'priority', player: this.active }; }); }
      else { if (this.combatEnding) { this.combatEnding = false; this.endCombat(); } this.nextStep(); }
    } else this.waiting = { kind: 'priority', player: this.opp(pid) };
  }
  resolveTop() {
    const it = this.stack.pop();
    it.legal = it.targets.map((t, i) => this.targetLegal(t, it.specs?.[i], it));
    if (it.targets.length && it.legal.every((x) => !x)) {
      this.say(`${it.card.def.name} fizzles.`, { kind: 'fizzle', cards: [it.card.id], player: it.controller });
      if (it.kind === 'spell' && !it.copy) this.players[it.card.owner].gy.push(it.card);
      return;
    }
    this.emit({ type: 'resolve', id: it.card.id }); this.currentController = it.controller; this.currentKind = it.kind;
    if (it.kind === 'spell') {
      const types = it.card.def.types;
      if (types.includes('Instant') || types.includes('Sorcery')) { const rr = it.effect?.resolve?.(this, it); if (!it.copy) this.players[it.card.owner][it.effect?.exile || rr === 'exile' ? 'ex' : 'gy'].push(it.card); }
      else {
        const aura = auraSpecOf(it.card.def);
        const t = it.targets[0];
        this.say(`${it.card.def.name} enters the battlefield.`, { kind: 'enter', cards: [it.card.id], player: it.controller });
        this.newPerm(it.card, it.controller, { attachedTo: aura && t?.kind === 'perm' ? t.id : null, targetRef: aura ? t : null, x: it.x });
      }
    } else it.effect.resolve(this, it);
    this.currentController = null; this.currentKind = null;
    this.sba();
  }
  copySpell(item, controller, targets) {
    const c = { ...item, id: this.nextId++, controller, targets: targets || item.targets, copy: true, card: { ...item.card, id: this.nextId++, copyOf: item.card.id } };
    c.id = c.card.id;
    this.stack.push(c); this.emit({ type: 'cast', id: c.card.id }); return c;
  }

  // ---------- turn structure ----------
  startTurn() {
    this.turn++;
    if (this.turn > 1) {
      let next = this.extraTurns.length ? this.extraTurns.pop() : this.opp(this.active);
      for (let i = 0; i < 4 && this.players[next].skip.turn > 0; i++) { this.players[next].skip.turn--; this.say(`${this.players[next].name} skips a turn.`); next = this.opp(next); }
      for (let i = 0; i < 4 && this.players[next].bf.some((pm) => TRIGGERS[pm.card.def.name]?.onWouldBeginTurn?.(this, pm, next)); i++) { this.say(`${this.players[next].name} skips a turn.`); next = this.opp(next); }
      this.active = next;
    }
    this.combat = { attackers: [], blocks: {}, blocked: [], bands: [] };
    this.say(`— Turn ${this.turn}: ${this.players[this.active].name} —`, { kind: 'turn', player: this.active });
    this.enter('untap');
  }
  nextStep() {
    if (this.stack.length && !this.winner) { this.passes = 0; this.setPriority(this.active); return; } // triggers put on the stack by hooks
    for (const p of this.players) { p.pool = emptyPool(); p.poolR = []; }
    const i = STEPS.indexOf(this.step);
    let n = STEPS[i + 1];
    if (n === 'blockers' && !this.combat.attackers.length) n = 'main2';
    if (n === 'damage' && !this.combat.attackers.length) n = 'main2';
    if (!n) return this.cleanup();
    this.enter(n);
  }
  extraTurn(pid) { this.extraTurns.push(pid); this.emit({ type: 'extraTurn', pid }); this.say(`${this.players[pid].name} takes an extra turn.`); }
  skipStep(pid, what, n = 1) { this.players[pid].skip[what] += n; }
  untapStep(a) {
    const mine = a.bf;
    for (const p of mine) p.sick = false;
    a.landPlayed = false; a.landsPlayed = 0;
    for (const pl of this.players) pl.mods = pl.mods.filter((m) => !(m.until === 'myNextTurn' && m.owner === a.id));
    for (const p of this.allPerms()) p.mods = p.mods.filter((m) => !(m.until === 'myNextTurn' && m.owner === a.id));
    if (this.rule('skipUntap', a.id)) { this.say(`${a.name} skips the untap step.`); return; }
    let cands = mine.filter((p) => p.tapped && !this.rule('noUntap', p));
    cands = cands.filter((p) => {
      for (const m of [...p.mods]) if (m.noUntap && (typeof m.noUntap !== 'function' || m.noUntap(this, p))) { if (m.untapSteps !== undefined && --m.untapSteps <= 0) p.mods = p.mods.filter((x) => x !== m); return false; }
      return true;
    });
    const optional = cands.filter((p) => TRIGGERS[p.card.def.name]?.optionalUntap || TRIGGERS[p.card.def.name]?.mayNotUntap || TRIGGERS[p.card.def.name]?.onUntapChoice);
    cands = cands.filter((p) => !optional.includes(p));
    const lim = this.ruleVals('untapLimit', a.id);
    const groups = [];
    for (const l of lim) {
      for (const [k, n] of Object.entries(l)) {
        const f = k === 'creatures' ? (p) => this.isCreature(p) : k === 'lands' ? (p) => this.isLand(p) : k === 'artifacts' ? (p) => this.hasType(p, 'Artifact') : () => true;
        const g = cands.filter(f);
        if (g.length > n) groups.push({ g, n });
      }
    }
    const untap = (p) => { p.tapped = false; this.emit({ type: 'untap', id: p.id }); this.self(p, 'onUntap'); };
    for (const p of optional) this.ask(a.id, { type: 'yesno', prompt: `Untap ${p.card.def.name}?`, source: p.card.id, auto: true }, (yes) => { if (yes) untap(p); });
    if (!groups.length) { for (const p of cands) untap(p); return; }
    // limited untap: let the player choose which permanents untap
    const limited = new Set(groups.flatMap((x) => x.g));
    for (const p of cands) if (!limited.has(p)) untap(p);
    for (const { g, n } of groups) {
      this.pickPerms(a.id, g.filter((p) => p.tapped), { prompt: `Choose ${n} to untap`, min: Math.min(n, g.length), score: (p) => this.power(p) + this.toughness(p) }, (ps) => { for (const p of ps) untap(p); });
    }
  }
  enter(step) {
    this.step = step; this.stepActions = 0; this.combatEnding = false; this.passes = 0; this.waiting = null;
    const a = this.players[this.active];
    if (step === 'untap') {
      this.fire('onTurnStart', this.active);
      this.untapStep(a);
      this.fire('onUntapStep', this.active);
      return this.whenIdle(() => this.nextStep());
    }
    if (step === 'upkeep') {
      this.fire('onUpkeep', this.active);
      this.runDelayed('upkeep', this.active);
      this.sba();
      return this.whenIdle(() => { if (!this.winner) this.waiting = { kind: 'priority', player: this.active }; });
    }
    if (step === 'draw') {
      for (const pl of this.players) pl.drawsThisStep = 0;
      this.fire('onDrawStep', this.active);
      return this.whenIdle(() => {
        if (a.skip.draw > 0) { a.skip.draw--; this.say(`${a.name} skips the draw.`); }
        else if (!(this.turn === 1 && this.active === this.first)) this.draw(this.active);
        this.sba(); if (this.winner) return;
        this.waiting = { kind: 'priority', player: this.active };
      });
    }
    if (step === 'attackers') {
      this.fire('onBeginCombat', this.active);
      const elig = a.bf.filter((p) => this.canAttack(p));
      if (!elig.length) return this.nextStep();
      this.waiting = { kind: 'attackers', player: this.active }; return;
    }
    if (step === 'blockers') {
      const d = this.players[this.opp(this.active)];
      if (!d.bf.some((p) => this.isCreature(p) && !p.tapped)) {
        // blockers step skipped: every attacker is unblocked, hooks still fire
        this.combat.blocks = {}; this.combat.blocked = [];
        this.fire('onBlockersDeclared', {});
        for (const aid of [...this.combat.attackers]) { const att = this.perm(aid); if (att) this.self(att, 'onUnblocked'); }
        return this.whenIdle(() => this.nextStep());
      }
      this.waiting = { kind: 'blockers', player: this.opp(this.active) }; return;
    }
    if (step === 'damage') {
      this.combatDamage({ keepOpen: true });
      if (this.winner) return null;
      // end-of-combat window: players get priority with the attackers still in combat (Desert)
      this.combatEnding = true;
      return this.whenIdle(() => { this.waiting = { kind: 'priority', player: this.active }; });
    }
    if (step === 'end') {
      this.fire('onEndTurn', this.active);
      this.runDelayed('end', this.active);
      this.sba();
      return this.whenIdle(() => { if (!this.winner) this.waiting = { kind: 'priority', player: this.active }; });
    }
    if (step === 'main1' || step === 'main2') this.runDelayed('main', this.active);
    this.waiting = { kind: 'priority', player: this.active };
  }
  cleanup() {
    for (const pl of this.players) for (const p of pl.bf) { p.damage = 0; p.mods = p.mods.filter((m) => m.until !== 'eot' && m.until !== 'endCombat'); p.attacking = false; p.regen = 0; p.used = {}; p.damagedBy = []; p.damageFrom = []; }
    for (const pl of this.players) { pl.mods = pl.mods.filter((m) => m.until !== 'eot'); pl.damageTaken = 0; pl.damageFrom = []; pl.prevTurn = this.active === pl.id ? { cast: pl.castLog, entered: pl.entered } : pl.prevTurn; pl.castLog = this.active === pl.id ? [] : pl.castLog; pl.entered = this.active === pl.id ? 0 : pl.entered; pl.drawsThisTurn = 0; }
    this.damageLog = []; this.turnSpells = []; this.blockLog = []; this.deathWatch = this.deathWatch.filter((d) => d.until !== 'eot');
    for (const pl of this.players) { pl.drawnThisTurn = []; pl.drawsThisStep = 0; }
    for (const pm of this.allPerms()) { pm.blockedThisTurn = []; if (pm.tempCtl !== undefined) delete pm.tempCtl; }
    this.ghosts = []; this.ver++;
    this.shields = this.shields.filter((s) => s.until !== 'eot');
    this.noCombatDamage = false; this.diedThisTurn = 0;
    this.combat = { attackers: [], blocks: {}, blocked: [], bands: [] };
    this.runDelayed('cleanup', this.active);
    this.fire('onCleanup', this.active);
    this.sba();
    if (this.winner) return;
    const a = this.players[this.active];
    const maxHand = Math.min(7, ...this.ruleVals('maxHandSize', a.id));
    if (a.hand.length > maxHand && !this.rule('noHandLimit', a.id)) { this.step = 'cleanup'; this.waiting = { kind: 'discard', player: this.active, n: a.hand.length - maxHand }; return; }
    this.whenIdle(() => this.startTurn());
  }
  discard(pid, card) {
    if (this.waiting?.kind !== 'discard' || this.waiting.player !== pid) return false;
    const p = this.players[pid]; if (!p.hand.includes(card)) return false;
    p.hand = p.hand.filter((c) => c !== card); p.gy.push(card); this.say(`${p.name} discards ${card.def.name}.`); this.afterDiscard(pid, card);
    if (--this.waiting.n <= 0) this.startTurn();
    return true;
  }

  // ---------- combat ----------
  canAttack(p) {
    if (!this.isCreature(p) || p.tapped) return false;
    const kw = this.kw(p);
    if (p.sick && !kw.has('haste') && !kw.has('canAttackSick')) return false;
    if (kw.has('defender') && !kw.has('canAttack')) return false;
    if (kw.has('cantAttack')) return false;
    if (this.rule('cantAttack', p)) return false;
    const h = TRIGGERS[p.card.def.name]?.canAttack; if (h && !h(this, p)) return false;
    return true;
  }
  attackAllowed(p, defPid) {
    if (!this.canAttack(p)) return false;
    if (this.rule('cantBeAttacked', p, defPid)) return false;
    const h = TRIGGERS[p.card.def.name]?.canAttackPlayer; if (h && !h(this, p, defPid)) return false;
    return true;
  }
  declareAttackers(pid, ids, bands) {
    if (this.waiting?.kind !== 'attackers' || this.waiting.player !== pid) return false;
    const a = this.players[pid];
    const must = a.bf.filter((p) => (this.kw(p).has('mustAttack') || TRIGGERS[p.card.def.name]?.mustAttack?.(this, p)) && this.attackAllowed(p, this.opp(pid)));
    const atk = [...new Set([...ids, ...must.map((p) => p.id)])].map((id) => a.bf.find((p) => p.id === id)).filter((p) => p && this.attackAllowed(p, this.opp(pid)));
    { const caps = this.ruleVals('maxAttackers'); if (caps.length && atk.length > Math.min(...caps)) atk.length = Math.min(...caps); }
    this.combat.attackers = atk.map((p) => p.id);
    this.combat.bands = this.makeBands(atk, bands);
    for (const p of atk) { p.attacking = true; p.attackedTurn = this.turn; if (!this.kw(p).has('vigilance')) this.tap(p); }
    if (atk.length) this.say(`${a.name} attacks with ${atk.map((p) => p.card.def.name).join(', ')}.`, { kind: 'attack', cards: atk.map((p) => p.id), player: pid });
    this.passes = 0;
    for (const p of atk) if (this.perm(p)) this.self(p, 'onAttack');
    if (atk.length) this.fire('onDeclareAttackers', atk);
    if (!this.combat.attackers.length) return this.whenIdle(() => this.nextStep()), true;
    this.whenIdle(() => { this.waiting = { kind: 'priority', player: this.active }; });
    return true;
  }
  // Attacking bands: creatures with banding (plus at most one creature without) attack as one band. `bands` = [[ids]] lets the
  // player choose; by default all attacking creatures with banding form one band.
  bandKeys(p) { return [...this.kw(p)].filter((k) => k.startsWith('bandswith:')).map((k) => k.slice(10)); }
  bandMatch(p, key) { return key === 'legendary' ? !!p.card.def.supertypes?.includes('Legendary') : p.card.def.name === key; }
  makeBands(atk, bands) {
    const ok = (grp) => {
      if (grp.length < 2) return false;
      if (grp.some((p) => this.kw(p).has('banding')) && grp.filter((p) => !this.kw(p).has('banding')).length <= 1) return true;
      // "bands with other X": any number of X creatures if at least one has the ability
      for (const key of new Set(grp.flatMap((p) => this.bandKeys(p)))) if (grp.every((p) => this.bandMatch(p, key))) return true;
      return false;
    };
    if (bands) {
      const used = new Set(); const out = [];
      for (const ids of bands) { const grp = ids.map((id) => atk.find((p) => p.id === id)).filter((p) => p && !used.has(p.id)); if (ok(grp)) { grp.forEach((p) => used.add(p.id)); out.push(grp.map((p) => p.id)); } }
      return out;
    }
    const out = []; const used = new Set();
    const grp = atk.filter((p) => this.kw(p).has('banding'));
    if (grp.length > 1) { out.push(grp.map((p) => p.id)); grp.forEach((p) => used.add(p.id)); }
    for (const key of new Set(atk.flatMap((p) => this.bandKeys(p)))) {
      const g2 = atk.filter((p) => !used.has(p.id) && this.bandMatch(p, key));
      if (g2.length > 1 && g2.some((p) => this.bandKeys(p).includes(key))) { out.push(g2.map((p) => p.id)); g2.forEach((p) => used.add(p.id)); }
    }
    return out;
  }
  bandOf(attId) { return (this.combat.bands || []).find((b) => b.includes(attId)) || null; }
  // Damage assignment helpers (the controlling player's choice is made greedily: protected creatures soak first, then spread so as to kill as little as possible)
  assignSpread(power, members, src) {
    const out = []; let left = power;
    const sc = this.srcColors(src);
    const prot = members.filter((m) => sc.some((c) => this.kw(m).has('pro:' + c)));
    if (prot.length) { out.push([prot[0], left]); return out; }
    const sorted = [...members].sort((a, b) => (this.toughness(b) - b.damage) - (this.toughness(a) - a.damage));
    for (const m of sorted) { const safe = Math.max(0, this.toughness(m) - m.damage - 1); const n = Math.min(left, safe); if (n > 0) out.push([m, n]); left -= n; }
    if (left > 0 && sorted.length) out.push([sorted[0], left]);
    return out;
  }
  assignKill(power, blockers, src) {
    const out = []; let left = power; const sc = this.srcColors(src);
    const vals = [...blockers].sort((a, b) => (sc.some((c) => this.kw(a).has('pro:' + c)) ? 1 : 0) - (sc.some((c) => this.kw(b).has('pro:' + c)) ? 1 : 0) || (this.power(b) + this.toughness(b)) - (this.power(a) + this.toughness(a)));
    for (const b of vals) { if (left <= 0) break; const need = Math.max(1, this.toughness(b) - b.damage); const n = Math.min(left, need); out.push([b, n]); left -= n; }
    if (left > 0 && out.length) out[out.length - 1][1] += left;
    return out;
  }
  maxBlocks(b) { const h = TRIGGERS[b.card.def.name]?.maxBlocks; if (this.kw(b).has('blockAny')) return Infinity; return Math.max(1, (h ? h(this, b) : 1) + this.ruleSum('extraBlocks', b)); }
  canBlock(blocker, attacker) {
    if (!this.isCreature(blocker) || blocker.tapped) return false;
    const ak = this.kw(attacker), bk = this.kw(blocker);
    if (bk.has('cantBlock')) return false;
    if (ak.has('unblockable')) return false;
    if (ak.has('flying') && !(bk.has('flying') || bk.has('reach'))) return false;
    if (ak.has('fear') && !(this.hasType(blocker, 'Artifact') || this.colors(blocker).includes('B'))) return false;
    for (const [k, land] of Object.entries(WALKS)) if (ak.has(k) && !this.rule('negateWalk', attacker, land) && !this.rule('ignoreLandwalk', attacker, blocker, land) && this.players[blocker.controller].bf.some((l) => this.isLand(l) && this.hasSubtype(l, land))) return false;
    if (ak.has('legendary landwalk') && !this.rule('negateWalk', attacker, 'legendary') && !this.rule('ignoreLandwalk', attacker, blocker, 'legendary') && this.players[blocker.controller].bf.some((l) => this.isLand(l) && l.card.def.supertypes?.includes('Legendary'))) return false;
    for (const c of this.colors(blocker)) if (ak.has('pro:' + c)) return false;
    const h = TRIGGERS[blocker.card.def.name]?.canBlock; if (h && !h(this, blocker, attacker)) return false;
    if (this.rule('cantBlock', blocker, attacker)) return false;
    return true;
  }
  declareBlockers(pid, map) { // map: attackerId -> [blockerIds]
    if (this.waiting?.kind !== 'blockers' || this.waiting.player !== pid) return false;
    const d = this.players[pid]; const count = {}; const blocks = {};
    for (const [aid, bids] of Object.entries(map)) {
      const att = this.perm(+aid); if (!att || !this.combat.attackers.includes(att.id)) continue;
      for (const bid of bids) {
        const b = d.bf.find((p) => p.id === bid);
        if (b && (count[bid] || 0) < this.maxBlocks(b) && !(blocks[att.id] || []).includes(bid) && this.canBlock(b, att)) { count[bid] = (count[bid] || 0) + 1; (blocks[att.id] ||= []).push(bid); }
      }
    }
    { const caps = this.ruleVals('maxBlockers'); if (caps.length) { const cp = Math.min(...caps); const used = [...new Set(Object.values(blocks).flat())]; for (const bid of used.slice(cp)) { for (const k of Object.keys(blocks)) blocks[k] = blocks[k].filter((x) => x !== bid); } for (const k of Object.keys(blocks)) if (!blocks[k].length) delete blocks[k]; } }
    // forced blocks (Lure)
    for (const aid of this.combat.attackers) {
      const att = this.perm(aid); if (!att || !this.rule('mustBlock', att)) continue;
      for (const b of d.bf) if (this.canBlock(b, att) && (count[b.id] || 0) < this.maxBlocks(b) && !(blocks[aid] || []).includes(b.id)) { count[b.id] = (count[b.id] || 0) + 1; (blocks[aid] ||= []).push(b.id); }
    }
    // Marble Priest style: specific blockers must block this attacker
    for (const aid of this.combat.attackers) {
      const att = this.perm(aid); if (!att) continue;
      for (const b of d.bf) if (this.rule('mustBlockBy', b, att) && this.canBlock(b, att) && (count[b.id] || 0) < this.maxBlocks(b) && !(blocks[aid] || []).includes(b.id)) { count[b.id] = (count[b.id] || 0) + 1; (blocks[aid] ||= []).push(b.id); }
    }
    // Blaze of Glory style: must block every attacker it can
    for (const b of d.bf) if (this.kw(b).has('mustBlockAll')) for (const aid of this.combat.attackers) { const att = this.perm(aid); if (att && this.canBlock(b, att) && (count[b.id] || 0) < this.maxBlocks(b) && !(blocks[aid] || []).includes(b.id)) { count[b.id] = (count[b.id] || 0) + 1; (blocks[aid] ||= []).push(b.id); } }
    this.combat.blocks = blocks;
    this.combat.blocked = Object.keys(blocks).map(Number);
    for (const band of this.combat.bands || []) if (band.some((id) => this.combat.blocked.includes(id))) for (const id of band) if (!this.combat.blocked.includes(id)) this.combat.blocked.push(id);
    for (const [aid, bs] of Object.entries(blocks)) this.say(`${bs.map((b) => this.perm(b).card.def.name).join(' + ')} blocks ${this.perm(+aid).card.def.name}.`, { kind: 'block', cards: [...bs, +aid], player: pid });
    this.passes = 0;
    for (const [aid, bs] of Object.entries(blocks)) {
      const att = this.perm(+aid);
      for (const b of bs) {
        const bp = this.perm(b);
        if (att) this.blockLog.push({ attackerId: att.id, blockerId: b, attackerController: att.controller, turn: this.turn });
        if (bp) (bp.blockedThisTurn ||= []).push(+aid);
        if (bp && att) { this.self(bp, 'onBlock', att); for (const au of this.allPerms()) if (au.attachedTo === bp.id) this.self(au, 'onHostBlock', bp, att); }
      }
      if (att) {
        for (const k of this.kw(att)) { const m = k.match(/^rampage:(\d+)$/); if (m && bs.length > 1) this.addMod(att, { p: +m[1] * (bs.length - 1), t: +m[1] * (bs.length - 1) }); }
        this.self(att, 'onBlocked', bs.map((b) => this.perm(b)).filter(Boolean));
        for (const au of this.allPerms()) if (au.attachedTo === att.id) this.self(au, 'onHostBlocked', att, bs.map((b) => this.perm(b)).filter(Boolean));
      }
    }
    this.fire('onBlockersDeclared', blocks);
    for (const aid of [...this.combat.attackers]) if (!this.combat.blocked.includes(aid)) { const att = this.perm(aid); if (att) this.self(att, 'onUnblocked'); }
    this.whenIdle(() => { this.waiting = { kind: 'priority', player: this.active }; });
    return true;
  }
  fsOf(p) { const k = this.kw(p); return k.has('first strike') || k.has('double strike'); }
  regularOf(p) { const k = this.kw(p); return !k.has('first strike') || k.has('double strike'); }
  // Pure: list of [source perm, target ref, amount] for one damage step. `st` (preview only) carries virtual damage/deaths.
  planHits(filter, st) {
    const hits = [];
    const alive = (id) => (st?.dead.has(id) ? null : this.perm(id));
    const dmg = (p) => (st?.dmg.has(p.id) ? st.dmg.get(p.id) : p.damage);
    const share = new Map(); // blocker -> attackers it blocks (power split)
    for (const [aid, bs] of Object.entries(this.combat.blocks)) for (const b of bs) { if (!share.has(b)) share.set(b, []); share.get(b).push(+aid); }
    for (const aid of this.combat.attackers) {
      const att = alive(aid); if (!att) continue;
      const raw = this.combat.blocks[aid] || [];
      const blockers = raw.map((b) => alive(b)).filter(Boolean);
      if (filter(att)) {
        let pw = att.mods.some((m) => m.noCombatDamage) ? 0 : Math.max(0, this.power(att));
        const trample = this.kw(att).has('trample');
        if (!this.combat.blocked.includes(aid)) hits.push([att, { kind: 'player', id: this.opp(att.controller) }, pw]);
        else if (!blockers.length) { if (trample) hits.push([att, { kind: 'player', id: this.opp(att.controller) }, pw]); }
        else if (blockers.some((b) => this.kw(b).has('banding'))) {
          // a blocker with banding: the defending player assigns this attacker's damage
          const plan = this.assignKill(pw, blockers, att);
          for (const [b, n] of plan) hits.push([att, { kind: 'perm', id: b.id }, n]);
          if (trample) { const used = plan.reduce((a, x) => a + x[1], 0); if (pw > used) hits.push([att, { kind: 'player', id: this.opp(att.controller) }, pw - used]); }
        } else {
          blockers.forEach((b, i) => {
            const lethal = Math.max(0, this.toughness(b) - dmg(b));
            const last = i === blockers.length - 1;
            const n = last && !trample ? pw : Math.min(pw, lethal);
            hits.push([att, { kind: 'perm', id: b.id }, n]); pw -= n;
          });
          if (trample && pw > 0) hits.push([att, { kind: 'player', id: this.opp(att.controller) }, pw]);
        }
      }
      for (const b of blockers) {
        if (!filter(b)) continue;
        const atts = share.get(b.id) || [att.id];
        const pwB = Math.max(0, this.power(b));
        const part = atts.length > 1 ? Math.floor(pwB / atts.length) + (atts[0] === att.id ? pwB % atts.length : 0) : pwB;
        const band = this.bandOf(att.id);
        if (band) {
          // attacking player assigns the blocker's damage among the band
          const members = band.map((id) => alive(id)).filter(Boolean);
          for (const [m, n] of this.assignSpread(part, members, b)) hits.push([b, { kind: 'perm', id: m.id }, n]);
        } else hits.push([b, { kind: 'perm', id: att.id }, part]);
      }
    }
    return hits;
  }
  combatDamage(opts = {}) {
    const phase = (filter) => {
      for (const [src, tgt, n] of this.planHits(filter)) {
        if (n <= 0) continue;
        if (src.attacking) this.emit({ type: 'clash', id: src.id, tgt });
        const dealt = this.damage(src, tgt, n, { combat: true, noSba: true });
        if (tgt.kind === 'player' && dealt > 0) this.self(src, 'onDamagePlayer', tgt, dealt);
      }
      this.sba();
    };
    const anyFS = [...this.combat.attackers, ...Object.values(this.combat.blocks).flat()].some((id) => { const p = this.perm(id); return p && this.fsOf(p); });
    if (anyFS) { phase((p) => this.fsOf(p)); if (this.winner) return; }
    phase((p) => (anyFS ? this.regularOf(p) : true));
    if (!opts.keepOpen) this.endCombat();
  }
  // Damage preview for the UI. Optional { blocks: {attackerId: [blockerIds]} } previews hypothetical blocks (while the defender is choosing).
  // Returns one entry per attacker: { id, blockers, blocked, band, toPlayer, dies, blockersDie, damageTaken, hits:[{from,to,n,first}] }
  // (shields, regeneration and triggered effects are not simulated; protection, first strike, double strike, trample, banding are.)
  combatPreview(opts = {}) {
    const saved = [this.combat.blocks, this.combat.blocked];
    if (opts.blocks) {
      const blocks = {}; for (const [k, v] of Object.entries(opts.blocks)) if (v.length) blocks[+k] = [...v];
      this.combat.blocks = blocks; this.combat.blocked = Object.keys(blocks).map(Number);
      for (const band of this.combat.bands || []) if (band.some((id) => this.combat.blocked.includes(id))) for (const id of band) if (!this.combat.blocked.includes(id)) this.combat.blocked.push(id);
    }
    try {
      const st = { dmg: new Map(), dead: new Set() };
      const log = [];
      const run = (filter, first) => {
        for (const [src, tgt, n0] of this.planHits(filter, st)) {
          if (n0 <= 0) continue;
          let n = this.noCombatDamage ? 0 : n0;
          if (tgt.kind === 'perm') { const t = this.perm(tgt.id); if (t && this.srcColors(src).some((c) => this.kw(t).has('pro:' + c))) n = 0; if (t && n) st.dmg.set(t.id, (st.dmg.has(t.id) ? st.dmg.get(t.id) : t.damage) + n); }
          log.push({ from: src.id, to: tgt, n, first });
        }
        for (const t of this.allPerms()) if (this.isCreature(t) && !st.dead.has(t.id)) {
          const d = st.dmg.has(t.id) ? st.dmg.get(t.id) : t.damage; const th = this.toughness(t);
          if (th <= 0 || (d >= th && !this.kw(t).has('indestructible') && !(t.regen > 0 && !t.mods.some((m) => m.noRegen)))) st.dead.add(t.id);
        }
      };
      const ids = [...this.combat.attackers, ...Object.values(this.combat.blocks).flat()];
      const anyFS = ids.some((id) => { const p = this.perm(id); return p && this.fsOf(p); });
      if (anyFS) run((p) => this.fsOf(p), true);
      run((p) => (anyFS ? this.regularOf(p) : true), false);
      return this.combat.attackers.map((aid) => {
        const blockers = [...(this.combat.blocks[aid] || [])];
        const mine = log.filter((h) => h.from === aid || h.to.id === aid || blockers.includes(h.from) || (h.to.kind === 'perm' && blockers.includes(h.to.id)));
        return {
          id: aid, blockers, blocked: this.combat.blocked.includes(aid), band: this.bandOf(aid),
          toPlayer: log.filter((h) => h.from === aid && h.to.kind === 'player').reduce((a, h) => a + h.n, 0),
          dies: st.dead.has(aid), blockersDie: blockers.filter((b) => st.dead.has(b)),
          damageTaken: log.filter((h) => h.to.kind === 'perm' && h.to.id === aid).reduce((a, h) => a + h.n, 0),
          hits: mine,
        };
      });
    } finally { [this.combat.blocks, this.combat.blocked] = saved; }
  }

  // ---------- undo of the last cast / activation (opt-in: new Game(..., {undo: true | [pid]}) or g.undoFor = [pid]) ----------
  captureUndo(pid, cardId) {
    if (!this.undoFor.includes(pid)) return null;
    try { return { pid, cardId, data: this.encodeState(true), rngCalls: this.rngCalls, logSeq: this.logSeq, epoch: this.undoEpoch }; } catch (e) { return null; }
  }
  commitUndo(snap) {
    if (!snap || snap.epoch !== this.undoEpoch || this.winner) { if (snap) this.undoSnap = null; return; }
    snap.afterSeq = this.logSeq; snap.afterRng = this.rngCalls; snap.stackLen = this.stack.length; snap.topId = this.stack[this.stack.length - 1]?.id;
    this.undoSnap = snap;
  }
  canUndoAction(pid) {
    const s = this.undoSnap;
    return !!s && s.pid === pid && !this.winner && s.epoch === this.undoEpoch && this.logSeq === s.afterSeq && this.rngCalls === s.afterRng && s.afterRng === s.rngCalls
      && this.waiting?.kind === 'priority' && this.waiting.player === pid && this.passes === 0 && !this.curAsk && !this.asks.length
      && this.stack.length === s.stackLen && this.stack[this.stack.length - 1]?.id === s.topId;
  }
  undoAction(pid) {
    if (!this.canUndoAction(pid)) return false;
    const s = this.undoSnap;
    const keep = { rng: this.rng, events: this.events, opts: this.opts, undoFor: this.undoFor, rngCalls: s.rngCalls, logSeq: s.logSeq, epoch: this.undoEpoch + 1 };
    const h = Game.restore(s.data, { live: true, rng: this.rng });
    for (const k of Object.keys(h)) this[k] = h[k];
    this.rng = keep.rng; this.events = keep.events; this.opts = keep.opts; this.undoFor = keep.undoFor; this.rngCalls = keep.rngCalls; this.logSeq = keep.logSeq; this.undoEpoch = keep.epoch; this.undoSnap = null;
    this.emit({ type: 'undo', id: s.cardId, pid });
    return true;
  }

  // ---------- "does this player have anything to do?" (UI auto-pass) ----------
  canAttackAny(pid) { return !this.winner && this.players[pid].bf.some((p) => this.attackAllowed(p, this.opp(pid))); }
  // Conservative: true when the player could legally play a land, cast a spell, activate a non-mana ability, attack or block in the current
  // step/window (as if they held priority now). Evaluated with the real canCast/activatable; when in doubt returns true.
  hasAnyAction(pid) {
    if (this.winner) return false;
    const w = this.waiting;
    if (w && w.kind !== 'priority') {
      if (w.player !== pid) return false;
      if (w.kind === 'attackers') return this.canAttackAny(pid);
      if (w.kind === 'blockers') return this.players[pid].bf.some((b) => this.isCreature(b) && !b.tapped);
      return true; // discard, choice, mulligan, bottom: the player must answer
    }
    const saved = this.waiting;
    try {
      this.waiting = { kind: 'priority', player: pid };
      const p = this.players[pid];
      if (p.hand.some((c) => this.canPlayLand(pid, c) || this.canCast(pid, c))) return true;
      if (this.activatable(pid).length) return true;
      return false;
    } catch (e) { return true; } finally { this.waiting = saved; }
  }

  // ---------- mercy: take back a land drop ----------
  canUndoLand(pid) {
    const l = this.players[pid].lastLand;
    if (!l || this.winner || this.waiting?.kind !== 'priority' || this.waiting.player !== pid) return false;
    return l.turn === this.turn && this.active === pid && this.hasMainTiming(pid) && this.perm(l.perm) === l.perm && !l.perm.tapped && this.logEvents.length === l.logLen && !this.curAsk && !this.asks.length
      && !this.allPerms().some((p) => p.attachedTo === l.perm.id);
  }
  undoLandDrop(pid) {
    if (!this.canUndoLand(pid)) return false;
    const p = this.players[pid], l = p.lastLand;
    p.bf = p.bf.filter((x) => x !== l.perm); this.ver++;
    p.hand.push(l.perm.card); p.landsPlayed--; p.landPlayed = p.landsPlayed >= this.landDrops(pid);
    this.log.pop(); this.logEvents.pop(); p.lastLand = null;
    return true;
  }

  // ---------- save / resume ----------
  // Only possible between decisions: no pending choice, no function-valued state (delayed effects, shield callbacks, stack triggers).
  canSerialize() { try { this.encodeState(); return true; } catch (e) { return false; } }
  encodeState(live = false) {
    if (this.curAsk || this.asks.length || this.idle.length || this.delayed.length || this.ghosts.length || this.phased?.length || this.pendingCallbacks?.length) throw new Error('pending decision or effect');
    const cards = {};
    const cardRef = (c) => {
      if (!cards[c.id]) {
        const d = c.baseDef || c.def;
        cards[c.id] = { id: c.id, owner: c.owner, ref: defRef(d), art: c.art, token: c.token || undefined, counters: c.counters && { ...c.counters }, tokenDef: c.token ? c.def : undefined, cur: c.baseDef ? defRef(c.def) : undefined, copyOf: c.copyOf, ...(live ? { defObj: d, curObj: c.baseDef ? c.def : undefined } : {}) };
        if (c.baseDef) cards[c.id].curFull = c.def;
      }
      return { $c: c.id };
    };
    const isCard = (v) => 'def' in v && 'owner' in v && 'id' in v && !('controller' in v);
    const isPerm = (v) => 'card' in v && 'controller' in v && 'tapped' in v;
    const isDef = (v) => 'types' in v && 'manaCost' in v;
    const enc = (v) => {
      if (v === undefined || v === null) return v ?? null;
      if (typeof v === 'function') throw new Error('function in state');
      if (typeof v === 'number') return Number.isFinite(v) ? v : { $n: v > 0 ? 'inf' : v < 0 ? '-inf' : 'nan' };
      if (typeof v !== 'object') return v;
      if (Array.isArray(v)) return v.map(enc);
      if (v instanceof Set) return { $set: [...v].map(enc) };
      if (isCard(v)) return cardRef(v);
      if (isPerm(v)) return { $p: v.id };
      if (isDef(v)) return v.token ? { $tdef: JSON.parse(JSON.stringify(v)), obj: live ? v : undefined } : live ? { $def: defRef(v), obj: v } : { $def: defRef(v) };
      const o = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = enc(x); return o;
    };
    const encPerm = (p) => { const o = {}; for (const [k, x] of Object.entries(p)) if (x !== undefined && k !== 'kw' && k !== 'auraSpec') o[k] = k === 'card' ? cardRef(x) : enc(x); return o; };
    const players = this.players.map((pl) => { const o = {}; for (const [k, x] of Object.entries(pl)) o[k] = k === 'bf' ? x.map(encPerm) : enc(x); return o; });
    const stack = this.stack.map((it) => {
      if (it.effect?.trigger) throw new Error('trigger on stack');
      const o = {}; for (const [k, x] of Object.entries(it)) if (k !== 'effect') o[k] = k === 'source' && x && !this.perm(x) ? { $ps: encPerm(x) } : enc(x);
      if (it.kind === 'ability' && it.abIdx === undefined) throw new Error('ability without index');
      return o;
    });
    const sh = this.shields.map((x) => enc(x));
    return {
      v: 1, rng: this.rng.getState ? this.rng.getState() : null, cards, players, stack, shields: sh,
      g: enc({ names: this.names, nextId: this.nextId, turn: this.turn, active: this.active, first: this.first, winner: this.winner, step: this.step, waiting: this.waiting, passes: this.passes, combat: this.combat, extraTurns: this.extraTurns, noCombatDamage: this.noCombatDamage, diedThisTurn: this.diedThisTurn, mull: this.mull, ts: this.ts, turnSpells: this.turnSpells, blockLog: this.blockLog, damageLog: this.damageLog, log: this.log, logEvents: this.logEvents, auto: [...this.auto], opts: { mulligan: this.opts?.mulligan, autoMulligan: this.opts?.autoMulligan } }),
    };
  }
  serialize() { return JSON.parse(JSON.stringify(this.encodeState())); }
  // opts: { rng?, cards: [defs] | byName: {name:[defs]} }  (the card catalogue the game was built from)
  static restore(json, opts = {}) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const byName = opts.byName || (() => { const m = {}; for (const c of opts.cards || []) (m[c.name] ||= []).push(c); return m; })();
    const lookup = (r) => { const l = byName[r.name]; if (!l) throw new Error('card not in catalogue: ' + r.name); return l.find((c) => c.set === r.set && c.number === r.number) || l[0]; };
    const g = Object.create(Game.prototype);
    const cards = {}; const perms = {};
    for (const c of Object.values(data.cards)) {
      const def = c.token ? c.tokenDef : (c.defObj || lookup(c.ref));
      const card = { id: c.id, def, owner: c.owner };
      if (c.art !== undefined) card.art = c.art; else if (def.art) card.art = def.art;
      if (c.token) card.token = true;
      if (c.copyOf !== undefined) card.copyOf = c.copyOf;
      if (c.counters) card.counters = c.counters;
      if (c.cur) { card.baseDef = def; card.def = c.curObj || (c.curFull ? { ...lookup(c.cur), ...c.curFull } : def); }
      cards[c.id] = card;
    }
    const dec = (v) => {
      if (v === null || typeof v !== 'object') return v;
      if (Array.isArray(v)) return v.map(dec);
      if ('$c' in v) return cards[v.$c];
      if ('$p' in v) return perms[v.$p];
      if ('$ps' in v) { const t = {}; for (const [kk, vv] of Object.entries(v.$ps)) t[kk] = kk === 'card' ? cards[vv.$c] : dec(vv); return t; }
      if ('$tdef' in v) return v.obj || v.$tdef;
      if ('$def' in v) return v.obj || lookup(v.$def);
      if ('$n' in v) return v.$n === 'inf' ? Infinity : v.$n === '-inf' ? -Infinity : NaN;
      if ('$set' in v) return new Set(v.$set.map(dec));
      const o = {}; for (const [k, x] of Object.entries(v)) o[k] = dec(x); return o;
    };
    for (const pl of data.players) for (const p of pl.bf) perms[p.id] = {};
    g.players = data.players.map((pl) => {
      const o = {}; for (const [k, x] of Object.entries(pl)) {
        if (k === 'bf') o.bf = x.map((p) => { const t = perms[p.id]; for (const [kk, vv] of Object.entries(p)) t[kk] = kk === 'card' ? cards[vv.$c] : dec(vv); return t; });
        else o[k] = dec(x);
      }
      return o;
    });
    const gd = dec(data.g);
    Object.assign(g, gd);
    g.auto = new Set(gd.auto);
    g.opts = gd.opts;
    g.stepActions = 0; g._mctx = null; for (const pl of g.players) pl.poolR ||= [];
    g.rngCalls = 0; g.logSeq = 0; g.undoEpoch = 0; g.undoSnap = null; g.undoFor = [];
    g.rng = opts.live ? opts.rng : g.wrapRng(opts.rng || makeRng(1));
    if (data.rng !== null && g.rng.setState) g.rng.setState(data.rng);
    g.events = []; g.asks = []; g.curAsk = null; g.idle = []; g.inAsk = false; g.prevWaiting = null; g.delayed = []; g.ghosts = []; g.pendingCallbacks = [];
    g.inSba = false; g.sbaAgain = false; g._tyGuard = false; g._depth = 0; g._lg = false; g.ver = 0; g._stSig = null;
    g.legendPending = new Set(); g.currentController = null; g.deathWatch = [];
    g.shields = data.shields.map(dec);
    g.stack = data.stack.map((it) => {
      const o = dec(it);
      o.effect = o.kind === 'spell' ? EFFECTS[o.card.def.name] : g.abilitiesOf(o.source)[o.abIdx];
      return o;
    });
    return g;
  }

  endCombat() {
    for (const p of this.allPerms()) p.mods = p.mods.filter((m) => m.until !== 'endCombat');
    this.fire('onEndCombat');
    this.runDelayed('endCombat', this.active);
    for (const p of this.allPerms()) p.attacking = false;
    this.combat = { attackers: [], blocks: {}, blocked: [], bands: [] };
    this.sba();
  }
}
