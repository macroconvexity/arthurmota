/* Cruzamento: maquina de estados do jogo (dias, orcamento, dado, cartas,
 * crescimento da cidade, derrota). Dono: agente GAME. DOM-free (roda no node).
 * Contrato: ARCHITECTURE.md, "API de CRZ.Game". Aleatoriedade so por CRZ.rng. */
(function (root) {
  'use strict';
  var CRZ = root.CRZ = root.CRZ || {};
  var CFG = CRZ.CFG;

  var STEP = 1 / 30;            // passo fixo do sim (s simulados)
  var BRANCHING = false;        // v2x: um ramo do 'e se' (g.whatIf) esta rodando: ele nao guarda manha nem abre ramos
  var CLEAR = 26;               // folga minima entre estradas nao ligadas
  var PLACEABLE = { stop: 1, yield: 1, light: 1, round: 1 };   // v2: a faixa de pedestre (cross) saiu
  // v2m: o tipo de um cruzamento pelo trafego de um dia (sim.nodeTraffic): o que a jogadora ve na rua.
  //  calm: poucos carros (abaixo de K.calm por minuto): sem sinal basta
  //  main: uma rua leva K.mainShare ou mais dos carros (as duas maos do mesmo eixo): Yield
  //  heavy: muitos carros de todos os lados (K.heavy por minuto ou mais): semaforo
  //  even: carros de todos os lados, movimento medio: Stop (ou Roundabout com 4+ ruas)
  // Devolve { k, v (carros/min), share, waste (fracao do dia com verde numa rua vazia) } ou null sem dados.
  function kindOf(tr, cfg) {
    var K = (cfg && cfg.junctionKinds) || { calm: 15, heavy: 65, mainShare: 0.7 };
    if (!tr || !(tr.secs > 5) || !tr.ap || tr.ap.length < 3) return null;
    var ax = {}, tot = 0, mx = 0, i, k;
    for (i = 0; i < tr.ap.length; i++) { ax[tr.ap[i].axis] = (ax[tr.ap[i].axis] || 0) + tr.ap[i].cars; tot += tr.ap[i].cars; }
    for (k in ax) if (ax[k] > mx) mx = ax[k];
    var v = tot / tr.secs * 60, share = tot > 0 ? mx / tot : 0;
    var kind = v < K.calm ? 'calm' : share >= K.mainShare ? 'main' : v >= K.heavy ? 'heavy' : 'even';
    return { k: kind, v: Math.round(v), share: Math.round(share * 100) / 100, waste: Math.round((tr.waste || 0) / tr.secs * 100) / 100 };
  }
  var DEG45 = Math.PI / 4;
  // Undo no save: teto de entradas e de caracteres (uma foto do mapa do dia 12 tem ~2 mil caracteres; 400 mil
  // deixam folga para ~200 delas sem ameacar a cota do localStorage). Passou do teto no save: saem as mais antigas.
  var UNDO_MAX = 200, UNDO_CHARS = 400000;
  // formato do save: 2 = partida de 30 dias com capitulos (v2). Sem o campo = o jogo publicado de 12 dias
  var SAVE_FMT = 2;

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

  // ---------- dado v2 (CFG.dice.pools/defs; v2/sistemas.md 3) ----------
  // Uma face e { v: 2, faces: 6, value, id, kind, offer, effect }. effect: budget, spawnMul, patienceMul, speedMul, free,
  // debt (pontos tirados do orcamento de amanha), festivalMul, eventMul. Os numeros vem da faixa do dia (tierOf).
  var FACE_KEYS = ['budget', 'spawnMul', 'speedMul', 'patienceMul', 'free', 'debt', 'festivalMul', 'eventMul'];
  function DC() { return CFG.dice || {}; }
  // capitulo do dia: CFG.chapterLen (do ramo de 30 dias) ou CFG.dice.chapterLen; padrao 10 dias por capitulo
  function chapterOfDay(day) {
    var len = (CFG.chapterLen > 0 ? CFG.chapterLen : 0) || DC().chapterLen || 10;
    return Math.floor(((day | 0) - 1) / len) + 1;
  }
  // faixa do dado no dia: '' (sem dado), gift, first, ch1, ch2, ch3. Funciona para qualquer numero de dias
  function tierOf(day) {
    var D = DC(); day = day | 0;
    if (!D.pools || day < (D.fromDay || 2)) return '';
    if (day < D.firstOffer) return 'gift';
    if (day === D.firstOffer) return 'first';
    if (day < D.costFrom) return 'ch1';
    return chapterOfDay(day) <= 2 ? 'ch2' : 'ch3';
  }
  function tierIdx(tier) { return tier === 'ch3' ? 2 : (tier === 'ch2' ? 1 : 0); }
  function faceDef(id) { var d = DC().defs; return d && own(d, id) ? d[id] : null; }
  function makeFace(id, value, day) {
    var df = faceDef(id) || { kind: 'plain' }, ti = tierIdx(tierOf(day)), eff = {}, i, k, v;
    for (i = 0; i < FACE_KEYS.length; i++) {
      k = FACE_KEYS[i]; v = df[k];
      if (Array.isArray(v)) v = v[Math.min(ti, v.length - 1)];
      if (v !== undefined && v !== 0) eff[k] = v;
    }
    return { v: 2, faces: DC().faces || 6, value: value, id: faceDef(id) ? id : 'plain', kind: df.kind || 'plain', offer: !!df.offer, effect: eff };
  }
  function isV2Face(d) { return !!d && typeof d === 'object' && d.v === 2; }
  // maior bonus de pontos de uma face (v2 e as tabelas antigas): teto do orcamento na validacao de save
  function maxFaceBudget() {
    var m = 0, defs = DC().defs || {}, k, v;
    for (k in defs) { v = defs[k].budget; (Array.isArray(v) ? v : [v || 0]).forEach(function (x) { m = Math.max(m, x); }); }
    [DC().early, DC().late].forEach(function (t) { if (t) m = Math.max(m, maxDieBudget(t)); });
    return m;
  }

  // ---------- dado de antes (CFG.dice.early/late): so para abrir save antigo ----------
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
    if (isV2Face(d)) return makeFace(d.id, d.value, day);
    // dado antigo: a tabela pelo numero de faces (d6 dos dias 1 a 5, d20 depois)
    var tab = d.faces === 20 ? CFG.dice.late : (d.faces === 6 ? CFG.dice.early : diceTable(Math.min(day, CFG.maxDays))), oc = outcomeById(tab, d.id);
    if (!oc) return { faces: d.faces, value: d.value, id: d.id, kind: 'plain', effect: {} };
    return makeDie(tab, d.value, oc);
  }

  // ---------- capitulos (v2, D9) ----------
  // dias 1..chapterDays sao o capitulo 1, e assim por diante; o ultimo capitulo termina em maxDays
  function chapLen() { var c = CFG.chapterDays | 0; return c > 0 ? c : CFG.maxDays; }
  function chapterOf(day) { return Math.max(1, Math.ceil(day / chapLen())); }
  function chapterFirst(ch) { return (ch - 1) * chapLen() + 1; }
  function chapterStart(day) { return day === chapterFirst(chapterOf(day)); }
  function chapterLast(day) { return day % chapLen() === 0 || day >= CFG.maxDays; }
  // dias livres (1 a strikeGraceUntil): travar nao conta strike nem encerra o dia
  function graceDay(day) { return day <= (CFG.strikeGraceUntil | 0); }
  // strikes que encerram o capitulo (ironMode: o primeiro contado encerra a partida)
  function strikeCap() { return CFG.ironMode ? 1 : CFG.maxStrikes; }
  // o strike que esgotaria o capitulo e perdoado? 'chapter1' (CFG.chapter1LastStrikeWarns), 'early' (antes de
  // CFG.noRestartBeforeDay) ou null (vale: a partida volta ao checkpoint)
  function forgiveWhy(day) {
    if (CFG.ironMode) return null;
    if (CFG.chapter1LastStrikeWarns && chapterOf(day) === 1) return 'chapter1';
    if (day < (CFG.noRestartBeforeDay | 0)) return 'early';
    return null;
  }

  // ---------- o jogo ----------
  // Primeira viagem (FIRST_TIME_PLAN.md). Proposta para CFG.teach em dev/game/NOTES_GAME.md.
  // spawnCap (2026-11-08): no dia do comboio o dado nao soma trafego por cima dele (Rush 1.5 + comboio num cruzamento
  // de 4 entradas travava quem nao agia); o comboio e a hora do rush desse dia.
  // v2 (2026-11-16, v2/nivel.md 6, v2/jogador.md 4.2 dia 2): o primeiro engarrafamento e no DIA 2, no T que a cidade
  // garante nesse dia (ensureTee), com uma rajada roteirizada que leva o anel ao vermelho (stopAt) sem travar; o
  // tutorial pausa ali ('Jammed! Cars can't move. Tap the bolt.') e o Boost limpa. Medido em
  // v2/_scripts/v2c/jam2.js (todas as sementes, Easy e Normal, 1x/2x/4x). jamAt: estresse em que a cena conta como
  // engarrafamento visto (st.teach.jamAt guarda o tempo do dia).
  // carsPerPat: o tamanho da rajada segue a paciencia do dia (dificuldade x velocidade): o pico do anel e ~0,96 x
  // carros / paciencia (medido), entao carsPerPat 0,85 mira o anel em ~0,8 em qualquer perfil, sem travar.
  // topUp: numa cidade em que a rajada se espalha (uma rua do jogador a mais abre caminho), topAt s depois do fim da
  // rajada, se o anel do T ainda esta abaixo de topBelow, sai mais topUp x paciencia carros (uma vez).
  // capAt: no dia da cena o T da rajada nunca trava (sim.capStress: anel no maximo capAt, sem strike, sem evento)
  var TEACH = { day: 2, convoyMin: 12, convoyMax: 34, carsPerPat: 1.05, window: 14, stopAt: 2, jamAt: 0.6, capAt: 0.97,
                topUp: 0.35, topAt: 1, topBelow: 0.6, minFrac: 0.01, maxSrc: 9, spawnMul: 0.6, spawnCap: 1,
                // integracao (ritmo + v2c): o dia 2 tem 32 s e o dobro de carros por segundo (CFG.day2Mul). Na cena, o
                // fundo volta ao de antes (spawnMul / day2Mul) e, se o anel do T ainda esta aceso no fim do dia, o dia
                // espera a fila sumir (anel abaixo de holdBelow) por no maximo holdMax s de jogo: o 'Nice' cabe no dia
                holdMax: 14, holdBelow: 0.3, holdQuiet: 2.5 };

  function build(seed, saved, opts) {
    opts = opts || {};
    var world = CRZ.Sim.create(seed);
    world.portalNorm = true;   // o Sim divide o trafego da cidade entre os portais (CFG.portalRef); mundos soltos dos testes nao
    var base = CRZ.rng(seed);
    var rngCalls = 0;
    var morning = null;   // v2x: save da manha de hoje (so memoria), base do g.whatIf
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
    // eventos de lugar (events.js, v2e): ganchos pequenos; sem o modulo carregado o jogo e o de antes
    function EVM() { return CRZ.Events && CRZ.Events.v === 1 ? CRZ.Events : null; }
    var undoStack = [];
    // v2 (D9): checkpoint = save completo (sem undo, sem checkpoint) da manha do primeiro dia do capitulo de hoje.
    // needCp: falta um (save antigo, checkpoint recusado): o proximo plano grava um. graceT: no -> s ate destravar
    var checkpoint = null, needCp = false, graceT = {};
    var placed = {};            // nodeId -> custo pago hoje por tool
    var activeCards = [];       // cartas valendo no dia atual
    var hot = {};               // nodeId -> estresse maximo do ultimo dia
    var acc = 0, stepCount = 0, dayFailed = false;
    var runHot = {};            // estresse maximo visto no dia (nao vai para o Sim)
    // v2x: segundos seguidos com o anel cheio (relogio da trava) por no, e o maior do dia em fracao de CFG.lockSeconds.
    // O resumo mostra quanto faltou para o jam (summary.lockNear); anel cheio sozinho nao e jam
    var runFull = {}, lockNear = 0;
    // retorno da escolha (v2, 2026-11-16): so contabilidade, nada disto muda regra, custo ou rng.
    // runAt = segundo do dia (st.dayTime) do pico de runHot; runWait = espera mais longa (s de jogo) de um carro
    // parado na fila do no; runPass = carros que cruzaram o no no dia (evento 'pass' do Sim)
    // runTrace = estresse do no a cada TRACE_DT s de jogo (inteiro 0 a 100): o balao do vigiado compara hoje com ontem
    // no MESMO segundo do dia
    var runAt = {}, runWait = {}, runPass = {}, runTrace = {};
    var basePatience = 1;       // patienceMul do dia so de dado x cartas (a velocidade multiplica por cima)

    var st = {
      day: 1, maxDays: CFG.maxDays, phase: 'plan', budget: 0, strikes: 0, speed: CFG.speedDial.defaultSpeed, paused: false,
      dayTime: 0, dayLen: CFG.dayLen[0], die: null, nextDie: null, rerolled: false, tools: [],
      // dado v2: dieState none (nao rolou) | offer (rolou, esperando Use/Pass/Keep) | used | passed | kept | auto (face
      // sem escolha, ja valendo). kept = face guardada { id, value } ou null. debt = pontos que saem do orcamento de
      // amanha (Loan); debtPaid = quanto saiu hoje. nextDie fica null: a previsao nao mostra o dado (sistemas.md 3.2)
      dieState: 'none', kept: null, debt: 0, debtPaid: 0, dieFromKept: false,
      free: { road: false, light: false }, summary: null, draft: null,
      totalDelivered: 0, totalScore: 0, history: [], cards: [],
      // v2: capitulo de hoje (1..), dias por capitulo e carros entregues ate a manha do primeiro dia do capitulo
      chapter: 1, chapterDays: chapLen(), chapterCars0: 0,
      // v2 (D9): voltas ao comeco de um capitulo nesta partida; dia do checkpoint (manha para onde a volta leva; null
      // sem checkpoint, ironMode); jams livres de hoje (dias 1 a 5) e se o aviso do primeiro jam livre ja saiu
      chapterRetries: 0, checkpointDay: null, freeJams: 0, freeJamSeen: false, iron: !!CFG.ironMode,
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
      teach: { day3Convoy: false, jam: false, seen: false, target: null, sent: 0 },
      // retorno da escolha (v2). trouble = registro do ultimo dia jogado, por cruzamento com anel (pico >= HOT_MIN) ou
      // vigiado: { day, len, nodes: { id: { p: pico, t: segundo do pico, w: espera mais longa em s, n: carros que
      // cruzaram } } }. watch = cruzamentos vigiados HOJE (anel de ontem + ferramenta posta hoje, no maximo 2):
      // { day, list: [{ id, tool, p, t, w, n (de ontem), now: { p, w, n } (de hoje, no fim do dia) }] }.
      // watchPrev = o watch de ontem (a manha seguinte confere se o anel sumiu). Tudo vai no save.
      trouble: null, watch: { day: 1, list: [] }, watchPrev: null,
      // v2: manutencao do semaforo desta manha (CFG.upkeep). null antes do fromDay. { day, lights, free, owed, paid,
      // dark: [ids de semaforos apagados hoje por falta de ponto] }. Vai no save.
      upkeep: null,
      // v2: escolhas permanentes da partida (carta do dia 19): round = Roundabout liberada; freePower = semaforos sem
      // manutencao. Vai no save.
      perks: { round: false, freePower: 0 },
      // v2m: tipo de cada cruzamento no dia que acabou (kindOf): nodeId -> { k, v, share, waste }. Vai no save.
      kinds: {},
      // v2: forma da cidade (CFG.archetypes, v2/nivel.md 3.2): 'classic' | 'river' | 'park'
      archetype: 'classic',
      // v2: Road crew (CFG.crew). active = dias que faltam de cada equipe; income = pontos que entraram hoje;
      // offer = a oferta esta aberta nesta manha; hired = equipes contratadas na partida. Vai no save.
      crew: { active: [], income: 0, offer: false, hired: 0, day: 0 },
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
    // 'New record' (finishDay). fromDay: os dias 1 e 2 sao roteiro do tutorial (o dia 2 tem o dobro de carros por
    // segundo, CFG.day2Mul) e nao entram na base nem viram recorde. rateMul 1,25 -> 1,10 nos 30 dias: os dias quase
    // nao crescem (45 a 60 s) e com 1,25 o recorde sumia depois do dia 11 (dev/game/test_record.js, INTEGRACAO.md)
    var RECORD = { minCars: 5, rateMul: 1.10, fromDay: 3 };
    var WATCH_MAX = 2;          // cruzamentos vigiados por dia (os dois primeiros)
    var TRACE_DT = 2, TRACE_EVERY = Math.round(TRACE_DT / STEP);   // amostra do estresse por no (s de jogo, passos)
    var WATCH_TOOLS = { stop: 1, yield: 1, light: 1, round: 1, cross: 1, upgrade: 1 };

    // ----- retorno da escolha (v2): registro por cruzamento e cruzamentos vigiados -----
    function junctionCount() {
      var c = 0, ids = sortedIds(world.nodes);
      for (var i = 0; i < ids.length; i++) if (degree(world.nodes[ids[i]]) >= 3) c++;
      return c;
    }
    // espera mais longa agora no no (s de jogo). Sim sem waitOf (stub dos testes): estresse x paciencia do dia
    function waitNow(id, n) {
      if (typeof world.waitOf === 'function') { var v = +world.waitOf(id); return v > 0 && isFinite(v) ? v : 0; }
      var p = world.params || {}, pd = CFG.patienceDay && CFG.patienceDay[st.day - 1];
      return (n.stress || 0) * CFG.patience * (pd > 0 ? pd : 1) * (p.patienceMul > 0 ? p.patienceMul : 1);
    }
    // fim do dia: o registro de hoje (cruzamentos com anel e os vigiados) e o resultado de cada vigiado
    function recordDay() {
      var rec = {}, wid = {}, L = st.watch && st.watch.day === st.day ? st.watch.list : [], ids = sortedIds(world.nodes), i;
      for (i = 0; i < L.length; i++) wid[L[i].id] = 1;
      for (i = 0; i < ids.length; i++) {
        var id = ids[i], n = world.nodes[id], pk = Math.min(1, Math.max(n.stress || 0, runHot[id] || 0));
        var wt = Math.max(runWait[id] || 0, waitNow(id, n));
        if (pk >= HOT_MIN || wid[id]) rec[id] = { p: Math.round(pk * 100) / 100, t: r1(runAt[id] || 0), w: r1(wt), n: runPass[id] | 0, s: (runTrace[id] || []).slice() };
      }
      st.trouble = { day: st.day, len: st.dayLen, nodes: rec };
      for (i = 0; i < L.length; i++) {
        var r = rec[L[i].id] || { p: 0, w: 0, n: 0 };
        L[i].now = { p: r.p, w: r.w, n: r.n };
      }
    }
    // ferramenta posta ou trocada num cruzamento com o anel de ontem: passa a ser vigiado hoje (os 2 primeiros).
    // Devolve 'new' (vigiado agora), 'same' (ja era; a ferramenta e atualizada) ou null
    function watchOn(id, tool) {
      if (!WATCH_TOOLS[tool] || !(+st.hot[id] >= HOT_MIN)) return null;
      if (!st.watch || st.watch.day !== st.day) st.watch = { day: st.day, list: [] };
      var L = st.watch.list, i;
      for (i = 0; i < L.length; i++) if (L[i].id === id) { if (tool !== 'upgrade' || L[i].tool === 'upgrade') L[i].tool = tool; return 'same'; }
      if (L.length >= WATCH_MAX) return null;
      var tr = st.trouble && st.trouble.day === st.day - 1 && st.trouble.nodes ? st.trouble.nodes[id] : null;
      // save de antes do registro (so o mapa de anel): pico do mapa, sem hora nem espera (o resumo nao inventa numero)
      L.push({ id: id, tool: tool, p: tr && fin(tr.p) ? tr.p : Math.min(1, +st.hot[id]), t: tr && fin(tr.t) ? tr.t : null,
               w: tr && fin(tr.w) ? tr.w : null, n: tr && fin(tr.n) ? tr.n : null, s: tr && Array.isArray(tr.s) ? tr.s.slice() : null, dt: TRACE_DT });
      return 'new';
    }
    // sem a ferramenta (removida, desfeita): o cruzamento deixa de ser vigiado. Two lanes vale enquanto a rua tem 2 faixas
    function syncWatch() {
      if (!st.watch || !Array.isArray(st.watch.list)) return;
      st.watch.list = st.watch.list.filter(function (e) {
        var n = world.nodes[e.id];
        if (!n) return false;
        if (e.tool !== 'upgrade') return n.tool === e.tool;
        for (var j = 0; j < n.edges.length; j++) { var ed = world.edges[idOf(n.edges[j])]; if (ed && ed.lanes === 2) return true; }
        return false;
      });
    }
    function normWatch(v) {
      if (!isObjL(v) || !fin(v.day) || !Array.isArray(v.list)) return null;
      var out = { day: v.day | 0, list: [] };
      for (var i = 0; i < v.list.length && out.list.length < WATCH_MAX; i++) {
        var e = v.list[i];
        if (!isObjL(e) || !fin(e.id) || typeof e.tool !== 'string' || !WATCH_TOOLS[e.tool]) continue;
        var o = { id: e.id, tool: e.tool, p: fin(e.p) ? Math.max(0, Math.min(1, e.p)) : 0, t: fin(e.t) && e.t >= 0 ? e.t : null,
                  w: fin(e.w) && e.w >= 0 ? e.w : null, n: fin(e.n) && e.n >= 0 ? e.n : null, s: traceOk(e.s), dt: fin(e.dt) && e.dt > 0 ? e.dt : TRACE_DT };
        if (isObjL(e.now)) o.now = { p: fin(e.now.p) ? Math.max(0, Math.min(1, e.now.p)) : 0, w: fin(e.now.w) && e.now.w >= 0 ? e.now.w : 0, n: fin(e.now.n) && e.now.n >= 0 ? e.now.n : 0 };
        out.list.push(o);
      }
      return out;
    }
    function traceOk(a) {
      if (!Array.isArray(a) || a.length > 400) return null;
      for (var i = 0; i < a.length; i++) if (!nat(a[i]) || a[i] > 100) return null;
      return a.slice();
    }
    function normTrouble(v) {
      if (!isObjL(v) || !fin(v.day) || !isObjL(v.nodes)) return null;
      var out = { day: v.day | 0, len: fin(v.len) ? v.len : 0, nodes: {} }, k, e;
      for (k in v.nodes) {
        if (!own(v.nodes, k) || !/^\d+$/.test(k)) continue;
        e = v.nodes[k];
        if (!isObjL(e) || !fin(e.p)) continue;
        out.nodes[k] = { p: Math.max(0, Math.min(1, e.p)), t: fin(e.t) && e.t >= 0 ? e.t : 0, w: fin(e.w) && e.w >= 0 ? e.w : 0, n: fin(e.n) && e.n >= 0 ? e.n : 0, s: traceOk(e.s) || [] };
      }
      return out;
    }

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
    // v2m: quantos semaforos a cidade liga hoje (CFG.lightCap.byDay: [[dia, N], ...] em ordem; a carta Free power soma
    // +1 por escolha). Infinity sem a regra.
    function lightCap() {
      var LC = CFG.lightCap;
      if (!LC || !LC.byDay) return Infinity;
      var c = 0;
      for (var i = 0; i < LC.byDay.length; i++) if (st.day >= LC.byDay[i][0]) c = LC.byDay[i][1];
      return c + (LC.perkPlus ? (st.perks && st.perks.freePower | 0) * LC.perkPlus : 0);
    }
    function lightsUsed(skip) {
      var c = 0, k = sortedIds(world.nodes);
      for (var i = 0; i < k.length; i++) if (k[i] !== skip && world.nodes[k[i]].tool === 'light') c++;
      return c;
    }
    function isUnlocked(tool) {
      if (!own(CFG.tools, tool) || CFG.tools[tool].removed) return false;
      if (tool === 'round' && st.perks && st.perks.round) return true;                 // v2: carta do dia 19
      if (tool === 'oneway' && !archHas('oneway')) return false;                      // v2: so no arquetipo que pede
      return st.day >= CFG.tools[tool].unlockDay;
    }
    // ferramenta existe nesta partida (a bandeja e o guia so mostram estas; o ladrilho bloqueado nao aparece)
    function inMatch(tool) {
      var t = own(CFG.tools, tool) ? CFG.tools[tool] : null;
      if (!t || t.removed) return false;
      if (tool === 'oneway') return archHas('oneway');
      return true;
    }
    function refresh() {
      var arr = [];
      for (var i = 0; i < CFG.toolOrder.length; i++) {
        var id = CFG.toolOrder[i], c = costOf(id), u = isUnlocked(id);
        if (!inMatch(id)) continue;
        var row = { id: id, cost: c, unlocked: u, afford: u && st.budget >= c };
        if (id === 'light' && CFG.lightCap && CFG.lightCap.byDay) { row.cap = lightCap(); row.used = lightsUsed(); if (row.used >= row.cap) row.afford = false; }
        arr.push(row);
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
    // ferramenta que o dado de hoje deixa gratis (light vira road se o semaforo ainda nao existe)
    function dieGrant(die) {
      var f = die && die.effect && die.effect.free;
      if (f === 'light' && isUnlocked('light')) return 'light';
      if ((f === 'light' || f === 'road') && isUnlocked('road')) return 'road';
      return null;
    }
    function cardGrants(tool) { return hasCard(tool === 'road' ? 'freeRoad' : 'freeLight'); }
    // aplica os pontos e a obra gratis da face; devolve quanto o orcamento mudou (face com custo nao passa de zero)
    function applyDie(die) {
      var b = (die && die.effect && die.effect.budget) || 0, before = st.budget;
      st.budget = Math.max(0, st.budget + b);
      var t = dieGrant(die);
      if (t) st.free[t] = true;
      return st.budget - before;
    }

    // ----- dado v2: rolar, usar, passar, guardar -----
    // sistemas de outros donos que duas faces pedem. Sem eles a face sai do sorteio (o ramo funciona sozinho):
    //  festival: CRZ.Events.festivalSpot(g, day) -> id de um portal da cidade (a rua marcada) e o Sim honra
    //            world.params.portalMul = { portalId: mul } (CRZ.Sim.features.portalMul === true)
    //  event:    CRZ.Events.tomorrow(g) -> { nodeId, label } (o evento de amanha com lugar) e
    //            CRZ.Events.scale(g, day, mul) (o evento daquele dia fica mul vezes maior)
    function EV() { return CRZ.Events && typeof CRZ.Events === 'object' ? CRZ.Events : null; }
    function diceFeature(need, day) {
      var E = EV();
      if (need === 'festival') {
        if (!E || typeof E.festivalSpot !== 'function' || !(CRZ.Sim && CRZ.Sim.features && CRZ.Sim.features.portalMul)) return false;
        try { var p = E.festivalSpot(g, day); return p !== null && p !== undefined && !!getNode(p); } catch (e) { return false; }
      }
      if (need === 'event') {
        if (!E || typeof E.tomorrow !== 'function' || typeof E.scale !== 'function' || day >= CFG.maxDays) return false;
        try { return !!E.tomorrow(g); } catch (e2) { return false; }
      }
      return true;
    }
    // faces do sorteio de hoje: o pool da faixa sem as que pedem um sistema que nao existe (valor = casa no d6)
    function poolOf(day) {
      var t = tierOf(day), P = (DC().pools || {})[t] || [], out = [];
      for (var i = 0; i < P.length; i++) {
        var df = faceDef(P[i]);
        // v2x (playtest cego 5: o 4 dava '+1 build point' num dia e 'Quiet day' no outro): a face mostra o numero fixo da
        // oferta (CFG.dice.defs[id].pip), o mesmo a partida inteira; sem pip, a posicao no sorteio como antes
        if (df && (!df.needs || diceFeature(df.needs, day))) out.push({ id: P[i], value: df.pip > 0 ? df.pip : i + 1 });
      }
      return out;
    }
    var forced = null;   // so testes: a proxima rolagem cai nesta face (g.debugForceFace)
    function drawFace(day) {
      if (forced) { var f0 = forced; forced = null; return makeFace(f0.id, f0.value, day); }
      var pool = poolOf(day);
      if (!pool.length) return makeFace('plain', 1, day);
      // semente da partida + dia: recarregar a manha e rolar de novo da a mesma face
      var r = sideRng(307, day)(), k = Math.min(pool.length - 1, Math.floor(r * pool.length));
      return makeFace(pool[k].id, pool[k].value, day);
    }
    // a escolha mexe no orcamento depois de obras do dia: as fotos do Undo andam junto (o Undo nunca devolve o custo
    // de uma face usada nem tira o premio)
    function shiftUndo(delta) {
      if (!delta) return;
      for (var i = 0; i < undoStack.length; i++) undoStack[i].budget = Math.max(0, undoStack[i].budget + delta);
    }
    function useFace(die) {
      var before = st.budget, d = applyDie(die);
      if (die.effect.debt) st.debt = (st.debt || 0) + die.effect.debt;
      if (die.effect.eventMul && EV() && typeof EV().scale === 'function') { try { EV().scale(g, st.day + 1, die.effect.eventMul); } catch (e) {} }
      shiftUndo(st.budget - before);
      refresh();
      return d;
    }
    function dieEvent() { emit({ type: 'die', die: st.die ? clone(st.die) : null, next: null, state: st.dieState, kept: st.kept ? clone(st.kept) : null }); }
    function canKeepToday() { return st.day >= (DC().keepFrom || 99) && st.day < CFG.maxDays; }
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
    function archHas(feature) { var A = CFG.archetypes && CFG.archetypes[st.archetype]; return !!(A && A[feature]); }
    function bonusAsScore() { return !CFG.deliveryBonus || CFG.deliveryBonus.mode !== 'points'; }

    function enterPlan(day, leftover) {
      var newChapter = chapterStart(day);
      st.day = day;
      st.chapter = chapterOf(day);
      if (newChapter) st.chapterCars0 = st.totalDelivered;
      if (newChapter && day > 1) st.strikes = 0;   // strikes de volta ao maximo no primeiro dia de cada capitulo
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
      st.teach = { day3Convoy: false, jam: false, seen: teachSeen, target: null, sent: 0 };
      st.speedBonus = 0;
      st.tips = 0;
      syncDial();
      syncModes(CFG.clear.charges);
      // dado v2: nada sorteado nem aplicado aqui; a face sai quando o jogador toca (g.rollDie). O rng principal ainda
      // consome o que o dado antigo consumia (dia 1 e dia 6 sorteavam o de hoje; todo dia menos o ultimo, o de amanha),
      // para as cidades das mesmas sementes crescerem iguais
      var burn = (day === 1 || day === 6 ? 1 : 0) + (day < CFG.maxDays ? 1 : 0);
      for (var bi = 0; bi < burn; bi++) R();
      st.die = null; st.nextDie = null; st.rerolled = false;
      st.dieState = 'none'; st.dieFromKept = false;
      // Loan de ontem: sai do orcamento de hoje (ate zerar)
      st.debtPaid = Math.min(st.budget, st.debt || 0);
      st.budget -= st.debtPaid; st.debt = 0;
      payCrews();
      chargeUpkeep();
      undoStack = [];
      placed = {};
      // vigiados de ontem viram watchPrev (a manha confere o anel); hoje comeca sem nenhum
      st.watchPrev = st.watch && st.watch.day === day - 1 && st.watch.list.length ? st.watch : null;
      st.watch = { day: day, list: [] };
      st.freeJams = 0;
      refresh();
      // eventos de lugar: o de hoje confere o lugar, o de amanha ganha o lugar (aviso da vespera). Sem rng do jogo
      if (EVM() && st.events) EVM().onPlan(g);
      // o checkpoint vem depois do onPlan: leva o lugar do evento de amanha
      if ((newChapter || needCp) && !CFG.ironMode) takeCheckpoint();
      emit({ type: 'day', day: day });
      if (newChapter) emit({ type: 'chapter', chapter: st.chapter, day: day });
      dieEvent();
      for (var i = 0; i < CFG.toolOrder.length; i++) {
        var id = CFG.toolOrder[i];
        if (CFG.tools[id].unlockDay === day && inMatch(id)) emit({ type: 'unlock', tool: id });
      }
      if (day >= CFG.clear.unlockDay && !clearSeen) { clearSeen = true; emit({ type: 'unlock', tool: 'clear' }); }
      emit({ type: 'phase', phase: 'plan' });
    }

    // ----- Road crew (v2, CFG.crew): renda das equipes de manha e a oferta do dia -----
    function payCrews() {
      var C = CFG.crew, cr = st.crew, inc = 0, keep = [];
      for (var i = 0; i < cr.active.length; i++) { if (cr.active[i] > 0) { inc += (C ? C.perDay : 1); if (cr.active[i] - 1 > 0) keep.push(cr.active[i] - 1); } }
      cr.active = keep; cr.income = inc; cr.day = st.day;
      st.budget += inc;
      cr.offer = !!C && st.day >= C.fromDay && st.day <= C.toDay && st.day < CFG.maxDays && cr.active.length < C.maxActive;
      if (inc > 0) emit({ type: 'crewPay', income: inc, active: cr.active.length });
    }
    // ----- manutencao do semaforo (v2, CFG.upkeep) -----
    function lightIds() {
      var out = [], k = sortedIds(world.nodes);
      for (var i = 0; i < k.length; i++) if (world.nodes[k[i]].tool === 'light') out.push(k[i]);
      return out;
    }
    // de manha (enterPlan), depois do orcamento, do dado e da carta: desconta 1 por semaforo; o que nao cabe apaga
    function chargeUpkeep() {
      var U = CFG.upkeep;
      st.upkeep = null;
      if (!U || !(U.perLight > 0) || st.day < U.fromDay) return;
      var L = lightIds(), free = Math.min(L.length, st.perks.freePower | 0);
      var owed = (L.length - free) * U.perLight, paid = Math.min(st.budget, owed);
      paid = Math.floor(paid / U.perLight) * U.perLight;
      var unpaid = Math.round((owed - paid) / U.perLight), dark = [];
      if (unpaid > 0) {
        // apagam os menos usados ontem (pico de estresse do mapa de problemas), empate: o de id maior
        var ord = L.slice().sort(function (a, b) { return ((hot[a] || 0) - (hot[b] || 0)) || (b - a); });
        dark = ord.slice(0, unpaid).sort(function (a, b) { return a - b; });
      }
      st.budget -= paid;
      st.upkeep = { day: st.day, lights: L.length, free: free, owed: owed, paid: paid, dark: dark };
      if (owed > 0) emit({ type: 'upkeep', lights: L.length, paid: paid, dark: dark.slice() });
    }
    // save: so numeros inteiros e, em dark, ids de semaforos que existem (o resto sai; save estragado nunca apaga outro no)
    function upkeepNorm(u) {
      if (!isObjL(u) || !nat(u.day)) return null;
      var dk = Array.isArray(u.dark) ? u.dark.filter(function (id) { return nat(id) && world.nodes[id] && world.nodes[id].tool === 'light'; }) : [];
      return { day: u.day, lights: nat(u.lights) ? u.lights : 0, free: nat(u.free) ? u.free : 0, owed: nat(u.owed) ? u.owed : 0,
               paid: nat(u.paid) ? u.paid : 0, dark: dk };
    }
    // corrida: os semaforos apagados funcionam como sem sinal (setTool null) e voltam no fim do dia
    var darkNow = [];
    function darkenLights() {
      darkNow = [];
      var d = st.upkeep && st.upkeep.day === st.day ? st.upkeep.dark : [];
      for (var i = 0; i < d.length; i++) {
        var n = world.nodes[d[i]];
        if (n && n.tool === 'light') { world.setTool(n.id, null); darkNow.push(n.id); }
      }
    }
    function relightLights() {
      for (var i = 0; i < darkNow.length; i++) if (world.nodes[darkNow[i]] && !world.nodes[darkNow[i]].tool) world.setTool(darkNow[i], 'light');
      if (darkNow.length) autoPair();
      darkNow = [];
    }
    // v2 (v2/sistemas.md 2.2): semaforos vizinhos pareiam sozinhos. Regra do par certo do jogo (bot.js e ui.js 'Pick
    // a light on the same road'): dois semaforos ligados por UMA rua. Pares existentes validos ficam; cada semaforo
    // sem par pega o vizinho sem par de menor id. Deterministico, nao consome rng.
    function autoPair() {
      if (CFG.lightsAutoPair === false || typeof world.pairLights !== 'function') return 0;
      var L = lightIds(), made = 0, i, j;
      for (i = 0; i < L.length; i++) {
        var n = world.nodes[L[i]];
        if (n.pair !== null && n.pair !== undefined) {
          var p = world.nodes[n.pair];
          if (!p || p.tool !== 'light') world.unpair(n.id);
        }
      }
      for (i = 0; i < L.length; i++) {
        var a = world.nodes[L[i]];
        if (a.pair !== null && a.pair !== undefined) continue;
        var nb = [];
        for (j = 0; j < a.edges.length; j++) {
          var e = world.edges[idOf(a.edges[j])]; if (!e) continue;
          var o = world.nodes[e.a === a.id ? e.b : e.a];
          if (o && o.tool === 'light' && (o.pair === null || o.pair === undefined) && o.id !== a.id) nb.push(o.id);
        }
        nb.sort(function (x, y) { return x - y; });
        if (nb.length && world.pairLights(a.id, nb[0])) made++;
      }
      return made;
    }

    function choiceIds() { return (CFG.choiceCard && CFG.choiceCard.cards) || []; }
    function drawDraft() {
      var nextDay = st.day + 1;
      // v2: dia da carta de escolha (CFG.choiceCard): as duas cartas fixas, sem sorteio (nao consome rng)
      var CC = CFG.choiceCard;
      if (CC && st.day === CC.day && !st.perks.chosen) return choiceIds().slice();
      // REGRA DO DRAFT: so entra carta cuja ferramenta/condicao ja existe e foi ensinada.
      //  plus2: sempre. patient: depois do primeiro anel. smooth e waveBonus: aposentadas (CFG.cards offer: false).
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
      // 2026-11-10: cartas com offer: false (smooth, waveBonus) saem do sorteio; patient so depois do primeiro anel
      // (CFG.cardPatientRingAt, a mesma regra da ui.js). O consumo de rng e o da regra antiga (pool antigo): a cidade
      // que cresce no dia seguinte e a mesma de antes para a mesma semente; so muda o que e oferecido.
      function oldOk(cd) {
        if (cd.id === 'freeLight' && CFG.tools.light.unlockDay > nextDay) return false;
        // o dado de amanha (st.nextDie, previsao verdadeira) ja deixa o semaforo gratis: a carta seria redundante
        if (cd.id === 'freeLight' && st.nextDie && st.nextDie.effect && st.nextDie.effect.free === 'light') return false;
        if (cd.id === 'waveBonus' && (CFG.tools.light.unlockDay > nextDay || !hasPair())) return false;
        if (cd.id === 'freeRoad' && CFG.tools.road.unlockDay > nextDay) return false;
        return true;
      }
      var ringAt = CFG.cardPatientRingAt > 0 ? CFG.cardPatientRingAt : 0, ringEver = !ringAt;
      if (!ringEver) {
        for (var h = 0; h < st.history.length; h++) if ((st.history[h].peak || 0) >= ringAt) { ringEver = true; break; }
        if (!ringEver) for (var hk in st.hot) if (st.hot[hk] > 0) { ringEver = true; break; }
      }
      var oldN = CFG.cards.filter(oldOk).length;
      var pool = CFG.cards.filter(function (cd) {
        if (cd.offer === false || !oldOk(cd)) return false;
        if (cd.id === 'patient' && !ringEver) return false;
        return true;
      }), out = [];
      var draws = Math.min(3, pool.length), burn = Math.min(3, oldN) - draws;
      while (out.length < 3 && pool.length) {
        var ws = [];
        for (var i = 0; i < pool.length; i++) ws.push(pool[i].weight);
        var k = Rweighted(ws);
        out.push(pool[k].id);
        pool.splice(k, 1);
      }
      for (; burn > 0; burn--) R();
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
               hardestDay: hasPeak ? hard : 0, hardestPeak: hasPeak ? Math.round(Math.max(0, hardP) * 100) / 100 : 0, failedDays: failedDays,
               // v2: strikes da partida inteira (dias com strike no historico), voltas de capitulo, e a volta oferecida
               // (derrota com checkpoint: o capitulo e o dia da manha para onde a partida volta)
               strikesTotal: failedDays.length, chapter: chapterOf(st.day), chapterRetries: st.chapterRetries, iron: !!CFG.ironMode,
               retry: (!win && checkpoint && !CFG.ironMode) ? { chapter: chapterOf(checkpoint.st.day), day: checkpoint.st.day } : null };
    }
    // ----- checkpoint (v2, D9) -----
    function takeCheckpoint() {
      checkpoint = saveCore();
      delete checkpoint.undo;
      needCp = false;
      st.checkpointDay = checkpoint.st.day;
    }
    // jam livre (dias 1 a strikeGraceUntil): o cruzamento travou e aparece travado; destrava sozinho depois de
    // graceUnlockSeconds de jogo, ou com um Boost (useClear)
    function freeJam(id) {
      st.freeJams++;
      graceT[id] = CFG.graceUnlockSeconds > 0 ? CFG.graceUnlockSeconds : 4;
      var first = !st.freeJamSeen;
      st.freeJamSeen = true;
      endFF('jam');   // o jogador ve o cruzamento travado (o dia nao acaba)
      emit({ type: 'freeJam', nodeId: id, day: st.day, first: first, countsFrom: (CFG.strikeGraceUntil | 0) + 1 });
    }
    function releaseJam(id) {
      delete graceT[id];
      var n = world.nodes[id];
      if (!n || !n.locked) return;
      n.locked = false;
      // o Sim so zera a contagem de travamento por boost(): um boost de um passo, sem acelerar (mul 1), tira graceRelief
      if (typeof world.boost === 'function') world.boost(id, STEP, 1, CFG.graceRelief >= 0 ? CFG.graceRelief : 0.4);
      emit({ type: 'jamFree', nodeId: id });
    }
    function tickGrace(dt) {
      for (var k in graceT) if (Object.prototype.hasOwnProperty.call(graceT, k)) { graceT[k] -= dt; if (graceT[k] <= 1e-9) releaseJam(+k); }
    }
    function finishDay(failed) {
      relightLights();
      if (EVM() && st.events) EVM().endDay(g);
      var s = world.stats || {};
      var delivered = s.delivered || 0, spawned = s.spawned || 0;
      var avgWait = delivered > 0 ? (s.waitSum || 0) / delivered : 0;
      var waves = s.waveHits || 0;
      var score = delivered * 10 + waves * 2 - Math.round(avgWait);
      var gl = Math.max(s.gridlocks || 0, failed ? 1 : 0);
      // gorjeta: soma ao resto dos dias anteriores; cada perPoint vira 1 build point amanha
      var per = CFG.speedDial.tipsPerPoint, tipTotal = st.tipCarry + st.tips;
      var sb = Math.floor(tipTotal / per + 1e-9);
      // v2: bonus de entrega como placar (CFG.deliveryBonus): a barra cheia vale scorePerBar no placar, nao ponto
      var bonusScore = bonusAsScore() ? sb * (CFG.deliveryBonus.scorePerBar || 0) : 0;
      score += bonusScore;
      st.speedBonus = bonusAsScore() ? 0 : sb;
      st.tipCarry = Math.max(0, tipTotal - sb * per);
      syncDial();
      var peak = 0, pids = sortedIds(world.nodes);
      for (var pi = 0; pi < pids.length; pi++) peak = Math.max(peak, world.nodes[pids[pi]].stress || 0, runHot[pids[pi]] || 0);
      var prevBest = 0, prevSum = 0, hn = st.history.length, prevRate = 0, rn = 0;
      for (pi = 0; pi < hn; pi++) {
        var hh = st.history[pi], hl0 = fin(hh.len) && hh.len > 0 ? hh.len : CFG.dayLen[(hh.day | 0) - 1];
        prevSum += hh.delivered;
        if ((hh.day | 0) < RECORD.fromDay) continue;   // base do recorde sem os dias do tutorial
        rn++; prevBest = Math.max(prevBest, hh.delivered);
        if (hl0 > 0) prevRate = Math.max(prevRate, hh.delivered / hl0);
      }
      // 'New record' (v2): recorde da partida inteira E por margem real. A cidade cresce sozinha, entao "mais carros que
      // qualquer dia" saia em 77% das trocas de dia (headless smart, 20 sementes). Agora: mais carros que qualquer dia,
      // +5 no minimo, e carros por segundo de dia 10% acima do melhor ritmo (um dia mais longo sozinho nao e recorde)
      var recordNow = rn > 0 && st.day >= RECORD.fromDay && delivered > prevBest && delivered - prevBest >= RECORD.minCars &&
        st.dayLen > 0 && delivered / st.dayLen >= prevRate * RECORD.rateMul;
      var headline = failed ? 'Locked!'
        : peak >= 0.7 ? 'Close call'
        : recordNow ? 'New record'
        : (hn > 0 && delivered > 1.1 * prevSum / hn) ? 'Busy day'
        : 'Smooth day';
      if (convoy) { teachSeen = true; convoy = null; }
      st.teach.seen = teachSeen;
      st.summary = {
        headline: headline, peak: Math.round(Math.min(1, peak) * 100) / 100,
        delivered: delivered, spawned: spawned, avgWait: Math.round(avgWait * 10) / 10,
        gridlocks: gl, waves: waves, failed: !!failed, score: score, lock: failed && lastLock && lastLock.day === st.day ? clone(lastLock) : null,
        tips: Math.round(st.tips), speedBonus: sb, bonusScore: bonusScore, bonusMode: bonusAsScore() ? 'score' : 'points',
        tipCarry: Math.round(st.tipCarry * 100) / 100,
        // v2x: quanto o pior cruzamento chegou do jam (0 a 1; 1 = travou hoje, contando ou nao como strike)
        lockNear: failed || gl > 0 ? 1 : Math.round(Math.min(0.99, lockNear) * 100) / 100,
        // carros perdidos no dia (portal sem rota, mao unica): o sim conta cada carro uma vez. Gravado no
        // resumo para o "Lost cars: N" sobreviver a save/load (o world.stats zera no load)
        lost: s.lost || 0
      };
      // v2: fim do capitulo (dias 10 e 20; o dia 30 e o fim da partida): o resumo vira o momento do capitulo
      if (chapterLast(st.day) && st.day < CFG.maxDays) {
        st.summary.chapterDone = { chapter: chapterOf(st.day), cars: st.totalDelivered + delivered - st.chapterCars0,
                                   strikesLeft: 0 };
      }
      st.clear.charges = 0; regenT = []; syncBoost();
      st.totalDelivered += delivered;
      st.totalScore += score;
      // die, len e jn (v2): a linha do porque do resumo compara hoje com ontem (face do dado, duracao do dia, cruzamentos)
      st.history.push({ day: st.day, delivered: delivered, failed: !!failed, lost: s.lost || 0, peak: Math.round(Math.min(1, peak) * 100) / 100,
                        die: dieLive() && typeof st.die.id === 'string' ? st.die.id : null, len: st.dayLen, jn: junctionCount() });
      recordDay();
      if (failed) st.strikes++;
      // v2: perdao (capitulo 1, ou antes de noRestartBeforeDay): o strike entra no dia, mas a fileira fica com um a
      // menos e o capitulo segue; summary.forgiven diz por que (a UI diz isso numa linha)
      var CAP = strikeCap();
      if (failed && st.strikes >= CAP) { var why = forgiveWhy(st.day); if (why) { st.strikes = CAP - 1; st.summary.forgiven = why; } }
      if (st.freeJams > 0) { st.summary.freeJams = st.freeJams; st.history[st.history.length - 1].freeJams = st.freeJams; }
      graceT = {};
      if (st.summary.chapterDone) st.summary.chapterDone.strikesLeft = Math.max(0, CFG.maxStrikes - st.strikes);
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
      // v2m: o tipo de cada cruzamento hoje (a dica da manha e os robos leem daqui)
      st.kinds = {};
      if (typeof world.nodeTraffic === 'function') for (i = 0; i < ids.length; i++) {
        var kn = world.nodes[ids[i]];
        if (!kn || kn.edges.length < 3) continue;
        var kd = kindOf(world.nodeTraffic(kn.id), CFG);
        if (kd) st.kinds[ids[i]] = kd;
      }
      activeCards = [];
      st.cards = [];
      st.free.road = false; st.free.light = false;
      st.speed = st.speed || 1;
      if (st.strikes >= CAP || st.day >= CFG.maxDays) {
        var win = st.strikes < CAP;
        st.final = finalOf(win);
        st.phase = 'over';
        st.draft = null;
        refresh();
        emit({ type: 'phase', phase: 'over', failed: !!failed });
        emit({ type: 'over', win: win, retry: !!st.final.retry });
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
    // v2 (arquetipos): barreiras de terreno do arquetipo da partida (CFG.archetypes.<id>.terrain). Sem terreno: livre
    function crewNorm(c) {
      var A = Array.isArray(c && c.active) ? c.active.filter(function (x) { return nat(x) && x > 0 && x <= 60; }).slice(0, 10) : [];
      return { active: A, income: nat(c && c.income) ? c.income : 0, offer: !!(c && c.offer === true), hired: nat(c && c.hired) ? c.hired : 0, day: nat(c && c.day) ? c.day : 0 };
    }
    function archCfg() { return (CFG.archetypes && CFG.archetypes[st.archetype]) || {}; }
    // ponto dentro do terreno (agua ou parque): ali nao nasce no
    function terrainPt(P) {
      var A = archCfg();
      if (A.river && Math.abs(P.y) < A.river.half + 4) return false;
      // parque: o no fica a 20 ou mais da borda tracejada (uma rua colada no contorno se confundia com ele)
      if (A.park && Math.abs(P.x) < A.park.half + 20 && Math.abs(P.y) >= A.park.gapY - 20) return false;
      return true;
    }
    // segmento P->Q passa pelo terreno? (nos de ponta conferidos por terrainPt; aqui o meio)
    function terrainOk(P, Q) {
      var A = archCfg(), d1, d2, t;
      if (A.river) {
        var R = A.river, h = R.half;
        if (!terrainPt(Q) && Math.abs(Q.y) < h + 4) return false;
        d1 = P.y; d2 = Q.y;
        if ((d1 > -h - 4 && d1 < h + 4) || (d2 > -h - 4 && d2 < h + 4) || d1 * d2 < 0) {
          if (Math.abs(d1 - d2) < 1e-9) return false;            // ao longo da agua
          t = d1 / (d1 - d2);
          var xc = P.x + t * (Q.x - P.x), okb = false;
          for (var bi = 0; bi < R.bridges.length; bi++) if (Math.abs(xc - R.bridges[bi]) <= R.bridgeW) okb = true;
          // a ponte atravessa de frente (vertical, ou quase): rua em diagonal sobre a agua nao vale
          if (!okb || Math.abs(Q.x - P.x) > Math.abs(Q.y - P.y) * 0.5) return false;
        }
      }
      if (A.park) {
        var K = A.park;
        if (!terrainPt(Q)) return false;
        d1 = P.x; d2 = Q.x;
        if (d1 * d2 < 0 || Math.abs(d1) < K.half || Math.abs(d2) < K.half) {
          // cruza a faixa do parque: so pelo gargalo (|y| < gapY) e sem tocar o parque no caminho
          var steps = 12;
          for (var si = 0; si <= steps; si++) {
            var px = P.x + (Q.x - P.x) * si / steps, py = P.y + (Q.y - P.y) * si / steps;
            if (Math.abs(px) < K.half && Math.abs(py) >= K.gapY) return false;
          }
        }
      }
      return true;
    }
    // v2: lote em pe (CFG.growth.lot) e piso de distancia dos nos novos da cidade (CFG.growth.citySpacing)
    var growDay = 1;   // dia que o crescimento esta montando (grow(newDay))
    function inLot(Q, margin) {
      var L = CFG.growth && CFG.growth.lot;
      if (!L) return dist(Q.x, Q.y, 0, 0) <= CFG.worldRadius - margin;
      var a = L.rx - margin, b = L.ry - margin;
      return (Q.x * Q.x) / (a * a) + (Q.y * Q.y) / (b * b) <= 1;
    }
    function citySpacing() {
      var G = CFG.growth || {};
      if (!(G.citySpacing > 0)) return CFG.minNodeSpacing;
      if (G.earlySpacing && growDay <= G.earlySpacing.untilDay) return Math.max(CFG.minNodeSpacing, G.earlySpacing.d);
      return Math.max(CFG.minNodeSpacing, G.citySpacing);
    }
    function validateSeg(P, Q, ctx, qEx) {
      var len = dist(P.x, P.y, Q.x, Q.y);
      if (len < CFG.minRoadLen - 0.5 || len > CFG.maxRoadLen + 0.5) return false;
      if (!inLot(Q, 30)) return false;
      if (!terrainOk(P, Q)) return false;
      var SP = qEx ? CFG.minNodeSpacing : citySpacing();
      var ang = Math.atan2(Q.y - P.y, Q.x - P.x), i;
      for (i = 0; i < ctx.pts.length; i++) {
        var p = ctx.pts[i];
        if (dist(p.x, p.y, P.x, P.y) < 0.6) continue;
        var dq = dist(p.x, p.y, Q.x, Q.y);
        if (qEx && dq < 0.6) continue;
        if (dq < SP) return false;
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
      var HW = CFG.growth && CFG.growth.hardshipWeight != null ? CFG.growth.hardshipWeight : 1;
      for (i = 0; i < ids.length; i++) {
        var n = world.nodes[ids[i]];
        if (degree(n) >= 4) continue;
        var rr = dist(n.x, n.y, 0, 0) / CFG.worldRadius;
        if (n.portal) {   // ponta da borda tambem cresce (o portal anda para a ponta nova): peso pelo raio
          if (degree(n) === 1 && CFG.growPortal.fromPortal > 0) nodeC.push({ node: n, w: CFG.growPortal.fromPortal * rr });
          continue;
        }
        var w = (1 + 3 * HW * (hot[n.id] || 0)) / (1 + degree(n) * 0.5) * (1 + rr);   // HW: CFG.growth.hardshipWeight
        nodeC.push({ node: n, w: w });
      }
      ids = sortedIds(world.edges);
      for (i = 0; i < ids.length; i++) {
        var e = world.edges[ids[i]];
        if (e.len < 2 * citySpacing() + 8) continue;
        edgeC.push({ edge: e, w: (e.len / 100) * (1 + 2 * HW * Math.max(hot[e.a] || 0, hot[e.b] || 0)) });
      }
      var useEdge = edgeC.length > 0 && (nodeC.length === 0 || R() < edgeBias);
      if (useEdge) {
        var e2 = edgeC[Rweighted(edgeC.map(function (c) { return c.w; }))].edge;
        var a = world.nodes[e2.a], b = world.nodes[e2.b];
        var lo = (citySpacing() + 2) / e2.len, hi = 1 - lo;
        var t = lo + (hi - lo) * R();
        var P = { x: r1(a.x + t * (b.x - a.x)), y: r1(a.y + t * (b.y - a.y)) };
        for (i = 0; i < ctx.pts.length; i++) {
          if (dist(ctx.pts[i].x, ctx.pts[i].y, P.x, P.y) < citySpacing() + 1) return null;
        }
        if (!terrainPt(P)) return null;
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
      // integracao (o mesmo conserto achado tambem em v2m): no teto de nos (v2c) o filho planejado pode ser recusado e o no do meio ficava como beco (1 rua, sem
      // portal: nenhum carro entra nem sai). Ele vira o portal fraco de qualquer ponta nova sem filho
      for (i = 0; i < endIds.length; i++) {
        var en = endIds[i] !== null && endIds[i] !== undefined ? world.nodes[endIds[i]] : null;
        if (en && !en.portal && en.edges.length === 1 && typeof world.setPortal === 'function')
          world.setPortal(en.id, true, CFG.growPortal.weakRate > 0 ? CFG.growPortal.weakRate : undefined);
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
        for (var i = 0; i < ctx.pts.length; i++) if (dist(ctx.pts[i].x, ctx.pts[i].y, src.P.x, src.P.y) < citySpacing() + 1) return 0;
        if (!terrainPt(src.P)) return 0;
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
        if (e.len < 2 * citySpacing() + 8) continue;
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
        if (!e || e.len < 2 * citySpacing() + 8) continue;
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
      if (TEACH.carsPerPat > 0) {   // v2: rajada pela paciencia do dia (mesma conta do sim.js patNow)
        var pd = CFG.patienceDay && CFG.patienceDay[st.day - 1], pm = (world.params && world.params.patienceMul) || 1;
        var patD = CFG.patience * (pd > 0 ? pd : 1) * pm;
        n = Math.round(TEACH.carsPerPat * patD);
        n = Math.max(TEACH.convoyMin, Math.min(TEACH.convoyMax, n));
        var top = TEACH.topUp > 0 ? Math.round(TEACH.topUp * patD) : 0;
      }
      // v2: cada carro da rajada vai a um destino cujo caminho passa pelo alvo (com uma rua do jogador a mais, o sorteio
      // do destino mandava a maior parte para longe do T e o anel nao acendia)
      var pairs = [];
      srcs.slice(0, TEACH.maxSrc).forEach(function (x) {
        var ds = Object.keys(pp.paths[x.id]).map(Number).sort(function (a, b) { return a - b; });
        ds.forEach(function (dd) { if (pp.paths[x.id][dd].indexOf(target.id) >= 0 && dd !== target.id) pairs.push({ src: x.id, dest: dd }); });
      });
      return { target: target.id, srcs: srcs.slice(0, TEACH.maxSrc).map(function (x) { return x.id; }), pairs: pairs, left: n, total: n, k: 0, top: top || 0, endAt: -1 };
    }
    function convoyStep() {
      if (!convoy || st.dayTime > TEACH.window) return;
      if (convoy.left <= 0) {
        if (!(convoy.top > 0)) return;
        if (convoy.endAt < 0) convoy.endAt = st.dayTime;
        var tt = world.nodes[convoy.target], sv = tt ? tt.stress || 0 : 1;
        convoy.pk = Math.max(convoy.pk || 0, sv);
        if (sv >= TEACH.jamAt) { convoy.top = 0; return; }               // o anel chegou: nada a mais
        if (st.dayTime < convoy.endAt + TEACH.topAt) return;
        if (!(sv < TEACH.topBelow && sv < convoy.pk - 0.03)) return;      // so com a fila ja descendo abaixo de topBelow
        convoy.left = convoy.top; convoy.total += convoy.top; convoy.top = 0;
      }
      // v2: rajada com ritmo (um carro a cada TEACH.gap s de jogo): o anel tem tempo de subir e a rajada para no stopAt
      if (TEACH.gap > 0 && convoy.next !== undefined && st.dayTime < convoy.next) return;
      var tn = world.nodes[convoy.target];
      if (tn && (tn.stress || 0) >= TEACH.stopAt) { convoy.left = 0; return; }   // o anel apareceu: para a rajada
      // rajada: um carro por passo no maximo; alterna as fontes (o Sim recusa sem espaco, sem sobrepor)
      var pr = convoy.pairs && convoy.pairs.length ? convoy.pairs[convoy.k % convoy.pairs.length] : null;
      var sid = pr ? pr.src : convoy.srcs[convoy.k % convoy.srcs.length];
      convoy.k++;
      if (typeof world.sendCar === 'function' && world.sendCar(sid, pr ? { dest: pr.dest } : undefined)) { convoy.left--; st.teach.sent++; convoy.next = st.dayTime + (TEACH.gap || 0); }
    }

    // v2: teto de nos do crescimento (CFG.growth.nodeCap): durante grow() o mundo recusa no novo acima do teto
    var ringMode = false;
    function capOf(day) { var f = CFG.growth && CFG.growth.nodeCap; return typeof f === 'function' ? f(day) : (Array.isArray(f) ? f[Math.min(f.length, day) - 1] : Infinity); }
    function nodeCount() { return Object.keys(world.nodes).length; }
    function grow(newDay) {
      growDay = newDay;
      var cap = capOf(newDay), add0 = world.addNode, split0 = world.splitEdge;
      var AC = (CFG.growth && CFG.growth.afterCap) || {}, hard = Math.max(cap, AC.ringCap || cap);
      if (isFinite(cap)) {
        // o canto de um anel (rua nova entre dois nos que ja existem) pode passar do teto ate ringCap: e mudanca por
        // dentro, nao crescimento para fora
        world.addNode = function (x, y, o) { return nodeCount() >= (ringMode ? hard : cap) ? null : add0.call(world, x, y, o); };
        world.splitEdge = function (e, x, y) { return nodeCount() >= cap ? null : split0.call(world, e, x, y); };
      }
      try { return growIn(newDay, cap); } finally { world.addNode = add0; world.splitEdge = split0; growDay = st.day; }
    }
    // no teto: o dia muda por dentro (CFG.growth.afterCap). Ponta fraca vira cheia e a cheia menos usada vira fraca
    var shiftDay = 0;
    function shiftDemand(newDay, made) {
      var A = CFG.growth && CFG.growth.afterCap, k = sortedIds(world.nodes), weak = [], full = [], i;
      if (!A || !(A.shiftEvery > 0) || typeof world.setPortal !== 'function') return null;
      if (shiftDay && newDay - shiftDay < A.shiftEvery) return null;
      for (i = 0; i < k.length; i++) {
        var n = world.nodes[k[i]];
        if (!n.portal || made.indexOf(n.id) >= 0) continue;
        if (n.rate === CFG.growPortal.weakRate) weak.push(n); else if (!(n.rate > 0 && n.rate < 1)) full.push(n);
      }
      if (!weak.length || full.length < 3) return null;
      var up = weak[Math.floor(R() * weak.length)];
      // a cheia que vira fraca: a de menor pico de ontem (empate: a mais perto do centro, depois o menor id)
      full.sort(function (a, b) { return ((hot[a.id] || 0) - (hot[b.id] || 0)) || (dist(a.x, a.y, 0, 0) - dist(b.x, b.y, 0, 0)) || (a.id - b.id); });
      var down = full[0];
      world.setPortal(up.id, true);
      world.setPortal(down.id, true, CFG.growPortal.weakRate);
      shiftDay = newDay;
      return { up: up.id, down: down.id };
    }
    function growIn(newDay, cap) {
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
      var full = nodeCount() >= cap, AC = (CFG.growth && CFG.growth.afterCap) || {};
      if (newDay >= GR.fromDay) {   // aneis: ligam nos ja existentes e criam cruzamentos novos sem sinal
        var rings = GR.base + (R() < GR.extraP ? 1 : 0) + (newDay >= GR.lateDay ? 1 : 0) + (full ? (AC.rings | 0) : 0);
        ringMode = full;
        for (var i = 0; i < rings; i++) growRing(created);
        ringMode = false;
      }
      var shift = full ? shiftDemand(newDay, created) : null;
      if (shift) emit({ type: 'shift', up: shift.up, down: shift.down });
      // garantias da primeira viagem: um T ate o dia 3, e um cruzamento de 4 ou dois T proximos ate o 5.
      // So consome rng quando a garantia falta (cidades que ja cumprem crescem exatamente igual).
      if ((newDay === 3 || newDay === TEACH.day) && !teesOf().length) ensureTee(created);
      if (newDay === 5 && !lightSpot()) ensureLightSpot(created);
      emit({ type: 'grow', nodeIds: created });
      return created;
    }

    function advance(card) {
      var left = st.budget;
      // v2: carta de escolha = efeito permanente (st.perks), nao carta do dia seguinte
      if (card && choiceIds().indexOf(card) >= 0) {
        st.perks.chosen = card;
        if (card === 'round') st.perks.round = true;
        if (card === 'freePower') st.perks.freePower = (st.perks.freePower | 0) + 1;
        emit({ type: 'perk', perk: card });
        card = null;
      } else if (st.draft && CFG.choiceCard && st.day === CFG.choiceCard.day) st.perks.chosen = 'skip';
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
               die: st.die ? clone(st.die) : null, rerolled: st.rerolled,
               watch: st.watch && st.watch.day === st.day ? clone(st.watch.list) : [], crew: clone(st.crew) };
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
    var g = { world: world, state: st, migrated: !!(saved && saved.migrated) };

    g.cost = costOf;
    g.canAfford = function (tool) { return isUnlocked(tool) && st.budget >= costOf(tool) && (tool !== 'light' || lightsUsed() < lightCap()); };
    // v2m: { used, cap } dos semaforos (cap Infinity sem a regra)
    g.lightCap = function () { return { used: lightsUsed(), cap: lightCap() }; };

    // ----- v2x: 'e se' do conselho da manha -----
    // Playtest cego 5: o conselho mandava semaforo pelo tipo do cruzamento e o resumo do dia seguinte mostrava a espera
    // mais longa PIOR (12 s -> 19 s): o ciclo fixo deixa um carro parado o vermelho inteiro. Agora o conselho joga o dia
    // que acabou de novo (a manha de hoje, o mesmo trafego: a repeticao e exata) com cada peca no cruzamento e compara
    // o numero que o resumo vai mostrar (w, a espera mais longa), o anel (p) e a trava. ~20 ms por ramo no node.
    function capAt(day) {
      var LC = CFG.lightCap; if (!LC || !LC.byDay) return Infinity;
      var c = 0; for (var i = 0; i < LC.byDay.length; i++) if (day >= LC.byDay[i][0]) c = LC.byDay[i][1];
      return c + (LC.perkPlus ? (st.perks && st.perks.freePower | 0) * LC.perkPlus : 0);
    }
    function openAt(tool, day) {
      if (!own(CFG.tools, tool) || CFG.tools[tool].removed) return false;
      if (tool === 'round' && st.perks && st.perks.round) return true;
      return day >= CFG.tools[tool].unlockDay;
    }
    function branchDay(id, tool, mul) {
      var lc = CFG.lightCap, out = null;
      BRANCHING = true;
      try {
        var b = CRZ.Game.load(morning.save); if (!b) return null;
        var bw = b.world, nd = bw.nodes[id]; if (!nd) return null;
        CFG.lightCap = null;
        if ((nd.tool || null) !== tool) bw.setTool(id, tool);
        b.startDay();
        CFG.lightCap = lc;
        if (mul > 0 && mul !== 1 && bw.params) bw.params.spawnMul = (bw.params.spawnMul > 0 ? bw.params.spawnMul : 1) * mul;
        var lock = false, steps = 0, max = Math.ceil(b.state.dayLen / STEP) * 3 + 200;
        while (b.state.phase === 'run' && steps++ < max) { b.update(STEP); if (bw.nodes[id] && bw.nodes[id].locked) lock = true; }
        var sm = b.state.summary || {}, tr = b.state.trouble && b.state.trouble.nodes && b.state.trouble.nodes[id];
        if (sm.lock && sm.lock.nodeId === id) lock = true;
        out = { w: tr ? tr.w : 0, p: tr ? tr.p : 0, lock: lock, cut: !!sm.failed && !lock };
      } catch (e) { out = null; } finally { CFG.lightCap = lc; BRANCHING = false; }
      return out;
    }
    var WI_TOOLS = ['stop', 'yield', 'light', 'round'];
    // g.whatIf(id): { day, tool (o de hoje), cur {w,p,lock}, alt { peca: {w,p,lock} } } para um cruzamento do dia que
    // acabou (fase summary). Guardado em st.whatIf (vai no save): a manha seguinte le dali. null sem a manha na memoria.
    g.whatIf = function (id) {
      id = +id;
      var C = st.whatIf && st.whatIf.nodes ? st.whatIf.nodes[id] : null;
      if (C && st.whatIf.day === (st.phase === 'summary' || st.phase === 'over' ? st.day : st.day - 1)) return C;
      if (st.phase !== 'summary' || !morning || morning.day !== st.day || BRANCHING) return null;
      var n = world.nodes[id]; if (!n || n.portal || degree(n) < 3) return null;
      if (!st.whatIf || st.whatIf.day !== st.day) st.whatIf = { day: st.day, nodes: {} };
      var cur = n.tool || null, d1 = st.day + 1, room = cur === 'light' || lightsUsed() < capAt(d1);
      // duas medidas por peca: o dia de ontem como foi e o mesmo dia com hi vezes os carros (a cidade cresce: a peca
      // mandada precisa ganhar nos dois, senao o numero de amanha desmente o conselho)
      var hi = (CFG.advice && CFG.advice.hi) || 1.2;
      var r = { day: st.day, tool: cur, cur: branchDay(id, cur), curHi: branchDay(id, cur, hi), alt: {}, altHi: {} };
      if (!r.cur || !r.curHi) return null;
      for (var i = 0; i < WI_TOOLS.length; i++) {
        var t = WI_TOOLS[i];
        if (t === cur || !openAt(t, d1) || (t === 'light' && !room)) continue;
        var b = branchDay(id, t), bh = b ? branchDay(id, t, hi) : null; if (b && bh) { r.alt[t] = b; r.altHi[t] = bh; }
      }
      st.whatIf.nodes[id] = r;
      return r;
    };
    // g.adviceFor(id): a peca que o conselho manda para o cruzamento amanha, decidida pelo 'e se':
    //  { tool: 'stop'|'yield'|'light'|'round', from, w0, w1 } (a peca nova ganha no numero do resumo) ou
    //  { tool: null, best: true } (nada ganha de verdade: o cruzamento ja da o que pode). null sem 'e se'.
    // Regras (CFG.advice): a peca nova nao trava onde a de hoje nao travou, nao sobe o anel mais que pTol, e baixa a
    // espera mais longa em gain (fracao) e minS segundos. Estavel: depois de seguida, so outra peca com mudanca
    // material do trafego (tipo mudou, ou carros/min mudaram mais que material) e ganho maior (gainChanged); nunca
    // volta a uma peca que ja saiu dali pelo conselho (sem vai e volta).
    g.adviceFor = function (id) {
      id = +id;
      var r = g.whatIf(id); if (!r) return null;
      var A = CFG.advice || {}, n = world.nodes[id], kd = st.kinds && st.kinds[id];
      if (!st.adv) st.adv = {};
      var m = st.adv[id], dayK = r.day;
      if (m && m.at === dayK && m.res) return m.res;
      var followed = m && m.tool && n && (n.tool || null) === m.tool && m.from !== m.tool;
      var material = !m || !kd || !m.k || kd.k !== m.k || (m.v > 0 && Math.abs(kd.v - m.v) > m.v * (A.material || 1 / 3));
      var gain = followed ? (A.gainChanged || 0.4) : (A.gain || 0.25), tried = (m && m.tried) || [];
      var c = r.cur, best = null, bw = Infinity;
      function wins(a, c) {
        if (!a || !c || a.cut || (a.lock && !c.lock)) return false;
        if (a.p > c.p + (A.pTol || 0.05) && !(c.lock && !a.lock)) return false;
        return c.lock && !a.lock ? a.w <= c.w : (a.w <= c.w * (1 - gain) && c.w - a.w >= (A.minS || 2));
      }
      if (!(followed && !material)) for (var t in r.alt) {
        if (!own(r.alt, t) || tried.indexOf(t) >= 0) continue;
        // conselho de ontem ainda nao seguido e o trafego igual: so ele pode voltar (nunca outra peca no dia seguinte)
        if (m && m.tool && !followed && !material && m.at !== dayK && t !== m.tool) continue;
        var a = r.alt[t];
        var ok = wins(a, c) && (!r.altHi || !r.curHi || wins(r.altHi[t], r.curHi));
        // peca que o conselho ja mandou ontem e segue valida: fica (o conselho nao troca por um ganho pequeno a mais)
        var w = a.w - (m && m.tool === t && !followed ? 1e6 : 0);
        if (ok && w < bw) { bw = w; best = t; }
      }
      var res = best ? { tool: best, from: r.tool, w0: c.w, w1: r.alt[best].w } : { tool: null, best: true, from: r.tool, w0: c.w };
      var nt = tried.slice();
      if (best && followed && m.from && nt.indexOf(m.from) < 0) nt.push(m.from);
      if (best && r.tool && nt.indexOf(r.tool) < 0 && followed) nt.push(r.tool);
      st.adv[id] = best || !m ? { tool: best || (m && m.tool) || null, from: r.tool, at: dayK, k: kd ? kd.k : null, v: kd ? kd.v : 0, tried: nt, res: res }
                             : { tool: m.tool, from: m.from, at: dayK, k: m.k, v: m.v, tried: nt, res: res };
      if (best && (!followed || material)) { st.adv[id].k = kd ? kd.k : null; st.adv[id].v = kd ? kd.v : 0; }
      return res;
    };
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
      if (tool === 'light' && lightsUsed(nodeId) >= lightCap()) return fail('cap');   // v2m: a cidade nao liga mais um
      var refund = placed[nodeId] || 0, c = costOf(tool);
      if (st.budget + refund < c) return fail('budget');
      var entry = capture();
      if (n.pair !== null && n.pair !== undefined && tool !== 'light') world.unpair(nodeId);
      world.setTool(nodeId, tool);
      var pairedWith = null;
      autoPair();                                   // v2: par automatico (o vizinho de um semaforo trocado pega outro)
      if (tool === 'light') pairedWith = n.pair;
      if (tool === 'light' && st.free.light) st.free.light = false;
      st.budget = st.budget + refund - c;
      placed[nodeId] = c;
      undoStack.push(entry);
      refresh();
      emit({ type: 'built', x: n.x, y: n.y, kind: tool });
      var pres = { ok: true, id: nodeId }, pw = watchOn(nodeId, tool);
      if (pw) pres.watched = pw;   // 'new': o cruzamento do anel de ontem passa a ser vigiado hoje
      if (pairedWith !== null && pairedWith !== undefined) { pres.paired = pairedWith; emit({ type: 'paired', a: nodeId, b: pairedWith }); }
      return pres;
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
      if (n.tool === null) autoPair();   // o vizinho que ficou sem par pega outro
      st.budget += placed[nodeId] || 0;
      delete placed[nodeId];
      undoStack.push(entry);
      syncWatch();
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
      // Two lanes numa rua que chega a um cruzamento com o anel de ontem: vigia a ponta mais quente
      var wa = +st.hot[a.id] || 0, wb = +st.hot[b.id] || 0, wn = wa >= wb ? a : b, ures = { ok: true, id: edgeId };
      if (degree(wn) >= 3) { var uw = watchOn(wn.id, 'upgrade'); if (uw) { ures.watched = uw; ures.watchId = wn.id; } }
      if (!ures.watched && degree(wn === a ? b : a) >= 3) { var uo = watchOn((wn === a ? b : a).id, 'upgrade'); if (uo) { ures.watched = uo; ures.watchId = (wn === a ? b : a).id; } }
      return ures;
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
      // dado v2: o Undo desfaz obras, nunca a escolha do dado (shiftUndo ja ajustou os pontos das fotos)
      // vigiados como estavam antes da acao desfeita (entrada de save antigo sem o campo: so tira o que perdeu a peca)
      if (Array.isArray(e.watch)) { var nw = normWatch({ day: st.day, list: e.watch }); st.watch = nw || { day: st.day, list: [] }; }
      syncWatch();
      if (e.crew && typeof e.crew === 'object') st.crew = crewNorm(e.crew);
      refresh();
      return { ok: true };
    };

    // ----- dado v2 (API publica) -----
    // relance saiu (sistemas.md 3.2: com Pass gratis, relancar era um segundo premio sem decisao)
    g.canReroll = function () { return false; };
    g.rerollDie = function () { return { ok: false, reason: 'gone', die: st.die ? clone(st.die) : null }; };
    // o que a manha do dado permite agora (para a UI e os robos)
    g.diceInfo = function () {
      var t = tierOf(st.day);
      return { tier: t, chapter: chapterOfDay(st.day), state: st.dieState, canRoll: needPlan() && !!t && st.dieState === 'none',
        offers: !!t && t !== 'gift', canKeep: st.dieState === 'offer' && canKeepToday(), kept: st.kept ? clone(st.kept) : null,
        canPlayKept: needPlan() && !!t && st.dieState === 'none' && !!st.kept, debtPaid: st.debtPaid || 0, debt: st.debt || 0,
        keepFrom: DC().keepFrom, firstOffer: DC().firstOffer, costFrom: DC().costFrom };
    };
    // toque do jogador: sorteia a face (semente + dia), guarda e devolve. Face sem escolha ja vale; oferta espera
    g.rollDie = function () {
      if (!needPlan()) return fail('phase');
      if (!tierOf(st.day)) return fail('day');
      if (st.dieState !== 'none') return { ok: false, reason: 'rolled', die: st.die ? clone(st.die) : null };
      st.die = drawFace(st.day);
      if (st.die.offer) st.dieState = 'offer';
      else { st.dieState = 'auto'; useFace(st.die); }
      dieEvent();
      return { ok: true, die: clone(st.die), offer: st.dieState === 'offer' };
    };
    function decide(next) {
      if (!needPlan()) return fail('phase');
      if (st.dieState !== 'offer' || !st.die) return fail('state');
      if (next === 'kept' && !canKeepToday()) return fail('keep');
      if (next === 'used') useFace(st.die);
      if (next === 'kept') st.kept = { id: st.die.id, value: st.die.value };
      st.dieState = next;
      dieEvent();
      return { ok: true, state: next, die: clone(st.die) };
    }
    g.useDie = function () { return decide('used'); };
    g.passDie = function () { return decide('passed'); };
    g.keepDie = function () { return decide('kept'); };
    // a face do bolso no lugar de rolar: vale na hora (a escolha foi feita quando guardou)
    g.playKept = function () {
      if (!needPlan()) return fail('phase');
      if (!tierOf(st.day) || st.dieState !== 'none' || !st.kept) return fail('state');
      st.die = makeFace(st.kept.id, st.kept.value, st.day);
      st.kept = null; st.dieState = 'used'; st.dieFromKept = true;
      useFace(st.die);
      dieEvent();
      return { ok: true, die: clone(st.die) };
    };
    // a previsao de amanha: o evento com o lugar, quando o sistema de eventos existe; nunca o dado
    g.forecast = function () {
      var E = EV();
      if (!E || typeof E.tomorrow !== 'function' || st.day >= CFG.maxDays) return null;
      try { var t = E.tomorrow(g); return t ? clone(t) : null; } catch (e) { return null; }
    };
    g.chapterOf = chapterOfDay;
    g.dicePool = function (day) { return poolOf(day || st.day).map(function (x) { return x.id; }); };
    // so testes e capturas: a proxima rolagem cai nesta face
    g.debugForceFace = function (id, value) { forced = faceDef(id) ? { id: id, value: value || 1 } : null; return !!forced; };

    // a face que vale hoje: usada, sem escolha, ou o dado de um save antigo (ja aplicado). Passada ou guardada: nenhuma
    function dieLive() { return !!st.die && (st.dieState === 'used' || st.dieState === 'auto' || (st.dieState === undefined && !isV2Face(st.die))); }
    // ----- Road crew -----
    g.hireCrew = function () {
      var C = CFG.crew, cr = st.crew;
      if (!needPlan()) return fail('phase');
      if (!C || !cr.offer) return fail('offer');
      if (st.budget < C.cost) return fail('budget');
      var entry = capture();
      st.budget -= C.cost; cr.active.push(C.days); cr.hired++; cr.offer = false;
      undoStack.push(entry);
      refresh();
      emit({ type: 'crew', active: cr.active.length });
      return { ok: true, active: cr.active.length };
    };
    g.declineCrew = function () { if (!needPlan()) return fail('phase'); st.crew.offer = false; return { ok: true }; };

    // ----- fluxo -----
    g.startDay = function () {
      if (st.phase !== 'plan') return fail('phase');
      // v2x: a manha de hoje (so na memoria) para o 'e se' do resumo (g.whatIf): o mesmo dia, outra peca num cruzamento
      if (!BRANCHING) { morning = saveCore(); delete morning.undo; morning = { day: st.day, save: morning }; }
      // oferta sem resposta ao comecar o dia: passou (nada aplicado). So face usada ou sem escolha mexe no dia
      if (st.dieState === 'offer') { st.dieState = 'passed'; dieEvent(); }
      var o = (dieLive() && st.die.effect) || {};
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
      // Festival usado: a rua marcada manda festivalMul vezes mais carros (so com o Sim que honra portalMul)
      delete p.portalMul;
      if (o.festivalMul && diceFeature('festival', st.day)) {
        try { var spot = EV().festivalSpot(g, st.day); p.portalMul = {}; p.portalMul[spot] = o.festivalMul; } catch (e) {}
      }
      // eventos de lugar do dia: rua fechada (params.closed) e janelas de carros a mais (params.portalMul)
      st.dayLen = CFG.dayLen[st.day - 1];
      if (EVM() && st.events) EVM().applyDay(g);
      st.dayTime = 0;
      st.dayLen = CFG.dayLen[st.day - 1];
      st.phase = 'run';
      st.paused = false;
      st.ff = false;
      st.tips = 0; syncDial();
      st.crew.offer = false;   // a oferta e so desta manha
      convoy = (teachOn && !teachSeen && st.day === TEACH.day) ? planConvoy() : null;
      st.teach.day3Convoy = !!convoy;   // nome antigo (o comboio era do dia 3); jam e o nome v2
      st.teach.jam = !!convoy;
      st.teach.sent = 0;
      st.teach.target = convoy ? convoy.target : null;   // cruzamento que o tutorial aponta
      if (convoy) p.spawnMul = Math.min(p.spawnMul, TEACH.spawnCap) * TEACH.spawnMul / (st.day === 2 && CFG.day2Mul > 0 ? CFG.day2Mul : 1);
      jamHoldSeen = false; jamHeld = 0; jamQuiet = 0;
      syncModes(CFG.clear.charges);                // cargas renovadas a cada dia
      darkenLights();                              // v2: semaforos sem manutencao paga ficam apagados hoje
      undoStack = [];
      acc = 0; stepCount = 0; dayFailed = false; runHot = {}; runFull = {}; lockNear = 0; st.hot = {};
      runAt = {}; runWait = {}; runPass = {}; runTrace = {};
      graceT = {}; st.freeJams = 0;
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
      if (n.locked && graceT[n.id] !== undefined) releaseJam(n.id);   // jam livre: o Boost destrava e escoa
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
    // a cena do dia 2: o fim do dia espera a fila do T sumir (TEACH.holdMax); so depois de o anel ter ficado vermelho
    var jamHoldSeen = false, jamHeld = 0, jamQuiet = 0;
    function jamHold() {
      if (!st.teach.jam || st.teach.target === null || !(TEACH.holdMax > 0)) return false;
      var tn = world.nodes[st.teach.target];
      if (!tn) return false;
      if ((tn.stress || 0) >= TEACH.jamAt) jamHoldSeen = true;
      if (!jamHoldSeen || jamHeld >= TEACH.holdMax) return false;
      // espera o anel ficar abaixo de holdBelow por holdQuiet s (o tutorial diz 'Nice' com a fila sumida); jamQuiet
      // conta a cada passo depois do vermelho (frame)
      return jamQuiet < TEACH.holdQuiet;
    }
    function frame(dt) {
      if (st.phase !== 'run' || st.paused || !(dt > 0)) return;
      acc += dt * st.speed;
      if (acc > 4) acc = 4;
      while (acc >= STEP && st.phase === 'run') {
        acc -= STEP;
        convoyStep();
        if (st.events && EVM()) { var eo = EVM().tick(g); if (eo) emit(eo); }
        world.step(STEP);
        if (st.teach.jam && st.teach.target !== null && TEACH.capAt > 0 && typeof world.capStress === 'function') world.capStress(st.teach.target, TEACH.capAt);
        if (st.teach.jam && st.teach.target !== null) {
          var jn0 = world.nodes[st.teach.target], js0 = jn0 ? jn0.stress || 0 : 0;
          if (js0 >= TEACH.jamAt) jamHoldSeen = true;
          if (jamHoldSeen) jamQuiet = js0 < TEACH.holdBelow ? jamQuiet + STEP : 0;
        }
        st.dayTime += STEP;
        stepCount++;
        // todo evento do sim segue para a UI (onEvent), inclusive { type: 'lost', nodeId, lost }: um carro
        // desistiu no portal nodeId (mao unica sem saida); lost = total do dia. summary.lost guarda o total.
        var evs = world.drainEvents() || [];
        for (var i = 0; i < evs.length; i++) {
          emit(evs[i]);
          if (evs[i].type === 'gridlock') { lockInfo(evs[i].nodeId); if (graceDay(st.day)) freeJam(evs[i].nodeId); else dayFailed = true; }
          else if (evs[i].type === 'arrive' && !evs[i].noTip) st.tips += rewardNow();
          else if (evs[i].type === 'pass') runPass[evs[i].nodeId] = (runPass[evs[i].nodeId] | 0) + 1;
        }
        if (stepCount % 10 === 0) {
          var ids = sortedIds(world.nodes);
          for (var j = 0; j < ids.length; j++) {
            var n = world.nodes[ids[j]];
            if ((n.stress || 0) > (runHot[ids[j]] || 0)) { runHot[ids[j]] = n.stress; runAt[ids[j]] = st.dayTime; }
            if ((n.stress || 0) >= 1 && !n.locked) { runFull[ids[j]] = (runFull[ids[j]] || 0) + 10 * STEP; lockNear = Math.max(lockNear, runFull[ids[j]] / (CFG.lockSeconds || 8)); } else if (!n.locked) runFull[ids[j]] = 0;
            var wq = waitNow(ids[j], n);
            if (wq > (runWait[ids[j]] || 0)) runWait[ids[j]] = wq;
            if (stepCount % TRACE_EVERY === 0) (runTrace[ids[j]] || (runTrace[ids[j]] = [])).push(Math.round(Math.min(1, n.stress || 0) * 100));
            if ((runHot[ids[j]] || 0) >= HOT_MIN) st.hot[ids[j]] = Math.min(1, runHot[ids[j]]);
          }
        }
        syncDial();
        if (dayFailed) { endFF('strike'); finishDay(true); }
        else if (st.dayTime >= st.dayLen - 1e-9 && jamHold()) { st.dayLen += STEP; jamHeld += STEP; tickRegen(STEP); tickGrace(STEP); }
        else if (st.dayTime >= st.dayLen - 1e-9) { endFF('day'); finishDay(false); }
        else { tickRegen(STEP); tickGrace(STEP); if (st.ff && hotNow()) endFF('ring'); }
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

    // pilha do Undo para o save: so no plano (no run ela ja foi zerada); das mais novas para as mais antigas ate o teto
    function undoForSave() {
      if (st.phase !== 'plan' || !undoStack.length) return undefined;
      var list = [], chars = 40, i, n;
      for (i = undoStack.length - 1; i >= 0 && list.length < UNDO_MAX; i--) {
        n = JSON.stringify(undoStack[i]).length + 1;
        if (chars + n > UNDO_CHARS) break;
        chars += n; list.unshift(undoStack[i]);
      }
      return list.length ? { day: st.day, list: list } : undefined;
    }
    // mapa de anel no save: no meio do dia o st.hot e o de hoje pela metade (o load volta a manha); a manha precisa
    // dos aneis de ontem, que o registro (st.trouble) guarda
    function hotForSave() {
      if (st.phase !== 'run' || !st.trouble || st.trouble.day !== st.day - 1) return st.hot;
      var out = {}, k, nd = st.trouble.nodes || {};
      for (k in nd) if (own(nd, k) && nd[k].p >= HOT_MIN) out[k] = Math.min(1, nd[k].p);
      return out;
    }
    g.save = function () {
      var o = saveCore();
      if (checkpoint) o.checkpoint = clone(checkpoint);
      return o;
    };
    // v2 (D9): derrota com checkpoint -> o save da manha do primeiro dia do capitulo, com a volta contada e os strikes
    // cheios; o resto (cidade, pontos, dado, cartas, historico) e o daquela manha. null sem volta oferecida.
    g.retrySave = function () {
      if (st.phase !== 'over' || !st.final || !st.final.retry || !checkpoint || CFG.ironMode) return null;
      var d = clone(checkpoint);
      d.st.chapterRetries = st.chapterRetries + 1;
      d.st.strikes = 0;
      d.st.freeJamSeen = !!(st.freeJamSeen || d.st.freeJamSeen);
      d.checkpoint = clone(checkpoint);
      return d;
    };
    g.retryChapter = function () { var d = g.retrySave(); return d ? CRZ.Game.load(d) : null; };
    function saveCore() {
      var snap = world.snapshot();
      // corrida: o save volta a manha do dia; os semaforos apagados hoje voltam a ser semaforos na foto
      if (darkNow.length) snap.nodes.forEach(function (sn) { if (darkNow.indexOf(sn.id) >= 0 && !sn.tool) sn.tool = 'light'; });
      return clone({
        v: 1, fmt: SAVE_FMT, diff: CFG.difficultyName, seed: seed, rngCalls: rngCalls, world: snap,
        st: {
          day: st.day, phase: st.phase === 'run' ? 'plan' : st.phase, budget: st.budget,
          strikes: st.strikes, speed: st.speed, die: st.die, nextDie: st.nextDie, rerolled: st.rerolled,
          dieState: st.dieState, kept: st.kept, debt: st.debt || 0, debtPaid: st.debtPaid || 0, dieFromKept: !!st.dieFromKept,
          free: st.free, summary: st.summary,
          draft: st.draft, totalDelivered: st.totalDelivered, totalScore: st.totalScore,
          history: st.history, dayTime: st.phase === 'run' ? 0 : st.dayTime,
          clearSeen: clearSeen, teachOn: teachOn, teachSeen: teachSeen,
          teach: st.phase === 'run' ? { day3Convoy: false, jam: false, seen: teachSeen, target: null, sent: 0 } : st.teach, tipCarry: st.tipCarry, speedBonus: st.speedBonus,
          speedApplied: st.speedDial.applied, lastLock: lastLock,
          // retorno da escolha (v2): registro do ultimo dia e vigiados (o reload no meio do dia volta a manha com eles)
          trouble: st.trouble, watch: st.watch, watchPrev: st.watchPrev,
          chapterCars0: st.chapterCars0, chapterRetries: st.chapterRetries, freeJamSeen: st.freeJamSeen,
          // eventos de lugar (v2e): calendario, lugares, tamanho (face Big game) e o que ja foi visto
          events: EVM() && st.events ? EVM().forSave(g) : undefined
        },
        cards: activeCards, placed: placed, hot: hot, hotMap: hotForSave(), undo: undoForSave(),
        // v2c: manutencao, escolhas da partida, forma da cidade, dia da mudanca por dentro e Road crew
        upkeep: st.upkeep, perks: st.perks, archetype: st.archetype, shiftDay: shiftDay, crew: st.crew,
        // v2m: forma de cada cruzamento (calm, main, even, heavy) que o conselho da manha le
        kinds: st.kinds,
        // v2x: o 'e se' do dia que acabou e a memoria do conselho por cruzamento (estavel entre dias e reloads)
        whatIf: st.whatIf || undefined, adv: st.adv || undefined
      });
    }

    // ----- inicializacao -----
    if (saved) {
      world.restore(saved.world);
      var s = saved.st;
      st.day = s.day; st.phase = s.phase; st.budget = s.budget; st.strikes = s.strikes;
      st.speed = speedOk(s.speed) ? s.speed : CFG.speedDial.defaultSpeed; st.die = normDie(s.die, st.day); st.free = { road: !!s.free.road, light: !!s.free.light };
      st.rerolled = false; st.nextDie = null;   // dado v2: sem relance e sem previsao do dado
      // dado v2: estado da manha. Save antigo (sem dieState): o dado dele ja estava aplicado, entao vale como 'auto'
      st.dieState = DIE_STATES[s.dieState] ? s.dieState : (st.die ? 'auto' : 'none');
      if (st.dieState !== 'none' && !st.die) st.dieState = 'none';
      if (st.dieState === 'none') st.die = null;
      st.kept = keptOk(s.kept) ? { id: s.kept.id, value: s.kept.value } : null;
      st.debt = nat(s.debt) ? s.debt : 0; st.debtPaid = nat(s.debtPaid) ? s.debtPaid : 0; st.dieFromKept = s.dieFromKept === true;
      st.summary = s.summary === undefined ? null : s.summary;
      // lost sobrevive ao save/load como inteiro >= 0 (save antigo sem o campo: 0)
      if (st.summary && typeof st.summary === 'object') st.summary.lost = (fin(st.summary.lost) && st.summary.lost > 0) ? Math.floor(st.summary.lost) : 0;
      st.draft = s.draft === undefined ? null : s.draft; st.totalDelivered = s.totalDelivered;
      st.totalScore = s.totalScore || 0; st.history = s.history || [];
      st.history.forEach(function (h) { if (h && typeof h === 'object') { if (h.lost !== undefined) h.lost = (fin(h.lost) && h.lost > 0) ? Math.floor(h.lost) : 0; if (h.peak !== undefined && !fin(h.peak)) delete h.peak; } });
      st.dayTime = s.dayTime || 0; st.dayLen = CFG.dayLen[st.day - 1];
      st.chapter = chapterOf(st.day);
      // save sem o campo (formato antigo): soma do historico antes do primeiro dia do capitulo
      if (nat(s.chapterCars0)) st.chapterCars0 = s.chapterCars0;
      else { st.chapterCars0 = 0; (st.history || []).forEach(function (h) { if (h && h.day < chapterFirst(st.chapter) && nat(h.delivered)) st.chapterCars0 += h.delivered; }); }
      activeCards = saved.cards || []; st.cards = activeCards.slice();
      placed = saved.placed || {}; hot = saved.hot || {};
      // Undo do plano de hoje (Game.load ja conferiu ou tirou d.undo): mesmas fotos, mesma ordem, mesmos reembolsos
      undoStack = (saved.undo && st.phase === 'plan') ? saved.undo.list.map(function (e) {
        return { layout: e.layout, budget: e.budget, placed: e.placed, free: { road: e.free.road, light: e.free.light },
                 die: normDie(e.die, st.day), rerolled: e.rerolled, watch: Array.isArray(e.watch) ? e.watch : undefined, crew: e.crew };
      }) : [];
      st.hot = saved.hotMap || {};
      // retorno da escolha (v2): save antigo sem os campos (ou campo estragado) carrega sem eles
      st.trouble = normTrouble(s.trouble);
      st.watch = normWatch(s.watch);
      if (!st.watch || st.watch.day !== st.day) st.watch = { day: st.day, list: [] };
      st.watchPrev = normWatch(s.watchPrev);
      if (st.watchPrev && (st.watchPrev.day !== st.day - 1 || !st.watchPrev.list.length)) st.watchPrev = null;
      st.upkeep = upkeepNorm(saved.upkeep);
      st.kinds = kindsNorm(saved.kinds);
      if (isObjL(saved.whatIf) && fin(saved.whatIf.day) && isObjL(saved.whatIf.nodes)) st.whatIf = saved.whatIf;
      if (isObjL(saved.adv)) st.adv = saved.adv;
      if (isObjL(saved.perks)) st.perks = { round: saved.perks.round === true, freePower: nat(saved.perks.freePower) ? saved.perks.freePower : 0, chosen: typeof saved.perks.chosen === 'string' ? saved.perks.chosen : undefined };
      if (typeof saved.archetype === 'string' && CFG.archetypes && own(CFG.archetypes, saved.archetype)) st.archetype = saved.archetype;
      shiftDay = nat(saved.shiftDay) ? saved.shiftDay : 0;
      if (isObjL(saved.crew)) { st.crew = crewNorm(saved.crew); if (st.phase !== 'plan') st.crew.offer = false; }
      autoPair();
      syncModes(st.phase === 'plan' ? CFG.clear.charges : 0);
      // save antigo sem a marca: se o dia ja passou da liberacao, o aviso ja foi visto
      clearSeen = s.clearSeen === true || st.day >= CFG.clear.unlockDay;
      teachOn = s.teachOn !== false; teachSeen = s.teachSeen === true;
      var tt = isObjL(s.teach) ? s.teach : {};
      st.teach = { day3Convoy: tt.day3Convoy === true, jam: tt.jam === true, seen: teachSeen,
                   target: (typeof tt.target === 'number' && isFinite(tt.target)) ? tt.target : null,
                   sent: (typeof tt.sent === 'number' && isFinite(tt.sent) && tt.sent >= 0) ? tt.sent : 0 };
      var ll = s.lastLock;   // save antigo nao tem: null
      lastLock = (ll && typeof ll === 'object' && fin(ll.nodeId)) ? { nodeId: ll.nodeId, tool: typeof ll.tool === 'string' ? ll.tool : null, degree: fin(ll.degree) ? ll.degree : 0, portal: !!ll.portal, x: fin(ll.x) ? ll.x : 0, y: fin(ll.y) ? ll.y : 0, day: fin(ll.day) ? ll.day : 0 } : null;
      st.chapterRetries = nat(s.chapterRetries) ? s.chapterRetries : 0;
      st.freeJamSeen = s.freeJamSeen === true;
      // checkpoint (Game.load ja conferiu ou tirou): sem ele, a manha de hoje (plano) ou a proxima vira o checkpoint
      checkpoint = isObjL(saved.checkpoint) && !CFG.ironMode ? clone(saved.checkpoint) : null;
      st.checkpointDay = checkpoint ? checkpoint.st.day : null;
      needCp = !checkpoint && !CFG.ironMode;
      if (st.phase === 'over') st.final = finalOf(st.strikes < strikeCap());
      st.tipCarry = s.tipCarry || 0; st.speedBonus = s.speedBonus || 0; st.tips = 0;
      st.speedDial.applied = s.speedApplied || 0;
      syncDial();   // cargas do dia nao vao no save: volta cheio
      // eventos de lugar: conferidos; save antigo (sem o campo) ou estragado recomeca o calendario so do que ainda da para avisar
      if (EVM()) EVM().load(g, s.events);
      for (var k = 0; k < saved.rngCalls; k++) base();
      rngCalls = saved.rngCalls;
      world.day = st.day;
      refresh();
      if (needCp && st.phase === 'plan') takeCheckpoint();
    } else {
      st.archetype = archetypeOf(seed, opts.archetype);
      // rua do dia 1: no Rio ela e vertical e ja e a ponte 1 (v2/nivel.md 3.2)
      var vert = archCfg().day1 === 'vertical', h1 = archCfg().day1Half || 90;
      var a = idOf(world.addNode(vert ? 0 : -h1, vert ? -h1 : 0, { portal: true }));
      var b = idOf(world.addNode(vert ? 0 : h1, vert ? h1 : 0, { portal: true }));
      world.addEdge(a, b, { lanes: 1, oneway: 0 });
      if (EVM()) EVM().init(g, opts.events);   // opts.events: true/false forca o modo de teste (padrao CFG.events.test)
      enterPlan(1, 0);
    }
    // v2: rua do jogador tambem respeita o terreno (o fantasma da UI le o mesmo canAddEdge)
    var cae = world.canAddEdge;
    if (typeof cae === 'function') world.canAddEdge = function (aId, x, y, o) {
      var r = cae.call(world, aId, x, y, o), A = archCfg();
      if (!r || !r.ok || (!A.river && !A.park)) return r;
      var pts = [world.nodes[aId]].concat((r.cross || []).map(function (c) { return { x: c.x, y: c.y }; }));
      pts.push({ x: r.x, y: r.y });
      pts.sort(function (p, q) { return dist(p.x, p.y, world.nodes[aId].x, world.nodes[aId].y) - dist(q.x, q.y, world.nodes[aId].x, world.nodes[aId].y); });
      for (var i = 0; i < pts.length - 1; i++) {
        var P = pts[i], Q = pts[i + 1];
        var endOk = (i < pts.length - 2) || r.nodeId != null || terrainPt(Q);
        if (!endOk || !terrainOk(P, Q)) return { ok: false, x: r.x, y: r.y, reason: 'terrain' };
      }
      return r;
    };
    return g;
  }
  // v2: forma da cidade. opts.archetype: um id (river, park, classic) escolhe direto; 'seed' sorteia pela semente
  // (CFG.archetypeList; e o que main.js pede da segunda partida em diante); sem pedido: Classica (testes e ferramentas)
  function archetypeOf(seed, want) {
    var L = CFG.archetypeList || ['classic'];
    if (typeof want === 'string' && CFG.archetypes && own(CFG.archetypes, want)) return want;
    if (want !== 'seed') return 'classic';
    var h = Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    return L[h % L.length] || 'classic';
  }

  // ---------- validacao de save (localStorage pode vir corrompido ou de outra versao) ----------
  function fin(v) { return typeof v === 'number' && isFinite(v); }
  var DIE_STATES = { none: 1, offer: 1, used: 1, passed: 1, kept: 1, auto: 1 };
  function keptOk(k) { var df = isObj(k) && typeof k.id === 'string' ? faceDef(k.id) : null; return !!df && !!df.offer && nat(k.value) && k.value >= 1 && k.value <= (DC().faces || 6); }
  function nat(v) { return fin(v) && Math.floor(v) === v && v >= 0; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function cardOk(c) { for (var i = 0; i < CFG.cards.length; i++) if (CFG.cards[i].id === c) return true; return false; }
  // carta do resumo: as do sorteio ou as da escolha do dia 19 (estas nunca ficam ativas: viram state.perks)
  function draftOk(c) { return cardOk(c) || (!!CFG.choiceCard && (CFG.choiceCard.cards || []).indexOf(c) >= 0); }
  function maxDieBudget(tab) {
    var m = 0;
    for (var i = 0; i < tab.outcomes.length; i++) m = Math.max(m, tab.outcomes[i].budget || 0);
    return m;
  }
  // dado de save: face v2 (id do CFG.dice.defs, d6) ou dado antigo (tabela pelo numero de faces). null so com allowNull
  function dieOk(di, day, allowNull) {
    if (di === null || di === undefined) return !!allowNull;
    if (isV2Face(di)) return isObj(di) && faceDef(di.id) !== null && di.faces === (DC().faces || 6) && nat(di.value) && di.value >= 1 && di.value <= di.faces;
    var tab = di && di.faces === 20 ? CFG.dice.late : (di && di.faces === 6 ? CFG.dice.early : diceTable(day));
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
    // v2: ferramenta cortada (CFG.tools.<id>.removed, a faixa de pedestre): vira cruzamento sem sinal e o custo volta
    // ao orcamento de hoje (ate o teto que validSave aceita; o resto se perde, nunca invalida o save)
    var s = d.st, refund = 0;
    if (Array.isArray(w.nodes)) for (i = 0; i < w.nodes.length; i++) {
      var rn = w.nodes[i];
      if (isObj(rn) && typeof rn.tool === 'string' && own(CFG.tools, rn.tool) && CFG.tools[rn.tool].removed) {
        refund += CFG.tools[rn.tool].cost || 0;
        if (isObj(d.placed) && fin(rn.id)) delete d.placed[rn.id];
        rn.tool = null; rn.pair = null;
      }
    }
    if (refund > 0 && isObj(s) && nat(s.budget) && nat(s.day) && s.day >= 1 && s.day <= CFG.maxDays) {
      s.budget = Math.min(s.budget + refund, Math.max(s.budget, budgetCap(s)));
      d.refunded = refund;
    }
    // dia 1 no plano: o dado e sempre o neutro (build antigo sorteava); gratuidade que veio do dado sai
    if (isObj(s) && s.dieState === undefined && s.day === 1 && s.phase === 'plan' && CFG.dice.day1Face) {
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
    var s = d.st, i;
    if (!nat(d.seed) || !nat(d.rngCalls) || d.rngCalls > 5000000) return false;
    if (!nat(s.day) || s.day < 1 || s.day > CFG.maxDays) return false;
    if (s.phase !== 'plan' && s.phase !== 'summary' && s.phase !== 'over') return false;
    var per = CFG.speedDial.tipsPerPoint, MAXSB = 200;   // teto folgado: pontos de gorjeta por dia
    if (s.tipCarry !== undefined && (!fin(s.tipCarry) || s.tipCarry < 0 || s.tipCarry >= per)) return false;
    if (s.speedBonus !== undefined && (!nat(s.speedBonus) || s.speedBonus > MAXSB)) return false;
    if (s.speedApplied !== undefined && (!nat(s.speedApplied) || s.speedApplied > MAXSB)) return false;
    if (s.phase === 'plan' && s.speedBonus) return false;   // no plano o bonus ja entrou no orcamento
    var sap = s.speedApplied || 0;   // bonus que entrou no orcamento de hoje (vale em plan, summary e over)
    if (!nat(s.budget) || s.budget > budgetCap(s)) return false;
    if (!nat(s.strikes) || s.strikes > CFG.maxStrikes) return false;
    if (s.phase !== 'over' && s.strikes >= strikeCap()) return false;
    if (s.phase === 'over' && !(s.strikes >= strikeCap() || s.day >= CFG.maxDays)) return false;
    if (s.chapterRetries !== undefined && (!nat(s.chapterRetries) || s.chapterRetries > 9999)) return false;
    if (s.freeJamSeen !== undefined && typeof s.freeJamSeen !== 'boolean') return false;
    if (s.speed !== undefined) {
      var spOk = false;
      for (i = 0; i < CFG.speedDial.levels.length; i++) if (CFG.speedDial.levels[i].speed === s.speed) spOk = true;
      if (!spOk) return false;
    }
    if (s.dayTime !== undefined && (!fin(s.dayTime) || s.dayTime < 0 || s.dayTime > CFG.dayLen[s.day - 1] + 1)) return false;
    if (s.phase === 'plan') {
      if (!dieOk(s.die, s.day, s.dieState === 'none')) return false;
      if (s.dieState !== undefined && !DIE_STATES[s.dieState]) return false;
      if (s.dieState !== undefined && s.dieState !== 'none' && !s.die) return false;
      if (s.summary !== null && s.summary !== undefined) return false;
    }
    if (s.nextDie !== undefined && s.nextDie !== null && (s.day >= CFG.maxDays || !dieOk(s.nextDie, s.day + 1))) return false;
    if (s.kept !== undefined && s.kept !== null && !keptOk(s.kept)) return false;
    if ((s.debt !== undefined && (!nat(s.debt) || s.debt > 20)) || (s.debtPaid !== undefined && (!nat(s.debtPaid) || s.debtPaid > 20))) return false;
    if (s.rerolled !== undefined && typeof s.rerolled !== 'boolean') return false;
    if (s.clearSeen !== undefined && typeof s.clearSeen !== 'boolean') return false;
    if (s.teachOn !== undefined && typeof s.teachOn !== 'boolean') return false;
    if (s.teachSeen !== undefined && typeof s.teachSeen !== 'boolean') return false;
    if (s.phase !== 'summary' && s.draft !== null && s.draft !== undefined) return false;
    if (s.phase === 'summary') {
      var dr = s.draft;
      // 2 ou 3 cartas distintas (desde 2026-11-10 o sorteio pode ter so 2: plus2 e freeRoad antes do primeiro anel)
      if (!Array.isArray(dr) || dr.length < 2 || dr.length > 3 || dr[0] === dr[1] || (dr.length === 3 && (dr[1] === dr[2] || dr[0] === dr[2]))) return false;
      for (i = 0; i < dr.length; i++) if (!draftOk(dr[i])) return false;
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
    if (s.chapterCars0 !== undefined && (!nat(s.chapterCars0) || s.chapterCars0 > s.totalDelivered)) return false;
    if (!isObj(s.free)) return false;
    var cards = d.cards === undefined ? [] : d.cards;
    if (!Array.isArray(cards) || cards.length > 1) return false;
    for (i = 0; i < cards.length; i++) if (!cardOk(cards[i])) return false;
    // gratuidade: so de carta ou do dado de hoje (free 'light' vira 'road' antes do semaforo)
    if (!freeOk(s.free, s.phase === 'plan' ? s.die : null, s.day, cards)) return false;
    var maps = [d.placed, d.hot, d.hotMap], m, k;
    for (m = 0; m < 3; m++) {
      if (maps[m] === undefined) continue;
      if (!isObj(maps[m])) return false;
      for (k in maps[m]) if (!fin(maps[m][k]) || maps[m][k] < 0 || (m > 0 && maps[m][k] > 1)) return false;
    }
    // v2: manutencao da manha e escolhas permanentes (saves antigos nao tem: null e sem escolha)
    if (d.upkeep !== undefined && d.upkeep !== null) {
      var U = d.upkeep;
      if (!isObj(U) || !nat(U.day) || !nat(U.paid) || !nat(U.owed) || !Array.isArray(U.dark) || U.dark.length > 200) return false;
      for (i = 0; i < U.dark.length; i++) if (!nat(U.dark[i])) return false;
    }
    if (d.crew !== undefined && d.crew !== null) {
      if (!isObj(d.crew) || !Array.isArray(d.crew.active) || d.crew.active.length > 10) return false;
      for (i = 0; i < d.crew.active.length; i++) if (!nat(d.crew.active[i])) return false;
    }
    if (d.perks !== undefined && d.perks !== null) {
      if (!isObj(d.perks) || (d.perks.round !== undefined && typeof d.perks.round !== 'boolean')) return false;
      if (d.perks.freePower !== undefined && (!nat(d.perks.freePower) || d.perks.freePower > 10)) return false;
    }
    return worldOk(d.world);
  }
  function freeOk(free, die, day, cards) {
    var dfree = null;
    if (die) {
      var doc = isV2Face(die) ? faceDef(die.id) : outcomeById(die.faces === 20 ? CFG.dice.late : (die.faces === 6 ? CFG.dice.early : diceTable(day)), die.id);
      if (doc && doc.free === 'light') dfree = day >= CFG.tools.light.unlockDay ? 'light' : 'road';
      else if (doc && doc.free === 'road') dfree = 'road';
    }
    return !((free.road && cards.indexOf('freeRoad') < 0 && dfree !== 'road') ||
             (free.light && cards.indexOf('freeLight') < 0 && dfree !== 'light'));
  }
  function budgetCap(s) {
    var crewMax = CFG.crew ? (CFG.crew.maxActive || 0) * (CFG.crew.perDay || 0) : 0;   // v2: renda das equipes
    return CFG.budget[s.day - 1] + CFG.carryCap + 2 + maxFaceBudget() + (s.speedApplied || 0) + crewMax;
  }
  // mundo de save ou de uma entrada do Undo: as mesmas regras que o Sim garante em mundo valido
  function worldOk(w) {
    var i;
    if (!isObj(w)) return false;
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
  // Undo no save (d.undo = { day, list }): opcional e a parte. Save antigo sem o campo: pilha vazia. Campo
  // corrompido, grande demais ou de outro dia/fase: sai em silencio e o resto do save segue valendo (chamado
  // depois de validSave, entao d.st ja foi conferido). Cada entrada e a foto que capture() tirou.
  function undoOk(d) {
    var u = d.undo, s = d.st, i;
    if (!isObj(u) || s.phase !== 'plan' || u.day !== s.day || !Array.isArray(u.list)) return false;
    if (u.list.length < 1 || u.list.length > UNDO_MAX || JSON.stringify(u).length > UNDO_CHARS) return false;
    var cards = Array.isArray(d.cards) ? d.cards : [], cap = budgetCap(s), k;
    for (i = 0; i < u.list.length; i++) {
      var e = u.list[i];
      if (!isObj(e) || !nat(e.budget) || e.budget > cap || !isObj(e.free) || !isObj(e.placed)) return false;
      if (typeof e.free.road !== 'boolean' || typeof e.free.light !== 'boolean' || typeof e.rerolled !== 'boolean') return false;
      if (!dieOk(e.die, s.day, true) || !freeOk(e.free, e.die, s.day, cards)) return false;
      for (k in e.placed) if (!/^\d+$/.test(k) || !fin(e.placed[k]) || e.placed[k] < 0) return false;
      var L = e.layout;
      if (!isObj(L) || (L.nextNode !== undefined && !nat(L.nextNode)) || (L.nextEdge !== undefined && !nat(L.nextEdge))) return false;
      if (!worldOk(L)) return false;
    }
    return true;
  }

  // v2m: save com kinds estranho nao e recusado; so entra o que tem a forma certa
  function kindsNorm(K) {
    var out = {};
    if (!K || typeof K !== 'object' || Array.isArray(K)) return out;
    for (var id in K) {
      if (!Object.prototype.hasOwnProperty.call(K, id) || !/^\d+$/.test(id)) continue;
      var x = K[id];
      if (!x || typeof x !== 'object' || ['calm', 'main', 'even', 'heavy'].indexOf(x.k) < 0) continue;
      out[id] = { k: x.k, v: fin(x.v) ? x.v : 0, share: fin(x.share) ? x.share : 0, waste: fin(x.waste) ? x.waste : 0 };
    }
    return out;
  }

  // ---------- save do jogo publicado de 12 dias (sem fmt): segue como partida de 30 dias ----------
  // Regra (v2a item 4): o save antigo (dia 1 a 12, plano ou resumo) continua no mesmo dia, agora com 30 dias pela
  // frente, no capitulo 1 ou 2. Strikes recontados pela regra nova (so os dias com strike depois de strikeGraceUntil,
  // no capitulo de hoje). Pontos acima do teto novo do dia descem ao teto; dado que a tabela de hoje nao reconhece e
  // sorteado de novo (rng derivado, sem mexer no fluxo da cidade); dayTime limitado ao dia novo. O checkpoint nasce no
  // load (plano) ou na manha seguinte (resumo). Save antigo no fim (over) ou que nao fecha nas regras: recusado
  // (main.js guarda a copia em .bad e comeca do zero com o aviso).
  var OLD_MAX_DAYS = 12;
  function migrateOld(d) {
    if (!isObj(d) || d.v !== 1 || d.fmt !== undefined || !isObj(d.st)) return false;
    var s = d.st, i;
    if (s.phase === 'run') s.phase = 'plan';
    if (s.phase !== 'plan' && s.phase !== 'summary') return false;
    if (!nat(s.day) || s.day < 1 || s.day > OLD_MAX_DAYS || s.day > CFG.maxDays) return false;
    var hist = Array.isArray(s.history) ? s.history : [];
    var ch = chapterOf(s.day), k = 0;
    for (i = 0; i < hist.length; i++) {
      var h = hist[i];
      if (isObj(h) && h.failed === true && nat(h.day) && !graceDay(h.day) && chapterOf(h.day) === ch) k++;
    }
    s.strikes = Math.min(k, strikeCap() - 1);
    if (fin(s.dayTime)) s.dayTime = Math.max(0, Math.min(s.dayTime, CFG.dayLen[s.day - 1]));
    var cards = Array.isArray(d.cards) ? d.cards : [];
    var tab = diceTable(s.day);
    if (s.phase === 'plan' && !dieOk(s.die, s.day)) {
      var rr = CRZ.rng((d.seed ^ Math.imul(s.day + 223, 0x85EBCA6B)) >>> 0);
      s.die = makeDie(tab, 1 + Math.floor(rr() * tab.faces));
      s.rerolled = false;
      if (isObj(s.free)) { s.free.road = s.free.road && cards.indexOf('freeRoad') >= 0; s.free.light = s.free.light && cards.indexOf('freeLight') >= 0; }
    }
    if (s.nextDie !== undefined && s.nextDie !== null && !dieOk(s.nextDie, s.day + 1)) delete s.nextDie;
    if (s.day >= OLD_MAX_DAYS && s.nextDie === null) delete s.nextDie;
    if (nat(s.budget)) s.budget = Math.min(s.budget, budgetCap(s));
    delete s.chapterCars0; delete s.chapterRetries;
    d.fmt = SAVE_FMT;
    delete d.checkpoint;
    d.migrated = true;
    return true;
  }

  // checkpoint do save (v2, D9): um save completo da mesma partida, numa manha (plano) do capitulo de hoje, sem undo e
  // sem checkpoint dentro, que passa pelas mesmas regras do save (validSave, worldOk) e nunca esta a frente do save
  function checkpointOk(d) {
    var c = d.checkpoint;
    if (!isObj(c) || c.checkpoint !== undefined || c.undo !== undefined) return false;
    if (c.seed !== d.seed || c.diff !== d.diff || c.fmt !== d.fmt || !isObj(c.st)) return false;
    var cs = c.st, s = d.st;
    if (cs.phase !== 'plan' || !nat(cs.day) || cs.day > s.day || chapterOf(cs.day) !== chapterOf(s.day)) return false;
    if (!nat(c.rngCalls) || c.rngCalls > d.rngCalls) return false;
    if ((cs.chapterRetries || 0) > (s.chapterRetries || 0)) return false;
    if (!nat(cs.totalDelivered) || cs.totalDelivered > s.totalDelivered) return false;
    var h = Array.isArray(cs.history) ? cs.history : [], hs = Array.isArray(s.history) ? s.history : [];
    for (var i = 0; i < h.length; i++) if (!hs[i] || !isObj(h[i]) || h[i].day !== hs[i].day) return false;
    c = clone(c);      // confere uma copia: o checkpoint guardado segue no formato em que veio (normSave muda no lugar)
    normSave(c);
    return validSave(c);
  }

  CRZ.Game = {
    kindOf: kindOf,
    // v2: capitulos (lidos pela UI e pelas ferramentas; um so lugar decide a conta)
    chapterOf: chapterOf, chapterFirst: chapterFirst, chapterStart: chapterStart, forgiveWhy: forgiveWhy, graceDay: graceDay,
    _teach: TEACH,   // ajuste fino (testes/simulacao); valores finais propostos em NOTES_GAME.md
    // opts.teach === false: jogador que ja fez a primeira partida (sem o comboio do dia 3)
    create: function (seed, opts) { return build((seed === undefined ? 1 : seed) >>> 0 || 1, null, opts); },
    load: function (json) {
      try {
        var d = typeof json === 'string' ? JSON.parse(json) : clone(json);
        // save de outra dificuldade: recusa (main.js troca a dificuldade e recarrega); save sem diff segue aceito
        if (d && d.diff !== undefined && CFG.difficultyName && d.diff !== CFG.difficultyName) return null;
        // save do jogo publicado de 12 dias (sem fmt): vira partida de 30 dias, ou e recusado (main.js: .bad e aviso)
        if (isObj(d) && d.fmt === undefined && !migrateOld(d)) return null;
        if (!isObj(d) || d.fmt !== SAVE_FMT) return null;
        normSave(d);
        if (!validSave(d)) return null;
        if (d.undo !== undefined) { var uOk = false; try { uOk = undoOk(d); } catch (e2) { uOk = false; } if (!uOk) delete d.undo; }
        // checkpoint (v2): opcional e conferido a parte; recusado sai em silencio e o jogo grava outro na proxima manha
        if (d.checkpoint !== undefined) { var cOk = false; try { cOk = checkpointOk(d); } catch (e3) { cOk = false; } if (!cOk) delete d.checkpoint; }
        return build(d.seed, d);
      } catch (e) { return null; }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
