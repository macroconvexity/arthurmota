// Card module: green. See docs/CARD_MODULE_CONTRACT.md.
const allPerms = (g) => g.players.flatMap((pl) => [...pl.bf]);

const GREEN = ['G'];
const forests = (g, pid) => g.players[pid].bf.filter((p) => g.isLand(p) && g.hasSubtype(p, 'Forest')).length;
const mkMana = () => ({ cost: { tap: true }, mana: { colors: GREEN, amount: 1 } });

export const EFFECTS = {
  'Giant Growth': { targets: ['creature'], ai: 'pump', text: '+3/+3', resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { p: 3, t: 3 }) },
  'Ice Storm': { targets: ['land'], ai: 'landhate', text: 'Destroy target land.', resolve: (g, it) => g.destroy(g.perm(it.targets[0])) },
  'Tsunami': {
    targets: [], ai: 'landhate', text: 'Destroy all Islands.',
    resolve: (g) => { for (const p of allPerms(g)) if (g.isLand(p) && (p.card.def.subtypes || []).includes('Island')) g.destroy(p); },
  },
  'Tranquility': {
    targets: [], ai: 'sweeper', text: 'Destroy all enchantments.',
    resolve: (g) => { for (const p of allPerms(g)) if (p.card.def.types.includes('Enchantment')) g.destroy(p); },
  },
  'Channel': { targets: [], ai: 'ramp', text: 'Until end of turn, you may pay 1 life instead of {1} (engine: never to 0 life).', resolve: (g, it) => g.addPlayerMod(it.controller, { channel: true }) },
  'Fog': { targets: [], ai: 'utility', text: 'Prevent all combat damage that would be dealt this turn.', resolve: (g) => g.preventCombatDamage() },
  'Stream of Life': { targets: ['player'], x: true, ai: 'heal', text: 'Target player gains X life.', resolve: (g, it) => g.gainLife(it.targets[0].id, it.x || 0) },
  'Hurricane': {
    targets: [], x: true, ai: 'sweeper', text: 'Hurricane deals X damage to each creature with flying and each player.',
    resolve: (g, it) => {
      const x = it.x || 0; if (x <= 0) return;
      const fliers = allPerms(g).filter((p) => g.isCreature(p) && g.kw(p).has('flying'));
      for (const p of fliers) g.damage(it, { kind: 'perm', id: p.id }, x);
      for (const pl of g.players) g.damage(it, { kind: 'player', id: pl.id }, x);
    },
  },
  'Regrowth': {
    targets: ['myGraveyardCard'], ai: 'utility', text: 'Return target card from your graveyard to your hand.',
    resolve: (g, it) => {
      const pl = g.players[it.controller]; const c = pl.gy.find((x) => x.id === it.targets[0].id); if (!c) return;
      pl.gy = pl.gy.filter((x) => x !== c); pl.hand.push(c); g.say(`${pl.name} returns ${c.def.name} to hand.`);
    },
  },
  'Desert Twister': { targets: ['permanent'], ai: 'removal', text: 'Destroy target permanent.', resolve: (g, it) => g.destroy(g.perm(it.targets[0])) },
  'Crumble': {
    targets: ['artifact'], ai: 'removal', text: "Destroy target artifact. It can't be regenerated. Its controller gains life equal to its mana value.",
    resolve: (g, it) => {
      const p = g.perm(it.targets[0]); if (!p) return;
      const owner = p.controller, mv = p.card.def.manaValue || 0;
      g.destroy(p, { noRegen: true }); g.gainLife(owner, mv);
    },
  },
  'Berserk': {
    targets: ['creature'], ai: 'pump',
    castWhen: (g) => ['upkeep', 'draw', 'main1', 'attackers', 'blockers'].includes(g.step),
    text: 'Target creature gains trample and +X/+0 where X is its power. Destroy it at the next end step if it attacked this turn.',
    resolve: (g, it) => {
      const p = g.perm(it.targets[0]); if (!p) return;
      g.addMod(p, { p: g.power(p), kw: 'trample' });
      g.delay('end', (gg) => { if (gg.perm(p.id) && gg.attackedThisTurn(p)) gg.destroy(p); });
    },
  },
  'Natural Selection': {
    targets: ['player'], ai: 'utility', text: "Look at the top three cards of target player's library, put them back in any order. You may have that player shuffle.",
    resolve: (g, it) => {
      const tp = it.targets[0].id, lib = g.players[tp].library, me = it.controller;
      const top = lib.splice(Math.max(0, lib.length - 3), 3); // top card = end of array
      const placed = []; // first placed = new top
      const step = () => {
        if (top.length <= 1) { placed.push(...top); lib.push(...placed.reverse()); return g.ask(me, { type: 'yesno', prompt: `Have ${g.players[tp].name} shuffle?`, auto: false }, (y) => { if (y) g.shuffleLibrary(tp); }); }
        g.pickCards(me, top, { prompt: `Choose the card to put ${placed.length ? 'next' : 'on top'}`, min: 1 }, ([c]) => { top.splice(top.indexOf(c), 1); placed.push(c); step(); });
      };
      if (!top.length) return;
      step();
    },
  },
  'Lifelace': {
    modes: [{ text: 'Target spell becomes green.', targets: ['spell'] }, { text: 'Target permanent becomes green.', targets: ['permanent'] }],
    ai: 'utility', text: 'Target spell or permanent becomes green.',
    resolve: (g, it) => {
      const t = it.targets[0];
      if (t.kind === 'spell') { const s = g.stack.find((x) => x.id === t.id); if (s) s.colorOverride = GREEN; }
      else { const p = g.perm(t); if (p) p.colorOverride = GREEN; }
    },
  },
};

