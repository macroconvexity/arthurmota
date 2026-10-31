/**
 * Game layer in TypeScript: Position + hands, decks, mana, card effects (identical to sim/game.py).
 */

import {
  WHITE,
  BLACK,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  START_FEN,
  Position,
  KNIGHT_T,
  RAYS,
  CASTLE_MASK,
} from "./chess_engine.js";
                                              
import { CARDS, ALL_IDS, KDELTAS } from "./cards.js";

// Opening hands always hold a card playable on turn 1 (Reveal, Ritual or Sacrifice, all cost 1 and need no board state);
// otherwise the last hand card swaps with the first such card in the deck (deterministic, no rng). Mirrors sim/game.py.
const OPENING_PLAYABLE = [14, 21, 22];
function openingFix(hand          , deck          )       {
  if (hand.length === 0 || hand.some((h) => OPENING_PLAYABLE.includes(h))) return;
  const j = deck.findIndex((c) => OPENING_PLAYABLE.includes(c));
  if (j >= 0) {
    const t = hand[hand.length - 1];
    hand[hand.length - 1] = deck[j];
    deck[j] = t;
  }
}

export const HAND_START                   = [4, 4];
export const HAND_MAX = 7;
/** Cards that need an enemy piece or a pawn of yours: when none is left they cannot come back to life soon. */
const TARGET_BOUND = [9, 10, 17, 18, 19, 22, 24];
/** Cards that are dead only until something happens (a capture, a card in the rival's hand): never swapped away. */
const WAITS_FOR_EVENTS = [15, 16, 23];
/** Cards that only change the next chess move; they cannot be played after it. */
export const PRE_MOVE_ONLY = [1, 2, 3, 4, 6];
export const MANA_CAP = 5;
// "refill": mana = min(turn, MANA_CAP) every turn. "pool": income per turn on top of unspent mana, up to cap. Mirrors sim/game.py.
export const MANA_RULES                                                                                    = { mode: "pool", income: 2, cap: 5, first: [2, 3] };
export const COLOR_NAME = ["white", "black"]         ;

export function knightShape(m      )          {
  const df = Math.abs((m[1] & 7) - (m[0] & 7));
  const dr = Math.abs((m[1] >> 3) - (m[0] >> 3));
  return df * dr === 2;
}

                         
               
                 
                  
              
                  
                    
             
                         
 

                      
                               
                             
                      
                             
 

class SimpleRng                {
          seed        ;

  constructor(seed         = 0) {
    this.seed = seed;
  }

  randrange(n        )         {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed % n;
  }

  shuffle(a          )       {
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.randrange(i + 1);
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
  }

  getState()          {
    return this.seed;
  }

  setState(s         )       {
    this.seed = s          ;
  }
}

                              
                
                    
               
                              
                              
            
                  
 

export class Game {
  seed        ;
  rng     ;
  cardsOn         ;
  pos          ;
  toMove        ;
  hand                      ;
  deck                      ;
  discard                      ;
  opening_hands                      ;
  mana                  ;
  turnNo                  ;
  effects          ;
  ritualUsed         ;
  phase                                     ;
  /** Cards may also be played after the chess move (except the ones that only change the next move). */
  cardsAfter          = false;
  plies        ;
  result                                   ;
  refillTo        ;
  autoReplace        ;   // "" off, "refined" (default for the game), "all", or "1" (only target-bound cards)
  replaced           = [];
  termination               ;
  cardsPlayed                      ;
  onCardPlayed                                                               ;
  onAction                                                      ;

  _actions                 ;
  _aset             ;

