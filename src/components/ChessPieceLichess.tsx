// Рендерер шахматных фигур из наборов lichess.
// Источник: https://github.com/lichess-org/lila/tree/master/public/piece (GPL-3).
// Имена наборов соответствуют папкам в репозитории.
import type { CSSProperties } from 'react';

interface Props {
  symbol: string;       // 'P'|'N'|'B'|'R'|'Q'|'K' (заглавная = белая, строчная = чёрная)
  size?: number;
  set: string;          // имя набора lichess: 'staunty', 'cburnett', 'maestro' и т.д.
  style?: CSSProperties;
  className?: string;
}

/**
 * Доступные наборы lichess (все GPL-3, кроме отмеченных).
 * Намеренно подмножество — наборы, которые хорошо смотрятся на мобильном экране.
 */
export const LICHESS_PIECE_SETS = [
  { id: 'cburnett',  label: 'Cburnett',  hint: 'Базовый стандарт' },
  { id: 'staunty',   label: 'Staunty',   hint: 'Округлые, мультяшные' },
  { id: 'chessnut',  label: 'Chessnut',  hint: 'Минимализм' },
  { id: 'pixel',     label: 'Pixel',     hint: '8-битные пиксели' },
] as const;

export type LichessSetId = typeof LICHESS_PIECE_SETS[number]['id'];

export function pieceSrc(set: string, symbol: string): string {
  const isWhite = symbol === symbol.toUpperCase();
  const color = isWhite ? 'w' : 'b';
  const piece = symbol.toUpperCase();
  // Используем github raw — стабильный URL без хеша
  return `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/${set}/${color}${piece}.svg`;
}

export default function ChessPieceLichess({ symbol, size = 40, set, style, className }: Props) {
  return (
    <img
      src={pieceSrc(set, symbol)}
      width={size}
      height={size}
      alt={symbol}
      draggable={false}
      className={className}
      style={{
        display: 'block',
        maxWidth: '100%',
        maxHeight: '100%',
        pointerEvents: 'none',
        userSelect: 'none',
        // Лёгкая тень под фигурой (для контраста на любой доске)
        filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.25))',
        ...style,
      }}
    />
  );
}
