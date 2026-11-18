/* Cruzamento: main.js. Dono: orquestrador. Liga Game, Audio, Render e UI e roda o loop. */
(function (root) {
  'use strict';
  var CRZ = (root.CRZ = root.CRZ || {});
  var SAVE_KEY = 'cruzamento.save';
  var PLAYED_KEY = 'cruzamento.played';
  var DIFF_KEY = 'gridlet.difficulty';                 // o mesmo de difficulty.js
  var DIFF_SWITCH_KEY = 'gridlet.saveDiffSwitch';      // sessionStorage: ja recarregou para a dificuldade do save
  var OLD_SAVE_NOTICE = 'Your saved game was from an older version. Starting fresh.';
  // v2: save do jogo de 12 dias que segue na partida de 30 dias (game.migrated)
  var MIGRATED_NOTICE = 'Your saved game goes on: now 30 days, in 3 chapters.';

  var BAD_KEY = 'cruzamento.save.bad';                 // copia do ultimo save recusado (nunca apagado em silencio)
  function param(name) {
    try { return new URLSearchParams(root.location.search).get(name); } catch (e) { return null; }
  }
  // maquina de desenvolvimento: localhost, 127.0.0.1, [::1], *.localhost, *.test ou arquivo local
  function devHost() {
    try {
      var h = String(root.location.hostname || '').toLowerCase();
      if (root.location.protocol === 'file:') { return true; }
      return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || /\.localhost$/.test(h) || /\.test$/.test(h);
    } catch (e) { return false; }
  }
  // (um objeto literal com a chave '__proto__' nao a guarda como propriedade: a lista e comparada uma a uma)
  function safeKey(k) { return k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }

  // Recuperacao unica (2026-11-17): o resumo do dia 2 da primeira partida (dia esticado pela cena) era recusado e ia
  // para BAD_KEY. Uma vez por aparelho (RECOVER_KEY): se a copia agora carrega, e da primeira partida (PLAYED_KEY ainda
  // nao marcado: nenhuma partida chegou ao dia 4 depois dela) e nao ha save mais novo com jogo (sem save, ou so a manha
  // intocada do dia 1 que o recomeco gravou), ela volta a ser o save e sai de BAD_KEY. Qualquer outro caso: nada muda.
  var RECOVER_KEY = 'cruzamento.save.recovered';
  function freshDay1(j) {
    try {
      var o = JSON.parse(j), s = o && o.st;
      return !!s && s.day === 1 && s.phase === 'plan' && (!s.history || !s.history.length) &&
        !(o.undo && o.undo.list && o.undo.list.length);
    } catch (e) { return false; }
  }
  function recoverBad() {
    var bad = null, cur = null, done = null, played = null;
    try {
      done = localStorage.getItem(RECOVER_KEY); bad = localStorage.getItem(BAD_KEY);
      cur = localStorage.getItem(SAVE_KEY); played = localStorage.getItem(PLAYED_KEY);
    } catch (e) { return; }
    if (done || !bad) { return; }
    try { localStorage.setItem(RECOVER_KEY, '1'); if (localStorage.getItem(RECOVER_KEY) !== '1') { return; } } catch (e) { return; }
    if (played === '1' || (cur && !freshDay1(cur))) { return; }
    var g = null;
    try { g = CRZ.Game.load(JSON.parse(bad)); } catch (e) { g = null; }
    if (!g || g.migrated || g.state.day < 2) { return; }
    var okW = false;
    try { localStorage.setItem(SAVE_KEY, bad); okW = localStorage.getItem(SAVE_KEY) === bad; } catch (e) {}
    if (okW) { try { localStorage.removeItem(BAD_KEY); } catch (e) {} }
    else if (cur) { try { localStorage.setItem(SAVE_KEY, cur); } catch (e) {} }
  }

  function boot() {
    var canvas = document.getElementById('stage');
    var hud = document.getElementById('hud');
    if (!canvas || !hud) { throw new Error('index.html precisa de #stage e #hud'); }

    if (param('reset') !== null) { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

    // ajustes de balanceamento so para teste: ?cfg={"patience":30}&spawn=0.8
    try {
      var ov = param('cfg');
      if (ov) {
        var o = JSON.parse(ov);
        // poluicao de prototipo: '__proto__', 'constructor' e 'prototype' sao recusadas em qualquer nivel
        if (o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).forEach(function (k) {
          if (!safeKey(k) || !Object.prototype.hasOwnProperty.call(o, k)) { return; }
          var v = o[k];
          if (v && typeof v === 'object' && !Array.isArray(v) && CRZ.CFG[k] && typeof CRZ.CFG[k] === 'object') {
            Object.keys(v).forEach(function (j) { if (safeKey(j)) { CRZ.CFG[k][j] = v[j]; } });
          } else { CRZ.CFG[k] = v; }
        });
      }
      var sm = parseFloat(param('spawn'));
      if (sm > 0) { var f0 = CRZ.CFG.spawnRate; CRZ.CFG.spawnRate = function (d) { return f0(d) * sm; }; }
    } catch (e) { if (root.console) { root.console.error('cfg invalido', e); } }
    var game = null;
    var saved = null, notice = null;
    if (param('reset') === null && param('seed') === null) { recoverBad(); }
    try { saved = localStorage.getItem(SAVE_KEY); } catch (e) {}
    // ?seed= so troca a partida salva numa maquina de desenvolvimento; em producao o link nao apaga o save
    var seedParam = param('seed');
    if (seedParam !== null && saved && !devHost()) { seedParam = null; }
    if (saved && seedParam === null) {
      var parsed = null;
      try { parsed = JSON.parse(saved); game = CRZ.Game.load(parsed); } catch (e) { game = null; }
      if (game && game.migrated) { notice = MIGRATED_NOTICE; }
      var flag = null;
      try { flag = sessionStorage.getItem(DIFF_SWITCH_KEY); sessionStorage.removeItem(DIFF_SWITCH_KEY); } catch (e) {}
      if (!game) {
        // save de outra dificuldade: troca para ela e recarrega UMA vez (o flag na sessao corta o laco)
        var sd = parsed && typeof parsed === 'object' ? parsed.diff : null;
        var profs = CRZ.CFG.difficulties || {};
        if (typeof sd === 'string' && Object.prototype.hasOwnProperty.call(profs, sd) && sd !== CRZ.CFG.difficultyName && flag !== sd) {
          var switched = false;
          try {
            localStorage.setItem(DIFF_KEY, sd);
            sessionStorage.setItem(DIFF_SWITCH_KEY, sd);
            switched = sessionStorage.getItem(DIFF_SWITCH_KEY) === sd;
          } catch (e) {}
          if (switched) { root.location.reload(); return; }
        }
        // save recusado: uma copia fica em BAD_KEY (nada se perde em silencio), sai da chave do jogo antes do menu
        // (hasContinue nao mostra Continue) e o jogo comeca do zero com o aviso
        var kept = false;
        try { localStorage.setItem(BAD_KEY, saved); kept = localStorage.getItem(BAD_KEY) === saved; } catch (e) {}
        if (root.console && root.console.warn) { root.console.warn('Gridlet: save recusado' + (kept ? ', copia em ' + BAD_KEY : ', sem espaco para a copia')); }
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        notice = OLD_SAVE_NOTICE;
      }
    }
    if (!game) {
      var seed = parseInt(seedParam, 10);
      if (!(seed > 0)) { seed = (Date.now() % 2147483647) + 1; }
      var played = false;
      try { played = localStorage.getItem(PLAYED_KEY) === '1'; } catch (e) {}
      // v2: a primeira partida e sempre a Classica (v2/nivel.md 3.2: aprende o jogo antes da forma); depois, a semente
      // escolhe (game.js archetypeOf). ?arch=river|park|classic (testes) escolhe direto
      var archP = param('arch');
      game = CRZ.Game.create(seed, { teach: !played, archetype: archP || (played ? 'seed' : 'classic') });   // a cena do dia 2 e so do primeiro jogo
    }

    var audio = CRZ.Audio.create();
    game.onEvent(function (ev) { audio.handle(ev); });
    game.onEvent(function (ev) {
      if ((ev.type === 'day' && ev.day >= 4) || ev.type === 'over') {
        try { localStorage.setItem(PLAYED_KEY, '1'); } catch (e) {}
      }
    });

    var render = CRZ.Render.create(canvas, game);
    render.resize();
    render.fit(false);
    game.onEvent(function (ev) {
      if (ev.type === 'grow' || ev.type === 'day') { render.fit(true); }
      if (ev.type === 'built') { render.flash(ev.x, ev.y, 'build'); }
    });

    function takeNotice() { var n = CRZ.app && CRZ.app.notice; if (CRZ.app) { CRZ.app.notice = null; } return n || null; }

    var ui = CRZ.UI.create({ root: hud, game: game, render: render, audio: audio });

    // modulos opcionais: tutorial guiado e menu/inicio/pausa/ajuda
    var tutorial = null, menu = null;
    // aviso de save recusado: a tela inicial le CRZ.app.notice uma vez e zera (CRZ.app.takeNotice())
    CRZ.app = { game: game, render: render, ui: ui, audio: audio, notice: notice, takeNotice: takeNotice };
    try {
      if (CRZ.Tutorial) {
        tutorial = CRZ.Tutorial.create({ game: game, render: render, ui: ui });
        CRZ.app.tutorial = tutorial;
      }
    } catch (e) { if (root.console) { root.console.error('Tutorial falhou', e); } }
    try {
      if (CRZ.Menu) {
        menu = CRZ.Menu.create({ root: hud, game: game, render: render, ui: ui, audio: audio, tutorial: tutorial,
                                 autoStart: param('nostart') === null });
        CRZ.app.menu = menu;
      }
    } catch (e) { if (root.console) { root.console.error('Menu falhou', e); } }
    if (tutorial && tutorial.start && param('notut') === null) {
      try { tutorial.start(); } catch (e) { if (root.console) { root.console.error('Tutorial start falhou', e); } }
    }

    CRZ.app = {
      game: game, render: render, ui: ui, audio: audio, tutorial: tutorial, menu: menu,
      notice: CRZ.app.notice, takeNotice: takeNotice,
      // v2 (D9): Retry chapter. O save da manha do primeiro dia do capitulo (game.retrySave) vira o save do jogo e a
      // pagina recarrega, como no restart; o pagehide do reload nao regrava por cima. false: nada a voltar
      retry: function () {
        var d = game.retrySave ? game.retrySave() : null;
        if (!d) { return false; }
        var j = JSON.stringify(d), okW = false;
        try { localStorage.setItem(SAVE_KEY, j); okW = localStorage.getItem(SAVE_KEY) === j; } catch (e) {}
        if (!okW) { return false; }
        CRZ.app.leaving = true;
        try { localStorage.removeItem('gridlet.plan'); localStorage.removeItem('cruzamento.midday'); } catch (e) {}
        root.location.reload();
        return true;
      },
      restart: function () {
        // B1 (revisao 2026-11-09): o pagehide/visibilitychange do reload chamava ui.saveNow e regravava o save
        CRZ.app.leaving = true;
        try { if (ui && ui.beginLeave) { ui.beginLeave(); } } catch (e) {}
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        root.location.reload();
      }
    };

    function onResize() { render.resize(); }
    root.addEventListener('resize', onResize);
    root.addEventListener('orientationchange', function () { setTimeout(onResize, 120); });

    // v2y: com o chip do Boost na tela o dia corre a 1x de parede (ui.timeScale, rampa suave); a regra nao muda
    function tScale() { var k = ui && ui.timeScale ? +ui.timeScale() : 1; return k > 0 && k <= 1 ? k : 1; }
    var manualNow = 0;
    CRZ.app.step = function (dt) {            // usado so pelo playtest automatico (?manual)
      manualNow += dt * 1000;
      game.update(dt * tScale());
      ui.update(dt);
      if (tutorial && tutorial.update) { tutorial.update(dt); }
      if (menu && menu.update) { menu.update(dt); }
      if (audio.tick) { audio.tick(dt); }
      render.draw(manualNow);
    };
    if (param('manual') !== null) { return; }  // sem loop de animacao

    var last = 0;
    var failed = false;
    function frame(now) {
      var dt = last ? (now - last) / 1000 : 0;
      last = now;
      if (dt > 0.1) { dt = 0.1; }             // aba em segundo plano nao dispara o mundo
      if (!failed) {
        try {
          game.update(dt * tScale());
          ui.update(dt);
          if (tutorial && tutorial.update) { tutorial.update(dt); }
          if (menu && menu.update) { menu.update(dt); }
          if (audio.tick) { audio.tick(dt); }
          render.draw(now);
        } catch (e) {
          failed = true;
          if (root.console) { root.console.error('Cruzamento: erro no loop', e); }
          var msg = document.createElement('pre');
          msg.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;background:#fff;color:#d9261c;font:12px monospace;z-index:99;white-space:pre-wrap';
          msg.textContent = 'Error: ' + (e && e.stack ? e.stack : e);
          document.body.appendChild(msg);
        }
      }
      root.requestAnimationFrame(frame);
    }
    root.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
})(typeof window !== 'undefined' ? window : globalThis);
