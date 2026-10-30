/**
 * Policies for AI players (RandomPolicy, SearchPolicy) in TypeScript (identical to sim/policies.py).
 */

import {
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  KING_T,
  Position,
} from "./chess_engine.js";
                                              
import { CARDS } from "./cards.js";
import { Game } from "./game.js";
import { newRng, MulberryRng } from "./rng.js";
                                     

export const VAL                         = {
  [PAWN]: 1,
  [KNIGHT]: 3,
  [BISHOP]: 3,
  [ROOK]: 5,
  [QUEEN]: 9,
  [KING]: 0,
};

export const KEEP                         = {
  18: 9, 19: 8, 17: 8, 23: 6, 24: 6, 12: 6, 9: 5, 10: 5, 5: 4, 7: 3,
  6: 5, 3: 4, 4: 4, 2: 3, 1: 3, 8: 3, 13: 3, 16: 3, 15: 2, 11: 2,
  20: 4, 21: 2, 22: 1, 14: 1,
};

export const EVAL = {
  card_in_hand: 0.35,
  opp_card_in_hand: 0.35,
  drain_per_mana: 0.15,
  silence_value: 0.4,
  silence_min_cards: 2,
  reveal_value: 0.2,
  ritual_unlock: 0.5,
  unused_mana: 0.05,
  threshold_per_mana: 0.05,
  mobility: 0.03,
  king_danger: 0.1,
  pawn_advance: 0.03,
  check_bonus: 0.3,
  mate_value: 1000.0,
  move_noise: 0.03,
  hand_max: 7,
  k_lines_cards: 4,
  k_lines_move: 8,
  sample_per_card: 10,
  max_candidates: 12,
  max_cards_per_turn: 6,
};

export const COMPOUND = [1, 2, 3, 4, 6];

export class RandomPolicy {
  name         = "random";
  rng             ;

  constructor(rng      ) {
    this.rng = (rng               ) || newRng(0);
  }

  playCards(g      )       {
    const tried = new Set        ();
    while (true) {
      const affordable = g.affordableCards();
      const ids           = [];
      for (let i = 0; i < affordable.length; i++) {
        if (!tried.has(affordable[i])) {
          ids.push(affordable[i]);
        }
      }
      if (!ids.length) return;
      const choices                       = [...ids, null];
      const pick = this.rng.choice(choices);
      if (pick === null) return;
      const opts = g.cardOptions(pick);
      if (!opts.length) {
        tried.add(pick);
        continue;
      }
      if (g.playCard(pick, this.rng.choice(opts))) {
        tried.clear();
      } else {
        tried.add(pick);
      }
    }
  }

  chooseAction(_g      , actions          )         {
    return this.rng.choice(actions);
  }

  chooseDiscard(g      , color        )         {
    return this.rng.choice(g.hand[color]);
  }
}

function matAdv(pos          , me        )                   {
  let m = 0;
  let a = 0;
  const b = pos.board;
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (!p) continue;
    const t = p & 7;
    const col = p >> 3;
    const v = VAL[t];
    let adv = 0;
    if (t === PAWN) {
      const r = s >> 3;
      adv = col === 0 ? r - 1 : 6 - r;
    }
    if (col === me) {
      m += v;
      a += adv;
    } else {
      m -= v;
      a -= adv;
    }
  }
  return [m, a];
}

function replyGain(g      , opp        , me        )         {
  const pos = g.pos;
  const b = pos.board;
  const sets = g._effSets(opp);
  const pseudos = pos.pseudoLegalMoves();
  const cands                   = [];
  for (let i = 0; i < pseudos.length; i++) {
    const m = pseudos[i];
    const tgt = b[m[1]];
    if (!tgt || (tgt & 7) === KING) continue;
    let gain = VAL[tgt & 7];
    if (pos.isAttacked(m[1], me)) {
      gain -= VAL[b[m[0]] & 7];
    }
    cands.push([gain, m]);
  }
  cands.sort((x, y) => y[0] - x[0]);
  for (let i = 0; i < cands.length; i++) {
    const gain = cands[i][0];
    if (gain <= 0) return 0;
    if (g._filterMove(cands[i][1], opp, sets)) {
      return gain;
    }
  }
  return 0;
}

function kingDanger(pos          , c        )         {
  const k = pos.king[c];
  const neighbors = KING_T[k];
  let n = 0;
  for (let i = 0; i < neighbors.length; i++) {
    if (pos.isAttacked(neighbors[i], c ^ 1)) {
      n++;
    }
  }
  return n + (pos.isAttacked(k, c ^ 1) ? 3 : 0);
}

export class SearchPolicy extends RandomPolicy {
           name         = "search";
  E = EVAL;

  constructor(rng      ) {
    super(rng);
  }

