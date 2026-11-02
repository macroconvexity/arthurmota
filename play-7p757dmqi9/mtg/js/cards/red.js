// Card module: red. See docs/CARD_MODULE_CONTRACT.md. Export only what you use.
// Vanilla / keyword-only red creatures (Gray Ogre, Hill Giant, Hurloon Minotaur, Earth/Fire Elemental,
// Mons's Goblin Raiders, Roc of Kher Ridges, Wall of Stone) pass the generic parser and need no entry.

const pumpAbility = (mana, p, t, text) => ({ cost: { mana }, ai: 'pump', text, resolve: (g, it) => g.addMod(it.source, { p, t }) });
const isPlains = (p) => p.card.def.types.includes('Land') && (p.card.def.name === 'Plains' || (p.card.def.subtypes || []).includes('Plains'));

export const EFFECTS = {
  'Shatter': { targets: ['artifact'], ai: 'removal', text: 'Destroy target artifact.', resolve: (g, it) => g.destroy(g.perm(it.targets[0])) },
  'Tunnel': { targets: ['wall'], ai: 'removal', text: 'Destroy target Wall. It can\'t be regenerated.', resolve: (g, it) => g.destroy(g.perm(it.targets[0]), { noRegen: true }) },
  'Disintegrate': {
    targets: ['any'], x: true, ai: 'burn', text: 'X damage to any target; a creature can\'t be regenerated and is exiled if it would die this turn.',
    resolve: (g, it) => {
      const t = it.targets[0], p = t.kind === 'perm' ? g.perm(t) : null;
      if (p) { p.regen = 0; g.addMod(p, { exileOnDie: true, noRegen: true }); } // regen shields made after resolution are not blocked (engine has no per-turn noRegen flag)
      g.damage(it, t, it.x);
    },
  },
  'Earthquake': {
    targets: [], x: true, ai: 'sweeper', text: 'X damage to each creature without flying and each player.',
    resolve: (g, it) => {
      const refs = [];
      for (const pl of g.players) for (const p of pl.bf) if (g.isCreature(p) && !g.kw(p).has('flying')) refs.push({ kind: 'perm', id: p.id });
      for (const pl of g.players) refs.push({ kind: 'player', id: pl.id });
      for (const r of refs) if (r.kind === 'player' || g.perm(r)) g.damage(it, r, it.x);
    },
  },
  'Fireball': {
    targets: [], multi: { spec: 'any', min: 1, max: Infinity, extraCost: '{1}' }, x: true, ai: 'burn',
    text: 'X damage divided evenly, rounded down, among any number of targets. Costs {1} more per target beyond the first.',
    resolve: (g, it) => {
      const [each] = g.divide(it.x, it.targets.length);
      it.targets.forEach((t, i) => { if (it.legal ? it.legal[i] : true) g.damage(it, t, each); });
    },
  },
  'Red Elemental Blast': {
    targets: [], ai: 'counter', text: 'Choose one: counter target blue spell; or destroy target blue permanent.',
    modes: [{ text: 'Counter target blue spell.', targets: ['blueSpell'] }, { text: 'Destroy target blue permanent.', targets: ['bluePermanent'] }],
    resolve: (g, it) => { if (it.mode === 1) g.destroy(g.perm(it.targets[0])); else g.counterSpell(it.targets[0]); },
  },
  'Chaoslace': {
    targets: [], ai: 'utility', text: 'Target spell or permanent becomes red.',
    modes: [{ text: 'Target spell becomes red.', targets: ['spell'] }, { text: 'Target permanent becomes red.', targets: ['permanent'] }],
    resolve: (g, it) => {
      const t = it.targets[0];
      if (t.kind === 'spell') { const s = g.stack.find((x) => x.id === t.id); if (s) s.colorOverride = ['R']; }
      else { const p = g.perm(t); if (p) p.colorOverride = ['R']; }
    },
  },
  'False Orders': {
    targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && p.controller === g.opp(g.active) }], ai: 'utility',
    text: 'Remove target creature defending player controls from combat; it may block an attacking creature of your choice.',
    castWhen: (g) => g.step === 'blockers' && g.combat.attackers.length > 0,
    resolve: (g, it) => {
      const t = g.perm(it.targets[0]); if (!t) return;
      const c = g.combat;
      const soleBlocked = Object.entries(c.blocks).filter(([, b]) => b.length === 1 && b[0] === t.id).map(([a]) => +a);
      g.removeFromCombat(t);
      for (const a of soleBlocked) { delete c.blocks[a]; c.blocked = c.blocked.filter((x) => x !== a); }
      g.say(`${t.card.def.name} is removed from combat.`);
      const cands = c.attackers.map((id) => g.perm(id)).filter((a) => a && g.canBlock(t, a));
      if (!cands.length) return;
      g.pickPerms(it.controller, cands, { prompt: `Have ${t.card.def.name} block an attacking creature?`, min: 0, max: 1, auto: [] }, ([a]) => {
        if (!a || !g.perm(t) || !c.attackers.includes(a.id)) return;
        (c.blocks[a.id] ||= []).push(t.id);
        if (!c.blocked.includes(a.id)) c.blocked.push(a.id);
        g.say(`${t.card.def.name} blocks ${a.card.def.name}.`);
      });
    },
  },
  'Fork': {
    targets: ['instantOrSorcerySpell'], ai: 'utility', text: 'Copy target instant or sorcery spell, except that the copy is red. You may choose new targets for the copy.',
    resolve: (g, it) => {
      const spell = g.stack.find((s) => s.id === it.targets[0].id); if (!spell) return;
      const copy = g.copySpell(spell, it.controller);
      copy.colorOverride = ['R'];
      const newT = [...copy.targets];
      const step = (i) => {
        if (i >= newT.length) { copy.targets = newT; return; }
        const spec = copy.specs?.[i];
        const opts = spec ? g.validTargets(spec, it.controller, null, copy.card) : [];
        if (opts.length < 2) return step(i + 1);
        const cur = Math.max(0, opts.findIndex((r) => r.kind === newT[i].kind && r.id === newT[i].id));
        g.ask(it.controller, { type: 'pick', prompt: `Choose a target for the copy of ${spell.card.def.name}`, min: 1, max: 1, options: opts.map((r, k) => ({ value: k, label: g.refText(r), ref: r })), auto: [cur] }, ([k]) => { newT[i] = opts[k]; step(i + 1); });
      };
      step(0);
    },
  },
  'Lightning Bolt': { targets: ['any'], ai: 'burn', text: '3 damage', resolve: (g, it) => g.damage(it, it.targets[0], 3) },
  'Stone Rain': { targets: ['land'], ai: 'landhate', text: 'Destroy target land.', resolve: (g, it) => g.destroy(g.perm(it.targets[0])) },
  'Flashfires': {
    targets: [], ai: 'landhate', text: 'Destroy all Plains.',
    resolve: (g) => { g.emit({ type: 'sweep' }); for (const pl of g.players) for (const p of [...pl.bf]) if (isPlains(p)) g.destroy(p); },
  },
  'Shatterstorm': {
    targets: [], ai: 'sweeper', text: 'Destroy all artifacts. They can\'t be regenerated.',
    resolve: (g) => { g.emit({ type: 'sweep' }); for (const pl of g.players) for (const p of [...pl.bf]) if (p.card.def.types.includes('Artifact')) g.destroy(p, { noRegen: true }); },
  },
  'Wheel of Fortune': {
    targets: [], ai: 'draw', text: 'Each player discards their hand, then draws seven cards.',
    resolve: (g) => {
      const dropped = g.players.map((pl) => { g.say(`${pl.name} discards their hand.`); const h = pl.hand; pl.gy.push(...h); pl.hand = []; return h; });
      dropped.forEach((h, i) => h.forEach((c) => g.afterDiscard(i, c))); // fires onDiscarded / onAnyDiscard
      for (const pl of g.players) g.draw(pl.id, 7);
      g.sba();
    },
  },
};

