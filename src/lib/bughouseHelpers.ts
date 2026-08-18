// Bughouse helpers
import { Chess } from 'chess.js';

export type DropPiece = 'P' | 'N' | 'B' | 'R' | 'Q';

/**
 * Применяет дроп фигуры к позиции (через FEN).
 * @returns новый FEN или null если дроп нелегальный
 */
export function applyDrop(
  currentFen: string,
  piece: DropPiece,
  toSquare: string,
  color: 'white' | 'black'
): { newFen: string; isCheckmate: boolean; isStalemate: boolean } | null {
  // Парсим FEN
  const parts = currentFen.split(' ');
  if (parts.length < 6) return null;
  const [boardPart, turnPart, castling, enPassant, halfmove, fullmove] = parts;

  // Проверка: чей сейчас ход должен совпадать с цветом дропающего
  const expectedTurn = color === 'white' ? 'w' : 'b';
  if (turnPart !== expectedTurn) return null;

  // Целевая клетка
  const file = toSquare.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(toSquare[1], 10);
  if (isNaN(rank) || rank < 1 || rank > 8 || file < 0 || file > 7) return null;

  // Pawn restriction: нельзя на 1-й или 8-й ряд
  if (piece === 'P' && (rank === 1 || rank === 8)) return null;

  // Распарсиваем board в 2D
  const rows = boardPart.split('/');
  if (rows.length !== 8) return null;
  const board: string[][] = [];
  for (const row of rows) {
    const r: string[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        const n = parseInt(ch, 10);
        for (let i = 0; i < n; i++) r.push('');
      } else {
        r.push(ch);
      }
    }
    if (r.length !== 8) return null;
    board.push(r);
  }

  // Целевая клетка пуста?
  const rowIdx = 8 - rank;
  const colIdx = file;
  if (board[rowIdx][colIdx] !== '') return null;

  // Ставим фигуру
  board[rowIdx][colIdx] = color === 'white' ? piece : piece.toLowerCase();

  // Собираем новый FEN
  const newBoardPart = board.map(r => {
    let str = '';
    let emptyCount = 0;
    for (const cell of r) {
      if (cell === '') {
        emptyCount++;
      } else {
        if (emptyCount > 0) { str += emptyCount; emptyCount = 0; }
        str += cell;
      }
    }
    if (emptyCount > 0) str += emptyCount;
    return str;
  }).join('/');

  const newTurn = color === 'white' ? 'b' : 'w';
  const newHalfmove = '0'; // дроп сбрасывает halfmove counter
  const newFullmove = color === 'black' ? String(parseInt(fullmove, 10) + 1) : fullmove;

  const newFen = `${newBoardPart} ${newTurn} ${castling} - ${newHalfmove} ${newFullmove}`;

  // Проверяем мат/пат через chess.js
  let isCheckmate = false;
  let isStalemate = false;
  try {
    const c = new Chess(newFen);
    isCheckmate = c.isCheckmate();
    isStalemate = c.isStalemate();
  } catch {
    // FEN некорректный — отменяем
    return null;
  }

  return { newFen, isCheckmate, isStalemate };
}

/**
 * Если ход chess.js взял фигуру, вернёт её ТИП ('p','n','b','r','q'),
 * который партнёр получит в свой drop pool.
 * Note: если съели фигуру которая раньше была pawn-promoted, в bughouse она возвращается
 * партнёру как pawn (исходный тип). Мы упрощаем — возвращаем как есть.
 */
export function capturedPieceType(captured: string | undefined | null): DropPiece | null {
  if (!captured) return null;
  const t = captured.toUpperCase();
  if (t === 'P' || t === 'N' || t === 'B' || t === 'R' || t === 'Q') return t as DropPiece;
  return null;
}
