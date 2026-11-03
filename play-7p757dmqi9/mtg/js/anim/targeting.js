// Arena-style targeting and stack clarity (see docs/ANIMATIONS.md, "Targeting & stack").
//  - curved glowing SVG arrows: source -> pointer/target while choosing, source -> every target while on the stack
//  - hover highlight on valid targets, red "disqualified" feedback on invalid ones
//  - ability chips on the stack (source art thumbnail + short text), source permanent marked while its ability waits
//  - stack fan: depth, order badges, FLIP reflow, resolve flash
// DOM/SVG/WAAPI only. Informational arrows stay visible (static) under reduced motion / speed Off; every movement is skipped.
// Element.animate is globally time-scaled in ui.js, so WAAPI durations here are the designed ones; setTimeout delays use animScale().
import * as FX from '../fx.js?v=20261102200947';
import * as ST from '../settings.js?v=20261102200947';
import * as AN from '../anim.js?v=20261102200947';
const NS = 'http://www.w3.org/2000/svg';
const off = () => !!window.__fxOff;
const C = { mine: '#7fd0ff', opp: '#ff9c7a', ok: '#7dff9a', neutral: '#ffcf94', bad: '#ff4a3a', tether: '#ffd27a' };
const PRO = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };
let ctx = {}, svg = null, ring = null, raf = 0, uid = 0, ptr = null, curG = null;
const arrows = new Map();           // key -> arrow record
const recs = new Map();             // stack item id -> {rect, html, src, abil, color} refreshed every frame
let prevItems = new Map();          // stack item id -> {abil, src}
let prevPos = new Map();            // stack item id -> [x,y] relative to the panel centre (layout, ignores transforms)
let marked = new Set(), hot = null, evInfo = null, exits = [];