export const ABILITIES = {
  'Dwarven Demolition Team': [{ cost: { tap: true }, targets: ['wall'], ai: 'removal', text: 'Destroy target Wall.', resolve: (g, it) => g.destroy(g.perm(it.targets[0])) }],
  'Dwarven Warriors': [{ cost: { tap: true }, targets: ['creatureLE2Power'], ai: 'utility', text: 'Target creature with power 2 or less can\'t be blocked this turn.', resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { kw: 'unblockable' }) }],
  'Goblin Balloon Brigade': [{ cost: { mana: '{R}' }, ai: 'utility', text: 'Gains flying until end of turn.', resolve: (g, it) => g.addMod(it.source, { kw: 'flying' }) }],
  'Uthden Troll': [{ cost: { mana: '{R}' }, ai: 'utility', text: 'Regenerate this creature.', resolve: (g, it) => g.regenerate(it.source) }],
  'Sedge Troll': [{ cost: { mana: '{B}' }, ai: 'utility', text: 'Regenerate this creature.', resolve: (g, it) => g.regenerate(it.source) }],
  'Stone Giant': [{
    cost: { tap: true }, targets: ['creatureYouControlToughnessLessThanSourcePower'], ai: 'utility',
    text: 'Target creature you control with toughness less than this creature\'s power gains flying until end of turn. Destroy it at the beginning of the next end step.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (!t) return; g.addMod(t, { kw: 'flying' }); g.delay('end', () => { if (g.perm(t)) g.destroy(t); }); },
  }],
  'Dragon Whelp': [{
    cost: { mana: '{R}' }, ai: 'pump', text: '+1/+0 until end of turn. If activated four or more times this turn, sacrifice it at the beginning of the next end step.',
    resolve: (g, it) => {
      const src = it.source; g.addMod(src, { p: 1 });
      if ((src.used[0] || 0) >= 4) g.delay('end', () => { if (g.perm(src)) g.sacrifice(src); });
    },
  }],
  'Atog': [{ cost: { sacOther: 'Artifact' }, ai: 'pump', text: '+2/+2 until end of turn', resolve: (g, it) => g.addMod(it.source, { p: 2, t: 2 }) }],
  'Dwarven Weaponsmith': [{
    cost: { tap: true, sacOther: 'Artifact' }, targets: ['creature'], timing: 'upkeep', ai: 'utility', text: 'Put a +1/+1 counter on target creature. Activate only during your upkeep.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t) g.addCounters(t, '+1/+1', 1); },
  }],
  'Rock Hydra': [
    { cost: { mana: '{R}' }, ai: 'utility', text: 'Prevent the next 1 damage that would be dealt to this creature this turn.', resolve: (g, it) => g.preventDamage({ kind: 'perm', id: it.source.id }, 1) },
    { cost: { mana: '{R}{R}{R}' }, timing: 'upkeep', ai: 'pump', text: 'Put a +1/+1 counter on this creature. Activate only during your upkeep.', resolve: (g, it) => g.addCounters(it.source, '+1/+1', 1) },
  ],
  'Shivan Dragon': [pumpAbility('{R}', 1, 0, '+1/+0 until end of turn')],
  'Wall of Fire': [pumpAbility('{R}', 1, 0, '+1/+0 until end of turn')],
  'Granite Gargoyle': [pumpAbility('{R}', 0, 1, '+0/+1 until end of turn')],
  'Orcish Artillery': [{
    cost: { tap: true }, targets: ['any'], ai: 'burn', text: '2 damage to any target and 3 damage to you',
    resolve: (g, it) => { g.damage(it.source, it.targets[0], 2); g.damage(it.source, { kind: 'player', id: it.controller }, 3); },
  }],
};

