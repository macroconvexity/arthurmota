/**
 * In-memory game session API server for Chess the Gathering.
 * Pure TypeScript implementation of sim/play/server.py.
 */

import catalog from "./catalog.js";
import {
  WHITE,
  BLACK,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  sqName,
} from "./chess_engine.js";
                                              
import { Game, HAND_MAX, MANA_RULES, MANA_CAP, PRE_MOVE_ONLY } from "./game.js";
                                     
import { CARDS, ALL_IDS, STARTER_IDS } from "./cards.js";
import { RandomPolicy, SearchPolicy, EVAL, VAL, aiPostMoveCards } from "./policies.js";
import { MulberryRng, newRng } from "./rng.js";

export const MAX_PLIES = 300;
export const AI_TIME_CAP = 2.0;
export const MAX_SESSIONS = 100;
export const COLOUR = ["White", "Black"]         ;

export const PNAME                         = {
  [PAWN]: "pawn",
  [KNIGHT]: "knight",
  [BISHOP]: "bishop",
  [ROOK]: "rook",
  [QUEEN]: "queen",
  [KING]: "king",
};

export const PLETTER                         = {
  [PAWN]: "P",
  [KNIGHT]: "N",
  [BISHOP]: "B",
  [ROOK]: "R",
  [QUEEN]: "Q",
  [KING]: "K",
};

                         
             
               
              
                 
               
               
             
                  
                   
                       
                  
    
               
 

export const PUZZLES           = [
  {
    "id": 1,
    "card": "Pawn Rush",
    "fen": "6k1/5ppp/3P4/8/8/8/8/7K w - - 0 1",
    "hand": [
      1
    ],
    "mana": 1,
    "goal": "checkmate",
    "solution": {
      "card": 1,
      "params": [
        43
      ],
      "action": [
        [
          43,
          59,
          5
        ]
      ],
      "desc": "d6-d8=Q#"
    },
    "hint": "Use Pawn Rush on your pawn to advance two squares and promote directly to a queen for back-rank checkmate."
  },
  {
    "id": 2,
    "card": "Freeze",
    "fen": "r6k/6pp/8/8/8/8/8/3R3K w - - 0 1",
    "hand": [
      9
    ],
    "mana": 2,
    "goal": "checkmate",
    "solution": {
      "card": 9,
      "params": [
        56
      ],
      "action": [
        [
          3,
          59,
          0
        ]
      ],
      "desc": "Rd8#"
    },
    "hint": "Freeze the defending rook on a8 so it cannot capture your rook when you play Rd8#."
  },
  {
    "id": 3,
    "card": "Shove",
    "fen": "7k/3p2pp/5n2/8/8/3Q4/2B5/7K w - - 0 1",
    "hand": [
      10
    ],
    "mana": 2,
    "goal": "checkmate",
    "solution": {
      "card": 10,
      "params": [
        45,
        36
      ],
      "action": [
        [
          19,
          55,
          0
        ]
      ],
      "desc": "Qxh7#"
    },
    "hint": "Shove the knight on f6 away so it no longer defends h7, then deliver checkmate with Qxh7#."
  },
  {
    "id": 4,
    "card": "Shield",
    "fen": "4k3/3p1p2/8/2Q5/8/8/8/7K w - - 0 1",
    "hand": [
      12
    ],
    "mana": 3,
    "goal": "checkmate",
    "solution": {
      "card": 12,
      "params": [
        34
      ],
      "action": [
        [
          34,
          52,
          0
        ]
      ],
      "desc": "Qe7#"
    },
    "hint": "Shield your queen on c5 so the king cannot capture it, then deliver checkmate with Qe7#."
  },
  {
    "id": 5,
    "card": "Ambush",
    "fen": "7k/5ppp/8/3p4/8/8/8/3R3K w - - 0 1",
    "hand": [
      17
    ],
    "mana": 2,
    "goal": "checkmate",
    "solution": {
      "card": 17,
      "params": [
        35
      ],
      "action": [
        [
          3,
          59,
          0
        ]
      ],
      "desc": "Rd8#"
    },
    "hint": "Ambush the pawn on d5 to clear the d-file, then deliver checkmate with Rd8#."
  },
  {
    "id": 6,
    "card": "Execution",
    "fen": "7k/5ppp/8/3n4/8/8/8/3R3K w - - 0 1",
    "hand": [
      18
    ],
    "mana": 5,
    "goal": "checkmate",
    "solution": {
      "card": 18,
      "params": [
        35
      ],
      "action": [
        [
          3,
          59,
          0
        ]
      ],
      "desc": "Rd8#"
    },
    "hint": "Execute the knight on d5 to open the file, then deliver back-rank checkmate with Rd8#."
  },
  {
    "id": 7,
    "card": "Turncoat Pawn",
    "fen": "8/5kpp/8/3p2B1/8/B7/4Q3/7K w - - 0 1",
    "hand": [
      19
    ],
    "mana": 5,
    "goal": "checkmate",
    "solution": {
      "card": 19,
      "params": [
        35
      ],
      "action": [
        [
          12,
          44,
          0
        ]
      ],
      "desc": "Qe6#"
    },
    "hint": "Convert the pawn on d5 to your side so it defends your queen on e6 instead of capturing it, delivering Qe6#."
  },
  {
    "id": 8,
    "card": "Sacrifice",
    "fen": "7k/5ppp/8/3P4/8/8/8/3R3K w - - 0 1",
    "hand": [
      22
    ],
    "mana": 1,
    "goal": "checkmate",
    "solution": {
      "card": 22,
      "params": [
        35
      ],
      "action": [
        [
          3,
          59,
          0
        ]
      ],
      "desc": "Rd8#"
    },
    "hint": "Sacrifice your pawn on d5 to open the d-file, then deliver back-rank checkmate with Rd8#."
  },
  {
    "id": 9,
    "card": "Early Promotion",
    "fen": "7k/5Kpp/8/4P3/8/8/8/8 w - - 0 1",
    "hand": [
      24
    ],
    "mana": 4,
    "goal": "checkmate",
    "solution": {
      "card": 24,
      "params": [
        36,
        3
      ],
      "action": [
        [
          36,
          54,
          0
        ]
      ],
      "desc": "Bxg7#"
    },
    "hint": "Promote your pawn on e5 into a bishop and deliver checkmate with Bxg7#."
  },
  {
    "id": 10,
    "card": "Extra Step",
    "fen": "8/8/8/8/5K2/8/6R1/2R1N2k w - - 0 1",
    "hand": [
      2
    ],
    "mana": 2,
    "goal": "checkmate",
    "solution": {
      "card": 2,
      "params": [
        4
      ],
      "action": [
        [
          4,
          21,
          0
        ],
        [
          21,
          20,
          0
        ]
      ],
      "desc": "e1f3 then f3e3#"
    },
    "hint": "Play Extra Step on your knight on e1: it plays Nf3 and then takes one extra step to e3, and that is checkmate."
  },
  {
    "id": 11,
    "card": "Double Leap",
    "fen": "8/4N3/8/8/8/5N2/1K1p4/3k4 w - - 0 1",
    "hand": [
      3
    ],
    "mana": 2,
    "goal": "checkmate",
    "solution": {
      "card": 3,
      "params": [
        52
      ],
      "action": [
        [
          52,
          35,
          0
        ],
        [
          35,
          18,
          0
        ]
      ],
      "desc": "e7d5 then d5c3#"
    },
    "hint": "Play Double Leap on your knight on e7: Nd5 and then a second jump to c3 is checkmate."
  },
  {
    "id": 12,
    "card": "Borrowed Moves",
    "fen": "1R1R4/3BK3/8/8/8/k7/8/8 w - - 0 1",
    "hand": [
      4
    ],
    "mana": 3,
    "goal": "checkmate",
    "solution": {
      "card": 4,
      "params": [
        59
      ],
      "action": [
        [
          59,
          32,
          0
        ]
      ],
      "desc": "d8a5#"
    },
    "hint": "Play Borrowed Moves on the rook on d8 so that it moves like a bishop: Ra5 is checkmate."
  },
  {
    "id": 13,
    "card": "Swap Places",
    "fen": "2K2R2/8/2Q5/8/8/8/2n2B2/2k1r3 w - - 0 1",
    "hand": [
      5
    ],
    "mana": 3,
    "goal": "checkmate",
    "solution": {
      "card": 5,
      "params": [
        13,
        61
      ],
      "action": [
        [
          42,
          10,
          0
        ]
      ],
      "desc": "c6c2#"
    },
    "hint": "Play Swap Places to swap your bishop on f2 with your rook on f8, then give mate with Qc2."
  },
  {
    "id": 14,
    "card": "Second Move",
    "fen": "8/2p5/8/8/3R2K1/8/8/6k1 w - - 0 1",
    "hand": [
      6
    ],
    "mana": 5,
    "goal": "checkmate",
    "solution": {
      "card": 6,
      "params": [],
      "action": [
        [
          30,
          22,
          0
        ],
        [
          27,
          3,
          0
        ]
      ],
      "desc": "g4g3 then d4d1#"
    },
    "hint": "Play Second Move: first move your king to g3, then Rd1 is checkmate. The second move cannot capture."
  },
  {
    "id": 15,
    "card": "Fall Back",
    "fen": "5Q2/8/8/8/8/7k/2K2P2/q7 w - - 0 1",
    "hand": [
      7
    ],
    "mana": 1,
    "goal": "checkmate",
    "solution": {
      "card": 7,
      "params": [
        61,
        54
      ],
      "action": [
        [
          54,
          22,
          0
        ]
      ],
      "desc": "g7g3#"
    },
    "hint": "Play Fall Back to pull your queen from f8 back to g7, then Qg3 is checkmate."
  },
  {
    "id": 16,
    "card": "Wall",
    "fen": "3k4/8/6Q1/8/8/8/3K4/2R5 w - - 0 1",
    "hand": [
      11
    ],
    "mana": 2,
    "goal": "checkmate",
    "solution": {
      "card": 11,
      "params": [
        60
      ],
      "action": [
        [
          46,
          43,
          0
        ]
      ],
      "desc": "g6d6#"
    },
    "hint": "Put the Wall on e8 so the king cannot flee there, then play Qd6 for checkmate."
  },
  {
    "id": 17,
    "card": "Resurrection",
    "fen": "8/1Q5q/8/7k/3P4/5K2/8/8 w - - 0 1",
    "hand": [
      23
    ],
    "mana": 5,
    "goal": "checkmate",
    "solution": {
      "card": 23,
      "params": [
        3,
        2
      ],
      "action": [
        [
          49,
          55,
          0
        ]
      ],
      "desc": "b7h7#"
    },
    "hint": "Bring a bishop back to c1 with Resurrection, then Qh7 is checkmate."
  }
];

