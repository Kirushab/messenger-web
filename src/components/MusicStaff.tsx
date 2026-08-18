import type { MusicNote, ClefType } from '@/lib/musicTheory';
import { NOTE_RU } from '@/lib/musicTheory';

interface Props {
  // Новый API: массив нот + индекс текущей
  notes?: MusicNote[];
  currentIndex?: number;
  // Маркеры пройденных нот: 'correct' | 'wrong' | null
  feedback?: Array<'correct' | 'wrong' | null>;
  // Legacy API: одиночная нота
  note?: MusicNote;
  showAnswer?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// Размеры
const SIZES = {
  small:  { lineGap: 8,  noteR: 5,  noteSlot: 26, padX: 36, height: 110 },
  medium: { lineGap: 12, noteR: 7,  noteSlot: 34, padX: 48, height: 150 },
  large:  { lineGap: 14, noteR: 8,  noteSlot: 32, padX: 56, height: 180 },
};

export default function MusicStaff({
  notes,
  currentIndex = 0,
  feedback,
  note,
  showAnswer = false,
  size = 'medium',
}: Props) {
  const { lineGap, noteR, noteSlot, padX, height } = SIZES[size];

  // Unify input
  const noteList: MusicNote[] = notes && notes.length ? notes : note ? [note] : [];
  if (!noteList.length) return null;

  // Ключ берём у ТЕКУЩЕЙ ноты — в режиме 'both' он меняется (скрипичный/басовый) пер-нота
  const clef: ClefType = noteList[currentIndex]?.clef || noteList[0].clef;
  const n = noteList.length;
  const width = padX + n * noteSlot + 16;
  const centerY = height / 2;
  const topLineY = centerY - 2 * lineGap;

  // staffPosition 0 = нижняя линия. Шаг = lineGap/2.
  const noteY = (sp: number) => (centerY + 2 * lineGap) - sp * (lineGap / 2);

  const COLOR_LINE = '#5a5a5a';
  const COLOR_NOTE = '#1a1a1a';
  const COLOR_CURRENT = '#6C5CE7';
  const COLOR_CORRECT = '#50c878';
  const COLOR_WRONG = '#dc2626';
  const COLOR_PAST = '#999';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', overflowX: 'auto' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* 5 линий стана */}
        {[0, 1, 2, 3, 4].map(i => (
          <line
            key={i}
            x1={8}
            y1={topLineY + i * lineGap}
            x2={width - 8}
            y2={topLineY + i * lineGap}
            stroke={COLOR_LINE}
            strokeWidth={1.2}
          />
        ))}

        {/* Ключ — точно якорится по нужной линии через dominant-baseline */}
        <Clef clef={clef} cx={padX * 0.5} centerY={centerY} lineGap={lineGap} />

        {/* Ноты */}
        {noteList.map((nn, i) => {
          const x = padX + i * noteSlot + noteSlot / 2;
          const y = noteY(nn.staffPosition);
          const fb = feedback?.[i] || null;
          let color = COLOR_NOTE;
          if (fb === 'correct') color = COLOR_CORRECT;
          else if (fb === 'wrong') color = COLOR_WRONG;
          else if (i < currentIndex) color = COLOR_PAST;
          else if (i === currentIndex) color = COLOR_CURRENT;
          else color = COLOR_PAST;

          const isFuture = i > currentIndex;
          const opacity = isFuture ? 0.35 : 1;

          return (
            <g key={i} opacity={opacity}>
              {/* Знак альтерации — слева от ноты, центр по noteY */}
              {nn.accidental && (
                <text
                  x={x - noteR * 2.2}
                  y={y}
                  fontSize={lineGap * 2.5}
                  fontWeight="bold"
                  fill={color}
                  fontFamily="'Times New Roman', serif"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ userSelect: 'none' }}
                >
                  {nn.accidental === 'sharp' ? '♯' : '♭'}
                </text>
              )}
              {/* Нота — эллипс */}
              <ellipse
                cx={x}
                cy={y}
                rx={noteR + 1}
                ry={noteR - 1}
                fill={color}
                transform={`rotate(-20 ${x} ${y})`}
              />
              {/* Штиль */}
              {nn.staffPosition <= 4 ? (
                <line x1={x + noteR} y1={y} x2={x + noteR} y2={y - lineGap * 3} stroke={color} strokeWidth={1.5} />
              ) : (
                <line x1={x - noteR} y1={y} x2={x - noteR} y2={y + lineGap * 3} stroke={color} strokeWidth={1.5} />
              )}
              {/* Индикатор текущей — треугольник сверху */}
              {i === currentIndex && (
                <polygon
                  points={`${x - 5},${topLineY - 10} ${x + 5},${topLineY - 10} ${x},${topLineY - 3}`}
                  fill={COLOR_CURRENT}
                />
              )}
            </g>
          );
        })}
      </svg>

      {showAnswer && noteList[currentIndex] && (
        <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600, color: 'var(--accent)' }}>
          {NOTE_RU[noteList[currentIndex].name]}
          {noteList[currentIndex].accidental === 'sharp' ? '♯' : noteList[currentIndex].accidental === 'flat' ? '♭' : ''}
          {noteList[currentIndex].octave}
        </div>
      )}
    </div>
  );
}

// Музыкальные ключи через Unicode (𝄞 / 𝄢) с точным якорем через dominant-baseline.
// Treble (G-clef): центр спирали = G4 = вторая линия снизу = centerY + lineGap.
// Bass (F-clef): центр между двумя точками = F3 = четвёртая линия снизу = centerY - lineGap.
function Clef({ clef, cx, centerY, lineGap }: { clef: ClefType; cx: number; centerY: number; lineGap: number }) {
  const fontFamily = "'Bravura', 'Petaluma', 'Apple Symbols', 'Segoe UI Symbol', 'Times New Roman', serif";
  if (clef === 'treble') {
    return (
      <text
        x={cx}
        y={centerY + lineGap}
        fontSize={lineGap * 6.5}
        fill="#1a1a1a"
        fontFamily={fontFamily}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ userSelect: 'none' }}
      >
        𝄞
      </text>
    );
  }
  // bass
  return (
    <text
      x={cx}
      y={centerY - lineGap}
      fontSize={lineGap * 4.2}
      fill="#1a1a1a"
      fontFamily={fontFamily}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ userSelect: 'none' }}
    >
      𝄢
    </text>
  );
}
