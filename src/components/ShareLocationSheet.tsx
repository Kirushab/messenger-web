import { useEffect, useMemo, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { avatarColor } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { toast } from '@/stores/toastStore';

interface Props {
  lat: number;
  lng: number;
  title?: string;
  myId: string;
  onClose: () => void;
  onShared: () => void;
  eventId?: string;
}

export default function ShareLocationSheet({ lat, lng, title, myId, onClose, onShared, eventId }: Props) {
  const { conversations, fetchConversations, sendLocation, sendWidgetMessage, loadingConversations } = useChatStore();
  const [q, setQ] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (conversations.length === 0) fetchConversations(myId);
  }, [myId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Для каждого чата вычисляем отображаемое имя + аватар
  const rows = useMemo(() => conversations.map(c => {
    if (c.is_saved) {
      return { id: c.id, name: 'Избранное', avatar: null, colorId: 'saved:' + myId, saved: true };
    }
    if (c.type === 'group') {
      return { id: c.id, name: c.name || 'Группа', avatar: c.avatar_url, colorId: c.id, saved: false };
    }
    const other = c.members.find(m => m.user_id !== myId)?.user;
    return { id: c.id, name: other?.display_name || 'Чат', avatar: other?.avatar_url || null, colorId: other?.id || c.id, saved: false };
  }), [conversations, myId]);

  const filtered = q.trim() ? rows.filter(r => r.name.toLowerCase().includes(q.trim().toLowerCase())) : rows;

  const share = async (convId: string) => {
    if (sendingId) return;
    setSendingId(convId);
    try {
      if (eventId) {
        const result = await sendWidgetMessage(convId, myId, `[EVENT:${eventId}]`, 'system');
        if (result.error) throw new Error(result.error);
      } else {
        await sendLocation(convId, myId, lat, lng);
      }
      haptic.success();
      toast.success(eventId ? 'Событие отправлено в чат' : 'Точка отправлена в чат');
      onShared();
    } catch {
      toast.error('Не удалось отправить');
      setSendingId(null);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} className="share-sheet-enter" style={{
        width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg)', color: 'var(--text)',
        borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
        padding: 'var(--sp-3) var(--sp-4) var(--sp-4)',
        boxShadow:'var(--shadow-2)', border:'1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--sp-3)' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        <h3 style={{ margin: '0 0 4px', fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)' }}>Поделиться в чат</h3>
        {title && <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginBottom: 'var(--sp-3)', display:'flex', alignItems:'center', gap:6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{title}</div>}

        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Поиск чата"
          style={{ marginBottom: 'var(--sp-3)', borderRadius:'var(--pill)', background:'var(--surface-2)', border:'1px solid var(--border)' }}
        />

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
          {loadingConversations && rows.length === 0 && (
            <div style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-label)' }}>Загрузка чатов…</div>
          )}
          {!loadingConversations && filtered.length === 0 && (
            <div style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-label)' }}>
              {rows.length === 0 ? 'Нет чатов' : 'Ничего не найдено'}
            </div>
          )}
          {filtered.map(r => {
            const isSending = sendingId === r.id;
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: '9px 10px 9px 12px',
                borderRadius: 18,
                background: isSending ? 'var(--accent-soft)' : 'var(--surface-2)',
                border:'1px solid var(--border)',
                opacity: sendingId && !isSending ? 0.5 : 1,
                transition:'background .18s ease, opacity .18s ease, transform .18s ease',
              }}>
                {r.saved
                  ? <div style={{ width:42, height:42, borderRadius:21, flexShrink:0, background:'var(--text)', color:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4.8A2.8 2.8 0 0 1 8.8 2h6.4A2.8 2.8 0 0 1 18 4.8V22l-6-3.8L6 22V4.8Z"/></svg></div>
                  : r.avatar
                    ? <img src={r.avatar} alt="" style={{ width: 42, height: 42, borderRadius: 21, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 42, height: 42, borderRadius: 21, flexShrink: 0, background: avatarColor(r.colorId), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-heading)', fontWeight: 700 }}>{r.name[0]?.toUpperCase()}</div>}
                <span style={{ flex: 1, fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <button
                  onClick={() => share(r.id)}
                  disabled={!!sendingId}
                  className="tap-effect"
                  aria-label={`${eventId ? 'Отправить событие' : 'Отправить геопозицию'} в чат ${r.name}`}
                  title="Отправить"
                  style={{
                    width:42, height:42, borderRadius:21, flexShrink:0,
                    border: isSending ? '1px solid var(--border)' : '1px solid color-mix(in srgb, var(--accent) 64%, transparent)',
                    background: isSending ? 'var(--surface-light)' : 'var(--accent)',
                    color:'var(--bg)', cursor:sendingId ? 'default' : 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:isSending ? 'none' : '0 8px 18px color-mix(in srgb, var(--accent) 30%, transparent)',
                  }}
                >
                  {isSending
                    ? <span className="btn-spin-sm" aria-hidden="true" />
                    : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform:'translateX(-1px)' }}><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