export const ABILITIES = {
  'Wall of Brambles': [{ cost: { mana: '{G}' }, ai: 'utility', text: '{G}: Regenerate this creature.', resolve: (g, it) => g.regenerate(it.source) }],
  "Gaea's Liege": [{ cost: { tap: true }, targets: ['land'], ai: 'utility', text: '{T}: Target land becomes a Forest until this creature leaves the battlefield.', resolve: (g, it) => { const l = g.perm(it.targets[0]); if (l) (it.source.liegeLands ||= []).push(l.id); } }],
  'Ley Druid': [{ cost: { tap: true }, targets: ['land'], ai: 'utility', text: '{T}: Untap target land.', resolve: (g, it) => { const l = g.perm(it.targets[0]); if (l) l.tapped = false; } }],
};

const nonWallBlockKill = (g, perm, other) => {
  if (!other || g.hasSubtype(other, 'Wall')) return;
  g.delay('endCombat', (gg) => { if (gg.perm(other.id)) gg.destroy(other); });
};
const basilisk = {
  onBlock: (g, perm, attacker) => nonWallBlockKill(g, perm, attacker),
  onBlocked: (g, perm, blockers) => { for (const b of blockers) nonWallBlockKill(g, perm, b); },
};

export const TRIGGERS = {
  'Fungusaur': { onDealtDamage: (g, perm, src, n) => { if (n > 0) g.addCounters(perm, '+1/+1', 1); } },
  'Cockatrice': basilisk,
  'Thicket Basilisk': basilisk,
  'Force of Nature': {
    onUpkeep: (g, perm, pid) => {
      if (pid !== perm.controller) return;
      g.mayPay(pid, '{G}{G}{G}{G}', { prompt: 'Pay {G}{G}{G}{G} for Force of Nature?', source: perm.card.id }, (paid) => { if (!paid) g.damage(perm, { kind: 'player', id: pid }, 8); });
    },
  },
  'Verduran Enchantress': {
    onSpellCast: (g, perm, item) => {
      if (item.controller !== perm.controller || !item.card.def.types.includes('Enchantment')) return;
      g.ask(perm.controller, { type: 'yesno', prompt: 'Draw a card (Verduran Enchantress)?', source: perm.card.id, auto: true }, (y) => { if (y) g.draw(perm.controller, 1); });
    },
  },
};
export const STATIC = {
  "Gaea's Liege": [
    { affects: (g, src, t) => t === src, setPT: (g, src) => { const n = src.attacking ? forests(g, 1 - src.controller) : forests(g, src.controller); return [n, n]; } },
    // lands made Forests by the Liege's ability stay Forests only while it is on the battlefield
    { affects: (g, src, t) => (src.liegeLands || []).includes(t.id) && g.isLand(t), setSubtypes: ['Forest'], setAbilities: () => [mkMana()] },
  ],
};
// Vanilla / keyword-only creatures the engine already plays faithfully (flying, reach, first strike, defender).
export const IMPLEMENTED = [
  'Giant Growth', 'Ice Storm', 'Tsunami', 'Tranquility', 'Ley Druid',
  'Grizzly Bears', 'Craw Wurm', 'Ironroot Treefolk', 'Giant Spider', 'Elvish Archers',
  'Scryb Sprites', 'Wall of Wood', 'Wall of Ice',
  'Channel', 'Fog', 'Stream of Life', 'Hurricane', 'Regrowth', 'Desert Twister', 'Crumble', 'Berserk', 'Natural Selection', 'Lifelace',
  'Wall of Brambles', 'Fungusaur', 'Cockatrice', 'Thicket Basilisk', 'Force of Nature', 'Verduran Enchantress', "Gaea's Liege",
  'War Mammoth', 'Shanodin Dryads',
];

