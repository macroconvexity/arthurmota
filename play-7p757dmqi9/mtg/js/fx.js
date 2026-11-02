// Small DOM/WAAPI effects layer (no canvas): bursts, rings, lightning, orbs, screen flashes.
const layer = () => document.getElementById('fx') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'fx' });
const rnd = (a, b) => a + Math.random() * (b - a);
function add(el, anim, dur, opts = {}) { layer().appendChild(el); const a = el.animate(anim, { duration: dur, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards', ...opts }); a.onfinish = () => el.remove(); return a; }
export function burst(x, y, { color = '#ffb347', n = 14, dist = 80, size = 6, dur = 650 } = {}) {
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i'); const s = rnd(size * 0.5, size * 1.3);
    Object.assign(d.style, { position: 'fixed', left: x - s / 2 + 'px', top: y - s / 2 + 'px', width: s + 'px', height: s + 'px', borderRadius: '50%', background: color, boxShadow: `0 0 ${s * 2}px ${color}` });
    const ang = rnd(0, Math.PI * 2), r = rnd(dist * 0.4, dist);
    add(d, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * r}px,${Math.sin(ang) * r - 14}px) scale(.1)`, opacity: 0 }], dur * rnd(0.7, 1.2));
  }
}
export function ring(x, y, { color = '#f3c978', size = 40, grow = 4, dur = 520, width = 3 } = {}) {
  const d = document.createElement('i');
  Object.assign(d.style, { position: 'fixed', left: x - size / 2 + 'px', top: y - size / 2 + 'px', width: size + 'px', height: size + 'px', borderRadius: '50%', border: `${width}px solid ${color}`, boxShadow: `0 0 18px ${color}, inset 0 0 14px ${color}` });
  add(d, [{ transform: 'scale(.3)', opacity: 0.95 }, { transform: `scale(${grow})`, opacity: 0 }], dur);
}
export function bolt(a, b, { color = '#9fd4ff' } = {}) {
  const NS = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(NS, 'svg');
  Object.assign(svg.style, { position: 'fixed', inset: 0, width: '100%', height: '100%', overflow: 'visible' });
  const pts = []; const N = 9, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  for (let i = 0; i <= N; i++) { const t = i / N, j = i === 0 || i === N ? 0 : rnd(-1, 1) * len * 0.06; pts.push(`${a[0] + dx * t + nx * j},${a[1] + dy * t + ny * j}`); }
  for (const [w, c, op] of [[10, color, 0.35], [4, color, 0.9], [1.6, '#fff', 1]]) {
    const p = document.createElementNS(NS, 'polyline'); p.setAttribute('points', pts.join(' ')); p.setAttribute('fill', 'none'); p.setAttribute('stroke', c); p.setAttribute('stroke-width', w); p.setAttribute('stroke-linejoin', 'round'); p.setAttribute('stroke-linecap', 'round'); p.style.opacity = op; svg.appendChild(p);
  }
  add(svg, [{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0.1 }, { opacity: 0.8 }, { opacity: 0 }], 420, { easing: 'linear' });
}
export function orb(a, b, { color = '#ffb347', dur = 360, size = 22 } = {}) {
  const d = document.createElement('i');
  Object.assign(d.style, { position: 'fixed', left: a[0] - size / 2 + 'px', top: a[1] - size / 2 + 'px', width: size + 'px', height: size + 'px', borderRadius: '50%', background: `radial-gradient(#fff,${color} 55%,transparent 72%)`, boxShadow: `0 0 26px 8px ${color}` });
  add(d, [{ transform: 'translate(0,0) scale(.6)' }, { transform: `translate(${b[0] - a[0]}px,${b[1] - a[1]}px) scale(1.2)` }], dur, { easing: 'cubic-bezier(.5,0,.9,.5)' });
}
export function flash(color = '#fff', dur = 600, peak = 0.7) {
  const d = document.createElement('i');
  Object.assign(d.style, { position: 'fixed', inset: 0, background: color });
  add(d, [{ opacity: 0 }, { opacity: peak, offset: 0.15 }, { opacity: 0 }], dur, { easing: 'ease-out' });
}
export function shockwave(x, y, { color = '#fff', size = 60, grow = 16, dur = 850 } = {}) {
  ring(x, y, { color, size, grow, dur, width: 7 }); ring(x, y, { color, size: size * 0.6, grow: grow * 0.7, dur: dur * 0.8, width: 3 });
}
// Slow upward drift of pale motes (exile).
export function motes(x, y, { color = '#d6ecff', n = 18, spread = 50, rise = 110, dur = 1000 } = {}) {
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i'); const s = rnd(3, 7);
    Object.assign(d.style, { position: 'fixed', left: x + rnd(-spread, spread) - s / 2 + 'px', top: y + rnd(-spread, spread) - s / 2 + 'px', width: s + 'px', height: s + 'px', borderRadius: '50%', background: color, boxShadow: `0 0 ${s * 3}px ${color}` });
    add(d, [{ transform: 'translateY(0) scale(.6)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: `translateY(${-rise * rnd(0.6, 1.2)}px) scale(1)`, opacity: 0 }], dur * rnd(0.7, 1.2), { delay: rnd(0, 250), easing: 'ease-out' });
  }
}
// Soft glow blob (cast, buffs, heals).
export function glow(x, y, { color = '#7dff9a', size = 120, dur = 700, peak = 0.9 } = {}) {
  const d = document.createElement('i');
  Object.assign(d.style, { position: 'fixed', left: x - size / 2 + 'px', top: y - size / 2 + 'px', width: size + 'px', height: size + 'px', borderRadius: '50%', background: `radial-gradient(${color},${color}00 68%)`, mixBlendMode: 'screen' });
  add(d, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: peak, offset: 0.35 }, { transform: 'scale(1.3)', opacity: 0 }], dur, { easing: 'ease-out' });
}
// Falling confetti for the victory screen.
export function confetti(n = 70) {
  const cols = ['#f3c978', '#ff9b3d', '#7fc4ff', '#7dff9a', '#ff6a55', '#fff'];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i'); const w = rnd(6, 11);
    Object.assign(d.style, { position: 'fixed', left: rnd(0, innerWidth) + 'px', top: '-20px', width: w + 'px', height: w * 0.5 + 'px', background: cols[i % cols.length], zIndex: 300 });
    add(d, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${rnd(-120, 120)}px,${innerHeight + 40}px) rotate(${rnd(180, 900)}deg)`, opacity: 0.9 }], rnd(1800, 3200), { delay: rnd(0, 900), easing: 'cubic-bezier(.3,.1,.6,1)' });
  }
}
