import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useEventsStore } from '@/stores/eventsStore';
import { useChatStore } from '@/stores/chatStore';
import { IconPartyPopper, IconPlane, IconCalendar } from '@/components/icons/EventIcons';

// Список событий ПРЯМО внутри меню вложений (как опрос/игра), а не отдельным
// оверлеем поверх. Тап по событию отправляет его карточку в чат и закрывает меню.
export default function EventSharePane({ conversationId, onShared }: { conversationId: string; onShared: () => void }) {
  const { user } = useAuthStore();
  const eventsRecord = useEventsStore(s => s.events);
  const loadEvents = useEventsStore(s => s.loadEvents);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const sendWidgetMessage = useChatStore(s => s.sendWidgetMessage);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      await loadEvents(user.id);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, loadEvents]);

  const events = useMemo(() => {
    const now = Date.now();
    return Object.values(eventsRecord)
      .filter((ev: any) => ['planned', 'active', 'archived'].includes(ev.status))
      .sort((a: any, b: any) => {
        const at = new Date(a.start_at).getTime();
        const bt = new Date(b.start_at).getTime();
        const aFuture = at >= now;
        const bFuture = bt >= now;
        if (aFuture !== bFuture) return aFuture ? -1 : 1;
        return aFuture ? at - bt : bt - at;
      });
  }, [eventsRecord]);

  const share = async (eventId: string) => {
    if (!user || sending) return;
    setSending(true);
    const result = await sendWidgetMessage(conversationId, user.id, `[EVENT:${eventId}]`, 'system');
    setSending(false);
    if (result.error) return;
    onShared();
  };

  return (
    <div style={{ width: '100%', alignSelf: 'stretch', maxHeight: '58dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '2px 4px' }}>
      <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.3, textTransform: 'uppercase', padding: '2px 8px 10px' }}>
        Поделиться событием
      </div>

      {loading && events.length === 0 && (
        <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      )}

      {!loading && events.length === 0 && (
        <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.45 }}>
            <IconCalendar size={44} strokeWidth={1.4} />
          </div>
          <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text)', marginBottom: 4 }}>Событий пока нет</div>
          <div style={{ fontSize: 'var(--fs-caption)' }}>Создайте тусу или поездку во вкладке «События»</div>
        </div>
      )}

      {events.map((ev: any) => {
        const Icon = ev.type === 'party' ? IconPartyPopper : IconPlane;
        const iconColor = ev.type === 'party' ? '#EC4899' : '#3478F6';
        const sd = new Date(ev.start_at);
        return (
          <button
            key={ev.id}
            onClick={() => share(ev.id)}
            disabled={sending}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', marginBottom: 8,
              background: 'var(--surface-light)', border: '1px solid var(--border)',
              borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              opacity: sending ? 0.6 : 1, color: 'var(--text)',
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: 10, flexShrink: 0,
              background: ev.cover_url ? '#000' : iconColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: '#fff',
            }}>
              {ev.cover_url
                ? <img src={ev.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Icon size={24} strokeWidth={1.6} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.title}
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>
                {sd.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                {ev.type === 'party' && ', ' + sd.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        );
      })}
    </div>
  );
}