// ======================= Legends (LEG), mono-green =======================
const isLegendary = (p) => (p.card.def.supertypes || []).includes('Legendary');
const ref = (p) => ({ kind: 'perm', id: p.id });
const pref = (pid) => ({ kind: 'player', id: pid });
const hostOf = (g, a) => (a.attachedTo != null ? g.perm(a.attachedTo) : null);
const isAuraCard = (c) => (c.def.subtypes || []).includes('Aura');

Object.assign(EFFECTS, {
  'Avoid Fate': {
    targets: [{ kind: 'spell', test: (g, s, ctx) => (s.card.def.types.includes('Instant') || isAuraCard(s.card)) && s.targets.some((t) => t.kind === 'perm' && g.perm(t)?.controller === ctx.pid) }],
    ai: 'counter', text: 'Counter target instant or Aura spell that targets a permanent you control.', resolve: (g, it) => g.counterSpell(it.targets[0]),
  },
  'Typhoon': {
    targets: [], ai: 'burn', text: 'Typhoon deals damage to each opponent equal to the number of Islands that player controls.',
    resolve: (g, it) => {
      const o = 1 - it.controller;
      const n = g.players[o].bf.filter((p) => g.isLand(p) && g.hasSubtype(p, 'Island')).length;
      if (n > 0) g.damage(it, pref(o), n);
    },
  },
  'Untamed Wilds': {
    targets: [], ai: 'ramp', text: 'Search your library for a basic land card, put it onto the battlefield, then shuffle.',
    resolve: (g, it) => g.search(it.controller, (c) => c.def.types.includes('Land') && (c.def.supertypes || []).includes('Basic'), { to: 'bf', prompt: 'Search for a basic land', optional: true }),
  },
  'Storm Seeker': {
    targets: ['player'], ai: 'burn', text: "Deals damage to target player equal to the number of cards in that player's hand.",
    resolve: (g, it) => { const n = g.players[it.targets[0].id].hand.length; if (n > 0) g.damage(it, it.targets[0], n); },
  },
  'Winter Blast': {
    targets: [], multi: { spec: 'creature', min: 'x', max: 'x' }, x: true, ai: 'utility',
    text: 'Tap X target creatures. Winter Blast deals 2 damage to each of those creatures with flying.',
    resolve: (g, it) => {
      const ps = it.targets.map((t) => g.perm(t)).filter(Boolean);
      for (const p of ps) g.tap(p);
      for (const p of ps) if (g.perm(p.id) && g.kw(p).has('flying')) g.damage(it, ref(p), 2);
    },
  },
  'Subdue': {
    targets: ['creature'], ai: 'pump', text: 'Prevent all combat damage that would be dealt by target creature this turn. It gets +0/+X until end of turn, where X is its mana value.',
    resolve: (g, it) => {
      const p = g.perm(it.targets[0]); if (!p) return;
      g.preventDamage(null, Infinity, { sourceId: p.card.id, combatOnly: true });
      g.addMod(p, { t: p.card.def.manaValue || 0 });
    },
  },
  'Sylvan Paradise': {
    targets: [], multi: { spec: 'creature', min: 1, max: Infinity }, ai: 'utility', text: 'One or more target creatures become green until end of turn.',
    resolve: (g, it) => {
      for (const t of it.targets) {
        const p = g.perm(t); if (!p) continue;
        const prev = p.colorOverride; p.colorOverride = GREEN;
        g.delay('cleanup', () => { if (prev) p.colorOverride = prev; else delete p.colorOverride; });
      }
    },
  },
  'Eureka': {
    targets: [], ai: 'utility', text: 'Starting with you, each player may put a permanent card from their hand onto the battlefield. Repeat until no one does.',
    resolve: (g, it) => {
      const hostSpec = (c) => { const m = (c.def.text || '').split('\n')[0].toLowerCase().match(/^enchant (creature|land|artifact|enchantment)/); return m ? m[1] : null; };
      const turn = (pid, first, anyPut) => {
        if (g.winner) return;
        const hand = g.players[pid].hand;
        const opts = hand.filter((c) => !c.def.types.some((t) => t === 'Instant' || t === 'Sorcery') && (!isAuraCard(c) || (hostSpec(c) && g.validTargets(hostSpec(c), pid, null, c).some((r) => r.kind === 'perm'))));
        const nextRound = (put) => { if (put) turn(it.controller, true, false); };
        const finish = (put) => (pid === it.controller ? turn(1 - pid, false, put) : nextRound(put));
        if (!opts.length) return finish(anyPut);
        g.pickCards(pid, opts, { prompt: 'Put a permanent card from your hand onto the battlefield', min: 0, max: 1, source: it.card.id }, ([c]) => {
          if (!c) return finish(anyPut);
          if (isAuraCard(c)) {
            const hosts = g.validTargets(hostSpec(c), pid, null, c).filter((r) => r.kind === 'perm').map((r) => g.perm(r));
            return g.pickPerms(pid, hosts, { prompt: `Enchant which permanent with ${c.def.name}?`, min: 1 }, ([h]) => { g.putOntoBattlefield(c, pid, { from: 'hand', attachedTo: h.id }); finish(true); });
          }
          g.putOntoBattlefield(c, pid, { from: 'hand' }); finish(true);
        });
      };
      turn(it.controller, true, false);
    },
  },
});

