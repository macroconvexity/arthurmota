// Legends multicolour cards, part B (see docs/CARD_MODULE_CONTRACT.md). Engine needs: docs/ENGINE_REQUESTS.md "## gold B legends".
// Marhault Elsdragon (Rampage 1) is covered by the engine's generic rampage keyword. Every gold B card is implemented.
const tapMana = (colors, amount = 1) => ({ cost: { tap: true }, mana: { colors, amount } });
const pump = (mana, p, t, text) => ({ cost: { mana }, ai: 'pump', text, resolve: (g, it) => g.addMod(it.source, { p, t }) });
const opp = (g, pid) => 1 - pid;
const isEnchanted = (g, c) => g.isCreature(c) && g.allPerms().some((a) => a.attachedTo === c.id);
const isBlocking = (g, p) => Object.values(g.combat.blocks).some((b) => b.includes(p.id));
const isAttacking = (g, p) => g.combat.attackers.includes(p.id);
// Elder Dragon cycle: "At the beginning of your upkeep, sacrifice this unless you pay <cost>."
const upkeepOrSac = (cost) => (g, perm, pid) => {
  if (pid !== perm.controller) return;
  g.mayPay(pid, cost, { prompt: `Pay ${cost} to keep ${perm.card.def.name}?`, source: perm.card.id, auto: true }, (paid) => { if (!paid && g.perm(perm.id)) g.sacrifice(perm); });
};

export const EFFECTS = {};

