import { Game, parseCost, makeRng } from './engine.js?v=20261102160439';
import { aiAct } from './ai.js?v=20261102160439';
import { EFFECTS, abilitiesOf } from './cards.js?v=20261102160439';
import { buildDeck, buildDeckFrom, indexCards, DECK_LISTS, coverage } from './decks.js?v=20261102160439';
import { initMenu, showApp, hideApp, costHtml } from './menu.js?v=20261102160439';
import { askConfirm, askNumber, askPick, modal } from './dialog.js?v=20261102160439';
import * as FX from './fx.js?v=20261102160439';
import * as ST from './settings.js?v=20261102160439';
import sfx from './sfx.js?v=20261102160439';
import * as SC from './screens.js?v=20261102160439';
import * as AI from './ai.js?v=20261102160439';
import * as DK from './decks.js?v=20261102160439';
import * as AN from './anim.js?v=20261102160439';
import * as SX from './anim/status.js?v=20261102160439';
import * as ZN from './anim/zones.js?v=20261102160439';
import * as TG from './anim/targeting.js?v=20261102160439';
import * as AMB from './anim/ambient.js?v=20261102160439';
AMB.init({ me: 0 });

// animation speed setting (Fast/Normal/Slow, minimal under prefers-reduced-motion): scales every WAAPI duration/delay
const _animate = Element.prototype.animate;
Element.prototype.animate = function (k, o) { const f = ST.animScale(); if (f === 1) return _animate.call(this, k, o); o = typeof o === 'number' ? { duration: o } : { ...o }; if (o.duration) o.duration *= f; if (o.delay) o.delay *= f; return _animate.call(this, k, o); };
// sound: every call is guarded; names come from docs/SFX.md
let lastSnd = {};
const snd = (name, o) => { try { if (!sfx.names || sfx.names.includes(name)) { const t = performance.now(); if ((name === 'tap' || name === 'untap' || name === 'click') && t - (lastSnd[name] || 0) < 90) return; lastSnd[name] = t; sfx.play(name, o); } } catch {} };
for (const ev of ['pointerdown', 'touchend', 'keydown']) addEventListener(ev, () => { try { sfx.init(); } catch {} }, { once: true, capture: true });
document.addEventListener('click', (e) => { if (e.target.closest?.('button')) snd('click'); }, true);


const $ = (id) => document.getElementById(id);
// ---------- viewport: MEASURE the real fixed box (never compute it from visualViewport) ----------
let boxProbe, saProbe, rawProbe;
function mkProbe(id, css) { const d = document.createElement('div'); d.id = id; d.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' + css; document.body.appendChild(d); return d; }
function fitViewport() {
  boxProbe ||= mkProbe('boxprobe', 'left:0;top:0;right:0;bottom:0;');
  saProbe ||= mkProbe('saprobe', 'left:0;top:0;width:0;height:0;padding:var(--sa-t) var(--sa-r) var(--sa-b) var(--sa-l);');
  let bw = boxProbe.clientWidth || innerWidth, bh = boxProbe.clientHeight || innerHeight;
  // installed (home-screen) app on iOS can report a stale/short viewport after launch or rotation: trust the larger of the measurements and the screen's size
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
  if (standalone) {
    bw = Math.max(bw, innerWidth); bh = Math.max(bh, innerHeight);
    const land = bw > bh, sMin = Math.min(screen.width, screen.height), sMax = Math.max(screen.width, screen.height);
    if (land && sMin > 200 && bh < sMin) bh = sMin;
    if (land && sMax > 400 && bw < sMax) bw = sMax;
  }
  document.documentElement.classList.toggle('standalone', standalone);
  const cs = getComputedStyle(saProbe), st = parseFloat(cs.paddingTop) || 0, sr = parseFloat(cs.paddingRight) || 0, sb = parseFloat(cs.paddingBottom) || 0, sl = parseFloat(cs.paddingLeft) || 0;
  // the 16:9 stage: largest box that fits; only the SIDE insets reduce the width
  const phone = bw > bh && (bh <= 500 || bw <= 900);   // dedicated full-bleed phone board: no 16:9 letterbox, no baked art
  const aw = Math.max(100, bw - sl - sr), ah = Math.max(100, bh - sb), sw = phone ? bw : Math.min(aw, ah * 16 / 9), sh = phone ? bh : sw * 9 / 16; // bottom inset reduces the height so the baked art lines up with the overlays
  const r = document.documentElement.style;
  r.setProperty('--app-w', bw + 'px'); r.setProperty('--app-h', bh + 'px');
  r.setProperty('--stage-w', Math.floor(sw) + 'px'); r.setProperty('--stage-h', Math.floor(sh) + 'px');
  r.setProperty('--stage-dx', phone ? '0px' : (sl - sr) / 2 + 'px'); r.setProperty('--stage-dy', phone ? '0px' : -sb / 2 + 'px');
  const cl = document.documentElement.classList;
  cl.toggle('compact', bh <= 500 || bw <= 900); cl.toggle('portrait', bh > bw); cl.toggle('short', bh <= 430); cl.toggle('phone', phone);
  return { bw, bh, st, sr, sb, sl };
}
fitViewport();
for (const ev of ['resize', 'orientationchange']) addEventListener(ev, () => { fitViewport(); for (const t of [100, 300, 700, 1500]) setTimeout(fitViewport, t); });
setTimeout(fitViewport, 500); setTimeout(fitViewport, 1500);
window.visualViewport?.addEventListener('resize', fitViewport);
if (window.ResizeObserver) new ResizeObserver(() => fitViewport()).observe(boxProbe);

// ?debug=1 : numbers box (tap to hide) so a single screenshot shows what the real browser reports
function startDebug() {
  if (document.getElementById('dbg')) { document.getElementById('dbg').remove(); return; }
  rawProbe = mkProbe('rawprobe', 'left:0;top:0;width:0;height:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);');
  const unitProbe = (u) => mkProbe('uprobe' + u, `left:0;top:0;width:0;height:100${u};`);
  const pv = unitProbe('vh'), pl = unitProbe('lvh'), pd = unitProbe('dvh'), ps = unitProbe('svh');
  const box = document.createElement('pre'); box.id = 'dbg'; document.body.appendChild(box);
  box.onclick = () => box.remove();
  const rr = (el) => { const q = el?.getBoundingClientRect(); return q ? `${q.left | 0},${q.top | 0} ${q.width | 0}x${q.height | 0}` : '-'; };
  const upd = () => {
    if (!box.isConnected) return; const vv = visualViewport, cs = getComputedStyle(rawProbe), f = (v) => parseFloat(v) || 0;
    box.textContent = `inner ${innerWidth}x${innerHeight}  dpr ${devicePixelRatio}\nvv ${vv ? `${vv.width | 0}x${vv.height | 0} off ${vv.offsetLeft | 0},${vv.offsetTop | 0} sc ${vv.scale}` : 'n/a'}\ndoc ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}  screen ${screen.width}x${screen.height}\nbox ${rr(boxProbe)}\napp ${rr($('app'))}\nnav ${rr($('nav'))}\nviews ${rr($('views'))}\nboard ${rr($('board'))}\nstage ${rr($('stage'))}\nvh ${pv.clientHeight} lvh ${pl.clientHeight} dvh ${pd.clientHeight} svh ${ps.clientHeight} standalone ${navigator.standalone}\nenv t${f(cs.paddingTop)} r${f(cs.paddingRight)} b${f(cs.paddingBottom)} l${f(cs.paddingLeft)}\nclasses ${document.documentElement.className}`;
  };
  upd(); setInterval(upd, 700);
}
if (new URLSearchParams(location.search).get('debug')) startDebug();

const ME = 0;
let g, byName, cards;
let mode = null;              // { type:'target', specs, onPick } | { type:'attackers', sel:Set } | { type:'blockers', sel, map }
let busy = false;

const PHASES = [['upkeep', 'UPKEEP', ['upkeep']], ['draw', 'DRAW', ['draw']], ['main1', 'MAIN', ['main1']], ['combat', 'COMBAT', ['attackers', 'blockers', 'damage']], ['main2', 'MAIN 2', ['main2']], ['end', 'END', ['end', 'cleanup']]];

const updMute = () => { const b = $('mute'); if (b) { b.classList.toggle('off', !ST.get('sound')); b.title = ST.get('sound') ? 'Mute' : 'Unmute'; } };
async function boot() {
  cards = await (await fetch('data/canonical_cards.json')).json();
  byName = indexCards(cards);
  initMenu({ byName, coverage: coverage(cards), onPlay: (c) => playFlow(c), canResume: resumable, onResume: resumeGame });
  $('concede').onclick = async () => { if (await askConfirm('Leave this game?', 'Leave')) leave(); };
  $('gear').onclick = openSettings;
  { let lp; const g0 = $('gear'); g0.addEventListener('pointerdown', () => { lp = setTimeout(() => { lp = 'done'; startDebug(); }, 1200); }); const cancel = () => { if (lp && lp !== 'done') clearTimeout(lp); }; g0.addEventListener('pointerup', cancel); g0.addEventListener('pointerleave', cancel); g0.addEventListener('click', (e) => { if (lp === 'done') { lp = null; e.stopImmediatePropagation(); } }, true); }
  $('mute').onclick = () => { ST.set('sound', !ST.get('sound')); applySettings(); updMute(); };
  $('help').onclick = () => startCoach(true);
  $('emote').onclick = (e) => { e.stopPropagation(); $('emotemenu').classList.toggle('on'); };
  $('emotemenu').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $('emotemenu').classList.remove('on'); AMB.emote(b.textContent); snd('click'); };
  document.addEventListener('click', (e) => { if (!e.target.closest('#emote,#emotemenu')) $('emotemenu')?.classList.remove('on'); });
  $('logbtn').onclick = toggleLog; $('logdrawer').querySelector('.lx').onclick = closeLog;
  ST.applyClasses(); applySettings(); updMute();
  matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => ST.applyClasses());
  const q = new URLSearchParams(location.search).get('deck'); if (q) { window.__quick = true; playFlow(DECK_LISTS[Object.keys(DECK_LISTS)[+q]], { foe: null, level: ST.get('difficulty') }); }
}
// ---------- playmat chooser (phone board) + settings ----------
const matUrl = (n) => new URL(`assets/ui/playmat_${n}.jpg`, location.href).href;
function applyMat(n) {
  const im = new Image();
  im.onload = () => $('board').style.setProperty('--mat', `url("${matUrl(n)}")`);
  im.onerror = () => { if (n !== 1) applyMat(1); else $('board').style.removeProperty('--mat'); };
  im.src = matUrl(n);
}
async function availableMats() {
  const probe = (n) => new Promise((res) => { const im = new Image(); im.onload = () => res(n); im.onerror = () => res(0); im.src = matUrl(n); });
  return (await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(probe))).filter(Boolean);
}
function refreshAmbient() { AMB.refresh(); }
function applySettings() { ST.applyClasses(); refreshAmbient(); try { sfx.setEnabled(ST.get('sound')); sfx.setVolume(ST.get('volume')); } catch {} applyMat(+ST.get('playmat') || 5); if (g && g.aiLevel !== undefined) g.aiLevel = ST.get('difficulty'); }
async function openSettings() {
  const mats = isPhone() ? await availableMats() : []; const v = (k) => ST.get(k);
  const seg = (k, opts) => `<div class="seg" data-k="${k}">${opts.map(([val, lbl]) => `<button data-v="${val}" class="${v(k) === val ? 'on' : ''}">${lbl}</button>`).join('')}</div>`;
  const chk = (k, lbl) => `<label class="row2"><input type="checkbox" data-k="${k}" ${v(k) ? 'checked' : ''}> ${lbl}</label>`;
  const act = await modal((box, close) => {
    box.classList.add('setbox');
    box.innerHTML = `<p><b>Settings</b></p>
      <div class="setlbl">Sound</div><label class="row2"><input type="checkbox" data-k="sound" ${v('sound') ? 'checked' : ''}> Sound effects</label><input type="range" data-k="volume" min="0" max="1" step="0.05" value="${v('volume')}">
      <div class="setlbl">Animation speed</div>${seg('speed', [['off', 'Off'], ['fast', 'Fast'], ['normal', 'Normal'], ['slow', 'Slow']])}${ST.reducedMotion() ? '<small class="muted">Reduced motion is on in your system: animations stay minimal.</small>' : ''}
      <div class="setlbl">Auto-pass stops</div>${chk('stopOppSpell', 'When the opponent casts a spell I can answer')}${chk('stopMyBegin', 'In my upkeep and draw step')}${chk('stopOppEnd', 'At the opponent\'s end step')}
      <div class="setlbl">AI difficulty (next game)</div>${seg('difficulty', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']])}
      <div class="setlbl">Display</div>${chk('pips', 'Show mana costs on cards (phone)')}${isPhone() ? chk('lefty', 'Left-handed layout') + chk('ambient', 'Ambient playmat particles') : ''}${navigator.vibrate ? chk('haptics', 'Haptic feedback') : ''}
      ${mats.length ? `<div class="setlbl">Playmat</div><div class="mats">${mats.map((n) => `<button class="mat ${n === +v('playmat') ? 'sel' : ''}" data-n="${n}"><img src="${matUrl(n)}" draggable="false"><span>Playmat ${n}</span></button>`).join('')}</div>` : ''}
      <div class="dlgbtns"><button class="help">How to play</button>${g ? '<button class="leave">Leave game</button>' : ''}<button class="yes">Close</button></div>`;
    box.addEventListener('change', (e) => { const k = e.target.dataset.k; if (!k) return; ST.set(k, e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value); applySettings(); });
    box.addEventListener('input', (e) => { if (e.target.type === 'range') { ST.set(e.target.dataset.k, +e.target.value); applySettings(); } });
    box.addEventListener('click', (e) => {
      const sb = e.target.closest('.seg button'); if (sb) { const k = sb.parentElement.dataset.k; ST.set(k, sb.dataset.v); sb.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === sb)); applySettings(); return; }
      const mb = e.target.closest('.mat'); if (mb) { ST.set('playmat', +mb.dataset.n); applySettings(); box.querySelectorAll('.mat').forEach((x) => x.classList.toggle('sel', x === mb)); }
    });
    box.querySelector('.help').onclick = () => close('help'); box.querySelector('.leave')?.addEventListener('click', () => close('leave')); box.querySelector('.yes').onclick = () => close('ok'); box.querySelector('.yes').focus();
  });
  if (act === 'leave' && await askConfirm('Leave this game?', 'Leave')) leave();
  if (act === 'help' && g) startCoach(true);
}
function leave() { ZN.resetCounts(); SX.reset(); AMB.stop(); TG.reset(); runId++; mode = null; g = null; window.g = null; busy = false; $('inspect').hidden = true; closeLog(); document.querySelectorAll('.scr,.coachring').forEach((e) => e.remove()); clearSave(); showApp(); }

