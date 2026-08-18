import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode; // emoji или SVG или string
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'compact';
}

/**
 * Универсальный пустой экран с SVG-иллюстрацией.
 * Используется вместо одиночного текста "Нет данных" или 📭.
 */
export default function EmptyState({ icon, title, subtitle, action, variant = 'default' }: Props) {
  const isCompact = variant === 'compact';
  return (
    <div className="empty-state-enter" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: isCompact ? '32px 20px' : '60px 24px',
      textAlign: 'center',
      gap: 8,
      color: 'var(--muted)',
    }}>
      {/* Иконку рисуем только если она реально передана. Если icon=null —
          скрываем блок целиком, чтобы получить чистый текстовый empty state. */}
      {icon !== null && icon !== undefined && (
        <div className="empty-state-icon" style={{
          fontSize: isCompact ? 44 : 72,
          opacity: 0.9,
          marginBottom: isCompact ? 4 : 12,
          lineHeight: 1,
        }}>
          {icon}
        </div>
      )}
      <div style={{
        fontSize: isCompact ? 15 : 19,
        fontWeight: 600,
        color: 'var(--text)',
        maxWidth: 280,
        letterSpacing: '-0.2px',
      }}>{title}</div>
      {subtitle && (
        <div style={{
          fontSize: isCompact ? 12 : 14,
          color: 'var(--muted)',
          maxWidth: 280,
          lineHeight: 1.5,
          marginTop: 2,
        }}>{subtitle}</div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 14,
            padding: '10px 22px',
            background: 'var(--accent)',
            color: 'var(--bg)',
            border: 'none', borderRadius: 22,
            fontSize: 'var(--fs-snap14)', fontWeight: 600,
            cursor: 'pointer',
          }}
        >{action.label}</button>
      )}
    </div>
  );
}
