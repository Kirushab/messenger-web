// SVG-иконки картографических сервисов в стиле приложения
// Все стилизованы как круглые цветные плашки 32×32 с белым символом внутри.
import type { ReactNode } from 'react';

function PillBg({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div style={{
      width:32, height:32, borderRadius:8,
      background:color,
      display:'flex', alignItems:'center', justifyContent:'center',
      flexShrink:0,
    }}>
      {children}
    </div>
  );
}

export const YandexIcon = (
  <PillBg color="#FC3F1D">
    <span style={{color:'#fff', fontWeight:700, fontSize: 'var(--fs-heading)', fontFamily:'system-ui, -apple-system, sans-serif', letterSpacing:-0.5}}>Я</span>
  </PillBg>
);

export const AppleMapsIcon = (
  <PillBg color="linear-gradient(135deg, #34C759 0%, #007AFF 100%)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/>
    </svg>
  </PillBg>
);

export const GoogleMapsIcon = (
  <PillBg color="#4285F4">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/>
    </svg>
  </PillBg>
);

export const TwoGisIcon = (
  <PillBg color="#19BC9B">
    <span style={{color:'#fff', fontWeight:700, fontSize: 'var(--fs-label)', fontFamily:'system-ui, -apple-system, sans-serif', letterSpacing:-0.5}}>2ГИС</span>
  </PillBg>
);

export const CopyIcon = (
  <PillBg color="var(--surface-light)">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  </PillBg>
);
