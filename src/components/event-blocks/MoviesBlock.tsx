import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, fetchResponses, setResponse, removeResponse, type BlockItem, type BlockResponse } from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

export default function MoviesBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const myId = useAuthStore(s => s.session?.user?.id);

  const refresh = async () => {
    const its = await fetchBlockItems(eventId, 'movies');
    setItems(its);
    if (its.length > 0) setResponses(await fetchResponses(its.map(i => i.id)));
    setLoading(false);
  };
  useEffect(() => { refresh(); }, [eventId]);

  const handleAdd = async () => {
    if (!title.trim()) return;
    const item = await addBlockItem(eventId, 'movies', { title: title.trim(), url: url.trim() }, items.length);
    if (item) { setItems(prev => [...prev, item]); setTitle(''); setUrl(''); setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить фильм?')) return;
    if (await deleteBlockItem(id)) {
      setItems(prev => prev.filter(i => i.id !== id));
      setResponses(prev => prev.filter(r => r.item_id !== id));
    }
  };

  const handleVote = async (itemId: string) => {
    const mine = responses.find(r => r.item_id === itemId && r.user_id === myId && r.response_kind === 'movie_vote');
    if (mine) {
      if (await removeResponse(itemId, 'movie_vote')) setResponses(prev => prev.filter(r => r.id !== mine.id));
    } else if (await setResponse(itemId, 'movie_vote')) await refresh();
  };

  // Сортируем по голосам
  const sortedItems = [...items].sort((a, b) => {
    const va = responses.filter(r => r.item_id === a.id && r.response_kind === 'movie_vote').length;
    const vb = responses.filter(r => r.item_id === b.id && r.response_kind === 'movie_vote').length;
    return vb - va;
  });

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>}
      iconBg="#DC2626"
      title="Фильмы на вечер"
      subtitle={items.length > 0 ? `${items.length} вариантов · голосуйте` : 'Что смотрим?'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>Предложите фильмы — голосуем за топ</div>
      )}
      {sortedItems.map(item => {
        const votes = responses.filter(r => r.item_id === item.id && r.response_kind === 'movie_vote').length;
        const myVote = responses.some(r => r.item_id === item.id && r.user_id === myId && r.response_kind === 'movie_vote');
        return (
          <div key={item.id} style={{ display:'flex', alignItems:'center', gap: 10, padding: '10px 12px', marginBottom: 6, background: 'var(--bg)', borderRadius: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)' }}>{item.data.title}</div>
              {item.data.url && (
                <a href={item.data.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--fs-micro)', color: '#DC2626', textDecoration: 'none' }}>
                  Открыть трейлер →
                </a>
              )}
            </div>
            <button onClick={() => handleVote(item.id)} style={{
              padding: '6px 10px', borderRadius: 16,
              background: myVote ? '#DC2626' : 'var(--surface-light)',
              color: myVote ? '#fff' : 'var(--text)',
              border: myVote ? 'none' : '1px solid var(--border)',
              fontSize: 'var(--fs-caption)', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={myVote ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              {votes}
            </button>
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
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Название фильма" autoFocus style={inputStyle}/>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Ссылка на трейлер / IMDb (необязательно)" style={inputStyle}/>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setAdding(false); setTitle(''); setUrl(''); }} style={cancelBtn}>Отмена</button>
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