Object.assign(ABILITIES, {
  'Emerald Dragonfly': [{ cost: { mana: '{G}{G}' }, ai: 'pump', text: '{G}{G}: gains first strike until end of turn.', resolve: (g, it) => g.addMod(it.source, { kw: 'first strike' }) }],
  'Killer Bees': [{ cost: { mana: '{G}' }, ai: 'pump', text: '{G}: +1/+1 until end of turn.', resolve: (g, it) => g.addMod(it.source, { p: 1, t: 1 }) }],
  'Fire Sprites': [{ cost: { tap: true, mana: '{G}' }, mana: { colors: ['R'], amount: 1 } }],
  'Pixie Queen': [{ cost: { tap: true, mana: '{G}{G}{G}' }, targets: ['creature'], ai: 'utility', text: '{G}{G}{G},{T}: Target creature gains flying until end of turn.', resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { kw: 'flying' }) }],
  'Pradesh Gypsies': [{ cost: { tap: true, mana: '{1}{G}' }, targets: ['creature'], ai: 'utility', text: '{1}{G},{T}: Target creature gets -2/-0 until end of turn.', resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { p: -2 }) }],
  'Willow Satyr': [{
    cost: { tap: true }, targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && isLegendary(p) }], ai: 'utility',
    text: '{T}: Gain control of target legendary creature for as long as you control this creature and this creature remains tapped.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t) it.source.stolen = t.id; },
  }],
});

