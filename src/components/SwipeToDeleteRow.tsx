import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onDelete: () => void;
  onSwipeRight?: () => void;   // свайп ВПРАВО (например, «прочитано»); если не задан — правый свайп выключен
  disabled?: boolean;
  className?: string;
}

/**
 * Свайп строки чата:
 * ВЛЕВО:
 * - <80px — пружинит назад
 * - 80-200px — фиксируется с открытой кнопкой "Удалить" (тап = удаление)
 * - >200px — мгновенное удаление (full swipe)
 * ВПРАВО (если задан onSwipeRight):
 * - тянем вправо до зелёной зоны «Прочитано»; отпустил за порогом — действие + пружина назад
 *
 * v399: горизонтальный жест может перехватить управление после небольшого
 * вертикального движения. При перехвате фиксируем scrollTop списка и блокируем
 * его прокрутку до touchend — это убирает iOS-инерцию вверх/вниз во время свайпа.
 */
export default function SwipeToDeleteRow({ children, onDelete, onSwipeRight, disabled, className }: Props) {
  const [dragX, setDragXState] = useState(0);
  const [opened, setOpened] = useState(false);
  const dragXRef = useRef(0);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const lockRef = useRef<'h' | 'v' | null>(null);
  const hapticDoneRef = useRef(false);
  const rightHapticRef = useRef(false);
  const scrollElRef = useRef<HTMLElement | null>(null);
  const scrollTopRef = useRef(0);
  const scrollLockedRef = useRef(false);
  const gestureSurfaceRef = useRef<HTMLDivElement | null>(null);
  const nativeMoveHandlerRef = useRef<(event: TouchEvent) => void>(() => undefined);

  const ACTION_WIDTH = 88;
  const FULL_THRESHOLD = 200;
  const MAX = 240;
  const READ_THRESHOLD = 72;
  const READ_MAX = 112;

  const setDragX = (value: number) => {
    dragXRef.current = value;
    setDragXState(value);
  };

  const releaseScrollLock = () => {
    const scroll = scrollElRef.current;
    if (scroll && scrollLockedRef.current) {
      scroll.classList.remove('chat-swipe-scroll-lock');
      // Возвращаем ровно ту позицию, на которой начался жест. На iOS это ещё
      // и гасит остаточную инерцию, если пользователь начал свайп во время неё.
      scroll.scrollTop = scrollTopRef.current;
    }
    scrollLockedRef.current = false;
  };

  const acquireScrollLock = () => {
    const scroll = scrollElRef.current;
    if (!scroll || scrollLockedRef.current) return;
    scrollLockedRef.current = true;
    scroll.classList.add('chat-swipe-scroll-lock');
    scroll.scrollTop = scrollTopRef.current;
  };

  const reset = () => {
    releaseScrollLock();
    setDragX(0);
    setOpened(false);
    startXRef.current = null;
    startYRef.current = null;
    lockRef.current = null;
    hapticDoneRef.current = false;
    rightHapticRef.current = false;
    scrollElRef.current = null;
  };

  useEffect(() => {
    const surface = gestureSurfaceRef.current;
    if (!surface) return () => releaseScrollLock();
    const onNativeMove = (event: TouchEvent) => nativeMoveHandlerRef.current(event);
    surface.addEventListener('touchmove', onNativeMove, { passive: false });
    return () => {
      surface.removeEventListener('touchmove', onNativeMove);
      releaseScrollLock();
    };
  }, []);

  const horizontalAllowed = (dx: number) => (
    dx < 0 || (opened && dx > 0) || (dx > 0 && !!onSwipeRight && !opened)
  );

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || e.touches.length !== 1) return;
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    lockRef.current = null;
    hapticDoneRef.current = false;
    rightHapticRef.current = false;

    const scroll = e.currentTarget.closest('.chats-list-scroll') as HTMLElement | null;
    scrollElRef.current = scroll;
    if (scroll) {
      scrollTopRef.current = scroll.scrollTop;
      // Само касание и повторная запись текущей позиции останавливают большую
      // часть momentum-scroll в Safari ещё до определения оси жеста.
      scroll.scrollTop = scroll.scrollTop;
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (startXRef.current === null || startYRef.current === null || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const canSwipeHorizontally = horizontalAllowed(dx);

    if (lockRef.current === null) {
      // Не выбираем вертикальную ось по первым 5–6 px: именно из-за этого
      // небольшой предыдущий сдвиг списка раньше навсегда отменял свайп строки.
      if (canSwipeHorizontally && absX >= 9 && absX >= absY * 1.08) {
        lockRef.current = 'h';
        acquireScrollLock();
      } else if (absY >= 15 && absY >= absX * 1.45) {
        lockRef.current = 'v';
        return;
      } else {
        return;
      }
    } else if (lockRef.current === 'v') {
      // Разрешаем горизонтальному жесту перехватить управление, если после
      // лёгкого вертикального движения пользователь явно потянул строку вбок.
      if (canSwipeHorizontally && absX >= 24 && absX >= absY * 1.22) {
        lockRef.current = 'h';
        acquireScrollLock();
      } else {
        return;
      }
    }

    if (lockRef.current !== 'h') return;

    if (e.cancelable) e.preventDefault();
    const scroll = scrollElRef.current;
    if (scroll) scroll.scrollTop = scrollTopRef.current;

    const base = opened ? -ACTION_WIDTH : 0;
    let clamped = Math.max(-MAX, Math.min(MAX, base + dx));
    if (opened) {
      clamped = Math.min(0, clamped); // открыто — не пускаем правее 0
    } else if (clamped > 0) {
      if (!onSwipeRight) clamped = 0;
      else clamped = Math.min(READ_MAX, clamped);
    }
    setDragX(clamped);

    if (!hapticDoneRef.current && clamped <= -FULL_THRESHOLD) {
      hapticDoneRef.current = true;
      try { navigator.vibrate?.(12); } catch { /* no-op */ }
    }
    if (hapticDoneRef.current && clamped > -FULL_THRESHOLD) hapticDoneRef.current = false;

    if (!rightHapticRef.current && clamped >= READ_THRESHOLD) {
      rightHapticRef.current = true;
      try { navigator.vibrate?.(10); } catch { /* no-op */ }
    }
    if (rightHapticRef.current && clamped < READ_THRESHOLD) rightHapticRef.current = false;
  };

  nativeMoveHandlerRef.current = onTouchMove;

  const onTouchEnd = () => {
    const currentX = dragXRef.current;
    if (lockRef.current === 'h') {
      releaseScrollLock();

      if (currentX <= -FULL_THRESHOLD) {
        try { navigator.vibrate?.([10, 30, 10]); } catch { /* no-op */ }
        setDragX(-window.innerWidth);
        setTimeout(() => { onDelete(); reset(); }, 250);
        return;
      }

      if (currentX > 0) {
        if (currentX >= READ_THRESHOLD && onSwipeRight) {
          try { navigator.vibrate?.(12); } catch { /* no-op */ }
          onSwipeRight();
        }
        setDragX(0);
        setOpened(false);
      } else if (currentX <= -ACTION_WIDTH * 0.5) {
        setDragX(-ACTION_WIDTH);
        setOpened(true);
      } else {
        setDragX(0);
        setOpened(false);
      }
    }

    startXRef.current = null;
    startYRef.current = null;
    lockRef.current = null;
    scrollElRef.current = null;
  };

  const onTouchCancel = () => {
    releaseScrollLock();
    setDragX(opened ? -ACTION_WIDTH : 0);
    startXRef.current = null;
    startYRef.current = null;
    lockRef.current = null;
    scrollElRef.current = null;
  };

  const handleDeleteTap = () => {
    try { navigator.vibrate?.([10, 30, 10]); } catch { /* no-op */ }
    setDragX(-window.innerWidth);
    setTimeout(() => { onDelete(); reset(); }, 250);
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (opened || dragXRef.current !== 0) {
      e.stopPropagation();
      reset();
    }
  };

  return (
    <div className={className} style={{
      position: 'relative',
      overflow: 'hidden',
      touchAction: 'pan-y',
      background: dragX > 0 ? 'var(--success, #10B981)' : 'var(--danger, #EF4444)',
    }}>
      {dragX > 0 && (
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: Math.max(ACTION_WIDTH, dragX),
          background: 'var(--success, #10B981)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            <span style={{ fontSize: 'var(--fs-micro)', fontWeight: 600 }}>Прочитано</span>
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute',
        right: 0, top: 0, bottom: 0,
        width: Math.max(ACTION_WIDTH, Math.abs(Math.min(0, dragX))),
        background: 'var(--danger, #EF4444)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', gap: 6,
        pointerEvents: opened ? 'auto' : 'none',
        opacity: dragX < 0 ? 1 : 0,
      }}>
        <button
          onClick={handleDeleteTap}
          style={{
            background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '8px 12px',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span style={{ fontSize: 'var(--fs-micro)', fontWeight: 600 }}>Удалить</span>
        </button>
      </div>

      <div
        ref={gestureSurfaceRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onClickCapture={handleRowClick}
        style={{
          background: 'var(--bg)',
          transform: dragX !== 0 ? `translateX(${dragX}px)` : 'none',
          transition: dragX === 0 || dragX === -ACTION_WIDTH || dragX <= -window.innerWidth + 1
            ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            : 'none',
          position: 'relative',
          zIndex: 1,
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
