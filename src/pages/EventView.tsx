import { useEffect, useRef, useState } from 'react';
import { goBack } from '@/lib/nav';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useEventsStore, type SigEvent, type RsvpStatus, type EventMember } from '@/stores/eventsStore';
import { avatarColor } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';
import { useChatStore } from '@/stores/chatStore';
import type { User } from '@/types';
import EventGallery from '@/components/EventGallery';
import { Skeleton } from '@/components/Skeleton';
import EventChecklist from '@/components/EventChecklist';
import EventSchedule from '@/components/EventSchedule';
import EventWishlist from '@/components/EventWishlist';
import EventInlineMap from '@/components/EventInlineMap';
import EventPackingList from '@/components/EventPackingList';
import EventShoppingList from '@/components/EventShoppingList';
import EventTransport from '@/components/EventTransport';
import EventPlaces from '@/components/EventPlaces';
import EventWeather from '@/components/EventWeather';
import EventTimezone from '@/components/EventTimezone';
import EventDiary from '@/components/EventDiary';
import EventCountdown from '@/components/EventCountdown';
import EventBlocksManager from '@/components/EventBlocksManager';
import { BlockCollapseCtx } from '@/components/event-blocks/BlockShell';
import NotesBlock from '@/components/event-blocks/NotesBlock';
import LinksBlock from '@/components/event-blocks/LinksBlock';
import ContactsBlock from '@/components/event-blocks/ContactsBlock';
import BringingBlock from '@/components/event-blocks/BringingBlock';
import EventFlights from '@/components/event-blocks/EventFlights';
import ActivitiesBlock from '@/components/event-blocks/ActivitiesBlock';
import PollBlock from '@/components/event-blocks/PollBlock';
import SplitBillBlock from '@/components/event-blocks/SplitBillBlock';
import HousingBlock from '@/components/event-blocks/HousingBlock';
import CarsBlock from '@/components/event-blocks/CarsBlock';
import WeatherHourlyBlock from '@/components/event-blocks/WeatherHourlyBlock';
import CheckinBlock from '@/components/event-blocks/CheckinBlock';
import RoadmapBlock from '@/components/event-blocks/RoadmapBlock';
import MoviesBlock from '@/components/event-blocks/MoviesBlock';
import PersonalProgramBlock from '@/components/event-blocks/PersonalProgramBlock';
import SurveyBlock from '@/components/event-blocks/SurveyBlock';
import EmergencyBlock from '@/components/event-blocks/EmergencyBlock';
import RouteCheckinBlock from '@/components/event-blocks/RouteCheckinBlock';
import LostFoundBlock from '@/components/event-blocks/LostFoundBlock';
import SimInfoBlock from '@/components/event-blocks/SimInfoBlock';
import PreferencesBlock from '@/components/event-blocks/PreferencesBlock';
import ChallengesBlock from '@/components/event-blocks/ChallengesBlock';
import AlarmBlock from '@/components/event-blocks/AlarmBlock';
import MomentsBlock from '@/components/event-blocks/MomentsBlock';
import { downloadIcs } from '@/lib/ics';
import {
  IconCalendar, IconMapPin, IconClock, IconUser, IconCheck, IconX, IconHelp,
  IconWallet, IconShirt, IconCake, IconPartyPopper, IconPlane,
  IconPin, IconNavigation, IconMessageSquare, IconPlus, IconMusic, IconChevronRight,
  IconMap, IconChevronLeft, IconMoreHorizontal,
} from '@/components/icons/EventIcons';

const TYPE_META = {
  party: { gradient: 'var(--surface-light)', label: 'Туса', Icon: IconPartyPopper },
  trip:  { gradient: 'var(--surface-light)', label: 'Поездка', Icon: IconPlane },
};

const RSVP_META = {
  going:     { label: 'Иду',       color: '#10B981', Icon: IconCheck },
  maybe:     { label: 'Возможно',  color: '#FBBF24', Icon: IconHelp },
  not_going: { label: 'Не иду',    color: '#EF4444', Icon: IconX },
};

