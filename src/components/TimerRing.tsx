interface Props {
  seconds: number;    // оставшееся время
  total: number;      // полная длительность
  size?: number;      // default 44
  strokeWidth?: number; // default 4
  warningAt?: number; // секунд осталось когда подсветить красным (default 10)
}

/**
 * Круговой таймер с заполнением и подсветкой.
 */
export default function TimerRing({
  seconds, total,
  size = 44,
  strokeWidth = 4,
  warningAt = 10,
}: Props) {
  const safeSeconds = Math.max(0, seconds);
  const safeTotal = Math.max(1, total);
  const progress = Math.min(1, safeSeconds / safeTotal);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const isWarning = safeSeconds <= warningAt && safeSeconds > 0;
  const ringColor = isWarning ? '#ef4444' : 'var(--accent)';

  // Форматирование mm:ss
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  const text = mins > 0
    ? `${mins}:${secs.toString().padStart(2, '0')}`
    : `${secs}`;

  return (
    <div
      style={{
        position: 'relative',
        width: size, height: size,
        flexShrink: 0,
        // Pulse при warning
        animation: isWarning ? 'pulse 0.9s ease-in-out infinite' : undefined,
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Фон-кольцо */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        {/* Прогресс */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: mins > 0 ? size * 0.28 : size * 0.36,
        fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: isWarning ? '#ef4444' : 'var(--text)',
      }}>
        {text}
      </div>
    </div>
  );
}
