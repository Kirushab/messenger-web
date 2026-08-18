import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  duration?: number;     // ms (default 700)
  format?: (n: number) => string; // как форматировать (default toLocaleString)
  style?: React.CSSProperties;
  className?: string;
}

export default function AnimatedNumber({
  value, duration = 700,
  format = (n) => n.toLocaleString('ru'),
  style,
  className,
}: Props) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      prevRef.current = to;
    };
  }, [value, duration]);

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', ...style }} className={className}>
      {format(display)}
    </span>
  );
}
