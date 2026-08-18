import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePlaylistStore, CATEGORY_META, type PlaylistCategory, type Playlist } from '@/stores/playlistStore';
import { GlyphIcon } from '@/components/icons/AppGlyph';

type FilterTab = 'all' | PlaylistCategory | 'archived';

export default function Playlists() {
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { playlists, loading, loadPlaylists, subscribeRealtime, unsubscribeRealtime } = usePlaylistStore();

  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    loadPlaylists();
    subscribeRealtime();
    return () => unsubscribeRealtime();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return playlists.filter(p => !p.archived);
    if (filter === 'archived') return playlists.filter(p => p.archived);
    return playlists.filter(p => !p.archived && p.category === filter);
  }, [playlists, filter]);

  const tabs: Array<{ key: FilterTab; label: string; icon?: string }> = [
    { key: 'all', label: 'Все' },
    { key: 'car', label: 'Машина', icon: 'car' },
    { key: 'party', label: 'Тусовка', icon: 'party' },
    { key: 'workout', label: 'Тренировка', icon: 'workout' },
    { key: 'work', label: 'Работа', icon: 'briefcase' },
    { key: 'relax', label: 'Отдых', icon: 'relax' },
    { key: 'other', label: 'Другое', icon: 'music' },
    { key: 'archived', label: 'Архив', icon: 'archive' },
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingBottom:8}}>
        <h1>Музыка</h1>
        <button
          onClick={() => nav('/music/new')}
          aria-label="Создать плейлист"
          style={{
            background:'var(--primary)',
            color:'var(--bg)',
            border:'none',
            width:38, height:38, borderRadius:19,
            fontSize: 'var(--fs-snap24)', fontWeight:300, lineHeight:1,
            cursor:'pointer', display:'flex',
            alignItems:'center', justifyContent:'center',
          }}
        >+</button>
      </div>

      {/* Фильтр-pills */}
      <div style={{
        display:'flex',
        gap:8,
        overflowX:'auto',
        padding:'4px 16px 12px',
        flexShrink:0,
        scrollbarWidth:'none',
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding:'6px 12px',
              borderRadius:14,
              border: filter === t.key ? 'none' : '1px solid var(--border)',
              background: filter === t.key ? 'var(--primary)' : 'transparent',
              color: filter === t.key ? 'var(--bg)' : 'var(--text)',
              fontSize: 'var(--fs-label)',
              fontWeight: filter === t.key ? 600 : 500,
              whiteSpace:'nowrap',
              cursor:'pointer',
              flexShrink:0,
            }}
          >
            {t.icon ? <GlyphIcon name={t.icon} size={14} style={{ marginRight: 4 }} /> : null}
            {t.label}
          </button>
        ))}
      </div>

      <div className="page-scroll" style={{padding:'0 12px 24px'}}>
        {loading && playlists.length === 0 && (
          <div style={{display:'flex',justifyContent:'center',padding:40}}>
            <div className="spinner" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{textAlign:'center', padding:'60px 24px', color:'var(--muted)'}}>
            <div style={{ marginBottom: 8, opacity: 0.5, display: 'flex', justifyContent: 'center' }}><GlyphIcon name="music" size={48} strokeWidth={1.4} /></div>
            <div style={{fontSize: 'var(--fs-body)', color:'var(--text)', marginBottom:8}}>
              {filter === 'all' && 'Пока нет плейлистов'}
              {filter === 'archived' && 'Архив пуст'}
              {filter !== 'all' && filter !== 'archived' && 'В этой категории пока пусто'}
            </div>
            <div style={{fontSize: 'var(--fs-label)', lineHeight:1.5}}>
              Создайте плейлист в Spotify, включите collaborative режим и добавьте сюда — друзья смогут кидать треки.
            </div>
            {filter === 'all' && (
              <button
                onClick={() => nav('/music/new')}
                style={{
                  marginTop:20,
                  padding:'10px 22px',
                  background:'var(--primary)',
                  color:'var(--bg)',
                  border:'none',
                  borderRadius:20,
                  fontSize: 'var(--fs-snap14)', fontWeight:600,
                  cursor:'pointer',
                }}
              >Создать плейлист</button>
            )}
          </div>
        )}

        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(2, 1fr)',
          gap:12,
        }}>
          {filtered.map(p => (
            <PlaylistCard key={p.id} playlist={p} myId={myId} onTap={() => nav('/music/' + p.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PlaylistCard({ playlist, myId, onTap }: { playlist: Playlist; myId?: string; onTap: () => void }) {
  const meta = CATEGORY_META[playlist.category] || CATEGORY_META.other;
  const isMine = myId && playlist.owner_id === myId;

  return (
    <button
      onClick={onTap}
      style={{
        background:'none',
        border:'none',
        padding:0,
        textAlign:'left',
        cursor:'pointer',
        display:'flex',
        flexDirection:'column',
        gap:8,
      }}
    >
      <div style={{
        width:'100%',
        aspectRatio:'1/1',
        borderRadius:14,
        background: playlist.cover_url ? 'var(--surface)' : meta.gradient,
        position:'relative',
        overflow:'hidden',
        boxShadow:'0 2px 8px rgba(0,0,0,0.18)',
      }}>
        {playlist.cover_url ? (
          <img
            src={playlist.cover_url}
            alt=""
            style={{width:'100%',height:'100%',objectFit:'cover'}}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div style={{
            width:'100%',height:'100%',
            display:'flex',alignItems:'center',justifyContent:'center',
            color: '#fff',
          }}><GlyphIcon name={meta.icon} size={64} strokeWidth={1.5} /></div>
        )}
        {playlist.archived && (
          <span style={{
            position:'absolute', top:8, right:8,
            fontSize: 'var(--fs-snap10)', fontWeight:600,
            color:'#fff',
            background:'rgba(0,0,0,0.6)',
            padding:'3px 8px',
            borderRadius:8,
            letterSpacing:0.4,
          }}>АРХИВ</span>
        )}
        {isMine && !playlist.archived && (
          <span style={{
            position:'absolute', top:8, left:8,
            fontSize: 'var(--fs-snap10)', fontWeight:600,
            color:'#fff',
            background:'rgba(59,130,246,0.85)',
            padding:'3px 8px',
            borderRadius:8,
          }}>МОЁ</span>
        )}
      </div>

      <div style={{padding:'0 4px'}}>
        <div style={{
          fontSize: 'var(--fs-snap14)', fontWeight:600,
          color:'var(--text)',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{playlist.title}</div>
        <div style={{
          fontSize: 'var(--fs-caption)',
          color:'var(--muted)',
          marginTop:2,
          display:'flex',
          alignItems:'center',
          gap:4,
        }}>
          <GlyphIcon name={meta.icon} size={14} />
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {meta.label} · {playlist.owner?.display_name || '...'}
          </span>
        </div>
      </div>
    </button>
  );
}
