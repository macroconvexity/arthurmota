// Full-screen flow overlays (no game logic): opponent picker, coin flip, mulligan, onboarding coach marks.
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
function layer(cls, html) { const d = document.createElement('div'); d.className = 'scr ' + cls; d.innerHTML = html; document.body.appendChild(d); return d; }
const COL = { W: '#f6efc8', U: '#6fb4ea', B: '#7d7480', R: '#ee7a5c', G: '#6cbd78' };

// decks: the PLAYER's decks that are legal for the chosen format + edition: [{name, tile (HTML from decktile.js)}].
// badge: e.g. 'Restricted · Alpha' (read-only, chosen on Home). Returns {mine, level} or null when cancelled.
export function showPicker(decks, level = 'normal', current = null, badge = '', hidden = 0) {
  return new Promise((resolve) => {
    let sel = decks.some((d) => d.name === current && d.ok !== false) ? current : decks.find((d) => d.ok !== false)?.name ?? null;
    const el = layer('picker', `<div class="scrbox pickbox2"><h2>Choose your deck</h2><div class="pickctl"><span class="fmtbadges">${esc(badge)}</span><div class="lvl">${['easy', 'normal', 'hard'].map((l) => `<button data-l="${l}" class="${l === level ? 'on' : ''}">${l[0].toUpperCase() + l.slice(1)}</button>`).join('')}</div></div>
      <div class="oppnote">Opponent: random deck, legal in the same format and edition</div>
      <div class="tiles dtiles">${decks.map((d) => `<button class="tbtn ${d.name === sel ? 'sel' : ''} ${d.ok === false ? 'bad' : ''}" data-n="${esc(d.name)}" ${d.ok === false ? 'disabled' : ''}>${d.tile}</button>`).join('') || '<p class="muted">No deck is legal for this format and edition. Change them on Home or edit a deck.</p>'}</div>
      ${hidden ? `<div class="oppnote">${hidden} deck${hidden > 1 ? 's' : ''} hidden (not legal here)</div>` : ''}
      <div class="scrbtns"><button class="no">Back</button><button class="yes" ${sel ? '' : 'disabled'}>Play</button></div></div>`);
    const go = el.querySelector('.yes'), tiles = el.querySelector('.tiles'); const done = (v) => { el.remove(); resolve(v); };
    el.querySelector('.lvl').onclick = (e) => { const l = e.target.closest('[data-l]'); if (!l) return; level = l.dataset.l; el.querySelectorAll('[data-l]').forEach((x) => x.classList.toggle('on', x === l)); };
    tiles.onclick = (e) => { const b = e.target.closest('.tbtn'); if (!b || b.disabled) return; sel = b.dataset.n; tiles.querySelectorAll('.tbtn').forEach((x) => x.classList.toggle('sel', x === b)); tiles.querySelectorAll('.dtile').forEach((x) => x.classList.toggle('sel', x.parentElement.classList.contains('sel'))); go.disabled = false; if (e.detail === 2) go.click(); };
    go.onclick = () => done({ mine: sel, level });
    el.querySelector('.no').onclick = () => done(null);
    tiles.querySelectorAll('.tbtn.sel .dtile').forEach((x) => x.classList.add('sel')); tiles.querySelector('.tbtn.sel')?.scrollIntoView?.({ block: 'center', inline: 'center' });
  });
}

export function showCoin(youFirst) {
  return new Promise((resolve) => {
    const el = layer('coin', `<div class="coinwrap"><div class="coin ${youFirst ? 'heads' : 'tails'}"><i class="f1">YOU</i><i class="f2">OPP</i></div><div class="coinmsg"></div></div>`);
    const done = () => { el.remove(); resolve(); }; el.onclick = done;
    setTimeout(() => { el.querySelector('.coinmsg').textContent = youFirst ? 'You go first' : 'Opponent goes first'; el.classList.add('shown'); }, 1700);
    setTimeout(done, 2900);
  });
}

// hand: [def]; mulls: how many mulligans already taken. Resolves 'keep' | 'mull'
export function showMulligan(hand, mulls, canMull = true) {
  return new Promise((resolve) => {
    const el = layer('mull', `<div class="scrbox wide"><h2>${mulls ? `Mulligan ${mulls}` : 'Opening hand'}</h2><p>${mulls ? `Keep this hand and put ${mulls} card${mulls > 1 ? 's' : ''} on the bottom of your library, or mulligan again.` : 'Keep this hand or take a mulligan (draw 7 new cards, then bottom one).'}</p>
      <div class="mhand">${hand.map((d, i) => `<img src="${esc(d.art)}" alt="${esc(d.name)}" style="animation-delay:${i * 80}ms" draggable="false">`).join('')}</div>
      <div class="scrbtns">${canMull ? '<button class="no">Mulligan</button>' : ''}<button class="yes">Keep</button></div></div>`);
    const done = (v) => { el.remove(); resolve(v); };
    el.querySelector('.yes').onclick = () => done('keep'); el.querySelector('.no')?.addEventListener('click', () => done('mull'));
  });
}

// steps: [{title, text, target: () => Element|null}]; resolves when finished/skipped
export function runCoach(steps, startAt = 0) {
  return new Promise((resolve) => {
    let i = startAt;
    const ring = document.createElement('div'); ring.className = 'coachring'; document.body.appendChild(ring);
    const box = layer('coach', '<div class="cbox"><div class="cstep"></div><b class="ctitle"></b><p class="ctext"></p><div class="cbtns"><button class="skip">Skip</button><button class="next">Next</button></div></div>');
    const finish = () => { ring.remove(); box.remove(); removeEventListener('resize', place); resolve(); };
    function place() {
      const s = steps[i]; const t = s.target?.(); box.querySelector('.cstep').textContent = `${i + 1} / ${steps.length}`; box.querySelector('.ctitle').textContent = s.title; box.querySelector('.ctext').textContent = s.text;
      box.querySelector('.next').textContent = i === steps.length - 1 ? 'Done' : 'Next';
      if (t) { const r = t.getBoundingClientRect(); Object.assign(ring.style, { display: 'block', left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' }); box.classList.toggle('top', r.top > innerHeight * 0.5); } else ring.style.display = 'none';
    }
    box.querySelector('.next').onclick = () => { if (++i >= steps.length) finish(); else place(); };
    box.querySelector('.skip').onclick = finish; addEventListener('resize', place); place();
  });
}
