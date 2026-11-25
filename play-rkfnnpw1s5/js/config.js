/* Cruzamento: constantes do jogo. Dono: orquestrador (Claude principal).
 * Os agentes LEEM este arquivo. Quem precisar mudar um numero escreve a
 * proposta em NOTES_<agente>.md; nao edite aqui. DOM-free (roda no node). */
(function (root) {
  'use strict';
  var CRZ = root.CRZ = root.CRZ || {};

  CRZ.CFG = {
    version: 1,
    maxDays: 30,          // uma partida (v2, D1: 30 dias). Todo o resto le daqui; nada assume 12
    // v2 (D9, dono 2026-11-16): tres capitulos de chapterDays dias. Strikes contam por capitulo e voltam ao
    // maximo no primeiro dia de cada capitulo (11 e 21). Gastou os strikes do capitulo: a partida volta a manha do
    // primeiro dia daquele capitulo (checkpoint gravado no save), sem zerar a partida.
    chapterDays: 10,
    panLockDays: 3,       // dias 1 a 3: um dedo no vazio nao move o mapa (so dois dedos); do dia 4 um dedo move (ui.js, textos de ajuda)
    maxStrikes: 3,        // strikes por capitulo (difficulty.js troca: Easy 4, Normal 4)
    strikeGraceUntil: 5,  // dias 1 a 5: o cruzamento trava e aparece como sempre, mas nao conta strike nem encerra o dia
    graceUnlockSeconds: 4, // dias livres: o cruzamento travado destrava sozinho depois disso (s de jogo); o Boost tambem destrava
    graceRelief: 0.4,     // estresse que sai do cruzamento quando ele destrava sozinho num dia livre
    // v2/economia.md secao 4 e v2/jogador.md 5.3: nenhum recomeco de capitulo antes do dia noRestartBeforeDay; o
    // strike que esgotaria o capitulo e perdoado (a fileira mostra um a menos e uma linha diz isso)
    noRestartBeforeDay: 15,
    chapter1LastStrikeWarns: true,   // capitulo 1: o ultimo strike so avisa (perdoado), nunca manda de volta (medir)
    // modo "um crash, do zero" (D9, liberado depois de vencer; sem UI ainda): o primeiro strike contado encerra a
    // partida, sem checkpoint, sem perdao
    ironMode: false,

    // geometria do mundo (unidades = px em zoom 1)
    snapAngle: 45,        // graus, estradas so em multiplos disso
    minRoadLen: 80,       // comprimento minimo de uma estrada nova
    maxRoadLen: 260,
    minNodeSpacing: 56,   // distancia minima entre dois nos
    nodePickRadius: 26,   // raio de toque em px de tela
    roadOneFromDay: 3,   // w_bugs15: from this day the Road tool is put down after one road (days 1 and 2 build several, and the tutorial script keeps it too)
    roadSugFrame: { fill: 0.7, maxGrow: 1.8 },   // w_bugs15: the suggested 'Road around it' fills at most this share of the free area; the camera zooms in at most this many times
    camIdleMs: 600,       // o mapa nao reenquadra sozinho com um dedo na tela (mapa ou botao) nem por este tempo depois do ultimo toque
    worldRadius: 900,     // o crescimento automatico da cidade nunca passa disso a partir do centro
    buildRadius: 1500,    // ruas do jogador podem ir ate aqui (folga para crescer para todos os lados)
    minLinkLen: 40,       // rua que liga a um no ou estrada existente pode ser mais curta que minRoadLen
    linkMinAngle: 12,     // graus minimos entre duas ruas que se encontram ou se cruzam (ligacao livre)

    // carros
    carLen: 8,
    carGap: 4,
    speedFree: 70,        // unidades por segundo em estrada livre
    speedSlow: 28,        // perto da fila / saindo de parada
    laneOffset: 4.5,      // afastamento lateral por direcao/faixa (render)
    entryGap: 0.45,       // s minimo entre dois carros entrando na mesma faixa

    // estresse e travamento
    patience: 22,         // s de espera para o anel de estresse encher
    stressSmooth: 0.6,    // s de suavizacao
    lockSeconds: 8,       // s com estresse >= 1 para travar o cruzamento
    // barra do resumo e "Close call" (w_risk): o anel cheio so leva a barra ate ringMax; dali a barra e o relogio da trava.
    // "Close call" so quando o pior cruzamento chegou a closeSecs s (ou menos) de travar
    riskBar: { ringMax: 0.3, closeSecs: 4 },

    // dia
    // s a 1x (o dia roda a 4x por padrao; o jogador troca a velocidade). Dias 1 e 2 eram 22 e 32 (~5 s e 8 s
    // reais a 4x: o balao do dia 1 saia antes de ser lido); 48 e 64 dao 12 s e 16 s a 4x. Medido 2026-11-08:
    // nenhum strike nos dias 1 a 3 e vitorias dentro de 5 pontos (dev/balance/profiles.js, dev/novice2)
    // v2 (v2/economia.md, tabela 2.1 e 6.2): 30 posicoes. Dias 1 e 2 (44 s e 32 s) sao os de main, medidos contra o
    // tutorial (ritmo, 2026-11-16, RITMO_PARA_APROVAR.md): eles valem sobre a economia, que propunha 48 e 45 s.
    // Dia 1: tres faixas de 6 s em fila (cars, run, speed1), a ultima sai ate 43,5 s de jogo; menos que 44 corta a licao
    // da velocidade. Dia 2: a faixa 'progress' sai ate 21,6 s de jogo; 32 deixa 5 a 7 s reais de corrida livre.
    dayLen:   [44, 32, 45, 45, 45, 45, 48, 48, 50, 50,      // capitulo 1
               50, 50, 50, 52, 52, 52, 54, 54, 55, 55,      // capitulo 2
               55, 56, 56, 58, 58, 58, 60, 60, 60, 60],     // capitulo 3
    speeds:   [1, 2, 4],  // multiplicadores de velocidade permitidos
    // pontos por dia (v2/economia.md 2.1). Dia 2 = 4 (ritmo, de main: duas ruas, a da ponta nova e uma escolha)
    // integracao (2026-11-17): capitulos 2 e 3 de 5 para 4 (faixa de v2/economia.md 6.2: 4 a 6). Com a vaga de semaforos
    // (v2m) e sem manutencao, o robo que escolhe bem deixava 3,7 pontos parados por dia no Normal; com 4, 2,9, e o
    // dado pela regra passa a vencer usar sempre e passar sempre (39, 33 e 33 de 40). Easy igual (40 de 40).
    // Medido em dev/review/v2int/measure_out (exp.jsonl, E1), INTEGRACAO.md secao 9
    // w_cars (2026-11-18, testadora: "poucos pontos por rodada, demora para construir"): com mais carros na cidade, mais
    // pontos. Dias 7 a 20 de 4 para 5, capitulo 3 de 4 para 6, sobra de 3 para 4. Medido com os carros novos
    // (web/dev/review/w_cars/NOTES.md): o robo atento deixa 2,5 pontos parados por dia, como antes
    budget:   [2, 4, 3, 3, 4, 4, 5, 5, 5, 5,
               5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
               6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    carryCap: 4,          // pontos que sobram e passam ao dia seguinte
    // carros novos por segundo, por portal, antes do multiplicador do dado (v2/economia.md 6.2): capitulo 1 a curva de
    // antes x0,85 (dias 1 e 2 iguais aos de main), capitulo 2 o valor do dia 10 + 0,008 por dia, capitulo 3 + 0,03 de
    // degrau + 0,008 por dia.
    // Dia 2 (ritmo, de main): metade do tempo (64 -> 32 s) e o dobro de carros por segundo (day2Mul): os mesmos ~21
    // carros do dia 2 de antes. Medido em node (40 sementes, Easy): anel >= 0,3 no dia 2 em 1 de 40.
    day2Mul: 2,
    // w_cars (2026-11-18, dono: "precisa de mais carros"): fator de carros por capitulo, do dia fromDay em diante (os
    // dias 1 a 4 e a cena do dia 2 ficam como estavam). Medido em web/dev/review/w_cars (diag.js, NOTES.md)
    carsMul: { fromDay: 5, byChapter: [1.4, 1.1, 1] },
    // w_cars: paciencia dos motoristas a partir de fromDay (sim.js patNow); mul vem do perfil (difficulty.js latePatience)
    patienceLate: { fromDay: 5, mul: 1 },
    spawnRate: function (day) {
      var c1 = 0.85 * (0.1326 + 0.01872 * 10), CM = CRZ.CFG.carsMul;
      var m = CM && day >= CM.fromDay && CM.byChapter ? (CM.byChapter[Math.min(CM.byChapter.length, Math.ceil(day / (CRZ.CFG.chapterDays || 10))) - 1] || 1) : 1;
      if (day <= 1) return 0.234;
      if (day === 2) return (0.1326 + 0.01872 * 2) * CRZ.CFG.day2Mul;   // main, sem o x0,85
      if (day <= 10) return 0.85 * (0.1326 + 0.01872 * day) * m;
      if (day <= 20) return (c1 + 0.008 * (day - 10)) * m;
      return (c1 + 0.08 + 0.03 + 0.008 * (day - 20)) * m;
    },

    // ferramentas: custo e dia em que liberam
    // v2 (2026-11-16, v2/sistemas.md 2.2 e 7 regras 6 e 7): Road 1, Stop 3, Yield 5, Light 8, Two lanes 9.
    //  round: fora da bandeja fixa; entra pela carta de escolha (choiceCard, dia 19) contra Free power. unlockDay 99 =
    //    nunca por dia (o jogo libera por state.perks.round).
    //  oneway: so nos arquetipos que a pedem (CFG.archetypes.<id>.oneway, v2/nivel.md 3.2: Rio); fora deles nao aparece.
    //  cross: CORTADA (nunca valeu: v2/sistemas.md 1.4). removed: true; o custo fica para devolver o ponto de um save
    //    antigo que tinha uma (game.js normSave: vira cruzamento sem sinal + reembolso).
    tools: {
      road:    { cost: 2, unlockDay: 1 },
      stop:    { cost: 1, unlockDay: 3 },
      yield:   { cost: 1, unlockDay: 8 },
      // w_price (2026-11-24): costByChapter = preco nos capitulos [1, 2, 3] (cost = o do capitulo 1). Os dois sinais fortes
      // sobem por capitulo para que dois aneis numa manha nao caibam nos pontos do dia (v2/DECISAO_SINAL.md 4). Lido por
      // CRZ.toolPrice; o Easy pode trocar em difficulty.js. Medido em web/dev/review/w_price
      light:   { cost: 4, unlockDay: 5, costByChapter: [4, 6, 8] },
      upgrade: { cost: 3, unlockDay: 9 },
      cross:   { cost: 1, unlockDay: 999, removed: true },
      round:   { cost: 3, unlockDay: 12, costByChapter: [3, 5, 7] },   // w_light: para todos no dia 12 (antes so pela carta do dia 19); medido em v2/_scripts/w_light
      oneway:  { cost: 1, unlockDay: 9 }   // so no arquetipo com oneway: true (archetypes.river)
    },
    toolOrder: ['road', 'stop', 'yield', 'light', 'upgrade', 'round', 'oneway'],
    // v2: carta de escolha no resumo do dia `day` (componente das cartas do fim do dia): uma das duas, para o resto da
    // partida. round = libera a Roundabout; freePower = um semaforo sem manutencao (CFG.upkeep). Pular = nenhuma.
    // w_light: a carta do dia 19 saiu (a Roundabout libera no dia 12 para todos; as vagas de semaforo cresceram em lightCap)
    choiceCard: null,
    // v2 (2026-11-16, v2/nivel.md 3.2 e 3.3): formas de cidade, uma por partida, escolhida pela semente
    // (game.js archetypeOf; a primeira partida e sempre a Classica, main.js). Terreno sem cor nova (R8): o rio e uma
    // faixa em colors.grid sem contorno; o parque e um contorno tracejado em colors.inkSoft sem preenchimento.
    //  river: faixa |y| < half no meio do lote; a rua do dia 1 e vertical (260: o T do dia 2 nasce fora da agua) e ja e
    //    a ponte 1 (x = 0); a ponte 2 so no
    //    lugar marcado (x = bridges[1], tracejado curto sobre a agua). Nada se constroi na agua; rua (da cidade ou do
    //    jogador) so atravessa a +-bridgeW de uma ponte. One-way entra aqui (mao unica em par nas pontes).
    //  park: o parque ocupa |x| < half fora do gargalo |y| < gapY, onde passa a rua do dia 1: duas metades e um
    //    cruzamento de cada lado do gargalo. Nada se constroi no parque e nenhuma rua o atravessa.
    archetypes: {
      classic: { name: 'Classic town' },
      river:   { name: 'River town', oneway: true, day1: 'vertical', day1Half: 130, river: { half: 18, bridges: [0, 330], bridgeW: 26 } },
      park:    { name: 'Park town', park: { half: 46, gapY: 70 } }
    },
    archetypeList: ['classic', 'river', 'park'],
    // v2: semaforos ligados por uma rua pareiam sozinhos (o botao "Pair lights" saiu). false volta ao par manual
    lightsAutoPair: true,

    // regras de cruzamento (segundos). Dono da implementacao: sim.js
    junction: {
      // 2026-11-09: do dia 4 em diante (late) o cruzamento sem sinal com 3+ entradas ocupadas fica bem mais
      // lento: o cruzamento que o jogador nao resolveu e onde a fila nasce. Dias 1 a 3 (licao do Pare e do
      // Boost no dia 3) seguem com os numeros antigos. O Pare (stop, abaixo) segue com serve 0.9 e fullStop 0.8.
      // 2026-11-08 (rodada 2b): late 1.2/0.7 -> 1.5/1.2. Preguicoso no Easy vencia 63% (alvo 30 a 50%); agora 40%.
      // Medido em web/dev/balance/profiles.js e novice2/random_builder.js, 80 sementes.
      // 2026-11-08 (licao do dia 3): penalidade dos dias 1 a 3 0.30 -> 0.10. Com 0.30 o comboio de 12 carros num
      // cruzamento de 4 entradas (20% das cidades no dia 3) levava a fila ao travamento sem ninguem agir: strike no
      // dia 3 em 1,5% (Easy) e 3,3% (Normal) das partidas do jogador parado, 400 sementes. Com 0.10 (e o teto do dado
      // no comboio, game.js TEACH.spawnCap): 0 strikes, anel vermelho ainda em 64% (Easy) e 77% (Normal) delas.
      // v2 (2026-11-16, v2/sistemas.md 2.2 e 7 regra 2): late.serve 1.5 -> 1.1. O cruzamento sem sinal com pouco carro
      // deixa de pagar imposto (na cruz calma passa a ser melhor que Stop e semaforo); a penalidade por entrada ocupada
      // alem de 2 (1.2) fica, entao com tres ou mais ruas ocupadas ele ainda trava rapido.
      none:  { serve: 1.1, multiApproachPenalty: 0.10, late: { fromDay: 4, serve: 1.1, multiApproachPenalty: 1.2 } },
      // 2026-11-09 (nichos): cada sinal tem um lugar onde ganha. Medido com dev/novice2/decisions.js (60 sementes,
      // "so uma ferramenta" no Normal: Pare 88->78%, Preferencial 17->77%, Semaforo 57->83%, Rotatoria 100->80%,
      // faixa 72->73%) e com uma bancada de no isolado por forma (capacidade sustentavel x demanda do dia 10):
      //  Pare: barato, bom em T e cruz de demanda media; o pior em 5+ bracos (x0.5 a 0.75)
      //  Preferencial: a principal nao para (as duas maos juntas); melhor no T com rua principal (x3.0 contra
      //    x1.75 do Pare), pior no cruzamento equilibrado (x1.0)
      //  Semaforo: atuado (pula eixo vazio, verde termina quando o eixo esvazia); o maior teto em cruz de 4 bracos
      //    (x2.0 equilibrado, x3.0 com principal) e o unico com onda verde (o par tambem e atuado: segura o verde
      //    ate pairHold s a mais para o pelotao que vem do par; actuated: false volta todos ao ciclo fixo)
      //  Rotatoria: 1 vaga em T (perde do Pare), 2 vagas com 4+ entradas: a melhor em estrela de 4 eixos (x1.5)
      //  Faixa de pedestre: capacidade baixa, mas o estresse do no sobe 30% mais devagar; numa reta/curva so
      //    segura os carros na vez do pedestre
      // w_ag7 (2026-11-24, dono: "punha Stop em tudo sem pensar" e chegava ao dia 27 sem strike): do dia 11, o Pare com 3 ou 4
      // entradas ocupadas solta cada carro 0,3 s (uma alem de 2) ou 0,6 s (duas) mais devagar: todo mundo para, a cruz movimentada
      // engasga (anel e a linha "Too busy from every side for a stop"); o T segue como era. 40 sementes (web/dev/review/w_ag7/REPORT.md):
      // Easy stopAll limpo 73% -> 13% com aware 95%; capitulo 1 igual (fromDay 11)
      // w_pick (dono: Two lanes e Yield sem lugar proprio): twoLanes liga a regra stopPair do sim.js. No Pare, as duas cabecas
      // paradas de uma entrada de duas faixas saem na mesma vez: Two lanes e 'um Pare com uma fila longa'. 8 sementes
      // (web/dev/review/w_tools): melhor linha do cartao 12/10% -> 17/15% (Easy/Normal), melhor em 27 a 35% das cruzes de Pare
      stop:  { serve: 0.9, fullStop: 0.8, late: { fromDay: 11, multiApproachPenalty: 0.3 }, twoLanes: { fromDay: 1 } },
      // v2 (v2/sistemas.md 7 regra 3): minorMaxWait 7 -> 12. A lateral so forca a vez depois de 12 s: o Yield trava
      // quando as duas ruas tem o mesmo movimento (cruz equilibrada), e segue o melhor no T de rua principal.
      // w_pick: testado 12 -> 5 (Yield vira a melhor linha em 13/18% dos cruzamentos), mas a dica da manha manda Yields que pioram (test_v2x_advice 11% no Easy, limite 5%); fica 12 ate a regra da dica mudar
      yield: { serve: 0.6, minorServe: 1.1, minorMaxWait: 12, batch: 0 },
      // v2m (2026-11-17, v2/_scripts/v2m): o semaforo atuado (pulava o eixo vazio e segurava o verde enquanto ninguem mais
      // esperava) era o melhor ou empatado em TODA situacao da bancada (out/bench_before.md): nunca tinha lado ruim.
      // Agora o ciclo e FIXO (actuated: false): cada rua tem a vez, mesmo vazia. Num cruzamento calmo, num T de rua
      // principal ou onde 5+ ruas se encontram (3 vezes por ciclo) a fila espera no vermelho a toa e o anel fica ambar;
      // no cruzamento cheio de todo lado ele e o unico que nao trava. serve 0.75 -> 0.55: no verde o pelotao sai mais
      // rapido (o ciclo fixo perde tempo no vermelho geral).
      light: { green: 5, allRed: 1.1, serve: 0.55, pairGreenBonus: 0.5, pairHold: 0.8, actuated: false, minGreen: 2.5, gapOut: 1 },
      // v2m: serve 1.25 -> 1.4: a rotatoria enche antes (trava no cruzamento cheio, onde o semaforo e a peca)
      round: { serve: 1.4, parallel: 1, parallelBig: 2, extraApproachPenalty: 0.1 },
      // v2m: Two lanes GUARDA mais carros, mas o cruzamento solta um carro por entrada de cada vez ('storage'): ajuda onde
      // a fila chega ao cruzamento de tras ou a uma ponta de rua, nao acelera o cruzamento que e o gargalo. 'parallel'
      // volta a regra antiga (semaforo e Yield soltavam por faixa, o dobro).
      twoLanes: 'storage',
      cross: { serve: 0.9, pedEvery: 9, pedDur: 2.2, stressMul: 0.7 }
    },
    // fila de portal (sim.js spawn): carro que nasce espera no portal ate ter faixa livre de entrada. A espera do
    // primeiro da fila conta no estresse do portal (teto 0.95 x paciencia, o portal nunca trava sozinho).
    // portalQueueCap: carros na fila; quem chega com ela cheia nao entra (stats.dropped, ou stats.lost se o portal
    // esta sem rota). lostWait: portal sem rota para NENHUM outro portal (mao unica o isolou): o primeiro da fila
    // desiste depois de lostWait x paciencia do dia, conta uma vez em stats.lost e sai da fila.
    portalQueueCap: 3,
    lostWait: 0.5,

    // portais criados por ruas do jogador geram esta fracao do trafego de um portal normal
    // (sem isso, construir ruas so piora o jogo: playtest automatico, 2026-11-08)
    builtPortalRate: 0.2,   // 2026-11-09: era 0.5; agora toda ponta solta do jogador vira portal (teto so conta as dele) e a cidade nao perde portal por isso
    // chance de uma ponta nova da cidade virar portal: clamp(base + perR * r, min, max), r = distancia
    // ao centro / worldRadius. Ponta que perde o sorteio (ou passa do teto) vira portal fraco (weakRate)
    // em vez de beco morto. fromPortal: peso (x raio) de crescer a partir de um portal da borda; o portal
    // anda para a ponta nova. Antes (2026-11-08): base 0.2, min 0.15, max 0.85, teto 8, sem fraco:
    // 35% das ruas sem carro nenhum no dia (playtest da testadora e web/dev/novice2).
    growPortal: { base: 0.55, perR: 1.0, min: 0.5, max: 0.95, weakRate: 0.5, fromPortal: 1.5,   // w_cars: weakRate 0.3 -> 0.5
      cap: function (day) { return Math.min(12, 2 + day); } },   // teto de portais cheios da cidade
    // aneis do crescimento (ligacoes entre nos existentes): a partir de fromDay, base + 1 com chance extraP,
    // + 1 a partir de lateDay. Cada anel abre cruzamentos novos sem sinal.
    // v2 (spec_v2.js GROWRING, v2/economia.md 6.2): extraP 0.4 -> 0.8 e +1 do dia 11 em diante (a cidade ganha
    // cruzamentos sem crescer na tela).
    growRing: { fromDay: 6, base: 1, extraP: 0.8, lateDay: 11 },
    // Trafego nas ruas de fora (2026-11-10, queixa da testadora; medido em web/dev/sim/NOTES_TRAFFIC.md).
    // usefulGrowth (game.js growRing): o anel so liga dois nos se encurtar o caminho entre ao menos um par de pontas
    //   (portais) em mais de usefulMin px; sem isso 13 a 16% das ruas internas da borda ficavam quase vazias.
    //   DESLIGADO: 80 partidas por dificuldade, a fatia de internas vazias so caiu 16 -> 13% (Easy) e 13 -> 12% (Normal),
    //   alvo era <= 6% (o resto vem de ruas do jogador e de ramos de ponta fraca, nao de anel).
    // destDistK (sim.js spawnDest, do dia destFromDay em diante): peso do destino = taxa x (1 + destDistK x r / worldRadius),
    //   r = distancia da ponta ao centro do mundo (0,0). Mesmo 1 rng por sorteio. 0 = exatamente o jogo de antes.
    //   LIGADO (k = 2): aresta de fora / central 61 -> 66% (Easy), 63 -> 66% (Normal); carros +1%; vitorias no ruido.
    // w_cars (2026-11-18, dono: "os carros ficam sempre no mesmo lugar"; testadora: "rua que termina em traco nao recebe
    //   carro"). Medido em web/dev/review/w_cars/NOTES.md (diag.js, 20 sementes x 3 cidades):
    //   destAttract: peso de destino da ponta fraca e da ponta do jogador (no lugar da taxa delas, 0,3 e 0,2): toda ponta
    //     e lugar para onde carro vai, mesmo gerando pouco. destTripK: viagem longa pesa mais (sim.js spawnDest).
    //   via: parte dos carros passa por um cruzamento sorteado, se o desvio custa no maximo slack a mais (sim.js pickVia):
    //     a rua de lado (anel, atalho) deixa de ficar vazia o dia todo.
    //   (destAttract, destTripK e via valem do dia destFromDay: os dias 1 a 3 do tutorial ficam iguais)
    //   movePortal: do dia N, a rua que estica uma ponta leva a ponta junto (game.js buildRoad).
    //   playerEmitMax: as pontas do jogador somadas geram no maximo isto em pontas cheias (sem teto de pontas: sem beco).
    trafficBalance: { usefulGrowth: false, usefulMin: 1, destDistK: 2, destFromDay: 4,
      destAttract: { weak: 1, player: 1 }, destTripK: 1.5, via: { p: 0.35, slack: 0.5, fromDay: 4 }, movePortal: 4, playerEmitMax: 2,
      // w_far: lugares. A rua que o Sim espera com menos de minRel x a mediana de fluxo (ou menos de minCars carros por dia) ganha um no de
      // 2 ruas (ou o meio dela) como ponta fraca. POR CAPITULO (indice 0 = capitulo 1): max = lugares na cidade, rate = taxa deles
      // (distinta de growPortal.weakRate 0.5 e builtPortalRate 0.2: o Sim e o Game os reconhecem pela taxa), perDay = novos por manha.
      // Os lugares SOMAM carros (rate x a carga de uma ponta cheia), nao dividem o orcamento da cidade. Por dificuldade: difficulty.js
      // (places: { max, rate, perDay }); na linha de comando: --set trafficBalance.places.max.2=12
      places: { fromDay: 4, minRel: 0.5, minCars: 6, junction: true, max: [0, 5, 9], rate: [0.3, 0.3, 0.4], perDay: [0, 2, 3] } },
      // w_ag7: [0,6,12] / [0.3,0.35,0.55] / [0,3,3] levava o novato curioso do Easy a repetir o capitulo 3 em 55% e o aware do Normal a 25%
      // limpo; com estes, 25% e 80% (REPORT.md de w_ag7), e os carros dos dias 11 a 30 ficam ~10% acima de main
    // w_cars: teto de pontas criadas por ruas do jogador (era 10 fixo no game.js; acima dele a rua nova virava beco, a
    // ponta com traco que nunca recebe carro). Alto de proposito: toda ponta solta e ponta de verdade (ui.js le o mesmo)
    playerPortalCap: 40,
    // acima de portalRef(dia) portais da cidade, a taxa de cada um cai na proporcao (total constante)
    // w_cars: o teto sobe com a cidade (portalRefMax, era 8): a cidade de 17 pontas do capitulo 3 manda carro como 12
    portalRefMax: 12,
    // w_far: valores dos lugares no dia (capitulo de chapterDays dias; depois do ultimo vale o ultimo) e se uma taxa e de lugar
    placeAt: function (day) {
      var P = CRZ.CFG.trafficBalance && CRZ.CFG.trafficBalance.places; if (!P) return null;
      var ch = Math.max(0, Math.ceil(day / (CRZ.CFG.chapterDays || 10)) - 1);
      function pick(a) { return Array.isArray(a) ? (a[Math.min(ch, a.length - 1)] || 0) : (a || 0); }
      return { fromDay: P.fromDay || 1, minRel: P.minRel, minCars: P.minCars, junction: P.junction, max: pick(P.max), rate: pick(P.rate), perDay: pick(P.perDay) };
    },
    isPlaceRate: function (r) {
      var P = CRZ.CFG.trafficBalance && CRZ.CFG.trafficBalance.places, a = P && P.rate;
      return r > 0 && (Array.isArray(a) ? a.indexOf(r) >= 0 : a === r);
    },
    portalRef: function (day) { return Math.min(CRZ.CFG.portalRefMax || 8, 2 + Math.floor((day + 1) / 2)); },

    // Velocidade como decisao (desde o dia 1): o jogador escolhe 1x, 2x ou 4x a qualquer momento do dia.
    // Mais rapido = cada carro entregue rende mais "gorjeta" (tips), mas os motoristas tem menos
    // paciencia (anel de estresse enche mais rapido). A cada `tipsPerPoint` gorjetas acumuladas
    // (os restos passam de um dia ao outro) o jogador ganha 1 build point no dia seguinte.
    // Nao ha desaceleracao automatica: quem controla e o jogador.
    // v2 (2026-11-16, v2/sistemas.md 7 regra 1, v2/economia.md 3.1, DECISOES_PENDENTES.md 2): o bonus de entrega
    // vira PLACAR, nao build points. mode 'score': cada barra cheia soma scorePerBar ao placar do dia (summary.score e
    // summary.bonusScore); summary.speedBonus segue contando as barras (a barra da tela), mas nada entra no orcamento.
    // mode 'points' volta a regra antiga (1 build point por barra no dia seguinte).
    deliveryBonus: { mode: 'score', scorePerBar: 20 },
    speedDial: {
      defaultSpeed: 4,                       // velocidade do primeiro dia; depois lembra a ultima escolha
      tipsPerPoint: 30,
      levels: [
        { speed: 1, patienceMul: 1.0,  reward: 1.0 },
        { speed: 2, patienceMul: 0.85, reward: 1.25 },
        { speed: 4, patienceMul: 0.7,  reward: 1.5 }
      ]
    },

    // Boost: o botao de acao do dia, disponivel desde o dia 1. Toque curto durante o dia:
    //  - numa ponta da rua (portal): manda um carro extra agora (conta como entrega);
    //  - num cruzamento sofrendo: escoa a fila dele (mul x mais rapido por `seconds`, alivia estresse).
    // Cada toque gasta uma carga. O dia nao desacelera sozinho: a velocidade e escolha do jogador.
    clear: { unlockDay: 1, charges: 3, seconds: 6, mul: 2.2, stressRelief: 0.2, minStress: 0 },   // minStress > 0: Boost recusa (calm) no com estresse <= minStress (desligado: Boost preventivo vale)
    // Dias de aprendizado (2026-11-09, dono: hipercasual, nunca so assistindo). Nos dias 1..days, durante o dia,
    // cada carga de Boost usada volta depois de regenSeconds de tempo de JOGO (sem passar de clear.charges). A partir
    // do 4o Boost do dia o carro mandado pela ponta nao paga gorjeta (Delivery bonus fica como se so 3 valessem).
    // days: 0 desliga. Dia > days: exatamente a regra antiga (3 cargas por dia).
    earlyBoost: { days: 3, regenSeconds: 5 },
    // Fast-forward (2026-11-10, dono: hipercasual, quando nao ha nada a fazer a jogadora PULA). Durante o dia,
    // game.setFastForward(true) roda `speed` x o tempo de parede (mesmos passos fixos de 1/30 s: a sequencia de estados
    // e a da velocidade escolhida, so mais rapida). Termina sozinho com estresse >= autoSlowStress em qualquer no, fim
    // do dia, strike ou acao da jogadora. Delivery bonus por carro usa no maximo a recompensa de bonusSpeedCap x.
    fastForward: { speed: 8, autoSlowStress: 0.3, bonusSpeedCap: 4 },

    // dado do dia. Rola ao entrar no planejamento; a previsao de amanha tambem fica visivel.
    // `kind` agrupa para a UI: bad | plain | good | great | jackpot.
    // Efeitos: budget (+pontos hoje), spawnMul, speedMul, patienceMul, free ('road' | 'light': a
    // proxima obra desse tipo sai de graca; 'light' cai para 'road' se o semaforo ainda nao existe).
    // Probabilidades: d6 = 17% ruim, 33% normal, 50% bom/otimo; d20 = 15% ruim, 25% normal, 40% bom,
    // 15% otimo, 5% jackpot (60% de dias a favor do jogador contra 15% contra).
    // v2 (2026-11-16, v2/sistemas.md 3 e v2/jogador.md 4): UM d6 a partida inteira. O jogador toca para rolar; a face
    // sai de semente + dia (recarregar nao pesca outra). Antes de firstOffer a face e de lado bom ou neutra e vale sozinha
    // (sem escolha). De firstOffer em diante a face e uma OFERTA com dois lados: Use aplica os dois, Pass e um dia normal
    // (gratis, sem limite). Nada e aplicado antes da escolha. Nenhuma face ruim e forcada. Sem relance. Keep (de keepFrom
    // em diante) guarda a face num bolso de uma vaga; numa manha futura o jogador a usa no lugar de rolar.
    // Faixas (tier): gift (dias fromDay a firstOffer-1), first (firstOffer), ch1 (ate costFrom-1), ch2 e ch3 (pelo
    // capitulo do dia: chapterLen, padrao 10, ou CFG.chapterLen se existir). budget em lista = [ch1, ch2, ch3].
    // needs: a face so entra no sorteio quando o sistema de outro dono existe (game.js diceFeature); senao sai do pool.
    dice: {
      faces: 6, fromDay: 2, firstOffer: 7, costFrom: 13, keepFrom: 15, chapterLen: 10,
      pools: {
        gift:  ['plain', 'plain', 'plain', 'luck1', 'luck2', 'free'],
        first: ['busy', 'busy', 'busy', 'busy', 'patient', 'patient'],
        ch1:   ['busy', 'busy', 'quiet', 'quiet', 'patient', 'lucky'],
        ch2:   ['busy', 'quiet', 'patient', 'lucky', 'loan', 'festival'],
        ch3:   ['busy', 'quiet', 'patient', 'loan', 'festival', 'biggame']
      },
      defs: {
        // v2x: pip = o numero que a face mostra, fixo por oferta (cada oferta dos capitulos 1 a 3 tem o seu)
        plain:    { kind: 'plain', pip: 1 },
        luck1:    { kind: 'good', budget: 1, pip: 2 },
        luck2:    { kind: 'good', budget: 2, pip: 3 },
        free:     { kind: 'great', free: 'road', pip: 6 },
        lucky:    { kind: 'good', budget: 2, pip: 6 },
        busy:     { kind: 'good', offer: true, budget: [2, 3, 3], spawnMul: 1.1, pip: 3 },      // x1,2 era passe em quase toda cidade no garfo (measure_v2b.js fork); x1,1 muda de sinal com a cidade (faixa x1,1 a x1,3 de economia.md)
        // integracao (2026-11-17): Quiet x0,75 -> x0,8 e Patient x1,3 -> x1,2 (faixas de v2/sistemas.md): no garfo do dia
        // 18 (Normal) usar era melhor que passar em 17 e 20 de 39 cidades e nunca pior; agora 9 e 6, pior em 3 e 2.
        // Na partida, a regra simples segue acima de usar sempre e passar sempre (dev/review/v2int/measure_out, E2)
        quiet:    { kind: 'good', offer: true, budget: [-1, -2, -2], spawnMul: 0.8, pip: 4 },
        patient:  { kind: 'good', offer: true, budget: [-1, -2, -2], patienceMul: 1.2, pip: 5 }, // sistemas.md 3.1: -1 no cap. 2 e usar sempre
        loan:     { kind: 'good', offer: true, budget: 4, debt: 3, pip: 2 },                     // -3 no orcamento de amanha
        festival: { kind: 'good', offer: true, budget: [2, 2, 3], festivalMul: 2, needs: 'festival', pip: 1 },
        biggame:  { kind: 'good', offer: true, budget: 5, eventMul: 1.5, needs: 'event', pip: 6 }
      },
      // tabelas do dado de antes (d6 nos dias 1 a 5, d20 nos dias 6 a 12): so para abrir um save antigo com o dado de hoje
      rerollCost: 1,
      day1Face: 2,
      early: { faces: 6, outcomes: [            // dias 1 a 5
        { min: 1, max: 1, id: 'rush',  kind: 'bad',   spawnMul: 1.5 },
        { min: 2, max: 3, id: 'plain', kind: 'plain' },
        { min: 4, max: 4, id: 'luck1', kind: 'good',  budget: 1 },
        { min: 5, max: 5, id: 'luck2', kind: 'good',  budget: 2 },
        { min: 6, max: 6, id: 'free',  kind: 'great', free: 'road' }
      ] },
      late: { faces: 20, outcomes: [            // dias 6 a 12
        { min: 1,  max: 1,  id: 'rush',     kind: 'bad',     spawnMul: 1.7, speedMul: 0.9 },
        { min: 2,  max: 2,  id: 'rain',     kind: 'bad',     speedMul: 0.8 },
        { min: 3,  max: 3,  id: 'festival', kind: 'bad',     spawnMul: 1.5 },
        { min: 4,  max: 8,  id: 'plain',    kind: 'plain' },
        { min: 9,  max: 11, id: 'luck1',    kind: 'good',    budget: 1 },
        { min: 12, max: 14, id: 'luck2',    kind: 'good',    budget: 2 },
        { min: 15, max: 16, id: 'free',     kind: 'great',   free: 'light' },
        { min: 17, max: 18, id: 'luck3',    kind: 'great',   budget: 3 },
        { min: 19, max: 19, id: 'calm',     kind: 'great',   budget: 1, spawnMul: 0.75 },
        { min: 20, max: 20, id: 'jackpot',  kind: 'jackpot', budget: 5, patienceMul: 1.3 }
      ] }
    },

    // cartas do fim do dia (escolhe 1 de 3). offer: false = carta aposentada: sai do sorteio, mas a definicao e o efeito
    // ficam (save antigo com ela ativa aplica o efeito no dia seguinte, uma vez). 2026-11-10, dono ("o que o jogador
    // nao ve nao existe"): smooth (carros 10% mais rapidos) e waveBonus (onda verde em dobro, so com par) eram invisiveis.
    // Ofertadas: plus2, freeRoad, freeLight (com o semaforo liberado), patient (depois do primeiro anel da partida).
    cards: [
      { id: 'plus2',    weight: 3 },  // +2 pontos no proximo dia
      { id: 'freeRoad', weight: 2 },  // a proxima estrada nova custa 0
      { id: 'freeLight', weight: 1 }, // o proximo semaforo custa 0
      { id: 'patient',  weight: 2 },  // paciencia +30% no proximo dia
      { id: 'waveBonus', weight: 1, offer: false }, // onda verde vale o dobro no proximo dia (aposentada)
      { id: 'smooth',   weight: 2, offer: false }   // carros 10% mais rapidos no proximo dia (aposentada)
    ],
    // patient so entra no sorteio depois do primeiro anel da partida (pico do dia >= ringEverAt, ou mapa de problemas
    // com algum no): a mesma regra que ui.js usa para mostrar a carta (RING_EVER_AT 0.3). 0 = sem pre-requisito.
    cardPatientRingAt: 0.3,
    // crescimento da cidade. hardshipWeight: peso extra do no/estrada que mais sofreu ontem para receber o ramo novo
    // (no: 1 + 3 x hw x estresse, ate 4x; estrada: 1 + 2 x hw x estresse). AJUDA DELIBERADA, sem sinal visivel, por
    // decisao do dono (2026-11-10): fica 1 (o valor de sempre); 0 tiraria o vies.
    growth: {
      hardshipWeight: 1,
      // v2 (2026-11-16, v2/nivel.md 2, v2/economia.md 2.4, v2/_scripts/spec_v2.js nodeCapV2): a cidade cresce ate um
      // teto e depois MUDA POR DENTRO, para seguir tocavel num iPhone em pe.
      //  lot: o crescimento automatico fica dentro de uma elipse em pe de semieixos rx x ry (mundo), a proporcao da tela
      //    (antes: circulo de worldRadius 900). citySpacing: no novo da cidade (e o ponto de corte numa rua) fica a
      //    citySpacing ou mais de qualquer no; nos dias 1 a earlySpacing.untilDay vale earlySpacing.d (a rua do dia 1 tem
      //    180 e o T do dia 2 nasce no meio dela).
      //  nodeCap(dia): teto de nos do mundo (cidade + ruas do jogador) no crescimento: 3 por dia ate 28 no dia 10, +2 por
      //    dia ate 40 no dia 16, 40 ate o fim (spec_v2.js NODECAP). Vale para qualquer numero de dias.
      //  afterCap: no teto, o dia muda por dentro: rings a mais (ligacoes entre nos que ja existem) e, a cada shiftEvery
      //    dias, uma ponta fraca vira ponta cheia (mais carros saem e chegam ali: "a cidade muda para onde quer ir") e a
      //    ponta cheia menos usada vira fraca. A UI avisa no lugar ('shift'). ringCap: o canto de um anel pode passar do
      //    teto ate este numero (a rua nova e por dentro da cidade, nao para fora).
      // lot 460 x 620 (nao os 500 x 800 de nivel.md): a area util medida no Chrome e 334 x 437 a 479 px em 390x844
      // (topo 84, base 281 a 323 conforme o HUD), mais larga que os 318 x 501 da conta de nivel.md 2.2. Medido em
      // v2/_scripts/v2c/city30.js, 20 sementes: menor distancia entre cruzamentos no dia 30, mediana 33 px e pior 30 px
      // (500 x 800: 31 e 23 px).
      lot: { rx: 460, ry: 620 },
      citySpacing: 100, earlySpacing: { untilDay: 3, d: 80 },
      nodeCap: function (day) { return day <= 10 ? Math.min(28, 3 * day) : day <= 20 ? Math.min(40, 28 + 2 * (day - 10)) : 40; },
      afterCap: { rings: 1, shiftEvery: 2, ringCap: 46 }
    },
    // v2 (v2/sistemas.md 2.3 e 7 regra 4, v2/economia.md 3.1): manutencao do semaforo. Toda manha do dia fromDay em
    // diante, cada semaforo custa perLight build point, descontado do orcamento do dia ja somado (base, sobra, dado,
    // carta). Tirar um semaforo e gratis (sem reembolso). Se os pontos nao cobrem, os semaforos que ficaram sem pagar
    // APAGAM nesse dia (o cruzamento funciona como sem sinal, o icone fica esmaecido): os menos usados ontem primeiro.
    // Os semaforos da carta Free power (st.perks.freePower) nao pagam.
    // v2m (2026-11-17): a manutencao saiu (perLight 0; o codigo fica, desligado). O custo de cada semaforo agora e a VAGA:
    // a cidade liga no maximo lightCap semaforos (abaixo). Medido em v2/_scripts/v2m/out: com a vaga a manutencao nao
    // mudava nenhuma politica e era uma conta a mais para a jogadora. Sem manutencao nenhum semaforo apaga.
    upkeep: { fromDay: 11, perLight: 0 },
    // v2m: quantos semaforos a cidade liga ("2 of 3" no cartao). byDay: [dia, N] em ordem (o ultimo que ja chegou vale).
    // perkPlus: cada escolha da carta Free power soma +1 vaga. Tirar um semaforo e gratis (sem reembolso) e libera a vaga.
    lightCap: { byDay: [[5, 1], [10, 2], [16, 3], [24, 4]], perkPlus: 1 },   // w_light: medido em v2/_scripts/w_light (SEMAFORO_PARA_DECIDIR.md)
    // w_where: mover um semaforo de onde ele faz menos para o anel que o quer (game.lightMoveFor). So quando a peca que fica no lugar
    // dele e 'better' la (com 'about the same' o cruzamento de origem piorou no dia seguinte em 49% das vezes) e o semaforo tira pelo
    // menos minGain s no anel (com todos os ganhos, 'better' se cumpriu em 82%; com minGain 6, 86%). Medido em web/dev/review/w_where
    lightMove: { enabled: true, minGain: 6 },
    // v2x (playtest cego 5): o conselho da manha joga o dia de ontem de novo com cada peca (game.whatIf) e so manda a peca
    // que baixa a espera mais longa do resumo em gain (fracao) e minS s, sem travar e sem subir o anel mais que pTol.
    // Depois de seguido, outra peca so com mudanca material (tipo mudou ou carros/min mais que material) e gainChanged
    // w_yield: peca ruidosa (noisy: o Yield, um carro da lateral pode esperar ~12 s e a espera mais longa depende da sorte
    // de chegada) so com a vitoria em repWin das 2 x reps repeticoes do dia com outra sorte (a 1x e a hi x carros).
    // Medido (v2/_scripts/v2x/yield_probe.js, 80 sementes): a 4 repeticoes, ganhar em 5 de 8 tira os Yields que pioram
    advice: { gain: 0.25, minS: 2, pTol: 0.05, material: 1 / 3, gainChanged: 0.4, hi: 1.2, noisy: ['yield'], reps: 4, repWin: 0.625 },
    // w_choice: o cartao da escolha do sinal (game.choiceFor, ui.js). Mostra o que o 'e se' mediu, nao muda nenhuma regra.
    // rise: s a mais que a rua mais quieta passa a esperar para a linha dizer 'side street waits N s'; quiet: a rua
    // mais quieta leva no maximo essa fracao dos carros da mais cheia; minCars: carros da rua quieta para valer
    // w_choice2: a faixa prometida ('13 s -> 2 to 9 s') vai do menor ao maior numero das repeticoes (1x e hi x os carros do 'e se',
    // e as repeticoes do Yield); loMul e hiMul alargam as pontas (menor x loMul, maior x hiMul) e se afinam sem mexer em codigo.
    // payGap: s de diferenca entre a rua acesa e as outras para a linha 'this road 4 s . the other 12 s'
    // w_choice3: o veredito em palavras no lugar dos segundos (medido em v2/_scripts/sinais/veredito.js, 1.320 trocas de sinal de
    // calibra.csv). better: a espera cai pelo menos sec s e pct da de ontem; worse: sobe pelo menos sec s; o resto e 'same'. O mesmo corte
    // classifica o dia seguinte (game.verdictFor). 'much better' nao se separa de 'better' (acerto de direcao 85% e 79%): um so
    signCard: { rise: 2, quiet: 0.5, minCars: 3, loMul: 0.8, hiMul: 1.25, payGap: 2,
      verdict: { better: { sec: 4, pct: 0.25 }, worse: { sec: 2, pct: 0 } },
      // w_shape: a forma do cruzamento de ontem com a mesma classe da matriz (v2/_scripts/sinais/matriz.js, w_ag5): main = a rua (eixo) mais
      // cheia leva mais que mainShare dos carros; volume em carros/min: ate lowMax baixo, acima de highMin alto (tercis de Easy 66.9/90,
      // Normal 63.1/86.4). nearP: pico do anel (0 a 1) da repeticao com a peca no lugar a partir do qual a linha diz 'fills up'
      shape: { mainShare: 0.6, lowMax: 65, highMin: 88, nearP: 0.6 },
      // w_verd: linhas 'better' que a medida (w_verd/tables_current.md, 12.327 escolhas) mostra que falham: o veredito vira 'better on a day like
      // yesterday' (event: evento de hoje neste cruzamento ou ao lado; o 'e se' e de ontem, sem o evento) ou 'better, but not on a busy day'
      // (busy: Stop/Yield do dia junction.stop.late.fromDay em diante, com minRoads ruas ou mais ou no lugar de um semaforo/rotatoria). Os cortes
      // do veredito (4 s, 25%) nao mudam. Linha qualificada nunca leva 'fastest'
      qualify: { event: { tools: ['stop', 'yield', 'round'] }, busy: { tools: ['stop', 'yield'], minRoads: 4, replaces: ['light', 'round'] } },
      // w_noopt: cartao sem nenhuma peca 'better' (o cruzamento cheio): o 'e se' tenta o que um engenheiro faria, cada um um ramo a mais do
      // mesmo dia de ontem, e o cartao mostra so os que saem 'better' pelo mesmo corte (verdict). kinds na ordem das linhas: road = uma rua
      // entre dois dos vizinhos de mais carros (contorna o cruzamento), feed = a melhor peca no vizinho que mais manda carros. Two lanes na
      // rua que mais esperou saiu: 'better' em 1% dos cartoes mortos (web/dev/review/w_noopt/TABLE_raw.md). maxBranches: teto de ramos por cruzamento;
      // rows: linhas a mais; pairs: os vizinhos das pairs ruas de mais carros entram nos pares da rua
      // w_noopt2: a linha do vizinho (kind 'feed') esta DESLIGADA: seguida, saiu 'better' no dia seguinte em 46% (318 cruzamentos; com a barra
      // abaixo, 59% em 93) contra 69% da rua e 17% sem fazer nada; para ligar, 'feed' volta a kinds. maxCross = no maximo de cruzamentos novos (sem sinal) que a rua sugerida pode criar; o cartao diz quantos
      // w_texts: maxCross counts only where the road crosses another road; the row's 'adds N crossings' also counts an end that was a bend and gets its third road
      relief: { kinds: ['road'], maxBranches: 5, rows: 2, pairs: 3, maxCross: 1,
        // w_noopt2: barra mais alta so para a linha do vizinho: seguida, ela saia 'better' no dia seguinte em 46% (rua: 69%), com ganho de 8 s e 40% em 67%
        // (web/dev/review/w_noopt2/runs/table5.md); fica o ganho minimo em s e em fracao da espera de ontem
        bar: { feed: { sec: 8, pct: 0.4 } } } },
    // w_dawn: every crossing that carried cars yesterday gets its replay in the background from the end of the day (summary, then the
    // plan; the day running stops it), after the rings the summary always did. cpuMs: slice time the background replays may use per
    // morning (the tapped crossing is outside it); wallMs: no background replay starts or goes on later than this after the queue began;
    // reloadMs: after a reload in the plan, the wait before the same queue starts by itself.
    // Measured in web/dev/review/w_dawn (measure.js, dawn_timing.mjs): a chapter-3 morning replays all its crossings in about 4.5 s of slices
    // in headless Chrome; at 4x CPU slow-down 8000 ms keeps the frames of the morning as they were (12000 added a 117 ms frame)
    dawnReplay: { cpuMs: 8000, wallMs: 30000, reloadMs: 1500 },
    // v2 (v2/economia.md 3.2 e 6.2, v2/sistemas.md 4): Road crew, a troca entre hoje e depois. Nas manhas de fromDay a
    // toDay o plano oferece: pagar cost pontos hoje e receber perDay ponto toda manha pelos proximos days dias (a
    // partir de amanha). No maximo maxActive ao mesmo tempo. Paga-se no 4o dia (cost / perDay) e rende +6. days e a
    // alavanca: ate o fim da partida faz 'investir sempre' vencer; 6 dias faz perder (medido em economia.md 3.2).
    // w_crew (tester: "pagar 4 de uma vez toda manha nao faz sentido"): a oferta e rara. Aparece em fromDay; depois de
    // uma resposta (Hire ou Not now) so volta gapDays dias depois, e nunca com uma equipe ativa (maxActive 1). Manha
    // sem pontos para pagar nao conta como resposta: a oferta espera a proxima manha com pontos. A equipe rende ate o
    // fim da partida no maximo (contratada no dia 26: 4 manhas). Medido em v2/_scripts/w_crew/out (crew30.js).
    // Preco medido (30 sementes, Easy e Normal, aware e smart, budget 4 por dia nos dias 16 a 26): 3 por +1 em 8 manhas
    // (+5 liquido, pago no 3o dia; no dia 26, 4 manhas: +1). Hire sempre contra Not now sempre, cidade a cidade: melhor em
    // 13 a 20 de 30, pior em 9 a 17: nenhuma das duas domina. 4 por 10 perdia em 19 a 20 de 30 (aware).
    crew: { fromDay: 16, toDay: 26, cost: 3, perDay: 1, days: 8, maxActive: 1, gapDays: 5 },
    // w_bugs11: folhas que abrem sozinhas (Road crew, boas-vindas, 'Tap to try another') esperam o mapa ficar parado: sem ferramenta
    // na mao e este tempo (ms) depois do ultimo toque no mapa. O cego 11 perdeu um toque no dia 16 para a folha da Road crew
    sheetIdleMs: 1500,
    // w_bugs13: uma folha que abre sozinha (Road crew) ignora toques por este tempo (ms) depois de abrir, e um toque que comecou antes dela
    sheetGuardMs: 600,
    // efeito de cada carta (game.js le daqui; a UI le por CRZ.Game cardInfo(id) para nao copiar numero)
    cardEffects: {
      plus2:     { budget: 2 },
      freeRoad:  { free: 'road' },
      freeLight: { free: 'light' },
      patient:   { patienceMul: 1.3 },
      waveBonus: { waveMul: 2 },
      smooth:    { speedMul: 1.1 }
    },

    // eventos de lugar (events.js, v2e; v2/nivel.md secao 4 e 5). calendar: { ch, rel, type } com rel = dia dentro do
    // capitulo (1 a 10; capitulo de CFG.chapterLen dias, padrao 10). Capitulo 1 sem evento (o jogador aprende o basico),
    // o 2 leve, o 3 e a pressao principal. type 'hat': sorteado da semente entre os de `hat`. perDayMax: teto por dia.
    // test: modo de teste (headless --set events.test=1, pagina ?events=test): os capitulos 2 e 3 cabem nas janelas de
    // testWindows (partida de 12 dias). Nos 30 dias (CFG.maxDays 30) os eventos caem nos dias 13, 15, 18, 22 a 25, 27, 29, 30.
    // types: kind 'surge' = a ponta marcada solta mul vezes mais carros entre win[0] e win[1] do dia; kind 'close' = uma
    // rua da rota mais usada fecha o dia todo (nunca a que deixa uma ponta sem caminho). size (scale, face Big game do
    // dado) cresce a parte extra: mul efetivo = 1 + (mul - 1) x size; na obra, size 1,5 poe detourMul nas 2 pontas mais perto.
    // obra: skip = pula as `skip` ruas mais usadas (escolhe entre as 3 seguintes); detourMax = desvio ate N vezes a rua.
    // Numeros medidos com tools/headless.js (--events, v2e): ver o relatorio do ramo.
    events: {
      on: true, test: false, perDayMax: 2, testPerDayMax: 1,
      testWindows: { 2: [6, 8], 3: [9, 12] },
      // w_evt (web/dev/review/w_evt/out): a obra saiu do calendario e do chapeu. Fechar uma rua quase nao muda o dia (a
      // rota dos carros contorna sozinha) e nenhum preparo mediu efeito confiavel no dia dela (Two lanes no desvio:
      // strike no dia, ignora contra se prepara, Classica 8% e 2%, Rio 9% e 8%, Parque 9% e 11%; com a rua mais usada e
      // desvio curto, Classica 0% e 9%, Parque 18% e 4%). Aviso que nao se pode atender nao existe: no lugar dela, uma
      // segunda saida da escola (a mais leve das duas que funcionam). O tipo roadwork continua definido (save antigo).
      calendar: [
        { ch: 2, rel: 3, type: 'school' }, { ch: 2, rel: 5, type: 'school' }, { ch: 2, rel: 8, type: 'game' },
        { ch: 3, rel: 2, type: 'school' }, { ch: 3, rel: 3, type: 'hat' }, { ch: 3, rel: 4, type: 'school' },
        { ch: 3, rel: 5, type: 'hat' }, { ch: 3, rel: 7, type: 'game' }, { ch: 3, rel: 7, type: 'school' },
        { ch: 3, rel: 9, type: 'hat' }, { ch: 3, rel: 10, type: 'game' }
      ],
      hat: ['school', 'game'],
      mapMul: { river: 0.75 },   // w_evt: Rio com 3/4 da parte extra (80 sementes, Normal: ignora 66, prepara 74, sem eventos 76)
      types: {
        game:     { kind: 'surge', place: 'far', mul: 14, win: [0.4, 0.5], label: 'Big game at the stadium', mark: 'Big game' },
        school:   { kind: 'surge', place: 'tee', mul: 12, win: [0.45, 0.55], label: 'School out at noon', mark: 'School out' },
        roadwork: { kind: 'close', place: 'busy', skip: 2, detourMax: 4, detourMul: 2, label: 'Roadwork closes a road', mark: 'Road closed' }
      },
      // textos (ingles; marca ate 6 palavras, faixa ate ~10, balao ate 10)
      text: {
        today: 'today', tomorrow: 'tomorrow', festival: 'Festival road today', festivalOffer: 'Festival road',
        // v2ev (web/dev/events/prep.js): o preparo que ajuda e uma segunda rua saindo da ponta (jogo, escola) e Two
        // lanes no desvio (obra). Variantes: xBoost quando a segunda rua nao cabe ali, xDone quando ja existe
        stripEve: { game: 'Big game here tomorrow: add a second road out.', gameBoost: 'Big game here tomorrow: Boost the next crossing.',
                    gameDone: 'Big game here tomorrow: your second road is ready.',
                    school: 'School out here tomorrow: add a second road out.', schoolBoost: 'School out here tomorrow: Boost the next crossing.',
                    schoolDone: 'School out here tomorrow: your second road is ready.',
                    roadwork: 'Roadwork tomorrow: give the detour two lanes.' },
        stripToday: { game: 'Big game today: add a second road out.', gameBoost: 'Big game today: Boost the next crossing.',
                      gameDone: 'Big game today: your second road is ready.',
                      school: 'School out today: add a second road out.', schoolBoost: 'School out today: Boost the next crossing.',
                      schoolDone: 'School out today: your second road is ready.',
                      roadwork: 'Roadwork today: give the detour two lanes.' },
        first: 'Get ready today: tap the mark to see what helps.',
        tap: { game: 'Midday, cars pour out here. Add a second road out.', gameBoost: 'Midday, cars pour out here. Boost the next crossing.',
               gameDone: 'Midday, cars pour out here. Two roads share them.',
               school: 'At noon, cars rush out. Add a second road out.', schoolBoost: 'At noon, cars rush out here. Boost the next crossing.',
               schoolDone: 'At noon, cars rush out here. Two roads share them.',
               roadwork: 'No cars on this road. Give the detour two lanes.', festival: 'Twice the cars from here today. Sign the next crossing.' },
        now: 'Here come the cars. Boost this crossing.',
        why: { game: 'Big game today: more cars came.', school: 'School out today: more cars came.', roadwork: 'Roadwork today: one road was closed.',
               gamePrep: 'Big game today: your second road took the cars.', schoolPrep: 'School out today: your second road took the cars.',
               roadworkPrep: 'Roadwork today: your two lanes held the line.',
               gamePrepBoost: 'Big game today: your Boost kept cars moving.', schoolPrepBoost: 'School out today: your Boost kept cars moving.' }
      }
    },

    // visual: todos usam estas cores
    colors: {
      bg: '#fffdf8', ink: '#111111', inkSoft: '#8a8a8a', grid: '#efeae0',
      red: '#d9261c', green: '#2f8f55', amber: '#f2a900', gray: '#cfcfcf', white: '#ffffff'
    }
  };

  /* Sinal de Pare (2026-11-16): geometria UNICA do icone do Stop, usada pelo mapa (render.js, canvas), pela
   * bandeja, guia e cartao do tutorial (ui.js, SVG 48) e pelo How to play (menu.js, SVG 24). O icone do app
   * (tools/make_icons.py) repete as mesmas fracoes. Octogono regular vermelho com lado plano em cima e embaixo;
   * `half` = apotema = meia largura, a mesma caixa e o mesmo centro do circulo antigo (layout e toque iguais).
   * Borda branca fina entre as apotemas half*rimOut e half*rimIn. A palavra STOP (branca, negrito, centrada,
   * largura half*textW, condensada) so entra quando a largura do octogono (2*half, px de tela) e >= textMin: abaixo disso
   * vira borrao e o octogono com a borda ja le como Pare. */
  CRZ.STOP_SIGN = {
    rimOut: 0.9, rimIn: 0.76, textW: 1.36, fontK: 0.6, capH: 0.72, textMin: 18,
    font: '-apple-system, system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif', weight: 800,
    T: Math.tan(Math.PI / 8),
    // 8 vertices [x, y] da octogono de apotema a, em sentido horario a partir do canto de cima a esquerda
    pts: function (cx, cy, a) {
      var t = a * this.T;
      return [[cx - t, cy - a], [cx + t, cy - a], [cx + a, cy - t], [cx + a, cy + t],
              [cx + t, cy + a], [cx - t, cy + a], [cx - a, cy + t], [cx - a, cy - t]];
    },
    // meia extensao na direcao unitaria (ux, uy): maior projecao dos vertices (apotema nos eixos e nas diagonais)
    // (vertices (+-t, +-a) e (+-a, +-t), t = a tan 22,5: sem alocar, roda por quadro)
    ext: function (a, ux, uy) {
      var x = Math.abs(ux), y = Math.abs(uy), t = a * this.T;
      return Math.max(x * a + y * t, x * t + y * a);
    },
    hasText: function (widthPx) { return widthPx >= this.textMin; },
    // corpo da letra 0,6 a; a palavra (~2,7 em de largura natural) e comprimida para textW*a, letra condensada
    // como a da placa real (canvas: maxWidth do fillText; SVG: textLength)
    fontPx: function (a) { return a * this.fontK; },
    // SVG: red/white sao atributos de preenchimento ('class="f-red"' ou 'fill="#d9261c"'); text: com a palavra
    svg: function (cx, cy, a, red, white, text) {
      var self = this;
      function d(k) {
        return self.pts(cx, cy, a * k).map(function (p, i) { return (i ? 'L' : 'M') + (+p[0].toFixed(3)) + ' ' + (+p[1].toFixed(3)); }).join('') + 'Z';
      }
      var s = '<path ' + red + ' d="' + d(1) + '"/>' +
        '<path ' + white + ' fill-rule="evenodd" d="' + d(this.rimOut) + d(this.rimIn) + '"/>';
      if (text) {
        var fs = this.fontPx(a);
        s += '<text ' + white + ' x="' + cx + '" y="' + (+(cy + fs * this.capH * 0.5).toFixed(3)) + '" text-anchor="middle" font-size="' +
          (+fs.toFixed(3)) + '" font-weight="' + this.weight + '" font-family=\'' + this.font + '\' textLength="' + (+(a * this.textW).toFixed(3)) +
          '" lengthAdjust="spacingAndGlyphs">STOP</text>';
      }
      return s;
    }
  };

  /* Rotatoria (w_tiles, 2026-11-18): geometria UNICA do icone da Roundabout, usada pelo mapa (render.js drawPicto,
   * canvas), pela bandeja, guia e cartao de escolha (ui.js, SVG 48) e pelo How to play (menu.js usa o SVG da
   * bandeja). O aro com ponto lia como alvo; agora e a placa: tres setas curvas girando no sentido anti-horario (mao
   * direita) sobre um circulo. Tudo em fracoes de s (lado do icone). Caixa igual a do aro antigo: meia largura
   * 0,5 s (signExt do render devolve h = s/2 para a rotatoria; o carro parado e o toque nao mudam).
   *  R: raio do aro (linha do meio); w: espessura do aro; hw: meia largura da ponta (R + hw = 0,5);
   *  hb: comprimento da ponta ao longo do aro (rad); gap: vao antes da ponta seguinte (rad); tips: angulo da ponta
   *  (graus, y para baixo; nenhuma ponta no canto de cima a direita, onde o cartao poe a bolinha verde). */
  CRZ.ROUND_SIGN = {
    R: 0.33, w: 0.14, hw: 0.17, hb: 0.8, gap: 0.22, tips: [-30, 90, 210], bg: 0.47,   // variantes a 14..32 px: dev/review/w_tiles/sizes.html
    // 3 setas: {a0, a1} arco (rad, a0 < a1, a seta anda de a1 para a0) e a ponta [base externa, ponta, base interna]
    arrows: function (cx, cy, s) {
      var out = [], R = this.R * s, hw = this.hw * s, i, t, b;
      for (i = 0; i < this.tips.length; i++) {
        t = this.tips[i] * Math.PI / 180; b = t + this.hb;
        out.push({
          a0: b, a1: t + 2 * Math.PI / this.tips.length - this.gap,
          head: [[cx + Math.cos(b) * (R + hw), cy + Math.sin(b) * (R + hw)], [cx + Math.cos(t) * R, cy + Math.sin(t) * R],
                 [cx + Math.cos(b) * (R - hw), cy + Math.sin(b) * (R - hw)]]
        });
      }
      return out;
    },
    // SVG: ink = atributo de cor ('class="s-ink"' para o traco, 'class="f-ink"' para a ponta) ou fill/stroke direto
    svg: function (cx, cy, s, strokeAttr, fillAttr) {
      var A = this.arrows(cx, cy, s), R = this.R * s, f = function (v) { return +v.toFixed(3); }, out = '', i, a, p;
      for (i = 0; i < A.length; i++) {
        a = A[i];
        out += '<path ' + strokeAttr + ' fill="none" stroke-width="' + f(this.w * s) + '" d="M' + f(cx + Math.cos(a.a1) * R) + ' ' + f(cy + Math.sin(a.a1) * R) +
          'A' + f(R) + ' ' + f(R) + ' 0 0 0 ' + f(cx + Math.cos(a.a0) * R) + ' ' + f(cy + Math.sin(a.a0) * R) + '"/>';
        p = a.head;
        out += '<path ' + fillAttr + ' d="M' + f(p[0][0]) + ' ' + f(p[0][1]) + 'L' + f(p[1][0]) + ' ' + f(p[1][1]) + 'L' + f(p[2][0]) + ' ' + f(p[2][1]) + 'Z"/>';
      }
      return out;
    }
  };

  /* utilitario: PRNG deterministico (mulberry32). Todos usam este. */
  // Textos do jogo que citam dias fixos (integracao v2): os numeros saem do CFG, nunca escritos no texto.
  // CRZ.dayText('From {strikeDay}, ...') troca as marcas pelos valores de agora; objetos e listas: troca em toda string
  // (no lugar). Marcas: {strikeDay} primeiro dia em que um jam conta, {graceEnd} ultimo dia livre, {offerDay} primeira
  // oferta do dado, {keepDay} Keep, {upkeepDay} manutencao do semaforo, {roundDay} escolha da Roundabout,
  // {restartDay} primeiro dia em que a volta ao capitulo vale, {newjDay} cruzamento sem sinal mais lento,
  // {chapterLen} dias por capitulo, {chapters} capitulos.
  // primeiro dia com evento de lugar: calendario (capitulo, dia dentro do capitulo) em dia da partida
  function firstEventDay(C, L) {
    var cal = C.events && C.events.calendar, best = 0, i, d;
    for (i = 0; cal && i < cal.length; i++) { d = (cal[i].ch - 1) * L + cal[i].rel; if (!best || d < best) best = d; }
    return best || 13;
  }
  CRZ.dayText = function (x) {
    var C = CRZ.CFG || {}, D = C.dice || {}, L = C.chapterDays > 0 ? C.chapterDays : (C.chapterLen > 0 ? C.chapterLen : 10);
    var J = C.junction && C.junction.none && C.junction.none.late;
    var map = {
      '{strikeDay}': (C.strikeGraceUntil | 0) + 1, '{graceEnd}': C.strikeGraceUntil | 0,
      '{diceDay}': D.fromDay || 2, '{offerDay}': D.firstOffer || 7, '{keepDay}': D.keepFrom || 15,
      '{upkeepDay}': (C.upkeep && C.upkeep.fromDay) || 11, '{roundDay}': (C.choiceCard && C.choiceCard.day) || (C.tools && C.tools.round && (C.tools.round.choiceDay || C.tools.round.unlockDay)) || 19,
      '{restartDay}': C.noRestartBeforeDay | 0, '{newjDay}': (J && J.fromDay) || 4,
      '{chapterLen}': L, '{chapters}': Math.ceil((C.maxDays || 30) / L), '{days}': C.maxDays || 30,
      // textos de ajuda: pan com um dedo, pontos que passam ao dia seguinte, cargas do Boost, Road crew, primeiro evento
      '{panLast}': C.panLockDays != null ? C.panLockDays : 3, '{carry}': C.carryCap != null ? C.carryCap : 3,
      '{charges}': (C.clear && C.clear.charges) || 3, '{earlyDays}': (C.earlyBoost && C.earlyBoost.days) || 0,
      '{crewFrom}': (C.crew && C.crew.fromDay) || 16, '{crewTo}': (C.crew && C.crew.toDay) || 26, '{crewCost}': (C.crew && C.crew.cost) || 4,
      '{crewPer}': (C.crew && C.crew.perDay) || 1, '{crewDays}': (C.crew && C.crew.days) || 10, '{crewGap}': (C.crew && C.crew.gapDays) || 1,
      '{eventDay}': firstEventDay(C, L), '{patientPct}': Math.round((((C.cardEffects || {}).patient || {}).patienceMul || 1.3) * 100 - 100)
    };
    function one(t) { for (var k in map) if (t.indexOf(k) >= 0) t = t.split(k).join(String(map[k])); return t; }
    if (typeof x === 'string') return one(x);
    if (x && typeof x === 'object') for (var q in x) if (Object.prototype.hasOwnProperty.call(x, q)) {
      if (typeof x[q] === 'string') x[q] = one(x[q]); else if (x[q] && typeof x[q] === 'object') CRZ.dayText(x[q]);
    }
    return x;
  };

  // w_price: preco de tabela de uma peca no dia `day` (CFG.tools.<id>.costByChapter pelo capitulo do dia; sem a lista, cost).
  // Sem mao nem gratuidade: isso e do game (costOf). Infinity para peca que nao existe
  CRZ.toolPrice = function (tool, day) {
    var C = CRZ.CFG || {}, T = C.tools && Object.prototype.hasOwnProperty.call(C.tools, tool) ? C.tools[tool] : null;
    if (!T) return Infinity;
    var L = T.costByChapter, n = C.chapterDays > 0 ? C.chapterDays : (C.maxDays || 30);
    if (!Array.isArray(L) || !L.length) return T.cost;
    var ch = Math.max(1, Math.ceil((day > 0 ? day : 1) / n)), v = L[Math.min(L.length, ch) - 1];
    return typeof v === 'number' && v >= 0 ? v : T.cost;
  };

  CRZ.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    next.int = function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); };
    next.pick = function (arr) { return arr[Math.floor(next() * arr.length)]; };
    return next;
  };
})(typeof window !== 'undefined' ? window : globalThis);
