// Card module: white. See docs/CARD_MODULE_CONTRACT.md and docs/ENGINE_API.md.
// White enchantments/auras (Crusade, Wards, Circles of Protection, ...) live in enchantments.js.
export const EFFECTS = {};      // instants / sorceries (and spell-like effects)
export const ABILITIES = {};    // activated abilities (mana and non-mana)
export const TRIGGERS = {};     // triggered abilities keyed by event
export const STATIC = {};       // continuous effects while on the battlefield
export const IMPLEMENTED = [];  // keyword-only white cards (Savannah Lions, Serra Angel, ...) already pass the generic check

const done = (...n) => IMPLEMENTED.push(...n);
const pl = (id) => ({ kind: 'player', id });
const pr = (p) => ({ kind: 'perm', id: p.id });
const lands = (g, pid) => g.players[pid].bf.filter((p) => g.isLand(p));
const creatures = (g, pid) => g.players[pid].bf.filter((p) => g.isCreature(p));

// ---------- sorceries ----------
EFFECTS['Armageddon'] = {
  targets: [], ai: 'sweeper', text: 'Destroy all lands.',
  resolve(g) { for (const p of g.players) for (const l of lands(g, p.id)) g.destroy(l); },
};

// Balance: counts are fixed first, then each player chooses what to sacrifice / discard (lands, then cards, then creatures).
EFFECTS['Balance'] = {
  targets: [], ai: 'sweeper', text: 'Players equalise lands, hand size and creatures to the lowest count.',
  resolve(g, it) {
    const min = (f) => Math.min(...g.players.map((p) => f(p.id)));
    const nL = min((i) => lands(g, i).length), nH = min((i) => g.players[i].hand.length), nC = min((i) => creatures(g, i).length);
    const order = [it.controller, 1 - it.controller];
    const sacrifice = (list, keep, pid, value, label, next) => {
      const n = list.length - keep; if (n <= 0) return next();
      g.pickPerms(pid, list, { prompt: `Sacrifice ${n} ${label}`, min: n, score: (p) => -value(p), source: it.card.id }, (ps) => { for (const p of ps) g.sacrifice(p); next(); });
    };
    const discard = (pid, next) => {
      const h = g.players[pid].hand; const n = h.length - nH; if (n <= 0) return next();
      g.pickCards(pid, h, { prompt: `Discard ${n} card${n > 1 ? 's' : ''}`, min: n, score: (c) => -(c.def.manaValue || 0), source: it.card.id }, (cs) => {
        const p = g.players[pid]; for (const c of cs) { p.hand = p.hand.filter((x) => x !== c); p.gy.push(c); g.say(`${p.name} discards ${c.def.name}.`); } next();
      });
    };
    const val = (p) => g.power(p) + g.toughness(p) + (p.card.def.manaValue || 0) / 100;
    const chain = [];
    for (const pid of order) chain.push((nx) => sacrifice(lands(g, pid), nL, pid, (p) => (p.tapped ? 0 : 1), 'lands', nx));
    for (const pid of order) chain.push((nx) => discard(pid, nx));
    for (const pid of order) chain.push((nx) => sacrifice(creatures(g, pid), nC, pid, val, 'creatures', nx));
    const run = (i) => { if (i < chain.length) chain[i](() => run(i + 1)); else g.sba(); };
    run(0);
  },
};
EFFECTS['Resurrection'] = {
  targets: ['myGraveyardCreature'], ai: 'utility', text: 'Return target creature card from your graveyard to the battlefield.',
  resolve(g, it) { const c = g.findCard(it.targets[0].id); if (c && g.players[c.owner].gy.includes(c)) g.reanimate(it.controller, c); },
};

