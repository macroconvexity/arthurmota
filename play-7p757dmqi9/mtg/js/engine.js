import { COLORS, EFFECTS, TRIGGERS, STATIC, abilitiesOf as defAbilities, keywordsOf, auraSpecOf } from './cards.js?v=202611021205';

export const STEPS = ['untap', 'upkeep', 'draw', 'main1', 'attackers', 'blockers', 'damage', 'main2', 'end'];
const NOLOST = new Set();
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
const addGeneric = (c, n) => { if (n > 0) { c.generic += n; c.total += n; } return c; };
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

export class Game {
  constructor(decks, opts = {}) {
    this.rng = opts.rng || Math.random;
    this.names = opts.names || ['You', 'Opponent'];
    this.auto = new Set(opts.auto || []);   // players whose choices are answered automatically
    this.log = [];
    this.events = [];       // UI animation hints
    this.nextId = 1;
    this.players = [0, 1].map((i) => ({ id: i, name: this.names[i], life: 20, library: [], hand: [], bf: [], gy: [], ex: [], pool: emptyPool(), landPlayed: false, landsPlayed: 0, drewEmpty: false, skip: { untap: 0, draw: 0, turn: 0 }, mods: [], damageTaken: 0, damageFrom: [] }));
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
    this.delayed = []; this.shields = []; this.extraTurns = []; this.ghosts = []; this.pendingCallbacks = [];
    this.diedThisTurn = 0; this.noCombatDamage = false;
    this.inSba = false; this.sbaAgain = false; this._tyGuard = false; this._depth = 0;
    for (const i of [0, 1]) this.draw(i, 7, true);
    this.startTurn();
  }

  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  shuffleLibrary(pid) { this.shuffle(this.players[pid].library); this.emit({ type: 'shuffle', pid }); }
  say(m) { this.log.push(m); if (this.log.length > 200) this.log.shift(); }
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
  findCard(id) { for (const p of this.players) for (const z of ['hand', 'library', 'gy', 'ex']) { const c = p[z].find((x) => x.id === id); if (c) return c; } return null; }

