/* Cruzamento: main.js. Dono: orquestrador. Liga Game, Audio, Render e UI e roda o loop. */
(function (root) {
  'use strict';
  var CRZ = (root.CRZ = root.CRZ || {});
  var SAVE_KEY = 'cruzamento.save';
  var PLAYED_KEY = 'cruzamento.played';
  var DIFF_KEY = 'gridlet.difficulty';                 // o mesmo de difficulty.js
  var DIFF_SWITCH_KEY = 'gridlet.saveDiffSwitch';      // sessionStorage: ja recarregou para a dificuldade do save
  var OLD_SAVE_NOTICE = 'Your saved game was from an older version. Starting fresh.';

  function param(name) {
    try { return new URLSearchParams(root.location.search).get(name); } catch (e) { return null; }
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
        Object.keys(o).forEach(function (k) {
          var v = o[k];
          if (v && typeof v === 'object' && !Array.isArray(v) && CRZ.CFG[k] && typeof CRZ.CFG[k] === 'object') {
            Object.keys(v).forEach(function (j) { CRZ.CFG[k][j] = v[j]; });
          } else { CRZ.CFG[k] = v; }
        });
      }
      var sm = parseFloat(param('spawn'));
      if (sm > 0) { var f0 = CRZ.CFG.spawnRate; CRZ.CFG.spawnRate = function (d) { return f0(d) * sm; }; }
    } catch (e) { if (root.console) { root.console.error('cfg invalido', e); } }
    var game = null;
    var saved = null, notice = null;
    try { saved = localStorage.getItem(SAVE_KEY); } catch (e) {}
    if (saved && param('seed') === null) {
      var parsed = null;
      try { parsed = JSON.parse(saved); game = CRZ.Game.load(parsed); } catch (e) { game = null; }
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
        // save recusado: sai do storage antes do menu (hasContinue nao mostra Continue) e o jogo comeca do zero
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        notice = OLD_SAVE_NOTICE;
      }
    }
    if (!game) {
      var seed = parseInt(param('seed'), 10);
      if (!(seed > 0)) { seed = (Date.now() % 2147483647) + 1; }
      var played = false;
      try { played = localStorage.getItem(PLAYED_KEY) === '1'; } catch (e) {}
      game = CRZ.Game.create(seed, { teach: !played });   // o comboio do dia 3 e so do primeiro jogo
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
      restart: function () {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        root.location.reload();
      }
    };

    function onResize() { render.resize(); }
    root.addEventListener('resize', onResize);
    root.addEventListener('orientationchange', function () { setTimeout(onResize, 120); });

    var manualNow = 0;
    CRZ.app.step = function (dt) {            // usado so pelo playtest automatico (?manual)
      manualNow += dt * 1000;
      game.update(dt);
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
          game.update(dt);
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