// ---------- instants ----------
// Overrides of base entries in cards.js: Swords gives life to the creature's controller; Wrath says "can't be regenerated".
EFFECTS['Swords to Plowshares'] = {
  targets: ['creature'], ai: 'removal', text: 'Exile target creature. Its controller gains life equal to its power.',
  resolve(g, it) { const p = g.perm(it.targets[0]); if (!p) return; const n = g.power(p), c = p.controller; g.exile(p); g.gainLife(c, n); },
};
EFFECTS['Wrath of God'] = {
  targets: [], ai: 'sweeper', text: "Destroy all creatures. They can't be regenerated.",
  resolve(g) { g.emit({ type: 'sweep' }); for (const p of g.players) for (const c of [...p.bf]) if (g.isCreature(c)) g.destroy(c, { noRegen: true }); },
};
EFFECTS['Disenchant'] = {
  targets: ['artifactOrEnchantment'], ai: 'utility', text: 'Destroy target artifact or enchantment.',
  resolve: (g, it) => g.destroy(g.perm(it.targets[0])),
};
EFFECTS['Healing Salve'] = {
  targets: [], ai: 'heal', text: 'Choose one: target player gains 3 life; or prevent the next 3 damage to any target this turn.',
  modes: [
    { text: 'Target player gains 3 life.', targets: ['player'] },
    { text: 'Prevent the next 3 damage that would be dealt to any target this turn.', targets: ['any'] },
  ],
  resolve(g, it) { if (it.mode === 1) g.preventDamage(it.targets[0], 3); else g.gainLife(it.targets[0].id, 3); },
};
EFFECTS['Death Ward'] = {
  targets: ['creature'], ai: 'utility', text: 'Regenerate target creature.',
  resolve: (g, it) => g.regenerate(g.perm(it.targets[0])),
};
EFFECTS['Righteousness'] = {
  targets: ['blockingCreature'], ai: 'pump', text: 'Target blocking creature gets +7/+7 until end of turn.',
  resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { p: 7, t: 7 }),
};
EFFECTS['Purelace'] = {
  targets: [], ai: 'utility', text: 'Target spell or permanent becomes white.',
  modes: [{ text: 'Target spell becomes white.', targets: ['spell'] }, { text: 'Target permanent becomes white.', targets: ['permanent'] }],
  resolve(g, it) {
    const t = it.targets[0];
    if (t.kind === 'spell') { const s = g.stack.find((x) => x.id === t.id); if (s) s.colorOverride = ['W']; }
    else { const p = g.perm(t); if (p) p.colorOverride = ['W']; }
  },
};

// ---------- damage-prevention instants (shield callbacks report the amount prevented) ----------
EFFECTS['Reverse Damage'] = {
  targets: [], ai: 'heal', text: 'Prevent the next damage from a source of your choice this turn; gain that much life.',
  resolve(g, it) {
    g.chooseSource(it.controller, () => true, { prompt: 'Choose a source', source: it.card.id }, (id) => {
      if (id == null) return;
      g.preventDamage(pl(it.controller), Infinity, { sourceId: id, once: true, onPrevent: (gg, n) => gg.gainLife(it.controller, n) });
    });
  },
};
EFFECTS['Eye for an Eye'] = {
  targets: [], ai: 'heal', text: 'The next time a source of your choice would deal damage to you this turn, it deals that much to you and Eye for an Eye deals that much to its controller.',
  resolve(g, it) {
    g.chooseSource(it.controller, () => true, { prompt: 'Choose a source', source: it.card.id }, (id) => {
      if (id == null) return;
      g.preventDamage(pl(it.controller), Infinity, {
        sourceId: id, once: true,
        onPrevent(gg, n, src) {
          // replacement: the source still deals the damage to you, and this spell deals it to the source's controller
          gg.damage(src, pl(it.controller), n, { noPrevent: true, noSba: true });
          if (src?.controller != null) gg.damage(it, pl(src.controller), n, { noPrevent: true, noSba: true });
          gg.sba();
        },
      });
    });
  },
};
EFFECTS['Reverse Polarity'] = {
  targets: [], ai: 'heal', text: 'You gain X life, where X is twice the damage dealt to you so far this turn by artifacts.',
  resolve(g, it) {
    const x = g.players[it.controller].damageFrom.filter((r) => (r.types || []).includes('Artifact')).reduce((a, r) => a + r.n, 0);
    if (x > 0) g.gainLife(it.controller, 2 * x);
  },
};
EFFECTS['Blaze of Glory'] = {
  targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && p.controller !== g.active }], ai: 'utility',
  text: 'Target creature defending player controls can block any number of creatures this turn. It blocks each attacking creature this turn if able.',
  castWhen: (g) => (g.step === 'attackers' || g.step === 'blockers') && g.combat.attackers.length > 0 && g.step !== 'damage' && !g.combat.blocked?.length && !Object.keys(g.combat.blocks || {}).length,
  resolve(g, it) { const p = g.perm(it.targets[0]); if (p) g.addMod(p, { kw: ['blockAny', 'mustBlockAll'] }); },
};