// ---------- game setup flow: opponent picker -> coin flip -> mulligan -> (first time) coach marks ----------
let runId = 0, lastRun = null, prevHand = null;
const deckCounts = (name) => Object.entries(DECK_LISTS[name] || {}).filter(([k]) => k[0] !== '_');
function deckColors(name) { const set = new Set(); for (const [n] of deckCounts(name)) (byName[n]?.[0]?.colors || []).forEach((c) => set.add(c)); return ['W', 'U', 'B', 'R', 'G'].filter((c) => set.has(c)); }
function blurbOf(name) {
  try { const d = DK.describeDeck?.(name); if (typeof d === 'string' && d) return d; if (d && (d.blurb || d.text || d.description)) return d.blurb || d.text || d.description; } catch {}
  return `${deckColors(name).join('') || 'Colorless'} deck · ${deckCounts(name).reduce((a, [, n]) => a + n, 0)} cards`;
}
async function playFlow(counts, again) {
  const rid = ++runId; let pick = again;
  if (!pick) {
    const decks = Object.keys(DECK_LISTS).map((n) => ({ name: n, blurb: blurbOf(n), colors: deckColors(n) }));
    pick = await SC.showPicker(decks, ST.get('difficulty')); if (!pick || rid !== runId) return;
    ST.set('difficulty', pick.level);
  }
  let foe = pick.foe;
  if (!foe && AI.pickOpponent) { try { const r = AI.pickOpponent(counts, pick.level); foe = typeof r === 'string' ? r : r?.name; } catch {} }
  if (!foe || !DECK_LISTS[foe]) { const names = Object.keys(DECK_LISTS); foe = names[Math.floor(Math.random() * names.length)]; }
  lastRun = { counts, foe, level: pick.level };
  const quick = window.__fast || window.__auto || window.__quick;
  g = new Game([buildDeckFrom(counts, byName), buildDeck(foe, byName)], { names: ['You', 'Opponent'], mulligan: true, autoMulligan: quick ? true : [1], rng: makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0) });
  g.aiLevel = pick.level; g.aiDifficulty = pick.level; window.g = g; window.__stats = { dmg: [0, 0], cast: 0, died: 0 };
  shownLife[0] = shownLife[1] = displayLife[0] = displayLife[1] = null; displayDmg.clear(); prevHand = null; peekId = null; needCoach = !quick && !ST.get('onboarded');
  hideApp(); $('board').hidden = false; $('over').hidden = true; mode = null; closeLog(); refreshAmbient(); 
  const ci = g.events.findIndex((e) => e.type === 'coin'); const coin = ci >= 0 ? g.events.splice(ci, 1)[0] : null;
  if (!quick) { render(); if (coin) { await SC.showCoin(coin.winner === ME); if (rid !== runId) return; } }
  snd('deal'); tick();
}
let needCoach = false, openingBusy = false;
// native opening flow: g.waiting 'mulligan' (keep / mulligan) and 'bottom' (London bottoming)
async function openOpening() {
  const w = g?.waiting; if (!w || w.player !== ME || openingBusy || (w.kind !== 'mulligan' && w.kind !== 'bottom')) return;
  openingBusy = true;
  try {
    if (w.kind === 'mulligan') {
      snd('drawmany');
      const r = await SC.showMulligan(w.hand.map((c) => c.def), w.count, w.canMulligan); if (g?.waiting !== w) return;
      if (r === 'keep') g.keepHand(ME); else g.mulligan(ME);
    } else {
      const opts = w.hand.map((c) => ({ value: c.id, label: c.def.name, card: c.def }));
      const ids = await askPick(`Put ${w.n} card${w.n > 1 ? 's' : ''} on the bottom of your library`, opts, { min: w.n, max: w.n }); if (g?.waiting !== w) return;
      g.bottomCards(ME, ids);
    }
  } finally { openingBusy = false; refresh(); }
  if (needCoach && g && g.waiting?.kind !== 'mulligan' && g.waiting?.kind !== 'bottom') { needCoach = false; setTimeout(() => startCoach(), 500); }
}
// ---------- onboarding ----------
function startCoach(force) {
  const T = (sel) => () => document.querySelector(sel);
  const steps = [
    { title: 'Goal', text: 'Reduce your opponent\'s life from 20 to 0 using creatures and spells. You are the bottom portrait.', target: T('#life-1') },
    { title: 'Play a land', text: 'Drag a land from your hand onto the table (on a phone: tap it once to peek, tap again to play). You may play one land per turn.', target: T('#hand') },
    { title: 'Cast a spell', text: 'Drag a spell onto the table, or onto its target. Lands tap automatically to pay; you will see them pulse. Press and hold any card to read it.', target: T('#hand') },
    { title: 'The phase tracker', text: 'It shows where you are in the turn: Upkeep, Draw, Main (play cards), Combat, Main 2, End. The highlighted step is the current one.', target: T('#phases') },
    { title: 'Attack', text: 'In Combat, drag your creatures up (or tap them) to attack, then confirm. New creatures cannot attack the turn they arrive. When blocking, drag a blocker onto an attacker.', target: T('#field-me') },
    { title: 'Pass the turn', text: 'The orange button moves to the next step or ends your turn. Use the gear for settings, the scroll for the game log, and ? to see this again.', target: T('#action') },
  ];
  return SC.runCoach(steps).then(() => { if (!force) ST.set('onboarded', true); });
}
// ---------- save / resume (engine g.canSerialize / g.serialize / Game.restore) ----------
const SAVE_KEY = 'mtgclassic.save.v2', SAVE_V = 2; let lastSave = 0, noAnimOnce = false;
const BUILD = () => window.BUILD || 'dev';
function saveGame() {
  if (!g || g.winner || !lastRun || typeof g.canSerialize !== 'function') return; const now = Date.now(); if (now - lastSave < 500) return;
  try { if (!g.canSerialize()) return; lastSave = now; localStorage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_V, build: BUILD(), ts: now, foe: lastRun.foe, level: lastRun.level, counts: lastRun.counts, playmat: ST.get('playmat'), turn: g.turn, life: [g.players[0].life, g.players[1].life], ser: g.serialize() })); } catch {}
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
// returns {foe, level, turn, life} for the Home 'Resume game' card, or null (older builds / versions are ignored and removed)
function resumable() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; const d = JSON.parse(raw); if (d.v !== SAVE_V || d.build !== BUILD() || typeof Game.restore !== 'function') { clearSave(); return null; } return { foe: d.foe, level: d.level, turn: d.turn, life: d.life, ts: d.ts }; } catch { clearSave(); return null; }
}
function resumeGame() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY)); g = Game.restore(d.ser, { byName, rng: makeRng(1) }); lastRun = { counts: d.counts, foe: d.foe, level: d.level }; window.g = g; window.__stats = { dmg: [0, 0], cast: 0, died: 0 };
    if (d.playmat) ST.set('playmat', d.playmat); applyMat(+ST.get('playmat') || 5);
    shownLife[0] = shownLife[1] = displayLife[0] = displayLife[1] = null; displayDmg.clear(); prevHand = null; peekId = null; g.events.length = 0;
    hideApp(); $('board').hidden = false; $('over').hidden = true; mode = null; noAnimOnce = true; refreshAmbient(); tick();
  } catch (e) { console.warn('resume failed', e); clearSave(); g = null; window.g = null; showApp(); }
}
// ---------- game log drawer ----------
let logOpen = false;
function logLines() { const L = g?.logEvents; if (Array.isArray(L) && L.length) return L.map((x) => (typeof x === 'string' ? x : x.text || x.msg || x.message || '')); return g?.log || []; }
let nameRe = null;
function linkify(t) {
  if (!nameRe) { const ns = Object.keys(byName || {}).sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); nameRe = ns.length ? new RegExp('(' + ns.join('|') + ')', 'g') : /$^/; }
  return esc(t).replace(nameRe, (m) => `<a class="cl" data-card="${esc(m)}">${m}</a>`);
}
function renderLog() {
  const d = $('logdrawer'); if (!d || !logOpen) return; const ll = d.querySelector('.ll');
  const ev = g?.logEvents; let html = '';
  if (Array.isArray(ev) && ev.length && typeof ev[0] === 'object') {
    let turn = null;
    for (const x of ev.slice(-300)) { if (x.turn !== turn) { turn = x.turn; html += `<div class="lturn">Turn ${turn}${x.player != null && x.kind === 'turn' ? ` · ${x.player === ME ? 'You' : 'Opponent'}` : ''}</div>`; } if (x.kind === 'turn') continue; html += `<div class="lk-${x.kind} lp${x.player ?? ''}">${linkify(x.text || '')}</div>`; }
  } else html = logLines().slice(-120).map((l) => `<div>${linkify(l)}</div>`).join('');
  if (ll.dataset.h !== html) { ll.dataset.h = html; ll.innerHTML = html; ll.scrollTop = ll.scrollHeight; }
}
function closeLog() { logOpen = false; $('logdrawer')?.classList.remove('on'); }
function toggleLog() { logOpen = !logOpen; $('logdrawer').classList.toggle('on', logOpen); snd(logOpen ? 'open' : 'close'); renderLog(); }
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('#logdrawer a.cl'); if (!a) return; const d = byName[a.dataset.card]?.[0]; if (!d) return;
  e.stopPropagation(); openInspect(`<div class="big"><img src="${d.art}"><div class="info">${infoHtml({ def: d, id: -1 }, true)}</div></div>`);
}, true);

// ---------- driver ----------
function shouldStop() {
  const w = g.waiting; if (!w) return false;
  if (w.kind !== 'priority') return true;
  const top = g.stack[g.stack.length - 1];
  if (g.active === ME && ST.get('stopMyBegin') && (g.step === 'upkeep' || g.step === 'draw') && !top) return true;
  if (g.active !== ME && ST.get('stopOppEnd') && g.step === 'end' && !top) return true;
  if (top) return top.controller === ME || (ST.get('stopOppSpell') && g.hasResponse(ME));
  if (g.active === ME) { if (g.step === 'main1' || g.step === 'main2') return true; return (g.step === 'attackers' || g.step === 'blockers') && g.hasResponse(ME); }
  return (g.step === 'attackers' || g.step === 'blockers') && g.hasResponse(ME);
}
async function tick() {
  if (busy) return; busy = true;
  try {
    for (let n = 0; n < 500; n++) {
      if (!g) return;
      render();
      if (g.winner) { await fxWait(); if (g) gameOver(); return; }
      const w = g.waiting; if (!w) return;
      await fxWait(); if (!g) return;
      if (w.player !== ME || window.__auto) { await sleep(w.kind === 'priority' && !g.stack.length ? 420 : 750); if (!g) return; aiAct(g, w.player); continue; }
      if (!shouldStop()) { await sleep(g.stack.length ? 400 : 120); g.pass(ME); continue; }
      return; // wait for the human
    }
  } finally { busy = false; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, window.__fast ? Math.min(ms, 30) : ms * ST.animScale()));
// fxHold(ms): animations in flight; tick() waits before the AI or auto-pass continues.
let fxUntil = 0;
export const fxHold = (ms) => { fxUntil = Math.max(fxUntil, performance.now() + ms * ST.animScale()); };
window.fxHold = fxHold;
async function fxWait() { while (g && performance.now() < fxUntil) await new Promise((r) => setTimeout(r, Math.min(80, fxUntil - performance.now() + 5))); }
const refresh = () => { busy = false; tick(); };

