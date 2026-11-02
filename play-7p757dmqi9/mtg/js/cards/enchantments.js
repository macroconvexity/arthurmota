// Card module: enchantments and auras (all colours). See docs/CARD_MODULE_CONTRACT.md and docs/ENGINE_API.md.
// Auras are cast with one target derived from "Enchant ..." (engine), enter with perm.attachedTo, and use STATIC entries that
// affect only their host. A colour module that defines the same card overrides the entry here.
export const EFFECTS = {};
export const ABILITIES = {};
export const TRIGGERS = {};
export const STATIC = {};
export const IMPLEMENTED = [];

const pl = (id) => ({ kind: 'player', id });
const onHost = (g, src, t) => t.id === src.attachedTo;
const hostOf = (g, a) => g.host(a);
const done = (...names) => IMPLEMENTED.push(...names);
const landsOf = (g, pid, sub) => g.players[pid].bf.filter((l) => g.isLand(l) && (!sub || g.hasSubtype(l, sub)));
const manaAb = (c) => [{ cost: { tap: true }, mana: { colors: [c], amount: 1 } }];
const BASIC_COLOR = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };

// ---------- simple stat / keyword auras ----------
const statAura = (name, p, t, kw, extra = {}) => { STATIC[name] = { affects: onHost, power: p, toughness: t, ...(kw ? { kw } : {}), ...extra }; done(name); };
statAura('Holy Armor', 0, 2);
statAura('Holy Strength', 1, 2);
statAura('Unholy Strength', 2, 1);
statAura('Weakness', -2, -1);
statAura('Unstable Mutation', 3, 3);
statAura('Web', 0, 2, 'reach');
statAura('Lance', 0, 0, 'first strike');
statAura('Flight', 0, 0, 'flying');
statAura('Fear', 0, 0, 'fear');
statAura('Burrowing', 0, 0, 'mountainwalk');
statAura('Animate Wall', 0, 0, 'canAttack');
statAura('Instill Energy', 0, 0, 'canAttackSick');
for (const [c, name] of [['B', 'Black Ward'], ['U', 'Blue Ward'], ['G', 'Green Ward'], ['R', 'Red Ward'], ['W', 'White Ward']]) statAura(name, 0, 0, 'pro:' + c, { ignoreProtection: true });
statAura('Consecrate Land', 0, 0, 'indestructible', { cantBeEnchanted: (g, src, host, card) => host.id === src.attachedTo && card !== src.card });

// aura abilities on the host
const hostAbility = (name, mana, text, fn, extra = {}) => { ABILITIES[name] = [{ cost: { mana }, text, ai: 'utility', ...extra, resolve: (g, it) => { const h = hostOf(g, it.source); if (h) fn(g, h, it); } }]; };
hostAbility('Blessing', '{W}', '+1/+1', (g, h) => g.addMod(h, { p: 1, t: 1 }));
hostAbility('Holy Armor', '{W}', '+0/+1', (g, h) => g.addMod(h, { t: 1 }));
hostAbility('Firebreathing', '{R}', '+1/+0', (g, h) => g.addMod(h, { p: 1 }));
hostAbility('Regeneration', '{G}', 'Regenerate enchanted creature', (g, h) => g.regenerate(h));
hostAbility('Instill Energy', '', 'Untap enchanted creature', (g, h) => g.untapPerm(h), { timing: 'myTurn', limit: 1 });
ABILITIES['Instill Energy'][0].cost = {};
done('Blessing', 'Firebreathing', 'Regeneration');