// ---------- creatures ----------
ABILITIES['Samite Healer'] = [{
  cost: { tap: true }, targets: ['any'], ai: 'heal', text: 'Prevent the next 1 damage that would be dealt to any target this turn.',
  resolve: (g, it) => g.preventDamage(it.targets[0], 1),
}];
ABILITIES['Northern Paladin'] = [{
  cost: { tap: true, mana: '{W}{W}' }, targets: ['blackPermanent'], ai: 'removal', text: 'Destroy target black permanent.',
  resolve: (g, it) => g.destroy(g.perm(it.targets[0])),
}];
ABILITIES['Personal Incarnation'] = [{
  cost: {}, ai: 'utility', text: 'The next 1 damage that would be dealt to this creature this turn is dealt to its owner instead.',
  condition: (g, perm) => perm.controller === perm.card.owner, // only the owner may activate
  resolve: (g, it) => g.preventDamage(pr(it.source), 1, { redirect: pl(it.source.card.owner), once: true }),
}];
TRIGGERS['Personal Incarnation'] = {
  onDie(g, perm) { const o = perm.card.owner; g.loseLife(o, Math.ceil(g.players[o].life / 2)); },
};
// Unblocked attackers' combat damage to the controller goes to the untapped Bodyguard instead.
STATIC['Veteran Bodyguard'] = {
  preventDamage(g, src, d) {
    if (src.tapped || !d.combat || d.target.kind !== 'player' || d.target.id !== src.controller || !d.src) return d.n;
    const att = d.src.card && g.perm(d.src.card.id);
    if (!att || !g.combat.attackers.includes(att.id) || (g.combat.blocks[att.id] || []).length) return d.n;
    g.damage(d.src, pr(src), d.n, { combat: true, noSba: true });
    return 0;
  },
};

done('Armageddon', 'Balance', 'Resurrection', 'Swords to Plowshares', 'Wrath of God', 'Disenchant', 'Healing Salve', 'Death Ward',
  'Righteousness', 'Purelace', 'Reverse Damage', 'Eye for an Eye', 'Reverse Polarity', 'Blaze of Glory', 'Samite Healer', 'Northern Paladin', 'Personal Incarnation', 'Veteran Bodyguard');

// =====================================================================================================
// Legends (LEG) mono-white
// =====================================================================================================
const guarded = (f) => { let busy = false; return (...a) => { if (busy) return false; busy = true; try { return f(...a); } finally { busy = false; } }; };
const isBlocking = (g, p) => Object.values(g.combat.blocks || {}).some((b) => b.includes(p.id));
const BASIC_LANDS = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']);

// Akron Legionnaire: only itself (by name) and artifact creatures may attack for its controller.
STATIC['Akron Legionnaire'] = { cantAttack: (g, src, att) => att.controller === src.controller && att.card.def.name !== 'Akron Legionnaire' && !g.hasType(att, 'Artifact') };

EFFECTS['Alabaster Potion'] = {
  targets: [], x: true, ai: 'heal', text: 'Choose one: target player gains X life; or prevent the next X damage to any target this turn.',
  modes: [{ text: 'Target player gains X life.', targets: ['player'] }, { text: 'Prevent the next X damage that would be dealt to any target this turn.', targets: ['any'] }],
  resolve(g, it) { if (it.mode === 1) { if (it.x > 0) g.preventDamage(it.targets[0], it.x); } else g.gainLife(it.targets[0].id, it.x); },
};

STATIC['Amrou Kithkin'] = { cantBlock: (g, src, blocker, att) => att === src && g.power(blocker) >= 3 };

STATIC['Angelic Voices'] = (() => {
  const noOther = guarded((g, src) => !g.players[src.controller].bf.some((p) => g.isCreature(p) && !g.hasType(p, 'Artifact') && !g.colors(p).includes('W')));
  const mine = guarded((g, src, t) => t.controller === src.controller && g.isCreature(t));
  return { affects: (g, src, t) => mine(g, src, t) && noOther(g, src), power: 1, toughness: 1 };
})();

