import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

export type EventType = 'party' | 'trip';
export type EventStatus = 'draft' | 'planned' | 'active' | 'archived' | 'cancelled';
export type RsvpStatus = 'going' | 'maybe' | 'not_going';

export interface SigEvent {
  id: string;
  type: EventType;
  creator_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  cover_url: string | null;
  status: EventStatus;
  conversation_id: string | null;
  spotify_playlist_id: string | null;
  budget_per_person: number | null;
  budget_currency: string | null;
  dress_code: string | null;
  is_birthday: boolean;
  organizer_notes: string | null;
  meeting_point: string | null;
  meeting_point_lat: number | null;
  meeting_point_lng: number | null;
  meeting_at: string | null;
  plus_ones_limit: number;
  created_at: string;
  updated_at: string;
  creator?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
  // Аггрегаты
  goingCount?: number;
  maybeCount?: number;
  myRsvp?: RsvpStatus | null;
}

export interface EventMember {
  event_id: string;
  user_id: string;
  rsvp: RsvpStatus | null;
  invited_by: string | null;
  joined_at: string;
  plus_ones: number;
  user?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

interface EventsState {
  events: Record<string, SigEvent>;
  membersByEvent: Record<string, EventMember[]>;
  loading: boolean;
  realtimeChannel: any;

  loadEvents: (myUserId: string, type?: EventType) => Promise<void>;
  loadEventMembers: (eventId: string) => Promise<void>;
  createEvent: (data: {
    type: EventType;
    creatorId: string;
    title: string;
    description?: string;
    start_at: string;
    end_at?: string;
    location_name?: string;
    location_lat?: number;
    location_lng?: number;
    cover_url?: string;
  }) => Promise<{ id: string | null; error: string | null }>;
  updateEvent: (id: string, patch: Partial<SigEvent>) => Promise<{ error: string | null }>;
  cancelEvent: (id: string) => Promise<{ error: string | null }>;
  setMyRsvp: (eventId: string, myUserId: string, rsvp: RsvpStatus) => Promise<{ error: string | null }>;
  removeMyMembership: (eventId: string, myUserId: string) => Promise<{ error: string | null }>;
  inviteUsers: (eventId: string, myUserId: string, userIds: string[]) => Promise<{ error: string | null }>;
  subscribeRealtime: (myUserId: string) => void;
  unsubscribeRealtime: () => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: {},
  membersByEvent: {},
  loading: false,
  realtimeChannel: null,

  loadEvents: async (myUserId, type) => {
    set({ loading: true });
    let query = supabase
      .from('events')
      .select(`
        *,
        creator:users!events_creator_id_fkey (id, display_name, avatar_url)
      `)
      .in('status', ['planned', 'active', 'archived'])
      .order('start_at', { ascending: false });

    if (type) query = query.eq('type', type);

    const { data: events, error } = await query;
    if (error) {
      console.error('loadEvents:', error);
      set({ loading: false });
      return;
    }

    // Грузим членство участников + аггрегаты
    const eventIds = (events || []).map((e: any) => e.id);
    let membersByEvent: Record<string, any[]> = {};
    if (eventIds.length > 0) {
      const { data: members } = await supabase
        .from('event_members')
        .select('event_id, user_id, rsvp, user:users(id, display_name, avatar_url)')
        .in('event_id', eventIds);
      for (const m of members || []) {
        const arr = membersByEvent[m.event_id] || [];
        arr.push(m);
        membersByEvent[m.event_id] = arr;
      }
    }

    const map: Record<string, SigEvent> = {};
    for (const ev of events || []) {
      const ms = membersByEvent[ev.id] || [];
      const goingCount = ms.filter(m => m.rsvp === 'going').length;
      const maybeCount = ms.filter(m => m.rsvp === 'maybe').length;
      const my = ms.find(m => m.user_id === myUserId);
      map[ev.id] = {
        ...ev,
        goingCount,
        maybeCount,
        myRsvp: my?.rsvp || null,
      };
    }

    set({ events: map, loading: false });
  },

  loadEventMembers: async (eventId) => {
    const { data, error } = await supabase
      .from('event_members')
      .select(`
        event_id, user_id, rsvp, invited_by, joined_at, plus_ones,
        user:users (id, display_name, avatar_url)
      `)
      .eq('event_id', eventId);
    if (error) {
      console.error('loadEventMembers:', error);
      return;
    }
    const rows = (data || []) as any[];
    set(state => {
      const ev = state.events[eventId];
      const nextEvents = ev ? {
        ...state.events,
        [eventId]: {
          ...ev,
          goingCount: rows.filter(m => m.rsvp === 'going').length,
          maybeCount: rows.filter(m => m.rsvp === 'maybe').length,
        },
      } : state.events;
      return { membersByEvent: { ...state.membersByEvent, [eventId]: rows as any }, events: nextEvents };
    });
  },

