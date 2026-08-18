import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useAlarmsStore, type SharedAlarm } from '@/stores/alarmsStore';
import BlockShell from './BlockShell';

interface Props {
  eventId: string;
  canEdit: boolean;
  eventTitle?: string;
  memberIds?: string[];
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

export default function AlarmBlock({ eventId, canEdit, eventTitle, memberIds = [] }: Props) {
  const myId = useAuthStore(s => s.session?.user?.id);
  const { create, remove } = useAlarmsStore();
  const [list, setList] = useState<SharedAlarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => {
    supabase.from('shared_alarms').select('*').eq('event_id', eventId).order('ring_at')
      .then(({ data }) => { setList((data || []) as SharedAlarm[]); setLoading(false); });
  };
  useEffect(() => { reload(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!when || !myId || busy) return;
    const iso = new Date(when).toISOString();
    if (new Date(iso).getTime() < Date.now()) { alert('Время уже прошло'); return; }
    setBusy(true);
    const { error } = await create({
      created_by: myId,
      event_id: eventId,
      title: title.trim() || (eventTitle ? `Подъём · ${eventTitle}` : 'Будильник'),
      ring_at: iso,
      participant_ids: memberIds.filter(x => x !== myId),
    });
    setBusy(false);
    if (error) { alert('Не удалось: ' + error); return; }
    setAdding(false); setTitle(''); setWhen('');
    reload();
  };

  const del = async (a: SharedAlarm) => {
    if (!confirm('Удалить будильник?')) return;
    await remove(a.id);
    setList(prev => prev.filter(x => x.id !== a.id));
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/></svg>}
      iconBg="#6366F1"
      title="Будильник"
      subtitle={list.length > 0 ? `${list.length} шт.` : 'Общий для участников'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загрузка...</div>}
      {!loading && list.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8, textAlign: 'center' }}>Пока нет будильников</div>
      )}

      {list.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 6, background: 'var(--bg)', borderRadius: 8 }}>
          <span style={{ fontSize: 'var(--fs-title)' }}>⏰</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)' }}>{a.title}</div>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 1 }}>{fmt(a.ring_at)} · {a.participant_ids.length + 1} чел.</div>
          </div>
          {a.created_by === myId && (
            <button onClick={() => del(a)} aria-label="Удалить" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, display: 'flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      ))}

      {adding && (
        <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={eventTitle ? `Подъём · ${eventTitle}` : 'Название'} style={{ fontSize: 'var(--fs-snap14)' }} />
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={{ fontSize: 'var(--fs-snap14)' }} />
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>Зазвонит у всех, кто идёт на событие (пока приложение открыто).</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setAdding(false); setTitle(''); setWhen(''); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text)', fontSize: 'var(--fs-label)', fontWeight: 600, cursor: 'pointer' }}>Отмена</button>
            <button onClick={save} disabled={!when || busy} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: when ? 'var(--accent)' : 'var(--surface-light)', color: when ? 'var(--bg)' : 'var(--muted)', fontSize: 'var(--fs-label)', fontWeight: 700, cursor: when ? 'pointer' : 'default', opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'Поставить'}</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}
