// Status & life feedback (Arena style): counter badges, P/T pulses, keyword chips, protection rings, regeneration shield,
// sacrifice vs destroy vs sweep VFX, life gain / drain / pay-life, priority glow, "waiting for opponent", phase hop,
// end-of-turn damage heal-off. DOM/WAAPI only, no assets. Everything visual is skipped when window.__fxOff is set;
// Element.animate durations are already scaled by the wrapper in ui.js, timeouts use ST.animScale() explicitly.
// Hooks in ui.js: init, onEvents, afterRender, decoPT, reset, dieStep, batchSize, implode, shatter, lifeGain, lifeShift.
import * as FX from '../fx.js?v=20261102203456';
import * as ST from '../settings.js?v=20261102203456';
const NS = 'http://www.w3.org/2000/svg';
const rnd = (a, b) => a + Math.random() * (b - a);
const off = () => !!window.__fxOff;
const ctr = (r) => [r.left + r.width / 2, r.top + r.height / 2];
const phone = () => document.documentElement.classList.contains('phone');
let ctx = {};
export const init = (c) => { ctx = c || {}; };
const G = () => ctx.g;
const later = (ms, fn) => setTimeout(fn, ms * ST.animScale());
function layer() { return document.getElementById('animlayer') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'animlayer' }); }
function sprite(cls, css, html = '') { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, { position: 'fixed', pointerEvents: 'none', ...css }); d.innerHTML = html; layer().appendChild(d); return d; }
function fin(a, el) { a.onfinish = a.oncancel = () => el.remove(); return a; }

// ---------------------------------------------------------------- per-batch state (set by onEvents)
let batch = { dies: 0, sweep: false, health: 0 };
export function onEvents(evs) {
  const dies = evs.filter((e) => e.type === 'die').length;
  batch = { dies, sweep: evs.some((e) => e.type === 'sweep') || dies >= 3, gain: new Set() };
}
export const batchSize = () => (batch.sweep ? batch.dies : 1);
// extra delay between consecutive deaths: 0 in a sweep so the cards drop together, `normal` otherwise
export const dieStep = (dieCount, normal) => (dieCount >= 3 ? 0 : normal);

// ---------------------------------------------------------------- keyword chips
// [text, tooltip, class, priority] lower priority number = shown first
const KW = {
  flying: ['FL', 'Flying', 'air', 2], 'first strike': ['FS', 'First strike', 'gold', 3], 'double strike': ['DS', 'Double strike', 'gold', 3],
  trample: ['TR', 'Trample', 'grn', 4], banding: ['BD', 'Banding', 'vio', 5], haste: ['HS', 'Haste', 'red', 6], defender: ['DF', 'Defender', 'gry', 7],
  vigilance: ['VG', 'Vigilance', 'gry', 9], reach: ['RC', 'Reach', 'air', 9], shroud: ['SH', 'Shroud', 'gry', 8], indestructible: ['IN', 'Indestructible', 'gold', 4],
  fear: ['FR', 'Fear', 'vio', 9], unblockable: ['UN', 'Unblockable', 'vio', 9],
};
const PC = { W: '#fff0b0', U: '#6fbaff', B: '#b06bff', R: '#ff7a33', G: '#6dff8a' };
const PN = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };
function chipList(p) {
  const g = G(), kw = g.kw(p), out = [];
  if (p.sick && !kw.has('haste') && !kw.has('canAttackSick')) out.push(['zZ', 'Summoning sick', 'sick', 0]);
  if (p.regen > 0) out.push(['RG', 'Regeneration shield (until end of turn)', 'shield', 1]);
  for (const k of kw) {
    if (KW[k]) out.push(KW[k]);
    else if (/walk$/.test(k)) out.push(['WK', k, 'vio', 9]);
  }
  const pro = [...kw].filter((k) => k.startsWith('pro:')).map((k) => k.slice(4));
  if (pro.length) out.push(['P', 'Protection from ' + pro.map((c) => PN[c] || c).join(', '), 'pro', 1, pro]);
  return out.sort((a, b) => a[3] - b[3]);
}
function chipsHtml(p) {
  const list = chipList(p); if (!list.length) return '';
  const cap = phone() ? 4 : 6, shown = list.slice(0, cap), more = list.length - shown.length;
  return `<span class="sxk">${shown.map((c) => `<b class="sxkw ${c[2]}" title="${c[1]}"${c[4] ? ` style="--pc:${PC[c[4][0]] || '#fff'}"` : ''}>${c[0]}</b>`).join('')}${more > 0 ? `<b class="sxkw gry" title="${list.slice(cap).map((c) => c[1]).join(', ')}">+${more}</b>` : ''}</span>`;
}
function ringHtml(p) {
  const pro = [...G().kw(p)].filter((k) => k.startsWith('pro:')).map((k) => PC[k.slice(4)]).filter(Boolean);
  if (!pro.length) return '';
  const stops = pro.length === 1 ? `${pro[0]},${pro[0]}` : pro.map((c, i) => `${c} ${(i / pro.length) * 100}% ${((i + 1) / pro.length) * 100}%`).join(',');
  return `<span class="sxring" style="background:conic-gradient(from 45deg,${stops})"></span>`;
}

