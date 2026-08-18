import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePostStore } from '@/stores/postStore';
import { supabase } from '@/lib/supabase';
import { avatarColor } from '@/lib/utils';
import { snackbar, toast } from '@/stores/toastStore';
import type { PostCommentWithAuthor, User } from '@/types';

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return 'только что';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} мин`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ч`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)} д`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

export default function CommentsSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { user } = useAuthStore();
  const { fetchComments, addComment, deleteComment } = usePostStore();

  const [comments, setComments] = useState<PostCommentWithAuthor[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // K1 — свайп вниз для закрытия
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(0);
  const onGrabDown = (e: React.PointerEvent) => { setDragging(true); dragStartY.current = e.clientY; };
  const onGrabMove = (e: React.PointerEvent) => { if (!dragging) return; setDragY(Math.max(0, e.clientY - dragStartY.current)); };
  const onGrabUp = () => { setDragging(false); if (dragY > 100) onClose(); else setDragY(0); };
  // K2 — подсветка нового комментария
  const [flashId, setFlashId] = useState<string | null>(null);
  const prevLenRef = useRef(0);

  // Загрузка
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const cs = await fetchComments(postId);
      if (cancelled) return;
      setComments(cs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [postId]);

  // Realtime: подписка на новые/удалённые комменты
  useEffect(() => {
    const ch = supabase
      .channel(`comments_${postId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        async (payload: any) => {
          const newComment = payload.new;
          // Подтягиваем автора
          const { data: author } = await supabase.from('users').select('*').eq('id', newComment.author_id).single();
          if (!author) return;
          setComments(prev => {
            // Защита от дубля при оптимистичной вставке
            if (prev.some(c => c.id === newComment.id)) return prev;
            return [...prev, { ...newComment, author: author as User }];
          });
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        (payload: any) => {
          setComments(prev => prev.filter(c => c.id !== payload.old.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId]);

  // Автоскролл вниз при добавлении комментариев
  useEffect(() => {
    if (!listRef.current || loading) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments.length, loading]);

  // K2 — подсветка только что добавленного комментария
  useEffect(() => {
    if (!loading && comments.length > prevLenRef.current && comments.length > 0) {
      const last = comments[comments.length - 1];
      setFlashId(last.id);
      const t = setTimeout(() => setFlashId(null), 1300);
      prevLenRef.current = comments.length;
      return () => clearTimeout(t);
    }
    prevLenRef.current = comments.length;
  }, [comments.length, loading]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleSend = async () => {
    if (!user || !text.trim() || sending) return;
    const t = text.trim();
    setSending(true);
    setText('');
    const { error } = await addComment(postId, user.id, t);
    setSending(false);
    if (error) {
      toast.error('Не удалось отправить: ' + error);
      setText(t);
    }
    // Re-focus поля для следующего коммента
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleDelete = async (commentId: string) => {
    // Optimistic: убираем из UI сразу, показываем snackbar с undo
    const removed = comments.find(c => c.id === commentId);
    if (!removed) return;
    setComments(prev => prev.filter(c => c.id !== commentId));

    let undone = false;
    snackbar.show('Комментарий удалён', {
      actionLabel: 'Отменить',
      onAction: () => {
        undone = true;
        // Возвращаем в правильное место по created_at
        setComments(prev => {
          const arr = [...prev, removed];
          arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return arr;
        });
      },
      duration: 4500,
      type: 'info',
    });

    // Реально удаляем с сервера через 4.5с — если не отменили
    setTimeout(async () => {
      if (undone) return;
      await deleteComment(commentId, postId);
    }, 4500);
  };

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.5)',
        display:'flex', alignItems:'flex-end', animation:'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:'100%', maxHeight:'85dvh', background:'var(--surface)',
          borderRadius:'16px 16px 0 0', display:'flex', flexDirection:'column',
          paddingBottom:'env(safe-area-inset-bottom, 0)', animation:'slideUp 0.25s ease',
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : 'transform .28s cubic-bezier(0.16,1,0.3,1)',
          overflow:'hidden',
        }}
      >
        {/* Drag handle */}
        <div onPointerDown={onGrabDown} onPointerMove={onGrabMove} onPointerUp={onGrabUp} onPointerCancel={onGrabUp} style={{display:'flex',justifyContent:'center',padding:'8px 0 10px',cursor:'grab',touchAction:'none'}}>
          <div style={{width:36,height:4,borderRadius:2,background:'var(--border)'}} />
        </div>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 16px 12px',borderBottom:'1px solid var(--border)'}}>
          <h3 style={{margin:0,fontSize: 'var(--fs-snap16)',fontWeight:600}}>
            Комментарии {comments.length > 0 && <span style={{color:'var(--muted)',fontWeight:400,fontSize: 'var(--fs-snap14)'}}>({comments.length})</span>}
          </h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text)',fontSize: 'var(--fs-title)',cursor:'pointer',padding:4,lineHeight:1}}>✕</button>
        </div>

        {/* Scrollable list */}
        <div ref={listRef} style={{flex:1,overflowY:'auto',padding:'8px 0',minHeight:200}}>
          {loading
            ? <div style={{padding:32,display:'flex',justifyContent:'center'}}><div className="spinner" /></div>
            : comments.length === 0
              ? <div style={{padding:'32px 24px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-snap14)'}}>Будь первым, кто оставит комментарий</div>
              : comments.map(c => (
                  <CommentRow
                    key={c.id}
                    c={c}
                    flash={c.id === flashId}
                    canDelete={c.author_id === user?.id}
                    onDelete={() => handleDelete(c.id)}
                  />
                ))}
        </div>

        {/* Input */}
        {user && (
          <div style={{padding:'10px 12px',borderTop:'1px solid var(--border)',display:'flex',gap:8,alignItems:'flex-end'}}>
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value.slice(0, 500))}
              onKeyDown={onTextareaKeyDown}
              placeholder="Написать комментарий..."
              disabled={sending}
              rows={1}
              className="comment-input"
              style={{
                flex:1, resize:'none', padding:'10px 14px',
                background:'var(--surface-light)', color:'var(--text)',
                borderRadius:18,
                fontSize: 'var(--fs-snap14)', fontFamily:'inherit', outline:'none',
                maxHeight:120, lineHeight:1.4,
              }}
            />
            {(text.trim().length > 0 || sending) && (
              <button
                onClick={handleSend}
                disabled={sending || !text.trim()}
                className="comment-send-in"
                style={{
                  background: !sending ? 'var(--primary)' : 'var(--surface-light)',
                  color: !sending ? 'var(--bg)' : 'var(--muted)',
                  border:'none', borderRadius:18, padding:'0 16px', height:38,
                  fontSize: 'var(--fs-snap14)', fontWeight:600, cursor: sending ? 'default' : 'pointer',
                  flexShrink:0,
                }}
              >Отпр.</button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  );
}

function CommentRow({ c, canDelete, onDelete, flash }: {
  c: PostCommentWithAuthor;
  canDelete: boolean;
  onDelete: () => void;
  flash?: boolean;
}) {
  const author = c.author;
  return (
    <div className={'anim-fade-in' + (flash ? ' comment-flash' : '')} style={{display:'flex',gap:10,padding:'8px 14px'}}>
      {author?.avatar_url
        ? <img src={author.avatar_url} alt="" style={{width:32,height:32,borderRadius:16,objectFit:'cover',flexShrink:0}} />
        : <div style={{width:32,height:32,borderRadius:16,background:avatarColor(author?.id || 'x'),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-label)',fontWeight:600,flexShrink:0}}>{(author?.display_name || '?')[0].toUpperCase()}</div>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize: 'var(--fs-label)',lineHeight:1.4,color:'var(--text)',wordBreak:'break-word'}}>
          <span style={{fontWeight:600,marginRight:6}}>{author?.display_name || 'Пользователь'}</span>
          {c.text}
        </div>
        <div style={{display:'flex',gap:12,marginTop:3,alignItems:'center'}}>
          <span style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>{fmtTime(c.created_at)}</span>
          {canDelete && (
            <button
              onClick={onDelete}
              style={{background:'none',border:'none',color:'var(--muted)',fontSize: 'var(--fs-micro)',cursor:'pointer',padding:0}}
            >Удалить</button>
          )}
        </div>
      </div>
    </div>
  );
}
