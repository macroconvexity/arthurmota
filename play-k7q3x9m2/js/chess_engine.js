/**
 * Minimal chess engine in TypeScript, identical to sim/chess_engine.py.
 * Squares: a1=0, b1=1 ... h8=63.
 * Pieces: 1..6 = P N B R Q K, plus 8 for black. 0 = empty.
 * Move: [from, to, promo], promo is 0 or 2..5.
 */

export const WHITE = 0;
export const BLACK = 1;

export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const SYM                         = {
  1: "P",
  2: "N",
  3: "B",
  4: "R",
  5: "Q",
  6: "K",
};

const FROM_SYM                         = {};
for (const [tStr, c] of Object.entries(SYM)) {
  const t = Number(tStr);
  FROM_SYM[c] = t;
  FROM_SYM[c.toLowerCase()] = t | 8;
}

export const CR_WK = 1;
export const CR_WQ = 2;
export const CR_BK = 4;
export const CR_BQ = 8;

                                            
                                                            
                                                                 

export function sqName(s        )         {
  return "abcdefgh"[s & 7] + String((s >> 3) + 1);
}

export function nameSq(n        )         {
  return (parseInt(n[1], 10) - 1) * 8 + "abcdefgh".indexOf(n[0]);
}

export function moveToUci(m      )         {
  return sqName(m[0]) + sqName(m[1]) + (!m[2] ? "" : "nbrq"[m[2] - 2]);
}

// Precomputed tables
function buildTables() {
  const knight             = [];
  const king             = [];
  const rays               = [];
  const patt                           = [[], []];

  const kd                     = [
    [1, 2], [2, 1], [-1, 2], [-2, 1],
    [1, -2], [2, -1], [-1, -2], [-2, -1],
  ];
  const dirs                     = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  for (let s = 0; s < 64; s++) {
    const f = s & 7;
    const r = s >> 3;

    const kn           = [];
    for (let i = 0; i < kd.length; i++) {
      const df = kd[i][0];
      const dr = kd[i][1];
      if (f + df >= 0 && f + df < 8 && r + dr >= 0 && r + dr < 8) {
        kn.push((r + dr) * 8 + f + df);
      }
    }
    knight.push(kn);

    const kg           = [];
    for (let i = 0; i < dirs.length; i++) {
      const df = dirs[i][0];
      const dr = dirs[i][1];
      if (f + df >= 0 && f + df < 8 && r + dr >= 0 && r + dr < 8) {
        kg.push((r + dr) * 8 + f + df);
      }
    }
    king.push(kg);

    const rs             = [];
    for (let i = 0; i < dirs.length; i++) {
      const df = dirs[i][0];
      const dr = dirs[i][1];
      const ray           = [];
      let ff = f + df;
      let rr = r + dr;
      while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
        ray.push(rr * 8 + ff);
        ff += df;
        rr += dr;
      }
      rs.push(ray);
    }
    rays.push(rs);

    const p0           = [];
    if (r + 1 < 8) {
      if (f - 1 >= 0) p0.push((r + 1) * 8 + f - 1);
      if (f + 1 < 8) p0.push((r + 1) * 8 + f + 1);
    }
    patt[0].push(p0);

    const p1           = [];
    if (r - 1 >= 0) {
      if (f - 1 >= 0) p1.push((r - 1) * 8 + f - 1);
      if (f + 1 < 8) p1.push((r - 1) * 8 + f + 1);
    }
    patt[1].push(p1);
  }

  return { knight, king, rays, patt };
}

export const { knight: KNIGHT_T, king: KING_T, rays: RAYS, patt: PAWN_ATT } = buildTables();

export const CASTLE_MASK = new Array(64).fill(15);
CASTLE_MASK[0] = 15 & ~CR_WQ;
CASTLE_MASK[7] = 15 & ~CR_WK;
CASTLE_MASK[4] = 15 & ~(CR_WK | CR_WQ);
CASTLE_MASK[56] = 15 & ~CR_BQ;
CASTLE_MASK[63] = 15 & ~CR_BK;
CASTLE_MASK[60] = 15 & ~(CR_BK | CR_BQ);