export default function EventView() {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const fromMap = searchParams.get('from') === 'map';
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const {
    events, membersByEvent,
    loadEvents, loadEventMembers, setMyRsvp, removeMyMembership, cancelEvent,
  } = useEventsStore();

  const fromStore = id ? events[id] : undefined;
  const [event, setEvent] = useState<SigEvent | null>(fromStore || null);
  const [loading, setLoading] = useState(!fromStore);
  const [showMenu, setShowMenu] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showBlocksManager, setShowBlocksManager] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [localExpandedOverride, setLocalExpandedOverride] = useState<string[] | null>(null);
  // Локально храним обновлённый enabled_blocks после save в manager,
  // чтобы UI обновился без полного refetch
  const [localBlocksOverride, setLocalBlocksOverride] = useState<string[] | null>(null);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [openingEventChat, setOpeningEventChat] = useState(false);
  const { inviteUsers, updateEvent } = useEventsStore();
  const fetchConversations = useChatStore(s => s.fetchConversations);

  // Если события нет в сторе — грузим напрямую
  useEffect(() => {
    if (!id || event) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('events')
        .select(`*, creator:users!events_creator_id_fkey (id, display_name, avatar_url)`)
        .eq('id', id)
        .single();
      if (data) setEvent(data as any);
      setLoading(false);
    })();
  }, [id]);

  // Sync с обновлениями стора
  useEffect(() => {
    if (fromStore) setEvent(fromStore);
  }, [fromStore?.title, fromStore?.start_at, fromStore?.status, fromStore?.myRsvp, fromStore?.goingCount]);

  // Грузим участников
  useEffect(() => {
    if (id) loadEventMembers(id);
  }, [id]);

  if (loading || !event) {
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
        <div className="page-header" style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="dt-hide" onClick={() => goBack(nav, '/calendar')} style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6,marginLeft:-6,fontSize: 'var(--fs-title)',lineHeight:1}}>‹</button>
          <h1 style={{fontSize: 'var(--fs-title)',textTransform:'none',letterSpacing:0}}>Событие</h1>
        </div>
        {loading ? (
          <div style={{flex:1, padding:16, display:'flex', flexDirection:'column', gap:14, overflow:'hidden'}}>
            <Skeleton width="100%" height={180} rounded={14} />
            <Skeleton width="70%" height={24} />
            <Skeleton width="45%" height={14} />
            <div style={{display:'flex',gap:10,marginTop:4}}><Skeleton width={90} height={36} rounded={10} /><Skeleton width={90} height={36} rounded={10} /></div>
            <Skeleton width="100%" height={60} rounded={12} style={{marginTop:6}} />
          </div>
        ) : (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'var(--muted)'}}>Не найдено</span>
          </div>
        )}
      </div>
    );
  }

  const meta = TYPE_META[event.type];
  const isCreator = myId === event.creator_id;
  const startDate = new Date(event.start_at);
  const endDate = event.end_at ? new Date(event.end_at) : null;
  const dateRangeLabel = endDate
    ? `${startDate.toLocaleDateString('ru', { day: 'numeric', month: 'long' })} — ${endDate.toLocaleDateString('ru', { day: 'numeric', month: 'long' })} · ${startDate.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
    : `${startDate.toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'long' })} · ${startDate.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
  const isCancelled = event.status === 'cancelled';
  const members = membersByEvent[event.id] || [];
  const membersForDisplay: EventMember[] = event.creator && !members.some(m => m.user_id === event.creator_id)
    ? [{
        event_id: event.id,
        user_id: event.creator_id,
        rsvp: 'going',
        invited_by: event.creator_id,
        joined_at: event.created_at,
        plus_ones: 0,
        user: event.creator,
      }, ...members]
    : members;
  const rawEnabledBlocks: string[] | null = localBlocksOverride
    ?? (event as any).enabled_blocks
    ?? null;
  const enabledBlocks: string[] = (rawEnabledBlocks && rawEnabledBlocks.length > 0)
    ? rawEnabledBlocks
    : (event.type === 'trip'
      ? ['gallery', 'moments', 'checklist', 'schedule', 'transport', 'flight', 'places', 'shopping', 'packing', 'diary']
      : ['gallery', 'moments', 'checklist', 'schedule']
    ).concat((event.is_birthday || isCreator) ? ['wishlist'] : []);
  const canEditEventBlocks = event.myRsvp === 'going' || event.myRsvp === 'maybe' || isCreator;

  const goingMembers = membersForDisplay.filter(m => m.rsvp === 'going');
  const maybeMembers = membersForDisplay.filter(m => m.rsvp === 'maybe');
  const notGoingMembers = membersForDisplay.filter(m => m.rsvp === 'not_going');
  const noRsvpMembers = membersForDisplay.filter(m => !m.rsvp);

  const handleRsvp = async (rsvp: RsvpStatus) => {
    if (!myId) return;
    await setMyRsvp(event.id, myId, rsvp);
    if (id) loadEventMembers(id);
  };

  const handleLeave = async () => {
    if (!myId) return;
    if (!confirm('Покинуть событие? Создатель увидит что вы вышли.')) return;
    await removeMyMembership(event.id, myId);
    if (id) loadEventMembers(id);
  };

  const openEventChat = async () => {
    if (!myId || openingEventChat) return;
    setOpeningEventChat(true);
    haptic.tap();
    try {
      const { data, error } = await supabase.rpc('join_event_chat', {
        event_id_param: event.id,
        target_user_id_param: null,
      });
      if (error) throw error;
      const conversationId = (data as any)?.conversation_id || event.conversation_id;
      if (!conversationId) throw new Error('Чат события не удалось создать');

      setEvent(prev => prev ? { ...prev, conversation_id: conversationId } : prev);
      // Запускаем обновление списка чатов до перехода. Не держим кнопку бесконечно,
      // если список большой — RPC уже гарантировал, что доступ к конкретному чату есть.
      const refresh = fetchConversations(myId).catch(() => undefined);
      await Promise.race([refresh, new Promise(resolve => window.setTimeout(resolve, 1200))]);
      nav('/chat/' + conversationId);
    } catch (err: any) {
      console.error('openEventChat:', err);
      toast.error(err?.message ? `Не удалось открыть чат: ${err.message}` : 'Не удалось открыть чат события');
    } finally {
      setOpeningEventChat(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Отменить событие? Все участники увидят что оно отменено.')) return;
    await cancelEvent(event.id);
    setShowMenu(false);
  };

  return (
    <div className={`ev-view-in ${editMode ? 'event-edit-mode' : 'event-view-mode'}`} style={{display:'flex',flexDirection:'column',height:'100%',position:'relative'}}>
      {/* Floating back + menu — поверх скроллящегося контента */}
      <div style={{
        position:'absolute',
        top:'max(8px, env(safe-area-inset-top, 8px))',
        left:8, right:8,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        zIndex: 5,
        pointerEvents: 'none',
      }}>
        <button className="dt-hide" onClick={() => goBack(nav, '/calendar')} style={{
          width:38, height:38, borderRadius:19,
          background:'rgba(0,0,0,0.5)', backdropFilter:'blur(10px)',
          WebkitBackdropFilter:'blur(10px)',
          border:'none', color:'#fff', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          pointerEvents: 'auto',
        }}>
          <IconChevronLeft size={20} strokeWidth={2.4} />
        </button>
        {!isCancelled && (
          <div style={{ display:'flex', alignItems:'center', gap:8, pointerEvents:'auto' }}>
            {canEditEventBlocks && (
              <button
                onClick={() => { haptic.tap(); setEditMode(v => !v); setShowMenu(false); }}
                aria-label={editMode ? 'Завершить редактирование' : 'Редактировать блоки события'}
                title={editMode ? 'Готово' : 'Редактор'}
                style={{
                  width:38, height:38, borderRadius:19,
                  background: editMode ? '#fff' : 'rgba(0,0,0,0.5)',
                  backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
                  border: editMode ? '1px solid rgba(0,0,0,.08)' : 'none',
                  color: editMode ? '#111827' : '#fff', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow: editMode ? '0 8px 24px rgba(0,0,0,.18)' : 'none',
                }}
              >
                {editMode ? (
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                )}
              </button>
            )}
            {editMode && isCreator && (
              <button onClick={() => setShowMenu(true)} aria-label="Настройки события" style={{
                width:38, height:38, borderRadius:19,
                background:'rgba(0,0,0,0.5)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
                border:'none', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <IconMoreHorizontal size={20} strokeWidth={2.4} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="page-scroll" onScroll={(e) => setScrollY((e.target as HTMLElement).scrollTop)}>
        {fromMap ? (
          /* Герой в стиле America Trip — всё по центру поверх обложки (только при входе с карты) */
          <div className={!event.cover_url ? 'ev-hero-grad' : undefined} style={{
            position:'relative', width:'100%', height:360,
            background: event.cover_url ? 'var(--surface-2)' : 'var(--surface-light)' ,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden',
          }}>
            {event.cover_url && (
              <img src={event.cover_url} alt="" onLoad={() => setCoverLoaded(true)} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',
                transform:`translateY(${Math.min(scrollY,500)*0.3}px) scale(1.1)`,
                filter: coverLoaded ? 'none' : 'blur(18px)', transition:'filter .45s ease', willChange:'transform'}} />
            )}
            {!event.cover_url && <meta.Icon size={88} color="#fff" strokeWidth={1.4} style={{ opacity: 0.85 }} />}
            <div style={{position:'absolute', inset:0, pointerEvents:'none', background:'rgba(0,0,0,.16)' }} />
            {isCancelled && (
              <div style={{ position:'absolute', top:'max(58px, calc(env(safe-area-inset-top, 8px) + 50px))', left:16, padding:'4px 10px', background:'rgba(239,68,68,0.9)', color:'#fff', fontSize:'var(--fs-micro)', fontWeight:700, borderRadius:10, letterSpacing:0.3 }}>ОТМЕНЕНО</div>
            )}
            <div style={{position:'absolute', left:0, right:0, bottom:22, padding:'0 20px', textAlign:'center', color:'#fff'}}>
              <div style={{display:'inline-flex', alignItems:'center', gap:5, fontSize:'var(--fs-micro)', fontWeight:700, letterSpacing:0.5, textTransform:'uppercase', padding:'4px 10px', borderRadius:999, background:'rgba(255,255,255,0.2)', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)', marginBottom:10}}>
                <meta.Icon size={12} strokeWidth={2.2} color="#fff" /> {meta.label}
              </div>
              <h1 style={{fontSize:'var(--fs-display)', fontWeight:800, letterSpacing:-0.5, lineHeight:1.1, margin:0, textShadow:'0 2px 16px rgba(0,0,0,0.5)'}}>{event.title}</h1>
              {goingMembers.length > 0 && (
                <div style={{display:'flex', justifyContent:'center', marginTop:12}}>
                  {goingMembers.slice(0, 5).map((m, i) => (
                    <div key={m.user_id} style={{marginLeft: i ? -10 : 0}}>
                      {m.user?.avatar_url
                        ? <img src={m.user.avatar_url} alt="" style={{width:34,height:34,borderRadius:17,objectFit:'cover',boxShadow:'0 0 0 2px rgba(255,255,255,0.85)'}} />
                        : <div style={{width:34,height:34,borderRadius:17,background:avatarColor(m.user_id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'var(--fs-label)',fontWeight:700,boxShadow:'0 0 0 2px rgba(255,255,255,0.85)'}}>{(m.user?.display_name || '?')[0].toUpperCase()}</div>}
                    </div>
                  ))}
                  {goingMembers.length > 5 && <div style={{marginLeft:-10, width:34,height:34,borderRadius:17,background:'rgba(255,255,255,0.28)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'var(--fs-micro)',fontWeight:700,boxShadow:'0 0 0 2px rgba(255,255,255,0.85)'}}>+{goingMembers.length - 5}</div>}
                </div>
              )}
              <div style={{display:'flex', justifyContent:'center', flexWrap:'wrap', gap:'4px 16px', marginTop:14, fontSize:'var(--fs-label)', fontWeight:600, textShadow:'0 1px 8px rgba(0,0,0,0.55)'}}>
                {event.location_name && <span style={{display:'inline-flex',alignItems:'center',gap:5}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{event.location_name}</span>}
                <span style={{display:'inline-flex',alignItems:'center',gap:5}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>{dateRangeLabel}</span>
              </div>
            </div>
          </div>
        ) : (
        /* Cover — обложка с заголовком/метой поверх снизу (дизайн Claude Design) */
        <div className={!event.cover_url ? 'ev-hero-grad' : undefined} style={{
          position:'relative',
          width:'100%',
          height:330,
          background: event.cover_url ? 'var(--surface-2)' : 'var(--surface-light)' ,
          flexShrink:0,
          overflow:'hidden',
          borderRadius:'0 0 28px 28px',
        }}>
          {event.cover_url && (
            <img src={event.cover_url} alt="" onLoad={() => setCoverLoaded(true)} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',
              transform:`translateY(${Math.min(scrollY,500)*0.3}px) scale(1.1)`,
              filter: coverLoaded ? 'none' : 'blur(18px)',
              transition:'filter .45s ease', willChange:'transform'}} />
          )}
          {!event.cover_url && (
            <>
              <div style={{position:'absolute', inset:0, background:'var(--surface-light)'}} />
              <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center'}}><meta.Icon size={92} color="rgba(255,255,255,0.85)" strokeWidth={1.4} /></div>
            </>
          )}

          {/* Затемнение по макету: под кнопки сверху и под текст снизу */}
          <div style={{position:'absolute', inset:0, pointerEvents:'none',
            background:'rgba(0,0,0,.16)' }} />

          {isCancelled && (
            <div style={{
              position:'absolute', top:'max(58px, calc(env(safe-area-inset-top, 8px) + 50px))', left:16,
              padding:'4px 10px',
              background:'rgba(239,68,68,0.9)',
              color:'#fff', fontSize: 'var(--fs-micro)', fontWeight:700,
              borderRadius:10, letterSpacing:0.3,
            }}>ОТМЕНЕНО</div>
          )}

          {/* Заголовок + мета поверх обложки снизу-слева */}
          <div style={{position:'absolute', left:20, right:20, bottom:22, display:'flex', flexDirection:'column', gap:11}}>
            <div style={{alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:999, background:'rgba(10,10,12,0.42)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)'}}>
              <meta.Icon size={12} strokeWidth={2.2} color="#fff" />
              <span style={{fontSize:'var(--fs-caption)', fontWeight:600, color:'#fff', letterSpacing:0.2}}>{meta.label}</span>
            </div>
            <h1 style={{fontSize:'var(--fs-display)', fontWeight:700, letterSpacing:-0.5, lineHeight:1.08, margin:0, color:'#fff', textShadow:'0 2px 16px rgba(0,0,0,0.5)'}}>{event.title}</h1>
            <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontSize:'var(--fs-label)', color:'rgba(255,255,255,0.88)', fontWeight:500, textShadow:'0 1px 8px rgba(0,0,0,0.5)'}}>
              <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>
                {dateRangeLabel}
              </span>
              {event.location_name && <><span style={{opacity:0.5}}>·</span>
                <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  {event.location_name}
                </span></>}
            </div>
          </div>
        </div>
        )}

        <div style={{padding: '6px 16px 32px', display:'flex', flexDirection:'column', gap:14}}>
          {editMode && (
            <div className="event-editor-banner" style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 12px', marginTop:2,
              borderRadius:14, background:'color-mix(in srgb, var(--accent) 8%, var(--surface-light))',
              border:'1px solid color-mix(in srgb, var(--accent) 18%, var(--border))', color:'var(--text)',
            }}>
              <span style={{ width:30, height:30, borderRadius:15, background:'var(--text)', color:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'var(--fs-snap14)', fontWeight:700 }}>Редактор события</div>
                <div style={{ fontSize:'var(--fs-micro)', color:'var(--muted)' }}>Кнопки добавления и изменения показаны только сейчас</div>
              </div>
              <button onClick={() => setEditMode(false)} style={{ background:'none', border:'none', color:'var(--text)', fontSize:'var(--fs-caption)', fontWeight:700, cursor:'pointer', padding:'6px 4px' }}>Готово</button>
            </div>
          )}

        {/* Ответ на событие — обычный модуль (раньше была прилипшая снизу панель) */}
        {!isCancelled && (
          <div style={{ display:'flex', gap:8 }}>
            {(Object.entries(RSVP_META) as Array<[RsvpStatus, typeof RSVP_META.going]>).map(([k, m]) => {
              const active = event.myRsvp === k;
              return (
                <button key={k} onClick={() => { haptic.select(); handleRsvp(k); }} style={{
                  flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                  height:47, borderRadius:14, cursor:'pointer', border:'none',
                  background: active ? 'var(--accent)' : 'var(--surface-light)',
                  color: active ? '#fff' : 'var(--text2)',
                  fontSize: 'var(--fs-label)', fontWeight: active ? 600 : 500,
                  boxShadow: active ? '0 10px 22px -10px var(--accent)' : 'none',
                  transition:'background .2s',
                }}>
                  {active && k === 'going' && (
                    <span key="on" className="ev-rsvp-pop" style={{display:'flex'}}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4 10-11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  )}
                  {m.label}
                </button>
              );
            })}
          </div>
        )}
        {/* Countdown — за 24 часа до начала */}
        <EventCountdown startAt={event.start_at} status={event.status} />

        {/* Галерея — один из первых блоков события, сразу после основной информации. */}
        {enabledBlocks.includes('gallery') && (
          <div className="ev-gallery-primary">
            <EventGallery eventId={event.id} canUpload={editMode && canEditEventBlocks} />
          </div>
        )}

        {/* Inline-карта если есть координаты */}
        {typeof event.location_lat === 'number' && typeof event.location_lng === 'number' && (
          <EventInlineMap
            lat={event.location_lat}
            lng={event.location_lng}
            locationName={event.location_name}
          />
        )}

        {/* Местное время / разница часов — только для поездок с координатами */}
        {event.type === 'trip' && typeof event.location_lat === 'number' && typeof event.location_lng === 'number' && (
          <EventTimezone
            lat={event.location_lat}
            lng={event.location_lng}
            locationName={event.location_name}
          />
        )}

        {/* Прогноз погоды — для поездок с координатами */}
        {event.type === 'trip' && typeof event.location_lat === 'number' && typeof event.location_lng === 'number' && (
          <EventWeather
            lat={event.location_lat}
            lng={event.location_lng}
            startAt={event.start_at}
            endAt={event.end_at}
          />
        )}

        {event.creator && (
          <InfoRow icon={<IconUser size={18} />} label={`Организатор: ${event.creator.display_name}${isCreator ? ' (вы)' : ''}`} />
        )}

        {event.budget_per_person && (
          <InfoRow icon={<IconWallet size={18} />} label={`~${event.budget_per_person.toLocaleString()} ${event.budget_currency || '₽'} с человека`} />
        )}

        {event.dress_code && (
          <InfoRow icon={<IconShirt size={18} />} label={`Дресс-код: ${event.dress_code}`} />
        )}

        {event.is_birthday && (
          <InfoRow icon={<IconCake size={18} />} label="День Рождения" />
        )}

        {/* Заметка от организатора — pinned карточка */}
        {event.organizer_notes && (
          <div style={{
            margin:'14px 0',padding:'12px 14px',
            background:'rgba(251, 191, 36, 0.12)',
            border:'1px solid rgba(251, 191, 36, 0.35)',
            borderRadius:12,fontSize: 'var(--fs-label)',color:'var(--text)',
            lineHeight:1.45,whiteSpace:'pre-wrap',
            display:'flex',gap:10,
          }}>
            <div style={{flexShrink:0, color:'rgba(251, 191, 36, 1)'}}>
              <IconPin size={20} />
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize: 'var(--fs-micro)',fontWeight:600,color:'rgba(251, 191, 36, 1)',marginBottom:3,letterSpacing:0.3,textTransform:'uppercase'}}>
                От организатора
              </div>
              {event.organizer_notes}
            </div>
          </div>
        )}

        {/* Точка сбора (для поездок) */}
        {event.meeting_point && (
          <div style={{
            margin:'8px 0 14px',padding:'12px 14px',
            background:'var(--surface-light)',borderRadius:12,
            display:'flex',gap:12,
          }}>
            <div style={{flexShrink:0, color:'var(--accent)'}}>
              <IconNavigation size={20} />
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize: 'var(--fs-micro)',fontWeight:600,color:'var(--muted)',marginBottom:3,letterSpacing:0.3,textTransform:'uppercase'}}>
                Точка сбора
              </div>
              <div style={{fontSize: 'var(--fs-snap14)',color:'var(--text)'}}>{event.meeting_point}</div>
              {event.meeting_at && (
                <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',marginTop:3,display:'inline-flex',alignItems:'center',gap:4}}>
                  <IconClock size={12} />
                  {new Date(event.meeting_at).toLocaleString('ru', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                </div>
              )}
            </div>
          </div>
        )}

        {event.description && (
          <div style={{ display:'flex', flexDirection:'column', gap:9, margin:'14px 0' }}>
            <h3 style={{ margin:0, fontSize:'var(--fs-heading)', fontWeight:700, color:'var(--text)', letterSpacing:'-0.2px' }}>Описание</h3>
            <p style={{ margin:0, fontSize:'var(--fs-snap14)', lineHeight:1.55, color:'var(--text2)', whiteSpace:'pre-wrap' }}>{event.description}</p>
          </div>
        )}

        {/* Доп. опции ответа (сам ответ «Иду/Возможно/Не иду» — в нижней прилипшей панели) */}
        {!isCancelled && (
          <>
            {event.myRsvp && !isCreator && (
              <button
                onClick={handleLeave}
                style={{
                  width:'100%', padding:'10px',
                  background:'transparent', color:'var(--muted)',
                  border:'1px solid var(--border)', borderRadius:10,
                  fontSize: 'var(--fs-caption)', cursor:'pointer', marginBottom:14,
                }}
              >Выйти из события</button>
            )}

            {/* Plus ones — если разрешено и юзер идёт */}
            {event.plus_ones_limit > 0 && event.myRsvp === 'going' && (
              <PlusOnesBlock
                eventId={event.id}
                myId={myId!}
                limit={event.plus_ones_limit}
                current={members.find(m => m.user_id === myId)?.plus_ones || 0}
                onChange={() => loadEventMembers(event.id)}
              />
            )}
          </>
        )}

        {/* Участники — компактный ряд (дизайн Claude Design) */}
        <div style={{ display:'flex', flexDirection:'column', gap:14, margin:'6px 0' }}>
          <h3 style={{ margin:0, fontSize:'var(--fs-heading)', fontWeight:700, color:'var(--text)', letterSpacing:'-0.2px' }}>
            Участники <span style={{ color:'var(--muted)', fontWeight:500 }}>{membersForDisplay.length}</span>
          </h3>
          <div style={{ display:'flex', gap:16, overflowX:'auto', paddingBottom:4 }}>
            {[...goingMembers, ...maybeMembers, ...notGoingMembers, ...noRsvpMembers].slice(0, 15).map(m => {
              const dot = m.rsvp === 'going' ? '#35C775' : m.rsvp === 'maybe' ? '#F5A623' : m.rsvp === 'not_going' ? '#EF5350' : null;
              return (
                <button key={m.user_id} onClick={() => nav('/u/' + m.user_id)} style={{ flexShrink:0, background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:7, width:56 }}>
                  <div style={{ position:'relative' }}>
                    {m.user?.avatar_url
                      ? <img src={m.user.avatar_url} alt="" style={{ width:48, height:48, borderRadius:24, objectFit:'cover' }} />
                      : <div style={{ width:48, height:48, borderRadius:24, background:avatarColor(m.user_id), color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'var(--fs-body)', fontWeight:600 }}>{(m.user?.display_name || '?')[0].toUpperCase()}</div>}
                    {dot && <span style={{ position:'absolute', bottom:0, right:0, width:13, height:13, borderRadius:7, background:dot, border:'2.5px solid var(--bg)' }} />}
                  </div>
                  <span style={{ fontSize:'var(--fs-micro)', color:'var(--text2)', maxWidth:56, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.user?.display_name?.split(' ')[0] || '...'}</span>
                </button>
              );
            })}
            {editMode && isCreator && (
              <button onClick={() => setShowInvite(true)} style={{ flexShrink:0, background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:7, width:56 }}>
                <div style={{ width:48, height:48, borderRadius:24, border:'1.5px dashed var(--border)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text2)' }}><IconPlus size={20} /></div>
                <span style={{ fontSize:'var(--fs-micro)', color:'var(--text2)' }}>Позвать</span>
              </button>
            )}
          </div>
        </div>

        {/* Кнопки действий */}
        {!isCancelled && (
          <button
            onClick={openEventChat}
            disabled={openingEventChat}
            style={{
              width:'100%', height:52, marginTop:14, marginBottom:8,
              background:'var(--accent)', color:'var(--bg)', border:'none', borderRadius:16,
              fontSize:'var(--fs-body)', fontWeight:600, cursor:openingEventChat ? 'default' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:9,
              boxShadow:'0 12px 26px -10px var(--accent)',
              opacity: openingEventChat ? 0.72 : 1,
              transition:'opacity .2s ease, transform .2s ease',
            }}
          >
            {openingEventChat ? <span className="btn-spin-sm" aria-hidden="true" /> : <IconMessageSquare size={19} />}
            {openingEventChat ? 'Открываем чат…' : (event.conversation_id ? 'Открыть чат события' : 'Создать чат события')}
          </button>
        )}
        {false && !isCancelled && (
          <div style={{display:'grid', gridTemplateColumns: isCreator ? '1fr 1fr' : '1fr', gap:8, marginTop:14, marginBottom:8}}>
            {event?.conversation_id && (
              <button
                onClick={() => nav('/chat/' + event!.conversation_id)}
                style={{
                  padding:'12px',
                  background: 'var(--surface-light)',
                  color:'var(--text)',
                  border:'1px solid var(--border)', borderRadius:10,
                  fontSize: 'var(--fs-label)', fontWeight:600, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}
              >
                <IconMessageSquare size={16} /> Чат события
              </button>
            )}
            {isCreator && (
              <button
                onClick={() => setShowInvite(true)}
                style={{
                  padding:'12px',
                  background: 'var(--surface-light)',
                  color:'var(--text)',
                  border:'1px solid var(--border)', borderRadius:10,
                  fontSize: 'var(--fs-label)', fontWeight:600, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}
              >
                <IconPlus size={16} /> Пригласить
              </button>
            )}
          </div>
        )}

        {/* Кнопка управления блоками — только для creator */}
        {!isCancelled && editMode && isCreator && (
          <button
            onClick={() => setShowBlocksManager(true)}
            style={{
              display:'flex', alignItems:'center', gap:10,
              width:'100%', padding:'12px 14px',
              background:'var(--surface-light)',
              border:'1px solid var(--border)', borderRadius:14,
              cursor:'pointer', textAlign:'left',
              color:'var(--text)', marginTop:8,
            }}
          >
            <div style={{
              width:32, height:32, borderRadius:16,
              background:'rgba(120,120,130,0.15)', color:'var(--muted)', display:'flex',
              alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600}}>Управлять блоками</div>
              <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)'}}>Включить/выключить + порядок</div>
            </div>
            <IconChevronRight size={16} color="var(--muted)" />
          </button>
        )}

        {/* Расходы — кнопка-карточка */}
        <button
          onClick={() => nav(`/events/${event.id}/expenses`)}
          style={{
            display:'flex', alignItems:'center', gap:10,
            width:'100%', padding:'12px 14px',
            background:'var(--surface-light)',
            border:'1px solid var(--border)', borderRadius:14,
            cursor:'pointer', textAlign:'left',
            color:'var(--text)', marginTop:8,
          }}
        >
          <div style={{width:32, height:32, borderRadius:16, background:'rgba(20,184,166,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#14B8A6'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Чек со сложенным низом — расходы / split bill */}
              <path d="M5 3h14a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2-3-2-1 1V4a1 1 0 0 1 1-1z"/>
              <line x1="9" y1="8" x2="15" y2="8"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600}}>Расходы (split bill)</div>
            <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)'}}>Скиньтесь и поделите счёт</div>
          </div>
          <IconChevronRight size={16} color="var(--muted)" />
        </button>

        {/* Плейлист — карточка */}
        {event.spotify_playlist_id ? (
          <button
            onClick={() => nav(`/music/${event.spotify_playlist_id}`)}
            style={{
              display:'flex', alignItems:'center', gap:10,
              width:'100%', padding:'12px 14px',
              background:'var(--surface-light)',
              border:'1px solid var(--border)', borderRadius:14,
              cursor:'pointer', textAlign:'left',
              color:'var(--text)', marginTop:8,
            }}
          >
            <div style={{width:32, height:32, borderRadius:16, background:'rgba(29,185,84,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#1DB954'}}>
              <IconMusic size={18} />
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600}}>Плейлист</div>
              <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)'}}>Открыть совместный плейлист</div>
            </div>
            <IconChevronRight size={16} color="var(--muted)" />
          </button>
        ) : editMode && isCreator && (
          <button
            onClick={() => setShowPlaylistPicker(true)}
            style={{
              display:'flex', alignItems:'center', gap:10,
              width:'100%', padding:'12px 14px',
              background:'var(--surface-light)',
              border:'1px solid var(--border)', borderRadius:14,
              cursor:'pointer', textAlign:'left',
              color:'var(--text)', marginTop:8,
            }}
          >
            <div style={{width:32, height:32, borderRadius:16, background:'rgba(29,185,84,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#1DB954'}}>
              <IconMusic size={18} />
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600}}>Привязать плейлист</div>
              <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)'}}>Из ваших Spotify-плейлистов</div>
            </div>
            <IconChevronRight size={16} color="var(--muted)" />
          </button>
        )}

        {/* Маршрут — только для поездок */}
        {event.type === 'trip' && (
          <button
            onClick={() => nav(`/events/${event.id}/route`)}
            style={{
              display:'flex', alignItems:'center', gap:10,
              width:'100%', padding:'12px 14px',
              background:'var(--surface-light)',
              border:'1px solid var(--border)', borderRadius:14,
              cursor:'pointer', textAlign:'left',
              color:'var(--text)', marginTop:8,
            }}
          >
            <div style={{width:32, height:32, borderRadius:16, background:'rgba(37,99,235,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#2563EB'}}>
              <IconMap size={18} />
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600}}>Маршрут</div>
              <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)'}}>Точки на карте Mapbox</div>
            </div>
            <IconChevronRight size={16} color="var(--muted)" />
          </button>
        )}

        {/* Конструктор блоков: рендерим в порядке, заданном в enabled_blocks.
            Если enabled_blocks NULL (легаси) — собираем дефолтный список по типу события.
            Если creator поменял через EventBlocksManager — используем localBlocksOverride. */}
        <div className="ev-blocks">{(() => {
          // Галерея уже отрисована выше, чтобы фотографии были одним из первых блоков.
          const blocks: string[] = enabledBlocks.filter(bid => bid !== 'gallery');
          const canEdit = editMode && canEditEventBlocks;

          // Какие блоки развёрнуты по умолчанию (настройка события; дефолт — расписание)
          const expandedSet = new Set<string>(localExpandedOverride ?? (event as any).expanded_blocks ?? ['schedule']);

          // Возвращаем массив React-нод по порядку
          const rendered = blocks.map((bid) => {
            switch (bid) {
              case 'wishlist':
                if (!event.id || (!event.is_birthday && !isCreator)) return null;
                return <EventWishlist
                  key="wishlist"
                  eventId={event.id}
                  isCreator={isCreator}
                  canEdit={editMode && isCreator}
                  isBirthday={!!event.is_birthday}
                  currency={event.budget_currency || '₽'}
                />;
              case 'gallery':
                if (!event.id) return null;
                return <EventGallery
                  key="gallery"
                  eventId={event.id}
                  canUpload={canEdit}
                />;
              case 'checklist':
                if (!event.id) return null;
                return <EventChecklist
                  key="checklist"
                  eventId={event.id}
                  canEdit={canEdit}
                  members={members.filter(m => m.user).map(m => ({ user_id: m.user_id, user: m.user! }))}
                />;
              case 'schedule':
                if (!event.id) return null;
                return <EventSchedule
                  key="schedule"
                  eventId={event.id}
                  canEdit={editMode && isCreator}
                  startAt={event.start_at}
                  endAt={event.end_at}
                />;
              case 'transport':
                if (!event.id) return null;
                return <EventTransport key="transport" eventId={event.id} canEdit={canEdit} />;
              case 'flight':
                if (!event.id) return null;
                return <EventFlights
                  key="flight"
                  eventId={event.id}
                  canEdit={canEdit}
                  members={members.filter(m => m.user).map(m => ({ user_id: m.user_id, user: m.user! }))}
                />;
              case 'places':
                if (!event.id) return null;
                return <EventPlaces key="places" eventId={event.id} canEdit={canEdit} />;
              case 'shopping':
                if (!event.id) return null;
                return <EventShoppingList key="shopping" eventId={event.id} canEdit={canEdit} />;
              case 'packing':
                if (!event.id) return null;
                return <EventPackingList key="packing" eventId={event.id} canEdit={canEdit} />;
              case 'diary':
                if (!event.id) return null;
                return <EventDiary
                  key="diary"
                  eventId={event.id}
                  canEdit={canEdit}
                  startAt={event.start_at}
                />;
              case 'notes':
                if (!event.id) return null;
                return <NotesBlock key="notes" eventId={event.id} canEdit={editMode && isCreator} />;
              case 'links':
                if (!event.id) return null;
                return <LinksBlock key="links" eventId={event.id} canEdit={canEdit} />;
              case 'contacts':
                if (!event.id) return null;
                return <ContactsBlock key="contacts" eventId={event.id} canEdit={canEdit} />;
              case 'bringing':
                if (!event.id) return null;
                return <BringingBlock key="bringing" eventId={event.id} canEdit={canEdit} />;
              case 'activities':
                if (!event.id) return null;
                return <ActivitiesBlock key="activities" eventId={event.id} canEdit={canEdit} />;
              case 'poll':
                if (!event.id) return null;
                return <PollBlock key="poll" eventId={event.id} canEdit={canEdit} />;
              case 'splitbill':
                if (!event.id) return null;
                return <SplitBillBlock key="splitbill" eventId={event.id} canEdit={canEdit} currency={event.budget_currency || '₽'} />;
              case 'housing':
                if (!event.id) return null;
                return <HousingBlock key="housing" eventId={event.id} canEdit={canEdit} />;
              case 'cars':
                if (!event.id) return null;
                return <CarsBlock key="cars" eventId={event.id} canEdit={canEdit} />;
              case 'weather_hourly':
                if (!event.id) return null;
                return <WeatherHourlyBlock key="weather_hourly" eventId={event.id} lat={event.location_lat} lng={event.location_lng} startAt={event.start_at} />;
              case 'checkin':
                if (!event.id) return null;
                return <CheckinBlock key="checkin" eventId={event.id} canEdit={editMode && isCreator} />;
              case 'roadmap':
                if (!event.id) return null;
                return <RoadmapBlock key="roadmap" eventId={event.id} canEdit={canEdit} />;
              case 'movies':
                if (!event.id) return null;
                return <MoviesBlock key="movies" eventId={event.id} canEdit={canEdit} />;
              case 'personal_program':
                if (!event.id) return null;
                return <PersonalProgramBlock key="personal_program" eventId={event.id} canEdit={editMode && isCreator} />;
              case 'survey':
                if (!event.id) return null;
                return <SurveyBlock key="survey" eventId={event.id} canEdit={editMode && isCreator} />;
              case 'emergency':
                if (!event.id) return null;
                return <EmergencyBlock key="emergency" eventId={event.id} canEdit={canEdit} />;
              case 'route_checkin':
                if (!event.id) return null;
                return <RouteCheckinBlock key="route_checkin" eventId={event.id} canEdit={canEdit} />;
              case 'lost_found':
                if (!event.id) return null;
                return <LostFoundBlock key="lost_found" eventId={event.id} canEdit={canEdit} />;
              case 'sim_info':
                if (!event.id) return null;
                return <SimInfoBlock key="sim_info" eventId={event.id} canEdit={canEdit} />;
              case 'preferences':
                if (!event.id) return null;
                return <PreferencesBlock key="preferences" eventId={event.id} canEdit={canEdit} />;
              case 'challenges':
                if (!event.id) return null;
                return <ChallengesBlock key="challenges" eventId={event.id} canEdit={canEdit} />;
              case 'alarm':
                return <AlarmBlock key="alarm" eventId={event.id} canEdit={canEdit} eventTitle={event.title} memberIds={goingMembers.map(m => m.user_id)} />;
              case 'moments':
                if (!event.id) return null;
                return <MomentsBlock key="moments" eventId={event.id} />;
              default:
                return null;
            }
          });
          return rendered.map((node, i) => node
            ? <BlockCollapseCtx.Provider key={blocks[i]} value={{ collapsed: !expandedSet.has(blocks[i]) }}>{node}</BlockCollapseCtx.Provider>
            : null);
        })()}</div>

        {/* Кнопка экспорта в календарь */}
        <button
          onClick={() => downloadIcs({
            uid: event.id,
            title: event.title,
            description: event.description || undefined,
            location: event.location_name || undefined,
            start: event.start_at,
            end: event.end_at,
            isParty: event.type === 'party',
          })}
          style={{
            display:'flex', alignItems:'center', gap:12,
            width:'100%', padding:'12px',
            background:'var(--surface-light)',
            border:'1px solid var(--border)', borderRadius:12,
            cursor:'pointer', textAlign:'left',
            color:'var(--text)', marginTop:14,
          }}
        >
          <div style={{width:36, height:36, borderRadius:18, background:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'var(--text)'}}>
            <IconCalendar size={20} />
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600}}>Добавить в календарь</div>
            <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)'}}>Apple / Google Calendar (.ics)</div>
          </div>
          <IconChevronRight size={16} color="var(--muted)" />
        </button>
      </div>
      </div>

      {showMenu && (
        <div onClick={() => setShowMenu(false)} style={{
          position:'fixed', inset:0, zIndex:60,
          background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width:'100%',
            background:'var(--surface)',
            borderRadius:'16px 16px 0 0',
            padding:'12px 0 max(20px, env(safe-area-inset-bottom, 20px))',
          }}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
              <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
            </div>

            {isCreator && <button onClick={() => { setShowMenu(false); nav('/events/' + event.id + '/edit'); }} style={menuBtnStyle()}>
              Основные настройки события
            </button>}
            {isCreator && (
              <button onClick={handleCancel} style={menuBtnStyle(true)}>
                Отменить событие
              </button>
            )}

            <div style={{padding:'8px 16px 0'}}>
              <button onClick={() => setShowMenu(false)} style={{width:'100%',padding:'12px',background:'var(--surface-light)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)',fontSize: 'var(--fs-snap14)',fontWeight:500,cursor:'pointer'}}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
      {showInvite && myId && id && (
        <InviteSheet
          eventId={id}
          myId={myId}
          existingUserIds={membersForDisplay.map(m => m.user_id)}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            loadEventMembers(id);
          }}
        />
      )}

      {showBlocksManager && id && (
        <EventBlocksManager
          eventId={id}
          initialBlocks={localBlocksOverride ?? (event as any).enabled_blocks ?? null}
          initialExpanded={localExpandedOverride ?? (event as any).expanded_blocks ?? ['schedule']}
          onClose={() => setShowBlocksManager(false)}
          onSaved={(blocks, expanded) => { setLocalBlocksOverride(blocks); setLocalExpandedOverride(expanded); }}
        />
      )}

      {showPlaylistPicker && id && myId && (
        <PlaylistPickerSheet
          myId={myId}
          onClose={() => setShowPlaylistPicker(false)}
          onPick={async (playlistId) => {
            await updateEvent(id, { spotify_playlist_id: playlistId });
            setShowPlaylistPicker(false);
          }}
          onCreateNew={() => {
            setShowPlaylistPicker(false);
            // После создания плейлиста юзер сможет вернуться и привязать его
            nav('/music/new');
          }}
        />
      )}
    </div>
  );
}

