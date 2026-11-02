// Card module: artifacts. See docs/CARD_MODULE_CONTRACT.md and docs/ENGINE_API.md.
// Still locked (engine cannot express them faithfully): see docs/ENGINE_REQUESTS.md "## artifacts".
export const EFFECTS = {};
export const TRIGGERS = {};
export const STATIC = {};
export const ABILITIES = {};
export const COUNTER_ABILITIES = {}; // counter name -> abilities every permanent with that counter has
export const IMPLEMENTED = ['Ornithopter', 'Dancing Scimitar', 'Obsianus Golem'];

const pl = (id) => ({ kind: 'player', id });
const manaAb = (amount) => [{ cost: { tap: true }, mana: { colors: ['C'], amount } }];
const opp = (g, perm) => 1 - perm.controller;
const handSize = (g, pid) => g.players[pid].hand.length;
const done = (...n) => IMPLEMENTED.push(...n);
const add = (name, abs) => { ABILITIES[name] = abs; done(name); };
const trig = (name, t) => { TRIGGERS[name] = { ...(TRIGGERS[name] || {}), ...t }; done(name); };
const stat = (name, s) => { STATIC[name] = s; done(name); };

// ---------- simple activated abilities ----------
add('Jayemdae Tome', [{ cost: { mana: '{4}', tap: true }, ai: 'draw', text: 'Draw a card.', resolve: (g, it) => g.draw(it.controller) }]);
add('Rod of Ruin', [{ cost: { mana: '{3}', tap: true }, targets: ['any'], ai: 'burn', text: '1 damage to any target.', resolve: (g, it) => g.damage(it, it.targets[0], 1) }]);
add("Aladdin's Ring", [{ cost: { mana: '{8}', tap: true }, targets: ['any'], ai: 'burn', text: '4 damage to any target.', resolve: (g, it) => g.damage(it, it.targets[0], 4) }]);
add('Millstone', [{ cost: { mana: '{2}', tap: true }, targets: ['player'], ai: 'utility', text: 'Target player mills two cards.', resolve: (g, it) => g.mill(it.targets[0].id, 2) }]);
add("Jandor's Saddlebags", [{ cost: { mana: '{3}', tap: true }, targets: ['creature'], ai: 'utility', text: 'Untap target creature.', resolve: (g, it) => { const p = g.perm(it.targets[0]); if (p) g.untapPerm(p); } }]);
add('Dragon Engine', [{ cost: { mana: '{2}' }, ai: 'pump', text: '+1/+0 until end of turn.', resolve: (g, it) => g.addMod(it.source, { p: 1 }) }]);
add('Icy Manipulator', [{
  cost: { mana: '{1}', tap: true }, ai: 'utility', text: 'Tap target artifact, creature, or land.',
  targets: [{ kind: 'perm', test: (g, c) => g.hasType(c, 'Artifact') || g.isCreature(c) || g.isLand(c) }],
  resolve: (g, it) => { const p = g.perm(it.targets[0]); if (p) g.tap(p); },
}]);
add('Disrupting Scepter', [{ cost: { mana: '{3}', tap: true }, targets: ['player'], timing: 'myTurn', ai: 'discard', text: 'Target player discards a card.', resolve: (g, it) => g.discardChoice(it.targets[0].id, 1) }]);
add('Flying Carpet', [{ cost: { mana: '{2}', tap: true }, targets: ['creature'], ai: 'utility', text: 'Target creature gains flying until end of turn.', resolve: (g, it) => { const p = g.perm(it.targets[0]); if (p) g.addMod(p, { kw: 'flying' }); } }]);
add('Living Wall', [{ cost: { mana: '{1}' }, ai: 'utility', text: 'Regenerate this creature.', resolve: (g, it) => g.regenerate(it.source) }]);
add('Glasses of Urza', [{ cost: { tap: true }, targets: ['player'], ai: 'utility', text: "Look at target player's hand.", resolve: (g, it) => g.reveal(it.controller, it.targets[0].id) }]);
add('The Hive', [{
  cost: { mana: '{5}', tap: true }, ai: 'utility', text: 'Create a 1/1 Wasp artifact creature token with flying.',
  resolve: (g, it) => g.createToken(it.controller, { name: 'Wasp', power: 1, toughness: 1, types: ['Artifact', 'Creature'], subtypes: ['Insect'], colors: [], kw: ['flying'] }),
}]);
add('Bottle of Suleiman', [{
  cost: { mana: '{1}', sac: true }, ai: 'utility', text: 'Flip a coin. Win: 5/5 flying Djinn token. Lose: 5 damage to you.',
  resolve: (g, it) => {
    if (g.flip()) g.createToken(it.controller, { name: 'Djinn', power: 5, toughness: 5, types: ['Artifact', 'Creature'], subtypes: ['Djinn'], colors: [], kw: ['flying'] });
    else g.damage(it, pl(it.controller), 5);
  },
}]);
add('Rocket Launcher', [{
  cost: { mana: '{2}' }, targets: ['any'], ai: 'burn', text: '1 damage to any target. Destroy this at the beginning of the next end step.',
  condition: (g, perm) => !perm.sick, // controlled continuously since the beginning of your most recent turn
  resolve: (g, it) => {
    const src = it.source;
    g.damage(it, it.targets[0], 1);
    g.delay('end', () => { if (g.perm(src.id)) g.destroy(g.perm(src.id)); });
  },
}]);
add('Conservator', [{ cost: { mana: '{3}', tap: true }, ai: 'heal', text: 'Prevent the next 2 damage that would be dealt to you this turn.', resolve: (g, it) => g.preventDamage(pl(it.controller), 2, { until: 'eot' }) }]);
add('Forcefield', [{
  cost: { mana: '{1}' }, ai: 'utility', text: 'Next time an unblocked creature of your choice would deal combat damage to you this turn, prevent all but 1.',
  resolve: (g, it) => {
    const me = it.controller;
    const pred = (s) => s.kind !== 'ability' && s.kind !== 'spell' && s.attacking && s.controller !== me && !(g.combat.blocks[s.id] || []).length;
    g.chooseSource(me, pred, { prompt: 'Choose an unblocked creature', source: it.card.id }, (id) => { if (id != null) g.preventDamage(pl(me), Infinity, { sourceId: id, keep: 1, once: true, combatOnly: true, until: 'eot' }); });
  },
}]);
add('Jade Monolith', [{
  cost: { mana: '{1}' }, targets: ['creature'], ai: 'utility', text: 'Next time a source of your choice would deal damage to target creature this turn, it deals that damage to you instead.',
  resolve: (g, it) => {
    const me = it.controller; const t = it.targets[0];
    g.chooseSource(me, () => true, { prompt: 'Choose a damage source', source: it.card.id }, (id) => { if (id != null) g.preventDamage(t, Infinity, { sourceId: id, redirect: pl(me), once: true, until: 'eot' }); });
  },
}]);
add('Ebony Horse', [{
  cost: { mana: '{2}', tap: true }, ai: 'utility', text: 'Untap target attacking creature you control. Prevent all combat damage dealt to and by it this turn.',
  targets: [{ kind: 'perm', test: (g, c, ctx) => g.isCreature(c) && c.attacking && c.controller === ctx.pid }],
  resolve: (g, it) => {
    const p = g.perm(it.targets[0]); if (!p) return;
    g.untapPerm(p);
    g.preventDamage({ kind: 'perm', id: p.id }, Infinity, { combatOnly: true, until: 'eot' });
    g.preventDamage(null, Infinity, { sourceId: p.card.id, combatOnly: true, until: 'eot' });
  },
}]);
add('Jade Statue', [{
  cost: { mana: '{2}' }, timing: 'combat', ai: 'utility', text: 'Becomes a 3/6 Golem artifact creature until end of combat.',
  resolve: (g, it) => g.addMod(it.source, { setPT: [3, 6], addTypes: ['Creature'], addSubtypes: ['Golem'], until: 'endCombat' }),
}]);