export const TRIGGERS = {
  'Ironclaw Orcs': { canBlock: (g, blocker, attacker) => g.power(attacker) < 2 },
  'Two-Headed Giant of Foriys': { maxBlocks: () => 2 },
  'Mijae Djinn': { onAttack: (g, perm) => { if (!g.flip()) { g.removeFromCombat(perm); g.tap(perm); g.say('Mijae Djinn is removed from combat and tapped.'); } } },
  'Rock Hydra': { onEnter: (g, perm) => { if (perm.x > 0) g.addCounters(perm, '+1/+1', perm.x); } },
};
const hasLand = (g, pid, sub) => g.players[pid].bf.some((l) => g.isLand(l) && g.hasSubtype(l, sub));
export const STATIC = {
  'Goblin King': { affects: (g, src, t) => t !== src && g.isCreature(t) && g.hasSubtype(t, 'Goblin'), power: 1, toughness: 1, kw: 'mountainwalk' },
  'Kird Ape': { affects: (g, src, t) => t === src && hasLand(g, src.controller, 'Forest'), power: 1, toughness: 2 },
  'Sedge Troll': { affects: (g, src, t) => t === src && hasLand(g, src.controller, 'Swamp'), power: 1, toughness: 1 },
  'Keldon Warlord': {
    affects: (g, src, t) => t === src,
    setPT: (g, src) => { const n = g.players[src.controller].bf.filter((p) => g.isCreature(p) && !g.hasSubtype(p, 'Wall')).length; return [n, n]; },
  },
  'Rock Hydra': {
    preventDamage: (g, src, d) => {
      if (d.target.kind !== 'perm' || d.target.id !== src.id) return d.n;
      const k = Math.min(src.counters['+1/+1'] || 0, d.n);
      if (k) g.addCounters(src, '+1/+1', -k);
      return d.n - k;
    },
  },
};
export const IMPLEMENTED = [
  'Shatter', 'Tunnel', 'Disintegrate', 'Earthquake', 'Fireball', 'Red Elemental Blast', 'Chaoslace', 'False Orders', 'Fork',
  'Dwarven Demolition Team', 'Dwarven Warriors', 'Goblin Balloon Brigade', 'Uthden Troll', 'Sedge Troll', 'Stone Giant', 'Dragon Whelp', 'Atog',
  'Dwarven Weaponsmith', 'Rock Hydra', 'Ironclaw Orcs', 'Two-Headed Giant of Foriys', 'Mijae Djinn', 'Goblin King', 'Kird Ape', 'Keldon Warlord',
];

