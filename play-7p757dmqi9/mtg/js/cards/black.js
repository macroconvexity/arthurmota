// Card module: black. See docs/CARD_MODULE_CONTRACT.md. Export only what you use.
// Cards that need engine support are listed in docs/ENGINE_REQUESTS.md under "## black" and stay unimplemented.
const regen = () => ({ cost: { mana: '{B}' }, ai: 'utility', text: '{B}: Regenerate this creature.', resolve: (g, it) => g.regenerate(it.source) });
const mana = (cost, ab) => ({ cost: { mana: cost }, ...ab });

export const EFFECTS = {
  'Dark Ritual': { targets: [], ai: 'ramp', text: 'Add {B}{B}{B}.', resolve: (g, it) => { g.players[it.controller].pool.B += 3; } },
  // "It can't be regenerated": the noRegen flag is read by the engine once regeneration exists.
  'Terror': { targets: ['nonartifactNonblackCreature'], ai: 'removal', text: 'Destroy target nonartifact, nonblack creature. It can\'t be regenerated.', resolve: (g, it) => g.destroy(g.perm(it.targets[0]), { noRegen: true }) },
  'Mind Twist': { targets: ['player'], x: true, ai: 'discard', text: 'Target player discards X cards at random.', resolve: (g, it) => { for (let i = 0; i < it.x; i++) g.discardRandom(it.targets[0].id); } },
  'Howl from Beyond': { targets: ['creature'], x: true, ai: 'pump', text: 'Target creature gets +X/+0 until end of turn.', resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { p: it.x }) },
  'Drain Life': { targets: ['any'], x: true, xColor: 'B', ai: 'burn', text: 'Spend only black mana on X. Deals X damage to any target; gain life equal to the damage dealt, not more than the player\'s life / creature\'s toughness before the damage.',
    resolve: (g, it) => {
      const t = it.targets[0]; const perm = t.kind === 'perm' ? g.perm(t) : null;
      const cap = t.kind === 'player' ? g.players[t.id].life : perm ? g.toughness(perm) : 0;
      const dealt = g.damage(it, t, it.x);
      const gain = Math.min(dealt === true ? it.x : (dealt || 0), Math.max(0, cap));
      if (gain > 0) g.gainLife(it.controller, gain);
    } },
  'Demonic Tutor': { targets: [], ai: 'utility', text: 'Search your library for a card, put it into your hand, then shuffle.', resolve: (g, it) => g.search(it.controller, () => true, { to: 'hand', prompt: 'Demonic Tutor: choose a card' }) },
  'Raise Dead': { targets: ['creatureCardInYourGraveyard'], ai: 'utility', text: 'Return target creature card from your graveyard to your hand.',
    resolve: (g, it) => { const pl = g.players[it.controller]; const c = pl.gy.find((x) => x.id === it.targets[0].id); if (c) { pl.gy = pl.gy.filter((x) => x !== c); pl.hand.push(c); g.say(`${pl.name} returns ${c.def.name} to hand.`); } } },
  'Sacrifice': { targets: [], cost: { sacOther: 'creature' }, ai: 'ramp', text: 'Additional cost: sacrifice a creature. Add {B} equal to its mana value.',
    resolve: (g, it) => { const s = it.paid?.sacrificed?.[0]; g.players[it.controller].pool.B += s ? (s.card.def.manaValue || 0) : 0; } },
  'Simulacrum': { targets: ['yourCreature'], ai: 'utility', text: 'You gain life equal to the damage dealt to you this turn. Simulacrum deals that much damage to target creature you control.',
    resolve: (g, it) => { const n = g.players[it.controller].damageTaken; if (n > 0) { g.gainLife(it.controller, n); g.damage(it, it.targets[0], n); } } },
  'Deathlace': { targets: [], ai: 'utility', modes: [{ text: 'Target spell becomes black.', targets: ['spell'] }, { text: 'Target permanent becomes black.', targets: ['permanent'] }],
    resolve: (g, it) => { const t = it.targets[0]; const o = t.kind === 'spell' ? g.stack.find((x) => x.id === t.id) : g.perm(t); if (o) o.colorOverride = ['B']; } },
  'Sinkhole': { targets: ['land'], ai: 'landhate', text: 'Destroy target land.', resolve: (g, it) => g.destroy(g.perm(it.targets[0])) },
};

