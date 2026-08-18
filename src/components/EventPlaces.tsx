import { useEffect, useRef, useState, type ReactNode } from 'react';
import BlockShell from './event-blocks/BlockShell';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { avatarColor } from '@/lib/utils';
import LocationAutocomplete from '@/components/LocationAutocomplete';

interface Place {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  image_url: string | null;
  url: string | null;
  category: string | null;
  position: number;
  created_by: string | null;
  comments_count?: number;
}

interface Comment {
  id: string;
  place_id: string;
  user_id: string;
  text: string;
  created_at: string;
  user?: { id: string; display_name: string; avatar_url: string | null };
}

const CATEGORIES: { id: string; label: string; icon: ReactNode; color: string }[] = [
  {
    id: 'restaurant', label: 'Ресторан', color: '#F59E0B',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h1v11h2V2H3z"/>
        <path d="M18 2v9h2V2h-2zM16 2v6c0 .55-.45 1-1 1s-1-.45-1-1V2h-2v6c0 1.66 1.34 3 3 3v10h2V2h-1z" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'bar', label: 'Бар', color: '#EF4444',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3h14L13 12v6l3 2H8l3-2v-6L5 3z"/>
      </svg>
    ),
  },
  {
    id: 'attraction', label: 'Достопр.', color: '#8B5CF6',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18"/>
        <path d="M5 21V10l7-5 7 5v11"/>
        <path d="M9 21v-8h6v8"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    id: 'museum', label: 'Музей', color: '#EC4899',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M9 17l3-3 3 3"/>
        <path d="M9 14l2-2 2 2 3-3"/>
        <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'nature', label: 'Природа', color: '#10B981',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c2 4 4 6 6 8-1 4-4 6-6 6s-5-2-6-6c2-2 4-4 6-8z" fill="currentColor" stroke="none" opacity="0.25"/>
        <path d="M12 2c2 4 4 6 6 8-1 4-4 6-6 6s-5-2-6-6c2-2 4-4 6-8z"/>
        <line x1="12" y1="16" x2="12" y2="22"/>
      </svg>
    ),
  },
  {
    id: 'shop', label: 'Шоппинг', color: '#3B82F6',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    id: 'other', label: 'Другое', color: '#6B7280',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
];

export default function EventPlaces({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const { user } = useAuthStore();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [openComments, setOpenComments] = useState<string | null>(null);

  const reload = async () => {
    const { data: pls } = await supabase
      .from('event_places').select('*').eq('event_id', eventId).order('position');
    const list = (pls || []) as Place[];
    if (list.length > 0) {
      const placeIds = list.map(p => p.id);
      const { data: cnts } = await supabase
        .from('event_place_comments')
        .select('place_id')
        .in('place_id', placeIds);
      const countMap: Record<string, number> = {};
      (cnts || []).forEach((c: any) => { countMap[c.place_id] = (countMap[c.place_id] || 0) + 1; });
      list.forEach(p => { p.comments_count = countMap[p.id] || 0; });
    }
    setPlaces(list);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [eventId]);

  useEffect(() => {
    const ch = supabase.channel(`event-places-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_places', filter: `event_id=eq.${eventId}` }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_place_comments' }, () => reload())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [eventId]);

  const remove = async (id: string) => {
    if (!confirm('Удалить место?')) return;
    await supabase.from('event_places').delete().eq('id', id);
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>}
      iconBg="#DC2626"
      title="Места"
      subtitle={places.length > 0 ? `${places.length} ${places.length === 1 ? 'место' : places.length < 5 ? 'места' : 'мест'}` : undefined}
      onAdd={canEdit ? () => setEditing({}) : undefined}
      addLabel="Место"
    >
      {loading && <div style={{padding:24,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>}

      {!loading && places.length === 0 && (
        <div style={{padding:'16px 12px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-label)'}}>
          {canEdit ? 'Добавляйте места куда хочется попасть' : 'Пока нет добавленных мест'}
        </div>
      )}

      {places.map(p => {
        const cat = CATEGORIES.find(c => c.id === p.category) || CATEGORIES[6];
        return (
          <div key={p.id} style={{
            padding:'10px 12px',marginBottom:8,
            background:'var(--surface-light)',borderRadius:12,
          }}>
            <div style={{display:'flex',gap:10}}>
              {p.image_url && (
                <img src={p.image_url} alt="" style={{width:54,height:54,borderRadius:10,objectFit:'cover',flexShrink:0}} />
              )}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                  <span style={{display:'flex',color:cat.color}}>{cat.icon}</span>
                  <div style={{flex:1,fontSize: 'var(--fs-snap14)',fontWeight:500,color:'var(--text)',
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {p.title}
                  </div>
                </div>
                {p.location_name && (
                  <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginBottom:2,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    📍 {p.location_name}
                  </div>
                )}
                {p.description && (
                  <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',
                    overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                    {p.description}
                  </div>
                )}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'center',flexShrink:0}}>
                {canEdit && p.created_by === user?.id && (
                  <>
                    <button onClick={() => setEditing({ id: p.id })}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button onClick={() => remove(p.id)}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginTop:8,fontSize: 'var(--fs-caption)'}}>
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                  style={{color:'var(--accent)',textDecoration:'none'}}>🔗 ссылка</a>
              )}
              {p.location_lat !== null && p.location_lng !== null && (
                <a
                  href={`https://yandex.ru/maps/?pt=${p.location_lng},${p.location_lat}&z=15`}
                  target="_blank" rel="noreferrer"
                  style={{color:'var(--accent)',textDecoration:'none'}}>🗺️ карта</a>
              )}
              <button onClick={() => setOpenComments(p.id)}
                style={{background:'none',border:'none',padding:0,cursor:'pointer',
                  color:'var(--muted)',display:'flex',alignItems:'center',gap:4,fontSize: 'var(--fs-caption)'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span>{p.comments_count || 0}</span>
              </button>
            </div>
          </div>
        );
      })}

      {editing && (
        <EditPlaceSheet
          eventId={eventId}
          item={editing.id ? places.find(p => p.id === editing.id)! : null}
          position={places.length}
          onSaved={() => setEditing(null)}
          onClose={() => setEditing(null)}
        />
      )}

      {openComments && (
        <PlaceCommentsSheet
          placeId={openComments}
          canEdit={canEdit}
          onClose={() => setOpenComments(null)}
        />
      )}
    </BlockShell>
  );
}

