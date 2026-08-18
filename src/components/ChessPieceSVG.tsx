// Шахматные фигуры в стиле приложения — чистые SVG-силуэты.
// Заглавная буква = белая фигура, строчная = чёрная.
// Используется на доске вместо ♔♕♖♗♘♙.
import type { CSSProperties } from 'react';
import ChessPieceDuo from './ChessPieceDuo';
import ChessPieceLichess from './ChessPieceLichess';

type PieceSymbol = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

interface Props {
  symbol: PieceSymbol | string;
  size?: number;
  style?: CSSProperties;
  className?: string;
  /** Опционально: задать конкретный fill (для 4P-шахмат). */
  fill?: string;
  /** Опционально: задать конкретный stroke (для 4P-шахмат). */
  stroke?: string;
  /**
   * Стиль фигур:
   *  - 'classic' — встроенные Cburnett-like SVG
   *  - 'duo' — мои мультяшные с лицами
   *  - 'lichess:NAME' — открытый набор с lichess (staunty, maestro, alpha и др.)
   */
  variant?: string;
}

export default function ChessPieceSVG({ symbol, size = 40, style, className, fill: fillOverride, stroke: strokeOverride, variant = 'classic' }: Props) {
  // Lichess-набор — рендерим SVG-картинкой с github raw URL
  if (variant.startsWith('lichess:')) {
    const set = variant.slice('lichess:'.length);
    return <ChessPieceLichess symbol={symbol} size={size} set={set} style={style} className={className} />;
  }

  // Duo — мои фигуры с лицами
  if (variant === 'duo') {
    return <ChessPieceDuo symbol={symbol} size={size} style={style} className={className} />;
  }

  const isWhite = symbol === symbol.toUpperCase();
  const type = symbol.toUpperCase() as 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';

  // Цвета: белые — светлый fill + тёмный stroke, чёрные — тёмный fill + тёмный stroke
  const fill = fillOverride ?? (isWhite ? '#f4f4f4' : '#222');
  const stroke = strokeOverride ?? (isWhite ? '#1a1a1a' : '#000');
  const strokeWidth = 1.6;

  const common = {
    fill,
    stroke,
    strokeWidth,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 45 45"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))', maxWidth: '100%', maxHeight: '100%', ...style }}
      className={className}
    >
      {type === 'P' && <Pawn {...common} />}
      {type === 'N' && <Knight {...common} isLightFill={isLightColor(fill)} />}
      {type === 'B' && <Bishop {...common} />}
      {type === 'R' && <Rook {...common} />}
      {type === 'Q' && <Queen {...common} />}
      {type === 'K' && <King {...common} />}
    </svg>
  );
}

// Простая эвристика: светлый ли цвет (по сумме RGB)
function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r + g + b) / 3 > 140;
}

interface ShapeProps {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeLinejoin: 'round';
  strokeLinecap: 'round';
}

function Pawn(p: ShapeProps) {
  return (
    <g {...p}>
      {/* Голова */}
      <circle cx="22.5" cy="10.5" r="4.5" />
      {/* Шея */}
      <path d="M19 14.5 Q22.5 17 26 14.5 L26 17 Q22.5 18.5 19 17 Z" />
      {/* Корпус — расширяющийся к основанию */}
      <path d="M17 18 L28 18 L31 30 L14 30 Z" />
      {/* База */}
      <path d="M12 30 L33 30 L34.5 36 L10.5 36 Z" />
      {/* Нижний step */}
      <path d="M10 36 L35 36 L36 39.5 L9 39.5 Z" />
    </g>
  );
}