export function init(c) {
  ctx = c || {};
  if (init.done) return; init.done = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../../css/anim_targeting.css', import.meta.url).href; document.head.appendChild(l);
  document.documentElement.classList.add('tg-on');
  const set = (e) => { ptr = { x: e.clientX, y: e.clientY, type: e.pointerType || 'mouse', down: e.type === 'pointerdown' || (e.type === 'pointermove' && ptr?.down) }; if (e.type === 'pointerup' || e.type === 'pointercancel') ptr.down = false; if (ctx.mode?.()?.type === 'target') kick(); };
  for (const t of ['pointermove', 'pointerdown', 'pointerup', 'pointercancel']) document.addEventListener(t, set, true);
}
const G = () => ctx.g?.() || null;
const layer = () => document.getElementById('animlayer') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'animlayer' });
const rc = (el) => { const r = el?.getBoundingClientRect(); return r && r.width ? r : null; };
const cen = (r) => [r.left + r.width / 2, r.top + r.height / 2];
const later = (ms, fn) => setTimeout(fn, ms * ST.animScale());
function ensureSvg() {
  if (svg?.isConnected) return;
  svg = document.createElementNS(NS, 'svg'); svg.id = 'tgsvg';
  ring = document.createElementNS(NS, 'rect'); ring.setAttribute('class', 'tg-ring'); ring.style.display = 'none'; svg.appendChild(ring);
  layer().appendChild(svg); arrows.clear();
}
// where a ref lives on screen
function elOf(ref) {
  if (!ref) return null;
  if (ref.kind === 'player') return document.getElementById('life-' + ref.id);
  if (ref.kind === 'perm') return ctx.permEl(ref.id);
  if (ref.kind === 'spell') return document.querySelector(`#stack .card[data-sid="${ref.id}"]`);
  if (ref.kind === 'card') { const g = G(); const pl = g?.players.findIndex((p) => p.gy.some((c) => c.id === ref.id)); return pl >= 0 ? document.querySelector(`#stage .pile[data-pl="${pl}"][data-z="gy"]`) : null; }
  return null;
}
function edge(r, toward, pad) {
  const [cx, cy] = cen(r), dx = toward[0] - cx, dy = toward[1] - cy; if (!dx && !dy) return [cx, cy];
  const s = 1 / Math.max(Math.abs(dx) / (r.width / 2 + pad), Math.abs(dy) / (r.height / 2 + pad)); return s >= 1 ? [cx, cy] : [cx + dx * s, cy + dy * s];
}
// ---------- arrow records
function mk(key, o) {
  const id = 'tgg' + ++uid, g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'tg-a' + (o.small ? ' small' : '') + (o.cls ? ' ' + o.cls : ''));
  g.innerHTML = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="currentColor" stop-opacity=".1"/><stop offset="1" stop-color="currentColor"/></linearGradient>` +
    '<path class="g2"/><path class="g1"/><path class="core" stroke="url(#' + id + ')"/><path class="flow"/><polygon class="head"/><circle class="orig" r="4"/><circle class="tip"/>';
  const a = { key, g, grad: g.firstChild, paths: [...g.querySelectorAll('path')], head: g.querySelector('.head'), orig: g.querySelector('.orig'), tip: g.querySelector('.tip'), sig: '', color: '', last: null, stack: !!o.stack, small: !!o.small };
  svg.insertBefore(g, ring);
  if (!off()) g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'backwards' });
  return a;
}
function geom(a, s, fromR, toR) {
  let p0 = s.fromPt || cen(fromR), p1 = s.toPt || cen(toR); const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L, ny = dx / L; if (ny > 0) { nx = -nx; ny = -ny; }          // bow upward
  const c = [(p0[0] + p1[0]) / 2 + nx * L * 0.2, (p0[1] + p1[1]) / 2 + ny * L * 0.2];
  if (fromR) p0 = edge(fromR, c, 0); if (toR) p1 = edge(toR, c, 3);
  const hs = a.small ? 9 : 15, ang = Math.atan2(p1[1] - c[1], p1[0] - c[0]), ux = Math.cos(ang), uy = Math.sin(ang);
  const b = [p1[0] - ux * hs * 0.8, p1[1] - uy * hs * 0.8];
  const sig = [p0, b, c, p1].flat().map((v) => Math.round(v)).join(','); a.last = { to: p1 };
  if (sig === a.sig) return; a.sig = sig;
  const d = `M${p0[0]},${p0[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`; for (const p of a.paths) p.setAttribute('d', d);
  a.grad.setAttribute('x1', p0[0]); a.grad.setAttribute('y1', p0[1]); a.grad.setAttribute('x2', b[0]); a.grad.setAttribute('y2', b[1]);
  a.head.setAttribute('points', `${p1[0]},${p1[1]} ${b[0] - uy * hs * 0.55},${b[1] + ux * hs * 0.55} ${b[0] + uy * hs * 0.55},${b[1] - ux * hs * 0.55}`);
  a.orig.setAttribute('cx', p0[0]); a.orig.setAttribute('cy', p0[1]); a.tip.setAttribute('cx', p1[0]); a.tip.setAttribute('cy', p1[1]); a.tip.setAttribute('r', hs * 0.9);
}
function retire(a) {
  arrows.delete(a.key);
  if (a.stack && a.last && !off() && !resetting) { const [x, y] = a.last.to; FX.ring(x, y, { color: a.color, size: 26, grow: 2.6, dur: 480, width: 3 }); FX.glow(x, y, { color: a.color, size: 70, dur: 500, peak: 0.8 }); }
  if (off() || resetting) { a.g.remove(); return; }
  const an = a.g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }); an.onfinish = an.oncancel = () => a.g.remove();
}
let resetting = false;
// ---------- what should be on screen right now
function desired() {
  const g = G(), out = [], mode = ctx.mode?.(); if (!g) return out;
  if (mode?.type === 'target') {
    const se = mode.src != null ? (document.querySelector(`#hand .card[data-id="${mode.src}"]`) || ctx.permEl(mode.src)) : null; let sr = rc(se);
    const st = rc(document.getElementById('stage')); const fromPt = sr ? null : st ? [st.left + st.width / 2, st.top + st.height * 0.8] : [innerWidth / 2, innerHeight * 0.8];
    const same = (a, b) => a.kind === b.kind && a.id === b.id, valid = (r) => mode.valid.some((v) => same(v, r));
    (mode.picked || []).forEach((r, i) => { const tr = rc(elOf(r)); if (tr) out.push({ key: 'pick' + i, fromR: sr, fromPt, toR: tr, color: C.ok }); });
    let live = ptr && (ptr.type !== 'touch' || ptr.down);
    if (live) {
      const under = document.elementFromPoint(ptr.x, ptr.y), ref = under ? ctx.refOf(under) : null, ok = ref && valid(ref), tr = ok ? rc(elOf(ref)) : null;
      hot = ref ? { ref, ok, el: elOf(ref) } : null;
      out.push({ key: 'aim', fromR: sr, fromPt, toR: tr, toPt: tr ? null : [ptr.x, ptr.y], color: ref ? (ok ? C.ok : C.bad) : C.neutral, cls: ref && !ok ? 'bad' : '' });
    } else {
      hot = null;
      if (!(mode.picked || []).length) mode.valid.slice(0, 6).forEach((r, i) => { const tr = rc(elOf(r)); if (tr) out.push({ key: 'hint' + i, fromR: sr, fromPt, toR: tr, color: C.neutral, small: true, cls: 'faint' }); });
    }
  } else hot = null;
  const n = g.stack.length;
  for (const it of g.stack) {
    const se = document.querySelector(`#stack .card[data-sid="${it.id}"]`), sr = rc(se); if (!sr) continue; const col = it.controller === ctx.ME ? C.mine : C.opp;
    (it.targets || []).forEach((t, i) => { const tr = rc(elOf(t)); if (tr) out.push({ key: `st${it.id}:${i}`, fromR: sr, toR: tr, color: col, stack: true, cls: it === g.stack[n - 1] ? 'top' : '' }); });
    if (it.kind === 'ability' && it.source) { const pr = rc(ctx.permEl(it.source.id)); if (pr) out.push({ key: 'tt' + it.id, fromR: pr, toR: sr, color: C.tether, small: true, cls: 'tether' }); }
  }
  return out;
}
function frame() {
  raf = 0; ensureSvg(); const g = G();
  if (g !== curG) { curG = g; resetNow(); ensureSvg(); }
  const specs = desired(), seen = new Set();
  for (const s of specs) {
    seen.add(s.key); let a = arrows.get(s.key); if (!a) { a = mk(s.key, s); arrows.set(s.key, a); }
    if (a.color !== s.color) { a.color = s.color; a.g.style.color = s.color; }
    a.g.classList.toggle('bad', s.cls === 'bad'); a.g.classList.toggle('top', s.cls === 'top');
    geom(a, s, s.fromR, s.toR);
  }
  for (const a of [...arrows.values()]) if (!seen.has(a.key)) retire(a);
  svg.classList.toggle('still', off()); svg.style.setProperty('--tgs', ST.animScale());
  // hover ring on the target under the pointer
  const hr = hot && rc(hot.el);
  if (hr) { ring.style.display = ''; ring.setAttribute('x', hr.left - 4); ring.setAttribute('y', hr.top - 4); ring.setAttribute('width', hr.width + 8); ring.setAttribute('height', hr.height + 8); ring.setAttribute('rx', 8); ring.setAttribute('class', 'tg-ring ' + (hot.ok ? 'ok' : 'bad')); } else ring.style.display = 'none';
  syncMarks(hr ? hot : null);
  // records for exit ghosts and FLIP
  for (const it of g?.stack || []) { const el = document.querySelector(`#stack .card[data-sid="${it.id}"]`), r = rc(el); if (r) recs.set(it.id, { rect: r, html: el.outerHTML, src: it.source?.id, abil: it.kind === 'ability', color: it.controller === ctx.ME ? C.mine : C.opp, cls: el.className }); }
  if (g && (g.stack.length || arrows.size || ctx.mode?.()?.type === 'target')) raf = requestAnimationFrame(frame);
}
export const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
// classes re-applied every frame: source permanents with an ability waiting, hovered target
function syncMarks(h) {
  const g = G(), want = new Set();
  for (const it of g?.stack || []) if (it.kind === 'ability' && it.source) { const el = ctx.permEl(it.source.id); if (el) { want.add(el); el.classList.add('tg-src'); } }
  if (h?.el) { want.add(h.el); h.el.classList.add(h.ok ? 'tg-hot' : 'tg-badhover'); h.el.classList.remove(h.ok ? 'tg-badhover' : 'tg-hot'); }
  for (const el of marked) if (!want.has(el)) el.classList.remove('tg-src', 'tg-hot', 'tg-badhover');
  marked = want;
}
function resetNow() { resetting = true; for (const a of [...arrows.values()]) retire(a); resetting = false; recs.clear(); prevItems = new Map(); prevPos = new Map(); exits = []; }
export function reset() { curG = null; resetNow(); for (const el of marked) el.classList.remove('tg-src', 'tg-hot', 'tg-badhover'); marked = new Set(); hot = null; ring && (ring.style.display = 'none'); }