const hornedBlock = (g, other) => { if (other && g.perm(other.id)) other.colorOverride = GREEN; };
Object.assign(TRIGGERS, {
  'Aisling Leprechaun': {
    onBlock: (g, perm, attacker) => hornedBlock(g, attacker),
    onBlocked: (g, perm, blockers) => { for (const b of blockers) hornedBlock(g, b); },
  },
  'Giant Turtle': {
    onAttack: (g, perm) => { perm.turtleAttacked = true; },
    onTurnStart: (g, perm, pid) => { if (pid === perm.controller) { perm.turtleLast = !!perm.turtleAttacked; perm.turtleAttacked = false; } },
    canAttack: (g, perm) => !perm.turtleLast || perm.turtleAttacked,
  },
  'Whirling Dervish': {
    onDealDamage: (g, perm, target) => { if (target.kind === 'player' && target.id !== perm.controller) perm.hurtOppTurn = g.turn; },
    onEndTurn: (g, perm) => { if (perm.hurtOppTurn === g.turn) g.addCounters(perm, '+1/+1', 1); },
  },
  'Willow Satyr': {
    onTurnStart: (g, perm, pid) => {
      if (pid !== perm.controller) return;
      perm.keepTapped = false;
      if (perm.tapped) g.ask(pid, { type: 'yesno', prompt: "Keep Willow Satyr tapped (it keeps control of the legendary creature)?", source: perm.card.id, auto: !!(perm.stolen && g.perm(perm.stolen)) }, (y) => { perm.keepTapped = !!y; });
    },
  },
  'Wood Elemental': {
    onEnter: (g, perm) => {
      const forestsU = g.players[perm.controller].bf.filter((p) => p !== perm && g.isLand(p) && g.hasSubtype(p, 'Forest') && !p.tapped);
      const auto = forestsU.slice(0, Math.min(3, forestsU.length)).map((p) => p.id);
      g.pickPerms(perm.controller, forestsU, { prompt: 'Sacrifice any number of untapped Forests', min: 0, max: forestsU.length, auto, source: perm.card.id }, (chosen) => {
        for (const f of chosen) g.sacrifice(f);
        perm.forestsSac = chosen.length; g.sba();
      });
    },
  },
  'Cocoon': {
    onEnter: (g, aura) => { const h = hostOf(g, aura); if (h) g.tap(h); g.addCounters(aura, 'pupa', 3); },
    onUpkeep: (g, aura, pid) => {
      if (pid !== aura.controller) return;
      if ((aura.counters?.pupa || 0) > 0) return g.addCounters(aura, 'pupa', -1);
      const h = hostOf(g, aura); g.sacrifice(aura);
      if (h && g.perm(h.id)) { g.addCounters(h, '+1/+1', 1); g.addMod(h, { kw: 'flying', until: 'forever' }); }
    },
  },
});

// Cocoon behaviour is written (TRIGGERS/STATIC) but stays locked: cards.js auraSpecOf has no 'enchant creature you control'.

const rabid = { affects: (g, s, t) => t === s, power: (g, s) => 2 * g.allPerms().filter((a) => a.attachedTo === s.id && (a.card.def.subtypes || []).includes('Aura')).length, toughness: (g, s) => 2 * g.allPerms().filter((a) => a.attachedTo === s.id && (a.card.def.subtypes || []).includes('Aura')).length };
Object.assign(STATIC, {
  'Rabid Wombat': rabid,
  'Elven Riders': { cantBlock: (g, src, blocker, attacker) => attacker === src && !g.hasSubtype(blocker, 'Wall') && !g.kw(blocker).has('flying') },
  'Wood Elemental': { affects: (g, s, t) => t === s, setPT: (g, s) => { const n = s.forestsSac ?? 1; return [n, n]; } },
  'Concordant Crossroads': { affects: (g, s, t) => g.isCreature(t), kw: 'haste' },
  'Deadfall': { affects: (g, s, t) => g.isCreature(t), removeKw: ['forestwalk'] },
  'Living Plane': { affects: (g, s, t) => t.card.def.types.includes('Land'), addTypes: ['Creature'], setPT: () => [1, 1] },
  'Cocoon': { noUntap: (g, s, perm) => perm.id === s.attachedTo && (s.counters?.pupa || 0) > 0 },
});
STATIC['Willow Satyr'] = [
  { noUntap: (g, s, perm) => perm === s && !!s.keepTapped },
  { affects: (g, s, t) => t.id === s.stolen && s.tapped && isLegendary(t), control: (g, s) => s.controller },
];

