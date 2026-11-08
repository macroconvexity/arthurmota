import { isImplemented } from './cards.js?v=20261108130904';
import { DECK_LISTS, DECK_META, copyLimit as rawLimit, RESTRICTED, isLegal } from './decks.js?v=20261108130904';
import * as DKN from './decks.js?v=20261108130904';
import { tileHtml, colorsOf } from './decktile.js?v=20261108130904';
import * as ST from './settings.js?v=20261108130904';
import { askConfirm, askText, modal } from './dialog.js?v=20261108130904';

const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const MIN_DECK = DKN.MIN_DECK || 60;   // decks must have exactly this many cards or more (decks.js exports MIN_DECK)
// one-time notice for custom decks saved under the minimum (saved decks are never deleted)
const NOTE_KEY = 'mtgclassic.short.notified';
function shortNotice() {
  try { const n = total(); if (n >= MIN_DECK || n === 0 || deck()._premade || DECK_LISTS[store.current]) return; const seen = JSON.parse(localStorage.getItem(NOTE_KEY) || '[]'); if (seen.includes(store.current)) return; seen.push(store.current); localStorage.setItem(NOTE_KEY, JSON.stringify(seen)); menuToast(`This deck has ${n} cards; add ${MIN_DECK - n} more to play`); } catch {}
}
// ---- format (Restricted / Unrestricted): limits come from decks.js copyLimit(name, fmt)
export const FMT_TEXT = { restricted: 'Restricted: Power 9, Sol Ring, Demonic Tutor, Balance... limited to 1 copy', unrestricted: 'Unrestricted: up to 4 copies per card (basic lands unlimited)' };
const fmt = () => (ST.get('format') === 'restricted' ? 'restricted' : 'unrestricted');
const fmtName = (f = fmt()) => (f === 'restricted' ? 'Restricted' : 'Unrestricted');
const copyLimit = (name, f = fmt()) => rawLimit(name, f);
// ---- editions (decks.js EDITIONS / cardAllowed when present, else local fallback)
const EDITIONS = DKN.EDITIONS || [{ id: 'all', label: 'All Editions' }, { id: 'LEA', label: 'Alpha' }, { id: 'LEB', label: 'Beta' }, { id: '2ED', label: 'Unlimited' }, { id: 'ARN', label: 'Arabian Nights' }, { id: 'ATQ', label: 'Antiquities' }, { id: 'LEG', label: 'Legends' }];
const edId = () => (EDITIONS.some((e) => e.id === ST.get('edition')) ? ST.get('edition') : 'all');
const edLabel = (id = edId()) => EDITIONS.find((e) => e.id === id)?.label || id;
const cardOK = (d, ed) => (DKN.cardAllowed ? DKN.cardAllowed(d, ed) : ed === 'all' || d.set === ed || (d.also_in || []).includes(ed));
// reason a counts map is not legal for the chosen format / edition ('' when legal)
export function deckProblem(counts, f = fmt(), ed = edId()) {
  const bad = Object.entries(counts || {}).filter(([k, n]) => k[0] !== '_' && n > copyLimit(k, f)).map(([k, n]) => `${n}x ${k}`);
  if (bad.length) return `Not legal in ${fmtName(f)}: ${bad.slice(0, 4).join(', ')}${bad.length > 4 ? ` +${bad.length - 4} more` : ''}`;
  if (ed !== 'all') { const off = Object.keys(counts || {}).filter((k) => k[0] !== '_' && byName[k] && !cardOK(byName[k][0], ed)); if (off.length) return `Not in ${edLabel(ed)}: ${off.slice(0, 4).join(', ')}${off.length > 4 ? ` +${off.length - 4} more` : ''}`; }
  try { if (isLegal && !isLegal(counts, f)) return `Not legal in ${fmtName(f)}`; } catch {}
  return '';
}
const fmtSeg = () => `<div class="seg fmtseg" data-fmtseg="1">${['restricted', 'unrestricted'].map((x) => `<button data-act="fmt" data-v="${x}" class="${fmt() === x ? 'on' : ''}">${fmtName(x)}</button>`).join('')}</div>`;
function menuToast(t) { let el = $('#mtoast'); if (!el) { el = document.createElement('div'); el.id = 'mtoast'; $('#app').appendChild(el); } el.textContent = t; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(menuToast.t); menuToast.t = setTimeout(() => el.classList.remove('on'), 1800); }
const SETS = { '': 'All sets', LEA: 'Alpha', LEB: 'Beta', ARN: 'Arabian Nights', ATQ: 'Antiquities', LEG: 'Legends' };
const COLORS = ['W', 'U', 'B', 'R', 'G', 'C', 'M'];   // M = multicolour (gold)
const COLOR_ORDER = { W: 0, U: 1, B: 2, R: 3, G: 4 };
const KEY = 'mtgclassic.decks.v1';

