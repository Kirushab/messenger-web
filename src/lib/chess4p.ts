// 4-Player Chess engine for Sigmas
// 14x14 board with corners removed (3x3 in each corner)
// Players: Red (south), Blue (west), Yellow (north), Green (east)
// Move order: R -> B -> Y -> G (clockwise)

export type Color4 = 'R' | 'B' | 'Y' | 'G';
export type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
export type Piece = { color: Color4; type: PieceType };
export type Square4 = { row: number; col: number }; // 0..13

export const BOARD_SIZE = 14;
export const CORNER_SIZE = 3; // 3x3 cutout corners

export interface Move4 {
  from: Square4;
  to: Square4;
  promotion?: PieceType;
  captured?: Piece;
  san?: string;
}

export interface CastlingRights {
  kingMoved: boolean;
  kingsideRookMoved: boolean;
  queensideRookMoved: boolean;
}

export interface GameState4 {
  board: (Piece | null)[][];
  turn: Color4;
  scores: Record<Color4, number>;
  alive: Record<Color4, boolean>;
  moveNumber: number;
  lastMove: Move4 | null;
  pawnDoubleMove: { color: Color4; row: number; col: number; movedThisTurnByColor: Color4 } | null;
  castling: Record<Color4, CastlingRights>;
}

// ============================================================
// Board helpers
// ============================================================

export function isCorner(row: number, col: number): boolean {
  // 3x3 corners removed
  if (row < CORNER_SIZE && col < CORNER_SIZE) return true; // top-left
  if (row < CORNER_SIZE && col >= BOARD_SIZE - CORNER_SIZE) return true; // top-right
  if (row >= BOARD_SIZE - CORNER_SIZE && col < CORNER_SIZE) return true; // bottom-left
  if (row >= BOARD_SIZE - CORNER_SIZE && col >= BOARD_SIZE - CORNER_SIZE) return true; // bottom-right
  return false;
}

export function isInBounds(row: number, col: number): boolean {
  if (row < 0 || row >= BOARD_SIZE) return false;
  if (col < 0 || col >= BOARD_SIZE) return false;
  if (isCorner(row, col)) return false;
  return true;
}

export function squareEq(a: Square4, b: Square4): boolean {
  return a.row === b.row && a.col === b.col;
}

// Convert square to algebraic-like notation: "a1" .. "n14"
export function squareToString(s: Square4): string {
  const file = String.fromCharCode('a'.charCodeAt(0) + s.col);
  const rank = BOARD_SIZE - s.row; // row 0 = rank 14
  return `${file}${rank}`;
}

export function stringToSquare(str: string): Square4 | null {
  if (str.length < 2 || str.length > 3) return null;
  const file = str.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(str.slice(1), 10);
  if (isNaN(rank)) return null;
  const row = BOARD_SIZE - rank;
  return { row, col: file };
}

// ============================================================
// Initial position
// ============================================================