export function checkPuzzleGoal(puzzle        , g      )          {
  if (puzzle.goal === "checkmate") {
    return g.result === "white" && g.termination === "checkmate";
  }
  return false;
}

export const SHORT                         = {
  1: "Pawn jumps two squares",
  2: "Pawn or knight takes extra step",
  3: "Knight leaps twice this turn",
  4: "Rook, bishop or knight moves like another",
  5: "Swap two friendly non-king pieces",
  6: "Move two different pieces this turn",
  7: "Retreat a friendly piece one square",
  8: "Silence opponent cards next turn",
  9: "Freeze an enemy piece next turn",
  10: "Nudge an enemy piece",
  11: "Block a square for two turns",
  12: "Shield a friendly piece from capture",
  13: "Drain two mana from opponent next turn",
  14: "Reveal the opponent hand until next turn",
  15: "Force opponent to discard a random card",
  16: "Steal a random card from opponent",
  17: "Destroy an enemy pawn",
  18: "Execute an enemy knight or bishop",
  19: "Convert an enemy pawn to your side",
  20: "Draw two cards",
  21: "Gain two mana this turn",
  22: "Sacrifice a pawn to draw two cards",
  23: "Revive a captured knight or bishop home",
  24: "Promote advanced pawn to knight or bishop",
};

export const STEPS                                                    = {
  1: [{ kind: "sq", label: "Pick a pawn" }],
  2: [{ kind: "sq", label: "Pick a pawn or knight" }],
  3: [{ kind: "sq", label: "Pick a knight" }],
  4: [{ kind: "sq", label: "Pick a bishop, rook or knight" }],
  5: [
    { kind: "sq", label: "Pick a piece" },
    { kind: "sq", label: "Pick the piece to swap with" },
  ],
  7: [
    { kind: "sq", label: "Pick a piece" },
    { kind: "sq", label: "Pick where it falls back" },
  ],
  9: [{ kind: "sq", label: "Pick an enemy piece" }],
  10: [
    { kind: "sq", label: "Pick an enemy piece" },
    { kind: "sq", label: "Pick where it is shoved" },
  ],
  11: [{ kind: "sq", label: "Pick an empty square" }],
  12: [{ kind: "sq", label: "Pick one of your pieces" }],
  17: [{ kind: "sq", label: "Pick an enemy pawn" }],
  18: [{ kind: "sq", label: "Pick an enemy knight or bishop" }],
  19: [{ kind: "sq", label: "Pick an enemy pawn" }],
  22: [{ kind: "sq", label: "Pick one of your pawns" }],
  23: [
    { kind: "ptype", label: "Pick the piece type" },
    { kind: "sq", label: "Pick its home square" },
  ],
  24: [
    { kind: "sq", label: "Pick a pawn" },
    { kind: "ptype", label: "Pick the new piece" },
  ],
};

export const EFFECT_NAMES                         = {
  impulso: "Pawn Rush",
  passo: "Extra Step",
  salto: "Double Leap",
  emprestimo: "Borrowed Moves",
  segundo: "Second Move",
};

                              
             
               
               
                
               
               
                                           
                     
 

export function loadCatalog()                              {
  const out                              = {};
  for (const c of catalog     
               
                 
                 
                   
                       
     ) {
    out[c.id] = {
      id: c.id,
      name: c.name,
      cost: c.cost,
      short: SHORT[c.id] || "",
      text: c.effect,
      edge: c.edge_cases,
      steps: STEPS[c.id] || [],
      unordered: c.id === 5,
    };
  }
  return out;
}

export const CATALOG = loadCatalog();

export class TimedSearch extends SearchPolicy {
  playCardsTimed(g      , deadlineMs        )       {
    const origE = this.E;
    this.E = { ...EVAL, max_cards_per_turn: 1 };
    const me = g.toMove;
    for (let round = 0; round < 6; round++) {
      if (Date.now() > deadlineMs) {
        break;
      }
      const n = g.cards_played[me].length;
      this.playCards(g);
      if (g.cards_played[me].length === n) {
        break;
      }
    }
    this.E = origE;
  }
}

export const EASY_CARD_IDS = [20, 21, 14, 15, 16, 17, 10];

/** Between Easy and Normal: Normal's search, but it sometimes skips its cards and sometimes plays the 2nd to 5th best move. */
export class CasualPolicy extends TimedSearch {
           name         = "casual";
  slip = 0.35;
  skipCards = 0.35;

           playCardsTimed(g      , deadlineMs        )       {
    if (this.rng.random() < this.skipCards) return;
    super.playCardsTimed(g, deadlineMs);
  }

           chooseAction(g      , actions          )         {
    if (actions.length <= 1 || this.rng.random() >= this.slip) return super.chooseAction(g, actions);
    const me = g.toMove;
    const scored = actions.map((a) => ({ a, v: this._lineValue(g, me, a, true) }));
    scored.sort((x, y) => y.v - x.v);
    const k = Math.min(scored.length - 1, 1 + Math.floor(this.rng.random() * 4));
    return scored[k].a;
  }
}

/** For people who have never played: mostly random moves, a free piece is taken about a third of the time, and the only cards played are harmless ones. */
export class BeginnerPolicy extends RandomPolicy {
           name         = "beginner";

           playCards(g      )       {
    if (this.rng.random() >= 0.12) return;
    const ids = g.affordableCards().filter((id) => id === 14 || id === 20 || id === 21);
    if (!ids.length) return;
    const cid = this.rng.choice(ids);
    const opts = g.cardOptions(cid);
    if (opts.length) g.playCard(cid, this.rng.choice(opts));
  }

