import { useRef, useState, useCallback, type CSSProperties } from 'react';

interface Props {
  liked: boolean;
  count: number;
  onToggle: () => void;
  size?: number;             // размер иконки (default 24)
  color?: string;            // цвет когда liked (default '#EF4444')
  inactiveColor?: string;    // когда не liked (default 'var(--text)')
  showCount?: boolean;       // показывать число рядом (default true)
}

// Уникальный счётчик для key-ов
let burstId = 0;

interface Burst {
  id: number;
  particles: { angle: number; dist: number }[];
  showPlusOne: boolean;
}

export default function LikeButton({
  liked, count, onToggle,
  size = 24,
  color = '#EF4444',
  inactiveColor = 'var(--text)',
  showCount = true,
}: Props) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const popRef = useRef<HTMLSpanElement>(null);

  const handleClick = useCallback(() => {
    // Анимация на иконке всегда (и лайк, и анлайк)
    if (popRef.current) {
      popRef.current.style.animation = 'none';
      // reflow trick
      void popRef.current.offsetWidth;
      popRef.current.style.animation = 'likeBurst 350ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    }

    // Сердечки-частицы и +1 — только при добавлении лайка
    const justLiked = !liked;
    if (justLiked) {
      const id = ++burstId;
      const particles = Array.from({ length: 6 }, (_, i) => ({
        angle: (i * 60 + Math.random() * 25 - 12) * (Math.PI / 180),
        dist: 28 + Math.random() * 8,
      }));
      setBursts(prev => [...prev, { id, particles, showPlusOne: true }]);
      // Чистим через 700мс
      setTimeout(() => {
        setBursts(prev => prev.filter(b => b.id !== id));
      }, 750);

      // Haptic (если поддерживается)
      if ('vibrate' in navigator) {
        try { navigator.vibrate(10); } catch {}
      }
    }

    onToggle();
  }, [liked, onToggle]);

  const iconColor = liked ? color : inactiveColor;

  return (
    <button
      onClick={handleClick}
      className="feed-action-btn"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        position: 'relative',
        color: iconColor,
      }}
    >
      <span ref={popRef} style={{ display: 'inline-flex', position: 'relative', lineHeight: 0 }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: 'fill 200ms ease, stroke 200ms ease' }}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>

        {/* Расширяющееся кольцо */}
        {bursts.map(b => (
          <span
            key={`ring-${b.id}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: size * 1.4,
              height: size * 1.4,
              borderRadius: '50%',
              border: `2px solid ${color}`,
              pointerEvents: 'none',
              animation: 'likeRing 550ms ease-out forwards',
            }}
          />
        ))}

        {/* Сердечки-частицы */}
        {bursts.flatMap(b =>
          b.particles.map((p, i) => {
            const dx = Math.cos(p.angle) * p.dist;
            const dy = Math.sin(p.angle) * p.dist;
            const style = {
              '--particle-end': `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`,
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              animation: 'heartParticle 650ms ease-out forwards',
            } as CSSProperties;
            return (
              <span key={`p-${b.id}-${i}`} style={style}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill={color}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </span>
            );
          })
        )}

        {/* +1 вылетающее */}
        {bursts.filter(b => b.showPlusOne).map(b => (
          <span
            key={`plus-${b.id}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: -4,
              transform: 'translate(-50%, 0)',
              color,
              fontSize: 'var(--fs-caption)',
              fontWeight: 700,
              pointerEvents: 'none',
              animation: 'plusOneFly 650ms ease-out forwards',
              fontVariantNumeric: 'tabular-nums',
            }}
          >+1</span>
        ))}
      </span>
      {showCount && (
        <span style={{ fontSize: 'var(--fs-label)', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: iconColor }}>
          {count}
        </span>
      )}
    </button>
  );
}
