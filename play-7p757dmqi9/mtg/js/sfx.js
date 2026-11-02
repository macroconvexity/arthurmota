// Synthesized sound effects (Web Audio only: oscillators, filtered noise, gain envelopes).
// No audio files, no network. Safe to import under node (everything is lazy).
const KEY = 'mtgc.sfx';
const MAX_VOICES = 12;
let ctx = null, master = null, comp = null, noiseBuf = null;
let enabled = true, volume = 0.7;
let voices = []; // end times (ctx seconds)

try { const s = JSON.parse(globalThis.localStorage?.getItem(KEY) || 'null'); if (s) { if (typeof s.enabled === 'boolean') enabled = s.enabled; if (typeof s.volume === 'number') volume = Math.min(1, Math.max(0, s.volume)); } } catch (e) { /* storage unavailable */ }
const save = () => { try { globalThis.localStorage?.setItem(KEY, JSON.stringify({ enabled, volume })); } catch (e) { /* ignore */ } };

function ensure() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return null;
  try {
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = volume * 0.8;
    master.connect(comp); comp.connect(ctx.destination);
  } catch (e) { ctx = null; }
  return ctx;
}
function noise() {
  if (noiseBuf) return noiseBuf;
  const n = Math.floor(ctx.sampleRate * 1.3 || 44100), b = ctx.createBuffer(1, n, ctx.sampleRate || 44100), d = b.getChannelData(0);
  let s = 12345; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
  return (noiseBuf = b);
}
const act = () => { const now = ctx.currentTime; voices = voices.filter((e) => e > now); return voices.length; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Envelope: fast attack, exponential decay. Peak kept <= 0.5 per voice.
function env(g, t, dur, vol, atk = 0.005) {
  const p = g.gain; p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(Math.max(0.0002, vol), t + atk);
  p.exponentialRampToValueAtTime(0.0001, t + dur);
}
function tone(t, { f = 440, f2, dur = 0.2, type = 'sine', vol = 0.2, atk = 0.005, detune = 0, lp } = {}, P) {
  if (act() >= MAX_VOICES) return;
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  const fa = f * P.pitch; o.frequency.setValueAtTime(fa, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2 * P.pitch), t + dur);
  if (detune) o.detune.value = detune;
  env(g, t, dur, vol * P.volume, atk);
  let out = o; if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); out = fl; }
  out.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02); voices.push(t + dur + 0.02);
}
function hiss(t, { dur = 0.15, vol = 0.2, type = 'bandpass', f = 2000, f2, q = 1, atk = 0.004 } = {}, P) {
  if (act() >= MAX_VOICES) return;
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise(); fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f * P.pitch, t); if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2 * P.pitch), t + dur);
  env(g, t, dur, vol * P.volume, atk);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t, 0, Math.min(dur + 0.02, 1.2)); s.stop(t + dur + 0.02); voices.push(t + dur + 0.02);
}
const thump = (t, P, f = 110, vol = 0.45, dur = 0.18) => tone(t, { f, f2: f * 0.4, dur, vol, atk: 0.003 }, P);
const chime = (t, P, f, vol = 0.14, dur = 0.7) => { tone(t, { f, dur, vol, atk: 0.006 }, P); tone(t, { f: f * 2.01, dur: dur * 0.6, vol: vol * 0.35, atk: 0.006 }, P); };

