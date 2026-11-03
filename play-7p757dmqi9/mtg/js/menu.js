import { isImplemented } from './cards.js?v=20261102204808';
import { DECK_LISTS, copyLimit } from './decks.js?v=20261102204808';
import { askConfirm, askText } from './dialog.js?v=20261102204808';

const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const MIN_DECK = 40;
const SETS = { '': 'All sets', LEA: 'Alpha', LEB: 'Beta', ARN: 'Arabian Nights', ATQ: 'Antiquities', LEG: 'Legends' };
const COLORS = ['W', 'U', 'B', 'R', 'G', 'C', 'M'];   // M = multicolour (gold)
const COLOR_ORDER = { W: 0, U: 1, B: 2, R: 3, G: 4 };
const KEY = 'mtgclassic.decks.v1';

let byName, uniq, onPlay, ctx;
let store = { decks: {}, current: '' };
const f = { q: '', colors: new Set(), set: '', type: '', playable: false, legend: false, page: 1 };
const PAGE = 120;   // collection grid renders in pages (651+ cards; phones)
const isLegend = (d) => (d.supertypes || []).includes('Legendary');
const isGold = (d) => (d.colors || []).length > 1;
let sideQ = '';

const cmc = (d) => { let n = 0; for (const m of (d.manaCost || '').matchAll(/\{([^}]+)\}/g)) { const t = m[1]; n += /^\d+$/.test(t) ? +t : t === 'X' ? 0 : /^\d+\//.test(t) ? parseInt(t) : 1; } return n; };
const isLand = (d) => d.types.includes('Land');
function colorKey(d) { if (isLand(d)) return 9; const c = d.colors || []; if (!c.length) return 7; if (c.length > 1) return 6; return COLOR_ORDER[c[0]]; }
export function costHtml(mc) {
  const PC = { W: '#f6efc8', U: '#7ab8ee', B: '#8a7f86', R: '#ee7a5c', G: '#6cbd78', C: '#cfc8bb' };
  return [...(mc || '').matchAll(/\{([^}]+)\}/g)].map((m) => {
    const t = m[1];
    if (/^\d+$/.test(t)) return `<i class="pip N">${t}</i>`;
    if (PC[t]) return `<i class="pip ${t}">${t}</i>`;
    if (t.includes('/')) {   // hybrid / phyrexian-style: split colour pip
      const parts = t.split('/'), cols = parts.map((x) => PC[x] || '#cfc8bb'); const lbl = /^\d/.test(parts[0]) ? parts[0] : '';
      return `<i class="pip H" title="{${t}}" style="background:linear-gradient(135deg,${cols[0]} 50%,${cols[1] || cols[0]} 50%)">${lbl}</i>`;
    }
    return `<i class="pip X">${esc(t)}</i>`;
  }).join('');
}

function load() {
  try { store = JSON.parse(localStorage.getItem(KEY)) || store; } catch {}
  for (const [n, d] of Object.entries(DECK_LISTS)) if (!store.decks[n]) store.decks[n] = { ...d, _premade: 1 };
  if (!store.decks[store.current]) store.current = Object.keys(DECK_LISTS)[0];
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} };
const deck = () => store.decks[store.current];
const entries = (d = deck()) => Object.entries(d).filter(([k]) => k[0] !== '_');
const total = (d = deck()) => entries(d).reduce((a, [, n]) => a + n, 0);
// the player's decks for the pre-game picker: [{name, size, legal}], plus counts of one deck
export const myDecks = () => ({ current: store.current, list: Object.keys(store.decks).map((n) => ({ name: n, size: total(store.decks[n]), legal: total(store.decks[n]) >= MIN_DECK })) });
export const myDeckCounts = (n) => Object.fromEntries(entries(store.decks[n] || {}));
export const setMyDeck = (n) => { if (store.decks[n]) { store.current = n; save(); } };
const playableName = (n) => isImplemented(byName[n][0]);
function add(n) { const d = deck(); if (!playableName(n)) return; if ((d[n] || 0) >= copyLimit(n)) return; d[n] = (d[n] || 0) + 1; delete d._premade; save(); }
function remove(n) { const d = deck(); if (!d[n]) return; if (--d[n] <= 0) delete d[n]; delete d._premade; save(); }

