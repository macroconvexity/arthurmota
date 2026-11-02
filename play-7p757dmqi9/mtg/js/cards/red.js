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
      for (const pl of g.players) { g.say(`${pl.name} discards their hand.`); pl.gy.push(...pl.hand); pl.hand = []; }
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