EFFECTS['Cleanse'] = {
  targets: [], ai: 'sweeper', text: 'Destroy all black creatures.',
  resolve(g) { for (const pl of g.players) for (const p of [...pl.bf]) if (g.isCreature(p) && g.colors(p).includes('B')) g.destroy(p); },
};

ABILITIES["D'Avenant Archer"] = [{
  cost: { tap: true }, ai: 'removal', text: '{T}: 1 damage to target attacking or blocking creature.',
  targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && (g.combat.attackers.includes(p.id) || isBlocking(g, p)) }],
  resolve: (g, it) => g.damage(it.source, it.targets[0], 1),
}];

EFFECTS['Divine Offering'] = {
  targets: ['artifact'], ai: 'removal', text: 'Destroy target artifact. You gain life equal to its mana value.',
  resolve(g, it) { const p = g.perm(it.targets[0]); if (!p) return; const mv = p.card.def.manaValue || 0; g.destroy(p); if (mv > 0) g.gainLife(it.controller, mv); },
};

STATIC['Divine Transformation'] = { affects: (g, src, t) => t.id === src.attachedTo, power: 3, toughness: 3 };

// Elder Land Wurm: loses defender (for good) once it blocks.
TRIGGERS['Elder Land Wurm'] = { onBlock: (g, perm) => { perm.lostDefender = true; } };
STATIC['Elder Land Wurm'] = { affects: (g, src, t) => t === src && !!src.lostDefender, removeKw: ['defender'] };

// Enchanted Being: combat damage from creatures that have an Aura attached is prevented.
STATIC['Enchanted Being'] = {
  preventDamage(g, src, d) {
    if (!d.combat || !d.target || d.target.kind !== 'perm' || d.target.id !== src.id || !d.src?.card) return d.n;
    const att = g.perm(d.src.card.id);
    return att && g.allPerms().some((a) => a.attachedTo === att.id && g.hasSubtype(a, 'Aura')) ? 0 : d.n;
  },
};

STATIC['Fortified Area'] = {
  affects: guarded((g, src, t) => t.controller === src.controller && g.hasSubtype(t, 'Wall')), power: 1, kw: 'banding',
};

EFFECTS['Great Defender'] = {
  targets: ['creature'], ai: 'pump', text: 'Target creature gets +0/+X until end of turn, where X is its mana value.',
  resolve(g, it) { const p = g.perm(it.targets[0]); if (p) g.addMod(p, { t: p.card.def.manaValue || 0 }); },
};

ABILITIES['Greater Realm of Preservation'] = [{
  cost: { mana: '{1}{W}' }, ai: 'heal', text: 'The next time a black or red source of your choice would deal damage to you this turn, prevent that damage.',
  resolve: (g, it) => g.chooseSource(it.controller, (s) => g.colors(s).some((c) => c === 'B' || c === 'R'), { prompt: 'Choose a black or red source', source: it.card.id },
    (id) => { if (id != null) g.preventDamage(pl(it.controller), Infinity, { sourceId: id, once: true }); }),
}];

EFFECTS["Heaven's Gate"] = {
  targets: [], multi: { spec: 'creature', min: 1, max: Infinity }, ai: 'utility', text: 'One or more target creatures become white until end of turn.',
  resolve(g, it) {
    for (const t of it.targets) {
      const p = g.perm(t); if (!p) continue;
      const prior = p.colorOverride; p.colorOverride = ['W'];
      g.delay('cleanup', () => { if (prior) p.colorOverride = prior; else delete p.colorOverride; });
    }
  },
};

EFFECTS['Holy Day'] = { targets: [], ai: 'heal', text: 'Prevent all combat damage that would be dealt this turn.', resolve: (g) => g.preventCombatDamage() };
EFFECTS['Indestructible Aura'] = {
  targets: ['creature'], ai: 'utility', text: 'Prevent all damage that would be dealt to target creature this turn.',
  resolve: (g, it) => g.preventDamage(it.targets[0], Infinity),
};

