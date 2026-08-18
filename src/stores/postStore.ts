import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { PostMedia, PostWithDetails, PostCommentWithAuthor, User } from '@/types';
import { captureVideoPoster, readImageDimensions } from '@/lib/mediaPreview';

export type FeedEventFilter =
  | { kind: 'all' }
  | { kind: 'linked' }
  | { kind: 'event'; eventId: string };

interface PostState {
  feedPosts: PostWithDetails[];
  feedCursor: string | null;
  feedExhausted: boolean;
  loadingFeed: boolean;
  feedFilterKey: string;

  createPost: (authorId: string, caption: string, files: File[], eventId?: string | null) => Promise<{ id: string | null; error: string | null }>;
  fetchUserPosts: (userId: string) => Promise<PostWithDetails[]>;
  fetchPost: (postId: string) => Promise<PostWithDetails | null>;
  deletePost: (postId: string) => Promise<{ error: string | null }>;
  unlinkPostFromEvent: (postId: string) => Promise<void>;

  resetFeed: (filter?: FeedEventFilter) => void;
  fetchFeed: (myId: string, mode: 'normal' | 'grid', filter?: FeedEventFilter) => Promise<void>;

  toggleLike: (postId: string, userId: string) => Promise<void>;

  fetchComments: (postId: string) => Promise<PostCommentWithAuthor[]>;
  addComment: (postId: string, authorId: string, text: string) => Promise<{ error: string | null }>;
  deleteComment: (commentId: string, postId: string) => Promise<void>;

  swipePost: (postId: string, userId: string, action: 'like' | 'skip') => Promise<void>;
}

const FEED_PAGE_SIZE = 20;

function filterKey(filter: FeedEventFilter = { kind: 'all' }): string {
  return filter.kind === 'event' ? `event:${filter.eventId}` : filter.kind;
}

