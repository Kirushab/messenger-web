import { useEffect, useRef, useState } from 'react';
import BlockShell from './event-blocks/BlockShell';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import AnimatedCheckbox from './AnimatedCheckbox';

interface Item {
  id: string;
  event_id: string;
  user_id: string;
  title: string;
  done: boolean;
  position: number;
}

const SUGGESTIONS = [
  'Паспорт', 'Зарядка', 'Зубная щётка', 'Адаптер', 'Лекарства',
  'Тренировочная одежда', 'Купальник', 'Очки',
];

export default function EventPackingList({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const { user } = useAuthStore();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('event_packing_items')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .order('done', { ascending: true })
      .order('position');
    setItems((data || []) as Item[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [eventId, user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`event-packing-${eventId}-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'event_packing_items',
        filter: `event_id=eq.${eventId}`,
      }, () => reload())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [eventId, user?.id]);

  const addItem = async (title?: string) => {
    const t = (title ?? newTitle).trim();
    if (!t || !user) return;
    setNewTitle('');
    setAdding(false);
    const { error } = await supabase.from('event_packing_items').insert({
      event_id: eventId, user_id: user.id, title: t, position: items.length,
    });
    if (error) await reload();
    else await reload();
  };

  const toggleDone = async (item: Item) => {
    const nextDone = !item.done;
    setItems(prev => prev.map(row => row.id === item.id ? { ...row, done: nextDone } : row));
    const { error } = await supabase.from('event_packing_items').update({ done: nextDone }).eq('id', item.id);
    if (error) setItems(prev => prev.map(row => row.id === item.id ? item : row));
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить пункт?')) return;
    setItems(prev => prev.filter(row => row.id !== id));
    const { error } = await supabase.from('event_packing_items').delete().eq('id', id);
    if (error) await reload();
  };

  const doneCount = items.filter(i => i.done).length;
  // Не показываем уже добавленные предложения
  const titleSet = new Set(items.map(i => i.title.toLowerCase()));
  const suggestions = SUGGESTIONS.filter(s => !titleSet.has(s.toLowerCase()));

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
      iconBg="#06B6D4"
      title="Мой багаж"
      subtitle={items.length > 0 ? `${doneCount}/${items.length} собрано` : undefined}
      onAdd={canEdit && !adding ? () => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 50); } : undefined}
      addLabel="Пункт"
    >
      {loading && <div style={{padding:24,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>}

      {!loading && items.length === 0 && !adding && (
        <div style={{padding:'16px 12px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-label)'}}>
          Что взять с собой
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
            textDecoration: item.done ? 'line-through' : 'none'}}>
            {item.title}
          </div>
          {canEdit && <button onClick={() => remove(item.id)}
            style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>}
        </div>
      ))}

      {canEdit && adding && (
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',marginBottom:6,
          background:'var(--surface-light)',borderRadius:10,border:'1px solid var(--primary)'}}>
          <input ref={inputRef} value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') { setAdding(false); setNewTitle(''); } }}
            placeholder="например, паспорт"
            maxLength={80}
            style={{flex:1,padding:'6px 4px',background:'transparent',border:'none',color:'var(--text)',fontSize: 'var(--fs-snap14)',outline:'none'}} />
          <button onClick={() => addItem()} disabled={!newTitle.trim()}
            style={{background: newTitle.trim() ? 'var(--primary)' : 'var(--border)',
              color: newTitle.trim() ? 'var(--bg)' : 'var(--muted)',
              border:'none',padding:'6px 12px',borderRadius:8,fontSize: 'var(--fs-label)',fontWeight:600,
              cursor: newTitle.trim() ? 'pointer' : 'default'}}>OK</button>
          <button onClick={() => { setAdding(false); setNewTitle(''); }}
            style={{background:'none',border:'none',color:'var(--muted)',padding:4,cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Предложения */}
      {canEdit && !loading && suggestions.length > 0 && items.length < 6 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:6}}>
          {suggestions.slice(0, 5).map(s => (
            <button key={s} onClick={() => addItem(s)}
              style={{padding:'5px 10px',borderRadius:14,background:'var(--surface)',
                border:'1px dashed var(--border)',cursor:'pointer',
                color:'var(--muted)',fontSize: 'var(--fs-micro)'}}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </BlockShell>
  );
}
