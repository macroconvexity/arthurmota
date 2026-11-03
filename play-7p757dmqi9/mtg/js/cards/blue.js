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

import { auraSpecOf } from '../cards.js?v=20261102204808';

// ===================== Legends (mono-blue) =====================
const permSpec = (test) => ({ kind: 'perm', test });
const spellSpec = (test) => ({ kind: 'spell', test });
const pl = (id) => ({ kind: 'player', id });
const mvOfItem = (s) => mvOf(s);
const colorsOfSpell = (s) => s.colorOverride || s.card.def.colors || [];
const enchanted = (g, c) => g.allPerms().some((a) => a.attachedTo === c.id);
const emptyPool = () => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
const bestByMv = (g, pid, filter) => {
  const cs = g.players[pid].bf.filter(filter); if (!cs.length) return [];
  const top = Math.max(...cs.map((p) => p.card.def.manaValue || 0));
  return cs.filter((p) => (p.card.def.manaValue || 0) === top);
};
const chooseOne = (g, pid, ties, cb) => (ties.length <= 1 ? cb(ties[0] || null)
  : g.pickPerms(pid, ties, { prompt: 'Choose the permanent to exchange', min: 1, auto: [ties[0].id], source: null }, ([p]) => cb(p || ties[0])));

Object.assign(EFFECTS, {
  'Acid Rain': {
    targets: [], ai: 'landhate', text: 'Destroy all Forests.',
    resolve: (g) => { for (const p of g.allPerms()) if (g.isLand(p) && g.hasSubtype(p, 'Forest')) g.destroy(p); },
  },
  'Boomerang': { targets: ['permanent'], ai: 'removal', text: "Return target permanent to its owner's hand.", resolve: (g, it) => g.bounce(g.perm(it.targets[0])) },
  'Backfire': { targets: ['creature'], aura: true, ai: 'utility', text: "Whenever enchanted creature deals damage to you, this Aura deals that much damage to that creature's controller.", resolve: () => {} },
  'Relic Bind': { targets: [permSpec((g, c, ctx) => g.hasType(c, 'Artifact') && c.controller !== ctx.pid)], aura: true, ai: 'utility', text: 'Enchant artifact an opponent controls. Whenever enchanted artifact becomes tapped, choose one: 1 damage to target player, or target player gains 1 life.', resolve: () => {} },
  'Dream Coat': { targets: ['creature'], aura: true, ai: 'utility', text: '{0}: Enchanted creature becomes the color or colors of your choice. Activate only once each turn.', resolve: () => {} },
  'Energy Tap': {
    targets: [permSpec((g, c, ctx) => g.isCreature(c) && !c.tapped && c.controller === ctx.pid)], ai: 'ramp',
    text: "Tap target untapped creature you control. If you do, add an amount of {C} equal to that creature's mana value.",
    resolve: (g, it) => {
      const p = g.perm(it.targets[0]); if (!p || p.tapped || p.controller !== it.controller) return;
      g.tap(p); g.addMana(it.controller, 'C', p.card.def.manaValue || 0);
    },
  },
  'Flash Counter': {
    targets: [spellSpec((g, c) => c.kind === 'spell' && c.card.def.types.includes('Instant'))], ai: 'counter', text: 'Counter target instant spell.',
    resolve: (g, it) => g.counterSpell(it.targets[0]),
  },
  'Remove Soul': {
    targets: [spellSpec((g, c) => c.kind === 'spell' && c.card.def.types.includes('Creature'))], ai: 'counter', text: 'Counter target creature spell.',
    resolve: (g, it) => g.counterSpell(it.targets[0]),
  },
  'Flash Flood': {
    targets: [], ai: 'removal', text: "Choose one - Destroy target red permanent; or return target Mountain to its owner's hand.",
    modes: [
      { text: 'Destroy target red permanent.', targets: ['redPermanent'] },
      { text: "Return target Mountain to its owner's hand.", targets: [permSpec((g, c) => g.hasSubtype(c, 'Mountain'))] },
    ],
    resolve: (g, it) => { const p = g.perm(it.targets[0]); if (!p) return; if (it.mode === 0) g.destroy(p); else g.bounce(p); },
  },
  'Force Spike': {
    targets: ['spell'], ai: 'counter', text: 'Counter target spell unless its controller pays {1}.',
    resolve: (g, it) => {
      const s = g.stack.find((q) => q.id === it.targets[0].id); if (!s) return;
      g.mayPay(s.controller, '{1}', { prompt: `Pay {1} or ${s.card.def.name} is countered?`, source: it.card.id }, (paid) => { if (!paid) g.counterSpell(it.targets[0]); });
    },
  },
  'Juxtapose': {
    targets: ['player'], ai: 'utility', text: 'You and target player exchange control of the creature you each control with the greatest mana value. Then exchange control of artifacts the same way.',
    resolve: (g, it) => {
      const me = it.controller, other = it.targets[0].id; if (me === other) return;
      const swap = (filter, next) => {
        const a = bestByMv(g, me, filter), b = bestByMv(g, other, filter);
        if (!a.length || !b.length) return next?.();
        chooseOne(g, me, a, (x) => chooseOne(g, other, b, (y) => {
          if (x && y && g.perm(x) && g.perm(y)) { g.setController(x, other, { permanent: true }); g.setController(y, me, { permanent: true }); }
          next?.();
        }));
      };
      swap((p) => g.isCreature(p), () => swap((p) => g.hasType(p, 'Artifact')));
    },
  },
  'Part Water': {
    targets: [], x: true, ai: 'utility', text: 'X target creatures gain islandwalk until end of turn.',
    multi: { spec: 'creature', min: 'x', max: 'x' },
    resolve: (g, it) => { for (const t of it.targets) g.addMod(g.perm(t), { kw: 'islandwalk' }); },
  },
  'Reset': {
    targets: [], ai: 'ramp', text: 'Untap all lands you control.',
    castWhen: (g, pid) => g.active !== pid && !['untap', 'upkeep'].includes(g.step),
    resolve: (g, it) => { for (const p of g.players[it.controller].bf) if (g.isLand(p)) g.untapPerm(p); },
  },
  'Reverberation': {
    targets: [spellSpec((g, c) => c.kind === 'spell' && c.card.def.types.includes('Sorcery'))], ai: 'utility',
    text: "All damage that would be dealt this turn by target sorcery spell is dealt to that spell's controller instead.",
    resolve: (g, it) => {
      const s = g.stack.find((q) => q.id === it.targets[0].id); if (!s) return;
      let busy = false; // the redirected damage must not be prevented again by this same shield
      g.preventDamage(null, Infinity, { sourceId: s.card.id, filter: () => !busy, onPrevent: (gg, n, src) => { busy = true; try { gg.damage(src, pl(s.controller), n); } finally { busy = false; } } });
    },
  },
  "Sea Kings' Blessing": {
    targets: [], ai: 'utility', text: 'One or more target creatures become blue until end of turn.',
    multi: { spec: 'creature', min: 1, max: Infinity },
    resolve: (g, it) => {
      const ps = it.targets.map((t) => g.perm(t)).filter(Boolean);
      const prev = ps.map((p) => p.colorOverride);
      ps.forEach((p) => { p.colorOverride = ['U']; g.emit({ type: 'buff', id: p.id }); });
      g.delay('cleanup', () => ps.forEach((p, i) => { p.colorOverride = prev[i]; }));
    },
  },
  'Silhouette': {
    targets: ['creature'], ai: 'utility', text: 'Choose target creature. If a spell or ability that targets that creature would cause a source to deal damage to that creature this turn, prevent that damage.',
    resolve: (g, it) => {
      const id = it.targets[0].id;
      g.preventDamage(it.targets[0], Infinity, { filter: (src) => !!src && (src.kind === 'spell' || src.kind === 'ability') && (src.targets || []).some((t) => t.kind === 'perm' && t.id === id) });
    },
  },
  'Teleport': {
    targets: ['creature'], ai: 'pump', text: "Cast this spell only during the declare attackers step. Target creature can't be blocked this turn.",
    castWhen: (g) => g.step === 'attackers' && g.combat.attackers.length > 0,
    resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { kw: 'unblockable' }),
  },
});