// ---------- anthems / global statics ----------
STATIC['Crusade'] = { affects: (g, s, t) => g.isCreature(t) && g.colors(t).includes('W'), power: 1, toughness: 1 };
STATIC['Bad Moon'] = { affects: (g, s, t) => g.isCreature(t) && g.colors(t).includes('B'), power: 1, toughness: 1 };
STATIC['Castle'] = { affects: (g, s, t) => t.controller === s.controller && g.isCreature(t) && !t.tapped, toughness: 2 };
STATIC['Orcish Oriflamme'] = { affects: (g, s, t) => t.controller === s.controller && t.attacking, power: 1 };
STATIC['Living Lands'] = { affects: (g, s, t) => t.card.def.types.includes('Land') && t.card.def.subtypes.includes('Forest'), addTypes: ['Creature'], setPT: () => [1, 1] };
STATIC['Aspect of Wolf'] = {
  affects: onHost,
  power: (g, s) => Math.floor(landsOf(g, s.controller, 'Forest').length / 2),
  toughness: (g, s) => Math.ceil(landsOf(g, s.controller, 'Forest').length / 2),
};
STATIC['Gloom'] = {
  spellCostIncrease: (g, s, card) => ((card.def.colors || []).includes('W') ? 3 : 0),
  abilityCostIncrease: (g, s, perm) => (perm.card.def.types.includes('Enchantment') && g.colors(perm).includes('W') ? 3 : 0),
};
STATIC['Fastbond'] = { extraLandPlays: (g, s, pid) => (pid === s.controller ? Infinity : 0) };
STATIC['Smoke'] = { untapLimit: () => ({ creatures: 1 }) };
STATIC['Stasis'] = { skipUntap: () => true };
STATIC['Magnetic Mountain'] = { noUntap: (g, s, p) => g.isCreature(p) && g.colors(p).includes('U') };
STATIC['Lure'] = { mustBlock: (g, s, att) => att.id === s.attachedTo };
STATIC['Invisibility'] = { cantBlock: (g, s, blocker, att) => att.id === s.attachedTo && !g.hasSubtype(blocker, 'Wall') };
STATIC['Paralyze'] = { noUntap: (g, s, p) => p.id === s.attachedTo };
STATIC['Control Magic'] = { affects: onHost, control: (g, s) => s.controller };
STATIC['Steal Artifact'] = { affects: onHost, control: (g, s) => s.controller };
STATIC['Animate Artifact'] = {
  affects: (g, s, t) => t.id === s.attachedTo && !t.card.def.types.includes('Creature'),
  addTypes: ['Creature'], setPT: (g, s, t) => [t.card.def.manaValue || 0, t.card.def.manaValue || 0],
};
STATIC['Earthbind'] = { affects: (g, s, t) => t.id === s.attachedTo && !!s.removesFlying, removeKw: ['flying'] };
STATIC['Lich'] = {
  cantLose: (g, s, pid) => pid === s.controller,
  replaceLifeGain: (g, s, pid, n) => { if (pid !== s.controller) return false; g.say(`Lich: ${g.players[pid].name} draws ${n} instead.`); g.draw(pid, n); return true; },
};
STATIC['Conversion'] = { affects: (g, s, t) => t.card.def.types.includes('Land') && t.card.def.subtypes.includes('Mountain'), setSubtypes: ['Plains'], setAbilities: () => manaAb('W') };
STATIC['Evil Presence'] = { affects: onHost, setSubtypes: ['Swamp'], setAbilities: () => manaAb('B') };
STATIC['Phantasmal Terrain'] = [
  { affects: (g, s, t) => t.id === s.attachedTo && !!s.choice, setAbilities: (g, s) => manaAb(BASIC_COLOR[s.choice]) },
];
// setSubtypes cannot depend on the aura, so a second entry per basic type
for (const type of Object.keys(BASIC_COLOR)) STATIC['Phantasmal Terrain'].push({ affects: (g, s, t) => t.id === s.attachedTo && s.choice === type, setSubtypes: [type] });
done('Crusade', 'Bad Moon', 'Castle', 'Orcish Oriflamme', 'Living Lands', 'Aspect of Wolf', 'Gloom', 'Fastbond', 'Smoke', 'Stasis', 'Magnetic Mountain', 'Lure', 'Invisibility', 'Paralyze', 'Control Magic', 'Steal Artifact', 'Animate Artifact', 'Earthbind', 'Lich', 'Conversion', 'Evil Presence', 'Phantasmal Terrain');