export function createInitialState(): GameState4 {
  // Build empty board with corners as null (we'll use null for both empty and corner;
  // use isCorner() to distinguish)
  const board: (Piece | null)[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: (Piece | null)[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push(null);
    }
    board.push(row);
  }

  // Standard back rank order: R N B Q K B N R
  const backRank: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

  // YELLOW (north, top, rows 0-1): pawns row 1, back row 0
  // Columns 3..10 (inclusive, 8 columns)
  for (let i = 0; i < 8; i++) {
    board[0][3 + i] = { color: 'Y', type: backRank[i] };
    board[1][3 + i] = { color: 'Y', type: 'P' };
  }

  // RED (south, bottom, rows 12-13): pawns row 12, back row 13
  // Columns 3..10
  for (let i = 0; i < 8; i++) {
    board[13][3 + i] = { color: 'R', type: backRank[i] };
    board[12][3 + i] = { color: 'R', type: 'P' };
  }

  // BLUE (west, left, columns 0-1): pawns col 1, back col 0
  // Rows 3..10
  // Back rank order rotated — for blue, the king should be at "central" position
  // We use: R N B Q K B N R from top to bottom
  for (let i = 0; i < 8; i++) {
    board[3 + i][0] = { color: 'B', type: backRank[i] };
    board[3 + i][1] = { color: 'B', type: 'P' };
  }

  // GREEN (east, right, columns 12-13): pawns col 12, back col 13
  for (let i = 0; i < 8; i++) {
    board[3 + i][13] = { color: 'G', type: backRank[i] };
    board[3 + i][12] = { color: 'G', type: 'P' };
  }

  return {
    board,
    turn: 'R',
    scores: { R: 0, B: 0, Y: 0, G: 0 },
    alive: { R: true, B: true, Y: true, G: true },
    moveNumber: 1,
    lastMove: null,
    pawnDoubleMove: null,
    castling: {
      R: { kingMoved: false, kingsideRookMoved: false, queensideRookMoved: false },
      B: { kingMoved: false, kingsideRookMoved: false, queensideRookMoved: false },
      Y: { kingMoved: false, kingsideRookMoved: false, queensideRookMoved: false },
      G: { kingMoved: false, kingsideRookMoved: false, queensideRookMoved: false },
    },
  };
}

// ============================================================
// Move generation
// ============================================================

const KNIGHT_OFFSETS: [number, number][] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const KING_OFFSETS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

const ROOK_DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIRS: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

// Pawn movement direction: where pawn moves forward
function pawnForward(color: Color4): [number, number] {
  switch (color) {
    case 'R': return [-1, 0]; // red moves up
    case 'Y': return [1, 0];  // yellow moves down
    case 'B': return [0, 1];  // blue moves right
    case 'G': return [0, -1]; // green moves left
  }
}

// Pawn diagonal capture offsets
function pawnCaptures(color: Color4): [number, number][] {
  switch (color) {
    case 'R': return [[-1, -1], [-1, 1]];
    case 'Y': return [[1, -1], [1, 1]];
    case 'B': return [[-1, 1], [1, 1]];
    case 'G': return [[-1, -1], [1, -1]];
  }
}

// Pawn starting row check
function isPawnStart(color: Color4, row: number, col: number): boolean {
  switch (color) {
    case 'R': return row === 12;
    case 'Y': return row === 1;
    case 'B': return col === 1;
    case 'G': return col === 12;
  }
}

// Pawn promotion check
function isPawnPromotion(color: Color4, row: number, col: number): boolean {
  switch (color) {
    case 'R': return row === 4;
    case 'Y': return row === 9;
    case 'B': return col === 9;
    case 'G': return col === 4;
  }
}

// Initial king and rook positions
export function initialKingSquare(color: Color4): Square4 {
  switch (color) {
    case 'R': return { row: 13, col: 7 };
    case 'Y': return { row: 0, col: 7 };
    case 'B': return { row: 7, col: 0 };
    case 'G': return { row: 7, col: 13 };
  }
}

// Kingside rook is on the K-side of the back rank
// For each color, "kingside" = direction toward the higher-numbered side from king
export function initialRookSquare(color: Color4, side: 'kingside' | 'queenside'): Square4 {
  switch (color) {
    case 'R': return side === 'kingside' ? { row: 13, col: 10 } : { row: 13, col: 3 };
    case 'Y': return side === 'kingside' ? { row: 0, col: 10 } : { row: 0, col: 3 };
    case 'B': return side === 'kingside' ? { row: 10, col: 0 } : { row: 3, col: 0 };
    case 'G': return side === 'kingside' ? { row: 10, col: 13 } : { row: 3, col: 13 };
  }
}

// Castled king destination (king moves 2 squares toward rook)
export function castledKingSquare(color: Color4, side: 'kingside' | 'queenside'): Square4 {
  const king = initialKingSquare(color);
  switch (color) {
    case 'R':
    case 'Y':
      return { row: king.row, col: side === 'kingside' ? king.col + 2 : king.col - 2 };
    case 'B':
    case 'G':
      return { row: side === 'kingside' ? king.row + 2 : king.row - 2, col: king.col };
  }
}

