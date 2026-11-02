// In-page replacements for confirm()/prompt(): embedded browsers often block the native ones.
export function modal(build, { esc = true } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div'); wrap.className = 'dlg';
    const box = document.createElement('div'); box.className = 'dlgbox'; wrap.appendChild(box);
    const close = (v) => { if (!window.__fxOff && wrap.querySelector('.opt')) { wrap.classList.remove('dlg'); wrap.classList.add('dlgx'); setTimeout(() => wrap.remove(), 330 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--as')) || 1)); } else wrap.remove(); document.removeEventListener('keydown', key, true); resolve(v); };
    const key = (e) => { if (e.key === 'Escape' && esc) close(null); };
    document.addEventListener('keydown', key, true);
    build(box, close); document.body.appendChild(wrap);
    if (esc) wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(null); });
  });
}
export const askConfirm = (text, yes = 'Yes', no = 'Cancel') => modal((box, close) => {
  box.innerHTML = `<p>${text}</p><div class="dlgbtns"><button class="no">${no}</button><button class="yes">${yes}</button></div>`;
  box.querySelector('.no').onclick = () => close(false); box.querySelector('.yes').onclick = () => close(true); box.querySelector('.yes').focus();
}).then((v) => !!v);
export const askText = (text, value = '') => modal((box, close) => {
  box.innerHTML = `<p>${text}</p><input type="text" value=""><div class="dlgbtns"><button class="no">Cancel</button><button class="yes">OK</button></div>`;
  const inp = box.querySelector('input'); inp.value = value; setTimeout(() => { inp.focus(); inp.select(); });
  inp.onkeydown = (e) => { if (e.key === 'Enter') close(inp.value); };
  box.querySelector('.no').onclick = () => close(null); box.querySelector('.yes').onclick = () => close(inp.value);
});

const e$ = (t) => String(t ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
// Number chooser (X costs, "choose a number"). Resolves to an integer, or null when cancelled (only if cancelable).
export const askNumber = (text, min, max, { value = max, cancelable = true, yes = 'OK' } = {}) => modal((box, close) => {
  let v = Math.max(min, Math.min(max, value));
  box.classList.add('numbox');
  box.innerHTML = `<p>${text}</p><div class="stepper"><button class="m" aria-label="less">-</button><b class="val"></b><button class="pl" aria-label="more">+</button></div>${max > min ? `<input type="range" min="${min}" max="${max}" value="${v}">` : ''}<div class="dlgbtns">${cancelable ? '<button class="no">Cancel</button>' : ''}<button class="yes">${yes}</button></div>`;
  const val = box.querySelector('.val'), rng = box.querySelector('input');
  const set = (n) => { v = Math.max(min, Math.min(max, n)); val.textContent = v; if (rng) rng.value = v; };
  set(v);
  box.querySelector('.m').onclick = () => set(v - 1); box.querySelector('.pl').onclick = () => set(v + 1);
  if (rng) rng.oninput = () => set(+rng.value);
  box.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') set(v - 1); if (e.key === 'ArrowRight' || e.key === 'ArrowUp') set(v + 1); if (e.key === 'Enter') close(v); });
  if (cancelable) box.querySelector('.no').onclick = () => close(null);
  box.querySelector('.yes').onclick = () => close(v); box.querySelector('.yes').focus();
}, { esc: cancelable });
// Option picker. options: [{value,label,card?}] (card = card def, shows its art). Resolves to an array of values (min..max), or null when cancelled.
export const askPick = (text, options, { min = 1, max = 1, cancelable = false, yes = 'Confirm' } = {}) => modal((box, close) => {
  box.classList.add('pickbox'); const sel = new Set();
  const hasCards = options.some((o) => o.card);
  box.innerHTML = `<p>${text}${max > 1 || min !== 1 ? `<small> (choose ${min === max ? min : `${min} to ${max === Infinity ? options.length : max}`})</small>` : ''}</p><div class="opts ${hasCards ? 'cards' : 'list'}">${options.map((o, i) => `<button class="opt" style="--i:${i}" data-i="${i}" title="${e$(o.label)}">${o.card ? `<img src="${e$(o.card.art)}" draggable="false"><span>${e$(o.label)}</span>` : e$(o.label)}</button>`).join('')}</div><div class="dlgbtns">${cancelable ? '<button class="no">Cancel</button>' : ''}<button class="yes">${yes}</button></div>`;
  const ok = box.querySelector('.yes');
  const upd = () => { box.querySelectorAll('.opt').forEach((b) => b.classList.toggle('sel', sel.has(+b.dataset.i))); ok.disabled = sel.size < min || sel.size > max; };
  box.querySelector('.opts').onclick = (e) => {
    const b = e.target.closest('.opt'); if (!b) return; const i = +b.dataset.i;
    if (sel.has(i)) sel.delete(i); else { if (max === 1) sel.clear(); if (sel.size < max) sel.add(i); }
    upd(); if (max === 1 && min === 1 && !hasCards && sel.size === 1 && e.detail === 2) close([options[i].value]);
  };
  if (cancelable) box.querySelector('.no').onclick = () => close(null);
  ok.onclick = () => close([...sel].sort((a, b) => a - b).map((i) => options[i].value));
  if (!options.length || min === 0) ok.disabled = false; upd();
}, { esc: cancelable });