// ---------- stack presentation (called right after ui.js rebuilt #stack)
const short = (s, n = 46) => { s = String(s || '').replace(/\{T\}/g, 'Tap').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function stack() {
  const g = G(); if (!g) return; init.done && ensureSvg();
  const panel = document.getElementById('stack'), n = g.stack.length, next = new Map(), pos = new Map(), enters = [];
  const pr = panel && n ? panel.getBoundingClientRect() : null;
  g.stack.forEach((it, i) => {
    const el = panel?.querySelector(`.card[data-sid="${it.id}"]`); if (!el) return; next.set(it.id, { abil: it.kind === 'ability', src: it.source?.id });
    el.style.setProperty('--d', n - 1 - i);
    if (n > 1) el.insertAdjacentHTML('beforeend', `<i class="tg-ord">${n - i}</i>`);
    if (it.kind === 'ability') {
      el.classList.add('tg-chip'); el.dataset.tg = it.effect?.trigger ? 'Trigger' : 'Ability';
      const txt = it.effect?.text || ''; el.title = txt;
      el.innerHTML = `<span class="tg-thumb" style="background-image:url('${esc(it.card.def.art)}')"></span><span class="tg-txt"><b>${esc(it.card.def.name)}</b><small><em>${el.dataset.tg}</em> ${esc(short(txt))}</small></span>` + (n > 1 ? `<i class="tg-ord">${n - i}</i>` : '');
    }
    if (pr) pos.set(it.id, [el.offsetLeft + el.offsetWidth / 2 - panel.offsetWidth / 2, el.offsetTop + el.offsetHeight / 2 - panel.offsetHeight / 2]);
    // reflow: slide survivors from their previous layout slot (individual `translate` composes with ui.js transform FLIP)
    const was = prevPos.get(it.id);
    if (was && !off()) { const dx = was[0] - pos.get(it.id)[0], dy = was[1] - pos.get(it.id)[1]; if (Math.hypot(dx, dy) > 2) el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 340, easing: 'cubic-bezier(.2,1,.3,1)' }); }
    if (!prevItems.has(it.id)) enters.push([it, el]);
    if (i === n - 1 && n > 1 && !off() && prevItems.has(it.id) && prevItems.size !== n) el.animate([{ filter: 'brightness(1.5)' }, { filter: 'brightness(1)' }], { duration: 420, delay: 80 });
  });
  // newly stacked abilities: pulse + launch from the source, chip emerges from it (staggered when several trigger together)
  enters.filter(([it]) => it.kind === 'ability').forEach(([it, el], k) => {
    const pe = it.source && ctx.permEl(it.source.id), sr = rc(pe); if (!sr || off()) return; const [sx, sy] = cen(sr);
    AN.pulseEl(pe, C.tether, 16); FX.ring(sx, sy, { color: C.tether, size: sr.width * 0.8, grow: 2, dur: 520, width: 3 });
    requestAnimationFrame(() => { const r = rc(el); if (!r) return; const [cx, cy] = cen(r);
      el.animate([{ translate: `${sx - cx}px ${sy - cy}px`, scale: 0.25, opacity: 0 }, { opacity: 1, offset: 0.25 }, { translate: '0 0', scale: 1, opacity: 1 }], { duration: 460, delay: k * 110, easing: 'cubic-bezier(.2,.9,.3,1.1)', fill: 'backwards' });
      later(k * 110, () => FX.orb([sx, sy], [cx, cy], { color: C.tether, dur: 320, size: 16 })); });
  });
  // chips that left: resolve flash (the exit decision waits for onEvents of the same render, flushed next frame)
  for (const [id, was] of prevItems) if (!next.has(id) && was.abil) { const r = recs.get(id); if (r) exits.push({ id, ...r }); recs.delete(id); }
  if (exits.length) requestAnimationFrame(flushExits);
  prevItems = next; prevPos = pos; kick();
}
function flushExits() {
  const list = exits; exits = []; const info = evInfo; evInfo = null;
  for (const x of list) {
    if (off()) continue; const s = x.src != null && rc(ctx.permEl(x.src)), [cx, cy] = cen(x.rect); const countered = info?.counter.has(x.src);
    const w = document.createElement('div'); w.className = 'card tg-chip tg-ghost' + (countered ? ' countered' : ''); w.innerHTML = new DOMParser().parseFromString(x.html, 'text/html').body.firstChild?.innerHTML || '';
    Object.assign(w.style, { position: 'fixed', left: x.rect.left + 'px', top: x.rect.top + 'px', width: x.rect.width + 'px', height: x.rect.height + 'px', margin: 0, zIndex: 246, pointerEvents: 'none', '--cw': x.rect.height / 0.62 + 'px' });
    layer().appendChild(w);
    const [dx, dy] = s ? [cen(s)[0] - cx, cen(s)[1] - cy] : [0, -40];
    const a = w.animate(countered ? [{ filter: 'none', transform: 'none', opacity: 1 }, { filter: 'brightness(1.6) hue-rotate(160deg)', transform: 'scale(1.1)', opacity: 1, offset: 0.3 }, { transform: 'scale(.4) rotate(-14deg)', opacity: 0 }]
      : [{ filter: 'brightness(1)', transform: 'scale(1)', opacity: 1 }, { filter: 'brightness(2)', transform: 'scale(1.18)', opacity: 1, offset: 0.3 }, { filter: 'brightness(1.4)', transform: `translate(${dx * 0.8}px,${dy * 0.8}px) scale(.35)`, opacity: 0 }], { duration: 560, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = a.oncancel = () => w.remove();
    FX.glow(cx, cy, { color: countered ? '#8fd0ff' : C.tether, size: x.rect.width * 1.5, dur: 520, peak: 0.8 });
  }
}
export function onEvents(evs) {
  const counter = new Set(); for (const e of evs) if (e.type === 'counter') counter.add(e.id);
  if (counter.size) evInfo = { counter };
  kick();
}
// invalid pick: red pulse on the target, a ring flash and the reason
export function deny(ref, el) {
  el = el || elOf(ref); AN.denyPulse(el); const r = rc(el); if (!r || off()) return;
  ensureSvg(); const f = document.createElementNS(NS, 'rect');
  f.setAttribute('class', 'tg-ring bad flash'); f.setAttribute('x', r.left - 4); f.setAttribute('y', r.top - 4); f.setAttribute('width', r.width + 8); f.setAttribute('height', r.height + 8); f.setAttribute('rx', 8); svg.appendChild(f);
  const an = f.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.18)' }], { duration: 480, easing: 'ease-out', fill: 'forwards' }); f.style.transformOrigin = 'center'; f.style.transformBox = 'fill-box'; an.onfinish = () => f.remove();
  let why = 'Not a legal target';
  try { const g = G(); if (ref?.kind === 'perm') { const p = g.perm(ref.id), kw = p && g.kw(p); if (kw?.has('shroud')) why = 'Shroud'; else for (const k of kw || []) if (k.startsWith('pro:')) why = 'Protection from ' + (PRO[k.slice(4)] || k.slice(4)); } } catch {}
  AN.floatText(r.left + r.width / 2, r.top, why, '#ff8a7a');
}
