import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { avatarColor } from '@/lib/utils';
import AnimatedCheckbox from './AnimatedCheckbox';
import BlockShell from './event-blocks/BlockShell';

interface ChecklistItem {
  id: string;
  event_id: string;
  title: string;
  assigned_to: string | null;
  done: boolean;
  done_by: string | null;
  done_at: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  assignee?: { id: string; display_name: string; avatar_url: string | null } | null;
}

interface Member {
  user_id: string;
  user: { id: string; display_name: string; avatar_url: string | null };
}

export default function EventChecklist({ eventId, canEdit, members }: {
  eventId: string;
  canEdit: boolean;
  members: Member[];
}) {
  const { user } = useAuthStore();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState<string | null>(null);
  const [showAssignPicker, setShowAssignPicker] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const { data } = await supabase
      .from('event_checklist')
      .select('*, assignee:users!event_checklist_assigned_to_fkey(id, display_name, avatar_url)')
      .eq('event_id', eventId)
      .order('done', { ascending: true })
      .order('position');
    setItems((data || []) as ChecklistItem[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [eventId]);

  useEffect(() => {
    const ch = supabase.channel(`event-checklist-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_checklist', filter: `event_id=eq.${eventId}` }, () => reload())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [eventId]);

  const addItem = async () => {
    const title = newTitle.trim();
    if (!title || !user) return;
    setNewTitle('');
    setNewAssignedTo(null);
    setAdding(false);
    const { error } = await supabase.from('event_checklist').insert({
      event_id: eventId,
      title,
      assigned_to: newAssignedTo,
      created_by: user.id,
      position: items.length,
    });
    if (error) await reload();
    else await reload();
  };

  const toggleDone = async (item: ChecklistItem) => {
    if (!user) return;
    const nextDone = !item.done;
    const nextDoneAt = nextDone ? new Date().toISOString() : null;
    const nextDoneBy = nextDone ? user.id : null;
    setItems(prev => prev.map(row => row.id === item.id ? { ...row, done: nextDone, done_by: nextDoneBy, done_at: nextDoneAt } : row));
    const { error } = await supabase.from('event_checklist').update({
      done: nextDone, done_by: nextDoneBy, done_at: nextDoneAt,
    }).eq('id', item.id);
    if (error) setItems(prev => prev.map(row => row.id === item.id ? item : row));
  };

  const removeItem = async (item: ChecklistItem) => {
    if (!confirm('Удалить пункт?')) return;
    setItems(prev => prev.filter(row => row.id !== item.id));
    const { error } = await supabase.from('event_checklist').delete().eq('id', item.id);
    if (error) await reload();
  };

  const assign = async (itemId: string, userId: string | null) => {
    const nextAssignee = userId ? members.find(m => m.user_id === userId)?.user ?? null : null;
    setItems(prev => prev.map(row => row.id === itemId ? { ...row, assigned_to: userId, assignee: nextAssignee } : row));
    setShowAssignPicker(null);
    const { error } = await supabase.from('event_checklist').update({ assigned_to: userId }).eq('id', itemId);
    if (error) await reload();
  };

  const doneCount = items.filter(i => i.done).length;

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
      iconBg="#3B82F6"
      title="Чек-лист"
      subtitle={items.length > 0 ? `${doneCount}/${items.length} выполнено` : undefined}
      onAdd={canEdit && !adding ? () => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 50); } : undefined}
      addLabel="Пункт"
    >
      {loading && <div style={{padding:24,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>}

      {!loading && items.length === 0 && !adding && (
        <div style={{padding:'16px 12px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-label)'}}>
          Пока нет пунктов
        </div>
      )}

      {items.map(item => (
        <div key={item.id} style={{
          display:'flex',alignItems:'center',gap:10,
          padding:'10px 12px',marginBottom:6,
          background:'var(--bg)',borderRadius:10,
          opacity: item.done ? 0.55 : 1,
        }}>
          <AnimatedCheckbox done={item.done} onToggle={() => toggleDone(item)} size={20} />
          <div style={{flex:1,fontSize: 'var(--fs-snap14)',color:'var(--text)',
            textDecoration: item.done ? 'line-through' : 'none',
            overflow:'hidden',textOverflow:'ellipsis'}}>
            {item.title}
          </div>
          {canEdit ? (
            <button
              onClick={() => setShowAssignPicker(item.id)}
              style={{background:'none',border:'none',padding:0,cursor:'pointer',display:'flex',alignItems:'center'}}
              title={item.assignee?.display_name || 'Назначить'}
            >
              {item.assignee ? (
                item.assignee.avatar_url
                  ? <img src={item.assignee.avatar_url} alt="" style={{width:22,height:22,borderRadius:11,objectFit:'cover'}} />
                  : <div style={{width:22,height:22,borderRadius:11,background:avatarColor(item.assignee.id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-snap10)',fontWeight:600}}>{(item.assignee.display_name||'?')[0].toUpperCase()}</div>
              ) : (
                <div style={{width:22,height:22,borderRadius:11,border:'1px dashed var(--border)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)'}}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
                </div>
              )}
            </button>
          ) : item.assignee && (
            item.assignee.avatar_url
              ? <img src={item.assignee.avatar_url} alt="" style={{width:22,height:22,borderRadius:11,objectFit:'cover'}} />
              : <div style={{width:22,height:22,borderRadius:11,background:avatarColor(item.assignee.id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-snap10)',fontWeight:600}}>{(item.assignee.display_name||'?')[0].toUpperCase()}</div>
          )}
          {(canEdit || item.created_by === user?.id) && (
            <button onClick={() => removeItem(item)}
              style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      ))}

      {adding && (
        <div style={{
          display:'flex',alignItems:'center',gap:8,
          padding:'8px 10px',marginBottom:6,
          background:'var(--bg)',borderRadius:10,
          border:'1px solid var(--primary)',
        }}>
          <input
            ref={inputRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') { setAdding(false); setNewTitle(''); } }}
            placeholder="Что добавить..."
            maxLength={100}
            style={{flex:1,padding:'6px 4px',background:'transparent',border:'none',
              color:'var(--text)',fontSize: 'var(--fs-snap14)',outline:'none'}}
          />
          <button onClick={addItem} disabled={!newTitle.trim()}
            style={{background: newTitle.trim() ? 'var(--primary)' : 'var(--border)',
              color: newTitle.trim() ? 'var(--bg)' : 'var(--muted)',
              border:'none',padding:'6px 12px',borderRadius:8,fontSize: 'var(--fs-label)',fontWeight:600,cursor: newTitle.trim() ? 'pointer' : 'default'}}>OK</button>
          <button onClick={() => { setAdding(false); setNewTitle(''); }}
            style={{background:'none',border:'none',color:'var(--muted)',padding:4,cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Assign picker */}
      {showAssignPicker && (
        <div onClick={() => setShowAssignPicker(null)}
          style={{position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-end'}}>
          <div onClick={e => e.stopPropagation()}
            style={{width:'100%',background:'var(--bg)',borderRadius:'16px 16px 0 0',
              padding:'10px 16px max(20px, env(safe-area-inset-bottom, 20px))',maxHeight:'70vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:10}}>
              <div style={{width:36,height:4,borderRadius:2,background:'var(--border)'}} />
            </div>
            <h3 style={{margin:'0 0 12px',fontSize: 'var(--fs-snap16)',fontWeight:600}}>Кому поручить?</h3>
            <button
              onClick={() => assign(showAssignPicker, null)}
              style={{width:'100%',display:'flex',alignItems:'center',gap:10,
                padding:'10px 12px',marginBottom:6,background:'var(--surface-light)',
                border:'1px solid var(--border)',borderRadius:10,cursor:'pointer'}}>
              <div style={{width:32,height:32,borderRadius:16,border:'1px dashed var(--border)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)'}}>—</div>
              <span style={{fontSize: 'var(--fs-snap14)',color:'var(--text)'}}>Никому (общий пункт)</span>
            </button>
            {members.map(m => (
              <button
                key={m.user_id}
                onClick={() => assign(showAssignPicker, m.user_id)}
                style={{width:'100%',display:'flex',alignItems:'center',gap:10,
                  padding:'10px 12px',marginBottom:6,background:'var(--surface-light)',
                  border:'1px solid var(--border)',borderRadius:10,cursor:'pointer'}}>
                {m.user.avatar_url
                  ? <img src={m.user.avatar_url} alt="" style={{width:32,height:32,borderRadius:16,objectFit:'cover'}} />
                  : <div style={{width:32,height:32,borderRadius:16,background:avatarColor(m.user_id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-label)',fontWeight:600}}>{(m.user.display_name||'?')[0].toUpperCase()}</div>}
                <span style={{fontSize: 'var(--fs-snap14)',color:'var(--text)'}}>{m.user.display_name || 'Без имени'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </BlockShell>
  );
}