  // ---------- continuous effects ----------
  statics() {
    const out = [];
    for (const pl of this.players) for (const src of pl.bf) {
      const s = STATIC[src.card.def.name]; if (!s) continue;
      for (const e of asArr(s)) out.push({ src, e });
    }
    for (const gh of this.ghosts) for (const e of gh.ents) out.push({ src: gh.src, e });
    if (out.length && !this._lg) { const lost = this.lostSet(); if (lost.size) return out.filter((x) => !lost.has(x.src)); }
    return out;
  }
  rule(key, ...args) { for (const { src, e } of this.statics()) if (e[key] && e[key](this, src, ...args)) return true; return false; }
  ruleSum(key, ...args) { let n = 0; for (const { src, e } of this.statics()) if (e[key]) n += e[key](this, src, ...args) || 0; return n; }
  ruleVals(key, ...args) { const o = []; for (const { src, e } of this.statics()) if (e[key]) { const v = e[key](this, src, ...args); if (v != null && v !== false) o.push(v); } return o; }
  applies(e, src, p) { return e.affects ? !!e.affects(this, src, p) : false; }
  types(p) {
    const base = p.card.def.types;
    if (this._tyGuard) return base;
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
    if (this._tyGuard) return base;
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
    if (this._depth > 3 || !p.mods) return c;
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
    return r;
  }
  gyAbove(card) { const gy = this.players[card.owner].gy; return gy.slice(gy.indexOf(card) + 1); }
  fire(ev, ...args) {
    for (const pid of [this.active, this.opp(this.active)]) {
      const lost = this.lostSet();
      for (const perm of [...this.players[pid].bf]) {
        if (this.winner) return;
        if (lost.has(perm)) continue;
        const h = TRIGGERS[perm.card.def.name]?.[ev]; const x = perm.extraTriggers?.[ev];
        if ((h || x) && this.players[perm.controller].bf.includes(perm)) { if (h) h(this, perm, ...args); if (x) x(this, perm, ...args); }
      }
      for (const card of [...this.players[pid].gy]) {
        const h = TRIGGERS[card.def.name]?.gy?.[ev];
        if (h && this.players[pid].gy.includes(card)) h(this, card, ...args);
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
    const ents = [];
    for (const pl of this.players) for (const src of pl.bf) { const s = STATIC[src.card.def.name]; if (s) for (const e of asArr(s)) if (e.loseAbilities) ents.push({ src, e }); }
    for (const gh of this.ghosts) for (const e of gh.ents) if (e.loseAbilities) ents.push({ src: gh.src, e });
    if (!ents.length) return NOLOST;
    this._lg = true;
    try { const set = new Set(); for (const p of this.allPerms()) if (ents.some(({ src, e }) => this.applies(e, src, p))) set.add(p); return set; } finally { this._lg = false; }
  }
  delay(when, fn, opts = {}) { this.delayed.push({ when, fn, pid: opts.pid ?? this.active, turn: this.turn }); }
  runDelayed(when, pid) {
    const due = this.delayed.filter((d) => d.when === when && (when !== 'upkeep' || d.pid === pid));
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
    if (req.type === 'number') return req.min ?? 0;
    const opts = [...req.options].sort((a, b) => (b.score || 0) - (a.score || 0));
    return opts.slice(0, Math.min(req.max ?? 1, Math.max(req.min ?? 1, 1))).map((o) => o.value);
  }
  autoAnswer() { return this.curAsk ? this.autoFor(this.curAsk.req) : undefined; }
  choose(pid, answer) {
    const a = this.curAsk; if (!a || a.pid !== pid) return false;
    const r = a.req; let v = answer;
    if (r.type === 'yesno') v = !!answer;
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
  discardChoice(pid, n, cb) {
    const p = this.players[pid]; n = Math.min(n, p.hand.length);
    if (!n) return cb?.([]);
    this.pickCards(pid, p.hand, { prompt: `Discard ${n} card${n > 1 ? 's' : ''}`, min: n, score: (c) => -cmcOf(c.def) }, (cs) => {
      for (const c of cs) { p.hand = p.hand.filter((x) => x !== c); p.gy.push(c); this.say(`${p.name} discards ${c.def.name}.`); }
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
    const p = this.players[pid];
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      if (!p.library.length) { p.drewEmpty = true; continue; }
      const c = p.library.pop(); p.hand.push(c); drawn++; p.lastDrawn = { card: c, turn: this.turn };
    }
    if (!silent) { this.say(`${p.name} draws ${n > 1 ? n + ' cards' : 'a card'}.`); if (drawn) this.fire('onDraw', pid, drawn); }
  }
  reveal(viewer, target, zone = 'hand') { this.emit({ type: 'reveal', viewer, target, zone, cards: this.players[target][zone].map((c) => ({ id: c.id, name: c.def.name })) }); }
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
  mill(pid, n) { const p = this.players[pid]; for (let i = 0; i < n && p.library.length; i++) p.gy.push(p.library.pop()); }
  discardRandom(pid) {
    const p = this.players[pid]; if (!p.hand.length) return;
    const c = p.hand.splice(Math.floor(this.rng() * p.hand.length), 1)[0]; p.gy.push(c);
    this.say(`${p.name} discards ${c.def.name}.`);
  }
  gainLife(pid, n) {
    if (n <= 0) return;
    const rep = this.ruleVals('replaceLifeGain', pid, n)[0];
    if (rep) return;
    this.players[pid].life += n; this.emit({ type: 'heal', pid }); this.say(`${this.players[pid].name} gains ${n} life.`);
    this.fire('onLifeGain', pid, n);
  }
  loseLife(pid, n) {
    if (n <= 0) return;
    this.players[pid].life -= n; this.emit({ type: 'dmg', target: { kind: 'player', id: pid }, n });
    this.say(`${this.players[pid].name} loses ${n} life.`);
    this.fire('onLifeLoss', pid, n);
    this.sba();
  }
  addMana(pid, colour, n = 1) { this.players[pid].pool[colour] += n; }
  newPerm(card, controller, opts = {}) {
    const perm = { id: card.id, card, controller, baseCtl: controller, tapped: !!opts.tapped, sick: true, damage: 0, mods: [], counters: {}, attachedTo: opts.attachedTo ?? null, attacking: false, regen: 0, used: {}, x: opts.x ?? 0, enteredTurn: this.turn, damagedBy: [] };
    if (opts.targetRef) perm.targetRef = opts.targetRef;
    if (opts.played) perm.played = true;
    this.players[controller].bf.push(perm);
    this.emit({ type: 'enter', id: perm.id });
    if (opts.counters) for (const [k, n] of Object.entries(opts.counters)) perm.counters[k] = n;
    if (!opts.silent) { this.self(perm, 'onEnter'); this.fire('onAnyEnter', perm); }
    return perm;
  }
  putOntoBattlefield(card, controller, opts = {}) {
    if (opts.from !== null) for (const pl of this.players) for (const z of ['hand', 'library', 'gy', 'ex']) { const i = pl[z].indexOf(card); if (i >= 0) pl[z].splice(i, 1); }
    this.say(`${card.def.name} enters the battlefield under ${this.players[controller].name}'s control.`);
    return this.newPerm(card, controller, opts);
  }
  reanimate(pid, card, opts) { return this.putOntoBattlefield(card, pid, opts); }
  createToken(pid, spec) {
    const kwLines = (spec.kw || []).map(cap).join('\n');
    const def = {
      name: spec.name, manaCost: '', manaValue: 0, types: spec.types || ['Creature'], subtypes: spec.subtypes || [], supertypes: [], colors: spec.colors || [],
      text: [spec.text || '', kwLines].filter(Boolean).join('\n'), power: String(spec.power ?? 0), toughness: String(spec.toughness ?? 0), token: true, type: spec.type || 'Token', art: spec.art,
    };
    const card = { id: this.nextId++, def, owner: pid, token: true, art: spec.art };
    this.say(`${this.players[pid].name} creates a ${spec.name} token.`);
    const perm = this.newPerm(card, pid, { silent: true });
    this.emit({ type: 'token', id: perm.id });
    this.self(perm, 'onEnter'); this.fire('onAnyEnter', perm);
    return perm;
  }
  removeFromCombat(perm) {
    this.combat.attackers = this.combat.attackers.filter((a) => a !== perm.id);
    delete this.combat.blocks[perm.id];
    for (const k of Object.keys(this.combat.blocks)) this.combat.blocks[k] = this.combat.blocks[k].filter((b) => b !== perm.id);
    perm.attacking = false;
  }
  leave(perm, zone, opts = {}) {
    const pl = this.players[perm.controller];
    if (!pl.bf.includes(perm)) return false;
    const wasCreature = this.isCreature(perm);
    for (const a of this.allPerms()) if (a.attachedTo === perm.id) this.self(a, 'onHostLeave', perm, zone);
    { const ents = asArr(STATIC[perm.card.def.name]).filter((e) => e.lingers); if (ents.length) this.ghosts.push({ src: perm, ents }); }
    pl.bf = pl.bf.filter((x) => x !== perm);
    this.removeFromCombat(perm);
    if (zone === 'gy' && perm.mods.some((m) => m.exileOnDie)) zone = 'ex';
    if (!perm.card.token) this.players[perm.card.owner][zone === 'lib' ? 'library' : zone].push(perm.card);
    this.shields = this.shields.filter((s) => !(s.ref.kind === 'perm' && s.ref.id === perm.id));
    if (zone === 'gy') { if (wasCreature) this.diedThisTurn++; }
    // auras fall off
    for (const a of this.allPerms()) if (a.attachedTo === perm.id) this.leave(a, 'gy');
    this.self(perm, 'onLeave', zone);
    if (zone === 'gy') {
      if (wasCreature) this.self(perm, 'onDie');
      this.fire('onAnyDie', perm);
      if (wasCreature) this.fire('onCreatureDies', perm);
    }
    if (perm.card.baseDef) { perm.card.def = perm.card.baseDef; delete perm.card.baseDef; }
    this.sba();
    return true;
  }
  destroy(perm, opts = {}) {
    if (!perm || !this.perm(perm)) return false;
    if (this.kw(perm).has('indestructible')) return false;
    if (!opts.noRegen && !perm.mods.some((m) => m.noRegen) && perm.regen > 0) {
      perm.regen--; perm.damage = 0; perm.tapped = true; this.removeFromCombat(perm);
      this.say(`${perm.card.def.name} regenerates.`); this.emit({ type: 'regen', id: perm.id });
      return false;
    }
    this.say(`${perm.card.def.name} is destroyed.`); this.emit({ type: 'die', id: perm.id });
    this.leave(perm, 'gy');
    return true;
  }
  sacrifice(perm) { if (!perm || !this.perm(perm)) return false; this.say(`${this.players[perm.controller].name} sacrifices ${perm.card.def.name}.`); this.emit({ type: 'die', id: perm.id }); return this.leave(perm, 'gy'); }
  exile(perm) { if (!perm || !this.perm(perm)) return; this.say(`${perm.card.def.name} is exiled.`); this.leave(perm, 'ex'); }
  bounce(perm) { if (!perm || !this.perm(perm)) return; this.say(`${perm.card.def.name} returns to hand.`); this.emit({ type: 'bounce', id: perm.id }); this.leave(perm, 'hand'); }
  regenerate(perm) { if (perm && perm.mods.some((m) => m.noRegen)) { this.say(`${perm.card.def.name} can't be regenerated.`); return; } if (perm) { perm.regen = (perm.regen || 0) + 1; this.say(`${perm.card.def.name} gets a regeneration shield.`); } }
  attach(aura, host) { aura.attachedTo = host.id; this.emit({ type: 'attach', id: aura.id, host: host.id }); }
  setController(perm, pid, opts = {}) {
    if (perm.controller === pid) { if (opts.permanent) perm.baseCtl = pid; return; }
    const from = this.players[perm.controller];
    from.bf = from.bf.filter((x) => x !== perm);
    this.removeFromCombat(perm);
    perm.controller = pid; perm.sick = true; perm.tapped = perm.tapped;
    if (opts.permanent) perm.baseCtl = pid;
    this.players[pid].bf.push(perm);
    this.emit({ type: 'control', id: perm.id, to: pid });
    this.say(`${this.players[pid].name} gains control of ${perm.card.def.name}.`);
  }
  counterSpell(ref) {
    const i = this.stack.findIndex((s) => s.id === ref.id); if (i < 0) return;
    const [s] = this.stack.splice(i, 1); this.emit({ type: 'counter', id: s.card.id });
    if (s.kind === 'spell' && !s.copy) this.players[s.card.owner].gy.push(s.card);
    this.say(`${s.card.def.name} is countered.`);
  }

  tap(perm, silent) { if (perm.tapped) return; perm.tapped = true; this.emit({ type: 'tap', id: perm.id }); this.self(perm, 'onTap'); if (!silent) this.fire('onAnyTap', perm); }
  untapPerm(perm) { if (!perm.tapped) return; perm.tapped = false; this.emit({ type: 'untap', id: perm.id }); this.self(perm, 'onUntap'); }
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
      if (s.sourceId != null && s.sourceId !== src?.card?.id) continue;
      if (s.sourceColor && !this.srcColors(src).includes(s.sourceColor)) continue;
      if (s.filter && !s.filter(src)) continue;
      const avail = Math.max(0, n - (s.keep || 0));
      const used = Math.min(avail, s.n); n -= used; s.n -= used;
      this.emit({ type: 'prevent', target: ref, n: used });
      if (s.onPrevent && used > 0) (this.pendingCallbacks ||= []).push(() => s.onPrevent(this, used, src, ref));
      if (s.redirect && used > 0) { const r = s.redirect; this.pendingRedirects = (this.pendingRedirects || []); this.pendingRedirects.push([src, r, used]); }
      if (s.n <= 0 || s.once) this.shields = this.shields.filter((x) => x !== s);
    }
    const t = ref.kind === 'perm' ? this.perm(ref) : null;
    for (const { src: ss, e } of this.statics()) if (e.preventDamage && n > 0) n = e.preventDamage(this, ss, { src, target: ref, n, combat: !!opts.combat, perm: t });
    return Math.max(0, n);
  }
  damage(src, ref, n, opts = {}) {
    if (n <= 0) return 0;
    n = this.applyPrevention(src, ref, n, opts);
    if (this.pendingRedirects?.length) { const rd = this.pendingRedirects; this.pendingRedirects = []; for (const [rs, rr, rn] of rd) this.damage(rs, rr, rn, { ...opts, noSba: true }); }
    this.lastPrevented = 0;
    if (this.pendingCallbacks?.length) { const cbs = this.pendingCallbacks; this.pendingCallbacks = []; for (const f of cbs) f(); }
    if (n <= 0) { if (!opts.noSba) this.sba(); return 0; }
    if (ref.kind === 'player') { const pl = this.players[ref.id]; pl.life -= n; pl.damageTaken += n; }
    else { const p = this.perm(ref); if (!p) return 0; p.damage += n; if (src?.card && !p.damagedBy.includes(src.card.id)) p.damagedBy.push(src.card.id); }
    const rec = src?.card ? { src: src.card.id, def: src.card.def, types: src.mods ? this.types(src) : src.card.def.types, colors: this.colors(src), n } : { src: null, def: null, types: [], colors: [], n };
    if (ref.kind === 'player') this.players[ref.id].damageFrom.push(rec); else { const t = this.perm(ref); if (t) (t.damageFrom ||= []).push(rec); }
    this.emit({ type: 'dmg', target: ref, n, from: src?.card?.id });
    this.say(`${n} damage to ${this.refText(ref)}.`);
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
          let want = p.baseCtl;
          for (const { src, e } of sts) if (this.applies(e, src, p)) { const c = e.control(this, src, p); if (c != null) want = c; }
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
        for (const p of this.allPerms()) { const h = TRIGGERS[p.card.def.name]?.onState; if (h) h(this, p); }
        for (const pl of this.players) {
          if ((pl.life <= 0 && !this.rule('cantLose', pl.id)) || pl.drewEmpty) {
            if (!this.winner) { this.winner = { id: 1 - pl.id, reason: pl.life <= 0 ? 'life' : 'deck' }; this.waiting = null; this.curAsk = null; this.asks = []; this.say(`${this.players[1 - pl.id].name} wins.`); }
          }
        }
      } while (this.sbaAgain && guard++ < 50);
    } finally { this.inSba = false; }
  }