// ---------- upkeep / draw-step triggers (two players: "chosen opponent" is the other player) ----------
const dmgTo = (g, perm, pid, n) => { if (n > 0) g.damage(perm, pl(pid), n); };
trig('The Rack', { onUpkeep: (g, perm, pid) => { if (pid === opp(g, perm)) dmgTo(g, perm, pid, 3 - handSize(g, pid)); } });
trig('Black Vise', { onUpkeep: (g, perm, pid) => { if (pid === opp(g, perm)) dmgTo(g, perm, pid, handSize(g, pid) - 4); } });
trig('Ivory Tower', { onUpkeep: (g, perm, pid) => { if (pid === perm.controller) { const n = handSize(g, pid) - 4; if (n > 0) g.gainLife(pid, n); } } });
trig('Copper Tablet', { onUpkeep: (g, perm, pid) => dmgTo(g, perm, pid, 1) });
trig('Howling Mine', { onDrawStep: (g, perm, pid) => { if (!perm.tapped) g.draw(pid); } });
trig('Armageddon Clock', {
  onUpkeep: (g, perm, pid) => { if (pid === perm.controller) g.addCounters(perm, 'doom', 1); },
  onDrawStep: (g, perm, pid) => { if (pid === perm.controller) { const n = perm.counters?.doom || 0; if (n > 0) for (const p of g.players) g.damage(perm, pl(p.id), n); } },
});
ABILITIES['Armageddon Clock'] = [{
  cost: { mana: '{4}' }, anyPlayer: true, timing: 'anyUpkeep', ai: 'utility', text: 'Remove a doom counter.',
  condition: (g, perm) => (perm.counters?.doom || 0) > 0,
  resolve: (g, it) => { const c = it.source.counters; if (c?.doom > 0) c.doom--; },
}];

