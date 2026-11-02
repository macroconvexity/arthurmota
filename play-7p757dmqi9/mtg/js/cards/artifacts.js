// Card module: artifacts. See docs/CARD_MODULE_CONTRACT.md and docs/ENGINE_API.md.
// Still locked (engine cannot express them faithfully): see docs/ENGINE_REQUESTS.md "## artifacts".
export const EFFECTS = {};
export const TRIGGERS = {};
export const STATIC = {};
export const ABILITIES = {};
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