// ---------------------------------------------------------------- counters
const CNAME = (k) => (k === '+1/+1' || k === '-1/-1' ? k : k.replace(/ counter$/i, ''));
const CCLS = (k) => (k === '+1/+1' ? 'plus' : k === '-1/-1' ? 'minus' : 'other');
function cntHtml(p) {
  const e = Object.entries(p.counters || {}).filter(([, n]) => n); if (!e.length) return '';
  const cap = 3, shown = e.slice(0, cap), more = e.length - shown.length;
  return `<span class="sxcnt">${shown.map(([k, n]) => `<i class="sxc ${CCLS(k)}" data-k="${k}">${CNAME(k)}<b>×${n}</b></i>`).join('')}${more > 0 ? `<i class="sxc other">+${more}</i>` : ''}</span>`;
}

// ---------------------------------------------------------------- P/T: per-number colour (green above printed, red below / damaged)
export function decoPT(el, p) {
  const g = G(); const pt = el?.querySelector(':scope > .pt'); if (!pt || !p || !g.isCreature(p)) return;
  const dm = el.querySelector(':scope > .dmg'); const shownDmg = dm ? +dm.textContent || 0 : 0;
  const bp = g.power(p), bt = g.toughness(p), dp = +p.card.def.power, dt = +p.card.def.toughness;
  const pc = isNaN(dp) ? '' : bp > dp ? 'up' : bp < dp ? 'down' : '', tc = shownDmg ? 'down' : isNaN(dt) ? '' : bt > dt ? 'up' : bt < dt ? 'down' : '';
  pt.innerHTML = `<u class="${pc}">${bp}</u>/<u class="${tc}">${bt - shownDmg}</u>`;
  pt.classList.remove('buff', 'hurt');
}

// ---------------------------------------------------------------- render diff
const seen = new Map();   // perm id -> { pw, th, cnt, dmg, regen }
let lastPhase = null, lastBtnKey = '';
export function reset() { seen.clear(); lastPhase = null; lastBtnKey = ''; batch = { dies: 0, sweep: false, gain: new Set() }; }

function pulseNum(u, up) {
  if (off() || !u) return; const c = up ? '#7dff9a' : '#ff6a55';
  u.animate([{ transform: 'scale(1)', color: '#fff' }, { transform: 'scale(1.9)', color: c, textShadow: `0 0 8px ${c}`, offset: 0.3 }, { transform: 'scale(1)' }], { duration: 700, easing: 'cubic-bezier(.2,1.5,.4,1)' });
}
function popText(el, text, color) {
  if (off() || !el) return; const r = el.getBoundingClientRect(); if (!r.width) return;
  const t = sprite('sxpop', { left: r.left + r.width / 2 + 'px', top: r.top + 'px', color, zIndex: 246 }, text);
  fin(t.animate([{ opacity: 0, transform: 'translate(-50%,0) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-60%) scale(1.1)', offset: 0.25 }, { opacity: 0, transform: 'translate(-50%,-190%) scale(1)' }], { duration: 950, easing: 'ease-out', fill: 'forwards' }), t);
}
function healOff(el, was) {
  if (off() || !el) return; const r = el.getBoundingClientRect(); if (!r.width) return; const [x, y] = ctr(r);
  const b = sprite('sxheal', { left: x + 'px', top: y + 'px', zIndex: 240 }, was);
  fin(b.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)', background: '#c93030' }, { opacity: 1, background: '#4cc46a', transform: 'translate(-50%,-50%) scale(1.15)', offset: 0.45 }, { opacity: 0, transform: 'translate(-50%,-110%) scale(.5)', background: '#4cc46a' }], { duration: 850, easing: 'ease-out', fill: 'forwards' }), b);
  FX.motes(x, y, { color: '#9dffb0', n: 7, spread: r.width * 0.3, rise: r.height * 0.4, dur: 800 });
}

