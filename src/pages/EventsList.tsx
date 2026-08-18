import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useEventsStore, type EventType, type SigEvent, type RsvpStatus } from '@/stores/eventsStore';
import EventFeedCard, { TYPE_META, RsvpBadge, fmtEventDateTime } from '@/components/EventFeedCard';
import { haptic } from '@/lib/haptics';
import { Skeleton } from '@/components/Skeleton';
import FormSheet from '@/components/FormSheet';

const RSVP_FILTERS: Array<{ key: 'all' | RsvpStatus; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'going', label: 'Иду' },
  { key: 'maybe', label: 'Возможно' },
  { key: 'not_going', label: 'Не иду' },
];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}


export default function EventsList() {
  const nav = useNavigate();
  const loc = useLocation();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { events, loading, loadEvents, subscribeRealtime, unsubscribeRealtime, setMyRsvp } = useEventsStore();

  const type: EventType = loc.pathname.startsWith('/trips') ? 'trip' : 'party';
  const meta = TYPE_META[type];

  const [rsvpFilter, setRsvpFilter] = useState<'all' | RsvpStatus>('all');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [photosMap, setPhotosMap] = useState<Record<string, string[]>>({});
  const [quickEvent, setQuickEvent] = useState<SigEvent | null>(null);
  const pressTimer = useRef<any>(null);
  const longPressedRef = useRef(false);
  const pressStart = useRef({ x: 0, y: 0 });

  const lastEvKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!myId) return;
    const key = myId + ':' + type;
    const hasData = Object.values(events).some(e => e.type === type);
    if (lastEvKeyRef.current === key && hasData) { subscribeRealtime(myId); return () => unsubscribeRealtime(); }
    lastEvKeyRef.current = key;
    loadEvents(myId, type);
    subscribeRealtime(myId);
    return () => unsubscribeRealtime();
  }, [myId, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => Object.values(events)
    .filter(e => e.type === type)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()), [events, type]);

  // Фото событий (галерея) — одним запросом, группируем по событию
  const idsKey = list.map(e => e.id).join(',');
  useEffect(() => {
    const ids = list.map(e => e.id);
    if (!ids.length) { setPhotosMap({}); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('event_photos').select('event_id, file_url, preview_url, mime_type, created_at').in('event_id', ids).order('created_at', { ascending: true });
      if (cancelled) return;
      const m: Record<string, string[]> = {};
      for (const r of (data || []) as any[]) { const thumb = r.mime_type?.startsWith('video/') ? r.preview_url : r.file_url; if (thumb) (m[r.event_id] ||= []).push(thumb); }
      setPhotosMap(m);
    })();
    return () => { cancelled = true; };
  }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const imagesFor = (e: SigEvent) => uniq([e.cover_url || '', ...(photosMap[e.id] || [])]);

  const now = Date.now();
  const matchRsvp = (e: SigEvent) => rsvpFilter === 'all' || e.myRsvp === rsvpFilter;
  const matchDay = (e: SigEvent) => !selectedDay || dayKey(new Date(e.start_at)) === selectedDay;

  const upcoming = list.filter(e => e.status === 'active' && new Date(e.start_at).getTime() > now && matchRsvp(e) && matchDay(e));
  const past = list.filter(e => e.status === 'active' && new Date(e.start_at).getTime() <= now && matchRsvp(e) && matchDay(e))
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
  const cancelled = list.filter(e => e.status === 'cancelled' && matchRsvp(e) && matchDay(e));

  const eventDays = useMemo(() => {
    const s = new Set<string>();
    for (const e of list) if (e.status === 'active') s.add(dayKey(new Date(e.start_at)));
    return s;
  }, [list]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 21; i++) { const d = new Date(base); d.setDate(base.getDate() + i); arr.push(d); }
    return arr;
  }, []);

  const total = list.filter(e => e.status === 'active').length;

  // L6 — долгое нажатие по карточке → быстрые действия
  const onCardDown = (e: React.PointerEvent, ev: SigEvent) => {
    longPressedRef.current = false;
    pressStart.current = { x: e.clientX, y: e.clientY };
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => { longPressedRef.current = true; haptic.select(); setQuickEvent(ev); }, 470);
  };
  const onCardMove = (e: React.PointerEvent) => {
    if (Math.abs(e.clientX - pressStart.current.x) > 10 || Math.abs(e.clientY - pressStart.current.y) > 10) clearTimeout(pressTimer.current);
  };
  const onCardUp = () => clearTimeout(pressTimer.current);
  const onCardClickCapture = (e: React.MouseEvent) => {
    if (longPressedRef.current) { e.stopPropagation(); e.preventDefault(); longPressedRef.current = false; }
  };
  const quickRsvp = async (k: RsvpStatus) => {
    if (!quickEvent || !myId) return;
    haptic.success();
    await setMyRsvp(quickEvent.id, myId, k);
    setQuickEvent(null);
  };

  return (
    <div className="events-screen" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header events-list-header" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8 }}>
        <button onClick={() => nav('/apps')} aria-label="Назад" style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 6, marginLeft: -6, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BackIcon /></button>
        <h1 style={{ fontSize: 'var(--fs-display)', fontWeight: 700, textTransform: 'none', letterSpacing: -0.5, flex: 1 }}>{meta.title}</h1>
        <button onClick={() => nav('/map?createEvent=1&type=' + type)} aria-label="Создать"
          style={{ background: 'var(--primary)', color: 'var(--bg)', border: 'none', width: 38, height: 38, borderRadius: 19, fontSize: 'var(--fs-snap24)', fontWeight: 300, lineHeight: 1, cursor: 'pointer' }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
      </div>

      <div className="ev-row">
        {RSVP_FILTERS.map(f => {
          const active = rsvpFilter === f.key;
          return (
            <button key={f.key} className="ev-chip" onClick={() => { haptic.tap(); setRsvpFilter(f.key); }} style={{
              flexShrink: 0, padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
              border: '1px solid ' + (active ? 'transparent' : 'var(--border)'),
              background: active ? 'var(--text)' : 'var(--surface-light)',
              color: active ? 'var(--bg)' : 'var(--text)', fontSize: 'var(--fs-snap14)', fontWeight: 600,
            }}>{f.label}</button>
          );
        })}
      </div>

      <div className="ev-row">
        <button className="ev-chip" onClick={() => { haptic.tap(); setSelectedDay(null); }} style={{
          flexShrink: 0, minWidth: 52, padding: '6px 10px', borderRadius: 14, cursor: 'pointer',
          border: '1px solid ' + (!selectedDay ? 'transparent' : 'var(--border)'),
          background: !selectedDay ? 'var(--text)' : 'var(--surface-light)',
          color: !selectedDay ? 'var(--bg)' : 'var(--text)', fontSize: 'var(--fs-label)', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>Все</button>
        {days.map(d => {
          const k = dayKey(d);
          const active = selectedDay === k;
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          const has = eventDays.has(k);
          return (
            <button key={k} className="ev-chip" onClick={() => { haptic.tap(); setSelectedDay(active ? null : k); }} style={{
              flexShrink: 0, width: 52, padding: '6px 0 8px', borderRadius: 14, cursor: 'pointer',
              border: '1px solid ' + (active ? 'transparent' : 'var(--border)'),
              background: active ? 'var(--primary)' : 'var(--surface-light)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <span style={{ fontSize: 'var(--fs-snap10)', textTransform: 'uppercase', color: active ? 'var(--bg)' : weekend ? '#EF4444' : 'var(--muted)' }}>{d.toLocaleDateString('ru', { weekday: 'short' })}</span>
              <span style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, color: active ? 'var(--bg)' : 'var(--text)' }}>{d.getDate()}</span>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: has ? (active ? 'var(--bg)' : 'var(--primary)') : 'transparent' }} />
            </button>
          );
        })}
      </div>

      <div className="page-scroll events-list-scroll" style={{ padding: '6px 0 24px' }}>
        {loading && list.length === 0 && <EventListSkeleton />}

        {!loading && total === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--muted)' }}>
            <div className="ev-empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.5 }}><meta.Icon size={56} strokeWidth={1.4} /></div>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text)', marginBottom: 8 }}>Пока ничего нет</div>
            <button onClick={() => nav('/map?createEvent=1&type=' + type)} style={{ marginTop: 14, padding: '10px 22px', background: 'var(--primary)', color: 'var(--bg)', border: 'none', borderRadius: 20, fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer' }}>{meta.createCta}</button>
          </div>
        )}

        {!loading && total > 0 && (
          <div key={rsvpFilter + '|' + (selectedDay || 'all')} className="ev-results">
            {upcoming.length > 0 && (
              <>
                <div className="ev-section-title">{selectedDay ? 'В этот день' : 'Предстоящие'}</div>
                {upcoming.map((e, i) => <div key={e.id} className="ev-card-in" style={{ animationDelay: Math.min(i, 8) * 45 + 'ms' }} onPointerDown={(ev) => onCardDown(ev, e)} onPointerMove={onCardMove} onPointerUp={onCardUp} onPointerLeave={onCardUp} onClickCapture={onCardClickCapture}><EventFeedCard event={e} images={imagesFor(e)} onTap={() => nav('/events/' + e.id)} /></div>)}
              </>
            )}

            {past.length > 0 && (
              <Section title="Прошедшие">
                {past.map((e, i) => <div key={e.id} className="ev-card-in" style={{ animationDelay: Math.min(i, 8) * 45 + 'ms' }} onPointerDown={(ev) => onCardDown(ev, e)} onPointerMove={onCardMove} onPointerUp={onCardUp} onPointerLeave={onCardUp} onClickCapture={onCardClickCapture}><ListCard event={e} onTap={() => nav('/events/' + e.id)} dimmed /></div>)}
              </Section>
            )}
            {cancelled.length > 0 && (
              <Section title="Отменённые">
                {cancelled.map((e, i) => <div key={e.id} className="ev-card-in" style={{ animationDelay: Math.min(i, 8) * 45 + 'ms' }} onPointerDown={(ev) => onCardDown(ev, e)} onPointerMove={onCardMove} onPointerUp={onCardUp} onPointerLeave={onCardUp} onClickCapture={onCardClickCapture}><ListCard event={e} onTap={() => nav('/events/' + e.id)} dimmed /></div>)}
              </Section>
            )}

            {upcoming.length === 0 && past.length === 0 && cancelled.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)', fontSize: 'var(--fs-snap14)' }}>Ничего не найдено по фильтру</div>
            )}
          </div>
        )}
      </div>

      {quickEvent && (
        <FormSheet onClose={() => setQuickEvent(null)} title={quickEvent.title} maxWidth={420}>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: -4, marginBottom: 12 }}>{fmtEventDateTime(quickEvent)}</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {RSVP_STATUSES.map(s => {
              const active = quickEvent.myRsvp === s.key;
              return (
                <button key={s.key} className="ev-rsvp-btn" onClick={() => quickRsvp(s.key)} style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, cursor: 'pointer',
                  border: active ? 'none' : '1px solid var(--border)',
                  background: active ? s.color : 'var(--surface-light)',
                  color: active ? '#fff' : 'var(--text)', fontSize: 'var(--fs-label)', fontWeight: 700,
                }}>{s.label}</button>
              );
            })}
          </div>
          {typeof quickEvent.location_lat === 'number' && typeof quickEvent.location_lng === 'number' && (
            <button className="btn" style={{ background: 'var(--surface-light)', color: 'var(--text)', marginBottom: 8 }}
              onClick={() => { haptic.tap(); window.open(`https://maps.google.com/?q=${quickEvent.location_lat},${quickEvent.location_lng}`, '_blank'); setQuickEvent(null); }}>
              Открыть на карте
            </button>
          )}
          <button className="btn" onClick={() => { const eid = quickEvent.id; setQuickEvent(null); nav('/events/' + eid); }}>Открыть событие</button>
        </FormSheet>
      )}
    </div>
  );
}

