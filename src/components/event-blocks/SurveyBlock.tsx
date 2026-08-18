import { useEffect, useState } from 'react';
import { fetchBlockItems, addBlockItem, deleteBlockItem, fetchResponses, setResponse, type BlockItem, type BlockResponse } from '@/lib/eventBlocks';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import BlockShell from './BlockShell';

interface Props { eventId: string; canEdit: boolean; }

export default function SurveyBlock({ eventId, canEdit }: Props) {
  const [items, setItems] = useState<BlockItem[]>([]);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string }>>({});
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showAnswers, setShowAnswers] = useState<Record<string, boolean>>({});
  const myId = useAuthStore(s => s.session?.user?.id);

  const refresh = async () => {
    const its = await fetchBlockItems(eventId, 'survey');
    setItems(its);
    if (its.length > 0) {
      const resps = await fetchResponses(its.map(i => i.id));
      setResponses(resps);
      const ids = Array.from(new Set(resps.map(r => r.user_id)));
      if (ids.length > 0) {
        const { data } = await supabase.from('users').select('id,display_name').in('id', ids);
        if (data) setProfiles(Object.fromEntries(data.map((u: any) => [u.id, { display_name: u.display_name }])));
      }
      // pre-fill ответы юзера
      const mine: Record<string, string> = {};
      resps.filter(r => r.user_id === myId).forEach(r => { mine[r.item_id] = r.data?.answer || ''; });
      setAnswers(mine);
    }
    setLoading(false);
  };
  useEffect(() => { refresh(); }, [eventId, myId]);

  const handleAdd = async () => {
    if (!question.trim()) return;
    const item = await addBlockItem(eventId, 'survey', { question: question.trim() }, items.length);
    if (item) { setItems(prev => [...prev, item]); setQuestion(''); setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить вопрос?')) return;
    if (await deleteBlockItem(id)) {
      setItems(prev => prev.filter(i => i.id !== id));
      setResponses(prev => prev.filter(r => r.item_id !== id));
    }
  };

  const handleAnswer = async (itemId: string) => {
    const answer = answers[itemId]?.trim();
    if (!answer) return;
    if (await setResponse(itemId, 'survey_answer', { answer })) {
      await refresh();
    }
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
      iconBg="var(--accent)"
      title="Анкета участников"
      subtitle={items.length > 0 ? `${items.length} вопросов` : 'Соберите данные'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && items.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>
          Аллергии, размер, диета — задайте вопросы
        </div>
      )}
      {items.map(item => {
        const itemAnswers = responses.filter(r => r.item_id === item.id && r.response_kind === 'survey_answer');
        const myAnswer = answers[item.id] || '';
        const isOpen = showAnswers[item.id];
        return (
          <div key={item.id} style={{ padding: 10, marginBottom: 6, background: 'var(--bg)', borderRadius: 8 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)' }}>{item.data.question}</div>
              {canEdit && (
                <button onClick={() => handleDelete(item.id)} aria-label="Удалить" style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',padding:2 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
                </button>
              )}
            </div>
            <div style={{ display:'flex', gap: 6 }}>
              <input
                value={myAnswer}
                onChange={e => setAnswers(prev => ({ ...prev, [item.id]: e.target.value }))}
                placeholder="Ваш ответ"
                style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text)', fontSize: 'var(--fs-caption)' }}
              />
              <button onClick={() => handleAnswer(item.id)} disabled={!myAnswer.trim()} style={{
                padding: '6px 12px', borderRadius: 6,
                background: myAnswer.trim() ? 'var(--primary)' : 'var(--border)',
                color: myAnswer.trim() ? 'var(--bg)' : 'var(--muted)', border: 'none', fontSize: 'var(--fs-caption)', fontWeight: 600,
                cursor: myAnswer.trim() ? 'pointer' : 'default', flexShrink: 0,
              }}>OK</button>
            </div>
            {itemAnswers.length > 0 && (
              <>
                <button onClick={() => setShowAnswers(prev => ({ ...prev, [item.id]: !isOpen }))} style={{
                  background:'transparent', border:'none', cursor:'pointer',
                  color: 'var(--accent)', fontSize: 'var(--fs-micro)', fontWeight: 600,
                  padding: '4px 0', marginTop: 6,
                }}>
                  {isOpen ? '▲ Скрыть ответы' : `▼ Показать ответы (${itemAnswers.length})`}
                </button>
                {isOpen && (
                  <div style={{ marginTop: 4, display:'flex', flexDirection:'column', gap: 4 }}>
                    {itemAnswers.map(a => (
                      <div key={a.id} style={{ fontSize: 'var(--fs-micro)', color: 'var(--text)', padding: '4px 8px', background: 'var(--surface-light)', borderRadius: 6 }}>
                        <span style={{ fontWeight: 600 }}>{profiles[a.user_id]?.display_name || '...'}:</span> {a.data?.answer}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      {adding && (
        <div style={{ padding: '4px 4px 0' }}>
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Вопрос (например: ваши аллергии?)" autoFocus style={inputStyle}/>
          <div style={{ display:'flex', gap:6, marginTop: 6 }}>
            <button onClick={() => { setAdding(false); setQuestion(''); }} style={cancelBtn}>Отмена</button>
            <button onClick={handleAdd} disabled={!question.trim()} style={{ ...saveBtn, opacity: question.trim() ? 1 : 0.5 }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const inputStyle: React.CSSProperties = { width:'100%',padding:10,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize: 'var(--fs-label)' };
const cancelBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--surface-light)',border:'1px solid var(--border)',color:'var(--text)',fontSize: 'var(--fs-label)',cursor:'pointer' };
const saveBtn: React.CSSProperties = { flex:1,padding:8,borderRadius:8,background:'var(--primary)',color:'var(--bg)',border:'none',fontSize: 'var(--fs-label)',fontWeight:600,cursor:'pointer' };