  constructor(opts              ) {
    this.seed = opts?.seed || 0;
    this.rng = opts?.rng || new SimpleRng(this.seed);
    this.cardsOn = opts?.cardsOn !== undefined ? opts.cardsOn : true;
    this.refillTo = typeof process !== "undefined" && process.env && process.env.CTG_REFILL ? Number(process.env.CTG_REFILL) : 0;
    this.autoReplace = typeof process !== "undefined" && process.env && process.env.CTG_AUTOREPLACE ? process.env.CTG_AUTOREPLACE : "";
    this.pos = new Position(opts?.fen || START_FEN);
    this.pos.legalFilter = (p          , m      ) => this._engineFilter(p, m);
    this.toMove = this.pos.turn;

    this.hand = [[], []];
    this.deck = [[], []];
    this.discard = [[], []];

    if (opts?.hand && opts?.deck) {
      this.hand = [opts.hand[0].slice(), opts.hand[1].slice()];
      this.deck = [opts.deck[0].slice(), opts.deck[1].slice()];
    } else if (this.cardsOn) {
      for (const c of [WHITE, BLACK]) {
        const d = (opts?.pool && opts.pool.length ? opts.pool : ALL_IDS).slice();
        this.rng.shuffle(d);
        const n = HAND_START[c];
        this.hand[c] = d.slice(0, n);
        this.deck[c] = d.slice(n);
        openingFix(this.hand[c], this.deck[c]);
      }
    }

    this.opening_hands = [this.hand[0].slice(), this.hand[1].slice()];
    this.mana = [0, 0];
    this.turnNo = [0, 0];
    this.effects = [];
    this.ritualUsed = false;
    this.phase = "idle";
    this.plies = 0;
    this.result = null;
    this.termination = null;
    this.cardsPlayed = [[], []];
    this.onCardPlayed = [];
    this.onAction = [];
    this._actions = null;
    this._aset = new Set        ();
  }

  // Compatibility getters
  get cards_on()          {
    return this.cardsOn;
  }
  get to_move()         {
    return this.toMove;
  }
  set to_move(val        ) {
    this.toMove = val;
  }
  get turn_no()                   {
    return this.turnNo;
  }
  get ritual_used()          {
    return this.ritualUsed;
  }
  set ritual_used(val         ) {
    this.ritualUsed = val;
  }
  get cards_played()                       {
    return this.cardsPlayed;
  }

  // Small helpers
  inCheck(c        )          {
    return this.pos.isAttacked(this.pos.king[c], c ^ 1);
  }

  addEffect(kind        , kw                          )       {
    const e         = { kind, ...(kw || {}) };
    this.effects.push(e);
  }

  wallSquares()              {
    const set = new Set        ();
    for (let i = 0; i < this.effects.length; i++) {
      if (this.effects[i].kind === "wall" && this.effects[i].sq !== undefined) {
        set.add(this.effects[i].sq );
      }
    }
    return set;
  }

  silenced(c        )          {
    return this.effects.some((e) => e.kind === "silence" && e.target === c);
  }

  revealedTo(viewer        )          {
    return this.effects.some((e) => e.kind === "reveal" && e.owner === viewer);
  }

  visibleHand(viewer        )                  {
    return this.revealedTo(viewer) ? this.hand[viewer ^ 1].slice() : null;
  }

  _kingsOk(c        )          {
    const pos = this.pos;
    const b = pos.board;
    if (b[pos.king[WHITE]] !== KING || b[pos.king[BLACK]] !== (KING | 8)) {
      return false;
    }
    let whiteKings = 0;
    let blackKings = 0;
    for (let i = 0; i < 64; i++) {
      if (b[i] === KING) whiteKings++;
      else if (b[i] === (KING | 8)) blackKings++;
    }
    if (whiteKings !== 1 || blackKings !== 1) {
      return false;
    }
    return !this.inCheck(c);
  }

  dropEffectsAt(sq        )       {
    this.effects = this.effects.filter(
      (e) => !(e.sq === sq && e.kind !== "wall")
    );
  }

  moveEffects(frm        , to        )       {
    for (let i = 0; i < this.effects.length; i++) {
      const e = this.effects[i];
      if (e.sq === frm && e.kind !== "wall") {
        e.sq = to;
      }
    }
  }

  touch(sq        )       {
    this.pos.castling &= CASTLE_MASK[sq];
  }

