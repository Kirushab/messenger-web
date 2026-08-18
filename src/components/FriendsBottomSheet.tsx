import { useEffect, useState, useRef } from 'react';
import type { UserLocation } from '@/stores/mapStore';
import type { SigEvent } from '@/stores/eventsStore';
import { categoryColor, type MapPoint } from '@/stores/mapPointsStore';
import { CategoryIcon } from '@/lib/categoryIcons';
import { TYPE_META } from '@/components/EventFeedCard';
import { avatarColor } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

interface Props {
  myId: string | undefined;
  locations: UserLocation[];
  allUsers?: { id: string; display_name: string; avatar_url: string | null }[];
  events?: SigEvent[];
  points?: MapPoint[];
  onEventTap?: (e: SigEvent) => void;
  onPointTap?: (p: MapPoint) => void;
  onFriendTap: (loc: UserLocation) => void;
  onMyLocationTap?: () => void;
  onChat?: (userId: string) => void;
  onSnapChange?: (snap: 'peek' | 'half' | 'full') => void;
  onMotionProgress?: (progress: number) => void;
  mapLight?: boolean; // тема КАРТЫ: панель красится под карту, а не под тему приложения
}

/**
 * Snapchat-style нижний sheet с друзьями и recent moves.
 * Открывается через handle вверху, может быть свёрнут в маленькую полоску
 * или развёрнут на половину/полный экран.
 */
