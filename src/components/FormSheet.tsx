// Единый лист создания: выезжает снизу под контент, грабер, шапка с заголовком,
// свайп-вниз для закрытия, анимации входа/выхода, хаптики. В стиле листа нового
// чата и тиндера. Монтируется родителем по условию; при закрытии проигрывает
// выезд и зовёт onClose.
import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';

interface Props {
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number;
  flushBottom?: boolean;
}

export default function FormSheet({ onClose, title, children, maxWidth = 500, flushBottom = false }: Props) {
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const closingRef = useRef(false);

  useEffect(() => {
    const r = requestAnimationFrame(() => { setShown(true); haptic.select(); });
    return () => cancelAnimationFrame(r);
  }, []);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    haptic.tap();
    setShown(false);
    setTimeout(onClose, 240);
  };

  const onDown = (e: React.PointerEvent) => { draggingRef.current = true; startYRef.current = e.clientY; };
  const onMove = (e: React.PointerEvent) => { if (!draggingRef.current) return; const dy = e.clientY - startYRef.current; if (dy > 0) setDragY(dy); };
  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragY > 110) { setDragY(0); close(); } else setDragY(0);
  };

  return (
    <div className="fsheet-overlay" onClick={close} style={{ opacity: shown ? 1 : 0 }}>
      <div
        className="fsheet"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth,
          transform: shown ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: draggingRef.current ? 'none' : 'transform .28s cubic-bezier(0.16,1,0.3,1)',
          paddingBottom: flushBottom ? 0 : undefined,
        }}
      >
        <div className="fsheet-drag" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="fsheet-grabber" />
          {title && (
            <div className="fsheet-header">
              <h2 className="fsheet-title">{title}</h2>
              <button className="fsheet-close" onClick={close} aria-label="Закрыть">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          )}
        </div>
        <div className="fsheet-body">{children}</div>
      </div>
    </div>
  );
}