function Knight(p: ShapeProps & { isLightFill: boolean }) {
  const eyeColor = p.isLightFill ? '#1a1a1a' : '#fff';
  return (
    <g>
      {/* Классический Cburnett knight: профильный конь смотрит ВПРАВО,
          скульптурная шея, плавная грива, чёткая голова. Читается на любом
          размере от 24px до 200px. */}
      <path
        d="M 22 10 C 32.5 11, 38.5 18, 38 39 L 15 39 C 15 30, 25 32.5, 23 18"
        fill={p.fill}
        stroke={p.stroke}
        strokeWidth={p.strokeWidth}
        strokeLinejoin="round"
      />
      <path
        d="M 24 18 C 24.38 20.91, 18.45 25.37, 16 27 C 13 29, 13.18 31.34, 11 31
           C 9.958 30.06, 12.41 27.96, 11 28 C 10 28, 11.19 29.23, 10 30
           C 9 30, 5.997 31, 6 26 C 6 24, 12 14, 12 14 C 12 14, 13.89 12.1, 14 10.5
           C 13.27 9.506, 13.5 8.5, 13.5 7.5 C 14.5 5.5, 16.5 4, 16.5 4
           C 18 4, 17.95 5.7, 18.5 5.5 C 19.49 5.099, 19.51 4.4, 20.5 4
           C 22 4, 22 5, 22.5 5 C 23.5 5, 24.5 4, 24.5 4 Z"
        fill={p.fill}
        stroke={p.stroke}
        strokeWidth={p.strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Глаз */}
      <ellipse
        cx="9.5"
        cy="25.5"
        rx="0.5"
        ry="0.5"
        fill={eyeColor}
        stroke={eyeColor}
        strokeWidth={1.5}
      />
      {/* Грива - акцент */}
      <ellipse
        cx="15"
        cy="15.5"
        rx="0.5"
        ry="1.5"
        transform="rotate(30, 15, 15.5)"
        fill={eyeColor}
        stroke={eyeColor}
        strokeWidth={1.5}
      />
      {/* Подставка */}
      <path
        d="M 9 39.5 L 38 39.5 L 38.5 41.5 L 8.5 41.5 Z"
        fill={p.fill}
        stroke={p.stroke}
        strokeWidth={p.strokeWidth}
        strokeLinejoin="round"
      />
    </g>
  );
}

function Bishop(p: ShapeProps) {
  return (
    <g {...p}>
      {/* Шарик сверху */}
      <circle cx="22.5" cy="7" r="2.4" />
      {/* Митра */}
      <path d="M22.5 9.4 C 28 11, 30 16, 30 22 C 30 26, 27 28, 22.5 28 C 18 28, 15 26, 15 22 C 15 16, 17 11, 22.5 9.4 Z" />
      {/* Косая прорезь митры */}
      <path
        d="M18 19 L 27 14"
        fill="none"
        stroke={p.stroke}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {/* Воротник */}
      <path d="M14 28 L31 28 L32 31 L13 31 Z" />
      {/* База */}
      <path d="M12 31 L33 31 L34.5 36 L10.5 36 Z" />
      <path d="M9 36 L36 36 L36 39.5 L9 39.5 Z" />
    </g>
  );
}

function Rook(p: ShapeProps) {
  return (
    <g {...p}>
      {/* Зубцы крепости */}
      <rect x="11" y="8" width="5" height="5" />
      <rect x="20" y="8" width="5" height="5" />
      <rect x="29" y="8" width="5" height="5" />
      {/* Перекладина */}
      <rect x="10" y="13" width="25" height="3" />
      {/* Корпус */}
      <path d="M12 16 L33 16 L31 30 L14 30 Z" />
      {/* Поясок */}
      <rect x="11" y="30" width="23" height="3" />
      {/* База */}
      <path d="M10 33 L35 33 L36 39.5 L9 39.5 Z" />
    </g>
  );
}

function Queen(p: ShapeProps) {
  return (
    <g {...p}>
      {/* 5 шпилей короны с шариками на концах */}
      <circle cx="9" cy="8" r="1.8" />
      <circle cx="15.75" cy="6.5" r="1.8" />
      <circle cx="22.5" cy="5.5" r="1.8" />
      <circle cx="29.25" cy="6.5" r="1.8" />
      <circle cx="36" cy="8" r="1.8" />
      {/* Зигзаг короны */}
      <path d="M9 9 L13 17 L15.75 8 L19.5 17 L22.5 7 L25.5 17 L29.25 8 L32 17 L36 9 L34 22 L11 22 L9 9 Z" />
      {/* Корпус */}
      <path d="M11 22 L34 22 L31 30 L14 30 Z" />
      {/* Поясок */}
      <rect x="11" y="30" width="23" height="3" />
      {/* База */}
      <path d="M10 33 L35 33 L36 39.5 L9 39.5 Z" />
    </g>
  );
}

function King(p: ShapeProps) {
  return (
    <g {...p}>
      {/* Крест сверху */}
      <rect x="21" y="2.5" width="3" height="9" />
      <rect x="18" y="5.5" width="9" height="3" />
      {/* Корона — зубцы */}
      <path d="M11 18 L14 12 L17 18 L22.5 11 L28 18 L31 12 L34 18 L34 22 L11 22 Z" />
      {/* Корпус */}
      <path d="M11 22 L34 22 L31 30 L14 30 Z" />
      {/* Поясок */}
      <rect x="11" y="30" width="23" height="3" />
      {/* База */}
      <path d="M10 33 L35 33 L36 39.5 L9 39.5 Z" />
    </g>
  );
}

// Юникод-фоллбэк для мест где нужна строка (например, текстовые превью)
export const PIECE_UNICODE: Record<string, string> = {
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔',
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};
