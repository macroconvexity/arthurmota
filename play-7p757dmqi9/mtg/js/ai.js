// Computer opponent. Generic: card use is driven by the `ai` hint of EFFECTS / ABILITIES entries
// (see docs/CARD_MODULE_CONTRACT.md); when a hint is missing it is inferred from the Oracle text.
// Contract: every aiAct(g, pid) call changes the game state or returns false (never loops silently).
import { EFFECTS, abilitiesOf } from './cards.js?v=20261102204808';
import { parseCost } from './engine.js?v=20261102204808';

export const LEVELS = ['easy', 'normal', 'hard'];
let CUR = { level: 'normal', g: null };
const level = () => CUR.level;
const rnd = () => (CUR.g && CUR.g.rng ? CUR.g.rng() : Math.random());
const ref = (p) => ({ kind: 'perm', id: p.id });
const PLAYER = (id) => ({ kind: 'player', id });
const same = (a, b) => a.kind === b.kind && a.id === b.id;
const cmc = (c) => parseCost(c.def.manaCost).total;
const isX = (d) => /\{X\}/.test(d.manaCost || '');
const has = (t, re) => re.test(t || '');

// ---------------------------------------------------------------- valuation
function valuePerm(g, p) {
  const k = g.kw(p), d = p.card.def;
  let v = g.power(p) * 1.5 + g.toughness(p);
  if (k.has('flying')) v += 2; if (k.has('first strike')) v += 1.5; if (k.has('trample')) v += 1;
  if (k.has('deathtouch')) v += 2; if (k.has('haste')) v += 0.5; if (k.has('vigilance')) v += 0.5;
  if (k.has('double strike')) v += 3; if (k.has('fear') || k.has('unblockable')) v += 1.5; if (k.has('indestructible')) v += 3;
  if (k.has('defender')) v -= 1.5; if (k.has('reach')) v += 0.5; if (k.has('regeneration')) v += 1;
  v += (d.manaValue || 0) * 0.4;
  const abs = abilitiesOf(d); if (abs.some((a) => !a.mana)) v += 2; if (abs.some((a) => a.mana)) v += 1.5;
  return v;
}
const creaturesOf = (g, pid) => g.players[pid].bf.filter((p) => g.isCreature(p));
const boardValue = (g, pid) => creaturesOf(g, pid).reduce((a, p) => a + valuePerm(g, p), 0);
const lifeLeft = (g, p) => g.toughness(p) - p.damage;

// outcome of attacker a against single blocker b (first strike / deathtouch aware)
function duel(g, a, b) {
  const ap = g.power(a), bp = g.power(b), at = lifeLeft(g, a), bt = lifeLeft(g, b);
  const ka = g.kw(a), kb = g.kw(b);
  const aKills = ap > 0 && (ap >= bt || ka.has('deathtouch')), bKills = bp > 0 && (bp >= at || kb.has('deathtouch'));
  const afs = ka.has('first strike') || ka.has('double strike'), bfs = kb.has('first strike') || kb.has('double strike');
  if (afs && !bfs && aKills) return { aDies: false, bDies: true };
  if (bfs && !afs && bKills) return { aDies: true, bDies: false };
  return { aDies: bKills, bDies: aKills };
}

// state signature: used to prove an action changed something
function sig(g) {
  const out = [g.turn, g.step, g.stack.length, g.passes, g.waiting?.kind, g.waiting?.player, g.winner ? 1 : 0, g.combat?.attackers?.length, Object.keys(g.combat?.blocks || {}).length, g.waiting?.prompt, g.curAsk?.req?.prompt, g.asks?.length, g.curAsk?.req?.options?.length];
  for (const p of g.players) out.push(p.life, p.hand.length, p.bf.length, p.gy.length, p.ex.length, p.library.length, p.landPlayed ? 1 : 0, p.bf.filter((x) => x.tapped).length, p.bf.reduce((a, x) => a + (x.damage || 0) + (x.mods?.length || 0) + (x.auras?.length || 0), 0), p.pool ? Object.values(p.pool).join('') : '');
  return out.join(',');
}

// per-game memory: attempts that failed this step, action counts
const memo = new WeakMap();
function mem(g) {
  let m = memo.get(g); if (!m) { m = { key: '', failed: new Set(), n: 0, turnUse: new Map() }; memo.set(g, m); }
  const k = `${g.turn}:${g.step}:${g.active}`;
  if (m.key !== k) { m.key = k; m.failed = new Set(); m.n = 0; }
  return m;
}
const turnUse = (g, key) => { const m = mem(g); const k = g.turn + ':' + key; return m.turnUse.get(k) || 0; };
const bumpUse = (g, key) => { const m = mem(g); const k = g.turn + ':' + key; m.turnUse.set(k, (m.turnUse.get(k) || 0) + 1); if (m.turnUse.size > 400) m.turnUse.clear(); };