  _lineValue(g      , me        , action        , full          = true)         {
    const E = this.E;
    const opp = me ^ 1;
    const pos = g.pos;

    const ev = () => {
      const [m, a] = matAdv(pos, me);
      let v = m + E.pawn_advance * a;
      if (pos.isAttacked(pos.king[opp], me)) {
        if (!g.singleMoves(opp).length) {
          return E.mate_value;
        }
        v += E.check_bonus;
      }
      if (!full) {
        return v;
      }
      v -= replyGain(g, opp, me);
      v -= E.king_danger * kingDanger(pos, me);
      v += E.king_danger * kingDanger(pos, opp);
      const mo = pos.pseudoLegalMoves().length;
      pos.turn = me;
      const ep = pos.ep;
      pos.ep = -1;
      const mm = pos.pseudoLegalMoves().length;
      pos.turn = opp;
      pos.ep = ep;
      v += E.mobility * (mm - mo);
      return v;
    };

    return g.simulate(action, ev);
  }

  _bestLine(
    g      ,
    me        ,
    k        ,
    noise         = 0.0
  )                          {
    g._actions = null;
    let acts = g.legalActions();
    g._actions = null;
    if (!acts.length) {
      return [-1e6, null];
    }
    if (acts.length > k) {
      const pre                             = [];
      for (let i = 0; i < acts.length; i++) {
        pre.push([
          this._lineValue(g, me, acts[i], false),
          this.rng.random(),
          acts[i],
        ]);
      }
      pre.sort((x, y) => y[0] - x[0] || x[1] - y[1]);
      acts = pre.slice(0, k).map((x) => x[2]);
    }
    let best = -1e18;
    let bestA                = null;
    for (let i = 0; i < acts.length; i++) {
      const v = this._lineValue(g, me, acts[i]) + (noise ? this.rng.random() * noise : 0.0);
      if (v > best) {
        best = v;
        bestA = acts[i];
      }
    }
    return [best, bestA];
  }

  _soft(g      , me        )         {
    const E = this.E;
    const opp = me ^ 1;
    const hm = E.hand_max;
    let v = E.card_in_hand * Math.min(g.hand[me].length, hm);
    v -= E.opp_card_in_hand * Math.min(g.hand[opp].length, hm);
    const nxt = Math.min(g.turnNo[opp] + 1, 5);
    for (let i = 0; i < g.effects.length; i++) {
      const e = g.effects[i];
      const k = e.kind;
      if (k === "choke" && e.target === opp) {
        v += E.drain_per_mana * Math.min(2, nxt);
      } else if (k === "silence" && e.target === opp) {
        if (g.hand[opp].length >= E.silence_min_cards) {
          v += E.silence_value;
        }
      } else if (k === "reveal" && e.owner === me) {
        v += E.reveal_value;
      }
    }
    v -= E.unused_mana * g.mana[me];
    return v;
  }

  _trial   (g      , me        , cid        , p     , fn         )    {
    const snap = g._snapshot();
    try {
      const idx = g.hand[me].indexOf(cid);
      if (idx !== -1) g.hand[me].splice(idx, 1);
      g.mana[me] -= CARDS[cid].cost;
      CARDS[cid].apply(g, me, p);
      g.fixEp();
      g._actions = null;
      return fn();
    } finally {
      g._restore(snap);
    }
  }

  _ritualBonusAfter(g      , me        , mana0        )         {
    for (let i = 0; i < g.hand[me].length; i++) {
      const c = g.hand[me][i];
      if (c !== 21 && mana0 < CARDS[c].cost && CARDS[c].cost <= mana0 + 1) {
        return this.E.ritual_unlock;
      }
    }
    return 0.0;
  }

