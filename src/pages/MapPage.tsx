import { useEffect, useRef, useState } from 'react';
import { goBack } from '@/lib/nav';
import { useLocation, useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
// mapbox-gl CSS импортируется глобально в main.tsx

import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useMapStore } from '@/stores/mapStore';
import { useMapPointsStore, categoryColor } from '@/stores/mapPointsStore';
import { CategoryIcon, categorySvgMarkup } from '@/lib/categoryIcons';
import { useEventsStore } from '@/stores/eventsStore';
import { IconCar, IconMapParty, IconMapPlane } from '@/components/icons/EventIcons';
import { mapAppLinks } from '@/lib/mapAppLinks';
import { useChatStore } from '@/stores/chatStore';
import { supabase, SUPABASE_URL } from '@/lib/supabase';
import FriendsBottomSheet from '@/components/FriendsBottomSheet';
import ZoomableImage from '@/components/ZoomableImage';
import AddPointSheet from '@/components/AddPointSheet';
import ShareLocationSheet from '@/components/ShareLocationSheet';
import { haptic, isHapticsOn, setHapticsOn } from '@/lib/haptics';
import { avatarColor } from '@/lib/utils';
import { diag } from '@/lib/diag';
import type { UserLocation } from '@/stores/mapStore';

const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN as string | undefined;

// Центр по умолчанию — Москва на городском зуме (видны отдельные маркеры, не кластер).
// Раньше был zoom=3 — это половина континента, на котором ВСЕ ближайшие точки
// сливались в один кластер и юзер не видел отдельных аватарок. Реальный приоритет
// инициализации: своя точка из стора → центр последней панорамы → fallback Москва.
const DEFAULT_CENTER: [number, number] = [37.6, 55.75];
const DEFAULT_ZOOM = 11; // ~город, на котором кластера в радиусе 5-10км не образуются

// Стили карты (режимы). 'auto' = по теме приложения (светлая/тёмная).
type MapStyleKey = 'auto' | 'streets' | 'dark' | 'satellite' | 'hybrid' | '3d';
type TravelMode = 'driving' | 'walking';

const travelModeLabel = (mode: TravelMode) => (mode === 'walking' ? 'Пешком' : 'На машине');
const directionsProfile = (mode: TravelMode) => (mode === 'walking' ? 'walking' : 'driving');

const routeLayerPaint = (mode: TravelMode) => {
  if (mode === 'walking') {
    return {
      casing: { 'line-color': 'rgba(17,24,39,0.18)', 'line-width': 8, 'line-opacity': 0.34, 'line-dasharray': [0.1, 2.15] },
      line: { 'line-color': '#5667FF', 'line-width': 5, 'line-opacity': 0.96, 'line-dasharray': [0.1, 2.1] },
    } as const;
  }
  return {
    casing: { 'line-color': '#0A1A33', 'line-width': 9, 'line-opacity': 0.55, 'line-dasharray': [1, 0.01] },
    line: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 0.95, 'line-dasharray': [1, 0.01] },
  } as const;
};

const applyRouteLayerStyle = (map: mapboxgl.Map, mode: TravelMode) => {
  const paint = routeLayerPaint(mode);
  if (map.getLayer('sig-route-casing')) {
    for (const [key, value] of Object.entries(paint.casing)) {
      map.setPaintProperty('sig-route-casing', key, value as any);
    }
  }
  if (map.getLayer('sig-route-line')) {
    for (const [key, value] of Object.entries(paint.line)) {
      map.setPaintProperty('sig-route-line', key, value as any);
    }
  }
};
const MAP_STYLE_URLS: Record<Exclude<MapStyleKey, 'auto'>, string> = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  hybrid: 'mapbox://styles/mapbox/satellite-streets-v12',
  '3d': 'mapbox://styles/mapbox/standard', // в Standard 3D-здания встроены, включаем наклоном
};
const MAP_STYLE_OPTIONS: { key: MapStyleKey; label: string }[] = [
  { key: 'auto', label: 'Схема' },
  { key: '3d', label: '3D' },
];

function flightStatusRu(s: string | null | undefined): string {
  if (s === 'en-route') return 'В полёте';
  if (s === 'scheduled') return 'По расписанию';
  if (s === 'landed') return 'Приземлился';
  return 'Рейс';
}

const FLIGHT_PLANE_PATH = 'M24 3.5C25.6 3.5 26.7 4.9 26.7 6.5V17.8L42.8 22.8V27.5L26.7 25.6V36.2L33.4 40.7V44L24 41.4L14.6 44V40.7L21.3 36.2V25.6L5.2 27.5V22.8L21.3 17.8V6.5C21.3 4.9 22.4 3.5 24 3.5Z';

function FlightFilterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g transform="rotate(38 24 24)">
        <path
          d={FLIGHT_PLANE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

// Точки дуги большого круга между двумя аэропортами (красивая изогнутая линия полёта)
function greatCircleArc(lng1: number, lat1: number, lng2: number, lat2: number, n = 72): number[][] {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const φ1 = lat1 * rad, λ1 = lng1 * rad, φ2 = lat2 * rad, λ2 = lng2 * rad;
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (!d || !isFinite(d)) return [[lng1, lat1], [lng2, lat2]];
  const out: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    out.push([Math.atan2(y, x) * deg, Math.atan2(z, Math.sqrt(x * x + y * y)) * deg]);
  }
  return out;
}