// ---------- rendering ----------
const IMG = (c) => `<img src="${c.def.art}" alt="${c.def.name}" draggable="false">`;
const shownLife = [null, null], displayLife = [null, null], displayDmg = new Map(); let prevShownLife = [null, null], fxGen = 0;
function ptHtml(p) {
  if (!g.isCreature(p)) return '';
  const d = displayDmg.has(p.id) ? displayDmg.get(p.id) : p.damage; const bp = g.power(p), bt = g.toughness(p);
  const cls2 = bp > +p.card.def.power || bt > +p.card.def.toughness ? 'buff' : '';
  return `<span class="pt ${cls2} ${d ? 'hurt' : ''}">${bp}/${bt - d}</span>${d ? `<span class="dmg">${d}</span>` : ''}`;
}
function patchPerm(id) { const el = permEl(id), p = g.perm(id); if (!el || !p) return; el.querySelectorAll(':scope > .pt, :scope > .dmg').forEach((x) => x.remove()); el.insertAdjacentHTML('beforeend', ptHtml(p)); SX.decoPT(el, p); }
function setLifeText(i, v, quiet) {
  const num = $('life-' + i).querySelector('.num'), o = shownLife[i]; num.textContent = v; shownLife[i] = v;
  if (!quiet && o !== null && o !== v) num.animate([{ transform: 'scale(1.7)', color: v < o ? '#ff6a55' : '#7dff9a' }, { transform: 'scale(1)', color: '#fff' }], { duration: 600, easing: 'ease-out' });
}
function permHtml(p, extra = '') {
  const cls = ['card', p.tapped && 'tapped', p.sick && g.isCreature(p) && 'sick', g.combat.attackers.includes(p.id) && 'attacking', ...extra.split(' ')].filter(Boolean).join(' ');
  let pt = '';
  const ptd = ptHtml(p); pt = ptd;
  const dm = '';
  const cn = Object.entries(p.counters || {}).filter(([, n]) => n).map(([k, n]) => `${n}× ${k}`).join(' · ');
  const auras = g.players.flatMap((pl) => pl.bf).filter((a) => a.attachedTo === p.id).map((a, i) => `<div class="card aura" data-id="${a.id}" data-kind="perm" style="--i:${i}">${IMG(a.card)}</div>`).join('');
  return `<div class="${cls}" data-id="${p.id}" data-kind="perm">${auras}${IMG(p.card)}${g.isLand(p) ? '' : `<span class="ovl pips">${costHtml(p.card.def.manaCost)}</span>`}${pt}${dm}</div>`;
}
function pile(list, label, pl, z = 'gy') {
  const top = list[list.length - 1];
  return `<div class="pile" ${pl !== undefined ? `data-pl="${pl}" data-z="${z}"` : ''}>${top ? `<div class="card" data-id="${top.id}" data-kind="pilecard">${IMG(top)}</div>` : '<div class="empty"></div>'}<span class="cnt">${list.length}</span><span class="lbl">${label}</span></div>`;
}
const setHtml = (id, html) => { const el = $(id); if (el._h !== html) { el._h = html; el.innerHTML = html; } };
// life that changed without a dmg/heal event (paying life, effects that set life): red dim / green rise
function lifeNoEvent() {
  for (const i of [0, 1]) {
    const cur = g.players[i].life, was = prevShownLife[i]; if (was == null || was === cur || displayLife[i] != null || noAnimOnce) continue;
    if (g.events.some((e) => (e.type === 'dmg' && e.target.kind === 'player' && e.target.id === i) || (e.type === 'heal' && e.pid === i))) continue;
    const el = $('life-' + i), r = el.getBoundingClientRect(); SX.lifeShift(i, was, cur); void r;
  }
}
function phaseMark() {
  let m = $('phasemark'); if (!m) { m = document.createElement('div'); m.id = 'phasemark'; $('stage').appendChild(m); }
  const on = $('phases').querySelector('.on'); if (!on) { m.style.opacity = 0; return; }
  const sr = $('stage').getBoundingClientRect(), r = on.getBoundingClientRect(); Object.assign(m.style, { opacity: 1, left: r.left - sr.left + 'px', top: r.top - sr.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}
function renderRaw() {
  const wk = g.waiting?.kind; if ((mode?.type === 'attackers' && wk !== 'attackers') || (mode?.type === 'blockers' && wk !== 'blockers')) mode = null;
  const [me, foe] = [g.players[ME], g.players[1]];
  const hosted = (p) => p.attachedTo != null && g.perm(p.attachedTo);
  const split = (pl) => [pl.bf.filter((p) => g.isLand(p) && !hosted(p)), pl.bf.filter((p) => !g.isLand(p) && !hosted(p))];
  const [fl, fc] = split(foe), [ml, mc] = split(me);
  const phone = isPhone(), isMisc = (p) => !g.isCreature(p);
  // phone: lands grouped by name into small overlapping stacks (max 4 per stack), artifacts/enchantments in their own column
  const landsHtml = (list) => {
    if (!phone) return list.map((p) => permHtml(p)).join('');
    const by = new Map(); for (const p of list) { const k = p.card.def.name; if (!by.has(k)) by.set(k, []); by.get(k).push(p); }
    const out = []; for (const arr of by.values()) for (let i = 0; i < arr.length; i += 4) out.push(arr.slice(i, i + 4));
    return out.map((st) => `<div class="lstack" style="--n:${st.length}">${st.map((p) => permHtml(p)).join('')}</div>`).join('');
  };
  $('field-opp-lands').innerHTML = landsHtml(fl);
  $('field-opp').innerHTML = (phone ? fc.filter((p) => !isMisc(p)) : fc).map((p) => permHtml(p)).join('');
  $('field-me').innerHTML = (phone ? mc.filter((p) => !isMisc(p)) : mc).map((p) => permHtml(p)).join('');
  $('field-opp-misc').innerHTML = phone ? fc.filter(isMisc).map((p) => permHtml(p)).join('') : '';
  $('field-me-misc').innerHTML = phone ? mc.filter(isMisc).map((p) => permHtml(p)).join('') : '';
  $('field-me-lands').innerHTML = landsHtml(ml);
  setHtml('opp-hand', foe.hand.map(() => '<div class="cb"></div>').join(''));
  const cnt = [me.library.length, me.gy.length, foe.library.length, foe.gy.length, me.hand.length, foe.hand.length];
  $('zones-opp').innerHTML = pile(foe.library.map((c) => c).slice(-0), 'Library').replace(/<div class="card".*?<\/div>/, '<div class="cardback"></div>') + pile(foe.gy, 'Graveyard', 1);
  $('zones-me').innerHTML = pile(me.library, 'Library').replace(/<div class="card".*?<\/div>/, '<div class="cardback"></div>') + pile(me.gy, 'Graveyard', 0);
  ZN.pileFx(cnt, noAnimOnce);
  const hn = me.hand.length, step = Math.min(phone ? 4.4 : 3.4, 26 / Math.max(hn, 1));
  // the hand never grows past 44% of the stage width, so it cannot cover the lands row
  const sr = $('stage').getBoundingClientRect(), hw = phone ? 0.244 * sr.height : sr.height < 360 ? Math.min(0.17 * sr.height, 0.094 * sr.width) : Math.min((document.documentElement.classList.contains('short') ? 0.155 : 0.175) * sr.height, (document.documentElement.classList.contains('short') ? 0.09 : 0.096) * sr.width);
  const base = phone ? (hn <= 7 ? 0.74 : 0.6) : 0.8, adv = hn > 1 ? Math.min(base * hw, ((phone ? 0.44 : 0.44) * sr.width - hw) / (hn - 1)) : hw;
  $('hand').innerHTML = me.hand.map((c, i) => { const k = i - (hn - 1) / 2; const d = c.def, cr = d.types.includes('Creature');
    const ov = `${d.manaCost ? `<span class="ovl pips">${costHtml(d.manaCost)}</span>` : ''}${cr ? `<span class="pt">${d.power}/${d.toughness}</span>` : ''}`;
    return `<div class="card ${peekId === c.id ? 'peek' : ''}" data-id="${c.id}" data-kind="hand" style="--rot:${(k * step * (adv / (base * hw))).toFixed(2)}deg;--dy:${(k * k * (phone ? 0.3 : 0.16)).toFixed(2)}cqh;margin:0 ${((adv - hw) / 2).toFixed(1)}px">${IMG(c)}${ov}</div>`; }).join('');
  if (prevHand != null && hn > prevHand) snd(hn - prevHand >= 3 ? 'drawmany' : 'draw'); prevHand = hn;
  prevShownLife = [...shownLife];
  lifeNoEvent();
  for (const i of [0, 1]) { const l = $('life-' + i); l.querySelector('.who').textContent = g.players[i].name; setLifeText(i, displayLife[i] ?? g.players[i].life); l.classList.toggle('active', g.active === i); }
  const curPh = PHASES.findIndex((p) => p[2].includes(g.step)); $('stage').classList.toggle('lowme', g.players[ME].life <= 5 && !g.winner); $('stage').classList.toggle('lowopp', g.players[1].life <= 5 && !g.winner);
  setHtml('phases', PHASES.map((p, i) => `<div class="${i === curPh ? 'on' : i < curPh ? 'done' : ''}">${p[1]}</div>`).join(''));
  $('turnno').textContent = g.turn; phaseMark();
  $('log').innerHTML = g.log.slice(-7).map((l) => `<div>${l}</div>`).join('');
  renderStack();
  decorate();
  buttons();
  placeBlockers();
  effects();
}
let prevStackIds = new Set();
function renderStack() {
  const s = $('stack');
  if (!g.stack.length) { s.className = ''; s.innerHTML = ''; prevStackIds = new Set(); TG.stack(); return; }
  const top = g.stack[g.stack.length - 1], n = g.stack.length;
  s.className = 'on';
  s.innerHTML = `<div class="title">${top.controller === ME ? 'Your spell' : 'Instant speed response'}</div><div class="items">${g.stack.map((it, i) => `<div class="card ${i === n - 1 ? 'top' : ''} ${it.kind === 'ability' ? 'ab' : ''}" style="--i:${i};--n:${n}" data-id="${it.card.id}" data-kind="stackcard" data-sid="${it.id}">${IMG(it.card)}${it.kind === 'ability' ? '<span class="abchip">Ability</span>' : ''}</div>`).join('')}</div>${top.targets.length ? `<div class="tgt">Target: ${top.targets.map((t) => g.refText(t)).join(', ')}</div>` : ''}`;
  prevStackIds = new Set(g.stack.map((it) => it.id)); TG.stack();
}
let lastStep = '', lastLogLen = 0;
const isPhone = () => document.documentElement.classList.contains('phone');
let peekId = null;
const COL = { W: '#fff0b0', U: '#6fbaff', B: '#b06bff', R: '#ff7a33', G: '#6dff8a' };
const lastRects = new Map();           // card id -> last layout rect (survives the card leaving the DOM)
const pendingClash = new Map();        // attacker id -> {dx,dy,at} for ghosts of attackers that die in the clash
const ghostMode = new Map();           // card id -> 'sac' | 'shatter' | 'burn'
const ghostDelay = new Map();          // card id -> ms until its ghost should leave
const cardCol = (id) => COL[findCard(id)?.def.colors?.[0]] || '#e8e2d0';
const permEl = (id) => document.querySelector(`#stage .card[data-kind=perm][data-id="${id}"]`);
SX.init({ get g() { return g; } });
const rectOfRef = (ref) => ref.kind === 'player' ? $('life-' + ref.id).getBoundingClientRect() : (permEl(ref.id)?.getBoundingClientRect() || lastRects.get(ref.id));
const pt = (r) => [r.left + r.width / 2, r.top + r.height / 2];
function setBanner(t, big) {
  const b = $('banner'); b.textContent = t; b.className = ''; void b.offsetWidth; b.className = 'show' + (big ? ' big' : '');
  clearTimeout(setBanner.t); setBanner.t = setTimeout(() => (b.className = ''), big ? 2000 : 1500);
}
function effects() {
  const key = g.turn + g.step;
  if (key !== lastStep) { lastStep = key; const nm = { attackers: 'Attackers', blockers: 'Blockers', damage: 'Combat damage', main2: 'Main phase 2' }[g.step]; if (nm && (g.step !== 'attackers' || g.combat.attackers.length)) setBanner(nm); if (g.step === 'main1') { setBanner(g.active === ME ? 'Your turn' : 'Opponent\'s turn', true); snd(g.active === ME ? 'turn' : 'opp'); } else if (nm && (g.step !== 'attackers' || g.combat.attackers.length)) snd(g.step === 'attackers' ? 'attack' : 'phase'); }
  lunging.clear();
  const evs = g.events.splice(0); if (!evs.length) return;
  pendingClash.clear(); ghostDelay.clear();
  const gen = ++fxGen;
  let t = Math.max(0, fxUntil - performance.now()) / ST.animScale(), end = t, impact = null;
  const sc = ST.animScale();
  const later = (d, fn) => { setTimeout(fn, d * sc); end = Math.max(end, d); };
  const clashIds = new Set(evs.filter((e) => e.type === 'clash').map((e) => e.id));
  const isCombat = (e) => e.combat || (clashIds.size && e.from != null && (clashIds.has(e.from) || (e.target.kind === 'perm' && clashIds.has(e.target.id))));
  const lossSum = [0, 0], lossApplied = [0, 0], dmgSum = new Map();
  for (const e of evs) if (e.type === 'dmg') { if (e.target.kind === 'player') lossSum[e.target.id] += e.n; else dmgSum.set(e.target.id, (dmgSum.get(e.target.id) || 0) + e.n); }
  const startLunge = (id, tgt, at, k) => {
    const sr = lastRects.get(id), trr = tgt.kind === 'player' ? $('life-' + tgt.id).getBoundingClientRect() : (lastRects.get(tgt.id) || permEl(tgt.id)?.getBoundingClientRect());
    if (!sr || !trr) return; const [sx, sy] = pt(sr), [tx, ty] = pt(trr); const d = [(tx - sx) * k, (ty - sy) * k];
    const el = permEl(id); let off = [0, 0], T = [0, 0];
    if (el) { T = tOf(el); const [hx, hy] = pt(el.getBoundingClientRect()); off = [sx - hx + T[0], sy - hy + T[1]]; lunging.add(id); }
    pendingClash.set(id, { dx: d[0], dy: d[1], at });
    end = Math.max(end, at + 520);
    if (el) el.animate([{ translate: `${off[0]}px ${off[1]}px` }, { translate: `${off[0] + d[0]}px ${off[1] + d[1]}px`, offset: 0.4, easing: 'ease-in' }, { translate: `${off[0] + d[0] * 0.9}px ${off[1] + d[1] * 0.9}px`, offset: 0.48 }, { translate: `${T[0]}px ${T[1]}px` }], { delay: at, duration: 480, fill: 'backwards', easing: 'cubic-bezier(.3,.1,.3,1)' });
  };
  const hit = (e, at) => {
    const r = rectOfRef(e.target); if (!r) return;
    const el = e.target.kind === 'player' ? $('life-' + e.target.id) : permEl(e.target.id);
    if (el) hitFx(el, at);
    const [x, y] = pt(r);
    if (e.target.kind === 'player') faceSlam(e.n, at, el);
    if (e.target.kind === 'player') {
      const pid = e.target.id; if (displayLife[pid] == null) { displayLife[pid] = prevShownLife[pid] ?? g.players[pid].life + lossSum[pid]; setLifeText(pid, displayLife[pid], true); }
      later(at, () => { if (displayLife[pid] == null) return; displayLife[pid] -= e.n; lossApplied[pid] += e.n; setLifeText(pid, displayLife[pid]); });
    } else {
      const pp = g.perm(e.target.id);
      if (pp) { if (!displayDmg.has(pp.id)) { displayDmg.set(pp.id, Math.max(0, pp.damage - (dmgSum.get(pp.id) || 0))); patchPerm(pp.id); }
        later(at, () => { if (!displayDmg.has(pp.id)) return; displayDmg.set(pp.id, displayDmg.get(pp.id) + e.n); patchPerm(pp.id); }); }
    }
    later(at, () => { FX.burst(x, y, { n: 10, dist: 55, size: 5, color: '#ffb347' }); FX.ring(x, y, { size: 30, grow: 2.2, dur: 380, color: '#ffd9a0', width: 2 });
      const f = document.createElement('div'); f.className = 'float'; f.textContent = '-' + e.n; f.style.left = x - 14 + 'px'; f.style.top = r.top + 'px'; $('board').appendChild(f); setTimeout(() => f.remove(), 1100); });
  };
  const dieCount = evs.filter((e) => e.type === 'die').length; let sweepDone = false, wipeDone = false, untapIdx = 0;
  const dmgIds = new Set(evs.filter((e) => e.type === 'dmg' && e.target.kind === 'perm').map((e) => e.target.id));
  const sacIds = new Set(); { const L = g.logEvents || []; if (L.length < lastLogLen) lastLogLen = 0; for (let i = lastLogLen; i < L.length; i++) if (/ sacrifices /.test(L[i].text || '')) (L[i].cardIds || []).forEach((id) => sacIds.add(id)); lastLogLen = L.length; }
  ghostMode.clear(); ZN.onEvents(evs); TG.onEvents(evs); SX.onEvents(evs); AMB.onEvents(evs);
  const stats = window.__stats || (window.__stats = { dmg: [0, 0], cast: 0, died: 0 });
  const sound = (e) => {
    const at = e.type === 'dmg' && isCombat(e) ? (impact ?? t) + 190 : t;
    const P = (n, o, dl = 0) => later(at + dl, () => snd(n, o));
    switch (e.type) {
      case 'cast': P('cast'); ST.haptic(8); stats.cast++; break;
      case 'resolve': P('resolve', {}, 120); break;
      case 'enter': case 'token': { const pm = g.perm(e.id); P(pm && g.isLand(pm) && e.type === 'enter' ? 'land' : 'creature', {}, 200); break; }
      case 'dmg': { stats.dmg[e.target.kind === 'player' ? e.target.id : 0] += e.target.kind === 'player' ? e.n : 0; ST.haptic(e.n >= 4 ? 40 : 18);
        P(e.n >= 4 ? 'heavy' : isCombat(e) ? 'hit' : e.target.kind === 'player' && e.from == null ? 'damage' : e.from != null && !isCombat(e) ? 'bolt' : 'hit'); break; }
      case 'heal': P('heal'); break;
      case 'prevent': case 'regen': P('heal', { volume: 0.5 }); break;
      case 'counter': P('counter'); break;
      case 'die': stats.died++; if (dieCount >= 3) { if (!sweepDone) { sweepDone = true; P('sweeper'); } } else P('destroy'); ST.haptic(25); break;
      case 'bounce': P('exile', { pitch: 1.4 }); break;
      case 'buff': P('resolve', { pitch: 1.3 }); break;
      case 'control': P('resolve', { pitch: 0.9 }); break;
      case 'attach': P('resolve', { pitch: 1.5 }); break;
      case 'flip': P('click'); break;
      case 'shuffle': P('drawmany', { volume: 0.4 }); break;
      case 'extraTurn': P('turn', { pitch: 1.2 }); break;
      case 'tap': P('tap', { volume: 0.5 }); break;
      case 'untap': P('untap', { volume: 0.5 }); break;
      case 'sweep': P('sweeper'); break;
    }
  };
  for (const e of evs) {
    sound(e);
    if (e.type === 'cast') {
      const c = cardCol(e.id); later(t + 240, () => { const el = document.querySelector(`#stack .card[data-id="${e.id}"]`); const r = el?.getBoundingClientRect(); if (r) { const [x, y] = pt(r); FX.glow(x, y, { color: c, size: r.width * 2, dur: 650 }); FX.ring(x, y, { color: c, size: r.width * 0.8, grow: 2, dur: 500, width: 2 }); } });
      t += 120;
    } else if (e.type === 'resolve') { ghostDelay.set(e.id, t); }
    else if (e.type === 'counter') {
      const r = lastRects.get(e.id); ghostDelay.set(e.id, t + 120);
      if (r) { const [x, y] = pt(r); later(t, () => { FX.flash('#8fb8ff', 420, 0.35); FX.burst(x, y, { color: '#8fd0ff', n: 26, dist: 110, size: 7 }); FX.ring(x, y, { color: '#8fd0ff', size: r.width, grow: 2.6, dur: 600, width: 4 }); FX.glow(x, y, { color: '#8fd0ff', size: r.width * 2.4, dur: 600 }); }); }
      t += 380;
    } else if (e.type === 'clash') {
      startLunge(e.id, e.tgt, t, 0.8); impact = t + 190; t += 280;
    } else if (e.type === 'dmg') {
      const combat = isCombat(e); let at = combat ? (impact ?? t) : t; const tr = rectOfRef(e.target);
      if (combat && e.from != null && !clashIds.has(e.from)) startLunge(e.from, e.target, Math.max(0, at - 190), 0.35);   // blocker strikes back
      if (!combat && e.from != null && tr) {
        const sr = lastRects.get(e.from) || permEl(e.from)?.getBoundingClientRect();
        if (sr) {
          const s = pt(sr), d = pt(tr), col = cardCol(e.from), nm = findCard(e.from)?.def.name || '';
          const blt = /lightning|bolt|jovial|ball|storm/i.test(nm) || findCard(e.from)?.def.colors?.[0] === 'U';
          const dur = blt ? 160 : 360; later(t, () => (blt ? FX.bolt(s, d, { color: col === '#e8e2d0' ? '#9fd4ff' : col }) : FX.orb(s, d, { color: col, dur, size: 30 })));
          at = t + dur - 10; t = at + 110;
        }
      }
      hit(e, at);
    } else if (e.type === 'die') {
      const r = lastRects.get(e.id); ghostDelay.set(e.id, t);
      const dm = sacIds.has(e.id) || e.how === 'sacrifice' ? 'sac' : dmgIds.has(e.id) ? 'burn' : 'shatter'; ghostMode.set(e.id, dm);
      if (r && dm === 'burn' && dieCount < 3) { const [x, y] = pt(r); later(t, () => FX.burst(x, y, { color: '#ff7a33', n: 22, dist: 90, size: 6, dur: 800 })); }
      if (dieCount >= 3 && !wipeDone && !evs.some((x) => x.type === 'sweep')) { wipeDone = true; const sr0 = $('stage').getBoundingClientRect(); later(t, () => { FX.flash('#fff', 700, 0.55); FX.shockwave(sr0.left + sr0.width / 2, sr0.top + sr0.height / 2, { size: 80, grow: 16 }); }); }
      end = Math.max(end, t + 800); t += SX.dieStep(dieCount, clashIds.size ? 300 : 70); if (clashIds.size) impact = null;
    } else if (e.type === 'enter') {
      const el = permEl(e.id); const r = el?.getBoundingClientRect(); const land = el && el.closest('.lands');
      if (r) { const [x, y] = pt(r), c = cardCol(e.id); later(t + 320, () => { FX.ring(x, y, { color: c, size: r.width * 0.9, grow: land ? 1.8 : 3, dur: land ? 450 : 650, width: land ? 2 : 4 }); if (!land) FX.glow(x, y, { color: c, size: r.width * 2.2, dur: 700 }); }); }
      t += 50;
    } else if (e.type === 'buff') {
      const r = permEl(e.id)?.getBoundingClientRect() || lastRects.get(e.id); if (r) { const [x, y] = pt(r); const el = permEl(e.id); later(t + 120, () => { FX.glow(x, y, { color: '#6dff8a', size: r.width * 2 }); FX.burst(x, y + r.height * 0.3, { color: '#7dff9a', n: 10, dist: 45, size: 5 }); }); if (el) el.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.8) hue-rotate(40deg) saturate(1.6)', offset: 0.3 }, { filter: 'none' }], { delay: t + 120, duration: 700 }); }
      t += 60;
    } else if (e.type === 'heal') {
      const el = $('life-' + e.pid), r = el.getBoundingClientRect(), [x, y] = pt(r); const hp = e.pid;
      if (displayLife[hp] == null) { displayLife[hp] = prevShownLife[hp] ?? g.players[hp].life; setLifeText(hp, displayLife[hp], true); }
      later(t, () => { if (displayLife[hp] == null) return; displayLife[hp] = g.players[hp].life + lossSum[hp] - lossApplied[hp]; setLifeText(hp, displayLife[hp]); });
      { const gain = g.players[hp].life - (prevShownLife[hp] ?? g.players[hp].life) + lossSum[hp]; later(t + 40, () => SX.lifeGain(hp, gain, drainOf(hp)));
        const drainOf = (h) => { const d = evs.find((x) => x.type === 'dmg' && x.target.kind === 'player' && x.target.id !== h && !isCombat(x)); return d ? d.target.id : null; }; void x; void y; }
      t += 60;
    } else if (e.type === 'regen' || e.type === 'prevent') {
      const r = e.type === 'regen' ? (permEl(e.id)?.getBoundingClientRect() || lastRects.get(e.id)) : rectOfRef(e.target);
      if (r) { const [x, y] = pt(r); later(t, () => { FX.ring(x, y, { color: '#ffe08a', size: r.width * 0.9, grow: 1.9, dur: 600, width: 4 }); FX.glow(x, y, { color: '#ffe08a', size: r.width * 2.2, dur: 650 }); }); }
      t += 80;
    } else if (e.type === 'bounce') {
      const r = lastRects.get(e.id); ghostDelay.set(e.id, t); if (r) { const [x, y] = pt(r); later(t, () => { FX.ring(x, y, { color: '#8fd0ff', size: r.width * 0.8, grow: 2.2, dur: 500 }); FX.motes(x, y, { color: '#8fd0ff', n: 12 }); }); }
      t += 60;
    } else if (e.type === 'control' || e.type === 'token' || e.type === 'attach') {
      const id = e.type === 'attach' ? e.host : e.id; const r = permEl(id)?.getBoundingClientRect() || lastRects.get(id); const c = e.type === 'control' ? '#c58bff' : e.type === 'attach' ? '#ffd27a' : cardCol(e.id);
      if (r) { const [x, y] = pt(r); later(t + 250, () => { FX.ring(x, y, { color: c, size: r.width * 0.9, grow: 2.4, dur: 650, width: 3 }); FX.glow(x, y, { color: c, size: r.width * 2.2, dur: 700 }); if (e.type === 'control') FX.burst(x, y, { color: c, n: 14, dist: 60, size: 5 }); }); }
      t += 60;
    } else if (e.type === 'flip') { later(t, () => AMB.toss(e.won)); t += 900;
    } else if (e.type === 'extraTurn') { setBanner(e.pid === ME ? 'Extra turn for you' : 'Opponent takes an extra turn', true); t += 600;
    } else if (e.type === 'shuffle') {
      const el = document.querySelector(e.pid === ME ? '#zones-me .pile' : '#zones-opp .pile'); const rf = el?.getBoundingClientRect(); later(t, () => ZN.riffle(rf)); el?.animate([{ translate: '0 0' }, { translate: '-5px 0' }, { translate: '5px 0' }, { translate: '-3px 0' }, { translate: '0 0' }], { duration: 380, delay: t }); end = Math.max(end, t + 380);
    } else if (e.type === 'tap') {   // auto-pay: show which sources were tapped
      const el = permEl(e.id); if (el?.closest('.lands, #field-me-lands, #field-opp-lands')) el.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2.2) drop-shadow(0 0 8px #ffd27a)', offset: 0.3 }, { filter: 'none' }], { duration: 650, delay: t });
    } else if (e.type === 'sweep') {
      const r = $('stage').getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
      later(t, () => { FX.flash('#fff', 900, 0.85); FX.shockwave(x, y, { size: 80, grow: 18 }); const st = $('stage'); st.animate([{ translate: '0 0' }, { translate: '-8px 4px' }, { translate: '7px -5px' }, { translate: '-4px 2px' }, { translate: '0 0' }], { duration: 450 }); });
      t += 450;
    }
  }
  later(end + 60, () => { if (gen !== fxGen) return; for (const i of [0, 1]) if (displayLife[i] != null) { displayLife[i] = null; setLifeText(i, g.players[i].life); } for (const id of [...displayDmg.keys()]) { displayDmg.delete(id); patchPerm(id); } });
  fxHold(end + 120);
}
const lunging = new Set();
const tOf = (el) => [+el.dataset.tx || 0, +el.dataset.ty || 0];
// Blockers walk up to the attacker they block (and slide back when combat ends: animateFrom handles the return).
function placeBlockers() {
  const blocks = g.combat?.blocks; if (!blocks) return;
  for (const [aid, bs] of Object.entries(blocks)) {
    const ae = permEl(aid); if (!ae || !bs.length) continue; const ar = ae.getBoundingClientRect(), [ax, ay] = pt(ar);
    bs.forEach((bid, i) => {
      const be = permEl(bid), bp = g.perm(bid); if (!be || !bp) return; const br = be.getBoundingClientRect(), [bx, by] = pt(br);
      const dir = bp.controller === ME ? 1 : -1;
      const x = ax + (i - (bs.length - 1) / 2) * br.width * 0.55, y = ay + dir * (ar.height / 2 + br.height / 2) * 0.82;
      const tx = x - bx, ty = y - by; be.style.translate = `${tx}px ${ty}px`; be.dataset.tx = tx; be.dataset.ty = ty; be.style.zIndex = 4;
    });
  }
}

// ---------- affordances ----------
function decorate() {
  const w = g.waiting; const mine = w?.player === ME;
  $('stage').classList.toggle('targeting', mode?.type === 'target'); TG.kick(); $('hint').classList.remove('danger');
  const mark = (sel, cls) => document.querySelectorAll(sel).forEach((el) => el.classList.add(cls));
  if (mode?.type === 'target') {
    for (const r of mode.valid) {
      if (r.kind === 'player') $('life-' + r.id).classList.add('targetable');
      else mark(`#board .card[data-id="${r.id}"]:not([data-kind=hand]):not([data-kind=pilecard])`, 'targetable');
    }
    if (mode.multi) for (const r of mode.picked) mark(`#board .card[data-id="${r.id}"]:not([data-kind=hand]):not([data-kind=pilecard])`, 'selected');
    hint(mode.hint); return;
  }
  if (mode?.type === 'attackers') { for (const id of mode.sel) mark(`#field-me .card[data-id="${id}"]`, 'selected'); for (const p of g.players[ME].bf.filter((p) => g.canAttack(p))) mark(`#field-me .card[data-id="${p.id}"]`, 'playable'); hint('Click the creatures that will attack'); return; }
  if (mode?.type === 'blockers') {
    for (const p of g.players[ME].bf.filter((p) => g.isCreature(p) && !p.tapped)) mark(`#field-me .card[data-id="${p.id}"]`, 'playable');
    if (mode.sel) mark(`#field-me .card[data-id="${mode.sel}"]`, 'selected');
    for (const [a, bs] of Object.entries(mode.map)) for (const b of bs) mark(`#field-me .card[data-id="${b}"]`, 'attacking');
    for (const id of g.combat.attackers) mark(`#field-opp .card[data-id="${id}"]`, mode.sel ? 'targetable' : 'attacking');
    drawLinks(); const inc = combatPreview(), life = g.players[ME].life;
    hint(inc ? `${mode.sel ? 'Pick the attacker to block' : 'Pick a blocker, then the attacker'} · ${inc} damage unblocked (you are at ${life})${inc >= life ? ' · LETHAL' : ''}` : (mode.sel ? 'Pick the attacker to block' : 'Pick a blocker, then the attacker'));
    $('hint').classList.toggle('danger', inc >= life); return;
  }
  hint(''); if ($('links')) $('links').innerHTML = '';
  if (!mine || w.kind !== 'priority') { if (mine && w.kind === 'discard') hint('Discard down to 7 cards'); return; }
  for (const c of g.players[ME].hand) if (g.canPlayLand(ME, c) || g.canCast(ME, c)) mark(`#hand .card[data-id="${c.id}"]`, 'playable');
  for (const a of g.activatable(ME)) if (a.perm.controller === ME) mark(`#field-me .card[data-id="${a.perm.id}"]`, 'ready');
  document.querySelectorAll('#field-me .card.ready').forEach((el) => el.style.setProperty('--rc', cardCol(el.dataset.id)));
}
// damage preview while assigning blockers (own computation; first strike / trample are not modelled)
function combatPreview() {
  document.querySelectorAll('.cpv').forEach((e) => e.remove()); let unblocked = 0;
  if (typeof g.combatPreview === 'function') {
    const badge = (el, txt, dead, cls = '') => el?.insertAdjacentHTML('beforeend', `<span class="cpv ${dead ? 'dead' : ''} ${cls}">${txt}</span>`);
    let pv = []; try { pv = g.combatPreview({ blocks: mode.map }); } catch { pv = []; }
    for (const e of pv) {
      if (!e.blocked && !e.blockers.length) { unblocked += e.toPlayer; badge(permEl(e.id), `-${e.toPlayer} you`, false, 'you'); continue; }
      unblocked += e.toPlayer || 0;
      badge(permEl(e.id), `${e.damageTaken ? '-' + e.damageTaken : '0'}${e.toPlayer ? ` · ${e.toPlayer} you` : ''}`, e.dies);
      for (const bid of e.blockers) { const n = e.hits.filter((h) => h.to.kind === 'perm' && h.to.id === bid).reduce((x, h) => x + h.n, 0); badge(permEl(bid), n ? '-' + n : '0', e.blockersDie.includes(bid)); }
    }
    return unblocked;
  }
  const badge = (el, txt, dead, cls = '') => el?.insertAdjacentHTML('beforeend', `<span class="cpv ${dead ? 'dead' : ''} ${cls}">${txt}</span>`);
  for (const aid of g.combat.attackers) {
    const a = g.perm(aid); if (!a) continue; const ap = Math.max(0, g.power(a)); const bs = (mode.map[aid] || []).map((b) => g.perm(b)).filter(Boolean);
    if (!bs.length) { unblocked += ap; badge(permEl(aid), `-${ap} you`, false, 'you'); continue; }
    const toA = bs.reduce((x, b) => x + Math.max(0, g.power(b)), 0); badge(permEl(aid), `-${toA}`, toA >= g.toughness(a) - a.damage);
    bs.forEach((b) => { const d = Math.ceil(ap / bs.length); badge(permEl(b.id), `-${d}`, d >= g.toughness(b) - b.damage); });
  }
  return unblocked;
}
function drawLinks() {
  let svg = $('links'); if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.id = 'links'; $('stage').appendChild(svg); }
  const sr = $('stage').getBoundingClientRect(); let h = '';
  for (const [a, bs] of Object.entries(mode.map)) for (const b of bs) {
    const ea = permEl(a), eb = permEl(b); if (!ea || !eb) continue; const [x1, y1] = pt(eb.getBoundingClientRect()), [x2, y2] = pt(ea.getBoundingClientRect());
    h += `<line x1="${x1 - sr.left}" y1="${y1 - sr.top}" x2="${x2 - sr.left}" y2="${y2 - sr.top}"/><circle cx="${x2 - sr.left}" cy="${y2 - sr.top}" r="7"/>`;
  }
  svg.innerHTML = h;
}
function hint(t) { const h = $('hint'); h.textContent = t || ''; h.classList.toggle('on', !!t); }
function buttons() {
  const b = $('act-btn'), alt = $('act-alt'), undo = $('act-undo'); alt.hidden = true; undo.hidden = true; b.classList.remove('wait'); b.onclick = null; b.hidden = false;
  b.classList.remove('glow'); const w = g.waiting; if (!w) { b.hidden = true; return; }
  if (w.player !== ME) { b.textContent = 'Opponent…'; b.classList.add('wait'); return; }
  if (mode?.type === 'target') {
    if (mode.multi) { const ok = mode.picked.length >= mode.multi.min; b.textContent = `Confirm targets (${mode.picked.length})`; b.classList.toggle('wait', !ok); b.onclick = () => { if (!ok) return; const done = mode.done, ps = mode.picked; mode = null; done(ps); refresh(); }; alt.hidden = false; alt.textContent = 'Cancel'; alt.onclick = cancelMode; return; }
    b.textContent = 'Cancel'; b.onclick = cancelMode; return;
  }
  if (w.kind === 'mulligan' || w.kind === 'bottom') { b.textContent = 'Opening hand…'; b.classList.add('wait'); queueMicrotask(openOpening); return; }
  if (w.kind === 'choice') { b.textContent = 'Choose…'; b.classList.add('wait'); queueMicrotask(openChoice); return; }
  if (w.kind === 'attackers') { if (mode?.type !== 'attackers') mode = { type: 'attackers', sel: new Set() }; b.textContent = mode.sel.size ? `Confirm attackers (${mode.sel.size})` : 'No attack'; b.onclick = () => { const ids = [...mode.sel]; mode = null; g.declareAttackers(ME, ids); refresh(); };
    const can = g.players[ME].bf.filter((p) => g.canAttack(p)).map((p) => p.id);
    if (can.length && mode.sel.size < can.length) { alt.hidden = false; alt.textContent = 'All attack'; alt.onclick = () => { can.forEach((i) => mode.sel.add(i)); snd('click'); render(); }; }
    else if (can.length) { alt.hidden = false; alt.textContent = 'Clear'; alt.onclick = () => { mode.sel.clear(); render(); }; }
    return; }
  if (w.kind === 'blockers') { if (mode?.type !== 'blockers') mode = { type: 'blockers', sel: null, map: {} }; b.textContent = 'Confirm blockers'; b.onclick = () => { const m = mode.map; mode = null; g.declareBlockers(ME, m); refresh(); }; return; }
  if (w.kind === 'discard') { b.textContent = `Discard ${w.n}`; b.classList.add('wait'); return; }
  const top = g.stack[g.stack.length - 1];
  if (w.kind === 'priority') b.classList.add('glow');
  b.textContent = top ? (top.controller === ME ? 'RESOLVE' : 'PASS') : g.step === 'main1' ? 'To combat' : g.step === 'main2' ? 'End turn' : 'Pass';
  b.onclick = () => { g.pass(ME); refresh(); };
  if (typeof g.canUndoLand === 'function' && g.canUndoLand(ME)) { undo.hidden = false; undo.onclick = () => { if (g.undoLandDrop(ME)) { snd('click'); refresh(); } }; }
  if (!top && g.active === ME && g.step === 'main1') { alt.hidden = false; alt.textContent = 'Pular combate'; alt.onclick = () => { g.pass(ME); refresh(); }; alt.hidden = true; }
}

// ---------- input ----------
function cancelMode() { const c = mode?.cancel; mode = null; c?.(); refresh(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mode?.type === 'target') cancelMode(); if (e.key === ' ' && g && !$('board').hidden && !document.querySelector('.dlg')) { e.preventDefault(); $('act-btn').click(); } });
document.addEventListener('contextmenu', (e) => { if (mode?.type === 'target') { e.preventDefault(); cancelMode(); } });