// ================= Legends (LEG), mono-red =================
const onHostL = (g, src, t) => t.id === src.attachedTo;
const ref = (p) => ({ kind: 'perm', id: p.id });
const isAtkOrBlk = (g, p) => g.isCreature(p) && (g.combat.attackers.includes(p.id) || Object.values(g.combat.blocks).some((b) => b.includes(p.id)));
const kobold = (g, src, t) => t !== src && t.controller === src.controller && g.isCreature(t) && g.hasSubtype(t, 'Kobold');
const SRC = (card) => ({ card });

Object.assign(EFFECTS, {
  'Active Volcano': {
    targets: [], ai: 'removal', text: 'Choose one: destroy target blue permanent; or return target Island to its owner\'s hand.',
    modes: [{ text: 'Destroy target blue permanent.', targets: ['bluePermanent'] }, { text: 'Return target Island to its owner\'s hand.', targets: [{ kind: 'perm', test: (g, p) => g.isLand(p) && g.hasSubtype(p, 'Island') }] }],
    resolve: (g, it) => { const p = g.perm(it.targets[0]); if (!p) return; if (it.mode === 1) g.bounce(p); else g.destroy(p); },
  },
  'Blood Lust': {
    targets: ['creature'], ai: 'pump', text: 'If target creature has toughness 5 or greater, it gets +4/-4 until end of turn. Otherwise it gets +4/-X, X = toughness minus 1.',
    resolve: (g, it) => { const p = g.perm(it.targets[0]); if (!p) return; const t = g.toughness(p); g.addMod(p, { p: 4, t: t >= 5 ? -4 : -(t - 1) }); },
  },
  'Chain Lightning': {
    targets: ['any'], ai: 'burn', text: '3 damage to any target. Then that player or that permanent\'s controller may pay {R}{R}; if so they may copy this spell and choose a new target.',
    resolve: (g, it) => {
      const t = it.targets[0]; const pid = t.kind === 'player' ? t.id : g.perm(t)?.controller;
      g.damage(it, t, 3);
      if (pid == null || g.winner) return;
      g.mayPay(pid, '{R}{R}', { prompt: 'Pay {R}{R} to copy Chain Lightning?', source: it.card.id }, (paid) => {
        if (!paid) return;
        const opts = g.validTargets('any', pid, null, it.card); if (!opts.length) return;
        const foe = Math.max(0, opts.findIndex((r) => r.kind === 'player' && r.id === g.opp(pid)));
        g.ask(pid, { type: 'pick', prompt: 'Choose a target for the copy', min: 1, max: 1, options: opts.map((r, k) => ({ value: k, label: g.refText(r), ref: r })), auto: [foe] }, ([k]) => { g.copySpell(it, pid, [opts[k]]); });
      });
    },
  },
  'Dwarven Song': {
    targets: [], multi: { spec: 'creature', min: 1, max: Infinity }, ai: 'utility', text: 'One or more target creatures become red until end of turn.',
    resolve: (g, it) => {
      it.targets.forEach((t, i) => {
        const p = g.perm(t); if (!p || (it.legal && !it.legal[i])) return;
        const prev = p.colorOverride; p.colorOverride = ['R'];
        g.delay('cleanup', () => { if (prev) p.colorOverride = prev; else delete p.colorOverride; });
      });
    },
  },
  'Feint': {
    targets: ['attackingCreature'], ai: 'utility', text: 'Tap all creatures blocking target attacking creature. Prevent all combat damage that would be dealt this turn by that creature and each creature blocking it.',
    resolve: (g, it) => {
      const a = g.perm(it.targets[0]); if (!a) return;
      const bl = (g.combat.blocks[a.id] || []).map((id) => g.perm(id)).filter(Boolean);
      for (const b of bl) g.tap(b);
      const recips = [...g.players.map((p) => ({ kind: 'player', id: p.id })), ...g.players.flatMap((p) => p.bf.filter((x) => g.isCreature(x)).map(ref))];
      for (const s of [a, ...bl]) for (const r of recips) g.preventDamage(r, Infinity, { sourceId: s.card.id, combatOnly: true });
    },
  },
  'Glyph of Destruction': {
    targets: [{ kind: 'perm', test: (g, p, ctx) => g.isCreature(p) && g.hasSubtype(p, 'Wall') && p.controller === ctx.pid && Object.values(g.combat.blocks).some((b) => b.includes(p.id)) }],
    ai: 'utility', text: 'Target blocking Wall you control gets +10/+0 until end of combat. Prevent all damage that would be dealt to it this turn. Destroy it at the beginning of the next end step.',
    resolve: (g, it) => {
      const w = g.perm(it.targets[0]); if (!w) return;
      g.addMod(w, { p: 10, until: 'endCombat' });
      g.preventDamage(ref(w), Infinity);
      g.delay('end', () => { if (g.perm(w)) g.destroy(w); });
    },
  },
  'Winds of Change': {
    targets: [], ai: 'draw', text: 'Each player shuffles the cards from their hand into their library, then draws that many cards.',
    resolve: (g) => {
      const ns = g.players.map((pl) => { const n = pl.hand.length; pl.library.push(...pl.hand); pl.hand = []; return n; });
      g.players.forEach((pl) => g.shuffleLibrary(pl.id));
      g.players.forEach((pl, i) => g.draw(pl.id, ns[i]));
      g.sba();
    },
  },
});