// Castled rook destination (rook ends up next to king on the opposite side)
export function castledRookSquare(color: Color4, side: 'kingside' | 'queenside'): Square4 {
  const king = initialKingSquare(color);
  switch (color) {
    case 'R':
    case 'Y':
      return { row: king.row, col: side === 'kingside' ? king.col + 1 : king.col - 1 };
    case 'B':
    case 'G':
      return { row: side === 'kingside' ? king.row + 1 : king.row - 1, col: king.col };
  }
}

export function getPiece(state: GameState4, sq: Square4): Piece | null {
  if (!isInBounds(sq.row, sq.col)) return null;
  return state.board[sq.row][sq.col];
}

// Generate pseudo-legal moves (without filtering own-king-in-check)
function generatePseudoMoves(state: GameState4, sq: Square4): Square4[] {
  const piece = getPiece(state, sq);
  if (!piece) return [];
  const moves: Square4[] = [];
  const { row, col } = sq;

  const slideDirs = (dirs: [number, number][]) => {
    for (const [dr, dc] of dirs) {
      let r = row + dr, c = col + dc;
      while (isInBounds(r, c)) {
        const target = state.board[r][c];
        if (!target) {
          moves.push({ row: r, col: c });
        } else {
          if (target.color !== piece.color) moves.push({ row: r, col: c });
          break;
        }
        r += dr; c += dc;
      }
    }
  };

  if (piece.type === 'P') {
    const [fr, fc] = pawnForward(piece.color);
    // 1 step forward
    const r1 = row + fr, c1 = col + fc;
    if (isInBounds(r1, c1) && !state.board[r1][c1]) {
      moves.push({ row: r1, col: c1 });
      // 2 steps from start
      if (isPawnStart(piece.color, row, col)) {
        const r2 = row + 2 * fr, c2 = col + 2 * fc;
        if (isInBounds(r2, c2) && !state.board[r2][c2]) {
          moves.push({ row: r2, col: c2 });
        }
      }
    }
    // Captures (regular)
    for (const [dr, dc] of pawnCaptures(piece.color)) {
      const cr = row + dr, cc = col + dc;
      if (!isInBounds(cr, cc)) continue;
      const target = state.board[cr][cc];
      if (target && target.color !== piece.color) {
        moves.push({ row: cr, col: cc });
      }
    }
    // En passant: capture a pawn that just made double-move and is adjacent
    if (state.pawnDoubleMove && state.pawnDoubleMove.color !== piece.color) {
      const ep = state.pawnDoubleMove;
      // Pawn must be next to ours (side-adjacent to our forward direction)
      // For our pawn at (row,col), we capture en passant if their pawn is at the square
      // such that we move diagonally onto the square BEHIND their pawn (where they passed through)
      for (const [dr, dc] of pawnCaptures(piece.color)) {
        const cr = row + dr, cc = col + dc;
        if (!isInBounds(cr, cc)) continue;
        // The square we'd land on must be the "passed-through" square of the enemy pawn
        // Enemy pawn ended at (ep.row, ep.col); started 2 forward of that against THEIR direction
        const [efr, efc] = pawnForward(ep.color);
        const passedRow = ep.row - efr; // square enemy passed through
        const passedCol = ep.col - efc;
        if (cr === passedRow && cc === passedCol) {
          // Also: our current row/col must be adjacent to the enemy's final square in the perpendicular direction
          // (i.e. we'd be capturing diagonally)
          moves.push({ row: cr, col: cc });
        }
      }
    }
  } else if (piece.type === 'N') {
    for (const [dr, dc] of KNIGHT_OFFSETS) {
      const r = row + dr, c = col + dc;
      if (!isInBounds(r, c)) continue;
      const target = state.board[r][c];
      if (!target || target.color !== piece.color) moves.push({ row: r, col: c });
    }
  } else if (piece.type === 'B') {
    slideDirs(BISHOP_DIRS);
  } else if (piece.type === 'R') {
    slideDirs(ROOK_DIRS);
  } else if (piece.type === 'Q') {
    slideDirs(BISHOP_DIRS);
    slideDirs(ROOK_DIRS);
  } else if (piece.type === 'K') {
    for (const [dr, dc] of KING_OFFSETS) {
      const r = row + dr, c = col + dc;
      if (!isInBounds(r, c)) continue;
      const target = state.board[r][c];
      if (!target || target.color !== piece.color) moves.push({ row: r, col: c });
    }
  }

  return moves;
}