Object.assign(ABILITIES, {
  'Dream Coat': [{
    cost: {}, limit: 1, ai: 'utility', text: '{0}: Enchanted creature becomes the color or colors of your choice. Activate only once each turn.',
    resolve: (g, it) => {
      const host = g.host(it.source); if (!host) return;
      const options = ['W', 'U', 'B', 'R', 'G'].map((c) => ({ value: c, label: { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c], score: 0 }));
      g.ask(it.controller, { type: 'pick', prompt: 'Choose the creature\'s new color(s)', options, min: 1, max: 5, source: it.source.card.id, auto: ['U'] }, (cs) => { host.colorOverride = [...cs]; g.emit({ type: 'buff', id: host.id }); });
    },
  }],
  'Psionic Entity': [{
    cost: { tap: true }, targets: ['any'], ai: 'burn', text: '{T}: 2 damage to any target and 3 damage to itself.',
    resolve: (g, it) => { g.damage(it, it.targets[0], 2); g.damage(it, { kind: 'perm', id: it.source.id }, 3); },
  }],
  'Time Elemental': [{
    cost: { tap: true, mana: '{2}{U}{U}' }, targets: [permSpec((g, c) => !enchanted(g, c))], ai: 'removal',
    text: "{2}{U}{U}, {T}: Return target permanent that isn't enchanted to its owner's hand.",
    resolve: (g, it) => { const p = g.perm(it.targets[0]); if (p && !enchanted(g, p)) g.bounce(p); },
  }],
  'Wall of Wonder': [{
    cost: { mana: '{2}{U}{U}' }, ai: 'pump', text: '{2}{U}{U}: +4/-4 until end of turn and can attack this turn as though it didn\'t have defender.',
    resolve: (g, it) => g.addMod(it.source, { p: 4, t: -4, kw: 'canAttack' }),
  }],
});