STATIC['Ivory Guardians'] = {
  affects: (g, src, t) => t.card.def.name === 'Ivory Guardians' && g.players[1 - t.controller].bf.some((p) => !p.card.token && g.colors(p).includes('R')),
  power: 1, toughness: 1,
};

// Land Tax: search is optional ("may"), up to three basic lands.
TRIGGERS['Land Tax'] = {
  onUpkeep(g, perm, pid) {
    if (pid !== perm.controller) return;
    const n = (i) => g.players[i].bf.filter((p) => g.isLand(p)).length;
    if (n(1 - pid) <= n(pid)) return;
    g.search(pid, (c) => BASIC_LANDS.has(c.def.name), { count: 3, to: 'hand', optional: true, prompt: 'Land Tax: search for up to three basic lands' });
  },
};

TRIGGERS['Lifeblood'] = {
  onAnyTap(g, perm, tapped) { if (tapped.controller !== perm.controller && g.hasSubtype(tapped, 'Mountain')) g.gainLife(perm.controller, 1); },
};

STATIC['Moat'] = { cantAttack: (g, src, att) => !g.kw(att).has('flying') };

TRIGGERS['Osai Vultures'] = { onEndTurn(g, perm) { if (g.diedThisTurn > 0) g.addCounters(perm, 'carrion', 1); } };
ABILITIES['Osai Vultures'] = [{
  cost: { counter: { type: 'carrion', n: 2 } }, ai: 'pump', text: 'Remove two carrion counters: +1/+1 until end of turn.',
  resolve: (g, it) => g.addMod(it.source, { p: 1, t: 1 }),
}];

TRIGGERS['Presence of the Master'] = {
  onSpellCast(g, perm, item) { if (item.kind === 'spell' && item.card.def.types.includes('Enchantment')) g.counterSpell({ id: item.id }); },
};

// Remove Enchantments: first return everything that qualifies to hand, then destroy the remaining ones.
EFFECTS['Remove Enchantments'] = {
  targets: [], ai: 'utility', text: 'Return your own enchantments and Auras to hand, then destroy all other enchantments you control and Auras attached to your permanents or to attackers.',
  resolve(g, it) {
    const me = it.controller;
    const isAura = (p) => p.attachedTo != null && g.hasSubtype(p, 'Aura');
    const hostOf = (a) => g.perm(a.attachedTo);
    const onMine = (a) => { const h = hostOf(a); return h && h.controller === me; };
    const onTheirAttacker = (a) => { const h = hostOf(a); return h && h.controller !== me && g.isCreature(h) && g.combat.attackers.includes(h.id); };
    const ench = () => g.allPerms().filter((p) => g.hasType(p, 'Enchantment'));
    const back = ench().filter((p) => (p.controller === me && p.card.owner === me) || (isAura(p) && p.card.owner === me && (onMine(p) || onTheirAttacker(p))));
    for (const p of back) g.bounce(p);
    const kill = ench().filter((p) => p.controller === me || (isAura(p) && (onMine(p) || onTheirAttacker(p))));
    for (const p of kill) if (g.perm(p.id)) g.destroy(p);
  },
};

STATIC['Seeker'] = { cantBlock: (g, src, blocker, att) => att.id === src.attachedTo && !(g.hasType(blocker, 'Artifact') || g.colors(blocker).includes('W')) };

EFFECTS['Shield Wall'] = {
  targets: [], ai: 'pump', text: 'Creatures you control get +0/+2 until end of turn.',
  resolve(g, it) { for (const p of g.players[it.controller].bf.filter((x) => g.isCreature(x))) g.addMod(p, { t: 2 }); },
};

TRIGGERS['Spirit Link'] = {
  onDamaged(g, perm, ref, n, src) { if (src?.card && src.card.id === perm.attachedTo && n > 0) g.gainLife(perm.controller, n); },
};

TRIGGERS['Spiritual Sanctuary'] = {
  onUpkeep(g, perm, pid) { if (g.players[pid].bf.some((p) => g.isLand(p) && g.hasSubtype(p, 'Plains'))) g.gainLife(pid, 1); },
};

