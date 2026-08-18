import { useRef, useState, useEffect, type CSSProperties } from 'react';

interface Props {
  src: string;
  alt?: string;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  style?: CSSProperties;
}

/**
 * Картинка с Telegram-стиль поведением:
 *   • Двойной тап — зум 2× / возврат к 1×
 *   • Pinch двумя пальцами — плавный зум
 *   • Pan одним пальцем когда zoom > 1
 *   • Одиночный тап — НЕ закрывает (закрытие только кнопкой ✕ или свайпом)
 *   • Vertical swipe вниз/вверх — закрытие
 *   • Horizontal swipe вправо/влево — навигация по media-галерее
 */
export default function ZoomableImage({ src, alt = '', onClose, onPrev, onNext, style }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [animating, setAnimating] = useState(false);
  // Drag-to-dismiss state — отслеживаем вертикальное смещение во время свайпа
  const [dismissDy, setDismissDy] = useState(0);

  const gesture = useRef<{
    mode: 'none' | 'pan' | 'pinch' | 'dismiss-or-nav';
    startDist: number;
    startScale: number;
    startTx: number;
    startTy: number;
    startX: number;
    startY: number;
    midX: number;
    midY: number;
    // Для drag-to-dismiss / horizontal swipe — отслеживаем как разрешилось движение
    decided: 'h' | 'v' | null;
  }>({ mode: 'none', startDist: 0, startScale: 1, startTx: 0, startTy: 0, startX: 0, startY: 0, midX: 0, midY: 0, decided: null });

  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  const dist = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  useEffect(() => {
    setScale(1); setTx(0); setTy(0); setAnimating(false); setDismissDy(0);
  }, [src]);

  const clamp = (s: number, x: number, y: number) => {
    const el = wrapRef.current;
    if (!el) return { x, y };
    const w = el.clientWidth;
    const h = el.clientHeight;
    const maxX = (w * (s - 1)) / 2;
    const maxY = (h * (s - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const touches = e.touches;
    if (touches.length === 2) {
      gesture.current.mode = 'pinch';
      gesture.current.startDist = dist(touches[0], touches[1]);
      gesture.current.startScale = scale;
      gesture.current.midX = (touches[0].clientX + touches[1].clientX) / 2;
      gesture.current.midY = (touches[0].clientY + touches[1].clientY) / 2;
      gesture.current.startTx = tx;
      gesture.current.startTy = ty;
    } else if (touches.length === 1) {
      // При zoom > 1 — pan по изображению. При zoom = 1 — может быть свайп для
      // навигации/закрытия, решение принимаем по направлению первого движения.
      gesture.current.mode = scale > 1 ? 'pan' : 'dismiss-or-nav';
      gesture.current.startX = touches[0].clientX;
      gesture.current.startY = touches[0].clientY;
      gesture.current.startTx = tx;
      gesture.current.startTy = ty;
      gesture.current.decided = null;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (gesture.current.mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const d = dist(e.touches[0], e.touches[1]);
      const next = Math.max(1, Math.min(4, gesture.current.startScale * (d / gesture.current.startDist)));
      setScale(next);
      const c = clamp(next, gesture.current.startTx, gesture.current.startTy);
      setTx(c.x); setTy(c.y);
    } else if (gesture.current.mode === 'pan' && e.touches.length === 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - gesture.current.startX;
      const dy = e.touches[0].clientY - gesture.current.startY;
      const c = clamp(scale, gesture.current.startTx + dx, gesture.current.startTy + dy);
      setTx(c.x); setTy(c.y);
    } else if (gesture.current.mode === 'dismiss-or-nav' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - gesture.current.startX;
      const dy = e.touches[0].clientY - gesture.current.startY;
      // Определяем направление при первом значимом движении
      if (gesture.current.decided === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        gesture.current.decided = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h';
      }
      if (gesture.current.decided === 'v') {
        // Vertical drag — picture следует за пальцем (drag-to-dismiss visual)
        e.preventDefault();
        setDismissDy(dy);
      } else if (gesture.current.decided === 'h') {
        // Horizontal — для swipe to next/prev. Тоже двигаем для feedback.
        e.preventDefault();
        setTx(dx);
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const prevMode = gesture.current.mode;
    const decided = gesture.current.decided;
    gesture.current.mode = 'none';

    if (scale < 1.05) {
      setAnimating(true);
      setScale(1); setTx(0); setTy(0);
      setTimeout(() => setAnimating(false), 220);
    }

    // Двойной тап для zoom in/out — только если режим был dismiss-or-nav и не было движения
    if (e.changedTouches.length === 1 && e.touches.length === 0 && prevMode === 'dismiss-or-nav' && decided === null) {
      const t = e.changedTouches[0];
      const now = Date.now();
      const since = now - lastTapRef.current.time;
      const dx = Math.abs(t.clientX - lastTapRef.current.x);
      const dy = Math.abs(t.clientY - lastTapRef.current.y);
      if (since < 300 && dx < 30 && dy < 30) {
        // Double tap → zoom toggle
        setAnimating(true);
        if (scale > 1) { setScale(1); setTx(0); setTy(0); }
        else { setScale(2); }
        setTimeout(() => setAnimating(false), 220);
        lastTapRef.current = { time: 0, x: 0, y: 0 };
      } else {
        lastTapRef.current = { time: now, x: t.clientX, y: t.clientY };
        // Single tap — НИЧЕГО не делаем (Telegram-стиль). Закрытие только × или свайп.
      }
    }

    // Drag-to-dismiss / nav обработка
    if (prevMode === 'dismiss-or-nav' && decided === 'v') {
      if (Math.abs(dismissDy) > 100 && onClose) {
        onClose();
      } else {
        // Snap back
        setAnimating(true);
        setDismissDy(0);
        setTimeout(() => setAnimating(false), 220);
      }
    } else if (prevMode === 'dismiss-or-nav' && decided === 'h') {
      const finalTx = tx; // Уже накопленный
      if (Math.abs(finalTx) > 80) {
        if (finalTx < 0 && onNext) {
          onNext();
        } else if (finalTx > 0 && onPrev) {
          onPrev();
        } else {
          // Нет соседнего — snap back
          setAnimating(true);
          setTx(0);
          setTimeout(() => setAnimating(false), 220);
        }
      } else {
        setAnimating(true);
        setTx(0);
        setTimeout(() => setAnimating(false), 220);
      }
    }
  };

  // Затемнение фона зависит от вертикального drag — Telegram-style
  const dismissProgress = Math.min(1, Math.abs(dismissDy) / 300);
  const bgOpacity = 1 - dismissProgress * 0.7;

  return (
    <div
      ref={wrapRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={() => {
        setAnimating(true);
        if (scale > 1) { setScale(1); setTx(0); setTy(0); }
        else { setScale(2); }
        setTimeout(() => setAnimating(false), 220);
      }}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', touchAction: 'none',
        cursor: scale > 1 ? 'grab' : 'default',
        background: `rgba(0,0,0,${bgOpacity})`,
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          transform: `translate(${tx}px, ${ty + dismissDy}px) scale(${scale * (1 - dismissProgress * 0.15)})`,
          transformOrigin: 'center center',
          transition: animating ? 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          willChange: 'transform',
        }}
      />
    </div>
  );
}
