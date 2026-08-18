import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, updateBlockItem, fetchResponses, setResponse, removeResponse, type BlockItem, type BlockResponse } from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import BlockShell from './BlockShell';
import { IconCar } from '@/components/icons/EventIcons';

interface Props { eventId: string; canEdit: boolean; }

export default function CarsBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string }>>({});
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [driver, setDriver] = useState('');
  const [seats, setSeats] = useState('4');
  const [loading, setLoading] = useState(true);
  const myId = useAuthStore(s => s.session?.user?.id);

  const refresh = async () => {
    const its = await fetchBlockItems(eventId, 'cars');
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
  void updateBlockItem; // reserved for future edit

  const handleAdd = async () => {
    if (!name.trim()) return;
    const s = parseInt(seats) || 4;
    const item = await addBlockItem(eventId, 'cars', { name: name.trim(), driver: driver.trim(), seats: s }, items.length);
    if (item) { setItems(prev => [...prev, item]); setName(''); setDriver(''); setSeats('4'); setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить машину?')) return;
    if (await deleteBlockItem(id)) {
      setItems(prev => prev.filter(i => i.id !== id));
      setResponses(prev => prev.filter(r => r.item_id !== id));
    }
  };

  const handleToggle = async (itemId: string) => {
    const myResp = responses.find(r => r.item_id === itemId && r.user_id === myId && r.response_kind === 'in_car');
    if (myResp) {
      if (await removeResponse(itemId, 'in_car')) setResponses(prev => prev.filter(r => r.id !== myResp.id));
    } else {
      // Удаляем из других машин
      const other = responses.find(r => r.user_id === myId && r.response_kind === 'in_car');
      if (other) await removeResponse(other.item_id, 'in_car');
      if (await setResponse(itemId, 'in_car')) await refresh();
    }
  };

  return (
    <BlockShell
      icon={<IconCar size={16} strokeWidth={2.1} />}
      iconBg="#1F2937"
      title="Машины"
      subtitle={items.length > 0 ? `${items.length} машин` : 'Кто за рулём, кто пассажир'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Распределите кто на чём едет
        </div>
      )}
      {items.map(item => {
        const passengers = responses.filter(r => r.item_id === item.id && r.response_kind === 'in_car');
        const inThisCar = passengers.some(p => p.user_id === myId);
        const seatsLeft = (item.data.seats || 0) - passengers.length;
        return (
          <div key={item.id} style={{ padding: 12, marginBottom: 8, background: 'var(--bg)', borderRadius: 8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)' }}>{item.data.name}</div>
                {item.data.driver && <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>За рулём: {item.data.driver}</div>}
              </div>
              <div style={{ fontSize: 'var(--fs-micro)', color: seatsLeft > 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                {passengers.length}/{item.data.seats} мест
              </div>
              {canEdit && <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',padding:2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              </button>}
            </div>
            {passengers.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap: 4, marginBottom: 6 }}>
                {passengers.map(p => (
                  <div key={p.id} style={{ fontSize: 'var(--fs-micro)', padding: '2px 8px', background: 'var(--surface-light)', borderRadius: 6, color: 'var(--text)' }}>
                    {profiles[p.user_id]?.display_name || '...'}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => handleToggle(item.id)} disabled={!inThisCar && seatsLeft <= 0} style={{
              width:'100%', padding: 6, borderRadius: 6,
              background: inThisCar ? 'var(--primary)' : 'var(--surface-light)',
              color: inThisCar ? 'var(--bg)' : (seatsLeft > 0 ? 'var(--text)' : 'var(--muted)'),
              border: inThisCar ? 'none' : '1px solid var(--border)',
              fontSize: 'var(--fs-caption)', fontWeight: 600,
              cursor: (!inThisCar && seatsLeft <= 0) ? 'not-allowed' : 'pointer',
            }}>
              {inThisCar ? '✓ Еду здесь' : (seatsLeft > 0 ? 'Сесть в машину' : 'Мест нет')}
            </button>
          </div>
        );
      })}
      {adding && (
        <div style={{ padding: '4px 4px 0', display:'flex', flexDirection:'column', gap:6 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Машина (например: Серая Хонда)" autoFocus style={inputStyle}/>
          <input value={driver} onChange={e => setDriver(e.target.value)} placeholder="Водитель" style={inputStyle}/>
          <input value={seats} onChange={e => setSeats(e.target.value)} placeholder="Свободных мест" type="number" min="1" max="20" style={inputStyle}/>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setAdding(false); setName(''); setDriver(''); setSeats('4'); }} style={cancelBtn}>Отмена</button>
            <button onClick={handleAdd} disabled={!name.trim()} style={{ ...saveBtn, opacity: name.trim() ? 1 : 0.5 }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const inputStyle: React.CSSProperties = { width:'100%',minWidth:0,maxWidth:'100%',boxSizing:'border-box',padding:10,borderRadius:12,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize: 'var(--fs-label)' };
const cancelBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:12,background:'var(--surface-light)',border:'1px solid var(--border)',color:'var(--text)',fontSize: 'var(--fs-label)',cursor:'pointer' };
const saveBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:12,background:'var(--primary)',color:'var(--bg)',border:'none',fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer' };
