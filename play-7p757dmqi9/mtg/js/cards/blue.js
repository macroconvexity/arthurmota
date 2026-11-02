// Card module: blue. See docs/CARD_MODULE_CONTRACT.md.
const mvOf = (s) => (s.card.def.manaValue || 0) + (s.x || 0) * ((s.card.def.manaCost?.match(/\{X\}/g) || []).length);
const hasIsland = (g, pid) => g.players[pid].bf.some((p) => g.hasSubtype(p, 'Island'));
const sacNoIsland = (g, perm) => { if (!hasIsland(g, perm.controller)) { g.say(`${perm.card.def.name}: no Islands.`); g.sacrifice(perm); } };
const islandAttack = { canAttackPlayer: (g, perm, def) => hasIsland(g, def), onState: sacNoIsland };

export const EFFECTS = {
  'Ancestral Recall': { targets: ['player'], ai: 'draw', text: 'Target player draws three cards.', resolve: (g, it) => g.draw(it.targets[0].id, 3) },
  'Counterspell': { targets: ['spell'], ai: 'counter', text: 'Counter target spell.', resolve: (g, it) => g.counterSpell(it.targets[0]) },
  'Psionic Blast': {
    targets: ['any'], ai: 'burn', text: 'Psionic Blast deals 4 damage to any target and 2 damage to you.',
    resolve: (g, it) => { g.damage(it, it.targets[0], 4); g.damage(it, { kind: 'player', id: it.controller }, 2); },
  },
  'Unsummon': {
    targets: ['creature'], ai: 'removal', text: "Return target creature to its owner's hand.",
    resolve: (g, it) => { const p = g.perm(it.targets[0]); if (!p) return; g.say(`${p.card.def.name} returns to its owner's hand.`); g.leave(p, 'hand'); },
  },
  'Mana Short': {
    targets: ['player'], ai: 'utility', text: 'Tap all lands target player controls and that player loses all unspent mana.',
    resolve: (g, it) => {
      const pl = g.players[it.targets[0].id];
      for (const p of pl.bf) if (g.isLand(p)) p.tapped = true;
      pl.pool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
      g.say(`${pl.name}'s lands are tapped and their mana is lost.`);
    },
  },
  'Timetwister': {
    targets: [], ai: 'draw', text: 'Each player shuffles their hand and graveyard into their library, then draws seven cards.',
    resolve: (g) => {
      for (const pl of g.players) {
        pl.library.push(...pl.hand.splice(0), ...pl.gy.splice(0));
        g.shuffle(pl.library);
        g.draw(pl.id, 7);
      }
    },
  },
  "Hurkyl's Recall": {
    targets: ['player'], ai: 'utility', text: 'Return all artifacts target player owns to their hand.',
    resolve: (g, it) => {
      const owner = it.targets[0].id;
      for (const pl of g.players) for (const p of [...pl.bf]) if (p.card.owner === owner && p.card.def.types.includes('Artifact')) g.leave(p, 'hand');
      g.say(`Artifacts owned by ${g.players[owner].name} return to hand.`);
    },
  },
  'Time Walk': { targets: [], ai: 'utility', text: 'Take an extra turn after this one.', resolve: (g, it) => g.extraTurn(it.controller) },
  'Braingeyser': { targets: ['player'], x: true, ai: 'draw', text: 'Target player draws X cards.', resolve: (g, it) => g.draw(it.targets[0].id, it.x) },
  'Spell Blast': {
    targets: ['spell'], x: true, ai: 'counter', text: 'Counter target spell with mana value X.',
    resolve: (g, it) => { const s = g.stack.find((q) => q.id === it.targets[0].id); if (s && mvOf(s) === it.x) g.counterSpell(it.targets[0]); },
  },
  'Power Sink': {
    targets: ['spell'], x: true, ai: 'counter', text: "Counter target spell unless its controller pays {X}. If that player doesn't, they tap all lands with mana abilities they control and lose all unspent mana.",
    resolve: (g, it) => {
      const s = g.stack.find((q) => q.id === it.targets[0].id); if (!s) return;
      const pid = s.controller;
      g.mayPay(pid, `{${it.x}}`, { prompt: `Pay {${it.x}} or ${s.card.def.name} is countered?`, source: it.card.id }, (paid) => {
        if (paid) return;
        g.counterSpell(it.targets[0]);
        for (const p of g.players[pid].bf) if (g.isLand(p) && g.abilitiesOf(p).some((a) => a.mana)) g.tap(p, true);
        g.players[pid].pool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
      });
    },
  },
  'Blue Elemental Blast': {
    targets: [], ai: 'counter', text: 'Choose one - Counter target red spell; or destroy target red permanent.',
    modes: [{ text: 'Counter target red spell.', targets: ['redSpell'] }, { text: 'Destroy target red permanent.', targets: ['redPermanent'] }],
    resolve: (g, it) => { if (it.mode === 0) g.counterSpell(it.targets[0]); else g.destroy(g.perm(it.targets[0])); },
  },
  'Twiddle': {
    targets: ['artifactCreatureOrLand'], ai: 'utility', text: 'You may tap or untap target artifact, creature, or land.',
    resolve: (g, it) => {
      const p = g.perm(it.targets[0]); if (!p) return;
      const options = [{ value: 'tap', label: 'Tap', score: 0 }, { value: 'untap', label: 'Untap', score: 0 }];
      const auto = [p.controller === it.controller ? 'untap' : 'tap'];
      g.ask(it.controller, { type: 'pick', prompt: `Tap or untap ${p.card.def.name}?`, options, min: 0, max: 1, source: it.card.id, auto }, ([c]) => { if (c === 'tap') g.tap(p); else if (c === 'untap') g.untapPerm(p); });
    },
  },
  'Jump': { targets: ['creature'], ai: 'pump', text: 'Target creature gains flying until end of turn.', resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { kw: 'flying' }) },
  'Reconstruction': {
    targets: ['artifactCardInYourGraveyard'], ai: 'utility', text: 'Return target artifact card from your graveyard to your hand.',
    resolve: (g, it) => {
      const c = g.findCard(it.targets[0].id), pl = g.players[it.controller];
      if (!c || !pl.gy.includes(c)) return;
      pl.gy = pl.gy.filter((x) => x !== c); pl.hand.push(c); g.say(`${c.def.name} returns to ${pl.name}'s hand.`);
    },
  },
  'Drain Power': {
    targets: ['player'], ai: 'utility', text: 'Target player activates a mana ability of each land they control. Then that player loses all unspent mana and you add the mana lost this way.',
    resolve: (g, it) => g.drainMana(it.targets[0].id, it.controller),
  },
  'Thoughtlace': {
    targets: [], ai: 'utility', text: 'Target spell or permanent becomes blue.',
    modes: [{ text: 'Target spell becomes blue.', targets: ['spell'] }, { text: 'Target permanent becomes blue.', targets: ['permanent'] }],
    resolve: (g, it) => {
      if (it.mode === 0) { const s = g.stack.find((q) => q.id === it.targets[0].id); if (s) s.colorOverride = ['U']; }
      else { const p = g.perm(it.targets[0]); if (p) { p.colorOverride = ['U']; g.emit({ type: 'buff', id: p.id }); } }
    },
  },
  'Volcanic Eruption': {
    targets: [], x: true, ai: 'sweeper', text: 'Destroy X target Mountains. Volcanic Eruption deals damage to each creature and each player equal to the number of Mountains put into a graveyard this way.',
    multi: { spec: { kind: 'perm', test: (g, c) => g.hasSubtype(c, 'Mountain') }, min: 'x', max: 'x' },
    resolve: (g, it) => {
      let n = 0;
      for (const t of it.targets) { const p = g.perm(t); if (!p) continue; const c = p.card; g.destroy(p); if (g.players[c.owner].gy.includes(c)) n++; }
      if (n <= 0) return;
      for (const pl of g.players) for (const p of [...pl.bf]) if (g.isCreature(p)) g.damage(it, { kind: 'perm', id: p.id }, n);
      for (const pl of g.players) g.damage(it, { kind: 'player', id: pl.id }, n);
    },
  },
  "Siren's Call": {
    targets: [], ai: 'utility', text: "Cast only during an opponent's turn, before attackers are declared. Creatures the active player controls attack this turn if able. At the beginning of the next end step, destroy all non-Wall creatures that player controls that didn't attack this turn.",
    castWhen: (g, pid) => g.active !== pid && ['untap', 'upkeep', 'draw', 'main1'].includes(g.step),
    resolve: (g) => {
      const ap = g.active;
      const set = g.players[ap].bf.filter((p) => g.isCreature(p));
      for (const p of set) g.addMod(p, { kw: 'mustAttack' });
      const cont = set.filter((p) => !p.sick); // controlled continuously since the turn began
      g.delay('end', () => {
        for (const p of cont) if (g.perm(p) && p.controller === ap && g.isCreature(p) && !g.hasSubtype(p, 'Wall') && !g.attackedThisTurn(p)) g.destroy(p);
      }, { pid: ap });
    },
  },
};