  remove(sq        )       {
    this.pos.board[sq] = 0;
    this.dropEffectsAt(sq);
    this.touch(sq);
  }

  relocate(frm        , to        )       {
    const b = this.pos.board;
    b[to] = b[frm];
    b[frm] = 0;
    this.moveEffects(frm, to);
    this.touch(frm);
    this.touch(to);
  }

  swap(a        , z        )       {
    const b = this.pos.board;
    const tmp = b[a];
    b[a] = b[z];
    b[z] = tmp;
    for (let i = 0; i < this.effects.length; i++) {
      const e = this.effects[i];
      if (e.kind !== "wall" && e.sq !== undefined) {
        if (e.sq === a) {
          e.sq = z;
        } else if (e.sq === z) {
          e.sq = a;
        }
      }
    }
    this.touch(a);
    this.touch(z);
  }

  fixEp()       {
    const pos = this.pos;
    if (pos.ep < 0) return;
    const b = pos.board;
    const pawnSq = pos.turn === WHITE ? pos.ep - 8 : pos.ep + 8;
    const pawn = pos.turn === WHITE ? PAWN | 8 : PAWN;
    if (b[pos.ep] || pawnSq < 0 || pawnSq >= 64 || b[pawnSq] !== pawn) {
      pos.ep = -1;
    }
  }

  // Cards: hands and play
  draw(c        , n         = 1)       {
    for (let i = 0; i < n; i++) {
      if (!this.deck[c].length) {
        if (!this.discard[c].length) {
          return;
        }
        this.deck[c] = this.discard[c];
        this.discard[c] = [];
        this.rng.shuffle(this.deck[c]);
      }
      this.hand[c].push(this.deck[c].pop() );
    }
  }

  _cardPhase()          {
    return this.phase === "cards" || (this.cardsAfter && this.phase === "moved");
  }

  affordableCards()           {
    if (!this.cardsOn || !this._cardPhase() || this.result !== null) {
      return [];
    }
    const c = this.toMove;
    if (this.silenced(c)) {
      return [];
    }
    const out           = [];
    const seen = new Set        ();
    for (let i = 0; i < this.hand[c].length; i++) {
      const cid = this.hand[c][i];
      if (this.phase === "moved" && PRE_MOVE_ONLY.includes(cid)) continue;
      if (!seen.has(cid) && CARDS[cid].cost <= this.mana[c]) {
        seen.add(cid);
        out.push(cid);
      }
    }
    return out;
  }

  cardOptions(cid        )        {
    if (!this.affordableCards().includes(cid)) {
      return [];
    }
    return CARDS[cid].options(this, this.toMove);
  }

  simOk(c        , mut                          , post                )          {
    const b = this.pos.board;
    const saved = b.slice();
    try {
      if (!mut(b)) return false;
      if (!this._kingsOk(c)) return false;
      return post ? post() : true;
    } finally {
      for (let i = 0; i < 64; i++) {
        b[i] = saved[i];
      }
    }
  }

  _snapshot()      {
    const pos = this.pos;
    return [
      pos.board.slice(),
      [pos.king[0], pos.king[1]],
      pos.ep,
      pos.castling,
      pos.halfmove,
      this.effects.map((e) => ({ ...e })),
      [this.hand[0].slice(), this.hand[1].slice()],
      [this.deck[0].slice(), this.deck[1].slice()],
      [this.discard[0].slice(), this.discard[1].slice()],
      [this.mana[0], this.mana[1]],
      this.ritualUsed,
      this.rng.getState(),
      [this.cardsPlayed[0].slice(), this.cardsPlayed[1].slice()],
      pos.keys.slice(),
    ];
  }

