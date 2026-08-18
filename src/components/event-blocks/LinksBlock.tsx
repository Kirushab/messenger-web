import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, type BlockItem } from '@/lib/eventBlocks';
import BlockShell from './BlockShell';

interface Props {
  eventId: string;
  canEdit: boolean;
}

const normalizeUrl = (raw: string): string => {
  const s = raw.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
};

const domainOf = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
};

export default function LinksBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockItems(eventId, 'links').then(rows => { setItems(rows); setLoading(false); });
  }, [eventId]);

  const handleSave = async () => {
    const finalUrl = normalizeUrl(url);
    if (!finalUrl) return;
    const item = await addBlockItem(eventId, 'links', {
      title: title.trim() || domainOf(finalUrl),
      url: finalUrl,
    }, items.length);
    if (item) { setItems(prev => [...prev, item]); setTitle(''); setUrl(''); setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить ссылку?')) return;
    if (await deleteBlockItem(id)) setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
      iconBg="#3B82F6"
      title="Полезные ссылки"
      subtitle={items.length > 0 ? `${items.length} ссылок` : 'Документы, плейлисты'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Добавьте полезные ссылки
        </div>
      )}
      {items.map(item => (
        <a
          key={item.id}
          href={item.data.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', marginBottom: 6,
            background: 'var(--bg)', borderRadius: 8,
            textDecoration: 'none', color: 'var(--text)',
            position: 'relative',
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(59,130,246,0.15)', color: '#3B82F6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.data.title}</div>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{domainOf(item.data.url)}</div>
          </div>
          {canEdit && (
            <button onClick={(e) => { e.preventDefault(); handleDelete(item.id); }} aria-label="Удалить" style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: 4, display: 'flex',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            </button>
          )}
        </a>
      ))}
      {adding && (
        <div style={{ padding: '4px 4px 0' }}>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="URL: spotify.com/playlist/..."
            autoFocus
            style={{
              width: '100%', padding: 10, marginBottom: 6, borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: 'var(--fs-label)',
            }}
          />
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Название (необязательно)"
            style={{
              width: '100%', padding: 10, borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: 'var(--fs-label)',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => { setAdding(false); setTitle(''); setUrl(''); }} style={{
              flex: 1, padding: '8px', borderRadius: 8,
              background: 'var(--surface-light)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 'var(--fs-label)', cursor: 'pointer',
            }}>Отмена</button>
            <button onClick={handleSave} disabled={!url.trim()} style={{
              flex: 1, padding: '8px', borderRadius: 8,
              background: url.trim() ? 'var(--primary)' : 'var(--surface-light)',
              color: url.trim() ? 'var(--bg)' : 'var(--muted)',
              border: 'none', fontSize: 'var(--fs-label)', fontWeight: 600,
              cursor: url.trim() ? 'pointer' : 'default',
            }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}
