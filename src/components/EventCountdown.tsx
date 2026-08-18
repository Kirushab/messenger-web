import { useEffect, useState, useRef } from 'react';

interface Props {
  startAt: string;
  status: string;
}

/**
 * Countdown до начала события. Появляется когда осталось ≤ 24 часа.
 * Цифры переворачиваются при изменении — как табло аэропорта.
 */
export default function EventCountdown({ startAt, status }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (status === 'cancelled') return null;

  const startMs = new Date(startAt).getTime();
  const diffMs = startMs - now;

  // Показываем только если до начала <= 24ч и > 0
  if (diffMs <= 0 || diffMs > 24 * 3600 * 1000) return null;

  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return (
    <div style={{
      marginTop: 12, marginBottom: 12,
      padding: '14px 16px',
      background: 'var(--accent-soft)',
      border: 'none',
      borderRadius: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginRight: 6 }}>До начала</div>
      <FlipDigit value={hours} pad={2} />
      <Sep />
      <FlipDigit value={minutes} pad={2} />
      <Sep />
      <FlipDigit value={seconds} pad={2} />
    </div>
  );
}

function Sep() {
  return <span style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)', opacity: 0.5, lineHeight: 1 }}>:</span>;
}

function FlipDigit({ value, pad }: { value: number; pad: number }) {
  const str = String(value).padStart(pad, '0');
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {str.split('').map((ch, i) => <Digit key={i} char={ch} />)}
    </span>
  );
}

function Digit({ char }: { char: string }) {
  const [flipping, setFlipping] = useState(false);
  const prevRef = useRef(char);

  useEffect(() => {
    if (prevRef.current !== char) {
      setFlipping(true);
      const t = setTimeout(() => setFlipping(false), 600);
      prevRef.current = char;
      return () => clearTimeout(t);
    }
  }, [char]);

  return (
    <span
      className={`countdown-digit ${flipping ? 'countdown-digit-flip' : ''}`}
      style={{
        display: 'inline-block',
        minWidth: 18,
        textAlign: 'center',
        fontSize: 'var(--fs-title)',
        fontWeight: 700,
        color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}
    >
      {char}
    </span>
  );
}
