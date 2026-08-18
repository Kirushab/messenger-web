import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguagesStore, type Language } from '@/stores/languagesStore';
import StreakCelebration from '@/components/StreakCelebration';
import { haptic } from '@/lib/haptics';
import { GlyphIcon } from '@/components/icons/AppGlyph';
import { toast } from '@/stores/toastStore';
import { supabase } from '@/lib/supabase';
import { speak } from '@/lib/speech';
import { useAuthStore } from '@/stores/authStore';
import { hasFlag } from '@/lib/featureFlags';

interface LangInfo {
  code: Language;
  title: string;
  flag: string;
  hint: string;
}

const LANGUAGES: LangInfo[] = [
  { code: 'en', title: 'Английский',  flag: '🇬🇧', hint: 'A1 → A2 + IELTS подготовка' },
  { code: 'it', title: 'Итальянский', flag: '🇮🇹', hint: 'A1 → A2 → B1 · грамматика · CILS' },
  { code: 'es', title: 'Испанский',   flag: '🇪🇸', hint: 'A1 · базовый словарь · пополняется' },
  { code: 'de', title: 'Немецкий',    flag: '🇩🇪', hint: 'A1 · базовый словарь · пополняется' },
  { code: 'fr', title: 'Французский', flag: '🇫🇷', hint: 'A1 · базовый словарь · пополняется' },
];