let byName, uniq, onPlay, ctx;
let store = { decks: {}, current: '' };
const PAGE = 120;   // collection grid renders in pages (651+ cards; phones)
const isLegend = (d) => (d.supertypes || []).includes('Legendary');
const isGold = (d) => (d.colors || []).length > 1;

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
export const myDecks = (f = fmt(), ed = edId()) => ({ current: store.current, list: Object.keys(store.decks).map((n) => {
  const c = Object.fromEntries(entries(store.decks[n])), sz = total(store.decks[n]), pr = deckProblem(c, f, ed); const meta = DECK_META[n] || {};
  return { name: n, size: sz, legal: sz >= MIN_DECK, ok: sz >= MIN_DECK && !pr, reason: sz < MIN_DECK ? `Needs ${MIN_DECK} cards (has ${sz})` : pr, premade: !!store.decks[n]._premade || !!DECK_LISTS[n], counts: c, colors: meta.colors || colorsOf(c, byName), archetype: meta.archetype || (DECK_LISTS[n] ? '' : 'custom deck'), rating: meta.rating, keyCards: meta.keyCards, blurb: meta.blurb };
}) });
export const myDeckCounts = (n) => Object.fromEntries(entries(store.decks[n] || {}));
export const setMyDeck = (n) => { if (store.decks[n]) { store.current = n; save(); } };
const playableName = (n) => isImplemented(byName[n][0]);
function add(n) { const d = deck(); if (!playableName(n)) return; if ((d[n] || 0) >= copyLimit(n)) { const l = copyLimit(n); menuToast(fmt() === 'restricted' && l === 1 ? 'Restricted: 1 copy max' : `${fmtName()}: ${l} copies max`); return; } d[n] = (d[n] || 0) + 1; delete d._premade; save(); }
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
  const n = total(), pr = deckProblem(Object.fromEntries(entries())), bad = n < MIN_DECK || !!pr;
  return `<button class="play" data-act="play" ${bad ? 'disabled' : ''}>Play</button>${n < MIN_DECK ? `<div class="need">Deck needs at least ${MIN_DECK} cards (${n}/${MIN_DECK})</div>` : pr ? `<div class="need">${esc(pr)}</div>` : ''}`;
}
document.addEventListener('change', (e) => { const a = e.target.dataset?.act; if (a === 'deck') { store.current = e.target.value; save(); renderAll(); } });
document.addEventListener('click', async (e) => {
  const b = e.target.closest('#app [data-act]'); if (!b || b.tagName === 'SELECT') return;
  const a = b.dataset.act;
  if (a === 'resume') { ctx.onResume?.(); return; }
  if (a === 'fmt') { ST.set('format', b.dataset.v); renderAll(); return; }
  if (a === 'ed') { pickEdition(b.dataset.v, b); return; }
  if (a === 'homeplay') { onPlay(null); return; }
  if (a === 'fmtinfo') { fmtInfoModal(); return; }
  if (a === 'play') { if (total() >= MIN_DECK && !deckProblem(Object.fromEntries(entries()))) onPlay({ ...Object.fromEntries(entries()) }); }
  if (a === 'new') { const n = (await askText('Deck name?', 'My Deck'))?.trim(); if (n && !store.decks[n]) { store.decks[n] = {}; store.current = n; save(); renderAll(); } }
  if (a === 'dup') { const n = store.current + ' copy'; store.decks[n] = Object.fromEntries(entries()); store.current = n; save(); renderAll(); }
  if (a === 'del') { if (await askConfirm(`Delete "${store.current}"?`, 'Delete')) { delete store.decks[store.current]; store.current = Object.keys(store.decks)[0]; save(); renderAll(); } }
  if (a === 'done') show('home');
  if (a === 'goto') show(b.dataset.v);
});

