/**
 * The 24 cards of Chess the Gathering in TypeScript (identical to sim/cards.py).
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
} from "./chess_engine.js";
                                              
                                      

export const PIECES = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN];

export const KDELTAS                     = [];
for (let df = -1; df <= 1; df++) {
  for (let dr = -1; dr <= 1; dr++) {
    if (df !== 0 || dr !== 0) {
      KDELTAS.push([df, dr]);
    }
  }
}

export function sqs(g      , color        , types          )           {
  const b = g.pos.board;
  const res           = [];
  const typeSet = new Set(types);
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (p && (p >> 3) === color && typeSet.has(p & 7)) {
      res.push(s);
    }
  }
  return res;
}

                                                        
                                                           
                                                                         
                                                             
                                                                    
                                                      

export class Card {
  id        ;
  name        ;
  cost        ;
  cands             ;
  apply         ;
  mut        ;
  post         ;
  customLegal                ;
  optionsFn            ;

  constructor(
    id        ,
    name        ,
    cost        ,
    cands             ,
    apply         ,
    opts    
                  
                    
                                  
                            
     
  ) {
    this.id = id;
    this.name = name;
    this.cost = cost;
    this.cands = cands;
    this.apply = apply;
    this.mut = opts?.mut;
    this.post = opts?.post;
    this.customLegal = opts?.customLegal;
    this.optionsFn = opts?.optionsFn;
  }

          _legalOne(g      , c        , p     )          {
    if (this.customLegal !== undefined) {
      return this.customLegal(g, c, p);
    }
    if (this.mut === undefined) {
      return !g.inCheck(c);
    }
    const postFn = this.post ? () => this.post (g, c, p) : undefined;
    return g.simOk(c, (b          ) => this.mut (g, c, p, b), postFn);
  }

  options(g      , c        )        {
    if (this.optionsFn !== undefined) {
      return this.optionsFn(g, c);
    }
    const cands = this.cands(g, c);
    const out        = [];
    for (let i = 0; i < cands.length; i++) {
      if (this._legalOne(g, c, cands[i])) {
        out.push(cands[i]);
      }
    }
    return out;
  }

  legal(g      , c        , p     )          {
    const cands = this.cands(g, c);
    const pStr = JSON.stringify(p);
    const inCands = cands.some((x) => JSON.stringify(x) === pStr);
    return inCands && this._legalOne(g, c, p);
  }
}

const NO_PARAM              = (_g      , _c        ) => [[]];

function _active(g      , c        , ...kinds          )          {
  const set = new Set(kinds);
  return g.effects.some((e) => set.has(e.kind) && e.owner === c);
}

function _moveMut(_g      , _c        , p                  , b          )          {
  b[p[1]] = b[p[0]];
  b[p[0]] = 0;
  return true;
}

function _removeMut(_g      , _c        , p          , b          )          {
  b[p[0]] = 0;
  return true;
}

// ---- 1 Pawn Rush ---------------------------------------------------------
function c1_cands(g      , c        )             {
  const b = g.pos.board;
  const d = c === WHITE ? 8 : -8;
  const start = c === WHITE ? 1 : 6;
  const out             = [];
  const pawns = sqs(g, c, [PAWN]);
  for (let i = 0; i < pawns.length; i++) {
    const s = pawns[i];
    if ((s >> 3) === start) continue;
    const s2 = s + 2 * d;
    if (s2 >= 0 && s2 < 64 && !b[s + d] && !b[s2]) {
      out.push([s]);
    }
  }
  return out;
}

function c1_apply(g      , c        , p          )       {
  g.addEffect("impulso", { owner: c, sq: p[0], end_of: c, n: 1 });
}

// ---- 2 Extra Step --------------------------------------------------------
function c2_cands(g      , c        )             {
  if (_active(g, c, "salto", "segundo")) {
    return [];
  }
  return sqs(g, c, [PAWN, KNIGHT]).map((s) => [s]);
}

function c2_apply(g      , c        , p          )       {
  g.addEffect("passo", { owner: c, sq: p[0], end_of: c, n: 1 });
}

// ---- 3 Double Leap -------------------------------------------------------
function c3_cands(g      , c        )             {
  if (_active(g, c, "passo")) {
    return [];
  }
  return sqs(g, c, [KNIGHT]).map((s) => [s]);
}

function c3_apply(g      , c        , p          )       {
  g.addEffect("salto", { owner: c, sq: p[0], end_of: c, n: 1 });
}

// ---- 4 Borrowed Moves ----------------------------------------------------
function c4_cands(g      , c        )             {
  return sqs(g, c, [BISHOP, ROOK, KNIGHT]).map((s) => [s]);
}

function c4_apply(g      , c        , p          )       {
  g.addEffect("emprestimo", { owner: c, sq: p[0], end_of: c, n: 1 });
}

// ---- 5 Swap Places -------------------------------------------------------
function c5_cands(g      , c        )                     {
  const b = g.pos.board;
  const ss = sqs(g, c, PIECES);
  const out                     = [];
  for (let i = 0; i < ss.length; i++) {
    for (let z = i + 1; z < ss.length; z++) {
      if (b[ss[i]] !== b[ss[z]]) {
        out.push([ss[i], ss[z]]);
      }
    }
  }
  return out;
}

function c5_mut(_g      , _c        , p                  , b          )          {
  const [a, z] = p;
  if ((b[a] & 7) === PAWN && !((z >> 3) > 0 && (z >> 3) < 7)) {
    return false;
  }
  if ((b[z] & 7) === PAWN && !((a >> 3) > 0 && (a >> 3) < 7)) {
    return false;
  }
  const tmp = b[a];
  b[a] = b[z];
  b[z] = tmp;
  return true;
}

function c5_apply(g      , _c        , p                  )       {
  g.swap(p[0], p[1]);
}

// ---- 6 Second Move -------------------------------------------------------
function c6_cands(g      , c        )       {
  return _active(g, c, "passo") ? [] : [[]];
}

function c6_apply(g      , c        , _p     )       {
  g.addEffect("segundo", { owner: c, end_of: c, n: 1 });
}

// ---- 7 Fall Back ---------------------------------------------------------
function c7_cands(g      , c        )                     {
  const b = g.pos.board;
  const walls = g.wallSquares();
  const out                     = [];
  const pieces = sqs(g, c, [KNIGHT, BISHOP, ROOK, QUEEN]);
  for (let i = 0; i < pieces.length; i++) {
    const s = pieces[i];
    const nr = (s >> 3) + (c === WHITE ? -1 : 1);
    if (nr < 0 || nr >= 8) continue;
    for (const df of [-1, 0, 1]) {
      const nf = (s & 7) + df;
      if (nf >= 0 && nf < 8) {
        const t = nr * 8 + nf;
        if (!b[t] && !walls.has(t)) {
          out.push([s, t]);
        }
      }
    }
  }
  return out;
}

function c7_apply(g      , _c        , p                  )       {
  g.relocate(p[0], p[1]);
}

// ---- 8 Silence -----------------------------------------------------------
function c8_apply(g      , c        , _p     )       {
  g.addEffect("silence", { owner: c, target: c ^ 1, end_of: c ^ 1, n: 1 });
}

// ---- 9 Freeze ------------------------------------------------------------
function c9_cands(g      , c        )             {
  return sqs(g, c ^ 1, PIECES).map((s) => [s]);
}

function c9_apply(g      , c        , p          )       {
  g.addEffect("freeze", { owner: c, sq: p[0], end_of: c ^ 1, n: 1 });
}

// ---- 10 Shove ------------------------------------------------------------
function c10_cands(g      , c        )                     {
  const b = g.pos.board;
  const walls = g.wallSquares();
  const out                     = [];
  const pieces = sqs(g, c ^ 1, PIECES);
  for (let i = 0; i < pieces.length; i++) {
    const s = pieces[i];
    const f = s & 7;
    const r = s >> 3;
    const isp = (b[s] & 7) === PAWN;
    for (let k = 0; k < KDELTAS.length; k++) {
      const df = KDELTAS[k][0];
      const dr = KDELTAS[k][1];
      const nf = f + df;
      const nr = r + dr;
      if (nf < 0 || nf >= 8 || nr < 0 || nr >= 8) continue;
      const t = nr * 8 + nf;
      if (b[t] || walls.has(t)) continue;
      if (isp && !(nr > 0 && nr < 7)) continue;
      out.push([s, t]);
    }
  }
  return out;
}

function c10_apply(g      , _c        , p                  )       {
  g.relocate(p[0], p[1]);
}

// ---- 11 Wall -------------------------------------------------------------
function c11_cands(g      , _c        )             {
  const walls = g.wallSquares();
  const b = g.pos.board;
  const out             = [];
  for (let s = 0; s < 64; s++) {
    if (!b[s] && !walls.has(s)) {
      out.push([s]);
    }
  }
  return out;
}

function c11_options(g      , c        )             {
  if (g.inCheck(c)) return [];
  const opp = g.movesFor(c ^ 1);
  const mine = g.movesFor(c);
  if (!opp.length || !mine.length) return [];
  const out             = [];
  const cands = c11_cands(g, c);
  for (let i = 0; i < cands.length; i++) {
    const s = cands[i][0];
    const w = new Set([s]);
    if (opp.some((m) => !g.wallBlocks(m, w)) && mine.some((m) => !g.wallBlocks(m, w))) {
      out.push([s]);
    }
  }
  return out;
}

function c11_legal(g      , c        , p          )          {
  if (g.inCheck(c)) return false;
  const opp = g.movesFor(c ^ 1);
  const mine = g.movesFor(c);
  const w = new Set([p[0]]);
  return opp.some((m) => !g.wallBlocks(m, w)) && mine.some((m) => !g.wallBlocks(m, w));
}

function c11_apply(g      , c        , p          )       {
  g.addEffect("wall", { owner: c, sq: p[0], end_of: c ^ 1, n: 2 });
}

// ---- 12 Shield -----------------------------------------------------------
function c12_cands(g      , c        )             {
  return sqs(g, c, PIECES).map((s) => [s]);
}

function c12_apply(g      , c        , p          )       {
  g.addEffect("shield", { owner: c, sq: p[0], start_of: c });
}

// ---- 13 Drain ------------------------------------------------------------
function c13_apply(g      , c        , _p     )       {
  g.addEffect("choke", { owner: c, target: c ^ 1 });
}

// ---- 14 Reveal -----------------------------------------------------------
function c14_apply(g      , c        , _p     )       {
  g.addEffect("reveal", { owner: c, start_of: c });
}

// ---- 15 Discard ----------------------------------------------------------
function c15_apply(g      , c        , _p     )       {
  const o = c ^ 1;
  if (g.hand[o].length > 0) {
    const idx = g.rng.randrange(g.hand[o].length);
    const cid = g.hand[o].splice(idx, 1)[0];
    g.discard[o].push(cid);
  }
}

// ---- 16 Steal ------------------------------------------------------------
function c16_apply(g      , c        , _p     )       {
  const o = c ^ 1;
  if (g.hand[o].length > 0) {
    const idx = g.rng.randrange(g.hand[o].length);
    const cid = g.hand[o].splice(idx, 1)[0];
    g.hand[c].push(cid);
  }
}

// ---- 17 Ambush -----------------------------------------------------------
function c17_cands(g      , c        )             {
  return sqs(g, c ^ 1, [PAWN]).map((s) => [s]);
}

function c17_apply(g      , _c        , p          )       {
  g.remove(p[0]);
}

// ---- 18 Execution --------------------------------------------------------
function c18_cands(g      , c        )             {
  return sqs(g, c ^ 1, [KNIGHT, BISHOP]).map((s) => [s]);
}

function c18_post(g      , c        , _p     )          {
  g.effects.push({ kind: "nocapture", owner: c });
  try {
    return g.movesFor(c).length > 0;
  } finally {
    g.effects.pop();
  }
}

function c18_apply(g      , c        , p          )       {
  g.remove(p[0]);
  g.addEffect("nocapture", { owner: c, end_of: c, n: 1 });
}

// ---- 19 Turncoat Pawn ----------------------------------------------------
function c19_cands(g      , c        )             {
  if (c === WHITE) {
    return sqs(g, c ^ 1, [PAWN])
      .filter((s) => (s >> 3) > 0 && (s >> 3) <= 4)
      .map((s) => [s]);
  }
  return sqs(g, c ^ 1, [PAWN])
    .filter((s) => (s >> 3) >= 3 && (s >> 3) < 7)
    .map((s) => [s]);
}

function c19_mut(_g      , c        , p          , b          )          {
  b[p[0]] = PAWN | (c << 3);
  return true;
}

function c19_apply(g      , c        , p          )       {
  g.dropEffectsAt(p[0]);
  g.pos.board[p[0]] = PAWN | (c << 3);
}

// ---- 20 Study ------------------------------------------------------------
function c20_apply(g      , c        , _p     )       {
  g.draw(c, 2);
}

// ---- 21 Ritual -----------------------------------------------------------
function c21_legal(g      , c        , _p     )          {
  return !g.ritualUsed && !g.inCheck(c);
}

function c21_apply(g      , c        , _p     )       {
  g.mana[c] += 2;
  g.ritualUsed = true;
}

// ---- 22 Sacrifice --------------------------------------------------------
function c22_cands(g      , c        )             {
  return sqs(g, c, [PAWN]).map((s) => [s]);
}

function c22_apply(g      , c        , p          )       {
  g.remove(p[0]);
  g.draw(c, 2);
}

// ---- 23 Resurrection -----------------------------------------------------
function c23_cands(g      , c        )                     {
  const b = g.pos.board;
  const walls = g.wallSquares();
  const base = c === WHITE ? 0 : 56;
  const out                     = [];
  const configs                       = [
    [KNIGHT, [1, 6]],
    [BISHOP, [2, 5]],
  ];
  for (let i = 0; i < configs.length; i++) {
    const t = configs[i][0];
    const homes = configs[i][1];
    if (sqs(g, c, [t]).length >= 2) continue;
    for (let j = 0; j < homes.length; j++) {
      const h = homes[j];
      if (!b[base + h] && !walls.has(base + h)) {
        out.push([t, base + h]);
      }
    }
  }
  return out;
}

function c23_mut(_g      , c        , p                  , b          )          {
  b[p[1]] = p[0] | (c << 3);
  return true;
}

function c23_apply(g      , c        , p                  )       {
  g.pos.board[p[1]] = p[0] | (c << 3);
  g.touch(p[1]);
}

// ---- 24 Early Promotion --------------------------------------------------
function c24_cands(g      , c        )                     {
  const out                     = [];
  const pawns = sqs(g, c, [PAWN]);
  for (let i = 0; i < pawns.length; i++) {
    const s = pawns[i];
    const r = s >> 3;
    if ((c === WHITE && r >= 4) || (c === BLACK && r <= 3)) {
      out.push([s, KNIGHT]);
      out.push([s, BISHOP]);
    }
  }
  return out;
}

function c24_mut(_g      , c        , p                  , b          )          {
  b[p[0]] = p[1] | (c << 3);
  return true;
}

function c24_apply(g      , c        , p                  )       {
  g.pos.board[p[0]] = p[1] | (c << 3);
}

const TABLE         = [
  new Card(1, "Pawn Rush", 1, c1_cands, c1_apply),
  new Card(2, "Extra Step", 2, c2_cands, c2_apply),
  new Card(3, "Double Leap", 2, c3_cands, c3_apply),
  new Card(4, "Borrowed Moves", 3, c4_cands, c4_apply),
  new Card(5, "Swap Places", 3, c5_cands, c5_apply, { mut: c5_mut }),
  new Card(6, "Second Move", 5, c6_cands, c6_apply),
  new Card(7, "Fall Back", 1, c7_cands, c7_apply, { mut: _moveMut }),
  new Card(8, "Silence", 3, NO_PARAM, c8_apply),
  new Card(9, "Freeze", 2, c9_cands, c9_apply),
  new Card(10, "Shove", 2, c10_cands, c10_apply, { mut: _moveMut }),
  new Card(11, "Wall", 2, c11_cands, c11_apply, {
    customLegal: c11_legal,
    optionsFn: c11_options,
  }),
  new Card(12, "Shield", 3, c12_cands, c12_apply),
  new Card(13, "Drain", 3, NO_PARAM, c13_apply),
  new Card(14, "Reveal", 1, NO_PARAM, c14_apply),
  new Card(15, "Discard", 2, NO_PARAM, c15_apply),
  new Card(16, "Steal", 3, NO_PARAM, c16_apply),
  new Card(17, "Ambush", 2, c17_cands, c17_apply, { mut: _removeMut }),
  new Card(18, "Execution", 5, c18_cands, c18_apply, {
    mut: _removeMut,
    post: c18_post,
  }),
  new Card(19, "Turncoat Pawn", 5, c19_cands, c19_apply, { mut: c19_mut }),
  new Card(20, "Study", 2, NO_PARAM, c20_apply),
  new Card(21, "Ritual", 1, NO_PARAM, c21_apply, { customLegal: c21_legal }),
  new Card(22, "Sacrifice", 1, c22_cands, c22_apply, { mut: _removeMut }),
  new Card(23, "Resurrection", 5, c23_cands, c23_apply, { mut: c23_mut }),
  new Card(24, "Early Promotion", 4, c24_cands, c24_apply, { mut: c24_mut }),
];

export const CARDS                       = {};
for (let i = 0; i < TABLE.length; i++) {
  CARDS[TABLE[i].id] = TABLE[i];
}

export const ALL_IDS           = TABLE.map((c) => c.id);
// Lighter deck: the 24 minus Double Leap, Second Move, Borrowed Moves, Wall, Fall Back, Swap Places, Resurrection and Extra Step (decision 2026-10-28, see GDD).
export const STARTER_IDS           = [1, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24];