// ---------------------------------------------------------------- hints & text helpers
function inferHint(text) {
  const t = text || '';
  if (has(t, /counter target/i)) return 'counter';
  if (has(t, /destroy all|each creature|all creatures/i)) return 'sweeper';
  if (has(t, /\d+ damage|X damage/i)) return 'burn';
  if (has(t, /destroy target|exile target|return target .* to (its|their) owner'?s? hand/i)) return 'removal';
  if (has(t, /draws? (a|two|three|\d+) cards?/i)) return 'draw';
  if (has(t, /gets? [+]\d+\/[+]\d+|first strike|regenerate/i)) return 'pump';
  if (has(t, /gain \d+ life/i)) return 'heal';
  if (has(t, /discard/i)) return 'discard';
  if (has(t, /add \{/i)) return 'ramp';
  return 'utility';
}
const hintOf = (entry, def) => entry?.ai || inferHint((entry?.text || '') + ' ' + (def?.text || ''));
function damageOf(text, x) {
  const m = /(\d+) damage/i.exec(text || ''); if (m) return +m[1];
  if (/X damage/i.test(text || '')) return x || 0;
  return 2;
}
function pumpOf(text) {
  const m = /([+-]\d+)\/([+-]\d+)/.exec(text || '');
  if (m && (+m[1] > 0 || +m[2] > 0)) return { p: +m[1], t: +m[2], save: false };
  if (has(text, /first strike|regenerat|prevent|indestructible|protection/i)) return { p: 0, t: 0, save: true, fs: has(text, /first strike/i) };
  return null;
}
function availMana(g, pid) {
  const pl = g.players[pid]; let n = Object.values(pl.pool || {}).reduce((a, b) => a + b, 0);
  for (const s of g.manaSources(pid)) n += s.amount;
  return n;
}

// ---------------------------------------------------------------- targeting
function annotate(g, pid, r) {
  if (r.kind === 'player') return { ref: r, mine: r.id === pid, player: true };
  if (r.kind === 'perm') { const p = g.perm(r); if (!p) return null; return { ref: r, perm: p, mine: p.controller === pid, creature: g.isCreature(p), land: g.isLand(p) }; }
  const s = g.stack.find((x) => x.id === r.id); if (!s) return null;
  return { ref: r, item: s, mine: s.controller === pid };
}
const permWorth = (g, o) => (o.creature ? valuePerm(g, o.perm) : o.land ? 2 + (abilitiesOf(o.perm.card.def)[0]?.mana?.colors?.length > 1 ? 3 : 0) : 1.5 + (o.perm.card.def.manaValue || 0) * 1.2);

// pick the best target of `spec` for a hint; returns {ref, score} or null
function bestTarget(g, pid, spec, hint, ctx, exclude) {
  const foe = g.players[1 - pid], me = g.players[pid];
  let best = null;
  const consider = (o, score) => { if (score != null && (!best || score > best.score)) best = { ref: o.ref, score }; };
  for (const r of g.validTargets(spec, pid, ctx.sourceId ?? null, ctx.card)) {
    if (exclude.some((e) => same(e, r))) continue;
    const o = annotate(g, pid, r); if (!o) continue;
    if (ctx.only && !ctx.only(o)) continue;
    switch (hint) {
      case 'removal':
        if (!o.mine && o.perm) consider(o, permWorth(g, o));
        break;
      case 'burn': {
        const d = ctx.dmg;
        if (o.player && !o.mine) { const pl = foe; consider(o, d >= pl.life ? 1000 : pl.life <= d * 2 + 2 ? 6 + d : pl.life <= 8 ? 3 + d * 0.5 : 1 + d * 0.3); }
        else if (o.creature && !o.mine && lifeLeft(g, o.perm) <= d) consider(o, valuePerm(g, o.perm));
        break;
      }
      case 'discard': if (o.player && !o.mine) consider(o, foe.hand.length); break;
      case 'landhate': if (o.land && !o.mine) consider(o, permWorth(g, o) + (/basic/i.test(o.perm.card.def.type || '') ? 0 : 3)); break;
      case 'counter': if (o.item && !o.mine) consider(o, cmc(o.item.card) + (EFFECTS[o.item.card.def.name] ? 2 : 0)); break;
      case 'heal': if (o.player && o.mine) consider(o, 10 - me.life); break;
      case 'draw': case 'ramp': if (o.player && o.mine) consider(o, 5); else if (o.land && o.mine && hint === 'ramp') consider(o, 3); else if (o.creature && o.mine) consider(o, valuePerm(g, o.perm) * 0.2); break;
      case 'pump': if (o.creature && o.mine) consider(o, valuePerm(g, o.perm) + (ctx.prefer && ctx.prefer.has(o.perm.id) ? 10 : 0)); break;
      case 'harmful': // utility with harmful text
        if (o.perm && !o.mine) consider(o, permWorth(g, o));
        else if (o.player && !o.mine) consider(o, 2);
        break;
      default: // beneficial utility
        if (o.perm && o.mine) consider(o, permWorth(g, o));
        else if (o.player && o.mine) consider(o, 2);
    }
  }
  return best;
}
function pickTargets(g, pid, specs, hint, ctx) {
  const refs = []; let score = 0;
  for (const spec of specs) {
    const b = bestTarget(g, pid, spec, hint, ctx, refs); if (!b) return null;
    refs.push(b.ref); score += b.score;
  }
  return { refs, score: specs.length ? score / specs.length : 0 };
}

// ---------------------------------------------------------------- spell planning
function threatened(g, pid) { // can opponent kill us next swing?
  const me = g.players[pid];
  const inc = creaturesOf(g, 1 - pid).reduce((a, p) => a + g.power(p), 0);
  return inc >= me.life - 2;
}
function oppAttackers(g, pid) { return (g.combat?.attackers || []).map((a) => g.perm(a)).filter((p) => p && p.controller !== pid); }

// returns {score, targets, extra} or null. mode: 'main' | 'oppCombat' | 'end' | 'combat'
function evalHintUse(g, pid, hint, entry, def, ctx, mode, specs, isPermanentSpell) {
  const me = g.players[pid], foe = g.players[1 - pid];
  const main = mode === 'main';
  switch (hint) {
    case 'removal': {
      if (mode === 'end') return null;
      const atk = oppAttackers(g, pid);
      if (mode === 'oppCombat') ctx.only = (o) => o.perm && atk.includes(o.perm);
      const t = pickTargets(g, pid, specs, 'removal', ctx); if (!t) return null;
      const need = me.life <= 10 || me.hand.length >= 7 || threatened(g, pid) ? 2 : 3.5;
      if (t.score < need) return null;
      return { score: (isPermanentSpell ? 150 : 200) + t.score, targets: t.refs };
    }
    case 'burn': {
      if (!specs.length) return mode === 'end' ? null : { score: 120, targets: [] };   // untargeted damage (Backdraft): castWhen already limits it
      if (mode === 'end' && !(foe.life <= ctx.dmg)) { /* face burn at end of turn is fine below */ }
      const atk = oppAttackers(g, pid);
      if (mode === 'oppCombat') ctx.only = (o) => (o.perm && atk.includes(o.perm)) || (o.player && !o.mine && foe.life <= ctx.dmg);
      const t = pickTargets(g, pid, specs, 'burn', ctx); if (!t) return null;
      if (t.score >= 1000) return { score: 1000, targets: t.refs };
      const face = t.refs.some((r) => r.kind === 'player');
      const need = face ? (foe.life <= 8 && me.hand.length > 1 ? 5 : me.hand.length >= 7 ? 3 : 99) : (me.life <= 10 || threatened(g, pid) ? 2 : 3.5);
      if (t.score < need) return null;
      return { score: 190 + t.score, targets: t.refs };
    }
    case 'draw': {
      if (mode === 'oppCombat' || mode === 'combat' || me.library.length < 4) return null;
      const t = pickTargets(g, pid, specs, 'draw', ctx); if (!t) return null;
      return { score: 85 - me.hand.length * 6 + (mode === 'end' ? 20 : 0), targets: t.refs };
    }
    case 'heal': {
      const t = pickTargets(g, pid, specs, 'heal', ctx); if (!t) return null;
      if (!(me.life <= 9 || (threatened(g, pid) && me.life <= 14))) return null;
      return { score: 75, targets: t.refs };
    }
    case 'ramp': {
      if (!main) return null;
      const t = pickTargets(g, pid, specs, 'ramp', ctx); if (!t) return null;
      if (isPermanentSpell) return { score: 140, targets: t.refs };
      // ritual: only if it unlocks a spell we cannot cast now
      const extra = ctx.extraMana ?? 2, avail = availMana(g, pid);
      const unlock = me.hand.some((c) => c !== ctx.card && !c.def.types.includes('Land') && !g.canCast(pid, c) && cmc(c) <= avail - cmc(ctx.card) + extra && cmc(c) > avail - cmc(ctx.card));
      return unlock ? { score: 160, targets: t.refs } : null;
    }
    case 'discard': {
      if (!main || !foe.hand.length) return null;
      const t = pickTargets(g, pid, specs, 'discard', ctx); if (!t) return null;
      return { score: 45, targets: t.refs };
    }
    case 'landhate': {
      if (!main) return null;
      const fl = foe.bf.filter((p) => g.isLand(p)).length;
      if (fl > 5 || fl < 1) return null;
      const t = pickTargets(g, pid, specs, 'landhate', ctx); if (!t) return null;
      if (fl > 4 && boardValue(g, pid) <= boardValue(g, 1 - pid)) return null;
      return { score: 50 + (5 - fl) * 6, targets: t.refs };
    }
    case 'sweeper': {
      if (!main) return null;
      const t = ctx.text || '';
      const mine = boardValue(g, pid), theirs = boardValue(g, 1 - pid);
      const myLands = me.bf.filter((p) => g.isLand(p)).length, foeLands = foe.bf.filter((p) => g.isLand(p)).length;
      if (has(t, /all lands/i) && !has(t, /creature/i)) {
        if (mine >= theirs + 3 && creaturesOf(g, pid).length >= 2 && myLands >= foeLands - 1 && foe.life <= me.life + 5) return { score: 120, targets: [] };
        return null;
      }
      const net = theirs - mine;
      if (theirs <= 0) return null;
      if (level() === 'hard' && creaturesOf(g, 1 - pid).length < 2 && net < 8 && !threatened(g, pid)) return null; // wait for a second target
      if (net >= 6 || (net >= 2 && (me.life <= 10 || threatened(g, pid))) || (threatened(g, pid) && theirs > 0 && net >= 0)) return { score: 180 + net, targets: [] };
      return null;
    }
    case 'pump': {
      if (!(isPermanentSpell && main)) return null;       // pump auras; tricks are handled in combat code
      const t = pickTargets(g, pid, specs, 'pump', ctx); if (!t) return null;
      return { score: 90 + t.score, targets: t.refs };
    }
    case 'counter': return null; // handled in the stack-response code
    default: { // utility
      if (!main && mode !== 'end') return null;
      if (!specs.length) return ctx.skipUtility ? null : { score: has(ctx.text, /extra turn/i) ? 110 : 32, targets: [] };
      const harmful = has((entry?.text || '') + ' ' + (def.text || ''), /destroy|damage|exile|tap target|return target|-\d\/-\d|can't|loses|sacrifice/i);
      const t = pickTargets(g, pid, specs, harmful ? 'harmful' : 'beneficial', ctx);
      if (!t || t.score < (harmful ? 3 : 2)) return null;
      return { score: harmful ? 60 + t.score : 40 + t.score, targets: t.refs };
    }
  }
}

// Legends-era rules the AI respects instead of casting blindly.
function blockedByRules(g, pid, c) {
  const d = c.def, me = g.players[pid], foe = g.players[1 - pid];
  const sup = d.supertypes || [];
  if (sup.includes('Legendary') && me.bf.some((p) => p.card.def.name === d.name)) return true;          // legend rule: never cast a second copy
  if (sup.includes('World') && g.players.some((pl) => pl.bf.some((p) => (p.card.def.supertypes || []).includes('World') && p.controller === pid))) return true;
  const text = d.text || '';
  const types = d.types || [];
  if (!types.includes('Instant') && !types.includes('Sorcery')) {
    const fliers = (pl) => creaturesOf(g, pl).filter((p) => !g.kw(p).has('flying'));
    if (has(text, /creatures without flying can't attack/i)) {                                          // Moat: only if my ground force is worse than theirs
      const mine = fliers(pid).reduce((t, p) => t + valuePerm(g, p), 0), theirs = fliers(1 - pid).reduce((t, p) => t + valuePerm(g, p), 0);
      if (theirs <= mine + 2) return true;
    }
    if (has(text, /destroy target nonartifact creature that player controls/i)) {                       // The Abyss
      const na = (pl) => creaturesOf(g, pl).filter((p) => !p.card.def.types.includes('Artifact')).length;
      if (na(pid) > 0 && na(pid) >= na(1 - pid)) return true;
    }
    if (has(text, /deals X damage to that player, where X is 4 minus/i) && !(me.life >= foe.life + 4 && foe.life <= 10)) return true; // Storm World
  }
  return false;
}
const voidTax = (g) => g.players.some((pl) => pl.bf.some((p) => p.card.def.name === 'Nether Void'));

function spellPlans(g, pid, mode) {
  const me = g.players[pid], m = mem(g), plans = [];
  const avail = availMana(g, pid);
  for (const c of me.hand) {
    if (m.failed.has('c' + c.id)) continue;
    const d = c.def;
    if (d.types.includes('Land') || !g.canCast(pid, c)) continue;
    const eff0 = EFFECTS[d.name];
    if (blockedByRules(g, pid, c)) continue;
    if (eff0?.cost && (eff0.cost.sacOther || eff0.cost.tapOther || eff0.cost.discard || eff0.cost.life)) continue;
    if (eff0?.multi && (eff0.multi.min ?? 1) > 1) continue;
    const info = g.castInfo ? g.castInfo(c) : null;
    // auras without an EFFECTS entry still need a target: synthesise an entry from the card text
    const eff = eff0 || (info && info.targets.length ? { targets: info.targets, text: '' } : undefined);
    const fixed = parseCost(d.manaCost).total;
    const xCard = isX(d) || eff?.x;
    const x = xCard ? (g.maxX ? g.maxX(pid, c) : Math.max(0, avail - fixed)) : 0;
    const text = (eff?.text || '') + ' ' + (d.text || '');
    const instant = d.types.includes('Instant') || d.types.includes('Sorcery');
    const permanent = !instant;
    if (permanent && mode !== 'main') continue;
    if (xCard && x < 1) continue;
    if (voidTax(g) && fixed + 3 > avail) continue;               // Nether Void would counter it
    const ctx = { dmg: damageOf(text, x), x, text, card: c, sourceId: null };
    let plan = null;
    if (!eff && permanent) {
      const creature = d.types.includes('Creature'), artifact = d.types.includes('Artifact');
      const behind = boardValue(g, 1 - pid) > boardValue(g, pid);
      const mana = abilitiesOf(d).some((a) => a.mana);
      plan = { score: creature ? 100 + fixed * 3 + (behind ? 25 : 0) : artifact ? (mana ? 150 + (level() === 'hard' && g.turn <= 8 ? 20 : 0) : 60 + fixed) : 20, targets: [], creature };
    } else if (eff) {
      const hint = hintOf(eff, d);
      const forms = eff.modes ? eff.modes.map((md, i) => ({ md, i })) : [{ md: null, i: null }];
      for (const f of forms) {
        const specs = f.md ? f.md.targets : eff.multi ? [eff.multi.spec] : eff.targets;
        const mt = f.md ? f.md.text : '';
        const h = f.md ? inferHint(mt) : hint;
        const c2 = { ...ctx, text: ctx.text + ' ' + mt, dmg: f.md ? damageOf(mt, x) : ctx.dmg };
        const pl = evalHintUse(g, pid, h, f.md || eff, d, c2, mode, specs, permanent);
        if (pl && (!plan || pl.score > plan.score)) plan = { ...pl, mode: f.i ?? undefined };
      }
      if (!plan && permanent && mode === 'main') {
        // targeted permanent spells (auras) with no good use: keep them, they are not castable blind
        plan = null;
      }
      if (plan && permanent && !eff.targets.length && hint === 'utility') plan.score = 100 + fixed * 3;
    }
    if (plan && xCard && plan.targets?.length && hintOf(eff, d) === 'burn') { // spend only what the kill needs
      const tr = plan.targets[0];
      if (tr.kind === 'player') plan.x = Math.min(x, Math.max(1, g.players[tr.id].life));
      else { const tp = g.perm(tr); if (tp) plan.x = Math.min(x, Math.max(1, lifeLeft(g, tp))); }
    }
    if (plan) plans.push({ ...plan, card: c, x: plan.x ?? x, mode: plan.mode, label: d.name, hint: eff ? hintOf(eff, d) : 'permanent', cost: fixed + (plan.x ?? x) });
  }
  return plans;
}

// ---------------------------------------------------------------- abilities
function abilityPlans(g, pid, mode) {
  const me = g.players[pid], foe = g.players[1 - pid], m = mem(g), plans = [];
  for (const a of g.activatable(pid)) {
    const key = `a${a.perm.id}:${a.idx}`;
    if (m.failed.has(key) || turnUse(g, key) >= (a.ab.cost.tap ? 2 : 3)) continue;
    const co = a.ab.cost || {};
    if (co.sac || co.sacOther || co.tapOther || co.discard || co.life || co.x || a.ab.multi) continue;
    const d = a.perm.card.def, ab = a.ab;
    const hint = hintOf(ab, d);
    const text = (ab.text || '');
    const ctx = { dmg: damageOf(text, 0), text, card: a.perm.card, sourceId: a.perm.id, skipUtility: !!ab.cost.mana };
    const specs = ab.targets || [];
    let plan = null;
    if (hint === 'burn' && a.ab.cost.tap && !a.ab.cost.mana) {
      // pinger: kill a creature any time; face only on the opponent's end step or when lethal
      const t = pickTargets(g, pid, specs, 'burn', ctx);
      if (t) {
        const face = t.refs.some((r) => r.kind === 'player');
        const ok = !face || t.score >= 1000 || (g.active !== pid && g.step === 'end') || (g.active === pid && g.step === 'end' && creaturesOf(g, pid).length === 0);
        if (ok && (face || t.score >= 3)) plan = { score: face ? 70 : 170 + t.score, targets: t.refs };
      }
    } else if (hint === 'burn' || hint === 'removal') {
      plan = evalHintUse(g, pid, hint, ab, d, ctx, mode === 'main' ? 'main' : mode, specs, false);
      if (plan) plan.score -= 20;
    } else if (hint === 'draw' || hint === 'heal' || hint === 'discard' || hint === 'landhate') {
      plan = evalHintUse(g, pid, hint, ab, d, ctx, mode, specs, false);
      if (plan) plan.score -= 10;
    } else if (hint === 'utility' && mode === 'main' && !ab.cost.mana) {
      plan = evalHintUse(g, pid, hint, ab, d, ctx, mode, specs, false);
      if (plan && g.step === 'main2') plan.score -= 5; else plan = null;
    }
    if (plan) plans.push({ ...plan, ability: a, label: d.name + ' ability', key });
  }
  return plans;
}

function runPlan(g, pid, p) {
  const m = mem(g);
  const before = sig(g);
  let ok;
  if (p.ability) { ok = g.activate(pid, p.ability.perm.id, p.ability.idx, p.targets); bumpUse(g, p.key); }
  else ok = g.cast(pid, p.card, p.targets, p.x || 0, p.mode != null ? { mode: p.mode } : undefined);
  if (!ok || sig(g) === before) { m.failed.add(p.ability ? p.key : 'c' + p.card.id); return false; }
  return true;
}

// ---------------------------------------------------------------- combat tricks
function fightsOf(g, pid) {
  const out = [];
  for (const aid of g.combat?.attackers || []) {
    const a = g.perm(aid); if (!a) continue;
    const bl = (g.combat.blocks[aid] || []).map((b) => g.perm(b)).filter(Boolean);
    if (a.controller === pid) out.push({ m: a, foes: bl, attacking: true, unblocked: !bl.length });
    else for (const b of bl) out.push({ m: b, foes: [a, ...bl.filter((x) => x !== b).slice(0, 0)], attacking: false, multi: bl.length });
  }
  return out;
}
// how much a pump is worth in a fight
function pumpBenefit(g, pid, f, pump) {
  const foe = g.players[1 - pid];
  const m = f.m;
  const p0 = g.power(m), t0 = lifeLeft(g, m);
  const p1 = p0 + pump.p, t1 = t0 + pump.t;
  if (!f.foes.length) { // unblocked attacker
    const unblockedDmg = (g.combat.attackers || []).map((a) => g.perm(a)).filter((a) => a && a.controller === pid && !(g.combat.blocks[a.id] || []).length).reduce((s, a) => s + g.power(a), 0);
    return foe.life <= unblockedDmg + pump.p && foe.life > unblockedDmg ? 1000 : 0;
  }
  if (pump.save && !pump.fs && (m.regen || 0) > 0) return 0;
  const dmgIn = f.foes.reduce((s, x) => s + g.power(x), 0);
  const dies0 = dmgIn >= t0 || f.foes.some((x) => g.kw(x).has('deathtouch'));
  const fsEdge = pump.fs && !g.kw(m).has('first strike') && f.foes.every((x) => !g.kw(x).has('first strike'));
  const dies1 = pump.save ? (fsEdge ? !f.foes.every((x) => p1 >= lifeLeft(g, x)) : false) || (!pump.fs && false) : dmgIn >= t1 || f.foes.some((x) => g.kw(x).has('deathtouch'));
  const kills0 = f.foes.filter((x) => p0 >= lifeLeft(g, x));
  const kills1 = f.foes.filter((x) => (pump.save && !pump.fs ? p0 : p1) >= lifeLeft(g, x));
  let b = 0;
  if (dies0 && !dies1) b += valuePerm(g, m) + 1;
  if (kills1.length > kills0.length) b += kills1.filter((x) => !kills0.includes(x)).reduce((s, x) => s + valuePerm(g, x), 0);
  if (dies1 && dies0) b = Math.max(0, b - 1);
  return b;
}
function combatPumpPlans(g, pid) {
  const me = g.players[pid], plans = [];
  if (g.step !== 'blockers') return plans;
  const fights = fightsOf(g, pid); if (!fights.length) return plans;
  const m = mem(g);
  const sources = [];
  for (const c of me.hand) {
    const eff = EFFECTS[c.def.name]; if (!eff || m.failed.has('c' + c.id)) continue;
    if (!c.def.types.includes('Instant') || !g.canCast(pid, c)) continue;
    const text = (eff.text || '') + ' ' + (c.def.text || '');
    if (hintOf(eff, c.def) !== 'pump') continue;
    sources.push({ card: c, eff, pump: pumpOf(text), specs: eff.targets, cost: cmc(c) });
  }
  for (const a of g.activatable(pid)) {
    const key = `a${a.perm.id}:${a.idx}`;
    if (m.failed.has(key) || a.ab.cost.sac || a.ab.cost.sacOther || a.ab.cost.tapOther || a.ab.cost.discard || a.ab.cost.x || a.ab.multi || turnUse(g, key) >= 6) continue;
    if (hintOf(a.ab, a.perm.card.def) !== 'pump') continue;
    sources.push({ ability: a, key, pump: pumpOf((a.ab.text || '') + ' ' + (a.perm.card.def.text || '')), specs: a.ab.targets || [], cost: 1 });
  }
  for (const s of sources) {
    if (!s.pump) continue;
    for (const f of fights) {
      let targets = [];
      if (s.specs.length) {
        const valid = g.validTargets(s.specs[0], pid, s.ability?.perm.id ?? null, s.card || s.ability?.perm.card);
        if (!valid.some((r) => r.kind === 'perm' && r.id === f.m.id)) continue;
        if (s.specs.length > 1) continue;
        targets = [ref(f.m)];
      } else if (!s.ability || s.ability.perm !== f.m) continue;
      const b = pumpBenefit(g, pid, f, s.pump);
      if (b >= 3) plans.push({ score: 300 + b - s.cost, targets, card: s.card, ability: s.ability, key: s.key, label: 'pump' });
    }
  }
  return plans;
}

// ---------------------------------------------------------------- stack response
function respondToStack(g, pid, top) {
  const me = g.players[pid], m = mem(g);
  // counter
  for (const c of me.hand) {
    const eff = EFFECTS[c.def.name]; if (!eff || m.failed.has('c' + c.id) || !g.canCast(pid, c)) continue;
    if (hintOf(eff, c.def) !== 'counter' || top.kind !== 'spell') continue;
    if (eff.targets.length !== 1) continue;
    if (!g.validTargets(eff.targets[0], pid, c.id, c).some((r) => r.kind === 'spell' && r.id === top.id)) continue;
    const t = top.card.def, eff2 = EFFECTS[t.name];
    const worth = (eff2 && (eff2.targets.length || /damage|destroy|draw/i.test(eff2.text || ''))) || cmc(top.card) >= 3 || (cmc(top.card) >= 2 && me.hand.length > 2) || me.hand.length > 4;
    if (!worth) continue;
    const plan = { card: c, targets: [{ kind: 'spell', id: top.id }] };
    if (runPlan(g, pid, plan)) return true;
  }
  // regenerate a creature that is about to be destroyed or burned to death
  {
    const eff = top.effect || EFFECTS[top.card.def.name];
    const tgt = top.targets?.[0];
    const p = tgt?.kind === 'perm' ? g.perm(tgt) : null;
    if (top.kind === 'spell' && eff && p && p.controller === pid && g.isCreature(p) && (p.regen || 0) === 0 && valuePerm(g, p) >= 3) {
      const h = hintOf(eff, top.card.def), txt = (eff.text || '') + ' ' + (top.card.def.text || '');
      const kills = h === 'removal' ? /destroy/i.test(txt) : h === 'burn' ? damageOf(txt, top.x || 0) >= lifeLeft(g, p) : false;
      if (kills) for (const a of g.activatable(pid)) {
        if (a.perm !== p || !has(a.ab.text || '', /regenerat/i) || a.ab.cost.sac || a.ab.cost.x) continue;
        if (runPlan(g, pid, { ability: a, targets: a.ab.targets?.length ? [ref(p)] : [], key: `a${a.perm.id}:${a.idx}` })) return true;
      }
    }
  }
  // save my creature from damage with a pump
  const eff = top.effect || EFFECTS[top.card.def.name];
  const tgt = top.targets?.[0];
  if (top.kind === 'spell' && eff && tgt?.kind === 'perm') {
    const p = g.perm(tgt);
    if (p && p.controller === pid && g.isCreature(p) && hintOf(eff, top.card.def) === 'burn') {
      const dmg = damageOf((eff.text || '') + ' ' + (top.card.def.text || ''), 0);
      for (const c of me.hand) {
        const e = EFFECTS[c.def.name]; if (!e || m.failed.has('c' + c.id) || !c.def.types.includes('Instant') || !g.canCast(pid, c) || hintOf(e, c.def) !== 'pump') continue;
        const pu = pumpOf((e.text || '') + ' ' + (c.def.text || ''));
        if (!pu || !pu.t || lifeLeft(g, p) > dmg || lifeLeft(g, p) + pu.t <= dmg || valuePerm(g, p) < 4) continue;
        if (!e.targets.length || !g.validTargets(e.targets[0], pid, c.id, c).some((r) => r.id === p.id)) continue;
        if (runPlan(g, pid, { card: c, targets: [ref(p)] })) return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------- main entry
// opts.level: 'easy' | 'normal' | 'hard' (default: g.aiLevels[pid] ?? g.aiLevel ?? 'normal')
export function aiAct(g, pid, opts = {}) {
  const w = g.waiting; if (!w || w.player !== pid || g.winner) return false;
  const lv = opts.level ?? g.aiLevels?.[pid] ?? g.aiLevel ?? 'normal';
  CUR = { level: LEVELS.includes(lv) ? lv : 'normal', g };
  const before = sig(g);
  try { decide(g, pid, w); } catch (e) { (g.aiErrors ||= []).push(String(e && e.stack || e)); if (g.aiStrict) throw e; }
  if (sig(g) !== before) return true;
  fallback(g, pid, w);
  return sig(g) !== before;
}

function decide(g, pid, w) {
  const me = g.players[pid];
  switch (w.kind) {
    case 'discard': return void chooseDiscard(g, pid, w);
    case 'attackers': return void g.declareAttackers(pid, chooseAttackers(g, pid));
    case 'blockers': return void g.declareBlockers(pid, chooseBlocks(g, pid));
    case 'priority': return void priority(g, pid);
    default: return void handleOtherWaiting(g, pid, w);
  }
}

// Hook for waiting kinds documented in docs/ENGINE_API.md. Unknown kinds fall through to `fallback`.
const cardValue = (g, pid, d) => {
  const me = g.players[pid], lands = me.bf.filter((p) => g.isLand(p)).length;
  if (d.types.includes('Land')) return lands < 4 ? 8 : lands < 6 ? 3 : 0.5;
  const mv = d.manaValue || 0;
  if (d.types.includes('Creature')) return (+d.power || 0) * 1.5 + (+d.toughness || 0) + mv * 0.4 + (mv > lands + 2 ? -2 : 0);
  const h = EFFECTS[d.name]?.ai;
  return 3 + mv * 0.3 + (['removal', 'burn', 'draw', 'counter'].includes(h) ? 2 : 0);
};
function answerChoice(g, pid, w) {
  const prompt = (w.prompt || '') + ' ' + (w.source ? '' : '');
  if (w.type === 'yesno') {
    if (w.auto !== undefined) return g.autoAnswer();
    if (has(prompt, /sacrifice|discard|lose|destroy|skip/i)) return false;
    if (has(prompt, /search|draw|return|gain|untap|put|pay|may|keep|regenerat/i)) return true;
    return g.autoAnswer();
  }
  if (w.type === 'cardName') {
    const names = new Set(w.names || []);
    const foe = g.players[1 - pid];
    const seen = [...foe.bf.map((p) => p.card), ...foe.gy, ...foe.ex].filter((c) => !c.def.types.includes('Land') && names.has(c.def.name)).sort((a, b) => cmc(b) - cmc(a));
    if (seen.length) return seen[0].def.name;
    const mine = g.players[pid].hand.filter((c) => names.has(c.def.name) && !c.def.types.includes('Land')).sort((a, b) => cmc(a) - cmc(b));
    return mine.length ? undefined : (w.names || [])[0];
  }
  if (w.type === 'number') {
    const lo = w.min ?? 0, hi = Number.isFinite(w.max) ? w.max : lo;
    if (has(prompt, /\bX\b|mana|pay|spend|amount|how (much|many)/i) && !has(prompt, /discard|sacrifice/i)) return Math.max(lo, hi);
    return lo;
  }
  const opts = w.options || [], lo = w.min ?? 1, hi = w.max ?? 1;
  const need = Math.min(opts.length, Math.max(lo, Math.min(hi, 1)));
  const bad = has(prompt, /discard|sacrifice|lose|exile .*your|put .* graveyard/i) && !has(prompt, /opponent|target player/i);
  const harm = has(prompt, /destroy|damage|exile|bounce|return .*owner|tap target|target/i) && !bad;
  const score = (o) => {
    let v = o.score || 0;
    if (o.ref?.kind === 'perm') {
      const p = g.perm(o.ref); if (p) { const mine = p.controller === pid; const val = g.isCreature(p) ? valuePerm(g, p) : permWorth(g, { perm: p, creature: false, land: g.isLand(p) }); v += harm ? (mine ? -50 : val) : bad ? -val : (mine ? val : -val); }
    } else if (o.ref?.kind === 'player') v += harm ? (o.ref.id === pid ? -50 : 5) : (o.ref.id === pid ? 5 : 0);
    else if (o.card) v += cardValue(g, pid, o.card) * (bad ? -1 : 1);
    return v;
  };
  return [...opts].sort((a, b) => score(b) - score(a)).slice(0, need).map((o) => o.value);
}
// ---- opening hand: keep 2-5 lands of 7, mulligan 0-1 or 6-7 unless the hand is very cheap (engine: 'mulligan' / 'bottom' waits)
function keepOpening(g, pid, w) {
  const hand = w.hand || g.players[pid].hand;
  const isLand = (c) => c.def.types.includes('Land');
  const lands = hand.filter(isLand).length, spells = hand.filter((c) => !isLand(c));
  const avg = spells.length ? spells.reduce((t, c) => t + cmc(c), 0) / spells.length : 9;
  const cheap = avg <= 2 && spells.some((c) => cmc(c) <= 2);
  const size = hand.length;
  if (!w.canMulligan || (w.count || 0) >= 3) return lands >= 1 || !w.canMulligan;       // never spiral below 4 cards
  if (level() === 'easy') return lands >= 1 && lands <= size - 1;
  if (lands >= 2 && lands <= 5) return true;
  if (cheap && (lands === 1 || lands === 6) && (w.count || 0) === 0 && level() === 'hard') return true;
  if ((w.count || 0) >= 1 && lands >= 1 && lands <= size - 2) return true;           // a 6-card hand with 1 land and play is still better than 5
  return false;
}
function chooseBottom(g, pid, w) {
  const hand = [...(w.hand || g.players[pid].hand)];
  const isLand = (c) => c.def.types.includes('Land');
  const lands = hand.filter(isLand).length;
  const score = (c) => (isLand(c) ? (lands > 4 ? 6 : lands <= 2 ? -9 : -2) : cmc(c) - (EFFECTS[c.def.name] && ['removal', 'burn', 'counter'].includes(hintOf(EFFECTS[c.def.name], c.def)) ? 2 : 0));
  return hand.sort((a, b) => score(b) - score(a)).slice(0, w.n);
}
const WAITING_HANDLERS = {
  mulligan(g, pid, w) { if (keepOpening(g, pid, w)) g.keepHand(pid); else if (!g.mulligan(pid)) g.keepHand(pid); },
  bottom(g, pid, w) { g.bottomCards(pid, chooseBottom(g, pid, w)); },
  // engine choices ("may", searches, modes, X): sensible answers, engine auto-answer as the safety net
  choice(g, pid, w) {
    // engine bug guard (docs/ENGINE_REQUESTS.md, 'ai legends'): g.waiting can show a stale prompt while a different ask is live
    if (g.curAsk && g.curAsk.req !== undefined && (g.curAsk.req.prompt || '') !== (w.prompt || '')) { w = { kind: 'choice', player: g.curAsk.pid, type: g.curAsk.req.type, prompt: g.curAsk.req.prompt || '', ...g.curAsk.req }; pid = g.curAsk.pid; }
    let a;
    try { a = answerChoice(g, pid, w); } catch (e) { a = undefined; (g.aiErrors ||= []).push(String(e && e.stack || e)); }
    if (a === undefined || !g.choose(pid, a)) {
      const b = g.autoAnswer?.(); if (b === undefined || !g.choose(pid, b)) g.pass(pid);
    }
  },
};
function handleOtherWaiting(g, pid, w) { WAITING_HANDLERS[w.kind]?.(g, pid, w); }

function chooseDiscard(g, pid) {
  const me = g.players[pid];
  const lands = me.bf.filter((p) => g.isLand(p)).length;
  const score = (c) => { const isL = c.def.types.includes('Land'); return isL ? (lands >= 5 ? 20 : -5) : cmc(c) > lands + 3 ? 12 : 10 - Math.abs(cmc(c) - 3); };
  const c = [...me.hand].sort((a, b) => score(b) - score(a))[0];
  g.discard(pid, c);
}

function fallback(g, pid, w) {
  const me = g.players[pid];
  if (w.kind === 'discard') g.discard(pid, me.hand[0]);
  else if (w.kind === 'attackers') g.declareAttackers(pid, []);
  else if (w.kind === 'blockers') g.declareBlockers(pid, {});
  else if (w.kind === 'priority') g.pass(pid);
  else if (w.kind === 'mulligan') g.keepHand?.(pid);
  else if (w.kind === 'bottom') g.bottomCards?.(pid, [...g.players[pid].hand].slice(0, w.n));
  else if (w.kind === 'choice' && g.choose) { // last resort: smallest legal answer
    const a = w.type === 'yesno' ? false : w.type === 'number' ? (w.min ?? 0) : (w.options || []).slice(0, w.min || 0).map((o) => o.value);
    g.choose(pid, a);
  }
}

function priority(g, pid) {
  const m = mem(g);
  if (++m.n > 60) return void g.pass(pid);                  // runaway guard
  const top = g.stack[g.stack.length - 1];
  if (top) {
    if (top.controller !== pid && !(level() === 'easy' && rnd() < 0.5) && respondToStack(g, pid, top)) return;
    return void g.pass(pid);
  }
  const mine = g.active === pid;
  const mode = g.hasMainTiming(pid) ? 'main' : mine ? (g.step === 'end' ? 'end' : 'combat') : (g.step === 'end' ? 'end' : 'oppCombat');
  if (level() !== 'easy' && (g.step === 'blockers' || (g.step === 'attackers' && !mine))) {
    const plans = combatPumpPlans(g, pid).sort((a, b) => b.score - a.score);
    for (const p of plans) if (runPlan(g, pid, p)) return;
  }
  if (mode === 'main' || mode === 'end' || (mode === 'oppCombat' && (g.step === 'attackers' || g.step === 'blockers'))) {
    if (mode === 'main' && playLand(g, pid)) return;
    let plans = [...spellPlans(g, pid, mode), ...abilityPlans(g, pid, mode)].sort((a, b) => b.score - a.score);
    if (level() === 'easy') {
      // holds back removal, forgets to cast things now and then
      plans = plans.filter((p) => !(['removal', 'sweeper'].includes(p.hint) && rnd() < 0.5) && !(p.score < 1000 && rnd() < 0.08));
    } else if (level() === 'hard' && mode === 'main') plans = hardOrder(g, pid, plans);
    for (const p of plans) if (runPlan(g, pid, p)) return;
  }
  g.pass(pid);
}

function playLand(g, pid) {
  const me = g.players[pid];
  if (me.landPlayed) return false;
  const lands = me.hand.filter((c) => g.canPlayLand(pid, c)); if (!lands.length) return false;
  const need = {}, have = {};
  for (const c of me.hand) { const mc = parseCost(c.def.manaCost); for (const k of 'WUBRG') need[k] = (need[k] || 0) + mc[k]; }
  for (const p of me.bf) for (const ab of abilitiesOf(p.card.def)) if (ab.mana) for (const k of ab.mana.colors) have[k] = (have[k] || 0) + 1;
  const colors = (c) => abilitiesOf(c.def).find((a) => a.mana)?.mana.colors || [];
  const val = (c) => { const cs = colors(c); if (!cs.length) return -2; return Math.max(...cs.map((k) => (need[k] || 0) - (have[k] || 0))) + (cs.length > 1 ? 0.5 : 0); };
  lands.sort((a, b) => val(b) - val(a));
  return g.playLand(pid, lands[0]);
}

// ---------------------------------------------------------------- attacking
function unblockedDamage(g, attackers, defenders) {
  // greedy: each defender blocks the strongest attacker it can legally block
  const left = [...defenders]; let dmg = 0;
  for (const a of [...attackers].sort((x, y) => g.power(y) - g.power(x))) {
    const i = left.findIndex((b) => g.canBlock({ ...b, tapped: false }, a));
    if (i >= 0) left.splice(i, 1); else dmg += g.power(a);
  }
  return dmg;
}

// Hard: keep counterspell mana up, spend mana efficiently (best subset of mid-priority plays first).
function hardOrder(g, pid, plans) {
  const me = g.players[pid], foe = g.players[1 - pid];
  const avail = availMana(g, pid);
  let reserve = 0;
  for (const c of me.hand) { const e = EFFECTS[c.def.name]; if (e && hintOf(e, c.def) === 'counter' && g.canCast(pid, c)) reserve = Math.max(reserve, cmc(c)); }
  const behind = boardValue(g, 1 - pid) > boardValue(g, pid);
  if (reserve && foe.hand.length >= 1 && avail >= reserve + 1) {
    plans = plans.filter((p) => p.score >= 150 || p.ability || (p.cost ?? 0) + reserve <= avail || (p.creature && behind));
  }
  const top = plans.filter((p) => p.score >= 150 || p.ability);
  const rest = plans.filter((p) => !(p.score >= 150 || p.ability));
  const cs = rest.slice(0, 8); let best = null, bestV = -1;
  for (let mask = 1; mask < 1 << cs.length; mask++) {
    let cost = 0, sc = 0;
    for (let i = 0; i < cs.length; i++) if (mask & (1 << i)) { cost += cs[i].cost ?? 0; sc += cs[i].score; }
    if (cost > avail) continue;
    const v = cost * 10 + sc / 100;
    if (v > bestV) { bestV = v; best = mask; }
  }
  const chosen = best ? cs.filter((_, i) => best & (1 << i)).sort((a, b) => b.score - a.score) : [];
  return [...top, ...chosen, ...rest.filter((p) => !chosen.includes(p))];
}

// Hard: pick the attack set by simulating the opponent's best blocks (1-ply, using the same block logic from their side).
function simulateAttack(g, pid, S) {
  const me = g.players[pid], foe = g.players[1 - pid];
  const saved = g.combat; let map;
  g.combat = { attackers: S.map((p) => p.id), blocks: {} };
  try { map = chooseBlocks(g, 1 - pid); } finally { g.combat = saved; }
  const open = foe.hand.length > 0 && g.manaSources(1 - pid).length > 0 ? 1.15 : 1;
  let dmg = 0, score = 0;
  for (const a of S) {
    const bl = (map[a.id] || []).map((b) => g.perm(b)).filter(Boolean);
    if (!bl.length) { dmg += g.power(a); continue; }
    let aDies, bDies;
    if (bl.length === 1) ({ aDies, bDies } = duel(g, a, bl[0]));
    else { aDies = bl.reduce((t, b) => t + g.power(b), 0) >= lifeLeft(g, a); bDies = g.power(a) >= lifeLeft(g, bl[0]); }
    if (aDies) score -= valuePerm(g, a) * open;
    if (bDies) score += valuePerm(g, bl[0]);
  }
  if (dmg >= foe.life) return 1e4;
  score += dmg * (foe.life <= 10 ? 1.3 : 0.8);
  const stay = me.bf.filter((p) => g.isCreature(p) && (!S.includes(p) || g.kw(p).has('vigilance')) && !p.tapped);
  const inc = unblockedDamage(g, creaturesOf(g, 1 - pid), stay);
  if (me.life - inc <= 0) return -1e4;
  score -= inc * (me.life <= 10 ? 0.9 : 0.35);
  return score;
}
function hardAttackers(g, pid, mine) {
  const cand = [...mine].sort((a, b) => valuePerm(g, b) - valuePerm(g, a)).slice(0, 8);
  let best = [], bestV = simulateAttack(g, pid, []);
  for (let mask = 1; mask < 1 << cand.length; mask++) {
    const S = cand.filter((_, i) => mask & (1 << i));
    const v = simulateAttack(g, pid, S) + 0.01 * S.length;
    if (v > bestV) { bestV = v; best = S; }
  }
  return best.map((p) => p.id);
}

export function chooseAttackers(g, pid) {
  const ids = chooseAttackers0(g, pid);
  if (level() === 'hard') { const mine = g.players[pid].bf.filter((p) => g.canAttack(p)); if (mine.length) return hardAttackers(g, pid, mine); }
  if (level() === 'easy') {            // conservative: only attackers no blocker can kill, and sometimes stays home
    const foeB = g.players[1 - pid].bf.filter((p) => g.isCreature(p) && !p.tapped);
    return ids.filter((id) => { const a = g.perm(id); return !foeB.some((b) => g.canBlock(b, a) && duel(g, a, b).aDies) && rnd() > 0.1; });
  }
  return ids;
}
function chooseAttackers0(g, pid) {
  const me = g.players[pid], foe = g.players[1 - pid];
  const mine = me.bf.filter((p) => g.canAttack(p));
  if (!mine.length) return [];
  const blockers = foe.bf.filter((p) => g.isCreature(p) && !p.tapped);
  const myPower = mine.reduce((a, p) => a + g.power(p), 0);
  const theirTeam = creaturesOf(g, 1 - pid);
  const theirPower = theirTeam.reduce((a, p) => a + g.power(p), 0);

  // all-in lethal: assume they block the biggest attackers they can
  const lethalDmg = unblockedDamage(g, mine, blockers);
  if (lethalDmg >= foe.life) return mine.map((p) => p.id);

  const myClock = myPower > 0 ? Math.ceil(foe.life / myPower) : 99, theirClock = theirPower > 0 ? Math.ceil(me.life / theirPower) : 99;
  const ahead = myClock <= theirClock && boardValue(g, pid) >= boardValue(g, 1 - pid) * 0.9;
  const behind = theirClock < myClock && me.life <= 12;

  const out = [];
  for (const a of mine) {
    const bs = blockers.filter((b) => g.canBlock(b, a));
    if (!bs.length) { out.push(a); continue; }
    const res = bs.map((b) => ({ b, ...duel(g, a, b) }));
    const bad = res.some((r) => r.aDies && !r.bDies);
    const trades = res.filter((r) => r.aDies && r.bDies);
    // double-block danger
    const top2 = bs.map((b) => g.power(b)).sort((x, y) => y - x).slice(0, 2).reduce((s, x) => s + x, 0);
    const gang = bs.length >= 2 && top2 >= lifeLeft(g, a) && !res.some((r) => r.bDies && valuePerm(g, r.b) >= valuePerm(g, a));
    if (bad) continue;
    if (trades.length) {
      const worstTrade = Math.min(...trades.map((r) => valuePerm(g, r.b)));
      if (behind) continue;
      if (valuePerm(g, a) <= worstTrade + (ahead ? 1.5 : -0.5)) { out.push(a); }
      continue;
    }
    if (gang && !ahead) continue;
    out.push(a);
  }

  // keep enough defence home
  const stay = () => me.bf.filter((p) => g.isCreature(p) && (!out.includes(p) || g.kw(p).has('vigilance')) && !p.tapped);
  const safeLimit = behind ? Math.min(6, me.life - 1) : 2;
  const danger = () => me.life - unblockedDamage(g, theirTeam.filter((p) => !p.tapped || true), stay());
  const toRemove = [...out].sort((x, y) => (g.kw(x).has('flying') ? 1 : 0) - (g.kw(y).has('flying') ? 1 : 0) || lifeLeft(g, y) - lifeLeft(g, x));
  while (out.length && me.life - unblockedDamage(g, theirTeam, stay()) <= safeLimit - (ahead ? 1 : 0) && lethalDmg < foe.life) {
    const r = toRemove.shift(); if (!r) break;
    const i = out.indexOf(r); if (i >= 0) out.splice(i, 1);
  }
  return out.map((p) => p.id);
}

// ---------------------------------------------------------------- blocking
export function chooseBlocks(g, pid) {
  const map = chooseBlocks0(g, pid);
  if (level() === 'easy') {
    const me = g.players[pid];
    const inc = (g.combat.attackers || []).map((a) => g.perm(a)).filter(Boolean).reduce((t, a) => t + g.power(a), 0);
    if (inc < me.life - 4) for (const k of Object.keys(map)) if (rnd() < 0.2) delete map[k];   // misses a block when not in danger
  }
  return map;
}
function chooseBlocks0(g, pid) {
  const me = g.players[pid];
  const atk = (g.combat.attackers || []).map((a) => g.perm(a)).filter(Boolean);
  const free = me.bf.filter((p) => g.isCreature(p) && !p.tapped);
  const map = {}; const used = new Set();
  const order = [...atk].sort((x, y) => g.power(y) - g.power(x));
  const put = (a, bs) => { for (const b of bs) used.add(b.id); map[a.id] = bs.map((b) => b.id); };
  const avail = (a) => free.filter((b) => !used.has(b.id) && g.canBlock(b, a));
  const incomingLeft = () => atk.filter((a) => !map[a.id]).reduce((s, a) => s + g.power(a), 0);
  const lifeAfter = () => me.life - incomingLeft();

  // pass 1: profitable blocks
  for (const a of order) {
    const opts = avail(a); if (!opts.length) continue;
    const res = opts.map((b) => ({ b, ...duel(g, a, b) }));
    const safeKill = res.filter((r) => !r.aDies && r.bDies).sort((x, y) => valuePerm(g, x.b) - valuePerm(g, y.b));
    if (safeKill.length) { put(a, [safeKill[0].b]); continue; }
    const trade = res.filter((r) => r.aDies && r.bDies && valuePerm(g, r.b) <= valuePerm(g, a) + 1.5).sort((x, y) => valuePerm(g, x.b) - valuePerm(g, y.b));
    if (trade.length && (valuePerm(g, trade[0].b) <= valuePerm(g, a) || lifeAfter() <= 10)) { put(a, [trade[0].b]); continue; }
    // gang block: two or more creatures kill it, at most one dies
    if (opts.length >= 2) {
      const pairs = [];
      for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) {
        const x = opts[i], y = opts[j];
        if (g.power(x) + g.power(y) < lifeLeft(g, a) && !g.kw(x).has('deathtouch') && !g.kw(y).has('deathtouch')) continue;
        const ap = g.power(a);
        const lose = [x, y].filter((z) => ap >= lifeLeft(g, z)); // worst case it can kill one (or both if power is large)
        const lost = ap >= lifeLeft(g, x) + lifeLeft(g, y) ? [x, y] : lose.length ? [lose.sort((p, q) => valuePerm(g, q) - valuePerm(g, p))[0]] : [];
        const cost = lost.reduce((s, z) => s + valuePerm(g, z), 0);
        if (cost <= valuePerm(g, a)) pairs.push({ x, y, cost });
      }
      pairs.sort((p, q) => p.cost - q.cost);
      if (pairs.length) { put(a, [pairs[0].x, pairs[0].y]); continue; }
    }
    // safe absorb (blocker survives, attacker survives): fine when life matters
    const safe = res.filter((r) => !r.bDies).sort((x, y) => valuePerm(g, x.b) - valuePerm(g, y.b));
    if (safe.length && lifeAfter() <= 14) { put(a, [safe[0].b]); continue; }
  }
  // pass 2: chump blocks while the race is lost
  const careful = () => lifeAfter() <= 0 || (lifeAfter() <= 4);
  for (const a of order) {
    if (map[a.id] || !careful()) continue;
    const opts = avail(a).sort((x, y) => valuePerm(g, x) - valuePerm(g, y)); if (!opts.length) continue;
    if (lifeAfter() > 0 && g.power(a) < 3 && lifeAfter() > 2) continue;
    put(a, [opts[0]]);
  }
  return map;
}
