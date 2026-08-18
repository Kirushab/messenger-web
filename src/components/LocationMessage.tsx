import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import ReadChecks from './ReadChecks';
import { YandexIcon, AppleMapsIcon, GoogleMapsIcon, TwoGisIcon } from './MapProviderIcons';
import { haptic } from '@/lib/haptics';
import { useNavigate } from 'react-router-dom';

const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN as string | undefined;

interface Coords { lat: number; lng: number; }

interface Props {
  content: string;
  isMine: boolean;
  time?: string;
  isRead?: boolean;
  onDelete?: () => void;
}

// Простой in-memory cache адресов
const addressCache = new Map<string, string>();

function parseLocation(content: string): Coords | null {
  try {
    const p = JSON.parse(content);
    if (typeof p.lat === 'number' && typeof p.lng === 'number') return p;
  } catch {}
  // Fallback: legacy формат "📍 Моя геолокация: https://www.google.com/maps/search/?api=1&query=LAT,LNG"
  const match = content.match(/[?&]query=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  return null;
}

export default function LocationMessage({ content, isMine, time, isRead, onDelete }: Props) {
  const coords = parseLocation(content);
  const [address, setAddress] = useState<string | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [showOpenSheet, setShowOpenSheet] = useState(false);

  // Reverse geocoding
  useEffect(() => {
    if (!coords || !MAPBOX_TOKEN) return;
    const key = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
    if (addressCache.has(key)) {
      setAddress(addressCache.get(key)!);
      return;
    }
    const ctrl = new AbortController();
    setAddrLoading(true);
    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?access_token=${MAPBOX_TOKEN}&language=ru&limit=1`,
      { signal: ctrl.signal }
    )
      .then(r => r.json())
      .then(data => {
        const place = data?.features?.[0]?.place_name as string | undefined;
        if (place) {
          addressCache.set(key, place);
          setAddress(place);
        }
      })
      .catch(() => {})
      .finally(() => setAddrLoading(false));
    return () => ctrl.abort();
  }, [coords?.lat, coords?.lng]);

  if (!coords) {
    return <span style={{fontSize: 'var(--fs-label)', color:'var(--muted)'}}>Геолокация (формат не распознан)</span>;
  }

  // Mapbox Static Image (по теме)
  const themeStyle = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light')
    ? 'streets-v12' : 'dark-v11';
  const staticUrl = MAPBOX_TOKEN
    ? `https://api.mapbox.com/styles/v1/mapbox/${themeStyle}/static/pin-l+3B82F6(${coords.lng},${coords.lat})/${coords.lng},${coords.lat},14,0/300x180@2x?access_token=${MAPBOX_TOKEN}`
    : null;
  const sheetMapUrl = MAPBOX_TOKEN
    ? `https://api.mapbox.com/styles/v1/mapbox/${themeStyle}/static/pin-l+3B82F6(${coords.lng},${coords.lat})/${coords.lng},${coords.lat},15,0/640x320@2x?access_token=${MAPBOX_TOKEN}`
    : null;

  return (
    <>
      <div
        onClick={(e) => { e.stopPropagation(); (document.activeElement as HTMLElement)?.blur?.(); setShowOpenSheet(true); }}
        style={{
          width: 240,
          maxWidth: '100%',
          cursor: 'pointer',
          margin: '4px 0 2px',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.2)',
          position: 'relative',
        }}
      >
        {staticUrl ? (
          <>
            {!thumbLoaded && <div className="geo-shimmer" style={{ height: 160, zIndex: 0 }} />}
            <img
              src={staticUrl}
              alt="Геолокация"
              style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block', position: 'relative', zIndex: 1 }}
              onLoad={() => setThumbLoaded(true)}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; setThumbLoaded(true); }}
            />
            <div className="geo-thumb-scrim">
              <div className="geo-thumb-addr">{address || (addrLoading ? 'Определяем адрес…' : 'Геолокация')}</div>
            </div>
          </>
        ) : (
          <div className="geo-fallback" style={{ height: 160 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="#3B82F6" stroke="#fff" strokeWidth="1.4"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/></svg>
            <span className="co">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
          </div>
        )}

        {/* Время полупрозрачно в углу */}
        {time && (
          <div style={{
            position: 'absolute', right: 8, bottom: 8,
            background: 'rgba(0,0,0,0.45)',
            color: '#fff', fontSize: 'var(--fs-micro)',
            padding: '2px 7px', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 4,
            pointerEvents: 'none',
          }}>
            {time}
            {isMine && <ReadChecks read={!!isRead} size={11} />}
          </div>
        )}

        {/* Кнопка удалить для своих геолокаций — pill-style красный */}
        {isMine && onDelete && (
          <LocationDeleteButton onDelete={onDelete} />
        )}
      </div>

      {showOpenSheet && (
        <NavigatorSheet
          coords={coords}
          address={address}
          mapUrl={sheetMapUrl}
          addrLoading={addrLoading}
          onClose={() => setShowOpenSheet(false)}
        />
      )}
    </>
  );
}

function NavigatorSheet({ coords, address, mapUrl, addrLoading, onClose }: {
  coords: Coords;
  address: string | null;
  mapUrl: string | null;
  addrLoading?: boolean;
  onClose: () => void;
}) {
  const { lat, lng } = coords;
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => { setShown(true); haptic.select(); });
    return () => cancelAnimationFrame(r);
  }, []);
  const close = () => { setShown(false); setTimeout(onClose, 240); };

  const links: { id: string; label: string; icon: ReactNode; url: string }[] = [
    {
      id: 'google',
      label: 'Google',
      icon: GoogleMapsIcon,
      url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    },
    {
      id: 'apple',
      label: 'Apple',
      icon: AppleMapsIcon,
      url: `https://maps.apple.com/?ll=${lat},${lng}&q=${address ? encodeURIComponent(address) : `${lat},${lng}`}`,
    },
    {
      id: 'yandex',
      label: 'Яндекс',
      icon: YandexIcon,
      url: `https://yandex.ru/maps/?pt=${lng},${lat}&z=15&l=map`,
    },
    {
      id: '2gis',
      label: '2ГИС',
      icon: TwoGisIcon,
      url: `https://2gis.ru/geo/${lng},${lat}`,
    },
  ];

  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(`${lat}, ${lng}`);
      haptic.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  // Drag-to-dismiss (pointer: touch + мышь)
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const onPointerDown = (e: React.PointerEvent) => { draggingRef.current = true; startYRef.current = e.clientY; };
  const onPointerMove = (e: React.PointerEvent) => { if (!draggingRef.current) return; const dy = e.clientY - startYRef.current; if (dy > 0) setDragY(dy); };
  const onPointerUp = () => { if (!draggingRef.current) return; draggingRef.current = false; if (dragY > 80) close(); else setDragY(0); };

  return createPortal(
    <div className="geo-overlay" onClick={close} style={{ background: `rgba(0,0,0,${shown ? Math.max(0.15, 0.6 - dragY / 400) : 0})`, transition: 'background 0.24s ease' }}>
      <div
        className="geo-sheet"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: shown ? `translateY(${dragY}px)` : 'translateY(100%)', transition: draggingRef.current ? 'none' : 'transform 0.28s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div className="geo-grab" />

        {mapUrl && (
          <div className="geo-map">
            <img src={mapUrl} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}

        <div style={{ padding: '4px 18px 12px' }}>
          <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, marginBottom: 3 }}>{address || (addrLoading ? 'Определяем адрес…' : 'Геолокация')}</div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{lat.toFixed(5)}, {lng.toFixed(5)}</div>
        </div>

        <div className="geo-body">
          <button className="geo-route" onClick={() => { haptic.select(); nav('/map', { state: { routeTo: { lat, lng } } }); }} style={{ width: '100%', border: 'none', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            Построить маршрут
          </button>

          <button className={'geo-copy' + (copied ? ' done' : '')} onClick={copyCoords}>
            {copied
              ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
            <span>{copied ? 'Скопировано' : 'Скопировать координаты'}</span>
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

// ⋮-кнопка в углу геолокации, раскрывающаяся в красную pill «Удалить».
// stopPropagation на всех событиях — чтобы не открывался NavigatorSheet
// при тапе по кнопке.
function LocationDeleteButton({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label="Меню"
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 3,
          width: 28, height: 28, borderRadius: '50%',
          aspectRatio: '1 / 1', boxSizing: 'border-box', padding: 0,
          background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      </button>
      {open && (
        <div
          className="location-message-menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="location-message-menu-danger"
            onClick={async (e) => {
              e.stopPropagation();
              setOpen(false);
              if (!confirm('Удалить геолокацию?')) return;
              try { onDelete(); } catch {}
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            <span>Удалить</span>
          </button>
        </div>
      )}
    </>
  );
}