EFFECTS['Visions'] = {
  targets: ['player'], ai: 'utility', text: "Look at the top five cards of target player's library. You may then have that player shuffle that library.",
  resolve(g, it) {
    const t = it.targets[0].id; const lib = g.players[t].library;
    const top = lib.slice(-5).reverse().map((c) => c.def.name);
    g.ask(it.controller, { type: 'yesno', prompt: `Top ${top.length} of ${g.players[t].name}'s library: ${top.join(', ') || 'empty'}. Shuffle it?`, source: it.card.id }, (yes) => { if (yes) g.shuffleLibrary(t); });
  },
};

TRIGGERS['Wall of Caltrops'] = {
  onBlock(g, perm, att) {
    const bs = (g.combat.blocks[att.id] || []).map((b) => g.perm(b)).filter(Boolean);
    if (bs.some((b) => b !== perm && g.hasSubtype(b, 'Wall')) && bs.every((b) => g.hasSubtype(b, 'Wall'))) g.addMod(perm, { kw: 'banding' });
  },
};

done('Akron Legionnaire', 'Alabaster Potion', 'Amrou Kithkin', 'Angelic Voices', 'Cleanse', "D'Avenant Archer", 'Divine Offering', 'Divine Transformation',
  'Elder Land Wurm', 'Enchanted Being', 'Fortified Area', 'Great Defender', 'Greater Realm of Preservation', "Heaven's Gate", 'Holy Day', 'Indestructible Aura',
  'Ivory Guardians', 'Land Tax', 'Lifeblood', 'Moat', 'Osai Vultures', 'Presence of the Master', 'Remove Enchantments', 'Seeker', 'Shield Wall', 'Spirit Link',
  'Spiritual Sanctuary', 'Visions', 'Wall of Caltrops');

// ---------- Legends, second batch (engine hooks from ENGINE_API section 13) ----------
TRIGGERS['Clergy of the Holy Nimbus'] = { autoRegen: () => true };
ABILITIES['Clergy of the Holy Nimbus'] = [{
  cost: { mana: '{1}' }, anyPlayer: true, ai: 'utility', text: "This creature can't be regenerated this turn. Only your opponents may activate this ability.",
  condition: (g, perm, pid) => pid !== perm.controller,
  resolve: (g, it) => g.addMod(it.source, { noRegen: true }),
}];

TRIGGERS['Divine Intervention'] = {
  onEnter: (g, perm) => g.addCounters(perm, 'intervention', 2),
  onUpkeep(g, perm, pid) {
    if (pid !== perm.controller || !(perm.counters.intervention > 0)) return;
    g.addCounters(perm, 'intervention', -1);
    if (!perm.counters.intervention) g.drawGame();
  },
};

EFFECTS['Glyph of Life'] = {
  targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && g.hasSubtype(p, 'Wall') }], ai: 'heal',
  text: 'Choose target Wall creature. Whenever that creature is dealt damage by an attacking creature this turn, you gain that much life.',
  resolve(g, it) {
    const p = g.perm(it.targets[0]); if (!p) return;
    g.addMod(p, { onDealtDamage(gg, perm, src, n) { const a = src?.card && gg.perm(src.card.id); if (a && gg.combat.attackers.includes(a.id) && n > 0) gg.gainLife(it.controller, n); } });
  },
};

STATIC['Great Wall'] = { ignoreLandwalk: (g, src, attacker, blocker, land) => land === 'Plains' };

TRIGGERS['Infinite Authority'] = (() => {
  const strike = (g, aura, host, other) => {
    if (!other || g.toughness(other) > 3) return;
    g.delay('endCombat', () => {
      if (!g.perm(other.id) || !g.destroy(other)) return;
      g.delay('end', () => { if (g.perm(host.id)) g.addCounters(host, '+1/+1', 1); });
    });
  };
  return {
    onHostBlock: (g, aura, host, attacker) => strike(g, aura, host, attacker),
    onHostBlocked: (g, aura, host, blockers) => { for (const b of blockers) strike(g, aura, host, b); },
  };
})();

STATIC['Kismet'] = { entersTapped: (g, src, perm) => perm.controller !== src.controller && perm.card.def.types.some((t) => ['Artifact', 'Creature', 'Land'].includes(t)) };

