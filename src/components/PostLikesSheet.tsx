import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { avatarColor } from '@/lib/utils';
import type { User } from '@/types';

type LikeRow = {
  user: User;
  createdAt: string;
};

export default function PostLikesSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const nav = useNavigate();
  const [rows, setRows] = useState<LikeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data: likes, error } = await supabase
        .from('post_likes')
        .select('user_id,created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error || !likes?.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      const ids = [...new Set(likes.map((like: any) => like.user_id).filter(Boolean))];
      const { data: users } = await supabase.from('users').select('*').in('id', ids);
      if (cancelled) return;

      const byId = new Map((users || []).map((user: any) => [user.id, user as User]));
      setRows(likes.flatMap((like: any) => {
        const user = byId.get(like.user_id);
        return user ? [{ user, createdAt: like.created_at }] : [];
      }));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [postId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="post-likes-overlay" onClick={onClose}>
      <section className="post-likes-sheet" onClick={event => event.stopPropagation()} aria-label="Кому нравится публикация">
        <div className="post-likes-grip" />
        <header className="post-likes-header">
          <div>
            <h2>Отметки «Нравится»</h2>
            {!loading && <span>{rows.length}</span>}
          </div>
          <button onClick={onClose} aria-label="Закрыть">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div className="post-likes-list">
          {loading ? (
            <div className="post-likes-state"><div className="spinner" /></div>
          ) : rows.length === 0 ? (
            <div className="post-likes-state">Пока нет отметок «Нравится»</div>
          ) : rows.map(({ user }) => (
            <button
              key={user.id}
              className="post-like-user"
              onClick={() => {
                onClose();
                nav(`/u/${user.id}`);
              }}
            >
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" />
                : <span style={{ background: avatarColor(user.id) }}>{(user.display_name || '?')[0].toUpperCase()}</span>}
              <div>
                <b>{user.display_name || 'Пользователь'}</b>
                <small>{user.email || 'Профиль Sigmas'}</small>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
