import { NOTE_NAMES, NOTE_RU, type NoteName } from '@/lib/musicTheory';

interface Props {
  notation: 'ru' | 'en' | 'both';
  selectedAnswer: string | null;
  correctAnswer: string | null;  // canonical, показывается после feedback
  feedback: 'correct' | 'wrong' | null;
  onAnswer: (answer: string) => void;
  disabled?: boolean;
  /** Компактный режим — когда снизу показано пианино, чтобы не было overlap */
  compact?: boolean;
}

export default function CircleAnswerWheel({ notation, selectedAnswer, correctAnswer, feedback, onAnswer, disabled, compact }: Props) {
  const WHEEL_SIZE = compact ? 196 : 240;
  const BTN_SIZE = compact ? 50 : 60;
  const RADIUS = compact ? 73 : 92;
  const cx = WHEEL_SIZE / 2;
  const cy = WHEEL_SIZE / 2;

  // Координаты центров кнопок
  const positions = NOTE_NAMES.map((_, i) => {
    const angle = (i / NOTE_NAMES.length) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + RADIUS * Math.cos(angle),
      y: cy + RADIUS * Math.sin(angle),
    };
  });

  return (
    <div style={{ position: 'relative', width: WHEEL_SIZE, height: WHEEL_SIZE, margin: '0 auto' }}>
      {/* SVG-линии между соседними кнопками — спицы как в референсе */}
      <svg width={WHEEL_SIZE} height={WHEEL_SIZE} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {positions.map((p, i) => {
          const next = positions[(i + 1) % positions.length];
          return (
            <line
              key={i}
              x1={p.x} y1={p.y}
              x2={next.x} y2={next.y}
              stroke="var(--border)"
              strokeWidth={1.2}
              strokeDasharray="3 4"
            />
          );
        })}
      </svg>

      {NOTE_NAMES.map((name, i) => {
        const { x, y } = positions[i];
        const isSelected = selectedAnswer === name;
        const isCorrect = correctAnswer === name;

        let bg = 'var(--surface-light)';
        let color = 'var(--text)';
        let border = '1.5px solid var(--border)';
        let scale = 1;
        if (feedback) {
          if (isCorrect) { bg = '#50c878'; color = '#fff'; border = '1.5px solid #50c878'; scale = isSelected ? 1.05 : 1; }
          else if (isSelected) { bg = '#dc2626'; color = '#fff'; border = '1.5px solid #dc2626'; }
        }

        const label: any = notation === 'ru' ? NOTE_RU[name as NoteName] :
                       notation === 'en' ? name :
                       (<span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
                         <span style={{ fontSize: 'var(--fs-snap14)' }}>{NOTE_RU[name as NoteName]}</span>
                         <span style={{ fontSize: 9, opacity: 0.7 }}>{name}</span>
                       </span>);

        return (
          <button
            key={name}
            onClick={() => !disabled && onAnswer(name)}
            disabled={disabled}
            className={`tap-effect ${feedback === 'wrong' && isSelected ? 'anim-shake' : ''}`}
            style={{
              position: 'absolute',
              left: x - BTN_SIZE / 2,
              top: y - BTN_SIZE / 2,
              width: BTN_SIZE,
              height: BTN_SIZE,
              borderRadius: BTN_SIZE / 2,
              background: bg,
              color,
              border,
              fontSize: 'var(--fs-snap16)',
              fontWeight: 700,
              cursor: disabled ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: isSelected ? '0 4px 16px rgba(108, 92, 231, 0.35)' : '0 2px 6px rgba(0,0,0,0.08)',
              transform: `scale(${scale})`,
              zIndex: isSelected || isCorrect ? 2 : 1,
            }}
          >
            {label}
          </button>
        );
      })}

      {/* Центр — подсказка-иконка */}
      <div style={{
        position: 'absolute',
        left: cx - 16,
        top: cy - 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        background: 'var(--surface-light)',
        border: '1.5px dashed var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted)',
        fontSize: 'var(--fs-snap14)',
        fontWeight: 700,
        pointerEvents: 'none',
      }}>?</div>
    </div>
  );
}
