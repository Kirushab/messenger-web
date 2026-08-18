import { useEffect, useRef, useState, type ReactNode } from 'react';
import BlockShell from './event-blocks/BlockShell';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { avatarColor } from '@/lib/utils';
import { IconCar } from '@/components/icons/EventIcons';

type Kind = 'flight' | 'train' | 'bus' | 'car' | 'other';

const KIND_META: Record<Kind, { label: string; icon: ReactNode; color: string }> = {
  flight: {
    label: 'Рейс', color: '#3B82F6',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    ),
  },
  train: {
    label: 'Поезд', color: '#10B981',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="3" width="14" height="14" rx="3"/>
        <line x1="5" y1="11" x2="19" y2="11"/>
        <circle cx="9" cy="14.5" r="1" fill="currentColor" stroke="none"/>
        <circle cx="15" cy="14.5" r="1" fill="currentColor" stroke="none"/>
        <path d="M8 17l-2 4M16 17l2 4"/>
        <path d="M9 7h6"/>
      </svg>
    ),
  },
  bus: {
    label: 'Автобус', color: '#F59E0B',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12"/>
        <path d="M3 12h18"/>
        <path d="M5 9h14"/>
        <circle cx="8" cy="17" r="1.6" fill="currentColor" stroke="none"/>
        <circle cx="16" cy="17" r="1.6" fill="currentColor" stroke="none"/>
        <path d="M6 19v1.5M18 19v1.5"/>
      </svg>
    ),
  },
  car: {
    label: 'Машина', color: '#EF4444',
    icon: <IconCar size={20} strokeWidth={1.9} />,
  },
  other: {
    label: 'Прочее', color: '#6B7280',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M16.24 7.76L13.41 13.41L7.76 16.24L10.59 10.59L16.24 7.76Z" fill="currentColor"/>
      </svg>
    ),
  },
};

interface T {
  id: string;
  event_id: string;
  user_id: string | null;
  kind: Kind;
  carrier: string | null;
  number: string | null;
  from_place: string | null;
  to_place: string | null;
  depart_at: string | null;
  arrive_at: string | null;
  notes: string | null;
  position: number;
  created_by: string | null;
  user?: { id: string; display_name: string; avatar_url: string | null } | null;
}