// Check if the given color's king is attacked by any piece (of any alive opponent)
export function isInCheck(state: GameState4, color: Color4): boolean {
  // Find king
  let kingSq: Square4 | null = null;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = state.board[r][c];
      if (p && p.color === color && p.type === 'K') {
        kingSq = { row: r, col: c };
        break;
      }
    }
    if (kingSq) break;
  }
  if (!kingSq) return false;

  // Check all opponent pieces
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = state.board[r][c];
      if (!p || p.color === color || !state.alive[p.color]) continue;
      const attacks = generatePseudoMoves(state, { row: r, col: c });
      for (const a of attacks) {
        if (squareEq(a, kingSq)) return true;
      }
    }
  }
  return false;
}

// Make a move (mutates), return captured piece info
function applyMove(state: GameState4, from: Square4, to: Square4, promotion?: PieceType): Piece | null {
  const piece = state.board[from.row][from.col];
  if (!piece) return null;
  let captured: Piece | null = state.board[to.row][to.col];

  // Detect castling: king moves 2 squares
  const isCastling = piece.type === 'K' && (Math.abs(to.col - from.col) === 2 || Math.abs(to.row - from.row) === 2);

  // Detect en passant: pawn diagonal move onto empty square
  const isEnPassant = piece.type === 'P' && !captured && (from.row !== to.row && from.col !== to.col)
    || piece.type === 'P' && !captured && (
      // For horizontal-moving pawns (B, G), it's a row-only adjacent shift to a different col? Same logic
      (from.row !== to.row && from.col !== to.col)
    );

  // Move piece
  state.board[to.row][to.col] = piece;
  state.board[from.row][from.col] = null;

  // Handle en passant: remove the captured pawn (it's on pawnDoubleMove square)
  if (isEnPassant && state.pawnDoubleMove) {
    const ep = state.pawnDoubleMove;
    captured = state.board[ep.row][ep.col];
    state.board[ep.row][ep.col] = null;
  }

  // Handle castling: move the rook too
  if (isCastling) {
    // Determine side
    let side: 'kingside' | 'queenside';
    if (piece.color === 'R' || piece.color === 'Y') {
      side = to.col > from.col ? 'kingside' : 'queenside';
    } else {
      side = to.row > from.row ? 'kingside' : 'queenside';
    }
    const rookHome = initialRookSquare(piece.color, side);
    const rookTarget = castledRookSquare(piece.color, side);
    const rook = state.board[rookHome.row][rookHome.col];
    state.board[rookHome.row][rookHome.col] = null;
    state.board[rookTarget.row][rookTarget.col] = rook;
    // Mark rook moved
    if (side === 'kingside') state.castling[piece.color].kingsideRookMoved = true;
    else state.castling[piece.color].queensideRookMoved = true;
  }

  // Update castling rights
  if (piece.type === 'K') {
    state.castling[piece.color].kingMoved = true;
  }
  if (piece.type === 'R') {
    // Check if it moved from initial rook square
    for (const side of ['kingside', 'queenside'] as const) {
      const home = initialRookSquare(piece.color, side);
      if (squareEq(from, home)) {
        if (side === 'kingside') state.castling[piece.color].kingsideRookMoved = true;
        else state.castling[piece.color].queensideRookMoved = true;
      }
    }
  }
  // Also: if a rook was captured on its home square, the opponent loses that castling right
  if (captured && captured.type === 'R') {
    for (const side of ['kingside', 'queenside'] as const) {
      const home = initialRookSquare(captured.color, side);
      if (squareEq(to, home)) {
        if (side === 'kingside') state.castling[captured.color].kingsideRookMoved = true;
        else state.castling[captured.color].queensideRookMoved = true;
      }
    }
  }

  // Promotion
  if (piece.type === 'P' && isPawnPromotion(piece.color, to.row, to.col)) {
    state.board[to.row][to.col] = { color: piece.color, type: promotion || 'Q' };
  }

  // Track pawn double-move (for en passant on next move)
  state.pawnDoubleMove = null;
  if (piece.type === 'P') {
    const distRow = Math.abs(to.row - from.row);
    const distCol = Math.abs(to.col - from.col);
    if (distRow === 2 || distCol === 2) {
      state.pawnDoubleMove = { color: piece.color, row: to.row, col: to.col, movedThisTurnByColor: piece.color };
    }
  }

  return captured;
}

