/* Cruzamento: simulacao de trafego. Dono: agente SIM.
 * Mundo (nos, estradas), carros em filas por (estrada, sentido, faixa),
 * servidores de cruzamento por tool, estresse e travamento.
 * DOM-free, sem Date.now, sem Math.random (so CRZ.rng). Roda no node. */
(function (root) {
  'use strict';
  var CRZ = root.CRZ = root.CRZ || {};

  var TOOLS = { stop: 1, yield: 1, light: 1, round: 1, cross: 1 };
  var INF = Infinity;
  var DEG = 180 / Math.PI;

  // ---------- geometria pura ----------
  function angOk(dx, dy) {
    var deg = Math.atan2(dy, dx) * DEG;
    var r = ((deg % 45) + 45) % 45;
    return r <= 1 || r >= 44;
  }
  function distPtSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var qx = ax + dx * t - px, qy = ay + dy * t - py;
    return Math.sqrt(qx * qx + qy * qy);
  }
  function cross3(ax, ay, bx, by, cx, cy) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }
  // segmentos se tocam (com tolerancia tol)
  function segTouch(ax, ay, bx, by, cx, cy, dx, dy, tol) {
    var o1 = cross3(ax, ay, bx, by, cx, cy), o2 = cross3(ax, ay, bx, by, dx, dy);
    var o3 = cross3(cx, cy, dx, dy, ax, ay), o4 = cross3(cx, cy, dx, dy, bx, by);
    if (o1 * o2 < 0 && o3 * o4 < 0) return true;
    return distPtSeg(cx, cy, ax, ay, bx, by) < tol || distPtSeg(dx, dy, ax, ay, bx, by) < tol ||
      distPtSeg(ax, ay, cx, cy, dx, dy) < tol || distPtSeg(bx, by, cx, cy, dx, dy) < tol;
  }
  // intersecao do segmento A-B com C-D: parametro u em A-B, ou -1
  function segHit(ax, ay, bx, by, cx, cy, dx, dy) {
    var rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
    var den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) return -1;
    var u = ((cx - ax) * sy - (cy - ay) * sx) / den;
    var v = ((cx - ax) * ry - (cy - ay) * rx) / den;
    if (u < 0 || u > 1 || v < 0 || v > 1) return -1;
    return u;
  }
  function angDiff(a, b) {
    var d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function create(seed) {
    var CFG = CRZ.CFG, J = CFG.junction;
    var GAPLEN = CFG.carLen + CFG.carGap;
    var SNAP_R = CFG.minNodeSpacing / 2;     // raio de encaixe em no/estrada existente
    var NODE_CLEAR = CFG.carLen;             // estrada nao pode passar tao perto de um no
    // estrada nova do jogador (canAddEdge)
    var MIN_PART = CFG.minNodeSpacing / 2;   // pedaco minimo de estrada cortada (igual ao splitEdge)
    var LINK_MIN = CFG.minLinkLen || MIN_PART; // ligacao a no/estrada existente pode ser mais curta que minRoadLen
    var JOIN_ANG = CFG.linkMinAngle || 12;   // graus minimos entre duas estradas que se encontram ou se cruzam
    var ROAD_CLEAR = CFG.minNodeSpacing / 4; // no novo nao fica colado numa estrada que nao e a dele
    var MAX_CROSS = 3;                       // cruzamentos que uma estrada nova pode abrir
    var BUILD_R = CFG.buildRadius || CFG.worldRadius;
    var LIGHT_PER = J.light.green + J.light.allRed;

    var w = {
      nodes: {}, edges: {}, cars: [], time: 0, day: 1,
      seed: (seed >>> 0) || 1,
      stats: null,
      params: { spawnMul: 1, speedMul: 1, patienceMul: 1, waveMul: 1 }
    };
    var nextNode = 1, nextEdge = 1, nextCar = 1;
    var nodeList = [], edgeList = [], portalList = [];
    var nIdx = {};             // id do no -> indice em nodeList
    var Q = {};                // id da estrada -> {d:[LS dir 1, LS dir -1]}
    var NS = {};               // id do no -> estado interno
    var distCache = {};        // id destino -> {stamp, arr}
    var events = [];
    var rng = CRZ.rng(w.seed);
    var stepNo = 0;
    var pairSpeedMul = -1;
    var pairs = [];            // pares ativos (ordem por id do lider)
    var pairFlow = {};         // "L-F" -> [carros/s L->F, F->L], media movel; zera no resetDay
    var PAIR_K = 4;            // amostras da fase do primeiro carro solto
    var PAIR_TAU = 30;         // s, constante da media movel de fluxo
    var PAIR_HYST = 0.85;      // so troca de desfasamento se o custo cair 15%
    var WAVE_STOP = J.light.serve; // s parado na estrada ate o 2o no e ainda conta como onda
    var relCode = -1;          // arco que o ultimo carro liberado tomou
    // s que um no pareado pode segurar o verde (por verde) para o pelotao do par
    // chegar; padrao = allRed (proposta: CFG.junction.light.pairHold)
    var HOLD_MAX = J.light.pairHold != null ? J.light.pairHold : J.light.allRed;
    var cand = [];             // candidatos reutilizados {ls, l, car, wait}
    var candN = 0;
    var heapI = [], heapK = [];

    function zeroStats() {
      // lost: carros que desistiram num portal sem rota (cada carro conta uma vez); dropped: chegaram com a
      // fila do portal cheia (CFG.portalQueueCap) e nao entraram
      return { spawned: 0, delivered: 0, waitSum: 0, maxStress: 0, gridlocks: 0, unroutable: 0, waveHits: 0, lost: 0, dropped: 0 };
    }
    w.stats = zeroStats();

    // ---------- estrutura interna ----------
    function newLS(e, dir) {
      return { e: e, dir: dir, node: dir === 1 ? e.b : e.a, gi: 0,
        cars: [[], []], last: [-1e9, -1e9], next: [0, 0] };
    }
    function newNS() {
      return { t0: 0, phase: 0, ap: [], groups: 1, busy: 0, rr: 0, slots: [], pedOn: false,
        lockT: 0, sraw: 0, bmul: 1, ev5: false, ev8: false, flow: [0, 0, 0, 0], maxW: 0, serveCost: 0,
        pend: 0, pendDest: -1, keys: [], pOut: -1, pIdx: -1, pDir: 0,
        paired: false, aK: 0, aT: 0, aLast: 0, pq: [], pendLost: false };   // pq: hora de chegada de cada carro da fila (pend = pq.length)
    }
    function resetServer(ns) {
      ns.busy = 0; ns.rr = 0; ns.pedOn = false; ns.phase = 0; ns.aK = 0; ns.aT = 0; ns.aLast = 0;
      ns.slots = []; for (var i = 0; i < Math.max(J.round.parallel, J.round.parallelBig || 0); i++) ns.slots.push(0);
      ns.flow = [0, 0, 0, 0];
    }
    function sortIds(obj) {
      var a = [];
      for (var k in obj) a.push(obj[k]);
      a.sort(function (p, q) { return p.id - q.id; });
      return a;
    }
    function edgeDirAt(e, nid) { // direcao de saida do no nid ao longo de e (graus)
      var n = w.nodes[nid], o = w.nodes[e.a === nid ? e.b : e.a];
      return Math.atan2(o.y - n.y, o.x - n.x) * DEG;
    }
    function axisKey(e, nid) {
      var d = edgeDirAt(e, nid);
      d = ((d % 180) + 180) % 180;
      return Math.round(d / 45) % 4;
    }
    function serveCostOf(n) {
      if (!n.tool) return n.edges.length <= 2 ? CFG.entryGap : J.none.serve;
      if (n.tool === 'stop') return J.stop.serve + J.stop.fullStop;
      return J[n.tool].serve;
    }

    function rebuild() {
      nodeList = sortIds(w.nodes);
      edgeList = sortIds(w.edges);
      portalList = [];
      nIdx = {};
      for (var i = 0; i < nodeList.length; i++) {
        var n = nodeList[i];
        nIdx[n.id] = i;
        n.edges.sort(function (p, q) { return p - q; });
        if (n.portal) portalList.push(n);
        if (!NS[n.id]) { NS[n.id] = newNS(); resetServer(NS[n.id]); }
      }
      for (i = 0; i < edgeList.length; i++) {
        var e = edgeList[i];
        if (!Q[e.id]) Q[e.id] = { d: [newLS(e, 1), newLS(e, -1)] };
      }
      // aproximacoes (entradas) por no e grupos de eixo
      for (i = 0; i < nodeList.length; i++) {
        n = nodeList[i];
        var ns = NS[n.id];
        ns.ap = [];
        var keys = [];
        for (var k = 0; k < n.edges.length; k++) {
          e = w.edges[n.edges[k]];
          var ls = null;
          if (e.b === n.id && e.oneway !== -1) ls = Q[e.id].d[0];
          else if (e.a === n.id && e.oneway !== 1) ls = Q[e.id].d[1];
          if (!ls) continue;
          ls._key = axisKey(e, n.id);
          if (keys.indexOf(ls._key) < 0) keys.push(ls._key);
          ns.ap.push(ls);
        }
        keys.sort(function (p, q) { return p - q; });
        ns.keys = keys;
        ns.groups = Math.max(1, keys.length);
        for (k = 0; k < ns.ap.length; k++) ns.ap[k].gi = keys.indexOf(ns.ap[k]._key);
        ns.serveCost = serveCostOf(n);
      }
      distCache = {};
      recalcPairs();
    }

    // ---------- pareamento (onda verde) ----------
    function pathLen(fromId, toId) { // Dijkstra so por comprimento, respeita mao unica
      var N = nodeList.length, dist = [], prevE = [], i;
      for (i = 0; i < N; i++) { dist.push(INF); prevE.push(-1); }
      dist[nIdx[fromId]] = 0;
      var done = [];
      for (;;) {
        var bi = -1, bd = INF;
        for (i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; bi = i; }
        if (bi < 0) break;
        done[bi] = true;
        var n = nodeList[bi];
        if (n.id === toId) break;
        for (var k = 0; k < n.edges.length; k++) {
          var e = w.edges[n.edges[k]];
          var dir = e.a === n.id ? 1 : -1;
          if ((dir === 1 && e.oneway === -1) || (dir === -1 && e.oneway === 1)) continue;
          var o = nIdx[dir === 1 ? e.b : e.a];
          if (bd + e.len < dist[o]) { dist[o] = bd + e.len; prevE[o] = e.id; }
        }
      }
      var ti = nIdx[toId];
      if (dist[ti] === INF) return null;
      var first = -1, last = prevE[ti], cur = toId;
      while (cur !== fromId) {
        var ee = w.edges[prevE[nIdx[cur]]];
        first = ee.id;
        cur = ee.a === cur ? ee.b : ee.a;
      }
      return { len: dist[ti], first: first, last: last };
    }
    // Onda verde nos dois sentidos (SIM2). Cada par tem lider L (t0 = 0) e
    // seguidor F. O t0 de F sai de um modelo de pelotao: no inicio do verde do
    // eixo do corredor, o no de cima solta m carros a cada hW s; eles chegam T s
    // depois (viagem real com speedFree*speedMul e a perda da arrancada) e o no
    // de baixo os serve conforme a propria fase. Custo = espera media do
    // pelotao x fluxo recente do sentido; o t0 escolhido minimiza a soma dos
    // dois sentidos. Com fluxos iguais o otimo cai em T ou T +- C/2 (simetria
    // do ciclo); com fluxos desiguais o sentido mais cheio pesa mais. Mao unica:
    // so o sentido L -> F, como antes.
    function modC(x, c) { return ((x % c) + c) % c; }
    function codeOf(eid, nid) { var e = w.edges[eid]; return e.id * 2 + (e.a === nid ? 0 : 1); }
    function nextGreen(t, t0, k, G) {
      var C = G * LIGHT_PER, loc = modC(t - t0 - k * LIGHT_PER, C);
      return loc < J.light.green ? t : t + (C - loc);
    }
    function pairHeads() {
      var bonus = J.light.pairGreenBonus * w.params.waveMul;
      var hS = Math.max(CFG.entryGap, J.light.serve);
      var hW = Math.max(CFG.entryGap, J.light.serve - bonus);
      return { hS: hS, hW: hW };
    }
    // espera media por carro do fluxo que sai do verde de (uT0,uK,uG) e chega em
    // (dT0,dK,dG). Saida: a fila acumulada no vermelho (nq carros) sai em
    // sequencia rapida (hW) no inicio do verde; depois os carros que chegam no
    // verde passam soltos, um a cada 1/rate s, ate o fim do verde. A fila e
    // aleatoria (nq = mu - sqrt(mu), mu, mu + sqrt(mu), mu = rate x vermelho) e o
    // primeiro carro solto cai em PAIR_K posicoes do intervalo entre chegadas.
    function platoonDelay(uT0, uK, uG, dT0, dK, dG, T, rate, H) {
      var Cu = uG * LIGHT_PER, g = J.light.green, nqMax = Math.floor(g / H.hW) + 1;
      var mu = rate * (Cu - g), sd = Math.sqrt(mu), gap = 1 / Math.max(rate, 1e-3);
      var nc = uG === dG ? 1 : dG, sum = 0, cnt = 0;
      for (var v = -1; v <= 1; v++) {
        var nq = Math.max(0, Math.min(nqMax, Math.round(mu + v * sd)));
        for (var j = 0; j < PAIR_K; j++) {
          var f0 = nq * H.hW + gap * (j + 0.5) / PAIR_K;
          for (var c = 0; c < nc; c++) {
            var gs = uT0 + uK * LIGHT_PER + c * Cu, prev = -INF, prevW = false, i = 0;
            var d = nq > 0 ? gs : gs + f0;
            while (d < gs + g) {
              var a = d + T;
              var t = prev > -INF ? Math.max(a, prev + (prevW ? H.hW : H.hS)) : a;
              var dep = nextGreen(t, dT0, dK, dG);
              prevW = nextGreen(a, dT0, dK, dG) === a;
              sum += dep - a; cnt++; prev = dep;
              i++;
              d = i < nq ? gs + i * H.hW : (i === nq ? gs + f0 : d + gap);
            }
          }
        }
      }
      return cnt ? sum / cnt : 0;
    }
    function pairCost(pr, t0F, H) {
      var gL = NS[pr.L].groups, gF = NS[pr.F].groups;
      var c = pr.flow[0] * platoonDelay(0, pr.kL, gL, t0F, pr.kF, gF, pr.T, pr.flow[0], H);
      if (pr.two) c += pr.flow[1] * platoonDelay(t0F, pr.kF, gF, 0, pr.kL, gL, pr.T, pr.flow[1], H);
      return c;
    }
    // melhor t0 do seguidor: {t0, cost}. Candidatos: os dois pontos simetricos do
    // ciclo (verdes juntos, ou defasados de meio ciclo: valem igual nos dois
    // sentidos) e os dois alinhamentos puros (onda perfeita num sentido so).
    // Vence o de menor custo; empate fica com o primeiro da lista.
    function bestT0(pr) {
      var CF = NS[pr.F].groups * LIGHT_PER, base = (pr.kL - pr.kF) * LIGHT_PER;
      var alignA = modC(base + pr.T, CF);
      if (!pr.two) return { t0: alignA, cost: 0 };
      var H = pairHeads();
      var cands = [modC(base, CF), modC(base + CF / 2, CF), alignA, modC(base - pr.T, CF)];
      var best = cands[0], bc = INF;
      for (var i = 0; i < cands.length; i++) {
        var cc = pairCost(pr, cands[i], H);
        if (cc < bc - 1e-9) { bc = cc; best = cands[i]; }
      }
      return { t0: best, cost: bc };
    }
    function apFor(nid, eid) {
      var ap = NS[nid].ap;
      for (var i = 0; i < ap.length; i++) if (ap[i].e.id === eid) return ap[i];
      return null;
    }
    // pelotao do par a menos de 1 s da linha nesta aproximacao?
    function platoonNear(ls, partner) {
      if (!ls) return false;
      var lim = ls.e.len - CFG.speedFree * w.params.speedMul;
      for (var l = 0; l < ls.e.lanes; l++) {
        var arr = ls.cars[l];
        for (var i = 0; i < arr.length && arr[i].s >= lim; i++) if (arr[i]._from === partner) return true;
      }
      return false;
    }
    // segura o verde do no X (eixo k) enquanto o pelotao do par chega, ate
    // light.pairHold s por verde; devolve o tempo acelerando o relogio depois
    function holdEnd(pr, e, X, k, ls, partner, dt) {
      var ns = NS[X], g = J.light.green, C = ns.groups * LIGHT_PER;
      var loc = modC(w.time - ns.t0 - k * LIGHT_PER, C);
      if (loc < g) {
        if (g - loc <= dt + 1e-9 && pr.hold[e] < HOLD_MAX && platoonNear(ls, partner)) {
          var hh = Math.min(dt, HOLD_MAX - pr.hold[e]);
          ns.t0 += hh; pr.hold[e] += hh; pr.debt[e] += hh;
        }
        return;
      }
      if (pr.debt[e] > 0) { var r = Math.min(dt, pr.debt[e]); ns.t0 -= r; pr.debt[e] -= r; }
      else pr.hold[e] = 0;
    }
    function recalcPairs() {
      pairSpeedMul = w.params.speedMul;
      var i, n;
      for (i = 0; i < nodeList.length; i++) { var z = NS[nodeList[i].id]; z.t0 = 0; z.pOut = -1; z.paired = false; }
      pairs = [];
      var v = CFG.speedFree * w.params.speedMul, v0 = Math.min(CFG.speedSlow, v);
      var accLoss = (v - v0) / v * (v - v0) / (2 * v); // arrancada de speedSlow a v com aceleracao v/s
      var r0 = Math.max(0.05, CFG.spawnRate(w.day) * w.params.spawnMul);
      for (i = 0; i < nodeList.length; i++) {
        n = nodeList[i];
        if (n.tool !== 'light' || n.pair == null) continue;
        var p = w.nodes[n.pair];
        if (!p || p.tool !== 'light' || p.pair !== n.id || n.id > p.id) continue;
        var L = n, F = p, path = pathLen(L.id, F.id);
        if (!path) { L = p; F = n; path = pathLen(L.id, F.id); }
        if (!path) continue;
        var rp = pathLen(F.id, L.id);
        var two = !!rp && Math.abs(rp.len - path.len) < 1e-6;
        var nsL = NS[L.id], nsF = NS[F.id];
        var kL = nsL.keys.indexOf(axisKey(w.edges[path.first], L.id));
        var kF = nsF.keys.indexOf(axisKey(w.edges[path.last], F.id));
        if (kL < 0) kL = 0;
        if (kF < 0) kF = 0;
        var key = L.id + '-' + F.id;
        var flow = pairFlow[key] || (pairFlow[key] = [r0, r0]);
        var pr = { L: L.id, F: F.id, kL: kL, kF: kF, T: path.len / v + accLoss, two: two,
          flow: flow, cnt: [0, 0], tEval: w.time - pairs.length * 0.7, shift: 0, target: 0 };
        pr.apF = apFor(F.id, path.last); pr.apL = two ? apFor(L.id, rp.last) : null;
        pr.hold = [0, 0]; pr.debt = [0, 0];
        nsL.pOut = codeOf(path.first, L.id); nsL.pIdx = pairs.length; nsL.pDir = 0;
        if (two) { nsF.pOut = codeOf(rp.first, F.id); nsF.pIdx = pairs.length; nsF.pDir = 1; }
        nsL.t0 = 0; nsL.paired = nsF.paired = true;
        var b = bestT0(pr);
        nsF.t0 = pr.target = b.t0;
        pairs.push(pr);
      }
    }
    // por passo: aplica troca de desfasamento sem saltos (congela ou acelera o
    // relogio do seguidor) e reavalia o fluxo a cada ciclo do lider
    function pairTick(dt) {
      for (var i = 0; i < pairs.length; i++) {
        var pr = pairs[i], nsF = NS[pr.F];
        if (pr.shift > 0) { var s = Math.min(dt, pr.shift); nsF.t0 += s; pr.shift -= s; }
        else if (pr.shift < 0) { var f = Math.min(dt, -pr.shift); nsF.t0 -= f; pr.shift += f; }
        if (HOLD_MAX > 0) {
          holdEnd(pr, 0, pr.F, pr.kF, pr.apF, pr.L, dt);
          if (pr.two) holdEnd(pr, 1, pr.L, pr.kL, pr.apL, pr.F, dt);
          if (pr.debt[0] > 0 || pr.debt[1] > 0) continue;
        }
        if (!pr.two) continue;
        var CL = NS[pr.L].groups * LIGHT_PER, el = w.time - pr.tEval;
        if (el < CL) continue;
        var k = Math.min(1, el / PAIR_TAU);
        for (var d = 0; d < 2; d++) { pr.flow[d] += (pr.cnt[d] / el - pr.flow[d]) * k; pr.cnt[d] = 0; }
        pr.tEval = w.time;
        if (pr.shift !== 0) continue;
        var b = bestT0(pr), cur = pairCost(pr, pr.target, pairHeads());
        if (b.cost < cur * PAIR_HYST - 1e-9) {
          var CF = NS[pr.F].groups * LIGHT_PER, delta = modC(b.t0 - nsF.t0, CF);
          pr.shift = delta > CF / 2 ? delta - CF : delta;
          pr.target = b.t0;
        }
      }
    }

    // ---------- carros ----------
    function removeCar(car) {
      var i = car._i, last = w.cars[w.cars.length - 1];
      w.cars[i] = last; last._i = i;
      w.cars.pop();
      car._i = -1;
    }
    function laneRemove(car) {
      var q = Q[car.edgeId];
      if (!q) return;
      var arr = q.d[car.dir === 1 ? 0 : 1].cars[car.lane];
      var k = arr.indexOf(car);
      if (k >= 0) arr.splice(k, 1);
    }
    function setPos(car) {
      var e = w.edges[car.edgeId], a = w.nodes[e.a], b = w.nodes[e.b];
      var t = car.s / e.len;
      if (car.dir === -1) t = 1 - t;
      car.x = a.x + (b.x - a.x) * t;
      car.y = a.y + (b.y - a.y) * t;
      car.ang = car.dir === 1 ? e._ang : e._ang + Math.PI;
    }
    function purgeCarsOn(eid) {
      var q = Q[eid];
      if (!q) return;
      for (var d = 0; d < 2; d++) for (var l = 0; l < 2; l++) {
        var arr = q.d[d].cars[l];
        for (var i = 0; i < arr.length; i++) removeCar(arr[i]);
        arr.length = 0;
      }
    }

    // ---------- rota ----------
    function arcCost(e, dir) {
      var ls = Q[e.id].d[dir === 1 ? 0 : 1];
      var cnt = ls.cars[0].length + (e.lanes > 1 ? ls.cars[1].length : 0);
      return e.len / CFG.speedFree + cnt / e.lanes * NS[ls.node].serveCost;
    }
    function heapPush(i, k) {
      var p = heapI.length;
      heapI.push(i); heapK.push(k);
      while (p > 0) {
        var u = (p - 1) >> 1;
        if (heapK[u] <= heapK[p]) break;
        var ti = heapI[u], tk = heapK[u];
        heapI[u] = heapI[p]; heapK[u] = heapK[p]; heapI[p] = ti; heapK[p] = tk;
        p = u;
      }
    }
    function heapPop() { // devolve indice; chave em heapK.top
      var top = heapI[0];
      var li = heapI.pop(), lk = heapK.pop();
      if (heapI.length) {
        heapI[0] = li; heapK[0] = lk;
        var p = 0, n = heapI.length;
        for (;;) {
          var l = 2 * p + 1, r = l + 1, m = p;
          if (l < n && (heapK[l] < heapK[m] || (heapK[l] === heapK[m] && heapI[l] < heapI[m]))) m = l;
          if (r < n && (heapK[r] < heapK[m] || (heapK[r] === heapK[m] && heapI[r] < heapI[m]))) m = r;
          if (m === p) break;
          var ti = heapI[m], tk = heapK[m];
          heapI[m] = heapI[p]; heapK[m] = heapK[p]; heapI[p] = ti; heapK[p] = tk;
          p = m;
        }
      }
      return top;
    }
    function distTo(destId) {
      var c = distCache[destId];
      if (c && c.stamp === stepNo) return c.arr;
      var N = nodeList.length;
      if (!c || c.arr.length !== N) { c = distCache[destId] = { stamp: -1, arr: new Float64Array(N) }; }
      var arr = c.arr, i;
      for (i = 0; i < N; i++) arr[i] = INF;
      heapI.length = 0; heapK.length = 0;
      arr[nIdx[destId]] = 0;
      heapPush(nIdx[destId], 0);
      while (heapI.length) {
        var kd = heapK[0];
        var vi = heapPop();
        if (kd > arr[vi]) continue;
        var v = nodeList[vi];
        for (var k = 0; k < v.edges.length; k++) {
          var e = w.edges[v.edges[k]];
          var u = e.a === v.id ? e.b : e.a;
          var dir = e.a === u ? 1 : -1;
          if ((dir === 1 && e.oneway === -1) || (dir === -1 && e.oneway === 1)) continue;
          var nd = kd + arcCost(e, dir), ui = nIdx[u];
          if (nd < arr[ui]) { arr[ui] = nd; heapPush(ui, nd); }
        }
      }
      c.stamp = stepNo;
      return arr;
    }
    // proximo arco a partir de nodeId rumo a dest; codifica eid*2 + (dir==1?0:1); -1 sem rota
    function route(nodeId, fromEdge, destId) {
      if (w.nodes[destId] == null) return -1;
      var dist = distTo(destId), n = w.nodes[nodeId];
      var best = -1, bestC = INF, pass, k;
      for (pass = 0; pass < 2 && best < 0; pass++) {
        for (k = 0; k < n.edges.length; k++) {
          var e = w.edges[n.edges[k]];
          if ((pass === 0) === (e.id === fromEdge)) continue;
          var dir = e.a === nodeId ? 1 : -1;
          if ((dir === 1 && e.oneway === -1) || (dir === -1 && e.oneway === 1)) continue;
          var dv = dist[nIdx[dir === 1 ? e.b : e.a]];
          if (dv === INF) continue;
          var c = arcCost(e, dir) + dv;
          if (c < bestC) { bestC = c; best = e.id * 2 + (dir === 1 ? 0 : 1); }
        }
        if (fromEdge < 0) break;
      }
      return best;
    }
    // faixa livre de entrada (menos carros), ou -1
    function laneFor(code) {
      var e = w.edges[code >> 1];
      if (!e) return -1;
      var ls = Q[e.id].d[code & 1], best = -1, bc = INF;
      for (var l = 0; l < e.lanes; l++) {
        var arr = ls.cars[l];
        if (w.time - ls.last[l] < CFG.entryGap) continue;
        if (arr.length && arr[arr.length - 1].s < GAPLEN) continue;
        if (arr.length < bc) { bc = arr.length; best = l; }
      }
      return best;
    }
    function codeValid(code, nodeId) {
      if (code < 0) return false;
      var e = w.edges[code >> 1];
      if (!e) return false;
      var dir = (code & 1) ? -1 : 1;
      if ((dir === 1 && (e.a !== nodeId || e.oneway === -1)) || (dir === -1 && (e.b !== nodeId || e.oneway === 1))) return false;
      return true;
    }
    // coloca o carro no arco code, faixa l, e decide o proximo arco
    function enter(car, code, l, fromNode) {
      var e = w.edges[code >> 1], di = code & 1, ls = Q[e.id].d[di];
      car.edgeId = e.id; car.dir = di ? -1 : 1; car.s = 0; car.lane = l;
      car._we = 0; car._from = fromNode; car._lineAt = -1; car._wave = 0;
      ls.cars[l].push(car);
      ls.last[l] = w.time;
      var far = ls.node;
      if (far === car.dest) { car._next = -1; return true; }
      car._next = route(far, e.id, car.dest);
      if (car._next < 0) {
        ls.cars[l].pop();
        removeCar(car);
        w.stats.unroutable++;
        return false;
      }
      return true;
    }

    // ---------- servidores de cruzamento ----------
    function gather(ns) {
      candN = 0;
      var ap = ns.ap;
      for (var a = 0; a < ap.length; a++) {
        var ls = ap[a], len = ls.e.len;
        for (var l = 0; l < ls.e.lanes; l++) {
          var car = ls.cars[l][0];
          if (!car || car.s < len - 1e-6) continue;
          if (candN >= cand.length) cand.push({ ls: null, l: 0, car: null, wait: 0, a: 0, done: false });
          var c = cand[candN++];
          c.ls = ls; c.l = l; c.car = car; c.a = a; c.done = false;
          c.wait = w.time - car._lineAt;
        }
      }
      return candN;
    }
    // tenta liberar o candidato c; devolve true se cruzou
    function tryRelease(n, ns, c, emit) {
      var car = c.car;
      if (!codeValid(car._next, n.id)) {
        car._next = route(n.id, car.edgeId, car.dest);
        if (car._next < 0) {
          c.ls.cars[c.l].shift(); removeCar(car); w.stats.unroutable++; c.done = true;
          return false;
        }
      }
      var l = laneFor(car._next);
      if (l < 0) return false;
      c.ls.cars[c.l].shift();
      c.done = true;
      relCode = car._next;
      if (car._wave && car._we <= WAVE_STOP) { w.stats.waveHits++; car._wh++; }
      if (ns.pOut >= 0 && relCode === ns.pOut) pairs[ns.pIdx].cnt[ns.pDir]++;
      ns.flow[c.ls.gi]++;
      if (emit) events.push({ type: 'pass', nodeId: n.id, tool: n.tool });
      if (enter(car, car._next, l, n.id)) setPos(car);
      return true;
    }
    // melhor candidato (maior espera) que satisfaz filtro; ordem estavel
    function bestCand(filter) {
      var b = -1;
      for (var i = 0; i < candN; i++) {
        var c = cand[i];
        if (c.done || (filter && !filter(c))) continue;
        if (b < 0 || c.wait > cand[b].wait + 1e-9) b = i;
      }
      return b;
    }
    // tenta liberar, em ordem de espera, ate um cruzar
    function releaseBest(n, ns, filter) {
      for (var tries = 0; tries < candN; tries++) {
        var b = bestCand(filter);
        if (b < 0) return false;
        var c = cand[b];
        if (tryRelease(n, ns, c, true)) return true;
        c.done = true; // nao pode agora: pula neste passo
      }
      return false;
    }
    // rodizio entre aproximacoes
    function releaseRR(n, ns, filter) {
      var nA = ns.ap.length;
      for (var k = 0; k < nA; k++) {
        var a = (ns.rr + k) % nA;
        var f = function (c) { return c.a === a && (!filter || filter(c)); };
        if (releaseBest(n, ns, f)) { ns.rr = a + 1; return true; }
      }
      return false;
    }
    function occupiedApproaches() {
      var cnt = 0;
      for (var i = 0; i < candN; i++) {
        var dup = false;
        for (var j = 0; j < i; j++) if (cand[j].a === cand[i].a) { dup = true; break; }
        if (!dup) cnt++;
      }
      return cnt;
    }
    function lightPhaseAt(ns) {
      var cyc = ns.groups * LIGHT_PER;
      var loc = ((w.time - ns.t0) % cyc + cyc) % cyc;
      var k = Math.floor(loc / LIGHT_PER);
      return (loc - k * LIGHT_PER) < J.light.green ? k : -1;
    }
    // ha carro no grupo g a menos de `reach` da linha (Infinity: em qualquer ponto da aproximacao)?
    function groupDemand(ns, g, reach) {
      for (var a = 0; a < ns.ap.length; a++) {
        var ls = ns.ap[a];
        if (ls.gi !== g) continue;
        for (var l = 0; l < ls.e.lanes; l++) { var hc = ls.cars[l][0]; if (hc && ls.e.len - hc.s <= reach) return true; }
      }
      return false;
    }
    // Semaforo atuado (2026-11-09): sem par, o verde vai so para eixo com carro, termina cedo quando o
    // eixo esvazia (depois de minGreen) e fica no eixo atual se ninguem mais espera. Ciclo de 3 ou 4 eixos
    // nao deixa mais um carro 17 s no vermelho com a rua vazia. Com par (onda verde) ele tambem e atuado e da
    // preferencia ao pelotao que vem do par: segura o verde ate pairHold s a mais para ele passar
    // (e o pelotao sai com o intervalo curto de pairGreenBonus). light.actuated = false volta ao ciclo fixo.
    function platoonIn(ns, g, partner) {
      for (var a = 0; a < ns.ap.length; a++) if (ns.ap[a].gi === g && platoonNear(ns.ap[a], partner)) return true;
      return false;
    }
    function actPhase(n, ns) {
      var t = w.time, LJ = J.light, G = ns.groups, pt = ns.paired ? n.pair : null;
      if (G <= 1) return 0;
      if (ns.aK >= 0) {
        var el = t - ns.aT;
        if (el < (LJ.minGreen || 0)) return ns.aK;
        var other = false;
        for (var g = 0; g < G && !other; g++) if (g !== ns.aK && groupDemand(ns, g, Infinity)) other = true;
        if (!other) return ns.aK;
        if (el < LJ.green && groupDemand(ns, ns.aK, CFG.speedFree * (LJ.gapOut || 1))) return ns.aK;
        if (pt != null && el < LJ.green + (LJ.pairHold || 0) && platoonIn(ns, ns.aK, pt)) return ns.aK;
        ns.aK = -1; ns.aT = t;
        return -1;
      }
      if (t - ns.aT < LJ.allRed) return -1;
      var pick = (ns.aLast + 1) % G;
      for (var k = 1; k <= G; k++) { var q = (ns.aLast + k) % G; if (groupDemand(ns, q, Infinity)) { pick = q; break; } }
      ns.aK = pick; ns.aLast = pick; ns.aT = t;
      return pick;
    }
    function mainGroup(ns) {
      var g, best = 0, bl = -1, bc = -1, bf = -1;
      for (g = 0; g < ns.groups; g++) {
        var ml = 0, cnt = 0;
        for (var a = 0; a < ns.ap.length; a++) {
          if (ns.ap[a].gi !== g) continue;
          cnt++;
          if (ns.ap[a].e.lanes > ml) ml = ns.ap[a].e.lanes;
        }
        var f = ns.flow[g] || 0;
        if (ml > bl || (ml === bl && (cnt > bc || (cnt === bc && f > bf)))) { best = g; bl = ml; bc = cnt; bf = f; }
      }
      return best;
    }

    function serveNode(n, ns) {
      if (!ns.ap.length) return;
      var t = w.time, tool = n.tool;
      if (!gather(ns)) return;
      var i, bf = n.boost > 0; // Clear ativo: tempo de servico por carro / ns.bmul

      if (tool === 'cross' && n.edges.length <= 2) { // faixa numa reta ou curva: livre fora da vez do pedestre
        if (ns.pedOn && !bf) return;
        while (releaseBest(n, ns, null)) { /* libera todos que cabem */ }
        return;
      }
      if (!tool) {
        if (n.edges.length <= 2) { // curva ou ponta: passagem livre
          while (releaseBest(n, ns, null)) { /* libera todos que cabem */ }
          return;
        }
        if (t < ns.busy) return;
        var occ = occupiedApproaches();
        if (releaseBest(n, ns, null)) {
          // J.none.late (opcional): a partir de late.fromDay vale o servico mais lento (hora do rush)
          var JN = (J.none.late && w.day >= J.none.late.fromDay) ? J.none.late : J.none;
          var hn = JN.serve + (occ >= 3 ? JN.multiApproachPenalty * (occ - 2) : 0);
          ns.busy = t + (bf ? hn / ns.bmul : hn);
        }
        return;
      }
      if (tool === 'stop') {
        if (t < ns.busy) return;
        if (bf) {
          var fs = J.stop.fullStop / ns.bmul;
          if (releaseRR(n, ns, function (c) { return c.wait >= fs; })) ns.busy = t + J.stop.serve / ns.bmul;
          return;
        }
        if (releaseRR(n, ns, function (c) { return c.wait >= J.stop.fullStop; })) ns.busy = t + J.stop.serve;
        return;
      }
      if (tool === 'yield') {
        // Preferencial (2026-11-09): a rua principal (eixo com mais faixas/bracos/fluxo) nao para: cada
        // aproximacao dela solta um carro a cada yield.serve, as duas maos juntas. A secundaria entra numa
        // brecha (nenhum carro da principal a menos de minorServe s da linha) ou, depois de minorMaxWait s de
        // espera, ganha a vez: a principal segura e as cabecas de UM grupo secundario (o do carro que espera
        // ha mais tempo) entram juntas; outro grupo secundario espera a proxima vez.
        // 2026-11-09 (revisao): a brecha e medida ANTES de a principal soltar, e a secundaria so entra num passo
        // em que a principal nao soltou ninguem. Antes a brecha era medida depois: o carro da principal que
        // acabava de entrar no cruzamento nao contava e as duas cruzavam no mesmo passo.
        if (t < ns.busy) return;
        var Y = J.yield, gm = mainGroup(ns), forced = false, fg = -1, fw = -1;
        for (i = 0; i < candN; i++) {
          var cf = cand[i];
          if (cf.ls.gi !== gm && cf.wait >= Y.minorMaxWait && cf.wait > fw) { forced = true; fg = cf.ls.gi; fw = cf.wait; }
        }
        var gap = forced || !groupDemand(ns, gm, CFG.speedFree * Y.minorServe), mainWent = false;
        if (!forced) {
          for (i = 0; i < candN; i++) {
            var cm = cand[i];
            if (cm.ls.gi !== gm || t < cm.ls.next[cm.l]) continue;
            if (tryRelease(n, ns, cm, true)) { mainWent = true; cm.ls.next[cm.l] = t + (bf ? Y.serve / ns.bmul : Y.serve); }
          }
        }
        if (!gap || mainWent) return;
        var went = false;
        for (i = 0; i < candN; i++) {
          var cy = cand[i];
          if (cy.done || cy.ls.gi === gm) continue;
          if (forced && (cy.ls.gi !== fg || cy.wait < Y.minorMaxWait * (Y.batch != null ? Y.batch : 0))) continue;
          if (tryRelease(n, ns, cy, true)) { went = true; if (!forced) break; }
        }
        if (went) ns.busy = t + (bf ? Y.minorServe / ns.bmul : Y.minorServe);
        return;
      }
      if (tool === 'light') {
        var ph = ns.phase;
        if (ph < 0) return;
        var bonus = J.light.pairGreenBonus * w.params.waveMul;
        for (i = 0; i < candN; i++) {
          var c = cand[i];
          if (c.ls.gi !== ph || t < c.ls.next[c.l]) continue;
          var wv = c.car._wave;
          if (tryRelease(n, ns, c, true)) {
            // pelotao: quem segue para o par sai em sequencia rapida, como a onda
            var pl = wv || (ns.pOut >= 0 && relCode === ns.pOut);
            var hl = Math.max(0, J.light.serve - (pl ? bonus : 0));
            c.ls.next[c.l] = t + (bf ? hl / ns.bmul : hl);
          }
        }
        return;
      }
      if (tool === 'round') {
        // 2026-11-09: rotatoria de 4+ entradas tem mais vagas no anel (parallelBig): ela rende mais onde
        // muitas ruas se encontram e pouco a mais que o Pare num T
        var extra = J.round.extraApproachPenalty * Math.max(0, ns.ap.length - 4);
        var nSl = ns.ap.length >= 4 && J.round.parallelBig ? J.round.parallelBig : J.round.parallel;
        for (i = 0; i < nSl && i < ns.slots.length; i++) {
          if (t < ns.slots[i]) continue;
          if (releaseBest(n, ns, null)) ns.slots[i] = t + (bf ? (J.round.serve + extra) / ns.bmul : J.round.serve + extra);
          else break;
        }
        return;
      }
      if (tool === 'cross') {
        if ((ns.pedOn && !bf) || t < ns.busy) return; // Clear: guarda segura os pedestres
        if (releaseRR(n, ns, null)) ns.busy = t + (bf ? J.cross.serve / ns.bmul : J.cross.serve);
      }
    }

    // ---------- passo ----------
    function phases() {
      for (var i = 0; i < nodeList.length; i++) {
        var n = nodeList[i], ns = NS[n.id];
        if (n.tool === 'light') {
          var ph = J.light.actuated === false ? lightPhaseAt(ns) : actPhase(n, ns);
          if (ph !== ns.phase || n.lightPhase !== ph) {
            ns.phase = ph; n.lightPhase = ph;
            events.push({ type: 'light', nodeId: n.id, phase: ph });
          }
        } else if (n.tool === 'cross') {
          var loc = w.time % J.cross.pedEvery;
          var on = loc >= J.cross.pedEvery - J.cross.pedDur;
          if (on && !ns.pedOn) events.push({ type: 'ped', nodeId: n.id });
          ns.pedOn = on;
        }
      }
    }

    function move(dt) {
      var vMax = CFG.speedFree * w.params.speedMul, vSlow = CFG.speedSlow;
      var stillTol = vSlow * dt * 0.25;
      for (var ei = 0; ei < edgeList.length; ei++) {
        var e = edgeList[ei], q = Q[e.id], len = e.len;
        for (var d = 0; d < 2; d++) {
          var ls = q.d[d];
          for (var l = 0; l < e.lanes; l++) {
            var arr = ls.cars[l], i = 0;
            while (i < arr.length) {
              var car = arr[i];
              var limit = i === 0 ? len : arr[i - 1].s - GAPLEN;
              var avail = limit - car.s;
              if (car.speed < vSlow) car.speed = vSlow;
              else car.speed = Math.min(vMax, car.speed + vMax * dt);
              var want = car.speed * dt, mv;
              if (avail <= 0) { mv = 0; car.speed = 0; }
              else if (want > avail) { mv = avail; if (i > 0) car.speed = avail / dt; }
              else mv = want;
              car.s += mv;
              if (mv < stillTol) { car.waited += dt; car._we += dt; }
              if (i === 0 && car.s >= len - 1e-6) {
                car.s = len;
                if (car._lineAt < 0) {
                  car._lineAt = w.time;
                  var en = w.nodes[ls.node];
                  if (en.tool === 'light' && en.pair != null && car._from === en.pair && NS[en.id].phase === ls.gi) car._wave = 1;
                }
                if (ls.node === car.dest) { // chegou
                  arr.shift();
                  removeCar(car);
                  w.stats.delivered++;
                  w.stats.waitSum += car.waited;
                  var dn = w.nodes[car.dest];
                  events.push({ type: 'arrive', x: dn.x, y: dn.y, nodeId: dn.id, wait: car.waited });
                  continue;
                }
              }
              setPos(car);
              i++;
            }
          }
        }
      }
    }

    function spawnDest(p) {
      if (portalList.length >= 2) {
        // destino sorteado com peso = taxa do portal (ponta de rua do jogador atrai tanto quanto gera).
        // 2026-11-09 (revisao): so entre os portais com rota a partir de p (distTo finito, como sendCar).
        // Nenhum com rota: devolve -2 SEM consumir rng (o carro espera no portal, ver spawn). Com todos
        // alcancaveis o consumo e o sorteio sao identicos aos de antes; com mao unica o sorteio muda.
        var others = [], tot = 0, pi = nIdx[p.id];
        for (var i = 0; i < portalList.length; i++) {
          var q = portalList[i];
          if (q === p || !(distTo(q.id)[pi] < INF)) continue;
          others.push(q); tot += q.rate || 1;
        }
        if (!others.length) return -2;
        var r = rng() * tot;
        for (i = 0; i < others.length - 1; i++) { r -= others[i].rate || 1; if (r < 0) break; }
        return others[i].id;
      }
      if (!p.edges.length) return -1;
      var e = w.edges[p.edges[0]];
      return e.a === p.id ? e.b : e.a;
    }

    function spawn(dt) {
      var rate = CFG.spawnRate(w.day) * w.params.spawnMul * dt;
      // trafego da cidade dividido: acima de portalRef(dia) portais da cidade, cada um gera menos,
      // o total fica o mesmo e se espalha por todos os ramos. Portais do jogador (rate < 1) somam por fora.
      // So vale com w.portalNorm (o Game liga); mundo criado direto pelo Sim gera como antes.
      var cityN = 0, ref = (w.portalNorm && CFG.portalRef) ? CFG.portalRef(w.day) : Infinity;
      for (var j = 0; j < portalList.length; j++) if (!(portalList[j].rate > 0 && portalList[j].rate < 1)) cityN++;
      var cityMul = cityN > ref ? ref / cityN : 1;
      for (var i = 0; i < portalList.length; i++) {
        var p = portalList[i], ns = NS[p.id];
        // fila do portal (CFG.portalQueueCap): ns.pq guarda a hora de chegada de cada carro (pend = pq.length).
        // O sorteio de chegada consome 1 rng por portal e passo, com ou sem vaga (consumo igual ao de antes).
        if (rng() < rate * (p.rate > 0 && p.rate < 1 ? p.rate : cityMul)) {
          if (!(CFG.portalQueueCap > 0) || ns.pend < CFG.portalQueueCap) { ns.pend++; ns.pq.push(w.time); }
          else if (ns.pendLost) { w.stats.unroutable++; w.stats.lost++; events.push({ type: 'lost', nodeId: p.id, lost: w.stats.lost }); }
          else w.stats.dropped++;
        }
        if (ns.pend <= 0) continue;
        if (ns.pendDest < 0 || !w.nodes[ns.pendDest]) ns.pendDest = spawnDest(p);
        if (ns.pendDest === -1) { ns.pend = 0; ns.pq.length = 0; continue; }
        var code = ns.pendDest >= 0 ? route(p.id, -1, ns.pendDest) : -1;
        if (code < 0 && ns.pendDest >= 0) { ns.pendDest = spawnDest(p); if (ns.pendDest >= 0) code = route(p.id, -1, ns.pendDest); }
        if (code < 0) {
          // sem rota para NENHUM portal (mao unica isolou este): o primeiro da fila espera (o anel do portal
          // enche) e, depois de lostWait x paciencia do dia, desiste: conta UMA vez em stats.lost e sai da
          // fila; o proximo comeca a contar a propria espera. Quem chega com a fila cheia tambem desiste.
          // Quando algum destino tem rota o sorteio ja cai nele (spawnDest) e o carro sai sem esperar.
          ns.pendLost = true;
          if (w.time - ns.pq[0] >= patNow() * (CFG.lostWait > 0 ? CFG.lostWait : 0.5)) {
            w.stats.unroutable++; w.stats.lost++; ns.pend--; ns.pq.shift(); ns.pendDest = -1;
            events.push({ type: 'lost', nodeId: p.id, lost: w.stats.lost });
          }
          continue;
        }
        ns.pendLost = false;
        var l = laneFor(code);
        if (l < 0) continue;
        var car = { id: nextCar++, edgeId: 0, dir: 1, s: 0, lane: 0, speed: CFG.speedSlow,
          dest: ns.pendDest, waited: 0, x: p.x, y: p.y, ang: 0,
          _i: w.cars.length, _we: 0, _next: -1, _from: p.id, _lineAt: -1, _wave: 0, _wh: 0 };
        w.cars.push(car);
        ns.pend--; ns.pq.shift(); ns.pendDest = -1;
        if (enter(car, code, l, p.id)) {
          setPos(car);
          w.stats.spawned++;
          events.push({ type: 'spawn', x: p.x, y: p.y, nodeId: p.id });
        }
      }
    }

    // paciencia do dia (s): a mesma para o estresse, o teto da espera no portal e o limite de perdido.
    // CFG.patienceDay (opcional, difficulty.js): fator por dia (indice dia - 1). Antes o limite de perdido
    // e o teto 0.95 ignoravam patienceDay: com fator < 0.95 a espera no portal passava de 1 e travava o portal.
    function patNow() {
      var pd = CFG.patienceDay && CFG.patienceDay[w.day - 1];
      return CFG.patience * (pd > 0 ? pd : 1) * w.params.patienceMul;
    }

    function stress(dt) {
      var i, n, ns, pat = patNow();
      // fila do portal: a espera do primeiro da fila conta no estresse do portal (com ou sem rota), com teto
      // 0.95 x paciencia: a fila acende o anel, mas o portal nunca trava sozinho
      for (i = 0; i < nodeList.length; i++) { var nz = NS[nodeList[i].id]; nz.maxW = nz.pq.length ? Math.min(w.time - nz.pq[0], 0.95 * pat) : 0; }
      for (i = 0; i < w.cars.length; i++) {
        var car = w.cars[i];
        if (car._we <= 0) continue;
        var e = w.edges[car.edgeId];
        ns = NS[car.dir === 1 ? e.b : e.a];
        if (car._we > ns.maxW) ns.maxW = car._we;
      }
      var k = Math.min(1, dt / CFG.stressSmooth);
      for (i = 0; i < nodeList.length; i++) {
        n = nodeList[i]; ns = NS[n.id];
        if (n.boost > 0) { n.boost -= dt; if (n.boost <= 1e-9) { n.boost = 0; ns.bmul = 1; } }
        var raw = ns.maxW / pat;
        if (n.tool === 'cross' && J.cross.stressMul != null) raw *= J.cross.stressMul;   // faixa de pedestre: motorista mais calmo
        ns.sraw += (raw - ns.sraw) * k;
        var s = ns.sraw < 0 ? 0 : (ns.sraw > 1 ? 1 : ns.sraw);
        var prev = n.stress;
        n.stress = s;
        if (s > w.stats.maxStress) w.stats.maxStress = s;
        if (!ns.ev5 && prev < 0.5 && s >= 0.5) { ns.ev5 = true; events.push({ type: 'stress', nodeId: n.id, value: 0.5 }); }
        if (!ns.ev8 && prev < 0.8 && s >= 0.8) { ns.ev8 = true; events.push({ type: 'stress', nodeId: n.id, value: 0.8 }); }
        if (!n.locked) {
          if (ns.sraw >= 1) ns.lockT += dt; else ns.lockT = 0;
          if (ns.lockT >= CFG.lockSeconds) {
            n.locked = true;
            w.stats.gridlocks++;
            events.push({ type: 'gridlock', nodeId: n.id });
          }
        }
      }
    }

    function stepOnce(dt) {
      stepNo++;
      if (w.params.speedMul !== pairSpeedMul) recalcPairs();
      pairTick(dt);
      phases();
      for (var i = 0; i < nodeList.length; i++) serveNode(nodeList[i], NS[nodeList[i].id]);
      move(dt);
      spawn(dt);
      stress(dt);
      w.time += dt;
    }

    w.step = function (dt) {
      if (!(dt > 0)) return;
      var n = Math.ceil(dt / 0.1 - 1e-9), h = dt / n;
      for (var i = 0; i < n; i++) stepOnce(h);
    };
    // Clear: por `seconds` s simulados o cruzamento do no serve cada carro `mul` vezes mais
    // rapido (so o tempo de servico; fases do semaforo nao mudam; na faixa de pedestre a fase
    // de pedestres e ignorada). A entrada na estrada de saida segue entryGap/espaco normais.
    // Na hora: estresse cai `relief` (piso 0) e a contagem de travamento zera. Renovar durante
    // um boost ativo nao empilha: restante = max(restante, seconds); relief vale a cada chamada.
    // Devolve false (sem efeito, sem evento) para id invalido ou no ja travado (locked);
    // true caso contrario. node.boost = segundos restantes (0 sem boost). Argumentos ausentes
    // ou invalidos caem em CFG.clear.
    w.boost = function (nodeId, seconds, mul, relief) {
      var n = w.nodes[nodeId], C = CFG.clear || {};
      if (!n || n.locked) return false;
      var ns = NS[n.id];
      if (!ns) return false;
      if (!(seconds > 0) || !isFinite(seconds)) seconds = C.seconds > 0 ? C.seconds : 6;
      if (!(mul > 0) || !isFinite(mul)) mul = C.mul > 0 ? C.mul : 2;
      if (!(relief >= 0)) relief = C.stressRelief >= 0 ? C.stressRelief : 0;
      if (relief > 1) relief = 1;
      n.boost = Math.max(n.boost || 0, seconds);
      ns.bmul = mul;
      var s0 = ns.sraw < 0 ? 0 : (ns.sraw > 1 ? 1 : ns.sraw);
      ns.sraw = Math.max(0, s0 - relief);
      n.stress = ns.sraw;
      ns.lockT = 0;
      events.push({ type: 'boost', nodeId: n.id, seconds: n.boost });
      return true;
    };
    w.drainEvents = function () { var e = events; events = []; return e; };

    w.resetDay = function () {
      var i;
      for (i = 0; i < edgeList.length; i++) {
        var q = Q[edgeList[i].id];
        for (var d = 0; d < 2; d++) {
          var ls = q.d[d];
          ls.cars[0].length = 0; ls.cars[1].length = 0;
          ls.last[0] = ls.last[1] = -1e9; ls.next[0] = ls.next[1] = 0;
        }
      }
      w.cars.length = 0;
      w.time = 0;
      w.stats = zeroStats();
      events = [];
      for (i = 0; i < nodeList.length; i++) {
        var n = nodeList[i], ns = NS[n.id];
        resetServer(ns);
        ns.lockT = 0; ns.sraw = 0; ns.ev5 = ns.ev8 = false; ns.pend = 0; ns.pendDest = -1; ns.maxW = 0; ns.pq.length = 0; ns.pendLost = false;
        n.stress = 0; n.locked = false; n.lightPhase = 0; n.boost = 0; ns.bmul = 1;
      }
      // semente do dia: o dia depende so de semente, dia, layout e params
      rng = CRZ.rng((w.seed ^ Math.imul((w.day | 0) + 1, 0x9E3779B1)) >>> 0);
      distCache = {};
      pairFlow = {};
      recalcPairs();
    };

    // ---------- edicao ----------
    function mkNode(x, y, portal, id) {
      var n = { id: id || nextNode++, x: x, y: y, tool: null, portal: !!portal, pair: null,
        stress: 0, locked: false, lightPhase: 0, boost: 0, edges: [] };
      if (n.id >= nextNode) nextNode = n.id + 1;
      w.nodes[n.id] = n;
      NS[n.id] = newNS(); resetServer(NS[n.id]);
      return n;
    }
    function mkEdge(aId, bId, lanes, oneway, id) {
      var a = w.nodes[aId], b = w.nodes[bId];
      var e = { id: id || nextEdge++, a: aId, b: bId, lanes: lanes === 2 ? 2 : 1,
        oneway: oneway === 1 || oneway === -1 ? oneway : 0,
        len: Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)) };
      Object.defineProperty(e, '_ang', { value: Math.atan2(b.y - a.y, b.x - a.x), writable: true, enumerable: false });
      if (e.id >= nextEdge) nextEdge = e.id + 1;
      w.edges[e.id] = e;
      Q[e.id] = { d: [newLS(e, 1), newLS(e, -1)] };
      a.edges.push(e.id); b.edges.push(e.id);
      return e;
    }
    function dropEdge(eid) {
      var e = w.edges[eid];
      purgeCarsOn(eid);
      var a = w.nodes[e.a], b = w.nodes[e.b];
      a.edges.splice(a.edges.indexOf(eid), 1);
      b.edges.splice(b.edges.indexOf(eid), 1);
      delete w.edges[eid];
      delete Q[eid];
    }

    // segmento A-B livre? aId/bId podem ser null (ponta solta)
    function segFree(ax, ay, bx, by, aId, bId, ignoreEdge) {
      var i, e, ca, cb;
      var dirAB = Math.atan2(by - ay, bx - ax) * DEG, dirBA = dirAB + 180;
      for (i = 0; i < edgeList.length; i++) {
        e = edgeList[i];
        if (e.id === ignoreEdge) continue;
        ca = w.nodes[e.a]; cb = w.nodes[e.b];
        var shA = aId != null && (e.a === aId || e.b === aId);
        var shB = bId != null && (e.a === bId || e.b === bId);
        if (shA && shB) return false; // ja existe
        if (shA) { if (angDiff(edgeDirAt(e, aId), dirAB) < 1) return false; continue; }
        if (shB) { if (angDiff(edgeDirAt(e, bId), dirBA) < 1) return false; continue; }
        if (segTouch(ax, ay, bx, by, ca.x, ca.y, cb.x, cb.y, 0.5)) return false;
      }
      for (i = 0; i < nodeList.length; i++) {
        var n = nodeList[i];
        if (n.id === aId || n.id === bId) continue;
        if (distPtSeg(n.x, n.y, ax, ay, bx, by) < NODE_CLEAR) return false;
      }
      return true;
    }
    function lenOk(L) { return L >= CFG.minRoadLen - 0.5 && L <= CFG.maxRoadLen + 0.5; }

    w.addNode = function (x, y, opts) {
      if (!isFinite(x) || !isFinite(y)) return null;
      var n = mkNode(x, y, opts && opts.portal);
      if (opts && opts.rate > 0 && opts.rate < 1) n.rate = opts.rate;   // portal que gera menos carros (ex.: ruas do jogador)
      rebuild();
      return n.id;
    };
    w.addEdge = function (aId, bId, opts) {
      var a = w.nodes[aId], b = w.nodes[bId];
      if (!a || !b || aId === bId) return null;
      var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy);
      // opts.free: estrada do jogador ligando nos ja existentes (angulo livre, pedaco curto de cruzamento)
      if (opts && opts.free) { if (L < MIN_PART - 0.5 || L > CFG.maxRoadLen + 0.5) return null; }
      else if (!lenOk(L) || !angOk(dx, dy)) return null;
      if (!segFree(a.x, a.y, b.x, b.y, aId, bId, -1)) return null;
      var e = mkEdge(aId, bId, opts && opts.lanes, opts && opts.oneway);
      rebuild();
      return e.id;
    };
    w.splitEdge = function (edgeId, x, y) {
      var e = w.edges[edgeId];
      if (!e) return null;
      var a = w.nodes[e.a], b = w.nodes[e.b];
      var dx = b.x - a.x, dy = b.y - a.y;
      var t = ((x - a.x) * dx + (y - a.y) * dy) / (e.len * e.len);
      var minPart = CFG.minNodeSpacing / 2;
      if (t * e.len < minPart || (1 - t) * e.len < minPart) return null;
      var lanes = e.lanes, ow = e.oneway, aId = e.a, bId = e.b;
      dropEdge(edgeId);
      var n = mkNode(a.x + dx * t, a.y + dy * t, false);
      mkEdge(aId, n.id, lanes, ow);
      mkEdge(n.id, bId, lanes, ow);
      rebuild();
      return n.id;
    };
    w.removeEdge = function (edgeId) {
      if (!w.edges[edgeId]) return null;
      dropEdge(edgeId);
      rebuild();
      return edgeId;
    };
    w.removeNode = function (id) {
      var n = w.nodes[id];
      if (!n) return null;
      w.unpair(id);
      var es = n.edges.slice();
      for (var i = 0; i < es.length; i++) dropEdge(es[i]);
      delete w.nodes[id];
      delete NS[id];
      for (var k in distCache) if (+k === id) delete distCache[k];
      rebuild();
      return id;
    };
    w.setTool = function (nodeId, tool) {
      var n = w.nodes[nodeId];
      if (!n) return null;
      if (tool && !TOOLS[tool]) return null;
      n.tool = tool || null;
      if (n.tool !== 'light' && n.pair != null) w.unpair(nodeId);
      var ns = NS[nodeId];
      resetServer(ns);
      n.lightPhase = 0;
      var q = ns.ap;
      for (var i = 0; i < q.length; i++) { q[i].next[0] = q[i].next[1] = 0; }
      rebuild();
      return nodeId;
    };
    w.setLanes = function (edgeId, lanes) {
      var e = w.edges[edgeId];
      if (!e || (lanes !== 1 && lanes !== 2)) return null;
      if (lanes === 1 && e.lanes === 2) {
        var q = Q[edgeId];
        for (var d = 0; d < 2; d++) {
          var c = q.d[d].cars, m = c[0].concat(c[1]);
          m.sort(function (p, r) { return r.s - p.s || p.id - r.id; });
          for (var i = 0; i < m.length; i++) m[i].lane = 0;
          c[0] = m; c[1] = [];
        }
      }
      e.lanes = lanes;
      rebuild();
      return edgeId;
    };
    w.setOneway = function (edgeId, ow) {
      var e = w.edges[edgeId];
      if (!e || (ow !== 0 && ow !== 1 && ow !== -1)) return null;
      e.oneway = ow;
      var q = Q[edgeId];
      for (var d = 0; d < 2; d++) {
        if ((d === 0 && ow === -1) || (d === 1 && ow === 1)) {
          for (var l = 0; l < 2; l++) {
            var arr = q.d[d].cars[l];
            for (var i = 0; i < arr.length; i++) removeCar(arr[i]);
            arr.length = 0;
          }
        }
      }
      rebuild();
      return edgeId;
    };
    w.pairLights = function (aId, bId) {
      var a = w.nodes[aId], b = w.nodes[bId];
      if (!a || !b || aId === bId || a.tool !== 'light' || b.tool !== 'light') return false;
      if (a.pair != null && a.pair !== bId) w.unpair(aId);
      if (b.pair != null && b.pair !== aId) w.unpair(bId);
      a.pair = bId; b.pair = aId;
      recalcPairs();
      return true;
    };
    w.unpair = function (nodeId) {
      var n = w.nodes[nodeId];
      if (!n || n.pair == null) return false;
      var p = w.nodes[n.pair];
      if (p && p.pair === nodeId) p.pair = null;
      n.pair = null;
      recalcPairs();
      return true;
    };

    // ---------- consulta ----------
    w.nearestNode = function (x, y, maxDist) {
      var best = null, bd = maxDist == null ? INF : maxDist;
      for (var i = 0; i < nodeList.length; i++) {
        var n = nodeList[i], d = Math.sqrt((n.x - x) * (n.x - x) + (n.y - y) * (n.y - y));
        if (d <= bd && (!best || d < bd)) { best = n; bd = d; }
      }
      return best;
    };
    w.nearestEdge = function (x, y, maxDist) {
      var best = null, bd = maxDist == null ? INF : maxDist;
      for (var i = 0; i < edgeList.length; i++) {
        var e = edgeList[i], a = w.nodes[e.a], b = w.nodes[e.b];
        var dx = b.x - a.x, dy = b.y - a.y;
        var t = ((x - a.x) * dx + (y - a.y) * dy) / (e.len * e.len);
        if (t < 0) t = 0; else if (t > 1) t = 1;
        var px = a.x + dx * t, py = a.y + dy * t;
        var d = Math.sqrt((px - x) * (px - x) + (py - y) * (py - y));
        if (d <= bd && (!best || d < bd)) { best = { edge: e, t: t, x: px, y: py, dist: d }; bd = d; }
      }
      return best;
    };
    // ---------- estrada nova do jogador ----------
    // Regras: ponta solta so em multiplos de 45 graus (visual limpo); encaixe em no existente com
    // angulo livre; cruzar outra estrada abre um cruzamento (split) em vez de falhar.
    // Toda recusa traz reason: short | long | range | near | blocked | angle | linked | stub | other.
    // Resultado ok pode trazer capped (dedo alem do maximo, rua cortada no maximo) e cross (cruzamentos).
    function hyp(x, y) { return Math.sqrt(x * x + y * y); }
    function linkedTo(aId, bId) {
      var a = w.nodes[aId];
      for (var i = 0; i < a.edges.length; i++) {
        var e = w.edges[a.edges[i]];
        if (e && (e.a === bId || e.b === bId)) return true;
      }
      return false;
    }
    function inRange(x, y) { return x * x + y * y <= BUILD_R * BUILD_R + 1e-6; }
    // estradas que ja saem do no ficam a JOIN_ANG graus ou mais da direcao nova
    function joinOk(nid, dirDeg) {
      var n = w.nodes[nid];
      for (var i = 0; i < n.edges.length; i++) {
        if (angDiff(edgeDirAt(w.edges[n.edges[i]], nid), dirDeg) < JOIN_ANG) return false;
      }
      return true;
    }
    // ponto novo (fim solto, T ou cruzamento) longe dos nos e das outras estradas
    function spotOk(px, py, skipNode, skipEdges) {
      var i;
      for (i = 0; i < nodeList.length; i++) {
        var n = nodeList[i];
        if (n.id === skipNode) continue;
        if (hyp(n.x - px, n.y - py) < MIN_PART) return false;
      }
      for (i = 0; i < edgeList.length; i++) {
        var e = edgeList[i];
        if (skipEdges && skipEdges.indexOf(e.id) >= 0) continue;
        var ca = w.nodes[e.a], cb = w.nodes[e.b];
        if (distPtSeg(px, py, ca.x, ca.y, cb.x, cb.y) < ROAD_CLEAR) return false;
      }
      return true;
    }
    // segmento a -> (ex,ey), que termina no no endId, sobre a estrada endEdge (T) ou solto.
    // Devolve {ok, reason, cross:[{edgeId,x,y}]} com os cruzamentos na ordem a partir de a.
    function planPath(a, ex, ey, endId, endEdge) {
      var dx = ex - a.x, dy = ey - a.y, L = hyp(dx, dy), i, e, ca, cb;
      if (L < MIN_PART) return { ok: false, reason: 'short' };
      var dir = Math.atan2(dy, dx) * DEG;
      if (!joinOk(a.id, dir)) return { ok: false, reason: 'angle' };
      if (endId != null && !joinOk(endId, dir + 180)) return { ok: false, reason: 'angle' };
      var cross = [];
      for (i = 0; i < edgeList.length; i++) {
        e = edgeList[i];
        if (e.id === endEdge || e.a === a.id || e.b === a.id) continue;
        if (endId != null && (e.a === endId || e.b === endId)) continue;
        ca = w.nodes[e.a]; cb = w.nodes[e.b];
        var u = segHit(a.x, a.y, ex, ey, ca.x, ca.y, cb.x, cb.y);
        if (u > 1e-9 && u < 1 - 1e-9) {
          var hx = a.x + dx * u, hy = a.y + dy * u;
          if (hyp(hx - ca.x, hy - ca.y) < MIN_PART || hyp(hx - cb.x, hy - cb.y) < MIN_PART) return { ok: false, reason: 'near' };
          var ca2 = angDiff(Math.atan2(cb.y - ca.y, cb.x - ca.x) * DEG, dir);
          if (Math.min(ca2, 180 - ca2) < JOIN_ANG) return { ok: false, reason: 'blocked' };
          cross.push({ edgeId: e.id, x: hx, y: hy, u: u });
        } else if (segTouch(a.x, a.y, ex, ey, ca.x, ca.y, cb.x, cb.y, 0.5)) return { ok: false, reason: 'blocked' };
      }
      if (cross.length > MAX_CROSS) return { ok: false, reason: 'blocked' };
      cross.sort(function (p, q) { return p.u - q.u; });
      var prevU = 0;
      for (i = 0; i < cross.length; i++) {
        if ((cross[i].u - prevU) * L < MIN_PART) return { ok: false, reason: 'near' };
        prevU = cross[i].u;
      }
      if ((1 - prevU) * L < MIN_PART) return { ok: false, reason: 'near' };
      for (i = 0; i < nodeList.length; i++) {
        var n = nodeList[i];
        if (n.id === a.id || n.id === endId) continue;
        if (distPtSeg(n.x, n.y, a.x, a.y, ex, ey) < NODE_CLEAR) return { ok: false, reason: 'near' };
      }
      var out = [];
      for (i = 0; i < cross.length; i++) {
        if (!spotOk(cross[i].x, cross[i].y, null, [cross[i].edgeId])) return { ok: false, reason: 'near' };
        out.push({ edgeId: cross[i].edgeId, x: cross[i].x, y: cross[i].y });
      }
      return { ok: true, cross: out };
    }
    function roadRes(ok, x, y, reason, extra, cross) {
      var r = { ok: !!ok, x: x, y: y };
      if (extra) for (var k in extra) r[k] = extra[k];
      r.end = r.nodeId != null ? 'node' : (r.edgeId != null ? 'edge' : 'free'); // como a rua termina
      if (ok) { if (cross && cross.length) r.cross = cross; } else r.reason = reason || 'other';
      return r;
    }
    // ligar a um no existente (angulo livre)
    function linkTo(a, n) {
      var L = hyp(n.x - a.x, n.y - a.y), ex = { nodeId: n.id };
      if (linkedTo(a.id, n.id)) return roadRes(false, n.x, n.y, 'linked', ex);
      if (L < LINK_MIN) return roadRes(false, n.x, n.y, 'short', ex);
      if (L > CFG.maxRoadLen + 0.5) return roadRes(false, n.x, n.y, 'long', ex);
      var p = planPath(a, n.x, n.y, n.id, null);
      return roadRes(p.ok, n.x, n.y, p.reason, ex, p.cross);
    }
    // terminar sobre a estrada e no ponto (hx,hy) (T)
    function teeOn(a, e, hx, hy) {
      var ca = w.nodes[e.a], cb = w.nodes[e.b], L = hyp(hx - a.x, hy - a.y), ex = { edgeId: e.id };
      if (L < LINK_MIN) return roadRes(false, hx, hy, 'short', ex);
      if (L > CFG.maxRoadLen + 0.5) return roadRes(false, hx, hy, 'long', ex);
      if (!inRange(hx, hy)) return roadRes(false, hx, hy, 'range', ex);
      if (hyp(hx - ca.x, hy - ca.y) < MIN_PART || hyp(hx - cb.x, hy - cb.y) < MIN_PART) return roadRes(false, hx, hy, 'near', ex);
      var d = angDiff(Math.atan2(cb.y - ca.y, cb.x - ca.x) * DEG, Math.atan2(hy - a.y, hx - a.x) * DEG);
      if (Math.min(d, 180 - d) < JOIN_ANG) return roadRes(false, hx, hy, 'angle', ex);
      if (!spotOk(hx, hy, null, [e.id])) return roadRes(false, hx, hy, 'near', ex);
      var p = planPath(a, hx, hy, null, e.id);
      return roadRes(p.ok, hx, hy, p.reason, ex, p.cross);
    }
    // estrada mais perto do ponto, fora as que saem de a: {e, x, y, d}
    function edgeNear(a, x, y, maxD) {
      var best = null;
      for (var i = 0; i < edgeList.length; i++) {
        var e = edgeList[i];
        if (e.a === a.id || e.b === a.id) continue;
        var ca = w.nodes[e.a], cb = w.nodes[e.b], vx = cb.x - ca.x, vy = cb.y - ca.y;
        var t = ((x - ca.x) * vx + (y - ca.y) * vy) / (e.len * e.len);
        if (t < 0) t = 0; else if (t > 1) t = 1;
        var px = ca.x + vx * t, py = ca.y + vy * t, d = hyp(px - x, py - y);
        if (d <= maxD && (!best || d < best.d)) best = { e: e, x: px, y: py, d: d };
      }
      return best;
    }
    // ponta a 45 graus a partir do dedo: T perto do fim, encaixe em no perto do fim, ou ponta solta
    function ray45(a, x, y) {
      var dx = x - a.x, dy = y - a.y, L = hyp(dx, dy), i;
      if (L < 1e-6) return roadRes(false, a.x, a.y, 'short');
      var ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      var Lc = Math.max(CFG.minRoadLen, Math.min(CFG.maxRoadLen, L));
      var ux = Math.cos(ang), uy = Math.sin(ang);
      if (Math.abs(ux) < 1e-12) ux = 0;
      if (Math.abs(uy) < 1e-12) uy = 0;
      var ex = a.x + ux * Lc, ey = a.y + uy * Lc;
      // T: a estrada que o raio corta mais perto do fim (ate SNAP_R antes ou depois)
      var reach = Lc + SNAP_R, rx = a.x + ux * reach, ry = a.y + uy * reach, hitE = null, hitL = 0, gap = INF;
      for (i = 0; i < edgeList.length; i++) {
        var e = edgeList[i];
        if (e.a === a.id || e.b === a.id) continue;
        var ca = w.nodes[e.a], cb = w.nodes[e.b];
        var u = segHit(a.x, a.y, rx, ry, ca.x, ca.y, cb.x, cb.y);
        if (u < 0) continue;
        var g = Math.abs(u * reach - Lc);
        if (g <= SNAP_R && g < gap) { gap = g; hitE = e; hitL = u * reach; }
      }
      var tee = hitE ? teeOn(a, hitE, a.x + ux * hitL, a.y + uy * hitL) : null;
      if (tee && tee.ok) return tee;
      // fim perto de um no: liga nele (angulo livre)
      var nn = null, nd = CFG.minNodeSpacing;
      for (i = 0; i < nodeList.length; i++) {
        var n = nodeList[i];
        if (n.id === a.id) continue;
        var dn = hyp(n.x - ex, n.y - ey);
        if (dn < nd) { nd = dn; nn = n; }
      }
      if (nn) {
        var lk = linkTo(a, nn);
        if (lk.ok) return lk;
        return tee || roadRes(false, ex, ey, 'near');
      }
      if (tee) return tee;
      if (!inRange(ex, ey)) return roadRes(false, ex, ey, 'range');
      if (!spotOk(ex, ey, null, null)) return roadRes(false, ex, ey, 'blocked');
      var p = planPath(a, ex, ey, null, null);
      if (p.ok && p.cross && p.cross.length) {
        // toco: a ponta solta passa pouco (< minRoadLen) da ultima rua cruzada e ficaria um
        // pedaco de rua sem uso. Termina em T na propria rua cruzada; se nao der, recusa (stub).
        var lc = p.cross[p.cross.length - 1], tail = hyp(ex - lc.x, ey - lc.y);
        if (tail < CFG.minRoadLen - 0.5) {
          var tt = teeOn(a, w.edges[lc.edgeId], lc.x, lc.y);
          return tt.ok ? tt : roadRes(false, ex, ey, 'stub');
        }
      }
      return roadRes(p.ok, ex, ey, p.reason, null, p.cross);
    }
    // canAddEdge(aId, x, y, opts): opts.snap = raio de encaixe em unidades de mundo (a UI passa
    // o raio do dedo no zoom atual). Devolve {ok, x, y, nodeId?, edgeId?, cross?, capped?, reason?}.
    w.canAddEdge = function (aId, x, y, opts) {
      var a = w.nodes[aId];
      if (!a || typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) {
        return { ok: false, x: x, y: y, reason: 'other' };
      }
      var snap = SNAP_R, i;
      if (opts && typeof opts.snap === 'number' && opts.snap > SNAP_R) snap = Math.min(opts.snap, CFG.minNodeSpacing * 1.2);
      // 1) no existente perto do dedo: liga nele com angulo livre (o mais perto que der certo).
      // Se nenhum candidato serve, guarda o primeiro motivo e segue para os passos 2 a 4: com
      // snap grande (zoom afastado) um no a ~60 unidades nao pode tapar o T ou a ponta a 45 graus
      // que o snap pequeno aceitaria. O motivo guardado so volta se todos os passos falharem.
      var cands = [], firstFail = null;
      for (i = 0; i < nodeList.length; i++) {
        var n = nodeList[i];
        if (n.id === aId) continue;
        var dn = hyp(n.x - x, n.y - y);
        if (dn <= snap) cands.push({ n: n, d: dn });
      }
      if (cands.length) {
        cands.sort(function (p, q) { return p.d - q.d || p.n.id - q.n.id; });
        for (i = 0; i < cands.length; i++) {
          var lk = linkTo(a, cands[i].n);
          if (lk.ok) return lk;
          if (!firstFail) firstFail = lk;
        }
      }
      // 2) dedo em cima de uma estrada: T exatamente ali
      var en = edgeNear(a, x, y, snap);
      if (en && en.d < 0.5) {
        var t0 = teeOn(a, en.e, en.x, en.y);
        if (t0.ok) return t0;
      }
      // Alvo fora do alcance (regra de 2026-11-08, WALKTHROUGH2 caso 5): dedo em cima de um no
      // ou de uma estrada que fica alem de CFG.maxRoadLen. Antes o passo 3 cortava a rua em
      // maxRoadLen e ela terminava no vazio, calada, enquanto o mesmo gesto a 261 era recusado.
      // Agora mirar um alvo longe demais SEMPRE recusa com 'long' (a 261 ou a 395, igual).
      // Dedo no vazio alem do maximo continua valendo: o fantasma para no maximo e vem com
      // capped = true (a UI mostra a marca de corte e "Max length: lift to build here").
      var over = hyp(x - a.x, y - a.y) > CFG.maxRoadLen + 0.5, farHit = null;
      if (over) {
        if (firstFail && firstFail.reason === 'long') farHit = firstFail;
        else if (en) { var tf = teeOn(a, en.e, en.x, en.y); if (!tf.ok && tf.reason === 'long') farHit = tf; }
      }
      // 3) ponta a 45 graus
      var r = ray45(a, x, y);
      if (farHit && !(r.ok && ((farHit.nodeId != null && r.nodeId === farHit.nodeId) ||
                               (farHit.edgeId != null && r.edgeId === farHit.edgeId)))) return farHit;
      if (r.ok) { if (over) r.capped = true; return r; }
      // 4) o raio a 45 graus nao serve e o dedo esta perto de uma estrada: T com angulo livre ali.
      // So como resgate: assim o mesmo ponto final da sempre o mesmo plano (fantasma = obra),
      // qualquer que seja o raio de encaixe da UI.
      if (en && en.d >= 0.5) {
        var t1 = teeOn(a, en.e, en.x, en.y);
        if (t1.ok) return t1;
      }
      // tudo falhou: o motivo do no mais perto (passo 1) explica melhor que o do raio a 45 graus
      return firstFail || r;
    };
    w.portals = function () { return portalList.slice(); };
    // liga/desliga o portal de um no (crescimento da cidade move o portal para a ponta nova).
    // rate em (0,1): portal fraco; senao portal cheio. Devolve false para id invalido.
    w.setPortal = function (nodeId, on, rate) {
      var n = w.nodes[nodeId];
      if (!n) return false;
      n.portal = !!on;
      if (on && rate > 0 && rate < 1) n.rate = rate; else delete n.rate;
      var ns = NS[n.id]; if (ns) { ns.pend = 0; ns.pendDest = -1; ns.pq.length = 0; ns.pendLost = false; }
      rebuild();
      return true;
    };
    // sendCar(portalId): lanca agora um carro extra no portal, como um spawn normal (mesma rota,
    // mesma faixa livre, respeita carLen+carGap e entryGap; nao mexe em ns.pend/pendDest).
    // Devolve true se nasceu (stats.spawned++, evento 'spawn'); false para id invalido, no que nao
    // e portal, portal sem estrada de saida, menos de 2 portais, rota inexistente ou sem espaco.
    // rng: false NAO consome rng. true consome exatamente 1 rng(): sorteia o destino entre os
    // outros portais com rota e faixa livre de entrada (indice floor(rng()*n) na ordem de portalList).
    w.sendCar = function (portalId) {
      var p = w.nodes[portalId];
      if (!p || !p.portal || !NS[p.id] || portalList.length < 2 || !p.edges.length) return false;
      var cand = [], i;
      for (i = 0; i < portalList.length; i++) {
        var q = portalList[i];
        if (q === p) continue;
        var cd = route(p.id, -1, q.id);
        if (cd < 0 || !codeValid(cd, p.id) || laneFor(cd) < 0) continue;
        cand.push({ dest: q.id, code: cd });
      }
      if (!cand.length) return false;
      var pick = cand[Math.floor(rng() * cand.length)], l = laneFor(pick.code);
      var car = { id: nextCar++, edgeId: 0, dir: 1, s: 0, lane: 0, speed: CFG.speedSlow,
        dest: pick.dest, waited: 0, x: p.x, y: p.y, ang: 0,
        _i: w.cars.length, _we: 0, _next: -1, _from: p.id, _lineAt: -1, _wave: 0, _wh: 0 };
      w.cars.push(car);
      if (!enter(car, pick.code, l, p.id)) return false;
      setPos(car);
      w.stats.spawned++;
      events.push({ type: 'spawn', x: p.x, y: p.y, nodeId: p.id });
      return true;
    };

    // ---------- estado ----------
    function layoutJSON() {
      var nodes = [], edges = [], i;
      for (i = 0; i < nodeList.length; i++) {
        var n = nodeList[i];
        nodes.push({ id: n.id, x: n.x, y: n.y, tool: n.tool, portal: n.portal, pair: n.pair, rate: n.rate });
      }
      for (i = 0; i < edgeList.length; i++) {
        var e = edgeList[i];
        edges.push({ id: e.id, a: e.a, b: e.b, lanes: e.lanes, oneway: e.oneway });
      }
      return { v: 1, nextNode: nextNode, nextEdge: nextEdge, nodes: nodes, edges: edges };
    }
    w.cloneLayout = function () { return layoutJSON(); };
    w.snapshot = function () {
      var s = layoutJSON();
      s.seed = w.seed; s.day = w.day;
      s.params = { spawnMul: w.params.spawnMul, speedMul: w.params.speedMul,
        patienceMul: w.params.patienceMul, waveMul: w.params.waveMul };
      return s;
    };
    w.restore = function (snap) {
      if (!snap || !snap.nodes) return false;
      w.cars.length = 0;
      w.nodes = {}; w.edges = {}; Q = {}; NS = {}; distCache = {};
      nextNode = 1; nextEdge = 1;
      var i;
      for (i = 0; i < snap.nodes.length; i++) {
        var sn = snap.nodes[i], n = mkNode(sn.x, sn.y, sn.portal, sn.id);
        if (sn.rate > 0 && sn.rate < 1) n.rate = sn.rate;
        n.tool = sn.tool && TOOLS[sn.tool] ? sn.tool : null;
        n.pair = sn.pair == null ? null : sn.pair;
      }
      for (i = 0; i < snap.edges.length; i++) {
        var se = snap.edges[i];
        if (w.nodes[se.a] && w.nodes[se.b]) mkEdge(se.a, se.b, se.lanes, se.oneway, se.id);
      }
      if (snap.nextNode > nextNode) nextNode = snap.nextNode;
      if (snap.nextEdge > nextEdge) nextEdge = snap.nextEdge;
      for (var k in w.nodes) { var nn = w.nodes[k]; if (nn.pair != null && !w.nodes[nn.pair]) nn.pair = null; }
      if (snap.seed != null) w.seed = snap.seed >>> 0;
      if (snap.day != null) w.day = snap.day;
      if (snap.params) for (var p in w.params) if (snap.params[p] != null) w.params[p] = snap.params[p];
      rebuild();
      w.resetDay();
      return true;
    };

    rebuild();
    w.resetDay();
    return w;
  }

  CRZ.Sim = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
