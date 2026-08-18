import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, type BlockItem } from '@/lib/eventBlocks';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

export default function SimInfoBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [details, setDetails] = useState('');
  const [esim, setEsim] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockItems(eventId, 'sim_info').then(rows => { setItems(rows); setLoading(false); });
  }, [eventId]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const item = await addBlockItem(eventId, 'sim_info', {
      name: name.trim(), price: price.trim(), url: url.trim(), details: details.trim(), esim,
    }, items.length);
    if (item) {
      setItems(prev => [...prev, item]);
      setName(''); setPrice(''); setUrl(''); setDetails(''); setEsim(false); setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить?')) return;
    if (await deleteBlockItem(id)) setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 4a2 2 0 0 1 2-2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><rect x="8" y="11" width="8" height="6" rx="1"/><line x1="9" y1="14" x2="9.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="15" y1="14" x2="15.01" y2="14"/></svg>}
      iconBg="#0891B2"
      title="SIM / eSIM"
      subtitle={items.length > 0 ? `${items.length} операторов` : 'Связь в поездке'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Какие операторы / eSIM брать
        </div>
      )}
      {items.map(item => (
        <div key={item.id} style={{ padding: 10, marginBottom: 6, background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)', flex: 1 }}>{item.data.name}</div>
            {item.data.esim && (
              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#0891B2', color: '#fff', fontWeight: 700 }}>eSIM</span>
            )}
            {item.data.price && (
              <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: '#0891B2' }}>{item.data.price}</span>
            )}
            {canEdit && (
              <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',padding:2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              </button>
            )}
          </div>
          {item.data.details && <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>{item.data.details}</div>}
          {item.data.url && (
            <a href={item.data.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--fs-micro)', color: '#0891B2', textDecoration: 'none' }}>
              Открыть →
            </a>
          )}
        </div>
      ))}
      {adding && (
        <div style={{ padding: '4px 4px 0', display:'flex', flexDirection:'column', gap:6 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Оператор (например: Magti, Airalo)" autoFocus style={inputStyle}/>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Цена (10$)" style={inputStyle}/>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0 12px', borderRadius: 8,
              background: esim ? '#0891B2' : 'var(--surface-light)',
              color: esim ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)',
              fontSize: 'var(--fs-caption)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <input type="checkbox" checked={esim} onChange={e => setEsim(e.target.checked)} style={{ display: 'none' }}/>
              eSIM
            </label>
          </div>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Сайт / ссылка (необязательно)" style={inputStyle}/>
          <input value={details} onChange={e => setDetails(e.target.value)} placeholder="Детали (5GB на неделю)" style={inputStyle}/>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setAdding(false); setName(''); setPrice(''); setUrl(''); setDetails(''); setEsim(false); }} style={cancelBtn}>Отмена</button>
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
