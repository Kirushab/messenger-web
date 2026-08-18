import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, type BlockItem } from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

interface Member { user_id: string; display_name: string; }

export default function PersonalProgramBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string }>>({});
  const [adding, setAdding] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [text, setText] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(true);
  const myId = useAuthStore(s => s.session?.user?.id);
  const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine');

  const refresh = async () => {
    const its = await fetchBlockItems(eventId, 'personal_program');
    setItems(its);
    // Members
    const { data: memData } = await supabase.from('event_members').select('user_id').eq('event_id', eventId);
    const userIds = (memData || []).map(m => m.user_id);
    if (userIds.length > 0) {
      const { data: usrData } = await supabase.from('users').select('id,display_name').in('id', userIds);
      if (usrData) {
        const profMap = Object.fromEntries(usrData.map((u: any) => [u.id, { display_name: u.display_name }]));
        setProfiles(profMap);
        setMembers(usrData.map((u: any) => ({ user_id: u.id, display_name: u.display_name })));
      }
    }
    setLoading(false);
  };
  useEffect(() => { refresh(); }, [eventId]);

  const handleAdd = async () => {
    if (!targetUserId || !text.trim()) return;
    const item = await addBlockItem(eventId, 'personal_program', {
      user_id: targetUserId, text: text.trim(), time: time.trim(),
    }, items.length);
    if (item) {
      setItems(prev => [...prev, item]);
      setTargetUserId(''); setText(''); setTime(''); setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить пункт?')) return;
    if (await deleteBlockItem(id)) setItems(prev => prev.filter(i => i.id !== id));
  };

  const visibleItems = viewMode === 'mine'
    ? items.filter(i => i.data.user_id === myId)
    : items;
  // Сортируем по времени
  const sortedItems = [...visibleItems].sort((a, b) => (a.data.time || '').localeCompare(b.data.time || ''));

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
      iconBg="#06B6D4"
      title="Персональная программа"
      subtitle={viewMode === 'mine' ? `Только ваше · ${visibleItems.length} пунктов` : `Все: ${items.length}`}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button onClick={() => setViewMode('mine')} style={{
          flex: 1, padding: '6px', borderRadius: 6,
          background: viewMode === 'mine' ? '#06B6D4' : 'var(--bg)',
          color: viewMode === 'mine' ? '#fff' : 'var(--text)',
          border: 'none', fontSize: 'var(--fs-micro)', fontWeight: 600, cursor: 'pointer',
        }}>Только моё</button>
        {canEdit && (
          <button onClick={() => setViewMode('all')} style={{
            flex: 1, padding: '6px', borderRadius: 6,
            background: viewMode === 'all' ? '#06B6D4' : 'var(--bg)',
            color: viewMode === 'all' ? '#fff' : 'var(--text)',
            border: 'none', fontSize: 'var(--fs-micro)', fontWeight: 600, cursor: 'pointer',
          }}>Все участники</button>
        )}
      </div>

      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && sortedItems.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          {viewMode === 'mine' ? 'У вас пока нет персональных пунктов' : 'Никому ещё не назначена программа'}
        </div>
      )}
      {sortedItems.map(item => (
        <div key={item.id} style={{ display:'flex', alignItems:'flex-start', gap: 10, padding: '10px 12px', marginBottom: 6, background: 'var(--bg)', borderRadius: 8 }}>
          {item.data.time && (
            <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: '#06B6D4', minWidth: 42, paddingTop: 1 }}>{item.data.time}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text)', wordBreak: 'break-word' }}>{item.data.text}</div>
            {viewMode === 'all' && (
              <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 2 }}>
                Для: {profiles[item.data.user_id]?.display_name || '...'}
              </div>
            )}
          </div>
          {canEdit && (
            <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',padding:2 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
            </button>
          )}
        </div>
      ))}
      {adding && (
        <div style={{ padding: '4px 4px 0', display:'flex', flexDirection:'column', gap:6 }}>
          <select value={targetUserId} onChange={e => setTargetUserId(e.target.value)} style={inputStyle}>
            <option value="">Кому?</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
          </select>
          <input value={time} onChange={e => setTime(e.target.value)} placeholder="Время (необязательно, например: 14:00)" style={inputStyle}/>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Что нужно делать?" style={inputStyle}/>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setAdding(false); setTargetUserId(''); setText(''); setTime(''); }} style={cancelBtn}>Отмена</button>
            <button onClick={handleAdd} disabled={!targetUserId || !text.trim()} style={{ ...saveBtn, opacity: (targetUserId && text.trim()) ? 1 : 0.5 }}>Назначить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const inputStyle: React.CSSProperties = { width:'100%',padding:10,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize: 'var(--fs-label)' };
const cancelBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--surface-light)',border:'1px solid var(--border)',color:'var(--text)',fontSize: 'var(--fs-label)',cursor:'pointer' };
const saveBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--primary)',color:'var(--bg)',border:'none',fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer' };