// ---------- home ----------
// edition showcase tile: three iconic card arts of the selected edition (names are checked against the catalogue; extras are fallbacks)
const SHOWCASE = {
  all: { keys: ['Black Lotus', 'Mox Sapphire', 'Time Walk', 'Ancestral Recall'], blurb: 'Every edition: Alpha to Legends' },
  LEA: { keys: ['Black Lotus', 'Lightning Bolt', 'Serra Angel', 'Shivan Dragon'], blurb: 'Alpha, 1993: the original 295 cards' },
  LEB: { keys: ['Ancestral Recall', 'Shivan Dragon', 'Wrath of God', 'Mox Pearl'], blurb: 'Beta, 1993: the corrected printing' },
  '2ED': { keys: ['Time Walk', 'Juggernaut', 'Counterspell', 'Sol Ring'], blurb: 'Unlimited, 1993: white border, wider print' },
  ARN: { keys: ['Juzám Djinn', 'Library of Alexandria', 'Bazaar of Baghdad', 'Serendib Efreet'], blurb: 'Arabian Nights, 1993: the first expansion' },
  ATQ: { keys: ["Mishra's Workshop", 'Strip Mine', 'Su-Chi', 'Tawnos\'s Wand'], blurb: 'Antiquities, 1994: the artifact war' },
  LEG: { keys: ['Nicol Bolas', 'Moat', 'Mana Drain', 'Gauntlet of Might'], blurb: 'Legends, 1994: legendary creatures' },
};
const showcaseHtml = (id = edId()) => { const sc = SHOWCASE[id] || SHOWCASE.all; return tileHtml({ name: edLabel(id), archetype: sc.blurb, keyCards: sc.keys, colors: [], noMana: true }, byName, { sel: true, cls: 'big show', eager: true }); };
function renderHome() {
  const cov = ctx.coverage, r = ctx.canResume?.();
  const chips = EDITIONS.map((e) => `<button class="edchip ${e.id === edId() ? 'on' : ''}" data-act="ed" data-v="${e.id}">${esc(e.label)}</button>`).join('');
  $('#v-home').innerHTML = `<div class="home"><h1>MTG Classic<em>+</em></h1><p class="tag">Vintage Magic, Arena style · Alpha · Beta · Unlimited · Arabian Nights · Antiquities · Legends</p>
  <div class="hpanel"><div class="hl" id="showcase">${showcaseHtml()}</div>
  <div class="hr">${r ? `<button class="resume" data-act="resume"><b>Resume game</b><span>vs ${esc(r.foe || 'Opponent')} · Turn ${r.turn} · You ${r.life[0]} - ${r.life[1]} Opp</span></button>` : ''}
    <label>Edition</label><div class="edrow" id="edrow">${chips}</div>
    <label>Format <button class="info" data-act="fmtinfo" aria-label="What is Restricted?">i</button></label>${fmtSeg()}<div class="fmtnote">${esc(FMT_TEXT[fmt()])}</div>
    <button class="play" data-act="homeplay">Play</button>
    <button class="ghost edit" data-act="goto" data-v="decks">Edit deck</button></div></div>
  <p class="muted">${cov.implemented} of ${cov.total} cards have implemented rules. The rest are shown locked in the collection.</p></div>`;
  requestAnimationFrame(() => $('#edrow .on')?.scrollIntoView?.({ inline: 'center', block: 'nearest' }));
}
// edition chip: swap the showcase with a short fade (no full re-render, the chip row keeps its scroll)
function pickEdition(id, btn) {
  ST.set('edition', id); document.querySelectorAll('#edrow .edchip').forEach((x) => x.classList.toggle('on', x === btn));
  const sc = $('#showcase'); if (!sc) return; sc.classList.add('fadeout');
  setTimeout(() => { sc.innerHTML = showcaseHtml(id); sc.classList.remove('fadeout'); sc.classList.add('fadein'); setTimeout(() => sc.classList.remove('fadein'), 320); }, 160);
}
// modal explaining the format rule, with the restricted cards
function fmtInfoModal() {
  const names = [...RESTRICTED].filter((n) => byName[n]).sort();
  modal((box, close) => {
    box.classList.add('infobox');
    box.innerHTML = `<p><b>Formats</b></p><div class="infotxt"><p><b>Restricted:</b> the Power 9 and other bombs are limited to <b>1 copy</b> per deck. They are restricted, not banned.</p><p><b>Unrestricted:</b> up to <b>4 copies</b> of any card (basic lands unlimited).</p></div><div class="setlbl">Restricted cards (${names.length})</div><div class="rgrid">${names.map((n) => `<div class="rc" title="${esc(n)}"><img loading="lazy" src="${byName[n][0].art}" alt=""><span>${esc(n)}</span></div>`).join('')}</div><div class="dlgbtns"><button class="yes">Close</button></div>`;
    box.querySelector('.yes').onclick = () => close(); box.querySelector('.yes').focus();
  });
}
// ---------- shared card browser (Collection = browse, Decks = browse + build) ----------
const TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Land'];
const COSTS = [0, 1, 2, 3, 4, 5, 6];
const RARITIES = { '': 'All rarities', common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };
const SORTS = { color: 'Colour', cmc: 'Mana cost', name: 'Name', type: 'Type' };
const TYPE_ORDER = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Land'];
const inSet = (d, s) => byName[d.name].some((v) => v.set === s || (v.also_in || []).includes(s));
const typeKey = (d) => { const i = TYPE_ORDER.findIndex((t) => d.types.includes(t)); return i < 0 ? 99 : i; };
const SORT_FN = {
  color: (a, b) => colorKey(a) - colorKey(b) || cmc(a) - cmc(b) || a.name.localeCompare(b.name),
  cmc: (a, b) => cmc(a) - cmc(b) || colorKey(a) - colorKey(b) || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  type: (a, b) => typeKey(a) - typeKey(b) || colorKey(a) - colorKey(b) || cmc(a) - cmc(b) || a.name.localeCompare(b.name),
};
const mkFilters = () => ({ q: '', colors: new Set(), types: new Set(), costs: new Set(), legend: false, set: '', rarity: '', playable: false, inDeck: false, sort: 'color' });
const F = mkFilters();   // one filter state shared by Collection and Decks
let page = 1, gobs = null, bmode = 'collection', drawerOpen = false;