const menuBtnStyle = (danger = false): React.CSSProperties => ({
  width:'100%', padding:'14px 16px',
  background:'none', border:'none',
  borderBottom:'1px solid var(--border)',
  textAlign:'left',
  color: danger ? '#EF4444' : 'var(--text)',
  fontSize: 'var(--fs-body)', cursor:'pointer',
});

function InfoRow({ icon, label }: { icon: React.ReactNode; label: React.ReactNode }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      fontSize: 'var(--fs-snap14)', color:'var(--text)',
      padding:'12px 14px',
      background:'var(--surface-light)',
      border:'1px solid var(--border)',
      borderRadius:12,
      marginBottom:8,
    }}>
      <span style={{
        color:'var(--accent)',
        width:34, height:34, borderRadius:17,
        background:'rgba(99,102,241,0.12)',
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }}>{icon}</span>
      <span style={{flex:1, lineHeight:1.35}}>{label}</span>
    </div>
  );
}

function MembersGroup({ label, color, members, onProfile }: {
  label: string;
  color: string;
  members: any[];
  onProfile: (userId: string) => void;
}) {
  return (
    <div style={{marginBottom:14}}>
      <div key={members.length} className="ev-count-pulse" style={{
        fontSize: 'var(--fs-micro)', color: color,
        fontWeight:600, padding:'4px 4px 6px',
        textTransform:'uppercase', letterSpacing:0.4,
      }}>{label}</div>
      {members.map(m => (
        <button
          key={m.user_id}
          onClick={() => onProfile(m.user_id)}
          className="event-member-slide-in"
          style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'8px 8px',
            width:'100%', background:'none', border:'none',
            cursor:'pointer', borderRadius:8,
            textAlign:'left', color:'var(--text)',
          }}
        >
          {m.user?.avatar_url
            ? <img src={m.user.avatar_url} alt="" style={{width:32,height:32,borderRadius:16,objectFit:'cover'}} />
            : <div style={{width:32,height:32,borderRadius:16,background:avatarColor(m.user_id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-label)',fontWeight:600}}>{(m.user?.display_name || '?')[0]?.toUpperCase()}</div>}
          <span style={{flex:1, fontSize: 'var(--fs-snap14)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {m.user?.display_name || 'Пользователь'}
          </span>
          {m.plus_ones > 0 && (
            <span className="plus-ones-pop" key={`po-${m.plus_ones}`} style={{
              fontSize: 'var(--fs-micro)',fontWeight:600,
              padding:'2px 7px',borderRadius:10,
              background:'var(--surface-light)',color:'var(--muted)',
              display:'inline-block',
            }}>+{m.plus_ones}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function InviteSheet({ eventId, myId, existingUserIds, onClose, onInvited }: {
  eventId: string;
  myId: string;
  existingUserIds: string[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const { inviteUsers } = useEventsStore();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Грузим всех юзеров (для 50 человек норм)
  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url, bio, status, last_seen, created_at')
        .neq('id', myId)
        .order('display_name', { ascending: true });
      setUsers((data || []) as any);
      setLoading(false);
    })();
  }, [myId]);

  const filtered = users.filter(u => {
    if (existingUserIds.includes(u.id)) return false;
    if (query.length === 0) return true;
    const q = query.toLowerCase();
    return u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const toggle = (uid: string) => {
    const next = new Set(selected);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setSelected(next);
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    const { error } = await inviteUsers(eventId, myId, Array.from(selected));
    setSubmitting(false);
    if (error) {
      setError(error);
    } else {
      onInvited();
    }
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:60,
      background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',
        height:'80%',
        background:'var(--surface)',
        borderRadius:'16px 16px 0 0',
        padding:'12px 16px max(20px, env(safe-area-inset-bottom, 20px))',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        <h3 style={{fontSize: 'var(--fs-heading)', fontWeight:600, margin:'0 0 4px', color:'var(--text)'}}>
          Пригласить участников
        </h3>
        <p style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', margin:'0 0 12px'}}>
          Выбраны: <b style={{color:'var(--text)'}}>{selected.size}</b>
        </p>

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Поиск по имени или email"
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:10}}
        />

        <div style={{flex:1, overflowY:'auto', marginBottom:10}}>
          {loading && <div style={{padding:16, textAlign:'center', color:'var(--muted)', fontSize: 'var(--fs-label)'}}>Загрузка...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{padding:16, textAlign:'center', color:'var(--muted)', fontSize: 'var(--fs-label)'}}>
              {query.length > 0 ? 'Никого не найдено' : 'Все уже в списке'}
            </div>
          )}
          {filtered.map(u => {
            const checked = selected.has(u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggle(u.id)}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  width:'100%', padding:'10px 4px',
                  background:'none', border:'none',
                  cursor:'pointer', borderBottom:'1px solid var(--border)',
                  color:'var(--text)', textAlign:'left',
                }}
              >
                <div style={{
                  width:22, height:22, borderRadius:11,
                  border: checked ? 'none' : '2px solid var(--border)',
                  background: checked ? 'var(--primary)' : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0,
                }}>
                  {checked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>

                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" style={{width:34,height:34,borderRadius:17,objectFit:'cover'}} />
                  : <div style={{width:34,height:34,borderRadius:17,background:avatarColor(u.id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-label)',fontWeight:600}}>{u.display_name?.[0]?.toUpperCase()}</div>}

                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize: 'var(--fs-snap14)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.display_name}</div>
                  <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.email}</div>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{
            background:'rgba(239,68,68,0.1)', color:'#EF4444',
            padding:'10px 12px', borderRadius:8, fontSize: 'var(--fs-label)', marginBottom:10,
          }}>{error}</div>
        )}

        <div style={{display:'flex', gap:8}}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              flex:1, padding:'12px',
              background:'var(--surface-light)', border:'1px solid var(--border)',
              borderRadius:10, color:'var(--text)',
              fontSize: 'var(--fs-snap14)', fontWeight:500, cursor:'pointer',
            }}
          >Отмена</button>
          <button
            onClick={handleSubmit}
            disabled={selected.size === 0 || submitting}
            style={{
              flex:2, padding:'12px',
              background: selected.size > 0 ? 'var(--primary)' : 'var(--surface-light)',
              color: selected.size > 0 ? 'var(--bg)' : 'var(--muted)',
              border:'none', borderRadius:10,
              fontSize: 'var(--fs-snap14)', fontWeight:600,
              cursor: selected.size > 0 && !submitting ? 'pointer' : 'default',
            }}
          >{submitting ? 'Приглашаю...' : `Пригласить (${selected.size})`}</button>
        </div>
      </div>
    </div>
  );
}

function PlaylistPickerSheet({ myId, onClose, onPick, onCreateNew }: {
  myId: string;
  onClose: () => void;
  onPick: (playlistId: string) => void;
  onCreateNew: () => void;
}) {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('playlists')
        .select('id, title, description, category, cover_url')
        .eq('owner_id', myId)
        .eq('archived', false)
        .order('created_at', { ascending: false });
      setPlaylists(data || []);
      setLoading(false);
    })();
  }, [myId]);

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:65,
      background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',
        maxHeight:'80%',
        background:'var(--surface)',
        borderRadius:'16px 16px 0 0',
        padding:'12px 16px max(20px, env(safe-area-inset-bottom, 20px))',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        <h3 style={{fontSize: 'var(--fs-heading)', fontWeight:600, margin:'0 0 4px', color:'var(--text)'}}>Выберите плейлист</h3>
        <p style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', margin:'0 0 16px'}}>
          Привяжите свой Spotify-плейлист к событию
        </p>

        <div style={{flex:1, overflowY:'auto', marginBottom:12}}>
          {loading && <div style={{padding:16, textAlign:'center', color:'var(--muted)'}}>Загрузка...</div>}
          {!loading && playlists.length === 0 && (
            <div style={{padding:'20px 16px', textAlign:'center', color:'var(--muted)', fontSize: 'var(--fs-label)'}}>
              У вас ещё нет Spotify-плейлистов
            </div>
          )}
          {playlists.map(p => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              style={{
                display:'flex', alignItems:'center', gap:10,
                width:'100%', padding:'10px 8px',
                background:'none', border:'none',
                cursor:'pointer', borderBottom:'1px solid var(--border)',
                color:'var(--text)', textAlign:'left',
              }}
            >
              {p.cover_url
                ? <img src={p.cover_url} alt="" style={{width:48,height:48,borderRadius:8,objectFit:'cover'}} />
                : <div style={{width:48,height:48,borderRadius:8,background:'rgba(29,185,84,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-title)'}}>🎵</div>}
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.title}</div>
                <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                  {p.description || p.category}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{display:'flex', gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:'12px',background:'var(--surface-light)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)',fontSize: 'var(--fs-snap14)',fontWeight:500,cursor:'pointer'}}>Отмена</button>
          <button onClick={onCreateNew} style={{flex:2,padding:'12px',background:'var(--primary)',color:'var(--bg)',border:'none',borderRadius:10,fontSize: 'var(--fs-snap14)',fontWeight:600,cursor:'pointer'}}>Создать новый</button>
        </div>
      </div>
    </div>
  );
}

