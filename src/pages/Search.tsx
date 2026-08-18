import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { avatarColor } from '@/lib/utils';

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return <>{parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <span key={i} className="highlight">{p}</span>
      : <span key={i}>{p}</span>
  )}</>;
}

export default function Search() {
  const { user } = useAuthStore();
  const { searchMessages } = useChatStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2 || !user) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchMessages(q, user.id);
      setResults(r);
      setLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [q, user?.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="search-bar">
        
        <input placeholder="Поиск по сообщениям..." value={q} onChange={e => setQ(e.target.value)}  />
        {q && <button className="s-clear" onClick={() => { setQ(''); setResults([]); }}>✕</button>}
      </div>
      <div className="page-scroll">
        {loading && <div className="loader" style={{ padding: 24 }}><div className="spinner" /></div>}
        {!loading && results.length === 0 && (
          <div className="empty">
            <span className="e-icon" style={{opacity:0.3,fontSize:40}}>—</span>
            <span className="e-title">{q.length < 2 ? 'Введи минимум 2 символа' : 'Ничего не найдено'}</span>
          </div>
        )}
        {results.map(r => (
          <div key={r.message.id} className="chat-item" onClick={() => nav('/chat/' + (r.conversation?.id || r.message.conversation_id))} style={{ alignItems: 'flex-start' }}>
            <div className="av av-40" style={{ background: avatarColor(r.sender?.id || ''), marginTop: 2 }}>{r.sender?.display_name?.[0]?.toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 'var(--fs-snap14)' }}>{r.sender?.display_name}</strong>
                <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-micro)' }}>{new Date(r.message.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 'var(--fs-snap14)', color: 'var(--text2)' }}>
                <HighlightText text={r.message.content} query={q} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
