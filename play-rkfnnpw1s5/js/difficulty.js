/* Gridlet: dificuldade (Easy | Normal). Carrega logo depois de config.js e aplica o perfil escolhido
 * ao CFG ANTES de qualquer outro modulo ler os numeros. Dono: orquestrador.
 * O jogo (sim, game, ui, tutorial, menu) so le CFG; nao conhece a dificuldade.
 * Numeros escolhidos por playtest automatico pela interface (web/dev/e2e): ver DIFFICULTY_NOTES.md. */
(function (root) {
  'use strict';
  var CRZ = (root.CRZ = root.CRZ || {});
  var CFG = CRZ.CFG;
  if (!CFG) { return; }

  var PROFILES = {
    // spawnDay: dia 3 (comboio do tutorial) mais leve; Easy alivia o fim, Normal alivia os dias 9 a 12.
    // Medido em web/dev/balance/profiles.js e web/dev/novice2/run_all.js (2026-11-09, 30 a 40 sementes)
    // 2026-11-09 (perfis humanos, dev/e2e/RESULTS_HUMANS.md): a iniciante leva ~15 s de jogo para reagir ao anel
    // e o no travava em 8 s. Easy: lock 1.7 (13,6 s com o anel cheio ate travar) e dias 7 a 10 a 0.9. Normal: o
    // jogador medio vencia 79% (alvo 45 a 60%), dias 10 a 12 voltam a 1.0, 1.0, 0.95. Robos headless, 60 sementes:
    // Easy preguicoso 42 -> 62%, curioso 83 -> 93%, cuidadoso 95 -> 98%; Normal curioso 58 -> 47%, cuidadoso 70 -> 58%.
    // lock (opcional): fator sobre CFG.lockSeconds. patienceDay (opcional): fator de paciencia por dia.
    // assist (opcional, lido por ui.js): chipAt/chipOff = estresse que liga/desliga o chip do Boost ao lado do Play;
    // playConfirm = "Start anyway?" no Play com anel sem sinal; newJunctionTip = dica "New junction" no plano;
    // newMark = marca NEW nos cruzamentos novos; jamBalloonAt = so registro (o balao do anel e o RING_SHOW de
    // tutorial.js). Sem o bloco valem os padroes de ui.js (iguais a estes). Rodada 5 (dev/e2e/RESULTS_HUMANS.md,
    // 48 partidas por celula): no Normal a confirmacao do Play sobe o medio 67 -> 88% (chip 0,45) e o chip entre
    // 0,35 e 0,65 nao move nada fora do ruido; o Normal fica sem confirmacao.
    easy:   { label: 'Easy',   spawn: 0.8,  patience: 1.25, strikes: 4, lock: 1.7,
              spawnDay: [1, 1, 0.85, 1, 1, 1, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
              assist: { chipAt: 0.45, chipOff: 0.3, playConfirm: true, newJunctionTip: true, newMark: true, jamBalloonAt: 0.3 } },
    normal: { label: 'Normal', spawn: 0.85, patience: 1.1,  strikes: 3,
              spawnDay: [1, 1, 0.9, 1, 1, 1, 1, 1, 0.95, 1.0, 1.15, 1.15],
              assist: { chipAt: 0.45, chipOff: 0.3, playConfirm: false, newJunctionTip: false, newMark: true, jamBalloonAt: 0.3 } }
  };
  var DEFAULT = 'easy';        // o jogo e apresentado a quem nunca viu: comeca no facil
  var KEY = 'gridlet.difficulty';

  var name = DEFAULT;
  try {
    var v = root.localStorage && root.localStorage.getItem(KEY);
    if (v && PROFILES[v]) { name = v; }
  } catch (e) {}
  try {                       // ?diff=normal (testes)
    var q = new URLSearchParams(root.location.search).get('diff');
    if (q && PROFILES[q]) { name = q; }
  } catch (e) {}

  var p = PROFILES[name];
  var baseSpawn = CFG.spawnRate;
  // spawnDay (opcional): forma da curva por dia, por cima de `spawn` (o menu mostra so `spawn`)
  CFG.spawnRate = function (day) { return baseSpawn(day) * p.spawn * ((p.spawnDay && p.spawnDay[day - 1]) || 1); };
  CFG.patience = CFG.patience * p.patience;
  if (p.lock > 0) CFG.lockSeconds = CFG.lockSeconds * p.lock;
  if (p.patienceDay) CFG.patienceDay = p.patienceDay;   // lido por sim.js (stress)
  CFG.maxStrikes = p.strikes;
  CFG.difficultyName = name;
  CFG.difficulties = PROFILES;

  CRZ.difficulty = {
    name: name,
    list: Object.keys(PROFILES),
    label: function (n) { return (PROFILES[n || name] || {}).label || n; },
    // troca a dificuldade: comeca um jogo novo (o save e apagado, o recorde fica) e o menu mostra a tela
    // inicial com a nova dificuldade marcada: sessionStorage 'gridlet.afterSwitch' e lido (e apagado) por menu.js
    set: function (n) {
      if (!PROFILES[n] || n === name) { return false; }
      CRZ.difficulty.switching = true;   // ui.saveNow nao regrava o save durante o reload
      try {
        root.localStorage.setItem(KEY, n);
        root.localStorage.removeItem('cruzamento.save');
        root.sessionStorage.removeItem('cruzamento.session');
        root.sessionStorage.setItem('gridlet.afterSwitch', '1');
      } catch (e) {}
      try { root.location.reload(); } catch (e) {}
      return true;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
