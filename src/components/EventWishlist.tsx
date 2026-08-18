import { useEffect, useRef, useState } from 'react';
import BlockShell from './event-blocks/BlockShell';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { avatarColor } from '@/lib/utils';
import { triggerConfetti } from '@/lib/confetti';

interface Item {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  url: string | null;
  image_url: string | null;
  price_estimate: number | null;
  price_currency: string | null;
  position: number;
  reserved_by: string | null;
  reserved_at: string | null;
  reserver?: { id: string; display_name: string; avatar_url: string | null } | null;
}

export default function EventWishlist({ eventId, isCreator, canEdit, isBirthday, currency }: {
  eventId: string;
  isCreator: boolean;
  canEdit: boolean;
  isBirthday: boolean;
  currency: string;
}) {
  const { user } = useAuthStore();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: string } | null>(null);

  // Скрываем брони от организатора, если это его ДР
  const hideReservations = isBirthday && isCreator;

  const reload = async () => {
    const { data } = await supabase
      .from('event_wishlist_items')
      .select('*, reserver:users!event_wishlist_items_reserved_by_fkey(id, display_name, avatar_url)')
      .eq('event_id', eventId)
      .order('position');
    setItems((data || []) as Item[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [eventId]);

  useEffect(() => {
    const ch = supabase.channel(`event-wishlist-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_wishlist_items', filter: `event_id=eq.${eventId}` }, () => reload())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [eventId]);

  const toggleReserve = async (item: Item, evt?: React.MouseEvent) => {
    if (!user) return;
    const reserve = !(item.reserved_by === user.id);
    if (reserve && item.reserved_by && item.reserved_by !== user.id) {
      toast.error('Этот подарок уже забронирован другим участником');
      return;
    }
    const optimisticReserver = reserve ? { id: user.id, display_name: user.display_name || 'Вы', avatar_url: user.avatar_url || null } : null;
    setItems(prev => prev.map(row => row.id === item.id ? {
      ...row,
      reserved_by: reserve ? user.id : null,
      reserved_at: reserve ? new Date().toISOString() : null,
      reserver: optimisticReserver,
    } : row));

    const { error } = await supabase.rpc('reserve_wishlist_item', {
      item_id_param: item.id,
      reserve_param: reserve,
    });
    if (error) {
      setItems(prev => prev.map(row => row.id === item.id ? item : row));
      toast.error(error.message);
      return;
    }

    // Конфетти при подтверждении брони
    if (reserve) {
      const target = (evt?.currentTarget as HTMLElement | null);
      if (target) {
        const r = target.getBoundingClientRect();
        triggerConfetti({
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          count: 50,
          colors: ['#EC4899', '#F472B6', '#FBBF24', '#F59E0B', '#FFFFFF'],
          power: 8,
          duration: 1800,
        });
      } else {
        triggerConfetti({ count: 50, colors: ['#EC4899', '#FBBF24'] });
      }
      if ('vibrate' in navigator) {
        try { navigator.vibrate([10, 40, 20]); } catch {}
      }
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить пункт из Wishlist?')) return;
    setItems(prev => prev.filter(row => row.id !== id));
    const { error } = await supabase.from('event_wishlist_items').delete().eq('id', id);
    if (error) await reload();
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>}
      iconBg="#F59E0B"
      title="Wishlist"
      subtitle={items.length > 0 ? `${items.length} ${items.length === 1 ? 'подарок' : items.length < 5 ? 'подарка' : 'подарков'}` : undefined}
      onAdd={canEdit ? () => setEditing({}) : undefined}
      addLabel="Подарок"
    >
      {hideReservations && items.length > 0 && (
        <div style={{padding:'8px 12px',marginBottom:8,background:'rgba(255,107,157,0.1)',
          color:'#FF6B9D',borderRadius:10,fontSize: 'var(--fs-caption)',textAlign:'center'}}>
          🎂 Брони скрыты — пусть будет сюрприз
        </div>
      )}

      {loading && <div style={{padding:24,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>}

      {!loading && items.length === 0 && (
        <div style={{padding:'16px 12px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-label)'}}>
          {canEdit ? 'Добавьте что хотите получить в подарок' : 'Wishlist пуст'}
        </div>
      )}

      {items.map(item => {
        const myReservation = item.reserved_by === user?.id;
        const reservedByOther = item.reserved_by && !myReservation && !hideReservations;
        return (
          <div key={item.id} style={{
            display:'flex',gap:10,padding:'10px 12px',marginBottom:8,
            background:'var(--surface-light)',borderRadius:12,
            opacity: reservedByOther ? 0.65 : 1,
          }}>
            {item.image_url && (
              <img src={item.image_url} alt="" style={{width:54,height:54,borderRadius:10,objectFit:'cover',flexShrink:0}} />
            )}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize: 'var(--fs-snap14)',fontWeight:500,color:'var(--text)',marginBottom:2,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {item.title}
              </div>
              {item.description && (
                <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',marginBottom:3,
                  overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                  {item.description}
                </div>
              )}
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>
                {item.price_estimate && (
                  <span>~{item.price_estimate.toLocaleString()} {item.price_currency || currency}</span>
                )}
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{color:'var(--accent)',textDecoration:'none'}}>
                    🔗 ссылка
                  </a>
                )}
              </div>
              {!hideReservations && item.reserver && (
                <div style={{marginTop:5,display:'flex',alignItems:'center',gap:5,fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>
                  {item.reserver.avatar_url
                    ? <img src={item.reserver.avatar_url} alt="" style={{width:16,height:16,borderRadius:8,objectFit:'cover'}} />
                    : <div style={{width:16,height:16,borderRadius:8,background:avatarColor(item.reserver.id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:600}}>{(item.reserver.display_name||'?')[0].toUpperCase()}</div>}
                  <span>забронировал {myReservation ? '(вы)' : item.reserver.display_name}</span>
                </div>
              )}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'center'}}>
              {canEdit && (
                <>
                  <button onClick={() => setEditing({ id: item.id })}
                    style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  <button onClick={() => remove(item.id)}
                    style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </>
              )}
              {!isCreator && !reservedByOther && (
                <button
                  onClick={(evt) => toggleReserve(item, evt)}
                  style={{
                    padding:'6px 12px',borderRadius:14,
                    background: myReservation ? 'var(--text)' : 'var(--primary)',
                    color: myReservation ? 'var(--bg)' : 'var(--bg)',
                    border:'none',fontSize: 'var(--fs-micro)',fontWeight:600,cursor:'pointer',
                    whiteSpace:'nowrap',
                  }}
                >
                  {myReservation ? 'Я беру ✓' : 'Беру'}
                </button>
              )}
              {!isCreator && reservedByOther && (
                <div style={{padding:'6px 12px',fontSize: 'var(--fs-micro)',color:'var(--muted)'}}>взяли</div>
              )}
            </div>
          </div>
        );
      })}

      {editing && (
        <EditWishlistSheet
          eventId={eventId}
          item={editing.id ? items.find(i => i.id === editing.id)! : null}
          currency={currency}
          position={items.length}
          onSaved={() => setEditing(null)}
          onClose={() => setEditing(null)}
        />
      )}
    </BlockShell>
  );
}

// ============== Edit sheet ==============

function EditWishlistSheet({ eventId, item, currency, position, onSaved, onClose }: {
  eventId: string;
  item: Item | null;
  currency: string;
  position: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [url, setUrl] = useState(item?.url || '');
  const [imageUrl, setImageUrl] = useState(item?.image_url || '');
  const [price, setPrice] = useState(item?.price_estimate ? String(item.price_estimate) : '');
  const [saving, setSaving] = useState(false);

  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const patch: any = {
      event_id: eventId,
      title: title.trim(),
      description: description.trim() || null,
      url: url.trim() || null,
      image_url: imageUrl.trim() || null,
      price_estimate: price.trim() ? parseInt(price.replace(/[^\d]/g, '')) || null : null,
      price_currency: price.trim() ? currency : null,
      position,
    };
    if (item) {
      await supabase.from('event_wishlist_items').update(patch).eq('id', item.id);
    } else {
      await supabase.from('event_wishlist_items').insert(patch);
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
          {item ? 'Изменить подарок' : 'Новый подарок в Wishlist'}
        </h3>

        <Label>Что хочется</Label>
        <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
          maxLength={100} placeholder="Bluetooth-колонка" style={inputStyle()} />

        <Label optional>Описание / детали</Label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          maxLength={300} rows={2} placeholder="Чёрного цвета, не больше 5000 руб"
          style={{...inputStyle(), resize:'vertical', fontFamily:'inherit'}} />

        <Label optional>Ссылка</Label>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://wildberries.ru/..." style={inputStyle()} />

        <Label optional>URL картинки</Label>
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
          placeholder="https://..." style={inputStyle()} />

        <Label optional>Примерная цена ({currency})</Label>
        <input value={price} onChange={e => setPrice(e.target.value.replace(/[^\d]/g,''))}
          inputMode="numeric" placeholder="5000" style={inputStyle()} />

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
