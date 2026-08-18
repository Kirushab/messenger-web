import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReply: () => void;
  /** Сторона с которой будет показана стрелка-индикатор: 'left' (для своих, свайп влево) | 'right' (для чужих, свайп вправо) */
  side: 'left' | 'right';
  disabled?: boolean;
}

/**
 * Обёртка для строки сообщения. Свайп вправо (для чужих) или влево (для своих) >60px → trigger onReply.
 * Использует native non-passive touchmove чтобы preventDefault() реально работал и
 * вертикальный скролл не запускался во время горизонтального свайпа.
 */
export default function SwipeReplyRow({ children, onReply, side, disabled }: Props) {
  const [dragX, setDragX] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const lockRef = useRef<'h' | 'v' | null>(null);
  const triggeredRef = useRef(false);
  const dragXRef = useRef(0);

  const THRESHOLD = 60;
  const MAX = 90;
  const direction = side === 'left' ? -1 : 1;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (disabled) return;
      if (e.touches.length !== 1) return;
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      lockRef.current = null;
      triggeredRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startXRef.current === null || startYRef.current === null) return;
      const dx = e.touches[0].clientX - startXRef.current;
      const dy = e.touches[0].clientY - startYRef.current;

      if (lockRef.current === null) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
          if ((direction === 1 && dx > 0) || (direction === -1 && dx < 0)) {
            lockRef.current = 'h';
          } else {
            lockRef.current = 'v';
            return;
          }
        } else if (Math.abs(dy) > 6) {
          lockRef.current = 'v';
          return;
        } else {
          return;
        }
      }

      if (lockRef.current === 'h') {
        // КЛЮЧЕВАЯ СТРОКА: блокируем вертикальный скролл браузера во время горизонтального свайпа
        e.preventDefault();

        let clamped = direction === 1
          ? Math.max(0, Math.min(MAX, dx))
          : Math.min(0, Math.max(-MAX, dx));

        if (Math.abs(clamped) > THRESHOLD) {
          const excess = Math.abs(clamped) - THRESHOLD;
          clamped = direction * (THRESHOLD + excess * 0.4);
        }
        dragXRef.current = clamped;
        setDragX(clamped);

        if (!triggeredRef.current && Math.abs(clamped) >= THRESHOLD) {
          triggeredRef.current = true;
          if ('vibrate' in navigator) {
            try { navigator.vibrate(10); } catch {}
          }
        }
        if (triggeredRef.current && Math.abs(clamped) < THRESHOLD) {
          triggeredRef.current = false;
        }
      }
    };

    const onTouchEnd = () => {
      if (lockRef.current === 'h' && Math.abs(dragXRef.current) >= THRESHOLD) {
        onReply();
      }
      dragXRef.current = 0;
      setDragX(0);
      startXRef.current = null;
      startYRef.current = null;
      lockRef.current = null;
      triggeredRef.current = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [disabled, direction, onReply]);

  const showArrow = Math.abs(dragX) > 15;
  const armed = Math.abs(dragX) >= THRESHOLD;
  const arrowOpacity = Math.min(1, Math.abs(dragX) / THRESHOLD);
  const arrowScale = 0.7 + Math.min(1, Math.abs(dragX) / THRESHOLD) * 0.5;

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        transform: dragX !== 0 ? `translateX(${dragX}px)` : 'none',
        transition: dragX === 0 ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
      }}
    >
      {showArrow && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            [side === 'left' ? 'right' : 'left']: -50,
            transform: `translateY(-50%) scale(${arrowScale})`,
            opacity: arrowOpacity,
            width: 32, height: 32, borderRadius: 16,
            background: armed ? 'var(--accent)' : 'var(--surface-light)',
            border: '1px solid ' + (armed ? 'var(--accent)' : 'var(--border)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: armed ? '#fff' : 'var(--accent)',
            transition: 'background .15s ease, color .15s ease, border-color .15s ease',
            pointerEvents: 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
        </div>
      )}
      {children}
    </div>
  );
}