// ---------- mana artifacts that do not untap ----------
add('Basalt Monolith', [...manaAb(3), { cost: { mana: '{3}' }, ai: 'ramp', text: 'Untap this artifact.', resolve: (g, it) => g.untapPerm(it.source) }]);
stat('Basalt Monolith', { noUntap: (g, src, p) => p === src });
add('Mana Vault', manaAb(3));
stat('Mana Vault', { noUntap: (g, src, p) => p === src });
trig('Mana Vault', {
  onUpkeep: (g, perm, pid) => { if (pid === perm.controller && perm.tapped) g.mayPay(pid, '{4}', { prompt: 'Pay {4} to untap Mana Vault?', source: perm.card.id, auto: false }, (paid) => { if (paid) g.untapPerm(perm); }); },
  onDrawStep: (g, perm, pid) => { if (pid === perm.controller && perm.tapped) g.damage(perm, pl(pid), 1); },
});
stat('Brass Man', { noUntap: (g, src, p) => p === src });
trig('Brass Man', { onUpkeep: (g, perm, pid) => { if (pid === perm.controller && perm.tapped) g.mayPay(pid, '{1}', { prompt: 'Pay {1} to untap Brass Man?', source: perm.card.id, auto: true }, (paid) => { if (paid) g.untapPerm(perm); }); } });

// ---------- global untap rules ----------
stat('Meekstone', { noUntap: (g, src, p) => g.isCreature(p) && g.power(p) >= 3 });
stat('Winter Orb', { untapLimit: (g, src) => (src.tapped ? null : { lands: 1 }) });

// ---------- Nevinyrral's Disk ----------
trig("Nevinyrral's Disk", { onEnter: (g, perm) => { perm.tapped = true; } });
ABILITIES["Nevinyrral's Disk"] = [{
  cost: { mana: '{1}', tap: true }, ai: 'sweeper', text: 'Destroy all artifacts, creatures, and enchantments.',
  resolve: (g) => {
    g.emit({ type: 'sweep' });
    const all = g.players.flatMap((p) => [...p.bf]).filter((p) => g.hasType(p, 'Artifact') || g.isCreature(p) || g.hasType(p, 'Enchantment'));
    for (const p of all) if (g.perm(p.id)) g.destroy(p);
  },
}];

// ---------- Primal Clay ----------
const CLAY = { '33': { pt: [3, 3] }, '22': { pt: [2, 2], kw: ['flying'] }, '16': { pt: [1, 6], kw: ['defender'], sub: ['Wall'] } };
STATIC['Primal Clay'] = Object.entries(CLAY).map(([k, m]) => ({
  affects: (g, s, t) => t === s && s.clay === k,
  setPT: () => m.pt,
  ...(m.kw ? { kw: m.kw } : {}),
  ...(m.sub ? { addSubtypes: m.sub } : {}),
}));
TRIGGERS['Primal Clay'] = {
  onEnter: (g, perm) => {
    perm.clay = '33'; // provisional until the choice is made (never leaves it 0/0)
    g.ask(perm.controller, {
      type: 'pick', prompt: 'Primal Clay becomes...', source: perm.card.id, min: 1, max: 1,
      options: [{ value: '33', label: '3/3 artifact creature', score: 2 }, { value: '22', label: '2/2 artifact creature with flying', score: 1 }, { value: '16', label: '1/6 Wall artifact creature with defender', score: 0 }],
    }, ([v]) => { perm.clay = v; });
  },
};
done('Primal Clay');

