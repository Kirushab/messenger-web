import { useRef, useState } from 'react';

// Делит описание примерно пополам по границе слова
function splitHalf(s: string): [string, string] {
  if (!s) return ['', ''];
  const mid = Math.floor(s.length / 2);
  let i = s.lastIndexOf(' ', mid);
  if (i <= 0) i = s.indexOf(' ', mid);
  if (i <= 0) i = mid;
  return [s.slice(0, i).trim(), s.slice(i).trim()];
}

interface Props {
  photos: string[];
  caption?: string;
  radius?: number;
  full?: boolean; // на весь доступный размер (для виджета)
}

export default function TinderCard({ photos, caption = '', radius = 16, full }: Props) {
  const [idx, setIdx] = useState(0);
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);

  const list = photos.filter(Boolean);
  const two = list.length >= 2;
  const [capA, capB] = two ? splitHalf(caption) : [caption, ''];
  const curCaption = two ? (idx === 0 ? capA : capB) : caption;

  const onStart = (e: React.TouchEvent) => { if (two) startX.current = e.touches[0].clientX; };
  const onMove = (e: React.TouchEvent) => { if (startX.current !== null) setDx(e.touches[0].clientX - startX.current); };
  const onEnd = () => {
    if (dx < -40 && idx < 1) setIdx(1);
    else if (dx > 40 && idx > 0) setIdx(0);
    setDx(0); startX.current = null;
  };

  if (list.length === 0) {
    return <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: radius, background: 'var(--surface-light)' }} />;
  }

  return (
    <div
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      style={{
        position: 'relative', width: '100%',
        aspectRatio: '3/4', maxHeight: full ? '100%' : 360,
        borderRadius: radius, overflow: 'hidden', background: '#000',
        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
      }}
    >
      <img
        src={list[two ? idx : 0]} alt=""
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          transform: `translateX(${dx * 0.25}px)`, transition: dx === 0 ? 'transform .2s' : 'none',
        }}
      />

      {two && (
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 5 }}>
          {list.slice(0, 2).map((_, i) => (
            <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === idx ? '#fff' : 'rgba(255,255,255,0.45)' }} />
          ))}
        </div>
      )}

      {/* невидимые зоны тапа для переключения, как в сторис/тиндере */}
      {two && (
        <>
          <div onClick={() => setIdx(0)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '35%' }} />
          <div onClick={() => setIdx(1)} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '35%' }} />
        </>
      )}

      {caption && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '40px 14px 14px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.72))',
          color: '#fff', fontSize: 'var(--fs-body)', lineHeight: 1.4, whiteSpace: 'pre-wrap',
        }}>
          {curCaption}
        </div>
      )}
    </div>
  );
}
