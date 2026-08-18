import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePostStore } from '@/stores/postStore';
import type { FeedEventFilter } from '@/stores/postStore';
import { avatarColor } from '@/lib/utils';
import { diag } from '@/lib/diag';
import type { PostMedia, PostWithDetails } from '@/types';
import { captureVideoPoster } from '@/lib/mediaPreview';
import { bufferedAhead } from '@/lib/videoWarmup';
import CommentsSheet from '@/components/CommentsSheet';
import LikeButton from '@/components/LikeButton';
import PullToRefresh from '@/components/PullToRefresh';
import AnimatedNumber from '@/components/AnimatedNumber';
import { SkeletonPost, SkeletonPostGrid } from '@/components/Skeleton';
import { haptic } from '@/lib/haptics';
import { useStoriesStore } from '@/stores/storiesStore';
import { useEventsStore } from '@/stores/eventsStore';
import PostLikesSheet from '@/components/PostLikesSheet';

type FeedMode = 'normal' | 'grid';




function FeedVideoMedia({ media, onRatio }: { media: PostMedia; onRatio: (ratio: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const [poster, setPoster] = useState<string | undefined>(media.preview_url || undefined);
  const [warm, setWarm] = useState(false);
  const [buffering, setBuffering] = useState(false);

  useEffect(() => {
    setPoster(media.preview_url || undefined);
    if (media.preview_url) return;

    let cancelled = false;
    let localPoster: string | null = null;
    captureVideoPoster(media.file_url, true)
      .then(({ blob, width, height }) => {
        if (cancelled) return;
        if (width > 0 && height > 0) onRatio(width / height);
        localPoster = URL.createObjectURL(blob);
        setPoster(localPoster);
      })
      .catch(() => { /* remote CORS/codec fallback */ });

    return () => {
      cancelled = true;
      if (localPoster) URL.revokeObjectURL(localPoster);
    };
  }, [media.file_url, media.preview_url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Предзагружаем ролик ДО попадания в экран. Нижний rootMargin примерно равен
  // одному следующему посту, поэтому первые media ranges обычно уже в кеше к моменту play.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (typeof IntersectionObserver === 'undefined') { setWarm(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setWarm(true);
        observer.disconnect();
      }
    }, { root: null, rootMargin: '280px 0px 1100px 0px', threshold: 0.001 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [media.file_url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !warm || !video.paused) return;
    video.preload = 'auto';
    if (video.readyState < 3) {
      try { video.load(); } catch {}
    }
  }, [warm, media.file_url]);

  useEffect(() => () => {
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
  }, []);

  const loadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.videoWidth > 0 && video.videoHeight > 0) onRatio(video.videoWidth / video.videoHeight);
    if (!poster && video.currentTime === 0 && Number.isFinite(video.duration) && video.duration > 0.2) {
      try { video.currentTime = Math.min(0.18, Math.max(0.06, video.duration * 0.03)); } catch { /* noop */ }
    }
  };

  const handleWaiting = () => {
    const video = videoRef.current;
    if (!video) return;
    setWarm(true);
    setBuffering(true);
    if (bufferedAhead(video) >= 0.45) return;
    try { video.pause(); } catch {}
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    const retry = () => {
      const current = videoRef.current;
      if (!current) return;
      if (bufferedAhead(current) >= 1.4 || current.readyState >= 4) {
        setBuffering(false);
        current.play().catch(() => {});
        resumeTimerRef.current = null;
      } else {
        resumeTimerRef.current = window.setTimeout(retry, 220);
      }
    };
    resumeTimerRef.current = window.setTimeout(retry, 220);
  };

  return (
    <div className="feed-video-buffer-wrap">
      <video
        ref={videoRef}
        src={media.file_url}
        poster={poster}
        controls
        playsInline
        preload={warm ? 'auto' : 'metadata'}
        onPointerDown={() => setWarm(true)}
        onTouchStart={() => setWarm(true)}
        onPlay={() => { setWarm(true); setBuffering(false); }}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onWaiting={handleWaiting}
        onStalled={handleWaiting}
        onLoadedMetadata={loadedMetadata}
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: 'block' }}
      />
      {buffering && <div className="feed-video-buffering" aria-label="Загрузка видео"><span className="feed-video-buffer-spinner" /></div>}
    </div>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return 'только что';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} мин`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ч`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)} дн`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}


function FeedFilterSheet({ open, onClose, eventFilter, setEventFilter, eventList }: {
  open: boolean;
  onClose: () => void;
  eventFilter: FeedEventFilter;
  setEventFilter: (value: FeedEventFilter) => void;
  eventList: any[];
}) {
  const filterKey = (value: FeedEventFilter) => value.kind === 'event' ? `event:${value.eventId}` : value.kind;
  const parseFilterKey = (key: string): FeedEventFilter => key.startsWith('event:')
    ? { kind: 'event', eventId: key.slice(6) }
    : key === 'linked'
      ? { kind: 'linked' }
      : { kind: 'all' };

  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [hotKey, setHotKey] = useState(() => filterKey(eventFilter));
  const listRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{ pointerId: number; active: boolean } | null>(null);
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setHotKey(filterKey(eventFilter));
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [open, mounted, eventFilter.kind, eventFilter.kind === 'event' ? eventFilter.eventId : '']);

  if (!mounted) return null;

  const chooseKey = (key: string) => {
    haptic.select();
    setEventFilter(parseFilterKey(key));
    onClose();
  };

  const keyAtPoint = (x: number, y: number) => {
    const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-feed-filter-key]');
    return row?.dataset.feedFilterKey || null;
  };

  const updateHotAtPoint = (x: number, y: number) => {
    const key = keyAtPoint(x, y);
    if (key && key !== hotKey) {
      setHotKey(key);
      haptic.select();
    }

    const list = listRef.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    const edge = 54;
    if (y < rect.top + edge) list.scrollTop -= Math.ceil((rect.top + edge - y) / 5);
    else if (y > rect.bottom - edge) list.scrollTop += Math.ceil((y - (rect.bottom - edge)) / 5);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') return;
    const key = event.currentTarget.dataset.feedFilterKey;
    if (!key) return;
    gestureRef.current = { pointerId: event.pointerId, active: true };
    setHotKey(key);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current;
    if (!gesture?.active || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    updateHotAtPoint(event.clientX, event.clientY);
  };

  const finishPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture?.active || gesture.pointerId !== event.pointerId) return;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    const key = keyAtPoint(event.clientX, event.clientY) || hotKey;
    suppressClickUntilRef.current = Date.now() + 500;
    chooseKey(key);
  };

  const rowProps = (key: string) => ({
    'data-feed-filter-key': key,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishPointer,
    onPointerCancel: finishPointer,
    onClick: () => {
      if (Date.now() < suppressClickUntilRef.current) return;
      chooseKey(key);
    },
  });

  return (
    <div className={`feed-filter-overlay${closing ? ' closing' : ''}`} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="feed-filter-sheet" onClick={event => event.stopPropagation()}>
        <div className="feed-filter-title">Фильтр по событиям</div>
        <div className="feed-filter-list" ref={listRef}>
          <button className={`feed-filter-row ${hotKey === 'all' ? 'active' : ''}`} {...rowProps('all')}>
            <span className="feed-filter-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg></span>
            <span><b>Все посты</b><small>Без ограничений по событиям</small></span>
            {hotKey === 'all' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="m5 12 4 4L19 6"/></svg>}
          </button>
          <button className={`feed-filter-row ${hotKey === 'linked' ? 'active' : ''}`} {...rowProps('linked')}>
            <span className="feed-filter-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
            <span><b>Посты с событиями</b><small>Все публикации, связанные с событием</small></span>
            {hotKey === 'linked' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="m5 12 4 4L19 6"/></svg>}
          </button>
          {eventList.length > 0 && <div className="feed-filter-section">Конкретное событие</div>}
          {eventList.map(ev => {
            const key = `event:${ev.id}`;
            const selected = hotKey === key;
            return (
              <button key={ev.id} className={`feed-filter-row ${selected ? 'active' : ''}`} {...rowProps(key)}>
                <span className="feed-filter-event-cover">{ev.cover_url ? <img src={ev.cover_url} alt="" /> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>}</span>
                <span><b>{ev.title}</b><small>{ev.location_name || (ev.type === 'trip' ? 'Поездка' : 'Событие')}</small></span>
                {selected && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="m5 12 4 4L19 6"/></svg>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Feed() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const { feedPosts, feedExhausted, loadingFeed, resetFeed, fetchFeed } = usePostStore();
  const { events, loadEvents } = useEventsStore();

  const [mode, setMode] = useState<FeedMode>(() => {
    return (localStorage.getItem('feed_mode') as FeedMode) || 'normal';
  });
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [activeLikesPostId, setActiveLikesPostId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<FeedEventFilter>({ kind: 'all' });
  const [filterOpen, setFilterOpen] = useState(false);

  const eventList = Object.values(events).sort((a, b) => (b.start_at || '').localeCompare(a.start_at || ''));
  const activeEvent = eventFilter.kind === 'event' ? events[eventFilter.eventId] : null;
  const filterLabel = eventFilter.kind === 'all'
    ? 'Все посты'
    : eventFilter.kind === 'linked'
      ? 'Связанные с событиями'
      : activeEvent?.title || 'Событие';
  const requestFilterKey = eventFilter.kind === 'event' ? `event:${eventFilter.eventId}` : eventFilter.kind;

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // F5 — сворачивание шапки при скролле вниз
  const [hideHeader, setHideHeader] = useState(false);
  const [headerH, setHeaderH] = useState(56);
  const headerWrapRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  useLayoutEffect(() => {
    if (headerWrapRef.current) setHeaderH(headerWrapRef.current.offsetHeight);
  }, [mode]);
  const handleFeedScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const y = (e.currentTarget as HTMLDivElement).scrollTop;
    const last = lastScrollY.current;
    if (y > headerH && y > last + 4) setHideHeader(true);
    else if (y < last - 4 || y < 10) setHideHeader(false);
    lastScrollY.current = y;
  };

  // F3 — проявление постов по мере входа в экран (reveal-on-scroll)
  const postsWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mode !== 'normal') return;
    const root = postsWrapRef.current;
    if (!root) return;
    if (typeof IntersectionObserver === 'undefined') {
      root.querySelectorAll('.feed-reveal').forEach(el => el.classList.add('in-view'));
      return;
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in-view'); obs.unobserve(en.target); }
      });
    }, { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    root.querySelectorAll('.feed-reveal:not(.in-view)').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [mode, feedPosts.length]);

  useEffect(() => {
    if (user) loadEvents(user.id).catch(() => {});
  }, [user?.id, loadEvents]);

  useEffect(() => {
    localStorage.setItem('feed_mode', mode);
  }, [mode]);

  // При смене пользователя или фильтра загружаем отдельную выборку.
  // Переключение сетка/список не перезапрашивает данные.
  const lastFeedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user) { diag('feed.skip.noUser'); return; }
    const key = `${user.id}:${requestFilterKey}`;
    if (lastFeedKeyRef.current === key && feedPosts.length > 0) return;
    lastFeedKeyRef.current = key;
    resetFeed(eventFilter);
    diag('feed.fetch.start', { mode, uid: user.id, filter: requestFilterKey });
    fetchFeed(user.id, mode, eventFilter).catch((e: any) => {
      diag('feed.fetch.err', { error: e?.message, filter: requestFilterKey });
    });
  }, [user?.id, requestFilterKey]);

  // Бесконечная подгрузка через IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !user) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingFeed && !feedExhausted) {
        fetchFeed(user.id, mode, eventFilter);
      }
    }, { rootMargin: '600px' });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [user?.id, mode, loadingFeed, feedExhausted, requestFilterKey]);

  // Если выбран Tinder — рендерим колоду карточек
  if (mode === 'grid') {
    return (
      <div className="feed-screen feed-screen-grid" style={{height:'100%',background:'var(--bg)',display:'flex',flexDirection:'column',minHeight:0,position:'relative'}}>
        <div className="feed-header-wrap" ref={headerWrapRef} style={{position:'absolute',top:0,left:0,right:0,zIndex:20,transform:hideHeader?'translateY(-100%)':'none',transition:'transform .36s cubic-bezier(0.22,1,0.36,1)'}}>
          <FeedHeader mode={mode} setMode={setMode} filterLabel={filterLabel} onOpenFilter={() => setFilterOpen(true)} />
        </div>
        <PullToRefresh
          onRefresh={async () => { resetFeed(eventFilter); if (user) await fetchFeed(user.id, mode, eventFilter); }}
          onScroll={handleFeedScroll}
          className="feed-main-scroll"
          style={{flex:1,paddingTop:headerH}}
        >
          {feedPosts.length === 0 && !loadingFeed && (
            <div style={{padding:'48px 24px',textAlign:'center'}}>
              <p style={{color:'var(--text)',fontSize: 'var(--fs-body)',fontWeight:500,margin:'0 0 6px 0'}}>В ленте пока пусто</p>
              <p style={{color:'var(--muted)',fontSize: 'var(--fs-label)',margin:'0 0 20px 0'}}>Будь первым — опубликуй пост</p>
              <button
                onClick={() => nav('/feed/new')}
                style={{padding:'10px 24px',background:'var(--primary)',color:'var(--bg)',border:'none',borderRadius:20,fontSize: 'var(--fs-snap14)',fontWeight:600,cursor:'pointer'}}
              >Создать пост</button>
            </div>
          )}
          <div className="feed-grid-wrap" style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:2}}>
            {feedPosts.map((post, idx) => (
              <GridCell
                key={post.id}
                post={post}
                onTap={() => nav('/p/' + post.id)}
                rowAccent={idx % 7 === 3}
              />
            ))}
          </div>
          <div ref={sentinelRef} style={{height:1}} />
          {loadingFeed && (feedPosts.length === 0
            ? <SkeletonPostGrid count={9} />
            : <SkeletonPostGrid count={3} />
          )}
          {feedExhausted && feedPosts.length > 0 && (
            <div style={{padding:'24px 16px 32px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-label)'}}>
              <div style={{width:28,height:3,borderRadius:2,background:'var(--border)',margin:'0 auto 12px'}} />
              Это все посты
            </div>
          )}
        </PullToRefresh>
        <FeedFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} eventFilter={eventFilter} setEventFilter={setEventFilter} eventList={eventList} />
      </div>
    );
  }

  return (
    <div className="feed-screen" style={{height:'100%',background:'var(--bg)',display:'flex',flexDirection:'column',minHeight:0,position:'relative'}}>
      <div className="feed-header-wrap" ref={headerWrapRef} style={{position:'absolute',top:0,left:0,right:0,zIndex:20,transform:hideHeader?'translateY(-100%)':'none',transition:'transform .36s cubic-bezier(0.22,1,0.36,1)'}}>
        <FeedHeader mode={mode} setMode={setMode} filterLabel={filterLabel} onOpenFilter={() => setFilterOpen(true)} />
      </div>

      <PullToRefresh
        onRefresh={async () => { resetFeed(eventFilter); if (user) await fetchFeed(user.id, mode, eventFilter); }}
        onScroll={handleFeedScroll}
        className="feed-main-scroll"
        style={{flex:1,minHeight:0,paddingTop:headerH}}
      >
        {feedPosts.length === 0 && !loadingFeed && (
          <div style={{padding:'48px 24px',textAlign:'center'}}>
            <p style={{color:'var(--text)',fontSize: 'var(--fs-body)',fontWeight:500,margin:'0 0 6px 0'}}>В ленте пока пусто</p>
            <p style={{color:'var(--muted)',fontSize: 'var(--fs-label)',margin:'0 0 20px 0'}}>Будь первым — опубликуй пост</p>
            <button
              onClick={() => nav('/feed/new')}
              style={{padding:'10px 24px',background:'var(--primary)',color:'var(--bg)',border:'none',borderRadius:20,fontSize: 'var(--fs-snap14)',fontWeight:600,cursor:'pointer'}}
            >Создать пост</button>
          </div>
        )}

        <div ref={postsWrapRef} className="feed-list-wrap">
          {feedPosts.map(post => (
            <div key={post.id} className="feed-reveal">
              <PostCard
                post={post}
                onOpenComments={() => setActiveCommentsPostId(post.id)}
                onOpenLikes={() => setActiveLikesPostId(post.id)}
                onOpenAuthor={() => nav(`/u/${post.author_id}`)}
              />
            </div>
          ))}
        </div>

        <div ref={sentinelRef} style={{height:1}} />

        {loadingFeed && (feedPosts.length === 0
          ? <><SkeletonPost /><SkeletonPost /><SkeletonPost /></>
          : <SkeletonPost />
        )}
        {feedExhausted && feedPosts.length > 0 && (
          <div style={{padding:'24px 16px 32px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-label)'}}>
            <div style={{width:28,height:3,borderRadius:2,background:'var(--border)',margin:'0 auto 12px'}} />
            Это все посты
          </div>
        )}
      </PullToRefresh>

      <FeedFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} eventFilter={eventFilter} setEventFilter={setEventFilter} eventList={eventList} />

      {activeCommentsPostId && (
        <CommentsSheet
          postId={activeCommentsPostId}
          onClose={() => setActiveCommentsPostId(null)}
        />
      )}

      {activeLikesPostId && (
        <PostLikesSheet
          postId={activeLikesPostId}
          onClose={() => setActiveLikesPostId(null)}
        />
      )}
    </div>
  );
}

// ============== HEADER ==============

function FeedHeader({ mode, setMode, filterLabel, onOpenFilter }: {
  mode: FeedMode;
  setMode: (m: FeedMode) => void;
  filterLabel: string;
  onOpenFilter: () => void;
}) {
  const nav = useNavigate();
  const { user } = useAuthStore();

  return (
    <header className="feed-header">
      <button className="feed-event-filter-button" onClick={() => { haptic.tap(); onOpenFilter(); }} title="Фильтр по событиям">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
        <span>{filterLabel}</span>
      </button>

      <div className="feed-view-toggle">
        <div className="feed-view-toggle-pill" style={{ transform: mode === 'grid' ? 'translateX(100%)' : 'translateX(0)' }} />
        <button onClick={() => { haptic.tap(); setMode('normal'); }} title="Вертикальная лента" className={mode === 'normal' ? 'active' : ''}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 6h14M5 12h14M5 18h14"/></svg>
        </button>
        <button onClick={() => { haptic.tap(); setMode('grid'); }} title="Сетка" className={mode === 'grid' ? 'active' : ''}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
        </button>
      </div>

      {user && (
        <button onClick={() => nav(`/u/${user.id}`)} className="feed-header-icon" title="Мой профиль">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
        </button>
      )}
      <button onClick={() => nav('/feed/new')} className="feed-header-icon accent" title="Новый пост">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </header>
  );
}

// ============== POST CARD ==============

export function PostCard({ post, onOpenComments, onOpenLikes, onOpenAuthor, onDelete }: {
  post: PostWithDetails;
  onOpenComments: () => void;
  onOpenLikes?: () => void;
  onOpenAuthor: () => void;
  onDelete?: () => void;
}) {
  const { user } = useAuthStore();
  const { toggleLike } = usePostStore();
  const [mediaIdx, setMediaIdx] = useState(0);
  const [mediaRatios, setMediaRatios] = useState<Record<string, number>>({});
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);

  const author = post.author;
  const navEvent = useNavigate();
  const liked = post.liked_by_me;

  // P5 — есть ли у автора активная история (оппортунистически из стора)
  const authorStory = useStoriesStore(s => {
    const id = post.author_id;
    const g = s.groups.find(gr => gr.user.id === id) || (s.myGroup && s.myGroup.user.id === id ? s.myGroup : null);
    return g ? (g.allSeen ? 'seen' : 'unseen') : null;
  });

  const lastTapRef = useRef<number>(0);
  const handleMediaDoubleTap = () => {
    if (!user) return;
    if (!liked) toggleLike(post.id, user.id);
    setDoubleTapHeart(true);
    setTimeout(() => setDoubleTapHeart(false), 800);
  };
  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleMediaDoubleTap();
    }
    lastTapRef.current = now;
  };

  const handleLikeClick = useCallback(() => {
    if (!user) return;
    toggleLike(post.id, user.id);
  }, [user?.id, post.id]);

  // Swipe для карусели — native non-passive listener чтобы preventDefault работал
  // и страница не скроллилась вертикально при горизонтальном свайпе
  const mediaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = mediaRef.current;
    if (!el || post.media.length <= 1) return;

    let startX = 0, startY = 0;
    let lock: 'h' | 'v' | null = null;
    let active = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lock = null;
      active = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (lock === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      // Горизонтальный свайп — блокируем вертикальный скролл страницы
      if (lock === 'h') {
        e.preventDefault();
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (!active) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (lock === 'h' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0 && mediaIdx < post.media.length - 1) setMediaIdx(i => i + 1);
        else if (dx > 0 && mediaIdx > 0) setMediaIdx(i => i - 1);
      }
      active = false;
      lock = null;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [mediaIdx, post.media.length]);

  const captionLong = post.caption.length > 140;
  const captionShown = captionExpanded || !captionLong ? post.caption : post.caption.slice(0, 140);
  const activeMedia = post.media[mediaIdx];
  const activeIsVideo = !!activeMedia?.mime_type?.startsWith('video/');
  const storedRatio = activeIsVideo && activeMedia?.width && activeMedia?.height
    ? activeMedia.width / activeMedia.height
    : undefined;
  const measuredRatio = activeMedia?.id ? mediaRatios[activeMedia.id] : undefined;
  const activeVideoRatio = activeIsVideo
    ? (storedRatio || measuredRatio || (4 / 5))
    : 1;

  return (
    <article id={`post-${post.id}`} className="feed-card-polished" style={{borderBottom:'1px solid var(--border)',paddingBottom:8}}>
      {/* HEADER */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
        <button
          onClick={onOpenAuthor}
          style={{background:'none',border:'none',padding:0,cursor:'pointer',display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0,textAlign:'left'}}
        >
          <div style={{flexShrink:0,borderRadius:21,padding:authorStory?2:0,background:authorStory==='unseen'?'linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf)':authorStory==='seen'?'var(--border)':'transparent'}}>
            <div style={{borderRadius:19,padding:authorStory?2:0,background:'var(--surface)'}}>
              {author?.avatar_url
                ? <img src={author.avatar_url} alt="" style={{width:34,height:34,borderRadius:17,objectFit:'cover',display:'block'}} />
                : <div style={{width:34,height:34,borderRadius:17,background:avatarColor(author?.id || 'x'),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-snap14)',fontWeight:600}}>{(author?.display_name || '?')[0].toUpperCase()}</div>}
            </div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize: 'var(--fs-snap14)',fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{author?.display_name || 'Пользователь'}</div>
            <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>{fmtTime(post.created_at)}</div>
          </div>
        </button>
        {onDelete && (
          <button onClick={onDelete} aria-label="Удалить" style={{background:'none',border:'none',color:'#EF4444',cursor:'pointer',padding:6,flexShrink:0}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        )}
      </div>

      {post.event && (
        <button className="feed-event-link" onClick={() => { haptic.tap(); navEvent(`/events/${post.event!.id}`); }}>
          <span className="feed-event-link-cover">
            {post.event.cover_url ? <img src={post.event.cover_url} alt="" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v3M17 3v3M4 9h16"/><rect x="3" y="5" width="18" height="16" rx="4"/></svg>}
          </span>
          <span className="feed-event-link-copy"><small>Событие</small><b>{post.event.title}</b></span>
          <svg className="feed-event-link-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      {/* MEDIA */}
      {post.media.length > 0 && (
        <div
          ref={mediaRef}
          className="feed-media-stage"
          style={{
            position:'relative', width:'100%', aspectRatio: activeIsVideo ? String(activeVideoRatio) : '1/1',
            background:'#000', overflow:'hidden',
            touchAction: post.media.length > 1 ? 'pan-y pinch-zoom' : 'auto',
          }}
          onClick={handleMediaTap}
        >
          {/* Трек со ВСЕМИ медиа — все кадры в DOM и предзагружены, свайп лишь сдвигает трек. */}
          {/* Нет перемонтирования <img> при свайпе → нет чёрного кадра, соседние фото уже готовы. */}
          <div style={{
            display:'flex', width:'100%', height:'100%',
            transform:`translateX(-${mediaIdx * 100}%)`,
            transition:'transform 0.32s cubic-bezier(0.2,0.8,0.2,1)',
            willChange:'transform',
          }}>
            {post.media.map((m) => (
              <div key={m.id} style={{flex:'0 0 100%', width:'100%', height:'100%'}}>
                {m.mime_type.startsWith('video/')
                  ? <FeedVideoMedia
                      media={m}
                      onRatio={(ratio) => {
                        if (!Number.isFinite(ratio) || ratio <= 0) return;
                        setMediaRatios(prev => prev[m.id] === ratio ? prev : { ...prev, [m.id]: ratio });
                      }}
                    />
                  : <img
                      src={m.file_url}
                      alt=""
                      className="feed-image-fade"
                      style={{width:'100%',height:'100%',objectFit:'cover'}}
                    />}
              </div>
            ))}
          </div>

          {/* Pagination dots */}
          {post.media.length > 1 && (
            <div style={{position:'absolute',top:10,right:10,background:'rgba(0,0,0,0.5)',color:'#fff',padding:'3px 8px',borderRadius:10,fontSize: 'var(--fs-micro)',fontWeight:500}}>
              {mediaIdx + 1}/{post.media.length}
            </div>
          )}

          {/* Double tap heart anim + particles (P2) */}
          {doubleTapHeart && (
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
              <div style={{position:'relative',width:100,height:100,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {Array.from({length:7}).map((_, i) => {
                  const ang = (i * (360/7) - 90) * Math.PI/180;
                  const dx = Math.cos(ang) * 68, dy = Math.sin(ang) * 68;
                  return (
                    <span key={i} className="dt-heart-particle" style={{ ['--dtx' as any]: dx.toFixed(0)+'px', ['--dty' as any]: dy.toFixed(0)+'px', position:'absolute', left:'50%', top:'50%', marginLeft:-11, marginTop:-11 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" style={{filter:'drop-shadow(0 1px 4px rgba(0,0,0,0.5))'}}><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </span>
                  );
                })}
                <svg width="100" height="100" viewBox="0 0 24 24" fill="#fff" style={{filter:'drop-shadow(0 2px 12px rgba(0,0,0,0.6))',animation:'heartPop 0.8s ease-out forwards'}}>
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Carousel dots indicator */}
      {post.media.length > 1 && (
        <div style={{display:'flex',justifyContent:'center',gap:5,padding:'8px 0 4px',alignItems:'center'}}>
          {post.media.map((_, i) => (
            <span key={i} style={{
              width: i === mediaIdx ? 18 : 5,
              height: 5,
              borderRadius: 3,
              background: i === mediaIdx ? 'var(--primary)' : 'var(--muted)',
              opacity: i === mediaIdx ? 1 : 0.4,
              transition: 'width .34s cubic-bezier(0.22,1,0.36,1), background .34s ease, opacity .34s ease',
            }} />
          ))}
        </div>
      )}

      {/* ACTIONS */}
      <div style={{display:'flex',gap:14,padding:'8px 12px 4px',alignItems:'center'}}>
        <LikeButton
          liked={liked}
          count={post.likes_count}
          onToggle={handleLikeClick}
          showCount={post.likes_count > 0}
        />
        {post.comments_enabled && (
          <button
            onClick={() => { haptic.tap(); onOpenComments(); }}
            className="feed-action-btn"
            style={{background:'none',border:'none',padding:6,cursor:'pointer',display:'flex',alignItems:'center',gap:5,color:'var(--text)'}}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            {post.comments_count > 0 && <span style={{fontSize: 'var(--fs-label)',fontWeight:500}}><AnimatedNumber value={post.comments_count} duration={500} /></span>}
          </button>
        )}

      </div>

      {post.likes_count > 0 && (
        <button
          className="feed-liked-by"
          onClick={() => { haptic.tap(); onOpenLikes?.(); }}
          disabled={!onOpenLikes}
          aria-label={`Показать пользователей, которым нравится публикация: ${post.likes_count}`}
        >
          <div className="feed-liked-avatars">
            {(post.liked_by_preview || []).slice(0, 3).map((u, index) => u.avatar_url
              ? <img key={u.id} src={u.avatar_url} alt="" style={{zIndex: 3-index}} />
              : <span key={u.id} style={{background:avatarColor(u.id),zIndex:3-index}}>{(u.display_name || '?')[0]}</span>)}
          </div>
          <span>
            Нравится {post.liked_by_preview?.length
              ? <><b>{post.liked_by_preview.slice(0, 2).map(u => u.display_name).join(', ')}</b>{post.likes_count > 2 ? ` и ещё ${post.likes_count - 2}` : ''}</>
              : <b>{post.likes_count}</b>}
          </span>
        </button>
      )}

      {/* CAPTION */}
      {post.caption && (
        <div style={{padding:'2px 14px 10px',fontSize: 'var(--fs-snap14)',lineHeight:1.4,color:'var(--text)',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
          <span style={{fontWeight:600,marginRight:6}}>{author?.display_name}</span>
          {captionShown}
          {captionLong && !captionExpanded && (
            <button
              onClick={() => setCaptionExpanded(true)}
              style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',padding:0,marginLeft:4,fontSize: 'var(--fs-snap14)'}}
            >... ещё</button>
          )}
          {captionLong && captionExpanded && (
            <button
              onClick={() => setCaptionExpanded(false)}
              style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',padding:0,marginLeft:6,fontSize: 'var(--fs-snap14)'}}
            > свернуть</button>
          )}
        </div>
      )}

      {(post.comments_preview || []).length > 0 && (
        <div className="feed-comments-preview">
          {(post.comments_preview || []).map(comment => (
            <button key={comment.id} onClick={onOpenComments}>
              <b>{comment.author.display_name}</b>
              <span>{comment.text}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes heartPop {
          0% { transform: scale(0); opacity: 0; }
          25% { transform: scale(1.2); opacity: 1; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0; }
        }
      `}</style>
    </article>
  );
}

