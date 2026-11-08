// Deck tile: assets/ui/deck_tile_frame.png over a window of real card artwork (art crops of the deck's key cards),
// a colour-identity tint, mana symbols and a name plate. Pure HTML builder (CSS in css/menu.css, .dtile*).
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const COLORS = ['W', 'U', 'B', 'R', 'G'];
const SKIP = /^(Mox |Black Lotus|Sol Ring|Mana Vault|Time Walk|Ancestral Recall|Timetwister|Library of Alexandria|Channel|Mana Crypt|Demonic Tutor|Wheel of Fortune)/;
// key cards: DECK_META.keyCards when given, else the most impactful non-land, non-mana-artifact cards (creatures and high cost first)
export function keyCardsOf(counts, byName, meta) {
  if (meta?.keyCards?.length) return meta.keyCards.filter((n) => byName[n]).slice(0, 3);
  const sc = [];
  for (const [n, c] of Object.entries(counts || {})) {
    if (n[0] === '_' || SKIP.test(n)) continue; const d = byName[n]?.[0]; if (!d || d.types.includes('Land')) continue;
    let cmc = 0; for (const m of (d.manaCost || '').matchAll(/\{([^}]+)\}/g)) cmc += /^\d+$/.test(m[1]) ? +m[1] : m[1] === 'X' ? 0 : 1;
    sc.push([n, (d.types.includes('Creature') ? 3 : 0) + Math.min(cmc, 7) + c * 0.6 + (d.rarity === 'rare' ? 1.5 : 0)]);
  }
  return sc.sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
}
export function colorsOf(counts, byName) {
  const set = new Set(); for (const n of Object.keys(counts || {})) if (n[0] !== '_') (byName[n]?.[0]?.colors || []).forEach((c) => set.add(c)); return COLORS.filter((c) => set.has(c));
}
const TINT = { W: '#fff0b0', U: '#4aa0ea', B: '#7a5ca0', R: '#ee5a3a', G: '#4caf62' };
export function tintOf(cols) {
  if (!cols.length) return 'radial-gradient(#0000,#0008)';
  if (cols.length === 1) return `linear-gradient(to top,${TINT[cols[0]]}99 0%,#0000 55%)`;
  if (cols.length > 2) return `linear-gradient(to top,#e0b84a99 0%,#0000 55%)`;   // gold
  return `linear-gradient(to top right,${TINT[cols[0]]}88 0%,#0000 50%),linear-gradient(to top left,${TINT[cols[1]]}88 0%,#0000 50%)`;
}
const stars = (r) => { const n = Math.max(1, Math.min(5, Math.round((r || 50) / 20))); return '★'.repeat(n) + '☆'.repeat(5 - n); };
// info: {name, counts, colors?, archetype?, rating?, keyCards?, size?}  opts: {sel, cls, note}
export function tileHtml(info, byName, opts = {}) {
  const cols = info.colors?.length ? info.colors : colorsOf(info.counts, byName); const keys = keyCardsOf(info.counts, byName, info);
  const arts = (keys.length ? keys : []).map((n) => byName[n][0].art);
  const win = arts.length >= 3 ? arts.slice(0, 3).map((a) => `<span class="dta"><img loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async" src="${esc(a)}" alt=""></span>`).join('')
    : arts.length ? `<span class="dta one"><img loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async" src="${esc(arts[0])}" alt=""></span>` : '<span class="dta one empty"></span>';
  const mana = info.noMana ? '' : (cols.length ? cols : ['C']).map((c) => `<img src="assets/ui/mana/${c}.png" alt="${c}">`).join('');
  const sub = [info.archetype, info.size ? `${info.size} cards` : ''].filter(Boolean).join(' · ');
  return `<div class="dtile ${opts.cls || ''} ${opts.sel ? 'sel' : ''}" ${opts.attrs || ''}>
    <div class="dtwin">${win}<i class="dtint" style="background:${tintOf(cols)}"></i><i class="dtvig"></i><span class="dtmana">${mana}</span></div>
    <img class="dtframe" src="assets/ui/deck_tile_frame.png" alt="" draggable="false">
    <div class="dtplate"><b class="dtname">${esc(info.name)}</b><span class="dtsub">${esc(sub)}</span>${info.rating != null ? `<span class="dtstars" title="Deck strength">${stars(info.rating)}</span>` : ''}${opts.note ? `<span class="dtnote">${esc(opts.note)}</span>` : ''}</div>
  </div>`;
}
