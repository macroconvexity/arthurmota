/* Cruzamento: menu.js. Dono: agente MENU. Casco do jogo: tela inicial, menu, pausa, ajuda e recorde.
 * CRZ.Menu.create({root, game, render, ui, audio, tutorial}) -> {update(dt), open(), close(), showStart(), destroy(), onPlay(fn)}
 * Estilos injetados aqui (<style id="crz-menu-style">). Tudo tolera DOM/localStorage ausente. */
(function (root) {
  'use strict';
  var CRZ = (root.CRZ = root.CRZ || {});

  var KEY_LAND = 'gridlet.landOk';   // sessionStorage: 'Play anyway' dispensa o aviso de paisagem na sessao
  var LAND_MAX_H = 500;
  var KEY_SAVE = 'cruzamento.save', KEY_BEST = 'cruzamento.best', KEY_SOUND = 'cruzamento.sound', KEY_SESSION = 'cruzamento.session';

  var STR = {
    title: 'Gridlet', subtitle: 'Traffic engineer',
    play: 'Play', cont: 'Continue', howto: 'How to play', guide: 'Tools & buttons',
    bestOne: function (b) { return 'Best: ' + b.bestDelivered + ' cars \u00b7 ' + b.wins + (b.wins === 1 ? ' win' : ' wins'); },
    difficulty: 'Difficulty', normalShort: 'Normal: a bigger challenge.',
    switchAsk: function (label) { return 'Start a new game on ' + label + '? This game will end.'; },
    switchYes: 'Start new game', switchNo: 'Keep playing',
    best: 'Best', bestLine: function (b) { return b.bestDelivered + ' cars in one game'; },
    bestMore: function (b) { return b.games + (b.games === 1 ? ' game' : ' games') + ' \u00b7 ' + b.wins + (b.wins === 1 ? ' win' : ' wins') + ' \u00b7 up to day ' + b.bestDays; },
    menu: 'Menu', close: 'Close', resume: 'Back to game', pause: 'Pause', unpause: 'Resume', paused: 'Paused',
    sound: 'Sound', on: 'on', off: 'off', replay: 'Replay tutorial', newGame: 'New game', newConfirm: 'Tap again to start a new game',
    stats: function (d, max, del, s, ms) { return 'Day ' + d + ' of ' + max + ' \u00b7 ' + del + ' cars \u00b7 ' + s + ' of ' + ms + ' strikes'; },
    helpTitle: 'How to play',
    goalH: 'Goal',
    goal: 'Guide the cars through the city without letting any crossing jam. Survive {d} days with fewer than {n} strikes.',
    gestH: 'Gestures',
    gest: [
      ['Tap', 'a tool to pick it, then tap a crossing to place it.'],
      ['Drag from a road end', 'builds a road when Road is selected.'],
      ['Pinch', 'zooms the map in and out.'],
      ['Two fingers', 'move the map.'],
      ['Hold a crossing', 'shows how far it reaches.'],
      ['Two lights', 'tap one, tap Pair lights, then tap the other.']
    ],
    toolsH: 'Tools', unlocksDay: function (d) { return 'Unlocks on day ' + d; }, fromDay: function (d) { return 'Day ' + d; },
    tools: {
      road: ['Road', 'Connects two spots with a new road.'],
      stop: ['Stop', 'Cheap. Cars take turns. Good where three or four quiet roads meet.'],
      yield: ['Yield', 'Main road never stops. Best where a busy road meets a side road.'],
      light: ['Traffic light', 'Handles the heaviest four-way traffic. Skips empty sides. Pair two lights (tap one, tap Pair lights, then the other).'],
      upgrade: ['Two lanes', 'Adds a second lane to a road. Works best with a traffic light.'],
      cross: ['Crosswalk', 'Drivers wait longer here before the ring turns red. Goes where 2 or more roads meet and replaces the sign there.'],
      round: ['Roundabout', 'For four or more roads with steady traffic. Weak with only three roads.'],
      oneway: ['One-way', 'Cars drive away from the half of the road you tap. Tap again to flip, a third time for two-way. A car with no route waits, then counts as lost.']
    },
    pts: function (c) { return c + (c === 1 ? ' build point' : ' build points'); },
    moreH: 'Daily rules',
    more: [
      ['Daily dice', 'every morning from day 2 the dice roll. Good rolls give build points or a free build. Bad rolls bring more or slower cars. You see the roll when the day starts, and you can reroll once a day for {rr}.'],
      ['Strikes', 'a jammed crossing ends the day and adds 1 strike. At {n}, the game is over.'],
      ['Ring colors', 'Amber ring: busy crossing. Red ring: about to jam.'],
      ['Rewards', 'at the end of each day, pick 1 of 3. Each one says what it changes, and it lasts one day.'],
      ['Speed', 'during the day, tap the play button to change speed. Faster = more bonus points, but drivers wait less.'],
      ['Boost (\u26a1\ufe0e)', '3 per day (they recharge in the first days). During the day, tap a road end to send a car now, or a crossing with a ring to clear it.'],
      ['Undo', 'before the day starts, undo gives the build points back.']
    ],
    // seletor de dificuldade: uma frase por modo, em palavras simples. Os dois modos se comparam entre si:
    // o Easy diz os numeros contra o Normal; o Normal diz em palavras o que a jogadora sente a mais
    diffHint: { easy: 'relaxed', normal: 'the full challenge' },
    diffFewer: function (pc) { return pc + '% fewer cars'; },
    diffMore: function (pc) { return pc + '% more cars'; },
    diffThan: function (label) { return ' than ' + label; },
    diffFeelMore: 'more cars', diffFeelLess: 'fewer cars',
    diffFeelImpatient: 'less patient drivers', diffFeelPatient: 'more patient drivers',
    diffLock: function (pc) { return 'crossings take ' + pc + '% longer to jam'; },
    diffWait: function (pc) { return 'drivers wait ' + pc + '% longer'; },
    diffEnds: function (n) { return 'the game ends at ' + n + ' strikes'; },
    diffJamSlow: 'crossings jam more slowly',
    diffStrike: 'A strike is a crossing that jams.',
    diffNew: 'Switching starts a new game.',
    // paisagem curta (altura <= 500): o jogo e de iPhone em pe
    landTitle: 'Best in portrait', landText: 'Turn your phone upright for the best view.', landGo: 'Play anyway'
  };
  // frase de um perfil de dificuldade (le os numeros do perfil, nunca fixos aqui)
  // ref (opcional) = o outro perfil, para comparar: {label, spawn, patience, strikes, words}.
  // ref.words = true: diz em palavras (o Normal contra o Easy); senao, os numeros contra ref ("than Normal").
  // Sem ref: os numeros contra o trafego base do jogo (como antes).
  // copy review g: em palavras (menos numeros), comparando com o outro modo ou com o trafego base; so os
  // strikes ficam em numero. Lista de 2: 'X and Y'; de 3 ou mais: 'X, Y, and Z'
  function diffLine(name, p, ref) {
    p = p || {};
    var parts = [], sp = +p.spawn || 1, pa = +p.patience || 1;
    var rs = ref ? (+ref.spawn || 1) : 1, rp = ref ? (+ref.patience || 1) : 1;
    if (sp > rs * 1.005) { parts.push(STR.diffFeelMore); } else if (sp < rs * 0.995) { parts.push(STR.diffFeelLess); }
    if (pa < rp * 0.995) { parts.push(STR.diffFeelImpatient); } else if (pa > rp * 1.005) { parts.push(STR.diffFeelPatient); }
    if (!(ref && ref.words)) {
      var kl = (+p.lock || 1) / ((ref && +ref.lock) || 1);
      if (kl > 1.005) { parts.push(STR.diffJamSlow); }
    }
    parts.push(STR.diffEnds(p.strikes || 3));
    var lead = (p.label || name) + ': ' + (STR.diffHint[name] ? STR.diffHint[name] + '. ' : '');
    var body = parts.length > 2 ? parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1]
      : parts.join(' and ');
    return lead + body.charAt(0).toUpperCase() + body.slice(1) + '.';
  }

  /* ---------- armazenamento (tudo em try/catch) ---------- */
  function ls() { try { return root.localStorage || null; } catch (e) { return null; } }
  function ss() { try { return root.sessionStorage || null; } catch (e) { return null; } }
  function getItem(store, k) { try { return store ? store.getItem(k) : null; } catch (e) { return null; } }
  function setItem(store, k, v) { try { if (store) { store.setItem(k, v); return true; } } catch (e) {} return false; }
  function num(v) { v = +v; return isFinite(v) && v > 0 ? Math.floor(v) : 0; }

  function emptyBest() { return { bestScore: 0, bestDelivered: 0, bestDays: 0, wins: 0, games: 0 }; }
  function readBest() {
    var out = emptyBest();
    try {
      var j = JSON.parse(getItem(ls(), KEY_BEST) || 'null');
      if (j && typeof j === 'object') {
        for (var k in out) { out[k] = num(j[k]); }
      }
    } catch (e) {}
    return out;
  }
  /* soma uma partida terminada ao recorde. st: {totalScore, totalDelivered, day, strikes, maxDays}. */
  function recordOver(st, win) {
    var b = readBest();
    b.games += 1;
    if (win) { b.wins += 1; }
    b.bestScore = Math.max(b.bestScore, num(st.totalScore));
    b.bestDelivered = Math.max(b.bestDelivered, num(st.totalDelivered));
    b.bestDays = Math.max(b.bestDays, num(st.day));
    setItem(ls(), KEY_BEST, JSON.stringify(b));
    return b;
  }
  function readSound() { return getItem(ls(), KEY_SOUND) !== '0'; }
  function writeSound(on) { setItem(ls(), KEY_SOUND, on ? '1' : '0'); }
  function saveDay() {
    try {
      var j = JSON.parse(getItem(ls(), KEY_SAVE) || 'null');
      return j && j.st ? num(j.st.day) : 0;
    } catch (e) { return 0; }
  }
  // dia 2 em diante, ou o dia 1 ja jogado (resumo/carta): o save retoma a partida, nao e um comeco
  // nv8 7: limite de strikes da dificuldade em jogo (4 Easy, 3 Normal), lido na hora
  function strikesNow() {
    var C = CRZ.CFG || {}, D = CRZ.difficulty, P = D && C.difficulties ? C.difficulties[D.name] : null;
    return (P && P.strikes) || C.maxStrikes || 3;
  }
  function hasContinue() {
    if (saveDay() > 1) { return true; }
    try {
      var j = JSON.parse(getItem(ls(), KEY_SAVE) || 'null');
      return !!(j && j.st && num(j.st.day) === 1 && (j.st.phase === 'summary' || j.st.phase === 'run'));
    } catch (e) { return false; }
  }
  var sessionFlag = false;
  // 'gridlet.afterSwitch': difficulty.set pede a tela inicial depois do reload (lido uma vez)
  var afterSwitch = false;
  function readAfterSwitch() {
    try { var ssn = ss(); if (ssn && ssn.getItem('gridlet.afterSwitch') === '1') { afterSwitch = true; ssn.removeItem('gridlet.afterSwitch'); } } catch (e) {}
  }
  function sessionSeen() { return !afterSwitch && (sessionFlag || getItem(ss(), KEY_SESSION) === '1'); }
  function markSession() { sessionFlag = true; afterSwitch = false; setItem(ss(), KEY_SESSION, '1'); }

  /* ---------- icones das ferramentas (24x24, traco fino) ---------- */
  var G = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  var TOOL_SVG = {
    road: '<circle cx="5" cy="19" r="2.2" ' + G + '/><circle cx="19" cy="5" r="2.2" ' + G + '/><path d="M6.8 17.2L17.2 6.8" ' + G + '/>',
    stop: '<path d="M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7z" ' + G + '/><path d="M8 12h8" ' + G + '/>',
    yield: '<path d="M3.5 5h17L12 20z" ' + G + '/>',
    light: '<rect x="8" y="2.5" width="8" height="19" rx="4" ' + G + '/><circle cx="12" cy="7.5" r="1.6" fill="#d9261c"/><circle cx="12" cy="12" r="1.6" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="16.5" r="1.6" style="fill:var(--green,#2f8f55)"/>',
    upgrade: '<path d="M8 3v18M16 3v18" ' + G + '/><path d="M12 8v8" ' + G + ' stroke-dasharray="2 2.5"/>',
    cross: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16" ' + G + ' stroke-width="2.4"/>',
    round: '<circle cx="12" cy="12" r="6" ' + G + '/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" ' + G + '/>',
    oneway: '<path d="M4 12h16M14 6l6 6-6 6" ' + G + '/>'
  };
  function toolSvg(id) {
    return '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">' + (TOOL_SVG[id] || '') + '</svg>';
  }
  var ICON_MENU = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5v14M15 5v14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  // celular deitado que gira para ficar em pe (a animacao some com movimento reduzido)
  var ICON_ROTATE = '<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><g class="crzm-phone"><rect x="22" y="10" width="20" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M29 41h6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></g><path d="M50 30a18 18 0 0 1-6 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M41 42l3 2.5 2.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>';

  /* ---------- CSS ---------- */
  var CSS = [
    '.crzm-btn,.crzm-btn *{pointer-events:auto}',
    '.crzm-menubtn{position:fixed;top:calc(var(--sat,0px) + 4px);right:calc(var(--sar,0px) + 4px);width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--ink,#111);z-index:1;pointer-events:auto;opacity:.75}',
    /* pausa no canto ESQUERDO acima da bandeja: a direita ficam as cargas do Boost (o botao cobria a do meio) */
    '.crzm-pausebtn{position:fixed;left:calc(var(--sal,0px) + 12px);bottom:calc(var(--sab,0px) + 12px + var(--play,56px) + 14px);width:40px;height:40px;border-radius:50%;border:1.5px solid var(--gray,#cfcfcf);background:var(--bg,#fffdf8);display:none;align-items:center;justify-content:center;color:var(--ink,#111);z-index:1;pointer-events:auto}',
    /* alvo de toque de 48 px (o visual segue 40 px): o circulo de 40 px perdia toque a 20 px do centro
       (passeio da Roberta). O mesmo botao vira Resume quando pausado, entao vale para os dois */
    '.crzm-pausebtn::before{content:"";position:absolute;left:50%;top:50%;width:48px;height:48px;transform:translate(-50%,-50%);border-radius:6px;background:transparent}',
    '.crzm-pausebtn.show{display:flex}',
    '.crzm-pausebtn.on{border-color:var(--red,#d9261c);color:var(--red,#d9261c)}',
    // legenda: o botao pequeno nao se confunde com o Play/velocidade grande (jogador-so-tela 2026-11-09)
    '.crzm-pausebtn::after{content:"pause";position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:2px;font-size:11px;font-weight:600;line-height:1;color:var(--inkSoft,#555);white-space:nowrap;pointer-events:none}',
    '.crzm-pausebtn.on::after{content:"resume";color:var(--red,#d9261c)}',
    '.crzm-stamp{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);font-size:13px;letter-spacing:.28em;text-transform:uppercase;color:var(--ink,#111);border:1.5px solid var(--ink,#111);border-radius:14px;padding:8px 18px;background:var(--bg,#fffdf8);display:none;z-index:1;pointer-events:none}',
    '.crzm-stamp.show{display:block}',
    // com balao do tutorial aberto o selo sobe para baixo do HUD (no meio cobria o alvo da dica)
    'body.crz-tut-open .crzm-stamp{top:calc(var(--sat,0px) + 96px);transform:translate(-50%,0);font-size:11px;padding:4px 12px}',
    '.crzm-layer{position:fixed;inset:0;display:none;pointer-events:auto;opacity:0;transition:opacity .22s ease}',
    '.crzm-layer.open{display:flex}.crzm-layer.vis{opacity:1}',
    /* tela inicial */
    '.crzm-start{z-index:3;background:var(--bg,#fffdf8);flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:calc(var(--sat,0px) + 24px) calc(var(--sar,0px) + 24px) calc(var(--sab,0px) + 24px) calc(var(--sal,0px) + 24px);text-align:center;color:var(--ink,#111)}',
    '.crzm-h1{margin:0;font-size:40px;font-weight:200;letter-spacing:.06em;line-height:1.05}',
    '.crzm-sub{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:var(--inkSoft,#8a8a8a);margin-top:-10px}',
    '.crzm-street{position:relative;width:100%;max-width:360px;height:28px;overflow:hidden;margin:10px 0}',
    '.crzm-street i.line{position:absolute;left:0;right:0;top:50%;height:1px;background:var(--ink,#111)}',
    '.crzm-street i.node{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border:1.5px solid var(--ink,#111);border-radius:50%;background:var(--bg,#fffdf8)}',
    '.crzm-street i.car{position:absolute;top:50%;left:0;width:10px;height:10px;margin-top:-5px;border-radius:2px;background:var(--ink,#111);transform:translateX(-20px);animation:crzm-drive 9s linear infinite}',
    '.crzm-street i.car.c2{background:var(--red,#d9261c);animation-duration:12s;animation-delay:-4s}',
    '.crzm-street i.car.c3{animation-duration:10.5s;animation-delay:-8s}',
    '.crzm-street i.car.c1{animation-delay:-1s}',
    '@keyframes crzm-drive{from{transform:translateX(-20px)}to{transform:translateX(min(100vw,360px))}}',
    '.crzm-big{min-width:220px;min-height:56px;border-radius:28px;background:var(--ink,#111);color:var(--bg,#fffdf8);font-size:19px;font-weight:600;padding:0 36px}',
    '.crzm-ghost{min-height:48px;min-width:160px;border-radius:24px;border:1.5px solid var(--ink,#111);font-size:15px;padding:0 24px;color:var(--ink,#111);background:none}',
    '.crzm-diff{display:flex;gap:0;border:1.5px solid var(--ink,#111);border-radius:22px;overflow:hidden;margin:4px 0 2px}',
    '.crzm-dbtn{min-height:44px;min-width:110px;font-size:15px;font-weight:600;color:var(--ink,#111);background:none;padding:0 18px}',
    '.crzm-dbtn.on{background:var(--ink,#111);color:var(--bg,#fffdf8)}',
    '.crzm-dinfo{max-width:320px;font-size:13px;line-height:1.4;color:var(--inkSoft,#8a8a8a);margin-top:-6px;display:flex;flex-direction:column;gap:3px}',
    '.crzm-dinfo .on{color:var(--ink,#111);font-weight:600}',
    '.crzm-dnote{font-size:12px}',
    '.crzm-best{font-size:12px;line-height:1.6;color:var(--inkSoft,#8a8a8a);min-height:20px}',
    '.crzm-best b{color:var(--ink,#111);font-weight:600}',
    /* folha de menu */
    '.crzm-menu{z-index:2;align-items:flex-end;justify-content:center;background:rgba(17,17,17,.28)}',
    // B2: a folha de troca de dificuldade fica acima da tela inicial (3) e do menu (2)
    '.crzm-switch{z-index:6;align-items:flex-end;justify-content:center;background:rgba(17,17,17,.28)}',
    '.crzm-switch .crzm-sheet{display:flex;flex-direction:column;gap:10px;padding-top:16px;align-items:stretch}',
    '.crzm-switch .crzm-switchtxt{margin:0 0 4px;font-size:16px;font-weight:600;line-height:1.4}',
    '.crzm-sheet{width:100%;max-width:440px;background:var(--bg,#fffdf8);border:1.5px solid var(--ink,#111);border-bottom:0;border-radius:14px 14px 0 0;padding:6px calc(var(--sar,0px) + 16px) calc(var(--sab,0px) + 12px) calc(var(--sal,0px) + 16px);transform:translateY(24px);transition:transform .22s ease;color:var(--ink,#111)}',
    '.crzm-layer.vis .crzm-sheet{transform:none}',
    '.crzm-grab{width:36px;height:4px;border-radius:2px;background:var(--gray,#cfcfcf);margin:6px auto 4px}',
    '.crzm-row{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:52px;font-size:17px;text-align:left;border-bottom:1px solid var(--grid,#efeae0);color:var(--ink,#111)}',
    '.crzm-row small{font-size:13px;color:var(--inkSoft,#8a8a8a)}',
    '.crzm-row.armed,.crzm-row.armed small{color:var(--red,#d9261c)}',
    '.crzm-stats{font-size:12px;color:var(--inkSoft,#8a8a8a);padding:12px 0 4px;text-align:center;font-variant-numeric:tabular-nums}',
    /* ajuda */
    '.crzm-help{z-index:4;flex-direction:column;background:var(--bg,#fffdf8);color:var(--ink,#111);padding-top:var(--sat,0px)}',
    '.crzm-hhead{display:flex;align-items:center;justify-content:space-between;padding:4px calc(var(--sar,0px) + 8px) 4px calc(var(--sal,0px) + 20px);min-height:52px;border-bottom:1px solid var(--grid,#efeae0);flex:none}',
    '.crzm-hhead h2{margin:0;font-size:20px;font-weight:300;letter-spacing:.04em}',
    '.crzm-x{min-width:64px;min-height:44px;font-size:15px;color:var(--ink,#111)}',
    '.crzm-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;padding:8px calc(var(--sar,0px) + 20px) calc(var(--sab,0px) + 28px) calc(var(--sal,0px) + 20px)}',
    '.crzm-scroll h3{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--inkSoft,#8a8a8a);font-weight:600;margin:22px 0 8px}',
    '.crzm-scroll p{margin:0;font-size:16px;line-height:1.45}',
    '.crzm-li{display:flex;gap:12px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--grid,#efeae0);font-size:15px;line-height:1.4}',
    '.crzm-li b{font-weight:600}',
    '.crzm-li .ic{flex:none;width:40px;height:40px;border:1.5px solid var(--gray,#cfcfcf);border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--white,#fff)}',
    '.crzm-li.lock{opacity:.45}',
    '.crzm-li .meta{font-size:12px;color:var(--inkSoft,#8a8a8a);margin-top:1px}',
    '.crzm-li .tag{color:var(--red,#d9261c)}',
    /* aviso de paisagem curta: cobre tudo (acima da ajuda e do tutorial, .crz-tut z 60), gentil, um botao que dispensa */
    '.crzm-land{z-index:70;background:var(--bg,#fffdf8);flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:calc(var(--sat,0px) + 16px) calc(var(--sar,0px) + 24px) calc(var(--sab,0px) + 16px) calc(var(--sal,0px) + 24px);text-align:center;color:var(--ink,#111)}',
    '.crzm-land h2{margin:0;font-size:24px;font-weight:300;letter-spacing:.04em}',
    '.crzm-land p{margin:0;font-size:15px;line-height:1.4;max-width:320px}',
    '.crzm-land .crzm-ghost{margin-top:6px;min-height:44px}',
    '.crzm-phone{transform-origin:32px 28px;transform:rotate(-90deg);animation:crzm-upright 2.4s ease-in-out infinite}',
    '@keyframes crzm-upright{0%,25%{transform:rotate(-90deg)}55%,100%{transform:rotate(0)}}',
    /* Play anyway em paisagem curta: a tela inicial rola e o seletor fica numa linha com o texto embaixo */
    '@media (orientation:landscape) and (max-height:500px){.crzm-start{justify-content:flex-start;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding-top:calc(var(--sat,0px) + 12px);padding-bottom:calc(var(--sab,0px) + 12px)}.crzm-start>*{flex:none}.crzm-diff{flex-wrap:nowrap}.crzm-dbtn{white-space:nowrap}.crzm-dinfo{max-width:520px;margin-top:0}.crzm-street{display:none}.crzm-sub{margin-top:-4px}}',
    '@media (orientation:landscape) and (max-height:500px){.crzm-start{gap:8px}.crzm-h1{font-size:30px}.crzm-street{margin:0}.crzm-big{min-height:46px}.crzm-ghost{min-height:40px}.crzm-sheet{max-height:100%;overflow-y:auto}.crzm-pausebtn{bottom:calc(var(--sab,0px) + 8px + var(--play,48px) + 10px)}}',
    '@media (prefers-reduced-motion:reduce){.crzm-phone{animation:none;transform:none}}',
    '@media (prefers-reduced-motion:reduce){.crzm-layer,.crzm-sheet{transition:none!important}.crzm-street i.car{animation:none!important;transform:none}.crzm-street i.c1{left:12%}.crzm-street i.c2{left:50%}.crzm-street i.c3{left:78%}}'
  ].join('\n');

  /* ---------- helpers de DOM ---------- */
  function el(tag, cls, text) {
    var e = root.document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text != null) { e.textContent = text; }
    return e;
  }
  function btn(cls, text, fn) {
    var b = el('button', cls, text);
    b.setAttribute('type', 'button');
    if (fn) { b.addEventListener('click', fn); }
    return b;
  }
  function has(c, name) { return !!(c && c.classList && c.classList.contains(name)); }

  function create(opts) {
    opts = opts || {};
    var doc = root.document;
    var game = opts.game, audio = opts.audio, ui = opts.ui;
    var tutorial = opts.tutorial;
    var disposers = [];
    var playCbs = [];
    var destroyed = false;
    var soundOn = readSound();
    var ownPaused = false;
    var menuOpen = false, helpOpen = false, startOpen = false;
    var landOpen = false, landPaused = false, landEl = null;
    var newArmedAt = 0, NEW_ARM_MS = 5000;   // nv8 1: 5 s para o segundo toque
    var recorded = false;
    var cacheKey = '';
    var rootEl = null, madeRoot = false, styleEl = null;
    var menuBtn, pauseBtn, stamp, startEl, menuEl, helpEl;
    var els = {};

    function st() { return (game && game.state) || {}; }
    function body() { return doc && doc.body; }
    function bodyClass(name, on) { var b = body(); if (b && b.classList) { b.classList[on ? 'add' : 'remove'](name); } }
    function modalCount() { return (startOpen ? 1 : 0) + (menuOpen ? 1 : 0) + (helpOpen ? 1 : 0) + (landOpen ? 1 : 0) + (switchOpen ? 1 : 0); }
    // nv7: trocar de dificuldade com partida em andamento apaga a partida: pede confirmacao numa folha
    var switchEl = null, switchOpen = false, switchTo = null;
    // nv8 2: dia 1 com qualquer construcao (ou dia ja iniciado) tambem pede a folha antes de apagar
    function liveProgress() {
      var s = st();
      if (num(s.day) > 1 || s.phase === 'run' || s.phase === 'summary' || num(s.totalDelivered) > 0) { return true; }
      try { if (game && game.canUndo && game.canUndo()) { return true; } } catch (e) {}
      return false;
    }
    function askSwitch(n) {
      var D = CRZ.difficulty; if (!D) { return; }
      if (!hasContinue() && !liveProgress()) { D.set(n); return; }
      switchTo = n;
      if (!switchEl) {
        switchEl = layer('crzm-switch', STR.difficulty);
        var sh = el('div', 'crzm-sheet');
        els.switchTxt = el('p', 'crzm-switchtxt', '');
        sh.appendChild(els.switchTxt);
        sh.appendChild(btn('crzm-big', STR.switchYes, function () { var t = switchTo; closeSwitch(); if (t && CRZ.difficulty) { CRZ.difficulty.set(t); } }));
        sh.appendChild(btn('crzm-ghost', STR.switchNo, function () { closeSwitch(); }));
        switchEl.appendChild(sh); rootEl.appendChild(switchEl);
      }
      els.switchTxt.textContent = STR.switchAsk(D.label(n));
      // uma folha por vez: a folha sai por cima e o menu fecha SEM despausar (switchOpen ja vale)
      switchOpen = true;
      if (menuOpen) { closeMenu(); }
      openLayer(switchEl); syncModal(); syncPause();
      try { var fb = switchEl.querySelector && switchEl.querySelector('.crzm-big'); if (fb && fb.focus) { fb.focus(); } } catch (e) {}
    }
    function closeSwitch() {
      if (!switchOpen) { return; }
      switchOpen = false; closeLayer(switchEl); syncModal();
      // 'Keep playing': o dia que o menu tinha pausado volta a andar
      if (ownPaused && !menuOpen && !landOpen) { ownPaused = false; if (game && game.setPaused && st().paused) { game.setPaused(false); } }
      syncPause();
    }
    // M2: o guia 'Tools & buttons' (ui.js) tambem segura crz-modal
    function syncModal() { var gOpen = false; try { gOpen = !!(CRZ.app && CRZ.app.ui && CRZ.app.ui.isGuideOpen && CRZ.app.ui.isGuideOpen()); } catch (e) {} bodyClass('crz-modal', modalCount() > 0 || gOpen); }

    if (audio && audio.setEnabled) { try { audio.setEnabled(soundOn); } catch (e) {} }

    /* ---------- montagem ---------- */
    function mount() {
      if (!doc || !doc.createElement) { return false; }
      try {
        rootEl = opts.overlayRoot || (doc.getElementById && doc.getElementById('crz-overlay-root'));
        if (!rootEl) {
          rootEl = el('div'); rootEl.id = 'crz-overlay-root';
          rootEl.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:20';
          if (body()) { body().appendChild(rootEl); }
          madeRoot = true;
        }
        styleEl = doc.getElementById && doc.getElementById('crz-menu-style');
        if (!styleEl) {
          styleEl = el('style'); styleEl.id = 'crz-menu-style'; styleEl.textContent = CSS;
          (doc.head || body()).appendChild(styleEl);
        }
        buildMenuBtn(); buildPause(); buildMenu(); buildHelp(); buildStart(); buildLand();
        bodyClass('crz-menu-on', true);
        return true;
      } catch (e) { if (root.console) { root.console.error('menu: montagem', e); } return false; }
    }

    function buildMenuBtn() {
      menuBtn = btn('crzm-menubtn', null, function () { toggleMenu(); });
      menuBtn.innerHTML = ICON_MENU;
      menuBtn.setAttribute('aria-label', STR.menu);
      menuBtn.setAttribute('data-tut', 'menu');
      rootEl.appendChild(menuBtn);
    }
    function buildPause() {
      pauseBtn = btn('crzm-pausebtn', null, function () {
        if (!game || !game.setPaused) { return; }
        ownPaused = false;
        game.setPaused(!st().paused);
        syncPause();
      });
      pauseBtn.innerHTML = ICON_PAUSE;
      pauseBtn.setAttribute('aria-label', STR.pause);
      pauseBtn.setAttribute('data-tut', 'pause');
      stamp = el('div', 'crzm-stamp', STR.paused);
      stamp.setAttribute('aria-live', 'polite');
      rootEl.appendChild(pauseBtn); rootEl.appendChild(stamp);
    }

    function layer(cls, label) {
      var d = el('div', 'crzm-layer ' + cls);
      d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', label);
      return d;
    }
    function openLayer(d) { d.classList.add('open'); if (root.requestAnimationFrame) { root.requestAnimationFrame(function () { d.classList.add('vis'); }); } else { d.classList.add('vis'); } }
    function closeLayer(d) {
      d.classList.remove('vis');
      var reduce = false;
      try { reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
      if (reduce || !root.setTimeout) { d.classList.remove('open'); } else {
        var t = root.setTimeout(function () { if (!has(d, 'vis')) { d.classList.remove('open'); } }, 240);
        disposers.push(function () { root.clearTimeout(t); });
      }
    }

    function buildMenu() {
      menuEl = layer('crzm-menu', STR.menu);
      menuEl.addEventListener('click', function (e) { if (e.target === menuEl) { closeMenu(); } });
      var sheet = el('div', 'crzm-sheet');
      sheet.appendChild(el('div', 'crzm-grab'));
      els.rCont = btn('crzm-row', STR.resume, function () {
        var wasRun = st().phase === 'run';
        closeMenu();
        if (wasRun && st().paused && game && game.setPaused) { ownPaused = false; game.setPaused(false); syncPause(); }
      });
      els.rPause = btn('crzm-row', STR.pause, function () {
        if (!game || !game.setPaused) { return; }
        ownPaused = false;
        game.setPaused(!st().paused); syncMenuRows(); syncPause();
      });
      els.rHelp = btn('crzm-row', STR.howto, function () { openHelp(); });
      // o mesmo guia do botao '?' da bandeja (ui.js): ferramentas liberadas, botoes, cores, cartas
      els.rGuide = btn('crzm-row', STR.guide, function () {
        var u = CRZ.app && CRZ.app.ui;
        closeMenu();
        if (u && typeof u.openGuide === 'function') { u.openGuide(); }
      });
      els.rSound = btn('crzm-row', null, function () { toggleSound(); });
      els.rTut = btn('crzm-row', STR.replay, function () {
        if (!tutorial || !tutorial.replay) { return; }
        closeMenu(); tutorial.replay();
      });
      els.rNew = btn('crzm-row', STR.newGame, function () { pressNew(); });
      // Difficulty: o mesmo seletor e as frases com os numeros reais (lidos do CFG), onde a jogadora procura
      els.rDiff = btn('crzm-row', STR.difficulty, function () {
        var open = els.mDiff.classList.contains('gone');
        if (open) { els.mDiff.classList.remove('gone'); } else { els.mDiff.classList.add('gone'); }
        els.rDiff.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      els.rDiff.setAttribute('aria-expanded', 'false');
      els.mDiff = buildDiffBlock();
      els.stats = el('div', 'crzm-stats');
      [els.rCont, els.rPause, els.rHelp, els.rGuide, els.rDiff, els.mDiff, els.rSound, els.rTut, els.rNew, els.stats].forEach(function (x) { sheet.appendChild(x); });
      menuEl.appendChild(sheet);
      rootEl.appendChild(menuEl);
    }

    // bloco de dificuldade do menu: seletor + uma frase por modo (numeros reais) + o que e strike + aviso de jogo novo
    function buildDiffBlock() {
      var box = el('div', 'crzm-mdiff gone'), D = CRZ.difficulty;
      if (!D) { return box; }
      var row = el('div', 'crzm-diff');
      row.setAttribute('role', 'group'); row.setAttribute('aria-label', STR.difficulty);
      D.list.forEach(function (n) {
        var b = btn('crzm-dbtn' + (n === D.name ? ' on' : ''), D.label(n), function () { if (n !== D.name) { askSwitch(n); } });
        b.setAttribute('aria-pressed', n === D.name ? 'true' : 'false');
        row.appendChild(b);
      });
      box.appendChild(row);
      var info = el('div', 'crzm-dinfo');
      var profs = (CRZ.CFG && CRZ.CFG.difficulties) || {};
      D.list.forEach(function (n) {
        // as duas frases se comparam: Easy em numeros contra o Normal; Normal em palavras contra o Easy
        var ref = null;
        if (n !== 'normal' && profs.normal) { ref = profs.normal; }
        else if (n === 'normal' && profs.easy) { ref = { label: profs.easy.label, spawn: profs.easy.spawn, patience: profs.easy.patience, words: true }; }
        info.appendChild(el('div', n === D.name ? 'on' : null, diffLine(n, profs[n] || { label: D.label(n) }, ref)));
      });
      els.diffNote = el('div', 'crzm-dnote', STR.diffStrike);
      info.appendChild(els.diffNote);
      box.appendChild(info);
      return box;
    }

    function buildHelp() {
      helpEl = layer('crzm-help', STR.helpTitle);
      var head = el('div', 'crzm-hhead');
      head.appendChild(el('h2', null, STR.helpTitle));
      head.appendChild(btn('crzm-x', STR.close, function () { closeHelp(); }));
      var sc = el('div', 'crzm-scroll');
      sc.setAttribute('data-scroll', '1');
      els.helpBody = sc;
      helpEl.appendChild(head); helpEl.appendChild(sc);
      rootEl.appendChild(helpEl);
    }

    function fillHelp() {
      var sc = els.helpBody;
      if (!sc) { return; }
      sc.textContent = '';
      var day = num(st().day) || 1;
      var CFG = CRZ.CFG || {};
      sc.appendChild(el('h3', null, STR.goalH));
      sc.appendChild(el('p', null, STR.goal.replace('{n}', String(strikesNow())).replace('{d}', String((CRZ.CFG && CRZ.CFG.maxDays) || 12))));
      sc.appendChild(el('h3', null, STR.gestH));
      STR.gest.forEach(function (g) { sc.appendChild(liText(g[0], g[1])); });
      sc.appendChild(el('h3', null, STR.toolsH));
      var order = CFG.toolOrder || Object.keys(STR.tools);
      order.forEach(function (id) {
        var def = (CFG.tools && CFG.tools[id]) || { cost: 0, unlockDay: 1 };
        var info = STR.tools[id] || [id, ''];
        var locked = day < def.unlockDay;
        var li = el('div', 'crzm-li' + (locked ? ' lock' : ''));
        var ic = el('div', 'ic'); ic.innerHTML = toolSvg(id);
        var tx = el('div');
        var b = el('b', null, info[0]);
        tx.appendChild(b);
        tx.appendChild(el('div', null, info[1]));
        var meta = el('div', 'meta', STR.pts(def.cost) + ' · ' + (locked ? '' : STR.fromDay(def.unlockDay)));
        if (locked) { meta.appendChild(el('span', 'tag', STR.unlocksDay(def.unlockDay))); }
        tx.appendChild(meta);
        li.appendChild(ic); li.appendChild(tx);
        sc.appendChild(li);
      });
      sc.appendChild(el('h3', null, STR.moreH));
      var ms = String(strikesNow());
      var rrN = CRZ.CFG && CRZ.CFG.dice && CRZ.CFG.dice.rerollCost, rrTxt = typeof rrN === 'number' ? rrN + (rrN === 1 ? ' build point' : ' build points') : '1 build point';
      STR.more.forEach(function (g) { sc.appendChild(liText(g[0], g[1].replace('{n}', ms).replace('{rr}', rrTxt))); });
    }
    function liText(head, text) {
      var li = el('div', 'crzm-li');
      var tx = el('div');
      tx.appendChild(el('b', null, head + ': '));
      tx.appendChild(doc.createTextNode ? doc.createTextNode(text) : el('span', null, text));
      li.appendChild(tx);
      return li;
    }

    function buildStart() {
      startEl = layer('crzm-start', STR.title);
      startEl.appendChild(el('h1', 'crzm-h1', STR.title));
      startEl.appendChild(el('div', 'crzm-sub', STR.subtitle));
      var street = el('div', 'crzm-street');
      street.setAttribute('aria-hidden', 'true');
      street.appendChild(el('i', 'line'));
      street.appendChild(el('i', 'node'));
      ['c1', 'c2', 'c3'].forEach(function (c) { street.appendChild(el('i', 'car ' + c)); });
      startEl.appendChild(street);
      // seletor de dificuldade (Easy | Normal): trocar comeca um jogo novo
      els.diff = el('div', 'crzm-diff');
      els.diff.setAttribute('role', 'group'); els.diff.setAttribute('aria-label', 'Difficulty');
      els.diffBtns = {};
      var D = CRZ.difficulty;
      if (D) {
        D.list.forEach(function (n) {
          var b = btn('crzm-dbtn' + (n === D.name ? ' on' : ''), D.label(n), function () { if (n !== D.name) { askSwitch(n); } });
          b.setAttribute('data-tut', 'diff-' + n); b.setAttribute('aria-pressed', n === D.name ? 'true' : 'false');
          els.diffBtns[n] = b; els.diff.appendChild(b);
        });
        startEl.appendChild(els.diff);
        // tela inicial SEM explicacao de dificuldade (Arthur 2026-11-09: quem nunca jogou nao sabe o que e strike,
        // crossing nem jam). So no Normal uma linha curta, sem numeros; os numeros ficam no menu > Difficulty
        els.diffShort = el('div', 'crzm-dshort' + (D.name === 'normal' ? '' : ' gone'), D.name === 'normal' ? STR.normalShort : '');
        els.diffShort.setAttribute('data-tut', 'diff-info');
        startEl.appendChild(els.diffShort);
      }
      els.play = btn('crzm-big', STR.play, function () { playPressed(); });
      els.play.setAttribute('data-tut', 'start');
      els.how = btn('crzm-ghost', STR.howto, function () { openHelp(); });
      els.best = el('div', 'crzm-best');
      startEl.appendChild(els.play); startEl.appendChild(els.how); startEl.appendChild(els.best);
      rootEl.appendChild(startEl);
    }

    /* ---------- paisagem curta: 'Best in portrait' ---------- */
    function buildLand() {
      landEl = layer('crzm-land', STR.landTitle);
      landEl.setAttribute('data-tut', 'land');
      var ic = el('div', 'crzm-landic'); ic.innerHTML = ICON_ROTATE;
      landEl.appendChild(ic);
      landEl.appendChild(el('h2', null, STR.landTitle));
      landEl.appendChild(el('p', null, STR.landText));
      els.landGo = btn('crzm-ghost', STR.landGo, function () { landDismiss(); });
      els.landGo.setAttribute('data-tut', 'land-go');
      landEl.appendChild(els.landGo);
      rootEl.appendChild(landEl);
    }
    // PERF.md: largura/altura guardadas e relidas so em resize/orientationchange/visualViewport (ler
    // innerWidth todo quadro, logo depois de o HUD escrever na pagina, forcava layout)
    var vp = { w: 0, h: 0, read: false };
    function readViewport() {
      try { vp.w = +root.innerWidth || 0; vp.h = +root.innerHeight || 0; } catch (e) {}
      vp.read = true; pauseKey = '';
    }
    function isShortLand() {
      if (!vp.read) { readViewport(); }
      var w = vp.w, h = vp.h;
      return w > 0 && h > 0 && h <= LAND_MAX_H && w > h;
    }
    var landOk = false;
    function landDismissed() { return landOk || getItem(ss(), KEY_LAND) === '1'; }
    function landDismiss() {
      landOk = true; setItem(ss(), KEY_LAND, '1');
      landSync();
    }
    // mostra/esconde o aviso pelo tamanho da tela. Aberto: segura o relogio do dia (so se ele mesmo pausou,
    // devolve ao fechar; pausa do menu, do tutorial ou da jogadora fica como estava)
    function landSync() {
      if (!landEl) { return; }
      var want = isShortLand() && !landDismissed();
      var s = st();
      if (want && s.phase === 'run' && !s.paused && game && game.setPaused) { game.setPaused(true); landPaused = true; }
      if (want === landOpen) { return; }
      landOpen = want;
      if (want) { openLayer(landEl); } else {
        closeLayer(landEl);
        if (landPaused) {
          landPaused = false;
          if (!menuOpen && game && game.setPaused && st().paused && st().phase === 'run') { game.setPaused(false); }
        }
      }
      syncModal(); syncPause();
    }

    function fillStart() {
      els.play.textContent = hasContinue() ? STR.cont : STR.play;
      // com jogo salvo, avisa que trocar a dificuldade apaga a partida (difficulty.set recomeca)
      if (els.diffNote) { els.diffNote.textContent = STR.diffStrike + (hasContinue() ? ' ' + STR.diffNew : ''); }
      var b = readBest();
      els.best.textContent = '';
      // save de versao antiga recusado em main.js: avisa uma vez (takeNotice zera o aviso)
      try {
        var nt = root.CRZ && root.CRZ.app && root.CRZ.app.takeNotice && root.CRZ.app.takeNotice();
        if (nt) { els.best.appendChild(el('div', null, nt)); }
      } catch (e) {}
      // so depois do primeiro jogo terminado, em UMA linha ('Best: 1635 cars · 1 win')
      if (b.games > 0) { els.best.appendChild(el('div', null, STR.bestOne(b))); }
    }

    /* ---------- ações ---------- */
    function playPressed() {
      markSession();
      try { if (audio && audio.unlock) { audio.unlock(); } } catch (e) {}
      closeStart();
      for (var i = 0; i < playCbs.length; i++) { try { playCbs[i](); } catch (e) {} }
    }
    function showStart() {
      if (!startEl) { return; }
      if (menuOpen) { closeMenu(); }
      fillStart();
      startOpen = true; openLayer(startEl); syncModal();
    }
    function closeStart() {
      if (!startOpen) { return; }
      startOpen = false; closeLayer(startEl); syncModal();
      if (helpOpen) { closeHelp(); }
    }

    function toggleMenu() { if (menuOpen) { closeMenu(); } else { open(); } }
    function open() {
      if (!menuEl || menuOpen || startOpen) { return; }
      var s = st();
      if (s.phase === 'run' && !s.paused && game && game.setPaused) { game.setPaused(true); ownPaused = true; }
      menuOpen = true; newArmedAt = 0;
      syncMenuRows();
      openLayer(menuEl); syncModal();
    }
    function close() {
      if (helpOpen) { closeHelp(); }
      closeMenu();
    }
    function closeMenu() {
      if (!menuOpen) { return; }
      menuOpen = false; newArmedAt = 0;
      closeLayer(menuEl); syncModal();
      if (ownPaused) {
        ownPaused = false;
        if (landOpen) { landPaused = true; }   // o aviso de paisagem segue aberto: ele devolve o relogio
        else if (switchOpen) { ownPaused = true; }   // B2: a folha de troca segue aberta: o dia continua parado
        else if (game && game.setPaused && st().paused) { game.setPaused(false); }
      }
      syncPause();
    }
    function openHelp() { if (!helpEl) { return; } fillHelp(); helpOpen = true; openLayer(helpEl); syncModal(); }
    function closeHelp() { if (!helpOpen) { return; } helpOpen = false; closeLayer(helpEl); syncModal(); }

    function toggleSound() {
      soundOn = !soundOn;
      writeSound(soundOn);
      if (audio && audio.setEnabled) { try { audio.setEnabled(soundOn); } catch (e) {} }
      syncMenuRows();
    }

    function pressNew() {
      var now = root.Date.now();
      if (!newArmedAt || now - newArmedAt > NEW_ARM_MS) {
        newArmedAt = now; syncMenuRows();
        // nv8 1: o rotulo vermelho volta ao original quando a janela fecha (mesmo sem outro evento)
        try { root.setTimeout(function () { if (newArmedAt && root.Date.now() - newArmedAt >= NEW_ARM_MS) { newArmedAt = 0; syncMenuRows(); } }, NEW_ARM_MS + 50); } catch (e) {}
        return;
      }
      newArmedAt = 0; syncMenuRows();
      var app = CRZ.app;
      if (app && typeof app.restart === 'function') { app.restart(); return; }
      setItem(ls(), KEY_SAVE, '');
      try { if (ls()) { ls().removeItem(KEY_SAVE); } } catch (e) {}
      try { root.location.reload(); } catch (e) {}
    }

    /* ---------- sincronização ---------- */
    function syncMenuRows() {
      if (!menuEl) { return; }
      var s = st();
      var inRun = s.phase === 'run';
      // o menu ja pausou o dia: 'Back to game' basta (nv7: 'Back to game' e 'Resume' juntos)
      // nv8 7: no dia, uma linha so: 'Resume' (fecha o menu e o dia volta a andar); no plano, 'Back to game'
      els.rPause.style.display = 'none';
      els.rCont.textContent = inRun ? STR.unpause : STR.resume;
      // quem abriu o menu em run ja pausou o jogo: o rotulo mostra "Retomar"
      els.rPause.textContent = s.paused ? STR.unpause : STR.pause;
      els.rSound.textContent = '';
      els.rSound.appendChild(doc.createTextNode ? doc.createTextNode(STR.sound) : el('span', null, STR.sound));
      els.rSound.appendChild(el('small', null, soundOn ? STR.on : STR.off));
      els.rTut.style.display = tutorial && tutorial.replay ? '' : 'none';
      var armed = newArmedAt && root.Date.now() - newArmedAt <= NEW_ARM_MS;
      els.rNew.textContent = armed ? STR.newConfirm : STR.newGame;
      els.rNew.classList[armed ? 'add' : 'remove']('armed');
      els.stats.textContent = STR.stats(num(s.day) || 1, num(s.maxDays) || (CRZ.CFG && CRZ.CFG.maxDays) || 12,
        num(s.totalDelivered), num(s.strikes), (CRZ.CFG && CRZ.CFG.maxStrikes) || 3);
    }
    function syncPause() {
      if (!pauseBtn) { return; }
      var s = st();
      var show = s.phase === 'run' && !startOpen && !helpOpen && !landOpen;
      var was = has(pauseBtn, 'show');
      pauseBtn.classList[show ? 'add' : 'remove']('show');
      if (show && !was) { pauseClock = 0; }   // acabou de aparecer: mede o lugar ja no proximo quadro
      var p = !!s.paused && s.phase === 'run';
      pauseBtn.classList[p ? 'add' : 'remove']('on');
      pauseBtn.innerHTML = p ? ICON_PLAY : ICON_PAUSE;
      pauseBtn.setAttribute('aria-label', p ? STR.unpause : STR.pause);
      stamp.classList[p && !menuOpen && !landOpen ? 'add' : 'remove']('show');
      menuBtn.style.display = s.phase === 'over' ? 'none' : '';
    }

    // botao de pausa: nunca por cima de uma ferramenta. A bandeja vira duas fileiras a partir do dia 6 e
    // o lugar padrao (canto de baixo, acima da altura do play) caia sobre "New road". Mede a barra de
    // baixo de verdade e escolhe o primeiro lugar livre: padrao, canto de baixo, acima da barra, topo.
    var pauseClock = 0;
    function rectOf(e) {
      try { var r = e.getBoundingClientRect(); return r && r.width > 0 && r.height > 0 ? r : null; } catch (x) { return null; }
    }
    function pauseHits(l, t, sz, list) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (l < r.right + 6 && l + sz > r.left - 6 && t < r.bottom + 6 && t + sz > r.top - 6) { return true; }
      }
      return false;
    }
    // PERF.md: a posicao do botao de pausa so e recalculada quando a tela ou o HUD mudam (chave sem ler layout:
    // tamanho guardado e as classes dos elementos do HUD); antes lia getBoundingClientRect 4 vezes por segundo
    var pauseKey = '';
    function placePause() {
      if (!pauseBtn || !has(pauseBtn, 'show') || !doc.querySelectorAll || !pauseBtn.style) { pauseKey = ''; return; }
      var q, i;
      try { q = doc.querySelectorAll('.crz-bottom button, .crz-bottom .crz-tile, .crz-bottom .crz-chip, .crz-clear, .crz-fit, .crz-top'); } catch (x) { return; }
      if (!vp.read) { readViewport(); }
      var key = vp.w + 'x' + vp.h + '|' + q.length;
      for (i = 0; i < q.length; i++) { key += '|' + (q[i].className || ''); }
      if (key === pauseKey) { return; }
      pauseKey = key;
      var ps = pauseBtn.style;
      ps.top = ''; ps.bottom = '';
      var d = rectOf(pauseBtn); if (!d) { return; }
      var list = [], low = [], r, vh = vp.h || root.innerHeight || 0, topBar = 0;
      for (i = 0; i < q.length; i++) {
        r = rectOf(q[i]); if (!r) { continue; }
        list.push(r);
        if (has(q[i], 'crz-top')) { topBar = Math.max(topBar, r.bottom); } else if (r.top > vh * 0.4) { low.push(r); }
      }
      var sz = d.width, cands = [d.top], minTop = vh, maxBot = 0;
      for (i = 0; i < low.length; i++) {
        // so o que esta na coluna do botao conta para "acima da barra"
        if (low[i].left < d.right + 6 && low[i].right > d.left - 6) { minTop = Math.min(minTop, low[i].top); }
        maxBot = Math.max(maxBot, low[i].bottom);
      }
      if (maxBot > 0) { cands.push(maxBot - sz); }          // canto de baixo (fileira de baixo, se livre)
      if (minTop < vh) { cands.push(minTop - 10 - sz); }      // acima da bandeja, pela altura real
      cands.push(topBar + 10);                                // topo, abaixo da barra de cima
      for (i = 0; i < cands.length; i++) {
        if (cands[i] < topBar || pauseHits(d.left, cands[i], sz, list)) { continue; }
        if (i > 0) { ps.top = Math.round(cands[i]) + 'px'; ps.bottom = 'auto'; }
        return;
      }
      ps.top = Math.round(topBar + 10) + 'px'; ps.bottom = 'auto';
    }

    function update(dt) {
      if (destroyed) { return; }
      pauseClock -= (+dt || 0);
      if (pauseClock <= 0) { pauseClock = 0.25; try { placePause(); } catch (e) {} }
      try { landSync(); } catch (e) {}
      var s = st();
      var key = [s.phase, !!s.paused, menuOpen, helpOpen, startOpen, landOpen, s.day, s.strikes, s.totalDelivered].join('|');
      if (key === cacheKey) {
        if (newArmedAt && menuOpen && root.Date.now() - newArmedAt > NEW_ARM_MS) { newArmedAt = 0; syncMenuRows(); }
        return;
      }
      cacheKey = key;
      syncPause();
      if (menuOpen) { syncMenuRows(); }
    }

    /* ---------- eventos ---------- */
    if (game && game.onEvent) {
      var off = game.onEvent(function (ev) {
        if (!ev) { return; }
        if (ev.type === 'over') {
          if (!recorded) { recorded = true; recordOver(st(), !!ev.win); }
          if (menuOpen) { closeMenu(); }
        } else if (ev.type === 'day' || ev.type === 'phase') {
          if (ev.type === 'phase' && ev.phase === 'run') { recorded = false; }
          if (ev.type === 'phase' && ev.phase !== 'run') { ownPaused = false; }
        }
      });
      if (typeof off === 'function') { disposers.push(off); }
    }

    function onKey(e) {
      if (!e || e.key !== 'Escape') { return; }
      if (switchOpen) { closeSwitch(); } else if (helpOpen) { closeHelp(); } else if (menuOpen) { closeMenu(); }
    }
    function onResize() {
      readViewport();
      var land = vp.w > vp.h;
      if (rootEl && rootEl.classList) { rootEl.classList[land ? 'add' : 'remove']('crzm-landscape'); }
      try { landSync(); } catch (e) {}
    }
    if (root.addEventListener) {
      root.addEventListener('keydown', onKey);
      root.addEventListener('resize', onResize);
      root.addEventListener('orientationchange', onResize);
      try { if (root.visualViewport && root.visualViewport.addEventListener) { root.visualViewport.addEventListener('resize', onResize); disposers.push(function () { root.visualViewport.removeEventListener('resize', onResize); }); } } catch (e) {}
      disposers.push(function () {
        root.removeEventListener('keydown', onKey);
        root.removeEventListener('resize', onResize);
        root.removeEventListener('orientationchange', onResize);
      });
    }

    function destroy() {
      destroyed = true;
      if (menuOpen && ownPaused && game && game.setPaused) { try { game.setPaused(false); } catch (e) {} }
      disposers.forEach(function (d) { try { d(); } catch (e) {} });
      if (landPaused && game && game.setPaused) { try { game.setPaused(false); } catch (e) {} }
      [menuBtn, pauseBtn, stamp, startEl, menuEl, helpEl, landEl, switchEl].forEach(function (x) {
        try { if (x && x.parentNode) { x.parentNode.removeChild(x); } } catch (e) {}
      });
      try { if (styleEl && styleEl.parentNode) { styleEl.parentNode.removeChild(styleEl); } } catch (e) {}
      try { if (madeRoot && rootEl && rootEl.parentNode) { rootEl.parentNode.removeChild(rootEl); } } catch (e) {}
      bodyClass('crz-menu-on', false); bodyClass('crz-modal', false);
    }

    var mounted = mount();
    readAfterSwitch();
    if (mounted) {
      onResize(); syncPause();
      // nv7: sem partida em andamento (nenhum dia jogado), a visita volta a tela inicial mesmo na mesma aba;
      // a sessao so conta como vista depois do Play
      if (opts.autoStart !== false && (!sessionSeen() || !hasContinue())) { showStart(); }
    }

    return {
      update: update, open: open, close: close, showStart: showStart, destroy: destroy, placePause: placePause,
      isLandOpen: function () { return landOpen; },
      isOpenAny: function () { return modalCount() > 0; },
      onPlay: function (fn) { if (typeof fn === 'function') { playCbs.push(fn); } }
    };
  }

  CRZ.Menu = {
    create: create, STR: STR,
    logic: { diffLine: diffLine, readBest: readBest, recordOver: recordOver, readSound: readSound, writeSound: writeSound, hasContinue: hasContinue, saveDay: saveDay, resetSession: function () { sessionFlag = false; } },
    keys: { save: KEY_SAVE, best: KEY_BEST, sound: KEY_SOUND, session: KEY_SESSION, land: KEY_LAND }
  };
})(typeof window !== 'undefined' ? window : globalThis);