export const ABILITIES = {
  'Prodigal Sorcerer': [{ cost: { tap: true }, targets: ['any'], ai: 'burn', text: '{T}: 1 damage to any target.', resolve: (g, it) => g.damage(it, it.targets[0], 1) }],
  'Pirate Ship': [{ cost: { tap: true }, targets: ['any'], ai: 'burn', text: '{T}: 1 damage to any target.', resolve: (g, it) => g.damage(it, it.targets[0], 1) }],
  'Wall of Water': [{ cost: { mana: '{U}' }, ai: 'pump', text: '{U}: +1/+0 until end of turn.', resolve: (g, it) => g.addMod(it.source, { p: 1 }) }],
};

const vesuvan = (g, perm, why) => {
  const cs = g.allPerms().filter((p) => p !== perm && g.isCreature(p));
  if (!cs.length) return;
  g.pickPerms(perm.controller, cs, { prompt: why, min: 0, max: 1, score: (p) => g.power(p) + g.toughness(p), source: perm.card.id }, ([p]) => {
    if (p) g.becomeCopy(perm, p.card.def, { keepColors: true, colors: ['U'], extraTriggers: { onUpkeep: vesuvanUpkeep } });
  });
};
const vesuvanUpkeep = (g, perm, pid) => { if (pid === perm.controller && perm.card.def.name !== 'Vesuvan Doppelganger') vesuvan(g, perm, 'Become a copy of a creature?'); };