Object.assign(ABILITIES, {
  'Crimson Manticore': [{ cost: { mana: '{R}', tap: true }, targets: [{ kind: 'perm', test: isAtkOrBlk }], ai: 'burn', text: '1 damage to target attacking or blocking creature.', resolve: (g, it) => g.damage(it.source, it.targets[0], 1) }],
  'Hyperion Blacksmith': [{
    cost: { tap: true }, targets: [{ kind: 'perm', test: (g, p, ctx) => g.hasType(p, 'Artifact') && p.controller !== ctx.pid }], ai: 'utility', text: 'You may tap or untap target artifact an opponent controls.',
    resolve: (g, it) => {
      const t = g.perm(it.targets[0]); if (!t) return;
      g.ask(it.controller, { type: 'pick', prompt: `Tap or untap ${t.card.def.name}?`, min: 1, max: 1, options: [{ value: 'tap', label: 'Tap' }, { value: 'untap', label: 'Untap' }, { value: 'none', label: 'Do nothing' }], auto: [t.tapped ? 'none' : 'tap'] },
        ([c]) => { if (c === 'tap') g.tap(t); else if (c === 'untap') g.untapPerm(t); });
    },
  }],
  'Spinal Villain': [{ cost: { tap: true }, targets: ['blueCreature'], ai: 'removal', text: 'Destroy target blue creature.', resolve: (g, it) => g.destroy(g.perm(it.targets[0])) }],
  'Wall of Opposition': [pumpAbility('{1}', 1, 0, '+1/+0 until end of turn')],
  'The Brute': [{ cost: { mana: '{R}{R}{R}' }, ai: 'utility', text: 'Regenerate enchanted creature.', resolve: (g, it) => { const h = g.host(it.source); if (h) g.regenerate(h); } }],
  "Land's Edge": [{
    cost: { discard: 1 }, anyPlayer: true, targets: ['player'], ai: 'burn', text: 'Discard a card: if it was a land card, 2 damage to target player. Any player may activate.',
    resolve: (g, it) => { if (it.paid?.discarded?.[0]?.def.types.includes('Land')) g.damage(it.source, it.targets[0], 2); },
  }],
  'Tempest Efreet': [{
    cost: { tap: true, sac: true }, ai: 'utility', text: 'Target opponent may pay 10 life; if not, they reveal a random card from hand and exchange ownership with Tempest Efreet.',
    resolve: (g, it) => {
      const me = it.controller, opp = g.opp(me), ef = it.source.card;
      const swap = () => {
        const hand = g.players[opp].hand; if (!hand.length) return;
        const c = hand[Math.floor(g.rng() * hand.length)];
        g.say(`${g.players[opp].name} reveals ${c.def.name}.`);
        hand.splice(hand.indexOf(c), 1); c.owner = me; g.players[me].hand.push(c);
        for (const pl of g.players) for (const z of ['gy', 'ex', 'hand']) { const i = pl[z].indexOf(ef); if (i >= 0) pl[z].splice(i, 1); }
        ef.owner = opp; g.players[opp].gy.push(ef);
      };
      if (g.players[opp].life >= 10) g.ask(opp, { type: 'yesno', prompt: 'Pay 10 life to stop Tempest Efreet?', auto: false }, (yes) => { if (yes) g.loseLife(opp, 10); else swap(); });
      else swap();
    },
  }],
});

