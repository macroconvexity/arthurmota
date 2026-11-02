// Arena-parity animation helpers (DOM/WAAPI only, no assets). Every effect is skipped when window.__fxOff is set
// (reduced motion / speed Off); durations and delays are scaled globally by the Element.animate wrapper in ui.js.
import * as FX from './fx.js?v=20261102171740';
const NS = 'http://www.w3.org/2000/svg';
const rnd = (a, b) => a + Math.random() * (b - a);
const off = () => !!window.__fxOff;
const ctr = (r) => [r.left + r.width / 2, r.top + r.height / 2];
export function layer() { return document.getElementById('animlayer') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'animlayer' }); }
function sprite(cls, css, html = '') { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, { position: 'fixed', pointerEvents: 'none', ...css }); d.innerHTML = html; layer().appendChild(d); return d; }
function fin(a, el) { a.onfinish = a.oncancel = () => el.remove(); return a; }

export function denyPulse(el) {
  if (off() || !el) return; el.animate([{ boxShadow: '0 0 0 0 #ff3b2a00' }, { boxShadow: '0 0 0 4px #ff3b2a, 0 0 24px 6px #ff3b2acc', offset: 0.3 }, { boxShadow: '0 0 0 0 #ff3b2a00' }], { duration: 520 });
  el.animate([{ rotate: '0deg' }, { rotate: '-2.5deg' }, { rotate: '2.5deg' }, { rotate: '-1.5deg' }, { rotate: '0deg' }], { duration: 320 });
}
export function pulseEl(el, color = '#ffd27a', size = 14) {
  if (off() || !el) return; el.animate([{ filter: 'none' }, { filter: `brightness(1.7) drop-shadow(0 0 ${size}px ${color})`, offset: 0.35 }, { filter: 'none' }], { duration: 650, easing: 'ease-out' });
}
export function floatText(x, y, text, color = '#7dff9a') {
  if (off()) return; const el = sprite('ftxt', { left: x + 'px', top: y + 'px', color, zIndex: 246, font: '700 26px Georgia', textShadow: '0 0 10px #000,0 0 14px ' + color, transform: 'translate(-50%,-50%)' }, text);
  fin(el.animate([{ opacity: 0, transform: 'translate(-50%,-30%) scale(.6)' }, { opacity: 1, offset: 0.2, transform: 'translate(-50%,-80%) scale(1.1)' }, { opacity: 0, transform: 'translate(-50%,-190%) scale(1)' }], { duration: 1100, easing: 'ease-out', fill: 'forwards' }), el);
}
export { shatter, implode, drainStream } from './anim/status.js?v=20261102171740';
