import { Outlet, useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';
import { useChatStore } from '@/stores/chatStore';
import { useActiveCallsStore } from '@/stores/activeCallsStore';
import { useMapStore } from '@/stores/mapStore';
import { useEventsStore } from '@/stores/eventsStore';
import { banner, toast } from '@/stores/toastStore';
import { initNotifications } from '@/lib/notifications';
import { networkManager } from '@/lib/networkManager';
import { resolveChatBackground } from '@/lib/chatBackgrounds';
import { useIsDesktop } from '@/lib/useIsDesktop';
import CallOverlay from '@/components/CallOverlay';
import ErrorBoundary from '@/components/ErrorBoundary';
import ToastContainer from '@/components/ToastContainer';
import AudioMiniPlayer from '@/components/AudioMiniPlayer';
import AlarmWatcher from '@/components/AlarmWatcher';
import GlobalCallPill from '@/components/GlobalCallPill';
import VideoMiniPlayer from '@/components/VideoMiniPlayer';
import VideoTopBar from '@/components/VideoTopBar';
import OfflineBanner from '@/components/OfflineBanner';
// Главные вкладки — держим смонтированными (keep-alive), чтобы переключение было без перезагрузки
import Chats from '@/pages/Chats';
import Feed from '@/pages/Feed';
import Profile from '@/pages/Profile';

function useGlobalBackground(val: string | null) {
  return useMemo(() => val ? resolveChatBackground(val) : null, [val]);
}

const Ic = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

// Корневые таб-роуты — между ними используем fade-вариант перехода
const TAB_ROUTES = ['/chats', '/feed', '/profile'];
function isTabRoute(path: string): boolean {
  return TAB_ROUTES.includes(path);
}

// Главные вкладки, которые держим смонтированными (keep-alive).
// Каждая монтируется при ПЕРВОМ заходе и далее просто скрывается через display:none,
// поэтому переключение мгновенное, скролл/состояние/данные сохраняются, лоадер не мигает.
const KEEP_ALIVE_TABS: { path: string; Comp: React.ComponentType }[] = [
  { path: '/chats', Comp: Chats },
  { path: '/feed', Comp: Feed },
  { path: '/profile', Comp: Profile },
];

export default function Layout() {
  const { session, user: authUser } = useAuthStore();
  // Десктоп-режим (Telegram-like): рельса слева + двухколоночные Чаты/События
  const isDesktop = useIsDesktop();
  useEffect(() => {
    document.body.classList.toggle('is-desktop', isDesktop);
    return () => document.body.classList.remove('is-desktop');
  }, [isDesktop]);
  // Префетч данных Событий в фоне (idle): переключение на вкладку — без экрана загрузки.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    const t = window.setTimeout(() => {
      const st = useEventsStore.getState();
      if (Object.keys(st.events).length === 0) st.loadEvents(uid).catch(() => {});
    }, 1800);
    return () => clearTimeout(t);
  }, [session?.user?.id]);
  const { initPeerJS, init100ms, subscribeToCallSignals } = useCallStore();
  const totalUnread = useChatStore(s => s.totalUnread);

  // Активные звонки в группах (realtime) — для плашки/бейджа/пилюли
  useEffect(() => {
    if (!session?.user?.id) return;
    const store = useActiveCallsStore.getState();
    store.subscribe();
    return () => store.unsubscribe();
  }, [session?.user?.id]);

  // Возобновляем постоянную трансляцию геолокации, если была включена
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    let on = false;
    try { on = localStorage.getItem('sigmas_live_share') === '1'; } catch { /* noop */ }
    if (on) useMapStore.getState().startLiveShare(uid);
    return () => { useMapStore.getState().stopLiveShare(false); };
  }, [session?.user?.id]);

  // Pulse-эффект при росте непрочитанных
  const [badgePulse, setBadgePulse] = useState(false);
  const prevUnreadRef = useRef(totalUnread);
  useEffect(() => {
    if (totalUnread > prevUnreadRef.current) {
      setBadgePulse(true);
      const t = setTimeout(() => setBadgePulse(false), 2800); // 2 цикла pulse
      prevUnreadRef.current = totalUnread;
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = totalUnread;
  }, [totalUnread]);

  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onServiceWorkerMessage = (event: MessageEvent) => {
      const payload = event.data as { type?: string; url?: string } | null;
      if (payload?.type !== 'SIGMAS_NAVIGATE' || !payload.url) return;
      nav(payload.url);
    };
    navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
  }, [nav]);
  const tabPaths = useMemo(() => ['/chats', '/feed', '/profile'], []);
  const activeTabIndex = tabPaths.indexOf(location.pathname);
  const tabbarRef = useRef<HTMLElement | null>(null);
  const tabGestureRef = useRef<{ pointerId: number; startX: number; startY: number; lastX: number; lastT: number; velocityX: number; dragging: boolean } | null>(null);
  const suppressTabClickRef = useRef(false);
  const [tabDragX, setTabDragX] = useState(0);
  const tabDragXRef = useRef(0);
  const [tabDragging, setTabDragging] = useState(false);

  useEffect(() => {
    tabDragXRef.current = 0;
    setTabDragX(0);
    setTabDragging(false);
    tabGestureRef.current = null;
  }, [location.pathname, tabPaths.length]);

  const onTabPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (isDesktop || activeTabIndex < 0 || event.button !== 0) return;
    tabGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastT: performance.now(),
      velocityX: 0,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onTabPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = tabGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || activeTabIndex < 0) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        tabGestureRef.current = null;
        return;
      }
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
      gesture.dragging = true;
      suppressTabClickRef.current = true;
      setTabDragging(true);
    }
    const now = performance.now();
    const dt = Math.max(1, now - gesture.lastT);
    gesture.velocityX = (event.clientX - gesture.lastX) / dt;
    gesture.lastX = event.clientX;
    gesture.lastT = now;
    const width = (tabbarRef.current?.clientWidth || window.innerWidth) / Math.max(1, tabPaths.length);
    const min = -activeTabIndex * width;
    const max = (tabPaths.length - 1 - activeTabIndex) * width;
    const nextDrag = Math.max(min, Math.min(max, dx));
    tabDragXRef.current = nextDrag;
    setTabDragX(nextDrag);
  };

  const finishTabGesture = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = tabGestureRef.current;
    tabGestureRef.current = null;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    const width = (tabbarRef.current?.clientWidth || window.innerWidth) / Math.max(1, tabPaths.length);
    const dragX = tabDragXRef.current;
    const projectedDrag = dragX + gesture.velocityX * 120;
    const nextIndex = Math.max(0, Math.min(tabPaths.length - 1, Math.round(activeTabIndex + projectedDrag / width)));
    setTabDragging(false);
    if (gesture.dragging) {
      const snapOffset = (nextIndex - activeTabIndex) * width;
      tabDragXRef.current = snapOffset;
      setTabDragX(snapOffset);
      if (nextIndex !== activeTabIndex) {
        window.setTimeout(() => nav(tabPaths[nextIndex]), 120);
      } else {
        window.setTimeout(() => { tabDragXRef.current = 0; setTabDragX(0); }, 120);
      }
    } else {
      tabDragXRef.current = 0;
      setTabDragX(0);
    }
    window.setTimeout(() => { suppressTabClickRef.current = false; }, 180);
  };
  // ВАЖНО: эти вычисления должны идти ДО эффекта visitedTabs ниже (иначе TDZ-краш в проде)
  const inChat = location.pathname.startsWith('/chat/');
  const inEventsDetail = location.pathname.startsWith('/events/');
  // На десктопе слева всегда живёт «список» секции: Чаты для /chat/*, События для /events/*
  const desktopListTab = isDesktop ? (inChat ? '/chats' : null) : null;
  const splitMode = isDesktop && (inChat || location.pathname === '/chats');
  const navType = useNavigationType(); // POP при swipe-back, PUSH при forward
  // Запоминаем предыдущий путь чтобы определить характер перехода (между табами / на детальную)
  const prevPathRef = useRef<string>(location.pathname);
  useEffect(() => {
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  // Keep-alive главных вкладок: какая вкладка активна сейчас + какие уже посещались.
  // Посещённые остаются смонтированными; активную показываем, остальные скрываем.
  const activeTabKey = KEEP_ALIVE_TABS.find(t => t.path === location.pathname)?.path ?? null;
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => activeTabKey ? new Set([activeTabKey]) : new Set());
  useEffect(() => {
    const need = [activeTabKey, desktopListTab].filter(Boolean) as string[];
    if (need.length === 0) return;
    setVisitedTabs(prev => {
      let changed = false; const next = new Set(prev);
      need.forEach(k => { if (!next.has(k)) { next.add(k); changed = true; } });
      return changed ? next : prev;
    });
  }, [activeTabKey, desktopListTab]);

  // Offline detection — глобальный banner
  const [offline, setOffline] = useState(!navigator.onLine);
  const [navHidden, setNavHidden] = useState(false);
  const navSwipeY = useRef<number | null>(null);
  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      // Кратко показываем «снова в сети»
      toast.success('Снова в сети', 2000);
    };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Banner-напоминание о событиях за ~1 час до начала
  const events = useEventsStore(s => s.events);
  const alertedEventsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      Object.values(events).forEach(ev => {
        if (ev.status !== 'planned') return;
        if (ev.myRsvp !== 'going') return;
        if (alertedEventsRef.current.has(ev.id)) return;
        const startMs = new Date(ev.start_at).getTime();
        const diffMin = (startMs - now) / 60000;
        // Окно: 55-65 минут до начала
        if (diffMin > 55 && diffMin < 65) {
          alertedEventsRef.current.add(ev.id);
          const eventIcon = ev.type === 'party' ? 'event-party' : ev.type === 'trip' ? 'event-trip' : 'event-calendar';
          banner.show({
            title: ev.title,
            message: `Через ~1 час${ev.location_name ? ' · ' + ev.location_name : ''}`,
            icon: eventIcon,
            type: 'event',
            onClick: () => nav('/events/' + ev.id),
            duration: 12000,
          });
        }
      });
    };
    check(); // сразу
    const t = setInterval(check, 60_000); // каждую минуту
    return () => clearInterval(t);
  }, [events]);
  // Полноэкранные роуты (игры, чат, рисовалка, карта) — без таб-бара
  const fullscreenRoutes = [
    '/chat/',
    '/poker/table/',
    '/chess/',
    '/mafia/',
    '/alias',
    '/tod',
    '/notes/play/',
    '/pixel',
    '/storage-admin',
    '/languages',
    '/learn/settings',
    '/quizzes',
    '/map',
    '/events/',
    '/profile/',
    '/stories/new',
    '/feed/new',
    '/apps',
    '/feedback',
    '/admin',
    '/diag',
    '/status-admin',
  ];
  const inFullscreen = fullscreenRoutes.some(r =>
    r.endsWith('/') ? location.pathname.startsWith(r) : location.pathname === r || location.pathname.startsWith(r + '/')
  );


  // Нижняя панель больше не авто-скрывается на основных вкладках.
  // На iPhone это выглядело как пропадающая навигация при листании чатов,
  // поэтому держим её стабильной; полноэкранные роуты по-прежнему скрывают tab-bar.
  useEffect(() => {
    setNavHidden(false);
    document.body.dataset.fullscreenRoute = inFullscreen && !isDesktop ? 'true' : 'false';
    return () => { document.body.dataset.fullscreenRoute = 'false'; };
  }, [inFullscreen, isDesktop, location.pathname]);


  // Глобальные обои всего приложения (если пользователь установил default_chat_background)
  // Внутри чата используем свой layer (он учитывает override на уровне chat membership),
  // поэтому здесь рендерим только для остальных страниц.
  const globalBgVal = (authUser as any)?.default_chat_background || null;
  const globalBgCss = null as string | null;
  void useGlobalBackground; void globalBgVal; // suppress unused

  useEffect(() => {
    if (!session?.user?.id) return;
    initPeerJS(session.user.id);
    init100ms();
    initNotifications(session.user.id);
    const unsub = subscribeToCallSignals(session.user.id);
    // Отправляем неотправленные сообщения из оффлайн-очереди
    networkManager.syncQueue();
    return unsub;
  }, [session?.user?.id]);

  return (
    <div className="layout" data-has-app-bg={globalBgCss && !inChat ? 'true' : undefined}>
      {globalBgCss && !inChat && (
        <div className="app-bg-layer" style={{ background: globalBgCss }} aria-hidden="true" />
      )}
      {/* Offline bar — глобальный indicator */}
      {offline && (
        <div className="offline-banner-enter" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 10001,
          background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
          color: '#fff',
          padding: 'calc(env(safe-area-inset-top, 0px) + 6px) 12px 6px',
          fontSize: 'var(--fs-caption)', fontWeight: 600,
          textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
          Нет интернета
        </div>
      )}
      <div className="layout-body" data-split={splitMode ? '1' : undefined} style={{ paddingBottom: 0 }}>
        <AudioMiniPlayer />
        <VideoTopBar />
        <VideoMiniPlayer />
        <AlarmWatcher />
        <GlobalCallPill />
        {/* Keep-alive: посещённые главные вкладки остаются в DOM, активную показываем, */}
        {/* остальные скрываем через display:none — переключение без перемонтирования. */}
        {KEEP_ALIVE_TABS.filter(({ path }) => visitedTabs.has(path)).map(({ path, Comp }) => (
          <div key={path} className="ka-tab" style={{ height: '100%', display: (path === activeTabKey || path === desktopListTab) ? 'block' : 'none' }}>
            <ErrorBoundary name={'tab:' + path} variant="page" key={path}>
              <Comp />
            </ErrorBoundary>
          </div>
        ))}
        {isDesktop && splitMode && !inChat && !inEventsDetail && (
          <div className="dt-placeholder" aria-hidden="true">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              {location.pathname === '/chats'
                ? <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                : <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />}
            </svg>
            <div>Выберите чат</div>
          </div>
        )}
        {/* Остальные роуты (детальные/полноэкранные) — как раньше, через Outlet с анимацией входа. */}
        {!activeTabKey && (
          <div
            key={location.pathname}
            className={'route-page ' + (
              navType === 'POP' || inFullscreen || isDesktop
                ? ''
                : location.pathname.startsWith('/chat/')
                ? ''
                : 'page-enter'
            )}
            style={{ height: '100%' }}
          >
            <ErrorBoundary
              name={'route:' + location.pathname.split('/')[1]}
              variant="page"
              // Сбрасываем границу при смене маршрута — иначе одна ошибка на /chats
              // блокирует и /events, /map, /apps до перезагрузки
              key={location.pathname.split('/')[1]}
            >
              <Outlet />
            </ErrorBoundary>
          </div>
        )}
      </div>
      {(!inFullscreen || isDesktop) && <nav
        ref={tabbarRef}
        className={'tab-bar' + (navHidden && !isDesktop ? ' tabbar-hidden' : '') + (tabDragging ? ' tabbar-dragging' : '')}
        style={{
          ['--tab-count' as any]: tabPaths.length,
          ['--tab-index' as any]: Math.max(0, activeTabIndex),
          ['--tab-drag-x' as any]: `${tabDragX}px`,
        }}
        onPointerDown={onTabPointerDown}
        onPointerMove={onTabPointerMove}
        onPointerUp={finishTabGesture}
        onPointerCancel={finishTabGesture}
        onClickCapture={(event) => {
          if (!suppressTabClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {!isDesktop && activeTabIndex >= 0 && <span className="tabbar-active-slider" aria-hidden="true" />}
        <div className="desktop-rail-brand" aria-hidden="true">
          <div className="desktop-rail-logo"><Ic d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" size={18} /></div>
          <div className="desktop-rail-caption">Sigmas</div>
        </div>
        <button
          type="button"
          className={location.pathname === '/chats' ? 'active' : ''}
          onClick={() => location.pathname !== '/chats' && nav('/chats')}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Чаты"
        >
          <span className="t-icon" style={{position:'relative'}}>
            <Ic d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            {totalUnread > 0 && <span className={`tab-badge${badgePulse ? ' notification-badge-pulse' : ''}`}>{totalUnread > 99 ? '99+' : totalUnread}</span>}
          </span>
        </button>
        <button
          type="button"
          className={location.pathname === '/feed' ? 'active' : ''}
          onClick={() => location.pathname !== '/feed' && nav('/feed')}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Sigmas"
        >
          <span className="t-icon" aria-hidden="true">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 10.4 12 3.5l8.5 6.9v9.1a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6.2H9.2V21H5a1.5 1.5 0 0 1-1.5-1.5z"/>
            </svg>
          </span>
        </button>
        <button
          type="button"
          className={location.pathname === '/profile' ? 'active' : ''}
          onClick={() => location.pathname !== '/profile' && nav('/profile')}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Настройки"
        >
          <span className="t-icon"><Ic d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" /></span>
        </button>
      </nav>}
      {!inFullscreen && !isDesktop && navHidden && (
        <div
          className="tabbar-swipe-zone"
          onTouchStart={(e) => { navSwipeY.current = e.touches[0].clientY; }}
          onTouchMove={(e) => { if (navSwipeY.current != null && navSwipeY.current - e.touches[0].clientY > 22) { navSwipeY.current = null; setNavHidden(false); } }}
          onTouchEnd={() => { navSwipeY.current = null; }}
          aria-hidden="true"
        >
          <span className="tabbar-grabber" />
        </div>
      )}
      <CallOverlay />
      <OfflineBanner />
      <ToastContainer />
    </div>
  );
}
