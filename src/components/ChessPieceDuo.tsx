// Шахматные фигуры в мультяшно-объёмном стиле: с лицами (глазки, рот) у фигур,
// двухцветной заливкой для эффекта объёма, изометрической позой.
// Используется когда у игры выставлен piece_style='duo'.
import type { CSSProperties } from 'react';

type PieceSymbol = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

interface Props {
  symbol: PieceSymbol | string;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

export default function ChessPieceDuo({ symbol, size = 40, style, className }: Props) {
  const isWhite = symbol === symbol.toUpperCase();
  const type = symbol.toUpperCase() as 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';

  const palette = isWhite
    ? { main: '#E8EAED', side: '#B0B5BB', edge: '#7E8389', detail: '#3D4145', face: '#1F2326' }
    : { main: '#3F4548', side: '#252A2D', edge: '#10131A', detail: '#0A0C0F', face: '#E0E2E4' };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.35))', maxWidth: '100%', maxHeight: '100%', ...style }}
      className={className}
    >
      {type === 'P' && <Pawn p={palette} />}
      {type === 'N' && <Knight p={palette} />}
      {type === 'B' && <Bishop p={palette} />}
      {type === 'R' && <Rook p={palette} />}
      {type === 'Q' && <Queen p={palette} />}
      {type === 'K' && <King p={palette} />}
    </svg>
  );
}

interface Pal { main: string; side: string; edge: string; detail: string; face: string }

function Base({ p }: { p: Pal }) {
  return (
    <g>
      <ellipse cx="50" cy="93" rx="29" ry="3" fill="#000" opacity={0.22}/>
      <ellipse cx="50" cy="86" rx="30" ry="7" fill={p.side}/>
      <ellipse cx="50" cy="84" rx="30" ry="7" fill={p.main}/>
      <ellipse cx="50" cy="76" rx="24" ry="5" fill={p.side}/>
      <ellipse cx="50" cy="74" rx="24" ry="5" fill={p.main}/>
    </g>
  );
}

function Face({ cx, cy, scale = 1, p }: { cx: number; cy: number; scale?: number; p: Pal }) {
  const eyeR = 1.6 * scale;
  const eyeOff = 3.5 * scale;
  return (
    <g>
      <circle cx={cx - eyeOff} cy={cy} r={eyeR} fill={p.face}/>
      <circle cx={cx + eyeOff} cy={cy} r={eyeR} fill={p.face}/>
      <path
        d={`M ${cx - 3 * scale} ${cy + 3 * scale} Q ${cx} ${cy + 5 * scale} ${cx + 3 * scale} ${cy + 3 * scale}`}
        fill="none" stroke={p.face} strokeWidth={1.4 * scale} strokeLinecap="round"
      />
    </g>
  );
}

function Pawn({ p }: { p: Pal }) {
  return (
    <g>
      <Base p={p}/>
      <path d="M40 74 L36 56 L64 56 L60 74 Z" fill={p.side}/>
      <path d="M40 74 L36 56 L50 56 L50 74 Z" fill={p.main}/>
      <ellipse cx="50" cy="48" rx="18" ry="9" fill={p.side}/>
      <ellipse cx="50" cy="47" rx="18" ry="9" fill={p.main}/>
      <circle cx="50" cy="29" r="18" fill={p.side}/>
      <path d="M50 11 A 18 18 0 0 0 32 29 A 18 18 0 0 0 50 47 Z" fill={p.main}/>
      <Face cx={50} cy={29} p={p}/>
      <ellipse cx="42" cy="20" rx="5" ry="3" fill="#fff" opacity={0.35}/>
    </g>
  );
}

function Rook({ p }: { p: Pal }) {
  return (
    <g>
      <Base p={p}/>
      <path d="M28 74 L32 30 L68 30 L72 74 Z" fill={p.side}/>
      <path d="M28 74 L32 30 L50 30 L50 74 Z" fill={p.main}/>
      <ellipse cx="50" cy="30" rx="20" ry="4" fill={p.side}/>
      <ellipse cx="50" cy="28" rx="20" ry="4" fill={p.main}/>
      <rect x="28" y="14" width="9" height="16" fill={p.side}/>
      <rect x="28" y="14" width="5" height="16" fill={p.main}/>
      <rect x="46" y="14" width="9" height="16" fill={p.side}/>
      <rect x="46" y="14" width="5" height="16" fill={p.main}/>
      <rect x="64" y="14" width="9" height="16" fill={p.side}/>
      <rect x="64" y="14" width="5" height="16" fill={p.main}/>
      <ellipse cx="50" cy="14" rx="15" ry="3" fill={p.edge} opacity={0.55}/>
      <Face cx={50} cy={50} p={p}/>
    </g>
  );
}