function PlusOnesBlock({ eventId, myId, limit, current, onChange }: {
  eventId: string; myId: string; limit: number; current: number; onChange: () => void;
}) {
  const change = async (delta: number) => {
    const next = Math.max(0, Math.min(limit, current + delta));
    if (next === current) return;
    await supabase
      .from('event_members')
      .update({ plus_ones: next })
      .eq('event_id', eventId)
      .eq('user_id', myId);
    onChange();
  };
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:12,
      padding:'10px 14px',marginBottom:14,
      background:'var(--surface-light)',borderRadius:12,
    }}>
      <div style={{fontSize: 'var(--fs-heading)'}}>👥</div>
      <div style={{flex:1}}>
        <div style={{fontSize: 'var(--fs-label)',fontWeight:500,color:'var(--text)'}}>Я приведу +N</div>
        <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginTop:1}}>
          Максимум +{limit}
        </div>
      </div>
      <button
        onClick={() => change(-1)}
        disabled={current === 0}
        style={{
          width:30,height:30,borderRadius:15,
          background:'var(--surface)',border:'1px solid var(--border)',
          color: current === 0 ? 'var(--muted)' : 'var(--text)',
          fontSize: 'var(--fs-heading)',cursor: current === 0 ? 'default' : 'pointer',
          opacity: current === 0 ? 0.4 : 1,
          display:'flex',alignItems:'center',justifyContent:'center',padding:0,lineHeight:1,
        }}
      >−</button>
      <div key={`po-counter-${current}`} className="plus-ones-pop" style={{fontSize: 'var(--fs-snap16)',fontWeight:600,color:'var(--text)',minWidth:24,textAlign:'center',display:'inline-block'}}>+{current}</div>
      <button
        onClick={() => change(1)}
        disabled={current >= limit}
        style={{
          width:30,height:30,borderRadius:15,
          background:'var(--primary)',color:'var(--bg)',border:'none',
          fontSize: 'var(--fs-heading)',cursor: current >= limit ? 'default' : 'pointer',
          opacity: current >= limit ? 0.4 : 1,
          display:'flex',alignItems:'center',justifyContent:'center',padding:0,lineHeight:1,
        }}
      >+</button>
    </div>
  );
}

function RsvpButton({ label, Icon, color, active, onClick }: {
  label: string; Icon: React.ComponentType<{ size?: number; color?: string }>; color: string; active: boolean; onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const wasActiveRef = useRef(active);

  // При переходе active=false → true → запускаем bounce
  useEffect(() => {
    if (!wasActiveRef.current && active && ref.current) {
      ref.current.classList.remove('anim-rsvp-bounce');
      void ref.current.offsetWidth;
      ref.current.classList.add('anim-rsvp-bounce');
      // Haptic
      if ('vibrate' in navigator) {
        try { navigator.vibrate(8); } catch {}
      }
    }
    wasActiveRef.current = active;
  }, [active]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      style={{
        padding:'10px 6px',
        background: active ? color : 'var(--surface-light)',
        color: active ? '#fff' : 'var(--text)',
        border: active ? 'none' : '1px solid var(--border)',
        borderRadius:10,
        fontSize: 'var(--fs-label)', fontWeight:600,
        cursor:'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', gap:4,
        transition:'background 200ms ease, color 200ms ease, border-color 200ms ease',
      }}
    >
      <Icon size={20} color={active ? '#fff' : color} />
      <span>{label}</span>
    </button>
  );
}
