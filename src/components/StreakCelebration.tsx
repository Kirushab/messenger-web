import { useEffect, useState } from 'react';

interface Props {
  streak: number;
  lastDay: string | null;          // YYYY-MM-DD
  open: boolean;
  onClose: () => void;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Случайные ободряющие фразы — выбираются один раз при показе
const PHRASES = [
  'Так держать! Расскажу всем о твоём стрике.',
  'Огонь! Не теряй темп, всё получится.',
  'Это твой стрик. Береги его как зеницу ока.',
  'Каждый день — твоя маленькая победа.',
  'Стабильность — твоё второе имя.',
];

export default function StreakCelebration({ streak, lastDay, open, onClose }: Props) {
  const [phrase, setPhrase] = useState(PHRASES[0]);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  // Расставляем галочки на неделе по русскому календарю (Пн=0, Вс=6).
  // Идея: если streak=3 и last_day=today, то отмечены сегодня и 2 предыдущих дня.
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7; // 0=Пн ... 6=Вс
  const lastDayDate = lastDay ? new Date(lastDay) : today;
  const lastDayDow = (lastDayDate.getDay() + 6) % 7;

  // На этой неделе отмечены: lastDayDow и до streak-1 дней назад,
  // но не дальше воскресенья прошлой недели (т.е. в пределах текущей недели).
  const checkedDows = new Set<number>();
  let cursor = lastDayDow;
  for (let i = 0; i < streak; i++) {
    if (cursor < 0) break;
    checkedDows.add(cursor);
    cursor--;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 220ms ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 24,
          maxWidth: 360, width: '100%',
          padding: '24px 20px 20px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          animation: 'popIn 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Облачко с фразой */}
        <div style={{
          position: 'relative',
          background: 'var(--surface-light)',
          color: 'var(--text)',
          padding: '10px 14px',
          borderRadius: 14,
          fontSize: 'var(--fs-label)',
          lineHeight: 1.35,
          maxWidth: 280,
          margin: '0 auto 14px',
        }}>
          {phrase}
          {/* стрелка-носик */}
          <div style={{
            position: 'absolute',
            bottom: -7, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
            width: 14, height: 14,
            background: 'var(--surface-light)',
          }}/>
        </div>

        {/* Огонь */}
        <div style={{
          position: 'relative',
          height: 110,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          marginBottom: 4,
        }}>
          {/* Glow за огнём */}
          <div style={{
            position: 'absolute',
            width: 130, height: 130,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)',
            transform: animated ? 'scale(1)' : 'scale(0.3)',
            opacity: animated ? 1 : 0,
            transition: 'all 480ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}/>
          {/* Огонь emoji или SVG */}
          <div style={{
            fontSize: 96, lineHeight: 1,
            transform: animated ? 'scale(1) rotate(-2deg)' : 'scale(0.3) rotate(20deg)',
            transition: 'transform 540ms cubic-bezier(0.34, 1.56, 0.64, 1) 100ms',
            filter: 'drop-shadow(0 4px 8px rgba(245,158,11,0.4))',
          }}>🔥</div>
        </div>

        {/* Большая цифра */}
        <div style={{
          fontSize: 64, fontWeight: 900,
          color: '#F59E0B',
          lineHeight: 1, marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
          transform: animated ? 'scale(1)' : 'scale(0.5)',
          opacity: animated ? 1 : 0,
          transition: 'all 400ms cubic-bezier(0.34, 1.56, 0.64, 1) 280ms',
        }}>{streak}</div>
        <div style={{
          fontSize: 'var(--fs-snap16)', fontWeight: 700,
          color: '#F59E0B',
          marginBottom: 18,
          marginTop: 2,
        }}>
          {streak === 1 ? 'день стрика' : streak < 5 ? 'дня стрика' : 'дней стрика'}
        </div>

        {/* Неделя с галочками */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          padding: '12px 10px',
          background: 'var(--surface-light)',
          borderRadius: 12,
          marginBottom: 18,
        }}>
          {WEEKDAYS.map((label, dow) => {
            const checked = checkedDows.has(dow);
            const isToday = dow === todayDow;
            return (
              <div key={dow} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  fontSize: 'var(--fs-micro)', fontWeight: 600,
                  color: isToday ? '#F59E0B' : 'var(--muted)',
                }}>{label}</div>
                <div style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: checked ? '#F59E0B' : 'var(--bg)',
                  border: isToday && !checked ? '2px solid #F59E0B' : 'none',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: animated && checked ? 'scale(1)' : 'scale(0.7)',
                  opacity: animated ? 1 : 0,
                  transition: `all 280ms cubic-bezier(0.34, 1.56, 0.64, 1) ${360 + dow * 60}ms`,
                }}>
                  {checked && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Большая кнопка */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: '#F59E0B',
            color: '#fff',
            border: 'none',
            padding: '16px',
            borderRadius: 14,
            fontSize: 'var(--fs-snap16)', fontWeight: 800,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            boxShadow: '0 4px 0 #C77B00',
            transition: 'transform 80ms, box-shadow 80ms',
          }}
          onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 0 #C77B00'; }}
          onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 0 #C77B00'; }}
        >
          Продолжить
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn  { 0% { opacity: 0; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
