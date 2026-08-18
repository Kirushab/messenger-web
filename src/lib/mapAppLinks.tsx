import type { ReactNode } from 'react';

// Бренд-бейджи внешних карт (простые монохромные, узнаваемые по форме/букве)
const badge = (bg: string, child: ReactNode) => (
  <span style={{ width: 34, height: 34, borderRadius: 10, background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 'var(--fs-body)' }}>{child}</span>
);

export type MapAppLink = { id: string; label: string; icon: ReactNode; url: string };

/** Ссылки «открыть в другом приложении». mode: view — точка, route — маршрут до точки. */
export function mapAppLinks(lat: number, lng: number, mode: 'view' | 'route' = 'view', routeMode: 'driving' | 'walking' = 'driving'): MapAppLink[] {
  const ll = `${lat},${lng}`;
  const googleTravelMode = routeMode === 'walking' ? 'walking' : 'driving';
  const appleDirFlag = routeMode === 'walking' ? 'w' : 'd';
  const yandexRouteMode = routeMode === 'walking' ? 'pd' : 'auto';
  return [
    {
      id: 'google', label: 'Google Карты',
      icon: badge('#1A73E8', <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>),
      url: mode === 'route'
        ? `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=${googleTravelMode}`
        : `https://www.google.com/maps/search/?api=1&query=${ll}`,
    },
    {
      id: 'apple', label: 'Apple Карты',
      icon: badge('#000000', <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M16.7 12.9c0-2.5 2-3.7 2.1-3.8-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.9-1.6 0-3.2 1-4 2.4-1.7 3-0.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2-.05 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.03-.01-2.6-1-2.7-3.7zM14.4 5.6c.7-.8 1.1-1.9 1-3-1 .04-2.1.7-2.8 1.5-.6.7-1.2 1.9-1 3 1 .1 2.1-.6 2.8-1.5z"/></svg>),
      url: mode === 'route'
        ? `https://maps.apple.com/?daddr=${ll}&dirflg=${appleDirFlag}`
        : `https://maps.apple.com/?ll=${ll}&q=${ll}`,
    },
    {
      id: 'yandex', label: 'Яндекс Карты',
      icon: badge('#FC3F1D', <span style={{ fontFamily: 'Arial, sans-serif' }}>Я</span>),
      url: mode === 'route'
        ? `https://yandex.ru/maps/?rtext=~${ll}&rtt=${yandexRouteMode}`
        : `https://yandex.ru/maps/?pt=${lng},${lat}&z=15&l=map`,
    },
    {
      id: '2gis', label: '2ГИС',
      icon: badge('#19AA1E', <span style={{ fontFamily: 'Arial, sans-serif', fontSize: 'var(--fs-caption)' }}>2Г</span>),
      url: `https://2gis.ru/geo/${lng},${lat}`,
    },
  ];
}
