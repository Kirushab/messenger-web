import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Bottom sheet с двумя позициями (half = ~55vh, full = ~92vh) + свайп вниз для закрытия.
 * Использование:
 *   <BottomSheet open onClose={close}>...</BottomSheet>
 *   <BottomSheet open onClose={close} initial="full">...</BottomSheet>
 */
export default function BottomSheet({
  open,
  onClose,
  children,
  initial = 'half',
  maxHeight,
  allowFullHeight = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 'half' (~55vh) или 'full' (~92vh). Default = 'half'. */
  initial?: 'half' | 'full';
  /** Опционально: вместо snap-points можно зафиксировать конкретную высоту. */
  maxHeight?: number | string;
  /** Разрешить ли растягивать sheet из half в full. */
  allowFullHeight?: boolean;
}) {
  // Текущее положение шита: half | full. dragY — оффсет при перетаскивании.
  const [snap, setSnap] = useState<'half' | 'full'>(initial);
  const [dragY, setDragY] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startYRef = useRef<number | null>(null);
  const startSnapRef = useRef<'half' | 'full'>(initial);

  // Сбрасываем позицию при каждом открытии
  useEffect(() => {
    if (open) {
      setSnap(initial);
      setDragY(0);
    }
  }, [open, initial]);

  if (!open) return null;

  const HALF_VH = 0.55;
  const FULL_VH = 0.96; // почти на весь экран — оставляет тонкую полоску для контекста
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const halfPx = winH * HALF_VH;
  const fullPx = winH * FULL_VH;

  // Текущая базовая высота шита
  const baseH = snap === 'half' ? halfPx : fullPx;
  // Финальная видимая высота с учётом drag
  const visibleH = Math.max(0, baseH - dragY);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    startYRef.current = e.touches[0].clientY;
    startSnapRef.current = snap;
    setAnimating(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    // Если уже на full и тянем вверх — игнор (выше нельзя)
    if (startSnapRef.current === 'full' && dy < 0) {
      setDragY(0);
      return;
    }
    // Если на half и тянем вверх — по умолчанию можно развернуть в full,
    // но для некоторых шитов (например, «План по дням») это отключено.
    if (allowFullHeight && startSnapRef.current === 'half' && dy < -50) {
      setSnap('full');
      startYRef.current = e.touches[0].clientY;
      setDragY(0);
      return;
    }
    // Иначе — обычное смещение вниз
    setDragY(Math.max(0, dy));
  };

  const onTouchEnd = () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    setAnimating(true);

    // Логика snap:
    // - если на full и тянули вниз больше 100px → переходим в half
    // - если на full и тянули вниз больше 300px → закрываем
    // - если на half и тянули вниз больше 100px → закрываем
    if (startSnapRef.current === 'full') {
      if (dragY > 300) {
        onClose();
        return;
      }
      if (dragY > 100) {
        setSnap('half');
        setDragY(0);
        setTimeout(() => setAnimating(false), 250);
        return;
      }
    } else {
      // half
      if (dragY > 100) {
        onClose();
        return;
      }
    }
    setDragY(0);
    setTimeout(() => setAnimating(false), 250);
  };

  const finalHeight = maxHeight !== undefined ? maxHeight : visibleH;
  const transition = animating ? 'height 220ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
  // В full-mode фон затемняем сильнее чтобы фоновый контент (cover события и т.п.) не отвлекал
  const baseOverlay = snap === 'full' ? 0.72 : 0.55;
  const overlayAlpha = Math.max(0.15, baseOverlay - dragY / 500);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: `rgba(0,0,0,${overlayAlpha})`,
        display: 'flex', alignItems: 'flex-end',
        transition: 'background 0.15s',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          height: finalHeight,
          background: 'var(--surface)',
          color: 'var(--text)',
          borderRadius: '18px 18px 0 0',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition,
        }}
      >
        {/* Drag handle (захват только за эту область) */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          style={{
            padding: '10px 0 6px',
            display: 'flex',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        {/* Скроллируемый контент */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch' as any,
          padding: '0 16px max(16px, env(safe-area-inset-bottom, 16px))',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
