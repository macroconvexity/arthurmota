// Arabian Nights / Antiquities colourless cards, second half (see docs/CARD_MODULE_CONTRACT.md).
// Locked (hook logged in docs/ENGINE_REQUESTS.md "artifacts B arn/atq"): Ring of Ma'rûf (no outside-the-game zone).
export const EFFECTS = {};
export const ABILITIES = {};
export const TRIGGERS = {};
export const STATIC = {};
export const IMPLEMENTED = ['Wall of Spears', 'Yotian Soldier'];

const pl = (id) => ({ kind: 'player', id });
const add = (name, abs) => { ABILITIES[name] = abs; IMPLEMENTED.push(name); };
const trig = (name, t) => { TRIGGERS[name] = { ...(TRIGGERS[name] || {}), ...t }; IMPLEMENTED.push(name); };
const stat = (name, s) => { STATIC[name] = [].concat(STATIC[name] || [], s); if (!IMPLEMENTED.includes(name)) IMPLEMENTED.push(name); };
const isArtifact = (c) => (c.def.types || []).includes('Artifact');

// "You may choose not to untap this artifact": while it holds something the untap step leaves it tapped (noUntap),
// then the controller is asked right after the step; yes untaps it (which ends the hold). The AI keeps holding.
const mayStayTapped = (name, holding, prompt) => {
  stat(name, { noUntap: (g, src, p) => p === src && src.tapped && holding(g, src) });
  trig(name, { onUntapStep: (g, perm, pid) => {
    if (pid !== perm.controller || !perm.tapped || !holding(g, perm)) return;
    g.ask(pid, { type: 'yesno', prompt, source: perm.card.id, auto: false }, (yes) => { if (yes) g.untapPerm(perm); });
  } });
};

// ---------- simple activated abilities ----------
add('Obelisk of Undoing', [{ cost: { mana: '{6}', tap: true }, ai: 'utility', text: '{6}, {T}: Return target permanent you both own and control to your hand.',
  targets: [{ kind: 'perm', test: (g, p, ctx) => p.controller === ctx.pid && p.card.owner === ctx.pid }],
  resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && t.controller === it.controller && t.card.owner === it.controller) g.bounce(t); } }]);
add('Rakalite', [{ cost: { mana: '{2}' }, targets: ['any'], ai: 'utility', text: '{2}: Prevent the next 1 damage that would be dealt to any target this turn. Return this artifact to its owner\'s hand at the beginning of the next end step.',
  resolve: (g, it) => {
    const t = it.targets[0]; if (t.kind === 'perm' && !g.perm(t)) return;
    g.preventDamage(t, 1, { until: 'eot' });
    const src = it.source; g.delay('end', () => { if (g.perm(src.id)) g.bounce(g.perm(src.id)); });
  } }]);
add('Sandals of Abdallah', [{ cost: { mana: '{2}', tap: true }, targets: ['creature'], ai: 'utility', text: '{2}, {T}: Target creature gains islandwalk until end of turn. When that creature dies this turn, destroy this artifact.',
  resolve: (g, it) => {
    const t = g.perm(it.targets[0]); if (!t || !g.isCreature(t)) return;
    g.addMod(t, { kw: 'islandwalk' });
    const src = it.source; g.whenDies(t, () => { const s = g.perm(src.id); if (s) g.destroy(s); });
  } }]);
add('Staff of Zegon', [{ cost: { mana: '{3}', tap: true }, targets: ['creature'], ai: 'utility', text: '{3}, {T}: Target creature gets -2/-0 until end of turn.',
  resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && g.isCreature(t)) g.addMod(t, { p: -2 }); } }]);
add("Tawnos's Wand", [{ cost: { mana: '{2}', tap: true }, ai: 'utility', text: '{2}, {T}: Target creature with power 2 or less can\'t be blocked this turn.',
  targets: [{ kind: 'perm', test: (g, p) => g.isCreature(p) && g.power(p) <= 2 }],
  resolve: (g, it) => { const t = g.perm(it.targets[0]); if (t && g.isCreature(t) && g.power(t) <= 2) g.addMod(t, { kw: 'unblockable' }); } }]);

