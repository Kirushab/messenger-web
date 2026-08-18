import type { ReactNode } from 'react';

// Единый стиль секций на странице события. Стиль приведён к виду BlockShell:
// округлая карточка с border + бейджем-кружком + контентом внутри.
//
// Использование:
//   <EventSection title="Фото" icon={<IconCamera />} action={<button>+</button>}>
//     {content}
//   </EventSection>
interface Props {
  title: string;
  icon?: ReactNode;
  /** Цвет «бейджа» с иконкой. По умолчанию — нейтральный surface-light. */
  iconBg?: string;
  iconColor?: string;
  /** Доп. кнопка/правый action — справа от заголовка */
  action?: ReactNode;
  /** Текст-подзаголовок под title (мелким серым) */
  subtitle?: string;
  children: ReactNode;
}

export default function EventSection({
  title, icon, iconBg, iconColor, action, subtitle, children,
}: Props) {
  return (
    <div className="event-section-card" style={{
      background: 'var(--surface-light)',
      borderRadius: 14,
      border: '1px solid var(--border)',
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        {icon && (
          <div style={{
            width: 32, height: 32, borderRadius: 16,
            background: iconBg || 'var(--surface)',
            color: iconColor || 'var(--text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>{icon}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={{ padding: 10 }}>
        {children}
      </div>
    </div>
  );
}