  // ---------- mana ----------
  manaSources(pid) {
    const out = [];
    for (const perm of this.players[pid].bf) {
      for (const ab of this.abilitiesOf(perm)) {
        if (!ab.mana || ab.cost.mana) continue;
        if (ab.cost.tap && (perm.tapped || (this.isCreature(perm) && perm.sick && !this.kw(perm).has('haste')))) continue;
        out.push({ perm, ab, opts: ab.mana.colors, amount: ab.mana.amount, rank: ab.cost.sac ? 100 : this.isCreature(perm) ? 50 : ab.mana.colors.length });
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
  // pay-life-as-mana (Channel) and converters are layered on top of the plain planner
  planPayment(pid, cost, excl = new Set(), depth = 0) {
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
    const used = new Set(); const assign = new Map(); const cap = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    const dfs = (i) => {
      if (i === pips.length) {
        let remain = g0 - Object.values(cap).reduce((a, b) => a + b, 0);
        const extra = [];
        for (const s of srcs) { if (remain <= 0) break; if (!used.has(s)) { extra.push(s); remain -= s.amount; } }
        return remain <= 0 ? [...used, ...extra] : null;
      }
      const c = pips[i];
      if (cap[c] > 0) { cap[c]--; const r = dfs(i + 1); if (r) return r; cap[c]++; }
      for (const s of srcs) {
        if (used.has(s) || !s.opts.includes(c)) continue;
        used.add(s); assign.set(s, c); cap[c] += s.amount - 1;
        const r = dfs(i + 1); if (r) return r;
        cap[c] -= s.amount - 1; used.delete(s); assign.delete(s);
      }
      return null;
    };
    const taps = dfs(0);
    return taps ? { taps, assign, needFromPool: { W: cost.W - need.W, U: cost.U - need.U, B: cost.B - need.B, R: cost.R - need.R, G: cost.G - need.G }, g0 } : null;
  }
  canPay(pid, cost) { return cost.total === 0 || !!this.planPayment(pid, cost); }
  pay(pid, cost0) {
    if (cost0.total === 0) return true;
    const plan = this.planPayment(pid, cost0); if (!plan) return false;
    const cost = plan.cost;
    if (plan.life) { this.players[pid].life -= plan.life; this.say(`${this.players[pid].name} pays ${plan.life} life for mana.`); }
    for (const c of plan.conv || []) { c.perm.tapped = true; this.emit({ type: 'tap', id: c.perm.id }); }
    const pool = this.players[pid].pool;
    for (const c of COLORS) pool[c] -= plan.needFromPool[c];
    let left = plan.g0 === cost.generic ? 0 : cost.generic - plan.g0;
    for (const c of [...COLORS, 'C']) { const u = Math.min(pool[c], left); pool[c] -= u; left -= u; }
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
  validTargets(spec, pid, sourceId, srcCard) {
    const out = [];
    const info = this.specInfo(spec);
    const sourcePerm = sourceId != null ? this.perm(sourceId) : null;
    const card = srcCard || sourcePerm?.card || (sourceId != null ? this.stack.find((s) => s.id === sourceId)?.card : null);
    const colors = card ? this.srcColors(sourcePerm || { card }) : [];
    const ctx = { pid, source: sourcePerm, card };
    const addPlayers = () => this.players.forEach((p) => out.push({ kind: 'player', id: p.id }));
    const isAura = card && !!auraSpecOf(card.def);
    const permOk = (p) => { if (isAura && this.rule('cantBeEnchanted', p, card)) return false; if (sourcePerm && p.id === sourcePerm.id && info.selfExcluded) return false; const kw = this.kw(p); if (kw.has('shroud')) return false; return !colors.some((c) => kw.has('pro:' + c)); };
    const addPerms = (f) => this.players.forEach((pl) => pl.bf.forEach((p) => f(p) && permOk(p) && out.push({ kind: 'perm', id: p.id })));
    switch (info.kind) {
      case 'any': addPlayers(); addPerms((p) => this.isCreature(p)); break;
      case 'player': addPlayers(); break;
      case 'perm': addPerms((p) => info.test(this, p, ctx)); break;
      case 'spell': this.stack.filter((s) => s.kind === 'spell' && s.id !== sourceId && info.test(this, s, ctx)).forEach((s) => out.push({ kind: 'spell', id: s.id })); break;
      case 'card': for (const pl of this.players) for (const c of pl.gy) if (info.test(this, c, ctx)) out.push({ kind: 'card', id: c.id }); break;
      default: break;
    }
    return out;
  }
  targetLegal(t, spec, it) {
    if (t.kind === 'player') return true;
    if (t.kind === 'spell') return this.stack.some((s) => s.id === t.id);
    if (t.kind === 'card') return this.players.some((p) => p.gy.some((c) => c.id === t.id));
    if (!this.perm(t)) return false;
    if (spec == null) return true;
    return this.validTargets(spec, it.controller, it.source?.id ?? it.id, it.card).some((r) => r.kind === t.kind && r.id === t.id);
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
  maxX(pid, card) {
    let lo = 0;
    for (let x = 0; x < 40; x++) { if (this.canPay(pid, this.spellCost(pid, card, x, 1))) lo = x; else break; }
    return lo;
  }

  // ---------- actions ----------
  hasMainTiming(pid) { return this.active === pid && (this.step === 'main1' || this.step === 'main2') && this.stack.length === 0; }
  landDrops(pid) { return 1 + this.ruleSum('extraLandPlays', pid); }
  canPlayLand(pid, card) {
    const p = this.players[pid];
    return !this.winner && this.waiting?.kind === 'priority' && this.waiting.player === pid && card.def.types.includes('Land') && this.hasMainTiming(pid) && p.landsPlayed < this.landDrops(pid) && p.hand.includes(card);
  }
  canCast(pid, card) {
    const d = card.def;
    if (this.winner || this.waiting?.kind !== 'priority' || this.waiting.player !== pid || !this.players[pid].hand.includes(card)) return false;
    if (d.types.includes('Land')) return false;
    const fast = d.types.includes('Instant') || this.kwCard(card).has('flash');
    if (!fast && !this.hasMainTiming(pid)) return false;
    const eff = EFFECTS[d.name];
    if (eff?.castWhen && !eff.castWhen(this, pid, card)) return false;
    const info = this.castInfo(card, eff?.modes ? this.firstCastableMode(pid, card) : undefined);
    if (eff?.modes && this.firstCastableMode(pid, card) == null) return false;
    for (const spec of info.targets) if (!this.validTargets(spec, pid, null, card).length) return false;
    if (info.multi && info.multi.min > 0 && !this.validTargets(info.multi.spec, pid, null, card).length) return false;
    if (eff?.cost && !this.extraCostPayable(pid, null, eff.cost)) return false;
    return this.canPay(pid, this.spellCost(pid, card, 0, 1));
  }
  firstCastableMode(pid, card) {
    const eff = EFFECTS[card.def.name];
    for (let i = 0; i < eff.modes.length; i++) if (eff.modes[i].targets.every((s) => this.validTargets(s, pid, null, card).length)) return i;
    return null;
  }
  playLand(pid, card) {
    if (!this.canPlayLand(pid, card)) return false;
    const p = this.players[pid]; p.hand = p.hand.filter((c) => c !== card); p.landsPlayed++; p.landPlayed = p.landsPlayed >= this.landDrops(pid);
    this.say(`${p.name} plays ${card.def.name}.`);
    const perm = this.newPerm(card, pid, { silent: true, played: true });
    this.self(perm, 'onEnter'); this.fire('onAnyEnter', perm);
    this.passes = 0; return true;
  }
  cast(pid, card, targets = [], x = 0, extra = {}) {
    if (!this.canCast(pid, card)) return false;
    const eff = EFFECTS[card.def.name];
    const mode = eff?.modes ? (extra.mode ?? this.firstCastableMode(pid, card)) : undefined;
    const info = this.castInfo(card, mode);
    const specs = [...info.targets];
    if (info.multi) {
      const mn = info.multi.min === 'x' ? x : info.multi.min ?? 1, mx = info.multi.max === 'x' ? x : info.multi.max ?? Infinity;
      if (targets.length < mn || targets.length > mx) return false;
      specs.length = 0; for (let i = 0; i < targets.length; i++) specs.push(info.multi.spec);
    } else if (targets.length !== specs.length) return false;
    for (let i = 0; i < specs.length; i++) {
      if (!this.validTargets(specs[i], pid, null, card).some((r) => r.kind === targets[i].kind && r.id === targets[i].id)) return false;
    }
    if (info.hasX && x > this.maxX(pid, card)) return false;
    const cost = this.spellCost(pid, card, info.hasX ? x : 0, targets.length, mode);
    if (!this.canPay(pid, cost)) return false;
    let paidExtra = null;
    if (eff?.cost) { paidExtra = this.payExtraCosts(pid, null, eff.cost, extra.choices || {}); if (!paidExtra) return false; }
    this.pay(pid, cost);
    const p = this.players[pid]; p.hand = p.hand.filter((c) => c !== card);
    const item = { id: card.id, kind: 'spell', card, controller: pid, targets, specs, effect: eff, x: info.hasX ? x : 0, mode, paid: paidExtra };
    this.stack.push(item);
    this.say(`${p.name} casts ${card.def.name}${targets.length ? ' targeting ' + targets.map((t) => this.refText(t)).join(', ') : ''}.`);
    this.emit({ type: 'cast', id: card.id });
    this.passes = 0; this.setPriority(pid);
    this.fire('onSpellCast', item);
    return true;
  }
  // ---- costs shared by spells and abilities ----
  extraCandidates(pid, perm, spec, selfPerm) {
    const f = typeof spec === 'function' ? spec : (g, p) => (PERM_SPECS[spec] ? PERM_SPECS[spec](g, p, { pid }) : g.hasType(p, spec) || g.hasSubtype(p, spec));
    return this.players[pid].bf.filter((p) => p !== selfPerm && f(this, p, selfPerm));
  }
  extraCostPayable(pid, perm, cost) {
    const pl = this.players[pid];
    if (cost.sacOther && !this.extraCandidates(pid, perm, cost.sacOther, perm).length) return false;
    if (cost.tapOther && this.extraCandidates(pid, perm, cost.tapOther, perm).filter((p) => !p.tapped).length < (cost.tapN || 1)) return false;
    if (cost.counter) { const cc = typeof cost.counter === 'string' ? { type: cost.counter, n: 1 } : cost.counter; if (!perm || !(perm.counters?.[cc.type] >= cc.n)) return false; }
    if (cost.life && pl.life <= cost.life) return false;
    if (cost.discard && pl.hand.length < cost.discard) return false;
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
    if (cost.sacOther) {
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
    for (const t of taps) { this.tap(t); paid.tapped.push(t); }
    for (const c of dis) { pl.hand = pl.hand.filter((x) => x !== c); pl.gy.push(c); paid.discarded.push(c); this.say(`${pl.name} discards ${c.def.name}.`); }
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
    const a = this.activatable(pid).find((x) => x.perm.id === permId && x.idx === idx); if (!a) return false;
    const ab = a.ab; const cost = ab.cost || {};
    const specs = ab.multi ? targets.map(() => ab.multi.spec) : ab.targets || [];
    if (!ab.multi && targets.length !== specs.length) return false;
    for (let i = 0; i < specs.length; i++) {
      if (!this.validTargets(specs[i], pid, a.perm.id).some((r) => r.kind === targets[i]?.kind && r.id === targets[i]?.id)) return false;
    }
    const x = choices.x || 0;
    const mc = this.abCost(pid, a.perm, ab, x);
    if (mc.total && !this.canPay(pid, mc)) return false;
    const paid = this.payExtraCosts(pid, a.perm, cost, choices); if (!paid) return false;
    if (mc.total) this.pay(pid, mc);
    if (cost.tap) this.tap(a.perm);
    a.perm.used[idx] = (a.perm.used[idx] || 0) + 1;
    if (cost.sac) this.sacrifice(a.perm);
    this.stack.push({ id: this.nextId++, kind: 'ability', card: a.perm.card, source: a.perm, controller: pid, targets, specs, effect: ab, x, choices, paid });
    this.say(`${this.players[pid].name} activates ${a.perm.card.def.name}.`);
    this.passes = 0; this.setPriority(pid);
    return true;
  }
  hasResponse(pid) {
    const p = this.players[pid];
    this.waiting = this.waiting?.player === pid ? this.waiting : { kind: 'priority', player: pid };
    return p.hand.some((c) => this.canCast(pid, c)) || this.activatable(pid).length > 0;
  }

  // ---------- priority & stack ----------
  pass(pid) {
    if (this.waiting?.kind === 'choice' && this.waiting.player === pid) { this.choose(pid, this.autoAnswer()); return; } // bots that only know pass()
    if (this.waiting?.kind !== 'priority' || this.waiting.player !== pid) return;
    this.passes++;
    if (this.passes >= 2) {
      this.passes = 0;
      if (this.stack.length) { this.resolveTop(); if (!this.winner) this.whenIdle(() => { this.waiting = { kind: 'priority', player: this.active }; }); }
      else this.nextStep();
    } else this.waiting = { kind: 'priority', player: this.opp(pid) };
  }
  resolveTop() {
    const it = this.stack.pop();
    it.legal = it.targets.map((t, i) => this.targetLegal(t, it.specs?.[i], it));
    if (it.targets.length && it.legal.every((x) => !x)) {
      this.say(`${it.card.def.name} fizzles.`);
      if (it.kind === 'spell' && !it.copy) this.players[it.card.owner].gy.push(it.card);
      return;
    }
    this.emit({ type: 'resolve', id: it.card.id });
    if (it.kind === 'spell') {
      const types = it.card.def.types;
      if (types.includes('Instant') || types.includes('Sorcery')) { it.effect?.resolve?.(this, it); if (!it.copy) this.players[it.card.owner].gy.push(it.card); }
      else {
        const aura = auraSpecOf(it.card.def);
        const t = it.targets[0];
        this.say(`${it.card.def.name} enters the battlefield.`);
        this.newPerm(it.card, it.controller, { attachedTo: aura && t?.kind === 'perm' ? t.id : null, targetRef: aura ? t : null, x: it.x });
      }
    } else it.effect.resolve(this, it);
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
    this.say(`— Turn ${this.turn}: ${this.players[this.active].name} —`);
    this.enter('untap');
  }
  nextStep() {
    if (this.stack.length && !this.winner) { this.passes = 0; this.setPriority(this.active); return; } // triggers put on the stack by hooks
    for (const p of this.players) p.pool = emptyPool();
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
    const lim = this.ruleVals('untapLimit', a.id);
    const groups = [];
    for (const l of lim) {
      for (const [k, n] of Object.entries(l)) {
        const f = k === 'creatures' ? (p) => this.isCreature(p) : k === 'lands' ? (p) => this.isLand(p) : () => true;
        const g = cands.filter(f);
        if (g.length > n) groups.push({ g, n });
      }
    }
    const untap = (p) => { p.tapped = false; this.emit({ type: 'untap', id: p.id }); this.self(p, 'onUntap'); };
    if (!groups.length) { for (const p of cands) untap(p); return; }
    // limited untap: let the player choose which permanents untap
    const limited = new Set(groups.flatMap((x) => x.g));
    for (const p of cands) if (!limited.has(p)) untap(p);
    for (const { g, n } of groups) {
      this.pickPerms(a.id, g.filter((p) => p.tapped), { prompt: `Choose ${n} to untap`, min: Math.min(n, g.length), score: (p) => this.power(p) + this.toughness(p) }, (ps) => { for (const p of ps) untap(p); });
    }
  }
  enter(step) {
    this.step = step; this.passes = 0; this.waiting = null;
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
      if (!d.bf.some((p) => this.isCreature(p) && !p.tapped)) return this.nextStep();
      this.waiting = { kind: 'blockers', player: this.opp(this.active) }; return;
    }
    if (step === 'damage') { this.combatDamage(); return this.winner ? null : this.whenIdle(() => this.nextStep()); }
    if (step === 'end') {
      this.fire('onEndTurn', this.active);
      this.runDelayed('end', this.active);
      this.sba();
      return this.whenIdle(() => { if (!this.winner) this.waiting = { kind: 'priority', player: this.active }; });
    }
    this.waiting = { kind: 'priority', player: this.active };
  }
  cleanup() {
    for (const pl of this.players) for (const p of pl.bf) { p.damage = 0; p.mods = p.mods.filter((m) => m.until !== 'eot' && m.until !== 'endCombat'); p.attacking = false; p.regen = 0; p.used = {}; p.damagedBy = []; p.damageFrom = []; }
    for (const pl of this.players) { pl.mods = pl.mods.filter((m) => m.until !== 'eot'); pl.damageTaken = 0; pl.damageFrom = []; }
    this.ghosts = [];
    this.shields = this.shields.filter((s) => s.until !== 'eot');
    this.noCombatDamage = false; this.diedThisTurn = 0;
    this.combat = { attackers: [], blocks: {}, blocked: [], bands: [] };
    this.runDelayed('cleanup', this.active);
    this.fire('onCleanup', this.active);
    this.sba();
    if (this.winner) return;
    const a = this.players[this.active];
    if (a.hand.length > 7 && !this.rule('noHandLimit', a.id)) { this.step = 'cleanup'; this.waiting = { kind: 'discard', player: this.active, n: a.hand.length - 7 }; return; }
    this.whenIdle(() => this.startTurn());
  }
  discard(pid, card) {
    if (this.waiting?.kind !== 'discard' || this.waiting.player !== pid) return false;
    const p = this.players[pid]; if (!p.hand.includes(card)) return false;
    p.hand = p.hand.filter((c) => c !== card); p.gy.push(card); this.say(`${p.name} discards ${card.def.name}.`);
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
    this.combat.attackers = atk.map((p) => p.id);
    this.combat.bands = this.makeBands(atk, bands);
    for (const p of atk) { p.attacking = true; p.attackedTurn = this.turn; if (!this.kw(p).has('vigilance')) this.tap(p); }
    if (atk.length) this.say(`${a.name} attacks with ${atk.map((p) => p.card.def.name).join(', ')}.`);
    this.passes = 0;
    for (const p of atk) if (this.perm(p)) this.self(p, 'onAttack');
    if (atk.length) this.fire('onDeclareAttackers', atk);
    if (!this.combat.attackers.length) return this.whenIdle(() => this.nextStep()), true;
    this.whenIdle(() => { this.waiting = { kind: 'priority', player: this.active }; });
    return true;
  }
  // Attacking bands: creatures with banding (plus at most one creature without) attack as one band. `bands` = [[ids]] lets the
  // player choose; by default all attacking creatures with banding form one band.
  makeBands(atk, bands) {
    const ok = (grp) => grp.length > 1 && grp.some((p) => this.kw(p).has('banding')) && grp.filter((p) => !this.kw(p).has('banding')).length <= 1;
    if (bands) {
      const used = new Set(); const out = [];
      for (const ids of bands) { const grp = ids.map((id) => atk.find((p) => p.id === id)).filter((p) => p && !used.has(p.id)); if (ok(grp)) { grp.forEach((p) => used.add(p.id)); out.push(grp.map((p) => p.id)); } }
      return out;
    }
    const grp = atk.filter((p) => this.kw(p).has('banding'));
    return grp.length > 1 ? [grp.map((p) => p.id)] : [];
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
    for (const [k, land] of Object.entries(WALKS)) if (ak.has(k) && this.players[blocker.controller].bf.some((l) => this.isLand(l) && this.hasSubtype(l, land))) return false;
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
    // forced blocks (Lure)
    for (const aid of this.combat.attackers) {
      const att = this.perm(aid); if (!att || !this.rule('mustBlock', att)) continue;
      for (const b of d.bf) if (this.canBlock(b, att) && (count[b.id] || 0) < this.maxBlocks(b) && !(blocks[aid] || []).includes(b.id)) { count[b.id] = (count[b.id] || 0) + 1; (blocks[aid] ||= []).push(b.id); }
    }
    // Blaze of Glory style: must block every attacker it can
    for (const b of d.bf) if (this.kw(b).has('mustBlockAll')) for (const aid of this.combat.attackers) { const att = this.perm(aid); if (att && this.canBlock(b, att) && (count[b.id] || 0) < this.maxBlocks(b) && !(blocks[aid] || []).includes(b.id)) { count[b.id] = (count[b.id] || 0) + 1; (blocks[aid] ||= []).push(b.id); } }
    this.combat.blocks = blocks;
    this.combat.blocked = Object.keys(blocks).map(Number);
    for (const band of this.combat.bands || []) if (band.some((id) => this.combat.blocked.includes(id))) for (const id of band) if (!this.combat.blocked.includes(id)) this.combat.blocked.push(id);
    for (const [aid, bs] of Object.entries(blocks)) this.say(`${bs.map((b) => this.perm(b).card.def.name).join(' + ')} blocks ${this.perm(+aid).card.def.name}.`);
    this.passes = 0;
    for (const [aid, bs] of Object.entries(blocks)) {
      const att = this.perm(+aid);
      for (const b of bs) { const bp = this.perm(b); if (bp && att) this.self(bp, 'onBlock', att); }
      if (att) this.self(att, 'onBlocked', bs.map((b) => this.perm(b)).filter(Boolean));
    }
    this.whenIdle(() => { this.waiting = { kind: 'priority', player: this.active }; });
    return true;
  }
  combatDamage() {
    const fs = (p) => { const k = this.kw(p); return k.has('first strike') || k.has('double strike'); };
    const regular = (p) => { const k = this.kw(p); return !k.has('first strike') || k.has('double strike'); };
    const phase = (filter) => {
      const hits = [];
      const share = new Map(); // blocker -> attackers it blocks (power split)
      for (const [aid, bs] of Object.entries(this.combat.blocks)) for (const b of bs) { if (!share.has(b)) share.set(b, []); share.get(b).push(+aid); }
      for (const aid of this.combat.attackers) {
        const att = this.perm(aid); if (!att) continue;
        const raw = this.combat.blocks[aid] || [];
        const blockers = raw.map((b) => this.perm(b)).filter(Boolean);
        if (filter(att)) {
          let pw = Math.max(0, this.power(att));
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
              const lethal = Math.max(0, this.toughness(b) - b.damage);
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
            const members = band.map((id) => this.perm(id)).filter(Boolean);
            for (const [m, n] of this.assignSpread(part, members, b)) hits.push([b, { kind: 'perm', id: m.id }, n]);
          } else hits.push([b, { kind: 'perm', id: att.id }, part]);
        }
      }
      for (const [src, tgt, n] of hits) {
        if (n <= 0) continue;
        if (src.attacking) this.emit({ type: 'clash', id: src.id, tgt });
        const dealt = this.damage(src, tgt, n, { combat: true, noSba: true });
        if (tgt.kind === 'player' && dealt > 0) this.self(src, 'onDamagePlayer', tgt, dealt);
      }
      this.sba();
    };
    const anyFS = [...this.combat.attackers, ...Object.values(this.combat.blocks).flat()].some((id) => { const p = this.perm(id); return p && fs(p); });
    if (anyFS) { phase(fs); if (this.winner) return; }
    phase((p) => (anyFS ? regular(p) : true));
    this.endCombat();
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