  _restore(s     )       {
    const pos = this.pos;
    pos.board = s[0].slice();
    pos.king = [s[1][0], s[1][1]];
    pos.ep = s[2];
    pos.castling = s[3];
    pos.halfmove = s[4];
    this.effects = s[5].map((e     ) => ({ ...e }));
    this.hand = [s[6][0].slice(), s[6][1].slice()];
    this.deck = [s[7][0].slice(), s[7][1].slice()];
    this.discard = [s[8][0].slice(), s[8][1].slice()];
    this.mana = [s[9][0], s[9][1]];
    this.ritualUsed = s[10];
    this.rng.setState(s[11]);
    this.cardsPlayed = [s[12][0].slice(), s[12][1].slice()];
    pos.keys = s[13].slice();
    this._actions = null;
  }

  playCard(cid        , params      = [])          {
    const c = this.toMove;
    if (
      !this._cardPhase() ||
      !this.cardsOn ||
      this.result !== null ||
      !this.hand[c].includes(cid) ||
      this.silenced(c) ||
      (this.phase === "moved" && PRE_MOVE_ONLY.includes(cid))
    ) {
      return false;
    }
    const card = CARDS[cid];
    if (card.cost > this.mana[c] || !card.legal(this, c, params)) {
      return false;
    }

    const snap = this._snapshot();
    const idx = this.hand[c].indexOf(cid);
    this.hand[c].splice(idx, 1);
    this.mana[c] -= card.cost;
    this.discard[c].push(cid);
    card.apply(this, c, params);
    this.fixEp();
    this.pos.keys[this.pos.keys.length - 1] = this.pos.key();
    this.cardsPlayed[c].push(cid);

    if (!this._kingsOk(c)) {
      this._restore(snap);
      return false;
    }

    this._actions = null;
    for (let i = 0; i < this.onCardPlayed.length; i++) {
      this.onCardPlayed[i](this, c, cid, params);
    }
    return true;
  }

  whatif   (cid        , params     , fn         )    {
    const pos = this.pos;
    const sBoard = pos.board.slice();
    const sKing = [pos.king[0], pos.king[1]];
    const sEp = pos.ep;
    const sCastling = pos.castling;
    const sEffects = this.effects.map((e) => ({ ...e }));
    try {
      CARDS[cid].apply(this, this.toMove, params);
      return fn();
    } finally {
      pos.board = sBoard;
      pos.king = [sKing[0], sKing[1]];
      pos.ep = sEp;
      pos.castling = sCastling;
      this.effects = sEffects;
    }
  }

  // Turn flow
  beginTurn(draw          = true)       {
    const c = this.toMove;
    this.turnNo[c]++;
    this.effects = this.effects.filter((e) => e.start_of !== c);
    let chokes = 0;
    for (let i = 0; i < this.effects.length; i++) {
      if (this.effects[i].kind === "choke" && this.effects[i].target === c) {
        chokes++;
      }
    }
    this.effects = this.effects.filter(
      (e) => !(e.kind === "choke" && e.target === c)
    );
    if (this.cardsOn && draw) {
      if (this.refillTo > 0) {
        for (let k = 0; k < 3 && this.hand[c].length < this.refillTo; k++) this.draw(c, 1);
      } else {
        this.draw(c, 1);
      }
    }
    if (MANA_RULES.mode === "pool") {
      const inc = this.turnNo[c] === 1 ? MANA_RULES.first[c] : MANA_RULES.income;
      this.mana[c] = Math.min(MANA_RULES.cap, this.mana[c] + Math.max(0, inc - 2 * chokes));
    } else {
      this.mana[c] = Math.max(0, Math.min(this.turnNo[c], MANA_CAP) - 2 * chokes);
    }
    this.ritualUsed = false;
    this.phase = "cards";
    this._actions = null;
    if (this.autoReplace && this.cardsOn && draw && !this.inCheck(c)) this._replaceDeadCards(c);
  }

