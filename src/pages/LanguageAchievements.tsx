import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguagesStore, type Language } from '@/stores/languagesStore';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import MiniBars, { type BarDatum } from '@/components/MiniBars';

const LANG_TITLE: Record<string, { name: string; flag: string }> = {
  en: { name: 'Английский', flag: '🇬🇧' },
  it: { name: 'Итальянский', flag: '🇮🇹' },
  es: { name: 'Испанский', flag: '🇪🇸' },
  de: { name: 'Немецкий', flag: '🇩🇪' },
  fr: { name: 'Французский', flag: '🇫🇷' },
};

interface Badge {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  earned: boolean;
  progress?: string; // например "30/50"
}

export default function LanguageAchievements() {
  const nav = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const language = (lang as Language) || 'en';
  const info = LANG_TITLE[language] || { name: '', flag: '🏅' };

  const { courses, progress, streak, loadCourses, loadProgress, loadStreak } = useLanguagesStore();
  const [mastered, setMastered] = useState(0);
  const [passedLevels, setPassedLevels] = useState<string[]>([]);
  const [activity, setActivity] = useState<BarDatum[]>([]);
  const [periodWords, setPeriodWords] = useState(0);
  const [loading, setLoading] = useState(true);

  const goalHits = (() => {
    try { return parseInt(localStorage.getItem('edu-goal-hits') || '0', 10) || 0; } catch { return 0; }
  })();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadCourses(), loadProgress(), loadStreak()]);
      const langCourseIds = useLanguagesStore.getState().courses.filter(c => c.language === language).map(c => c.id);

      // сданные уровни
      const { data: lt } = await supabase.from('level_test_results').select('level').eq('language', language).eq('passed', true);
      if (alive) setPassedLevels(((lt || []) as any[]).map(x => x.level));

      // освоенные слова (уровень памяти 5) в этом языке
      let m = 0;
      if (langCourseIds.length) {
        const { data: w } = await supabase.from('language_words').select('id').in('course_id', langCourseIds);
        const wordIds = ((w || []) as any[]).map(x => x.id);
        if (wordIds.length) {
          const { count } = await supabase.from('user_word_memory').select('word_id', { count: 'exact', head: true }).in('word_id', wordIds).gte('level', 5);
          m = count || 0;
        }
      }
      // активность за 14 дней (по этому языку)
      const since = new Date(); since.setDate(since.getDate() - 13); since.setHours(0, 0, 0, 0);
      const days: { key: string; label: string }[] = [];
      for (let i = 0; i < 14; i++) { const dt = new Date(since); dt.setDate(since.getDate() + i); days.push({ key: dt.toISOString().slice(0, 10), label: String(dt.getDate()) }); }
      const { data: sess } = await supabase.from('language_sessions').select('started_at, total, course_id').gte('started_at', since.toISOString());
      const langSet = new Set(langCourseIds);
      const sums: Record<string, number> = {};
      for (const ss of ((sess || []) as any[])) { if (!langSet.has(ss.course_id)) continue; const key = String(ss.started_at).slice(0, 10); sums[key] = (sums[key] || 0) + (ss.total || 0); }
      const arr: BarDatum[] = days.map((d, i) => ({ label: (i % 2 === 0 || i === 13) ? d.label : '', value: sums[d.key] || 0 }));

      if (alive) {
        setMastered(m);
        setActivity(arr);
        setPeriodWords(Object.values(sums).reduce((a, b) => a + b, 0));
        setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const langCourses = courses.filter(c => c.language === language);
  const a1 = langCourses.filter(c => c.level === 'A1');
  const a1AllDone = a1.length > 0 && a1.every(c => progress[c.id]?.completed);
  const anyPerfect = langCourses.some(c => (progress[c.id]?.best_accuracy ?? 0) >= 100);

  const badges: Badge[] = [
    { id: 'streak3', emoji: '🔥', title: 'Серия 3 дня', desc: 'Занимайся 3 дня подряд', earned: streak >= 3 },
    { id: 'streak7', emoji: '🔥', title: 'Серия 7 дней', desc: '7 дней подряд', earned: streak >= 7 },
    { id: 'streak30', emoji: '🔥', title: 'Серия 30 дней', desc: '30 дней подряд', earned: streak >= 30 },
    { id: 'level1', emoji: '🎓', title: 'Первый уровень', desc: 'Сдай любой тест уровня', earned: passedLevels.length >= 1 },
    { id: 'a1all', emoji: '🎓', title: 'Все темы A1', desc: 'Пройди все темы уровня A1', earned: a1AllDone },
    { id: 'perfect', emoji: '💯', title: 'Тема на 100%', desc: 'Пройди тему без ошибок', earned: anyPerfect },
    { id: 'words50', emoji: '📚', title: '50 слов освоено', desc: 'Доведи 50 слов до максимума', earned: mastered >= 50, progress: mastered < 50 ? `${mastered}/50` : undefined },
    { id: 'words200', emoji: '📚', title: '200 слов освоено', desc: 'Доведи 200 слов до максимума', earned: mastered >= 200, progress: mastered < 200 ? `${mastered}/200` : undefined },
    { id: 'goal5', emoji: '🎯', title: 'Цель дня ×5', desc: 'Выполни дневную цель 5 раз', earned: goalHits >= 5, progress: goalHits < 5 ? `${goalHits}/5` : undefined },
  ];

  const earnedCount = badges.filter(b => b.earned).length;
  const pct = Math.round((earnedCount / badges.length) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="safe-top" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button onClick={() => { haptic.tap(); nav(-1); }} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold, 600)', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/></svg>Достижения</div>
        <div style={{ marginLeft: 'auto', fontSize: 'var(--fs-title)' }}>{info.flag}</div>
      </header>

      <div className="page-scroll" style={{ padding: 16 }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {/* Сводка */}
          <div className="edu-card" style={{ background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)' }}>{info.name}</div>
              <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--accent)' }}>{earnedCount}/{badges.length}</div>
            </div>
            <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: pct + '%', height: '100%', background: 'var(--accent)', transition: 'width 500ms var(--ease-out, ease)' }} />
            </div>
          </div>

          {/* График активности */}
          {activity.length > 0 && (
            <div className="edu-card" style={{ background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)' }}>Активность · 14 дней</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>{periodWords} слов</div>
              </div>
              <MiniBars data={activity} height={110} suffix=" слов" />
            </div>
          )}

          {/* Сетка бейджей */}
          <div className="edu-cascade" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {badges.map(b => (
              <div key={b.id} className="edu-card" style={{
                position: 'relative', padding: 14, borderRadius: 16, textAlign: 'center',
                background: b.earned ? 'var(--surface-2)' : 'var(--surface-light)',
                border: b.earned ? '1px solid var(--accent)' : '1px solid var(--border)',
                boxShadow: b.earned ? 'var(--shadow-1)' : 'none',
                opacity: b.earned ? 1 : 0.6,
              }}>
                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                  {b.earned ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  )}
                </div>
                <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 8, marginTop: 4, filter: b.earned ? 'none' : 'grayscale(1)' }}>{b.emoji}</div>
                <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--text)' }}>{b.title}</div>
                <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>{b.desc}</div>
                {!b.earned && b.progress && (
                  <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>{b.progress}</div>
                )}
              </div>
            ))}
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--muted)', fontSize: 'var(--fs-caption)' }}>
              <span className="anim-spin" style={{ display: 'inline-block' }}>↻</span> Обновляем прогресс…
            </div>
          )}
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-micro)', marginTop: 18, lineHeight: 1.5 }}>
            Серия и «цель дня» — общие для всех языков. Остальное считается по этому языку.
          </p>
        </div>
      </div>
    </div>
  );
}
