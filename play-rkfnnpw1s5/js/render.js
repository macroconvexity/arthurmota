/* Cruzamento: desenho em canvas, camera e picking. Dono: agente RENDER.
 * Le game.world e game.state a cada quadro; nao escreve neles.
 * Coordenadas: tudo e desenhado em px CSS (transform = dpr), a camera e
 * aplicada a mao (sx = x*zoom + ox). Sem save/restore por carro, sem
 * alocacao por quadro (so quando surge estrada/no/ferramenta nova). */
(function (root) {
  'use strict';
  var CRZ = root.CRZ = root.CRZ || {};

  // ZMIN baixo: em tela estreita o jogador ainda ve a area toda onde pode construir (CFG.buildRadius)
  var ZMIN = 0.15, ZMAX = 3, FIT_ZMAX = 1.6;
  // zoom confortavel: a rua minima (CFG.minRoadLen) mede um polegar (44 px). O fit nao encolhe a
  // cidade abaixo disso; o resto da cidade fica a um arrasto de distancia (setas na borda)
  var THUMB_PX = 44;
  // alvo de toque: raio minimo e maximo em px de tela, qualquer que seja o zoom
  var PICK_MIN = 22, PICK_MAX = 44;
  // lupa do arrasto de rua: raio em px, distancia acima do dedo, ampliacao
  var FIT_BTN_W = 58, FIT_BTN_UP = 46;   // botao de enquadrar: largura a partir da borda direita, altura acima da area util
  var LOUPE_R = 46, LOUPE_UP = 100, LOUPE_MAG_MIN = 1.8, LOUPE_MAG_MAX = 2.6;
  var NOTE_MS = 1600;
  var GROW_MS = 420, POP_MS = 160, FLASH_MS = 420, INF_MS = 220, CAM_MS = 450;
  var PULSE_MS = 1400;
  var DASH_LANE = [4, 5], DASH_GHOST = [5, 4], DASH_NONE = [], DASH_BOOST = [7, 5], DASH_WAVE = [6, 4];
  // formas alem da cor (daltonismo): anel de estresse medio, fantasma invalido (picotado curto), flash ruim
  var DASH_STRESS = [5, 3.5], DASH_BAD = [2, 3.5];
  // marca NEW (cruzamento novo sem sinal): pontos redondos (traco 0,1 com ponta redonda), azul-acinzentado
  var DASH_NEWJ = [0.1, 4.2], NEWJ_COLOR = '#7a6aa8', NEWJ_FONT = '800 8px -apple-system, system-ui, sans-serif', NEWJ_TEXT = 'NEW';
  var NEWJ_DX = Math.SQRT1_2;   // ponto pulsante no anel, embaixo a direita (o X do travado fica em cima a direita)
  var JUNCTION_TOOLS = { stop: 1, yield: 1, light: 1, round: 1, cross: 1 };
  // no travado com sinal: o anel vira arco aberto no canto de cima a direita, onde fica o X
  var LOCK_BADGE = -Math.PI / 4, LOCK_GAP = 0.62;
  var LOCK_A0 = LOCK_BADGE + LOCK_GAP, LOCK_A1 = LOCK_BADGE - LOCK_GAP + Math.PI * 2;
  var LOCK_BX = Math.cos(LOCK_BADGE), LOCK_BY = Math.sin(LOCK_BADGE);
  // contador do anel agrupado da fila de ontem: no alto a esquerda
  var COUNT_A = -Math.PI * 0.75, COUNT_FONT = '700 9px -apple-system, system-ui, sans-serif', COUNT_MANY = '20+';
  var TAU = Math.PI * 2;
  // critica de arte 2026-11-09: carro com material proprio (ardosia), nao a tinta das ruas
  var CAR_COLOR = '#3d4f66';
  // anel de estresse medio (0,3 a 0,6, tracejado): ambar escuro, legivel no creme; vermelho so acima de 0,6
  var STRESS_MID = '#d98a00';
  // mapa de problemas de ontem (plano/resumo): cinza-azulado escuro, tracejado fino. Nao e alerta de hoje:
  // nao compete com o ambar (0,3 a 0,6) nem com o vermelho (> 0,6) quando os dois caem no mesmo no
  var HOT_COLOR = '#6b7a8f', HOT_W = 1.2, HOT_ALPHA = 0.85;
  // miolo da rua de 2 faixas: um tom acima do grid (#efeae0), le como avenida no creme
  var LANE_FILL = '#e4dccb';
  // pulso de entrega: anel na ponta de destino quando um carro chega (pool fixo, sem alocar por quadro)
  var DELIV_N = 24, DELIV_MS = 280, DELIV_RM_MS = 200;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function easeOut(t) { t = 1 - t; return 1 - t * t * t; }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeBack(t) { var c = 1.9; t = t - 1; return 1 + (c + 1) * t * t * t + c * t * t; }

  function create(canvas, game) {
    var CFG = CRZ.CFG, C = CFG.colors;
    var ctx = canvas.getContext('2d');
    var dpr = 1, W = 0, H = 0;
    var lastNow = 0, frame = 0;
    var reduceMotion = false, boostList = new Array(64), deadList = new Array(64), deadScale = new Float64Array(64), deadN = 0;
    for (var bl = 0; bl < 64; bl++) boostList[bl] = null;
    // prefers-reduced-motion: lido na criacao e acompanhado ao vivo (mudar no sistema vale ja, sem recarregar)
    var rmMql = null, rmOn = null;
    try {
      if (typeof window !== 'undefined' && window.matchMedia) {
        rmMql = window.matchMedia('(prefers-reduced-motion: reduce)');
        reduceMotion = !!(rmMql && rmMql.matches);
        rmOn = function (ev) {
          reduceMotion = !!(ev && typeof ev.matches === 'boolean' ? ev.matches : rmMql.matches);
          if (reduceMotion && anim.on) { anim.on = false; var c0 = cam(); c0.x = anim.tx; c0.y = anim.ty; c0.zoom = anim.tz; }
          forceDraw = true;
        };
        if (rmMql && rmMql.addEventListener) rmMql.addEventListener('change', rmOn);
        else if (rmMql && rmMql.addListener) rmMql.addListener(rmOn);
      }
    } catch (e) { reduceMotion = false; }

    // rastreio de mudancas entre quadros (deteccao de estrada/no/ferramenta nova)
    var lastWorld = null;
    var edgeBorn = {}, edgeFrom = {}, edgeSeen = {}, edgeGeom = {}, edgeCount = 0;
    var nodeBorn = {}, nodeSeen = {}, nodeTool = {}, toolPop = {}, nodeCount = 0;
    var newEdges = [], newEdgesN = 0, gone = [], goneN = 0;
    var lastWaveHits = 0, waveGlow = 0, lastPairs = -1;
    var RING_MIN = 0.3;   // anel vermelho de estresse aparece daqui (o "Nice" do tutorial sai abaixo disso)
    var infId = null, infT0 = 0;

    // Quadro parado (summary/over): se o ultimo quadro nao tinha nada que dependa do relogio
    // (frameAnim) e a chave do estado (idleKey + identidades) nao mudou, o canvas ja mostra
    // exatamente este quadro: draw() volta sem desenhar. Rede de seguranca: redesenha a cada
    // IDLE_MS (no maximo 10 fps parado). r.invalidate() forca o proximo quadro.
    var IDLE_MS = 100;
    var frameAnim = true, forceDraw = true, idleDrawAt = -1e9, idleSkipped = 0, idleKeyV = NaN;
    var idleId = [null, null, null, null, null, null, null, null, null, null, null];
    var TOOL_CODE = { stop: 1, yield: 2, light: 3, round: 4, cross: 5 };
    // hash numerico barato (sem alocar) de tudo que o desenho le e nao e relogio
    function idleKey(w, st, ov, c) {
      var m = r.margins || {}, k, n, e, i = 0, q, h, cars = w.cars, hm = st && st.hot, gr = ov.ghostRoad, fg = ov.finger;
      h = W * 7.1 + H * 13.3 + dpr * 17.9 + c.x * 1.77 + c.y * 2.31 + c.zoom * 1013.7 +
        (m.top || 0) * 0.31 + (m.bottom || 0) * 0.37 + (m.left || 0) * 0.41 + (m.right || 0) * 0.43 + safe.l * 0.47 + safe.r * 0.53;
      for (k in w.nodes) {
        n = w.nodes[k]; if (!n) continue;
        i++; q = 1 + (i % 89) * 0.0137;
        h += q * (n.x * 0.113 + n.y * 0.131 + (n.stress || 0) * 3.17 + (n.boost || 0) * 1.93 + (n.locked ? 5.3 : 0) +
          (n.portal ? 7.1 : 0) + (n.tool ? (TOOL_CODE[n.tool] || 9) * 11.3 : 0) + (+n.lightPhase || 0) * 2.93 +
          (n.pair === null || n.pair === undefined ? 0 : (+n.pair || 0) * 0.77 + 1.1) + (n.edges ? n.edges.length : 0) * 0.61 + (+k || 0) * 0.019);
      }
      for (k in w.edges) {
        e = w.edges[k]; if (!e) continue;
        i++; q = 1 + (i % 89) * 0.0137;
        h += q * ((+e.a || 0) * 0.23 + (+e.b || 0) * 0.29 + (e.lanes || 1) * 1.31 + (e.oneway || 0) * 1.71 + (+k || 0) * 0.031);
      }
      if (cars) {
        h += cars.length * 101.3;
        for (k = 0; k < cars.length; k++) {
          n = cars[k]; if (!n) continue;
          q = 1 + (k % 89) * 0.0137;
          h += q * ((+n.x || 0) * 0.071 + (+n.y || 0) * 0.093 + (+n.ang || 0) * 1.3 + (+n.s || 0) * 0.051 + (n.lane ? 1.7 : 0) +
            (+n.edgeId || 0) * 0.037 + (+n.dir || 0) * 0.53);
        }
      }
      if (hm) for (k in hm) h += (+hm[k] || 0) * (1 + ((+k || 0) % 89) * 0.0137) * 0.71;
      h += ((w.stats && w.stats.waveHits) || 0) * 0.97;
      if (gr) {
        h += (+gr.x || 0) * 0.17 + (+gr.y || 0) * 0.19 + (+gr.fromId || 0) * 0.3 + (gr.ok === false ? 3 : 1) + (gr.capped ? 2 : 0) +
          (gr.nodeId === null || gr.nodeId === undefined ? 0 : (+gr.nodeId || 0) * 0.11 + 1) +
          (gr.edgeId === null || gr.edgeId === undefined ? 0 : (+gr.edgeId || 0) * 0.13 + 1) + (gr.cross ? gr.cross.length * 0.7 : 0);
        if (gr.cross) for (k = 0; k < gr.cross.length; k++) if (gr.cross[k]) h += (+gr.cross[k].x || 0) * 0.01 + (+gr.cross[k].y || 0) * 0.011;
        if (gr.reach) h += (+gr.reach.x || 0) * 0.021 + (+gr.reach.y || 0) * 0.023;
      }
      if (fg) h += (+fg.x || 0) * 0.27 + (+fg.y || 0) * 0.29;
      if (ov.pulse) h += ov.pulse.length * 3.3;
      return h;
    }
    // identidades (objetos e textos) que a chave numerica nao cobre; true se alguma mudou
    function idleIds(w, st, ov) {
      var gr = ov.ghostRoad, ch = false, v, i;
      for (i = 0; i < 11; i++) {
        v = i === 0 ? w : i === 1 ? (st ? st.phase : null) : i === 2 ? ov : i === 3 ? ov.hoverTool : i === 4 ? gr :
          i === 5 ? (gr ? gr.reason : null) : i === 6 ? (gr ? gr.tip : null) : i === 7 ? ov.selectedNode :
          i === 8 ? ov.showInfluence : i === 9 ? (st ? st.hot : null) : ov.pulse;
        if (v === undefined) v = null;
        if (idleId[i] !== v) { idleId[i] = v; ch = true; }
      }
      return ch;
    }

    // pontas de rua que parecem ligadas a outra rua mas nao estao (cache por assinatura do layout)
    var nearW = null, nearSig = NaN, nearN = 0, nearXY = new Float64Array(128);
    var NEAR_D = 20;
    function nearSigOf(w) {
      var h = 0, c = 0, k, o;
      for (k in w.nodes) { o = w.nodes[k]; if (o) { h += o.x * 1.3 + o.y * 0.7; c++; } }
      for (k in w.edges) { o = w.edges[k]; if (o) { h += (+o.a || 0) * 3 + (+o.b || 0) * 5; c += 1000; } }
      return h + c * 1e6;
    }
    // recalcula so quando o layout muda; aloca apenas nesse caso
    function computeNear(w) {
      var deg = {}, k, e, n, m = 0, a, b;
      nearN = 0;
      for (k in w.edges) { e = w.edges[k]; if (!e) continue; deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; }
      for (k in w.nodes) {
        n = w.nodes[k]; if (!n || n.tool || n.portal || deg[k] !== 1 || nearN >= 64) continue;
        var hit = false;
        for (var j in w.edges) {
          e = w.edges[j]; if (!e || String(e.a) === k || String(e.b) === k) continue;
          a = w.nodes[e.a]; b = w.nodes[e.b]; if (!a || !b) continue;
          var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
          var t = l2 > 0 ? clamp(((n.x - a.x) * dx + (n.y - a.y) * dy) / l2, 0, 1) : 0;
          var px = a.x + dx * t - n.x, py = a.y + dy * t - n.y;
          if (px * px + py * py < NEAR_D * NEAR_D) { hit = true; break; }
        }
        if (hit) { nearXY[nearN * 2] = n.x; nearXY[nearN * 2 + 1] = n.y; nearN++; }
      }
    }

    // Rua na mao: nos onde uma rua nova pode comecar ou terminar sem cara de "curva".
    // Ponta de rua (1 rua, portal ou nao) e cruzamento (3+ ruas) com uma folga de angulo de
    // pelo menos 2x linkMinAngle entre ruas vizinhas (o sim recusa ligar mais perto que isso).
    // Curva/meio de rua (2 ruas) fica de fora. Cache por assinatura do layout.
    var hintW = null, roadSig = NaN, roadHint = [], roadHintN = 0, roadAng = new Float64Array(16);
    var ROAD_GAP = 2 * (CFG.linkMinAngle || 12) * Math.PI / 180;
    function roadAccepts(w, n) {
      var ids = n.edges || [], dg = ids.length, i, j, e, o, t, gap;
      if (dg === 1 || dg === 0) return true;
      if (dg === 2 || dg > 16) return false;
      for (i = 0; i < dg; i++) {
        e = w.edges[ids[i]]; o = e && w.nodes[e.a === n.id ? e.b : e.a];
        roadAng[i] = o ? Math.atan2(o.y - n.y, o.x - n.x) : 0;
      }
      for (i = 1; i < dg; i++) { t = roadAng[i]; j = i - 1; while (j >= 0 && roadAng[j] > t) { roadAng[j + 1] = roadAng[j]; j--; } roadAng[j + 1] = t; }
      gap = roadAng[0] + TAU - roadAng[dg - 1];
      for (i = 1; i < dg; i++) if (roadAng[i] - roadAng[i - 1] > gap) gap = roadAng[i] - roadAng[i - 1];
      return gap >= ROAD_GAP;
    }
    function computeRoadHints(w) {
      var k, n;
      roadHintN = 0;
      for (k in w.nodes) {
        n = w.nodes[k]; if (!n || !roadAccepts(w, n)) continue;
        if (roadHintN < roadHint.length) roadHint[roadHintN] = n; else roadHint.push(n);
        roadHintN++;
      }
      for (k = roadHintN; k < roadHint.length; k++) roadHint[k] = null;
    }
    // no de origem da Rua: o do arrasto em curso; sem arrasto, o selecionado
    function gr0Origin(ov, nodes) {
      var g = ov.ghostRoad, id = g && g.fromId !== null && g.fromId !== undefined ? g.fromId : ov.selectedNode;
      return id !== null && id !== undefined && nodes[id] ? nodes[id] : null;
    }
    function roadHintsT() { var out = []; for (var i = 0; i < roadHintN; i++) out.push(roadHint[i].id); return out; } // so para testes

    // Fila de ontem (st.hot): aneis tracejados de nos a menos de HOT_CLUSTER px na tela viram um
    // anel envolvente com contador. Agrupamento em mundo (distancia * zoom), em cache pela chave
    // (mundo, zoom, valores do mapa, posicao e sinal de cada no quente); recalcular nao aloca.
    var HOT_CLUSTER = 36, HOT_MAX = 128, HOT_MIN = 0.35;
    var hotNode = new Array(HOT_MAX), hotHr = new Float64Array(HOT_MAX), hotPar = new Int32Array(HOT_MAX), hotN = 0;
    var hotSolo = new Uint8Array(HOT_MAX), hotCl = new Int32Array(HOT_MAX);
    var clX = new Float64Array(64), clY = new Float64Array(64), clR = new Float64Array(64), clN = new Int32Array(64), clCount = 0;
    var hotW = null, hotHm = null, hotZ = NaN, hotKey = NaN, hotPs = NaN, hotRecalc = 0;
    var COUNT_TXT = [];
    for (var cti = 0; cti <= 20; cti++) COUNT_TXT.push(String(cti));
    function hotRadius(n, hv, ps, dotR) {
      if (hv > 1) hv = 1;
      var hr = ((n.tool ? ps * 0.5 : dotR) + 6 + ((hv - HOT_MIN) / (1 - HOT_MIN)) * 8) * 1.2;
      return hr < 7 ? 7 : hr;
    }
    function hotKeyOf(hm, nodes) {
      var h = 0, k, n, v, q;
      for (k in hm) {
        v = +hm[k] || 0; n = nodes[k];
        q = 1 + ((+k || 0) % 89) * 0.0137;
        h += q * (v * 3.1 + (n ? n.x * 0.013 + n.y * 0.017 + (n.tool ? (TOOL_CODE[n.tool] || 9) * 0.7 : 0) : 0.5));
      }
      return h;
    }
    function rootOf(i) { while (hotPar[i] !== i) { hotPar[i] = hotPar[hotPar[i]]; i = hotPar[i]; } return i; }
    function computeHot(hm, nodes, z, ps, dotR) {
      var k, n, hv, i, j, a, b, dx, dy, lim = HOT_CLUSTER / z, lim2 = lim * lim;
      hotRecalc++;
      hotN = 0; clCount = 0;
      for (k in hm) {
        n = nodes[k]; hv = hm[k];
        if (!n || !(hv >= HOT_MIN) || hotN >= HOT_MAX) continue;
        hotNode[hotN] = n; hotHr[hotN] = hotRadius(n, hv, ps, dotR); hotPar[hotN] = hotN; hotN++;
      }
      for (i = 0; i < hotN; i++) for (j = i + 1; j < hotN; j++) {
        dx = hotNode[i].x - hotNode[j].x; dy = hotNode[i].y - hotNode[j].y;
        if (dx * dx + dy * dy < lim2) { a = rootOf(i); b = rootOf(j); if (a !== b) hotPar[b] = a; }
      }
      for (i = 0; i < hotN; i++) hotSolo[i] = 1;
      // cada raiz com 2+ membros: centro = media; raio = maior (distancia ao centro em px + anel do membro)
      for (i = 0; i < hotN; i++) {
        if (rootOf(i) !== i) continue;
        var cnt = 0, sx = 0, sy = 0;
        for (j = 0; j < hotN; j++) if (rootOf(j) === i) { cnt++; sx += hotNode[j].x; sy += hotNode[j].y; }
        if (cnt < 2 || clCount >= 64) continue;
        sx /= cnt; sy /= cnt;
        var rad = 0;
        for (j = 0; j < hotN; j++) if (rootOf(j) === i) {
          hotSolo[j] = 0; hotCl[j] = clCount;
          dx = hotNode[j].x - sx; dy = hotNode[j].y - sy;
          var rr = Math.sqrt(dx * dx + dy * dy) * z + hotHr[j];
          if (rr > rad) rad = rr;
        }
        clX[clCount] = sx; clY[clCount] = sy; clR[clCount] = rad + 2; clN[clCount] = cnt; clCount++;
      }
      for (i = hotN; i < HOT_MAX && hotNode[i]; i++) hotNode[i] = null;
    }
    // aneis da fila de ontem do ultimo calculo: [{x, y (mundo), r (px), count, ids}] (a UI pode
    // usar para nao cobrir um anel agrupado com o chip; testes)
    function hotRingsT() {
      var out = [], i, j;
      for (i = 0; i < hotN; i++) if (hotSolo[i]) out.push({ x: hotNode[i].x, y: hotNode[i].y, r: hotHr[i], count: 1, ids: [hotNode[i].id] });
      for (i = 0; i < clCount; i++) {
        var ids = [];
        for (j = 0; j < hotN; j++) if (!hotSolo[j] && hotCl[j] === i) ids.push(hotNode[j].id);
        out.push({ x: clX[i], y: clY[i], r: clR[i], count: clN[i], ids: ids });
      }
      return out;
    }

    var njBox = [];   // ids com a marca NEW desenhada no ultimo quadro (r.newJMarks, testes)
    var flashes = [];
    for (var fi = 0; fi < 16; fi++) flashes.push({ on: false, x: 0, y: 0, kind: '', t0: 0 });
    var flashNext = 0;
    // pulsos de entrega: t0 < 0 = nasce no proximo draw (o evento vem no relogio do jogo, nao no do quadro)
    var dvX = new Float64Array(DELIV_N), dvY = new Float64Array(DELIV_N), dvT0 = new Float64Array(DELIV_N);
    var dvOn = new Uint8Array(DELIV_N), dvNext = 0, dvLive = 0;

    var anim = { on: false, t0: 0, fx: 0, fy: 0, fz: 1, tx: 0, ty: 0, tz: 1 };
    // aviso curto em texto perto de um ponto (ex.: por que a rua nao saiu); um por vez
    var note = { on: false, x: 0, y: 0, text: '', t0: 0 };
    // rotulos pedidos no quadro (desenhados depois da lupa e das setas, para fugir deles); sem alocar por quadro
    var labReq = [
      { on: false, text: '', px: 0, py: 0, alpha: 1, color: null, line: false },
      { on: false, text: '', px: 0, py: 0, alpha: 1, color: null, line: false }
    ];
    // geometria do fantasma neste quadro (tela): linha, ponta, alvo de encaixe, marca de corte
    var gGeo = { on: false, x0: 0, y0: 0, x1: 0, y1: 0, sx: 0, sy: 0, sr: 0, rx: 0, ry: 0, rb: 0, ncross: 0 };
    var gCross = new Float64Array(64);   // x,y de cada losango (ate 32)
    var arrowR = new Float64Array(16);   // retangulos das setas de borda (ate 4)
    var arrowN = 0;
    // a camera nao foge da area construivel (auto-pan e pan longo param na borda)
    var CAM_R = (CFG.buildRadius || CFG.worldRadius || 900) + 200;
    var ZCOMF = clamp(THUMB_PX / (CFG.minRoadLen || 80), ZMIN, FIT_ZMAX);
    // nos fora da area util, por lado (preenchido em draw, sem alocar); pos = coordenada media na borda
    var offs = { any: false, left: 0, right: 0, top: 0, bottom: 0, lpos: 0, rpos: 0, tpos: 0, bpos: 0 };
    // piso de zoom desta instancia: ZMIN, ou menos quando fitAll precisa mostrar uma cidade lotada inteira
    // (ruas do jogador ate buildRadius: 3000 de largura nao cabem em 390 px no ZMIN). Nunca abaixo de ZFLOOR
    var ZFLOOR = 0.04, zMin = ZMIN;

    var r = {
      camera: { x: 0, y: 0, zoom: 1 },
      // finger: ponto de tela do dedo durante o arrasto de rua (a UI escreve; lupa acima dele)
      overlay: { selectedNode: null, hoverTool: null, ghostRoad: null, showInfluence: null, pulse: [], finger: null, newJ: [] },
      // margens de tela usadas por fit() (px CSS): topo e base reservados ao HUD
      margins: { top: 84, right: 28, bottom: 150, left: 28 },
      width: 0, height: 0, dpr: 1,
      zoomLimits: { min: ZMIN, max: ZMAX, comfort: ZCOMF }
    };

    function cam() {
      var c = r.camera;
      if (!c || !isFinite(c.x) || !isFinite(c.y) || !isFinite(c.zoom)) {
        c = r.camera = { x: 0, y: 0, zoom: 1 };
      }
      if (c.zoom < zMin) c.zoom = zMin; else if (c.zoom > ZMAX) c.zoom = ZMAX;
      return c;
    }

    r.resize = function () {
      var rd = (typeof root.devicePixelRatio === 'number' && root.devicePixelRatio > 0) ? root.devicePixelRatio : 1;
      dpr = Math.min(2.5, rd);
      var cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) {
        if (canvas.getBoundingClientRect) {
          var b = canvas.getBoundingClientRect();
          cw = cw || b.width; ch = ch || b.height;
        }
      }
      if (!cw || !ch) { cw = cw || W || canvas.width || 1; ch = ch || H || canvas.height || 1; }
      W = cw; H = ch;
      var pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
      if (canvas.width !== pw) canvas.width = pw;
      if (canvas.height !== ph) canvas.height = ph;
      r.width = W; r.height = H; r.dpr = dpr;
      readSafe();
      if (fitBox) fitBox.dirty = true;   // botao de enquadrar: rele a posicao na proxima consulta
    };

    // safe-area lateral (notch/ilha em paisagem), em px CSS. Lida so no resize, por uma sonda
    // invisivel com padding = env(); sem DOM (teste em node) fica 0.
    var safe = { l: 0, r: 0 }, probe = null;
    r.safe = safe;
    function readSafe() {
      safe.l = 0; safe.r = 0;
      try {
        var d = root.document;
        if (!d || !d.createElement || !d.body || !root.getComputedStyle) return;
        if (!probe) {
          probe = d.createElement('div');
          probe.setAttribute('aria-hidden', 'true');
          probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
            'padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)';
          d.body.appendChild(probe);
        }
        var cs = root.getComputedStyle(probe);
        safe.l = parseFloat(cs.paddingLeft) || 0; safe.r = parseFloat(cs.paddingRight) || 0;
      } catch (e) { safe.l = 0; safe.r = 0; }
    }

    r.toScreen = function (x, y) {
      var c = cam();
      return { x: (x - c.x) * c.zoom + W * 0.5, y: (y - c.y) * c.zoom + H * 0.5 };
    };
    r.toWorld = function (sx, sy) {
      var c = cam();
      return { x: (sx - W * 0.5) / c.zoom + c.x, y: (sy - H * 0.5) / c.zoom + c.y };
    };

    // clampCam(p): leva o centro {x, y} de volta para dentro do disco de raio CAM_R (no lugar).
    // Vale para a camera e para o alvo de uma animacao; pan, zoomAt e moveCam passam por aqui.
    // Folga do HUD: com margens desiguais (topo 64, base 150) o centro da camera fica (mb - mt) / 2 / zoom
    // fora do centro da area util; em zoom baixo isso passa de CAM_R e cortava a borda da cidade no fitAll
    function clampCam(p, z) {
      // so abaixo do ZMIN (cidade lotada no fitAll): no zoom de jogo o disco continua o de sempre
      var m = r.margins || {}, zz = z > 0 ? z : cam().zoom;
      var R = zz >= ZMIN - 1e-9 ? CAM_R : CAM_R + (Math.abs((m.bottom || 0) - (m.top || 0)) + Math.abs((m.right || 0) - (m.left || 0))) * 0.5 / zz;
      var d = Math.sqrt(p.x * p.x + p.y * p.y);
      if (d > R) { p.x *= R / d; p.y *= R / d; }
      return p;
    }

    r.pan = function (dx, dy) {
      var c = cam();
      anim.on = false; held.moved = true;
      c.x -= dx / c.zoom; c.y -= dy / c.zoom;
      clampCam(c);
    };

    r.zoomAt = function (factor, sx, sy) {
      if (!(factor > 0) || !isFinite(factor)) return;
      var c = cam();
      anim.on = false; held.moved = true;
      if (typeof sx !== 'number') { sx = W * 0.5; sy = H * 0.5; }
      var wx = (sx - W * 0.5) / c.zoom + c.x, wy = (sy - H * 0.5) / c.zoom + c.y;
      c.zoom = clamp(c.zoom * factor, zMin, ZMAX);
      c.x = wx - (sx - W * 0.5) / c.zoom;
      c.y = wy - (sy - H * 0.5) / c.zoom;
      clampCam(c);
    };

    // Camera congelada durante um gesto (WALKTHROUGH2 problema 4): a UI chama hold(true) no
    // pointerdown e hold(false) quando o ultimo dedo sai. hold(true) para a animacao em curso
    // exatamente no quadro que a jogadora esta vendo (o ponto sob o dedo nao foge). Enquanto
    // segura, focus/fit/reveal nao mexem na camera: o ultimo pedido fica guardado e roda (animado)
    // ao soltar, a menos que o proprio gesto tenha movido a camera (pan, pinca, auto-pan).
    var held = { on: false, moved: false, pend: false, x: 0, y: 0, z: 1 };
    r.hold = function (on) {
      if (on) {
        if (held.on) return;
        anim.on = false;
        held.on = true; held.moved = false; held.pend = false;
        return;
      }
      if (!held.on) return;
      held.on = false;
      if (held.pend && !held.moved) { held.pend = false; moveCam(held.x, held.y, held.z, true); }
      held.pend = false;
    };
    r.held = function () { return held.on; };
    function moveCam(x, y, z, animated) {
      var c = cam();
      z = clamp(z, zMin, ZMAX);
      if (held.on) { held.pend = true; held.x = x; held.y = y; held.z = z; return; }
      // alvo limitado ao CAM_R antes de aplicar ou animar (focus, fit, reveal passam por aqui)
      var t = clampCam({ x: x, y: y }, z);
      if (!animated || reduceMotion) { anim.on = false; c.x = t.x; c.y = t.y; c.zoom = z; return; }   // reduce: salta ao destino
      anim.on = true; anim.t0 = -1;
      anim.fx = c.x; anim.fy = c.y; anim.fz = c.zoom;
      anim.tx = t.x; anim.ty = t.y; anim.tz = z;
    }

    r.focus = function (x, y, zoom, animated) {
      var c = cam();
      moveCam(x, y, typeof zoom === 'number' ? zoom : c.zoom, !!animated);
    };

    // area util da tela (sem HUD), em px CSS; tela pequena: margens nao comem mais que 45% de cada eixo
    var ua = { l: 0, r: 0, t: 0, b: 0, w: 40, h: 40 };
    function usable() {
      var m = r.margins || {};
      var ml = m.left || 0, mr = m.right || 0, mt = m.top || 0, mb = m.bottom || 0;
      var sh = Math.min(1, (H * 0.45) / Math.max(1, mt + mb)), sw = Math.min(1, (W * 0.45) / Math.max(1, ml + mr));
      ua.l = ml * sw; ua.r = mr * sw; ua.t = mt * sh; ua.b = mb * sh;
      ua.w = Math.max(40, W - ua.l - ua.r); ua.h = Math.max(40, H - ua.t - ua.b);
      // HUD mudou (ui.js reescreveu as margens): o botao de enquadrar pode ter andado, rele na proxima consulta
      if (mt !== fitBox.mt || mb !== fitBox.mb || ml !== fitBox.ml || mr !== fitBox.mr) {
        fitBox.mt = mt; fitBox.mb = mb; fitBox.ml = ml; fitBox.mr = mr; fitBox.dirty = true;
      }
      return ua;
    }

    // ---- botao de enquadrar (.crz-fit, DOM do ui.js): posicao real, cacheada ----
    // O ui.js sobe o botao ate ~30 px (placeFit) para nao cobrir as cargas do Boost. A reserva dos rotulos e
    // da lupa usa o topo real do botao. getBoundingClientRect so quando algo mudou: resize, margens novas
    // (usable), r.layoutChanged() ou mudanca de style/class do botao (MutationObserver). Nunca por quadro.
    // Sem DOM, sem botao ou botao escondido: a reserva fixa FIT_BTN_UP acima da area util.
    var FIT_PAD = 4, FIT_RAISE_MAX = 80;
    var fitBox = { dirty: true, top: NaN, reads: 0, mt: -1, mb: -1, ml: -1, mr: -1 }, fitEl = null, fitMo = null;
    function readFit() {
      fitBox.dirty = false; fitBox.top = NaN;
      try {
        var d = root.document;
        if (!d || !d.querySelector) return;
        if (!fitEl || fitEl.isConnected === false) {
          if (fitMo) { try { fitMo.disconnect(); } catch (e0) {} fitMo = null; }
          fitEl = d.querySelector('.crz-fit');
          if (fitEl && typeof root.MutationObserver === 'function') {
            fitMo = new root.MutationObserver(function () { fitBox.dirty = true; forceDraw = true; });
            fitMo.observe(fitEl, { attributes: true, attributeFilter: ['style', 'class'] });
          }
        }
        if (!fitEl || !fitEl.getBoundingClientRect) return;
        if (fitEl.classList && fitEl.classList.contains && fitEl.classList.contains('gone')) return;
        var fb = fitEl.getBoundingClientRect();
        fitBox.reads++;
        if (!fb || !(fb.height > 0) || !(fb.width > 0) || !isFinite(fb.top)) return;
        var cb = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
        fitBox.top = fb.top - (cb && isFinite(cb.top) ? cb.top : 0);
      } catch (e) { fitBox.top = NaN; }
    }
    // y (px CSS do canvas) a partir do qual o botao reserva a faixa da direita; u = usable()
    function fitTop(u) {
      if (fitBox.dirty) readFit();
      var nat = H - u.b - FIT_BTN_UP;
      if (!(fitBox.top === fitBox.top)) return nat;
      return clamp(fitBox.top - FIT_PAD, nat - FIT_RAISE_MAX, nat);
    }
    // ui.js: chame depois de mexer no HUD/botao sem resize nem margem nova (opcional, o observer ja cobre)
    r.layoutChanged = function () { fitBox.dirty = true; forceDraw = true; };
    r._fitBox = function () { return fitBox; };   // so para testes

    // fit: enquadra a cidade, mas nunca abaixo do zoom confortavel (ZCOMF). Cidade maior que a tela
    // fica centrada no miolo (media dos nos) e o resto se ve arrastando; setas na borda avisam.
    r.fit = function (animated) { fitView(animated, 40, 'comfort'); };
    // visao geral: a cidade inteira, mesmo que fique pequena (botao de enquadrar)
    r.fitAll = function (animated) { fitView(animated, 40, 'all'); };
    // espaco para construir: com a ferramenta Rua ativa, a cidade ganha folga de uma rua maxima em volta.
    // So afasta (nunca aproxima), e nao afasta alem do zoom confortavel.
    r.fitRoom = function (animated, pad) { fitView(animated, typeof pad === 'number' ? pad : CFG.maxRoadLen, 'room'); };
    function fitView(animated, pad, mode) {
      if (!W || !H) r.resize();
      var w = game && game.world, nodes = w && w.nodes;
      var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity, sx = 0, sy = 0, cnt = 0, k, n;
      if (nodes) for (k in nodes) {
        n = nodes[k];
        if (!n) continue;
        if (n.x < minx) minx = n.x; if (n.x > maxx) maxx = n.x;
        if (n.y < miny) miny = n.y; if (n.y > maxy) maxy = n.y;
        sx += n.x; sy += n.y; cnt++;
      }
      if (minx === Infinity) { moveCam(0, 0, 1, animated); return; }
      var u = usable(), ml = u.l, mr = u.r, mt = u.t, mb = u.b, aw = u.w, ah = u.h;
      // pad: folga em unidades de mundo (pictogramas, aneis; ou uma rua inteira em fitRoom)
      var bw = (maxx - minx) + pad * 2, bh = (maxy - miny) + pad * 2;
      var zAll = clamp(Math.min(aw / bw, ah / bh), ZMIN, FIT_ZMAX), z = zAll;
      if (mode === 'all') {
        // cidade inteira com folga de ALL_PX px de tela (24 px + raio do pictograma) alem da folga de mundo:
        // em zoom baixo a folga de mundo encolhe a poucos px e o no da borda ficava sob o HUD ou fora.
        // Cidade lotada abaixo do ZMIN: o piso desta instancia desce ate caber (nunca abaixo de ZFLOOR)
        var ALL_PX = 24 + 8, sw2 = Math.max(1, maxx - minx), sh2 = Math.max(1, maxy - miny);
        var zPx = Math.min((aw - 2 * ALL_PX) / sw2, (ah - 2 * ALL_PX) / sh2);
        z = Math.min(aw / bw, ah / bh, zPx > 0 ? zPx : ZFLOOR, FIT_ZMAX);
        if (z < zMin) { zMin = Math.max(ZFLOOR, z); r.zoomLimits.min = zMin; }
        z = clamp(z, zMin, FIT_ZMAX);
      }
      var cx = (minx + maxx) * 0.5, cy = (miny + maxy) * 0.5;
      var rcx = ml + aw * 0.5, rcy = mt + ah * 0.5, c = cam(), cut = false;
      if (mode === 'comfort' && zAll < ZCOMF) {
        z = ZCOMF; cut = true; cx = sx / cnt; cy = sy / cnt;
      } else if (mode === 'room') {
        if (zAll >= c.zoom) {
          // ja afastado o bastante: so confere se a caixa com folga esta inteira na area livre
          var p0 = r.toScreen(minx - pad, miny - pad), p1 = r.toScreen(maxx + pad, maxy + pad);
          if (p0.x >= ml - 1 && p0.y >= mt - 1 && p1.x <= W - mr + 1 && p1.y <= H - mb + 1) return;
          z = c.zoom;
        } else if (zAll < ZCOMF) {
          // a cidade com folga nao cabe no zoom confortavel: afasta so ate ele, sem tirar o lugar da vista
          if (c.zoom <= ZCOMF + 1e-9) return;
          z = ZCOMF; cut = true;
          var cw = r.toWorld(rcx, rcy); cx = cw.x; cy = cw.y;
        }
      }
      if (cut) {
        // a vista nao passa da borda da cidade (com folga) em nenhum eixo; eixo que cabe fica centrado
        var hx = aw * 0.5 / z, hy = ah * 0.5 / z;
        cx = (maxx - minx) + pad * 2 <= hx * 2 ? (minx + maxx) * 0.5 : clamp(cx, minx - pad + hx, maxx + pad - hx);
        cy = (maxy - miny) + pad * 2 <= hy * 2 ? (miny + maxy) * 0.5 : clamp(cy, miny - pad + hy, maxy + pad - hy);
      }
      moveCam(cx - (rcx - W * 0.5) / z, cy - (rcy - H * 0.5) / z, z, animated);
    }
    // reveal(x, y): anda o minimo para o ponto de mundo ficar na area util (dica ou tutorial fora da tela)
    // force = true: anda mesmo com a camera segura num gesto (a UI usa no comeco do arrasto da Rua, quando a
    // origem esta fora da area util; e o unico reenquadramento ligado a Rua)
    r.reveal = function (x, y, animated, force) {
      if (!isFinite(x) || !isFinite(y)) return false;
      if (force && held.on) {
        var hc = cam(), hu = usable(), hp = r.toScreen(x, y), hi = 36, hdx = 0, hdy = 0;
        if (hp.x < hu.l + hi) hdx = hp.x - (hu.l + hi); else if (hp.x > W - hu.r - hi) hdx = hp.x - (W - hu.r - hi);
        if (hp.y < hu.t + hi) hdy = hp.y - (hu.t + hi); else if (hp.y > H - hu.b - hi) hdy = hp.y - (H - hu.b - hi);
        if (!hdx && !hdy) return false;
        var ht = clampCam({ x: hc.x + hdx / hc.zoom, y: hc.y + hdy / hc.zoom }, hc.zoom);
        anim.on = false; hc.x = ht.x; hc.y = ht.y; held.moved = true;
        return true;
      }
      if (!W || !H) r.resize();
      var u = usable(), c = cam(), p = r.toScreen(x, y), ins = 36, dx = 0, dy = 0;
      if (p.x < u.l + ins) dx = p.x - (u.l + ins); else if (p.x > W - u.r - ins) dx = p.x - (W - u.r - ins);
      if (p.y < u.t + ins) dy = p.y - (u.t + ins); else if (p.y > H - u.b - ins) dy = p.y - (H - u.b - ins);
      if (!dx && !dy) return false;
      moveCam(c.x + dx / c.zoom, c.y + dy / c.zoom, c.zoom, !!animated);
      return true;
    };
    // nos fora da area util (lido pela UI: botao de enquadrar e dica de arrastar). Atualizado em draw.
    r.offscreen = function () { return offs; };
    r.animating = function () { return !!anim.on; };
    // settle(): termina ja a animacao de camera em curso (pula para o alvo). A UI chama antes de
    // enquadrar sem animacao (pegar a Rua): nada mais anda sob o dedo depois disso
    // stop(): para a animacao de camera em curso ONDE ESTA (nao salta para o alvo). A UI chama ao escolher
    // ferramenta: escolher ferramenta nunca mexe a camera (passeio humano 2026-11-09)
    r.stop = function () {
      if (!anim.on) return false;
      anim.on = false;
      return true;
    };
    r.settle = function () {
      if (!anim.on) return false;
      var c = cam();
      anim.on = false; c.x = anim.tx; c.y = anim.ty; c.zoom = anim.tz;
      return true;
    };

    // raio de toque em px de tela: cresce um pouco em zoom baixo, sempre entre PICK_MIN e PICK_MAX
    function pickPx(scale) {
      var z = cam().zoom;
      return clamp(CFG.nodePickRadius * scale * (z < 1 ? Math.sqrt(1 / z) : 1), PICK_MIN, PICK_MAX);
    }
    r.pickRadius = function () { return pickPx(1); };

    // pickNode(sx, sy, prefer): o no mais perto dentro do raio. prefer(n) opcional: se algum no no raio
    // passa no filtro, ganha o mais perto entre eles (ex.: ferramenta de cruzamento prefere cruzamento a ponta)
    r.pickNode = function (sx, sy, prefer) {
      var w = game && game.world, nodes = w && w.nodes;
      if (!nodes) return null;
      var c = cam();
      var p = r.toWorld(sx, sy), rw = pickPx(1) / c.zoom, best = null, bd = rw * rw, pb = null, pd = rw * rw, k, n, dx, dy, d;
      var usePref = typeof prefer === 'function';
      for (k in nodes) {
        n = nodes[k]; if (!n) continue;
        dx = n.x - p.x; dy = n.y - p.y; d = dx * dx + dy * dy;
        if (d <= bd) { bd = d; best = n; }
        if (usePref && d <= pd && prefer(n)) { pd = d; pb = n; }
      }
      // o preferido so ganha se esta quase tao perto quanto o mais perto (ate 14 px a mais): dedo em
      // cima de uma ponta continua sendo a ponta
      if (pb && pb !== best && Math.sqrt(pd) - Math.sqrt(bd) > 14 / c.zoom) return best;
      return pb || best;
    };

    // pickEdge: estrada mais perto dentro do raio; empate (perto de um no comum) fica com a que passa
    // mais pelo meio do dedo (t longe das pontas)
    r.pickEdge = function (sx, sy) {
      var w = game && game.world, nodes = w && w.nodes, edges = w && w.edges;
      if (!nodes || !edges) return null;
      var c = cam();
      var p = r.toWorld(sx, sy), rw = pickPx(0.75) / c.zoom, lim = rw * rw, bd = Infinity, best = null, bt = 0, bm = 0;
      var tie = 2 / c.zoom, k, e, a, b, vx, vy, l2, t, qx, qy, d, mid;
      for (k in edges) {
        e = edges[k]; if (!e) continue;
        a = nodes[e.a]; b = nodes[e.b]; if (!a || !b) continue;
        vx = b.x - a.x; vy = b.y - a.y; l2 = vx * vx + vy * vy;
        t = l2 > 0 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2 : 0;
        t = clamp(t, 0, 1);
        qx = a.x + vx * t - p.x; qy = a.y + vy * t - p.y; d = qx * qx + qy * qy;
        if (d > lim) continue;
        mid = Math.min(t, 1 - t);
        if (!best || Math.sqrt(d) < Math.sqrt(bd) - tie || (Math.abs(Math.sqrt(d) - Math.sqrt(bd)) <= tie && mid > bm)) {
          bd = d; best = e; bt = t; bm = mid;
        }
      }
      return best ? { edge: best, t: bt } : null;
    };

    // r.note(x, y, text): texto curto vermelho perto do ponto de mundo, some sozinho
    r.note = function (x, y, text) {
      if (!text || !isFinite(x) || !isFinite(y)) { note.on = false; return; }
      note.on = true; note.x = x; note.y = y; note.text = String(text); note.t0 = -1;
    };

    // carro entregue em (x, y) (mundo): anel verde curto na ponta. O mais antigo cede a vez quando os 24 estao em uso
    r.deliver = function (x, y) {
      if (!isFinite(x) || !isFinite(y)) return;
      var i = dvNext; dvNext = (dvNext + 1) % DELIV_N;
      if (!dvOn[i]) dvLive++;
      dvOn[i] = 1; dvX[i] = x; dvY[i] = y; dvT0[i] = -1;
    };
    r._delivLive = function () { return dvLive; }; // so para testes: pulsos de entrega ativos

    r.flash = function (x, y, kind) {
      var f = flashes[flashNext];
      flashNext = (flashNext + 1) % flashes.length;
      f.on = true; f.x = x; f.y = y; f.kind = kind || 'place'; f.t0 = -1;
    };

    // raio de efeito de um cruzamento (unidades de mundo)
    r.influenceRadius = function (nodeId) {
      var w = game && game.world, n = w && w.nodes && w.nodes[nodeId];
      if (!n) return 0;
      var longest = 0, i, e, ids = n.edges || [];
      for (i = 0; i < ids.length; i++) {
        e = w.edges[ids[i]];
        if (e && e.len > longest) longest = e.len;
      }
      if (!longest) longest = CFG.minRoadLen;
      return clamp(longest, CFG.minRoadLen, CFG.maxRoadLen) * 0.6;
    };

    /* ---------- realce de via (API publica: ui.js chama r.highlightRoad por feature-detect) ---------- */
    // Ate HL_N realces ao mesmo tempo em campos fixos (nada alocado por quadro). O relogio comeca no
    // primeiro draw depois da chamada (t0 = -1 pendente), no mesmo relogio do quadro.
    var HL_N = 2, HL_COLOR = '#d98a00', HL_DEF_MS = 2000, HL_MAX_MS = 60000, HL_EXTRA = 1.2;
    var hlId = [null, null], hlT0 = new Float64Array(HL_N), hlMs = new Float64Array(HL_N), hlSeq = new Float64Array(HL_N);
    var hlLive = 0, hlSeqN = 0, hlWorld = null;
    function hlCancel() { for (var i = 0; i < HL_N; i++) hlId[i] = null; if (hlLive) forceDraw = true; hlLive = 0; }
    // realca a via edgeId por ms (padrao 2000): traco +1,2 px ambar com alpha que decai; reduce-motion: fixo e
    // some seco ao fim. Mesma via de novo reinicia; com HL_N ativos, troca o mais antigo. Devolve false se a
    // via nao existe no mundo atual.
    r.highlightRoad = function (edgeId, ms) {
      var w = game && game.world;
      if (edgeId === null || edgeId === undefined || !w || !w.edges || !w.edges[edgeId]) return false;
      ms = (typeof ms === 'number' && isFinite(ms) && ms > 0) ? Math.min(ms, HL_MAX_MS) : HL_DEF_MS;
      if (hlWorld !== w) { hlCancel(); hlWorld = w; }   // pedidos de outro mundo nao valem mais
      var s = -1, i;
      for (i = 0; i < HL_N; i++) if (hlId[i] !== null && hlId[i] == edgeId) { s = i; break; }   // eslint-disable-line eqeqeq
      if (s < 0) for (i = 0; i < HL_N; i++) if (hlId[i] === null) { s = i; break; }
      if (s < 0) { s = 0; for (i = 1; i < HL_N; i++) if (hlSeq[i] < hlSeq[s]) s = i; }
      if (hlId[s] === null) hlLive++;
      hlId[s] = edgeId; hlT0[s] = -1; hlMs[s] = ms; hlSeq[s] = ++hlSeqN;
      forceDraw = true;
      return true;
    };
    r._highlights = function () {   // so para testes: realces ativos
      var out = [], i;
      for (i = 0; i < HL_N; i++) if (hlId[i] !== null) out.push({ id: hlId[i], t0: hlT0[i], ms: hlMs[i] });
      return out;
    };
    // desenha os realces ativos (chamado logo depois das ruas, antes dos carros)
    function drawHighlights(edges, nodes, z, ox, oy, roadW, now) {
      var i, j, e, a, b, t, al, lg, hit;
      for (i = 0; i < HL_N; i++) {
        if (hlId[i] === null) continue;
        e = edges[hlId[i]];
        a = e && nodes[e.a]; b = e && nodes[e.b];
        if (!a || !b) { hlId[i] = null; hlLive--; continue; }   // via removida: realce sai
        if (hlT0[i] < 0 || now < hlT0[i]) hlT0[i] = now;
        t = (now - hlT0[i]) / hlMs[i];
        if (t >= 1) { hlId[i] = null; hlLive--; continue; }      // fim: some (o quadro atual ja sai sem ele)
        frameAnim = true;                                        // invalida so enquanto ativo
        al = reduceMotion ? 1 : 1 - t * t;
        ctx.beginPath();
        if ((e.lanes || 1) >= 2) {
          // 2 faixas: as duas linhas de contorno, com o recorte do quadro (laneGeo); sem ele, o eixo
          hit = null;
          for (j = 0; j < laneGeo.length; j++) if (laneGeo[j].id === e.id) { hit = laneGeo[j]; break; }
          if (hit) {
            var hdx = hit.x1 - hit.x0, hdy = hit.y1 - hit.y0, hl = Math.sqrt(hdx * hdx + hdy * hdy) || 1;
            var hpx = -hdy / hl * hit.hw, hpy = hdx / hl * hit.hw;
            ctx.moveTo(hit.x0 + hpx, hit.y0 + hpy); ctx.lineTo(hit.x1 + hpx, hit.y1 + hpy);
            ctx.moveTo(hit.x0 - hpx, hit.y0 - hpy); ctx.lineTo(hit.x1 - hpx, hit.y1 - hpy);
          } else { ctx.moveTo(a.x * z + ox, a.y * z + oy); ctx.lineTo(b.x * z + ox, b.y * z + oy); }
        } else { ctx.moveTo(a.x * z + ox, a.y * z + oy); ctx.lineTo(b.x * z + ox, b.y * z + oy); }
        ctx.strokeStyle = HL_COLOR; ctx.lineWidth = roadW + HL_EXTRA; ctx.globalAlpha = al;
        ctx.lineCap = (e.lanes || 1) >= 2 ? 'butt' : 'round';
        ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.lineCap = 'round';
    }

    /* ---------- rastreio de mudancas ---------- */

    function resetTracking(w, now) {
      for (var di = 0; di < DELIV_N; di++) dvOn[di] = 0;
      dvLive = 0;
      if (hlWorld !== w) hlCancel();   // troca de mundo: realce de via cancelado (o pedido do mundo novo fica)
      edgeBorn = {}; edgeFrom = {}; edgeSeen = {}; edgeGeom = {}; edgeCount = 0;
      nodeBorn = {}; nodeSeen = {}; nodeTool = {}; toolPop = {}; nodeCount = 0;
      var k, n, e;
      if (w && w.nodes) for (k in w.nodes) {
        n = w.nodes[k]; if (!n) continue;
        nodeBorn[k] = -1e9; nodeSeen[k] = frame; nodeTool[k] = n.tool || null; nodeCount++;
      }
      if (w && w.edges) for (k in w.edges) {
        e = w.edges[k]; if (!e) continue;
        edgeBorn[k] = -1e9; edgeFrom[k] = 0; edgeSeen[k] = frame; edgeCount++;
        storeGeom(w, k, e);
      }
      lastWaveHits = (w && w.stats && w.stats.waveHits) || 0;
      waveGlow = 0; lastPairs = -1;
      lastWorld = w;
    }

    function storeGeom(w, k, e) {
      var a = w.nodes[e.a], b = w.nodes[e.b];
      if (a && b) edgeGeom[k] = [a.x, a.y, b.x, b.y];
    }

    function onSegment(g, x, y) {
      var vx = g[2] - g[0], vy = g[3] - g[1], l2 = vx * vx + vy * vy;
      if (l2 <= 0) return false;
      var t = ((x - g[0]) * vx + (y - g[1]) * vy) / l2;
      if (t < -0.001 || t > 1.001) return false;
      var qx = g[0] + vx * t - x, qy = g[1] + vy * t - y;
      return qx * qx + qy * qy < 1.5;
    }

    function track(w, now) {
      var k, n, e, i, j, cnt, a, b, split;
      frame++;
      // nos
      cnt = 0;
      for (k in w.nodes) {
        n = w.nodes[k]; if (!n) continue;
        cnt++;
        if (nodeSeen[k] === undefined) { nodeCount++; nodeBorn[k] = now; nodeTool[k] = null; }
        nodeSeen[k] = frame;
        var tl = n.tool || null;
        if (tl !== nodeTool[k]) {
          if (tl) toolPop[k] = now;
          nodeTool[k] = tl;
        }
      }
      if (nodeCount > cnt) {
        for (k in nodeSeen) if (nodeSeen[k] !== frame) {
          delete nodeSeen[k]; delete nodeBorn[k]; delete nodeTool[k]; delete toolPop[k];
        }
        nodeCount = cnt;
      }
      // estradas
      cnt = 0; newEdgesN = 0;
      for (k in w.edges) {
        e = w.edges[k]; if (!e) continue;
        cnt++;
        if (edgeSeen[k] === undefined) {
          edgeCount++;
          if (newEdgesN < newEdges.length) newEdges[newEdgesN] = k; else newEdges.push(k);
          newEdgesN++;
        }
        edgeSeen[k] = frame;
      }
      goneN = 0;
      if (edgeCount > cnt) {
        for (k in edgeSeen) if (edgeSeen[k] !== frame) {
          if (edgeGeom[k]) { if (goneN < gone.length) gone[goneN] = edgeGeom[k]; else gone.push(edgeGeom[k]); goneN++; }
          delete edgeSeen[k]; delete edgeBorn[k]; delete edgeFrom[k]; delete edgeGeom[k];
        }
        edgeCount = cnt;
      }
      for (i = 0; i < newEdgesN; i++) {
        k = newEdges[i]; e = w.edges[k];
        storeGeom(w, k, e);
        a = w.nodes[e.a]; b = w.nodes[e.b];
        // pedaco de estrada dividida (splitEdge): nao anima
        split = false;
        if (a && b) for (j = 0; j < goneN; j++) {
          if (onSegment(gone[j], a.x, a.y) && onSegment(gone[j], b.x, b.y)) { split = true; break; }
        }
        if (split || !a || !b) { edgeBorn[k] = -1e9; edgeFrom[k] = 0; continue; }
        edgeBorn[k] = now;
        // cresce do no mais antigo
        var ba = nodeBorn[e.a], bb = nodeBorn[e.b];
        edgeFrom[k] = (ba !== undefined && bb !== undefined && bb < ba) ? 1 : 0;
      }
      // onda verde: brilho quando o contador de acertos sobe
      var wh = (w.stats && w.stats.waveHits) || 0;
      if (wh > lastWaveHits) waveGlow = 1;
      lastWaveHits = wh;
    }

    /* ---------- desenho ---------- */

    function roundRect(x, y, w, h, rr) {
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y); ctx.arcTo(x + w, y, x + w, y + rr, rr);
      ctx.lineTo(x + w, y + h - rr); ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
      ctx.lineTo(x + rr, y + h); ctx.arcTo(x, y + h, x, y + h - rr, rr);
      ctx.lineTo(x, y + rr); ctx.arcTo(x, y, x + rr, y, rr);
      ctx.closePath();
    }

    // Regra do sim (rebuild/axisKey): para cada estrada que ENTRA no no, chave =
    // round((angulo de saida mod 180) / 45) % 4; grupos = chaves distintas em ordem
    // crescente; o grupo g esta verde quando n.lightPhase === g (-1 = todo-vermelho).
    var axisPres = [0, 0, 0, 0];
    function arrives(e, nid) { return (e.b === nid && e.oneway !== -1) || (e.a === nid && e.oneway !== 1); }
    function axisKeyOf(nodes, e, n) {
      var o = nodes[e.a === n.id ? e.b : e.a];
      if (!o) return -1;
      var d = Math.atan2(o.y - n.y, o.x - n.x) * 57.29577951308232;
      d = ((d % 180) + 180) % 180;
      return Math.round(d / 45) % 4;
    }
    // grupo (indice) de uma estrada de chegada; precisa de axisPres preenchido por axisFill
    function axisFill(nodes, edges, n) {
      var i, e, kk, cnt = 0;
      axisPres[0] = axisPres[1] = axisPres[2] = axisPres[3] = 0;
      var ids = n.edges || [];
      for (i = 0; i < ids.length; i++) {
        e = edges[ids[i]];
        if (!e || !arrives(e, n.id)) continue;
        kk = axisKeyOf(nodes, e, n);
        if (kk >= 0 && !axisPres[kk]) { axisPres[kk] = 1; cnt++; }
      }
      return cnt;
    }
    function axisGroup(key) {
      var g = 0;
      for (var q = 0; q < key; q++) if (axisPres[q]) g++;
      return g;
    }
    r._axisGroups = function (nodeId) { // so para testes: [{edgeId, group, green}]
      var w = game && game.world, n = w && w.nodes && w.nodes[nodeId], out = [];
      if (!n) return out;
      axisFill(w.nodes, w.edges, n);
      for (var i = 0; i < n.edges.length; i++) {
        var e = w.edges[n.edges[i]];
        if (!e || !arrives(e, n.id)) continue;
        var g = axisGroup(axisKeyOf(w.nodes, e, n));
        out.push({ edgeId: e.id, group: g, green: n.lightPhase === g });
      }
      return out;
    };

    // raio negativo ou NaN lanca IndexSizeError no canvas: piso 0 (sem alocar)
    var laneGeo = [], lanePool = [];
    var lockGeo = { on: false, deg: 0 };   // fio do angulo travado do ultimo quadro (testes)
    // raio de recorte da faixa de 2 faixas na ponta de um no (px de tela, ao longo do eixo da rua).
    // Portal = o anel; beco = o ponto. Em curva/cruzamento a faixa para onde a borda dela encontraria
    // a rua vizinha (linha simples: hw/sen(ang); outra faixa: hw/tan(ang/2)), com piso na meia largura,
    // assim nenhuma faixa passa por cima de outra rua no centro do cruzamento. (ux, uy): direcao da rua
    // saindo do no.
    function laneClip(n, eId, ux, uy, hw, dr, pss, nodes, edges) {
      var ids = n.edges || [], dg = ids.length;
      var c = n.portal ? dr * 1.9 + 1 : (dg < 2 ? dr + 1 : (n.tool ? Math.max(pss * 0.5 + 1, hw * 0.5) : hw * 0.5 + 1));
      var i, o, m, vx, vy, vl, cs, sn, need;
      for (i = 0; i < dg; i++) {
        if (ids[i] === eId) continue;
        o = edges[ids[i]]; if (!o) continue;
        m = nodes[o.a === n.id ? o.b : o.a]; if (!m) continue;
        vx = m.x - n.x; vy = m.y - n.y; vl = Math.sqrt(vx * vx + vy * vy); if (vl < 1e-6) continue;
        cs = (vx * ux + vy * uy) / vl;
        var dual = (o.lanes || 1) >= 2;
        // linha simples a 90 graus ou mais nao cruza a faixa; outra faixa so nao encosta se segue reto
        if (dual ? cs < -0.995 : cs <= 0) continue;
        sn = Math.sqrt(Math.max(1e-4, 1 - cs * cs));
        need = dual ? hw * (1 + cs) / sn : hw * cs / sn;   // hw/tan(a/2) e hw*cot(a)
        if (need + 1 > c) c = need + 1;
      }
      return Math.min(c, hw * 4);
    }
    function portalJunction(n) { return !!(n && n.portal && n.edges && n.edges.length >= 3); }
    function circle(x, y, rad) { if (!(rad > 0)) rad = 0; ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, TAU); }

    function drawPicto(tool, x, y, s, phase) {
      var h = s * 0.5;
      if (tool === 'stop') {
        ctx.fillStyle = C.red; ctx.beginPath(); circle(x, y, h); ctx.fill();
        ctx.fillStyle = C.white; ctx.fillRect(x - s * 0.31, y - s * 0.09, s * 0.62, s * 0.18);
      } else if (tool === 'yield') {
        var ty = y - h * 0.62;
        ctx.beginPath();
        ctx.moveTo(x - h * 1.02, ty); ctx.lineTo(x + h * 1.02, ty); ctx.lineTo(x, y + h * 1.08); ctx.closePath();
        ctx.fillStyle = C.bg; ctx.fill();
        ctx.strokeStyle = C.red; ctx.lineWidth = Math.max(1.6, s * 0.15); ctx.lineJoin = 'round'; ctx.stroke();
      } else if (tool === 'light') {
        // corpo 11x24 com s = 22; lightPhase >= 0: verde para algum eixo, -1: todo-vermelho
        var lw = s * 0.5, lh = s * 1.09;
        ctx.fillStyle = C.ink; ctx.beginPath(); roundRect(x - lw * 0.5, y - lh * 0.5, lw, lh, lw * 0.36); ctx.fill();
        var dr = lw * 0.28, gap = lh * 0.285;
        var lit = phase >= 0 ? 2 : 0;
        for (var i = 0; i < 3; i++) {
          ctx.fillStyle = i === lit ? (i === 0 ? C.red : C.green) : '#454545';
          ctx.beginPath(); circle(x, y + (i - 1) * gap, dr); ctx.fill();
        }
      } else if (tool === 'round') {
        var rr = s * 0.4;
        ctx.fillStyle = C.bg; ctx.beginPath(); circle(x, y, rr); ctx.fill();
        ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, s * 0.16); ctx.beginPath(); circle(x, y, rr); ctx.stroke();
        // ilha central: aro + ponto = rotatoria (o aro vazado sozinho lia como ponta de rua/portal)
        ctx.fillStyle = C.ink; ctx.beginPath(); circle(x, y, s * 0.11); ctx.fill();
      } else if (tool === 'cross') {
        // zebra: 3 barras solidas sem moldura (fundo creme so para cortar a rua por baixo)
        var cw = s * 0.9, ch = s * 0.7, x0 = x - cw * 0.5, y0 = y - ch * 0.5;
        ctx.fillStyle = C.bg; ctx.fillRect(x0, y0, cw, ch);
        ctx.fillStyle = C.ink;
        var sw = cw / 5;
        for (var j = 0; j < 3; j++) ctx.fillRect(x0 + sw * j * 2, y0, sw, ch);
      }
    }

    r.draw = function (now) {
      if (typeof now !== 'number' || !isFinite(now)) now = lastNow + 16.7;
      lastNow = now;
      if (!W || !H) r.resize();
      var w = game && game.world;
      var st = (game && game.state) || null;
      var phase = st ? st.phase : null;
      var ov = r.overlay || {};

      // animacao de camera
      var c = cam(), camAnim = anim.on;
      if (anim.on) {
        if (anim.t0 < 0 || now < anim.t0) anim.t0 = now;
        var at = reduceMotion ? 1 : clamp((now - anim.t0) / CAM_MS, 0, 1), ae = easeInOut(at);
        c.x = anim.fx + (anim.tx - anim.fx) * ae;
        c.y = anim.fy + (anim.ty - anim.fy) * ae;
        c.zoom = Math.exp(Math.log(anim.fz) + (Math.log(anim.tz) - Math.log(anim.fz)) * ae);
        if (at >= 1) anim.on = false;
      }
      var z = c.zoom, ox = W * 0.5 - c.x * z, oy = H * 0.5 - c.y * z;

      // quadro parado: summary/over sem nada no relogio e com o mesmo estado do ultimo quadro
      if ((phase === 'summary' || phase === 'over') && w && w.nodes && w.edges && w === lastWorld) {
        var ik = idleKey(w, st, ov, c), idCh = idleIds(w, st, ov);
        if (!forceDraw && !frameAnim && !camAnim && !idCh && ik === idleKeyV && now >= idleDrawAt && now - idleDrawAt < IDLE_MS) {
          waveGlow *= 0.96;   // o brilho decai igual ao quadro desenhado (o proximo sai identico)
          idleSkipped++;
          return;
        }
        idleKeyV = ik; idleDrawAt = now;
      } else { idleKeyV = NaN; }
      forceDraw = false; frameAnim = camAnim;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);
      if (!w || !w.nodes || !w.edges) return;

      if (w !== lastWorld) resetTracking(w, now);
      else track(w, now);

      var nodes = w.nodes, edges = w.edges, k, n, e, a, b, i;
      // escalas
      var ps = clamp(22 * Math.pow(z, 0.3), 12, 32);         // pictograma (22 px em zoom 1)
      var carPx = clamp(6.5 * z, 7, 9);                        // largura do carro (piso 7 px; o teto da fila abaixo manda)
      var carLenPx = carPx * 1.4;                              // comprimento (1.4x a largura, ~8 px no piso)
      // nunca maior que o espaco da fila na sim (carLen + carGap), senao os carros se sobrepoem
      var carCap = ((CFG.carLen || 8) + (CFG.carGap || 4)) * z - 0.6;
      // em zoom muito baixo o espaco da fila fica abaixo de 3 px: o carro encolhe ate ele (piso 1 px),
      // a fila vira uma barra com frestas em vez de retangulos sobrepostos; a largura fica >= 2 px
      if (carLenPx > carCap) { carLenPx = carCap < 1 ? 1 : carCap; carPx = Math.min(carPx, Math.max(2, carLenPx / 1.1)); }
      var carHL = carLenPx * 0.5;                              // meio comprimento
      var roadW = clamp(2.2 * Math.pow(z, 0.25), 1.6, 3);     // linha de estrada (peso de mapa de metro)
      var off1 = Math.max(CFG.laneOffset * z, carPx * 0.5 + roadW * 0.5 + 1.2); // carro a linha
      var laneSp = Math.max(CFG.laneOffset * z, carPx + 1.2); // distancia entre colunas de carros
      var hw2 = off1 + laneSp + carPx * 0.5 + 2.5;            // meia largura de 2 faixas
      var dotR = clamp(2.2 * Math.pow(z, 0.4), 1.4, 3.2);
      var cullPad = hw2 + ps + 30;
      var sx0 = -cullPad, sy0 = -cullPad, sx1 = W + cullPad, sy1 = H + cullPad;
      waveGlow *= 0.96;

      // influencia
      if (ov.showInfluence !== infId) { infId = ov.showInfluence; infT0 = now; }
      if (infId !== null && infId !== undefined && nodes[infId]) {
        n = nodes[infId];
        if (now - infT0 < INF_MS) frameAnim = true;
        var ir = r.influenceRadius(infId) * z * easeOut(clamp((now - infT0) / INF_MS, 0, 1));
        if (ir > 0.5) {
          ctx.beginPath(); circle(n.x * z + ox, n.y * z + oy, ir);
          ctx.globalAlpha = 0.75; ctx.fillStyle = C.grid; ctx.fill();
          ctx.globalAlpha = 0.5; ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 1; ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // estradas: 4 passos (preenchimento claro das ruas de 2 faixas, linhas simples, contorno das
      // 2 faixas, tracejado central). Rua de 2 faixas = UMA faixa: preenchimento claro entre duas linhas
      // de contorno, recortada nas pontas pelo raio do no (laneClip). Antes as bordas iam de centro a
      // centro e, com varias ruas duplas num cruzamento, se cruzavam em retangulos sobrepostos.
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      var pass, any;
      laneGeo.length = 0;
      for (pass = 0; pass < 4; pass++) {
        ctx.beginPath(); any = false;
        for (k in edges) {
          e = edges[k]; if (!e) continue;
          var two = (e.lanes || 1) >= 2;
          if ((pass === 1) === two) continue;
          a = nodes[e.a]; b = nodes[e.b]; if (!a || !b) continue;
          var ax = a.x * z + ox, ay = a.y * z + oy, bx = b.x * z + ox, by = b.y * z + oy;
          if ((ax < sx0 && bx < sx0) || (ax > sx1 && bx > sx1) || (ay < sy0 && by < sy0) || (ay > sy1 && by > sy1)) continue;
          var g = edgeBorn[k] > -1e8 ? easeOut(clamp((now - edgeBorn[k]) / GROW_MS, 0, 1)) : 1, na = a, nb = b;
          if (g < 1) {
            frameAnim = true;
            if (edgeFrom[k] === 1) { var tx = ax, ty = ay; ax = bx; ay = by; bx = tx; by = ty; na = b; nb = a; }
            bx = ax + (bx - ax) * g; by = ay + (by - ay) * g;
          }
          if (pass === 1) { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); any = true; continue; }
          var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy);
          if (L < 0.01) continue;
          if (pass === 3) { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); any = true; continue; }
          // faixa recortada: a ponta que ainda cresce (g < 1) nao tem no, nao recorta
          var ux = dx / L, uy = dy / L, ca = laneClip(na, e.id, ux, uy, hw2, dotR, ps, nodes, edges), cb = g < 1 ? 0 : laneClip(nb, e.id, -ux, -uy, hw2, dotR, ps, nodes, edges);
          if (ca + cb >= L - 1) continue;   // rua curta demais para a faixa entre os dois nos: so o tracejado
          var cax = ax + ux * ca, cay = ay + uy * ca, cbx = bx - ux * cb, cby = by - uy * cb;
          var px = -uy * hw2, py = ux * hw2;
          if (pass === 0) {
            if (laneGeo.length < 400) {
              // objetos do pool (sem alocar por quadro); push dentro da capacidade nao aloca
              var lgo = lanePool[laneGeo.length] || (lanePool[laneGeo.length] = { id: 0, x0: 0, y0: 0, x1: 0, y1: 0, hw: 0 });
              lgo.id = e.id; lgo.x0 = cax; lgo.y0 = cay; lgo.x1 = cbx; lgo.y1 = cby; lgo.hw = hw2;
              laneGeo.push(lgo);
            }
            ctx.moveTo(cax + px, cay + py); ctx.lineTo(cbx + px, cby + py);
            ctx.lineTo(cbx - px, cby - py); ctx.lineTo(cax - px, cay - py); ctx.closePath();
          } else {
            ctx.moveTo(cax + px, cay + py); ctx.lineTo(cbx + px, cby + py);
            ctx.moveTo(cax - px, cay - py); ctx.lineTo(cbx - px, cby - py);
          }
          any = true;
        }
        if (!any) continue;
        if (pass === 0) { ctx.fillStyle = LANE_FILL; ctx.fill(); continue; }
        ctx.strokeStyle = C.ink;
        if (pass === 3) { ctx.setLineDash(DASH_LANE); ctx.lineWidth = Math.max(1, roadW * 0.7); ctx.lineCap = 'butt'; }
        else { ctx.setLineDash(DASH_NONE); ctx.lineWidth = roadW; ctx.lineCap = pass === 2 ? 'butt' : 'round'; }
        ctx.stroke();
      }
      ctx.setLineDash(DASH_NONE); ctx.lineCap = 'round';
      if (hlLive > 0) drawHighlights(edges, nodes, z, ox, oy, roadW, now);   // realce de via (r.highlightRoad)

      // setas de mao unica
      ctx.beginPath(); any = false;
      var as = clamp(ps * 0.42, 5, 10);
      for (k in edges) {
        e = edges[k]; if (!e || !e.oneway) continue;
        if (edgeBorn[k] > -1e8 && now - edgeBorn[k] < GROW_MS) { frameAnim = true; continue; }
        a = nodes[e.a]; b = nodes[e.b]; if (!a || !b) continue;
        var mx = (a.x + b.x) * 0.5 * z + ox, my = (a.y + b.y) * 0.5 * z + oy;
        if (mx < sx0 || mx > sx1 || my < sy0 || my > sy1) continue;
        var ux = b.x - a.x, uy = b.y - a.y, ul = Math.sqrt(ux * ux + uy * uy);
        if (ul < 0.01) continue;
        ux = ux / ul * e.oneway; uy = uy / ul * e.oneway;
        ctx.moveTo(mx + ux * as, my + uy * as);
        ctx.lineTo(mx - ux * as * 0.7 - uy * as * 0.8, my - uy * as * 0.7 + ux * as * 0.8);
        ctx.lineTo(mx - ux * as * 0.7 + uy * as * 0.8, my - uy * as * 0.7 - ux * as * 0.8);
        ctx.closePath(); any = true;
      }
      if (any) { ctx.fillStyle = C.ink; ctx.fill(); }

      // onda verde: linha fina verde tracejada entre os dois semaforos pareados, POR CIMA das ruas
      // (antes ficava sob elas, a 55%, e a jogadora nao via que o par deu certo). Par novo: brilha.
      ctx.beginPath();
      var anyWave = false, nPairs = 0;
      for (k in nodes) {
        n = nodes[k];
        if (!n || n.tool !== 'light' || n.pair === null || n.pair === undefined) continue;
        b = nodes[n.pair];
        if (!b || b.tool !== 'light' || !(n.id < b.id)) continue;
        nPairs++;
        var wx0 = n.x * z + ox, wy0 = n.y * z + oy, wx1 = b.x * z + ox, wy1 = b.y * z + oy;
        var wdx = wx1 - wx0, wdy = wy1 - wy0;
        ctx.moveTo(wx0, wy0);
        ctx.quadraticCurveTo((wx0 + wx1) * 0.5 - wdy * 0.22, (wy0 + wy1) * 0.5 + wdx * 0.22, wx1, wy1);
        anyWave = true;
      }
      if (lastPairs >= 0 && nPairs > lastPairs) waveGlow = 1;
      lastPairs = nPairs;
      if (anyWave) {
        if (!reduceMotion || waveGlow > 0.002) frameAnim = true;
        ctx.strokeStyle = C.green; ctx.lineWidth = 2 + waveGlow * 1.6;
        ctx.globalAlpha = 0.85 + 0.15 * waveGlow; ctx.lineCap = 'butt';
        ctx.setLineDash(DASH_WAVE); ctx.lineDashOffset = reduceMotion ? 0 : -(now * 0.01) % 10;
        ctx.stroke();
        ctx.setLineDash(DASH_NONE); ctx.lineDashOffset = 0; ctx.lineCap = 'round'; ctx.globalAlpha = 1;
      }

      // semaforo: eixo liberado (verde grosso) e bloqueados (vermelho fino), ultimo trecho antes do no
      if (z >= 0.6) {
        var tickG = 0, tickR = 0, kt, ids2, ti, te, tg, tn, tpx, tpy, tdx, tdy, tl, t0s, t1s, lim;
        ctx.beginPath(); // verdes
        for (kt in nodes) {
          tn = nodes[kt]; if (!tn || tn.tool !== 'light') continue;
          tpx = tn.x * z + ox; tpy = tn.y * z + oy;
          if (tpx < sx0 || tpx > sx1 || tpy < sy0 || tpy > sy1) continue;
          if (!axisFill(nodes, edges, tn)) continue;
          ids2 = tn.edges;
          for (ti = 0; ti < ids2.length; ti++) {
            te = edges[ids2[ti]];
            if (!te || !arrives(te, tn.id)) continue;
            tg = axisGroup(axisKeyOf(nodes, te, tn));
            if (tn.lightPhase !== tg) continue;
            b = nodes[te.a === tn.id ? te.b : te.a];
            tdx = b.x - tn.x; tdy = b.y - tn.y; tl = Math.sqrt(tdx * tdx + tdy * tdy);
            if (tl < 0.01) continue;
            lim = tl * z * 0.5; t0s = ps * 0.55 + 2; t1s = Math.min(t0s + 18, Math.max(t0s, lim));
            tdx /= tl; tdy /= tl;
            ctx.moveTo(tpx + tdx * t0s, tpy + tdy * t0s); ctx.lineTo(tpx + tdx * t1s, tpy + tdy * t1s);
            tickG++;
          }
        }
        if (tickG) { ctx.strokeStyle = C.green; ctx.lineWidth = 3; ctx.lineCap = 'butt'; ctx.stroke(); }
        ctx.beginPath(); // vermelhos
        for (kt in nodes) {
          tn = nodes[kt]; if (!tn || tn.tool !== 'light') continue;
          tpx = tn.x * z + ox; tpy = tn.y * z + oy;
          if (tpx < sx0 || tpx > sx1 || tpy < sy0 || tpy > sy1) continue;
          if (!axisFill(nodes, edges, tn)) continue;
          ids2 = tn.edges;
          for (ti = 0; ti < ids2.length; ti++) {
            te = edges[ids2[ti]];
            if (!te || !arrives(te, tn.id)) continue;
            tg = axisGroup(axisKeyOf(nodes, te, tn));
            if (tn.lightPhase === tg) continue;
            b = nodes[te.a === tn.id ? te.b : te.a];
            tdx = b.x - tn.x; tdy = b.y - tn.y; tl = Math.sqrt(tdx * tdx + tdy * tdy);
            if (tl < 0.01) continue;
            lim = tl * z * 0.5; t0s = ps * 0.55 + 2; t1s = Math.min(t0s + 18, Math.max(t0s, lim));
            tdx /= tl; tdy /= tl;
            ctx.moveTo(tpx + tdx * t0s, tpy + tdy * t0s); ctx.lineTo(tpx + tdx * t1s, tpy + tdy * t1s);
            tickR++;
          }
        }
        if (tickR) { ctx.strokeStyle = C.red; ctx.lineWidth = 1.2; ctx.lineCap = 'butt'; ctx.stroke(); }
        ctx.lineCap = 'round';
      }

      // nos: pontos cheios (um path) e portais vazados (outro). Portal que virou cruzamento (3+ ruas)
      // e desenhado como cruzamento (ponto cheio) com o anel fino de entrada em volta (ainda gera carros)
      ctx.beginPath(); any = false; deadN = 0;
      for (k in nodes) {
        n = nodes[k]; if (!n || n.tool || (n.portal && !portalJunction(n))) continue;
        var nx = n.x * z + ox, ny = n.y * z + oy;
        if (nx < sx0 || nx > sx1 || ny < sy0 || ny > sy1) continue;
        var ns = nodeScale(k, now); if (ns <= 0) continue;
        // beco: desenhado abaixo como fim de rua (lista reaproveitada, sem alocar por quadro)
        if (n.edges && n.edges.length === 1) { if (deadN < deadList.length) { deadList[deadN] = n; deadScale[deadN++] = ns; } continue; }
        circle(nx, ny, dotR * ns); any = true;
      }
      if (any) { ctx.fillStyle = C.ink; ctx.fill(); }
      // becos (no comum com uma estrada so): traco curto perpendicular, cara de "fim de rua", nao de cruzamento
      ctx.beginPath(); any = false;
      for (i = 0; i < deadN; i++) {
        n = deadList[i]; deadList[i] = null;
        var de = edges[n.edges[0]], dn = de && nodes[de.a === n.id ? de.b : de.a];
        if (!dn) continue;
        var dx0 = n.x * z + ox, dy0 = n.y * z + oy, dsc = deadScale[i];
        var ddx = n.x - dn.x, ddy = n.y - dn.y, ddl = Math.sqrt(ddx * ddx + ddy * ddy);
        if (ddl < 0.01) continue;
        var dh = (dotR * 2.6 + 2) * dsc, dpx = -ddy / ddl * dh, dpy = ddx / ddl * dh;
        ctx.moveTo(dx0 + dpx, dy0 + dpy); ctx.lineTo(dx0 - dpx, dy0 - dpy); any = true;
      }
      if (any) { ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1.6, roadW * 1.4); ctx.lineCap = 'butt'; ctx.stroke(); ctx.lineCap = 'round'; }
      ctx.beginPath(); any = false;
      var pjAny = false;
      for (k in nodes) {
        n = nodes[k]; if (!n || !n.portal) continue;
        if (!n.tool && portalJunction(n)) { pjAny = true; continue; }
        var qx = n.x * z + ox, qy = n.y * z + oy;
        if (qx < sx0 || qx > sx1 || qy < sy0 || qy > sy1) continue;
        var qs = nodeScale(k, now); if (qs <= 0) continue;
        circle(qx, qy, dotR * 1.9 * qs); any = true;
      }
      if (any) { ctx.fillStyle = C.bg; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1.2, roadW * 0.9); ctx.stroke(); }
      if (pjAny) {
        // marcador de entrada do portal-cruzamento: aro DUPLO fino em volta do ponto cheio, sem preencher.
        // Ponto comum de juncao nao tem aro; ponta-portal e o circulo vazado: os tres se separam de longe
        ctx.beginPath(); any = false;
        var pjGap = Math.max(2.2, dotR * 0.9);
        for (k in nodes) {
          n = nodes[k]; if (!n || !n.portal || n.tool || !portalJunction(n)) continue;
          var pqx = n.x * z + ox, pqy = n.y * z + oy;
          if (pqx < sx0 || pqx > sx1 || pqy < sy0 || pqy > sy1) continue;
          var pqs = nodeScale(k, now); if (pqs <= 0) continue;
          circle(pqx, pqy, (dotR * 1.9 + 1) * pqs);
          circle(pqx, pqy, (dotR * 1.9 + 1 + pjGap) * pqs); any = true;
        }
        if (any) { ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke(); }
      }

      // carros: um unico path
      var cars = w.cars;
      if (cars && cars.length) {
        ctx.beginPath(); any = false;
        var hc = carPx * 0.5, hl = carHL;
        for (i = 0; i < cars.length; i++) {
          var car = cars[i]; if (!car) continue;
          e = edges[car.edgeId];
          var cx = car.x, cy = car.y, ang = car.ang;
          if (typeof cx !== 'number' || typeof cy !== 'number' || typeof ang !== 'number') {
            if (!e) continue;
            a = nodes[e.a]; b = nodes[e.b]; if (!a || !b) continue;
            var el = e.len || Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)) || 1;
            var ft = clamp((car.s || 0) / el, 0, 1); if (car.dir === -1) ft = 1 - ft;
            if (typeof cx !== 'number') cx = a.x + (b.x - a.x) * ft;
            if (typeof cy !== 'number') cy = a.y + (b.y - a.y) * ft;
            if (typeof ang !== 'number') ang = Math.atan2((b.y - a.y) * (car.dir || 1), (b.x - a.x) * (car.dir || 1));
          }
          var scx = cx * z + ox, scy = cy * z + oy;
          if (scx < sx0 || scx > sx1 || scy < sy0 || scy > sy1) continue;
          var fx = Math.cos(ang), fy = Math.sin(ang), rx = -fy, ry = fx;
          var lanes = e ? (e.lanes || 1) : 1, lane = car.lane ? 1 : 0, ow = e ? e.oneway : 0, off;
          if (lane >= lanes) lane = lanes - 1;
          if (ow) off = lanes >= 2 ? laneSp * (lane ? 0.5 : -0.5) : 0;
          else off = lanes >= 2 ? off1 + laneSp * lane : off1;
          scx += rx * off; scy += ry * off;
          fx *= hl; fy *= hl; rx *= hc; ry *= hc;
          ctx.moveTo(scx + fx + rx, scy + fy + ry);
          ctx.lineTo(scx + fx - rx, scy + fy - ry);
          ctx.lineTo(scx - fx - rx, scy - fy - ry);
          ctx.lineTo(scx - fx + rx, scy - fy + ry);
          ctx.closePath(); any = true;
        }
        if (any) { ctx.fillStyle = CAR_COLOR; ctx.fill(); }
      }

      // dicas de ferramenta (fase plan)
      var ht = ov.hoverTool;
      if (ht === 'road' && (phase === 'plan' || phase === null || phase === undefined)) {
        // Rua na mao: so pontas de rua e cruzamentos com folga de angulo (nada em curva interna).
        // Alvos em cinza claro; a origem (arrasto em curso ou no selecionado) em tinta.
        var rsg = nearSigOf(w);
        if (w !== hintW || rsg !== roadSig) { hintW = w; roadSig = rsg; computeRoadHints(w); }   // hintW: antes 'roadW', sombreado pela largura local
        var rorig = gr0Origin(ov, nodes), rrad = ps * 0.5 + 4;
        ctx.beginPath(); any = false;
        for (i = 0; i < roadHintN; i++) {
          n = roadHint[i]; if (!n || n === rorig) continue;
          var rhx = n.x * z + ox, rhy = n.y * z + oy;
          if (rhx < sx0 || rhx > sx1 || rhy < sy0 || rhy > sy1) continue;
          circle(rhx, rhy, rrad); any = true;
        }
        if (any) { ctx.globalAlpha = 0.45; ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; }
        if (rorig) {
          ctx.beginPath(); circle(rorig.x * z + ox, rorig.y * z + oy, rrad);
          ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.stroke();
        }
      } else if (ht && (phase === 'plan' || phase === null || phase === undefined)) {
        ctx.beginPath(); any = false;
        for (k in nodes) {
          n = nodes[k]; if (!n) continue;
          var deg = n.edges ? n.edges.length : 0;
          // portal so e alvo quando virou cruzamento (3+ ruas: aceita sinal no game); ponta de 1-2 ruas nao
          if (n.portal && deg < 3) continue;
          var ok = JUNCTION_TOOLS[ht] ? (n.tool !== ht && deg >= (ht === 'cross' ? 2 : 3)) : false;
          if (!ok) continue;
          var hx = n.x * z + ox, hy = n.y * z + oy;
          if (hx < sx0 || hx > sx1 || hy < sy0 || hy > sy1) continue;
          circle(hx, hy, ps * 0.5 + 4); any = true;
        }
        if (any) { ctx.globalAlpha = 0.7; ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; }
      }

      // marca NEW: cruzamento novo sem sinal (a UI escreve ov.newJ = [ids] so no plano). Anel PONTILHADO
      // azul-acinzentado (o vermelho e tracejado ou continuo), ponto pequeno embaixo a direita que pulsa,
      // "NEW" em cima. Some com ferramenta no no (mesmo que a UI ainda nao tenha limpado a lista)
      var nj = ov.newJ;
      if (nj && nj.length && (phase === 'plan' || phase === null || phase === undefined)) {
        var njR = ps * 0.5 + 6, njP = reduceMotion ? 0 : Math.sin(now * 0.006), njAny = false;
        njBox.length = 0;
        ctx.beginPath();
        for (i = 0; i < nj.length; i++) {
          n = nodes[nj[i]]; if (!n || n.tool || !n.edges || n.edges.length < 3) continue;
          var njx = n.x * z + ox, njy = n.y * z + oy;
          if (njx < sx0 || njx > sx1 || njy < sy0 || njy > sy1) continue;
          ctx.moveTo(njx + njR, njy); ctx.arc(njx, njy, njR, 0, TAU);
          njBox.push(n.id); njAny = true;
        }
        if (njAny) {
          ctx.setLineDash(DASH_NEWJ); ctx.lineCap = 'round'; ctx.strokeStyle = NEWJ_COLOR; ctx.lineWidth = 2;
          ctx.globalAlpha = 0.9; ctx.stroke(); ctx.setLineDash(DASH_NONE); ctx.globalAlpha = 1;
          ctx.beginPath();
          for (i = 0; i < njBox.length; i++) {
            n = nodes[njBox[i]];
            var njdx = n.x * z + ox + NEWJ_DX * njR, njdy = n.y * z + oy + NEWJ_DX * njR;
            circle(njdx, njdy, 2.6 + 0.9 * njP);
          }
          ctx.fillStyle = NEWJ_COLOR; ctx.globalAlpha = reduceMotion ? 1 : 0.75 + 0.25 * njP; ctx.fill(); ctx.globalAlpha = 1;
          ctx.font = NEWJ_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = NEWJ_COLOR;
          for (i = 0; i < njBox.length; i++) {
            n = nodes[njBox[i]];
            ctx.fillText(NEWJ_TEXT, n.x * z + ox, n.y * z + oy - njR - 2);
          }
          if (!reduceMotion) frameAnim = true;
        }
      } else njBox.length = 0;

      // aneis de estresse
      // reduceMotion: sem pisca e sem pulso (anel fixo); nada aqui le o relogio
      var blink = reduceMotion ? 1 : 0.6 + 0.4 * Math.sin(now * 0.012);
      var boostN = 0, sDash = false;
      // nos fora da area util, contados na mesma volta (variaveis locais: nada alocado por no)
      var ou = usable(), ox0 = ou.l - 2, ox1 = W - ou.r + 2, oy0 = ou.t - 2, oy1 = H - ou.b + 2;
      var oL = 0, oR = 0, oT = 0, oB = 0, osl = 0, osr = 0, ost = 0, osb = 0;
      for (k in nodes) {
        n = nodes[k]; if (!n) continue;
        var osx = n.x * z + ox, osy = n.y * z + oy;
        if (osx < ox0) { oL++; osl += osy; } else if (osx > ox1) { oR++; osr += osy; }
        if (osy < oy0) { oT++; ost += osx; } else if (osy > oy1) { oB++; osb += osx; }
        if (n.boost > 0 && boostN < boostList.length) boostList[boostN++] = n;
        var sv = n.stress || 0;
        if (!n.locked && !(sv >= RING_MIN)) continue;
        var rx2 = n.x * z + ox, ry2 = n.y * z + oy;
        if (rx2 < sx0 || rx2 > sx1 || ry2 < sy0 || ry2 > sy1) continue;
        var base = (n.tool ? ps * 0.5 : dotR) + 5;
        ctx.beginPath();
        var wantDash = false;
        if (n.locked && n.tool) {
          // ja tem sinal: arco em volta do icone, aberto no canto onde fica o X (o icone fica livre)
          var lr = base + 7;
          ctx.moveTo(rx2 + Math.cos(LOCK_A0) * lr, ry2 + Math.sin(LOCK_A0) * lr);
          ctx.arc(rx2, ry2, lr, LOCK_A0, LOCK_A1);
          ctx.lineWidth = 3; ctx.globalAlpha = 1;
        } else if (n.locked) {
          circle(rx2, ry2, base + 7);
          ctx.lineWidth = 4; ctx.globalAlpha = 1;
        } else {
          sv = sv > 1 ? 1 : sv;
          // a partir de 0.3 o anel ja se ve (antes, perto de 0.35, era 1 px a 55%: sumia no cinza):
          // opaco, e um pulso suave do raio e da opacidade. A forma muda com o nivel (daltonismo):
          // 0.3-0.6 tracejado de 2.2 px; acima de 0.6 continuo e grosso (3.2-3.8 px); travado 4 px com X
          var u = (sv - RING_MIN) / (1 - RING_MIN);
          var soft = reduceMotion ? 0 : Math.sin(now * 0.005);
          var hard = reduceMotion ? 0 : Math.sin(now * 0.006);
          if (!reduceMotion) frameAnim = true;
          circle(rx2, ry2, (base + 1 + u * 8) * (sv > 0.8 ? 1 + 0.06 * hard : 1 + 0.05 * soft));
          wantDash = sv <= 0.6;
          // cor + forma: tracejado ambar (alerta), continuo vermelho (perigo); o travado segue vermelho
          ctx.lineWidth = wantDash ? 2.2 : 3.2 + (sv - 0.6) * 1.5;
          ctx.globalAlpha = sv > 0.8 ? blink : 0.82 + 0.1 * u + 0.08 * soft;
        }
        ctx.strokeStyle = wantDash ? STRESS_MID : C.red;
        if (wantDash !== sDash) {
          sDash = wantDash;
          ctx.setLineDash(wantDash ? DASH_STRESS : DASH_NONE); ctx.lineCap = wantDash ? 'butt' : 'round';
        }
        ctx.stroke();
      }
      if (sDash) { ctx.setLineDash(DASH_NONE); ctx.lineCap = 'round'; }
      ctx.globalAlpha = 1;

      // anel verde do Clear: tracejado que gira devagar, afina e pisca no ultimo segundo
      var bany = false;
      for (var bi = 0; bi < boostN; bi++) {
        n = boostList[bi]; boostList[bi] = null;
        var bs = n.boost;
        frameAnim = true;
        if (!(bs > 0) || !isFinite(bs)) continue;
        var bx = n.x * z + ox, by2 = n.y * z + oy;
        if (bx < sx0 || bx > sx1 || by2 < sy0 || by2 > sy1) continue;
        var bb = (n.tool ? ps * 0.5 : dotR) + 5;
        var bf = bs > 5 ? 1 : bs / 5;
        if (bs < 1 && !reduceMotion && Math.sin(now * 0.03) < 0) continue;
        if (!bany) { ctx.strokeStyle = C.green; ctx.lineCap = 'butt'; ctx.setLineDash(DASH_BOOST); bany = true; }
        ctx.lineDashOffset = reduceMotion ? 0 : -(now * 0.012) % 12;
        ctx.lineWidth = 1 + 2 * bf;
        ctx.beginPath(); circle(bx, by2, bb + 12 + (n.locked ? 3 : 0));
        ctx.stroke();
      }
      if (bany) { ctx.setLineDash(DASH_NONE); ctx.lineDashOffset = 0; ctx.lineCap = 'round'; }

      // mapa de problemas de ontem: anel fino tracejado (plan/summary), sem animacao. Nos a menos de
      // HOT_CLUSTER px um do outro dividem um anel envolvente com contador (sem aneis sobrepostos)
      var hm = st && st.hot;
      if (hm && (phase === 'plan' || phase === 'summary')) {
        var hkey = hotKeyOf(hm, nodes);
        if (w !== hotW || hm !== hotHm || z !== hotZ || ps !== hotPs || hkey !== hotKey) {
          hotW = w; hotHm = hm; hotZ = z; hotPs = ps; hotKey = hkey;
          computeHot(hm, nodes, z, ps, dotR);
        }
        var hany = false, hdot = false;
        ctx.beginPath();
        for (i = 0; i < hotN; i++) {
          n = hotNode[i];
          if (hm[n.id] >= 0.8) hdot = true;
          if (!hotSolo[i]) continue;
          var hx2 = n.x * z + ox, hy2 = n.y * z + oy;
          if (hx2 < sx0 || hx2 > sx1 || hy2 < sy0 || hy2 > sy1) continue;
          circle(hx2, hy2, hotHr[i]); hany = true;
        }
        for (i = 0; i < clCount; i++) {
          var cqx = clX[i] * z + ox, cqy = clY[i] * z + oy;
          if (cqx < sx0 - clR[i] || cqx > sx1 + clR[i] || cqy < sy0 - clR[i] || cqy > sy1 + clR[i]) continue;
          circle(cqx, cqy, clR[i]); hany = true;
        }
        if (hany) {
          ctx.strokeStyle = HOT_COLOR; ctx.lineWidth = HOT_W; ctx.globalAlpha = HOT_ALPHA;
          ctx.setLineDash(DASH_GHOST); ctx.lineCap = 'butt'; ctx.stroke(); ctx.setLineDash(DASH_NONE); ctx.lineCap = 'round';
        }
        if (hdot) {
          ctx.globalAlpha = HOT_ALPHA; ctx.fillStyle = HOT_COLOR; ctx.beginPath();
          for (i = 0; i < hotN; i++) {
            n = hotNode[i]; if (!(hm[n.id] >= 0.8)) continue;
            var dx2 = n.x * z + ox, dy2 = n.y * z + oy;
            if (dx2 < sx0 || dx2 > sx1 || dy2 < sy0 || dy2 > sy1) continue;
            circle(dx2, dy2, 2.2);
          }
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // contador do anel agrupado: pastilha pequena no alto a esquerda do anel (o X do travado fica a direita)
        if (clCount && ctx.fillText) {
          for (i = 0; i < clCount; i++) {
            var cbx = clX[i] * z + ox + Math.cos(COUNT_A) * clR[i], cby = clY[i] * z + oy + Math.sin(COUNT_A) * clR[i];
            if (cbx < sx0 || cbx > sx1 || cby < sy0 || cby > sy1) continue;
            ctx.beginPath(); circle(cbx, cby, 7);
            ctx.fillStyle = C.bg; ctx.fill(); ctx.strokeStyle = HOT_COLOR; ctx.lineWidth = 1; ctx.stroke();
            ctx.font = COUNT_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = HOT_COLOR;
            ctx.fillText(clN[i] < COUNT_TXT.length ? COUNT_TXT[clN[i]] : COUNT_MANY, cbx, cby + 0.5);
          }
        }
      }

      // pontas "quase ligadas": anel tracejado cinza discreto, so no planejamento
      if (phase === 'plan' || phase === null || phase === undefined) {
        var nsg = nearSigOf(w);
        if (w !== nearW || nsg !== nearSig) { nearW = w; nearSig = nsg; computeNear(w); }
        if (nearN > 0) {
          ctx.beginPath();
          for (i = 0; i < nearN; i++) {
            var nx2 = nearXY[i * 2] * z + ox, ny2 = nearXY[i * 2 + 1] * z + oy;
            if (nx2 < sx0 || nx2 > sx1 || ny2 < sy0 || ny2 > sy1) continue;
            circle(nx2, ny2, dotR + 5);
          }
          ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 1; ctx.globalAlpha = 0.7;
          ctx.setLineDash(DASH_GHOST); ctx.stroke(); ctx.setLineDash(DASH_NONE); ctx.globalAlpha = 1;
        }
      }

      // X do travado: no centro do no sem sinal; com sinal, pequeno na abertura do arco (fora do icone)
      ctx.beginPath(); any = false;
      for (k in nodes) {
        n = nodes[k]; if (!n || !n.locked) continue;
        var lxx = n.x * z + ox, lyy = n.y * z + oy;
        if (lxx < sx0 || lxx > sx1 || lyy < sy0 || lyy > sy1) continue;
        var xh = dotR * 1.6;
        if (n.tool) { var lrr = ps * 0.5 + 12; lxx += LOCK_BX * lrr; lyy += LOCK_BY * lrr; xh = 3.4; }
        ctx.moveTo(lxx - xh, lyy - xh); ctx.lineTo(lxx + xh, lyy + xh);
        ctx.moveTo(lxx + xh, lyy - xh); ctx.lineTo(lxx - xh, lyy + xh);
        any = true;
      }
      if (any) {
        ctx.lineCap = 'butt';
        ctx.strokeStyle = C.bg; ctx.lineWidth = 3.6; ctx.stroke();
        ctx.strokeStyle = C.red; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.lineCap = 'round';
      }

      // pictogramas: por cima de todo anel e marca de aviso (o sinal novo no no travado fica a vista)
      for (k in nodes) {
        n = nodes[k]; if (!n || !n.tool) continue;
        var tx2 = n.x * z + ox, ty2 = n.y * z + oy;
        if (tx2 < sx0 || tx2 > sx1 || ty2 < sy0 || ty2 > sy1) continue;
        var pk = toolPop[k], sc = 1;
        if (pk !== undefined) {
          var pt = (now - pk) / POP_MS;
          if (pt < 1) { sc = easeBack(clamp(pt, 0, 1)); frameAnim = true; } else delete toolPop[k];
        }
        if (sc <= 0.02) continue;
        drawPicto(n.tool, tx2, ty2, ps * sc, n.lightPhase);
      }

      // selecao
      var sel = ov.selectedNode;
      if (sel !== null && sel !== undefined && nodes[sel]) {
        n = nodes[sel];
        ctx.beginPath(); circle(n.x * z + ox, n.y * z + oy, (n.tool ? ps * 0.5 : dotR * 2) + 8);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4; ctx.stroke();
      }

      // estrada fantasma
      var gr = ov.ghostRoad;
      if (gr && nodes[gr.fromId] && isFinite(gr.x) && isFinite(gr.y)) {
        a = nodes[gr.fromId];
        var gx0 = a.x * z + ox, gy0 = a.y * z + oy, gx1 = gr.x * z + ox, gy1 = gr.y * z + oy;
        var gc = gr.ok === false ? C.red : C.ink;
        // angulo travado: rua de ponta solta encaixa em 45 graus. Com o dedo fora do eixo (ex.: a 60),
        // um fio pontilhado claro vai da origem ate o dedo e um arco liga o fio a rua: mostra, desde o
        // primeiro quadro do arrasto, que a rua segue o eixo de 45 e nao o dedo.
        var gfg = ov.finger;
        lockGeo.on = false;
        if (gr.ok !== false && gfg && isFinite(gfg.x) && isFinite(gfg.y) && (gr.nodeId === null || gr.nodeId === undefined) &&
            (gr.edgeId === null || gr.edgeId === undefined)) {
          var fa = Math.atan2(gfg.y - gy0, gfg.x - gx0), ga = Math.atan2(gy1 - gy0, gx1 - gx0), da = fa - ga;
          while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
          var fl = Math.sqrt((gfg.x - gx0) * (gfg.x - gx0) + (gfg.y - gy0) * (gfg.y - gy0));
          if (Math.abs(da) > 4 * Math.PI / 180 && Math.abs(da) < Math.PI / 4 + 0.01 && fl > 14) {
            var gL = Math.sqrt((gx1 - gx0) * (gx1 - gx0) + (gy1 - gy0) * (gy1 - gy0)), fr = Math.min(fl, gL);
            var arR = clamp(gL * 0.35, 14, 30);
            ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(gx0 + Math.cos(fa) * fr, gy0 + Math.sin(fa) * fr);
            ctx.moveTo(gx0 + Math.cos(fa) * arR, gy0 + Math.sin(fa) * arR);
            ctx.arc(gx0, gy0, arR, fa, ga, da > 0);
            ctx.setLineDash(DASH_GHOST); ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 1; ctx.lineCap = 'butt'; ctx.stroke();
            ctx.setLineDash(DASH_NONE); ctx.lineCap = 'round';
            lockGeo.on = true; lockGeo.deg = Math.round(Math.abs(da) * 180 / Math.PI);
          }
        }
        ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(gx1, gy1);
        // invalido: picotado curto (DASH_BAD) e um X na ponta, alem do vermelho
        ctx.setLineDash(gr.ok === false ? DASH_BAD : DASH_GHOST); ctx.strokeStyle = gc; ctx.lineWidth = roadW; ctx.lineCap = 'butt'; ctx.stroke();
        ctx.setLineDash(DASH_NONE); ctx.lineCap = 'round';
        ctx.beginPath(); circle(gx1, gy1, dotR * 1.9);
        ctx.fillStyle = C.bg; ctx.fill();
        if (gr.ok === false) {
          var gxh = dotR * 1.9 + 1.5;
          ctx.beginPath();
          ctx.moveTo(gx1 - gxh, gy1 - gxh); ctx.lineTo(gx1 + gxh, gy1 + gxh);
          ctx.moveTo(gx1 + gxh, gy1 - gxh); ctx.lineTo(gx1 - gxh, gy1 + gxh);
          ctx.strokeStyle = gc; ctx.lineWidth = 1.8; ctx.stroke();
        } else { ctx.strokeStyle = gc; ctx.lineWidth = 1.4; ctx.stroke(); }
        // encaixe: a rua vai ligar num no (ou em T numa estrada) existente: anel verde no alvo
        if (gr.ok !== false) {
          var sn = gr.nodeId !== null && gr.nodeId !== undefined ? nodes[gr.nodeId] : null;
          var snapR = sn ? (sn.tool ? ps * 0.5 : dotR * 2) + 7 : (gr.edgeId !== null && gr.edgeId !== undefined ? dotR * 2 + 6 : 0);
          if (snapR > 0) {
            // anel duplo (forma alem do verde): externo 2.2 px, interno fino 3.5 px para dentro
            var snx = sn ? sn.x * z + ox : gx1, sny = sn ? sn.y * z + oy : gy1;
            ctx.beginPath(); circle(snx, sny, snapR);
            ctx.strokeStyle = C.green; ctx.lineWidth = 2.2; ctx.stroke();
            ctx.beginPath(); circle(snx, sny, snapR - 3.5);
            ctx.lineWidth = 1.1; ctx.stroke();
          }
        }
        // cruzamentos que a rua vai abrir: losango em cada ponto (a obra cria um cruzamento ali)
        var gcr = gr.cross;
        if (gr.ok !== false && gcr && gcr.length) {
          ctx.beginPath();
          for (i = 0; i < gcr.length; i++) {
            var qx = gcr[i].x * z + ox, qy = gcr[i].y * z + oy, qs = dotR * 2 + 4;
            ctx.moveTo(qx, qy - qs); ctx.lineTo(qx + qs, qy); ctx.lineTo(qx, qy + qs); ctx.lineTo(qx - qs, qy); ctx.closePath();
          }
          ctx.fillStyle = C.bg; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.stroke();
        }
        // marca perpendicular a linha num ponto (corte no maximo / ate onde uma rua alcanca)
        var gdx = gx1 - gx0, gdy = gy1 - gy0, gl = Math.sqrt(gdx * gdx + gdy * gdy);
        if (gl > 1) { gdx /= gl; gdy /= gl; }
        var rch = gr.reach, bar = dotR * 2 + 9;
        if (gr.ok !== false && gr.capped) {
          ctx.beginPath(); ctx.moveTo(gx1 - gdy * bar, gy1 + gdx * bar); ctx.lineTo(gx1 + gdy * bar, gy1 - gdx * bar);
          ctx.strokeStyle = C.ink; ctx.lineWidth = 2.6; ctx.lineCap = 'butt'; ctx.stroke(); ctx.lineCap = 'round';
        } else if (gr.ok === false && rch && isFinite(rch.x) && isFinite(rch.y)) {
          var rx = rch.x * z + ox, ry = rch.y * z + oy;
          ctx.beginPath(); ctx.moveTo(rx - gdy * bar, ry + gdx * bar); ctx.lineTo(rx + gdy * bar, ry - gdx * bar);
          ctx.strokeStyle = C.red; ctx.lineWidth = 2.6; ctx.lineCap = 'butt'; ctx.stroke(); ctx.lineCap = 'round';
        }
        // por que nao da: texto curto ao lado da ponta (so quando vermelho); dica neutra quando ok
        // (o rotulo em si e posto depois das setas e da lupa, em placeLabels)
        var lq = labReq[0];
        lq.on = false;
        gGeo.on = true; gGeo.x0 = gx0; gGeo.y0 = gy0; gGeo.x1 = gx1; gGeo.y1 = gy1;
        gGeo.sr = 0; gGeo.rb = 0; gGeo.ncross = 0;
        if (gr.ok !== false) {
          if (snapR > 0) { gGeo.sx = sn ? sn.x * z + ox : gx1; gGeo.sy = sn ? sn.y * z + oy : gy1; gGeo.sr = snapR; }
          if (gcr && gcr.length) {
            var gn = gcr.length > 32 ? 32 : gcr.length;
            for (i = 0; i < gn; i++) { gCross[i * 2] = gcr[i].x * z + ox; gCross[i * 2 + 1] = gcr[i].y * z + oy; }
            gGeo.ncross = gn;
          }
        } else if (rch && isFinite(rch.x) && isFinite(rch.y)) {
          gGeo.rx = rch.x * z + ox; gGeo.ry = rch.y * z + oy; gGeo.rb = bar;
        }
        if (gr.ok === false && gr.reason) {
          lq.on = true; lq.text = String(gr.reason); lq.px = gx1; lq.py = gy1; lq.alpha = 1; lq.color = C.red; lq.line = true;
        } else if (gr.ok !== false && gr.tip) {
          var tpx = gx1, tpy = gy1;
          if (!gr.capped && gcr && gcr.length) { tpx = gcr[0].x * z + ox; tpy = gcr[0].y * z + oy; }
          lq.on = true; lq.text = String(gr.tip); lq.px = tpx; lq.py = tpy; lq.alpha = 1; lq.color = C.ink; lq.line = true;
        }
      } else { gGeo.on = false; labReq[0].on = false; lockGeo.on = false; }
      labReq[1].on = false;
      if (note.on) {
        frameAnim = true;
        if (note.t0 < 0 || now < note.t0) note.t0 = now;
        var nt = (now - note.t0) / NOTE_MS;
        if (nt >= 1 || (gr && gr.ok === false && gr.reason)) note.on = false;
        else {
          var nq = labReq[1];
          nq.on = true; nq.text = note.text; nq.px = note.x * z + ox; nq.py = note.y * z + oy;
          nq.alpha = nt < 0.7 ? 1 : 1 - (nt - 0.7) / 0.3; nq.color = C.red; nq.line = false;
        }
      }

      // pulsos de atencao
      var pl = ov.pulse;
      if (pl && pl.length) {
        if (!reduceMotion) frameAnim = true;
        ctx.strokeStyle = C.red; ctx.lineWidth = 1.5;
        for (i = 0; i < pl.length; i++) {
          var pu = pl[i]; if (!pu || !isFinite(pu.x) || !isFinite(pu.y)) continue;
          var el2 = now - (pu.t0 || 0); if (el2 < 0) continue;
          if (reduceMotion) {
            // anel fixo: aparece num fade de 300 ms e fica parado
            if (el2 < 300) { frameAnim = true; ctx.globalAlpha = 0.9 * el2 / 300; } else ctx.globalAlpha = 0.9;
            ctx.beginPath(); circle(pu.x * z + ox, pu.y * z + oy, 20); ctx.stroke();
            continue;
          }
          var ph = (el2 % PULSE_MS) / PULSE_MS;
          ctx.globalAlpha = 1 - ph;
          ctx.beginPath(); circle(pu.x * z + ox, pu.y * z + oy, 8 + 26 * easeOut(ph)); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // flashes
      for (i = 0; i < flashes.length; i++) {
        var f = flashes[i]; if (!f.on) continue;
        frameAnim = true;
        if (f.t0 < 0 || now < f.t0) f.t0 = now;   // relogio voltou: recomeca (raio nunca negativo)
        var ft2 = (now - f.t0) / FLASH_MS;
        if (!(ft2 < 1)) { f.on = false; continue; }
        ctx.globalAlpha = 1 - ft2;
        var fbad = f.kind === 'bad', fok = f.kind === 'ok', fx = f.x * z + ox, fy = f.y * z + oy;
        ctx.strokeStyle = fok ? C.green : (fbad ? C.red : C.ink);
        ctx.lineWidth = fbad ? 2 : 1.4;
        // reduceMotion: raio fixo, so o fade. 'bad' tracejado com X; 'ok' com um visto no centro
        if (fbad) { ctx.setLineDash(DASH_GHOST); ctx.lineCap = 'butt'; }
        ctx.beginPath(); circle(fx, fy, reduceMotion ? 16 : 6 + 22 * easeOut(ft2)); ctx.stroke();
        if (fbad) { ctx.setLineDash(DASH_NONE); ctx.lineCap = 'round'; }
        if (fbad || fok) {
          ctx.beginPath();
          if (fbad) { ctx.moveTo(fx - 4.5, fy - 4.5); ctx.lineTo(fx + 4.5, fy + 4.5); ctx.moveTo(fx + 4.5, fy - 4.5); ctx.lineTo(fx - 4.5, fy + 4.5); }
          else { ctx.moveTo(fx - 5, fy); ctx.lineTo(fx - 1.5, fy + 3.5); ctx.lineTo(fx + 5, fy - 3.5); }
          ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // pulsos de entrega: dotR+3 -> dotR+10 em 280 ms (easeOut), alpha 0,5 -> 0. reduceMotion: anel fixo que so some (200 ms)
      if (dvLive > 0) {
        frameAnim = true;
        var dvMs = reduceMotion ? DELIV_RM_MS : DELIV_MS, dvAny = false;
        for (i = 0; i < DELIV_N; i++) {
          if (!dvOn[i]) continue;
          if (dvT0[i] < 0 || now < dvT0[i]) dvT0[i] = now;
          var dvt = (now - dvT0[i]) / dvMs;
          if (!(dvt < 1)) { dvOn[i] = 0; dvLive--; continue; }
          var dvx = dvX[i] * z + ox, dvy = dvY[i] * z + oy;
          if (dvx < sx0 || dvx > sx1 || dvy < sy0 || dvy > sy1) continue;
          if (!dvAny) { ctx.strokeStyle = C.green; ctx.lineWidth = 1.6; ctx.setLineDash(DASH_NONE); dvAny = true; }
          ctx.globalAlpha = 0.5 * (1 - dvt);
          ctx.beginPath(); circle(dvx, dvy, dotR + (reduceMotion ? 6 : 3 + 7 * easeOut(dvt))); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // cidade fora da tela: seta dupla discreta na borda, na altura media do que esta escondido
      offs.left = oL; offs.right = oR; offs.top = oT; offs.bottom = oB;
      offs.lpos = oL ? osl / oL : 0; offs.rpos = oR ? osr / oR : 0; offs.tpos = oT ? ost / oT : 0; offs.bpos = oB ? osb / oB : 0;
      offs.any = !!(oL || oR || oT || oB);
      arrowN = 0;
      if (offs.any && phase !== 'summary' && phase !== 'over') drawOffArrows(nodes, z, ox, oy);

      // lupa: durante o arrasto de rua, o ponto de destino ampliado acima do dedo
      var fg = ov.finger;
      loupe.on = false;
      if (gr && fg && nodes[gr.fromId] && isFinite(gr.x) && isFinite(gr.y) && isFinite(fg.x) && isFinite(fg.y)) {
        var snapOk = gr.ok !== false && ((gr.nodeId !== null && gr.nodeId !== undefined) || (gr.edgeId !== null && gr.edgeId !== undefined));
        drawLoupe(gr.x * z + ox, gr.y * z + oy, fg.x, fg.y, z, gr.ok === false ? C.red : (snapOk ? C.green : C.ink),
          gr.ok === false ? 2 : (snapOk ? 1 : 0));
      }
      placeLabels(edges, nodes, z, ox, oy);
    };

    // seta dupla (chevron) apontando para fora; (dx,dy) = direcao para onde a cidade continua
    function chevron(x, y, dx, dy) {
      var s = 6, px = -dy, py = dx, i, bx, by;
      for (i = 0; i < 2; i++) {
        bx = x - dx * i * 5; by = y - dy * i * 5;
        ctx.moveTo(bx - dx * s + px * s, by - dy * s + py * s);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx - dx * s - px * s, by - dy * s - py * s);
      }
    }
    // borda lateral: o Safari do iOS usa os primeiros ~20 px para o gesto de voltar/avancar.
    // Seta (e qualquer coisa que convide ao toque) fica a ARROW_EDGE px da borda mais a safe-area.
    var ARROW_EDGE = 24;
    r._arrowX = function () { return { l: ARROW_EDGE + safe.l, r: W - ARROW_EDGE - safe.r }; }; // so para testes
    // nudge: a seta nao fica em cima de um no (ou do anel dele): anda 12 px ao longo da borda
    var ARROW_NUDGE = 12, ARROW_CLEAR = 22;
    function arrowHitsNode(nodes, z, ox, oy, x, y) {
      var k, n, dx, dy, lim = ARROW_CLEAR * ARROW_CLEAR;
      for (k in nodes) {
        n = nodes[k]; if (!n) continue;
        dx = n.x * z + ox - x; dy = n.y * z + oy - y;
        if (dx * dx + dy * dy < lim) return true;
      }
      return false;
    }
    // pos0: posicao na borda; horiz: a borda corre em x (cima/baixo); (fixed): coordenada fixa da seta
    function arrowSlide(nodes, z, ox, oy, pos0, lo, hi, horiz, fixed) {
      var s, d, p;
      for (s = 0; s <= 8; s++) {
        d = (s & 1 ? 1 : -1) * Math.ceil(s / 2) * ARROW_NUDGE;      // 0, -12, +12, -24, +24...
        p = clamp(pos0 + d, lo, hi);
        if (!arrowHitsNode(nodes, z, ox, oy, horiz ? p : fixed, horiz ? fixed : p)) return p;
      }
      return clamp(pos0, lo, hi);
    }
    function arrowRect(x, y) {
      arrowR[arrowN * 4] = x - 11; arrowR[arrowN * 4 + 1] = y - 11; arrowR[arrowN * 4 + 2] = x + 11; arrowR[arrowN * 4 + 3] = y + 11;
      arrowN++;
    }
    function drawOffArrows(nodes, z, ox, oy) {
      var u = ua, ylo = u.t + 18, yhi = H - u.b - 18;
      var ax0 = ARROW_EDGE + safe.l, ax1 = W - ARROW_EDGE - safe.r, xlo = ax0, xhi = ax1, p;
      if (yhi < ylo) yhi = ylo;
      if (xhi < xlo) xhi = xlo;
      if (ax1 < ax0) ax1 = ax0;
      ctx.beginPath();
      if (offs.left) { p = arrowSlide(nodes, z, ox, oy, offs.lpos, ylo, yhi, false, ax0); chevron(ax0, p, -1, 0); arrowRect(ax0, p); }
      if (offs.right) { p = arrowSlide(nodes, z, ox, oy, offs.rpos, ylo, yhi, false, ax1); chevron(ax1, p, 1, 0); arrowRect(ax1, p); }
      if (offs.top) { p = arrowSlide(nodes, z, ox, oy, offs.tpos, xlo, xhi, true, u.t + 4); chevron(p, u.t + 4, 0, -1); arrowRect(p, u.t + 4); }
      if (offs.bottom) { p = arrowSlide(nodes, z, ox, oy, offs.bpos, xlo, xhi, true, H - u.b - 4); chevron(p, H - u.b - 4, 0, 1); arrowRect(p, H - u.b - 4); }
      ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.85; ctx.setLineDash(DASH_NONE); ctx.stroke(); ctx.globalAlpha = 1;
    }

    // lupa redonda: copia a regiao em volta de (gx,gy), ampliada, acima do dedo.
    // Sem acima (dedo no topo): vai para o lado oposto a borda mais perto.
    var loupe = { on: false, x: 0, y: 0, r: LOUPE_R, mag: 1 };
    // canvas de rascunho da lupa: o Safari do iOS fica lento (e as vezes borra) com drawImage do
    // canvas sobre ele mesmo. Copia a origem para ca e amplia daqui. Criado uma vez, no tamanho
    // do maior retangulo de origem (ampliacao minima) em px de dispositivo; so cresce se o dpr crescer.
    var scratch = null, sctx = null, scratchTried = false;
    function scratchFor(pw, ph) {
      if (!scratchTried) {
        scratchTried = true;
        try {
          var d = root.document;
          if (d && d.createElement) { scratch = d.createElement('canvas'); sctx = scratch.getContext && scratch.getContext('2d'); }
        } catch (e) { scratch = null; sctx = null; }
        if (!sctx || !sctx.drawImage) { scratch = null; sctx = null; }
      }
      if (!scratch) return null;
      if (scratch.width < pw) scratch.width = pw;     // mudar width zera o bitmap: so quando precisa
      if (scratch.height < ph) scratch.height = ph;
      return sctx;
    }
    r._scratch = function () { return scratch; }; // so para testes
    // shape: 0 neutro (anel simples), 1 encaixe valido (anel duplo), 2 invalido (borda tracejada)
    function drawLoupe(gx, gy, fx, fy, z, tone, shape) {
      loupe.on = false;
      if (!ctx.drawImage || !ctx.clip || !ctx.save || !ctx.restore) return;
      var R = LOUPE_R, mag = clamp(1.1 / z, LOUPE_MAG_MIN, LOUPE_MAG_MAX), u = usable();
      // faixa livre entre o HUD do topo e a faixa de baixo (chip, pontos, botao de enquadrar):
      // o DOM desenharia por cima da lupa nas duas
      var topLim = Math.max(6, u.t - 4), botLim = H - Math.max(6, u.b - 4);
      var lyMin = topLim + R, lyMax = botLim - R;
      if (lyMax < lyMin) { lyMin = lyMax = (topLim + botLim) * 0.5; }
      var lx = fx, ly = fy - LOUPE_UP;
      if (ly - R < topLim) { ly = fy - 24; lx = fx < W * 0.5 ? fx + LOUPE_UP : fx - LOUPE_UP; }
      lx = clamp(lx, R + 4, Math.max(R + 4, W - R - 4));
      // o botao de enquadrar (DOM) fica por cima do canvas: a lupa sobe para nao ficar atras dele
      if (lx + R > W - safe.r - FIT_BTN_W) lyMax = Math.max(lyMin, Math.min(lyMax, fitTop(u) - R));
      ly = clamp(ly, lyMin, lyMax);
      var sw = 2 * R / mag, sx0 = gx - sw * 0.5, sy0 = gy - sw * 0.5;
      var x0 = Math.max(0, sx0), y0 = Math.max(0, sy0), x1 = Math.min(W, sx0 + sw), y1 = Math.min(H, sy0 + sw);
      ctx.save();
      ctx.beginPath(); circle(lx, ly, R); ctx.clip();
      ctx.fillStyle = C.bg; ctx.fillRect(lx - R, ly - R, 2 * R, 2 * R);
      if (x1 - x0 >= 1 && y1 - y0 >= 1) {
        var px0 = Math.floor(x0 * dpr), py0 = Math.floor(y0 * dpr);
        var pw = Math.max(1, Math.min(canvas.width - px0, Math.ceil(x1 * dpr) - px0));
        var ph = Math.max(1, Math.min(canvas.height - py0, Math.ceil(y1 * dpr) - py0));
        var dx = lx - R + (px0 / dpr - sx0) * mag, dy = ly - R + (py0 / dpr - sy0) * mag;
        var dw = pw / dpr * mag, dh = ph / dpr * mag;
        var smax = Math.ceil(2 * R / LOUPE_MAG_MIN * dpr) + 2, s2 = scratchFor(smax, smax);
        try {
          if (s2) {
            if (s2.clearRect) s2.clearRect(0, 0, pw, ph);
            s2.drawImage(canvas, px0, py0, pw, ph, 0, 0, pw, ph);
            ctx.drawImage(scratch, 0, 0, pw, ph, dx, dy, dw, dh);
          } else {
            // sem DOM para o rascunho (teste em node): copia direto
            ctx.drawImage(canvas, px0, py0, pw, ph, dx, dy, dw, dh);
          }
        } catch (e) {}
      }
      ctx.restore();
      ctx.beginPath(); circle(lx, ly, R);
      ctx.strokeStyle = tone; ctx.lineWidth = 2;
      if (shape === 2) { ctx.setLineDash(DASH_GHOST); ctx.lineCap = 'butt'; ctx.stroke(); ctx.setLineDash(DASH_NONE); ctx.lineCap = 'round'; }
      else ctx.stroke();
      if (shape === 1) { ctx.beginPath(); circle(lx, ly, R - 4); ctx.lineWidth = 1; ctx.stroke(); }
      loupe.on = true; loupe.shape = shape || 0; loupe.x = lx; loupe.y = ly; loupe.mag = mag;
    }
    r._loupe = function () { return loupe; }; // so para testes

    // ---- rotulos do fantasma: pilula clara com borda fina, posta onde nao cobre nada ----
    // Candidatos (acima, abaixo, esquerda, direita do ponto; depois mais longe e nas diagonais): o primeiro
    // que nao encosta na lupa, no botao de enquadrar, no HUD (fora de usable()), nas setas de borda, nos
    // limites da tela, na linha do fantasma e nos aneis/losangos do fantasma. Em seguida prefere um que
    // tambem nao atravesse estrada. Se nenhum cabe, usa o texto curto e tenta de novo.
    var LAB_FS = 13, LAB_PADX = 8, LAB_H = 22, LAB_EDGE = 6;
    var LAB_FONT = '600 ' + LAB_FS + 'px -apple-system, system-ui, sans-serif';
    var textW = {}, textWn = 0;           // cache de medidas por texto (fonte unica)
    var shortOf = {};                      // cache: texto longo -> versao curta
    function measure(text) {
      var tw = textW[text];
      if (tw === undefined) {
        tw = ctx.measureText ? (ctx.measureText(text) || {}).width : 0;
        if (!(tw > 0)) tw = text.length * LAB_FS * 0.55;
        if (textWn > 200) { textW = {}; textWn = 0; }   // texto dinamico: nao cresce sem fim
        textW[text] = tw; textWn++;
      }
      return tw;
    }
    // versoes curtas pre-definidas
    function shortText(text) {
      var s2 = shortOf[text];
      if (s2 === undefined) {
        if (/^Crosses/.test(text)) s2 = 'Crossing';
        else if (/^Too far/.test(text)) s2 = 'Too far';
        else if (/^(Longest road|Max length)/.test(text)) s2 = 'Max length';
        else { var ci = text.indexOf(':'); s2 = ci > 0 ? text.slice(0, ci) : text; }
        shortOf[text] = s2;
      }
      return s2;
    }
    var lab = { x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0, text: '', forced: false };
    var labOut = [
      { on: false, x0: 0, y0: 0, x1: 0, y1: 0, text: '', forced: false },
      { on: false, x0: 0, y0: 0, x1: 0, y1: 0, text: '', forced: false }
    ];
    r._labels = function () { return labOut; };   // so para testes: retangulos escolhidos
    // CAND: deslocamento (sinal x, sinal y) e distancia (0 perto, 1 longe) dos 12 candidatos
    var CAND_DX = [0, 0, -1, 1, 0, 0, -1, 1, -1, 1, -1, 1];
    var CAND_DY = [-1, 1, 0, 0, -1, 1, 0, 0, -1, -1, 1, 1];
    var CAND_FAR = [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0];
    function rectHit(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) { return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0; }
    function circHit(x0, y0, x1, y1, cx, cy, cr) {
      var qx = cx < x0 ? x0 : (cx > x1 ? x1 : cx), qy = cy < y0 ? y0 : (cy > y1 ? y1 : cy);
      return (qx - cx) * (qx - cx) + (qy - cy) * (qy - cy) < cr * cr;
    }
    // segmento (Liang-Barsky) contra retangulo
    function segHit(ax, ay, bx, by, x0, y0, x1, y1) {
      var t0 = 0, t1 = 1, dx = bx - ax, dy = by - ay, p, q, t, i;
      for (i = 0; i < 4; i++) {
        if (i === 0) { p = -dx; q = ax - x0; } else if (i === 1) { p = dx; q = x1 - ax; }
        else if (i === 2) { p = -dy; q = ay - y0; } else { p = dy; q = y1 - ay; }
        if (p === 0) { if (q < 0) return false; continue; }
        t = q / p;
        if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
      return true;
    }
    var obsExtra = new Float64Array(16);  // retangulos de rotulos ja postos (ate 4)
    var obsExtraN = 0;
    // obstaculos fixos do quadro. useLine: tambem a linha do fantasma e o que fica em volta dela
    function hitsHard(x0, y0, x1, y1, useLine) {
      var u = ua, i, o;
      if (x0 < LAB_EDGE || x1 > W - LAB_EDGE) return true;
      if (y0 < u.t + 2 || y1 > H - u.b - 2) return true;                 // HUD do topo e bandeja
      if (x1 > W - safe.r - FIT_BTN_W && y1 > fitTop(u)) return true;   // botao de enquadrar
      if (loupe.on && circHit(x0, y0, x1, y1, loupe.x, loupe.y, loupe.r + 6)) return true;
      for (i = 0; i < arrowN; i++) { o = i * 4; if (rectHit(x0, y0, x1, y1, arrowR[o], arrowR[o + 1], arrowR[o + 2], arrowR[o + 3])) return true; }
      for (i = 0; i < obsExtraN; i++) { o = i * 4; if (rectHit(x0, y0, x1, y1, obsExtra[o], obsExtra[o + 1], obsExtra[o + 2], obsExtra[o + 3])) return true; }
      if (useLine && gGeo.on) {
        var g = gGeo, pad = 3;
        if (segHit(g.x0, g.y0, g.x1, g.y1, x0 - pad, y0 - pad, x1 + pad, y1 + pad)) return true;
        if (circHit(x0, y0, x1, y1, g.x1, g.y1, 14)) return true;
        if (g.sr > 0 && circHit(x0, y0, x1, y1, g.sx, g.sy, g.sr + 3)) return true;
        if (g.rb > 0 && circHit(x0, y0, x1, y1, g.rx, g.ry, g.rb + 2)) return true;
        for (i = 0; i < g.ncross; i++) if (circHit(x0, y0, x1, y1, gCross[i * 2], gCross[i * 2 + 1], 16)) return true;
      }
      return false;
    }
    function hitsRoad(edges, nodes, z, ox, oy, x0, y0, x1, y1) {
      var k, e, a, b;
      for (k in edges) {
        e = edges[k]; if (!e) continue;
        a = nodes[e.a]; b = nodes[e.b]; if (!a || !b) continue;
        if (segHit(a.x * z + ox, a.y * z + oy, b.x * z + ox, b.y * z + oy, x0, y0, x1, y1)) return true;
      }
      return false;
    }
    // tenta os candidatos de um texto; devolve true e preenche lab
    function tryText(text, req, edges, nodes, z, ox, oy, avoidRoads) {
      var w = measure(text) + LAB_PADX * 2, h = LAB_H, c, cx, cy, gap, x0, y0, u = ua;
      // ponto sob o HUD ou na bandeja: o rotulo parte do limite da area util (o ponto fica fora dela)
      var apx = clamp(req.px, LAB_EDGE + w * 0.5, Math.max(LAB_EDGE + w * 0.5, W - LAB_EDGE - w * 0.5));
      var apy = clamp(req.py, u.t + h, Math.max(u.t + h, H - u.b - h));
      for (c = 0; c < 12; c++) {
        gap = CAND_FAR[c] ? 40 : 14;
        // eixo puro: afasta so nele; diagonal: afasta h/2+gap na vertical e so w/2+4 na horizontal
        cx = apx + CAND_DX[c] * (w * 0.5 + (CAND_DY[c] === 0 ? gap : 4));
        cy = apy + CAND_DY[c] * (h * 0.5 + gap);
        x0 = cx - w * 0.5; y0 = cy - h * 0.5;
        if (hitsHard(x0, y0, x0 + w, y0 + h, req.line)) continue;
        if (avoidRoads && hitsRoad(edges, nodes, z, ox, oy, x0, y0, x0 + w, y0 + h)) continue;
        lab.x0 = x0; lab.y0 = y0; lab.x1 = x0 + w; lab.y1 = y0 + h; lab.text = text; lab.forced = false;
        return true;
      }
      return false;
    }
    function drawPill(text, color, alpha) {
      var x0 = lab.x0, y0 = lab.y0, x1 = lab.x1, y1 = lab.y1, rad = (y1 - y0) * 0.5;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.beginPath();
      ctx.moveTo(x0 + rad, y0); ctx.lineTo(x1 - rad, y0);
      ctx.arc(x1 - rad, y0 + rad, rad, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x0 + rad, y1);
      ctx.arc(x0 + rad, y0 + rad, rad, Math.PI / 2, Math.PI * 1.5);
      ctx.closePath();
      ctx.fillStyle = C.white; ctx.globalAlpha = clamp(alpha, 0, 1) * 0.9; ctx.fill();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = LAB_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color; ctx.fillText(text, (x0 + x1) * 0.5, (y0 + y1) * 0.5 + 0.5);
      ctx.globalAlpha = 1;
    }
    function placeLabels(edges, nodes, z, ox, oy) {
      var i, q, o, text, ok2;
      obsExtraN = 0;
      usable();
      for (i = 0; i < 2; i++) {
        q = labReq[i]; o = labOut[i]; o.on = false;
        if (!q.on || !q.text || !ctx.fillText) continue;
        text = q.text;
        ctx.font = LAB_FONT;
        ok2 = tryText(text, q, edges, nodes, z, ox, oy, true);
        if (!ok2) ok2 = tryText(text, q, edges, nodes, z, ox, oy, false);
        if (!ok2) { var st = shortText(text); if (st !== text) { text = st; ok2 = tryText(text, q, edges, nodes, z, ox, oy, true) || tryText(text, q, edges, nodes, z, ox, oy, false); } }
        if (!ok2) {
          // nada cabe: cola no limite da area util, do lado do ponto (marcado como forcado)
          var w2 = measure(text) + LAB_PADX * 2, u = ua;
          var fx0 = clamp(q.px - w2 * 0.5, LAB_EDGE, Math.max(LAB_EDGE, W - LAB_EDGE - w2));
          var fy0 = clamp(q.py - 14 - LAB_H, u.t + 2, Math.max(u.t + 2, H - u.b - 2 - LAB_H));
          lab.x0 = fx0; lab.y0 = fy0; lab.x1 = fx0 + w2; lab.y1 = fy0 + LAB_H; lab.text = text; lab.forced = true;
        }
        drawPill(lab.text, q.color || C.red, q.alpha);
        o.on = true; o.x0 = lab.x0; o.y0 = lab.y0; o.x1 = lab.x1; o.y1 = lab.y1; o.text = lab.text; o.forced = lab.forced;
        if (obsExtraN < 4) {
          obsExtra[obsExtraN * 4] = lab.x0 - 2; obsExtra[obsExtraN * 4 + 1] = lab.y0 - 2;
          obsExtra[obsExtraN * 4 + 2] = lab.x1 + 2; obsExtra[obsExtraN * 4 + 3] = lab.y1 + 2; obsExtraN++;
        }
      }
    }
    // para testes: os obstaculos de hitsHard como lista (retangulos e a lupa), sem a linha
    r._obstacles = function () {
      var u = usable(), out = [], i, o;
      out.push({ name: 'hud-top', x0: 0, y0: -1e4, x1: W, y1: u.t });
      out.push({ name: 'tray', x0: 0, y0: H - u.b, x1: W, y1: H + 1e4 });
      out.push({ name: 'fit', x0: W - safe.r - FIT_BTN_W, y0: fitTop(u), x1: W + 1e4, y1: H + 1e4 });
      for (i = 0; i < arrowN; i++) { o = i * 4; out.push({ name: 'arrow', x0: arrowR[o], y0: arrowR[o + 1], x1: arrowR[o + 2], y1: arrowR[o + 3] }); }
      if (loupe.on) out.push({ name: 'loupe', circle: true, cx: loupe.x, cy: loupe.y, r: loupe.r });
      return out;
    };
    r._ghostGeo = function () { return gGeo; };
    r._lockGeo = function () { return lockGeo; }; // so para testes: o fio do angulo travado esta na tela?
    // forca o proximo draw (estado que a chave do quadro parado nao ve, ex.: cores trocadas)
    r.invalidate = function () { forceDraw = true; };
    r.reduceMotion = function () { return reduceMotion; };
    // solta o ouvinte de prefers-reduced-motion (render recriado, ex.: harness)
    r.destroy = function () {
      if (offEv) { try { offEv(); } catch (e) {} offEv = null; }
      try {
        if (rmMql && rmOn) { if (rmMql.removeEventListener) rmMql.removeEventListener('change', rmOn); else if (rmMql.removeListener) rmMql.removeListener(rmOn); }
      } catch (e) {}
      rmOn = null;
      hlCancel(); hlWorld = null;
      if (fitMo) { try { fitMo.disconnect(); } catch (e) {} fitMo = null; }
      fitEl = null;
    };
    r._idle = function () { return { skipped: idleSkipped, anim: frameAnim }; }; // so para testes
    r.hotRings = hotRingsT;
    // ids com a marca NEW no ultimo quadro desenhado (UI: ov.newJ; so no plano, sem ferramenta, 3+ ruas, na tela)
    r.newJMarks = function () { return njBox.slice(); };
    r._hotRecalc = function () { return hotRecalc; }; // so para testes: quantas vezes o agrupamento rodou
    r._roadHints = roadHintsT;
    r._laneGeo = function () { return laneGeo; }; // so para testes: faixas de 2 faixas do ultimo quadro (px de tela)

    function nodeScale(k, now) {
      var bn = nodeBorn[k];
      if (bn === undefined || bn < -1e8) return 1;
      var t = (now - bn - GROW_MS * 0.7) / POP_MS;
      if (t >= 1) { nodeBorn[k] = -1e9; return 1; }
      frameAnim = true;
      return t <= 0 ? 0 : easeBack(t);
    }

    // so para testes: quem esta animando agora
    r._debug = function (now) {
      var out = { growing: [], popping: [] }, k;
      for (k in edgeBorn) if (edgeBorn[k] > -1e8 && now - edgeBorn[k] < GROW_MS) out.growing.push({ id: +k, from: edgeFrom[k] });
      for (k in toolPop) if (now - toolPop[k] < POP_MS) out.popping.push(+k);
      return out;
    };

    // chegada de carro (sim -> game 'arrive' com x, y do destino): pulso de entrega
    var offEv = null;
    if (game && typeof game.onEvent === 'function') {
      offEv = game.onEvent(function (ev) { if (ev && ev.type === 'arrive') r.deliver(+ev.x, +ev.y); });
      if (typeof offEv !== 'function') offEv = null;
    }

    r.resize();
    return r;
  }

  CRZ.Render = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
