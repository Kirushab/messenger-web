import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  rounded?: number;
  style?: CSSProperties;
}

export function Skeleton({ width = '100%', height = 20, rounded = 8, style }: SkeletonProps) {
  return (
    <div className="skeleton-shimmer" style={{
      width,
      height,
      borderRadius: rounded,
      ...style,
    }} />
  );
}

// Готовые шаблоны
export function SkeletonChatItem() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 12, borderTop: '1px solid var(--border)' }}>
      <Skeleton width={44} height={44} rounded={22} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="85%" height={11} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <Skeleton width={36} height={10} />
      </div>
    </div>
  );
}

export function SkeletonGameCard() {
  return (
    <div style={{ padding: 14, background: 'var(--surface-light)', borderRadius: 12, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
      <Skeleton width={32} height={32} rounded={8} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="70%" height={11} />
      </div>
      <Skeleton width={50} height={20} rounded={6} />
    </div>
  );
}

export function SkeletonStatRow() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-light)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="60%" height={10} />
      </div>
      <Skeleton width={48} height={20} rounded={6} />
    </div>
  );
}

// Карточка темы курса: тайл + заголовок + полоса прогресса (в ритме CourseRow).
export function SkeletonCourseCard() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', borderRadius: 14, padding: 14 }}>
      <Skeleton width={44} height={44} rounded={22} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="78%" height={11} />
      </div>
    </div>
  );
}

// Единый скелетон виджет-карточки (Tinder/Event/Auction/Chess) — общий каркас.
export function SkeletonWidgetCard({ compact = false, variant = 'event' }: { compact?: boolean; variant?: 'event' | 'tinder' | 'auction' }) {
  if (compact) {
    return (
      <div style={{ width: 280, height: 384, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-card)', boxSizing: 'border-box' }}>
        <div style={{ height: 54, padding: 13, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 7, borderBottom: '1px solid var(--border)' }}>
          <Skeleton width="48%" height={13} />
          <Skeleton width="66%" height={10} />
        </div>
        <div style={{ height: 224, padding: 12, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
          <Skeleton width={200} height={200} rounded={6} />
        </div>
        <div style={{ height: 106, padding: '10px 13px 13px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}><Skeleton width={72} height={20} rounded={8} /><Skeleton width={76} height={20} rounded={8} /></div>
          <Skeleton width="100%" height={40} rounded={12} />
        </div>
      </div>
    );
  }
  if (variant === 'tinder') {
    return (
      <div style={{ width: 272, height: 620, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-card)', boxSizing: 'border-box' }}>
        <Skeleton width="100%" height={34} rounded={0} />
        <Skeleton width="100%" height={363} rounded={0} />
        <div style={{ height: 223, padding: 12, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}><Skeleton width="50%" height={42} rounded={12} /><Skeleton width="50%" height={42} rounded={12} /></div>
          <Skeleton width="55%" height={12} />
          <Skeleton width="100%" height={48} rounded={12} />
        </div>
      </div>
    );
  }
  if (variant === 'auction') {
    return (
      <div style={{ width: 340, maxWidth: '78vw', height: 260, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-card)', boxSizing: 'border-box', padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton width={86} height={12} rounded={6} />
          <Skeleton width="72%" height={20} rounded={8} />
          <Skeleton width="92%" height={13} rounded={6} />
          <Skeleton width="58%" height={13} rounded={6} />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}><Skeleton width="50%" height={58} rounded={12} /><Skeleton width="50%" height={58} rounded={12} /></div>
          <Skeleton width="100%" height={44} rounded={12} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: 272, height: 236, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-card)', boxSizing: 'border-box' }}>
      <Skeleton width="100%" height={132} rounded={0} />
      <div style={{ height: 104, padding: '11px 13px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="62%" height={15} />
        <Skeleton width="48%" height={12} />
        <Skeleton width="72%" height={12} />
      </div>
    </div>
  );
}

// Скелетон поста ленты (F2)
export function SkeletonPost() {
  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <Skeleton width={36} height={36} rounded={18} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="25%" height={10} />
        </div>
      </div>
      <div className="skeleton-shimmer" style={{ width: '100%', aspectRatio: '1 / 1' }} />
      <div style={{ display: 'flex', gap: 16, padding: '12px 14px 8px' }}>
        <Skeleton width={26} height={26} rounded={13} />
        <Skeleton width={26} height={26} rounded={13} />
      </div>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="80%" height={11} />
        <Skeleton width="55%" height={11} />
      </div>
    </div>
  );
}

// Скелетон сетки ленты (F2)
export function SkeletonPostGrid({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-shimmer" style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 0 }} />
      ))}
    </div>
  );
}