export default function LanguagesLobby() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const canOpenGmat = hasFlag(user, 'gmat');
  const canOpenNotes = hasFlag(user, 'notes');
  const { courses, progress, streak, streakLastDay, loadCourses, loadProgress, loadStreak, dailyCount, dueCounts, loadDailyCount, loadDueCounts, freezes } = useLanguagesStore();
  const [lastCourse] = useState<{ lang: string; courseId: string; title: string; icon: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem('edu-last-course') || 'null'); } catch { return null; }
  });
  const [goal, setGoal] = useState<number>(() => {
    const v = parseInt(localStorage.getItem('edu-daily-goal') || '20', 10);
    return [10, 20, 30, 50].includes(v) ? v : 20;
  });
  const cycleGoal = () => {
    haptic.tap();
    const opts = [10, 20, 30, 50];
    const ng = opts[(opts.indexOf(goal) + 1) % opts.length];
    setGoal(ng);
    try { localStorage.setItem('edu-daily-goal', String(ng)); } catch { /* noop */ }
  };
  const reachedGoal = dailyCount >= goal;
  const dailyPct = Math.min(100, Math.round((dailyCount / Math.max(1, goal)) * 100));
  useEffect(() => {
    if (dailyCount > 0 && reachedGoal) {
      try {
        const today = new Date().toDateString();
        if (localStorage.getItem('edu-goal-hit-day') !== today) {
          localStorage.setItem('edu-goal-hit-day', today);
          const n = (parseInt(localStorage.getItem('edu-goal-hits') || '0', 10) || 0) + 1;
          localStorage.setItem('edu-goal-hits', String(n));
        }
      } catch { /* noop */ }
    }
  }, [dailyCount, reachedGoal]);
  const [streakOpen, setStreakOpen] = useState(false);
  const [wod, setWod] = useState<{ word: string; tr: string; ex: string | null; lang: Language } | null>(null);
  const [wodLoading, setWodLoading] = useState(true);

  useEffect(() => { loadCourses(); loadProgress(); loadStreak(); loadDailyCount(); loadDueCounts(); /* eslint-disable-next-line */ }, []);

  // «Слово дня» — детерминированно по дню, из языка последнего курса (или первого доступного).
  useEffect(() => {
    if (courses.length === 0) return;
    (async () => {
      try {
        const wlang = ((lastCourse?.lang as Language) || courses[0]?.language) as Language;
        if (!wlang) return;
        const ids = courses.filter(c => c.language === wlang).map(c => c.id);
        if (ids.length === 0) return;
        const { data } = await supabase.from('language_words').select('word, translation_ru, example').in('course_id', ids).order('order_index');
        const words = ((data || []) as any[]).filter(x => x.word && x.translation_ru);
        if (words.length === 0) return;
        const dayNum = Math.floor(Date.now() / 86400000);
        const w = words[dayNum % words.length];
        setWod({ word: w.word, tr: w.translation_ru, ex: w.example || null, lang: wlang });
      } finally { setWodLoading(false); }
    })();
    // eslint-disable-next-line
  }, [courses.length, lastCourse]);

  const completedFor = (lang: Language) => {
    const langCourses = courses.filter(c => c.language === lang);
    const done = langCourses.filter(c => progress[c.id]?.completed).length;
    return { done, total: langCourses.length };
  };

  // Стрик считается «активным» если последний день — сегодня или вчера. Иначе он сломан
  // (БД его обнулит при следующей сессии). Просто крашим цвет.
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streakActive = streakLastDay === today || streakLastDay === yest;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="safe-top" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        <button onClick={() => nav(-1)} style={{
          width: 36, height: 36, borderRadius: 18, border: 'none',
          background: 'var(--surface-light)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold)' }}>Обучение</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {streak > 0 && (
            <button
              onClick={() => { haptic.tap(); setStreakOpen(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: streakActive ? 'rgba(239, 68, 68, 0.12)' : 'var(--surface-light)',
                color: streakActive ? '#EF4444' : 'var(--muted)',
                padding: '4px 10px', borderRadius: 14,
                fontSize: 'var(--fs-label)', fontWeight: 700,
                opacity: streakActive ? 1 : 0.6,
                border: 'none', cursor: 'pointer',
              }}
            >
              <span className={streakActive ? 'edu-flame' : undefined} style={{ display: 'inline-flex' }}><GlyphIcon name="flame" size={14} /></span> {streak}
            </button>
          )}
          <button onClick={() => { haptic.tap(); toast.info(`Заморозок: ${freezes}. Спасают серию при пропуске дня. +1 за каждые 7 дней (макс 3).`); }} aria-label="Заморозки" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface-light)', color: 'var(--text2)', padding: '4px 10px', borderRadius: 14, fontSize: 'var(--fs-label)', fontWeight: 700, border: 'none', cursor: 'pointer' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/><line x1="19.1" y1="4.9" x2="4.9" y2="19.1"/></svg>{freezes}</button>
          <button
            onClick={() => { haptic.tap(); nav('/languages/leaderboard'); }}
            style={{
              background: 'var(--surface-light)', border: 'none',
              width: 36, height: 36, borderRadius: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--fs-heading)', color: 'var(--text)',
            }}
            aria-label="Лидерборд"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3"/></svg>
          </button>
          <button onClick={() => { haptic.tap(); nav('/learn/settings'); }} aria-label="Настройки" style={{ background: 'var(--surface-light)', border: 'none', width: 36, height: 36, borderRadius: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-heading)', color: 'var(--text)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
        </div>
      </header>

      <div className="page-scroll" style={{ padding: 'var(--sp-5) var(--sp-4) var(--sp-8)' }}>
        <div className="edu-card" style={{ maxWidth: 480, margin: '0 auto var(--sp-5)', background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-label)', fontWeight: 700, color: reachedGoal ? '#10B981' : 'var(--text)' }}>
              {reachedGoal
                ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Цель дня выполнена</>
                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>Цель на сегодня</>}
            </div>
            <button onClick={cycleGoal} className="tap-effect" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '3px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-snap14)', fontWeight: 700 }}>
              {dailyCount}/{goal}
            </button>
          </div>
          <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: dailyPct + '%', height: '100%', background: reachedGoal ? '#10B981' : 'var(--accent)', transition: 'width 500ms var(--ease-out, ease)' }} />
          </div>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 6 }}>
            {reachedGoal ? 'Отличная работа — так держать!' : `Ещё ${Math.max(0, goal - dailyCount)} слов до цели · нажми число, чтобы изменить`}
          </div>
        </div>
        <p style={{
          textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-label)',
          margin: '0 0 var(--sp-6)', lineHeight: 'var(--lh-normal)', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto',
        }}>
          Выбери язык. Каждый — мини-курсы по темам:<br/>еда, семья, бытовое, числа, приветствия.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480, margin: '0 auto' }}>
          {lastCourse && lastCourse.courseId && (
            <button
              onClick={() => { haptic.tap(); nav(`/languages/${lastCourse.lang}/learn/${lastCourse.courseId}`); }}
              className="tap-effect edu-card"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.16) 0%, rgba(16,185,129,0.06) 100%)',
                border: '1px solid rgba(16,185,129,0.3)', boxShadow: 'var(--shadow-1)',
                borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)',
                display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
                cursor: 'pointer', textAlign: 'left', animationDelay: '0ms',
              }}
            >
              <div style={{ fontSize: 36, lineHeight: 1 }}>{lastCourse.icon || '▶️'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-caption)', color: '#10B981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Продолжить</div>
                <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastCourse.title}</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
          {wod ? (
            <div className="edu-card tap-effect" onClick={() => { haptic.tap(); speak(wod.word, wod.lang); }} style={{ background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Слово дня · {wod.lang.toUpperCase()}</span>
                <button onClick={(e) => { e.stopPropagation(); haptic.tap(); speak(wod.word, wod.lang); }} aria-label="Произнести" style={{ width: 34, height: 34, borderRadius: 17, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
              </div>
              <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--text)' }}>{wod.word}</div>
              <div style={{ fontSize: 'var(--fs-body)', color: 'var(--muted)', marginTop: 2 }}>{wod.tr}</div>
              {wod.ex && <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--text2)', marginTop: 8, fontStyle: 'italic' }}>{wod.ex}</div>}
            </div>
          ) : wodLoading ? (
            <div className="edu-card" style={{ background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="skeleton-shimmer" style={{ width: 96, height: 12 }} />
                <span className="skeleton-shimmer" style={{ width: 34, height: 34, borderRadius: 17 }} />
              </div>
              <span className="skeleton-shimmer" style={{ display: 'block', width: '55%', height: 20, marginTop: 4 }} />
              <span className="skeleton-shimmer" style={{ display: 'block', width: '40%', height: 14, marginTop: 8 }} />
            </div>
          ) : null}
          {LANGUAGES.map((lang, li) => {
            const { done, total } = completedFor(lang.code);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <button
                key={lang.code}
                onClick={() => { haptic.tap(); nav(`/languages/${lang.code}`); }}
                className="tap-effect edu-card"
                style={{
                  background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', border: 'none',
                  borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)',
                  display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
                  cursor: 'pointer', textAlign: 'left', animationDelay: li * 60 + 'ms',
                }}
              >
                <div style={{ fontSize: 40, lineHeight: 1 }}>{lang.flag}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{lang.title}</div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>{lang.hint}</div>
                  <div style={{ marginTop: 'var(--sp-2)', height: 5, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', background: '#10B981', transition: 'width 400ms' }} />
                  </div>
                  <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 'var(--sp-1)' }}>
                    Пройдено {done} из {total} тем
                  </div>
                </div>
                {(dueCounts[lang.code] || 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', padding: '3px 9px', borderRadius: 12, fontSize: 'var(--fs-caption)', fontWeight: 700, flexShrink: 0 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>{dueCounts[lang.code]}</div>
                )}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            );
          })}

          <button
            onClick={() => { haptic.tap(); nav('/quizzes'); }}
            className="tap-effect edu-card"
            style={{
              background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', border: 'none',
              borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)',
              display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
              cursor: 'pointer', textAlign: 'left', width: '100%',
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 12l2 2 4-4"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>Мои тесты</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Собери тест из любого текста с помощью нейросети</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          {canOpenGmat && (
            <button
              onClick={() => { haptic.tap(); nav('/gmat'); }}
              className="tap-effect edu-card"
              style={{
                background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', border: 'none',
                borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)',
                display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
                cursor: 'pointer', textAlign: 'left', animationDelay: '300ms',
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(124,58,237,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 3 2.5 6 2.5s6-1 6-2.5v-5"/></svg></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>Тест MBA / GMAT</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Quant · Verbal · Data Sufficiency · с разбором</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}

          {canOpenNotes && (
            <button
              onClick={() => { haptic.tap(); nav('/notes'); }}
              className="tap-effect edu-card"
              style={{
                background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', border: 'none',
                borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)',
                display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
                cursor: 'pointer', textAlign: 'left', animationDelay: '360ms',
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>Ноты</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Чтение нот с листа — тренажёр</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}

          <button
            onClick={() => { haptic.tap(); nav('/vocab'); }}
            className="tap-effect edu-card"
            style={{
              background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', border: 'none',
              borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)',
              display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
              cursor: 'pointer', textAlign: 'left', animationDelay: '420ms',
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>Свои наборы слов</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Создавай и учи свои списки · карточки и квиз</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
      <StreakCelebration
        streak={streak}
        lastDay={streakLastDay}
        open={streakOpen}
        onClose={() => setStreakOpen(false)}
      />
    </div>
  );
}
