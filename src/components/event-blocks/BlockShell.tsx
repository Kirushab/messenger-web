import { createContext, useContext, useState, type ReactNode } from 'react';
import { haptic } from '@/lib/haptics';

interface Props {
  icon: ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
  empty?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
}

/**
 * Унифицированная карточка-обёртка для блоков события.
 * Заголовок с иконкой + кнопка добавления + контент.
 * Тап по заголовку сворачивает/разворачивает блок (B2). Кнопка «+» с
 * пресс-анимацией и хаптиком (B3).
 */
// Контекст от EventView: свёрнут ли блок по умолчанию (настройка события expanded_blocks)
export const BlockCollapseCtx = createContext<{ collapsed: boolean } | null>(null);

export default function BlockShell({ icon, iconBg, title, subtitle, onAdd, addLabel, empty, children, collapsible = true }: Props) {
  const ctx = useContext(BlockCollapseCtx);
  const [collapsed, setCollapsed] = useState<boolean>(() => ctx?.collapsed ?? false);

  const toggle = () => {
    if (!collapsible) return;
    haptic.tap();
    setCollapsed(c => !c);
  };

  return (
    <div className="event-block-shell" style={{
      background: 'var(--surface)',
      borderRadius: 18,
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px',
        borderBottom: collapsed ? 'none' : '1px solid var(--border)',
        transition: 'border-color .2s',
      }}>
        <div
          onClick={toggle}
          style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: collapsible ? 'pointer' : 'default' }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 17,
            background: 'var(--surface-light)',
            color: iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>{subtitle}</div>}
          </div>
        </div>
        {onAdd && (
          <button
            onClick={(e) => { e.stopPropagation(); haptic.tap(); onAdd(); }}
            aria-label={addLabel || 'Добавить'}
            className="block-add-btn"
            style={{
              width: 30, height: 30, borderRadius: 15, padding: 0,
              background: 'var(--text)',
              color: 'var(--bg)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}
        {collapsible && (
          <button
            onClick={toggle}
            aria-label={collapsed ? 'Развернуть' : 'Свернуть'}
            className="block-chevron"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: 'var(--muted)', display: 'flex', flexShrink: 0,
              transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .24s var(--ease-out, ease)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        )}
      </div>
      <div style={{ maxHeight: collapsed ? 0 : 6000, overflow: 'hidden', transition: 'max-height .34s var(--ease-out, ease)' }}>
        <div style={{ padding: 14 }}>
          {empty ?? children}
        </div>
      </div>
    </div>
  );
}
