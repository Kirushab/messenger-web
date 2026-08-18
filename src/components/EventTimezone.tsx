import { useEffect, useState } from 'react';
import { fetchTimezone } from '@/lib/weather';

export default function EventTimezone({ lat, lng, locationName }: {
  lat: number;
  lng: number;
  locationName?: string | null;
}) {
  const [tz, setTz] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    (async () => {
      const t = await fetchTimezone(lat, lng);
      if (t) setTz(t);
    })();
  }, [lat, lng]);

  // Каждую минуту обновляем
  useEffect(() => {
    if (!tz) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [tz]);

  if (!tz) return null;

  // Локальная таймзона юзера
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz === localTz) return null; // одинаковые — не показываем

  // Время на месте
  let placeTime = '';
  try {
    placeTime = new Intl.DateTimeFormat('ru', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  } catch {
    return null;
  }

  // Считаем разницу в часах
  const offsetDiff = (() => {
    try {
      const placeStr = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(now);
      const localStr = new Intl.DateTimeFormat('en-US', {
        timeZone: localTz,
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(now);

      const [pH, pM] = placeStr.split(/[:\s]/).map(Number);
      const [lH, lM] = localStr.split(/[:\s]/).map(Number);
      let diffMin = (pH * 60 + pM) - (lH * 60 + lM);
      // Поправка на смену суток
      if (diffMin > 12 * 60) diffMin -= 24 * 60;
      if (diffMin < -12 * 60) diffMin += 24 * 60;
      return diffMin;
    } catch {
      return 0;
    }
  })();

  const hours = offsetDiff / 60;
  const diffLabel = hours === 0
    ? 'без разницы'
    : `${hours > 0 ? '+' : ''}${hours} ч от вашего`;

  // Короткое имя города из таймзоны: "Asia/Tbilisi" → "Tbilisi"
  const tzCity = tz.split('/').pop()?.replace(/_/g, ' ') || tz;

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'12px 14px',
      background:'var(--surface-light)',
      border:'1px solid var(--border)',
      borderRadius:12,
      marginTop:12,
    }}>
      <div style={{
        width:34, height:34, borderRadius:17,
        background:'rgba(59,130,246,0.12)',
        color:'#3B82F6',
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <polyline points="12 7 12 12 15 14"/>
        </svg>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize: 'var(--fs-micro)',fontWeight:600,color:'var(--muted)',letterSpacing:0.3,textTransform:'uppercase',marginBottom:2}}>
          Местное время
        </div>
        <div style={{fontSize: 'var(--fs-snap14)',color:'var(--text)',fontVariantNumeric:'tabular-nums',display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontWeight:600}}>{placeTime}</span>
          <span style={{color:'var(--muted)',fontSize: 'var(--fs-caption)'}}>
            {locationName || tzCity} · {diffLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