// ---------- Clockwork Beast ----------
const BEAST = '+1/+0';
TRIGGERS['Clockwork Beast'] = {
  onEnter: (g, perm) => g.addCounters(perm, BEAST, 7),
  onAttack: (g, perm) => { perm.fought = true; },
  onBlock: (g, perm) => { perm.fought = true; },
  onEndCombat: (g, perm) => { if (perm.fought) { perm.fought = false; if ((perm.counters?.[BEAST] || 0) > 0) perm.counters[BEAST]--; } },
};
ABILITIES['Clockwork Beast'] = [{
  cost: { x: true, tap: true }, timing: 'upkeep', ai: 'utility', text: 'Put up to X +1/+0 counters on this creature (max seven in total).',
  resolve: (g, it) => { const have = it.source.counters?.[BEAST] || 0; const n = Math.min(it.x || 0, 7 - have); if (n > 0) g.addCounters(it.source, BEAST, n); },
}];
done('Clockwork Beast');

// ---------- Juggernaut ----------
trig('Juggernaut', { mustAttack: () => true });
stat('Juggernaut', { cantBlock: (g, src, blocker, attacker) => attacker === src && g.hasSubtype(blocker, 'Wall') });

// ---------- Gauntlet of Might, Kormus Bell ----------
stat('Gauntlet of Might', { affects: (g, s, t) => g.isCreature(t) && g.colors(t).includes('R'), power: 1, toughness: 1 });
trig('Gauntlet of Might', { onManaTapped: (g, perm, land, pid) => { if (g.hasSubtype(land, 'Mountain')) g.addMana(land.controller, 'R', 1); } });
stat('Kormus Bell', { affects: (g, s, t) => (t.card.def.subtypes || []).includes('Swamp'), addTypes: ['Creature'], setPT: () => [1, 1], setColors: ['B'] });

// ---------- "you may pay {1}: gain 1 life" family ----------
const lifeCup = (name, colour) => trig(name, {
  onSpellCast: (g, perm, item) => {
    if (!(item.card.def.colors || []).includes(colour)) return;
    g.mayPay(perm.controller, '{1}', { prompt: `${name}: pay {1} to gain 1 life?`, source: perm.card.id, auto: true }, (paid) => { if (paid) g.gainLife(perm.controller, 1); });
  },
});
lifeCup('Crystal Rod', 'U'); lifeCup('Iron Star', 'R'); lifeCup('Ivory Cup', 'W'); lifeCup('Throne of Bone', 'B'); lifeCup('Wooden Sphere', 'G');
trig('Soul Net', { onCreatureDies: (g, perm) => g.mayPay(perm.controller, '{1}', { prompt: 'Soul Net: pay {1} to gain 1 life?', source: perm.card.id, auto: true }, (paid) => { if (paid) g.gainLife(perm.controller, 1); }) });
trig('Ankh of Mishra', { onAnyEnter: (g, perm, e) => { if (g.isLand(e)) g.damage(perm, pl(e.controller), 2); } });
trig('Dingus Egg', { onAnyDie: (g, perm, dead) => { if (dead.card.def.types.includes('Land')) g.damage(perm, pl(dead.controller), 2); } });
trig('Onulet', { onDie: (g, perm) => g.gainLife(perm.controller, 2) });

