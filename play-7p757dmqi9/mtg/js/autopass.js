// Pure auto-pass decision (shared by the UI and test/phase_audit.mjs). Returns {stop, idle}:
// stop=true -> wait for the human; idle=true -> skipped because the human has nothing to do (UI shows a toast).
// opts: {stopOppSpell, stopMyBegin, stopOppEnd, respectPhases, autoSkip, holdPh, phOf}
// respectPhases (Arena-like, default on): in EVERY step with a priority window, mine or the opponent's, stop when I can actually cast/activate something.
export function decideStop(g, ME, o = {}) {
  const R = (stop, idle = false) => ({ stop, idle });
  const w = g.waiting; if (!w) return R(false);
  const skipOn = o.autoSkip !== false && typeof g.hasAnyAction === 'function';
  const ph = o.phOf ? o.phOf(g.step) : undefined;
  if (o.holdPh && g.active === ME && ph === o.holdPh && !g.stack.length && (w.kind === 'priority' || w.kind === 'attackers' || w.kind === 'blockers')) return R(true, false);
  if (w.kind === 'attackers' && w.player === ME && skipOn) { let can = true; try { can = g.canAttackAny(ME); } catch {} if (!can) return R(false, true); }
  if (w.kind === 'blockers' && w.player === ME && skipOn) {
    const can = g.players[ME].bf.some((p) => g.isCreature(p) && !p.tapped && g.combat.attackers.some((a) => { const at = g.perm(a); try { return at && g.canBlock(p, at); } catch { return true; } }));
    if (!can) return R(false, true);
  }
  if (w.kind !== 'priority') return R(true);
  const top = g.stack[g.stack.length - 1];
  if (g.active === ME && o.stopMyBegin && (g.step === 'upkeep' || g.step === 'draw') && !top) return R(true);
  if (g.active !== ME && o.stopOppEnd && g.step === 'end' && !top) return R(true);
  if (!top && o.respectPhases !== false && g.hasResponse(ME)) return R(true);
  if (top) return R(top.controller === ME || (o.stopOppSpell && g.hasResponse(ME)));
  if (g.active === ME) {
    if (g.step === 'main1' || g.step === 'main2') { if (skipOn) { let any = true; try { any = g.hasAnyAction(ME); } catch {} if (!any) return R(false, true); } return R(true); }
    return R(['attackers', 'blockers', 'damage'].includes(g.step) && g.hasResponse(ME));
  }
  // opponent's turn, empty stack: stop after the opponent cast/activated something this step (a creature just resolved, I hold an instant)
  if (o.stopOppSpell && g.stepActions > 0 && ['main1', 'main2', 'damage', 'end'].includes(g.step) && g.hasResponse(ME)) return R(true);
  return R(['attackers', 'blockers', 'damage'].includes(g.step) && g.hasResponse(ME));
}