  createEvent: async ({ type, creatorId, title, description, start_at, end_at, location_name, location_lat, location_lng, cover_url }) => {
    // Атомарно создаём событие с групповым чатом через RPC
    const { data: rpc, error: rpcErr } = await supabase.rpc('create_event_with_chat', {
      type_param: type,
      title_param: title.trim(),
      description_param: description?.trim() || null,
      start_at_param: start_at,
      end_at_param: end_at || null,
      location_name_param: location_name?.trim() || null,
      location_lat_param: location_lat ?? null,
      location_lng_param: location_lng ?? null,
      cover_url_param: cover_url?.trim() || null,
    });

    if (rpcErr || !rpc?.event_id) {
      console.error('createEvent RPC failed:', rpcErr);
      return { id: null, error: rpcErr?.message || 'RPC failed' };
    }

    // Сохраняем минимально-валидное событие в стор без второго запроса
    // (страница /events/:id подгрузит полные данные с creator-профилем сама)
    const fresh: SigEvent = {
      id: rpc.event_id,
      type,
      creator_id: creatorId,
      title: title.trim(),
      description: description?.trim() || null,
      start_at,
      end_at: end_at || null,
      location_name: location_name?.trim() || null,
      location_lat: location_lat ?? null,
      location_lng: location_lng ?? null,
      cover_url: cover_url?.trim() || null,
      conversation_id: rpc.conversation_id,
      status: 'active',
      created_at: new Date().toISOString(),
      goingCount: 1,
      maybeCount: 0,
      myRsvp: 'going',
    } as SigEvent;
    set(state => ({ events: { ...state.events, [rpc.event_id]: fresh } }));
    return { id: rpc.event_id, error: null };
  },

  updateEvent: async (id, patch) => {
    set(state => ({ events: { ...state.events, [id]: { ...state.events[id], ...patch } } }));
    const { error } = await supabase.from('events').update(patch).eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  },

  cancelEvent: async (id) => {
    set(state => ({
      events: state.events[id]
        ? { ...state.events, [id]: { ...state.events[id], status: 'cancelled' } }
        : state.events
    }));
    const { error } = await supabase.from('events').update({ status: 'cancelled' }).eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  },

  setMyRsvp: async (eventId, myUserId, rsvp) => {
    // Оптимистично
    set(state => {
      const ev = state.events[eventId];
      if (!ev) return state;
      let goingCount = ev.goingCount || 0;
      let maybeCount = ev.maybeCount || 0;
      if (ev.myRsvp === 'going') goingCount = Math.max(0, goingCount - 1);
      if (ev.myRsvp === 'maybe') maybeCount = Math.max(0, maybeCount - 1);
      if (rsvp === 'going') goingCount += 1;
      if (rsvp === 'maybe') maybeCount += 1;
      return { events: { ...state.events, [eventId]: { ...ev, myRsvp: rsvp, goingCount, maybeCount } } };
    });

    const { error } = await supabase
      .from('event_members')
      .upsert({
        event_id: eventId,
        user_id: myUserId,
        rsvp,
      }, { onConflict: 'event_id,user_id' });

    if (error) return { error: error.message };

    // Если going или maybe — автоматически добавляемся в чат события
    if (rsvp === 'going' || rsvp === 'maybe') {
      await supabase.rpc('join_event_chat', {
        event_id_param: eventId,
        target_user_id_param: null,  // null = себя
      });
    }

    return { error: null };
  },

  removeMyMembership: async (eventId, myUserId) => {
    set(state => {
      const ev = state.events[eventId];
      if (!ev) return state;
      let goingCount = ev.goingCount || 0;
      let maybeCount = ev.maybeCount || 0;
      if (ev.myRsvp === 'going') goingCount = Math.max(0, goingCount - 1);
      if (ev.myRsvp === 'maybe') maybeCount = Math.max(0, maybeCount - 1);
      return { events: { ...state.events, [eventId]: { ...ev, myRsvp: null, goingCount, maybeCount } } };
    });

    const { error } = await supabase
      .from('event_members')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', myUserId);
    if (error) return { error: error.message };
    return { error: null };
  },

  inviteUsers: async (eventId, _myUserId, userIds) => {
    if (userIds.length === 0) return { error: null };
    // Используем RPC который добавляет и в event_members и в conversation_members
    for (const uid of userIds) {
      const { error } = await supabase.rpc('join_event_chat', {
        event_id_param: eventId,
        target_user_id_param: uid,
      });
      if (error) return { error: error.message };
    }
    return { error: null };
  },

  subscribeRealtime: (myUserId) => {
    if (get().realtimeChannel) return;
    const ch = supabase
      .channel('events_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, async (payload: any) => {
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (!oldId) return;
          set(state => {
            const next = { ...state.events };
            delete next[oldId];
            return { events: next };
          });
          return;
        }
        const row = payload.new;
        if (!row) return;
        // Сохраняем уже посчитанные counts если есть
        const existing = get().events[row.id];
        let creator = existing?.creator;
        if (!creator) {
          const { data: u } = await supabase.from('users').select('id, display_name, avatar_url').eq('id', row.creator_id).single();
          creator = u as any;
        }
        set(state => ({
          events: {
            ...state.events,
            [row.id]: {
              ...row,
              creator,
              goingCount: existing?.goingCount ?? 0,
              maybeCount: existing?.maybeCount ?? 0,
              myRsvp: existing?.myRsvp ?? null,
            }
          }
        }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_members' }, (payload: any) => {
        const row = payload.new || payload.old;
        if (!row) return;
        const evId = row.event_id;
        const ev = get().events[evId];
        if (!ev) return;

        // Если изменилось моё членство — обновляем myRsvp
        if (row.user_id === myUserId) {
          const newRsvp = payload.eventType === 'DELETE' ? null : (payload.new?.rsvp || null);
          set(state => ({
            events: { ...state.events, [evId]: { ...state.events[evId], myRsvp: newRsvp } }
          }));
        }

        // Перезагружаем members этого события (для счётчиков)
        // Простое решение — перерасчёт через loadEvents для этого события не критичен; для скорости
        // можно делать инкрементально, но пока re-fetch
      })
      .subscribe();
    set({ realtimeChannel: ch });
  },

  unsubscribeRealtime: () => {
    const ch = get().realtimeChannel;
    if (!ch) return;
    try { supabase.removeChannel(ch); } catch {}
    set({ realtimeChannel: null });
  },
}));