export const ABILITIES = {
  'Rasputin Dreamweaver': [
    { cost: { counter: 'dream' }, mana: { colors: ['C'], amount: 1 } },
    { cost: { counter: 'dream' }, ai: 'utility', text: 'Remove a dream counter: Prevent the next 1 damage that would be dealt to this creature this turn.',
      resolve: (g, it) => { if (g.perm(it.source.id)) g.preventDamage({ kind: 'perm', id: it.source.id }, 1, { until: 'eot' }); } },
  ],
  'Nebuchadnezzar': [{ cost: { tap: true, x: true }, targets: ['opponent'], timing: 'myTurn', ai: 'discard', text: '{X}, {T}: Choose a card name. Target opponent reveals X cards at random from their hand. Then that player discards all cards with that name revealed this way. Activate only during your turn.',
    resolve: (g, it) => {
      const tid = it.targets[0].id, x = it.x || 0;
      const guess = (gg) => ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'][Math.floor(gg.rng() * 5)]; // the AI cannot see the hand: it guesses a basic land
      g.nameCard(it.controller, { prompt: 'Nebuchadnezzar: choose a card name', source: it.source.card.id, auto: guess }, (name) => {
        const hand = g.players[tid].hand; const pool = [...hand]; const shown = [];
        while (shown.length < x && pool.length) shown.push(pool.splice(Math.floor(g.rng() * pool.length), 1)[0]);
        g.say(`${g.players[tid].name} reveals ${shown.map((c) => c.def.name).join(', ') || 'nothing'}.`);
        for (const c of shown) if (c.def.name === name) { g.players[tid].hand = g.players[tid].hand.filter((h) => h !== c); g.players[tid].gy.push(c); g.say(`${g.players[tid].name} discards ${c.def.name}.`); g.afterDiscard(tid, c); }
      });
    } }],
  'Princess Lucrezia': [tapMana(['U'])],
  'Riven Turnbull': [tapMana(['B'])],
  'Sunastian Falconer': [tapMana(['C'], 2)],
  'Pavel Maliki': [pump('{B}{R}', 1, 0, '{B}{R}: +1/+0 until end of turn.')],
  'Tuknir Deathlock': [{ cost: { tap: true, mana: '{R}{G}' }, targets: ['creature'], ai: 'pump', text: '{R}{G}, {T}: Target creature gets +2/+2 until end of turn.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && g.isCreature(t)) g.addMod(t, { p: 2, t: 2 }); } }],
  'Xira Arien': [{ cost: { tap: true, mana: '{B}{R}{G}' }, targets: ['player'], ai: 'draw', text: '{B}{R}{G}, {T}: Target player draws a card.', resolve: (g, it) => g.draw(it.targets[0].id, 1) }],
  'Ragnar': [{ cost: { tap: true, mana: '{G}{W}{U}' }, targets: ['creature'], ai: 'utility', text: '{G}{W}{U}, {T}: Regenerate target creature.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && g.isCreature(t)) g.regenerate(t); } }],
  'Ramses Overdark': [{ cost: { tap: true }, targets: [{ kind: 'perm', test: isEnchanted }], ai: 'removal', text: '{T}: Destroy target enchanted creature.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && isEnchanted(g, t)) g.destroy(t); } }],
  'Tor Wauki': [{ cost: { tap: true }, targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && (isAttacking(g, p) || isBlocking(g, p)) }], ai: 'removal',
    text: '{T}: Tor Wauki deals 2 damage to target attacking or blocking creature.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && g.isCreature(t) && (isAttacking(g, t) || isBlocking(g, t))) g.damage(it.source, { kind: 'perm', id: t.id }, 2); } }],
  'Tetsuo Umezawa': [{ cost: { tap: true, mana: '{U}{B}{B}{R}' }, targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && (p.tapped || isBlocking(g, p)) }], ai: 'removal',
    text: '{U}{B}{B}{R}, {T}: Destroy target tapped or blocking creature.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && g.isCreature(t) && (t.tapped || isBlocking(g, t))) g.destroy(t); } }],
  'Vaevictis Asmadi': ['{B}', '{R}', '{G}'].map((m) => pump(m, 1, 0, `${m}: +1/+0 until end of turn.`)),
  'Rubinia Soulsinger': [{ cost: { tap: true }, targets: ['creature'], ai: 'removal', text: '{T}: Gain control of target creature for as long as you control Rubinia Soulsinger and it remains tapped.',
    resolve: (g, it) => { const t = g.perm(it.targets[0]); const s = it.source; if (t && g.isCreature(t) && g.perm(s.id) && s.tapped) { s.stolenId = t.id; g.ver++; g.sba(); } } }],
};

export const TRIGGERS = {
  'Rasputin Dreamweaver': {
    onEnter: (g, perm) => { g.addCounters(perm, 'dream', 7); },
    onTurnStart: (g, perm, pid) => { if (pid === perm.controller) perm.startedUntapped = !perm.tapped; },
    onUpkeep: (g, perm, pid) => { if (pid === perm.controller && perm.startedUntapped && (perm.counters.dream || 0) < 7) g.addCounters(perm, 'dream', 1); },
  },
  'Nicol Bolas': {
    onUpkeep: upkeepOrSac('{U}{B}{R}'),
    onDealDamage: (g, perm, ref, n) => {
      if (n > 0 && ref.kind === 'player' && ref.id !== perm.controller) { g.say(`${g.players[ref.id].name} discards their hand.`); while (g.players[ref.id].hand.length) g.discardRandom(ref.id); }
    },
  },
  'Palladia-Mors': { onUpkeep: upkeepOrSac('{R}{G}{W}') },
  'Vaevictis Asmadi': { onUpkeep: upkeepOrSac('{B}{R}{G}') },
  "Sol'kanar the Swamp King": { onSpellCast: (g, perm, item) => { if (g.srcColors(item).includes('B')) g.gainLife(perm.controller, 1); } },
  'Rohgahh of Kher Keep': { onUpkeep: (g, perm, pid) => {
    if (pid !== perm.controller) return;
    g.mayPay(pid, '{R}{R}{R}', { prompt: 'Pay {R}{R}{R} or Rohgahh and the Kobolds of Kher Keep go to your opponent?', source: perm.card.id, auto: true }, (paid) => {
      if (paid || !g.perm(perm.id)) return;
      const group = g.allPerms().filter((p) => p === perm || (g.isCreature(p) && p.card.def.name === 'Kobolds of Kher Keep'));
      for (const p of group) if (!p.tapped) g.tap(p);
      for (const p of group) g.setController(p, opp(g, pid), { permanent: true });
    });
  } },
  'Stangg': {
    onEnter: (g, perm) => {
      const tok = g.createToken(perm.controller, { name: 'Stangg Twin', power: 3, toughness: 4, types: ['Creature'], subtypes: ['Human', 'Warrior'], colors: ['R', 'G'], type: 'Legendary Creature — Human Warrior' });
      tok.card.def.supertypes = ['Legendary'];
      perm.twinId = tok.id; tok.twinOf = perm.id;
    },
    onLeave: (g, perm) => { const t = g.perm(perm.twinId); if (t) g.exile(t); },
  },
  'Stangg Twin': { onLeave: (g, perm) => { const s = g.perm(perm.twinOf); if (s && s.twinId === perm.id) g.sacrifice(s); } },
  'Rubinia Soulsinger': {
    onUntap: (g, perm) => { perm.stolenId = null; },
    // the untap step holds her (noUntap) while she controls a creature; this is the "you may" choice, made right after it
    onUntapStep: (g, perm, pid) => {
      if (pid !== perm.controller || !perm.tapped || perm.stolenId == null || !g.perm(perm.stolenId)) return;
      g.ask(pid, { type: 'yesno', prompt: 'Untap Rubinia Soulsinger? (No keeps control of the stolen creature)', source: perm.card.id, auto: false }, (yes) => { if (yes) g.untapPerm(perm); });
    },
  },
};

export const STATIC = {
  'Ur-Drago': { ignoreLandwalk: (g, src, attacker, blocker, land) => land === 'Swamp' },
  'Rohgahh of Kher Keep': { affects: (g, src, t) => g.isCreature(t) && t.controller === src.controller && t.card.def.name === 'Kobolds of Kher Keep', power: 2, toughness: 2 },
  'Tetsuo Umezawa': { cantBeEnchanted: (g, src, host) => host === src },
  'Rubinia Soulsinger': [
    { affects: (g, src, t) => src.stolenId === t.id && src.tapped, control: (g, src) => src.controller },
    { noUntap: (g, src, p) => p === src && src.tapped && src.stolenId != null && !!g.perm(src.stolenId) },
  ],
};

export const IMPLEMENTED = [
  'Nebuchadnezzar', 'Rasputin Dreamweaver', 'Ur-Drago', 'Nicol Bolas', 'Palladia-Mors', 'Pavel Maliki', 'Princess Lucrezia', 'Ragnar', 'Ramirez DePietro', 'Ramses Overdark', 'Riven Turnbull',
  'Rohgahh of Kher Keep', 'Rubinia Soulsinger', 'Sir Shandlar of Eberyn', 'Sivitri Scarzam', "Sol'kanar the Swamp King", 'Stangg', 'Sunastian Falconer',
  'Tetsuo Umezawa', 'The Lady of the Mountain', 'Tobias Andrion', 'Tor Wauki', 'Torsten Von Ursus', 'Tuknir Deathlock', 'Vaevictis Asmadi', 'Xira Arien',
];