// Check if any opponent attacks square `sq`
function isSquareAttackedByOpponent(state: GameState4, sq: Square4, defender: Color4): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = state.board[r][c];
      if (!p || p.color === defender || !state.alive[p.color]) continue;
      const attacks = generatePseudoMoves(state, { row: r, col: c });
      for (const a of attacks) {
        if (squareEq(a, sq)) return true;
      }
    }
  }
  return false;
}

// Get LEGAL moves: pseudo moves that don't leave own king in check + castling
export function getLegalMoves(state: GameState4, sq: Square4): Square4[] {
  const piece = getPiece(state, sq);
  if (!piece || piece.color !== state.turn || !state.alive[piece.color]) return [];

  const pseudo = generatePseudoMoves(state, sq);
  const legal: Square4[] = [];

  for (const to of pseudo) {
    // Simulate move (handle en passant capture)
    const savedTo = state.board[to.row][to.col];
    const savedFrom = state.board[sq.row][sq.col];
    let epCapturedSq: Square4 | null = null;
    let epCapturedPiece: Piece | null = null;
    // Detect en passant: pawn move diagonally onto empty square
    if (piece.type === 'P' && !savedTo) {
      // It's a diagonal move (col or row changed without landing on piece) => en passant
      if (state.pawnDoubleMove) {
        const ep = state.pawnDoubleMove;
        epCapturedSq = { row: ep.row, col: ep.col };
        epCapturedPiece = state.board[ep.row][ep.col];
        if (epCapturedPiece) state.board[ep.row][ep.col] = null;
      }
    }
    state.board[to.row][to.col] = savedFrom;
    state.board[sq.row][sq.col] = null;

    const inCheck = isInCheck(state, piece.color);

    // Revert
    state.board[sq.row][sq.col] = savedFrom;
    state.board[to.row][to.col] = savedTo;
    if (epCapturedSq && epCapturedPiece) {
      state.board[epCapturedSq.row][epCapturedSq.col] = epCapturedPiece;
    }

    if (!inCheck) legal.push(to);
  }

  // Castling (only for king on initial square, not moved)
  if (piece.type === 'K') {
    const rights = state.castling[piece.color];
    const kingHome = initialKingSquare(piece.color);
    if (!rights.kingMoved && squareEq(sq, kingHome) && !isInCheck(state, piece.color)) {
      // Try kingside and queenside
      for (const side of ['kingside', 'queenside'] as const) {
        const rookMoved = side === 'kingside' ? rights.kingsideRookMoved : rights.queensideRookMoved;
        if (rookMoved) continue;
        const rookHome = initialRookSquare(piece.color, side);
        const rookPiece = state.board[rookHome.row][rookHome.col];
        if (!rookPiece || rookPiece.type !== 'R' || rookPiece.color !== piece.color) continue;

        // All squares between king and rook must be empty
        const kingTarget = castledKingSquare(piece.color, side);
        const rookTarget = castledRookSquare(piece.color, side);

        // Direction from king to rook
        const dRow = Math.sign(rookHome.row - kingHome.row);
        const dCol = Math.sign(rookHome.col - kingHome.col);

        // Empty squares check (between king and rook, exclusive)
        let pathClear = true;
        let r = kingHome.row + dRow, c = kingHome.col + dCol;
        while (r !== rookHome.row || c !== rookHome.col) {
          if (state.board[r][c]) { pathClear = false; break; }
          r += dRow; c += dCol;
        }
        if (!pathClear) continue;

        // King must not pass through attacked squares (king home, king pass-through, king target)
        // Pass-through is between kingHome and kingTarget
        const passSq = { row: kingHome.row + dRow, col: kingHome.col + dCol };
        let attacksClear = true;
        for (const s of [kingHome, passSq, kingTarget]) {
          // Simulate king on s
          const old = state.board[s.row][s.col];
          state.board[kingHome.row][kingHome.col] = null;
          state.board[s.row][s.col] = piece;
          const attacked = isSquareAttackedByOpponent(state, s, piece.color);
          // Revert
          state.board[s.row][s.col] = old;
          state.board[kingHome.row][kingHome.col] = piece;
          if (attacked) { attacksClear = false; break; }
        }
        if (!attacksClear) continue;

        // Castling is legal — add king target as a move
        legal.push(kingTarget);
      }
    }
  }

  return legal;
}

