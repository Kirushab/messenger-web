import { useEffect, useState } from 'react';
import BlockShell from './BlockShell';

interface Props {
  eventId: string;
  lat?: number | null;
  lng?: number | null;
  startAt?: string | null;
}

interface HourPoint {
  time: string;     // ISO
  temp: number;     // °C
  precip: number;   // mm
  code: number;     // WMO weather code
}

function codeToEmoji(code: number, isDay = true): string {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code <= 2) return isDay ? '🌤️' : '☁️';
  if (code === 3) return '☁️';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '🌥️';
}

export default function WeatherHourlyBlock({ eventId, lat, lng, startAt }: Props) {
  const [hours, setHours] = useState<HourPoint[]>([]);
  const [day, setDay] = useState(0); // 0..N
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  void eventId;

  useEffect(() => {
    if (!lat || !lng) { setLoading(false); setError('Нет координат локации'); return; }
    setLoading(true);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation,weathercode&forecast_days=7&timezone=auto`)
      .then(r => r.json())
      .then(data => {
        const arr: HourPoint[] = [];
        const times: string[] = data.hourly?.time || [];
        const temps: number[] = data.hourly?.temperature_2m || [];
        const precs: number[] = data.hourly?.precipitation || [];
        const codes: number[] = data.hourly?.weathercode || [];
        for (let i = 0; i < times.length; i++) {
          arr.push({ time: times[i], temp: temps[i], precip: precs[i], code: codes[i] });
        }
        setHours(arr);
        setLoading(false);
      })
      .catch(e => { setError('Ошибка загрузки прогноза'); setLoading(false); console.error(e); });
  }, [lat, lng]);

  // Группируем по дням
  const days: Record<string, HourPoint[]> = {};
  for (const h of hours) {
    const dateKey = h.time.substring(0, 10);
    (days[dateKey] = days[dateKey] || []).push(h);
  }
  const dayKeys = Object.keys(days).slice(0, 7);
  const currentDayHours = days[dayKeys[day]] || [];

  // Стартовая дата события — переключаемся на неё если в пределах прогноза
  useEffect(() => {
    if (!startAt || dayKeys.length === 0) return;
    const targetDate = startAt.substring(0, 10);
    const idx = dayKeys.indexOf(targetDate);
    if (idx >= 0) setDay(idx);
  }, [startAt, hours.length]);

  return (
    <BlockShell
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>}
      iconBg="#0EA5E9"
      title="Погода почасовая"
      subtitle={!lat || !lng ? 'Нет координат' : 'Прогноз на 7 дней'}
    >
      {loading && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: 8 }}>Загружаем прогноз...</div>}
      {error && <div style={{ fontSize: 'var(--fs-caption)', color: '#EF4444', padding: 8 }}>{error}</div>}
      {!loading && !error && dayKeys.length > 0 && (
        <>
          {/* День-табы */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {dayKeys.map((dk, idx) => {
              const d = new Date(dk);
              const label = d.toLocaleDateString('ru', { weekday: 'short', day: 'numeric' });
              return (
                <button key={dk} onClick={() => setDay(idx)} style={{
                  padding: '6px 10px', borderRadius: 8,
                  background: day === idx ? 'var(--primary)' : 'var(--bg)',
                  color: day === idx ? 'var(--bg)' : 'var(--text)',
                  border: 'none', fontSize: 'var(--fs-micro)', fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}>{label}</button>
              );
            })}
          </div>
          {/* Часовые карточки скроллом */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
            {currentDayHours.map((h, i) => {
              const hour = new Date(h.time).getHours();
              const isDay = hour >= 7 && hour <= 19;
              return (
                <div key={i} style={{
                  flexShrink: 0, width: 56,
                  padding: '8px 4px',
                  background: 'var(--bg)', borderRadius: 8,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 'var(--fs-snap10)', color: 'var(--muted)', marginBottom: 2 }}>
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  <div style={{ fontSize: 'var(--fs-heading)' }}>{codeToEmoji(h.code, isDay)}</div>
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                    {Math.round(h.temp)}°
                  </div>
                  {h.precip > 0 && (
                    <div style={{ fontSize: 9, color: '#0EA5E9' }}>{h.precip.toFixed(1)}мм</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </BlockShell>
  );
}