// ---------- upkeep triggers ----------
const upkeepHostDamage = (name, n) => { TRIGGERS[name] = { ...(TRIGGERS[name] || {}), onUpkeep: (g, a, pid) => { const h = hostOf(g, a); if (h && h.controller === pid) g.damage(a, pl(pid), n); } }; };
upkeepHostDamage('Wanderlust', 1);
upkeepHostDamage('Cursed Land', 1);
upkeepHostDamage('Warp Artifact', 1);
upkeepHostDamage('Feedback', 1);
done('Wanderlust', 'Cursed Land', 'Warp Artifact', 'Feedback');

TRIGGERS['Unstable Mutation'] = { onUpkeep: (g, a, pid) => { const h = hostOf(g, a); if (h && h.controller === pid) g.addCounters(h, '-1/-1', 1); } };
done('Unstable Mutation');

const payOrSacrifice = (name, cost) => { TRIGGERS[name] = { ...(TRIGGERS[name] || {}), onUpkeep: (g, a, pid) => { if (pid !== a.controller) return; g.mayPay(pid, cost, { prompt: `Pay ${cost} to keep ${name}?`, source: a.card.id }, (paid) => { if (!paid) g.sacrifice(a); }); } }; };
payOrSacrifice('Stasis', '{U}');
payOrSacrifice('Conversion', '{W}{W}');

TRIGGERS['Karma'] = { onUpkeep: (g, a, pid) => { const n = landsOf(g, pid, 'Swamp').length; if (n) g.damage(a, pl(pid), n); } };
TRIGGERS['Farmstead'] = { onUpkeep: (g, a, pid) => { const h = hostOf(g, a); if (h && h.controller === pid) g.mayPay(pid, '{W}{W}', { prompt: 'Pay {W}{W} to gain 1 life?', source: a.card.id }, (paid) => { if (paid) g.gainLife(pid, 1); }); } };
TRIGGERS['Paralyze'] = {
  onEnter: (g, a) => { const h = hostOf(g, a); if (h) g.tap(h); },
  onUpkeep: (g, a, pid) => { const h = hostOf(g, a); if (h && h.controller === pid && h.tapped) g.mayPay(pid, '{4}', { prompt: `Pay {4} to untap ${h.card.def.name}?`, source: a.card.id, auto: true }, (paid) => { if (paid) g.untapPerm(h); }); },
};
TRIGGERS['Living Artifact'] = {
  onDamaged: (g, a, ref, n) => { if (ref.kind === 'player' && ref.id === a.controller) g.addCounters(a, 'vitality', n); },
  onUpkeep: (g, a, pid) => {
    if (pid !== a.controller || !(a.counters.vitality > 0)) return;
    g.ask(pid, { type: 'yesno', prompt: 'Remove a vitality counter to gain 1 life?', source: a.card.id, auto: true }, (yes) => { if (yes) { g.addCounters(a, 'vitality', -1); g.gainLife(pid, 1); } });
  },
};
TRIGGERS['Power Leak'] = {
  onUpkeep: (g, a, pid) => {
    const h = hostOf(g, a); if (!h || h.controller !== pid) return;
    let max = 0; while (max < 2 && g.canPay(pid, { generic: max + 1, W: 0, U: 0, B: 0, R: 0, G: 0, total: max + 1 })) max++;
    const dealt = (paid) => { g.damage(a, pl(pid), 2 - paid); };
    if (!max) return dealt(0);
    g.ask(pid, { type: 'number', prompt: 'Pay any amount of mana to prevent that much of 2 damage', min: 0, max, source: a.card.id, auto: max }, (k) => { if (k) g.pay(pid, { generic: k, W: 0, U: 0, B: 0, R: 0, G: 0, total: k }); dealt(k); });
  },
};
TRIGGERS['Magnetic Mountain'] = {
  onUpkeep: (g, a, pid) => {
    const cands = g.players[pid].bf.filter((p) => g.isCreature(p) && p.tapped && g.colors(p).includes('U'));
    let k = 0; while (k < cands.length && g.canPay(pid, { generic: 4 * (k + 1), W: 0, U: 0, B: 0, R: 0, G: 0, total: 4 * (k + 1) })) k++;
    if (!k) return;
    g.pickPerms(pid, cands, { prompt: 'Pay {4} each to untap tapped blue creatures', min: 0, max: k, score: (p) => g.power(p), source: a.card.id }, (ps) => {
      if (ps.length && g.pay(pid, { generic: 4 * ps.length, W: 0, U: 0, B: 0, R: 0, G: 0, total: 4 * ps.length })) for (const p of ps) g.untapPerm(p);
    });
  },
};
TRIGGERS['Power Surge'] = {
  onTurnStart: (g, a, pid) => { a.surge = landsOf(g, pid).filter((l) => !l.tapped).length; },
  onUpkeep: (g, a, pid) => { if (a.surge) g.damage(a, pl(pid), a.surge); },
};
TRIGGERS['Energy Flux'] = {
  onUpkeep: (g, a, pid) => {
    for (const art of g.players[pid].bf.filter((p) => g.hasType(p, 'Artifact'))) {
      g.mayPay(pid, '{2}', { prompt: `Pay {2} or sacrifice ${art.card.def.name}`, source: a.card.id, auto: true }, (paid) => { if (!paid) g.sacrifice(art); });
    }
  },
};
done('Karma', 'Farmstead', 'Living Artifact', 'Power Leak', 'Power Surge', 'Energy Flux');