// Promise-based target picking on the board. Resolves a ref (or an array when multi), null when cancelled.
function targetAsync(spec, hintText, sourceId, srcCard, multi) {
  const valid = g.validTargets(spec, ME, sourceId ?? null, srcCard);
  return new Promise((resolve) => {
    if (valid.length && valid.every((r) => r.kind === 'card')) {   // graveyard cards: pick in a dialog
      const opts = valid.map((r) => { const c = findCard(r.id); return { value: r.id, label: c?.def.name || '?', card: c?.def }; });
      askPick(hintText, opts, { min: multi ? multi.min : 1, max: multi ? multi.max : 1, cancelable: true }).then((v) => resolve(v ? (multi ? v.map((id) => ({ kind: 'card', id })) : { kind: 'card', id: v[0] }) : null));
      return;
    }
    if (!valid.length) { resolve(null); return; }
    mode = { type: 'target', valid, hint: hintText, multi, picked: [], done: resolve, cancel: () => resolve(null), src: srcCard?.id ?? sourceId };
    render();
  });
}
const elOfRef = (ref) => ref.kind === 'player' ? $('life-' + ref.id) : ref.kind === 'perm' ? permEl(ref.id) : ref.kind === 'spell' ? document.querySelector(`#stack .card[data-sid="${ref.id}"]`) : null;
function pickTarget(ref) {
  if (!mode?.valid.some((r) => r.kind === ref.kind && r.id === ref.id)) { TG.deny(ref, elOfRef(ref)); snd('error'); return; }
  if (mode.multi) {
    const i = mode.picked.findIndex((r) => r.kind === ref.kind && r.id === ref.id);
    if (i >= 0) mode.picked.splice(i, 1); else if (mode.picked.length < mode.multi.max) mode.picked.push(ref);
    return render();
  }
  const done = mode.done; mode = null; done(ref); refresh();
}
const infoOf = (c, mode) => { try { return g.castInfo(c, mode); } catch { return null; } };
const optsOf = (list) => list.map((q) => { const cd = q.card || q; return { value: q.id, label: cd.def.name, card: cd.def }; });
// Ask for the sacrifice / tap / discard choices of a cost (skips the dialog when there is nothing to choose). null = cancelled.
async function costFlow(nm, cost, perm) {
  const choices = {}; if (!cost || !(cost.sacOther || cost.tapOther || cost.discard)) return choices;
  const cc = g.costChoices(ME, perm, { cost });
  if (cost.sacOther && cc.sac?.length > 1) { const r = await askPick(`${nm}: sacrifice a permanent`, optsOf(cc.sac), { cancelable: true }); if (!r) return null; choices.sac = r[0]; }
  if (cost.tapOther && cc.tapOther) { const n = cost.tapN || 1; if (cc.tapOther.length > n) { const r = await askPick(`${nm}: tap ${n} untapped permanent${n > 1 ? 's' : ''}`, optsOf(cc.tapOther), { min: n, max: n, cancelable: true }); if (!r) return null; choices.tapOther = r; } }
  if (cost.discard && cc.discard) { const n = cost.discard; if (cc.discard.length > n) { const r = await askPick(`${nm}: discard ${n} card${n > 1 ? 's' : ''}`, optsOf(cc.discard), { min: n, max: n, cancelable: true }); if (!r) return null; choices.discard = r; } }
  return choices;
}
const multiRange = (m) => ({ min: m.min ?? 1, max: m.max == null || m.max === Infinity ? 99 : m.max });
// Full cast flow: mode, X, targets (fixed or variable count), extra costs. `pre` = targets already chosen by a drop.
async function castFlow(c, pre = [], fromRect) {
  const eff = g.effectOf(c); let info = infoOf(c), x = 0; const extra = {}; let targets = [];
  if (info.modes?.length) {
    const r = await askPick(`${c.def.name}: choose one`, info.modes.map((m, i) => ({ value: i, label: m.text })), { cancelable: true });
    if (!r) { refresh(); return false; } extra.mode = r[0]; info = infoOf(c, r[0]); pre = [];
  }
  if (info.multi) {
    const ts = await targetAsync(info.multi.spec, `Choose targets for ${c.def.name}${info.multi.extraCost ? ` (each target beyond the first costs ${info.multi.extraCost})` : ''}`, null, c, multiRange(info.multi));
    if (!ts?.length) { refresh(); return false; } targets = ts;
  } else for (let i = 0; i < info.targets.length; i++) {
    if (pre[i]) { targets.push(pre[i]); continue; }
    const t = await targetAsync(info.targets[i], `Choose a target for ${c.def.name}`, null, c); if (!t) { refresh(); return false; } targets.push(t);
  }
  if (info.hasX) {   // asked after the targets: extra targets raise the cost
    let mx = 0; for (let k = 0; k < 40; k++) { if (g.canPay(ME, g.spellCost(ME, c, k, Math.max(1, targets.length), extra.mode))) mx = k; else break; }
    x = await askNumber(`${c.def.name}: choose X (0 to ${mx})`, 0, mx, { value: mx });
    if (x === null) { refresh(); return false; }
  }
  const ch = await costFlow(c.def.name, eff?.cost, null); if (!ch) { refresh(); return false; } if (Object.keys(ch).length) extra.choices = ch;
  const ok = g.cast(ME, c, targets, x, extra);
  if (ok === false) setBanner("Can't cast that"); else if (fromRect) dragFrom.set(c.id, fromRect);
  refresh(); return ok !== false;
}
async function abilityFlow(p, a, pre = []) {
  const info = g.abilityInfo(p, a.idx), nm = p.card.def.name, choices = {}; let targets = [];
  if (info.hasX) {
    let mx = 0; for (let x = 0; x < 40; x++) { if (g.canPay(ME, g.abCost(ME, p, a.ab, x))) mx = x; else break; }
    const x = await askNumber(`${nm}: choose X (0 to ${mx})`, 0, mx, { value: mx }); if (x === null) { refresh(); return; } choices.x = x;
  }
  const ch = await costFlow(nm, a.ab.cost, p); if (!ch) { refresh(); return; } Object.assign(choices, ch);
  if (info.multi) { const ts = await targetAsync(info.multi.spec, `Choose targets for ${nm}`, p.id, p.card, multiRange(info.multi)); if (!ts?.length) { refresh(); return; } targets = ts; }
  else for (let i = 0; i < info.targets.length; i++) {
    if (pre[i]) { targets.push(pre[i]); continue; }
    const t = await targetAsync(info.targets[i], `Choose a target for ${nm}`, p.id, p.card); if (!t) { refresh(); return; } targets.push(t);
  }
  g.activate(ME, p.id, a.idx, targets, choices); refresh();
}