export default function MapPage() {
  const nav = useNavigate();
  const routerLoc = useLocation();
  const { session } = useAuthStore();
  const myId = session?.user?.id;

  const {
    locations, myLocation, loading,
    loadLocations, setMyLocation, removeMyLocation, setVisible,
    liveSharing, startLiveShare, stopLiveShare,
    subscribeRealtime, unsubscribeRealtime,
  } = useMapStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const forcedPinMarkerRef = useRef<mapboxgl.Marker | null>(null);
  // POI + события — отдельные маркеры, не трогают слой/кластеры людей
  const poiMarkersRef = useRef<mapboxgl.Marker[]>([]);
  // POI-маркеры по ключу (poi:id / ev:id) — чтобы подсвечивать активный пин
  const poiMarkerByIdRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  // Какие POI/события уже показаны — чтобы drop-in проигрывался только у новых пинов, а не у всех при каждом ререндере
  const seenPinsRef = useRef<Set<string>>(new Set());
  const { points: mapPoints, load: loadPoints, remove: removePoint } = useMapPointsStore();
  const events = useEventsStore(s => s.events);
  const loadEvents = useEventsStore(s => s.loadEvents);
  const [mapReady, setMapReady] = useState(false);
  const [poiPlacing, setPoiPlacing] = useState(false);
  const [poiCoords, setPoiCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [showPoiList, setShowPoiList] = useState(false);
  const [activeEvent, setActiveEvent] = useState<import('@/stores/eventsStore').SigEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ kind: 'place' | 'point' | 'friend'; name: string; lng: number; lat: number; icon?: string; color?: string; avatar?: string | null; point?: import('@/stores/mapPointsStore').MapPoint; loc?: UserLocation }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Единая точка входа в создание события: теперь создание запускается с карты.
  useEffect(() => {
    const params = new URLSearchParams(routerLoc.search);
    if (params.get('createEvent') !== '1') return;
    const type = params.get('type');
    nav('/events/new?from=map' + (type ? '&type=' + encodeURIComponent(type) : ''), { replace: true });
  }, [routerLoc.search, nav]);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchTimerRef = useRef<number | null>(null);
  const [recenterSpin, setRecenterSpin] = useState(0);
  const [editPoint, setEditPoint] = useState<import('@/stores/mapPointsStore').MapPoint | null>(null);
  const [layers, setLayers] = useState({ people: true, points: true, events: true, flights: false });
  const [shareTarget, setShareTarget] = useState<{ lat: number; lng: number; title?: string; eventId?: string } | null>(null);
  const [eta, setEta] = useState<number | null>(null); // минуты на машине до выбранной точки/события
  const [liveUntil, setLiveUntil] = useState<number | null>(null); // timestamp окончания эфира (null = бессрочно)
  const [liveDurPicker, setLiveDurPicker] = useState(false);
  const liveTimerRef = useRef<number | null>(null);

  // Тема карты: контролы-«стекло» подстраиваются под светлую/тёмную (карта меняет стиль по теме)
  const [mapTheme, setMapTheme] = useState<string>(() => (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null) || 'dark');
  useEffect(() => {
    const obs = new MutationObserver(() => setMapTheme(document.documentElement.getAttribute('data-theme') || 'dark'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  const isLightMap = mapTheme === 'light';
  const glassBg = isLightMap ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)';
  const glassBgStrong = isLightMap ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.55)';
  const glassFg = isLightMap ? '#1A1A1A' : '#fff';
  const glassEdge = isLightMap ? '1px solid rgba(0,0,0,0.10)' : 'none';
  const glassShadow = isLightMap ? '0 4px 14px rgba(0,0,0,0.14)' : '0 4px 12px rgba(0,0,0,0.3)';
  // Основные капсулы карты адаптируются к теме: в светлой теме остаются светлыми.
  const inkBg = isLightMap ? 'rgba(255,255,255,0.95)' : 'rgba(12,12,14,0.82)';
  const inkFg = isLightMap ? '#111827' : '#fff';
  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  const [activePoi, setActivePoi] = useState<import('@/stores/mapPointsStore').MapPoint | null>(null);

  const buildPersonMarkerElement = (loc: UserLocation, isForced = false) => {
    const userId = loc.user_id;
    const currentMyId = useAuthStore.getState().user?.id;
    const isMe = userId === currentMyId;
    const userMeta = loc.user || allUsers.find(u => u.id === userId) || null;
    const innerSize = isMe ? 38 : 34;
    const ringWidth = isMe ? 3 : 2;
    const ringColor = isForced ? '#EF4444' : (isMe ? (loc.visible ? '#3B82F6' : '#EF4444') : (loc.visible ? '#fff' : 'rgba(255,255,255,0.5)'));
    const el = document.createElement('div');
    el.style.cursor = 'pointer';
    el.style.position = 'relative';
    el.style.userSelect = 'none';
    el.style.touchAction = 'manipulation';
    el.style.borderRadius = '50%';
    const totalSize = innerSize + ringWidth * 2;
    el.style.width = totalSize + 'px';
    el.style.height = totalSize + 'px';
    el.style.boxSizing = 'border-box';

    const wrap = document.createElement('div');
    wrap.style.width = totalSize + 'px';
    wrap.style.height = totalSize + 'px';
    wrap.style.borderRadius = '50%';
    wrap.style.background = '#000';
    wrap.style.border = `${ringWidth}px solid ${ringColor}`;
    wrap.style.boxShadow = isForced ? '0 0 0 4px rgba(239,68,68,0.18), 0 6px 18px rgba(0,0,0,0.35)' : '0 2px 6px rgba(0,0,0,0.45)';
    if (!isForced) wrap.classList.add('map-marker-drop');
    if (isMe) wrap.classList.add('map-me-ring');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.overflow = 'hidden';

    if (userMeta?.avatar_url) {
      const img = document.createElement('img');
      img.src = userMeta.avatar_url;
      img.alt = '';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '50%';
      wrap.appendChild(img);
    } else {
      const initial = (userMeta?.display_name || loc.user?.display_name || '?')[0].toUpperCase();
      const init = document.createElement('div');
      init.textContent = initial;
      init.style.color = '#fff';
      init.style.fontWeight = '600';
      init.style.fontSize = '14px';
      init.style.width = '100%';
      init.style.height = '100%';
      init.style.borderRadius = '50%';
      init.style.display = 'flex';
      init.style.alignItems = 'center';
      init.style.justifyContent = 'center';
      init.style.background = avatarColor(userId);
      wrap.appendChild(init);
    }

    el.appendChild(wrap);
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const fresh = useMapStore.getState().locations.find(l => l.user_id === userId) || loc;
      haptic.tap();
      setSearchFocusPin(fresh);
      setActivePin(fresh);
    });
    return el;
  };

  const [placingMode, setPlacingMode] = useState(false);
  const [locationPromptCollapsed, setLocationPromptCollapsed] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{lng: number; lat: number} | null>(null);
  const [activePin, setActivePin] = useState<UserLocation | null>(null);
  const [searchFocusPin, setSearchFocusPin] = useState<UserLocation | null>(null);
  // Прокладка маршрута внутри Mapbox
  const [routePrompt, setRoutePrompt] = useState<{ lng: number; lat: number; title?: string } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    dist: number;
    dur: number;
    origin: { lat: number; lng: number };
    originLabel: string;
    dest?: { lat: number; lng: number };
    mode: TravelMode;
  } | null>(null);
  const [openInFor, setOpenInFor] = useState<{ lat: number; lng: number } | null>(null); // шит «Открыть в другом приложении»
  const [coordsCopied, setCoordsCopied] = useState(false);
  const routeToHandledRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const [photoViewer, setPhotoViewer] = useState<{ src: string; alt?: string } | null>(null);
  // Стиль карты (режим) + навигатор
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('auto');
  const mapStyleRef = useRef<MapStyleKey>('auto');
  const [navMode, setNavMode] = useState(false);
  const [navCameraMode, setNavCameraMode] = useState<'3d' | 'scheme'>('3d');
  const [navTravelMode, setNavTravelModeState] = useState<TravelMode>('driving');
  const navTravelModeRef = useRef<TravelMode>('driving');
  const setNavTravelMode = (next: TravelMode) => {
    navTravelModeRef.current = next;
    setNavTravelModeState(next);
  };
  const [navFollowing, setNavFollowing] = useState(true);
  const navFollowingRef = useRef(true);
  const setNavFollow = (next: boolean) => {
    navFollowingRef.current = next;
    setNavFollowing(next);
  };
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'half' | 'full'>('peek'); // раскрыта ли нижняя шторка друзей
  const layerStripRef = useRef<HTMLDivElement>(null);
  const setLayerStripMotion = (progress: number) => {
    const el = layerStripRef.current;
    if (!el) return;
    const dismiss = Math.max(0, Math.min(1, (progress - 0.025) / 0.11));
    el.style.opacity = String(1 - dismiss);
    el.style.transform = `translate3d(0, ${-12 * dismiss}px, 0) scale(${1 - 0.045 * dismiss})`;
    el.style.pointerEvents = progress > 0.075 ? 'none' : 'auto';
  };
  const [activeFlight, setActiveFlight] = useState<any | null>(null);     // тапнутый борт (карточка)
  const [flightWho, setFlightWho] = useState<{ name: string; seat: string | null }[]>([]);
  const routeGeoRef = useRef<any>(null);          // geojson активного маршрута (для пере-добавления после смены стиля)
  const routeStartMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const preNavStyleRef = useRef<MapStyleKey>('auto');
  const clusterHandlersRef = useRef(false);        // обработчики кластеров навешены
  const lastNavPosRef = useRef<{ lng: number; lat: number } | null>(null);
  const navMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const navHeadingRef = useRef<number | null>(null);
  // Все юзеры Sigmas (для панели-списка) — грузим один раз
  const [allUsers, setAllUsers] = useState<{ id: string; display_name: string; avatar_url: string | null }[]>([]);

  // Sync placingMode в ref для use в map handler (объявляем ДО init-эффекта,
  // который ссылается на placingModeRef в обработчике клика — иначе TDZ в минифай-сборке).
  const placingModeRef = useRef(placingMode);
  useEffect(() => { placingModeRef.current = placingMode; }, [placingMode]);
  // То же для режима добавления точки интереса — чтобы обработчик клика по карте
  // (создаётся один раз) читал актуальное значение, а не «протухшее» из замыкания.
  const poiPlacingRef = useRef(poiPlacing);
  useEffect(() => { poiPlacingRef.current = poiPlacing; }, [poiPlacing]);

  // v58.14: иначе на iPhone в светлой теме под картой видна белая полоса
  // (safe-area-inset-bottom + viewport нюансы). Класс на body форсит чёрный фон
  // всех контейнеров layout пока юзер на карте.
  useEffect(() => {
    document.body.classList.add('map-fullscreen');
    return () => document.body.classList.remove('map-fullscreen');
  }, []);

  // Когда открыта светлая шторка карты (карточка события/рейса/точки и т.п.) — её
  // фон обрезается боксом карты и под ней в зоне home-indicator видна тёмная полоса.
  // Перекрашиваем фон контейнеров в --bg, чтобы полоса совпала со светлой шторкой
  // (в тёмной теме --bg чёрный — поведение не меняется). Шторка друзей сама fixed.
  const hasOpenMapPanel = !!(
    activeEvent || activeFlight || activePoi || activePin || poiCoords || shareTarget ||
    routePrompt || showSettings || showPoiList || fabOpen
  );

  useEffect(() => {
    const friendsSheetOpen = sheetSnap !== 'peek';
    document.body.classList.toggle('map-sheet-light', hasOpenMapPanel || (friendsSheetOpen && isLightMap));
    document.body.classList.toggle('map-sheet-dark', friendsSheetOpen && !isLightMap);
    return () => {
      document.body.classList.remove('map-sheet-light');
      document.body.classList.remove('map-sheet-dark');
    };
  }, [hasOpenMapPanel, sheetSnap, isLightMap]);

  // Список всех Sigmas для нижней панели
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .order('display_name', { ascending: true });
      if (data) setAllUsers(data as any);
    })();
  }, []);

  // Init map
  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    if (!containerRef.current) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const getMapStyle = () => {
      const key = mapStyleRef.current;
      if (key && key !== 'auto') return MAP_STYLE_URLS[key];
      const theme = document.documentElement.getAttribute('data-theme') || 'dark';
      return theme === 'light' ? MAP_STYLE_URLS.streets : MAP_STYLE_URLS.dark;
    };

    // Если в сторе уже есть наша точка (повторный заход на карту в сессии) —
    // стартуем прямо там, не на дефолтной Москве. Это снимает «полёт» и
    // гарантирует что маркер сразу окажется в видимой области.
    const storedMy = useMapStore.getState().myLocation;
    const initialCenter: [number, number] = storedMy
      ? [storedMy.lng, storedMy.lat]
      : DEFAULT_CENTER;
    const initialZoom = storedMy ? 13 : DEFAULT_ZOOM;
    diag('map.init', { hasStoredMy: !!storedMy, center: initialCenter, zoom: initialZoom });

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: getMapStyle(),
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });

    // Следим за сменой темы в реальном времени
    const themeObserver = new MutationObserver(() => {
      if (mapRef.current) {
        mapRef.current.setStyle(getMapStyle());
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    (map as any)._sigmasThemeObserver = themeObserver;

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    // NavigationControl убран — нет +/- кнопок, жесты для зума

    // Resize карты после load + через таймер. Часто на первом монтировании Mapbox
    // измеряет container до того, как родительский flex-layout даёт ему реальную высоту,
    // и rendered viewport получается 0×0 — маркеры тогда не видны до перезахода.
    map.on('load', () => {
      try { map.resize(); } catch {}
      setMapReady(true);
    });
    const resizeT1 = window.setTimeout(() => { try { map.resize(); } catch {} }, 100);
    const resizeT2 = window.setTimeout(() => { try { map.resize(); } catch {} }, 600);
    const resizeT3 = window.setTimeout(() => { try { map.resize(); } catch {} }, 1500);

    map.on('click', (e) => {
      // Если в режиме постановки своей метки — координаты прицела
      if (placingModeRef.current) {
        setPendingCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      } else if (poiPlacingRef.current) {
        // Тап по карте в режиме добавления точки интереса — ставим точку прямо сюда
        haptic.select();
        setPoiCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        setPoiPlacing(false);
      } else {
        // Иначе закрываем активную карточку (тап мимо)
        setActivePin(null);
      }
    });

    // Долгий тап по карте → быстро добавить точку (#2)
    let lpTimer: number | null = null;
    let lpPt: { lng: number; lat: number } | null = null;
    const lpStart = (e: any) => {
      if (e.originalEvent?.touches && e.originalEvent.touches.length > 1) return; // не на мультитач-жесте
      if (placingModeRef.current || poiPlacingRef.current) return;                // только в нейтральном режиме
      lpPt = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      if (lpTimer) clearTimeout(lpTimer);
      lpTimer = window.setTimeout(() => {
        lpTimer = null;
        if (lpPt) { haptic.success(); setActivePin(null); setActivePoi(null); setActiveEvent(null); setPoiCoords(lpPt); }
      }, 500);
    };
    const lpCancel = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } lpPt = null; };
    map.on('mousedown', lpStart);
    map.on('touchstart', lpStart);
    map.on('movestart', lpCancel);
    map.on('mouseup', lpCancel);
    map.on('touchend', lpCancel);
    map.on('touchcancel', lpCancel);
    map.on('dragstart', lpCancel);

    mapRef.current = map;

    return () => {
      try { themeObserver.disconnect(); } catch {}
      clearTimeout(resizeT1); clearTimeout(resizeT2); clearTimeout(resizeT3);
      try { map.remove(); } catch {}
      mapRef.current = null;
    };
  }, []);

  // Загружаем локации + подписываемся на realtime
  useEffect(() => {
    if (!myId) return;
    diag('map.loadLocations.start', { myId });
    loadLocations(myId).then((res: any) => {
      const st = useMapStore.getState();
      diag('map.loadLocations.done', {
        count: st.locations.length,
        sample: st.locations.slice(0, 3).map(l => ({ user_id: l.user_id.slice(0, 8), lng: l.lng, lat: l.lat, visible: l.visible })),
        myLocation: st.myLocation ? { lng: st.myLocation.lng, lat: st.myLocation.lat } : null,
      });
      return res;
    }).catch((e: any) => { diag('map.loadLocations.err', { error: e?.message }); });
    subscribeRealtime();
    return () => { unsubscribeRealtime(); };
  }, [myId]);

  // Загружаем точки интереса + события (для маркеров)
  useEffect(() => {
    if (!myId) return;
    loadPoints();
    loadEvents(myId);
  }, [myId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Рендер маркеров POI и событий (отдельно от слоя людей)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    poiMarkersRef.current.forEach(m => { try { m.remove(); } catch {} });
    poiMarkersRef.current = [];
    poiMarkerByIdRef.current.clear();

    const addMarker = (lng: number, lat: number, html: HTMLElement, onClick: () => void) => {
      html.style.cursor = 'pointer';
      html.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
      const m = new mapboxgl.Marker({ element: html, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
      poiMarkersRef.current.push(m);
      return m;
    };

    // Единый круглый маркер (овал) одного размера: emoji ИЛИ svg-иконка внутри, цветной фон, белая окантовка
    const makePin = (iconEmoji: string | null, iconSvg: string | null, bg: string, isNew: boolean, label?: string) => {
      const wrap = document.createElement('div'); // Mapbox позиционирует этот корень — анимации transform только на внутренний слой
      const anim = document.createElement('div');
      anim.className = 'map-pin-anim' + (isNew ? ' map-pin-drop' : '');
      const el = document.createElement('div');
      el.style.cssText = `width:40px;height:40px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.32),0 0 0 0.5px rgba(0,0,0,0.04);border:2.5px solid #fff;`;
      const inner = document.createElement('div');
      inner.style.cssText = 'display:flex;align-items:center;justify-content:center;color:#fff;line-height:0;';
      if (iconSvg) { inner.innerHTML = iconSvg; }
      else { inner.innerHTML = categorySvgMarkup('place'); }
      el.appendChild(inner);
      anim.appendChild(el);
      wrap.appendChild(anim);
      if (label) {
        const lab = document.createElement('div');
        lab.className = 'map-pin-label';
        lab.textContent = label;
        wrap.appendChild(lab); // показывается через .show-pin-labels на высоком зуме
      }
      return wrap;
    };

    const PLANE_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>';
    const PARTY_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M12 2l2.6 5.9 6.4.5-4.9 4.2 1.5 6.3L12 15.8 6.4 19.2l1.5-6.3L3 8.7l6.4-.5z"/></svg>';

    // POI
    if (layers.points) for (const p of mapPoints) {
      const isNew = !seenPinsRef.current.has('poi:' + p.id);
      seenPinsRef.current.add('poi:' + p.id);
      const m = addMarker(p.lng, p.lat, makePin(null, categorySvgMarkup(p.category), categoryColor(p.category), isNew, p.title), () => { haptic.tap(); setSheetSnap('peek'); setActivePin(null); setActiveEvent(null); setActiveFlight(null); setShowPoiList(false); setActivePoi(p); });
      poiMarkerByIdRef.current.set('poi:' + p.id, m);
    }

    // События с координатами
    if (layers.events) for (const ev of Object.values(events)) {
      if (ev.status !== 'active' || ev.location_lat == null || ev.location_lng == null) continue;
      const isParty = ev.type === 'party';
      const isNew = !seenPinsRef.current.has('ev:' + ev.id);
      seenPinsRef.current.add('ev:' + ev.id);
      const m = addMarker(ev.location_lng, ev.location_lat, makePin(null, isParty ? PARTY_SVG : PLANE_SVG, isParty ? '#EC4899' : '#2563EB', isNew, ev.title), () => { haptic.tap(); setSheetSnap('peek'); setActivePin(null); setActivePoi(null); setActiveFlight(null); setShowPoiList(false); setActiveEvent(ev); });
      poiMarkerByIdRef.current.set('ev:' + ev.id, m);
    }

    return () => {
      poiMarkersRef.current.forEach(m => { try { m.remove(); } catch {} });
      poiMarkersRef.current = [];
    };
  }, [mapReady, mapPoints, events, layers]); // eslint-disable-line react-hooks/exhaustive-deps


  // Если у юзера уже есть точка — мгновенно прыгаем к ней при первой загрузке.
  // Раньше был flyTo с duration=1500ms — но это плавный полёт со старого zoom 3
  // через zoom 1 в zoom 10, и пока он не закончится — точки в кластере, юзер
  // видит «маркеров нет». Сейчас jumpTo делает это мгновенно, без анимации.
  const flewToMineRef = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !myLocation || flewToMineRef.current) return;
    // Если карта уже стартанула в нашей точке (storedMy в init выше) — не дёргаемся
    const center = mapRef.current.getCenter();
    const alreadyClose = Math.hypot(center.lng - myLocation.lng, center.lat - myLocation.lat) < 0.01;
    if (alreadyClose) {
      flewToMineRef.current = true;
      return;
    }
    flewToMineRef.current = true;
    mapRef.current.jumpTo({
      center: [myLocation.lng, myLocation.lat],
      zoom: Math.max(mapRef.current.getZoom(), 12),
    });
    diag('map.jumpToMine', { center: [myLocation.lng, myLocation.lat] });
  }, [myLocation?.lng, myLocation?.lat]);

  // Init Mapbox source/layers для кластеризации.
  // ВАЖНО: вызывается и при первой загрузке, и после каждой смены стиля (setStyle),
  // т.к. setStyle сбрасывает все наши source/layer. Идемпотентно: проверяем getSource.
  const sourceInitedRef = useRef(false);
  const ensureMapLayers = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getSource('locations')) {
      map.addSource('locations', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 60,
      });
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'locations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#10B981',
          'circle-radius': ['step', ['get', 'point_count'], 20, 5, 26, 10, 32, 20, 40],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.95,
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'locations',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 14,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': '#fff' },
      });
    }
    // Обработчики кластеров вешаем один раз: они привязаны к id слоя и переживают
    // удаление/пересоздание слоя при смене стиля.
    if (!clusterHandlersRef.current) {
      map.on('click', 'clusters', (e: any) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!feats[0]) return;
        const clusterId = feats[0].properties?.cluster_id;
        const src = map.getSource('locations') as any;
        src.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          map.easeTo({ center: (feats[0].geometry as any).coordinates, zoom: zoom + 0.2, duration: 600 });
        });
      });
      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
      clusterHandlersRef.current = true;
    }
    // Восстанавливаем активный маршрут после смены стиля
    if (routeGeoRef.current && !map.getSource('sig-route')) {
      const routePaint = routeLayerPaint(navTravelModeRef.current);
      map.addSource('sig-route', { type: 'geojson', data: routeGeoRef.current });
      map.addLayer({ id: 'sig-route-casing', type: 'line', source: 'sig-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: routePaint.casing as any });
      map.addLayer({ id: 'sig-route-line', type: 'line', source: 'sig-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: routePaint.line as any });
      applyRouteLayerStyle(map, navTravelModeRef.current);
    }
    sourceInitedRef.current = true;
    diag('map.layers.ensured');
    // После инициализации источника — обновляем данные
    pushDataToSource();
    updateUnclusteredMarkers();
  };
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const run = () => ensureMapLayers();
    if (map.isStyleLoaded()) { diag('map.style.already-loaded'); run(); }
    else { diag('map.style.wait-load'); map.once('load', () => { diag('map.style.loaded'); run(); }); }
    // Пере-добавляем слои/маршрут после каждой смены стиля карты
    map.on('style.load', run);
    return () => { try { map.off('style.load', run); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обновление GeoJSON данных в source
  const pushDataToSource = () => {
    const map = mapRef.current;
    if (!map || !sourceInitedRef.current) {
      diag('map.push.skip', { hasMap: !!map, sourceInited: sourceInitedRef.current });
      return;
    }
    const src = map.getSource('locations') as any;
    if (!src) { diag('map.push.no-source'); return; }

    const allLocs = useMapStore.getState().locations;
    const currentMyId = useAuthStore.getState().user?.id;
    const LIVE_FRESH_MS = 120000; // live-точка считается актуальной 2 минуты
    const visibleNow = allLocs.filter(l => {
      if (!(l.visible || l.user_id === currentMyId)) return false;
      // Протухшая чужая live-точка (приложение закрыли) — скрываем
      if (l.is_live && l.user_id !== currentMyId && (Date.now() - new Date(l.updated_at).getTime() > LIVE_FRESH_MS)) return false;
      return true;
    });

    // Жёсткая валидация координат. Mapbox молча принимает [NaN, NaN] / [undefined, undefined]
    // и кладёт маркеры в (0,0) на canvas — это и есть «появились вне» (на самом деле
    // в углу карты, где их меньше всего ждёшь). Также проверяем что lng/lat не перепутаны.
    const skipped: any[] = [];
    const valid = visibleNow.filter(l => {
      const lng = Number(l.lng);
      const lat = Number(l.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) { skipped.push({ id: l.user_id, reason: 'NaN', lng: l.lng, lat: l.lat }); return false; }
      if (Math.abs(lng) > 180 || Math.abs(lat) > 90) { skipped.push({ id: l.user_id, reason: 'range', lng, lat }); return false; }
      if (lng === 0 && lat === 0) { skipped.push({ id: l.user_id, reason: 'null-island' }); return false; }
      return true;
    });

    const features = valid.map(l => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Number(l.lng), Number(l.lat)] },
      properties: { user_id: l.user_id },
    }));
    diag('map.push.data', {
      totalLocs: allLocs.length,
      visibleNow: visibleNow.length,
      valid: valid.length,
      skipped: skipped.length > 0 ? skipped : undefined,
      bounds: map.getBounds()?.toArray(),
      canvasSize: { w: map.getCanvas().clientWidth, h: map.getCanvas().clientHeight },
    });
    src.setData({ type: 'FeatureCollection', features });
  };

  // Обновление HTML маркеров для unclustered точек (с аватарами)
  const updateUnclusteredMarkers = () => {
    const map = mapRef.current;
    if (!map || !sourceInitedRef.current) return;

    // Слой людей выключен в фильтрах — убираем все аватар-маркеры и выходим
    if (!layersRef.current.people) {
      for (const m of markersRef.current.values()) { try { m.remove(); } catch {} }
      markersRef.current.clear();
      return;
    }

    // КРИТИЧНО: читаем locations из стора напрямую, а НЕ из closure компонента.
    // Эта функция может быть вызвана из ранних замыканий (setup() при загрузке стиля,
    // sourcedata-handler, attached в useEffect[] с пустыми deps), где locations
    // в closure — пустой массив с первого рендера. Тогда .find() возвращает undefined,
    // и маркеры не создаются. Это был баг «точки не появляются пока не перезайти».
    const storeLocations = useMapStore.getState().locations;
    const storeMyId = useAuthStore.getState().user?.id;

    let unclusteredFeats: any[];
    try {
      unclusteredFeats = map.querySourceFeatures('locations', {
        filter: ['!', ['has', 'point_count']],
      });
    } catch {
      return;
    }

    // Размер canvas — клампим только сильно outside (с большим margin).
    // Раньше был MARGIN=0, и маркеры на границе viewport пропадали при ресайзах canvas
    // (mobile keyboard, tab-bar refresh, safe-area). Сейчас даём 300px запаса —
    // Mapbox-контейнер сам обрежет overflow:hidden, маркеры за краем не будут видны.
    const canvas = map.getCanvas();
    const screenW = canvas.clientWidth;
    const screenH = canvas.clientHeight;
    const MARGIN = 300;

    const liveIds = new Set<string>();
    let invalidCount = 0;
    // В placingMode прячем СВОЙ существующий аватар-маркер — иначе на одной точке
    // оказываются два визуала: старая (avatar+ring) и новая draggable (синий шар),
    // что выглядит как «дубль кружком сверху»
    const placingNow = placingModeRef.current;
    for (const f of unclusteredFeats) {
      const userId = f.properties?.user_id;
      if (!userId || liveIds.has(userId)) continue;
      if (placingNow && userId === storeMyId) {
        // удалим уже добавленный маркер если он есть
        const m = markersRef.current.get(userId);
        if (m) { try { m.remove(); } catch {} markersRef.current.delete(userId); }
        continue;
      }

      const loc = storeLocations.find(l => l.user_id === userId);
      if (!loc) continue;

      const coords = (f.geometry as any).coordinates as [number, number];
      // Жёсткая проверка валидности перед map.project — иначе получим маркер в (0,0)
      // на canvas (визуально в углу карты, далеко от настоящей точки).
      if (!Array.isArray(coords) || coords.length !== 2
          || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])
          || Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) {
        invalidCount++;
        continue;
      }
      // Проецируем в пиксели и отсекаем всё, что за пределами видимого canvas
      const pt = map.project(coords);
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) { invalidCount++; continue; }
      if (pt.x < -MARGIN || pt.x > screenW + MARGIN || pt.y < -MARGIN || pt.y > screenH + MARGIN) {
        continue;
      }
      liveIds.add(userId);
      const existing = markersRef.current.get(userId);
      // Цвет/ширина кольца зависят от loc.visible — пересчитываем КАЖДЫЙ раз,
      // чтобы при toggle «скрыть/показать точку» обновление шло без перезахода.
      const isMe = userId === storeMyId;
      const innerSize = isMe ? 38 : 34;
      const ringColor = isMe
        ? (loc.visible ? '#3B82F6' : '#EF4444')
        : (loc.visible ? '#fff' : 'rgba(255,255,255,0.5)');
      const ringWidth = isMe ? 3 : 2;

      if (existing) {
        // Применим обновлённый бордер к wrap (inner div маркера) на лету
        const existingEl = existing.getElement();
        const wrapEl = existingEl?.firstElementChild as HTMLElement | null;
        if (wrapEl) {
          wrapEl.style.border = `${ringWidth}px solid ${ringColor}`;
        }

        // Плавная анимация перемещения (650мс)
        const startLngLat = existing.getLngLat();
        const fromLng = startLngLat.lng;
        const fromLat = startLngLat.lat;
        const toLng = coords[0];
        const toLat = coords[1];
        const dist = Math.hypot(toLng - fromLng, toLat - fromLat);
        if (dist < 0.00002) {
          existing.setLngLat(coords);
        } else {
          const start = performance.now();
          const dur = 650;
          const tween = (now: number) => {
            const t = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - t, 3);
            const lng = fromLng + (toLng - fromLng) * eased;
            const lat = fromLat + (toLat - fromLat) * eased;
            existing.setLngLat([lng, lat]);
            if (t < 1) requestAnimationFrame(tween);
          };
          requestAnimationFrame(tween);
        }
        continue;
      }

      const el = buildPersonMarkerElement(loc);

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(coords)
        .addTo(map);

      markersRef.current.set(userId, marker);
    }

    // Удаляем маркеры тех, кто сейчас в кластере
    for (const [id, m] of markersRef.current) {
      if (!liveIds.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }

    // Fail-safe: пробежать ещё раз по уже-существующим маркерам и удалить тех,
    // чья текущая позиция проецируется за пределы экрана (защита от случаев,
    // когда feature не вернулся из querySourceFeatures из-за выгрузки тайла,
    // но маркер всё ещё прилеплен к краю canvas)
    for (const [id, m] of markersRef.current) {
      const lngLat = m.getLngLat();
      const pt = map.project(lngLat);
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y) || pt.x < -MARGIN || pt.x > screenW + MARGIN || pt.y < -MARGIN || pt.y > screenH + MARGIN) {
        m.remove();
        markersRef.current.delete(id);
      }
    }
    diag('map.markers.update', {
      featsTotal: unclusteredFeats.length,
      featsLive: liveIds.size,
      featsInvalid: invalidCount,
      markersAfter: markersRef.current.size,
    });
  };

  // Подписки на события карты для пересчёта unclustered маркеров
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = () => updateUnclusteredMarkers();
    // Лёгкая throttled-версия для events во время движения, чтобы маркеры за краем
    // экрана убирались сразу при панорамировании, а не только по moveend
    let throttleTimer: number | null = null;
    const throttled = () => {
      if (throttleTimer !== null) return;
      throttleTimer = window.setTimeout(() => {
        throttleTimer = null;
        updateUnclusteredMarkers();
      }, 80);
    };
    map.on('move', throttled);
    map.on('moveend', handler);
    map.on('zoom', throttled);
    map.on('zoomend', handler);
    // Подписи у пинов на высоком зуме (#12)
    const LABEL_ZOOM = 15;
    const zoomLabels = () => {
      const c = map.getContainer();
      if (map.getZoom() >= LABEL_ZOOM) c.classList.add('show-pin-labels');
      else c.classList.remove('show-pin-labels');
    };
    map.on('zoom', zoomLabels);
    zoomLabels();
    // `resize` важно: на первом монтировании canvas часто 0×0, маркеры рассчитываются
    // с пустым viewport, и пока юзер не подвигает карту — остаются в углу.
    map.on('resize', handler);
    // `idle` — когда карта закончила рендер и нет анимаций. Хороший фолбэк когда
    // тайлы загружены, source dataset свежий, но события не успели сработать.
    map.on('idle', handler);
    map.on('sourcedata', (e: any) => {
      if (e.sourceId === 'locations' && e.isSourceLoaded) handler();
    });
    return () => {
      try {
        map.off('move', throttled);
        map.off('moveend', handler);
        map.off('zoom', throttled);
        map.off('zoomend', handler);
        map.off('zoom', zoomLabels);
        map.off('resize', handler);
        map.off('idle', handler);
      } catch {}
      if (throttleTimer !== null) clearTimeout(throttleTimer);
    };
  }, []);

  // Когда меняются locations — обновляем GeoJSON.
  // updateUnclusteredMarkers НЕ вызываем сразу: setData асинхронен (web worker),
  // и querySourceFeatures сразу после него вернёт пустой массив. Обновление
  // маркеров отрабатывает через подписку на `sourcedata` ниже — тогда тайлы
  // действительно готовы. Дополнительно делаем requestAnimationFrame fallback
  // на случай если sourcedata не сработает (например карта статична).
  useEffect(() => {
    pushDataToSource();
    let rafId = 0;
    let timeoutId = 0;
    rafId = requestAnimationFrame(() => {
      // Один кадр — обычно достаточно для setData → tile prepare
      updateUnclusteredMarkers();
    });
    timeoutId = window.setTimeout(updateUnclusteredMarkers, 250); // подстраховка
    return () => { cancelAnimationFrame(rafId); clearTimeout(timeoutId); };
  }, [locations, myId, placingMode]);

  useEffect(() => {
    if (activePoi || activeEvent || activeFlight || poiCoords) setSearchFocusPin(null);
  }, [activePoi, activeEvent, activeFlight, poiCoords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = searchFocusPin
      ? (useMapStore.getState().locations.find(l => l.user_id === searchFocusPin.user_id) || searchFocusPin)
      : null;
    const existing = forcedPinMarkerRef.current;
    if (!current) {
      if (existing) { try { existing.remove(); } catch {} forcedPinMarkerRef.current = null; }
      return;
    }
    const normalMarkerVisible = layersRef.current.people && markersRef.current.has(current.user_id);
    if (normalMarkerVisible) {
      if (existing) { try { existing.remove(); } catch {} forcedPinMarkerRef.current = null; }
      return;
    }
    if (existing) { try { existing.remove(); } catch {} }
    forcedPinMarkerRef.current = new mapboxgl.Marker({ element: buildPersonMarkerElement(current, true), anchor: 'center' })
      .setLngLat([current.lng, current.lat])
      .addTo(map);
    return () => {
      if (forcedPinMarkerRef.current && forcedPinMarkerRef.current.getLngLat().lng === current.lng && forcedPinMarkerRef.current.getLngLat().lat === current.lat) {
        try { forcedPinMarkerRef.current.remove(); } catch {}
        forcedPinMarkerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFocusPin, locations, layers.people, allUsers]);

  // Pulse на активном маркере
  useEffect(() => {
    // Снимаем класс со всех
    for (const m of markersRef.current.values()) {
      const el = (m as any).getElement?.();
      if (el) el.classList.remove('map-marker-active-pulse');
    }
    // Ставим на активный
    if (activePin) {
      const m = markersRef.current.get(activePin.user_id);
      const el = m?.getElement?.();
      if (el) el.classList.add('map-marker-active-pulse');
    }
  }, [activePin?.user_id, locations]);

  // Подсветка активного POI/события на карте (визуальная связь карточка ↔ пин)
  useEffect(() => {
    for (const m of poiMarkerByIdRef.current.values()) {
      const anim = m.getElement()?.firstElementChild as HTMLElement | null;
      anim?.classList.remove('map-pin-active');
    }
    const key = activePoi ? 'poi:' + activePoi.id : activeEvent ? 'ev:' + activeEvent.id : null;
    if (key) {
      const anim = poiMarkerByIdRef.current.get(key)?.getElement()?.firstElementChild as HTMLElement | null;
      anim?.classList.add('map-pin-active');
    }
  }, [activePoi?.id, activeEvent?.id, mapPoints, events]);

  // Слой «Люди»: показать/скрыть кластеры Mapbox + аватар-маркеры
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !sourceInitedRef.current) return;
    const vis = layers.people ? 'visible' : 'none';
    try { map.setLayoutProperty('clusters', 'visibility', vis); } catch {}
    try { map.setLayoutProperty('cluster-count', 'visibility', vis); } catch {}
    updateUnclusteredMarkers();
  }, [layers.people, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ETA (время в пути на машине) до открытой точки/события — Mapbox Directions
  useEffect(() => {
    const target = activePoi
      ? { lng: activePoi.lng, lat: activePoi.lat }
      : (activeEvent && activeEvent.location_lng != null && activeEvent.location_lat != null)
        ? { lng: activeEvent.location_lng, lat: activeEvent.location_lat }
        : null;
    setEta(null);
    if (!target || !myLocation || !MAPBOX_TOKEN) return;
    let cancelled = false;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${myLocation.lng},${myLocation.lat};${target.lng},${target.lat}?access_token=${MAPBOX_TOKEN}&overview=false`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const sec = d?.routes?.[0]?.duration;
        if (typeof sec === 'number') setEta(Math.max(1, Math.round(sec / 60)));
      })
      .catch(() => { /* тихо — ETA необязательна */ });
    return () => { cancelled = true; };
  }, [activePoi?.id, activeEvent?.id, myLocation?.lng, myLocation?.lat]);

  // Поиск места через геокодинг Mapbox (debounced)
  const runGeocode = (q: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const query = q.trim().toLowerCase();
    if (!query) { setSearchResults([]); return; }

    // Локальные совпадения (свои точки + друзья) — мгновенно, без сети
    const local: typeof searchResults = [];
    for (const p of mapPoints) {
      if (p.title.toLowerCase().includes(query)) {
        local.push({ kind: 'point', name: p.title, lng: p.lng, lat: p.lat, icon: p.category || 'place', color: categoryColor(p.category), point: p });
      }
    }
    for (const l of locations) {
      if (l.user_id === myId) continue;
      const u = allUsers.find(x => x.id === l.user_id);
      const nm = u?.display_name || '';
      if (nm && nm.toLowerCase().includes(query)) {
        local.push({ kind: 'friend', name: nm, lng: l.lng, lat: l.lat, avatar: u?.avatar_url || null, loc: l });
      }
    }
    setSearchResults(local.slice(0, 8));

    // Геокодинг мест — догружаем под локальными результатами
    if (!MAPBOX_TOKEN) return;
    searchTimerRef.current = window.setTimeout(async () => {
      try {
        const c = mapRef.current?.getCenter();
        const prox = c ? `&proximity=${c.lng},${c.lat}` : '';
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=5&language=ru${prox}`);
        const data = await res.json();
        const places = (data.features || []).map((f: any) => ({ kind: 'place' as const, name: f.place_name as string, lng: f.center[0] as number, lat: f.center[1] as number }));
        setSearchResults(prev => [...prev.filter(r => r.kind !== 'place'), ...places]);
      } catch { /* оставляем локальные результаты */ }
    }, 320);
  };

  // Вместить в кадр всех: друзей + точки + события
  const showAll = () => {
    const map = mapRef.current;
    if (!map) return;
    const pts: [number, number][] = [];
    for (const l of locations) if (l.visible) pts.push([l.lng, l.lat]);
    for (const p of mapPoints) pts.push([p.lng, p.lat]);
    for (const ev of Object.values(events)) if (ev.location_lng != null && ev.location_lat != null) pts.push([ev.location_lng, ev.location_lat]);
    if (myLocation) pts.push([myLocation.lng, myLocation.lat]);
    if (pts.length === 0) return;
    haptic.select();
    if (pts.length === 1) { map.flyTo({ center: pts[0], zoom: 14, duration: 800, essential: true }); return; }
    const lngs = pts.map(p => p[0]); const lats = pts.map(p => p[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 80, duration: 900, maxZoom: 15 });
  };

  // ============ Эфир (live share) с опциональным таймером ============
  const startLive = (durationMin: number | null) => {
    if (!myId) return;
    if (liveTimerRef.current) { clearTimeout(liveTimerRef.current); liveTimerRef.current = null; }
    startLiveShare(myId);
    haptic.success();
    if (durationMin != null) {
      setLiveUntil(Date.now() + durationMin * 60000);
      liveTimerRef.current = window.setTimeout(() => {
        stopLiveShare();
        setLiveUntil(null);
        liveTimerRef.current = null;
        toast.success('Эфир завершён');
      }, durationMin * 60000);
    } else {
      setLiveUntil(null);
    }
  };
  const stopLive = () => {
    if (liveTimerRef.current) { clearTimeout(liveTimerRef.current); liveTimerRef.current = null; }
    setLiveUntil(null);
    stopLiveShare();
  };
  // Таймер эфира живёт только пока открыта карта — чистим при размонтировании (сам эфир не трогаем)
  useEffect(() => () => { if (liveTimerRef.current) clearTimeout(liveTimerRef.current); }, []);

  // ============ Actions ============

  // Вернуться к своей точке / геолокации
  // ===== Прокладка маршрута внутри Mapbox (линия на карте) =====
  const removeRouteStartMarker = () => {
    try { routeStartMarkerRef.current?.remove(); } catch { /* ignore */ }
    routeStartMarkerRef.current = null;
  };

  const showRouteStartMarker = (origin: { lng: number; lat: number }, label: string) => {
    const map = mapRef.current;
    if (!map) return;
    removeRouteStartMarker();
    const el = document.createElement('div');
    el.className = 'map-route-start-marker';
    el.setAttribute('aria-label', label);
    el.innerHTML = '<span class="map-route-start-marker__ring"><span class="map-route-start-marker__dot"></span></span>';
    routeStartMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([origin.lng, origin.lat])
      .addTo(map);
  };

  const clearRoute = () => {
    const map = mapRef.current; if (!map) return;
    try {
      if (map.getLayer('sig-route-line')) map.removeLayer('sig-route-line');
      if (map.getLayer('sig-route-casing')) map.removeLayer('sig-route-casing');
      if (map.getSource('sig-route')) map.removeSource('sig-route');
    } catch { /* ignore */ }
    routeGeoRef.current = null;
    removeRouteStartMarker();
    setNavMode(false);
    setNavCameraMode('3d');
    setNavTravelMode('driving');
    setRouteInfo(null);
  };

  const drawRoute = async (
    from: { lng: number; lat: number },
    to: { lng: number; lat: number },
    opts?: { fit?: boolean; silent?: boolean; originLabel?: string; showOriginMarker?: boolean; travelMode?: TravelMode }
  ) => {
    const map = mapRef.current;
    if (!map || !MAPBOX_TOKEN) return;
    const fit = opts?.fit !== false;
    const silent = opts?.silent === true;
    const originLabel = opts?.originLabel || 'Точка отправления';
    const showOriginMarker = opts?.showOriginMarker !== false;
    const travelMode = opts?.travelMode ?? navTravelModeRef.current;
    const profile = directionsProfile(travelMode);
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;
      const res = await fetch(url);
      const d = await res.json();
      const route = d?.routes?.[0];
      if (!route?.geometry) { if (!silent) toast.error('Маршрут не найден'); return; }
      const data = { type: 'Feature', properties: {}, geometry: route.geometry } as any;
      const apply = () => {
        routeGeoRef.current = data;
        if (map.getSource('sig-route')) {
          (map.getSource('sig-route') as any).setData(data);
          applyRouteLayerStyle(map, travelMode);
        } else {
          const routePaint = routeLayerPaint(travelMode);
          map.addSource('sig-route', { type: 'geojson', data });
          map.addLayer({ id: 'sig-route-casing', type: 'line', source: 'sig-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: routePaint.casing as any });
          map.addLayer({ id: 'sig-route-line', type: 'line', source: 'sig-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: routePaint.line as any });
        }
        const coords = route.geometry.coordinates as [number, number][];
        if (fit && coords.length > 0) {
          let b = new mapboxgl.LngLatBounds(coords[0], coords[0]);
          coords.forEach(c => { b = b.extend(c); });
          map.fitBounds(b, { padding: { top: 90, bottom: 260, left: 50, right: 50 }, duration: 800, maxZoom: 16 });
        }
        setRouteInfo({
          dist: route.distance,
          dur: route.duration,
          origin: { lat: from.lat, lng: from.lng },
          originLabel,
          dest: { lat: to.lat, lng: to.lng },
          mode: travelMode,
        });
        if (showOriginMarker) showRouteStartMarker(from, originLabel);
        if (!silent) haptic.success();
      };
      if (map.isStyleLoaded()) apply(); else map.once('idle', apply);
    } catch { if (!silent) toast.error('Не удалось построить маршрут'); }
  };

  // Старт маршрута от текущего GPS — поставленную вручную точку не двигаем.
  // При ошибке GPS честно отмечаем, что маршрут построен от сохранённой точки на карте.
  const routeFromGps = (
    to: { lng: number; lat: number },
    opts?: { fit?: boolean; silent?: boolean; after?: () => void; showOriginMarker?: boolean; travelMode?: TravelMode }
  ) => {
    const drawFromSavedPoint = () => {
      if (!myLocation) {
        if (!opts?.silent) toast.error('Не удалось определить точку отправления');
        return;
      }
      void drawRoute(myLocation, to, {
        fit: opts?.fit,
        silent: opts?.silent,
        showOriginMarker: opts?.showOriginMarker,
        travelMode: opts?.travelMode,
        originLabel: 'Моя точка на карте',
      });
      opts?.after?.();
    };

    if (!('geolocation' in navigator)) {
      drawFromSavedPoint();
      return;
    }
    if (!opts?.silent) toast.info('Определяем местоположение…');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const gps = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        void drawRoute(gps, to, {
          fit: opts?.fit,
          silent: opts?.silent,
          showOriginMarker: opts?.showOriginMarker,
          travelMode: opts?.travelMode,
          originLabel: 'Текущее местоположение',
        });
        opts?.after?.();
      },
      drawFromSavedPoint,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );
  };

  const setNavigationView = (mode: '3d' | 'scheme') => {
    setNavCameraMode(mode);
    const style: MapStyleKey = mode === '3d' ? '3d' : 'auto';
    if (mapStyleRef.current !== style) {
      applyMapStyle(style);
    } else {
      const map = mapRef.current;
      const last = lastNavPosRef.current;
      if (map) {
        const following = navFollowingRef.current;
        map.easeTo({
          // В свободном обзоре не отбираем у пользователя выбранный центр/масштаб.
          center: following && last ? [last.lng, last.lat] : map.getCenter(),
          zoom: following ? (mode === '3d' ? 16.5 : 15.6) : map.getZoom(),
          pitch: mode === '3d' ? 60 : 0,
          bearing: mode === '3d'
            ? (following ? (navHeadingRef.current ?? map.getBearing()) : map.getBearing())
            : 0,
          duration: 650,
          essential: true,
        });
      }
      haptic.select();
    }
  };

  const startNavigation = () => {
    preNavStyleRef.current = mapStyleRef.current;
    removeRouteStartMarker();
    setNavFollow(true);
    setNavigationView('3d');
    const dest = routeInfo?.dest;
    if (!dest) { setNavMode(true); return; }
    routeFromGps(
      { lng: dest.lng, lat: dest.lat },
      { fit: false, silent: true, showOriginMarker: false, travelMode: navTravelModeRef.current, after: () => setNavMode(true) }
    );
  };

  const stopNavigation = () => {
    setNavMode(false);
    setNavFollow(true);
    setNavCameraMode('3d');
    const info = routeInfo;
    if (info) showRouteStartMarker({ lng: info.origin.lng, lat: info.origin.lat }, info.originLabel);
    const restoreStyle = preNavStyleRef.current;
    if (mapStyleRef.current !== restoreStyle) applyMapStyle(restoreStyle);
    else {
      const m = mapRef.current;
      if (m) m.easeTo({ pitch: restoreStyle === '3d' ? 55 : 0, bearing: 0, duration: 600 });
    }
  };

  // Цель маршрута, переданная из чата → всегда строим от GPS
  useEffect(() => {
    const rt = (routerLoc.state as any)?.routeTo;
    if (!rt || routeToHandledRef.current || !mapReady) return;
    routeToHandledRef.current = true;
    routeFromGps({ lng: rt.lng, lat: rt.lat });
  }, [mapReady, routerLoc.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const recenterToMe = () => {
    const loc = myLocation || useMapStore.getState().myLocation;
    if (loc && mapRef.current) {
      mapRef.current.flyTo({ center: [loc.lng, loc.lat], zoom: 14, duration: 1000, essential: true });
    }
  };

  // Сменить стиль (режим) карты. setStyle сбрасывает наши source/layer —
  // их вернёт обработчик style.load → ensureMapLayers (вместе с активным маршрутом).

  const createNavMarkerEl = () => {
    const el = document.createElement('div');
    el.className = 'map-nav-user-marker';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="map-nav-user-marker__halo"></div>
      <div class="map-nav-user-marker__arrow">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation" focusable="false">
          <defs>
            <linearGradient id="sigNavRedLeft" x1="13" y1="45" x2="33" y2="7" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#B91C1C"/>
              <stop offset="1" stop-color="#EF4444"/>
            </linearGradient>
            <linearGradient id="sigNavRedRight" x1="32" y1="8" x2="53" y2="45" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#FF7A70"/>
              <stop offset="0.58" stop-color="#F04444"/>
              <stop offset="1" stop-color="#DC2626"/>
            </linearGradient>
            <linearGradient id="sigNavRedBase" x1="15" y1="43" x2="49" y2="51" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#991B1B"/>
              <stop offset="0.5" stop-color="#C62828"/>
              <stop offset="1" stop-color="#7F1D1D"/>
            </linearGradient>
          </defs>
          <ellipse cx="32" cy="51.5" rx="16.5" ry="5.6" fill="rgba(0,0,0,0.22)"/>
          <ellipse cx="32" cy="50.8" rx="12.8" ry="3.4" fill="rgba(255,255,255,0.20)"/>
          <path d="M32 6.5 11.2 44.8 30.5 35.5 32 6.5Z" fill="url(#sigNavRedLeft)"/>
          <path d="M32 6.5V35.5L52.8 44.8 32 6.5Z" fill="url(#sigNavRedRight)"/>
          <path d="M11.2 44.8 32 37.3 52.8 44.8 32 53.2 11.2 44.8Z" fill="url(#sigNavRedBase)"/>
          <path d="M32 6.5 11.2 44.8 32 37.3 52.8 44.8 32 6.5Z" stroke="#7F1D1D" stroke-opacity="0.88" stroke-width="1.15" stroke-linejoin="round"/>
          <path d="M32 8.8 31.9 34.2" stroke="rgba(255,255,255,0.58)" stroke-width="1.15" stroke-linecap="round"/>
        </svg>
      </div>
    `;
    return el;
  };
  const removeNavMarker = () => {
    try { navMarkerRef.current?.remove(); } catch {}
    navMarkerRef.current = null;
    navHeadingRef.current = null;
  };

  const updateNavMarker = (gps: { lng: number; lat: number }, absoluteHeading: number | null) => {
    const map = mapRef.current;
    if (!map) return;
    if (!navMarkerRef.current) {
      navMarkerRef.current = new mapboxgl.Marker({ element: createNavMarkerEl(), anchor: 'center' })
        .setLngLat([gps.lng, gps.lat])
        .addTo(map);
    } else {
      navMarkerRef.current.setLngLat([gps.lng, gps.lat]);
    }

    const heading = Number.isFinite(absoluteHeading as number)
      ? (absoluteHeading as number)
      : navHeadingRef.current;
    if (heading == null) return;
    navHeadingRef.current = heading;
    const screenHeading = ((heading - map.getBearing()) % 360 + 360) % 360;
    navMarkerRef.current.getElement().style.setProperty('--nav-heading', `${screenHeading}deg`);
  };

  const recenterNavigation = () => {
    const map = mapRef.current;
    const gps = lastNavPosRef.current;
    if (!map || !gps) return;
    setNavFollow(true);
    const is3dView = navCameraMode === '3d';
    map.easeTo({
      center: [gps.lng, gps.lat],
      zoom: is3dView ? 16.5 : 15.6,
      pitch: is3dView ? 60 : 0,
      bearing: is3dView ? (navHeadingRef.current ?? map.getBearing()) : 0,
      duration: 650,
      essential: true,
    });
    haptic.select();
  };

  const switchTravelMode = (next: TravelMode) => {
    if (navTravelModeRef.current === next && routeInfo?.mode === next) return;
    setNavTravelMode(next);
    const map = mapRef.current;
    if (map && map.getSource('sig-route')) applyRouteLayerStyle(map, next);
    const dest = routeInfo?.dest;
    if (dest) {
      routeFromGps(
        { lng: dest.lng, lat: dest.lat },
        {
          fit: !navMode,
          silent: true,
          showOriginMarker: !navMode,
          travelMode: next,
        }
      );
    }
    haptic.select();
  };

  const modeButtonStyle = (active: boolean) => ({
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    border: '1px solid ' + (active ? 'transparent' : (isLightMap ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)')),
    background: active ? '#2563EB' : (isLightMap ? '#F3F4F6' : 'rgba(255,255,255,0.06)'),
    color: active ? '#fff' : inkFg,
    fontSize: 'var(--fs-label)',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  } as const);

  const applyMapStyle = (key: MapStyleKey) => {
    const map = mapRef.current; if (!map) return;
    mapStyleRef.current = key;
    setMapStyle(key);
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const url = key === 'auto'
      ? (theme === 'light' ? MAP_STYLE_URLS.streets : MAP_STYLE_URLS.dark)
      : MAP_STYLE_URLS[key];
    map.setStyle(url);
    const settleStyle = () => {
      if (key === '3d') {
        try { map.setConfigProperty('basemap', 'show3dObjects', true); } catch { /* Standard style enables 3D by default */ }
      }
      map.easeTo({ pitch: key === '3d' ? (navMode ? 60 : 55) : 0, duration: 600 });
    };
    if (map.isStyleLoaded()) settleStyle(); else map.once('style.load', settleStyle);
    haptic.select();
  };

  // Азимут между двумя точками — для поворота камеры по направлению движения в навигаторе
  const bearingBetween = (a: { lng: number; lat: number }, b: { lng: number; lat: number }): number | null => {
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(b.lat * Math.PI / 180);
    const x = Math.cos(a.lat * Math.PI / 180) * Math.sin(b.lat * Math.PI / 180)
      - Math.sin(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.cos(dLng);
    if (x === 0 && y === 0) return null;
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  // Навигатор: GPS-маркер и маршрут обновляются всегда, а камера следует за нами
  // только пока включён follow mode. Любой ручной pan/pinch/rotate/pitch отключает
  // автослежение — как в современных навигаторах. Вернуться можно кнопкой центровки.
  useEffect(() => {
    if (!navMode) {
      lastNavPosRef.current = null;
      setNavFollow(true);
      setNavCameraMode('3d');
      removeNavMarker();
      return;
    }
    const map = mapRef.current;
    const dest = routeInfo?.dest;
    if (!map || !dest || !('geolocation' in navigator)) return;
    let lastRouteAt = 0;

    const disengageFollow = (e: any) => {
      // Programmatic easeTo/flyTo also fires these events, but without originalEvent.
      // Отключаем follow только от реального жеста пользователя.
      if (!e?.originalEvent || !navFollowingRef.current) return;
      setNavFollow(false);
      haptic.select();
    };

    const handlePos = (pos: GeolocationPosition) => {
      const gps = { lng: pos.coords.longitude, lat: pos.coords.latitude };
      const prev = lastNavPosRef.current;
      const motionBearing = prev ? bearingBetween(prev, gps) : null;
      const compassHeading = Number.isFinite(pos.coords.heading as number)
        ? (pos.coords.heading as number)
        : null;
      const bearing = compassHeading ?? motionBearing ?? navHeadingRef.current ?? map.getBearing();
      lastNavPosRef.current = gps;
      updateNavMarker(gps, bearing);

      if (navFollowingRef.current) {
        const is3dView = navCameraMode === '3d';
        map.easeTo({
          center: [gps.lng, gps.lat],
          zoom: is3dView ? 16.5 : 15.6,
          pitch: is3dView ? 60 : 0,
          bearing: is3dView ? bearing : 0,
          duration: 700,
          essential: true,
        });
      }

      const now = Date.now();
      if (now - lastRouteAt > 12000) {
        lastRouteAt = now;
        void drawRoute(gps, { lng: dest.lng, lat: dest.lat }, {
          fit: false,
          silent: true,
          originLabel: 'Текущее местоположение',
          showOriginMarker: false,
          travelMode: navTravelModeRef.current,
        });
      }
    };
    const updateMarkerRotation = () => {
      const last = lastNavPosRef.current;
      if (last) updateNavMarker(last, navHeadingRef.current);
    };

    map.on('dragstart', disengageFollow);
    map.on('zoomstart', disengageFollow);
    map.on('rotatestart', disengageFollow);
    map.on('pitchstart', disengageFollow);
    map.on('rotate', updateMarkerRotation);
    map.on('pitch', updateMarkerRotation);

    const watchId = navigator.geolocation.watchPosition(
      handlePos,
      () => { /* навигация продолжит показывать последний маршрут */ },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
    return () => {
      map.off('dragstart', disengageFollow);
      map.off('zoomstart', disengageFollow);
      map.off('rotatestart', disengageFollow);
      map.off('pitchstart', disengageFollow);
      map.off('rotate', updateMarkerRotation);
      map.off('pitch', updateMarkerRotation);
      navigator.geolocation.clearWatch(watchId);
      removeNavMarker();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navMode, navCameraMode, navTravelMode, routeInfo?.dest?.lng, routeInfo?.dest?.lat]);

  // ===== Слой «Рейсы»: борта моих поездок на карте (опрос через Edge Function flight-track) =====
  const flightMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const flightDataRef = useRef<Map<string, { cur: { lng: number; lat: number }; target: { lng: number; lat: number }; dir: number; info: any }>>(new Map());
  const flightListRef = useRef<string[]>([]);
  const flightPollRef = useRef<number | null>(null);
  const flightRafRef = useRef<number | null>(null);

  const removeFlightMarker = (fn: string) => {
    const m = flightMarkersRef.current.get(fn);
    if (m) { try { m.remove(); } catch { /* ignore */ } flightMarkersRef.current.delete(fn); }
    flightDataRef.current.delete(fn);
  };

  const ensureFlightMarker = (fn: string) => {
    const map = mapRef.current;
    if (!map || flightMarkersRef.current.has(fn)) return;
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const info = flightDataRef.current.get(fn)?.info;
      if (info) { haptic.tap(); setActivePin(null); setActivePoi(null); setActiveEvent(null); setActiveFlight({ ...info }); }
    });
    const icon = document.createElement('div');
    icon.className = 'sig-plane-icon';
    icon.style.cssText = 'width:40px;height:40px;display:flex;align-items:center;justify-content:center;transition:transform 0.4s linear;line-height:0;transform-origin:50% 50%;will-change:transform';
    const planeImage = document.createElement('img');
    planeImage.src = '/icons/flight-plane-marker.svg';
    planeImage.alt = '';
    planeImage.draggable = false;
    planeImage.setAttribute('aria-hidden', 'true');
    planeImage.style.cssText = 'display:block;width:38px;height:38px;pointer-events:none;user-select:none';
    icon.appendChild(planeImage);
    const label = document.createElement('div');
    label.textContent = fn;
    label.style.cssText = 'margin-top:5px;font-size:10px;font-weight:800;letter-spacing:.2px;color:#fff;background:rgba(12,12,14,0.74);backdrop-filter:blur(8px);padding:2px 7px;border-radius:9px;white-space:nowrap;box-shadow:0 4px 10px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(255,255,255,0.18)';
    el.appendChild(icon);
    el.appendChild(label);
    const d = flightDataRef.current.get(fn);
    const m = new mapboxgl.Marker({ element: el }).setLngLat([d?.cur.lng ?? 0, d?.cur.lat ?? 0]).addTo(map);
    flightMarkersRef.current.set(fn, m);
  };

  // Плавное движение: каждый кадр подтягиваем cur → target (без рывков между опросами)
  const stepFlightAnim = () => {
    const map = mapRef.current;
    const bearing = map ? map.getBearing() : 0;
    for (const [fn, d] of flightDataRef.current) {
      d.cur.lng += (d.target.lng - d.cur.lng) * 0.08;
      d.cur.lat += (d.target.lat - d.cur.lat) * 0.08;
      const m = flightMarkersRef.current.get(fn);
      if (m) {
        m.setLngLat([d.cur.lng, d.cur.lat]);
        const icon = m.getElement().querySelector('.sig-plane-icon') as HTMLElement | null;
        // вычитаем поворот карты — иконка указывает истинный курс, не крутится при вращении карты
        if (icon) icon.style.transform = `rotate(${d.dir - bearing}deg)`;
      }
    }
    flightRafRef.current = requestAnimationFrame(stepFlightAnim);
  };

  const pollFlights = async () => {
    if (!mapRef.current) return;
    for (const fn of flightListRef.current) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/flight-track?flight=${encodeURIComponent(fn)}`);
        const d = await res.json();
        if (d && d.found && typeof d.lat === 'number' && typeof d.lng === 'number') {
          const prev = flightDataRef.current.get(fn);
          flightDataRef.current.set(fn, {
            cur: prev?.cur ?? { lng: d.lng, lat: d.lat },
            target: { lng: d.lng, lat: d.lat },
            dir: typeof d.dir === 'number' ? d.dir : (prev?.dir ?? 0),
            info: d,
          });
          ensureFlightMarker(fn);
          // если карточка этого борта открыта — обновим её свежими данными
          setActiveFlight((cur: any) => (cur && cur.flight_iata === d.flight_iata ? { ...d } : cur));
        } else {
          // не в воздухе / нет данных — убираем борт с карты
          removeFlightMarker(fn);
        }
      } catch { /* пропускаем один рейс */ }
    }
  };

  const loadMyTripFlights = async (): Promise<string[]> => {
    const me = useAuthStore.getState().user?.id;
    if (!me) return [];
    const { data: mem } = await supabase.from('event_members').select('event_id').eq('user_id', me);
    const ids = (mem || []).map((m: any) => m.event_id);
    if (ids.length === 0) return [];
    const { data: fl } = await supabase.from('event_flights').select('flight_iata').in('event_id', ids);
    const set = new Set((fl || []).map((f: any) => String(f.flight_iata).toUpperCase().replace(/\s+/g, '')));
    return Array.from(set);
  };

  useEffect(() => {
    let active = true;
    const start = async () => {
      const list = await loadMyTripFlights();
      if (!active) return;
      flightListRef.current = list;
      if (list.length === 0) { toast.info('В твоих поездках пока нет рейсов'); return; }
      await pollFlights();
      if (!active) return;
      flightPollRef.current = window.setInterval(() => { pollFlights(); }, 60000);
      if (flightRafRef.current == null) flightRafRef.current = requestAnimationFrame(stepFlightAnim);
    };
    const stop = () => {
      if (flightPollRef.current != null) { clearInterval(flightPollRef.current); flightPollRef.current = null; }
      if (flightRafRef.current != null) { cancelAnimationFrame(flightRafRef.current); flightRafRef.current = null; }
      for (const fn of Array.from(flightMarkersRef.current.keys())) removeFlightMarker(fn);
      flightListRef.current = [];
    };
    if (layers.flights && mapReady) start();
    return () => { active = false; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.flights, mapReady]);

  // Карточка борта: линия вылет→прилёт на карте + «кто из ваших летит»
  useEffect(() => {
    const map = mapRef.current;
    const clearPath = () => {
      const m = mapRef.current; if (!m) return;
      try {
        if (m.getLayer('sig-flightpath')) m.removeLayer('sig-flightpath');
        if (m.getLayer('sig-flightpath-glow')) m.removeLayer('sig-flightpath-glow');
        if (m.getSource('sig-flightpath')) m.removeSource('sig-flightpath');
      } catch { /* ignore */ }
    };
    clearPath();
    const dep = activeFlight?.dep, arr = activeFlight?.arr;
    if (map && dep && arr && typeof dep.lng === 'number' && typeof arr.lng === 'number') {
      const coords = greatCircleArc(dep.lng, dep.lat, arr.lng, arr.lat, 72);
      const data = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } as any;
      const add = () => {
        if (!map.getSource('sig-flightpath')) {
          map.addSource('sig-flightpath', { type: 'geojson', data });
          map.addLayer({ id: 'sig-flightpath-glow', type: 'line', source: 'sig-flightpath', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#7C4DFF', 'line-width': 7, 'line-opacity': 0.18, 'line-blur': 3 } });
          map.addLayer({ id: 'sig-flightpath', type: 'line', source: 'sig-flightpath', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#7C4DFF', 'line-width': 2.4, 'line-dasharray': [0.1, 2.4], 'line-opacity': 0.95 } });
        } else { (map.getSource('sig-flightpath') as any).setData(data); }
      };
      if (map.isStyleLoaded()) add(); else map.once('idle', add);
    }

    let cancelled = false;
    (async () => {
      if (!activeFlight?.flight_iata) { setFlightWho([]); return; }
      const { data: rows } = await supabase.from('event_flights').select('user_id,seat').eq('flight_iata', activeFlight.flight_iata);
      const uniq = Array.from(new Map((rows || []).map((r: any) => [r.user_id, r])).values());
      if (uniq.length === 0) { if (!cancelled) setFlightWho([]); return; }
      const ids = uniq.map((r: any) => r.user_id);
      const { data: us } = await supabase.from('users').select('id,display_name').in('id', ids);
      const nameById = Object.fromEntries((us || []).map((u: any) => [u.id, u.display_name]));
      if (!cancelled) setFlightWho(uniq.map((r: any) => ({ name: nameById[r.user_id] || 'Участник', seat: r.seat ?? null })));
    })();

    return () => { cancelled = true; clearPath(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFlight?.flight_iata, activeFlight?.dep?.iata, activeFlight?.arr?.iata]);

  // Плавно лететь к точке интереса и открыть её карточку
  const flyToPoint = (p: import('@/stores/mapPointsStore').MapPoint) => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [p.lng, p.lat], zoom: 15, duration: 1000, essential: true });
    }
    setShowPoiList(false);
    setSheetSnap('peek');
    setActivePin(null);
    setActiveEvent(null);
    setActiveFlight(null);
    setActivePoi(p);
  };

  // Дистанция от моей точки до места (для карточки)
  const distanceToKm = (lng: number, lat: number): string | null => {
    const loc = myLocation;
    if (!loc) return null;
    const R = 6371;
    const dLat = (lat - loc.lat) * Math.PI / 180;
    const dLng = (lng - loc.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(loc.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return km < 1 ? Math.round(km * 1000) + ' м' : km.toFixed(1) + ' км';
  };

  const handleStartPlacing = () => {
    setPlacingMode(true);
    setActivePin(null);
    // Если у юзера уже есть точка — стартуем pendingCoords с неё
    if (myLocation) {
      setPendingCoords({ lng: myLocation.lng, lat: myLocation.lat });
    } else {
      // Иначе ставим в центре экрана
      const c = mapRef.current?.getCenter();
      if (c) setPendingCoords({ lng: c.lng, lat: c.lat });
    }
  };

  const handleConfirmPlace = async () => {
    if (!pendingCoords || !myId) return;
    const { error } = await setMyLocation(myId, pendingCoords.lng, pendingCoords.lat, { isLive: false });
    if (error) {
      toast.error('Не удалось сохранить: ' + error);
      return;
    }
    setPlacingMode(false);
    setPendingCoords(null);
  };

  const handleCancelPlace = () => {
    setPlacingMode(false);
    setPendingCoords(null);
  };

  // Определить точку по GPS-геолокации устройства
  const handleUseGeo = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Геолокация недоступна на этом устройстве');
      return;
    }
    if (!placingMode) setPlacingMode(true);
    toast.info('Определяю местоположение…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        setPendingCoords({ lng, lat });
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 1000 });
        }
      },
      () => {
        toast.error('Не удалось определить геолокацию. Разреши доступ в настройках браузера.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const handleHide = async () => {
    if (!myId) return;
    if (!confirm('Скрыть свою точку с карты? Её больше никто не увидит, но координаты сохранятся — можно вернуть.')) return;
    await setVisible(myId, false);
    setShowSettings(false);
  };

  const handleShow = async () => {
    if (!myId) return;
    await setVisible(myId, true);
    setShowSettings(false);
  };

  const handleRemove = async () => {
    if (!myId) return;
    if (!confirm('Удалить свою точку с карты насовсем?')) return;
    await removeMyLocation(myId);
    setShowSettings(false);
  };

  const handleStartChat = async (otherUserId: string) => {
    if (!myId) return;
    setActivePin(null);
    const { id, error } = await useChatStore.getState().createDirectChat(myId, otherUserId);
    if (error) {
      toast.error('Не удалось открыть чат: ' + error);
      return;
    }
    if (id) nav('/chat/' + id);
  };

  // Периодически перерисовываем источник/маркеры — чтобы протухшие live-точки
  // (приложение у человека закрыто) исчезали даже без realtime-событий.
  useEffect(() => {
    const t = setInterval(() => {
      try { pushDataToSource(); updateUnclusteredMarkers(); } catch {}
    }, 30000);
    return () => clearInterval(t);
  }, []);

  // ============ RENDER ============

  if (!MAPBOX_TOKEN) {
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100%',padding:'24px 16px'}}>
        <div className="page-header"><h1>Карта</h1></div>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',padding:24}}>
          <div style={{maxWidth:320}}>
            <div style={{opacity:0.4,marginBottom:12,display:"flex",justifyContent:"center",color:"var(--text2)"}}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg></div>
            <p style={{color:'var(--text)',fontSize: 'var(--fs-body)',fontWeight:500,marginBottom:6}}>Карта не настроена</p>
            <p style={{color:'var(--muted)',fontSize: 'var(--fs-label)',lineHeight:1.5}}>
              Не задан VITE_MAPBOX_TOKEN. Добавьте переменную в Render Environment и передеплойте.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-root" style={{position:'absolute',inset:0,background:'#000',overflow:'hidden'}}>
      {/* контейнер карты прибит к экрану — карта закрывает и нижнюю safe-зону (без чёрной полосы) */}
      {/* Карта */}
      <div ref={containerRef} style={{position:'absolute',inset:0}} />

      {/* Загрузка карты (плавно исчезает, когда тайлы готовы) */}
      <div style={{ position:'absolute', inset:0, zIndex:25, background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, opacity: mapReady ? 0 : 1, pointerEvents: mapReady ? 'none' : 'auto', transition:'opacity 450ms ease' }}>
        {!mapReady && <><div className="spinner" /><div style={{ fontSize:'var(--fs-label)', color:'var(--muted)' }}>Загружаем карту…</div></>}
      </div>

      {/* Стили Mapbox: скрываем логотип и attribution совсем — на маленьких
         экранах они создают визуальный шум рядом с info-кнопкой. */}
      <style>{`
        .mapboxgl-ctrl-bottom-left,
        .mapboxgl-ctrl-bottom-right { display: none !important; }
        .mapboxgl-ctrl-logo,
        .mapboxgl-ctrl-attrib { display: none !important; }
      `}</style>


      {/* Top bar — back + settings */}
      <div style={{
        position:'absolute',
        top:'max(8px, env(safe-area-inset-top, 8px))',
        left:8,
        right:8,
        zIndex:10,
        display:'flex',
        gap:8,
        alignItems:'center',
        pointerEvents:'none',
      }}>
        <button
          onClick={() => goBack(nav, '/chats')}
          style={{
            width:40, height:40, borderRadius:20,
            background:inkBg,
            backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
            border:'none', color:inkFg, cursor:'pointer',
            boxShadow:'0 6px 18px rgba(0,0,0,0.28)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            pointerEvents:'auto',
          }}
          title="Назад"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{flex:1}} />
        {myLocation && (
          <button
            onClick={() => setShowSettings(true)}
            style={{
              width:40, height:40, borderRadius:20,
              background:inkBg,
              backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
              border:glassEdge, color:inkFg, cursor:'pointer',
              boxShadow:'0 6px 18px rgba(0,0,0,0.28)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              pointerEvents:'auto',
            }}
            title="Настройки"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        )}
      </div>

      {/* Индикатор: идёт трансляция вживую */}
      {liveSharing && (
        <div style={{
          position:'absolute', top:'max(54px, calc(env(safe-area-inset-top, 0) + 54px))',
          left:'50%', transform:'translateX(-50%)', zIndex:30,
          display:'flex', alignItems:'center', gap:8,
          background:'#16A34A', color:'#fff', borderRadius:999,
          padding:'6px 12px', boxShadow:'0 4px 14px rgba(0,0,0,0.3)',
        }}>
          <span style={{ width:8, height:8, borderRadius:4, background:'#fff', animation:'callPulse 1.2s ease-in-out infinite' }} />
          <span style={{ fontSize: 'var(--fs-label)', fontWeight:600 }}>Вы в эфире{liveUntil ? ` · до ${new Date(liveUntil).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
          <button onClick={() => stopLive()} style={{ background:'rgba(255,255,255,0.25)', border:'none', color:'#fff', borderRadius:999, padding:'3px 10px', fontSize: 'var(--fs-caption)', fontWeight:600, cursor:'pointer' }}>Стоп</button>
        </div>
      )}

      {/* Фильтры слоёв — горизонтальные чипы над шторкой (обновлённый более понятный стиль) */}
      {myId && !placingMode && !poiPlacing && !poiCoords && !liveSharing && !routeInfo && !navMode && !searchExpanded && !hasOpenMapPanel && !(searchOpen && searchResults.length > 0) && (
        <div
          ref={layerStripRef}
          className="no-scrollbar map-layer-strip"
          style={{
            position:'absolute', left:0, right:0, bottom:'calc(60px + env(safe-area-inset-bottom, 0px))', zIndex:34,
            display:'flex', gap:8, overflowX:'auto', padding:'4px 12px 2px',
            // Прогресс шторки применяется через ref, чтобы drag не заставлял весь MapPage
            // перерисовываться на каждом пикселе движения пальца.
            opacity:1, transform:'translate3d(0,0,0) scale(1)', transformOrigin:'center bottom',
            transition:'opacity 170ms ease-out, transform 220ms cubic-bezier(0.22,1,0.36,1)',
            pointerEvents:'auto', willChange:'opacity, transform',
          }}
        >
          {([
            { k: 'people' as const, label: 'Люди', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            { k: 'points' as const, label: 'Точки', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
            { k: 'events' as const, label: 'События', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> },
            { k: 'flights' as const, label: 'Рейсы', icon: <FlightFilterIcon /> },
          ]).map(({ k, label, icon }) => {
            const on = layers[k];
            return (
              <button key={k} onClick={() => { haptic.tap(); setLayers(s => ({ ...s, [k]: !s[k] })); }} aria-label={label} aria-pressed={on} className={`tap-effect map-layer-chip${on ? ' on' : ''}${isLightMap ? ' light' : ''}`}
                style={{
                  flexShrink:0, height:42, borderRadius:21, display:'flex', alignItems:'center', gap:8, padding:'0 11px 0 9px', cursor:'pointer',
                  border: on ? ('1px solid ' + (isLightMap ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.18)')) : glassEdge,
                  background: on ? (isLightMap ? '#FFFFFF' : 'rgba(16,16,19,0.92)') : (isLightMap ? 'rgba(246,247,249,0.94)' : 'rgba(27,27,31,0.76)'),
                  backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
                  color: on ? (isLightMap ? '#111318' : '#FFFFFF') : (isLightMap ? '#6B6D75' : '#B7B8C0'),
                  boxShadow:'none',
                  fontSize:'var(--fs-label)', fontWeight:650,
                }}>
                <span className="map-layer-chip-icon">{icon}</span>
                <span>{label}</span>
                <span className="map-layer-chip-check" style={{ color:on ? (isLightMap ? '#111318' : '#FFFFFF') : (isLightMap ? '#8B8D96' : '#989AA3') }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: on ? 1 : 0.32, transform: on ? 'scale(1)' : 'scale(.86)', transition: 'transform .2s ease, opacity .2s ease' }}><polyline points="20 6 9 17 4 12"/></svg>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Поиск мест (геокодинг) */}
      {myId && !placingMode && !poiPlacing && !poiCoords && !activePin && !activeEvent && !liveSharing && !routeInfo && searchExpanded && (
        <div style={{ position:'absolute', top:'max(54px, calc(env(safe-area-inset-top, 0) + 54px))', left:12, right:12, zIndex:35 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:inkBg, backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'none', borderRadius:'var(--pill)', padding:'10px 15px', boxShadow:'0 6px 18px rgba(0,0,0,0.28)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={inkFg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, opacity:0.85 }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={searchQuery} autoFocus onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); runGeocode(e.target.value); }} placeholder="Поиск места, точки или друга" style={{ flex:1, background:'none', border:'none', outline:'none', color:inkFg, fontSize:'var(--fs-label)', fontFamily:'inherit', minWidth:0 }} />
            <button onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); setSearchExpanded(false); }} aria-label="Закрыть поиск" style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', display:'flex' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div className="share-sheet-enter" style={{ marginTop:8, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', boxShadow:'var(--shadow-2)' }}>
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => {
                  setSearchOpen(false); setSearchExpanded(false); setSearchQuery(''); setSearchResults([]);
                  setActivePin(null); setActivePoi(null); setActiveEvent(null);
                  if (r.kind === 'point' && r.point) {
                    setSearchFocusPin(null);
                    flyToPoint(r.point);
                  } else if (r.kind === 'friend' && r.loc) {
                    const loc = r.loc;
                    setSearchFocusPin(loc);
                    if (mapRef.current) mapRef.current.flyTo({ center:[loc.lng, loc.lat], zoom:15, duration:1000, essential:true });
                    setTimeout(() => setActivePin(loc), 700);
                  } else {
                    setSearchFocusPin(null);
                    if (mapRef.current) mapRef.current.flyTo({ center:[r.lng, r.lat], zoom:15, duration:1000, essential:true });
                    setTimeout(() => setPoiCoords({ lng:r.lng, lat:r.lat }), 700);
                  }
                }} className="tap-effect map-row-in" style={{ animationDelay:(i*30)+'ms', display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left', background:'none', border:'none', borderBottom: i < searchResults.length-1 ? '1px solid var(--border)' : 'none', padding:'11px 14px', cursor:'pointer', color:'var(--text)' }}>
                  {r.kind === 'point'
                    ? <span style={{ width:24, height:24, borderRadius:7, background:(r.color||'var(--accent)')+'33', color:r.color||'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><CategoryIcon category={r.icon || 'place'} size={15} color="currentColor" /></span>
                    : r.kind === 'friend'
                      ? (r.avatar
                          ? <img src={r.avatar} alt="" style={{ width:24, height:24, borderRadius:12, objectFit:'cover', flexShrink:0 }} />
                          : <span style={{ width:24, height:24, borderRadius:12, background:avatarColor(r.loc?.user_id||r.name), color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'var(--fs-micro)', fontWeight:700, flexShrink:0 }}>{r.name[0]?.toUpperCase()}</span>)
                      : <span style={{ width:24, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.7}}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>}
                  <span style={{ flex:1, fontSize:'var(--fs-label)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</span>
                  {r.kind !== 'place' && <span style={{ fontSize:'var(--fs-micro)', color:'var(--muted)', flexShrink:0 }}>{r.kind === 'point' ? 'точка' : 'друг'}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Плавающая кнопка поиска рядом с правыми элементами управления */}
      {myId && !placingMode && !poiPlacing && !poiCoords && !activePin && !activeEvent && !liveSharing && !routeInfo && !navMode && !searchExpanded && sheetSnap === 'peek' && (
        <button onClick={() => { haptic.tap(); setSearchExpanded(true); }} aria-label="Поиск" className="tap-effect"
          style={{ position:'absolute', right:16, bottom:'calc(314px + env(safe-area-inset-bottom, 0))', zIndex:38, width:46, height:46, borderRadius:23, background:glassBg, backdropFilter:'blur(8px)', border:'1px solid var(--border)', color:glassFg, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:glassShadow }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7.5"/><path d="M20 20l-3.6-3.6"/></svg>
        </button>
      )}

      {/* Постоянная кнопка «Ко мне» (recenter) */}
      {myId && myLocation && !placingMode && !poiPlacing && !poiCoords && !fabOpen && !routeInfo && !navMode && sheetSnap === 'peek' && (
        <button onClick={() => { setRecenterSpin(n => n + 1); recenterToMe(); }} aria-label="Ко мне" className="tap-effect"
          style={{ position:'absolute', right:16, bottom:'calc(194px + env(safe-area-inset-bottom, 0))', zIndex:38, width:46, height:46, borderRadius:23, background:glassBg, backdropFilter:'blur(8px)', border:'1px solid var(--border)', color:glassFg, fontSize:'var(--fs-title)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:glassShadow }}>
          <span key={recenterSpin} className="map-spin" style={{ display:'inline-flex' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="7"/><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg></span>
        </button>
      )}

      {/* Показать всех — вместить друзей/точки/события в кадр */}
      {myId && !placingMode && !poiPlacing && !poiCoords && !fabOpen && !routeInfo && !navMode && sheetSnap === 'peek' && (locations.length > 0 || mapPoints.length > 0 || Object.keys(events).length > 0) && (
        <button onClick={showAll} aria-label="Показать всех" className="tap-effect"
          style={{ position:'absolute', right:16, bottom:'calc(254px + env(safe-area-inset-bottom, 0))', zIndex:38, width:46, height:46, borderRadius:23, background:glassBg, backdropFilter:'blur(8px)', border:'1px solid var(--border)', color:glassFg, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:glassShadow }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/></svg>
        </button>
      )}

      {/* FAB — меню действий карты (анимированное) */}
      {myId && !placingMode && !poiPlacing && !poiCoords && !routeInfo && !navMode && sheetSnap === 'peek' && (
        <>
          {fabOpen && (
            <div onClick={() => setFabOpen(false)} className="map-backdrop-in"
              style={{ position:'absolute', inset:0, zIndex:39, background:'rgba(0,0,0,0.35)', backdropFilter:'blur(2px)' }} />
          )}
          <div style={{ position:'absolute', right:16, bottom:'calc(134px + env(safe-area-inset-bottom, 0))', zIndex:40, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:12 }}>
            {fabOpen && [
              { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, label:'Точка интереса', onClick:() => { setFabOpen(false); setActivePin(null); setActivePoi(null); setPoiPlacing(true); } },
              { icon: liveSharing
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4.93 4.93a10 10 0 0 0 0 14.14M19.07 4.93a10 10 0 0 1 0 14.14M7.76 7.76a6 6 0 0 0 0 8.48M16.24 7.76a6 6 0 0 1 0 8.48"/><circle cx="12" cy="12" r="2"/></svg>,
                label: liveSharing ? 'Остановить эфир' : 'Поделиться в эфире', onClick:() => { setFabOpen(false); if (liveSharing) { stopLive(); } else { setLiveDurPicker(true); } } },
              { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M12 14v4"/><path d="M10 16h4"/></svg>, label:'Создать событие', onClick:() => { setFabOpen(false); nav('/events/new?from=map'); } },
              { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>, label:'Все точки', onClick:() => { setFabOpen(false); setSheetSnap('peek'); setActivePin(null); setActivePoi(null); setActiveEvent(null); setActiveFlight(null); setShowPoiList(true); } },
            ].map((it, i) => (
              <button key={it.label} onClick={it.onClick} className="map-fab-item tap-effect"
                style={{ animationDelay:(i*45)+'ms', display:'flex', alignItems:'center', gap:10, width:212, justifyContent:'flex-start', background:'var(--surface-2)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'var(--pill)', padding:'9px 16px', boxShadow:'var(--shadow-2)', cursor:'pointer', fontSize:'var(--fs-label)', fontWeight:600, whiteSpace:'nowrap' }}>
                <span style={{ width:28, height:28, borderRadius:'50%', background:'var(--surface-light)', display:'flex', alignItems:'center', justifyContent:'center' }}>{it.icon}</span>
                {it.label}
              </button>
            ))}
            <button
              onClick={() => setFabOpen(o => !o)}
              aria-label={fabOpen ? 'Закрыть меню' : 'Меню карты'}
              className="tap-effect"
              style={{ width:46, height:46, borderRadius:23, background:'var(--text)', border:'none', color:'var(--bg)', cursor:'pointer', boxShadow:'var(--shadow-2)', display:'flex', alignItems:'center', justifyContent:'center', alignSelf:'flex-end' }}
            >
              <span className={'map-fab-icon' + (fabOpen ? ' open' : '')} style={{ display:'flex', lineHeight:0 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>
            </button>
          </div>
        </>
      )}

      {/* POI: установка точки по центру карты */}
      {poiPlacing && (
        <>
          <div style={{ position:'absolute', inset:0, zIndex:14, background:'radial-gradient(circle at center, rgba(255,255,255,0.04), rgba(0,0,0,0.18) 58%, rgba(0,0,0,0.32))', pointerEvents:'none' }} />
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:15 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, transform:'translateY(-12px)' }}>
              <div style={{ width:54, height:54, borderRadius:27, background:'rgba(255,255,255,0.92)', boxShadow:'0 14px 34px rgba(0,0,0,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5.5-8 11-8 11S4 15.5 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/></svg>
              </div>
              <div style={{ width:22, height:22, borderRadius:11, background:'rgba(0,0,0,0.82)', border:'2px solid rgba(255,255,255,0.88)', boxShadow:'0 6px 18px rgba(0,0,0,0.28)' }} />
            </div>
          </div>
          <div style={{ position:'absolute', top:'max(60px, calc(env(safe-area-inset-top, 0) + 54px))', left:16, right:16, zIndex:16 }}>
            <div style={{ position:'relative', background:'rgba(15,15,17,0.86)', backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 18px 36px rgba(0,0,0,0.26)', padding:'14px 48px 14px 14px', borderRadius:18, color:'#fff' }}>
              <button onClick={() => setPoiPlacing(false)} aria-label="Закрыть режим установки точки" style={{ position:'absolute', top:10, right:10, width:30, height:30, borderRadius:15, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.08)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', padding:0, cursor:'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
              <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                <div style={{ width:38, height:38, borderRadius:14, background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5.5-8 11-8 11S4 15.5 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'var(--fs-body)', fontWeight:700, marginBottom:3 }}>Поставьте точку интереса</div>
                  <div style={{ fontSize:'var(--fs-caption)', color:'rgba(255,255,255,0.78)', lineHeight:1.45 }}>Перемести карту так, чтобы точка оказалась под прицелом, и затем подтверди выбор.</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ position:'absolute', bottom:'calc(24px + env(safe-area-inset-bottom, 0))', left:16, right:16, zIndex:16, display:'grid', gridTemplateColumns:'1fr 1.45fr', gap:10 }}>
            <button onClick={() => setPoiPlacing(false)} style={{ minHeight:52, padding:'12px 14px', background:'rgba(15,15,17,0.72)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.16)', borderRadius:18, color:'#fff', fontSize:'var(--fs-snap14)', fontWeight:600, cursor:'pointer' }}>Отмена</button>
            <button onClick={() => { const c = mapRef.current?.getCenter(); if (c) { setPoiCoords({ lng: c.lng, lat: c.lat }); setPoiPlacing(false); } }} style={{ minHeight:52, padding:'12px 16px', background:'var(--accent)', border:'none', borderRadius:18, color:'var(--bg)', fontSize:'var(--fs-snap14)', fontWeight:700, boxShadow:'0 14px 26px color-mix(in srgb, var(--accent) 30%, transparent)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5v14"/></svg>Поставить здесь</button>
          </div>
        </>
      )}

      {poiCoords && myId && (
        <AddPointSheet
          coords={poiCoords}
          myId={myId}
          users={allUsers}
          onClose={() => setPoiCoords(null)}
          onSaved={() => setPoiCoords(null)}
        />
      )}

      {editPoint && myId && (
        <AddPointSheet
          coords={{ lng: editPoint.lng, lat: editPoint.lat }}
          myId={myId}
          users={allUsers}
          editPoint={editPoint}
          onClose={() => setEditPoint(null)}
          onSaved={() => setEditPoint(null)}
        />
      )}

      {shareTarget && myId && (
        <ShareLocationSheet
          lat={shareTarget.lat}
          lng={shareTarget.lng}
          title={shareTarget.title}
          eventId={shareTarget.eventId}
          myId={myId}
          onClose={() => setShareTarget(null)}
          onShared={() => setShareTarget(null)}
        />
      )}

      {liveDurPicker && (
        <div onClick={() => setLiveDurPicker(false)} className="map-backdrop-in" style={{ position:'absolute', inset:0, zIndex:60, display:'flex', alignItems:'flex-end', background:'rgba(0,0,0,0.55)' }}>
          <div onClick={e => e.stopPropagation()} className="share-sheet-enter" style={{ width:'100%', background:'var(--bg)', color:'var(--text)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'var(--sp-4) var(--sp-4) max(var(--sp-5), env(safe-area-inset-bottom, 20px))', boxShadow:'var(--shadow-2)' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'var(--sp-3)' }}><div style={{ width:36, height:4, borderRadius:2, background:'var(--border)' }} /></div>
            <h3 style={{ margin:'0 0 4px', fontSize:'var(--fs-title)', fontWeight:'var(--fw-bold)', display:'flex', alignItems:'center', gap:9 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M16.2 7.8a6 6 0 0 1 0 8.4"/><circle cx="12" cy="12" r="2"/></svg>Эфир геолокации</h3>
            <div style={{ fontSize:'var(--fs-label)', color:'var(--muted)', marginBottom:'var(--sp-4)' }}>Друзья будут видеть, где ты, в реальном времени. На сколько включить?</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--sp-2)' }}>
              {([['15 минут', 15], ['1 час', 60], ['Пока не выключу', null]] as [string, number | null][]).map(([label, mins]) => (
                <button key={label} onClick={() => { setLiveDurPicker(false); startLive(mins); }} className="tap-effect"
                  style={{ width:'100%', padding:'14px', borderRadius:'var(--r-lg)', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:'var(--fs-body)', fontWeight:600, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span>{label}</span>
                  {mins != null && <span style={{ fontSize:'var(--fs-caption)', color:'var(--muted)' }}>авто-стоп</span>}
                </button>
              ))}
            </div>
            <div style={{ fontSize:'var(--fs-micro)', color:'var(--muted)', marginTop:'var(--sp-3)', lineHeight:1.4 }}>Таймер работает, пока открыто приложение. Если закроешь Sigmas — выключи эфир вручную.</div>
          </div>
        </div>
      )}

      {activePoi && (
        <div onClick={() => setActivePoi(null)} className="map-backdrop-in" style={{ position:'absolute', inset:0, zIndex:45, display:'flex', alignItems:'flex-end', background:'rgba(0,0,0,0.4)' }}>
          <div onClick={e => e.stopPropagation()} className="share-sheet-enter" style={{ width:'100%', background:'var(--bg)', color:'var(--text)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'var(--sp-4) var(--sp-4) max(var(--sp-5), env(safe-area-inset-bottom, 20px))', boxShadow:'var(--shadow-2)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'var(--sp-3)' }}>
              <div style={{ width:52, height:52, borderRadius:16, background:'var(--accent-soft)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><CategoryIcon category={activePoi.category} size={26} color={categoryColor(activePoi.category)} strokeWidth={2} /></div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'var(--fs-heading)', fontWeight:'var(--fw-semibold)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activePoi.title}</div>
                <div style={{ fontSize:'var(--fs-caption)', color:'var(--muted)', display:'flex', alignItems:'center', gap:6, marginTop:2, flexWrap:'wrap' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                    {activePoi.visibility === 'all'
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                    {activePoi.visibility === 'all' ? 'Видна всем' : 'Избранным'}
                  </span>
                  {distanceToKm(activePoi.lng, activePoi.lat) && <span>· {distanceToKm(activePoi.lng, activePoi.lat)} от вас</span>}
                  {eta != null && <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>· <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l1.6-4.8A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.2L19 13"/><path d="M4 13h16v4a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5h-9V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><circle cx="7.5" cy="15.5" r="1"/><circle cx="16.5" cy="15.5" r="1"/></svg>~{eta} мин</span>}
                </div>
              </div>
            </div>
            {activePoi.photo_url && (
              <button onClick={() => setPhotoViewer({ src: activePoi.photo_url!, alt: activePoi.title })} aria-label="Открыть фото точки" style={{ width:'100%', padding:0, border:'none', background:'none', marginTop:'var(--sp-3)', cursor:'zoom-in', display:'block' }}>
                <img src={activePoi.photo_url} alt="" style={{ width:'100%', height:170, objectFit:'cover', borderRadius:'var(--r-lg)', display:'block' }} />
              </button>
            )}
            {activePoi.note && (
              <div style={{ fontSize:'var(--fs-label)', color:'var(--text)', marginTop:'var(--sp-3)', lineHeight:1.45, whiteSpace:'pre-wrap' }}>{activePoi.note}</div>
            )}
            <div style={{ display:'flex', gap:'var(--sp-2)', marginTop:'var(--sp-4)' }}>
              <button onClick={() => { const ap = activePoi; setActivePoi(null); setRoutePrompt({ lng: ap.lng, lat: ap.lat, title: ap.title }); }} className="tap-effect"
                style={{ flex:1, padding:'11px', borderRadius:'var(--r-md)', border:'none', background:'var(--accent)', color:'var(--bg)', fontWeight:600, fontSize:'var(--fs-label)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>Маршрут</button>
              <button onClick={() => { const ap = activePoi; setShareTarget({ lat: ap.lat, lng: ap.lng, title: ap.title }); }} className="tap-effect"
                style={{ flex:1, padding:'11px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontWeight:600, fontSize:'var(--fs-label)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>В чат</button>
            </div>
            <div style={{ display:'flex', gap:'var(--sp-2)', marginTop:'var(--sp-2)' }}>
              <button onClick={async () => {
                const url = `https://www.google.com/maps/search/?api=1&query=${activePoi.lat},${activePoi.lng}`;
                try { if (navigator.share) { await navigator.share({ title: activePoi.title, url }); } else { await navigator.clipboard.writeText(url); toast.success('Ссылка скопирована'); } } catch {}
              }} className="tap-effect"
                style={{ flex:1, padding:'11px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontWeight:600, fontSize:'var(--fs-label)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>Поделиться</button>
              {activePoi.created_by === myId && (
                <button onClick={() => { const ap = activePoi; setActivePoi(null); setEditPoint(ap); }} className="tap-effect"
                  style={{ width:46, padding:'11px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'var(--fs-title)' }} aria-label="Изменить"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
              )}
              {activePoi.created_by === myId && (
                <button onClick={async () => { const ap = activePoi; setActivePoi(null); await removePoint(ap.id); }} className="tap-effect"
                  style={{ width:46, padding:'11px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface-2)', color:'#EF4444', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }} aria-label="Удалить">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Список всех точек интереса */}
      {showPoiList && (
        <div onClick={() => setShowPoiList(false)} style={{ position:'absolute', inset:0, zIndex:46, display:'flex', alignItems:'flex-end', background:'rgba(0,0,0,0.4)' }} className="map-backdrop-in">
          <div onClick={e => e.stopPropagation()} className="share-sheet-enter" style={{ width:'100%', maxHeight:'70vh', overflowY:'auto', background:'var(--bg)', color:'var(--text)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'var(--sp-4) var(--sp-4) max(var(--sp-5), env(safe-area-inset-bottom, 20px))', boxShadow:'var(--shadow-2)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--sp-3)' }}>
              <div style={{ fontSize:'var(--fs-title)', fontWeight:'var(--fw-bold)' }}>Точки интереса</div>
              <div style={{ fontSize:'var(--fs-caption)', color:'var(--muted)' }}>{mapPoints.length}</div>
            </div>
            {mapPoints.length === 0 ? (
              <div style={{ textAlign:'center', padding:'var(--sp-6) var(--sp-4)', color:'var(--muted)' }}>
                <div style={{ marginBottom:8, display:"flex", justifyContent:"center", color:"var(--muted)" }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg></div>
                <div style={{ fontSize:'var(--fs-body)', fontWeight:600, color:'var(--text)', marginBottom:4 }}>Пока нет точек</div>
                <div style={{ fontSize:'var(--fs-label)', lineHeight:1.4 }}>Нажми «+» → «Точка интереса» и тапни по карте, чтобы отметить любимое место.</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'var(--sp-2)' }}>
                {mapPoints.map((p, i) => (
                  <button key={p.id} onClick={() => flyToPoint(p)} className="map-row-in tap-effect"
                    style={{ animationDelay:(i*35)+'ms', display:'flex', alignItems:'center', gap:'var(--sp-3)', background:'var(--surface-2)', boxShadow:'var(--shadow-1)', border:'none', borderRadius:'var(--r-lg)', padding:'var(--sp-3)', cursor:'pointer', textAlign:'left', width:'100%' }}>
                    <div style={{ width:40, height:40, borderRadius:12, background: `${categoryColor(p.category)}22`, color: categoryColor(p.category), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`1px solid ${categoryColor(p.category)}28` }}><CategoryIcon category={p.category} size={20} color={categoryColor(p.category)} strokeWidth={2} /></div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'var(--fs-body)', fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</div>
                      <div style={{ fontSize:'var(--fs-caption)', color:'var(--muted)' }}>{distanceToKm(p.lng, p.lat) ? distanceToKm(p.lng, p.lat) + ' от вас' : (p.visibility === 'all' ? 'Видна всем' : 'Избранным')}</div>
                    </div>
                    <span style={{ color:'var(--muted)', fontSize:'var(--fs-heading)' }}>›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Карточка события (маршрут / дата / дистанция) */}
      {activeEvent && (
        <div onClick={() => setActiveEvent(null)} className="map-backdrop-in" style={{ position:'absolute', inset:0, zIndex:47, display:'flex', alignItems:'flex-end', background:'rgba(0,0,0,0.4)' }}>
          <div onClick={e => e.stopPropagation()} className="share-sheet-enter" style={{ width:'100%', background:'var(--bg)', color:'var(--text)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'var(--sp-4) var(--sp-4) max(var(--sp-5), env(safe-area-inset-bottom, 20px))', boxShadow:'var(--shadow-2)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'var(--sp-3)' }}>
              <div style={{ width:52, height:52, borderRadius:16, background: activeEvent.type === 'party' ? 'rgba(236,72,153,0.14)' : 'rgba(37,99,235,0.14)', color: activeEvent.type === 'party' ? '#EC4899' : '#2563EB', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {activeEvent.type === 'party' ? <IconMapParty size={27} /> : <IconMapPlane size={27} />}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'var(--fs-heading)', fontWeight:'var(--fw-semibold)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activeEvent.title}</div>
                <div style={{ fontSize:'var(--fs-caption)', color:'var(--muted)', marginTop:2 }}>
                  {new Date(activeEvent.start_at).toLocaleDateString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                  {activeEvent.location_lat != null && activeEvent.location_lng != null && distanceToKm(activeEvent.location_lng, activeEvent.location_lat) && <> · {distanceToKm(activeEvent.location_lng, activeEvent.location_lat)} от вас</>}
                  {eta != null && <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}> · <IconCar size={15} strokeWidth={1.75} />~{eta} мин</span>}
                </div>
              </div>
            </div>
            {activeEvent.location_lat != null && activeEvent.location_lng != null && (
              <div style={{ display:'flex', gap:'var(--sp-2)', marginTop:'var(--sp-4)' }}>
                <button onClick={() => { const ev = activeEvent; setActiveEvent(null); setRoutePrompt({ lng: ev.location_lng!, lat: ev.location_lat!, title: ev.title }); }} className="tap-effect"
                  style={{ flex:1, padding:'11px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontWeight:600, fontSize:'var(--fs-label)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>Маршрут</button>
                <button onClick={() => { const ev = activeEvent; setShareTarget({ lat: ev.location_lat!, lng: ev.location_lng!, title: ev.title, eventId: ev.id }); }} className="tap-effect"
                  style={{ flex:1, padding:'11px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontWeight:600, fontSize:'var(--fs-label)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>В чат</button>
              </div>
            )}
            <div style={{ display:'flex', gap:'var(--sp-2)', marginTop:'var(--sp-2)' }}>
              <button onClick={() => { const id = activeEvent.id; setActiveEvent(null); nav('/events/' + id + '?from=map'); }} className="tap-effect"
                style={{ flex:1, padding:'12px', borderRadius:'var(--r-md)', border:'1px solid var(--text)', background:'var(--text)', color:'var(--bg)', fontWeight:700, fontSize:'var(--fs-label)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, boxShadow:'0 8px 22px rgba(0,0,0,0.18)' }}>Открыть событие</button>
            </div>
          </div>
        </div>
      )}

      {/* Пустое состояние — я на карте, но больше ничего нет */}
      {!loading && myLocation && locations.filter(l => l.user_id !== myId).length === 0 && mapPoints.length === 0 && !Object.values(events).some(e => e.status === 'active' && e.location_lat != null) && (
        <div style={{ position:'absolute', top:'42%', left:24, right:24, zIndex:8, transform:'translateY(-50%)', textAlign:'center', pointerEvents:'none' }}>
          <div style={{ display:'inline-block', background:'rgba(0,0,0,0.62)', backdropFilter:'blur(10px)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'16px 18px' }}>
            <div style={{ marginBottom:6, display:"flex", justifyContent:"center", color:"var(--muted)" }}><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg></div>
            <div style={{ fontSize:'var(--fs-body)', fontWeight:600, color:'#fff', marginBottom:4 }}>На карте пока пусто</div>
            <div style={{ fontSize:'var(--fs-label)', color:'rgba(255,255,255,0.7)', lineHeight:1.4 }}>Зажми палец на карте или нажми «+», чтобы добавить точку. Или позови друзей в Sigmas — они появятся здесь.</div>
          </div>
        </div>
      )}

      {/* CTA — поставить точку (если её ещё нет). Можно свернуть в компактное напоминание. */}
      {!loading && !myLocation && !placingMode && myId && !locationPromptCollapsed && (
        <div className="map-location-nudge">
          <button className="map-location-nudge-close" onClick={() => { haptic.tap(); setLocationPromptCollapsed(true); }} aria-label="Свернуть напоминание">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <div className="map-location-nudge-head">
            <span className="map-location-nudge-pin"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5.5-8 11-8 11S4 15.5 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
            <div><div className="map-location-nudge-title">Добавьте себя на карту</div><div className="map-location-nudge-copy">Можно указать район, а не точный адрес.</div></div>
          </div>
          <div className="map-location-nudge-actions">
            <button onClick={() => { haptic.tap(); handleStartPlacing(); }}><span>На карте</span></button>
            <button onClick={() => { haptic.tap(); handleUseGeo(); }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span>По GPS</span></button>
          </div>
          <button className="map-location-live" onClick={() => { haptic.tap(); setLiveDurPicker(true); }}>
            <span className="map-location-live-dot" /> Трансляция вживую
          </button>
        </div>
      )}
      {!loading && !myLocation && !placingMode && myId && locationPromptCollapsed && sheetSnap === 'peek' && !routeInfo && !navMode && (
        <button className="map-location-reminder tap-effect" onClick={() => { haptic.tap(); setLocationPromptCollapsed(false); }} aria-label="Добавить себя на карту" title="Добавить себя на карту">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5.5-8 11-8 11S4 15.5 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.4"/></svg>
          <span className="map-location-reminder-dot" />
        </button>
      )}

      {/* Placing mode crosshair + actions */}
      {placingMode && (
        <>
          {/* Crosshair в центре экрана / следует за тапом */}
          {pendingCoords && (
            <PlacingPin map={mapRef.current} coords={pendingCoords} onMove={setPendingCoords} />
          )}
          <div style={{
            position:'absolute',
            top:'max(60px, calc(env(safe-area-inset-top, 0) + 60px))',
            left:16, right:16,
            zIndex:10,
            background:'rgba(0,0,0,0.85)',
            backdropFilter:'blur(10px)',
            padding:'10px 14px',
            borderRadius:12,
            color:'#fff',
            fontSize: 'var(--fs-label)',
            textAlign:'center',
          }}>
            Тапни по карте чтобы переместить пин (или GPS), потом подтверди
          </div>
          <div style={{
            position:'absolute',
            bottom:'calc(20px + env(safe-area-inset-bottom, 0))',
            left:16, right:16,
            zIndex:10,
            display:'flex',
            gap:10,
          }}>
            <button
              onClick={handleUseGeo}
              title="Моё местоположение (GPS)"
              style={{
                flexShrink:0, width:46, padding:'12px 0',
                background:'rgba(0,0,0,0.7)',
                backdropFilter:'blur(10px)',
                border:'1px solid rgba(255,255,255,0.2)',
                borderRadius:18, color:'#fff',
                cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
            </button>
            <button
              onClick={handleCancelPlace}
              style={{
                flex:1, padding:'12px',
                background:'rgba(0,0,0,0.7)',
                backdropFilter:'blur(10px)',
                border:'1px solid rgba(255,255,255,0.2)',
                borderRadius:18, color:'#fff',
                fontSize: 'var(--fs-snap14)', fontWeight:500, cursor:'pointer',
              }}
            >Отмена</button>
            <button
              onClick={handleConfirmPlace}
              disabled={!pendingCoords}
              style={{
                flex:2, padding:'12px',
                background: pendingCoords ? '#3B82F6' : 'rgba(59,130,246,0.4)',
                border:'none', borderRadius:18, color:'#fff',
                fontSize: 'var(--fs-snap14)', fontWeight:600,
                cursor: pendingCoords ? 'pointer' : 'default',
              }}
            >Подтвердить</button>
          </div>
        </>
      )}

      {/* Pin info card */}
      {activePin && (
        <PinCard
          pin={activePin}
          isMe={activePin.user_id === myId}
          distance={activePin.user_id === myId ? null : distanceToKm(activePin.lng, activePin.lat)}
          onClose={() => { setActivePin(null); setSearchFocusPin(null); }}
          onChat={handleStartChat}
          onProfile={(userId) => { setActivePin(null); setSearchFocusPin(null); nav('/u/' + userId); }}
          onEdit={() => { setActivePin(null); setSearchFocusPin(null); handleStartPlacing(); }}
          onRoute={(c) => { if (activePin) setSearchFocusPin(activePin); setActivePin(null); setRoutePrompt(c); }}
          onPhoto={(src, alt) => setPhotoViewer({ src, alt })}
        />
      )}

      {/* Маршрут построен — карточка старта с временем, расстоянием и корректной точкой отправления */}
      {routeInfo && !navMode && (
        <div style={{ position:'absolute', bottom:'calc(18px + env(safe-area-inset-bottom, 0))', left:12, right:12, zIndex:36, color:inkFg }}>
          <div style={{ background:inkBg, backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)', border:isLightMap ? '1px solid rgba(0,0,0,0.07)' : '1px solid rgba(255,255,255,0.09)', borderRadius:24, padding:'14px', boxShadow:isLightMap ? '0 14px 34px rgba(0,0,0,0.16)' : '0 16px 38px rgba(0,0,0,0.44)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:11 }}>
              <span style={{ width:46, height:46, borderRadius:15, background: navTravelMode === 'walking' ? 'rgba(86,103,255,0.15)' : 'rgba(59,130,246,0.16)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {navTravelMode === 'walking' ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5667FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4.7" r="1.8"/><path d="M10.6 8.2l1.7 2.2 2.6 1.2"/><path d="M12.1 10.5l-1.3 3.2-2.8 2.3"/><path d="M12.4 10.8l.8 3.9 2.8 2.7"/><path d="M10.6 18.6l-1.2 3"/><path d="M14.8 17.5l.8 3.3"/></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5B9DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11l1.2-3.3A2 2 0 0 1 8.1 6.5h7.8a2 2 0 0 1 1.9 1.2L19 11"/><rect x="3.5" y="11" width="17" height="6.5" rx="2.2"/><path d="M6.5 17.5v1.5M17.5 17.5v1.5"/><circle cx="7.5" cy="14.3" r="1" fill="#5B9DFF" stroke="none"/><circle cx="16.5" cy="14.3" r="1" fill="#5B9DFF" stroke="none"/></svg>
                )}
              </span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'var(--fs-body)', fontWeight:800, lineHeight:1.15 }}>Маршрут готов</div>
                <div style={{ fontSize:'var(--fs-caption)', color:isLightMap ? 'rgba(17,24,39,0.58)' : 'rgba(255,255,255,0.62)', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{travelModeLabel(navTravelMode)} · старт: {routeInfo.originLabel}</div>
              </div>
              <button onClick={clearRoute} aria-label="Убрать маршрут" style={{ width:36, height:36, borderRadius:12, background:isLightMap ? '#F3F4F6' : 'rgba(255,255,255,0.07)', border:'none', color:isLightMap ? '#4B5563' : 'rgba(255,255,255,0.72)', cursor:'pointer', display:'grid', placeItems:'center', flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              </button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
              <div style={{ minHeight:58, borderRadius:16, padding:'10px 12px', background:isLightMap ? '#F3F4F6' : 'rgba(255,255,255,0.065)', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ color:'#5B9DFF', display:'grid', placeItems:'center' }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
                <div><div style={{ fontSize:'var(--fs-caption)', color:isLightMap ? 'rgba(17,24,39,0.54)' : 'rgba(255,255,255,0.56)' }}>Время</div><div style={{ fontSize:'var(--fs-body)', fontWeight:800, marginTop:1 }}>~{Math.max(1, Math.round(routeInfo.dur/60))} мин</div></div>
              </div>
              <div style={{ minHeight:58, borderRadius:16, padding:'10px 12px', background:isLightMap ? '#F3F4F6' : 'rgba(255,255,255,0.065)', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ color:'#5B9DFF', display:'grid', placeItems:'center' }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19 9 5l3 6 3-6 5 14"/><path d="M7 14h10"/></svg></span>
                <div><div style={{ fontSize:'var(--fs-caption)', color:isLightMap ? 'rgba(17,24,39,0.54)' : 'rgba(255,255,255,0.56)' }}>Расстояние</div><div style={{ fontSize:'var(--fs-body)', fontWeight:800, marginTop:1 }}>{(routeInfo.dist/1000).toFixed(1)} км</div></div>
              </div>
            </div>

            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button onClick={() => switchTravelMode('driving')} className="tap-effect" aria-label="Режим водителя" style={modeButtonStyle(navTravelMode === 'driving')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11l1.2-3.3A2 2 0 0 1 8.1 6.5h7.8a2 2 0 0 1 1.9 1.2L19 11"/><rect x="3.5" y="11" width="17" height="6.5" rx="2.2"/><path d="M6.5 17.5v1.5M17.5 17.5v1.5"/><circle cx="7.5" cy="14.3" r="1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="14.3" r="1" fill="currentColor" stroke="none"/></svg>
                Водитель
              </button>
              <button onClick={() => switchTravelMode('walking')} className="tap-effect" aria-label="Пешеходный режим" style={modeButtonStyle(navTravelMode === 'walking')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4.7" r="1.8"/><path d="M10.6 8.2l1.7 2.2 2.6 1.2"/><path d="M12.1 10.5l-1.3 3.2-2.8 2.3"/><path d="M12.4 10.8l.8 3.9 2.8 2.7"/><path d="M10.6 18.6l-1.2 3"/><path d="M14.8 17.5l.8 3.3"/></svg>
                Пешеход
              </button>
            </div>

            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <button onClick={startNavigation} className="tap-effect" aria-label="Начать маршрут" style={{ flex:1, minHeight:50, background:'#3B82F6', border:'none', color:'#fff', borderRadius:16, padding:'0 18px', fontWeight:800, fontSize:'var(--fs-body)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:9, boxShadow:'0 8px 20px rgba(59,130,246,0.28)' }}>
                {navTravelMode === 'walking' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4.7" r="1.8"/><path d="M10.6 8.2l1.7 2.2 2.6 1.2"/><path d="M12.1 10.5l-1.3 3.2-2.8 2.3"/><path d="M12.4 10.8l.8 3.9 2.8 2.7"/><path d="M10.6 18.6l-1.2 3"/><path d="M14.8 17.5l.8 3.3"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11l1.2-3.3A2 2 0 0 1 8.1 6.5h7.8a2 2 0 0 1 1.9 1.2L19 11"/><rect x="3.5" y="11" width="17" height="6.5" rx="2.2"/><path d="M6.5 17.5v1.5M17.5 17.5v1.5"/><circle cx="7.5" cy="14.3" r="1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="14.3" r="1" fill="currentColor" stroke="none"/></svg>
                )}
                Начать маршрут
              </button>
              {routeInfo.dest && (
                <button onClick={() => setOpenInFor(routeInfo.dest!)} className="tap-effect" aria-label="Открыть в другом приложении" style={{ flexShrink:0, width:50, height:50, background:isLightMap ? '#F3F4F6' : 'rgba(255,255,255,0.07)', border:'1px solid ' + (isLightMap ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'), color:inkFg, borderRadius:16, cursor:'pointer', display:'grid', placeItems:'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Кнопка центровки остаётся доступной в навигаторе; в свободном обзоре подсвечивается красным. */}
      {navMode && routeInfo && (
        <button
          onClick={recenterNavigation}
          className="tap-effect map-nav-recenter"
          aria-label="Вернуться к моему местоположению"
          title="Центрировать по мне"
          style={{
            position:'absolute', right:16, bottom:'calc(170px + env(safe-area-inset-bottom, 0px))', zIndex:48,
            width:50, height:50, borderRadius:25,
            background:glassBgStrong, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
            border:glassEdge, color:navFollowing ? glassFg : '#EF4444', boxShadow:glassShadow, cursor:'pointer',
            display:'grid', placeItems:'center',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20.7 3.7 14.1 20c-.28.69-1.27.65-1.49-.06l-1.7-5.47a2 2 0 0 0-1.31-1.31l-5.54-1.75c-.71-.22-.75-1.21-.06-1.49L20.3 3.3c.28-.11.52.13.4.4Z" fill="currentColor"/>
          </svg>
        </button>
      )}

      {/* Навигатор — компактная нижняя панель как в мобильных навигаторах: ETA, режим камеры, открытие вовне и стоп */}
      {navMode && routeInfo && (
        <div style={{ position:'absolute', bottom:'calc(18px + env(safe-area-inset-bottom, 0))', left:14, right:14, zIndex:46, color:inkFg }}>
          <div style={{ background:inkBg, backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:isLightMap ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.08)', borderRadius:24, padding:'14px', boxShadow:isLightMap ? '0 12px 34px rgba(0,0,0,0.16)' : '0 14px 36px rgba(0,0,0,0.44)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ width:48, height:48, borderRadius:16, background: navTravelMode === 'walking' ? 'rgba(86,103,255,0.15)' : 'rgba(59,130,246,0.16)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {navTravelMode === 'walking' ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5667FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4.7" r="1.8"/><path d="M10.6 8.2l1.7 2.2 2.6 1.2"/><path d="M12.1 10.5l-1.3 3.2-2.8 2.3"/><path d="M12.4 10.8l.8 3.9 2.8 2.7"/><path d="M10.6 18.6l-1.2 3"/><path d="M14.8 17.5l.8 3.3"/></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5B9DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11l1.2-3.3A2 2 0 0 1 8.1 6.5h7.8a2 2 0 0 1 1.9 1.2L19 11"/><rect x="3.5" y="11" width="17" height="6.5" rx="2.2"/><path d="M6.5 17.5v1.5M17.5 17.5v1.5"/><circle cx="7.5" cy="14.3" r="1" fill="#5B9DFF" stroke="none"/><circle cx="16.5" cy="14.3" r="1" fill="#5B9DFF" stroke="none"/></svg>
                )}
              </span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'var(--fs-heading)', fontWeight:800, lineHeight:1.05 }}>~{Math.max(1, Math.round(routeInfo.dur/60))} мин</div>
                <div style={{ fontSize:'var(--fs-caption)', color:isLightMap ? 'rgba(17,24,39,0.58)' : 'rgba(255,255,255,0.6)' }}>{(routeInfo.dist/1000).toFixed(1)} км · {travelModeLabel(navTravelMode)} · {navCameraMode === '3d' ? 'вид 3D' : 'схема'}</div>
              </div>
              <button onClick={stopNavigation} className="tap-effect" aria-label="Завершить навигацию" style={{ flexShrink:0, background:'#EF4444', border:'none', color:'#fff', borderRadius:16, padding:'0 18px', minHeight:48, fontWeight:800, fontSize:'var(--fs-label)', cursor:'pointer' }}>Стоп</button>
            </div>

            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button onClick={() => switchTravelMode('driving')} className="tap-effect" aria-label="Режим водителя" style={modeButtonStyle(navTravelMode === 'driving')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11l1.2-3.3A2 2 0 0 1 8.1 6.5h7.8a2 2 0 0 1 1.9 1.2L19 11"/><rect x="3.5" y="11" width="17" height="6.5" rx="2.2"/><path d="M6.5 17.5v1.5M17.5 17.5v1.5"/><circle cx="7.5" cy="14.3" r="1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="14.3" r="1" fill="currentColor" stroke="none"/></svg>
                Водитель
              </button>
              <button onClick={() => switchTravelMode('walking')} className="tap-effect" aria-label="Пешеходный режим" style={modeButtonStyle(navTravelMode === 'walking')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4.7" r="1.8"/><path d="M10.6 8.2l1.7 2.2 2.6 1.2"/><path d="M12.1 10.5l-1.3 3.2-2.8 2.3"/><path d="M12.4 10.8l.8 3.9 2.8 2.7"/><path d="M10.6 18.6l-1.2 3"/><path d="M14.8 17.5l.8 3.3"/></svg>
                Пешеход
              </button>
            </div>

            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={() => setNavigationView('3d')} className="tap-effect" aria-label="Вид 3D" style={{ flex:1, minHeight:42, borderRadius:14, border:'1px solid ' + (navCameraMode === '3d' ? 'transparent' : (isLightMap ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)')), background: navCameraMode === '3d' ? '#111827' : (isLightMap ? '#F3F4F6' : 'rgba(255,255,255,0.06)'), color: navCameraMode === '3d' ? '#fff' : inkFg, fontSize:'var(--fs-label)', fontWeight:700, cursor:'pointer' }}>Вид 3D</button>
              <button onClick={() => setNavigationView('scheme')} className="tap-effect" aria-label="Схема" style={{ flex:1, minHeight:42, borderRadius:14, border:'1px solid ' + (navCameraMode === 'scheme' ? 'transparent' : (isLightMap ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)')), background: navCameraMode === 'scheme' ? '#111827' : (isLightMap ? '#F3F4F6' : 'rgba(255,255,255,0.06)'), color: navCameraMode === 'scheme' ? '#fff' : inkFg, fontSize:'var(--fs-label)', fontWeight:700, cursor:'pointer' }}>Схема</button>
              {routeInfo.dest && (
                <button onClick={() => setOpenInFor(routeInfo.dest!)} className="tap-effect" aria-label="Открыть в другом приложении" style={{ flexShrink:0, minWidth:42, height:42, background:isLightMap ? '#F3F4F6' : 'rgba(255,255,255,0.06)', border:'1px solid ' + (isLightMap ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)'), color:inkFg, borderRadius:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Открыть в другом приложении (маршрут) */}
      {openInFor && (
        <div onClick={() => setOpenInFor(null)} className="map-backdrop-in" style={{ position:'absolute', inset:0, zIndex:70, display:'flex', alignItems:'flex-end', background:'rgba(0,0,0,0.5)' }}>
          <div onClick={e => e.stopPropagation()} className="share-sheet-enter" style={{ width:'100%', background:'var(--bg)', color:'var(--text)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'12px 16px max(20px, env(safe-area-inset-bottom, 20px))', boxShadow:'var(--shadow-2)' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}><div style={{ width:36, height:4, borderRadius:2, background:'var(--border)' }} /></div>
            <h3 style={{ margin:'0 0 12px', fontSize:'var(--fs-title)', fontWeight:'var(--fw-bold)' }}>Открыть маршрут в…</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {mapAppLinks(openInFor.lat, openInFor.lng, 'route', navTravelMode).map(l => (
                <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpenInFor(null)} className="tap-effect"
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 12px', borderRadius:14, background:'var(--surface-2)', color:'var(--text)', textDecoration:'none', fontSize:'var(--fs-body)', fontWeight:600 }}>
                  {l.icon}
                  <span style={{ flex:1 }}>{l.label}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              ))}
              <button onClick={async () => { try { await navigator.clipboard.writeText(`${openInFor.lat.toFixed(6)}, ${openInFor.lng.toFixed(6)}`); haptic.success(); setCoordsCopied(true); setTimeout(() => setCoordsCopied(false), 1500); } catch { /* noop */ } }} className="tap-effect"
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 12px', borderRadius:14, background:'var(--surface-2)', border:'none', color: coordsCopied ? 'var(--accent)' : 'var(--text)', cursor:'pointer', fontSize:'var(--fs-body)', fontWeight:600, textAlign:'left', width:'100%' }}>
                <span style={{ width:34, height:34, borderRadius:10, background:'var(--surface-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {coordsCopied
                    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                </span>
                <span style={{ flex:1 }}>{coordsCopied ? 'Скопировано' : 'Скопировать координаты'}</span>
                <span style={{ fontSize:'var(--fs-caption)', color:'var(--muted)', fontVariantNumeric:'tabular-nums' }}>{openInFor.lat.toFixed(4)}, {openInFor.lng.toFixed(4)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Карточка борта (тап по самолёту на карте) */}
      {activeFlight && (
        <div onClick={() => setActiveFlight(null)} className="map-backdrop-in" style={{ position:'absolute', inset:0, zIndex:47, display:'flex', alignItems:'flex-end', background:'rgba(0,0,0,0.4)' }}>
          <div onClick={e => e.stopPropagation()} className="share-sheet-enter" style={{ width:'100%', background:'var(--bg)', color:'var(--text)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'16px 16px max(20px, env(safe-area-inset-bottom, 20px))', boxShadow:'var(--shadow-2)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <span style={{ width:42, height:42, borderRadius:12, background:'rgba(14,165,233,0.15)', color:'#0EA5E9', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>
              </span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'var(--fs-title)', fontWeight:700 }}>{activeFlight.flight_iata}</div>
                <div style={{ fontSize:'var(--fs-caption)', color:'var(--text2)' }}>{flightStatusRu(activeFlight.status)}{activeFlight.aircraft_icao ? ` · ${activeFlight.aircraft_icao}` : ''}</div>
              </div>
              <button onClick={() => setActiveFlight(null)} aria-label="Закрыть" style={{ background:'var(--surface-light)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text)', cursor:'pointer', width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              </button>
            </div>
            {(activeFlight.dep_iata || activeFlight.arr_iata) && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--surface-light)', borderRadius:12, marginBottom:8 }}>
                <div style={{ flex:1, textAlign:'center', minWidth:0 }}>
                  <div style={{ fontSize:'var(--fs-heading)', fontWeight:700 }}>{activeFlight.dep_iata || '—'}</div>
                  <div style={{ fontSize:'var(--fs-micro)', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activeFlight.dep?.name || ''}</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                <div style={{ flex:1, textAlign:'center', minWidth:0 }}>
                  <div style={{ fontSize:'var(--fs-heading)', fontWeight:700 }}>{activeFlight.arr_iata || '—'}</div>
                  <div style={{ fontSize:'var(--fs-micro)', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activeFlight.arr?.name || ''}</div>
                </div>
              </div>
            )}
            {(activeFlight.alt != null || activeFlight.speed != null) && (
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                {activeFlight.alt != null && <div style={{ flex:1, padding:'8px 12px', background:'var(--surface-light)', borderRadius:10, fontSize:'var(--fs-label)' }}><span style={{ color:'var(--muted)' }}>Высота </span><b>{Math.round(activeFlight.alt)} м</b></div>}
                {activeFlight.speed != null && <div style={{ flex:1, padding:'8px 12px', background:'var(--surface-light)', borderRadius:10, fontSize:'var(--fs-label)' }}><span style={{ color:'var(--muted)' }}>Скорость </span><b>{Math.round(activeFlight.speed)} км/ч</b></div>}
              </div>
            )}
            {flightWho.length > 0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:'var(--fs-caption)', color:'var(--muted)', fontWeight:600, margin:'4px 2px 6px' }}>Кто летит</div>
                {flightWho.map((w, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--surface-light)', borderRadius:10, marginBottom:5 }}>
                    <span style={{ fontSize:'var(--fs-label)', fontWeight:500 }}>{w.name}</span>
                    {w.seat && <span style={{ fontSize:'var(--fs-label)', color:'var(--text2)' }}>место {w.seat}</span>}
                  </div>
                ))}
              </div>
            )}
            {activeFlight.arr?.lat != null && (
              <button onClick={() => { const arr = activeFlight.arr; setActiveFlight(null); routeFromGps({ lng: arr.lng, lat: arr.lat }); }} className="tap-effect"
                style={{ width:'100%', padding:'13px', borderRadius:'var(--r-md)', border:'none', background:'var(--accent)', color:'var(--bg)', fontWeight:600, fontSize:'var(--fs-label)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Маршрут до {activeFlight.arr_iata || 'прилёта'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Выбор старта маршрута: от моей точки или от GPS */}
      {routePrompt && (
        <div onClick={() => setRoutePrompt(null)} className="map-backdrop-in" style={{ position:'absolute', inset:0, zIndex:48, display:'flex', alignItems:'flex-end', background:'rgba(0,0,0,0.4)' }}>
          <div onClick={e => e.stopPropagation()} className="share-sheet-enter" style={{ width:'100%', background:'var(--bg)', color:'var(--text)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'var(--sp-4) var(--sp-4) max(var(--sp-5), env(safe-area-inset-bottom, 20px))', boxShadow:'var(--shadow-2)' }}>
            <div style={{ fontSize:'var(--fs-heading)', fontWeight:'var(--fw-semibold)', marginBottom:4 }}>Построить маршрут</div>
            <div style={{ fontSize:'var(--fs-caption)', color:'var(--muted)', marginBottom:'var(--sp-4)' }}>Откуда строить{routePrompt.title ? ` до «${routePrompt.title}»` : ''}?</div>
            {myLocation && (
              <button onClick={() => { const to = routePrompt!; setRoutePrompt(null); drawRoute(myLocation!, to, { originLabel: 'Моя точка на карте' }); }} className="tap-effect"
                style={{ width:'100%', padding:'13px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontWeight:600, fontSize:'var(--fs-label)', cursor:'pointer', marginBottom:'var(--sp-2)', display:'flex', alignItems:'center', gap:10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                От моей точки на карте
              </button>
            )}
            <button onClick={() => { const to = routePrompt!; setRoutePrompt(null); routeFromGps(to); }} className="tap-effect"
              style={{ width:'100%', padding:'13px', borderRadius:'var(--r-md)', border:'none', background:'var(--accent)', color:'var(--bg)', fontWeight:600, fontSize:'var(--fs-label)', cursor:'pointer', display:'flex', alignItems:'center', gap:10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
              От текущего местоположения (GPS)
            </button>
          </div>
        </div>
      )}

      {/* Snapchat-style: нижний sheet со списком всех Sigmas */}
      {!placingMode && !poiPlacing && !poiCoords && !activePin && !activePoi && !activeEvent && !activeFlight && !showPoiList && !navMode && !routeInfo && (
        <FriendsBottomSheet
          mapLight={isLightMap}
          myId={myId}
          locations={locations}
          allUsers={allUsers}
          events={layers.events ? Object.values(events).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()) : []}
          points={layers.points ? mapPoints : []}
          onEventTap={(ev) => {
            if (ev.location_lng != null && ev.location_lat != null && mapRef.current) {
              mapRef.current.flyTo({ center: [ev.location_lng, ev.location_lat], zoom: 13, duration: 1200 });
            }
            setSheetSnap('peek');
            setActivePin(null);
            setActivePoi(null);
            setActiveFlight(null);
            setShowPoiList(false);
            setActiveEvent(ev);
          }}
          onPointTap={(p) => {
            if (mapRef.current) mapRef.current.flyTo({ center: [p.lng, p.lat], zoom: 15, duration: 1200 });
            setSheetSnap('peek');
            setActivePin(null);
            setActiveEvent(null);
            setActiveFlight(null);
            setShowPoiList(false);
            setActivePoi(p);
          }}
          onChat={handleStartChat}
          onSnapChange={setSheetSnap}
          onMotionProgress={setLayerStripMotion}
          onFriendTap={(loc) => {
            if (mapRef.current) {
              mapRef.current.flyTo({ center: [loc.lng, loc.lat], zoom: 14, duration: 1200 });
            }
            setActivePin(loc);
          }}
          onMyLocationTap={() => {
            if (myLocation && mapRef.current) {
              mapRef.current.flyTo({ center: [myLocation.lng, myLocation.lat], zoom: 14, duration: 1200 });
            }
          }}
        />
      )}

      {photoViewer && (
        <div style={{ position:'fixed', inset:0, zIndex:500, background:'#000' }}>
          <ZoomableImage src={photoViewer.src} alt={photoViewer.alt || ''} onClose={() => setPhotoViewer(null)} />
          <button onClick={() => setPhotoViewer(null)} aria-label="Закрыть фото" style={{ position:'absolute', top:'max(12px, env(safe-area-inset-top, 12px))', right:12, width:40, height:40, borderRadius:20, border:'1px solid rgba(255,255,255,0.18)', background:'#000', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', zIndex:2, boxShadow:'0 6px 18px rgba(0,0,0,0.35)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Settings sheet */}
      {showSettings && myLocation && (
        <SettingsSheet
          isVisible={myLocation.visible}
          liveSharing={liveSharing}
          mapStyle={mapStyle}
          onMapStyle={applyMapStyle}
          onToggleLive={() => { liveSharing ? stopLive() : setLiveDurPicker(true); }}
          onClose={() => setShowSettings(false)}
          onMove={() => { setShowSettings(false); handleStartPlacing(); }}
          onHide={handleHide}
          onShow={handleShow}
          onRemove={handleRemove}
        />
      )}
    </div>
  );
}

// ============ PlacingPin (большой пин-прицел поверх центра) ============

function PlacingPin({ map, coords, onMove }: {
  map: mapboxgl.Map | null;
  coords: { lng: number; lat: number };
  onMove: (c: { lng: number; lat: number }) => void;
}) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    // Внешний контейнер строго фиксированного размера (Mapbox позиционирует ЕГО центр)
    const el = document.createElement('div');
    el.style.width = '52px';
    el.style.height = '52px';
    el.style.position = 'relative';
    el.style.cursor = 'grab';
    el.style.boxSizing = 'border-box';

    // Внутренняя точка — visual marker
    const dot = document.createElement('div');
    dot.style.width = '100%';
    dot.style.height = '100%';
    dot.style.borderRadius = '50%';
    dot.style.background = '#3B82F6';
    dot.style.border = '4px solid #fff';
    dot.style.boxShadow = '0 4px 14px rgba(0,0,0,0.4)';
    dot.style.boxSizing = 'border-box';
    // Анимация на внутреннем dot, не на el — иначе ломает Mapbox positioning
    dot.classList.add('map-marker-drop');
    el.appendChild(dot);

    // Pulse ring — absolutely positioned, не влияет на bounding box, не ловит pointer events
    const pulse = document.createElement('div');
    pulse.style.position = 'absolute';
    pulse.style.inset = '-12px';
    pulse.style.borderRadius = '50%';
    pulse.style.border = '2px solid #3B82F6';
    pulse.style.opacity = '0.5';
    pulse.style.animation = 'mapPulse 2s ease-out infinite';
    pulse.style.pointerEvents = 'none';
    el.appendChild(pulse);

    const m = new mapboxgl.Marker({ element: el, draggable: true, anchor: 'center' })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);

    m.on('dragend', () => {
      const ll = m.getLngLat();
      onMove({ lng: ll.lng, lat: ll.lat });
    });

    markerRef.current = m;
    return () => { try { m.remove(); } catch {} markerRef.current = null; };
  }, [map]);

  // Update position when coords change externally
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLngLat([coords.lng, coords.lat]);
    }
  }, [coords.lng, coords.lat]);

  return (
    <style>{`
      @keyframes mapPulse {
        0% { transform: scale(0.8); opacity: 0.5; }
        100% { transform: scale(1.6); opacity: 0; }
      }
    `}</style>
  );
}

// ============ Pin info card (мини-карточка снизу при тапе) ============

function PinCard({ pin, isMe, distance, onClose, onChat, onProfile, onEdit, onRoute, onPhoto }: {
  pin: UserLocation;
  isMe: boolean;
  distance?: string | null;
  onClose: () => void;
  onChat: (userId: string) => void;
  onProfile: (userId: string) => void;
  onEdit: () => void;
  onRoute: (c: { lng: number; lat: number; title?: string }) => void;
  onPhoto?: (src: string, alt?: string) => void;
}) {
  const u = pin.user;
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) setDragY(dy); // только вниз
  };
  const onTouchEnd = () => {
    if (dragY > 80) {
      onClose();
    } else {
      setDragY(0); // вернуть
    }
    startYRef.current = null;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position:'absolute',
        inset:0,
        zIndex:50,
        background:`rgba(0,0,0,${Math.max(0.1, 0.4 - dragY / 400)})`,
        display:'flex',
        alignItems:'flex-end',
        animation: dragY === 0 ? 'mapFadeIn 0.2s ease' : 'none',
        transition: 'background 0.15s',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          width:'100%',
          background:'var(--bg)',
          borderRadius:'var(--r-xl) var(--r-xl) 0 0',
          padding:'12px 16px max(20px, env(safe-area-inset-bottom, 20px))',
          boxShadow:'var(--shadow-2)',
          animation: dragY === 0 ? 'mapSlideUp 0.25s ease' : 'none',
          transform: `translateY(${dragY}px)`,
          transition: dragY === 0 ? 'transform 0.2s' : 'none',
          touchAction: 'none',
        }}
      >
        <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
          {u?.avatar_url
            ? <button onClick={() => onPhoto?.(u.avatar_url!, u.display_name || 'Фото')} aria-label="Открыть фото" style={{ width:48, height:48, borderRadius:24, padding:0, border:'none', background:'none', cursor:'zoom-in', flexShrink:0, overflow:'hidden' }}><img src={u.avatar_url} alt="" style={{width:'100%',height:'100%',borderRadius:24,objectFit:'cover',display:'block'}} /></button>
            : <div style={{width:48,height:48,borderRadius:24,background:avatarColor(pin.user_id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-heading)',fontWeight:600,flexShrink:0}}>{(u?.display_name || '?')[0].toUpperCase()}</div>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize: 'var(--fs-snap16)', fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
              {u?.display_name || 'Пользователь'}
            </div>
            {isMe && <div style={{fontSize: 'var(--fs-caption)', color:'var(--muted)'}}>Это вы</div>}
            {!isMe && distance && <div style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', marginTop:2, display:'flex', alignItems:'center', gap:5}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{distance} от вас</div>}
          </div>
        </div>

        {isMe ? (
          <div style={{display:'flex',gap:8}}>
            <button
              onClick={onEdit}
              style={{flex:1, padding:'12px', background:'var(--primary)', color:'var(--bg)', border:'none', borderRadius:10, fontSize: 'var(--fs-snap14)', fontWeight:600, cursor:'pointer'}}
            >Переместить</button>
            <button
              onClick={() => onProfile(pin.user_id)}
              style={{flex:1, padding:'12px', background:'var(--surface-light)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:10, fontSize: 'var(--fs-snap14)', fontWeight:500, cursor:'pointer'}}
            >Профиль</button>
          </div>
        ) : (
          <>
            <div style={{display:'flex',gap:8,marginBottom:8}}>
              <button
                onClick={() => onChat(pin.user_id)}
                style={{flex:1, padding:'12px', background:'var(--primary)', color:'var(--bg)', border:'none', borderRadius:10, fontSize: 'var(--fs-snap14)', fontWeight:600, cursor:'pointer'}}
              >Написать</button>
              <button
                onClick={() => onProfile(pin.user_id)}
                style={{flex:1, padding:'12px', background:'var(--surface-light)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:10, fontSize: 'var(--fs-snap14)', fontWeight:500, cursor:'pointer'}}
              >Профиль</button>
            </div>
            <button
              onClick={() => onRoute({ lng: pin.lng, lat: pin.lat, title: u?.display_name })}
              style={{
                width:'100%', padding:'12px',
                background:'var(--surface-light)', color:'var(--text)',
                border:'1px solid var(--border)', borderRadius:10,
                fontSize: 'var(--fs-snap14)', fontWeight:600, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              Маршрут
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes mapFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mapSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  );
}

// ============ Settings sheet (моя точка — переместить/скрыть/удалить) ============

function SettingsSheet({ isVisible, liveSharing, mapStyle, onMapStyle, onToggleLive, onClose, onMove, onHide, onShow, onRemove }: {
  isVisible: boolean;
  liveSharing: boolean;
  mapStyle: MapStyleKey;
  onMapStyle: (k: MapStyleKey) => void;
  onToggleLive: () => void;
  onClose: () => void;
  onMove: () => void;
  onHide: () => void;
  onShow: () => void;
  onRemove: () => void;
}) {
  const [hap, setHap] = useState(isHapticsOn());
  // Drag-to-close: тянем за грабер/шапку — шит следует за пальцем, >90px вниз — закрытие
  const [dragY, setDragY] = useState(0);
  const dragRef = useRef<{ y: number; on: boolean } | null>(null);
  const onDragStart = (e: React.TouchEvent) => { dragRef.current = { y: e.touches[0].clientY, on: true }; };
  const onDragMove = (e: React.TouchEvent) => {
    if (!dragRef.current?.on) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragRef.current.y));
  };
  const onDragEnd = () => {
    if (!dragRef.current?.on) return;
    dragRef.current.on = false;
    if (dragY > 90) { onClose(); }
    setDragY(0);
  };
  return (
    <div onClick={onClose} className="map-backdrop-in" style={{
      position:'absolute', inset:0, zIndex:50,
      background:'rgba(0,0,0,0.4)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} className="share-sheet-enter" style={{
        width:'100%',
        background:'var(--bg)',
        borderRadius:'var(--r-xl) var(--r-xl) 0 0',
        padding:'12px 0 max(20px, env(safe-area-inset-bottom, 20px))',
        boxShadow:'var(--shadow-2)',
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        transition: dragY ? 'none' : 'transform .28s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <div onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd} onTouchCancel={onDragEnd} style={{display:'flex',justifyContent:'center',marginBottom:12, padding:'2px 0 8px', touchAction:'none'}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        <div style={{ padding:'0 16px 14px', fontSize:'var(--fs-heading)', fontWeight:700, color:'var(--text)' }}>Настройки</div>

        {/* Стиль (режим) карты */}
        <div style={{ padding:'0 16px 12px' }}>
          <div style={{ fontSize:'var(--fs-caption)', color:'var(--muted)', marginBottom:8, fontWeight:600 }}>Стиль карты</div>
          <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:2 }}>
            {MAP_STYLE_OPTIONS.map(o => {
              const on = mapStyle === o.key;
              return (
                <button key={o.key} onClick={() => onMapStyle(o.key)} className="tap-effect"
                  style={{ flexShrink:0, padding:'8px 14px', borderRadius:'var(--pill)', border:'1px solid ' + (on ? 'transparent' : 'var(--border)'), background: on ? 'var(--text)' : 'var(--surface-2)', color: on ? 'var(--bg)' : 'var(--text)', fontSize:'var(--fs-label)', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding:'0 16px' }}>
          <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <SheetItem
              icon={isVisible
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>}
              label={isVisible ? 'Скрыться с карты' : 'Показаться на карте'}
              onClick={isVisible ? onHide : onShow}
            />

            {/* Вибрация (тактильный отклик) */}
            <button onClick={() => { const v = !hap; setHap(v); setHapticsOn(v); if (v) haptic.select(); }} style={{
              width:'100%', padding:'13px 14px', background:'none', border:'none',
              borderBottom:'1px solid var(--border)', textAlign:'left',
              color:'var(--text)', fontSize:'var(--fs-body)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
            }}>
              <span style={{ display:'flex', alignItems:'center', gap:12 }}><span style={{ display:'flex', color:'var(--text2)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="20" rx="1.5"/><path d="M4 8v8M20 8v8"/></svg></span>Вибрация</span>
              <span style={{ width:42, height:25, borderRadius:13, background: hap ? 'var(--accent)' : 'var(--border)', position:'relative', transition:'background 200ms', flexShrink:0 }}>
                <span style={{ position:'absolute', top:2.5, left: hap ? 19.5 : 2.5, width:20, height:20, borderRadius:10, background:'#fff', transition:'left 200ms' }} />
              </span>
            </button>

            <SheetItem
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>}
              label="Удалить точку насовсем"
              onClick={onRemove}
              danger
              last
            />
          </div>
        </div>

        <div style={{padding:'8px 16px 0'}}>
          <button onClick={onClose} style={{width:'100%', padding:'12px', background:'var(--surface-light)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text)', fontSize: 'var(--fs-snap14)', fontWeight:500, cursor:'pointer'}}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

function SheetItem({ icon, label, onClick, danger, last }: { icon?: React.ReactNode; label: string; onClick: () => void; danger?: boolean; last?: boolean }) {
  return (
    <button onClick={onClick} className="tap-effect" style={{
      width:'100%',
      padding:'13px 14px',
      background:'none',
      border:'none',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      textAlign:'left',
      color: danger ? '#EF4444' : 'var(--text)',
      fontSize: 'var(--fs-body)',
      cursor:'pointer',
      display:'flex', alignItems:'center', gap:12,
    }}>
      {icon && <span style={{ display:'flex', color: danger ? '#EF4444' : 'var(--text2)', flexShrink:0 }}>{icon}</span>}
      {label}
    </button>
  );
}