// =============== Edit place sheet ===============

function EditPlaceSheet({ eventId, item, position, onSaved, onClose }: {
  eventId: string; item: Place | null; position: number;
  onSaved: () => void; onClose: () => void;
}) {
  const { user } = useAuthStore();
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [locationName, setLocationName] = useState(item?.location_name || '');
  const [locationLat, setLocationLat] = useState<number | null>(item?.location_lat ?? null);
  const [locationLng, setLocationLng] = useState<number | null>(item?.location_lng ?? null);
  const [imageUrl, setImageUrl] = useState(item?.image_url || '');
  const [url, setUrl] = useState(item?.url || '');
  const [category, setCategory] = useState(item?.category || 'attraction');
  const [saving, setSaving] = useState(false);

  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  const save = async () => {
    if (!title.trim() || saving || !user) return;
    setSaving(true);
    const patch: any = {
      event_id: eventId,
      title: title.trim(),
      description: description.trim() || null,
      location_name: locationName.trim() || null,
      location_lat: locationLat,
      location_lng: locationLng,
      image_url: imageUrl.trim() || null,
      url: url.trim() || null,
      category,
      position,
    };
    if (item) {
      await supabase.from('event_places').update(patch).eq('id', item.id);
    } else {
      patch.created_by = user.id;
      await supabase.from('event_places').insert(patch);
    }
    setSaving(false);
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
        <h3 style={{margin:'0 0 14px',fontSize: 'var(--fs-snap16)',fontWeight:600}}>
          {item ? 'Изменить место' : 'Новое место'}
        </h3>

        <Label>Название</Label>
        <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
          maxLength={100} placeholder="Старый Тбилиси" style={inputStyle()} />

        <Label optional>Категория</Label>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:14}}>
          {CATEGORIES.map(c => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)}
              style={{padding:'6px 10px',borderRadius:14,
                border: category === c.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: category === c.id ? 'var(--surface-light)' : 'transparent',
                cursor:'pointer',color:'var(--text)',fontSize: 'var(--fs-caption)',
                display:'flex',alignItems:'center',gap:4}}>
              <span style={{display:'flex', color: category === c.id ? c.color : 'var(--muted)'}}>{c.icon}</span><span>{c.label}</span>
            </button>
          ))}
        </div>

        <Label optional>Адрес</Label>
        <LocationAutocomplete
          value={locationName}
          onChange={(text, lat, lng) => {
            setLocationName(text);
            setLocationLat(lat ?? null);
            setLocationLng(lng ?? null);
          }}
          placeholder="ул. Шардени, Тбилиси"
        />

        <Label optional>Описание</Label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          rows={2} placeholder="Что там интересного" maxLength={300}
          style={{...inputStyle(), resize:'vertical', fontFamily:'inherit'}} />

        <Label optional>URL картинки</Label>
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
          placeholder="https://..." style={inputStyle()} />

        <Label optional>Ссылка (сайт/отзывы)</Label>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://..." style={inputStyle()} />

        <button onClick={save} disabled={!title.trim() || saving}
          style={{width:'100%',padding:'14px',marginTop:6,
            background: title.trim() ? 'var(--primary)' : 'var(--surface-light)',
            color: title.trim() ? 'var(--bg)' : 'var(--muted)',
            border:'none',borderRadius:12,fontSize: 'var(--fs-body)',fontWeight:600,
            cursor: title.trim() && !saving ? 'pointer' : 'default'}}>
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// =============== Comments sheet ===============

