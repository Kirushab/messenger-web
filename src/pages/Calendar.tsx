import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useEventsStore, type SigEvent } from '@/stores/eventsStore';
import { avatarColor } from '@/lib/utils';
import PullToRefresh from '@/components/PullToRefresh';
import EventFeedCard, { TYPE_META, RsvpBadge } from '@/components/EventFeedCard';
import { Skeleton } from '@/components/Skeleton';
import {
  IconPartyPopper, IconPlane, IconCalendar, IconChevronLeft, IconChevronRight,
  IconList, IconCheck, IconPlus, IconMapPin, IconCake,
} from '@/components/icons/EventIcons';

interface UserBirthday {
  id: string;
  display_name: string;
  avatar_url: string | null;
  birthday: string;  // YYYY-MM-DD
}

const MONTHS_RU = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const WEEKDAYS_RU = ['пн','вт','ср','чт','пт','сб','вс'];

function monthLabel(d: Date): string {
  return `${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const dayOfWeek = (first.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - dayOfWeek);
  const rows: Date[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: Date[] = [];
    for (let c = 0; c < 7; c++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + r * 7 + c);
      row.push(d);
    }
    rows.push(row);
  }
  return rows;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

// Сколько дней назад/вперёд
function relativeDay(d: Date, today: Date): string | null {
  const days = Math.floor((d.getTime() - today.setHours(0,0,0,0)) / 86400000);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days === 2) return 'послезавтра';
  if (days >= 3 && days <= 6) return `через ${days} ${days === 5 ? 'дней' : days > 4 ? 'дней' : 'дня'}`;
  return null;
}

type ViewMode = 'list' | 'grid';
type RsvpFilter = 'going' | 'all';

export default function Calendar() {
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const eventsRecord = useEventsStore(s => s.events);
  const membersByEvent = useEventsStore(s => s.membersByEvent);
  const loadEvents = useEventsStore(s => s.loadEvents);

  const [view, setView] = useState<ViewMode>('list');
  const [rsvpFilter, setRsvpFilter] = useState<RsvpFilter>('all');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [birthdays, setBirthdays] = useState<UserBirthday[]>([]);
  const [loading, setLoading] = useState(() => Object.keys(useEventsStore.getState().events).length === 0);
  const [photosMap, setPhotosMap] = useState<Record<string, string[]>>({});

  const eventsList = useMemo(() => Object.values(eventsRecord), [eventsRecord]);

  const loadData = async () => {
    setLoading(true);
    if (myId) await loadEvents(myId);
    const { data: bdays } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, birthday')
      .eq('birthday_visible', true)
      .not('birthday', 'is', null);
    setBirthdays((bdays || []) as any);
    setLoading(false);
  };

  const lastCalKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!myId) return;
    // На re-mount с теми же параметрами и уже загруженными данными — не дёргаем БД
    if (lastCalKeyRef.current === myId && eventsList.length > 0 && birthdays.length > 0) return;
    lastCalKeyRef.current = myId;
    loadData();
    /* eslint-disable-next-line */
  }, [myId]);

  // ============ Группировки ============

  const byMonthDay = useMemo(() => {
    const map = new Map<string, UserBirthday[]>();
    for (const u of birthdays) {
      if (!u.birthday) continue;
      const [, m, d] = u.birthday.split('-');
      const key = `${m}-${d}`;
      const arr = map.get(key) || [];
      arr.push(u);
      map.set(key, arr);
    }
    return map;
  }, [birthdays]);

  // Фильтр по RSVP — учитывает только активные события
  const filteredEvents = useMemo(() => {
    return eventsList.filter(ev => {
      if (ev.status !== 'active') return false;
      if (rsvpFilter === 'going') return ev.myRsvp === 'going';
      return true;
    });
  }, [eventsList, rsvpFilter]);

  // Группировка по дате старта для сетки календаря
  const eventsByDate = useMemo(() => {
    const map = new Map<string, SigEvent[]>();
    const now = Date.now();
    for (const ev of filteredEvents) {
      const endTime = ev.end_at ? new Date(ev.end_at).getTime() : new Date(ev.start_at).getTime() + 24 * 60 * 60 * 1000;
      if (endTime < now) continue;
      const dateKey = ev.start_at.slice(0, 10);
      const arr = map.get(dateKey) || [];
      arr.push(ev);
      map.set(dateKey, arr);
    }
    return map;
  }, [filteredEvents]);

  // Список ближайших событий (сегодня и позже), отсортированный по дате
  const upcoming = useMemo(() => {
    const now = Date.now();
    return filteredEvents
      .filter(ev => {
        const endTime = ev.end_at ? new Date(ev.end_at).getTime() : new Date(ev.start_at).getTime() + 24 * 60 * 60 * 1000;
        return endTime >= now;
      })
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  }, [filteredEvents]);

  const past = useMemo(() => {
    const now = Date.now();
    return filteredEvents
      .filter(ev => {
        const endTime = ev.end_at ? new Date(ev.end_at).getTime() : new Date(ev.start_at).getTime() + 24 * 60 * 60 * 1000;
        return endTime < now;
      })
      .sort((a, b) => b.start_at.localeCompare(a.start_at))
      .slice(0, 30);
  }, [filteredEvents]);

  // Фото событий (галерея) — для карусели в карточках ленты. Одним запросом по предстоящим.
  const upcomingIdsKey = upcoming.map(e => e.id).join(',');
  useEffect(() => {
    const ids = upcoming.map(e => e.id);
    if (!ids.length) { setPhotosMap({}); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('event_photos')
        .select('event_id, file_url, preview_url, mime_type, created_at')
        .in('event_id', ids)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      const m: Record<string, string[]> = {};
      for (const r of (data || []) as any[]) { const thumb = r.mime_type?.startsWith('video/') ? r.preview_url : r.file_url; if (thumb) (m[r.event_id] ||= []).push(thumb); }
      setPhotosMap(m);
    })();
    return () => { cancelled = true; };
  }, [upcomingIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const imagesFor = (e: SigEvent): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of [e.cover_url || '', ...(photosMap[e.id] || [])]) {
      if (u && !seen.has(u)) { seen.add(u); out.push(u); }
    }
    return out;
  };

  // Календарь
  const grid = useMemo(() => getMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const today = new Date();
  const currentMonth = cursor.getMonth();

  const birthdaysOnDay = (day: Date): UserBirthday[] => {
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const d = String(day.getDate()).padStart(2, '0');
    return byMonthDay.get(`${m}-${d}`) || [];
  };

  const sigEventsOnDay = (day: Date): SigEvent[] => {
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const d = String(day.getDate()).padStart(2, '0');
    return eventsByDate.get(`${y}-${m}-${d}`) || [];
  };

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDay(d);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div className="page-header" style={{display:'flex',alignItems:'center',gap:10,paddingBottom:6}}>
        <h1 style={{fontSize: 'var(--fs-display)', textTransform:'none', letterSpacing:0, flex:1, margin:0}}>События</h1>

        <button
          onClick={() => nav('/map?createEvent=1')}
          aria-label="Создать событие"
          style={{
            width:40, height:40, borderRadius:20,
            background:'var(--accent)', border:'none', color:'#fff', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 8px 20px -6px var(--accent)',
          }}
        >
          <IconPlus size={20} strokeWidth={2.4} />
        </button>
      </div>

      {/* Вид: Лента / Сетка (полноширинный сегмент) */}
      <div style={{ padding:'6px 12px 16px' }}>
        <div style={{ display:'flex', gap:4, background:'var(--surface-light)', borderRadius:14, padding:4 }}>
          {([['list','Лента'],['grid','Сетка']] as [ViewMode, string][]).map(([k, lb]) => {
            const on = view === k;
            return (
              <button key={k} onClick={() => setView(k)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, border:'none', cursor:'pointer', height:36, borderRadius:10, fontSize:'var(--fs-label)', fontWeight: on ? 600 : 500, background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text)' : 'var(--text2)', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.22)' : 'none', transition:'background .15s' }}>
                {k === 'list'
                  ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="4.5" cy="6" r="1.5" fill="currentColor"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor"/></svg>
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>}
                {lb}
              </button>
            );
          })}
        </div>
      </div>

      <PullToRefresh onRefresh={loadData} style={{flex:1, padding:'0 12px 24px'}}>
        {view === 'list' ? (
          <ListView
            upcoming={upcoming}
            past={past}
            birthdays={birthdays}
            loading={loading}
            onOpen={(id) => nav('/events/' + id)}
            onCreate={() => nav('/map?createEvent=1')}
            rsvpFilter={rsvpFilter}
            today={today}
            imagesFor={imagesFor}
            membersFor={(e) => membersByEvent[e.id] || []}
          />
        ) : (
          <EventGridView
            upcoming={upcoming}
            past={past}
            loading={loading}
            imagesFor={imagesFor}
            onOpen={(id) => nav('/events/' + id)}
          />
        )}
      </PullToRefresh>
    </div>
  );
}

// ============ LIST VIEW — главный экран ============

function ListView({ upcoming, past, birthdays, loading, onOpen, onCreate, rsvpFilter, today, imagesFor, membersFor }: {
  upcoming: SigEvent[];
  past: SigEvent[];
  birthdays: UserBirthday[];
  loading: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
  rsvpFilter: RsvpFilter;
  today: Date;
  imagesFor: (e: SigEvent) => string[];
  membersFor?: (e: SigEvent) => { user_id: string; rsvp: string | null; user?: { display_name?: string | null; avatar_url?: string | null } | null }[];
}) {
  // Ближайшие дни рождения (через ≤ 30 дней)
  const upcomingBdays = useMemo(() => {
    const list: { user: UserBirthday; date: Date }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 30);
    for (const u of birthdays) {
      const [, m, d] = u.birthday.split('-').map(Number);
      let bday = new Date(now.getFullYear(), m - 1, d);
      if (bday < now) bday = new Date(now.getFullYear() + 1, m - 1, d);
      if (bday <= cutoff) list.push({ user: u, date: bday });
    }
    return list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [birthdays]);

  // В режиме «Я иду» дни рождения не показываем
  const showBdays = rsvpFilter === 'all';

  if (loading) {
    return (
      <div style={{padding:'16px', display:'flex', flexDirection:'column', gap:12}}>
        {Array.from({length:4}).map((_,i)=>(
          <div key={i} style={{display:'flex',gap:12,alignItems:'center'}}>
            <Skeleton width={56} height={56} rounded={12} />
            <div style={{flex:1}}>
              <Skeleton width="65%" height={16} style={{marginBottom:8}} />
              <Skeleton width="40%" height={12} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (upcoming.length === 0 && (!showBdays || upcomingBdays.length === 0) && past.length === 0) {
    return (
      <div style={{padding:'48px 24px', textAlign:'center', color:'var(--muted)'}}>
        <div style={{display:'flex', justifyContent:'center', marginBottom:14, opacity:0.45}}>
          <IconCalendar size={56} strokeWidth={1.3} />
        </div>
        <div style={{fontSize: 'var(--fs-body)', color:'var(--text)', marginBottom:8}}>
          {rsvpFilter === 'going' ? 'Вы пока никуда не идёте' : 'Событий пока нет'}
        </div>
        <div style={{fontSize: 'var(--fs-label)', marginBottom:16}}>
          {rsvpFilter === 'going' ? 'Откройте «Все» чтобы увидеть существующие события' : 'Создайте тусу или поездку'}
        </div>
        {rsvpFilter === 'all' && (
          <button
            onClick={onCreate}
            style={{
              padding:'10px 22px', background:'var(--primary)', color:'var(--bg)',
              border:'none', borderRadius:20, fontSize: 'var(--fs-snap14)', fontWeight:600, cursor:'pointer',
            }}
          >Создать событие</button>
        )}
      </div>
    );
  }

  return (
    <>
      {upcoming.length > 0 && (
        <div>
          <div className="ev-section-title">Ближайшие</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {upcoming.map(ev => (
              <EventFeedCard key={ev.id} event={ev} images={imagesFor(ev)} onTap={() => onOpen(ev.id)} going={(membersFor?.(ev) || []).filter(m => m.rsvp === 'going')} />
            ))}
          </div>
        </div>
      )}

      {showBdays && upcomingBdays.length > 0 && (
        <Section title="Дни рождения">
          {upcomingBdays.map(({ user, date }) => (
            <BirthdayRow key={user.id} user={user} date={date} today={new Date(today)} />
          ))}
        </Section>
      )}

      {past.length > 0 && (
        <PastSection events={past} onOpen={onOpen} />
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{
        fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)',
        letterSpacing:0.5, textTransform:'uppercase',
        padding:'10px 4px 8px',
      }}>{title}</div>
      <div style={{display:'flex', flexDirection:'column', gap:8}}>{children}</div>
    </div>
  );
}

function EventRow({ event, onTap, today }: { event: SigEvent; onTap: () => void; today: Date }) {
  const startDate = new Date(event.start_at);
  const dayName = startDate.toLocaleDateString('ru', { weekday: 'short' });
  const dayNum = startDate.getDate();
  const monthShort = startDate.toLocaleDateString('ru', { month: 'short' });
  const timeStr = fmtTime(startDate);
  const rel = relativeDay(startDate, new Date(today));
  const isGoing = event.myRsvp === 'going';
  const Icon = event.type === 'party' ? IconPartyPopper : IconPlane;
  const gradient = event.type === 'party'
    ? 'linear-gradient(135deg, #EC4899, #BE185D)'
    : 'linear-gradient(135deg, #60A5FA, #2563EB)';

  return (
    <button
      onClick={onTap}
      className="tap-effect"
      style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'10px 12px',
        background:'var(--surface-light)',
        border:'1px solid var(--border)',
        borderLeft: isGoing ? '3px solid #10B981' : '1px solid var(--border)',
        borderRadius:12, cursor:'pointer', width:'100%', textAlign:'left',
        color:'var(--text)',
      }}
    >
      {/* Дата-блок слева */}
      <div style={{
        width:48, flexShrink:0,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        background: isGoing ? 'rgba(16,185,129,0.12)' : 'var(--surface)',
        border: isGoing ? '1px solid rgba(16,185,129,0.35)' : '1px solid var(--border)',
        borderRadius:10, padding:'6px 0',
      }}>
        <div style={{fontSize: 'var(--fs-snap10)', fontWeight:600, color: isGoing ? '#10B981' : 'var(--muted)', textTransform:'uppercase', letterSpacing:0.3}}>
          {dayName}
        </div>
        <div style={{fontSize: 'var(--fs-heading)', fontWeight:700, color: isGoing ? '#10B981' : 'var(--text)', lineHeight:1, fontVariantNumeric:'tabular-nums'}}>
          {dayNum}
        </div>
        <div style={{fontSize:9, fontWeight:600, color: isGoing ? '#10B981' : 'var(--muted)', textTransform:'uppercase', letterSpacing:0.3}}>
          {monthShort.replace('.', '')}
        </div>
      </div>

      {/* Контент */}
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
          <div style={{
            width:18, height:18, borderRadius:5,
            background: gradient,
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', flexShrink:0,
          }}>
            <Icon size={11} strokeWidth={2} />
          </div>
          <div style={{
            fontSize: 'var(--fs-snap14)', fontWeight:600,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            color:'var(--text)', flex:1, minWidth:0,
          }}>{event.title}</div>
          {isGoing && (
            <div style={{
              display:'inline-flex', alignItems:'center', gap:3,
              padding:'1px 6px 1px 4px',
              background:'rgba(16,185,129,0.15)',
              borderRadius:8, color:'#10B981',
              fontSize: 'var(--fs-snap10)', fontWeight:600, flexShrink:0,
            }}>
              <IconCheck size={10} strokeWidth={2.5} /> иду
            </div>
          )}
        </div>
        <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)', display:'flex', alignItems:'center', gap:6}}>
          <span>{timeStr}</span>
          {rel && <span style={{color:'var(--accent)', fontWeight:500}}>· {rel}</span>}
          {event.location_name && (
            <span style={{display:'inline-flex', alignItems:'center', gap:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0}}>
              · <IconMapPin size={10} /> <span style={{overflow:'hidden', textOverflow:'ellipsis'}}>{event.location_name}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function BirthdayRow({ user, date, today }: { user: UserBirthday; date: Date; today: Date }) {
  const rel = relativeDay(date, new Date(today));
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'10px 12px',
      background:'var(--surface-light)',
      border:'1px solid rgba(251,191,36,0.25)',
      borderLeft:'3px solid #FBBF24',
      borderRadius:12,
    }}>
      <div style={{
        width:42, height:42, borderRadius:21,
        background:'rgba(251,191,36,0.15)', color:'#D97706',
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }}>
        <IconCake size={20} />
      </div>
      {user.avatar_url
        ? <img src={user.avatar_url} alt="" style={{width:32,height:32,borderRadius:16,objectFit:'cover'}} />
        : <div style={{width:32,height:32,borderRadius:16,background:avatarColor(user.id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-label)',fontWeight:600}}>{user.display_name?.[0]?.toUpperCase()}</div>}
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
          {user.display_name}
        </div>
        <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)'}}>
          {fmtDate(date)}{rel ? ' · ' + rel : ''}
        </div>
      </div>
    </div>
  );
}

function PastSection({ events, onOpen }: { events: SigEvent[]; onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{marginTop:18}}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display:'flex',alignItems:'center',gap:8,
          width:'100%',padding:'10px 4px',
          background:'none',border:'none',cursor:'pointer',
          color:'var(--muted)',fontSize: 'var(--fs-micro)',fontWeight:600,
          letterSpacing:0.5,textTransform:'uppercase',
        }}
      >
        <span style={{flex:1,textAlign:'left'}}>Прошедшие ({events.length})</span>
        <IconChevronRight size={14} strokeWidth={2.4} style={{transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform 0.2s'}} />
      </button>
      {expanded && (
        <div style={{display:'flex', flexDirection:'column', gap:6}}>
          {events.map(ev => (
            <button
              key={ev.id}
              onClick={() => onOpen(ev.id)}
              className="tap-effect"
              style={{
                display:'flex',alignItems:'center',gap:10,
                padding:'8px 10px',
                background:'var(--surface-light)',border:'1px solid var(--border)',
                borderRadius:10,cursor:'pointer',width:'100%',textAlign:'left',
                color:'var(--text)',opacity:0.7,
              }}
            >
              {ev.cover_url
                ? <img src={ev.cover_url} alt="" style={{width:36,height:36,borderRadius:8,objectFit:'cover',flexShrink:0,filter:'grayscale(40%)'}} />
                : <div style={{width:36,height:36,borderRadius:8,background:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'var(--muted)'}}>{ev.type === 'party' ? <IconPartyPopper size={20} /> : <IconPlane size={20} />}</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize: 'var(--fs-label)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {ev.title}
                </div>
                <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginTop:1}}>
                  {new Date(ev.start_at).toLocaleDateString('ru', { day:'numeric', month:'short', year:'numeric' })}
                  {ev.status === 'cancelled' && ' · отменено'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ GRID VIEW — 2 колонки карточек событий ============

function EventGridCard({ event, image, onTap, past }: { event: SigEvent; image?: string; onTap: () => void; past?: boolean }) {
  const meta = TYPE_META[event.type];
  // Pinterest-масонри: вариативная высота обложки, детерминированная по id
  const h = [132, 172, 210][Math.abs(Array.from(event.id).reduce((a, c) => a + c.charCodeAt(0), 0)) % 3];
  return (
    <div onClick={onTap} style={{ cursor: 'pointer', opacity: past ? 0.65 : 1, display: 'flex', flexDirection: 'column', gap: 8, breakInside: 'avoid', marginBottom: 16 }}>
      <div style={{ position: 'relative', height: h, borderRadius: 18, overflow: 'hidden', background: meta.gradient }}>
        {image
          ? <img src={image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 80% 10%,rgba(255,255,255,.24),rgba(255,255,255,0) 55%)' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><meta.Icon size={40} color="rgba(255,255,255,0.9)" strokeWidth={1.5} /></div>
            </>}
        <span style={{ position: 'absolute', top: 9, left: 9, background: 'rgba(10,10,12,0.5)', color: '#fff', fontSize: 'var(--fs-micro)', fontWeight: 600, padding: '4px 9px', borderRadius: 999, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>{meta.label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600, letterSpacing: '-0.1px', color: 'var(--text)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{event.title}</div>
        <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="2"/></svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.location_name || new Date(event.start_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span>
        </div>
      </div>
    </div>
  );
}

function EventGridView({ upcoming, past, loading, imagesFor, onOpen }: {
  upcoming: SigEvent[]; past: SigEvent[]; loading: boolean;
  imagesFor: (e: SigEvent) => string[]; onOpen: (id: string) => void;
}) {
  const grid2: React.CSSProperties = { columns: 2, columnGap: 12 };
  if (loading && upcoming.length === 0 && past.length === 0) {
    return <div style={grid2}>{[0, 1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: [180, 230, 200, 250][i], borderRadius: 18, breakInside: 'avoid', marginBottom: 16 }} />)}</div>;
  }
  if (upcoming.length === 0 && past.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text2)', padding: '48px 16px', fontSize: 'var(--fs-body)' }}>Событий пока нет</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {upcoming.length > 0 && (
        <div>
          <div className="ev-section-title">Ближайшие</div>
          <div style={grid2}>{upcoming.map(e => <EventGridCard key={e.id} event={e} image={imagesFor(e)[0]} onTap={() => onOpen(e.id)} />)}</div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <div className="ev-section-title">Прошедшие</div>
          <div style={grid2}>{past.map(e => <EventGridCard key={e.id} event={e} image={imagesFor(e)[0]} onTap={() => onOpen(e.id)} past />)}</div>
        </div>
      )}
    </div>
  );
}

// ============ GRID VIEW — календарь ============

// Одна ячейка дня — выделено в компонент чтобы можно было одинаково рендерить
// текущий, прошлый и следующий месяц в follow-finger треке.
function DayCell({
  day, currentMonth, today, selectedDay, setSelectedDay,
  birthdaysOnDay, sigEventsOnDay,
}: {
  day: Date;
  currentMonth: number;
  today: Date;
  selectedDay: Date | null;
  setSelectedDay: (d: Date) => void;
  birthdaysOnDay: (d: Date) => UserBirthday[];
  sigEventsOnDay: (d: Date) => SigEvent[];
}) {
  const inMonth = day.getMonth() === currentMonth;
  const isToday = isSameDate(day, today);
  const isSelected = selectedDay && isSameDate(day, selectedDay);
  const bdays = birthdaysOnDay(day);
  const sigEvents = sigEventsOnDay(day);
  const hasBday = bdays.length > 0 && inMonth;
  const hasEvent = sigEvents.length > 0 && inMonth;
  const hasMyGoing = sigEvents.some(e => e.myRsvp === 'going') && inMonth;
  const hasParty = sigEvents.some(e => e.type === 'party') && inMonth;
  const hasTrip = sigEvents.some(e => e.type === 'trip') && inMonth;
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

  let cellTint: string | null = null;
  let cellText: string | null = null;
  if (inMonth) {
    if (hasMyGoing)      { cellTint = 'rgba(16,185,129,0.16)'; cellText = '#10B981'; }
    else if (hasParty)   { cellTint = 'rgba(236,72,153,0.14)'; cellText = '#EC4899'; }
    else if (hasTrip)    { cellTint = 'rgba(59,130,246,0.14)'; cellText = '#3B82F6'; }
    else if (hasBday)    { cellTint = 'rgba(251,191,36,0.16)'; cellText = '#B45309'; }
  }

  return (
    <button
      onClick={() => setSelectedDay(day)}
      style={{
        aspectRatio:'1/1', maxHeight:50, border:'none',
        background: isSelected
          ? (hasMyGoing ? '#10B981' : 'var(--primary)')
          : cellTint ? cellTint : (isToday ? 'var(--surface-light)' : 'transparent'),
        borderRadius:10, cursor:'pointer',
        color: isSelected
          ? (hasMyGoing ? '#fff' : 'var(--bg)')
          : !inMonth ? 'var(--muted)' : cellText ? cellText : isWeekend ? 'var(--muted)' : 'var(--text)',
        fontSize: 'var(--fs-snap14)',
        fontWeight: isToday || isSelected || hasMyGoing || !!cellTint ? 700 : 500,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        position:'relative',
        opacity: inMonth ? 1 : 0.45,
        transition:'background 0.15s',
      }}
    >
      <span style={{lineHeight:1}}>{day.getDate()}</span>
      {(hasBday || hasEvent) && (
        <div style={{position:'absolute', bottom:4, display:'flex', gap:2}}>
          {hasEvent && sigEvents.slice(0, 3).map((ev, i) => (
            <span key={'ev-' + i} style={{
              width:4, height:4, borderRadius:2,
              background: isSelected
                ? (ev.myRsvp === 'going' ? '#fff' : 'var(--bg)')
                : ev.myRsvp === 'going' ? '#10B981' : (ev.type === 'party' ? '#EC4899' : '#3B82F6'),
            }} />
          ))}
          {hasBday && bdays.slice(0, 2).map((_, i) => (
            <span key={'bd-' + i} style={{
              width:4, height:4, borderRadius:2,
              background: isSelected ? 'var(--bg)' : '#FBBF24',
            }} />
          ))}
        </div>
      )}
    </button>
  );
}

// Сетка одного месяца (без шапки и легенды)
function MonthGridPane(props: {
  cursorDate: Date;
  today: Date;
  selectedDay: Date | null;
  setSelectedDay: (d: Date) => void;
  birthdaysOnDay: (d: Date) => UserBirthday[];
  sigEventsOnDay: (d: Date) => SigEvent[];
}) {
  const grid = useMemo(
    () => getMonthGrid(props.cursorDate.getFullYear(), props.cursorDate.getMonth()),
    [props.cursorDate]
  );
  const currentMonth = props.cursorDate.getMonth();
  return (
    <div style={{display:'flex', flexDirection:'column', gap:2, width:'100%', flexShrink:0}}>
      {grid.map((row, ri) => (
        <div key={ri} style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2}}>
          {row.map(day => (
            <DayCell
              key={day.toISOString()}
              day={day}
              currentMonth={currentMonth}
              today={props.today}
              selectedDay={props.selectedDay}
              setSelectedDay={props.setSelectedDay}
              birthdaysOnDay={props.birthdaysOnDay}
              sigEventsOnDay={props.sigEventsOnDay}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function GridView({
  cursor, currentMonth, today, selectedDay, setSelectedDay,
  birthdaysOnDay, sigEventsOnDay, goPrev, goNext, goToday,
  onOpenEvent, onOpenUser,
}: {
  cursor: Date;
  grid: Date[][]; // не используется внутри — оставлен для совместимости пропсов сверху
  currentMonth: number;
  today: Date;
  selectedDay: Date | null;
  setSelectedDay: (d: Date) => void;
  birthdaysOnDay: (d: Date) => UserBirthday[];
  sigEventsOnDay: (d: Date) => SigEvent[];
  goPrev: () => void;
  goNext: () => void;
  goToday: () => void;
  onOpenEvent: (id: string) => void;
  onOpenUser: (id: string) => void;
}) {
  // === Follow-finger swipe between months ===
  const viewportRef = useRef<HTMLDivElement>(null);
  const [dragDx, setDragDx] = useState(0);        // текущее смещение в пикселях
  const [animating, setAnimating] = useState(false);
  const startRef = useRef<{ x: number; y: number; t: number; w: number; locked: 'h' | 'v' | null } | null>(null);

  // Соседние месяцы — рендерим всегда чтобы они были готовы при свайпе.
  const prevDate = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1), [cursor]);
  const nextDate = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1), [cursor]);

  // Анимация перехода: едем влево/вправо на полный viewport, после транзишена
  // коммитим setCursor (через goPrev/goNext) и мгновенно возвращаем смещение в 0
  // — пользователь видит новый месяц на том же месте, без рывка.
  const animateAndCommit = (dir: -1 | 1) => {
    const w = viewportRef.current?.clientWidth || window.innerWidth;
    setAnimating(true);
    setDragDx(dir === 1 ? -w : w);
    window.setTimeout(() => {
      // Сначала коммитим новую дату — родитель пересчитает cursor → prev/next пересчитаются
      if (dir === 1) goNext(); else goPrev();
      // Затем мгновенно возвращаем трек в исходную позицию без анимации
      setAnimating(false);
      setDragDx(0);
    }, 260);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (animating) return;
    const t = e.touches[0];
    startRef.current = {
      x: t.clientX, y: t.clientY, t: Date.now(),
      w: viewportRef.current?.clientWidth || window.innerWidth,
      locked: null,
    };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = startRef.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Решаем в какую сторону жест (горизонталь/вертикаль) на первом значительном движении
    if (!s.locked) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        s.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
    }
    if (s.locked === 'h') {
      // Уменьшаем сопротивление на границах (rubber band) — не критично, просто не на полную
      setDragDx(dx);
    }
  };
  const onTouchEnd = () => {
    const s = startRef.current;
    if (!s) return;
    startRef.current = null;
    if (s.locked !== 'h') return; // вертикальный скролл — ничего не делаем

    const dx = dragDx;
    const dt = Date.now() - s.t;
    const velocity = Math.abs(dx) / Math.max(dt, 1);          // px/мс
    const threshold = s.w * 0.25;                              // 25% ширины
    const fastFlick = velocity > 0.5 && Math.abs(dx) > 24;     // быстрый swipe

    if (Math.abs(dx) > threshold || fastFlick) {
      // Защёлкиваемся на соседний месяц
      animateAndCommit(dx < 0 ? 1 : -1);
    } else {
      // Пружиним обратно
      setAnimating(true);
      setDragDx(0);
      window.setTimeout(() => setAnimating(false), 220);
    }
  };

  return (
    <>
      {/* Month switcher */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 4px 10px'}}>
        <button onClick={() => !animating && animateAndCommit(-1)} style={{width:36, height:36, borderRadius:18, background:'var(--surface-light)', border:'none', color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
          <IconChevronLeft size={16} strokeWidth={2.2} />
        </button>
        <button onClick={goToday} style={{fontSize: 'var(--fs-snap16)', fontWeight:600, color:'var(--text)', textTransform:'capitalize', fontVariantNumeric:'tabular-nums', background:'none', border:'none', cursor:'pointer', padding:'6px 12px', borderRadius:10}}>
          {monthLabel(cursor)}
        </button>
        <button onClick={() => !animating && animateAndCommit(1)} style={{width:36, height:36, borderRadius:18, background:'var(--surface-light)', border:'none', color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
          <IconChevronRight size={16} strokeWidth={2.2} />
        </button>
      </div>

      {/* Weekdays */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', marginBottom:6}}>
        {WEEKDAYS_RU.map(w => (
          <div key={w} style={{textAlign:'center', fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)', padding:'4px 0', textTransform:'uppercase', letterSpacing:0.5}}>{w}</div>
        ))}
      </div>

      {/* Viewport со скрытым overflow — внутри track шириной 300% с тремя месяцами */}
      <div
        ref={viewportRef}
        style={{overflow:'hidden', touchAction:'pan-y'}}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          style={{
            display:'flex',
            width:'300%',
            transform:`translate3d(calc(-33.3333% + ${dragDx}px), 0, 0)`,
            transition: animating ? 'transform 240ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
            willChange: 'transform',
          }}
        >
          <div style={{width:'33.3333%', flexShrink:0, padding:'0 0.5px'}}>
            <MonthGridPane
              cursorDate={prevDate}
              today={today}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              birthdaysOnDay={birthdaysOnDay}
              sigEventsOnDay={sigEventsOnDay}
            />
          </div>
          <div style={{width:'33.3333%', flexShrink:0, padding:'0 0.5px'}}>
            <MonthGridPane
              cursorDate={cursor}
              today={today}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              birthdaysOnDay={birthdaysOnDay}
              sigEventsOnDay={sigEventsOnDay}
            />
          </div>
          <div style={{width:'33.3333%', flexShrink:0, padding:'0 0.5px'}}>
            <MonthGridPane
              cursorDate={nextDate}
              today={today}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              birthdaysOnDay={birthdaysOnDay}
              sigEventsOnDay={sigEventsOnDay}
            />
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div style={{display:'flex', gap:14, padding:'12px 8px 0', fontSize: 'var(--fs-micro)', color:'var(--muted)', flexWrap:'wrap'}}>
        <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
          <span style={{width:8, height:8, borderRadius:4, background:'#10B981'}} /> Иду
        </span>
        <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
          <span style={{width:8, height:8, borderRadius:4, background:'#EC4899'}} /> Туса
        </span>
        <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
          <span style={{width:8, height:8, borderRadius:4, background:'#3B82F6'}} /> Поездка
        </span>
        <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
          <span style={{width:8, height:8, borderRadius:4, background:'#FBBF24'}} /> ДР
        </span>
      </div>

      {/* Selected day list */}
      {selectedDay && (() => {
        const evs = birthdaysOnDay(selectedDay);
        const sigEvs = sigEventsOnDay(selectedDay);
        return (
          <div style={{marginTop:20}}>
            <div style={{fontSize: 'var(--fs-label)', fontWeight:600, color:'var(--muted)', letterSpacing:0.5, textTransform:'uppercase', padding:'0 4px 8px'}}>
              {selectedDay.toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            {(evs.length === 0 && sigEvs.length === 0) && (
              <div style={{padding:'20px 16px', color:'var(--muted)', fontSize: 'var(--fs-label)', textAlign:'center'}}>
                Событий нет
              </div>
            )}
            {sigEvs.map(ev => (
              <button
                key={'sig-' + ev.id}
                onClick={() => onOpenEvent(ev.id)}
                className="tap-effect"
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'10px 12px', marginBottom:6,
                  background: ev.myRsvp === 'going' ? 'rgba(16,185,129,0.10)' : 'var(--surface-light)',
                  border:'1px solid var(--border)',
                  borderLeft: ev.myRsvp === 'going' ? '3px solid #10B981' : '1px solid var(--border)',
                  borderRadius:10,
                  cursor:'pointer', width:'100%', textAlign:'left', color:'var(--text)',
                }}
              >
                <div style={{
                  width:36, height:36, borderRadius:8,
                  background: ev.type === 'party' ? 'linear-gradient(135deg, #EC4899, #BE185D)' : 'linear-gradient(135deg, #60A5FA, #2563EB)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#fff', flexShrink:0,
                }}>
                  {ev.type === 'party' ? <IconPartyPopper size={18} /> : <IconPlane size={18} />}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{ev.title}</div>
                  <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)'}}>
                    {fmtTime(new Date(ev.start_at))}
                    {ev.location_name ? ' · ' + ev.location_name : ''}
                  </div>
                </div>
                {ev.myRsvp === 'going' && (
                  <span style={{
                    display:'inline-flex', alignItems:'center', gap:3,
                    padding:'2px 7px',
                    background:'#10B981', color:'#fff',
                    borderRadius:8, fontSize: 'var(--fs-snap10)', fontWeight:700,
                  }}>
                    <IconCheck size={10} strokeWidth={3} /> иду
                  </span>
                )}
              </button>
            ))}
            {evs.map(u => {
              const ageOn = (() => {
                const b = new Date(u.birthday + 'T00:00:00');
                let age = selectedDay.getFullYear() - b.getFullYear();
                const m = selectedDay.getMonth() - b.getMonth();
                if (m < 0 || (m === 0 && selectedDay.getDate() < b.getDate())) age--;
                return age;
              })();
              return (
                <button
                  key={'bd-' + u.id}
                  onClick={() => onOpenUser(u.id)}
                  className="tap-effect"
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 12px', marginBottom:6,
                    background:'var(--surface-light)',
                    border:'1px solid rgba(251,191,36,0.25)',
                    borderLeft:'3px solid #FBBF24',
                    borderRadius:10, cursor:'pointer', width:'100%', textAlign:'left',
                    color:'var(--text)',
                  }}
                >
                  <div style={{width:36, height:36, borderRadius:18, background:'rgba(251,191,36,0.15)', color:'#D97706', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                    <IconCake size={18} />
                  </div>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{width:32, height:32, borderRadius:16, objectFit:'cover'}} />
                    : <div style={{width:32, height:32, borderRadius:16, background:avatarColor(u.id), color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 'var(--fs-label)', fontWeight:600}}>{u.display_name?.[0]?.toUpperCase()}</div>}
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.display_name}</div>
                    <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)'}}>{ageOn} лет</div>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}
