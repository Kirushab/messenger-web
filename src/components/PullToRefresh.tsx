import { useState, useRef, type ReactNode, type CSSProperties, type UIEventHandler } from 'react';

interface Props {
  onRefresh: () => Promise<any> | any;
  children: ReactNode;
  threshold?: number; // px до триггера, по умолчанию 70
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
  onScroll?: UIEventHandler<HTMLDivElement>;
}

export default function PullToRefresh({
  onRefresh, children, threshold = 70, disabled, style, className, onScroll,
}: Props) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [animating, setAnimating] = useState(false);
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  // Блокировка направления: 'v' = тянем вниз, 'h' = горизонтальный жест (не наша работа)
  const lockRef = useRef<'v' | 'h' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    lockRef.current = null;
    setAnimating(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || refreshing || disabled) return;
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop > 0) {
      startY.current = null;
      startX.current = null;
      lockRef.current = null;
      setPull(0);
      return;
    }
    const dy = e.touches[0].clientY - startY.current;
    const dx = startX.current !== null ? e.touches[0].clientX - startX.current : 0;

    // Определяем направление при первом значимом движении
    if (lockRef.current === null) {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax < 6 && ay < 6) return; // ещё не понятно
      if (ax > ay) {
        // Горизонтальный жест — пусть его обрабатывает другой компонент (swipe-to-delete и т.п.)
        lockRef.current = 'h';
        return;
      }
      lockRef.current = 'v';
    }

    if (lockRef.current !== 'v') return;

    if (dy > 0) {
      const dampened = Math.min(dy * 0.55, threshold * 1.6);
      setPull(dampened);
    } else {
      setPull(0);
    }
  };

  const handleTouchEnd = async () => {
    if (startY.current === null) {
      if (pull > 0) {
        setAnimating(true);
        setPull(0);
      }
      return;
    }
    const wasVertical = lockRef.current === 'v';
    startY.current = null;
    startX.current = null;
    lockRef.current = null;
    if (!wasVertical) {
      // Был горизонтальный жест — ничего не делаем
      if (pull > 0) {
        setAnimating(true);
        setPull(0);
      }
      return;
    }
    if (pull >= threshold && !refreshing) {
      setRefreshing(true);
      setAnimating(true);
      setPull(threshold);
      try {
        await onRefresh();
      } catch (e) {
        console.warn('PullToRefresh refresh error:', e);
      } finally {
        setRefreshing(false);
        setPull(0);
        setTimeout(() => setAnimating(false), 250);
      }
    } else {
      setAnimating(true);
      setPull(0);
      setTimeout(() => setAnimating(false), 250);
    }
  };

  // Прогресс для индикатора (0..1+)
  const progress = Math.min(pull / threshold, 1);
  const opacity = Math.min(pull / 30, 1);

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onScroll={onScroll}
      style={{
        height: '100%',
        overflowY: 'auto',
        position: 'relative',
        WebkitOverflowScrolling: 'touch' as any,
        ...style,
      }}
    >
      {/* Индикатор сверху — sticky чтобы был всегда виден когда скроллим вниз */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          marginTop: 8,
          opacity,
          transform: `translateY(${refreshing ? threshold - 14 : Math.max(pull - 30, -30)}px)`,
          transition: animating ? 'transform 220ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease' : 'none',
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--surface-light)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--fs-snap16)',
          color: 'var(--text)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {refreshing ? (
            <span className="anim-spin" style={{ display: 'inline-block' }}>↻</span>
          ) : (
            <span style={{
              transform: `rotate(${progress * 270}deg)`,
              transition: animating ? 'transform 200ms ease' : 'none',
              display: 'inline-block',
              opacity: progress > 0.95 ? 1 : 0.6,
            }}>↓</span>
          )}
        </div>
      </div>

      {/* Контент — слегка смещаем при тяге */}
      <div style={{
        transform: `translateY(${pull}px)`,
        transition: animating ? 'transform 220ms cubic-bezier(0.16,1,0.3,1)' : 'none',
      }}>
        {children}
      </div>
    </div>
  );
}