// ---------- engine "choice" waits (yes/no, pick, number) ----------
let choiceOpen = false;
const refCard = (ref) => (ref?.kind === 'perm' ? g.perm(ref)?.card : ref?.kind === 'card' ? findCard(ref.id) : null);
async function openChoice() {
  const w = g?.waiting; if (!w || w.kind !== 'choice' || w.player !== ME || choiceOpen || window.__auto) return;
  choiceOpen = true;
  try {
    const title = (w.source ? `<small>${esc(typeof w.source === 'string' ? w.source : g.perm(w.source)?.card.def.name || '')}</small><br>` : '') + esc(w.prompt || 'Choose');
    let ans;
    if (w.type === 'yesno') ans = await askConfirm(esc(w.prompt || 'Do it?'), 'Yes', 'No');
    else if (w.type === 'number') ans = await askNumber(title, w.min ?? 0, w.max ?? 20, { value: w.min ?? 0, cancelable: false });
    else if (w.type === 'pick') {
      const opts = (w.options || []).map((o) => ({ value: o.value, label: o.label ?? String(o.value), card: o.card || refCard(o.ref)?.def }));
      const mn = w.optional ? 0 : (w.min ?? 1), mx = w.max ?? 1;
      ans = await askPick(title, opts, { min: mn, max: Math.min(mx, opts.length || mx) });
    }
    if (!g || g.waiting !== w) return;
    if (g.choose(ME, ans) === false) g.choose(ME, g.autoAnswer());
  } finally { choiceOpen = false; refresh(); }
}
function onCard(el) {
  const id = +el.dataset.id, kind = el.dataset.kind;
  if (mode?.type === 'target') { if (kind === 'stackcard') return pickTarget({ kind: 'spell', id: +el.dataset.sid }); if (kind === 'perm') return pickTarget({ kind: 'perm', id }); return; }
  if (!g.waiting || g.waiting.player !== ME) return;
  const w = g.waiting;
  if (w.kind === 'discard' && kind === 'hand') { g.discard(ME, g.players[ME].hand.find((c) => c.id === id)); return refresh(); }
  if (mode?.type === 'attackers' && kind === 'perm') { const p = g.perm(id); if (p && p.controller === ME && g.canAttack(p)) { mode.sel.has(id) ? mode.sel.delete(id) : mode.sel.add(id); render(); } return; }
  if (mode?.type === 'blockers' && kind === 'perm') {
    const p = g.perm(id); if (!p) return;
    if (p.controller === ME) { if (g.isCreature(p) && !p.tapped) { for (const k of Object.keys(mode.map)) mode.map[k] = mode.map[k].filter((x) => x !== id); mode.sel = mode.sel === id ? null : id; } }
    else if (mode.sel && g.combat.attackers.includes(id)) { if (g.canBlock(g.perm(mode.sel), p)) { (mode.map[id] ||= []).push(mode.sel); mode.sel = null; } }
    return render();
  }
  if (w.kind !== 'priority') return;
  if (kind === 'hand') {
    const c = g.players[ME].hand.find((x) => x.id === id);
    // phone: the first tap lifts the card and peeks at it big; a second tap (or a drag) plays it
    if (isPhone() && Date.now() - lastTouch < 1200 && peekId !== id) { peekId = id; render(); showPreviewFor(document.querySelector(`#hand .card[data-id="${id}"]`), c); return; }
    peekId = null; $('preview').classList.remove('on');
    if (g.canPlayLand(ME, c)) { g.playLand(ME, c); return refresh(); }
    if (!g.canCast(ME, c)) return;
    return void castFlow(c);
  }
  if (kind === 'perm') {
    const p = g.perm(id); if (!p || p.controller !== ME) return;
    const a = g.activatable(ME).find((x) => x.perm.id === id); if (!a) return;
    return void abilityFlow(p, a);
  }
}
document.addEventListener('click', (e) => {
  if (!g || $('board').hidden) return;
  const life = e.target.closest('.life'); if (life && mode?.type === 'target') return pickTarget({ kind: 'player', id: +life.id.split('-')[1] });
  const el = e.target.closest('.card[data-kind]'); if (el) return onCard(el);
  if (peekId != null) { peekId = null; $('preview').classList.remove('on'); render(); }
  if (mode?.type === 'target' && !e.target.closest('#action')) cancelMode();
});