function filtered() {
  const q = F.q.trim().toLowerCase(), cur = deck();
  const list = uniq.filter((d) => {
    if (q && !(d.name.toLowerCase().includes(q) || (d.text || '').toLowerCase().includes(q) || d.type.toLowerCase().includes(q))) return false;
    if (F.colors.size) { const c = d.colors || []; if (![...F.colors].some((k) => (k === 'C' ? !c.length : k === 'M' ? c.length > 1 : c.includes(k)))) return false; }
    if (F.types.size && ![...F.types].some((t) => d.types.includes(t))) return false;
    if (F.costs.size && !F.costs.has(Math.min(cmc(d), 6))) return false;
    if (F.legend && !isLegend(d)) return false;
    if (F.set && !inSet(d, F.set)) return false;
    if (F.rarity && d.rarity !== F.rarity) return false;
    if (F.playable && !isImplemented(d)) return false;
    if (F.inDeck && !cur[d.name]) return false;
    return true;
  });
  const fn = SORT_FN[F.sort] || SORT_FN.color;
  return list.sort((a, b) => isImplemented(b) - isImplemented(a) || fn(a, b));
}
const activeCount = () => F.colors.size + F.types.size + F.costs.size + (F.legend ? 1 : 0) + (F.set ? 1 : 0) + (F.rarity ? 1 : 0) + (F.playable ? 1 : 0) + (F.inDeck ? 1 : 0) + (F.q ? 1 : 0);

