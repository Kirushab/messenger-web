import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  storage_path: string | null;
  created_at: string;
  expires_at: string;
  pinned_to_profile?: boolean;
  caption?: string | null;
  event_id?: string | null;
  event?: { id: string; title: string; type: string } | null;
}

export interface StoryReaction {
  user: User;
  emoji: string;
  created_at: string;
}

export interface StoryGroup {
  user: User;
  stories: Story[];
  allSeen: boolean;
}

interface StoriesState {
  groups: StoryGroup[];        // чужие активные истории (без моих)
  myGroup: StoryGroup | null;  // мои активные истории
  loading: boolean;
  loadStories: (myId: string) => Promise<void>;
  createStory: (userId: string, file: File, caption?: string, eventId?: string | null) => Promise<{ error: string | null }>;
  reactToStory: (storyId: string, userId: string, emoji: string) => Promise<void>;
  loadStoryReactions: (storyId: string) => Promise<StoryReaction[]>;
  unlinkStoryFromEvent: (storyId: string) => Promise<void>;
  markViewed: (storyId: string, viewerId: string) => Promise<void>;
  deleteStory: (storyId: string) => Promise<void>;
  loadProfileStories: (userId: string, isOwner: boolean) => Promise<Story[]>;
  togglePin: (storyId: string, pinned: boolean) => Promise<void>;
  loadViewers: (storyId: string) => Promise<{ user: User; viewed_at: string }[]>;
}

export const useStoriesStore = create<StoriesState>((set, get) => ({
  groups: [],
  myGroup: null,
  loading: false,

  loadStories: async (myId) => {
    set({ loading: true });
    const nowIso = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from('stories')
      .select('*')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true });
    if (error) { console.error('loadStories', error); set({ loading: false }); return; }

    const stories = (rows || []) as Story[];
    if (!stories.length) { set({ groups: [], myGroup: null, loading: false }); return; }

    const userIds = [...new Set(stories.map(s => s.user_id))];
    const storyIds = stories.map(s => s.id);
    const eventIds = [...new Set(stories.map(s => s.event_id).filter(Boolean))] as string[];
    const [authorsRes, viewsRes, eventsRes] = await Promise.all([
      supabase.from('users').select('*').in('id', userIds),
      supabase.from('story_views').select('story_id').eq('viewer_id', myId).in('story_id', storyIds),
      eventIds.length ? supabase.from('events').select('id,title,type').in('id', eventIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const authorMap: Record<string, User> = {};
    (authorsRes.data || []).forEach((u: any) => { authorMap[u.id] = u as User; });
    const seen = new Set((viewsRes.data || []).map((v: any) => v.story_id));
    const eventMap: Record<string, { id: string; title: string; type: string }> = {};
    (eventsRes.data || []).forEach((e: any) => { eventMap[e.id] = { id: e.id, title: e.title, type: e.type }; });
    if (eventIds.length) stories.forEach(s => { if (s.event_id && eventMap[s.event_id]) s.event = eventMap[s.event_id]; });

    const byUser: Record<string, Story[]> = {};
    for (const s of stories) { (byUser[s.user_id] ||= []).push(s); }

    const groups: StoryGroup[] = [];
    let myGroup: StoryGroup | null = null;
    for (const uid of Object.keys(byUser)) {
      const u = authorMap[uid];
      if (!u) continue;
      const g: StoryGroup = { user: u, stories: byUser[uid], allSeen: byUser[uid].every(s => seen.has(s.id)) };
      if (uid === myId) myGroup = g; else groups.push(g);
    }
    // Непросмотренные раньше просмотренных
    groups.sort((a, b) => Number(a.allSeen) - Number(b.allSeen));
    set({ groups, myGroup, loading: false });
  },

  createStory: async (userId, file, caption, eventId) => {
    const isVideo = file.type.startsWith('video/');
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    // ВАЖНО: storage-политика бакета post-media требует, чтобы ПЕРВАЯ папка пути
    // совпадала с auth.uid() (как у постов: `${uid}/...`). Поэтому путь начинается с userId,
    // иначе INSERT в storage.objects отклоняется RLS и история не публикуется.
    const path = `${userId}/stories/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from('post-media').upload(path, file, { contentType: file.type });
    if (upErr) return { error: upErr.message };
    const { data: urlData } = supabase.storage.from('post-media').getPublicUrl(path);
    const { error: insErr } = await supabase.from('stories').insert({
      user_id: userId,
      media_url: urlData.publicUrl,
      media_type: isVideo ? 'video' : 'image',
      storage_path: path,
      caption: caption?.trim() || null,
      event_id: eventId || null,
    });
    if (insErr) {
      await supabase.storage.from('post-media').remove([path]).catch(() => {});
      return { error: insErr.message };
    }
    await get().loadStories(userId);
    return { error: null };
  },

  reactToStory: async (storyId, userId, emoji) => {
    await supabase.from('story_reactions').upsert(
      { story_id: storyId, user_id: userId, emoji },
      { onConflict: 'story_id,user_id' }
    );
  },

  loadStoryReactions: async (storyId) => {
    const { data, error } = await supabase
      .from('story_reactions')
      .select('emoji, created_at, user:users(*)')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return (data as any[])
      .map(r => ({ user: r.user as User, emoji: r.emoji as string, created_at: r.created_at as string }))
      .filter(r => r.user);
  },

  unlinkStoryFromEvent: async (storyId) => {
    await supabase.from('stories').update({ event_id: null }).eq('id', storyId);
  },

  markViewed: async (storyId, viewerId) => {
    // Дубликаты не страшны — просто игнорируем ошибку уникальности.
    const { error } = await supabase.from('story_views').insert({ story_id: storyId, viewer_id: viewerId });
    if (error && !/duplicate|unique/i.test(error.message)) console.error('markViewed', error);
  },

  deleteStory: async (storyId) => {
    const { error } = await supabase.from('stories').delete().eq('id', storyId);
    if (error) console.error('deleteStory', error);
  },

  // Истории для профиля: владелец видит весь архив, остальные — только закреплённые.
  loadProfileStories: async (userId, isOwner) => {
    let q = supabase.from('stories').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (!isOwner) q = q.eq('pinned_to_profile', true);
    const { data, error } = await q;
    if (error) { console.error('loadProfileStories', error); return []; }
    return (data || []) as Story[];
  },

  togglePin: async (storyId, pinned) => {
    const { error } = await supabase.from('stories').update({ pinned_to_profile: pinned }).eq('id', storyId);
    if (error) console.error('togglePin', error);
  },

  // Кто посмотрел историю (доступно автору по RLS).
  loadViewers: async (storyId) => {
    const { data: views } = await supabase.from('story_views').select('viewer_id, viewed_at').eq('story_id', storyId).order('viewed_at', { ascending: false });
    const ids = [...new Set((views || []).map((v: any) => v.viewer_id))];
    if (!ids.length) return [];
    const { data: users } = await supabase.from('users').select('*').in('id', ids);
    const umap: Record<string, User> = {};
    (users || []).forEach((u: any) => { umap[u.id] = u as User; });
    return (views || [])
      .map((v: any) => ({ user: umap[v.viewer_id], viewed_at: v.viewed_at }))
      .filter((x: any) => x.user);
  },
}));