// ---------- shell ----------
export function initMenu(opts) {
  ({ byName, onPlay } = opts); ctx = opts;
  uniq = Object.values(byName).map((v) => v[0]).sort((a, b) => isImplemented(b) - isImplemented(a) || colorKey(a) - colorKey(b) || cmc(a) - cmc(b) || a.name.localeCompare(b.name));
  load();
  $('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (b && !b.disabled) show(b.dataset.v); };
  // touch: long-press a card = big view (no right-click on phones)
  let lp = null, swallow = 0;
  document.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; const el = e.target.closest('#app [data-n]'); if (!el) return; clearTimeout(lp?.t); lp = { x: e.clientX, y: e.clientY, t: setTimeout(() => { bigView(el.dataset.n); swallow = Date.now() + 700; lp = null; }, 450) }; }, true);
  document.addEventListener('pointermove', (e) => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) { clearTimeout(lp.t); lp = null; } }, true);
  for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => { if (lp) { clearTimeout(lp.t); lp = null; } }, true);
  document.addEventListener('click', (e) => { if (Date.now() < swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', (e) => { const el = e.target.closest('#app [data-n]'); if (!el) return; e.preventDefault(); bigView(el.dataset.n); });
  show('home');
}
export function showApp(v) { $('#app').hidden = false; $('#board').hidden = true; if (v) show(v); else renderAll(); }
export function hideApp() { $('#app').hidden = true; }
let view = 'home';
function show(v) {
  view = v; $('#app').dataset.view = v;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  document.querySelectorAll('#views section').forEach((s) => (s.hidden = s.id !== 'v-' + v));
  renderAll();
}
function renderAll() { if (view === 'home') renderHome(); else if (view === 'collection') renderCollection(); else if (view === 'decks') renderDecks(); }

function bigView(n) {
  const d = byName[n]?.[0]; if (!d) return;
  let m = $('#minspect'); if (!m) { m = document.createElement('div'); m.id = 'minspect'; document.body.appendChild(m); m.onclick = () => (m.hidden = true); document.addEventListener('keydown', (e) => e.key === 'Escape' && (m.hidden = true)); }
  m.innerHTML = `<div class="big"><img src="${d.art}"><div class="info"><div class="ihead"><b>${esc(d.name)}</b><span>${costHtml(d.manaCost)}</span></div><div class="itype">${esc(d.type)}${d.power !== undefined ? ` · ${d.power}/${d.toughness}` : ''}</div><div class="itext">${esc(d.text || '—')}</div><div class="imeta">${esc(SETS[d.set] || d.set)} · ${esc(d.rarity)} · ${esc(d.artist || '')}</div>${d.rulings?.length ? `<div class="rul"><b>Rulings</b>${d.rulings.slice(0, 5).map((r) => `<p>${esc(r.text)}</p>`).join('')}</div>` : ''}${isImplemented(d) ? '' : '<div class="soon">Rules not implemented yet</div>'}</div></div>`;
  m.hidden = false;
}

// ---------- deck selector shared by views ----------
function deckSelect() {
  return `<select class="dsel" data-act="deck">${Object.keys(store.decks).map((n) => `<option ${n === store.current ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
}
function deckTools() {
  const custom = !deck()._premade && !DECK_LISTS[store.current];
  return `<div class="dtools"><button data-act="new">New deck</button><button data-act="dup">Duplicate</button>${custom ? '<button data-act="del">Delete</button>' : ''}</div>`;
}
function playBtn() {
  const n = total();
  return `<button class="play" data-act="play" ${n < MIN_DECK ? 'disabled' : ''}>Play</button>${n < MIN_DECK ? `<div class="need">Deck needs at least ${MIN_DECK} cards (${n}/${MIN_DECK})</div>` : ''}`;
}
document.addEventListener('change', (e) => { const a = e.target.dataset?.act; if (a === 'deck') { store.current = e.target.value; save(); renderAll(); } });
document.addEventListener('click', async (e) => {
  const b = e.target.closest('#app [data-act]'); if (!b || b.tagName === 'SELECT') return;
  const a = b.dataset.act;
  if (a === 'resume') { ctx.onResume?.(); return; }
  if (a === 'play') { if (total() >= MIN_DECK) onPlay({ ...Object.fromEntries(entries()) }); }
  if (a === 'new') { const n = (await askText('Deck name?', 'My Deck'))?.trim(); if (n && !store.decks[n]) { store.decks[n] = {}; store.current = n; save(); renderAll(); } }
  if (a === 'dup') { const n = store.current + ' copy'; store.decks[n] = Object.fromEntries(entries()); store.current = n; save(); renderAll(); }
  if (a === 'del') { if (await askConfirm(`Delete "${store.current}"?`, 'Delete')) { delete store.decks[store.current]; store.current = Object.keys(store.decks)[0]; save(); renderAll(); } }
  if (a === 'done') show('home');
  if (a === 'goto') show(b.dataset.v);
});

// ---------- home ----------
function renderHome() {
  const cov = ctx.coverage;
  $('#v-home').innerHTML = `<div class="home"><h1>MTG Classic<em>+</em></h1><p class="tag">Vintage Magic, Arena style · Alpha · Beta · Unlimited · Arabian Nights · Antiquities · Legends</p>
  <div class="homebox">${(() => { const r = ctx.canResume?.(); return r ? `<button class="resume" data-act="resume"><b>Resume game</b><span>vs ${esc(r.foe || 'Opponent')} · Turn ${r.turn} · You ${r.life[0]} - ${r.life[1]} Opp</span></button>` : ''; })()}<label>Your deck</label>${deckSelect()}<div class="hcount">${total()} cards</div>${playBtn()}
  <button class="ghost" data-act="goto" data-v="decks">Edit deck</button></div><p class="muted">${cov.implemented} of ${cov.total} cards have implemented rules. The rest are shown locked in the collection.</p></div>`;
}

// ---------- collection ----------
function filtered() {
  const q = f.q.trim().toLowerCase();
  return uniq.filter((d) => {
    if (q && !(d.name.toLowerCase().includes(q) || (d.text || '').toLowerCase().includes(q) || d.type.toLowerCase().includes(q))) return false;
    if (f.colors.size) { const c = d.colors || []; const ok = [...f.colors].some((k) => (k === 'C' ? !c.length : k === 'M' ? c.length > 1 : c.includes(k))); if (!ok) return false; }
    if (f.legend && !isLegend(d)) return false;
    if (f.set && !byName[d.name].some((v) => v.set === f.set)) return false;
    if (f.type && !d.types.includes(f.type)) return false;
    if (f.playable && !isImplemented(d)) return false;
    return true;
  });
}
function filterBar() {
  return `<div class="filters"><div class="search"><input id="q" placeholder="Search…" value="${esc(f.q)}"><svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/></svg></div>
  <div class="colors">${COLORS.map((c) => `<button class="cf ${c} ${f.colors.has(c) ? 'on' : ''}" data-c="${c}" title="${c === 'M' ? 'Multicolor' : c === 'C' ? 'Colorless' : c}">${{ W: '☀', U: '💧', B: '☠', R: '🔥', G: '🌲', C: '◇', M: '✦' }[c]}</button>`).join('')}</div>
  <select id="fset">${Object.entries(SETS).map(([k, v]) => `<option value="${k}" ${k === f.set ? 'selected' : ''}>${v}</option>`).join('')}</select>
  <select id="ftype">${['', 'Creature', 'Instant', 'Sorcery', 'Artifact', 'Land', 'Enchantment'].map((t) => `<option value="${t}" ${t === f.type ? 'selected' : ''}>${t || 'All types'}</option>`).join('')}</select>
  <label class="chk"><input type="checkbox" id="fplay" ${f.playable ? 'checked' : ''}> Playable only</label><label class="chk"><input type="checkbox" id="fleg" ${f.legend ? 'checked' : ''}> Legendary</label></div>`;
}
function cell(d) {
  const n = deck()[d.name] || 0, lim = copyLimit(d.name), ok = isImplemented(d);
  const pips = Array.from({ length: Math.min(lim, 4) }, (_, i) => `<i class="${i < n ? 'f' : ''}"></i>`).join('');
  return `<div class="cc ${ok ? '' : 'locked'} ${n ? 'in' : ''} ${isGold(d) ? 'gold' : ''} ${isLegend(d) ? 'leg' : ''}" data-n="${esc(d.name)}"><img loading="lazy" src="${d.art}" alt="${esc(d.name)}">${ok ? '' : '<span class="lock">Coming soon</span>'}<div class="cfoot"><span class="pips">${pips}</span><span class="qty">x${n}</span></div></div>`;
}
function deckPanel() {
  const rows = entries().map(([n, c]) => ({ n, c, d: byName[n][0] })).sort((a, b) => isLand(a.d) - isLand(b.d) || cmc(a.d) - cmc(b.d) || a.n.localeCompare(b.n));
  return `<aside class="dpanel"><div class="dhead"><div class="back"></div><div><div class="dname">${deckSelect()}</div><div class="dcount ${total() < MIN_DECK ? 'bad' : ''}">${total()} Cards</div></div></div>${deckTools()}
  <div class="dlist">${rows.map((r) => `<div class="drow" data-rm="${esc(r.n)}" data-n="${esc(r.n)}"><span class="dcost">${costHtml(r.d.manaCost)}</span><span class="dn">${esc(r.n)}</span><b>x${r.c}</b></div>`).join('') || '<p class="muted">Click cards to add them.</p>'}</div>
  <div class="dfoot">${playBtn()}</div></aside>`;
}
// paged grid: first PAGE cards, the rest appended when the sentinel scrolls into view
function gridHtml(list) { if (!list.length) return '<p class="muted">No cards match.</p>'; return list.slice(0, f.page * PAGE).map(cell).join('') + (list.length > f.page * PAGE ? `<div class="gmore" id="gmore">${list.length - f.page * PAGE} more…</div>` : ''); }
let gobs = null;
function watchMore() {
  gobs?.disconnect(); const m = $('#gmore'); if (!m || !window.IntersectionObserver) return;
  gobs = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { gobs.disconnect(); f.page++; $('#cgrid').innerHTML = gridHtml(filtered()); watchMore(); } }, { root: $('#cgrid'), rootMargin: '400px' }); gobs.observe(m);
}
function renderCollection() {
  const list = filtered();
  f.page = 1;
  $('#v-collection').innerHTML = `<div class="colwrap"><div class="colmain">${filterBar()}<div class="grid" id="cgrid">${gridHtml(list)}</div></div>${deckPanel()}</div>`;
  wireCollection(); watchMore();
}
function wireCollection() {
  const root = $('#v-collection');
  const refreshGrid = () => { f.page = 1; $('#cgrid').innerHTML = gridHtml(filtered()); $('#cgrid').scrollTop = 0; watchMore(); };
  const refreshDeck = () => { const old = $('.dpanel', root); const t = document.createElement('div'); t.innerHTML = deckPanel(); old.replaceWith(t.firstElementChild); };
  $('#q').oninput = (e) => { f.q = e.target.value; refreshGrid(); };
  $('#fset').onchange = (e) => { f.set = e.target.value; refreshGrid(); };
  $('#ftype').onchange = (e) => { f.type = e.target.value; refreshGrid(); };
  $('#fleg').onchange = (e) => { f.legend = e.target.checked; refreshGrid(); };
  $('#fplay').onchange = (e) => { f.playable = e.target.checked; refreshGrid(); };
  root.querySelector('.colors').onclick = (e) => { const b = e.target.closest('.cf'); if (!b) return; const c = b.dataset.c; f.colors.has(c) ? f.colors.delete(c) : f.colors.add(c); b.classList.toggle('on'); refreshGrid(); };
  $('#cgrid').onclick = (e) => { const c = e.target.closest('.cc'); if (!c) return; add(c.dataset.n); const d = byName[c.dataset.n][0]; c.outerHTML = cell(d); refreshDeck(); };
  root.onclick = (e) => { const r = e.target.closest('[data-rm]'); if (!r) return; remove(r.dataset.rm); refreshGrid(); refreshDeck(); };
}

// ---------- deck builder (columns by mana value + side list) ----------
function renderDecks() {
  const cols = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], L: [] };
  for (const [n, c] of entries()) { const d = byName[n][0]; const k = isLand(d) ? 'L' : Math.min(cmc(d), 6); for (let i = 0; i < c; i++) cols[k].push(d); }
  const labels = { 0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6+', L: 'Lands' };
  const colHtml = Object.entries(cols).filter(([, l]) => l.length).map(([k, l]) => `<div class="dcol"><h4>${labels[k]} <small>${l.length}</small></h4><div class="stk">${l.sort((a, b) => a.name.localeCompare(b.name)).map((d) => `<div class="sc" data-rm="${esc(d.name)}" data-n="${esc(d.name)}"><img src="${d.art}" loading="lazy"></div>`).join('')}</div></div>`).join('');
  const sideAll = uniq.filter((d) => isImplemented(d) && (!sideQ || d.name.toLowerCase().includes(sideQ))); const sideMore = Math.max(0, sideAll.length - 200);
  const side = sideAll.slice(0, 200).map((d) => { const n = deck()[d.name] || 0, lim = copyLimit(d.name); const ck = isLand(d) ? 'L' : (d.colors || []).length > 1 ? 'M' : (d.colors || [])[0] || 'A'; return `<div class="srow c${ck} ${n >= lim ? 'full' : ''}" data-add="${esc(d.name)}" data-n="${esc(d.name)}"><span>${esc(d.name)}</span><span class="dcost">${costHtml(d.manaCost)}</span><b>${n}/${lim > 9 ? '∞' : lim}</b></div>`; }).join('');
  const curve = [0, 0, 0, 0, 0, 0, 0]; for (const [n, c] of entries()) { const d = byName[n][0]; if (!isLand(d)) curve[Math.min(cmc(d), 6)] += c; }
  const cmax = Math.max(1, ...curve);
  const curveHtml = `<div class="curve" title="Mana curve (non-land cards)">${curve.map((v, i) => `<div class="cb2"><span class="cn">${v || ''}</span><i style="height:${Math.round((v / cmax) * 100)}%"></i><span class="cl">${i === 6 ? '6+' : i}</span></div>`).join('')}</div>`;
  $('#v-decks').innerHTML = `<div class="dbwrap"><div class="dbmain"><div class="dbbar"><div class="dbplate"><div class="dbname">${deckSelect()}</div><div class="dbcount ${total() < MIN_DECK ? 'bad' : ''}">${total()}/${MIN_DECK}+ cards</div></div>${curveHtml}${deckTools()}</div><div class="dcols">${colHtml || '<p class="muted pad">Empty deck. Add cards from the list on the right.</p>'}</div></div>
  <aside class="side"><h3>Sideboard <small>${uniq.filter(isImplemented).length} playable cards</small></h3><input id="sq" placeholder="Search…" value="${esc(sideQ)}"><div class="slist">${side}${sideMore ? `<p class="muted">${sideMore} more cards: type to search</p>` : ''}</div><button class="play" data-act="done">Done</button></aside></div>`;
  $('#sq').oninput = (e) => { sideQ = e.target.value.toLowerCase(); const keep = $('#sq'); renderDecks(); const n = $('#sq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  const root = $('#v-decks');
  root.onclick = (e) => {
    const r = e.target.closest('[data-rm]'), a = e.target.closest('[data-add]');
    if (r) { remove(r.dataset.rm); renderDecks(); } else if (a) { add(a.dataset.add); renderDecks(); }
  };
}