const chip = (grp, val, label, on, cls = '') => `<button class="chip ${cls} ${on ? 'on' : ''}" data-g="${grp}" data-v="${val}">${label}</button>`;
function filterBar(building) {
  const colorChips = COLORS.map((c) => `<button class="cf ${c} ${F.colors.has(c) ? 'on' : ''}" data-g="color" data-v="${c}" title="${c === 'M' ? 'Multicolor' : c === 'C' ? 'Colorless' : { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]}" aria-label="${c}"></button>`).join('');
  const opts = (o, cur) => Object.entries(o).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v}</option>`).join('');
  return `<div class="ftop">
    <div class="search"><input id="q" placeholder="Search name or text…" value="${esc(F.q)}"><svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/></svg></div>
    <label class="sortl">Sort <select id="fsort">${opts(SORTS, F.sort)}</select></label>
    <button class="fbtn" data-fb="1">Filters<b id="fcnt"></b></button>
    <span class="rescount" id="rescount"></span>
    ${building ? '<button class="dkbtn" data-dk="1">Deck <b id="dkcnt"></b></button>' : ''}
  </div>
  <div class="fpanel" id="fpanel">
    <div class="fgrp colors">${colorChips}</div>
    <div class="fgrp costs"><span class="fl">Cost</span>${COSTS.map((n) => chip('cost', n, n === 6 ? '6+' : n, F.costs.has(n), 'sm')).join('')}</div>
    <div class="fgrp types">${TYPES.map((t) => chip('type', t, t, F.types.has(t))).join('')}${chip('legend', 'L', '&#9733; Legendary', F.legend)}</div>
    <div class="fgrp sels"><select id="fset">${opts({ '': 'All sets', LEA: 'Alpha', LEB: 'Beta', '2ED': 'Unlimited', ARN: 'Arabian Nights', ATQ: 'Antiquities', LEG: 'Legends' }, F.set)}</select>
      <select id="frar">${opts(RARITIES, F.rarity)}</select></div>
    <div class="fgrp tog">${chip('playable', 1, 'Playable only', F.playable, 'tg')}${building ? chip('indeck', 1, 'Only cards in deck', F.inDeck, 'tg') : ''}<button class="chip clr" data-g="clear">Clear filters</button></div>
  </div>`;
}
function cell(d) {
  const n = deck()[d.name] || 0, lim = copyLimit(d.name), ok = isImplemented(d), b = bmode === 'decks';
  return `<div class="cc ${ok ? '' : 'locked'} ${n ? 'in' : ''} ${isGold(d) ? 'gold' : ''} ${isLegend(d) ? 'leg' : ''}" data-n="${esc(d.name)}"><img loading="lazy" decoding="async" src="${d.art}" alt="${esc(d.name)}">${fmt() === 'restricted' && RESTRICTED.has(d.name) ? '<span class="rbadge" title="Restricted: 1 copy max">R</span>' : ''}${ok ? '' : '<span class="lock">Coming soon</span>'}${b && ok ? footHtml(n, lim) : ''}</div>`;
}
function footHtml(n, lim) {
  return `<div class="cfoot"><button class="cb" data-dec="1" ${n ? '' : 'disabled'} aria-label="Remove one">&minus;</button><span class="qty">x${n}</span><button class="cb" data-inc="1" ${n >= lim ? 'disabled' : ''} aria-label="Add one">+</button></div>`;
}
function updateTile(el) {
  const n = deck()[el.dataset.n] || 0, ft = $('.cfoot', el);
  el.classList.toggle('in', n > 0);
  if (ft) { const t = document.createElement('div'); t.innerHTML = footHtml(n, copyLimit(el.dataset.n)); ft.replaceWith(t.firstElementChild); }
}
// paged grid: first PAGE cards, the rest appended when the sentinel scrolls into view
let curList = [];
function gridHtml() {
  if (!curList.length) return '<p class="muted pad">No cards match these filters.</p>';
  return curList.slice(0, page * PAGE).map(cell).join('') + (curList.length > page * PAGE ? `<div class="gmore" id="gmore">${curList.length - page * PAGE} more…</div>` : '');
}
function loadMore() {
  const g = $('#cgrid'), m = $('#gmore'); if (!g || !m) return;
  const from = page * PAGE; page++; m.remove();
  g.insertAdjacentHTML('beforeend', curList.slice(from, page * PAGE).map(cell).join('') + (curList.length > page * PAGE ? `<div class="gmore" id="gmore">${curList.length - page * PAGE} more…</div>` : ''));
  watchMore();
}
function watchMore() {
  gobs?.disconnect(); const m = $('#gmore'); if (!m || !window.IntersectionObserver) return;
  gobs = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { gobs.disconnect(); loadMore(); } }, { root: $('#cgrid'), rootMargin: '600px' }); gobs.observe(m);
}
function refreshGrid(keep) {
  const g = $('#cgrid'); if (!g) return; const st = keep ? g.scrollTop : 0;
  curList = filtered(); page = 1; g.innerHTML = gridHtml(); g.scrollTop = st; watchMore();
  $('#rescount').textContent = `${curList.length} card${curList.length === 1 ? '' : 's'}`;
  const a = activeCount(); $('#fcnt').textContent = a ? ' · ' + a : '';
  $('.clr').disabled = !a;
}
function syncChips(root) {
  root.querySelectorAll('[data-g]').forEach((b) => {
    const g = b.dataset.g, v = b.dataset.v; let on = null;
    if (g === 'color') on = F.colors.has(v); else if (g === 'cost') on = F.costs.has(+v); else if (g === 'type') on = F.types.has(v);
    else if (g === 'legend') on = F.legend; else if (g === 'playable') on = F.playable; else if (g === 'indeck') on = F.inDeck;
    if (on !== null) b.classList.toggle('on', on);
  });
}

// the deck panel (right column on wide screens, slide-over drawer on phones)
function deckPanelInner() {
  const rows = entries().map(([n, c]) => ({ n, c, d: byName[n][0] })).sort((a, b) => isLand(a.d) - isLand(b.d) || cmc(a.d) - cmc(b.d) || a.n.localeCompare(b.n));
  const t = total(), curve = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) if (!isLand(r.d)) curve[Math.min(cmc(r.d), 6)] += r.c;
  const cmax = Math.max(1, ...curve);
  const curveHtml = `<div class="curve" title="Mana curve (non-land cards)">${curve.map((v, i) => `<div class="cb2"><span class="cn">${v || ''}</span><i style="height:${Math.round((v / cmax) * 100)}%"></i><span class="cl">${i === 6 ? '6+' : i}</span></div>`).join('')}</div>`;
  return `<div class="dph"><div class="dname">${deckSelect()}</div><button class="dx" data-dk="1" aria-label="Close deck">&times;</button></div>
  <div class="dsub"><span class="dcount ${t < MIN_DECK ? 'bad' : ''}">${t} / ${MIN_DECK}+ cards</span><span class="fmtbadge ${fmt()}">${fmtName()}</span>${deckTools()}</div>
  ${fmtSeg()}${(() => { const pr = deckProblem(Object.fromEntries(entries())); return pr ? `<div class="illegal">${esc(pr.replace(/^Not legal in/, 'Illegal in'))}</div>` : ''; })()}
  ${curveHtml}
  <div class="dlist">${rows.map((r) => `<div class="drow" data-rm="${esc(r.n)}" data-n="${esc(r.n)}" title="Click to remove one copy"><span class="dc">${r.c}</span><span class="dn">${esc(r.n)}</span><span class="dcost">${costHtml(r.d.manaCost)}</span></div>`).join('') || '<p class="muted pad">Empty deck. Click cards in the catalogue to add them.</p>'}</div>
  <div class="dfoot">${playBtn()}<button class="ghost done" data-act="done">Done</button></div>`;
}
function refreshDeck() {
  const p = $('#v-decks .dpanel2'); if (!p) return; const ls = $('.dlist', p)?.scrollTop || 0;
  p.innerHTML = deckPanelInner(); const l = $('.dlist', p); if (l) l.scrollTop = ls;
  const c = $('#dkcnt'); if (c) { c.textContent = `${total()}/${MIN_DECK}+`; c.parentElement.classList.toggle('bad', total() < MIN_DECK); }
}

function renderBrowser(mode) {
  bmode = mode; const building = mode === 'decks', root = $('#v-' + mode);
  gobs?.disconnect(); drawerOpen = false;
  root.innerHTML = `<div class="bw ${building ? 'building' : ''}"><div class="bmain">${filterBar(building)}<div class="grid" id="cgrid"></div></div>${building ? `<aside class="dpanel2">${deckPanelInner()}</aside><div class="dbackdrop" data-dk="1"></div>` : ''}</div>`;
  const setDrawer = (v) => { drawerOpen = v; $('.bw', root).classList.toggle('dopen', v); };
  const bw = $('.bw', root);
  $('#cgrid').addEventListener('scroll', (e) => { const g = e.target; if ($('#gmore') && g.scrollTop + g.clientHeight > g.scrollHeight - 700) loadMore(); }, { passive: true });
  $('#q').oninput = (e) => { F.q = e.target.value; refreshGrid(); };
  $('#fsort').onchange = (e) => { F.sort = e.target.value; refreshGrid(); };
  $('#fset').onchange = (e) => { F.set = e.target.value; refreshGrid(); };
  $('#frar').onchange = (e) => { F.rarity = e.target.value; refreshGrid(); };
  const syncSelects = () => { $('#q').value = F.q; $('#fsort').value = F.sort; $('#fset').value = F.set; $('#frar').value = F.rarity; };
  root.onclick = (e) => {
    const t = e.target;
    if (bw.classList.contains('fopen') && !t.closest('#fpanel') && !t.closest('[data-fb]')) { bw.classList.remove('fopen'); if (t.closest('#cgrid')) return; }
    const fb = t.closest('[data-fb]'); if (fb) { bw.classList.toggle('fopen'); return; }
    if (t.closest('[data-dk]')) { setDrawer(!drawerOpen); return; }
    const ch = t.closest('[data-g]');
    if (ch) {
      const g = ch.dataset.g, v = ch.dataset.v, tog = (s, k) => (s.has(k) ? s.delete(k) : s.add(k));
      if (g === 'color') tog(F.colors, v); else if (g === 'cost') tog(F.costs, +v); else if (g === 'type') tog(F.types, v);
      else if (g === 'legend') F.legend = !F.legend; else if (g === 'playable') F.playable = !F.playable; else if (g === 'indeck') F.inDeck = !F.inDeck;
      else if (g === 'clear') { const s = F.sort; Object.assign(F, mkFilters(), { sort: s }); syncSelects(); }
      syncChips(root); refreshGrid(); return;
    }
    const r = t.closest('[data-rm]');
    if (r) { remove(r.dataset.rm); refreshDeck(); const el = $(`#cgrid [data-n="${CSS.escape(r.dataset.rm)}"]`); if (el) { if (F.inDeck && !deck()[r.dataset.rm]) refreshGrid(true); else updateTile(el); } else if (F.inDeck) refreshGrid(true); return; }
    const c = t.closest('.cc'); if (!c) return;
    if (!building) { bigView(c.dataset.n); return; }
    if (t.closest('[data-dec]')) remove(c.dataset.n); else add(c.dataset.n);
    if (F.inDeck && !deck()[c.dataset.n]) { c.remove(); $('#rescount').textContent = `${$('#cgrid').querySelectorAll('.cc').length} cards`; } else updateTile(c);
    refreshDeck();
  };
  refreshGrid(); if (building) { refreshDeck(); shortNotice(); }
}
const renderCollection = () => renderBrowser('collection');
const renderDecks = () => renderBrowser('decks');
