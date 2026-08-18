import { useState, useEffect, useRef } from 'react';

interface Props {
  done: boolean;
  onToggle: () => void;
  size?: number; // default 20
  color?: string; // default #10B981
  disabled?: boolean;
}

export default function AnimatedCheckbox({
  done, onToggle,
  size = 20,
  color = 'var(--accent)',
  disabled,
}: Props) {
  const [animating, setAnimating] = useState(false);
  const prevDone = useRef(done);

  // Запускаем stroke анимацию когда переходим из false в true
  useEffect(() => {
    if (!prevDone.current && done) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 400);
      return () => clearTimeout(t);
    }
    prevDone.current = done;
  }, [done]);

  const handleClick = () => {
    if (disabled) return;
    // Haptic
    if ('vibrate' in navigator && !done) {
      try { navigator.vibrate(5); } catch {}
    }
    onToggle();
  };

  // Длина галочки приблизительно
  const strokeLen = 24;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      style={{
        width: size + 4,
        height: size + 4,
        borderRadius: (size + 4) / 2,
        flexShrink: 0,
        border: done ? 'none' : `2px solid var(--border)`,
        background: done ? color : 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background 200ms ease, border-color 200ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: done ? 'scale(1)' : 'scale(1)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {done && (
        <svg
          width={Math.round(size * 0.6)}
          height={Math.round(size * 0.6)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline
            points="20 6 9 17 4 12"
            style={{
              strokeDasharray: strokeLen,
              strokeDashoffset: animating ? strokeLen : 0,
              animation: animating ? `checkStroke 380ms cubic-bezier(0.16, 1, 0.3, 1) forwards` : 'none',
            }}
          />
        </svg>
      )}
    </button>
  );
}
