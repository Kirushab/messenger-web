import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useEventsStore } from '@/stores/eventsStore';
import LocationAutocomplete from '@/components/LocationAutocomplete';

const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN as string | undefined;
if (MAPBOX_TOKEN) (mapboxgl as any).accessToken = MAPBOX_TOKEN;

interface Waypoint {
  id: string;
  event_id: string;
  sort_order: number;
  title: string;
  description: string | null;
  lat: number;
  lng: number;
  arrival_at: string | null;
  departure_at: string | null;
}

export default function EventRoute() {
  const { id } = useParams();
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { events } = useEventsStore();
  const event = id ? events[id] : undefined;

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState<{ lat?: number; lng?: number } | false>(false);

  // Drag-and-drop reorder
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const dragStartYRef = useRef<number>(0);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Refs для map click closure — useEffect[] фиксирует closure при mount,
  // а isCreator/myId могут прийти позже.
  const myIdRef = useRef<string | undefined>(myId);
  const eventCreatorRef = useRef<string | undefined>(event?.creator_id);
  useEffect(() => { myIdRef.current = myId; }, [myId]);
  useEffect(() => { eventCreatorRef.current = event?.creator_id; }, [event?.creator_id]);

  const isCreator = myId && event && myId === event.creator_id;

  // Загружаем waypoints
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('event_waypoints')
        .select('*')
        .eq('event_id', id)
        .order('sort_order', { ascending: true });
      setWaypoints((data || []) as any);
      setLoading(false);
    })();
  }, [id]);

  // Realtime для waypoints
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel('waypoints_' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_waypoints', filter: `event_id=eq.${id}` }, () => {
        // На любое изменение перезагружаем
        supabase
          .from('event_waypoints')
          .select('*')
          .eq('event_id', id)
          .order('sort_order', { ascending: true })
          .then(({ data }) => setWaypoints((data || []) as any));
      })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [id]);

  // Инициализация карты
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !MAPBOX_TOKEN) return;
    const initialCenter: [number, number] = waypoints.length > 0
      ? [waypoints[0].lng, waypoints[0].lat]
      : [37.6173, 55.7558];  // Москва по умолчанию

    const getMapStyle = () => {
      const theme = document.documentElement.getAttribute('data-theme') || 'dark';
      return theme === 'light'
        ? 'mapbox://styles/mapbox/streets-v12'
        : 'mapbox://styles/mapbox/dark-v11';
    };

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: getMapStyle(),
      center: initialCenter,
      zoom: 4,
      attributionControl: false,
    });
    // Маленькая attribution внизу (требование лицензии), без +/- кнопок
    mapRef.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

    // Тап по карте → добавить точку (только creator). Click срабатывает только
    // на «клик» — drag/pan не триггерится, поэтому не мешает свайпу карты.
    mapRef.current.on('click', (e) => {
      if (!myIdRef.current || !eventCreatorRef.current) return;
      if (myIdRef.current !== eventCreatorRef.current) return;
      setShowAdd({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    // Следим за сменой темы
    const themeObserver = new MutationObserver(() => {
      if (mapRef.current) mapRef.current.setStyle(getMapStyle());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    (mapRef.current as any)._sigmasThemeObserver = themeObserver;
  }, []);

  // Отрисовка маркеров и линии
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    // Удаляем предыдущие маркеры
    markersRef.current.forEach(mk => mk.remove());
    markersRef.current = [];

    if (waypoints.length === 0) return;

    // Новые маркеры
    waypoints.forEach((wp, i) => {
      const el = document.createElement('div');
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.borderRadius = '14px';
      el.style.background = '#3B82F6';
      el.style.color = '#fff';
      el.style.fontSize = '13px';
      el.style.fontWeight = '700';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.3)';
      el.style.cursor = 'pointer';
      el.textContent = String(i + 1);

      const popup = new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(
        `<div style="font-size:13px;color:#000;"><b>${wp.title}</b>${wp.description ? `<br>${wp.description}` : ''}</div>`
      );
      const marker = new mapboxgl.Marker(el)
        .setLngLat([wp.lng, wp.lat])
        .setPopup(popup)
        .addTo(m);
      markersRef.current.push(marker);
    });

    // Подгоняем view под все точки
    if (waypoints.length === 1) {
      m.flyTo({ center: [waypoints[0].lng, waypoints[0].lat], zoom: 12 });
    } else {
      const bounds = new mapboxgl.LngLatBounds();
      waypoints.forEach(wp => bounds.extend([wp.lng, wp.lat]));
      m.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 800 });
    }

    // Линия маршрута через source/layer
    const data: any = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: waypoints.map(w => [w.lng, w.lat]),
      },
    };

    const drawRoute = () => {
      if (!m.isStyleLoaded()) {
        m.once('load', drawRoute);
        return;
      }
      if (m.getSource('route')) {
        (m.getSource('route') as any).setData(data);
      } else {
        m.addSource('route', { type: 'geojson', data } as any);
        m.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#3B82F6',
            'line-width': 3,
            'line-dasharray': [2, 2],
          },
        });
      }
    };
    drawRoute();
  }, [waypoints]);

  // Очистка карты
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const handleDelete = async (waypointId: string) => {
    if (!confirm('Удалить точку маршрута?')) return;
    await supabase.from('event_waypoints').delete().eq('id', waypointId);
  };

  // ============ Drag-reorder ============
  // Pointer events: захват хэндла (☰), pointermove определяет hover-индекс,
  // pointerup — батч-обновление sort_order. Используем locale-only state, чтобы
  // визуальная перестановка была мгновенной; реальный sort_order летит в БД фоном.

  const onDragStart = (idx: number) => (e: React.PointerEvent) => {
    if (!isCreator) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartYRef.current = e.clientY;
    setDraggingIdx(idx);
    setHoverIdx(idx);
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (draggingIdx === null) return;
    // Определяем над каким item сейчас стоит указатель: бежим по DOM-нодам
    // элементов списка и сравниваем clientY с их bounding boxes.
    const items = document.querySelectorAll<HTMLElement>('[data-wp-idx]');
    let newHover = draggingIdx;
    for (const it of items) {
      const rect = it.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const i = parseInt(it.dataset.wpIdx || '-1', 10);
        if (i >= 0) newHover = i;
        break;
      }
    }
    if (newHover !== hoverIdx) setHoverIdx(newHover);
  };

  const onDragEnd = async (e: React.PointerEvent) => {
    if (draggingIdx === null || hoverIdx === null) {
      setDraggingIdx(null); setHoverIdx(null);
      return;
    }
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}

    const from = draggingIdx;
    const to = hoverIdx;
    setDraggingIdx(null); setHoverIdx(null);
    if (from === to) return;

    // Локальная перестановка для мгновенной обратной связи
    const reordered = [...waypoints];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setWaypoints(reordered);

    // Батч-обновление sort_order: проще всего одной транзакцией через RPC,
    // но если RPC нет — последовательно update'им только те строки, у которых
    // sort_order реально изменился.
    const updates = reordered
      .map((wp, i) => ({ id: wp.id, newOrder: i }))
      .filter((u, i) => waypoints.find(w => w.id === u.id)?.sort_order !== u.newOrder
        && reordered[i].sort_order !== u.newOrder); // защитная фильтрация

    await Promise.all(
      reordered.map((wp, i) =>
        supabase.from('event_waypoints')
          .update({ sort_order: i })
          .eq('id', wp.id)
      )
    );
    // Realtime подписка перезагрузит окончательный порядок из БД.
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div className="page-header" style={{display:'flex',alignItems:'center',gap:12,paddingBottom:8}}>
        <button onClick={() => nav(-1)} style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6,marginLeft:-6,fontSize: 'var(--fs-title)',lineHeight:1}}>‹</button>
        <h1 style={{fontSize: 'var(--fs-title)', textTransform:'none', letterSpacing:0, flex:1}}>Маршрут</h1>
        {isCreator && (
          <button
            onClick={() => setShowAdd({})}
            aria-label="Добавить точку"
            style={{background:'var(--primary)', color:'var(--bg)', border:'none', width:38, height:38, borderRadius:19, fontSize: 'var(--fs-snap24)', fontWeight:300, lineHeight:1, cursor:'pointer'}}
          >+</button>
        )}
      </div>

      {/* Map area */}
      <div style={{padding:'0 12px 12px'}}>
        <div ref={mapContainer} style={{
          width:'100%',
          height:280,
          background:'var(--surface-light)',
          borderRadius:14,
          overflow:'hidden',
          border:'1px solid var(--border)',
          position:'relative',
        }} />
      </div>

      {/* Waypoints list */}
      <div className="page-scroll" style={{flex:1, padding:'12px 16px 32px'}}>
        {loading && waypoints.length === 0 && (
          <div style={{display:'flex',justifyContent:'center',padding:24}}><div className="spinner" /></div>
        )}

        {!loading && waypoints.length === 0 && (
          <div style={{padding:'30px 16px', textAlign:'center', color:'var(--muted)', fontSize: 'var(--fs-label)'}}>
            Маршрут пока пустой
            {isCreator && <><br/>Нажмите "+" чтобы добавить первую точку</>}
          </div>
        )}

        {waypoints.map((wp, i) => {
          const isDragging = draggingIdx === i;
          const isHoverTarget = draggingIdx !== null && hoverIdx === i && draggingIdx !== i;
          return (
          <div key={wp.id} data-wp-idx={i} style={{
            display:'flex', gap:12, alignItems:'flex-start',
            padding:'10px 12px',
            background:'var(--surface-light)',
            border: isHoverTarget ? '1px dashed var(--primary)' : '1px solid var(--border)',
            borderRadius:10, marginBottom:6,
            position:'relative',
            opacity: isDragging ? 0.5 : 1,
            transition: 'opacity 0.15s, border-color 0.15s',
            // Когда тащим за хэндл — блокируем браузерный pan
            touchAction: draggingIdx !== null ? 'none' : 'auto',
          }}>
            <div style={{
              width:28, height:28, borderRadius:14,
              background:'#3B82F6', color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize: 'var(--fs-label)', fontWeight:700,
              flexShrink:0,
            }}>{i + 1}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600, color:'var(--text)', marginBottom:2}}>{wp.title}</div>
              {wp.description && (
                <div style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', lineHeight:1.3, marginBottom:2}}>{wp.description}</div>
              )}
              {(wp.arrival_at || wp.departure_at) && (
                <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)'}}>
                  {wp.arrival_at && (
                    <>прибытие {new Date(wp.arrival_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>
                  )}
                  {wp.arrival_at && wp.departure_at && ' · '}
                  {wp.departure_at && (
                    <>убытие {new Date(wp.departure_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>
                  )}
                </div>
              )}
            </div>
            {isCreator && (
              <>
                {/* Drag handle — захватывает pointer и блокирует скролл списка во время dnd */}
                <div
                  onPointerDown={onDragStart(i)}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragEnd}
                  onPointerCancel={onDragEnd}
                  aria-label="Перетащить"
                  style={{
                    padding:8, marginRight:-4,
                    color:'var(--muted)', cursor:'grab',
                    touchAction:'none', // не отдаём pan браузеру
                    display:'flex', alignItems:'center',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="7" x2="20" y2="7"/>
                    <line x1="4" y1="12" x2="20" y2="12"/>
                    <line x1="4" y1="17" x2="20" y2="17"/>
                  </svg>
                </div>
                <button
                  onClick={() => handleDelete(wp.id)}
                  aria-label="Удалить"
                  style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',padding:4,fontSize: 'var(--fs-heading)'}}
                >×</button>
              </>
            )}
          </div>
          );
        })}
      </div>

      {showAdd && id && isCreator && (
        <AddWaypointSheet
          eventId={id}
          nextSortOrder={waypoints.length > 0 ? waypoints[waypoints.length - 1].sort_order + 1 : 0}
          initialLat={typeof showAdd === 'object' ? showAdd.lat : undefined}
          initialLng={typeof showAdd === 'object' ? showAdd.lng : undefined}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function AddWaypointSheet({ eventId, nextSortOrder, initialLat, initialLng, onClose }: {
  eventId: string;
  nextSortOrder: number;
  initialLat?: number;
  initialLng?: number;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState<number | null>(initialLat ?? null);
  const [lng, setLng] = useState<number | null>(initialLng ?? null);
  const [arrivalAt, setArrivalAt] = useState('');
  const [departureAt, setDepartureAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromMapTap = initialLat != null && initialLng != null;

  const isValid = title.trim().length > 0 && lat !== null && lng !== null;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);

    const { error: err } = await supabase.from('event_waypoints').insert({
      event_id: eventId,
      sort_order: nextSortOrder,
      title: title.trim(),
      description: description.trim() || null,
      lat,
      lng,
      arrival_at: arrivalAt ? new Date(arrivalAt).toISOString() : null,
      departure_at: departureAt ? new Date(departureAt).toISOString() : null,
    });

    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    onClose();
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:60,
      background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',
        maxHeight:'92%',
        background:'var(--surface)',
        borderRadius:'16px 16px 0 0',
        padding:'12px 16px max(20px, env(safe-area-inset-bottom, 20px))',
        overflowY:'auto',
      }}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        <h3 style={{fontSize: 'var(--fs-heading)', fontWeight:600, margin:'0 0 16px', color:'var(--text)'}}>Точка маршрута</h3>

        {fromMapTap && (
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'8px 12px', marginBottom:14,
            background:'rgba(59,130,246,0.10)', border:'1px solid rgba(59,130,246,0.3)',
            borderRadius:10, color:'var(--text)', fontSize: 'var(--fs-caption)', lineHeight:1.4,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Координаты с карты: {initialLat?.toFixed(4)}, {initialLng?.toFixed(4)}
          </div>
        )}

        <Label>Название</Label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Тбилиси, отель"
          maxLength={120}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16}}
        />

        <Label>Локация</Label>
        <LocationAutocomplete
          value={title === '' ? '' : (lat ? title : '')}
          onChange={(text, latVal, lngVal) => {
            if (latVal !== undefined && lngVal !== undefined) {
              setLat(latVal);
              setLng(lngVal);
              if (!title) setTitle(text);
            }
          }}
          placeholder="Адрес или название места"
        />

        <Label optional>Описание</Label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Что там делаем"
          maxLength={300}
          rows={2}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16,resize:'vertical',fontFamily:'inherit'}}
        />

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16}}>
          <div>
            <Label optional>Прибытие</Label>
            <input
              type="datetime-local"
              value={arrivalAt}
              onChange={e => setArrivalAt(e.target.value)}
              style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-label)', fontFamily:'inherit'}}
            />
          </div>
          <div>
            <Label optional>Убытие</Label>
            <input
              type="datetime-local"
              value={departureAt}
              onChange={e => setDepartureAt(e.target.value)}
              style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-label)', fontFamily:'inherit'}}
            />
          </div>
        </div>

        {error && (
          <div style={{
            background:'rgba(239,68,68,0.1)', color:'#EF4444',
            padding:'10px 12px', borderRadius:8, fontSize: 'var(--fs-label)', marginBottom:12,
          }}>{error}</div>
        )}

        <div style={{display:'flex', gap:8}}>
          <button onClick={onClose} disabled={submitting} style={{flex:1,padding:'12px',background:'var(--surface-light)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)',fontSize: 'var(--fs-snap14)',fontWeight:500,cursor:'pointer'}}>Отмена</button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            style={{
              flex:2, padding:'12px',
              background: isValid ? 'var(--primary)' : 'var(--surface-light)',
              color: isValid ? 'var(--bg)' : 'var(--muted)',
              border:'none', borderRadius:10,
              fontSize: 'var(--fs-snap14)', fontWeight:600,
              cursor: isValid && !submitting ? 'pointer' : 'default',
            }}
          >{submitting ? 'Сохраняем...' : 'Добавить'}</button>
        </div>
      </div>
    </div>
  );
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{
      fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)',
      marginBottom:6, letterSpacing:0.3, textTransform:'uppercase',
    }}>
      {children}
      {optional && <span style={{textTransform:'none', fontWeight:500, marginLeft:6, opacity:0.7}}>(опц.)</span>}
    </div>
  );
}
