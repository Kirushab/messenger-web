import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, type BlockItem } from '@/lib/eventBlocks';
import BlockShell from './BlockShell';

interface Props {
  eventId: string;
  canEdit: boolean;
}

export default function NotesBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockItems(eventId, 'notes').then(rows => { setItems(rows); setLoading(false); });
  }, [eventId]);

  const handleSave = async () => {
    if (!text.trim()) return;
    const item = await addBlockItem(eventId, 'notes', { text: text.trim() }, items.length);
    if (item) { setItems(prev => [...prev, item]); setText(''); setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить заметку?')) return;
    if (await deleteBlockItem(id)) setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>}
      iconBg="#F59E0B"
      title="Заметки"
      subtitle={items.length > 0 ? `${items.length} зап.` : 'Важная информация'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Пока ничего нет
        </div>
      )}
      {items.map(item => (
        <div key={item.id} style={{
          padding: '10px 12px', marginBottom: 6,
          background: 'var(--bg)', borderRadius: 8,
          fontSize: 'var(--fs-label)', color: 'var(--text)', lineHeight: 1.45,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          position: 'relative',
        }}>
          {item.data.text}
          {canEdit && (
            <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{
              position: 'absolute', top: 6, right: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: 2, display: 'flex',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      ))}
      {adding && (
        <div style={{ padding: '4px 4px 0' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Например: парковка с задней стороны, домофон 25..."
            autoFocus
            rows={3}
            style={{
              width: '100%', padding: 10, borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)',
              fontSize: 'var(--fs-label)', fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => { setAdding(false); setText(''); }} style={{
              flex: 1, padding: '8px', borderRadius: 8,
              background: 'var(--surface-light)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 'var(--fs-label)', cursor: 'pointer',
            }}>Отмена</button>
            <button onClick={handleSave} disabled={!text.trim()} style={{
              flex: 1, padding: '8px', borderRadius: 8,
              background: text.trim() ? 'var(--primary)' : 'var(--surface-light)',
              color: text.trim() ? 'var(--bg)' : 'var(--muted)',
              border: 'none', fontSize: 'var(--fs-label)', fontWeight: 600,
              cursor: text.trim() ? 'pointer' : 'default',
            }}>Сохранить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}
