/* Cruzamento: tutorial guiado (balao com texto curto, seta e spotlight). Dono: agente TUTORIAL.
 * CRZ.Tutorial.create({game, render, ui}) -> {start, skip, replay, isActive, destroy, update(dt)}.
 * Logica (maquina de passos) separada da vista em DOM: CRZ.Tutorial._test.createMachine roda no node.
 * Persistencia: localStorage['cruzamento.tut'] = {v, seen:{id:1}, skipped}. Estilos injetados em
 * <style id="crz-tut-style">. Le os ganchos congelados da UI: data-tut, evento 'crz:ui', crz-modal. */
(function (root) {
  'use strict';
  var CRZ = root.CRZ = root.CRZ || {};

  // todo texto visivel fica aqui, em ingles (maximo 14 palavras por passo, sem travessao)
  var STR = {
    road: 'Goal: keep cars flowing for {days} days. Tap New road to start building.',
    roadDrag: 'Cars enter at road ends. Drag outward from this road end to build.',
    play: 'Build points refill each day. Undo is free. Tap play.',
    // dia 1 em corrida: o relogio pausa ate a jogadora mandar um carro (o dia 1 a 4x durava ~5 s)
    run: 'Paused. Tap this road end to send one more car.',
    runNoRoom: 'No room right now. Try another road end.',
    dest: 'Each car drives to another road end. Arriving counts as delivered.',
    summary: 'Cars delivered today. Now pick one reward; it only helps tomorrow.',
    summaryBonus: 'Cars delivered. Fill the Speed bonus bar for +1 build point. Pick a reward.',
    grew: 'The city grew a new road end. Tap New road, then drag from it.',
    grewDrag: 'Now drag from a road end to link it to the city.',
    // tudo ja ligado: nao ha o que "ligar a cidade"
    grewDragAny: 'Now drag from the circled end to add a new road.',
    // dia 2 em corrida: velocidade (pausa ate tocar) e onde ver o progresso do dia
    speed: 'Paused. This button sets speed. Faster earns bonus build points; drivers lose patience sooner.',
    progress: 'The ring around this button fills as the day runs. Full ring: day over.',
    // dia 2: o dado e apresentado por um balao bloqueante (a jogadora nao sabia que podia relancar)
    die: 'Daily die: build points, free build, or more cars. Reroll once: {rr}.',
    reroll: 'Bad roll? Tap the die to reroll for {rr}.',
    bigDie: 'New die today: 1 to {big}, not 1 to {small}. Higher is better.',
    boostJunction: 'Boost works on junctions too: tap a ring to clear its queue.',
    // cartoes de ferramenta: {c} vira o custo do CFG ("1 build point"); ate 10 palavras ja com o custo
    tool: {
      stop: 'Stop, {c}: cheap. Cars take turns at quiet junctions.',
      yield: 'Yield, {c}: main road never stops. Best at a T.',
      light: 'Traffic light, {c}: best for heavy four-way traffic.',
      upgrade: 'Two lanes, {c}: doubles a road\'s flow. Pair with a light.',
      // o motivo do "pouco": a faixa para carros por pedestres (o cartao passa de 10 palavras por isso)
      cross: 'Crosswalk, {c}: cars stay calm longer. Rings fill slower.',
      round: 'Roundabout, {c}: four or more busy roads. Weak at a T.',
      oneway: 'One-way, {c}: flips direction. Cars with no way out wait.'
    },
    // vocabulario do anel igual a cor do render: {R}/{L}/{E} viram o nivel do no na hora (ringSay):
    // ambar tracejado (0,3 a 0,6) 'Busy junction', vermelho continuo (acima de 0,6, travado) 'Red ring'
    ringLead: {
      busy: 'Busy junction: cars are queuing', red: 'Red ring: long queue',
      busyName: 'Busy junction', redName: 'Red ring',
      busyEnd: 'Ring at a road end', redEnd: 'Red ring at a road end'
    },
    ringStop: '{R}. Tap it to Boost; tomorrow, add a Stop.',
    ringBoost: '{R}. Tap the junction to Boost it.',
    ringFast: '{L}: tap speed to slow down, or tap the junction to Boost.',
    ringLock: '{R}. If it fills, the junction locks: 1 strike.',
    // anel numa ponta de rua: Boost ali manda MAIS um carro, entao a dica e para o planejamento
    ringEnd: '{E}. Tomorrow, build a road nearby to spread cars.',
    ringEndLane: '{E}. Tomorrow, give that road a second lane.',
    // ultimo dia: nao ha amanha
    ringEndLast: '{E}. Boost cannot help here.',
    ringNice: 'Nice. The queue is gone.',
    ringSlow: '{L}: tap it to Boost, or slow the day down.',
    slowDown: 'Slow down',
    boostBtn: 'Boost',
    // lembrete diario (Easy, dias 4 a 9, sem Boost ontem): aponta o chip do Boost da UI, sem pausar
    ringAgain: 'Tap the glowing Boost to clear a ring.',
    tipStrike: 'This junction locked: 1 strike. {n} strikes end the run.',
    tipHot: "Dashed rings: yesterday's trouble spots. Tap one to see what helps.",
    tipEndJunction: 'This road end is now a junction. Stop, Yield and lights work here too.',
    tipPair: 'Tap a light, tap Pair lights, then tap the other light.',
    go: 'Continue',
    ok: 'Got it',
    skip: 'Skip tutorial',
    skipConfirm: 'Tap again to skip',
    seal: 'Tutorial complete'
  };

  // custo no cartao da ferramenta, lido do CFG (sem CFG: tira o custo e fica so o nome)
  (function fillCosts() {
    var T = CRZ.CFG && CRZ.CFG.tools, id, c;
    for (id in STR.tool) {
      if (!has(STR.tool, id)) continue;
      c = T && T[id] ? T[id].cost : null;
      STR.tool[id] = typeof c === 'number'
        ? STR.tool[id].replace('{c}', c + (c === 1 ? ' build point' : ' build points'))
        : STR.tool[id].replace(', {c}', '');
    }
  })();

  // numeros fixos lidos do CFG (dias da partida, faces do dado, custo do relance)
  (function fillNumbers() {
    var C = CRZ.CFG || {}, D = C.dice || {}, rr = D.rerollCost, k;
    var rrTxt = typeof rr === 'number' ? rr + (rr === 1 ? ' build point' : ' build points') : '1 build point';
    var map = {
      '{days}': String(C.maxDays || 12),
      '{big}': String(D.late && D.late.faces || 20),
      '{small}': String(D.early && D.early.faces || 6),
      '{rr}': rrTxt
    };
    for (k in STR) {
      if (!has(STR, k) || typeof STR[k] !== 'string') continue;
      Object.keys(map).forEach(function (t) { STR[k] = STR[k].split(t).join(map[t]); });
    }
  })();

  var KEY = 'cruzamento.tut';
  var TIP_GAP = 20;        // s entre duas dicas de situacao
  var TOAST_LIFE = 9;      // s ate um balao nao bloqueante sumir
  var MISSING_GRACE = 1.5; // s esperando o alvo aparecer antes de pular o passo
  var HOLE_K = 1.7;        // buraco e repasse do toque: 1,7x o raio de toque do mapa (alcance do arrasto da UI)
  var HAND_AFTER = 15;     // s sem construir ate a maozinha aparecer
  var ESCAPE_AFTER = 20;   // s num passo "agir" ate surgir um Continuar de escape
  var ARM_TIME = 3;        // s para confirmar o pulo
  var STRESS_TIP = 0.5;
  var NICE_AT = 0.3;       // o "Nice" so sai com o estresse abaixo disto (o render apaga o anel aqui)
  var NICE_DROP = 0.25;    // queda minima do pico do anel ate agora para contar sem Boost
  var NICE_ACT_WIN = 6;    // s: o Boost bem sucedido so conta como causa do 'Nice' dentro desta janela
  var NICE_HOLD = 1.5;     // s seguidos abaixo de NICE_AT (a fila sumiu, nao so piscou)
  // o render desenha o anel vermelho acima de 0.35; o aviso do primeiro anel sai logo depois (antes era 0.5
  // e um anel fino do dia 5 sumiu sem explicacao)
  var RING_AT = 0.42;
  // o balao do anel sai junto com o anel (render desenha o tracejado a partir de 0.3): o iniciante travava
  // 4-5 s reais depois do anel, com o balao ainda esperando
  var RING_SHOW = 0.3;
  var SHOW_AFTER = 1.5;    // s reais de carros andando antes de um balao que pausa o dia
  var PH = { plan: 0, run: 1, summary: 2, over: 3 };
  var TOOL_IDS = ['stop', 'yield', 'light', 'upgrade', 'cross', 'round', 'oneway'];

  /* ---------- leitura do mundo (puro) ---------- */

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function st(c) { return (c.game && c.game.state) || {}; }
  // lista de nos ordenada por id. As dicas chamam isto varias vezes por quadro: guarda a ultima lista e
  // so remonta (e reordena) quando o conjunto mudou. Validar e contar + conferir identidade, sem alocar.
  // Quem chama nao altera a lista devolvida.
  var nodeCache = { nodes: null, list: [] };
  function nodesOf(g) {
    var w = g && g.world, out, k, n = 0, i, L = nodeCache.list, same;
    if (!w || !w.nodes) return [];
    if (nodeCache.nodes === w.nodes) {
      for (k in w.nodes) if (has(w.nodes, k) && w.nodes[k]) n++;
      same = n === L.length;
      for (i = 0; same && i < L.length; i++) if (w.nodes[L[i].id] !== L[i]) same = false;
      if (same) return L;
    }
    out = [];
    for (k in w.nodes) if (has(w.nodes, k) && w.nodes[k]) out.push(w.nodes[k]);
    out.sort(function (a, b) { return a.id - b.id; });
    nodeCache.nodes = w.nodes; nodeCache.list = out;
    return out;
  }
  function edgeCount(g) {
    var w = g && g.world, n = 0, k;
    if (!w || !w.edges) return 0;
    for (k in w.edges) if (has(w.edges, k)) n++;
    return n;
  }
  function deg(n) { return n && n.edges ? n.edges.length : 0; }
  function xy(n) { return { x: n.x, y: n.y }; }
  // pontas: percorrem nodesOf direto (portals() alocava uma lista por chamada)
  function rightPortal(g) {
    var p = nodesOf(g), b = null, i;
    for (i = 0; i < p.length; i++) if (p[i].portal && (!b || p[i].x > b.x)) b = p[i];
    return b;
  }
  // calor de um no: pico de ontem (state.hot) ou estresse agora
  function heat(g, n) { var h = (g && g.state && g.state.hot) || {}; return Math.max(h[n.id] || 0, n.stress || 0); }
  var HOT_JUNCTION = 0.35;
  // no de 3+ estradas sem ferramenta; o mais quente primeiro, depois o de mais estradas
  function freeJunction(g) {
    var ns = nodesOf(g), b = null, i;
    for (i = 0; i < ns.length; i++) {
      var n = ns[i];
      if (n.portal || n.tool || deg(n) < 3) continue;
      if (!b || heat(g, n) > heat(g, b) || (heat(g, n) === heat(g, b) && deg(n) > deg(b))) b = n;
    }
    return b;
  }
  function newestPortal(g) {
    var p = nodesOf(g), b = null, i;
    for (i = 0; i < p.length; i++) if (p[i].portal && (!b || p[i].id > b.id)) b = p[i];
    return b;
  }
  // ponta de rua (portal) com 3+ ruas: virou cruzamento e aceita sinal. A mais nova primeiro
  function portalJunction(g) {
    var p = nodesOf(g), b = null, i;
    for (i = 0; i < p.length; i++) if (p[i].portal && deg(p[i]) >= 3 && (!b || p[i].id > b.id)) b = p[i];
    return b;
  }
  function withTool(g, tool) { return nodesOf(g).filter(function (n) { return n.tool === tool; }); }
  function stressed(g, th) {
    var ns = nodesOf(g), b = null, i;
    th = th || STRESS_TIP;
    for (i = 0; i < ns.length; i++) if ((ns[i].stress || 0) >= th && (!b || ns[i].stress > b.stress)) b = ns[i];
    return b;
  }
  // cruzamento de verdade (3+ estradas) com fila: alvo do Boost de escoar
  function hotJunction(g) {
    var ns = nodesOf(g), b = null, i;
    for (i = 0; i < ns.length; i++) if (deg(ns[i]) >= 3 && (ns[i].stress || 0) >= RING_AT && (!b || ns[i].stress > b.stress)) b = ns[i];
    return b;
  }
  // todos os nos numa peca so? (entao "ligar a cidade" nao faz sentido)
  function connected(g) {
    var ns = nodesOf(g), w = g && g.world, seen = {}, stack, n, i, e, o, cnt = 0;
    if (!ns.length || !w || !w.edges) return true;
    stack = [ns[0]]; seen[ns[0].id] = 1;
    while (stack.length) {
      n = stack.pop(); cnt++;
      for (i = 0; n.edges && i < n.edges.length; i++) {
        e = w.edges[n.edges[i]]; if (!e) continue;
        o = w.nodes[e.a === n.id ? e.b : e.a];
        if (o && !seen[o.id]) { seen[o.id] = 1; stack.push(o); }
      }
    }
    return cnt >= ns.length;
  }
  // ponta mais longe da esquerda (para onde o carro mandado vai)
  function farPortal(g) {
    var l = leftPortal(g), p = nodesOf(g), b = null, bd = -1, i, d;
    for (i = 0; i < p.length; i++) {
      if (!p[i].portal || (l && p[i].id === l.id)) continue;
      d = l ? Math.abs(p[i].x - l.x) + Math.abs(p[i].y - l.y) : 0;
      if (d > bd) { bd = d; b = p[i]; }
    }
    return b;
  }
  function hottest(g) {
    var h = (g && g.state && g.state.hot) || {}, w = g && g.world, b = null, bv = -1, k;
    if (!w || !w.nodes) return null;
    for (k in h) if (has(h, k) && w.nodes[k] && h[k] > bv) { bv = h[k]; b = w.nodes[k]; }
    return b;
  }
  function unlocked(c, id) {
    var t = st(c).tools || [], i;
    for (i = 0; i < t.length; i++) if (t[i].id === id) return !!t[i].unlocked;
    return false;
  }
  // dado de hoje e ruim? usa state.die.kind; se faltar, procura o id nas tabelas do CFG
  function dieBad(c) {
    var d = st(c).die, CFG = CRZ.CFG, k, tabs, i, j;
    if (!d) return false;
    if (d.kind) return d.kind === 'bad';
    tabs = CFG && CFG.dice ? [CFG.dice.early, CFG.dice.late] : [];
    for (i = 0; i < tabs.length; i++) {
      if (!tabs[i] || tabs[i].faces !== d.faces) continue;
      for (j = 0; j < tabs[i].outcomes.length; j++) { k = tabs[i].outcomes[j]; if (k.id === d.id) return k.kind === 'bad'; }
    }
    return false;
  }
  // relancar: so com os dois campos do jogo presentes (state.rerolled e game.canReroll)
  function canRerollNow(c) {
    var g = c.game, s = st(c);
    if (!g || typeof g.canReroll !== 'function' || !('rerolled' in s)) return false;
    try { return !s.rerolled && !!g.canReroll(); } catch (e) { return false; }
  }
  function charges(c) { var cl = st(c).clear; return cl && cl.unlocked !== false ? (cl.charges || 0) : 0; }
  function leftPortal(g) {
    var p = nodesOf(g), b = null, i;
    for (i = 0; i < p.length; i++) if (p[i].portal && (!b || p[i].x < b.x)) b = p[i];
    return b;
  }
  // ponta para mandar o carro: a da esquerda; depois de 'space', a proxima (da esquerda para a direita)
  // que ainda nao recusou. null: todas recusaram
  function sendPortal(c) {
    var full = (c.cur && c.cur.data.full) || {}, p = nodesOf(c.game), L = [], i;
    for (i = 0; i < p.length; i++) if (p[i].portal && deg(p[i]) < 2 && !full[p[i].id]) L.push(p[i]);
    if (!c.cur || !c.cur.data.full) return leftPortal(c.game);
    L.sort(function (a, b) { return a.x - b.x || a.id - b.id; });
    return L[0] || null;
  }
  function uiOf(c) { return c.ui || (CRZ.app && CRZ.app.ui) || null; }
  function selTool(c) { var u = uiOf(c); return u && u.getSelectedTool ? u.getSelectedTool() : undefined; }
  function nodeById(c, id) { var w = c.game && c.game.world; return w && w.nodes ? w.nodes[id] || null : null; }

  // janela de um passo do roteiro: 'past' | 'now' | 'future'
  function at(day, phase) {
    return function (c) {
      var s = st(c);
      if (s.phase === 'over') return 'past';
      if (!(s.day >= 1)) return 'future';
      if (s.day > day) return 'past';
      if (s.day < day) return 'future';
      var a = PH[s.phase], b = PH[phase];
      if (a === undefined) return 'future';
      return a > b ? 'past' : (a < b ? 'future' : 'now');
    };
  }
  function T(name, round) { return function () { return { sel: name, round: !!round }; }; }
  function W(pts) { return pts && pts.length ? { world: pts.map(xy), round: true } : null; }

  /* ---------- roteiro ---------- */

  /* Cadencia (FIRST_TIME_PLAN.md): uma novidade por dia, no dia em que aparece.
   * Dia 1: 4 baloes (Rua, play, Boost + velocidade, resumo). Dia 2: cidade cresceu + dado.
   * Dias 3 a 9: o cartao curto da ferramenta nova. Dia 3: o primeiro anel vermelho (pausa) e "Nice".
   * Fora disso, silencio: so dicas de situacao, uma vez cada. */
  var MAIN = [
    // 1. Rua: bloqueante (o buraco deixa tocar); o mesmo balao segue para o arrasto
    { id: 'road', win: at(1, 'plan'), mode: 'act', hand: true,
      text: function (c) { return selTool(c) === 'road' ? STR.roadDrag : STR.road; },
      target: function (c) {
        if (selTool(c) !== 'road') return { sel: 'tool-road' };
        var p = rightPortal(c.game);
        return p ? W([p]) : null;
      },
      done: function (c) { return edgeCount(c.game) > 1; },
      on: { roadBuilt: true } },
    // 2. play: nao bloqueante (nada de dois bloqueantes no mesmo minuto)
    // sem 'Got it' (btn:'none'): o balao so pede o Play, e o botao ao lado de "Tap play" confundia
    { id: 'play', win: at(1, 'plan'), mode: 'nudge', btn: 'none', text: STR.play, target: T('play', true),
      extra: function () { return [{ sel: 'undo' }]; },
      done: function (c) { return st(c).phase !== 'plan'; }, on: { playPressed: true } },
    // 3. no run: depois de 1,5 s de carros andando, o dia PAUSA e so a ponta esquerda fica tocavel.
    // Tocar nela despausa (nodeTap) e manda o carro; o dia 1 nunca acaba sem um carro mandado
    // (Continuar de escape so depois de 20 s). Uma ideia so: mandar um carro.
    // Ponta sem lugar para o carro (useClear 'space'): o balao diz e aponta a proxima ponta ainda nao tentada;
    // sem outra, o dia segue (o passo sai)
    { id: 'run', win: at(1, 'run'), mode: 'act', pause: true,
      text: function (c) { return c.cur && c.cur.data.full ? STR.runNoRoom : STR.run; },
      wait: function (c) { return c.clock - c.phaseAt < SHOW_AFTER; },
      need: function (c) { return charges(c) > 0 && !!leftPortal(c.game); },
      target: function (c) { var p = sendPortal(c); return p ? W([p]) : { sel: 'clear' }; },
      extra: function () { return [{ sel: 'clear' }]; },
      done: function (c) { return !!c.flags.sent; },
      on: { clearUsed: function (d) { return !!d.ok; } } },
    // 3b. logo depois: para onde os carros vao. Dias 1 e 2: balao que explica durante o dia PAUSA o
    // relogio ate "Got it" (antes era toast de 6 s e saia ~2 s antes do resumo; ninguem lia).
    // 'nudge' + pause: mapa tocavel (tocar um no despausa, ver handleUI), selo Paused do menu
    { id: 'dest', win: at(1, 'run'), mode: 'nudge', pause: true, btn: 'ok', text: STR.dest,
      wait: function (c) { return c.clock - c.mainAt < 1; },
      target: function (c) { var p = farPortal(c.game); return p ? W([p]) : null; },
      on: { clearUsed: function (d) { return !!d.ok; } } },
    // 4. resumo: espera a carta pelo buraco do holofote; o anel extra marca a barra do bonus
    { id: 'summary', win: at(1, 'summary'), mode: 'act',
      text: function (c) {
        var sm = st(c).summary;
        return (sm && 'speedBonus' in sm) || (c.hasEl && c.hasEl('bonus')) ? STR.summaryBonus : STR.summary;
      },
      target: T('summary'),
      extra: function (c) { return c.hasEl && c.hasEl('bonus') ? [{ sel: 'bonus' }] : null; },
      done: function (c) { return st(c).phase !== 'summary'; }, on: { cardPicked: true } },
    // Dia 2, primeiro: o dado. Bloqueante ('act': so o dado fica tocavel), com "Got it" desde o inicio
    // (antes so fechava tocando no dado e a jogadora achava que isso gastava o relance).
    // Tocar no dado abre a folha (o que saiu, amanha, relancar) e tambem fecha o passo.
    { id: 'die', win: at(2, 'plan'), mode: 'act', escapeNow: true, text: STR.die, target: T('die'),
      need: function (c) { return !!st(c).die; },
      on: { dieOpen: true } },
    // Dia 2: um balao nao bloqueante com acao
    { id: 'grew', win: at(2, 'plan'), mode: 'nudge', hand: true, gap: true,
      need: function (c) { return !c.game.canAfford || c.game.canAfford('road'); },
      enter: function (c, cu) { cu.data.edges0 = edgeCount(c.game); },
      text: function (c) { return selTool(c) === 'road' ? (connected(c.game) ? STR.grewDragAny : STR.grewDrag) : STR.grew; },
      target: function (c) {
        if (selTool(c) !== 'road') return { sel: 'tool-road' };
        var p = newestPortal(c.game);
        return p ? W([p]) : null;
      },
      // o texto fala da ponta nova: o balao (que aponta o ladrilho) nao pode cobri-la
      avoid: function (c) { var p = newestPortal(c.game); return p ? [W([p])] : null; },
      done: function (c) { return c.cur && edgeCount(c.game) > c.cur.data.edges0; },
      on: { roadBuilt: true } },
    // Dia 2 em corrida: a velocidade (o dia pausa ate tocar no botao ou em Continue)
    // hide: o botao de enquadrar fica logo acima do play; com ele na tela a seta parecia apontar para ele
    { id: 'speed', win: at(2, 'run'), mode: 'nudge', pause: true, text: STR.speed, target: T('speed', true), hide: ['fit'],
      wait: function (c) { return c.clock - c.phaseAt < SHOW_AFTER; },
      on: { speedChanged: true } },
    // e onde ver o progresso do dia (o anel do botao; a barra verde e o bonus). Pausa ate "Got it", como o 'dest'
    { id: 'progress', win: at(2, 'run'), mode: 'nudge', pause: true, btn: 'ok', text: STR.progress, target: T('speed', true), hide: ['fit'],
      wait: function (c) { return c.clock - c.mainAt < 1.5; },
      on: { clearUsed: function (d) { return !!d.ok; } } }
  ];

  // o que um balao de plano nao cobre: a caixa de todos os nos (soft: cai se a cidade ocupa a faixa
  // toda) e, sempre, os nos quentes de ontem (o pior ponto e os aneis tracejados da dica) mais os extras.
  // Com isso o balao vai para o topo ou a base livre da faixa util (antes cobria a base da cidade)
  function cityAvoid(c, extra) {
    var ns = nodesOf(c.game), h = st(c).hot || {}, out = [], i;
    if (ns.length) out.push({ world: ns.map(xy), soft: true });
    for (i = 0; i < ns.length; i++) if ((h[ns[i].id] || 0) >= HOT_JUNCTION) out.push(W([ns[i]]));
    for (i = 0; extra && i < extra.length; i++) if (extra[i]) out.push(W([extra[i]]));
    return out.length ? out : null;
  }

  // cartoes de ferramenta: curtos, com o icone do ladrilho; modal so no semaforo e nas duas faixas
  var TOOL_MODE = { stop: 'toast', yield: 'toast', light: 'continue', upgrade: 'continue', cross: 'toast', round: 'toast', oneway: 'toast' };
  var TOOLS = [];
  TOOL_IDS.forEach(function (id) {
    TOOLS.push({ id: 'tool:' + id, card: true, icon: id, mode: TOOL_MODE[id], text: STR.tool[id], target: T('tool-' + id),
      avoid: function (c) { return cityAvoid(c, [hottest(c.game)]); },
      ready: function (c) { return st(c).phase === 'plan' && unlocked(c, id); } });
  });

  // texto do CRZ.UI.advise para o no (dia de amanha: e quando se constroi); null sem ui.js, sem no, sem texto
  // curto (ate 14 palavras) ou com 'tomorrow'. Nao recomenda Boost (o balao fixo ja cobre)
  function adviseText(c, n, s) {
    var U = CRZ.UI, a;
    if (!n || !U || typeof U.advise !== 'function') return null;
    try { a = U.advise(n, (s.day || 1) + 1, CRZ.CFG, c.game && c.game.world); } catch (e) { return null; }
    if (!a || typeof a.text !== 'string' || !a.text || a.tool === 'clear') return null;
    if (words(a.text) > 14 || /tomorrow/i.test(a.text)) return null;
    return a.text;
  }
  // aviso do primeiro anel vermelho: SEGURANCA, aparece uma vez mesmo depois de pular o tutorial
  function ringNode(c) {
    var n = c.ringHint !== null && c.ringHint !== undefined ? nodeById(c, c.ringHint) : null;
    if (n && (n.stress || 0) >= RING_SHOW) return n;
    return stressed(c.game, RING_SHOW);
  }
  // nivel do anel como o render o pinta: vermelho continuo acima de 0,6 (ou travado), senao ambar tracejado
  function ringRed(n) { return !!n && (!!n.locked || (n.stress || 0) > 0.6); }
  // troca {R}/{L}/{E} pelo nivel do no agora: o balao sai em 0,3 com 'Busy junction' e escala para 'Red ring'
  function ringSay(text, n) {
    if (typeof text !== 'string' || text.indexOf('{') < 0) return text;
    var L = STR.ringLead, red = ringRed(n);
    return text.replace('{R}', red ? L.red : L.busy).replace('{L}', red ? L.redName : L.busyName)
      .replace('{E}', red ? L.redEnd : L.busyEnd);
  }
  // o primeiro anel, em qualquer dia (no walkthrough so veio no dia 5): o que e e o que fazer
  var SAFETY = [
    { id: 'ring', mode: 'continue', safety: true, pause: true,
      ready: function (c) { return st(c).phase === 'run' && !!ringNode(c); },
      enter: function (c, cu) {
        var n = ringNode(c), s = st(c);
        cu.data.node = n ? n.id : null; c.ringId = cu.data.node;
        // ponta que virou cruzamento (2+ estradas) aceita sinal e Boost de escoar: texto de cruzamento
        var lastDay = !!(CRZ.CFG && s.day === CRZ.CFG.maxDays);   // no ultimo dia nao ha "amanha"
        cu.data.text = n && n.portal && deg(n) < 2
            ? (lastDay ? STR.ringEndLast : unlocked(c, 'upgrade') ? STR.ringEndLane : STR.ringEnd)
          : (s.speed || 1) > 1 ? STR.ringFast
          : charges(c) > 0 ? (unlocked(c, 'stop') && !lastDay ? STR.ringStop : STR.ringBoost) : STR.ringLock;
        // recomendador unico da UI (mesmo texto do toque no anel): ferramenta liberada para amanha, sem 'tomorrow'
        var adv = lastDay ? null : adviseText(c, n, s);
        if (adv && (s.speed || 1) <= 1) cu.data.text = adv;
        // o texto ja ensinou o Boost no cruzamento: a dica propria nao repete
        var tapIt = charges(c) > 0 && (cu.data.text === STR.ringFast || cu.data.text === STR.ringStop || cu.data.text === STR.ringBoost || (!!adv && !(n && n.portal && deg(n) < 2) && cu.data.text === adv));
        if (tapIt) {
          c.mark('tip:boostJ');
          // o texto manda tocar o cruzamento: 'act' (o buraco do holofote deixa tocar, sem crz-modal).
          // O toque despausa (handleUI nodeTap), o Boost sai e fecha o balao (on.clearUsed).
          // Continue segue disponivel desde o inicio (escapeNow)
          cu.mode = 'act';
          // "toque na velocidade OU no cruzamento": o escuro nao segura o toque (o botao fica fora do buraco)
          cu.data.pass = cu.data.text === STR.ringFast;
          // primeiro anel com velocidade acima de 2x: duas acoes no balao, 'Slow down' (2x) e 'Boost'
          // (Easy e Normal: no passeio do Normal, 2026-11-09, so o Easy oferecia o 'Slow down')
          if ((s.speed || 1) > 2 && !(n && n.portal && deg(n) < 2)) {
            cu.data.text = STR.ringSlow; cu.data.pass = false; cu.data.alt = true;
          }
        }
      },
      escapeNow: true,
      on: { clearUsed: function (d) { return !!d.ok; }, speedChanged: true },
      // Continue despausa (a pausa e do passo, ver enter/finish) e o jogador age
      text: function (c) { return ringSay(c.cur.data.text, nodeById(c, c.cur.data.node)); },
      target: function (c) { var n = nodeById(c, c.cur.data.node); return n ? W([n]) : null; } }
  ];

  // lembrete do anel vermelho (RESULTS_HUMANS 2026-11-08: o iniciante segue balao e quase nao usa Boost
  // sozinho). Uma vez por dia, so no Easy, dias 4 a 9, se o Boost nao foi usado ontem (nem hoje), depois
  // do aviso 'ring'. Toast: nao pausa nem cobre o mapa; sai com o Boost. Vale mesmo com o tutorial pulado.
  var AGAIN_FROM = 4, AGAIN_TO = 9, AGAIN_AT = 0.3;   // junto com o anel; o chip do Boost (0,45) vira o alvo quando sair
  function easyMode() { var d = CRZ.CFG && CRZ.CFG.difficultyName; return !d || d === 'easy'; }
  function chipNode(c) {
    var u = uiOf(c), id = u && u.boostChip ? u.boostChip() : undefined;
    if (id !== undefined && id !== null) { var cn = nodeById(c, id); if (cn) return cn; }
    return ringJunction(c.game, AGAIN_AT);   // ainda sem chip: o cruzamento com o anel
  }
  // no onde o Boost escoa (2+ ruas, sem trava) com o maior estresse acima de th
  function ringJunction(g, th) {
    var ns = nodesOf(g), b = null, i;
    for (i = 0; i < ns.length; i++) {
      var n = ns[i];
      if (n.locked || deg(n) < 2 || (n.stress || 0) < th) continue;
      if (!b || n.stress > b.stress) b = n;
    }
    return b;
  }
  var DAILY = [
    { id: 'tip:ringAgain', mode: 'toast', text: STR.ringAgain,
      ready: function (c) {
        var s = st(c), d = s.day || 0;
        if (s.phase !== 'run' || d < AGAIN_FROM || d > AGAIN_TO || !easyMode() || !c.seen('ring')) return false;
        if (c.boostDay() >= d - 1 || charges(c) <= 0) return false;
        if (c.niceSince !== null && c.niceSince !== undefined) return false;   // 'Nice' pendente: sem lembrete contraditorio
        return !!chipNode(c);
      },
      enter: function (c, cu) { var n = chipNode(c); cu.data.node = n ? n.id : null; },
      // o chip e o alvo (o balao fica ao lado dele); sem chip, o proprio no
      target: function (c) {
        var u = uiOf(c), cid = u && u.boostChip ? u.boostChip() : null;
        if (cid !== null && cid !== undefined && c.hasEl && c.hasEl('boost-chip')) return { sel: 'boost-chip' };
        var n = nodeById(c, c.cur.data.node); return n ? W([n]) : null;
      },
      done: function (c) { return c.boostDay() >= (st(c).day || 0); },
      on: { clearUsed: function (d) { return !!d.ok; } } }
  ];

  var TIPS = [
    // depois do anel: so quando a fila baixou DE VERDADE (estresse abaixo de 0.3, onde o render apaga o
    // anel, por NICE_HOLD s seguidos). Antes saia tambem no resumo e logo no primeiro quadro abaixo
    // de 0.3, com o anel e os carros ainda na tela
    { id: 'tip:ringNice', mode: 'toast', nogap: true, text: STR.ringNice,
      ready: function (c) {
        if (!c.seen('ring') || c.ringId === null || c.ringId === undefined) return false;
        var s = st(c), n = nodeById(c, c.ringId);
        // nunca sem acao da jogadora NESTA execucao do dia: Boost bem sucedido nos ultimos NICE_ACT_WIN s, ou
        // mudanca de velocidade/rua; e queda real do pico para o Nice sair sem Boost
        var boosted = c.niceBoostAt !== null && c.niceBoostAt !== undefined && c.clock - c.niceBoostAt <= NICE_ACT_WIN;
        if (!(boosted || c.niceAct) || (!boosted && (c.ringPeak || 0) - (n ? n.stress || 0 : 0) < NICE_DROP)) { c.niceSince = null; return false; }
        if (s.phase !== 'run' || !n || (n.stress || 0) >= NICE_AT) { c.niceSince = null; return false; }
        if (c.niceSince === null || c.niceSince === undefined) c.niceSince = c.clock;
        return c.clock - c.niceSince >= NICE_HOLD;
      },
      enter: function (c, cu) { cu.data.node = c.ringId; },
      target: function (c) { var n = nodeById(c, c.cur.data.node); return n ? W([n]) : null; } },
    // primeiro strike: sai logo (sem esperar o intervalo das dicas); no resumo aponta os circulos do cartao.
    // O numero de strikes vem do CFG na hora (a dificuldade Facil muda o limite)
    { id: 'tip:strike', mode: 'toast', nogap: true,
      text: function () { return STR.tipStrike.replace('{n}', String((CRZ.CFG && CRZ.CFG.maxStrikes) || 3)); },
      target: function (c) { return st(c).phase === 'summary' ? { sel: 'summary-strikes' } : { sel: 'strikes' }; },
      // no resumo: nao cobre o titulo ("Locked!"), o numero grande de carros, a barra do Speed bonus nem a
      // linha do pior ponto ("Worst spot today")
      avoid: function (c) {
        return st(c).phase === 'summary'
          ? [{ sel: 'summary-head' }, { sel: 'summary-big' }, { sel: 'bonus' }, { sel: 'summary-jam' }] : null;
      },
      ready: function (c) { var s = st(c); return (s.strikes || 0) >= 1 && (s.phase === 'summary' || s.phase === 'plan'); } },
    // Boost num cruzamento com fila (se o anel ainda nao ensinou isso)
    // dias 1 e 2: explica durante o dia, entao pausa ate "Got it" (nudge); depois, toast
    { id: 'tip:boostJ', nogap: true, text: STR.boostJunction, btn: 'ok',
      mode: function (c) { return (st(c).day || 1) <= 2 ? 'nudge' : 'toast'; },
      pause: function (c) { return (st(c).day || 1) <= 2; },
      ready: function (c) { return st(c).phase === 'run' && charges(c) > 0 && !!hotJunction(c.game); },
      enter: function (c, cu) { var n = hotJunction(c.game); cu.data.node = n ? n.id : null; },
      target: function (c) { var n = nodeById(c, c.cur.data.node); return n ? W([n]) : null; },
      on: { clearUsed: true } },
    // dado novo no dia 6 (d20): o numero no lugar dos pontos
    { id: 'tip:bigDie', mode: 'toast', nogap: true, text: STR.bigDie, target: T('die'),
      ready: function (c) { var s = st(c); return s.phase === 'plan' && !!s.die && s.die.faces > 6; },
      on: { dieOpen: true } },
    // ponta que ganhou a terceira rua: so depois do primeiro sinal liberado (dia 3+); sem pausa; entra na fila
    // das dicas (so roda sem balao na tela) e sai ao tocar "Got it" ou ao pôr ferramenta no no
    { id: 'tip:endJ', mode: 'nudge', nogap: true, btn: 'ok', text: STR.tipEndJunction,
      ready: function (c) {
        var s = st(c);
        return (s.phase === 'plan' || s.phase === 'run') && (s.day || 0) >= 3 && (unlocked(c, 'stop') || unlocked(c, 'yield')) && !!portalJunction(c.game);
      },
      enter: function (c, cu) { var n = portalJunction(c.game); cu.data.node = n ? n.id : null; },
      target: function (c) { var n = nodeById(c, c.cur.data.node); return n ? W([n]) : null; },
      avoid: function (c) { var n = nodeById(c, c.cur.data.node); return n ? [W([n])] : null; },
      done: function (c) { var n = nodeById(c, c.cur.data.node); return !!(n && n.tool); } },
    { id: 'tip:hot', mode: 'toast', text: STR.tipHot,
      ready: function (c) { var s = st(c); return s.phase === 'plan' && s.day >= 4 && !!hottest(c.game); },
      enter: function (c, cu) { var n = hottest(c.game); cu.data.node = n ? n.id : null; },
      target: function (c) { var n = nodeById(c, c.cur.data.node); return n ? W([n]) : null; } },
    // pareamento: o plano o poe no dia 8
    { id: 'tip:pair', mode: 'toast', text: STR.tipPair,
      ready: function (c) {
        if (st(c).phase !== 'plan' || st(c).day < 8) return false;
        var L = nodesOf(c.game), i, n = 0;   // conta sem filtrar (roda todo quadro do plano)
        for (i = 0; i < L.length; i++) {
          if (L[i].tool !== 'light') continue;
          if (L[i].pair !== null && L[i].pair !== undefined) return false;
          n++;
        }
        return n >= 2;
      },
      // o chip 'Pair lights' (aparece ao tocar um semaforo) e o alvo quando esta na tela; antes dele, o primeiro semaforo
      target: function (c) {
        if (c.hasEl && c.hasEl('pair-chip')) return { sel: 'pair-chip' };
        var L = withTool(c.game, 'light'); return L.length ? W([L[0]]) : null;
      },
      // o outro semaforo (o segundo toque) e os pontos quentes ficam a vista
      avoid: function (c) { return cityAvoid(c, withTool(c.game, 'light')); },
      done: function (c) {
        var L = nodesOf(c.game), i;
        for (i = 0; i < L.length; i++) if (L[i].tool === 'light' && L[i].pair !== null && L[i].pair !== undefined) return true;
        return false;
      } },
    { id: 'tip:reroll', mode: 'toast', text: STR.reroll, target: T('die'),
      ready: function (c) { var s = st(c); return s.phase === 'plan' && s.day >= 2 && dieBad(c) && canRerollNow(c); },
      done: function (c) { return !!st(c).rerolled; }, on: { dieReroll: true, dieOpen: true } }
    // o antigo 'tip:die' (toast de 9 s depois da cidade) virou o passo principal 'die' do dia 2
  ];
  MAIN.forEach(function (s) { s.kind = 'main'; });
  TOOLS.forEach(function (s) { s.kind = 'tool'; });
  TIPS.forEach(function (s) { s.kind = 'tip'; });
  SAFETY.forEach(function (s) { s.kind = 'safety'; });
  DAILY.forEach(function (s) { s.kind = 'daily'; });

  /* ---------- maquina de passos (sem DOM) ----------
   * o = { game, ui, render, store:{load,save,clear}, view:{show,frame,hide,seal,destroy}, modal(on), blocked() } */
  function createMachine(o) {
    var view = o.view || nullView();
    var store = o.store || memStore();
    var data = sanitize(store.load());
    var c = { game: o.game || { state: {} }, ui: o.ui || null, render: o.render || null, clock: 0, cur: null,
              flags: { sent: false }, lastClearKind: null, ringHint: null, ringId: null,
              phaseAt: 0, lastPh: null, mainAt: -1e9 };   // relogio da troca de fase e do fim do ultimo passo principal
    var started = false, lastTipAt = -1e9, armedUntil = -1, hidden = false;
    c.seen = function (id) { return !!data.seen[id]; };
    c.mark = function (id) { mark(id); };
    c.hasEl = o.hasEl || null;
    c.day = function (id) { return data.seen[id] ? (data.days[id] || 0) : 99; };   // dia em que a dica saiu
    // ultimo dia com Boost bem sucedido (0 = nunca); guardado em data.days['_boost']
    c.boostDay = function () { return data.days._boost || 0; };

    function sanitize(d) {
      var out = { v: 1, seen: {}, days: {}, skipped: false }, k;
      if (d && typeof d === 'object') {
        if (d.seen && typeof d.seen === 'object') for (k in d.seen) if (has(d.seen, k) && d.seen[k]) out.seen[k] = 1;
        if (d.days && typeof d.days === 'object') for (k in d.days) if (has(d.days, k)) out.days[k] = +d.days[k] || 0;
        out.skipped = !!d.skipped;
      }
      return out;
    }
    function save() { try { store.save(data); } catch (e) {} }
    function mark(id) { if (!data.seen[id]) { data.seen[id] = 1; save(); } }
    function modal(on) { try { if (o.modal) o.modal(on); } catch (e) {} }

    function textOf(cu) { var t = cu.step.text; return typeof t === 'function' ? t(c) : t; }
    function targetOf(cu) {
      if (!cu.step.target) return undefined;          // passo sem alvo (centro)
      try { return cu.step.target(c) || null; } catch (e) { return null; }
    }
    function extraOf(cu) {
      if (!cu.step.extra) return null;
      try { return cu.step.extra(c) || null; } catch (e) { return null; }
    }
    // o que o balao nao pode cobrir (alvos no formato de target) e o que some enquanto o passo fala
    function avoidOf(cu) {
      if (!cu.step.avoid) return null;
      try { return cu.step.avoid(c) || null; } catch (e) { return null; }
    }
    function info() {
      var cu = c.cur;
      return {
        id: cu.step.id, mode: cu.mode, text: textOf(cu), target: targetOf(cu), pos: cu.step.pos || null,
        hand: !!(cu.step.hand && cu.t >= HAND_AFTER), escape: cu.mode === 'act' && (cu.step.escapeNow || cu.t >= ESCAPE_AFTER),
        extra: extraOf(cu), icon: cu.step.icon || null, avoid: avoidOf(cu), hide: cu.step.hide || null,
        armed: c.clock < armedUntil, tip: cu.step.kind === 'tip',
        // botao: "Continue" so quando ele retoma o dia pausado (avanco de fluxo); informacao e "Got it"
        // (btn:'ok' no passo: balao que so explica, mesmo pausando, fecha com "Got it")
        btn: cu.step.btn || (cu.data.paused ? 'go' : 'ok'),
        // pass: o escuro so desenha, nao segura o toque (anel com "toque na velocidade OU no cruzamento")
        pass: !!cu.data.pass, alt: cu.data.alt ? STR.slowDown : null
      };
    }
    // pausa do passo (pause:true ou funcao): so no run e so se o jogo ja nao estava pausado por outro (menu)
    function wantsPause(cu) {
      var p = cu.step.pause;
      try { return typeof p === 'function' ? !!p(c) : !!p; } catch (e) { return false; }
    }
    function holdPause(cu) {
      var s = st(c);
      if (!wantsPause(cu) || s.phase !== 'run' || s.paused || !c.game.setPaused) return;
      try { c.game.setPaused(true); cu.data.paused = true; } catch (e) {}
    }
    function releasePause(cu) {
      if (!cu || !cu.data.paused) return;
      cu.data.paused = false;
      try { if (st(c).paused && c.game.setPaused) c.game.setPaused(false); } catch (e) {}
    }
    function alive(cu) {
      var s = cu.step;
      if (s.kind === 'main') return s.win(c) === 'now';
      return st(c).phase === cu.phase0;
    }
    function finish() {
      var cu = c.cur;
      if (!cu) return;
      c.cur = null;
      mark(cu.step.id);
      if (cu.step.kind === 'tip' || cu.step.gap) lastTipAt = c.clock;
      if (cu.step.kind === 'tip' || cu.step.kind === 'daily') { data.days[cu.step.id] = st(c).day || 0; save(); }
      if (cu.step.kind === 'main') c.mainAt = c.clock;
      try { if (cu.step.exit) cu.step.exit(c, cu); } catch (e) {}
      releasePause(cu);
      modal(false);
      view.hide();
    }
    function enter(step) {
      var cu = { step: step, t: 0, missing: 0, phase0: st(c).phase, data: {}, mode: 'continue' };
      c.cur = cu;
      try { cu.mode = typeof step.mode === 'function' ? step.mode(c) : step.mode; } catch (e) { cu.mode = 'continue'; }
      try { if (step.enter) step.enter(c, cu); } catch (e) {}
      if (cu.mode !== 'continue' && step.done && step.done(c)) { finish(); return false; }
      holdPause(cu);
      modal(cu.mode === 'continue');
      view.show(info());
      return true;
    }
    function mainLeft() {
      for (var i = 0; i < MAIN.length; i++) if (!data.seen[MAIN[i].id]) return true;
      return false;
    }
    function safetyReady() {
      for (var i = 0; i < SAFETY.length; i++) if (!data.seen[SAFETY[i].id] && SAFETY[i].ready(c)) return SAFETY[i];
      return null;
    }
    // aviso do anel pronto agora (seguranca ou lembrete do dia): passa na frente de qualquer balao
    function urgentReady() {
      var s = safetyReady(), i;
      if (s) return s;
      for (i = 0; i < DAILY.length; i++) {
        s = DAILY[i];
        if ((data.days[s.id] || 0) !== (st(c).day || 0) && s.ready(c)) return s;
      }
      return null;
    }
    // tira o balao da tela sem marcar visto: ele volta depois do aviso urgente
    function requeue() {
      var cu = c.cur;
      if (!cu) return;
      c.cur = null;
      try { if (cu.step.exit) cu.step.exit(c, cu); } catch (e) {}
      releasePause(cu);
      modal(false);
      view.hide();
    }
    function pickNext() {
      var i, s, w;
      s = safetyReady();
      if (s) return s;
      // lembrete diario: uma vez por dia (data.days[id] = dia em que saiu), tambem com o tutorial pulado
      for (i = 0; i < DAILY.length; i++) {
        s = DAILY[i];
        if ((data.days[s.id] || 0) !== (st(c).day || 0) && s.ready(c)) return s;
      }
      if (data.skipped) return null;       // pulou: so a seguranca continua
      for (i = 0; i < MAIN.length; i++) {
        s = MAIN[i];
        if (data.seen[s.id]) continue;
        w = s.win(c);
        if (w === 'past') { mark(s.id); continue; }   // janela passou (recarga, jogo salvo adiantado)
        if (w === 'now') {
          var waiting = false;
          try { waiting = !!(s.wait && s.wait(c)); } catch (e) {}
          if (waiting) break;                                    // ainda cedo (ex.: carros andando antes da pausa)
          if (s.need && !s.need(c)) { mark(s.id); continue; }   // nada a dizer (ex.: nao construiu)
          return s;
        }
        break;                                        // futuro: o roteiro espera
      }
      if (!mainLeft() && !data.seen.seal) { mark('seal'); try { view.seal(STR.seal); } catch (e) {} }
      // varias ferramentas novas de uma vez (save adiantado, replay): so a mais nova ganha cartao
      var cards = [];
      for (i = 0; i < TOOLS.length; i++) if (TOOLS[i].card && !data.seen[TOOLS[i].id] && TOOLS[i].ready(c)) cards.push(TOOLS[i]);
      for (i = 0; i < cards.length - 1; i++) mark(cards[i].id);
      for (i = 0; i < TOOLS.length; i++) {
        s = TOOLS[i];
        if (!data.seen[s.id] && s.ready(c)) return s;
      }
      var gapOk = c.clock - lastTipAt >= TIP_GAP;
      {
        for (i = 0; i < TIPS.length; i++) {
          s = TIPS[i];
          if (!gapOk && !s.nogap) continue;
          if (!data.seen[s.id] && s.ready(c)) return s;
        }
      }
      return null;
    }

    function update(dt) {
      if (!started) return;
      dt = dt > 0 ? dt : 0;
      c.clock += dt;
      if (c.ringId !== null && c.ringId !== undefined) {   // pico do no do anel: a queda real do 'Nice'
        var pn = nodeById(c, c.ringId), ps = pn ? pn.stress || 0 : 0;
        if (!(c.ringPeak >= ps)) c.ringPeak = ps;
      }
      var ph0 = st(c).phase;
      var dy0 = st(c).day || 0;
      if (ph0 !== c.lastPh || dy0 !== c.lastDay) {   // fase ou dia novo: o 'Nice' pendente e a causa dele caem
        if (c.cur && c.cur.step.id === 'tip:ringNice') finish();
        c.niceAct = false; c.niceBoostAt = null; c.niceSince = null; c.ringPeak = 0;
        c.lastDay = dy0;
      }
      if (ph0 !== c.lastPh) { c.lastPh = ph0; c.phaseAt = c.clock; }
      var blocked = false;
      try { blocked = !!(o.blocked && o.blocked()); } catch (e) {}
      if (blocked) {            // menu/tela de inicio aberta: congela o passo atual
        if (!hidden) { hidden = true; view.hide(); }
        try { if (o.release) o.release(); } catch (e) {}
        return;
      }
      if (hidden) { hidden = false; if (c.cur) { modal(c.cur.mode === 'continue'); view.show(info()); } }
      var cu = c.cur;
      // o aviso do anel passa na frente de qualquer outro balao, sem esperar o Continue: um toast/nudge
      // sai (visto); um balao com botao volta depois
      if (cu && cu.step.kind !== 'safety' && cu.step.kind !== 'daily') {
        var urg = urgentReady();
        if (urg && urg !== cu.step) {
          if (cu.mode === 'toast' || cu.mode === 'nudge') finish(); else requeue();
          cu = null;
        }
      }
      if (cu) {
        cu.t += dt;
        if (!alive(cu)) finish();
        else if (cu.mode !== 'continue' && cu.step.done && cu.step.done(c)) finish();
        // 'nudge' fica ate agir ou tocar; o cartao de ferramenta nova (botao Got it) tambem: sem timeout
        // (2026-11-09: Stop no dia 3 e Yield no dia 4 sumiam sozinhos em 9 s, antes da leitura)
        else if (cu.mode === 'toast' && !cu.step.card && cu.t >= (cu.step.life || TOAST_LIFE)) finish();
      }
      var guard = 0;
      while (!c.cur && guard++ < 40) {
        var nx = pickNext();
        if (!nx) break;
        enter(nx);
      }
      if (c.cur) {
        if (c.cur.mode === 'continue') modal(true);   // outro modulo pode ter tirado a classe
        var inf = info(), found = view.frame(inf);
        if (inf.target !== undefined && !found) {
          c.cur.missing += dt;
          if (c.cur.missing >= MISSING_GRACE) finish(); // alvo nao existe: pula sem quebrar
        } else c.cur.missing = 0;
      }
    }

    function handleUI(d) {
      if (!d) return;
      if (d.type === 'dieOpen') {
        // folha do dado abriu: a apresentacao do dado acabou (a folha explica o resto) e nada fica por cima.
        // So conta a partir do dia 2 (antes disso o dado nem aparece).
        if (c.cur && c.cur.step.id === 'die') finish();
        if ((st(c).day || 0) >= 2) mark('die');
        if (c.cur && c.cur.step.on && c.cur.step.on.dieOpen) finish();
        if (c.cur && !hidden) { hidden = true; view.hide(); }   // volta no update, quando a folha fechar
        return;
      }
      // toque num no com o dia pausado pelo tutorial: despausa antes do Boost da UI (useClear recusa pausado)
      if (d.type === 'nodeTap' && c.cur && c.cur.data.paused && !hidden && c.cur.mode !== 'continue') releasePause(c.cur);
      if ((d.type === 'speedChanged' || d.type === 'roadBuilt') && c.ringId !== null && c.ringId !== undefined) c.niceAct = true;
      if (d.type === 'clearUsed') {
        var kind = d.kind || c.lastClearKind;
        if (d.ok && kind === 'send') c.flags.sent = true;
        if (d.ok && kind !== 'send' && c.ringId !== null && c.ringId !== undefined) { c.niceBoostAt = c.clock; }
        // Boost do dia (o lembrete diario so volta se ontem nao houve Boost)
        if (d.ok && (st(c).day || 0) > (data.days._boost || 0)) { data.days._boost = st(c).day || 0; save(); }
        c.lastClearKind = null;
        // ponta cheia no passo de mandar o carro: marca, aponta outra; sem outra, o dia segue
        if (!d.ok && d.reason === 'space' && c.cur && c.cur.step.id === 'run') {
          var fu = c.cur.data.full || (c.cur.data.full = {});
          if (d.id !== null && d.id !== undefined) fu[d.id] = 1;
          if (!sendPortal(c)) { finish(); return; }
          view.show(info());
        }
        // Boost recusado no passo que pausa: volta a pausar ate a jogadora acertar
        if (!d.ok && c.cur && wantsPause(c.cur) && c.cur.mode === 'act') holdPause(c.cur);
      }
      var cu = c.cur;
      if (!cu || !cu.step.on || hidden) return;
      var v = cu.step.on[d.type];
      if (!v) return;
      var okv = false;
      try { okv = v === true || (typeof v === 'function' && v(d, c)); } catch (e) {}
      if (okv) finish();
    }
    // evento do jogo 'clear' (vem antes do crz:ui clearUsed): deduz o tipo se a UI nao mandar kind
    function handleGame(ev) {
      if (ev && ev.type === 'stress' && ev.value >= STRESS_TIP && (c.ringHint === null || c.ringHint === undefined)) c.ringHint = ev.nodeId;
      if (!ev || ev.type !== 'clear') return;
      var n = nodeById(c, ev.nodeId);
      // o game diz o tipo no evento; sem ele, so ponta de uma estrada manda carro
      c.lastClearKind = ev.kind === 'send' || ev.kind === 'clear' ? ev.kind : (n && n.portal && deg(n) < 2 ? 'send' : 'clear');
    }
    function cont() {
      if (!c.cur) return;
      if (c.cur.mode !== 'act' || c.cur.step.escapeNow || c.cur.t >= ESCAPE_AFTER) finish();
    }
    // 'Slow down' do balao do anel: 2x, fica ate a jogadora mudar; fecha o balao
    function slow() {
      if (!c.cur || !c.cur.data.alt) return;
      try { if (c.game.setSpeed) c.game.setSpeed(2); else st(c).speed = 2; } catch (e) {}
      c.niceAct = true;
      finish();
    }
    function tap() { if (c.cur && (c.cur.mode === 'toast' || c.cur.mode === 'nudge')) finish(); }
    // toque no escuro em volta do alvo: a maozinha aparece na hora (antes so depois de 15 s)
    function dimTap() { if (c.cur && c.cur.mode === 'act' && c.cur.step.hand) c.cur.t = Math.max(c.cur.t, HAND_AFTER); }
    function skipTap() {
      if (c.clock < armedUntil) { skip(); return true; }
      armedUntil = c.clock + ARM_TIME;
      if (c.cur) view.frame(info());
      return false;
    }
    function dropCur() {
      var cu = c.cur;
      c.cur = null;
      if (cu) { try { if (cu.step.exit) cu.step.exit(c, cu); } catch (e) {} releasePause(cu); }
      modal(false);
      view.hide();
    }
    function skip() { data.skipped = true; save(); dropCur(); }   // o anel vermelho (SAFETY) ainda aparece uma vez
    function replay() {
      dropCur();
      try { store.clear(); } catch (e) {}
      data = sanitize(null);
      lastTipAt = -1e9; armedUntil = -1; started = true;
    }
    function destroy() { dropCur(); started = false; try { view.destroy(); } catch (e) {} }

    return {
      start: function () { started = true; },
      skip: skip, replay: replay, destroy: destroy, update: update,
      isActive: function () { return !!c.cur && !hidden; },
      handleUI: handleUI, handleGame: handleGame, cont: cont, slow: slow, tap: tap, skipTap: skipTap, dimTap: dimTap,
      current: function () { return c.cur ? c.cur.step.id : null; },
      mode: function () { return c.cur ? c.cur.mode : null; },
      info: function () { return c.cur ? info() : null; },
      data: function () { return data; },
      ctx: c
    };
  }

  function nullView() {
    return { show: function () {}, frame: function () { return true; }, hide: function () {}, seal: function () {}, destroy: function () {} };
  }
  function memStore() {
    var v = null;
    return { load: function () { return v ? JSON.parse(v) : null; }, save: function (d) { v = JSON.stringify(d); }, clear: function () { v = null; } };
  }
  function lsStore() {
    function ls() { try { return root.localStorage || null; } catch (e) { return null; } }
    return {
      load: function () { try { var s = ls(); return s ? JSON.parse(s.getItem(KEY) || 'null') : null; } catch (e) { return null; } },
      save: function (d) { try { var s = ls(); if (s) s.setItem(KEY, JSON.stringify(d)); } catch (e) {} },
      clear: function () { try { var s = ls(); if (s) s.removeItem(KEY); } catch (e) {} }
    };
  }

  /* ---------- geometria do balao (puro) ---------- */

  // t = retangulo do alvo {x,y,w,h} ou null; s = safe-area {t,r,b,l}. Retorna {x,y,side,arrowX}.
  // hud (opcional) = {top, bottom}: faixa util entre o HUD de cima e o de baixo, em px de tela.
  // Alvo dentro do HUD de baixo (ladrilho, play): o balao fica acima do HUD inteiro (nao cobre pontos,
  // Boost, enquadrar nem a primeira linha de ferramentas). Alvo no topo: abaixo do HUD de cima.
  // Alvo no mapa: o balao fica dentro da faixa util quando cabe.
  // avoid (opcional) = lista de retangulos que o balao nao pode cobrir (o ponto de mundo de que o texto
  // fala, ex.: a ponta nova do "The city grew"). O alvo de mapa entra sozinho na lista: o clamp na faixa
  // util podia empurrar o balao para cima do proprio alvo. Tenta deslizar para o lado, depois para
  // cima ou para baixo do que esta coberto; sem lugar livre, fica a posicao base.
  function placeBalloon(t, bw, bh, vw, vh, s, pos, hud, avoid) {
    var base = placeBase(t, bw, bh, vw, vh, s, pos, hud);
    var L = [], i;
    if (avoid) for (i = 0; i < avoid.length; i++) if (avoid[i]) L.push(avoid[i]);
    if (t && base.side !== 'none' && !(hud && t.y + t.h / 2 > hud.bottom) && !(hud && t.y + t.h / 2 < hud.top)) L.push(t);
    if (!L.length || !coversAny(base.x, base.y, bw, bh, L)) return base;
    s = s || { t: 0, r: 0, b: 0, l: 0 };
    var G = 12, A = 12, minX = s.l + G, maxX = Math.max(minX, vw - s.r - G - bw);
    var minY = s.t + G, maxY = Math.max(minY, vh - s.b - G - bh);
    if (hud && isFinite(hud.top) && isFinite(hud.bottom)) { minY = Math.max(minY, hud.top); maxY = Math.max(minY, Math.min(maxY, hud.bottom - bh)); }
    var cx = t ? t.x + t.w / 2 : vw / 2, cand = [], r;
    for (i = 0; i < L.length; i++) {
      r = L[i];
      cand.push([r.x + r.w + 8, base.y], [r.x - 8 - bw, base.y]);          // ao lado, mesma altura
      cand.push([base.x, r.y - A - bh], [base.x, r.y + r.h + A]);          // acima, abaixo
    }
    // por ultimo, o topo e a base da faixa util (a regiao livre longe da cidade)
    cand.push([base.x, minY], [base.x, maxY]);
    function pick(list) {
      for (var k = 0; k < cand.length; k++) {
        var x = cand[k][0], y = cand[k][1];
        if (x < minX - 0.5 || x > maxX + 0.5 || y < minY - 0.5 || y > maxY + 0.5) continue;
        if (coversAny(x, y, bw, bh, list)) continue;
        var side = base.side;
        if (t && side !== 'none') side = y + bh <= t.y ? 'above' : (y >= t.y + t.h ? 'below' : 'none');
        return { x: x, y: y, side: side, arrowX: side === 'none' ? 0 : clamp(cx - x, 18, bw - 18) };
      }
      return null;
    }
    var got = pick(L);
    if (got) return got;
    // sem lugar livre de tudo: larga o que e "soft" (a caixa da cidade inteira) e guarda o essencial
    // (o pior ponto, os nos da dica, as linhas do resumo)
    var hard = L.filter(function (q) { return !q.soft; });
    if (hard.length && hard.length < L.length) {
      if (!coversAny(base.x, base.y, bw, bh, hard)) return base;
      got = pick(hard);
      if (got) return got;
    }
    return base;
  }
  function coversAny(x, y, w, h, L) {
    for (var i = 0; i < L.length; i++) {
      var r = L[i];
      if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return true;
    }
    return false;
  }
  function placeBase(t, bw, bh, vw, vh, s, pos, hud) {
    var G = 12, A = 12;
    s = s || { t: 0, r: 0, b: 0, l: 0 };
    var minX = s.l + G, maxX = vw - s.r - G - bw;
    if (maxX < minX) minX = maxX = Math.max(0, (vw - bw) / 2);
    var minY = s.t + G, maxY = Math.max(minY, vh - s.b - G - bh);
    if (!t) return { x: clamp((vw - bw) / 2, minX, maxX), y: clamp((vh - bh) / 2, minY, maxY), side: 'none', arrowX: 0 };
    var cx = t.x + t.w / 2, x = clamp(cx - bw / 2, minX, maxX), y, side;
    if (hud && isFinite(hud.top) && isFinite(hud.bottom) && hud.bottom - hud.top > bh + 2 * A) {
      var cy = t.y + t.h / 2;
      if (cy > hud.bottom) {
        y = clamp(Math.min(t.y, hud.bottom) - A - bh, minY, maxY);
        return { x: x, y: y, side: 'above', arrowX: clamp(cx - x, 18, bw - 18) };
      }
      if (cy < hud.top) {
        y = clamp(Math.max(t.y + t.h, hud.top) + A, minY, maxY);
        return { x: x, y: y, side: 'below', arrowX: clamp(cx - x, 18, bw - 18) };
      }
      minY = Math.max(minY, hud.top);
      maxY = Math.max(minY, Math.min(maxY, hud.bottom - bh));
    }
    if (pos === 'top') {
      y = s.t + 56;
      if (y + bh <= t.y - 8 || y >= t.y + t.h + 8) return { x: x, y: y, side: 'none', arrowX: 0 };
    }
    var above = t.y - A - minY, below = (vh - s.b - G) - (t.y + t.h + A);
    var fitA = above >= bh, fitB = below >= bh;
    if (fitA && fitB) side = above >= below ? 'above' : 'below';
    else if (fitA) side = 'above';
    else if (fitB) side = 'below';
    else side = above >= below ? 'above' : 'below';
    y = side === 'above' ? t.y - A - bh : t.y + t.h + A;
    y = clamp(y, minY, maxY);
    return { x: x, y: y, side: side, arrowX: clamp(cx - x, 18, bw - 18) };
  }
  // alvo de mundo fora da tela: sp = ponto do alvo em px de tela; m = margens do HUD {top,bottom,left,right}.
  // Retorna a ponta da seta na borda da area util (ax, ay, ang) e o balao junto dela, sem cobri-la.
  function edgePlace(sp, bw, bh, vw, vh, s, m) {
    s = s || { t: 0, r: 0, b: 0, l: 0 }; m = m || {};
    var L = Math.max(s.l, m.left || 0) + 22, R = vw - Math.max(s.r, m.right || 0) - 22;
    var T = Math.max(s.t, m.top || 0) + 22, B = vh - Math.max(s.b, m.bottom || 0) - 22;
    if (R < L) L = R = vw / 2;
    if (B < T) T = B = vh / 2;
    var cx = (L + R) / 2, cy = (T + B) / 2, dx = sp.x - cx, dy = sp.y - cy;
    if (!dx && !dy) dy = -1;
    var tx = dx > 0 ? (R - cx) / dx : (dx < 0 ? (L - cx) / dx : Infinity);
    var ty = dy > 0 ? (B - cy) / dy : (dy < 0 ? (T - cy) / dy : Infinity);
    var k = Math.min(tx, ty), ax = cx + dx * k, ay = cy + dy * k, vert = ty <= tx;   // vert: bateu em cima ou embaixo
    var G = 12, minX = s.l + G, maxX = Math.max(minX, vw - s.r - G - bw), minY = s.t + G, maxY = Math.max(minY, vh - s.b - G - bh), x, y;
    if (vert) {
      x = clamp(ax - bw / 2, minX, maxX);
      y = dy < 0 ? ay + 22 : ay - 22 - bh;
    } else {
      y = clamp(ay - bh / 2, minY, maxY);
      x = dx < 0 ? ax + 22 : ax - 22 - bw;
    }
    return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY), ax: ax, ay: ay, ang: Math.atan2(dy, dx) };
  }
  function overlaps(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

  // direcao da maozinha: a mais perto de "para fora do centro" cujo fim cabe na area util
  function handVector(sp, wp, zoom, vw, vh, m) {
    var L = clamp(110 * (zoom || 1), 70, 150), base = Math.atan2(wp.y || 0, wp.x || 1);
    var cands = [], k;
    for (k = 0; k < 8; k++) cands.push(k * Math.PI / 4);
    cands.sort(function (a, b) { return angD(a, base) - angD(b, base); });
    m = m || { top: 60, bottom: 150 };
    for (k = 0; k < cands.length; k++) {
      var ex = sp.x + L * Math.cos(cands[k]), ey = sp.y + L * Math.sin(cands[k]);
      if (ex >= 24 && ex <= vw - 24 && ey >= m.top && ey <= vh - m.bottom) return { dx: Math.round(ex - sp.x), dy: Math.round(ey - sp.y) };
    }
    return { dx: Math.round(L * Math.cos(base)), dy: Math.round(L * Math.sin(base)) };
  }
  function angD(a, b) { var d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; }

  /* ---------- vista em DOM ---------- */

  var CSS = [
    '.crz-tut{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:60;font-family:-apple-system,system-ui,"Helvetica Neue",Helvetica,Arial,sans-serif;color:#111}',
    '.crz-tut-dim{position:fixed;left:0;top:0;width:0;height:0;background:rgba(17,17,17,.34);pointer-events:auto;display:none}',
    '.crz-tut.block .crz-tut-dim{display:block}',
    // pass: o escuro so desenha; o toque passa para o mapa e o HUD
    '.crz-tut.pass .crz-tut-dim{pointer-events:none}',
    '.crz-tut-hole{position:fixed;pointer-events:auto;display:none}',
    '.crz-tut.continue .crz-tut-hole{display:block}',
    '.crz-tut-ring{position:fixed;box-sizing:border-box;border:2px solid #d9261c;border-radius:14px;pointer-events:none;display:none}',
    '.crz-tut-ring.on{display:block}',
    '.crz-tut-ring::after{content:"";position:absolute;left:-2px;top:-2px;right:-2px;bottom:-2px;border:2px solid #d9261c;border-radius:inherit;animation:crz-tut-pulse 1.4s ease-out infinite}',
    '.crz-tut-box{position:fixed;left:0;top:0;box-sizing:border-box;max-width:300px;background:#fff;color:#111;border:1px solid #111;border-radius:14px;padding:12px 14px 6px;pointer-events:auto;display:none;-webkit-user-select:none;user-select:none}',
    '.crz-tut-box.on{display:block}',
    '.crz-tut-ico{display:none;float:left;width:30px;height:30px;margin:1px 10px 0 0}.crz-tut-ico.on{display:block}.crz-tut-ico svg{width:30px;height:30px;display:block}',
    '.crz-tut-txt{margin:0;font-size:15px;line-height:1.35;font-weight:500;letter-spacing:-.1px}',
    '.crz-tut-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px}',
    '.crz-tut button{font:inherit;color:inherit;background:none;border:0;margin:0;padding:0;-webkit-appearance:none;appearance:none;touch-action:manipulation;cursor:pointer}',
    // #8a8a8a dava 3,4:1 no branco; #666 da 5,7:1. ::after estende o toque a 44 px sem mudar o desenho
    '.crz-tut .crz-tut-skip{font-size:12px;color:#666;min-height:40px;padding:0 2px;text-align:left;position:relative}',
    '.crz-tut .crz-tut-skip::after,.crz-tut .crz-tut-go::after{content:"";position:absolute;left:50%;top:50%;width:100%;height:100%;min-width:44px;min-height:44px;transform:translate(-50%,-50%)}',
    '.crz-tut .crz-tut-skip.armed{color:#d9261c}',
    '.crz-tut .crz-tut-go{font-size:15px;font-weight:700;min-height:40px;min-width:44px;padding:0 16px;border-radius:20px;background:#111;color:#fff;display:none;position:relative}',
    '.crz-tut .crz-tut-go.on{display:block}',
    '.crz-tut-arrow{position:absolute;width:12px;height:12px;margin-left:-7px;background:#fff;border:1px solid #111;transform:rotate(45deg);display:none}',
    '.crz-tut-box.below .crz-tut-arrow{display:block;top:-7px;border-right:0;border-bottom:0}',
    '.crz-tut-box.above .crz-tut-arrow{display:block;bottom:-7px;border-left:0;border-top:0}',
    '.crz-tut.edge .crz-tut-dim,.crz-tut.edge .crz-tut-hole{display:none}',
    '.crz-tut-edge{position:fixed;width:28px;height:28px;margin:-14px 0 0 -14px;background:#d9261c;clip-path:polygon(0 12%,100% 50%,0 88%);pointer-events:none;display:none}',
    '.crz-tut-edge.on{display:block}',
    '.crz-tut-hand{position:fixed;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(17,17,17,.55);border:2px solid #fff;box-sizing:border-box;pointer-events:none;display:none;animation:crz-tut-hand 1.7s ease-in-out infinite}',
    '.crz-tut-hand.on{display:block}',
    // selo abaixo do toast (.crz-say, sat+58), do banner do dia (sat+104..140) e do Undo (sat+140..184): sat+192
    '.crz-tut-seal{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 192px);transform:translateX(-50%);background:#fff;border:1px solid #111;border-radius:14px;padding:6px 12px;font-size:12px;opacity:0;pointer-events:none;transition:opacity .5s;white-space:nowrap}',
    '.crz-tut-seal.on{opacity:1}',
    '@keyframes crz-tut-pulse{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.18);opacity:0}}',
    '@keyframes crz-tut-hand{0%{transform:translate(0,0) scale(.8);opacity:0}15%{transform:translate(0,0) scale(1);opacity:1}75%{transform:translate(var(--dx,80px),var(--dy,0px));opacity:1}100%{transform:translate(var(--dx,80px),var(--dy,0px));opacity:0}}',
    '@media (prefers-reduced-motion: reduce){.crz-tut-ring::after{animation:none;display:none}.crz-tut-hand{animation:none;transform:translate(var(--dx,80px),var(--dy,0px))}.crz-tut-seal{transition:none}}'
  ].join('\n');

  // fallback de seletores caso algum data-tut falte
  var FALLBACK = {
    play: '.crz-play', budget: '.crz-budget', tray: '.crz-tray', undo: '.crz-undo', dots: '.crz-dots',
    clear: '.crz-clear', speed: '.crz-speed', bonus: '.crz-bonus', die: '.crz-die', strikes: '.crz-top .crz-strikes', summary: '.crz-sum .crz-panel', over: '.crz-over',
    'card-0': '.crz-cards .crz-card:nth-child(1)', 'card-1': '.crz-cards .crz-card:nth-child(2)',
    'card-2': '.crz-cards .crz-card:nth-child(3)'
  };
  // rotulo do ladrilho no ui.js (fallback se data-tut faltar)

  function createView(doc, render, h) {
    var win = doc.defaultView || root;
    if (!doc.getElementById('crz-tut-style')) {
      var sty = doc.createElement('style'); sty.id = 'crz-tut-style'; sty.textContent = CSS;
      (doc.head || doc.body).appendChild(sty);
    }
    var host = doc.getElementById('crz-overlay-root'), madeHost = false;
    if (!host) {
      host = doc.createElement('div'); host.id = 'crz-overlay-root';
      host.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:20';
      doc.body.appendChild(host); madeHost = true;
    }
    function el(tag, cls, parent) { var e = doc.createElement(tag); e.className = cls; (parent || wrap).appendChild(e); return e; }
    var wrap = doc.createElement('div'); wrap.className = 'crz-tut';
    host.appendChild(wrap);
    var dims = [el('div', 'crz-tut-dim'), el('div', 'crz-tut-dim'), el('div', 'crz-tut-dim'), el('div', 'crz-tut-dim')];
    var hole = el('div', 'crz-tut-hole');
    var ring = el('div', 'crz-tut-ring');
    var ring2 = el('div', 'crz-tut-ring'), ring3 = el('div', 'crz-tut-ring');
    var hand = el('div', 'crz-tut-hand');
    var edgeArrow = el('div', 'crz-tut-edge');
    var pressed = false, revPts = null, curInf = null;
    var box = el('div', 'crz-tut-box');
    box.setAttribute('role', 'dialog');
    var arrow = el('div', 'crz-tut-arrow', box);
    var ico = el('span', 'crz-tut-ico', box);
    var txt = el('p', 'crz-tut-txt', box);
    var row = el('div', 'crz-tut-row', box);
    var skipB = el('button', 'crz-tut-skip', row); skipB.type = 'button';
    var altB = el('button', 'crz-tut-go crz-tut-alt', row); altB.type = 'button'; altB.textContent = STR.slowDown;
    var goB = el('button', 'crz-tut-go', row); goB.type = 'button'; goB.textContent = STR.go;
    var seal = el('div', 'crz-tut-seal');
    var probe = el('div', '', wrap);
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    var safe = { t: 0, r: 0, b: 0, l: 0 };
    var dirty = true, last = {}, textKey = null, bw = 0, bh = 0, sealTimer = null;
    // posicao do balao: os numeros que a decidem, num vetor reusado (last.place = vetor valido)
    var placeK = [], handK = [], handV = [0, 0, 0, 0], extraK = [[], []], extraV = [0, 0, 0, 0];
    function sameNums(arr, vals) {
      var i, same = arr.length === vals.length;
      for (i = 0; i < vals.length; i++) { if (arr[i] !== vals[i]) same = false; arr[i] = vals[i]; }
      arr.length = vals.length;
      return same;
    }
    var placeV = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    function placeChanged(r, vs, hb, edgeSp, av) {
      var v = placeV, a0 = av && av[0];
      v[0] = r ? r.x : -1; v[1] = r ? r.y : -1; v[2] = r ? r.w : -1; v[3] = r ? r.h : -1;
      v[4] = vs.w; v[5] = vs.h; v[6] = bh; v[7] = Math.round(hb.top); v[8] = Math.round(hb.bottom);
      v[9] = edgeSp ? Math.round(edgeSp.x) : -1e9; v[10] = edgeSp ? Math.round(edgeSp.y) : -1e9;
      v[11] = a0 ? a0.x : -1e9; v[12] = a0 ? a0.y : -1e9;   // o ponto a nao cobrir anda com a camera
      var same = sameNums(placeK, v);
      if (same && last.place) return false;
      last.place = true;
      return true;
    }
    var bound = [];
    function on(t, type, fn) { t.addEventListener(type, fn); bound.push([t, type, fn]); }
    function stop(e) { if (e && e.stopPropagation) e.stopPropagation(); }

    on(altB, 'click', function (e) { stop(e); h.slow(); });
    on(goB, 'click', function (e) { stop(e); h.cont(); });
    on(skipB, 'click', function (e) { stop(e); h.skipTap(); });
    on(box, 'click', function (e) { if (e.target !== skipB && e.target !== goB && e.target !== altB) h.tap(); });
    on(box, 'pointerdown', stop);
    // toque fora do buraco num passo de agir (o arrasto comecou fora da ponta): mostra a maozinha ja
    // dentro de 1,7x o raio de toque de um ponto do mapa que o passo pede para tocar/arrastar, o toque no
    // escuro e repassado ao canvas (o dedo na ponta do no, a 25-35 px do centro, nao some no dim)
    function pickRad() {
      var z = (render && render.camera && render.camera.zoom) || 1;
      if (render && render.pickRadius) { var pr = render.pickRadius(); if (pr > 0) return pr; }
      var base = (CRZ.CFG && CRZ.CFG.nodePickRadius) || 26;
      return clamp(base * (z < 1 ? Math.sqrt(1 / z) : 1), 22, 44);
    }
    function forwardTap(e) {
      var inf = curInf, t = inf && inf.target;
      if (!inf || inf.mode !== 'act' || !t || !t.world || !render || !render.toScreen || !e) return false;
      var cx = e.clientX, cy = e.clientY, R = pickRad() * HOLE_K, i, p, dx, dy, hit = false;
      if (!isFinite(cx) || !isFinite(cy)) return false;
      for (i = 0; i < t.world.length && !hit; i++) {
        p = render.toScreen(t.world[i].x, t.world[i].y); dx = p.x - cx; dy = p.y - cy;
        if (dx * dx + dy * dy <= R * R) hit = true;
      }
      if (!hit) return false;
      var cv = (render && render.canvas) || doc.getElementById('stage');
      if (!cv || !cv.dispatchEvent) return false;
      var Ev = win.PointerEvent || win.MouseEvent;
      if (typeof Ev !== 'function') return false;
      try {
        cv.dispatchEvent(new Ev('pointerdown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy,
          pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, button: e.button, buttons: e.buttons }));
        return true;
      } catch (x) { return false; }
    }
    dims.forEach(function (d) { on(d, 'pointerdown', function (e) { stop(e); if (forwardTap(e)) return; if (h.dimTap) h.dimTap(); }); });
    // dedo na tela (arrastando o mapa): nao mexer na camera por baixo dele
    on(doc, 'pointerdown', function () { pressed = true; });
    on(doc, 'pointerup', function () { pressed = false; });
    on(doc, 'pointercancel', function () { pressed = false; });
    // Safari perde o pointerup (app em segundo plano, aba trocada, alerta do sistema): sem isto
    // pressed ficava true e o balao nunca mais trazia o alvo para a tela
    function unpress() { pressed = false; }
    on(doc, 'visibilitychange', unpress);
    if (win && win.addEventListener) {
      on(win, 'pagehide', unpress);
      on(win, 'blur', unpress);
      on(win, 'resize', function () { dirty = true; });
      on(win, 'orientationchange', function () { dirty = true; });
    }

    function readSafe() {
      try {
        var cs = win.getComputedStyle(probe);
        safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0,
                 b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
      } catch (e) {}
    }
    function vsize() {
      var de = doc.documentElement || {};
      return { w: win.innerWidth || de.clientWidth || 390, h: win.innerHeight || de.clientHeight || 720 };
    }
    function visible(e) {
      if (!e || !e.getBoundingClientRect) return null;
      var r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return null;
      try { var cs = win.getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return null; } catch (x) {}
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    // elemento do alvo guardado por nome; vale enquanto esta no documento e (se veio por data-tut)
    // ainda leva o mesmo data-tut (o play vira 'speed' no run, o dado perde o seu no dia 1)
    var elCache = {};
    function lookup(name) {
      var c = elCache[name], e = null;
      if (c && c.e.isConnected !== false && (!c.tut || (c.e.getAttribute && c.e.getAttribute('data-tut') === name))) return c.e;
      var tutHit = false;
      try { e = doc.querySelector('[data-tut="' + name + '"]'); tutHit = !!e; } catch (x) {}
      if (!e && FALLBACK[name]) { try { e = doc.querySelector(FALLBACK[name]); } catch (x) {} }
      if (!e && name.indexOf('tool-') === 0) {
        var lab = CRZ.UI && CRZ.UI.STR && CRZ.UI.STR.tools && CRZ.UI.STR.tools[name.slice(5)];
        if (lab) { try { e = doc.querySelector('.crz-tile[aria-label="' + lab + '"]'); } catch (x) {} }
      }
      if (e) elCache[name] = { e: e, tut: tutHit }; else delete elCache[name];
      return e;
    }
    // medida do alvo de DOM: le o layout so ao trocar de passo, ao mudar a tela, ou a cada 250 ms
    // (cobre o painel que desliza e a bandeja que cresce). Antes: getBoundingClientRect e
    // getComputedStyle todo quadro
    var rectCache = {}, MEASURE_MS = 250;
    function find(name) {
      var now = Date.now(), rc = rectCache[name];
      if (rc && now - rc.at < MEASURE_MS) return rc.r;
      var r = visible(lookup(name));
      rectCache[name] = { r: r, at: now };
      return r;
    }
    // faixa util entre o HUD de cima e o de baixo (relida no maximo a cada 400 ms)
    var hudCache = null, hudAt = 0;
    function hudBand(vs) {
      var now = Date.now();
      if (hudCache && now - hudAt < 400) return hudCache;
      var top = 0, bottom = vs.h, sels = ['.crz-bottom', '[data-tut="fit"]', '.crzm-pausebtn.show', '.crz-clear'], i, r;
      r = visibleQ('.crz-top'); if (r) top = r.y + r.h;
      // faixa de aviso da UI aberta (recusa, dica): o balao desce para nao cobri-la
      r = visibleQ('.crz-say.show'); if (r && r.y + r.h > top) top = r.y + r.h;
      for (i = 0; i < sels.length; i++) { r = visibleQ(sels[i]); if (r && r.y < bottom && r.y > vs.h * 0.4) bottom = r.y; }
      hudCache = { top: top, bottom: bottom }; hudAt = now;
      return hudCache;
    }
    function visibleQ(q) { var e = null; try { e = doc.querySelector(q); } catch (x) {} return visible(e); }
    function union(a, b) {
      if (!a) return b; if (!b) return a;
      var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      return { x: x, y: y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
    }
    function resolve(d, big) {
      var r = null, i, P = 6;
      if (!d) return null;
      if (d.sel) r = find(d.sel);
      if (d.sels) for (i = 0; i < d.sels.length; i++) r = union(r, find(d.sels[i]));
      if (d.world && render && render.toScreen) {
        var zoom = (render.camera && render.camera.zoom) || 1, rad = Math.max(24, 18 * zoom);
        if (big) rad = Math.max(rad, pickRad() * HOLE_K);   // passo de agir: buraco >= alcance do toque do mapa
        for (i = 0; i < d.world.length; i++) {
          var p = render.toScreen(d.world[i].x, d.world[i].y);
          if (!isFinite(p.x) || !isFinite(p.y)) continue;
          r = union(r, { x: p.x - rad, y: p.y - rad, w: rad * 2, h: rad * 2 });
        }
        P = 0;
      }
      if (!r) return null;
      var vs = vsize();
      r = { x: r.x - P, y: r.y - P, w: r.w + 2 * P, h: r.h + 2 * P };
      var x0 = clamp(r.x, 0, vs.w), y0 = clamp(r.y, 0, vs.h), x1 = clamp(r.x + r.w, 0, vs.w), y1 = clamp(r.y + r.h, 0, vs.h);
      if (x1 - x0 < 4 || y1 - y0 < 4) return null;   // fora da tela
      return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
    }
    function put(e, x, y, w, hh) {
      var s = e.style;
      s.left = x + 'px'; s.top = y + 'px'; s.width = Math.max(0, w) + 'px'; s.height = Math.max(0, hh) + 'px';
    }
    function setCls(mode, pass) {
      var block = mode === 'continue' || mode === 'act';
      wrap.className = 'crz-tut ' + mode + (block ? ' block' : '') + (pass ? ' pass' : '');
    }

    // traz o alvo de mundo para a area util (uma vez por alvo; adia enquanto o usuario arrasta)
    function revealTarget(d) {
      if (!d || !d.world || !d.world.length || !render || !render.reveal) return;
      var i, same = !!revPts && revPts.length === d.world.length * 2;
      for (i = 0; same && i < d.world.length; i++) {
        if (revPts[2 * i] !== Math.round(d.world[i].x) || revPts[2 * i + 1] !== Math.round(d.world[i].y)) same = false;
      }
      if (same || pressed) return;
      revPts = [];
      for (i = 0; i < d.world.length; i++) revPts.push(Math.round(d.world[i].x), Math.round(d.world[i].y));
      try {
        for (i = 0; i < d.world.length; i++) if (render.reveal(d.world[i].x, d.world[i].y, true)) break;
      } catch (e) {}
    }
    function show(inf) {
      last = {}; textKey = null; dirty = true; revPts = null; rectCache = {};
      revealTarget(inf.target);
      setCls(inf.mode, inf.pass);
      box.className = 'crz-tut-box on';
      frame(inf);
    }
    function frame(inf) {
      if (dirty) { readSafe(); rectCache = {}; hudCache = null; }   // tela mudou: mede tudo de novo
      var vs = vsize(), r;
      revealTarget(inf.target);
      curInf = inf;
      r = inf.target === undefined ? null : resolve(inf.target, inf.mode === 'act');
      // alvo de mundo fora da tela (pan do usuario): balao na borda com seta para ele
      var edgeSp = null;
      if (!r && inf.target && inf.target.world && inf.target.world.length && render && render.toScreen) {
        var wq = inf.target.world, sx = 0, sy = 0, nq = 0, pq;
        for (var iq = 0; iq < wq.length; iq++) {
          pq = render.toScreen(wq[iq].x, wq[iq].y);
          if (isFinite(pq.x) && isFinite(pq.y)) { sx += pq.x; sy += pq.y; nq++; }
        }
        if (nq) edgeSp = { x: sx / nq, y: sy / nq };
      }
      var wantW = Math.min(300, vs.w - 24 - safe.l - safe.r), tk = textKey;
      // texto e botoes: compara os campos (antes juntava uma chave em string por quadro)
      var textSame = !!tk && tk.text === inf.text && tk.mode === inf.mode && tk.escape === inf.escape &&
        tk.armed === inf.armed && tk.tip === inf.tip && tk.icon === inf.icon && tk.btn === inf.btn && tk.alt === inf.alt;
      if (!textSame || dirty || wantW !== bw) {
        textKey = { text: inf.text, mode: inf.mode, escape: inf.escape, armed: inf.armed, tip: inf.tip, icon: inf.icon, btn: inf.btn, alt: inf.alt };
        txt.textContent = inf.text || '';
        ico.innerHTML = '';
        var src = null;
        if (inf.icon) { try { src = doc.querySelector('[data-tut="tool-' + inf.icon + '"] svg'); } catch (x) {} }
        if (src && src.cloneNode) { ico.appendChild(src.cloneNode(true)); ico.className = 'crz-tut-ico on'; }
        else ico.className = 'crz-tut-ico';
        skipB.textContent = inf.armed ? STR.skipConfirm : STR.skip;
        skipB.className = 'crz-tut-skip' + (inf.armed ? ' armed' : '');
        goB.textContent = inf.alt ? STR.boostBtn : inf.btn === 'go' ? STR.go : STR.ok;
        altB.textContent = inf.alt || STR.slowDown;
        altB.className = 'crz-tut-go crz-tut-alt' + (inf.alt && inf.btn !== 'none' ? ' on' : '');
        goB.className = 'crz-tut-go' + (inf.btn !== 'none' && (inf.mode !== 'act' || inf.escape) ? ' on' : '');
        bw = wantW; box.style.width = bw + 'px';
        bh = box.offsetHeight || 96;   // le o layout so quando texto ou largura mudam
        last.place = null;
      }
      dirty = false;
      setHidden(inf.hide);
      var hb = hudBand(vs), av = null;
      if (inf.avoid && inf.avoid.length) {
        av = [];
        for (var ia = 0; ia < inf.avoid.length; ia++) {
          var ra = inf.avoid[ia] ? resolve(inf.avoid[ia]) : null;
          if (ra) { if (inf.avoid[ia].soft) ra.soft = true; av.push(ra); }
        }
        if (!av.length) av = null;
      }
      if (placeChanged(r, vs, hb, edgeSp, av)) {
        wrap.className = wrap.className.replace(/ edge\b/, '') + (edgeSp ? ' edge' : '');
        edgeArrow.className = 'crz-tut-edge';
        if (edgeSp) {
          var ep = edgePlace(edgeSp, bw, bh, vs.w, vs.h, safe, render && render.margins);
          put(dims[0], 0, 0, 0, 0); put(dims[1], 0, 0, 0, 0); put(dims[2], 0, 0, 0, 0); put(dims[3], 0, 0, 0, 0);
          put(hole, 0, 0, 0, 0);
          ring.className = 'crz-tut-ring';
          box.style.left = Math.round(ep.x) + 'px'; box.style.top = Math.round(ep.y) + 'px';
          box.className = 'crz-tut-box on';
          edgeArrow.style.left = Math.round(ep.ax) + 'px'; edgeArrow.style.top = Math.round(ep.ay) + 'px';
          edgeArrow.style.transform = 'rotate(' + ep.ang + 'rad)';
          edgeArrow.className = 'crz-tut-edge on';
        } else {
        // spotlight: 4 faixas escuras em volta do buraco (sem alvo: uma faixa cobre tudo)
        if (r) {
          put(dims[0], 0, 0, vs.w, r.y);
          put(dims[1], 0, r.y + r.h, vs.w, vs.h - r.y - r.h);
          put(dims[2], 0, r.y, r.x, r.h);
          put(dims[3], r.x + r.w, r.y, vs.w - r.x - r.w, r.h);
          put(hole, r.x, r.y, r.w, r.h);
          put(ring, r.x, r.y, r.w, r.h);
          var round = inf.target && inf.target.round;
          ring.style.borderRadius = round ? Math.round(Math.min(r.w, r.h) / 2) + 'px' : '14px';
          ring.className = 'crz-tut-ring on';
        } else {
          put(dims[0], 0, 0, vs.w, vs.h);
          put(dims[1], 0, 0, 0, 0); put(dims[2], 0, 0, 0, 0); put(dims[3], 0, 0, 0, 0);
          put(hole, 0, 0, 0, 0);
          ring.className = 'crz-tut-ring';
        }
        var pl = placeBalloon(r, bw, bh, vs.w, vs.h, safe, inf.pos, hb, av);
        box.style.left = Math.round(pl.x) + 'px'; box.style.top = Math.round(pl.y) + 'px';
        box.className = 'crz-tut-box on' + (pl.side === 'above' || pl.side === 'below' ? ' ' + pl.side : '');
        arrow.style.left = Math.round(pl.arrowX) + 'px';
        }
      }
      // maozinha (passo de arrastar): do no para fora
      var showHand = !!(inf.hand && r && inf.target && inf.target.world && inf.target.world.length === 1);
      if (showHand) {
        var wp = inf.target.world[0], sp = render.toScreen(wp.x, wp.y);
        var m = (render && render.margins) || { top: 60, bottom: 150 };
        var hv = handVector(sp, wp, render.camera && render.camera.zoom, vs.w, vs.h, m);
        handV[0] = Math.round(sp.x); handV[1] = Math.round(sp.y); handV[2] = hv.dx; handV[3] = hv.dy;
        if (!sameNums(handK, handV) || last.hand !== 'on') {
          last.hand = 'on';
          hand.style.left = Math.round(sp.x) + 'px'; hand.style.top = Math.round(sp.y) + 'px';
          if (hand.style.setProperty) { hand.style.setProperty('--dx', hv.dx + 'px'); hand.style.setProperty('--dy', hv.dy + 'px'); }
          hand.className = 'crz-tut-hand on';
        }
      } else if (last.hand !== 'off') { last.hand = 'off'; hand.className = 'crz-tut-hand'; }
      // aneis extras (ex.: bolinhas do Boost e botao de velocidade)
      var rings = [ring2, ring3], q;
      for (q = 0; q < rings.length; q++) {
        var dq = inf.extra && inf.extra[q], ex = dq ? resolve(dq) : null;
        extraV[0] = ex ? ex.x : -1; extraV[1] = ex ? ex.y : -1; extraV[2] = ex ? ex.w : -1; extraV[3] = ex ? ex.h : -1;
        var exSame = sameNums(extraK[q], extraV);
        if (!exSame || !last['extra' + q]) {
          last['extra' + q] = true;
          if (ex) {
            put(rings[q], ex.x, ex.y, ex.w, ex.h);
            rings[q].style.borderRadius = dq.round ? Math.round(Math.min(ex.w, ex.h) / 2) + 'px' : '14px';
            rings[q].className = 'crz-tut-ring on';
          } else rings[q].className = 'crz-tut-ring';
        }
      }
      return inf.target === undefined || !!r || !!edgeSp;
    }
    // elementos da UI escondidos enquanto o passo fala (ex.: enquadrar, logo acima do play no passo da
    // velocidade). So mexe na visibilidade inline e devolve o valor antigo ao trocar de passo
    var hiddenEls = [];
    function setHidden(names) {
      var want = [], i, e;
      for (i = 0; names && i < names.length; i++) { e = lookup(names[i]); if (e && e.style) want.push(e); }
      for (i = 0; i < hiddenEls.length; i++) {
        if (want.indexOf(hiddenEls[i].e) < 0) { try { hiddenEls[i].e.style.visibility = hiddenEls[i].v; } catch (x) {} }
      }
      var keep = [];
      for (i = 0; i < hiddenEls.length; i++) if (want.indexOf(hiddenEls[i].e) >= 0) keep.push(hiddenEls[i]);
      for (i = 0; i < want.length; i++) {
        var had = false;
        for (var j = 0; j < keep.length; j++) if (keep[j].e === want[i]) had = true;
        if (!had) { keep.push({ e: want[i], v: want[i].style.visibility || '' }); want[i].style.visibility = 'hidden'; hudCache = null; }
      }
      if (keep.length !== hiddenEls.length) hudCache = null;
      hiddenEls = keep;
    }
    function hide() {
      setHidden(null);
      wrap.className = 'crz-tut';
      box.className = 'crz-tut-box';
      ring.className = 'crz-tut-ring';
      ring2.className = 'crz-tut-ring';
      ring3.className = 'crz-tut-ring';
      hand.className = 'crz-tut-hand';
      edgeArrow.className = 'crz-tut-edge';
      last = {};
    }
    function showSeal(text) {
      seal.textContent = text;
      seal.className = 'crz-tut-seal on';
      if (sealTimer) clearTimeout(sealTimer);
      sealTimer = setTimeout(function () { seal.className = 'crz-tut-seal'; }, 2600);
    }
    function destroy() {
      var i;
      setHidden(null);
      for (i = 0; i < bound.length; i++) { try { bound[i][0].removeEventListener(bound[i][1], bound[i][2]); } catch (e) {} }
      bound = [];
      if (sealTimer) clearTimeout(sealTimer);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (madeHost && host.parentNode) host.parentNode.removeChild(host);
    }
    return { show: show, frame: frame, hide: hide, seal: showSeal, destroy: destroy, has: function (n) { return !!find(n); } };
  }

  /* ---------- montagem ---------- */

  function create(o) {
    o = o || {};
    var doc = root.document && root.document.body ? root.document : null;
    var m = null, ourModal = false;
    var h = {
      cont: function () { if (m) m.cont(); },
      slow: function () { if (m) m.slow(); },
      tap: function () { if (m) m.tap(); },
      skipTap: function () { if (m) m.skipTap(); },
      dimTap: function () { if (m) m.dimTap(); }
    };
    var view = null;
    try { view = doc ? createView(doc, o.render, h) : null; } catch (e) { view = null; }
    function bodyCls() { return doc && doc.body && doc.body.classList ? doc.body.classList : null; }
    function modal(onv) {
      var cl = bodyCls(); if (!cl) return;
      if (onv) { if (!cl.contains('crz-modal')) { cl.add('crz-modal'); } ourModal = true; }
      else if (ourModal) { ourModal = false; cl.remove('crz-modal'); }
    }
    var reason = '';
    function uiNow() { return o.ui || (CRZ.app && CRZ.app.ui) || null; }
    // folha do dado aberta: pergunta a UI (sem ler layout). UI antiga sem isSheetOpen: classe da folha
    function sheetOpen() {
      var u = uiNow();
      if (u && typeof u.isSheetOpen === 'function') return !!u.isSheetOpen();
      return !!q1('.crz-diesheet.show');
    }
    function holding() {
      var u = uiNow();
      if (u && typeof u.isHolding === 'function') return !!u.isHolding();
      return !!q1('.crz-ui.crz-hold');
    }
    function q1(sel) { try { return doc.querySelector(sel); } catch (e) { return null; } }
    // camadas do menu (menu, ajuda, inicio): colecao viva pega uma vez, sem querySelector por quadro
    var menuLayers = null;
    function menuOpen() {
      if (!menuLayers) {
        try { if (doc.getElementsByClassName) menuLayers = doc.getElementsByClassName('crzm-layer'); } catch (e) {}
        if (!menuLayers) return !!q1('#crz-overlay-root .crzm-layer.open');
      }
      for (var i = 0; i < menuLayers.length; i++) {
        var L = menuLayers[i];
        if (L && L.classList && L.classList.contains('open')) return true;
      }
      return false;
    }
    function blocked() {
      if (!doc) return false;
      // a folha so congela o tutorial no plano: no dia ela nao bloqueia o mapa, e o aviso do anel
      // vermelho (seguranca) nao pode esperar por ela (a UI ainda a fecha num anel serio)
      if (sheetOpen() && (o.game && o.game.state && o.game.state.phase) !== 'run') { reason = 'sheet'; return true; }
      // UI segurando o cruzamento travado (~2 s antes do resumo): espera, sem pular o passo do resumo
      if (holding()) { reason = 'hold'; return true; }
      if (menuOpen()) { reason = 'menu'; return true; }
      var cl = bodyCls();
      reason = 'other';
      return !!(cl && cl.contains('crz-modal') && !ourModal);
    }
    // ao congelar: sob o menu, esquece a posse da classe sem tira-la (o menu a usa e a tira ao fechar);
    // sob a folha do dado, tira a nossa (ninguem mais a tiraria)
    function release() { if (reason === 'sheet' || reason === 'hold') modal(false); else ourModal = false; }
    m = createMachine({ game: o.game, ui: o.ui, render: o.render, store: o.store || lsStore(),
                        view: view || nullView(), modal: modal, blocked: blocked, release: release,
                        hasEl: view ? function (n) { return view.has(n); } : null });
    function onUI(e) { if (e && e.detail) m.handleUI(e.detail); }
    if (doc) doc.addEventListener('crz:ui', onUI);
    var offGame = null;
    try { if (o.game && o.game.onEvent) offGame = o.game.onEvent(function (ev) { m.handleGame(ev); }); } catch (e) {}
    return {
      start: m.start, skip: m.skip, replay: m.replay, isActive: m.isActive, update: m.update,
      current: m.current,
      destroy: function () { if (doc) doc.removeEventListener('crz:ui', onUI); try { if (typeof offGame === 'function') offGame(); } catch (e) {} m.destroy(); }
    };
  }

  function words(s) { return String(s).split(/\s+/).filter(function (w) { return /[0-9A-Za-z\u00C0-\u00FF]/.test(w); }).length; }

  CRZ.Tutorial = {
    create: create, STR: STR, KEY: KEY,
    _test: { ringSay: ringSay, createMachine: createMachine, createView: createView, edgePlace: edgePlace, placeBalloon: placeBalloon, overlaps: overlaps, handVector: handVector,
             memStore: memStore, words: words, MAIN: MAIN, TOOLS: TOOLS, TIPS: TIPS, SAFETY: SAFETY,
             consts: { TIP_GAP: TIP_GAP, TOAST_LIFE: TOAST_LIFE, MISSING_GRACE: MISSING_GRACE, HAND_AFTER: HAND_AFTER, ESCAPE_AFTER: ESCAPE_AFTER } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
