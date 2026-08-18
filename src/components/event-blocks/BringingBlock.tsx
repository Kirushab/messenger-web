import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, fetchResponses, setResponse, removeResponse, type BlockItem, type BlockResponse } from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import BlockShell from './BlockShell';

interface Props {
  eventId: string;
  canEdit: boolean;
}

export default function BringingBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string }>>({});
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const myId = useAuthStore(s => s.session?.user?.id);

  const refresh = async () => {
    const its = await fetchBlockItems(eventId, 'bringing');
    setItems(its);
    if (its.length > 0) {
      const resps = await fetchResponses(its.map(i => i.id));
      setResponses(resps);
      // Подтягиваем профили
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
    if (!text.trim()) return;
    const item = await addBlockItem(eventId, 'bringing', { text: text.trim() }, items.length);
    if (item) { setItems(prev => [...prev, item]); setText(''); setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить позицию?')) return;
    if (await deleteBlockItem(id)) { setItems(prev => prev.filter(i => i.id !== id)); setResponses(prev => prev.filter(r => r.item_id !== id)); }
  };

  const handleClaim = async (itemId: string) => {
    if (!myId) return;
    const before = responses;
    const mine = responses.find(r => r.item_id === itemId && r.user_id === myId && r.response_kind === 'claimed');
    if (mine) {
      setResponses(prev => prev.filter(r => r.id !== mine.id));
      if (!(await removeResponse(itemId, 'claimed'))) setResponses(before);
    } else {
      const optimistic: BlockResponse = {
        id: `optimistic-${itemId}-${myId}`,
        item_id: itemId,
        user_id: myId,
        response_kind: 'claimed',
        data: null,
        created_at: new Date().toISOString(),
      };
      setResponses(prev => [...prev, optimistic]);
      if (!(await setResponse(itemId, 'claimed'))) setResponses(before);
      else void refresh();
    }
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>}
      iconBg="#EC4899"
      title="Кто что приносит"
      subtitle={items.length > 0 ? `${responses.filter(r => r.response_kind === 'claimed').length}/${items.length} разобрано` : 'Разберите позиции'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Что нужно принести / приготовить?
        </div>
      )}
      {items.map(item => {
        const claimers = responses.filter(r => r.item_id === item.id && r.response_kind === 'claimed');
        const claimed = claimers.length > 0;
        const myClaim = claimers.some(c => c.user_id === myId);
        return (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', marginBottom: 6,
            background: 'var(--bg)', borderRadius: 8,
            opacity: claimed && !myClaim ? 0.65 : 1,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-label)', fontWeight: 500, color: 'var(--text)', textDecoration: claimed ? 'line-through' : 'none' }}>
                {item.data.text}
              </div>
              {claimed && (
                <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 2 }}>
                  {claimers.map(c => profiles[c.user_id]?.display_name || '...').join(', ')}
                </div>
              )}
            </div>
            <button onClick={() => handleClaim(item.id)} style={{
              padding: '6px 10px', borderRadius: 8,
              background: myClaim ? 'var(--primary)' : 'var(--surface-light)',
              color: myClaim ? 'var(--bg)' : 'var(--text)',
              border: myClaim ? 'none' : '1px solid var(--border)',
              fontSize: 'var(--fs-micro)', fontWeight: 600, cursor: 'pointer',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              {myClaim ? 'Беру ✓' : 'Беру это'}
            </button>
            {canEdit && (
              <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', padding: 2, display: 'flex',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        );
      })}
      {adding && (
        <div style={{ padding: '4px 4px 0' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Например: оливье, торт, вино..."
            autoFocus
            style={{
              width: '100%', padding: 10, borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: 'var(--fs-label)',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => { setAdding(false); setText(''); }} style={cancelBtn}>Отмена</button>
            <button onClick={handleAdd} disabled={!text.trim()} style={{ ...saveBtn, opacity: text.trim() ? 1 : 0.5 }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const cancelBtn: React.CSSProperties = {
  flex: 1, padding: 8, borderRadius: 8,
  background: 'var(--surface-light)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 'var(--fs-label)', cursor: 'pointer',
};
const saveBtn: React.CSSProperties = {
  flex: 1, padding: 8, borderRadius: 8,
  background: 'var(--primary)', color: 'var(--bg)',
  border: 'none', fontSize: 'var(--fs-label)', fontWeight: 600, cursor: 'pointer',
};
