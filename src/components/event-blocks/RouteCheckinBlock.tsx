import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, fetchResponses, setResponse, removeResponse, type BlockItem, type BlockResponse } from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

export default function RouteCheckinBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string }>>({});
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const myId = useAuthStore(s => s.session?.user?.id);

  const refresh = async () => {
    const its = await fetchBlockItems(eventId, 'route_checkin');
    setItems(its);
    if (its.length > 0) {
      const resps = await fetchResponses(its.map(i => i.id));
      setResponses(resps);
      const ids = Array.from(new Set(resps.map(r => r.user_id)));
      if (ids.length > 0) {
        const { data } = await supabase.from('users').select('id,display_name').in('id', ids);
        if (data) setProfiles(Object.fromEntries(data.map((u: any) => [u.id, { display_name: u.display_name }])));
      }
    }
    setLoading(false);
  };
  useEffect(() => { refresh(); }, [eventId]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const item = await addBlockItem(eventId, 'route_checkin', { name: name.trim(), city: city.trim() }, items.length);
    if (item) { setItems(prev => [...prev, item]); setName(''); setCity(''); setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить точку?')) return;
    if (await deleteBlockItem(id)) {
      setItems(prev => prev.filter(i => i.id !== id));
      setResponses(prev => prev.filter(r => r.item_id !== id));
    }
  };

  const handleCheckin = async (itemId: string) => {
    const mine = responses.find(r => r.item_id === itemId && r.user_id === myId && r.response_kind === 'arrived');
    if (mine) {
      if (await removeResponse(itemId, 'arrived')) setResponses(prev => prev.filter(r => r.id !== mine.id));
    } else if (await setResponse(itemId, 'arrived')) await refresh();
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
      iconBg="#0D9488"
      title="Чек-ин по маршруту"
      subtitle={items.length > 0 ? `${items.length} точек` : 'Отмечайтесь в каждом городе'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Добавьте точки маршрута
        </div>
      )}
      {items.map((item, idx) => {
        const arrivals = responses.filter(r => r.item_id === item.id && r.response_kind === 'arrived');
        const iArrived = arrivals.some(a => a.user_id === myId);
        return (
          <div key={item.id} style={{ display:'flex', alignItems:'flex-start', gap: 10, padding: '10px 12px', marginBottom: 6, background: 'var(--bg)', borderRadius: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 12,
              background: arrivals.length > 0 ? '#0D9488' : 'var(--surface-light)',
              color: arrivals.length > 0 ? '#fff' : 'var(--muted)',
              fontSize: 'var(--fs-caption)', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              border: arrivals.length > 0 ? 'none' : '1px solid var(--border)',
            }}>{idx + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)' }}>{item.data.name}</div>
              {item.data.city && <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>{item.data.city}</div>}
              {arrivals.length > 0 && (
                <div style={{ fontSize: 'var(--fs-micro)', color: '#0D9488', marginTop: 4 }}>
                  Прибыли: {arrivals.map(a => profiles[a.user_id]?.display_name || '...').join(', ')}
                </div>
              )}
            </div>
            <button onClick={() => handleCheckin(item.id)} style={{
              padding: '4px 8px', borderRadius: 6,
              background: iArrived ? '#0D9488' : 'var(--surface-light)',
              color: iArrived ? '#fff' : 'var(--text)',
              border: iArrived ? 'none' : '1px solid var(--border)',
              fontSize: 'var(--fs-micro)', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}>{iArrived ? '✓ Тут' : 'Я тут'}</button>
            {canEdit && (
              <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',padding:2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              </button>
            )}
          </div>
        );
      })}
      {adding && (
        <div style={{ padding: '4px 4px 0', display:'flex', flexDirection:'column', gap:6 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Точка (например: Старый город)" autoFocus style={inputStyle}/>
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="Город (необязательно)" style={inputStyle}/>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setAdding(false); setName(''); setCity(''); }} style={cancelBtn}>Отмена</button>
            <button onClick={handleAdd} disabled={!name.trim()} style={{ ...saveBtn, opacity: name.trim() ? 1 : 0.5 }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const inputStyle: React.CSSProperties = { width:'100%',padding:10,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize: 'var(--fs-label)' };
const cancelBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--surface-light)',border:'1px solid var(--border)',color:'var(--text)',fontSize: 'var(--fs-label)',cursor:'pointer' };
const saveBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--primary)',color:'var(--bg)',border:'none',fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer' };
