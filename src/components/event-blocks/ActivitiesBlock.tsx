import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, fetchResponses, setResponse, removeResponse, type BlockItem, type BlockResponse } from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import BlockShell from './BlockShell';

interface Props {
  eventId: string;
  canEdit: boolean;
}

export default function ActivitiesBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const myId = useAuthStore(s => s.session?.user?.id);

  const refresh = async () => {
    const its = await fetchBlockItems(eventId, 'activities');
    setItems(its);
    if (its.length > 0) {
      setResponses(await fetchResponses(its.map(i => i.id)));
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [eventId]);

  const handleAdd = async () => {
    if (!text.trim()) return;
    const item = await addBlockItem(eventId, 'activities', { text: text.trim() }, items.length);
    if (item) { setItems(prev => [...prev, item]); setText(''); setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить активность?')) return;
    if (await deleteBlockItem(id)) { setItems(prev => prev.filter(i => i.id !== id)); setResponses(prev => prev.filter(r => r.item_id !== id)); }
  };

  const handleVote = async (itemId: string, kind: 'vote_yes' | 'vote_no') => {
    if (!myId) return;
    const opposite = kind === 'vote_yes' ? 'vote_no' : 'vote_yes';
    const before = responses;
    const myVote = responses.find(r => r.item_id === itemId && r.user_id === myId);
    if (myVote?.response_kind === kind) {
      setResponses(prev => prev.filter(r => r.id !== myVote.id));
      if (!(await removeResponse(itemId, kind))) setResponses(before);
    } else {
      const optimistic: BlockResponse = {
        id: `optimistic-${itemId}-${myId}`,
        item_id: itemId,
        user_id: myId,
        response_kind: kind,
        data: null,
        created_at: new Date().toISOString(),
      };
      setResponses(prev => [...prev.filter(r => !(r.item_id === itemId && r.user_id === myId && (r.response_kind === opposite || r.response_kind === kind))), optimistic]);
      if (myVote?.response_kind === opposite) await removeResponse(itemId, opposite);
      if (!(await setResponse(itemId, kind))) setResponses(before);
      else void refresh();
    }
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
      iconBg="#8B5CF6"
      title="Активности"
      subtitle={items.length > 0 ? `${items.length} вариантов` : 'Что будем делать?'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Предложите варианты, проголосуйте
        </div>
      )}
      {items.map(item => {
        const yes = responses.filter(r => r.item_id === item.id && r.response_kind === 'vote_yes').length;
        const no = responses.filter(r => r.item_id === item.id && r.response_kind === 'vote_no').length;
        const myVote = responses.find(r => r.item_id === item.id && r.user_id === myId)?.response_kind;
        return (
          <div key={item.id} style={{
            padding: '10px 12px', marginBottom: 6,
            background: 'var(--bg)', borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-label)', color: 'var(--text)', wordBreak: 'break-word' }}>
                {item.data.text}
              </div>
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
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => handleVote(item.id, 'vote_yes')} style={{
                flex: 1, padding: '6px', borderRadius: 6,
                background: myVote === 'vote_yes' ? 'var(--primary)' : 'var(--surface-light)',
                color: myVote === 'vote_yes' ? 'var(--bg)' : 'var(--text)',
                border: myVote === 'vote_yes' ? 'none' : '1px solid var(--border)',
                fontSize: 'var(--fs-caption)', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                </svg>
                {yes}
              </button>
              <button onClick={() => handleVote(item.id, 'vote_no')} style={{
                flex: 1, padding: '6px', borderRadius: 6,
                background: myVote === 'vote_no' ? 'var(--primary)' : 'var(--surface-light)',
                color: myVote === 'vote_no' ? 'var(--bg)' : 'var(--text)',
                border: myVote === 'vote_no' ? 'none' : '1px solid var(--border)',
                fontSize: 'var(--fs-caption)', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                </svg>
                {no}
              </button>
            </div>
          </div>
        );
      })}
      {adding && (
        <div style={{ padding: '4px 4px 0' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Например: боулинг, кино, поход..."
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
