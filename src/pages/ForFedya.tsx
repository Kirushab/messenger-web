import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

const I = {
  notes: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      <path d="M14 8 22 6"/>
    </svg>
  ),
  languages: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
      <path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>
    </svg>
  ),
};

interface Item {
  id: string;
  title: string;
  icon: ReactNode;
  bg: string;
  to?: string;
  disabled?: boolean;
}

const ITEMS: Item[] = [
  { id: 'notes',     title: 'Ноты',  icon: I.notes,     bg: 'var(--text)', to: '/notes' },
  { id: 'languages', title: 'Языки', icon: I.languages, bg: 'var(--text)', to: '/languages' },
];

export default function ForFedya() {
  const nav = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="safe-top" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        <button onClick={() => nav(-1)} style={{
          width: 36, height: 36, borderRadius: 18, border: 'none',
          background: 'var(--surface-light)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 600 }}>Для Феди</div>
      </div>

      <div className="page-scroll" style={{ padding: '8px 0 24px' }}>
        <div
          className={sessionStorage.getItem('fedyaAnimated') ? '' : 'anim-stagger'}
          ref={() => sessionStorage.setItem('fedyaAnimated', '1')}
          style={{ maxWidth: 560, margin: '0 auto' }}
        >
          {ITEMS.map((g, idx) => (
            <button
              key={g.id}
              onClick={() => g.disabled ? null : g.to && nav(g.to)}
              disabled={g.disabled}
              className="tap-effect"
              style={{
                width: '100%',
                background: 'none', border: 'none',
                padding: '12px 16px',
                cursor: g.disabled ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 14,
                opacity: g.disabled ? 0.55 : 1,
                borderBottom: idx < ITEMS.length - 1 ? '0.5px solid var(--border)' : 'none',
                textAlign: 'left',
                color: 'var(--text)',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: g.bg,
                color: 'var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: g.disabled ? 'none' : '0 1px 4px rgba(0,0,0,0.12)',
              }}>
                <div style={{ transform: 'scale(0.72)' }}>{g.icon}</div>
              </div>
              <span style={{ flex: 1, fontSize: 'var(--fs-snap16)', color: 'var(--text)', fontWeight: 500 }}>{g.title}</span>
              {g.disabled
                ? <span style={{ fontSize: 'var(--fs-snap10)', fontWeight: 600, color: 'var(--muted)', background: 'var(--surface-light)', padding: '3px 8px', borderRadius: 8, letterSpacing: 0.3 }}>СКОРО</span>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              }
            </button>
          ))}
        </div>

        <p style={{
          textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-caption)',
          marginTop: 32, padding: '0 24px', lineHeight: 1.5,
        }}>
          Тренажёры для Феди ✨
        </p>
      </div>
    </div>
  );
}
