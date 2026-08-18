import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAlarmsStore, type SharedAlarm } from '@/stores/alarmsStore';

// Срабатывание будильника, пока приложение открыто: звук (Web Audio) + экран.
// Полноценная побудка при закрытом приложении — на нативной сборке (TestFlight).
export default function AlarmWatcher() {
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { alarms, load } = useAlarmsStore();
  const [due, setDue] = useState<SharedAlarm | null>(null);
  const rungRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<{ ctx: AudioContext | null; timer: any }>({ ctx: null, timer: null });

  // Периодически подгружаем список
  useEffect(() => {
    if (!myId) return;
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [myId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Проверяем, не наступило ли время
  useEffect(() => {
    if (!myId) return;
    const check = () => {
      if (due) return;
      const now = Date.now();
      const hit = alarms.find(a => {
        const t = new Date(a.ring_at).getTime();
        return a.active && t <= now && t > now - 120000 && !rungRef.current.has(a.id);
      });
      if (hit) { rungRef.current.add(hit.id); setDue(hit); startRing(); }
    };
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [alarms, due, myId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRing = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioRef.current.ctx = ctx;
      try { ctx.resume(); } catch { /* noop */ }
      const beep = () => {
        if (!audioRef.current.ctx) return;
        const c = audioRef.current.ctx;
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.value = 880;
        o.type = 'sine';
        o.connect(g); g.connect(c.destination);
        const t0 = c.currentTime;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
        o.start(t0); o.stop(t0 + 0.45);
      };
      beep();
      audioRef.current.timer = setInterval(beep, 750);
    } catch { /* звук недоступен без жеста — экран всё равно покажется */ }
  };

  const stopRing = () => {
    clearInterval(audioRef.current.timer);
    audioRef.current.timer = null;
    try { audioRef.current.ctx?.close(); } catch { /* noop */ }
    audioRef.current.ctx = null;
  };

  const dismiss = () => { stopRing(); setDue(null); };

  useEffect(() => () => stopRing(), []);

  if (!due) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.92)', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 72, marginBottom: 16, animation: 'alarmShake 0.8s ease-in-out infinite' }}>⏰</div>
      <div style={{ fontSize: 'var(--fs-display)', fontWeight: 700, marginBottom: 6 }}>{due.title}</div>
      <div style={{ fontSize: 'var(--fs-body)', opacity: 0.7, marginBottom: 40 }}>
        {new Date(due.ring_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <button onClick={dismiss} style={{
        padding: '16px 48px', borderRadius: 999, border: 'none',
        background: '#fff', color: '#000', fontSize: 'var(--fs-heading)', fontWeight: 700, cursor: 'pointer',
      }}>Выключить</button>
      <style>{`@keyframes alarmShake { 0%,100%{transform:rotate(-10deg)} 50%{transform:rotate(10deg)} }`}</style>
    </div>
  );
}
