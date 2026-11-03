// Ambient + presentation layer: avatar reactions, playmat particles, emote bubbles, coin/dice toss, choice-panel dealing.
// Exports init(ctx) and onEvents(evs) plus refresh(), stop(), emote(text), toss(won), roll(sides, value), endSequence(win, avatar).
// Everything is skipped when window.__fxOff is set (reduced motion / speed Off); WAAPI durations are scaled by the
// global Element.animate wrapper in ui.js, CSS animations read --as (animScale) set below. See docs/ANIMATIONS.md.
import * as FX from '../fx.js?v=20261102202011';
import * as ST from '../settings.js?v=20261102202011';
import * as AN from '../anim.js?v=20261102202011';

const rnd = (a, b) => a + Math.random() * (b - a);
const off = () => !!window.__fxOff;
const $ = (id) => document.getElementById(id);
const ctr = (r) => [r.left + r.width / 2, r.top + r.height / 2];
let ME = 0, inited = false;

export function init(ctx = {}) {
  if (inited) return; inited = true; ME = ctx.me ?? 0;
  const root = document.documentElement;
  const setScale = () => root.style.setProperty('--as', String(ST.animScale()));
  setScale();
  ST.onChange((k) => { if (k === 'speed' || k === 'playmat' || k === 'ambient') { setScale(); refresh(); } });
  try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { setScale(); refresh(); }); } catch {}
  const board = $('board');
  if (board) new MutationObserver(refresh).observe(board, { attributes: true, attributeFilter: ['hidden'] });
  watchLife(); watchInspect();
  document.addEventListener('visibilitychange', () => { const l = $('ambmat'); if (l) l.style.animationPlayState = document.hidden ? 'paused' : 'running'; });
}

// ---------- (1) avatar reactions: flinch on life loss, heartbeat vignette from the DISPLAYED life ----------
const lastShown = [null, null];
function watchLife() {
  for (const i of [0, 1]) {
    const num = $('life-' + i)?.querySelector('.num'); if (!num) continue;
    new MutationObserver(() => {
      const v = parseInt(num.textContent, 10); if (Number.isNaN(v)) return;
      const was = lastShown[i]; lastShown[i] = v;
      const av = $('life-' + i);
      if (was != null && v < was) flinch(av, was - v);
      lowLife(i, v);
    }).observe(num, { childList: true, characterData: true, subtree: true });
  }
}
function flinch(el, n) {
  if (off() || !el) return; const k = Math.min(1, 0.3 + n / 8), dir = Math.random() < 0.5 ? -1 : 1;
  el.animate([{ translate: '0 0', scale: '1' }, { translate: `${dir * 9 * k}px ${-4 * k}px`, scale: String(1 - 0.12 * k), offset: 0.18 }, { translate: `${-dir * 6 * k}px 2px`, scale: '1.04', offset: 0.45 }, { translate: `${dir * 2}px 0`, offset: 0.7 }, { translate: '0 0', scale: '1' }], { duration: 440, easing: 'ease-out' });
  el.animate([{ boxShadow: '0 0 0 0 #ff2a1a00' }, { boxShadow: `0 0 0 3px #ff3b2a, 0 0 ${14 + 22 * k}px 6px #ff3b2acc`, offset: 0.25 }, { boxShadow: '0 0 0 0 #ff2a1a00' }], { duration: 560 });
}
function lowLife(i, v) {
  const st = $('stage'); if (!st) return;
  const low = v <= 5 && v > 0 && !off();
  $('life-' + i).classList.toggle('ambLow', low);
  if (i === ME) { st.classList.toggle('ambHeart', low); st.style.setProperty('--hb', v <= 2 ? '.95s' : '1.25s'); st.classList.toggle('ambCrit', low && v <= 2); }
}