const timeElementalBomb = (g, perm) => g.delay('endCombat', () => {
  if (!g.perm(perm)) return;
  g.sacrifice(perm); g.damage(perm, pl(perm.controller), 5);
}, { pid: perm.controller });

Object.assign(TRIGGERS, {
  'Backfire': {
    onDamaged: (g, aura, ref, n, src) => {
      if (ref.kind !== 'player' || ref.id !== aura.controller || !src || n <= 0) return;
      const sid = src.kind === 'ability' ? src.source?.id : src.id;
      const host = g.host(aura); if (!host || sid !== host.id) return;
      g.damage(aura, pl(host.controller), n);
    },
  },
  'Brine Hag': {
    onDie: (g, perm) => {
      for (const id of perm.damagedBy || []) {
        const p = g.perm(id); if (!p || !g.isCreature(p)) continue;
        g.addMod(p, { setPT: [0, 2], until: 'forever' });
      }
    },
  },
  'Elder Spawn': {
    onUpkeep: (g, perm, pid) => {
      if (pid !== perm.controller) return;
      const fail = () => { g.say('Elder Spawn is sacrificed.'); g.sacrifice(perm); g.damage(perm, pl(pid), 6); };
      const isl = g.players[pid].bf.filter((p) => g.hasSubtype(p, 'Island'));
      if (!isl.length) return fail();
      g.pickPerms(pid, isl, { prompt: 'Sacrifice an Island, or sacrifice Elder Spawn and take 6?', min: 0, max: 1, auto: [isl[0].id], source: perm.card.id }, ([p]) => { if (p) g.sacrifice(p); else fail(); });
    },
  },
  'In the Eye of Chaos': {
    onSpellCast: (g, perm, item) => {
      if (item.kind !== 'spell' || !item.card.def.types.includes('Instant')) return;
      const mv = mvOfItem(item); if (mv <= 0) return;
      g.mayPay(item.controller, `{${mv}}`, { prompt: `Pay {${mv}} or ${item.card.def.name} is countered?`, source: perm.card.id }, (paid) => { if (!paid) g.counterSpell({ kind: 'spell', id: item.id }); });
    },
  },
  'Invoke Prejudice': {
    onSpellCast: (g, perm, item) => {
      if (item.kind !== 'spell' || item.controller === perm.controller || !item.card.def.types.includes('Creature')) return;
      const mine = new Set(g.players[perm.controller].bf.filter((p) => g.isCreature(p)).flatMap((p) => g.colors(p)));
      if (colorsOfSpell(item).some((c) => mine.has(c))) return;
      const mv = mvOfItem(item); if (mv <= 0) return;
      g.mayPay(item.controller, `{${mv}}`, { prompt: `Pay {${mv}} or ${item.card.def.name} is countered?`, source: perm.card.id }, (paid) => { if (!paid) g.counterSpell({ kind: 'spell', id: item.id }); });
    },
  },
  'Land Equilibrium': {
    onAnyEnter: (g, perm, entered) => {
      if (!g.isLand(entered) || entered.controller === perm.controller) return;
      const lands = g.players[entered.controller].bf.filter((p) => g.isLand(p));
      const mine = g.players[perm.controller].bf.filter((p) => g.isLand(p)).length;
      if (lands.length - 1 < mine) return;
      g.pickPerms(entered.controller, lands, { prompt: 'Land Equilibrium: sacrifice a land', min: 1, auto: [lands.find((p) => p.tapped)?.id ?? entered.id], source: perm.card.id }, ([p]) => { if (p) g.sacrifice(p); });
    },
  },
  'Puppet Master': {
    onHostLeave: (g, aura, host, zone) => { aura.hostInfo = { card: host.card, died: zone === 'gy' && g.isCreature(host) && !host.card.token }; },
    onLeave: (g, aura, zone) => {
      const info = aura.hostInfo; if (!info?.died || zone !== 'gy') return;
      const hp = g.players[info.card.owner];
      if (!hp.gy.includes(info.card)) return;
      hp.gy = hp.gy.filter((c) => c !== info.card); hp.hand.push(info.card);
      g.say(`${info.card.def.name} returns to its owner's hand.`);
      g.mayPay(aura.controller, '{U}{U}{U}', { prompt: 'Pay {U}{U}{U} to return Puppet Master to its owner\'s hand?', source: aura.card.id }, (paid) => {
        const ap = g.players[aura.card.owner];
        if (paid && ap.gy.includes(aura.card)) { ap.gy = ap.gy.filter((c) => c !== aura.card); ap.hand.push(aura.card); }
      });
    },
  },
  'Relic Bind': {
    onAnyTap: (g, aura, tapped) => {
      if (tapped.id !== aura.attachedTo) return;
      const host = g.host(aura); if (!host) return;
      const me = aura.controller;
      g.ask(me, { type: 'pick', prompt: 'Relic Bind: choose one', options: [{ value: 'dmg', label: 'Deal 1 damage to target player', score: 1 }, { value: 'life', label: 'Target player gains 1 life', score: 0 }], min: 1, max: 1, source: aura.card.id, auto: ['dmg'] }, ([mode]) => {
        const options = g.players.map((p) => ({ value: p.id, label: p.name, score: 0 }));
        g.ask(me, { type: 'pick', prompt: 'Choose a player', options, min: 1, max: 1, source: aura.card.id, auto: [mode === 'dmg' ? host.controller : me] }, ([pid]) => {
          if (mode === 'dmg') g.damage(aura, pl(pid), 1); else g.gainLife(pid, 1);
        });
      });
    },
  },
  'Time Elemental': {
    onAttack: (g, perm) => timeElementalBomb(g, perm),
    onBlock: (g, perm) => timeElementalBomb(g, perm),
  },
  'Venarian Gold': {
    onEnter: (g, aura) => { const h = g.host(aura); if (!h) return; g.tap(h); g.addCounters(h, 'sleep', aura.x || 0); },
    onUpkeep: (g, aura, pid) => { const h = g.host(aura); if (h && h.controller === pid && (h.counters?.sleep || 0) > 0) g.addCounters(h, 'sleep', -1); },
  },
});