  /** Experiment (off by default): a hand card whose targets are gone for good goes to the discard and is replaced. */
  _replaceDeadCards(c        )       {
    for (let pass = 0; pass < 3; pass++) {
      const mode = this.autoReplace;
      const dead = this.hand[c].filter((id) => {
        if (mode === "refined" && WAITS_FOR_EVENTS.includes(id)) return false;
        if (mode === "1" && !TARGET_BOUND.includes(id)) return false;
        try { return CARDS[id].options(this, c).length === 0; } catch { return false; }
      });
      if (!dead.length) return;
      for (const id of dead) {
        this.hand[c].splice(this.hand[c].indexOf(id), 1);
        this.discard[c].push(id);
        this.replaced.push(id);
        this.draw(c, 1);
      }
    }
  }

  endTurn(discardFn                                          )       {
    const c = this.toMove;
    const keep           = [];
    for (let i = 0; i < this.effects.length; i++) {
      const e = this.effects[i];
      if (e.end_of === c) {
        if (e.n !== undefined) {
          e.n--;
          if (e.n <= 0) {
            continue;
          }
        }
      }
      keep.push(e);
    }
    this.effects = keep;

    while (this.hand[c].length > HAND_MAX) {
      let cid        ;
      if (discardFn) {
        cid = discardFn(this, c);
      } else {
        const idx = this.rng.randrange(this.hand[c].length);
        cid = this.hand[c][idx];
      }
      const idx = this.hand[c].indexOf(cid);
      if (idx !== -1) {
        this.hand[c].splice(idx, 1);
        this.discard[c].push(cid);
      }
    }

    this.toMove = c ^ 1;
    this.phase = "idle";
    this._actions = null;

    const pos = this.pos;
    if (this.result === null && !this.inCheck(c ^ 1)) {
      if (pos.insufficientMaterial()) {
        this.finish("draw", "insufficient_material");
      } else if (pos.isThreefold()) {
        this.finish("draw", "threefold");
      } else if (pos.halfmove >= 100) {
        this.finish("draw", "fifty_move");
      }
    }
  }

  finish(winner        , termination        )       {
    this.result = winner                              ;
    this.termination = termination;
    this.phase = "over";
  }

  // Legal move generation (wraps the engine)
  _effSets(us        )                                                   {
    const frozen = new Set        ();
    const shield = new Set        ();
    const walls = new Set        ();
    let nocap = false;
    for (let i = 0; i < this.effects.length; i++) {
      const e = this.effects[i];
      const k = e.kind;
      if (k === "freeze" && e.sq !== undefined) {
        frozen.add(e.sq);
      } else if (k === "shield" && e.sq !== undefined) {
        shield.add(e.sq);
      } else if (k === "wall" && e.sq !== undefined) {
        walls.add(e.sq);
      } else if (k === "nocapture" && e.owner === us) {
        nocap = true;
      }
    }
    return [frozen, shield, walls, nocap];
  }

