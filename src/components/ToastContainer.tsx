import { useToastStore, type Toast, type Banner } from '@/stores/toastStore';

type ToastType = 'success' | 'error' | 'warning' | 'info';

const TYPE_STYLES: Record<ToastType, { bg: string; color: string }> = {
  success: { bg: '#16a34a', color: '#fff' },
  error:   { bg: '#dc2626', color: '#fff' },
  warning: { bg: '#eab308', color: '#1F2937' },
  info:    { bg: 'var(--surface-light)', color: 'var(--text)' },
};

function TypeIcon({ type, size = 16, color }: { type: ToastType; size?: number; color?: string }) {
  const stroke = color || 'currentColor';
  switch (type) {
    case 'success':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case 'error':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <circle cx="12" cy="16" r="0.5" fill={stroke} stroke="none" />
        </svg>
      );
    case 'warning':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <circle cx="12" cy="17" r="0.5" fill={stroke} stroke="none" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <circle cx="12" cy="8" r="0.5" fill={stroke} stroke="none" />
        </svg>
      );
  }
}

const BANNER_STYLES: Record<string, { bg: string; color: string }> = {
  info:    { bg: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff' },
  warning: { bg: 'linear-gradient(135deg, #F59E0B, #EF4444)', color: '#fff' },
  event:   { bg: 'linear-gradient(135deg, #8B5CF6, #EC4899)', color: '#fff' },
};

export default function ToastContainer() {
  const { toasts, banners, dismiss, dismissBanner } = useToastStore();

  // Делим: toast'ы со снэкбаром (с действием) рендерятся снизу, без — сверху
  const topToasts = toasts.filter(t => !t.action);
  const bottomSnackbars = toasts.filter(t => !!t.action);

  return (
    <>
      {/* Banner (выше всех — для важных уведомлений) */}
      {banners.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 'env(safe-area-inset-top, 0px)',
          left: 0, right: 0,
          zIndex: 10000,
          display: 'flex', flexDirection: 'column', gap: 0,
          pointerEvents: 'none',
        }}>
          {banners.map(b => <BannerItem key={b.id} b={b} onClose={() => dismissBanner(b.id)} />)}
        </div>
      )}

      {/* Toasts сверху */}
      {topToasts.length > 0 && (
        <div style={{
          position: 'fixed',
          top: `calc(env(safe-area-inset-top, 0px) + ${banners.length ? 78 : 16}px)`,
          left: 16, right: 16,
          zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: 8,
          pointerEvents: 'none',
          alignItems: 'center',
        }}>
          {topToasts.map(t => <ToastItem key={t.id} t={t} onClose={() => dismiss(t.id)} />)}
        </div>
      )}

      {/* Snackbars снизу */}
      {bottomSnackbars.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          left: 16, right: 16,
          zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: 8,
          pointerEvents: 'none',
          alignItems: 'center',
        }}>
          {bottomSnackbars.map(t => <SnackbarItem key={t.id} t={t} onClose={() => dismiss(t.id)} />)}
        </div>
      )}
    </>
  );
}

function ToastItem({ t, onClose }: { t: Toast; onClose: () => void }) {
  const type = (t.type || 'info') as ToastType;
  const style = TYPE_STYLES[type] || TYPE_STYLES.info;
  return (
    <div
      onClick={onClose}
      className="toast-enter"
      style={{
        background: style.bg,
        color: style.color,
        padding: '10px 14px',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 'var(--fs-snap14)', fontWeight: 500,
        maxWidth: 480, width: '100%',
        pointerEvents: 'auto', cursor: 'pointer',
        border: type === 'info' ? '1px solid var(--border)' : 'none',
      }}
    >
      <span style={{ flexShrink: 0, display: 'inline-flex' }}>
        <TypeIcon type={type} size={18} />
      </span>
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{t.message}</span>
    </div>
  );
}

function SnackbarItem({ t, onClose }: { t: Toast; onClose: () => void }) {
  const type = (t.type || 'info') as ToastType;
  // На тёмном фоне snackbar используем подложку акцентного цвета для иконки
  const iconColor =
    type === 'success' ? '#34d399' :
    type === 'error'   ? '#fca5a5' :
    type === 'warning' ? '#fcd34d' :
                         '#9ca3af';
  return (
    <div
      className="snackbar-enter"
      style={{
        background: 'var(--text)',
        color: 'var(--bg)',
        padding: '12px 8px 12px 16px',
        borderRadius: 12,
        boxShadow: '0 6px 22px rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 'var(--fs-snap14)', fontWeight: 500,
        maxWidth: 480, width: '100%',
        pointerEvents: 'auto',
      }}
    >
      <span style={{ flexShrink: 0, display: 'inline-flex', color: iconColor }}>
        <TypeIcon type={type} size={18} color={iconColor} />
      </span>
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{t.message}</span>
      {t.action && (
        <button
          onClick={() => {
            t.action!.onClick();
            onClose();
          }}
          style={{
            background: 'none', border: 'none',
            color: '#60A5FA',
            fontSize: 'var(--fs-label)', fontWeight: 700,
            cursor: 'pointer',
            padding: '6px 10px',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >{t.action.label}</button>
      )}
    </div>
  );
}


function BannerIcon({ icon }: { icon: Banner['icon'] }) {
  if (!icon) return null;
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (icon === 'event-trip') return <svg {...common}><path d="M2 16l20-7-20-7 5 7-5 7Z"/><path d="M7 9h7"/></svg>;
  if (icon === 'event-party') return <svg {...common}><path d="M5 22l4-14 7 7-11 7Z"/><path d="M14 4c1.5.8 2.2 1.9 2 3.2"/><path d="M18 2c2 .9 3 2.3 2.8 4.2"/><path d="M11 2l1 3"/><path d="M19 10l3 1"/></svg>;
  if (icon === 'event-calendar') return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 15h.01M12 15h.01M16 15h.01"/></svg>;
  return <TypeIcon type="info" size={22} color="currentColor" />;
}

function BannerItem({ b, onClose }: { b: Banner; onClose: () => void }) {
  const style = BANNER_STYLES[b.type] || BANNER_STYLES.info;
  return (
    <div
      onClick={() => { b.onClick?.(); onClose(); }}
      className="banner-enter"
      style={{
        background: style.bg,
        color: style.color,
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: b.onClick ? 'pointer' : 'default',
        pointerEvents: 'auto',
        boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
      }}
    >
      {b.icon && <span style={{ flexShrink: 0, display: 'inline-flex' }}><BannerIcon icon={b.icon} /></span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 700, lineHeight: 1.2 }}>{b.title}</div>
        {b.message && <div style={{ fontSize: 'var(--fs-caption)', opacity: 0.95, marginTop: 2 }}>{b.message}</div>}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: 'inherit',
          width: 26, height: 26, borderRadius: 13,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-label="Закрыть"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  );
}
