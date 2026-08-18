import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, type BlockItem } from '@/lib/eventBlocks';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

const QUICK = [
  { title: 'Полиция', phone: '102', emoji: '🚓' },
  { title: 'Скорая', phone: '103', emoji: '🚑' },
  { title: 'Пожарные', phone: '101', emoji: '🚒' },
  { title: 'Единый номер', phone: '112', emoji: '🆘' },
];

export default function EmergencyBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockItems(eventId, 'emergency').then(rows => { setItems(rows); setLoading(false); });
  }, [eventId]);

  const handleAdd = async (t?: string, p?: string, em?: string) => {
    const finalTitle = (t ?? title).trim();
    const finalPhone = (p ?? phone).trim();
    if (!finalTitle || !finalPhone) return;
    const item = await addBlockItem(eventId, 'emergency', { title: finalTitle, phone: finalPhone, emoji: em || '☎️' }, items.length);
    if (item) { setItems(prev => [...prev, item]); setTitle(''); setPhone(''); setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить контакт?')) return;
    if (await deleteBlockItem(id)) setItems(prev => prev.filter(i => i.id !== id));
  };

  const usedTitles = new Set(items.map(i => i.data.title));

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
      iconBg="#DC2626"
      title="Экстренные контакты"
      subtitle="SOS / помощь"
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && canEdit && (
        <>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', padding: '0 4px 6px' }}>Быстро добавить:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {QUICK.map(q => (
              <button key={q.title} onClick={() => handleAdd(q.title, q.phone, q.emoji)} disabled={usedTitles.has(q.title)} style={{
                padding: '6px 10px', borderRadius: 8,
                background: usedTitles.has(q.title) ? 'var(--border)' : 'var(--surface-light)',
                color: 'var(--text)', border: '1px solid var(--border)',
                fontSize: 'var(--fs-micro)', cursor: usedTitles.has(q.title) ? 'default' : 'pointer',
                opacity: usedTitles.has(q.title) ? 0.5 : 1,
              }}>{q.emoji} {q.title}</button>
            ))}
          </div>
        </>
      )}
      {items.map(item => (
        <a key={item.id} href={`tel:${item.data.phone}`} style={{
          display:'flex', alignItems:'center', gap: 10,
          padding: '10px 12px', marginBottom: 6,
          background: 'rgba(220,38,38,0.10)', borderRadius: 8,
          border: '1px solid rgba(220,38,38,0.25)',
          textDecoration: 'none', color: 'var(--text)',
        }}>
          <div style={{ fontSize: 'var(--fs-title)', flexShrink: 0 }}>{item.data.emoji || '☎️'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600 }}>{item.data.title}</div>
            <div style={{ fontSize: 'var(--fs-snap14)', color: '#DC2626', fontWeight: 700 }}>{item.data.phone}</div>
          </div>
          {canEdit && (
            <button onClick={(e) => { e.preventDefault(); handleDelete(item.id); }} aria-label="Удалить" style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',padding:4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
            </button>
          )}
        </a>
      ))}
      {adding && (
        <div style={{ padding: '4px 4px 0', display:'flex', flexDirection:'column', gap:6 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Название (например: Посольство РФ)" autoFocus style={inputStyle}/>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Телефон" type="tel" style={inputStyle}/>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setAdding(false); setTitle(''); setPhone(''); }} style={cancelBtn}>Отмена</button>
            <button onClick={() => handleAdd()} disabled={!title.trim() || !phone.trim()} style={{ ...saveBtn, opacity: (title.trim() && phone.trim()) ? 1 : 0.5 }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const inputStyle: React.CSSProperties = { width:'100%',padding:10,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize: 'var(--fs-label)' };
const cancelBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--surface-light)',border:'1px solid var(--border)',color:'var(--text)',fontSize: 'var(--fs-label)',cursor:'pointer' };
const saveBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'#DC2626',color:'#fff',border:'none',fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer' };
