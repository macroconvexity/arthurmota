/* Gridlet: eventos de lugar (v2e, v2/nivel.md secao 4). Dono: ramo v2e.
 * Um evento acontece num lugar do mapa, num dia: um jogo no estadio ou a saida da escola (uma ponta da cidade solta
 * muito mais carros numa janela do dia) e uma obra (uma rua fecha o dia inteiro). Avisado na vespera, no plano, com
 * a marca no lugar (render.js) e uma linha na faixa (ui.js). Nada acontece sem aviso.
 *
 * Calendario: CFG.events.calendar em dias RELATIVOS ao capitulo (capitulo = floor((dia-1)/chapterLen)+1, chapterLen =
 * CFG.chapterLen ou 10). Capitulo 1 sem evento, o 2 leve, o 3 e a pressao principal. Modo de teste (CFG.events.test):
 * os capitulos 2 e 3 cabem nas janelas de CFG.events.testWindows (partida de 12 dias). O tipo das entradas 'hat' e o
 * lugar saem da semente da partida (D7): o lugar e escolhido na manha da vespera, com a cidade daquele dia.
 *
 * Estado: game.state.events (vai no save): { v, test, list: [ev], first, fest }. ev = { day, type, size, node, edge,
 * x, y, ran }. Nada aqui consome o rng do jogo nem do Sim: cada escolha usa um rng proprio (semente, dia, sal).
 * DOM-free (roda no node). Interface para o ramo do dado (v2b): tomorrow, scale, festivalSpot, forecast. */