           chooseAction(g      , actions          )         {
    if (!actions.length) return [];
    if (this.rng.random() < 0.15) {
      const caps = actions.filter((a) => a.length > 0 && g.pos.board[a[0][1]] !== 0);
      if (caps.length) return this.rng.choice(caps);
    }
    return this.rng.choice(actions);
  }
}

export class EasyPolicy extends SearchPolicy {
           name         = "easy";
  errorRate        ;

  constructor(rng      , errorRate         = 0.1) {
    super(rng);
    this.errorRate = errorRate;
  }

           playCards(g      )       {
    if (this.rng.random() >= 0.5) return;
    const me = g.toMove;
    const opp = me ^ 1;
    const affordable = g.affordableCards();
    const candidateIds = affordable.filter(id => EASY_CARD_IDS.includes(id));
    if (!candidateIds.length) return;
    this.rng.shuffle(candidateIds);

    for (const cid of candidateIds) {
      if (cid === 20 || cid === 21 || cid === 14) {
        const opts = g.cardOptions(cid);
        if (opts.length > 0 && g.playCard(cid, opts[0])) return;
      } else if (cid === 15 || cid === 16) {
        if (g.hand[opp].length > 0) {
          const opts = g.cardOptions(cid);
          if (opts.length > 0 && g.playCard(cid, opts[0])) return;
        }
      } else if (cid === 17) {
        const opts = g.cardOptions(cid);
        if (opts.length > 0) {
          let bestOpt = opts[0];
          let maxAdv = -1;
          for (const opt of opts) {
            const sq = opt[0];
            const r = sq >> 3;
            const adv = opp === 0 ? r - 1 : 6 - r;
            if (adv > maxAdv) {
              maxAdv = adv;
              bestOpt = opt;
            }
          }
          if (g.playCard(cid, bestOpt)) return;
        }
      } else if (cid === 10) {
        const opts = g.cardOptions(cid);
        const useful                                           = [];
        for (const opt of opts) {
          const [fromSq, toSq] = opt;
          if (g.pos.isAttacked(toSq, me)) {
            const piece = g.pos.board[fromSq];
            const pieceVal = VAL[piece & 7] || 1;
            useful.push({ opt, val: pieceVal });
          }
        }
        if (useful.length > 0) {
          useful.sort((a, b) => b.val - a.val);
          if (g.playCard(cid, useful[0].opt)) return;
        }
      }
    }
  }

           chooseAction(g      , actions          )         {
    if (!actions.length) return [];
    if (this.rng.random() < this.errorRate) {
      return this.rng.choice(actions);
    }
    const me = g.toMove;
    let bestVal = -Infinity;
    let bestActs           = [];
    for (let i = 0; i < actions.length; i++) {
      const act = actions[i];
      const val = this._lineValue(g, me, act, true);
      if (val > bestVal + 1e-9) {
        bestVal = val;
        bestActs = [act];
      } else if (Math.abs(val - bestVal) <= 1e-9) {
        bestActs.push(act);
      }
    }
    return bestActs.length === 1 ? bestActs[0] : this.rng.choice(bestActs);
  }

           chooseDiscard(g      , color        )         {
    const hand = g.hand[color];
    const nonImmediate = hand.filter(cid => !EASY_CARD_IDS.includes(cid));
    if (nonImmediate.length > 0) {
      return this.rng.choice(nonImmediate);
    }
    return super.chooseDiscard(g, color);
  }
}

function pn(board          , s        )         {
  const p = board[s];
  if (!p) return "empty square";
  return `${COLOUR[p >> 3].toLowerCase()} ${PNAME[p & 7]}`;
}

export function describeParams(g      , cid        , params       )         {
  const b = g.pos.board;
  try {
    if ([6, 8, 13, 14, 15, 16, 20, 21].includes(cid)) {
      return "";
    }
    if (cid === 5) {
      const [a, z] = params;
      return `${pn(b, a)} ${sqName(a)} with ${pn(b, z)} ${sqName(z)}`;
    }
    if (cid === 7 || cid === 10) {
      const [a, z] = params;
      return `${pn(b, a)} ${sqName(a)} to ${sqName(z)}`;
    }
    if (cid === 23) {
      return `${PNAME[params[0]]} on ${sqName(params[1])}`;
    }
    if (cid === 24) {
      return `pawn ${sqName(params[0])} becomes a ${PNAME[params[1]]}`;
    }
    if (cid === 11) {
      return `on ${sqName(params[0])}`;
    }
    const s = params[0];
    return `${pn(b, s)} on ${sqName(s)}`;
  } catch {
    return "";
  }
}

export function describeAction(g      , action        )         {
  const b = Array.from(g.pos.board);
  let ep = g.pos.ep;
  const parts           = [];
  for (const [frm, to, promo] of action) {
    const p = b[frm];
    const t = p & 7;
    let cap = Boolean(b[to]);
    if (t === PAWN && ((frm ^ to) & 7) !== 0 && !b[to] && to === ep) {
      cap = true;
    }
    if (t === KING && Math.abs(to - frm) === 2) {
      parts.push(to > frm ? "O-O" : "O-O-O");
    } else {
      let s =
        (t === PAWN ? "" : PLETTER[t]) +
        sqName(frm) +
        (cap ? "x" : "-") +
        sqName(to);
      if (promo) {
        s += "=" + PLETTER[promo];
      }
      parts.push(s);
    }
    b[to] = b[frm];
    b[frm] = 0;
    ep = -1;
  }
  return parts.join(" then ");
}

export class Reject extends Error {
  constructor(message        ) {
    super(message);
    this.name = "Reject";
  }
}

