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