IMPLEMENTED.push(
  'Craw Giant', 'Wolverine Pack',
  'Avoid Fate', 'Typhoon', 'Untamed Wilds', 'Storm Seeker', 'Winter Blast', 'Subdue', 'Sylvan Paradise', 'Eureka',
  'Emerald Dragonfly', 'Killer Bees', 'Fire Sprites', 'Pixie Queen', 'Pradesh Gypsies', 'Willow Satyr',
  'Aisling Leprechaun', 'Giant Turtle', 'Whirling Dervish', 'Wood Elemental', 'Rabid Wombat', 'Elven Riders',
  'Concordant Crossroads', 'Deadfall', 'Living Plane',
  'Barbary Apes', 'Durkwood Boars', 'Moss Monster', 'Cat Warriors', 'Hornet Cobra',
);

// ---- Legends, second pass (engine section 13 hooks) ----
Object.assign(EFFECTS, {
  'Rust': { targets: ['artifactAbility'], ai: 'counter', text: 'Counter target activated ability from an artifact source.', resolve: (g, it) => g.counterAbility(it.targets[0]) },
  'Reincarnation': {
    targets: ['creature'], ai: 'utility', text: 'When that creature dies this turn, return a creature card from its owner\'s graveyard to the battlefield under its owner\'s control.',
    resolve: (g, it) => {
      const p = g.perm(it.targets[0]); if (!p) return;
      g.whenDies(p, (gg, dead) => {
        const owner = dead.card.owner;
        const cs = gg.players[owner].gy.filter((c) => c.def.types.includes('Creature'));
        if (!cs.length) return;
        gg.pickCards(it.controller, cs, { prompt: 'Return a creature card to the battlefield', min: 1, source: it.card.id, score: (c) => c.def.manaValue || 0 }, ([c]) => { if (c) gg.putOntoBattlefield(c, owner); });
      });
    },
  },
  'Glyph of Reincarnation': {
    targets: ['wall'], ai: 'utility', castWhen: (g) => g.step === 'main2' || g.step === 'end',
    text: 'Destroy all creatures that were blocked by target Wall this turn. They can\'t be regenerated. For each that died, put a creature card from the graveyard of the player who controlled it the last time it became blocked by that Wall onto the battlefield under its owner\'s control.',
    resolve: (g, it) => {
      const wall = g.perm(it.targets[0]); if (!wall) return;
      const last = new Map();
      for (const e of g.blockLog) if (e.blockerId === wall.id && e.turn === g.turn) last.set(e.attackerId, e.attackerController);
      const died = [];
      for (const [aid, ctrl] of last) { const a = g.perm(aid); if (a && g.destroy(a, { noRegen: true })) died.push(ctrl); }
      const next = () => {
        const pid = died.shift(); if (pid == null || g.winner) return;
        const cs = g.players[pid].gy.filter((c) => c.def.types.includes('Creature'));
        if (!cs.length) return next();
        g.pickCards(it.controller, cs, { prompt: `Return a creature card from ${g.players[pid].name}'s graveyard`, min: 1, source: it.card.id, score: (c) => c.def.manaValue || 0 }, ([c]) => { if (c) g.putOntoBattlefield(c, c.owner); next(); });
      };
      next();
    },
  },
});