ABILITIES['Petra Sphinx'] = [{
  cost: { tap: true }, targets: ['player'], ai: 'utility',
  text: 'Target player chooses a card name, then reveals the top card of their library. If it has the chosen name, they put it into their hand; otherwise into their graveyard.',
  resolve(g, it) {
    const t = it.targets[0].id; const pl = g.players[t];
    const freq = {}; for (const c of pl.library) freq[c.def.name] = (freq[c.def.name] || 0) + 1;
    const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
    g.nameCard(t, { prompt: 'Petra Sphinx: name a card', source: it.card.id, auto: best }, (name) => {
      const top = pl.library[pl.library.length - 1]; if (!top) return;
      pl.library.pop(); g.say(`${pl.name} reveals ${top.def.name}.`);
      if (top.def.name === name) { pl.hand.push(top); g.say(`${pl.name} names ${name} and puts it into their hand.`); }
      else { pl.gy.push(top); g.say(`${pl.name} names ${name}; ${top.def.name} goes to the graveyard.`); }
    });
  },
}];

EFFECTS['Rapid Fire'] = {
  targets: ['creature'], ai: 'pump', castWhen: (g) => ['upkeep', 'draw', 'main1', 'attackers'].includes(g.step) && !g.combat.blocked?.length,
  text: "Cast only before blockers are declared. Target creature gains first strike until end of turn. If it doesn't have rampage, it gains rampage 2 until end of turn.",
  resolve(g, it) {
    const p = g.perm(it.targets[0]); if (!p) return;
    g.addMod(p, { kw: 'first strike' });
    if (![...g.kw(p)].some((k) => k.startsWith('rampage:'))) g.addMod(p, { kw: 'rampage:2' });
  },
};

done('Clergy of the Holy Nimbus', 'Divine Intervention', 'Glyph of Life', 'Great Wall', 'Infinite Authority', 'Kismet', 'Petra Sphinx', 'Rapid Fire');

// =====================================================================================================
// Arabian Nights / Antiquities white
// =====================================================================================================
const isArtSrc = (g, s) => !!s && !!s.card && (s.mods ? g.hasType(s, 'Artifact') : s.card.def.types.includes('Artifact'));

// Abu Ja'far: remembers who it fought; when it dies, those creatures still in that combat are destroyed (no regeneration).
TRIGGERS["Abu Ja'far"] = {
  onBlock: (g, perm, att) => { perm.partners = [att.id]; },
  onBlocked: (g, perm, blockers) => { perm.partners = blockers.map((b) => b.id); },
  onDie(g, perm) {
    if (!['attackers', 'blockers', 'damage'].includes(g.step)) return; // only while the combat it was part of is still going
    for (const id of perm.partners || []) { const q = g.perm(id); if (q && g.isCreature(q)) g.destroy(q, { noRegen: true }); }
  },
};

EFFECTS['Army of Allah'] = {
  targets: [], ai: 'pump', text: 'Attacking creatures get +2/+0 until end of turn.',
  resolve(g) { for (const id of g.combat.attackers) { const p = g.perm(id); if (p) g.addMod(p, { p: 2 }); } },
};

// Camel: damage from Deserts is prevented to it and its band while it attacks.
STATIC['Camel'] = {
  preventDamage(g, src, d) {
    const t = d.perm; if (!t || !src.attacking && !g.combat.attackers.includes(src.id)) return d.n;
    if (!d.src?.card) return d.n;
    const ds = g.perm(d.src.card.id);
    if (!ds || !g.hasSubtype(ds, 'Desert')) return d.n;
    const banded = t === src || (g.combat.bands || []).some((b) => b.includes(src.id) && b.includes(t.id));
    return banded ? 0 : d.n;
  },
};

