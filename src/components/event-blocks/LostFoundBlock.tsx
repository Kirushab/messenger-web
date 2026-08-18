import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, updateBlockItem, type BlockItem } from '@/lib/eventBlocks';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

export default function LostFoundBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'lost' | 'found'>('lost');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockItems(eventId, 'lost_found').then(rows => { setItems(rows); setLoading(false); });
  }, [eventId]);

  const handleAdd = async () => {
    if (!text.trim()) return;
    const item = await addBlockItem(eventId, 'lost_found', { text: text.trim(), status }, items.length);
    if (item) { setItems(prev => [...prev, item]); setText(''); setStatus('lost'); setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить запись?')) return;
    if (await deleteBlockItem(id)) setItems(prev => prev.filter(i => i.id !== id));
  };

  const toggleStatus = async (item: BlockItem) => {
    const next = item.data.status === 'lost' ? 'found' : 'lost';
    if (await updateBlockItem(item.id, { data: { ...item.data, status: next } })) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, data: { ...i.data, status: next } } : i));
    }
  };

  const lost = items.filter(i => i.data.status === 'lost').length;
  const found = items.filter(i => i.data.status === 'found').length;

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
      iconBg="#F59E0B"
      title="Бюро находок"
      subtitle={items.length > 0 ? `🔴 ${lost} потеряно · 🟢 ${found} найдено` : 'Что забыли / нашли'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Что-то потеряли или нашли?
        </div>
      )}
      {items.map(item => {
        const isLost = item.data.status === 'lost';
        return (
          <div key={item.id} style={{
            display:'flex', alignItems:'center', gap: 10,
            padding: '10px 12px', marginBottom: 6,
            background: isLost ? 'rgba(245,158,11,0.10)' : 'rgba(16,185,129,0.10)',
            borderRadius: 8,
            border: `1px solid ${isLost ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`,
          }}>
            <button onClick={() => canEdit && toggleStatus(item)} disabled={!canEdit} style={{
              padding: '3px 8px', borderRadius: 12,
              background: isLost ? '#F59E0B' : '#10B981',
              color: '#fff', border: 'none', fontSize: 'var(--fs-snap10)', fontWeight: 700,
              cursor: canEdit ? 'pointer' : 'default', flexShrink: 0,
            }}>{isLost ? 'ПОТЕРЯНО' : 'НАЙДЕНО'}</button>
            <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-label)', color: 'var(--text)', wordBreak: 'break-word' }}>{item.data.text}</div>
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
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setStatus('lost')} style={{
              flex: 1, padding: '8px', borderRadius: 8,
              background: status === 'lost' ? '#F59E0B' : 'var(--surface-light)',
              color: status === 'lost' ? '#fff' : 'var(--text)',
              border: 'none', fontSize: 'var(--fs-caption)', fontWeight: 600, cursor: 'pointer',
            }}>🔴 Потерял</button>
            <button onClick={() => setStatus('found')} style={{
              flex: 1, padding: '8px', borderRadius: 8,
              background: status === 'found' ? '#10B981' : 'var(--surface-light)',
              color: status === 'found' ? '#fff' : 'var(--text)',
              border: 'none', fontSize: 'var(--fs-caption)', fontWeight: 600, cursor: 'pointer',
            }}>🟢 Нашёл</button>
          </div>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Что? (например: чёрные носки, ключи от номера)" autoFocus style={inputStyle}/>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setAdding(false); setText(''); }} style={cancelBtn}>Отмена</button>
            <button onClick={handleAdd} disabled={!text.trim()} style={{ ...saveBtn, opacity: text.trim() ? 1 : 0.5 }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const inputStyle: React.CSSProperties = { width:'100%',padding:10,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize: 'var(--fs-label)' };
const cancelBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--surface-light)',border:'1px solid var(--border)',color:'var(--text)',fontSize: 'var(--fs-label)',cursor:'pointer' };
const saveBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--primary)',color:'var(--bg)',border:'none',fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer' };