Object.assign(TRIGGERS, {
  'Blazing Effigy': {
    onDie: (g, perm) => {
      const x = 3 + (perm.damageFrom || []).filter((r) => r.def?.name === 'Blazing Effigy' && r.src !== perm.id).reduce((a, r) => a + r.n, 0);
      const opts = g.validTargets('creature', perm.controller, null, perm.card); if (!opts.length) return;
      g.ask(perm.controller, { type: 'pick', prompt: `Blazing Effigy deals ${x} damage to target creature`, min: 1, max: 1, options: opts.map((r, k) => ({ value: k, label: g.refText(r), ref: r })), auto: [Math.max(0, opts.findIndex((r) => g.perm(r)?.controller !== perm.controller))] },
        ([k]) => { if (g.perm(opts[k])) g.damage(SRC(perm.card), opts[k], x); });
    },
  },
  'Primordial Ooze': {
    mustAttack: () => true,
    onUpkeep: (g, perm, pid) => {
      if (pid !== perm.controller) return;
      g.addCounters(perm, '+1/+1', 1);
      const x = perm.counters['+1/+1'] || 0;
      g.mayPay(pid, `{${x}}`, { prompt: `Pay {${x}} to keep Primordial Ooze untapped?`, source: perm.card.id }, (paid) => { if (!paid) { g.tap(perm); g.damage(perm, { kind: 'player', id: pid }, x); } });
    },
  },
  'Storm World': { onUpkeep: (g, perm, pid) => { const n = 4 - g.players[pid].hand.length; if (n > 0) g.damage(perm, { kind: 'player', id: pid }, n); } },
  'Wall of Dust': {
    onBlock: (g, perm, att) => { g.delay('upkeep', () => { if (g.perm(att)) g.addMod(att, { kw: 'cantAttack' }); }, { pid: att.controller }); },
  },
});

Object.assign(STATIC, {
  'Beasts of Bogardan': { affects: (g, src, t) => t === src && g.players[g.opp(src.controller)].bf.some((p) => !p.card.token && g.colors(p).includes('W')), power: 1, toughness: 1 },
  'Gravity Sphere': { affects: (g, src, t) => g.isCreature(t), removeKw: ['flying'] },
  'Giant Strength': { affects: onHostL, power: 2, toughness: 2 },
  'Immolation': { affects: onHostL, power: 2, toughness: -2 },
  'Eternal Warrior': { affects: onHostL, kw: 'vigilance' },
  'The Brute': { affects: onHostL, power: 1 },
  'Kobold Drill Sergeant': { affects: kobold, toughness: 1, kw: 'trample' },
  'Kobold Overlord': { affects: kobold, kw: 'first strike' },
  'Kobold Taskmaster': { affects: kobold, power: 1 },
});