// All legal moves for a given color (used to detect stalemate/checkmate)
export function getAllLegalMoves(state: GameState4, color: Color4): { from: Square4; to: Square4 }[] {
  const result: { from: Square4; to: Square4 }[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== color) continue;
      const from = { row: r, col: c };
      // Need to set turn to this color temporarily
      const savedTurn = state.turn;
      state.turn = color;
      const moves = getLegalMoves(state, from);
      state.turn = savedTurn;
      for (const to of moves) {
        result.push({ from, to });
      }
    }
  }
  return result;
}

// ============================================================
// Scoring
// ============================================================

export const PIECE_VALUES: Record<PieceType, number> = {
  P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0,
};

export const CHECKMATE_BONUS = 20;
export const STALEMATE_BONUS = 10;

// ============================================================
// High-level move execution
// ============================================================

export interface MoveResult {
  state: GameState4;
  captured: Piece | null;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isWin: boolean; // Game over with a clear winner
  eliminatedColors: Color4[]; // Colors that got mated this move
}

const PLAYER_ORDER: Color4[] = ['R', 'B', 'Y', 'G'];

function nextTurn(current: Color4, alive: Record<Color4, boolean>): Color4 {
  const idx = PLAYER_ORDER.indexOf(current);
  for (let i = 1; i <= 4; i++) {
    const next = PLAYER_ORDER[(idx + i) % 4];
    if (alive[next]) return next;
  }
  return current;
}

