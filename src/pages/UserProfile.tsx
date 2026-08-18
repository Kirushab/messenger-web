import { useEffect, useState } from 'react';
import { goBack } from '@/lib/nav';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { usePostStore } from '@/stores/postStore';
import { useChatStore } from '@/stores/chatStore';
import { avatarColor } from '@/lib/utils';
import type { User, PostWithDetails } from '@/types';
import AnimatedNumber from '@/components/AnimatedNumber';
import PhotoZoom from '@/components/PhotoZoom';
import { Skeleton, SkeletonPostGrid } from '@/components/Skeleton';
import ProfileStories from '@/components/ProfileStories';

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user: me } = useAuthStore();
  const { fetchUserPosts, deletePost } = usePostStore();
  const { createDirectChat } = useChatStore();
  const nav = useNavigate();
  const isMe = me?.id === userId;

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [avatarZoom, setAvatarZoom] = useState<{ rect: DOMRect; url: string } | null>(null);

  // Определяем онлайн ли юзер: last_seen за последние 60с
  const isOnline = (() => {
    const ls = (profile as any)?.last_seen;
    if (!ls) return false;
    const diff = Date.now() - new Date(ls).getTime();
    return diff < 60000;
  })();

  // Проверяем — день рождения сегодня?
  const isBirthdayToday = (() => {
    const bd = (profile as any)?.birthday;
    if (!bd) return false;
    const today = new Date();
    const bdate = new Date(bd + 'T00:00:00');
    return today.getMonth() === bdate.getMonth() && today.getDate() === bdate.getDate();
  })();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: u }, ps] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        fetchUserPosts(userId),
      ]);
      if (cancelled) return;
      setProfile((u as User) || null);
      setPosts(ps);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const writeMessage = async () => {
    if (!me || !userId) return;
    const { id, error } = await createDirectChat(me.id, userId);
    if (!error && id) nav(`/chat/${id}`);
  };

  const onDeletePost = async (postId: string) => {
    if (!confirm('Удалить пост?')) return;
    const { error } = await deletePost(postId);
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postId));
      setPreviewIdx(null);
    } else {
      toast.error('Ошибка: ' + error);
    }
  };

  if (loading) {
    return (
      <div style={{minHeight:'100dvh',background:'var(--bg)'}}>
        <header style={{display:'flex',alignItems:'center',gap:8,padding:'12px 16px',paddingTop:'max(12px, env(safe-area-inset-top, 12px))',borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>
          <button onClick={() => goBack(nav, '/chats')} style={{background:'none',border:'none',color:'var(--text)',fontSize:'var(--fs-snap24)',cursor:'pointer',padding:4,lineHeight:1}}>‹</button>
          <Skeleton width={140} height={18} />
        </header>
        <div style={{padding:'24px 16px',textAlign:'center'}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:14}}><Skeleton width={96} height={96} rounded={48} /></div>
          <div style={{display:'flex',justifyContent:'center',marginBottom:10}}><Skeleton width={160} height={20} /></div>
          <div style={{display:'flex',justifyContent:'center',gap:28,marginTop:18}}>
            <Skeleton width={48} height={40} /><Skeleton width={48} height={40} /><Skeleton width={48} height={40} />
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:10,marginTop:18}}>
            <Skeleton width={120} height={38} rounded={10} /><Skeleton width={120} height={38} rounded={10} />
          </div>
        </div>
        <SkeletonPostGrid count={9} />
      </div>
    );
  }
  if (!profile) {
    return <div style={{padding:32,textAlign:'center',color:'var(--muted)'}}>Пользователь не найден</div>;
  }

  return (
    <div style={{minHeight:'100dvh',background:'var(--bg)'}}>
      <header style={{display:'flex',alignItems:'center',gap:8,padding:'12px 16px',paddingTop:'max(12px, env(safe-area-inset-top, 12px))',borderBottom:'1px solid var(--border)',background:'var(--surface)',position:'sticky',top:0,zIndex:10}}>
        <button onClick={() => goBack(nav, '/chats')} style={{background:'none',border:'none',color:'var(--text)',fontSize: 'var(--fs-snap24)',cursor:'pointer',padding:4,lineHeight:1}}>‹</button>
        <h2 style={{margin:0,fontSize: 'var(--fs-heading)',fontWeight:600,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile.display_name}</h2>
        {isMe && (
          <button
            onClick={() => nav('/feed/new')}
            style={{background:'none',border:'none',color:'var(--primary)',cursor:'pointer',padding:4,display:'flex',alignItems:'center'}}
            title="Новый пост"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        )}
      </header>

      {/* Profile info */}
      <div style={{padding:'24px 16px',textAlign:'center'}}>
        <div style={{display:'inline-block', position:'relative', marginBottom:12, padding:3, border:'1.5px solid var(--border)', borderRadius:'50%'}}>
          {profile.avatar_url
            ? <img
                src={profile.avatar_url}
                alt=""
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setAvatarZoom({ rect, url: profile.avatar_url! });
                }}
                style={{width:96,height:96,borderRadius:48,objectFit:'cover',cursor:'pointer',display:'block'}}
              />
            : profile.email === 'tinder@sigmas.local'
              ? <div style={{
                  width:96,height:96,borderRadius:48,
                  background:'linear-gradient(135deg,#FF6B6B,#FE5268 50%,#FF3A6E)',
                  color:'#fff',
                  display:'inline-flex',alignItems:'center',justifyContent:'center',
                  boxShadow:'0 10px 28px rgba(254,82,104,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
                }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="#fff">
                    <path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14a8 8 0 1 0 16 0c0-4.16-2-7.88-6.5-13.33zM11.71 19a3.27 3.27 0 0 1-3.29-3.19c0-1.71 1.11-2.92 2.97-3.3 1.85-.38 3.79-1.26 4.87-2.7.42 1.39.63 2.85.63 4.32 0 2.69-2.19 4.87-4.88 4.87z"/>
                  </svg>
                </div>
              : <div style={{width:96,height:96,borderRadius:48,background:avatarColor(profile.display_name),color:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:36,fontWeight:600}}>{profile.display_name.charAt(0).toUpperCase()}</div>}
          {isOnline && (
            <div className="avatar-online-ring" style={{
              position:'absolute', inset:0,
              borderRadius:48, pointerEvents:'none',
            }} />
          )}
          {isOnline && (
            <div className="friend-status-fade" style={{
              position:'absolute', bottom:2, right:2,
              width:18, height:18, borderRadius:9,
              background:'var(--success)',
              border:'3px solid var(--bg)',
            }} />
          )}
        </div>
        <h1 style={{margin:'0 0 4px 0',fontSize: 'var(--fs-title)',fontWeight:700,letterSpacing:'-0.3px'}}>{profile.display_name}</h1>
        {profile.bio && <p style={{margin:'0 0 16px 0',fontSize: 'var(--fs-snap14)',color:'var(--muted)',padding:'0 24px'}}>{profile.bio}</p>}
        {(profile as any).birthday && (profile as any).birthday_visible !== false && (
          <p style={{margin:'0 0 16px 0',fontSize: 'var(--fs-label)',color:'var(--muted)'}}>
            <span className={isBirthdayToday ? 'birthday-badge-breath' : ''} style={{display:'inline-flex', verticalAlign:'-3px', marginRight:2}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3.5c.9 1 .9 2 0 2.6-.9-.6-.9-1.6 0-2.6z" fill="#F59E0B" stroke="none" />
                <line x1="12" y1="6.5" x2="12" y2="10" />
                <path d="M5 14v-1.5a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 12.5V14" />
                <path d="M5 14c1.2 0 1.2 1.3 2.3 1.3S8.8 14 10 14s1.2 1.3 2.3 1.3S13.8 14 15 14s1.2 1.3 2.3 1.3S18 14 19 14" />
                <path d="M5 14.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5.2" />
                <path d="M3.5 21h17" />
              </svg>
            </span> {new Date((profile as any).birthday + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'long' })}
            {isBirthdayToday && <span style={{marginLeft:8, fontWeight:600, color:'#F59E0B'}}>· сегодня!</span>}
          </p>
        )}
        {!isMe && (
          <button
            onClick={writeMessage}
            style={{padding:'10px 24px',background:'var(--primary)',color:'var(--bg)',border:'none',borderRadius:20,fontSize: 'var(--fs-snap14)',fontWeight:600,cursor:'pointer'}}
          >Написать сообщение</button>
        )}
      </div>

      {/* Stats */}
      <div style={{display:'flex',justifyContent:'center',gap:32,padding:'4px 16px 16px',borderBottom:'1px solid var(--border)'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize: 'var(--fs-heading)',fontWeight:700}}><AnimatedNumber value={posts.length} duration={650} /></div>
          <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)'}}>{declOfNum(posts.length, ['пост','поста','постов'])}</div>
        </div>
      </div>

      <ProfileStories profile={profile} isOwner={isMe} />

      {/* Grid */}
      {(() => {
        const displayPosts = posts;

        if (displayPosts.length === 0) {
          return (
            <div style={{padding:'48px 16px',textAlign:'center',color:'var(--muted)'}}>
              {isMe ? 'У вас пока нет постов' : 'Пока нет постов'}
            </div>
          );
        }

        return (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:2}}>
            {displayPosts.map((p, i) => {
              const cover = p.media[0];
              if (!cover) return null;
              const isVideo = cover.mime_type.startsWith('video/');
              const origIdx = posts.indexOf(p);
              return (
                <div
                  key={p.id}
                  onClick={() => nav('/p/' + p.id)}
                  style={{position:'relative',aspectRatio:'1/1',background:'var(--surface)',cursor:'pointer'}}
                >
                  {isVideo
                    ? <video src={cover.file_url} poster={cover.preview_url || undefined} muted playsInline preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    : <img src={cover.file_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />}
                  {p.media.length > 1 && (
                    <span style={{position:'absolute',top:6,right:6,padding:'2px 6px',borderRadius:6,background:'rgba(0,0,0,0.5)',color:'#fff',fontSize: 'var(--fs-snap10)',display:'flex',alignItems:'center',gap:3}}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="14" height="14" rx="2"/><rect x="8" y="8" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                      {p.media.length}
                    </span>
                  )}
                  {isVideo && (
                    <span style={{position:'absolute',bottom:6,right:6,color:'#fff'}}>
                      <svg width='14' height='14' viewBox='0 0 24 24' fill='currentColor'><polygon points='5,3 19,12 5,21'/></svg>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {previewIdx !== null && posts[previewIdx] && (
        <PostPreview
          post={posts[previewIdx]}
          isMe={isMe}
          onClose={() => setPreviewIdx(null)}
          onDelete={() => onDeletePost(posts[previewIdx].id)}
        />
      )}

      {avatarZoom && (
        <PhotoZoom
          src={avatarZoom.url}
          fromRect={avatarZoom.rect}
          onClose={() => setAvatarZoom(null)}
        />
      )}
    </div>
  );
}

function declOfNum(n: number, words: [string, string, string]): string {
  const cases = [2, 0, 1, 1, 1, 2];
  return words[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[(n % 10 < 5) ? n % 10 : 5]];
}

function PostPreview({ post, isMe, onClose, onDelete }: { post: PostWithDetails; isMe: boolean; onClose: () => void; onDelete: () => void }) {
  const [mediaIdx, setMediaIdx] = useState(0);
  const cur = post.media[mediaIdx];
  return createPortal(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.97)',zIndex:1000,display:'flex',flexDirection:'column'}}>
      <header style={{
        display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'10px 16px 10px',
        paddingTop:'max(14px, calc(env(safe-area-inset-top, 14px) + 8px))',
        color:'#fff',
        background:'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)',
      }}>
        <button onClick={onClose} aria-label="Закрыть" style={{
          width:36, height:36, borderRadius:18,
          background:'rgba(0,0,0,0.5)', border:'none', color:'#fff',
          cursor:'pointer', padding:0,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        {post.media.length > 1 && (
          <span style={{
            fontSize: 'var(--fs-label)', fontWeight:600,
            padding:'5px 12px', borderRadius:12,
            background:'rgba(0,0,0,0.5)',
          }}>{mediaIdx + 1}/{post.media.length}</span>
        )}
        {isMe ? (
          <button onClick={onDelete} aria-label="Удалить" style={{
            width:36, height:36, borderRadius:18,
            background:'rgba(0,0,0,0.5)', border:'none', color:'#ff4444',
            cursor:'pointer', padding:0,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        ) : <span style={{width:36}} />}
      </header>

      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',minHeight:0}}>
        {cur && (cur.mime_type.startsWith('video/')
          ? <video src={cur.file_url} poster={cur.preview_url || undefined} controls autoPlay playsInline preload="auto" style={{maxWidth:'100%',maxHeight:'100%'}} />
          : <img src={cur.file_url} alt="" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}} />)}
        {mediaIdx > 0 && (
          <button
            onClick={() => setMediaIdx(i => i - 1)}
            style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',width:40,height:40,borderRadius:20,background:'rgba(0,0,0,0.5)',border:'none',color:'#fff',cursor:'pointer',fontSize: 'var(--fs-title)',padding:0,lineHeight:1}}
          >‹</button>
        )}
        {mediaIdx < post.media.length - 1 && (
          <button
            onClick={() => setMediaIdx(i => i + 1)}
            style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',width:40,height:40,borderRadius:20,background:'rgba(0,0,0,0.5)',border:'none',color:'#fff',cursor:'pointer',fontSize: 'var(--fs-title)',padding:0,lineHeight:1}}
          >›</button>
        )}
      </div>

      {post.caption && (
        <div style={{padding:'14px 20px',color:'#fff',fontSize: 'var(--fs-snap14)',maxHeight:'30vh',overflowY:'auto',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
          {post.caption}
        </div>
      )}
    </div>,
    document.body
  );
}
