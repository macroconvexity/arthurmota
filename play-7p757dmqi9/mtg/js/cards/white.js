// Card module: white. See docs/CARD_MODULE_CONTRACT.md and docs/ENGINE_API.md.
// White enchantments/auras (Crusade, Wards, Circles of Protection, ...) live in enchantments.js.
export const EFFECTS = {};      // instants / sorceries (and spell-like effects)
export const ABILITIES = {};    // activated abilities (mana and non-mana)
export const TRIGGERS = {};     // triggered abilities keyed by event
export const STATIC = {};       // continuous effects while on the battlefield
export const IMPLEMENTED = [];  // keyword-only white cards (Savannah Lions, Serra Angel, ...) already pass the generic check

const done = (...n) => IMPLEMENTED.push(...n);
const pl = (id) => ({ kind: 'player', id });
const pr = (p) => ({ kind: 'perm', id: p.id });
const lands = (g, pid) => g.players[pid].bf.filter((p) => g.isLand(p));
const creatures = (g, pid) => g.players[pid].bf.filter((p) => g.isCreature(p));

// ---------- sorceries ----------
EFFECTS['Armageddon'] = {
  targets: [], ai: 'sweeper', text: 'Destroy all lands.',
  resolve(g) { for (const p of g.players) for (const l of lands(g, p.id)) g.destroy(l); },
};

// Balance: counts are fixed first, then each player chooses what to sacrifice / discard (lands, then cards, then creatures).
EFFECTS['Balance'] = {
  targets: [], ai: 'sweeper', text: 'Players equalise lands, hand size and creatures to the lowest count.',
  resolve(g, it) {
    const min = (f) => Math.min(...g.players.map((p) => f(p.id)));
    const nL = min((i) => lands(g, i).length), nH = min((i) => g.players[i].hand.length), nC = min((i) => creatures(g, i).length);
    const order = [it.controller, 1 - it.controller];
    const sacrifice = (list, keep, pid, value, label, next) => {
      const n = list.length - keep; if (n <= 0) return next();
      g.pickPerms(pid, list, { prompt: `Sacrifice ${n} ${label}`, min: n, score: (p) => -value(p), source: it.card.id }, (ps) => { for (const p of ps) g.sacrifice(p); next(); });
    };
    const discard = (pid, next) => {
      const h = g.players[pid].hand; const n = h.length - nH; if (n <= 0) return next();
      g.pickCards(pid, h, { prompt: `Discard ${n} card${n > 1 ? 's' : ''}`, min: n, score: (c) => -(c.def.manaValue || 0), source: it.card.id }, (cs) => {
        const p = g.players[pid]; for (const c of cs) { p.hand = p.hand.filter((x) => x !== c); p.gy.push(c); g.say(`${p.name} discards ${c.def.name}.`); } next();
      });
    };
    const val = (p) => g.power(p) + g.toughness(p) + (p.card.def.manaValue || 0) / 100;
    const chain = [];
    for (const pid of order) chain.push((nx) => sacrifice(lands(g, pid), nL, pid, (p) => (p.tapped ? 0 : 1), 'lands', nx));
    for (const pid of order) chain.push((nx) => discard(pid, nx));
    for (const pid of order) chain.push((nx) => sacrifice(creatures(g, pid), nC, pid, val, 'creatures', nx));
    const run = (i) => { if (i < chain.length) chain[i](() => run(i + 1)); else g.sba(); };
    run(0);
  },
};
EFFECTS['Resurrection'] = {
  targets: ['myGraveyardCreature'], ai: 'utility', text: 'Return target creature card from your graveyard to the battlefield.',
  resolve(g, it) { const c = g.findCard(it.targets[0].id); if (c && g.players[c.owner].gy.includes(c)) g.reanimate(it.controller, c); },
};

// ---------- instants ----------
// Overrides of base entries in cards.js: Swords gives life to the creature's controller; Wrath says "can't be regenerated".
EFFECTS['Swords to Plowshares'] = {
  targets: ['creature'], ai: 'removal', text: 'Exile target creature. Its controller gains life equal to its power.',
  resolve(g, it) { const p = g.perm(it.targets[0]); if (!p) return; const n = g.power(p), c = p.controller; g.exile(p); g.gainLife(c, n); },
};
EFFECTS['Wrath of God'] = {
  targets: [], ai: 'sweeper', text: "Destroy all creatures. They can't be regenerated.",
  resolve(g) { g.emit({ type: 'sweep' }); for (const p of g.players) for (const c of [...p.bf]) if (g.isCreature(c)) g.destroy(c, { noRegen: true }); },
};
EFFECTS['Disenchant'] = {
  targets: ['artifactOrEnchantment'], ai: 'utility', text: 'Destroy target artifact or enchantment.',
  resolve: (g, it) => g.destroy(g.perm(it.targets[0])),
};
EFFECTS['Healing Salve'] = {
  targets: [], ai: 'heal', text: 'Choose one: target player gains 3 life; or prevent the next 3 damage to any target this turn.',
  modes: [
    { text: 'Target player gains 3 life.', targets: ['player'] },
    { text: 'Prevent the next 3 damage that would be dealt to any target this turn.', targets: ['any'] },
  ],
  resolve(g, it) { if (it.mode === 1) g.preventDamage(it.targets[0], 3); else g.gainLife(it.targets[0].id, 3); },
};
EFFECTS['Death Ward'] = {
  targets: ['creature'], ai: 'utility', text: 'Regenerate target creature.',
  resolve: (g, it) => g.regenerate(g.perm(it.targets[0])),
};
EFFECTS['Righteousness'] = {
  targets: ['blockingCreature'], ai: 'pump', text: 'Target blocking creature gets +7/+7 until end of turn.',
  resolve: (g, it) => g.addMod(g.perm(it.targets[0]), { p: 7, t: 7 }),
};
EFFECTS['Purelace'] = {
  targets: [], ai: 'utility', text: 'Target spell or permanent becomes white.',
  modes: [{ text: 'Target spell becomes white.', targets: ['spell'] }, { text: 'Target permanent becomes white.', targets: ['permanent'] }],
  resolve(g, it) {
    const t = it.targets[0];
    if (t.kind === 'spell') { const s = g.stack.find((x) => x.id === t.id); if (s) s.colorOverride = ['W']; }
    else { const p = g.perm(t); if (p) p.colorOverride = ['W']; }
  },
};