// ---------- tap / mana triggers ----------
TRIGGERS['Mana Flare'] = { onManaTapped: (g, a, land, pid, colors) => { if (g.isLand(land)) g.addMana(pid, colors[0], 1); } };
TRIGGERS['Manabarbs'] = { onManaTapped: (g, a, land, pid) => { if (g.isLand(land)) g.damage(a, pl(pid), 1); } };
TRIGGERS['Wild Growth'] = { onManaTapped: (g, a, land, pid) => { if (land.id === a.attachedTo) g.addMana(pid, 'G', 1); } };
TRIGGERS['Lifetap'] = { onAnyTap: (g, a, perm) => { if (perm.controller !== a.controller && g.isLand(perm) && g.hasSubtype(perm, 'Forest')) g.gainLife(a.controller, 1); } };
TRIGGERS['Psychic Venom'] = { onAnyTap: (g, a, perm) => { if (perm.id === a.attachedTo) g.damage(a, pl(perm.controller), 2); } };
TRIGGERS['Kudzu'] = {
  onAnyTap: (g, a, land) => {
    if (land.id !== a.attachedTo) return;
    const others = g.allPerms().filter((l) => g.isLand(l) && l !== land);
    const kill = () => g.destroy(land);
    if (!others.length) return kill();
    g.pickPerms(land.controller, others, { prompt: 'Attach Kudzu to a land of your choice', min: 0, max: 1, score: (l) => (l.controller === land.controller ? -1 : 1), source: a.card.id }, (ps) => { if (ps[0]) g.attach(a, ps[0]); kill(); });
  },
};
TRIGGERS['Fastbond'] = { onAnyEnter: (g, a, e) => { if (e.played && e.controller === a.controller && g.players[a.controller].landsPlayed > 1) g.damage(a, pl(a.controller), 1); } };
done('Mana Flare', 'Manabarbs', 'Wild Growth', 'Lifetap', 'Psychic Venom', 'Kudzu', 'Fastbond');

