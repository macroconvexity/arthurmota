// Legends multicolour cards, first half (see docs/CARD_MODULE_CONTRACT.md).
// Rampage / legendary landwalk are engine keywords parsed from the card text (Hunding Gjornersen, Livonya Silone need no entry).
const ref = (p) => ({ kind: 'perm', id: p.id });
const lands = (g, pid) => g.players[pid].bf.filter((p) => g.isLand(p)).length;
const upkeepPay = (cost) => (g, perm, pid) => {
  if (pid !== perm.controller) return;
  g.mayPay(pid, cost, { prompt: `Pay ${cost} to keep ${perm.card.def.name}?`, source: perm.card.id }, (paid) => { if (!paid && g.perm(perm.id)) g.sacrifice(perm); });
};
const dropMods = (perm, tag) => { perm.mods = perm.mods.filter((m) => m.tag !== tag); };
const beforeDamage = (g) => ['untap', 'upkeep', 'draw', 'main1', 'attackers', 'blockers'].includes(g.step);
const combatant = { kind: 'perm', test: (g, p) => g.isCreature(p) && (g.combat.attackers.includes(p.id) || Object.values(g.combat.blocks).some((b) => b.includes(p.id))) };

export const EFFECTS = {};
export const ABILITIES = {
  'Ayesha Tanaka': [{ cost: { tap: true }, targets: ['artifactAbility'], ai: 'counter', text: "Counter target activated ability from an artifact source unless that ability's controller pays {W}.",
    resolve: (g, it) => {
      const ab = g.stack.find((s) => s.id === it.targets[0].id); if (!ab) return;
      g.mayPay(ab.controller, '{W}', { prompt: 'Pay {W} or the ability is countered?', source: it.source.card.id }, (paid) => { if (!paid) g.counterAbility(it.targets[0]); });
    } }],
  'Adun Oakenshield': [{ cost: { tap: true, mana: '{B}{R}{G}' }, targets: ['myGraveyardCreature'], ai: 'utility', text: 'Return target creature card from your graveyard to your hand.',
    resolve: (g, it) => { const pl = g.players[it.controller]; const c = pl.gy.find((x) => x.id === it.targets[0].id); if (c) { pl.gy = pl.gy.filter((x) => x !== c); pl.hand.push(c); g.say(`${pl.name} returns ${c.def.name} to hand.`); } } }],
  'Angus Mackenzie': [{ cost: { tap: true, mana: '{G}{W}{U}' }, targets: [], timing: (g) => beforeDamage(g), ai: 'utility', text: 'Prevent all combat damage that would be dealt this turn. Activate only before the combat damage step.',
    resolve: (g) => g.preventCombatDamage() }],
  'Arcades Sabboth': [{ cost: { mana: '{W}' }, ai: 'pump', text: '+0/+1 until end of turn.', resolve: (g, it) => g.addMod(it.source, { t: 1 }) }],
  'Boris Devilboon': [{ cost: { tap: true, mana: '{2}{B}{R}' }, ai: 'utility', text: 'Create a 1/1 black and red Demon creature token named Minor Demon.',
    resolve: (g, it) => g.createToken(it.controller, { name: 'Minor Demon', power: 1, toughness: 1, types: ['Creature'], subtypes: ['Demon'], colors: ['B', 'R'] }) }],
  'Gwendlyn Di Corci': [{ cost: { tap: true }, targets: ['player'], timing: 'myTurn', ai: 'discard', text: 'Target player discards a card at random. Activate only during your turn.',
    resolve: (g, it) => g.discardRandom(it.targets[0].id) }],
  'Kei Takahashi': [{ cost: { tap: true }, targets: ['creature'], ai: 'utility', text: 'Prevent the next 2 damage that would be dealt to target creature this turn.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t) g.preventDamage(ref(t), 2, { until: 'eot' }); } }],
  'Lady Caleria': [{ cost: { tap: true }, targets: [combatant], ai: 'removal', text: 'Lady Caleria deals 3 damage to target attacking or blocking creature.',
    resolve: (g, it) => g.damage(it.source, it.targets[0], 3) }],
  'Lady Evangela': [{ cost: { tap: true, mana: '{W}{B}' }, targets: ['creature'], ai: 'utility', text: 'Prevent all combat damage that would be dealt by target creature this turn.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t) g.preventDamage(null, Infinity, { sourceId: t.card.id, combatOnly: true }); } }],
};
export const TRIGGERS = {
  'Arcades Sabboth': { onUpkeep: upkeepPay('{G}{W}{U}') },
  'Chromium': { onUpkeep: upkeepPay('{W}{U}{B}') },
  'Axelrod Gunnarson': {
    onCreatureDies: (g, perm, dead) => {
      if (dead === perm || !dead.damagedBy?.includes(perm.card.id)) return;
      g.gainLife(perm.controller, 1);
      const opp = 1 - perm.controller;
      g.ask(perm.controller, { type: 'pick', prompt: 'Axelrod Gunnarson: 1 damage to which player?', options: [{ value: opp, label: g.players[opp].name, score: 1 }, { value: perm.controller, label: g.players[perm.controller].name, score: 0 }], min: 1, max: 1, source: perm.card.id },
        ([pid]) => g.damage(perm, { kind: 'player', id: pid }, 1));
    },
  },
  'Gabriel Angelfire': {
    onUpkeep: (g, perm, pid) => {
      if (pid !== perm.controller) return;
      dropMods(perm, 'gabriel');
      const opts = [['flying', 'Flying', 4], ['first strike', 'First strike', 3], ['trample', 'Trample', 2], ['rampage:3', 'Rampage 3', 1]];
      g.ask(pid, { type: 'pick', prompt: 'Gabriel Angelfire: choose an ability until your next upkeep', options: opts.map(([value, label, score]) => ({ value, label, score })), min: 1, max: 1, source: perm.card.id },
        ([k]) => g.addMod(perm, { kw: [k], until: 'myNextTurn', owner: pid, tag: 'gabriel' }));
    },
  },
  'Johan': {
    onBeginCombat: (g, perm, pid) => {
      if (pid !== perm.controller || g.active !== perm.controller || perm.tapped) return;
      g.ask(pid, { type: 'yesno', prompt: 'Johan: gain "can\'t attack" so your attackers do not tap?', source: perm.card.id, auto: false }, (yes) => {
        if (yes) g.addMod(perm, { kw: ['cantAttack'], johan: true, until: 'endCombat' });
      });
    },
  },
  'Halfdane': {
    onUpkeep: (g, perm, pid) => {
      if (pid !== perm.controller) return;
      dropMods(perm, 'halfdane');
      const others = g.allPerms().filter((p) => p !== perm && g.isCreature(p));
      if (!others.length) return;
      g.pickPerms(pid, others, { prompt: 'Halfdane: copy the power and toughness of which creature?', source: perm.card.id, score: (p) => g.power(p) + g.toughness(p) }, ([t]) => {
        if (t) g.addMod(perm, { setPT: [g.power(t), g.toughness(t)], until: 'myNextTurn', owner: pid, tag: 'halfdane' });
      });
    },
  },
  'Hazezon Tamar': {
    onEnter: (g, perm) => {
      const pid = perm.controller;
      g.delay('upkeep', () => {
        const x = lands(g, pid);
        for (let i = 0; i < x; i++) g.createToken(pid, { name: 'Sand Warrior', power: 1, toughness: 1, types: ['Creature'], subtypes: ['Sand', 'Warrior'], colors: ['R', 'G', 'W'] });
      }, { pid });
    },
    onLeave: (g) => { for (const p of g.allPerms().filter((q) => q.card.token && q.card.def.name === 'Sand Warrior')) g.exile(p); },
  },
};
// Creatures with the given walk can be blocked as though they didn't have it (all attackers, whoever controls them)
const unwalk = (...lands) => ({ negateWalk: (g, src, attacker, land) => lands.includes(land) });
export const STATIC = {
  'Gosta Dirk': unwalk('Island'),
  'Lord Magnus': unwalk('Plains', 'Forest'),
  'Johan': { affects: (g, src, t) => t.controller === src.controller && !src.tapped && src.mods.some((m) => m.johan) && g.isCreature(t), kw: 'vigilance' },
  'Arcades Sabboth': { affects: (g, src, t) => t.controller === src.controller && g.isCreature(t) && !t.tapped && !g.combat.attackers.includes(t.id), toughness: 2 },
  'Bartel Runeaxe': { cantBeEnchanted: (g, src, host) => host === src },
  'Dakkon Blackblade': { affects: (g, src, t) => t === src, setPT: (g, src) => { const n = lands(g, src.controller); return [n, n]; } },
  'Jacques le Vert': { affects: (g, src, t) => t.controller === src.controller && g.isCreature(t) && g.colors(t).includes('G'), toughness: 2 },
};
export const IMPLEMENTED = [
  'Adun Oakenshield', 'Ayesha Tanaka', 'Angus Mackenzie', 'Arcades Sabboth', 'Axelrod Gunnarson', 'Bartel Runeaxe', 'Boris Devilboon', 'Chromium', 'Dakkon Blackblade', 'Gabriel Angelfire',
  'Gwendlyn Di Corci', 'Halfdane', 'Hazezon Tamar', 'Gosta Dirk', 'Lord Magnus', 'Johan', 'Jacques le Vert', 'Kei Takahashi', 'Lady Caleria', 'Lady Evangela',
  // vanilla legends (no rules text)
  'Barktooth Warbeard', 'Jasmine Boreal', 'Jedit Ojanen', 'Jerrard of the Closed Fist', 'Kasimir the Lone Wolf', 'Lady Orca',
];
