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
