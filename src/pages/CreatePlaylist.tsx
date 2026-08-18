import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePlaylistStore, CATEGORY_META, type PlaylistCategory, extractSpotifyPlaylistId } from '@/stores/playlistStore';
import { GlyphIcon } from '@/components/icons/AppGlyph';

export default function CreatePlaylist() {
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { createPlaylist } = usePlaylistStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PlaylistCategory>('party');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spotifyId = extractSpotifyPlaylistId(spotifyUrl);
  const isValid = title.trim().length > 0 && spotifyUrl.trim().length > 0 && spotifyId;

  const handleSubmit = async () => {
    if (!myId || !isValid) return;
    setSubmitting(true);
    setError(null);

    const { id, error } = await createPlaylist({
      owner_id: myId,
      title,
      description: description || undefined,
      category,
      spotify_url: spotifyUrl,
      cover_url: coverUrl || undefined,
    });

    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    if (id) nav('/music/' + id, { replace: true });
  };

  const categories: PlaylistCategory[] = ['car', 'party', 'workout', 'work', 'relax', 'other'];

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div className="page-header" style={{display:'flex',alignItems:'center',gap:12,paddingBottom:12}}>
        <button
          onClick={() => nav(-1)}
          style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6,marginLeft:-6,fontSize: 'var(--fs-snap24)',lineHeight:1}}
          aria-label="Назад"
        ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h1 style={{fontSize: 'var(--fs-title)', textTransform:'none', letterSpacing:0}}>Новый плейлист</h1>
      </div>

      <div className="page-scroll" style={{padding:'8px 16px 32px'}}>
        {/* Spotify URL первым — это самое важное */}
        <Label>Ссылка на Spotify-плейлист</Label>
        <input
          value={spotifyUrl}
          onChange={e => setSpotifyUrl(e.target.value)}
          placeholder="https://open.spotify.com/playlist/..."
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:6}}
        />
        {spotifyUrl && !spotifyId && (
          <div style={{fontSize: 'var(--fs-caption)', color:'#EF4444', marginBottom:8}}>
            Не удалось распознать ссылку. Скопируй из Spotify (формат: open.spotify.com/playlist/...)
          </div>
        )}
        {spotifyId && (
          <div style={{fontSize: 'var(--fs-caption)', color:'#10B981', marginBottom:8}}>
            ✓ Ссылка распознана: {spotifyId.slice(0, 8)}...
          </div>
        )}
        <div style={{
          fontSize: 'var(--fs-caption)',
          color:'var(--muted)',
          background:'var(--surface-light)',
          padding:'10px 12px',
          borderRadius:8,
          lineHeight:1.5,
          marginBottom:20,
        }}>
          Чтобы все могли добавлять треки — в Spotify открой плейлист → меню "..." → <b>Invite collaborators</b> → скопируй ссылку и вставь сюда. Бесплатного аккаунта Spotify хватит.
        </div>

        <Label>Название</Label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Например: На дачу 2026"
          maxLength={80}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:20}}
        />

        <Label>Категория</Label>
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(3, 1fr)',
          gap:8,
          marginBottom:20,
        }}>
          {categories.map(c => {
            const meta = CATEGORY_META[c];
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                style={{
                  padding:'12px 8px',
                  borderRadius:10,
                  border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: active ? 'var(--surface-light)' : 'transparent',
                  cursor:'pointer',
                  display:'flex',
                  flexDirection:'column',
                  alignItems:'center',
                  gap:6,
                  color:'var(--text)',
                  fontSize: 'var(--fs-caption)',
                  fontWeight: active ? 600 : 500,
                }}
              >
                <GlyphIcon name={meta.icon} size={24} />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        <Label optional>Описание</Label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Что это за плейлист, для какого случая"
          maxLength={300}
          rows={3}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:20,resize:'vertical',fontFamily:'inherit'}}
        />

        <Label optional>Обложка (URL картинки)</Label>
        <input
          value={coverUrl}
          onChange={e => setCoverUrl(e.target.value)}
          placeholder="Можно оставить пустым — будет градиент"
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:24}}
        />

        {error && (
          <div style={{
            background:'rgba(239,68,68,0.1)',
            color:'#EF4444',
            padding:'10px 12px',
            borderRadius:8,
            fontSize: 'var(--fs-label)',
            marginBottom:16,
          }}>{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          style={{
            width:'100%',
            padding:'14px',
            background: isValid ? 'var(--primary)' : 'var(--surface-light)',
            color: isValid ? 'var(--bg)' : 'var(--muted)',
            border:'none',
            borderRadius:10,
            fontSize: 'var(--fs-body)',
            fontWeight:600,
            cursor: isValid && !submitting ? 'pointer' : 'default',
          }}
        >{submitting ? 'Создаём...' : 'Создать плейлист'}</button>
      </div>
    </div>
  );
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{
      fontSize: 'var(--fs-caption)',
      fontWeight:600,
      color:'var(--muted)',
      marginBottom:6,
      letterSpacing:0.3,
      textTransform:'uppercase',
    }}>
      {children}
      {optional && <span style={{textTransform:'none', fontWeight:500, marginLeft:6, opacity:0.7}}>(опционально)</span>}
    </div>
  );
}