async function enrichPosts(rawPosts: any[], myId: string | undefined): Promise<PostWithDetails[]> {
  if (!rawPosts.length) return [];
  const postIds = rawPosts.map(p => p.id);
  const eventIds = [...new Set(rawPosts.map(p => p.event_id).filter(Boolean))] as string[];

  const [mediaRes, likesRes, commentsRes, eventsRes] = await Promise.all([
    supabase.from('post_media').select('*').in('post_id', postIds).order('position'),
    supabase.from('post_likes').select('post_id,user_id,created_at').in('post_id', postIds).order('created_at', { ascending: false }),
    supabase.from('post_comments').select('id,post_id,author_id,text,created_at').in('post_id', postIds).order('created_at', { ascending: false }),
    eventIds.length
      ? supabase.from('events').select('id,title,type,cover_url').in('id', eventIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const profileIds = new Set<string>();
  rawPosts.forEach(p => profileIds.add(p.author_id));
  (likesRes.data || []).forEach((l: any) => profileIds.add(l.user_id));
  (commentsRes.data || []).forEach((c: any) => profileIds.add(c.author_id));

  const profilesRes = profileIds.size
    ? await supabase.from('users').select('*').in('id', [...profileIds])
    : { data: [] as any[] };

  const profileMap: Record<string, User> = {};
  (profilesRes.data || []).forEach((u: any) => { profileMap[u.id] = u as User; });

  const eventMap: Record<string, { id: string; title: string; type: string; cover_url?: string | null }> = {};
  (eventsRes.data || []).forEach((e: any) => {
    eventMap[e.id] = { id: e.id, title: e.title, type: e.type, cover_url: e.cover_url || null };
  });

  const mediaByPost: Record<string, PostMedia[]> = {};
  (mediaRes.data || []).forEach((m: any) => {
    (mediaByPost[m.post_id] ||= []).push(m as PostMedia);
  });

  const likesByPost: Record<string, { count: number; mine: boolean; users: User[] }> = {};
  (likesRes.data || []).forEach((l: any) => {
    const bucket = (likesByPost[l.post_id] ||= { count: 0, mine: false, users: [] });
    bucket.count += 1;
    if (l.user_id === myId) bucket.mine = true;
    const profile = profileMap[l.user_id];
    if (profile && bucket.users.length < 3 && !bucket.users.some(u => u.id === profile.id)) bucket.users.push(profile);
  });

  const commentsByPost: Record<string, PostCommentWithAuthor[]> = {};
  (commentsRes.data || []).forEach((c: any) => {
    const author = profileMap[c.author_id];
    if (!author) return;
    const bucket = (commentsByPost[c.post_id] ||= []);
    if (bucket.length < 2) bucket.push({ ...c, author } as PostCommentWithAuthor);
  });

  const commentCounts: Record<string, number> = {};
  (commentsRes.data || []).forEach((c: any) => {
    commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
  });

  return rawPosts
    .map(p => ({
      ...p,
      author: profileMap[p.author_id],
      media: mediaByPost[p.id] || [],
      likes_count: likesByPost[p.id]?.count || 0,
      liked_by_me: likesByPost[p.id]?.mine || false,
      liked_by_preview: likesByPost[p.id]?.users || [],
      comments_count: commentCounts[p.id] || 0,
      comments_preview: (commentsByPost[p.id] || []).slice().reverse(),
      event: p.event_id ? (eventMap[p.event_id] || null) : null,
    }))
    .filter(p => !!p.author) as PostWithDetails[];
}

export const usePostStore = create<PostState>((set, get) => ({
  feedPosts: [],
  feedCursor: null,
  feedExhausted: false,
  loadingFeed: false,
  feedFilterKey: 'all',

  createPost: async (authorId, caption, files, eventId) => {
    if (!files.length) return { id: null, error: 'Нужно хотя бы одно медиа' };

    const { data: post, error: postErr } = await supabase
      .from('posts')
      .insert({ author_id: authorId, caption, event_id: eventId || null })
      .select()
      .single();
    if (postErr || !post) return { id: null, error: postErr?.message || 'Не удалось создать пост' };

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `${authorId}/${post.id}/${i}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from('post-media')
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('post-media').getPublicUrl(path);

        let previewUrl: string | null = null;
        let previewPath: string | null = null;
        let width: number | null = null;
        let height: number | null = null;

        if (file.type.startsWith('video/')) {
          const localUrl = URL.createObjectURL(file);
          try {
            const poster = await captureVideoPoster(localUrl, false);
            width = poster.width;
            height = poster.height;
            previewPath = `${authorId}/${post.id}/${i}_poster.jpg`;
            const { error: posterErr } = await supabase.storage
              .from('post-media')
              .upload(previewPath, poster.blob, { contentType: 'image/jpeg', upsert: true });
            if (!posterErr) {
              const { data: posterUrl } = supabase.storage.from('post-media').getPublicUrl(previewPath);
              previewUrl = posterUrl.publicUrl;
            }
          } catch {
            // The feed can still build a local poster from the remote video as a fallback.
          } finally {
            URL.revokeObjectURL(localUrl);
          }
        } else if (file.type.startsWith('image/')) {
          const dims = await readImageDimensions(file);
          width = dims.width || null;
          height = dims.height || null;
        }

        const mediaPayload = {
          post_id: post.id,
          file_url: urlData.publicUrl,
          mime_type: file.type,
          position: i,
          preview_url: previewUrl,
          width,
          height,
        };
        let { error: mediaErr } = await supabase.from('post_media').insert(mediaPayload);

        // Backwards compatible deployment: if migration 174 has not been applied yet,
        // publish the post with the legacy columns instead of breaking creation entirely.
        if (mediaErr && /preview_url|width|height|schema cache|column/i.test(mediaErr.message || '')) {
          if (previewPath) { try { await supabase.storage.from('post-media').remove([previewPath]); } catch { /* noop */ } }
          ({ error: mediaErr } = await supabase.from('post_media').insert({
            post_id: post.id,
            file_url: urlData.publicUrl,
            mime_type: file.type,
            position: i,
          }));
        }
        if (mediaErr) throw mediaErr;
      }
      return { id: post.id, error: null };
    } catch (e: any) {
      await supabase.from('posts').delete().eq('id', post.id);
      return { id: null, error: e?.message || 'Ошибка загрузки медиа' };
    }
  },

  fetchUserPosts: async (userId) => {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('author_id', userId)
      .eq('is_tinder', false)
      .order('created_at', { ascending: false });
    if (error || !posts) return [];
    const { data: { user } } = await supabase.auth.getUser();
    return enrichPosts(posts, user?.id);
  },

  fetchPost: async (postId) => {
    const { data: post, error } = await supabase.from('posts').select('*').eq('id', postId).single();
    if (error || !post) return null;
    const { data: { user } } = await supabase.auth.getUser();
    const enriched = await enrichPosts([post], user?.id);
    return enriched[0] || null;
  },

  deletePost: async (postId) => {
    const { data: media } = await supabase.from('post_media').select('file_url,preview_url').eq('post_id', postId);
    if (media) {
      const paths: string[] = [];
      for (const m of media) {
        const match = m.file_url?.match(/\/post-media\/(.+)$/);
        if (match) paths.push(match[1]);
        const previewMatch = m.preview_url?.match(/\/post-media\/(.+)$/);
        if (previewMatch) paths.push(previewMatch[1]);
      }
      if (paths.length) await supabase.storage.from('post-media').remove(paths);
    }
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (!error) set(state => ({ feedPosts: state.feedPosts.filter(p => p.id !== postId) }));
    return { error: error?.message || null };
  },

  unlinkPostFromEvent: async (postId) => {
    await supabase.from('posts').update({ event_id: null }).eq('id', postId);
    set(state => ({ feedPosts: state.feedPosts.map(p => p.id === postId ? { ...p, event_id: null, event: null } : p) }));
  },

  resetFeed: (filter = { kind: 'all' }) => set({
    feedPosts: [],
    feedCursor: null,
    feedExhausted: false,
    loadingFeed: false,
    feedFilterKey: filterKey(filter),
  }),

  fetchFeed: async (myId, _mode, filter = { kind: 'all' }) => {
    const key = filterKey(filter);
    let state = get();
    if (state.feedFilterKey !== key) {
      set({ feedPosts: [], feedCursor: null, feedExhausted: false, loadingFeed: false, feedFilterKey: key });
      state = get();
    }
    if (state.loadingFeed || state.feedExhausted) return;

    set({ loadingFeed: true });

    let query = supabase
      .from('posts')
      .select('*')
      .eq('is_tinder', false)
      .order('created_at', { ascending: false })
      .limit(FEED_PAGE_SIZE);

    if (filter.kind === 'linked') query = query.not('event_id', 'is', null);
    if (filter.kind === 'event') query = query.eq('event_id', filter.eventId);
    if (state.feedCursor) query = query.lt('created_at', state.feedCursor);

    const { data: posts, error } = await query;
    if (error || !posts || posts.length === 0) {
      set({ loadingFeed: false, feedExhausted: true });
      return;
    }

    const enriched = await enrichPosts(posts, myId);
    set(s => ({
      feedPosts: [...s.feedPosts, ...enriched],
      feedCursor: posts[posts.length - 1].created_at,
      feedExhausted: posts.length < FEED_PAGE_SIZE,
      loadingFeed: false,
    }));
  },

  toggleLike: async (postId, userId) => {
    const post = get().feedPosts.find(p => p.id === postId);
    const liked = post?.liked_by_me || false;
    set(state => ({
      feedPosts: state.feedPosts.map(p => p.id === postId ? {
        ...p,
        liked_by_me: !liked,
        likes_count: Math.max(0, p.likes_count + (liked ? -1 : 1)),
      } : p),
    }));

    if (liked) await supabase.from('post_likes').delete().match({ post_id: postId, user_id: userId });
    else await supabase.from('post_likes').upsert({ post_id: postId, user_id: userId });
  },

  fetchComments: async (postId) => {
    const { data, error } = await supabase
      .from('post_comments')
      .select('*, author:users!post_comments_author_id_fkey(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data as any as PostCommentWithAuthor[];
  },

  addComment: async (postId, authorId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return { error: 'Пустой комментарий' };
    const { error } = await supabase.from('post_comments').insert({ post_id: postId, author_id: authorId, text: trimmed });
    if (error) return { error: error.message };
    set(state => ({
      feedPosts: state.feedPosts.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p),
    }));
    return { error: null };
  },

  deleteComment: async (commentId, postId) => {
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
    if (!error) {
      set(state => ({
        feedPosts: state.feedPosts.map(p => p.id === postId
          ? { ...p, comments_count: Math.max(0, p.comments_count - 1), comments_preview: (p.comments_preview || []).filter(c => c.id !== commentId) }
          : p),
      }));
    }
  },

  swipePost: async (postId, userId, action) => {
    await supabase.from('post_swipes').upsert({ post_id: postId, user_id: userId, action });
    if (action === 'like') await supabase.from('post_likes').upsert({ post_id: postId, user_id: userId });
    set(state => ({ feedPosts: state.feedPosts.filter(p => p.id !== postId) }));
  },
}));
