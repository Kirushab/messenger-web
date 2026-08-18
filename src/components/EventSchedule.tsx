import { useEffect, useState } from 'react';
import BlockShell from './event-blocks/BlockShell';
import { supabase } from '@/lib/supabase';
import BottomSheet from './BottomSheet';

interface ScheduleItem {
  id: string;
  event_id: string;
  day_offset: number;
  time_label: string | null;
  title: string;
  description: string | null;
  location_name: string | null;
  position: number;
}

export default function EventSchedule({ eventId, canEdit, startAt, endAt }: {
  eventId: string;
  canEdit: boolean;
  startAt: string;
  endAt: string | null;
}) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ day: number; id?: string } | null>(null);

  // Сколько дней в событии
  const totalDays = (() => {
    const sd = new Date(startAt);
    const ed = endAt ? new Date(endAt) : sd;
    const diff = Math.max(0, Math.floor((ed.getTime() - sd.getTime()) / (24 * 60 * 60 * 1000)));
    return Math.min(Math.max(diff + 1, 1), 30); // максимум 30 дней
  })();

  const startDate = new Date(startAt);

  const reload = async () => {
    const { data } = await supabase
      .from('event_schedule')
      .select('*')
      .eq('event_id', eventId)
      .order('day_offset')
      .order('position');
    setItems((data || []) as ScheduleItem[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [eventId]);

  useEffect(() => {
    const ch = supabase.channel(`event-schedule-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_schedule', filter: `event_id=eq.${eventId}` }, () => reload())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [eventId]);

  const remove = async (id: string) => {
    if (!confirm('Удалить пункт?')) return;
    await supabase.from('event_schedule').delete().eq('id', id);
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
      iconBg="#10B981"
      title="План по дням"
    >
      {loading && <div style={{padding:24,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>}

      {!loading && Array.from({ length: totalDays }).map((_, dayIdx) => {
        const dayItems = items.filter(i => i.day_offset === dayIdx);
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + dayIdx);
        return (
          <div key={dayIdx} style={{
            background:'var(--surface-light)',borderRadius:12,
            padding:'12px 14px',marginBottom:10,
          }}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <div style={{flex:1,fontSize: 'var(--fs-label)',fontWeight:600,color:'var(--text)'}}>
                День {dayIdx + 1}
                <span style={{color:'var(--muted)',fontWeight:400,marginLeft:6,fontSize: 'var(--fs-caption)'}}>
                  {dayDate.toLocaleDateString('ru', { day: 'numeric', month: 'short', weekday: 'short' })}
                </span>
              </div>
              {canEdit && (
                <button onClick={() => setEditing({ day: dayIdx })}
                  style={{background:'var(--primary)',border:'none',
                    padding:'4px 10px',borderRadius:14,fontSize: 'var(--fs-micro)',fontWeight:600,
                    color:'var(--bg)',cursor:'pointer',display:'flex',alignItems:'center',gap:3}}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  Пункт
                </button>
              )}
            </div>

            {dayItems.length === 0 && (
              <div style={{padding:'8px 0',color:'var(--muted)',fontSize: 'var(--fs-caption)',fontStyle:'italic'}}>
                {canEdit ? 'Добавьте пункты плана' : 'Пусто'}
              </div>
            )}

            {dayItems.map(item => (
              <div key={item.id} style={{ display:'flex', gap:10, marginBottom:8 }}>
                <div style={{ width:46, flexShrink:0, textAlign:'right', fontSize:'var(--fs-caption)', color:'var(--text2)', fontWeight:700, paddingTop:10 }}>{item.time_label || ''}</div>
                <div style={{ flex:1, minWidth:0, background:'var(--surface-2)', borderRadius:12, borderLeft:'3px solid var(--accent)', padding:'9px 12px', display:'flex', alignItems:'flex-start', gap:6 }}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize: 'var(--fs-snap14)',color:'var(--text)',fontWeight:700}}>{item.title}</div>
                    {item.location_name && (
                      <div style={{fontSize: 'var(--fs-caption)',color:'var(--text2)',marginTop:2,display:'flex',alignItems:'center',gap:4}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                        {item.location_name}
                      </div>
                    )}
                    {item.description && (
                      <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',marginTop:3,whiteSpace:'pre-wrap'}}>{item.description}</div>
                    )}
                  </div>
                  {canEdit && (
                    <button onClick={() => setEditing({ day: dayIdx, id: item.id })}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2,height:22,alignSelf:'flex-start'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => remove(item.id)}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2,height:22,alignSelf:'flex-start'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {editing && (
        <EditScheduleSheet
          eventId={eventId}
          item={editing.id ? items.find(i => i.id === editing.id)! : null}
          day={editing.day}
          position={items.filter(i => i.day_offset === editing.day).length}
          onSaved={() => setEditing(null)}
          onClose={() => setEditing(null)}
        />
      )}
    </BlockShell>
  );
}

// ============== Edit sheet ==============

function EditScheduleSheet({ eventId, item, day, position, onSaved, onClose }: {
  eventId: string;
  item: ScheduleItem | null;
  day: number;
  position: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(item?.title || '');
  const [timeLabel, setTimeLabel] = useState(item?.time_label || '');
  const [location, setLocation] = useState(item?.location_name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const patch = {
      event_id: eventId,
      day_offset: day,
      time_label: timeLabel.trim() || null,
      title: title.trim(),
      location_name: location.trim() || null,
      description: description.trim() || null,
      position,
    };
    if (item) {
      await supabase.from('event_schedule').update(patch).eq('id', item.id);
    } else {
      await supabase.from('event_schedule').insert(patch);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <BottomSheet open onClose={onClose} initial="half" allowFullHeight={false}>
      <h3 style={{margin:'4px 0 14px',fontSize: 'var(--fs-snap16)',fontWeight:600}}>
        {item ? 'Изменить пункт' : `День ${day + 1} — новый пункт`}
      </h3>

      <Label>Название</Label>
      <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} autoFocus
        placeholder="Завтрак в отеле"
        style={inputStyle()} />

      <Label optional>Время</Label>
      <input value={timeLabel} onChange={e => setTimeLabel(e.target.value)} maxLength={20}
        placeholder="9:00 или «Утро»"
        style={inputStyle()} />

      <Label optional>Место</Label>
      <input value={location} onChange={e => setLocation(e.target.value)} maxLength={100}
        placeholder="Где"
        style={inputStyle()} />

      <Label optional>Подробности</Label>
      <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={2}
        placeholder="Заметки"
        style={{...inputStyle(), resize:'vertical', fontFamily:'inherit'}} />

      <button onClick={save} disabled={!title.trim() || saving}
        style={{width:'100%',padding:'14px',marginTop:6,
          background: title.trim() ? 'var(--primary)' : 'var(--surface-light)',
          color: title.trim() ? 'var(--bg)' : 'var(--muted)',
          border:'none',borderRadius:12,fontSize: 'var(--fs-body)',fontWeight:600,
          cursor: title.trim() && !saving ? 'pointer' : 'default'}}>
        {saving ? 'Сохраняем...' : 'Сохранить'}
      </button>
    </BottomSheet>
  );
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{fontSize: 'var(--fs-micro)',fontWeight:600,color:'var(--muted)',marginBottom:6,letterSpacing:0.3,textTransform:'uppercase'}}>
      {children}
      {optional && <span style={{textTransform:'none',fontWeight:500,marginLeft:6,opacity:0.7}}>(опц.)</span>}
    </div>
  );
}
function inputStyle(): React.CSSProperties {
  return {
    width:'100%',padding:'12px',borderRadius:10,
    border:'1px solid var(--border)',background:'var(--surface-light)',
    color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:14,outline:'none',
  };
}
