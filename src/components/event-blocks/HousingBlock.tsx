import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, type BlockItem } from '@/lib/eventBlocks';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

const HOUSING_TYPES = [
  { id: 'hotel', label: 'Отель', emoji: '🏨' },
  { id: 'airbnb', label: 'Аренда', emoji: '🏠' },
  { id: 'hostel', label: 'Хостел', emoji: '🛏️' },
  { id: 'tent', label: 'Палатка', emoji: '⛺' },
];

export default function HousingBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('hotel');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockItems(eventId, 'housing').then(rows => { setItems(rows); setLoading(false); });
  }, [eventId]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const item = await addBlockItem(eventId, 'housing', {
      name: name.trim(), type, check_in: checkIn, check_out: checkOut, url: url.trim(),
    }, items.length);
    if (item) {
      setItems(prev => [...prev, item]);
      setName(''); setType('hotel'); setCheckIn(''); setCheckOut(''); setUrl('');
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить жильё?')) return;
    if (await deleteBlockItem(id)) setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
      iconBg="#F97316"
      title="Жильё"
      subtitle={items.length > 0 ? `${items.length} вариантов` : 'Где будем ночевать'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Добавьте отель / квартиру
        </div>
      )}
      {items.map(item => {
        const meta = HOUSING_TYPES.find(t => t.id === item.data.type) || HOUSING_TYPES[0];
        const ci = item.data.check_in ? new Date(item.data.check_in).toLocaleDateString('ru', { day: 'numeric', month: 'short' }) : '';
        const co = item.data.check_out ? new Date(item.data.check_out).toLocaleDateString('ru', { day: 'numeric', month: 'short' }) : '';
        return (
          <div key={item.id} style={{
            display:'flex', alignItems:'center', gap: 10,
            padding: '10px 12px', marginBottom: 6,
            background: 'var(--bg)', borderRadius: 8,
          }}>
            <div style={{ fontSize: 'var(--fs-title)', flexShrink: 0 }}>{meta.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)' }}>{item.data.name}</div>
              {(ci || co) && (
                <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>
                  {ci}{ci && co && ' — '}{co}
                </div>
              )}
              {item.data.url && (
                <a href={item.data.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--fs-micro)', color: '#3B82F6', textDecoration: 'none' }}>
                  Открыть →
                </a>
              )}
            </div>
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
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Название (например: Hilton Tbilisi)" autoFocus style={inputStyle}/>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {HOUSING_TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)} style={{
                padding: '6px 10px', borderRadius: 8,
                background: type === t.id ? 'var(--primary)' : 'var(--surface-light)',
                color: type === t.id ? 'var(--bg)' : 'var(--text)',
                border: 'none', fontSize: 'var(--fs-caption)', cursor: 'pointer',
              }}>{t.emoji} {t.label}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} placeholder="Заезд" style={{ ...inputStyle, flex:1 }}/>
            <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} placeholder="Выезд" style={{ ...inputStyle, flex:1 }}/>
          </div>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Ссылка на бронь (необязательно)" style={inputStyle}/>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setAdding(false); setName(''); setUrl(''); }} style={cancelBtn}>Отмена</button>
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
