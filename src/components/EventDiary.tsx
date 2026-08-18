import { useEffect, useRef, useState } from 'react';
import BlockShell from './event-blocks/BlockShell';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { compressImage } from '@/lib/compress';
import { avatarColor } from '@/lib/utils';

interface Photo { url: string; storage_path: string; }

interface Entry {
  id: string;
  event_id: string;
  user_id: string;
  content: string | null;
  photos: Photo[];
  entry_date: string; // YYYY-MM-DD
  created_at: string;
  user?: { id: string; display_name: string; avatar_url: string | null };
}

export default function EventDiary({ eventId, canEdit, startAt }: {
  eventId: string;
  canEdit: boolean;
  startAt: string;
}) {
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; entry: Entry } | null>(null);

  const reload = async () => {
    const { data } = await supabase
      .from('event_diary_entries')
      .select('*, user:users(id, display_name, avatar_url)')
      .eq('event_id', eventId)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });
    setEntries((data || []) as Entry[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [eventId]);

  useEffect(() => {
    const ch = supabase.channel(`event-diary-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_diary_entries', filter: `event_id=eq.${eventId}` }, () => reload())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [eventId]);

  const removeEntry = async (entry: Entry) => {
    if (!confirm('Удалить запись?')) return;
    if (entry.photos.length > 0) {
      const paths = entry.photos.map(p => p.storage_path).filter(Boolean);
      if (paths.length > 0) await supabase.storage.from('event-diary').remove(paths);
    }
    await supabase.from('event_diary_entries').delete().eq('id', entry.id);
  };

  // Группировка по дате
  const byDate: Record<string, Entry[]> = {};
  for (const e of entries) {
    if (!byDate[e.entry_date]) byDate[e.entry_date] = [];
    byDate[e.entry_date].push(e);
  }
  const dateKeys = Object.keys(byDate).sort();

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
      iconBg="#A855F7"
      title="Дневник"
      subtitle={entries.length > 0 ? `${entries.length} ${entries.length === 1 ? 'запись' : entries.length < 5 ? 'записи' : 'записей'}` : undefined}
      onAdd={canEdit ? () => setComposer(true) : undefined}
      addLabel="Запись"
    >
      {loading && <div style={{padding:24,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>}

      {!loading && entries.length === 0 && (
        <div style={{padding:'16px 12px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-label)'}}>
          Записывайте впечатления — после поездки получится хроника
        </div>
      )}

      {dateKeys.map(dateKey => {
        const date = new Date(dateKey + 'T12:00:00');
        // Какой день поездки (1, 2, ...)
        const tripStart = new Date(startAt);
        const dayNum = Math.max(1, Math.floor((date.getTime() - new Date(tripStart.toISOString().slice(0,10) + 'T12:00:00').getTime()) / (24*60*60*1000)) + 1);
        return (
          <div key={dateKey} style={{marginBottom:10}}>
            <div style={{
              fontSize: 'var(--fs-caption)',fontWeight:600,color:'var(--text)',
              padding:'8px 4px 6px',display:'flex',alignItems:'center',gap:6,
            }}>
              <span style={{color:'var(--muted)'}}>День {dayNum}</span>
              <span style={{color:'var(--muted)',fontWeight:400}}>·</span>
              <span style={{color:'var(--muted)',fontWeight:400}}>
                {date.toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'short' })}
              </span>
            </div>

            {byDate[dateKey].map(entry => (
              <div key={entry.id} className="diary-entry-slide-in" style={{
                background:'var(--surface-light)',borderRadius:12,
                padding:'10px 12px',marginBottom:8,
              }}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  {entry.user?.avatar_url
                    ? <img src={entry.user.avatar_url} alt="" style={{width:28,height:28,borderRadius:14,objectFit:'cover'}} />
                    : <div style={{width:28,height:28,borderRadius:14,background:avatarColor(entry.user_id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-caption)',fontWeight:600}}>{(entry.user?.display_name||'?')[0].toUpperCase()}</div>}
                  <div style={{flex:1,fontSize: 'var(--fs-label)',fontWeight:600,color:'var(--text)'}}>
                    {entry.user?.display_name || '—'}
                  </div>
                  <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>
                    {new Date(entry.created_at).toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' })}
                  </div>
                  {entry.user_id === user?.id && (
                    <button onClick={() => removeEntry(entry)}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>

                {entry.content && (
                  <div style={{fontSize: 'var(--fs-snap14)',color:'var(--text)',whiteSpace:'pre-wrap',lineHeight:1.4,marginBottom: entry.photos.length > 0 ? 8 : 0}}>
                    {entry.content}
                  </div>
                )}

                {entry.photos.length > 0 && (
                  <div style={{
                    display:'grid',
                    gridTemplateColumns: entry.photos.length === 1 ? '1fr' : entry.photos.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
                    gap:3,
                  }}>
                    {entry.photos.map((p, i) => (
                      <img key={i} src={p.url} alt="" loading="lazy"
                        onClick={() => setPreviewPhoto({ url: p.url, entry })}
                        style={{
                          width:'100%',
                          aspectRatio: entry.photos.length === 1 ? '4/3' : '1/1',
                          objectFit:'cover',borderRadius:8,cursor:'pointer',display:'block',
                        }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {composer && user && (
        <DiaryComposer
          eventId={eventId}
          userId={user.id}
          onSaved={() => setComposer(false)}
          onClose={() => setComposer(false)}
        />
      )}

      {previewPhoto && (
        <div onClick={() => setPreviewPhoto(null)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.95)',zIndex:200,
            display:'flex',alignItems:'center',justifyContent:'center'}}>
          <img src={previewPhoto.url} alt="" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}} />
          <button onClick={() => setPreviewPhoto(null)}
            style={{position:'absolute',top:16,right:16,background:'#000',border:'1px solid rgba(255,255,255,0.18)',color:'#fff',width:36,height:36,borderRadius:18,fontSize: 'var(--fs-title)',cursor:'pointer'}}>✕</button>
        </div>
      )}
    </BlockShell>
  );
}

// =============== Composer ===============

function DiaryComposer({ eventId, userId, onSaved, onClose }: {
  eventId: string; userId: string; onSaved: () => void; onClose: () => void;
}) {
  const [content, setContent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    const arr = Array.from(fl).filter(f => f.type.startsWith('image/'));
    const next = [...files, ...arr].slice(0, 6); // максимум 6 фото
    setFiles(next);
    setPreviews(next.map(f => URL.createObjectURL(f)));
  };

  const removePhoto = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviews(prev => {
      prev.forEach((u, idx) => idx === i && URL.revokeObjectURL(u));
      return next.map(f => URL.createObjectURL(f));
    });
  };

  const save = async () => {
    if (saving) return;
    if (!content.trim() && files.length === 0) return;
    setSaving(true);

    const uploaded: Photo[] = [];
    for (const file of files) {
      try {
        const compressed = await compressImage(file, 1600, 0.85);
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${eventId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error } = await supabase.storage.from('event-diary').upload(path, compressed, { upsert: false });
        if (error) { toast.error('Не удалось загрузить: ' + error.message); continue; }
        const { data: pub } = supabase.storage.from('event-diary').getPublicUrl(path);
        uploaded.push({ url: pub.publicUrl, storage_path: path });
      } catch {}
    }

    const { error } = await supabase.from('event_diary_entries').insert({
      event_id: eventId,
      user_id: userId,
      content: content.trim() || null,
      photos: uploaded,
      entry_date: date,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSaved();
  };

  const onTouchStart = (e: React.TouchEvent) => { startYRef.current = e.touches[0].clientY; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 80) onClose();
    else setDragY(0);
    startYRef.current = null;
  };

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:150,background:`rgba(0,0,0,${Math.max(0.2,0.55-dragY/400)})`,display:'flex',alignItems:'flex-end',transition:'background 0.15s'}}>
      <div onClick={e => e.stopPropagation()} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{width:'100%',maxHeight:'90vh',background:'var(--bg)',borderRadius:'18px 18px 0 0',
          padding:'10px 16px max(20px, env(safe-area-inset-bottom, 20px))',
          transform:`translateY(${dragY}px)`,transition: dragY === 0 ? 'transform 0.2s' : 'none',
          overflowY:'auto',WebkitOverflowScrolling:'touch',touchAction:'none'}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:10}}>
          <div style={{width:36,height:4,borderRadius:2,background:'var(--border)'}} />
        </div>
        <h3 style={{margin:'0 0 14px',fontSize: 'var(--fs-snap16)',fontWeight:600}}>Запись в дневнике</h3>

        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
          <span style={{fontSize: 'var(--fs-caption)',color:'var(--muted)'}}>Дата:</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{padding:'8px 10px',borderRadius:8,border:'1px solid var(--border)',
              background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-label)',fontFamily:'inherit'}} />
        </div>

        <textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="Что было? Как впечатления..."
          rows={4} autoFocus maxLength={1500}
          style={{width:'100%',padding:'12px',borderRadius:10,
            border:'1px solid var(--border)',background:'var(--surface-light)',
            color:'var(--text)',fontSize: 'var(--fs-snap14)',outline:'none',resize:'vertical',fontFamily:'inherit',marginBottom:10}} />

        {previews.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
            {previews.map((u, i) => (
              <div key={i} style={{position:'relative',aspectRatio:'1/1',borderRadius:8,overflow:'hidden'}}>
                <img src={u} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                <button onClick={() => removePhoto(i)}
                  style={{position:'absolute',top:4,right:4,width:20,height:20,borderRadius:10,
                    background:'rgba(0,0,0,0.7)',border:'none',color:'#fff',cursor:'pointer',
                    display:'flex',alignItems:'center',justifyContent:'center',padding:0,fontSize: 'var(--fs-caption)'}}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={() => fileRef.current?.click()}
            disabled={files.length >= 6}
            style={{padding:'10px 14px',borderRadius:10,
              background:'var(--surface-light)',border:'1px solid var(--border)',
              color:'var(--text)',fontSize: 'var(--fs-label)',fontWeight:500,cursor:'pointer',
              display:'flex',alignItems:'center',gap:6,
              opacity: files.length >= 6 ? 0.5 : 1}}>
            📷 Фото {files.length > 0 && `(${files.length}/6)`}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple
            onChange={e => addFiles(e.target.files)} style={{display:'none'}} />
          <div style={{flex:1}} />
          <button onClick={save} disabled={saving || (!content.trim() && files.length === 0)}
            style={{padding:'10px 18px',borderRadius:10,
              background: (content.trim() || files.length > 0) ? 'var(--primary)' : 'var(--border)',
              color: (content.trim() || files.length > 0) ? 'var(--bg)' : 'var(--muted)',
              border:'none',fontSize: 'var(--fs-snap14)',fontWeight:600,
              cursor: saving ? 'default' : 'pointer'}}>
            {saving ? 'Сохраняем...' : 'Опубликовать'}
          </button>
        </div>
      </div>
    </div>
  );
}
