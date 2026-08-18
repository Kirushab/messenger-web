import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { avatarColor } from '@/lib/utils';
import BlockShell from './BlockShell';

interface Member { user_id: string; user: { display_name?: string | null; avatar_url?: string | null } }
interface Flight { id: string; user_id: string; flight_iata: string; flight_date: string | null; seat: string | null; note: string | null }
interface Props { eventId: string; canEdit: boolean; members?: Member[] }

function fmtDate(d: string): string {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }
  catch { return d; }
}

export default function EventFlights({ eventId, canEdit, members = [] }: Props) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [num, setNum] = useState('');
  const [seat, setSeat] = useState('');
  const [date, setDate] = useState('');
  const myId = useAuthStore(s => s.session?.user?.id);

  const refresh = async () => {
    const { data } = await supabase
      .from('event_flights')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    setFlights((data as Flight[]) || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [eventId]);

  const nameOf = (uid: string) => members.find(m => m.user_id === uid)?.user?.display_name || 'Участник';
  const avatarOf = (uid: string) => members.find(m => m.user_id === uid)?.user?.avatar_url || null;

  const handleAdd = async () => {
    const fn = num.trim().toUpperCase().replace(/\s+/g, '');
    if (!fn || !myId) return;
    const { data, error } = await supabase
      .from('event_flights')
      .insert({ event_id: eventId, user_id: myId, flight_iata: fn, seat: seat.trim() || null, flight_date: date || null })
      .select()
      .single();
    if (!error && data) {
      setFlights(prev => [...prev, data as Flight]);
      setNum(''); setSeat(''); setDate(''); setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить рейс?')) return;
    const { error } = await supabase.from('event_flights').delete().eq('id', id);
    if (!error) setFlights(prev => prev.filter(f => f.id !== id));
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5a2.12 2.12 0 0 0-3-3L13 8 4.8 6.2a1 1 0 0 0-.9.3l-.6.6a1 1 0 0 0 .2 1.6L9 12l-2 2H4l-1 1 4 1 1 4 1-1v-3l2-2 3.3 5.5a1 1 0 0 0 1.6.2l.6-.6a1 1 0 0 0 .3-.9z"/></svg>}
      iconBg="#3B82F6"
      title="Рейс"
      subtitle={flights.length > 0 ? `Кто чем летит · ${flights.length}` : 'Добавь свой рейс'}
      onAdd={canEdit ? () => setAdding(true) : undefined}
    >
      {loading && <div style={hint}>Загрузка…</div>}
      {!loading && flights.length === 0 && !adding && (
        <div style={{ ...hint, textAlign: 'center' }}>Каждый добавляет свой рейс (номер как на билете) и место. Борта появятся слоем «Рейсы» на общей карте.</div>
      )}
      {flights.map(f => {
        const mine = f.user_id === myId;
        const av = avatarOf(f.user_id);
        return (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 6, background: 'var(--bg)', borderRadius: 8 }}>
            {av
              ? <img src={av} alt="" style={{ width: 30, height: 30, borderRadius: 15, objectFit: 'cover', flexShrink: 0 }} />
              : <span style={{ width: 30, height: 30, borderRadius: 15, background: avatarColor(f.user_id), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-micro)', fontWeight: 700, flexShrink: 0 }}>{nameOf(f.user_id)[0]?.toUpperCase()}</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text)' }}>
                {f.flight_iata}{f.seat ? <span style={{ color: 'var(--text2)', fontWeight: 500 }}> · место {f.seat}</span> : null}
              </div>
              <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nameOf(f.user_id)}{f.flight_date ? ` · ${fmtDate(f.flight_date)}` : ''}
              </div>
            </div>
            {mine && (
              <button onClick={() => handleDelete(f.id)} aria-label="Удалить" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, display: 'flex', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              </button>
            )}
          </div>
        );
      })}
      {adding && (
        <div style={{ padding: '4px 4px 0' }}>
          <input value={num} onChange={e => setNum(e.target.value)} placeholder="Номер рейса, напр. SU100" autoFocus style={inp} />
          <div className="event-flight-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 8 }}>
            <input value={seat} onChange={e => setSeat(e.target.value)} placeholder="Место (напр. 14C)" style={inp} />
            <input value={date} onChange={e => setDate(e.target.value)} type="date" style={inp} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => { setAdding(false); setNum(''); setSeat(''); setDate(''); }} style={cancelBtn}>Отмена</button>
            <button onClick={handleAdd} disabled={!num.trim()} style={{ ...saveBtn, opacity: num.trim() ? 1 : 0.5 }}>Добавить</button>
          </div>
        </div>
      )}
    </BlockShell>
  );
}

const hint: React.CSSProperties = { fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 };
const inp: React.CSSProperties = { width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 'var(--fs-label)', fontFamily: 'inherit' };
const cancelBtn: React.CSSProperties = { flex: 1, padding: 9, borderRadius: 12, background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 'var(--fs-label)', cursor: 'pointer' };
const saveBtn: React.CSSProperties = { flex: 1, padding: 9, borderRadius: 12, background: 'var(--primary)', color: 'var(--bg)', border: 'none', fontSize: 'var(--fs-label)', fontWeight: 600, cursor: 'pointer' };