export function defaultLegalFilter(pos          , move      )          {
  const b = pos.board;
  const frm = move[0];
  const to = move[1];
  const promo = move[2];
  const p = b[frm];
  const t = p & 7;
  const us = p >> 3;
  const them = us ^ 1;

  if (t === KING) {
    if (Math.abs(to - frm) === 2) return true;
    const cap = b[to];
    b[frm] = 0;
    b[to] = p;
    const ok = !pos.isAttacked(to, them);
    b[frm] = p;
    b[to] = cap;
    return ok;
  }

  if (t === PAWN && to === pos.ep && ((frm ^ to) & 7) !== 0) {
    const cs = us === WHITE ? to - 8 : to + 8;
    const capPawn = b[cs];
    b[frm] = 0;
    b[to] = p;
    b[cs] = 0;
    const ok = !pos.isAttacked(pos.king[us], them);
    b[frm] = p;
    b[to] = 0;
    b[cs] = capPawn;
    return ok;
  }

  const cap = b[to];
  b[frm] = 0;
  b[to] = promo ? (promo | (us << 3)) : p;
  const ok = !pos.isAttacked(pos.king[us], them);
  b[frm] = p;
  b[to] = cap;
  return ok;
}

export class Position {
  board          ;
  king                  ;
  turn        ;
  castling        ;
  ep        ;
  halfmove        ;
  fullmove        ;
  keys          ;
  legalFilter             ;

  constructor(fen         = START_FEN) {
    this.board = new Array(64).fill(0);
    this.king = [-1, -1];
    this.turn = WHITE;
    this.castling = 0;
    this.ep = -1;
    this.halfmove = 0;
    this.fullmove = 1;
    this.keys = [];
    this.legalFilter = defaultLegalFilter;
    this.setFen(fen);
  }

  static fromFen(fen        )           {
    return new Position(fen);
  }

