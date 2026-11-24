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
    // strikes: por capitulo de CFG.chapterDays dias (v2, D9): Easy 4, Normal 4 (era 3 ate w_ag7), repostos nos dias 11 e 21.
    // lock (opcional): fator sobre CFG.lockSeconds. patienceDay (opcional): fator de paciencia por dia.
    // assist (opcional, lido por ui.js): chipAt/chipOff = estresse que liga/desliga o chip do Boost ao lado do Play;
    // playConfirm = "Start anyway?" no Play com anel sem sinal; newJunctionTip = dica "New junction" no plano;
    // newMark = marca NEW nos cruzamentos novos; jamBalloonAt = so registro (o balao do anel e o RING_SHOW de
    // tutorial.js). Sem o bloco valem os padroes de ui.js (iguais a estes). Rodada 5 (dev/e2e/RESULTS_HUMANS.md,
    // 48 partidas por celula): no Normal a confirmacao do Play sobe o medio 67 -> 88% (chip 0,45) e o chip entre
    // 0,35 e 0,65 nao move nada fora do ruido; o Normal fica sem confirmacao.
    easy:   { label: 'Easy',   spawn: 0.8,  patience: 1.25, strikes: 4, lock: 1.7,
              spawnDay: [1, 1, 0.85],   // v2: so o dia 3 (comboio do tutorial); a forma dos 30 dias vem de CFG.spawnRate
              // v2x (playtest cego 5: 0 strikes em 30 dias no Easy): o risco cresce por capitulo. Capitulo 1 igual; no 2 os
              // motoristas esperam menos (o descuidado ve strikes, os dias 11 a 14 nao mandam de volta); no 3 mais carros.
              // Medido em web/dev/review/v2x/f3_measure.js, 40 sementes; tabela antes e depois no commit 3b
              // w_easy (80 sementes, web/dev/review/w_easy/sweep.js e results.jsonl): um multiplicador por capitulo pesava
              // igual em todos (preguicoso repetia o 2 em 35%). Alavanca: no Easy o ultimo strike do capitulo 2 so avisa
              // (restartFrom 21), entao o capitulo 2 pode apertar (strikes que ensinam, sem volta) e o 3 alivia um pouco.
              // Curioso: 1,88 strikes no cap. 2, repete o 3 em 24%; cuidadoso 4%; preguicoso 0% no 2 e 48% no 3; ingenuo
              // 1,04 strikes no 2. Picos (um dia em tres com 30% mais carros; spawnDays) mediram pior que o plano.
              chapter: { 2: { spawn: 1.2, patience: 0.75 }, 3: { spawn: 1.05 } },
              // w_cars (2026-11-18): com ~1,7x carros na cidade (config.js carsMul, portalRefMax), os motoristas esperam
              // 20% mais do dia 5 em diante (CFG.patienceLate), e o Easy ganha 1 ponto a menos por dia que o Normal nos
              // capitulos 2 e 3 (budgetAdd: 4 e 5). Novatos, 40 partidas, depois do merge de main: curioso repete o 3 em 10%
              // (main 18%) com 1,0 strike no 2 (2,0), cuidadoso 0% (8%), preguicoso 65% (45%). Paciencia mais baixa ou mais
              // carros pesam primeiro no preguicoso (93% com carros x1,3/x1,15). web/dev/review/w_cars/NOTES.md
              latePatience: 1.2, budgetAdd: [0, -1, -1],
              restartFrom: 21,
              assist: { chipAt: 0.45, chipOff: 0.3, playConfirm: true, newJunctionTip: true, newMark: true, jamBalloonAt: 0.3 } },
    // w_ag7 (2026-11-24): com o Pare lento na cruz cheia e os lugares, o aware do Normal caia a ~45% limpo (alvo 70 a 85%): 4 strikes
    // (eram 3) e motoristas 1,5x mais pacientes do dia 5 (era 1,3). 40 sementes: aware 55% (main) -> 80%, Stop em tudo 3% -> 0% (web/dev/review/w_ag7)
    normal: { label: 'Normal', spawn: 0.85, patience: 1.1,  strikes: 4,
              // w_cars: x1,3 do dia 5 (CFG.patienceLate). 40 sementes: aware limpo 80% (antes 82), lightsUp 85% (80), smart 35%
              // (42), spendAll 30% (40); com 1,25 o aware caia para 65% e o smart para 18%
              latePatience: 1.5,   // w_ag7: era 1.3 (acima)
              spawnDay: [1, 1, 0.9],    // v2 (v2/economia.md 6.2: spawnDay sai); dia ausente vale 1
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
  // chapter (opcional): fator de carros (spawn) e de paciencia por capitulo de CFG.chapterDays dias, por cima do resto.
  // Medidas: node web/dev/review/v2x/f3_measure.js (CRZ_TUNE no node troca o bloco so em memoria, para varrer)
  var tune = root.CRZ_TUNE && root.CRZ_TUNE[name];
  if (tune && tune.chapter) p.chapter = tune.chapter;
  if (tune && tune.latePatience > 0) p.latePatience = tune.latePatience;            // w_cars: varredura (novrun.js)
  if (tune && Array.isArray(tune.budgetAdd)) p.budgetAdd = tune.budgetAdd;
  // budgetAdd (opcional, w_cars): pontos a mais (ou a menos) por dia nos capitulos [1, 2, 3] sobre CFG.budget. O capitulo 1
  // fica sempre como esta (os dias de aprendizado). Ex.: o Easy sobe menos que o Normal nos capitulos 2 e 3
  if (Array.isArray(p.budgetAdd) && Array.isArray(CFG.budget)) {
    var CDb = CFG.chapterDays || 10;
    CFG.budget = CFG.budget.map(function (b, i) { var ch = Math.ceil((i + 1) / CDb), a = ch > 1 ? (p.budgetAdd[ch - 1] | 0) : 0; return Math.max(1, b + a); });
  }
  if (p.chapter) {
    var CD = CFG.chapterDays || 10, sd = (p.spawnDay || []).slice(), pd = (p.patienceDay || []).slice();
    for (var dd = 1; dd <= CFG.maxDays; dd++) {
      var cx = p.chapter[Math.ceil(dd / CD)];
      if (!cx) continue;
      if (cx.spawn > 0) sd[dd - 1] = (sd[dd - 1] || 1) * cx.spawn;
      if (cx.patience > 0) pd[dd - 1] = (pd[dd - 1] || 1) * cx.patience;
      // spawnDays (opcional): fator de carros por dia dentro do capitulo (indice 0 = primeiro dia dele): dias de pico
      var kx = (dd - 1) % CD;
      if (cx.spawnDays && cx.spawnDays[kx] > 0) sd[dd - 1] = (sd[dd - 1] || 1) * cx.spawnDays[kx];
    }
    for (dd = 0; dd < CFG.maxDays; dd++) { if (!(sd[dd] > 0)) sd[dd] = 1; if (!(pd[dd] > 0)) pd[dd] = 1; }
    p.spawnDay = sd; p.patienceDay = pd;
  }
  var baseSpawn = CFG.spawnRate;
  // spawnDay (opcional): forma da curva por dia, por cima de `spawn` (o menu mostra so `spawn`)
  CFG.spawnRate = function (day) { return baseSpawn(day) * p.spawn * ((p.spawnDay && p.spawnDay[day - 1]) || 1); };
  CFG.patience = CFG.patience * p.patience;
  if (p.lock > 0) CFG.lockSeconds = CFG.lockSeconds * p.lock;
  if (p.patienceDay) CFG.patienceDay = p.patienceDay;   // lido por sim.js (stress)
  // latePatience (opcional, w_cars): fator de paciencia do dia CFG.patienceLate.fromDay em diante (sim.js patNow)
  if (p.latePatience > 0 && CFG.patienceLate) CFG.patienceLate.mul = p.latePatience;
  // places (opcional, w_far): { max: [..], rate: [..], perDay: [..] } por capitulo, por cima de CFG.trafficBalance.places (so os campos dados)
  var ptune = tune && tune.places ? tune.places : p.places;
  if (ptune && CFG.trafficBalance && CFG.trafficBalance.places) for (var pk in ptune) if (ptune.hasOwnProperty(pk)) CFG.trafficBalance.places[pk] = ptune[pk];
  CFG.maxStrikes = p.strikes;
  // restartFrom (opcional): primeiro dia em que gastar os strikes manda de volta (CFG.noRestartBeforeDay; antes dele o
  // ultimo strike so avisa, como no capitulo 1). Os textos leem {restartDay}
  if (p.restartFrom > 0) CFG.noRestartBeforeDay = p.restartFrom;
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
