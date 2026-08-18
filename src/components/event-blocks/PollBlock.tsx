import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, fetchResponses, setResponse, type BlockItem, type BlockResponse } from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

export default function PollBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [loading, setLoading] = useState(true);
  const myId = useAuthStore(s => s.session?.user?.id);

  const refresh = async () => {
    const its = await fetchBlockItems(eventId, 'poll');
    setItems(its);
    if (its.length > 0) setResponses(await fetchResponses(its.map(i => i.id)));
    setLoading(false);
  };
  useEffect(() => { refresh(); }, [eventId]);

  const handleAdd = async () => {
    const opts = options.map(o => o.trim()).filter(o => o.length > 0);
    if (!question.trim() || opts.length < 2) return;
    const item = await addBlockItem(eventId, 'poll', {
      question: question.trim(),
      options: opts.map((text, idx) => ({ id: `opt${idx}`, text })),
    }, items.length);
    if (item) { setItems(prev => [...prev, item]); setQuestion(''); setOptions(['', '']); setAdding(false); }
  };

  const handleVote = async (itemId: string, optionId: string) => {
    if (!myId) return;
    if (await setResponse(itemId, 'voted', { option_id: optionId })) {
      const updated = await fetchResponses([itemId]);
      setResponses(prev => [...prev.filter(r => r.item_id !== itemId), ...updated]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить опрос?')) return;
    if (await deleteBlockItem(id)) {
      setItems(prev => prev.filter(i => i.id !== id));
      setResponses(prev => prev.filter(r => r.item_id !== id));
    }
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
      iconBg="#6366F1"
      title="Опросы"
      subtitle={items.length > 0 ? `${items.length} опросов` : 'Соберите мнения'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>Создайте первый опрос</div>
      )}
      {items.map(item => {
        const opts = (item.data.options || []) as { id: string; text: string }[];
        const allVotes = responses.filter(r => r.item_id === item.id && r.response_kind === 'voted');
        const myVote = allVotes.find(r => r.user_id === myId)?.data?.option_id;
        return (
          <div key={item.id} style={{ padding: 12, marginBottom: 8, background: 'var(--bg)', borderRadius: 8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600, color: 'var(--text)', flex: 1 }}>{item.data.question}</div>
              {canEdit && <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',padding:2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              </button>}
            </div>
            {opts.map(opt => {
              const count = allVotes.filter(v => v.data?.option_id === opt.id).length;
              const pct = allVotes.length ? Math.round(count / allVotes.length * 100) : 0;
              const isMy = myVote === opt.id;
              return (
                <div key={opt.id} onClick={() => handleVote(item.id, opt.id)} style={{
                  position:'relative', overflow:'hidden',
                  padding: '8px 10px', marginBottom: 4,
                  borderRadius: 8, cursor: 'pointer',
                  border: isMy ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: 'var(--surface-light)',
                }}>
                  <div style={{
                    position:'absolute', left:0, top:0, bottom:0, width: pct + '%',
                    background: isMy ? 'rgba(148,163,184,0.34)' : 'rgba(148,163,184,0.15)',
                    transition: 'width 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}/>
                  <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize: 'var(--fs-label)', gap:6 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                      {isMy && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      {opt.text}
                    </span>
                    <span style={{ color: isMy ? 'var(--accent)' : 'var(--muted)', fontWeight: isMy ? 700 : 500, fontVariantNumeric:'tabular-nums' }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 4 }}>{allVotes.length} {allVotes.length === 1 ? 'голос' : allVotes.length < 5 ? 'голоса' : 'голосов'}</div>
          </div>
        );
      })}
      {adding && (
        <div style={{ padding: '4px 4px 0', display:'flex', flexDirection:'column', gap:6 }}>
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Вопрос (например: Где встретимся?)" autoFocus style={inputStyle}/>
          {options.map((o, i) => (
            <input key={i} value={o} onChange={e => setOptions(prev => prev.map((p, idx) => idx === i ? e.target.value : p))} placeholder={`Вариант ${i + 1}`} style={inputStyle}/>
          ))}
          <button onClick={() => setOptions(prev => [...prev, ''])} style={{ background:'transparent',border:'1px dashed var(--border)',borderRadius:8,padding:6,color:'var(--muted)',fontSize: 'var(--fs-caption)',cursor:'pointer' }}>+ Вариант</button>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setAdding(false); setQuestion(''); setOptions(['', '']); }} style={cancelBtn}>Отмена</button>
            <button onClick={handleAdd} disabled={!question.trim() || options.filter(o => o.trim()).length < 2} style={{ ...saveBtn, opacity: question.trim() && options.filter(o => o.trim()).length >= 2 ? 1 : 0.5 }}>Создать</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const inputStyle: React.CSSProperties = { width:'100%',padding:10,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize: 'var(--fs-label)' };
const cancelBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--surface-light)',border:'1px solid var(--border)',color:'var(--text)',fontSize: 'var(--fs-label)',cursor:'pointer' };
const saveBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--primary)',color:'var(--bg)',border:'none',fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer' };