// ---------- card inspection (hover zoom, right-click full view, graveyard viewer) ----------
function findCard(id) {
  for (const pl of g.players) { const c = [...pl.hand, ...pl.gy, ...pl.ex, ...pl.bf.map((p) => p.card), ...g.stack.map((s) => s.card)].find((x) => x.id === id); if (c) return c; }
  return null;
}
const esc = (t) => String(t ?? '').replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
const SETNAME = { LEA: 'Limited Edition Alpha', LEB: 'Limited Edition Beta', ARN: 'Arabian Nights', ATQ: 'Antiquities', '2ED': 'Unlimited' };
function infoHtml(c, full) {
  const d = c.def; const perm = g.perm(c.id);
  const pt = d.power !== undefined ? `<span class="ptbig">${perm ? g.power(perm) + '/' + (g.toughness(perm) - perm.damage) : d.power + '/' + d.toughness}</span>` : '';
  const rul = full && d.rulings?.length ? `<div class="rul"><b>Rulings</b>${d.rulings.slice(0, 6).map((r) => `<p>${esc(r.text)}</p>`).join('')}</div>` : '';
  return `<div class="ihead"><b>${esc(d.name)}</b><span>${esc(d.manaCost || '')}</span></div><div class="itype">${esc(d.type)} ${pt}</div><div class="itext">${esc(d.text || '—')}</div><div class="imeta">${SETNAME[d.set] || d.set} · ${esc(d.rarity)} · ${esc(d.artist || '')}</div>${rul}`;
}
let pinned = false;
function showPreviewFor(el, c) {
  const pv = $('preview'); if (!el || !c) { pv.classList.remove('on'); return; }
  pv.innerHTML = `<img src="${c.def.art}"><div class="txt">${infoHtml(c, false)}</div>`;
  const r = el.getBoundingClientRect(); const W = innerWidth, H = innerHeight, phone = isPhone();
  const st = $('board').hidden ? { left: 0, right: W, width: W } : $('stage').getBoundingClientRect();
  const pw = phone ? Math.min(st.height * 0.62 * 0.718, W * 0.26) : Math.min(H * 0.5 * 0.718, W * 0.28) * 0.6;
  pv.style.width = pw + 'px'; pv.classList.add('on');
  if (phone) {   // quick peek: big, left of the centre, above the hand
    pv.style.left = Math.max(8, st.left + st.width * 0.27) + 'px'; pv.style.top = Math.max(8, (st.height - pw * 1.393) / 2 - 6) + 'px'; return;
  }
  // dock to the side of the stage opposite the hovered card, never over the centre
  const onLeft = r.left + r.width / 2 < (st.left + st.right) / 2;
  pv.style.left = (onLeft ? Math.min(st.right - pw - 8, W - pw - 8) : Math.max(st.left + 8, 8)) + 'px';
  const ph = pw * 1.393 + pv.querySelector('.txt').getBoundingClientRect().height + 8;
  pv.style.top = Math.max(10, Math.min(r.top + r.height / 2 - ph / 2, H - ph - 10)) + 'px';
}
document.addEventListener('mouseover', (e) => {
  if (pinned || Date.now() - lastTouch < 900) return;
  const el = e.target.closest?.('.card[data-id]');
  const c = el && g ? findCard(+el.dataset.id) : null;
  if (!c || (g.players[1].hand.includes(c))) { $('preview').classList.remove('on'); return; }
  showPreviewFor(el, c);
});
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest?.('.card[data-id]')) $('preview').classList.remove('on'); });