// ============== GRID CELL (Instagram-style) ==============

function GridCell({ post, onTap, rowAccent }: {
  post: PostWithDetails;
  onTap: () => void;
  rowAccent: boolean;
}) {
  const firstMedia = post.media?.[0];
  const isVideo = firstMedia?.mime_type?.startsWith('video');
  const hasMedia = !!firstMedia;
  // Каждая ~7-я ячейка делается «акцентной» — высокой (вертикальной), как в Instagram Explore
  const accent = rowAccent && hasMedia;

  // G4 — long-press превью (лайки/комменты)
  const [peeking, setPeeking] = useState(false);
  const pressTimer = useRef<any>(null);
  const longPressedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const onDown = (e: React.PointerEvent) => {
    longPressedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => { longPressedRef.current = true; setPeeking(true); haptic.select(); }, 420);
  };
  const onMove = (e: React.PointerEvent) => {
    if (Math.abs(e.clientX - startRef.current.x) > 10 || Math.abs(e.clientY - startRef.current.y) > 10) clearTimeout(pressTimer.current);
  };
  const endPress = () => { clearTimeout(pressTimer.current); setPeeking(false); };
  const onClickCap = (e: React.MouseEvent) => { if (longPressedRef.current) { e.stopPropagation(); e.preventDefault(); longPressedRef.current = false; } };

  return (
    <button
      onClick={onTap}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onClickCapture={onClickCap}
      className="feed-grid-cell"
      style={{
        position: 'relative',
        aspectRatio: '1/1',
        gridRow: 'span 1',
        background: hasMedia ? 'var(--surface-light)' : 'linear-gradient(135deg, var(--surface), var(--surface-light))',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {hasMedia ? (
        <>
          {isVideo ? (
            <video
              src={firstMedia.file_url}
              muted
              playsInline
              preload="metadata"
              style={{width:'100%',height:'100%',objectFit:'cover'}}
            />
          ) : (
            <img
              src={firstMedia.file_url}
              alt=""
              loading="lazy"
              style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
            />
          )}
          {/* Иконка типа медиа */}
          {(post.media.length > 1 || isVideo) && (
            <div style={{position:'absolute',top:6,right:6,color:'#fff',filter:'drop-shadow(0 1px 2px rgba(0,0,0,0.5))'}}>
              {isVideo
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="7" width="14" height="14" rx="2"/><path d="M3 17V5a2 2 0 0 1 2-2h12"/></svg>
              }
            </div>
          )}
        </>
      ) : (
        // Пост без медиа — текстовая ячейка
        <div style={{
          width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',
          padding:8,color:'var(--text)',fontSize: 'var(--fs-micro)',fontWeight:500,lineHeight:1.3,
          textAlign:'center',overflow:'hidden',
        }}>
          <span style={{display:'-webkit-box',WebkitLineClamp:6,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
            {post.caption || '—'}
          </span>
        </div>
      )}
      {peeking && (
        <div className="feed-grid-peek" style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',gap:14,color:'#fff',pointerEvents:'none'}}>
          <span style={{display:'flex',alignItems:'center',gap:4,fontSize:'var(--fs-snap14)',fontWeight:700}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            {post.likes_count}
          </span>
          <span style={{display:'flex',alignItems:'center',gap:4,fontSize:'var(--fs-snap14)',fontWeight:700}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            {post.comments_count}
          </span>
        </div>
      )}
    </button>
  );
}