export function afterRender(quiet = false) {
  const g = G(); if (!g) return;
  document.querySelectorAll('#stage .card[data-kind=perm]:not(.aura)').forEach((el) => {
    const id = +el.dataset.id, p = g.perm(id); if (!p) return;
    el.querySelectorAll(':scope > .badge, :scope > .kws, :scope > .sxk, :scope > .sxcnt, :scope > .sxring').forEach((x) => x.remove());
    el.insertAdjacentHTML('beforeend', ringHtml(p) + cntHtml(p) + (g.isCreature(p) && !g.isLand(p) ? chipsHtml(p) : ''));
    const cre = g.isCreature(p), cnt = JSON.stringify(p.counters || {});
    const cur = { pw: cre ? g.power(p) : 0, th: cre ? g.toughness(p) : 0, cnt, dmg: p.damage || 0, regen: p.regen || 0 };
    const old = seen.get(id); seen.set(id, cur);
    if (cre) decoPT(el, p);
    if (quiet || !old || off()) return;
    // counters: badge appears (pop) or pulses on a change, with a small +n / -n
    if (old.cnt !== cur.cnt) {
      const o = JSON.parse(old.cnt), n = p.counters || {};
      for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) {
        const d = (n[k] || 0) - (o[k] || 0); if (!d) continue;
        const chip = el.querySelector(`.sxc[data-k="${CSS.escape(k)}"]`) || el.querySelector('.sxcnt');
        if (chip) { chip.animate([{ transform: 'scale(.4)', filter: 'brightness(3)' }, { transform: 'scale(1.5)', offset: 0.4, filter: 'brightness(1.8)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,1.6,.4,1)' }); popText(chip, (d > 0 ? '+' : '') + d, k === '-1/-1' ? (d > 0 ? '#ff6a55' : '#7dff9a') : k === '+1/+1' ? (d > 0 ? '#7dff9a' : '#ff6a55') : '#ffd27a'); }
      }
    }
    // P/T number pulses
    if (cre && (old.pw !== cur.pw || old.th !== cur.th)) {
      const us = el.querySelectorAll(':scope > .pt u');
      if (old.pw !== cur.pw) pulseNum(us[0], cur.pw > old.pw);
      if (old.th !== cur.th) pulseNum(us[1], cur.th > old.th);
    }
    // damage wears off (end of turn, regeneration): the red marker turns green and floats away
    if (old.dmg > 0 && cur.dmg === 0 && cre) healOff(el.querySelector(':scope > .pt') || el, old.dmg);
    if (cur.regen > old.regen) el.querySelector('.sxkw.shield')?.animate([{ transform: 'scale(.3)', filter: 'brightness(3)' }, { transform: 'scale(1.6)', offset: 0.4 }, { transform: 'scale(1)', filter: 'none' }], { duration: 600, easing: 'cubic-bezier(.2,1.6,.4,1)' });
  });
  for (const id of seen.keys()) if (!g.perm(id)) seen.delete(id);
  // action button: priority glow ring / soft waiting indicator
  const b = document.getElementById('act-btn');
  if (b) {
    const waiting = b.classList.contains('wait') && /^(Opponent|Waiting)/.test(b.textContent);
    if (waiting) b.textContent = 'Waiting for opponent';
    b.classList.toggle('sx-wait', waiting); b.classList.toggle('sx-go', b.classList.contains('glow') && !b.hidden);
    const key = b.className + b.textContent;
    if (b.classList.contains('sx-go') && key !== lastBtnKey && !quiet && !off()) b.animate([{ transform: 'scale(.92)' }, { transform: 'scale(1.06)', offset: 0.5 }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,1.6,.4,1)' });
    lastBtnKey = key;
  }
  // phase marker: the new step hops in as the marker slides to it
  const on = document.querySelector('#phases .on'), ph = on?.textContent || null;
  if (on && ph !== lastPhase && lastPhase !== null && !quiet && !off()) on.animate([{ translate: '-12px 0', filter: 'brightness(2.2)' }, { translate: '3px 0', offset: 0.55, filter: 'brightness(1.4)' }, { translate: '0 0', filter: 'none' }], { duration: 450, easing: 'ease-out' });
  if (ph !== lastPhase) lastPhase = ph;
}

// ---------------------------------------------------------------- death VFX
function cloneGhost(r, html, z = 245) {
  const el = sprite('card ghost', { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: z, margin: 0 });
  const w = document.createElement('div'); w.innerHTML = html; el.innerHTML = w.firstElementChild ? w.firstElementChild.innerHTML : ''; return el;
}
// sacrifice: the card is drawn inward (violet), spirals down into the graveyard pile, which flares on arrival
export function implode(r, html, dest) {
  if (off() || !r) return null; const [cx, cy] = ctr(r), [dx, dy] = dest ? ctr(dest) : [cx, cy + 60];
  const el = cloneGhost(r, html);
  const ringEl = sprite('sxinring', { left: cx - r.width + 'px', top: cy - r.width + 'px', width: r.width * 2 + 'px', height: r.width * 2 + 'px', zIndex: 244 });
  fin(ringEl.animate([{ transform: 'scale(1.1)', opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { transform: 'scale(.15)', opacity: 0 }], { duration: 520, easing: 'ease-in' }), ringEl);
  fin(el.animate([
    { transform: 'none', filter: 'none', opacity: 1 },
    { transform: 'scale(1.1) rotate(-3deg)', filter: 'brightness(1.4) hue-rotate(250deg) saturate(2)', offset: 0.22 },
    { transform: `translate(${(dx - cx) * 0.55}px,${(dy - cy) * 0.55}px) scale(.45) rotate(160deg)`, filter: 'brightness(1.8) hue-rotate(250deg) saturate(2.4)', offset: 0.7, opacity: 0.8 },
    { transform: `translate(${dx - cx}px,${dy - cy}px) scale(.08) rotate(330deg)`, filter: 'brightness(3) hue-rotate(250deg) blur(2px)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.55,0,.8,.4)', fill: 'forwards' }), el);
  for (let i = 0; i < 6; i++) { const m = sprite('sxmote', { left: cx + rnd(-r.width, r.width) * 0.8 + 'px', top: cy + rnd(-r.height, r.height) * 0.6 + 'px', zIndex: 246 }); fin(m.animate([{ transform: 'translate(0,0) scale(1)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(${cx - parseFloat(m.style.left)}px,${cy - parseFloat(m.style.top)}px) scale(.2)`, opacity: 0 }], { duration: 480, delay: i * 40, easing: 'ease-in', fill: 'both' }), m); }
  later(560, () => { FX.glow(dx, dy, { color: '#b06bff', size: (dest ? dest.width : r.width) * 1.8, dur: 600 }); const pile = document.querySelector('.pile[data-z="gy"]'); void pile; });
  return el;
}
// destroy: flash, shards burst outward and fall, dust ring. In a sweep the shards are fewer and everything lands together.
export function shatter(r, html, many = 1) {
  if (off() || !r) return; const [cx, cy] = ctr(r), big = many >= 3;
  const cols = big ? 2 : 3, rows = big ? 2 : 3, n = cols * rows;
  for (let i = 0; i < n; i++) {
    const c = i % cols, rw = Math.floor(i / cols), el = cloneGhost(r, html);
    el.style.clipPath = `inset(${(rw / rows) * 100}% ${((cols - 1 - c) / cols) * 100}% ${((rows - 1 - rw) / rows) * 100}% ${(c / cols) * 100}%)`;
    const px = r.left + ((c + 0.5) * r.width) / cols - cx, py = r.top + ((rw + 0.5) * r.height) / rows - cy;
    fin(el.animate([
      { transform: 'none', opacity: 1, filter: 'brightness(2.4)' },
      { transform: `translate(${px * 0.25}px,${py * 0.25}px)`, filter: 'brightness(1)', offset: 0.12 },
      { transform: `translate(${px * 1.5 + rnd(-8, 8)}px,${py * 1.4 - rnd(0, 14)}px) rotate(${rnd(-35, 35)}deg)`, opacity: 0.95, offset: 0.45 },
      { transform: `translate(${px * 1.9 + rnd(-12, 12)}px,${py * 1.6 + r.height * (big ? 0.55 : 0.8)}px) rotate(${rnd(-110, 110)}deg) scale(.55)`, opacity: 0 }], { duration: big ? 650 : 780, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' }), el);
  }
  FX.burst(cx, cy, { color: '#e6efff', n: big ? 8 : 14, dist: r.width * 1.1, size: 4, dur: 650 });
  if (!big) FX.ring(cx, cy, { color: '#cfe0ff', size: r.width * 0.7, grow: 2.4, dur: 420, width: 2 });
}

// ---------------------------------------------------------------- life
function orb(pid) { return document.getElementById('life-' + pid); }
function glowOrb(pid, color) {
  const el = orb(pid); if (!el || off()) return;
  el.animate([{ boxShadow: `0 0 0 0 ${color}00` }, { boxShadow: `0 0 34px 10px ${color}, inset 0 0 18px ${color}99`, offset: 0.35 }, { boxShadow: `0 0 0 0 ${color}00` }], { duration: 1100, easing: 'ease-out' });
}
function riseNumber(r, text, color, down) {
  const [x, y] = ctr(r);
  const t = sprite('sxlife', { left: x + 'px', top: (down ? r.bottom : r.top) + 'px', color, zIndex: 246 }, text);
  const to = down ? '90%' : '-210%', from = down ? '-60%' : '-20%';
  fin(t.animate([{ opacity: 0, transform: `translate(-50%,${from}) scale(.6)` }, { opacity: 1, transform: `translate(-50%,${down ? '10%' : '-80%'}) scale(1.15)`, offset: 0.22 }, { opacity: 0, transform: `translate(-50%,${to}) scale(1)` }], { duration: 1300, easing: 'ease-out', fill: 'forwards' }), t);
}
// gain: green glow + ring + number rising; if the same batch drained the opponent, a particle stream runs loser -> winner first
export function lifeGain(pid, gain, drainPid = null) {
  if (off() || !batch.gain || batch.gain.has(pid)) return; batch.gain.add(pid);
  const el = orb(pid); if (!el) return; const r = el.getBoundingClientRect(), [x, y] = ctr(r);
  const arrive = () => {
    glowOrb(pid, '#6dff8a'); FX.glow(x, y, { color: '#6dff8a', size: r.width * 2.4, dur: 800 }); FX.ring(x, y, { color: '#6dff8a', size: r.width, grow: 2, dur: 600, width: 3 });
    FX.motes(x, y + r.height * 0.3, { color: '#9dffb0', n: 10, spread: r.width * 0.5, rise: r.height * 1.1, dur: 1000 });
    if (gain > 0) riseNumber(r, '+' + gain, '#7dff9a', false);
  };
  if (drainPid != null && orb(drainPid)) { glowOrb(drainPid, '#ff4a55'); drainStream(orb(drainPid).getBoundingClientRect(), r); later(520, arrive); } else arrive();
}
export function drainStream(a, b, color = '#c04dff') {
  if (off() || !a || !b) return; const [x1, y1] = ctr(a), [x2, y2] = ctr(b), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  for (let i = 0; i < 14; i++) {
    const s = rnd(5, 9), o = sprite('sxdrain', { left: x1 - s / 2 + 'px', top: y1 - s / 2 + 'px', width: s + 'px', height: s + 'px', background: `radial-gradient(#fff,${color} 60%,#0000 75%)`, boxShadow: `0 0 10px ${color}`, zIndex: 246 });
    const sw = rnd(-0.18, 0.18) * len;
    fin(o.animate([{ transform: 'translate(0,0) scale(.5)', opacity: 0, background: `radial-gradient(#fff,#ff4a55 60%,#0000 75%)` }, { opacity: 1, offset: 0.12 }, { transform: `translate(${dx * 0.5 + nx * sw}px,${dy * 0.5 + ny * sw}px) scale(1.1)`, offset: 0.55 }, { transform: `translate(${dx}px,${dy}px) scale(.5)`, opacity: 0.2, background: `radial-gradient(#fff,#6dff8a 60%,#0000 75%)` }], { duration: 640, delay: i * 38, easing: 'cubic-bezier(.5,0,.4,1)', fill: 'both' }), o);
  }
}
// life that changed with no dmg/heal event: paying life dims red for a moment (and sinks a -n), setting life higher rises green
export function lifeShift(pid, was, cur) {
  if (off()) return; const el = orb(pid); if (!el) return; const r = el.getBoundingClientRect();
  if (cur < was) {
    const v = sprite('sxdim', { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: getComputedStyle(el).borderRadius, zIndex: 240 });
    fin(v.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 750, easing: 'ease-out' }), v);
    el.animate([{ filter: 'none' }, { filter: 'brightness(.5) saturate(1.6)', offset: 0.25 }, { filter: 'none' }], { duration: 750 });
    riseNumber(r, `-${was - cur}`, '#ff8a7a', true);
  } else { glowOrb(pid, '#6dff8a'); riseNumber(r, `+${cur - was}`, '#7dff9a', false); }
}

export const _kwChips = chipsHtml;
void NS;
