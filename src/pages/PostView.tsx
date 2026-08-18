import { useEffect, useRef, useState } from 'react';
import { goBack } from '@/lib/nav';
import { useNavigate, useParams } from 'react-router-dom';
import { usePostStore } from '@/stores/postStore';
import { useAuthStore } from '@/stores/authStore';
import type { PostWithDetails } from '@/types';
import CommentsSheet from '@/components/CommentsSheet';
import PostLikesSheet from '@/components/PostLikesSheet';
import { PostCard } from '@/pages/Feed';
import { SkeletonPost } from '@/components/Skeleton';
import { haptic } from '@/lib/haptics';

export default function PostView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuthStore();
  const { fetchPost, fetchUserPosts, deletePost } = usePostStore();
  const [posts, setPosts] = useState<PostWithDetails[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [likesPostId, setLikesPostId] = useState<string | null>(null);
  const scrolledRef = useRef(false);

  // Грузим пост → затем все посты автора, чтобы листать ленту как в инсте
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    scrolledRef.current = false;
    (async () => {
      const p = await fetchPost(id);
      if (!p) { setPosts([]); setLoading(false); return; }
      const all = await fetchUserPosts(p.author_id);
      let list = all && all.length ? all : [p];
      if (!list.some(x => x.id === id)) list = [p, ...list];
      setPosts(list);
      setLoading(false);
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Автоскролл к нажатому посту
  useEffect(() => {
    if (loading || !posts || scrolledRef.current) return;
    const el = document.getElementById(`post-${id}`);
    if (el) { el.scrollIntoView({ block: 'start' }); scrolledRef.current = true; }
  }, [loading, posts, id]);

  const onDeletePost = async (postId: string) => {
    if (!confirm('Удалить пост?')) return;
    await deletePost(postId);
    setPosts(prev => {
      const next = (prev || []).filter(p => p.id !== postId);
      if (next.length === 0) setTimeout(() => goBack(nav, '/feed'), 0);
      return next;
    });
  };

  return (
    <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
        borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => { haptic.tap(); goBack(nav, '/feed'); }} className="feed-action-btn" style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 'var(--fs-snap24)', cursor: 'pointer', padding: 4, lineHeight: 1 }}>‹</button>
        <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600 }}>Публикация</div>
      </header>

      {loading && (
        <div style={{ flex: 1, overflowY: 'auto' }}><SkeletonPost /><SkeletonPost /></div>
      )}

      {!loading && posts && posts.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
          <div className="feed-empty-emoji" style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🔍</div>
          <p style={{ color: 'var(--text)', fontSize: 'var(--fs-body)', fontWeight: 500, margin: '0 0 6px 0' }}>Пост не найден</p>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-label)', margin: 0 }}>Возможно, он был удалён</p>
        </div>
      )}

      {!loading && posts && posts.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {posts.map(p => (
            <div key={p.id} className="anim-fade-in">
              <PostCard
                post={p}
                onOpenComments={() => setCommentsPostId(p.id)}
                onOpenLikes={() => setLikesPostId(p.id)}
                onOpenAuthor={() => nav(`/u/${p.author_id}`)}
                onDelete={user?.id === p.author_id ? () => onDeletePost(p.id) : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {commentsPostId && (
        <CommentsSheet postId={commentsPostId} onClose={() => setCommentsPostId(null)} />
      )}

      {likesPostId && (
        <PostLikesSheet postId={likesPostId} onClose={() => setLikesPostId(null)} />
      )}
    </div>
  );
}
