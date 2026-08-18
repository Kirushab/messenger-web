import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, type BlockItem } from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; currency?: string; }

export default function SplitBillBlock({ eventId, canEdit, currency = '₽' }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string }>>({});
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const myId = useAuthStore(s => s.session?.user?.id);

  const refresh = async () => {
    const its = await fetchBlockItems(eventId, 'splitbill');
    setItems(its);
    const userIds = Array.from(new Set(its.map(i => i.data.payer_id).filter(Boolean)));
    if (userIds.length > 0) {
      const { data } = await supabase.from('users').select('id,display_name').in('id', userIds);
      if (data) setProfiles(Object.fromEntries(data.map((u: any) => [u.id, { display_name: u.display_name }])));
    }
    setLoading(false);
  };
  useEffect(() => { refresh(); }, [eventId]);

  const handleAdd = async () => {
    if (!myId || !amount.trim()) return;
    const num = parseFloat(amount.replace(/,/g, '.'));
    if (isNaN(num) || num <= 0) return;
    const item = await addBlockItem(eventId, 'splitbill', { payer_id: myId, amount: num, desc: desc.trim() }, items.length);
    if (item) {
      setItems(prev => [...prev, item]);
      setAmount(''); setDesc(''); setAdding(false);
      await refresh();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить трату?')) return;
    if (await deleteBlockItem(id)) setItems(prev => prev.filter(i => i.id !== id));
  };

  // Подсчёт: каждый должен платить total/N, где N = количество уникальных payer
  const total = items.reduce((s, i) => s + (i.data.amount || 0), 0);
  const payers = Array.from(new Set(items.map(i => i.data.payer_id)));
  const perPerson = payers.length > 0 ? total / payers.length : 0;
  const paidByMe = items.filter(i => i.data.payer_id === myId).reduce((s, i) => s + (i.data.amount || 0), 0);
  const myDelta = paidByMe - perPerson; // > 0 — мне должны, < 0 — я должен

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
      iconBg="#10B981"
      title="Скидываемся"
      subtitle={total > 0 ? `Всего ${total.toFixed(0)}${currency} · по ${perPerson.toFixed(0)}${currency}` : 'Кто сколько потратил'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Добавляйте свои траты — поделим поровну
        </div>
      )}
      {items.length > 0 && (
        <div style={{
          padding: '10px 12px', marginBottom: 8,
          borderRadius: 8,
          background: myDelta >= 0 ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
          border: `1px solid ${myDelta >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginBottom: 2 }}>Ваш баланс</div>
          <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, color: myDelta >= 0 ? '#10B981' : '#EF4444' }}>
            {myDelta >= 0 ? '+' : ''}{myDelta.toFixed(0)} {currency}
          </div>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>
            {myDelta > 0 ? `Вам должны ${myDelta.toFixed(0)} ${currency}` : myDelta < 0 ? `Вы должны ${Math.abs(myDelta).toFixed(0)} ${currency}` : 'Всё ровно'}
          </div>
        </div>
      )}
      {items.map(item => {
        const payer = profiles[item.data.payer_id]?.display_name || '...';
        const isMe = item.data.payer_id === myId;
        return (
          <div key={item.id} style={{
            display:'flex', alignItems:'center', gap: 10,
            padding: '10px 12px', marginBottom: 6,
            background: 'var(--bg)', borderRadius: 8,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text)' }}>
                <span style={{ fontWeight: 600 }}>{isMe ? 'Вы' : payer}</span>
                {item.data.desc && <span style={{ color: 'var(--muted)' }}> · {item.data.desc}</span>}
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 700, color: '#10B981' }}>{item.data.amount.toFixed(0)} {currency}</div>
            {(canEdit && isMe) && (
              <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',padding:2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              </button>
            )}
          </div>
        );
      })}
      {adding && (
        <div style={{ padding: '4px 4px 0', display:'flex', flexDirection:'column', gap:6 }}>
          <input value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Сколько потратили (${currency})`} type="text" inputMode="decimal" autoFocus style={inputStyle}/>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="На что? (необязательно)" style={inputStyle}/>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setAdding(false); setAmount(''); setDesc(''); }} style={cancelBtn}>Отмена</button>
            <button onClick={handleAdd} disabled={!amount.trim()} style={{ ...saveBtn, opacity: amount.trim() ? 1 : 0.5 }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const inputStyle: React.CSSProperties = { width:'100%',padding:10,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize: 'var(--fs-label)' };
const cancelBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--surface-light)',border:'1px solid var(--border)',color:'var(--text)',fontSize: 'var(--fs-label)',cursor:'pointer' };
const saveBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--primary)',color:'var(--bg)',border:'none',fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer' };
