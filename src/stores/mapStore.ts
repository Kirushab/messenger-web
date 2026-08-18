import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

export interface UserLocation {
  user_id: string;
  lng: number;
  lat: number;
  visible: boolean;
  is_live?: boolean;
  updated_at: string;
  user?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

interface MapState {
  locations: UserLocation[];
  myLocation: UserLocation | null;
  loading: boolean;
  error: string | null;
  realtimeChannel: any;

  loadLocations: (myUserId: string) => Promise<void>;
  setMyLocation: (userId: string, lng: number, lat: number, opts?: { isLive?: boolean; visible?: boolean }) => Promise<{ error: string | null }>;
  setVisible: (userId: string, visible: boolean) => Promise<{ error: string | null }>;
  removeMyLocation: (userId: string) => Promise<{ error: string | null }>;
  liveSharing: boolean;
  watchId: number | null;
  startLiveShare: (userId: string) => void;
  stopLiveShare: (forget?: boolean) => void;
  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  locations: [],
  myLocation: null,
  loading: false,
  error: null,
  realtimeChannel: null,
  liveSharing: false,
  watchId: null,

  loadLocations: async (myUserId) => {
    set({ loading: true, error: null });

    // Грузим все видимые локации + профили (один JOIN-запрос)
    const { data, error } = await supabase
      .from('user_locations')
      .select(`
        user_id, lng, lat, visible, is_live, updated_at,
        user:users (id, display_name, avatar_url)
      `);

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }

    const all = (data || []) as any as UserLocation[];
    const mine = all.find(l => l.user_id === myUserId) || null;
    set({
      locations: all,
      myLocation: mine,
      loading: false,
    });
  },

  setMyLocation: async (userId, lng, lat, opts) => {
    const visible = opts?.visible ?? get().myLocation?.visible ?? true;
    const isLive = opts?.isLive ?? get().myLocation?.is_live ?? false;
    // Оптимистичное обновление — мгновенно показываем точку на карте
    const optimistic: UserLocation = {
      user_id: userId,
      lng, lat,
      visible,
      is_live: isLive,
      updated_at: new Date().toISOString(),
      user: get().myLocation?.user,
    };

    set(state => {
      const others = state.locations.filter(l => l.user_id !== userId);
      return { locations: [...others, optimistic], myLocation: optimistic };
    });

    const payload: any = { user_id: userId, lng, lat, visible };
    if (opts?.isLive !== undefined) payload.is_live = opts.isLive;

    const { error } = await supabase
      .from('user_locations')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) return { error: error.message };

    // Если user-данных не было — подтягиваем через loadLocations с user-join,
    // чтобы оптимистичный маркер с «?» заменился на нормальный с аватаром.
    if (!optimistic.user) {
      try { await get().loadLocations(userId); } catch {}
    }

    return { error: null };
  },

  setVisible: async (userId, visible) => {
    const cur = get().myLocation;
    if (!cur) return { error: 'No location set' };

    set(state => ({
      myLocation: state.myLocation ? { ...state.myLocation, visible } : null,
      locations: state.locations.map(l =>
        l.user_id === userId ? { ...l, visible } : l
      ),
    }));

    const { error } = await supabase
      .from('user_locations')
      .update({ visible })
      .eq('user_id', userId);

    if (error) return { error: error.message };
    return { error: null };
  },

  removeMyLocation: async (userId) => {
    set(state => ({
      myLocation: null,
      locations: state.locations.filter(l => l.user_id !== userId),
    }));

    const { error } = await supabase
      .from('user_locations')
      .delete()
      .eq('user_id', userId);

    if (error) return { error: error.message };
    return { error: null };
  },

  // Постоянная трансляция геолокации: watchPosition обновляет точку,
  // остальные видят движение в реальном времени (через realtime user_locations).
  startLiveShare: (userId) => {
    if (!('geolocation' in navigator)) return;
    if (get().watchId != null) { set({ liveSharing: true }); return; }
    try { localStorage.setItem('sigmas_live_share', '1'); } catch {}
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - last < 8000) return; // троттлинг: не чаще раза в 8с
        last = now;
        get().setMyLocation(userId, pos.coords.longitude, pos.coords.latitude, { isLive: true, visible: true });
      },
      (err) => { console.warn('[live] geo error', err?.message || err); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    set({ watchId: id as unknown as number, liveSharing: true });
  },

  stopLiveShare: (forget = true) => {
    const id = get().watchId;
    if (id != null && 'geolocation' in navigator) { try { navigator.geolocation.clearWatch(id); } catch {} }
    if (forget) {
      try { localStorage.removeItem('sigmas_live_share'); } catch {}
      // Явная остановка пользователем — точка остаётся, но уже не «живая»
      const mine = get().myLocation;
      if (mine) {
        set({ myLocation: { ...mine, is_live: false }, locations: get().locations.map(l => l.user_id === mine.user_id ? { ...l, is_live: false } : l) });
        supabase.from('user_locations').update({ is_live: false }).eq('user_id', mine.user_id).then(() => {}, () => {});
      }
    }
    set({ watchId: null, liveSharing: false });
  },

  subscribeRealtime: () => {
    if (get().realtimeChannel) return;
    const ch = supabase
      .channel('user_locations_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_locations' },
        async (payload: any) => {
          const ev = payload.eventType;
          const myId = get().myLocation?.user_id;

          if (ev === 'DELETE') {
            const oldId = payload.old?.user_id;
            if (!oldId) return;
            set(state => ({
              locations: state.locations.filter(l => l.user_id !== oldId),
              myLocation: state.myLocation?.user_id === oldId ? null : state.myLocation,
            }));
            return;
          }

          // INSERT/UPDATE — нужен профиль
          const newRow = payload.new;
          if (!newRow) return;

          // Если в стейте уже есть профиль для этого user_id — переиспользуем
          let userInfo = get().locations.find(l => l.user_id === newRow.user_id)?.user;
          if (!userInfo) {
            const { data: u } = await supabase
              .from('users')
              .select('id, display_name, avatar_url')
              .eq('id', newRow.user_id)
              .single();
            userInfo = u as any;
          }

          const next: UserLocation = {
            user_id: newRow.user_id,
            lng: newRow.lng,
            lat: newRow.lat,
            visible: newRow.visible,
            is_live: newRow.is_live,
            updated_at: newRow.updated_at,
            user: userInfo,
          };

          set(state => {
            const others = state.locations.filter(l => l.user_id !== next.user_id);
            return {
              locations: [...others, next],
              myLocation: state.myLocation?.user_id === next.user_id || newRow.user_id === myId
                ? next
                : state.myLocation,
            };
          });
        }
      )
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
