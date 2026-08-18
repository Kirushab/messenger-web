// Виджет Тиндер: фото/видео + описание + лайк/дизлайк + комменты.
// Замена старой ставочной механики (tinder_bet_stakes больше не используется).
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { avatarColor, formatRelativeTime } from '@/lib/utils';
import { SkeletonWidgetCard } from '@/components/Skeleton';
import { haptic } from '@/lib/haptics';

interface Bet {
  id: string;
  conversation_id: string;
  creator_id: string;
  post_id: string;
  cover_url: string;
  cover_mime: string | null;
  status: 'active' | 'ended' | 'cancelled';
}

interface UserMini { id: string; display_name: string; avatar_url: string | null; }

interface Reaction {
  bet_id: string;
  user_id: string;
  reaction: 'like' | 'dislike';
  created_at: string;
  user?: UserMini;
}

interface Comment {
  id: string;
  bet_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: UserMini;
}

export default function TinderBetCard({ betId }: { betId: string }) {
  const { user } = useAuthStore();
  const [bet, setBet] = useState<Bet | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  // Свайп
  const [dragX, setDragX] = useState(0);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const swipeAxisRef = useRef<'x' | 'y' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Мульти-фото
  const [photos, setPhotos] = useState<{ url: string; mime: string | null }[]>([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const movedRef = useRef(false);
  const crossedRef = useRef(false);
  const [flashCommentId, setFlashCommentId] = useState<string | null>(null);

  // Загрузка данных
  const reload = async () => {
    const [{ data: b }, { data: r }, { data: c }] = await Promise.all([
      supabase.from('tinder_bets').select('*').eq('id', betId).single(),
      supabase
        .from('tinder_bet_reactions')
        .select('*, user:users(id, display_name, avatar_url)')
        .eq('bet_id', betId),
      supabase
        .from('tinder_bet_comments')
        .select('*, user:users(id, display_name, avatar_url)')
        .eq('bet_id', betId)
        .order('created_at', { ascending: true }),
    ]);
    if (b) {
      setBet(b as any);
      // Описание из связанного поста
      const { data: p } = await supabase
        .from('posts').select('caption').eq('id', (b as any).post_id).maybeSingle();
      setCaption(p?.caption || null);
      const { data: media } = await supabase
        .from('post_media').select('file_url, mime_type, position').eq('post_id', (b as any).post_id).order('position');
      const ph = (media || []).map((m: any) => ({ url: m.file_url, mime: m.mime_type }));
      setPhotos(ph.length ? ph : [{ url: (b as any).cover_url, mime: (b as any).cover_mime }]);
    }
    if (r) setReactions(r as any);
    if (c) setComments(c as any);
    setLoading(false);
  };

  useEffect(() => { setPhotoIdx(0); reload(); }, [betId]);

  // Realtime — следим за реакциями и комментами
  useEffect(() => {
    const ch = supabase.channel(`tinder-widget:${betId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tinder_bet_reactions', filter: `bet_id=eq.${betId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tinder_bet_comments',  filter: `bet_id=eq.${betId}` }, reload)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [betId]);

  // === Реакции ===
  const myReaction = user ? reactions.find(r => r.user_id === user.id)?.reaction : null;

  const setMyReaction = async (next: 'like' | 'dislike') => {
    if (!user) return;
    // Тап на текущий — снять реакцию
    if (myReaction === next) {
      await supabase.from('tinder_bet_reactions')
        .delete().eq('bet_id', betId).eq('user_id', user.id);
    } else {
      // Upsert — заменит существующую другой реакцией
      await supabase.from('tinder_bet_reactions').upsert({
        bet_id: betId, user_id: user.id, reaction: next,
      }, { onConflict: 'bet_id,user_id' });
    }
    reload();
  };

  // === Свайп (лайк/дизлайк) + листание фото тапом ===
  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    swipeAxisRef.current = null;
    movedRef.current = false;
    crossedRef.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;
    if (!swipeAxisRef.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      swipeAxisRef.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }
    if (swipeAxisRef.current !== 'x') return;
    if (e.cancelable) e.preventDefault();
    if (Math.abs(dx) > 10) movedRef.current = true;
    const past = Math.abs(dx) > 80;
    if (past && !crossedRef.current) { haptic.tap(); crossedRef.current = true; }
    else if (!past && crossedRef.current) crossedRef.current = false;
    setDragX(Math.max(-150, Math.min(150, dx)));
  };
  const onTouchEnd = () => {
    if (swipeAxisRef.current === 'x') {
      if (dragX > 80) { haptic.select(); setMyReaction('like'); }
      else if (dragX < -80) { haptic.select(); setMyReaction('dislike'); }
    }
    setDragX(0);
    startXRef.current = null;
    startYRef.current = null;
    swipeAxisRef.current = null;
    crossedRef.current = false;
  };
  const navPhoto = (clientX: number) => {
    if (movedRef.current) { movedRef.current = false; return; }
    if (photos.length <= 1) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (clientX - rect.left < rect.width / 2) setPhotoIdx(i => Math.max(0, i - 1));
    else setPhotoIdx(i => Math.min(photos.length - 1, i + 1));
  };

  // === Комменты ===
  const postComment = async () => {
    const txt = commentText.trim();
    if (!txt || !user || posting) return;
    setPosting(true);
    const { data, error } = await supabase.from('tinder_bet_comments').insert({
      bet_id: betId, user_id: user.id, content: txt,
    }).select().single();
    setPosting(false);
    if (error) {
      toast.error('Не получилось: ' + error.message);
    } else {
      setCommentText('');
      if (data?.id) { setFlashCommentId(data.id); setTimeout(() => setFlashCommentId(null), 2500); }
      haptic.tap();
      reload();
    }
  };

  const deleteComment = async (id: string) => {
    await supabase.from('tinder_bet_comments').delete().eq('id', id);
    reload();
  };

  if (loading) {
    return <SkeletonWidgetCard variant="tinder" />;
  }
  if (!bet) {
    return <div style={{padding:'14px 16px', background:'var(--surface)', borderRadius:16, fontSize: 'var(--fs-label)', color:'var(--muted)', minWidth:260}}>Виджет не найден</div>;
  }

  const cur = photos[photoIdx] || { url: bet.cover_url, mime: bet.cover_mime };
  const isVideo = (cur.mime || '').startsWith('video');
  const visibleComments = showAllComments ? comments : comments.slice(-2);

  return (
    <div
      ref={cardRef}
      style={{
        position:'relative', width: 272, boxSizing:'border-box',
        background:'var(--surface-2)', border:'1px solid var(--border)',
        borderRadius: 16, overflow:'hidden',
        boxShadow:'var(--shadow-card)',
      }}
    >
      {/* Обложка — свайп лайк/дизлайк, тап по краям — листать фото */}
      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
        onClick={(e) => navPhoto(e.clientX)}
        style={{
          position:'relative', aspectRatio:'4/5', background:'#000',
          touchAction:'none', overscrollBehavior:'contain', userSelect:'none', WebkitUserSelect:'none',
          transform: `translateX(${dragX}px) rotate(${dragX * 0.045}deg)`,
          transition: dragX === 0 ? 'transform 200ms ease' : undefined,
        }}
      >
        {isVideo
          ? <video key={photoIdx} src={cur.url} muted playsInline loop autoPlay className="tb-photo" style={{width:'100%',height:'100%',objectFit:'cover'}} />
          : <img key={photoIdx} src={cur.url} alt="" className="tb-photo" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />}

        {/* Индикатор фото */}
        {photos.length > 1 && (
          <div style={{position:'absolute', top:8, left:0, right:0, display:'flex', justifyContent:'center', gap:4, padding:'0 10px'}}>
            {photos.map((_, i) => (
              <div key={i} style={{
                flex:'1 1 0', maxWidth:42, height:3, borderRadius:2,
                background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.4)',
                transition:'background .2s',
              }} />
            ))}
          </div>
        )}

        {/* Свайп-подсказка: SVG-иконки вместо текстовых LIKE / NOPE */}
        {dragX > 30 && (
          <div style={{
            position:'absolute', top:16, left:16,
            width:58, height:58, borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(255,255,255,0.93)', color:'#FF0000',
            border:'2px solid rgba(255,255,255,0.96)',
            boxShadow:'0 8px 24px rgba(0,0,0,0.24)',
            WebkitBackdropFilter:'blur(12px)', backdropFilter:'blur(12px)',
            transform:`rotate(-10deg) scale(${Math.min(1.14, 0.78 + Math.abs(dragX)/170)})`,
            opacity: Math.min(1, dragX/92), pointerEvents:'none',
          }}>
            <svg width="31" height="31" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 21 10.55 19.68C5.4 15 2 11.91 2 8.12 2 5.03 4.42 2.62 7.5 2.62c1.74 0 3.41.81 4.5 2.08a5.97 5.97 0 0 1 4.5-2.08C19.58 2.62 22 5.03 22 8.12c0 3.79-3.4 6.88-8.55 11.56L12 21Z"/>
            </svg>
          </div>
        )}
        {dragX < -30 && (
          <div style={{
            position:'absolute', top:16, right:16,
            width:58, height:58, borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(255,255,255,0.93)', color:'#000000',
            border:'2px solid rgba(255,255,255,0.96)',
            boxShadow:'0 8px 24px rgba(0,0,0,0.24)',
            WebkitBackdropFilter:'blur(12px)', backdropFilter:'blur(12px)',
            transform:`rotate(10deg) scale(${Math.min(1.14, 0.78 + Math.abs(dragX)/170)})`,
            opacity: Math.min(1, Math.abs(dragX)/92), pointerEvents:'none',
          }}>
            <svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </div>
        )}
      </div>

      {/* Описание */}
      {caption && (
        <div style={{padding:'9px 12px 2px', fontSize: 'var(--fs-label)', color:'var(--text)', lineHeight:1.32}}>
          {caption}
        </div>
      )}

      {/* Реакции ставятся только свайпами по карточке */}

      {/* Комментарии */}
      <div style={{borderTop:'1px solid var(--border)', padding:'8px 12px 10px'}}>
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)',
          textTransform:'uppercase', letterSpacing:0.3, marginBottom:6,
        }}>
          <span>Комментарии {comments.length > 0 && `· ${comments.length}`}</span>
          {comments.length > 2 && (
            <button onClick={() => setShowAllComments(s => !s)} style={{
              background:'transparent', border:'none', cursor:'pointer',
              color:'var(--accent)', fontSize: 'var(--fs-micro)', fontWeight:600,
              textTransform:'uppercase', letterSpacing:0.3, padding:0,
            }}>
              {showAllComments ? 'Свернуть' : `Все (${comments.length})`}
            </button>
          )}
        </div>

        {comments.length === 0 && (
          <div style={{padding:'7px 0', textAlign:'center', color:'var(--muted)', fontSize: 'var(--fs-caption)'}}>
            Пока без комментов
          </div>
        )}

        {visibleComments.map(c => (
          <div key={c.id} className={'tb-comment' + (c.id === flashCommentId ? ' tb-flash' : '')} style={{display:'flex', gap:8, marginBottom:8, alignItems:'flex-start', borderRadius:8}}>
            {c.user?.avatar_url ? (
              <img src={c.user.avatar_url} alt="" style={{
                width:24, height:24, borderRadius:12, objectFit:'cover', flexShrink:0, marginTop:2,
              }} />
            ) : (
              <div style={{
                width:24, height:24, borderRadius:12, background: avatarColor(c.user_id),
                color:'#fff', fontSize: 'var(--fs-micro)', fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2,
              }}>{(c.user?.display_name || '?')[0].toUpperCase()}</div>
            )}
            <div style={{flex:1, minWidth:0}}>
              <div style={{display:'flex', alignItems:'baseline', gap:6, flexWrap:'wrap'}}>
                <span style={{fontSize: 'var(--fs-caption)', fontWeight:600, color:'var(--text)'}}>
                  {c.user?.display_name || '—'}
                </span>
                <span style={{fontSize: 'var(--fs-snap10)', color:'var(--muted)'}}>
                  {formatRelativeTime(c.created_at)}
                </span>
              </div>
              <div style={{fontSize: 'var(--fs-label)', color:'var(--text)', lineHeight:1.35, marginTop:1, wordBreak:'break-word'}}>
                {c.content}
              </div>
            </div>
            {c.user_id === user?.id && (
              <button onClick={() => deleteComment(c.id)} aria-label="Удалить" style={{
                background:'transparent', border:'none', cursor:'pointer',
                color:'var(--muted)', padding:2, marginTop:2, flexShrink:0,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        ))}

        {/* Поле ввода */}
        {user && (
          <div style={{display:'flex', gap:6, alignItems:'center', marginTop:8}}>
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); postComment(); } }}
              placeholder="Написать..."
              maxLength={2000}
              style={{
                flex:1, padding:'8px 12px', borderRadius: 18,
                background:'var(--surface-light)', border:'1px solid var(--border)',
                color:'var(--text)', fontSize: 'var(--fs-label)', outline:'none', boxSizing:'border-box',
              }}
            />
            <button
              onClick={postComment}
              disabled={!commentText.trim() || posting}
              aria-label="Отправить"
              style={{
                width:32, height:32, borderRadius:16,
                background: commentText.trim() ? 'var(--accent)' : 'var(--border)',
                color: commentText.trim() ? 'var(--bg)' : 'var(--muted)',
                border:'none', flexShrink:0, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