export default function FriendsBottomSheet({ myId, locations, allUsers = [], events = [], points = [], onEventTap, onPointTap, onFriendTap, onMyLocationTap, onChat, onSnapChange, onMotionProgress, mapLight }: Props) {
  const [snap, setSnap] = useState<'peek' | 'half' | 'full'>('peek');
  const [safeBottom, setSafeBottom] = useState(0);
  useEffect(() => { onSnapChange?.(snap); }, [snap]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheetRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; baseOffset: number; collapsedOffset: number; dragging: boolean; fromList: boolean; current: number; lastY: number; lastT: number; vy: number } | null>(null);
  const draggedRef = useRef(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [sheetReady, setSheetReady] = useState(false);

  // Сортируем по дате обновления (свежие первыми), исключаем себя из обзорной части
  const otherFriends = locations.filter(l => l.user_id !== myId).sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
  const myLoc = locations.find(l => l.user_id === myId);

  // Time-ago helper
  const timeAgo = (iso: string): string => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return min + 'м';
    const h = Math.floor(min / 60);
    if (h < 24) return h + 'ч';
    const d = Math.floor(h / 24);
    return d + 'д';
  };

  // Полный список Sigmas: у кого есть точка — сверху (по свежести), остальные — ниже по алфавиту.
  const locByUser = new Map(locations.map(l => [l.user_id, l]));
  const sigmasList = [...allUsers]
    .filter(u => u.id !== myId)
    .sort((a, b) => {
      const la = locByUser.get(a.id), lb = locByUser.get(b.id);
      if (la && !lb) return -1;
      if (!la && lb) return 1;
      if (la && lb) return new Date(lb.updated_at).getTime() - new Date(la.updated_at).getTime();
      return (a.display_name || '').localeCompare(b.display_name || '');
    });

  useEffect(() => {
    const readSafeBottom = () => {
      const cssValue = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom'),
      );
      setSafeBottom(Number.isFinite(cssValue) ? Math.max(0, cssValue) : 0);
    };
    readSafeBottom();
    window.addEventListener('resize', readSafeBottom);
    window.addEventListener('orientationchange', readSafeBottom);
    window.addEventListener('sigmas:viewportmetrics', readSafeBottom);
    return () => {
      window.removeEventListener('resize', readSafeBottom);
      window.removeEventListener('orientationchange', readSafeBottom);
      window.removeEventListener('sigmas:viewportmetrics', readSafeBottom);
    };
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setSheetReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const PEEK = 30;
  const visiblePeek = PEEK + safeBottom;
  const emitMotionProgress = (offset: number, collapsedOffset: number) => {
    if (!onMotionProgress || collapsedOffset <= 0) return;
    const progress = Math.max(0, Math.min(1, 1 - offset / collapsedOffset));
    onMotionProgress(progress);
  };

  // Передаём родителю не только итоговый snap, но и реальный прогресс движения шторки.
  // Благодаря этому элементы карты исчезают именно в момент, когда шторка подходит к ним,
  // а не скачком после завершения жеста.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const h = sheetRef.current?.offsetHeight ?? 0;
      const collapsedOffset = Math.max(1, h - visiblePeek);
      const offset = snap === 'full' ? 0 : snap === 'half' ? collapsedOffset * 0.5 : collapsedOffset;
      emitMotionProgress(offset, collapsedOffset);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, visiblePeek]);

  const beginDrag = (clientY: number, fromList: boolean) => {
    const h = sheetRef.current?.offsetHeight ?? 0;
    const collapsedOffset = Math.max(1, h - visiblePeek);
    const baseOffset = snap === 'full' ? 0 : snap === 'half' ? collapsedOffset * 0.5 : collapsedOffset;
    dragRef.current = { startY: clientY, baseOffset, collapsedOffset, dragging: false, fromList, current: baseOffset, lastY: clientY, lastT: performance.now(), vy: 0 };
    draggedRef.current = false;
  };
  const moveDrag = (clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = clientY - d.startY;
    if (!d.dragging) {
      if (Math.abs(dy) < 6) return;
      // Из списка тянем шторку только если он прокручен вверх и жест вниз — иначе пусть скроллится
      if (d.fromList) {
        const atTop = (listRef.current?.scrollTop ?? 0) <= 0;
        if (!(atTop && dy > 0)) { dragRef.current = null; return; }
      }
      d.dragging = true;
      draggedRef.current = true;
    }
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) d.vy = (clientY - d.lastY) / dt; // px/ms, + вниз / − вверх
    d.lastY = clientY; d.lastT = now;
    let next = d.baseOffset + dy;
    next = Math.max(0, Math.min(d.collapsedOffset, next));
    d.current = next;
    setDragOffset(next);
    emitMotionProgress(next, d.collapsedOffset);
  };
  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !d.dragging) { setDragOffset(null); return; }
    // Fling: при быстром броске сдвигаемся на одну ступень в сторону жеста; иначе — ближайшая из трёх
    const FLING = 0.45; // px/ms
    const offs = [0, d.collapsedOffset * 0.5, d.collapsedOffset];
    const snaps: ('full' | 'half' | 'peek')[] = ['full', 'half', 'peek'];
    let idx = 0; let best = Infinity;
    for (let i = 0; i < offs.length; i++) { const dist = Math.abs(offs[i] - d.current); if (dist < best) { best = dist; idx = i; } }
    if (Math.abs(d.vy) > FLING) idx = d.vy < 0 ? Math.max(0, idx - 1) : Math.min(offs.length - 1, idx + 1);
    const chosen = snaps[idx];
    if (chosen !== snap) haptic.select();
    setSnap(chosen);
    const chosenOffset = chosen === 'full' ? 0 : chosen === 'half' ? d.collapsedOffset * 0.5 : d.collapsedOffset;
    emitMotionProgress(chosenOffset, d.collapsedOffset);
    setDragOffset(null);
    setTimeout(() => { draggedRef.current = false; }, 60);
  };
  const onHeaderTouchStart = (e: React.TouchEvent) => beginDrag(e.touches[0].clientY, false);
  const onListTouchStart = (e: React.TouchEvent) => beginDrag(e.touches[0].clientY, true);
  const onTouchMove = (e: React.TouchEvent) => moveDrag(e.touches[0].clientY);
  const onTouchEnd = () => endDrag();
  // Гасим клик по аватару/строке, если это был драг, а не тап
  const swallowClickIfDragged = (e: React.MouseEvent) => { if (draggedRef.current) { e.stopPropagation(); e.preventDefault(); } };

  return (
    <div
      ref={sheetRef}
      className="friends-sheet"
      style={{
        // Локальный оверрайд токенов: панель следует теме КАРТЫ (светлая/тёмная схема),
        // а не теме приложения — иначе на тёмной карте при светлой теме была белая полоса.
        ...(mapLight === undefined ? {} : mapLight ? {
          ['--bg' as any]: '#FFFFFF', ['--surface' as any]: '#FFFFFF', ['--surface-light' as any]: '#F2F3F6', ['--surface-2' as any]: '#EDEFF3',
          ['--text' as any]: '#101014', ['--text2' as any]: '#5A5A63', ['--muted' as any]: '#8A8A93', ['--border' as any]: 'rgba(0,0,0,0.09)',
        } : {
          ['--bg' as any]: '#131316', ['--surface' as any]: '#131316', ['--surface-light' as any]: '#1E1E23', ['--surface-2' as any]: '#26262C',
          ['--text' as any]: '#FFFFFF', ['--text2' as any]: '#A0A0A8', ['--muted' as any]: '#6E6E76', ['--border' as any]: 'rgba(255,255,255,0.10)',
        }),
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        background: 'var(--bg)',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
        zIndex: 30,
        transition: !sheetReady || dragOffset != null ? 'none' : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        transform: dragOffset != null ? `translateY(${dragOffset}px)` : (snap === 'full' ? 'translateY(0)' : snap === 'half' ? `translateY(calc((100% - ${visiblePeek}px) * 0.5))` : `translateY(calc(100% - ${visiblePeek}px))`),
        maxHeight: '70dvh',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 0,
      }}
    >
      {/* Перетаскиваемая шапка: хендл + лента друзей (тянется за палец) */}
      <div
        onTouchStart={onHeaderTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={swallowClickIfDragged}
      >
      {/* Drag handle */}
      <div
        onClick={() => { if (!draggedRef.current) setSnap(snap === 'full' ? 'peek' : 'full'); }}
        style={{ padding: '10px 0 6px', cursor: 'pointer', textAlign: 'center' }}
      >
        <div style={{ width: 44, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto' }} />
      </div>

      {/* События на карте (если слой включён) */}
      {events.length > 0 && (
        <div style={{ padding: '2px 16px 6px' }}>
          <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>События</div>
          <div className="no-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {events.map(ev => (
              <button key={ev.id} onClick={() => onEventTap?.(ev)} style={{ flexShrink: 0, width: 132, height: 122, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
                <div style={{ height: 84, borderRadius: 12, overflow: 'hidden', background: TYPE_META[ev.type].gradient, position: 'relative', border: ev.cover_url ? 'none' : '1px solid var(--border)' }}>
                  {ev.cover_url ? (
                    <img src={ev.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (() => {
                    const EventIcon = TYPE_META[ev.type].Icon;
                    return (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-light)', color: 'var(--muted)' }}>
                        <div style={{ width: 46, height: 46, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                          <EventIcon size={26} color="currentColor" strokeWidth={1.7} />
                        </div>
                      </div>
                    );
                  })()}
                  <span style={{ position: 'absolute', top: 6, left: 6, background: ev.cover_url ? 'rgba(10,10,12,0.55)' : 'color-mix(in srgb, var(--surface) 86%, transparent)', color: ev.cover_url ? '#fff' : 'var(--text2)', fontSize: 'var(--fs-snap10)', fontWeight: 600, padding: '2px 7px', borderRadius: 999, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', border: ev.cover_url ? 'none' : '1px solid var(--border)' }}>{TYPE_META[ev.type].label}</span>
                </div>
                <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--text)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                <div style={{ height: 14, lineHeight: '14px', fontSize: 'var(--fs-snap10)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', visibility: ev.location_name ? 'visible' : 'hidden' }}>{ev.location_name || '—'}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Точки на карте (если слой включён) */}
      {points.length > 0 && (
        <div style={{ padding: '0 16px 6px' }}>
          <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Точки</div>
          <div className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {points.map(p => (
              <button key={p.id} onClick={() => onPointTap?.(p)} style={{ flexShrink: 0, width: 66, background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 52, height: 52, borderRadius: 26, background: categoryColor(p.category) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>
                  <CategoryIcon category={p.category} size={22} color={categoryColor(p.category)} strokeWidth={2} />
                </div>
                <div style={{ fontSize: 'var(--fs-snap10)', fontWeight: 600, color: 'var(--text)', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{p.title}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Friends row */}
      <div style={{ padding: '4px 16px 8px' }}>
        <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Где друзья
        </div>
        <div className="no-scrollbar" style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6, marginLeft: -2, paddingLeft: 2 }}>
          {/* Моя точка */}
          {myLoc && onMyLocationTap && (
            <button onClick={onMyLocationTap} style={{
              flexShrink: 0,
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: 0,
            }}>
              <div style={{ position: 'relative' }}>
                <Avatar user={myLoc.user as any} size={54} />
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  background: '#10B981', color: '#fff',
                  fontSize: 8, fontWeight: 700,
                  padding: '2px 5px', borderRadius: 8,
                  border: '2px solid var(--bg)',
                }}>ВЫ</div>
              </div>
              <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 600, color: 'var(--text)' }}>Вы</div>
              <div style={{ fontSize: 'var(--fs-snap10)', color: 'var(--muted)' }}>{timeAgo(myLoc.updated_at)}</div>
            </button>
          )}
          {otherFriends.map(loc => (
            <button key={loc.user_id} onClick={() => onFriendTap(loc)} style={{
              flexShrink: 0,
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: 0,
            }}>
              <Avatar user={loc.user as any} size={54} />
              <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 600, color: 'var(--text)', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {loc.user?.display_name?.split(' ')[0] || '...'}
              </div>
              <div style={{ fontSize: 'var(--fs-snap10)', color: 'var(--muted)' }}>{timeAgo(loc.updated_at)}</div>
            </button>
          ))}
          {otherFriends.length === 0 && !myLoc && (
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: '8px 0' }}>
              Никого нет рядом
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Заголовок остаётся на месте, прокручиваются только строки пользователей. */}
      {sigmasList.length > 0 && (
        <>
          <div style={{ padding: '4px 16px 8px', flexShrink: 0, background: 'var(--bg)' }}>
            <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 700, color: 'var(--text)' }}>
              Все Sigmas
            </div>
          </div>
          <div ref={listRef} onTouchStart={onListTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onClickCapture={swallowClickIfDragged} style={{ padding: '0 16px 8px', overflowY: 'auto', overscrollBehavior: 'contain', flex: 1, minHeight: 0 }}>
          {sigmasList.map(u => {
            const loc = locByUser.get(u.id);
            const located = !!loc;
            return (
              <div
                key={u.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '10px 12px', marginBottom: 6,
                  background: 'var(--surface-light)', borderRadius: 12,
                }}
              >
                <button
                  onClick={() => { if (loc) onFriendTap(loc); }}
                  style={{
                    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12,
                    background: 'none', border: 'none', padding: 0,
                    cursor: located ? 'pointer' : 'default', textAlign: 'left',
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar user={u as any} size={40} />
                    {located && (
                      <div style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: 12, height: 12, borderRadius: 6,
                        background: '#10B981', border: '2px solid var(--surface-light)',
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.display_name || '...'}
                    </div>
                    <div style={{ fontSize: 'var(--fs-micro)', color: located ? 'var(--text)' : 'var(--muted)', opacity: located ? 0.7 : 1 }}>
                      {located ? `на карте · ${timeAgo(loc!.updated_at)} назад` : 'не на карте'}
                    </div>
                  </div>
                </button>
                {onChat && (
                  <button
                    onClick={() => onChat(u.id)}
                    title="Написать"
                    style={{
                      flexShrink: 0, width: 34, height: 34, borderRadius: 17,
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text)',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </button>
                )}
              </div>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
}

function Avatar({ user, size }: { user?: { id?: string; display_name?: string; avatar_url?: string }; size: number }) {
  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt="" style={{
      width: size, height: size, borderRadius: size / 2,
      objectFit: 'cover', border: '2px solid var(--bg)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}/>;
  }
  const letter = (user?.display_name || '?').charAt(0).toUpperCase();
  return <div style={{
    width: size, height: size, borderRadius: size / 2,
    background: avatarColor(user?.id || ''),
    color: '#fff', fontSize: size * 0.4, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '2px solid var(--bg)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    flexShrink: 0,
  }}>{letter}</div>;
}
