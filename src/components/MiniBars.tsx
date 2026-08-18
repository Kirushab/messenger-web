import { useState, useEffect } from 'react';

export interface BarDatum { label: string; value: number; }

/**
 * Лёгкий столбчатый график (без зависимостей). Столбцы растут при появлении.
 * data — массив {label, value}. Пустой label не подписывается.
 */
export default function MiniBars({
  data,
  height = 120,
  color = 'var(--accent)',
  suffix = '',
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
  suffix?: string;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const max = Math.max(1, ...data.map(d => d.value));
  const gap = data.length > 10 ? 3 : 6;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, height, width: '100%' }}>
      {data.map((d, i) => {
        const hPct = Math.round((d.value / max) * 100);
        return (
          <div
            key={i}
            title={`${d.label}: ${d.value}${suffix}`}
            style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}
          >
            <div style={{
              width: '100%', maxWidth: 26,
              height: (grown ? Math.max(d.value > 0 ? 4 : 2, hPct) : 0) + '%',
              background: d.value > 0 ? color : 'var(--border)',
              borderRadius: '4px 4px 0 0',
              transition: `height 600ms var(--ease-out, ease) ${Math.min(i, 20) * 25}ms`,
            }} />
            {d.label ? (
              <div style={{ fontSize: 'var(--fs-snap10)', color: 'var(--muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%' }}>{d.label}</div>
            ) : <div style={{ height: 'var(--fs-snap10)', marginTop: 4 }} />}
          </div>
        );
      })}
    </div>
  );
}