// Defeat: avatar shatters + shockwave, then the board dims/blurs (class `wiped`, removed by ui.js) before the results screen.
// Victory: golden burst from the winner's avatar. `avatar` = the loser's avatar element (ui.js passes it).
export function endSequence(win, avatar) {
  if (off() || !avatar) return;
  const r = avatar.getBoundingClientRect(), [x, y] = ctr(r);
  $('stage')?.classList.remove('ambHeart', 'ambCrit');
  if (win) {
    const w = $('life-' + ME), wr = w.getBoundingClientRect(), [wx, wy] = ctr(wr);
    FX.glow(wx, wy, { color: '#ffd27a', size: wr.width * 4, dur: 900, peak: 1 });
    FX.burst(wx, wy, { color: '#ffd27a', n: 30, dist: 150, size: 8, dur: 900 }); FX.ring(wx, wy, { color: '#ffd27a', size: wr.width, grow: 5, dur: 900, width: 5 });
    FX.burst(x, y, { color: '#ffe9b0', n: 14, dist: 90, size: 5, dur: 800 });
  } else {
    AN.shatter(r, avatar.outerHTML); avatar.style.visibility = 'hidden';
    FX.shockwave(x, y, { color: '#ff6a55', size: r.width, grow: 9, dur: 800 }); FX.burst(x, y, { color: '#ff8a3d', n: 26, dist: 160, size: 7, dur: 900 }); FX.flash('#a00', 500, 0.35);
    $('stage')?.animate([{ translate: '0 0' }, { translate: '-8px 4px' }, { translate: '7px -3px' }, { translate: '-4px 2px' }, { translate: '0 0' }], { duration: 420 });
    setTimeout(() => $('board')?.classList.add('wiped'), 520 * ST.animScale());
  }
}

// ---------- (2) playmat ambient particles ----------
const KINDS = { 1: ['dust'], 2: ['pollen', 'pollen', 'leaf'], 3: ['snow'], 4: ['ember'], 5: ['leaf', 'pollen'] };
let slow = false, watchTok = 0;
export function stop() { $('ambmat')?.remove(); watchTok++; }
export function refresh() {
  const board = $('stage'), bd = $('board'); const on = board && bd && !bd.hidden && window.g && !off() && !window.__noAmbient && !slow && ST.get('ambient') !== false;
  if (!on) { stop(); return; }
  const mat = +ST.get('playmat') || 5, key = mat + '|' + (innerWidth < 700 ? 'p' : 'd'); const cur = $('ambmat');
  if (cur && cur.dataset.k === key) return;
  stop();
  const kinds = KINDS[mat] || KINDS[5], n = innerWidth < 700 ? 9 : 16;
  const box = document.createElement('div'); box.id = 'ambmat'; box.dataset.k = key; box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'), k = kinds[i % kinds.length]; p.className = 'ap-' + k;
    p.style.cssText = `left:${rnd(0, 100).toFixed(1)}%;--d:${rnd(9, 18).toFixed(1)}s;--dl:${rnd(-18, 0).toFixed(1)}s;--s:${rnd(k === 'leaf' ? 7 : 3, k === 'leaf' ? 12 : 6).toFixed(1)}px;--x:${rnd(-70, 70).toFixed(0)}px;--r:${rnd(120, 420).toFixed(0)}deg`;
    box.appendChild(p);
  }
  board.insertBefore(box, board.firstChild);
  // frame watchdog: if ~90 frames average over 30 ms, drop the layer for the session
  const tok = ++watchTok; let last = performance.now(), cnt = 0, sum = 0;
  const f = (t) => { if (tok !== watchTok) return; const dt = t - last; last = t; if (dt < 200 && !document.hidden) { sum += dt; cnt++; } if (cnt < 90) requestAnimationFrame(f); else if (sum / cnt > 30) { slow = true; stop(); } };
  requestAnimationFrame(f);
}