// ---------- entering / leaving ----------
TRIGGERS['Earthbind'] = { onEnter: (g, a) => { const h = hostOf(g, a); if (h && g.kw(h).has('flying')) { a.removesFlying = true; g.damage(a, { kind: 'perm', id: h.id }, 2); } } };
TRIGGERS['Creature Bond'] = { onHostLeave: (g, a, host, zone) => { if (zone === 'gy' && g.isCreature(host)) g.damage(a, pl(host.controller), Math.max(0, g.toughness(host))); } };
done('Creature Bond', 'Copy Artifact');
TRIGGERS['Phantasmal Terrain'] = {
  onEnter: (g, a) => {
    const options = Object.keys(BASIC_COLOR).map((t) => ({ value: t, label: t, score: 0 }));
    g.ask(a.controller, { type: 'pick', prompt: 'Choose a basic land type', options, min: 1, max: 1, source: a.card.id, auto: ['Island'] }, ([t]) => { a.choice = t; });
  },
};
TRIGGERS['Copy Artifact'] = {
  onEnter: (g, a) => {
    const arts = g.allPerms().filter((p) => p !== a && g.hasType(p, 'Artifact'));
    if (!arts.length) return;
    g.pickPerms(a.controller, arts, { prompt: 'Enter as a copy of an artifact?', min: 0, max: 1, score: (p) => p.card.def.manaValue || 0, source: a.card.id }, ([p]) => { if (p) g.becomeCopy(a, p.card.def, { addTypes: ['Enchantment'] }); });
  },
};
TRIGGERS['Animate Dead'] = {
  onEnter: (g, a) => {
    const card = a.targetRef && g.findCard(a.targetRef.id);
    if (!card || !g.players.some((p) => p.gy.includes(card))) { g.leave(a, 'gy'); return; }
    const c = g.putOntoBattlefield(card, a.controller);
    a.attachedTo = c.id; g.emit({ type: 'attach', id: a.id, host: c.id });
  },
  onLeave: (g, a) => { const h = a.attachedTo != null ? g.perm(a.attachedTo) : null; if (h) g.sacrifice(h); },
};
STATIC['Animate Dead'] = { affects: onHost, power: -1 };
done('Animate Dead');
TRIGGERS['Lich'] = {
  onEnter: (g, a) => { const life = g.players[a.controller].life; if (life > 0) g.loseLife(a.controller, life); },
  onDamaged: (g, a, ref, n) => {
    if (ref.kind !== 'player' || ref.id !== a.controller) return;
    const pid = a.controller;
    const cands = g.players[pid].bf.filter((p) => !p.card.token);
    const k = Math.min(n, cands.length);
    const after = () => { if (cands.length < n) g.loseGame(pid, 'lich'); };
    if (!k) return after();
    g.pickPerms(pid, cands, { prompt: `Sacrifice ${k} nontoken permanent${k > 1 ? 's' : ''}`, min: k, score: (p) => (p === a ? -100 : 10 - (p.card.def.manaValue || 0)), source: a.card.id }, (ps) => { for (const p of ps) g.sacrifice(p); after(); });
  },
  onLeave: (g, a, zone) => { if (zone === 'gy') g.loseGame(a.controller, 'lich'); },
};
TRIGGERS['Island Sanctuary'] = {
  onDrawStep: (g, a, pid) => {
    if (pid !== a.controller) return;
    g.ask(pid, { type: 'yesno', prompt: 'Skip your draw to be safe from non-flying attackers until your next turn?', source: a.card.id, auto: false }, (yes) => {
      if (yes) { g.skipStep(pid, 'draw'); g.addPlayerMod(pid, { sanctuary: true, until: 'myNextTurn', owner: pid }); }
    });
  },
};
STATIC['Island Sanctuary'] = {
  cantBeAttacked: (g, s, att, defPid) => s.controller === defPid && g.players[defPid].mods.some((m) => m.sanctuary) && !g.kw(att).has('flying') && !g.kw(att).has('islandwalk'),
};
done('Island Sanctuary');
TRIGGERS['Pestilence'] = { onEndTurn: (g, a) => { if (!g.allPerms().some((p) => g.isCreature(p))) g.sacrifice(a); } };
ABILITIES['Pestilence'] = [{
  cost: { mana: '{B}' }, ai: 'sweeper', text: '1 damage to each creature and each player',
  resolve: (g, it) => { for (const p of g.allPerms().filter((x) => g.isCreature(x))) g.damage(it.source, { kind: 'perm', id: p.id }, 1, { noSba: true }); for (const pl2 of g.players) g.damage(it.source, pl(pl2.id), 1, { noSba: true }); g.sba(); },
}];
done('Pestilence');