Object.assign(ABILITIES, {
  'Radjan Spirit': [{ cost: { tap: true }, targets: ['creature'], ai: 'utility', text: '{T}: Target creature loses flying until end of turn.', resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { removeKw: ['flying'] }) }],
  'Shelkin Brownie': [{ cost: { tap: true }, targets: ['creature'], ai: 'utility', text: '{T}: Target creature loses all "bands with other" abilities until end of turn.', resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { removeKw: ['bandswith:*'] }) }],
  'Master of the Hunt': [{
    cost: { mana: '{2}{G}{G}' }, ai: 'utility', text: '{2}{G}{G}: Create a 1/1 green Wolf token named Wolves of the Hunt with "bands with other creatures named Wolves of the Hunt."',
    resolve: (g, it) => g.createToken(it.controller, { name: 'Wolves of the Hunt', power: 1, toughness: 1, subtypes: ['Wolf'], colors: ['G'], grant: ['bandswith:Wolves of the Hunt'] }),
  }],
});

Object.assign(TRIGGERS, {
  'Floral Spuzzem': {
    onUnblocked: (g, perm) => {
      const arts = g.players[1 - perm.controller].bf.filter((p) => g.hasType(p, 'Artifact') && !g.kw(p).has('shroud'));
      if (!arts.length) return;
      g.pickPerms(perm.controller, arts, { prompt: 'Destroy target artifact? (Floral Spuzzem then assigns no combat damage)', min: 0, max: 1, source: perm.card.id, score: (p) => p.card.def.manaValue || 0 }, ([a]) => {
        if (!a) return;
        g.destroy(a); g.addMod(perm, { noCombatDamage: true });
      });
    },
  },
  'Ichneumon Druid': {
    onSpellCast: (g, perm, item) => {
      if (item.controller === perm.controller || !item.card.def.types.includes('Instant')) return;
      const n = g.players[item.controller].spellsCast.filter((s) => s.turn === g.turn && s.types.includes('Instant')).length;
      if (n > 1) g.damage(perm, pref(item.controller), 4);
    },
  },
  'Sylvan Library': {
    onDrawStep: (g, perm, pid) => {
      if (pid !== perm.controller) return;
      g.trigger(perm, 'draw two additional cards, then pay 4 life or put each of two cards back', (gg) => {
        gg.ask(pid, { type: 'yesno', prompt: 'Sylvan Library: draw two additional cards?', source: perm.card.id, auto: true }, (yes) => {
          if (!yes) return;
          gg.draw(pid, 2);
          const pl = gg.players[pid];
          const mine = pl.hand.filter((c) => pl.drawnThisTurn.includes(c.id));
          if (!mine.length) return;
          gg.pickCards(pid, mine, { prompt: 'Choose two cards drawn this turn', min: Math.min(2, mine.length), max: Math.min(2, mine.length), source: perm.card.id, score: (c) => -(c.def.manaValue || 0) }, (chosen) => {
            const each = (i) => {
              if (i >= chosen.length || gg.winner) return;
              const c = chosen[i];
              const back = () => { pl.hand = pl.hand.filter((x) => x !== c); pl.library.push(c); gg.say(`${pl.name} puts ${c.def.name} on top of their library.`); each(i + 1); };
              if (pl.life < 4) return back();
              gg.ask(pid, { type: 'yesno', prompt: `Pay 4 life to keep ${c.def.name}? (No: put it on top of your library)`, source: perm.card.id, auto: false }, (pay) => { if (pay) { gg.loseLife(pid, 4); each(i + 1); } else back(); });
            };
            each(0);
          });
        });
      });
    },
  },
});

Object.assign(STATIC, {
  'Arboria': { cantAttack: (g, src, attacker) => !g.playerActedLastTurn(1 - attacker.controller) },
  'Revelation': { revealHand: () => true },
});

IMPLEMENTED.push('Cocoon', 'Radjan Spirit', 'Shelkin Brownie', 'Master of the Hunt', 'Floral Spuzzem', 'Ichneumon Druid', 'Arboria', 'Rust', 'Reincarnation', 'Glyph of Reincarnation', 'Revelation', 'Sylvan Library');