Object.assign(STATIC, {
  'Elder Spawn': { cantBlock: (g, src, blocker, attacker) => attacker === src && g.colors(blocker).includes('R') },
  'Gaseous Form': {
    preventDamage: (g, src, d) => (d.combat && ((d.target.kind === 'perm' && d.target.id === src.attachedTo) || d.src?.id === src.attachedTo) ? 0 : d.n),
  },
  'Spectral Cloak': { affects: (g, src, t) => t.id === src.attachedTo && !t.tapped, kw: 'shroud' },
  'Venarian Gold': { noUntap: (g, src, perm) => perm.id === src.attachedTo && (perm.counters?.sleep || 0) > 0 },
  'Wall of Vapor': {
    preventDamage: (g, src, d) => (d.target.kind === 'perm' && d.target.id === src.id && d.src?.card && (g.combat.blocks?.[d.src.id] || []).includes(src.id) ? 0 : d.n),
  },
});

IMPLEMENTED.push(
  'Azure Drake', 'Devouring Deep', 'Segovian Leviathan', 'Zephyr Falcon',
  'Acid Rain', 'Boomerang', 'Backfire', 'Brine Hag', 'Dream Coat', 'Elder Spawn', 'Energy Tap', 'Flash Counter', 'Flash Flood', 'Force Spike',
  'Gaseous Form', 'In the Eye of Chaos', 'Invoke Prejudice', 'Juxtapose', 'Land Equilibrium', 'Part Water', 'Psionic Entity', 'Puppet Master',
  'Relic Bind', 'Remove Soul', 'Reset', 'Reverberation', "Sea Kings' Blessing", 'Silhouette', 'Spectral Cloak', 'Teleport', 'Time Elemental',
  'Venarian Gold', 'Wall of Vapor', 'Wall of Wonder',
);