           playCards(g      )       {
    const E = this.E;
    const me = g.toMove;
    for (let round = 0; round < E.max_cards_per_turn; round++) {
      const ids = g.affordableCards();
      if (!ids.length) return;
      const mana0 = g.mana[me];
      const base = this._soft(g, me) + this._bestLine(g, me, E.k_lines_cards)[0];

      // cheap 1-ply stage
      const cands                                  = [];
      for (let i = 0; i < ids.length; i++) {
        const cid = ids[i];
        let opts = g.cardOptions(cid);
        if (opts.length > E.sample_per_card) {
          opts = this.rng.sample(opts, E.sample_per_card);
        }
        for (let j = 0; j < opts.length; j++) {
          const p = opts[j];
          const cheap = () => {
            const [m, a] = matAdv(g.pos, me);
            return (
              m +
              E.pawn_advance * a +
              this._soft(g, me) -
              E.king_danger * kingDanger(g.pos, me) +
              E.king_danger * kingDanger(g.pos, me ^ 1) +
              (cid === 21 ? this._ritualBonusAfter(g, me, mana0) : 0.0)
            );
          };
          cands.push([
            this._trial(g, me, cid, p, cheap),
            this.rng.random(),
            cid,
            p,
          ]);
        }
      }

      if (!cands.length) return;
      cands.sort((x, y) => y[0] - x[0] || x[1] - y[1]);

      const short = cands.slice(0, E.max_candidates);
      const seen = new Set        ();
      for (let i = E.max_candidates; i < cands.length; i++) {
        const x = cands[i];
        if (
          COMPOUND.includes(x[2]) &&
          !seen.has(x[2]) &&
          !short.some((y) => y[2] === x[2])
        ) {
          seen.add(x[2]);
          short.push(x);
        }
      }

      let best                = null;
      let bestO                       = null;
      for (let i = 0; i < short.length; i++) {
        const cid = short[i][2];
        const p = short[i][3];
        const full = () => {
          let v = this._soft(g, me) + this._bestLine(g, me, E.k_lines_cards)[0];
          if (cid === 21) {
            v += this._ritualBonusAfter(g, me, mana0);
          }
          return v;
        };
        const val = this._trial(g, me, cid, p, full);
        const d = val - base - E.threshold_per_mana * CARDS[cid].cost;
        if (
          d > 0 &&
          (best === null ||
            d > best + 1e-12 ||
            (Math.abs(d - best) <= 1e-12 && this.rng.random() < 0.5))
        ) {
          best = d;
          bestO = [cid, p];
        }
      }

      if (bestO === null || !g.playCard(bestO[0], bestO[1])) {
        return;
      }
    }
  }

           chooseAction(g      , actions          )         {
    const [, a] = this._bestLine(
      g,
      g.toMove,
      this.E.k_lines_move,
      this.E.move_noise
    );
    if (a) {
      const aKey = JSON.stringify(a);
      const match = actions.find((x) => JSON.stringify(x) === aKey);
      if (match) return match;
    }
    return this.rng.choice(actions);
  }

           chooseDiscard(g      , color        )         {
    let low = Infinity;
    for (let i = 0; i < g.hand[color].length; i++) {
      const c = g.hand[color][i];
      if (KEEP[c] < low) {
        low = KEEP[c];
      }
    }
    const choices = g.hand[color].filter((c) => KEEP[c] === low);
    return this.rng.choice(choices);
  }
}

export function playGame(
  g      ,
  policies                              ,
  maxPlies         = 300,
  onTurnTiming                                      
)       {
  while (g.result === null) {
    const c = g.toMove;
    const pol = policies[c];
    const t0 = performance.now();
    g.beginTurn();
    if (g.cardsOn) {
      pol.playCards(g);
    }
    const acts = g.legalActions();
    if (!acts.length) {
      if (g.inCheck(c)) {
        g.finish(c === 0 ? "black" : "white", "checkmate");
      } else {
        g.finish("draw", "stalemate");
      }
      break;
    }
    const a = pol.chooseAction(g, acts);
    g.doAction(a);
    if (onTurnTiming) {
      onTurnTiming(performance.now() - t0, c);
    }
    g.endTurn((game, col) => pol.chooseDiscard(game, col));
    if (g.result === null && g.plies >= maxPlies) {
      g.finish("draw", "max_plies");
    }
  }
  return g;
}

/** Cards the AI is willing to spend leftover mana on after its chess move (cards_after rule). */
const POST_MOVE_FREE = [14, 15, 16, 20, 21];

function materialSum(g      , c        )         {
  let t = 0;
  for (let i = 0; i < 64; i++) {
    const p = g.pos.board[i];
    if (p && (p >> 3) === c) t += VAL[p & 7] || 0;
  }
  return t;
}

/**
 * AI cards after its chess move. The line search cannot run once the turn has flipped, so this is a
 * plain rule: play a card that wins material by itself, else spend spare mana on an information card.
 */
export function aiPostMoveCards(g      , rng     )       {
  const me = g.toMove;
  for (let guard = 0; guard < 4; guard++) {
    const ids = g.affordableCards();
    if (!ids.length) return;
    const base = materialSum(g, me) - materialSum(g, me ^ 1);
    let best                       = null;
    let bestDelta = 0.5 - 1e-9;
    for (const cid of ids) {
      if (![17, 18, 19].includes(cid)) continue;
      for (const p of g.cardOptions(cid)) {
        const d = g.whatif(cid, p, () => materialSum(g, me) - materialSum(g, me ^ 1)) - base;
        if (d > bestDelta) {
          best = [cid, p];
          bestDelta = d;
        }
      }
    }
    if (!best) {
      const free = ids.filter((i) => POST_MOVE_FREE.includes(i) && g.cardOptions(i).length > 0);
      if (!free.length || rng.random() < 0.5) return;
      const cid = rng.choice(free);
      best = [cid, rng.choice(g.cardOptions(cid))];
    }
    if (!g.playCard(best[0], best[1])) return;
  }
}