export const TRIGGERS = {
  'Vesuvan Doppelganger': {
    onEnter: (g, perm) => vesuvan(g, perm, 'Enter as a copy of a creature?'),
    onUpkeep: (g, perm, pid) => { if (pid === perm.controller) vesuvan(g, perm, 'Become a copy of a creature?'); },
  },
  'Clone': {
    onEnter: (g, perm) => {
      const cs = g.allPerms().filter((p) => p !== perm && g.isCreature(p));
      if (!cs.length) return;
      g.pickPerms(perm.controller, cs, { prompt: 'Enter as a copy of a creature?', min: 0, max: 1, score: (p) => g.power(p) + g.toughness(p), source: perm.card.id }, ([p]) => { if (p) g.becomeCopy(perm, p.card.def); });
    },
  },
  'Phantasmal Forces': {
    onUpkeep: (g, perm, pid) => { if (pid === perm.controller) g.mayPay(pid, '{U}', { prompt: 'Pay {U} to keep Phantasmal Forces?', source: perm.card.id }, (paid) => { if (!paid) g.sacrifice(perm); }); },
  },
  'Serendib Efreet': {
    onUpkeep: (g, perm, pid) => { if (pid === perm.controller) g.damage(perm, { kind: 'player', id: pid }, 1); },
  },
  'Island Fish Jasconius': {
    ...islandAttack,
    onUpkeep: (g, perm, pid) => {
      if (pid !== perm.controller || !perm.tapped) return;
      g.mayPay(pid, '{U}{U}{U}', { prompt: 'Pay {U}{U}{U} to untap Island Fish Jasconius?', source: perm.card.id }, (paid) => { if (paid) g.untapPerm(perm); });
    },
  },
  'Pirate Ship': islandAttack,
  'Sea Serpent': islandAttack,
};
export const STATIC = {
  'Lord of Atlantis': { affects: (g, src, t) => t !== src && g.hasSubtype(t, 'Merfolk'), power: 1, toughness: 1, kw: 'islandwalk' },
  'Island Fish Jasconius': { noUntap: (g, src, perm) => perm === src },
};
export const IMPLEMENTED = [
  'Air Elemental', 'Wall of Air', 'Vesuvan Doppelganger', 'Lord of Atlantis', 'Clone', 'Sea Serpent', 'Merfolk of the Pearl Trident', 'Mahamoti Djinn', 'Phantom Monster', 'Water Elemental',
  ...Object.keys(EFFECTS), ...Object.keys(ABILITIES), ...Object.keys(TRIGGERS),
];
