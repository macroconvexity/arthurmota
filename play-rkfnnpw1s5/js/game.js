/* Cruzamento: maquina de estados do jogo (dias, orcamento, dado, cartas,
 * crescimento da cidade, derrota). Dono: agente GAME. DOM-free (roda no node).
 * Contrato: ARCHITECTURE.md, "API de CRZ.Game". Aleatoriedade so por CRZ.rng. */
(function (root) {
  'use strict';
  var CRZ = root.CRZ = root.CRZ || {};
  var CFG = CRZ.CFG;

  var STEP = 1 / 30;            // passo fixo do sim (s simulados)
  var CLEAR = 26;               // folga minima entre estradas nao ligadas
  var PLACEABLE = { stop: 1, yield: 1, light: 1, round: 1, cross: 1 };
  var DEG45 = Math.PI / 4;

  // ---------- utilidades ----------
  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
  function idOf(v) { return (v && typeof v === 'object') ? v.id : v; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function sortedIds(obj) {
    return Object.keys(obj).map(Number).sort(function (a, b) { return a - b; });
  }

  // ---------- geometria ----------
  function dist(ax, ay, bx, by) { return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by)); }
  function ptSegDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return dist(px, py, ax + t * dx, ay + t * dy);
  }
  function orient(ax, ay, bx, by, cx, cy) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }
  function onSeg(ax, ay, bx, by, cx, cy) {
    return Math.min(ax, bx) - 1e-9 <= cx && cx <= Math.max(ax, bx) + 1e-9 &&
           Math.min(ay, by) - 1e-9 <= cy && cy <= Math.max(ay, by) + 1e-9;
  }
  function segsIntersect(a, b, c, d) { // inclusive (encostar conta)
    var o1 = orient(a.x, a.y, b.x, b.y, c.x, c.y), o2 = orient(a.x, a.y, b.x, b.y, d.x, d.y);
    var o3 = orient(c.x, c.y, d.x, d.y, a.x, a.y), o4 = orient(c.x, c.y, d.x, d.y, b.x, b.y);
    if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
    var E = 1e-9;
    if (Math.abs(o1) < E && onSeg(a.x, a.y, b.x, b.y, c.x, c.y)) return true;
    if (Math.abs(o2) < E && onSeg(a.x, a.y, b.x, b.y, d.x, d.y)) return true;
    if (Math.abs(o3) < E && onSeg(c.x, c.y, d.x, d.y, a.x, a.y)) return true;
    if (Math.abs(o4) < E && onSeg(c.x, c.y, d.x, d.y, b.x, b.y)) return true;
    return false;
  }
  function segSegDist(a, b, c, d) {
    if (segsIntersect(a, b, c, d)) return 0;
    return Math.min(ptSegDist(a.x, a.y, c.x, c.y, d.x, d.y), ptSegDist(b.x, b.y, c.x, c.y, d.x, d.y),
                    ptSegDist(c.x, c.y, a.x, a.y, b.x, b.y), ptSegDist(d.x, d.y, a.x, a.y, b.x, b.y));
  }
  function angDiff(a, b) {
    var d = (a - b) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d);
  }

  // ---------- dado (tabelas em CFG.dice) ----------
  var EFFECT_KEYS = ['budget', 'spawnMul', 'speedMul', 'patienceMul', 'free'];
  function diceTable(day) { return day <= 5 ? CFG.dice.early : CFG.dice.late; }
  function outcomeOf(tab, v) {
    for (var i = 0; i < tab.outcomes.length; i++) if (v >= tab.outcomes[i].min && v <= tab.outcomes[i].max) return tab.outcomes[i];
    return null;
  }
  function outcomeById(tab, id) {
    for (var i = 0; i < tab.outcomes.length; i++) if (tab.outcomes[i].id === id) return tab.outcomes[i];
    return null;
  }
  function makeDie(tab, v, oc) {
    oc = oc || outcomeOf(tab, v) || { id: 'plain', kind: 'plain' };
    var eff = {};
    for (var i = 0; i < EFFECT_KEYS.length; i++) if (oc[EFFECT_KEYS[i]] !== undefined) eff[EFFECT_KEYS[i]] = oc[EFFECT_KEYS[i]];
    return { faces: tab.faces, value: v, id: oc.id, kind: oc.kind || 'plain', effect: eff };
  }
  // dado vindo de save: kind/effect sempre reconstruidos da tabela (o save nao manda no efeito)
  function normDie(d, day) {
    if (!d || typeof d !== 'object') return null;
    var tab = diceTable(Math.min(day, CFG.maxDays)), oc = outcomeById(tab, d.id);
    if (!oc) return { faces: d.faces, value: d.value, id: d.id, kind: 'plain', effect: {} };
    return makeDie(tab, d.value, oc);
  }

  // ---------- o jogo ----------
  // Primeira viagem (FIRST_TIME_PLAN.md). Proposta para CFG.teach em dev/game/NOTES_GAME.md.
  // spawnCap (2026-11-08): no dia do comboio o dado nao soma trafego por cima dele (Rush 1.5 + comboio num cruzamento
  // de 4 entradas travava quem nao agia); o comboio e a hora do rush desse dia.
  var TEACH = { day: 3, convoyMin: 12, convoyMax: 12, window: 10, stopAt: 0.5, minFrac: 0.01, maxSrc: 9, spawnMul: 0.6, spawnCap: 1 };

  function build(seed, saved, opts) {
    opts = opts || {};
    var world = CRZ.Sim.create(seed);
    world.portalNorm = true;   // o Sim divide o trafego da cidade entre os portais (CFG.portalRef); mundos soltos dos testes nao
    var base = CRZ.rng(seed);
    var rngCalls = 0;
    function R() { rngCalls++; return base(); }
    function Rint(lo, hi) { return lo + Math.floor(R() * (hi - lo + 1)); }
    function Rweighted(weights) {
      var sum = 0, i;
      for (i = 0; i < weights.length; i++) sum += weights[i];
      var r = R() * sum;
      for (i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
      return weights.length - 1;
    }

    var listeners = [];
    var undoStack = [];
    var placed = {};            // nodeId -> custo pago hoje por tool
    var activeCards = [];       // cartas valendo no dia atual
    var hot = {};               // nodeId -> estresse maximo do ultimo dia
    var acc = 0, stepCount = 0, dayFailed = false;
    var runHot = {};            // estresse maximo visto no dia (nao vai para o Sim)
    var basePatience = 1;       // patienceMul do dia so de dado x cartas (a velocidade multiplica por cima)

    var st = {
      day: 1, maxDays: CFG.maxDays, phase: 'plan', budget: 0, strikes: 0, speed: CFG.speedDial.defaultSpeed, paused: false,
      dayTime: 0, dayLen: CFG.dayLen[0], die: null, nextDie: null, rerolled: false, tools: [],
      free: { road: false, light: false }, summary: null, draft: null,
      totalDelivered: 0, totalScore: 0, history: [], cards: [],
      // mapa de problemas: nodeId -> PICO de estresse do dia (so >= HOT_MIN). Vive do fim do
      // dia ate o proximo startDay. No removeNode/splitEdge a entrada fica (id inexistente: o
      // render ignora; nao e reaproveitado porque ids de no nao se repetem).
      hot: {},
      // Clear: cargas por dia para escoar um cruzamento durante o run (libera em CFG.clear.unlockDay)
      clear: { unlocked: false, charges: 0, max: CFG.clear.charges, seconds: CFG.clear.seconds },
      // Boost para a interface (CFG.earlyBoost): charges/max como clear; nextChargeIn = segundos de jogo ate a proxima
      // carga voltar (0 = nenhuma recarregando); regen = a regra de recarga vale neste dia (dias de aprendizado);
      // used = Boosts do dia dentro das 3 cargas (o que vale para teto e estatistica); extra = Boosts alem delas
      boost: { charges: 0, max: CFG.clear.charges, nextChargeIn: 0, regen: false, regenSeconds: 0, used: 0, extra: 0 },
      // velocidade escolhida pelo jogador: mais rapido = menos paciencia, mais gorjeta por carro.
      // tips = gorjeta do dia; tipCarry = resto de dias anteriores (< perPoint); speedBonus = pontos
      // que entram no PROXIMO plano; speedDial.applied = pontos que entraram no plano de hoje.
      tips: 0, tipCarry: 0, speedBonus: 0,
      // fast-forward ligado agora (CFG.fastForward; so na fase de corrida, nunca vai no save)
      ff: false,
      // primeira viagem: day3Convoy = o comboio do dia 3 vai rodar/rodou neste dia; seen = ja rodou neste jogo
      teach: { day3Convoy: false, seen: false, target: null, sent: 0 },
      final: null,
      speedDial: { levels: CFG.speedDial.levels.map(function (l) { return l.speed; }), tips: 0,
                   perPoint: CFG.speedDial.tipsPerPoint, carry: 0, applied: 0 }
    };
    function levelOf(sp) {
      var L = CFG.speedDial.levels;
      for (var i = 0; i < L.length; i++) if (L[i].speed === sp) return L[i];
      return L[0];
    }
    function speedOk(sp) {
      var L = CFG.speedDial.levels;
      for (var i = 0; i < L.length; i++) if (L[i].speed === sp) return true;
      return false;
    }
    function syncDial() { st.speedDial.tips = st.tips; st.speedDial.carry = st.tipCarry; }
    function applyPatience() {
      var p = world.params = world.params || {};
      p.patienceMul = basePatience * levelOf(st.speed).patienceMul;
    }
    var clearSeen = false;      // evento unlock do Clear/Boost ja saiu (vai no save; nunca repete)
    function isObjL(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
    function clearUnlocked() { return st.day >= CFG.clear.unlockDay; }
    function syncModes(charges) {
      st.clear.unlocked = clearUnlocked();
      st.clear.max = CFG.clear.charges;
      st.clear.seconds = CFG.clear.seconds;
      st.clear.charges = st.clear.unlocked ? charges : 0;
      bUsed = 0; bExtra = 0; regenT = [];
      syncBoost();
    }
    // ----- recarga do Boost nos dias de aprendizado (CFG.earlyBoost) -----
    // regenT: segundos de jogo que faltam para cada carga gasta voltar (FIFO, todas com a mesma duracao).
    // So existe com a recarga ligada; fora dela fica vazio e o Boost e o de sempre (3 por dia).
    var regenT = [];
    var bUsed = 0, bExtra = 0;   // Boosts do dia: dentro das 3 cargas (teto/estatistica) e alem delas (recarga)
    function earlyOn() {
      var E = CFG.earlyBoost;
      return !!E && E.days > 0 && E.regenSeconds > 0 && st.day <= E.days;
    }
    function syncBoost() {
      var b = st.boost;
      b.charges = st.clear.charges; b.max = st.clear.max;
      b.regen = st.clear.unlocked && earlyOn();   // a regra vale neste dia (a recarga so anda durante o dia)
      b.regenSeconds = b.regen ? CFG.earlyBoost.regenSeconds : 0;
      b.nextChargeIn = regenT.length ? Math.max(0, Math.round(regenT[0] * 100) / 100) : 0;
      b.used = bUsed; b.extra = bExtra;
    }
    function tickRegen(dt) {
      if (!regenT.length) return;
      for (var i = 0; i < regenT.length; i++) regenT[i] -= dt;
      while (regenT.length && regenT[0] <= 1e-9) {
        regenT.shift();
        if (st.clear.charges < st.clear.max) {
          st.clear.charges++;
          syncBoost();
          emit({ type: 'boostReady', charges: st.clear.charges, max: st.clear.max });
        }
      }
      syncBoost();
    }
    var HOT_MIN = 0.35;
    var PORTAL_CAP = 10;        // teto de portais criados por ruas do jogador

    function emit(ev) {
      for (var i = 0; i < listeners.length; i++) { try { listeners[i](ev); } catch (e) { /* ignora */ } }
    }

    // ----- custos -----
    function costOf(tool) {
      var t = own(CFG.tools, tool) ? CFG.tools[tool] : null;
      if (!t) return Infinity;
      if (tool === 'road' && st.free.road) return 0;
      if (tool === 'light' && st.free.light) return 0;
      return t.cost;
    }
    function isUnlocked(tool) { return own(CFG.tools, tool) && st.day >= CFG.tools[tool].unlockDay; }
    function refresh() {
      var arr = [];
      for (var i = 0; i < CFG.toolOrder.length; i++) {
        var id = CFG.toolOrder[i], c = costOf(id), u = isUnlocked(id);
        arr.push({ id: id, cost: c, unlocked: u, afford: u && st.budget >= c });
      }
      st.tools = arr;
    }

    // ----- dado -----
    // rng derivado (nao consome o fluxo principal): relance e previsao de save antigo.
    // Relance: mesma semente + mesmo dia = mesmo resultado, entao desfazer e relancar nao "pesca" outra face.
    function sideRng(salt, day) { return CRZ.rng((seed ^ Math.imul(day + salt, 0x85EBCA6B)) >>> 0); }
    function rollDie(day, rnd) {
      var tab = diceTable(day);
      var v = rnd ? 1 + Math.floor(rnd() * tab.faces) : Rint(1, tab.faces);
      return makeDie(tab, v);
    }
    function nextOf(day) { return day < CFG.maxDays ? rollDie(day + 1) : null; }
    // ferramenta que o dado de hoje deixa gratis (light vira road se o semaforo ainda nao existe)
    function dieGrant(die) {
      var f = die && die.effect && die.effect.free;
      if (f === 'light' && isUnlocked('light')) return 'light';
      if ((f === 'light' || f === 'road') && isUnlocked('road')) return 'road';
      return null;
    }
    function cardGrants(tool) { return hasCard(tool === 'road' ? 'freeRoad' : 'freeLight'); }
    function applyDie(die) {
      st.budget += (die && die.effect && die.effect.budget) || 0;
      var t = dieGrant(die);
      if (t) st.free[t] = true;
    }
    function rerollBlock() {
      if (!needPlan()) return 'phase';
      if (st.rerolled) return 'once';
      if (!st.die) return 'die';
      var t = dieGrant(st.die);
      if (t && !st.free[t] && !cardGrants(t)) return 'spent';      // a gratuidade do dado ja foi usada
      var c = CFG.dice.rerollCost, ob = (st.die.effect && st.die.effect.budget) || 0;
      if (st.budget < c || st.budget - c - ob < 0) return 'budget';
      return null;
    }

    // ----- fases -----
    function hasCard(id) { return activeCards.indexOf(id) >= 0; }
    function cardFx(id) { return (CFG.cardEffects && CFG.cardEffects[id]) || {}; }

    function enterPlan(day, leftover) {
      st.day = day;
      world.day = day;
      st.phase = 'plan';
      st.dayTime = 0;
      st.dayLen = CFG.dayLen[day - 1];
      st.summary = null;
      st.draft = null;
      st.cards = activeCards.slice();
      st.free.road = hasCard('freeRoad');
      st.free.light = hasCard('freeLight');
      var carry = Math.min(leftover || 0, CFG.carryCap);
      st.budget = CFG.budget[day - 1] + carry + (hasCard('plus2') ? cardFx('plus2').budget : 0) + (st.speedBonus || 0);
      st.speedDial.applied = st.speedBonus || 0;
      st.teach = { day3Convoy: false, seen: teachSeen, target: null, sent: 0 };
      st.speedBonus = 0;
      st.tips = 0;
      syncDial();
      syncModes(CFG.clear.charges);
      // a previsao e verdadeira: o dado de hoje e o nextDie sorteado ontem
      var nx = st.nextDie;
      st.die = (nx && nx.faces === diceTable(day).faces) ? normDie(nx, day) : rollDie(day);
      // dia 1: o dado fica escondido na UI, entao e neutro (CFG.dice.day1Face, 'plain'); o sorteio acima continua
      // consumindo o rng para as cidades das mesmas sementes nao mudarem
      if (day === 1 && CFG.dice.day1Face) st.die = makeDie(diceTable(1), CFG.dice.day1Face);   // 0 = sorteado como os outros
      st.nextDie = nextOf(day);
      st.rerolled = false;
      applyDie(st.die);
      undoStack = [];
      placed = {};
      refresh();
      emit({ type: 'day', day: day });
      emit({ type: 'die', die: clone(st.die), next: st.nextDie ? clone(st.nextDie) : null });
      for (var i = 0; i < CFG.toolOrder.length; i++) {
        var id = CFG.toolOrder[i];
        if (CFG.tools[id].unlockDay === day) emit({ type: 'unlock', tool: id });
      }
      if (day >= CFG.clear.unlockDay && !clearSeen) { clearSeen = true; emit({ type: 'unlock', tool: 'clear' }); }
      emit({ type: 'phase', phase: 'plan' });
    }

    function drawDraft() {
      var nextDay = st.day + 1;
      // REGRA DO DRAFT: so entra carta cuja ferramenta/condicao ja existe e foi ensinada.
      //  plus2, patient, smooth: sempre uteis (sem pre-requisito).
      //  freeRoad: Road desbloqueada (dia 1). freeLight: Light desbloqueada ate o dia seguinte.
      //  waveBonus: so com um PAR de semaforos ja feito no mapa (onda verde so existe com par; o
      //  pareamento e ensinado no dia 8, entao a carta nao aparece antes de o jogador parear).
      function hasPair() {
        for (var id in world.nodes) {
          var nd = world.nodes[id];
          if (nd && nd.tool === 'light' && nd.pair !== null && nd.pair !== undefined) return true;
        }
        return false;
      }
      var pool = CFG.cards.filter(function (cd) {
        if (cd.id === 'freeLight' && CFG.tools.light.unlockDay > nextDay) return false;
        // o dado de amanha (st.nextDie, previsao verdadeira) ja deixa o semaforo gratis: a carta seria redundante
        if (cd.id === 'freeLight' && st.nextDie && st.nextDie.effect && st.nextDie.effect.free === 'light') return false;
        if (cd.id === 'waveBonus' && (CFG.tools.light.unlockDay > nextDay || !hasPair())) return false;
        if (cd.id === 'freeRoad' && CFG.tools.road.unlockDay > nextDay) return false;
        return true;
      }), out = [];
      while (out.length < 3 && pool.length) {
        var ws = [];
        for (var i = 0; i < pool.length; i++) ws.push(pool[i].weight);
        var k = Rweighted(ws);
        out.push(pool[k].id);
        pool.splice(k, 1);
      }
      return out;
    }

    // o no que travou (para a tela de derrota e o resumo explicarem): id, tipo, grau, portal, posicao
    var lastLock = null;
    function lockInfo(id) {
      var n = world.nodes[id];
      if (!n) return;
      lastLock = { nodeId: n.id, tool: n.tool || null, degree: degree(n), portal: !!n.portal, x: n.x, y: n.y, day: st.day };
    }
    function finalOf(win) {
      var best = 0, bestN = -1;
      for (var i = 0; i < st.history.length; i++) if (st.history[i].delivered > bestN) { bestN = st.history[i].delivered; best = st.history[i].day; }
      // fechamento (a partida acaba no dia final sem tela de resumo): tudo sai de history/summary, que vao no save
      var sm = st.summary || {}, lastD = st.history.length ? st.history[st.history.length - 1].delivered : 0;
      var hard = 0, hardP = -1, lostSum = 0, failedDays = [], hasPeak = false;
      for (var j = 0; j < st.history.length; j++) {
        var h = st.history[j];
        if (h.failed) failedDays.push(h.day);
        if (fin(h.lost) && h.lost > 0) lostSum += h.lost;
        else if (j === st.history.length - 1 && fin(sm.lost) && sm.lost > 0) lostSum += sm.lost;
        if (fin(h.peak)) { hasPeak = true; if (h.peak > hardP) { hardP = h.peak; hard = h.day; } }
      }
      return { win: !!win, days: st.day, delivered: st.totalDelivered, strikes: st.strikes, bestDay: best, bestDelivered: Math.max(0, bestN),
               lock: lastLock ? clone(lastLock) : null,   // ultimo travamento da partida
               lastDelivered: lastD, lastFailed: !!(st.history.length && st.history[st.history.length - 1].failed),
               lastLost: fin(sm.lost) && sm.lost > 0 ? sm.lost : 0, lost: lostSum,
               hardestDay: hasPeak ? hard : 0, hardestPeak: hasPeak ? Math.round(Math.max(0, hardP) * 100) / 100 : 0, failedDays: failedDays };
    }
    function finishDay(failed) {
      var s = world.stats || {};
      var delivered = s.delivered || 0, spawned = s.spawned || 0;
      var avgWait = delivered > 0 ? (s.waitSum || 0) / delivered : 0;
      var waves = s.waveHits || 0;
      var score = delivered * 10 + waves * 2 - Math.round(avgWait);
      var gl = Math.max(s.gridlocks || 0, failed ? 1 : 0);
      // gorjeta: soma ao resto dos dias anteriores; cada perPoint vira 1 build point amanha
      var per = CFG.speedDial.tipsPerPoint, tipTotal = st.tipCarry + st.tips;
      var sb = Math.floor(tipTotal / per + 1e-9);
      st.speedBonus = sb;
      st.tipCarry = Math.max(0, tipTotal - sb * per);
      syncDial();
      var peak = 0, pids = sortedIds(world.nodes);
      for (var pi = 0; pi < pids.length; pi++) peak = Math.max(peak, world.nodes[pids[pi]].stress || 0, runHot[pids[pi]] || 0);
      var prevBest = 0, prevSum = 0, hn = st.history.length;
      for (pi = 0; pi < hn; pi++) { prevBest = Math.max(prevBest, st.history[pi].delivered); prevSum += st.history[pi].delivered; }
      var headline = failed ? 'Locked!'
        : peak >= 0.7 ? 'Close call'
        : (hn > 0 && delivered > prevBest) ? 'New record'
        : (hn > 0 && delivered > 1.1 * prevSum / hn) ? 'Busy day'
        : 'Smooth day';
      if (convoy) { teachSeen = true; convoy = null; }
      st.teach.seen = teachSeen;
      st.summary = {
        headline: headline, peak: Math.round(Math.min(1, peak) * 100) / 100,
        delivered: delivered, spawned: spawned, avgWait: Math.round(avgWait * 10) / 10,
        gridlocks: gl, waves: waves, failed: !!failed, score: score, lock: failed && lastLock && lastLock.day === st.day ? clone(lastLock) : null,
        tips: Math.round(st.tips), speedBonus: sb, tipCarry: Math.round(st.tipCarry * 100) / 100,
        // carros perdidos no dia (portal sem rota, mao unica): o sim conta cada carro uma vez. Gravado no
        // resumo para o "Lost cars: N" sobreviver a save/load (o world.stats zera no load)
        lost: s.lost || 0
      };
      st.clear.charges = 0; regenT = []; syncBoost();
      st.totalDelivered += delivered;
      st.totalScore += score;
      st.history.push({ day: st.day, delivered: delivered, failed: !!failed, lost: s.lost || 0, peak: Math.round(Math.min(1, peak) * 100) / 100 });
      if (failed) st.strikes++;
      // snapshot do estresse para o crescimento "perto do trafego"
      hot = {};
      var ids = sortedIds(world.nodes);
      for (var i = 0; i < ids.length; i++) {
        var n = world.nodes[ids[i]];
        var h = Math.max(n.stress || 0, runHot[ids[i]] || 0);
        if (h > 0.05) hot[ids[i]] = Math.min(1, h);
      }
      // pico do dia para o mapa de problemas (nao consome rng, nao toca o Sim)
      for (i = 0; i < ids.length; i++) {
        var pk = Math.max(world.nodes[ids[i]].stress || 0, runHot[ids[i]] || 0);
        if (pk >= HOT_MIN) st.hot[ids[i]] = Math.min(1, pk);
      }
      activeCards = [];
      st.cards = [];
      st.free.road = false; st.free.light = false;
      st.speed = st.speed || 1;
      if (st.strikes >= CFG.maxStrikes || st.day >= CFG.maxDays) {
        var win = st.strikes < CFG.maxStrikes;
        st.final = finalOf(win);
        st.phase = 'over';
        st.draft = null;
        refresh();
        emit({ type: 'phase', phase: 'over', failed: !!failed });
        emit({ type: 'over', win: win });
      } else {
        st.phase = 'summary';
        st.draft = drawDraft();
        refresh();
        emit({ type: 'phase', phase: 'summary', failed: !!failed });
      }
    }

    // ----- crescimento da cidade -----
    function degree(n) { return n.edges ? n.edges.length : 0; }
    // so conta portais da cidade (os das ruas do jogador tem rate < 1): sem isso, quem constroi
    // ruas cedo esgota o teto e os ramos que a cidade cria depois ficam sem carro nenhum
    function portalCount() {
      var c = 0, ids = sortedIds(world.nodes);
      for (var i = 0; i < ids.length; i++) { var n = world.nodes[ids[i]]; if (n.portal && !(n.rate > 0 && n.rate < 1)) c++; }
      return c;
    }
    // portais das ruas do jogador (taxa = builtPortalRate; o portal fraco da cidade usa growPortal.weakRate,
    // que precisa ser diferente): so eles contam no PORTAL_CAP
    function playerPortals() {
      var c = 0, ids = sortedIds(world.nodes);
      for (var i = 0; i < ids.length; i++) { var n = world.nodes[ids[i]]; if (n.portal && n.rate === CFG.builtPortalRate) c++; }
      return c;
    }
    function maxPortals(day) { return CFG.growPortal.cap(day); }

    function geoCtx() {
      var pts = [], segs = [], i, ids = sortedIds(world.nodes);
      for (i = 0; i < ids.length; i++) { var n = world.nodes[ids[i]]; pts.push({ x: n.x, y: n.y }); }
      ids = sortedIds(world.edges);
      for (i = 0; i < ids.length; i++) {
        var e = world.edges[ids[i]], a = world.nodes[e.a], b = world.nodes[e.b];
        if (a && b) segs.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } });
      }
      return { pts: pts, segs: segs };
    }
    function dirsFrom(P, s) {
      var out = [];
      if (dist(P.x, P.y, s.a.x, s.a.y) > 0.6) out.push(Math.atan2(s.a.y - P.y, s.a.x - P.x));
      if (dist(P.x, P.y, s.b.x, s.b.y) > 0.6) out.push(Math.atan2(s.b.y - P.y, s.b.x - P.x));
      return out;
    }
    function touches(P, s) { return ptSegDist(P.x, P.y, s.a.x, s.a.y, s.b.x, s.b.y) < 0.6; }
    function angleOk(P, s, ang) {
      var ds = dirsFrom(P, s);
      for (var i = 0; i < ds.length; i++) if (angDiff(ds[i], ang) < 0.7) return false; // ~40 graus
      return true;
    }
    // valida o segmento P->Q contra o mundo (nos, estradas) e o que ja foi planejado
    function validateSeg(P, Q, ctx, qEx) {
      var len = dist(P.x, P.y, Q.x, Q.y);
      if (len < CFG.minRoadLen - 0.5 || len > CFG.maxRoadLen + 0.5) return false;
      if (dist(Q.x, Q.y, 0, 0) > CFG.worldRadius - 30) return false;
      var ang = Math.atan2(Q.y - P.y, Q.x - P.x), i;
      for (i = 0; i < ctx.pts.length; i++) {
        var p = ctx.pts[i];
        if (dist(p.x, p.y, P.x, P.y) < 0.6) continue;
        var dq = dist(p.x, p.y, Q.x, Q.y);
        if (qEx && dq < 0.6) continue;
        if (dq < CFG.minNodeSpacing) return false;
        if (ptSegDist(p.x, p.y, P.x, P.y, Q.x, Q.y) < 0.6 * CFG.minNodeSpacing) return false;
      }
      var back = Math.atan2(P.y - Q.y, P.x - Q.x);
      for (i = 0; i < ctx.segs.length; i++) {
        var s = ctx.segs[i];
        var tp = touches(P, s), tq = qEx && touches(Q, s);
        if (tp && tq) return false;
        if (tp) { if (!angleOk(P, s, ang)) return false; continue; }
        if (tq) { if (!angleOk(Q, s, back)) return false; continue; }
        if (segSegDist(P, Q, s.a, s.b) < CLEAR) return false;
      }
      return true;
    }
    function addPlanned(ctx, P, Q, qEx) {
      ctx.segs.push({ a: { x: P.x, y: P.y }, b: { x: Q.x, y: Q.y } });
      if (!qEx) ctx.pts.push({ x: Q.x, y: Q.y });
    }
    function popPlanned(ctx, qEx) {
      ctx.segs.pop();
      if (!qEx) ctx.pts.pop();
    }

    function pickDir(P, prefer) {
      var ws = [], outward = dist(P.x, P.y, 0, 0) > 60 ? Math.atan2(P.y, P.x) : null;
      for (var k = 0; k < 8; k++) {
        var a = k * DEG45, w = 1;
        if (outward !== null) w += 1.2 * Math.max(0, Math.cos(a - outward));
        if (prefer !== undefined && prefer !== null && angDiff(a, prefer) < 0.1) w += 2.5;
        ws.push(w);
      }
      return Rweighted(ws) * DEG45;
    }
    function pickLen(longBias) {
      var span = CFG.maxRoadLen - CFG.minRoadLen;
      if (longBias) return CFG.minRoadLen + span * (0.75 + 0.25 * R());
      var r = R();
      if (r < 0.2) return CFG.minRoadLen + span * (0.7 + 0.3 * R());
      var u = R();
      return CFG.minRoadLen + span * u * u;
    }
    function trySeg(P, ctx, tries, prefer, longBias) {
      for (var i = 0; i < tries; i++) {
        var a = pickDir(P, prefer), L = pickLen(longBias);
        var Q = { x: r1(P.x + L * Math.cos(a)), y: r1(P.y + L * Math.sin(a)), ang: a };
        if (validateSeg(P, Q, ctx, false)) return Q;
      }
      return null;
    }

    // escolhe a origem: no existente (nao portal) ou ponto no meio de uma estrada
    function pickSource(ctx, edgeBias) {
      var nodeC = [], edgeC = [], i, ids = sortedIds(world.nodes);
      for (i = 0; i < ids.length; i++) {
        var n = world.nodes[ids[i]];
        if (degree(n) >= 4) continue;
        var rr = dist(n.x, n.y, 0, 0) / CFG.worldRadius;
        if (n.portal) {   // ponta da borda tambem cresce (o portal anda para a ponta nova): peso pelo raio
          if (degree(n) === 1 && CFG.growPortal.fromPortal > 0) nodeC.push({ node: n, w: CFG.growPortal.fromPortal * rr });
          continue;
        }
        var w = (1 + 3 * (hot[n.id] || 0)) / (1 + degree(n) * 0.5) * (1 + rr);
        nodeC.push({ node: n, w: w });
      }
      ids = sortedIds(world.edges);
      for (i = 0; i < ids.length; i++) {
        var e = world.edges[ids[i]];
        if (e.len < 2 * CFG.minNodeSpacing + 8) continue;
        edgeC.push({ edge: e, w: (e.len / 100) * (1 + 2 * Math.max(hot[e.a] || 0, hot[e.b] || 0)) });
      }
      var useEdge = edgeC.length > 0 && (nodeC.length === 0 || R() < edgeBias);
      if (useEdge) {
        var e2 = edgeC[Rweighted(edgeC.map(function (c) { return c.w; }))].edge;
        var a = world.nodes[e2.a], b = world.nodes[e2.b];
        var lo = (CFG.minNodeSpacing + 2) / e2.len, hi = 1 - lo;
        var t = lo + (hi - lo) * R();
        var P = { x: r1(a.x + t * (b.x - a.x)), y: r1(a.y + t * (b.y - a.y)) };
        for (i = 0; i < ctx.pts.length; i++) {
          if (dist(ctx.pts[i].x, ctx.pts[i].y, P.x, P.y) < CFG.minNodeSpacing + 1) return null;
        }
        return { P: P, edgeId: e2.id, nodeId: null };
      }
      if (!nodeC.length) return null;
      var nn = nodeC[Rweighted(nodeC.map(function (c) { return c.w; }))].node;
      return { P: { x: nn.x, y: nn.y }, edgeId: null, nodeId: nn.id };
    }

    function decidePortal(Q, newDay) {
      if (portalCount() >= maxPortals(newDay)) return false;
      var r = dist(Q.x, Q.y, 0, 0) / CFG.worldRadius;
      var p = Math.max(CFG.growPortal.min, Math.min(CFG.growPortal.max, CFG.growPortal.base + CFG.growPortal.perR * r));
      return R() < p;
    }

    // monta e aplica um plano: origem + lista de passos {from: -1|indice, Q}
    function commitPlan(src, steps, newDay, created) {
      var srcId = src.nodeId, i, made = 0;
      if (srcId === null) {
        var sn = world.splitEdge(src.edgeId, src.P.x, src.P.y);
        if (!sn) return 0;
        srcId = idOf(sn);
        created.push(srcId);
      }
      var endIds = [], srcN = world.nodes[srcId];
      // crescer a partir de um portal: a primeira ponta nova herda o portal (e a taxa), o no antigo vira rua comum
      var movePortal = !!(srcN && srcN.portal), moved = false, heirId = null, srcRate = srcN && srcN.rate;
      for (i = 0; i < steps.length; i++) {
        var step = steps[i];
        var fromId = step.from < 0 ? srcId : endIds[step.from];
        if (fromId === null || fromId === undefined) { endIds[i] = null; continue; }
        var leaf = true;
        for (var j = i + 1; j < steps.length; j++) if (steps[j].from === i) leaf = false;
        var opt, heir = leaf && movePortal && !moved;
        if (heir) opt = { portal: true, rate: srcRate };
        else if (leaf && decidePortal(step.Q, newDay)) opt = { portal: true };
        else if (leaf && CFG.growPortal.weakRate > 0) opt = { portal: true, rate: CFG.growPortal.weakRate }; // sem beco morto: portal fraco
        else opt = { portal: false };
        var nid = idOf(world.addNode(step.Q.x, step.Q.y, opt));
        if (nid === null || nid === undefined) { endIds[i] = null; continue; }
        var eid = world.addEdge(fromId, nid, { lanes: 1, oneway: 0 });
        if (eid === null || eid === undefined) { world.removeNode(nid); endIds[i] = null; continue; }
        if (heir) { moved = true; heirId = nid; }
        endIds[i] = nid;
        created.push(nid);
        made++;
      }
      if (moved && typeof world.setPortal === 'function') {
        world.setPortal(srcId, false);
        // carros parados do dia que acabou (somem no resetDay) seguem para o portal novo, mais adiante no mesmo ramo
        for (i = 0; i < world.cars.length; i++) if (world.cars[i].dest === srcId) world.cars[i].dest = heirId;
      }
      return made;
    }

    // ramo simples (1 segmento, as vezes 2 em cadeia)
    function growBranch(newDay, allowChain, created) {
      for (var k = 0; k < 10; k++) {
        var ctx = geoCtx();
        var src = pickSource(ctx, 0.35);
        if (!src) continue;
        var q1 = trySeg(src.P, ctx, 30, null, false);
        if (!q1) continue;
        var steps = [{ from: -1, Q: q1 }];
        if (allowChain && R() < 0.3) {
          addPlanned(ctx, src.P, q1, false);
          var q2 = trySeg(q1, ctx, 20, q1.ang, false);
          if (q2) steps.push({ from: 0, Q: q2 });
        }
        var m = commitPlan(src, steps, newDay, created);
        if (m > 0) return m;
      }
      return 0;
    }

    // bairro: uma estrada longa e um pequeno cacho de ruas no fim dela
    function growDistrict(newDay, created) {
      for (var k = 0; k < 10; k++) {
        var ctx = geoCtx();
        var src = pickSource(ctx, 0.2);
        if (!src) continue;
        var q0 = trySeg(src.P, ctx, 40, null, true);
        if (!q0) continue;
        var steps = [{ from: -1, Q: q0 }];
        addPlanned(ctx, src.P, q0, false);
        var kids = R() < 0.5 ? 2 : 3;
        for (var c = 0; c < kids; c++) {
          var q = trySeg(q0, ctx, 25, null, false);
          if (!q) continue;
          steps.push({ from: 0, Q: q });
          addPlanned(ctx, q0, q, false);
        }
        if (steps.length < 2) continue;
        var m = commitPlan(src, steps, newDay, created);
        if (m > 0) return m;
      }
      return 0;
    }

    // anel: liga dois nos ja existentes (direto ou por um canto novo)
    function growRing(created) {
      var ctx = geoCtx(), ids = sortedIds(world.nodes), i, j, list = [];
      for (i = 0; i < ids.length; i++) if (!world.nodes[ids[i]].portal) list.push(world.nodes[ids[i]]);
      // adjacencia
      var adj = {}, eids = sortedIds(world.edges);
      for (i = 0; i < eids.length; i++) {
        var e = world.edges[eids[i]];
        (adj[e.a] = adj[e.a] || []).push(e.b);
        (adj[e.b] = adj[e.b] || []).push(e.a);
      }
      var cands = [], ws = [];
      for (i = 0; i < list.length; i++) {
        var A = list[i], hops = {}, queue = [A.id];
        hops[A.id] = 0;
        for (var qi = 0; qi < queue.length; qi++) {
          var nb = adj[queue[qi]] || [];
          for (j = 0; j < nb.length; j++) if (hops[nb[j]] === undefined) { hops[nb[j]] = hops[queue[qi]] + 1; queue.push(nb[j]); }
        }
        for (j = i + 1; j < list.length; j++) {
          var B = list[j];
          if (hops[B.id] === undefined || hops[B.id] < 3) continue;
          var d = dist(A.x, A.y, B.x, B.y);
          if (d > 2 * CFG.maxRoadLen) continue;
          // direto
          var ba = Math.atan2(B.y - A.y, B.x - A.x), snapped = Math.round(ba / DEG45) * DEG45;
          if (d >= CFG.minRoadLen && d <= CFG.maxRoadLen && angDiff(ba, snapped) < 0.012) {
            if (validateSeg(A, B, ctx, true)) { cands.push({ A: A, B: B, M: null }); ws.push(hops[B.id] + 2); }
          }
          // por um canto
          for (var k1 = 0; k1 < 8; k1++) {
            for (var k2 = 0; k2 < 8; k2++) {
              if (k1 === k2) continue;
              var u1x = Math.cos(k1 * DEG45), u1y = Math.sin(k1 * DEG45);
              var u2x = Math.cos(k2 * DEG45), u2y = Math.sin(k2 * DEG45);
              var den = u1x * u2y - u1y * u2x;
              if (Math.abs(den) < 0.1) continue;
              var dx = B.x - A.x, dy = B.y - A.y;
              var s = (dx * u2y - dy * u2x) / den;
              var t = (dx * u1y - dy * u1x) / den;
              if (s < CFG.minRoadLen || s > CFG.maxRoadLen || t < CFG.minRoadLen || t > CFG.maxRoadLen) continue;
              var M = { x: r1(A.x + s * u1x), y: r1(A.y + s * u1y) };
              if (!validateSeg(A, M, ctx, false)) continue;
              addPlanned(ctx, A, M, false);
              var ok = validateSeg(M, B, ctx, true);
              popPlanned(ctx, false);
              if (ok) { cands.push({ A: A, B: B, M: M }); ws.push(hops[B.id]); }
            }
          }
        }
      }
      // CFG.trafficBalance.usefulGrowth: so fica o anel que encurta o caminho de algum par de pontas (sem isso ele
      // podia ligar dois nos fora de qualquer rota e a rua ficava vazia). Desligado: mesma lista, mesmo rng.
      var TB = CFG.trafficBalance;
      if (TB && TB.usefulGrowth && cands.length) {
        var pd = portalDists(), keep = [], kw = [], minG = TB.usefulMin > 0 ? TB.usefulMin : 1;
        for (i = 0; i < cands.length; i++) {
          var cc = cands[i], L = cc.M ? dist(cc.A.x, cc.A.y, cc.M.x, cc.M.y) + dist(cc.M.x, cc.M.y, cc.B.x, cc.B.y) : dist(cc.A.x, cc.A.y, cc.B.x, cc.B.y);
          if (ringUseful(pd, cc.A.id, cc.B.id, L, minG)) { keep.push(cc); kw.push(ws[i]); }
        }
        cands = keep; ws = kw;
      }
      if (!cands.length) return 0;
      var c = cands[Rweighted(ws)], e1, e2, mid;
      if (!c.M) {
        e1 = world.addEdge(c.A.id, c.B.id, { lanes: 1, oneway: 0 });
        if (e1 === null || e1 === undefined) return 0;
        return 1;
      }
      mid = idOf(world.addNode(c.M.x, c.M.y, { portal: false }));
      if (mid === null || mid === undefined) return 0;
      e1 = world.addEdge(c.A.id, mid, { lanes: 1, oneway: 0 });
      if (e1 === null || e1 === undefined) { world.removeNode(mid); return 0; }
      e2 = world.addEdge(mid, c.B.id, { lanes: 1, oneway: 0 });
      if (e2 === null || e2 === undefined) { world.removeEdge(e1); world.removeNode(mid); return 0; }
      created.push(mid);
      return 2;
    }

    // distancias (comprimento, nos dois sentidos) de cada ponta a todos os nos: { portals: [ids], d: {pid: {nid: px}} }
    function portalDists() {
      var ids = sortedIds(world.nodes), eids = sortedIds(world.edges), adj = {}, i, out = { portals: [], d: {} };
      for (i = 0; i < eids.length; i++) {
        var e = world.edges[eids[i]], a = world.nodes[e.a], b = world.nodes[e.b], L = e.len || dist(a.x, a.y, b.x, b.y);
        (adj[e.a] = adj[e.a] || []).push({ to: e.b, len: L });
        (adj[e.b] = adj[e.b] || []).push({ to: e.a, len: L });
      }
      for (i = 0; i < ids.length; i++) if (world.nodes[ids[i]].portal) out.portals.push(ids[i]);
      for (i = 0; i < out.portals.length; i++) {
        var src = out.portals[i], d = {}, done = {};
        d[src] = 0;
        for (;;) {
          var u = null;
          for (var key in d) if (!done[key] && (u === null || d[key] < d[u])) u = key;
          if (u === null) break;
          done[u] = true;
          var nb = adj[u] || [];
          for (var q = 0; q < nb.length; q++) { var nd = d[u] + nb[q].len; if (d[nb[q].to] === undefined || nd < d[nb[q].to]) d[nb[q].to] = nd; }
        }
        out.d[src] = d;
      }
      return out;
    }
    // a ligacao A-B de comprimento L encurta o caminho de algum par de pontas em mais de minG px?
    function ringUseful(pd, A, B, L, minG) {
      var P = pd.portals;
      for (var i = 0; i < P.length; i++) {
        var di = pd.d[P[i]];
        if (di[A] === undefined || di[B] === undefined) continue;
        for (var j = 0; j < P.length; j++) {
          if (j === i) continue;
          var dj = pd.d[P[j]], cur = di[P[j]];
          if (cur === undefined || dj[A] === undefined) continue;
          if (Math.min(di[A] + L + dj[B], di[B] + L + dj[A]) < cur - minG) return true;
        }
      }
      return false;
    }

    function teesOf() {
      var out = [], ids = sortedIds(world.nodes);
      for (var i = 0; i < ids.length; i++) { var n = world.nodes[ids[i]]; if (!n.portal && degree(n) >= 3) out.push(n); }
      return out;
    }
    var NEAR_T = 2 * CFG.maxRoadLen;   // dois T a ate essa distancia contam como "par para o semaforo"
    function lightSpot() {
      var t = teesOf(), i, j;
      for (i = 0; i < t.length; i++) if (degree(t[i]) >= 4) return true;
      for (i = 0; i < t.length; i++) for (j = i + 1; j < t.length; j++) if (dist(t[i].x, t[i].y, t[j].x, t[j].y) <= NEAR_T) return true;
      return false;
    }
    // ramo a partir de uma origem escolhida (no ou ponto de estrada) — mesma validacao do crescimento normal
    function branchFrom(src, newDay, created) {
      var ctx = geoCtx();
      if (src.edgeId !== null) {
        for (var i = 0; i < ctx.pts.length; i++) if (dist(ctx.pts[i].x, ctx.pts[i].y, src.P.x, src.P.y) < CFG.minNodeSpacing + 1) return 0;
      }
      var q = trySeg(src.P, ctx, 40, null, false);
      if (!q) return 0;
      return commitPlan(src, [{ from: -1, Q: q }], newDay, created);
    }
    function edgePoint(e, t) {
      var a = world.nodes[e.a], b = world.nodes[e.b];
      return { P: { x: r1(a.x + t * (b.x - a.x)), y: r1(a.y + t * (b.y - a.y)) }, edgeId: e.id, nodeId: null };
    }
    // T: ramo saindo do meio de uma estrada, ou de um no comum de grau 2
    function ensureTee(created) {
      var eids = sortedIds(world.edges), ids = sortedIds(world.nodes), i, k;
      for (i = 0; i < ids.length; i++) {
        var n = world.nodes[ids[i]];
        if (!n.portal && degree(n) === 2 && branchFrom({ P: { x: n.x, y: n.y }, edgeId: null, nodeId: n.id }, 3, created)) return true;
      }
      var ts = [0.5, 0.35, 0.65, 0.25, 0.75];
      for (k = 0; k < ts.length; k++) for (i = 0; i < eids.length; i++) {
        var e = world.edges[eids[i]];
        if (e.len < 2 * CFG.minNodeSpacing + 8) continue;
        if (branchFrom(edgePoint(e, ts[k]), 3, created)) return true;
      }
      return false;
    }
    // 4 estradas: ramo saindo de um T; senao um segundo T numa estrada que encosta num T
    function ensureLightSpot(created) {
      var t = teesOf(), i, j, k;
      for (i = 0; i < t.length; i++) if (degree(t[i]) === 3 && branchFrom({ P: { x: t[i].x, y: t[i].y }, edgeId: null, nodeId: t[i].id }, 5, created)) return true;
      var ts = [0.5, 0.35, 0.65];
      for (i = 0; i < t.length; i++) for (k = 0; k < ts.length; k++) for (j = 0; j < t[i].edges.length; j++) {
        var e = world.edges[idOf(t[i].edges[j])];
        if (!e || e.len < 2 * CFG.minNodeSpacing + 8) continue;
        if (branchFrom(edgePoint(e, ts[k]), 5, created)) return true;
      }
      return ensureTee(created) && lightSpot();
    }

    // ----- comboio do dia 3 (nao consome o rng do jogo; sendCar usa o rng do Sim) -----
    var teachOn = opts.teach !== false, teachSeen = false, convoy = null;
    // caminhos minimos (por comprimento) entre portais; conta por quantos pares cada no passa
    function portalPaths() {
      var ids = sortedIds(world.nodes), adj = {}, i, portals = [];
      var eids = sortedIds(world.edges);
      for (i = 0; i < eids.length; i++) {
        var e = world.edges[eids[i]];
        (adj[e.a] = adj[e.a] || []).push({ to: e.b, len: e.len || dist(world.nodes[e.a].x, world.nodes[e.a].y, world.nodes[e.b].x, world.nodes[e.b].y) });
        (adj[e.b] = adj[e.b] || []).push({ to: e.a, len: e.len || dist(world.nodes[e.a].x, world.nodes[e.a].y, world.nodes[e.b].x, world.nodes[e.b].y) });
      }
      for (i = 0; i < ids.length; i++) if (world.nodes[ids[i]].portal) portals.push(ids[i]);
      var paths = {};
      for (i = 0; i < portals.length; i++) {
        var src = portals[i], d = {}, prev = {}, done = {};
        d[src] = 0;
        for (;;) {
          var u = null;
          for (var key in d) if (!done[key] && (u === null || d[key] < d[u] || (d[key] === d[u] && +key < +u))) u = key;
          if (u === null) break;
          done[u] = true;
          var nb = adj[u] || [];
          for (var q = 0; q < nb.length; q++) {
            var v = nb[q].to, nd = d[u] + nb[q].len;
            if (d[v] === undefined || nd < d[v] - 1e-9) { d[v] = nd; prev[v] = +u; }
          }
          if (world.nodes[u].portal && +u !== src) { /* segue: precisamos de todos */ }
        }
        paths[src] = {};
        for (var j = 0; j < portals.length; j++) {
          var dst = portals[j];
          if (dst === src || d[dst] === undefined) continue;
          var path = [], c = dst;
          while (c !== src && c !== undefined) { path.push(c); c = prev[c]; }
          paths[src][dst] = path;
        }
      }
      return { portals: portals, paths: paths };
    }
    function planConvoy() {
      var tees = teesOf();
      if (!tees.length) return null;
      var pp = portalPaths(), use = {}, i, j, k;
      for (i = 0; i < pp.portals.length; i++) for (var dst in pp.paths[pp.portals[i]]) {
        var path = pp.paths[pp.portals[i]][dst];
        for (k = 0; k < path.length; k++) use[path[k]] = (use[path[k]] || 0) + 1;
      }
      var target = null;
      for (i = 0; i < tees.length; i++) {
        var t = tees[i], u = (use[t.id] || 0) + (hot[t.id] || 0);
        if (!target || u > target.u) target = { node: t, u: u };
      }
      target = target.node;
      // fontes: portais cujas rotas passam pelo alvo (fracao), o mais distante do centro primeiro
      var srcs = [];
      for (i = 0; i < pp.portals.length; i++) {
        var p = pp.portals[i], tot = 0, via = 0;
        for (var dd in pp.paths[p]) { tot++; if (pp.paths[p][dd].indexOf(target.id) >= 0) via++; }
        if (tot && via > 0 && via / tot >= TEACH.minFrac) srcs.push({ id: p, f: via / tot, r: dist(world.nodes[p].x, world.nodes[p].y, 0, 0) });
      }
      if (!srcs.length) return null;
      srcs.sort(function (a, b) { return (b.f - a.f) || (b.r - a.r) || (a.id - b.id); });
      var r = sideRng(307, st.day)();
      var n = TEACH.convoyMin + Math.floor(r * (TEACH.convoyMax - TEACH.convoyMin + 1));
      return { target: target.id, srcs: srcs.slice(0, TEACH.maxSrc).map(function (x) { return x.id; }), left: n, total: n, k: 0 };
    }
    function convoyStep() {
      if (!convoy || convoy.left <= 0 || st.dayTime > TEACH.window) return;
      var tn = world.nodes[convoy.target];
      if (tn && (tn.stress || 0) >= TEACH.stopAt) { convoy.left = 0; return; }   // o anel apareceu: para a rajada
      // rajada: um carro por passo no maximo; alterna as fontes (o Sim recusa sem espaco, sem sobrepor)
      var sid = convoy.srcs[convoy.k % convoy.srcs.length];
      convoy.k++;
      if (typeof world.sendCar === 'function' && world.sendCar(sid)) { convoy.left--; st.teach.sent++; }
    }

    function grow(newDay) {
      var created = [];
      var n = 1 + (newDay >= 4 ? 1 : 0) + (newDay >= 8 ? 1 : 0);
      if (newDay === 2) n = 1; else if (R() < 0.35) n++;
      n = Math.min(3, n);
      var guard = 0;
      while (n > 0 && guard++ < 12) {
        var made;
        if (newDay >= 4 && n >= 2 && R() < 0.22) {
          made = growDistrict(newDay, created);
          if (made > 0) { n -= made; continue; }
        }
        made = growBranch(newDay, n >= 2, created);
        if (made <= 0) break;
        n -= made;
      }
      var GR = CFG.growRing || { fromDay: 6, base: 1, extraP: 0.4, lateDay: 99 };
      if (newDay >= GR.fromDay) {   // aneis: ligam nos ja existentes e criam cruzamentos novos sem sinal
        var rings = GR.base + (R() < GR.extraP ? 1 : 0) + (newDay >= GR.lateDay ? 1 : 0);
        for (var i = 0; i < rings; i++) growRing(created);
      }
      // garantias da primeira viagem: um T ate o dia 3, e um cruzamento de 4 ou dois T proximos ate o 5.
      // So consome rng quando a garantia falta (cidades que ja cumprem crescem exatamente igual).
      if (newDay === 3 && !teesOf().length) ensureTee(created);
      if (newDay === 5 && !lightSpot()) ensureLightSpot(created);
      emit({ type: 'grow', nodeIds: created });
      return created;
    }

    function advance(card) {
      var left = st.budget;
      activeCards = card ? [card] : [];
      st.draft = null;
      var nd = st.day + 1;
      grow(nd);
      enterPlan(nd, left);
    }

    // ----- desfazer -----
    function capture() {
      return { layout: world.cloneLayout(), budget: st.budget, placed: clone(placed),
               free: { road: st.free.road, light: st.free.light },
               die: st.die ? clone(st.die) : null, rerolled: st.rerolled };
    }
    function fail(reason) { return { ok: false, reason: reason }; }
    // id vindo de fora: so numero (ou string numerica) que seja chave propria; barra '__proto__', 'constructor', etc.
    function validKey(id) {
      return (typeof id === 'number' && isFinite(id)) || (typeof id === 'string' && /^\d+$/.test(id));
    }
    function getNode(id) { return validKey(id) && Object.prototype.hasOwnProperty.call(world.nodes, id) ? world.nodes[id] : null; }
    function getEdge(id) { return validKey(id) && Object.prototype.hasOwnProperty.call(world.edges, id) ? world.edges[id] : null; }
    function needPlan() { return st.phase === 'plan'; }

    // ----- objeto publico -----
    var g = { world: world, state: st };

    g.cost = costOf;
    g.canAfford = function (tool) { return isUnlocked(tool) && st.budget >= costOf(tool); };
    // efeito de uma carta (copia de CFG.cardEffects) com active = vale hoje; null para id desconhecido
    g.cardInfo = function (id) {
      if (!CFG.cardEffects || !own(CFG.cardEffects, id)) return null;
      var o = clone(CFG.cardEffects[id]);
      o.id = id; o.active = hasCard(id);
      return o;
    };

    g.placeTool = function (nodeId, tool) {
      if (!needPlan()) return fail('phase');
      if (!own(PLACEABLE, tool)) return fail('tool');
      if (!isUnlocked(tool)) return fail('locked');
      var n = getNode(nodeId);
      if (!n) return fail('node');
      nodeId = n.id;
      // regra unica, por grau (portal ou nao): sinal so onde 3+ ruas se encontram; faixa de pedestre
      // onde a rua passa (2+). Ponta de rua com portal: 'portal'; curva, reta ou beco: 'notjunction'.
      // Portal que virou cruzamento (o jogador estendeu a rua a partir dele) segue a mesma regra.
      if (n.portal && degree(n) < 2) return fail('portal');
      if (degree(n) < (tool === 'cross' ? 2 : 3)) return fail('notjunction');
      if (n.tool === tool) return fail('same');
      var refund = placed[nodeId] || 0, c = costOf(tool);
      if (st.budget + refund < c) return fail('budget');
      var entry = capture();
      if (n.pair !== null && n.pair !== undefined && tool !== 'light') world.unpair(nodeId);
      world.setTool(nodeId, tool);
      if (tool === 'light' && st.free.light) st.free.light = false;
      st.budget = st.budget + refund - c;
      placed[nodeId] = c;
      undoStack.push(entry);
      refresh();
      emit({ type: 'built', x: n.x, y: n.y, kind: tool });
      return { ok: true, id: nodeId };
    };

    g.removeTool = function (nodeId) {
      if (!needPlan()) return fail('phase');
      var n = getNode(nodeId);
      if (!n) return fail('node');
      nodeId = n.id;
      if (!n.tool) return fail('notool');
      var entry = capture();
      if (n.pair !== null && n.pair !== undefined) world.unpair(nodeId);
      world.setTool(nodeId, null);
      st.budget += placed[nodeId] || 0;
      delete placed[nodeId];
      undoStack.push(entry);
      refresh();
      return { ok: true, id: nodeId };
    };

    g.upgradeRoad = function (edgeId) {
      if (!needPlan()) return fail('phase');
      if (!isUnlocked('upgrade')) return fail('locked');
      var e = getEdge(edgeId);
      if (!e) return fail('edge');
      edgeId = e.id;
      if (e.lanes >= 2) return fail('same');
      var c = costOf('upgrade');
      if (st.budget < c) return fail('budget');
      var entry = capture();
      world.setLanes(edgeId, 2);
      st.budget -= c;
      undoStack.push(entry);
      refresh();
      var a = world.nodes[e.a], b = world.nodes[e.b];
      emit({ type: 'built', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, kind: 'upgrade' });
      return { ok: true, id: edgeId };
    };

    g.setOneway = function (edgeId, dir) {
      if (!needPlan()) return fail('phase');
      if (!isUnlocked('oneway')) return fail('locked');
      var e = getEdge(edgeId);
      if (!e) return fail('edge');
      edgeId = e.id;
      if (dir !== 0 && dir !== 1 && dir !== -1) return fail('dir');
      if (e.oneway === dir) return fail('same');
      var c = dir === 0 ? 0 : costOf('oneway'); // voltar a duas maos e gratis
      if (st.budget < c) return fail('budget');
      var entry = capture();
      world.setOneway(edgeId, dir);
      st.budget -= c;
      undoStack.push(entry);
      refresh();
      var a = world.nodes[e.a], b = world.nodes[e.b];
      emit({ type: 'built', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, kind: 'oneway' });
      return { ok: true, id: edgeId };
    };

    g.pairLights = function (aId, bId) {
      if (!needPlan()) return fail('phase');
      var a = getNode(aId), b = getNode(bId);
      if (!a || !b || a === b) return fail('node');
      aId = a.id; bId = b.id;
      if (a.tool !== 'light' || b.tool !== 'light') return fail('notlight');
      if (a.pair === bId && b.pair === aId) return fail('same');
      var entry = capture();
      world.pairLights(aId, bId);
      undoStack.push(entry);
      return { ok: true };
    };

    // buildRoad: segue exatamente o plano de world.canAddEdge (o mesmo que a UI mostrou no fantasma).
    // Plano: cruzamentos no caminho (cada um corta a estrada cruzada e vira no), depois o fim:
    // no existente (nodeId), T sobre estrada (edgeId) ou ponta solta (no novo, vira portal).
    // Recusa: reason 'invalid' (ou 'radius'), e why = motivo do Sim (short, long, range, near, ...).
    g.buildRoad = function (fromId, x, y) {
      if (!needPlan()) return fail('phase');
      if (!isUnlocked('road')) return fail('locked');
      var from = getNode(fromId);
      if (!from) return fail('node');
      fromId = from.id;
      if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) return fail('coord');
      var c = costOf('road');
      if (st.budget < c) return fail('budget');
      var BUILD_R = CFG.buildRadius || CFG.worldRadius;
      var r = world.canAddEdge(fromId, x, y);
      if (!r || !r.ok) {
        var fr = fail(r && r.reason === 'range' ? 'radius' : 'invalid');
        if (r && typeof r.reason === 'string') fr.why = r.reason;
        return fr;
      }
      var tx = r.x, ty = r.y;
      if (dist(tx, ty, 0, 0) > BUILD_R + 1e-6) { var fo = fail('radius'); fo.why = 'range'; return fo; }
      var entry = capture();
      var chain = [fromId], okB = true, endNode = null, i, sn, hit;
      // 1) cruzamentos (o Sim garante que cada estrada cruzada aparece uma vez e que nenhuma e o alvo do T)
      var cross = r.cross || [];
      for (i = 0; okB && i < cross.length; i++) {
        sn = idOf(world.splitEdge(cross[i].edgeId, cross[i].x, cross[i].y));
        if (sn === null || sn === undefined) okB = false; else chain.push(sn);
      }
      // 2) fim
      if (okB) {
        var endId = null;
        if (r.nodeId !== undefined && r.nodeId !== null && world.nodes[r.nodeId]) endId = r.nodeId;
        else if (r.edgeId !== undefined && r.edgeId !== null && world.edges[r.edgeId]) endId = idOf(world.splitEdge(r.edgeId, tx, ty));
        else if (r.end === 'free') {
          endId = idOf(world.addNode(tx, ty, { portal: playerPortals() < PORTAL_CAP, rate: CFG.builtPortalRate }));
        } else {
          // sim sem r.end (stub dos testes): procura no ou estrada no ponto final
          var near = world.nearestNode(tx, ty, CFG.minNodeSpacing);
          if (near && near.id === fromId) near = null;
          hit = near ? null : world.nearestEdge(tx, ty, 14);
          if (near) endId = near.id;
          else if (hit && hit.dist < 14) endId = idOf(world.splitEdge(hit.edge.id, hit.x, hit.y));
          // a ponta nova vira portal: a rua construida passa a gerar e receber carros (muda o jogo na hora)
          else endId = idOf(world.addNode(tx, ty, { portal: playerPortals() < PORTAL_CAP, rate: CFG.builtPortalRate }));
        }
        if (endId === null || endId === undefined || !world.nodes[endId]) okB = false;
        else { chain.push(endId); endNode = world.nodes[endId]; }
      }
      // 3) estradas ao longo da cadeia
      var eid = null;
      for (i = 0; okB && i < chain.length - 1; i++) {
        var e1 = idOf(world.addEdge(chain[i], chain[i + 1], { lanes: 1, oneway: 0, free: true }));
        if (e1 === null || e1 === undefined) okB = false;
        else if (eid === null) eid = e1;
      }
      if (!okB) {
        world.restore(entry.layout); world.day = st.day;
        return fail('invalid');
      }
      if (st.free.road) st.free.road = false;
      st.budget -= c;
      undoStack.push(entry);
      refresh();
      emit({ type: 'built', x: endNode ? endNode.x : tx, y: endNode ? endNode.y : ty, kind: 'road' });
      // deadEnd: a ponta solta nao virou portal (teto de portais do jogador): nenhum carro vem aqui
      var res = { ok: true, id: eid };
      if (endNode && !endNode.portal && degree(endNode) === 1) res.deadEnd = true;
      return res;
    };

    g.canUndo = function () { return st.phase === 'plan' && undoStack.length > 0; };
    g.undo = function () {
      if (!g.canUndo()) return { ok: false };
      var e = undoStack.pop();
      world.restore(e.layout);
      world.day = st.day;
      st.budget = e.budget;
      placed = e.placed;
      st.free.road = e.free.road;
      st.free.light = e.free.light;
      var dieBack = JSON.stringify(st.die) !== JSON.stringify(e.die);
      st.die = e.die;
      st.rerolled = e.rerolled;
      refresh();
      if (dieBack) emit({ type: 'die', die: clone(st.die), next: st.nextDie ? clone(st.nextDie) : null });
      return { ok: true };
    };

    // ----- dado: relance (1x por dia, so no planejamento) -----
    g.canReroll = function () { return rerollBlock() === null; };
    g.rerollDie = function () {
      var why = rerollBlock();
      if (why) return { ok: false, reason: why, die: st.die ? clone(st.die) : null };
      var entry = capture(), old = st.die, t = dieGrant(old);
      st.budget -= ((old.effect && old.effect.budget) || 0) + CFG.dice.rerollCost;
      if (t && !cardGrants(t)) st.free[t] = false;
      st.die = rollDie(st.day, sideRng(101, st.day));
      st.rerolled = true;
      applyDie(st.die);
      undoStack.push(entry);
      refresh();
      emit({ type: 'die', die: clone(st.die), next: st.nextDie ? clone(st.nextDie) : null });
      return { ok: true, die: clone(st.die) };
    };

    // ----- fluxo -----
    g.startDay = function () {
      if (st.phase !== 'plan') return fail('phase');
      var o = (st.die && st.die.effect) || {};
      function mul(v) { return typeof v === 'number' && isFinite(v) && v > 0 ? v : 1; }
      world.resetDay();
      world.day = st.day;
      var p = world.params = world.params || {};
      // dado x cartas, a partir de 1 a cada dia (nao acumula de um dia para o outro)
      p.spawnMul = mul(o.spawnMul);
      p.speedMul = mul(o.speedMul) * (hasCard('smooth') ? cardFx('smooth').speedMul : 1);
      basePatience = mul(o.patienceMul) * (hasCard('patient') ? cardFx('patient').patienceMul : 1);
      applyPatience();                              // x paciencia da velocidade atual
      p.waveMul = hasCard('waveBonus') ? cardFx('waveBonus').waveMul : 1;
      st.dayTime = 0;
      st.dayLen = CFG.dayLen[st.day - 1];
      st.phase = 'run';
      st.paused = false;
      st.ff = false;
      st.tips = 0; syncDial();
      convoy = (teachOn && !teachSeen && st.day === TEACH.day) ? planConvoy() : null;
      st.teach.day3Convoy = !!convoy;
      st.teach.sent = 0;
      st.teach.target = convoy ? convoy.target : null;   // cruzamento que o tutorial aponta
      if (convoy) p.spawnMul = Math.min(p.spawnMul, TEACH.spawnCap) * TEACH.spawnMul;
      syncModes(CFG.clear.charges);                // cargas renovadas a cada dia
      undoStack = [];
      acc = 0; stepCount = 0; dayFailed = false; runHot = {}; st.hot = {};
      refresh();
      emit({ type: 'phase', phase: 'run' });
      return { ok: true };
    };

    // velocidade do jogador (CFG.speedDial.levels), em qualquer fase; vale como preferencia para os
    // proximos dias. No meio do dia a paciencia muda na hora (o Sim le params.patienceMul a cada passo).
    // ----- fast-forward (CFG.fastForward) -----
    // Um quadro de tela em ff = round(ff.speed / st.speed) quadros normais seguidos com o mesmo dt: os passos fixos, a
    // velocidade (paciencia) e a ordem dos estados sao os de sem ff; so o tempo de parede encolhe. st.speed nao muda.
    function ffCfg() { return CFG.fastForward || { speed: 8, autoSlowStress: 0.3, bonusSpeedCap: 4 }; }
    function hotNow() {
      var lim = ffCfg().autoSlowStress, k = sortedIds(world.nodes);
      for (var i = 0; i < k.length; i++) if ((world.nodes[k[i]].stress || 0) >= lim) return true;
      return false;
    }
    function endFF(reason) {
      if (!st.ff) return;
      st.ff = false;
      emit({ type: 'ffEnd', reason: reason });
    }
    // gorjeta por carro: a recompensa da velocidade escolhida, capada em bonusSpeedCap x durante o ff
    function rewardNow() {
      if (!st.ff) return levelOf(st.speed).reward;
      var cap = ffCfg().bonusSpeedCap, L = CFG.speedDial.levels, best = L[0];
      for (var i = 0; i < L.length; i++) if (L[i].speed <= Math.min(st.speed, cap) && L[i].speed >= best.speed) best = L[i];
      return best.reward;
    }
    g.setFastForward = function (on) {
      if (!on) { endFF('player'); return { ok: true, ff: false }; }
      if (st.phase !== 'run' || st.paused) return fail('phase');
      if (hotNow()) return fail('ring');             // ja ha anel: nada de pular
      if (!st.ff) { st.ff = true; emit({ type: 'ffStart' }); }
      return { ok: true, ff: true };
    };

    g.setSpeed = function (sp) {
      if (!speedOk(sp)) return false;
      endFF('player');
      if (st.speed !== sp) {
        st.speed = sp;
        if (st.phase === 'run') applyPatience();
        emit({ type: 'speed', speed: sp });
      }
      return true;
    };

    // Boost (CFG.clear), dois usos pelo alvo. Portal: manda um carro extra agora (world.sendCar;
    // conta como entrega normal). Cruzamento: Clear, escoa a fila por alguns segundos (world.boost).
    // Portal com 3+ estradas e estresse >= 0.5 e tratado como cruzamento. Nao consome rng.
    g.useClear = function (nodeId) {
      endFF('player');                                // toque numa ponta ou Boost: a jogadora agiu
      if (st.phase !== 'run' || st.paused) return fail('phase');
      if (!clearUnlocked()) return fail('locked');
      if (!(st.clear.charges > 0)) return fail('charges');
      var n = getNode(nodeId);
      if (!n) return fail('node');
      // ponta de rua (1 estrada): manda carro; qualquer no com 2+ estradas, portal ou nao: escoa a fila
      var kind = (n.portal && degree(n) < 2) ? 'send' : 'clear';
      var minS = CFG.clear.minStress || 0;
      // 4o Boost do dia em diante (so existe com a recarga dos dias de aprendizado): fora do teto diario,
      // e o carro mandado nao paga gorjeta
      var extraUse = !(bUsed < CFG.clear.charges);
      if (kind === 'send') {
        // ponta cuja rua esta na fila do cruzamento a frente: mandar carro piora; a UI aponta `ahead`
        var e0 = n.edges.length ? world.edges[idOf(n.edges[0])] : null, ah = e0 ? world.nodes[e0.a === n.id ? e0.b : e0.a] : null;
        if (ah && (ah.stress || 0) >= 0.5) { var fq = fail('portalQueue'); fq.ahead = ah.id; return fq; }
        if (typeof world.sendCar === 'function' && world.sendCar(n.id, extraUse ? { noTip: true } : undefined) === false) return fail('space');
      } else if (minS > 0 && !((n.stress || 0) > minS)) {
        return fail('calm');                      // sem fila: nao gasta a carga
      } else if (typeof world.boost === 'function') {
        world.boost(n.id, CFG.clear.seconds, CFG.clear.mul, CFG.clear.stressRelief);
      }
      st.clear.charges--;
      if (extraUse) bExtra++; else bUsed++;
      if (earlyOn()) regenT.push(CFG.earlyBoost.regenSeconds);
      syncBoost();
      var cev = { type: 'clear', nodeId: n.id, left: st.clear.charges, kind: kind }, res = { ok: true, id: n.id, left: st.clear.charges, kind: kind };
      if (extraUse) { cev.extra = true; res.extra = true; }   // so aparece no Boost alem das 3 cargas do dia
      emit(cev);
      return res;
    };

    g.setPaused = function (p) {
      endFF('player');
      st.paused = !!p;
      return st.paused;
    };

    g.update = function (dt) {
      if (!st.ff) return frame(dt);
      var n = Math.max(1, Math.round(ffCfg().speed / st.speed));
      for (var k = 0; k < n && st.ff; k++) frame(dt);   // o ff pode terminar no meio: o resto do quadro nao roda
    };
    function frame(dt) {
      if (st.phase !== 'run' || st.paused || !(dt > 0)) return;
      acc += dt * st.speed;
      if (acc > 4) acc = 4;
      while (acc >= STEP && st.phase === 'run') {
        acc -= STEP;
        convoyStep();
        world.step(STEP);
        st.dayTime += STEP;
        stepCount++;
        // todo evento do sim segue para a UI (onEvent), inclusive { type: 'lost', nodeId, lost }: um carro
        // desistiu no portal nodeId (mao unica sem saida); lost = total do dia. summary.lost guarda o total.
        var evs = world.drainEvents() || [];
        for (var i = 0; i < evs.length; i++) {
          emit(evs[i]);
          if (evs[i].type === 'gridlock') { dayFailed = true; lockInfo(evs[i].nodeId); }
          else if (evs[i].type === 'arrive' && !evs[i].noTip) st.tips += rewardNow();
        }
        if (stepCount % 10 === 0) {
          var ids = sortedIds(world.nodes);
          for (var j = 0; j < ids.length; j++) {
            var n = world.nodes[ids[j]];
            if ((n.stress || 0) > (runHot[ids[j]] || 0)) runHot[ids[j]] = n.stress;
            if ((runHot[ids[j]] || 0) >= HOT_MIN) st.hot[ids[j]] = Math.min(1, runHot[ids[j]]);
          }
        }
        syncDial();
        if (dayFailed) { endFF('strike'); finishDay(true); }
        else if (st.dayTime >= st.dayLen - 1e-9) { endFF('day'); finishDay(false); }
        else { tickRegen(STEP); if (st.ff && hotNow()) endFF('ring'); }
      }
    }

    g.pickCard = function (index) {
      if (st.phase !== 'summary' || !st.draft) return fail('phase');
      var card = st.draft[index];
      if (card === undefined) return fail('index');
      advance(card);
      return { ok: true, card: card };
    };
    g.skipDraft = function () {
      if (st.phase !== 'summary') return fail('phase');
      advance(null);
      return { ok: true };
    };

    g.onEvent = function (fn) {
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    };

    g.save = function () {
      return clone({
        v: 1, diff: CFG.difficultyName, seed: seed, rngCalls: rngCalls, world: world.snapshot(),
        st: {
          day: st.day, phase: st.phase === 'run' ? 'plan' : st.phase, budget: st.budget,
          strikes: st.strikes, speed: st.speed, die: st.die, nextDie: st.nextDie, rerolled: st.rerolled,
          free: st.free, summary: st.summary,
          draft: st.draft, totalDelivered: st.totalDelivered, totalScore: st.totalScore,
          history: st.history, dayTime: st.phase === 'run' ? 0 : st.dayTime,
          clearSeen: clearSeen, teachOn: teachOn, teachSeen: teachSeen,
          teach: st.phase === 'run' ? { day3Convoy: false, seen: teachSeen, target: null, sent: 0 } : st.teach, tipCarry: st.tipCarry, speedBonus: st.speedBonus,
          speedApplied: st.speedDial.applied, lastLock: lastLock
        },
        cards: activeCards, placed: placed, hot: hot, hotMap: st.hot
      });
    };

    // ----- inicializacao -----
    if (saved) {
      world.restore(saved.world);
      var s = saved.st;
      st.day = s.day; st.phase = s.phase; st.budget = s.budget; st.strikes = s.strikes;
      st.speed = speedOk(s.speed) ? s.speed : CFG.speedDial.defaultSpeed; st.die = normDie(s.die, st.day); st.free = { road: !!s.free.road, light: !!s.free.light };
      st.rerolled = s.rerolled === true;
      if (s.nextDie) st.nextDie = normDie(s.nextDie, st.day + 1);
      // save antigo sem previsao: sorteia com rng derivado (nao mexe no fluxo principal; dois loads = mesma previsao)
      else st.nextDie = st.day < CFG.maxDays ? rollDie(st.day + 1, sideRng(211, st.day + 1)) : null;
      st.summary = s.summary === undefined ? null : s.summary;
      // lost sobrevive ao save/load como inteiro >= 0 (save antigo sem o campo: 0)
      if (st.summary && typeof st.summary === 'object') st.summary.lost = (fin(st.summary.lost) && st.summary.lost > 0) ? Math.floor(st.summary.lost) : 0;
      st.draft = s.draft === undefined ? null : s.draft; st.totalDelivered = s.totalDelivered;
      st.totalScore = s.totalScore || 0; st.history = s.history || [];
      st.history.forEach(function (h) { if (h && typeof h === 'object') { if (h.lost !== undefined) h.lost = (fin(h.lost) && h.lost > 0) ? Math.floor(h.lost) : 0; if (h.peak !== undefined && !fin(h.peak)) delete h.peak; } });
      st.dayTime = s.dayTime || 0; st.dayLen = CFG.dayLen[st.day - 1];
      activeCards = saved.cards || []; st.cards = activeCards.slice();
      placed = saved.placed || {}; hot = saved.hot || {};
      st.hot = saved.hotMap || {};
      syncModes(st.phase === 'plan' ? CFG.clear.charges : 0);
      // save antigo sem a marca: se o dia ja passou da liberacao, o aviso ja foi visto
      clearSeen = s.clearSeen === true || st.day >= CFG.clear.unlockDay;
      teachOn = s.teachOn !== false; teachSeen = s.teachSeen === true;
      var tt = isObjL(s.teach) ? s.teach : {};
      st.teach = { day3Convoy: tt.day3Convoy === true, seen: teachSeen,
                   target: (typeof tt.target === 'number' && isFinite(tt.target)) ? tt.target : null,
                   sent: (typeof tt.sent === 'number' && isFinite(tt.sent) && tt.sent >= 0) ? tt.sent : 0 };
      var ll = s.lastLock;   // save antigo nao tem: null
      lastLock = (ll && typeof ll === 'object' && fin(ll.nodeId)) ? { nodeId: ll.nodeId, tool: typeof ll.tool === 'string' ? ll.tool : null, degree: fin(ll.degree) ? ll.degree : 0, portal: !!ll.portal, x: fin(ll.x) ? ll.x : 0, y: fin(ll.y) ? ll.y : 0, day: fin(ll.day) ? ll.day : 0 } : null;
      if (st.phase === 'over') st.final = finalOf(st.strikes < CFG.maxStrikes);
      st.tipCarry = s.tipCarry || 0; st.speedBonus = s.speedBonus || 0; st.tips = 0;
      st.speedDial.applied = s.speedApplied || 0;
      syncDial();   // cargas do dia nao vao no save: volta cheio
      for (var k = 0; k < saved.rngCalls; k++) base();
      rngCalls = saved.rngCalls;
      world.day = st.day;
      refresh();
    } else {
      var a = idOf(world.addNode(-90, 0, { portal: true }));
      var b = idOf(world.addNode(90, 0, { portal: true }));
      world.addEdge(a, b, { lanes: 1, oneway: 0 });
      enterPlan(1, 0);
    }
    return g;
  }

  // ---------- validacao de save (localStorage pode vir corrompido ou de outra versao) ----------
  function fin(v) { return typeof v === 'number' && isFinite(v); }
  function nat(v) { return fin(v) && Math.floor(v) === v && v >= 0; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function cardOk(c) { for (var i = 0; i < CFG.cards.length; i++) if (CFG.cards[i].id === c) return true; return false; }
  function maxDieBudget(tab) {
    var m = 0;
    for (var i = 0; i < tab.outcomes.length; i++) m = Math.max(m, tab.outcomes[i].budget || 0);
    return m;
  }
  function dieOk(di, day) {
    var tab = diceTable(day);
    if (!isObj(di) || !nat(di.faces) || di.faces !== tab.faces || !nat(di.value) || di.value < 1 || di.value > di.faces || typeof di.id !== 'string') return false;
    if (di.kind !== undefined && typeof di.kind !== 'string') return false;
    if (di.effect !== undefined && !isObj(di.effect)) return false;
    var oc = outcomeById(tab, di.id);
    return !!oc && di.value >= oc.min && di.value <= oc.max;
  }
  // formatos antigos que tem conserto (chamado por load antes de validSave; muda d no lugar)
  function normSave(d) {
    if (!isObj(d) || !isObj(d.world)) return;
    var w = d.world, i;
    // world.nodes/edges como mapa {id: no}: vira array por id (restore so le arrays)
    ['nodes', 'edges'].forEach(function (k) {
      var m = w[k];
      if (!isObj(m)) return;
      w[k] = Object.keys(m).map(function (q) { return m[q]; })
        .sort(function (a, b) { return (isObj(a) && isObj(b) && fin(a.id) && fin(b.id)) ? a.id - b.id : 0; });
    });
    // portal sem rate fora do raio da cidade so pode ser rua do jogador: taxa das ruas dele
    if (Array.isArray(w.nodes)) {
      for (i = 0; i < w.nodes.length; i++) {
        var n = w.nodes[i];
        if (isObj(n) && n.portal === true && n.rate === undefined && fin(n.x) && fin(n.y) &&
            n.x * n.x + n.y * n.y > CFG.worldRadius * CFG.worldRadius) n.rate = CFG.builtPortalRate;
      }
    }
    // dia 1 no plano: o dado e sempre o neutro (build antigo sorteava); gratuidade que veio do dado sai
    var s = d.st;
    if (isObj(s) && s.day === 1 && s.phase === 'plan' && CFG.dice.day1Face) {
      var tab = diceTable(1), neutral = makeDie(tab, CFG.dice.day1Face);
      var di = s.die, same = isObj(di) && di.id === neutral.id && di.faces === tab.faces &&
        nat(di.value) && dieOk(di, 1);
      if (!same) {
        var oc = isObj(di) && typeof di.id === 'string' ? outcomeById(tab, di.id) : null;
        var cards = Array.isArray(d.cards) ? d.cards : [];
        if (oc && oc.free && isObj(s.free)) {
          if (s.free.road && cards.indexOf('freeRoad') < 0) s.free.road = false;
          if (s.free.light && cards.indexOf('freeLight') < 0) s.free.light = false;
        }
        s.die = neutral;
      }
    }
  }
  function validSave(d) {
    if (!d || d.v !== 1 || !isObj(d.world) || !isObj(d.st)) return false;
    var s = d.st, w = d.world, i;
    if (!nat(d.seed) || !nat(d.rngCalls) || d.rngCalls > 5000000) return false;
    if (!nat(s.day) || s.day < 1 || s.day > CFG.maxDays) return false;
    if (s.phase !== 'plan' && s.phase !== 'summary' && s.phase !== 'over') return false;
    var per = CFG.speedDial.tipsPerPoint, MAXSB = 200;   // teto folgado: pontos de gorjeta por dia
    if (s.tipCarry !== undefined && (!fin(s.tipCarry) || s.tipCarry < 0 || s.tipCarry >= per)) return false;
    if (s.speedBonus !== undefined && (!nat(s.speedBonus) || s.speedBonus > MAXSB)) return false;
    if (s.speedApplied !== undefined && (!nat(s.speedApplied) || s.speedApplied > MAXSB)) return false;
    if (s.phase === 'plan' && s.speedBonus) return false;   // no plano o bonus ja entrou no orcamento
    var sap = s.speedApplied || 0;   // bonus que entrou no orcamento de hoje (vale em plan, summary e over)
    if (!nat(s.budget) || s.budget > CFG.budget[s.day - 1] + CFG.carryCap + 2 + maxDieBudget(diceTable(s.day)) + sap) return false;
    if (!nat(s.strikes) || s.strikes > CFG.maxStrikes) return false;
    if (s.phase !== 'over' && s.strikes >= CFG.maxStrikes) return false;
    if (s.phase === 'over' && !(s.strikes >= CFG.maxStrikes || s.day >= CFG.maxDays)) return false;
    if (s.speed !== undefined) {
      var spOk = false;
      for (i = 0; i < CFG.speedDial.levels.length; i++) if (CFG.speedDial.levels[i].speed === s.speed) spOk = true;
      if (!spOk) return false;
    }
    if (s.dayTime !== undefined && (!fin(s.dayTime) || s.dayTime < 0 || s.dayTime > CFG.dayLen[s.day - 1] + 1)) return false;
    if (s.phase === 'plan') {
      if (!dieOk(s.die, s.day)) return false;
      if (s.summary !== null && s.summary !== undefined) return false;
    }
    if (s.nextDie !== undefined && s.nextDie !== null && (s.day >= CFG.maxDays || !dieOk(s.nextDie, s.day + 1))) return false;
    if (s.rerolled !== undefined && typeof s.rerolled !== 'boolean') return false;
    if (s.clearSeen !== undefined && typeof s.clearSeen !== 'boolean') return false;
    if (s.teachOn !== undefined && typeof s.teachOn !== 'boolean') return false;
    if (s.teachSeen !== undefined && typeof s.teachSeen !== 'boolean') return false;
    if (s.phase !== 'summary' && s.draft !== null && s.draft !== undefined) return false;
    if (s.phase === 'summary') {
      var dr = s.draft;
      if (!Array.isArray(dr) || dr.length !== 3 || dr[0] === dr[1] || dr[1] === dr[2] || dr[0] === dr[2]) return false;
      for (i = 0; i < 3; i++) if (!cardOk(dr[i])) return false;
    }
    if (s.phase !== 'plan') {
      var sm = s.summary;
      if (!isObj(sm)) return false;
      var ks = ['delivered', 'spawned', 'avgWait', 'gridlocks', 'waves', 'score'];
      for (i = 0; i < ks.length; i++) if (!fin(sm[ks[i]])) return false;
    }
    if (!nat(s.totalDelivered) || (s.totalScore !== undefined && !fin(s.totalScore))) return false;
    var hist = s.history === undefined ? [] : s.history;
    if (!Array.isArray(hist) || hist.length !== (s.phase === 'plan' ? s.day - 1 : s.day)) return false;
    var sum = 0;
    for (i = 0; i < hist.length; i++) {
      if (!isObj(hist[i]) || !nat(hist[i].delivered)) return false;
      sum += hist[i].delivered;
    }
    if (sum !== s.totalDelivered) return false;
    if (!isObj(s.free)) return false;
    var cards = d.cards === undefined ? [] : d.cards;
    if (!Array.isArray(cards) || cards.length > 1) return false;
    for (i = 0; i < cards.length; i++) if (!cardOk(cards[i])) return false;
    // gratuidade: so de carta ou do dado de hoje (free 'light' vira 'road' antes do semaforo)
    var dfree = null;
    if (s.phase === 'plan') {
      var doc = outcomeById(diceTable(s.day), s.die.id);
      if (doc && doc.free === 'light') dfree = s.day >= CFG.tools.light.unlockDay ? 'light' : 'road';
      else if (doc && doc.free === 'road') dfree = 'road';
    }
    if ((s.free.road && cards.indexOf('freeRoad') < 0 && dfree !== 'road') ||
        (s.free.light && cards.indexOf('freeLight') < 0 && dfree !== 'light')) return false;
    var maps = [d.placed, d.hot, d.hotMap], m, k;
    for (m = 0; m < 3; m++) {
      if (maps[m] === undefined) continue;
      if (!isObj(maps[m])) return false;
      for (k in maps[m]) if (!fin(maps[m][k]) || maps[m][k] < 0 || (m > 0 && maps[m][k] > 1)) return false;
    }
    // mundo (Sim real: arrays; o stub dos testes guarda mapas por id)
    var wn = Array.isArray(w.nodes) ? w.nodes : (isObj(w.nodes) ? Object.keys(w.nodes).map(function (q) { return w.nodes[q]; }) : null);
    var we = Array.isArray(w.edges) ? w.edges : (isObj(w.edges) ? Object.keys(w.edges).map(function (q) { return w.edges[q]; }) : null);
    if (!wn || !we) return false;
    w = { nodes: wn, edges: we };
    if (w.nodes.length < 2 || w.nodes.length > 400 || w.edges.length > 800) return false;
    var nodeIds = {}, portals = 0;
    for (i = 0; i < w.nodes.length; i++) {
      var n = w.nodes[i];
      if (!isObj(n) || !nat(n.id) || n.id < 1 || nodeIds[n.id] || !fin(n.x) || !fin(n.y)) return false;
      var RLIM = Math.max(CFG.worldRadius, CFG.buildRadius || 0) + 1; // ruas do jogador vao ate buildRadius
      if (n.x * n.x + n.y * n.y > RLIM * RLIM) return false;
      if (n.tool !== null && n.tool !== undefined && !own(PLACEABLE, n.tool)) return false;
      if (n.portal !== true && n.portal !== false) return false;
      if (n.portal) portals++;
      nodeIds[n.id] = n;
    }
    if (portals < 2) return false;
    for (i = 0; i < w.nodes.length; i++) {
      var pr = w.nodes[i].pair;
      if (pr === null || pr === undefined) continue;
      var o = nodeIds[pr];
      if (!o || o.pair !== w.nodes[i].id || o.id === w.nodes[i].id || w.nodes[i].tool !== 'light' || o.tool !== 'light') return false;
    }
    var edgeIds = {}, pairs = {};
    for (i = 0; i < w.edges.length; i++) {
      var e = w.edges[i];
      if (!isObj(e) || !nat(e.id) || e.id < 1 || edgeIds[e.id] || !nodeIds[e.a] || !nodeIds[e.b] || e.a === e.b) return false;
      if (e.lanes !== 1 && e.lanes !== 2) return false;
      if (e.oneway !== 0 && e.oneway !== 1 && e.oneway !== -1) return false;
      var pk = Math.min(e.a, e.b) + '-' + Math.max(e.a, e.b);
      if (pairs[pk]) return false;
      pairs[pk] = 1; edgeIds[e.id] = 1;
    }
    // geometria: o que o Sim garante em mundo valido (edicao, split e crescimento)
    var nl = w.nodes, el = w.edges, j, A, B, ea, eb;
    for (i = 0; i < nl.length; i++) for (j = i + 1; j < nl.length; j++) {
      if (dist(nl[i].x, nl[i].y, nl[j].x, nl[j].y) < CFG.minNodeSpacing / 2 - 1e-6) return false;
    }
    for (i = 0; i < el.length; i++) {
      ea = nodeIds[el[i].a]; eb = nodeIds[el[i].b];
      var L = dist(ea.x, ea.y, eb.x, eb.y);
      if (L < CFG.minNodeSpacing / 2 - 0.5 || L > CFG.maxRoadLen + 0.5) return false;
      // angulo livre: ruas do jogador ligam nos existentes em qualquer angulo (o Sim so exige estradas que nao se sobrepoem)
      for (j = 0; j < nl.length; j++) {
        if (nl[j].id === ea.id || nl[j].id === eb.id) continue;
        if (ptSegDist(nl[j].x, nl[j].y, ea.x, ea.y, eb.x, eb.y) < CFG.carLen - 1e-6) return false;
      }
    }
    for (i = 0; i < el.length; i++) for (j = i + 1; j < el.length; j++) {
      A = el[i]; B = el[j];
      var sh = (A.a === B.a || A.a === B.b) ? A.a : ((A.b === B.a || A.b === B.b) ? A.b : null);
      if (sh !== null) {
        var s0 = nodeIds[sh], o1 = nodeIds[A.a === sh ? A.b : A.a], o2 = nodeIds[B.a === sh ? B.b : B.a];
        if (angDiff(Math.atan2(o1.y - s0.y, o1.x - s0.x), Math.atan2(o2.y - s0.y, o2.x - s0.x)) * 180 / Math.PI < 1) return false;
      } else if (segsIntersect(nodeIds[A.a], nodeIds[A.b], nodeIds[B.a], nodeIds[B.b])) return false;
    }
    return true;
  }

  CRZ.Game = {
    _teach: TEACH,   // ajuste fino (testes/simulacao); valores finais propostos em NOTES_GAME.md
    // opts.teach === false: jogador que ja fez a primeira partida (sem o comboio do dia 3)
    create: function (seed, opts) { return build((seed === undefined ? 1 : seed) >>> 0 || 1, null, opts); },
    load: function (json) {
      try {
        var d = typeof json === 'string' ? JSON.parse(json) : clone(json);
        // save de outra dificuldade: recusa (main.js troca a dificuldade e recarrega); save sem diff segue aceito
        if (d && d.diff !== undefined && CFG.difficultyName && d.diff !== CFG.difficultyName) return null;
        normSave(d);
        if (!validSave(d)) return null;
        return build(d.seed, d);
      } catch (e) { return null; }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