function EventListSkeleton() {
  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: 'flex', gap: 12, background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <Skeleton width={84} height={94} rounded={0} />
          <div style={{ flex: 1, padding: '12px 12px 12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="65%" height={14} />
            <Skeleton width="45%" height={11} />
            <Skeleton width="30%" height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="ev-section-title">{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 12px' }}>{children}</div>
    </div>
  );
}

function ListCard({ event, onTap, dimmed }: { event: SigEvent; onTap: () => void; dimmed?: boolean }) {
  const meta = TYPE_META[event.type];
  return (
    <button onClick={onTap} className="ev-list-card" style={{
      display: 'flex', alignItems: 'stretch', gap: 12,
      background: 'var(--surface-light)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 0, cursor: 'pointer', overflow: 'hidden',
      width: '100%', textAlign: 'left', opacity: dimmed ? 0.7 : 1,
    }}>
      <div style={{ width: 84, flexShrink: 0, background: event.cover_url ? 'transparent' : 'var(--surface-light)' , display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {event.cover_url ? <img src={event.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <meta.Icon size={32} color="#fff" strokeWidth={1.6} />}
      </div>
      <div style={{ flex: 1, padding: '11px 12px 11px 0', minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{event.title}</div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginBottom: 6 }}>{fmtEventDateTime(event)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><PeopleMiniIcon /> {event.goingCount || 0}</span>
          {event.myRsvp && <span style={{ marginLeft: 'auto' }}><RsvpBadge rsvp={event.myRsvp} /></span>}
        </div>
      </div>
    </button>
  );
}


function PeopleMiniIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.7" />
      <path d="M16 3.3a4 4 0 0 1 0 7.4" />
    </svg>
  );
}

export const RSVP_STATUSES: Array<{ key: RsvpStatus; label: string; color: string }> = [
  { key: 'going',     label: 'Иду',       color: '#10B981' },
  { key: 'maybe',     label: 'Возможно',  color: '#FBBF24' },
  { key: 'not_going', label: 'Не иду',    color: '#EF4444' },
];