// ---------- (3) emotes ----------
const REPLY = { 'Good game': ['Good game', 'GG!'], 'Thinking...': ['Take your time.', 'Hmm...'], 'Nice!': ['Thanks!', 'Heh.'], 'Oops': ['Ha!', 'Oof.'], 'Well played': ['You too.', 'Thanks!'] };
const bubbles = [null, null]; let lastAiEmote = 0;
function bubble(pid, text) {
  const av = $('life-' + pid); if (!av) return; bubbles[pid]?.remove();
  const r = av.getBoundingClientRect(), el = document.createElement('div'); el.className = 'ambub ' + (pid === ME ? 'me' : 'opp'); el.textContent = text; document.body.appendChild(el); bubbles[pid] = el;
  const w = el.offsetWidth, h = el.offsetHeight; let left = r.left + r.width / 2 - 18; left = Math.max(6, Math.min(innerWidth - w - 6, left));
  let top = pid === ME ? r.top - h - 12 : r.bottom + 12; top = Math.max(6, Math.min(innerHeight - h - 6, top));
  Object.assign(el.style, { left: left + 'px', top: top + 'px' });
  const done = () => { el.remove(); if (bubbles[pid] === el) bubbles[pid] = null; };
  if (off()) { setTimeout(done, 1800); return; }
  const a = el.animate([{ opacity: 0, transform: 'translateY(8px) scale(.6)' }, { opacity: 1, transform: 'none', offset: 0.1 }, { opacity: 1, transform: 'none', offset: 0.86 }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 2600, easing: 'ease-out', fill: 'forwards' });
  a.onfinish = a.oncancel = done;
}
export function emote(text) {
  bubble(ME, text);
  const now = Date.now();
  if (Math.random() < 0.55 && now - lastAiEmote > 6000) {
    lastAiEmote = now; const opts = REPLY[text] || ['Hmm.'];
    setTimeout(() => { if (window.g && !window.g.winner) bubble(1 - ME, opts[Math.floor(Math.random() * opts.length)]); }, (1200 + Math.random() * 1200) * Math.max(0.3, ST.animScale()));
  }
}

// ---------- (4) coin / dice toss (reuses the .coin styling from style.css) ----------
function tossShell(html, label) {
  const el = document.createElement('div'); el.id = 'ambtoss'; el.innerHTML = `<div class="tbody coinwrap">${html}</div><div class="tmsg">${label}</div>`; document.body.appendChild(el); return el;
}
function arc(el, dur) {
  const b = el.querySelector('.tbody'), sc = ST.animScale();
  b.animate([{ transform: 'translateY(70px) scale(.5)', opacity: 0 }, { transform: 'translateY(-90px) scale(1.15)', opacity: 1, offset: 0.4, easing: 'ease-in' }, { transform: 'translateY(0) scale(1)', offset: 0.78 }, { transform: 'translateY(-14px)', offset: 0.88, easing: 'ease-in' }, { transform: 'translateY(0)' }], { duration: dur, easing: 'ease-out', fill: 'both' });
  setTimeout(() => el.classList.add('shown'), dur * 0.82 * sc);
  setTimeout(() => { const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }); a.onfinish = () => el.remove(); }, (dur + 900) * sc);
}
export function toss(won, label) {
  if (off()) return;
  const el = tossShell(`<div class="coin ${won ? 'heads' : 'tails'}" style="width:84px;height:84px;margin:0 auto;animation-duration:calc(1.4s*var(--as))"><i class="f1">${won ? 'WIN' : 'LOSE'}</i><i class="f2">${won ? 'WIN' : 'LOSE'}</i></div>`, label || (won ? 'Coin flip: won' : 'Coin flip: lost'));
  arc(el, 1500);
}
export function roll(sides = 6, value = 1, label) {
  if (off()) return;
  const el = tossShell(`<div class="die"><b>${value}</b></div>`, label || `d${sides}: ${value}`), b = el.querySelector('.die b');
  const t0 = performance.now(), dur = 1100 * ST.animScale(); const iv = setInterval(() => { if (performance.now() - t0 > dur) { b.textContent = value; clearInterval(iv); } else b.textContent = 1 + Math.floor(Math.random() * sides); }, 70);
  el.querySelector('.die').animate([{ transform: 'rotate(0) ' }, { transform: 'rotate(540deg)' }], { duration: 1100, easing: 'cubic-bezier(.2,.7,.3,1)' });
  arc(el, 1500);
}
// engine events: mid-game 'coin' (the opening one is shown full-screen by ui.js) and 'roll' if an engine adds it
export function onEvents(evs) {
  for (const e of evs) {
    if (e.type === 'coin' && window.g?.turn > 0) toss(e.winner === ME, e.winner === ME ? 'You win the toss' : 'Opponent wins the toss');
    else if (e.type === 'roll') roll(e.sides || 6, e.value ?? e.n ?? 1);
  }
}

// ---------- (5) card browsers (graveyard / library viewer): number the cards so CSS can stagger them ----------
function watchInspect() {
  const ins = $('inspect'); if (!ins) return;
  new MutationObserver(() => ins.querySelectorAll('.cards img').forEach((im, i) => { if (!im.style.getPropertyValue('--i')) im.style.setProperty('--i', i); })).observe(ins, { childList: true, subtree: true });
}