function PlaceCommentsSheet({ placeId, canEdit, onClose }: { placeId: string; canEdit: boolean; onClose: () => void }) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  const reload = async () => {
    const { data } = await supabase
      .from('event_place_comments')
      .select('*, user:users(id, display_name, avatar_url)')
      .eq('place_id', placeId)
      .order('created_at');
    setComments((data || []) as Comment[]);
  };

  useEffect(() => { reload(); }, [placeId]);
  useEffect(() => {
    const ch = supabase.channel(`event-place-comments-${placeId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'event_place_comments', filter:`place_id=eq.${placeId}` }, () => reload())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [placeId]);

  const send = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    await supabase.from('event_place_comments').insert({
      place_id: placeId, user_id: user.id, text: text.trim(),
    });
    setText(''); setSending(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить?')) return;
    await supabase.from('event_place_comments').delete().eq('id', id);
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
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:160,background:`rgba(0,0,0,${Math.max(0.2,0.55-dragY/400)})`,display:'flex',alignItems:'flex-end',transition:'background 0.15s'}}>
      <div onClick={e => e.stopPropagation()} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{width:'100%',height:'80vh',background:'var(--bg)',borderRadius:'18px 18px 0 0',
          padding:'10px 0 0',display:'flex',flexDirection:'column',
          transform:`translateY(${dragY}px)`,transition: dragY === 0 ? 'transform 0.2s' : 'none',touchAction:'none'}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:10}}>
          <div style={{width:36,height:4,borderRadius:2,background:'var(--border)'}} />
        </div>
        <h3 style={{margin:'0 16px 12px',fontSize: 'var(--fs-snap16)',fontWeight:600}}>Комментарии</h3>
        <div style={{flex:1,overflowY:'auto',padding:'0 16px',WebkitOverflowScrolling:'touch'}}>
          {comments.length === 0 && (
            <div style={{padding:24,textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-label)'}}>
              Пока нет комментариев
            </div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{display:'flex',gap:8,marginBottom:10}}>
              {c.user?.avatar_url
                ? <img src={c.user.avatar_url} alt="" style={{width:30,height:30,borderRadius:15,objectFit:'cover',flexShrink:0}} />
                : <div style={{width:30,height:30,borderRadius:15,flexShrink:0,background:avatarColor(c.user_id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-caption)',fontWeight:600}}>{(c.user?.display_name||'?')[0].toUpperCase()}</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                  <span style={{fontSize: 'var(--fs-label)',fontWeight:600,color:'var(--text)'}}>{c.user?.display_name || '—'}</span>
                  <span style={{fontSize: 'var(--fs-snap10)',color:'var(--muted)'}}>
                    {new Date(c.created_at).toLocaleString('ru', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </span>
                  {canEdit && c.user_id === user?.id && (
                    <button onClick={() => remove(c.id)}
                      style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
                <div style={{fontSize: 'var(--fs-label)',color:'var(--text)',whiteSpace:'pre-wrap'}}>{c.text}</div>
              </div>
            </div>
          ))}
        </div>
        {canEdit && <div style={{padding:'10px 16px max(10px, env(safe-area-inset-bottom, 10px))',
          borderTop:'1px solid var(--border)',display:'flex',gap:8,alignItems:'flex-end'}}>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Написать..."
            rows={1}
            maxLength={500}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            style={{flex:1,padding:'10px 12px',background:'var(--surface-light)',
              border:'1px solid var(--border)',borderRadius:18,color:'var(--text)',
              fontSize: 'var(--fs-snap14)',outline:'none',resize:'none',fontFamily:'inherit',maxHeight:80}} />
          <button onClick={send} disabled={!text.trim() || sending}
            style={{padding:'10px 14px',background: text.trim() ? 'var(--primary)' : 'var(--border)',
              color: text.trim() ? 'var(--bg)' : 'var(--muted)',border:'none',borderRadius:18,
              fontSize: 'var(--fs-label)',fontWeight:600,cursor: text.trim() ? 'pointer' : 'default'}}>
            Отправить
          </button>
        </div>}
      </div>
    </div>
  );
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{fontSize: 'var(--fs-micro)',fontWeight:600,color:'var(--muted)',marginBottom:6,letterSpacing:0.3,textTransform:'uppercase'}}>
      {children}
      {optional && <span style={{textTransform:'none',fontWeight:500,marginLeft:6,opacity:0.7}}>(опц.)</span>}
    </div>
  );
}
function inputStyle(): React.CSSProperties {
  return {
    width:'100%',padding:'12px',borderRadius:10,
    border:'1px solid var(--border)',background:'var(--surface-light)',
    color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:14,outline:'none',
  };
}
