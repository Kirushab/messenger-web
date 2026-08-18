import { useEffect, useState } from 'react';
import { fetchWeather, weatherIcon, type DailyWeather } from '@/lib/weather';

const WEEKDAYS_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export default function EventWeather({ lat, lng, startAt, endAt }: {
  lat: number;
  lng: number;
  startAt: string;
  endAt: string | null;
}) {
  const [daily, setDaily] = useState<DailyWeather[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    // Ограничение: погода доступна максимум на 16 дней вперёд от сегодня
    const now = new Date();
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : start;

    // Если событие закончилось — не показываем
    if (end.getTime() + 24*60*60*1000 < now.getTime()) {
      setLoading(false);
      return;
    }

    // Старт: max(сегодня, дата старта события)
    const startFetch = new Date(Math.max(now.getTime(), start.getTime()));
    // Конец: min(событие+16 дней, событие.end_at)
    const maxEnd = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000);
    const endFetch = new Date(Math.min(end.getTime(), maxEnd.getTime()));

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    if (endFetch.getTime() < startFetch.getTime()) {
      setLoading(false);
      return;
    }

    (async () => {
      const res = await fetchWeather(lat, lng, fmt(startFetch), fmt(endFetch));
      if (!res || res.daily.length === 0) {
        setErr(true);
      } else {
        setDaily(res.daily);
      }
      setLoading(false);
    })();
  }, [lat, lng, startAt, endAt]);

  if (loading) {
    return (
      <div style={{marginTop:18}}>
        <div style={{fontSize: 'var(--fs-micro)',fontWeight:600,color:'var(--muted)',letterSpacing:0.5,textTransform:'uppercase',marginBottom:8}}>
          🌤️ Погода
        </div>
        <div style={{padding:'14px',textAlign:'center',color:'var(--muted)',fontSize: 'var(--fs-caption)',
          background:'var(--surface-light)',borderRadius:12}}>
          Загрузка прогноза...
        </div>
      </div>
    );
  }

  if (err || daily.length === 0) return null;

  return (
    <div style={{
      marginTop:12,
      background:'var(--surface-light)',
      border:'1px solid var(--border)',
      borderRadius:12,
      padding:'12px 14px',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <div style={{
          width:34, height:34, borderRadius:17,
          background:'rgba(251,191,36,0.16)',
          color:'#F59E0B',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          flexShrink:0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        </div>
        <div style={{fontSize: 'var(--fs-label)',fontWeight:600,color:'var(--text)'}}>
          Погода на даты поездки
        </div>
      </div>
      <div style={{
        display:'flex',gap:6,overflowX:'auto',padding:'2px 0',
        WebkitOverflowScrolling:'touch',
        scrollbarWidth:'none',
        scrollSnapType:'x mandatory',
        margin:'0 -2px',
      }}>
        {daily.map(d => {
          const date = new Date(d.date + 'T12:00:00');
          const ic = weatherIcon(d.code);
          return (
            <div key={d.date} style={{
              minWidth:74,flexShrink:0,
              background:'var(--surface)',
              border:'1px solid var(--border)',
              borderRadius:10,padding:'10px 6px',
              display:'flex',flexDirection:'column',alignItems:'center',gap:3,
              textAlign:'center',
              scrollSnapAlign:'start',
            }}>
              <div style={{fontSize: 'var(--fs-snap10)',color:'var(--muted)',fontWeight:600,letterSpacing:0.3,textTransform:'uppercase'}}>
                {WEEKDAYS_RU[date.getDay()]} {date.getDate()}
              </div>
              <div style={{fontSize:28,lineHeight:1,margin:'2px 0'}}>{ic.emoji}</div>
              <div style={{fontSize: 'var(--fs-label)',color:'var(--text)',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>
                {d.tMax > 0 ? '+' : ''}{d.tMax}°
              </div>
              <div style={{fontSize: 'var(--fs-micro)',color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>
                {d.tMin > 0 ? '+' : ''}{d.tMin}°
              </div>
              {d.precip > 0.5 && (
                <div style={{fontSize:9,color:'#3B82F6',fontWeight:600}}>
                  💧 {d.precip.toFixed(0)}мм
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
