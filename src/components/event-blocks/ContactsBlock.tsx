import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, type BlockItem } from '@/lib/eventBlocks';
import BlockShell from './BlockShell';

interface Props {
  eventId: string;
  canEdit: boolean;
}

export default function ContactsBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tg, setTg] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockItems(eventId, 'contacts').then(rows => { setItems(rows); setLoading(false); });
  }, [eventId]);

  const handleSave = async () => {
    if (!name.trim()) return;
    const item = await addBlockItem(eventId, 'contacts', {
      name: name.trim(),
      phone: phone.trim(),
      tg: tg.trim().replace(/^@/, ''),
      role: role.trim(),
    }, items.length);
    if (item) {
      setItems(prev => [...prev, item]);
      setName(''); setPhone(''); setTg(''); setRole(''); setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить контакт?')) return;
    if (await deleteBlockItem(id)) setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
      iconBg="#10B981"
      title="Контакты"
      subtitle={items.length > 0 ? `${items.length} контактов` : 'Связь с участниками'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Добавьте контакты для связи
        </div>
      )}
      {items.map(item => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', marginBottom: 6,
          background: 'var(--bg)', borderRadius: 8,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            background: 'rgba(16,185,129,0.15)', color: '#10B981',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 'var(--fs-snap14)', fontWeight: 700,
          }}>
            {item.data.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)' }}>{item.data.name}</div>
            {item.data.role && <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>{item.data.role}</div>}
            {(item.data.phone || item.data.tg) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {item.data.phone && (
                  <a href={`tel:${item.data.phone}`} style={{
                    fontSize: 'var(--fs-micro)', color: '#10B981', textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {item.data.phone}
                  </a>
                )}
                {item.data.tg && (
                  <a href={`https://t.me/${item.data.tg}`} target="_blank" rel="noopener noreferrer" style={{
                    fontSize: 'var(--fs-micro)', color: '#0088CC', textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                    @{item.data.tg}
                  </a>
                )}
              </div>
            )}
          </div>
          {canEdit && (
            <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: 4, display: 'flex',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      ))}
      {adding && (
        <div style={{ padding: '4px 4px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя" autoFocus style={inputStyle} />
          <input value={role} onChange={e => setRole(e.target.value)} placeholder="Роль (например: координатор)" style={inputStyle} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Телефон" type="tel" style={inputStyle} />
          <input value={tg} onChange={e => setTg(e.target.value)} placeholder="Telegram (без @)" style={inputStyle} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setAdding(false); setName(''); setPhone(''); setTg(''); setRole(''); }} style={cancelBtn}>Отмена</button>
            <button onClick={handleSave} disabled={!name.trim()} style={{ ...saveBtn, opacity: name.trim() ? 1 : 0.5 }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: 10, borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 'var(--fs-label)',
};
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