// ---------- second pass: converters, banding, Time Vault ----------
add('Celestial Prism', [{ cost: { tap: true, mana: '{2}' }, mana: { colors: ['W', 'U', 'B', 'R', 'G'], amount: 1 } }]);
add('Helm of Chatzuk', [{ cost: { mana: '{1}', tap: true }, targets: ['creature'], ai: 'utility', text: 'Target creature gains banding until end of turn.', resolve: (g, it) => { const p = g.perm(it.targets[0]); if (p) g.addMod(p, { kw: 'banding' }); } }]);
trig("Mishra's War Machine", {
  onUpkeep: (g, perm, pid) => {
    if (pid !== perm.controller) return;
    const hit = () => { g.damage(perm, pl(pid), 3); g.tap(perm); };
    if (!g.players[pid].hand.length) return hit();
    g.ask(pid, { type: 'yesno', prompt: "Mishra's War Machine: discard a card? (otherwise it deals 3 damage to you and taps)", source: perm.card.id, auto: true }, (yes) => {
      if (yes) g.discardChoice(pid, 1); else hit();
    });
  },
});
// Time Vault. NOTE: the engine hook is synchronous, so the optional "you may skip that turn" is always taken while it is tapped.
trig('Time Vault', {
  onEnter: (g, perm) => { perm.tapped = true; },
  onWouldBeginTurn: (g, perm, pid) => { if (pid === perm.controller && perm.tapped) { g.untapPerm(perm); return true; } return false; },
});
stat('Time Vault', { noUntap: (g, src, p) => p === src });
ABILITIES['Time Vault'] = [{ cost: { tap: true }, ai: 'utility', text: 'Take an extra turn after this one.', resolve: (g, it) => g.extraTurn(it.controller) }];

// ================= Legends (LEG) colourless cards =================
const isLegendary = (p) => (p.card.def.supertypes || []).includes('Legendary');
const mine = (g, c, ctx) => c.controller === ctx.pid;

