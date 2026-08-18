import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

const I = {
  // Poker — две игральные карты веером (черва + пика) для покера/казино
  poker: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
      {/* Задняя карта (повёрнута влево) */}
      <path d="M 8 6 L 14 4 L 18 16 L 12 18 Z" fill="currentColor" stroke="currentColor"/>
      {/* Передняя карта (вертикальная белая) */}
      <rect x="9" y="6" width="9" height="14" rx="1.2" fill="#fff" stroke="currentColor" strokeWidth="1.4"/>
      {/* Символ червы на передней карте */}
      <path d="M 13.5 12.5 C 13 11.5, 11 11.5, 11 13.5 C 11 15, 13.5 17, 13.5 17 C 13.5 17, 16 15, 16 13.5 C 16 11.5, 14 11.5, 13.5 12.5 Z" fill="#DC2626" stroke="none"/>
    </svg>
  ),
  // Mafia — венецианская карнавальная маска (Domino/Colombina)
  // Симметричная, с миндалевидными прорезями глаз, плавный V-вырез снизу,
  // плюс лёгкий орнамент по бровям и завитки на висках
  mafia: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      {/* Цилиндр — классическая шляпа мафиози */}
      {/* Тулья (верх) */}
      <rect x="6.5" y="3" width="11" height="13" rx="0.8"/>
      {/* Поля шляпы */}
      <ellipse cx="12" cy="16.5" rx="9" ry="1.6"/>
      {/* Лента вокруг тульи */}
      <rect x="6.5" y="13" width="11" height="2" fill="rgba(0,0,0,0.25)"/>
    </svg>
  ),
  // Chess — силуэт шахматного коня (как фигура с доски)
  chess: (
    <svg width="32" height="32" viewBox="0 0 45 45" fill="currentColor">
      {/* Классический Cburnett knight — узнаваемая фигура коня */}
      <path d="M 22 10 C 32.5 11, 38.5 18, 38 39 L 15 39 C 15 30, 25 32.5, 23 18 Z"/>
      <path d="M 24 18 C 24.38 20.91, 18.45 25.37, 16 27 C 13 29, 13.18 31.34, 11 31
               C 9.958 30.06, 12.41 27.96, 11 28 C 10 28, 11.19 29.23, 10 30
               C 9 30, 5.997 31, 6 26 C 6 24, 12 14, 12 14 C 12 14, 13.89 12.1, 14 10.5
               C 13.27 9.506, 13.5 8.5, 13.5 7.5 C 14.5 5.5, 16.5 4, 16.5 4
               C 18 4, 17.95 5.7, 18.5 5.5 C 19.49 5.099, 19.51 4.4, 20.5 4
               C 22 4, 22 5, 22.5 5 C 23.5 5, 24.5 4, 24.5 4 Z"/>
      {/* Глаз */}
      <circle cx="9.5" cy="25.5" r="1.2" fill="#fff"/>
      {/* Подставка */}
      <rect x="9" y="39" width="30" height="3" rx="0.5"/>
    </svg>
  ),
  // Crocodile — карточка со словом и лёгкой меткой-жестом
  alias: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="5" y="6" width="22" height="20" rx="6" stroke="currentColor" strokeWidth="2.2"/>
      <path d="M10 12.5h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M10 17h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="23.5" cy="22.5" r="4" fill="currentColor" opacity=".16"/>
      <path d="M21.6 22.6c1.1-.8 2.1-1.8 3.2-3.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  // Pixel — 3×3 сетка с шахматной заливкой (пиксель-арт)
  pixel: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2.5"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="3" y1="15" x2="21" y2="15"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
      <line x1="15" y1="3" x2="15" y2="21"/>
      {/* Заполненные клетки (диагональ + центр) */}
      <rect x="3.5" y="3.5" width="5" height="5" fill="currentColor" stroke="none"/>
      <rect x="9.5" y="9.5" width="5" height="5" fill="currentColor" stroke="none"/>
      <rect x="15.5" y="15.5" width="5" height="5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  // Truth or Dare — две карты/плашки выбора
  tod: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="6" y="9" width="10" height="14" rx="4" stroke="currentColor" strokeWidth="2.1"/>
      <rect x="16" y="9" width="10" height="14" rx="4" stroke="currentColor" strokeWidth="2.1" opacity=".75"/>
      <path d="M11 13.2h0" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round"/>
      <path d="M20.2 12.2 22 14l1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20.2 15.4 22 17.2l1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

interface GameItem {
  id: string;
  title: string;
  icon: ReactNode;
  bg: string;
  to?: string;
  disabled?: boolean;
}


const GAMES: GameItem[] = [
  { id: 'alias', title: 'Crocodile', icon: I.alias, bg: '#059669', to: '/alias' },
  { id: 'chess', title: 'Chess',  icon: I.chess, bg: '#312E81', to: '/chess' },
  { id: 'tod',   title: 'Truth or Dare', icon: I.tod, bg: '#DC2626', to: '/tod' },
];

export default function Games() {
  const nav = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div className="safe-top" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'transparent',
      }}>
        <button onClick={() => nav(-1)} style={{
          width: 40, height: 40, borderRadius: 20, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-1)',
        }} aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <div style={{ fontSize: 'var(--fs-title)', fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--text)' }}>Игры</div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 1 }}>Быстрые виджеты и локальные игры</div>
        </div>
      </div>

      <div className="page-scroll" style={{ padding: '12px 16px 24px' }}>
        <div
          className={sessionStorage.getItem('gamesAnimated') ? '' : 'anim-stagger'}
          ref={() => sessionStorage.setItem('gamesAnimated', '1')}
          style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}
        >
          {GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => g.disabled ? null : g.to && nav(g.to)}
              disabled={g.disabled}
              className="tap-effect"
              style={{
                width: '100%',
                minHeight: 116,
                background: 'linear-gradient(180deg,var(--surface),var(--surface-light))',
                border: '1px solid var(--border)',
                borderRadius: 22,
                padding: 16,
                cursor: g.disabled ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                opacity: g.disabled ? 0.55 : 1,
                textAlign: 'left',
                color: 'var(--text)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 18, background: g.bg + '16', color: g.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid ' + g.bg + '24' }}>{g.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-heading)', color: 'var(--text)', fontWeight: 800, letterSpacing: '-0.2px' }}>{g.title}</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 4 }}>{g.id === 'alias' ? 'Свои категории и быстрые раунды' : g.id === 'tod' ? 'Правда, действие и свои колоды' : 'Локальная игра на двоих'}</div>
              </div>
              {g.disabled
                ? <span style={{ fontSize: 'var(--fs-snap10)', fontWeight: 700, color: 'var(--muted)', background: 'var(--surface-light)', padding: '4px 8px', borderRadius: 999, letterSpacing: 0.3 }}>СКОРО</span>
                : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
              }
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}