function arrayEquals(a       , b       )          {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function actionEquals(a1        , a2        )          {
  if (a1.length !== a2.length) return false;
  for (let i = 0; i < a1.length; i++) {
    if (
      a1[i][0] !== a2[i][0] ||
      a1[i][1] !== a2[i][1] ||
      a1[i][2] !== a2[i][2]
    ) {
      return false;
    }
  }
  return true;
}

function sortCards(cards          )           {
  return [...cards].sort((a, b) => {
    const ca = CARDS[a]?.cost ?? 0;
    const cb = CARDS[b]?.cost ?? 0;
    if (ca !== cb) return ca - cb;
    return a - b;
  });
}

export function cloneGame(src      )       {
  const g = new Game({ seed: 0, rng: newRng(0), cardsOn: src.cardsOn });
  g.rng.setState(src.rng.getState());
  for (let i = 0; i < 64; i++) {
    g.pos.board[i] = src.pos.board[i];
  }
  g.pos.turn = src.pos.turn;
  g.pos.castling = src.pos.castling;
  g.pos.ep = src.pos.ep;
  g.pos.halfmove = src.pos.halfmove;
  g.pos.fullmove = src.pos.fullmove;
  g.pos.king = [src.pos.king[0], src.pos.king[1]];
  g.pos.keys = [...src.pos.keys];

  g.toMove = src.toMove;
  g.turnNo = [src.turnNo[0], src.turnNo[1]];
  g.phase = src.phase;
  g.cardsAfter = src.cardsAfter;
  g.refillTo = src.refillTo;
  g.autoReplace = src.autoReplace;
  g.mana = [src.mana[0], src.mana[1]];
  g.ritualUsed = src.ritualUsed;
  g.cardsPlayed = [[...src.cardsPlayed[0]], [...src.cardsPlayed[1]]];
  g.hand = [[...src.hand[0]], [...src.hand[1]]];
  g.deck = [[...src.deck[0]], [...src.deck[1]]];
  g.discard = [[...src.discard[0]], [...src.discard[1]]];
  g.effects = src.effects.map((e) => ({ ...e }));
  g.plies = src.plies;
  g.result = src.result;
  g.termination = src.termination;
  if (src.opening_hands) {
    g.opening_hands = [[...src.opening_hands[0]], [...src.opening_hands[1]]];
  }
  g.onCardPlayed = [];
  g._actions = null;
  return g;
}

export class Session {
  id        ;
  mode                             ;
  human               ;
  ai_level                                           ;
  deck_name                    ;
  seed        ;
  g      ;
  events                       ;
  export_log          ;
  last_move          ;
  mana_max                  ;
  cover         ;
  pending_discard         ;
  cards_after         ;
  ai_rng             ;
  policy                                                          ;
  last_ai_seconds        ;
  puzzle                = null;
  puzzle_data                = null;
  puzzle_solved                 = null;
  lessonGoal                = null;
  refill = false;   // draw back up to 5 cards each turn and swap cards that have no target
  snaps                        = [];   // snapshots for Undo: the state before each of the human's turns
  lastKey                = null;
  lessonPieces = 0;

  constructor(
    mode                             ,
    human               ,
    ai_level                                           ,
    seed        ,
    deck                     = "full",
    puzzle                = null,
    cardsAfter          = false,
    lesson                                                                     = null,
    refill          = false
  ) {
    // crypto.randomUUID exists only in secure contexts (https or localhost); a phone opening http://<mac-ip> needs the fallback.
    this.id = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, "0")).join("");
    this.mode = mode;
    this.human = mode === "puzzle" ? WHITE : human;
    this.ai_level = ai_level;
    this.deck_name = deck;
    this.seed = seed;
    const pz                     = lesson
      ? { id: 0, card: "Lesson", fen: lesson.fen, hand: lesson.hand, mana: lesson.mana, goal: lesson.goal, solution: { action: [] }, hint: "" }
      : puzzle !== null ? PUZZLES.find(p => p.id === puzzle) : undefined;
    this.lessonGoal = lesson ? lesson.goal : null;
    this.puzzle = pz ? pz.id : null;
    this.puzzle_data = pz || null;
    this.puzzle_solved = null;

    if (pz) {
      this.g = new Game({
        seed,
        cardsOn: true,
        rng: newRng(seed),
        fen: pz.fen,
        hand: [pz.hand.slice(), []],
        deck: [[], []],
      });
      this.mana_max = [pz.mana, 0];
      this.g.mana = [pz.mana, 0];
      this.lessonPieces = this._countPieces();
    } else {
      // Beginner plays a handicap game: the computer starts without its queen
      const handicap = ai_level === "beginner" && mode === "ai"
        ? (this.human === WHITE ? "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1")
        : undefined;
      this.g = new Game({
        seed,
        cardsOn: true,
        rng: newRng(seed),
        pool: deck === "starter" ? STARTER_IDS : undefined,
        fen: handicap,
      });
      this.mana_max = [0, 0];
    }
    this.cards_after = cardsAfter && (!pz || !!lesson);
    this.refill = refill && !pz;
    if (this.refill) { this.g.refillTo = 5; this.g.autoReplace = "refined"; }
    this.g.cardsAfter = this.cards_after;
    this.events = [];
    this.export_log = [];
    this.last_move = [];
    this.cover = false;
    this.pending_discard = false;
    this.ai_rng = newRng((seed ^ 0x5a5a5a) >>> 0);
    this.policy =
      ai_level === "normal"
        ? new TimedSearch(newRng((seed ^ 0x1234567) >>> 0))
        : ai_level === "casual"
        ? new CasualPolicy(newRng((seed ^ 0x2468ace) >>> 0))
        : ai_level === "beginner"
        ? new BeginnerPolicy(newRng((seed ^ 0x1357bdf) >>> 0))
        : new EasyPolicy(newRng((seed ^ 0x7654321) >>> 0));
    this.last_ai_seconds = 0.0;

    this._wrapPlayCard();
    if (this.mode === "puzzle" && pz) {
      this.g.phase = "cards";
    } else {
      this._begin();
      this._runAi();
    }
  }

  who(c        )         {
    if (this.mode === "ai") {
      return c === this.human ? "You" : "Opponent";
    }
    return COLOUR[c];
  }

  event(c        , text        , data                      = {})       {
    const ev                      = {
      n: this.events.length + 1,
      who: c,
      text: `${this.who(c)}: ${text}`,
      ...data,
    };
    this.events.push(ev);
  }

  logExport(c        , text        )       {
    this.export_log.push(`${this.who(c)}: ${text}`);
  }

  isAi(c        )          {
    return this.mode === "ai" && c !== this.human;
  }

  _wrapPlayCard()       {
    const g = this.g;
    const orig = g.playCard.bind(g);
    g.playCard = (cid        , params      = [])          => {
      const c = g.toMove;
      const desc = describeParams(
        g,
        cid,
        Array.isArray(params) ? params : [params]
      );
      const handLen0 = g.hand[c].length;
      const ok = orig(cid, params);
      if (ok) {
        const text = `plays ${CARDS[cid].name}${desc ? " " + desc : ""}`.trim();
        this.event(c, text, {
          kind: "card",
          card: cid,
          params: Array.isArray(params) ? [...params] : [params],
        });
        this.logExport(c, text);
        if (g.hand[c].length > handLen0 - 1) {
          const drawnCount = g.hand[c].length - (handLen0 - 1);
          const drawnCards = g.hand[c].slice(-drawnCount);
          const visible =
            this.mode === "hotseat" ||
            c === this.human ||
            (this.human !== null && g.revealedTo(this.human));
          for (const dId of drawnCards) {
            this.logExport(
              c,
              visible ? `draws ${CARDS[dId].name}` : "draws a card"
            );
          }
        }
      }
      return ok;
    };
  }

  _begin()       {
    const g = this.g;
    const c = g.toMove;
    const handLenBefore = g.hand[c].length;
    g.beginTurn();
    this.mana_max[c] = g.mana[c];
    if (g.replaced.length) {
      if (this.mode === "ai" && c === this.human) {
        for (const id of g.replaced) this.event(c, `swapped ${CARDS[id].name} (no target) for a new card`, { kind: "replace", card: id });
      }
      g.replaced = [];
    }

    this.logExport(c, `starts turn with ${g.mana[c]} mana`);

    if (g.cardsOn && g.hand[c].length > handLenBefore) {
      const drawnId = g.hand[c][g.hand[c].length - 1];
      const visible =
        this.mode === "hotseat" ||
        c === this.human ||
        (this.human !== null && g.revealedTo(this.human));
      this.logExport(
        c,
        visible ? `draws ${CARDS[drawnId].name}` : "draws a card"
      );
    }

    if (this.mode === "hotseat" && g.plies > 0) {
      this.cover = true;
    }
    if (!this.isAi(g.toMove)) {
      this._checkStuck();
    }
  }

  _hasCardPlay()          {
    const g = this.g;
    const affordable = g.affordableCards();
    for (const cid of affordable) {
      if (g.cardOptions(cid).length > 0) {
        return true;
      }
    }
    return false;
  }

  _checkStuck()       {
    const g = this.g;
    if (
      g.result === null &&
      g.legalActions().length === 0 &&
      !this._hasCardPlay()
    ) {
      this._noMoves();
    }
  }

  _noMoves()       {
    const g = this.g;
    const c = g.toMove;
    if (g.inCheck(c)) {
      g.finish(COLOUR[c ^ 1].toLowerCase(), "checkmate");
    } else {
      g.finish("draw", "stalemate");
    }
    this.cover = false;
    this.event(c, `has no legal move (${g.termination})`);
    this.logExport(c, `has no legal move (${g.termination})`);
  }

  _countPieces()         {
    let n = 0;
    for (const p of this.g.pos.board) if (p) n++;
    return n;
  }

  /** Did the move just made reach the goal of the current lesson step? */
  _lessonMet()          {
    const goal = this.lessonGoal || "";
    if (goal === "move") return true;
    if (goal.startsWith("to:")) {
      const sq = (goal.charCodeAt(4) - 49) * 8 + (goal.charCodeAt(3) - 97);
      for (let i = 1; i < this.last_move.length; i += 2) if (this.last_move[i] === sq) return true;
      return false;
    }
    if (goal === "capture") return this._countPieces() < this.lessonPieces;
    if (goal === "check") return this.g.inCheck(BLACK);
    return false;
  }

  _finishTurn()       {
    const g = this.g;
    if (this.lessonGoal && this.lessonGoal !== "mate" && g.result === null) {
      const ok = this._lessonMet();
      g.finish(ok ? "white" : "black", ok ? "lesson" : "lesson_fail");
      this.cover = false;
      return;
    }
    g.endTurn();
    if (g.result === null && g.plies >= MAX_PLIES) {
      g.finish("draw", "max_plies");
    }
    if (g.result !== null) {
      this.cover = false;
      return;
    }
    this._begin();
    this._runAi();
  }

  _postMove()       {
    if (this.cards_after && this.g.result === null && this._hasCardPlay()) {
      return; // spare mana and a playable card: the player may play it, then press End turn
    }
    this._endOfTurn();
  }

  _endOfTurn()       {
    const g = this.g;
    const c = g.toMove;
    if (g.hand[c].length > HAND_MAX) {
      this.pending_discard = true;
      return;
    }
    this._finishTurn();
  }

  _runAi()       {
    const g = this.g;
    if (g.result !== null || !this.isAi(g.toMove)) {
      return;
    }
    const t0 = Date.now();
    const deadline = t0 + AI_TIME_CAP * 1000;
    const c = g.toMove;
    if (this.ai_level !== "easy" && this.ai_level !== "beginner") {
      (this.policy               ).playCardsTimed(g, deadline);
    } else {
      this.policy.playCards(g);
    }
    const acts = g.legalActions();
    if (acts.length === 0) {
      this._noMoves();
      return;
    }
    const chosen = this.policy.chooseAction(g, acts);
    let matched = acts.find((a) => actionEquals(a, chosen));
    if (!matched) {
      matched = acts[0];
    }
    const desc = describeAction(g, matched);
    g.doAction(matched);
    this.last_move = matched.flatMap((m) => [m[0], m[1]]);
    this.event(c, "moves " + desc, {
      kind: "move",
      squares: [...this.last_move],
    });
    this.logExport(c, desc);
    if (g.cardsAfter && g.result === null) {
      aiPostMoveCards(g, this.policy.rng);
    }
    this.last_ai_seconds = (Date.now() - t0) / 1000.0;
    g.endTurn((game, col) => {
      const cid = this.policy.chooseDiscard(game, col);
      this.event(col, "discards " + CARDS[cid].name, {
        kind: "discard",
        card: cid,
      });
      this.logExport(col, "discards " + CARDS[cid].name);
      return cid;
    });
    if (g.result === null && g.plies >= MAX_PLIES) {
      g.finish("draw", "max_plies");
    }
    if (g.result !== null) {
      return;
    }
    this._begin();
  }

  _easyCards()       {
    this.policy.playCards(this.g);
  }

  viewer()         {
    return this.mode === "ai" && this.human !== null
      ? this.human
      : this.g.toMove;
  }

  _effectLabel(e                     )         {
    const g = this.g;
    const b = g.pos.board;
    const k = e.kind;
    const sq = e.sq;
    if (k === "freeze") {
      return `Frozen: ${pn(b, sq)} ${sqName(sq)}`;
    }
    if (k === "shield") {
      return `Shielded: ${pn(b, sq)} ${sqName(sq)}`;
    }
    if (k === "wall") {
      return `Wall on ${sqName(sq)}`;
    }
    if (k === "silence") {
      return `${COLOUR[e.target]} cannot play cards`;
    }
    if (k === "choke") {
      return `${COLOUR[e.target]} drained: 2 less mana next turn`;
    }
    if (k === "reveal") {
      return `${COLOUR[e.owner]} sees the opponent hand`;
    }
    if (k === "nocapture") {
      return `${COLOUR[e.owner]} cannot capture this turn`;
    }
    const name = EFFECT_NAMES[k] || k;
    if (sq !== undefined && sq !== null) {
      return `${name} active (${COLOUR[e.owner]}) on ${sqName(sq)}`;
    }
    return `${name} active (${COLOUR[e.owner]})`;
  }

  view()                      {
    const g = this.g;
    const v = this.viewer();
    const over = g.result !== null;
    const covered = this.cover && !over;
    const mine = g.toMove === v && !over && !covered;
    const post_move = mine && !this.pending_discard && g.cardsAfter && g.phase === "moved";
    const cards_phase = mine && !this.pending_discard && (g.phase === "cards" || post_move);

    const hand = covered ? null : sortCards(g.hand[v]);
    let opp_hand                  = null;
    if (!covered && g.revealedTo(v)) {
      opp_hand = sortCards(g.hand[v ^ 1]);
    }

    const cstate         
             
                                                           
      = {};
    let actions           = [];
    if (cards_phase) {
      const silenced = g.silenced(v);
      const uniqueHand = Array.from(new Set(g.hand[v])).sort((a, b) => a - b);
      for (const cid of uniqueHand) {
        const card = CARDS[cid];
        if (silenced) {
          cstate[String(cid)] = {
            playable: false,
            reason: "Silenced",
            options: [],
          };
        } else if (post_move && PRE_MOVE_ONLY.includes(cid)) {
          cstate[String(cid)] = {
            playable: false,
            reason: "Play before moving",
            options: [],
          };
        } else if (card.cost > g.mana[v]) {
          cstate[String(cid)] = {
            playable: false,
            reason: "Not enough mana",
            options: [],
          };
        } else {
          const opts = g
            .cardOptions(cid)
            .map((o     ) => (Array.isArray(o) ? [...o] : [o]));
          cstate[String(cid)] = {
            playable: opts.length > 0,
            reason: opts.length > 0 ? "" : "No legal target",
            options: opts,
          };
        }
      }
      if (g.phase === "cards") actions = g.legalActions().map((a) => a.map((m) => [m[0], m[1], m[2]]));
    }

    const board           = [];
    for (let i = 0; i < 64; i++) {
      const p = g.pos.board[i];
      if (!p) {
        board.push("");
      } else {
        const letter = PLETTER[p & 7] || "";
        board.push((p >> 3) === WHITE ? letter : letter.toLowerCase());
      }
    }

    const effects         
                   
                  
                     
                      
                    
       = [];
    for (const e of g.effects) {
      const k = e.kind;
      const d      = { kind: k };
      if (e.sq !== undefined) d.sq = e.sq;
      if (e.owner !== undefined) d.owner = e.owner;
      if (e.target !== undefined) d.target = e.target;
      d.label = this._effectLabel(e);
      effects.push(d);
    }

    const check =
      !over && g.inCheck(g.toMove) ? g.pos.king[g.toMove] : null;

    let status                                                        ;
    if (over) {
      status = "over";
    } else if (covered) {
      status = "cover";
    } else if (this.pending_discard) {
      status = "discard";
    } else if (mine) {
      status = "your_turn";
    } else {
      status = "waiting";
    }

    const discard_choices =
      status === "discard"
        ? Array.from(new Set(g.hand[v])).sort((a, b) => a - b)
        : [];

    return {
      actions,
      ai_level: this.ai_level,
      deck: this.deck_name,
      ...(this.puzzle != null ? { puzzle: (() => { const p = this.puzzle_data ; return { id: p.id, total: PUZZLES.length, card: p.card, hint: p.hint, ...(this.lessonGoal ? { lesson: true } : {}) }; })() } : {}),
      board,
      can_accept_no_moves: Boolean(cards_phase && !post_move && actions.length === 0),
      ...(post_move ? { post_move: true } : {}),
      ...(this.mode === "ai" && this.puzzle == null && g.result === null && this.snaps.length > 0 ? { can_undo: true } : {}),
      cards: cstate,
      check,
      colour: COLOUR[v],
      cover: covered,
      deck_sizes: [g.deck[0].length, g.deck[1].length],
      discard_choices,
      discard_sizes: [g.discard[0].length, g.discard[1].length],
      effects,
      flip: v === BLACK,
      game: this.id,
      hand,
      hand_max: HAND_MAX,
      hand_sizes: [g.hand[0].length, g.hand[1].length],
      human: this.human,
      last_move: [...this.last_move],
      log: this.events.slice(-10),
      mana: mine || !covered ? g.mana[v] : null,
      mana_max: !covered ? this.mana_max[v] : null,
      mana_cap: MANA_RULES.mode === "pool" ? MANA_RULES.cap : MANA_CAP,
      mana_income: MANA_RULES.mode === "pool" ? MANA_RULES.income : null,
      mode: this.mode === "puzzle" ? "ai" : this.mode,
      opp_hand,
      over,
      plies: g.plies,
      result: g.result,
      status,
      termination: g.termination,
      to_move: g.toMove,
      to_move_name: COLOUR[g.toMove],
      viewer: v,
    };
  }

  act(body                     )       {
    const g = this.g;
    const track =
      this.mode === "ai" && this.puzzle == null && g.result === null && !this.cover &&
      g.toMove === this.viewer() && (body.kind === "move" || body.kind === "card");
    const pre = track ? this.snapshot(false) : null;
    const key = g.plies + ":" + g.toMove;
    this._act(body);
    if (pre && key !== this.lastKey) {
      this.snaps.push(pre);
      if (this.snaps.length > 4) this.snaps.shift();
      this.lastKey = key;
    }
  }

  _act(body                     )       {
    const g = this.g;
    const kind = body.kind;
    if (g.result !== null) {
      throw new Reject("The game is over.");
    }
    const v = this.viewer();
    if (kind === "ready") {
      if (this.cover) {
        this.cover = false;
      }
      return;
    }
    if (this.cover && kind !== "resign") {
      throw new Reject("Pass the device first.");
    }
    if (g.toMove !== v) {
      throw new Reject("It is not your turn.");
    }
    if (kind === "resign") {
      g.finish(COLOUR[v ^ 1].toLowerCase(), "resignation");
      this.cover = false;
      this.pending_discard = false;
      this.event(v, "resigns");
      this.logExport(v, "resigns");
      return;
    }
    if (kind === "discard") {
      if (!this.pending_discard) {
        throw new Reject("No discard is pending.");
      }
      const cid = body.card;
      if (
        typeof cid !== "number" ||
        typeof cid === "boolean" ||
        !Number.isInteger(cid) ||
        !g.hand[v].includes(cid)
      ) {
        throw new Reject("That card is not in your hand.");
      }
      const idx = g.hand[v].indexOf(cid);
      g.hand[v].splice(idx, 1);
      g.discard[v].push(cid);
      this.event(v, "discards " + CARDS[cid].name);
      this.logExport(v, "discards " + CARDS[cid].name);
      if (g.hand[v].length <= HAND_MAX) {
        this.pending_discard = false;
        this._finishTurn();
      }
      return;
    }
    if (this.pending_discard) {
      throw new Reject(`Discard down to ${HAND_MAX} cards first.`);
    }
    if (kind === "card") {
      this._actCard(body, v);
    } else if (kind === "move") {
      this._actMove(body, v);
    } else if (kind === "endturn") {
      if (!(g.cardsAfter && g.phase === "moved")) {
        throw new Reject("Move first.");
      }
      this._endOfTurn();
    } else if (kind === "end") {
      if (g.legalActions().length > 0) {
        throw new Reject("You have a legal move.");
      }
      this._noMoves();
    } else {
      throw new Reject("Unknown action.");
    }
  }

  _actCard(body                     , v        )       {
    const g = this.g;
    const cid = body.card;
    const params = body.params !== undefined ? body.params : [];
    if (
      typeof cid !== "number" ||
      typeof cid === "boolean" ||
      !Number.isInteger(cid) ||
      !CARDS[cid] ||
      !Array.isArray(params) ||
      params.some(
        (x) =>
          typeof x !== "number" ||
          typeof x === "boolean" ||
          !Number.isInteger(x)
      )
    ) {
      throw new Reject("Bad card request.");
    }
    if (!g.hand[v].includes(cid)) {
      throw new Reject("That card is not in your hand.");
    }
    if (g.silenced(v)) {
      throw new Reject("You are silenced.");
    }
    if (CARDS[cid].cost > g.mana[v]) {
      throw new Reject("Not enough mana.");
    }
    const opts = g
      .cardOptions(cid)
      .map((o     ) => (Array.isArray(o) ? [...o] : [o]));
    let p = [...params];
    if (cid === 5 && p.length === 2) {
      if (
        !opts.some((o) => arrayEquals(o, p)) &&
        opts.some((o) => arrayEquals(o, [p[1], p[0]]))
      ) {
        p = [p[1], p[0]];
      }
    }
    if (!opts.some((o) => arrayEquals(o, p))) {
      throw new Reject("That card cannot be played that way.");
    }
    if (!g.playCard(cid, p)) {
      throw new Reject("That card cannot be played.");
    }
    if (this.lessonGoal === "card") {
      g.finish("white", "lesson");
      return;
    }
    if (g.phase === "moved") {
      if (g.result === null && !this._hasCardPlay()) {
        this._endOfTurn();
      }
      return;
    }
    this._checkStuck();
  }

  _actMove(body                     , v        )       {
    const g = this.g;
    const moves = body.moves;
    if (!Array.isArray(moves) || moves.length === 0) {
      throw new Reject("Bad move request.");
    }
    const action         = [];
    for (const m of moves) {
      if (!Array.isArray(m) || m.length !== 3) {
        throw new Reject("Bad move request.");
      }
      for (const x of m) {
        if (
          typeof x !== "number" ||
          typeof x === "boolean" ||
          !Number.isInteger(x)
        ) {
          throw new Reject("Bad move request.");
        }
      }
      action.push([m[0], m[1], m[2]]);
    }
    if (g.phase !== "cards") {
      throw new Reject(g.phase === "moved" ? "You already moved. Play a card or press End turn." : "You cannot move now.");
    }
    const legal = g.legalActions();
    const matched = legal.find((a) => actionEquals(a, action));
    if (!matched) {
      throw new Reject("Illegal move.");
    }
    const desc = describeAction(g, matched);
    g.doAction(matched);
    this.last_move = matched.flatMap((m) => [m[0], m[1]]);
    this.event(v, "moves " + desc, {
      kind: "move",
      squares: [...this.last_move],
    });
    this.logExport(v, desc);
    this._postMove();
  }

  snapshot(withUndo          = true)                      {
    const g = this.g;
    return {
      ...(withUndo ? { undo: this.snaps, last_key: this.lastKey } : {}),
      id: this.id,
      mode: this.mode,
      human: this.human,
      ai_level: this.ai_level,
      deck_name: this.deck_name,
      seed: this.seed,
      events: this.events.map((e) => ({ ...e })),
      export_log: [...this.export_log],
      last_move: [...this.last_move],
      mana_max: [...this.mana_max],
      cover: this.cover,
      pending_discard: this.pending_discard,
      cards_after: this.cards_after,
      refill: this.refill,
      last_ai_seconds: this.last_ai_seconds,
      ai_rng: this.ai_rng.getState(),
      policy_rng: this.policy.rng.getState(),
      game_state: {
        pos: {
          board: Array.from(g.pos.board),
          turn: g.pos.turn,
          castling: g.pos.castling,
          ep: g.pos.ep,
          halfmove: g.pos.halfmove,
          fullmove: g.pos.fullmove,
          king: [...g.pos.king],
          keys: [...g.pos.keys],
        },
        cardsOn: g.cardsOn,
        toMove: g.toMove,
        turnNo: [...g.turnNo],
        phase: g.phase,
        mana: [...g.mana],
        ritualUsed: g.ritualUsed,
        cardsPlayed: [
          [...g.cardsPlayed[0]],
          [...g.cardsPlayed[1]],
        ],
        hand: [[...g.hand[0]], [...g.hand[1]]],
        deck: [[...g.deck[0]], [...g.deck[1]]],
        discard: [[...g.discard[0]], [...g.discard[1]]],
        effects: g.effects.map((e) => ({ ...e })),
        plies: g.plies,
        result: g.result,
        termination: g.termination,
        rng: g.rng.getState(),
        opening_hands: g.opening_hands
          ? [[...g.opening_hands[0]], [...g.opening_hands[1]]]
          : undefined,
      },
    };
  }

  /**
   * Export the game as text for the "Copy game" feature (bug reporting and playtest).
   */
  exportText()         {
    const lines           = [];
    lines.push("Chess the Gathering - Game Export");
    lines.push("Rules: hand 4/5");
    lines.push(`Deck: ${this.deck_name}`);
    lines.push(`AI: ${this.mode === "ai" ? this.ai_level : "none"}`);
    lines.push(`Seed: ${this.seed}`);
    lines.push(`Mode: ${this.mode}`);
    if (this.mode === "ai" && this.human !== null) {
      lines.push(`Player: ${COLOUR[this.human]}`);
    }
    lines.push("");
    lines.push("Events:");
    for (let i = 0; i < this.export_log.length; i++) {
      lines.push(`${i + 1}. ${this.export_log[i]}`);
    }
    lines.push("");
    const res = this.g.result
      ? `${this.g.result} (${this.g.termination})`
      : "in progress";
    lines.push(`Result: ${res}`);
    lines.push(`Final FEN: ${this.g.pos.fen()}`);
    return lines.join("\n");
  }

  /**
   * Suggest a move/cards for the human player without affecting the game state.
   */
  hint()   
                
                                                  
                        
                 
    {
    const g = cloneGame(this.g);
    const initialBoard = Array.from(g.pos.board);
    const me = g.toMove;
    const opp = me ^ 1;

    const playedCards                                         = [];
    g.onCardPlayed.push((_game, _color, cid, params) => {
      playedCards.push({
        card: cid,
        params: Array.isArray(params) ? [...params] : [params],
      });
    });

    const policy = new TimedSearch(newRng((this.seed ^ 0x9876543) >>> 0));
    const deadline = Date.now() + 800;
    policy.playCardsTimed(g, deadline);

    const acts = g.legalActions();
    let chosenMove                = null;
    if (acts.length > 0) {
      const raw = policy.chooseAction(g, acts);
      const matched = acts.find((a) => actionEquals(a, raw)) || acts[0];
      chosenMove = matched.map((m) => [m[0], m[1], m[2]]);
    }

    let text = "";
    if (!chosenMove || acts.length === 0) {
      text = "No legal moves available.";
    } else {
      const [frm, to, promo] = chosenMove[0];
      const piece = g.pos.board[frm];
      const pt = piece & 7;
      const targetPiece =
        g.pos.board[to] ||
        (pt === PAWN && to === g.pos.ep
          ? g.pos.board[to + (me === WHITE ? -8 : 8)]
          : 0);

      let isCheck = false;
      let isMate = false;
      g.simulate(chosenMove, () => {
        isCheck = g.pos.isAttacked(g.pos.king[opp], me);
        if (isCheck && g.singleMoves(opp).length === 0) {
          isMate = true;
        }
      });

      const sanList = chosenMove.map(([f, t, pr]) => {
        const p = g.pos.board[f] & 7;
        if (p === KING && Math.abs(t - f) === 2) {
          return t > f ? "O-O" : "O-O-O";
        }
        return (
          (p === PAWN ? "" : PLETTER[p]) +
          sqName(t) +
          (pr ? "=" + PLETTER[pr] : "")
        );
      });
      const san = sanList.join(" then ");

      let movePhrase = "";
      if (isMate) {
        movePhrase = `Deliver checkmate with ${san}`;
      } else if (isCheck) {
        movePhrase = `Give check with ${san}`;
      } else if (targetPiece) {
        const targetName = PNAME[targetPiece & 7] || "piece";
        movePhrase = `Capture the ${targetName} on ${sqName(to)}`;
      } else if (pt === KING && Math.abs(to - frm) === 2) {
        movePhrase = `Castle ${to > frm ? "kingside" : "queenside"}`;
      } else {
        movePhrase = `Move ${san}`;
      }

      if (playedCards.length > 0) {
        const cardPhrases = playedCards.map(({ card, params }) => {
          const name = CARDS[card]?.name || "Card";
          if (!params || params.length === 0) {
            return `Play ${name}`;
          }
          const p0 = params[0];
          if (typeof p0 === "number" && p0 >= 0 && p0 < 64) {
            const pieceOnSq = initialBoard[p0];
            if (pieceOnSq) {
              return `Play ${name} on the ${PNAME[pieceOnSq & 7] || "piece"}`;
            }
            return `Play ${name} on ${sqName(p0)}`;
          }
          return `Play ${name}`;
        });
        const cardPhrase = cardPhrases.join(", then ");
        const movePart =
          movePhrase.charAt(0).toLowerCase() + movePhrase.slice(1);
        text = `${cardPhrase}, then ${movePart}`;
      } else {
        text = movePhrase;
      }
    }

    return {
      ok: true,
      cards: playedCards,
      move: chosenMove,
      text,
    };
  }

  static restore(snap     )          {
    const s = Object.create(Session.prototype)           ;
    s.id = snap.id;
    s.mode = snap.mode;
    s.human = snap.human;
    s.ai_level = snap.ai_level;
    s.deck_name = snap.deck_name === "starter" ? "starter" : "full";
    s.seed = snap.seed ?? 0;
    s.events = snap.events ? snap.events.map((e     ) => ({ ...e })) : [];
    s.export_log = snap.export_log ? [...snap.export_log] : [];
    s.last_move = snap.last_move ? [...snap.last_move] : [];
    s.mana_max = snap.mana_max ? [snap.mana_max[0], snap.mana_max[1]] : [0, 0];
    s.cover = snap.cover ?? false;
    s.pending_discard = snap.pending_discard ?? false;
    s.cards_after = snap.cards_after ?? false;
    s.refill = snap.refill ?? false;
    s.snaps = snap.undo ? snap.undo.slice() : [];
    s.lastKey = snap.last_key ?? null;
    s.last_ai_seconds = snap.last_ai_seconds ?? 0.0;

    const gSnap = snap.game_state;
    const gameRng = newRng(0);
    if (gSnap.rng !== undefined) {
      gameRng.setState(gSnap.rng);
    }
    const g = new Game({
      seed: 0,
      rng: gameRng,
      cardsOn: gSnap.cardsOn ?? true,
    });
    // The constructor deals a fresh hand and advances the rng; put the saved state back after it.
    if (gSnap.rng !== undefined) {
      gameRng.setState(gSnap.rng);
    }
    for (let i = 0; i < 64; i++) {
      g.pos.board[i] = gSnap.pos.board[i];
    }
    g.pos.turn = gSnap.pos.turn;
    g.pos.castling = gSnap.pos.castling;
    g.pos.ep = gSnap.pos.ep;
    g.pos.halfmove = gSnap.pos.halfmove;
    g.pos.fullmove = gSnap.pos.fullmove;
    g.pos.king = [gSnap.pos.king[0], gSnap.pos.king[1]];
    g.pos.keys = gSnap.pos.keys ? [...gSnap.pos.keys] : [];

    g.toMove = gSnap.toMove;
    g.turnNo = [gSnap.turnNo[0], gSnap.turnNo[1]];
    g.phase = gSnap.phase;
    g.mana = [gSnap.mana[0], gSnap.mana[1]];
    g.ritualUsed = gSnap.ritualUsed;
    g.cardsPlayed = [
      [...gSnap.cardsPlayed[0]],
      [...gSnap.cardsPlayed[1]],
    ];
    g.hand = [[...gSnap.hand[0]], [...gSnap.hand[1]]];
    g.deck = [[...gSnap.deck[0]], [...gSnap.deck[1]]];
    g.discard = [[...gSnap.discard[0]], [...gSnap.discard[1]]];
    g.effects = gSnap.effects.map((e     ) => ({ ...e }));
    g.plies = gSnap.plies;
    g.result = gSnap.result;
    g.termination = gSnap.termination;
    if (gSnap.opening_hands) {
      g.opening_hands = [
        [...gSnap.opening_hands[0]],
        [...gSnap.opening_hands[1]],
      ];
    }
    g._actions = null;
    g.cardsAfter = s.cards_after;
    if (s.refill) { g.refillTo = 5; g.autoReplace = "refined"; }
    s.g = g;

    s.ai_rng = newRng(0);
    if (snap.ai_rng !== undefined) {
      s.ai_rng.setState(snap.ai_rng);
    }

    const polRng = newRng(0);
    if (snap.policy_rng !== undefined) {
      polRng.setState(snap.policy_rng);
    }
    s.policy =
      s.ai_level === "normal"
        ? new TimedSearch(polRng)
        : s.ai_level === "casual"
        ? new CasualPolicy(polRng)
        : s.ai_level === "beginner"
        ? new BeginnerPolicy(polRng)
        : new EasyPolicy(polRng);

    s._wrapPlayCard();
    SESSIONS.set(s.id, s);
    return s;
  }
}

                                                          
                                                 

