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
    win: 'You made it',
    lose: 'Game over',
    // vocabulario fixo: "ring" = qualquer anel, "busy crossing" = anel ambar (0,3-0,6),
    // "red ring" = anel vermelho (acima de 0,6), "locked" = travou
    lockedSay: 'This crossing jammed: 1 strike.',
    loseCause: function (d, sign) { return 'Day ' + d + ': ' + (sign ? 'the crossing with a ' + sign : 'a crossing with no sign') + ' jammed.'; },
    loseNext: {
      sign: function (a) { return 'Next time, try a ' + a + ' there.'; },
      swap: function (to) { return 'Next time, a ' + to + ' there moves more cars.'; },
      lane: 'Next time, give its busiest road a second lane.',
      road: 'Next time, build a road around it to spread cars.',
      boost: 'Next time, Boost it before the red ring fills.'
    },
    // blind3 4: o delta so quando e ganho ('(+11)'); dia pior que ontem: so o numero de ontem
    yesterday: function (prev, delta) { return 'Yesterday ' + prev + (delta > 0 ? ' (+' + delta + ')' : ''); },
    cardToday: function (name) { return name + ' today'; },
    info: {
      strikes: function (s, m) { return 'Strikes: ' + s + ' of ' + m + '. A jammed crossing adds one.'; },
      days: function (d, m) { return d >= m ? STR.lastDay(d, m) : 'Day ' + d + ' of ' + m + '.'; },
      budget: function (n) { return n + (n === 1 ? ' build point' : ' build points') + '. New every day; 3 unused can stay for tomorrow.'; },
      tipsLast: function (n, per) { return STR.tipsLast(n, per); },
      // a barra mede carros entregues (1 por carro a 1x, mais a 2x e 4x), somados de um dia para o outro
      tips: function (n, per) { return 'Delivery bonus: ' + n + ' of ' + per + '. Full bar: +1 build point tomorrow.'; },
      // toque perto das bolinhas do Boost (ao lado do Play): curto, sem parecer recusa do Play (passeio da Roberta)
      boost: function (n) { return 'Boost: tap a road end for an extra car, or a busy crossing.'; }
    },
    roadFrom: 'Start a road from a crossing or a road end.',
    roadFromEnd: 'Drag from a road end.',
    // rotulos curtos do HUD (Arthur, 2026-11-09: 'nao assuma que o jogador sabe nada'): cada marcador diz o que e
    lblDay: function (d, m) { return 'Day ' + d + ' of ' + m; },
    lblStrikes: 'Strikes', lblDie: 'Dice', lblBp: 'Build points',
    // blind3 3: a face do dado e o efeito em palavras ('Today: 11 · normal day'); nunca um numero solto
    lblTomorrow: function (id, v) { return 'Tomorrow: ' + (v != null ? v + ' \u00b7 ' : '') + STR.dayWord(STR.dieShort[id] || 'normal'); },
    dayWord: function (w) { return w === 'normal' ? 'normal day' : w; },
    // sob o dado: o tipo do dia em palavra comum; sob o numero tracejado: 'Tomorrow' (parecia o preco do relance)
    lblToday: function (id, kind, v) { return 'Today: ' + (v != null ? v + ' \u00b7 ' : '') + STR.dayWord(STR.dieShort[id] || ({ bad: 'bad', good: 'good', great: 'great', jackpot: 'jackpot' }[kind] || 'normal')); },
    // o efeito do dado em 2 ou 3 palavras (rotulos do topo)
    dieShort: { rush: 'more cars', rain: 'slower cars', festival: 'more cars', plain: 'normal', luck1: '+1 point', luck2: '+2 points',
                luck3: '+3 points', free: 'free build', calm: 'fewer cars', jackpot: '+5 points' },
    // primeiro gasto da partida (uma vez): o que aconteceu com os pontos
    firstSpend: function (n) { return 'You spent ' + n + (n === 1 ? ' build point' : ' build points') + '. You get new build points every day. Up to 3 unused ones stay for tomorrow.'; },
    lblPts: function (n) { return n + (n === 1 ? ' build point' : ' build points'); },
    // dia 1: proximo passo fixo depois da primeira rua (sem pontos ou 6 s parada); some so com o Play
    nextPlay: 'Good. Now tap \u25b6\ufe0e to send the cars.',
    nextOut: 'Out of build points. Tap \u25b6\ufe0e to start the day.',
    nextShort: 'Not enough points to build more. Tap \u25b6\ufe0e to start the day.',
    nextNew: 'Give each NEW crossing a sign, then tap \u25b6\ufe0e.',
    roadTile: 'Road',
    roadFirstTut: 'Build one road first: tap Road, then drag from a road end.',
    roadFirst: 'Build one road first.',
    carryAsk: function (b, cap) { return 'You have ' + b + ' build points. Only ' + cap + ' are kept. Tap \u25b6\ufe0e again to start.'; },
    dieFirst: 'Tap the dice to see today\'s effect.',
    speedFirst: 'This button now sets speed (1\u00d7, 2\u00d7, 4\u00d7). Faster = more bonus points, but drivers wait less.',
    toolUse: function (id) {
      var n = STR.tools[id] || id;
      if (id === 'upgrade' || id === 'oneway') return 'Pick ' + n + ', then tap a road.';
      if (id === 'cross') return 'Pick ' + n + ', then tap a crossing.';
      return 'Pick ' + n + ', then tap a crossing that has no sign.';
    },
    nextFirst: 'Pick Road, drag from a road end, then tap \u25b6\ufe0e.',
    pickAgain: 'Tap again to pick it.',
    halfway: 'Halfway! You can stop here: your game is saved.',
    cStart: 'Start day', cBack: 'Back to building',
    cWhyNew: function (n) { return n === 1 ? '1 new crossing has no sign.' : n + ' new crossings have no sign.'; },
    cWhyFree: 'You still have a free road today.',
    cWhyCarry: function (b, cap) { return 'You have ' + b + ' build points. ' + (b - cap) + ' will be lost. You can keep ' + cap + ' for tomorrow.'; },
    cSpend: 'Spend them', cAnyway: 'Start anyway',
    undid: function (lbl, back) { return 'Undid' + (lbl ? ': ' + lbl : '') + (back > 0 ? ' (+' + back + (back === 1 ? ' point)' : ' points)') : '') + '.'; },
    boostWhen: 'Boost works while the day runs.',
    boostNothing: 'Nothing to boost here yet.', boostAllCalm: 'All calm. Nothing needs a boost.',
    freeRoadNow: 'Your next road costs nothing.',
    rerollLbl: function (c) { return 'Reroll: ' + c + (c === 1 ? ' point' : ' points'); },
    rerollAria: function (c) { return 'Reroll today\'s roll for ' + c + (c === 1 ? ' build point' : ' build points'); },
    // hipercasual (Arthur): uma frase, uma vez, sem meta nem contador
    runHint: 'Tap a road end to send an extra car. Boosts recharge.',
    extraCar: '+1 extra car',
    dragFurther: 'Drag farther to build.',
    tryNormal: 'Try Normal',
    // dicionario de botoes (Roberta 2026-11-09): uma frase por ferramenta
    toolUseLine: {
      road: 'Drag from a circled road end or a crossing to build a road.',
      stop: 'Cars take turns. Best at quiet crossings.',
      yield: 'The main road never stops. Best where a busy road meets a side road.',
      light: 'Handles heavy four-way traffic. Pair two lights so cars get green after green.',
      upgrade: 'Tap a road to add a second lane. Best with a traffic light.',
      cross: 'Drivers wait longer before the ring turns red. Replaces the sign.',
      round: 'For four or more busy roads. Weak with only three roads.',
      oneway: 'Tap a road: cars drive away from the half you tap.'
    },
    toolWorks: {
      road: 'Joins a road end or a crossing to a new spot. Undo gives the points back.',
      stop: 'Goes on a crossing with 3 or more roads. Replaces the sign there.',
      yield: 'Goes on a crossing with 3 or more roads. Replaces the sign there.',
      light: 'Goes on a crossing with 3 or more roads. Works best with Two lanes.',
      upgrade: 'Works on any road. Best on the road into a traffic light.',
      cross: 'Goes where 2 or more roads meet. Replaces the sign there.',
      round: 'Goes on a crossing with 4 or more roads. Replaces the sign there.',
      oneway: 'Tap again to flip, a third time for two-way. A car with no route waits, then counts as lost.'
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
    toolWorksLightEarly: 'Goes on a crossing with 3 or more roads. Replaces the sign there.', guideMore: 'More tools arrive each day.', guideButtons: 'Buttons', guideMarks: 'Colors and marks', guideCards: 'Reward cards',
    guideBtnRows: [
      ['@play', 'Play / speed', 'Starts the day. While it runs, tap for 1\u00d7, 2\u00d7 or 4\u00d7. Faster = more bonus points, but drivers wait less.'],
      ['\u275a\u275a', 'Pause', 'Stops the day for a moment. Tap again to go on.'],
      ['\u21b6', 'Undo', 'Takes back your last build and gives the points back.'],
      ['@fit', 'Whole map', 'Shows the whole city.'],
      ['@bolt', 'Boost', 'Recharges in the first days; 3 a day after that. Sends an extra car from a road end, or clears a busy crossing.'],
      ['\u2680', 'Dice', 'Today\'s roll and tomorrow\'s. Reroll once a day for 1 build point.'],
      ['\u2630\ufe0e', 'Menu', 'How to play, sound, this guide and a new game.']
    ],
    guideMarkRows: [
      ['amber', 'Amber ring', 'A busy crossing: cars are waiting in line.'],
      ['red', 'Red ring', 'About to jam. A jam is a strike.'],
      ['hot', 'Gray dashed ring', 'Yesterday\'s trouble spot.'],
      ['new', 'NEW', 'Roads just met here. Give it a sign.'],
      ['days', 'Day dots', 'The red dot is today. 12 days in all.'],
      ['strikes', 'Strike circles', 'A jam fills one. When all fill, the game ends.'],
      ['points', 'Build points', 'Spend them on roads and signs. Up to 3 unused ones stay for tomorrow.']
    ],
    // resumo enxuto (Roberta 2026-11-09)
    infoQueue: 'The longest line of waiting cars today. A full bar means a crossing almost jammed.',
    infoBonus: 'Every car delivered fills this bar; 2\u00d7 and 4\u00d7 fill it faster. Full bar: +1 build point tomorrow.',
    bvalPlus: function (n, last) { return '+' + n + (n === 1 ? ' point' : ' points') + (last ? '' : ' tomorrow'); },
    todoNew: function (n) { return 'To do before tomorrow: ' + n + (n === 1 ? ' new crossing needs a sign \u203a' : ' new crossings need a sign \u203a'); },
    todoBusy: 'Busiest crossing today \u203a',
    todoBusyWhy: 'This crossing got too busy. Tomorrow, boost it early.',
    boosted: 'Boosted!',
    boostedSend: 'Boosted! An extra car is on its way.',
    boostedJFirst: 'Boosted: cars here move faster for a few seconds.',
    // B: anel ambar e aneis agrupados
    ringGroup: function (n) { return (n === 2 ? 'Two' : String(n)) + ' busy crossings are close together.'; },
    // D/L: primeiro cruzamento novo e a regra do dia 4
    newJFirst: 'NEW: roads just met here. Give this crossing a sign before you start.',
    newJRule: 'From day 4, a crossing without a sign gets much slower.',
    day4Rule: 'From today, a crossing with no sign gets slow. Give each NEW crossing a sign.',
    boostsFixed: 'From today: 3 boosts a day.',
    resumedDay: 'Resumed from the start of the day.',
    cWhyFreeLight: 'You still have a free traffic light today.',
    newJChipSay: 'Each NEW crossing needs a sign.',
    // F: faixa de pedestre sobre um sinal
    crossOver: function (c) { return 'Crosswalk, ' + c + (c === 1 ? ' build point' : ' build points') + ': replaces the sign. Rings turn red later.'; },
    // G: pares de semaforo
    pairFail: 'Pick a light on the same road.',
    // I: retorno ao por um sinal
    placed: function (name) { return name + ' placed here.'; },
    // J: pontos que sobram
    carryOver: function (n) { return 'Saved for tomorrow: ' + n; },
    // K: dia 3 a 4x
    day3Fast: 'Day 3 runs at 4\u00d7. Faster = more bonus points, but drivers wait less.',
    sentOther: 'That end was full: the extra car left from the next road end.',
    // um termo so para o raio: boost (definido aqui, na primeira vez que o dia roda)
    boostFirst: 'Boost: tap a road end to send an extra car.',
    panLocked: 'Use two fingers to move the map.',
    nextDone: function (d) { return 'Done building? Tap \u25b6\ufe0e to start Day ' + d + '.'; },
    // arrasto que comecou perto de um ponto mas fora dele (o mapa so andava, sem aviso)
    roadFromDot: 'Start the drag right on a road end or crossing.',
    // rua que passa rente a uma ponta sem ligar nela
    notLinked: 'Not connected: the road only passes by. Drag onto the road end to connect.',
    // dicas neutras do fantasma (rua ok): corte no maximo e cruzamento que a obra vai abrir
    ghostCapped: 'Longest road allowed: lift your finger to build',
    ghostCross: 'Crosses a road: makes a crossing',
    ghostCrossN: function (n) { return 'Crosses ' + n + ' roads: makes ' + n + ' crossings'; },
    // rotulos do cartao do resumo
    sumQueue: 'Longest line of cars',
    sumBonus: 'Delivery bonus',
    sumStrikes: 'Strikes',
    // folha do dado: o icone tracejado ao lado do dado
    dieNextWhat: "Dashed dice at the top: tomorrow's roll, shown in advance.",
    deadEnd: 'Dead end: no cars use it. Link it to another road.',
    deadEndTap: 'Dead end: no cars use it. Link it to another road.',
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
    tipNext: '+1 tomorrow',
    speedBonusYes: 'Delivery bonus: +',
    speedBonusTail: ' tomorrow',
    speedBonusNone: 'Delivery bonus: ',
    speedBonusToward: ' toward +1 build point',
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
    cards: { plus2: '+2 build points', freeRoad: 'Free road', freeLight: 'Free traffic light', patient: 'Patient drivers', waveBonus: 'Double green waves', smooth: 'Faster cars' },
    cardLine: {
      plus2: 'Start tomorrow with 2 extra build points.',
      freeRoad: 'Your first new road tomorrow costs nothing.',
      freeLight: 'Your first traffic light tomorrow costs nothing.',
      patient: 'Drivers wait 30% longer before the ring turns red.',
      waveBonus: 'Green waves are worth double tomorrow.',
      smooth: 'All cars drive 10% faster tomorrow.'
    },
    cardGood: {
      plus2: 'Good if you have a lot to fix.',
      freeRoad: 'Good if you want to grow the city.',
      freeLight: 'Good if one crossing is very busy.',
      patient: 'Good if you saw rings today.',
      waveBonus: 'Good if you have paired lights.',
      smooth: 'Good if lines were long today.'
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
      // a recusa sempre diz o proximo passo (Arthur no iPhone, 2026-11-09: travou no dia 1 com 0 pontos)
      budget: 'Not enough build points. Tap \u25b6\ufe0e to start the day: you get more every day.',
      budgetCost: function (c, have) { return 'Not enough build points. This costs ' + c + ', you have ' + have + '. Tap \u25b6\ufe0e to start the day.'; },
      locked: function (d) { return 'Unlocks on day ' + d + '.'; },
      phase: 'Build before the day starts, not during it.',
      same: 'This spot already has that tool.',
      sameTool: function (name) { return 'Already a ' + name + ' here.'; },
      sameLanes: 'This road already has two lanes.',
      notJunction: 'Tap a crossing, where roads meet.',
      // sem cruzamento a frente para pulsar (antes pulsava o no do meio da rua, que nao e ponta nem cruzamento)
      portalNone: 'Road ends can\'t take a Stop, Yield or light. Pick a crossing with three or more roads.',
      // game: 'notjunction' (curva, reta ou beco)
      notjunction: 'Stops, yields and lights need a crossing: three or more roads meeting.',
      notjunctionCross: 'A crosswalk needs a road passing through this crossing.',
      edge: 'Tap right on a road.',
      notlight: 'Tap a traffic light, tap Pair lights, then tap another light.',
      // Boost numa ponta cuja rua esta na fila do cruzamento a frente
      portalQueue: 'The line is at the pulsing crossing. Boost that crossing.',
      // Boost recusado pelo game: sem fila no no, dia pausado, ainda bloqueado
      boostCalm: 'Nothing to boost here yet.',
      boostPhase: 'Boost works while cars are moving.',
      boostLocked: function (d) { return 'Boost unlocks on day ' + d + '.'; },
      other: 'Can\'t build there: this spot doesn\'t take that tool.',
      boostNone: 'No Boosts left today.',
      // ponta sem lugar para mais um carro agora (game.useClear 'space')
      boostSpace: 'No room right now. Try another road end.',
      boostWhere: 'Boost works on a road end or a busy crossing.',
      // cruzamento sem fila (estresse < BOOST_MIN): a UI recusa antes do game e a carga fica
      boostCalmJ: 'This crossing is fine now. Save your boost.',
      // cruzamento com Boost ainda correndo: o segundo nao soma (sim: o restante e max, nao soma)
      boostRunning: 'Boost is already working here.'
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
      unlocksTomorrow: function (name) { return ' New tool tomorrow: ' + name + '.'; },
      dirs: { n: 'north', s: 'south', e: 'east', w: 'west' }
    },
    // dica de anel com ferramenta de rua na mao: o toque no anel nao constroi
    ringEdgeTool: 'That ring is a hint. Tap the road itself.',
    ringEdgeLane: function () { return 'That ring is a hint. Tap its busiest road to widen it.'; },
    paired: 'Lights paired: cars get green after green.',
    // parear com intencao: chip ao lado do semaforo tocado; depois do chip, o toque no outro semaforo pareia
    pairChip: 'Pair lights',
    pairChipAria: 'Pair this traffic light with another one',
    pairPick: 'Now tap another traffic light to pair with.',
    pairReplace: 'Replace pair? Tap again.',
    pairSame: 'These two lights are already paired.',
    pairNotLight: 'Pick another traffic light to pair with.',
    pairCancel: 'Pairing canceled.',
    // troca de sinal: pedido expirou (nada mudou) e troca feita com o sinal gratis
    swapCancel: 'Swap canceled.',
    swapCancelFree: 'Swap canceled. Your free light is still there.',
    // botao discreto ao lado da faixa do pedido de troca (o pedido fica aberto ate outro toque)
    swapCancelBtn: 'Cancel',
    swapCancelAria: 'Cancel the swap',
    // fim de partida: penultimo strike, ultimo dia (chip e faixa) e linha de fechamento do resumo do dia 12
    strikeWarn: 'One more strike ends the game.',
    lastChip: 'Last day',
    // sem repetir os numeros que o fim ja mostra logo abaixo (dias, carros)
    closing: function (d) { return 'Last day done: your city kept moving for all ' + d + ' days.'; },
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
    daysAria: function (n, b) { return n + (n === 1 ? ' day played, ' : ' days played, ') + b + (b === 1 ? ' with a strike.' : ' with a strike.'); },
    more: 'more',
    playAsk: function (n) { return (n === 1 ? '1 new crossing has no sign.' : n + ' new crossings have no sign.') + ' Tap \u25b6\ufe0e again to start.'; },
    tools: { road: 'Road', stop: 'Stop', yield: 'Yield', light: 'Traffic light', upgrade: 'Two lanes',
             cross: 'Crosswalk', round: 'Roundabout', oneway: 'One-way' },
    events: { calm: 'Calm', plain: 'Normal', busy: 'Busy', rush: 'Rush', rain: 'Rain', festival: 'Festival' },
    // dado do dia: nome e descricao de reserva (a descricao e gerada do effect quando ele existe)
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
      linked: 'Already linked', phase: 'Only before the day starts', deadEnd: 'Dead end', other: "Can't build here"
    },
    // a mesma recusa em linguagem simples, com o limite (faixa do topo ao soltar o dedo).
    // Sem jargao ("steps" saiu, WALKTHROUGH2): o limite e a marca vermelha que o fantasma desenha
    // na linha, a um comprimento maximo de rua da origem.
    roadSay: {
      short: 'Too short: drag a bit farther from the road end or crossing.',
      long: 'Too far for one road: it reaches only to the red mark. Build it as two roads.',
      range: 'Out of range: roads stay inside the build area.',
      near: 'Too close to a crossing: start from the crossing or end before it.',
      stub: 'That would leave a tiny leftover piece of road. End on the road or drag farther.',
      blocked: 'A road is in the way: cross it straight on, or go around.',
      angle: 'Too close to another road: roads must meet at a wider angle.',
      linked: 'Already linked.',
      other: "Can't build here: try another direction."
    },
    // folha do dado: o que o dado faz e a regra do relance, em uma linha cada
    dieWhat: 'Every morning the dice roll. Good rolls give build points or a free build. Bad rolls bring more or slower cars. You see the roll when the day starts.',
    // rolagem visivel (Arthur: 'o que nao se ve nao existe')
    rollTitle: "Today's roll", rollTut: 'Every day starts with a roll. Tap the dice.', rollTap: 'Tap to roll', rollAria: 'Roll the dice',
    rollContinue: 'Continue', rollTapSkip: 'Tap to skip',
    grewEnds: function (n) { return 'The city grew: ' + n + (n === 1 ? ' new road end' : ' new road ends'); },
    grewRoads: function (n) { return 'The city grew: ' + n + (n === 1 ? ' new road' : ' new roads'); },
    rollNormal: 'Normal day: no change', rollFreeLight: 'a free traffic light',
    rollFx: { rush: 'more cars', festival: 'more cars', rain: 'slower cars', luck1: '+1 build point', luck2: '+2 build points',
              luck3: '+3 build points', free: 'a free road', calm: 'fewer cars, +1 build point', jackpot: '+5 build points, patient drivers' },
    rollLive: function (v, fx) { return "Today's roll: " + v + '. ' + fx + '.'; },
    dieOnce: 'You can reroll once a day, before you start the day.',
    // Rush sem pontos para o relance: informa, sem tom de erro (dia 2 com 1 ponto, passeio da Roberta)
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
      jackpot: { name: 'Jackpot', desc: '+5 build points and patient drivers.' }
    }
  };

  function lc(s) { return String(s).charAt(0).toLowerCase() + String(s).slice(1); }
  // nomes de ferramenta em minuscula para o meio da frase ("a stop", "a traffic light")
  var TL = {};
  Object.keys(STR.tools).forEach(function (k) { TL[k] = STR.tools[k].charAt(0).toLowerCase() + STR.tools[k].slice(1); });

  function dieName(id) {
    var d = STR.dice[id];
    return d ? d.name : (STR.events[id] || '');
  }
  // descricao a partir dos campos de effect (certa mesmo se o config mudar); STR.dice e o reserva
  function describeDie(die) {
    if (!die) return '';
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
  function toolOpen(cfg, id, day) { var t = cfg && cfg.tools && cfg.tools[id]; return !!t && day >= t.unlockDay; }
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
  // ctx (opcional): { budget } pontos da jogadora. Semaforo no no (passeio da Roberta, 2026-11-09): trocar por
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
    return labelAdvice(adviseRaw(n, day, cfg, world, heat, ctx), n, heat);
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
    if (junction && n.tool && !fresh) return keepSign(n, day, cfg, world, heat, ctx);
    var roundOk = n.tool !== 'light' || (deg >= 4 && roundBeats(n, world));
    if (junction) {
      if (deg >= 4 && better('round') && roundOk) pick = 'round';
      else if (better('light')) pick = 'light';
      else if ((deg === 3 || !n.edges) && better('yield') && mainRoad(n, world)) pick = 'yield';
      else if (better('stop')) pick = 'stop';
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
    if (!memo || !n || !a || n.id === undefined) return a;
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
    var cause = STR.loseCause(day | 0, n.tool ? T[n.tool] : '');
    var a = advise(n, (day | 0) + 1, cfg, world, heat, ctx), next;
    if (a && a.key.indexOf('sign:') === 0) next = n.tool && STR.tools[n.tool] ? N.swap(T[a.tool]) : N.sign(T[a.tool]);
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
  function suggestCard(draft, peak, worst, ctx) {
    function hasC(id) { return draft && draft.indexOf(id) >= 0 && cardFits(id, peak, ctx); }
    if (!draft || !draft.length) return null;
    if (peak >= 0.6 && hasC('patient')) return 'patient';
    if (peak >= 0.6 && worst && !isEnd(worst) && degOf(worst) >= 3 && !worst.tool && hasC('freeLight')) return 'freeLight';
    if (hasC('plus2')) return 'plus2';
    return null;
  }
  // a carta faz sentido para a jogadora agora? (sem ctx: sim, como antes)
  function cardFits(id, peak, ctx) {
    if (!ctx) return true;
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
    return D.other;
  }
  function kindTone(kind) {
    return kind === 'bad' ? 'red' : ((kind === 'good' || kind === 'great' || kind === 'jackpot') ? 'green' : 'ink');
  }

  // cartas que sairam do jogo: seguem em STR so para o chip de um save antigo com a carta ativa
  var RETIRED = { smooth: 1, waveBonus: 1 };
  var SAVE_KEY = 'cruzamento.save';
  var HINT_KEY = 'cruzamento.hints';
  var NODE_TOOLS = { stop: 1, yield: 1, light: 1, round: 1, cross: 1 };
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
  // Sentido tocado = de onde se tocou para a outra ponta.
  function nextOneway(cur, t) {
    var dir = t < 0.5 ? 1 : -1;
    if (cur === 0 || cur === undefined || cur === null) return dir;
    if (cur === dir) return -dir;
    return 0;
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
    var st = 'idle'; // idle | pending | road | pan | held | pinch | dead
    var node = null, t0 = 0, last = null;

    function pts() { var a = [], k; for (k in ptr) { if (ptr.hasOwnProperty(k)) a.push(ptr[k]); } return a; }
    function pinchOf(a, b) { return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: dist(a.x, a.y, b.x, b.y) }; }
    function abort() {
      if (st === 'road') h.roadCancel();
      else if (st === 'held') h.holdEnd();
    }

    // esquece todos os ponteiros (ponteiro orfao, app em segundo plano)
    function reset() {
      abort();
      ptr = {}; count = 0; st = 'idle'; node = null; last = null;
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
          if (node && h.canRoad(node)) { st = 'road'; h.roadStart(node, p.sx, p.sy); h.roadMove(x, y); }
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
        st = 'idle'; node = null; last = null;
      } else if (st === 'pinch') { st = 'dead'; }
    }
    function cancel(id) {
      if (!ptr[id]) return;
      delete ptr[id]; count--;
      abort();
      if (count === 0) { st = 'idle'; node = null; last = null; } else st = 'dead';
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
    stop: '<circle cx="24" cy="24" r="17" class="f-red"/><rect x="13" y="20.5" width="22" height="7" rx="1" class="f-white"/>',
    yield: '<path class="f-red" fill-rule="evenodd" d="M5 9H43L24 42Z M13.5 14.5H34.5L24 32.5Z"/>',
    light: '<rect x="15" y="4" width="18" height="40" rx="9" class="f-ink"/><circle cx="24" cy="14" r="4" class="f-dim"/><circle cx="24" cy="24" r="4" class="f-dim"/><circle cx="24" cy="34" r="4.2" class="f-green"/>',
    // rotatoria e faixa iguais ao mapa (drawPicto do render.js com s = 36): aro r = 0,4s, traco 0,16s,
    // ponto central 0,11s; zebra 0,9s x 0,7s com 3 barras solidas de cw/5, sem moldura
    round: '<circle cx="24" cy="24" r="14.4" fill="none" stroke-width="5.76" class="s-ink"/><circle cx="24" cy="24" r="3.96" class="f-ink"/>',
    cross: '<rect x="7.8" y="11.4" width="6.48" height="25.2" class="f-ink"/><rect x="20.76" y="11.4" width="6.48" height="25.2" class="f-ink"/><rect x="33.72" y="11.4" width="6.48" height="25.2" class="f-ink"/>',
    upgrade: '<line x1="5" y1="18" x2="43" y2="18" stroke-width="3" stroke-dasharray="7 5" class="s-ink"/><line x1="5" y1="30" x2="43" y2="30" stroke-width="3" stroke-dasharray="7 5" class="s-ink"/>',
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
    smooth: '<path d="M8 12L20 24L8 36 M24 12L36 24L24 36" fill="none" stroke-width="4" stroke-linejoin="round" class="s-ink"/>'
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
  function eventSvg(id, kind) {
    var tone = kindTone(kind || ({ rush: 'bad', rain: 'bad', festival: 'bad', luck1: 'good', luck2: 'good', luck3: 'great',
                                   free: 'great', calm: 'great', jackpot: 'jackpot' })[id]);
    var F = 'f-' + tone, S = 's-' + tone, LN = ' stroke-linecap="round" fill="none"';
    var n = { busy: 3 }[id], s = '', i, m;
    if (id === 'plain') {
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

  /* ---------- helpers de DOM e storage ---------- */

  function lsGet(k) { try { return root.localStorage ? root.localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (root.localStorage) root.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { if (root.localStorage) root.localStorage.removeItem(k); } catch (e) {} }
  function nowMs() {
    return (root.performance && root.performance.now) ? root.performance.now() : Date.now();
  }

  /* ---------- UI ---------- */

  function create(opts) {
    var CFG = CRZ.CFG, C = CFG.colors;
    var rootEl = opts.root, game = opts.game, render = opts.render, audio = opts.audio;
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
    var sndDenyAt = -1e9, sayDeny = false;
    function snd(name) {
      if (name === 'deny') sndDenyAt = nowMs();
      else if ((name === 'build' || name === 'place') && sayDeny) clearDenySay();
      try { if (audio && audio.play) audio.play(name); } catch (e) {}
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
      } catch (e) {}
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
    var PER_RUN = { sumInfo: 1, firstSpend: 1, ringGroup: 1, day4rule: 1, boostJ1: 1, runHint: 1, half6: 1, boosts4: 1, resumed: 1 };
    var runTag = '@' + ((game.world && game.world.seed) != null ? game.world.seed : 0);
    (function pruneRunHints() {
      var k, ch = false;
      for (k in hints) if (hints.hasOwnProperty(k) && k.indexOf('@') > 0 && k.slice(k.indexOf('@')) !== runTag) { delete hints[k]; ch = true; }
      if (ch) lsSet(HINT_KEY, JSON.stringify(hints));
    })();
    var hint = null;

    // ---- DOM ----
    var ui = el('div', 'crz-ui');
    ui.setAttribute('data-phase', 'plan');
    var k;
    for (k in C) { if (C.hasOwnProperty(k) && ui.style && ui.style.setProperty) ui.style.setProperty('--' + k, C[k]); }

    var top = el('div', 'crz-top');
    var dotsEl = tut(el('div', 'crz-dots'), 'dots'), dotEls = [], i;
    for (i = 0; i < CFG.maxDays; i++) { var d = el('span', 'crz-dot'); d.setAttribute('aria-label', 'Day ' + (i + 1)); dotsEl.appendChild(d); dotEls.push(d); }
    // rotulo 'Day N of 12' sob os pontinhos (o ponto vermelho e hoje)
    var dayLbl = el('span', 'crz-lbl crz-lbl-day'); dayLbl.setAttribute('aria-hidden', 'true'); dotsEl.appendChild(dayLbl);
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
    for (i = 0; i < CFG.maxStrikes; i++) { var sk = el('span', 'crz-strike'); strikesEl.appendChild(sk); strikeEls.push(sk); }
    var strikeLbl = el('span', 'crz-lbl crz-lbl-strk', STR.lblStrikes); strikeLbl.setAttribute('aria-hidden', 'true'); strikesEl.appendChild(strikeLbl);
    // role fica com infoTap (button focavel que explica ao toque); o aria-label da o numero
    strikesEl.setAttribute('aria-label', 'Strikes: 0 of ' + CFG.maxStrikes);
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
    panel.appendChild(headEl); panel.appendChild(bigEl); panel.appendChild(capEl); panel.appendChild(prevEl); panel.appendChild(closeEl); panel.appendChild(queueRow);
    // pontos que passam ao dia seguinte (ate CFG.carryCap): 'Saved for tomorrow: N'
    var carryEl = el('div', 'crz-bonus crz-carry gone');
    // dia 6: ponto natural de parada (hipercasual), uma linha cinza, uma vez por partida
    var halfEl = tut(el('div', 'crz-half gone'), 'summary-half');
    panel.appendChild(queueInfo);
    panel.appendChild(bonusRow); panel.appendChild(bonusInfo); panel.appendChild(strikeRow); panel.appendChild(bonusEl); panel.appendChild(carryEl); panel.appendChild(jamEl); panel.appendChild(lostEl); panel.appendChild(newJEl);
    panel.appendChild(todoEl);
    panel.appendChild(halfEl);
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

    var overEl = tut(el('div', 'crz-sheet crz-over'), 'over');
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
    // vitoria no ultimo dia: a linha de fechamento do dia 12 (o game vai do dia 12 direto ao fim, sem resumo)
    var overClose = tut(el('div', 'crz-sclose gone'), 'over-closing');
    overEl.appendChild(markEl); overEl.appendChild(overTitle); overEl.appendChild(overSub); overEl.appendChild(overClose); overEl.appendChild(statsEl);
    // rodada 3: a rua com carrinhos parecia uma barra de dias (quadrados preto e vermelho). Agora e de verdade:
    // um quadrado por dia jogado, vermelho = dia com strike, com a legenda embaixo
    var overDays = tut(el('div', 'crz-odays gone'), 'over-days'), overDaysCap = el('div', 'crz-odayscap gone');
    overDays.setAttribute('role', 'img');
    overDaysCap.textContent = STR.daysLegend;
    overStreet.classList.add('gone');
    overEl.appendChild(overBest); overEl.appendChild(overHard); overEl.appendChild(overStreet); overEl.appendChild(overDays); overEl.appendChild(overDaysCap); overEl.appendChild(againBtn); overEl.appendChild(tryNormalBtn);

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
    function say(text, ms, valid) {
      if (!text) return;
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
    function showSwapUndo(ms) { swapUndoUntil = nowMs() + ms; swapUndoEl.classList.remove('gone'); }
    function hideSwapUndo() { swapUndoUntil = 0; swapUndoEl.classList.add('gone'); }
    // Cancel do pedido de troca: mesmo lugar do Undo (abaixo da faixa), mais discreto (borda fina, texto suave)
    var swapCancelEl = tut(el('button', 'crz-sayundo crz-swapcancel gone', ''), 'swap-cancel');
    swapCancelEl.textContent = STR.swapCancelBtn;
    swapCancelEl.setAttribute('aria-label', STR.swapCancelAria);
    try { var scs = swapCancelEl.style; scs.borderWidth = '1.5px'; scs.borderColor = 'var(--inkSoft)'; scs.color = 'var(--inkSoft)'; scs.fontWeight = '600'; scs.minWidth = '76px'; } catch (e) {}
    ui.appendChild(swapCancelEl);
    function showSwapCancel() { hideSwapUndo(); swapCancelEl.classList.remove('gone'); }
    function hideSwapCancel() { swapCancelEl.classList.add('gone'); }
    // chip do Boost (dia 4+): botao de 56 px ao lado do no mais critico; toque = o mesmo Boost do mapa
    var bchipEl = tut(el('button', 'crz-bchip gone', svg(BOLT_ICON, '0 0 24 24') + '<span>' + STR.chipBoost + '</span>'), 'boost-chip');
    bchipEl.setAttribute('aria-label', STR.chipAria);
    ui.appendChild(bchipEl);
    // segundo no acima do limiar: chip menor, sem pulso (o pior continua com o chip grande)
    var bchip2El = tut(el('button', 'crz-bchip2 gone', svg(BOLT_ICON, '0 0 24 24')), 'boost-chip2');
    bchip2El.setAttribute('aria-label', STR.chipAria);
    ui.appendChild(bchip2El);
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
        sty.textContent = '.crz-pchip{position:absolute;left:0;top:0;width:' + PCHIP_W + 'px;height:' + PCHIP_H + 'px;border-radius:22px;z-index:3;' +
          'background:var(--white,#fff);color:var(--ink,#111);border:2px solid var(--ink,#111);font-size:14px;font-weight:800;padding:0 10px;' +
          'box-shadow:0 2px 8px rgba(0,0,0,.18);pointer-events:auto;white-space:nowrap}' +
          '.crz-pchip.armed{background:var(--ink,#111);color:var(--white,#fff)}' +
          '.crz-pchip:active{transform:scale(.96)}@media (prefers-reduced-motion: reduce){.crz-pchip:active{transform:none}}' +
          '.crz-lastchip{margin-left:6px;padding:2px 7px;border-radius:9px;background:var(--red,#d33);color:#fff;font-size:11px;' +
          'font-weight:800;line-height:1.3;white-space:nowrap}' +
          '.crz-sclose{width:100%;font-size:14px;line-height:1.35;font-weight:700;color:var(--ink,#111);text-align:center}';
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
        if (srStrikes >= 0 && s.strikes > srStrikes) { srLast = ''; announce('Strike ' + s.strikes + ' of ' + CFG.maxStrikes); }
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
    function flash(x, y, kind) { try { if (render && render.flash) render.flash(x, y, kind); } catch (e) {} }
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
      var c; try { c = typeof game.cost === 'function' ? game.cost(tool) : undefined; } catch (e) {}
      say(denyText(r, tool, game.state, CFG, c));
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
      return { budget: s.budget | 0, fresh: fresh, boost: boost };
    }
    function nodeAdvice(s, n, day) {
      var d = day != null ? day : (s.day | 0), h = function (o) { return heatOf(s, o); };
      return adviseVary(adviceMemo, n, advise(n, d, CFG, game.world, h, adviceCtx(s, n, day != null && day > (s.day | 0))), d, CFG, game.world, h);
    }
    function tapAdvice(s, n) { var a = nodeAdvice(s, n); if (a) showAdviceRoad(a); return a ? a.text : ''; }
    // conselho de segunda faixa: destaca no mapa a rua mais ocupada do no (o texto nao diz ponto cardeal).
    // Feature-detect: render.highlightRoad(edgeId, ms) pode nao existir num render mais antigo
    function showAdviceRoad(a) {
      if (!a || a.tool !== 'upgrade' || a.edge == null) return;
      if (render && typeof render.highlightRoad === 'function') { try { render.highlightRoad(a.edge, 2000); } catch (e) {} }
    }
    // ferramenta de cruzamento na mao: os lugares que a aceitam pulsam (ate 6), uma vez por escolha
    function pulseCandidates(id, dry) {
      if (!NODE_TOOLS[id] || game.state.phase !== 'plan') return 0;
      var w = game.world, k, n, c = 0, need = id === 'cross' ? 2 : 3;
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
        var c = CFG.tools[t.id] ? CFG.tools[t.id].cost : t.cost;
        // 'Works best with Two lanes' so quando Two lanes ja existe
        var wk = STR.toolWorks[t.id];
        if (t.id === 'light' && !toolOpen(CFG, 'upgrade', s.day | 0)) wk = STR.toolWorksLightEarly;
        body.appendChild(gRow(toolIcon(t.id), (STR.tools[t.id] || t.id) + ' \u00b7 ' + c + (c === 1 ? ' point' : ' points'),
          [STR.toolUseLine[t.id], wk]));
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
      if (doc.body && doc.body.classList) { doc.body.classList.add('crz-modal'); doc.body.classList.add('crz-guide-on'); }
      guidePaused = s.phase === 'run' && !s.paused && typeof game.setPaused === 'function';
      if (guidePaused) { try { game.setPaused(true); } catch (e) {} }
      emitUI('guideOpen', {});
    }
    function closeGuide() {
      if (!guideEl) return;
      if (guideEl.parentNode) guideEl.parentNode.removeChild(guideEl);
      guideEl = null;
      // M2: o menu tambem e dono de crz-modal; so tira a classe se nenhuma camada do menu estiver aberta
      var menuAny = false; try { menuAny = !!(CRZ.app && CRZ.app.menu && CRZ.app.menu.isOpenAny && CRZ.app.menu.isOpenAny()); } catch (e) {}
      if (doc.body && doc.body.classList) { doc.body.classList.remove('crz-guide-on'); if (!menuAny) doc.body.classList.remove('crz-modal'); }
      if (guidePaused) { guidePaused = false; try { game.setPaused(false); } catch (e) {} }
      emitUI('guideClose', {});
    }
    function legendText(id) {
      var c; try { c = typeof game.cost === 'function' ? game.cost(id) : undefined; } catch (e) {}
      if (typeof c !== 'number') c = CFG.tools[id] ? CFG.tools[id].cost : 0;
      return STR.legend(STR.tools[id] || id, c, STR.toolUseLine[id] || '');
    }
    function legendAfford(id) { try { return !game.canAfford || game.canAfford(id) !== false; } catch (e) { return true; } }
    function syncLegend() {
      // blind3 2: ferramenta que nao cabe no orcamento: sem legenda (o aviso de pontos ja diz)
      var on = !!sel && game.state.phase === 'plan' && !!STR.toolUseLine[sel] && legendAfford(sel);
      if (on) legendEl.textContent = legendText(sel);
      legendEl.classList.toggle('gone', !on);
      bottom.classList.toggle('crz-legendon', on);
    }
    function setSel(id) {
      var prev = sel;
      sel = id;
      if (prev && prev !== id) emitUI('toolDeselected', { tool: prev });
      if (id && id !== prev) { emitUI('toolSelected', { tool: id }); pulseCandidates(id); }
      syncLegend();
      // Escolher ferramenta NUNCA reenquadra (passeio humano 2026-11-09: a camera andava depois de pegar a
      // ferramenta; antes a Rua chamava fitRoom e qualquer ferramenta chamava settle, que salta para o fim da
      // animacao). Agora a animacao em curso so para onde esta (render.stop): nada anda sob o polegar.
      // O unico reenquadramento da Rua e no comeco do arrasto, com a origem fora da area util (roadStart).
      if (id && id !== prev && game.state.phase === 'plan' && render) {
        try { if (render.stop) render.stop(); } catch (e) {}
      }
      var o = ov(); if (o) { o.hoverTool = id; if (id && !holding) { o.showInfluence = null; infTimer = 0; } }
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
      return p.x >= (m.left || 0) + PAD && p.x <= W - (m.right || 0) - PAD && p.y >= (m.top || 0) + PAD && p.y <= H - (m.bottom || 0) - PAD;
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
        if (sel === 'road') return true;
        return !sel && !!node && isEnd(node) && !!(game.canAfford && game.canAfford('road'));
      },
      roadBroke: function (node) {
        if (sel || game.state.phase !== 'plan' || !isEnd(node) || !game.canAfford || game.canAfford('road')) return false;
        snd('deny'); say(roadSayText('budget')); return true;
      },
      // dias 1 a 3 (cidade pequena): um dedo nao arrasta o mapa; o enquadrar e dois dedos continuam
      lockPan: function () { var s = game.state; return (s.day | 0) >= 1 && (s.day | 0) <= PAN_LOCK_DAYS && (s.phase === 'plan' || s.phase === 'run'); },
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
      tap: onTap,
      roadStart: function (node) {
        roadFrom = node.id; ghost = null; snd('select');
        // unico reenquadramento da Rua: a origem do arrasto esta fora da area util (sob o HUD ou rente a borda).
        // Anda o minimo, sem animacao, para ela aparecer (reveal com force: vale mesmo com a camera segura no gesto)
        if (render && render.reveal && !originOnScreen(node)) { try { render.reveal(node.x, node.y, false, true); } catch (e) {} }
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
          if (g.why === 'budget') shake(tiles.road && tiles.road.el);
          say(roadSayText(g.why));
          emitUI('roadMiss', { why: g.why || null });
          return;
        }
        var br = game.buildRoad(from, g.x, g.y);
        if (result(br, g.x, g.y, 'build', 'road')) {
          // a ponta solta nao virou portal (teto de portais): avisa que nenhum carro vem ali
          if (br.deadEnd) { roadNote(g.x, g.y, 'deadEnd'); say(STR.deadEnd); }
          else nearMiss(from, g);
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
    function roadNote(x, y, code) { try { if (render && render.note && code) render.note(x, y, whyText(code)); } catch (e) {} }
    // recusa da rua em linguagem simples (faixa do topo): diz o limite e o que fazer
    function roadSayText(code) {
      var R = STR.roadSay;
      if (!code) return '';
      if (code === 'budget') { var c; try { c = game.cost('road'); } catch (e) {} return denyText({ reason: 'budget' }, 'road', game.state, CFG, c); }
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
      if (best && best.edges && best.edges.length < 2) { say(STR.notLinked); addPulse(best.x, best.y); later(function () { addPulse(best.x, best.y); }, 900); }
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
      try { if (cut && render.fitAll) render.fitAll(true); else if (render.fit) render.fit(true); } catch (e) {}
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
      if (seen('pan') || s.phase !== 'plan' || !cut || modal() || gesture.state() !== 'idle' || (render.animating && render.animating())) { panHintAt = 0; return; }
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
    function runTap(s, n, sx, sy, fromChip) {
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
      // fica (CFG.clear.minStress do game segue desligado; passeio da Roberta: Boost a 0,31 logo depois do
      // chip gastava carga sem efeito visivel). Ponta de rua (manda carro) nao passa por aqui.
      // final check 1: ponta que deixou de ser ponta (a rua do dia 1 saiu dela: portal com 2 ruas) ou curva de rua:
      // o toque vale para a ponta de rua mais perto (antes: 'All calm', que so vale para cruzamento)
      var dg = n.edges ? n.edges.length : 0;
      if (!isEnd(n) && dg <= 2 && !fromChip && (n.stress || 0) < BOOST_MIN) {
        var ne = nearestEnd(n);
        if (ne && ne !== n) return runTap(s, ne, sx, sy, fromChip);
        snd('deny'); say(STR.deny.boostWhere); return false;
      }
      var jn = !(n.portal && (!n.edges || n.edges.length < 2));
      // Boost correndo e o anel ainda abaixo do chip (CHIP_ON): o segundo so tiraria pouco, recusa tambem
      var stz = n.stress || 0, runB = (n.boost || 0) > 0 && stz < CHIP_ON;
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
        if (kind === 'send') { snd('build'); flash(n.x, n.y, 'build'); try { if (render && render.note) render.note(n.x, n.y, STR.extraCar); } catch (e) {} }
        else { snd('place'); flash(n.x, n.y, 'ok'); }
        // retorno visivel do boost: anel e aviso curto (o raio gasto some das bolinhas)
        addPulse(n.x, n.y);
        // com o roteiro do tutorial a seguir, o proprio balao responde (nunca dois avisos juntos); fica o anel
        // primeiro boost num cruzamento: o que ele faz (uma vez)
        if (kind !== 'send' && !seen('boostJ1') && !tutorScript()) { markSeen('boostJ1'); sayUntil = 0; say(STR.boostedJFirst, 3200); }
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
        say(r.reason === 'charges' ? STR.deny.boostNone : r.reason === 'space' ? STR.deny.boostSpace : STR.deny.boostWhere);
      }
      emitUI('clearUsed', { ok: okC, kind: kind, reason: okC ? null : (r && r.reason) || null, id: n.id });
      return okC;
    }

    /* ---- ajudas do dia 4 em diante (ensinam a acao; nada joga sozinho) ---- */
    // (3) Yield num cruzamento que ficou vermelho ontem (state.hot no plano = pico de ontem): diz o que segura ali
    function yieldBusyHint(s, n) {
      if ((s.day | 0) < ASSIST_DAY) return;
      var h = (s.hot && +s.hot[n.id]) || 0;
      if (h < RING_SEEN) return;
      // o mesmo recomendador do anel e do resumo (com o Yield ja no no: o proximo sinal melhor)
      var a = nodeAdvice(s, n);
      if (!a || a.key.indexOf('sign:') !== 0) return;
      say(STR.yieldBusy(TL[a.tool], null));
    }

    // (1) chip do Boost: aparece com estresse >= CHIP_ON e cargas sobrando, some abaixo de CHIP_OFF
    var bchip = { id: null, x: -1, y: -1, side: null, rects: null, rectAt: 0, cool: {},
                  id2: null, x2: -1, y2: -1, at: -1e9, hist: {} };
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
      return out;
    }
    function hideChip2() {
      if (bchip.id2 === null) return;
      bchip.id2 = null; bchip.x2 = bchip.y2 = -1;
      bchip2El.classList.add('gone');
    }
    function hideChip() {
      hideChip2();
      if (bchip.id === null) return;
      bchip.id = null; bchip.side = null; bchip.x = bchip.y = -1;
      bchipEl.classList.add('gone');
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
    function chipValid(id, t) {
      var n = id !== null ? game.world.nodes[id] : null;
      return !!(n && boostable(n) && (n.stress || 0) >= chipOff() && !(bchip.cool[id] > t));
    }
    function chipWanted(s) {
      var cl = s.clear;
      return s.phase === 'run' && (s.day | 0) >= ASSIST_DAY && !s.paused && !modal() && !holdUntil &&
        !!(cl && cl.unlocked && (cl.charges | 0) > 0) && !!(render && render.toScreen);
    }
    function boostChipTick(s, now) {
      if (!chipWanted(s)) { hideChip(); return; }
      var t = +s.dayTime || 0, id = bchip.id, id2 = bchip.id2;
      // recalcula a cada CHIP_EVERY ms, ou ja quando o no do chip deixou de valer (sem chip: todo quadro)
      if (id === null || !chipValid(id, t) || (id2 !== null && !chipValid(id2, t)) || now - bchip.at >= CHIP_EVERY) {
        bchip.at = now;
        chipSample(t);
        var rk = chipRank(game.world, bchip.id, bchip.id2, chipOn(), chipOff(), function (x) { return bchip.cool[x.id] > t; }, chipRate);
        id = rk.id; id2 = rk.second;
      }
      // o anel sumiu: o chip fica mais 2 s (o toque que ja vinha nao cai no mapa como 'calm')
      if (id === null) {
        if (bchip.id !== null) { if (!bchip.lostAt) bchip.lostAt = now; if (now - bchip.lostAt < CHIP_LINGER) return; }
        bchip.lostAt = 0; hideChip(); return;
      }
      bchip.lostAt = 0;
      var n = game.world.nodes[id], fresh = id !== bchip.id;
      if (fresh) {
        bchip.id = id; bchip.side = null; bchip.rects = null;
        bchipEl.classList.remove('gone');
        bchipEl.classList.toggle('still', reducedMotion());
        emitUI('boostChip', { id: id });
      }
      if (!bchip.rects || now - bchip.rectAt > 1000) { bchip.rects = hudRects(); bchip.rectAt = now; }
      var p = render.toScreen(n.x, n.y);
      var W = render.width || root.innerWidth || 390, H = render.height || root.innerHeight || 844;
      var c = chipPlace(p, W, H, bchip.rects, bchip.side);
      bchip.side = c.side;
      if (Math.abs(c.x - bchip.x) >= 1 || Math.abs(c.y - bchip.y) >= 1) {
        bchip.x = c.x; bchip.y = c.y;
        bchipEl.style.left = Math.round(c.x - CHIP_PX / 2) + 'px';
        bchipEl.style.top = Math.round(c.y - CHIP_PX / 2) + 'px';
      }
      // segundo no: chip menor ao lado dele (nunca por cima do chip grande)
      var n2 = id2 !== null && id2 !== id ? game.world.nodes[id2] : null;
      if (!n2) { hideChip2(); return; }
      if (id2 !== bchip.id2) { bchip.id2 = id2; bchip2El.classList.remove('gone'); }
      var big = { l: c.x - CHIP_PX / 2, t: c.y - CHIP_PX / 2, r: c.x + CHIP_PX / 2, b: c.y + CHIP_PX / 2 };
      var c2 = chipPlace(render.toScreen(n2.x, n2.y), W, H, bchip.rects.concat([big]), null, CHIP2_PX);
      if (Math.abs(c2.x - bchip.x2) >= 1 || Math.abs(c2.y - bchip.y2) >= 1) {
        bchip.x2 = c2.x; bchip.y2 = c2.y;
        bchip2El.style.left = Math.round(c2.x - CHIP2_PX / 2) + 'px';
        bchip2El.style.top = Math.round(c2.y - CHIP2_PX / 2) + 'px';
      }
    }
    on(bchipEl, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var s = game.state, n = bchip.id !== null ? game.world.nodes[bchip.id] : null;
      if (!n || s.phase !== 'run' || modal()) return;
      emitUI('nodeTap', { id: n.id });   // o tutorial despausa no toque de no (como no mapa)
      if (runTap(s, n, undefined, undefined, true)) {
        // o Boost dura CFG.clear.seconds: o chip nao volta para o mesmo no antes disso (nao queima carga)
        bchip.cool[n.id] = (+s.dayTime || 0) + ((CFG.clear && CFG.clear.seconds) || 6);
        hideChip();
      }
    });
    on(bchip2El, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var s = game.state, n = bchip.id2 !== null ? game.world.nodes[bchip.id2] : null;
      if (!n || s.phase !== 'run' || modal()) return;
      emitUI('nodeTap', { id: n.id });
      if (runTap(s, n)) {
        bchip.cool[n.id] = (+s.dayTime || 0) + ((CFG.clear && CFG.clear.seconds) || 6);
        hideChip2(); bchip.at = -1e9;
      }
    });

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
      try { if (render && render.replayGrow) render.replayGrow(ids); } catch (er) {}
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
    var peekT = 0;
    on(todoEl, 'click', function () {
      var n = todoNode; if (!n) return;
      snd('select');
      try { if (render && render.focus) render.focus(n.x, n.y, Math.max((render.camera && render.camera.zoom) || 1, 1.1), !reducedMotion()); } catch (e) {}
      addPulse(n.x, n.y); later(function () { addPulse(n.x, n.y); }, 900);
      sumEl.classList.add('crz-peek');
      if (peekT) root.clearTimeout(peekT);
      peekT = later(function () { sumEl.classList.remove('crz-peek'); peekT = 0; }, 2600);
      if (todoKind === 'busy') say(STR.todoBusyWhy, 2600);
      emitUI('summaryTodo', { kind: todoKind, id: n.id });
    });
    on(newJEl, 'click', function () {
      var L = newJList(), n = L[0];
      if (!n) return;
      snd('select');
      try { if (render && render.focus) render.focus(n.x, n.y, Math.max((render.camera && render.camera.zoom) || 1, 1.1), !reducedMotion()); } catch (e) {}
      addPulse(n.x, n.y); later(function () { addPulse(n.x, n.y); }, 900);
      // o resumo cobre o mapa: abaixa por ~2 s para a jogadora ver o cruzamento, depois volta
      sumEl.classList.add('crz-peek');
      if (peekT) root.clearTimeout(peekT);
      peekT = later(function () { sumEl.classList.remove('crz-peek'); peekT = 0; }, 2200);
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
        if (focus && render && render.focus) render.focus(n.x, n.y, Math.max((render.camera && render.camera.zoom) || 1, 1.1), !reducedMotion());
      } catch (e) {}
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
      if (ids.length && njDay.tip <= 0 && now - njDay.at >= 1400 && !modal() && !tutorTalking() &&
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
    var confirmBox = el('div', 'crz-cbox'), confirmTxt = el('div', 'crz-ctxt'), confirmRow = el('div', 'crz-crow');
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
      if (confirmAsked.day !== s.day) confirmAsked = { day: s.day, keys: {} };
      var L = assistGet('playConfirm', easyOn()) && !tutorTalking() ? morningList(s) : [];
      if (L.length && signAffordable(s) && !confirmAsked.keys.newj) out.push({ key: 'newj', text: STR.cWhyNew(L.length), node: L[0] });
      if (s.free && s.free.road && !confirmAsked.keys.free) out.push({ key: 'free', text: STR.cWhyFree });
      // invisivel 6: o semaforo gratis tambem some a noite
      if (s.free && s.free.light && !confirmAsked.keys.freelight && (s.tools || []).some(function (x) { return x.id === 'light' && x.unlocked; }) && lightSpot()) out.push({ key: 'freelight', text: STR.cWhyFreeLight });
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
    function confirmOpen() { return !confirmEl.classList.contains('gone'); }
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
        sty.textContent = '.crz-njchip{align-self:center;display:flex;align-items:center;gap:6px;min-height:36px;padding:2px 12px 2px 10px;' +
          'border-radius:18px;border:1.5px dotted #7a6aa8;background:var(--white,#fff);color:#5a4c88;font-size:13px;font-weight:800;pointer-events:auto;position:relative}' +
          '.crz-njchip::before{content:"";width:8px;height:8px;border-radius:50%;background:#7a6aa8;flex:none}' +
          '.crz-njchip::after{content:"";position:absolute;left:50%;top:50%;width:100%;height:100%;min-height:44px;transform:translate(-50%,-50%)}' +
          '.crz-play.crz-ask{box-shadow:0 0 0 3px #7a6aa8}' +
          '@media (prefers-reduced-motion: no-preference){.crz-play.crz-ask{animation:crz-njask 1s ease-in-out 3}}' +
          '@keyframes crz-njask{50%{box-shadow:0 0 0 7px rgba(95,122,150,.35)}}';
        doc.head.appendChild(sty);
      } catch (e) {}
    })();

    // pedido de confirmacao da troca de sinal: {id, tool, free, text}. SEM prazo (passeio da Roberta 2026-11-09:
    // leitora de 3-6 s via o pedido expirar em 6 s e o segundo toque abria um pedido novo, em laco). Fica aberto
    // ate um toque noutro lugar, outra ferramenta ou o dia comecar; faixa fixa e botao Cancel discreto.
    // O segundo toque no MESMO no confirma; toque ao lado (ate SWAP_NEAR x raio de toque) conta como o mesmo no.
    var swapAsk = null, SWAP_MS = 6000, SWAP_NEAR = 1.7, ASK_MS = 864e5;
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
    function listCost(t) { return CFG.tools && CFG.tools[t] ? CFG.tools[t].cost : 0; }
    function swapDown(from, to) {
      var a = SIGN_TIER[from] || 0, b = SIGN_TIER[to] || 0;
      return b < a || (b === a && listCost(to) < listCost(from));
    }
    // a nova ferramenta sai de graca agora (dado ou carta), embora tenha preco de tabela
    function freeNow(t) { return listCost(t) > 0 && toolCost(t) === 0; }
    // custo pago hoje pelo sinal deste no (o game reembolsa): le o save (so neste toque, nunca por quadro)
    function paidToday(id) {
      try { var sv = game.save && game.save(); if (sv && sv.placed) return (+sv.placed[id] || 0) > 0; } catch (e) {}
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
      try { if (typeof game.cost === 'function') return game.cost(t); } catch (e) {}
      return CFG.tools && CFG.tools[t] ? CFG.tools[t].cost : 0;
    }
    function onTap(sx, sy) {
      var s = game.state;
      var hitN = render.pickNode(sx, sy);
      // o pedido de troca vale para o proximo toque no mesmo no (ou ao lado) com a mesma ferramenta
      var askN = s.phase === 'plan' ? askNear(sx, sy) : null;
      if (askN) hitN = askN;
      if (swapAsk && !(hitN && hitN.id === swapAsk.id && sel === swapAsk.tool)) endSwapAsk('tap');
      if (hitN) emitUI('nodeTap', { id: hitN.id });
      if (s.phase === 'run') { runTap(s, hitN, sx, sy); return; }
      if (s.phase !== 'plan') return;
      var n, pk, p;
      if (sel && NODE_TOOLS[sel]) {
        // dois nos sob o dedo: prefere o cruzamento (onde o sinal entra) a ponta de rua
        n = askN || render.pickNode(sx, sy, isJunctionish);
        // dedo caiu na rua ao lado do cruzamento (curva, reta ou nada sob o dedo): ate 1,7x o raio de toque
        // de um no de 3+ ruas, o toque e nele (antes respondia 'Stops, yields and lights need a crossing')
        if (!askN && (!n || (!n.portal && (n.edges ? n.edges.length : 0) < (sel === 'cross' ? 2 : 3)))) n = nearJunction(sx, sy) || n;
        if (!n) { if (render.pickEdge(sx, sy)) { snd('deny'); say(STR.deny.notJunction); } return; }
        // troca de sinal: o comprado em dia anterior nao volta; pede um segundo toque (3 s).
        // O colocado hoje e reembolsado pelo game: troca direto
        // Troca de sinal (2026-11-09): para cima (mesmo custo ou mais caro) troca direto; para baixo (perde
        // valor: Light/Round para Stop/Yield/Crosswalk, ou mais caro para mais barato) pede um segundo toque
        // em 6 s. O sinal colocado hoje e reembolsado pelo game: troca direto
        var was = n.tool && n.tool !== sel && NODE_TOOLS[n.tool] && swapAllowed(s, n, sel) ? n.tool : null;
        // pontos perdidos = preco de tabela do antigo (com o semaforo gratis hoje, toolCost('light') e 0 e a troca
        // para baixo de um semaforo antigo passava sem pedir)
        var paid = was ? paidToday(n.id) : false, lost = was && !paid ? listCost(was) : 0;
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
        if (tr && tr.ok && was && sel === 'cross') {
          // faixa sobre um sinal: diz que troca o sinal e o que a faixa faz (palavras simples)
          say(STR.crossOver(costNow), 5000); showSwapUndo(5000);
        } else if (tr && tr.ok && was) {
          say(STR.swapped(STR.tools[was], STR.tools[sel], costNow, lost, wasFree), 5000);
          showSwapUndo(5000);
        } else if (tr && tr.ok && sel !== 'yield') {
          // retorno imediato: anel no no e a frase 'Stop placed here.'
          addPulse(n.x, n.y); say(STR.placed(STR.tools[sel] || TL[sel] || sel), 1800);
        }
        if (tr && tr.ok && sel === 'yield') yieldBusyHint(s, n);
        // ponta de rua: a fila espera no cruzamento a frente; pulsa ele (o lugar certo do sinal).
        // Sem cruzamento a frente, a frase muda (nada de "pulsing crossing" sem pulso)
        if (tr && !tr.ok && tr.reason === 'portal') {
          var qj = queueJunction(game.world, n, function (o) { return heatOf(s, o); });
          if (qj) { addPulse(qj.x, qj.y); later(function () { addPulse(qj.x, qj.y); }, 900); }
          else say(STR.deny.portalNone);
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
        if (rn && heatOf(s, rn) >= HOT_TAP) {
          snd('select'); addPulse(rn.x, rn.y);
          var ra = sel === 'upgrade' ? nodeAdvice(s, rn) : null;
          if (ra) showAdviceRoad(ra);
          say(ra && ra.tool === 'upgrade' && ra.dir ? STR.ringEdgeLane(ra.dir) : ra ? ra.text : STR.ringEdgeTool);
          emitUI('ringTap', { id: rn.id, tool: sel });
          return;
        }
      }
      if (sel === 'upgrade') {
        pk = render.pickEdge(sx, sy); if (!pk) return;
        p = edgePoint(pk);
        toolResult(game.upgradeRoad(pk.edge.id), p.x, p.y, 'build', 'upgrade');
        return;
      }
      if (sel === 'oneway') {
        pk = render.pickEdge(sx, sy); if (!pk) return;
        p = edgePoint(pk);
        toolResult(game.setOneway(pk.edge.id, nextOneway(pk.edge.oneway || 0, pk.t)), p.x, p.y, 'place', 'oneway');
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
      n = render.pickNode(sx, sy);
      var armed = pairArm && nowMs() < pairArm.until ? pairArm : null;
      if (!n) {
        if (armed) say(STR.pairCancel);
        pairFirst = null; pairArm = null; pairRep = null; hidePairChip(); syncSelectedNode(); showInfluence(null, 0); return;
      }
      showInfluence(n.id, 1500);
      // Parear so depois do chip "Pair lights" (pairArm). Toque normal num semaforo so da a dica e mostra o chip
      if (armed && n.id !== armed.from) { pairTapArmed(armed, n); return; }
      if (armed && n.id === armed.from) { pairArm = null; pairRep = null; say(STR.pairCancel); syncSelectedNode(); }
      if (heatOf(s, n) >= HOT_TAP) say(tapAdvice(s, n));   // anel: diz o que ajuda ali (e qual rua)
      else if (isDeadEnd(n)) say(STR.deadEndTap);
      if (n.tool === 'light') {
        pairFirst = n.id; pairUntil = nowMs() + PAIR_MS; snd('select');
        emitUI('pairTap', { id: n.id });
        showPairChip(n);
        syncSelectedNode();
      } else { pairFirst = null; hidePairChip(); syncSelectedNode(); snd('select'); }
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
      if (!otherLight(n.id) || !render) { hidePairChip(); return; }
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
      var av = (pchip.rects || []).slice(), q, m, mp;
      for (q in game.world.nodes) if (game.world.nodes.hasOwnProperty(q)) {
        m = game.world.nodes[q]; if (!m || m.id === n.id || !(m.edges && m.edges.length >= 2)) continue;
        mp = render.toScreen(m.x, m.y);
        if (Math.abs(mp.x - p.x) < PCHIP_W + 60 && Math.abs(mp.y - p.y) < PCHIP_H + 60) av.push({ l: mp.x - 18, t: mp.y - 18, r: mp.x + 18, b: mp.y + 18 });
      }
      var c = pillPlace(p, W, H, av, PCHIP_W, PCHIP_H, pchip.side);
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
    function unlockAudio() { if (audio && audio.unlock) { try { audio.unlock(); } catch (e) {} } }
    var nopass = { passive: false }, pass = { passive: true, capture: true };
    on(doc, 'pointerdown', unlockAudio, true);
    on(doc, 'pointerdown', function () {
      lastTouchAt = nowMs();
      // faixa de dica do tutorial: some no primeiro toque
      if (stripOn && sayUntil) { stripOn = false; sayUntil = 0; sayEl.classList.remove('show'); }
    }, true);
    on(doc, 'pointerup', unlockAudio, true);
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
      camHold(true);
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
      if (modal() || confirmOpen()) return;   // A3: com a folha aberta o Play (e Enter/espaco nele) nao faz nada
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
        if (tuP && tuP.blocksPlay && tuP.blocksPlay()) { snd('deny'); try { tuP.bump(); } catch (e) {} emitUI('playBlocked', { reason: 'tutorial' }); return; }
        // playtest as cegas: as confirmacoes viraram UMA folha visivel com dois botoes grandes (nunca 'toque de novo')
        if (confirmPlay(s)) return;
        startDayNow(s);
      } else if (s.phase === 'run') {
        runSpeedTap(s);
      }
    });
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
        if (tuL && tuL.speedLocked && tuL.speedLocked()) { snd('deny'); try { tuL.bump(); } catch (e) {} return; }
        // balao com Got it aberto (que nao e o da velocidade): o botao nao faz nada, o balao pula
        var tuS = CRZ.app && CRZ.app.tutorial;
        if (tuS && tuS.blocksPlay && tuS.blocksPlay()) { snd('deny'); try { tuS.bump(); } catch (e) {} return; }
        game.setSpeed(nextSpeed(s.speed, speeds)); snd('select'); speedChosen = game.state.speed;
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
      if (okU) { game.undo(); snd('undo'); } else snd('deny');
      emitUI('undoPressed', { ok: okU });
    });
    // o que o Undo desfez, por comparacao antes/depois (o game nao guarda o nome da acao)
    function undoSnap() {
      var w = game.world, o = { e: 0, tools: {}, lanes: {}, ow: {}, die: game.state.die ? game.state.die.id + ':' + game.state.die.value : '', b: game.state.budget | 0 }, k;
      for (k in w.edges) if (w.edges.hasOwnProperty(k) && w.edges[k]) { o.e++; o.lanes[k] = w.edges[k].lanes || 1; o.ow[k] = w.edges[k].oneway || 0; }
      for (k in w.nodes) if (w.nodes.hasOwnProperty(k) && w.nodes[k]) o.tools[k] = w.nodes[k].tool || '';
      return o;
    }
    function undoLabel(a, b) {
      var k;
      for (k in a.tools) if (a.tools.hasOwnProperty(k) && a.tools[k] && a.tools[k] !== (b.tools[k] || '')) return STR.tools[a.tools[k]] || a.tools[k];
      if (a.e > b.e) return STR.tools.road;
      for (k in a.lanes) if (a.lanes.hasOwnProperty(k) && b.lanes[k] !== undefined && a.lanes[k] > b.lanes[k]) return STR.tools.upgrade;
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
      else { snd('deny'); shake(undoBtn); }
      emitUI('undoPressed', { ok: okU });
    });
    on(fitBtn, 'click', onFit);
    on(newBtn, 'click', function () {
      if (newArmed > 0) { restart(); return; }
      newArmed = 5000; newBtn.classList.add('armed'); snd('select');
      newBtn.setAttribute('aria-label', STR.confirmNew);
    });
    on(againBtn, 'click', function () { restart(); });
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
    infoTap(budgetEl, function (s) { return STR.info.budget(s.budget | 0); });
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
    });

    // ---- dado do dia: folha com hoje, amanha e relancar ----
    function reducedMotion() {
      try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
    }
    function positionSheet() {
      try {
        var h = bottom.getBoundingClientRect().height || 0;
        if (ui.style && ui.style.setProperty) ui.style.setProperty('--sheetb', Math.round(clamp(h, 0, 260) + 8) + 'px');
      } catch (e) {}
    }
    function rerollInfo(s) {
      var cost = (CFG.dice && CFG.dice.rerollCost) || 1, avail = typeof game.rerollDie === 'function' && typeof game.canReroll === 'function';
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
    // ultimo dia: nao existe amanha, entao nenhuma promessa de amanha
    function lastDayOf(s) { return (s.day | 0) >= CFG.maxDays; }
    function refreshSheet(s) {
      if (!sheetOpen || !s.die) return;
      var ri = rerollInfo(s), hasNext = s.phase === 'plan' && !!s.nextDie && !lastDayOf(s);
      var key = [s.die.id, s.die.value, s.die.faces, s.nextDie ? s.nextDie.id + ':' + s.nextDie.value : '-', s.phase, s.rerolled ? 1 : 0, s.budget].join('|');
      if (key === sheetKey) return;
      sheetKey = key;
      todayName.textContent = STR.today + ': ' + dieName(s.die.id);
      todayIco.innerHTML = eventSvg(s.die.id, s.die.kind);
      tomIco.innerHTML = hasNext ? eventSvg(s.nextDie.id, s.nextDie.kind) : '';
      todayDesc.textContent = describeDie(s.die);
      tomBox.classList.toggle('off', !hasNext);
      if (hasNext) { tomName.textContent = STR.tomorrow + ': ' + dieName(s.nextDie.id); tomDesc.textContent = describeDie(s.nextDie).replace(/ today\./g, ' tomorrow.'); }
      rerollBtn.classList.toggle('gone', !ri.avail);
      // botao proprio e curto no painel do dado: 'Reroll (1)' = custa 1 ponto (o aria diz por extenso)
      // 'Reroll (1)' parecia contagem de relances: o custo escrito
      rerollBtn.textContent = STR.rerollLbl(ri.cost);
      rerollBtn.setAttribute('aria-label', STR.rerollAria(ri.cost));
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
      if (ROLL_ON && game.state.phase === 'plan' && game.state.die && (game.state.day | 0) >= 2) { if (sheetOpen) closeSheet(); rollOpen(false); return; }
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
        snd('deny'); shake(rerollBtn); emitUI('dieReroll', { ok: false }); return;
      }
      var r = game.rerollDie(), okR = !!(r && r.ok);
      if (okR) snd('place'); else { snd('deny'); shake(rerollBtn); }
      sheetKey = ''; refreshSheet(game.state);
      emitUI('dieReroll', { ok: okR });
    });
    // ---- rolagem visivel do dado (Arthur, 2026-11-10): no comeco do plano de cada dia com dado ----
    // folha central por cima do mapa escurecido: o dado grande entra quicando (~1,2 s) e para no numero;
    // depois o efeito grande e colorido, amanha pequeno, Reroll secundario e Continue. Um toque pula a
    // animacao, o 2o continua. Dia normal fecha sozinho em 2 s. Uma vez por dia por partida (hints '@seed').
    var ROLL_ANIM_MS = 1200;
    var rollEl = el('div', 'crz-roll gone'); rollEl.setAttribute('role', 'dialog'); rollEl.setAttribute('aria-modal', 'true');
    rollEl.setAttribute('aria-label', STR.rollTitle);
    var rollBox = tut(el('div', 'crz-rollbox'), 'roll');
    var rollDie = el('div', 'crz-rolldie'), rollTapEl = el('div', 'crz-rolltap gone'), rollFx = el('div', 'crz-rollfx'), rollTutEl = el('div', 'crz-rolltut gone');
    var rollTom = el('div', 'crz-rolltom'), rollNote = el('div', 'crz-rollnote');
    var rollRow = el('div', 'crz-rollrow');
    var rollReroll = tut(el('button', 'crz-rollreroll'), 'roll-reroll'), rollGo = tut(el('button', 'crz-rollgo'), 'roll-continue');
    rollGo.textContent = STR.rollContinue;
    var rollLive = el('div', 'crz-sr'); rollLive.setAttribute('aria-live', 'polite');
    rollRow.appendChild(rollReroll); rollRow.appendChild(rollGo);
    rollDie.setAttribute('role', 'button'); rollDie.setAttribute('tabindex', '0'); rollDie.setAttribute('aria-label', STR.rollAria);
    rollTapEl.textContent = STR.rollTap;
    rollBox.appendChild(rollDie); rollBox.appendChild(rollTapEl); rollBox.appendChild(rollFx); rollBox.appendChild(rollTutEl); rollBox.appendChild(rollTom);
    rollBox.appendChild(rollRow); rollBox.appendChild(rollNote); rollBox.appendChild(rollLive);
    rollEl.appendChild(rollBox); ui.appendChild(rollEl);
    // Arthur 2026-11-10: quem rola e a jogadora. 'ready' = dado parado, 'Tap to roll'; o resultado ja veio do jogo
    var ROLL_WIGGLE_MS = 8000;
    var roll = { open: false, stage: '', t0: 0, resAt: 0, autoAt: 0, spinAt: 0, normal: false, mine: false, readyAt: 0 };
    function rollKey(d) { return 'roll' + d + runTag; }
    function rollSeen(d) { return !!hints[rollKey(d)]; }
    function rollMark(d) { hints[rollKey(d)] = 1; lsSet(HINT_KEY, JSON.stringify(hints)); }
    function rollFxText(die) {
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
    function rollPaint(s, value) {
      var D = s.die; if (!D) return;
      rollDie.innerHTML = bigDieSvg(value, D.faces, D.kind);
    }
    function rollResultPaint(s) {
      var D = s.die; if (!D) return;
      var tone = kindTone(D.kind), fx = rollFxText(D);
      rollPaint(s, D.value);
      rollFx.textContent = fx; rollFx.className = 'crz-rollfx tone-' + tone;
      var hasNext = !!s.nextDie && !lastDayOf(s);
      rollTom.textContent = hasNext ? STR.lblTomorrow(s.nextDie.id, s.nextDie.value) : '';
      var ri = rerollInfo(s);
      rollReroll.classList.toggle('gone', !ri.avail);
      rollReroll.textContent = STR.rerollLbl(ri.cost);
      rollReroll.setAttribute('aria-label', STR.rerollAria(ri.cost));
      rollReroll.classList.toggle('off', !!ri.reason);
      rollReroll.setAttribute('aria-disabled', ri.reason ? 'true' : 'false');
      rollNote.textContent = ri.avail && ri.reason ? (rushShort(s, ri) || ri.reason) : '';
      var fxs = fx.replace(/^Today: /, '').replace(/^Normal day: no change$/, 'Normal day');
      rollLive.textContent = STR.rollLive(D.value, fxs.charAt(0).toUpperCase() + fxs.slice(1));
      rollTutEl.classList.add('gone');   // a linha do tutorial ('Tap the dice') sai depois de rolar
      roll.normal = D.id === 'plain' || tone === 'ink';
    }
    function rollAnyModal() {
      var menuAny = false; try { menuAny = !!(CRZ.app && CRZ.app.menu && CRZ.app.menu.isOpenAny && CRZ.app.menu.isOpenAny()); } catch (e) {}
      return menuAny || !!guideEl || confirmOpen() || sheetOpen;
    }
    function rollOpen(animate) {
      var s = game.state; if (!s.die || roll.open) return;
      roll.open = true; ffOff();
      roll.mine = !(doc.body && doc.body.classList && doc.body.classList.contains('crz-modal'));
      if (doc.body && doc.body.classList) doc.body.classList.add('crz-modal');
      rollEl.classList.remove('gone'); rollEl.classList.toggle('crz-rm', reducedMotion());
      var tutLine = !seen('rollAny') && tutorScript();
      rollTutEl.textContent = STR.rollTut; rollTutEl.classList.toggle('gone', !tutLine);
      markSeen('fu:die');
      emitUI('dieOpen', { roll: true });
      if (animate) rollReady(); else rollResult(false);
    }
    function rollReady() {
      var s = game.state;
      roll.stage = 'ready'; roll.readyAt = nowMs(); roll.autoAt = 0;
      rollEl.classList.remove('crz-rolling'); rollEl.classList.remove('crz-rolled'); rollEl.classList.add('crz-rollready');
      rollDie.classList.remove('crz-rollwiggle'); rollDie.classList.remove('crz-rollin');
      rollDie.innerHTML = bigDieSvg((s.die && s.die.faces > 6) ? '?' : 5, (s.die && s.die.faces) || 6, 'plain');
      rollTapEl.classList.remove('gone');
      rollFx.textContent = ''; rollTom.textContent = ''; rollNote.textContent = '';
      rollRow.classList.add('crz-hide'); rollGo.setAttribute('tabindex', '-1');
      rollLive.textContent = STR.rollTap;
      try { if (rollDie.focus) rollDie.focus(); } catch (e) {}
    }
    function rollAnim() {
      var s = game.state, now = nowMs();
      // rolou: este dia nao volta para 'Tap to roll' ao recarregar
      markSeen('rollAny'); rollMark(s.day | 0);
      rollEl.classList.remove('crz-rollready'); rollTapEl.classList.add('gone'); rollDie.classList.remove('crz-rollwiggle');
      roll.stage = 'anim'; roll.t0 = now; roll.spinAt = 0; roll.autoAt = 0;
      rollEl.classList.add('crz-rolling'); rollEl.classList.remove('crz-rolled');
      rollFx.textContent = ''; rollTom.textContent = ''; rollNote.textContent = '';
      rollRow.classList.add('crz-hide'); rollGo.setAttribute('tabindex', '-1');
      rollDie.classList.remove('crz-rollin'); void rollDie.offsetWidth; rollDie.classList.add('crz-rollin');
      rollPaint(s, 1 + Math.floor(Math.random() * ((s.die && s.die.faces) || 6)));
      if (reducedMotion()) rollResult(true);
    }
    function rollResult(sound) {
      var s = game.state;
      roll.stage = 'result'; roll.resAt = nowMs();
      rollEl.classList.remove('crz-rolling'); rollEl.classList.add('crz-rolled');
      rollDie.classList.remove('crz-rollin');
      rollResultPaint(s);
      rollRow.classList.remove('crz-hide'); rollGo.removeAttribute('tabindex');
      try { if (rollGo.focus) rollGo.focus(); } catch (e) {}
      if (sound) snd('dice');
      roll.autoAt = 0;   // a jogadora rolou: o resultado espera o Continue (ou um toque), tambem no dia normal
    }
    function rollClose() {
      if (!roll.open) return;
      roll.open = false; roll.stage = '';
      rollEl.classList.add('gone'); rollEl.classList.remove('crz-rolling'); rollEl.classList.remove('crz-rolled');
      if (roll.mine && doc.body && doc.body.classList && !rollAnyModal()) doc.body.classList.remove('crz-modal');
      emitUI('rollClosed', {});
    }
    function rollScreenTick(s, now) {
      if (roll.open) {
        if (s.phase !== 'plan') { rollClose(); return; }
        if (roll.stage === 'anim') {
          if (now - roll.t0 >= ROLL_ANIM_MS) rollResult(true);
          else if (now - roll.spinAt >= 90) { roll.spinAt = now; rollPaint(s, 1 + Math.floor(Math.random() * ((s.die && s.die.faces) || 6))); }
        } else if (roll.stage === 'ready' && now - roll.readyAt >= ROLL_WIGGLE_MS && !rollDie.classList.contains('crz-rollwiggle')) {
          rollDie.classList.add('crz-rollwiggle');   // convite: balanca de leve, nunca rola sozinho
        }
        return;
      }
      if (!ROLL_ON || s.phase !== 'plan' || !s.die || (s.day | 0) < 2 || rollSeen(s.day | 0)) return;
      if (bootFrames >= 0 || holdUntil || rollAnyModal() || modal()) return;
      rollOpen(true);
    }
    // toque em qualquer lugar: na animacao pula para o resultado; no resultado continua (fora o Reroll)
    on(rollEl, 'click', function (e) {
      if (!roll.open) return;
      if (e && e.target && (e.target === rollReroll)) return;
      if (roll.stage === 'ready') { rollAnim(); return; }
      if (roll.stage === 'anim') { rollResult(true); return; }
      rollClose();
    });
    on(rollGo, 'click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); rollClose(); });
    on(rollReroll, 'click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (roll.stage !== 'result') return;
      var s = game.state, ri = rerollInfo(s);
      if (rollReroll.classList.contains('off') || !ri.avail) { snd('deny'); shake(rollReroll); emitUI('dieReroll', { ok: false }); return; }
      var r = game.rerollDie(), okR = !!(r && r.ok);
      emitUI('dieReroll', { ok: okR });
      if (!okR) { snd('deny'); shake(rollReroll); return; }
      rollAnim();
    });
    on(doc, 'keydown', function (e) {
      if (!e || !roll.open) return;
      if (roll.stage === 'ready' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { pd(e); rollAnim(); return; }
      if (e.key === 'Escape') { if (roll.stage === 'anim') rollResult(true); else rollClose(); }
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
    var sumShownAt = 0, sumQuietFrom = 0, sumPrevTap = 0, sumLastTap = 0, sumArm = null, sumArmUntil = 0, SUM_DEAD = 1200, SUM_SERIES = 600;
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
    }
    function restart() {
      if (CRZ.app && CRZ.app.restart) { CRZ.app.restart(); return; }
      beginLeave();
      try { root.location.reload(); } catch (e) {}
    }

    // ---- bandeja ----
    // custo no ladrilho: o numero (jogador-so-tela 2026-11-09: os pontinhos nao diziam 'custa 2'); gratis: 'free'
    function toneCost(n) {
      if (n <= 0) return '<b class="free">free</b>';
      return '<b>' + n + '</b>';
    }
    function rebuildTray(s) {
      tilesEl.innerHTML = '';
      tiles = {};
      var i;
      for (i = 0; i < s.tools.length; i++) {
        (function (t) {
          if (!t.unlocked) return;
          var b = tut(el('button', 'crz-tile', toolIcon(t.id)), 'tool-' + t.id);
          b.setAttribute('aria-label', STR.tools[t.id] || t.id);
          var cost = el('div', 'crz-cost');
          b.appendChild(cost);
          tilesEl.appendChild(b);
          b.setAttribute('data-tool', t.id);   // o clique chega por delegacao em tilesEl
          tiles[t.id] = { el: b, cost: cost, c: -1, poor: null, sel: null, hint: null };
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
      if (!sumGate(b)) return;
      var idx = +b.getAttribute('data-card');
      picked = true;
      snd('card');
      var r = game.pickCard(idx);
      if (r && r.ok === false) { picked = false; snd('deny'); shake(b); }
      else emitUI('cardPicked', { index: idx });
    });
    function onTile(id) {
      if (modal()) return;
      var s = game.state;
      if (s.phase !== 'plan') return;
      if (sel === id) { setSel(null); snd('select'); return; }
      var info = null, i;
      for (i = 0; i < s.tools.length; i++) if (s.tools[i].id === id) info = s.tools[i];
      if (info && !info.afford) {
        snd('deny'); shake(tiles[id].el);
        say(denyText({ reason: 'budget' }, id, s, CFG, typeof info.cost === 'number' ? info.cost : undefined));
        return;
      }
      setSel(id); snd('select');
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
        // a rua ganha o nome ('Road') ao lado do custo: so o icone nao dizia o que era
        if (c !== tl.c) { tl.c = c; tl.cost.innerHTML = (t.id === 'road' && c > 0 ? '<span class="crz-tname">' + STR.roadTile + '</span>' : '') + toneCost(c); }   // final check 6: 'Road free' estourava o ladrilho; gratis mostra so 'free'
        var poor = !t.afford;
        if (poor !== tl.poor) { tl.poor = poor; tl.el.classList.toggle('poor', poor); }
        // rua gratis do dia ainda nao usada: o ladrilho Road pulsa (o 'free' ja aparece no custo)
        // blind3 2: o destaque verde so com a ferramenta armada (verde sem estar na mao parecia armado)
        var fr = t.id === 'road' && !!(s.free && s.free.road) && s.phase === 'plan' && sel === 'road';
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
    function drawDie(die, value) {
      diePips.innerHTML = dieSvg(value, die.faces, die.kind);
      dieEv.innerHTML = eventSvg(die.id, die.kind);
      dieLbl.textContent = STR.lblToday(die.id, die.kind, die.value);
      if (diePips.firstChild && diePips.firstChild.setAttribute) diePips.firstChild.setAttribute('class', 'pips');
      if (dieEv.firstChild && dieEv.firstChild.setAttribute) dieEv.firstChild.setAttribute('class', 'ev');
    }
    function syncTop(s) {
      var i;
      if (cache.day !== s.day || cache.phase !== s.phase) {
        for (i = 0; i < dotEls.length; i++) {
          var past = i + 1 < s.day;   // passados cheios, o dia atual com anel (tambem no resumo e na derrota), futuros vazios
          var now = i + 1 === s.day;
          dotEls[i].className = 'crz-dot' + (past ? ' past' : (now ? ' now' : ''));
          if (now) dayLbl.textContent = STR.lblDay(s.day | 0, CFG.maxDays);
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
      var D = s.die, dc = cache.dieF;
      if (D ? (!dc || dc.faces !== D.faces || dc.value !== D.value || dc.id !== D.id || dc.kind !== (D.kind || '')) : dc !== null) {
        var had = !!dc;
        cache.dieF = D ? { faces: D.faces, value: D.value, id: D.id, kind: D.kind || '' } : null;
        if (s.die) {
          drawDie(s.die, s.die.value);
          dieEl.classList.remove('off');
          dieEl.setAttribute('data-kind', s.die.kind || 'plain');
          dieEl.setAttribute('aria-label', STR.dieLabel + ': ' + dieName(s.die.id));
          if (had && !reducedMotion()) { rollMs = 400; rollTick = 0; dieEl.classList.add('rolling'); }
          else { rollMs = 0; dieEl.classList.remove('rolling'); }
        } else { dieEl.classList.add('off'); rollMs = 0; }
      }
      // previsao: so no planejamento e quando o game informa o dia seguinte (some no dia 12)
      var N = (s.phase === 'plan' && s.nextDie && !dieHide && !lastDayOf(s)) ? s.nextDie : null, nc = cache.nextF;
      if (N ? (!nc || nc.faces !== N.faces || nc.value !== N.value || nc.kind !== (N.kind || '') || nc.id !== N.id) : nc !== null) {
        cache.nextF = N ? { faces: N.faces, value: N.value, kind: N.kind || '', id: N.id } : null;
        if (N) {
          // amanha: o icone do efeito (o numero tirado, '13' no d20, parecia o efeito) e o efeito em palavras
          dieNext.innerHTML = eventSvg(s.nextDie.id, s.nextDie.kind);
          nextLbl.textContent = STR.lblTomorrow(s.nextDie.id, s.nextDie.value);
          if (dieNext.firstChild && dieNext.firstChild.setAttribute) dieNext.firstChild.setAttribute('class', 'nxt');
          dieNext.classList.remove('off');
        } else dieNext.classList.add('off');
      }
      refreshSheet(s);
      if (cache.strikes !== s.strikes) {
        for (i = 0; i < strikeEls.length; i++) strikeEls[i].classList.toggle('on', i < s.strikes);
        strikesEl.setAttribute('aria-label', 'Strikes: ' + (s.strikes | 0) + ' of ' + CFG.maxStrikes);
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
      if (cid !== chipKey) {
        chipKey = cid;
        chipEl.innerHTML = cid ? cardIcon(cid) + '<span>' + STR.cardToday(STR.cards[cid]) + '</span>' : '';
        chipEl.setAttribute('aria-label', cid ? STR.cardToday(STR.cards[cid]) + '. ' + STR.cardLine[cid] : '');
        chipEl.classList.toggle('gone', !cid);
        layoutDirty = true;
      }
      // orcamento
      if (cache.day !== s.day || cache.phase !== s.phase) {
        if (s.phase === 'plan' && cache.phase !== 'plan' || cache.day !== s.day) budgetCap = s.budget;
      }
      if (s.budget > budgetCap) budgetCap = s.budget;
      if (cache.budget !== s.budget || cache.cap !== budgetCap) {
        // pontos sempre visiveis (ate 12; com 7+ ficam menores) e o numero ao lado: antes, com 7+, virava
        // uma bolinha so ('● 7') e o novato lia como os dias
        // ate 8: os pontos (menores a partir de 7) e o numero; acima de 8 so o numero (a fileira ficava longa)
        var h = '', n = budgetCap > 8 ? 0 : budgetCap, small = budgetCap > 6;
        for (i = 0; i < n; i++) h += '<span class="crz-pt' + (i < s.budget ? ' full' : '') + (small ? ' sm' : '') + '"></span>';
        // o numero (maior e mais forte que o rotulo do dado) e o rotulo fixo 'Build points' em cima
        h += '<b class="crz-ptn">' + (s.budget | 0) + '</b><span class="crz-lbl crz-lbl-bp" aria-hidden="true">' + STR.lblBp + '</span>';
        budgetEl.innerHTML = h;
      }
      var cu = s.phase === 'plan' && game.canUndo();
      if (cu !== cache.undo) { undoBtn.classList.toggle('off', !cu); }
      cache.day = s.day; cache.phase = s.phase; cache.strikes = s.strikes; cache.speed = s.speed; 
      cache.budget = s.budget; cache.cap = budgetCap; cache.undo = cu;
    }

    // ---- resumo e fim ----
    function buildSummary(s) {
      var sm = s.summary || {}, i;
      picked = false;
      var hl = sm.headline || '';
      headEl.textContent = hl; headEl.classList.toggle('gone', !hl);
      bigEl.textContent = String(sm.delivered | 0);
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
      // "Worst queue": o pico de estresse do dia (o anel mais cheio), nao a espera media
      var ratio = clamp(+sm.peak || 0, 0, 1);
      waitFill.style.width = Math.round(ratio * 100) + '%';
      waitFill.className = ratio >= RING_SEEN ? 'warn' : '';
      // tela baixa (<= 700 px, CSS): fila calma (pico < 0,3) nao ocupa linha
      queueRow.classList.toggle('crz-lowq', ratio < 0.3); queueInfo.classList.toggle('crz-lowq', ratio < 0.3);
      for (i = 0; i < sStrikeEls.length; i++) sStrikeEls[i].classList.toggle('on', i < s.strikes);
      var bTxt = '', pp = (s.speedDial && s.speedDial.perPoint) || (CFG.speedDial && CFG.speedDial.tipsPerPoint) || 0;
      // barra do bonus: cheia quando rendeu ponto; senao o resto acumulado de 0 a perPoint (bate com "N of 30")
      var bfr = sm.speedBonus > 0 ? 1 : (pp > 0 ? clamp((+sm.tipCarry || 0) / pp, 0, 1) : 0);
      bonusFill.style.width = Math.round(bfr * 100) + '%';
      bonusFill.className = 'ok';
      bonusRow.classList.toggle('gone', !(pp > 0));
      if (sm.speedBonus > 0) bTxt = STR.speedBonusYes + sm.speedBonus + (sm.speedBonus === 1 ? ' build point' : ' build points') + (lastDayOf(s) ? '' : STR.speedBonusTail);
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
      bonusVal.textContent = sm.speedBonus > 0 ? STR.bvalPlus(sm.speedBonus, lastDayOf(s)) : (pp > 0 ? Math.min(pp - 1, Math.floor(+sm.tipCarry || 0)) + '/' + pp : '');
      // (A1) strikes no resumo so no dia que teve strike (os circulos ja estao no topo)
      strikeRow.classList.toggle('gone', !sm.failed);
      var half = (s.day | 0) === 6 && !seen('half6');
      if (half) markSeen('half6');
      halfEl.textContent = half ? STR.halfway : ''; halfEl.classList.toggle('gone', !half);
      // (A3) explicacoes: abertas no primeiro resumo da partida, depois atras do (i)
      var firstSum = !seen('sumInfo'); if (firstSum) markSeen('sumInfo');
      for (i = 0; i < infoRows.length; i++) setInfo(infoRows[i], firstSum);
      var carryN = lastDayOf(s) ? 0 : Math.min(s.budget | 0, CFG.carryCap != null ? CFG.carryCap : 3);
      carryEl.textContent = carryN > 0 ? STR.carryOver(carryN) : '';
      carryEl.classList.toggle('gone', !(carryN > 0));
      bonusEl.classList.toggle('lost', !(sm.speedBonus > 0));
      // pior ponto do dia (o anel tracejado no mapa) e o que ajuda ali amanha
      var worst = worstNode(s, game.world), wh = worst ? heatOf(s, worst) : 0;
      var jTxt = '';
      if (worst && wh >= JAM_SUMMARY && !lastDayOf(s)) {
        var jp = jamPick(worst, (s.day | 0) + 1, CFG, game.world, null, function (o) { return heatOf(s, o); }, true, adviceCtx(s, worst, true), adviceMemo);
        // nivel ambar (sem vermelho): o pior ponto ganha anel tracejado amanha; 'Red ring' so se ficou vermelho
        if (jp) jTxt = STR.jam.summary + (wh > RING_RED ? '' : STR.jam.dashed) + jp.text;
      }
      jamEl.textContent = jTxt; jamEl.classList.toggle('gone', !jTxt);
      // resumo do ultimo dia (antes da vitoria): uma linha de fechamento no lugar da dica de amanha
      // (o game hoje vai do dia 12 direto ao fim, sem resumo: a linha de fechamento sai tambem na vitoria;
      // no resumo do dia 11 a linha avisa que amanha e o ultimo dia)
      var cTxt = lastDayOf(s) ? STR.closing(s.day | 0, (s.totalDelivered | 0) || (sm.delivered | 0))
        : ((s.day | 0) === CFG.maxDays - 1 ? STR.tomorrowLast : '');
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
      // Arthur 2026-11-10: 'Faster cars' e 'Double green wave' sairam do jogo (RETIRED); se um sorteio antigo trouxer, nao aparecem
      function shownCard(id) { return !RETIRED[id] && !(id === 'freeLight' && (dieFL || !lightTomorrow)) && !(id === 'patient' && !ringEver); }
      var nShown = dr.filter(shownCard).length;
      cardsHead.classList.toggle('gone', !nShown);
      // sem cartas o botao e o unico caminho adiante: "Continue", nao "Skip reward"
      skipBtn.textContent = nShown ? STR.skip : STR.cont;
      skipBtn.classList.toggle('only', !nShown);
      var pk = Math.max(+sm.peak || 0, wh);
      var cctx = { day: s.day | 0, cfg: CFG, pairs: pairCount(game.world), dieFreeLight: dieFL };
      var pick = suggestCard(dr, pk, worst, cctx);
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
          var ln = el('span', 'crz-cline'); ln.textContent = STR.cardLine[id] || '';
          var gd = el('span', 'crz-cgood');
          // (A6) 'Good if...' so nos 3 primeiros resumos da partida (aprendizado); depois titulo + efeito
          gd.textContent = (s.day | 0) <= 3 ? ((!cardFits(id, pk, cctx) && STR.cardGoodNo[id]) || STR.cardGood[id] || '') : '';
          if (!gd.textContent) gd.classList.add('gone');
          if (id === pick) { var tg = el('i', 'crz-ctag'); tg.textContent = STR.cardSuggest; nm.appendChild(tg); }
          tx.appendChild(nm); tx.appendChild(ln); tx.appendChild(gd);
          b.appendChild(tx);
          b.setAttribute('aria-label', (STR.cards[id] || id) + '. ' + (STR.cardLine[id] || ''));
          b.setAttribute('data-card', String(idx));   // clique por delegacao em cardsEl
          cardsEl.appendChild(b);
        })(dr[i], i);
      }
    }
    function buildOver(s) {
      var f = s.final || {};
      var win = typeof f.win === 'boolean' ? f.win : (overWin === null ? (s.strikes < CFG.maxStrikes) : overWin);
      var days = f.days != null ? f.days : s.day, deliv = f.delivered != null ? f.delivered : s.totalDelivered;
      var stk = f.strikes != null ? f.strikes : s.strikes;
      statNums[0].textContent = String(days | 0); statNums[1].textContent = String(deliv | 0); statNums[2].textContent = String(stk | 0);
      overTitle.textContent = win ? STR.win : STR.lose;
      // primeira vitoria no Easy: 'Try Normal' (contorno, abaixo de Play again)
      var dName = (CRZ.difficulty && CRZ.difficulty.name) || CFG.difficultyName || 'easy';
      tryNormalBtn.classList.toggle('gone', !(win && dName === 'easy' && !seen('tryNormal') && CRZ.difficulty && typeof CRZ.difficulty.set === 'function'));
      // derrota com causa: qual cruzamento travou e o que tentar (sem no travado: frase antiga)
      var lockN = win ? null : lockedNodeOf(s, game.world);
      overSub.textContent = win ? (stk === 0 ? STR.winFlawless : stk === 1 ? STR.winOne(days | 0) : STR.winMany(stk | 0))
        : (lockN ? loseText(lockN, days, CFG, lockN.edges ? game.world : null, function (o) { return heatOf(s, o); }, { budget: s.budget | 0 }) : (STR.loseSub1 + (days | 0) + STR.loseSub2));
      var oc = win && (days | 0) >= CFG.maxDays ? STR.closing(days | 0, deliv | 0) : '';
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
      overHard.textContent = (stk > 0 && tD > 0) ? STR.toughDay(tD) : '';
      overHard.classList.toggle('gone', !(stk > 0 && tD > 0));
      overDays.innerHTML = '';
      var nBad = 0;
      for (hi = 0; hi < hs2.length; hi++) {
        var sq = el('i', 'crz-oday' + (hs2[hi].failed ? ' bad' : ''));
        if (hs2[hi].failed) nBad++;
        overDays.appendChild(sq);
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
      if (s.phase === 'plan') { mapTouched = false; planTools = toolSnap(); }
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
        try { if (render && render.focus) render.focus(lk.x, lk.y, Math.max((render.camera && render.camera.zoom) || 1, 1.15), true); } catch (e) {}
        addPulse(lk.x, lk.y); later(function () { addPulse(lk.x, lk.y); }, 1000);
        say(STR.lockedSay);
        refitOnPlan = true;
      }
      ui.classList.toggle('crz-hold', !!holdUntil);
      sumEl.classList.toggle('show', s.phase === 'summary' && !holdUntil);
      overEl.classList.toggle('show', s.phase === 'over' && !holdUntil);
      if (s.phase === 'plan' && refitOnPlan) { refitOnPlan = false; try { if (render && render.fit) render.fit(true); } catch (e) {} }
      if (s.phase !== 'plan') { setSel(null); clearGhost(); showInfluence(null, 0); }
      if (s.phase === 'summary') {
        // o aviso do primeiro gasto (do plano) nao entra no painel do resumo
        if (sayUntil && /^You spent /.test(sayEl.textContent)) { sayUntil = 0; sayEl.classList.remove('show'); }
        buildSummary(s); moreClock = 0; later(syncMore, 80);
      }
      if (s.phase === 'over') buildOver(s);
      if (s.phase === 'plan') { hint = null; layoutDirty = true; showDayBanner(s); planWarn(s); }
    }
    // entrada no plano: penultimo strike (o proximo encerra a partida) e ultimo dia. Uma vez por strike / dia
    var warned = { strikes: -1, last: -1 };
    function planWarn(s) {
      var M = CFG.maxStrikes | 0, k = s.strikes | 0;
      if (M > 1 && k === M - 1 && warned.strikes !== k) { warned.strikes = k; say(STR.strikeWarn, 3800); announce(STR.strikeWarn); return; }
      if (lastDayOf(s) && warned.last !== (s.day | 0)) { warned.last = s.day | 0; say(STR.lastDay(s.day | 0, CFG.maxDays), 3200); }
    }
    function syncLastChip(s) {
      var on = lastDayOf(s) && (s.phase === 'plan' || s.phase === 'run');
      if (on === lastChipEl.classList.contains('gone')) lastChipEl.classList.toggle('gone', !on);
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
      } catch (e) {}
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
      // invisivel 5: carga do raio que voltou (dias 1 a 3): pop na bolinha e um som curto
      else if (ev.type === 'boostReady') { snd('charge'); boltPopAt = nowMs(); }
      // invisivel 8: carro que desistiu (sem rota): '-1' cinza na ponta, so nos dias de dicas (ate o dia 6)
      else if (ev.type === 'lost' && (game.state.day | 0) <= 6) {
        var ln = game.world && game.world.nodes ? game.world.nodes[ev.nodeId] : null;
        try { if (ln && render && render.note) render.note(ln.x, ln.y, '-1', 'gray'); } catch (e) {}
      }
      else if (ev.type === 'ffEnd') onFFEnd(ev);
      else if (ev.type === 'built' && ev.kind === 'road') onPlanEdit();
      else if (ev.type === 'unlock') {
        if (ev.tool === 'clear') pend.clear = true;
      }
      else if (ev.type === 'over') { overWin = !!ev.win; lsDel(SAVE_KEY); if (game.state.phase === 'over') buildOver(game.state); }
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
      lsDel(SAVE_KEY);
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
    // a faixa 'Good. Now tap Play' aparece com o anel no Play e fica ate o Play (Arthur no iPhone 2026-11-09:
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
      if ((s.day | 0) === 1) return STR.nextPlay;
      return STR.nextDone(s.day | 0);
    }
    function freeLeft(s) { var f = s.free; return !!(f && (f.road || f.light)); }
    var nextShownAt = 0, nextBumpAt = 0, NEXT_AGAIN = 10000, nextBuilt = false, nextFirstOn = false, planOpenAt = 0;
    // ferramenta nova do dia que nao foi usada em 8 s de plano: os lugares pulsam e uma frase diz como usar
    var toolHintDay = -1, TOOL_HINT_MS = 8000;
    function newToolTick(s, now) {
      if (toolHintDay === s.day || now - planOpenAt < TOOL_HINT_MS || tutBalloonOn() || modal() || sayUntil) return;
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
        if (nextEdges0 < 0 || nextDay !== s.day) { nextEdges0 = edgeTotal(); nextDay = s.day; nextOn = false; planOpenAt = now; toolHintDay = -1; }
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
      var show = nextOn && !tutBalloonOn() && !modal() && !sayEl.classList.contains('show') && !sheetOpen;
      if (show) {
        var tx = nextText(s);
        if (nextEl.textContent !== tx) nextEl.textContent = tx;
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
    function nextStepOn() { return nextOn; }
    // dias 1 e 2, durante o dia: uma linha discreta, uma vez, depois de 15 s sem tocar em nada (sem balao)
    var runHintEl = tut(el('div', 'crz-runhint gone'), 'run-hint'), runHintUntil = 0;
    bottom.appendChild(runHintEl);
    // dias 1 a 3 (aprendizado), durante a corrida: o raio com carga pulsa de leve (sempre ha algo a fazer).
    // Le state.boost (recarga dos dias de aprendizado, outro agente) ou state.clear
    function boltCharges(s) { var b = s.boost || s.clear; return b ? (b.charges | 0) : 0; }
    function boostLiveTick(s) {
      var live = s.phase === 'run' && !s.paused && (s.day | 0) >= 1 && (s.day | 0) <= 3 && !!(s.clear && s.clear.unlocked !== false) && boltCharges(s) > 0;
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
    function ffOff() { try { if (game.state.ff && game.setFastForward) game.setFastForward(false); } catch (e) {} }
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
      else { snd('deny'); if (r && r.reason === 'ring') ffSlowedNote(); }
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
    function runHintTick(s, now) {
      if (runHintUntil && now >= runHintUntil) { runHintUntil = 0; runHintEl.classList.add('gone'); }
      // blind3 1: com o roteiro do tutorial a faixa do Boost ja disse isso (o mesmo texto em dois lugares)
      if (s.phase !== 'run' || (s.day | 0) !== 1 || seen('runHint') || tutBalloonOn() || s.paused || tutorScript()) return;
      if (!runAt || now - Math.max(runAt, lastTouchAt) < 15000) return;
      markSeen('runHint'); runHintEl.textContent = STR.runHint; runHintEl.classList.remove('gone'); runHintUntil = now + 6000;
    }
    function day1Built() {
      var base = nextEdges0 >= 0 ? nextEdges0 : 1;
      return edgeTotal() > base || !!(game.canUndo && game.canUndo());
    }
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
      if (tutorScript() || !tutorSkipped()) return;
      // dado (dia 2+, plano) e velocidade (primeiro dia que roda): uma vez cada
      if (s.phase === 'plan' && (s.day | 0) >= 2 && s.die && !seen('fu:die')) { firstUse('die', STR.dieFirst, now); pulseEl(dieEl); }
      if (s.phase === 'run' && !seen('fu:speed') && !seen('speedTaught') && runAt && now - runAt >= 7000) { firstUse('speed', STR.speedFirst, now); pulseEl(playBtn); }
      if (!fuQueue.length || sayUntil || modal()) return;
      say(fuQueue.shift(), 6000);
    }
    function toolIntro(id) {
      var T = CRZ.Tutorial && CRZ.Tutorial.STR && CRZ.Tutorial.STR.tool;
      return (T && T[id]) || STR.tools[id] || id;
    }
    var runAt = 0;
    // ja houve anel de fila nesta partida? (o render desenha o anel tracejado a partir de 0,3)
    var ringEver = false, RING_EVER_AT = 0.3;
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
    function day4RuleTick(s) {
      if (seen('day4rule') || s.phase !== 'plan' || (s.day | 0) !== 4 || roll.open || growPend || bootFrames >= 0) return;
      if (modal() || tutBalloonOn() || sayUntil || confirmOpen()) return;
      if (!sayShown(STR.day4Rule, 5000)) return;
      markSeen('day4rule');
      var w = game.world, k; for (k in w.nodes) if (w.nodes.hasOwnProperty(k)) { var n = w.nodes[k]; if (isJunction(n) && !n.tool) addPulse(n.x, n.y); }
    }
    function ringGroupTick(s) {
      if (seen('ringGroup') || (s.phase !== 'plan' && s.phase !== 'summary') || !render || typeof render.hotRings !== 'function' || sayUntil) return;
      var L = render.hotRings() || [], i;
      for (i = 0; i < L.length; i++) if (L[i].count >= 2) {
        if (tutBalloonOn() || modal()) return;
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
    var spendDay = -1, spendBudget = -1;
    function firstSpendTick(s) {
      if (s.phase !== 'plan') { spendDay = -1; return; }
      if (spendDay !== s.day) { spendDay = s.day; spendBudget = s.budget | 0; return; }
      var b = s.budget | 0;
      // com um balao do tutorial na tela o aviso espera (nunca dois baloes): fica para o proximo gasto
      var tu = CRZ.app && CRZ.app.tutorial, tutOn = tutBalloonOn() || tutorScript();
      if (b < spendBudget && !seen('firstSpend') && !tutOn) { markSeen('firstSpend'); say(STR.firstSpend(spendBudget - b)); }
      spendBudget = b;
    }
    var hintScan = { day: -1, phase: '', had: false };
    // B3: paineis que rolam no toque (o guia 'Tools & buttons' faltava)
    var SCROLL_OK = '#crz-overlay-root [data-scroll], .crz-sum [data-scroll], .crz-diepanel[data-scroll], .crz-guide [data-scroll]';
    var CHIP_LINGER = 2000, MIN_ROAD_PX = 20;
    var PAN_LOCK_DAYS = 3, panLockSaid = false;
    // dias 1 e 2 (dias de tutorial) comecam a 1x; no dia 3 volta o padrao do CFG (4x), a menos que a jogadora
    // ja tenha escolhido a velocidade no botao (o equilibrio dos dias 3+ foi medido com o padrao)
    // dias 1 e 2 (dias de tutorial) SEMPRE comecam a 1x, mesmo se a jogadora trocou no dia 1. Do dia 3 em diante
    // vale a ultima escolha dela; sem escolha, o padrao do CFG (4x; o equilibrio dos dias 3+ foi medido assim)
    var speedChosen = 0, TUT_SPEED_DAYS = 2, TUT_SPEED = 2, playPressedAt = -1e9, PLAY_GUARD = 1000;
    function startSpeed(s) {
      var d = s.day | 0, def = (CFG.speedDial && CFG.speedDial.defaultSpeed) || 1;
      // Arthur 2026-11-09: dias 1 e 2 a 2x (1x deixava o dia longo e passivo; 4x rapido demais)
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
      try { if (s.speed !== want) game.setSpeed(want); } catch (e) {}
    }
    function maybeStartHint(s, now) {
      if (hint || s.phase !== 'plan') { hintScan.had = !!hint; return; }
      // nada muda entre quadros do mesmo plano: procura de novo so com dia/fase novos ou quando a dica acabou
      if (hintScan.day === s.day && hintScan.phase === s.phase && !hintScan.had) return;
      hintScan.day = s.day; hintScan.phase = s.phase; hintScan.had = false;
      var i, t;
      for (i = 0; i < s.tools.length; i++) {
        t = s.tools[i];
        if (t.unlocked && CFG.tools[t.id] && CFG.tools[t.id].unlockDay === s.day && !seen('tool:' + t.id)) {
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
      if (tutOn) hint = null;   // o tutorial guiado assume
      else maybeStartHint(s, now);
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
      rollScreenTick(s, now);
      growTick(s);
      day4RuleTick(s);
      invisTick(s, now);
      // nv8 6: com aviso preto na tela o selo PAUSED (menu.js) desce para baixo dele
      var sOn = sayEl.classList.contains('show') && !!s.paused;
      if (doc.body && doc.body.classList && sOn !== doc.body.classList.contains('crz-say-on')) {
        if (sOn) { try { var sr = sayEl.getBoundingClientRect(); doc.documentElement.style.setProperty('--crz-sayb', Math.round(sr.bottom) + 'px'); } catch (e) {} }
        doc.body.classList.toggle('crz-say-on', sOn);
      }
      // nv8 5: a legenda segue o custo (a rua gratis usada volta a custar): reescreve quando o texto muda
      if (sel && !legendEl.classList.contains('gone')) { if (!legendAfford(sel)) syncLegend(); else { var lt = legendText(sel); if (legendEl.textContent !== lt) legendEl.textContent = lt; } }
      firstSpendTick(s); ringEverTick(s); ringGroupTick(s);
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
      if (s.phase !== 'run') { bhint.armed = false; return; }
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
        var mb = Math.round(H - bb.top + 12);
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
      try { if (render.resize) render.resize(); } catch (e) {}
      var changed = measureLayout();
      // no plano um chip que aparece ou some muda as margens, mas a camera fica (so a primeira medida e a troca
      // de orientacao reenquadram); o novato tocava num ponto que tinha acabado de andar
      if (changed && render.fit && (firstLayout || orientChanged || s.phase !== 'plan')) { try { render.fit(!firstLayout); } catch (e) {} }
      orientChanged = false;
      firstLayout = false;
    }

    // ---- update ----
    function update(dt) {
      if (destroyed) return;
      var s = game.state, now = nowMs();
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
      if ((game.state.day | 0) > PAN_LOCK_DAYS) autoPan(dt);
      if (infTimer > 0) {
        infTimer -= dt * 1000;
        if (infTimer <= 0 && !holding) { var o = ov(); if (o) o.showInfluence = null; }
      } else if (!holding && gesture.state() !== 'held') {
        // disco cinza de influencia sem toque nem segurar (estado perdido): some sozinho
        var o2 = ov(); if (o2 && o2.showInfluence !== null && o2.showInfluence !== undefined) o2.showInfluence = null;
      }
      sumShownTick(now);
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
      newJPlanTick(s, now);
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
      var want = sumEl.classList.contains('show');
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
      if (cityCut() && render && render.fitAll) { try { render.fitAll(!reducedMotion()); } catch (e) {} }
    }
    function bootFitTick(s) {
      if (bootFrames < 0) return;
      if (++bootFrames < 2 || layoutDirty) return;   // espera um draw (offscreen e calculado no draw) e as margens do HUD
      bootFrames = -1;
      planFit.day = s.day;   // o enquadre da carga vale como o da abertura do plano
      if ((s.phase === 'plan' || s.phase === 'run') && cityCut() && render && render.fitAll) {
        try { render.fitAll(false); } catch (e) {}
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
      try { if (typeof offGame === 'function') offGame(); } catch (e) {}
      gesture.reset();
      clearGhost();
      var o = ov(); if (o) { o.hoverTool = null; o.selectedNode = null; o.showInfluence = null; }
      if (ui.parentNode) ui.parentNode.removeChild(ui);
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
    return { update: update, destroy: destroy, getSelectedTool: getSelectedTool, isSheetOpen: isSheetOpen, isHolding: isHolding, boostChip: boostChip, boostNode: boostNode,
             openGuide: openGuide, closeGuide: closeGuide, isGuideOpen: function () { return !!guideEl; },
             isRollOpen: function () { return roll.open; },
             beginLeave: beginLeave, flushSave: onHide,
             // faixa de 1 linha do tutorial (dicas): nao bloqueia, some em ms ou no primeiro toque
             strip: stripSay };
  }

  CRZ.UI = {
    create: create,
    STR: STR,
    // recomendador unico por no (o tutorial usa para o balao do anel): advise(node, day, cfg, world, heat)
    // -> {key, tool, text, dir}. Mesmo estado do no, mesma recomendacao
    advise: advise,
    _test: { ringText: ringText, ringLevel: ringLevel, advise: advise, adviseVary: adviseVary, roundBeats: roundBeats, mainRoad: mainRoad, busiestRoad: busiestRoad, pillPlace: pillPlace, dieFreeLight: dieFreeLight, cardFits: cardFits, createGesture: createGesture, nextOneway: nextOneway, pipLayout: pipLayout, nextSpeed: nextSpeed, speedList: speedList,
             chipPick: chipPick, chipRank: chipRank, chipPlace: chipPlace, CHIP: { on: CHIP_ON, off: CHIP_OFF, px: CHIP_PX, px2: CHIP2_PX, every: CHIP_EVERY, day: ASSIST_DAY },
             jamAdvice: jamAdvice, jamPick: jamPick, jamOptions: jamOptions, busiestLane: busiestLane, denyText: denyText, suggestCard: suggestCard, worstNode: worstNode,
             isEnd: isEnd, isDeadEnd: isDeadEnd, queueJunction: queueJunction, loseText: loseText, lockedNodeOf: lockedNodeOf,
             toolIcon: toolIcon, cardIcon: cardIcon, eventSvg: eventSvg, dieSvg: dieSvg, miniDieSvg: miniDieSvg, describeDie: describeDie, dieName: dieName, ICONS: ICONS, CARD_ICONS: CARD_ICONS }
  };
})(typeof window !== 'undefined' ? window : globalThis);