  setFen(fen        )       {
    const parts = fen.trim().split(/\s+/);
    const defaults = ["w", "-", "-", "0", "1"];
    while (parts.length < 6) {
      parts.push(defaults[parts.length - 1]);
    }
    this.board = new Array(64).fill(0);
    this.king = [-1, -1];
    let rank = 7;
    for (const row of parts[0].split("/")) {
      let f = 0;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch >= "0" && ch <= "9") {
          f += parseInt(ch, 10);
        } else {
          const p = FROM_SYM[ch];
          const s = rank * 8 + f;
          this.board[s] = p;
          if ((p & 7) === KING) {
            this.king[p >> 3] = s;
          }
          f++;
        }
      }
      rank--;
    }
    this.turn = parts[1] === "w" ? WHITE : BLACK;
    this.castling = 0;
    for (let i = 0; i < parts[2].length; i++) {
      const ch = parts[2][i];
      if (ch === "K") this.castling |= 1;
      else if (ch === "Q") this.castling |= 2;
      else if (ch === "k") this.castling |= 4;
      else if (ch === "q") this.castling |= 8;
    }
    this.ep = parts[3] === "-" ? -1 : nameSq(parts[3]);
    this.halfmove = parseInt(parts[4], 10);
    this.fullmove = parseInt(parts[5], 10);
    this.keys = [this.key()];
  }

  fen()         {
    const rows           = [];
    for (let rank = 7; rank >= 0; rank--) {
      let row = "";
      let n = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[rank * 8 + f];
        if (!p) {
          n++;
        } else {
          if (n) {
            row += String(n);
            n = 0;
          }
          const c = SYM[p & 7];
          row += (p & 8) ? c.toLowerCase() : c;
        }
      }
      if (n) {
        row += String(n);
      }
      rows.push(row);
    }
    let cr = "";
    if (this.castling & 1) cr += "K";
    if (this.castling & 2) cr += "Q";
    if (this.castling & 4) cr += "k";
    if (this.castling & 8) cr += "q";
    if (!cr) cr = "-";
    const ep = this.ep < 0 ? "-" : sqName(this.ep);
    const t = this.turn === WHITE ? "w" : "b";
    return `${rows.join("/")} ${t} ${cr} ${ep} ${this.halfmove} ${this.fullmove}`;
  }

  copy()           {
    const p = Object.create(Position.prototype)            ;
    p.board = this.board.slice();
    p.king = [this.king[0], this.king[1]];
    p.turn = this.turn;
    p.castling = this.castling;
    p.ep = this.ep;
    p.halfmove = this.halfmove;
    p.fullmove = this.fullmove;
    p.keys = this.keys.slice();
    p.legalFilter = this.legalFilter;
    return p;
  }

  key()         {
    let ep = -1;
    if (this.ep >= 0) {
      const pawn = PAWN | (this.turn << 3);
      const attackers = PAWN_ATT[this.turn ^ 1][this.ep];
      for (let i = 0; i < attackers.length; i++) {
        if (this.board[attackers[i]] === pawn) {
          ep = this.ep;
          break;
        }
      }
    }
    return `${this.board.join(",")}|${this.turn}|${this.castling}|${ep}`;
  }

  isAttacked(sq        , by        )          {
    const b = this.board;
    const sh = by << 3;

    const pawn = PAWN | sh;
    const f = sq & 7;
    const r = sq >> 3;
    if (by === WHITE) {
      if (r > 0) {
        if (f > 0 && b[sq - 9] === pawn) return true;
        if (f < 7 && b[sq - 7] === pawn) return true;
      }
    } else {
      if (r < 7) {
        if (f > 0 && b[sq + 7] === pawn) return true;
        if (f < 7 && b[sq + 9] === pawn) return true;
      }
    }

    const n = KNIGHT | sh;
    const kns = KNIGHT_T[sq];
    for (let i = 0; i < kns.length; i++) {
      if (b[kns[i]] === n) return true;
    }

    const k = KING | sh;
    const kings = KING_T[sq];
    for (let i = 0; i < kings.length; i++) {
      if (b[kings[i]] === k) return true;
    }

    const r1 = ROOK | sh;
    const q1 = QUEEN | sh;

    for (let s = sq + 1; (s & 7) !== 0; s++) {
      const p = b[s];
      if (p) { if (p === r1 || p === q1) return true; break; }
    }
    for (let s = sq - 1; (s & 7) !== 7 && s >= 0; s--) {
      const p = b[s];
      if (p) { if (p === r1 || p === q1) return true; break; }
    }
    for (let s = sq + 8; s < 64; s += 8) {
      const p = b[s];
      if (p) { if (p === r1 || p === q1) return true; break; }
    }
    for (let s = sq - 8; s >= 0; s -= 8) {
      const p = b[s];
      if (p) { if (p === r1 || p === q1) return true; break; }
    }

    const b1 = BISHOP | sh;

    for (let s = sq + 9; (s & 7) !== 0 && s < 64; s += 9) {
      const p = b[s];
      if (p) { if (p === b1 || p === q1) return true; break; }
    }
    for (let s = sq - 7; (s & 7) !== 0 && s >= 0; s -= 7) {
      const p = b[s];
      if (p) { if (p === b1 || p === q1) return true; break; }
    }
    for (let s = sq + 7; (s & 7) !== 7 && s < 64; s += 7) {
      const p = b[s];
      if (p) { if (p === b1 || p === q1) return true; break; }
    }
    for (let s = sq - 9; (s & 7) !== 7 && s >= 0; s -= 9) {
      const p = b[s];
      if (p) { if (p === b1 || p === q1) return true; break; }
    }

    return false;
  }

  isInCheck(color         )          {
    const c = color === undefined ? this.turn : color;
    return this.isAttacked(this.king[c], c ^ 1);
  }

  pseudoLegalMoves()         {
    const b = this.board;
    const us = this.turn;
    const them = us ^ 1;
    const out         = [];

    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (!p || (p >> 3) !== us) continue;
      const t = p & 7;

      if (t === PAWN) {
        const r = sq >> 3;
        let one        , start        , last        ;
        if (us === WHITE) {
          one = sq + 8;
          start = 1;
          last = 6;
        } else {
          one = sq - 8;
          start = 6;
          last = 1;
        }

        if (!b[one]) {
          if (r === last) {
            out.push([sq, one, QUEEN], [sq, one, ROOK], [sq, one, BISHOP], [sq, one, KNIGHT]);
          } else {
            out.push([sq, one, 0]);
            if (r === start) {
              const two = one + (us === WHITE ? 8 : -8);
              if (!b[two]) {
                out.push([sq, two, 0]);
              }
            }
          }
        }

        const atts = PAWN_ATT[us][sq];
        for (let i = 0; i < atts.length; i++) {
          const to = atts[i];
          const q = b[to];
          if (q && (q >> 3) === them) {
            if (r === last) {
              out.push([sq, to, QUEEN], [sq, to, ROOK], [sq, to, BISHOP], [sq, to, KNIGHT]);
            } else {
              out.push([sq, to, 0]);
            }
          } else if (to === this.ep && !q) {
            out.push([sq, to, 0]);
          }
        }
      } else if (t === KNIGHT) {
        const list = KNIGHT_T[sq];
        for (let i = 0; i < list.length; i++) {
          const to = list[i];
          const q = b[to];
          if (!q || (q >> 3) === them) {
            out.push([sq, to, 0]);
          }
        }
      } else if (t === KING) {
        const list = KING_T[sq];
        for (let i = 0; i < list.length; i++) {
          const to = list[i];
          const q = b[to];
          if (!q || (q >> 3) === them) {
            out.push([sq, to, 0]);
          }
        }
      } else {
        const lo = t === ROOK ? 0 : t === BISHOP ? 4 : 0;
        const hi = t === ROOK ? 4 : t === BISHOP ? 8 : 8;
        const rays = RAYS[sq];
        for (let i = lo; i < hi; i++) {
          const ray = rays[i];
          for (let j = 0; j < ray.length; j++) {
            const to = ray[j];
            const q = b[to];
            if (!q) {
              out.push([sq, to, 0]);
            } else {
              if ((q >> 3) === them) {
                out.push([sq, to, 0]);
              }
              break;
            }
          }
        }
      }
    }

    this._genCastling(out);
    return out;
  }

          _genCastling(out        )       {
    const b = this.board;
    const us = this.turn;
    const them = us ^ 1;
    const base = us === WHITE ? 0 : 56;

    if (this.king[us] !== base + 4 || !(this.castling & (us === WHITE ? 3 : 12))) {
      return;
    }

    const rook = ROOK | (us << 3);
    const ks = us === WHITE ? CR_WK : CR_BK;
    const qs = us === WHITE ? CR_WQ : CR_BQ;

    if (this.isAttacked(base + 4, them)) {
      return;
    }

    if (
      (this.castling & ks) &&
      b[base + 7] === rook &&
      !b[base + 5] &&
      !b[base + 6] &&
      !this.isAttacked(base + 5, them) &&
      !this.isAttacked(base + 6, them)
    ) {
      out.push([base + 4, base + 6, 0]);
    }

    if (
      (this.castling & qs) &&
      b[base] === rook &&
      !b[base + 1] &&
      !b[base + 2] &&
      !b[base + 3] &&
      !this.isAttacked(base + 3, them) &&
      !this.isAttacked(base + 2, them)
    ) {
      out.push([base + 4, base + 2, 0]);
    }
  }

  legalMoves(legalFilter              )         {
    const f = legalFilter || this.legalFilter;
    const pseudos = this.pseudoLegalMoves();
    const result         = [];
    for (let i = 0; i < pseudos.length; i++) {
      if (f(this, pseudos[i])) {
        result.push(pseudos[i]);
      }
    }
    return result;
  }

  makeMove(m      , outUndo       )       {
    const frm = m[0];
    const to = m[1];
    const promo = m[2];
    const b = this.board;
    const p = b[frm];
    const t = p & 7;
    const us = p >> 3;
    let cap = b[to];
    let undo      ;
    if (outUndo) {
      outUndo[0] = p;
      outUndo[1] = cap;
      outUndo[2] = this.castling;
      outUndo[3] = this.ep;
      outUndo[4] = this.halfmove;
      undo = outUndo;
    } else {
      undo = [p, cap, this.castling, this.ep, this.halfmove];
    }

    b[frm] = 0;
    if (t === PAWN) {
      if (to === this.ep && ((frm ^ to) & 7) !== 0) {
        const cs = us === WHITE ? to - 8 : to + 8;
        undo[1] = b[cs];
        b[cs] = 0;
        cap = 1;
      }
      b[to] = promo ? (promo | (us << 3)) : p;
      this.ep = Math.abs(to - frm) === 16 ? ((frm + to) >> 1) : -1;
      this.halfmove = 0;
    } else {
      b[to] = p;
      this.ep = -1;
      this.halfmove = cap ? 0 : this.halfmove + 1;
      if (t === KING) {
        this.king[us] = to;
        if (to - frm === 2) {
          b[to - 1] = b[to + 1];
          b[to + 1] = 0;
        } else if (frm - to === 2) {
          b[to + 1] = b[to - 2];
          b[to - 2] = 0;
        }
      }
    }

    if (cap) {
      this.halfmove = 0;
    }
    this.castling &= CASTLE_MASK[frm] & CASTLE_MASK[to];
    if (us === BLACK) {
      this.fullmove++;
    }
    this.turn = us ^ 1;
    return undo;
  }

  unmakeMove(m      , undo      )       {
    const frm = m[0];
    const to = m[1];
    const p = undo[0];
    const cap = undo[1];
    this.castling = undo[2];
    this.ep = undo[3];
    this.halfmove = undo[4];
    const b = this.board;
    const us = p >> 3;
    const t = p & 7;

    this.turn = us;
    if (us === BLACK) {
      this.fullmove--;
    }
    b[frm] = p;

    if (t === PAWN && to === this.ep && ((frm ^ to) & 7) !== 0) {
      b[to] = 0;
      b[us === WHITE ? to - 8 : to + 8] = cap;
    } else {
      b[to] = cap;
      if (t === KING) {
        this.king[us] = frm;
        if (to - frm === 2) {
          b[to + 1] = b[to - 1];
          b[to - 1] = 0;
        } else if (frm - to === 2) {
          b[to - 2] = b[to + 1];
          b[to + 1] = 0;
        }
      }
    }
  }

  push(m      )       {
    const u = this.makeMove(m);
    this.keys.push(this.key());
    return u;
  }

  pop(m      , undo      )       {
    this.keys.pop();
    this.unmakeMove(m, undo);
  }

  parseUci(s        )       {
    const legals = this.legalMoves();
    for (let i = 0; i < legals.length; i++) {
      if (moveToUci(legals[i]) === s) {
        return legals[i];
      }
    }
    throw new Error("illegal move " + s);
  }

  insufficientMaterial()          {
    const minors                     = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = this.board[sq];
      const t = p & 7;
      if (t === PAWN || t === ROOK || t === QUEEN) {
        return false;
      }
      if (t === KNIGHT || t === BISHOP) {
        minors.push([t, (sq & 7) + (sq >> 3)]);
      }
    }
    if (minors.length <= 1) {
      return true;
    }
    const colorParity = minors[0][1] % 2;
    for (let i = 0; i < minors.length; i++) {
      if (minors[i][0] !== BISHOP || minors[i][1] % 2 !== colorParity) {
        return false;
      }
    }
    return true;
  }

  isThreefold()          {
    const last = this.keys[this.keys.length - 1];
    let count = 0;
    for (let i = 0; i < this.keys.length; i++) {
      if (this.keys[i] === last) {
        count++;
      }
    }
    return count >= 3;
  }

  status()                                                                                               {
    if (!this.legalMoves().length) {
      return this.isInCheck() ? "checkmate" : "stalemate";
    }
    if (this.insufficientMaterial()) {
      return "insufficient_material";
    }
    if (this.isThreefold()) {
      return "threefold";
    }
    if (this.halfmove >= 100) {
      return "fifty_move";
    }
    return "ongoing";
  }
}

const PERFT_UNDO_STACK         = Array.from({ length: 32 }, () => [0, 0, 0, 0, 0]);

export function perft(pos          , depth        )         {
  if (depth === 0) return 1;
  const moves = pos.legalMoves();
  if (depth === 1) return moves.length;
  let n = 0;
  const u = PERFT_UNDO_STACK[depth];
  for (let i = 0; i < moves.length; i++) {
    pos.makeMove(moves[i], u);
    n += perft(pos, depth - 1);
    pos.unmakeMove(moves[i], u);
  }
  return n;
}