let persistFn                     = null;
let getPersistFn                        = null;

export function setPersist(
  fn                                                                  ,
  getFn                        
)       {
  if (typeof fn === "function") {
    persistFn = fn;
    if (getFn) getPersistFn = getFn;
  } else if (fn && typeof fn === "object") {
    if (fn.set) persistFn = fn.set;
    if (fn.get) getPersistFn = fn.get;
  } else {
    persistFn = null;
  }
}

export function setGetPersist(fn                       )       {
  getPersistFn = fn;
}

export function getPersist(id        )      {
  if (getPersistFn) {
    return getPersistFn(id);
  }
  return null;
}

export const SESSIONS = new Map                 ();

export function newSession(body                      = {})          {
  const mode = body.mode !== undefined ? body.mode : "ai";
  if (mode !== "ai" && mode !== "hotseat") {
    throw new Reject("Bad mode.");
  }
  const colour = body.colour !== undefined ? body.colour : "white";
  if (colour !== "white" && colour !== "black" && colour !== "random") {
    throw new Reject("Bad colour.");
  }
  const ai = body.ai !== undefined ? body.ai : "normal";
  if (ai !== "beginner" && ai !== "easy" && ai !== "casual" && ai !== "normal") {
    throw new Reject("Bad AI strength.");
  }
  let seed = body.seed;
  if (
    typeof seed !== "number" ||
    typeof seed === "boolean" ||
    !Number.isInteger(seed)
  ) {
    seed = Math.floor(Math.random() * 0x7fffffff);
  }
  let human                = null;
  if (mode === "ai") {
    if (colour === "random") {
      human = Math.random() < 0.5 ? WHITE : BLACK;
    } else {
      human = colour === "white" ? WHITE : BLACK;
    }
  }
  const deck = body.deck !== undefined ? body.deck : "full";
  if (deck !== "starter" && deck !== "full") {
    throw new Reject("Bad deck.");
  }
  let lesson                                                                     = null;
  if (body.lesson !== undefined) {
    const l = body.lesson;
    if (
      !l || typeof l.fen !== "string" || l.fen.length > 100 ||
      !Array.isArray(l.hand) || l.hand.length > 7 || l.hand.some((c     ) => !Number.isInteger(c) || !CARDS[c]) ||
      !Number.isInteger(l.mana) || l.mana < 0 || l.mana > 9 ||
      typeof l.goal !== "string" || !/^(move|capture|check|card|mate|to:[a-h][1-8])$/.test(l.goal)
    ) {
      throw new Reject("Bad lesson.");
    }
    lesson = { fen: l.fen, hand: l.hand.slice(), mana: l.mana, goal: l.goal };
  }
  let puzzle                = null;
  if (body.puzzle !== undefined) {
    if (!PUZZLES.some(p => p.id === body.puzzle)) throw new Reject("Bad puzzle.");
    puzzle = body.puzzle;
  }
  const s = lesson ? new Session("puzzle", WHITE, "easy", seed, "full", null, body.cards_after === true, lesson) : puzzle !== null ? new Session("puzzle", WHITE, "easy", seed, "full", puzzle) : new Session(mode, human, ai, seed, deck, null, body.cards_after === true, null, body.refill === true);
  SESSIONS.set(s.id, s);
  while (SESSIONS.size > MAX_SESSIONS) {
    const firstKey = SESSIONS.keys().next().value;
    if (firstKey !== undefined) {
      SESSIONS.delete(firstKey);
    }
  }
  return s;
}