const S = {
  draw: (t, P) => { hiss(t, { dur: 0.09, vol: 0.16, f: 5200, f2: 2400, q: 0.8 }, P); tone(t, { f: 900, f2: 500, dur: 0.05, vol: 0.04, type: 'triangle' }, P); },
  deal: (t, P) => { hiss(t, { dur: 0.07, vol: 0.12, f: 4200, f2: 2800, q: 0.8 }, P); tone(t + 0.02, { f: 260, f2: 160, dur: 0.07, vol: 0.12, type: 'triangle' }, P); },
  land: (t, P) => { thump(t, P, 150, 0.4, 0.2); hiss(t, { dur: 0.1, vol: 0.1, type: 'lowpass', f: 700 }, P); },
  cast: (t, P) => { [0, 1, 2, 3, 4].forEach((i) => tone(t + i * 0.07, { f: 500 * 1.26 ** i, dur: 0.3, vol: 0.09, type: 'triangle' }, P)); hiss(t, { dur: 0.45, vol: 0.07, f: 1200, f2: 6000, q: 2 }, P); },
  resolve: (t, P) => { chime(t, P, 880, 0.13, 0.55); chime(t + 0.09, P, 1320, 0.08, 0.5); },
  creature: (t, P) => { hiss(t, { dur: 0.4, vol: 0.2, f: 300, f2: 1200, q: 0.9, atk: 0.12 }, P); thump(t + 0.22, P, 95, 0.5, 0.25); },
  attack: (t, P) => { hiss(t, { dur: 0.5, vol: 0.12, f: 2500, f2: 5000, q: 6, atk: 0.25 }, P); tone(t, { f: 180, f2: 360, dur: 0.5, vol: 0.12, type: 'sawtooth', lp: 1200, atk: 0.25 }, P); tone(t, { f: 270, f2: 540, dur: 0.5, vol: 0.07, type: 'sawtooth', lp: 1500, atk: 0.25 }, P); },
  hit: (t, P) => { thump(t, P, 130, 0.45, 0.16); hiss(t, { dur: 0.07, vol: 0.22, type: 'highpass', f: 2500 }, P); },
  heavy: (t, P) => { thump(t, P, 80, 0.55, 0.35); hiss(t, { dur: 0.14, vol: 0.28, type: 'highpass', f: 1800 }, P); hiss(t, { dur: 0.3, vol: 0.14, type: 'lowpass', f: 500 }, P); tone(t, { f: 50, dur: 0.4, vol: 0.2 }, P); },
  damage: (t, P) => { thump(t, P, 100, 0.42, 0.22); hiss(t, { dur: 0.12, vol: 0.12, type: 'lowpass', f: 900 }, P); },
  heal: (t, P) => { chime(t, P, 523.25, 0.12, 0.8); chime(t + 0.1, P, 659.25, 0.11, 0.8); chime(t + 0.2, P, 783.99, 0.1, 0.9); },
  counter: (t, P) => { tone(t, { f: 1400, f2: 120, dur: 0.4, vol: 0.14, type: 'sawtooth', lp: 2500 }, P); hiss(t, { dur: 0.3, vol: 0.1, f: 4000, f2: 400, q: 3 }, P); },
  destroy: (t, P) => { hiss(t, { dur: 0.7, vol: 0.22, type: 'lowpass', f: 3000, f2: 200, q: 0.7 }, P); hiss(t + 0.05, { dur: 0.25, vol: 0.12, type: 'highpass', f: 3500 }, P); thump(t, P, 90, 0.3, 0.3); },
  exile: (t, P) => { hiss(t, { dur: 0.9, vol: 0.14, f: 5000, f2: 800, q: 1.5, atk: 0.1 }, P); tone(t, { f: 700, f2: 300, dur: 0.8, vol: 0.06 }, P); },
  bolt: (t, P) => { hiss(t, { dur: 0.3, vol: 0.28, type: 'highpass', f: 3000, q: 0.7, atk: 0.002 }, P); hiss(t + 0.05, { dur: 0.15, vol: 0.2, f: 6000, q: 3 }, P); tone(t, { f: 2200, f2: 300, dur: 0.18, vol: 0.1, type: 'square', lp: 3000 }, P); thump(t + 0.1, P, 120, 0.3, 0.2); },
  sweeper: (t, P) => { tone(t, { f: 60, f2: 30, dur: 1.1, vol: 0.5, atk: 0.01 }, P); hiss(t, { dur: 1.1, vol: 0.3, type: 'lowpass', f: 800, f2: 90, q: 0.7 }, P); thump(t + 0.02, P, 70, 0.45, 0.5); },
  drawmany: (t, P) => { for (let i = 0; i < 5; i++) S.draw(t + i * 0.07, { ...P, volume: P.volume * 0.8, pitch: P.pitch * (1 + i * 0.03) }); },
  tap: (t, P) => { tone(t, { f: 1800, f2: 1200, dur: 0.03, vol: 0.1, type: 'square', lp: 3000 }, P); },
  untap: (t, P) => { tone(t, { f: 1100, f2: 1700, dur: 0.035, vol: 0.09, type: 'square', lp: 3000 }, P); },
  click: (t, P) => { tone(t, { f: 1300, f2: 900, dur: 0.04, vol: 0.12, type: 'triangle' }, P); },
  turn: (t, P) => { [1, 2.76, 5.4].forEach((m, i) => tone(t, { f: 180 * m, dur: 1.1 - i * 0.25, vol: [0.22, 0.1, 0.05][i], atk: 0.004 }, P)); },
  opp: (t, P) => { tone(t, { f: 196, dur: 0.5, vol: 0.14, type: 'triangle', atk: 0.04 }, P); tone(t + 0.12, { f: 147, dur: 0.6, vol: 0.12, type: 'triangle', atk: 0.04 }, P); },
  phase: (t, P) => { tone(t, { f: 1000, dur: 0.025, vol: 0.06, type: 'triangle' }, P); },
  victory: (t, P) => { [[523.25, 0], [659.25, 0.16], [783.99, 0.32], [1046.5, 0.5]].forEach(([f, d], i) => { tone(t + d, { f, dur: i === 3 ? 1.6 : 0.4, vol: 0.14, type: 'triangle', atk: 0.01, lp: 3500 }, P); tone(t + d, { f: f / 2, dur: i === 3 ? 1.6 : 0.4, vol: 0.1, type: 'sawtooth', lp: 900, atk: 0.01 }, P); }); chime(t + 0.5, P, 2093, 0.06, 1.8); },
  defeat: (t, P) => { [[392, 0], [349.2, 0.3], [311.1, 0.6], [261.6, 0.9]].forEach(([f, d], i) => tone(t + d, { f, dur: i === 3 ? 1.6 : 0.5, vol: 0.14, type: 'triangle', lp: 1500, atk: 0.02 }, P)); },
  error: (t, P) => { tone(t, { f: 110, dur: 0.18, vol: 0.14, type: 'sawtooth', lp: 700 }, P); tone(t, { f: 117, dur: 0.18, vol: 0.1, type: 'square', lp: 600 }, P); },
  open: (t, P) => { tone(t, { f: 500, f2: 900, dur: 0.12, vol: 0.09, type: 'triangle' }, P); hiss(t, { dur: 0.1, vol: 0.05, f: 3000, f2: 6000 }, P); },
  close: (t, P) => { tone(t, { f: 900, f2: 450, dur: 0.12, vol: 0.09, type: 'triangle' }, P); hiss(t, { dur: 0.1, vol: 0.05, f: 6000, f2: 3000 }, P); },
};
const NAMES = {
  draw: 'draw', deal: 'deal', land: 'land', cast: 'cast', resolve: 'resolve', creature: 'creature', attack: 'attack', hit: 'hit', heavy: 'heavy',
  damage: 'damage', heal: 'heal', counter: 'counter', destroy: 'destroy', exile: 'exile', bolt: 'bolt', sweeper: 'sweeper', drawmany: 'drawmany',
  tap: 'tap', untap: 'untap', click: 'click', turn: 'turn', opp: 'opp', phase: 'phase', victory: 'victory', defeat: 'defeat', error: 'error', open: 'open', close: 'close',
};

export const sfx = {
  names: Object.keys(NAMES),
  /** Call from a user gesture (pointerdown/keydown/touchend). Creates and resumes the context. */
  init() { const c = ensure(); try { if (c && c.state !== 'running') { const p = c.resume(); p?.catch?.(() => {}); } } catch (e) { /* ignore */ } return !!c; },
  play(name, opts = {}) {
    if (!enabled || !S[name]) return false;
    try {
      const c = ensure(); if (!c) return false;
      if (c.state === 'suspended') c.resume?.()?.catch?.(() => {});
      const P = { pitch: clamp(opts.pitch ?? 1, 0.25, 4), volume: clamp(opts.volume ?? 1, 0, 1) };
      if (P.volume === 0 || volume === 0) return false;
      S[name](c.currentTime + 0.005, P); return true;
    } catch (e) { return false; }
  },
  setEnabled(b) { enabled = !!b; save(); },
  isEnabled() { return enabled; },
  setVolume(v) { volume = clamp(Number(v) || 0, 0, 1); if (master) master.gain.value = volume * 0.8; save(); },
  getVolume() { return volume; },
};
export default sfx;