add("Al-abara's Carpet", [{
  cost: { mana: '{5}', tap: true }, ai: 'heal', text: 'Prevent all damage that would be dealt to you this turn by attacking creatures without flying.',
  resolve: (g, it) => g.preventDamage(pl(it.controller), Infinity, { filter: (src) => !!src && !!src.attacking && !g.kw(src).has('flying'), until: 'eot' }),
}]);
add("Alchor's Tomb", [{
  cost: { mana: '{2}', tap: true }, ai: 'utility', text: 'Target permanent you control becomes the color of your choice.',
  targets: [{ kind: 'perm', test: mine }],
  resolve: (g, it) => {
    const p = g.perm(it.targets[0]); if (!p) return;
    g.ask(it.controller, { type: 'pick', prompt: `${p.card.def.name} becomes...`, source: it.card.id, min: 1, max: 1, options: ['W', 'U', 'B', 'R', 'G'].map((c) => ({ value: c, label: { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c], score: c === 'W' ? 1 : 0 })) }, ([c]) => { p.colorOverride = [c]; });
  },
}]);
stat('Arena of the Ancients', { noUntap: (g, src, p) => g.isCreature(p) && isLegendary(p) });
TRIGGERS['Arena of the Ancients'] = { onEnter: (g) => { for (const p of g.players.flatMap((x) => x.bf)) if (g.isCreature(p) && isLegendary(p)) g.tap(p); } };
add('Horn of Deafening', [{
  cost: { mana: '{2}', tap: true }, targets: ['creature'], ai: 'utility', text: 'Prevent all combat damage that would be dealt by target creature this turn.',
  resolve: (g, it) => { const p = g.perm(it.targets[0]); if (p) g.preventDamage(null, Infinity, { sourceId: p.card.id, combatOnly: true, until: 'eot' }); },
}]);
add('Kry Shield', [{
  cost: { mana: '{2}', tap: true }, targets: [{ kind: 'perm', test: (g, c, ctx) => g.isCreature(c) && c.controller === ctx.pid }], ai: 'utility',
  text: "Prevent all damage dealt this turn by target creature you control. It gets +0/+X, X = its mana value.",
  resolve: (g, it) => { const p = g.perm(it.targets[0]); if (!p) return; g.preventDamage(null, Infinity, { sourceId: p.card.id, until: 'eot' }); g.addMod(p, { t: p.card.def.manaValue ?? 0 }); },
}]);
add('Relic Barrier', [{ cost: { tap: true }, targets: ['artifact'], ai: 'utility', text: 'Tap target artifact.', resolve: (g, it) => { const p = g.perm(it.targets[0]); if (p) g.tap(p); } }]);
add('Ring of Immortals', [{
  cost: { mana: '{3}', tap: true }, ai: 'counter', text: 'Counter target instant or Aura spell that targets a permanent you control.',
  targets: [{ kind: 'spell', test: (g, s, ctx) => {
    const d = s.card.def; const aura = d.types.includes('Enchantment') && /^Enchant /.test(d.text || '');
    return (d.types.includes('Instant') || aura) && (s.targets || []).some((t) => t.kind === 'perm' && g.perm(t.id)?.controller === ctx.pid);
  } }],
  resolve: (g, it) => g.counterSpell(it.targets[0]),
}]);
stat('Bronze Horse', { preventDamage: (g, s, d) => (d.target.kind === 'perm' && d.target.id === s.id && d.src?.kind === 'spell' && (d.src.targets || []).some((t) => t.kind === 'perm' && t.id === s.id) && g.players[s.controller].bf.some((p) => p !== s && g.isCreature(p)) ? 0 : d.n) });
stat('Forethought Amulet', { preventDamage: (g, s, d) => (d.target.kind === 'player' && d.target.id === s.controller && d.src?.kind === 'spell' && (d.src.card.def.types.includes('Instant') || d.src.card.def.types.includes('Sorcery')) && d.n >= 3 ? 2 : d.n) });
trig('Forethought Amulet', { onUpkeep: (g, perm, pid) => { if (pid === perm.controller) g.mayPay(pid, '{3}', { prompt: 'Forethought Amulet: pay {3} or sacrifice it?', source: perm.card.id, auto: true }, (paid) => { if (!paid) g.sacrifice(perm); }); } });
add('Life Chisel', [{
  cost: { sacOther: (g, cand) => g.isCreature(cand) } /* engine calls fn(g, candidate, self) */, timing: 'upkeep', ai: 'heal', text: "Sacrifice a creature: gain life equal to its toughness.",
  resolve: (g, it) => { const s = it.paid?.sacrificed?.[0]; if (s) g.gainLife(it.controller, Math.max(0, g.toughness(s))); },
}]);
add('Mirror Universe', [{
  cost: { tap: true, sac: true }, timing: 'upkeep', targets: ['opponent'], ai: 'utility', text: 'Exchange life totals with target opponent.',
  resolve: (g, it) => {
    const t = it.targets[0].id; if (t === it.controller) return; // must be an opponent
    const a = g.players[it.controller], b = g.players[t]; [a.life, b.life] = [b.life, a.life]; g.say(`${a.name} and ${b.name} exchange life totals.`); g.sba();
  },
}]);
add('Sentinel', [{
  cost: {}, ai: 'utility', text: "Change base toughness to 1 plus the power of target creature blocking or blocked by this creature.",
  targets: [{ kind: 'perm', test: (g, c, ctx) => !!ctx.source && g.isCreature(c) && ((g.combat.blocks[c.id] || []).includes(ctx.source.id) || (g.combat.blocks[ctx.source.id] || []).includes(c.id)) }],
  resolve: (g, it) => {
    const t = g.perm(it.targets[0]); if (!t) return; const s = it.source;
    s.mods = s.mods.filter((m) => !m.sentinel);
    g.addMod(s, { setPT: [1, 1 + g.power(t)], until: 'forever', sentinel: true });
  },
}]);
add('Serpent Generator', [{
  cost: { mana: '{4}', tap: true }, ai: 'utility', text: 'Create a 1/1 colorless Snake artifact creature token that poisons.',
  resolve: (g, it) => g.createToken(it.controller, { name: 'Snake', power: 1, toughness: 1, types: ['Artifact', 'Creature'], subtypes: ['Snake'], colors: [], text: 'Whenever this creature deals damage to a player, that player gets a poison counter.' }),
}]);
TRIGGERS['Snake'] = { onDealDamage: (g, perm, ref) => { if (ref.kind !== 'player') return; const p = g.players[ref.id]; p.poison = (p.poison || 0) + 1; g.say(`${p.name} gets a poison counter (${p.poison}).`); if (p.poison >= 10) g.loseGame(ref.id); } };
add('Triassic Egg', [
  { cost: { mana: '{3}', tap: true }, ai: 'utility', text: 'Put a hatchling counter on this artifact.', resolve: (g, it) => g.addCounters(it.source, 'hatchling', 1) },
  { cost: { sac: true }, condition: (g, perm) => (perm.counters?.hatchling || 0) >= 2, ai: 'utility', text: 'Put a creature card from your hand onto the battlefield.',
    resolve: (g, it) => { const h = g.players[it.controller].hand.filter((c) => c.def.types.includes('Creature')); if (!h.length) return; g.pickCards(it.controller, h, { prompt: 'Put a creature card onto the battlefield (or none)', min: 0, max: 1, source: it.card.id, score: (c) => c.def.manaValue || 0 }, ([c]) => { if (c) g.putOntoBattlefield(c, it.controller); }); } },
  { cost: { sac: true }, condition: (g, perm) => (perm.counters?.hatchling || 0) >= 2, targets: ['myGraveyardCreature'], ai: 'utility', text: 'Return target creature card from your graveyard to the battlefield.',
    resolve: (g, it) => { const c = g.players[it.controller].gy.find((x) => x.id === it.targets[0].id); if (c) g.putOntoBattlefield(c, it.controller); } },
]);
trig('Voodoo Doll', {
  onUpkeep: (g, perm, pid) => { if (pid === perm.controller) g.addCounters(perm, 'pin', 1); },
  onEndTurn: (g, perm, pid) => { if (pid === perm.controller && !perm.tapped) { const n = perm.counters?.pin || 0; g.destroy(perm); g.damage(perm, pl(pid), n); } },
});
stat('Voodoo Doll', { abilityCostIncrease: (g, src, perm) => (perm === src ? 2 * (src.counters?.pin || 0) : 0) });
ABILITIES['Voodoo Doll'] = [{ cost: { tap: true }, targets: ['any'], ai: 'burn', text: '{X}{X},{T}: damage equal to pin counters to any target (X = pin counters).', resolve: (g, it) => { const n = it.source.counters?.pin || 0; if (n > 0) g.damage(it, it.targets[0], n); } }];
// Knowledge Vault: cards exiled with it live in player.ex and are tracked on perm.vault
const vaultOut = (g, perm, to) => { const list = perm.vault || []; perm.vault = []; for (const c of list) { const o = g.players[c.owner]; o.ex = o.ex.filter((x) => x !== c); o[to].push(c); } };
add('Knowledge Vault', [
  { cost: { mana: '{2}', tap: true }, ai: 'draw', text: 'Exile the top card of your library face down.', resolve: (g, it) => { const p = g.players[it.controller]; if (!p.library.length) return; const c = p.library.pop(); p.ex.push(c); (it.source.vault ||= []).push(c); g.say(`${p.name} exiles a card face down with Knowledge Vault.`); } },
  { cost: {}, ai: 'draw', text: 'Sacrifice this artifact. If you do, discard your hand, then put all cards exiled with it into their owners\' hands.',
    resolve: (g, it) => {
      const src = it.source; if (!g.perm(src.id)) return;
      const list = src.vault || []; src.vault = [];
      g.sacrifice(src);
      const p = g.players[it.controller]; for (const c of [...p.hand]) { p.hand = p.hand.filter((x) => x !== c); p.gy.push(c); g.say(`${p.name} discards ${c.def.name}.`); }
      for (const c of list) { const o = g.players[c.owner]; o.ex = o.ex.filter((x) => x !== c); o.hand.push(c); }
    } },
]);
trig('Knowledge Vault', { onLeave: (g, perm) => vaultOut(g, perm, 'gy') });