export function handle(
  method                ,
  path        ,
  body          
)                                    {
  const qIdx = path.indexOf("?");
  const pathname = qIdx >= 0 ? path.slice(0, qIdx) : path;
  const queryStr = qIdx >= 0 ? path.slice(qIdx + 1) : "";

  if (method === "GET") {
    if (pathname === "/api/cards") {
      return {
        status: 200,
        json: { cards: ALL_IDS.map((id) => CATALOG[id]) },
      };
    }
    if (pathname === "/api/state") {
      const params = new URLSearchParams(queryStr);
      const gid = params.get("game") || "";
      let s = SESSIONS.get(gid);
      if (!s && gid) {
        const snap = getPersist(gid);
        if (snap) {
          try {
            s = Session.restore(snap);
          } catch {}
        }
      }
      if (!s) {
        return { status: 404, json: { ok: false, error: "Unknown game." } };
      }
      return { status: 200, json: { ok: true, state: s.view() } };
    }
    // GET /api/export?game=ID for "Copy game" button in UI
    if (pathname === "/api/export") {
      const params = new URLSearchParams(queryStr);
      const gid = params.get("game") || "";
      let s = SESSIONS.get(gid);
      if (!s && gid) {
        const snap = getPersist(gid);
        if (snap) {
          try {
            s = Session.restore(snap);
          } catch {}
        }
      }
      if (!s) {
        return { status: 404, json: { ok: false, error: "Unknown game." } };
      }
      return { status: 200, json: { ok: true, text: s.exportText() } };
    }
    // GET /api/hint?game=ID for Hint button in UI
    if (pathname === "/api/hint") {
      const params = new URLSearchParams(queryStr);
      const gid = params.get("game") || "";
      let s = SESSIONS.get(gid);
      if (!s && gid) {
        const snap = getPersist(gid);
        if (snap) {
          try {
            s = Session.restore(snap);
          } catch {}
        }
      }
      if (!s) {
        return { status: 404, json: { ok: false, error: "Unknown game." } };
      }
      const isHumanTurn =
        !s.g.result &&
        !s.cover &&
        !s.pending_discard &&
        s.g.phase === "cards" &&
        !s.isAi(s.g.toMove) &&
        (s.mode !== "ai" || s.g.toMove === s.human);

      if (!isHumanTurn) {
        return { status: 409, json: { ok: false, error: "Not your turn." } };
      }
      return { status: 200, json: s.hint() };
    }
    return { status: 404, json: { ok: false, error: "Not found." } };
  }

  if (method === "POST") {
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return { status: 400, json: { ok: false, error: "Bad JSON." } };
    }
    const b = body                       ;
    if (pathname === "/api/new") {
      try {
        const s = newSession(b);
        if (persistFn && s.puzzle == null) {
          try {
            persistFn(s.id, s.snapshot());
          } catch {}
        }
        return {
          status: 200,
          json: { ok: true, state: s.view(), events: [...s.events] },
        };
      } catch (e     ) {
        if (e instanceof Reject) {
          return { status: 400, json: { ok: false, error: e.message } };
        }
        throw e;
      }
    }
    if (pathname === "/api/action") {
      const gid = b.game;
      if (!gid || typeof gid !== "string") {
        return { status: 404, json: { ok: false, error: "Unknown game." } };
      }
      let s = SESSIONS.get(gid);
      if (!s) {
        const snap = getPersist(gid);
        if (snap) {
          try {
            s = Session.restore(snap);
          } catch {}
        }
      }
      if (!s) {
        return { status: 404, json: { ok: false, error: "Unknown game." } };
      }
      if (b.kind === "undo") {
        if (s.mode !== "ai" || s.puzzle != null) return { status: 400, json: { ok: false, error: "Undo is only for games against the computer.", state: s.view() } };
        if (s.g.result !== null) return { status: 400, json: { ok: false, error: "The game is over.", state: s.view() } };
        if (!s.snaps.length) return { status: 400, json: { ok: false, error: "Nothing to undo.", state: s.view() } };
        const rest = s.snaps.slice();
        const target = rest.pop() ;
        const back = Session.restore(target);
        back.snaps = rest;
        back.lastKey = null;
        SESSIONS.set(gid, back);
        if (persistFn) {
          try {
            persistFn(back.id, back.snapshot());
          } catch {}
        }
        return { status: 200, json: { ok: true, state: back.view(), events: [] } };
      }
      const start = s.events.length;
      try {
        s.act(b);
        if (persistFn && s.puzzle == null) {
          try {
            persistFn(s.id, s.snapshot());
          } catch {}
        }
        return {
          status: 200,
          json: {
            ok: true,
            state: s.view(),
            events: s.events.slice(start),
          },
        };
      } catch (e     ) {
        if (e instanceof Reject) {
          return {
            status: 400,
            json: {
              ok: false,
              error: e.message,
              state: s.view(),
            },
          };
        }
        throw e;
      }
    }
    return { status: 404, json: { ok: false, error: "Not found." } };
  }

  return { status: 404, json: { ok: false, error: "Not found." } };
}
