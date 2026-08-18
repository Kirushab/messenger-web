import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';
import { Story, StoryGroup, useStoriesStore } from '@/stores/storiesStore';
import { usePostStore } from '@/stores/postStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import StoryViewer from '@/components/StoryViewer';
import BlockShell from './BlockShell';

interface Props { eventId: string; }

interface MomentItem {
  kind: 'story' | 'post';
  id: string;
  thumb: string;
  isVideo: boolean;
  count: number;
  ownerId: string;
  created_at: string;
}

// Блок «Моменты события»: истории и посты, привязанные к этому событию.
export default function MomentsBlock({ eventId }: Props) {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const { unlinkStoryFromEvent } = useStoriesStore();
  const { unlinkPostFromEvent } = usePostStore();
  const [items, setItems] = useState<MomentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; gi: number; si: number } | null>(null);
  const pressTimer = useRef<any>(null);
  const pressStart = useRef({ x: 0, y: 0 });
  const longPressed = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // Привязанные к событию истории показываем всегда (архив моментов), без фильтра срока
      const [storiesRes, postsRes] = await Promise.all([
        supabase.from('stories').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
        supabase.from('posts').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
      ]);
      const stories = (storiesRes.data || []) as Story[];
      const posts = (postsRes.data || []) as any[];
      const postIds = posts.map(p => p.id);
      const storyUserIds = [...new Set(stories.map(s => s.user_id))];

      const [mediaRes, usersRes] = await Promise.all([
        postIds.length ? supabase.from('post_media').select('*').in('post_id', postIds).order('position') : Promise.resolve({ data: [] as any[] }),
        storyUserIds.length ? supabase.from('users').select('*').in('id', storyUserIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const media = (mediaRes.data || []) as any[];
      const users = (usersRes.data || []) as User[];

      // Группы историй для просмотрщика
      const userMap: Record<string, User> = {};
      users.forEach(u => { userMap[u.id] = u; });
      const byUser: Record<string, Story[]> = {};
      stories.forEach(s => { (byUser[s.user_id] ||= []).push(s); });
      const groups: StoryGroup[] = Object.keys(byUser)
        .filter(uid => userMap[uid])
        .map(uid => ({ user: userMap[uid], stories: byUser[uid], allSeen: false }));

      // Первое медиа поста
      const mediaByPost: Record<string, any[]> = {};
      media.forEach(m => { (mediaByPost[m.post_id] ||= []).push(m); });

      const list: MomentItem[] = [];
      stories.forEach(s => list.push({ kind: 'story', id: s.id, thumb: s.media_url, isVideo: s.media_type === 'video', count: 1, ownerId: s.user_id, created_at: s.created_at }));
      posts.forEach(p => {
        const ms = mediaByPost[p.id] || [];
        const first = ms[0];
        if (!first) return;
        list.push({ kind: 'post', id: p.id, thumb: first.file_url, isVideo: String(first.mime_type || '').startsWith('video'), count: ms.length, ownerId: p.author_id, created_at: p.created_at });
      });
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));

      if (!alive) return;
      setStoryGroups(groups);
      setItems(list);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [eventId]);

  const openStory = (storyId: string) => {
    for (let gi = 0; gi < storyGroups.length; gi++) {
      const si = storyGroups[gi].stories.findIndex(s => s.id === storyId);
      if (si >= 0) { setViewer({ groups: storyGroups, gi, si }); return; }
    }
  };

  const endPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };
  const startPress = (it: MomentItem, e: React.PointerEvent) => {
    longPressed.current = false;
    if (!user || it.ownerId !== user.id) return; // открепить может только владелец момента
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      if (confirm('Открепить этот момент от события?')) {
        if (it.kind === 'story') unlinkStoryFromEvent(it.id); else unlinkPostFromEvent(it.id);
        setItems(prev => prev.filter(x => !(x.kind === it.kind && x.id === it.id)));
        toast.success('Откреплено от события');
      }
    }, 500);
  };
  const movePress = (e: React.PointerEvent) => {
    if (!pressTimer.current) return;
    if (Math.abs(e.clientX - pressStart.current.x) > 10 || Math.abs(e.clientY - pressStart.current.y) > 10) endPress();
  };
  const onItemClick = (it: MomentItem) => {
    if (longPressed.current) { longPressed.current = false; return; }
    if (it.kind === 'post') nav('/p/' + it.id); else openStory(it.id);
  };

  const icon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 21"/></svg>;

  const badgeStyle: React.CSSProperties = { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' };

  return (
    <>
      <BlockShell
        icon={icon}
        iconBg="#EC4899"
        title="Моменты события"
        subtitle={items.length > 0 ? `${items.length} из историй и постов` : 'Истории и посты с этим событием'}
        empty={!loading && items.length === 0
          ? <div style={{ padding: '14px', color: 'var(--muted)', fontSize: 'var(--fs-label)', textAlign: 'center' }}>Пока никто не отметил это событие в историях или постах</div>
          : undefined}
      >
        {loading
          ? <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
          : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                {items.map(it => (
                  <button key={it.kind + it.id}
                    onClick={() => onItemClick(it)}
                    onPointerDown={(e) => startPress(it, e)}
                    onPointerUp={endPress}
                    onPointerLeave={endPress}
                    onPointerCancel={endPress}
                    onPointerMove={movePress}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ position: 'relative', aspectRatio: '1', border: 'none', padding: 0, cursor: 'pointer', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                    {it.isVideo
                      ? <video src={it.thumb} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <img src={it.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <div style={badgeStyle}>
                      {it.kind === 'story'
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><circle cx="12" cy="12" r="9" strokeDasharray="3 2.5"/></svg>
                        : it.count > 1
                          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>
                          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-4-4L7 21"/></svg>}
                    </div>
                  </button>
                ))}
              </div>
              {items.some(it => it.ownerId === user?.id) && (
                <div style={{ padding: '8px 4px 0', fontSize: 'var(--fs-micro)', color: 'var(--muted)', textAlign: 'center' }}>Удерживайте свой момент, чтобы открепить</div>
              )}
            </>
          )}
      </BlockShell>
      {viewer && <StoryViewer groups={viewer.groups} startIndex={viewer.gi} startStory={viewer.si} onClose={() => setViewer(null)} />}
    </>
  );
}