// ---- Legends, second pass (engine section 13 hooks) ----
// Mana batteries: one tap ability per number of charge counters removed (k = 0..7)
for (const [name, c] of [['White Mana Battery', 'W'], ['Blue Mana Battery', 'U'], ['Black Mana Battery', 'B'], ['Red Mana Battery', 'R'], ['Green Mana Battery', 'G']]) {
  add(name, [
    { cost: { mana: '{2}', tap: true }, ai: 'ramp', text: 'Put a charge counter on this artifact.', resolve: (g, it) => g.addCounters(it.source, 'charge', 1) },
    ...Array.from({ length: 8 }, (_, k) => ({ cost: k ? { tap: true, counter: { type: 'charge', n: k } } : { tap: true }, mana: { colors: [c], amount: k + 1 } })),
  ]);
}
stat('Mana Matrix', { spellCostIncrease: (g, s, card, pid) => (pid === s.controller && (card.def.types.includes('Instant') || card.def.types.includes('Enchantment')) ? -2 : 0) });
stat('Planar Gate', { spellCostIncrease: (g, s, card, pid) => (pid === s.controller && card.def.types.includes('Creature') ? -2 : 0) });
add('North Star', [{ cost: { mana: '{4}', tap: true }, ai: 'utility', text: 'For one spell this turn, spend mana as though it were mana of any type.', resolve: (g, it) => g.addPlayerMod(it.controller, { anyMana: true, oneSpell: true }) }]);
trig('Sword of the Ages', { onEnter: (g, perm) => { perm.tapped = true; } });
ABILITIES['Sword of the Ages'] = [{
  cost: { tap: true, sac: true, sacOther: 'creature', sacN: 'any', sacExile: true }, targets: ['any'], ai: 'burn',
  text: 'Sacrifice this and any number of creatures: X damage to any target (X = total power), then exile this artifact.',
  resolve: (g, it) => {
    const x = (it.paid?.sacrificed || []).reduce((a, s) => a + Math.max(0, g.power(s)), 0);
    const o = g.players[it.card.owner]; const i = o.gy.indexOf(it.card); if (i >= 0) { o.gy.splice(i, 1); o.ex.push(it.card); }
    if (x > 0) g.damage(it, it.targets[0], x);
  },
}];
const SHARED = ['Artifact', 'Creature', 'Land'];
const share = (g, a, b) => SHARED.some((t) => g.hasType(a, t) && g.hasType(b, t));
add('Gauntlets of Chaos', [{
  cost: { mana: '{5}', sac: true }, ai: 'utility', text: 'Exchange control of target artifact, creature, or land you control and target permanent an opponent controls that shares one of those types.',
  targets: [
    { kind: 'perm', test: (g, c, ctx) => c.controller === ctx.pid && SHARED.some((t) => g.hasType(c, t)) },
    { kind: 'perm', test: (g, c, ctx) => c.controller !== ctx.pid && (!ctx.targets?.length || share(g, c, g.perm(ctx.targets[0]) || c)) && SHARED.some((t) => g.hasType(c, t)) },
  ],
  resolve: (g, it) => {
    const a = g.perm(it.targets[0]), b = g.perm(it.targets[1]); if (!a || !b || a.controller === b.controller || !share(g, a, b)) return;
    const ca = a.controller, cb = b.controller;
    g.setController(a, cb, { permanent: true }); g.setController(b, ca, { permanent: true });
    for (const au of g.players.flatMap((p) => p.bf)) if (au.attachedTo === a.id || au.attachedTo === b.id) g.destroy(au);
  },
}]);
COUNTER_ABILITIES.matrix = [{ cost: { counter: 'matrix' }, ai: 'utility', text: 'Remove a matrix counter: Regenerate this creature.', resolve: (g, it) => g.regenerate(it.source) }];
add('Life Matrix', [{
  cost: { mana: '{4}', tap: true }, timing: 'upkeep', targets: ['creature'], ai: 'utility', text: 'Put a matrix counter on target creature; it can regenerate by removing it.',
  resolve: (g, it) => { const p = g.perm(it.targets[0]); if (p) g.addCounters(p, 'matrix', 1); },
}]);
stat('Marble Priest', {
  mustBlockBy: (g, s, blocker, attacker) => attacker === s && g.hasSubtype(blocker, 'Wall'),
  preventDamage: (g, s, d) => (d.target.kind === 'perm' && d.target.id === s.id && d.combat && d.src?.card && g.perm(d.src.id) && g.hasSubtype(d.src, 'Wall') ? 0 : d.n),
});
add('Nova Pentacle', [{
  cost: { mana: '{3}', tap: true }, ai: 'heal', text: "Next time a source of your choice would deal damage to you this turn, it is dealt to a creature of an opponent's choice instead.",
  resolve: (g, it) => {
    const me = it.controller, foe = 1 - me;
    g.chooseSource(me, () => true, { prompt: 'Choose a damage source', source: it.card.id }, (id) => {
      if (id == null) return;
      g.preventDamage(pl(me), Infinity, { sourceId: id, once: true, until: 'eot', redirect: (g2, src, n) => {
        const cs = g2.players.flatMap((p) => p.bf).filter((p) => g2.isCreature(p));
        if (!cs.length) { g2.damage(src, pl(me), n, { redirected: true }); return; }
        g2.pickPerms(foe, cs, { prompt: 'Nova Pentacle: choose a creature to take the damage', source: it.card.id, score: (p) => (p.controller === me ? 5 : 0) + g2.toughness(p) / 10 }, ([t]) => g2.damage(src, { kind: 'perm', id: t.id }, n, { redirected: true }));
      } });
    });
  },
}]);