// ---------- Triskelion, Su-Chi, simple bodies ----------
trig('Triskelion', { onEnter: (g, perm) => g.addCounters(perm, '+1/+1', 3) });
ABILITIES['Triskelion'] = [{ cost: { counter: { type: '+1/+1', n: 1 } }, targets: ['any'], ai: 'burn', text: 'Remove a +1/+1 counter from this creature: It deals 1 damage to any target.',
  resolve: (g, it) => g.damage(it.source, it.targets[0], 1) }];
trig('Su-Chi', { onDie: (g, perm) => g.addMana(perm.controller, 'C', 4) });

// ---------- life gain artifacts ----------
trig('Tablet of Epityr', { onAnyDie: (g, perm, dead) => {
  if (dead.controller === perm.controller && isArtifact(dead.card)) g.mayPay(perm.controller, '{1}', { prompt: 'Tablet of Epityr: pay {1} to gain 1 life?', source: perm.card.id, auto: true }, (paid) => { if (paid) g.gainLife(perm.controller, 1); });
} });
trig("Urza's Chalice", { onSpellCast: (g, perm, item) => {
  if (item.card && isArtifact(item.card)) g.mayPay(perm.controller, '{1}', { prompt: "Urza's Chalice: pay {1} to gain 1 life?", source: perm.card.id, auto: true }, (paid) => { if (paid) g.gainLife(perm.controller, 1); });
} });

// ---------- Weakstone ----------
stat('Weakstone', { affects: (g, src, t) => g.isCreature(t) && g.combat.attackers.includes(t.id), power: -1 });

// ---------- Tawnos's Weaponry ----------
const weapHolding = (g, src) => src.pumpId != null && !!g.perm(src.pumpId);
mayStayTapped("Tawnos's Weaponry", weapHolding, "Untap Tawnos's Weaponry? (No keeps the +1/+1)");
stat("Tawnos's Weaponry", { affects: (g, src, t) => src.pumpId === t.id && src.tapped, power: 1, toughness: 1 });
trig("Tawnos's Weaponry", { onUntap: (g, perm) => { perm.pumpId = null; } });
add("Tawnos's Weaponry", [{ cost: { mana: '{2}', tap: true }, targets: ['creature'], ai: 'utility', text: '{2}, {T}: Target creature gets +1/+1 for as long as this artifact remains tapped.',
  resolve: (g, it) => { const t = g.perm(it.targets[0]); const s = it.source; if (t && g.isCreature(t) && g.perm(s.id) && s.tapped) { s.pumpId = t.id; g.ver++; } } }]);

// ---------- Tawnos's Coffin ----------
// perm.held = { card, counters, auras: [cards] } while a creature is exiled with it.
const release = (g, perm) => {
  const h = perm.held; if (!h) return; perm.held = null;
  if (h.card.token) return;
  const back = g.putOntoBattlefield(h.card, h.card.owner, { tapped: true, counters: h.counters });
  for (const a of h.auras) if (!a.token) g.putOntoBattlefield(a, a.owner, { attachedTo: back.id });
};
mayStayTapped("Tawnos's Coffin", (g, src) => !!src.held, "Untap Tawnos's Coffin? (Yes returns the exiled creature)");
trig("Tawnos's Coffin", { onUntap: (g, perm) => release(g, perm), onLeave: (g, perm) => release(g, perm) });
add("Tawnos's Coffin", [{ cost: { mana: '{3}', tap: true }, targets: ['creature'], ai: 'removal', text: '{3}, {T}: Exile target creature and all Auras attached to it. When this artifact leaves the battlefield or becomes untapped, return that exiled card to the battlefield under its owner\'s control tapped with the noted counters, with the other exiled cards attached to it.',
  resolve: (g, it) => {
    const t = g.perm(it.targets[0]); const s = it.source; if (!t || !g.isCreature(t)) return;
    const auras = g.allPerms().filter((a) => a.attachedTo === t.id);
    const held = { card: t.card, counters: { ...t.counters }, auras: auras.map((a) => a.card) };
    for (const a of auras) g.exile(a);
    g.exile(t);
    if (g.perm(s.id)) s.held = held; // if Coffin already left, the creature stays exiled
  } }]);