// ---------- counterspell enchantments ----------
ABILITIES['Deathgrip'] = [{ cost: { mana: '{B}{B}' }, targets: ['greenSpell'], ai: 'counter', text: 'Counter target green spell.', resolve: (g, it) => g.counterSpell(it.targets[0]) }];
ABILITIES['Lifeforce'] = [{ cost: { mana: '{G}{G}' }, targets: ['blackSpell'], ai: 'counter', text: 'Counter target black spell.', resolve: (g, it) => g.counterSpell(it.targets[0]) }];
done('Deathgrip', 'Lifeforce');

// ---------- Circle of Protection ----------
for (const [name, c] of [['Blue', 'U'], ['Green', 'G'], ['Red', 'R'], ['White', 'W'], ['Black', 'B']]) {
  ABILITIES[`Circle of Protection: ${name}`] = [{
    cost: { mana: '{1}' }, ai: 'heal', text: `Prevent the next damage from a ${name.toLowerCase()} source of your choice.`,
    resolve: (g, it) => g.chooseSource(it.controller, (s) => g.colors(s).includes(c), { prompt: `Choose a ${name.toLowerCase()} source`, source: it.card.id }, (id) => { if (id != null) g.preventDamage(pl(it.controller), Infinity, { sourceId: id, once: true }); }),
  }];
  done(`Circle of Protection: ${name}`);
}

// ---------- Raging River ----------
TRIGGERS['Raging River'] = {
  onDeclareAttackers: (g, a, atks) => {
    const mine = atks.filter((p) => p.controller === a.controller);
    if (!mine.length) return;
    const def = 1 - a.controller;
    const cands = g.players[def].bf.filter((p) => g.isCreature(p) && !g.kw(p).has('flying'));
    a.river = { left: [], assign: {} };
    const assignAll = (i) => {
      if (i >= mine.length) return;
      const att = mine[i];
      const auto = (gg) => { const l = a.river.left.length, r = cands.length - l; return [l <= r ? 'left' : 'right']; };
      g.ask(a.controller, { type: 'pick', prompt: `Left or right pile for ${att.card.def.name}`, options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }], min: 1, max: 1, source: a.card.id, auto }, ([side]) => { a.river.assign[att.id] = side; assignAll(i + 1); });
    };
    if (!cands.length) return assignAll(0);
    g.pickPerms(def, cands, { prompt: 'Choose the creatures for the LEFT pile (the rest are the right pile)', min: 0, max: cands.length, score: (p) => (cands.indexOf(p) % 2 ? 1 : 0), source: a.card.id, auto: cands.filter((_, i) => i % 2).map((p) => p.id) }, (ps) => { a.river.left = ps.map((p) => p.id); assignAll(0); });
  },
  onEndCombat: (g, a) => { a.river = null; },
};
STATIC['Raging River'] = {
  cantBlock: (g, s, blocker, att) => {
    const r = s.river; const side = r?.assign[att.id];
    if (!side || g.kw(blocker).has('flying')) return false;
    return (side === 'left') !== r.left.includes(blocker.id);
  },
};
done('Raging River');

STATIC["Titania's Song"] = {
  lingers: true, loseAbilities: true, // the effect continues until end of turn after it leaves
  affects: (g, s, t) => t.card.def.types.includes('Artifact') && !t.card.def.types.includes('Creature'),
  addTypes: ['Creature'], setPT: (g, s, t) => [t.card.def.manaValue || 0, t.card.def.manaValue || 0],
};
done("Titania's Song");

