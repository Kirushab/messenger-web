import { useEffect, useRef, useState } from 'react';

interface Props {
  word: string;
  onGuessed: () => void;       // успех
  onSkipped: () => void;       // пропуск
  missPenalty: number;          // штраф (для надписи на кнопке)
}

/**
 * Карточка слова в Alias с flip-сменой и swipe-жестами.
 * Свайп вправо = угадали, влево = пропуск.
 */
export default function AliasWordCard({ word, onGuessed, onSkipped, missPenalty }: Props) {
  // Внутренние «слои»: один для текущего слова, один для предыдущего во время flip
  const [displayWord, setDisplayWord] = useState(word);
  const [phase, setPhase] = useState<'idle' | 'flipping'>('idle');
  const wordRef = useRef(word);

  // Drag state
  const [dragX, setDragX] = useState(0);
  const [exiting, setExiting] = useState<'right' | 'left' | null>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const dragLockedRef = useRef<'h' | 'v' | null>(null);

  // Когда word меняется снаружи (после отметки) — играем flip
  useEffect(() => {
    if (word === wordRef.current) return;
    wordRef.current = word;
    setPhase('flipping');
    // Сначала flip-out → меняем слово → flip-in
    const t1 = setTimeout(() => {
      setDisplayWord(word);
      setExiting(null);
      setDragX(0);
    }, 250);
    const t2 = setTimeout(() => {
      setPhase('idle');
    }, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [word]);

  // Завершение взаимодействия
  const finishGuessed = () => {
    if (exiting || phase === 'flipping') return;
    setExiting('right');
    if ('vibrate' in navigator) {
      try { navigator.vibrate(15); } catch {}
    }
    setTimeout(() => onGuessed(), 340);
  };
  const finishSkipped = () => {
    if (exiting || phase === 'flipping') return;
    setExiting('left');
    if ('vibrate' in navigator) {
      try { navigator.vibrate([8, 30, 8]); } catch {}
    }
    setTimeout(() => onSkipped(), 340);
  };

  // Drag handlers (только пока не in-flip / exit)
  const onTouchStart = (e: React.TouchEvent) => {
    if (exiting || phase === 'flipping') return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    dragLockedRef.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;
    // Определяем направление (вертикальный скролл / горизонтальный свайп)
    if (dragLockedRef.current === null) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        dragLockedRef.current = 'v';
      } else if (Math.abs(dx) > 8) {
        dragLockedRef.current = 'h';
      }
    }
    if (dragLockedRef.current === 'h') {
      e.preventDefault();
      setDragX(dx);
    }
  };
  const onTouchEnd = () => {
    if (dragLockedRef.current === 'h') {
      if (dragX > 90) {
        finishGuessed();
      } else if (dragX < -90) {
        finishSkipped();
      } else {
        setDragX(0);
      }
    }
    startXRef.current = null;
    startYRef.current = null;
    dragLockedRef.current = null;
  };

  // Стиль карточки с drag и rotate
  const rot = dragX / 25; // максимум ~+/- 8 градусов при сильном свайпе
  const cardStyle: React.CSSProperties = {
    transform: exiting ? undefined : `translateX(${dragX}px) rotate(${rot}deg)`,
    transition: dragX === 0 && !exiting ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
    transformOrigin: 'center bottom',
    touchAction: 'pan-y',
    willChange: 'transform',
  };

  // Класс анимации
  let animClass = '';
  if (phase === 'flipping' && !exiting) {
    // используем displayWord — если оно ещё старое — flip-out; иначе flip-in
    animClass = displayWord === word ? 'alias-card-flip-in' : 'alias-card-flip-out';
  }
  if (exiting === 'right') animClass = 'alias-card-fly-right';
  if (exiting === 'left') animClass = 'alias-card-fly-left';

  // Лейблы у краёв (зелёный / красный) при drag
  const dragRatio = Math.min(1, Math.abs(dragX) / 90);
  const showRight = dragX > 15;
  const showLeft = dragX < -15;

  return (
    <div
      className={animClass}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        margin: '0 12px 12px',
        padding: 16,
        background: 'var(--accent)',
        borderRadius: 12,
        textAlign: 'center',
        position: 'relative',
        ...cardStyle,
      }}
    >
      <div style={{ fontSize: 'var(--fs-micro)', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
        ВАШЕ СЛОВО (объясняйте, не называйте однокоренные)
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--bg)', minHeight: 38 }}>
        {displayWord}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={finishGuessed}
          className="tap-effect"
          style={{
            flex: 2, padding: 12, background: '#16a34a', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer',
          }}
        >✓ Угадали (+1)</button>
        <button
          onClick={finishSkipped}
          className="tap-effect"
          style={{
            flex: 1, padding: 12, background: '#ef4444', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer',
          }}
        >↷ Пропуск ({missPenalty > 0 ? `-${missPenalty}` : '0'})</button>
      </div>

      {/* Подсказка о свайпах */}
      <div style={{
        fontSize: 'var(--fs-snap10)', color: 'rgba(255,255,255,0.5)', marginTop: 8,
        letterSpacing: 0.3,
      }}>
        ← пропуск · угадали →
      </div>

      {/* Индикаторы при свайпе */}
      <div style={{
        position: 'absolute', top: 16, left: 14,
        padding: '4px 10px',
        background: '#ef4444',
        color: '#fff', fontWeight: 700, fontSize: 'var(--fs-label)',
        borderRadius: 6, transform: 'rotate(-12deg)',
        opacity: showLeft ? dragRatio : 0,
        transition: showLeft ? 'none' : 'opacity 0.15s',
        pointerEvents: 'none',
        letterSpacing: 0.5,
      }}>ПРОПУСК</div>
      <div style={{
        position: 'absolute', top: 16, right: 14,
        padding: '4px 10px',
        background: '#16a34a',
        color: '#fff', fontWeight: 700, fontSize: 'var(--fs-label)',
        borderRadius: 6, transform: 'rotate(12deg)',
        opacity: showRight ? dragRatio : 0,
        transition: showRight ? 'none' : 'opacity 0.15s',
        pointerEvents: 'none',
        letterSpacing: 0.5,
      }}>УГАДАЛИ</div>
    </div>
  );
}