(function (root) {
  'use strict';
  var CRZ = root.CRZ = root.CRZ || {};

  var TYPE_ORDER = ['game', 'school', 'roadwork'];   // prioridade de tomorrow() quando ha dois no mesmo dia
  var SIZE_MAX = 3;

  function CFG() { return CRZ.CFG || {}; }
  function EC() { return CFG().events || null; }
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function fin(v) { return typeof v === 'number' && isFinite(v); }
  function nat(v) { return fin(v) && Math.floor(v) === v && v >= 0; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function sortedIds(o) { return Object.keys(o).map(Number).sort(function (a, b) { return a - b; }); }
  function typeDef(t) { var E = EC(); return E && E.types && own(E.types, t) ? E.types[t] : null; }
  function chapterLen() { var c = CFG(); return c.chapterLen > 0 ? c.chapterLen : 10; }
  function chapterOf(day) { return Math.floor(((day | 0) - 1) / chapterLen()) + 1; }
  function rngFor(seed, day, salt) { return CRZ.rng(((seed >>> 0) ^ Math.imul((day | 0) * 97 + salt, 0x2C1B3C6D)) >>> 0 || 1); }

  // ---------- calendario (puro: so semente e configuracao) ----------
  // dia absoluto de uma entrada { ch, rel }: capitulo de chapterLen dias, rel em 1..10 escalado se o capitulo nao tem 10
  function dayOf(ch, rel, test, maxDays) {
    var E = EC();
    if (test) {
      var win = E.testWindows && E.testWindows[ch];
      if (!win) return 0;
      var a = win[0], b = Math.min(win[1], maxDays), n = b - a + 1;
      if (n <= 0) return 0;
      return a + Math.min(n - 1, Math.floor((rel - 1) * n / 10));
    }
    var L = chapterLen(), r = L === 10 ? rel : Math.max(1, Math.min(L, Math.round(rel * L / 10)));
    return (ch - 1) * L + r;
  }
  function schedule(seed, test) {
    var E = EC(), out = [], c = CFG();
    if (!E || E.on === false || !Array.isArray(E.calendar)) return out;
    var maxDays = c.maxDays || 12, hat = Array.isArray(E.hat) && E.hat.length ? E.hat : TYPE_ORDER;
    // modo de teste: o capitulo 3 cabe em 4 dias; testPerDayMax mantem a densidade perto da dos 30 dias
    var cap = (test && E.testPerDayMax > 0 ? E.testPerDayMax : E.perDayMax) || 2;
    var rnd = rngFor(seed, 0, 911), perDay = {}, i;
    for (i = 0; i < E.calendar.length; i++) {
      var en = E.calendar[i], day = dayOf(en.ch | 0, en.rel | 0, !!test, maxDays);
      // o sorteio do chapeu consome o rng mesmo quando o dia cai fora da partida: a mesma semente da o mesmo tipo
      var k = Math.floor(rnd() * hat.length);
      if (!(day >= 1 && day <= maxDays)) continue;
      var have = perDay[day] || (perDay[day] = []);
      if (have.length >= cap) continue;
      var type = en.type;
      if (type === 'hat') {
        // tipo do chapeu, sem repetir um tipo que o dia ja tem
        for (var j = 0; j < hat.length; j++) { type = hat[(k + j) % hat.length]; if (have.indexOf(type) < 0) break; }
      }
      if (!typeDef(type) || have.indexOf(type) >= 0) continue;
      have.push(type);
      out.push({ day: day, type: type, size: 1, node: null, edge: null, x: 0, y: 0, ran: false, prep: false });
    }
    out.sort(function (p, q) { return p.day - q.day || TYPE_ORDER.indexOf(p.type) - TYPE_ORDER.indexOf(q.type); });
    return out;
  }

  // ---------- leitura do mapa ----------
  function deg(n) { return n && n.edges ? n.edges.length : 0; }
  function cityPortal(n) { return !!n && n.portal && !(n.rate > 0 && n.rate < 1); }
  function otherEnd(e, id) { return e.a === id ? e.b : e.a; }
  // primeiro cruzamento (3+ ruas) a partir de uma ponta, andando pelas ruas sem bifurcacao; a ponta com 3+ ruas e ele
  function firstJunction(w, pid) {
    var n = w.nodes[pid];
    if (!n) return null;
    if (deg(n) >= 3) return n;
    var prev = -1, cur = n, guard = 0;
    while (cur && guard++ < 64) {
      if (cur !== n && (deg(cur) >= 3)) return cur;
      if (cur !== n && (cur.portal || deg(cur) < 2)) return null;
      var nx = null;
      for (var k = 0; k < cur.edges.length; k++) {
        var e = w.edges[cur.edges[k]];
        if (e && e.id !== prev) { nx = e; break; }
      }
      if (!nx) return null;
      prev = nx.id; cur = w.nodes[otherEnd(nx, cur.id)];
    }
    return null;
  }
  // a ponta seguiu o ramo novo (o crescimento move o portal para a ponta nova): anda pelas ruas sem bifurcacao
  function followPortal(w, id) {
    var n = w.nodes[id];
    if (cityPortal(n)) return n.id;
    if (!n) return null;
    var seen = {}, q = [n.id], guard = 0;
    seen[n.id] = true;
    while (q.length && guard++ < 64) {
      var u = w.nodes[q.shift()];
      if (u !== n && cityPortal(u)) return u.id;
      if (u !== n && deg(u) >= 3) continue;
      for (var k = 0; k < u.edges.length; k++) {
        var e = w.edges[u.edges[k]]; if (!e) continue;
        var v = otherEnd(e, u.id);
        if (!seen[v] && w.nodes[v]) { seen[v] = true; q.push(v); }
      }
    }
    return null;
  }
  function cityPortals(w) {
    var out = [], ids = sortedIds(w.nodes);
    for (var i = 0; i < ids.length; i++) { var n = w.nodes[ids[i]]; if (cityPortal(n) && deg(n) > 0) out.push(n); }
    return out;
  }
  // componentes com mao unica: todas as pontas chegam a todas sem a rua skip?
  function allReach(w, skip) {
    var P = cityPortals(w).concat(), i;
    if (P.length < 2) return true;
    function reach(src, rev) {
      var seen = {}, q = [src], c = 0;
      seen[src] = true;
      while (q.length) {
        var u = w.nodes[q.shift()]; c++;
        for (var k = 0; k < u.edges.length; k++) {
          var e = w.edges[u.edges[k]]; if (!e || (skip && skip[e.id])) continue;
          var dir = e.a === u.id ? 1 : -1;
          if (rev) dir = -dir;
          if ((dir === 1 && e.oneway === -1) || (dir === -1 && e.oneway === 1)) continue;
          var v = otherEnd(e, u.id);
          if (!seen[v]) { seen[v] = true; q.push(v); }
        }
      }
      return seen;
    }
    var f = reach(P[0].id, false), b = reach(P[0].id, true);
    for (i = 1; i < P.length; i++) if (!f[P[i].id] || !b[P[i].id]) return false;
    return true;
  }
  // uso de cada rua pelos caminhos minimos (em comprimento) entre pares de pontas da cidade
  function routeUse(w) {
    var P = cityPortals(w), use = {}, i, j;
    for (i = 0; i < P.length; i++) {
      var dist = {}, prev = {}, done = {}, src = P[i].id;
      dist[src] = 0;
      for (;;) {
        var bu = null, bd = Infinity, k;
        for (k in dist) if (!done[k] && dist[k] < bd) { bd = dist[k]; bu = +k; }
        if (bu === null) break;
        done[bu] = true;
        var u = w.nodes[bu];
        for (k = 0; k < u.edges.length; k++) {
          var e = w.edges[u.edges[k]]; if (!e) continue;
          var v = otherEnd(e, bu), nd = bd + (e.len || 1);
          if (!(dist[v] <= nd)) { dist[v] = nd; prev[v] = e.id; }
        }
      }
      for (j = 0; j < P.length; j++) {
        var t = P[j].id, cur = t, guard = 0;
        if (t === src || prev[t] === undefined) continue;
        while (cur !== src && guard++ < 500) { var eid = prev[cur]; use[eid] = (use[eid] || 0) + 1; cur = otherEnd(w.edges[eid], cur); }
      }
    }
    return use;
  }
  // desvio da rua fechada: o caminho mais curto de uma ponta da rua a outra sem ela (ids dos nos, sem as pontas) e o
  // comprimento. null sem desvio
  function detour(w, e) {
    var dist = {}, prev = {}, done = {}, k;
    dist[e.a] = 0;
    for (;;) {
      var bu = null, bd = Infinity;
      for (k in dist) if (!done[k] && dist[k] < bd) { bd = dist[k]; bu = +k; }
      if (bu === null || bu === e.b) break;
      done[bu] = true;
      var u = w.nodes[bu];
      for (k = 0; k < u.edges.length; k++) {
        var f = w.edges[u.edges[k]]; if (!f || f.id === e.id) continue;
        var v = otherEnd(f, bu), nd = bd + (f.len || 1);
        if (!(dist[v] <= nd)) { dist[v] = nd; prev[v] = bu; }
      }
    }
    if (dist[e.b] === undefined) return null;
    var path = [], cur = prev[e.b], guard = 0;
    while (cur !== undefined && cur !== e.a && guard++ < 200) { path.unshift(cur); cur = prev[cur]; }
    return { len: dist[e.b], nodes: path };
  }
  function mid(w, e) { var a = w.nodes[e.a], b = w.nodes[e.b]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  // ---------- estado ----------
  function S(g) { return g && g.state ? g.state.events : null; }
  // eventos ligados no jogo (CFG.events.on): desligados, nada de marca, de dia de evento nem de Festival do dado
  function enabled() { var E = EC(); return !!E && E.on !== false; }
  function evsOn(g, day) {
    var s = S(g), out = [];
    if (!s) return out;
    for (var i = 0; i < s.list.length; i++) if (s.list[i].day === day) out.push(s.list[i]);
    return out;
  }
  function placed(ev) { return ev && (ev.node !== null || ev.edge !== null); }
  function usedPortals(g, day, except) {
    var u = {}, s = S(g);
    if (!s) return u;
    for (var i = 0; i < s.list.length; i++) {
      var o = s.list[i];
      if (o === except || o.node === null || o.type === 'roadwork') continue;
      // o mesmo dia nunca repete a ponta; dias vizinhos tambem evitam (partidas diferentes por dentro)
      if (Math.abs(o.day - day) <= 2) u[o.node] = o.day === day ? 2 : 1;
    }
    return u;
  }

  // escolhe o lugar de um evento com a cidade de agora (deterministico: semente, dia, tipo, cidade)
  function place(g, ev) {
    var w = g.world, td = typeDef(ev.type), seed = w.seed >>> 0;
    if (!td) return false;
    var rnd = rngFor(seed, ev.day, 31 + TYPE_ORDER.indexOf(ev.type) * 7), i;
    if (td.kind === 'close') {
      var use = routeUse(w), cands = [], ids = sortedIds(w.edges);
      for (i = 0; i < ids.length; i++) {
        var e = w.edges[ids[i]], a = w.nodes[e.a], b = w.nodes[e.b];
        if (!a || !b || a.portal || b.portal || deg(a) < 2 || deg(b) < 2 || !(use[e.id] > 0)) continue;
        // nunca deixa uma ponta sem caminho (nem com mao unica): a obra so fecha rua com desvio
        var sk = {}; sk[e.id] = true;
        if (!allReach(w, sk)) continue;
        // desvio curto e visivel (ate detourMax vezes a rua): o jogador ve onde a fila vai
        var dt = detour(w, e);
        if (!dt || (td.detourMax > 0 && dt.len > td.detourMax * (e.len || 1))) continue;
        // a rua vizinha de outra obra no mesmo dia, nao
        var clash = false;
        evsOn(g, ev.day).forEach(function (o) { if (o !== ev && o.edge !== null && w.edges[o.edge]) { var oe = w.edges[o.edge]; if (oe.a === e.a || oe.a === e.b || oe.b === e.a || oe.b === e.b) clash = true; } });
        if (clash) continue;
        cands.push({ e: e, u: use[e.id] });
      }
      if (!cands.length) return false;
      cands.sort(function (p, q) { return q.u - p.u || p.e.id - q.e.id; });
      // skip: pula as ruas mais usadas (a obra na rua principal da cidade inteira trava quem se preparou)
      var sk0 = Math.min(td.skip > 0 ? td.skip | 0 : 0, Math.max(0, cands.length - 1));
      var top = cands.slice(sk0, Math.min(sk0 + 3, cands.length)), pick = top[Math.floor(rnd() * top.length)].e, m = mid(w, pick);
      ev.edge = pick.id; ev.node = null; ev.x = Math.round(m.x * 10) / 10; ev.y = Math.round(m.y * 10) / 10;
      return true;
    }
    var used = usedPortals(g, ev.day, ev), P = cityPortals(w).filter(function (n) { return used[n.id] !== 2 && firstJunction(w, n.id); });
    if (!P.length) return false;
    var fresh = P.filter(function (n) { return !used[n.id]; });
    if (fresh.length) P = fresh;
    function r2(n) { return n.x * n.x + n.y * n.y; }
    P.sort(function (p, q) { return r2(q) - r2(p) || p.id - q.id; });
    var C = P;
    if (td.place === 'tee') {
      // escola: ponta que da num T, longe do centro (metade de fora)
      var T = P.filter(function (n) { var j = firstJunction(w, n.id); return j && deg(j) === 3; });
      if (T.length) C = T;
      C = C.slice(0, Math.max(1, Math.ceil(C.length / 2)));
    } else C = C.slice(0, Math.min(3, C.length));   // estadio: uma das pontas mais longe do centro
    var pn = C[Math.floor(rnd() * C.length)];
    ev.node = pn.id; ev.edge = null; ev.x = pn.x; ev.y = pn.y;
    return true;
  }
  // o lugar ja escolhido continua valendo? (o crescimento move pontas e corta ruas). Conserta ou desiste
  function resolve(g, ev) {
    var w = g.world;
    if (ev.type === 'roadwork') {
      if (ev.edge !== null && w.edges[ev.edge]) return true;
      // a rua foi cortada (um ramo novo nasceu no meio dela): o pedaco mais perto do ponto marcado
      var best = null, bd = 40, ids = sortedIds(w.edges);
      for (var i = 0; i < ids.length; i++) {
        var e = w.edges[ids[i]], a = w.nodes[e.a], b = w.nodes[e.b]; if (!a || !b) continue;
        var dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, t = ((ev.x - a.x) * dx + (ev.y - a.y) * dy) / L2;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        var px = a.x + t * dx - ev.x, py = a.y + t * dy - ev.y, d = Math.sqrt(px * px + py * py);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) { ev.edge = null; return false; }
      ev.edge = best.id;
      return true;
    }
    if (ev.node === null) return false;
    var id = followPortal(w, ev.node);
    if (id === null) { ev.node = null; return false; }
    if (id !== ev.node) { ev.node = id; ev.x = w.nodes[id].x; ev.y = w.nodes[id].y; }
    return true;
  }

  // ---------- ciclo do dia (chamado por game.js) ----------
  function init(g, test) {
    var E = EC(), t = test === undefined ? !!(E && E.test) : !!test;
    g.state.events = { v: 1, test: t, list: schedule(g.world.seed, t), first: false, fest: null };
    return g.state.events;
  }
  // manha do dia D: o evento de hoje confere o lugar; o de amanha ganha o lugar (a vespera e o aviso)
  function onPlan(g) {
    var s = S(g); if (!s) return;
    var day = g.state.day;
    evsOn(g, day).forEach(function (ev) { if (placed(ev)) resolve(g, ev); });
    evsOn(g, day + 1).forEach(function (ev) { if (!placed(ev)) place(g, ev); else resolve(g, ev); });
    if (s.fest && s.fest.day !== day) s.fest = null;
  }
  // estado da corrida (janelas do dia): fora do JSON do estado (nao vai no save; o load volta ao plano)
  function setRun(s, r) { Object.defineProperty(s, '_run', { value: r, writable: true, configurable: true, enumerable: false }); }
  // CFG.events.mapMul[forma]: a parte extra da leva por forma de cidade (Rio: toda leva que atravessa a agua passa pela
  // unica ponte, a mesma leva pesa mais ali; medido em web/dev/review/w_evt/out)
  function mapK(g) {
    var E = EC(), a = g && g.state ? g.state.archetype : null, k = E && E.mapMul && a && own(E.mapMul, a) ? E.mapMul[a] : 1;
    return fin(k) && k > 0 ? k : 1;
  }
  function effMul(td, ev, g) { return 1 + Math.max(0, (td.mul || 1) - 1) * (ev.size > 0 ? ev.size : 1) * mapK(g); }
  // inicio do dia: rua fechada e janelas de carros a mais. A base do portalMul (Festival do dado) e mantida
  function applyDay(g) {
    var s = S(g), w = g.world, p = w.params, day = g.state.day;
    if (!s) return;
    var base = {}, k;
    if (isObj(p.portalMul)) for (k in p.portalMul) if (own(p.portalMul, k) && p.portalMul[k] > 0) base[k] = p.portalMul[k];
    var closed = [], wins = [], len = g.state.dayLen > 0 ? g.state.dayLen : 60;
    // so medida (web/dev/events/measure.js, modo dry): o calendario, os lugares e as marcas valem, o transito nao muda
    var dry = !!(EC() && EC().dry);
    evsOn(g, day).forEach(function (ev) {
      var td = typeDef(ev.type);
      if (!td || !placed(ev) || !resolve(g, ev)) return;
      ev.prep = prepared(g, ev);
      if (dry) return;
      if (td.kind === 'close') {
        var sk = {}; sk[ev.edge] = true;
        if (!allReach(w, sk)) return;   // mao unica nova isolaria uma ponta: hoje a obra nao fecha
        closed.push(ev.edge);
        // obra maior (Big game no dado): carros a mais nas duas pontas mais perto da obra, o dia todo
        if (ev.size > 1 && td.detourMul > 1) {
          var P = cityPortals(w).slice().sort(function (a, b) {
            var da = (a.x - ev.x) * (a.x - ev.x) + (a.y - ev.y) * (a.y - ev.y), db = (b.x - ev.x) * (b.x - ev.x) + (b.y - ev.y) * (b.y - ev.y);
            return da - db || a.id - b.id;
          });
          for (var i = 0; i < Math.min(2, P.length); i++) base[P[i].id] = (base[P[i].id] || 1) * (1 + (td.detourMul - 1) * (ev.size - 1) / 0.5);
        }
      } else {
        var W = td.win || [0.4, 0.6];
        wins.push({ id: ev.node, mul: effMul(td, ev, g), t0: W[0] * len, t1: W[1] * len, type: ev.type, open: false });
      }
      ev.ran = true;
    });
    if (closed.length) p.closed = closed; else delete p.closed;
    setRun(s, { day: day, base: base, wins: wins, key: '' });
    setMul(p, base, wins, null);
  }
  function setMul(p, base, wins, t) {
    var m = {}, k, any = false, i;
    for (k in base) if (own(base, k)) { m[k] = base[k]; any = true; }
    for (i = 0; i < wins.length; i++) if (t !== null && t >= wins[i].t0 && t < wins[i].t1) { m[wins[i].id] = (m[wins[i].id] || 1) * wins[i].mul; any = true; }
    if (any) p.portalMul = m; else delete p.portalMul;
  }
  // a cada passo do dia: abre e fecha as janelas. Devolve o evento do jogo quando uma janela abre (ou null)
  function tick(g) {
    var s = S(g), r = s && s._run;
    if (!r || r.day !== g.state.day || !r.wins.length) return null;
    var t = g.state.dayTime, key = '', i, opened = null;
    for (i = 0; i < r.wins.length; i++) {
      var on = t >= r.wins[i].t0 && t < r.wins[i].t1;
      key += on ? '1' : '0';
      if (on && !r.wins[i].open) { r.wins[i].open = true; opened = r.wins[i]; }
    }
    if (key !== r.key) { r.key = key; setMul(g.world.params, r.base, r.wins, t); }
    return opened ? { type: 'placeEvent', what: 'open', event: opened.type, nodeId: opened.id } : null;
  }
  function endDay(g) {
    var s = S(g), p = g.world.params;
    if (s) setRun(s, null);
    delete p.closed; delete p.portalMul;
  }

  // ---------- interface (ramo do dado, UI, render, robos) ----------
  function info(ev, when) {
    var td = typeDef(ev.type) || {};
    var nodeId = ev.node;
    return { nodeId: nodeId, edgeId: ev.edge, type: ev.type, label: td.label || ev.type, day: ev.day, size: ev.size, when: when };
  }
  function first(list) {
    list = list.filter(placed);
    list.sort(function (a, b) { return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type); });
    return list[0] || null;
  }
  // o evento de amanha com o lugar (ou null). Lugar ainda nao escolhido (load antigo, chamada fora de ordem): escolhe
  function tomorrow(g) {
    var s = S(g); if (!s || !g.state || !enabled()) return null;
    var c = CFG(), d = g.state.day + 1;
    if (d > (c.maxDays || 12) || g.state.phase === 'over') return null;
    var L = evsOn(g, d);
    L.forEach(function (ev) { if (!placed(ev)) place(g, ev); });
    var ev = first(L);
    if (!ev) return null;
    var o = info(ev, 'tomorrow');
    if (o.nodeId === null && ev.edge !== null && g.world.edges[ev.edge]) o.nodeId = g.world.edges[ev.edge].a;   // obra: uma ponta da rua
    return { nodeId: o.nodeId, label: o.label, type: o.type, edgeId: o.edgeId };
  }
  function today(g) {
    var ev = first(evsOn(g, g.state.day));
    return ev ? info(ev, 'today') : null;
  }
  function forecast(g) { var t = tomorrow(g); return t ? t.label : null; }
  // o evento do dia fica mul vezes maior (face Big game: amanha x1,5). Vai no save. Devolve se havia evento
  function scale(g, day, mul) {
    if (!(mul > 0) || !isFinite(mul)) return false;
    var L = evsOn(g, day | 0), hit = false;
    L.forEach(function (ev) { ev.size = Math.min(SIZE_MAX, Math.round((ev.size > 0 ? ev.size : 1) * mul * 1000) / 1000); hit = true; });
    return hit;
  }
  // a rua do Festival de hoje: uma ponta da cidade, da semente e do dia, de preferencia a que da num cruzamento
  // cheio (anel de ontem). Guardada para o dia (a resposta nao muda no meio da manha nem durante a corrida)
  function festivalSpot(g, day) {
    var s = S(g), w = g.world, st = g.state;
    day = day | 0;
    if (!enabled()) return null;   // eventos desligados: a face Festival sai do pool (game.js diceFeature)
    if (s && s.fest && s.fest.day === day && cityPortal(w.nodes[s.fest.id])) return s.fest.id;
    var P = cityPortals(w).filter(function (n) { return firstJunction(w, n.id); });
    if (!P.length) return null;
    var used = s ? usedPortals(g, day, null) : {}, hot = (st && st.hot) || {};
    var tr = st && st.trouble && st.trouble.nodes ? st.trouble.nodes : {};
    function heat(id) { var h = +hot[id] || 0, t = tr[id] && fin(tr[id].p) ? tr[id].p : 0; return Math.max(h, t); }
    var sc = P.map(function (n) {
      var j = firstJunction(w, n.id);
      return { n: n, v: heat(j.id) + 0.05 * deg(j) - (used[n.id] ? 1 : 0) };
    });
    sc.sort(function (a, b) { return b.v - a.v || a.n.id - b.n.id; });
    var top = sc.slice(0, Math.min(3, sc.length)), rnd = rngFor(w.seed >>> 0, day, 401);
    var id = top[Math.floor(rnd() * top.length)].n.id;
    if (s && st && day === st.day) s.fest = { day: day, id: id };
    return id;
  }
  // Festival do dado em jogo hoje? (face com festivalMul oferecida ou usada; passada, guardada ou ausente: nao)
  function festivalLive(g) {
    var st = g.state, d = st && st.die;
    if (!d || !d.effect || !(d.effect.festivalMul > 0)) return null;
    var ds = st.dieState;
    if (ds !== 'offer' && ds !== 'used' && ds !== 'auto') return null;
    return ds === 'offer' ? 'offer' : 'used';
  }

  // marcas no mapa: { key, kind, type, nodeId, edgeId, x, y, text, when }. Plano: hoje e amanha. Corrida: so hoje.
  // Resumo: o de amanha (o aviso da vespera continua). Fim: nada
  function marks(g) {
    var s = S(g), st = g.state, w = g.world, out = [], E = EC();
    if (!st || st.phase === 'over' || !enabled()) return out;
    var T = (E && E.text) || {};
    function add(ev, when) {
      var td = typeDef(ev.type);
      if (!td || !placed(ev)) return;
      var x, y;
      if (ev.edge !== null) { var e = w.edges[ev.edge]; if (!e || !w.nodes[e.a] || !w.nodes[e.b]) return; var m = mid(w, e); x = m.x; y = m.y; }
      else { var n = w.nodes[ev.node]; if (!n) return; x = n.x; y = n.y; }
      out.push({ key: ev.type + ':' + ev.day, kind: 'event', type: ev.type, nodeId: ev.node, edgeId: ev.edge, x: x, y: y,
                 text: (td.mark || ev.type) + ' ' + (when === 'today' ? (T.today || 'today') : (T.tomorrow || 'tomorrow')), when: when });
    }
    if (s) {
      if (st.phase === 'plan' || st.phase === 'run') evsOn(g, st.day).forEach(function (ev) { add(ev, 'today'); });
      if (st.phase === 'plan' || st.phase === 'summary') evsOn(g, st.day + 1).forEach(function (ev) { add(ev, 'tomorrow'); });
    }
    var fl = (st.phase === 'plan' || st.phase === 'run') ? festivalLive(g) : null;
    if (fl) {
      var fid = festivalSpot(g, st.day), fn = fid !== null ? w.nodes[fid] : null;
      if (fn) out.push({ key: 'festival:' + st.day, kind: 'festival', type: 'festival', nodeId: fn.id, edgeId: null, x: fn.x, y: fn.y,
                         text: fl === 'offer' ? (T.festivalOffer || 'Festival road') : (T.festival || 'Festival road today'), when: 'today' });
    }
    return out;
  }
  // o cruzamento onde a fila do evento nasce (o que ajuda ali): o primeiro da ponta, ou a ponta da obra com mais ruas
  function helpNode(g, m) {
    var w = g.world;
    if (m.edgeId !== null && m.edgeId !== undefined) {
      var e = w.edges[m.edgeId]; if (!e) return null;
      var a = w.nodes[e.a], b = w.nodes[e.b];
      return deg(a) >= deg(b) ? a : b;
    }
    return m.nodeId !== null ? firstJunction(w, m.nodeId) : null;
  }
  // ---------- o preparo que ajuda (medido em web/dev/events/prep.js, calendario real) ----------
  // Jogo e escola: uma segunda rua saindo da ponta do evento (a leva se divide em duas). Obra: Two lanes no desvio.
  // secondWay: a rua que o jogador pode puxar da ponta do evento ate o cruzamento (ou no) valido mais perto, sem ser
  // o da rua que ja existe. { from, to } (ids) ou null (sem rua possivel: o conselho vira o Boost)
  function secondWay(g, m) {
    var w = g.world, c = CFG();
    if (!m || m.nodeId === null || m.nodeId === undefined || (m.edgeId !== null && m.edgeId !== undefined)) return null;
    var P = w.nodes[m.nodeId];
    if (!P || deg(P) !== 1 || typeof w.canAddEdge !== 'function') return null;
    var j = firstJunction(w, P.id), best = null, bd = Infinity, ids = sortedIds(w.nodes), minL = c.minRoadLen || 0, maxL = c.maxRoadLen || Infinity;
    for (var i = 0; i < ids.length; i++) {
      var n = w.nodes[ids[i]];
      if (!n || n.id === P.id || (j && n.id === j.id) || n.portal) continue;
      var dx = n.x - P.x, dy = n.y - P.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < minL || d > maxL || d >= bd) continue;
      var r = w.canAddEdge(P.id, n.x, n.y);
      if (r && r.ok && r.nodeId === n.id) { bd = d; best = n; }
    }
    return best ? { from: P.id, to: best.id } : null;
  }
  // ruas do desvio da obra (ids), na ordem do caminho
  function detourEdges(w, e) {
    var dt = e ? detour(w, e) : null, out = [];
    if (!dt) return out;
    var path = [e.a].concat(dt.nodes, [e.b]);
    for (var q = 0; q + 1 < path.length; q++) {
      var a = w.nodes[path[q]]; if (!a) continue;
      for (var k = 0; k < a.edges.length; k++) { var f = w.edges[a.edges[k]]; if (f && f.id !== e.id && otherEnd(f, a.id) === path[q + 1]) { out.push(f.id); break; } }
    }
    return out;
  }
  // o lugar ja esta preparado? jogo/escola: a ponta tem duas ruas; obra: uma rua do desvio com Two lanes
  function prepared(g, ev) {
    var w = g.world;
    if (!ev || !placed(ev)) return false;
    if (ev.edge !== null) {
      var e = w.edges[ev.edge]; if (!e) return false;
      return detourEdges(w, e).some(function (id) { return w.edges[id] && w.edges[id].lanes >= 2; });
    }
    var n = w.nodes[ev.node];
    return !!n && deg(n) >= 2;
  }
  // a dica do toque e da faixa: a variante 'boost' quando a segunda rua nao cabe ali (o conselho sempre se cumpre)
  function adviceKey(g, m) {
    if (m.type === 'roadwork' || m.type === 'festival') return m.type;
    var n = g.world.nodes[m.nodeId];
    if (n && deg(n) >= 2) return m.type + 'Done';
    return secondWay(g, m) ? m.type : m.type + 'Boost';
  }
  // linhas de texto (CFG.events.text): balao do toque na marca, faixa da vespera, do dia e a do primeiro evento
  function explain(g, m) { var T = (EC() || {}).text || {}, k = adviceKey(g, m); return (T.tap && (T.tap[k] || T.tap[m.type])) || ''; }
  function stripLine(g, m) {
    var T = (EC() || {}).text || {};
    var L = m.when === 'today' ? T.stripToday : T.stripEve, k = adviceKey(g, m);
    return (L && (L[k] || L[m.type])) || '';
  }
  function firstSeen(g) { var s = S(g); return !s || !!s.first; }
  function markFirst(g) { var s = S(g); if (s) s.first = true; }
  // causa do numero do dia para a linha do porque do resumo (ui.js whyCause): evento que rodou hoje. dd = carros
  // entregues hoje menos ontem. So a frase cujo sentido bate com o numero
  function whyOf(st, dd) {
    var s = st && st.events, T = (EC() || {}).text || {}, W = T.why || {};
    if (!s || !Array.isArray(s.list)) return null;
    var L = s.list.filter(function (ev) { return ev.day === st.day && ev.ran; });
    L.sort(function (a, b) { return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type); });
    for (var i = 0; i < L.length; i++) {
      var td = typeDef(L[i].type); if (!td || !W[L[i].type]) continue;
      // preparado (a segunda rua, as duas faixas do desvio): a frase diz que o preparo segurou
      if (L[i].prep && W[L[i].type + 'Prep']) return { key: 'event', type: L[i].type, text: W[L[i].type + 'Prep'], prep: true };
      if (td.kind === 'close' ? dd < 0 : dd > 0) return { key: 'event', type: L[i].type, text: W[L[i].type] };
    }
    return null;
  }
  // robos: cruzamentos que o evento de hoje e o de amanha vao encher (o lugar do aviso)
  function hotSpots(g, onlyDay) {
    var out = {}, w = g.world, st = g.state;
    (onlyDay ? [onlyDay] : [st.day, st.day + 1]).forEach(function (d) {
      evsOn(g, d).forEach(function (ev) {
        if (!placed(ev)) return;
        if (ev.edge !== null) {
          var e = w.edges[ev.edge]; if (!e) return;
          // obra: os dois cruzamentos da rua fechada e os do desvio (onde a fila vai)
          [e.a, e.b].forEach(function (id) { var n = w.nodes[id]; if (n && deg(n) >= 3) out[id] = Math.max(out[id] || 0, 1); });
          var dt = detour(w, e);
          (dt ? dt.nodes : []).forEach(function (id) { var v = w.nodes[id]; if (v && !v.portal && deg(v) >= 3) out[id] = Math.max(out[id] || 0, 0.8); });
        } else {
          var j = firstJunction(w, ev.node); if (!j) return;
          out[j.id] = Math.max(out[j.id] || 0, 1);
          // o cruzamento seguinte do caminho tambem recebe a leva
          j.edges.forEach(function (eid) { var o = w.edges[eid]; if (!o) return; var v = w.nodes[otherEnd(o, j.id)]; if (v && !v.portal && deg(v) >= 3) out[v.id] = Math.max(out[v.id] || 0, 0.6); });
        }
      });
    });
    return out;
  }

  // ---------- save ----------
  function forSave(g) {
    var s = S(g); if (!s) return undefined;
    return { v: 1, test: !!s.test, first: !!s.first, fest: s.fest ? { day: s.fest.day, id: s.fest.id } : null,
             list: s.list.map(function (ev) { return { day: ev.day, type: ev.type, size: ev.size, node: ev.node, edge: ev.edge, x: ev.x, y: ev.y, ran: !!ev.ran, prep: !!ev.prep }; }) };
  }
  // campo do save conferido: devolve o estado limpo ou null (estragado ou de outra versao)
  function normalize(d) {
    var c = CFG(), maxDays = c.maxDays || 12;
    if (!isObj(d) || d.v !== 1 || !Array.isArray(d.list) || d.list.length > 4 * maxDays) return null;
    if (d.test !== undefined && typeof d.test !== 'boolean') return null;
    if (d.first !== undefined && typeof d.first !== 'boolean') return null;
    var list = [], i;
    for (i = 0; i < d.list.length; i++) {
      var e = d.list[i];
      if (!isObj(e) || !nat(e.day) || e.day < 1 || e.day > maxDays || !typeDef(e.type)) return null;
      if (!fin(e.size) || e.size <= 0 || e.size > SIZE_MAX) return null;
      if (e.node !== null && !nat(e.node)) return null;
      if (e.edge !== null && !nat(e.edge)) return null;
      if (!fin(e.x) || !fin(e.y) || (e.ran !== undefined && typeof e.ran !== 'boolean')) return null;
      if (e.prep !== undefined && typeof e.prep !== 'boolean') return null;
      list.push({ day: e.day, type: e.type, size: e.size, node: e.node, edge: e.edge, x: e.x, y: e.y, ran: !!e.ran, prep: !!e.prep });
    }
    var f = d.fest;
    if (f !== null && f !== undefined && !(isObj(f) && nat(f.day) && nat(f.id))) return null;
    return { v: 1, test: !!d.test, list: list, first: !!d.first, fest: f ? { day: f.day, id: f.id } : null };
  }
  // load: o save traz os eventos (conferidos) ou e antigo/estragado. Sem campo: calendario da semente, sem os dias que
  // ja nao podem ser avisados (o que nunca foi mostrado nao existe)
  function load(g, data) {
    var st = g.state, n = normalize(data);
    if (n) {
      // lugar que nao existe mais no mundo carregado: some (sem marca, sem efeito)
      n.list.forEach(function (ev) {
        if (ev.node !== null && !g.world.nodes[ev.node]) ev.node = null;
        if (ev.edge !== null && !g.world.edges[ev.edge]) ev.edge = null;
      });
      // eventos desligados nesta versao: o save de uma versao com eventos nao traz dia de evento
      if (!enabled()) n.list = [];
      st.events = n;
    } else {
      init(g);
      var keep = st.day + (st.phase === 'plan' ? 1 : 2);
      st.events.list = st.events.list.filter(function (ev) { return ev.day >= keep; });
      // save antigo ja no fim do primeiro evento: o ensino da primeira vez continua valendo
    }
    // plano carregado: amanha precisa do lugar (save de antes da escolha)
    if (st.phase === 'plan') evsOn(g, st.day + 1).forEach(function (ev) { if (!placed(ev)) place(g, ev); });
    return st.events;
  }

  // pagina com ?events=test: modo de teste (capturas e testes no navegador; partida nova). Nunca no jogo publicado sem o parametro
  try {
    var q = root.location && root.location.search ? new root.URLSearchParams(root.location.search).get('events') : null;
    if (q === 'test' && EC()) EC().test = true;
  } catch (e) { /* sem location */ }

  CRZ.Events = {
    v: 1,
    schedule: schedule, dayOf: dayOf, chapterOf: chapterOf,
    init: init, onPlan: onPlan, applyDay: applyDay, tick: tick, endDay: endDay,
    tomorrow: tomorrow, today: today, forecast: forecast, scale: scale, festivalSpot: festivalSpot, festivalLive: festivalLive,
    marks: marks, helpNode: helpNode, explain: explain, stripLine: stripLine, firstSeen: firstSeen, markFirst: markFirst,
    secondWay: secondWay, detourEdges: detourEdges, prepared: prepared, adviceKey: adviceKey, enabled: enabled,
    whyOf: whyOf, hotSpots: hotSpots,
    forSave: forSave, normalize: normalize, load: load,
    _test: { detour: detour, firstJunction: firstJunction, followPortal: followPortal, allReach: allReach, routeUse: routeUse, place: place, resolve: resolve, mapK: mapK }
  };
})(typeof window !== 'undefined' ? window : globalThis);
