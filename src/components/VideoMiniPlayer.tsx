import { useEffect, useRef, useState } from 'react';
import { useVideoStore, getVideoEl } from '@/stores/videoStore';

// Плавающий кружок видеосообщения (PiP). Рендерится в Layout → переживает навигацию,
// поэтому видео продолжает играть при скролле и смене чатов. Сам <video> живёт
// в сторе (вне дерева) и монтируется в отдельный слой ПОД кольцом прогресса.
// Кружок можно перетаскивать; одиночный тап = play/pause.
export default function VideoMiniPlayer() {
  const current = useVideoStore(s => s.current);
  const isPlaying = useVideoStore(s => s.isPlaying);
  const progress = useVideoStore(s => s.progress);
  const inlineVisible = useVideoStore(s => s.inlineVisible);
  const toggle = useVideoStore(s => s.toggle);
  const stop = useVideoStore(s => s.stop);
  const mountRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [snapping, setSnapping] = useState(false);
  const drag = useRef<{ sx: number; sy: number; baseX: number; baseY: number; moved: boolean } | null>(null);

  const detached = !!current && !inlineVisible;

  // Монтируем глобальный <video> в подложку под кольцом (mountRef стоит ПЕРВЫМ,
  // svg-кольцо и оверлеи — после него, поэтому они поверх видео).
  useEffect(() => {
    if (detached && mountRef.current) {
      const el = getVideoEl();
      el.className = 'vmini-video';
      if (el.parentElement !== mountRef.current) mountRef.current.appendChild(el);
      if (useVideoStore.getState().isPlaying && el.paused) el.play().catch(() => {});
    }
  }, [detached]);

  if (!detached) return null;

  const SIZE = 144;
  const R = 56;
  const C = 2 * Math.PI * R;

  const onPointerDown = (e: React.PointerEvent) => {
    const wrap = wrapRef.current; if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setSnapping(false);
    drag.current = { sx: e.clientX, sy: e.clientY, baseX: rect.left, baseY: rect.top, moved: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    if (Math.abs(e.clientX - d.sx) > 4 || Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    const nx = d.baseX + (e.clientX - d.sx);
    const ny = d.baseY + (e.clientY - d.sy);
    // По горизонтали разрешаем увести кружок за край (для свайпа-закрытия),
    // по вертикали держим в пределах экрана.
    const minX = -SIZE * 0.6, maxX = window.innerWidth - SIZE * 0.4;
    const maxY = window.innerHeight - SIZE - 4;
    setPos({ x: Math.max(minX, Math.min(maxX, nx)), y: Math.max(4, Math.min(maxY, ny)) });
  };
  const onPointerUp = () => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (!d.moved) { toggle(); return; } // тап без перетаскивания = play/pause
    const p = pos; if (!p) return;
    // Утащили за край → закрыть (как в Telegram)
    if (p.x < -SIZE * 0.4 || p.x > window.innerWidth - SIZE * 0.6) { stop(); return; }
    // Иначе — магнитимся к ближайшему боку
    const center = p.x + SIZE / 2;
    const snapX = center < window.innerWidth / 2 ? 8 : window.innerWidth - SIZE - 8;
    setSnapping(true);
    setPos({ x: snapX, y: p.y });
    window.setTimeout(() => setSnapping(false), 240);
  };

  const wrapStyle: React.CSSProperties = pos
    ? { top: pos.y, left: pos.x, right: 'auto', marginTop: 0, transition: snapping ? 'left 0.22s ease, top 0.22s ease' : 'none' }
    : {};

  return (
    <div className="vmini" ref={wrapRef} style={wrapStyle}>
      <div
        className="vmini-circle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ touchAction: 'none' }}
      >
        {/* подложка для глобального <video> — под кольцом */}
        <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
        <svg className="vmini-ring" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <circle cx="60" cy="60" r={R} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 60 60)" />
        </svg>
        {!isPlaying && (
          <div className="vmini-play">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><polygon points="6,4 20,12 6,20" /></svg>
          </div>
        )}
      </div>
    </div>
  );
}