IMPLEMENTED.push(
  'Active Volcano', 'Blood Lust', 'Chain Lightning', 'Dwarven Song', 'Feint', 'Glyph of Destruction', 'Winds of Change',
  'Crimson Manticore', 'Hyperion Blacksmith', 'Spinal Villain', 'Wall of Opposition', 'The Brute', "Land's Edge", 'Tempest Efreet',
  'Blazing Effigy', 'Primordial Ooze', 'Storm World', 'Wall of Dust', 'Beasts of Bogardan', 'Gravity Sphere',
  'Giant Strength', 'Immolation', 'Eternal Warrior', 'Kobold Drill Sergeant', 'Kobold Overlord', 'Kobold Taskmaster',
);

// ---- Legends, second pass (engine section 13 hooks) ----
Object.assign(EFFECTS, {
  'Disharmony': {
    targets: ['attackingCreature'], ai: 'utility', text: 'Untap target attacking creature and remove it from combat. Gain control of that creature until end of turn.',
    castWhen: (g) => g.combat.attackers.length > 0 && (g.step === 'attackers' || g.step === 'beginCombat'),
    resolve: (g, it) => { const p = g.perm(it.targets[0]); if (!p) return; g.untapPerm(p); g.removeFromCombat(p); g.setController(p, it.controller, { until: 'eot' }); },
  },
  'Pyrotechnics': {
    targets: [], multi: { spec: 'any', min: 1, max: 4, divide: 4 }, ai: 'burn', text: 'Pyrotechnics deals 4 damage divided as you choose among any number of targets.',
    resolve: (g, it) => { const div = it.division || g.divide(4, it.targets.length); it.targets.forEach((t, i) => { if (it.legal ? it.legal[i] : true) g.damage(it, t, div[i]); }); },
  },
  'Backdraft': {
    targets: [], ai: 'burn', text: 'Choose a player who cast one or more sorcery spells this turn. Backdraft deals damage to that player equal to half the damage dealt by one of those sorcery spells this turn, rounded down.',
    castWhen: (g) => g.turnSpells.some((s) => s.types.includes('Sorcery')),
    resolve: (g, it) => {
      const sp = g.turnSpells.filter((s) => s.types.includes('Sorcery')); if (!sp.length) return;
      const best = sp.reduce((b, s, i) => (s.damageDealt > sp[b].damageDealt ? i : b), 0);
      g.ask(it.controller, { type: 'pick', prompt: 'Choose a sorcery spell cast this turn', min: 1, max: 1, options: sp.map((s, k) => ({ value: k, label: `${s.card.def.name} (${g.players[s.controller].name}, ${s.damageDealt} damage)`, card: s.card.def })), auto: [best] },
        ([k]) => { const s = sp[k]; g.damage(it, { kind: 'player', id: s.controller }, Math.floor(s.damageDealt / 2)); });
    },
  },
});
Object.assign(ABILITIES, {
  'Quarum Trench Gnomes': [{
    cost: { tap: true }, targets: [{ kind: 'perm', test: (g, p) => g.isLand(p) && g.hasSubtype(p, 'Plains') }], ai: 'utility',
    text: 'If target Plains is tapped for mana, it produces colorless mana instead of white mana. (Lasts indefinitely.)',
    resolve: (g, it) => { const l = g.perm(it.targets[0]); if (l) g.addMod(l, { manaConvert: { W: 'C' }, until: 'forever' }); },
  }],
});
TRIGGERS['Firestorm Phoenix'] = {
  replaceDie: (g, perm) => {
    const owner = perm.card.owner, next = g.active === owner ? g.turn + 2 : g.turn + 1;
    perm.card.cantPlayUntilTurn = next; perm.card.revealedUntil = next;
    g.say('Firestorm Phoenix returns to its owner\'s hand, revealed, and cannot be played until that player\'s next turn.');
    return 'hand';
  },
};
STATIC['Caverns of Despair'] = { maxAttackers: () => 2, maxBlockers: () => 2 };
STATIC['Crevasse'] = { ignoreLandwalk: (g, src, att, blk, land) => land === 'Mountain' };
IMPLEMENTED.push('Disharmony', 'Pyrotechnics', 'Backdraft', 'Quarum Trench Gnomes', 'Firestorm Phoenix', 'Caverns of Despair', 'Crevasse');
