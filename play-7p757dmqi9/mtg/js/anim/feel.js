// Game feel (2026-11-16): weight for the four moments that carry the flavour of playing cards.
//   slam + dust + thud : a permanent hits the table
//   lungeKeys          : attackers wind up, strike and recoil, scaled by power
//   soul               : a dying creature's light travels to its graveyard
// (Declared-block lines live in ui.js, drawDeclared.) DOM/WAAPI only, no assets. Everything is skipped when
// window.__fxOff is set; Element.animate durations are scaled by the wrapper in ui.js.
import * as FX from '../fx.js?v=20261116114447';
const off = () => !!window.__fxOff;
const rnd = (a, b) => a + Math.random() * (b - a);
const layer = () => document.getElementById('fx') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'fx' });
function sprite(css) { const d = document.createElement('div'); Object.assign(d.style, { position: 'fixed', pointerEvents: 'none', zIndex: 140 }, css); layer().appendChild(d); return d; }
const fin = (a, el) => { a.onfinish = () => el.remove(); return a; };

// the card comes down oversized and settles: call ~180ms before the moment it should touch the table
export function slam(el, land) {
  if (off() || !el) return;
  el.animate([{ scale: land ? 1.14 : 1.3, filter: 'brightness(1.3) drop-shadow(0 14px 14px #000a)' }, { scale: land ? 0.985 : 0.94, filter: 'brightness(1)', offset: 0.6, easing: 'ease-out' }, { scale: 1 }],
    { duration: land ? 240 : 300, easing: 'cubic-bezier(.55,0,.9,.35)' });
}
// dust kicked sideways from under the card, plus a contact shadow. weight 0..1
export function dust(r, weight = 0.5) {
  if (off() || !r) return;
  const cx = r.left + r.width / 2, by = r.bottom - r.height * 0.06, n = Math.round(5 + weight * 9);
  const sh = sprite({ left: r.left - r.width * 0.12 + 'px', top: by - r.height * 0.07 + 'px', width: r.width * 1.24 + 'px', height: r.height * 0.16 + 'px', borderRadius: '50%', background: 'radial-gradient(#000b,#0000 70%)' });
  fin(sh.animate([{ opacity: 0.85, transform: 'scaleX(.8)' }, { opacity: 0, transform: 'scaleX(1.5)' }], { duration: 420 + 260 * weight, easing: 'ease-out' }), sh);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, s = r.width * rnd(0.22, 0.42) * (0.7 + weight * 0.6);
    const p = sprite({ left: cx + side * r.width * rnd(0.15, 0.48) - s / 2 + 'px', top: by - s / 2 + 'px', width: s + 'px', height: s + 'px', borderRadius: '50%', background: 'radial-gradient(#ecdcb4b0,#d8c49a55 45%,#0000 70%)', filter: 'blur(1.5px)' });
    fin(p.animate([{ transform: 'translate(0,0) scale(.5)', opacity: 0.85 }, { transform: `translate(${side * r.width * rnd(0.35, 0.95) * (0.6 + weight)}px,${-rnd(4, 20) * (0.5 + weight)}px) scale(${rnd(1.6, 2.6)})`, opacity: 0 }],
      { duration: rnd(480, 820) * (0.8 + weight * 0.5), easing: 'cubic-bezier(.1,.7,.3,1)' }), p);
  }
}
// short, stiff shake of the whole board
export function thud(amp = 4) {
  if (off()) return; const b = document.getElementById('board'); if (!b) return;
  const k = [0, 1, -0.7, 0.45, -0.2, 0].map((m, i) => ({ translate: `${(i % 2 ? 0.35 : -0.35) * m * amp}px ${m * amp}px`, offset: i / 5 }));
  b.animate(k, { duration: 230, easing: 'linear' });
}
// attacker keyframes: wind up away from the target, strike, recoil, return. Impact lands at IMPACT ms into the animation.
export const LUNGE_MS = 560, IMPACT = 190;
export function lungeKeys(off0, d, T, power = 2) {
  const p = Math.max(0, Math.min(8, power)), back = 0.1 + p * 0.012, big = 1 + 0.035 + p * 0.012, hitAt = IMPACT / LUNGE_MS;
  const at = (k) => `${off0[0] + d[0] * k}px ${off0[1] + d[1] * k}px`;
  return [
    { translate: at(0), scale: 1 },
    { translate: at(-back), scale: big, offset: hitAt * 0.42, easing: 'cubic-bezier(.7,0,.95,.35)' },
    { translate: at(1), scale: big, offset: hitAt },
    { translate: at(0.88), scale: 1, offset: hitAt + 0.09, easing: 'ease-out' },
    { translate: `${T[0]}px ${T[1]}px`, scale: 1 },
  ];
}
// a pale light leaves the dying card and sinks into its graveyard pile
export function soul(from, dest, dur = 620) {
  if (off() || !from || !dest) return;
  const a = [from.left + from.width / 2, from.top + from.height * 0.4], b = [dest.left + dest.width / 2, dest.top + dest.height / 2];
  FX.glow(a[0], a[1], { color: '#dfeeff', size: from.width * 1.6, dur: 420, peak: 0.7 });
  const s = from.width * 0.34, o = sprite({ left: a[0] - s / 2 + 'px', top: a[1] - s / 2 + 'px', width: s + 'px', height: s + 'px', borderRadius: '50%', background: 'radial-gradient(#fff,#cfe4ffcc 35%,#9fc4ff55 60%,#0000 72%)', filter: 'blur(1px)', zIndex: 160 });
  const mx = (a[0] + b[0]) / 2 - a[0], my = Math.min(a[1], b[1]) - from.height * 0.5 - a[1];
  fin(o.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 0 }, { transform: `translate(0,${-from.height * 0.18}px) scale(1.15)`, opacity: 1, offset: 0.22 }, { transform: `translate(${mx}px,${my}px) scale(1)`, opacity: 0.95, offset: 0.62 }, { transform: `translate(${b[0] - a[0]}px,${b[1] - a[1]}px) scale(.35)`, opacity: 0.2 }],
    { duration: dur, easing: 'cubic-bezier(.4,0,.6,1)' }), o);
}
