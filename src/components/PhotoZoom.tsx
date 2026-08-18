import { useEffect, useRef, useState } from 'react';

interface Props {
  src: string;
  alt?: string;
  fromRect: DOMRect; // rect миниатюры с которой открываем
  onClose: () => void;
  caption?: React.ReactNode;
  topBar?: React.ReactNode;
}

/**
 * PhotoZoom — плавное открытие изображения из миниатюры в fullscreen.
 * Использует transform от bounding box миниатюры к fullscreen контейнеру.
 * При закрытии анимирует обратно.
 *
 * Использование:
 *   const [zoom, setZoom] = useState<{ src: string; rect: DOMRect } | null>(null);
 *   onClick={(e) => setZoom({ src: url, rect: e.currentTarget.getBoundingClientRect() })}
 *   {zoom && <PhotoZoom src={zoom.src} fromRect={zoom.rect} onClose={() => setZoom(null)} />}
 */
export default function PhotoZoom({ src, alt, fromRect, onClose, caption, topBar }: Props) {
  const [phase, setPhase] = useState<'entering' | 'open' | 'closing'>('entering');
  const containerRef = useRef<HTMLDivElement>(null);
  // Pinch & drag-to-dismiss
  const [dragY, setDragY] = useState(0);
  const startTouchYRef = useRef<number | null>(null);

  // Кадр 1: позиционируемся в rect миниатюры, кадр 2: animate to fullscreen
  useEffect(() => {
    // Принудительный reflow перед сменой класса
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('open'));
    });
  }, []);

  const close = () => {
    if (phase === 'closing') return;
    setPhase('closing');
    setTimeout(() => onClose(), 280);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    startTouchYRef.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startTouchYRef.current === null) return;
    const dy = e.touches[0].clientY - startTouchYRef.current;
    if (Math.abs(dy) > 5) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (Math.abs(dragY) > 100) close();
    else setDragY(0);
    startTouchYRef.current = null;
  };

  const isOpen = phase === 'open';

  // Backdrop opacity зависит от phase и dragY
  let backdropOpacity = 1;
  if (phase === 'entering' || phase === 'closing') backdropOpacity = 0;
  if (phase === 'open') backdropOpacity = Math.max(0.4, 1 - Math.abs(dragY) / 400);

  // Image styles — animate transform from fromRect to fullscreen
  const imgStyle: React.CSSProperties = isOpen
    ? {
        position: 'fixed',
        left: 0, top: 0, right: 0, bottom: 0,
        width: '100%', height: '100%',
        objectFit: 'contain',
        transform: dragY !== 0 ? `translateY(${dragY}px) scale(${Math.max(0.85, 1 - Math.abs(dragY) / 1500)})` : 'translateY(0) scale(1)',
        transition: dragY === 0 ? 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        zIndex: 1,
        cursor: 'pointer',
      }
    : {
        position: 'fixed',
        left: fromRect.left,
        top: fromRect.top,
        width: fromRect.width,
        height: fromRect.height,
        objectFit: 'cover',
        transform: 'translateY(0) scale(1)',
        transition: phase === 'closing' ? 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        zIndex: 1,
        cursor: 'pointer',
      };

  // Top/bottom bars opacity
  const overlayOpacity = (isOpen && Math.abs(dragY) < 60) ? 1 : 0;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: `rgba(0,0,0,${backdropOpacity})`,
        transition: 'background 0.28s ease',
      }}
      onClick={close}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={src}
        alt={alt}
        onClick={(e) => { e.stopPropagation(); close(); }}
        style={imgStyle}
      />

      {/* Верхняя плашка */}
      {topBar && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            padding: '12px 16px max(8px, env(safe-area-inset-top, 8px))',
            paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
            color: '#fff', zIndex: 2,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)',
            opacity: overlayOpacity,
            transition: 'opacity 0.2s ease',
            display: 'flex', alignItems: 'center', gap: 10,
            pointerEvents: overlayOpacity === 0 ? 'none' : 'auto',
          }}
        >
          {topBar}
        </div>
      )}

      {/* Нижняя подпись */}
      {caption && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            padding: '14px 16px max(20px, env(safe-area-inset-bottom, 20px))',
            color: '#fff', zIndex: 2,
            background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)',
            fontSize: 'var(--fs-label)',
            opacity: overlayOpacity,
            transition: 'opacity 0.2s ease',
            pointerEvents: overlayOpacity === 0 ? 'none' : 'auto',
          }}
        >
          {caption}
        </div>
      )}

      {/* Кнопка закрыть */}
      <button
        onClick={(e) => { e.stopPropagation(); close(); }}
        style={{
          position: 'fixed',
          top: 'max(16px, env(safe-area-inset-top, 16px))',
          right: 16,
          width: 36, height: 36, borderRadius: 18,
          background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff',
          fontSize: 'var(--fs-title)', lineHeight: 1, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, zIndex: 3,
          opacity: overlayOpacity,
          transition: 'opacity 0.2s ease',
        }}
      >✕</button>
    </div>
  );
}