// Jihad: colour and opponent chosen as it enters (two players: the opponent).
TRIGGERS['Jihad'] = {
  onEnter(g, perm) {
    const opp = 1 - perm.controller;
    const names = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
    const count = (c) => g.players[opp].bf.filter((p) => !p.card.token && g.colors(p).includes(c)).length;
    g.ask(perm.controller, { type: 'pick', prompt: 'Jihad: choose a colour (the chosen opponent is ' + g.players[opp].name + ')', source: perm.card.id, min: 1, max: 1,
      options: Object.keys(names).map((c) => ({ value: c, label: names[c], score: count(c) })) },
    ([c]) => { perm.jihadColor = c; perm.jihadPlayer = opp; g.sba(); });
  },
  onState(g, perm) {
    if (!perm.jihadColor) return;
    if (!g.players[perm.jihadPlayer].bf.some((p) => !p.card.token && g.colors(p).includes(perm.jihadColor))) { g.say('Jihad is sacrificed.'); g.sacrifice(perm); }
  },
};
STATIC['Jihad'] = (() => {
  const cond = guarded((g, src) => !!src.jihadColor && g.players[src.jihadPlayer].bf.some((p) => !p.card.token && g.colors(p).includes(src.jihadColor)));
  const white = guarded((g, t) => g.isCreature(t) && g.colors(t).includes('W'));
  return { affects: (g, src, t) => white(g, t) && cond(g, src), power: 2, toughness: 1 };
})();

ABILITIES['King Suleiman'] = [{
  cost: { tap: true }, ai: 'removal', text: '{T}: Destroy target Djinn or Efreet.',
  targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && (g.hasSubtype(p, 'Djinn') || g.hasSubtype(p, 'Efreet')) }],
  resolve: (g, it) => g.destroy(g.perm(it.targets[0])),
}];

EFFECTS['Piety'] = {
  targets: [], ai: 'pump', text: 'Blocking creatures get +0/+3 until end of turn.',
  resolve(g) { for (const p of g.allPerms()) if (g.isCreature(p) && isBlocking(g, p)) g.addMod(p, { t: 3 }); },
};

ABILITIES['Argivian Archaeologist'] = [{
  cost: { tap: true, mana: '{W}{W}' }, targets: ['artifactCardInYourGraveyard'], ai: 'utility', text: '{W}{W}, {T}: Return target artifact card from your graveyard to your hand.',
  resolve(g, it) { const c = g.findCard(it.targets[0].id); const o = g.players[it.controller]; if (c && o.gy.includes(c)) { o.gy = o.gy.filter((x) => x !== c); o.hand.push(c); g.say(`${c.def.name} returns to ${o.name}'s hand.`); } },
}];
ABILITIES['Argivian Blacksmith'] = [{
  cost: { tap: true }, targets: ['artifactCreature'], ai: 'heal', text: '{T}: Prevent the next 2 damage that would be dealt to target artifact creature this turn.',
  resolve: (g, it) => g.preventDamage(it.targets[0], 2),
}];

STATIC['Artifact Ward'] = [
  { cantBlock: (g, src, blocker, att) => att.id === src.attachedTo && g.hasType(blocker, 'Artifact') },
  { preventDamage: (g, src, d) => (d.target?.kind === 'perm' && d.target.id === src.attachedTo && isArtSrc(g, d.src) ? 0 : d.n) },
  { cantBeTargeted: (g, src, target, kind, card) => target.id === src.attachedTo && kind === 'ability' && !!card && card.def.types.includes('Artifact') },
];

ABILITIES['Circle of Protection: Artifacts'] = [{
  cost: { mana: '{2}' }, ai: 'heal', text: 'The next time an artifact source of your choice would deal damage to you this turn, prevent that damage.',
  resolve: (g, it) => g.chooseSource(it.controller, (s) => isArtSrc(g, s), { prompt: 'Choose an artifact source', source: it.card.id },
    (id) => { if (id != null) g.preventDamage(pl(it.controller), Infinity, { sourceId: id, once: true }); }),
}];

// Martyrs of Korlis: while untapped, artifact damage aimed at its controller is dealt to it instead.
STATIC['Martyrs of Korlis'] = {
  preventDamage(g, src, d) {
    if (src.tapped || !d.target || d.target.kind !== 'player' || d.target.id !== src.controller || !isArtSrc(g, d.src)) return d.n;
    g.damage(d.src, pr(src), d.n, { combat: d.combat, noSba: true });
    return 0;
  },
};

done("Abu Ja'far", 'Army of Allah', 'Camel', 'Jihad', 'King Suleiman', 'Piety', 'Argivian Archaeologist', 'Argivian Blacksmith', 'Artifact Ward',
  'Circle of Protection: Artifacts', 'Martyrs of Korlis');

STATIC['Damping Field'] = { untapLimit: () => ({ artifacts: 1 }) };
done('Damping Field');