// ---------- damage-prevention instants (shield callbacks report the amount prevented) ----------
EFFECTS['Reverse Damage'] = {
  targets: [], ai: 'heal', text: 'Prevent the next damage from a source of your choice this turn; gain that much life.',
  resolve(g, it) {
    g.chooseSource(it.controller, () => true, { prompt: 'Choose a source', source: it.card.id }, (id) => {
      if (id == null) return;
      g.preventDamage(pl(it.controller), Infinity, { sourceId: id, once: true, onPrevent: (gg, n) => gg.gainLife(it.controller, n) });
    });
  },
};
EFFECTS['Eye for an Eye'] = {
  targets: [], ai: 'heal', text: 'The next time a source of your choice would deal damage to you this turn, it deals that much to you and Eye for an Eye deals that much to its controller.',
  resolve(g, it) {
    g.chooseSource(it.controller, () => true, { prompt: 'Choose a source', source: it.card.id }, (id) => {
      if (id == null) return;
      g.preventDamage(pl(it.controller), Infinity, {
        sourceId: id, once: true,
        onPrevent(gg, n, src) {
          // replacement: the source still deals the damage to you, and this spell deals it to the source's controller
          gg.damage(src, pl(it.controller), n, { noPrevent: true, noSba: true });
          if (src?.controller != null) gg.damage(it, pl(src.controller), n, { noPrevent: true, noSba: true });
          gg.sba();
        },
      });
    });
  },
};
EFFECTS['Reverse Polarity'] = {
  targets: [], ai: 'heal', text: 'You gain X life, where X is twice the damage dealt to you so far this turn by artifacts.',
  resolve(g, it) {
    const x = g.players[it.controller].damageFrom.filter((r) => (r.types || []).includes('Artifact')).reduce((a, r) => a + r.n, 0);
    if (x > 0) g.gainLife(it.controller, 2 * x);
  },
};
EFFECTS['Blaze of Glory'] = {
  targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && p.controller !== g.active }], ai: 'utility',
  text: 'Target creature defending player controls can block any number of creatures this turn. It blocks each attacking creature this turn if able.',
  castWhen: (g) => (g.step === 'attackers' || g.step === 'blockers') && g.combat.attackers.length > 0 && g.step !== 'damage' && !g.combat.blocked?.length && !Object.keys(g.combat.blocks || {}).length,
  resolve(g, it) { const p = g.perm(it.targets[0]); if (p) g.addMod(p, { kw: ['blockAny', 'mustBlockAll'] }); },
};

// ---------- creatures ----------
ABILITIES['Samite Healer'] = [{
  cost: { tap: true }, targets: ['any'], ai: 'heal', text: 'Prevent the next 1 damage that would be dealt to any target this turn.',
  resolve: (g, it) => g.preventDamage(it.targets[0], 1),
}];
ABILITIES['Northern Paladin'] = [{
  cost: { tap: true, mana: '{W}{W}' }, targets: ['blackPermanent'], ai: 'removal', text: 'Destroy target black permanent.',
  resolve: (g, it) => g.destroy(g.perm(it.targets[0])),
}];
ABILITIES['Personal Incarnation'] = [{
  cost: {}, ai: 'utility', text: 'The next 1 damage that would be dealt to this creature this turn is dealt to its owner instead.',
  condition: (g, perm) => perm.controller === perm.card.owner, // only the owner may activate
  resolve: (g, it) => g.preventDamage(pr(it.source), 1, { redirect: pl(it.source.card.owner), once: true }),
}];
TRIGGERS['Personal Incarnation'] = {
  onDie(g, perm) { const o = perm.card.owner; g.loseLife(o, Math.ceil(g.players[o].life / 2)); },
};
// Unblocked attackers' combat damage to the controller goes to the untapped Bodyguard instead.
STATIC['Veteran Bodyguard'] = {
  preventDamage(g, src, d) {
    if (src.tapped || !d.combat || d.target.kind !== 'player' || d.target.id !== src.controller || !d.src) return d.n;
    const att = d.src.card && g.perm(d.src.card.id);
    if (!att || !g.combat.attackers.includes(att.id) || (g.combat.blocks[att.id] || []).length) return d.n;
    g.damage(d.src, pr(src), d.n, { combat: true, noSba: true });
    return 0;
  },
};

done('Armageddon', 'Balance', 'Resurrection', 'Swords to Plowshares', 'Wrath of God', 'Disenchant', 'Healing Salve', 'Death Ward',
  'Righteousness', 'Purelace', 'Reverse Damage', 'Eye for an Eye', 'Reverse Polarity', 'Blaze of Glory', 'Samite Healer', 'Northern Paladin', 'Personal Incarnation', 'Veteran Bodyguard');
