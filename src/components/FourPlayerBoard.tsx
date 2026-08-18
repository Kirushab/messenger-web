import { useState, useMemo, useEffect } from 'react';
import {
  BOARD_SIZE, isCorner, isInBounds, squareEq,
  getLegalMoves, getPiece,
  type GameState4, type Square4, type Color4, type PieceType,
} from '@/lib/chess4p';
import ChessPieceSVG from './ChessPieceSVG';

const PIECE_GLYPH: Record<PieceType, string> = {
  P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚',
};

const COLOR_STYLES: Record<Color4, { fill: string; stroke: string; bg: string }> = {
  // v58.14: премиум-палитра — благородные оттенки без «детского» сатурейта
  // R — глубокий рубин/гранат с тёплым тоном (вместо ярко-красного)
  // B — кобальт-индиго (вместо обычного синего)
  // Y — старое золото/охра (вместо жёлтого)
  // G — изумруд лесной (вместо ярко-зелёного)
  R: { fill: '#8B2A3C', stroke: '#5A1825', bg: '#f0d2d6' },
  B: { fill: '#27407A', stroke: '#172846', bg: '#cdd4e4' },
  Y: { fill: '#B68433', stroke: '#7A5418', bg: '#f0dfb8' },
  G: { fill: '#2A6E4A', stroke: '#17452D', bg: '#c4dac9' },
};

interface FourPlayerBoardProps {
  state: GameState4;
  myColor: Color4 | null;
  isMyTurn: boolean;
  disabled?: boolean;
  onMove: (from: Square4, to: Square4, promotion?: PieceType) => void;
  /** Стиль фигур: 'classic' или 'lichess:setName'. */
  pieceStyle?: string;
  /** Тема доски: 'light' или 'wood'. */
  boardTheme?: 'light' | 'wood';
}

const FP_BOARD_THEMES = {
  wood:  { light: '#F0D9B5', dark: '#B58863' },
  light: { light: '#FFFFFF', dark: '#E5E7EB' },
};

