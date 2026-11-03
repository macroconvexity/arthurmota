// Priority A: card motion between zones (draw, mill, discard, resolve, bounce, reanimate, return-to-library, shuffle,
// pile pulses) and the untap stagger. Everything is skipped when window.__fxOff is set; durations are scaled by the
// global Element.animate wrapper in ui.js. See docs/ANIMATIONS.md.
import * as FX from '../fx.js?v=20261102200655';
const rnd = (a, b) => a + Math.random() * (b - a);
const off = () => !!window.__fxOff;
const ctr = (r) => [r.left + r.width / 2, r.top + r.height / 2];
let ctx = {};
export const init = (c) => { ctx = c || {}; };
function layer() { return document.getElementById('animlayer') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'animlayer' }); }
function sprite(cls, css, html = '') { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, { position: 'fixed', pointerEvents: 'none', ...css }); d.innerHTML = html; layer().appendChild(d); return d; }
function fin(a, el) { a.onfinish = a.oncancel = () => el.remove(); return a; }
// A: a card back flies from a pile to a slot and turns edge-on as the real card appears (draw), or streams pile -> pile (mill)
export function cardBackFly(src, dst, { delay = 0, dur = 380, w } = {}) {
  if (off() || !src || !dst) return; const [sx, sy] = ctr(src), [dx, dy] = ctr(dst); const cw = w || dst.width;
  const el = sprite('cb fly', { left: sx - cw / 2 + 'px', top: sy - cw * 0.6965 + 'px', width: cw + 'px', height: cw * 1.393 + 'px', zIndex: 245, borderRadius: '4.5%' });
  fin(el.animate([{ transform: 'translate(0,0) scale(.7) rotateY(0)', opacity: 1 }, { transform: `translate(${(dx - sx) * 0.7}px,${(dy - sy) * 0.7 - 20}px) scale(1) rotateY(0)`, offset: 0.7 }, { transform: `translate(${dx - sx}px,${dy - sy}px) scale(1) rotateY(90deg)`, opacity: 1 }], { duration: dur, delay, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' }), el);
}
export function millStream(src, dst, n) {
  if (off() || !src || !dst) return; const k = Math.min(n, 6);
  for (let i = 0; i < k; i++) { const [sx, sy] = ctr(src), [dx, dy] = ctr(dst); const w = src.width;
    const el = sprite('cb fly', { left: sx - w / 2 + 'px', top: sy - w * 0.6965 + 'px', width: w + 'px', height: w * 1.393 + 'px', zIndex: 245, borderRadius: '4.5%' });
    fin(el.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: `translate(${dx - sx}px,${dy - sy}px) scale(.8) rotate(${rnd(-12, 12)}deg)`, opacity: 0.1 }], { duration: 480, delay: i * 90, easing: 'ease-in', fill: 'both' }), el); }
}
export function pilePulse(el, color = '#f3c978') {
  if (off() || !el) return; el.animate([{ filter: 'brightness(1)', transform: 'scale(1)' }, { filter: `brightness(1.6) drop-shadow(0 0 10px ${color})`, transform: 'scale(1.08)', offset: 0.35 }, { filter: 'brightness(1)', transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
  const c = el.querySelector('.cnt'); c?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.7)', color }, { transform: 'scale(1)' }], { duration: 480, easing: 'cubic-bezier(.2,1.6,.4,1)' });
}
// pile riffle: two halves split and interleave
export function riffle(r) {
  if (off() || !r) return; const [x, y] = ctr(r), w = r.width;
  for (const s of [-1, 1]) { const el = sprite('cb fly', { left: x - w / 2 + 'px', top: y - w * 0.6965 + 'px', width: w + 'px', height: w * 1.393 + 'px', zIndex: 245, borderRadius: '4.5%' });
    fin(el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${s * w * 0.45}px,-6px) rotate(${s * 8}deg)`, offset: 0.35 }, { transform: 'translate(0,0)', offset: 0.7 }, { transform: `translate(${s * w * 0.3}px,-4px) rotate(${s * 5}deg)`, offset: 0.82 }, { transform: 'translate(0,0)', opacity: 0.2 }], { duration: 700, easing: 'ease-in-out', fill: 'both' }), el); }
}


// ---- pile counts -> pulses and mill streams (derived from DOM/state counts, no engine events needed)
let prevCnt = null;
export const resetCounts = () => { prevCnt = null; };
export function pileFx(cnt, skip) {
  const was = prevCnt; prevCnt = cnt; if (!was || skip) return;
  setTimeout(() => {
    const el = (pl, k) => document.querySelector(`#zones-${pl ? 'opp' : 'me'} .pile:nth-child(${k})`);
    for (const pl of [0, 1]) {
      const li = pl ? 2 : 0, gi = pl ? 3 : 1, hi = pl ? 5 : 4; const dLib = was[li] - cnt[li], dGy = cnt[gi] - was[gi], dHand = cnt[hi] - was[hi];
      if (dGy > 0) pilePulse(el(pl, 2), '#c9b8ff');
      if (dLib !== 0) pilePulse(el(pl, 1), dLib > 0 ? '#8fd0ff' : '#f3c978');
      if (dLib > 0 && dGy > 0 && dHand <= 0) millStream(el(pl, 1)?.getBoundingClientRect(), el(pl, 2)?.getBoundingClientRect(), Math.min(dLib, dGy));
    }
  }, 0);
}
// ---- untap step: staggered untap (id -> delay ms), filled by onEvents and read by animateFrom
export const untapDelay = new Map();
export function onEvents(evs) {
  untapDelay.clear(); let i = 0;
  for (const e of evs) if (e.type === 'untap') untapDelay.set(e.id, (i++) * 70);
}
// ---- draw: card back flies pile -> hand slot and turns edge-on while the real card appears (n = index in a batch)
export function drawFly(el, src, n, batch) {
  const d = (batch >= 3 ? 40 : 90) * n;
  el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: 430, delay: d, fill: 'backwards' });
  cardBackFly(src, el.getBoundingClientRect(), { delay: d, dur: 300, w: el.offsetWidth }); return d;
}
export { FX };
