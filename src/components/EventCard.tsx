import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { IconPartyPopper, IconPlane, IconCalendar, IconMapPin, IconUsers } from '@/components/icons/EventIcons';
import { SkeletonWidgetCard } from '@/components/Skeleton';

const TYPE_META: any = {
  party: { Icon: IconPartyPopper, gradient: 'var(--surface-light)', label: 'Туса' },
  trip:  { Icon: IconPlane,       gradient: 'var(--surface-light)', label: 'Поездка' },
};

export default function EventCard({ eventId }: { eventId: string }) {
  const nav = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      setEvent(data || null);
      if (data) {
        const { count } = await supabase
          .from('event_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('rsvp_status', 'going');
        setMemberCount(count);
      }
      setLoading(false);
    })();
  }, [eventId]);

  if (loading) {
    return <SkeletonWidgetCard variant="event" />;
  }
  if (!event) {
    return <div style={{padding:'12px 14px',background:'var(--surface-light)',borderRadius:14,fontSize: 'var(--fs-label)',color:'var(--muted)'}}>Событие не найдено</div>;
  }

  const meta = TYPE_META[event.type] || TYPE_META.party;
  const startDate = new Date(event.start_at);

  return (
    <div
      onClick={() => nav('/events/' + event.id)}
      style={{
        width:272, height:236, boxSizing:'border-box',
        background:'var(--surface-2)',
        border:'1px solid var(--border)',
        borderRadius:16,
        overflow:'hidden',
        cursor:'pointer',
        boxShadow:'var(--shadow-card)',
      }}
    >
      <div style={{
        position:'relative',height:132,
        background: event.cover_url ? '#000' : 'var(--surface-light)' ,
        display:'flex',alignItems:'center',justifyContent:'center',
      }}>
        {event.cover_url
          ? <img src={event.cover_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
          : <meta.Icon size={56} color="var(--muted)" strokeWidth={1.4} style={{ opacity: 0.9 }} />}
        {/* Тип-чип сверху-слева */}
        <div style={{
          position:'absolute',top:10,left:10,
          padding:'4px 10px',borderRadius:11,
          background:'rgba(0,0,0,0.5)',backdropFilter:'blur(8px)',
          color:'#fff',fontSize: 'var(--fs-snap10)',fontWeight:700,letterSpacing:0.5,
          display:'flex',alignItems:'center',gap:5,
        }}>
          <meta.Icon size={12} color="#fff" strokeWidth={2} />
          {meta.label.toUpperCase()}
        </div>
        {/* Кол-во участников справа сверху, если есть */}
        {memberCount != null && memberCount > 0 && (
          <div style={{
            position:'absolute',top:10,right:10,
            padding:'4px 9px',borderRadius:11,
            background:'rgba(0,0,0,0.5)',backdropFilter:'blur(8px)',
            color:'#fff',fontSize: 'var(--fs-micro)',fontWeight:600,
            display:'flex',alignItems:'center',gap:4,
          }}>
            <IconUsers size={12} color="#fff" strokeWidth={2} />
            {memberCount}
          </div>
        )}
        {/* Градиент снизу обложки чтобы заголовок читался поверх если фото темное */}
        {event.cover_url && (
          <div style={{
            position:'absolute',left:0,right:0,bottom:0,height:48,
            background:'linear-gradient(to top, rgba(0,0,0,0.55), transparent)',pointerEvents:'none',
          }} />
        )}
      </div>
      <div style={{padding:'11px 13px',height:104,boxSizing:'border-box',overflow:'hidden'}}>
        <div style={{fontSize: 'var(--fs-snap14)',fontWeight:600,color:'var(--text)',marginBottom:6,lineHeight:1.25,
          overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
          {event.title}
        </div>
        <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',display:'flex',alignItems:'center',gap:6}}>
          <IconCalendar size={13} color="var(--muted)" strokeWidth={1.8} />
          <span>
            {startDate.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
            {event.type === 'party' && ' · ' + startDate.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        {event.location_name && (
          <div style={{fontSize: 'var(--fs-caption)',color:'var(--muted)',display:'flex',alignItems:'center',gap:6,marginTop:4,
            overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
            <IconMapPin size={13} color="var(--muted)" strokeWidth={1.8} />
            <span style={{overflow:'hidden',textOverflow:'ellipsis'}}>{event.location_name}</span>
          </div>
        )}
        {event.status === 'cancelled' && (
          <div style={{marginTop:6,padding:'2px 7px',background:'rgba(239,68,68,0.15)',color:'#EF4444',
            borderRadius:6,fontSize: 'var(--fs-snap10)',fontWeight:700,letterSpacing:0.4,display:'inline-block'}}>
            ОТМЕНЕНО
          </div>
        )}
      </div>
    </div>
  );
}