export default function FourPlayerBoard({
  state, myColor, isMyTurn, disabled, onMove, pieceStyle = 'classic', boardTheme = 'wood',
}: FourPlayerBoardProps) {
  const [selected, setSelected] = useState<Square4 | null>(null);
  const [promotionMove, setPromotionMove] = useState<{ from: Square4; to: Square4 } | null>(null);

  // Rotate board so my color is at bottom
  const rotation = useMemo<0 | 1 | 2 | 3>(() => {
    if (!myColor) return 0; // spectator: red at bottom
    switch (myColor) {
      case 'R': return 0;
      case 'B': return 3; // blue was left → rotate 270° clockwise so blue is at bottom
      case 'Y': return 2;
      case 'G': return 1;
    }
  }, [myColor]);

  // Map view square (vr, vc) to actual board square (r, c)
  function viewToActual(vr: number, vc: number): { row: number; col: number } {
    const n = BOARD_SIZE - 1;
    switch (rotation) {
      case 0: return { row: vr, col: vc };
      case 1: return { row: n - vc, col: vr };
      case 2: return { row: n - vr, col: n - vc };
      case 3: return { row: vc, col: n - vr };
    }
  }

  // Map actual board square (r,c) → view coords (vr, vc)
  function actualToView(row: number, col: number): { vr: number; vc: number } {
    const n = BOARD_SIZE - 1;
    switch (rotation) {
      case 0: return { vr: row, vc: col };
      case 1: return { vr: col, vc: n - row };
      case 2: return { vr: n - row, vc: n - col };
      case 3: return { vr: n - col, vc: row };
    }
  }

  // Анимация движущейся фигуры
  const [moveAnim, setMoveAnim] = useState<{ glyph: string; color: Color4; fromX: number; fromY: number; toX: number; toY: number; phase: 'start'|'end' } | null>(null);

  useEffect(() => {
    if (!state.lastMove) return;
    const { from, to } = state.lastMove;
    const piece = getPiece(state, to);
    if (!piece) return;
    const fromView = actualToView(from.row, from.col);
    const toView = actualToView(to.row, to.col);
    const glyph = PIECE_GLYPH[piece.type];

    setMoveAnim({
      glyph, color: piece.color,
      fromX: fromView.vc, fromY: fromView.vr,
      toX: toView.vc, toY: toView.vr,
      phase: 'start',
    });
    const t1 = setTimeout(() => setMoveAnim(prev => prev ? { ...prev, phase: 'end' } : null), 16);
    const t2 = setTimeout(() => setMoveAnim(null), 320);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [state.lastMove?.from?.row, state.lastMove?.from?.col, state.lastMove?.to?.row, state.lastMove?.to?.col]);

  const possibleMoves = useMemo(() => {
    if (!selected) return [] as Square4[];
    return getLegalMoves(state, selected);
  }, [state, selected]);
  const possibleSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of possibleMoves) s.add(`${m.row}-${m.col}`);
    return s;
  }, [possibleMoves]);

  function handleClick(actualRow: number, actualCol: number) {
    if (disabled || !myColor) return;
    if (!isInBounds(actualRow, actualCol)) return;

    const sq = { row: actualRow, col: actualCol };

    if (selected) {
      const isPossible = possibleSet.has(`${sq.row}-${sq.col}`);
      if (isPossible) {
        // Check for pawn promotion
        const piece = getPiece(state, selected);
        if (piece?.type === 'P') {
          // Detect promotion row/col
          const goesToPromote = (
            (piece.color === 'R' && sq.row === 4) ||
            (piece.color === 'Y' && sq.row === 9) ||
            (piece.color === 'B' && sq.col === 9) ||
            (piece.color === 'G' && sq.col === 4)
          );
          if (goesToPromote) {
            setPromotionMove({ from: selected, to: sq });
            return;
          }
        }
        onMove(selected, sq);
        setSelected(null);
        return;
      }
      if (squareEq(sq, selected)) {
        setSelected(null);
        return;
      }
    }

    const piece = getPiece(state, sq);
    if (!piece || piece.color !== myColor || !isMyTurn) {
      setSelected(null);
      return;
    }
    setSelected(sq);
  }

  const lastMove = state.lastMove;
  const cells: JSX.Element[] = [];
  for (let vr = 0; vr < BOARD_SIZE; vr++) {
    for (let vc = 0; vc < BOARD_SIZE; vc++) {
      const { row, col } = viewToActual(vr, vc);
      const corner = isCorner(row, col);

      if (corner) {
        cells.push(
          <div key={`${vr}-${vc}`} style={{ background: 'transparent' }} />
        );
        continue;
      }

      const piece = state.board[row]?.[col];
      const isSelected = selected && squareEq(selected, { row, col });
      const isPossible = possibleSet.has(`${row}-${col}`);
      const isLastFrom = lastMove && squareEq(lastMove.from, { row, col });
      const isLastTo = lastMove && squareEq(lastMove.to, { row, col });
      const isLight = (row + col) % 2 === 0;
      const pal = FP_BOARD_THEMES[boardTheme];

      // Простые плоские цвета по выбранной теме
      let bg: string = isLight ? pal.light : pal.dark;
      if (isSelected) bg = '#BBCB44';
      if (isLastFrom || isLastTo) bg = isLight ? '#F6F669' : '#BACA2B';

      const pieceColor = piece ? COLOR_STYLES[piece.color] : null;

      cells.push(
        <div
          key={`${vr}-${vc}`}
          onClick={() => handleClick(row, col)}
          className={`tap-effect-light ${isLastTo ? 'chess-square-flash' : ''}`}
          style={{
            position: 'relative',
            background: bg,
            boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: !disabled && myColor ? 'pointer' : 'default',
            userSelect: 'none',
            fontSize: 'min(3.5vw, 22px)',
            lineHeight: 1,
            transition: 'background-color 200ms ease',
          }}
        >
          {piece && pieceColor && (
            <span style={{
              pointerEvents: 'none',
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ChessPieceSVG variant={pieceStyle}
                symbol={piece.type}
                fill={pieceColor.fill}
                stroke={pieceColor.stroke}
                style={{ width: '88%', height: '88%', maxWidth: '100%', maxHeight: '100%' }}
              />
            </span>
          )}
          {isPossible && !piece && (
            <div style={{
              position: 'absolute',
              width: '32%', height: '32%',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.3)',
              pointerEvents: 'none',
            }} />
          )}
          {isPossible && piece && (
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              border: '3px solid rgba(0,0,0,0.4)',
              pointerEvents: 'none',
            }} />
          )}
        </div>
      );
    }
  }

  // Координаты «креста» в процентах от размера доски (BOARD_SIZE=14, CORNER=3).
  // 3/14 = 21.4286%, 11/14 = 78.5714%. Используются для clip-path и SVG обводки.
  const c1 = (3 / BOARD_SIZE) * 100;
  const c2 = ((BOARD_SIZE - 3) / BOARD_SIZE) * 100;
  const crossPolygon = `polygon(
    ${c1}% 0%, ${c2}% 0%,
    ${c2}% ${c1}%, 100% ${c1}%,
    100% ${c2}%, ${c2}% ${c2}%,
    ${c2}% 100%, ${c1}% 100%,
    ${c1}% ${c2}%, 0% ${c2}%,
    0% ${c1}%, ${c1}% ${c1}%
  )`;

  return (
    <div style={{ width: '100%', maxWidth: 'min(96vw, 520px)', margin: '0 auto', position: 'relative' }}>
      {/* v58.14: оборачиваем сетку в крестообразную деревянную рамку.
          Раньше доска заканчивалась чёрной обводкой а углы экрана оставались белыми —
          теперь рамка повторяет форму поля как у 2P доски. */}
      <div style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.45))',
      }}>
        {/* Деревянный фон-рамка крестом */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.06) 0%, transparent 50%),
            linear-gradient(135deg, #7a5536 0%, #4a3220 38%, #5a3a25 68%, #2e1e12 100%)
          `,
          clipPath: crossPolygon,
          WebkitClipPath: crossPolygon,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        }} />

        {/* Сетка клеток — вложена внутрь рамки на 6px */}
        <div style={{
          position: 'absolute', inset: 6,
          display: 'grid',
          gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
          background: 'transparent',
          clipPath: crossPolygon,
          WebkitClipPath: crossPolygon,
        }}>
          {cells}
        </div>

        {/* SVG-обводка по внутреннему контуру креста (граница клеток / рамки) */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: 'absolute', inset: 6,
            width: 'calc(100% - 12px)', height: 'calc(100% - 12px)',
            pointerEvents: 'none',
          }}
        >
          <path
            d={`M ${c1},0 H ${c2} V ${c1} H 100 V ${c2} H ${c2} V 100 H ${c1} V ${c2} H 0 V ${c1} H ${c1} Z`}
            fill="none"
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Overlay — летящая фигура для плавного движения (inset 6 чтобы попадать в клетки) */}
      {moveAnim && (
        <div style={{
          position: 'absolute',
          inset: 6,
          pointerEvents: 'none',
          clipPath: crossPolygon,
          WebkitClipPath: crossPolygon,
        }}>
          <div style={{
            position: 'absolute',
            width: `${100/BOARD_SIZE}%`,
            height: `${100/BOARD_SIZE}%`,
            left: `${(moveAnim.phase === 'start' ? moveAnim.fromX : moveAnim.toX) * (100/BOARD_SIZE)}%`,
            top: `${(moveAnim.phase === 'start' ? moveAnim.fromY : moveAnim.toY) * (100/BOARD_SIZE)}%`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'min(3.5vw, 22px)',
            lineHeight: 1,
            color: COLOR_STYLES[moveAnim.color].fill,
            textShadow: `0 0 2px ${COLOR_STYLES[moveAnim.color].stroke}, 0 1px 2px rgba(0,0,0,0.4)`,
            transition: moveAnim.phase === 'end' ? 'left 280ms cubic-bezier(0.4,0,0.2,1), top 280ms cubic-bezier(0.4,0,0.2,1)' : 'none',
            zIndex: 5,
          }}>
            {moveAnim.glyph}
          </div>
        </div>
      )}

      {/* Промоция */}
      {promotionMove && myColor && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: 20,
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 'var(--fs-snap16)', color: 'var(--text)', textAlign: 'center' }}>Превращение пешки</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['Q', 'R', 'B', 'N'] as PieceType[]).map(p => (
                <button
                  key={p}
                  onClick={() => {
                    onMove(promotionMove.from, promotionMove.to, p);
                    setPromotionMove(null);
                    setSelected(null);
                  }}
                  style={{
                    width: 64, height: 64,
                    background: '#f0d9b5',
                    border: '2px solid var(--border)', borderRadius: 8,
                    cursor: 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}
                >
                  <ChessPieceSVG variant={pieceStyle}
                    symbol={p}
                    size={44}
                    fill={COLOR_STYLES[myColor].fill}
                    stroke={COLOR_STYLES[myColor].stroke}
                  />
                </button>
              ))}
            </div>
            <button
              onClick={() => { setPromotionMove(null); setSelected(null); }}
              style={{
                marginTop: 12, width: '100%', padding: 10,
                background: 'var(--surface-light)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text)', cursor: 'pointer',
              }}
            >Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}
