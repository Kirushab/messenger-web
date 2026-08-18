import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, updateBlockItem, type BlockItem } from '@/lib/eventBlocks';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: 'К сделать', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
  in_progress: { label: 'В процессе', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  done: { label: 'Готово', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
};

export default function RoadmapBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockItems(eventId, 'roadmap').then(rows => { setItems(rows); setLoading(false); });
  }, [eventId]);

  const handleAdd = async () => {
    if (!title.trim()) return;
    const item = await addBlockItem(eventId, 'roadmap', { title: title.trim(), status: 'todo' }, items.length);
    if (item) { setItems(prev => [...prev, item]); setTitle(''); setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этап?')) return;
    if (await deleteBlockItem(id)) setItems(prev => prev.filter(i => i.id !== id));
  };

  const cycleStatus = async (item: BlockItem) => {
    const order = ['todo', 'in_progress', 'done'];
    const idx = order.indexOf(item.data.status || 'todo');
    const next = order[(idx + 1) % order.length];
    if (await updateBlockItem(item.id, { data: { ...item.data, status: next } })) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, data: { ...i.data, status: next } } : i));
    }
  };

  const done = items.filter(i => i.data.status === 'done').length;
  const progress = items.length > 0 ? Math.round(done / items.length * 100) : 0;

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
      iconBg="#A855F7"
      title="Подготовка"
      subtitle={items.length > 0 ? `${done}/${items.length} · ${progress}%` : 'Этапы подготовки'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Добавьте этапы подготовки
        </div>
      )}
      {items.length > 0 && (
        <div style={{
          height: 6, background: 'var(--bg)', borderRadius: 3,
          overflow: 'hidden', marginBottom: 10,
        }}>
          <div style={{
            height: '100%', width: progress + '%',
            background: 'linear-gradient(90deg, #A855F7, #6366F1)',
            transition: 'width 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}/>
        </div>
      )}
      {items.map(item => {
        const meta = STATUS_META[item.data.status || 'todo'];
        return (
          <div key={item.id} style={{
            display:'flex', alignItems:'center', gap: 10,
            padding: '10px 12px', marginBottom: 6,
            background: 'var(--bg)', borderRadius: 8,
            opacity: item.data.status === 'done' ? 0.7 : 1,
          }}>
            <button onClick={() => canEdit && cycleStatus(item)} disabled={!canEdit} style={{
              width: 22, height: 22, borderRadius: 11,
              background: meta.bg, color: meta.color,
              border: `1.5px solid ${meta.color}`,
              cursor: canEdit ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, padding: 0,
            }}>
              {item.data.status === 'done' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
              {item.data.status === 'in_progress' && <div style={{ width: 8, height: 8, borderRadius: 4, background: meta.color }}/>}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text)', textDecoration: item.data.status === 'done' ? 'line-through' : 'none' }}>{item.data.title}</div>
              <div style={{ fontSize: 'var(--fs-snap10)', color: meta.color, fontWeight: 600 }}>{meta.label}</div>
            </div>
            {canEdit && <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',padding:2 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
            </button>}
          </div>
        );
      })}
      {adding && (
        <div style={{ padding: '4px 4px 0' }}>
          <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                 placeholder="Например: купить билеты, забронировать отель..." autoFocus style={inputStyle}/>
          <div style={{ display:'flex', gap:6, marginTop: 6 }}>
            <button onClick={() => { setAdding(false); setTitle(''); }} style={cancelBtn}>Отмена</button>
            <button onClick={handleAdd} disabled={!title.trim()} style={{ ...saveBtn, opacity: title.trim() ? 1 : 0.5 }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const inputStyle: React.CSSProperties = { width:'100%',padding:10,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize: 'var(--fs-label)' };
const cancelBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--surface-light)',border:'1px solid var(--border)',color:'var(--text)',fontSize: 'var(--fs-label)',cursor:'pointer' };
const saveBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--primary)',color:'var(--bg)',border:'none',fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer' };