  wallBlocks(m      , walls             )          {
    const frm = m[0];
    const to = m[1];
    if (walls.has(to)) return true;
    if (knightShape(m)) return false;
    const df = (to & 7) - (frm & 7);
    const dr = (to >> 3) - (frm >> 3);
    const n = Math.max(Math.abs(df), Math.abs(dr));
    if (df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr)) {
      if (n > 1) {
        const step = (dr > 0 ? 8 : dr < 0 ? -8 : 0) + (df > 0 ? 1 : df < 0 ? -1 : 0);
        for (let k = 1; k < n; k++) {
          if (walls.has(frm + k * step)) return true;
        }
        const p = this.pos.board[frm];
        if ((p & 7) === KING && n === 2 && to < frm && walls.has(frm - 3)) {
          return true; // queenside castling: rook also crosses b-file square
        }
      }
    }
    return false;
  }

  _filterMove(
    m      ,
    us        ,
    sets                                                  ,
    noncap          = false
  )          {
    const [frozen, shield, walls, nocap] = sets;
    const frm = m[0];
    const to = m[1];
    const pos = this.pos;
    const b = pos.board;
    if (frozen.has(frm)) return false;
    const p = b[frm];
    const tgt = b[to];
    let cs = -1;
    if (tgt) {
      if ((tgt & 7) === KING) return false;
      cs = to;
    } else if ((p & 7) === PAWN && ((frm ^ to) & 7) !== 0) {
      cs = us === WHITE ? to - 8 : to + 8; // en passant
    }
    if (cs >= 0) {
      if (nocap || noncap || shield.has(cs)) return false;
    }
    if ((p & 7) === KING && Math.abs(to - frm) === 2) {
      const rook = to > frm ? frm + 3 : frm - 4;
      if (frozen.has(rook)) return false;
    }
    if (walls.size > 0 && this.wallBlocks(m, walls)) return false;
    const u = pos.makeMove(m);
    const ok = !pos.isAttacked(pos.king[us], us ^ 1);
    pos.unmakeMove(m, u);
    return ok;
  }

  _engineFilter(pos          , m      )          {
    const us = pos.turn;
    return this._filterMove(m, us, this._effSets(us));
  }

  _genAs(s        , t        , us        )         {
    const b = this.pos.board;
    const out         = [];
    if (t === KNIGHT) {
      const kns = KNIGHT_T[s];
      for (let i = 0; i < kns.length; i++) {
        const to = kns[i];
        const q = b[to];
        if (!q || (q >> 3) !== us) {
          out.push([s, to, 0]);
        }
      }
    } else {
      const lo = t === ROOK ? 0 : 4;
      const hi = t === ROOK ? 4 : 8;
      const rays = RAYS[s];
      for (let i = lo; i < hi; i++) {
        const ray = rays[i];
        for (let j = 0; j < ray.length; j++) {
          const to = ray[j];
          const q = b[to];
          if (!q) {
            out.push([s, to, 0]);
          } else {
            if ((q >> 3) !== us) {
              out.push([s, to, 0]);
            }
            break;
          }
        }
      }
    }
    return out;
  }

  singleMoves(
    us         ,
    noncap          = false,
    excludeTypes           ,
    excludeSq         = -1
  )         {
    const pos = this.pos;
    const turn = us === undefined ? pos.turn : us;
    if (pos.turn !== turn) {
      throw new Error(`pos.turn !== us`);
    }
    const b = pos.board;
    const sets = this._effSets(turn);
    const cand = pos.pseudoLegalMoves();
    const seen = new Set        ();
    for (let i = 0; i < cand.length; i++) {
      seen.add(`${cand[i][0]},${cand[i][1]},${cand[i][2]}`);
    }

    for (let i = 0; i < this.effects.length; i++) {
      const e = this.effects[i];
      if (e.owner !== turn) continue;
      const k = e.kind;
      if (k === "impulso") {
        const s = e.sq ;
        if (b[s] === (PAWN | (turn << 3))) {
          const d = turn === WHITE ? 8 : -8;
          const s2 = s + 2 * d;
          const r = s >> 3;
          const ok = turn === WHITE ? r <= 5 : r >= 2;
          if (ok && !b[s + d] && !b[s2]) {
            const last = turn === WHITE ? 7 : 0;
            const ms         =
              (s2 >> 3) === last
                ? [
                    [s, s2, QUEEN],
                    [s, s2, ROOK],
                    [s, s2, BISHOP],
                    [s, s2, KNIGHT],
                  ]
                : [[s, s2, 0]];
            for (let j = 0; j < ms.length; j++) {
              const mKey = `${ms[j][0]},${ms[j][1]},${ms[j][2]}`;
              if (!seen.has(mKey)) {
                seen.add(mKey);
                cand.push(ms[j]);
              }
            }
          }
        }
      } else if (k === "emprestimo") {
        const s = e.sq ;
        if (
          b[s] &&
          (b[s] >> 3) === turn &&
          ((b[s] & 7) === KNIGHT ||
            (b[s] & 7) === BISHOP ||
            (b[s] & 7) === ROOK)
        ) {
          for (const t of [KNIGHT, BISHOP, ROOK]) {
            const ms = this._genAs(s, t, turn);
            for (let j = 0; j < ms.length; j++) {
              const mKey = `${ms[j][0]},${ms[j][1]},${ms[j][2]}`;
              if (!seen.has(mKey)) {
                seen.add(mKey);
                cand.push(ms[j]);
              }
            }
          }
        }
      }
    }

    const out         = [];
    const excSet = excludeTypes ? new Set(excludeTypes) : null;
    for (let i = 0; i < cand.length; i++) {
      const m = cand[i];
      if (m[0] === excludeSq) continue;
      if (excSet && excSet.has(b[m[0]] & 7)) continue;
      if (this._filterMove(m, turn, sets, noncap)) {
        out.push(m);
      }
    }
    return out;
  }

  movesFor(color        )         {
    const pos = this.pos;
    if (pos.turn === color) {
      return this.singleMoves(color);
    }
    const savedTurn = pos.turn;
    const savedEp = pos.ep;
    pos.turn = color;
    pos.ep = -1;
    try {
      return this.singleMoves(color);
    } finally {
      pos.turn = savedTurn;
      pos.ep = savedEp;
    }
  }

  _nested   (m      , us        , fn         )    {
    const pos = this.pos;
    const u = pos.makeMove(m);
    pos.turn = us;
    pos.ep = -1;
    try {
      return fn();
    } finally {
      pos.unmakeMove(m, u);
    }
  }

  _passoSteps(m      , us        )         {
    const pos = this.pos;
    const walls = this.wallSquares();

    return this._nested(m, us, () => {
      const b = pos.board;
      const to = m[1];
      const p = b[to];
      const res         = [];
      const f = to & 7;
      const r = to >> 3;
      for (let i = 0; i < KDELTAS.length; i++) {
        const df = KDELTAS[i][0];
        const dr = KDELTAS[i][1];
        const nf = f + df;
        const nr = r + dr;
        if (nf < 0 || nf >= 8 || nr < 0 || nr >= 8) continue;
        const t = nr * 8 + nf;
        if (b[t] || walls.has(t)) continue;
        if ((p & 7) === PAWN && !(nr > 0 && nr < 7)) continue;
        const st       = [to, t, 0];
        const u = pos.makeMove(st);
        const safe = !pos.isAttacked(pos.king[us], us ^ 1);
        pos.unmakeMove(st, u);
        if (safe) {
          res.push(st);
        }
      }
      return res;
    });
  }

  legalActions()           {
    if (this._actions !== null) {
      return this._actions;
    }
    const pos = this.pos;
    const us = this.toMove;
    const them = us ^ 1;
    const b = pos.board;
    const singles = this.singleMoves(us);
    const seen = new Set        ();
    const acts           = [];

    const add = (a        ) => {
      const key = JSON.stringify(a);
      if (!seen.has(key)) {
        seen.add(key);
        acts.push(a);
      }
    };

    for (let i = 0; i < singles.length; i++) {
      add([singles[i]]);
    }

    for (let i = 0; i < this.effects.length; i++) {
      const e = this.effects[i];
      if (e.owner !== us) continue;
      const k = e.kind;
      if (k === "passo") {
        const s = e.sq ;
        if (
          b[s] &&
          (b[s] >> 3) === us &&
          ((b[s] & 7) === PAWN || (b[s] & 7) === KNIGHT)
        ) {
          for (let j = 0; j < singles.length; j++) {
            const m = singles[j];
            if (m[0] === s && !m[2]) {
              const steps = this._passoSteps(m, us);
              for (let st = 0; st < steps.length; st++) {
                add([m, steps[st]]);
              }
            }
          }
        }
      } else if (k === "salto") {
        const s = e.sq ;
        if (b[s] === (KNIGHT | (us << 3))) {
          for (let j = 0; j < singles.length; j++) {
            const m = singles[j];
            if (m[0] === s && knightShape(m)) {
              const seconds = this._nested(m, us, () => {
                const all = this.singleMoves(us, true);
                return all.filter(
                  (m2) =>
                    m2[0] === m[1] &&
                    knightShape(m2) &&
                    pos.board[m2[0]] === (KNIGHT | (us << 3))
                );
              });
              for (let sIdx = 0; sIdx < seconds.length; sIdx++) {
                add([m, seconds[sIdx]]);
              }
            }
          }
        }
      } else if (k === "segundo") {
        for (let j = 0; j < singles.length; j++) {
          const m = singles[j];
          const seconds = this._nested(m, us, () => {
            const gives = pos.isAttacked(pos.king[them], us);
            const res         = [];
            const candidateSeconds = this.singleMoves(
              us,
              true,
              [KING, QUEEN],
              m[1]
            );
            for (let sIdx = 0; sIdx < candidateSeconds.length; sIdx++) {
              const m2 = candidateSeconds[sIdx];
              if (gives) {
                const u = pos.makeMove(m2);
                const atk = pos.isAttacked(pos.king[them], us);
                pos.unmakeMove(m2, u);
                if (atk) continue;
              }
              res.push(m2);
            }
            return res;
          });
          for (let sIdx = 0; sIdx < seconds.length; sIdx++) {
            add([m, seconds[sIdx]]);
          }
        }
      }
    }

    this._actions = acts;
    this._aset = seen;
    return acts;
  }

  _applySteps(action        , us        , track          = false)       {
    const pos = this.pos;
    const b = pos.board;
    const fm0 = pos.fullmove;
    const start = us === WHITE ? 1 : 6;

    for (let i = 0; i < action.length; i++) {
      const m = action[i];
      if (i > 0) {
        pos.turn = us;
        pos.ep = -1;
      }
      const frm = m[0];
      const to = m[1];
      const p = b[frm];
      let gone = b[to] ? to : -1;
      if (
        gone < 0 &&
        (p & 7) === PAWN &&
        ((frm ^ to) & 7) !== 0 &&
        to === pos.ep
      ) {
        gone = us === WHITE ? to - 8 : to + 8;
      }
      const impulso =
        (p & 7) === PAWN && Math.abs(to - frm) === 16 && (frm >> 3) !== start;
      pos.makeMove(m);
      if (impulso) {
        pos.ep = -1;
      }
      if (track) {
        if (gone >= 0) {
          this.dropEffectsAt(gone);
        }
        this.moveEffects(frm, to);
        if ((p & 7) === KING && Math.abs(to - frm) === 2) {
          if (to > frm) {
            this.moveEffects(frm + 3, frm + 1);
          } else {
            this.moveEffects(frm - 4, frm - 1);
          }
        }
      }
    }
    pos.turn = us ^ 1;
    pos.fullmove = fm0 + (us === BLACK ? 1 : 0);
  }

  doAction(action        )       {
    this.legalActions();
    const actionKey = JSON.stringify(action);
    if (
      (this.phase !== "cards" && this.phase !== "moved") ||
      !this._aset.has(actionKey)
    ) {
      throw new Error(`illegal action ${actionKey}`);
    }
    const us = this.toMove;
    this._applySteps(action, us, true);
    this.pos.keys.push(this.pos.key());
    this.plies++;
    this.phase = "moved";
    this._actions = null;
    for (let i = 0; i < this.onAction.length; i++) {
      this.onAction[i](this, us, action);
    }
  }

  simulate   (action        , fn         )    {
    const pos = this.pos;
    const us = this.toMove;
    const sBoard = pos.board.slice();
    const sKing                   = [pos.king[0], pos.king[1]];
    const sTurn = pos.turn;
    const sEp = pos.ep;
    const sCastling = pos.castling;
    const sHalfmove = pos.halfmove;
    const sFullmove = pos.fullmove;
    try {
      this._applySteps(action, us, false);
      return fn();
    } finally {
      pos.board = sBoard;
      pos.king = sKing;
      pos.turn = sTurn;
      pos.ep = sEp;
      pos.castling = sCastling;
      pos.halfmove = sHalfmove;
      pos.fullmove = sFullmove;
    }
  }
}
