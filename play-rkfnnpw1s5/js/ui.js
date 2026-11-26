/* Cruzamento: HUD em DOM e entrada de toque. Dono: agente UI.
 * CRZ.UI.create({root, game, render, audio}) -> {update(dt), destroy()}. */
(function (root) {
  'use strict';
  var CRZ = root.CRZ = root.CRZ || {};

  // todo texto visivel fica aqui
  var STR = {
    again: 'Play again',
    // pular a carta e a acao secundaria (antes 'Continue' parecia o proximo passo e descartava a carta)
    skip: 'Skip reward',
    // resumo sem cartas: o unico botao so avanca (antes dizia "Skip reward" sem recompensa nenhuma)
    cont: 'Continue',
    cars: 'cars',
    carsScore: function (n) { return 'cars · day score ' + n; },
    win: 'You made it',
    lose: 'Game over',
    // vocabulario fixo: "ring" = qualquer anel, "busy crossing" = anel ambar (0,3-0,6),
    // "red ring" = anel vermelho (acima de 0,6), "locked" = travou
    lockedSay: 'This crossing jammed: 1 strike.',
    // v2x: a regra numa linha, com o limite da dificuldade em jogo (CFG.maxStrikes: Easy 4, Normal 4)
    lockedFirst: function (n) { return 'This crossing jammed: 1 strike. ' + n + ' in a chapter: replay it.'; },
    // w_one: com o numero de ruas quando o cruzamento tem 3 ou mais ('the 4-road crossing with a Stop jammed')
    loseCause: function (d, sign, roads) { var c = roads >= 3 ? 'the ' + roads + '-road crossing' : 'the crossing'; return 'Day ' + d + ': ' + (sign ? c + ' with a ' + sign : (roads >= 3 ? 'the ' + roads + '-road crossing with no sign' : 'a crossing with no sign')) + ' jammed.'; },
    loseNext: {
      sign: function (a) { return 'Next time, try a ' + a + ' there.'; },
      swap: function (to) { return 'Next time, a ' + to + ' there moves more cars.'; },
      lane: 'Next time, give its busiest road a second lane.',
      road: 'Next time, build a road around it to spread cars.',
      boost: 'Next time, Boost it before the red ring fills.',
      card: 'Next time, tap its ring and compare.'
    },
    // blind3 4: o delta so quando e ganho ('(+11)'); dia pior que ontem: so o numero de ontem
    yesterday: function (prev, delta) { return 'Yesterday ' + prev + (delta > 0 ? ' (+' + delta + ')' : ''); },
    cardToday: function (name) { return name + ' today'; },
    info: {
      strikes: function (s, m) { if (CRZ.CFG && CRZ.CFG.ironMode) return CRZ.dayText('One strike for the whole game. From day {strikeDay}, the first jam ends it.'); return CRZ.dayText('Strikes this chapter: ' + s + ' of ' + m + '. From day {strikeDay}, a jam adds one.'); },
      days: function (d, m) { var L = (CRZ.CFG && CRZ.CFG.chapterDays) || m; return d >= m ? STR.lastDay(d, m) : 'Day ' + d + ' of ' + m + ', chapter ' + Math.ceil(d / L) + ' of ' + Math.ceil(m / L) + '.'; },
      budget: function (n, last) { return CRZ.dayText(n + (n === 1 ? ' build point' : ' build points') + (last ? '. Last day: spend them now.' : '. New every day; {carry} unused can stay for tomorrow.')); },
      tipsLast: function (n, per) { return STR.tipsLast(n, per); },
      // a barra mede carros entregues (1 por carro a 1x, mais a 2x e 4x), somados de um dia para o outro
      tips: function (n, per) { return 'Delivery bonus: ' + n + ' of ' + per + '. Full bar: +' + BONUS_SCORE() + ' score.'; },
      // toque perto das bolinhas do Boost (ao lado do Play): curto, sem parecer recusa do Play (passeio da testadora)
      boost: function (n) { return 'Boost: tap a road end for an extra car, or a busy crossing.'; }
    },
    roadFrom: 'Start a road from a crossing or a road end.',
    roadFromEnd: 'Drag from a road end.',
    // rotulos curtos do HUD (dono, 2026-11-09: 'nao assuma que o jogador sabe nada'): cada marcador diz o que e
    lblDay: function (d, m) { return 'Day ' + d + ' of ' + m; },
    // v2 capitulos: a linha extra do letreiro do dia no primeiro dia de cada capitulo, e o momento de fim de capitulo
    chapterN: function (c) { return 'Chapter ' + c; },
    chapterDone: function (c) { return 'Chapter ' + c + ' complete'; },
    // w_chap: strikes USADOS no capitulo (antes 'left'): o numero que o cartao do comeco prometeu
    chapterLine: function (cars, left, max) { var u = Math.max(0, max - left); return u + ' of ' + max + (max === 1 ? ' strike used' : ' strikes used') + ' \u00b7 ' + cars + (cars === 1 ? ' car' : ' cars'); },
    // w_chap: o comeco do capitulo (cartao das manhas 11 e 21) e o rotulo do HUD. O nome diz a fase da cidade
    chapterName: ['Small town', 'Growing city', 'Full city'],
    chTitle: function (c) { var n = STR.chapterName[c - 1]; return 'Chapter ' + c + (n ? ': ' + n : ''); },
    chDays: function (a, b) { return 'The row of dots at the top is days ' + a + ' to ' + b + '.'; },
    chSaved: 'Progress saved: if you run out of strikes, you come back to this morning.',
    chSavedFrom: function (d) { return 'Progress saved: from day ' + d + ', running out of strikes brings you back to this morning.'; },
    chNoRestart: 'This chapter never starts over: the last strike is forgiven.',
    chRetry: function (d) { return 'You are back at the morning of day ' + d + ', city as it was.'; },
    // w_place: o Pare passa a engasgar em cruzamento cheio (CFG.junction.stop.late.fromDay); o cartao do capitulo diz uma vez
    chStopLate: function (d) { return 'From day ' + d + ', a stop is slow where 3 or more roads are busy.'; },
    // w_price: a linha dos precos novos no cartao do capitulo (so as pecas que ja apareceram e cujo preco subiu)
    chPrice: { light: function (n) { return 'Lights now cost ' + n + '.'; }, round: function (n) { return 'Roundabouts cost ' + n + '.'; } },
    chNewLead: 'New: ', chCars: 'more cars', chWait: 'drivers wait less',
    // w_fix8: o teto de lugares (CFG.trafficBalance.places.max) que sobe de um capitulo para o outro
    chPlaces: function (n) { return 'more places to drive to (up to ' + n + ')'; },
    lblChapter: function (c, n) { return 'Chapter ' + c + ' of ' + n; },
    chapterStop: 'A good place to stop: your game is saved.',
    // v2 strikes (D9): dias livres, perdao, volta ao capitulo, vitoria com voltas
    freeJamFirst: 'No strike this time. From day {strikeDay} it counts.',
    strikesFrom: function (n) { return 'From today, a jam is a strike. ' + n + ' in a chapter: replay it.'; },
    strikesBack: function (n) { return 'New chapter: ' + n + ' strikes again.'; },
    forgiven: {
      chapter1: 'Last strike forgiven: chapter 1 never starts over.',
      early: function (d) { return 'Last strike forgiven: no restart before day ' + d + '.'; }
    },
    loseChapter: function (d) { return 'City jammed on day ' + d; },
    // w_chap: diz onde o capitulo comecou (quem nunca leu a palavra entende para onde volta)
    retryLine: function (d, c) { return (c > 0 ? 'Chapter ' + c + ' began on day ' + d + '. Retry goes back to that morning, city as it was.' : 'Retry: back to the morning of day ' + d + ', city as it was.'); },
    retryBtn: function (c) { return 'Retry chapter ' + c; },
    winRetries: function (n) { return 'Finished with ' + n + (n === 1 ? ' chapter retry' : ' chapter retries'); },
    lblStrikes: 'Strikes', lblDie: 'Dice', lblBp: 'Build points',
    // blind3 3: a face do dado e o efeito em palavras ('Today: 11 · normal day'); nunca um numero solto
    // nv10 1: amanha sem o numero (a rolagem de amanha sempre dava esse numero: virava teatro); so o efeito
    lblTomorrow: function (id) { return 'Tomorrow: ' + STR.dayWord(STR.dieShort[id] || 'normal'); },
    dieNotRolled: 'not rolled yet. Tap to roll.',
    dayWord: function (w) { return w === 'normal' ? 'normal day' : w; },
    // sob o dado: o tipo do dia em palavra comum; sob o numero tracejado: 'Tomorrow' (parecia o preco do relance)
    lblToday: function (id, kind, v) { return 'Today: ' + (v != null ? v + ' \u00b7 ' : '') + STR.dayWord(STR.dieShort[id] || ({ bad: 'bad', good: 'good', great: 'great', jackpot: 'jackpot' }[kind] || 'normal')); },
    // o efeito do dado em 2 ou 3 palavras (rotulos do topo)
    dieShort: { rush: 'more cars', rain: 'slower cars', festival: 'festival', plain: 'normal', luck1: '+1 point', luck2: '+2 points',
                luck3: '+3 points', free: 'free build', calm: 'fewer cars', jackpot: '+5 points',
                busy: 'busy', quiet: 'quiet', patient: 'patient', lucky: '+2 points', loan: 'loan', biggame: 'big game' },
    // dado v2 (2026-11-16): o topo depois da escolha. Passou ou guardou: dado neutro, dia normal
    lblPassed: 'Today: normal day', lblKept: function (name) { return 'Kept: ' + name; },
    // primeiro gasto da partida (uma vez): o que aconteceu com os pontos
    firstSpend: function (n, last) { return CRZ.dayText('You spent ' + n + (n === 1 ? ' build point' : ' build points') + (last ? '.' : '. You get new build points every day. Up to {carry} unused ones stay for tomorrow.')); },
    lblPts: function (n) { return n + (n === 1 ? ' build point' : ' build points'); },
    // dia 1: proximo passo fixo depois da primeira rua (sem pontos ou 6 s parada); some so com o Play
    nextPlay: 'Good. Now tap \u25b6\ufe0e to send the cars.',
    nextOut: 'Out of build points. Tap \u25b6\ufe0e to start the day.',
    nextShort: 'Not enough points to build more. Tap \u25b6\ufe0e to start the day.',
    nextNew: 'Give each NEW crossing a sign, then tap \u25b6\ufe0e.',
    roadTile: 'Road',
    // w_tiles: nome curto em todo ladrilho, no molde do 'Road 2' (cabe a 375 px com ate 7 ladrilhos; medido em
    // dev/review/w_tiles). O nome inteiro fica no aria, na linha de uso e no guia (STR.tools)
    tileName: { road: 'Road', stop: 'Stop', yield: 'Yield', light: 'Light', upgrade: 'Lanes', cross: 'Walk', round: 'Round', oneway: 'One-way' },
    roadFirstTut: 'Build one road first: tap Road, then drag from a road end.',
    roadFirst: 'Build one road first.',
    carryAsk: function (b, cap) { return 'You have ' + b + ' build points. Only ' + cap + ' are kept. Tap \u25b6\ufe0e again to start.'; },
    dieFirst: 'Tap the dice to see today\'s effect.',
    speedFirst: 'This button now sets speed (1\u00d7, 2\u00d7, 4\u00d7). Faster = more bonus score, but drivers wait less.',
    toolUse: function (id) {
      var n = STR.tools[id] || id;
      if (id === 'upgrade' || id === 'oneway') return 'Pick ' + n + ', then tap a road.';
      if (id === 'cross') return 'Pick ' + n + ', then tap a crossing.';
      if (id === 'light') return 'Pick ' + n + ', then tap the busiest crossing.';   // w_light: o pulso marca o mais cheio de ontem
      return 'Pick ' + n + ', then tap a crossing that has no sign.';
    },
    nextFirst: 'Pick Road, drag from a road end, then tap \u25b6\ufe0e.',
    pickAgain: 'Tap again to pick it.',
    cStart: 'Start day', cBack: 'Back to building',
    cWhyNew: function (n) { return n === 1 ? '1 new crossing has no sign.' : n + ' new crossings have no sign.'; },
    cWhyFree: 'You still have a free road today.',
    cWhyCarry: function (b, cap) { return 'You have ' + b + ' build points. ' + (b - cap) + ' will be lost. You can keep ' + cap + ' for tomorrow.'; },
    cSpend: 'Spend them', cAnyway: 'Start anyway',
    undid: function (lbl, back) { return 'Undid' + (lbl ? ': ' + lbl : '') + (back > 0 ? ' (+' + back + (back === 1 ? ' point)' : ' points)') : '') + '.'; },
    boostWhen: 'Boost works while the day runs.',
    boostNothing: 'Nothing to boost here yet.', boostAllCalm: 'All calm. Nothing needs a boost.',
    // v2y: toque tardio no lugar do chip que saiu; sem cargas (uma vez por partida, com a regra real)
    boostSaved: 'It cleared up. Boost saved.',
    boostOut: function (n, last) { return last ? 'No Boosts left.' : 'No Boosts left. You get ' + n + ' again tomorrow.'; },
    freeRoadNow: 'Your next road costs nothing.',
    // nv10 3: rerrolar devolve o bonus do dado de hoje (pontos ou a obra gratis); o botao diz isso
    rerollLbl: function (c, loses) { return 'Reroll: ' + c + (c === 1 ? ' point' : ' points') + (loses ? " (today's bonus is replaced)" : ''); },
    rerollAria: function (c, loses) { return 'Reroll today\'s roll for ' + c + (c === 1 ? ' build point' : ' build points') + (loses ? ". Today's bonus is replaced by the new roll." : ''); },
    // nv10 4: na propria tela do resultado, com o Reroll ao lado
    rollBad: function (c) { return 'Bad roll? Tap Reroll for a new one (' + c + (c === 1 ? ' point' : ' points') + ').'; },
    // nv10 2: na tela 'Tap to roll' do primeiro dia do dado de 20 faces, antes de rolar
    rollBig: function (f) { return 'New dice today: 1 to ' + f + '.'; },
    // hipercasual (dono): uma frase, uma vez, sem meta nem contador
    runHint: 'Tap a road end to send an extra car. Boosts recharge.',
    extraCar: '+1 extra car',
    dragFurther: 'Drag farther to build.',
    tryNormal: 'Try Normal',
    // dicionario de botoes (testadora 2026-11-09): uma frase por ferramenta
    toolUseLine: {
      road: 'Drag from a circled road end or a crossing to build a road.',
      // v2m: uma linha por peca: onde ela e boa e onde ela atrapalha (o territorio de cada uma)
      stop: 'Cars take turns. Good on 3 quiet roads, slow when busy.',
      yield: 'Busy road never stops. Best: one busy road, quiet side street.',
      light: 'Best on busy crossings, most with one busy road. Quiet streets wait.',
      upgrade: 'Best on a Stop with one long line: both lanes go at once.',
      cross: 'Drivers wait longer before the ring turns red. Replaces the sign.',
      round: 'Cars go around. Best on 4+ roads, weak on 3, can fill up.',
      oneway: 'Tap a road: cars drive away from the half you tap.'
    },
    toolWorks: {
      road: 'Joins a road end or a crossing to a new spot. Undo gives the points back.',
      stop: 'Goes on a crossing with 3 or more roads. Replaces the sign there.',
      yield: 'Goes on a crossing with 3 or more roads. Replaces the sign there.',
      light: 'Goes on a crossing with 3 or more roads. Replaces the sign there.',
      upgrade: 'Works on any road. Put it on the road with the long line.',
      cross: 'Goes where 2 or more roads meet. Replaces the sign there.',
      round: 'Goes on a crossing with 4 or more roads. Replaces the sign there.',
      oneway: 'Tap the arrow to flip it (free), again for two-way. A car with no route waits, then counts as lost.'
    },
    // w_tiles: o que a ferramenta e, em poucas palavras (ladrilho bloqueado: nome + isto + quando chega)
    toolWhat: {
      road: 'joins two spots.', stop: 'cars take turns.', yield: 'the main road keeps going.',
      light: 'for crossings busy from every side.', upgrade: 'a longer line fits.', cross: 'rings turn red later.',
      round: 'cars go around without stopping.', oneway: 'cars go one way only.'
    },
    legend: function (name, cost, line) { return name + ' \u00b7 ' + (cost <= 0 ? 'free' : cost + (cost === 1 ? ' point' : ' points')) + ' \u00b7 ' + line; },
    guideTitle: 'Tools & buttons', guideOpen: 'Tools and buttons', guideClose: 'Close',
    guideTools: 'Tools', guideMap: 'On the map',
    guideMapRows: [
      ['car', 'Small blue squares', 'Cars. Each one drives to another road end.'],
      ['arrows', 'Arrows on a road', 'The way cars go on that road.'],
      ['end', 'Circled dot', 'A road end: cars come in and leave here.'],
      ['cross', 'Dot where roads meet', 'A crossing. Signs go here.'],
      ['boost', 'Green ring', 'A boost is working here right now.']
    ],
    toolWorksLightEarly: 'Goes on a crossing with 3 or more roads. Replaces the sign there.', guideMore: 'More tools arrive as you play.', guideButtons: 'Buttons', guideMarks: 'Colors and marks', guideCards: 'Reward cards',
    guideBtnRows: [
      ['@play', 'Play / speed', 'Starts the day. While it runs, tap for 1\u00d7, 2\u00d7 or 4\u00d7. Faster = more bonus score, but drivers wait less.'],
      ['\u275a\u275a', 'Pause', 'Stops the day for a moment. Tap again to go on.'],
      ['\u21b6', 'Undo', 'Takes back your last build and gives the points back.'],
      ['@fit', 'Whole map', 'Shows the whole city.'],
      ['@bolt', 'Boost', 'Recharges in the first days; {charges} a day after that. Sends an extra car from a road end, or clears a busy crossing. A chip appears by a rising amber ring.'],
      ['\u2680', 'Dice', 'Today\'s roll. From day {offerDay} you choose: use it, or pass for a normal day.'],
      ['\u2630\ufe0e', 'Menu', 'How to play, sound, this guide and a new game.']
    ],
    guideMarkRows: [
      ['amber', 'Amber ring', 'A busy crossing: cars are waiting in line.'],
      ['red', 'Red ring', 'About to jam. From day {strikeDay}, a jam is a strike.'],
      ['hot', 'Gray dashed ring', 'Yesterday\'s trouble spot.'],
      ['new', 'NEW', 'Roads just met here. Give it a sign.'],
      ['days', 'Day dots', 'The red dot is today. {chapterLen} days a chapter, {days} in all.'],
      ['strikes', 'Strike circles', 'From day {strikeDay} a jam fills one. All full: you replay the chapter. They refill each chapter.'],
      ['points', 'Build points', 'Spend them on roads and signs. Up to {carry} unused ones stay for tomorrow.']
    ],
    // resumo enxuto (testadora 2026-11-09)
    infoQueue: 'How close a crossing came to jamming today. A full bar is a jam.',
    infoBonus: 'Every car delivered fills this bar; 2\u00d7 and 4\u00d7 fill it faster. Full bar: +' + BONUS_SCORE() + ' score.',
    bvalPlus: function (n) { return '+' + n + ' score'; },
    todoNew: function (n) { return 'To do before tomorrow: ' + n + (n === 1 ? ' new crossing needs a sign \u203a' : ' new crossings need a sign \u203a'); },
    todoBusy: 'Busiest crossing today \u203a',
    todoBusyWhy: 'This crossing got too busy. Tomorrow, boost it early.',
    peekBack: 'The summary comes right back.',
    boosted: 'Boosted!',
    boostedSend: 'Boosted! An extra car is on its way.',
    boostedJFirst: 'Boosted: cars here move faster for a few seconds.',
    // B: anel ambar e aneis agrupados
    ringGroup: function (n) { return (n === 2 ? 'Two' : String(n)) + ' busy crossings are close together.'; },
    // D/L: primeiro cruzamento novo e a regra do dia 4
    newJFirst: 'NEW: roads just met here. Give this crossing a sign before you start.',
    newJRule: 'From day {newjDay}, a crossing without a sign gets much slower.',
    day4Rule: 'From today, a crossing with no sign gets slow. Give each NEW crossing a sign.',
    // w_guide: quem ja terminou o capitulo 1 num aparelho com Guidance On ve isto uma vez por partida, no dia 1
    guideHint: 'Played before? Turn Guidance off in the menu.', guideOffBtn: 'Turn off', guideOffAria: 'Turn Guidance off',
    guideOffDone: 'Guidance off. Turn it on again in the menu.',
    boostsFixed: 'From today: {charges} boosts a day.',
    // v2: cidade no teto (CFG.growth.afterCap): uma ponta passa a mandar e receber mais carros
    shiftUp: 'The city changed: more cars use this road end now.',
    // w_place: lugares novos (CFG.trafficBalance.places) na manha em que aparecem: onde e por que
    placesNew: function (n) { return n === 1 ? 'A quiet road got a road end: cars start and end here.' : n + ' quiet roads got a road end each: cars start and end here.'; },
    // v2: arquetipo (CFG.archetypes), uma linha no primeiro plano da partida
    archLine: {
      river: 'River town: roads cross the water only at a bridge.',
      park: 'Park town: nothing is built in the park. Its gap is busy.'
    },
    // v2: manutencao do semaforo (CFG.upkeep). Linha da manha e, na primeira vez, a regra
    upkeepLine: function (paid, dark) { return 'Lights: -' + paid + ' today' + (dark > 0 ? '. ' + dark + (dark === 1 ? ' light is' : ' lights are') + ' off: not enough points.' : '.'); },
    // v2: Road crew (CFG.crew): a oferta da manha, o retorno e o chip das equipes
    // w_crew: o negocio inteiro numa linha, com o total (days ja vem cortado no fim da partida: game.crewInfo)
    crewOffer: function (cost, per, days) { return 'Road crew: pay ' + cost + ' now, get +' + per + ' every morning for ' + days + (days === 1 ? ' day' : ' days') + ' (' + per * days + ' in all).'; },
    // depois do Not now: quando a oferta pode voltar (dia do CFG.crew.gapDays) ou que foi a ultima
    crewLater: function (d) { return 'OK. The road crew comes back on day ' + d + ' at the earliest.'; },
    crewLast: 'OK. That was the last road crew offer.',
    crewFirst: 'New: spend today, earn later.',
    crewHire: 'Hire', crewNo: 'Not now',
    crewHired: function (days) { return CRZ.dayText('Crew hired: +{crewPer} every morning, starting tomorrow, for ' + days + (days === 1 ? ' day.' : ' days.')); },
    crewLine: function (n) { return 'Crew: +' + n + ' today.'; },
    crewChip: function (n, left) { return (n === 1 ? 'Crew' : n + ' crews') + ': ' + left + (left === 1 ? ' day left' : ' days left'); },
    // v2m: a vaga de semaforos (CFG.lightCap): no guia, no ladrilho ('1 of 2') e na recusa
    guideCap: function (n, more) { return 'Your city powers ' + n + (n === 1 ? ' light' : ' lights') + (more === false ? ' now.' : ' now, more later.') + ' Moving one is free.'; },
    capTile: function (used, cap) { return used + ' of ' + cap; },
    // semaforo, Stop, Yield e Two lanes na mao (mover e de graca)
    lightMoveAsk: 'Tap the light you want to move here.',
    // w_where: a escolha entre cruzamentos (game.lightMoveFor): o semaforo que sai sem perda, pelo 'e se' dos dois cruzamentos
    lightMoveFrom: function (t) { return 'Tap the pulsing light to move it here. A ' + t + ' does better there.'; },
    // h: o sinal que estava no anel e foi para a mao (nome), ou nada
    lightMovedPut: function (t, h) {
      if (!h) return 'Light moved. Free. Put a ' + t + ' where it was.';
      return h === t ? 'Light moved. Put your ' + t + ' where it was: it is in your hand.' : 'Light moved. Put a ' + t + ' where it was. Your ' + h + ' is in your hand.';
    },
    whereAm: 'All lights in use. One would help more at the pulsing ring. Tap it.',
    lightPicked: 'Light picked up. Tap a crossing to place it. Free.',
    lightMoved: 'Light moved. Free.',
    lightToHand: 'The light is in your hand: pick Light and tap a crossing. Free.',
    lightTapMove: 'To move this light, pick Light and tap it. Free.',
    stopPicked: 'Stop picked up. Tap a crossing to place it. Free.',
    stopMoved: 'Stop placed from your hand. Free.',   // w_bugs15: said when a piece from the hand goes on a crossing (it was not moved)
    stopToHand: 'The stop is in your hand: pick Stop and tap a crossing. Free.',
    stopTapMove: 'To move this stop, pick Stop and tap it. Free.',
    yieldPicked: 'Yield picked up. Tap a crossing to place it. Free.',
    yieldMoved: 'Yield placed from your hand. Free.',
    yieldToHand: 'The yield is in your hand: pick Yield and tap a crossing. Free.',
    yieldTapMove: 'To move this yield, pick Yield and tap it. Free.',
    upgradePicked: 'Two lanes picked up. Tap a road to place it. Free.',
    upgradeMoved: 'Two lanes moved. Free.',
    movePlaced: function (id) {
      if (id === 'upgrade') return 'Not enough points. Tap a two-lane road to move it. Free.';
      return 'Not enough points. Tap a placed ' + (TL[id] || lc(STR.tools[id] || id)) + ' to move it. Free.';
    },
    guideUpkeep: function (d, per) { return 'From day ' + d + ': ' + per + (per === 1 ? ' build point' : ' build points') + ' every morning. Removing it is free.'; },
    upkeepFirst: function (per, notToday) { return (notToday ? 'Each light costs ' : 'From today, each light costs ') + per + (per === 1 ? ' build point' : ' build points') + ' every morning. Removing one is free.'; },
    resumedDay: 'Resumed from the start of the day.',
    welcomeBuilt: function (d) { return 'Welcome back. Day ' + d + ': you already built today. Tap \u25b6\ufe0e to start the day.'; },
    welcomePoints: function (d, n) { return 'Welcome back. Day ' + d + ': you have ' + n + (n === 1 ? ' build point' : ' build points') + ' to spend.'; },
    welcomeOut: function (d) { return 'Welcome back. Day ' + d + ': out of build points. Tap \u25b6\ufe0e to start the day.'; },
    welcomeShort: function (d) { return 'Welcome back. Day ' + d + ': not enough points to build more. Tap \u25b6\ufe0e to start the day.'; },
    welcomeFreeRoad: function (d) { return 'Welcome back. Day ' + d + ': you still have a free road today.'; },
    welcomeFreeLight: function (d) { return 'Welcome back. Day ' + d + ': you still have a free traffic light today.'; },
    welcomeHand: function (d) { return 'Welcome back. Day ' + d + ': you have a piece in your hand to place.'; },
    cWhyFreeLight: 'You still have a free traffic light today.',
    newJChipSay: 'Each NEW crossing needs a sign.',
    // F: faixa de pedestre sobre um sinal
    crossOver: function (c) { return 'Crosswalk, ' + c + (c === 1 ? ' build point' : ' build points') + ': replaces the sign. Rings turn red later.'; },
    // G: pares de semaforo
    pairFail: 'Pick a light on the same road.',
    // I: retorno ao por um sinal
    placed: function (name) { return name + ' placed here.'; },
    // mao unica (2026-11-18): o custo aparece uma vez, ao por; virar e de graca e diz isso
    owPlaced: function (c) { return 'One-way: ' + (c > 0 ? c + (c === 1 ? ' point' : ' points') : 'free') + '. Tap the arrow to flip it.'; },
    owFlipped: 'Flipped, free. Tap again for two-way.',
    owOff: function (back) { return 'Two-way again' + (back > 0 ? ' (+' + back + (back === 1 ? ' point)' : ' points)') : '') + '.'; },
    // J: pontos que sobram
    carryOver: function (n) { return 'Saved for tomorrow: ' + n; },
    // w_plus2: pontos acima do teto, uma vez por capitulo no resumo
    // w_bugs13: a reward or die face that adds build points when the player already has more than they can keep (carry cap) or spend
    pointsWaste: 'You already have more than you can keep.',
    carryLost: function (n, cap) { return n + (n === 1 ? ' unspent point lost. ' : ' unspent points lost. ') + 'You keep at most ' + cap + '.'; },
    // K: dia 3 a 4x
    day3Fast: 'Day 3 runs at 4\u00d7. Faster = more bonus score, but drivers wait less.',
    sentOther: 'That end was full: the extra car left from the next road end.',
    // um termo so para o raio: boost (definido aqui, na primeira vez que o dia roda)
    boostFirst: 'Boost: tap a road end to send an extra car.',
    panLocked: 'Use two fingers to move the map.',
    nextDone: function (d) { return 'Done building? Tap \u25b6\ufe0e to start Day ' + d + '.'; },
    // integracao: a faixa de duas linhas cobria a ponta de baixo da cidade (print do dono, dia 3): a mesma frase curta
    nextDoneShort: function (d) { return 'Tap \u25b6\ufe0e to start Day ' + d + '.'; },
    // dia 2 com pontos para outra rua: as duas saidas (ritmo, 2026-11-16)
    nextMore: function (d) { return 'Build another road, or tap \u25b6\ufe0e to start Day ' + d + '.'; },
    // arrasto que comecou perto de um ponto mas fora dele (o mapa so andava, sem aviso)
    roadFromDot: 'Start the drag right on a road end or crossing.',
    // rua que passa rente a uma ponta sem ligar nela
    notLinked: 'Not connected: the road only passes by. Drag onto the road end to connect.',
    // dicas neutras do fantasma (rua ok): corte no maximo e cruzamento que a obra vai abrir
    ghostCapped: 'Longest road allowed: lift your finger to build',
    ghostCross: 'Crosses a road: makes a crossing',
    ghostCrossN: function (n) { return 'Crosses ' + n + ' roads: makes ' + n + ' crossings'; },
    // rotulos do cartao do resumo
    sumQueue: 'Closest to a jam',
    sumBonus: 'Delivery bonus',
    sumStrikes: 'Strikes',
    // folha do dado: o icone tracejado ao lado do dado
    dieNextWhat: '',
    // v2x (playtest cego 5): 'no cars use it' contradizia 'Cars enter at road ends'. Carros nascem so nas pontas da cidade
    deadEnd: "Dead end: only the city's road ends send cars. Link it to a road.",
    deadEndTap: "Dead end: only the city's road ends send cars. Link it to a road.",
    // vitoria contada com dados reais da partida
    winFlawless: 'Flawless: no strikes',
    winOne: function (d) { return 'Made it with 1 strike'; },
    winMany: function (n) { return 'Made it with ' + n + ' strikes'; },
    bestDay: function (n, d) { return 'Best day: ' + n + ' cars (day ' + d + ')'; },
    toughDay: function (d) { return 'Toughest day: day ' + d; },
    lastDay: function (d, m) { return 'Day ' + d + ' of ' + m + ': last day'; },
    tipFullLast: 'Bonus full',
    tipsLast: function (n, per) { return 'Delivery bonus: ' + n + ' of ' + per + '.'; },
    loseSub1: 'Day ',
    loseSub2: '. Try a different plan.',
    statDays: 'Days',
    statCars: 'Cars',
    statStrikes: 'Strikes',
    dayN: 'Day ',
    finalDay: 'Last day',
    play: 'Start day',
    undo: 'Undo',
    newGame: 'New game',
    confirmNew: 'Tap again to start a new game',
    dayRunning: 'Day in progress',
    speedLabel: 'Speed',
    ffChip: 'Skip ahead',
    ffLabel: 'Skip ahead (fast forward)',
    ffOn: 'fast forward',
    ffSlowed: 'Slowed down: a crossing is getting busy.',
    tipNext: 'Bonus full',
    speedBonusYes: 'Delivery bonus: +',
    speedBonusTail: ' score',
    speedBonusNone: 'Delivery bonus: ',
    speedBonusToward: ' toward +' + BONUS_SCORE() + ' score',
    speedBonusHow: 'Every car delivered fills it; 2\u00d7 and 4\u00d7 fill it faster.',
    bonusParts: function (cars, speed, prev) {
      return ' (' + cars + (cars === 1 ? ' car' : ' cars') + (speed > 0 ? ' + ' + speed + ' speed bonus' : '') + (prev > 0 ? ' + ' + prev + ' saved' : '') + ')';
    },
    // a barra verde sob os pontos durante o dia: rotulo (antes ninguem sabia o que era)
    tipLbl: 'Delivery bonus',
    boost: 'Boost',
    boostAria: 'Boost: tap a road end to send a car, or a ring to clear it',
    boostLeft: 'left',
    // camera: botao de enquadrar (alterna cidade inteira / zoom confortavel) e dica de arrastar
    fitAll: 'Show the whole city',
    fitClose: 'Zoom back in',
    // dias 1 a 3 um dedo nao arrasta o mapa: a dica aponta o botao de enquadrar
    panHint: 'Part of the map is off screen. Tap the corners button to see it all.',
    // cartas do resumo: nome curto, UMA linha do que muda, e "Good if" (os numeros espelham game.js: 1.3, 1.1, +2)
    cardsTitle: 'Pick one reward for tomorrow',
    cardSuggest: 'Good pick',
    cards: { plus2: '+2 build points', freeRoad: 'Free road', freeLight: 'Free traffic light', patient: 'Patient drivers', waveBonus: 'Double green waves', smooth: 'Faster cars',
             round: 'Roundabout', freePower: 'Free power' },
    cardLine: {
      plus2: 'Start tomorrow with 2 extra build points.',
      freeRoad: 'Your first new road tomorrow costs nothing.',
      freeLight: 'Your first traffic light tomorrow costs nothing.',
      patient: 'Drivers wait {patientPct}% longer before the ring turns red.',
      waveBonus: 'Green waves are worth double tomorrow.',
      smooth: 'All cars drive 10% faster tomorrow.',
      round: 'New tool: cars go around without stopping, until packed.',
      // integracao: v2m trocou a manutencao pela vaga de semaforos (CFG.lightCap); a carta soma uma vaga
      freePower: 'Your city powers one more traffic light.'
    },
    cardGood: {
      plus2: 'Good if you have a lot to fix.',
      freeRoad: 'Good if you want to grow the city.',
      freeLight: 'Good if one crossing is very busy.',
      patient: 'Good if you saw rings today.',
      waveBonus: 'Good if you have paired lights.',
      smooth: 'Good if lines were long today.',
      round: 'Good with many four-way crossings.',
      freePower: 'Good if all your lights are in use.'
    },
    // quando a condicao do "Good if" nao vale hoje: diz isso, sem recomendar
    cardGoodNo: {
      patient: 'No rings today, so this may not help.',
      waveBonus: 'Needs two paired traffic lights.',
      freeLight: 'Traffic lights come later.'
    },
    // por que a ferramenta nao entrou (reason do game) e o que ajuda num ponto com fila
    deny: {
      // a fila de uma ponta espera no cruzamento a frente: a recusa aponta e pulsa esse cruzamento
      portal: 'Road ends can\'t take a Stop, Yield or light. Use the pulsing crossing ahead.',
      portalNoLane: 'Road ends can\'t take a Stop, Yield or light. Use the pulsing crossing ahead.',
      // a recusa sempre diz o proximo passo (dono no iPhone, 2026-11-09: travou no dia 1 com 0 pontos)
      budget: 'Not enough build points. Tap \u25b6\ufe0e to start the day: you get more every day.',
      budgetCost: function (c, have) { return 'Not enough build points. This costs ' + c + ', you have ' + have + '. Tap \u25b6\ufe0e to start the day.'; },
      locked: function (d) { return 'Unlocks on day ' + d + '.'; },
      phase: 'Build before the day starts. Wait for the next morning.',
      same: 'This spot already has that tool. Pick another crossing.',
      sameTool: function (name) { return 'Already a ' + name + ' here. Pick another crossing.'; },
      sameLanes: 'This road already has two lanes. Tap another road.',
      cap: function (n) { return (n === 1 ? 'Your 1 light is' : 'All ' + n + ' lights are') + ' in use. Tap a crossing to move one there. Free.'; },
      notJunction: 'Tap a crossing, where roads meet.',
      // sem cruzamento a frente para pulsar (antes pulsava o no do meio da rua, que nao e ponta nem cruzamento)
      portalNone: 'Road ends can\'t take a Stop, Yield or light. Pick a crossing with three or more roads.',
      // game: 'notjunction' (curva, reta ou beco)
      notjunction: 'Stops, yields and lights need a crossing: three or more roads meeting.',
      notjunctionCross: 'A crosswalk needs a road passing through this crossing.',
      edge: 'Tap right on a road.',
      notlight: 'Tap a traffic light.',
      // Boost numa ponta cuja rua esta na fila do cruzamento a frente
      portalQueue: 'The line is at the pulsing crossing. Boost that crossing.',
      // Boost recusado pelo game: sem fila no no, dia pausado, ainda bloqueado
      boostCalm: 'Nothing to boost here yet. Try a crossing with a red ring.',
      boostPhase: 'Boost works while cars are moving. Tap \u25b6\ufe0e first.',
      boostLocked: function (d) { return 'Boost unlocks on day ' + d + '.'; },
      other: 'Can\'t build there: this spot doesn\'t take that tool.',
      boostNone: 'No Boosts left today. You get more tomorrow.',
      boostNoneLast: 'No Boosts left.',
      // ponta sem lugar para mais um carro agora (game.useClear 'space')
      boostSpace: 'No room right now. Try another road end.',
      boostWhere: 'Boost works on a road end or a busy crossing.',
      // cruzamento sem fila (estresse < BOOST_MIN): a UI recusa antes do game e a carga fica
      boostCalmJ: 'This crossing is fine now. Save your boost.',
      // cruzamento com Boost ainda correndo: o segundo nao soma (sim: o restante e max, nao soma)
      boostRunning: 'Boost is already working here. Try another crossing.',
      // v2 recusa: toda recusa diz o motivo e o que serve (REFUSALS.md)
      tileRun: 'Tools work before the day starts. Wait for the next morning.',
      tapNone: function (tool) { return 'Nothing placed. Tap a crossing to place the ' + tool + '.'; },
      tapMoving: 'The map was moving. Tap again.',
      // w_tiles: com a ferramenta, diz o que ela e e quando chega (a Roundabout chega pela escolha do dia 19)
      tileLocked: function (d, id, cfg) {
        var t = id && cfg && cfg.tools && cfg.tools[id], what = id && STR.toolWhat && STR.toolWhat[id];
        if (!t || !what) return 'Unlocks on day ' + d + '. Use what you have for now.';
        return STR.tools[id] + ': ' + what + (t.choiceDay ? ' A choice on day ' + t.choiceDay + '.' : ' Unlocks on day ' + t.unlockDay + '.');
      },
      emptyTap: 'Tap a crossing, where roads meet.',
      emptyRoad: 'Tap right on a road.',
      undoNone: 'Nothing to undo yet. Undo reverses your last build today.',
      undoRun: 'Undo works before the day starts.',
      rerollRun: 'Reroll only before the day starts. Tap the dice next morning.',
      rerollPoints: function (c, h) { return 'Rerolling costs ' + c + (c === 1 ? ' build point' : ' build points') + '. You have ' + h + '. Finish a day to earn more.'; },
      rerollOther: 'No reroll right now. Use the roll, or pass for a normal day.',
      dieChoice: 'That choice is not open now. Tap Use, or Pass for a normal day.',
      cardFail: 'That card is not available. Pick another one.',
      ffNo: 'Speed-up works while the day runs. Tap \u25b6\ufe0e first.',
      crewShort: function (c, h) { return 'Road crew costs ' + c + ' build points. You have ' + h + '. Earn more, then hire.'; },
      crewOther: 'No road crew on offer this morning. Build with your points.',
      generic: 'Can\'t do that now. Try a crossing or road end.'
    },
    jam: {
      endLane: 'Red ring at a road end: give its road a second lane.',
      endRoad: 'Red ring at a road end: build a new road so cars spread out.',
      junction: function (a, b) { return 'Red ring at a crossing: try a ' + a + (b ? ' or a ' + b : '') + '.'; },
      swap: function (from, to) { return 'Red ring at this ' + from + ': a ' + to + ' moves more cars.'; },
      lane: 'Red ring here: give its busiest road a second lane.',
      roadNew: 'Red ring on this road: build another road so cars spread out.',
      boost: 'Red ring at a crossing: Boost it while the day runs.',
      summary: 'Worst spot today. ',
      dashed: 'Tomorrow it has a dashed ring. ',
      // com o mundo: a rua certa sai destacada no mapa (render.highlightRoad), sem ponto cardeal no texto
      // (2026-11-09: 'the east road' pedia bussola num mapa sem norte). O argumento dir fica por compatibilidade
      laneDir: function () { return 'Red ring here: give its busiest road a second lane.'; },
      endLaneDir: function () { return 'Red ring at a road end: give its busiest road a second lane.'; },
      junctionAlt: function (a) { return 'Red ring at a crossing: a ' + a + ' here may help.'; },
      boostAgain: 'Still a red ring here: Boost it early while the day runs.',
      spread: 'Still a red ring here: build a road around it to spread cars.',
      // a mesma dica 2 dias seguidos no mesmo no: no terceiro, outra coisa
      laneAlt: 'Red ring here: try Two lanes on its busiest road.',
      // sinal de dia anterior (sem troca): o que ainda ajuda sem perder os pontos dele
      keepLane: function (t) { return 'Red ring at this ' + t + ': try Two lanes on its busiest road.'; },
      keepBoost: function (t) { return 'Red ring at this ' + t + ': Boost it early while the day runs.'; },
      keepPair: function (t) { return 'Red ring at this ' + t + ': pair it with a nearby light.'; },
      // v2m: a peca de ontem nao serve para este cruzamento: diz o problema que se ve e a peca que serve
      lightWaste: function (to) { return 'This light gives green to empty streets. A ' + to + ' fits here.'; },
      roundPacked: 'This roundabout is packed. A traffic light fits here.',
      roundT: 'A roundabout jams with only three roads. A ' + 'yield fits here.',
      stopMain: 'Every car stops on the main road. A yield fits here.',
      yieldEven: function (to) { return 'Side roads wait too long at this yield. A ' + to + ' fits here.'; },
      stopBusy: function (to) { return 'Too busy from every side for a stop. A ' + to + ' fits here.'; },
      lightFull: function (n) { return 'Busy from every side, but all ' + n + ' lights are in use. Move one.'; },
      // v2x: o conselho que sai do 'e se' (game.adviceFor: o dia de ontem jogado de novo com cada peca)
      wiSwap: function (from, to) { return 'Red ring at this ' + from + ': a ' + to + ' cuts the wait here.'; },
      wiNew: function (to) { return 'Red ring at a crossing: a ' + to + ' cuts the wait here.'; },
      wiMain: ' The lit road is the main road.',
      wiBest: 'This crossing is doing its best. Try a new road nearby.',
      wiStale: 'New road here since yesterday. After today, tap it to compare pieces.',
      // w_fix8: com o cartao da escolha (replay de ontem) para o no, nenhuma dica recomenda peca: so aponta para ele
      compare: 'Tap it to compare.',
      unlocksTomorrow: function (name) { return ' New tool tomorrow: ' + name + '.'; },
      dirs: { n: 'north', s: 'south', e: 'east', w: 'west' }
    },
    // dica de anel com ferramenta de rua na mao: o toque no anel nao constroi
    ringEdgeTool: 'That ring is a hint. Tap the road itself.',
    ringEdgeLane: function () { return 'That ring is a hint. Tap its busiest road to widen it.'; },
    paired: 'Lights paired: cars get green after green.',
    // v2: carta de escolha do dia 19 (CFG.choiceCard): titulo do resumo nesse dia
    cardsTitleChoice: 'Pick one for the rest of the game',
    // parear com intencao: chip ao lado do semaforo tocado; depois do chip, o toque no outro semaforo pareia
    pairChip: 'Pair lights',
    pairChipAria: 'Pair this traffic light with another one',
    pairPick: 'Now tap another traffic light to pair with.',
    pairReplace: 'Replace pair? Tap again.',
    pairSame: 'These two lights are already paired. Pick a different light.',
    pairNotLight: 'Pick another traffic light to pair with.',
    pairCancel: 'Pairing canceled.',
    // troca de sinal: pedido expirou (nada mudou) e troca feita com o sinal gratis
    swapCancel: 'Swap canceled.',
    swapCancelFree: 'Swap canceled. Your free light is still there.',
    // botao discreto ao lado da faixa do pedido de troca (o pedido fica aberto ate outro toque)
    swapCancelBtn: 'Cancel',
    swapCancelAria: 'Cancel the swap',
    // fim de partida: penultimo strike, ultimo dia (chip e faixa) e linha de fechamento do resumo do dia 12
    strikeWarn: 'One more strike and this chapter starts over.',
    lastChip: 'Last day',
    // sem repetir os numeros que o fim ja mostra logo abaixo (dias, carros)
    closing: function (d) { return 'Last day done: your city kept moving for all ' + d + ' days.'; },
    // dia 12 que travou: a partida acaba ali (regra de todo dia: o travamento encerra o dia) e vale a vitoria com
    // strikes sobrando; a frase de cima ('kept moving') mentiria
    closingJam: 'The last day ended in a jam, but you still had strikes left.',
    tomorrowLast: 'Tomorrow is the last day.',
    // dia 1: arrasto sem ferramenta que comecou no meio de uma rua (nada acontecia)
    roadPickFirst: 'To build, pick Road, then drag from a road end.',
    // fantasma: a ponta solta nao vai virar portal (teto de portais do jogador)
    ghostDeadEnd: 'Dead end: no cars will come here',
    // ajudas do dia 4 em diante (RESULTS_HUMANS 2026-11-08): ensinam a acao, nao a fazem
    chipBoost: 'Boost',
    chipAria: 'Boost this crossing now',
    // troca de um sinal comprado em dia anterior (faixa, nao balao): pede o segundo toque
    // troca para baixo (perde valor): pede o segundo toque
    swapAsk: function (a, pts) { return "Tap again to swap. You lose the " + lc(a) + "'s " + pts + (pts === 1 ? ' build point.' : ' build points.'); },
    // troca feita: o que entrou, o que custou e o que se perdeu (lost = pontos do antigo, comprado em dia anterior)
    // free = a nova veio de graca (dado ou carta): diz "for free", nunca o preco cheio
    swapped: function (a, b, cost, lost, free) {
      return 'Replaced ' + lc(a) + ' with ' + lc(b) + (free ? ' for free' : (cost > 0 ? ': ' + cost + (cost === 1 ? ' build point' : ' build points') : '')) + '. ' +
        (lost > 0 ? 'You lose the ' + lc(a) + "'s " + lost + (lost === 1 ? ' build point.' : ' build points.') : 'Your ' + lc(a) + "'s build points came back.");
    },
    swapUndo: 'Undo',
    // toque num no com a Rua na mao: a rua sai por arrasto
    roadTapHint: 'Drag from a road end or crossing to build.',
    // w_bugs15: the Road tool is one road at a time; said once, the first time it lets go
    roadOne: 'Road built. Tap Road for another one.',
    // toque com lupa: cidade longe e dois alvos sob o dedo; o toque so aproxima (frase uma vez por partida)
    magZoom: 'Zoomed in. Tap again to pick.',
    swapUndoAria: 'Undo the swap',
    yieldBusy: function (a, b) { return 'Busy crossing: a ' + a + (b ? ' or a ' + b : '') + ' may clear more cars.'; },
    lostRow: function (n) { return 'Lost cars: ' + n; },
    lostWhy: 'A car with no route waits, then counts as lost.',
    newJ: function (n) { return (n === 1 ? 'New crossing' : 'New crossings') + ' without a sign: ' + n; },
    newJAria: function (n) { return (n === 1 ? 'New crossing' : 'New crossings') + ' without a sign: ' + n + '. Tap to show the first.'; },
    // plano: chip dos cruzamentos que nasceram nesta manha (crescimento ou rua cortada) e seguem sem sinal
    newJChip: function (n) { return n + (n === 1 ? ' new crossing' : ' new crossings'); },
    newJChipAria: function (n) { return n + (n === 1 ? ' new crossing' : ' new crossings') + ' without a sign. Tap to show it.'; },
    newJTip: 'New crossing. Give it a sign before the day starts.',
    daysLegend: 'Each square is a day: red = a strike day',
    // w_medals: marcas do fim (uma frase do que o jogador fez, que o jogo confere), recordes no aparelho e o porque da vitoria
    marks: {
      days: function (n) { return 'All ' + n + ' days'; }, noRetry: 'No chapter replayed', clean: 'A chapter with no strike',
      events: 'Every event prepared', kept: 'Kept a roll for later',
      // w_bugs15: 'ready' = what the event's note asked for: a second road out (game, school), two lanes on the detour (roadwork), or the Boost it named on the day
      chEvents: function (p, n) { return 'Ready for ' + p + ' of ' + n + (n === 1 ? ' event' : ' events'); }, chClean: 'No strike this chapter'
    },
    markOn: 'Done: ', markOff: 'Not yet: ',
    // w_chap: as marcas sao um registro, nao uma escolha: titulo com a conta e, ao toque, o que cada uma pede
    marksHead: function (n, m) { return 'Marks this match: ' + n + ' of ' + m; },
    chMarksHead: function (n, m) { return 'Marks this chapter: ' + n + ' of ' + m; },
    markHow: {
      days: function (n) { return 'Finish all ' + n + ' days.'; }, noRetry: 'Win without replaying a chapter.',
      clean: 'Get through a whole chapter with no strike.', events: 'Before each event, do what its note says.',
      kept: 'Keep a roll, then use it on a later day.', chEvents: 'Before each event, do what its note says.',
      chClean: 'Get through this chapter with no strike.'
    },
    nextCh: {
      lead: 'Next: ',
      evStart: function (n) { return 'Events begin, ' + n + ' this chapter.'; },
      evMore: function (n) { return 'More events, ' + n + ' this chapter.'; },
      keep: function (d) { return 'Day ' + d + ': keep a roll for later.'; },
      lights: function (d, n) { return 'Day ' + d + ': the city powers ' + n + ' lights.'; },
      crew: function (d) { return 'Day ' + d + ': a road crew offer.'; }
    },
    winWhy: function (t, signs) {
      var p = [];
      if (t.fixed > 0) p.push('fixed ' + t.fixed + (t.fixed === 1 ? ' trouble spot' : ' trouble spots'));
      // w_fix8: com eventos que passaram sem preparo, a conta diz 'P of N' (a marca 'Every event prepared' fica apagada)
      var evN = t.events | 0;
      if (t.prepared > 0) p.push('was ready for ' + t.prepared + (evN > t.prepared ? ' of ' + evN : '') + ((evN > t.prepared ? evN : t.prepared) === 1 ? ' event' : ' events'));
      if (p.length) return 'You ' + p.join(' and ') + '.';
      return signs > 0 ? 'Your ' + signs + (signs === 1 ? ' sign kept' : ' signs kept') + ' the cars moving.' : '';
    },
    recLead: 'New best: ',
    recCars: function (n, b) { return n + ' cars (was ' + b + ')'; },
    recRetries: function (n, b) { return n + (n === 1 ? ' retry' : ' retries') + ' (was ' + b + ')'; },
    recDay: function (b) { return ' \u00b7 New best (was ' + b + ')'; },
    daysAria: function (n, b) { return n + (n === 1 ? ' day played, ' : ' days played, ') + b + (b === 1 ? ' with a strike.' : ' with a strike.'); },
    more: 'more',
    playAsk: function (n) { return (n === 1 ? '1 new crossing has no sign.' : n + ' new crossings have no sign.') + ' Tap \u25b6\ufe0e again to start.'; },
    tools: { road: 'Road', stop: 'Stop', yield: 'Yield', light: 'Traffic light', upgrade: 'Two lanes',
             cross: 'Crosswalk', round: 'Roundabout', oneway: 'One-way' },
    events: { calm: 'Calm', plain: 'Normal', busy: 'Busy', rush: 'Rush', rain: 'Rain', festival: 'Festival' },
    // dado do dia: nome e descricao de reserva (a descricao e gerada do effect quando ele existe)
    // retorno da escolha (v2, 2026-11-16, v2/jogador.md secoes 2, 3 e 7): balao da corrida ate 6 palavras, faixa ate 8
    // w_choice: o cartao da escolha do sinal (toque num anel de manha). Cada numero vem do 'e se' (game.choiceFor); a linha
    // de consequencia tem no maximo 6 palavras (teste confere) e so sai quando a repeticao mostra o motivo
    choice: {
      title: function (w) { return 'Cars waited ' + w + ' s here yesterday.'; },
      titleRoad: function (w) { return 'Cars on the lit road waited ' + w + ' s here yesterday.'; },
      titleWait: 'Replaying yesterday here\u2026',
      // w_shape: a forma do cruzamento de ontem (a classe da matriz, CFG.signCard.shape), nas palavras das linhas das pecas
      // w_texts: the volume word counts cars per minute yesterday (CFG.signCard.shape lowMax / highMin) and says nothing about
      // waiting, so it can not contradict the wait or the ring on the same card ('quiet' beside 24 s and a red ring did)
      shape: function (h) {
        var r = h.roads + ' roads', few = h.vol === 'low';
        if (h.main) return r + (few ? ', few cars, most on one road.' : ', most cars on one road.');
        return r + ', ' + (few ? 'few cars.' : (h.vol === 'high' ? 'many cars.' : 'some cars.'));
      },
      help: 'Each row replays yesterday with that sign here. Tap one to place it.',
      leave: 'Leave it', leaveAria: 'Leave this crossing as it is',
      free: 'free', moveHere: 'move a light here: free', pts: function (c) { return c + (c === 1 ? ' point' : ' points'); },
      wait: function (a, b) { return a + ' s \u2192 ' + b + ' s'; }, one: function (a) { return a + ' s'; },
      // w_choice3: a linha diz uma palavra, nao segundos (a faixa em s nao se sustentou: medido em v2/_scripts/sinais/veredito.js).
      // Cortes em CFG.signCard.verdict (game.verdictFor). A linha 'this road 4 s . the other 12 s' saiu: a direcao acertava ~65%
      verdict: { better: 'better', same: 'about the same', worse: 'worse' },
      // w_verd: o veredito 'better' que a medida mostra que falha em dois casos (CFG.signCard.qualify; game.choiceFor row.qual)
      // a palavra fica 'better'; o recorte vai na linha de consequencia (a frase inteira nao cabe na linha do numero a 375 px)
      qual: { event: 'better on a day like yesterday', busy: 'better, but not on a busy day' },
      qualNote: { event: 'only on a day like yesterday', busy: 'but not on a busy day' },
      points: function (n) { return 'You have ' + n + (n === 1 ? ' point.' : ' points.'); },
      replaces: function (n, name) { return 'replaces your ' + name + ': ' + n + (n === 1 ? ' point' : ' points') + ' lost'; },
      pending: '\u2026', none: '', flat: 'no change here',
      placed: function (name) { return name + ' placed. Tomorrow you will see if it worked.'; },
      note: {
        jam: 'ends in a jam', lightsFull: 'all lights in use', weak3: function (n) { return 'weak with ' + n + ' roads'; }, lastLight: 'uses your last light',
        main: function (n) { return 'main road waits more'; },   // w_choice3: sem segundos na linha da peca
        side: function (n) { return 'side street waits more'; }, busy: 'fills up on busy days', varies: 'varies from day to day'
      },
      // w_pick: com duas ou mais linhas 'better', a etiqueta de uma (game.choiceFor tagRows) e quem paga em cada linha 'better'
      // (ate 5 palavras: a rua que mais espera com a peca, medida na repeticao)
      tag: { fastest: 'Fastest', cheapest: 'Cheapest', pick: 'Your pick' },
      // w_place: o cartao aberto pela peca da bandeja (a linha dela marcada), a mesma peca no proprio cruzamento, a peca que entra
      // direto (a repeticao a diz 'better') e o cruzamento novo, sem nada para comparar
      pickHelp: 'Your pick is marked. Tap it to place it, or pick another.',
      // w_bugs13: the marked row is the player's own pick, never advice: when the card says it is worse, the help line says so too
      pickWorse: 'Your pick looks worse. Tap it anyway, or pick another.',
      keepHelp: function (name) { return 'To move this ' + name + ', tap Leave it, then tap the ' + name + ' again.'; },
      placedBetter: function (name) { return name + ' placed: better here. Yesterday\'s cars would have waited less.'; },
      newCross: 'New crossing: no traffic to compare yet.',
      payer: { side: 'side street waits', main: 'main road waits', all: 'everyone waits a little' },
      // w_noopt: nenhuma peca 'better' (o cruzamento cheio): ate 2 linhas a mais, so as que o 'e se' diz 'better' (game.choiceFor extra)
      extra: { road: 'Road around it', feed: 'Fix the crossing that feeds it' },
      // w_texts: n = the crossings the road makes (the chip's count)
      extraNote: { road: function (t, n) { return n > 0 ? 'cars go around, adds ' + n + (n === 1 ? ' crossing' : ' crossings') : 'cars go around'; }, feed: function (t) { return 'a ' + t + ' there'; } },
      // w_noopt2: o cartao do vizinho aberto pela linha 'Fix the crossing that feeds it': o veredito das linhas e da espera DO VIZINHO e a peca
      // prometida ajuda o cruzamento de antes (medido em web/dev/review/w_noopt2/REPORT.md: ali ela sai 'better' em 12% e 'worse' em 72%). A linha
      // dela leva a etiqueta e a nota cinza, e nao leva o 'worse' em vermelho (so a palavra some; a barra e o numero de antes seguem)
      nextDoor: { tag: 'Next door', note: 'helps the crossing next door' },
      noOption: 'Too many cars for any piece. Boost it during the day.', noOptionNoBoost: 'Too many cars for any piece.',
      roadSug: 'Tap the dashed road to build it, or drag your own.',
      noData: 'Trouble here yesterday.',
      aria: function (name, price, nums, note) { return name + ', ' + price + '. ' + nums + (note ? '. ' + note : '') + '.'; }
    },
    fbk: {
      watchFirst: 'Watch this crossing today.',
      // w_choice: o vigiado que veio do cartao: o numero prometido ao lado do que aconteceu (s inteiros, como o cartao)
      // w_choice3: o dia seguinte fala a lingua do cartao (a palavra) e mostra os segundos de verdade (fatos, nao promessa)
      mine: {
        better: function (t, a, b) { return 'Your ' + t + ' here: better, as expected. ' + a + ' s \u2192 ' + b + ' s.'; },
        same: function (t, a, b) { return 'Your ' + t + ' here: about the same, as expected. ' + a + ' s \u2192 ' + b + ' s.'; },
        worse: function (t, a, b) { return 'Your ' + t + ' here: worse, as expected. ' + a + ' s \u2192 ' + b + ' s. Tap to try another.'; },
        noBetter: function (t, a, b) { return 'Your ' + t + ' here: no better than before. ' + a + ' s \u2192 ' + b + ' s. Tap to try another.'; },
        qualEvent: function (t, a, b) { return 'Your ' + t + ' here: better only on a day like yesterday. ' + a + ' s \u2192 ' + b + ' s.'; },
        qualBusy: function (t, a, b) { return 'Your ' + t + ' here: better on a quiet day only. ' + a + ' s \u2192 ' + b + ' s.'; },
        littleBetter: function (t, a, b) { return 'Your ' + t + ' here: a little better. ' + a + ' s \u2192 ' + b + ' s. Tap to try another.'; },
        worseThanBefore: function (t, a, b) { return 'Your ' + t + ' here: worse than before. ' + a + ' s \u2192 ' + b + ' s. Tap to try another.'; },
        betterThan: function (t, a, b) { return 'Your ' + t + ' here: better than expected. ' + a + ' s \u2192 ' + b + ' s.'; },
        noWorse: function (t, a, b) { return 'Your ' + t + ' here: no worse than expected. ' + a + ' s \u2192 ' + b + ' s.'; },
        worseThan: function (t, a, b) { return 'Your ' + t + ' here: worse than expected. ' + a + ' s \u2192 ' + b + ' s. Tap to try another.'; }
      },
      // w_choice2: a linha do dia seguinte de uma peca posta fora do cartao (sem promessa) e o motivo de ter saido da faixa
      // w_bugs13: a piece on a crossing that had no cars yesterday: how it did, nothing to compare with
      fresh: function (t, b) { return 'Your ' + t + ': wait ' + b + ' s.'; },
      placed: function (t, a, b) { return 'Your ' + t + ' here: ' + a + ' s \u2192 ' + b + ' s.'; },
      moreCars: function (n, y) { return 'More cars today: ' + n + ', yesterday ' + y + '.'; },
      fewerCars: function (n, y) { return 'Fewer cars today: ' + n + ', yesterday ' + y + '.'; },
      more: function (k) { return 'and ' + k + ' more: tap a crossing to see'; },
      // w_bugs13: the tap on 'Tap to try another.' is answered at once; the card itself opens when tomorrow's morning is quiet
      tryAsked: 'Tomorrow morning its card opens here. Pick another piece.',
      // nome curto da ferramenta no balao e na linha do resumo ('Traffic light' estourava as 6 palavras)
      tool: { stop: 'Stop', yield: 'Yield', light: 'Light', round: 'Roundabout', cross: 'Crosswalk', upgrade: 'Two lanes' },
      // w_noopt2: o nome das linhas a mais do cartao na linha do dia seguinte (fora de tool: o balao 'Your X work' so conhece pecas)
      extraTool: { road: 'road around it', feed: 'fix next door' },
      good: function (t) { return /\s/.test(t) ? 'Calm today. Your ' + t + ' work.' : 'Calm here today. Your ' + t + ' works.'; },
      bad: 'Busy again. Tap ⚡︎ to help.',
      // sem carga de Boost (ou Boost ainda bloqueado): o balao nao manda tocar no que nao funciona
      badNoBoost: 'Busy again here today.',
      // resumo: a espera mais longa de um carro parado na fila desse cruzamento, ontem e hoje (s de jogo)
      line: function (t, a, b) { return 'Your ' + t + ': wait ' + a + ' s → ' + b + ' s.'; },
      fixed: 'Fixed. No ring here today.',
      trouble: 'Trouble here yesterday. Tap it.',
      close: 'Close call here. Tap it.',
      // linha do porque: UMA causa do numero de hoje contra ontem, por prioridade (whyCause)
      why: {
        strike: 'A jam ended the day early.',
        fixedMore: 'More cars got through your fixed crossing.',
        fixedCalm: 'Your fixed crossing kept its line short.',
        dieMore: function (name) { return name + ' today: more cars came.'; },
        dieCalm: 'Calm day: fewer cars came.',
        dieRain: 'Rain today: cars drove slower.',
        shorter: 'Shorter day today: fewer cars.',
        // v2x: depois do dia 2 (o dobro de carros por segundo) e do comboio do dia 3 o dia normal tem menos carros
        afterRush: 'Yesterday was a rush; today was normal.',
        longer: 'Longer day today: more cars.',
        grew: 'The city grew: more cars came.'
      }
    },
    dieLabel: 'Daily dice',
    today: 'Today',
    tomorrow: 'Tomorrow',
    reroll: 'Reroll',
    close: 'Close',
    reasonDone: 'Already rerolled',
    reasonPoints: 'Not enough build points',
    reasonPhase: 'Only before the day starts',
    reasonOther: 'Can\'t reroll right now.',
    // por que a rua nao sai (motivo do Sim em world.canAddEdge / game.buildRoad)
    roadWhy: {
      short: 'Too short', long: 'Too far', range: 'Out of range', budget: 'Not enough build points', stub: 'Leaves a tiny piece',
      near: 'Too close to a crossing', blocked: 'Blocked by a road', angle: 'Too close to another road',
      linked: 'Already linked', phase: 'Only before the day starts', deadEnd: 'Dead end', other: "Can't build here",
      terrain: 'Not across the river or the park'
    },
    // a mesma recusa em linguagem simples, com o limite (faixa do topo ao soltar o dedo).
    // Sem jargao ("steps" saiu, WALKTHROUGH2): o limite e a marca vermelha que o fantasma desenha
    // na linha, a um comprimento maximo de rua da origem.
    roadSay: {
      short: 'Too short: drag a bit farther from the road end or crossing.',
      long: 'Too far for one road: it reaches only to the red mark. Build it as two roads.',
      range: 'Out of range. Drag toward the city, inside the build area.',
      near: 'Too close to a crossing. Start from the crossing itself.',
      stub: 'That would leave a tiny leftover piece of road. End on the road or drag farther.',
      blocked: 'A road is in the way: cross it straight on, or go around.',
      angle: 'Too close to another road. Drag at a wider angle.',
      linked: 'Already linked. Drag to a road end that is not linked yet.',
      // v2 (arquetipos): agua so na ponte marcada; parque nunca
      terrain: 'Roads cross the river only at a bridge mark, never the park. Drag another way.',
      other: "Can't build here: try another direction."
    },
    // folha do dado: o que o dado faz e a regra do relance, em uma linha cada
    // nv10 5: a jogadora rola (toque), o dado nunca rola sozinho; do dia 6 em diante vai de 1 a 20
    // dado v2: oferta com dois lados a partir do dia 7; Keep a partir do dia 15
    dieWhat: 'Each morning you tap the dice to roll it. From day {offerDay} a roll is an offer with a good side and a cost: use it, or pass for a normal day. From day {keepDay} you can keep one for a later morning.',
    // rolagem visivel (dono: 'o que nao se ve nao existe')
    rollTitle: "Today's roll", rollTut: 'Every day starts with a roll. Tap the dice.', rollTap: 'Tap to roll', rollAria: 'Roll the dice',
    rollContinue: 'Continue', rollTapSkip: 'Tap to skip',
    // dado v2: a oferta. Dois lados em duas linhas curtas (verde e vermelho), Use / Pass, Keep do dia 15 em diante
    rollUse: 'Use', rollPass: 'Pass', rollKeep: 'Keep',
    rollUseAria: function (name) { return 'Use ' + name; }, rollPassAria: 'Pass: a normal day', rollKeepAria: function (name) { return 'Keep ' + name + ' for a later morning'; },
    rollKeptBtn: function (name) { return 'Use kept: ' + name; },
    hintOffer: 'Use it, or pass for a normal day.',
    hintCost: 'Most rolls have a cost now.',
    hintKeep: 'Keep saves it for a later morning.',
    // w_bugs15: Keep puts the new face in the one pocket: the offer says what it throws away
    rollKeepReplaces: function (name) { return 'Keep: replaces your kept ' + name + '.'; },
    rollUsedNote: 'In use today.', rollPassedNote: 'Passed: a normal day.', rollKeptNote: 'Kept for a later morning.',
    loanPaid: function (n) { return 'Loan: -' + n + (n === 1 ? ' build point' : ' build points') + ' today.'; },
    forecast: function (label) { return 'Tomorrow: ' + label; },
    sidePts: function (n) { return (n > 0 ? '+' : '-') + Math.abs(n) + (Math.abs(n) === 1 ? ' build point' : ' build points'); },
    // w_texts: the percent is against a normal day (what Pass gives: same city, no roll), not against yesterday, and the text says so
    sideCars: function (pct, more) { return pct + '% ' + (more ? 'more' : 'fewer') + ' cars than normal'; },
    sidePatient: 'Drivers wait longer', sideDebt: function (n) { return '-' + n + (n === 1 ? ' build point' : ' build points') + ' tomorrow'; },
    sideFestival: 'Twice the cars on one road', sideEvent: "Tomorrow's event is bigger", sideFree: 'A free road',
    rollOfferLive: function (name, a, b) { return "Today's roll: " + name + '. ' + a + (b ? ', ' + b : '') + '. Use or pass.'; },
    grewEnds: function (n) { return 'The city grew: ' + n + (n === 1 ? ' new road end' : ' new road ends'); },
    grewRoads: function (n) { return 'The city grew: ' + n + (n === 1 ? ' new road' : ' new roads'); },
    rollNormal: 'Normal day: no change', rollFreeLight: 'a free traffic light',
    rollFx: { rush: 'more cars', festival: 'more cars', rain: 'slower cars', luck1: '+1 build point', luck2: '+2 build points',
              luck3: '+3 build points', free: 'a free road', calm: 'fewer cars, +1 build point', jackpot: '+5 build points, patient drivers' },
    rollLive: function (v, fx) { return "Today's roll: " + v + '. ' + fx + '.'; },
    dieOnce: 'You can reroll once a day, before you start the day.',
    // Rush sem pontos para o relance: informa, sem tom de erro (dia 2 com 1 ponto, passeio da testadora)
    dieRushShort: function (cost, have) { return 'Rush: more cars today. Rerolling costs ' + cost + (cost === 1 ? ' build point' : ' build points') + '. You have ' + have + '.'; },
    dice: {
      rush: { name: 'Rush hour', desc: 'About 50% to 70% more cars today.' },
      rain: { name: 'Rain', desc: 'Cars drive 20% slower.' },
      festival: { name: 'Festival', desc: 'About 50% more cars today.' },
      plain: { name: 'Normal day', desc: 'No change: usual traffic, no bonus.' },
      luck1: { name: 'Lucky day', desc: '+1 build point today.' },
      luck2: { name: 'Lucky day', desc: '+2 build points today.' },
      luck3: { name: 'Great day', desc: '+3 build points today.' },
      free: { name: 'Free build', desc: 'Your next road or light is free.' },
      calm: { name: 'Calm day', desc: 'Fewer cars and +1 build point today.' },
      jackpot: { name: 'Jackpot', desc: '+5 build points and patient drivers.' },
      busy: { name: 'Busy day', desc: 'More build points, more cars.' },
      quiet: { name: 'Quiet day', desc: 'Fewer cars, fewer build points.' },
      patient: { name: 'Patient drivers', desc: 'Drivers wait longer, for build points.' },
      lucky: { name: 'Lucky!', desc: '+2 build points today.' },
      loan: { name: 'Loan', desc: 'Build points now, fewer tomorrow.' },
      biggame: { name: 'Big game', desc: "Build points now; tomorrow's event is bigger." }
    }
  };
  if (CRZ.dayText) CRZ.dayText(STR);   // integracao v2: dias de regra nos textos ({strikeDay}, {offerDay}...) saem do CFG

  // v2: placar de uma barra cheia do Delivery bonus (CFG.deliveryBonus.scorePerBar)
  function BONUS_SCORE() { var D = CRZ.CFG && CRZ.CFG.deliveryBonus; return (D && D.scorePerBar) || 20; }
  function bonusScoreOf(sm) { return typeof sm.bonusScore === 'number' ? sm.bonusScore | 0 : (sm.speedBonus | 0) * BONUS_SCORE(); }
  function lc(s) { return String(s).charAt(0).toLowerCase() + String(s).slice(1); }
  // nomes de ferramenta em minuscula para o meio da frase ("a stop", "a traffic light")
  var TL = {};
  Object.keys(STR.tools).forEach(function (k) { TL[k] = STR.tools[k].charAt(0).toLowerCase() + STR.tools[k].slice(1); });

  function dieName(id) {
    var d = STR.dice[id];
    return d ? d.name : (STR.events[id] || '');
  }
  // dado v2: os dois lados de uma face em linhas curtas, lado bom (verde) primeiro e o custo (vermelho) depois.
  // Sem numero para somar: pontos e uma porcentagem de carros, no maximo duas linhas (texto de jogador.md)
  function dieSides(die) {
    var e = (die && die.effect) || {}, good = [], bad = [];
    function pct(m) { return Math.round(Math.abs(m - 1) * 100); }
    if (e.budget > 0) good.push(STR.sidePts(e.budget));
    if (typeof e.spawnMul === 'number' && e.spawnMul < 1) good.push(STR.sideCars(pct(e.spawnMul), false));
    if (typeof e.patienceMul === 'number' && e.patienceMul > 1) good.push(STR.sidePatient);
    if (e.free) good.push(STR.sideFree);
    if (e.budget < 0) bad.push(STR.sidePts(e.budget));
    if (typeof e.spawnMul === 'number' && e.spawnMul > 1) bad.push(STR.sideCars(pct(e.spawnMul), true));
    if (e.debt > 0) bad.push(STR.sideDebt(e.debt));
    if (e.festivalMul) bad.push(STR.sideFestival);
    if (e.eventMul) bad.push(STR.sideEvent);
    var out = [];
    if (good.length) out.push({ text: good[0], tone: 'green' });
    if (bad.length) out.push({ text: bad[0], tone: 'red' });
    return out;
  }
  // descricao a partir dos campos de effect (certa mesmo se o config mudar); STR.dice e o reserva
  function describeDie(die) {
    if (!die) return '';
    if (die.v === 2 && die.offer) return dieSides(die).map(function (x) { return x.text; }).join(', ') + '.';
    var e = die.effect, parts = [], p;
    function pct(m) { return Math.round(Math.abs(m - 1) * 100); }
    function pts(n) { return '+' + n + (n === 1 ? ' build point' : ' build points') + ' today.'; }
    if (e && typeof e === 'object') {
      if (typeof e.spawnMul === 'number' && e.spawnMul !== 1) {
        p = pct(e.spawnMul);
        parts.push('About ' + p + '% ' + (e.spawnMul > 1 ? 'more' : 'fewer') + ' cars today.');
      }
      if (typeof e.speedMul === 'number' && e.speedMul !== 1) {
        parts.push('Cars drive ' + pct(e.speedMul) + '% ' + (e.speedMul < 1 ? 'slower' : 'faster') + '.');
      }
      if (typeof e.budget === 'number' && e.budget > 0) parts.push(pts(e.budget));
      if (e.free) parts.push('Your next ' + (e.free === 'road' ? 'road' : (e.free === 'light' ? 'light' : 'road or light')) + ' is free.');
      if (typeof e.patienceMul === 'number' && e.patienceMul !== 1) {
        parts.push('Drivers are ' + pct(e.patienceMul) + '% ' + (e.patienceMul > 1 ? 'more' : 'less') + ' patient.');
      }
    }
    if (parts.length) return parts.join(' ');
    var d = STR.dice[die.id];
    return d ? d.desc : '';
  }
  // ferramenta liberada no dia `day` (le CFG; nao depende do state)
  // v2: a ferramenta existe nesta partida e esta liberada? matchHook (ligado pelo create a game.state.tools) diz false
  // para o que nao entra na partida (Crosswalk; One-way fora do arquetipo) e true para o que a carta do dia 19 liberou.
  // Sem hook (testes puros): a regra do dia, e nunca uma ferramenta cortada (removed)
  var matchHook = null;
  function toolOpen(cfg, id, day) {
    var t = cfg && cfg.tools && cfg.tools[id];
    if (!t || t.removed) return false;
    var h = matchHook ? matchHook(id) : undefined;
    if (h === false || h === true) return h;
    return day >= t.unlockDay;
  }
  // o que ajuda num ponto com fila: ponta de rua (portal) ou cruzamento, com ou sem sinal. day = dia em que
  // o jogador vai agir (no resumo, amanha). Puro: testado em test_ui.js.
  // world (opcional): com o mundo a dica diz qual rua e pula o que ja foi feito (jamPick). avoid = chave da
  // dica de ontem para o mesmo no (nunca repete dois dias seguidos). heat(o) opcional. Sem world: como antes.
  // (avoid fica na assinatura por compatibilidade e e ignorado: a dica nao depende mais da de ontem)
  function jamAdvice(n, day, cfg, world, avoid, heat) {
    var a = advise(n, day, cfg, world, heat);
    return a ? a.text : '';
  }
  // ---- recomendador unico por no (passeio humano 2026-11-09: o mesmo no recebia 'second lane' num dia,
  // 'roundabout' no outro e 'traffic light' no resumo). Usado pelo toque no anel, pelo resumo, pela dica do
  // Yield e pelo fim de jogo; o tutorial le CRZ.UI.advise. Ordem fixa, sem memoria de ontem: o mesmo estado
  // do no (ruas, sinal, faixas, ferramentas liberadas no dia) da sempre a mesma recomendacao.
  //  1) cruzamento de 4+ bracos e rotatoria liberada: rotatoria
  //  2) senao semaforo, se liberado
  //  3) T com rua principal dominante e Yield liberado: Yield
  //  4) Stop
  //  5) segunda faixa, se a rua mais cheia do no ainda tem 1 faixa e a ferramenta esta liberada
  // Sinal ja no no: so entra sinal melhor (SIGN_RANK maior). Ponta de rua e no de 2 ruas nao aceitam sinal
  // (o game recusa): vao direto ao 5). Nada serve: rua nova para espalhar (ponta, 2 ruas) ou Boost.
  // Devolve {key, tool, text, dir} ou null.
  // ctx (opcional): { budget } pontos da jogadora. Semaforo no no (passeio da testadora, 2026-11-09): trocar por
  // rotatoria perde os 4 pontos do semaforo, e a dica repetia isso dia apos dia. So recomenda a rotatoria com
  // 4+ bracos, rotatoria claramente melhor (roundBeats) e budget > custo da rotatoria + 2. Sem budget: nunca.
  var SIGN_RANK = { cross: 1, yield: 2, stop: 3, light: 4, round: 5 };
  // vocabulario do anel igual a cor do render: 0,3 a 0,6 ambar tracejado ('Busy crossing'), acima de 0,6
  // ou travado vermelho continuo ('Red ring'); sem nivel conhecido (teste puro, no calmo): 'Ring' generico
  var RING_BUSY = 0.3, RING_RED = 0.6;
  function ringLevel(n, heat) {
    if (!n) return 'ring';
    if (n.locked) return 'red';
    var v = heat ? +heat(n) || 0 : +n.stress || 0;
    // ponta de rua nunca trava (o sim limita a fila ali): nunca alarme vermelho, no maximo ambar
    if (isEnd(n)) return v >= RING_BUSY ? 'busy' : 'ring';
    return v > RING_RED ? 'red' : (v >= RING_BUSY ? 'busy' : 'ring');
  }
  // os textos de STR.jam estao escritos no nivel vermelho; aqui viram o nivel do no
  function ringText(text, lvl, isJ) {
    if (typeof text !== 'string') return text;
    // ponta de rua: nunca 'Red ring' (ela nao trava); sempre 'Busy road end'
    text = text.replace(/^Red ring at a road end: /, 'Busy road end: ');
    if (lvl === 'red') return text;
    if (lvl === 'busy') {
      return text.replace(/^Red ring at a crossing: /, 'Busy crossing: ')
        .replace(/^Red ring at this ([a-z ]+): /, 'Busy crossing with a $1: ')
        .replace(/^Red ring here: /, isJ ? 'Busy crossing: ' : 'Ring here: ')
        .replace(/^Still a red ring here: /, isJ ? 'Still a busy crossing: ' : 'Still a ring here: ')
        .replace(/Red ring/g, 'Ring').replace(/red ring/g, 'ring');
    }
    return text.replace(/Red ring/g, 'Ring').replace(/red ring/g, 'ring');
  }
  function labelAdvice(a, n, heat) {
    if (!a || !n) return a;
    var isJ = !isEnd(n) && (n.edges ? degOf(n) >= 3 : !n.portal);
    var t = ringText(a.text, ringLevel(n, heat), isJ);
    if (t === a.text) return a;
    var o = {}, k; for (k in a) if (a.hasOwnProperty(k)) o[k] = a[k];
    o.text = t; return o;
  }
  function advise(n, day, cfg, world, heat, ctx) {
    var a = adviseRaw(n, day, cfg, world, heat, ctx);
    // w_fix8: ctx.card = o no tem dados de replay no cartao da escolha: o cartao e quem compara as pecas, a dica so aponta
    // para ele (pecas: sinais, segunda faixa, semaforo a mover, par de semaforos; Boost e rua nova nao sao linhas do cartao)
    if (a && ctx && ctx.card && recommendsTool(a)) a = { key: 'card', tool: 'card', wi: true, text: STR.jam.compare };
    return labelAdvice(a, n, heat);
  }
  function recommendsTool(a) {
    return !!a && (a.key.indexOf('sign:') === 0 || a.key.indexOf('fit:') === 0 || a.key.indexOf('pair:') === 0 || a.key === 'full' || a.tool === 'upgrade');
  }
  function adviseRaw(n, day, cfg, world, heat, ctx) {
    if (!n) return null;
    var J = STR.jam, deg = degOf(n), end = isEnd(n), have = SIGN_RANK[n.tool] || 0, pick = null;
    // sem lista de ruas (registro do game, teste puro): no comum conta como cruzamento
    var junction = !end && (n.edges ? deg >= 3 : !n.portal);
    function better(id) { return toolOpen(cfg, id, day) && (SIGN_RANK[id] || 0) > have; }
    // rodada 3 (2026-11-09): sinal comprado em dia anterior nao tem reembolso; trocar perde os pontos dele.
    // Entao so ha troca com o no sem sinal ou com sinal posto hoje (ctx.fresh, o game devolve o custo).
    // Sem ctx: conta como comprado antes (resumo, tutorial e fim de jogo falam do dia seguinte)
    var fresh = !!(ctx && ctx.fresh);
    // v2x: com o 'e se' do dia (ctx.wi = game.adviceFor) a peca vem da medida, nunca do tipo: so uma peca que baixa a
    // espera mais longa (o numero do resumo) sem travar nem subir o anel; nada ganha: o cruzamento ja da o que pode
    var wi = ctx && ctx.wi;
    if (junction && wi && !fresh) {
      // w_pick: rua nova no cruzamento desde ontem: o dia de ontem nao diz qual peca serve hoje (nenhuma e mandada)
      if (!wi.tool && wi.stale) return { key: 'stale', tool: null, wi: true, text: J.wiStale };
      if (!wi.tool) return { key: 'best', tool: 'road', wi: true, text: J.wiBest };
      var me = wi.tool === 'yield' ? mainEdges(n, world) : null;
      return { key: 'sign:' + wi.tool, tool: wi.tool, wi: true, main: me,
               text: (n.tool && STR.tools[n.tool] ? J.wiSwap(TL[n.tool], TL[wi.tool]) : J.wiNew(TL[wi.tool])) + (me ? J.wiMain : '') };
    }
    if (junction && n.tool && !fresh) { var mf = misfit(n, day, cfg, world, ctx); return mf || keepSign(n, day, cfg, world, heat, ctx); }
    // v2m: a peca vem do jeito do cruzamento (fitSign), nao da ordem 'a mais forte que couber'. Troca no mesmo dia so
    // para uma peca que serve melhor (outra peca, nao necessariamente mais cara)
    if (junction) {
      var f = fitSign(n, day, cfg, world, ctx);
      // semaforo de hoje -> rotatoria so quando ela e claramente melhor (roundBeats: 4-5 ruas de uma faixa, sem par)
      if (f.tool && f.tool !== n.tool && !(n.tool === 'light' && f.tool === 'round' && !roundBeats(n, world))) pick = f.tool;
      else if (!n.tool && better('stop')) pick = 'stop';
      if (f.full && !pick) return { key: 'full', tool: 'light', text: J.lightFull(f.full) };
    }
    if (pick) return { key: 'sign:' + pick, tool: pick, text: n.tool && STR.tools[n.tool] ? J.swap(TL[n.tool], TL[pick]) : J.junction(TL[pick], '') };
    if (toolOpen(cfg, 'upgrade', day)) {
      var bl = busiestRoad(n, world, heat);
      if (bl ? (bl.edge.lanes || 1) < 2 : !world) {
        var dir = bl ? J.dirs[dirOf(n, bl.other)] : '';
        return { key: 'lane' + (bl ? ':' + bl.edge.id : ''), tool: 'upgrade', dir: dir, edge: bl ? bl.edge.id : null,
                 text: end ? (dir ? J.endLaneDir(dir) : J.endLane) : (dir ? J.laneDir(dir) : J.lane) };
      }
    }
    if (!junction) return { key: 'road', tool: 'road', text: end ? J.endRoad : J.roadNew };
    return { key: 'boost', tool: 'clear', text: n.tool ? J.boostAgain : J.boost };
  }
  // v2m: a peca que serve ao cruzamento, pelo tipo de ontem (ctx.kind = state.kinds[id], de Game.kindOf) e pela forma.
  //  main num T de rua reta -> Yield; heavy (todo lado, muito) -> semaforo se ha vaga (ctx.lightRoom), senao Roundabout
  //  com 4+ ruas ou Stop; even/calm/sem dado -> Roundabout com 4+ ruas (se liberada), senao Stop (Yield no T de rua
  //  reta sem dado). Devolve { tool, full } (full = vagas quando o semaforo serviria mas todas estao em uso).
  function fitSign(n, day, cfg, world, ctx) {
    var kd = ctx && ctx.kind, k = kd && kd.k, deg = degOf(n) || 3, tee = (deg === 3 || !n.edges) && mainRoad(n, world);
    var open = function (id) { return toolOpen(cfg, id, day); }, out = { tool: null, full: 0 };
    if (k === 'heavy') {
      if (open('light') && !(ctx && ctx.lightRoom === false)) { out.tool = 'light'; return out; }
      if (open('light') && ctx && ctx.lightCap) out.full = ctx.lightCap;
      out.tool = deg >= 4 && open('round') ? 'round' : (tee && open('yield') ? 'yield' : (open('stop') ? 'stop' : null));
      return out;
    }
    if (tee && open('yield') && (k === 'main' || !k)) { out.tool = 'yield'; return out; }
    if (deg >= 4 && open('round')) { out.tool = 'round'; return out; }
    out.tool = open('stop') ? 'stop' : (open('yield') ? 'yield' : null);
    return out;
  }
  // v2m: sinal de dia anterior que nao serve ao tipo do cruzamento (so com dado de ontem): diz o que se ve e a peca certa
  function misfit(n, day, cfg, world, ctx) {
    var kd = ctx && ctx.kind; if (!kd) return null;
    var J = STR.jam, f = fitSign(n, day, cfg, world, ctx), to = f.tool, t = n.tool;
    if (!to || to === t) return null;
    var text = null;
    if (t === 'light') text = J.lightWaste(TL[to]);
    else if (t === 'round') text = degOf(n) === 3 && to === 'yield' ? J.roundT : (to === 'light' ? J.roundPacked : null);
    else if (t === 'stop') text = to === 'yield' ? J.stopMain : (to === 'light' || to === 'round' ? J.stopBusy(TL[to]) : null);
    else if (t === 'yield') text = J.yieldEven(TL[to]);
    return text ? { key: 'fit:' + to, tool: to, text: text } : null;
  }
  // no com sinal de dia anterior: nada de troca. Ordem: segunda faixa na rua mais cheia (se liberada e de 1
  // faixa), Boost se ha carga (ctx.boost !== false), parear com um semaforo vizinho sem par (so semaforo).
  function keepSign(n, day, cfg, world, heat, ctx) {
    var J = STR.jam, light = n.tool === 'light', T = TL[n.tool] || n.tool;
    if (toolOpen(cfg, 'upgrade', day)) {
      var bl = busiestRoad(n, world, heat);
      if (bl ? (bl.edge.lanes || 1) < 2 : !world) {
        var dir = bl ? J.dirs[dirOf(n, bl.other)] : '';
        return { key: 'lane' + (bl ? ':' + bl.edge.id : ''), tool: 'upgrade', dir: dir, edge: bl ? bl.edge.id : null,
                 text: light ? J.keepLane(T) : (dir ? J.laneDir(dir) : J.lane) };
      }
    }
    var canBoost = !(ctx && ctx.boost === false);
    if (canBoost) return { key: 'boost', tool: 'clear', text: light ? J.keepBoost(T) : J.boostAgain };
    var mate = light ? pairMate(n, world) : null;
    if (mate) return { key: 'pair:' + mate.id, tool: 'light', text: J.keepPair(T) };
    return { key: 'boost', tool: 'clear', text: J.boostAgain };
  }
  // semaforo vizinho (uma rua de distancia) sem par, com o proprio no tambem sem par
  function pairMate(n, world) {
    var nodes = world && world.nodes, edges = world && world.edges, i, e, o;
    if (!n || !n.edges || !nodes || !edges || (n.pair !== null && n.pair !== undefined)) return null;
    for (i = 0; i < n.edges.length; i++) {
      e = edges[n.edges[i]]; o = e && nodes[e.a === n.id ? e.b : e.a];
      if (o && o.tool === 'light' && (o.pair === null || o.pair === undefined)) return o;
    }
    return null;
  }
  // rotatoria claramente melhor que o semaforo do no: o sim da 2 vagas no anel com 4+ entradas (parallelBig),
  // mas o semaforo serve cada faixa em paralelo e a onda verde do par soma. Claramente melhor = 4 ou 5 bracos
  // (com 6+ a penalidade por entrada extra come a vantagem), todas as ruas de 1 faixa e semaforo sem par.
  function roundBeats(n, world) {
    var deg = degOf(n), edges = world && world.edges, i, e;
    if (deg < 4 || deg > 5) return false;
    if (n.pair !== null && n.pair !== undefined) return false;
    for (i = 0; edges && i < n.edges.length; i++) { e = edges[n.edges[i]]; if (e && (e.lanes || 1) >= 2) return false; }
    return true;
  }
  // memoria curta por no (instancia da UI): a mesma dica no mesmo no por 2 dias seguidos; no terceiro, outra.
  // memo[id] = {key, start, last}. Mesmo dia: mesma dica (anel, resumo e Yield concordam). Puro sobre memo.
  function adviseVary(memo, n, a, day, cfg, world, heat) {
    if (!memo || !n || !a || n.id === undefined || a.wi) return a;   // v2x: o conselho medido nao gira
    var m = memo[n.id], d = day | 0;
    if (m && m.alt && m.last === d) return labelAdvice(m.alt, n, heat);
    // partida nova (dia voltou), outra dica ou um dia sem dica: recomeca
    if (!m || m.key !== a.key || m.last < d - 1 || d < m.last) { memo[n.id] = { key: a.key, start: d, last: d }; return a; }
    if (d > m.last) m.last = d;
    if (m.last - m.start < 2) return a;
    var J = STR.jam, alt = null;
    if (a.tool !== 'upgrade' && toolOpen(cfg, 'upgrade', day)) {
      var bl = busiestRoad(n, world, heat);
      if (bl ? (bl.edge.lanes || 1) < 2 : !world) alt = { key: 'lane' + (bl ? ':' + bl.edge.id : ''), tool: 'upgrade', edge: bl ? bl.edge.id : null, text: J.laneAlt };
    }
    if (!alt && a.tool !== 'clear' && !isEnd(n) && degOf(n) >= 2) alt = { key: 'boost', tool: 'clear', text: J.boostAgain };
    if (!alt) alt = { key: 'spread', tool: 'road', text: J.spread };
    // o dia seguinte recomeca a contagem com a dica de base (2 dias seguidos, no maximo)
    memo[n.id] = { key: 'alt:' + a.key, start: d, last: d, alt: alt };
    return labelAdvice(alt, n, heat);
  }
  // rua mais cheia do no (todas, com ou sem duas faixas): vizinho mais quente; ponta (de onde nascem carros)
  // ganha 0,5; empate: menor id de rua (determinista)
  function busiestRoad(n, world, heat) {
    var nodes = world && world.nodes, edges = world && world.edges, best = null, bs = -1, i, e, o, sc;
    if (!n || !n.edges || !nodes || !edges) return null;
    for (i = 0; i < n.edges.length; i++) {
      e = edges[n.edges[i]]; if (!e) continue;
      o = nodes[e.a === n.id ? e.b : e.a]; if (!o) continue;
      sc = (heat ? +heat(o) || 0 : (o.stress || 0)) + (o.portal ? 0.5 : 0);
      if (sc > bs + 1e-9 || (Math.abs(sc - bs) <= 1e-9 && best && e.id < best.edge.id)) { bs = sc; best = { edge: e, other: o }; }
    }
    return best;
  }
  // T com rua principal: duas das tres ruas quase em linha (ate 30 graus de desvio) e a terceira sem mais
  // faixas que elas. Sem geometria (mundo ausente ou rua sem ponta): conta como T comum com rua principal
  function mainRoad(n, world) {
    var nodes = world && world.nodes, edges = world && world.edges, L = [], i, e, o;
    if (!n || !n.edges || !nodes || !edges) return true;
    for (i = 0; i < n.edges.length; i++) {
      e = edges[n.edges[i]]; o = e && nodes[e.a === n.id ? e.b : e.a];
      if (!e || !o) return true;
      L.push({ a: Math.atan2(o.y - n.y, o.x - n.x), lanes: e.lanes || 1 });
    }
    if (L.length !== 3) return false;
    for (i = 0; i < 3; i++) {
      var p = L[i], q = L[(i + 1) % 3], side = L[(i + 2) % 3];
      var d = Math.abs(p.a - q.a); if (d > Math.PI) d = 2 * Math.PI - d;
      if (d >= Math.PI * 5 / 6 && side.lanes <= Math.min(p.lanes, q.lanes)) return true;
    }
    return false;
  }
  // v2x: as duas ruas da rua principal de um T (quase em linha), para o mapa acender o que o conselho do Yield chama de
  // 'main road'. null sem geometria ou sem rua principal
  function mainEdges(n, world) {
    var nodes = world && world.nodes, edges = world && world.edges, L = [], i, e, o;
    if (!n || !n.edges || !nodes || !edges || n.edges.length !== 3) return null;
    for (i = 0; i < 3; i++) {
      e = edges[n.edges[i]]; o = e && nodes[e.a === n.id ? e.b : e.a];
      if (!e || !o) return null;
      L.push({ id: e.id, a: Math.atan2(o.y - n.y, o.x - n.x), lanes: e.lanes || 1 });
    }
    for (i = 0; i < 3; i++) {
      var p = L[i], q = L[(i + 1) % 3], side = L[(i + 2) % 3];
      var d = Math.abs(p.a - q.a); if (d > Math.PI) d = 2 * Math.PI - d;
      if (d >= Math.PI * 5 / 6 && side.lanes <= Math.min(p.lanes, q.lanes)) return [p.id, q.id];
    }
    return null;
  }
  // direcao de uma rua a partir do no (tela: y cresce para baixo, entao y menor e norte)
  function dirOf(n, o) {
    var dx = o.x - n.x, dy = o.y - n.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'e' : 'w';
    return dy >= 0 ? 's' : 'n';
  }
  // rua mais cheia do no entre as de UMA faixa: a que vem de uma ponta (de onde nascem carros) ou do
  // vizinho mais quente. null quando todas ja tem duas faixas.
  function busiestLane(n, world, heat) {
    var nodes = world && world.nodes, edges = world && world.edges, best = null, bs = -1, i, e, o, sc;
    if (!n || !n.edges || !nodes || !edges) return null;
    for (i = 0; i < n.edges.length; i++) {
      e = edges[n.edges[i]]; if (!e || (e.lanes || 1) >= 2) continue;
      o = nodes[e.a === n.id ? e.b : e.a]; if (!o) continue;
      sc = (heat ? +heat(o) || 0 : (o.stress || 0)) + (o.portal ? 0.5 : 0);
      if (sc > bs) { bs = sc; best = { edge: e, other: o }; }
    }
    return best;
  }
  // o que ajuda num no com fila, em ordem de preferencia: {key, text, tool}. So o que esta liberado no dia
  // `day` e ainda nao foi feito (rua com duas faixas nao e sugerida de novo). Sempre 2+ opcoes.
  function jamOptions(n, day, cfg, world, heat) {
    var J = STR.jam, T = TL, out = [];
    var bl = toolOpen(cfg, 'upgrade', day) ? busiestLane(n, world, heat) : null;
    var lane = bl ? { key: 'lane:' + bl.edge.id, tool: 'upgrade', dir: J.dirs[dirOf(n, bl.other)], edge: bl.edge.id } : null;
    if (isEnd(n)) {
      if (lane) { lane.text = J.endLaneDir(lane.dir); out.push(lane); }
      out.push({ key: 'road', text: J.endRoad, tool: 'road' });
      return out;
    }
    if (degOf(n) < 3) {
      if (lane) { lane.text = J.laneDir(lane.dir); out.push(lane); }
      out.push({ key: 'road', text: J.roadNew, tool: 'road' });
      out.push({ key: 'boost', text: J.boostAgain, tool: 'clear' });
      return out;
    }
    if (!n.tool) {
      var opts = nichePrefs(n, day, cfg);
      if (!opts.length) opts = ['stop', 'light'].filter(function (id) { return toolOpen(cfg, id, day); });
      if (opts.length) out.push({ key: 'sign', text: J.junction(T[opts[0]], opts[1] ? T[opts[1]] : ''), tool: opts[0] });
    } else if ((n.tool === 'stop' || n.tool === 'yield' || n.tool === 'cross') && toolOpen(cfg, 'light', day)) {
      out.push({ key: 'swap', text: J.swap(T[n.tool], T.light), tool: 'light' });
    } else if (n.tool === 'light' && toolOpen(cfg, 'round', day) && degOf(n) >= 4) {
      out.push({ key: 'round', text: J.junctionAlt(T.round), tool: 'round' });
    }
    if (lane) { lane.text = J.laneDir(lane.dir); out.push(lane); }
    out.push({ key: 'boost', text: out.length ? J.boostAgain : J.boost, tool: 'clear' });
    out.push({ key: 'spread', text: J.spread, tool: 'road' });
    return out;
  }
  // a dica escolhida: a primeira opcao que nao repete a de ontem (avoid). summary = true: a dica vale
  // amanha; ferramenta que so libera amanha ganha o aviso (a jogadora ainda nao a viu)
  // jamPick: a recomendacao do advise (avoid ignorado: mesma dica para o mesmo estado, dia apos dia)
  // ctx = {budget} (ver advise); memo = memoria por no da UI (adviseVary)
  function jamPick(n, day, cfg, world, avoid, heat, summary, ctx, memo) {
    var pk = adviseVary(memo, n, advise(n, day, cfg, world, heat, ctx), day, cfg, world, heat);
    if (!pk) return null;
    var out = { key: pk.key, text: pk.text, tool: pk.tool, edge: pk.edge != null ? pk.edge : null };
    var t = summary && pk.tool && cfg && cfg.tools && cfg.tools[pk.tool];
    if (t && t.unlockDay === day && day > 1) out.text += STR.jam.unlocksTomorrow(STR.tools[pk.tool] || pk.tool);
    return out;
  }
  function degOf(n) { return n && n.edges ? n.edges.length : 0; }
  // ferramentas por nicho, em ordem: T (3 ruas) pede Yield ou Stop; 4+ ruas pede Roundabout ou Traffic light.
  // yielded = o no ja tem Yield e esta vermelho (cruzamento equilibrado): Stop ou Roundabout, 4+ ruas Roundabout ou luz.
  function nichePrefs(n, day, cfg, yielded) {
    var big = degOf(n) >= 4;
    var order = yielded ? (big ? ['round', 'light'] : ['stop', 'round']) : (big ? ['round', 'light'] : ['yield', 'stop']);
    return order.filter(function (id) { return toolOpen(cfg, id, day); });
  }
  // ponta de rua de verdade: portal com uma estrada so (sem lista de estradas conta como ponta)
  function isEnd(n) { return !!(n && n.portal && (!n.edges || n.edges.length < 2)); }
  // beco: no comum com uma estrada so (nenhum carro nasce nem termina ali)
  function isDeadEnd(n) { return !!(n && !n.portal && n.edges && n.edges.length === 1); }
  // cruzamento mais perto (em passos de estrada) a partir de uma ponta; prefere o que tem fila.
  // Busca em largura ate 6 passos; empate de distancia: o mais quente. Puro: testado em test_ui.js.
  function queueJunction(world, n, heat) {
    var nodes = world && world.nodes, edges = world && world.edges;
    if (!nodes || !edges || !n) return null;
    var seen = {}, frontier = [n], depth = 0, best = null, bestH = -1, firstJ = null, i, j, m, e, o, next, h;
    seen[n.id] = 1;
    while (frontier.length && depth < 6) {
      next = [];
      for (i = 0; i < frontier.length; i++) {
        m = frontier[i];
        for (j = 0; m.edges && j < m.edges.length; j++) {
          e = edges[m.edges[j]]; if (!e) continue;
          o = nodes[e.a === m.id ? e.b : e.a];
          if (!o || seen[o.id]) continue;
          seen[o.id] = 1; next.push(o);
          if (degOf(o) >= 3) {   // so cruzamento de verdade (o game recusa sinal em no de 2 estradas)
            h = heat ? heat(o) : (o.stress || 0);
            if (!firstJ) firstJ = o;
            if (h >= 0.35 && h > bestH) { bestH = h; best = o; }
          }
        }
      }
      if (best) return best;
      frontier = next; depth++;
    }
    // sem cruzamento a frente: nada para pulsar (o no do meio da rua nao aceita sinal)
    return firstJ || null;
  }
  // derrota: o que travou e o que tentar da proxima vez
  // a proxima tentativa sai do mesmo recomendador (advise) que o resumo e o anel usam, no dia seguinte
  function loseText(n, day, cfg, world, heat, ctx) {
    var T = TL, N = STR.loseNext;
    var cause = STR.loseCause(day | 0, n.tool ? T[n.tool] : '', n.edges && n.edges.length ? n.edges.length : 0);
    var a = advise(n, (day | 0) + 1, cfg, world, heat, ctx), next;
    if (a && a.key.indexOf('sign:') === 0) next = n.tool && STR.tools[n.tool] ? N.swap(T[a.tool]) : N.sign(T[a.tool]);
    else if (a && a.key === 'card') next = N.card;
    else if (a && a.tool === 'upgrade') next = N.lane;
    else if (a && a.tool === 'road') next = N.road;
    else next = N.boost;
    return cause + ' ' + next;
  }
  // no travado do dia: state.final.lock {nodeId, tool, x, y} (game), ou o primeiro no com locked no mundo
  function lockedNodeOf(s, world) {
    var nodes = world && world.nodes, f = s && s.final, sm = s && s.summary, id = null, obj = null, k;
    [f && f.lock, f && f.lockedNode, sm && sm.lock, sm && sm.lockedNode].forEach(function (v) {
      if (id !== null || v === undefined || v === null || v === true || v === false) return;
      if (typeof v === 'object') { obj = v; id = v.nodeId !== undefined ? v.nodeId : v.id; } else id = v;
    });
    if (id !== null && nodes && nodes[id]) return nodes[id];
    // no sumiu do mundo (save carregado): o registro do game basta para o texto e a posicao
    if (obj && isFinite(obj.x) && isFinite(obj.y)) return obj;
    if (!nodes) return null;
    for (k in nodes) if (nodes.hasOwnProperty(k) && nodes[k] && nodes[k].locked) return nodes[k];
    return null;
  }
  // no mais quente do dia (state.hot, o anel tracejado); null se nao houver
  function worstNode(s, world) {
    var h = (s && s.hot) || {}, nodes = world && world.nodes, b = null, bv = -1, k;
    if (!nodes) return null;
    for (k in h) if (h.hasOwnProperty(k) && nodes[k] && +h[k] > bv) { bv = +h[k]; b = nodes[k]; }
    return b;
  }
  // semaforos pareados no mapa (a carta da onda verde so serve com pelo menos um par)
  function pairCount(world) {
    var nodes = world && world.nodes, n = 0, k;
    if (!nodes) return 0;
    for (k in nodes) if (nodes.hasOwnProperty(k) && nodes[k] && nodes[k].tool === 'light' && nodes[k].pair !== null && nodes[k].pair !== undefined) n++;
    return n;
  }
  // carta recomendada do dia (uma so, ou nenhuma): fila alta pede calma; cruzamento quente pede semaforo
  // ctx (opcional) = {day, cfg, pairs}: nada de recomendar carta de ferramenta ainda nao liberada hoje
  // (o cartao dela nao foi visto) nem a onda verde sem semaforos pareados.
  // w_pick (dono: o selo decidia pela jogadora em ~8 de 10 dias): so no capitulo 1 (dia ate CFG.chapterDays, aprendizado);
  // do capitulo 2, nenhuma carta sugerida nem destacada: a jogadora escolhe
  function suggestCard(draft, peak, worst, ctx) {
    function hasC(id) { return draft && draft.indexOf(id) >= 0 && cardFits(id, peak, ctx); }
    if (!draft || !draft.length) return null;
    var CDs = ctx && ctx.cfg && ctx.cfg.chapterDays > 0 ? ctx.cfg.chapterDays : 0;
    if (CDs && (ctx.day | 0) > CDs) return null;
    if (peak >= 0.6 && hasC('patient')) return 'patient';
    if (peak >= 0.6 && worst && !isEnd(worst) && degOf(worst) >= 3 && !worst.tool && hasC('freeLight')) return 'freeLight';
    if (hasC('plus2')) return 'plus2';
    return null;
  }
  // a carta faz sentido para a jogadora agora? (sem ctx: sim, como antes)
  function cardFits(id, peak, ctx) {
    if (!ctx) return true;
    if (id === 'plus2' && ctx.pointsWaste) return false;   // w_bugs13: no 'Good pick' on points the player cannot keep
    if (id === 'patient') return peak >= RING_SEEN;
    // o dado de amanha ja da o semaforo de graca: a carta seria jogada fora (as duas gratuidades nao somam)
    // a carta vale AMANHA: o semaforo precisa existir amanha (no dia 4 a carta do dia 5 dizia 'come later')
    if (id === 'freeLight') return toolOpen(ctx.cfg, 'light', (ctx.day | 0) + 1) && !ctx.dieFreeLight;
    if (id === 'waveBonus') return (ctx.pairs | 0) > 0;
    return true;
  }
  // o dado de amanha (state.nextDie) da o semaforo gratis no dia `day`? (game.dieGrant: free 'light' so com
  // o semaforo liberado; antes disso vira rua gratis)
  function dieFreeLight(die, day, cfg) {
    var f = die && ((die.effect && die.effect.free) || die.free);
    return f === 'light' && toolOpen(cfg, 'light', day | 0);
  }
  // o que a face 'free' da no dia `day` (mesma regra do game.dieGrant): 'light' ou null (rua, o icone de sempre)
  function freeGrant(die, day) { return die && die.id === 'free' && dieFreeLight(die, day, CRZ.CFG) ? 'light' : null; }
  // texto curto para cada recusa do game (placeTool, upgradeRoad, setOneway)
  function denyText(r, tool, s, cfg, cost) {
    var D = STR.deny, why = r && r.reason, t = cfg && cfg.tools && cfg.tools[tool];
    if (why === 'portal') return toolOpen(cfg, 'upgrade', s.day) ? D.portal : D.portalNoLane;
    if (why === 'notjunction') return tool === 'cross' ? D.notjunctionCross : D.notjunction;
    if (why === 'edge') return D.edge;
    if (why === 'notlight') return D.notlight;
    if (why === 'budget') return typeof cost === 'number' && cost > 0 ? D.budgetCost(cost, s.budget | 0) : D.budget;
    if (why === 'locked') return t ? D.locked(t.unlockDay) : D.other;
    if (why === 'phase') return D.phase;
    if (why === 'same') return tool === 'upgrade' ? D.sameLanes : (STR.tools[tool] ? D.sameTool(TL[tool]) : D.same);
    if (why === 'node') return D.notJunction;
    if (why === 'cap') { var lc = s && s.tools ? s.tools.filter(function (x) { return x.id === 'light'; })[0] : null; return D.cap(lc && lc.cap != null ? lc.cap : 1); }
    return D.other;
  }
  // barra do resumo: pico do anel ate JAM_RING_BAR; dali ate cheia, o relogio da trava (1 = travou). Save antigo sem
  // lockNear: so o anel (nunca cheia sem jam)
  var JAM_RING_BAR = 0.8;
  function jamBar(sm) {
    if (!sm) return 0;
    var pk = Math.max(0, Math.min(1, +sm.peak || 0)), ln = Math.max(0, Math.min(1, +sm.lockNear || 0));
    if (sm.failed || ln >= 1) return 1;
    // w_risk: o anel cheio leva a barra so ate CFG.riskBar.ringMax; dali em diante e o relogio da trava (margem em segundos)
    return Math.max(pk * ((CRZ.CFG && CRZ.CFG.riskBar && CRZ.CFG.riskBar.ringMax) || 0.3), Math.min(0.99, ln));
  }
  function kindTone(kind) {
    return kind === 'bad' ? 'red' : ((kind === 'good' || kind === 'great' || kind === 'jackpot') ? 'green' : 'ink');
  }

  // cartas que sairam do jogo: seguem em STR so para o chip de um save antigo com a carta ativa
  var RETIRED = { smooth: 1, waveBonus: 1 };
  var SAVE_KEY = 'cruzamento.save';
  var HINT_KEY = 'cruzamento.hints';
  var NODE_TOOLS = { stop: 1, yield: 1, light: 1, round: 1, cross: 1 };
  var HAND_TOOLS = { light: 1, stop: 1, yield: 1, upgrade: 1 };
  function handStr(kind, tool) {
    if (tool === true) tool = 'light';
    return STR[tool + kind] || STR['light' + kind];
  }
  var HOT_TAP = 0.35;   // mesmo limiar do anel tracejado em render.js
  var JAM_SUMMARY = 0.5; // no resumo, so fala do pior ponto quando o anel ficou vermelho de verdade
  var RING_SEEN = 0.42;  // a jogadora viu um anel vermelho (render desenha acima de 0.35; tutorial avisa em 0.42)
  // ajudas (chip do Boost, dica do Yield, cruzamentos novos): so do dia 4 em diante (dias 1 a 3 tem tutorial)
  var ASSIST_DAY = 4;
  // histerese do chip do Boost (estresse do no). 0,6 chegava tarde: o no travava 4-5 s reais depois do anel.
  // Padrao; o perfil de dificuldade troca por CFG.difficulties[nome].assist.chipAt / chipOff (difficulty.js)
  var CHIP_ON = 0.45, CHIP_OFF = 0.3;
  // Boost em cruzamento abaixo disto e recusado pela UI (o chip some no mesmo limiar)
  var BOOST_MIN = 0.3;
  var CHIP_PX = 56, CHIP2_PX = 40;
  var CHIP_EVERY = 250;    // ms reais entre recalculos do no mais critico
  var CHIP_WIN = 2;        // s de jogo da janela da subida do estresse (desempate)
  var CHIP_TIE = 0.05;     // diferenca de estresse que conta como empate
  var NEWJ_KEY = 'gridlet.newJ';
  function isJunction(n) { return !!(n && n.edges && n.edges.length >= 3); }
  // no onde o Boost escoa a fila (game.useClear 'clear'): tudo menos ponta de uma rua so
  function boostable(n) { return !!(n && !n.locked && n.edges && n.edges.length >= 2); }
  // escolha pura do chip: o no mais perto de travar. Estresse mais alto primeiro; empate (diferenca < CHIP_TIE)
  // decide quem subiu mais rapido (rate(n) = subida nos ultimos 2 s). Quem ja tem chip fica ate cair abaixo de off.
  // Devolve { id, second }: second = outro no tambem acima de on (ou acima de off se ja era o segundo)
  function chipRank(world, cur, cur2, on, off, skip, rate) {
    var nodes = world && world.nodes, q, n, s, L = [];
    for (q in nodes) if (nodes.hasOwnProperty(q)) {
      n = nodes[q];
      if (!boostable(n) || (skip && skip(n))) continue;
      s = n.stress || 0;
      if (s >= on || ((n.id === cur || n.id === cur2) && s >= off)) L.push(n);
    }
    function r(x) { return rate ? (+rate(x) || 0) : 0; }
    L.sort(function (a, b) {
      var d = (b.stress || 0) - (a.stress || 0);
      if (Math.abs(d) >= CHIP_TIE) return d;
      return (r(b) - r(a)) || (a.id === cur ? -1 : b.id === cur ? 1 : 0) || (a.id - b.id);
    });
    return { id: L[0] ? L[0].id : null, second: L[1] ? L[1].id : null };
  }
  function chipPick(world, cur, on, off, skip, rate) { return chipRank(world, cur, null, on, off, skip, rate).id; }
  // centro do chip ao lado do no (px de tela): direita, esquerda, cima, baixo; sem cobrir o HUD nem sair da tela.
  // pref = lado usado no quadro anterior (o chip nao pula de lado a cada quadro)
  function chipPlace(p, W, H, rects, pref, px) {
    var R = (px || CHIP_PX) / 2, d = R + 22, i, k, side, x, y;
    var sides = ['r', 'l', 'u', 'd'], order = pref ? [pref].concat(sides.filter(function (s) { return s !== pref; })) : sides;
    function fits(cx, cy) {
      if (cx - R < 6 || cy - R < 6 || cx + R > W - 6 || cy + R > H - 6) return false;
      for (k = 0; k < rects.length; k++) {
        var r = rects[k];
        if (cx + R + 6 > r.l && cx - R - 6 < r.r && cy + R + 6 > r.t && cy - R - 6 < r.b) return false;
      }
      return true;
    }
    for (i = 0; i < order.length; i++) {
      side = order[i];
      x = p.x + (side === 'r' ? d : side === 'l' ? -d : 0);
      y = p.y + (side === 'd' ? d + 6 : side === 'u' ? -d - 6 : 0);
      if (fits(x, y)) return { x: x, y: y, side: side };
    }
    // nada coube (no colado no HUD): faixa livre entre o topo e a base mais proxima do no
    var lo = 6 + R, hi = H - 6 - R;
    for (k = 0; k < rects.length; k++) {
      var rr = rects[k];
      if (rr.b < H * 0.4) lo = Math.max(lo, rr.b + 6 + R);
      else if (rr.t > H * 0.6) hi = Math.min(hi, rr.t - 6 - R);
    }
    x = clamp(p.x + d, 6 + R, W - 6 - R);
    if (!fits(x, clamp(p.y, lo, Math.max(lo, hi)))) x = clamp(p.x - d, 6 + R, W - 6 - R);
    return { x: x, y: clamp(p.y, lo, Math.max(lo, hi)), side: null };
  }

  // canto superior esquerdo de um chip retangular (w x h px) ao lado do no: direita, esquerda, baixo, cima,
  // a GAP px do centro do no, sem cobrir o HUD (rects) nem sair da tela. pref = lado do quadro anterior
  var PCHIP_W = 112, PCHIP_H = 44;
  function pillPlace(p, W, H, rects, w, h, pref) {
    var GAP = 26, M = 6, i, k, side, x, y, sides = ['r', 'l', 'd', 'u', 'dr', 'ur', 'dl', 'ul'];
    var order = pref ? [pref].concat(sides.filter(function (s) { return s !== pref; })) : sides;
    function fits(l, t) {
      if (l < M || t < M || l + w > W - M || t + h > H - M) return false;
      for (k = 0; k < rects.length; k++) {
        var r = rects[k];
        if (l + w + M > r.l && l - M < r.r && t + h + M > r.t && t - M < r.b) return false;
      }
      return true;
    }
    for (i = 0; i < order.length; i++) {
      side = order[i];
      var hs = side.slice(-1), vs = side.length > 1 ? side.charAt(0) : side;
      // diagonais (dr, ur, dl, ul): encostadas no canto do no, metade da folga
      x = hs === 'r' ? p.x + (side.length > 1 ? GAP / 2 : GAP) : hs === 'l' ? p.x - (side.length > 1 ? GAP / 2 : GAP) - w : p.x - w / 2;
      y = vs === 'd' ? p.y + GAP : vs === 'u' ? p.y - GAP - h : p.y - h / 2;
      if (fits(x, y)) return { x: x, y: y, side: side };
    }
    return { x: clamp(p.x + GAP, M, Math.max(M, W - M - w)), y: clamp(p.y - h / 2, M, Math.max(M, H - M - h)), side: null };
  }

  /* ---------- funcoes puras ---------- */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function dist(x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }

  // alterna mao unica: 0 -> sentido tocado -> oposto -> 0. t = posicao do toque (0..1, a -> b).
  // Sentido tocado = de onde se tocou para a outra ponta. Numa mao unica o toque vira (em qualquer metade: o dono
  // tocava de novo no mesmo lugar para virar); ja virada (flipped, do game), o proximo toque volta a duas maos
  function nextOneway(cur, t, flipped) {
    var dir = t < 0.5 ? 1 : -1;
    if (cur === 0 || cur === undefined || cur === null) return dir;
    return flipped ? 0 : -cur;
  }

  // lista de velocidades do dial (CFG.speedDial.levels) com reserva em CFG.speeds
  function speedList(cfg) {
    var lv = cfg && cfg.speedDial && cfg.speedDial.levels, out = [], i;
    if (lv && lv.length) { for (i = 0; i < lv.length; i++) out.push(lv[i].speed); return out; }
    return (cfg && cfg.speeds && cfg.speeds.length) ? cfg.speeds.slice() : [1, 2, 4];
  }
  function nextSpeed(cur, speeds) {
    var i = speeds.indexOf(cur);
    return speeds[(i + 1) % speeds.length];
  }

  // posicoes (0..2) dos pontos de uma face de dado de 1 a 6
  var PIPS = {
    1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]
  };
  function pipLayout(v) { return PIPS[v] || []; }

  /* Maquina de gestos: converte ponteiros em tap, pan, pinca, arrastar estrada e segurar.
   * h = { hitNode(x,y), canRoad(), tap(x,y), pan(dx,dy), zoom(f,cx,cy),
   *       roadStart(node,x,y), roadMove(x,y), roadEnd(x,y), roadCancel(), holdStart(node), holdEnd() } */
  function createGesture(h, opt) {
    opt = opt || {};
    var slop = opt.slop || 8;
    var holdMs = opt.holdMs || 400;
    var ptr = {};
    var count = 0;
    var st = 'idle'; // idle | pending | road | pan | held | pinch | dead | mag
    var node = null, t0 = 0, last = null;
    // lupa: o dedo desceu num ponto ambiguo (cidade longe, dois alvos sob o dedo). Um arrasto que comecaria uma
    // rua dali so aproxima, ao soltar (h.magTap); nenhuma rua comeca
    var mag = false, mx = 0, my = 0;

    function pts() { var a = [], k; for (k in ptr) { if (ptr.hasOwnProperty(k)) a.push(ptr[k]); } return a; }
    function pinchOf(a, b) { return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: dist(a.x, a.y, b.x, b.y) }; }
    function abort() {
      if (st === 'road') h.roadCancel();
      else if (st === 'held') h.holdEnd();
    }

    // esquece todos os ponteiros (ponteiro orfao, app em segundo plano)
    function reset() {
      abort();
      ptr = {}; count = 0; st = 'idle'; node = null; last = null; mag = false;
    }
    // primary = e.isPrimary: no iOS o primeiro dedo de um toque novo e sempre primario.
    // Se ainda ha ponteiros registrados, um pointerup se perdeu: recomeca do zero.
    function down(id, x, y, t, primary) {
      if (primary && count > 0) reset();
      if (ptr[id]) return;
      ptr[id] = { x: x, y: y, sx: x, sy: y };
      count++;
      if (count === 1) {
        st = 'pending'; t0 = t; node = h.hitNode(x, y);
        mag = !!(h.magAt && h.magAt(x, y)); mx = x; my = y;
      } else if (count === 2) {
        abort(); st = 'pinch';
        var p = pts(); last = pinchOf(p[0], p[1]);
      } else { abort(); st = 'dead'; }
    }
    function move(id, x, y) {
      var p = ptr[id]; if (!p) return;
      var px = p.x, py = p.y;
      p.x = x; p.y = y;
      if (st === 'pending') {
        if (dist(x, y, p.sx, p.sy) > slop) {
          // Rua na mao: arrasto que comeca perto de um ponto (fora do raio de toque, mas ao lado dele)
          // sai desse ponto. Arrasto que comeca em ponta/no com a Rua ativa nunca vira pan.
          if (!node && h.nearNode) { var nn = h.nearNode(p.sx, p.sy); if (nn && h.canRoad(nn)) node = nn; }
          if (mag && node && h.canRoad(node) && h.magTap) { st = 'mag'; }
          else if (node && h.canRoad(node)) { st = 'road'; h.roadStart(node, p.sx, p.sy); h.roadMove(x, y); }
          // Rua na mao fora do planejamento: o mapa anda e a faixa diz por que nada se constroi
          else if (node && h.roadDenied && h.roadDenied()) { st = 'pan'; h.pan(x - p.sx, y - p.sy); }
          // Rua na mao e arrasto fora de no: o mapa anda, mas a UI diz de onde a rua comeca (uma vez por gesto)
          // blind3 2: mao vazia, arrasto de uma ponta sem pontos para a rua: o motivo certo (nao 'use two fingers')
          else if (node && h.roadBroke && h.roadBroke(node)) { st = 'dead'; }
          else if (!node && h.canRoad() && h.roadMiss) { st = 'dead'; h.roadMiss(p.sx, p.sy); }
          // dias 1 a 3: um dedo no vazio (ou numa ponta, sem ferramenta) nao move o mapa; dois dedos movem
          // (jogador-so-tela 2026-11-09: o arrasto tirava da tela a ponta que a dica apontava)
          else if (h.lockPan && h.lockPan()) { st = 'dead'; if (h.panStart) h.panStart(p.sx, p.sy, node); if (h.panLocked) h.panLocked(p.sx, p.sy, node); }
          else { st = 'pan'; if (h.panStart) h.panStart(p.sx, p.sy, node); h.pan(x - p.sx, y - p.sy); }
        }
      } else if (st === 'pan') {
        h.pan(x - px, y - py);
      } else if (st === 'road') {
        h.roadMove(x, y);
      } else if (st === 'held') {
        if (dist(x, y, p.sx, p.sy) > slop * 3) { h.holdEnd(); st = 'pan'; }
      } else if (st === 'pinch') {
        var a = pts();
        if (a.length < 2) return;
        var c = pinchOf(a[0], a[1]);
        if (last) {
          if (last.d > 4 && c.d > 4) h.zoom(c.d / last.d, c.cx, c.cy);
          h.pan(c.cx - last.cx, c.cy - last.cy);
        }
        last = c;
      }
    }
    function up(id, x, y) {
      var p = ptr[id]; if (!p) return;
      delete ptr[id]; count--;
      if (count === 0) {
        if (st === 'pending') h.tap(x, y);
        else if (st === 'road') h.roadEnd(x, y);
        else if (st === 'held') h.holdEnd();
        else if (st === 'mag') h.magTap(mx, my);
        st = 'idle'; node = null; last = null; mag = false;
      } else if (st === 'pinch') { st = 'dead'; }
    }
    function cancel(id) {
      if (!ptr[id]) return;
      delete ptr[id]; count--;
      abort();
      if (count === 0) { st = 'idle'; node = null; last = null; mag = false; } else st = 'dead';
    }
    function tick(t) {
      // canHold: com ferramenta ativa, segurar nao rouba o toque (toque lento ainda coloca, arrasto lento ainda constroi)
      if (st === 'pending' && node && t - t0 >= holdMs && (!h.canHold || h.canHold())) { st = 'held'; h.holdStart(node); }
    }
    return { down: down, move: move, up: up, cancel: cancel, tick: tick, reset: reset,
             state: function () { return st; }, count: function () { return count; } };
  }

  /* ---------- SVG ---------- */

  function svg(inner, vb) {
    return '<svg viewBox="' + (vb || '0 0 48 48') + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + inner + '</svg>';
  }
  var ICONS = {
    // Pare: octogono de apotema 17 (a caixa do circulo antigo, r = 17), borda branca e STOP (CRZ.STOP_SIGN, config.js)
    stop: CRZ.STOP_SIGN ? CRZ.STOP_SIGN.svg(24, 24, 17, 'class="f-red"', 'class="f-white"', true) : '',
    yield: '<path class="f-red" fill-rule="evenodd" d="M5 9H43L24 42Z M13.5 14.5H34.5L24 32.5Z"/>',
    light: '<rect x="15" y="4" width="18" height="40" rx="9" class="f-ink"/><circle cx="24" cy="14" r="4" class="f-dim"/><circle cx="24" cy="24" r="4" class="f-dim"/><circle cx="24" cy="34" r="4.2" class="f-green"/>',
    // rotatoria igual ao mapa (drawPicto do render.js com s = 36): a placa de tres setas girando (CRZ.ROUND_SIGN,
    // config.js; w_tiles: o aro com ponto lia como alvo). Zebra 0,9s x 0,7s com 3 barras solidas de cw/5, sem moldura
    round: CRZ.ROUND_SIGN ? CRZ.ROUND_SIGN.svg(24, 24, 36, 'class="s-ink"', 'class="f-ink"') : '',
    cross: '<rect x="7.8" y="11.4" width="6.48" height="25.2" class="f-ink"/><rect x="20.76" y="11.4" width="6.48" height="25.2" class="f-ink"/><rect x="33.72" y="11.4" width="6.48" height="25.2" class="f-ink"/>',
    // w_tiles: duas faixas = uma rua vista de cima, duas bordas e a faixa tracejada no meio (antes so dois tracejados)
    upgrade: '<line x1="12" y1="5" x2="12" y2="43" stroke-width="3.5" class="s-ink"/><line x1="36" y1="5" x2="36" y2="43" stroke-width="3.5" class="s-ink"/><line x1="24" y1="7" x2="24" y2="43" stroke-width="3" stroke-dasharray="6 5" class="s-ink"/>',
    road: '<line x1="7" y1="41" x2="33" y2="15" stroke-width="3" stroke-linecap="round" class="s-ink"/><circle cx="37" cy="11" r="5.5" class="f-ink"/>',
    oneway: '<line x1="5" y1="24" x2="18" y2="24" stroke-width="4" class="s-ink"/><path d="M17 11L43 24L17 37Z" class="f-ink"/>'
  };
  var BADGE = '<circle cx="39" cy="9" r="6" class="f-green"/>';
  var CARD_ICONS = {
    plus2: '<rect x="21" y="8" width="6" height="32" class="f-ink"/><rect x="8" y="21" width="32" height="6" class="f-ink"/>',
    freeRoad: ICONS.road + BADGE,
    freeLight: ICONS.light + BADGE,
    patient: '<circle cx="24" cy="24" r="16" fill="none" stroke-width="3.5" class="s-ink"/><path d="M24 13V24L31 29" fill="none" stroke-width="3.5" stroke-linecap="round" class="s-ink"/>',
    waveBonus: '<path d="M4 24Q14 4 24 24T44 24" fill="none" stroke-width="4" stroke-linecap="round" class="s-green"/>',
    smooth: '<path d="M8 12L20 24L8 36 M24 12L36 24L24 36" fill="none" stroke-width="4" stroke-linejoin="round" class="s-ink"/>',
    round: ICONS.round + BADGE,
    freePower: ICONS.light + BADGE
  };
  var UNDO_ICON = '<path d="M16 14L8 22L16 30 M8 22H28A10 10 0 0 1 28 42H20" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="s-ink"/>';
  var PLAY_ICON = '<path d="M8 4L20 12L8 20Z" fill="currentColor"/>';
  var BOLT_ICON = '<path d="M14 2L5 14H11L9 22L19 9H12.5Z" fill="currentColor"/>';
  var RESET_ICON = '<path d="M12 4A8 8 0 1 0 20 12 M12 1V7L17 4Z" fill="none" stroke-width="2" stroke="currentColor"/>';
  // enquadrar: quatro cantos e um ponto no meio
  var FF_ICON = '<path d="M3 5L12 12L3 19Z M12 5L21 12L12 19Z" fill="currentColor"/>';
  var FIT_ICON = '<path d="M3 8V3H8 M16 3H21V8 M21 16V21H16 M8 21H3V16" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>';

  function toolIcon(id) { return svg(ICONS[id] || ''); }
  function cardIcon(id) { return svg(CARD_ICONS[id] || ''); }

  // contorno por kind: vermelho fino em bad, verde grosso em good/great/jackpot, preto em plain
  function dieSvg(value, faces, kind) {
    var tone = kindTone(kind), sw = tone === 'red' ? 1.5 : (tone === 'green' ? 3 : 2);
    var s = '<rect x="2" y="2" width="32" height="32" rx="8" fill="none" stroke-width="' + sw + '" class="s-' + tone + '"/>';
    if (faces <= 6) {
      var p = pipLayout(value), i;
      for (i = 0; i < p.length; i++) {
        s += '<circle cx="' + (9 + p[i][0] * 9) + '" cy="' + (9 + p[i][1] * 9) + '" r="3" class="f-ink"/>';
      }
    } else {
      s += '<text x="18" y="24" text-anchor="middle" font-size="16" font-weight="700" class="f-ink">' + value + '</text>';
    }
    return svg(s, '0 0 36 36');
  }
  // dado miniatura da previsao: contorno tracejado na cor do kind, so o numero
  function miniDieSvg(value, kind) {
    var tone = kindTone(kind);
    return svg('<rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="none" stroke-width="1.6" stroke-dasharray="3 2" class="s-' + tone + '"/>' +
      '<text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="700" class="f-ink">' + value + '</text>', '0 0 24 24');
  }
  function starPoints(cx, cy, ro, ri, n) {
    var pts = [], i, a, r;
    for (i = 0; i < n * 2; i++) {
      a = -Math.PI / 2 + i * Math.PI / n; r = i % 2 ? ri : ro;
      pts.push((cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1));
    }
    return pts.join(' ');
  }
  // grant (so para 'free'): 'light' quando a face da o semaforo gratis (game.dieGrant); o icone mostra o semaforo
  // com o selo 0 em vez da rua (playtest cego 3, shot 099: cabecalho com rua num dia de semaforo gratis)
  function eventSvg(id, kind, grant) {
    var tone = kindTone(kind || ({ rush: 'bad', rain: 'bad', festival: 'bad', luck1: 'good', luck2: 'good', luck3: 'great',
                                   free: 'great', calm: 'great', jackpot: 'jackpot' })[id]);
    var F = 'f-' + tone, S = 's-' + tone, LN = ' stroke-linecap="round" fill="none"';
    var n = { busy: 3 }[id], s = '', i, m;
    if (id === 'free' && grant === 'light') {
      s = '<rect x="5" y="1.5" width="10" height="21" rx="5" class="f-ink"/><circle cx="10" cy="6.8" r="2.1" class="f-dim"/>' +
        '<circle cx="10" cy="12" r="2.1" class="f-dim"/><circle cx="10" cy="17.2" r="2.2" class="f-green"/>' +
        '<circle cx="18" cy="18" r="5" class="' + F + '"/><text x="18" y="21" text-anchor="middle" font-size="8" font-weight="700" class="f-white">0</text>';
    } else if (id === 'plain') {
      s = '<line x1="4" y1="12" x2="20" y2="12" stroke-width="2.4"' + LN + ' class="s-ink"/>';
    } else if (id === 'rush') {
      // tres setas para dentro: da esquerda, da direita e de cima
      s = '<path d="M1.5 12H8 M6 9.5L8.5 12L6 14.5 M22.5 12H16 M18 9.5L15.5 12L18 14.5 M12 1.5V7.5 M9.5 5.5L12 8L14.5 5.5" stroke-width="1.8"' + LN + ' stroke-linejoin="round" class="' + S + '"/>' +
        '<circle cx="12" cy="16" r="2" class="' + F + '"/><circle cx="12" cy="21" r="1.6" class="' + F + '"/>';
    } else if (id === 'rain') {
      s = '<path d="M8 4L5.5 11 M14 4L11.5 11 M20 4L17.5 11 M11 13L8.5 20 M17 13L14.5 20" stroke-width="2"' + LN + ' class="' + S + '"/>';
    } else if (id === 'festival') {
      s = '<circle cx="12" cy="12" r="4.2" class="' + F + '"/>';
      for (i = 0; i < 8; i++) {
        m = i * Math.PI / 4;
        s += '<line x1="' + (12 + Math.cos(m) * 7).toFixed(1) + '" y1="' + (12 + Math.sin(m) * 7).toFixed(1) + '" x2="' + (12 + Math.cos(m) * 10.5).toFixed(1) +
          '" y2="' + (12 + Math.sin(m) * 10.5).toFixed(1) + '" stroke-width="1.8" stroke-linecap="round" class="' + S + '"/>';
      }
    } else if (id === 'luck1' || id === 'luck2' || id === 'luck3') {
      // "+N" cabe no viewBox de 24 (antes o 2 saia cortado no chip do topo)
      s = '<circle cx="4.6" cy="12" r="3.6" class="' + F + '"/>' +
        '<text x="9.2" y="16.2" font-size="11" font-weight="700" letter-spacing="-0.4" class="f-ink">+' + id.charAt(4) + '</text>';
    } else if (id === 'free') {
      s = '<path d="M3.5 20.5L11.5 12.5" stroke-width="3"' + LN + ' class="s-ink"/><circle cx="14" cy="9.5" r="4.4" class="f-ink"/>' +
        '<circle cx="18" cy="18" r="5" class="' + F + '"/><text x="18" y="21" text-anchor="middle" font-size="8" font-weight="700" class="f-white">0</text>';
    } else if (id === 'quiet') {
      s = '<path d="M2 12Q6.5 6 12 12T22 12" stroke-width="2.6"' + LN + ' class="' + S + '"/>';
    } else if (id === 'patient') {
      // ampulheta: esperar mais
      s = '<path d="M6 3H18 M6 21H18 M7 3Q7 9 12 12Q17 9 17 3 M7 21Q7 15 12 12Q17 15 17 21" stroke-width="1.8"' + LN + ' stroke-linejoin="round" class="' + S + '"/>';
    } else if (id === 'lucky' || id === 'loan') {
      s = '<circle cx="4.6" cy="12" r="3.6" class="' + F + '"/>' +
        '<text x="9.2" y="16.2" font-size="11" font-weight="700" letter-spacing="-0.4" class="f-ink">+' + (id === 'loan' ? 4 : 2) + '</text>';
    } else if (id === 'biggame') {
      s = '<polygon points="' + starPoints(12, 12, 10.5, 5.2, 5) + '" class="' + F + '"/>';
    } else if (id === 'calm') {
      s = '<path d="M2 12Q6.5 6 12 12T22 12" stroke-width="2.6"' + LN + ' class="' + S + '"/>';
    } else if (id === 'jackpot') {
      s = '<polygon points="' + starPoints(12, 12, 10.5, 5.2, 8) + '" class="' + F + '"/>';
    } else if (n) {
      var w = n * 4 + (n - 1) * 2, x0 = (24 - w) / 2;
      for (i = 0; i < n; i++) s += '<rect x="' + (x0 + i * 6) + '" y="10" width="4" height="4" class="' + (id === 'rush' ? 'f-red' : 'f-ink') + '"/>';
      s += '<line x1="2" y1="18" x2="22" y2="18" stroke-width="1.5" class="s-ink"/>';
    }
    return svg(s, '0 0 24 24');
  }

  // B3 c (2026-11-15): um dono so para body.crz-modal. Cada camada (guia, tela do dado, menu, tutorial) liga e
  // desliga o PROPRIO nome; a classe fica enquanto houver algum dono. O mesmo bloco em ui.js, tutorial.js e menu.js:
  // quem carregar primeiro cria CRZ.modal, os outros o usam
  function modalReg() {
    if (CRZ.modal && CRZ.modal.set) return CRZ.modal;
    function owners(body) { if (!body) return null; if (!body.__crzModal) { try { Object.defineProperty(body, '__crzModal', { value: {}, writable: true }); } catch (e) { body.__crzModal = {}; } } return body.__crzModal; }
    function any(o, skip) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && o[k] && k !== skip) return true; return false; }
    CRZ.modal = {
      set: function (body, name, on) {
        var o = owners(body); if (!o) return;
        var had = any(o);
        if (on) o[name] = 1; else delete o[name];
        var now = any(o), cl = body.classList;
        if (!cl) return;
        if (now) cl.add('crz-modal'); else if (had) cl.remove('crz-modal');
      },
      has: function (body, name) { var o = owners(body); return !!(o && o[name]); },
      others: function (body, name) { var o = owners(body); return !!(o && any(o, name)); },
      list: function (body) { var o = owners(body), out = [], k; if (o) for (k in o) if (o[k]) out.push(k); return out.sort(); }
    };
    return CRZ.modal;
  }

  modalReg();

  /* ---------- helpers de DOM e storage ---------- */

  function lsGet(k) { try { return root.localStorage ? root.localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (root.localStorage) root.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { if (root.localStorage) root.localStorage.removeItem(k); } catch (e) {} }
  // B3 d (2026-11-15): catch que esconderia erro de logica registra no console uma vez por tipo (storage segue mudo)
  var warned0 = {};
  function warnOnce(kind, e) {
    if (warned0[kind]) return;
    warned0[kind] = 1;
    try { if (root.console && root.console.warn) root.console.warn('Gridlet UI: ' + kind, e && e.message ? e.message : e); } catch (x) {}
  }
  function nowMs() {
    return (root.performance && root.performance.now) ? root.performance.now() : Date.now();
  }

  /* ---------- UI ---------- */

  // ---------- retorno da escolha (v2): regras puras, testadas sem DOM ----------
  // goodGap: hoje tem de estar 0,15 abaixo de ontem no mesmo segundo do dia, e abaixo do anel ambar (0,3), para
  // 'Calm here'; badGap: 'Busy again' so com anel ambar agora e ate 0,05 abaixo de ontem. Entre os dois: nenhum balao
  // (ruido nao vira veredito). win: janela (s de jogo) do maximo recente de hoje. lead: o veredito sai pelo menos
  // lead s de parede antes do fim do dia (o balao de 3 s cabe inteiro na corrida). balloonMs: vida do balao (parede).
  var FBK = { goodGap: 0.15, badGap: 0.05, calm: 0.3, passGap: 0.02, win: 2, lead: 4, balloonMs: 3000, waitMs: 3000,
              morningMax: 20000, pulseMs: 12000, quietMs: 600 };
  // estresse de ontem no segundo t do dia (amostra a cada dt s; maximo da amostra e das vizinhas, contra ruido)
  function fbkTraceAt(w, t) {
    var a = w && w.s, dt = (w && w.dt) || 2;
    if (!a || !a.length) return w && typeof w.p === 'number' ? w.p : null;
    var i = Math.round(t / dt) - 1;
    if (i < 0) i = 0;
    if (i > a.length - 1) i = a.length - 1;
    var m = 0, k;
    for (k = Math.max(0, i - 1); k <= Math.min(a.length - 1, i + 1); k++) if (a[k] > m) m = a[k];
    return m / 100;
  }
  // segundo do dia em que o balao decide: o pico de ontem, mas com folga para o balao caber antes do fim do dia
  function fbkTrigger(w, dayLen, speed) {
    var lead = Math.max(FBK.lead, FBK.lead * (speed > 0 ? speed : 1));
    var t = w && typeof w.t === 'number' ? w.t : dayLen * 0.5;
    return Math.max(2, Math.min(t, dayLen - lead));
  }
  // veredito no instante: yest = ontem no mesmo segundo; now = agora; recent = maximo de hoje na janela recente
  function fbkVerdict(yest, now, recent) {
    if (yest == null) return null;
    var r = Math.max(recent || 0, now || 0);
    if (r < FBK.calm && r <= yest - FBK.goodGap) return 'good';
    if (now >= FBK.calm && now >= yest - FBK.badGap) return 'bad';
    return null;
  }
  // resultado do vigiado no resumo, pela espera mais longa (s inteiros): melhor, pior ou igual (margem de 2 s ou 20%)
  function fbkResult(e) {
    if (!e || !e.now || typeof e.w !== 'number') return null;
    var a = Math.round(e.w), b = Math.round(e.now.w), gap = Math.max(2, a * 0.2);
    return b <= a - gap ? 'better' : (b >= a + gap ? 'worse' : 'same');
  }
  function fbkToolName(t) { return STR.fbk.tool[t] || STR.fbk.extraTool[t] || STR.tools[t] || t; }
  function dieFx(id, day, cfg) {
    var D = cfg && cfg.dice; if (!D || typeof id !== 'string') return {};
    // dado v2: as faces de CFG.dice.defs (o history so guarda a face que valeu no dia: usada ou sem escolha)
    if (D.defs && D.defs[id]) return D.defs[id];
    var tab = day <= 5 ? D.early : D.late, i;
    for (i = 0; tab && i < tab.outcomes.length; i++) if (tab.outcomes[i].id === id) return tab.outcomes[i];
    return {};
  }
  // linha do porque: a causa principal do numero de hoje contra ontem, uma so, por prioridade:
  // strike > evento de lugar de hoje (events.js whyOf) > vigiado que melhorou > dado > duracao do dia > cidade maior. Cada frase so sai quando o sentido bate com o
  // numero (dia mais curto E menos carros); sem causa honesta, nenhuma linha. Devolve { key, text } ou null
  function whyCause(s, cfg) {
    var sm = s && s.summary, hs = (s && s.history) || [], W = STR.fbk.why;
    if (!sm) return null;
    var t = hs[hs.length - 1], y = hs[hs.length - 2];
    if (!t || t.day !== s.day) return null;
    if (sm.failed) return { key: 'strike', text: W.strike };
    // evento de lugar de hoje (events.js): depois do strike e antes do dado
    if (y && typeof y.delivered === 'number' && CRZ.Events && typeof CRZ.Events.whyOf === 'function') {
      var ew = CRZ.Events.whyOf(s, (t.delivered | 0) - (y.delivered | 0));
      if (ew) return { key: 'event', text: ew.text, type: ew.type };
    }
    var L = s.watch && s.watch.day === s.day ? s.watch.list || [] : [], i;
    for (i = 0; i < L.length; i++) {
      if (fbkResult(L[i]) !== 'better') continue;
      var more = typeof L[i].n === 'number' && L[i].now && L[i].now.n > L[i].n;
      return more ? { key: 'fixedMore', text: W.fixedMore } : { key: 'fixedCalm', text: W.fixedCalm };
    }
    if (!y || typeof y.delivered !== 'number') return null;
    var dd = (t.delivered | 0) - (y.delivered | 0);
    // v2x (playtest cego 5: 33 -> 15 -> 12 carros nos dias 3 e 4 sem motivo): o dia 2 tem day2Mul vezes os carros por
    // segundo e o dia 3 o comboio do tutorial; o dia seguinte a eles e um dia comum
    var TD = CRZ.Game && CRZ.Game._teach && CRZ.Game._teach.day;
    if (dd < 0 && ((y.day === 2 && cfg.day2Mul > 1) || (TD && y.day === TD && t.day === TD + 1))) return { key: 'afterRush', text: W.afterRush };
    var ft = dieFx(t.die, t.day, cfg), fy = dieFx(y.die, y.day, cfg);
    var sT = ft.spawnMul || 1, sY = fy.spawnMul || 1, vT = ft.speedMul || 1, vY = fy.speedMul || 1;
    if (sT > 1.05 && !(sY > 1.05) && dd > 0) return { key: 'dieMore', text: W.dieMore((STR.dice[t.die] && STR.dice[t.die].name) || 'Busy day') };
    if (sT < 0.95 && !(sY < 0.95) && dd < 0) return { key: 'dieCalm', text: W.dieCalm };
    // Rush do d20 tambem deixa os carros 10% mais lentos: 'Rain' so para a face que so muda a velocidade
    if (vT < 0.95 && !(sT > 1.05) && !(vY < 0.95 && !(sY > 1.05)) && dd < 0) return { key: 'dieRain', text: W.dieRain };
    var lt = t.len > 0 ? t.len : cfg.dayLen[t.day - 1], ly = y.len > 0 ? y.len : cfg.dayLen[y.day - 1];
    if (lt > 0 && ly > 0 && lt <= ly * 0.9 && dd < 0) return { key: 'shorter', text: W.shorter };
    if (lt > 0 && ly > 0 && lt >= ly * 1.1 && dd > 0) return { key: 'longer', text: W.longer };
    if (typeof t.jn === 'number' && typeof y.jn === 'number' && t.jn > y.jn && dd > 0) return { key: 'grew', text: W.grew };
    return null;
  }

  function create(opts) {
    var CFG = CRZ.CFG, C = CFG.colors;
    var rootEl = opts.root, game = opts.game, render = opts.render, audio = opts.audio;
    // v2: o que entra nesta partida vem de game.state.tools (o game sabe do arquetipo e da carta do dia 19)
    matchHook = function (id) {
      var L = game && game.state && game.state.tools, i;
      if (!L || !L.length) return undefined;
      for (i = 0; i < L.length; i++) if (L[i].id === id) return CFG.tools[id] && CFG.tools[id].choiceDay ? !!L[i].unlocked : undefined;
      return false;
    };
    // tela da rolagem do dado (padrao ligado; testes antigos que nao tratam dela passam rollScreen: false)
    var ROLL_ON = opts.rollScreen !== false;
    // blind3 6: depois de construir ou pôr um sinal no plano a camera NAO anda sozinha (tutorial, dica, reveal)
    // ate a jogadora mexer no mapa, tocar no enquadrar ou o dia mudar
    var camFreeze = false, camBypass = 0;
    (function guardCam() {
      if (!render) return;
      ['reveal', 'focus', 'fit', 'fitAll', 'fitRoom'].forEach(function (m) {
        var f = render[m]; if (typeof f !== 'function') return;
        render[m] = function () {
          if (camFreeze && !camBypass && game && game.state && game.state.phase === 'plan') return;
          return f.apply(render, arguments);
        };
      });
    })();
    function camFree(fn) { camBypass++; try { return fn(); } finally { camBypass--; } }
    var doc = rootEl.ownerDocument || root.document;
    var canvas = (render && render.canvas) || doc.getElementById('stage');
    var destroyed = false;
    var listeners = []; // [target, type, fn, opts]

    function on(target, type, fn, o) {
      target.addEventListener(type, fn, o);
      listeners.push([target, type, fn, o]);
    }
    function el(tag, cls, html) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (html) e.innerHTML = html;
      return e;
    }
    // timeouts rastreados: destroy limpa todos (nada dispara depois da UI sair)
    var timers = [];
    function later(fn, ms) {
      var id = root.setTimeout(function () {
        var i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1);
        if (!destroyed) fn();
      }, ms);
      timers.push(id);
      return id;
    }
    // sndDenyAt: a faixa dita logo depois do som de recusa e uma recusa; um som de acao bem sucedida
    // (build/place) tira essa faixa da tela (antes ela ficava 3-4 s depois da jogadora acertar)
    var sndDenyAt = -1e9, sayDeny = false, denyPend = false;
    function snd(name) {
      if (name === 'deny') { sndDenyAt = nowMs(); denyPend = true; }
      else if ((name === 'build' || name === 'place') && sayDeny) clearDenySay();
      try { if (audio && audio.play) audio.play(name); } catch (e) { warnOnce('audio.play', e); }
    }
    function clearDenySay() {
      sayDeny = false;
      if (typeof sayEl !== 'undefined' && sayEl && sayUntil) { sayUntil = 0; sayEl.classList.remove('show'); }
    }
    function ov() { return render && render.overlay ? render.overlay : null; }

    /* ---- ganchos para tutorial/menu (CONGELADOS: tutorial.js e menu.js dependem deles) ----
     * document recebe CustomEvent 'crz:ui' com detail {type, ...}: toolSelected{tool}, toolDeselected{tool},
     * nodeTap{id}, roadDragStart{fromId}, roadBuilt{}, pairTap{id}, cardPicked{index},
     * playPressed{}, undoPressed{ok}, clearUsed{ok, kind}, speedChanged{speed}. data-tut: play (plan) e speed (run, mesmo botao). Elementos reais levam data-tut (ver tut()). */
    function emitUI(type, extra) {
      try {
        var CE = root.CustomEvent, d = { type: type }, q;
        if (extra) for (q in extra) if (extra.hasOwnProperty(q)) d[q] = extra[q];
        if (typeof CE === 'function' && doc.dispatchEvent) doc.dispatchEvent(new CE('crz:ui', { detail: d }));
      } catch (e) { warnOnce('emitUI', e); }
    }
    function tut(e, name) { e.setAttribute('data-tut', name); return e; }
    // body.crz-modal = overlay do tutorial/menu aberto: mapa e HUD nao reagem
    function modal() {
      var b = doc.body;
      return !!(b && b.classList && b.classList.contains('crz-modal'));
    }

    // ---- estado local ----
    var sel = null;           // ferramenta selecionada
    var pairFirst = null;     // semaforo tocado sem ferramenta (mostra o chip "Pair lights" ao lado)
    var pairUntil = 0;
    // parear exige intencao (passeio humano 2026-11-09): toque no chip arma {from, until}; so entao o toque
    // noutro semaforo pareia. Par existente nunca e trocado calado: pairRep = {a, b, until} pede o segundo toque
    var pairArm = null, pairRep = null, PAIR_MS = 6000;
    var infTimer = 0;         // ms restantes de influencia por toque
    var holding = false;
    var userMoved = false;    // a jogadora ja arrastou ou pinçou o mapa (some a dica de arrastar)
    var roadFrom = null, ghost = null;
    var lastPhase = null, lastDay = -1, budgetCap = 0;
    var overWin = null, picked = false, newArmed = 0;
    var unlockedIds = null, tiles = {};
    var hints = {};
    try { hints = JSON.parse(lsGet(HINT_KEY) || '{}') || {}; } catch (e) { hints = {}; }
    // L1: so objeto (primitivo ou lista fazia seen() sempre falso e a fila de dicas crescer todo quadro)
    if (!hints || typeof hints !== 'object' || Array.isArray(hints)) hints = {};
    // M4: dicas 'uma vez por PARTIDA' levam a semente na chave; as de outras partidas saem ao carregar
    var PER_RUN = { boostOut: 1, bigDie: 1, sumInfo: 1, firstSpend: 1, ringGroup: 1, day4rule: 1, boostJ1: 1, runHint: 1, half6: 1, boosts4: 1, resumed: 1,
                    strikes6: 1, chapter11: 1, chapter21: 1, mag: 1, guideHint: 1 };
    var runTag = '@' + ((game.world && game.world.seed) != null ? game.world.seed : 0);
    (function pruneRunHints() {
      var k, ch = false;
      for (k in hints) if (hints.hasOwnProperty(k) && k.indexOf('@') > 0 && k.slice(k.indexOf('@')) !== runTag) { delete hints[k]; ch = true; }
      if (ch) lsSet(HINT_KEY, JSON.stringify(hints));
    })();
    // A.6/A.7 (2026-11-15): o que a interface lembra do plano de HOJE (sinais do comeco do plano, pontos do comeco,
    // perguntas da folha do Play ja respondidas) e a velocidade escolhida pela jogadora sobrevivem ao reload, com a
    // etiqueta da partida e o dia. Nada aqui BLOQUEIA acao: bloqueio le so game.state e game.world (day1Built)
    var PLAN_KEY = 'gridlet.plan';
    var planMemo = (function () {
      var o = null; try { o = JSON.parse(lsGet(PLAN_KEY) || 'null'); } catch (e) { warnOnce('planMemo', e); }
      if (!o || typeof o !== 'object' || Array.isArray(o) || o.tag !== runTag) o = { tag: runTag };
      return o;
    })();
    function planMemoSave() { lsSet(PLAN_KEY, JSON.stringify(planMemo)); }
    function planToday(s) { var p = planMemo.plan; return p && typeof p === 'object' && p.day === (s.day | 0) ? p : null; }
    // entrada no plano (tambem o primeiro quadro depois de um reload): reusa a foto do dia se ela existe
    function planEnter(s, snap) {
      var p = planToday(s);
      if (!p) { p = planMemo.plan = { day: s.day | 0, tools: snap, b0: s.budget | 0, asked: {} }; planMemoSave(); }
      if (!p.tools || typeof p.tools !== 'object') p.tools = snap;
      if (!p.asked || typeof p.asked !== 'object') p.asked = {};
      return p;
    }
    var hint = null;

    // ---- DOM ----
    var ui = el('div', 'crz-ui');
    ui.setAttribute('data-phase', 'plan');
    var k;
    for (k in C) { if (C.hasOwnProperty(k) && ui.style && ui.style.setProperty) ui.style.setProperty('--' + k, C[k]); }

    var top = el('div', 'crz-top');
    var dotsEl = tut(el('div', 'crz-dots'), 'dots'), dotEls = [], i;
    // v2: as bolinhas sao as do capitulo de hoje (CFG.chapterDays, 10), o mesmo componente; o rotulo diz 'Day 14 of 30'
    var CH_LEN = (CFG.chapterDays | 0) > 0 ? Math.min(CFG.chapterDays | 0, CFG.maxDays) : CFG.maxDays;
    // w_price: preco de tabela de hoje (sem mao nem gratuidade): CFG.tools.<id>.costByChapter pelo capitulo do dia
    function listPrice(t, day) {
      var d = day; if (!(d > 0)) { try { d = game.state.day | 0; } catch (e) { d = 1; } }
      return CRZ.toolPrice ? CRZ.toolPrice(t, d) : (CFG.tools[t] ? CFG.tools[t].cost : 0);
    }
    for (i = 0; i < CH_LEN; i++) { var d = el('span', 'crz-dot'); d.setAttribute('aria-label', 'Day ' + (i + 1)); dotsEl.appendChild(d); dotEls.push(d); }
    // rotulo 'Day N of 30' sob os pontinhos (o ponto vermelho e hoje)
    var dayLbl = el('span', 'crz-lbl crz-lbl-day'); dayLbl.setAttribute('aria-hidden', 'true'); dotsEl.appendChild(dayLbl);
    // w_chap: segunda linha sob 'Day 14 of 30' (como 'Tomorrow' sob o dado): as 10 bolinhas sao deste capitulo
    var chLbl = el('span', 'crz-lbl crz-lbl-ch'); chLbl.setAttribute('aria-hidden', 'true'); dotsEl.appendChild(chLbl);
    // dado + previsao formam um unico botao (alvo de toque >= 44 px)
    var dieEl = tut(el('button', 'crz-die off'), 'die');
    var diePips = el('span', 'crz-dpips'), dieEv = el('span', 'crz-dev'), dieNext = el('span', 'crz-dnext off');
    dieNext.setAttribute('role', 'img'); dieNext.setAttribute('aria-label', STR.tomorrow);
    dieEl.appendChild(diePips); dieEl.appendChild(dieEv); dieEl.appendChild(dieNext);
    // micro rotulo 'Die': a caixa do dado (16, 6, 2...) parecia o orcamento
    var dieLbl = el('span', 'crz-lbl crz-lbl-die', STR.lblDie); dieLbl.setAttribute('aria-hidden', 'true'); dieEl.appendChild(dieLbl);
    var nextLbl = el('span', 'crz-lbl crz-lbl-next'); nextLbl.setAttribute('aria-hidden', 'true'); dieEl.appendChild(nextLbl);
    dieEl.setAttribute('aria-expanded', 'false');
    var strikesEl = tut(el('div', 'crz-strikes'), 'strikes'), strikeEls = [];
    for (i = 0; i < (CFG.ironMode ? 1 : CFG.maxStrikes); i++) { var sk = el('span', 'crz-strike'); strikesEl.appendChild(sk); strikeEls.push(sk); }
    var strikeLbl = el('span', 'crz-lbl crz-lbl-strk', STR.lblStrikes); strikeLbl.setAttribute('aria-hidden', 'true'); strikesEl.appendChild(strikeLbl);
    // role fica com infoTap (button focavel que explica ao toque); o aria-label da o numero
    strikesEl.setAttribute('aria-label', 'Strikes: 0 of ' + (CFG.ironMode ? 1 : CFG.maxStrikes));
    // play fica na bandeja (zona do polegar), nao no topo: e o botao mais tocado e o topo
    // direito e o ponto mais dificil de alcancar com uma mao. "Novo jogo" vai para la.
    var playBtn = tut(el('button', 'crz-play'), 'play');
    playBtn.setAttribute('aria-label', STR.play);
    // anel de progresso do dia (so em 'run'): conic-gradient com --p, sem layout por quadro
    var ringEl = el('span', 'crz-ring');
    var playFace = el('span', 'crz-face', svg(PLAY_ICON, '0 0 24 24'));
    playBtn.appendChild(ringEl); playBtn.appendChild(playFace);
    // legenda 'speed' sob o botao enquanto o dia corre (o mesmo botao e o Play no plano)
    var speedLbl = el('span', 'crz-lbl crz-lbl-speed', 'speed'); speedLbl.setAttribute('aria-hidden', 'true'); playBtn.appendChild(speedLbl);
    // no plano: a velocidade com que o dia vai comecar, pequena no canto do Play ('1x')
    var spdBadge = el('span', 'crz-spd'); spdBadge.setAttribute('aria-hidden', 'true'); playBtn.appendChild(spdBadge);
    var ringP = -1;
    // Boost (game: useClear): bolinhas acima do botao de progresso (esmaecidas em plan)
    var clearEl = tut(el('div', 'crz-clear gone'), 'clear');
    clearEl.setAttribute('role', 'img');
    var clearKey = -1;
    var speeds = speedList(CFG);
    // gorjetas: barra fina perto dos pontos de orcamento (so em run)
    var tipEl = tut(el('div', 'crz-tip gone'), 'tips'), tipFill = el('i'), tipTxt = el('span');
    var tipTrack = el('b'); tipTrack.appendChild(tipFill); tipEl.appendChild(tipTrack); tipEl.appendChild(tipTxt);
    var tipKey = '';
    var newBtn = el('button', 'crz-new', svg(RESET_ICON, '0 0 24 24'));
    newBtn.setAttribute('aria-label', STR.newGame);
    top.appendChild(dotsEl); top.appendChild(dieEl); top.appendChild(strikesEl); top.appendChild(newBtn);

    var bottom = el('div', 'crz-bottom');
    var budgetEl = tut(el('div', 'crz-budget'), 'budget');
    var tray = tut(el('div', 'crz-tray'), 'tray');
    var tilesEl = el('div', 'crz-tiles');
    var undoBtn = tut(el('button', 'crz-undo off', svg(UNDO_ICON)), 'undo');
    undoBtn.setAttribute('aria-label', STR.undo);
    tray.appendChild(tilesEl); tray.appendChild(undoBtn); tray.appendChild(playBtn);
    // carta ativa do dia: chip acima do orcamento (plan e run); tocar explica o efeito
    var chipEl = tut(el('button', 'crz-chip gone'), 'card-chip'), chipKey = '';
    // plano, dia 4+: "N new crossings" (cruzamentos desta manha sem sinal); tocar centraliza o primeiro
    var njChipEl = tut(el('button', 'crz-njchip gone'), 'newj-chip'), njChipKey = '';
    // legenda da ferramenta na mao (acima da bandeja) e botao '?' do guia de botoes
    var legendEl = tut(el('div', 'crz-legend gone'), 'legend');
    legendEl.setAttribute('role', 'status'); legendEl.setAttribute('aria-live', 'polite');
    bottom.appendChild(legendEl);
    var guideBtn = tut(el('button', 'crz-guidebtn', '?'), 'guide-btn');
    guideBtn.setAttribute('aria-label', STR.guideOpen);
    bottom.appendChild(guideBtn);
    // dia 1: faixa fixa 'agora toque no Play' (nunca sem proximo passo; ver nextStepTick)
    var nextEl = tut(el('div', 'crz-next gone'), 'next-step');
    nextEl.setAttribute('role', 'status'); nextEl.setAttribute('aria-live', 'polite');
    nextEl.textContent = STR.nextPlay;
    bottom.appendChild(nextEl);
    bottom.appendChild(njChipEl);
    bottom.appendChild(chipEl);
    bottom.appendChild(budgetEl); bottom.appendChild(tipEl); bottom.appendChild(tray); bottom.appendChild(clearEl);
    // enquadrar: canto direito, logo acima da base. Cidade cortada: mostra tudo; cidade inteira: volta ao zoom confortavel
    var fitBtn = tut(el('button', 'crz-fit gone', svg(FIT_ICON, '0 0 24 24')), 'fit');
    fitBtn.setAttribute('aria-label', STR.fitAll);
    bottom.appendChild(fitBtn);
    // blind2 9: 'Skip' (fast-forward) na corrida, dias 3+, quando a cidade esta calma ha 4 s
    // copy review c: o glifo de avancar e SVG (o caractere virava emoji colorido no iPhone)
    var ffChipEl = tut(el('button', 'crz-ffchip gone', '<span>' + STR.ffChip + '</span>' + svg(FF_ICON, '0 0 24 24')), 'ff-chip');
    ffChipEl.setAttribute('aria-label', STR.ffLabel);
    bottom.appendChild(ffChipEl);

    var sumEl = el('div', 'crz-sheet crz-sum');
    var panel = tut(el('div', 'crz-panel'), 'summary');
    // o painel rola em tela baixa (CSS em style.css): o filtro de touchmove deixa ele rolar
    panel.setAttribute('data-scroll', '');
    // data-tut: o balao do strike evita o titulo e o numero grande (nunca os cobre)
    var bigEl = tut(el('div', 'crz-big'), 'summary-big'), capEl = el('div', 'crz-cap');
    capEl.textContent = STR.cars;
    var headEl = tut(el('div', 'crz-headline gone'), 'summary-head');
    // cartao do resumo: cada barra e os circulos com rotulo (a barra sem nome parecia o bonus vazio)
    function sumRow(label, body) {
      var r = el('div', 'crz-srow'), lb = el('span', 'crz-slab');
      lb.textContent = label; r.appendChild(lb); r.appendChild(body); return r;
    }
    // (i) ao lado do titulo da barra: abre/fecha uma explicacao de 2 linhas (aberta no primeiro resumo da partida)
    var infoRows = [];
    function addInfo(row, textFn) {
      var lb = row.children[0], b = el('button', 'crz-sinfo', 'i'), box = el('div', 'crz-sinfotxt gone');
      b.setAttribute('aria-label', 'What is this?'); b.setAttribute('aria-expanded', 'false');
      lb.appendChild(b);
      var item = { btn: b, box: box, text: textFn };
      on(b, 'click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); setInfo(item, box.classList.contains('gone')); });
      infoRows.push(item);
      return box;
    }
    function setInfo(item, open) {
      item.box.classList.toggle('gone', !open); item.btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) item.box.textContent = item.text();
    }
    // pior fila do dia (summary.peak, o anel vermelho mais cheio)
    var waitEl = el('div', 'crz-wait'), waitFill = el('i');
    waitEl.appendChild(waitFill);
    var queueRow = sumRow(STR.sumQueue, waitEl);
    var queueInfo = addInfo(queueRow, function () { return STR.infoQueue; });
    // bonus de velocidade: barra de 0 a perPoint (data-tut 'bonus': o tutorial aponta para ela)
    var bonusBar = el('div', 'crz-wait crz-bbar'), bonusFill = el('i');
    bonusBar.appendChild(bonusFill);
    var bonusRow = tut(sumRow(STR.sumBonus, bonusBar), 'bonus');
    // o valor fica na propria barra, a direita ('+2 tomorrow' ou '21/30'): sem linha verde extra
    var bonusVal = el('span', 'crz-bval'); bonusRow.appendChild(bonusVal);
    var bonusEl = el('div', 'crz-bonus crz-bline gone');
    var bonusInfo = addInfo(bonusRow, function () { return STR.infoBonus + (bonusEl.textContent && /\(/.test(bonusEl.textContent) ? ' ' + bonusEl.textContent.replace(/^[^(]*\(/, 'Today: ').replace(/\)$/, '.') : ''); });
    var sStrikes = tut(el('div', 'crz-sstrikes'), 'summary-strikes'), sStrikeEls = [];
    for (i = 0; i < CFG.maxStrikes; i++) { var ss = el('span', 'crz-strike'); sStrikes.appendChild(ss); sStrikeEls.push(ss); }
    var strikeRow = sumRow(STR.sumStrikes, sStrikes);
    // dica do pior ponto do dia (anel) e titulo das cartas: o jogador sabe o que esta escolhendo
    var jamEl = tut(el('div', 'crz-sjam gone'), 'summary-jam');
    // cruzamentos que o crescimento criou e seguem sem sinal: toque centraliza e destaca o primeiro
    var newJEl = tut(el('button', 'crz-snewj gone'), 'summary-newj');
    // UMA dica de acao por resumo, tocavel, sem vermelho de alarme: tarefa NEW ou o cruzamento mais cheio
    var todoEl = tut(el('button', 'crz-todo gone'), 'summary-todo'), todoKind = null, todoNode = null;
    // carros perdidos (mao unica sem saida): so aparece se perderam; toque mostra o motivo
    var lostEl = tut(el('button', 'crz-bonus lost gone'), 'summary-lost');
    lostEl.style.cssText = 'background:none;border:0;padding:0;font:inherit;text-align:left;cursor:pointer;width:100%';
    var lostShown = false, lostN = 0;
    function lostPaint() { lostEl.textContent = lostN > 0 ? (lostShown ? STR.lostWhy : STR.lostRow(lostN)) : ''; }
    on(lostEl, 'click', function () { lostShown = !lostShown; lostPaint(); });
    var cardsHead = tut(el('div', 'crz-chead'), 'cards');
    var cardsTitle = el('div', 'crz-ctitle');
    cardsTitle.textContent = STR.cardsTitle;
    cardsHead.appendChild(cardsTitle);
    var cardsEl = tut(el('div', 'crz-cards'), 'card-list');
    var skipBtn = el('button', 'crz-skip'); skipBtn.textContent = STR.skip;
    // comparacao com ontem, logo abaixo do numero grande (todo numero com uma comparacao)
    var prevEl = el('div', 'crz-prev gone');
    // ultimo dia: linha de fechamento (dias e carros da partida) logo abaixo da comparacao com ontem
    var closeEl = tut(el('div', 'crz-sclose gone'), 'summary-closing');
    // retorno da escolha (v2): uma linha por cruzamento vigiado ('Your Stop: wait 12 s -> 4 s.') e a linha do porque,
    // logo abaixo da comparacao com ontem (o numero e o porque juntos)
    var watchLineEl = tut(el('div', 'crz-swatch gone'), 'summary-watch');
    var whyEl = tut(el('div', 'crz-swhy gone'), 'summary-why');
    panel.appendChild(headEl); panel.appendChild(bigEl); panel.appendChild(capEl); panel.appendChild(prevEl); panel.appendChild(watchLineEl); panel.appendChild(whyEl); panel.appendChild(closeEl); panel.appendChild(queueRow);
    // pontos que passam ao dia seguinte (ate CFG.carryCap): 'Saved for tomorrow: N'
    var carryEl = el('div', 'crz-bonus crz-carry gone');
    // dia 6: ponto natural de parada (hipercasual), uma linha cinza, uma vez por partida
    var halfEl = tut(el('div', 'crz-half gone'), 'summary-half');
    // w_medals: fim de capitulo: a marca do capitulo (chip) e o que o proximo traz, numa linha
    var chMarkEl = tut(el('div', 'crz-omarks crz-chmark gone'), 'summary-chmark'), chNextEl = tut(el('div', 'crz-half crz-chnext gone'), 'summary-chnext');
    panel.appendChild(queueInfo);
    panel.appendChild(bonusRow); panel.appendChild(bonusInfo); panel.appendChild(strikeRow); panel.appendChild(bonusEl); panel.appendChild(carryEl); panel.appendChild(jamEl); panel.appendChild(lostEl); panel.appendChild(newJEl);
    panel.appendChild(todoEl);
    panel.appendChild(halfEl); panel.appendChild(chMarkEl); panel.appendChild(chNextEl);
    panel.appendChild(cardsHead); panel.appendChild(cardsEl); panel.appendChild(skipBtn);
    // rodada 3: sobra conteudo abaixo da dobra (iPhone SE): sombra e seta "more" presas ao pe do painel
    var moreEl = el('div', 'crz-smore'), moreTxt = el('span');
    moreEl.setAttribute('aria-hidden', 'true'); moreTxt.textContent = STR.more; moreEl.appendChild(moreTxt);
    panel.appendChild(moreEl);
    sumEl.appendChild(panel);
    function syncMore() {
      var sh = +panel.scrollHeight, chh = +panel.clientHeight, st0 = +panel.scrollTop || 0;
      var more = sumEl.classList.contains('show') && sh > 0 && chh > 0 && sh - chh - st0 > 6;
      panel.classList.toggle('crz-hasmore', !!more);
    }

    var overEl = tut(el('div', 'crz-sheet crz-over'), 'over'); overEl.setAttribute('data-scroll', '');
    var markEl = el('div', 'crz-mark');
    markEl.setAttribute('role', 'img');
    var overTitle = el('div', 'crz-otitle'), overSub = el('div', 'crz-osub');
    var statsEl = el('div', 'crz-stats'), statNums = [], statLabs = [STR.statDays, STR.statCars, STR.statStrikes];
    for (i = 0; i < 3; i++) {
      var stc = el('div', 'crz-stat'), stn = el('b'), stl = el('span');
      stl.textContent = statLabs[i]; stc.appendChild(stn); stc.appendChild(stl); statsEl.appendChild(stc); statNums.push(stn);
    }
    // linhas extras da partida: melhor dia e pior momento
    var overBest = el('div', 'crz-oextra'), overHard = el('div', 'crz-oextra');
    var overStreet = el('div', 'crz-ostreet');
    overStreet.setAttribute('aria-hidden', 'true');
    overStreet.appendChild(el('i', 'line'));
    ['c1', 'c2', 'c3'].forEach(function (cc) { overStreet.appendChild(el('i', 'car ' + cc)); });
    var againBtn = el('button', 'crz-again'); againBtn.textContent = STR.again;
    // vitoria no Easy, primeira vez: convite secundario para o Normal (troca pelo fluxo de difficulty.set)
    var tryNormalBtn = tut(el('button', 'crz-trynormal gone'), 'try-normal'); tryNormalBtn.textContent = STR.tryNormal;
    // v2: derrota com volta ao capitulo: 'Retry chapter N' e o principal (againBtn) e 'New game' o secundario (mesmo
    // desenho do 'Try Normal'); a vitoria conta as voltas numa linha cinza como a do melhor dia
    var newGameBtn = tut(el('button', 'crz-trynormal crz-newgame gone'), 'over-new'); newGameBtn.textContent = STR.newGame;
    var overRetries = el('div', 'crz-oextra gone');
    // w_medals: o porque da vitoria (uma frase da partida), recorde batido e as marcas
    var overWhy = tut(el('div', 'crz-owhy gone'), 'over-why'), overRec = tut(el('div', 'crz-orec gone'), 'over-record');
    var overMarks = tut(el('div', 'crz-omarks gone'), 'over-marks');
    on(overMarks, 'click', function (e) { markTap(e); }); on(chMarkEl, 'click', function (e) { markTap(e); });
    var overRetry = null;   // { chapter, day } quando a derrota oferece a volta
    // vitoria no ultimo dia: a linha de fechamento do dia 12 (o game vai do dia 12 direto ao fim, sem resumo)
    var overClose = tut(el('div', 'crz-sclose gone'), 'over-closing');
    overEl.appendChild(markEl); overEl.appendChild(overTitle); overEl.appendChild(overSub); overEl.appendChild(overWhy); overEl.appendChild(overClose); overEl.appendChild(statsEl); overEl.appendChild(overRec); overEl.appendChild(overMarks);
    // rodada 3: a rua com carrinhos parecia uma barra de dias (quadrados preto e vermelho). Agora e de verdade:
    // um quadrado por dia jogado, vermelho = dia com strike, com a legenda embaixo
    var overDays = tut(el('div', 'crz-odays gone'), 'over-days'), overDaysCap = el('div', 'crz-odayscap gone');
    overDays.setAttribute('role', 'img');
    overDaysCap.textContent = STR.daysLegend;
    overStreet.classList.add('gone');
    overEl.appendChild(overBest); overEl.appendChild(overHard); overEl.appendChild(overRetries); overEl.appendChild(overStreet); overEl.appendChild(overDays); overEl.appendChild(overDaysCap); overEl.appendChild(againBtn); overEl.appendChild(tryNormalBtn); overEl.appendChild(newGameBtn);

    // folha do dado: de baixo, acima da bandeja; no run nao bloqueia o mapa
    var sheetEl = el('div', 'crz-diesheet');
    var sheetBack = el('div', 'crz-dieback');
    var sheetPanel = tut(el('div', 'crz-diepanel'), 'die-sheet');
    sheetPanel.setAttribute('data-scroll', '');   // paisagem curta: a folha tem teto e rola (style.css, rodada 3)
    var sheetClose = el('button', 'crz-dieclose', svg('<path d="M6 6L18 18M18 6L6 18" fill="none" stroke-width="2.4" stroke-linecap="round" class="s-ink"/>', '0 0 24 24'));
    sheetClose.setAttribute('aria-label', STR.close);
    var todayBox = el('div', 'crz-dierow'), todayName = el('div', 'crz-diename'), todayDesc = el('div', 'crz-diedesc');
    var tomBox = el('div', 'crz-dierow'), tomName = el('div', 'crz-diename'), tomDesc = el('div', 'crz-diedesc');
    // icone do evento ao lado do nome: a legenda do icone do topo (o traco do 'plain' nao dizia nada)
    var todayIco = el('span', 'crz-dieico'), tomIco = el('span', 'crz-dieico');
    todayBox.appendChild(todayIco); tomBox.appendChild(tomIco);
    todayBox.appendChild(todayName); todayBox.appendChild(todayDesc);
    // uma linha que explica o icone tracejado da previsao
    var tomWhat = el('div', 'crz-diedesc crz-dienext'); tomWhat.textContent = STR.dieNextWhat;
    tomBox.appendChild(tomName); tomBox.appendChild(tomDesc); tomBox.appendChild(tomWhat);
    var rerollBtn = tut(el('button', 'crz-reroll'), 'die-reroll');
    var rerollNote = el('div', 'crz-dienote');
    // o que o dado e, em uma linha (a jogadora nao sabia que o dado era uma escolha)
    var dieWhat = el('div', 'crz-diewhat'); dieWhat.textContent = STR.dieWhat;
    sheetPanel.appendChild(sheetClose); sheetPanel.appendChild(todayBox); sheetPanel.appendChild(tomBox);
    sheetPanel.appendChild(dieWhat); sheetPanel.appendChild(rerollBtn); sheetPanel.appendChild(rerollNote);
    sheetEl.appendChild(sheetBack); sheetEl.appendChild(sheetPanel);
    var sheetOpen = false, sheetKey = '';

    var dayBanner = el('div', 'crz-daybanner');
    dayBanner.setAttribute('aria-hidden', 'true');
    var dayBannerT = 0;
    function showDayBanner(s) {
      dayBanner.textContent = s.day >= CFG.maxDays ? STR.finalDay : STR.dayN + s.day;
      // v2: primeiro dia de um capitulo: uma linha a mais, menor, no mesmo letreiro
      var d0 = s.day | 0;
      if (CH_LEN < CFG.maxDays && d0 >= 1 && (d0 - 1) % CH_LEN === 0) {
        var sub = el('span', 'crz-daysub'); sub.textContent = STR.chapterN((d0 - 1) / CH_LEN + 1); dayBanner.appendChild(sub);
      }
      dayBanner.classList.remove('show'); void dayBanner.offsetWidth; dayBanner.classList.add('show');
      if (dayBannerT) root.clearTimeout(dayBannerT);
      dayBannerT = later(function () { dayBanner.classList.remove('show'); dayBannerT = 0; }, 1250);
    }

    // aviso curto (recusa de ferramenta, dica de fila): faixa no topo, some sozinha; o update cuida do tempo
    var sayEl = tut(el('div', 'crz-say'), 'say');
    sayEl.setAttribute('role', 'status'); sayEl.setAttribute('aria-live', 'polite');
    var sayUntil = 0;
    var sayLater = null, stripOn = false;
    // final check 7: valid (opcional) diz se a dica ainda vale; quando a condicao some (o sinal ja foi posto),
    // o aviso guardado nao sai e o que esta na tela some
    var sayValid = null;
    var sayN = 0;   // cada fala pedida (inclusive a que espera o balao): o toque com ferramenta confere se foi respondido
    function say(text, ms, valid) {
      if (!text) return;
      sayN++;
      denyPend = false;
      sayEl.classList.remove('crz-saytop');   // w_chap: so a explicacao da marca tocada passa por cima da tela do fim
      sayValid = typeof valid === 'function' ? valid : null;
      // nv7: com balao do tutorial aberto o aviso preto espera (o balao pulava quando o aviso sumia)
      // A4: recusa (som de erro agora) e pergunta com botao passam mesmo com balao: o balao nao pula mais
      var denyNow = nowMs() - sndDenyAt < 40;
      if (!denyNow && ms !== ASK_MS && tutBalloonOn && tutBalloonOn()) { sayLater = { t: text, ms: ms, at: nowMs(), v: sayValid }; return; }
      sayEl.textContent = text;
      sayEl.classList.add('show');
      sayDeny = nowMs() - sndDenyAt < 40;
      // nunca parado mais de 4 s (jogador-so-tela 2026-11-09)
      sayUntil = nowMs() + (ms > 0 ? (ms === ASK_MS ? ms : Math.min(ms, 4000)) : clamp(1600 + text.length * 30, 2000, 4000));
    }

    ui.appendChild(top); ui.appendChild(bottom); ui.appendChild(sumEl); ui.appendChild(overEl); ui.appendChild(sheetEl); ui.appendChild(dayBanner);
    ui.appendChild(sayEl);
    // Undo visivel logo abaixo da faixa quando uma troca de sinal acaba de acontecer
    var swapUndoEl = tut(el('button', 'crz-sayundo gone', ''), 'swap-undo');
    swapUndoEl.textContent = STR.swapUndo;
    swapUndoEl.setAttribute('aria-label', STR.swapUndoAria);
    ui.appendChild(swapUndoEl);
    var swapUndoUntil = 0;
    function showSwapUndo(ms) { swapUndoUntil = nowMs() + ms; swapUndoEl.classList.remove('gone'); sayPillAvoid(swapUndoEl); }
    function hideSwapUndo() { swapUndoUntil = 0; swapUndoEl.classList.add('gone'); }
    // playtest cego 3 (090, 107, 139, 154): a pilula Undo/Cancel, centrada sob a faixa, cobria nos do mapa. Mesma
    // linha, mesmo desenho: so desliza para a esquerda ou a direita quando o centro cobre um no e um lado nao cobre
    function sayPillAvoid(pe) {
      try {
        pe.style.left = '';
        if (!render || typeof render.toScreen !== 'function' || !game.world || !game.world.nodes || !pe.getBoundingClientRect) return;
        var r = pe.getBoundingClientRect(), W = render.width || root.innerWidth || 390;
        if (!(r.width > 0)) return;
        var R = 14, w = r.width, k, nd, p, cands = [W / 2, W - 16 - w / 2, 16 + w / 2], i, best = null, bestN = Infinity;
        for (i = 0; i < cands.length; i++) {
          var l = cands[i] - w / 2, rr = cands[i] + w / 2, n = 0;
          for (k in game.world.nodes) if (game.world.nodes.hasOwnProperty(k)) {
            nd = game.world.nodes[k]; if (!nd) continue;
            p = render.toScreen(nd.x, nd.y);
            if (p.x + R > l && p.x - R < rr && p.y + R > r.top && p.y - R < r.bottom) n++;
          }
          if (n < bestN) { bestN = n; best = i; }
          if (!n) break;
        }
        if (best) pe.style.left = Math.round(cands[best]) + 'px';
      } catch (e) { warnOnce('sayPillAvoid', e); }
    }
    // Cancel do pedido de troca: mesmo lugar do Undo (abaixo da faixa), mais discreto (borda fina, texto suave)
    var swapCancelEl = tut(el('button', 'crz-sayundo crz-swapcancel gone', ''), 'swap-cancel');
    swapCancelEl.textContent = STR.swapCancelBtn;
    swapCancelEl.setAttribute('aria-label', STR.swapCancelAria);
    try { var scs = swapCancelEl.style; scs.borderWidth = '1.5px'; scs.borderColor = 'var(--inkSoft)'; scs.color = 'var(--inkText, #6b6b6b)'; scs.fontWeight = '600'; scs.minWidth = '76px'; } catch (e) {}
    ui.appendChild(swapCancelEl);
    function showSwapCancel() { hideSwapUndo(); swapCancelEl.classList.remove('gone'); sayPillAvoid(swapCancelEl); }
    function hideSwapCancel() { swapCancelEl.classList.add('gone'); }
    // w_guide: o botao da dica 'Played before?' (mesma pilula do Undo da troca de sinal, sob a faixa)
    var guideOffEl = tut(el('button', 'crz-sayundo gone', ''), 'guide-off'), guideHintUntil = 0;
    guideOffEl.textContent = STR.guideOffBtn;
    guideOffEl.setAttribute('aria-label', STR.guideOffAria);
    ui.appendChild(guideOffEl);
    function hideGuideHint() { guideHintUntil = 0; guideOffEl.classList.add('gone'); }
    // chip do Boost (dia 4+): botao de 56 px ao lado do no mais critico; toque = o mesmo Boost do mapa
    var bchipEl = tut(el('button', 'crz-bchip gone', svg(BOLT_ICON, '0 0 24 24') + '<span>' + STR.chipBoost + '</span>'), 'boost-chip');
    bchipEl.setAttribute('aria-label', STR.chipAria);
    ui.appendChild(bchipEl);
    // segundo no acima do limiar: chip menor, sem pulso (o pior continua com o chip grande)
    var bchip2El = tut(el('button', 'crz-bchip2 gone', svg(BOLT_ICON, '0 0 24 24')), 'boost-chip2');
    bchip2El.setAttribute('aria-label', STR.chipAria);
    ui.appendChild(bchip2El);
    // v2y: linha curta do chip ate o cruzamento, quando o chip tem de ficar longe dele (sem toque)
    var bleadEl = el('i', 'crz-blead gone');
    ui.insertBefore ? ui.insertBefore(bleadEl, bchipEl) : ui.appendChild(bleadEl);
    // chip "Pair lights" ao lado do semaforo tocado sem ferramenta (plano): parear e uma escolha, nunca um
    // efeito colateral de ler a dica de dois aneis
    var pairChipEl = tut(el('button', 'crz-pchip gone'), 'pair-chip');
    pairChipEl.textContent = STR.pairChip;
    pairChipEl.setAttribute('aria-label', STR.pairChipAria);
    ui.appendChild(pairChipEl);
    // ultimo dia: chip "Last day" ao lado das bolinhas dos dias (plano e corrida do dia 12)
    var lastChipEl = tut(el('span', 'crz-lastchip gone'), 'last-day');
    lastChipEl.textContent = STR.lastChip;
    dotsEl.appendChild(lastChipEl);
    (function walkStyle() {
      try {
        if (!doc.getElementById || doc.getElementById('crz-ui-walk3') || !doc.head) return;
        var sty = doc.createElement('style'); sty.id = 'crz-ui-walk3';
        sty.textContent = '.crz-pchip{position:absolute;left:0;top:0;width:' + PCHIP_W + 'px;height:' + PCHIP_H + 'px;border-radius:var(--r-pill);z-index:3;' +
          'background:var(--white);color:var(--ink);border:var(--bw-2) solid var(--ink);font-size:var(--fs-sm);font-weight:var(--fw-bold);padding:0 10px;' +
          'box-shadow:var(--shadow-1);pointer-events:auto;white-space:nowrap}' +
          '.crz-pchip.armed{background:var(--ink);color:var(--white)}' +
                    '.crz-lastchip{margin-left:6px;padding:2px 7px;border-radius:var(--r-pill);background:var(--red);color:var(--white);font-size:var(--fs-xs);' +
          'font-weight:var(--fw-bold);line-height:1.3;white-space:nowrap}' +
          '.crz-sclose{width:100%;font-size: var(--fs-md);line-height:1.35;font-weight: var(--fw-bold);color:var(--ink);text-align:center}';
        doc.head.appendChild(sty);
      } catch (e) {}
    })();
    // regiao viva oculta: anuncia eventos do jogo em ingles curto, sem repetir
    var srEl = el('div', 'crz-sr');
    srEl.setAttribute('aria-live', 'polite'); srEl.setAttribute('role', 'status');
    ui.appendChild(srEl);
    var srLast = '', srDay = -1, srStrikes = -1, srRing = 0, srOver = false;
    function announce(text) { if (text && text !== srLast) { srLast = text; srEl.textContent = text; } }
    function syncAnnounce(s) {
      // nivel do pior anel agora: 1 = ambar (0,3-0,6, 'Busy crossing'), 2 = vermelho (> 0,6 ou travado)
      var hot = 0, nn = game.world && game.world.nodes, q, lv;
      if (s.phase === 'run' && nn) {
        for (q in nn) if (nn.hasOwnProperty(q) && nn[q]) {
          lv = ringLevel(nn[q]); lv = lv === 'red' ? 2 : (lv === 'busy' ? 1 : 0);
          if (lv > hot) { hot = lv; if (hot === 2) break; }
        }
      }
      if (s.phase === 'over') {
        if (!srOver) { srOver = true; announce(s.final && s.final.win === false ? 'Crossing jammed' : (s.final && s.final.win ? 'You made it' : 'Crossing jammed')); }
        return;
      }
      srOver = false;
      if (s.strikes !== srStrikes) {
        if (srStrikes >= 0 && s.strikes > srStrikes) { srLast = ''; announce('Strike ' + s.strikes + ' of ' + (CFG.ironMode ? 1 : CFG.maxStrikes)); }
        srStrikes = s.strikes;
      }
      if (s.day !== srDay) { srDay = s.day; srRing = 0; if (s.phase === 'plan') { srLast = ''; announce('Day ' + s.day + ' started'); } }
      // anuncia ao surgir e ao escalar (ambar -> vermelho); a fila baixando nao anuncia
      if (hot > srRing) { srRing = hot; srLast = ''; announce(hot === 2 ? 'Red ring at a crossing' : 'Busy crossing'); }
      else if (!hot) srRing = 0;
    }
    rootEl.appendChild(ui);

    // ---- feedback ----
    function shake(node) {
      if (!node) return;
      node.classList.remove('shake');
      void node.offsetWidth;
      node.classList.add('shake');
      later(function () { node.classList.remove('shake'); }, 350);
    }
    var pend = { clear: false };
    // anel que pisca 2 vezes (CSS cuida do movimento reduzido)
    function pulseEl(node) {
      if (!node) return;
      node.classList.remove('pulse');
      void node.offsetWidth;
      node.classList.add('pulse');
      later(function () { node.classList.remove('pulse'); }, 2000);
    }
    function flash(x, y, kind) { try { if (render && render.flash) render.flash(x, y, kind); } catch (e) { warnOnce('render.flash', e); } }
    function result(r, x, y, okKind, tileId) {
      if (r && r.ok && game.state.phase === 'plan') camFreeze = true;
      if (r && r.ok) { snd(okKind); flash(x, y, okKind === 'build' ? 'build' : 'place'); return true; }
      snd('deny'); flash(x, y, 'bad');
      shake(tileId && tiles[tileId] ? tiles[tileId].el : null);
      return false;
    }
    // recusa de ferramenta com o motivo escrito (antes era so o som de erro)
    function toolResult(r, x, y, okKind, tool) {
      if (result(r, x, y, okKind, tool)) return true;
      var c; try { c = typeof game.cost === 'function' ? game.cost(tool) : undefined; } catch (e) { warnOnce('game.cost', e); }
      say(denyText(r, tool, game.state, CFG, c));
      if (r && NODE_TOOLS[tool]) {
        if (r.reason === 'cap') pulseValid('lightOwn', x, y);
        else if (r.reason === 'notjunction' || r.reason === 'same') pulseValid(tool, x, y);
      }
      if (r && r.reason === 'budget' && HAND_TOOLS[tool] && hasOnMap(tool)) pulsePlaced(tool);
      return false;
    }
    // calor de um no: pico do dia (state.hot, o anel tracejado) ou estresse agora
    function heatOf(s, n) { var h = (s && s.hot) || {}; return Math.max(+h[n.id] || 0, n.stress || 0); }
    // a memoria "nao repetir a dica de ontem" saiu (ela fazia o mesmo no mudar de dica sem mudar de estado)
    lsDel('gridlet.jamMemo');
    // a recomendacao do no no dia `day` (sem day: hoje), a mesma para anel, resumo e fim de jogo
    // memoria da dica por no (adviseVary): nunca a mesma dica 3 dias seguidos no mesmo no
    var adviceMemo = {};
    // sinais no comeco do plano: o que mudou desde entao foi posto hoje (o game devolve o custo na troca)
    var planTools = null;
    function toolSnap() {
      var out = {}, w = game.world, k;
      if (w && w.nodes) for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && w.nodes[k]) out[k] = w.nodes[k].tool || null;
      return out;
    }
    function adviceCtx(s, n, tomorrow) {
      var c = s.clear, fresh = false;
      if (!tomorrow && s.phase === 'plan' && n && n.tool && planTools) fresh = planTools[n.id] !== n.tool;
      var boost = !!(c && c.unlocked) && (tomorrow || (c.charges | 0) > 0);
      var lt = s.tools ? s.tools.filter(function (x) { return x.id === 'light'; })[0] : null;
      var room = lt && lt.cap != null ? (lt.used - (n && n.tool === 'light' ? 1 : 0)) < lt.cap : true;
      // v2x: o 'e se' do dia que acabou (resumo: calcula; manha seguinte: le o que o resumo guardou)
      var wi = null;
      if (n && typeof game.adviceFor === 'function' && (tomorrow || s.phase === 'plan')) { try { wi = game.adviceFor(n.id, true); } catch (e) { warnOnce('game.adviceFor', e); } }
      var card = false;
      try { card = !!(n && typeof game.choiceFor === 'function' && game.choiceFor(n.id)); } catch (e) { warnOnce('game.choiceFor', e); }
      // w_place (cego 11, dia 14, bug 3: 'A stop fits here' mandou a um Stop pior): a repeticao que o toque ainda vai calcular tambem
      // conta; a dica que nomeia uma peca so aponta para o cartao
      if (!card && n) { try { card = typeof game.canReplay === 'function' && game.canReplay(n.id); } catch (e) { warnOnce('game.canReplay', e); } }
      return { card: card, budget: s.budget | 0, fresh: fresh, boost: boost, kind: (s.kinds && n && s.kinds[n.id]) || null, lightRoom: room, lightCap: lt && lt.cap != null ? lt.cap : 0, wi: wi };
    }
    function nodeAdvice(s, n, day) {
      var d = day != null ? day : (s.day | 0), h = function (o) { return heatOf(s, o); };
      return adviseVary(adviceMemo, n, advise(n, d, CFG, game.world, h, adviceCtx(s, n, day != null && day > (s.day | 0))), d, CFG, game.world, h);
    }
    var WI_NODES = 2;
    // v2int (candidato a publicacao): o 'e se' do resumo em fatias (game.whatIfJob), fora do quadro do jogo. Antes o resumo
    // jogava ate 16 dias de novo num quadro so (583 ms a 4x de CPU freada no dia 20). Agora: comeca no fim do dia
    // (onPhase), anda WI_SLICE ms por tarefa com MessageChannel entre elas (o Safari nao tem requestIdleCallback), so na
    // fase do resumo (a conta do adviceFor le o mapa do dia que acabou). Saiu do resumo ou passou de WI_CAP ms de
    // relogio: o cruzamento que falta
    // fica com o conselho pelo tipo (o mesmo de sem 'e se'). Reload no meio: a manha de ontem nao esta mais na memoria,
    // o job nao existe e vale o conselho pelo tipo; nada fica esperando.
    var WI_SLICE = 12, WI_CAP = 5000, wiQ = null, wiPort = null;
    function wiIds(s) {
      var w = game.world, h = s.hot || {}, L = [], k;
      for (k in h) if (h.hasOwnProperty(k) && w.nodes[k] && !w.nodes[k].portal && degOf(w.nodes[k]) >= 3 && +h[k] >= HOT_TAP) L.push(+k);
      L.sort(function (a, b) { return (+h[b] - +h[a]) || (a - b); });
      L = L.slice(0, WI_NODES);
      var wn = worstNode(s, w);
      if (wn && !wn.portal && degOf(wn) >= 3 && L.indexOf(wn.id) < 0) L.push(wn.id);
      return L;
    }
    function wiStart(s) {
      wiQ = null;
      if (typeof game.whatIfJob !== 'function' || lastDayOf(s)) return;
      var ids = wiIds(s), jobs = [], i, j;
      for (i = 0; i < ids.length; i++) { j = null; try { j = game.whatIfJob(ids[i]); } catch (e) { warnOnce('game.whatIfJob', e); } if (j) jobs.push(j); }
      wiQ = { day: s.day | 0, jobs: jobs, i: 0, t0: nowMs(), t1: 0, done: false, stop: null, kicked: false, slices: 0, maxSlice: 0, fresh: false };
      dawnInit(wiQ, s, ids); dawnAm.day = (s.day | 0) + 1;
      wiAdvance();
      if (!wiQ.done) wiKick();
    }
    // w_choice2: o 'e se' de um anel que o resumo nao calculou (a fila do resumo leva os 2 mais quentes e o pior): o toque de
    // manha comeca o mesmo trabalho em fatias (game.whatIfJob com fromPlan) e o cartao se enche quando ele termina
    function wiAdd(id) {
      if (typeof game.whatIfJob !== 'function') return false;
      var j = null, q = wiQ, k;
      try { j = game.whatIfJob(id, false, true); } catch (e) { warnOnce('game.whatIfJob', e); }
      if (!j) return false;
      if (j.done) return true;
      j.tap = true;   // w_dawn: the tapped crossing runs to the end (wall cap from the tap), outside the background budget
      if (!q || q.done) { q = wiQ = { day: j.day, jobs: [], i: 0, t0: nowMs(), t1: 0, done: false, stop: null, kicked: false, slices: 0, maxSlice: 0, fresh: false, cap: 6000 }; }
      else { q.t0 = nowMs(); q.cap = 6000; }
      // o anel que a jogadora tocou passa a frente da fila (os jobs andam em fatias e guardam o proprio estado): antes ele esperava
      // todos os da fila do resumo e os ramos a mais, e o cartao ficava ~3 s em 'Replaying yesterday here...' (cego 11, dia 26)
      for (k = q.i; k < q.jobs.length; k++) if (q.jobs[k].id === id && !q.jobs[k].relief) { q.jobs[k].tap = true; qFront(q, k); return true; }
      q.jobs.splice(q.i, 0, j); wiKick();
      return true;
    }
    // w_noopt2: o trabalho k da fila passa para o lugar do que roda agora (os trabalhos sao independentes: cada um guarda seu estado)
    function qFront(q, k) { if (k > q.i) { var jb = q.jobs.splice(k, 1)[0]; q.jobs.splice(q.i, 0, jb); } }
    // w_noopt: os ramos a mais (game.reliefJob) de um cruzamento cujo cartao nao tem peca 'better'; no maximo um por cruzamento na fila
    function reliefQueue(q, id, front) {
      if (typeof game.reliefJob !== 'function' || typeof game.choiceFor !== 'function') return false;
      var c = null, j = null, k;
      try { c = game.choiceFor(id); } catch (e) { warnOnce('game.choiceFor', e); }
      if (!c || !c.dead || c.relief !== 'pending') return false;
      for (k = q.i; k < q.jobs.length; k++) if (q.jobs[k].id === id && q.jobs[k].relief) { if (front) qFront(q, k); return true; }
      try { j = game.reliefJob(id); } catch (e) { warnOnce('game.reliefJob', e); }
      if (!j || j.done) return !!j;
      j.relief = true;
      if (front) q.jobs.splice(q.i, 0, j); else q.jobs.push(j);
      return true;
    }
    function reliefAdd(id) {
      var q = wiQ;
      if (!q || q.done) { q = { day: (game.state.day | 0) - 1, jobs: [], i: 0, t0: nowMs(), t1: 0, done: false, stop: null, kicked: false, slices: 0, maxSlice: 0, fresh: false, cap: 6000 }; if (!reliefQueue(q, id, true) || !q.jobs.length) return false; wiQ = q; }
      else { if (!reliefQueue(q, id, true)) return false; q.t0 = nowMs(); q.cap = 6000; }
      if (q.jobs[q.i] && q.jobs[q.i].id === id) q.jobs[q.i].tap = true;
      wiKick();
      return true;
    }
    // o anel que a jogadora tocou ja esta na fila (o resumo o levou): passa a frente, os jobs guardam o proprio estado
    function wiFront(id) {
      var q = wiQ, k; if (!q || q.done) return;
      for (k = q.i; k < q.jobs.length; k++) if (q.jobs[k].id === id && !q.jobs[k].relief) {
        if (!q.jobs[k].tap) { q.jobs[k].tap = true; q.t0 = nowMs(); q.cap = 6000; }   // w_dawn: the wall cap counts from the tap
        if (k > q.i) q.jobs.splice(q.i, 0, q.jobs.splice(k, 1)[0]);
        return;
      }
    }
    function wiPending(id) {
      if (!wiQ || wiQ.done) return false;
      for (var i = wiQ.i; i < wiQ.jobs.length; i++) if (wiQ.jobs[i].id === id) return true;
      return false;
    }
    function wiAdvance() {
      var q = wiQ;
      while (q.i < q.jobs.length && q.jobs[q.i].done) {
        var jb = q.jobs[q.i++];
        if (jb.branches) q.fresh = true;
        // w_dawn: a crossing the summary did not pick (quiet, or a ring past the first two): no advice memory here (the tap reads it
        // as before) and its relief branches wait until every crossing has its rows
        if (jb.bg && !jb.tap) { if (jb.r && !jb.relief && q.relLater) q.relLater.push(jb.id); continue; }
        // a memoria do conselho (state.adv) sai agora, como no resumo de antes
        try { if (jb.r && !jb.relief) game.adviceFor(jb.id, true); } catch (e) { warnOnce('game.adviceFor', e); }
        // w_noopt: cartao sem peca 'better': os ramos a mais entram na mesma fila (a manha ja sabe se o anel tem o que oferecer)
        if (jb.r && !jb.relief) reliefQueue(q, jb.id, choiceOpen() && scId === jb.id);
      }
      // w_dawn: the summary's worst crossing line does not wait for the background crossings
      if (jamWait && !wiPending(jamWaitId)) { var s0 = game.state; if (s0.phase === 'summary') paintJam(s0); jamWait = false; }
      if (q.i >= q.jobs.length && !dawnLeft(q)) wiEnd(null);
    }
    function wiEnd(why) {
      var q = wiQ; if (!q || q.done) return;
      q.done = true; q.stop = why || q.stop || null; q.t1 = nowMs();
      var s = game.state;
      if (jamWait && s.phase === 'summary') paintJam(s);
      jamWait = false;
      if (q.fresh && (s.phase === 'summary' || s.phase === 'plan')) saveNow();
    }
    function wiKick() {
      var q = wiQ; if (!q || q.done || q.kicked) return;
      q.kicked = true;
      if (!wiPort && typeof MessageChannel === 'function') {
        try { var mc = new MessageChannel(); mc.port1.onmessage = wiRun; if (mc.port1.unref) mc.port1.unref(); if (mc.port2.unref) mc.port2.unref(); wiPort = mc.port2; } catch (e) { wiPort = null; }
      }
      if (wiPort) { try { wiPort.postMessage(0); return; } catch (e) { wiPort = null; } }
      root.setTimeout(wiRun, 0);
    }
    function wiRun() {
      var q = wiQ; if (!q) return;
      q.kicked = false;
      if (destroyed || q.done) return;
      var s = game.state;
      // w_choice: quem passou do resumo para a manha com o 'e se' ainda andando nao o perde: os ramos nao leem o plano
      // (o trabalho guarda o save de ontem), entao seguem em fatias ate o fim ou o WI_CAP, e o cartao do anel enche
      var inSum = s.phase === 'summary' && (s.day | 0) === q.day, inMorn = s.phase === 'plan' && (s.day | 0) === q.day + 1;
      if (!inSum && !inMorn) { wiEnd('phase'); return; }
      var job = q.jobs[q.i], t = nowMs();
      // w_dawn: no frame for a second (page hidden, app in the background): background replays wait for the next frame
      if ((!job || !job.tap) && q.later && t - uiBeat > 1000) { q.idle = true; return; }
      // w_dawn: the plan opening (city growth, camera, die) is the heaviest frame of the morning: background slices keep out of it
      if ((!job || !job.tap) && q.later && uiPhaseFr < DAWN_GAP) { q.kicked = true; root.setTimeout(function () { q.kicked = false; wiKick(); }, 50); return; }
      // w_dawn: past the background budget only the tapped jobs stay; the next background crossing is made in a slice of its own
      if ((!job || !job.tap) && q.later && (q.spent >= q.budget || nowMs() - q.w0 > (DAWN.wallMs || 30000))) { dawnDrop(q); wiAdvance(); if (!q.done) wiKick(); return; }
      if (!job) {
        var nx = dawnNext(q);
        if (nx === 'wait') { q.kicked = true; root.setTimeout(function () { q.kicked = false; wiKick(); }, 250); return; }
        if (!nx) { wiEnd(null); return; }
        dt = nowMs() - t; q.slices++; q.spent += dt; if (dt > q.maxSlice) q.maxSlice = dt;
        wiKick(); return;
      }
      if ((job.tap || !q.later) && nowMs() - q.t0 > (q.cap || WI_CAP)) { wiEnd('cap'); return; }
      try { job.run(WI_SLICE, nowMs); } catch (e) { warnOnce('game.whatIfJob', e); job.done = true; job.r = null; }
      var dt = nowMs() - t; q.slices++; if (dt > q.maxSlice) q.maxSlice = dt;
      if (!job.tap && q.later) q.spent += dt;
      wiAdvance();
      if (!q.done) wiKick();
    }
    // w_dawn: the summary replayed only the 2 hottest rings and the worst crossing, so about 3 crossings in 4 that carried cars had no
    // replay at dawn and the first armed tap there always opened a pending card. Now every crossing that carried cars yesterday follows
    // in the same queue (q.later, made one job at a time), in the order a tap is likely: the other rings (hottest first), the
    // crossings where a piece went in yesterday (st.marks), then by cars yesterday. It runs in the same slices as before, only in the
    // summary and the next plan (the day running ends it), inside a budget of slice time (CFG.dawnReplay.cpuMs; the tapped crossing is
    // outside it and still jumps to the front). A crossing removed or no longer replayable when its turn comes is skipped; one that
    // already has its replay or is already queued is never made twice. After a reload in the plan the same queue starts by itself
    // (CFG.dawnReplay.reloadMs after the plan shows) for what the save does not have.
    var DAWN = CFG.dawnReplay || {}, dawnAm = { day: -1, at: 0 }, jamWaitId = null, uiBeat = nowMs(), uiPhase = null, uiPhaseFr = 99, DAWN_GAP = 6;   // DAWN_GAP: frames
    function dawnIds(s, skip) {
      var w = game.world, h = s.hot || {}, kd = s.kinds || {}, mk = {}, L = [], k, M = s.marks && s.marks.list ? s.marks.list : [];
      for (k = 0; k < M.length; k++) if (M[k]) mk[M[k].id] = 1;
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && w.nodes[k] && !w.nodes[k].portal && degOf(w.nodes[k]) >= 3 && kd[k] && kd[k].v >= 1 && !(skip && skip.indexOf(+k) >= 0)) L.push(+k);
      function cls(id) { return +h[id] >= HOT_TAP ? 0 : (mk[id] ? 1 : 2); }
      L.sort(function (a, b) { return (cls(a) - cls(b)) || (cls(a) === 0 ? (+h[b] - +h[a]) : 0) || ((kd[b].v || 0) - (kd[a].v || 0)) || (a - b); });
      return L;
    }
    function dawnInit(q, s, skip) {
      q.later = DAWN.cpuMs > 0 ? dawnIds(s, skip) : []; q.relLater = []; q.spent = 0; q.budget = DAWN.cpuMs > 0 ? DAWN.cpuMs : 0; q.ready = 0; q.w0 = nowMs();
    }
    function dawnLeft(q) { return !!(q.later && (q.later.length || q.relLater.length) && q.spent < q.budget); }
    function dawnDrop(q) {
      q.later.length = 0; q.relLater.length = 0;
      for (var k = q.jobs.length - 1; k >= q.i; k--) if (!q.jobs[k].tap) q.jobs.splice(k, 1);
      if (!q.stop) q.stop = 'budget';
    }
    // the next background job (in the plan, making it loads yesterday's morning: a slice of its own, never inside another)
    function dawnNext(q) {
      var s = game.state, id, n, j;
      while (q.later.length) {
        id = q.later.shift(); n = game.world.nodes[id]; j = null;
        if (!n || n.portal || degOf(n) < 3 || wiPending(id)) continue;
        try { if (!game.canReplay(id)) continue; j = s.phase === 'plan' ? game.whatIfJob(id, false, true) : game.whatIfJob(id); } catch (e) { warnOnce('game.whatIfJob', e); }
        if (!j || j.done) continue;
        j.bg = true; q.jobs.push(j); q.ready++;
        return true;
      }
      // relief rows check their road on today's map (the city grows at night): made in the plan, never in the summary, so the card is
      // the one the morning tap would make (summary-made relief of a crossing could miss a road that is legal only today)
      if (q.relLater.length && s.phase !== 'plan') return 'wait';
      while (q.relLater.length) {
        id = q.relLater.shift(); n = game.world.nodes[id];
        if (!n || wiPending(id)) continue;
        var m = q.jobs.length; reliefQueue(q, id, false);
        if (q.jobs.length > m) { q.jobs[q.jobs.length - 1].bg = true; return true; }
      }
      return false;
    }
    // after a reload in the plan (the page opened on a saved plan, no summary ran in it): the same background queue, once, when no other runs
    function dawnTick(s) {
      if (s.phase !== 'plan' || !(DAWN.cpuMs > 0) || typeof game.whatIfJob !== 'function' || !game.resumed) return;
      var d = s.day | 0;
      if (dawnAm.first === undefined) dawnAm.first = d;   // only the morning the page opened on (later mornings come from a summary)
      if (dawnAm.day === d || dawnAm.first !== d) return;
      if (wiQ && !wiQ.done) return;
      if (dawnAm.wait !== d) { dawnAm.wait = d; dawnAm.at = nowMs(); }
      if (nowMs() - dawnAm.at < (DAWN.reloadMs | 0)) return;
      dawnAm.day = d;
      var q = { day: d - 1, jobs: [], i: 0, t0: nowMs(), t1: 0, done: false, stop: null, kicked: false, slices: 0, maxSlice: 0, fresh: false, dawn: true };
      dawnInit(q, s, null);
      if (!q.later.length) return;
      wiQ = q; wiKick();
    }
    function tapAdvice(s, n) { var a = nodeAdvice(s, n); if (a) showAdviceRoad(a); return a ? a.text : ''; }
    // conselho de segunda faixa: destaca no mapa a rua mais ocupada do no (o texto nao diz ponto cardeal).
    // Feature-detect: render.highlightRoad(edgeId, ms) pode nao existir num render mais antigo
    function showAdviceRoad(a) {
      // v2x: conselho do Yield: a rua principal acende enquanto o conselho esta aberto (o texto diz 'the lit road')
      if (a && a.main && render && typeof render.highlightRoad === 'function') {
        try { a.main.forEach(function (eid) { render.highlightRoad(eid, 4000); }); } catch (e) { warnOnce('render.highlightRoad', e); }
        return;
      }
      if (!a || a.tool !== 'upgrade' || a.edge == null) return;
      if (render && typeof render.highlightRoad === 'function') { try { render.highlightRoad(a.edge, 2000); } catch (e) { warnOnce('render.highlightRoad', e); } }
    }
    // ferramenta de cruzamento na mao: os lugares que a aceitam pulsam (ate 6), uma vez por escolha
    function pulseCandidates(id, dry) {
      if (!NODE_TOOLS[id] || game.state.phase !== 'plan') return 0;
      var w = game.world, k, n, c = 0, need = id === 'cross' ? 2 : 3;
      // w_light: o semaforo chega cedo (dia 5) e um cruzamento calmo com semaforo faz carro esperar no vermelho. O pulso
      // vai aos cruzamentos que acenderam ontem (os mais quentes, ate 2); sem anel, ao de mais carros ontem (state.kinds v).
      // Medido (v2/_scripts/w_light/diag_busy.js): o novato que segue o pulso vence 53% no Normal contra 35% ao acaso
      if (id === 'light') {
        var h = game.state.hot || {}, kd = game.state.kinds || {}, L = [], best = null;
        for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) {
          n = w.nodes[k];
          if (!n || n.portal || n.tool === 'light' || degOf(n) < 3) continue;
          if (+h[k] >= RING_EVER_AT) L.push(n);
          else if (kd[k] && kd[k].v > 0 && (!best || kd[k].v > kd[best.id].v)) best = n;
        }
        L.sort(function (a, b) { return (+h[b.id] - +h[a.id]) || (a.id - b.id); });
        if (!L.length && best) L.push(best);
        for (c = 0; c < L.length && c < 2; c++) if (!dry) addPulse(L[c].x, L[c].y);
        return c;
      }
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && c < 6) {
        n = w.nodes[k];
        if (!n || n.portal || n.tool || degOf(n) < need) continue;
        if (!dry) addPulse(n.x, n.y);
        c++;
      }
      return c;
    }
    // ---- guia 'Tools & buttons' (botao '?' ao lado da bandeja e item do menu): so o que ja foi liberado ----
    var guideEl = null, guidePaused = false;
    var MAP_SVG = {
      car: '<rect x="7" y="8" width="10" height="8" rx="1" fill="#3d4f66"/>',
      arrows: '<line x1="2" y1="12" x2="22" y2="12" stroke="#111" stroke-width="2"/><path d="M14 8l4 4-4 4M8 8l4 4-4 4" fill="none" stroke="#888" stroke-width="1.8"/>',
      end: '<circle cx="12" cy="12" r="9" fill="none" stroke="#ccc" stroke-width="1.2"/><circle cx="12" cy="12" r="4" fill="#fff" stroke="#111" stroke-width="2"/>',
      cross: '<line x1="2" y1="12" x2="22" y2="12" stroke="#111" stroke-width="2"/><line x1="12" y1="2" x2="12" y2="12" stroke="#111" stroke-width="2"/><circle cx="12" cy="12" r="2.2" fill="#111"/>',
      boost: '<circle cx="12" cy="12" r="8" fill="none" stroke="#2f8f55" stroke-width="2.4" stroke-dasharray="5 3.5"/>'
    };
    var MARK_SVG = {
      amber: '<circle cx="12" cy="12" r="8" fill="none" stroke="#d98a00" stroke-width="2.4" stroke-dasharray="4 3"/>',
      red: '<circle cx="12" cy="12" r="8" fill="none" stroke="#d9261c" stroke-width="2.6"/>',
      hot: '<circle cx="12" cy="12" r="8" fill="none" stroke="#6b7a8f" stroke-width="1.4" stroke-dasharray="3 3"/>',
      'new': '<circle cx="12" cy="12" r="8" fill="none" stroke="#7a6aa8" stroke-width="2" stroke-dasharray="0.1 3.4" stroke-linecap="round"/>',
      days: '<circle cx="5" cy="12" r="2.4" fill="#111"/><circle cx="12" cy="12" r="3.2" fill="#d9261c"/><circle cx="19" cy="12" r="2.4" fill="none" stroke="#555" stroke-width="1"/>',
      strikes: '<circle cx="7" cy="12" r="4" fill="#d9261c"/><circle cx="17" cy="12" r="4" fill="none" stroke="#111" stroke-width="1.4"/>',
      points: '<circle cx="7" cy="12" r="3.5" fill="#111"/><circle cx="17" cy="12" r="3.5" fill="none" stroke="#111" stroke-width="1.4"/>'
    };
    function gRow(iconHtml, name, lines) {
      var r = el('div', 'crz-grow'), ic = el('div', 'crz-gic'), tx = el('div', 'crz-gtx'), b = el('b');
      ic.innerHTML = iconHtml; ic.setAttribute('aria-hidden', 'true');
      b.textContent = name; tx.appendChild(b);
      lines.forEach(function (l) { if (l) { var d = el('div'); d.textContent = l; tx.appendChild(d); } });
      r.appendChild(ic); r.appendChild(tx); return r;
    }
    function openGuide() {
      if (guideEl) return;
      var s = game.state, i, t;
      guideEl = el('div', 'crz-guide');
      guideEl.setAttribute('role', 'dialog'); guideEl.setAttribute('aria-modal', 'true'); guideEl.setAttribute('aria-label', STR.guideTitle);
      var box = el('div', 'crz-gbox'), head = el('div', 'crz-ghead'), h = el('h2'), x = el('button', 'crz-gx', '\u00d7');
      h.textContent = STR.guideTitle; x.setAttribute('aria-label', STR.guideClose);
      head.appendChild(h); head.appendChild(x); box.appendChild(head);
      var body = el('div', 'crz-gbody'); body.setAttribute('data-scroll', '');
      function sec(title) { var hh = el('h3'); hh.textContent = title; body.appendChild(hh); }
      sec(STR.guideTools);
      for (i = 0; s.tools && i < s.tools.length; i++) {
        t = s.tools[i]; if (!t.unlocked) continue;   // ferramenta ainda nao apresentada nao aparece
        var c = CFG.tools[t.id] ? listPrice(t.id) : t.cost;   // w_price: preco de tabela de hoje (capitulo)
        // 'Works best with Two lanes' so quando Two lanes ja existe
        var wk = STR.toolWorks[t.id];
        if (t.id === 'light' && !toolOpen(CFG, 'upgrade', s.day | 0)) wk = STR.toolWorksLightEarly;
        var gl = [STR.toolUseLine[t.id], wk];
        if (t.id === 'light' && CFG.upkeep && CFG.upkeep.perLight > 0) gl.push(STR.guideUpkeep(CFG.upkeep.fromDay, CFG.upkeep.perLight));   // v2
        if (t.id === 'light' && t.cap != null && isFinite(t.cap)) gl.push(STR.guideCap(t.cap, ((CFG.lightCap && CFG.lightCap.byDay) || []).some(function (x) { return x[0] > (s.day | 0); })));   // v2m; w_light: 'more later' so com degrau a frente
        body.appendChild(gRow(toolIcon(t.id), (STR.tools[t.id] || t.id) + ' \u00b7 ' + c + (c === 1 ? ' point' : ' points'), gl));
      }
      var more = el('div', 'crz-gmore'); more.textContent = STR.guideMore; body.appendChild(more);
      sec(STR.guideButtons);
      // copy review c: Play, Boost e Whole map com o mesmo desenho do botao (SVG), nunca o caractere
      var GSYM = { '@play': PLAY_ICON, '@bolt': BOLT_ICON, '@fit': FIT_ICON };
      STR.guideBtnRows.forEach(function (r) { body.appendChild(gRow('<span class="crz-gsym">' + (GSYM[r[0]] ? svg(GSYM[r[0]], '0 0 24 24') : r[0]) + '</span>', r[1], [r[2]])); });
      // 'On the map': os simbolos que aparecem no mapa, com o mesmo desenho
      sec(STR.guideMap);
      STR.guideMapRows.forEach(function (r) { body.appendChild(gRow(svg(MAP_SVG[r[0]] || '', '0 0 24 24'), r[1], [r[2]])); });
      sec(STR.guideMarks);
      STR.guideMarkRows.forEach(function (r) { body.appendChild(gRow(svg(MARK_SVG[r[0]] || '', '0 0 24 24'), r[1], [r[2]])); });
      sec(STR.guideCards);
      // so cartas de coisas ja apresentadas (nv7: 'Free traffic light' e 'Double green wave' no dia 2)
      var lightOn = toolOpen(CFG, 'light', s.day | 0);
      Object.keys(STR.cards).forEach(function (id) {
        if (RETIRED[id]) return;
        if (id === 'freeLight' && !lightOn) return;
        if (id === 'patient' && !ringEver) return;
        body.appendChild(gRow(cardIcon(id), STR.cards[id], [STR.cardLine[id]]));
      });
      box.appendChild(body); guideEl.appendChild(box);
      ui.appendChild(guideEl);
      on(x, 'click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); closeGuide(); });
      on(guideEl, 'click', function (e) { if (e && e.target === guideEl) closeGuide(); });
      if (doc.body && doc.body.classList) doc.body.classList.add('crz-guide-on');
      modalReg().set(doc.body, 'guide', true);
      guidePaused = s.phase === 'run' && !s.paused && typeof game.setPaused === 'function';
      if (guidePaused) { try { game.setPaused(true); } catch (e) { warnOnce('game.setPaused', e); } }
      emitUI('guideOpen', {});
    }
    function closeGuide() {
      if (!guideEl) return;
      // polimento 3: o no sai do DOM na hora (fechado = fora da arvore, sem toque); uma copia muda, aria-hidden e
      // sem toque, desce 12 px e some em 160 ms. Sem cloneNode (teste) ou com movimento reduzido: corte seco
      var gpar = guideEl.parentNode;
      if (gpar) {
        try {
          if (typeof guideEl.cloneNode === 'function' && canCount()) {
            var ghost = guideEl.cloneNode(true);
            ghost.className = 'crz-guide crz-leaving';
            ghost.setAttribute('aria-hidden', 'true'); ghost.removeAttribute('role'); ghost.removeAttribute('aria-modal'); ghost.removeAttribute('aria-label');
            gpar.insertBefore(ghost, guideEl);
            later(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 200);
          }
        } catch (e) {}
        gpar.removeChild(guideEl);
      }
      guideEl = null;
      // M2/B3 c: o guia tira so a propria posse; a classe fica se o menu, o dado ou o tutorial ainda a seguram
      if (doc.body && doc.body.classList) doc.body.classList.remove('crz-guide-on');
      modalReg().set(doc.body, 'guide', false);
      if (guidePaused) { guidePaused = false; try { game.setPaused(false); } catch (e) { warnOnce('game.setPaused', e); } }
      emitUI('guideClose', {});
    }
    function legendText(id) {
      var c; try { c = typeof game.cost === 'function' ? game.cost(id) : undefined; } catch (e) { warnOnce('game.cost', e); }
      if (typeof c !== 'number') c = CFG.tools[id] ? listPrice(id) : 0;
      return STR.legend(STR.tools[id] || id, c, STR.toolUseLine[id] || '');
    }
    function legendAfford(id) { try { return !game.canAfford || game.canAfford(id) !== false; } catch (e) { return true; } }
    // playtest cego 3 (031): o cartao do tutorial da ferramenta ('tool:stop') e a legenda da mesma ferramenta
    // empilhados com o mesmo texto. A legenda espera o cartao fechar (nao some: volta logo depois do 'Got it')
    function legendHeld() {
      if (!sel || !tutBalloonOn()) return false;
      return tutorStep() === 'tool:' + sel;
    }
    function syncLegend() {
      // blind3 2: ferramenta que nao cabe no orcamento: sem legenda (o aviso de pontos ja diz)
      var on = !!sel && game.state.phase === 'plan' && !!STR.toolUseLine[sel] && legendAfford(sel) && !legendHeld();
      if (on) legendEl.textContent = legendText(sel);
      legendEl.classList.toggle('gone', !on);
      bottom.classList.toggle('crz-legendon', on);
    }
    function setSel(id, noPulse) {
      var prev = sel;
      sel = id;
      if (prev && prev !== id) emitUI('toolDeselected', { tool: prev });
      if (id && id !== prev) { emitUI('toolSelected', { tool: id }); if (!noPulse) pulseCandidates(id); }
      syncLegend();
      // Escolher ferramenta NUNCA reenquadra (passeio humano 2026-11-09: a camera andava depois de pegar a
      // ferramenta; antes a Rua chamava fitRoom e qualquer ferramenta chamava settle, que salta para o fim da
      // animacao). Agora a animacao em curso so para onde esta (render.stop): nada anda sob o polegar.
      // O unico reenquadramento da Rua e no comeco do arrasto, com a origem fora da area util (roadStart).
      if (id && id !== prev && game.state.phase === 'plan' && render) {
        try { if (render.stop) render.stop(); } catch (e) { warnOnce('render.stop', e); }
      }
      var o = ov(); if (o) { o.hoverTool = id; if (id && !holding) { o.showInfluence = null; infTimer = 0; } }
      if (id !== prev) lightArm = null;
      pairFirst = null; pairArm = null; pairRep = null; hidePairChip(); endSwapAsk(id !== prev ? 'tool' : null); syncSelectedNode();
      if (hint && hint.toolId === id) hint.tile = false;
    }
    // destaque no mapa: o semaforo que vai parear (armado) ou o tocado com o chip "Pair lights"
    function syncSelectedNode() { var o = ov(); if (o) o.selectedNode = pairArm ? pairArm.from : pairFirst; }
    // toque no mapa neste turno de plano (zera ao entrar no plano): depois dele a camera nao reenquadra sozinha
    var mapTouched = false, pickHintDay = -1;
    // o no esta na area util da tela (fora do HUD, a 24 px das bordas)?
    function originOnScreen(n) {
      var W = render.width || 0, H = render.height || 0;
      if (!n || !W || !H || !render.toScreen) return true;
      var m = render.margins || {}, PAD = 24, p = render.toScreen(n.x, n.y);
      // laterais no retrato: fitView (render.js, PORT_SIDE_PX = 36) poe o no da borda a 36 px da borda da TELA, dentro
      // da faixa antiga margem 28 + 24 = 52; aqui vale a tela menos 24 px (< 36), senao a camera anda sob o dedo ao
      // comecar a rua num no da borda. Paisagem e topo/base (faixas do HUD) como antes
      var sl = H > W ? PAD : (m.left || 0) + PAD, sr = H > W ? PAD : (m.right || 0) + PAD;
      return p.x >= sl && p.x <= W - sr && p.y >= (m.top || 0) + PAD && p.y <= H - (m.bottom || 0) - PAD;
    }
    // o no mais perto do polegar (centro do ladrilho; sem ladrilho, meio da base) esta na tela e fora do HUD?
    function originVisible(tileEl) {
      var w = game.world, W = render.width || 0, H = render.height || 0;
      if (!w || !w.nodes || !W || !H || !render.toScreen) return false;
      var m = render.margins || {}, PAD = 24, tr = tileEl ? rectOf(tileEl) : null;
      var tx = tr ? (tr.l + tr.r) / 2 : W / 2, ty = tr ? (tr.t + tr.b) / 2 : H;
      var q, n, p, best = null, bd = Infinity, d;
      for (q in w.nodes) if (w.nodes.hasOwnProperty(q)) {
        n = w.nodes[q]; if (!n) continue;
        p = render.toScreen(n.x, n.y);
        d = (p.x - tx) * (p.x - tx) + (p.y - ty) * (p.y - ty);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) return false;
      return best.x >= (m.left || 0) + PAD && best.x <= W - (m.right || 0) - PAD &&
        best.y >= (m.top || 0) + PAD && best.y <= H - (m.bottom || 0) - PAD;
    }
    // retangulo do canvas lido uma vez por toque (pointerdown), nunca a cada pointermove
    var crect = { left: 0, top: 0 };
    function readRect() {
      try { var r = canvas.getBoundingClientRect(); crect = { left: r.left || 0, top: r.top || 0 }; } catch (x) {}
    }
    function localXY(e) {
      return { x: e.clientX - crect.left, y: e.clientY - crect.top };
    }
    function edgePoint(pk) {
      var w = game.world, a = w.nodes[pk.edge.a], b = w.nodes[pk.edge.b];
      if (!a || !b) return { x: 0, y: 0 };
      return { x: a.x + (b.x - a.x) * pk.t, y: a.y + (b.y - a.y) * pk.t };
    }

    // ---- gestos ----
    var handlers = {
      hitNode: function (x, y) { return render.pickNode(x, y); },
      // blind3 2: com a Rua na mao, de qualquer ponto; de mao vazia, arrastar de uma PONTA DE RUA tambem constroi
      // (se a rua cabe no orcamento), em todos os dias
      canRoad: function (node) {
        if (game.state.phase !== 'plan') return false;
        if (tapInCamAnim) return false;   // lupa: o dedo desceu com a camera da lupa andando; nenhuma rua sai dali
        if (sel === 'road') return true;
        return !sel && !!node && isEnd(node) && !!(game.canAfford && game.canAfford('road'));
      },
      roadBroke: function (node) {
        if (sel || game.state.phase !== 'plan' || !isEnd(node) || !game.canAfford || game.canAfford('road')) return false;
        snd('deny'); say(roadSayText('budget')); return true;
      },
      // dias 1 a 3 (cidade pequena): um dedo nao arrasta o mapa; o enquadrar e dois dedos continuam
      lockPan: function () { var s = game.state; return (s.day | 0) >= 1 && (s.day | 0) <= panLockN() && (s.phase === 'plan' || s.phase === 'run'); },
      // o aviso de 'escolha New road' (arrasto numa ponta sem ferramenta) tem a vez; senao, uma vez, como mover
      // blind3 2/6: um dedo no vazio nos dias 1-3 nao move o mapa; so fala quando ha cidade fora da tela (com o enquadrar)
      panLocked: function () { if (!panLockSaid && !sayUntil && !tutorTalking() && cityCut()) { panLockSaid = true; say(STR.panHint); pulseEl(fitBtn); } },
      canHold: function () { return !sel; },
      // ponto ao lado do dedo (ate 1,7x o raio de toque): com a Rua na mao, o arrasto sai dele
      nearNode: function (x, y) { return nearDot(x, y, 1.7); },
      // Rua na mao, mas fora do planejamento: diz o motivo (o gesto vira pan)
      roadDenied: function () {
        if (sel !== 'road' || game.state.phase === 'plan') return false;
        say(STR.deny.phase); return true;
      },
      pan: function (dx, dy) { userMoved = true; camFreeze = false; render.pan(dx, dy); },
      // dia 1, mao vazia: arrasto que comeca numa rua ou num ponto so mexia o mapa, calado (passeio humano
      // 2026-11-09). Diz como construir e pulsa o ladrilho da Rua, uma vez por dia
      panStart: function (x, y, node) {
        var s = game.state;
        if (sel || s.phase !== 'plan' || (s.day | 0) !== 1 || pickHintDay === s.day || tutorTalking()) return;
        if (!node && !(render.pickEdge && render.pickEdge(x, y))) return;
        pickHintDay = s.day;
        say(STR.roadPickFirst);
        if (tiles.road) pulseEl(tiles.road.el);
        emitUI('roadPickHint', {});
      },
      zoom: function (f, cx, cy) { userMoved = true; camFreeze = false; render.zoomAt(f, cx, cy); },
      tap: onTapAnswered,
      // lupa: arrasto de rua a partir de um ponto ambiguo so aproxima, ao soltar (ver magPlan)
      magAt: function (x, y) { return !tapInCamAnim && !!magPlan(x, y, true); },
      magTap: function (x, y) { var mp = magPlan(x, y, true); if (mp) magZoom(x, y, mp); },
      roadStart: function (node) {
        roadSug = null;   // w_noopt: arrastar desenha outra rua no lugar da sugerida
        roadFrom = node.id; ghost = null; snd('select');
        // unico reenquadramento da Rua: a origem do arrasto esta fora da area util (sob o HUD ou rente a borda).
        // Anda o minimo, sem animacao, para ela aparecer (reveal com force: vale mesmo com a camera segura no gesto)
        if (render && render.reveal && !originOnScreen(node)) { try { render.reveal(node.x, node.y, false, true); } catch (e) { warnOnce('render.reveal', e); } }
        emitUI('roadDragStart', { fromId: node.id });
      },
      roadMove: function (x, y) { updateGhost(x, y); },
      roadEnd: function (x, y) {
        // arrasto curto (< 20 px da ponta): toque, nao estrada (nv7: 5 a 9 px faziam uma rua inteira de 2 pontos)
        var o0 = roadFrom !== null && game.world.nodes[roadFrom] && render.toScreen ? render.toScreen(game.world.nodes[roadFrom].x, game.world.nodes[roadFrom].y) : null;
        if (o0 && Math.sqrt((x - o0.x) * (x - o0.x) + (y - o0.y) * (y - o0.y)) < MIN_ROAD_PX) {
          clearGhost(); say(STR.dragFurther, 2200); emitUI('roadMiss', { why: 'short' }); return;
        }
        updateGhost(x, y);
        var g = ghost, from = roadFrom;
        clearGhost();
        if (!g) { snd('deny'); say(STR.roadSay.other); emitUI('roadMiss', { why: 'other' }); return; }   // nunca falha calado
        if (!g.ok) {
          snd('deny'); flash(g.x, g.y, 'bad'); roadNote(g.x, g.y, g.why);
          if (g.why === 'near') pulseValid('stop', g.x, g.y);
          if (g.why === 'budget') shake(tiles.road && tiles.road.el);
          say(roadSayText(g.why));
          emitUI('roadMiss', { why: g.why || null });
          return;
        }
        var br = game.buildRoad(from, g.x, g.y);
        if (result(br, g.x, g.y, 'build', 'road')) {
          // a ponta solta nao virou portal (teto de portais): avisa que nenhum carro vem ali
          var spoke = !!br.deadEnd;
          if (br.deadEnd) { roadNote(g.x, g.y, 'deadEnd'); say(STR.deadEnd); }
          else spoke = nearMiss(from, g);
          roadLetGo(spoke);   // w_bugs15
          emitUI('roadBuilt', {});
        }
        else {
          var bw = br && (br.reason === 'budget' || br.reason === 'phase' ? br.reason : (br.why || br.reason));
          roadNote(g.x, g.y, bw); say(roadSayText(bw));
          emitUI('roadMiss', { why: bw || null });
        }
      },
      roadCancel: function () { clearGhost(); },
      // arrasto com a Rua a partir do meio de uma estrada: diz de onde comecar e pulsa as duas pontas
      // arrasto com a Rua fora de um ponto: o mapa NAO anda (jogador-so-tela 2026-11-09: o arrasto no vazio
      // levava a cidade para fora da tela). Diz de onde comecar e pulsa as pontas mais perto do dedo
      roadMiss: function (x, y) {
        var w = game.world;
        emitUI('roadMiss', {});   // o balao do tutorial troca o texto e mostra a maozinha
        // sem pontos para uma rua: nao ensina um arrasto impossivel; diz o proximo passo (Play)
        if (game.state.phase === 'plan' && game.canAfford && !game.canAfford('road')) { say(roadSayText('budget')); return; }
        say(STR.roadFromEnd);
        var wp = render.toWorld ? render.toWorld(x, y) : { x: x, y: y }, L = [], k, n;
        for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) { n = w.nodes[k]; if (isEnd(n)) L.push(n); }
        L.sort(function (a, b) { return (a.x - wp.x) * (a.x - wp.x) + (a.y - wp.y) * (a.y - wp.y) - ((b.x - wp.x) * (b.x - wp.x) + (b.y - wp.y) * (b.y - wp.y)); });
        for (k = 0; k < L.length && k < 4; k++) addPulse(L[k].x, L[k].y);
      },
      holdStart: function (node) {
        holding = true; snd('select');
        var o = ov(); if (o) o.showInfluence = node.id;
      },
      holdEnd: function () {
        holding = false;
        var o = ov(); if (o && infTimer <= 0) o.showInfluence = null;
      }
    };
    function whyText(code) { return code ? (STR.roadWhy[code] || STR.roadWhy.other) : ''; }
    function roadNote(x, y, code) { try { if (render && render.note && code) render.note(x, y, whyText(code)); } catch (e) { warnOnce('render.note', e); } }
    // recusa da rua em linguagem simples (faixa do topo): diz o limite e o que fazer
    function roadSayText(code) {
      var R = STR.roadSay;
      if (!code) return '';
      if (code === 'budget') { var c; try { c = game.cost('road'); } catch (e) { warnOnce('game.cost', e); } return denyText({ reason: 'budget' }, 'road', game.state, CFG, c); }
      if (code === 'phase') return STR.deny.phase;
      return R[code] || R.other;
    }
    // ponto (no) perto do dedo, ate 2,2x o raio de toque: o arrasto quase comecou nele
    function nearDot(x, y, f) {
      var w = game.world, rr = (render.pickRadius ? render.pickRadius() : CFG.nodePickRadius) * (f || 2.2), best = null, bd = rr, k, p, d;
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) {
        p = render.toScreen(w.nodes[k].x, w.nodes[k].y); d = dist(x, y, p.x, p.y);
        if (d < bd) { bd = d; best = w.nodes[k]; }
      }
      return best;
    }
    // rua nova que passa rente (< 20 px de tela) a um no sem ligar nele: parece ligada, nao esta.
    // A UI destaca o no e explica (a regra de encaixe e do Sim; ver relatorio)
    function nearMiss(fromId, g) {
      var w = game.world, a = w.nodes[fromId], z = (render.camera && render.camera.zoom) || 1, k, n, d, best = null, bd = 20 / z;
      if (!a) return;
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) {
        n = w.nodes[k];
        if (n.id === fromId || dist(n.x, n.y, g.x, g.y) < 1) continue;
        if (g.nodeId != null && n.id === g.nodeId) continue;
        d = segDist(n.x, n.y, a.x, a.y, g.x, g.y);
        if (d < bd && !linked(n.id, fromId)) { bd = d; best = n; }
      }
      if (best && best.edges && best.edges.length < 2) { say(STR.notLinked); addPulse(best.x, best.y); later(function () { addPulse(best.x, best.y); }, 900); return true; }
      return false;
    }
    // w_bugs15: a road is built one at a time: the Road tool is put down, so the next tap on a crossing opens its card instead of 'Drag from a road end'
    function roadLetGo(spoke) {
      if (tutorScript() || (game.state.day | 0) < (CFG.roadOneFromDay | 0)) return;   // the first days build several roads: the tool stays in hand
      setSel(null);
      // the first-spend line teaches more and speaks right after the build: this one waits for the next road
      if (!spoke && !seen('roadOne') && !(gOn() && !seen('firstSpend'))) { markSeen('roadOne'); say(STR.roadOne, 4000); }
    }
    function linked(aId, bId) {
      var w = game.world, n = w.nodes[aId], i, e;
      for (i = 0; n && n.edges && i < n.edges.length; i++) { e = w.edges[n.edges[i]]; if (e && (e.a === bId || e.b === bId)) return true; }
      return false;
    }
    function segDist(px, py, ax, ay, bx, by) {
      var vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy, t = L2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / L2 : 0;
      t = clamp(t, 0, 1);
      return dist(px, py, ax + vx * t, ay + vy * t);
    }
    // raio de encaixe em no/estrada no zoom atual (o mesmo raio do toque em no, com piso de 22 px), em unidades de mundo
    function snapWorld() {
      var c = render && render.camera, z = c && c.zoom > 0 ? c.zoom : 1;
      var px = render && render.pickRadius ? render.pickRadius() : CFG.nodePickRadius * (z < 1 ? Math.sqrt(1 / z) : 1);
      return px / z;
    }
    var roadPt = null; // ultimo ponto de tela do dedo arrastando a rua (auto-pan)
    function updateGhost(x, y) {
      if (roadFrom === null) return;
      roadPt = { x: x, y: y };
      var wp = render.toWorld(x, y);
      var res = game.world.canAddEdge(roadFrom, wp.x, wp.y, { snap: snapWorld() }) || { ok: false, x: wp.x, y: wp.y };
      var afford = game.canAfford('road');
      var ok = !!res.ok && afford;
      var why = ok ? '' : (!afford ? 'budget' : (res.reason || 'other'));
      // nodeId/edgeId: onde a rua vai encaixar (render realca o alvo em verde e mostra a lupa acima do dedo).
      // O fantasma e a obra: cross = cruzamentos que vao nascer (losangos), capped = dedo alem do
      // maximo e rua cortada no maximo (marca de corte), reach = ate onde uma rua alcanca (recusa 'long').
      var cross = ok && res.cross && res.cross.length ? res.cross : null, capped = ok && !!res.capped;
      // ponta solta com o teto de portais do jogador cheio: vai nascer um beco (buildRoad.deadEnd). Avisa antes de soltar
      var dead = ok && res.nodeId == null && res.edgeId == null && (res.end === 'free' || res.end == null) && playerPortalsFull();
      ghost = { fromId: roadFrom, x: res.x, y: res.y, ok: ok, why: why, reason: whyText(why),
                nodeId: res.nodeId != null ? res.nodeId : null, edgeId: res.edgeId != null ? res.edgeId : null,
                cross: cross, capped: capped, reach: why === 'long' ? reachPoint(roadFrom, res.x, res.y) : null, deadEnd: dead,
                tip: dead ? STR.ghostDeadEnd : capped ? STR.ghostCapped : (cross ? (cross.length > 1 ? STR.ghostCrossN(cross.length) : STR.ghostCross) : '') };
      var o = ov(); if (o) { o.ghostRoad = ghost; o.finger = roadPt; }
    }
    // teto de portais criados por ruas do jogador (game.js PORTAL_CAP = 10; CFG.playerPortalCap se existir).
    // Portal do jogador = taxa CFG.builtPortalRate (a mesma regra de game.playerPortals)
    function playerPortalsFull() {
      var cap = typeof CFG.playerPortalCap === 'number' ? CFG.playerPortalCap : 10, w = game.world, q, n, c = 0;
      if (!w || !w.nodes || typeof CFG.builtPortalRate !== 'number') return false;
      for (q in w.nodes) if (w.nodes.hasOwnProperty(q)) { n = w.nodes[q]; if (n && n.portal && n.rate === CFG.builtPortalRate && ++c >= cap) return true; }
      return false;
    }
    // ponto a CFG.maxRoadLen da origem na direcao (x, y): a marca "ate aqui" da recusa 'long'
    function reachPoint(fromId, x, y) {
      var a = game.world.nodes[fromId]; if (!a) return null;
      var dx = x - a.x, dy = y - a.y, L = Math.sqrt(dx * dx + dy * dy);
      if (!(L > CFG.maxRoadLen)) return null;
      return { x: a.x + dx / L * CFG.maxRoadLen, y: a.y + dy / L * CFG.maxRoadLen };
    }
    function clearGhost() {
      roadFrom = null; ghost = null; roadPt = null;
      var o = ov(); if (o) { o.ghostRoad = null; o.finger = null; }
    }
    // Auto-pan: arrastando a rua perto da borda da tela ou por cima do HUD, a camera anda para
    // aquele lado (a rua pode crescer para qualquer lado em qualquer tela). Velocidade cresce com
    // a profundidade na zona da borda.
    var EDGE_PX = 44, AUTOPAN_PX = 620;
    function autoPanVec(x, y) {
      var W = (render && render.width) || 0, H = (render && render.height) || 0;
      if (!W || !H) return null;
      var m = render.margins || {}, ez = Math.min(EDGE_PX, W * 0.15);
      var zt = clamp(Math.max(EDGE_PX, m.top || 0), 1, H * 0.3), zb = clamp(Math.max(EDGE_PX, m.bottom || 0), 1, H * 0.35);
      var vx = 0, vy = 0;
      if (x < ez) vx = -(ez - x) / ez; else if (x > W - ez) vx = (x - (W - ez)) / ez;
      if (y < zt) vy = -(zt - y) / zt; else if (y > H - zb) vy = (y - (H - zb)) / zb;
      vx = clamp(vx, -1, 1); vy = clamp(vy, -1, 1);
      if (!vx && !vy) return null;
      // minimo de 30% para nao parecer travado na beirada da zona
      function ease(v) { return v === 0 ? 0 : (v > 0 ? 1 : -1) * (0.3 + 0.7 * Math.abs(v)); }
      return { x: ease(vx), y: ease(vy) };
    }
    // Freios (WALKTHROUGH2 problema 2: a rua parava no maximo e a camera seguia ate a cidade sumir):
    //  - eixo que levaria o ponto do dedo para alem do alcance de uma rua (maxRoadLen + encaixe),
    //    afastando-o ainda mais da origem, nao anda: o fantasma nao avanca mais por ali. Excecao:
    //    a ponta do fantasma ainda esta na zona da borda (sob o HUD); anda so ate ela aparecer;
    //  - a origem da rua nunca sai da tela (folga PAN_KEEP px): a cidade fica sempre a vista;
    //  - o centro da camera continua limitado ao CAM_R (render.pan).
    var PAN_KEEP = 24;
    function autoPanAxis(px, fx, ax, dPx, z, lim, other2, keepLo, keepHi, endHidden) {
      // px: tela da origem; fx/ax: mundo do dedo/origem neste eixo; dPx: deslocamento de tela do mundo
      if (!dPx) return 0;
      var np = px + dPx;
      // so anda o que falta ate a folga; origem ja fora da folga nunca e empurrada mais para fora
      if (dPx < 0 && np < keepLo) dPx = Math.min(0, keepLo - px);
      else if (dPx > 0 && np > keepHi) dPx = Math.max(0, keepHi - px);
      if (!dPx) return 0;
      var f0 = fx - ax, f1 = f0 - dPx / z;                // o mundo anda dPx: o dedo ve o mundo andar -dPx/z
      var L0 = f0 * f0 + other2, L1 = f1 * f1 + other2;
      if (L1 > lim * lim && L1 > L0 && !endHidden) return 0;
      return dPx;
    }
    function autoPan(dt) {
      if (roadFrom === null || !roadPt || gesture.state() !== 'road' || !render.pan) return;
      var v = autoPanVec(roadPt.x, roadPt.y);
      if (!v) return;
      var a = game.world.nodes[roadFrom]; if (!a) return;
      var c = render.camera, z = c && c.zoom > 0 ? c.zoom : 1;
      var d = Math.min(0.05, Math.max(0, dt || 0)) * AUTOPAN_PX;
      var sp = render.toScreen(a.x, a.y), fw = render.toWorld(roadPt.x, roadPt.y);
      var lim = CFG.maxRoadLen + snapWorld(), W = render.width || 0, H = render.height || 0;
      var fdx = fw.x - a.x, fdy = fw.y - a.y;
      // ponta do fantasma ainda na zona da borda (escondida sob o HUD ou rente a borda)?
      var gp = ghost && isFinite(ghost.x) ? render.toScreen(ghost.x, ghost.y) : null, ge = gp ? autoPanVec(gp.x, gp.y) : null;
      // pan(dx) move o mundo; a camera vai para o lado do dedo
      var px = autoPanAxis(sp.x, fw.x, a.x, -v.x * d, z, lim, fdy * fdy, PAN_KEEP, W - PAN_KEEP, !!(ge && ge.x * v.x > 0));
      var py = autoPanAxis(sp.y, fw.y, a.y, -v.y * d, z, lim, fdx * fdx, PAN_KEEP, H - PAN_KEEP, !!(ge && ge.y * v.y > 0));
      if (!px && !py) return;
      render.pan(px, py);
      updateGhost(roadPt.x, roadPt.y);
    }
    var gesture = createGesture(handlers);
    // portal que virou cruzamento (3+ estradas) tambem e cruzamento
    function isJunctionish(nd) { var dg = nd.edges ? nd.edges.length : 0; return dg >= 3 || (!nd.portal && dg >= 2); }

    // ---- camera: botao de enquadrar e dica de arrastar ----
    // offscreen() vem do render (atualizado no draw): ha nos fora da area util?
    var camKey = -1, panHintAt = 0;
    function cityCut() {
      var o = render && render.offscreen ? render.offscreen() : null;
      return !!(o && o.any);
    }
    function onFit() {
      if (modal() || !render) return;
      var cut = cityCut();
      camFreeze = false;
      // pedido da jogadora: passa pela regra do dedo parado (render.byUser), anda ja
      try { camByUser(function () { if (cut && render.fitAll) render.fitAll(true); else if (render.fit) render.fit(true); }); } catch (e) { warnOnce('render.fit', e); }
      snd('select');
      emitUI('fitPressed', { all: cut });
    }
    function syncCamUI(s, now) {
      var w = game.world, many = false, q, cnt = 0;
      for (q in w.nodes) if (w.nodes.hasOwnProperty(q) && ++cnt > 2) { many = true; break; }
      // cidade cortada: o enquadrar aparece sempre (mesmo com 2 pontos; antes sumia e o mapa ficava em branco)
      var inDay = s.phase === 'plan' || s.phase === 'run', cutNow = inDay && cityCut();
      var show = inDay && (many || cutNow);
      var cut = show && cutNow;
      var key = (show ? 2 : 0) + (cut ? 1 : 0);
      if (key !== camKey) {
        camKey = key;
        fitBtn.classList.toggle('gone', !show);
        fitBtn.classList.toggle('more', cut);
        fitBtn.setAttribute('aria-label', cut ? STR.fitAll : STR.fitClose);
      }
      // dica unica: a cidade nao cabe e a jogadora ainda nao arrastou o mapa
      if (userMoved && !seen('pan')) markSeen('pan');
      // lupa: a frase 'Tap again to pick' fica na faixa o tempo dela; a dica do enquadrar espera
      if (!gOn() || seen('pan') || s.phase !== 'plan' || !cut || modal() || gesture.state() !== 'idle' || (render.animating && render.animating()) || now < magSayUntil) { panHintAt = 0; return; }
      var tutor = CRZ.app && CRZ.app.tutorial;
      if (tutor && tutor.isActive && tutor.isActive()) { panHintAt = 0; return; }
      if (!panHintAt) { panHintAt = now + 1500; return; }
      if (now < panHintAt) return;
      markSeen('pan'); panHintAt = 0;
      say(STR.panHint); pulseEl(fitBtn);
    }

    function showInfluence(id, ms) {
      var o = ov(); if (!o) return;
      o.showInfluence = id; infTimer = ms;
    }

    // Boost: toque curto num no durante o dia (a maquina de gestos so chama tap sem arrasto).
    // O game decide pelo alvo: ponta da rua manda um carro (kind 'send'), cruzamento sofrendo escoa ('clear').
    var boostUsed = false;
    // o tutorial ja esta falando (balao na tela): a recusa do Boost so faz o som, sem segunda faixa
    // tutorial com balao na tela OU com roteiro ainda pela frente (entre dois passos o isActive e falso)
    // w_guide: Guidance (CRZ.guide, difficulty.js; ajuste do aparelho). Off tira o ensino, nao a informacao do jogo
    function gOn() { var g = CRZ.guide; return !g || g.on() !== false; }
    function tutorScript() {
      var tu = CRZ.app && CRZ.app.tutorial;
      try { return !!(tu && ((tu.isActive && tu.isActive()) || (tu.inScript && tu.inScript()))); } catch (e) { return false; }
    }
    function tutorStep() {
      var tu = CRZ.app && CRZ.app.tutorial;
      try { return tu && tu.current ? tu.current() : null; } catch (e) { return null; }
    }
    function tutorTalking() {
      var tutor = CRZ.app && CRZ.app.tutorial;
      try { return !!(tutor && tutor.isActive && tutor.isActive()); } catch (e) { return false; }
    }
    var lockedSaidDay = -1;
    // o cruzamento mais apertado agora (estresse >= 0,3), fora o no tocado
    function tightestNode(skip) {
      var w = game.world, k, b = null, bv = 0.3;
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) { var o = w.nodes[k]; if (o && o !== skip && !isEnd(o) && (o.stress || 0) >= bv) { bv = o.stress; b = o; } }
      return b;
    }
    function nearestEnd(n) {
      var w = game.world, k, best = null, bd = Infinity;
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) {
        var o = w.nodes[k]; if (!isEnd(o)) continue;
        var d = (o.x - n.x) * (o.x - n.x) + (o.y - n.y) * (o.y - n.y);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }
    var END_NEAR = 2.5;
    function endNearOnScreen(n, e) {
      if (!render || typeof render.toScreen !== 'function') return true;   // sem camera (testes de node): como antes
      var a = render.toScreen(n.x, n.y), b = render.toScreen(e.x, e.y);
      if (!a || !b) return true;
      var rr = (render.pickRadius ? render.pickRadius() : CFG.nodePickRadius) * END_NEAR;
      return dist(a.x, a.y, b.x, b.y) <= rr;
    }
    // ghost = toque no lugar do chip que acabou de sair (chipGhostNode): vale so para o no do chip, sem desvio
    function runTap(s, n, sx, sy, fromChip, ghost) {
      if (!n || modal()) return;
      var cl = s.clear;
      if (!cl || typeof game.useClear !== 'function') return;
      if (!cl.unlocked) {
        // Boost ainda bloqueado: diz o dia uma vez por dia (tocar o mapa no run nao vira spam)
        var ud = CFG.clear && CFG.clear.unlockDay;
        if (ud && lockedSaidDay !== s.day) { lockedSaidDay = s.day; say(STR.deny.boostLocked(ud)); }
        return;
      }
      // cruzamento calmo (estresse < BOOST_MIN) ou com Boost ainda correndo: a UI recusa ANTES do game e a carga
      // fica (CFG.clear.minStress do game segue desligado; passeio da testadora: Boost a 0,31 logo depois do
      // chip gastava carga sem efeito visivel). Ponta de rua (manda carro) nao passa por aqui.
      // final check 1: ponta que deixou de ser ponta (a rua do dia 1 saiu dela: portal com 2 ruas) ou curva de rua:
      // o toque vale para a ponta de rua mais perto (antes: 'All calm', que so vale para cruzamento)
      var dg = n.edges ? n.edges.length : 0;
      if (!isEnd(n) && dg <= 2 && !fromChip && !ghost && (n.stress || 0) < BOOST_MIN) {
        var ne = nearestEnd(n);
        // playtest cego 3 (144/145): a ponta "mais perto" podia estar do outro lado do mapa, longe do dedo, e o
        // carro extra saia la. So vale a ponta a ate END_NEAR raios de toque do no tocado (na tela)
        if (ne && ne !== n && endNearOnScreen(n, ne)) return runTap(s, ne, sx, sy, fromChip);
        snd('deny'); say(STR.deny.boostWhere); return false;
      }
      var jn = !(n.portal && (!n.edges || n.edges.length < 2));
      // Boost correndo e o anel ainda abaixo do chip (CHIP_ON): o segundo so tiraria pouco, recusa tambem
      var stz = n.stress || 0, runB = (n.boost || 0) > 0 && stz < CHIP_ON;
      // v2y: toque tardio no lugar do chip que saiu (a fila resolveu sozinha ou o Boost ja corre): sem carga e sem
      // recusa; a faixa diz que a carga ficou (nunca 'Nothing to boost' logo depois de um chip)
      if (ghost && jn && (stz < BOOST_MIN || runB)) {
        flash(n.x, n.y, 'ok'); say(STR.boostSaved, 1600);
        emitUI('clearUsed', { ok: false, kind: null, reason: 'calm', id: n.id, ui: true, ghost: true });
        return false;
      }
      if (jn && !fromChip && (cl.charges | 0) > 0 && !s.paused && (stz < BOOST_MIN || runB)) {
        var why = stz >= BOOST_MIN ? 'running' : 'calm';
        snd('deny'); flash(n.x, n.y, 'bad');
        if (why === 'running') say(STR.deny.boostRunning);
        else {
          // blind2: 'Save your boost' (3 vezes) virou: nada aqui ainda; pulsa o no mais apertado, se houver
          var tight = tightestNode(n);
          if (tight) { say(STR.boostNothing); addPulse(tight.x, tight.y); } else say(STR.boostAllCalm);
        }
        emitUI('clearUsed', { ok: false, kind: null, reason: why, id: n.id, ui: true });
        return false;
      }
      var r = game.useClear(n.id), okC = !!(r && r.ok), kind = (r && r.kind) || null;
      // balao 'send an extra car' do tutorial: o toque pedido nunca e recusado. Ponta sem lugar agora (ou com a
      // fila no cruzamento a frente): o carro extra sai da proxima ponta que aceita, e o aviso diz de onde
      if (!okC && r && (r.reason === 'space' || r.reason === 'portalQueue') && tutorStep() === 'run') {
        var w2 = game.world, k2, alt2 = null, r2;
        for (k2 in w2.nodes) if (w2.nodes.hasOwnProperty(k2)) {
          var o2 = w2.nodes[k2];
          if (!o2 || o2 === n || !isEnd(o2)) continue;
          r2 = game.useClear(o2.id);
          if (r2 && r2.ok) { alt2 = o2; break; }
        }
        if (alt2) {
          r = r2; okC = true; kind = r2.kind || 'send';
          snd('build'); flash(alt2.x, alt2.y, 'build'); addPulse(alt2.x, alt2.y); say(STR.sentOther);
          boostUsed = true;
          emitUI('clearUsed', { ok: true, kind: kind, reason: null, id: alt2.id });
          return true;
        }
      }
      boostUsed = true;
      if (okC) {
        if (kind === 'send') { snd('build'); flash(n.x, n.y, 'build'); try { if (render && render.note) render.note(n.x, n.y, STR.extraCar); } catch (e) { warnOnce('render.note', e); } }
        else { snd('place'); flash(n.x, n.y, 'ok'); }
        // retorno visivel do boost: anel e aviso curto (o raio gasto some das bolinhas)
        addPulse(n.x, n.y);
        // com o roteiro do tutorial a seguir, o proprio balao responde (nunca dois avisos juntos); fica o anel
        // primeiro boost num cruzamento: o que ele faz (uma vez)
        if (kind !== 'send' && gOn() && !seen('boostJ1') && !tutorScript()) { markSeen('boostJ1'); sayUntil = 0; say(STR.boostedJFirst, 3200); }
        else if (!sayUntil && !tutorScript()) say(kind === 'send' ? STR.boostedSend : STR.boosted, 1200);
      } else if (r && r.reason === 'portalQueue') {
        // ponta cuja rua esta na fila do cruzamento a frente: aponta e pulsa esse cruzamento
        snd('deny'); say(STR.deny.portalQueue);
        var ah = r.ahead != null ? game.world.nodes[r.ahead] : null;
        if (ah) { addPulse(ah.x, ah.y); later(function () { addPulse(ah.x, ah.y); }, 900); }
      } else if (r && (r.reason === 'calm' || r.reason === 'phase' || r.reason === 'locked')) {
        // recusa que antes era muda: som e o motivo (o balao do tutorial, se aberto, ja cobre)
        snd('deny'); flash(n.x, n.y, 'bad');
        // toda recusa diz o motivo e o que fazer, tambem com o tutorial aberto (antes: som de recusa mudo)
        if (r.reason === 'calm') say(STR.deny.boostCalm);
        else if (r.reason === 'phase') say(STR.deny.boostPhase);
        else say(STR.deny.boostLocked((CFG.clear && CFG.clear.unlockDay) || 1));
      } else if (r && (r.reason === 'charges' || r.reason === 'node' || r.reason === 'space')) {
        snd('deny');
        if (r.reason === 'charges') shake(clearEl);
        // sem lugar para o carro: o toque acertou, mas nada sai. Antes so o som (2026-11-09, sementes 7003 e 7014)
        if (r.reason === 'space') flash(n.x, n.y, 'bad');
        say(r.reason === 'charges' ? (lastDayOf(game.state) ? STR.deny.boostNoneLast : STR.deny.boostNone) : r.reason === 'space' ? STR.deny.boostSpace : STR.deny.boostWhere);
      }
      emitUI('clearUsed', { ok: okC, kind: kind, reason: okC ? null : (r && r.reason) || null, id: n.id });
      return okC;
    }

    /* ---- ajudas do dia 4 em diante (ensinam a acao; nada joga sozinho) ---- */
    // (3) Yield num cruzamento que ficou vermelho ontem (state.hot no plano = pico de ontem): diz o que segura ali
    function yieldBusyHint(s, n) {
      if ((s.day | 0) < ASSIST_DAY || !gOn()) return;
      var h = (s.hot && +s.hot[n.id]) || 0;
      if (h < RING_SEEN) return;
      // o mesmo recomendador do anel e do resumo (com o Yield ja no no: o proximo sinal melhor)
      var a = nodeAdvice(s, n);
      if (!a || a.key.indexOf('sign:') !== 0) return;
      say(STR.yieldBusy(TL[a.tool], null));
    }

    // (1) chip do Boost (v2y, playtest cego 5 achado 2): o Boost e a acao do dia, entao o chip tem de valer sempre.
    //  - aparece no ambar do anel (estresse >= RING_BUSY e subindo) ou acima de chipOn(), nunca nos ultimos 3 s reais
    //    do dia (a fila que comeca tao tarde nao trava antes do fim: lockSeconds de jogo com estresse 1);
    //  - um so chip, no cruzamento mais urgente; o segundo espera o primeiro sair;
    //  - fica pelo menos CHIP_MIN_MS reais (salvo se a fila sumir de vez: sai com fade curto); enquanto esta na tela
    //    o dia corre a 1x de parede (ui.timeScale, lido por main.js), e volta a velocidade escolhida depois;
    //  - o toque no chip sempre age (Boost no no do chip); o toque tardio no lugar dele nunca gasta carga a toa;
    //  - posicao: a mesma regra de faixas do balao do retorno (HUD, aneis, outros nos), com linha ate o no se longe.
    var bchip = { id: null, x: -1, y: -1, side: null, rects: null, rectAt: 0, cool: {},
                  id2: null, x2: -1, y2: -1, at: -1e9, hist: {}, shownAt: 0, fadeEnd: 0, tapAt: 0, holdUntil: 0, want: null };
    var CHIP_MIN_MS = 3000, CHIP_EASE_MS = 5000, CHIP_SEE_MS = 2000, CHIP_FADE_MS = 220, CHIP_GONE = 0.15, CHIP_RISE = 0.02, CHIP_TAIL = 3.7;
    function rectOf(e) {
      try {
        var r = e.getBoundingClientRect();
        if (!r || !(r.width > 0) || !(r.height > 0)) return null;
        var l = r.left || 0, t = r.top || 0;
        return { l: l, t: t, r: r.right != null ? r.right : l + r.width, b: r.bottom != null ? r.bottom : t + r.height };
      } catch (x) { return null; }
    }
    // retangulos do HUD: lidos ao mostrar o chip e a cada 1 s com ele na tela (nunca por quadro)
    function hudRects() {
      var out = [], L = [top, tray, playBtn, clearEl, fitBtn, budgetEl, tipEl, chipEl], i, r;
      for (i = 0; i < L.length; i++) {
        if (!L[i] || (L[i].classList && L[i].classList.contains('gone'))) continue;
        r = rectOf(L[i]); if (r) out.push(r);
      }
      // a faixa preta e o balao do retorno tambem sao HUD enquanto estao na tela
      if (sayEl && sayEl.classList.contains('show')) { r = rectOf(sayEl); if (r) out.push(r); }
      if (fbkEl && fbkEl.classList.contains('on')) { r = rectOf(fbkEl); if (r) out.push(r); }
      return out;
    }
    // v2y: o segundo chip saiu (dois chips encavalados no playtest cego 5, 266 e 327); fica so o elemento, sempre gone
    function hideChip2() {
      bchip.id2 = null; bchip.x2 = bchip.y2 = -1;
      if (!bchip2El.classList.contains('gone')) bchip2El.classList.add('gone');
    }
    // o chip saiu da tela: guarda onde estava e de que no era. Um toque que chega ali logo depois (o dedo ja vinha)
    // vale para ESSE no, nunca para o que estava escondido sob o chip (playtest cego 3, 144/145: o toque caiu numa
    // curva sob o chip e o carro extra saiu de uma ponta do outro lado)
    var CHIP_GHOST_MS = 1500;
    var chipGhost = { id: null, l: 0, t: 0, r: 0, b: 0, at: -1e9 };
    function chipLead(on, p, c) {
      if (!on) { if (!bleadEl.classList.contains('gone')) bleadEl.classList.add('gone'); return; }
      // linha do centro do no ate a borda do chip (fica atras do chip)
      var dx = c.x - p.x, dy = c.y - p.y, L = Math.sqrt(dx * dx + dy * dy) - CHIP_PX / 2 - 10, a = Math.atan2(dy, dx);
      if (!(L > 8)) { chipLead(false); return; }
      bleadEl.style.left = Math.round(p.x + Math.cos(a) * 10) + 'px';
      bleadEl.style.top = Math.round(p.y + Math.sin(a) * 10 - 1) + 'px';
      bleadEl.style.width = Math.round(L) + 'px';
      bleadEl.style.transform = 'rotate(' + (a * 180 / Math.PI).toFixed(1) + 'deg)';
      bleadEl.classList.remove('gone');
    }
    function hideChip(fade) {
      hideChip2();
      if (bchip.id === null) return;
      if (bchip.x >= 0) chipGhost = { id: bchip.id, l: bchip.x - CHIP_PX / 2 - 8, t: bchip.y - CHIP_PX / 2 - 8, r: bchip.x + CHIP_PX / 2 + 8, b: bchip.y + CHIP_PX / 2 + 8, at: nowMs() };
      bchip.id = null; bchip.side = null; bchip.x = bchip.y = -1; bchip.shownAt = 0;
      bchipEl.classList.remove('fade');
      chipLead(false);
      // fade curto (CSS, sem toque durante o fade); movimento reduzido: some direto
      // o fim do fade e conferido no tick (fadeEnd), nunca por timer: reload, fim do dia ou aba parada nao deixam chip
      if (fade && !reducedMotion()) { bchipEl.classList.add('fade'); bchip.fadeEnd = nowMs() + CHIP_FADE_MS; }
      else { bchipEl.classList.add('gone'); bchip.fadeEnd = 0; }
    }
    function chipFadeTick(now, force) {
      if (!bchip.fadeEnd || (!force && now < bchip.fadeEnd)) return;
      bchip.fadeEnd = 0;
      if (bchip.id === null) { bchipEl.classList.add('gone'); bchipEl.classList.remove('fade'); }
    }
    // historia curta do estresse por no (amostra a cada recalculo): subida nos ultimos CHIP_WIN s de jogo
    function chipSample(t) {
      var w = game.world, q, n, h;
      if (!w || !w.nodes) return;
      for (q in w.nodes) if (w.nodes.hasOwnProperty(q)) {
        n = w.nodes[q];
        if (!boostable(n)) { delete bchip.hist[q]; continue; }
        h = bchip.hist[q] || (bchip.hist[q] = []);
        if (h.length && t < h[h.length - 1][0]) h.length = 0;   // dia novo: dayTime voltou
        h.push([t, n.stress || 0]);
        while (h.length > 2 && t - h[1][0] >= CHIP_WIN) h.shift();
      }
    }
    function chipRate(n) {
      var h = bchip.hist[n.id];
      return h && h.length ? (n.stress || 0) - h[0][1] : 0;
    }
    // condicoes do chip sem contar as cargas (sem carga o chip nao sai, mas a linha de 'amanha' sim)
    function chipScene(s) {
      // v2: na cena do dia 2 (state.teach.jam) o chip do raio aparece cedo, e tambem com o dia pausado pelo tutorial
      var cl = s.clear, jamTeach = !!(s.teach && s.teach.jam);
      return s.phase === 'run' && ((s.day | 0) >= ASSIST_DAY || jamTeach) && (!s.paused || jamTeach) && !modal() && !holdUntil &&
        !!(cl && cl.unlocked) && !!(render && render.toScreen);
    }
    // w_bugs12: the floating Boost chip points at where to tap (teaching): Guidance Off has none (the crossing still takes the tap)
    function chipWanted(s) { return gOn() && chipScene(s) && ((s.clear.charges | 0) > 0); }
    // tempo de jogo que falta basta para 3 s reais de chip: a rampa da velocidade (~0,5 s de parede ainda rapidos)
    // mais CHIP_TAIL s a 1x. A cena do dia 2 espera a fila (jamHold no game): sem corte
    function chipTimeOk(s) {
      if (s.teach && s.teach.jam) return true;
      var left = (+s.dayLen || 0) - (+s.dayTime || 0), sp = Math.max(1, +s.speed || 1);
      return left >= CHIP_TAIL + 0.5 * sp;
    }
    // candidato a chip: ambar subindo, ou acima de chipOn(); o pedido do balao 'Busy again' (bchip.want) vale no ambar
    function chipCandidate(t) {
      var w = game.world, q, n, st, best = null, bs = -1, on = chipOn(), want = bchip.want && bchip.want.until > nowMs() ? bchip.want.id : null;
      for (q in w.nodes) if (w.nodes.hasOwnProperty(q)) {
        n = w.nodes[q];
        if (!boostable(n) || bchip.cool[n.id] > t || (n.boost || 0) > 0) continue;
        st = n.stress || 0;
        if (!(st >= on || (st >= RING_BUSY && (chipRate(n) >= CHIP_RISE || n.id === want)))) continue;
        // mais urgente: estresse; empate (CHIP_TIE): quem sobe mais rapido
        var sc = st + (n.id === want ? CHIP_TIE : 0) + Math.max(0, chipRate(n)) * 0.5;
        if (sc > bs) { bs = sc; best = n; }
      }
      return best;
    }
    // so um aviso por partida: sem cargas, a fila apertou; os Boosts voltam amanha (CFG.clear.charges por dia)
    function chipOutLine(s, t) {
      if (seen('boostOut') || tutorScript() || sayUntil || (s.day | 0) <= ((CFG.earlyBoost && CFG.earlyBoost.days) | 0)) return;
      var w = game.world, q, n;
      for (q in w.nodes) if (w.nodes.hasOwnProperty(q)) {
        n = w.nodes[q];
        if (boostable(n) && (n.stress || 0) >= chipOn()) {
          if (sayShown(STR.boostOut((CFG.clear && CFG.clear.charges) || 3, lastDayOf(s)), 3500)) { markSeen('boostOut'); addPulse(n.x, n.y); }
          return;
        }
      }
    }
    // posicao do chip: candidatos em 8 lados, perto do no e depois mais longe (com linha ate ele), dentro da faixa
    // entre os HUDs e com folga para o pulso (o anel de 56 px cresce 1,3x: 16 px de folga na borda); faixas como
    // fbkPlace: HUD + aneis + outros nos, depois HUD + aneis, depois so HUD
    var CHIP_EDGE = 18;
    function chipSpot(n, W, H) {
      var p = render.toScreen(n.x, n.y), m = render.margins || {}, R = CHIP_PX / 2;
      var y0 = Math.max(6, (m.top || 0) - 10), y1 = H - Math.max(6, (m.bottom || 0) - 10);
      var hud = (bchip.rects || []).map(function (r) { return { x: r.l, y: r.t, w: r.r - r.l, h: r.b - r.t }; });
      var nb = nodeBoxes(n.id), self = { x: p.x - 18, y: p.y - 18, w: 36, h: 36 };
      var tiers = [hud.concat([self], nb.rings, nb.dots), hud.concat([self], nb.rings), hud.concat([self])];
      var dirs = [[1, 0, 'r'], [-1, 0, 'l'], [0, -1, 'u'], [0, 1, 'd'], [0.71, -0.71, 'ur'], [-0.71, -0.71, 'ul'], [0.71, 0.71, 'dr'], [-0.71, 0.71, 'dl']];
      if (bchip.side) dirs.sort(function (a, b) { return (b[2] === bchip.side) - (a[2] === bchip.side); });
      var dists = [R + 22, R + 52, R + 92, R + 140], ti, di, k, d, x, y;
      for (ti = 0; ti < tiers.length; ti++) for (di = 0; di < dists.length; di++) for (k = 0; k < dirs.length; k++) {
        d = dists[di]; x = p.x + dirs[k][0] * d; y = p.y + dirs[k][1] * d;
        if (x - R < CHIP_EDGE || x + R > W - CHIP_EDGE || y - R < y0 + 4 || y + R > y1 - 4) continue;
        if (fbkHit(x - R - 4, y - R - 4, 2 * R + 8, 2 * R + 8, tiers[ti])) continue;
        return { x: x, y: y, side: dirs[k][2], lead: di > 0, p: p };
      }
      // nada coube (no colado no HUD): a posicao antiga, dentro da tela
      var c = chipPlace(p, W, H, bchip.rects || [], bchip.side);
      c.x = clamp(c.x, R + CHIP_EDGE, W - R - CHIP_EDGE);
      c.lead = Math.hypot(c.x - p.x, c.y - p.y) > R + 30; c.p = p;
      return c;
    }
    function chipShow(n, now) {
      bchip.id = n.id; bchip.side = null; bchip.rects = hudRects(); bchip.rectAt = now; bchip.shownAt = now; bchip.fadeEnd = 0; bchip.tapAt = 0;
      bchip.x = bchip.y = -1;
      bchipEl.classList.remove('gone'); bchipEl.classList.remove('fade');
      bchipEl.classList.toggle('still', reducedMotion());
      emitUI('boostChip', { id: n.id });
    }
    function chipMove(n, now) {
      if (!bchip.rects || now - bchip.rectAt > 1000) { bchip.rects = hudRects(); bchip.rectAt = now; }
      var W = render.width || root.innerWidth || 390, H = render.height || root.innerHeight || 844;
      var c = chipSpot(n, W, H);
      bchip.side = c.side;
      if (Math.abs(c.x - bchip.x) >= 1 || Math.abs(c.y - bchip.y) >= 1) {
        bchip.x = c.x; bchip.y = c.y;
        bchipEl.style.left = Math.round(c.x - CHIP_PX / 2) + 'px';
        bchipEl.style.top = Math.round(c.y - CHIP_PX / 2) + 'px';
      }
      chipLead(!!c.lead, c.p, c);
    }
    function boostChipTick(s, now) {
      hideChip2();
      chipFadeTick(now, s.phase !== 'run');
      if (!chipWanted(s)) {
        if (bchip.id !== null) hideChip(false);   // pausa, folha, fim do dia, sem carga: sai na hora
        if (chipScene(s) && (s.clear.charges | 0) <= 0) chipOutLine(s, +s.dayTime || 0);
        return;
      }
      var t = +s.dayTime || 0;
      if (now - bchip.at >= CHIP_EVERY || bchip.id === null) { bchip.at = now; chipSample(t); }
      if (bchip.id !== null) {
        var n = game.world.nodes[bchip.id], st = n ? n.stress || 0 : 0, age = now - bchip.shownAt;
        // sai: no sumiu ou travou; fila resolvida de vez; ou, passados os 3 s, abaixo do desligar e caindo
        var gone = !n || !boostable(n) || st < CHIP_GONE || (age >= CHIP_MIN_MS && st < chipOff() && chipRate(n) <= 0);
        if (gone) { hideChip(true); return; }
        chipMove(n, now);
        return;
      }
      if (!chipTimeOk(s)) return;
      var c = chipCandidate(t);
      if (!c) return;
      chipShow(c, now);
      chipMove(c, now);
    }
    // escala de tempo do dia (main.js: game.update(dt * ui.timeScale())): chip na tela => 1x de parede, sem pulo
    // (aproximacao exponencial de ~0,2 s), e volta a velocidade escolhida depois do toque ou quando o chip sai.
    // Nao muda regra: st.speed (paciencia, gorjeta) segue o que a jogadora escolheu
    var tScale = 1, TS_TAU = 0.2;
    function timeScaleTick(s, dt) {
      var sp = Math.max(1, +s.speed || 1);
      // depois do toque o 1x segue ate o chip completar 3 s e por 2 s depois do toque: a fila some a vista, o dia
      // nao acaba logo atras do toque (playtest cego 5: 4 de 5 toques e o resumo ja na tela)
      // quem deixa o chip na tela sem tocar volta a velocidade escolhida depois de CHIP_EASE_MS (o chip fica)
      var nw = nowMs(), held = (bchip.id !== null && nw - bchip.shownAt < CHIP_EASE_MS) || nw < bchip.holdUntil;
      var want = held && s.phase === 'run' && !s.paused && !s.ff && sp > 1 ? 1 / sp : 1;
      if (s.phase !== 'run') { tScale = 1; bchip.holdUntil = 0; return; }
      var k = dt > 0 ? Math.min(1, dt / TS_TAU) : 0;
      tScale += (want - tScale) * k;
      if (Math.abs(tScale - want) < 0.005) tScale = want;
    }
    function timeScale() { return tScale; }
    function chipTap(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var s = game.state, n = bchip.id !== null ? game.world.nodes[bchip.id] : null;
      if (!n || s.phase !== 'run' || modal()) return;
      emitUI('nodeTap', { id: n.id });   // o tutorial despausa no toque de no (como no mapa)
      sayUntil = 0;                      // a confirmacao do Boost sempre aparece (o toque precisa de resposta)
      if (runTap(s, n, undefined, undefined, true)) {
        // o Boost dura CFG.clear.seconds: o chip nao volta para o mesmo no antes disso (nao queima carga)
        bchip.cool[n.id] = (+s.dayTime || 0) + ((CFG.clear && CFG.clear.seconds) || 6);
        var now0 = nowMs();
        bchip.holdUntil = Math.max(bchip.shownAt + CHIP_MIN_MS, now0 + CHIP_SEE_MS);
        hideChip(false);
        chipGhost.id = null;             // o segundo toque do dedo no mesmo lugar nao vira outro Boost
      }
    }
    on(bchipEl, 'click', chipTap);
    on(bchip2El, 'click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); });

    // chip "Pair lights": arma o pareamento a partir do semaforo do chip (o proximo toque noutro semaforo pareia)
    on(pairChipEl, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var s = game.state, n = pchip.id !== null ? game.world.nodes[pchip.id] : null;
      if (!n || s.phase !== 'plan' || modal() || n.tool !== 'light') { hidePairChip(); return; }
      pairArm = { from: n.id, until: nowMs() + PAIR_MS }; pairRep = null;
      pairChipEl.classList.add('armed');
      snd('select'); say(STR.pairPick, PAIR_MS);
      // os semaforos que podem formar par pulsam
      (function () { var w = game.world, k, o; for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) { o = w.nodes[k]; if (o && o.tool === 'light' && o.id !== n.id) addPulse(o.x, o.y); } })();
      syncSelectedNode();
      emitUI('pairArm', { id: n.id });
    });

    // (4) cruzamentos novos sem sinal: ids de cruzamento (3+ ruas) antes do crescimento; o que surgiu depois e "novo"
    var newJ = { snap: null, ids: {} };
    (function loadNewJ() {
      var o = null; try { o = JSON.parse(lsGet(NEWJ_KEY) || 'null'); } catch (e) {}
      var sd = game.world && game.world.seed;
      if (o && typeof o === 'object' && o._s === sd && o.ids && typeof o.ids === 'object') newJ.ids = o.ids;
      // partida nova com a mesma semente (dia menor que o anotado): memoria nova
      var dNow = (game.state && game.state.day) | 0, q;
      for (q in newJ.ids) if (newJ.ids.hasOwnProperty(q) && (dNow <= 1 || newJ.ids[q] > dNow)) { newJ.ids = {}; o = null; break; }
      newJ.snap = o && o._s === sd && o.snap ? o.snap : junctionIds();
    })();
    // tipDay/askDay: a dica do Easy e a confirmacao do Play ja sairam neste dia (sobrevive ao recarregar)
    function saveNewJ() {
      lsSet(NEWJ_KEY, JSON.stringify({ _s: game.world && game.world.seed, ids: newJ.ids, snap: newJ.snap,
        tipDay: njDay ? njDay.tip : -1, askDay: njDay ? njDay.ask : -1 }));
    }
    function junctionIds() {
      var w = game.world, out = {}, q;
      if (w && w.nodes) for (q in w.nodes) if (w.nodes.hasOwnProperty(q) && isJunction(w.nodes[q])) out[q] = 1;
      return out;
    }
    // invisivel 2: a cidade cresce na troca de dia, embaixo da tela do dado. Quando a tela fecha (ou na entrada do
    // plano sem tela), as ruas novas crescem de novo, cada ponta nova pulsa 2 s, uma faixa diz quanto e um 'pop'.
    // A camera nao anda (regra do plano)
    var growPend = null;
    function growTick(s) {
      if (!growPend || s.phase !== 'plan' || roll.open || bootFrames >= 0 || holdUntil) return;
      if (modal() && !tutBalloonOn()) return;
      var ids = growPend.ids; growPend = null;
      var w = game.world, set = {}, i, k, ends = [], roads = 0;
      for (i = 0; i < ids.length; i++) set[ids[i]] = 1;
      for (k in w.edges) if (w.edges.hasOwnProperty(k)) { var e = w.edges[k]; if (set[e.a] || set[e.b]) roads++; }
      for (i = 0; i < ids.length; i++) { var n = w.nodes[ids[i]]; if (n && isEnd(n)) ends.push(n); }
      if (!roads && !ends.length) return;
      try { if (render && render.replayGrow) render.replayGrow(ids); } catch (er) { warnOnce('render.replayGrow', er); }
      ends.forEach(function (n) { addPulse(n.x, n.y); later(function () { addPulse(n.x, n.y); }, 700); later(function () { addPulse(n.x, n.y); }, 1400); });
      snd('pop');
      // dia 2 com o roteiro: o balao 'The city grew a new road end' ja diz (nunca o mesmo texto em dois lugares)
      if (!(tutorScript() && (s.day | 0) === 2)) say(ends.length ? STR.grewEnds(ends.length) : STR.grewRoads(roads), 3500);
    }
    function onGrow() {
      var now = junctionIds(), q, d = (game.state.day | 0) + 1;
      for (q in now) if (now.hasOwnProperty(q) && !newJ.snap[q] && !newJ.ids[q]) newJ.ids[q] = d;
      newJ.snap = now; saveNewJ();
    }
    // lista viva: ainda existe, ainda e cruzamento, ainda sem ferramenta; o mais antigo primeiro
    function newJList() {
      var w = game.world, out = [], q, n;
      for (q in newJ.ids) if (newJ.ids.hasOwnProperty(q)) {
        n = w && w.nodes ? w.nodes[q] : null;
        if (isJunction(n) && !n.tool) out.push(n);
      }
      out.sort(function (a, b) { return (newJ.ids[a.id] - newJ.ids[b.id]) || (a.id - b.id); });
      return out;
    }
    // render agent (2026-11-15): zoom de destaque do chip de cruzamentos novos e do 'Busiest crossing'. 1.1 fixo saltava
    // ~3,8x a partir de 0,29 nos dias finais e as ruas passavam por baixo do HUD; agora o zoom de conforto do render
    // toque da jogadora num botao que pede a camera (enquadrar, chip, linha do resumo): anda ja, sem esperar o dedo
    // ficar parado (render.byUser); todo o resto e automatico e o render guarda ate IDLE_MS sem toque no mapa
    function camByUser(fn) { if (render && render.byUser) return render.byUser(fn); return fn(); }
    function focusZoom() {
      var z = (render.camera && render.camera.zoom) || 1, zl = render.zoomLimits;
      return Math.max(z, zl && zl.comfort > 0 ? zl.comfort : 1.1);
    }
    var peekT = 0;
    on(todoEl, 'click', function () {
      var n = todoNode; if (!n) return;
      snd('select');
      try { if (render && render.focus) camByUser(function () { render.focus(n.x, n.y, focusZoom(), !reducedMotion()); }); } catch (e) { warnOnce('render.focus', e); }
      addPulse(n.x, n.y); later(function () { addPulse(n.x, n.y); }, 900);
      sumEl.classList.add('crz-peek');
      if (peekT) root.clearTimeout(peekT);
      peekT = later(function () { sumEl.classList.remove('crz-peek'); peekT = 0; }, 2600);
      say(todoKind === 'busy' ? STR.todoBusyWhy + ' ' + STR.peekBack : STR.peekBack, 2600);
      emitUI('summaryTodo', { kind: todoKind, id: n.id });
    });
    on(newJEl, 'click', function () {
      var L = newJList(), n = L[0];
      if (!n) return;
      snd('select');
      try { if (render && render.focus) camByUser(function () { render.focus(n.x, n.y, focusZoom(), !reducedMotion()); }); } catch (e) { warnOnce('render.focus', e); }
      addPulse(n.x, n.y); later(function () { addPulse(n.x, n.y); }, 900);
      // o resumo cobre o mapa: abaixa por ~2 s para a jogadora ver o cruzamento, depois volta
      sumEl.classList.add('crz-peek');
      if (peekT) root.clearTimeout(peekT);
      peekT = later(function () { sumEl.classList.remove('crz-peek'); peekT = 0; }, 2200);
      say(STR.peekBack, 2200);
      emitUI('newJunctionTap', { id: n.id, count: L.length });
    });

    // ---- (4b) plano: cruzamentos desta manha (crescimento, ou rua do jogador que cortou outra) sem sinal ----
    // Marca NEW no mapa (render: overlay.newJ), chip "N new crossings", dica do Easy, confirmacao leve do Play.
    // A marca some com ferramenta no no e quando o dia comeca (overlay.newJ so vale no plano).
    var njDay = { day: -1, at: 0, tip: -1, ask: -1, asking: false, idx: 0 };
    (function loadNjDay() {
      var o = null; try { o = JSON.parse(lsGet(NEWJ_KEY) || 'null'); } catch (e) {}
      if (o && o._s === (game.world && game.world.seed)) {
        if ((o.tipDay | 0) > 0) njDay.tip = o.tipDay | 0;
        if ((o.askDay | 0) > 0) njDay.ask = o.askDay | 0;
      }
    })();
    function easyOn() { var d = CFG.difficultyName; return !d || d === 'easy'; }
    // ajudas por perfil (difficulty.js, CFG.difficulties[nome].assist); sem o campo vale o padrao de antes
    function assistGet(k, d) {
      if (!gOn() && (k === 'playConfirm' || k === 'newJunctionTip')) return false;   // w_guide: Off sem confirmacao de ajuda nem dica 'NEW'
      var n = CFG.difficultyName || 'easy', p = CFG.difficulties && CFG.difficulties[n], a = p && p.assist;
      return a && a[k] != null ? a[k] : d;
    }
    function chipOn() { var v = +assistGet('chipAt', CHIP_ON); return v > 0 ? v : CHIP_ON; }
    function chipOff() { var v = +assistGet('chipOff', CHIP_OFF); return v > 0 ? v : CHIP_OFF; }
    // rua do jogador no plano: cruzamento que nasceu agora entra como "desta manha"
    function onPlanEdit() {
      var s = game.state; if (!s || s.phase !== 'plan' || !newJ.snap) return;
      var now = junctionIds(), q, d = s.day | 0, ch = false;
      for (q in now) if (now.hasOwnProperty(q) && !newJ.snap[q] && !newJ.ids[q]) { newJ.ids[q] = d; ch = true; }
      newJ.snap = now; if (ch) saveNewJ();
    }
    function morningList(s) {
      if (!s || s.phase !== 'plan' || (s.day | 0) < ASSIST_DAY) return [];
      // a marca NEW fica entre os dias enquanto o cruzamento segue sem sinal (antes sumia no dia seguinte)
      return newJList();
    }
    // pontos sobrando: alguma ferramenta de cruzamento liberada cabe no orcamento (ou o semaforo gratis)
    function signAffordable(s) {
      var t = s.tools || [], i;
      for (i = 0; i < t.length; i++) if (NODE_TOOLS[t[i].id] && t[i].unlocked && t[i].afford !== false) return true;
      return false;
    }
    function showJunction(n, focus) {
      if (!n) return;
      // so o toque da jogadora (chip) move a camera; dica e confirmacao so pulsam (no plano a camera nunca anda
      // sozinha: o mapa mexendo entre dois toques trocava o sinal de lugar, novato 2026-11-09)
      try {
        if (focus && render && render.focus) camByUser(function () { render.focus(n.x, n.y, focusZoom(), !reducedMotion()); });
      } catch (e) { warnOnce('render.focus', e); }
      addPulse(n.x, n.y); later(function () { addPulse(n.x, n.y); }, 900);
    }
    function newJPlanTick(s, now) {
      var o = ov(), L = assistGet('newMark', true) ? morningList(s) : [], ids = L.map(function (n) { return n.id; });
      if (o) {
        var cur = o.newJ || [], same = cur.length === ids.length;
        for (var i = 0; same && i < ids.length; i++) same = cur[i] === ids[i];
        if (!same) o.newJ = ids;
      }
      if (s.phase === 'plan' && njDay.day !== (s.day | 0)) { njDay.day = s.day | 0; njDay.at = now; njDay.asking = false; njDay.idx = 0; }
      if (s.phase !== 'plan') njDay.asking = false;
      var key = ids.length ? ids.length + '' : '';
      if (key !== njChipKey) {
        njChipKey = key;
        njChipEl.textContent = ids.length ? STR.newJChip(ids.length) : '';
        njChipEl.setAttribute('aria-label', ids.length ? STR.newJChipAria(ids.length) : '');
        njChipEl.classList.toggle('gone', !ids.length);
        layoutDirty = true;
      }
      if (njDay.asking && !ids.length) { njDay.asking = false; playBtn.classList.remove('crz-ask'); }
      // dia 4+ (assist.newJunctionTip; padrao so Easy): a dica curta UMA vez por partida, no primeiro cruzamento
      // novo; sem pausar. Nos outros dias ficam o chip "N new crossings" e a confirmacao do Play (rodada 3:
      // a faixa diaria aparecia 9 vezes por partida junto com os dois)
      // primeiro cruzamento novo da partida, Easy e Normal: o que e a marca e a regra do dia 4, uma vez cada
      if (ids.length && gOn() && njDay.tip <= 0 && now - njDay.at >= 1400 && !modal() && !tutorTalking() &&
          !holdUntil && !(sayUntil && now < sayUntil)) {
        njDay.tip = s.day | 0; saveNewJ();
        var njValid = function () { return game.state.phase === 'plan' && morningList(game.state).length > 0; };
        say(STR.newJFirst, 4000, njValid); pulseEl(njChipEl);
        showJunction(L[0], false);
        emitUI('newJunctionTip', { id: L[0].id, count: ids.length });
      }
    }
    // Play no plano: true = pediu confirmacao (nao comeca). So no Easy, uma vez por dia, com pontos sobrando
    // folha de confirmacao do Play: motivo em 1 frase por linha, 'Start day' e 'Back to building'. Uma vez por motivo
    // por dia. Motivos: NEW sem sinal (so no Easy: no Normal fica desligado, equilibrio medido), pontos acima do teto
    // de carry-over, rua gratis do dia ainda nao usada
    var confirmEl = tut(el('div', 'crz-confirm gone'), 'play-confirm'), confirmAsked = { day: -1, keys: {} }, confirmWhy = [], confirmShownAt = -1e9;
    confirmEl.setAttribute('role', 'dialog'); confirmEl.setAttribute('aria-modal', 'true');
    var confirmBox = el('div', 'crz-cbox'); confirmBox.setAttribute('data-scroll', '');
    var confirmTxt = el('div', 'crz-ctxt'), confirmRow = el('div', 'crz-crow');
    confirmTxt.id = 'crz-confirm-txt'; confirmEl.setAttribute('aria-labelledby', 'crz-confirm-txt');
    // Escape fecha a folha (e o guia); toque no fundo escuro tambem
    on(doc, 'keydown', function (e) {
      if (!e || e.key !== 'Escape') return;
      if (confirmOpen()) { closeConfirm(); try { playBtn.focus(); } catch (x) {} }
      else if (guideEl) closeGuide();
    });
    on(confirmEl, 'click', function (e) { if (e && e.target === confirmEl) closeConfirm(); });
    var confirmStart = tut(el('button', 'crz-cstart'), 'confirm-start'), confirmBack = tut(el('button', 'crz-cback'), 'confirm-back');
    confirmStart.textContent = STR.cStart; confirmBack.textContent = STR.cBack;
    confirmRow.appendChild(confirmBack); confirmRow.appendChild(confirmStart);
    confirmBox.appendChild(confirmTxt); confirmBox.appendChild(confirmRow); confirmEl.appendChild(confirmBox);
    ui.appendChild(confirmEl);
    function playReasons(s) {
      var out = [], cap = CFG.carryCap != null ? CFG.carryCap : 3;
      // A.7: o que a folha ja perguntou hoje volta do planMemo depois de um reload
      if (confirmAsked.day !== s.day) { var pa = planToday(s); confirmAsked = { day: s.day, keys: pa && pa.asked ? pa.asked : {} }; }
      var L = assistGet('playConfirm', easyOn()) && !tutorTalking() ? morningList(s) : [];
      if (L.length && signAffordable(s) && !confirmAsked.keys.newj) out.push({ key: 'newj', text: STR.cWhyNew(L.length), node: L[0] });
      if (gOn() && s.free && s.free.road && !confirmAsked.keys.free) out.push({ key: 'free', text: STR.cWhyFree });
      // invisivel 6: o semaforo gratis tambem some a noite
      if (gOn() && s.free && s.free.light && !confirmAsked.keys.freelight && (s.tools || []).some(function (x) { return x.id === 'light' && x.unlocked; }) && lightSpot()) out.push({ key: 'freelight', text: STR.cWhyFreeLight });
      // blind3 7: sem nenhuma ferramenta pagavel o aviso nao serve para nada: nao aparece
      if (!lastDayOf(s) && (s.budget | 0) > cap && !confirmAsked.keys.carry && (s.budget | 0) >= minToolCost(s)) out.push({ key: 'carry', text: STR.cWhyCarry(s.budget | 0, cap) });
      return out;
    }
    function lightSpot() {
      var w = game.world, k; if (!w || !w.nodes) return false;
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) { var n = w.nodes[k]; if (isJunction(n) && n.tool !== 'light') return true; }
      return false;
    }
    function confirmPlay(s) {
      var R0 = playReasons(s);
      if (!R0.length) return false;
      confirmWhy = R0;
      R0.forEach(function (r) { confirmAsked.keys[r.key] = 1; });
      var pq = planToday(s); if (pq) { pq.asked = confirmAsked.keys; planMemoSave(); }
      confirmTxt.textContent = R0.map(function (r) { return r.text; }).join(' ');
      // so pontos sobrando: 'Spend them' / 'Start anyway'
      var onlyCarry = R0.length === 1 && R0[0].key === 'carry';
      confirmBack.textContent = onlyCarry ? STR.cSpend : STR.cBack;
      confirmStart.textContent = onlyCarry ? STR.cAnyway : STR.cStart;
      confirmEl.classList.remove('gone'); snd('select'); confirmShownAt = nowMs();
      try { if (confirmStart.focus) confirmStart.focus(); } catch (e) {}
      emitUI('playConfirm', { reasons: R0.map(function (r) { return r.key; }) });
      return true;
    }
    function closeConfirm() { confirmEl.classList.add('gone'); }
    on(confirmStart, 'click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); closeConfirm(); if (game.state.phase === 'plan') startDayNow(game.state); });
    on(confirmBack, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      closeConfirm(); snd('select');
      // volta e pulsa o que falta: o NEW, o ladrilho Road da rua gratis
      confirmWhy.forEach(function (r) {
        if (r.key === 'newj' && r.node) showJunction(r.node, false);
        if (r.key === 'free' && tiles.road) { pulseEl(tiles.road.el); say(STR.freeRoadNow, 3000); }
        if (r.key === 'freelight' && tiles.light) pulseEl(tiles.light.el);
      });
      emitUI('playConfirmBack', {});
    });
    // integracao: a folha da Road crew (v2c) e do mesmo componente: com ela aberta nenhuma faixa entra por cima
    function confirmOpen() { return !confirmEl.classList.contains('gone') || !!(crewEl && !crewEl.classList.contains('gone')) || !!(scEl && !scEl.classList.contains('gone')); }
    function playAsk(s) {
      if (!assistGet('playConfirm', easyOn()) || tutorTalking()) return false;
      var L = morningList(s);
      if (!L.length || !signAffordable(s)) return false;
      if (njDay.asking) { njDay.asking = false; playBtn.classList.remove('crz-ask'); return false; }   // segundo toque: comeca
      // Easy: pede sempre que houver NEW sem sinal (Normal: desligado no perfil, decisao de equilibrio)
      njDay.ask = s.day | 0; njDay.tip = s.day | 0; njDay.asking = true; saveNewJ();   // a dica do dia nao vem depois
      say(STR.playAsk(L.length), 4200);
      playBtn.classList.add('crz-ask');
      showJunction(L[0], false);
      snd('select');
      emitUI('playConfirm', { id: L[0].id, count: L.length });
      return true;
    }
    on(njChipEl, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (modal()) return;
      var L = morningList(game.state);
      if (!L.length) return;
      var n = L[njDay.idx % L.length]; njDay.idx++;
      snd('select');
      showJunction(n, true);
      say(STR.newJChipSay, 2600);
      emitUI('newJunctionTap', { id: n.id, count: L.length, from: 'plan' });
    });
    (function njStyle() {
      try {
        if (!doc.getElementById || doc.getElementById('crz-ui-newj') || !doc.head) return;
        var sty = doc.createElement('style'); sty.id = 'crz-ui-newj';
        sty.textContent = '.crz-njchip{align-self:center;display:flex;align-items:center;gap:6px;min-height:var(--h-chip);padding:2px 12px 2px 10px;' +
          'border-radius:var(--r-pill);border:var(--bw) dotted var(--new);background:var(--white);color:var(--new-text);font-size:var(--fs-sm);font-weight:var(--fw-bold);pointer-events:auto;position:relative}' +
          '.crz-njchip::before{content:"";width:8px;height:8px;border-radius: 50%;background:var(--new);flex:none}' +
          '.crz-njchip::after{content:"";position:absolute;left:50%;top:50%;width:100%;height:100%;min-height:44px;transform:translate(-50%,-50%)}' +
          '.crz-play.crz-ask{box-shadow:0 0 0 3px var(--new)}' +
          '@media (prefers-reduced-motion: no-preference){.crz-play.crz-ask{animation:crz-njask var(--t-ring) ease-in-out 3}}' +
          '@keyframes crz-njask{50%{box-shadow:0 0 0 7px rgba(95,122,150,.35)}}';
        doc.head.appendChild(sty);
      } catch (e) {}
    })();

    // pedido de confirmacao da troca de sinal: {id, tool, free, text}. SEM prazo (passeio da testadora 2026-11-09:
    // leitora de 3-6 s via o pedido expirar em 6 s e o segundo toque abria um pedido novo, em laco). Fica aberto
    // ate um toque noutro lugar, outra ferramenta ou o dia comecar; faixa fixa e botao Cancel discreto.
    // O segundo toque no MESMO no confirma; toque ao lado (ate SWAP_NEAR x raio de toque) conta como o mesmo no.
    var swapAsk = null, SWAP_MS = 6000, SWAP_NEAR = 1.7, ASK_MS = 864e5;
    // mover semaforo com todos em uso: o cruzamento tocado espera o toque no semaforo que vem para ca
    var lightArm = null, LIGHT_ARM_MS = 8000;
    function pulseLights() { var pw = game.world.nodes, q; for (q in pw) if (pw.hasOwnProperty(q) && pw[q] && pw[q].tool === 'light') addPulse(pw[q].x, pw[q].y); }
    function hasOnMap(id) {
      var w = game.world, k; if (!w) return false;
      if (id === 'upgrade') {
        for (k in w.edges) if (w.edges.hasOwnProperty(k) && w.edges[k] && (w.edges[k].lanes || 1) >= 2) return true;
        return false;
      }
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && w.nodes[k] && w.nodes[k].tool === id) return true;
      return false;
    }
    function pulsePlaced(id) {
      var w = game.world, k, c = 0; if (!w) return;
      if (id === 'upgrade') {
        for (k in w.edges) if (w.edges.hasOwnProperty(k) && c < 6) {
          var e = w.edges[k]; if (!e || (e.lanes || 1) < 2) continue;
          var a = w.nodes[e.a], b = w.nodes[e.b]; if (!a || !b) continue;
          addPulse((a.x + b.x) / 2, (a.y + b.y) / 2);
          if (render && typeof render.highlightRoad === 'function') { try { render.highlightRoad(e.id, 2000); } catch (er) {} }
          c++;
        }
        return;
      }
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && c < 6) {
        var n = w.nodes[k]; if (n && n.tool === id) { addPulse(n.x, n.y); c++; }
      }
    }
    // por que o pedido fechou: 'cancel' (botao) diz "Swap cancelled."; outro toque, outra ferramenta ou o dia: calado
    function endSwapAsk(why) {
      if (!swapAsk) return;
      var txt = swapAsk.text, s = game.state;
      swapAsk = null; hideSwapCancel(); syncSelectedNode();
      if (sayEl.textContent === txt) { sayUntil = 0; sayEl.classList.remove('show'); }
      if (why === 'cancel' && s.phase === 'plan') {
        var sf = freeNow('light') && !!(s.free && s.free.light);
        say(sf ? STR.swapCancelFree : STR.swapCancel, 2600);
      }
      emitUI('swapEnd', { why: why || 'tap' });
    }
    // toque perto do no do pedido (ate SWAP_NEAR x raio de toque), com a mesma ferramenta: o mesmo no.
    // Outro no mais perto do dedo que o do pedido ganha (o toque e nele).
    function askNear(sx, sy) {
      if (!swapAsk || sel !== swapAsk.tool || !render.toScreen || !game.world || !game.world.nodes) return null;
      var n = game.world.nodes[swapAsk.id]; if (!n) return null;
      var p = render.toScreen(n.x, n.y), d = dist(sx, sy, p.x, p.y);
      var rr = (render.pickRadius ? render.pickRadius() : CFG.nodePickRadius) * SWAP_NEAR;
      if (!(d <= rr)) return null;
      var o = render.pickNode(sx, sy);
      if (o && o.id !== n.id) { var q = render.toScreen(o.x, o.y); if (dist(sx, sy, q.x, q.y) < d) return null; }
      return n;
    }
    var NEAR_J = 1.7;
    function nearJunction(sx, sy) {
      var w = game.world, nodes = w && w.nodes, k, nd, p, d, best = null, bd;
      if (!nodes || !render.toScreen) return null;
      bd = (render.pickRadius ? render.pickRadius() : CFG.nodePickRadius) * NEAR_J;
      for (k in nodes) if (nodes.hasOwnProperty(k)) {
        nd = nodes[k]; if (!nd || !nd.edges || nd.edges.length < 3) continue;
        p = render.toScreen(nd.x, nd.y); d = dist(sx, sy, p.x, p.y);
        if (d <= bd) { bd = d; best = nd; }
      }
      return best;
    }
    var SIGN_TIER = { yield: 1, stop: 1, cross: 1, light: 2, round: 2 };
    // troca para baixo = a nova ferramenta e pior: camada menor, ou mesma camada e preco de tabela menor.
    // Preco de TABELA (CFG), nunca o de hoje: com o dado 'Free build' o semaforo custa 0 e Yield -> semaforo
    // (para cima) pedia confirmacao como se fosse para baixo (passeio humano 2026-11-09)
    // w_price: o preco de tabela e o do capitulo de hoje (CRZ.toolPrice); a Roundabout trocada 'perde' o que custaria hoje
    function listCost(t) { return CFG.tools && CFG.tools[t] ? listPrice(t) : 0; }
    // w_paid: o que o jogador pagou pela peca deste cruzamento (nao o preco de hoje): o texto da troca diz esse numero
    function paidFor(id, t) {
      try { if (typeof game.paidOf === 'function') return game.paidOf(id) | 0; } catch (e) { warnOnce('game.paidOf', e); }
      return CFG.tools && CFG.tools[t] ? CFG.tools[t].cost | 0 : 0;
    }
    function swapDown(from, to) {
      var a = SIGN_TIER[from] || 0, b = SIGN_TIER[to] || 0;
      return b < a || (b === a && listCost(to) < listCost(from));
    }
    // a nova ferramenta sai de graca agora (dado ou carta), embora tenha preco de tabela
    function freeNow(t) { return listCost(t) > 0 && toolCost(t) === 0; }
    // custo pago hoje pelo sinal deste no (o game reembolsa): le o save (so neste toque, nunca por quadro)
    function paidToday(id) {
      try { var sv = game.save && game.save(); if (sv && sv.placed) return (+sv.placed[id] || 0) > 0; } catch (e) { warnOnce('game.save', e); }
      return false;
    }
    // a troca so pede confirmacao quando o game aceitaria (senao a recusa com o motivo vem direto)
    function swapAllowed(s, n, tool) {
      var dg = n.edges ? n.edges.length : 0, t = s.tools && s.tools.filter ? s.tools.filter(function (x) { return x.id === tool; })[0] : null;
      if (n.portal && dg < 2) return false;
      if (dg < (tool === 'cross' ? 2 : 3)) return false;
      if (t && t.unlocked === false) return false;
      return (s.budget | 0) >= toolCost(tool);
    }
    function toolCost(t) {
      try { if (typeof game.cost === 'function') return game.cost(t); } catch (e) { warnOnce('game.cost', e); }
      return CFG.tools && CFG.tools[t] ? listPrice(t) : 0;
    }
    // toque no lugar do chip do Boost que acabou de sair: o no do chip (null fora disso)
    function chipGhostNode(sx, sy) {
      var g = chipGhost;
      if (g.id === null || nowMs() - g.at > CHIP_GHOST_MS || bchip.id !== null) return null;
      if (!(sx >= g.l && sx <= g.r && sy >= g.t && sy <= g.b)) return null;
      var n = game.world && game.world.nodes ? game.world.nodes[g.id] : null;
      g.id = null;
      return n || null;
    }
    var tapInCamAnim = false;   // pointerdown caiu num movimento de camera pedido pela jogadora (lupa, enquadrar, chip)

    // ---- toque com lupa (plano) ----
    // Dias 20 a 30: a cidade inteira na tela deixa os cruzamentos a 29-33 px uns dos outros em 390x844 e a 18-20 px
    // em 375x667; um dedo pede ~44 px. No plano, com a camera abaixo do zoom confortavel, um toque (ou o comeco de
    // um arrasto de rua) com DOIS OU MAIS alvos a ate MAG_FINGER px do dedo nao age: a camera aproxima ate o
    // confortavel, com o ponto tocado no centro da area livre, e o proximo toque escolhe. Se no confortavel os alvos
    // ainda ficam a menos de 2 x MAG_FINGER px um do outro, aproxima mais, ate MAG_STEP x o confortavel.
    // Alvos: com a Rua (toque ou arrasto), os pontos; com sinal, os nos onde o sinal entra (3+ ruas; a faixa, 2+);
    // com Two lanes ou One-way, as ruas; sem ferramenta, os pontos que respondem ao toque (magTarget: a curva de
    // 2 ruas e a ponta de rua fria nao fazem nada sozinhas e nao contam). So e ambiguo quando o dedo nao esta claramente
    // mais perto de um dos dois alvos mais perto: d2^2 - d1^2 < MAG_GAP2 (px^2). Com o erro do dedo normal (desvio
    // ~8 px), d2^2 - d1^2 e o termo que separa as duas hipoteses (log da razao de verossimilhanca), sem depender da
    // direcao. 300 px^2 medido (web/dev/review/w_lupa/medida.md): acerto >= 97% em toda celula com o menor toque
    // extra; 200 cai a 96%; um corte por razao (d2 <= 1,6 d1 e d1 >= 8 px) caia a 89%. Exemplos: d1 = 4 px e outro a
    // menos de 17,8 px, ou d1 = 12 px e outro a menos de 20,9 px: aproxima. Alvos a 40 px um do outro: o dedo a ate
    // ~16 px de um deles escolhe esse. Toque com um alvo so, zoom confortavel ou acima,
    // corrida, cartas e folhas (modal) e tutorial falando: iguais a antes.
    var MAG_FINGER = 22, MAG_STEP = 2, MAG_MS = 900, MAG_SAY_MS = 2600, MAG_GAP2 = 300;
    var magUntil = 0, magSayUntil = 0;
    // toque sem ferramenta (onTap): em qualquer ponto mostra o disco de influencia; so responde de verdade no
    // cruzamento (3+ ruas: onde o sinal entra), no no com sinal (semaforo: par), no no com anel (heatOf >= HOT_TAP:
    // diz o que ajuda) e no beco (diz que nenhum carro vem). Curva comum (2 ruas) e ponta de rua fria so mostram o
    // disco: nao contam para a lupa e perdem o toque para um ponto que responde ao lado (tapPref)
    function magTarget(s, n) {
      var d = n.edges ? n.edges.length : 0;
      return !!(d >= 3 || n.tool || heatOf(s, n) >= HOT_TAP || isDeadEnd(n));
    }
    // os dois mais perto a distancias parecidas (D: distancias dos alvos dentro do raio do dedo)
    function magSimilar(D) {
      if (D.length < 2) return false;
      D.sort(function (a, b) { return a - b; });
      return D[1] * D[1] - D[0] * D[0] < MAG_GAP2;
    }
    function magPlan(sx, sy, drag) {
      var s = game.state, c = render && render.camera, zl = render && render.zoomLimits;
      if (!s || s.phase !== 'plan' || modal() || tutorTalking() || !c || !zl || !(zl.comfort > 0) || !render.toScreen) return null;
      var comf = zl.comfort, w = game.world;
      if (!(c.zoom < comf - 1e-6) || !w || !w.nodes) return null;
      if (!drag && askNear(sx, sy)) return null;   // segundo toque de uma troca pedida: e dela
      var R = MAG_FINGER, zmax = Math.min(zl.max || comf * MAG_STEP, comf * MAG_STEP), k, n, p, a, b, d, D = [];
      if (!drag && (sel === 'upgrade' || sel === 'oneway')) {
        for (k in w.edges) if (w.edges.hasOwnProperty(k)) {
          var e = w.edges[k]; if (!e) continue;
          a = w.nodes[e.a]; b = w.nodes[e.b]; if (!a || !b) continue;
          var pa = render.toScreen(a.x, a.y), pb = render.toScreen(b.x, b.y);
          d = segDist(sx, sy, pa.x, pa.y, pb.x, pb.y);
          if (d <= R) D.push(d);
        }
        return magSimilar(D) ? { z: comf } : null;
      }
      var need = sel === 'cross' ? 2 : 3, only = null, L = [];
      if (!drag && sel && NODE_TOOLS[sel]) only = function (m) { return (m.edges ? m.edges.length : 0) >= need; };
      else if (!drag && !sel) only = function (m) { return magTarget(s, m); };
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) {
        n = w.nodes[k]; if (!n || (only && !only(n))) continue;
        p = render.toScreen(n.x, n.y); d = dist(sx, sy, p.x, p.y);
        if (d <= R) { L.push(n); D.push(d); }
      }
      if (!magSimilar(D)) return null;
      // w_bugs15: one crossing under the finger is never a reason to zoom (the other target is a ring dot, a sign on a bend or a dead end)
      if (!drag && !(sel && NODE_TOOLS[sel])) { var xc = 0; for (i = 0; i < L.length; i++) if (L[i].edges && L[i].edges.length >= 3) xc++; if (xc < 2) return null; }
      var dmin = Infinity, i, j;
      for (i = 0; i < L.length; i++) for (j = i + 1; j < L.length; j++) dmin = Math.min(dmin, dist(L[i].x, L[i].y, L[j].x, L[j].y));
      var z = comf;
      if (dmin * comf < 2 * R) z = clamp(2 * R / Math.max(dmin, 1e-3), comf, Math.max(comf, zmax));
      return { z: z };
    }
    // aproxima ate mp.z com o ponto tocado no centro da area livre. Pedido explicito da jogadora: vale mesmo com a
    // camera parada depois de construir (camFreeze), como o pan e a pinca
    function magZoom(sx, sy, mp) {
      var wp = render.toWorld(sx, sy);
      camFreeze = false;
      // zoom pedido pelo toque da jogadora: passa por render.byUser, senao o portao da camera segura 600 ms
      try { camFree(function () { camByUser(function () { render.focus(wp.x, wp.y, mp.z, !reducedMotion()); }); }); } catch (e) { warnOnce('render.focus', e); }
      magUntil = nowMs() + MAG_MS;
      snd('select');
      emitUI('magZoom', { zoom: mp.z });
      // w_bugs15: every zoom that is only a zoom says so (it was once per device and only with Guidance: the next one read as a dead tap)
      say(STR.magZoom, MAG_SAY_MS); magSayUntil = nowMs() + MAG_SAY_MS;
    }
    // Toque no mapa com ferramenta na mao sempre responde: poe a peca, ou a faixa diz por que nao. Confere depois do
    // onTap (qualquer caminho): nada mudou, nada foi dito, a camera nao foi pedida e nenhum pedido ficou aberto
    function tapSnap() {
      var w = game.world, k, n, o = '';
      if (w && w.nodes) for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && w.nodes[k]) { n = w.nodes[k]; o += (n.tool || '-') + (n.pair == null ? '' : n.pair) + ','; }
      return o + '|' + (w && w.edges ? Object.keys(w.edges).length : 0) + '|' + (game.state.budget | 0) + '|' + sayN + '|' + magUntil + '|' + (swapAsk ? 1 : 0) + (lightArm ? 1 : 0) + (sel || '') + (choiceOpen() ? '|card' : '');   // w_place: o cartao aberto pela peca na mao e uma resposta
    }
    function onTapAnswered(sx, sy) {
      var s = game.state, armed = s.phase === 'plan' && !!sel && sel !== 'road' && !modal(), moving = tapInCamAnim, was = armed ? tapSnap() : '';
      onTap(sx, sy);
      if (!armed || tapSnap() !== was) return;
      snd('deny');
      say(moving ? STR.deny.tapMoving : STR.deny.tapNone(STR.tools[sel] || sel), 2600);
      emitUI('tapUnanswered', { tool: sel, moving: moving });
    }
    // folha que abre sozinha nao abre com ferramenta na mao nem logo depois de um toque no mapa (CFG.sheetIdleMs): espera o proximo momento parado
    var lastMapTapAt = -1e9;
    // w_bugs13 (cego 13, dias 16 e 24: a folha da Road crew abriu logo depois de um cartao fechar e comeu o toque seguinte): o tempo
    // parado conta desde o ultimo toque em QUALQUER lugar (bandeja, cartao, botoes: lastTouchAt) e desde o fechamento de um cartao
    var choiceClosedAt = -1e9, rawTouchAt = -1e9;   // rawTouchAt: ultimo pointerdown real em qualquer lugar (lastTouchAt comeca em 'agora')
    function mapBusy() {
      var idle = CFG.sheetIdleMs | 0, t = nowMs();
      return !!sel || t - lastMapTapAt < idle || t - rawTouchAt < idle || t - choiceClosedAt < idle;
    }
    function onTap(sx, sy) {
      var s = game.state;
      lastMapTapAt = nowMs();
      // camera andando por pedido da jogadora (lupa, enquadrar, chip; CAM_MS = 450 ms no render) quando o dedo desceu:
      // o toque seria resolvido contra um mapa em movimento e podia pegar o no errado. Ignora sem acao, aviso,
      // som nem carga. Movimento automatico (inicio da corrida, abertura do plano) nao chega aqui: o render o para
      // no pointerdown e o toque age no mapa parado. Botoes do HUD sao DOM e nao passam por aqui.
      if (tapInCamAnim) { tapInCamAnim = false; return; }
      if (s.phase === 'plan' && sel === 'road' && roadSug && roadSugTap(sx, sy)) return;   // w_noopt: a rua sugerida vem antes da lupa
      if (s.phase === 'plan') { var mp = magPlan(sx, sy, false); if (mp) { magZoom(sx, sy, mp); return; } }
      // plano, mao vazia: a curva comum (2 ruas, sem sinal nem anel) nao responde ao toque; um ponto que responde
      // ao lado dela (ate 14 px mais longe, regra do pickNode) ganha
      var tapPref = s.phase === 'plan' && !sel ? function (m) { return magTarget(s, m); } : undefined;
      var hitN = render.pickNode(sx, sy, tapPref);
      // o pedido de troca vale para o proximo toque no mesmo no (ou ao lado) com a mesma ferramenta
      var askN = s.phase === 'plan' ? askNear(sx, sy) : null;
      if (askN) hitN = askN;
      if (swapAsk && !(hitN && hitN.id === swapAsk.id && sel === swapAsk.tool)) endSwapAsk('tap');
      var gn = s.phase === 'run' ? chipGhostNode(sx, sy) : null;
      if (gn) hitN = gn;
      // w_bugs12: a tap on a note over the map never does nothing. The Boost chip takes a tap a little off its centre (it hops
      // between crossings); the retorno balloon (it ignores touches) is dismissed by a tap on it
      if (s.phase === 'run' && !hitN && !modal()) {
        var cr = bchip.id !== null && !bchipEl.classList.contains('gone') ? rectOf(bchipEl) : null, fr = fbkEl.classList.contains('on') ? rectOf(fbkEl) : null, M = 14;
        if (cr && sx >= cr.l - M && sx <= cr.r + M && sy >= cr.t - M && sy <= cr.b + M) { chipTap(); emitUI('noteTap', { kind: 'chip' }); return; }
        if (fr && sx >= fr.l && sx <= fr.r && sy >= fr.t && sy <= fr.b) { snd('select'); fbkHide(); emitUI('noteTap', { kind: 'balloon' }); return; }
      }
      if (hitN) emitUI('nodeTap', { id: hitN.id });
      if (s.phase === 'run') { runTap(s, hitN, sx, sy, false, !!gn); return; }
      // w_choice2: no resumo, o toque num cruzamento com linha do dia seguinte (a que 'and N more' manda ver) a diz na faixa
      if (s.phase === 'summary' && hitN && Object.prototype.hasOwnProperty.call(sumTexts, hitN.id)) { addPulse(hitN.x, hitN.y); snd('select'); sayUntil = 0; say(sumTexts[hitN.id], 5000); emitUI('sumLine', { id: hitN.id }); return; }
      if (s.phase !== 'plan') return;
      var n, pk, p;
      if (sel && NODE_TOOLS[sel]) {
        // dois nos sob o dedo: prefere o cruzamento (onde o sinal entra) a ponta de rua
        n = askN || render.pickNode(sx, sy, isJunctionish);
        // dedo caiu na rua ao lado do cruzamento (curva, reta ou nada sob o dedo): ate 1,7x o raio de toque
        // de um no de 3+ ruas, o toque e nele (antes respondia 'Stops, yields and lights need a crossing')
        if (!askN && (!n || (!n.portal && (n.edges ? n.edges.length : 0) < (sel === 'cross' ? 2 : 3)))) n = nearJunction(sx, sy) || n;
        if (!n) { if (render.pickEdge(sx, sy)) snd('deny'); say(STR.deny.notJunction); var wp0 = render.toWorld ? render.toWorld(sx, sy) : { x: sx, y: sy }; pulseValid(sel, wp0.x, wp0.y); return; }
        newCmp = null;
        if (!placeGate(n, sel, s)) {
          placeNodeTool(n, sel, s);
          // w_place: a primeira peca num cruzamento sem repeticao de ontem: a faixa diz por que nao houve comparacao (uma vez)
          if (newCmp === n.id && n.tool === sel && !seen('newNoCmp') && sayEl.textContent !== handStr('Moved', sel) && sayEl.textContent !== STR.paired) { markSeen('newNoCmp'); sayUntil = 0; say(STR.choice.newCross, 4000); emitUI('newNoCompare', { id: n.id }); }
          newCmp = null;
        }
        return;
      }
      // ferramenta de rua (faixas, mao unica) e toque num anel de dica (vermelho ou o tracejado de ontem):
      // o anel nao e a rua. Nada se constroi; diz o que ajuda ali (qual rua) e pede o toque na rua
      // A rua tem prioridade (passeio humano 2026-11-09: toque no meio da rua, perto de um anel, dava a dica e
      // nao alargava): o anel so responde quando o dedo esta em cima do proprio ponto (onDot) ou fora de rua
      if (sel === 'upgrade' || sel === 'oneway') {
        var rn = render.pickNode(sx, sy), rpk = render.pickEdge(sx, sy);
        if (rn && rpk && !onDot(rn, sx, sy)) rn = null;
        // w_place (cego 11, dias 11 e 14: Lanes na mao, o anel so dava a dica): com o 'e se' de ontem, o anel abre o cartao
        if (rn && heatOf(s, rn) >= HOT_TAP && !tutorScript() && hasReplay(rn) && openChoice(s, rn, { pick: sel === 'upgrade' ? 'upgrade' : null })) { snd('select'); emitUI('ringTap', { id: rn.id, tool: sel, card: true }); return; }
        if (rn && heatOf(s, rn) >= HOT_TAP) {
          snd('select'); addPulse(rn.x, rn.y);
          var ra = sel === 'upgrade' ? nodeAdvice(s, rn) : null;
          if (ra) showAdviceRoad(ra);
          say(ra && ra.key === 'card' ? STR.ringEdgeTool : ra && ra.tool === 'upgrade' && ra.dir ? STR.ringEdgeLane(ra.dir) : ra ? ra.text : STR.ringEdgeTool);
          emitUI('ringTap', { id: rn.id, tool: sel });
          return;
        }
      }
      if (sel === 'upgrade') {
        pk = render.pickEdge(sx, sy); if (!pk) { say(STR.deny.emptyRoad); return; }
        p = edgePoint(pk);
        if ((pk.edge.lanes || 1) >= 2 && typeof game.downgradeRoad === 'function') {
          var dr = game.downgradeRoad(pk.edge.id);
          if (dr && dr.ok) { snd('select'); addPulse(p.x, p.y); say(STR.upgradePicked, 4000); emitUI('upgradePicked', { id: pk.edge.id }); }
          else toolResult(dr, p.x, p.y, 'build', 'upgrade');
          return;
        }
        var ur = game.upgradeRoad(pk.edge.id);
        toolResult(ur, p.x, p.y, 'build', 'upgrade');
        if (ur && ur.ok) {
          fbkPlaced(ur, ur.watchId != null && game.world.nodes ? game.world.nodes[ur.watchId] : null, false);
          if (ur.fromHand) say(STR.upgradeMoved, 2600);
        }
        return;
      }
      if (sel === 'oneway') {
        pk = render.pickEdge(sx, sy); if (!pk) { say(STR.deny.emptyRoad); return; }
        p = edgePoint(pk);
        var owf = typeof game.onewayFlipped === 'function' ? game.onewayFlipped(pk.edge.id) : false;
        var owr = game.setOneway(pk.edge.id, nextOneway(pk.edge.oneway || 0, pk.t, owf));
        toolResult(owr, p.x, p.y, 'place', 'oneway');
        if (owr && owr.ok) {
          say(owr.off ? STR.owOff(owr.refund | 0) : owr.flipped ? STR.owFlipped : STR.owPlaced(owr.cost | 0), 3200);
          emitUI('onewaySet', { id: pk.edge.id, dir: owr.dir, cost: owr.cost | 0, refund: owr.refund | 0 });
        }
        return;
      }
      if (sel === 'road') {
        // estrada so por arrasto: toque num no pulsa o no como dica de "arraste daqui"
        // (2026-11-09: antes so pulsava, sem faixa; quem pegou a Rua por engano nao sabia o que fazer)
        n = render.pickNode(sx, sy);
        if (n) { addPulse(n.x, n.y); snd('select'); say(STR.roadTapHint); emitUI('roadTapHint', { id: n.id }); }
        return;
      }
      // sem ferramenta
      // marca de evento de lugar (anel pontilhado com rotulo): o balao diz o que vai acontecer e o que ajuda
      if (!(pairArm && nowMs() < pairArm.until) && evTap(sx, sy)) return;
      n = render.pickNode(sx, sy, tapPref);
      var armed = pairArm && nowMs() < pairArm.until ? pairArm : null;
      if (!n) {
        if (armed) say(STR.pairCancel);
        pairFirst = null; pairArm = null; pairRep = null; hidePairChip(); syncSelectedNode(); showInfluence(null, 0); return;
      }
      showInfluence(n.id, 1500);
      // Parear so depois do chip "Pair lights" (pairArm). Toque normal num semaforo so da a dica e mostra o chip
      if (armed && n.id !== armed.from) { pairTapArmed(armed, n); return; }
      if (armed && n.id === armed.from) { pairArm = null; pairRep = null; say(STR.pairCancel); syncSelectedNode(); }
      fbkTap(n.id);
      // anel: o cartao da escolha (w_choice) com o que o 'e se' mediu; sem 'e se' guardado, a frase de sempre (e qual rua)
      // w_place (cego 11, dia 5): sem anel, o cruzamento com o 'e se' de ontem tambem abre o cartao no primeiro toque
      if (heatOf(s, n) >= HOT_TAP) { if (!openChoice(s, n)) say(tapAdvice(s, n)); }
      else if (!tutorScript() && hasReplay(n) && openChoice(s, n)) { /* o cartao */ }
      else if (isDeadEnd(n)) say(STR.deadEndTap);
      else if ((n.tool === 'light' || n.tool === 'stop' || n.tool === 'yield') && s.phase === 'plan' && tiles[n.tool]) say(handStr('TapMove', n.tool));
      if (n.tool === 'light') {
        pairFirst = n.id; pairUntil = nowMs() + PAIR_MS; snd('select');
        emitUI('pairTap', { id: n.id });
        showPairChip(n);
        syncSelectedNode();
      } else { pairFirst = null; hidePairChip(); syncSelectedNode(); snd('select'); }
    }
      // w_place: a regra numa frase: com a peca na mao, num cruzamento que levou carros ontem, a peca entra direto so quando a
      // repeticao de ontem a diz 'better' ali e nada sai do lugar; senao o cartao abre com ela marcada (um toque na linha poe).
      // Cruzamento novo (sem repeticao): direto, e a faixa diz uma vez por que nao ha comparacao. Tutorial roteirizado: como sempre
      function hasReplay(n) {
        try { return !!(n && degOf(n) >= 3 && typeof game.canReplay === 'function' && game.canReplay(n.id)); } catch (e) { warnOnce('game.canReplay', e); return false; }
      }
      var pickAsk = null, PICK_ASK_MS = 60000, newCmp = null;
      // a linha 'New crossing' so faz sentido para quem ja pode ver cartoes: algum cruzamento do mapa tem a repeticao de ontem
      function cardsLive() {
        var w = game.world, k;
        if (!w || !w.nodes || typeof game.canReplay !== 'function') return false;
        for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && w.nodes[k] && degOf(w.nodes[k]) >= 3) { try { if (game.canReplay(+k)) return true; } catch (e) { return false; } }
        return false;
      }   // {id, tool, until}: a mesma peca no proprio cruzamento, depois do cartao, pega a peca
      function placeGate(n, tool, s) {
        if (!(tool === 'stop' || tool === 'yield' || tool === 'light' || tool === 'round') || s.phase !== 'plan') return false;
        if (tutorScript() || modal() || choiceOpen()) return false;
        if (swapAsk && swapAsk.id === n.id && swapAsk.tool === tool) return false;   // segundo toque de uma troca ja pedida
        if (tool === 'light' && n.tool === 'light' && lightArm && nowMs() < lightArm.until) return false;   // o semaforo que vem para ca
        var same = n.tool === tool, pa = pickAsk;
        pickAsk = null;
        if (same && pa && pa.id === n.id && pa.tool === tool && nowMs() < pa.until) return false;   // ja viu o cartao: pega
        if (same && tool === 'round') return false;   // a recusa de sempre
        if (!hasReplay(n)) {
          newCmp = !n.tool && !seen('newNoCmp') && !tutorTalking() && cardsLive() ? n.id : null;
          return false;
        }
        var c = choiceData(n.id); if (!c && wiAdd(n.id)) c = choiceData(n.id);
        if (!c) return false;
        var row = null, i;
        for (i = 0; i < c.rows.length; i++) if (c.rows[i].tool === tool) row = c.rows[i];
        if (!same && !row) return false;
        if (!same && !n.tool && !c.pending && row.w !== null && row.verdict === 'better' && !row.qual && row.afford && !row.capped) {
          var rec = null;
          try { rec = typeof game.promiseFor === 'function' ? game.promiseFor(n.id, tool) : null; } catch (e) { warnOnce('game.promiseFor', e); }
          cardPick = rec ? { id: n.id, tool: tool, rec: rec, until: nowMs() + 8000 } : null;
          placeNodeTool(n, tool, s);
          if (n.tool === tool) {
            // nada saiu do lugar (sem troca): a faixa do veredito vence a do retorno ('Stop placed here.', a dica do Yield, o mover da mao)
            sayUntil = 0; say(STR.choice.placedBetter(STR.tools[tool] || tool), 4500);
            emitUI('placeVerdict', { id: n.id, tool: tool, verdict: row.verdict });
          }
          return true;
        }
        if (!openChoice(s, n, same ? { pick: null, keep: tool } : { pick: tool })) return false;
        if (same) pickAsk = { id: n.id, tool: tool, until: nowMs() + PICK_ASK_MS };
        emitUI('placeCard', { id: n.id, tool: tool, same: same, verdict: row ? row.verdict : null });
        return true;
      }
      // w_choice: o miolo de 'ferramenta de cruzamento na mao + toque no no', o mesmo codigo para o toque no mapa e para
      // uma linha do cartao da escolha (assim custo, recusa, troca, mao, teto de semaforos e Undo sao os mesmos)
      function placeNodeTool(n, sel, s) {
        // semaforo: tocar um semaforo o pega (vai para a mao, de graca); com todos em uso, tocar um cruzamento sem
        // semaforo pede o semaforo que vem para ca e o toque nele move num passo so
        if (sel === 'light' && typeof game.moveLight === 'function') {
          var lcap = game.lightCap ? game.lightCap() : null, larm = lightArm && nowMs() < lightArm.until ? lightArm : null;
          if (n.tool === 'light') {
            var tn = larm ? game.world.nodes[larm.to] : null;
            lightArm = null;
            if (tn && tn.tool !== 'light') {
              var mr = game.moveLight(n.id, tn.id);
              toolResult(mr, tn.x, tn.y, 'place', 'light');
              if (mr && mr.ok) {
                keepCardPromise(tn, 'light');   // w_where: a luz que veio pelo cartao leva a promessa dele (o dia seguinte confere)
                addPulse(tn.x, tn.y);
                // w_where: veio do semaforo que o jogo apontou: a faixa diz a peca que deixa o cruzamento antigo como estava
                var put = larm.from === n.id && larm.tool && STR.tools[larm.tool] ? larm.tool : null;
                if (put) { addPulse(n.x, n.y); whereAm.put = { id: n.id, tool: put, day: game.state.day | 0 }; }
                say(put ? STR.lightMovedPut(STR.tools[put], mr.toHand && STR.tools[mr.toHand] ? STR.tools[mr.toHand] : null) : (mr.toHand ? handStr('ToHand', mr.toHand) : STR.lightMoved), mr.toHand || put ? 5000 : 2600);
                emitUI('lightMoved', { from: n.id, to: tn.id, put: put });
              }
              return;
            }
            var pr = game.removeTool(n.id);
            if (pr && pr.ok) { snd('select'); addPulse(n.x, n.y); say(STR.lightPicked, 4000); emitUI('lightPicked', { id: n.id }); }
            else toolResult(pr, n.x, n.y, 'place', 'light');
            return;
          }
          if (lcap && !(lcap.hand > 0) && isFinite(lcap.cap) && lcap.used >= lcap.cap && lcap.used > 0 && (n.edges ? n.edges.length : 0) >= 3) {
            // w_where: o 'e se' diz de qual cruzamento o semaforo sai sem perda (game.lightMoveFor): so ele pulsa, e a faixa diz a peca
            var mv = null; try { mv = typeof game.lightMoveFor === 'function' ? game.lightMoveFor(n.id) : null; } catch (e) { warnOnce('game.lightMoveFor', e); }
            var mvN = mv && game.world.nodes[mv.from] && STR.tools[mv.tool] ? game.world.nodes[mv.from] : null;
            lightArm = { to: n.id, until: nowMs() + LIGHT_ARM_MS, from: mvN ? mvN.id : null, tool: mvN ? mv.tool : null };
            snd('select');
            if (!mvN) addPulse(n.x, n.y);   // w_where: com o semaforo apontado, so ele pulsa ('Tap the pulsing light')
            if (mvN) {
              // o semaforo apontado fora da area livre (atras da faixa ou fora da tela): a camera vai ate ele, como no 'feed' do cartao
              var under = false;
              try { var sr = sayEl.getBoundingClientRect ? sayEl.getBoundingClientRect() : null, sp = render.toScreen(mvN.x, mvN.y); under = !!(sr && sr.bottom > 0 && sp.y < sr.bottom + 28 + (sr.bottom - sr.top)); } catch (e) { under = false; }
              if (render && render.focus && render.toScreen && (under || !onFree(mvN))) { try { camFree(function () { camByUser(function () { render.focus(mvN.x, mvN.y, undefined, !reducedMotion()); }); }); } catch (e) { warnOnce('render.focus', e); } }
              addPulse(mvN.x, mvN.y); say(STR.lightMoveFrom(STR.tools[mv.tool]), LIGHT_ARM_MS);
            }
            else { pulseLights(); say(STR.lightMoveAsk, LIGHT_ARM_MS); }
            emitUI('lightMoveAsk', { to: n.id, from: mvN ? mvN.id : null });
            return;
          }
        }
        // Stop e Yield: tocar um sinal ja posto pega ele (vai para a mao, de graca); tocar outro cruzamento poe
        if ((sel === 'stop' || sel === 'yield') && n.tool === sel && typeof game.removeTool === 'function') {
          var rp = game.removeTool(n.id);
          if (rp && rp.ok) { snd('select'); addPulse(n.x, n.y); say(handStr('Picked', sel), 4000); emitUI(sel + 'Picked', { id: n.id }); }
          else toolResult(rp, n.x, n.y, 'place', sel);
          return;
        }
        // troca de sinal: o comprado em dia anterior nao volta; pede um segundo toque (3 s).
        // O colocado hoje e reembolsado pelo game: troca direto
        // Troca de sinal (2026-11-09): para cima (mesmo custo ou mais caro) troca direto; para baixo (perde
        // valor: Light/Round para Stop/Yield/Crosswalk, ou mais caro para mais barato) pede um segundo toque
        // em 6 s. O sinal colocado hoje e reembolsado pelo game: troca direto
        var was = n.tool && n.tool !== sel && NODE_TOOLS[n.tool] && swapAllowed(s, n, sel) ? n.tool : null;
        // pontos perdidos = preco de tabela do antigo (com o semaforo gratis hoje, toolCost('light') e 0 e a troca
        // para baixo de um semaforo antigo passava sem pedir)
        var paid = was ? paidToday(n.id) : false, lost = was && !paid && !(was === 'light' || was === 'stop' || was === 'yield') ? paidFor(n.id, was) : 0;   // peca da mao trocada vai para a mao
        var askFor = swapAsk && swapAsk.id === n.id && swapAsk.tool === sel;
        if (was && lost > 0 && swapDown(was, sel) && !askFor) {
          swapAsk = { id: n.id, tool: sel, free: freeNow(sel), text: STR.swapAsk(STR.tools[was], lost) };
          snd('select'); addPulse(n.x, n.y); showInfluence(n.id, SWAP_MS);
          var o5 = ov(); if (o5) o5.selectedNode = n.id;
          say(swapAsk.text, ASK_MS); showSwapCancel();
          emitUI('swapAsk', { id: n.id, from: was, tool: sel });
          return;
        }
        if (askFor) emitUI('swapConfirm', { id: n.id, tool: sel });
        endSwapAsk(askFor ? 'confirm' : null);
        // preco ANTES de colocar: o game gasta a gratuidade no placeTool e depois o semaforo volta a custar 4
        // (a faixa dizia "Replaced yield with traffic light: 4 build points" de um semaforo gratis)
        var costNow = toolCost(sel), wasFree = freeNow(sel);
        var tr = game.placeTool(n.id, sel);
        toolResult(tr, n.x, n.y, 'place', sel);
        if (tr && tr.ok) emitUI('toolPlaced', { tool: sel, id: n.id });
        if (tr && tr.ok) keepCardPromise(n, sel);   // w_choice: a escolha do cartao guarda o numero prometido
        if (tr && tr.ok && was && sel === 'cross') {
          // faixa sobre um sinal: diz que troca o sinal e o que a faixa faz (palavras simples)
          say(STR.crossOver(costNow), 5000); showSwapUndo(5000);
        } else if (tr && tr.ok && was) {
          say(STR.swapped(STR.tools[was], STR.tools[sel], costNow, lost, wasFree), 5000);
          showSwapUndo(5000);
        } else if (tr && tr.ok && sel === 'light' && tr.paired !== undefined && tr.paired !== null) {
          // v2: o par automatico (game.autoPair) se anuncia uma vez, no lugar; o render desenha a linha do par
          var pn = game.world.nodes[tr.paired]; addPulse(n.x, n.y); if (pn) addPulse(pn.x, pn.y);
          say(STR.paired, 2600);
        } else if (tr && tr.ok && sel !== 'yield') {
          // retorno imediato: anel no no e a frase 'Stop placed here.'
          addPulse(n.x, n.y); say(STR.placed(STR.tools[sel] || TL[sel] || sel), 1800);
        }
        if (tr && tr.ok && sel === 'yield') yieldBusyHint(s, n);
        if (tr && tr.ok) fbkPlaced(tr, n, !was && sel !== 'yield');
        // peca da mao: a frase do mover (de graca) ou da peca que foi para a mao vence a do retorno
        if (tr && tr.ok && tr.toHand) say(handStr('ToHand', tr.toHand), 4000);
        else if (tr && tr.ok && tr.fromHand && !was) say(handStr('Moved', tr.fromHand), 2600);
        // ponta de rua: a fila espera no cruzamento a frente; pulsa ele (o lugar certo do sinal).
        // Sem cruzamento a frente, a frase muda (nada de "pulsing crossing" sem pulso)
        if (tr && !tr.ok && tr.reason === 'portal') {
          var qj = queueJunction(game.world, n, function (o) { return heatOf(s, o); });
          if (qj) { addPulse(qj.x, qj.y); later(function () { addPulse(qj.x, qj.y); }, 900); }
          else say(STR.deny.portalNone);
        }
        return;
      }
    // dedo em cima do ponto do no (nao so dentro do raio de toque): o anel vence a rua so aqui
    function onDot(n, sx, sy) {
      if (!render.toScreen) return true;
      var p = render.toScreen(n.x, n.y), rr = render.pickRadius ? render.pickRadius() : CFG.nodePickRadius;
      return dist(sx, sy, p.x, p.y) <= Math.max(12, rr * 0.5);
    }

    // ---- parear semaforos com intencao ----
    // outros semaforos no mapa alem deste (sem outro, o chip nao aparece)
    function otherLight(id) {
      var w = game.world, q;
      for (q in w.nodes) if (w.nodes.hasOwnProperty(q) && w.nodes[q] && w.nodes[q].tool === 'light' && w.nodes[q].id !== id) return true;
      return false;
    }
    function hasPair(n) { return !!n && n.pair !== null && n.pair !== undefined; }
    function pairTapArmed(armed, n) {
      var a = game.world.nodes[armed.from];
      emitUI('pairTap', { id: n.id });
      if (!a || a.tool !== 'light') { pairArm = null; pairRep = null; hidePairChip(); syncSelectedNode(); return; }
      if (n.tool !== 'light') { snd('deny'); flash(n.x, n.y, 'bad'); say(STR.pairNotLight); return; }   // continua armado
      if (a.pair === n.id && n.pair === a.id) { snd('deny'); say(STR.pairSame); pairArm = null; pairRep = null; hidePairChip(); syncSelectedNode(); return; }
      // um dos dois ja tem par com outro: o par antigo nunca sai calado; pede o segundo toque no mesmo semaforo
      var rep = (hasPair(a) && a.pair !== n.id) || (hasPair(n) && n.pair !== a.id);
      var again = pairRep && pairRep.a === a.id && pairRep.b === n.id && nowMs() < pairRep.until;
      if (rep && !again) {
        pairRep = { a: a.id, b: n.id, until: nowMs() + PAIR_MS };
        pairArm.until = nowMs() + PAIR_MS;
        snd('select'); addPulse(n.x, n.y);
        say(STR.pairReplace, PAIR_MS);
        emitUI('pairReplaceAsk', { a: a.id, b: n.id });
        return;
      }
      var r = game.pairLights(a.id, n.id);
      result(r, n.x, n.y, 'place');
      if (r && r.ok) { flash(a.x, a.y, 'ok'); say(STR.paired); }   // sinal de que deu certo (o render desenha a linha)
      else say(denyText(r, 'light', game.state, CFG));
      pairArm = null; pairRep = null; pairFirst = null; hidePairChip(); syncSelectedNode();
    }
    // chip "Pair lights" ao lado do semaforo tocado (como o chip do Boost); fica ate PAIR_MS ou outro toque
    var pchip = { id: null, x: -1, y: -1, side: null, rects: null };
    function showPairChip(n) {
      // v2 (CFG.lightsAutoPair): o par e automatico; a pilula 'Pair lights' nao aparece mais
      if (CFG.lightsAutoPair !== false || !otherLight(n.id) || !render) { hidePairChip(); return; }
      pchip.id = n.id; pchip.side = null; pchip.rects = hudRects();
      pairChipEl.classList.remove('gone'); pairChipEl.classList.remove('armed');
      pairChipTick(true);
    }
    function hidePairChip() {
      if (pchip.id === null) return;
      pchip.id = null; pchip.x = pchip.y = -1;
      pairChipEl.classList.add('gone'); pairChipEl.classList.remove('armed');
    }
    function pairChipTick(force) {
      if (pchip.id === null) return;
      var s = game.state, n = game.world.nodes[pchip.id], now = nowMs();
      var live = pairArm ? now < pairArm.until : now < pairUntil;
      if (!n || n.tool !== 'light' || s.phase !== 'plan' || modal() || !live) {
        if (pairArm && !(now < pairArm.until)) { pairArm = null; pairRep = null; }
        pairFirst = null; hidePairChip(); syncSelectedNode(); return;
      }
      if (!render.toScreen) return;
      var p = render.toScreen(n.x, n.y), W = render.width || root.innerWidth || 390, H = render.height || root.innerHeight || 844;
      // o chip nao cobre outro cruzamento (o segundo semaforo e justamente o proximo toque): pontos dos nos
      // vizinhos entram como retangulos de 36 px; sem lado livre, o chip cai no lado que cobre menos (fallback)
      var av = (pchip.rects || []).slice(), avL = (pchip.rects || []).slice(), q, m, mp, rq;
      for (q in game.world.nodes) if (game.world.nodes.hasOwnProperty(q)) {
        m = game.world.nodes[q]; if (!m || m.id === n.id || !(m.edges && m.edges.length >= 2)) continue;
        mp = render.toScreen(m.x, m.y);
        if (Math.abs(mp.x - p.x) < PCHIP_W + 60 && Math.abs(mp.y - p.y) < PCHIP_H + 60) {
          rq = { l: mp.x - 18, t: mp.y - 18, r: mp.x + 18, b: mp.y + 18 };
          av.push(rq);
          if (m.tool === 'light') avL.push(rq);
        }
      }
      var c = pillPlace(p, W, H, av, PCHIP_W, PCHIP_H, pchip.side);
      // cidade densa (nenhum lado livre de todos os nos): pelo menos nao cobre outro semaforo, que e o proximo
      // toque do pareamento (playtest cego 3, 104 a 106 e 118: a pilula tapava o segundo semaforo)
      if (c.side === null && avL.length > (pchip.rects || []).length) c = pillPlace(p, W, H, avL, PCHIP_W, PCHIP_H, pchip.side);
      if (c.side === null) c = pillPlace(p, W, H, pchip.rects || [], PCHIP_W, PCHIP_H, pchip.side);
      pchip.side = c.side;
      if (force || Math.abs(c.x - pchip.x) >= 1 || Math.abs(c.y - pchip.y) >= 1) {
        pchip.x = c.x; pchip.y = c.y;
        pairChipEl.style.left = Math.round(c.x) + 'px';
        pairChipEl.style.top = Math.round(c.y) + 'px';
      }
    }

    // ---- eventos de ponteiro ----
    // Audio: o iOS so cria/retoma o AudioContext dentro de um gesto (touchend/pointerup/click).
    // Chamamos unlock em TODO gesto, nao uma vez so: depois de uma ligacao, do Siri ou de voltar
    // do segundo plano o contexto fica 'interrupted' e so volta com outro gesto. unlock e barato.
    function unlockAudio() { if (audio && audio.unlock) { try { audio.unlock(); } catch (e) { warnOnce('audio.unlock', e); } } }
    var nopass = { passive: false }, pass = { passive: true, capture: true };
    on(doc, 'pointerdown', unlockAudio, true);
    on(doc, 'pointerdown', function () {
      lastTouchAt = nowMs(); rawTouchAt = lastTouchAt;
      if (render && render.touchNote) render.touchNote();   // botao do HUD: o mapa tambem nao reenquadra sozinho sob esse toque
      // faixa de dica do tutorial: some no primeiro toque
      if (stripOn && sayUntil) { stripOn = false; sayUntil = 0; sayEl.classList.remove('show'); }
    }, true);
    on(doc, 'pointerup', unlockAudio, true);
    on(doc, 'pointerup', function () { if (render && render.touchNote) render.touchNote(); }, true);
    on(doc, 'click', unlockAudio, true);
    on(doc, 'touchend', unlockAudio, true);
    // um listener de touchstart (vazio) e o que faz o :active funcionar no Safari iOS
    on(doc, 'touchstart', function () {}, pass);

    function pd(e) { if (e && e.preventDefault) e.preventDefault(); }
    // pinca da pagina (Safari ignora user-scalable=no), duplo toque, selecao, rolagem elastica
    on(doc, 'gesturestart', pd, nopass);
    on(doc, 'gesturechange', pd, nopass);
    on(doc, 'gestureend', pd, nopass);
    on(doc, 'dblclick', pd, nopass);
    on(doc, 'selectstart', pd, nopass);
    on(doc, 'touchmove', function (e) {
      // textos do tutorial/menu (#crz-overlay-root) e o painel do resumo podem rolar
      var t = e.target;
      try { if (t && t.closest && t.closest(SCROLL_OK)) return; } catch (x) {}
      if (e.cancelable !== false) pd(e);
    }, nopass);
    on(canvas, 'contextmenu', pd);

    function capture(e) { try { if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); } catch (x) {} }
    on(canvas, 'pointerdown', function (e) {
      pd(e);
      if (e.pointerType === 'mouse' && e.button) return; // so botao esquerdo
      if (sheetOpen) closeSheet();
      if (modal()) { if (gesture.count()) dropGesture(); return; }
      capture(e);
      if (gesture.count() === 0 || e.isPrimary) readRect();
      // camera congelada durante o gesto: animacao em curso para no quadro visivel ANTES do alvo
      // do toque ser lido (fitRoom ao pegar a Rua, reveal do tutorial); nada a move ate soltar
      // Regra unica da camera sob o dedo (w_int2): o render ja parou aqui qualquer movimento AUTOMATICO (o toque
      // age no mapa parado que se ve). Se ainda anda, e um movimento PEDIDO pela jogadora (lupa, enquadrar, chip),
      // que termina: o toque deste gesto cairia num mapa em movimento e e ignorado (onTap, canRoad, magAt)
      if (gesture.count() === 0) tapInCamAnim = !!(render && render.animating && render.animating());
      if (!tapInCamAnim) camHold(true);
      if (game.state.phase === 'plan') mapTouched = true;
      var p = localXY(e); gesture.down(e.pointerId, p.x, p.y, nowMs(), !!e.isPrimary);
    });
    // overlay modal abriu no meio do gesto (tutorial, menu): o arrasto morre ali, nada se constroi por baixo
    function camHold(on) { try { if (render && render.hold) render.hold(on); } catch (x) {} }
    function camRelease() { if (gesture.count() === 0) camHold(false); }
    on(canvas, 'pointermove', function (e) {
      if (modal()) { if (gesture.count()) dropGesture(); return; }
      var p = localXY(e); gesture.move(e.pointerId, p.x, p.y, nowMs());
    });
    on(canvas, 'pointerup', function (e) {
      if (modal()) { if (gesture.count()) dropGesture(); return; }
      var p = localXY(e); gesture.up(e.pointerId, p.x, p.y, nowMs());
      camRelease();
    });
    on(canvas, 'pointercancel', function (e) { gesture.cancel(e.pointerId); camRelease(); });
    // captura perdida (o Safari tira a captura sem pointerup): cancela o gesto. Depois de um pointerup
    // normal o ponteiro ja saiu da maquina e cancel nao faz nada
    on(canvas, 'lostpointercapture', function (e) { gesture.cancel(e.pointerId); camRelease(); });

    // app vai para segundo plano (home, troca de app, bloqueio): nenhum pointerup vai chegar.
    // Larga o gesto, apaga a estrada fantasma e salva (o iOS mata abas em segundo plano).
    function dropGesture() {
      gesture.reset(); clearGhost(); holding = false; camHold(false);
      var o = ov(); if (o && infTimer <= 0) o.showInfluence = null;
    }
    function onHide() {
      dropGesture();
      if (game.state.phase !== 'over') saveNow();
    }
    on(doc, 'visibilitychange', function () { if (doc.hidden || doc.visibilityState === 'hidden') onHide(); });
    var layoutDirty = true, firstLayout = true, lastOrient = null;
    if (root.addEventListener) {
      on(root, 'pagehide', onHide);
      on(root, 'blur', dropGesture);
      on(root, 'resize', function () { layoutDirty = true; });
      on(root, 'orientationchange', function () { layoutDirty = true; dropGesture(); });
    }

    // ---- botoes ----
    on(playBtn, 'click', function () {
      playTapAt = nowMs();
      if (confirmOpen()) return;   // A3: com a folha aberta o Play (e Enter/espaco nele) nao faz nada
      // camada modal aberta e o toque chegou ao Play (o balao do roteiro nao cobre a base): o balao pula e soa a
      // recusa, nunca um toque mudo (w_cam, playtest cego 5)
      if (modal()) { snd('deny'); var tuM = CRZ.app && CRZ.app.tutorial; try { if (tuM && tuM.bump) tuM.bump(); } catch (e) { warnOnce('tutorial.bump', e); } emitUI('playBlocked', { reason: 'modal' }); return; }
      var s = game.state;
      if (s.phase === 'plan') {
        // dia 1 sem nenhuma rua: o Play nao roda um dia vazio (nv4: o Play no primeiro balao pulou tudo)
        if ((s.day | 0) === 1 && !day1Built()) {
          snd('deny'); sayUntil = 0; say(tutorScript() ? STR.roadFirstTut : STR.roadFirst, 4000);
          if (tiles.road) pulseEl(tiles.road.el);
          emitUI('playBlocked', { reason: 'noRoad' });
          return;
        }
        // balao do roteiro que nao pede o Play (Day 1 of 12, The city grew...): o Play espera; o balao pula
        var tuP = CRZ.app && CRZ.app.tutorial;
        // w_cam: so trava com o balao de fato na tela (o motivo visivel); balao ainda nao desenhado nao engole o toque
        if (tuP && tuP.blocksPlay && tuP.blocksPlay() && tutBalloonOn()) { snd('deny'); try { tuP.bump(); } catch (e) { warnOnce('tutorial.bump', e); } emitUI('playBlocked', { reason: 'tutorial' }); return; }
        // playtest as cegas: as confirmacoes viraram UMA folha visivel com dois botoes grandes (nunca 'toque de novo')
        if (confirmPlay(s)) return;
        startDayNow(s);
      } else if (s.phase === 'run') {
        runSpeedTap(s);
      }
    });
    // w_cam (playtest cego 5, shots 281-287): um toque no Play visivel e com cara de ativo sempre faz algo ou diz
    // por que nao. Guarda que ignora o toque (os ~1 s depois de comecar o dia; a velocidade travada no dia 1 do
    // roteiro) deixa o botao com cara de desligado enquanto vale (.crz-guard, a mesma opacidade do Undo sem uso)
    var playWait = false;
    function playWaitOn(s, now) {
      if (s.phase !== 'run' || s.ff) return false;
      if (now - playPressedAt < PLAY_GUARD) return true;
      var tu = CRZ.app && CRZ.app.tutorial;
      try { return !!(tu && tu.speedLocked && tu.speedLocked()); } catch (e) { return false; }
    }
    function playWaitTick(s, now) {
      var w = playWaitOn(s, now);
      if (w !== playWait) { playWait = w; playBtn.classList.toggle('crz-guard', w); }
    }
    function startDayNow(s) {
        playBtn.classList.remove('crz-ask');
        setSel(null); clearGhost();
        hint = null;
        tutorialSpeed(s);                 // dias 1 e 2 comecam a 1x (antes do primeiro quadro do dia)
        playPressedAt = nowMs();
        game.startDay(); snd('dayStart');
        emitUI('playPressed', {});
    }
    function runSpeedTap(s) {
        // fast-forward ligado: o botao (que mostra o simbolo) so desliga o ff, a velocidade fica
        if (s.ff) { ffOff(); snd('select'); emitUI('ffOff', {}); return; }
        // toques seguidos no Play: ~1 s depois de comecar o dia o botao nao muda a velocidade (nv7: 4x sem querer)
        if (nowMs() - playPressedAt < PLAY_GUARD) return;
        // dia 1 com o roteiro: velocidade travada em 1x ate o balao de SPEED (nv7)
        var tuL = CRZ.app && CRZ.app.tutorial;
        if (tuL && tuL.speedLocked && tuL.speedLocked()) { snd('deny'); try { tuL.bump(); } catch (e) { warnOnce('tutorial.bump', e); } return; }
        // balao com Got it aberto (que nao e o da velocidade): o botao nao faz nada, o balao pula
        var tuS = CRZ.app && CRZ.app.tutorial;
        if (tuS && tuS.blocksPlay && tuS.blocksPlay() && tutBalloonOn()) { snd('deny'); try { tuS.bump(); } catch (e) { warnOnce('tutorial.bump', e); } return; }
        game.setSpeed(nextSpeed(s.speed, speeds)); snd('select'); speedChosen = game.state.speed; planMemo.speed = speedChosen; planMemoSave();
        playFace.classList.remove('pop'); void playFace.offsetWidth; playFace.classList.add('pop');
        emitUI('speedChanged', { speed: game.state.speed });
    }
    on(swapCancelEl, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (!swapAsk) { hideSwapCancel(); return; }
      snd('select'); endSwapAsk('cancel');
    });
    on(swapUndoEl, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (modal()) return;
      var okU = game.state.phase === 'plan' && game.canUndo();
      hideSwapUndo(); sayUntil = 0; sayEl.classList.remove('show');
      if (okU) { game.undo(); snd('undo'); } else { snd('deny'); say(STR.deny.undoNone); }
      emitUI('undoPressed', { ok: okU });
    });
    // o que o Undo desfez, por comparacao antes/depois (o game nao guarda o nome da acao)
    function undoSnap() {
      // dado v2: o Undo nunca mexe no dado, entao o dado sai da comparacao
      var w = game.world, o = { e: 0, tools: {}, lanes: {}, ow: {}, die: '', b: game.state.budget | 0 }, k;
      for (k in w.edges) if (w.edges.hasOwnProperty(k) && w.edges[k]) { o.e++; o.lanes[k] = w.edges[k].lanes || 1; o.ow[k] = w.edges[k].oneway || 0; }
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && w.nodes[k]) o.tools[k] = w.nodes[k].tool || '';
      return o;
    }
    function undoLabel(a, b) {
      var k;
      for (k in a.tools) if (a.tools.hasOwnProperty(k) && (a.tools[k] || '') !== (b.tools[k] || '')) {
        var tk = a.tools[k] || b.tools[k];
        return STR.tools[tk] || tk;
      }
      if (a.e > b.e) return STR.tools.road;
      for (k in a.lanes) if (a.lanes.hasOwnProperty(k) && b.lanes[k] !== undefined && a.lanes[k] !== b.lanes[k]) return STR.tools.upgrade;
      for (k in a.ow) if (a.ow.hasOwnProperty(k) && b.ow[k] !== undefined && a.ow[k] !== b.ow[k]) return STR.tools.oneway;
      if (a.die !== b.die) return STR.reroll;
      return '';
    }
    var playTapAt = -1e9, UNDO_GUARD = 800;
    on(undoBtn, 'click', function () {
      if (modal()) return;
      // blind2 (2): o 2o toque no Play caia no Undo ao lado e desfazia sem aviso: 800 ms de guarda
      if (nowMs() - Math.max(playTapAt, confirmShownAt) < UNDO_GUARD) return;
      var okU = game.state.phase === 'plan' && game.canUndo();
      if (okU) {
        var u0 = undoSnap();
        game.undo(); snd('undo');
        var u1 = undoSnap(), lbl = undoLabel(u0, u1), back = (u1.b - u0.b) | 0;
        sayUntil = 0; say(STR.undid(lbl, back), 3000);
        // o aviso do gasto nao vale mais: sai (e volta no proximo gasto de verdade)
        if (sayUntil && /^You spent /.test(sayEl.textContent)) { sayUntil = 0; sayEl.classList.remove('show'); if (hints.firstSpend) { delete hints.firstSpend; lsSet(HINT_KEY, JSON.stringify(hints)); } }
        spendBudget = game.state.budget | 0;
      }
      else { snd('deny'); shake(undoBtn); say(game.state.phase === 'plan' ? STR.deny.undoNone : STR.deny.undoRun); }
      emitUI('undoPressed', { ok: okU });
    });
    on(fitBtn, 'click', onFit);
    on(newBtn, 'click', function () {
      if (newArmed > 0) { restart(); return; }
      newArmed = 5000; newBtn.classList.add('armed'); snd('select');
      newBtn.setAttribute('aria-label', STR.confirmNew);
    });
    on(againBtn, 'click', function () { if (overRetry && retryChapter()) return; restart(); });
    on(newGameBtn, 'click', function () { restart(); });
    on(tryNormalBtn, 'click', function () {
      var D = CRZ.difficulty;
      markSeen('tryNormal');
      if (D && typeof D.set === 'function') D.set('normal');
    });

    // marcadores do HUD explicam ao toque (strikes, dias, pontos, barra de bonus, Boost, carta ativa)
    // role=button + tabindex: leitor de tela e teclado chegam neles; Enter e espaco tambem explicam
    function infoTap(elx, textFn) {
      elx.classList.add('crz-info');
      elx.setAttribute('role', 'button'); elx.setAttribute('tabindex', '0');
      function fire() { if (modal()) return; var t = textFn(game.state); if (t) { say(t); snd('select'); } }
      on(elx, 'click', fire);
      on(elx, 'keydown', function (e) { if (e && (e.key === 'Enter' || e.key === ' ')) { pd(e); fire(); } });
    }
    // alvo de toque >= 44 px sem mudar o visual: ::after invisivel centrado no marcador
    // (style.css e de outro agente; o bloco vem injetado aqui, uma vez por documento)
    (function hitStyle() {
      try {
        if (!doc.getElementById || doc.getElementById('crz-ui-hit') || !doc.head) return;
        var sty = doc.createElement('style'); sty.id = 'crz-ui-hit';
        sty.textContent = '.crz-strikes.crz-info,.crz-dots.crz-info,.crz-budget.crz-info,.crz-tip.crz-info,.crz-chip{position:relative}' +
          '.crz-strikes.crz-info::after,.crz-dots.crz-info::after,.crz-budget.crz-info::after,.crz-tip.crz-info::after,.crz-chip::after' +
          '{content:"";position:absolute;left:50%;top:50%;width:100%;height:100%;min-width:44px;min-height:44px;transform:translate(-50%,-50%)}';
        doc.head.appendChild(sty);
      } catch (e) {}
    })();
    infoTap(strikesEl, function (s) { return STR.info.strikes(s.strikes | 0, CFG.maxStrikes); });
    infoTap(dotsEl, function (s) { return STR.info.days(s.day | 0, CFG.maxDays); });
    infoTap(budgetEl, function (s) { return STR.info.budget(s.budget | 0, lastDayOf(s)); });
    infoTap(tipEl, function (s) {
      var sd = s.speedDial; if (!sd || !(sd.perPoint > 0)) return '';
      return (lastDayOf(s) ? STR.info.tipsLast : STR.info.tips)(Math.min(sd.perPoint, Math.floor((sd.carry || 0) + (sd.tips || 0))), sd.perPoint);
    });
    // final check 1: o raio cinza no plano explica quando funciona (antes o toque caia no aviso dos build points)
    infoTap(clearEl, function (s) { return !(s.clear && s.clear.unlocked) ? '' : s.phase === 'plan' ? STR.boostWhen : STR.info.boost(Math.max(0, s.clear.charges | 0)); });
    on(chipEl, 'click', function () {
      if (modal()) return;
      var c = (game.state.cards || [])[0];
      if (c && STR.cardLine[c]) { say(c === 'freeRoad' ? STR.freeRoadNow : STR.cardLine[c]); snd('select'); }
      else if (game.state.crew && game.state.crew.active && game.state.crew.active.length) { say(STR.crewHired(Math.max.apply(null, game.state.crew.active)).replace('starting tomorrow, ', '')); snd('select'); }
    });

    // ---- dado do dia: folha com hoje, amanha e relancar ----
    function reducedMotion() {
      try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
    }
    // polimento 3: numeros que mudam contam ate o valor em 300 ms (pontos, carros do dia, bonus, fim de jogo).
    // Sem como animar (teste em Node, ?manual do robo, aba escondida, movimento reduzido) o valor final entra na hora.
    // O valor final fica sempre em data-val; um pedido novo cancela a contagem em curso do mesmo elemento.
    var COUNT_MS = 300, countManual = false;
    try { countManual = /[?&]manual(=|&|$)/.test(String(root.location && root.location.search || '')); } catch (e) {}
    function canCount() {
      return !countManual && typeof root.requestAnimationFrame === 'function' && !!root.performance && typeof root.performance.now === 'function' &&
        !!doc.documentElement && !doc.hidden && !reducedMotion();
    }
    function countTo(elx, from, to, fmt) {
      if (!elx) return;
      to = +to || 0; from = +from || 0;
      fmt = fmt || function (v) { return String(v); };
      elx.__crzCount = (elx.__crzCount | 0) + 1;
      var my = elx.__crzCount;
      try { if (elx.setAttribute) elx.setAttribute('data-val', String(to)); } catch (e) {}
      if (from === to || !canCount()) { elx.textContent = fmt(to); return; }
      var t0 = root.performance.now();
      elx.textContent = fmt(from);
      (function step() {
        root.requestAnimationFrame(function (t) {
          if (elx.__crzCount !== my) return;                 // outro valor chegou: esta contagem morre
          var k = Math.min(1, Math.max(0, ((+t || root.performance.now()) - t0) / COUNT_MS)), e = 1 - Math.pow(1 - k, 3);
          elx.textContent = fmt(k >= 1 ? to : Math.round(from + (to - from) * e));
          if (k < 1) step();
        });
      })();
    }
    function positionSheet() {
      try {
        var h = bottom.getBoundingClientRect().height || 0;
        if (ui.style && ui.style.setProperty) ui.style.setProperty('--sheetb', Math.round(clamp(h, 0, 260) + 8) + 'px');
      } catch (e) {}
    }
    // por que o relance nao vale e o que serve (a nota do botao e o rotulo; aqui a frase)
    function rerollSay(s) {
      var ri = rerollInfo(s);
      if (s.phase !== 'plan') return STR.deny.rerollRun;
      if (ri.reason === STR.reasonDone) return STR.dieOnce;
      if (ri.reason === STR.reasonPoints) return STR.deny.rerollPoints(ri.cost, s.budget | 0);
      return STR.deny.rerollOther;
    }
    function rerollInfo(s) {
      // dado v2: sem relance (sistemas.md 3.2); o botao nao aparece
      var cost = (CFG.dice && CFG.dice.rerollCost) || 1, avail = !(CFG.dice && CFG.dice.pools) && typeof game.rerollDie === 'function' && typeof game.canReroll === 'function';
      var reason = '', r;
      if (!avail) return { avail: false, cost: cost, reason: '' };
      if (s.phase !== 'plan') reason = STR.reasonPhase;
      else if (s.rerolled) reason = STR.reasonDone;
      else if (s.budget < cost) reason = STR.reasonPoints;
      else {
        try { r = game.canReroll(); } catch (e) { r = false; }
        if (!(r === true || (r && r.ok))) reason = STR.reasonOther;
      }
      return { avail: true, cost: cost, reason: reason };
    }
    // o relance troca o efeito de hoje: perde os pontos do dado ou a obra gratis que ele deu (game.rerollDie)
    function rerollLoses(s) {
      var fx = s && s.die && s.die.effect;
      if (!fx) return false;
      if ((fx.budget | 0) > 0) return true;
      return !!fx.free && !!(s.free && (s.free.road || s.free.light)) && !cardGives(s, 'freeRoad') && !cardGives(s, 'freeLight');
    }
    // ultimo dia: nao existe amanha, entao nenhuma promessa de amanha
    function lastDayOf(s) { return (s.day | 0) >= CFG.maxDays; }
    function refreshSheet(s) {
      if (!sheetOpen || !s.die) return;
      // dado v2: amanha nao mostra o dado; a linha de amanha e o evento com o lugar, quando existe
      var ri = rerollInfo(s), fc = null;
      try { fc = typeof game.forecast === 'function' && !lastDayOf(s) ? game.forecast() : null; } catch (e) { fc = null; }
      var hasNext = !!(fc && fc.label), neutral = s.die.v === 2 && s.dieState !== 'used' && s.dieState !== 'auto';
      var key = [s.die.id, s.die.value, s.die.faces, s.dieState, hasNext ? fc.label : '-', s.phase, s.budget].join('|');
      if (key === sheetKey) return;
      sheetKey = key;
      todayName.textContent = neutral ? STR.lblPassed : STR.today + ': ' + dieName(s.die.id);
      todayIco.innerHTML = neutral ? '' : eventSvg(s.die.id, s.die.kind, freeGrant(s.die, s.day));
      tomIco.innerHTML = '';
      todayDesc.textContent = neutral ? (s.dieState === 'kept' ? STR.rollKeptNote : STR.rollPassedNote) : describeDie(s.die);
      tomBox.classList.toggle('off', !hasNext);
      if (hasNext) { tomName.textContent = STR.forecast(fc.label); tomDesc.textContent = ''; }
      tomWhat.classList.add('gone');
      rerollBtn.classList.toggle('gone', !ri.avail);
      // botao proprio e curto no painel do dado: 'Reroll (1)' = custa 1 ponto (o aria diz por extenso)
      // 'Reroll (1)' parecia contagem de relances: o custo escrito
      rerollBtn.textContent = STR.rerollLbl(ri.cost, rerollLoses(s));
      rerollBtn.setAttribute('aria-label', STR.rerollAria(ri.cost, rerollLoses(s)));
      rerollBtn.classList.toggle('off', !!ri.reason);
      rerollBtn.setAttribute('aria-disabled', ri.reason ? 'true' : 'false');
      rerollNote.textContent = ri.avail ? (rushShort(s, ri) || ri.reason || STR.dieOnce) : '';
    }
    // Rush hoje e pontos abaixo do relance: diz o que o dado faz e a conta, sem tom de erro
    function rushShort(s, ri) {
      if (!s.die || s.die.id !== 'rush' || ri.reason !== STR.reasonPoints) return '';
      return STR.dieRushShort(ri.cost, Math.max(0, s.budget | 0));
    }
    function openSheet() {
      if (sheetOpen || !game.state.die || game.state.day < 2) return;
      sheetOpen = true; sheetKey = '';
      ffOff();                          // folha aberta: o ff desliga
      sheetEl.classList.add('show'); dieEl.setAttribute('aria-expanded', 'true');
      positionSheet(); refreshSheet(game.state);
      snd('select'); emitUI('dieOpen', {});
    }
    function closeSheet() {
      if (!sheetOpen) return;
      sheetOpen = false;
      sheetEl.classList.remove('show'); dieEl.setAttribute('aria-expanded', 'false');
    }
    on(dieEl, 'click', function () {
      if (modal()) return;
      // no plano o dado do topo reabre a tela da rolagem (sem animacao); no dia, a folha de antes
      if (ROLL_ON && game.state.phase === 'plan' && (game.state.day | 0) >= 2 && (game.state.die || diceInfoOf(game.state).canRoll)) { if (sheetOpen) closeSheet(); rollOpen(!game.state.die); return; }
      if (sheetOpen) closeSheet(); else openSheet();
    });
    on(sheetClose, 'click', function () { closeSheet(); });
    on(sheetBack, 'click', function () { closeSheet(); });
    on(rerollBtn, 'click', function () {
      if (modal()) return;
      if (rerollBtn.classList.contains('off') || typeof game.rerollDie !== 'function') {
        // Rush sem pontos: a nota ja diz a conta; sem tremida nem som de erro
        var g0 = game.state;
        if (rushShort(g0, rerollInfo(g0))) { emitUI('dieReroll', { ok: false, reason: 'points' }); return; }
        snd('deny'); shake(rerollBtn); say(rerollSay(g0)); emitUI('dieReroll', { ok: false }); return;
      }
      var r = game.rerollDie(), okR = !!(r && r.ok);
      if (okR) snd('place'); else { snd('deny'); shake(rerollBtn); say(rerollSay(game.state)); }
      sheetKey = ''; refreshSheet(game.state);
      emitUI('dieReroll', { ok: okR });
    });
    // ---- rolagem visivel do dado (dono, 2026-11-10): no comeco do plano de cada dia com dado ----
    // folha central por cima do mapa escurecido: o dado grande entra quicando (~1,2 s) e para no numero;
    // depois o efeito grande e colorido, amanha pequeno, Reroll secundario e Continue. Um toque pula a
    // animacao, o 2o continua. Dia normal fecha sozinho em 2 s. Uma vez por dia por partida (hints '@seed').
    // dado com peso, encenacao v2 (dono 2026-11-16): o cartao comeca compacto e o dado rola no MEIO dele o tempo
    // todo (pulo curto, 3 quiques que diminuem, sombra no chao, achata no impacto), sem nunca passar da borda. Parado no
    // numero (ainda neutro, tinta), o cartao abre (FLIP: o fundo escala, o dado sobe por translate, ~300 ms) e no fim
    // da abertura entram juntos a cor do tom e 'Today: ...'; amanha e os botoes logo depois. Linha do tempo da CSS
    // (crz-rolldrop, 1000 ms): impactos em ROLL_IMPACTS; o 3o impacto e a parada.
    var ROLL_IMPACTS = [460, 724, 880], ROLL_LAND_MS = 880, ROLL_GROW_AT = 1000, ROLL_GROW_MS = 300;
    var ROLL_FX_AT = 190, ROLL_REST_AT = 250, ROLL_SHRINK_MS = 260;
    // trocas de numero: rapidas no comeco, lentas no fim (a ultima troca aleatoria antes da parada)
    var ROLL_SPIN = [60, 120, 180, 240, 320, 400, 500, 620, 780];
    var ROLL_GUARD_MS = 350;   // depois da abertura: toque no cartao ou no fundo so continua passado este tempo
    var rollEl = el('div', 'crz-roll gone'); rollEl.setAttribute('role', 'dialog'); rollEl.setAttribute('aria-modal', 'true');
    rollEl.setAttribute('aria-label', STR.rollTitle);
    var rollBox = tut(el('div', 'crz-rollbox'), 'roll'); rollBox.setAttribute('data-scroll', '');
    var rollBg = el('div', 'crz-rollbg');   // o fundo branco do cartao: so ele escala na abertura (o texto nao deforma)
    var rollStage = el('div', 'crz-rollstage'), rollShadow = el('div', 'crz-rollshadow'), rollSq = el('div', 'crz-rollsq');
    var rollDie = el('div', 'crz-rolldie'), rollTapEl = el('div', 'crz-rolltap gone'), rollFx = el('div', 'crz-rollfx'), rollTutEl = el('div', 'crz-rolltut gone');
    var rollTom = el('div', 'crz-rolltom'), rollNote = el('div', 'crz-rollnote');
    // dado v2: os dois lados da oferta (verde e vermelho), Pass e Use no lugar de Reroll e Continue, Keep pequeno embaixo,
    // e no 'Tap to roll' o botao da face guardada (no lugar de rolar)
    var rollSides = el('div', 'crz-rollsides'), rollSideA = el('div', 'crz-rollside'), rollSideB = el('div', 'crz-rollside');
    rollSides.appendChild(rollSideA); rollSides.appendChild(rollSideB);
    var rollRow = el('div', 'crz-rollrow');
    var rollPass = tut(el('button', 'crz-rollpass gone'), 'roll-pass'), rollGo = tut(el('button', 'crz-rollgo'), 'roll-continue');
    var rollKeep = tut(el('button', 'crz-rollkeep gone'), 'roll-keep'), rollKept = tut(el('button', 'crz-rollkept gone'), 'roll-kept');
    rollGo.textContent = STR.rollContinue; rollPass.textContent = STR.rollPass; rollKeep.textContent = STR.rollKeep;
    rollPass.setAttribute('aria-label', STR.rollPassAria);
    var rollLive = el('div', 'crz-sr'); rollLive.setAttribute('aria-live', 'polite');
    rollRow.appendChild(rollPass); rollRow.appendChild(rollGo);
    rollDie.setAttribute('role', 'button'); rollDie.setAttribute('tabindex', '0'); rollDie.setAttribute('aria-label', STR.rollAria);
    rollTapEl.textContent = STR.rollTap;
    rollDie.appendChild(rollSq); rollStage.appendChild(rollShadow); rollStage.appendChild(rollDie);
    rollBox.appendChild(rollBg);
    rollBox.appendChild(rollStage); rollBox.appendChild(rollTapEl); rollBox.appendChild(rollKept); rollBox.appendChild(rollFx); rollBox.appendChild(rollSides);
    rollBox.appendChild(rollTutEl); rollBox.appendChild(rollTom);
    rollBox.appendChild(rollRow); rollBox.appendChild(rollKeep); rollBox.appendChild(rollNote); rollBox.appendChild(rollLive);
    rollEl.appendChild(rollBox); ui.appendChild(rollEl);
    // dono 2026-11-10: quem rola e a jogadora. 'ready' = dado parado, 'Tap to roll'; o resultado ja veio do jogo
    // estagios: ready -> anim (rola no meio) -> land (parado, neutro) -> grow (abre) -> result; reroll: shrink -> anim
    var ROLL_WIGGLE_MS = 8000;
    var roll = { open: false, stage: '', t0: 0, g0: 0, s0: 0, resAt: 0, autoAt: 0, spinI: 0, imp: 0, shown: 0, last: 0,
      fxOn: false, restOn: false, anims: [], tut: false, normal: false, mine: false, readyAt: 0 };
    var rollShutT = 0, ROLL_SHUT_MS = 260;
    function rollKey(d) { return 'roll' + d + runTag; }
    function rollSeen(d) { return !!hints[rollKey(d)]; }
    function rollMark(d) { hints[rollKey(d)] = 1; lsSet(HINT_KEY, JSON.stringify(hints)); }
    function rollFxText(die) {
      if (die && die.v === 2 && (die.offer || die.id === 'lucky')) return dieName(die.id);   // dado v2: o nome da face (os lados vem embaixo)
      if (!die || die.id === 'plain' || !(STR.rollFx[die.id])) return STR.rollNormal;
      // invisivel 1 (D1): a face 'Free build' do d20 da semaforo gratis quando ele ja existe (game.dieGrant):
      // a frase le o que o jogo deixou gratis de verdade
      var fr = game.state && game.state.free;
      if (die.id === 'free' && fr) return STR.today + ': ' + (fr.light ? STR.rollFreeLight : STR.rollFx.free);
      return STR.today + ': ' + STR.rollFx[die.id];
    }
    function bigDieSvg(value, faces, kind) {
      if (faces <= 6) return dieSvg(value, faces, kind);
      // d20: forma de 20 lados arredondada (hexagono com as faces), o numero no meio
      var tone = kindTone(kind);
      return svg('<path d="M18 2L32 10V26L18 34L4 26V10Z" fill="none" stroke-width="2.4" stroke-linejoin="round" class="s-' + tone + '"/>' +
        '<path d="M18 2L10 13H26Z M4 10L10 13L7 24 M32 10L26 13L29 24 M10 13L18 27L26 13 M7 24L18 27L29 24 M18 27V34" fill="none" stroke-width="0.9" stroke-linejoin="round" class="s-' + tone + '" opacity="0.35"/>' +
        '<text x="18" y="23" text-anchor="middle" font-size="12" font-weight="800" class="f-ink">' + value + '</text>', '0 0 36 36');
    }
    // neutral: o giro pinta com o contorno de tinta (o mesmo do '?'); a cor do tom so quando o efeito aparece
    function rollPaint(s, value, neutral) {
      var D = s.die; if (!D) return;
      // passou ou guardou: o dado fica neutro (o tom e de face que vale hoje)
      if (s.dieState === 'passed' || s.dieState === 'kept') neutral = true;
      rollSq.innerHTML = bigDieSvg(value, D.faces, neutral ? 'plain' : D.kind);
    }
    // numero aleatorio do giro: nunca repete o anterior (troca visivel a cada passo)
    function rollSpinPaint(s) {
      var n = (s.die && s.die.faces) || 6, v = 1 + Math.floor(Math.random() * (n - 1));
      if (v >= roll.shown) v++;
      if (v > n) v = 1;
      // a ultima troca nunca cai no numero final: a parada e sempre uma troca visivel
      var fin = s.die ? s.die.value : 0;
      if (roll.spinI >= ROLL_SPIN.length && v === fin) { v = v % n + 1; if (v === roll.shown) v = v % n + 1; }
      roll.shown = v; rollPaint(s, v, true);
    }
    // FLIP: caixas medidas antes e depois da troca de layout; so transform anima (Web Animations, no compositor)
    function rollRect(e) { try { var r = e.getBoundingClientRect(); return r && r.height > 0 ? r : null; } catch (x) { return null; } }
    function rollFlipCancel() { roll.anims.forEach(function (a) { try { a.cancel(); } catch (x) {} }); roll.anims = []; }
    function rollFlip(e, from, ms) {
      if (!e.animate || reducedMotion()) return;
      try { roll.anims.push(e.animate([{ transform: from }, { transform: 'none' }], { duration: ms, easing: 'cubic-bezier(.2, .75, .3, 1)' })); } catch (x) {}
    }
    // b0/d0: cartao e dado no layout de onde se sai; depois da troca de classes mede o novo e anima do velho ao novo
    function rollFlipTo(b0, d0, ms) {
      var b1 = rollRect(rollBox), d1 = rollRect(rollStage);
      if (b0 && b1) {
        var dx = (b0.left + b0.width / 2) - (b1.left + b1.width / 2), dy = (b0.top + b0.height / 2) - (b1.top + b1.height / 2);
        rollFlip(rollBg, 'translate(' + dx.toFixed(2) + 'px, ' + dy.toFixed(2) + 'px) scale(' + (b0.width / b1.width).toFixed(4) + ', ' + (b0.height / b1.height).toFixed(4) + ')', ms);
      }
      if (d0 && d1) rollFlip(rollStage, 'translate(' + (d0.left - d1.left).toFixed(2) + 'px, ' + (d0.top - d1.top).toFixed(2) + 'px)', ms);
    }
    function rollCls(add, rem) {
      (rem || []).forEach(function (c) { rollEl.classList.remove(c); });
      (add || []).forEach(function (c) { rollEl.classList.add(c); });
    }
    var ROLL_STATE_CLS = ['crz-rollc', 'crz-rollready', 'crz-rolling', 'crz-rolled', 'crz-rollmove', 'crz-rollfxhid', 'crz-rollresthid'];
    // dado v2: a linha de ensino da manha (uma por vez, cada uma uma vez por aparelho: hints 'dice:*')
    function rollHint(s) {
      if (s.dieState !== 'offer' || !s.die || !gOn()) return '';
      var di = diceInfoOf(s);
      if (!seen('dice:offer')) return 'dice:offer';
      if ((di.tier === 'ch2' || di.tier === 'ch3') && !seen('dice:cost')) return 'dice:cost';
      if (di.canKeep && !seen('dice:keep')) return 'dice:keep';
      return '';
    }
    var HINT_TEXT = { 'dice:offer': 'hintOffer', 'dice:cost': 'hintCost', 'dice:keep': 'hintKeep' };
    function diceInfoOf(s) {
      var di = null;
      try { di = typeof game.diceInfo === 'function' ? game.diceInfo() : null; } catch (e) { di = null; }
      return di || { tier: '', canKeep: false, canPlayKept: false, kept: null, debtPaid: 0 };
    }
    // a linha pequena acima dos botoes: ensino, depois o Loan de ontem, depois o evento de amanha com o lugar
    // (sistemas.md 3.2: a previsao nunca mostra o dado)
    function rollTomText(s) {
      var h = rollHint(s);
      if (h) return STR[HINT_TEXT[h]];
      var di = diceInfoOf(s);
      if (di.debtPaid > 0) return STR.loanPaid(di.debtPaid);
      var fc = null;
      try { fc = typeof game.forecast === 'function' ? game.forecast() : null; } catch (e) { fc = null; }
      return fc && fc.label && !lastDayOf(s) ? STR.forecast(fc.label) : '';
    }
    function rollFill(s) {
      var D = s.die; if (!D) return '';
      var offer = s.dieState === 'offer', v2 = D.v === 2 && (D.offer || D.id === 'lucky');
      var tone = v2 ? 'ink' : kindTone(D.kind), fx = rollFxText(D);
      rollFx.textContent = fx; rollFx.className = 'crz-rollfx tone-' + tone;
      var sd = v2 ? dieSides(D) : [];
      rollSideA.textContent = sd[0] ? sd[0].text : ''; rollSideA.className = 'crz-rollside' + (sd[0] ? ' tone-' + sd[0].tone : '');
      rollSideB.textContent = sd[1] ? sd[1].text : ''; rollSideB.className = 'crz-rollside' + (sd[1] ? ' tone-' + sd[1].tone : '');
      rollSides.classList.toggle('gone', !sd.length);
      roll.hint = rollHint(s);
      rollTom.textContent = rollTomText(s);
      rollTom.classList.toggle('crz-rollhint', !!roll.hint);
      // botoes: oferta = Pass e Use (e Keep do dia 15); o resto = Continue
      var name = dieName(D.id), di = diceInfoOf(s);
      rollPass.classList.toggle('gone', !offer);
      rollKeep.classList.toggle('gone', !(offer && di.canKeep));
      rollKeep.setAttribute('aria-label', STR.rollKeepAria(name));
      rollGo.textContent = offer ? STR.rollUse : STR.rollContinue;
      if (offer) rollGo.setAttribute('aria-label', STR.rollUseAria(name)); else if (rollGo.removeAttribute) rollGo.removeAttribute('aria-label');
      rollGo.classList.toggle('crz-rolluse', offer);
      // a face guardada tambem entra no lugar de um dia normal ja passado (antes so antes de rolar: o item ficava parado)
      var keptNow = s.dieState === 'passed' && di.canPlayKept;
      rollKept.classList.toggle('gone', !keptNow);
      if (keptNow) rollKept.textContent = STR.rollKeptBtn(dieName(di.kept.id));
      var after = { used: s.dieFromKept ? '' : STR.rollUsedNote, passed: STR.rollPassedNote, kept: STR.rollKeptNote }[s.dieState];
      rollNote.textContent = (!offer && v2 && after) ? after : (offer && D.effect && D.effect.budget > 0 && pointsWasted(s) ? STR.pointsWaste : '');
      if (offer && di.canKeep && di.kept) rollNote.textContent = (rollNote.textContent ? rollNote.textContent + ' ' : '') + STR.rollKeepReplaces(dieName(di.kept.id));   // w_bugs15
      rollTutEl.classList.add('gone');   // a linha do tutorial ('Tap the dice') sai depois de rolar
      return fx;
    }
    function rollResultPaint(s) {
      var D = s.die; if (!D) return;
      var tone = kindTone(D.kind);
      rollPaint(s, D.value);
      var fx = rollFill(s);
      if (s.dieState === 'offer') {
        var sd = dieSides(D);
        rollLive.textContent = STR.rollOfferLive(dieName(D.id), sd[0] ? sd[0].text : '', sd[1] ? sd[1].text : '');
      } else {
        var fxs = fx.replace(/^Today: /, '').replace(/^Normal day: no change$/, 'Normal day');
        rollLive.textContent = STR.rollLive(D.value, fxs.charAt(0).toUpperCase() + fxs.slice(1));
      }
      roll.normal = D.id === 'plain' || tone === 'ink';
    }
    // a manha tem escolha pendente: o toque no fundo nao escolhe nem fecha
    function rollChoosing() { return game.state.dieState === 'offer'; }
    function rollAnyModal() {
      var menuAny = false; try { menuAny = !!(CRZ.app && CRZ.app.menu && CRZ.app.menu.isOpenAny && CRZ.app.menu.isOpenAny()); } catch (e) { warnOnce('menu.isOpenAny', e); }
      return menuAny || !!guideEl || confirmOpen() || sheetOpen;
    }
    function rollOpen(animate) {
      var s = game.state; if (roll.open) return;
      // dado v2: nada rolado = 'Tap to roll'; rolado = resultado (a oferta pendente reabre com os botoes)
      if (!s.die) { if (!animate || !diceInfoOf(s).canRoll) return; }
      else animate = false;
      roll.open = true; ffOff();
      roll.mine = true; modalReg().set(doc.body, 'roll', true);
      if (rollShutT) { try { root.clearTimeout(rollShutT); } catch (e) {} rollShutT = 0; }
      rollEl.classList.remove('crz-shut');
      rollEl.classList.remove('gone'); rollEl.classList.toggle('crz-rm', reducedMotion());
      var tutLine = !seen('rollAny') && tutorScript();
      roll.tut = !!tutLine;
      rollTutEl.textContent = STR.rollTut; rollTutEl.classList.toggle('gone', !tutLine);
      markSeen('fu:die');
      emitUI('dieOpen', { roll: true });
      if (animate) rollReady(); else rollResultNow(false);
    }
    function rollReady() {
      var s = game.state;
      rollFlipCancel();
      roll.stage = 'ready'; roll.readyAt = nowMs(); roll.autoAt = 0;
      rollCls(['crz-rollc', 'crz-rollready'], ROLL_STATE_CLS);
      rollDie.classList.remove('crz-rollwiggle'); rollStage.classList.remove('crz-rollin'); rollStage.classList.remove('crz-rollpop');
      rollSq.innerHTML = bigDieSvg(5, 6, 'plain');
      rollTapEl.classList.remove('gone');
      rollFx.textContent = ''; rollTom.textContent = ''; rollNote.textContent = '';
      rollSideA.textContent = rollSideB.textContent = ''; rollSides.classList.add('gone');
      rollPass.classList.add('gone'); rollKeep.classList.add('gone');
      // dado v2: face guardada (Keep) pode ser usada no lugar de rolar; botao pequeno sob 'Tap to roll'
      var di = diceInfoOf(s);
      rollKept.classList.toggle('gone', !di.canPlayKept);
      if (di.canPlayKept) rollKept.textContent = STR.rollKeptBtn(dieName(di.kept.id));
      rollGo.setAttribute('tabindex', '-1');
      rollLive.textContent = STR.rollTap;
      try { if (rollDie.focus) rollDie.focus(); } catch (e) {}
    }
    function rollAnim() {
      var s = game.state, now = nowMs();
      // rolou: este dia nao volta para 'Tap to roll' ao recarregar
      markSeen('rollAny'); rollMark(s.day | 0);
      if (reducedMotion()) { rollResultNow(true); return; }
      rollFlipCancel();
      var d0 = rollRect(rollStage);   // onde o dado estava (no 'Tap to roll' ele fica acima do meio, com o texto embaixo)
      rollCls(['crz-rollc', 'crz-rolling'], ROLL_STATE_CLS);
      rollTapEl.classList.add('gone'); rollTutEl.classList.add('gone'); rollKept.classList.add('gone'); rollDie.classList.remove('crz-rollwiggle');
      roll.stage = 'anim'; roll.t0 = now; roll.spinI = 0; roll.imp = 0; roll.shown = 0; roll.autoAt = 0;
      rollFx.textContent = ''; rollTom.textContent = ''; rollNote.textContent = '';
      rollGo.setAttribute('tabindex', '-1');
      var d1 = rollRect(rollStage), ry = (d0 && d1) ? d0.top - d1.top : 0;
      // cada rolagem pula de um jeito: lado e deriva sorteados (so CSS; aterrissa sempre de pe, no meio)
      var dir = Math.random() < 0.5 ? -1 : 1;
      try {
        rollStage.style.setProperty('--rd', String(dir));
        rollStage.style.setProperty('--ry', ry.toFixed(1) + 'px');
        rollStage.style.setProperty('--rx', (dir * Math.round(4 + Math.random() * 10)) + 'px');
      } catch (e) {}
      rollStage.classList.remove('crz-rollpop'); rollStage.classList.remove('crz-rollin'); void rollStage.offsetWidth; rollStage.classList.add('crz-rollin');
      rollSpinPaint(s);
    }
    // parada no meio: o numero final, ainda neutro; o som do dado
    function rollLand() {
      var s = game.state;
      roll.stage = 'land'; roll.last = s.die ? s.die.value : 0;
      rollPaint(s, roll.last, true);
      if (!reducedMotion()) rollStage.classList.add('crz-rollpop');
      snd('dieHit3'); snd('dice');   // 3o impacto (o mais leve) junto do estalo da parada
    }
    // abertura: o cartao vai ao layout do resultado (texto ja no lugar, invisivel) e o FLIP anima do compacto ate ele
    function rollGrowStart() {
      var s = game.state, b0 = rollRect(rollBox), d0 = rollRect(rollStage);
      rollFill(s);
      rollCls(['crz-rollmove', 'crz-rollfxhid', 'crz-rollresthid'], ['crz-rollc', 'crz-rolling', 'crz-rollready']);
      roll.stage = 'grow'; roll.g0 = nowMs(); roll.fxOn = false; roll.restOn = false;
      rollFlipTo(b0, d0, ROLL_GROW_MS);
    }
    // a cor do tom e 'Today: ...' de uma vez (o efeito e o premio: nunca depois de amanha e dos botoes)
    function rollRevealFx() {
      roll.fxOn = true;
      rollResultPaint(game.state);
      rollCls(['crz-rolled'], ['crz-rollfxhid']);
    }
    function rollRevealRest() { roll.restOn = true; rollCls([], ['crz-rollresthid']); }
    function rollDone() {
      roll.stage = 'result'; roll.resAt = nowMs();
      rollCls([], ['crz-rollmove']);
      rollGo.removeAttribute('tabindex');
      try { if (rollGo.focus) rollGo.focus(); } catch (e) {}
      roll.autoAt = 0;   // a jogadora rolou: o resultado espera o Continue (ou um toque), tambem no dia normal
      emitUI('rollResult', { offer: rollChoosing(), id: game.state.die ? game.state.die.id : '' });
    }
    // resultado de uma vez (toque que pula, Escape, movimento reduzido, reabrir pelo dado do topo)
    function rollResultNow(sound) {
      rollFlipCancel();
      rollCls(['crz-rolled'], ROLL_STATE_CLS);
      rollTapEl.classList.add('gone'); rollKept.classList.add('gone');
      rollStage.classList.remove('crz-rollin'); rollStage.classList.remove('crz-rollpop');
      rollResultPaint(game.state);
      roll.fxOn = roll.restOn = true;
      rollDone();
      if (sound) snd('dice');
    }
    // relance: o cartao volta ao compacto (FLIP ao contrario) com o dado no meio, neutro; depois rola de novo
    function rollShrink() {
      var s = game.state, b0 = rollRect(rollBox), d0 = rollRect(rollStage);
      rollFlipCancel();
      if (reducedMotion()) { rollAnim(); return; }
      rollPaint(s, roll.last || 1, true);
      rollFx.textContent = ''; rollTom.textContent = ''; rollNote.textContent = '';
      rollStage.classList.remove('crz-rollin'); rollStage.classList.remove('crz-rollpop');
      rollCls(['crz-rollc', 'crz-rolling', 'crz-rollmove'], ROLL_STATE_CLS);
      rollGo.setAttribute('tabindex', '-1');
      roll.stage = 'shrink'; roll.s0 = nowMs();
      rollFlipTo(b0, d0, ROLL_SHRINK_MS);
    }
    function rollClose() {
      if (!roll.open) return;
      roll.open = false; roll.stage = '';
      rollFlipCancel();
      rollStage.classList.remove('crz-rollin'); rollStage.classList.remove('crz-rollpop');
      rollEl.classList.add('gone'); rollCls([], ['crz-rolling', 'crz-rolled', 'crz-rollmove', 'crz-rollfxhid', 'crz-rollresthid']);
      // F001 do fuzz: a saida e uma transicao de 160 ms que so anda com quadros. Sem quadros (Chrome headless
      // parado, aba congelada e devolvida) a folha ficava na tela com 'gone', opacidade ~1 e sem toque. Um timer
      // (nao depende de quadro) encerra a saida aos 260 ms: com quadros normais a transicao ja acabou e nada muda
      if (rollShutT) { try { root.clearTimeout(rollShutT); } catch (e) {} }
      rollShutT = later(function () { rollShutT = 0; if (!roll.open) rollEl.classList.add('crz-shut'); }, ROLL_SHUT_MS);
      if (roll.mine) { roll.mine = false; modalReg().set(doc.body, 'roll', false); }
      emitUI('rollClosed', {});
    }
    function rollScreenTick(s, now) {
      if (roll.open) {
        if (s.phase !== 'plan') { rollClose(); return; }
        var st = roll.stage;
        if (st === 'anim') {
          var el = now - roll.t0, chg = false;
          if (el >= ROLL_LAND_MS) { rollLand(); return; }
          while (roll.imp < ROLL_IMPACTS.length - 1 && el >= ROLL_IMPACTS[roll.imp]) { snd('dieHit' + (++roll.imp)); }
          while (roll.spinI < ROLL_SPIN.length && el >= ROLL_SPIN[roll.spinI]) { roll.spinI++; chg = true; }
          if (chg) rollSpinPaint(s);
        } else if (st === 'land') {
          if (now - roll.t0 >= ROLL_GROW_AT) rollGrowStart();
        } else if (st === 'grow') {
          var g = now - roll.g0;
          if (!roll.fxOn && g >= ROLL_FX_AT) rollRevealFx();
          if (!roll.restOn && g >= ROLL_REST_AT) rollRevealRest();
          if (g >= ROLL_GROW_MS) { if (!roll.fxOn) rollRevealFx(); if (!roll.restOn) rollRevealRest(); rollDone(); }
        } else if (st === 'shrink') {
          if (now - roll.s0 >= ROLL_SHRINK_MS) rollAnim();
        } else if (st === 'ready' && now - roll.readyAt >= ROLL_WIGGLE_MS && !rollDie.classList.contains('crz-rollwiggle')) {
          rollDie.classList.add('crz-rollwiggle');   // convite: balanca de leve, nunca rola sozinho
        }
        return;
      }
      // dado v2: abre sozinho enquanto a manha tem algo a fazer (rolar, ou escolher uma oferta)
      if (!ROLL_ON || s.phase !== 'plan' || (s.day | 0) < 2 || (s.dieState !== 'none' && s.dieState !== 'offer')) return;
      if (s.dieState === 'none' && !diceInfoOf(s).canRoll) return;
      if (bootFrames >= 0 || holdUntil || rollAnyModal() || modal()) return;
      rollOpen(s.dieState === 'none');
    }
    function rollMoving() { return roll.stage === 'anim' || roll.stage === 'land' || roll.stage === 'grow' || roll.stage === 'shrink'; }
    // toque em qualquer lugar: rolando, pula para o resultado; no resultado continua (fora o Reroll), passada a guarda
    // o toque que rola: o jogo sorteia a face agora (semente + dia) e o dado anima ate ela
    function rollTap() {
      var s = game.state;
      if (!s.die) { var r = null; try { r = game.rollDie(); } catch (x) { r = null; } if (!r || !r.ok || !game.state.die) return; }
      rollAnim();
    }
    on(rollEl, 'click', function (e) {
      if (!roll.open) return;
      if (e && e.target && (e.target === rollPass || e.target === rollKeep || e.target === rollKept)) return;
      if (roll.stage === 'ready') { rollTap(); return; }
      if (rollMoving()) { rollResultNow(roll.stage === 'anim' || roll.stage === 'shrink'); return; }
      // manha com escolha: toque perdido nao escolhe nem fecha (so os botoes)
      if (rollChoosing()) return;
      // o toque que rolou (ou um toque duplo) nao fecha o resultado sem ser visto
      if (nowMs() - roll.resAt < ROLL_GUARD_MS) return;
      rollClose();
    });
    // escolha da oferta: marca a linha de ensino vista, toca o som e fecha; o topo passa a mostrar a escolha
    function rollChoose(fn, sound, kind) {
      if (roll.stage !== 'result' || !rollChoosing()) return false;
      var r = null; try { r = fn(); } catch (x) { r = null; }
      if (!r || !r.ok) { snd('deny'); say(STR.deny.dieChoice); return false; }
      if (roll.hint) markSeen(roll.hint);
      snd(sound); emitUI('dieChoice', { choice: kind, id: game.state.die ? game.state.die.id : '' });
      rollClose();
      return true;
    }
    // w_shape (teste cego 9): o navegador leva o 'click' de um toque que caiu entre dois botoes ao botao mais perto (Chrome ajusta o toque),
    // e o dado era aplicado por um toque que a jogadora mirou fora (dia 27: +10% de carros que ela nao escolheu). O pointerdown cru
    // diz onde o dedo caiu: fora do botao, o 'click' nao escolhe; os botoes so pulsam. Sem pointerdown (teclado, teste), vale o click
    var rawDown = { x: 0, y: 0, t: -1e9 };
    function recDown(e) { if (e && typeof e.clientX === 'number') rawDown = { x: e.clientX, y: e.clientY, t: nowMs() }; }
    function strayTap(btn) {
      if (!btn || nowMs() - rawDown.t > 1500 || !btn.getBoundingClientRect) return false;
      var r = btn.getBoundingClientRect(); if (!(r.width > 0)) return false;
      return rawDown.x < r.left || rawDown.x > r.right || rawDown.y < r.top || rawDown.y > r.bottom;
    }
    function rollPulse() {
      [rollPass, rollGo, rollKeep].forEach(function (b) { if (b.classList.contains('gone')) return; b.classList.remove('crz-rollbtnpulse'); void b.offsetWidth; b.classList.add('crz-rollbtnpulse'); });
      later(function () { [rollPass, rollGo, rollKeep].forEach(function (b) { b.classList.remove('crz-rollbtnpulse'); }); }, 420);
    }
    on(rollEl, 'pointerdown', recDown, true);
    on(cardsEl, 'pointerdown', recDown, true);
    on(rollGo, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (rollChoosing() && strayTap(rollGo)) { rollPulse(); return; }
      if (rollChoosing()) { rollChoose(function () { return game.useDie(); }, 'place', 'use'); return; }
      rollClose();
    });
    on(rollPass, 'click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); if (strayTap(rollPass)) { rollPulse(); return; } rollChoose(function () { return game.passDie(); }, 'select', 'pass'); });
    on(rollKeep, 'click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); if (strayTap(rollKeep)) { rollPulse(); return; } rollChoose(function () { return game.keepDie(); }, 'select', 'keep'); });
    // a face guardada no lugar de rolar: vale na hora; o cartao mostra a face aberta com Continue
    on(rollKept, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (roll.stage !== 'ready' && roll.stage !== 'result') return;
      var r = null; try { r = game.playKept(); } catch (x) { r = null; }
      if (!r || !r.ok) { snd('deny'); say(STR.deny.dieChoice); return; }
      markSeen('rollAny'); rollMark(game.state.day | 0);
      emitUI('dieChoice', { choice: 'kept', id: game.state.die ? game.state.die.id : '' });
      rollResultNow(true);
    });
    on(doc, 'keydown', function (e) {
      if (!e || !roll.open) return;
      if (roll.stage === 'ready' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { pd(e); rollTap(); return; }
      if (e.key === 'Escape') { if (rollMoving()) rollResultNow(roll.stage === 'anim' || roll.stage === 'shrink'); else if (!rollChoosing()) rollClose(); }
    });
    on(panel, 'scroll', syncMore);
    on(skipBtn, 'click', function () {
      if (picked) return;
      if (!sumGate(skipBtn)) return;
      picked = true;
      var r = game.skipDraft(); snd('select');
      if (r && r.ok === false) picked = false; // nunca prende o jogador no resumo
    });
    // toque perdido nao escolhe a recompensa (jogador-so-tela 2026-11-09: o toque mirando o raio/pausa caiu no
    // painel recem-aberto e escolheu a carta). Ate 700 ms: ignorado. De 700 ms a 1,2 s: o 1o toque so arma
    // ('Tap again to pick'), o 2o no mesmo botao em ate 3 s confirma. Depois de 1,2 s: um toque basta
    // 2026-11-09 (nv4: toques em serie escolhiam a carta em 0,5 a 1 s): janela morta DESLIZANTE de 1,2 s (todo
    // toque nela reinicia a contagem); depois, se o toque anterior no painel foi ha menos de 600 ms, o toque so
    // arma ('Tap again to pick it.') e o segundo no mesmo botao confirma; senao um toque escolhe
    var sumWaiting = false, sumShownAt = 0, sumQuietFrom = 0, sumPrevTap = 0, sumLastTap = 0, sumArm = null, sumArmUntil = 0, SUM_DEAD = 1200, SUM_SERIES = 600;
    function sumGate(btn) {
      var now = nowMs();
      if (!sumShownAt) return false;
      if (now - Math.max(sumShownAt, sumQuietFrom) < SUM_DEAD) { sumQuietFrom = now; disarmSum(); return false; }
      if (sumArm === btn && now < sumArmUntil) { disarmSum(); return true; }
      if (sumPrevTap && now - sumPrevTap < SUM_SERIES) {
        disarmSum(); sumArm = btn; sumArmUntil = now + 3000;
        if (btn.classList) btn.classList.add('armed');
        say(STR.pickAgain, 3000);
        return false;
      }
      disarmSum();
      return true;
    }
    // toque no painel: guarda o anterior (o pointerdown do proprio clique vem antes dele)
    on(sumEl, 'pointerdown', function () { sumPrevTap = sumLastTap; sumLastTap = nowMs(); }, true);
    function disarmSum() { if (sumArm && sumArm.classList) sumArm.classList.remove('armed'); sumArm = null; sumArmUntil = 0; }
    function sumShownTick(now) {
      var on = sumEl.classList.contains('show');
      if (on && !sumShownAt) { sumShownAt = now; sumQuietFrom = 0; sumPrevTap = sumLastTap = 0; }
      else if (!on && sumShownAt) {
        sumShownAt = 0; disarmSum();
        if (sayEl.textContent === STR.pickAgain) { sayUntil = 0; sayEl.classList.remove('show'); sayEl.textContent = ''; }
      }
      if (sumArm && now >= sumArmUntil) disarmSum();
      // w_bugs13: a tap in the dead window is ignored on purpose; the rows look not-ready (the dimmed state Play has while it waits) for exactly that long
      var wait = !!sumShownAt && now - Math.max(sumShownAt, sumQuietFrom) < SUM_DEAD;
      if (wait !== sumWaiting) { sumWaiting = wait; sumEl.classList.toggle('crz-guard', wait); }
    }
    // v2 (D9): volta a manha do primeiro dia do capitulo (game.retrySave). main.js grava e recarrega; sem main.js
    // (testes), grava aqui. false = nada a voltar
    function retryChapter() {
      if (CRZ.app && CRZ.app.retry) return CRZ.app.retry() !== false;
      var d = game.retrySave ? game.retrySave() : null;
      if (!d) return false;
      leaving = true; lsSet(SAVE_KEY, JSON.stringify(d)); lsDel(PLAN_KEY); lsDel(RUN_KEY);
      try { root.location.reload(); } catch (e) {}
      return true;
    }
    function restart() {
      if (CRZ.app && CRZ.app.restart) { CRZ.app.restart(); return; }
      beginLeave();
      try { root.location.reload(); } catch (e) {}
    }

    // ---- bandeja ----
    // custo no ladrilho: o numero (jogador-so-tela 2026-11-09: os pontinhos nao diziam 'custa 2'); gratis: 'free'
    function toneCost(n) {
      // w_tiles: com o nome ao lado, 'Road free' nao cabe no ladrilho de 42 px (tela baixa, 5 ferramentas numa linha):
      // la o gratis vira o numero 0 em verde ('Road 0'); nas outras telas segue 'free' (style.css, crz-f0/crz-fw)
      if (n <= 0) return '<b class="free"><span class="crz-fw">free</span><span class="crz-f0">0</span></b>';
      return '<b>' + n + '</b>';
    }
    function rebuildTray(s) {
      tilesEl.innerHTML = '';
      tiles = {};
      var i;
      for (i = 0; i < s.tools.length; i++) {
        (function (t) {
          if (!t.unlocked) return;
          // w_tiles: o semaforo leva o teto ('1 of 2') ao lado da cabeca do sinal (a caixa do SVG recortada no corpo,
          // viewBox 13..35): nome e custo ficam no rotulo como nos outros, sem empilhar tres coisas numa linha
          var lightRow = t.id === 'light', capEl = null;
          var b = tut(el('button', 'crz-tile', lightRow ? '' : toolIcon(t.id)), 'tool-' + t.id);
          if (lightRow) { var row = el('span', 'crz-trow', svg(ICONS.light, '13 0 22 48')); capEl = el('span', 'crz-tcap'); row.appendChild(capEl); b.appendChild(row); }
          b.setAttribute('aria-label', STR.tools[t.id] || t.id);
          var cost = el('div', 'crz-cost');
          b.appendChild(cost);
          tilesEl.appendChild(b);
          b.setAttribute('data-tool', t.id);   // o clique chega por delegacao em tilesEl
          tiles[t.id] = { el: b, cost: cost, c: -1, poor: null, sel: null, hint: null, cap: capEl };
        })(s.tools[i]);
      }
      // sem ferramenta nenhuma: so o play na base (bandeja e orcamento somem)
      var nt = 0, q; for (q in tiles) if (tiles.hasOwnProperty(q)) nt++;
      bottom.classList.toggle('notools', nt === 0);
    }
    // delegacao: um listener em tilesEl e outro em cardsEl (antes cada ladrilho e carta recriados
    // deixavam um handler em listeners[] para sempre). Sobe do alvo ate o botao com o atributo.
    function upTo(t, stopAt, attr) {
      while (t && t !== stopAt) {
        if (t.getAttribute && t.getAttribute(attr) != null) return t;
        t = t.parentNode;
      }
      return null;
    }
    // pressao longa num ladrilho (sem escolher): a mesma legenda num aviso curto; o clique que vem depois e ignorado
    var lpT = 0, lpFired = false, LP_MS = 500;
    on(tilesEl, 'pointerdown', function (e) {
      var b = upTo(e && e.target, tilesEl, 'data-tool'); if (!b) return;
      lpFired = false; if (lpT) root.clearTimeout(lpT);
      var id = b.getAttribute('data-tool');
      lpT = later(function () { lpT = 0; lpFired = true; sayUntil = 0; say(legendText(id), 3800); emitUI('toolLegend', { tool: id }); }, LP_MS);
    });
    function lpCancel() { if (lpT) { root.clearTimeout(lpT); lpT = 0; } }
    on(tilesEl, 'pointerup', lpCancel); on(tilesEl, 'pointercancel', lpCancel); on(tilesEl, 'pointerleave', lpCancel);
    on(tilesEl, 'click', function (e) {
      var b = upTo(e && e.target, tilesEl, 'data-tool');
      if (lpFired) { lpFired = false; return; }
      if (b) onTile(b.getAttribute('data-tool'));
    });
    on(guideBtn, 'click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); openGuide(); });
    on(cardsEl, 'click', function (e) {
      var b = upTo(e && e.target, cardsEl, 'data-card');
      if (!b || picked) return;
      if (strayTap(b)) return;   // w_shape: o toque caiu fora da carta (o navegador levou o click a mais perto): nao escolhe
      if (!sumGate(b)) return;
      var idx = +b.getAttribute('data-card');
      picked = true;
      snd('card');
      var r = game.pickCard(idx);
      if (r && r.ok === false) { picked = false; snd('deny'); shake(b); say(STR.deny.cardFail); }
      else emitUI('cardPicked', { index: idx });
    });
    function onTile(id) {
      if (modal()) return;
      var s = game.state;
      if (s.phase !== 'plan') { if (s.phase === 'run') { snd('deny'); say(STR.deny.tileRun); } return; }
      if (sel === id) { setSel(null); snd('select'); return; }
      var info = null, i;
      for (i = 0; i < s.tools.length; i++) if (s.tools[i].id === id) info = s.tools[i];
      // todos os semaforos em uso: a ferramenta entra mesmo assim (mover e de graca) e diz como
      if (info && id === 'light' && info.cap != null && isFinite(info.cap) && (info.used | 0) >= info.cap && info.used > 0 && !(info.hand > 0) && info.unlocked !== false) {
        setSel(id); snd('select'); say(denyText({ reason: 'cap' }, id, s, CFG), 4000); pulseLights(); emitUI('lightCapPick', { cap: info.cap });
        return;
      }
      if (info && !info.afford) {
        if (info.unlocked !== false && !(info.hand > 0) && HAND_TOOLS[id] && hasOnMap(id)) {
          setSel(id, true); snd('select'); say(STR.movePlaced(id), 4000); pulsePlaced(id); emitUI('movePick', { tool: id });
          return;
        }
        snd('deny'); shake(tiles[id].el);
        if (info.unlocked === false && CFG.tools[id]) { say(STR.deny.tileLocked(CFG.tools[id].unlockDay, id, CFG)); return; }
        if (info.cap != null && (info.used | 0) >= info.cap && (s.budget | 0) >= (typeof info.cost === 'number' ? info.cost : 0)) {
          say(denyText({ reason: 'cap' }, id, s, CFG)); var pw = game.world.nodes, pk0; for (pk0 in pw) if (pw.hasOwnProperty(pk0) && pw[pk0].tool === 'light') addPulse(pw[pk0].x, pw[pk0].y);
          return;
        }
        say(denyText({ reason: 'budget' }, id, s, CFG, typeof info.cost === 'number' ? info.cost : undefined));
        return;
      }
      setSel(id); snd('select');
      priceSay(id, info, s);
    }
    // w_paid: na primeira manha do capitulo, o primeiro toque numa peca que subiu de preco repete a linha do cartao do capitulo
    // ('Lights now cost 6.'): quem fechou o cartao depressa ve o preco novo dito uma vez. Peca na mao ou de graca: calada
    var priceSaid = {};
    function priceSay(id, info, s) {
      var d = s.day | 0, a = Math.floor((d - 1) / CH_LEN) * CH_LEN + 1, key = id + '@' + d;
      if (d < 2 || d !== a || priceSaid[key] || !STR.chPrice[id] || !info || info.unlocked === false || info.hand > 0 || !(info.cost > 0)) return;
      if (listPrice(id, a) <= listPrice(id, a - 1)) return;
      priceSaid[key] = 1; say(STR.chPrice[id](listPrice(id, a)), 3200);
    }
    // ferramentas liberadas iguais as do ultimo quadro? compara id a id, sem montar string
    function trayChanged(s) {
      var i, j = 0;
      if (!unlockedIds) return true;
      for (i = 0; i < s.tools.length; i++) {
        if (!s.tools[i].unlocked) continue;
        if (unlockedIds[j] !== s.tools[i].id) return true;
        j++;
      }
      return j !== unlockedIds.length;
    }
    function syncTray(s) {
      var i, t;
      if (trayChanged(s)) {
        unlockedIds = [];
        for (i = 0; i < s.tools.length; i++) if (s.tools[i].unlocked) unlockedIds.push(s.tools[i].id);
        rebuildTray(s); layoutDirty = true;
      }
      if (sel && !tiles[sel]) setSel(null);
      for (i = 0; i < s.tools.length; i++) {
        t = s.tools[i];
        var tl = tiles[t.id]; if (!tl) continue;
        var c = game.cost ? game.cost(t.id) : t.cost;
        // nv10 1: a gratuidade que veio do dado so aparece depois de a jogadora rolar
        if (c === 0 && (t.id === 'road' || t.id === 'light') && dieFreeHidden(s)) c = listPrice(t.id);
        // w_tiles: todo ladrilho diz o nome curto ao lado do custo ('Road 2', 'Stop 1', 'Round 3'): o dono jogou
        // semanas sem saber o que era o aro com ponto. O ladrilho cresce na largura so o que o nome pede (style.css)
        // v2m: o ladrilho do semaforo diz quantos a cidade liga ('1 of 2'), ao lado do icone (crz-tcap)
        var hasCap = t.id === 'light' && t.cap != null && isFinite(t.cap);
        var ck = HAND_TOOLS[t.id] && t.hand > 0 ? 'hand|' + t.hand + '|' + c + '|' + (t.used | 0) + '|' + (t.cap == null ? '' : t.cap) : hasCap ? c + '|' + t.used + '|' + t.cap : c;   // peca na mao: custo 'free'
        if (ck !== tl.c) {
          tl.c = ck; tl.cost.innerHTML = '<span class="crz-tname">' + (STR.tileName[t.id] || STR.tools[t.id] || t.id) + '</span>' + toneCost(c);
          // o semaforo na mao ainda e da jogadora: o teto conta mapa + mao ('3 of 3' com um na mao e o custo 'free')
          var capUsed = (t.used | 0) + (t.id === 'light' ? (t.hand | 0) : 0);
          if (tl.cap) { tl.cap.textContent = hasCap ? STR.capTile(capUsed, t.cap) : ''; tl.el.classList.toggle('crz-capon', hasCap); }
          tl.el.setAttribute('aria-label', (STR.tools[t.id] || t.id) + ', ' + (c <= 0 ? 'free' : c + (c === 1 ? ' build point' : ' build points')) +
            (hasCap ? ', ' + STR.capTile(capUsed, t.cap) + ' lights' : ''));
        }
        var poor = !t.afford;
        if (poor !== tl.poor) { tl.poor = poor; tl.el.classList.toggle('poor', poor); }
        // rua gratis do dia ainda nao usada: o ladrilho Road pulsa (o 'free' ja aparece no custo)
        // blind3 2: o destaque verde so com a ferramenta armada (verde sem estar na mao parecia armado)
        var fr = t.id === 'road' && !!(s.free && s.free.road) && s.phase === 'plan' && sel === 'road' && !dieFreeHidden(s);
        if (fr !== tl.free) { tl.free = fr; tl.el.classList.toggle('crz-freeon', fr); }
        var isSel = sel === t.id;
        if (isSel !== tl.sel) { tl.sel = isSel; tl.el.classList.toggle('sel', isSel); }
        // faixa 'Pick New road...' (dia 1 sem rua): o anel e no ladrilho da rua ate ela ser escolhida
        var hh = !!(hint && hint.tile && hint.toolId === t.id) || (t.id === 'road' && sel !== 'road' && (nextFirstOn ||
          ((s.day | 0) === 1 && s.phase === 'plan' && !day1Built() && !tutorScript())));
        if (hh !== tl.hint) { tl.hint = hh; tl.el.classList.toggle('hint', hh); }
      }
    }

    // ---- topo e orcamento ----
    var cache = { day: -1, phase: '', dieF: undefined, nextF: undefined, strikes: -1, speed: -1, dieHide: null, budget: -1, cap: -1, undo: null };
    var rollMs = 0, rollTick = 0;
    // nv10 1 (2026-11-15): enquanto o dado de hoje nao foi rolado, o topo nao entrega o resultado: face neutra '?',
    // sem 'Today', sem icone do efeito; pontos sem o bonus do dado; amanha some. O estado do jogo nao muda
    // dado v2: pendente = ainda nao rolou, ou o cartao esta rolando (a face ja saiu do jogo mas nao apareceu)
    function rollPending(s) {
      if (!ROLL_ON || !s || s.phase !== 'plan' || (s.day | 0) < 2) return false;
      if (s.dieState === 'none') return !!diceInfoOf(s).canRoll;
      return roll.open && roll.stage !== 'result';
    }
    // o efeito da face ja esta no orcamento (sem escolha, ou usada)
    function dieLive(s) { return !!s.die && (s.dieState === 'auto' || s.dieState === 'used'); }
    function cardGives(s, id) { return (s.cards || []).indexOf(id) >= 0; }
    function dieFreeHidden(s) {
      var fx = s && s.die && s.die.effect;
      return !!(fx && fx.free) && dieLive(s) && rollPending(s) && !cardGives(s, 'freeRoad') && !cardGives(s, 'freeLight');
    }
    function shownBudget(s) {
      var b = s.budget | 0;
      if (!rollPending(s) || !dieLive(s)) return b;
      var fx = s.die && s.die.effect;
      return Math.max(0, b - ((fx && fx.budget) | 0));
    }
    function drawDie(die, value, hide) {
      if (hide || !die) {
        diePips.innerHTML = dieSvg('?', 20, 'plain'); dieEv.innerHTML = ''; dieLbl.textContent = STR.lblDie;
        if (diePips.firstChild && diePips.firstChild.setAttribute) diePips.firstChild.setAttribute('class', 'pips');
        return;
      }
      // dado v2: oferta passada ou guardada = dado neutro, sem icone (dia normal); usada = a face no tom dela
      var ds = game.state && game.state.dieState, neutral = die.v === 2 && (ds === 'passed' || ds === 'kept' || ds === 'offer');
      diePips.innerHTML = dieSvg(value, die.faces, neutral ? 'plain' : die.kind);
      dieEv.innerHTML = neutral ? '' : eventSvg(die.id, die.kind, freeGrant(die, game.state && game.state.day));
      dieLbl.textContent = neutral ? STR.lblPassed : STR.lblToday(die.id, die.kind, die.value);
      if (diePips.firstChild && diePips.firstChild.setAttribute) diePips.firstChild.setAttribute('class', 'pips');
      if (dieEv.firstChild && dieEv.firstChild.setAttribute) dieEv.firstChild.setAttribute('class', 'ev');
    }
    function syncTop(s) {
      var i;
      if (cache.day !== s.day || cache.phase !== s.phase) {
        var base = (Math.max(1, Math.ceil((s.day | 0) / CH_LEN)) - 1) * CH_LEN;   // dia antes do primeiro do capitulo
        for (i = 0; i < dotEls.length; i++) {
          var di = base + i + 1;
          var past = di < s.day;   // passados cheios, o dia atual com anel (tambem no resumo e na derrota), futuros vazios
          var now = di === s.day;
          dotEls[i].className = 'crz-dot' + (past ? ' past' : (now ? ' now' : '')) + (di > CFG.maxDays ? ' gone' : '');
          dotEls[i].setAttribute('aria-label', 'Day ' + di);
          if (now) dayLbl.textContent = STR.lblDay(s.day | 0, CFG.maxDays);
          if (now) chLbl.textContent = CH_LEN < CFG.maxDays ? STR.lblChapter(Math.ceil((s.day | 0) / CH_LEN), Math.ceil(CFG.maxDays / CH_LEN)) : '';
          if (now) dotEls[i].setAttribute('aria-current', 'step'); else if (dotEls[i].removeAttribute) dotEls[i].removeAttribute('aria-current');
          if (now && lastDayOf(s) && dotsEl.setAttribute) dotsEl.setAttribute('aria-label', STR.lastDay(s.day | 0, CFG.maxDays));
        }
      }
      var dieHide = s.day < 2;
      if (dieHide !== cache.dieHide) {
        var wasHidden = cache.dieHide === true;
        cache.dieHide = dieHide;
        dieEl.classList.toggle('hide', dieHide);
        if (dieHide) dieEl.removeAttribute ? dieEl.removeAttribute('data-tut') : dieEl.setAttribute('data-tut', '');
        else { dieEl.setAttribute('data-tut', 'die'); if (wasHidden) pulseEl(dieEl); }
      }
      // dado: compara campos primitivos (antes montava uma string por quadro)
      // dado v2: antes de rolar o topo mostra '?' (nunca a face); depois a face usada no tom, ou neutro se passou
      var D = s.die, dc = cache.dieF, rpend = rollPending(s), dst = s.dieState || '';
      var showD = !!D || rpend;
      if (showD ? (!dc || !D !== !dc.id || (D && (dc.faces !== D.faces || dc.value !== D.value || dc.id !== D.id || dc.kind !== (D.kind || ''))) || dc.pend !== rpend || dc.st !== dst) : dc !== null) {
        var had = !!(dc && dc.id);
        cache.dieF = showD ? { faces: D ? D.faces : 0, value: D ? D.value : 0, id: D ? D.id : '', kind: D ? (D.kind || '') : '', pend: rpend, st: dst } : null;
        if (showD) {
          var neu = !D || rpend || (D.v === 2 && (dst === 'passed' || dst === 'kept' || dst === 'offer'));
          drawDie(D, D ? D.value : 0, rpend);
          dieEl.classList.remove('off');
          dieEl.setAttribute('data-kind', neu ? 'plain' : (D.kind || 'plain'));
          dieEl.setAttribute('aria-label', rpend || !D ? STR.dieLabel + ': ' + STR.dieNotRolled : STR.dieLabel + ': ' + (neu ? STR.lblPassed : dieName(D.id)));
          if (had && D && !rpend && !reducedMotion()) { rollMs = 400; rollTick = 0; dieEl.classList.add('rolling'); }
          else { rollMs = 0; dieEl.classList.remove('rolling'); }
        } else { dieEl.classList.add('off'); rollMs = 0; }
      }
      // previsao: so no planejamento e quando o game informa o dia seguinte (some no dia 12)
      // dado v2: a previsao do dado saiu (sistemas.md 3.2). O lugar dela ao lado do dado e o bolso do Keep: um dado
      // pequeno tracejado com o numero da face guardada, e o rotulo 'Kept: <face>'
      var N = (s.kept && !dieHide) ? s.kept : null, nc = cache.nextF;
      if (N ? (!nc || nc.value !== N.value || nc.id !== N.id) : nc !== null) {
        cache.nextF = N ? { value: N.value, id: N.id } : null;
        if (N) {
          dieNext.innerHTML = miniDieSvg(N.value, 'plain');
          nextLbl.textContent = STR.lblKept(dieName(N.id));
          dieNext.setAttribute('aria-label', STR.lblKept(dieName(N.id)));
          if (dieNext.firstChild && dieNext.firstChild.setAttribute) dieNext.firstChild.setAttribute('class', 'nxt');
          dieNext.classList.remove('off');
        } else dieNext.classList.add('off');
      }
      refreshSheet(s);
      if (cache.strikes !== s.strikes) {
        for (i = 0; i < strikeEls.length; i++) strikeEls[i].classList.toggle('on', i < s.strikes);
        strikesEl.setAttribute('aria-label', 'Strikes: ' + (s.strikes | 0) + ' of ' + (CFG.ironMode ? 1 : CFG.maxStrikes));
      }
      if (cache.phase !== s.phase || cache.speed !== s.speed || cache.ff !== !!s.ff) {
        cache.ff = !!s.ff;
        if (s.phase === 'run') {
          var si = speeds.indexOf(s.speed), sp = s.ff ? STR.ffOn : (s.speed || 1) + '×';
          if (s.ff) { playFace.innerHTML = svg(FF_ICON, '0 0 24 24'); playFace.setAttribute('data-ff', '1'); }
          else { playFace.innerHTML = ''; playFace.textContent = sp; playFace.removeAttribute('data-ff'); } playBtn.classList.remove('off');
          playBtn.classList.add('running');
          playBtn.classList.remove('lv0'); playBtn.classList.remove('lv1'); playBtn.classList.remove('lv2');
          playBtn.classList.add('lv' + clamp(si < 0 ? 0 : si, 0, 2));
          playBtn.setAttribute('aria-label', STR.speedLabel + ' ' + sp);
          playBtn.setAttribute('data-tut', 'speed');
        } else if (s.phase === 'plan') {
          playFace.innerHTML = svg(PLAY_ICON, '0 0 24 24'); playBtn.classList.remove('off');
          spdBadge.textContent = startSpeed(s) + '\u00d7';
          playBtn.classList.remove('running'); playBtn.classList.remove('lv0'); playBtn.classList.remove('lv1'); playBtn.classList.remove('lv2');
          playBtn.setAttribute('aria-label', STR.play);
          playBtn.setAttribute('data-tut', 'play');
        } else { playBtn.classList.add('off'); playBtn.classList.remove('running'); playBtn.setAttribute('data-tut', 'play'); }
      }
      // gorjetas: barra de 0 a perPoint (resto de ontem + hoje)
      var sd = s.speedDial, showT = !!(sd && s.phase === 'run' && sd.perPoint > 0);
      if (showT) {
        var tv = clamp(((sd.carry || 0) + (sd.tips || 0)) / sd.perPoint, 0, 1), tk = Math.round(tv * 100);
        if (tk !== tipKey) {
          tipKey = tk;
          tipFill.style.width = tk + '%';
          tipTxt.textContent = tv >= 1 ? (lastDayOf(s) ? STR.tipFullLast : STR.tipNext) : STR.tipLbl;
          tipEl.classList.toggle('full', tv >= 1);
        }
      }
      if (showT === tipEl.classList.contains('gone')) tipEl.classList.toggle('gone', !showT);
      // Boost: bolinhas em plan (esmaecidas por CSS) e em run, quando liberado
      var cl = s.clear, showC = !!(cl && cl.unlocked && (s.phase === 'run' || s.phase === 'plan'));
      if (showC) {
        var ch = Math.max(0, cl.charges | 0), mx = Math.max(ch, (cl.max | 0) || ch);
        var ck = ch * 100 + mx;   // numero, nao string
        if (ck !== clearKey) {
          clearKey = ck;
          var h2 = '', q2;
          for (q2 = 0; q2 < mx && q2 < 8; q2++) h2 += '<span class="crz-cp' + (q2 < ch ? ' on' : '') + '">' + svg(BOLT_ICON, '0 0 24 24') + '</span>';
          clearEl.innerHTML = h2;
          clearEl.setAttribute('aria-label', STR.boostAria + ' (' + ch + ' ' + STR.boostLeft + ')');
        }
      }
      if (showC === clearEl.classList.contains('gone')) clearEl.classList.toggle('gone', !showC);
      // sinal de desbloqueio: espera o elemento ficar visivel
      if (pend.clear && showC) { pend.clear = false; pulseEl(clearEl); }
      // progresso do dia: so escreve quando muda ~0.4% (no maximo ~250 escritas por dia)
      if (s.phase === 'run') {
        var pr = s.dayLen > 0 ? clamp(s.dayTime / s.dayLen, 0, 1) : 0;
        if (Math.abs(pr - ringP) >= 0.004 || (pr === 1 && ringP !== 1)) {
          ringP = pr;
          if (ringEl.style && ringEl.style.setProperty) ringEl.style.setProperty('--p', pr.toFixed(3));
        }
      } else if (ringP !== -1) {
        ringP = -1;
        if (ringEl.style && ringEl.style.setProperty) ringEl.style.setProperty('--p', '0');
      }
      // carta ativa (game: state.cards): a jogadora ve o efeito que escolheu ontem
      var cid = (s.phase === 'plan' || s.phase === 'run') && s.cards && s.cards.length ? s.cards[0] : '';
      if (cid && !STR.cards[cid]) cid = '';
      // obra gratis ja usada (state.free.* = false): o chip "Free road/light today" some
      if ((cid === 'freeRoad' && s.free && !s.free.road) || (cid === 'freeLight' && s.free && !s.free.light)) cid = '';
      // v2: sem carta ativa, o mesmo chip mostra as equipes da Road crew (quantas e quantos dias faltam)
      var crA = !cid && (s.phase === 'plan' || s.phase === 'run') && s.crew && s.crew.active && s.crew.active.length ? s.crew.active : null;
      var crKey = crA ? 'crew:' + crA.join(',') : cid;
      if (crKey !== chipKey) {
        chipKey = crKey;
        var crTxt = crA ? STR.crewChip(crA.length, Math.max.apply(null, crA)) : '';
        chipEl.innerHTML = cid ? cardIcon(cid) + '<span>' + STR.cardToday(STR.cards[cid]) + '</span>' : (crA ? toolIcon('road') + '<span>' + crTxt + '</span>' : '');
        chipEl.setAttribute('aria-label', cid ? STR.cardToday(STR.cards[cid]) + '. ' + STR.cardLine[cid] : crTxt);
        chipEl.classList.toggle('gone', !cid && !crA);
        layoutDirty = true;
      }
      // orcamento
      if (cache.day !== s.day || cache.phase !== s.phase) {
        // A.7: as bolinhas gastas hoje continuam vazias depois de um reload (pontos do comeco do plano)
        if (s.phase === 'plan' && cache.phase !== 'plan' || cache.day !== s.day) { var p0 = s.phase === 'plan' ? planToday(s) : null; budgetCap = Math.max(s.budget | 0, p0 && p0.b0 > 0 && p0.b0 <= 40 ? p0.b0 | 0 : 0); }
      }
      if (s.budget > budgetCap) budgetCap = s.budget;
      // nv10 1: antes de rolar, os pontos e as bolinhas nao contam o bonus do dado (entram ao rolar)
      var bb = shownBudget(s), capS = Math.max(bb, budgetCap - ((s.budget | 0) - bb));
      if (cache.budget !== bb || cache.cap !== capS) {
        // pontos sempre visiveis (ate 12; com 7+ ficam menores) e o numero ao lado: antes, com 7+, virava
        // uma bolinha so ('● 7') e o novato lia como os dias
        // ate 8: os pontos (menores a partir de 7) e o numero; acima de 8 so o numero (a fileira ficava longa)
        var h = '', n = capS > 8 ? 0 : capS, small = capS > 6;
        for (i = 0; i < n; i++) h += '<span class="crz-pt' + (i < bb ? ' full' : '') + (small ? ' sm' : '') + '"></span>';
        // o numero (maior e mais forte que o rotulo do dado) e o rotulo fixo 'Build points' em cima
        h += '<b class="crz-ptn">' + bb + '</b><span class="crz-lbl crz-lbl-bp" aria-hidden="true">' + STR.lblBp + '</span>';
        budgetEl.innerHTML = h;
        // polimento 3: o numero dos pontos conta do valor anterior ao novo (no mesmo dia; na troca de dia entra direto)
        if (typeof cache.budget === 'number' && cache.budget !== bb && cache.day === s.day && budgetEl.querySelector) {
          try { countTo(budgetEl.querySelector('.crz-ptn'), cache.budget, bb); } catch (e) {}
        }
      }
      var cu = s.phase === 'plan' && game.canUndo();
      if (cu !== cache.undo) { undoBtn.classList.toggle('off', !cu); }
      cache.day = s.day; cache.phase = s.phase; cache.strikes = s.strikes; cache.speed = s.speed; 
      cache.budget = bb; cache.cap = capS; cache.undo = cu;
    }

    // ---- resumo e fim ----
    var jamWait = false;
    function paintJam(s) {
      var worst = worstNode(s, game.world), wh = worst ? heatOf(s, worst) : 0;
      var jTxt = '';
      if (worst && wh >= JAM_SUMMARY && !lastDayOf(s)) {
        var jp = jamPick(worst, (s.day | 0) + 1, CFG, game.world, null, function (o) { return heatOf(s, o); }, true, adviceCtx(s, worst, true), adviceMemo);
        // nivel ambar (sem vermelho): o pior ponto ganha anel tracejado amanha; 'Red ring' so se ficou vermelho
        if (jp) jTxt = STR.jam.summary + (wh > RING_RED ? '' : STR.jam.dashed) + jp.text;
      }
      jamEl.textContent = jTxt; jamEl.classList.toggle('gone', !jTxt);
    }
    function buildSummary(s) {
      var sm = s.summary || {}, i;
      picked = false;
      var hl = sm.headline || '';
      headEl.textContent = hl; headEl.classList.toggle('gone', !hl);
      countTo(bigEl, 0, sm.delivered | 0);
      // v2x (playtest cego 5: o '+N score' do Delivery bonus nunca aparecia somado): com bonus, a legenda dos carros
      // traz o placar do dia, ja com o bonus dentro (summary.score: o mesmo numero que a partida soma)
      capEl.textContent = bonusScoreOf(sm) > 0 && typeof sm.score === 'number' ? STR.carsScore(sm.score | 0) : STR.cars;
      // ontem: state.history ja inclui hoje; compara com a entrada anterior
      var hs = s.history || [], prevD = null;
      if (hs.length) {
        var lastH = hs[hs.length - 1];
        var ph = lastH && lastH.day === s.day ? hs[hs.length - 2] : lastH;
        if (ph && typeof ph.delivered === 'number' && ph.day !== s.day) prevD = ph.delivered;
      }
      prevEl.textContent = prevD === null ? '' : STR.yesterday(prevD, (sm.delivered | 0) - prevD);
      prevEl.classList.toggle('gone', prevD === null);
      // dia com strike: "Yesterday" em cinza (o verde do +N brigava com o titulo "Locked!")
      var struck = !!sm.failed;
      prevEl.classList.toggle('struck', struck);
      prevEl.classList.toggle('up', !struck && prevD !== null && (sm.delivered | 0) > prevD);
      prevEl.classList.toggle('down', !struck && prevD !== null && (sm.delivered | 0) < prevD);
      fbkSummary(s);
      // v2x: 'Closest to a jam' (playtest cego 5: barra 100% vermelha em 5 dias e nenhum strike). O anel cheio leva a
      // barra a JAM_RING_BAR; o resto so enche com o relogio da trava (summary.lockNear). Cheia = travou hoje
      var ratio = jamBar(sm);
      waitFill.style.width = Math.round(ratio * 100) + '%';
      var pk0 = clamp(+sm.peak || 0, 0, 1);
      waitFill.className = pk0 >= RING_SEEN ? 'warn' : '';
      // tela baixa (<= 700 px, CSS): fila calma (pico < 0,3) nao ocupa linha
      queueRow.classList.toggle('crz-lowq', pk0 < 0.3); queueInfo.classList.toggle('crz-lowq', pk0 < 0.3);
      for (i = 0; i < sStrikeEls.length; i++) sStrikeEls[i].classList.toggle('on', i < s.strikes);
      var bTxt = '', pp = (s.speedDial && s.speedDial.perPoint) || (CFG.speedDial && CFG.speedDial.tipsPerPoint) || 0;
      // barra do bonus: cheia quando rendeu ponto; senao o resto acumulado de 0 a perPoint (bate com "N of 30")
      var bfr = sm.speedBonus > 0 ? 1 : (pp > 0 ? clamp((+sm.tipCarry || 0) / pp, 0, 1) : 0);
      bonusFill.style.width = Math.round(bfr * 100) + '%';
      bonusFill.className = 'ok';
      bonusRow.classList.toggle('gone', !(pp > 0));
      // v2 (CFG.deliveryBonus 'score'): a barra cheia vira placar (bonusScore); save antigo sem o campo: barras x valor
      if (sm.speedBonus > 0) bTxt = STR.speedBonusYes + bonusScoreOf(sm) + STR.speedBonusTail;
      // o resto que sobra (< pp) arredondado para baixo: nunca '30 of 30' sem o ponto
      else if (sm.tipCarry > 0 && pp > 0) {
        bTxt = STR.speedBonusNone + Math.min(pp - 1, Math.floor(sm.tipCarry)) + ' of ' + pp + STR.speedBonusToward;
        // de onde vem o numero: carros de hoje + extra da velocidade + o que sobrou de antes (nv5: '21 of 30' com 17 carros)
        var dv = sm.delivered | 0, tp = +sm.tips || 0, ex = Math.max(0, Math.round(tp - dv)), pv = Math.max(0, Math.floor(sm.tipCarry - tp + 1e-6));
        if (typeof sm.tips === 'number' && dv > 0) bTxt += STR.bonusParts(dv, ex, pv);
      }
      // barra vazia: diz como encher (ninguem entendia a barra)
      else if (pp > 0 && !lastDayOf(s)) bTxt = STR.speedBonusHow;
      bonusEl.textContent = bTxt;
      bonusEl.classList.toggle('gone', !bTxt);
      // (A2) o valor na barra, a direita; a linha verde de texto nao aparece mais (fica para o (i))
      if (sm.speedBonus > 0) { countTo(bonusVal, 0, bonusScoreOf(sm), function (v) { return STR.bvalPlus(v); }); }
      else { bonusVal.__crzCount = (bonusVal.__crzCount | 0) + 1; bonusVal.textContent = pp > 0 ? Math.min(pp - 1, Math.floor(+sm.tipCarry || 0)) + '/' + pp : ''; }
      // (A1) strikes no resumo so no dia que teve strike (os circulos ja estao no topo)
      strikeRow.classList.toggle('gone', !sm.failed);
      // v2: o ponto natural de parada e o fim de capitulo (antes: 'Halfway!' no dia 6 de 12)
      var half = !!chapterDoneOf(sm);
      halfEl.textContent = half ? STR.chapterStop : ''; halfEl.classList.toggle('gone', !half);
      chapterMoment(s, chapterDoneOf(sm));
      // (A3) explicacoes: abertas no primeiro resumo da partida, depois atras do (i)
      var firstSum = gOn() && !seen('sumInfo'); if (firstSum) markSeen('sumInfo');
      for (i = 0; i < infoRows.length; i++) setInfo(infoRows[i], firstSum);
      var carryN = lastDayOf(s) ? 0 : Math.min(s.budget | 0, CFG.carryCap != null ? CFG.carryCap : 3);
      var carryCapN = CFG.carryCap != null ? CFG.carryCap : 3, pointsLostN = lastDayOf(s) ? 0 : Math.max(0, (s.budget | 0) - carryCapN), lostCh = Math.ceil((s.day | 0) / (CFG.chapterDays || 10));
      if ((s.day | 0) <= 1) carryLostShown = {};
      if (pointsLostN > 0 && (!carryLostShown[lostCh] || carryLostShown[lostCh] === s.day)) { carryLostShown[lostCh] = s.day; carryEl.textContent = STR.carryLost(pointsLostN, carryCapN); }
      else carryEl.textContent = carryN > 0 ? STR.carryOver(carryN) : '';
      carryEl.classList.toggle('gone', !(carryN > 0));
      bonusEl.classList.toggle('lost', !(sm.speedBonus > 0));
      // v2int: o 'e se' ja anda em fatias desde o fim do dia (wiStart em onPhase). A linha do pior ponto (escondida no
      // painel enxuto, lida pelo tutorial) sai quando o 'e se' dele termina: sem 'e se', o conselho pelo tipo
      var worst = worstNode(s, game.world), wh = worst ? heatOf(s, worst) : 0;
      jamWait = !!(worst && wh >= JAM_SUMMARY && !lastDayOf(s) && wiPending(worst.id)); jamWaitId = jamWait ? worst.id : null;
      if (jamWait) { jamEl.textContent = ''; jamEl.classList.add('gone'); } else paintJam(s);
      // resumo do ultimo dia (antes da vitoria): uma linha de fechamento no lugar da dica de amanha
      // (o game hoje vai do dia 12 direto ao fim, sem resumo: a linha de fechamento sai tambem na vitoria;
      // no resumo do dia 11 a linha avisa que amanha e o ultimo dia)
      var cTxt = lastDayOf(s) ? STR.closing(s.day | 0, (s.totalDelivered | 0) || (sm.delivered | 0))
        : ((s.day | 0) === CFG.maxDays - 1 ? STR.tomorrowLast : '');
      // v2: fim de capitulo (game: summary.chapterDone): titulo e linha de fechamento do proprio cartao
      var cd = chapterDoneOf(sm);
      if (cd) { headEl.textContent = STR.chapterDone(cd.chapter); headEl.classList.remove('gone'); cTxt = STR.chapterLine(cd.cars, cd.strikesLeft, CFG.maxStrikes | 0); }
      closeEl.textContent = cTxt; closeEl.classList.toggle('gone', !cTxt);
      // (4) cruzamentos que o crescimento criou e seguem sem sinal (dia 4+, nao no ultimo dia)
      var nj = (s.day | 0) >= ASSIST_DAY && !lastDayOf(s) ? newJList().length : 0;
      newJEl.textContent = nj ? STR.newJ(nj) : '';
      newJEl.setAttribute('aria-label', nj ? STR.newJAria(nj) : '');
      newJEl.classList.toggle('gone', !nj);
      // (A4/A5) um chip de acao so: NEW sem sinal primeiro; senao o cruzamento mais cheio do dia
      todoKind = null; todoNode = null;
      if (nj) { todoKind = 'newj'; todoNode = newJList()[0] || null; todoEl.textContent = STR.todoNew(nj); }
      else if (worst && wh >= JAM_SUMMARY && !lastDayOf(s) && !(worst.portal && degOf(worst) < 2)) { todoKind = 'busy'; todoNode = worst; todoEl.textContent = STR.todoBusy; }
      todoEl.classList.toggle('gone', !todoKind);
      var lw = game.world && game.world.stats;
      lostN = sm.lost > 0 ? sm.lost | 0 : (lw && lw.lost > 0 ? lw.lost | 0 : 0);
      lostShown = false; lostPaint(); lostEl.classList.toggle('gone', !(lostN > 0));
      sumEl.classList.remove('crz-peek');
      cardsEl.innerHTML = '';
      var dr = lastDayOf(s) ? [] : (s.draft || []);
      // carta 'Free traffic light' com o dado de amanha ja dando o semaforo gratis: a carta nao soma (game.js
      // guarda uma gratuidade so); ela sai da lista mostrada, sem mudar o indice das outras (pickCard(idx))
      var dieFL = dieFreeLight(s.nextDie, (s.day | 0) + 1, CFG);
      // 'Calm drivers' fala de aneis: so depois do primeiro anel de fila da partida (antes ninguem sabe o que e)
      var pk0 = Math.max(+sm.peak || 0, wh);
      if (pk0 >= RING_EVER_AT || hotAny(s)) ringEver = true;
      // 'Free traffic light' so com o semaforo liberado amanha (antes: 'Traffic lights come later' na mesma carta)
      var lightTomorrow = toolOpen(CFG, 'light', (s.day | 0) + 1);
      // nv7: 'Double green wave' so com semaforo (antes aparecia no dia 2)
      // dono 2026-11-10: 'Faster cars' e 'Double green wave' sairam do jogo (RETIRED); se um sorteio antigo trouxer, nao aparecem
      function shownCard(id) { return !RETIRED[id] && !(id === 'freeLight' && (dieFL || !lightTomorrow)) && !(id === 'patient' && !ringEver); }
      var nShown = dr.filter(shownCard).length;
      var choiceDay = !!(CFG.choiceCard && dr.some(function (c) { return (CFG.choiceCard.cards || []).indexOf(c) >= 0; }));
      cardsTitle.textContent = choiceDay ? STR.cardsTitleChoice : STR.cardsTitle;
      cardsHead.classList.toggle('gone', !nShown);
      // sem cartas o botao e o unico caminho adiante: "Continue", nao "Skip reward"
      skipBtn.textContent = nShown ? STR.skip : STR.cont;
      skipBtn.classList.toggle('only', !nShown);
      var pk = Math.max(+sm.peak || 0, wh);
      var cctx = { day: s.day | 0, cfg: CFG, pairs: pairCount(game.world), dieFreeLight: dieFL, pointsWaste: pointsWasted(s) };
      var pick = gOn() ? suggestCard(dr, pk, worst, cctx) : null;   // w_bugs12: 'Good pick' (and the dark card) is teaching: Guidance Off shows none
      // botao principal do resumo = uma carta (a sugerida, senao a primeira que faz sentido); pular fica secundario
      // carta escura = recomendada = com o selo 'Good pick' (sempre juntos); sem recomendada, nenhuma escura
      var mainIdx = pick && shownCard(pick) ? dr.indexOf(pick) : -1;
      // ordem FIXA na tela (mesmo tipo de carta, mesma posicao todo dia); o indice do game segue em data-card
      var CARD_ORDER = ['plus2', 'freeRoad', 'freeLight', 'patient'], ordered = [];
      for (i = 0; i < dr.length; i++) ordered.push(i);
      ordered.sort(function (a, b) {
        var ra = CARD_ORDER.indexOf(dr[a]), rb = CARD_ORDER.indexOf(dr[b]);
        if (ra < 0) ra = 99; if (rb < 0) rb = 99;
        return ra - rb || a - b;
      });
      for (var oi = 0; oi < ordered.length; oi++) {
        i = ordered[oi];
        if (!shownCard(dr[i])) continue;
        (function (id, idx) {
          // carta = linha: icone, nome concreto, o que muda, e "Good if" (ou a recomendacao do dia)
          var b = tut(el('button', 'crz-card' + (id === pick ? ' rec' : '') + (idx === mainIdx ? ' main' : ''), cardIcon(id)), 'card-' + idx);
          var tx = el('span', 'crz-ctx');
          var nm = el('b', 'crz-cname'); nm.textContent = STR.cards[id] || id;
          var ln = el('span', 'crz-cline'); ln.textContent = (STR.cardLine[id] || '') + (id === 'plus2' && cctx.pointsWaste ? ' ' + STR.pointsWaste : '');
          var gd = el('span', 'crz-cgood');
          // (A6) 'Good if...' so nos 3 primeiros resumos da partida (aprendizado); depois titulo + efeito
          gd.textContent = (s.day | 0) <= 3 ? ((!cardFits(id, pk, cctx) && STR.cardGoodNo[id]) || STR.cardGood[id] || '') : '';
          if (!gd.textContent) gd.classList.add('gone');
          if (id === pick) { var tg = el('i', 'crz-ctag'); tg.textContent = STR.cardSuggest; nm.appendChild(tg); }
          tx.appendChild(nm); tx.appendChild(ln); tx.appendChild(gd);
          b.appendChild(tx);
          b.setAttribute('aria-label', (STR.cards[id] || id) + '. ' + ln.textContent);
          b.setAttribute('data-card', String(idx));   // clique por delegacao em cardsEl
          cardsEl.appendChild(b);
        })(dr[i], i);
      }
    }
    function forgivenText(f) {
      return f === 'chapter1' ? STR.forgiven.chapter1 : (f === 'early' ? STR.forgiven.early(CFG.noRestartBeforeDay | 0) : '');
    }
    // w_medals: um chip de marca, cheio (feito) ou vazio (ainda nao), no desenho do chip da carta do dia
    function markText(m) {
      var M = STR.marks, t = M[m.id];
      if (m.id === 'days') return t(m.n | 0);
      if (m.id === 'chEvents') return t(m.prep | 0, m.n | 0);
      return typeof t === 'string' ? t : '';
    }
    // w_chap: o que a marca pede, em uma frase (o toque na marca diz isso na faixa)
    function markHow(m) { var h = STR.markHow[m.id]; return typeof h === 'function' ? h(m.n | 0) : (h || ''); }
    // w_chap (dono: 'parece uma lista de opcoes'): feita = chip com o check; nao feita = texto quieto, sem contorno e sem
    // circulo vazio. Nenhuma e botao de escolha; tocar diz o que ela pede
    function markChip(m) {
      var tx = markText(m);
      if (!tx) return null;
      var c = el('span', 'crz-chip crz-omark' + (m.on ? ' on' : ' off'),
        m.on ? svg('<circle cx="11" cy="11" r="9" class="f-ink"/><path d="M6.5 11.5L9.5 14.5L15.5 8" fill="none" stroke-width="2.2" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"/>', '0 0 22 22') : '');
      var sp = el('span'); sp.textContent = tx; c.appendChild(sp);
      c.setAttribute('aria-label', (m.on ? STR.markOn : STR.markOff) + tx + '. ' + markHow(m));
      c.setAttribute('data-mark', m.id);
      c.setAttribute('data-how', markHow(m));
      return c;
    }
    // head(n, m): o titulo com a conta (feitas de mostradas); sem head, so os chips
    function fillMarks(box, list, head) {
      box.innerHTML = '';
      var n = 0, on = 0, chipsL = [];
      for (var i = 0; i < list.length; i++) { var c = markChip(list[i]); if (c) { chipsL.push(c); n++; if (list[i].on) on++; } }
      if (n && head) { var hd = el('div', 'crz-omarkshead'); hd.textContent = head(on, n); box.appendChild(hd); }
      for (i = 0; i < chipsL.length; i++) box.appendChild(chipsL[i]);
      box.classList.toggle('gone', !n);
    }
    function markTap(e) {
      var t = e && e.target, k = 0;
      while (t && k++ < 4 && !(t.getAttribute && t.getAttribute('data-how'))) t = t.parentNode;
      var how = t && t.getAttribute ? t.getAttribute('data-how') : '';
      if (!how) return;
      if (e.stopPropagation) e.stopPropagation();
      snd('select'); sayUntil = 0; say(how, 3000); sayEl.classList.add('crz-saytop');
    }
    function nextChText(parts) {
      if (!parts || !parts.length) return '';
      var N = STR.nextCh, out = [];
      parts.forEach(function (p) {
        var f = N[p.id]; if (typeof f !== 'function') return;
        out.push(p.id === 'lights' ? f(p.day | 0, p.n | 0) : (p.id === 'keep' || p.id === 'crew') ? f(p.day | 0) : f(p.n | 0));
      });
      return out.length ? N.lead + out.join(' ') : '';
    }
    // fim de capitulo: a marca mais ligada ao capitulo e uma linha do proximo (CRZ.Game.chapterMark / nextChapter)
    function chapterMoment(s, cd) {
      var G = CRZ.Game, mk = cd && G && G.chapterMarks ? G.chapterMarks(s, cd.chapter) : (cd && G && G.chapterMark ? [G.chapterMark(s, cd.chapter)] : []);
      fillMarks(chMarkEl, mk || [], STR.chMarksHead);
      var nt = cd && G && G.nextChapter ? nextChText(G.nextChapter(s, cd.chapter)) : '';
      chNextEl.textContent = nt; chNextEl.classList.toggle('gone', !nt);
    }
    // recordes no aparelho, por dificuldade, forma da cidade e modo (se a partida tiver um)
    var REC_KEY = 'gridlet.records';
    function recordKey(s) {
      var dName = (CRZ.difficulty && CRZ.difficulty.name) || CFG.difficultyName || 'easy';
      // w_modes: o jogo de sempre (mode 'free') fica na chave de antes, sem sufixo
      return dName + '.' + (s.archetype || 'classic') + (typeof s.mode === 'string' && s.mode && s.mode !== 'free' ? '.' + s.mode : '');
    }
    function recordOver(s, win, days, deliv, bestN, retries) {
      var G = CRZ.Game; if (!G || !G.recordsApply) return {};
      var raw = lsGet(REC_KEY), store = null;
      try { store = raw ? JSON.parse(raw) : null; } catch (e) { store = null; }
      var id = runTag + '|' + (days | 0) + '|' + (deliv | 0) + '|' + (win ? 1 : 0) + '|' + retries;
      var r = G.recordsApply(store, recordKey(s), id, { win: !!win, cars: deliv | 0, day: Math.max(0, bestN | 0), retries: retries });
      try { lsSet(REC_KEY, JSON.stringify(r.store)); } catch (e) {}
      return r.news || {};
    }
    function signCount(w) {
      var n = 0, k, N = (w && w.nodes) || {};
      for (k in N) if (N.hasOwnProperty(k) && N[k] && N[k].tool && !N[k].portal) n++;
      return n;
    }
    function chapterDoneOf(sm) {
      var c = sm && sm.chapterDone;
      return c && typeof c === 'object' && c.chapter > 0 ? { chapter: c.chapter | 0, cars: Math.max(0, c.cars | 0), strikesLeft: Math.max(0, c.strikesLeft | 0) } : null;
    }
    function buildOver(s) {
      var f = s.final || {};
      var win = typeof f.win === 'boolean' ? f.win : (overWin === null ? (s.strikes < CFG.maxStrikes) : overWin);
      var days = f.days != null ? f.days : s.day, deliv = f.delivered != null ? f.delivered : s.totalDelivered;
      var stk = f.strikes != null ? f.strikes : s.strikes;
      // v2: a vitoria conta os strikes da partida inteira (eles voltam a cada capitulo); a derrota, os do capitulo
      if (win && f.strikesTotal != null) stk = f.strikesTotal | 0;
      statNums[0].textContent = String(days | 0); countTo(statNums[1], 0, deliv | 0); statNums[2].textContent = String(stk | 0);
      overRetry = !win && f.retry && f.retry.chapter > 0 && game.retrySave ? f.retry : null;
      overTitle.textContent = win ? STR.win : (overRetry ? STR.loseChapter(days | 0) : STR.lose);
      againBtn.textContent = overRetry ? STR.retryBtn(overRetry.chapter | 0) : STR.again;
      newGameBtn.classList.toggle('gone', !overRetry);
      var nr = win ? (f.chapterRetries | 0) : 0;
      overRetries.textContent = nr > 0 ? STR.winRetries(nr) : ''; overRetries.classList.toggle('gone', !(nr > 0));
      // primeira vitoria no Easy: 'Try Normal' (contorno, abaixo de Play again)
      var dName = (CRZ.difficulty && CRZ.difficulty.name) || CFG.difficultyName || 'easy';
      tryNormalBtn.classList.toggle('gone', !(win && dName === 'easy' && !seen('tryNormal') && CRZ.difficulty && typeof CRZ.difficulty.set === 'function'));
      // derrota com causa: qual cruzamento travou e o que tentar (sem no travado: frase antiga)
      var lockN = win ? null : lockedNodeOf(s, game.world);
      overSub.textContent = win ? (stk === 0 ? STR.winFlawless : stk === 1 ? STR.winOne(days | 0) : STR.winMany(stk | 0))
        : (lockN ? loseText(lockN, days, CFG, lockN.edges ? game.world : null, function (o) { return heatOf(s, o); }, { budget: s.budget | 0, card: !!(lockN.edges && typeof game.choiceFor === 'function' && game.choiceFor(lockN.id)) }) : (STR.loseSub1 + (days | 0) + STR.loseSub2));
      var oc = win && (days | 0) >= CFG.maxDays ? (f.lastFailed ? STR.closingJam : STR.closing(days | 0, deliv | 0)) : (overRetry ? STR.retryLine(overRetry.day | 0, overRetry.chapter | 0) : '');
      overClose.textContent = oc; overClose.classList.toggle('gone', !oc);
      // melhor dia (do historico; senao do final) e pior momento (so se houve strike)
      var hs2 = s.history || [], bN = -1, bD = 0, tD = 0, hi;
      for (hi = 0; hi < hs2.length; hi++) {
        if (hs2[hi].delivered > bN) { bN = hs2[hi].delivered; bD = hs2[hi].day; }
        if (hs2[hi].failed) tD = hs2[hi].day;
      }
      if (bN < 0 && f.bestDelivered > 0) { bN = f.bestDelivered; bD = f.bestDay; }
      if (f.lock && f.lock.day) tD = f.lock.day;
      overBest.textContent = bN > 0 ? STR.bestDay(bN, bD) : '';
      overBest.classList.toggle('gone', !(bN > 0));
      // w_medals: recordes (so 'New best' quando bateu um que existia, com o de antes), marcas e o porque da vitoria
      var news = recordOver(s, win, days, deliv, bN, f.chapterRetries != null ? f.chapterRetries | 0 : s.chapterRetries | 0);
      if (bN > 0 && news.day > 0) overBest.textContent += STR.recDay(news.day);
      var rl = [];
      if (news.cars > 0) rl.push(STR.recCars(deliv | 0, news.cars));
      if (news.retries > 0) rl.push(STR.recRetries(nr, news.retries));
      overRec.textContent = rl.length ? STR.recLead + rl.join(', ') : ''; overRec.classList.toggle('gone', !rl.length);
      // w_chap: na derrota so as marcas feitas e as que o Retry ainda alcanca (open); a que nao se ganha mais nao aparece
      var mks = CRZ.Game && CRZ.Game.marks ? CRZ.Game.marks(s) : [];
      if (!win) mks = mks.filter(function (m) { return m.on || m.open !== false; });
      fillMarks(overMarks, mks, STR.marksHead);
      var wy = win && CRZ.Game && CRZ.Game.tally ? STR.winWhy(CRZ.Game.tally(s), signCount(game.world)) : '';
      overWhy.textContent = wy; overWhy.classList.toggle('gone', !wy);
      overHard.textContent = (stk > 0 && tD > 0) ? STR.toughDay(tD) : '';
      overHard.classList.toggle('gone', !(stk > 0 && tD > 0));
      overDays.innerHTML = '';
      var nBad = 0, grp = null, gCh = -1;
      for (hi = 0; hi < hs2.length; hi++) {
        var sq = el('i', 'crz-oday' + (hs2[hi].failed ? ' bad' : ''));
        if (hs2[hi].failed) nBad++;
        // w_chap: um grupo por capitulo (uma folga entre as dezenas): o lugar onde cada capitulo comeca
        var hc = Math.max(1, Math.ceil((hs2[hi].day | 0) / CH_LEN));
        if (!grp || hc !== gCh) { grp = el('span', 'crz-odaysch'); gCh = hc; overDays.appendChild(grp); }
        grp.appendChild(sq);
      }
      overDays.setAttribute('aria-label', STR.daysAria(hs2.length, nBad));
      overDays.classList.toggle('gone', !hs2.length); overDaysCap.classList.toggle('gone', !hs2.length);
      markEl.innerHTML = win
        ? svg('<circle cx="28" cy="28" r="24" class="f-green"/><path d="M16 29L25 38L41 19" fill="none" stroke-width="5" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"/>', '0 0 56 56')
        : svg('<circle cx="28" cy="28" r="24" class="f-red"/><path d="M18 18L38 38M38 18L18 38" fill="none" stroke-width="5" stroke="#fff" stroke-linecap="round"/>', '0 0 56 56');
      markEl.setAttribute('aria-label', win ? STR.win : STR.lose);
    }
    var holdUntil = 0, refitOnPlan = false, LOCK_HOLD_MS = 2000;
    function onPhase(s) {
      camFreeze = false;
      ui.setAttribute('data-phase', s.phase);
      if (s.phase === 'run') { tutorialSpeed(s); day3Notice(game.state); }
      // A.7: depois de um reload no mesmo dia, a foto do comeco do plano volta do planMemo (nao a de agora)
      if (s.phase === 'plan') { mapTouched = false; planTools = planEnter(s, toolSnap()).tools; }
      // a faixa da troca de sinal (e o Undo) e do plano: nao atravessa o Play
      else if (swapUndoUntil) { hideSwapUndo(); sayUntil = 0; sayEl.classList.remove('show'); }
      if (s.phase !== 'plan') endSwapAsk('phase');
      closeSheet();
      if (s.phase !== 'plan') closeConfirm();   // A3: a folha do Play fecha na troca de fase
      // dia que travou: segura o cruzamento travado em destaque ~2 s antes do resumo (a cena nao some)
      var lk = (s.phase === 'summary' || s.phase === 'over') && s.summary && s.summary.failed ? lockedNodeOf(s, game.world) : null;
      holdUntil = 0;
      if (lk) {
        holdUntil = nowMs() + LOCK_HOLD_MS;
        try { if (render && render.focus) render.focus(lk.x, lk.y, Math.max((render.camera && render.camera.zoom) || 1, 1.15), true); } catch (e) { warnOnce('render.focus', e); }
        addPulse(lk.x, lk.y); later(function () { addPulse(lk.x, lk.y); }, 1000);
        // v2: strike perdoado (capitulo 1, antes de noRestartBeforeDay): a mesma faixa diz que o capitulo segue
        var fg = forgivenText(s.summary.forgiven);
        // v2x: o primeiro strike contado da partida diz a regra com o numero da dificuldade (e o anel pulsa no cruzamento)
        say(fg || (firstStrike(s) ? STR.lockedFirst(strikeMax()) : STR.lockedSay), fg || firstStrike(s) ? 4200 : undefined);
        if (fg) announce(fg);
        refitOnPlan = true;
      }
      ui.classList.toggle('crz-hold', !!holdUntil);
      sumEl.classList.toggle('show', s.phase === 'summary' && !holdUntil);
      overEl.classList.toggle('show', s.phase === 'over' && !holdUntil);
      if (s.phase === 'plan' && refitOnPlan) { refitOnPlan = false; try { if (render && render.fitAll) render.fitAll(true); } catch (e) { warnOnce('render.fit', e); } }
      if (s.phase !== 'plan') { setSel(null); clearGhost(); showInfluence(null, 0); }
      if (s.phase === 'summary') {
        // o aviso do primeiro gasto (do plano) nao entra no painel do resumo
        if (sayUntil && /^You spent /.test(sayEl.textContent)) { sayUntil = 0; sayEl.classList.remove('show'); }
        wiStart(s); buildSummary(s); moreClock = 0; later(syncMore, 80);
      }
      if (s.phase === 'over') buildOver(s);
      if (s.phase === 'plan') { hint = null; layoutDirty = true; showDayBanner(s); planWarn(s); }
    }
    function strikeMax() { return CFG.ironMode ? 1 : CFG.maxStrikes | 0; }
    // hoje e o primeiro dia com strike contado desta partida (o historico ja tem hoje)
    function firstStrike(s) {
      var h = (s && s.history) || [], i, n = 0;
      for (i = 0; i < h.length; i++) if (h[i] && h[i].failed) n++;
      return n === 1 && !!(s.summary && s.summary.failed);
    }
    // entrada no plano: penultimo strike (o proximo encerra a partida) e ultimo dia. Uma vez por strike / dia
    var warned = { strikes: -1, last: -1 };
    function planWarn(s) {
      var M = CFG.ironMode ? 1 : CFG.maxStrikes | 0, k = s.strikes | 0;
      // v2: so avisa quando o proximo strike de fato encerra o capitulo (perdao: capitulo 1, antes de noRestartBeforeDay)
      var bites = !(CRZ.Game && CRZ.Game.forgiveWhy && CRZ.Game.forgiveWhy(s.day | 0));
      var wk = Math.ceil((s.day | 0) / CH_LEN) * 10 + k;
      if (M > 1 && k === M - 1 && bites && warned.strikes !== wk) { warned.strikes = wk; say(STR.strikeWarn, 3800); announce(STR.strikeWarn); return; }
      if (lastDayOf(s) && warned.last !== (s.day | 0)) { warned.last = s.day | 0; say(STR.lastDay(s.day | 0, CFG.maxDays), 3200); }
    }
    function syncLastChip(s) {
      var on = lastDayOf(s) && (s.phase === 'plan' || s.phase === 'run');
      if (on === lastChipEl.classList.contains('gone')) lastChipEl.classList.toggle('gone', !on);
      if (top.classList && on !== top.classList.contains('crz-last')) top.classList.toggle('crz-last', on);   // polimento 1: o dado abre espaco para o chip
    }

    function saveNow() {
      // troca de dificuldade em andamento: o pagehide do reload nao pode regravar o save da dificuldade antiga
      if (root.CRZ && root.CRZ.difficulty && root.CRZ.difficulty.switching) return;
      if (leaving || (root.CRZ && root.CRZ.app && root.CRZ.app.leaving)) return;
      try {
        var j = game.save();
        lsSet(SAVE_KEY, typeof j === 'string' ? j : JSON.stringify(j));
        // invisivel 7: save gravado no meio do dia volta na manha; lembra para avisar no proximo load
        if (game.state.phase === 'run') lsSet(RUN_KEY, runTag + '|' + (game.state.day | 0)); else lsDel(RUN_KEY);
      } catch (e) { warnOnce('saveNow', e); }
    }
    var offGame = game.onEvent(function (ev) {
      if (destroyed || !ev) return;
      // salva no fim do dia (contrato) e tambem ao entrar no plano e no run: o iOS descarta
      // abas em segundo plano sem aviso, e assim a carta escolhida e o crescimento nao se perdem
      if (ev.type === 'phase' && (ev.phase === 'summary' || ev.phase === 'plan' || ev.phase === 'run')) {
        // fim do dia: foto dos cruzamentos antes do crescimento (o 'grow' vem depois da carta)
        if (ev.phase === 'summary') { newJ.snap = junctionIds(); saveNewJ(); }
        saveNow();
      }
      else if (ev.type === 'grow') { onGrow(); growPend = { ids: (ev.nodeIds || []).slice() }; }
      // dado v2: rolou ou escolheu: grava na hora (recarregar volta na mesma face ou na mesma escolha pendente)
      else if (ev.type === 'die' && game.state.phase === 'plan' && ev.die) saveNow();
      else if (ev.type === 'places') placesPend = { ids: (ev.nodeIds || []).slice(), day: (game.state.day | 0) + 1 };
      else if (ev.type === 'shift') shiftPend = { up: ev.up, day: (game.state.day | 0) + 1 };
      // invisivel 5: carga do raio que voltou (dias 1 a 3): pop na bolinha e um som curto
      else if (ev.type === 'boostReady') { snd('charge'); boltPopAt = nowMs(); }
      // invisivel 8: carro que desistiu (sem rota): '-1' cinza na ponta, so nos dias de dicas (ate o dia 6)
      else if (ev.type === 'lost' && (game.state.day | 0) <= 6) {
        var ln = game.world && game.world.nodes ? game.world.nodes[ev.nodeId] : null;
        try { if (ln && render && render.note) render.note(ln.x, ln.y, '-1', 'gray'); } catch (e) { warnOnce('render.note', e); }
      }
      else if (ev.type === 'ffEnd') onFFEnd(ev);
      else if (ev.type === 'placeEvent' && ev.what === 'open') evOpen(ev);
      else if (ev.type === 'built' && ev.kind === 'road') onPlanEdit();
      else if (ev.type === 'unlock') {
        if (ev.tool === 'clear') pend.clear = true;
      }
      // v2: derrota com volta ao capitulo: o save (com o checkpoint) fica, para o Retry sobreviver a um reload
      else if (ev.type === 'over') {
        overWin = !!ev.win; if (ev.retry) saveNow(); else lsDel(SAVE_KEY);
        // G007: partida de um modo acabou de vez: o jogo de sempre estacionado volta a ser o save, e um reload cai nele
        if (!ev.retry && game.state.mode && game.state.mode !== 'free' && CRZ.Modes && CRZ.Modes.restoreFree) { try { CRZ.Modes.restoreFree(); } catch (e) { warnOnce('restoreFree', e); } }
        if (game.state.phase === 'over') buildOver(game.state);
      }
      else if (ev.type === 'freeJam' && ev.first) pendFreeJam = true;
    });

    // ---- dicas de tutorial ----
    function hk(key) { return PER_RUN[key] ? key + runTag : key; }
    function seen(key) { return !!hints[hk(key)]; }
    function markSeen(key) { hints[hk(key)] = 1; lsSet(HINT_KEY, JSON.stringify(hints)); }
    // B1: saindo para um jogo novo (New game): o pagehide do reload nao regrava o save; as dicas da partida zeram
    var leaving = false;
    function beginLeave() {
      leaving = true;
      var k; for (k in hints) if (hints.hasOwnProperty(k) && k.indexOf('@') > 0) delete hints[k];
      lsSet(HINT_KEY, JSON.stringify(hints));
      lsDel(SAVE_KEY); lsDel(PLAN_KEY);
    }
    function hintTarget(id) {
      var w = game.world, ids = [], q, best = null, bs = -1, sc;
      for (q in w.nodes) if (w.nodes.hasOwnProperty(q)) ids.push(+q);
      ids.sort(function (a, b) { return a - b; });
      var j, nd;
      if (id === 'upgrade' || id === 'oneway') {
        var eb = null, el2 = -1;
        for (q in w.edges) if (w.edges.hasOwnProperty(q)) {
          if (w.edges[q].len > el2) { el2 = w.edges[q].len; eb = w.edges[q]; }
        }
        if (!eb || !w.nodes[eb.a] || !w.nodes[eb.b]) return null;
        return { x: (w.nodes[eb.a].x + w.nodes[eb.b].x) / 2, y: (w.nodes[eb.a].y + w.nodes[eb.b].y) / 2 };
      }
      for (j = 0; j < ids.length; j++) {
        nd = w.nodes[ids[j]];
        if (id === 'road') sc = nd.portal ? Math.sqrt(nd.x * nd.x + nd.y * nd.y) + 1 + nd.x * 0.001 : 0; // empate: ponta da direita
        else sc = (nd.portal ? 0 : 10) + (nd.edges ? nd.edges.length : 0) + (nd.tool ? -20 : 0);
        if (sc > bs) { bs = sc; best = nd; }
      }
      return best ? { x: best.x, y: best.y } : null;
    }
    /* Dicas em etapas, sem texto: 'tile' (ladrilho pulsa) -> 'map' (pulsos no mapa: "arraste daqui")
     * -> 'play' (so no dia 1: play pulsa em laco ate ser tocado). Tocar o ladrilho pula para 'map';
     * construir algo pula para 'play'. */
    var playHintCls = '';
    // Dia 1, plano: com pelo menos 1 rua nova E (pontos abaixo da ferramenta mais barata OU 6 s sem tocar),
    // a faixa 'Good. Now tap Play' aparece com o anel no Play e fica ate o Play (dono no iPhone 2026-11-09:
    // 0 pontos, Rua na mao, nenhum texto dizia o que fazer). Vale com o tutorial pulado ou ja visto; um balao
    // do tutorial na tela tem a vez (nunca dois baloes)
    var lastTouchAt = nowMs(), nextOn = false, nextEdges0 = -1, nextDay = -1, NEXT_IDLE = 6000;
    function edgeTotal() { var e = game.world && game.world.edges, k, n = 0; if (e) for (k in e) if (e.hasOwnProperty(k) && e[k]) n++; return n; }
    function minToolCost(s) {
      var m = Infinity, i, t;
      for (i = 0; s.tools && i < s.tools.length; i++) { t = s.tools[i]; if (t.unlocked && typeof t.cost === 'number' && t.cost < m) m = t.cost; }
      return m;
    }
    function tutBalloonOn() { return !!(doc.querySelector && doc.querySelector('.crz-tut-box.on')); }
    // texto da faixa: sem pontos para nada, 'Out of build points'; dia 1 com pontos, 'Good. Now tap'; dia 2+,
    // 'Done building? Tap Play to start Day N' (o numero e o dia que vai comecar)
    function nextText(s) {
      // 'Out of build points' so com 0; com pontos que nao pagam nada, a frase diz isso
      if ((s.budget | 0) < minToolCost(s) && !freeLeft(s)) return (s.budget | 0) > 0 ? STR.nextShort : STR.nextOut;
      // NEW sem sinal (e pontos para ele): o passo e sinalizar antes do Play
      if (morningList(s).length && signAffordable(s)) return STR.nextNew;
      if ((s.day | 0) === 1 && !nextBuilt) return STR.nextFirst;
      // ritmo (2026-11-16): dia 2 (o primeiro com pontos para duas ruas), rua feita e outra ainda cabe: a faixa diz as
      // duas saidas, sem obrigar a segunda rua. Um anel so (o Play pulsa, como no dia 1: dono, 2026-11-09)
      if ((s.day | 0) === MORE_DAY && nextBuilt && roadLeft(s)) return STR.nextMore(s.day | 0);
      if ((s.day | 0) === 1) return STR.nextPlay;
      return STR.nextDone(s.day | 0);
    }
    var MORE_DAY = 2;
    function roadLeft(s) { return !!(s.free && s.free.road) || !!(game.canAfford && game.canAfford('road')); }
    function freeLeft(s) { var f = s.free; return !!(f && (f.road || f.light)); }
    var nextShownAt = 0, nextBumpAt = 0, NEXT_AGAIN = 10000, nextBuilt = false, nextFirstOn = false, planOpenAt = 0;
    // ferramenta nova do dia que nao foi usada em 8 s de plano: os lugares pulsam e uma frase diz como usar
    var toolHintDay = -1, TOOL_HINT_MS = 8000;
    function newToolTick(s, now) {
      // w_light: no dia do semaforo o pulso sai logo (2,5 s): o primeiro semaforo vai ao anel de ontem, nao a um calmo
      var waitMs = CFG.tools.light && CFG.tools.light.unlockDay === (s.day | 0) ? 2500 : TOOL_HINT_MS;
      if (!gOn() || toolHintDay === s.day || now - planOpenAt < waitMs || tutBalloonOn() || modal() || sayUntil) return;
      var i, t, id = null;
      for (i = 0; s.tools && i < s.tools.length; i++) { t = s.tools[i]; if (t.unlocked && CFG.tools[t.id] && CFG.tools[t.id].unlockDay === (s.day | 0) && (s.day | 0) > 1) id = t.id; }
      toolHintDay = s.day;
      if (!id || sel === id || toolUsedToday(id)) return;
      // sinal sem nenhum lugar que o aceite ainda: a frase nao manda tocar num cruzamento que nao existe
      if (NODE_TOOLS[id] && !pulseCandidates(id, true)) return;
      say(STR.toolUse(id), 5000);
      if (tiles[id]) pulseEl(tiles[id].el);
      pulseCandidates(id);
    }
    function toolUsedToday(id) {
      var w = game.world, k; if (!w || !w.nodes) return false;
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && w.nodes[k] && w.nodes[k].tool === id && !(planTools && planTools[k] === id)) return true;
      return false;
    }
    function nextStepTick(s, now) {
      if (s.phase !== 'plan') { nextOn = false; nextEdges0 = -1; nextDay = s.day; }
      else {
        if (nextEdges0 < 0 || nextDay !== s.day) { nextEdges0 = (s.day | 0) === 1 ? Math.min(edgeTotal(), DAY1_EDGES) : edgeTotal(); nextDay = s.day; nextOn = false; planOpenAt = now; toolHintDay = -1; }
        var built = edgeTotal() > nextEdges0 || !!(game.canUndo && game.canUndo());
        nextBuilt = built;
        var broke = (s.budget | 0) < minToolCost(s) && !freeLeft(s);
        // dia 1 sem tutorial (pulado ou ja visto) e nada construido: o passo inteiro, ja (antes 10 s+ sem texto)
        var tutActive = tutorScript();
        if (!nextOn && !built && (s.day | 0) === 1 && !tutActive) { nextOn = true; nextShownAt = now; nextBumpAt = now; }
        // sem pontos: na hora (qualquer caminho, com ou sem tutorial). Com pontos: depois de construir algo e
        // 6 s parada (dia 1) ou depois da ultima acao e 6 s parada (dia 2+)
        // regra permanente (2026-11-09): 6 s parada no plano, em qualquer dia, com ou sem acao, com ou sem pontos
        var idleFor = now - Math.max(lastTouchAt, planOpenAt);
        if (!nextOn && (broke || ((built || (s.day | 0) >= 2) && idleFor >= NEXT_IDLE))) { nextOn = true; nextShownAt = now; nextBumpAt = now; }
        newToolTick(s, now);
      }
      // nunca dois avisos ao mesmo tempo: a faixa espera o aviso do topo sair
      // folha do dado aberta: a faixa espera (a folha a cobria)
      var show = gOn() && nextOn && !tutBalloonOn() && !modal() && !sayEl.classList.contains('show') && !sheetOpen;
      if (show) {
        var tx = nextText(s);
        // a faixa nunca cobre rua: cobrindo, a frase curta (uma linha); ainda cobrindo, so o Play pulsa
        if (tx === STR.nextDone(s.day | 0) && nextShort === (s.day | 0)) tx = STR.nextDoneShort(s.day | 0);
        if (nextEl.textContent !== tx) nextEl.textContent = tx;
        if (now >= nextCoverAt && !nextEl.classList.contains('gone')) {
          nextCoverAt = now + 400;
          if (nextCovers()) {
            if (tx === STR.nextDone(s.day | 0)) { nextShort = s.day | 0; nextEl.textContent = STR.nextDoneShort(s.day | 0); }
            else { nextHid = s.day | 0; }
          }
        }
        if (nextHid === (s.day | 0)) { show = false; playBtn.classList.add('hint-loop'); }
        // parada 10 s com a faixa na tela: repete (pulo curto) e o Play pulsa de novo
        var idleFrom = Math.max(lastTouchAt, nextBumpAt);
        if (now - idleFrom >= NEXT_AGAIN) {
          nextBumpAt = now;
          nextEl.classList.remove('again'); void nextEl.offsetWidth; nextEl.classList.add('again');
          playBtn.classList.remove('hint-loop'); void playBtn.offsetWidth; playBtn.classList.add('hint-loop');
        }
      }
      if (show === nextEl.classList.contains('gone')) { nextEl.classList.toggle('gone', !show); bottom.classList.toggle('crz-nexton', show); }
      return show;
    }
    var nextCoverAt = 0, nextShort = -1, nextHid = -1;
    // a faixa (retangulo na tela) passa por cima de algum no ou rua do mapa?
    function nextCovers() {
      if (!render || typeof render.toScreen !== 'function' || !nextEl.getBoundingClientRect) return false;
      var b; try { b = nextEl.getBoundingClientRect(); } catch (e) { return false; }
      if (!b || !(b.height > 0)) return false;
      var w = game.world, k, t;
      function inR(p) { return p.x >= b.left - 4 && p.x <= b.right + 4 && p.y >= b.top - 4 && p.y <= b.bottom + 4; }
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && inR(render.toScreen(w.nodes[k].x, w.nodes[k].y))) return true;
      for (k in w.edges) if (w.edges.hasOwnProperty(k)) {
        var e = w.edges[k], a = w.nodes[e.a], c = w.nodes[e.b]; if (!a || !c) continue;
        for (t = 0.1; t < 1; t += 0.1) if (inR(render.toScreen(a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t))) return true;
      }
      return false;
    }
    function nextStepOn() { return nextOn; }
    // dias 1 e 2, durante o dia: uma linha discreta, uma vez, depois de 15 s sem tocar em nada (sem balao)
    var runHintEl = tut(el('div', 'crz-runhint gone'), 'run-hint'), runHintUntil = 0;
    bottom.appendChild(runHintEl);
    // dias 1 a 3 (aprendizado), durante a corrida: o raio com carga pulsa de leve (sempre ha algo a fazer).
    // Le state.boost (recarga dos dias de aprendizado, outro agente) ou state.clear
    function boltCharges(s) { var b = s.boost || s.clear; return b ? (b.charges | 0) : 0; }
    function boostLiveTick(s) {
      var live = gOn() && s.phase === 'run' && !s.paused && (s.day | 0) >= 1 && (s.day | 0) <= 3 && !!(s.clear && s.clear.unlocked !== false) && boltCharges(s) > 0;
      if (live !== clearEl.classList.contains('crz-boostlive')) clearEl.classList.toggle('crz-boostlive', live);
    }
    // ---- fast-forward (blind2 9; game.setFastForward, CFG.fastForward) ----
    var FF_CALM_MS = 4000, FF_LEFT_S = 6, FF_QUIET_MS = 8000, ffCalmSince = 0;
    function ffLim() { return (CFG.fastForward && CFG.fastForward.autoSlowStress) || 0.3; }
    function hottestNode(lim) {
      var w = game.world, ns = w && w.nodes, best = null, k;
      if (!ns) return null;
      for (k in ns) if (ns.hasOwnProperty(k)) { var n = ns[k]; if (n && (n.stress || 0) >= lim && (!best || n.stress > best.stress)) best = n; }
      return best;
    }
    function ffOff() { try { if (game.state.ff && game.setFastForward) game.setFastForward(false); } catch (e) { warnOnce('game.setFastForward', e); } }
    // toque no chip so vale 500 ms depois de ele aparecer e 500 ms depois de qualquer outro toque na tela
    var FF_GUARD_MS = 500, ffShownAt = 0, ffOtherTouchAt = 0;
    function ffShowChip(on) {
      if (on === ffChipEl.classList.contains('gone')) { ffChipEl.classList.toggle('gone', !on); if (on) ffShownAt = nowMs(); }
    }
    function inFFChip(n) { for (var i = 0; n && i < 8; i++, n = n.parentNode) if (n === ffChipEl) return true; return false; }
    on(doc, 'pointerdown', function (e) { if (!inFFChip(e && e.target)) ffOtherTouchAt = nowMs(); }, true);
    function ffTick(s, now) {
      if (typeof game.setFastForward !== 'function' || s.phase !== 'run') { ffCalmSince = 0; ffShowChip(false); return; }
      if (s.ff) { ffShowChip(false); return; }
      var calm = !hottestNode(ffLim());
      if (!calm || s.paused) ffCalmSince = 0;
      else if (!ffCalmSince) ffCalmSince = now;
      var left = (+s.dayLen || 0) - (+s.dayTime || 0);
      // final check 4: dias 1 e 2 tambem, mas so depois dos baloes do dia e de 8 s sem acao da jogadora
      var early = (s.day | 0) <= 2, quiet = now - Math.max(lastTouchAt || 0, runAt || 0) >= FF_QUIET_MS;
      var show = !!ffCalmSince && now - ffCalmSince >= FF_CALM_MS && left > FF_LEFT_S && (!early || (quiet && !tutorTalking())) &&
                 !modal() && !sheetOpen && !confirmOpen() && !tutBalloonOn() && !holdUntil;
      ffShowChip(show);
    }
    on(ffChipEl, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var tNow = nowMs();
      if (tNow - ffShownAt < FF_GUARD_MS || tNow - ffOtherTouchAt < FF_GUARD_MS) return;
      var r; try { r = game.setFastForward(true); } catch (er) { r = null; }
      ffShowChip(false); ffCalmSince = 0;
      if (r && r.ok) { snd('select'); emitUI('ffStart', {}); }
      else { snd('deny'); if (r && r.reason === 'ring') ffSlowedNote(); else say(STR.deny.ffNo); }
    });
    function ffSlowedNote() {
      stripSay(STR.ffSlowed, 4000);
      var n = hottestNode(ffLim()) || hottestNode(0.01);
      if (n) addPulse(n.x, n.y);
    }
    function onFFEnd(ev) {
      ffCalmSince = 0;
      if (ev.reason === 'ring' && game.state.phase === 'run') ffSlowedNote();
    }
    // w_guide: dia 1 de uma partida com Guidance On num aparelho que ja terminou o capitulo 1: uma linha, uma vez por partida.
    // O botao sob a faixa liga o Off na hora; sem toque, a faixa sai sozinha e nada mais acontece
    function guideHintTick(s, now) {
      if (guideHintUntil && (now >= guideHintUntil || !gOn() || s.phase !== 'plan' || (s.day | 0) !== 1)) hideGuideHint();
      if (guideHintUntil || !gOn() || (s.day | 0) !== 1 || s.phase !== 'plan' || seen('guideHint') || bootFrames >= 0) return;
      if (!CRZ.guide || !CRZ.guide.finishedChapter()) return;
      if (roll.open || chCardOpen() || modal() || tutBalloonOn() || tutorScript() || sayUntil || confirmOpen() || growPend) return;
      markSeen('guideHint');
      stripSay(STR.guideHint, 7000);
      guideHintUntil = now + 7000;
      guideOffEl.classList.remove('gone'); sayPillAvoid(guideOffEl);
    }
    on(guideOffEl, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      hideGuideHint();
      if (CRZ.guide) CRZ.guide.set(false);
      sayUntil = 0; say(STR.guideOffDone, 3500); snd('select');
      emitUI('guideOff', {});
    });
    function runHintTick(s, now) {
      if (runHintUntil && now >= runHintUntil) { runHintUntil = 0; runHintEl.classList.add('gone'); }
      // blind3 1: com o roteiro do tutorial a faixa do Boost ja disse isso (o mesmo texto em dois lugares)
      if (!gOn() || s.phase !== 'run' || (s.day | 0) !== 1 || seen('runHint') || tutBalloonOn() || s.paused || tutorScript()) return;
      if (!runAt || now - Math.max(runAt, lastTouchAt) < 15000) return;
      markSeen('runHint'); runHintEl.textContent = STR.runHint; runHintEl.classList.remove('gone'); runHintUntil = now + 6000;
    }
    var DAY1_EDGES = 1;
    function day1Built() {
      // a pilha do Undo vai no save principal durante o plano (game.save d.undo, devolvida por Game.load), entao
      // canUndo vale tambem depois de um reload; a base do plano (nextEdges0, so da UI) nao vai no save, por isso a
      // contagem de ruas do mundo e comparada com DAY1_EDGES (a cidade do dia 1 nasce com DAY1_EDGES rua, game.js)
      if (edgeTotal() > DAY1_EDGES || !!(game.canUndo && game.canUndo())) return true;
      // rede de seguranca: sem pontos (nem gratuidade) para uma rua, o Play nunca recusa (nao ha outra saida)
      var s = game.state;
      return (s.budget | 0) < minToolCost(s) && !freeLeft(s);
    }
    // w_bugs13: points with nowhere to go. In the summary: the day ends with more unspent points than the carry cap keeps. The next
    // morning: the player holds more than the cap and ended yesterday over it too (the UI remembers the last summary). Last day: no carry.
    var leftBy = { day: -1, n: 0 };
    function pointsWasted(s) {
      var cap = CFG.carryCap != null ? CFG.carryCap : 3, b = s.budget | 0;
      if (lastDayOf(s)) return false;
      if (s.phase === 'summary') { leftBy = { day: s.day | 0, n: b }; return b > cap; }
      return b > cap && s.phase === 'plan' && leftBy.day === (s.day | 0) - 1 && leftBy.n > cap;
    }
    var sayBTxt = '';   // w_layout2: o texto do aviso quando --crz-sayb foi medido
    var carryLostShown = {};   // capitulo -> dia em que o resumo disse 'N unspent points lost' (w_plus2): uma vez por capitulo
    // pontos que se perdem no Play (acima do teto de carry-over): aviso e confirmacao com o 2o toque (Easy e Normal)
    var carryAsking = { day: -1, on: false };
    function carryAsk(s) {
      var cap = CFG.carryCap != null ? CFG.carryCap : 3, b = s.budget | 0;
      if (lastDayOf(s) || b <= cap) return false;
      if (carryAsking.on && carryAsking.day === s.day) { carryAsking.on = false; playBtn.classList.remove('crz-ask'); return false; }
      carryAsking.on = true; carryAsking.day = s.day;
      sayUntil = 0; say(STR.carryAsk(b, cap), 4200);
      playBtn.classList.add('crz-ask'); snd('select');
      emitUI('playConfirm', { reason: 'carry', budget: b });
      return true;
    }
    // dicas de primeiro uso sem o roteiro (Skip): faixa curta e visivel, uma vez cada, na fila (nunca duas juntas)
    var fuQueue = [];
    function firstUse(key, text, now) {
      if (seen('fu:' + key)) return;
      markSeen('fu:' + key); fuQueue.push(text);
    }
    // so depois do Skip (quem fez o roteiro ja viu tudo isto nos baloes)
    function tutorSkipped() { var tu = CRZ.app && CRZ.app.tutorial; try { return !!(tu && tu.wasSkipped && tu.wasSkipped()); } catch (e) { return false; } }
    function firstUseTick(s, now) {
      if (!gOn() || tutorScript() || !tutorSkipped()) return;
      // dado (dia 2+, plano) e velocidade (primeiro dia que roda): uma vez cada
      if (s.phase === 'plan' && (s.day | 0) >= 2 && s.die && !seen('fu:die')) { firstUse('die', STR.dieFirst, now); pulseEl(dieEl); }
      if (s.phase === 'run' && !seen('fu:speed') && !seen('speedTaught') && runAt && now - runAt >= 7000) { firstUse('speed', STR.speedFirst, now); pulseEl(playBtn); }
      if (!fuQueue.length || sayUntil || modal() || chCardPending(s)) return;
      say(fuQueue.shift(), 6000);
    }
    function toolIntro(id) {
      var T = CRZ.Tutorial && CRZ.Tutorial.STR && CRZ.Tutorial.STR.tool;
      return (T && T[id]) || STR.tools[id] || id;
    }
    var runAt = 0;
    // ja houve anel de fila nesta partida? (o render desenha o anel tracejado a partir de 0,3)
    // A.7: reconstruido do historico salvo (pico de cada dia), nao so da sessao: a carta 'Calm drivers' nao some no reload
    var RING_EVER_AT = 0.3, ringEver = (function () { var h = (game.state && game.state.history) || [], i; for (i = 0; i < h.length; i++) if (h[i] && +h[i].peak >= RING_EVER_AT) return true; return false; })();
    function hotAny(s) { var h = s.hot, k; if (h) for (k in h) if (h.hasOwnProperty(k) && +h[k] >= RING_EVER_AT) return true; return false; }
    // anel agrupado (o contador '2' do render): uma vez por partida, o que ele quer dizer
    // invisivel 4: diz e devolve true so se o texto entrou na tela (say guarda o texto se um balao esta aberto)
    function sayShown(text, ms, valid) { say(text, ms, valid); return sayEl.classList.contains('show') && sayEl.textContent === text; }
    // regra do dia 4, sempre, uma vez por partida, no primeiro plano do dia 4 em diante (pulsa os cruzamentos sem sinal)
    var boltPopAt = 0, boltPopped = 0;
    var RUN_KEY = 'cruzamento.midday';
    function invisTick(s, now) {
      // pop na bolinha da carga que voltou (a ultima acesa)
      if (boltPopAt && boltPopAt !== boltPopped) {
        boltPopped = boltPopAt;
        var on = clearEl.querySelectorAll ? clearEl.querySelectorAll('.crz-cp.on') : [];
        var dot = on && on.length ? on[on.length - 1] : null;
        if (dot) { dot.classList.remove('crz-cppop'); void dot.offsetWidth; dot.classList.add('crz-cppop'); }
      }
      // dia 4: a recarga acabou (uma faixa, uma vez por partida, na primeira corrida do dia 4)
      if (s.phase === 'run' && (s.day | 0) === 4 && !seen('boosts4') && !tutBalloonOn() && !sayUntil && !modal()) {
        if (sayShown(STR.boostsFixed, 3500)) markSeen('boosts4');
      }
      // invisivel 7: o iOS fechou o app no meio do dia; o jogo voltou a manha do mesmo dia
      if (resumePend && s.phase === 'plan' && bootFrames < 0 && !roll.open && !modal() && !tutBalloonOn() && !sayUntil) {
        resumePend = false;
        sayShown(STR.resumedDay, 3500);
      }
    }
    var resumePend = false;
    (function readMidday() {
      var v = null; try { v = root.localStorage ? root.localStorage.getItem(RUN_KEY) : null; } catch (e) {}
      if (v && v === runTag + '|' + (game.state.day | 0) && game.state.phase === 'plan') resumePend = true;
      lsDel(RUN_KEY);
    })();
    function hasKeys(o) {
      if (!o || typeof o !== 'object') return false;
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) return true;
      return false;
    }
    function builtToday(s) {
      if (game.canUndo && game.canUndo()) return true;
      if ((s.day | 0) === 1 && edgeTotal() > DAY1_EDGES) return true;
      var p = planToday(s), b = s.budget | 0;
      if (p && p.b0 > b) return true;
      if (typeof game.save === 'function') {
        try {
          var sv = game.save();
          if (sv && (hasKeys(sv.placed) || hasKeys(sv.ow))) return true;
        } catch (e) {}
      }
      // Old saves without d.undo / gridlet.plan: out of points with no debt or upkeep drain means spent today.
      if (b < minToolCost(s) && !freeLeft(s) && !(s.debtPaid > 0) && !(s.upkeep && s.upkeep.paid > 0)) return true;
      return false;
    }
    function handAny(s) {
      var i, t;
      if (s && s.lightHand > 0) return true;
      if (s && s.hand && (s.hand.stop > 0 || s.hand.yield > 0 || s.hand.upgrade > 0)) return true;
      for (i = 0; s && s.tools && i < s.tools.length; i++) { t = s.tools[i]; if (t.unlocked && t.hand > 0) return true; }
      return false;
    }
    function welcomeText(s) {
      var d = s.day | 0, b = s.budget | 0;
      if (b < minToolCost(s) && !freeLeft(s)) {
        if (builtToday(s)) return STR.welcomeBuilt(d);
        return b > 0 ? STR.welcomeShort(d) : STR.welcomeOut(d);
      }
      if (b > 0) return STR.welcomePoints(d, b);
      if (s.free && s.free.road) return STR.welcomeFreeRoad(d);
      if (s.free && s.free.light) return STR.welcomeFreeLight(d);
      if (handAny(s)) return STR.welcomeHand(d);
      return builtToday(s) ? STR.welcomeBuilt(d) : STR.welcomeOut(d);
    }
    function untouchedDay1(s) {
      return (s.day | 0) === 1 && !(s.history && s.history.length) &&
        !(game.canUndo && game.canUndo()) && edgeTotal() <= DAY1_EDGES &&
        (s.budget | 0) >= ((CFG.budget && CFG.budget[0]) | 0) && !(s.free && (s.free.road || s.free.light));
    }
    var welcomePend = !!(opts.resumed || (game && game.resumed)) && !resumePend &&
      !!(game && game.state && game.state.phase === 'plan') && !untouchedDay1(game.state);
    var welcomeSettle = false;
    function welcomeValid() {
      return !!(game && game.state && game.state.phase === 'plan') &&
        !tutBalloonOn() && !modal() && !confirmOpen() && !sheetOpen && !roll.open && !crewOpen() && !chCardOpen();
    }
    function welcomeTick(s) {
      if (!welcomePend) return;
      if (resumePend || s.phase !== 'plan') { welcomePend = false; return; }
      var rollPend = ROLL_ON && (s.day | 0) >= 2 && (s.dieState === 'none' ? diceInfoOf(s).canRoll : s.dieState === 'offer');
      var crewPend = !!(CFG.crew && s.crew && s.crew.offer && (s.budget | 0) >= CFG.crew.cost && crewAskDay !== s.day);
      if (bootFrames >= 0 || growPend || holdUntil || modal() || chCardOpen() || chCardPending(s) ||
          roll.open || rollPend || crewOpen() || crewPend || confirmOpen() || sheetOpen || guideEl || mapBusy() ||
          tutBalloonOn() || tutorTalking() || sayUntil || sayEl.classList.contains('show')) {
        welcomeSettle = false;
        return;
      }
      if (!welcomeSettle) { welcomeSettle = true; return; }
      if (sayShown(welcomeText(s), 4000, welcomeValid)) welcomePend = false;
    }
    // v2 (D9): o que muda nos strikes, na hora em que importa, com a faixa de sempre (uma vez cada por partida)
    //  - o primeiro jam livre (dias 1 a 5): nao contou, e a partir de quando conta
    //  - a primeira manha em que um jam vira strike (dia strikeGraceUntil + 1)
    //  - a manha de cada capitulo novo (11, 21): strikes cheios de novo
    //  (o perdao do ultimo strike sai na faixa do travamento, em onPhase: forgivenText)
    // ---- w_chap: cartao de comeco de capitulo (manhas 11 e 21; dono: 'quem joga nao percebe o capitulo') ----
    // A folha da confirmacao do Play (o componente da Road crew): numero e nome do capitulo, os dias dele (as bolinhas),
    // os circulos de strike esvaziando (repostos), o que o progresso salvo garante e uma linha do que chega. Um toque.
    // E a PRIMEIRA coisa da manha: abre antes da tela do dado (chCardTick roda antes de rollScreenTick) e, como camada
    // de body.crz-modal, segura o dado, a Road crew, a manutencao, os eventos, o crescimento e o retorno da manha.
    // Uma vez por capitulo e por volta (a chave leva chapterRetries): o capitulo repetido mostra de novo, dizendo que
    // voltou. Sem dia 1 nem dia 6: o dia 1 e do tutorial e o capitulo 1 nunca recomeca (a promessa nao valeria).
    var chEl = tut(el('div', 'crz-confirm crz-chcard gone'), 'chapter-card');
    chEl.setAttribute('role', 'dialog'); chEl.setAttribute('aria-modal', 'true');
    var chBox = el('div', 'crz-cbox'), chTitleEl = el('div', 'crz-chtitle'), chDaysEl = el('div', 'crz-chdays');
    chTitleEl.id = 'crz-ch-title'; chEl.setAttribute('aria-labelledby', 'crz-ch-title');
    var chStrkRow = el('div', 'crz-chstrk'), chStrk = el('div', 'crz-sstrikes'), chStrkTxt = el('span'), chStrkEls = [];
    for (i = 0; i < (CFG.ironMode ? 1 : CFG.maxStrikes); i++) { var cs0 = el('span', 'crz-strike'); chStrk.appendChild(cs0); chStrkEls.push(cs0); }
    chStrkRow.appendChild(chStrk); chStrkRow.appendChild(chStrkTxt);
    var chSaveEl = el('div', 'crz-ctxt'), chNewEl = el('div', 'crz-chnew'), chPriceEl = tut(el('div', 'crz-chnew crz-chprice gone'), 'chapter-price'), chRow = el('div', 'crz-crow');
    var chGo = tut(el('button', 'crz-cstart'), 'chapter-go'); chGo.textContent = STR.cont; chRow.appendChild(chGo);
    [chTitleEl, chDaysEl, chStrkRow, chSaveEl, chNewEl, chPriceEl, chRow].forEach(function (x) { chBox.appendChild(x); });
    chEl.appendChild(chBox); ui.appendChild(chEl);
    var chCur = null;
    function chCardOpen() { return !chEl.classList.contains('gone'); }
    function chCardKey(s) { return 'chcard' + (s.day | 0) + '.' + (s.chapterRetries | 0) + runTag; }
    function chCardDay(d) { return d > 1 && CH_LEN < CFG.maxDays && (d - 1) % CH_LEN === 0 && d <= CFG.maxDays; }
    // a manha ainda vai abrir o cartao (as faixas que nao esperam o boot seguram ate ele sair)
    function chCardPending(s) { return chCardOpen() || (s.phase === 'plan' && chCardDay(s.day | 0) && !hints[chCardKey(s)]); }
    // o que o progresso salvo garante NESTE capitulo (CFG.noRestartBeforeDay; Easy: 21, Normal: 15)
    function chSaveText(s, c) {
      if (CFG.ironMode) return '';
      var a = (c - 1) * CH_LEN + 1, b = Math.min(CFG.maxDays, a + CH_LEN - 1), R = CFG.noRestartBeforeDay | 0;
      if ((s.chapterRetries | 0) > 0 && s.checkpointDay === a) return STR.chRetry(a);
      if (CFG.chapter1LastStrikeWarns && c === 1) return STR.chNoRestart;
      if (R <= a) return STR.chSaved;
      if (R <= b) return STR.chSavedFrom(R);
      return STR.chNoRestart;
    }
    // o que chega: carros e paciencia do perfil (CFG.difficulties[..].chapter) e o calendario (CRZ.Game.nextChapter)
    function chNewText(s, c) {
      var P = CFG.difficulties && CFG.difficulties[CFG.difficultyName], cx = P && P.chapter && P.chapter[c], out = [], G = CRZ.Game;
      if (cx && cx.spawn > 1) out.push(STR.chCars);
      if (cx && cx.patience > 0 && cx.patience < 1) out.push(STR.chWait);
      var PA = CFG.placeAt, pNow = PA ? PA((c - 1) * CH_LEN + 1) : null, pOld = PA && c > 1 ? PA((c - 2) * CH_LEN + 1) : null;
      if (pNow && pOld && pOld.max > 0 && pNow.max > pOld.max) out.push(STR.chPlaces(pNow.max | 0));
      var lead = out.length ? STR.chNewLead + out.join(', ') + '.' : '';
      var nx = G && G.nextChapter ? nextChText(G.nextChapter(s, c - 1)).replace(STR.nextCh.lead, '') : '';
      var SL = CFG.junction && CFG.junction.stop && CFG.junction.stop.late, a0 = (c - 1) * CH_LEN + 1;
      var sl = SL && SL.multiApproachPenalty > 0 && SL.fromDay >= a0 && SL.fromDay < a0 + CH_LEN ? STR.chStopLate(SL.fromDay) : '';
      if (!lead && nx) return STR.chNewLead + nx + (sl ? ' ' + sl : '');
      return lead + (lead && nx ? ' ' + nx : '') + (sl ? (lead || nx ? ' ' : STR.chNewLead) + sl : '');
    }
    // w_price: 'Lights now cost 6. Roundabouts cost 5.' (precos de CRZ.toolPrice): pecas liberadas hoje cujo preco de tabela
    // subiu desde o capitulo anterior. A Roundabout ainda nao apresentada (dia 11, libera no 12) fica fora: o cartao dela diz o preco
    function chPriceText(s, c) {
      if (c < 2) return '';
      var a = (c - 1) * CH_LEN + 1, out = [], T = s.tools || [], k;
      ['light', 'round'].forEach(function (id) {
        var t = null; for (k = 0; k < T.length; k++) if (T[k].id === id) t = T[k];
        if (!t || !t.unlocked || !STR.chPrice[id]) return;
        var now = listPrice(id, a), was = listPrice(id, a - 1);
        if (now > was) out.push(STR.chPrice[id](now));
      });
      return out.join(' ');
    }
    // strikes do capitulo anterior (dias com strike depois dos livres); numa volta, todos (acabaram)
    function chPrevUsed(s, c) {
      var M = chStrkEls.length, a = (c - 2) * CH_LEN + 1, b = a + CH_LEN - 1, h = s.history || [], n = 0, k;
      if ((s.chapterRetries | 0) > 0 && s.checkpointDay === (c - 1) * CH_LEN + 1) return M;
      for (k = 0; k < h.length; k++) if (h[k] && h[k].failed && h[k].day >= a && h[k].day <= b && h[k].day > (CFG.strikeGraceUntil | 0)) n++;
      return Math.min(M, n);
    }
    function chCardShow(s) {
      var d = s.day | 0, c = Math.ceil(d / CH_LEN), b = Math.min(CFG.maxDays, d + CH_LEN - 1), used = chPrevUsed(s, c);
      chCur = { key: chCardKey(s), day: d };
      chTitleEl.textContent = STR.chTitle(c);
      chDaysEl.textContent = STR.chDays(d, b);
      chStrkTxt.textContent = STR.strikesBack(CFG.ironMode ? 1 : CFG.maxStrikes | 0);
      var sv = chSaveText(s, c); chSaveEl.textContent = sv; chSaveEl.classList.toggle('gone', !sv);
      var nw = chNewText(s, c); chNewEl.textContent = nw; chNewEl.classList.toggle('gone', !nw);
      var pw = chPriceText(s, c); chPriceEl.textContent = pw; chPriceEl.classList.toggle('gone', !pw);
      // os usados aparecem cheios e esvaziam um a um (repostos); movimento reduzido: ja vazios
      var k, rm = reducedMotion();
      for (k = 0; k < chStrkEls.length; k++) chStrkEls[k].classList.toggle('on', !rm && k < used);
      for (k = used - 1; !rm && k >= 0; k--) (function (e, t) { later(function () { e.classList.remove('on'); }, t); })(chStrkEls[k], 450 + (used - 1 - k) * 220);
      chEl.classList.remove('gone'); modalReg().set(doc.body, 'chapter', true); snd('select');
      try { if (chGo.focus) chGo.focus(); } catch (e) {}
      emitUI('chapterCard', { day: d, chapter: c });
    }
    function chCardClose() {
      if (!chCardOpen()) return;
      chEl.classList.add('gone'); modalReg().set(doc.body, 'chapter', false);
      if (chCur) { hints[chCur.key] = 1; lsSet(HINT_KEY, JSON.stringify(hints)); markSeen('chapter' + chCur.day); }
      chCur = null;
    }
    on(chGo, 'click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); snd('select'); chCardClose(); emitUI('chapterCardClosed', {}); });
    on(doc, 'keydown', function (e) { if (e && chCardOpen() && (e.key === 'Enter' || e.key === 'Escape')) { pd(e); chCardClose(); } });
    function chCardTick(s) {
      if (chCardOpen()) { if (s.phase !== 'plan' || !chCur || chCur.day !== (s.day | 0)) chCardClose(); return; }
      if (s.phase !== 'plan' || !chCardDay(s.day | 0) || hints[chCardKey(s)]) return;
      if (bootFrames >= 0 || holdUntil || roll.open || rollAnyModal() || modal()) return;
      chCardShow(s);
    }
    var pendFreeJam = false, bannerWait = -1;
    function chapterTick(s) {
      var d = s.day | 0, G = CFG.strikeGraceUntil | 0;
      // a manha de um capitulo novo abre com o cartao do dado por cima do letreiro: o letreiro (com 'Chapter N') volta
      // quando o cartao fecha
      if (s.phase === 'plan' && d > 1 && CH_LEN < CFG.maxDays && (d - 1) % CH_LEN === 0) {
        // integracao: o letreiro e a primeira mensagem da manha; as faixas (capitulo, manutencao, problema do dia)
        // esperam ele sair (antes a faixa cobria 'Day 11')
        if (roll.open || chCardOpen()) bannerWait = d; else if (bannerWait === d) { bannerWait = -1; showDayBanner(s); if (!sayEl.classList.contains('show')) sayUntil = Math.max(sayUntil, nowMs() + 1300); }
      }
      if (modal() || tutBalloonOn() || sayUntil || confirmOpen()) return;
      if (pendFreeJam && s.phase === 'run') { if (sayShown(STR.freeJamFirst, 4000)) pendFreeJam = false; return; }
      // o primeiro dia em que um jam conta: na corrida, quando passa a valer (o plano da manha ja tem as suas dicas)
      if (s.phase === 'run' && G > 0 && d === G + 1 && !seen('strikes6')) { if (sayShown(STR.strikesFrom(strikeMax()), 4200)) markSeen('strikes6'); return; }
      if (s.phase !== 'plan' || roll.open || growPend || bootFrames >= 0) return;
      if (d > 1 && CH_LEN < CFG.maxDays && (d - 1) % CH_LEN === 0 && !seen('chapter' + d) && !chCardOpen()) {
        if (sayShown(STR.strikesBack(CFG.ironMode ? 1 : CFG.maxStrikes | 0), 3600)) markSeen('chapter' + d);
      }
    }
    // v2: manutencao do semaforo de manha (game.state.upkeep): uma faixa por dia; a primeira vez diz a regra antes
    var upkeepSaid = -1, shiftPend = null, placesPend = null;
    // w_place: cada lugar novo pulsa 3 vezes e uma faixa diz o que ele e (mesmo gesto das pontas novas da cidade)
    function placesTick(s) {
      if (!placesPend || s.phase !== 'plan') return;
      if (placesPend.day !== s.day) { placesPend = null; return; }
      if (roll.open || growPend || bootFrames >= 0 || modal() || tutBalloonOn() || sayUntil || confirmOpen() || chCardOpen() || sayEl.classList.contains('show')) return;
      var w = game.world, ns = [], i;
      for (i = 0; i < placesPend.ids.length; i++) { var n = w.nodes[placesPend.ids[i]]; if (n && n.portal) ns.push(n); }
      placesPend = null;
      if (!ns.length || !sayShown(STR.placesNew(ns.length), 4200)) return;
      ns.forEach(function (n) { addPulse(n.x, n.y); later(function () { addPulse(n.x, n.y); }, 700); later(function () { addPulse(n.x, n.y); }, 1400); });
      try { if (render && render.reveal) render.reveal(ns[0].x, ns[0].y, true); } catch (e) {}
    }
    // v2: cidade no teto muda por dentro: a ponta que ficou cheia pulsa com uma linha (o que nao se ve nao existe)
    function shiftTick(s) {
      if (!shiftPend || s.phase !== 'plan') return;
      if (shiftPend.day !== s.day) { shiftPend = null; return; }
      if (roll.open || growPend || bootFrames >= 0 || modal() || tutBalloonOn() || sayUntil || confirmOpen()) return;
      var n = game.world.nodes[shiftPend.up];
      if (!n) { shiftPend = null; return; }
      if (!sayShown(STR.shiftUp, 3600)) return;
      addPulse(n.x, n.y); later(function () { addPulse(n.x, n.y); }, 900);
      try { if (render && render.reveal) render.reveal(n.x, n.y, true); } catch (e) {}
      shiftPend = null;
    }
    // v2: o nome da forma da cidade, uma vez, no primeiro plano (cartao do dia 1: a faixa de aviso que ja existe)
    var archSaid = false;
    function archTick(s) {
      var a = s.archetype, line = a && STR.archLine[a];
      if (archSaid || !line || s.phase !== 'plan') return;
      if (roll.open || growPend || bootFrames >= 0 || modal() || tutBalloonOn() || sayUntil || confirmOpen()) return;
      if ((s.day | 0) > 2) { archSaid = true; return; }
      if (sayShown(line, 5000)) archSaid = true;
    }
    function upkeepTick(s) {
      var U = s.upkeep && s.upkeep.day === s.day && s.upkeep.owed > 0 ? s.upkeep : null;
      var cInc = s.crew && s.crew.day === s.day ? s.crew.income | 0 : 0;
      if (s.phase !== 'plan' || upkeepSaid === s.day || (!U && !cInc)) return;
      if (roll.open || growPend || bootFrames >= 0 || modal() || tutBalloonOn() || sayUntil || confirmOpen() || crewOpen()) return;
      var per = (CFG.upkeep && CFG.upkeep.perLight) || 1, first = gOn() && !!U && !seen('upkeep');
      var dark = U && U.dark ? U.dark.length : 0;
      var txt = (first ? STR.upkeepFirst(per, (s.day | 0) !== ((CFG.upkeep && CFG.upkeep.fromDay) | 0)) + ' ' : '') + (U ? STR.upkeepLine(U.paid | 0, dark) : '') + (cInc ? (U ? ' ' : '') + STR.crewLine(cInc) : '');
      U = U || { dark: [] };
      if (!sayShown(txt, first ? 7000 : 3600)) return;
      upkeepSaid = s.day;
      if (first) markSeen('upkeep');
      var w = game.world, i; for (i = 0; dark && i < U.dark.length; i++) { var dn = w.nodes[U.dark[i]]; if (dn) addPulse(dn.x, dn.y); }
    }
    // v2: oferta da Road crew de manha (state.crew.offer): folha com Hire e Not now (o componente da confirmacao do Play)
    var crewEl = tut(el('div', 'crz-confirm crz-crew gone'), 'crew-offer'), crewAskDay = -1;
    crewEl.setAttribute('role', 'dialog'); crewEl.setAttribute('aria-modal', 'true');
    var crewBox = el('div', 'crz-cbox'), crewTxt = el('div', 'crz-ctxt'), crewRow = el('div', 'crz-crow');
    crewTxt.id = 'crz-crew-txt'; crewEl.setAttribute('aria-labelledby', 'crz-crew-txt');
    var crewNo = tut(el('button', 'crz-cback'), 'crew-no'), crewYes = tut(el('button', 'crz-cstart'), 'crew-hire');
    crewNo.textContent = STR.crewNo; crewYes.textContent = STR.crewHire;
    crewRow.appendChild(crewNo); crewRow.appendChild(crewYes);
    crewBox.appendChild(crewTxt); crewBox.appendChild(crewRow); crewEl.appendChild(crewBox);
    ui.appendChild(crewEl);
    function crewOpen() { return !crewEl.classList.contains('gone'); }
    // integracao (fuzz): a folha e uma camada dona de body.crz-modal, como a tela do dado; o balao do tutorial espera
    // (antes o holofote do tutorial abria por cima e o 'Hire'/'Not now' nao recebia o toque)
    function crewClose() { crewEl.classList.add('gone'); modalReg().set(doc.body, 'crew', false); }
    // w_bugs13: a folha que abre sozinha nao aceita toque logo ao abrir (CFG.sheetGuardMs) nem um toque que comecou antes dela
    // (o pointerdown cru, o mesmo do dado): o dedo que ia para o mapa ou para a bandeja nunca vira Hire
    var crewShownAt = -1e9;
    on(crewEl, 'pointerdown', recDown, true);
    function crewTooSoon(btn) {
      if (nowMs() - crewShownAt < (CFG.sheetGuardMs | 0)) return true;
      return rawDown.t > -1e8 && rawDown.t < crewShownAt && nowMs() - rawDown.t < 1500 || strayTap(btn);
    }
    on(crewNo, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (crewTooSoon(crewNo)) { emitUI('crewGuard', {}); return; }
      crewClose(); snd('select');
      var was = !!(game.state.crew && game.state.crew.offer);
      if (game.declineCrew) game.declineCrew();
      // w_crew: diz quando a oferta pode voltar (a regra rara), sem prometer o que nao vem
      var ci = was && game.crewInfo ? game.crewInfo() : null;
      if (ci) { sayUntil = 0; say(ci.next ? STR.crewLater(ci.next) : STR.crewLast, 3500); }
      emitUI('crew', { hire: false });
    });
    on(crewYes, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (crewTooSoon(crewYes)) { emitUI('crewGuard', {}); return; }
      crewClose();
      var r = game.hireCrew ? game.hireCrew() : null;
      if (r && r.ok) { snd('place'); sayUntil = 0; say(STR.crewHired(Math.max.apply(null, game.state.crew.active.concat([1]))), 4000); }
      else { snd('deny'); say(r && r.reason === 'budget' ? STR.deny.crewShort(CFG.crew.cost, game.state.budget | 0) : r && r.reason === 'phase' ? STR.deny.phase : STR.deny.crewOther); }
      emitUI('crew', { hire: !!(r && r.ok) });
    });
    function crewTick(s) {
      var C = CFG.crew;
      if (crewOpen() && (s.phase !== 'plan' || !s.crew || !s.crew.offer)) { crewClose(); return; }
      if (!C || s.phase !== 'plan' || !s.crew || !s.crew.offer || crewAskDay === s.day) return;
      if ((s.budget | 0) < C.cost) return;   // sem pontos para pagar: a oferta nao aparece (nada a decidir)
      if (roll.open || growPend || bootFrames >= 0 || modal() || tutBalloonOn() || sayUntil || confirmOpen() || mapBusy()) return;
      crewAskDay = s.day;
      var first = gOn() && !seen('crew'); if (first) markSeen('crew');
      var ci = game.crewInfo ? game.crewInfo() : null;
      crewTxt.textContent = (first ? STR.crewFirst + ' ' : '') + STR.crewOffer(C.cost, C.perDay, ci ? ci.days : C.days);
      crewShownAt = nowMs();
      crewEl.classList.remove('gone'); modalReg().set(doc.body, 'crew', true); snd('select');
      emitUI('crewOffer', {});
    }
    // ---- w_choice: o cartao da escolha do sinal ----
    // Toque num anel (sem ferramenta na mao, de manha): em vez de uma frase, uma linha por peca que o cruzamento aceita
    // (na ordem da bandeja) com o que o 'e se' mediu: antes -> depois da espera mais longa e, se a repeticao mostra,
    // UMA consequencia. Cada numero vem de game.choiceFor; nada aqui e conta. Abre so no toque da jogadora e segura
    // body.crz-modal enquanto aberto (nada mais abre por cima: o dado, a Road crew, o balao do tutorial esperam).
    // Colocar usa placeNodeTool, o mesmo codigo do toque com a peca da bandeja (custo, recusa, troca, mao, teto, Undo).
    var scEvText = '';   // w_bugs12: the event line of a marker on the crossing whose card just opened (goes on the grey line)
    var scPick = null, scArm = null;   // w_place: a peca da bandeja que abriu o cartao (linha marcada) e a ferramenta na mao
    var scFrom = null;   // w_noopt2: { node, tool }: o cartao do vizinho aberto pela linha 'Fix the crossing that feeds it'; a peca prometida e a linha marcada
    var scEl = tut(el('div', 'crz-confirm crz-choice gone'), 'choice-card'), scId = null, scSig = '', scHlEdge = null, cardPick = null, choiceAsk = null, scHelpPick = false, scAt = -1e9, SC_GHOST_MS = 450;
    scEl.setAttribute('role', 'dialog'); scEl.setAttribute('aria-modal', 'true');
    var scBox = el('div', 'crz-cbox'); scBox.setAttribute('data-scroll', '');
    var scTitle = el('div', 'crz-ctxt crz-sctitle'), scHelp = el('div', 'crz-schelp gone'), scShape = el('div', 'crz-scshape gone'), scRows = el('div', 'crz-scrows'), scMsg = el('div', 'crz-scmsg gone'), scPts = el('div', 'crz-scpts');
    scTitle.id = 'crz-choice-title'; scEl.setAttribute('aria-labelledby', 'crz-choice-title');
    var scLeave = tut(el('button', 'crz-scleave'), 'choice-leave');
    scLeave.setAttribute('aria-label', STR.choice.leaveAria);
    scBox.appendChild(scTitle); scBox.appendChild(scShape); scBox.appendChild(scHelp); scBox.appendChild(scRows); scBox.appendChild(scMsg); scBox.appendChild(scLeave); scBox.appendChild(scPts);
    scEl.appendChild(scBox); ui.appendChild(scEl);
    function choiceOpen() { return !scEl.classList.contains('gone'); }
    // w_bugs13: o mapa nao anda sozinho enquanto uma colocacao esta em andamento (peca na mao ou cartao aberto; dias 1 a 6 ficam como eram)
    if (render && typeof render.placing === 'function') render.placing(function () {
      var s = game.state; return !!s && s.phase === 'plan' && (s.day | 0) > 6 && (!!sel || choiceOpen());
    });
    function choiceData(id) {
      if (typeof game.choiceFor !== 'function') return null;
      var c = null;
      try { c = game.choiceFor(id); if (!c && wiPending(id)) c = game.choiceFor(id, true); } catch (e) { warnOnce('game.choiceFor', e); }
      return c;
    }
    function choiceClose() {
      if (!choiceOpen()) return;
      scEl.classList.add('gone'); modalReg().set(doc.body, 'choice', false); choiceClosedAt = nowMs();
      if (scHlEdge !== null && render && typeof render.highlightRoad === 'function') { try { render.highlightRoad(scHlEdge, 1); } catch (e) {} }
      scHlEdge = null; scId = null; scSig = ''; scFrom = null; scPick = null; scArm = null; scEvText = '';
    }
    // a linha de uma peca: icone, nome, preco, barra e numero, quem paga, consequencia. Barra: o traco e a espera de ontem; o
    // preenchimento escuro vai ate o menor numero da faixa e o trecho claro ate o maior (w_choice2); vermelho quando piora. O
    // preco fica cinza quando faltam pontos. lost: pontos que a troca faz perder (Roundabout trocada), dito na linha antes do toque
    function choiceRow(r, c, M, lost) {
      var C = STR.choice, name = STR.tools[r.tool] || r.tool, price = r.cost > 0 ? C.pts(r.cost) : C.free;
      // light cap reached: this row moves a light you already have (the tap asks which one), so it is free and never buys
      var moves = r.tool === 'light' && r.capped && !r.hand; if (moves) price = C.moveHere;
      var vd = r.verdict || r.res || 'same', mk = !!scFrom && scFrom.node === c.id && scFrom.tool === r.tool, nd = mk && vd === 'worse';
      var b = el('button', 'crz-scrow' + (!nd && vd === 'worse' ? ' bad' : (vd === 'better' ? ' good' : '')) + (r.afford || moves ? '' : ' poor') + (r.capped ? ' capped' : ''), '');
      b.setAttribute('data-tool', r.tool);
      var ico = el('span', 'crz-scico', toolIcon(r.tool)), body = el('span', 'crz-scbody'), top = el('span', 'crz-sctop');
      var nm = el('span', 'crz-scname'); nm.textContent = name;
      // w_place + w_noopt2: uma marca por linha; 'Next door' (o vizinho prometido) vence 'Your pick' (o cartao do vizinho nao abre pela bandeja)
      var tagTxt = mk ? C.nextDoor.tag : (scPick === r.tool ? C.tag.pick : (!c.pending && r.tag && C.tag[r.tag] ? C.tag[r.tag] : ''));
      if (tagTxt) { var tg = el('i', 'crz-ctag'); tg.textContent = tagTxt; nm.appendChild(tg); }
      var pr = el('span', 'crz-scprice'); pr.textContent = price;
      top.appendChild(nm); top.appendChild(pr); body.appendChild(top);
      var nums = c.pending ? C.pending : (r.w === null || nd ? C.none : C.verdict[vd]);
      var mid = el('span', 'crz-scmid'), bar = el('span', 'crz-scbar'), num = el('span', 'crz-scnum');
      if (!c.pending && r.w !== null) {
        // a barra: a espera de ontem e a barra inteira; o trecho cheio e o que a peca deve deixar, com a ponta suave (aproximado)
        var fill = el('i'), mark = el('u');
        fill.style.width = Math.max(4, Math.min(100, Math.round(100 * r.w / M))) + '%'; mark.style.left = Math.min(100, Math.round(100 * c.before / M)) + '%';
        bar.appendChild(fill); bar.appendChild(mark);
      }
      num.textContent = nums; mid.appendChild(bar); mid.appendChild(num); body.appendChild(mid);
      var noteTxt = '', payTxt = '', lostTxt = '', ndTxt = '';
      if (mk) { ndTxt = C.nextDoor.note; var nn = el('span', 'crz-scnote'); nn.textContent = ndTxt; body.appendChild(nn); }
      if (!c.pending && vd === 'better' && r.payer && C.payer[r.payer]) { payTxt = C.payer[r.payer]; var py = el('span', 'crz-scnote crz-scpay'); py.textContent = payTxt; body.appendChild(py); }
      // w_pick: com quem paga na linha, a consequencia de lado (side/main) diria o mesmo: sai
      if (r.note && !nd && !(payTxt && (r.note === 'side' || r.note === 'main')) && !(r.note === 'busy' && r.qual)) noteTxt = typeof C.note[r.note] === 'function' ? C.note[r.note](r.nv) : C.note[r.note];
      var qualTxt = !c.pending && vd === 'better' && r.qual && C.qualNote[r.qual] ? C.qualNote[r.qual] : '';
      if (qualTxt) { var qn = el('span', 'crz-scnote'); qn.textContent = qualTxt; body.appendChild(qn); }
      if (noteTxt) { var nt = el('span', 'crz-scnote'); nt.textContent = noteTxt; body.appendChild(nt); }
      if (lost > 0) { lostTxt = C.replaces(lost, String(STR.tools[c.have] || c.have).toLowerCase()); var ls = el('span', 'crz-scnote crz-sclost'); ls.textContent = lostTxt; body.appendChild(ls); }
      b.appendChild(ico); b.appendChild(body);
      b.setAttribute('aria-label', C.aria(name + (tagTxt ? ' (' + tagTxt + ')' : ''), price, nums, [ndTxt, payTxt, qualTxt, noteTxt, lostTxt].filter(Boolean).join('. ')));
      b.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); if (nowMs() - scAt < SC_GHOST_MS) return; choicePick(r.tool, r.edge); });
      return b;
    }
    // w_noopt: uma linha a mais (game.choiceFor extra: so as 'better'), no mesmo estilo das linhas das pecas, depois delas
    function choiceExtraRow(x, c, M) {
      var C = STR.choice, name = C.extra[x.kind] || x.kind, price = x.cost > 0 ? C.pts(x.cost) : C.free;
      var b = el('button', 'crz-scrow good' + (x.afford ? '' : ' poor'), '');
      b.setAttribute('data-tool', x.tool); b.setAttribute('data-kind', x.kind);
      var ico = el('span', 'crz-scico', toolIcon(x.tool)), body = el('span', 'crz-scbody'), top = el('span', 'crz-sctop');
      var nm = el('span', 'crz-scname'); nm.textContent = name;
      var pr = el('span', 'crz-scprice'); pr.textContent = price;
      top.appendChild(nm); top.appendChild(pr); body.appendChild(top);
      var mid = el('span', 'crz-scmid'), bar = el('span', 'crz-scbar'), num = el('span', 'crz-scnum'), fill = el('i'), mark = el('u');
      fill.style.width = Math.max(4, Math.min(100, Math.round(100 * x.w / M))) + '%'; mark.style.left = Math.min(100, Math.round(100 * c.before / M)) + '%';
      bar.appendChild(fill); bar.appendChild(mark); num.textContent = C.verdict.better; mid.appendChild(bar); mid.appendChild(num); body.appendChild(mid);
      var nt = C.extraNote[x.kind], noteTxt = typeof nt === 'function' ? nt(x.kind === 'road' ? x.cross | 0 : (STR.fbk.tool[x.tool] || STR.tools[x.tool] || x.tool), x.cross | 0) : (nt || '');
      if (noteTxt) { var ns = el('span', 'crz-scnote'); ns.textContent = noteTxt; body.appendChild(ns); }
      b.appendChild(ico); b.appendChild(body);
      b.setAttribute('aria-label', C.aria(name, price, C.verdict.better, noteTxt));
      b.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); if (nowMs() - scAt < SC_GHOST_MS) return; choiceExtra(x); });
      return b;
    }
    function paintChoice(c) {
      var C = STR.choice, M = Math.max(1, c.before || 0), i;
      for (i = 0; i < c.rows.length; i++) { var rw = c.rows[i]; if (rw.w !== null && rw.w > M) M = rw.w; }
      if (c.leave && c.leave.w !== null && c.leave.w > M) M = c.leave.w;
      var ex = !c.pending && c.extra ? c.extra : [];
      for (i = 0; i < ex.length; i++) if (ex[i].w > M) M = ex[i].w;
      var lit = c.loud !== null && c.loud !== undefined && render && typeof render.highlightRoad === 'function';
      scShape.textContent = !c.pending && c.shape ? C.shape(c.shape) : '';
      // w_noopt: o 'e se' dos ramos a mais acabou e nada serve: a linha cinza diz (Boost so quando a jogadora o tem)
      // w_place: o cartao agora abre tambem sem anel (cruzamento calmo): ali 'Too many cars' seria falso; a linha so vale com anel
      var scN = game.world.nodes ? game.world.nodes[c.id] : null;
      if (c.dead && c.relief === 'done' && !ex.length && scN && heatOf(game.state, scN) >= HOT_TAP) { var bu = game.state.clear && game.state.clear.unlocked; scShape.textContent = (scShape.textContent ? scShape.textContent + ' ' : '') + (bu ? C.noOption : C.noOptionNoBoost); }
      if (c.noData) scShape.textContent = c.tip || '';   // w_noopt: sem 'e se' possivel, a dica de uma linha vai na linha cinza do cartao
      if (scEvText) scShape.textContent = (scShape.textContent ? scShape.textContent + ' ' : '') + scEvText;
      scShape.classList.toggle('gone', !scShape.textContent);
      scTitle.textContent = c.noData ? C.noData : c.pending ? C.titleWait : (lit ? C.titleRoad : C.title)(Math.max(1, Math.round(c.yesterday !== undefined ? c.yesterday : c.before)));   // w_texts: the real wait of yesterday
      if (lit && scHlEdge !== c.loud) { try { if (render.highlightRoad(c.loud, 60000)) scHlEdge = c.loud; } catch (e) { warnOnce('render.highlightRoad', e); } }
      // a Roundabout trocada perde os pontos dela (a de hoje e reembolsada): o preco aparece na linha de cada troca, antes do toque
      var lostPts = c.have === 'round' && !paidToday(c.id) ? paidFor(c.id, 'round') : 0;
      scRows.innerHTML = '';
      for (i = 0; i < c.rows.length; i++) scRows.appendChild(choiceRow(c.rows[i], c, M, c.rows[i].tool === 'upgrade' ? 0 : lostPts));
      for (i = 0; i < ex.length; i++) scRows.appendChild(choiceExtraRow(ex[i], c, M));
      // w_review: a peca da mao sem linha no cartao (Lanes na mao e a rua mais cheia ja com 2 faixas): a ajuda da marca sai (nada esta marcado)
      if (scPick && scHelp.textContent === STR.choice.pickHelp) scHelp.classList.toggle('gone', !c.pending && !c.rows.some(function (r) { return r.tool === scPick; }));
      var lv = c.leave, ln;
      scLeave.innerHTML = '';
      var lt = el('span', 'crz-scname'); lt.textContent = C.leave; scLeave.appendChild(lt);
      if (!c.pending && lv && lv.w !== null) { ln = el('span', 'crz-scnum'); ln.textContent = C.one(Math.round(c.yesterday !== undefined ? c.yesterday : lv.before)); scLeave.appendChild(ln); }   // w_choice3: Leave it fica com o numero de ontem
      scPts.textContent = C.points(game.state.budget | 0);
      // w_bugs13: the marked row says 'worse': the help line says it plainly (the rows fill in after the card opens, so it is set here)
      if (scHelpPick && scPick && !c.pending) {
        var pw = false, hasPick = false; for (i = 0; i < c.rows.length; i++) if (c.rows[i].tool === scPick) { hasPick = true; if ((c.rows[i].verdict || c.rows[i].res || 'same') === 'worse') pw = true; }
        if (hasPick) {   // no marked row in the card (the piece has no row here): the help line stays what openChoice set
        var hb = scHelp.textContent, tail = hb.indexOf(STR.choice.pickHelp) === 0 ? hb.slice(STR.choice.pickHelp.length) : hb.indexOf(STR.choice.pickWorse) === 0 ? hb.slice(STR.choice.pickWorse.length) : '';
        scHelp.textContent = (pw ? STR.choice.pickWorse : STR.choice.pickHelp) + tail; scHelp.classList.remove('gone');
        }
      }
    }
    function openChoice(s, n, opt) {
      if (s.phase !== 'plan' || modal() || choiceOpen() || degOf(n) < 3) return false;   // w_noopt: o portal que virou cruzamento (cego 10, dia 24) tambem
      var c = choiceData(n.id);
      if (c && c.pending) wiFront(n.id);
      // w_choice2: anel sem 'e se' guardado: o toque comeca o trabalho (as linhas vem com '...' e se enchem); sem a manha de
      // ontem na memoria (reload), nao ha o que medir e vale a frase de sempre
      if (!c && wiAdd(n.id)) c = choiceData(n.id);
      // w_noopt (cego 10, dia 24: tres toques num anel so deram a dica de uma linha): sem 'e se' possivel o cartao abre assim mesmo, com
      // as pecas e o preco, e a dica vai na linha cinza
      if (!c || !c.rows.length) c = scNoData = choiceNoData(s, n); else scNoData = null;
      if (!c) return false;
      if (c.dead && c.relief === 'pending') reliefAdd(n.id);
      scId = n.id; scSig = ''; scAt = nowMs(); scMsg.classList.add('gone'); scMsg.textContent = '';
      var first = gOn() && !seen('choiceHelp');
      scPick = opt && opt.pick ? opt.pick : null; scArm = sel || null; scHelpPick = !!scPick && !(opt && opt.keep);
      // w_place: aberto pela peca da bandeja, a linha que diz o que fazer vale sempre (mesmo com Guidance off): o toque nao pos nada
      if (opt && opt.keep) { scHelp.textContent = STR.choice.keepHelp(String(STR.tools[opt.keep] || opt.keep).toLowerCase()); scHelp.classList.remove('gone'); }
      else if (scPick) { scHelp.textContent = STR.choice.pickHelp; scHelp.classList.remove('gone'); }
      else { scHelp.textContent = STR.choice.help; scHelp.classList.toggle('gone', !first); if (first) markSeen('choiceHelp'); }
      paintChoice(c);
      // w_place: um Pare em cruzamento de 3+ ruas, do dia em que ele engasga (CFG.junction.stop.late): o cartao diz o motivo
      var SLc = CFG.junction && CFG.junction.stop && CFG.junction.stop.late;
      if (c.have === 'stop' && SLc && SLc.multiApproachPenalty > 0 && (s.day | 0) >= SLc.fromDay && !(opt && opt.keep)) { scHelp.textContent = scPick ? scHelp.textContent + ' ' + STR.chStopLate(SLc.fromDay) : STR.chStopLate(SLc.fromDay); scHelp.classList.remove('gone'); } scSig = JSON.stringify(c) + '|' + (s.budget | 0);
      scEl.classList.remove('gone'); modalReg().set(doc.body, 'choice', true);
      try { if (scLeave.focus) scLeave.focus(); } catch (e) {}
      emitUI('choiceOpen', { id: n.id, rows: c.rows.length, pending: !!c.pending });
      later(function () { choiceReveal(n); }, 40);
      return true;
    }
    // o cruzamento tocado nao fica embaixo do cartao: se a folha o cobre (ou chega perto), a camera o leva para a faixa livre
    // acima dela (o mesmo pedido de camera da lupa; as margens do HUD sobem so durante o pedido)
    function choiceReveal(n) {
      if (!choiceOpen() || !render || !render.toScreen || !render.focus || !render.margins || !scBox.getBoundingClientRect) return;
      try {
        var r = scBox.getBoundingClientRect(), H = render.height || root.innerHeight || 0, p = render.toScreen(n.x, n.y), m = render.margins;
        if (!r || !H || p.y < r.top - 56) return;
        var keep = m.bottom || 0;
        m.bottom = Math.max(keep, Math.round(H - r.top + 8));
        camFreeze = false;
        try { camFree(function () { camByUser(function () { render.focus(n.x, n.y, undefined, !reducedMotion()); }); }); } finally { m.bottom = keep; }
      } catch (e) { warnOnce('choiceReveal', e); }
    }
    // o numero prometido vai com a peca quando ela entra (inclusive na segunda toque de uma troca para baixo)
    function keepCardPromise(n, tool) {
      var cp = cardPick; if (!cp || cp.id !== n.id || cp.tool !== tool || nowMs() > cp.until) return;
      cardPick = null;
      if (typeof game.keepPromise === 'function') { try { game.keepPromise(n.id, cp.rec); } catch (e) { warnOnce('game.keepPromise', e); } }
    }
    // w_choice2: a linha Two lanes do cartao: o mesmo gesto da bandeja (game.upgradeRoad na rua mais cheia que chega aqui)
    function choiceLane(n, edgeId, rec) {
      var arm = scArm, s = game.state, E = game.world.edges && game.world.edges[edgeId];
      if (!E || s.phase !== 'plan') { choiceClose(); return; }
      var a = game.world.nodes[E.a], b = game.world.nodes[E.b], px = a && b ? (a.x + b.x) / 2 : n.x, py = a && b ? (a.y + b.y) / 2 : n.y;
      sayUntil = 0; sayEl.textContent = '';
      var ur = game.upgradeRoad(edgeId);
      toolResult(ur, px, py, 'build', 'upgrade');
      emitUI('choicePick', { id: n.id, tool: 'upgrade', ok: !!(ur && ur.ok) });
      if (ur && ur.ok) {
        fbkPlaced(ur, ur.watchId != null && game.world.nodes ? game.world.nodes[ur.watchId] : null, false);
        if (rec && typeof game.keepPromise === 'function') { try { game.keepPromise(n.id, rec); } catch (e) { warnOnce('game.keepPromise', e); } }
        if (ur.fromHand) say(STR.upgradeMoved, 2600); else say(STR.choice.placed(STR.tools.upgrade), 4500);
        choiceClose(); setSel(arm, true);
        return;
      }
      scMsg.textContent = sayEl.textContent || ''; scMsg.classList.toggle('gone', !scMsg.textContent);
    }
    // w_noopt: o cartao sem numeros (sem a manha de ontem para jogar de novo, ou o 'e se' quebrou): as linhas das pecas sem veredito
    // (tocar uma poe a peca, como sempre) e a dica de uma linha na linha cinza. null so fora de um cruzamento
    function choiceNoData(s, n) {
      var c = null;
      try { c = typeof game.choiceFor === 'function' ? game.choiceFor(n.id, true) : null; } catch (e) { warnOnce('game.choiceFor', e); }
      if (!c || !c.rows.length) return null;
      c.pending = false; c.noData = true; c.tip = tapAdvice(s, n);
      return c;
    }
    // w_noopt: as linhas a mais. road: a Rua fica na mao e a rua sugerida aparece como o fantasma do arrasto; um toque nela constroi (a
    // jogadora confirma), um arrasto desenha outra. feed: fecha este cartao e abre o do vizinho, centrado nele
    var roadSug = null, scNoData = null;
    function choiceExtra(x) {
      var s = game.state, n = scId !== null && game.world.nodes ? game.world.nodes[scId] : null;
      if (!n || s.phase !== 'plan') { choiceClose(); return; }
      emitUI('choiceExtra', { id: n.id, kind: x.kind });
      if (x.kind === 'road') {
        var a = game.world.nodes[x.from], b = game.world.nodes[x.to];
        choiceClose();
        if (!a || !b) return;
        setSel('road', true);
        roadSug = { from: x.from, to: x.to, id: n.id, day: s.day | 0, w0: Math.round(x.before), w1: Math.round(x.w) };
        ghost = { fromId: x.from, x: b.x, y: b.y, ok: true, why: '', reason: '', nodeId: x.to, edgeId: null, cross: null, capped: false, reach: null, deadEnd: false, tip: '' };
        var o = ov(); if (o) { o.ghostRoad = ghost; o.finger = null; }
        sayUntil = 0; say(STR.choice.roadSug, 6000);
        // w_bugs15: the camera frames the WHOLE suggested road (both ends in the free area, zoomed in when the city is small on screen) and
        // both ends pulse: zoomed out the dashed line was nearly invisible. The camera is done before the confirming tap can land
        if (render && render.focus && render.toScreen) {
          try {
            var u = render.usable ? render.usable() : null, z0 = (render.camera && render.camera.zoom) || 1, zt = z0;
            if (u) {
              var ex = Math.max(1, Math.abs(a.x - b.x)), ey = Math.max(1, Math.abs(a.y - b.y)), fz = CFG.roadSugFrame || { fill: 0.7, maxGrow: 1.8 };
              zt = Math.min(u.w * fz.fill / ex, u.h * fz.fill / ey, z0 * fz.maxGrow);
            }
            camFree(function () { camByUser(function () { render.focus((a.x + b.x) / 2, (a.y + b.y) / 2, zt, !reducedMotion()); }); });
          } catch (e) { warnOnce('render.focus', e); }
        }
        addPulse(a.x, a.y); addPulse(b.x, b.y);
        later(function () { if (roadSug) { addPulse(a.x, a.y); addPulse(b.x, b.y); } }, 700);
        return;
      }
      if (x.kind === 'feed') {
        var nb = game.world.nodes[x.node];
        choiceClose();
        if (!nb) return;
        if (render && render.focus) { try { camFree(function () { camByUser(function () { render.focus(nb.x, nb.y, undefined, !reducedMotion()); }); }); } catch (e) { warnOnce('render.focus', e); } }
        scFrom = { node: nb.id, tool: x.tool, from: n.id, w0: Math.round(x.before), w1: Math.round(x.w) };
        if (!openChoice(s, nb)) scFrom = null;
      }
    }
    function onFree(nd) {
      var p = render.toScreen(nd.x, nd.y), m = render.margins || {}, W = render.width || 0, H = render.height || 0;
      return !!(W && H && p.x > (m.left || 0) + 16 && p.x < W - (m.right || 0) - 16 && p.y > (m.top || 0) + 16 && p.y < H - (m.bottom || 0) - 16);
    }
    // a rua sugerida: o toque nela (ou numa das pontas) constroi; outro toque, outra ferramenta ou o fim do plano a tiram
    function roadSugClear() {
      if (!roadSug) return;
      roadSug = null;
      if (roadFrom === null) { ghost = null; var o = ov(); if (o) { o.ghostRoad = null; o.finger = null; } }
    }
    function roadSugTap(sx, sy) {
      var R = roadSug, w = game.world, a = R && w.nodes[R.from], b = R && w.nodes[R.to];
      roadSugClear();
      if (!a || !b || !render.toScreen) return false;
      var pa = render.toScreen(a.x, a.y), pb = render.toScreen(b.x, b.y), rr = (render.pickRadius ? render.pickRadius() : CFG.nodePickRadius) * 1.2;
      if (segDist(sx, sy, pa.x, pa.y, pb.x, pb.y) > rr) return false;
      sayUntil = 0; sayEl.textContent = '';
      var br = game.buildRoad(R.from, b.x, b.y);
      if (result(br, b.x, b.y, 'build', 'road')) {
        roadLetGo(false);   // w_bugs15
        emitUI('roadBuilt', { suggested: true });
        // w_noopt2: a promessa da linha 'Road around it' vai para o dia seguinte (a linha do resumo fala do cruzamento original)
        if (typeof game.keepPromise === 'function') { try { game.keepPromise(R.id, { day: R.day, tool: 'road', from: R.from, to: R.to, w0: R.w0, w1: R.w1, v: 'better' }); } catch (e) { warnOnce('game.keepPromise', e); } }
      }
      else say(roadSayText(br && (br.reason === 'budget' || br.reason === 'phase' ? br.reason : (br.why || br.reason))));
      return true;
    }
    function choicePick(tool, edgeId) {
      var s = game.state, n = scId !== null && game.world.nodes ? game.world.nodes[scId] : null;
      if (!n || s.phase !== 'plan') { choiceClose(); return; }
      var rec = null, had = n.tool || null, arm = scArm;
      try { rec = typeof game.promiseFor === 'function' ? game.promiseFor(n.id, tool) : null; } catch (e) { warnOnce('game.promiseFor', e); }
      if (tool === 'upgrade') { choiceLane(n, edgeId, rec); return; }
      cardPick = rec ? { id: n.id, tool: tool, rec: rec, until: nowMs() + 8000 } : null;
      sayUntil = 0; sayEl.textContent = '';
      setSel(tool, true);
      placeNodeTool(n, tool, s);
      emitUI('choicePick', { id: n.id, tool: tool, ok: n.tool === tool });
      if (n.tool === tool) {
        // peca no lugar: o cartao fecha, a faixa diz a promessa (a frase da troca, com os pontos que voltam, fica)
        // w_noopt2: a peca prometida pela linha 'Fix the crossing that feeds it': a promessa do cruzamento original vai para o dia seguinte
        if (scFrom && scFrom.node === n.id && scFrom.tool === tool && typeof game.keepPromise === 'function') { try { game.keepPromise(scFrom.from, { day: s.day | 0, tool: 'feed', node: n.id, piece: tool, w0: scFrom.w0, w1: scFrom.w1, v: 'better' }); } catch (e) { warnOnce('game.keepPromise', e); } }
        choiceClose(); setSel(arm, true);   // w_place: a peca que estava na mao segue na mao
        // (o Yield da bandeja diz a dica do cruzamento cheio; pelo cartao a faixa e a promessa)
        if (!had && (sayEl.textContent === STR.placed(STR.tools[tool] || tool) || (tool === 'yield' && (!sayEl.textContent || /^Busy crossing: /.test(sayEl.textContent))))) { sayUntil = 0; say(STR.choice.placed(STR.tools[tool] || tool), 4500); }
        return;
      }
      // pergunta pendente (segundo toque da troca para baixo, ou o semaforo que vem de outro lugar): o cartao sai da frente e a
      // peca fica na mao, como na bandeja
      if (swapAsk || (lightArm && nowMs() < lightArm.until)) { choiceClose(); return; }
      // recusa: o texto de sempre (a faixa) tambem dentro do cartao, que fica aberto para olhar as outras linhas
      setSel(arm, true);
      scMsg.textContent = sayEl.textContent || ''; scMsg.classList.toggle('gone', !scMsg.textContent);
    }
    on(scLeave, 'click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); if (nowMs() - scAt < SC_GHOST_MS) return; choiceClose(); snd('select'); emitUI('choiceLeave', { id: scId }); });
    // o toque que abriu o cartao ainda manda o 'click' para o que ficou embaixo do dedo: nos primeiros ms ele nao age
    on(scEl, 'click', function (e) { if (e && e.target === scEl && nowMs() - scAt >= SC_GHOST_MS) choiceClose(); });
    on(doc, 'keydown', function (e) { if (e && e.key === 'Escape' && choiceOpen()) choiceClose(); });
    // por quadro: fecha se o plano acabou; as linhas se refazem quando o 'e se' em fatias termina ou os pontos mudam
    function choiceTick(s) {
      if (roadSug && (s.phase !== 'plan' || sel !== 'road' || (s.day | 0) !== roadSug.day)) roadSugClear();
      // 'Tap to try another' (a linha do resumo que a jogadora tocou): o cartao do mesmo cruzamento abre quando a manha esta livre
      // (a mesma espera da oferta da Road crew), nunca antes das outras camadas e nunca sem aquele toque
      if (choiceAsk && !choiceOpen()) {
        if (s.phase === 'summary' && (s.day | 0) === choiceAsk.day) { /* ainda no resumo */ }
        else if (s.phase !== 'plan' || (s.day | 0) !== choiceAsk.day + 1) choiceAsk = null;
        else if (!(roll.open || growPend || bootFrames >= 0 || modal() || tutBalloonOn() || sayUntil || confirmOpen() || chCardOpen() || mapBusy())) {
          var an = game.world.nodes ? game.world.nodes[choiceAsk.id] : null; choiceAsk = null;
          if (an) openChoice(s, an);
        }
      }
      if (!choiceOpen()) return;
      var n = scId !== null && game.world.nodes ? game.world.nodes[scId] : null;
      if (s.phase !== 'plan' || !n) { choiceClose(); return; }
      var c = choiceData(scId); if (!c || !c.rows.length) c = scNoData && scNoData.id === scId ? scNoData : (scNoData = choiceNoData(s, n));
      if (!c) { choiceClose(); return; }
      if (c.dead && c.relief === 'pending' && !wiPending(scId)) reliefAdd(scId);
      var sig = JSON.stringify(c) + '|' + (s.budget | 0);
      if (sig !== scSig) { scSig = sig; paintChoice(c); }
    }
    function day4RuleTick(s) {
      if (seen('day4rule') || s.phase !== 'plan' || (s.day | 0) !== 4 || roll.open || growPend || bootFrames >= 0) return;
      if (modal() || tutBalloonOn() || sayUntil || confirmOpen()) return;
      if (!sayShown(STR.day4Rule, 5000)) return;
      markSeen('day4rule');
      var w = game.world, k; for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) { var n = w.nodes[k]; if (isJunction(n) && !n.tool) addPulse(n.x, n.y); }
    }
    function ringGroupTick(s) {
      if (!gOn() || seen('ringGroup') || (s.phase !== 'plan' && s.phase !== 'summary') || !render || typeof render.hotRings !== 'function' || sayUntil) return;
      var L = render.hotRings() || [], i;
      for (i = 0; i < L.length; i++) if (L[i].count >= 2) {
        if (tutBalloonOn() || modal() || confirmOpen() || roll.open) return;
        if (sayShown(STR.ringGroup(L[i].count), 3600)) markSeen('ringGroup');   // visto so depois de exibir
        addPulse(L[i].x, L[i].y); return;
      }
    }
    function ringEverTick(s) {
      if (ringEver || s.phase !== 'run' || (s.day | 0) < 1) return;
      var w = game.world, k; if (!w || !w.nodes) return;
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && w.nodes[k] && (w.nodes[k].stress || 0) >= RING_EVER_AT) { ringEver = true; return; }
    }
    // primeiro gasto da partida: diz o que aconteceu com os pontos (uma vez, guardado nas dicas vistas)
    var spendDay = -1, spendBudget = -1, spendDie = '';
    function firstSpendTick(s) {
      if (s.phase !== 'plan') { spendDay = -1; return; }
      // integracao v2b: o custo de uma face do dado usada (Quiet, Patient) e a manutencao paga por ela nao sao 'gasto':
      // a escolha do dado so atualiza a base (antes a faixa dizia 'You spent 2 build points' por cima do letreiro)
      var dk = String(s.dieState) + '|' + (s.kept ? s.kept.id : '');
      if (spendDay !== s.day || dk !== spendDie || roll.open) { spendDay = s.day; spendDie = dk; spendBudget = s.budget | 0; return; }
      var b = s.budget | 0;
      // com um balao do tutorial na tela o aviso espera (nunca dois baloes): fica para o proximo gasto
      var tu = CRZ.app && CRZ.app.tutorial, tutOn = tutBalloonOn() || tutorScript();
      // a frase da mao unica ('Tap the arrow to flip it.') fica: o aviso do primeiro gasto espera o proximo gasto
      if (sayUntil && /^One-way: /.test(sayEl.textContent)) tutOn = true;
      // w_place: o veredito da peca que entrou direto (ou 'New crossing') fica: o aviso espera o proximo gasto
      if (sayUntil && (/ placed: better here\. /.test(sayEl.textContent) || sayEl.textContent === STR.choice.newCross)) tutOn = true;
      if (b < spendBudget && gOn() && !seen('firstSpend') && !tutOn) { markSeen('firstSpend'); say(STR.firstSpend(spendBudget - b, lastDayOf(s))); }
      spendBudget = b;
    }
    var hintScan = { day: -1, phase: '', had: false };
    // B3: paineis que rolam no toque (o guia 'Tools & buttons' faltava)
    // fuzz 2 (2026-11-15): toda folha marcada rola (menu, tutorial, resumo, guia, dado, confirmacao, fim): uma regra so
    var SCROLL_OK = '[data-scroll]';
    var CHIP_LINGER = 2000, MIN_ROAD_PX = 20;
    var PAN_LOCK_DAYS = (CFG.panLockDays != null ? CFG.panLockDays : 3), panLockSaid = false;
    // w_guide: o bloqueio dos dias 1 a 3 (um dedo nao move o mapa) e ensino (protege quem aprende a arrastar); Off o tira
    function panLockN() { return gOn() ? PAN_LOCK_DAYS : 0; }
    // dias 1 e 2 (dias de tutorial) comecam a 1x; no dia 3 volta o padrao do CFG (4x), a menos que a jogadora
    // ja tenha escolhido a velocidade no botao (o equilibrio dos dias 3+ foi medido com o padrao)
    // dias 1 e 2 (dias de tutorial) SEMPRE comecam a 1x, mesmo se a jogadora trocou no dia 1. Do dia 3 em diante
    // vale a ultima escolha dela; sem escolha, o padrao do CFG (4x; o equilibrio dos dias 3+ foi medido assim)
    // A.7: a escolha da jogadora sobrevive ao reload (planMemo, por partida)
    var speedChosen = (function () { var v = planMemo.speed, L = (CFG.speedDial && CFG.speedDial.levels) || [], i; for (i = 0; i < L.length; i++) if (L[i].speed === v) return v; return 0; })(), TUT_SPEED_DAYS = 2, TUT_SPEED = 2, playPressedAt = -1e9, PLAY_GUARD = 1000;
    function startSpeed(s) {
      var d = s.day | 0, def = (CFG.speedDial && CFG.speedDial.defaultSpeed) || 1;
      // dono 2026-11-09: dias 1 e 2 a 2x (1x deixava o dia longo e passivo; 4x rapido demais)
      if (d >= 1 && d <= TUT_SPEED_DAYS) return TUT_SPEED;
      if (d === TUT_SPEED_DAYS + 1) return speedChosen || def;
      return s.speed || def;
    }
    function day3Notice(s) {
      if ((s.day | 0) !== TUT_SPEED_DAYS + 1 || seen('day3fast') || s.speed !== 4) return;
      sayUntil = 0; if (sayShown(STR.day3Fast, 4000)) markSeen('day3fast'); pulseEl(playBtn);
    }
    function tutorialSpeed(s) {
      if (!game.setSpeed) return;
      var d = s.day | 0, want = startSpeed(s);
      if (d < 1 || d > TUT_SPEED_DAYS + 1) return;
      try { if (s.speed !== want) game.setSpeed(want); } catch (e) { warnOnce('game.setSpeed', e); }
    }
    function maybeStartHint(s, now) {
      if (hint || s.phase !== 'plan') { hintScan.had = !!hint; return; }
      // nada muda entre quadros do mesmo plano: procura de novo so com dia/fase novos ou quando a dica acabou
      if (hintScan.day === s.day && hintScan.phase === s.phase && !hintScan.had) return;
      hintScan.day = s.day; hintScan.phase = s.phase; hintScan.had = false;
      var i, t;
      for (i = 0; i < s.tools.length; i++) {
        t = s.tools[i];
        // v2: a Roundabout chega pela carta do dia 19 (choiceDay), nao por dia: a apresentacao sai no primeiro plano liberada
        if (t.unlocked && CFG.tools[t.id] && (CFG.tools[t.id].unlockDay === s.day || (CFG.tools[t.id].choiceDay && s.day > CFG.tools[t.id].choiceDay)) && !seen('tool:' + t.id)) {
          markSeen('tool:' + t.id);
          // sem o roteiro (Skip): o nome da ferramenta e uma frase, numa faixa curta que nao bloqueia
          if (s.day > 1 && !tutorScript() && tutorSkipped()) firstUse('tool:' + t.id, toolIntro(t.id), now);
          hint = { toolId: t.id, stage: 'tile', tile: true, tileUntil: now + 2600, nextAt: 0, n: 0,
                   thenPlay: s.day === 1 && !seen('play') };
          return;
        }
      }
      if (s.day === 1 && !seen('play')) hint = { stage: 'play', thenPlay: true };
    }
    function toPlayStage() {
      if (!seen('play')) markSeen('play');
      hint.stage = 'play'; hint.tile = false;
    }
    function syncHint(s, now) {
      var tut = CRZ.app && CRZ.app.tutorial;
      var tutOn = !!(tut && tut.isActive && tut.isActive());
      if (tutOn || !gOn()) hint = null;   // o tutorial guiado assume (Guidance Off: sem pulsos de ensino)
      else if (!chCardOpen()) maybeStartHint(s, now);   // w_chap: a ferramenta nova espera o cartao do capitulo
      if (hint && s.phase !== 'plan') hint = null;
      if (hint && !tutOn) {
        if (hint.stage === 'tile' && (!hint.tile || now >= hint.tileUntil)) {
          hint.stage = 'map'; hint.tile = false; hint.nextAt = now;
        }
        if (hint.stage !== 'play' && hint.thenPlay && game.canUndo && game.canUndo()) toPlayStage();
        if (hint.stage === 'map') {
          if (hint.n < 3 && now >= hint.nextAt) {
            var tg = hintTarget(hint.toolId);
            if (tg) addPulse(tg.x, tg.y);
            hint.n++; hint.nextAt = now + 1800;
          } else if (hint.n >= 3 && now >= hint.nextAt) {
            if (hint.thenPlay) toPlayStage(); else hint = null;
          }
        }
        if (hint && hint.stage === 'play' && !seen('play')) markSeen('play');
      }
      // play: laco no plano do dia 1 (enquanto nenhuma ferramenta esta na mao); pulso curto no 1o run
      var want = '';
      // A4: aviso guardado ha mais de 4 s e descartado (fora de contexto)
      if (sayLater && !tutBalloonOn() && !sayUntil) { var sl = sayLater; sayLater = null; if (nowMs() - sl.at <= 4000 && (!sl.v || sl.v())) say(sl.t, sl.ms, sl.v); }
      if (sayUntil && sayValid && !sayValid()) { sayValid = null; sayUntil = 0; sayEl.classList.remove('show'); }
      runHintTick(s, now);
      boostLiveTick(s);
      ffTick(s, now);
      chCardTick(s);   // w_chap: o cartao do capitulo antes da tela do dado (a primeira coisa da manha)
      rollScreenTick(s, now);
      growTick(s);
      day4RuleTick(s);
      chapterTick(s);
      archTick(s);
      shiftTick(s);
      placesTick(s);
      upkeepTick(s);
      crewTick(s);
      choiceTick(s);
      dawnTick(s);
      invisTick(s, now);
      welcomeTick(s);
      // nv8 6: com aviso preto na tela o selo PAUSED (menu.js) desce para baixo dele
      var sOn = sayEl.classList.contains('show') && !!s.paused;
      if (doc.body && doc.body.classList && sOn !== doc.body.classList.contains('crz-say-on')) {
        if (sOn) { try { var sr = sayEl.getBoundingClientRect(); doc.documentElement.style.setProperty('--crz-sayb', Math.round(sr.bottom) + 'px'); } catch (e) {} }
        doc.body.classList.toggle('crz-say-on', sOn);
      }
      // polimento 1: com aviso na tela a faixa 'Day N' desce para baixo dele (antes os dois se cobriam)
      var sAny = sayEl.classList.contains('show') && !sayIn;
      // w_layout2: a frase trocada com o aviso ja na tela (outra altura) refaz a base (o Undo e a faixa 'Day N' descem junto)
      var sayTxtNow = sAny ? sayEl.textContent : '';
      if (doc.body && doc.body.classList && (sAny !== doc.body.classList.contains('crz-sayshow') || (sAny && sayTxtNow !== sayBTxt))) {
        sayBTxt = sayTxtNow;
        if (sAny) { try { var sr2 = sayEl.getBoundingClientRect(); doc.documentElement.style.setProperty('--crz-sayb', Math.round(sr2.bottom) + 'px'); } catch (e) {} }
        doc.body.classList.toggle('crz-sayshow', sAny);
      }
      // nv8 5: a legenda segue o custo (a rua gratis usada volta a custar): reescreve quando o texto muda
      if (sel && !legendEl.classList.contains('gone')) { if (!legendAfford(sel) || legendHeld()) syncLegend(); else { var lt = legendText(sel); if (legendEl.textContent !== lt) legendEl.textContent = lt; } }
      else if (sel && s.phase === 'plan' && legendAfford(sel) && !legendHeld()) syncLegend();
      firstSpendTick(s); ringEverTick(s); ringGroupTick(s); guideHintTick(s, now);
      if (s.phase === 'run' && !runAt) runAt = now; else if (s.phase !== 'run') runAt = 0;
      firstUseTick(s, now);
      var nextShow = nextStepTick(s, now);
      nextFirstOn = nextShow && !nextBuilt && nextEl.textContent === STR.nextFirst;
      // dia 1 sem estrada: o Play NAO pulsa (ele recusaria); quem pulsa e o ladrilho Road
      var noRoad1 = (s.day | 0) === 1 && s.phase === 'plan' && !day1Built();
      if (!noRoad1 && ((hint && hint.stage === 'play' && !sel && !nextFirstOn) || (nextShow && !nextFirstOn))) want = 'hint-loop';
      if (want !== playHintCls) {
        if (playHintCls) playBtn.classList.remove(playHintCls);
        if (want) playBtn.classList.add(want);
        playHintCls = want;
      }
    }
    // Dica do Boost no dia 1: em run, enquanto sobram cargas e ele nao foi usado, pulsa o portal da
    // esquerda e depois o da direita a cada ~4 s, no maximo 2 ciclos. Para no primeiro clearUsed.
    var bhint = { n: 0, nextAt: 0, armed: false };
    function boostHintTick(s, now) {
      if (s.phase !== 'run' || !gOn()) { bhint.armed = false; return; }
      if (s.day !== 1 || boostUsed || bhint.n >= 4) return;
      var cl = s.clear;
      if (!cl || !cl.unlocked || !(cl.charges > 0)) return;
      if (tutorScript()) return;
      if (!bhint.armed) { bhint.armed = true; bhint.nextAt = now + 1500; return; }
      if (now < bhint.nextAt) return;
      var w = game.world, q, left = null, right = null, nd;
      for (q in w.nodes) if (w.nodes.hasOwnProperty(q)) {
        nd = w.nodes[q];
        if (!nd.portal) continue;
        if (!left || nd.x < left.x) left = nd;
        if (!right || nd.x > right.x) right = nd;
      }
      var tg = bhint.n % 2 === 0 ? left : right;
      if (tg) addPulse(tg.x, tg.y);
      // a primeira vez que o dia roda (tambem depois do Skip): o boost e definido em palavras, com o raio
      if (bhint.n === 0) { say(STR.boostFirst, 6000); if (clearEl.classList) pulseEl(clearEl); }
      bhint.n++; bhint.nextAt = now + 4000;
    }
    // render repete cada pulso para sempre; a UI tira o pulso depois de 2 ciclos
    var PULSE_LIFE = 2750;
    function addPulse(x, y) {
      var o = ov(); if (!o || !o.pulse) return;
      o.pulse.push({ x: x, y: y, t0: nowMs() });
      while (o.pulse.length > 8) o.pulse.shift();
    }
    // mostra o lugar valido em vez de so descrever: pulsa os nos que aceitam a ferramenta, os mais perto de (x, y) primeiro
    function pulseValid(tool, x, y) {
      var w = game.world, L = [], k, n, deg;
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) {
        n = w.nodes[k]; deg = n.edges ? n.edges.length : 0;
        if (tool === 'lightOwn') { if (n.tool === 'light') L.push(n); continue; }   // teto: os semaforos que se pode tirar
        if (deg >= (tool === 'cross' ? 2 : 3) && n.tool !== tool && !n.locked) L.push(n);
      }
      L.sort(function (a, b) { return dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y); });
      for (k = 0; k < L.length && k < 3; k++) addPulse(L[k].x, L[k].y);
    }
    function prunePulses(now) {
      var o = ov(), i;
      if (!o || !o.pulse || !o.pulse.length) return;
      for (i = o.pulse.length - 1; i >= 0; i--) {
        if (!o.pulse[i] || now - (o.pulse[i].t0 || 0) > PULSE_LIFE) o.pulse.splice(i, 1);
      }
    }

    // ---- layout: margens do fit() da camera = HUD real (bandeja muda de altura com as ferramentas) ----
    // Le o DOM so quando algo mudou (resize, rotacao, bandeja nova), nunca por quadro.
    function measureLayout() {
      if (!render || !render.margins || !top.getBoundingClientRect) return false;
      var H = render.height || root.innerHeight || 0, W = render.width || root.innerWidth || 0;
      var tb, bb;
      try { tb = top.getBoundingClientRect(); bb = bottom.getBoundingClientRect(); } catch (e) { return false; }
      var m = render.margins, changed = false;
      if (tb && isFinite(tb.bottom) && tb.bottom > 0) {
        var mt = Math.round(tb.bottom + 12);
        if (Math.abs(mt - m.top) > 8) { m.top = mt; changed = true; }
      }
      if (bb && isFinite(bb.top) && bb.height > 0 && H > 0) {
        // polimento 1: a faixa flutuante logo acima da base ('?', pausa, Skip ahead, enquadrar: 56 px) tambem e HUD;
        // sem ela na margem as ruas passavam por baixo do Skip ahead e da pausa
        var mb = Math.round(H - bb.top + 12 + (H >= 560 ? 56 : 0));
        if (mb > 0 && Math.abs(mb - m.bottom) > 8) { m.bottom = mb; changed = true; }
      }
      var orient = W > H ? 'land' : 'port';
      if (lastOrient !== null && orient !== lastOrient) { changed = true; orientChanged = true; }
      lastOrient = orient;
      return changed;
    }
    function syncLayout(s) {
      if (!layoutDirty || gesture.state() !== 'idle') return;
      if (s.phase === 'summary' || s.phase === 'over') return; // bandeja escondida: mede depois
      layoutDirty = false;
      try { if (render.resize) render.resize(); } catch (e) { warnOnce('render.resize', e); }
      var changed = measureLayout();
      // no plano um chip que aparece ou some muda as margens, mas a camera fica (so a primeira medida e a troca
      // de orientacao reenquadram); o novato tocava num ponto que tinha acabado de andar
      if (changed && render.fit && (firstLayout || orientChanged || s.phase !== 'plan')) { try { render.fit(!firstLayout); } catch (e) { warnOnce('render.fit', e); } }
      orientChanged = false;
      firstLayout = false;
    }

    // ---- update ----
    function update(dt) {
      if (destroyed) return;
      var s = game.state, now = nowMs();
      uiBeat = now; if (wiQ && wiQ.idle && !wiQ.done) { wiQ.idle = false; wiKick(); }   // w_dawn: frames are back, the background replays go on
      if (s.phase !== uiPhase) { uiPhase = s.phase; uiPhaseFr = 0; } else uiPhaseFr++;
      // rede de seguranca (REFUSALS.md): recusa com som e sem frase no mesmo quadro ganha a frase generica
      if (denyPend) { denyPend = false; if (!tutBalloonOn()) say(STR.deny.generic); }
      if (s.phase !== lastPhase || (s.phase === 'summary' && lastDay !== s.day)) {
        lastPhase = s.phase; lastDay = s.day;
        onPhase(s);
      }
      lastDay = s.day;
      // fim do destaque do cruzamento travado: agora sim abre o resumo ou o fim
      if (holdUntil && now >= holdUntil) {
        holdUntil = 0; ui.classList.remove('crz-hold');
        sayUntil = 0; sayEl.classList.remove('show');   // o aviso do travamento nao cobre o resumo
        sumEl.classList.toggle('show', s.phase === 'summary');
        overEl.classList.toggle('show', s.phase === 'over');
      }
      gesture.tick(now);
      // pointerup perdido (gesto ja vazio): a camera nao fica congelada para sempre
      if (gesture.count() === 0 && render && render.held && render.held()) camHold(false);
      // 2026-11-09: dias 1 a 3 a camera nao anda durante um arrasto (a borda puxava o mapa sozinha; a cidade
      // cabe na tela e o enquadrar resolve). Do dia 4 em diante o arrasto na borda ainda leva a rua longe
      if ((game.state.day | 0) > panLockN()) autoPan(dt);
      if (infTimer > 0) {
        infTimer -= dt * 1000;
        if (infTimer <= 0 && !holding) { var o = ov(); if (o) o.showInfluence = null; }
      } else if (!holding && gesture.state() !== 'held') {
        // disco cinza de influencia sem toque nem segurar (estado perdido): some sozinho
        var o2 = ov(); if (o2 && o2.showInfluence !== null && o2.showInfluence !== undefined) o2.showInfluence = null;
      }
      sumShownTick(now);
      playWaitTick(s, now);
      if (pairArm && now > pairArm.until) { pairArm = null; pairRep = null; syncSelectedNode(); }
      if (pairFirst !== null && now > pairUntil && !pairArm) { pairFirst = null; syncSelectedNode(); }
      pairChipTick(false);
      // pedido de troca aberto (sem prazo): fora do plano fecha; outra faixa que passou por cima e saiu: volta
      if (swapAsk && s.phase !== 'plan') endSwapAsk('phase');
      else if (swapAsk && !sayUntil) say(swapAsk.text, ASK_MS);
      if (swapUndoUntil && (now >= swapUndoUntil || s.phase !== 'plan')) hideSwapUndo();
      if (sayUntil && now >= sayUntil) { sayUntil = 0; sayEl.classList.remove('show'); }
      sayHome();
      // painel do resumo: re-mede a seta "more" (fontes, rotacao, linhas que aparecem depois)
      if (sumEl.classList.contains('show')) {
        // o aviso dentro do painel mudou a altura do conteudo: mede ja (senao a cada 0,3 s)
        var sayOn = sayEl.classList.contains('show');
        if (sayOn !== moreSay) { moreSay = sayOn; moreClock = 0; }
        moreClock -= dt; if (moreClock <= 0) { moreClock = 0.3; syncMore(); }
      }
      else if (panel.classList.contains('crz-hasmore')) panel.classList.remove('crz-hasmore');
      if (newArmed > 0) {
        newArmed -= dt * 1000;
        if (newArmed <= 0) { newBtn.classList.remove('armed'); newBtn.setAttribute('aria-label', STR.newGame); }
      }
      syncTop(s);
      syncLastChip(s);
      syncAnnounce(s);
      if (sheetOpen && s.phase === 'run') sheetRunTick(s);
      // rolagem: so balanca o dado, sempre com o valor real (faces aleatorias pareciam "a previsao mentiu")
      if (rollMs > 0 && s.die) {
        rollMs -= dt * 1000;
        if (rollMs <= 0) { rollMs = 0; dieEl.classList.remove('rolling'); }
      }
      syncHint(s, now); // antes da bandeja: o ladrilho ja pulsa no mesmo quadro
      syncTray(s);
      boostHintTick(s, now);
      boostChipTick(s, now);
      timeScaleTick(s, dt);
      newJPlanTick(s, now);
      fbkTick(s, now);
      prunePulses(now);
      syncLayout(s);
      planOpenFitTick(s);
      bootFitTick(s);
      syncCamUI(s, now);
      fitClock -= dt; if (fitClock <= 0) { fitClock = 0.5; placeFit(); }
    }
    // rodada 3: o aviso (.crz-say, sat+58) cobria o topo do resumo (sat+52). Com o resumo aberto o aviso
    // mora dentro do painel, preso ao topo dele (sticky), e volta ao lugar quando o resumo fecha
    var sayIn = false, moreClock = 0, moreSay = false, fitClock = 0;
    function sayHome() {
      var want = sumEl.classList.contains('show') && !sumEl.classList.contains('crz-peek');   // w_choice2: com o resumo abaixado (peek) o aviso volta ao topo da tela, senao some com o painel
      if (want === sayIn || !panel.insertBefore || !ui.insertBefore) return;
      try {
        if (want) panel.insertBefore(sayEl, panel.firstChild);
        else ui.insertBefore(sayEl, swapUndoEl);
        sayIn = want;
      } catch (e) {}
    }
    // rodada 3: o botao de enquadrar (top -54 px na base) invadia 22 a 30 px da area de toque das cargas do
    // Boost. Mede as duas caixas e sobe o botao ate ficar 8 px acima da area de toque das cargas
    function placeFit() {
      if (!fitBtn.style || !bottom.getBoundingClientRect) return;
      if (fitBtn.classList.contains('gone')) return;
      var bb, cr, F = 44, GAP = 8, nat = -54;
      try { bb = bottom.getBoundingClientRect(); cr = clearEl.classList.contains('gone') ? null : clearEl.getBoundingClientRect(); } catch (e) { return; }
      var want = nat;
      if (bb && cr && cr.height > 0 && cr.width > 0) {
        var fTop = bb.top + nat, fBot = fTop + F;
        if (fTop < cr.bottom + GAP && fBot > cr.top - GAP) want = Math.round(cr.top - GAP - F - bb.top);
      }
      var v = want === nat ? '' : want + 'px';
      if (fitBtn.style.top !== v) fitBtn.style.top = v;
    }
    // folha do dado aberta no dia: fecha quando um anel fica serio (estresse >= 0,5) ou um overlay
    // modal abre. O tutorial precisa da tela para o aviso de seguranca do anel vermelho
    function sheetRunTick(s) {
      if (modal()) { closeSheet(); return; }
      var w = game.world, k, n;
      if (!w || !w.nodes) return;
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) {
        n = w.nodes[k];
        if (n && (n.stress || 0) >= 0.5) { closeSheet(); return; }
      }
    }
    // depois de carregar (save retomado), no primeiro quadro ja desenhado: se a cidade ficou cortada,
    // enquadra tudo uma vez (antes a dica "Drag the map" aparecia com a cidade cortada dos dois lados)
    var bootFrames = 0, orientChanged = false;
    // cada dia abre com a cidade inteira na tela: um reenquadre suave ao ABRIR o plano (2 quadros depois, com o
    // offscreen do render ja medido); depois disso, so gesto, o botao de enquadrar ou um balao com alvo fora
    var planFit = { day: -1, frames: 0 };
    function planOpenFitTick(s) {
      if (s.phase !== 'plan') { planFit.frames = 0; return; }
      if (planFit.day === s.day) return;
      if (bootFrames >= 0 || ++planFit.frames < 3 || layoutDirty || gesture.state() !== 'idle') return;
      planFit.day = s.day;
      if (cityCut() && render && render.fitAll) { try { render.fitAll(!reducedMotion()); } catch (e) { warnOnce('render.fitAll', e); } }
    }
    function bootFitTick(s) {
      if (bootFrames < 0) return;
      if (++bootFrames < 2 || layoutDirty) return;   // espera um draw (offscreen e calculado no draw) e as margens do HUD
      bootFrames = -1;
      planFit.day = s.day;   // o enquadre da carga vale como o da abertura do plano
      if ((s.phase === 'plan' || s.phase === 'run') && cityCut() && render && render.fitAll) {
        try { render.fitAll(false); } catch (e) { warnOnce('render.fitAll', e); }
      }
    }

    function destroy() {
      destroyed = true;
      var i, l;
      for (i = 0; i < listeners.length; i++) {
        l = listeners[i];
        try { l[0].removeEventListener(l[1], l[2], l[3]); } catch (e) {}
      }
      listeners = [];
      for (i = 0; i < timers.length; i++) { try { root.clearTimeout(timers[i]); } catch (e) {} }
      timers = []; dayBannerT = 0;
      // game.onEvent devolve o desinscritor (fake de teste sem ele: o flag destroyed cobre)
      try { if (typeof offGame === 'function') offGame(); } catch (e) { warnOnce('offGame', e); }
      gesture.reset();
      clearGhost();
      var o = ov(); if (o) { o.hoverTool = null; o.selectedNode = null; o.showInfluence = null; }
      if (ui.parentNode) ui.parentNode.removeChild(ui);
    }

    // ---------- retorno da escolha (v2, v2/jogador.md secoes 2 e 3) ----------
    // Tres sinais no mesmo lugar, em tres tempos: o balao na corrida (cruzamento vigiado), a linha do resumo e, na manha
    // seguinte, 'Fixed.' no cruzamento sem anel; e o problema do dia (o anel mais forte pulsa e a faixa diz uma linha).
    // Nunca dois textos juntos: o balao e a faixa esperam o tutorial, outra faixa, folha ou menu; esperou demais, sai.
    // O balao e a mesma peca do balao do tutorial ancorado num no (borda preta, fundo branco, seta), sem botao e sem
    // toque (pointer-events: none): nao pausa nem segura o dedo
    var fbkEl = tut(el('div', 'crz-fbk'), 'fbk-balloon'), fbkTxt = el('span', 'crz-fbktxt'), fbkArrow = el('i', 'crz-fbkarrow');
    fbkEl.setAttribute('role', 'status'); fbkEl.setAttribute('aria-live', 'polite');
    fbkEl.appendChild(fbkTxt); fbkEl.appendChild(fbkArrow);
    ui.appendChild(fbkEl);
    var fbkCur = null;                                     // { id, until, kind } do balao na tela
    var fbkRun = { key: -1, done: {}, hist: {}, queue: [] };
    var fbkAm = { day: -1 }, fbkWatchPend = 0;
    function fbkKey(k) { return 'fbk.' + k + runTag; }   // vale so nesta partida (pruneRunHints limpa as outras)
    function fbkSeen(k) { return !!hints[fbkKey(k)]; }
    function fbkMark(k) { hints[fbkKey(k)] = 1; lsSet(HINT_KEY, JSON.stringify(hints)); }
    // algo do tutorial, do menu ou do HUD fala ou cobre a tela: o retorno espera
    function fbkBusy() { return modal() || tutBalloonOn() || tutorTalking() || sheetOpen || confirmOpen() || !!holdUntil || roll.open || !!guideEl; }
    function fbkRect(e) {
      try { if (!e || (e.classList && e.classList.contains('gone')) || !e.getBoundingClientRect) return null; var r = e.getBoundingClientRect(); return r && r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; } catch (er) { return null; }
    }
    function fbkHit(x, y, w, h, L) {
      for (var i = 0; i < L.length; i++) { var r = L[i]; if (r && x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return true; }
      return false;
    }
    // acima, abaixo, a direita ou a esquerda do no, dentro da faixa entre os HUDs, sem cobrir o no, o chip do Boost,
    // a faixa preta nem o balao do tutorial. Devolve false se o no saiu da tela (o balao nao aponta para fora)
    function fbkPlace(n) {
      if (!n || !render || typeof render.toScreen !== 'function') return false;
      var p = render.toScreen(n.x, n.y), W = render.width || root.innerWidth || 390, H = render.height || root.innerHeight || 844;
      var m = render.margins || {}, y0 = Math.max(8, m.top || 0), y1 = H - Math.max(8, m.bottom || 0);
      if (!(p.x >= 0 && p.x <= W && p.y >= y0 - 10 && p.y <= y1 + 10)) return false;
      var r = fbkRect(fbkEl), bw = r ? r.w : 210, bh = r ? r.h : 44, R = 22, A = 9, G = 10;
      var nodeBox = { x: p.x - R, y: p.y - R, w: 2 * R, h: 2 * R };
      var hud = [nodeBox, fbkRect(bchipEl), fbkRect(bchip2El), sayEl.classList.contains('show') ? fbkRect(sayEl) : null];
      var nb = nodeBoxes(n.id), rings = nb.rings, dots = nb.dots;
      var cx = Math.max(G, Math.min(W - G - bw, p.x - bw / 2));
      var cand = [[cx, p.y - R - A - bh, 'above'], [cx, p.y + R + A, 'below'], [p.x + R + A, p.y - bh / 2, 'side'], [p.x - R - A - bw, p.y - bh / 2, 'side']];
      var pick = null, i, c, tier, tiers = [hud.concat(rings, dots), hud.concat(rings), [nodeBox].concat(rings), [nodeBox]];
      // do mais exigente ao minimo (so nao cobrir o proprio no)
      for (tier = 0; tier < tiers.length && !pick; tier++) for (i = 0; i < cand.length && !pick; i++) {
        c = cand[i];
        if (c[0] < G - 0.5 || c[0] + bw > W - G + 0.5 || c[1] < y0 || c[1] + bh > y1) continue;
        if (!fbkHit(c[0], c[1], bw, bh, tiers[tier])) pick = c;
      }
      if (!pick) return false;
      fbkEl.style.left = Math.round(pick[0]) + 'px'; fbkEl.style.top = Math.round(pick[1]) + 'px';
      fbkEl.classList.toggle('above', pick[2] === 'above'); fbkEl.classList.toggle('below', pick[2] === 'below');
      fbkArrow.style.left = Math.round(Math.max(14, Math.min(bw - 14, p.x - pick[0]))) + 'px';
      return true;
    }
    // outros nos na tela: os com anel (tracejado de ontem, ou ambar/vermelho agora) nunca ficam embaixo de um balao
    // ou do chip do Boost; os demais, se der. Mesma regra para os dois (fbkPlace e chipSpot)
    function nodeBoxes(exceptId) {
      var rings = [], dots = [], s0 = game.state, hm = (s0 && s0.hot) || {}, k, o, q, r2 = 16;
      for (k in game.world.nodes) if (game.world.nodes.hasOwnProperty(k)) {
        o = game.world.nodes[k]; if (!o || o.id === exceptId) continue;
        q = render.toScreen(o.x, o.y);
        var bx = { x: q.x - r2, y: q.y - r2, w: 2 * r2, h: 2 * r2 };
        if ((+hm[o.id] || 0) >= HOT_TAP || (o.stress || 0) >= RING_BUSY || o.locked) rings.push(bx); else dots.push(bx);
      }
      return { rings: rings, dots: dots };
    }
    function fbkShow(n, text, kind) {
      fbkTxt.textContent = text;
      fbkEl.classList.add('on');
      if (!fbkPlace(n)) { fbkEl.classList.remove('on'); return false; }
      // ancora fora do mapa de nos (marca de evento no meio de uma rua): o balao segue a propria ancora
      fbkCur = { id: n.id, until: nowMs() + FBK.balloonMs, kind: kind, anchor: game.world && game.world.nodes && game.world.nodes[n.id] === n ? null : n };
      emitUI('fbkBalloon', { id: n.id, kind: kind, text: text });
      return true;
    }
    function fbkHide() { if (!fbkCur && !fbkEl.classList.contains('on')) return; fbkCur = null; fbkEl.classList.remove('on'); }
    function fbkBalloonTick(now) {
      if (!fbkCur) return;
      var n = fbkCur.anchor || (game.world && game.world.nodes ? game.world.nodes[fbkCur.id] : null);
      if (now >= fbkCur.until || !n || (fbkCur.kind !== 'fixed' && fbkCur.kind !== 'event' && game.state.ff)) { fbkHide(); return; }
      if (!fbkPlace(n)) fbkHide();   // a camera andou: segue o no; saiu da tela, some
    }
    // ferramenta posta (ou Two lanes) com sucesso: o no foi tocado; vigiado novo na partida: a faixa diz uma vez
    function fbkPlaced(tr, n, plain) {
      if (n) fbkTap(n.id);
      if (!tr || tr.watched !== 'new' || fbkSeen('watchFirst')) return;
      fbkMark('watchFirst');
      // colocacao simples: a faixa troca 'Stop placed here.' por esta; troca de sinal ou dica do Yield: espera a faixa
      if (plain && !fbkBusy()) { sayUntil = 0; say(STR.fbk.watchFirst, 3000); }
      else fbkWatchPend = nowMs();
    }
    function fbkTap(id) { if (fbkAm.day >= 0 && fbkAm.hotId === id) { fbkAm.pulseUntil = 0; if (fbkAm.stage < 2) fbkAm.skip = true; } }

    // corrida: o veredito de cada vigiado sai uma vez, no segundo do pico de ontem (ou antes, se hoje passar do pico
    // de ontem). Durante o 8x a decisao acontece em silencio (nenhum balao); o resumo diz o resultado igual
    function fbkRunTick(s, now) {
      var L = s.watch && s.watch.day === s.day ? s.watch.list : null;
      if (s.phase !== 'run') { fbkRun.key = -1; if (fbkCur && fbkCur.kind !== 'fixed' && !(fbkCur.kind === 'event' && s.phase === 'plan')) fbkHide(); return; }
      if (fbkRun.key !== s.day) { fbkRun = { key: s.day, done: {}, hist: {}, queue: [] }; }
      if (!L || !L.length) return;
      var t = +s.dayTime || 0, i, w = game.world;
      for (i = 0; i < L.length; i++) {
        var e = L[i], id = e.id;
        if (fbkRun.done[id]) continue;
        var n = w && w.nodes ? w.nodes[id] : null;
        if (!n) { fbkRun.done[id] = 'gone'; continue; }
        var cur = n.stress || 0, h = fbkRun.hist[id] || (fbkRun.hist[id] = []), k, recent = 0;
        if (!h.length || h[h.length - 1][0] !== t) h.push([t, cur]);
        while (h.length && h[0][0] < t - FBK.win) h.shift();
        for (k = 0; k < h.length; k++) if (h[k][1] > recent) recent = h[k][1];
        var v = null;
        if (cur >= FBK.calm && cur >= (e.p || 0) + FBK.passGap) v = 'bad';
        else if (t >= fbkTrigger(e, s.dayLen, s.speed)) { v = fbkVerdict(fbkTraceAt(e, t), cur, recent) || 'none'; }
        if (!v) continue;
        fbkRun.done[id] = v;
        if (v === 'none' || s.ff) continue;
        fbkRun.queue.push({ id: id, v: v, tool: e.tool, at: now });
      }
      if (fbkCur || !fbkRun.queue.length) return;
      var q = fbkRun.queue[0];
      if (s.ff || now - q.at > FBK.waitMs) { fbkRun.queue.shift(); return; }   // passou a hora: nao fala atrasado
      if (fbkBusy() || s.paused) return;
      var qn = w.nodes[q.id];
      fbkRun.queue.shift();
      if (!qn) return;
      var boostOk = !!(s.clear && s.clear.unlocked) && (((s.boost && s.boost.charges) || (s.clear && s.clear.charges)) | 0) > 0;
      // v2y: 'Tap the bolt' so quando o chip pode sair agora (tempo e cruzamento valem); o chip vai para ESTE no
      var chipOk = boostOk && q.v === 'bad' && boostable(qn) && chipTimeOk(s) && (bchip.id === null || bchip.id === qn.id);
      if (chipOk) bchip.want = { id: qn.id, until: now + 4000 };
      fbkShow(qn, q.v === 'good' ? STR.fbk.good(fbkToolName(q.tool)) : (chipOk ? STR.fbk.bad : STR.fbk.badNoBoost), q.v);
    }

    // manha: (1) 'Fixed.' no cruzamento vigiado ontem que ficou sem anel; (2) o problema do dia: o anel tracejado mais
    // forte pulsa (o mesmo pulso do proximo passo) e a faixa diz uma linha. Sem anel: nada. Uma vez por dia (o reload
    // nao repete). Espera o dado, o crescimento, o tutorial e outra faixa; depois de FBK.morningMax sem vez, desiste
    // w_noopt: o cartao deste anel ja sabe que nada serve (nenhuma peca nem linha a mais 'better'): a manha nao chama para ele
    function noOffer(id) {
      var c = null;
      try { c = typeof game.choiceFor === 'function' ? game.choiceFor(id) : null; } catch (e) { warnOnce('game.choiceFor', e); }
      return !!(c && c.dead && c.relief === 'done' && !(c.extra && c.extra.length));
    }
    function fbkMorningTick(s, now) {
      if (s.phase !== 'plan') { fbkAm = { day: -1 }; if (fbkCur && fbkCur.kind === 'fixed') fbkHide(); return; }
      var w = game.world, hot = s.hot || {}, k;
      if (fbkAm.day !== s.day) {
        var fx = null, best = null, bv = 0;
        var P = s.watchPrev && s.watchPrev.day === s.day - 1 ? s.watchPrev.list || [] : [];
        for (k = 0; k < P.length && !fx; k++) { var pn = w.nodes[P[k].id]; if (pn && !(+hot[P[k].id] >= HOT_TAP)) fx = pn.id; }
        for (k in hot) if (hot.hasOwnProperty(k) && w.nodes[k] && +hot[k] >= HOT_TAP && +hot[k] > bv && !noOffer(+k)) { bv = +hot[k]; best = w.nodes[k].id; }
        fbkAm = { day: s.day, at: now, readyAt: 0, stage: 0, fixedId: fx, hotId: best, pulseUntil: 0, nextPulse: 0, skip: false };
        if (fx === null || fbkSeen('fixed.' + s.day)) fbkAm.stage = 1;
        // w_risk: ontem passou perto de travar (summary.close): o cruzamento dele e o problema do dia, com a frase propria
        var lh = s.history && s.history[s.history.length - 1], sc = s.summary || {}, clId = sc.close && lh && lh.day === s.day - 1 && sc.lockNode != null && w.nodes[sc.lockNode] ? w.nodes[sc.lockNode].id : null;
        // w_one: com um strike para a partida inteira (CFG.ironMode) o aviso e a unica chance: a faixa do quase-travamento vem
        // antes de qualquer outra ('Fixed.' fica para depois) e sai mesmo quando o cartao diz que nenhuma peca ajuda
        if (clId !== null && (CFG.ironMode || !noOffer(clId))) { best = clId; fbkAm.hotId = clId; fbkAm.close = true; if (CFG.ironMode) { fbkAm.stage = 1; fbkAm.skip = false; } }
        if (best === null || fbkSeen('trouble.' + s.day)) fbkAm.skip = true;
      }
      // o tutorial apresenta os aneis tracejados hoje (tip:hot): ele ja aponta o anel mais forte; a faixa nao repete
      if (tutorStep() === 'tip:hot' && !fbkAm.skip) { fbkAm.skip = true; fbkMark('trouble.' + s.day); }
      // pulso do problema do dia: ate tocar no anel (ou por uma ferramenta nele), ate FBK.pulseMs
      if (fbkAm.pulseUntil && now < fbkAm.pulseUntil && now >= fbkAm.nextPulse) {
        var hn = w.nodes[fbkAm.hotId];
        if (hn && (hn.tool || null) === fbkAm.tool0) { addPulse(hn.x, hn.y); fbkAm.nextPulse = now + PULSE_LIFE; } else fbkAm.pulseUntil = 0;
      }
      if (fbkAm.stage >= 2 || (fbkAm.stage === 1 && fbkAm.skip)) return;
      // o roteiro do tutorial ainda em curso (dias de ensino): a manha e dele
      var ready = !growPend && bootFrames < 0 && !fbkBusy() && !tutorScript() && !sayUntil && !fbkCur;
      if (!ready) { fbkAm.readyAt = 0; if (now - fbkAm.at > FBK.morningMax) fbkAm.stage = 2; return; }
      if (!fbkAm.readyAt) fbkAm.readyAt = now;
      if (now - fbkAm.readyAt < FBK.quietMs) return;   // uma pausa curta depois do texto anterior
      fbkAm.readyAt = 0;
      if (fbkAm.stage === 0) {
        fbkAm.stage = 1; fbkMark('fixed.' + s.day);
        var fn = w.nodes[fbkAm.fixedId];
        if (fn && fbkShow(fn, STR.fbk.fixed, 'fixed')) return;
      }
      if (fbkAm.stage === 1 && !fbkAm.skip) {
        fbkAm.stage = 2; fbkMark('trouble.' + s.day);
        var tn = w.nodes[fbkAm.hotId];
        if (!tn) return;
        say(fbkAm.close ? STR.fbk.close : STR.fbk.trouble, 4000);
        // pulsa ate a jogadora tocar no anel ou mexer na ferramenta dele (tool0 = a de agora)
        fbkAm.tool0 = tn.tool || null; fbkAm.pulseUntil = now + FBK.pulseMs; fbkAm.nextPulse = now;
      }
    }
    // w_where: a escolha entre cruzamentos. Todas as vagas de semaforo em uso e um anel cujo cartao diz Light 'better': o 'e se'
    // dos cruzamentos que tem semaforo (fila em fatias, como o toque) diz se um deles fica igual ou melhor com uma peca mais simples
    // (game.lightMoveFor). So entao, uma vez por dia e depois da linha do problema do dia, a faixa diz uma linha e o anel pulsa ate
    // ser tocado. E um fato da vaga, nao ensino: vale com Guidance off. Depois da mudanca (placeNodeTool), o cruzamento de onde o
    // semaforo saiu pulsa ate receber uma peca ou o plano acabar.
    var whereAm = { day: -1 }, WHERE_RINGS = 3;
    function whereTick(s, now) {
      if (s.phase !== 'plan') { whereAm = { day: -1 }; return; }
      var w = game.world, d = s.day | 0, k;
      if (whereAm.day !== d) whereAm = { day: d, queued: false, done: fbkSeen('where.' + d), y: null, pulseUntil: 0, nextPulse: 0, put: null };
      var P = whereAm.put, pn = P && P.day === d ? w.nodes[P.id] : null;
      if (pn && !pn.tool && now >= (whereAm.putPulse || 0)) { addPulse(pn.x, pn.y); whereAm.putPulse = now + PULSE_LIFE; }
      if (whereAm.pulseUntil && now < whereAm.pulseUntil && now >= whereAm.nextPulse) {
        var yn = w.nodes[whereAm.y];
        if (yn && yn.tool !== 'light' && !(choiceOpen() && scId === yn.id)) { addPulse(yn.x, yn.y); whereAm.nextPulse = now + PULSE_LIFE; } else whereAm.pulseUntil = 0;
      }
      if (typeof game.lightMoveFor !== 'function' || !game.lightCap) return;
      if (!whereAm.t0) whereAm.t0 = now;
      if (now - (whereAm.at || 0) < 250) return;   // a leitura dos cartoes (choiceFor) 4 vezes por segundo, nao por quadro
      whereAm.at = now;
      var lc = game.lightCap(); if (!lc || !isFinite(lc.cap) || lc.hand > 0 || lc.used < lc.cap || lc.used < 1) return;
      var hot = s.hot || {}, rings = [], mv = null;
      for (k in hot) if (hot.hasOwnProperty(k) && w.nodes[k] && !w.nodes[k].portal && degOf(w.nodes[k]) >= 3 && +hot[k] >= HOT_TAP && w.nodes[k].tool !== 'light') rings.push(+k);
      rings.sort(function (a, b) { return (+hot[b] - +hot[a]) || (a - b); });
      rings = rings.slice(0, WHERE_RINGS);
      // o cartao aberto agora tambem conta (o toque no semaforo apontado precisa do 'e se' dos semaforos antes do toque na linha)
      var open = choiceOpen() && scId !== null && w.nodes[scId] && w.nodes[scId].tool !== 'light' ? scId : null;
      if (open !== null && rings.indexOf(open) < 0) rings.unshift(open);
      var want = false, miss = [];
      for (k = 0; k < rings.length && !mv; k++) {
        var c = null; try { c = game.choiceFor(rings[k]); } catch (e) { warnOnce('game.choiceFor', e); }
        if (!c) { if (rings[k] !== open) miss.push(rings[k]); continue; }
        if (c.pending || !c.rows.some(function (r) { return r.tool === 'light' && r.verdict === 'better'; })) continue;
        want = true;
        try { mv = game.lightMoveFor(rings[k]); } catch (e) { warnOnce('game.lightMoveFor', e); }
      }
      // os aneis mais fortes sem 'e se' (o reload nao guarda a fila do resumo) entram na fila, uma vez; depois, so se um anel quer
      // o semaforo, o 'e se' de cada cruzamento com semaforo (uma vez). Sem ninguem querendo, nada mais roda
      if (!mv && miss.length && !whereAm.qRings) { whereAm.qRings = true; miss.forEach(function (id) { wiAdd(id); }); }
      if (!mv && want && !whereAm.queued) { whereAm.queued = true; for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && w.nodes[k] && w.nodes[k].tool === 'light') wiAdd(+k); }
      // a linha da manha: uma vez por dia, depois da linha do problema do dia; sem resposta em 2 x FBK.morningMax, desiste
      if (whereAm.done || fbkAm.day !== d || !(fbkAm.stage >= 2 || (fbkAm.stage === 1 && fbkAm.skip))) return;
      if (!mv) { if (now - whereAm.t0 > 2 * FBK.morningMax) whereAm.done = true; return; }
      var ready = !growPend && bootFrames < 0 && !fbkBusy() && !tutorScript() && !sayUntil && !fbkCur && !choiceOpen() && !(lightArm && now < lightArm.until);
      if (!ready) return;
      whereAm.done = true; fbkMark('where.' + d);
      var tn = w.nodes[mv.to]; if (!tn) return;
      fbkAm.pulseUntil = 0;   // um anel pulsa por vez
      say(STR.whereAm, 5000);
      whereAm.y = tn.id; whereAm.pulseUntil = now + FBK.pulseMs; whereAm.nextPulse = now;
      emitUI('whereAm', { to: mv.to, from: mv.from, tool: mv.tool });
    }
    function fbkTick(s, now) {
      fbkBalloonTick(now);
      fbkRunTick(s, now);
      fbkMorningTick(s, now);
      whereTick(s, now);
      evPlanTick(s, now);
      if (fbkWatchPend && s.phase === 'plan' && !sayUntil && !swapUndoUntil && !fbkBusy()) { fbkWatchPend = 0; say(STR.fbk.watchFirst, 3000); }
      else if (fbkWatchPend && (s.phase !== 'plan' || now - fbkWatchPend > 8000)) fbkWatchPend = 0;
    }
    // ---- eventos de lugar (events.js, v2e) ----
    // Vespera e dia do evento, no plano: a faixa diz UMA linha (uma vez por dia e marca, nesta partida); o primeiro
    // evento da partida ganha mais uma linha de ensino (guardada no save: Events.markFirst). Toque na marca: o balao
    // do retorno (o mesmo, ancorado na marca) diz o que vai acontecer e o que ajuda, e o cruzamento que ajuda pulsa.
    // Na corrida, quando a leva sai: um balao curto na ponta. Nada disso fala com outro texto na tela.
    var evAm = { day: -1, done: {}, at: 0, readyAt: 0, firstPend: false };
    function EVS() { return CRZ.Events && CRZ.Events.v === 1 ? CRZ.Events : null; }
    function evMarksNow() { try { return EVS() ? CRZ.Events.marks(game) || [] : []; } catch (e) { warnOnce('Events.marks', e); return []; } }
    function evText(k) { var T = (CFG.events && CFG.events.text) || {}; return T[k] || ''; }
    function evPlanTick(s, now) {
      if (s.phase !== 'plan' || !EVS()) { evAm.day = -1; return; }
      if (evAm.day !== s.day) evAm = { day: s.day, done: {}, at: now, readyAt: 0, firstPend: false };
      var ready = !growPend && bootFrames < 0 && !fbkBusy() && !tutorScript() && !sayUntil && !fbkCur;
      if (!ready) { evAm.readyAt = 0; return; }
      if (!evAm.readyAt) evAm.readyAt = now;
      if (now - evAm.readyAt < FBK.quietMs) return;
      evAm.readyAt = 0;
      if (evAm.firstPend) {
        evAm.firstPend = false;
        say(evText('first'), 4000);
        emitUI('eventFirst', { day: s.day });
        return;
      }
      var M = evMarksNow(), i;
      for (i = 0; i < M.length; i++) {
        var m = M[i], key = 'ev.' + m.key + '.' + m.when;
        if (m.kind !== 'event' || evAm.done[key] || fbkSeen(key)) continue;
        evAm.done[key] = true; fbkMark(key);
        var line = CRZ.Events.stripLine(game, m);
        if (!line) continue;
        say(line, 4000);
        addPulse(m.x, m.y);
        // primeira vez na partida: a linha de ensino vem logo depois (e fica gravada no save)
        if (m.when === 'tomorrow' && !CRZ.Events.firstSeen(game)) { CRZ.Events.markFirst(game); evAm.firstPend = true; }
        emitUI('eventWarn', { key: m.key, when: m.when, type: m.type, text: line });
        return;
      }
    }
    function evTap(sx, sy) {
      if (!EVS() || !render || typeof render.eventMarkAt !== 'function') return false;
      var hit = render.eventMarkAt(sx, sy);
      if (!hit) return false;
      var M = evMarksNow(), m = null, i;
      for (i = 0; i < M.length; i++) if (M[i].key === hit.key) m = M[i];
      if (!m) return false;
      var text = CRZ.Events.explain(game, m);
      if (!text) return false;
      var wn = game.world.nodes[m.nodeId], st0 = game.state;
      // w_bugs12: a crossing that is both an event marker and trouble from yesterday: the card comes first and the event line rides on its grey line
      if (st0.phase === 'plan' && wn && (m.edgeId === null || m.edgeId === undefined) && !tutorScript() && !modal() && !choiceOpen() &&
          (heatOf(st0, wn) >= HOT_TAP || hasReplay(wn))) {
        scEvText = text;
        if (openChoice(st0, wn)) { snd('select'); emitUI('eventTap', { key: m.key, kind: m.type, text: text, card: true }); return true; }
        scEvText = '';
      }
      snd('select');
      var anchor = (m.edgeId === null || m.edgeId === undefined) && wn ? wn : { id: 'ev:' + m.key, x: m.x, y: m.y };
      if (sayUntil) { sayUntil = 0; sayEl.classList.remove('show'); }
      fbkHide();
      fbkShow(anchor, text, 'event');
      // o pulso mostra o que a dica pede: a segunda rua (a ponta e onde ela chega), as ruas do desvio (obra) ou o
      // cruzamento seguinte (Boost)
      var W = game.world, pts = [], sw = typeof CRZ.Events.secondWay === 'function' ? CRZ.Events.secondWay(game, m) : null;
      if (sw && W.nodes[sw.from] && W.nodes[sw.to] && !/Boost$/.test(CRZ.Events.adviceKey(game, m))) pts = [W.nodes[sw.from], W.nodes[sw.to]];   // w_bugs15: the pulse follows the advice
      else if (m.edgeId !== null && m.edgeId !== undefined && W.edges[m.edgeId] && typeof CRZ.Events.detourEdges === 'function') {
        CRZ.Events.detourEdges(W, W.edges[m.edgeId]).slice(0, 3).forEach(function (id) {
          var e = W.edges[id], a = e && W.nodes[e.a], b = e && W.nodes[e.b];
          if (a && b) pts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        });
      }
      if (!pts.length) { var hn = CRZ.Events.helpNode(game, m); if (hn) pts = [hn]; }
      pts.forEach(function (p) { addPulse(p.x, p.y); later(function () { addPulse(p.x, p.y); }, 900); });
      emitUI('eventTap', { key: m.key, type: m.type, text: text });
      return true;
    }
    function evOpen(ev) {
      var s = game.state, n = game.world && game.world.nodes ? game.world.nodes[ev.nodeId] : null;
      if (!n || s.ff || s.paused || fbkBusy() || fbkCur) return;
      // o balao fica no cruzamento que a leva enche (o Boost ali ajuda, medido em web/dev/events/prep.js)
      var hn = CRZ.Events.helpNode ? CRZ.Events.helpNode(game, { nodeId: ev.nodeId, edgeId: null }) : null;
      fbkShow(hn || n, evText('now'), 'eventNow');
      if (hn) addPulse(hn.x, hn.y);
      // v2y: o balao da leva pede o Boost no cruzamento seguinte: o chip vai para la quando a fila chegar (ambar)
      if (hn && boostable(hn)) bchip.want = { id: hn.id, until: nowMs() + 8000 };
    }

    // resumo: uma linha por peca posta ou movida onde ontem passaram carros (os vigiados do anel e as marcas de game.state.marks), com numero
    // honesto (a espera mais longa, em s de jogo) e a linha do porque. w_choice2: a peca do cartao leva a faixa prometida
    // ('Expected 2 to 9 s'); fora da faixa, UM motivo lido do estado (os carros do cruzamento hoje e ontem); mais de 2 linhas: as 2 de maior
    // mudanca e 'and N more: tap a crossing to see'
    var sumTexts = {};
    function sumList(s) {
      var out = [], seen = {}, i, L = s.watch && s.watch.day === s.day ? s.watch.list || [] : [], M = s.marks && s.marks.day === s.day ? s.marks.list || [] : [];
      // w_line: a crossing has one line for its piece and one for its road work (Road, Two lanes, fix next door): the key says which
      function sk(id, tool) { return id + (tool === 'road' || tool === 'upgrade' || tool === 'feed' ? 'r' : 'p'); }
      for (i = 0; i < L.length; i++) {
        var e = L[i]; if (!e.now || typeof e.w !== 'number') continue;   // save antigo sem a espera de ontem: sem numero inventado
        seen[sk(e.id, e.tool)] = 1; out.push({ id: e.id, tool: e.tool, e: e, n0: e.n, n1: e.now.n });
      }
      for (i = 0; i < M.length; i++) {
        var m = M[i]; if (!m.now || seen[sk(m.id, m.tool)]) continue;
        // w_bugs13: a piece on a crossing that had no cars yesterday: one plain line (no comparison), only if cars came today
        if (m.fresh) { if (!(m.now.n > 0)) continue; seen[sk(m.id, m.tool)] = 1; out.push({ id: m.id, tool: m.tool, fresh: true, e: { id: m.id, tool: m.tool, w: m.now.w, now: { w: m.now.w } }, n0: 0, n1: m.now.n }); continue; }
        seen[sk(m.id, m.tool)] = 1; out.push({ id: m.id, tool: m.tool, e: { id: m.id, tool: m.tool, w: m.w, now: { w: m.now.w } }, n0: m.n, n1: m.now.n });
      }
      for (i = 0; i < out.length; i++) { out[i].a = Math.round(out[i].e.w); out[i].b = Math.round(out[i].e.now.w); out[i].score = Math.abs(out[i].b - out[i].a); }
      // w_bugs12: a change that made things worse always wins the line (then the biggest change, then the id)
      for (i = 0; i < out.length; i++) out[i].bad = !out[i].fresh && game.verdictFor(out[i].a, out[i].b) === 'worse' ? 0 : 1;
      out.sort(function (x, y) { return (x.bad - y.bad) || (y.score - x.score) || (x.id - y.id); });
      return out;
    }
    // o texto de uma linha: { text, why, tryIt }
    function sumText(s, l) {
      var cn = game.world && game.world.nodes ? game.world.nodes[l.id] : null, ch = s.choice && s.choice[l.id], tn = lc(fbkToolName(l.tool)), r = { text: '', why: '', tryIt: false };
      if (l.fresh) { r.text = STR.fbk.fresh(fbkToolName(l.tool), l.b); return r; }
      var mine = ch && ch.day === s.day && ch.tool === l.tool && cn && (l.tool === 'upgrade' || l.tool === 'road' || l.tool === 'feed' || cn.tool === ch.tool);
      if (!mine) { r.text = STR.fbk.line(l.tool === 'road' ? STR.tools.road : fbkToolName(l.tool), l.a, l.b); return r; }   // w_bugs12: a plain built road is 'Road'
      var M2 = STR.fbk.mine, rk = { worse: 0, same: 1, better: 2 }, pv = ch.v || game.verdictFor(ch.w0, ch.w1), rv = game.verdictFor(l.a, l.b), T = fbkToolName(l.tool);
      if (rv === pv) { r.text = M2[rv](T, l.a, l.b); r.tryIt = rv === 'worse'; }
      else if (pv === 'better' && rv === 'same' && ch.q && M2[ch.q === 'event' ? 'qualEvent' : 'qualBusy']) { r.text = M2[ch.q === 'event' ? 'qualEvent' : 'qualBusy'](T, l.a, l.b); r.tryIt = true; }
      else if (pv === 'better') { r.text = (rv === 'worse' ? M2.worseThanBefore : (l.b < l.a ? M2.littleBetter : M2.noBetter))(T, l.a, l.b); r.tryIt = true; }
      else if (rv === 'better') r.text = M2.betterThan(T, l.a, l.b);
      else if (pv === 'worse') r.text = M2.noWorse(T, l.a, l.b);
      else { r.text = M2.worseThan(T, l.a, l.b); r.tryIt = true; }
      // verdade errada: o motivo que o estado mostra (os carros que cruzaram aqui hoje contra ontem), senao nenhum
      var n0 = l.n0, n1 = l.n1;
      if (typeof n0 === 'number' && typeof n1 === 'number') {
        if (rk[rv] < rk[pv] && n1 >= n0 * 1.15 && n1 - n0 >= 3) r.why = STR.fbk.moreCars(n1, n0);
        else if (rk[rv] > rk[pv] && n1 <= n0 * 0.85 && n0 - n1 >= 3) r.why = STR.fbk.fewerCars(n1, n0);
      }
      return r;
    }
    function fbkSummary(s) {
      var A = sumList(s), i, n = 0;
      watchLineEl.innerHTML = ''; sumTexts = {};
      for (i = 0; i < A.length; i++) {
        var l = A[i], t = sumText(s, l);
        if (!(l.tool === 'road' || l.tool === 'upgrade' || l.tool === 'feed') || !Object.prototype.hasOwnProperty.call(sumTexts, l.id)) sumTexts[l.id] = t.text + (t.why ? ' ' + t.why : '');   // w_line: the tap on a crossing says its piece line first
        if (i >= 2) continue;
        var d = el('div');
        d.textContent = t.text;
        if (t.tryIt) {
          d.className = 'crz-swtry'; d.setAttribute('role', 'button');
          (function (id, day, dd) { dd.addEventListener('click', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); choiceAsk = { id: id, day: day }; dd.className = 'crz-swtry on'; snd('select'); var tn = game.world && game.world.nodes ? game.world.nodes[id] : null; if (tn) addPulse(tn.x, tn.y); sayUntil = 0; say(STR.fbk.tryAsked, 4500); emitUI('tryAnother', { id: id }); }); })(l.id, s.day | 0, d);
        }
        watchLineEl.appendChild(d); n++;
        if (t.why) { var dw = el('div', 'crz-swhy'); dw.textContent = t.why; watchLineEl.appendChild(dw); }
      }
      if (A.length > 2) {
        // 'and N more: tap a crossing to see': o toque na linha abaixa o resumo por alguns segundos e acende os cruzamentos de
        // que ela fala; o toque num deles diz a linha dele (o resumo cobre o mapa, como no chip 'N new crossings')
        var dm = el('div', 'crz-swhy crz-swmore'); dm.textContent = STR.fbk.more(A.length - 2); dm.setAttribute('role', 'button');
        (function (ids) {
          dm.addEventListener('click', function (ev) {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            var w = game.world, first = null;
            snd('select');
            ids.forEach(function (id) { var nd = w && w.nodes ? w.nodes[id] : null; if (!nd) return; if (!first) first = nd; addPulse(nd.x, nd.y); later(function () { addPulse(nd.x, nd.y); }, 900); });
            if (first) { try { if (render && render.focus) camByUser(function () { render.focus(first.x, first.y, focusZoom(), !reducedMotion()); }); } catch (e) { warnOnce('render.focus', e); } }
            sumEl.classList.add('crz-peek');
            if (peekT) root.clearTimeout(peekT);
            peekT = later(function () { sumEl.classList.remove('crz-peek'); peekT = 0; }, 6000);
            emitUI('sumMore', { ids: ids });
          });
        })(A.slice(2).map(function (x) { return x.id; }));
        watchLineEl.appendChild(dm);
      }
      watchLineEl.classList.toggle('gone', !n);
      var why = whyCause(s, CFG);
      whyEl.textContent = why ? why.text : '';
      whyEl.classList.toggle('gone', !why);
    }

    // CONGELADO (tutorial.js): ferramenta na mao ou null
    function getSelectedTool() { return sel || null; }

    // para o tutorial: estado sem ler layout (antes ele fazia querySelector + getComputedStyle por quadro)
    function isSheetOpen() { return sheetOpen; }
    function isHolding() { return !!holdUntil; }

    // para o tutorial (lembrete do Boost): id do no com o chip do Boost na tela, ou null
    function boostChip() { return bchip.id; }

    // boost pedido por um botao (balao do tutorial 'Boost'): mesmo caminho do toque no no, com retorno visivel
    // ('Boosted!' + anel). Antes o botao so fechava o balao e nenhum raio era gasto
    // faixa de 1 linha (dicas do tutorial, aviso do ff): nao bloqueia, some em ms ou no primeiro toque
    function stripSay(text, ms) { if (!text) return; sayUntil = 0; say(text, ms || 6000); if (sayUntil) sayUntil = nowMs() + (ms || 6000); stripOn = true; }
    function boostNode(id) {
      var s = game.state, n = game.world && game.world.nodes ? game.world.nodes[id] : null;
      if (!n || s.phase !== 'run') return false;
      var ok = runTap(s, n);
      if (ok) { sayUntil = 0; say(STR.boosted, 1800); later(function () { addPulse(n.x, n.y); }, 500); }
      return !!ok;
    }
    // medida (perf_summary.mjs) e testes: o estado do 'e se' em fatias do ultimo resumo
    function wiState() {
      var q = wiQ; if (!q) return { done: true, n: 0 };
      var b = 0; for (var i = 0; i < q.jobs.length; i++) b += q.jobs[i].branches | 0;
      return { spent: Math.round(q.spent || 0), later: q.later ? q.later.length : 0, ready: q.ready || 0, done: q.done, stop: q.stop, n: q.jobs.length, next: q.jobs[q.i] ? q.jobs[q.i].id : null, order: q.jobs.slice(q.i).map(function (j) { return j.id + (j.relief ? 'r' : ''); }), all: q.jobs.map(function (j) { return j.id + (j.relief ? 'r' : ''); }), slices: q.slices, maxSlice: Math.round(q.maxSlice * 10) / 10, branches: b, ms: q.done ? Math.round(q.t1 - q.t0) : null };
    }
    return { update: update, destroy: destroy, _wiState: wiState, getSelectedTool: getSelectedTool, isSheetOpen: isSheetOpen, isHolding: isHolding, boostChip: boostChip, boostNode: boostNode, timeScale: timeScale,
             openGuide: openGuide, closeGuide: closeGuide, isGuideOpen: function () { return !!guideEl; },
             isRollOpen: function () { return roll.open; },
             beginLeave: beginLeave, flushSave: onHide,
             // faixa de 1 linha do tutorial (dicas): nao bloqueia, some em ms ou no primeiro toque
             strip: stripSay };
  }

  CRZ.UI = {
    create: create,
    STR: STR,
    // w_tiles: desenho das ferramentas (SVG, caixa 48): o How to play (menu.js) usa o mesmo da bandeja e do guia
    toolIcons: ICONS,
    // recomendador unico por no (o tutorial usa para o balao do anel): advise(node, day, cfg, world, heat)
    // -> {key, tool, text, dir}. Mesmo estado do no, mesma recomendacao
    advise: advise,
    _test: { strikeRule: function () { return STR.strikesFrom(CRZ.CFG.ironMode ? 1 : CRZ.CFG.maxStrikes | 0); }, lockedFirst: function () { return STR.lockedFirst(CRZ.CFG.maxStrikes | 0); }, ringText: ringText, ringLevel: ringLevel, advise: advise, adviseVary: adviseVary, roundBeats: roundBeats, mainRoad: mainRoad, busiestRoad: busiestRoad, pillPlace: pillPlace, dieFreeLight: dieFreeLight, freeGrant: freeGrant, cardFits: cardFits, createGesture: createGesture, nextOneway: nextOneway, pipLayout: pipLayout, nextSpeed: nextSpeed, speedList: speedList,
             chipPick: chipPick, chipRank: chipRank, chipPlace: chipPlace, CHIP: { on: CHIP_ON, off: CHIP_OFF, px: CHIP_PX, px2: CHIP2_PX, every: CHIP_EVERY, day: ASSIST_DAY },
             jamBar: jamBar, jamAdvice: jamAdvice, jamPick: jamPick, jamOptions: jamOptions, busiestLane: busiestLane, denyText: denyText, suggestCard: suggestCard, worstNode: worstNode,
             fbk: { FBK: FBK, traceAt: fbkTraceAt, trigger: fbkTrigger, verdict: fbkVerdict, result: fbkResult, whyCause: whyCause, toolName: fbkToolName },
             isEnd: isEnd, isDeadEnd: isDeadEnd, queueJunction: queueJunction, loseText: loseText, lockedNodeOf: lockedNodeOf,
             toolIcon: toolIcon, cardIcon: cardIcon, eventSvg: eventSvg, dieSvg: dieSvg, miniDieSvg: miniDieSvg, describeDie: describeDie, dieName: dieName, dieSides: dieSides, ICONS: ICONS, CARD_ICONS: CARD_ICONS }
  };
})(typeof window !== 'undefined' ? window : globalThis);
