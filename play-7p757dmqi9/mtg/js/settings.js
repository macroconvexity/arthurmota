// Persisted user settings (localStorage) with change listeners.
const KEY = 'mtgclassic.settings.v1';
const DEFAULTS = { sound: true, volume: 0.7, speed: 'normal', stopOppSpell: true, stopMyBegin: false, stopOppEnd: false, difficulty: 'normal', playmat: 2, haptics: true, pips: true, lefty: false, onboarded: false };
let cur = { ...DEFAULTS };
const subs = new Set();
const rd = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
try { cur = { ...DEFAULTS, ...rd() }; const old = localStorage.getItem('mtgclassic.playmat'); if (old && !rd().playmat) cur.playmat = +old || 1; } catch {}
export const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
export const get = (k) => cur[k];
export const all = () => ({ ...cur });
export function set(k, v) { cur[k] = v; try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch {} for (const f of subs) f(k, v); }
export const onChange = (f) => { subs.add(f); return () => subs.delete(f); };
// animation time scale: 1 = designed timings
export const animScale = () => (reducedMotion() ? 0.12 : { fast: 0.5, normal: 1, slow: 1.6 }[cur.speed] ?? 1);
export const haptic = (ms = 12) => { if (cur.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch {} };
export function applyClasses() {
  const c = document.documentElement.classList;
  c.toggle('nopips', !cur.pips); c.toggle('lefty', !!cur.lefty); c.toggle('reduced', reducedMotion());
  window.__fxOff = reducedMotion();
}
