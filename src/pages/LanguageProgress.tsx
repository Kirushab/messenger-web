import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguagesStore, type Language } from '@/stores/languagesStore';
import { haptic } from '@/lib/haptics';

const LEVELS: { key: string; label: string }[] = [
  { key: 'A1', label: 'A1 · начальный' },
  { key: 'A2', label: 'A2 · базовый' },
  { key: 'B1', label: 'B1 · средний' },
  { key: 'B2', label: 'B2 · выше среднего' },
];

function StackBar({ total, learning, mastered }: { total: number; learning: number; mastered: number }) {
  const m = total ? (mastered / total) * 100 : 0;
  const l = total ? (learning / total) * 100 : 0;
  return (
    <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', display: 'flex' }}>
      <div style={{ width: m + '%', background: 'var(--accent)', transition: 'width .4s ease' }} />
      <div style={{ width: l + '%', background: 'var(--warning)', transition: 'width .4s ease' }} />
    </div>
  );
}

export default function LanguageProgress() {
  const nav = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const language = lang as Language;
  const { courses, mastery, loadCourses, loadMastery, streak, loadStreak } = useLanguagesStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await loadCourses();
      await loadMastery(language);
      loadStreak();
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [language]);

  const list = courses
    .filter(c => c.language === language)
    .sort((a, b) => a.level.localeCompare(b.level) || a.order_index - b.order_index);

  const sum = (cs: typeof list) => cs.reduce((acc, c) => {
    const m = mastery[c.id];
    if (m) { acc.total += m.total; acc.learning += m.learning; acc.mastered += m.mastered; }
    return acc;
  }, { total: 0, learning: 0, mastered: 0 });

  const totals = sum(list);
  const pct = totals.total ? Math.round((totals.mastered / totals.total) * 100) : 0;
  const newCount = totals.total - totals.learning - totals.mastered;

  const usedLevels = LEVELS.filter(lv => list.some(c => c.level === lv.key));

  return (
    <div className="page-fade-in" style={{ height: '100dvh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => { haptic.tap(); nav(-1); }} className="tap-effect" style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 600 }}>Прогресс</div>
      </div>

      <main className="page-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-label)' }}>Загрузка…</div>
      ) : list.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-label)' }}>Курс для этого языка пока пуст.</div>
      ) : (
        <div style={{ padding: '16px 16px max(40px, env(safe-area-inset-bottom, 40px))', maxWidth: 480, margin: '0 auto' }}>
          {/* Сводка */}
          <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-1)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(var(--accent) ${pct}%, var(--border) 0)`, WebkitMask: 'radial-gradient(closest-side, transparent 70%, #000 71%)', mask: 'radial-gradient(closest-side, transparent 70%, #000 71%)' }} />
              <div style={{ fontSize: 'var(--fs-title)', fontWeight: 800 }}>{pct}%</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, marginBottom: 8 }}>Освоено {totals.mastered} из {totals.total} слов</div>
              {streak > 0 && <div style={{ fontSize: 'var(--fs-caption)', color: '#EF4444', fontWeight: 600 }}>🔥 серия {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}</div>}
            </div>
          </div>

          {/* Легенда */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 18, fontSize: 'var(--fs-caption)', color: 'var(--muted)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)' }} /> Освоено · {totals.mastered}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--warning)' }} /> Осваивается · {totals.learning}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--border)' }} /> Новые · {newCount}</span>
          </div>

          {/* По уровням и темам */}
          {usedLevels.map(lv => {
            const lvCourses = list.filter(c => c.level === lv.key);
            const lvSum = sum(lvCourses);
            const lvPct = lvSum.total ? Math.round((lvSum.mastered / lvSum.total) * 100) : 0;
            return (
              <div key={lv.key} style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>{lv.label}</div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent)', fontWeight: 700 }}>{lvPct}%</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {lvCourses.map(c => {
                    const m = mastery[c.id] || { total: 0, learning: 0, mastered: 0 };
                    const cpct = m.total ? Math.round((m.mastered / m.total) * 100) : 0;
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-heading)', flexShrink: 0 }}>{c.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title_ru}</span>
                            <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', flexShrink: 0, marginLeft: 8 }}>{m.mastered}/{m.total}</span>
                          </div>
                          <StackBar total={m.total} learning={m.learning} mastered={m.mastered} />
                        </div>
                        <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: cpct > 0 ? 'var(--accent)' : 'var(--muted)', width: 36, textAlign: 'right', flexShrink: 0 }}>{cpct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </main>
    </div>
  );
}
