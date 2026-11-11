/* Cruzamento: constantes do jogo. Dono: orquestrador (Claude principal).
 * Os agentes LEEM este arquivo. Quem precisar mudar um numero escreve a
 * proposta em NOTES_<agente>.md; nao edite aqui. DOM-free (roda no node). */
(function (root) {
  'use strict';
  var CRZ = root.CRZ = root.CRZ || {};

  CRZ.CFG = {
    version: 1,
    maxDays: 12,          // uma partida
    maxStrikes: 3,        // travamentos permitidos antes do fim

    // geometria do mundo (unidades = px em zoom 1)
    snapAngle: 45,        // graus, estradas so em multiplos disso
    minRoadLen: 80,       // comprimento minimo de uma estrada nova
    maxRoadLen: 260,
    minNodeSpacing: 56,   // distancia minima entre dois nos
    nodePickRadius: 26,   // raio de toque em px de tela
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

    // dia
    // s a 1x (o dia roda a 4x por padrao; o jogador troca a velocidade). Dias 1 e 2 eram 22 e 32 (~5 s e 8 s
    // reais a 4x: o balao do dia 1 saia antes de ser lido); 48 e 64 dao 12 s e 16 s a 4x. Medido 2026-11-08:
    // nenhum strike nos dias 1 a 3 e vitorias dentro de 5 pontos (dev/balance/profiles.js, dev/novice2)
    dayLen:   [48, 64, 45, 60, 75, 90, 100, 110, 115, 120, 125, 130],
    speeds:   [1, 2, 4],  // multiplicadores de velocidade permitidos
    budget:   [2, 2, 3, 4, 5, 6, 7, 8, 8, 9, 9, 10],                   // pontos por dia
    carryCap: 3,          // pontos que sobram e passam ao dia seguinte
    // carros novos por segundo, por portal, antes do multiplicador do dado
    spawnRate: function (day) { return day === 1 ? 0.234 : 0.1326 + 0.01872 * day; },

    // ferramentas: custo e dia em que liberam
    tools: {
      road:    { cost: 2, unlockDay: 1 },
      stop:    { cost: 1, unlockDay: 3 },
      yield:   { cost: 1, unlockDay: 4 },
      light:   { cost: 4, unlockDay: 5 },
      upgrade: { cost: 3, unlockDay: 6 },
      cross:   { cost: 1, unlockDay: 7 },
      round:   { cost: 3, unlockDay: 8 },
      oneway:  { cost: 1, unlockDay: 9 }
    },
    toolOrder: ['road', 'stop', 'yield', 'light', 'upgrade', 'cross', 'round', 'oneway'],

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
      none:  { serve: 1.1, multiApproachPenalty: 0.10, late: { fromDay: 4, serve: 1.5, multiApproachPenalty: 1.2 } },
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
      stop:  { serve: 0.9, fullStop: 0.8 },
      yield: { serve: 0.6, minorServe: 1.1, minorMaxWait: 7, batch: 0 },
      light: { green: 5, allRed: 1.1, serve: 0.75, pairGreenBonus: 0.5, pairHold: 0.8, actuated: true, minGreen: 2.5, gapOut: 1 },
      round: { serve: 1.25, parallel: 1, parallelBig: 2, extraApproachPenalty: 0.1 },
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
    // 35% das ruas sem carro nenhum no dia (playtest da Roberta e web/dev/novice2).
    growPortal: { base: 0.55, perR: 1.0, min: 0.5, max: 0.95, weakRate: 0.3, fromPortal: 1.5,
      cap: function (day) { return Math.min(12, 2 + day); } },   // teto de portais cheios da cidade
    // aneis do crescimento (ligacoes entre nos existentes): a partir de fromDay, base + 1 com chance extraP,
    // + 1 a partir de lateDay. Cada anel abre cruzamentos novos sem sinal.
    growRing: { fromDay: 6, base: 1, extraP: 0.4, lateDay: 99 },
    // Trafego nas ruas de fora (2026-11-10, queixa da Roberta; medido em web/dev/sim/NOTES_TRAFFIC.md).
    // usefulGrowth (game.js growRing): o anel so liga dois nos se encurtar o caminho entre ao menos um par de pontas
    //   (portais) em mais de usefulMin px; sem isso 13 a 16% das ruas internas da borda ficavam quase vazias.
    //   DESLIGADO: 80 partidas por dificuldade, a fatia de internas vazias so caiu 16 -> 13% (Easy) e 13 -> 12% (Normal),
    //   alvo era <= 6% (o resto vem de ruas do jogador e de ramos de ponta fraca, nao de anel).
    // destDistK (sim.js spawnDest, do dia destFromDay em diante): peso do destino = taxa x (1 + destDistK x r / worldRadius),
    //   r = distancia da ponta ao centro do mundo (0,0). Mesmo 1 rng por sorteio. 0 = exatamente o jogo de antes.
    //   LIGADO (k = 2): aresta de fora / central 61 -> 66% (Easy), 63 -> 66% (Normal); carros +1%; vitorias no ruido.
    trafficBalance: { usefulGrowth: false, usefulMin: 1, destDistK: 0, destFromDay: 4 },
    // acima de portalRef(dia) portais da cidade, a taxa de cada um cai na proporcao (total constante)
    portalRef: function (day) { return Math.min(8, 2 + Math.floor((day + 1) / 2)); },

    // Velocidade como decisao (desde o dia 1): o jogador escolhe 1x, 2x ou 4x a qualquer momento do dia.
    // Mais rapido = cada carro entregue rende mais "gorjeta" (tips), mas os motoristas tem menos
    // paciencia (anel de estresse enche mais rapido). A cada `tipsPerPoint` gorjetas acumuladas
    // (os restos passam de um dia ao outro) o jogador ganha 1 build point no dia seguinte.
    // Nao ha desaceleracao automatica: quem controla e o jogador.
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
    // Dias de aprendizado (2026-11-09, Arthur: hipercasual, nunca so assistindo). Nos dias 1..days, durante o dia,
    // cada carga de Boost usada volta depois de regenSeconds de tempo de JOGO (sem passar de clear.charges). A partir
    // do 4o Boost do dia o carro mandado pela ponta nao paga gorjeta (Delivery bonus fica como se so 3 valessem).
    // days: 0 desliga. Dia > days: exatamente a regra antiga (3 cargas por dia).
    earlyBoost: { days: 3, regenSeconds: 5 },
    // Fast-forward (2026-11-10, Arthur: hipercasual, quando nao ha nada a fazer a jogadora PULA). Durante o dia,
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
    dice: {
      rerollCost: 1,   // pontos para relancar o dado do dia (uma vez por dia, so no planejamento)
      day1Face: 2,     // dia 1: dado escondido na UI, face fixa neutra (plain)
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

    // cartas do fim do dia (escolhe 1 de 3)
    cards: [
      { id: 'plus2',    weight: 3 },  // +2 pontos no proximo dia
      { id: 'freeRoad', weight: 2 },  // a proxima estrada nova custa 0
      { id: 'freeLight', weight: 1 }, // o proximo semaforo custa 0
      { id: 'patient',  weight: 2 },  // paciencia +30% no proximo dia
      { id: 'waveBonus', weight: 1 }, // onda verde vale o dobro no proximo dia
      { id: 'smooth',   weight: 2 }   // carros 10% mais rapidos no proximo dia
    ],
    // efeito de cada carta (game.js le daqui; a UI le por CRZ.Game cardInfo(id) para nao copiar numero)
    cardEffects: {
      plus2:     { budget: 2 },
      freeRoad:  { free: 'road' },
      freeLight: { free: 'light' },
      patient:   { patienceMul: 1.3 },
      waveBonus: { waveMul: 2 },
      smooth:    { speedMul: 1.1 }
    },

    // visual: todos usam estas cores
    colors: {
      bg: '#fffdf8', ink: '#111111', inkSoft: '#8a8a8a', grid: '#efeae0',
      red: '#d9261c', green: '#2f8f55', amber: '#f2a900', gray: '#cfcfcf', white: '#ffffff'
    }
  };

  /* utilitario: PRNG deterministico (mulberry32). Todos usam este. */
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
