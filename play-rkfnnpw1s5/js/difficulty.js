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
    // 2026-11-26 (dono): 'so 1 strike, sempre'. O Easy joga pela regra do Normal: UM strike para a partida inteira (wholeGame), sem
    // volta de capitulo nem perdao. O que o Easy tem de mais facil: menos carros, motoristas mais pacientes (e mais ainda nos dias de
    // trafego), pontos e precos por capitulo, a trava mais lenta (lock 1,7), as dicas (assist). strikes: 4 so vale fora da regra.
    easy:   { label: 'Easy',   spawn: 0.8,  patience: 1.25, strikes: 4, wholeGame: true, lock: 1.7,
              spawnDay: [1, 1, 0.85],   // v2: so o dia 3 (comboio do tutorial); a forma dos 30 dias vem de CFG.spawnRate
              // v2x (playtest cego 5: 0 strikes em 30 dias no Easy): o risco cresce por capitulo. Capitulo 1 igual; no 2 os
              // motoristas esperam menos (o descuidado ve strikes, os dias 11 a 14 nao mandam de volta); no 3 mais carros.
              // Medido em web/dev/review/v2x/f3_measure.js, 40 sementes; tabela antes e depois no commit 3b
              // owner decision 2026-11-26: one strike for the whole game; Easy retuned so it is the easier difficulty (w_ez,
              // web/dev/review/w_ez/TABLE.md). Before, chapter 2 was harsher (spawn x1.2, patience x0.75) because its strikes were
              // free and only taught; with one strike the novice (curious) lost there: Easy curious reached day 30 in 8% (Normal 8%),
              // median end day 15, 83% of games ended in chapter 2. Now chapter 2 keeps no extra cars and a mild patience cut (x0.9,
              // so a few novices still lose there, warned the day before), chapter 3 x1.05 cars as before.
              // Measured with latePatience 1.4 below (one strike): curious 38% reach day 30 (80 seeds; Normal 8%), ends ch1/ch2/ch3
              // 0/15/48%, 0% on days 6 to 8; careful 98%, saverCareful 88%, saver 78%, aware 88% (40 seeds); Stop everywhere 5%,
              // no signs 0%; best fixed recipe smart2 68%; 94% of the fatal jams warned the day before (chapter 2: 100%).
              chapter: { 2: { patience: 0.9 }, 3: { spawn: 1.05 } },
              // w_cars (2026-11-18): com ~1,7x carros na cidade (config.js carsMul, portalRefMax), os motoristas esperam
              // 20% mais do dia 5 em diante (CFG.patienceLate), e o Easy ganha 1 ponto a menos por dia que o Normal nos
              // capitulos 2 e 3 (budgetAdd: 4 e 5). Novatos, 40 partidas, depois do merge de main: curioso repete o 3 em 10%
              // (main 18%) com 1,0 strike no 2 (2,0), cuidadoso 0% (8%), preguicoso 65% (45%). Paciencia mais baixa ou mais
              // carros pesam primeiro no preguicoso (93% com carros x1,3/x1,15). web/dev/review/w_cars/NOTES.md
              // owner decision 2026-11-26 (w_ez): latePatience 1.2 -> 1.4. At 1.2 Easy drivers from day 5 were LESS patient than
              // Normal's (1.25 x 1.2 = 1.5 against 1.1 x 1.5 = 1.65). 20 seeds, chapter 2 x1 cars: 1.35 curious 25%, 1.4 35%,
              // 1.5 55% (careful 100%), 1.8 90% with Stop everywhere 85% (a walk). budgetAdd kept: 0 or -2 in chapters 2 and 3
              // moved no policy by more than 20-seed noise (15 points) against the same cell without it; it is not the lever.
              latePatience: 1.4, budgetAdd: [0, -1, -1],
              // w_price (80 sementes, web/dev/review/w_price): no Easy so o semaforo sobe por capitulo (config: 4/6/8); qualquer subida
              // da Roundabout (3/3/4 em diante) leva o curioso a repetir o capitulo 3 em 40 a 44% (alvo 20 a 35%; sem rampa 34%)
              costByChapter: { round: [3, 3, 3] },
              assist: { chipAt: 0.45, chipOff: 0.3, playConfirm: true, newJunctionTip: true, newMark: true, jamBalloonAt: 0.3 } },
    // w_ag7 (2026-11-24): com o Pare lento na cruz cheia e os lugares, o aware do Normal caia a ~45% limpo (alvo 70 a 85%): 4 strikes
    // (eram 3) e motoristas 1,5x mais pacientes do dia 5 (era 1,3). 40 sementes: aware 55% (main) -> 80%, Stop em tudo 3% -> 0% (web/dev/review/w_ag7)
    // 2026-11-26 (dono, depois de jogar): com 4 strikes por capitulo o Normal ficava facil: 'a pessoa tomava o strike e a vida seguia'.
    // Normal = UM strike para a partida inteira, a regra que o modo One strike ja tem (CFG.ironMode, ligado por main.js; wholeGame). O
    // numero abaixo e o do capitulo, que so vale fora dessa regra (testes sem main.js; o jogo ligado usa CFG.maxStrikes = 1).
    normal: { label: 'Normal', spawn: 0.85, patience: 1.1,  strikes: 4, wholeGame: true,
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
  // costByChapter (opcional, w_price): { light: [c1, c2, c3], round: [...] } por cima de CFG.tools.<id>.costByChapter (so as pecas dadas)
  var ctune = tune && tune.costByChapter ? tune.costByChapter : p.costByChapter;
  if (ctune && CFG.tools) for (var ck in ctune) if (ctune.hasOwnProperty(ck) && CFG.tools[ck] && Array.isArray(ctune[ck])) CFG.tools[ck].costByChapter = ctune[ck].slice();
  CFG.maxStrikes = p.strikes;
  CFG.wholeGameStrike = !!p.wholeGame;   // w_one: main.js liga CFG.ironMode (e maxStrikes 1) quando a dificuldade e esta
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
  /* Guidance (w_guide): o ajuste de aparelho "Guidance On/Off", guardado como o som (fora do save da partida).
   * On e o padrao (sem chave, ou qualquer valor que nao seja '0'). Off tira o ensino (tutorial, dicas de primeiro uso,
   * confirmacoes de ajuda); a informacao do jogo fica. ch1: contador por aparelho de partidas que chegaram ao dia
   * CFG.chapterDays + 1 (capitulo 1 terminado); sem contador, o melhor dia do recorde (cruzamento.best) vale. */
  var GKEY = 'gridlet.guidance', CH1_KEY = 'gridlet.ch1', BEST_KEY = 'cruzamento.best';
  function lsGet(k) { try { return root.localStorage ? root.localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsPut(k, v) { try { if (root.localStorage) { root.localStorage.setItem(k, v); } } catch (e) {} }
  var guideOn = lsGet(GKEY) !== '0', guideCbs = [];
  CRZ.guide = {
    key: GKEY, ch1Key: CH1_KEY,
    on: function () { return guideOn; },
    // grava e avisa quem ouve; true se mudou
    set: function (v) {
      v = !!v;
      if (v === guideOn) { return false; }
      guideOn = v; lsPut(GKEY, v ? '1' : '0');
      guideCbs.slice().forEach(function (f) { try { f(guideOn); } catch (e) {} });
      return true;
    },
    onChange: function (f) { guideCbs.push(f); return function () { var i = guideCbs.indexOf(f); if (i >= 0) { guideCbs.splice(i, 1); } }; },
    // testes: relê a chave do armazenamento
    reload: function () { guideOn = lsGet(GKEY) !== '0'; return guideOn; },
    // partidas do aparelho que chegaram ao dia 11 (inicio do capitulo 2)
    chapters: function () {
      var n = parseInt(lsGet(CH1_KEY), 10);
      return n > 0 ? n : 0;
    },
    noteChapterDone: function () { lsPut(CH1_KEY, String(CRZ.guide.chapters() + 1)); },
    finishedChapter: function () {
      if (CRZ.guide.chapters() > 0) { return true; }
      var need = ((CFG && CFG.chapterDays) || 10) + 1, b = null;
      try { b = JSON.parse(lsGet(BEST_KEY) || 'null'); } catch (e) {}
      return !!b && (+b.bestDays || 0) >= need;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
