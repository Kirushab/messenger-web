import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

export type PlaylistCategory = 'car' | 'party' | 'workout' | 'work' | 'relax' | 'other';

export interface Playlist {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  category: PlaylistCategory;
  spotify_url: string;
  spotify_id: string | null;
  cover_url: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  owner?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

export const CATEGORY_META: Record<PlaylistCategory, { label: string; icon: string; gradient: string }> = {
  car:     { label: 'Для машины',  icon: 'car', gradient: 'linear-gradient(135deg, #4A9EFF, #2563EB)' },
  party:   { label: 'Тусовка',     icon: 'party', gradient: 'linear-gradient(135deg, #EC4899, #BE185D)' },
  workout: { label: 'Тренировка',  icon: 'workout', gradient: 'linear-gradient(135deg, #F472B6, #DB2777)' },
  work:    { label: 'Работа',      icon: 'briefcase', gradient: 'linear-gradient(135deg, #78716C, #292524)' },
  relax:   { label: 'Расслабление', icon: 'relax', gradient: 'linear-gradient(135deg, #FBBF24, #D97706)' },
  other:   { label: 'Другое',      icon: 'music', gradient: 'linear-gradient(135deg, #A78BFA, #7C3AED)' },
};

// Извлекает Spotify playlist ID из любого формата ссылки
export function extractSpotifyPlaylistId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  // Format 1: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
  // Format 2: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc
  // Format 3: spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  // Format 4: 37i9dQZF1DXcBWIGoYBM5M (просто ID)
  const m1 = trimmed.match(/playlist[\/:]([a-zA-Z0-9]{20,40})/);
  if (m1) return m1[1];
  const m2 = trimmed.match(/^[a-zA-Z0-9]{20,40}$/);
  if (m2) return m2[0];
  return null;
}

interface PlaylistState {
  playlists: Playlist[];
  loading: boolean;
  error: string | null;
  realtimeChannel: any;

  loadPlaylists: () => Promise<void>;
  createPlaylist: (data: {
    owner_id: string;
    title: string;
    description?: string;
    category: PlaylistCategory;
    spotify_url: string;
    cover_url?: string;
  }) => Promise<{ id: string | null; error: string | null }>;
  updatePlaylist: (id: string, patch: Partial<Pick<Playlist, 'title' | 'description' | 'category' | 'cover_url' | 'archived'>>) => Promise<{ error: string | null }>;
  deletePlaylist: (id: string) => Promise<{ error: string | null }>;
  getById: (id: string) => Playlist | undefined;
  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  loading: false,
  error: null,
  realtimeChannel: null,

  loadPlaylists: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('playlists')
      .select(`
        id, owner_id, title, description, category, spotify_url, spotify_id,
        cover_url, archived, created_at, updated_at,
        owner:users (id, display_name, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ playlists: (data || []) as any as Playlist[], loading: false });
  },

  createPlaylist: async ({ owner_id, title, description, category, spotify_url, cover_url }) => {
    const spotify_id = extractSpotifyPlaylistId(spotify_url);
    if (!spotify_id) {
      return { id: null, error: 'Не удалось распознать ссылку на Spotify-плейлист' };
    }

    const { data, error } = await supabase
      .from('playlists')
      .insert({
        owner_id,
        title: title.trim(),
        description: description?.trim() || null,
        category,
        spotify_url: spotify_url.trim(),
        spotify_id,
        cover_url: cover_url?.trim() || null,
        archived: false,
      })
      .select(`
        id, owner_id, title, description, category, spotify_url, spotify_id,
        cover_url, archived, created_at, updated_at,
        owner:users (id, display_name, avatar_url)
      `)
      .single();

    if (error) return { id: null, error: error.message };

    set(state => ({ playlists: [data as any as Playlist, ...state.playlists] }));
    return { id: data.id, error: null };
  },

  updatePlaylist: async (id, patch) => {
    // Оптимистично
    set(state => ({
      playlists: state.playlists.map(p => p.id === id ? { ...p, ...patch } : p),
    }));

    const { error } = await supabase
      .from('playlists')
      .update(patch)
      .eq('id', id);

    if (error) return { error: error.message };
    return { error: null };
  },

  deletePlaylist: async (id) => {
    set(state => ({ playlists: state.playlists.filter(p => p.id !== id) }));
    const { error } = await supabase.from('playlists').delete().eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  },

  getById: (id) => get().playlists.find(p => p.id === id),

  subscribeRealtime: () => {
    if (get().realtimeChannel) return;
    const ch = supabase
      .channel('playlists_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, async (payload: any) => {
        const ev = payload.eventType;
        if (ev === 'DELETE') {
          const oldId = payload.old?.id;
          if (!oldId) return;
          set(state => ({ playlists: state.playlists.filter(p => p.id !== oldId) }));
          return;
        }
        const row = payload.new;
        if (!row) return;

        // Подгружаем профиль владельца
        let owner = get().playlists.find(p => p.owner_id === row.owner_id)?.owner;
        if (!owner) {
          const { data: u } = await supabase
            .from('users')
            .select('id, display_name, avatar_url')
            .eq('id', row.owner_id)
            .single();
          owner = u as any;
        }

        const next: Playlist = { ...row, owner };

        set(state => {
          const existing = state.playlists.find(p => p.id === next.id);
          if (existing) {
            return { playlists: state.playlists.map(p => p.id === next.id ? next : p) };
          }
          return { playlists: [next, ...state.playlists] };
        });
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