export function makeMove(
  state: GameState4,
  from: Square4,
  to: Square4,
  promotion?: PieceType
): MoveResult {
  const piece = getPiece(state, from);
  if (!piece || piece.color !== state.turn) {
    throw new Error('Invalid: not your piece or not your turn');
  }

  // Validate legality
  const legal = getLegalMoves(state, from);
  if (!legal.some(m => squareEq(m, to))) {
    throw new Error('Illegal move');
  }

  // Deep-copy state? For simplicity, mutate (caller should pass a copy if needed)
  const captured = applyMove(state, from, to, promotion);

  // Add score
  if (captured) {
    state.scores[piece.color] += PIECE_VALUES[captured.type];
  }

  state.lastMove = { from, to, promotion, captured: captured || undefined };

  // Move to next player
  state.turn = nextTurn(state.turn, state.alive);
  if (piece.color === 'G') state.moveNumber += 1;

  // Check check / mate / stalemate for the NEW current player and all others
  const eliminatedColors: Color4[] = [];
  let movingPlayerCheck = false;

  // Check all alive players (typical chess rule: when it's your turn, you must not be in checkmate)
  // In 4P chess (free-for-all), if it's your turn and you have no moves, you're stalemated (out)
  // If you're checkmated, the player who delivered mate gets +20
  const nextColor = state.turn;
  if (state.alive[nextColor]) {
    const moves = getAllLegalMoves(state, nextColor);
    const inCheck = isInCheck(state, nextColor);
    if (moves.length === 0) {
      // Eliminated
      eliminatedColors.push(nextColor);
      if (inCheck) {
        // Checkmate — bonus to mover
        state.scores[piece.color] += CHECKMATE_BONUS;
      } else {
        // Stalemate — smaller bonus
        state.scores[piece.color] += STALEMATE_BONUS;
      }
      state.alive[nextColor] = false;
      // Remove all pieces of this color from the board
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const p = state.board[r][c];
          if (p && p.color === nextColor) {
            state.board[r][c] = null;
          }
        }
      }
      // Advance turn again (skip the eliminated player)
      state.turn = nextTurn(state.turn, state.alive);
    }
    movingPlayerCheck = inCheck;
  }

  const aliveCount = Object.values(state.alive).filter(Boolean).length;
  const isWin = aliveCount <= 1;

  return {
    state,
    captured,
    isCheck: movingPlayerCheck && eliminatedColors.length === 0,
    isCheckmate: eliminatedColors.length > 0 && movingPlayerCheck,
    isStalemate: eliminatedColors.length > 0 && !movingPlayerCheck,
    isWin,
    eliminatedColors,
  };
}

// ============================================================
// Resign (player gives up)
// ============================================================

export function applyResign(state: GameState4, color: Color4): void {
  if (!state.alive[color]) return;
  state.alive[color] = false;
  // Remove pieces
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = state.board[r][c];
      if (p && p.color === color) {
        state.board[r][c] = null;
      }
    }
  }
  // If it was their turn, advance to next
  if (state.turn === color) {
    state.turn = nextTurn(color, state.alive);
  }
}

// ============================================================
// Serialization (for storage/sync)
// ============================================================

export function serializeState(state: GameState4): any {
  // board as a flat array of strings
  const flatBoard: (string | null)[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = state.board[r][c];
      flatBoard.push(p ? `${p.color}${p.type}` : null);
    }
  }
  return {
    b: flatBoard,
    t: state.turn,
    s: state.scores,
    a: state.alive,
    m: state.moveNumber,
    l: state.lastMove ? {
      f: [state.lastMove.from.row, state.lastMove.from.col],
      t: [state.lastMove.to.row, state.lastMove.to.col],
      p: state.lastMove.promotion,
    } : null,
    p: state.pawnDoubleMove,
    c: state.castling,
  };
}

export function deserializeState(data: any): GameState4 {
  const board: (Piece | null)[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: (Piece | null)[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = data.b[r * BOARD_SIZE + c];
      if (cell) {
        row.push({ color: cell[0] as Color4, type: cell[1] as PieceType });
      } else {
        row.push(null);
      }
    }
    board.push(row);
  }
  // Backward compat: if castling not in old saved states, default all rights to true (not moved)
  const castling = data.c || {
    R: { kingMoved: false, kingsideRookMoved: false, queensideRookMoved: false },
    B: { kingMoved: false, kingsideRookMoved: false, queensideRookMoved: false },
    Y: { kingMoved: false, kingsideRookMoved: false, queensideRookMoved: false },
    G: { kingMoved: false, kingsideRookMoved: false, queensideRookMoved: false },
  };
  return {
    board,
    turn: data.t,
    scores: data.s,
    alive: data.a,
    moveNumber: data.m,
    lastMove: data.l ? {
      from: { row: data.l.f[0], col: data.l.f[1] },
      to: { row: data.l.t[0], col: data.l.t[1] },
      promotion: data.l.p,
    } : null,
    pawnDoubleMove: data.p,
    castling,
  };
}