function Knight({ p }: { p: Pal }) {
  return (
    <g>
      <Base p={p}/>
      <path d="M28 74 Q22 56 36 46 Q40 32 54 24 Q70 18 80 30 Q84 50 70 60 Q66 70 72 74 Z" fill={p.side}/>
      <path d="M28 74 Q22 56 36 46 Q40 32 54 24 Q62 20 67 26 Q60 38 52 48 Q50 60 50 74 Z" fill={p.main}/>
      <path d="M44 36 Q46 24 60 18 Q72 14 78 20 Q72 28 64 32 Q56 38 50 40 Z" fill={p.side}/>
      <path d="M44 36 Q46 24 60 18 Q66 16 69 19 Q60 28 54 32 Q50 38 50 40 Z" fill={p.main}/>
      <path d="M64 24 Q76 22 82 30 Q80 38 70 38 Q64 36 64 30 Z" fill={p.main}/>
      <path d="M58 12 L64 22 L52 22 Z" fill={p.side}/>
      <path d="M58 12 L62 22 L54 22 Z" fill={p.main}/>
      <path d="M48 28 Q42 18 36 12 Q38 22 36 30 Z" fill={p.edge} opacity={0.55}/>
      <circle cx="70" cy="28" r="2.4" fill={p.face}/>
      <circle cx="70.5" cy="27.5" r="0.9" fill="#fff" opacity={0.8}/>
      <ellipse cx="78" cy="33" rx="1.2" ry="0.8" fill={p.face} opacity={0.7}/>
      <path d="M74 36 Q78 38 82 36" stroke={p.face} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.7}/>
    </g>
  );
}

function Bishop({ p }: { p: Pal }) {
  return (
    <g>
      <Base p={p}/>
      <path d="M30 74 Q22 56 34 44 Q42 38 50 38 Q58 38 66 44 Q78 56 70 74 Z" fill={p.side}/>
      <path d="M30 74 Q22 56 34 44 Q42 38 50 38 L50 74 Z" fill={p.main}/>
      <ellipse cx="50" cy="40" rx="20" ry="3.5" fill={p.edge} opacity={0.4}/>
      <path d="M38 40 Q38 22 50 8 Q62 22 62 40 Z" fill={p.side}/>
      <path d="M38 40 Q38 22 50 8 L50 40 Z" fill={p.main}/>
      <path d="M44 22 Q50 18 56 22" stroke={p.edge} strokeWidth={2.2} fill="none" strokeLinecap="round"/>
      <line x1="50" y1="14" x2="50" y2="34" stroke={p.edge} strokeWidth={2.2} strokeLinecap="round"/>
      <circle cx="50" cy="6" r="3.5" fill={p.side}/>
      <circle cx="50" cy="6" r="3" fill={p.main}/>
      <Face cx={50} cy={56} scale={0.9} p={p}/>
    </g>
  );
}

function Queen({ p }: { p: Pal }) {
  return (
    <g>
      <Base p={p}/>
      <path d="M26 74 Q22 56 36 46 Q44 40 50 40 Q56 40 64 46 Q78 56 74 74 Z" fill={p.side}/>
      <path d="M26 74 Q22 56 36 46 Q44 40 50 40 L50 74 Z" fill={p.main}/>
      <ellipse cx="50" cy="42" rx="22" ry="4.5" fill={p.side}/>
      <ellipse cx="50" cy="40" rx="22" ry="4.5" fill={p.main}/>
      <path d="M28 40 L32 16 L40 30 L46 10 L50 28 L54 10 L60 30 L68 16 L72 40 Z" fill={p.side}/>
      <path d="M28 40 L32 16 L40 30 L46 10 L50 28 L50 40 Z" fill={p.main}/>
      <circle cx="32" cy="16" r="3.5" fill={p.side}/><circle cx="32" cy="16" r="3" fill={p.main}/>
      <circle cx="46" cy="10" r="3.5" fill={p.side}/><circle cx="46" cy="10" r="3" fill={p.main}/>
      <circle cx="50" cy="28" r="3.5" fill={p.side}/><circle cx="50" cy="28" r="3" fill={p.main}/>
      <circle cx="54" cy="10" r="3.5" fill={p.side}/><circle cx="54" cy="10" r="3" fill={p.main}/>
      <circle cx="68" cy="16" r="3.5" fill={p.side}/><circle cx="68" cy="16" r="3" fill={p.main}/>
      <Face cx={50} cy={55} p={p}/>
    </g>
  );
}

function King({ p }: { p: Pal }) {
  return (
    <g>
      <Base p={p}/>
      <path d="M26 74 Q22 56 36 46 Q44 40 50 40 Q56 40 64 46 Q78 56 74 74 Z" fill={p.side}/>
      <path d="M26 74 Q22 56 36 46 Q44 40 50 40 L50 74 Z" fill={p.main}/>
      <path d="M32 42 L36 22 L64 22 L68 42 Z" fill={p.side}/>
      <path d="M32 42 L36 22 L50 22 L50 42 Z" fill={p.main}/>
      <rect x="30" y="36" width="40" height="5" rx="1" fill={p.edge} opacity={0.4}/>
      <circle cx="50" cy="32" r="3.5" fill={p.edge} opacity={0.5}/>
      <rect x="46" y="2" width="8" height="20" rx="1.5" fill={p.side}/>
      <rect x="46" y="2" width="4" height="20" rx="1.5" fill={p.main}/>
      <rect x="38" y="8" width="24" height="6" rx="1.5" fill={p.side}/>
      <rect x="38" y="8" width="14" height="6" rx="1.5" fill={p.main}/>
      <Face cx={50} cy={55} p={p}/>
    </g>
  );
}