// ----- Legends, second pass (engine hooks from ENGINE_API section 13) -----
const isAuraPerm = (g, c) => g.hasSubtype(c, 'Aura') && c.attachedTo != null;
const auraHostOk = (g, aura, host) => !!host && g.validTargets(auraSpecOf(aura.card.def) || 'creature', aura.controller, null, aura.card).some((r) => r.id === host.id);

Object.assign(EFFECTS, {
  'Anti-Magic Aura': { targets: ['creature'], aura: true, ai: 'utility', text: "Enchanted creature can't be the target of spells and can't be enchanted by other Auras.", resolve: () => {} },
  'Enchantment Alteration': {
    targets: [
      permSpec((g, c) => isAuraPerm(g, c) && (() => { const h = g.perm(c.attachedTo); return !!h && (g.isCreature(h) || g.isLand(h)); })()),
      permSpec((g, c, ctx) => {
        if (!ctx.targets?.length) return g.isCreature(c) || g.isLand(c); // first target not chosen yet; resolve re-checks everything
        const a = g.perm(ctx.targets[0].id); const h = a && g.perm(a.attachedTo);
        if (!h || c.id === h.id) return false;
        return (g.isCreature(h) ? g.isCreature(c) : g.isLand(c)) && auraHostOk(g, a, c);
      }),
    ],
    ai: 'utility', text: 'Attach target Aura attached to a creature or land to another permanent of that type.',
    resolve: (g, it) => {
      const a = g.perm(it.targets[0]), n = g.perm(it.targets[1]); if (!a || !n || !isAuraPerm(g, a)) return;
      const h = g.perm(a.attachedTo); if (!h || n.id === h.id) return;
      if (!(g.isCreature(h) ? g.isCreature(n) : g.isLand(h) && g.isLand(n))) return;
      if (!auraHostOk(g, a, n)) return;
      g.attach(a, n); g.say(`${a.card.def.name} moves to ${n.card.def.name}.`);
    },
  },
  'Glyph of Delusion': {
    targets: [
      permSpec((g, c) => g.isCreature(c) && g.hasSubtype(c, 'Wall')),
      permSpec((g, c, ctx) => { if (!ctx.targets?.length) return g.isCreature(c); const w = g.perm(ctx.targets[0].id); return !!w && g.isCreature(c) && (w.blockedThisTurn || []).includes(c.id); }),
    ],
    ai: 'utility', text: 'Put X glyph counters on target creature that target Wall blocked this turn, where X is the power of that blocked creature. The creature gains the glyph abilities.',
    resolve: (g, it) => {
      const w = g.perm(it.targets[0]), c = g.perm(it.targets[1]); if (!w || !c || !(w.blockedThisTurn || []).includes(c.id)) return;
      g.addCounters(c, 'glyph', g.power(c));
      if (c.glyphMod) return;
      c.glyphMod = true;
      g.addMod(c, {
        until: 'forever',
        noUntap: (gg, p) => (p.counters?.glyph || 0) > 0,
        onUpkeep: (gg, p, pid) => { if (pid === p.controller && (p.counters?.glyph || 0) > 0) gg.addCounters(p, 'glyph', -1); },
      });
    },
  },
  'Telekinesis': {
    targets: ['creature'], ai: 'utility', text: "Tap target creature. Prevent all combat damage that would be dealt by that creature this turn. It doesn't untap during its controller's next two untap steps.",
    resolve: (g, it) => {
      const p = g.perm(it.targets[0]); if (!p) return;
      g.tap(p);
      g.addMod(p, { noCombatDamage: true });
      g.preventDamage(null, Infinity, { sourceId: p.card.id, combatOnly: true }); // also covers it dealing damage as a blocker
      g.addMod(p, { noUntap: true, untapSteps: 2, until: 'forever' });
    },
  },
  'Mana Drain': {
    targets: ['spell'], ai: 'counter', text: "Counter target spell. At the beginning of your next main phase, add an amount of {C} equal to that spell's mana value.",
    resolve: (g, it) => {
      const s = g.stack.find((q) => q.id === it.targets[0].id); if (!s) return;
      const mv = mvOf(s), pid = it.controller;
      g.counterSpell(it.targets[0]);
      if (mv > 0) g.delay('main', () => g.addMana(pid, 'C', mv), { pid });
    },
  },
  'Recall': {
    targets: [], x: true, exile: true, ai: 'utility', text: 'Discard X cards, then return a card from your graveyard to your hand for each card discarded this way. Exile Recall.',
    resolve: (g, it) => {
      const pid = it.controller;
      g.discardChoice(pid, it.x, (cs) => {
        const pl = g.players[pid], k = Math.min(cs.length, pl.gy.length); if (!k) return;
        g.pickCards(pid, pl.gy, { prompt: `Return ${k} card${k > 1 ? 's' : ''} to your hand`, min: k, max: k, source: it.card.id }, (back) => {
          for (const c of back) { pl.gy = pl.gy.filter((x) => x !== c); pl.hand.push(c); g.say(`${c.def.name} returns to ${pl.name}'s hand.`); }
        });
      });
    },
  },
  'Psychic Purge': {
    targets: ['any'], ai: 'burn', text: 'Psychic Purge deals 1 damage to any target. When a spell or ability an opponent controls causes you to discard this card, that player loses 5 life.',
    resolve: (g, it) => g.damage(it, it.targets[0], 1),
  },
});
Object.assign(TRIGGERS, {
  'Psychic Purge': {
    onDiscarded: (g, card, pid, cause) => {
      if (cause && (cause.kind === 'spell' || cause.kind === 'ability') && cause.controller != null && cause.controller !== pid) g.loseLife(cause.controller, 5);
    },
  },
});
Object.assign(STATIC, {
  'Anti-Magic Aura': {
    cantBeTargeted: (g, src, target, kind) => target.id === src.attachedTo && kind === 'spell',
    cantBeEnchanted: (g, src, host, auraCard) => host.id === src.attachedTo && auraCard !== src.card,
  },
  'Field of Dreams': { revealTop: () => true },
  'Undertow': { ignoreLandwalk: (g, src, attacker, blocker, land) => land === 'Island' },
});
IMPLEMENTED.push('Anti-Magic Aura', 'Enchantment Alteration', 'Glyph of Delusion', 'Telekinesis', 'Mana Drain', 'Recall', 'Psychic Purge', 'Field of Dreams', 'Undertow');
