/* Cruzamento: audio. Dono: agente AUDIO. Sintese WebAudio pura, sem arquivos.
 * Contrato: ARCHITECTURE.md, secao "Audio". Nao toca DOM alem de
 * document.addEventListener('visibilitychange'). Tudo em try/catch. */
(function (root) {
  'use strict';
  var CRZ = root.CRZ = root.CRZ || {};

  // ---------- constantes de som ----------
  var MASTER_VOL = 0.25;
  var PENTA = [0, 2, 4, 7, 9];          // pentatonica maior (semitons)
  var BASE_MIDI = 60;                   // Do4; 2 oitavas = 10 notas
  var NOTE_COUNT = 10;
  var X_MIN = -900, X_MAX = 900;        // CFG.worldRadius

  var ARRIVE_MAX_PER_SEC = 6;
  var ARRIVE_DUR = 0.1;                 // s (80 a 120 ms)
  var ARRIVE_VOL = 0.5;
  var ARRIVE_TRI_MIX = 0.35;            // parte triangulo
  var ARRIVE_DETUNE_CENTS = 3;          // variacao minima

  var LIGHT_MAX_PER_SEC = 2, LIGHT_VOL = 0.05;
  var PASS_MAX_PER_SEC = 3, PASS_VOL = 0.02, PASS_FREQ = 140;
  var STRESS_MIN = 0.8, STRESS_GAP = 0.4, STRESS_VOL = 0.12, STRESS_FREQ = 880;
  var GRIDLOCK_F0 = 220, GRIDLOCK_F1 = 98, GRIDLOCK_DUR = 0.9, GRIDLOCK_VOL = 0.4;
  var PED_VOL = 0.18;
  var SAME_SOUND_GAP = 0.03;            // s minimo entre dois play() do mesmo nome

  // eco / reverb simples
  var ECHO_TIME = 0.19, ECHO_FEEDBACK = 0.32, ECHO_WET = 0.28, ECHO_LP = 2400;

  // limites de robustez (Safari iOS)
  var MAX_VOICES = 24;                  // teto global de vozes (osciladores) ativas
  var NAME_GAP = { deny: 0.15, select: 0.15 };  // intervalo minimo proprio por nome (s)
  var PED_MAX_PER_SEC = 3;

  // ambiente: drone grave DESLIGADO por padrao (preferencia do dono: musica desligada)
  var AMB_ENABLED = false;
  var AMB_FREQS = [65.41, 98.0, 130.81];  // Do2, Sol2, Do3
  var AMB_BASE = 0.012, AMB_EXTRA = 0.05; // ganho antes do mestre
  var AMB_WINDOW = 8;                     // s de janela de chegadas
  var AMB_RATE_FULL = 1.0;                // chegadas/s que levam ao maximo
  var AMB_LP = 380;
  var AMB_UPDATE = 0.25;                  // s entre atualizacoes
  var AMB_TC = 1.2;                       // constante de tempo (suave)

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // nomes de play(): lista de tons {f, t, d, v, w (onda), f2 (desliza ate)}
  var N = { C5: 72, D5: 74, E5: 76, G5: 79, A5: 81, C6: 84, E4: 64, G4: 67, C4: 60, A4: 69, B4: 71, F4: 65 };
  var SOUNDS = {
    place:      [{ f: mtof(N.G4), f2: mtof(N.C4), t: 0, d: 0.09, v: 0.45, w: 'triangle' }],
    build:      [{ f: mtof(N.C4), t: 0, d: 0.1, v: 0.4, w: 'triangle' }, { f: mtof(N.G4), t: 0.07, d: 0.14, v: 0.4 }],
    deny:       [{ f: mtof(N.A4), t: 0, d: 0.12, v: 0.3 }, { f: mtof(N.E4), t: 0.11, d: 0.18, v: 0.3 }],
    undo:       [{ f: mtof(N.E5), t: 0, d: 0.08, v: 0.3 }, { f: mtof(N.C5), t: 0.07, d: 0.12, v: 0.3 }],
    dayStart:   [{ f: mtof(N.C5), t: 0, d: 0.18, v: 0.35 }, { f: mtof(N.G5), t: 0.14, d: 0.3, v: 0.35 }],
    daySuccess: [{ f: mtof(N.C5), t: 0, d: 0.3, v: 0.32 }, { f: mtof(N.E5), t: 0.12, d: 0.3, v: 0.32 },
                 { f: mtof(N.G5), t: 0.24, d: 0.3, v: 0.32 }, { f: mtof(N.C6), t: 0.36, d: 0.6, v: 0.32 }],
    dayFail:    [{ f: mtof(57), t: 0, d: 0.7, v: 0.28 }, { f: mtof(60), t: 0, d: 0.7, v: 0.24 },
                 { f: mtof(64), t: 0, d: 0.7, v: 0.24 }],
    card:       [{ f: mtof(N.E5), t: 0, d: 0.1, v: 0.35, w: 'triangle' }, { f: mtof(N.A5), t: 0.08, d: 0.2, v: 0.3 }],
    tick:       [{ f: 1200, t: 0, d: 0.03, v: 0.2 }],
    select:     [{ f: mtof(N.D5), t: 0, d: 0.07, v: 0.3, w: 'triangle' }],
    unlock:     [{ f: mtof(N.G4), t: 0, d: 0.12, v: 0.35 }, { f: mtof(N.C5), t: 0.1, d: 0.14, v: 0.35 },
                 { f: mtof(N.E5), t: 0.2, d: 0.35, v: 0.35 }]
  };

  function create(opts) {
    var ambOn = (opts && opts.ambient !== undefined) ? !!opts.ambient : AMB_ENABLED;
    var ctx = null, master = null, send = null, ambGain = null, ambLpNode = null;
    var ambOscs = [];
    var voices = [];                 // instantes de fim das vozes ativas (teto global)
    var pedPlayed = [];
    var resuming = false;
    var unlocked = false, enabled = true, hidden = false;
    var arrivals = [];               // instantes de chegadas (todas, para o ambiente)
    var arrivePlayed = [], lightPlayed = [], passPlayed = [];
    var lastStress = -10, lastByName = {};
    var ambAccum = 0;

    function now() { return ctx ? ctx.currentTime : 0; }
    function ready() { return !!(ctx && unlocked && enabled && !hidden && ctx.state === 'running'); }

    // limite por segundo: janela deslizante de 1 s
    function allow(list, max, t) {
      while (list.length && list[0] <= t - 1) { list.shift(); }
      if (list.length >= max) { return false; }
      list.push(t);
      return true;
    }

    function buildGraph() {
      master = ctx.createGain();
      master.gain.value = enabled ? MASTER_VOL : 0;
      // compressor leve antes da saida: evita estouro quando varias vozes somam
      var out = ctx.destination;
      if (ctx.createDynamicsCompressor) {
        var comp = ctx.createDynamicsCompressor();
        try {
          comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 3;
          comp.attack.value = 0.005; comp.release.value = 0.2;
        } catch (e) {}
        comp.connect(ctx.destination);
        out = comp;
      }
      master.connect(out);

      // eco: send -> delay -> lowpass -> wet -> master, com realimentacao
      send = ctx.createGain();
      send.gain.value = 1;
      var delay = ctx.createDelay(1);
      delay.delayTime.value = ECHO_TIME;
      var fb = ctx.createGain();
      fb.gain.value = ECHO_FEEDBACK;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = ECHO_LP;
      var wet = ctx.createGain();
      wet.gain.value = ECHO_WET;
      send.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(wet);
      wet.connect(master);

      // ambiente: so cria o grafo se habilitado; osciladores nascem sob demanda
      if (ambOn) {
        ambGain = ctx.createGain();
        ambGain.gain.value = 0;
        ambLpNode = ctx.createBiquadFilter();
        ambLpNode.type = 'lowpass';
        ambLpNode.frequency.value = AMB_LP;
        ambLpNode.connect(ambGain);
        ambGain.connect(master);
      }
    }

    function startAmb() {
      if (!ambOn || !ambLpNode || ambOscs.length) { return; }
      for (var i = 0; i < AMB_FREQS.length; i++) {
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = AMB_FREQS[i];
        if (o.detune) { o.detune.value = (i - 1) * 4; }
        var g = ctx.createGain();
        g.gain.value = 1 / AMB_FREQS.length;
        o.connect(g);
        g.connect(ambLpNode);
        o.start(0);
        ambOscs.push(o);
      }
    }

    // para os osciladores do ambiente (nao deixar nada rodando em silencio)
    function stopAmb() {
      for (var i = 0; i < ambOscs.length; i++) { try { ambOscs[i].stop(0); } catch (e) {} }
      ambOscs = [];
    }

    // um tom: oscilador + envelope curto. wave2 opcional (mistura de triangulo)
    function tone(freq, t0, dur, vol, o) {
      o = o || {};
      while (voices.length && voices[0] <= t0) { voices.shift(); }
      if (voices.length >= MAX_VOICES) { return; }
      voices.push(t0 + dur + 0.05);
      voices.sort(function (a, b) { return a - b; });
      var osc = ctx.createOscillator();
      osc.type = o.wave || 'sine';
      osc.frequency.value = freq;
      if (o.slideTo) {
        osc.frequency.setValueAtTime(freq, t0);
        osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
      }
      if (o.detune && osc.detune) { osc.detune.value = o.detune; }
      var g = ctx.createGain();
      var att = Math.min(0.006, dur * 0.3);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + att);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      if (!o.dry) { g.connect(send); }
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }

    function setAmbient(target) {
      try {
        var t = now();
        ambGain.gain.cancelScheduledValues(t);
        ambGain.gain.setTargetAtTime(target, t, AMB_TC);
      } catch (e) {}
    }

    function arrivalRate() {
      var t = now();
      while (arrivals.length && arrivals[0] <= t - AMB_WINDOW) { arrivals.shift(); }
      return arrivals.length / AMB_WINDOW;
    }

    function updateAmbient() {
      if (!ctx || !ambGain || !ambOn) { return; }
      if (!enabled || hidden || ctx.state !== 'running') { setAmbient(0); stopAmb(); return; }
      startAmb();
      var k = clamp(arrivalRate() / AMB_RATE_FULL, 0, 1);
      setAmbient(AMB_BASE + AMB_EXTRA * k);
    }

    function noteForX(x) {
      var u = clamp(((+x || 0) - X_MIN) / (X_MAX - X_MIN), 0, 0.9999);
      var i = Math.floor(u * NOTE_COUNT);
      var oct = Math.floor(i / PENTA.length);
      return BASE_MIDI + 12 * oct + PENTA[i % PENTA.length];
    }

    function playArrive(x) {
      var t = now();
      if (!allow(arrivePlayed, ARRIVE_MAX_PER_SEC, t)) { return; }
      var f = mtof(noteForX(x));
      var d = (Math.random() * 2 - 1) * ARRIVE_DETUNE_CENTS;
      var dur = ARRIVE_DUR + Math.random() * 0.02;
      tone(f, t, dur, ARRIVE_VOL * (1 - ARRIVE_TRI_MIX) * 0.6, { wave: 'sine', detune: d });
      tone(f, t, dur, ARRIVE_VOL * ARRIVE_TRI_MIX * 0.6, { wave: 'triangle', detune: d });
    }

    function playList(list, volMul) {
      var t = now();
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        tone(s.f, t + s.t, s.d, s.v * volMul, { wave: s.w, slideTo: s.f2 });
      }
    }

    function play(name, opts) {
      try {
        if (!ready()) { return; }
        var t = now();
        if (t - (lastByName[name] === undefined ? -10 : lastByName[name]) < SAME_SOUND_GAP) { return; }
        var vm = (opts && typeof opts.vol === 'number') ? clamp(opts.vol, 0, 2) : 1;
        var gap = NAME_GAP[name];
        if (gap && t - (lastByName[name] === undefined ? -10 : lastByName[name]) < gap) { return; }
        if (name === 'arrive') { lastByName[name] = t; playArrive(opts && opts.x); return; }
        if (name === 'gridlock') {
          lastByName[name] = t;
          tone(GRIDLOCK_F0, t, GRIDLOCK_DUR, GRIDLOCK_VOL * vm, { slideTo: GRIDLOCK_F1 });
          return;
        }
        var list = SOUNDS[name];
        if (!list) { return; }
        lastByName[name] = t;
        playList(list, vm);
      } catch (e) {}
    }

    function handle(ev) {
      try {
        if (!ev || typeof ev !== 'object' || !ready()) { return; }
        var t = now();
        switch (ev.type) {
          case 'arrive':
            arrivals.push(t);
            playArrive(ev.x);
            break;
          case 'gridlock':
            play('gridlock');
            break;
          case 'stress':
            if (typeof ev.value === 'number' && ev.value >= STRESS_MIN && t - lastStress >= STRESS_GAP) {
              lastStress = t;
              tone(STRESS_FREQ, t, 0.05, STRESS_VOL, { wave: 'triangle', dry: true });
            }
            break;
          case 'light':
            if (allow(lightPlayed, LIGHT_MAX_PER_SEC, t)) {
              tone(1500, t, 0.02, LIGHT_VOL, { wave: 'triangle', dry: true });
            }
            break;
          case 'pass':
            if (allow(passPlayed, PASS_MAX_PER_SEC, t)) {
              tone(PASS_FREQ, t, 0.05, PASS_VOL, { dry: true });
            }
            break;
          case 'ped':
            if (!allow(pedPlayed, PED_MAX_PER_SEC, t)) { break; }
            tone(mtof(N.E5), t, 0.08, PED_VOL, {});
            tone(mtof(N.C5), t + 0.1, 0.1, PED_VOL, {});
            break;
          case 'phase':
            if (ev.phase === 'summary') { play(ev.failed ? 'dayFail' : 'daySuccess'); }
            else if (ev.phase === 'plan') { play('dayStart'); }
            break;
          case 'unlock':
            play('unlock');
            break;
          case 'over':
            play(ev.win ? 'daySuccess' : 'dayFail');
            break;
          default:
            break;
        }
      } catch (e) {}
    }

    function tick(dt) {
      try {
        if (!ctx || !unlocked) { return; }
        ambAccum += (dt > 0 ? dt : 0);
        if (ambAccum >= AMB_UPDATE) { ambAccum = 0; updateAmbient(); }
      } catch (e) {}
    }

    function unlock() {
      try {
        // iOS: toca mesmo com o interruptor de silencio ligado
        try {
          var nav = root.navigator;
          if (nav && nav.audioSession) { nav.audioSession.type = 'playback'; }
        } catch (e) {}
        if (!ctx) {
          var AC = root.AudioContext || root.webkitAudioContext;
          if (!AC) { return; }
          ctx = new AC();
          buildGraph();
          try {
            ctx.onstatechange = function () {
              try {
                if (ctx.state === 'running') { updateAmbient(); } else { stopAmb(); }
              } catch (e) {}
            };
          } catch (e) {}
        }
        if (ctx.state === 'running') { unlocked = true; return; }
        if (ctx.resume) {
          resuming = true;
          var p = ctx.resume();
          if (p && p.then) {
            p.then(function () { resuming = false; unlocked = true; updateAmbient(); },
                   function () { resuming = false; });
          } else { resuming = false; unlocked = true; updateAmbient(); }
        } else { unlocked = true; }
      } catch (e) {}
    }

    function setEnabled(v) {
      try {
        enabled = !!v;
        if (!ctx || !master) { return; }
        var t = now();
        master.gain.cancelScheduledValues(t);
        master.gain.setTargetAtTime(enabled ? MASTER_VOL : 0, t, 0.03);
        updateAmbient();
      } catch (e) {}
    }

    function goHidden() {
      hidden = true;
      if (!ctx) { return; }
      stopAmb();
      if (ctx.suspend) { var a = ctx.suspend(); if (a && a.catch) { a.catch(function () {}); } }
    }
    function goVisible() {
      hidden = false;
      if (ctx && unlocked && enabled && ctx.state !== 'running' && ctx.resume) {
        var b = ctx.resume(); if (b && b.catch) { b.catch(function () {}); }
      }
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        try {
          if (document.hidden || document.visibilityState === 'hidden') { goHidden(); } else { goVisible(); }
        } catch (e) {}
      });
    }
    // bfcache / app em segundo plano no iOS
    if (typeof root.addEventListener === 'function') {
      root.addEventListener('pagehide', function () { try { goHidden(); } catch (e) {} });
      root.addEventListener('pageshow', function () { try { goVisible(); } catch (e) {} });
    }

    var api = { unlock: unlock, setEnabled: setEnabled, handle: handle, play: play, tick: tick };
    Object.defineProperty(api, 'enabled', {
      get: function () { return enabled; },
      set: function (v) { setEnabled(v); },
      enumerable: true
    });
    return api;
  }

  CRZ.Audio = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