// ---------- Shapeshifter ----------
const chooseNumber = (g, perm, prompt, auto) => g.ask(perm.controller, { type: 'number', min: 0, max: 7, prompt, source: perm.card.id, auto }, (n) => { perm.chosen = n; g.ver++; });
trig('Shapeshifter', {
  onEnter: (g, perm) => { perm.chosen = 3; chooseNumber(g, perm, 'Shapeshifter: choose a number between 0 and 7 (its power)', 3); },
  onUpkeep: (g, perm, pid) => { if (pid === perm.controller) chooseNumber(g, perm, 'Shapeshifter: choose a number between 0 and 7 (its power)', () => perm.chosen ?? 3); },
});
stat('Shapeshifter', { affects: (g, src, t) => t === src, setPT: (g, src) => { const n = src.chosen ?? 3; return [n, 7 - n]; } });

// ---------- Tetravus ----------
stat('Tetravite', { cantBeEnchanted: (g, src, host) => host === src }); // the token's own name keys its static
trig('Tetravus', {
  onEnter: (g, perm) => g.addCounters(perm, '+1/+1', 3),
  onUpkeep: (g, perm, pid) => {
    if (pid !== perm.controller) return;
    const have = () => perm.counters['+1/+1'] || 0;
    const makeTokens = () => {
      const n = Math.min(have(), 7); if (n <= 0) return exileTokens();
      g.ask(pid, { type: 'number', min: 0, max: n, prompt: 'Tetravus: remove how many +1/+1 counters to create Tetravite tokens?', source: perm.card.id, auto: 0 }, (k) => {
        if (k > 0 && g.perm(perm.id)) {
          g.addCounters(perm, '+1/+1', -k);
          for (let i = 0; i < k; i++) { const tok = g.createToken(pid, { name: 'Tetravite', power: 1, toughness: 1, types: ['Artifact', 'Creature'], subtypes: ['Tetravite'], colors: [], kw: ['flying'] }); tok.createdBy = perm.id; }
        }
        exileTokens();
      });
    };
    const exileTokens = () => {
      const toks = g.allPerms().filter((p) => p.createdBy === perm.id && p.card.token);
      if (!toks.length) return;
      g.ask(pid, { type: 'number', min: 0, max: toks.length, prompt: 'Tetravus: exile how many of its tokens to put +1/+1 counters on it?', source: perm.card.id, auto: 0 }, (k) => {
        if (k <= 0 || !g.perm(perm.id)) return;
        for (const t of toks.slice(0, k)) g.exile(t);
        g.addCounters(perm, '+1/+1', k);
      });
    };
    makeTokens();
  },
});

// ---------- Urza's Avenger ----------
add("Urza's Avenger", ['banding', 'flying', 'first strike', 'trample'].map((k) => ({ cost: { mana: '{0}' }, ai: 'utility', text: `{0}: This creature gets -1/-1 and gains ${k} until end of turn.`,
  resolve: (g, it) => { if (g.perm(it.source.id)) g.addMod(it.source, { p: -1, t: -1, kw: k }); } })));

// ---------- Pyramids (choose one = two abilities) and Urza's Miter ----------
const auraOnLand = (g, p) => p.attachedTo != null && (p.card.def.types || []).includes('Enchantment') && !!g.perm(p.attachedTo) && g.isLand(g.perm(p.attachedTo));
add('Pyramids', [
  { cost: { mana: '{2}' }, targets: [{ kind: 'perm', test: auraOnLand }], ai: 'removal', text: '{2}: Destroy target Aura attached to a land.',
    resolve: (g, it) => { const a = g.perm(it.targets[0]); if (a && auraOnLand(g, a)) g.destroy(a); } },
  { cost: { mana: '{2}' }, targets: ['land'], ai: 'utility', text: '{2}: The next time target land would be destroyed this turn, remove all damage marked on it instead.',
    resolve: (g, it) => { const l = g.perm(it.targets[0]); if (l && g.isLand(l)) g.addMod(l, { replaceDestroy: (gg, perm) => { perm.damage = 0; return true; } }); } },
]);
trig("Urza's Miter", { onAnyDie: (g, perm, dead, cause) => {
  if (dead.controller !== perm.controller || !isArtifact(dead.card) || cause === 'sacrifice') return;
  g.mayPay(perm.controller, '{3}', { prompt: "Urza's Miter: pay {3} to draw a card?", source: perm.card.id, auto: true }, (paid) => { if (paid) g.draw(perm.controller, 1); });
} });
