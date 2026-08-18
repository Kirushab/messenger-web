import { useEffect, useState } from 'react';
import { goBack } from '@/lib/nav';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { usePlaylistStore, CATEGORY_META, type Playlist, type PlaylistCategory } from '@/stores/playlistStore';
import { GlyphIcon } from '@/components/icons/AppGlyph';

export default function PlaylistView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { getById, updatePlaylist, deletePlaylist } = usePlaylistStore();

  const fromStore = id ? getById(id) : undefined;
  const [playlist, setPlaylist] = useState<Playlist | null>(fromStore || null);
  const [loading, setLoading] = useState(!fromStore);
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);

  // Если в стор не загружен — подгружаем напрямую
  useEffect(() => {
    if (!id || playlist) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('playlists')
        .select(`
          id, owner_id, title, description, category, spotify_url, spotify_id,
          cover_url, archived, created_at, updated_at,
          owner:users (id, display_name, avatar_url)
        `)
        .eq('id', id)
        .single();
      if (!error && data) setPlaylist(data as any);
      setLoading(false);
    })();
  }, [id]);

  // Синхронизируем с обновлениями в сторе
  useEffect(() => {
    if (fromStore) setPlaylist(fromStore);
  }, [fromStore?.title, fromStore?.description, fromStore?.category, fromStore?.cover_url, fromStore?.archived]);

  if (loading) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}>
        <div className="spinner" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
        <div className="page-header" style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={() => goBack(nav, '/profile')} style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6,marginLeft:-6,fontSize: 'var(--fs-title)',lineHeight:1}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <h1 style={{fontSize: 'var(--fs-title)',textTransform:'none',letterSpacing:0}}>Плейлист</h1>
        </div>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)'}}>
          Плейлист не найден или был удалён
        </div>
      </div>
    );
  }

  const meta = CATEGORY_META[playlist.category] || CATEGORY_META.other;
  const isMine = myId === playlist.owner_id;

  const handleDelete = async () => {
    if (!confirm('Удалить плейлист? Действие необратимо. Сам плейлист в Spotify останется.')) return;
    await deletePlaylist(playlist.id);
    nav('/music', { replace: true });
  };

  const handleArchive = async () => {
    await updatePlaylist(playlist.id, { archived: !playlist.archived });
    setShowMenu(false);
  };

  const handleOpenInSpotify = () => {
    window.open(playlist.spotify_url, '_blank', 'noopener');
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,paddingBottom:8}}>
        <button
          onClick={() => goBack(nav, '/profile')}
          style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6,marginLeft:-6,fontSize: 'var(--fs-snap24)',lineHeight:1}}
          aria-label="Назад"
        ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h1 style={{flex:1, fontSize: 'var(--fs-heading)', textTransform:'none', letterSpacing:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
          {playlist.title}
        </h1>
        {isMine && (
          <button
            onClick={() => setShowMenu(true)}
            style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6,fontSize: 'var(--fs-title)'}}
            aria-label="Меню"
          ><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg></button>
        )}
      </div>

      <div className="page-scroll" style={{padding:'8px 16px 32px'}}>
        {/* Cover hero */}
        <div style={{
          width:'100%',
          aspectRatio:'1/1',
          maxWidth:340,
          margin:'0 auto 16px',
          borderRadius:18,
          background: playlist.cover_url ? 'var(--surface)' : meta.gradient,
          position:'relative',
          overflow:'hidden',
          boxShadow:'0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {playlist.cover_url ? (
            <img src={playlist.cover_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}><GlyphIcon name={meta.icon} size={128} strokeWidth={1.3} /></div>
          )}
          {playlist.archived && (
            <span style={{
              position:'absolute',top:12,right:12,
              fontSize: 'var(--fs-micro)',fontWeight:600,color:'#fff',
              background:'rgba(0,0,0,0.7)',
              padding:'4px 10px',
              borderRadius:10,
              letterSpacing:0.5,
            }}>В АРХИВЕ</span>
          )}
        </div>

        {/* Meta */}
        <div style={{textAlign:'center', marginBottom:16}}>
          <div style={{fontSize: 'var(--fs-label)', color:'var(--muted)', marginBottom:6}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:6,justifyContent:'center'}}><GlyphIcon name={meta.icon} size={14} /> {meta.label} · {playlist.owner?.display_name || 'Аноним'}</span>
          </div>
          {playlist.description && (
            <p style={{fontSize: 'var(--fs-snap14)', color:'var(--text)', lineHeight:1.4, margin:'8px 0 0'}}>
              {playlist.description}
            </p>
          )}
        </div>

        {/* Spotify embed player */}
        {playlist.spotify_id && (
          <div style={{marginBottom:16}}>
            <iframe
              src={`https://open.spotify.com/embed/playlist/${playlist.spotify_id}?utm_source=generator&theme=0`}
              width="100%"
              height="380"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{borderRadius:12, display:'block'}}
              title={playlist.title}
            />
          </div>
        )}

        <button
          onClick={handleOpenInSpotify}
          style={{
            width:'100%',
            padding:'12px',
            background:'#1DB954',
            color:'#fff',
            border:'none',
            borderRadius:10,
            fontSize: 'var(--fs-snap14)',
            fontWeight:600,
            cursor:'pointer',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            gap:8,
            marginBottom:8,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.27 14.45a.62.62 0 01-.86.21c-2.36-1.44-5.33-1.77-8.83-.97a.62.62 0 11-.28-1.22c3.83-.87 7.11-.5 9.76 1.12.3.18.39.57.21.86zm1.14-2.54a.78.78 0 01-1.07.26c-2.7-1.66-6.82-2.14-10.02-1.17a.78.78 0 11-.45-1.49c3.65-1.11 8.18-.57 11.28 1.33.36.22.48.7.26 1.07zm.1-2.65C14.27 9.34 8.93 9.13 5.84 10.06a.94.94 0 11-.55-1.79c3.55-1.07 9.46-.83 13.18 1.38.45.27.6.85.33 1.29-.27.45-.85.6-1.29.32z"/></svg>
          Открыть в Spotify
        </button>

        <div style={{
          fontSize: 'var(--fs-caption)',
          color:'var(--muted)',
          textAlign:'center',
          marginTop:12,
          padding:'10px 16px',
          background:'var(--surface-light)',
          borderRadius:8,
          lineHeight:1.5,
        }}>
          Чтобы добавить трек — открой плейлист в Spotify и кинь туда любой трек. Все участники с ссылкой могут добавлять, удалять и переупорядочивать.
        </div>
      </div>

      {/* Menu sheet (только для владельца) */}
      {showMenu && isMine && (
        <div
          onClick={() => setShowMenu(false)}
          style={{
            position:'fixed',inset:0,zIndex:50,
            background:'rgba(0,0,0,0.5)',
            display:'flex',alignItems:'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width:'100%',
              background:'var(--surface)',
              borderRadius:'16px 16px 0 0',
              padding:'12px 0 max(20px, env(safe-area-inset-bottom, 20px))',
            }}
          >
            <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
              <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
            </div>

            <SheetItem label="Редактировать" onClick={() => { setShowMenu(false); setEditing(true); }} />
            <SheetItem
              label={playlist.archived ? 'Вернуть из архива' : 'В архив'}
              onClick={handleArchive}
            />
            <SheetItem label="Удалить плейлист" onClick={handleDelete} danger />

            <div style={{padding:'8px 16px 0'}}>
              <button onClick={() => setShowMenu(false)} style={{width:'100%',padding:'12px',background:'var(--surface-light)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)',fontSize: 'var(--fs-snap14)',fontWeight:500,cursor:'pointer'}}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {editing && playlist && (
        <EditSheet
          playlist={playlist}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            await updatePlaylist(playlist.id, patch);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function SheetItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      width:'100%',padding:'14px 16px',background:'none',border:'none',
      borderBottom:'1px solid var(--border)',
      textAlign:'left',
      color: danger ? '#EF4444' : 'var(--text)',
      fontSize: 'var(--fs-body)',cursor:'pointer',
    }}>{label}</button>
  );
}

function EditSheet({ playlist, onClose, onSave }: {
  playlist: Playlist;
  onClose: () => void;
  onSave: (patch: { title: string; description: string | null; category: PlaylistCategory; cover_url: string | null }) => void;
}) {
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description || '');
  const [category, setCategory] = useState<PlaylistCategory>(playlist.category);
  const [coverUrl, setCoverUrl] = useState(playlist.cover_url || '');

  const categories: PlaylistCategory[] = ['car', 'party', 'workout', 'work', 'relax', 'other'];

  return (
    <div onClick={onClose} style={{
      position:'fixed',inset:0,zIndex:50,
      background:'rgba(0,0,0,0.5)',
      display:'flex',alignItems:'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',
        maxHeight:'90%',
        background:'var(--surface)',
        borderRadius:'16px 16px 0 0',
        padding:'12px 16px max(20px, env(safe-area-inset-bottom, 20px))',
        overflowY:'auto',
      }}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        <h3 style={{fontSize: 'var(--fs-heading)', fontWeight:600, margin:'0 0 16px', color:'var(--text)'}}>Редактировать</h3>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={80}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:12}}
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Описание (опционально)"
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:12,resize:'vertical',fontFamily:'inherit'}}
        />
        <input
          value={coverUrl}
          onChange={e => setCoverUrl(e.target.value)}
          placeholder="URL обложки (опционально)"
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:12}}
        />

        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:8,marginBottom:16}}>
          {categories.map(c => {
            const meta = CATEGORY_META[c];
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                style={{
                  padding:'10px 6px',
                  borderRadius:10,
                  border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: active ? 'var(--surface-light)' : 'transparent',
                  cursor:'pointer',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                  color:'var(--text)',fontSize: 'var(--fs-micro)',
                }}
              >
                <GlyphIcon name={meta.icon} size={22} />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{display:'flex', gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:'12px',background:'var(--surface-light)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)',fontSize: 'var(--fs-snap14)',fontWeight:500,cursor:'pointer'}}>Отмена</button>
          <button
            onClick={() => onSave({
              title: title.trim() || playlist.title,
              description: description.trim() || null,
              category,
              cover_url: coverUrl.trim() || null,
            })}
            style={{flex:2,padding:'12px',background:'var(--primary)',border:'none',borderRadius:10,color:'var(--bg)',fontSize: 'var(--fs-snap14)',fontWeight:600,cursor:'pointer'}}
          >Сохранить</button>
        </div>
      </div>
    </div>
  );
}