export default function EventTransport({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const { user } = useAuthStore();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: string } | null>(null);

  const reload = async () => {
    const { data } = await supabase
      .from('event_transport')
      .select('*, user:users(id, display_name, avatar_url)')
      .eq('event_id', eventId)
      .order('depart_at', { ascending: true, nullsFirst: false });
    setItems((data || []) as T[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [eventId]);

  useEffect(() => {
    const ch = supabase.channel(`event-transport-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_transport', filter: `event_id=eq.${eventId}` }, () => reload())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [eventId]);

  const remove = async (id: string) => {
    if (!confirm('Удалить?')) return;
    await supabase.from('event_transport').delete().eq('id', id);
  };

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>}
      iconBg="#F97316"
      title="Транспорт"
      subtitle={items.length > 0 ? `${items.length} ${items.length === 1 ? 'рейс' : items.length < 5 ? 'рейса' : 'рейсов'}` : undefined}
      onAdd={canEdit ? () => setEditing({}) : undefined}
      addLabel="Рейс"
    >
      {loading && <div style={{padding:24,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>}

      {!loading && items.length === 0 && (
        <div style={{padding:'16px 12px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-label)'}}>
          {canEdit ? 'Добавьте рейсы или транспорт' : 'Транспорт пока не добавлен'}
        </div>
      )}

      {items.map(t => {
        const meta = KIND_META[t.kind] || KIND_META.other;
        const dep = t.depart_at ? new Date(t.depart_at) : null;
        const arr = t.arrive_at ? new Date(t.arrive_at) : null;
        const isMine = t.user_id === user?.id;
        const canEditItem = canEdit && (t.created_by === user?.id || t.user_id === user?.id);
        return (
          <div key={t.id} style={{
            padding:'12px 14px',marginBottom:8,
            background:'var(--surface-light)',borderRadius:12,
            border: isMine ? '1px solid var(--primary)' : '1px solid var(--border)',
          }}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{display:'flex',color:meta.color}}>{meta.icon}</span>
              <span style={{fontSize: 'var(--fs-caption)',fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:0.3}}>
                {meta.label}{t.carrier ? ` · ${t.carrier}` : ''}{t.number ? ` ${t.number}` : ''}
              </span>
              <span style={{flex:1}} />
              {canEditItem && (
                <>
                  <button onClick={() => setEditing({ id: t.id })}
                    style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  <button onClick={() => remove(t.id)}
                    style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:2}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </>
              )}
            </div>

            {(t.from_place || t.to_place) && (
              <div className="event-transport-route" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto minmax(0,1fr)',alignItems:'start',gap:10,fontSize: 'var(--fs-snap14)',color:'var(--text)',marginBottom:8}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600,overflowWrap:'anywhere'}}>{t.from_place || '—'}</div>
                  {dep && (
                    <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginTop:2}}>
                      {dep.toLocaleString('ru', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  )}
                </div>
                <div style={{color:'var(--muted)',padding:'0 4px',alignSelf:'center'}}>→</div>
                <div style={{minWidth:0,textAlign:'right'}}>
                  <div style={{fontWeight:600,overflowWrap:'anywhere'}}>{t.to_place || '—'}</div>
                  {arr && (
                    <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',marginTop:2}}>
                      {arr.toLocaleString('ru', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',fontSize: 'var(--fs-caption)',color:'var(--muted)'}}>
              {t.user && (
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  {t.user.avatar_url
                    ? <img src={t.user.avatar_url} alt="" style={{width:18,height:18,borderRadius:9,objectFit:'cover'}} />
                    : <div style={{width:18,height:18,borderRadius:9,background:avatarColor(t.user.id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:600}}>{(t.user.display_name||'?')[0].toUpperCase()}</div>}
                  <span>{t.user.display_name}</span>
                </div>
              )}
            </div>
            {t.notes && (
              <div style={{marginTop:6,fontSize: 'var(--fs-caption)',color:'var(--muted)',whiteSpace:'pre-wrap'}}>
                {t.notes}
              </div>
            )}
          </div>
        );
      })}

      {editing && (
        <EditTransportSheet
          eventId={eventId}
          item={editing.id ? items.find(i => i.id === editing.id)! : null}
          position={items.length}
          onSaved={() => setEditing(null)}
          onClose={() => setEditing(null)}
        />
      )}
    </BlockShell>
  );
}

function EditTransportSheet({ eventId, item, position, onSaved, onClose }: {
  eventId: string; item: T | null; position: number;
  onSaved: () => void; onClose: () => void;
}) {
  const { user } = useAuthStore();
  const [kind, setKind] = useState<Kind>(item?.kind || 'flight');
  const [carrier, setCarrier] = useState(item?.carrier || '');
  const [number, setNumber] = useState(item?.number || '');
  const [fromPlace, setFromPlace] = useState(item?.from_place || '');
  const [toPlace, setToPlace] = useState(item?.to_place || '');
  const [departAt, setDepartAt] = useState(item?.depart_at ? new Date(item.depart_at).toISOString().slice(0, 16) : '');
  const [arriveAt, setArriveAt] = useState(item?.arrive_at ? new Date(item.arrive_at).toISOString().slice(0, 16) : '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [forMe, setForMe] = useState(item?.user_id ? item.user_id === user?.id : true);
  const [saving, setSaving] = useState(false);

  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  const save = async () => {
    if (saving || !user) return;
    setSaving(true);
    const patch: any = {
      event_id: eventId,
      kind,
      carrier: carrier.trim() || null,
      number: number.trim() || null,
      from_place: fromPlace.trim() || null,
      to_place: toPlace.trim() || null,
      depart_at: departAt ? new Date(departAt).toISOString() : null,
      arrive_at: arriveAt ? new Date(arriveAt).toISOString() : null,
      notes: notes.trim() || null,
      user_id: forMe ? user.id : null,
      position,
    };
    if (item) {
      await supabase.from('event_transport').update(patch).eq('id', item.id);
    } else {
      patch.created_by = user.id;
      await supabase.from('event_transport').insert(patch);
    }
    setSaving(false);
    onSaved();
  };

  const onTouchStart = (e: React.TouchEvent) => { startYRef.current = e.touches[0].clientY; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 80) onClose();
    else setDragY(0);
    startYRef.current = null;
  };

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:150,background:`rgba(0,0,0,${Math.max(0.2,0.55-dragY/400)})`,display:'flex',alignItems:'flex-end',transition:'background 0.15s'}}>
      <div className="event-transport-sheet" onClick={e => e.stopPropagation()}
        style={{width:'100%',maxHeight:'90vh',background:'var(--bg)',borderRadius:'22px 22px 0 0',
          padding:'10px 16px max(20px, env(safe-area-inset-bottom, 20px))',
          transform:`translateY(${dragY}px)`,transition: dragY === 0 ? 'transform 0.2s' : 'none',
          overflowY:'auto',WebkitOverflowScrolling:'touch',touchAction:'pan-y',boxSizing:'border-box'}}>
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          style={{display:'flex',justifyContent:'center',padding:'2px 0 10px',marginBottom:2,touchAction:'none',cursor:'grab'}}>
          <div style={{width:38,height:5,borderRadius:3,background:'var(--border)'}} />
        </div>
        <h3 style={{margin:'0 0 14px',fontSize: 'var(--fs-snap16)',fontWeight:600}}>
          {item ? 'Изменить' : 'Новый рейс / транспорт'}
        </h3>

        <Label>Тип</Label>
        <div className="event-transport-kind-grid" style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:6,marginBottom:14}}>
          {(Object.keys(KIND_META) as Kind[]).map(k => {
            const m = KIND_META[k];
            const active = kind === k;
            return (
              <button key={k} type="button" onClick={() => setKind(k)}
                style={{padding:'10px 4px',borderRadius:10,
                  border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: active ? 'var(--surface-light)' : 'transparent',
                  cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                  color:'var(--text)',fontSize: 'var(--fs-snap10)',fontWeight: active ? 600 : 500}}>
                <span style={{display:'flex',color: active ? m.color : 'var(--muted)'}}>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="event-transport-pair-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginBottom:0}}>
          <div style={{minWidth:0}}>
            <Label optional>Перевозчик</Label>
            <input value={carrier} onChange={e => setCarrier(e.target.value)} maxLength={50}
              placeholder="Аэрофлот" style={inputStyle()} />
          </div>
          <div style={{minWidth:0}}>
            <Label optional>Номер</Label>
            <input value={number} onChange={e => setNumber(e.target.value)} maxLength={20}
              placeholder="SU-1233" style={inputStyle()} />
          </div>
        </div>

        <Label optional>Откуда</Label>
        <input value={fromPlace} onChange={e => setFromPlace(e.target.value)} maxLength={100}
          placeholder="Москва, SVO" style={inputStyle()} />

        <Label optional>Куда</Label>
        <input value={toPlace} onChange={e => setToPlace(e.target.value)} maxLength={100}
          placeholder="Тбилиси, TBS" style={inputStyle()} />

        <div className="event-transport-date-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
          <div style={{minWidth:0}}>
            <Label optional>Вылет / отправление</Label>
            <input type="datetime-local" value={departAt} onChange={e => setDepartAt(e.target.value)}
              style={{...inputStyle(),fontFamily:'inherit'}} />
          </div>
          <div style={{minWidth:0}}>
            <Label optional>Прибытие</Label>
            <input type="datetime-local" value={arriveAt} onChange={e => setArriveAt(e.target.value)}
              style={{...inputStyle(),fontFamily:'inherit'}} />
          </div>
        </div>

        <Label optional>Заметка</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Багаж 23кг, регистрация онлайн..." maxLength={300}
          style={{...inputStyle(), resize:'vertical', fontFamily:'inherit'}} />

        <div onClick={() => setForMe(b => !b)}
          style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
            background:'var(--surface-light)',borderRadius:10,marginBottom:14,cursor:'pointer'}}>
          <div style={{
            width:18,height:18,borderRadius:9,flexShrink:0,
            border: forMe ? 'none' : '2px solid var(--border)',
            background: forMe ? 'var(--primary)' : 'transparent',
            display:'flex',alignItems:'center',justifyContent:'center'}}>
            {forMe && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
          </div>
          <div style={{fontSize: 'var(--fs-label)',color:'var(--text)'}}>Это мой рейс / транспорт</div>
        </div>

        <button onClick={save} disabled={saving}
          style={{width:'100%',padding:'14px',
            background: 'var(--primary)',color: 'var(--bg)',
            border:'none',borderRadius:12,fontSize: 'var(--fs-body)',fontWeight:600,
            cursor: !saving ? 'pointer' : 'default'}}>
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>
    </div>
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
    width:'100%',minWidth:0,maxWidth:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:12,
    border:'1px solid var(--border)',background:'var(--surface-light)',
    color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:12,outline:'none',
  };
}
