import { useEffect, useRef, useState, type ReactNode } from 'react';
import { YandexIcon, AppleMapsIcon, GoogleMapsIcon, TwoGisIcon, CopyIcon } from './MapProviderIcons';

const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN as string | undefined;

interface Props {
  lat: number;
  lng: number;
  locationName?: string | null;
}

export default function EventInlineMap({ lat, lng, locationName }: Props) {
  const [showSheet, setShowSheet] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (document.documentElement.getAttribute('data-theme') as any) || 'dark';
  });

  // Реагируем на смену темы
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setTheme((document.documentElement.getAttribute('data-theme') as any) || 'dark');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  if (!MAPBOX_TOKEN) {
    return null;
  }

  const styleName = theme === 'dark' ? 'dark-v11' : 'streets-v12';
  // Статическая карта с пином
  const imgUrl =
    `https://api.mapbox.com/styles/v1/mapbox/${styleName}/static/` +
    `pin-l+EC4899(${lng},${lat})/` +
    `${lng},${lat},14,0/600x280@2x?access_token=${MAPBOX_TOKEN}`;

  return (
    <>
      <div
        onClick={() => setShowSheet(true)}
        style={{
          marginTop: 12,
          borderRadius: 14,
          overflow: 'hidden',
          cursor: 'pointer',
          position: 'relative',
          background: 'var(--surface-light)',
          height: 200,
        }}
      >
        <img
          src={imgUrl}
          alt="Карта"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {locationName && (
          <div style={{
            position: 'absolute',
            left: 10, right: 10, bottom: 10,
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(10px)',
            color: '#fff',
            borderRadius: 10,
            fontSize: 'var(--fs-label)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{locationName}</span>
          </div>
        )}
      </div>

      {showSheet && (
        <NavigatorSheet
          lat={lat}
          lng={lng}
          locationName={locationName}
          onClose={() => setShowSheet(false)}
        />
      )}
    </>
  );
}

// ============== Sheet выбора навигатора ==============

function NavigatorSheet({ lat, lng, locationName, onClose }: {
  lat: number; lng: number; locationName?: string | null; onClose: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => { startYRef.current = e.touches[0].clientY; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 80) onClose();
    else setDragY(0);
    startYRef.current = null;
  };

  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(`${lat}, ${lng}`);
      onClose();
    } catch {}
  };

  const q = locationName ? encodeURIComponent(locationName) : `${lat},${lng}`;

  const links: { id: string; label: string; icon: ReactNode; url: string }[] = [
    {
      id: 'yandex',
      label: 'Яндекс.Карты',
      icon: YandexIcon,
      url: `https://yandex.ru/maps/?pt=${lng},${lat}&z=15&l=map&text=${q}`,
    },
    {
      id: 'apple',
      label: 'Apple Maps',
      icon: AppleMapsIcon,
      url: `https://maps.apple.com/?ll=${lat},${lng}&q=${q}`,
    },
    {
      id: 'google',
      label: 'Google Maps',
      icon: GoogleMapsIcon,
      url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    },
    {
      id: '2gis',
      label: '2ГИС',
      icon: TwoGisIcon,
      url: `https://2gis.ru/geo/${lng},${lat}`,
    },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: `rgba(0,0,0,${Math.max(0.2, 0.55 - dragY/400)})`,
        display: 'flex', alignItems: 'flex-end',
        transition: 'background 0.15s',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          width: '100%',
          background: 'var(--surface)',
          color: 'var(--text)',
          borderRadius: '16px 16px 0 0',
          padding: '12px 0 max(20px, env(safe-area-inset-bottom, 20px))',
          transform: `translateY(${dragY}px)`,
          transition: dragY === 0 ? 'transform 0.2s' : 'none',
          touchAction: 'none',
        }}
      >
        <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        {locationName && (
          <div style={{padding:'4px 16px 10px'}}>
            <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600, marginBottom:2, lineHeight:1.3, color:'var(--text)'}}>
              {locationName}
            </div>
            <div style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', fontVariantNumeric:'tabular-nums'}}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
          </div>
        )}

        <div style={{borderTop:'1px solid var(--border)'}}>
          {links.map(l => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              style={{
                display:'flex',alignItems:'center',gap:14,
                padding:'14px 18px',
                color:'var(--text)',textDecoration:'none',
                borderBottom:'0.5px solid var(--border)',
                fontSize: 'var(--fs-body)',
              }}
            >
              <span style={{display:'flex',alignItems:'center'}}>{l.icon}</span>
              <span style={{flex:1}}>{l.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </a>
          ))}
          <button
            onClick={copyCoords}
            style={{
              display:'flex',alignItems:'center',gap:14,
              padding:'14px 18px',width:'100%',
              background:'none',border:'none',cursor:'pointer',
              color:'var(--text)',fontSize: 'var(--fs-body)',textAlign:'left',
            }}
          >
            {CopyIcon}
            <span>Скопировать координаты</span>
          </button>
        </div>
      </div>
    </div>
  );
}