function openInspect(html) { const m = $('inspect'); m.innerHTML = html; m.hidden = false; pinned = true; $('preview').classList.remove('on'); }
function closeInspect() { $('inspect').hidden = true; pinned = false; }
function inspectEl(el) {
  const c = findCard(+el.dataset.id); if (!c || g.players[1].hand.includes(c)) return false;
  openInspect(`<div class="big"><img src="${c.def.art}"><div class="info">${infoHtml(c, true)}</div></div>`); return true;
}
document.addEventListener('contextmenu', (e) => {
  if (!g || $('board').hidden || mode?.type === 'target') return;
  const el = e.target.closest('.card[data-id]'); if (!el) return;
  if (inspectEl(el)) e.preventDefault();
});
// Touch: long-press (~450 ms, no movement) = right-click inspect. No hover on phones.
let lastTouch = 0, lp = null, swallow = 0;
document.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return; lastTouch = Date.now(); $('preview').classList.remove('on');
  const el = g && !$('board').hidden ? e.target.closest('.card[data-id]') : null; if (!el) return;
  clearTimeout(lp?.t); lp = { x: e.clientX, y: e.clientY, t: setTimeout(() => { if (inspectEl(el)) { drag = null; swallow = Date.now() + 700; } lp = null; }, 450) };
}, true);
document.addEventListener('pointermove', (e) => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) { clearTimeout(lp.t); lp = null; } }, true);
for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => { if (lp) { clearTimeout(lp.t); lp = null; } if (peekId == null) $('preview').classList.remove('on'); }, true);
document.addEventListener('click', (e) => { if (Date.now() < swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener('touchstart', () => { lastTouch = Date.now(); }, { passive: true, capture: true });
document.addEventListener('click', (e) => {
  if (!$('inspect').hidden) { closeInspect(); e.stopPropagation(); return; }
  const pl = e.target.closest('.pile[data-pl]');
  if (pl && g) {
    const list = g.players[+pl.dataset.pl][pl.dataset.z];
    openInspect(`<div class="grid"><h3>${g.players[+pl.dataset.pl].name} · Graveyard (${list.length})</h3><div class="cards">${list.map((c) => `<img src="${c.def.art}" title="${esc(c.def.name)}">`).reverse().join('') || '<p>Empty</p>'}</div></div>`);
    e.stopPropagation();
  }
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInspect(); });

let resultPending = false;
function gameOver() {
  const o = $('over'); if (!o.hidden || resultPending) return; const win = g.winner.id === ME;
  if (window.__fxOff || window.__quick || window.__fast) return showResult();
  resultPending = true; const lf = $(win ? 'life-1' : 'life-0'), r = lf.getBoundingClientRect();
  AMB.endSequence(win, lf);
  setTimeout(() => { resultPending = false; lf.style.visibility = ''; $('board').classList.remove('wiped'); if (g) showResult(); }, (win ? 800 : 1700) * ST.animScale());
}
function showResult() {
  const o = $('over'); if (!o.hidden) return; const win = g.winner.id === ME; const st = window.__stats || { dmg: [0, 0], cast: 0, died: 0 };
  o.className = win ? 'win' : 'lose'; o.hidden = false; clearSave(); closeLog();
  const why = g.winner.reason === 'deck' ? (win ? 'Opponent ran out of cards' : 'You ran out of cards') : (win ? 'Opponent life reached 0' : 'Your life reached 0');
  o.innerHTML = `<div class="rays"></div><img class="emblem" src="assets/ui/${win ? 'emblem_victory' : 'emblem_defeat'}.jpg" alt=""><h1>${win ? 'VICTORY' : 'DEFEAT'}</h1><div class="sub">${why}</div>
    <div class="stats"><div><b>${g.turn}</b><span>Turns</span></div><div><b>${g.players[ME].life}</b><span>Your life</span></div><div><b>${st.dmg[1]}</b><span>Damage dealt</span></div><div><b>${st.dmg[0]}</b><span>Damage taken</span></div><div><b>${st.cast}</b><span>Spells cast</span></div><div><b>${st.died}</b><span>Creatures lost</span></div></div>
    <div class="obtns"><button id="rematch">Rematch</button><button id="again" class="alt">Menu</button><button id="editdeck" class="alt">Edit deck</button></div>`;
  $('again').onclick = leave;
  $('rematch').onclick = () => { const r = lastRun; leave(); if (r) playFlow(r.counts, { foe: r.foe, level: r.level }); };
  $('editdeck').onclick = () => { leave(); showApp('decks'); };
  snd(win ? 'victory' : 'defeat');
  if (win) { FX.confetti(90); FX.flash('#ffe6a8', 900, 0.6); } else FX.flash('#300', 900, 0.5);
}
boot();

// =====================================================================
// Animation layer: FLIP between zones, ghosts for cards that leave, hit flashes, life pops
// =====================================================================
const ZONES = '#hand,#field-me,#field-me-lands,#field-opp,#field-opp-lands,#field-me-misc,#field-opp-misc,#stack';
const SEL = '#stage .card[data-id]:not([data-kind=pilecard])';
const dragFrom = new Map();
let lastLife = [null, null];

function snapshot() {
  const m = new Map();
  if ($('board').hidden) return m;
  document.querySelectorAll(SEL).forEach((el) => {
    m.set(+el.dataset.id, { r: el.getBoundingClientRect(), w: el.offsetWidth, html: el.outerHTML, zone: el.closest(ZONES)?.id, tf: getComputedStyle(el).transform });
  });
  return m;
}
function render() {
  const prev = snapshot();
  renderRaw();
  if (!$('board').hidden && g) {
    document.querySelectorAll('#stage .card[data-id]:not([data-kind=pilecard])').forEach((el) => lastRects.set(+el.dataset.id, el.getBoundingClientRect()));
    if (noAnimOnce) { noAnimOnce = false; g.events.length = 0; SX.afterRender(true); } else { animateFrom(prev); lifePop(); SX.afterRender(); }
  }
  saveGame(); renderLog();
}
const centerOf = (r) => [r.left + r.width / 2, r.top + r.height / 2];
function pileRect(pl, z) { const el = document.querySelector(`#stage .pile[data-pl="${pl}"][data-z="${z}"]`) || document.querySelector(pl === 0 ? '#zones-me .pile' : '#zones-opp .pile'); return el?.getBoundingClientRect(); }
function libRect(pl) { const el = document.querySelector(pl === 0 ? '#zones-me .pile' : '#zones-opp .pile'); return el?.getBoundingClientRect(); }
function flip(el, src, srcW, delay = 0) {
  const r = el.getBoundingClientRect(); const [sx, sy] = centerOf(src), [nx, ny] = centerOf(r);
  const base = getComputedStyle(el).transform; const b = base === 'none' ? '' : base;
  const sc = Math.max(0.2, (srcW || src.width) / el.offsetWidth);
  const origin = el.style.transformOrigin; el.style.transformOrigin = '50% 50%'; el.style.zIndex = 60;
  const a = el.animate([{ transform: `translate(${sx - nx}px,${sy - ny}px) scale(${sc}) ${b}`, opacity: 0.7 }, { transform: b || 'none', opacity: 1 }], { duration: 430, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  a.onfinish = a.oncancel = () => { el.style.transformOrigin = origin; el.style.zIndex = ''; };
}
let prevGyIds = new Set();
function animateFrom(prev) {
  const now = new Set(); let n = 0;
  const newHand = [...document.querySelectorAll('#hand .card')].filter((el) => !prev.has(+el.dataset.id)).length; const drawStep = newHand >= 3 ? 40 : 90;
  const gyNow = new Set(g.players.flatMap((pl) => pl.gy.map((c) => c.id)));
  document.querySelectorAll(SEL).forEach((el) => {
    const id = +el.dataset.id; now.add(id);
    const zone = el.closest(ZONES)?.id; const p = prev.get(id);
    const df = dragFrom.get(id);
    if (df) { dragFrom.delete(id); flip(el, df, df.width); return; }
    if (!p) {
      if (zone === 'hand' && prevGyIds.has(id)) flip(el, pileRect(0, 'gy') || el.getBoundingClientRect(), null);
      else if (zone === 'hand') { const d = ZN.drawFly(el, libRect(0), n, newHand); flip(el, libRect(0) || el.getBoundingClientRect(), null, d); n++; }
      else if (prevGyIds.has(id) && (zone === 'field-me' || zone === 'field-me-lands' || zone === 'field-opp' || zone === 'field-opp-lands')) { const owner = g.perm(id)?.card.owner ?? 0; const gr = pileRect(owner, 'gy'); if (gr) { flip(el, gr, null); ZN.pilePulse(document.querySelector(`#stage .pile[data-pl="${owner}"][data-z="gy"]`), '#b0ffb8'); } }
      else if (zone === 'field-opp' || zone === 'field-opp-lands' || zone === 'stack') { const o = document.querySelector('#opp-hand'); if (o) flip(el, o.getBoundingClientRect(), null); }
      return;
    }
    if (p.zone !== zone) { flip(el, p.r, p.w); return; }
    if (zone !== 'hand' && !lunging.has(id)) {
      const nr = el.getBoundingClientRect(), [pcx, pcy] = centerOf(p.r), [ncx, ncy] = centerOf(nr), T = tOf(el);
      if (Math.abs(pcx - ncx) > 3 || Math.abs(pcy - ncy) > 3) el.animate([{ translate: `${T[0] + pcx - ncx}px ${T[1] + pcy - ncy}px` }, { translate: `${T[0]}px ${T[1]}px` }], { duration: 420, easing: 'cubic-bezier(.25,.8,.25,1)' });
      else { const tf = getComputedStyle(el).transform; if (tf !== p.tf) el.animate([{ transform: p.tf }, { transform: tf }], { duration: 260, delay: ZN.untapDelay.get(id) || 0, easing: 'ease-out', fill: 'backwards' }); }
    }
  });
  for (const [id, p] of prev) if (!now.has(id)) ghost(id, p);
  prevGyIds = gyNow;
  // opponent draw: a new card back slides out of their library
  const cbs = document.querySelectorAll('#opp-hand .cb');
  if (render.lastOpp !== undefined && cbs.length > render.lastOpp && libRect(1)) flip(cbs[cbs.length - 1], libRect(1), null);
  render.lastOpp = cbs.length;
}
function ghost(id, p) {
  const c = findCard(id); let dest = null, exiled = false;
  if (c) for (const pl of g.players) { if (pl.gy.includes(c)) dest = pileRect(pl.id, 'gy'); if (pl.ex.includes(c)) exiled = true; if (pl.hand.includes(c) && p.zone !== 'hand') dest = (pl.id === ME ? $('hand') : $('opp-hand')).getBoundingClientRect(); if (pl.library.includes(c)) dest = libRect(pl.id); }
  const gmode = ghostMode.get(id);
  const dly = ghostDelay.get(id) || 0, cl = pendingClash.get(id);
  const wrap = document.createElement('div'); wrap.innerHTML = p.html; const el = wrap.firstElementChild;
  Object.assign(el.style, { position: 'fixed', left: p.r.left + 'px', top: p.r.top + 'px', width: p.r.width + 'px', height: p.r.height + 'px', margin: 0, zIndex: 150, pointerEvents: 'none', transform: 'none' });
  el.className = 'card ghost'; document.body.appendChild(el);
  const [sx, sy] = centerOf(p.r); const burn = 'brightness(1.8) sepia(1) saturate(6) hue-rotate(-30deg)';
  let kf, dur;
  if (exiled) { kf = [{ opacity: 1, transform: 'none', filter: 'none' }, { opacity: 0.95, filter: 'brightness(2.4) saturate(0)', offset: 0.35 }, { opacity: 0, transform: 'translateY(-34px) scale(1.1)', filter: 'brightness(4) saturate(0) blur(5px)' }]; dur = 900; setTimeout(() => FX.motes(sx, sy, { n: 22, spread: p.r.width * 0.4 }), (dly + 150) * ST.animScale()); setTimeout(() => FX.glow(sx, sy, { color: '#cfe8ff', size: p.r.width * 2.2, dur: 800 }), dly * ST.animScale()); }
  else if (dest && gmode === 'sac' && !window.__fxOff) { el.remove(); const dly2 = (dly) * ST.animScale(); setTimeout(() => SX.implode(p.r, p.html, dest), dly2); dur = 650; kf = null; }
  else if (dest && gmode === 'shatter' && !window.__fxOff) { el.remove(); setTimeout(() => SX.shatter(p.r, p.html, SX.batchSize()), dly * ST.animScale()); dur = 800; kf = null; }
  else if (dest && ghostDelay.has(id) && p.zone !== 'stack' && !c?.def.types.includes('Instant') && !c?.def.types.includes('Sorcery')) {   // permanent died: burn and dissolve in place
    el.classList.add('dissolve'); dur = 900; kf = null;
    el.animate([{ '--m': '-32%' }, { '--m': '100%' }], { duration: dur, delay: dly, easing: 'ease-in', fill: 'both' }).onfinish = () => el.remove();
    el.animate([{ filter: 'none' }, { filter: burn, offset: 0.25 }, { filter: 'brightness(.5) sepia(1) saturate(4) hue-rotate(-30deg) blur(1px)' }], { duration: dur, delay: dly, fill: 'both' });
    for (let i = 0; i < 4; i++) setTimeout(() => FX.burst(sx + (Math.random() - 0.5) * p.r.width * 0.6, sy + p.r.height * (0.4 - i * 0.25), { color: '#ff9a3d', n: 7, dist: 45, size: 4, dur: 700 }), (dly + 120 + i * 170) * ST.animScale());
  }
  else if (dest) { const [dx, dy] = centerOf(dest); kf = [{ transform: 'none', opacity: 1, filter: 'brightness(1)' }, { transform: `translate(${(dx - sx) * 0.15}px,${(dy - sy) * 0.15}px) scale(1.05)`, opacity: 1, filter: ghostDelay.has(id) && p.zone !== 'stack' ? burn : 'brightness(2.2) saturate(0)', offset: 0.25 }, { transform: `translate(${dx - sx}px,${dy - sy}px) scale(.4)`, opacity: 0.2, filter: 'brightness(.6)' }]; dur = 650; }
  else { kf = [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.25)', filter: 'brightness(3)' }]; dur = 450; }
  if (cl) el.animate([{ translate: '0 0' }, { translate: `${cl.dx}px ${cl.dy}px`, offset: 0.4, easing: 'ease-in' }, { translate: `${cl.dx * 0.9}px ${cl.dy * 0.9}px`, offset: 0.48 }, { translate: '0 0' }], { delay: cl.at, duration: 480, fill: 'backwards' });
  if (kf) { const a = el.animate(kf, { duration: dur, delay: dly, easing: 'ease-in', fill: 'backwards' }); a.onfinish = () => el.remove(); }
  fxHold(dly + dur);
}
// direct hit on a player: stiff, snappy shake of the whole board + red vignette, scaled by damage
function faceSlam(n, at, lifeEl) {
  const k = Math.min(1, 0.35 + n / 8), amp = 5 + 16 * k, sc = ST.animScale(), b = $('board');
  const steps = [0, -1, 0.9, -0.8, 0.55, -0.3, 0].map((m, i) => ({ translate: `${m * amp}px ${(i % 2 ? -1 : 1) * m * amp * 0.45}px`, offset: i / 6, easing: 'steps(1,end)' }));
  setTimeout(() => {
    b.animate(steps, { duration: 260 + 140 * k, easing: 'linear' });
    const v = document.createElement('div'); v.className = 'slam'; v.style.setProperty('--k', k); b.appendChild(v); setTimeout(() => v.remove(), 700);
    lifeEl?.animate([{ transform: 'scale(1.5)', filter: 'brightness(3)' }, { transform: 'scale(.92)', offset: 0.25 }, { transform: 'none', filter: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,1.6,.4,1)' });
    ST.haptic(n >= 4 ? 60 : 30);
  }, at * sc);
}
function hitFx(el, delay = 0) {
  const o = { delay, fill: 'backwards' };
  el.animate([{ filter: 'brightness(2.6) sepia(1) saturate(7) hue-rotate(-25deg)' }, { filter: 'none' }], { duration: 420, ...o });
  el.animate([{ rotate: '0deg' }, { rotate: '4deg' }, { rotate: '-4deg' }, { rotate: '2deg' }, { rotate: '0deg' }], { duration: 320, ...o });
}
function lifePop() { return;

  for (const i of [0, 1]) {
    const v = g.players[i].life, o = lastLife[i]; lastLife[i] = v;
    if (o === null || o === v) continue;
    const num = $('life-' + i).querySelector('.num');
    num.animate([{ transform: 'scale(1.7)', color: v < o ? '#ff6a55' : '#7dff9a' }, { transform: 'scale(1)', color: '#fff' }], { duration: 600, easing: 'ease-out' });
  }
}

// =====================================================================
// Drag and drop: hand -> table (play / cast / drop on a target), creatures -> attack / block, abilities -> target
// =====================================================================
let drag = null, justDragged = false;
const stageRect = () => $('stage').getBoundingClientRect();
const cardPx = () => { const r = stageRect(); return document.documentElement.classList.contains('phone') ? 0.2 * r.height : Math.min(0.126 * r.height, 0.084 * r.width); };
function refOf(el) {
  if (!el) return null;
  const life = el.closest('.life'); if (life) return { kind: 'player', id: +life.id.split('-')[1] };
  const c = el.closest('.card[data-kind]'); if (!c) return null;
  if (c.dataset.kind === 'perm') return { kind: 'perm', id: +c.dataset.id };
  if (c.dataset.kind === 'stackcard') return { kind: 'spell', id: +c.dataset.sid };
  return null;
}
function markTargets(valid) {
  clearMarks();
  for (const r of valid) {
    if (r.kind === 'player') $('life-' + r.id).classList.add('targetable');
    else if (r.kind === 'perm') document.querySelectorAll(`#stage .card[data-kind=perm][data-id="${r.id}"]`).forEach((e) => e.classList.add('targetable'));
    else document.querySelectorAll(`#stack .card[data-sid="${r.id}"]`).forEach((e) => e.classList.add('targetable'));
  }
}
const clearMarks = () => document.querySelectorAll('#stage .targetable').forEach((e) => e.classList.remove('targetable'));

document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !g || $('board').hidden || g.winner || !$('inspect').hidden) return;
  if (g.waiting?.player !== ME) return;
  const el = e.target.closest('#hand .card, #field-me .card[data-kind=perm]');
  if (!el) return;
  drag = { el, id: +el.dataset.id, hand: !!el.closest('#hand'), x0: e.clientX, y0: e.clientY, started: false };
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
    if (!beginDrag()) { drag = null; return; }
  }
  drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
  const over = refOf(document.elementFromPoint(e.clientX, e.clientY));
  document.querySelectorAll('#stage .drophot').forEach((x) => x.classList.remove('drophot'));
  if (over && drag.valid?.some((r) => r.kind === over.kind && r.id === over.id)) {
    (over.kind === 'player' ? $('life-' + over.id) : document.querySelector(over.kind === 'perm' ? `#stage .card[data-kind=perm][data-id="${over.id}"]` : `#stack .card[data-sid="${over.id}"]`))?.classList.add('drophot');
  }
  $('dropzone').classList.toggle('hot', e.clientY < stageRect().top + stageRect().height * 0.74 && !drag.valid);
});
document.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const d = drag; drag = null;
  if (!d.started) return;
  justDragged = true; setTimeout(() => (justDragged = false), 0);
  endDrag(d, e);
});
document.addEventListener('click', (e) => { if (justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);

function beginDrag() {
  if (peekId != null) { peekId = null; $('preview').classList.remove('on'); }
  const w = g.waiting; const d = drag; const id = d.id;
  if (mode?.type === 'target') { mode = null; }
  d.valid = null; d.act = null;
  if (d.hand) {
    const c = g.players[ME].hand.find((x) => x.id === id); if (!c || w.kind !== 'priority') return false;
    if (g.canPlayLand(ME, c)) d.act = { type: 'land', c };
    else if (g.canCast(ME, c)) { const info = infoOf(c), eff = EFFECTS[c.def.name]; const specs = info ? (info.modes?.length ? [] : info.targets || []) : eff?.targets || []; d.act = { type: 'cast', c, eff }; if (specs.length) d.valid = g.validTargets(specs[0], ME, null, c); }
    else return false;
  } else {
    const p = g.perm(id); if (!p || p.controller !== ME) return false;
    if (mode?.type === 'attackers') { if (!g.canAttack(p)) return false; d.act = { type: 'attack', p }; }
    else if (mode?.type === 'blockers') { if (!g.isCreature(p) || p.tapped) return false; d.act = { type: 'block', p }; d.valid = g.combat.attackers.filter((a) => g.canBlock(p, g.perm(a))).map((a) => ({ kind: 'perm', id: a })); if (!d.valid.length) return false; }
    else if (w.kind === 'priority') { const a = g.activatable(ME).find((x) => x.perm.id === id && (x.ab.targets || x.ab.multi)); if (!a) return false; const sp = a.ab.targets?.[0] || a.ab.multi?.spec; if (!sp) return false; d.act = { type: 'ability', a }; d.valid = g.validTargets(sp, ME, id, p.card); }
    else return false;
  }
  d.started = true;
  const px = cardPx(); const src = d.el.querySelector('img');
  const gh = document.createElement('div'); gh.className = 'dragghost'; gh.style.width = px + 'px'; gh.style.height = px * 1.393 + 'px';
  gh.innerHTML = `<img src="${src.src}" draggable="false">`; document.body.appendChild(gh); d.ghost = gh;
  gh.style.left = d.x0 + 'px'; gh.style.top = d.y0 + 'px';
  d.el.style.opacity = '.25'; $('preview').classList.remove('on');
  if (d.valid) markTargets(d.valid);
  $('dropzone').classList.add('on'); hint(d.act.type === 'block' ? 'Drop on the attacker to block' : d.valid ? 'Drop on a target' : d.act.type === 'attack' ? 'Drop above to attack' : 'Drop on the table to play');
  return true;
}
function endDrag(d, e) {
  const gr = d.ghost.getBoundingClientRect();
  d.ghost.remove(); $('dropzone').classList.remove('on', 'hot'); clearMarks(); document.querySelectorAll('#stage .drophot').forEach((x) => x.classList.remove('drophot')); hint('');
  const st = stageRect(); const onTable = e.clientY < st.top + st.height * 0.74;
  const over = refOf(document.elementFromPoint(e.clientX, e.clientY));
  const okTarget = over && d.valid?.find((r) => r.kind === over.kind && r.id === over.id);
  const a = d.act;
  const done = (id) => { if (id) dragFrom.set(id, gr); refresh(); };
  if (a.type === 'land') { if (onTable && g.playLand(ME, a.c)) return done(a.c.id); }
  else if (a.type === 'cast') {
    if (d.valid) {
      if (okTarget) { d.el.style.opacity = ''; return void castFlow(a.c, [okTarget], gr); }
      if (onTable) { d.el.style.opacity = ''; return void castFlow(a.c, [], gr); }
    } else if (onTable) { d.el.style.opacity = ''; return void castFlow(a.c, [], gr); }
  } else if (a.type === 'attack') {
    if (mode?.type === 'attackers') { if (e.clientY < d.y0 - 25) mode.sel.add(a.p.id); else mode.sel.delete(a.p.id); }
  } else if (a.type === 'block') {
    if (okTarget && mode?.type === 'blockers') { for (const k of Object.keys(mode.map)) mode.map[k] = mode.map[k].filter((x) => x !== a.p.id); (mode.map[okTarget.id] ||= []).push(a.p.id); }
  } else if (a.type === 'ability') {
    if (okTarget) { d.el.style.opacity = ''; return void abilityFlow(a.a.perm, a.a, [okTarget]); }
  }
  d.el.style.opacity = ''; render();
}
addEventListener('resize', () => { if (g && !$('board').hidden) render(); });
$('rotate-go')?.addEventListener('click', () => $('board').classList.add('norotate'));
TG.init({ g: () => g, mode: () => mode, ME, permEl: (id) => permEl(id), refOf: (el) => refOf(el) });
window.__tick = () => tick(); window.__render = render; Object.defineProperty(window, '__mode', { get: () => mode });