export const ABILITIES = {
  'Royal Assassin': [{ cost: { tap: true }, targets: ['tappedCreature'], ai: 'removal', text: '{T}: Destroy target tapped creature.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && t.tapped && g.isCreature(t)) g.destroy(t); } }],
  'Frozen Shade': [mana('{B}', { ai: 'pump', text: '{B}: +1/+1 until end of turn.', resolve: (g, it) => g.addMod(it.source, { p: 1, t: 1 }) })],
  'Sorceress Queen': [{ cost: { tap: true }, targets: ['creature'], ai: 'utility', text: '{T}: Target creature other than this creature has base power and toughness 0/2 until end of turn.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && t !== it.source && g.isCreature(t)) g.addMod(t, { setPT: [0, 2] }); } }],
  'Drudge Skeletons': [regen()], 'Wall of Bone': [regen()], "Will-o'-the-Wisp": [regen()],
  'Scavenging Ghoul': [{ cost: { counter: 'corpse' }, ai: 'utility', text: 'Remove a corpse counter from this creature: Regenerate this creature.', resolve: (g, it) => g.regenerate(it.source) }],
  'Demonic Hordes': [{ cost: { tap: true }, targets: ['land'], ai: 'landhate', text: '{T}: Destroy target land.', resolve: (g, it) => g.destroy(g.perm(it.targets[0])) }],
  'Nettling Imp': [{ cost: { tap: true }, ai: 'utility', text: '{T}: Target non-Wall creature the active player has controlled since the start of the turn attacks this turn if able; destroy it at end step if it didn\'t attack. Only during an opponent\'s turn, before attackers.',
    targets: [{ kind: 'perm', test: (g, c) => g.isCreature(c) && !g.hasSubtype(c, 'Wall') && c.controller === g.active && !c.sick }],
    timing: (g, perm, pid) => g.active !== pid && ['untap', 'upkeep', 'draw', 'main1'].includes(g.step),
    resolve: (g, it) => {
      const t = g.perm(it.targets[0]); if (!t) return;
      g.addMod(t, { kw: 'mustAttack' });
      g.delay('end', () => { if (g.perm(t) && !g.attackedThisTurn(t)) g.destroy(t); });
    } }],
};

export const TRIGGERS = {
  'Scavenging Ghoul': { onEndTurn: (g, perm) => { if (g.diedThisTurn > 0) g.addCounters(perm, 'corpse', g.diedThisTurn); } },
  'Nether Shadow': { gy: { onUpkeep: (g, card, pid) => {
    if (pid !== card.owner || g.gyAbove(card).filter((c) => c.def.types.includes('Creature')).length < 3) return;
    g.ask(pid, { type: 'yesno', prompt: 'Nether Shadow: put it onto the battlefield?', auto: true }, (yes) => { if (yes && g.players[pid].gy.includes(card)) g.putOntoBattlefield(card, pid); });
  } } },
  'Sengir Vampire': { onCreatureDies: (g, perm, dead) => { if (dead !== perm && dead.damagedBy?.includes(perm.card.id)) g.addCounters(perm, '+1/+1'); } },
  'El-Hajjâj': { onDealDamage: (g, perm, ref, n) => { if (n > 0) g.gainLife(perm.controller, n); } },
  'Erg Raiders': { onEndTurn: (g, perm, pid) => { if (pid === perm.controller && !g.attackedThisTurn(perm) && !perm.sick) g.damage(perm, { kind: 'player', id: pid }, 2); } },
  'Lord of the Pit': { onUpkeep: (g, perm, pid) => {
    if (pid !== perm.controller) return;
    const others = g.players[pid].bf.filter((p) => p !== perm && g.isCreature(p));
    if (!others.length) return g.damage(perm, { kind: 'player', id: pid }, 7);
    g.pickPerms(pid, others, { prompt: 'Lord of the Pit: sacrifice a creature', score: (p) => -g.power(p) }, ([c]) => c && g.sacrifice(c));
  } },
  'Demonic Hordes': { onUpkeep: (g, perm, pid) => {
    if (pid !== perm.controller) return;
    g.mayPay(pid, '{B}{B}{B}', { prompt: 'Demonic Hordes: pay {B}{B}{B}?', source: perm.card.def }, (paid) => {
      if (paid) return;
      g.tap(perm);
      const lands = g.players[pid].bf.filter((p) => g.isLand(p));
      if (lands.length) g.pickPerms(g.opp(pid), lands, { prompt: 'Choose a land for Demonic Hordes\' controller to sacrifice', score: (p) => (p.tapped ? 0 : 1) }, ([l]) => l && g.sacrifice(l));
    });
  } },
  'Hypnotic Specter': { onDamagePlayer: (g, perm, target) => g.discardRandom(target.id) },
};

const countLands = (g, pid, sub) => g.players[pid].bf.filter((l) => g.isLand(l) && g.hasSubtype(l, sub)).length;
export const STATIC = {
  'Nightmare': { affects: (g, src, t) => t === src, setPT: (g, src) => { const n = countLands(g, src.controller, 'Swamp'); return [n, n]; } },
  'Plague Rats': { affects: (g, src, t) => t === src, setPT: (g) => { const n = g.allPerms().filter((p) => p.card.def.name === 'Plague Rats').length; return [n, n]; } },
  'Zombie Master': [
    { affects: (g, src, t) => t !== src && g.isCreature(t) && g.hasSubtype(t, 'Zombie'), kw: 'swampwalk' },
    { affects: (g, src, t) => t !== src && g.isCreature(t) && g.hasSubtype(t, 'Zombie'), addAbilities: () => [regen()] },
  ],
};
export const IMPLEMENTED = ['Dark Ritual', 'Terror', 'Sinkhole', 'Royal Assassin', 'Frozen Shade', 'Sorceress Queen', 'Hypnotic Specter', 'Scathe Zombies',
  'Scavenging Ghoul', 'Nether Shadow', 'Drain Life', 'Mind Twist', 'Howl from Beyond', 'Demonic Tutor', 'Raise Dead', 'Sacrifice', 'Simulacrum', 'Deathlace', 'Drudge Skeletons', 'Wall of Bone', "Will-o'-the-Wisp",
  'Black Knight', 'Bog Wraith', 'Sengir Vampire', 'El-Hajjâj', 'Erg Raiders', 'Lord of the Pit', 'Demonic Hordes', 'Nettling Imp', 'Nightmare', 'Plague Rats', 'Zombie Master'];

// ================= Legends (LEG), mono-black =================
const pRef = (id) => ({ kind: 'player', id });
const permRef = (p) => ({ kind: 'perm', id: p.id });
const LANDS = ['plains', 'island', 'swamp', 'mountain', 'forest'];
const LAND_SUB = { plains: 'Plains', island: 'Island', swamp: 'Swamp', mountain: 'Mountain', forest: 'Forest' };
const swampsOf = (g, pid) => g.players[pid].bf.filter((l) => g.isLand(l) && g.hasSubtype(l, 'Swamp'));
const inCombatWith = (g, a, b) => (g.combat.blocks[a.id] || []).includes(b.id) || (g.combat.blocks[b.id] || []).includes(a.id);
const atEndOfCombat = (g, perm) => g.delay('endCombat', () => { if (g.perm(perm)) g.destroy(perm); });

const wallOnly = (g, card) => {
  if (!card) return false;
  if (/^Enchant Wall/m.test(card.def.text || '')) return true;
  try { const t = g.castInfo(card).targets; return t.length > 0 && t.every((x) => x === 'wall'); } catch (e) { return false; }
};
Object.assign(EFFECTS, {
  'Jovial Evil': { targets: ['opponent'], ai: 'burn', text: 'Deals X damage to target opponent, X = twice the number of white creatures that player controls.',
    resolve: (g, it) => { const t = it.targets[0].id; const n = g.players[t].bf.filter((p) => g.isCreature(p) && g.colors(p).includes('W')).length; g.damage(it, pRef(t), 2 * n); } },
  'Transmutation': { targets: ['creature'], ai: 'utility', text: "Switch target creature's power and toughness until end of turn.", resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { swapPT: true }) },
  'Glyph of Doom': { targets: ['wall'], ai: 'utility', text: "Choose target Wall creature. At this turn's next end of combat, destroy all creatures that were blocked by that creature this turn.",
    resolve: (g, it) => {
      const wall = g.perm(it.targets[0]); if (!wall) return; const id = wall.id, turn = g.turn;
      g.delay('endCombat', () => {
        if (g.turn !== turn) return;
        const ids = [...new Set(g.blockLog.filter((b) => b.blockerId === id && b.turn === turn).map((b) => b.attackerId))];
        for (const a of ids) { const v = g.perm(a); if (v && g.isCreature(v)) g.destroy(v); }
      });
    } },
  "All Hallow's Eve": { targets: [], ai: 'utility', text: 'Exile with two scream counters. At your upkeep remove one; with none left, put it into your graveyard and each player returns all creature cards from their graveyard to the battlefield.',
    resolve: (g, it) => { it.card.counters = { scream: 2 }; return 'exile'; } },
  'Darkness': { targets: [], ai: 'utility', text: 'Prevent all combat damage that would be dealt this turn.', resolve: (g) => g.preventCombatDamage() },
  'Hell Swarm': { targets: [], ai: 'sweeper', text: 'All creatures get -1/-0 until end of turn.', resolve: (g) => { for (const p of g.allPerms()) if (g.isCreature(p)) g.addMod(p, { p: -1 }); } },
  'Hellfire': { targets: [], ai: 'sweeper', text: 'Destroy all nonblack creatures. Hellfire deals X plus 3 damage to you, where X is the number of creatures that died this way.',
    resolve: (g, it) => {
      const victims = g.allPerms().filter((p) => g.isCreature(p) && !g.colors(p).includes('B'));
      let n = 0; for (const p of victims) if (g.destroy(p)) n++;
      g.damage(it, pRef(it.controller), n + 3);
    } },
  'Syphon Soul': { targets: [], ai: 'burn', text: 'Deals 2 damage to each other player. You gain life equal to the damage dealt.',
    resolve: (g, it) => { const d = g.damage(it, pRef(g.opp(it.controller)), 2); if (d > 0) g.gainLife(it.controller, d); } },
  'Touch of Darkness': { targets: [], multi: { spec: 'creature', min: 1, max: Infinity }, ai: 'utility', text: 'One or more target creatures become black until end of turn.',
    resolve: (g, it) => {
      for (const t of it.targets) {
        const p = g.perm(t); if (!p) continue;
        const prev = p.colorOverride; p.colorOverride = ['B'];
        g.delay('cleanup', () => { if (prev) p.colorOverride = prev; else delete p.colorOverride; });
      }
    } },
});

Object.assign(ABILITIES, {
  'Carrion Ants': [{ cost: { mana: '{1}' }, ai: 'pump', text: '{1}: +1/+1 until end of turn.', resolve: (g, it) => g.addMod(it.source, { p: 1, t: 1 }) }],
  'Fallen Angel': [{ cost: { sacOther: 'creature' }, ai: 'pump', text: 'Sacrifice a creature: +2/+1 until end of turn.', resolve: (g, it) => g.addMod(it.source, { p: 2, t: 1 }) }],
  'Ghosts of the Damned': [{ cost: { tap: true }, targets: ['creature'], ai: 'utility', text: '{T}: Target creature gets -1/-0 until end of turn.', resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { p: -1 }) }],
  'Giant Slug': [{ cost: { mana: '{5}' }, ai: 'utility', text: '{5}: At the beginning of your next upkeep, choose a basic land type. This creature gains landwalk of that type until end of that turn.',
    resolve: (g, it) => {
      const src = it.source, pid = it.controller;
      g.delay('upkeep', () => {
        if (!g.perm(src)) return;
        const opp = g.players[g.opp(pid)];
        const best = () => [LANDS.map((t) => [t, opp.bf.filter((l) => g.isLand(l) && g.hasSubtype(l, LAND_SUB[t])).length]).sort((a, b) => b[1] - a[1])[0][0]];
        g.ask(pid, { type: 'pick', prompt: 'Giant Slug: choose a basic land type', source: src.card.def, min: 1, max: 1, auto: best, options: LANDS.map((t) => ({ value: t, label: LAND_SUB[t] })) },
          ([t]) => { if (g.perm(src)) g.addMod(src, { kw: t + 'walk' }); });
      }, { pid });
    } }],
  'Greed': [{ cost: { mana: '{B}', life: 2 }, ai: 'draw', text: '{B}, Pay 2 life: Draw a card.', resolve: (g, it) => g.draw(it.controller, 1) }],
  "Hell's Caretaker": [{ cost: { tap: true, sacOther: 'creature' }, targets: ['creatureCardInYourGraveyard'], timing: 'upkeep', ai: 'utility',
    text: '{T}, Sacrifice a creature: Return target creature card from your graveyard to the battlefield. Activate only during your upkeep.',
    resolve: (g, it) => { const c = g.players[it.controller].gy.find((x) => x.id === it.targets[0].id); if (c) g.reanimate(it.controller, c); } },
  // Same ability, paying the sacrifice with Hell's Caretaker itself (cost.sacOther excludes the source).
  { cost: { tap: true, sac: true }, targets: ['creatureCardInYourGraveyard'], timing: 'upkeep', ai: 'utility',
    text: '{T}, Sacrifice Hell\'s Caretaker: Return target creature card from your graveyard to the battlefield. Activate only during your upkeep.',
    resolve: (g, it) => { const c = g.players[it.controller].gy.find((x) => x.id === it.targets[0].id); if (c) g.reanimate(it.controller, c); } }],
  'Horror of Horrors': [{ cost: { sacOther: 'Swamp' }, targets: ['blackCreature'], ai: 'utility', text: 'Sacrifice a Swamp: Regenerate target black creature.', resolve: (g, it) => g.regenerate(g.perm(it.targets[0])) }],
  'Lesser Werewolf': [{ cost: { mana: '{B}' }, ai: 'utility', timing: (g) => g.step === 'blockers',
    targets: [{ kind: 'perm', test: (g, c, ctx) => !!ctx.source && g.isCreature(c) && inCombatWith(g, ctx.source, c) }],
    text: '{B}: If this creature\'s power is 1 or more, it gets -1/-0 until end of turn and put a -0/-1 counter on target creature blocking or blocked by it. Activate only during the declare blockers step.',
    resolve: (g, it) => {
      const t = g.perm(it.targets[0]); if (!t || !g.perm(it.source) || !inCombatWith(g, it.source, t)) return;
      if (g.power(it.source) < 1) return;
      g.addMod(it.source, { p: -1 }); g.addCounters(t, '-0/-1');
    } }],
  'Shimian Night Stalker': [{ cost: { mana: '{B}', tap: true }, targets: ['attackingCreature'], ai: 'utility',
    text: '{B}, {T}: All damage that would be dealt to you this turn by target attacking creature is dealt to this creature instead.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t) g.preventDamage(pRef(it.controller), Infinity, { sourceId: t.card.id, redirect: permRef(it.source), until: 'eot' }); } }],
  'Vampire Bats': [{ cost: { mana: '{B}' }, limit: 2, ai: 'pump', text: '{B}: +1/+0 until end of turn. Activate no more than twice each turn.', resolve: (g, it) => g.addMod(it.source, { p: 1 }) }],
  'Walking Dead': [regen()],
});

const imprisonPay = (g, aura, prompt, yes) => g.mayPay(aura.controller, '{1}', { prompt, source: aura.card.def }, (paid) => { if (paid) yes(); else g.destroy(aura); });
Object.assign(TRIGGERS, {
  "All Hallow's Eve": { ex: { onUpkeep: (g, card, pid) => {
    if (pid !== card.owner || !(card.counters?.scream > 0)) return;
    card.counters.scream--; g.say(`All Hallow's Eve loses a scream counter (${card.counters.scream} left).`);
    if (card.counters.scream > 0) return;
    const pl = g.players[card.owner]; pl.ex = pl.ex.filter((c) => c !== card); pl.gy.push(card);
    for (const q of [g.players[g.active], g.players[g.opp(g.active)]]) for (const c of q.gy.filter((x) => x.def.types.includes('Creature'))) g.putOntoBattlefield(c, q.id);
  } } },
  'Imprison': {
    onAbilityActivated: (g, aura, item) => {
      if (aura.attachedTo == null || !item.source || item.source.id !== aura.attachedTo || !item.tapCost) return;
      imprisonPay(g, aura, 'Imprison: pay {1} to counter that ability (otherwise Imprison is destroyed)', () => g.counterAbility(item));
    },
    onDeclareAttackers: (g, aura, atk) => {
      const h = aura.attachedTo != null && g.host(aura); if (!h || !atk.includes(h)) return;
      imprisonPay(g, aura, 'Imprison: pay {1} to tap the attacker and remove it from combat (otherwise Imprison is destroyed)', () => { g.tap(h); g.removeFromCombat(h, { unblock: true }); });
    },
    onHostBlock: (g, aura, host) => imprisonPay(g, aura, 'Imprison: pay {1} to tap the blocker and remove it from combat (otherwise Imprison is destroyed)', () => { g.tap(host); g.removeFromCombat(host, { unblock: true }); }),
  },
  'Abomination': {
    onBlock: (g, perm, att) => { if (g.colors(att).some((c) => c === 'G' || c === 'W')) atEndOfCombat(g, att); },
    onBlocked: (g, perm, bs) => { for (const b of bs) if (g.colors(b).some((c) => c === 'G' || c === 'W')) atEndOfCombat(g, b); },
  },
  'Infernal Medusa': {
    onBlock: (g, perm, att) => atEndOfCombat(g, att),
    onBlocked: (g, perm, bs) => { for (const b of bs) if (!g.hasSubtype(b, 'Wall')) atEndOfCombat(g, b); },
  },
  'Blight': { onAnyTap: (g, perm, tapped) => { if (perm.attachedTo != null && tapped.id === perm.attachedTo) g.destroy(tapped); } },
  'Cosmic Horror': { onUpkeep: (g, perm, pid) => {
    if (pid !== perm.controller) return;
    g.mayPay(pid, '{3}{B}{B}{B}', { prompt: 'Cosmic Horror: pay {3}{B}{B}{B}?', source: perm.card.def }, (paid) => { if (!paid && g.destroy(perm)) g.damage(perm, pRef(pid), 7); });
  } },
  'Cyclopean Mummy': { onDie: (g, perm) => { const pl = g.players[perm.card.owner]; const i = pl.gy.indexOf(perm.card); if (i >= 0) { pl.gy.splice(i, 1); pl.ex.push(perm.card); g.say('Cyclopean Mummy is exiled.'); } } },
  'Mold Demon': { onEnter: (g, perm) => {
    const pid = perm.controller; const sw = swampsOf(g, pid);
    if (sw.length < 2) return g.sacrifice(perm);
    g.ask(pid, { type: 'yesno', prompt: 'Mold Demon: sacrifice two Swamps (otherwise sacrifice it)?', source: perm.card.def, auto: true }, (yes) => {
      if (!yes) return g.sacrifice(perm);
      g.pickPerms(pid, sw, { prompt: 'Sacrifice two Swamps', min: 2, max: 2, score: (p) => (p.tapped ? 1 : 0) }, (ps) => { for (const p of ps) g.sacrifice(p); });
    });
  } },
  'Nether Void': { onSpellCast: (g, perm, item) => g.mayPay(item.controller, '{3}', { prompt: 'Nether Void: pay {3} or ' + item.card.def.name + ' is countered', source: perm.card.def }, (paid) => { if (!paid) g.counterSpell({ id: item.id }); }) },
  'Pit Scorpion': { onDealDamage: (g, perm, ref, n) => {
    if (ref.kind !== 'player' || !(n > 0)) return;
    const pl = g.players[ref.id]; pl.poison = (pl.poison || 0) + 1; g.say(`${pl.name} gets a poison counter (${pl.poison}).`);
    if (pl.poison >= 10) g.loseGame(ref.id, 'poison');
  } },
  'Spirit Shackle': { onAnyTap: (g, perm, tapped) => { if (perm.attachedTo != null && tapped.id === perm.attachedTo) g.addCounters(tapped, '-0/-2'); } },
  'Underworld Dreams': { onDraw: (g, perm, pid, n) => { if (pid !== perm.controller) for (let i = 0; i < (n || 1); i++) g.damage(perm, pRef(pid), 1); } },
  'The Abyss': { onUpkeep: (g, perm, pid) => {
    const cands = g.players[pid].bf.filter((p) => { if (!g.isCreature(p) || g.hasType(p, 'Artifact')) return false; const kw = g.kw(p); return !kw.has('shroud') && !kw.has('pro:B'); });
    if (!cands.length) return;
    g.pickPerms(pid, cands, { prompt: 'The Abyss: choose a nonartifact creature to destroy', source: perm.card.def, score: (p) => -(g.power(p) + g.toughness(p)) }, ([c]) => { if (c) g.destroy(c, { noRegen: true }); });
  } },
  'The Wretched': { onEndCombat: (g, perm) => {
    const bs = (g.combat.blocks[perm.id] || []).map((id) => g.perm(id)).filter(Boolean);
    if (!bs.length) return;
    perm.stolen = [...new Set([...(perm.stolen || []), ...bs.map((b) => b.id)])]; perm.stolenBy = perm.controller; g.ver++;
    g.say(`The Wretched gains control of ${bs.map((b) => b.card.def.name).join(', ')}.`);
  } },
  'Wall of Tombstones': { onUpkeep: (g, perm, pid) => {
    if (pid !== perm.controller) return;
    const n = 1 + g.players[pid].gy.filter((c) => c.def.types.includes('Creature')).length;
    perm.mods = perm.mods.filter((m) => !m.tomb); perm.mods.push({ setPT: [0, n], until: 'forever', tomb: true }); g.ver++;
  } },
  'Takklemaggot': {
    onUpkeep: (g, perm, pid) => {
      if (perm.attachedTo != null) { const h = g.host(perm); if (h && h.controller === pid) g.addCounters(h, '-0/-1'); }
      else if (perm.takkPlayer === pid) g.damage(perm, pRef(pid), 1);
    },
    onHostLeave: (g, aura, host, zone) => { if (zone === 'gy') aura.takkDied = { pid: host.controller }; },
    onLeave: (g, aura, zone) => {
      const d = aura.takkDied; if (!d || zone !== 'gy') return;
      const card = aura.card, owner = g.players[card.owner];
      if (!owner.gy.includes(card)) return;
      const me = aura.controller;
      const cands = g.allPerms().filter((p) => g.isCreature(p) && p.id !== aura.attachedTo && !g.kw(p).has('shroud') && !g.kw(p).has('pro:B'));
      const asNonAura = () => { const np = g.putOntoBattlefield(card, me); if (np) np.takkPlayer = d.pid; };
      if (!cands.length) return asNonAura();
      g.pickPerms(d.pid, cands, { prompt: 'Takklemaggot: choose a creature for it to enchant', min: 0, max: 1, score: (p) => -(g.power(p) + g.toughness(p)) }, ([h]) => {
        if (h && g.perm(h)) g.putOntoBattlefield(card, me, { attachedTo: h.id }); else asNonAura();
      });
    },
  },
});

Object.assign(STATIC, {
  'Quagmire': { ignoreLandwalk: (g, src, attacker, blocker, land) => land === 'Swamp' },
  'Chains of Mephistopheles': { replaceDraw: (g, src, pid, ctx) => {
    if (ctx.firstInDrawStep) return false;
    if (!g.players[pid].hand.length) { g.mill(pid, 1); return true; }
    g.discardChoice(pid, 1, () => g.draw(pid, 1));   // the replacement draw is itself replaced, until the hand is empty and a card is milled
    return true;
  } },
  'Demonic Torment': [
    { cantAttack: (g, src, a) => a.id === src.attachedTo },
    { preventDamage: (g, src, d) => (d.combat && d.src && d.src.id === src.attachedTo ? 0 : d.n) },
  ],
  'Evil Eye of Orms-by-Gore': [
    { cantAttack: (g, src, a) => a.controller === src.controller && !g.hasSubtype(a, 'Eye') },
    { cantBlock: (g, src, blocker, attacker) => attacker === src && !g.hasSubtype(blocker, 'Wall') },
  ],
  'Wall of Putrid Flesh': { preventDamage: (g, src, d) => (d.perm === src && d.src && d.src.id != null && g.allPerms().some((a) => a.attachedTo === d.src.id) ? 0 : d.n) },
  'Wall of Shadows': [
    { preventDamage: (g, src, d) => (d.perm === src && d.src && d.src.id != null && (g.combat.blocks[d.src.id] || []).includes(src.id) ? 0 : d.n) },
    { cantBeTargeted: (g, src, target, kind, card) => target === src && (kind === 'spell' || kind === 'ability') && wallOnly(g, card) },
  ],
  'The Wretched': { affects: (g, src, t) => !!src.stolen && src.stolen.includes(t.id) && src.stolenBy === src.controller && t !== src, control: (g, src) => src.controller },
});

IMPLEMENTED.push("All Hallow's Eve", 'Chains of Mephistopheles', 'Glyph of Doom', 'Imprison', 'Jovial Evil', 'Quagmire', 'Transmutation', 'Abomination', 'Blight', 'Carrion Ants', 'Cosmic Horror', 'Cyclopean Mummy', 'Darkness', 'Demonic Torment', 'Evil Eye of Orms-by-Gore', 'Fallen Angel',
  'Ghosts of the Damned', 'Giant Slug', 'Greed', 'Headless Horseman', 'Hell Swarm', "Hell's Caretaker", 'Hellfire', 'Horror of Horrors', 'Infernal Medusa', 
  'Lesser Werewolf', 'Lost Soul', 'Mold Demon', 'Nether Void', 'Pit Scorpion', 'Shimian Night Stalker', 'Spirit Shackle', 'Syphon Soul', 'Takklemaggot', 'The Abyss',
  'The Wretched', 'Touch of Darkness', 'Underworld Dreams', 'Vampire Bats', 'Walking Dead', 'Wall of Putrid Flesh', 'Wall of Shadows', 'Wall of Tombstones');
