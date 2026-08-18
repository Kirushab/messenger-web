import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import BlockShell from './event-blocks/BlockShell';
import { useAuthStore } from '@/stores/authStore';
import { avatarColor } from '@/lib/utils';
import AnimatedCheckbox from './AnimatedCheckbox';

interface Item {
  id: string;
  event_id: string;
  title: string;
  qty: string | null;
  done: boolean;
  done_by: string | null;
  done_at: string | null;
  position: number;
  created_by: string | null;
  done_by_user?: { id: string; display_name: string; avatar_url: string | null } | null;
}

export default function EventShoppingList({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const { user } = useAuthStore();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newQty, setNewQty] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const { data } = await supabase
      .from('event_shopping_items')
      .select('*, done_by_user:users!event_shopping_items_done_by_fkey(id, display_name, avatar_url)')
      .eq('event_id', eventId)
      .order('done', { ascending: true })
      .order('position');
    setItems((data || []) as Item[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [eventId]);

  useEffect(() => {
    const ch = supabase.channel(`event-shopping-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_shopping_items', filter: `event_id=eq.${eventId}` }, () => reload())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [eventId]);

  const addItem = async () => {
    const title = newTitle.trim();
    const qty = newQty.trim() || null;
    if (!title || !user) return;
    setNewTitle(''); setNewQty(''); setAdding(false);
    const { error } = await supabase.from('event_shopping_items').insert({
      event_id: eventId, title,
      qty,
      created_by: user.id, position: items.length,
    });
    if (error) await reload();
    else await reload();
  };

  const toggleDone = async (item: Item) => {
    if (!user) return;
    const nextDone = !item.done;
    const nextDoneAt = nextDone ? new Date().toISOString() : null;
    const nextDoneBy = nextDone ? user.id : null;
    const me = nextDone ? { id: user.id, display_name: user.display_name || 'Вы', avatar_url: user.avatar_url || null } : null;
    setItems(prev => prev.map(row => row.id === item.id ? { ...row, done: nextDone, done_by: nextDoneBy, done_at: nextDoneAt, done_by_user: me } : row));
    const { error } = await supabase.from('event_shopping_items').update({ done: nextDone, done_by: nextDoneBy, done_at: nextDoneAt }).eq('id', item.id);
    if (error) setItems(prev => prev.map(row => row.id === item.id ? item : row));
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить пункт?')) return;
    const removed = items.find(row => row.id === id);
    setItems(prev => prev.filter(row => row.id !== id));
    const { error } = await supabase.from('event_shopping_items').delete().eq('id', id);
    if (error && removed) await reload();
  };

  const doneCount = items.filter(i => i.done).length;

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>}
      iconBg="#8B5CF6"
      title="Купить"
      subtitle={items.length > 0 ? `${doneCount}/${items.length} куплено` : undefined}
      onAdd={canEdit && !adding ? () => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 50); } : undefined}
      addLabel="Покупка"
    >
      {loading && <div style={{padding:24,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>}

      {!loading && items.length === 0 && !adding && (
        <div style={{padding:'16px 12px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-label)'}}>
          Список покупок пуст
        </div>
      )}

      {items.map(item => (
        <div key={item.id} style={{
          display:'flex',alignItems:'center',gap:10,
          padding:'8px 12px',marginBottom:5,
          background:'var(--bg)',borderRadius:10,
          opacity: item.done ? 0.55 : 1,
        }}>
          <AnimatedCheckbox done={item.done} onToggle={() => toggleDone(item)} size={18} />
          <div style={{flex:1,fontSize: 'var(--fs-snap14)',color:'var(--text)',
            textDecoration: item.done ? 'line-through' : 'none',minWidth:0}}>
            {item.title}
            {item.qty && <span style={{color:'var(--muted)',marginLeft:6,fontSize: 'var(--fs-caption)'}}>· {item.qty}</span>}
            {item.done && item.done_by_user && (
              <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginTop:2,display:'flex',alignItems:'center',gap:4}}>
                {item.done_by_user.avatar_url
                  ? <img src={item.done_by_user.avatar_url} alt="" style={{width:14,height:14,borderRadius:7,objectFit:'cover'}} />
                  : <div style={{width:14,height:14,borderRadius:7,background:avatarColor(item.done_by_user.id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:600}}>{(item.done_by_user.display_name||'?')[0].toUpperCase()}</div>}
                <span>купил {item.done_by_user.display_name}</span>
              </div>
            )}
          </div>
          {canEdit && (item.created_by === user?.id || item.done_by === user?.id) && (
            <button onClick={() => remove(item.id)}
              style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      ))}

      {canEdit && adding && (
        <div style={{padding:'8px 10px',marginBottom:6,
          background:'var(--surface-light)',borderRadius:10,border:'1px solid var(--primary)',
          display:'flex',flexDirection:'column',gap:6}}>
          <div style={{display:'flex',gap:6}}>
            <input ref={inputRef} value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') { setAdding(false); setNewTitle(''); setNewQty(''); } }}
              placeholder="Хлеб"
              maxLength={80}
              style={{flex:2,padding:'6px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontSize: 'var(--fs-snap14)',outline:'none'}} />
            <input value={newQty}
              onChange={e => setNewQty(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
              placeholder="2 шт"
              maxLength={20}
              style={{flex:1,padding:'6px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontSize: 'var(--fs-snap14)',outline:'none'}} />
          </div>
          <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
            <button onClick={() => { setAdding(false); setNewTitle(''); setNewQty(''); }}
              style={{background:'none',border:'none',color:'var(--muted)',padding:'6px 10px',cursor:'pointer',fontSize: 'var(--fs-label)'}}>Отмена</button>
            <button onClick={addItem} disabled={!newTitle.trim()}
              style={{background: newTitle.trim() ? 'var(--primary)' : 'var(--border)',
                color: newTitle.trim() ? 'var(--bg)' : 'var(--muted)',
                border:'none',padding:'6px 14px',borderRadius:8,fontSize: 'var(--fs-label)',fontWeight:600,
                cursor: newTitle.trim() ? 'pointer' : 'default'}}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}
