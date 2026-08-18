import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguagesStore, type Language, type LanguageCourse as LangCourse } from '@/stores/languagesStore';
import { supabase } from '@/lib/supabase';
import EmptyState from '@/components/EmptyState';
import { SkeletonCourseCard } from '@/components/Skeleton';
import { haptic } from '@/lib/haptics';
import ErrorRetry from '@/components/ErrorRetry';

const LANG_TITLE: Record<Language, { name: string; flag: string }> = {
  en: { name: 'Английский',  flag: '🇬🇧' },
  it: { name: 'Итальянский', flag: '🇮🇹' },
  es: { name: 'Испанский',   flag: '🇪🇸' },
  de: { name: 'Немецкий',    flag: '🇩🇪' },
  fr: { name: 'Французский', flag: '🇫🇷' },
};

// Подпись секции уровня (A1 / A2 / B1)
function SectionLabel({ title, hint, dimmed, done, total }: { title: string; hint?: string; dimmed?: boolean; done?: number; total?: number }) {
  const hasBar = typeof total === 'number' && total > 0;
  const pct = hasBar ? Math.round(((done || 0) / (total as number)) * 100) : 0;
  return (
    <div style={{ marginTop: 18, marginBottom: 10, opacity: dimmed ? 0.7 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
        {hasBar && <div style={{ fontSize: 'var(--fs-micro)', color: pct === 100 ? '#10B981' : 'var(--muted)', fontWeight: 700, flexShrink: 0 }}>{done || 0}/{total}</div>}
      </div>
      {hint && <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 2 }}>{hint}</div>}
      {hasBar && (
        <div style={{ marginTop: 8, height: 5, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: pct + '%', height: '100%', background: '#10B981', transition: 'width 500ms var(--ease-out, ease)' }} />
        </div>
      )}
    </div>
  );
}

// Строка одной темы курса
function CourseRow({ c, done, locked, accuracy, masteryPct, onTap }: {
  c: LangCourse;
  done: boolean;
  locked: boolean;
  accuracy?: number;
  masteryPct?: number;
  onTap: () => void;
}) {
  return (
    <button
      onClick={() => { if (locked) return; haptic.tap(); onTap(); }}
      disabled={locked}
      className="tap-effect edu-card"
      style={{
        background: done ? 'rgba(16,185,129,0.12)' : 'var(--surface-2)',
        boxShadow: done ? 'none' : 'var(--shadow-1)',
        border: done ? '1px solid rgba(16,185,129,0.3)' : 'none',
        borderRadius: 14, padding: 14,
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: locked ? 'default' : 'pointer',
        opacity: locked ? 0.5 : 1, textAlign: 'left',
      }}
    >
      <div style={{ position: 'relative', width: 50, height: 50, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {masteryPct !== undefined && masteryPct > 0 && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(var(--accent) ${masteryPct}%, var(--border) 0)`, WebkitMask: 'radial-gradient(closest-side, transparent 78%, #000 79%)', mask: 'radial-gradient(closest-side, transparent 78%, #000 79%)' }} />
        )}
        <div style={{
          width: 44, height: 44, borderRadius: 22,
          background: done ? '#10B981' : 'var(--accent-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--fs-title)',
        }}>{c.icon}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>{c.title_ru}</div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>
          {c.description_ru}
          {accuracy !== undefined && accuracy > 0 && <span style={{ marginLeft: 6 }}> · точность {accuracy}%</span>}
        </div>
      </div>
      {locked
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        : done
          ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      }
    </button>
  );
}

export default function LanguageCourse() {
  const nav = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const language = lang as Language;
  const { courses, progress, loadCourses, loadProgress, loadingCourses, coursesError, mastery, loadMastery } = useLanguagesStore();

  useEffect(() => { loadCourses(); loadProgress(); loadMastery(language); /* eslint-disable-next-line */ }, []);

  // Результаты тестов уровня (passed) — для разблокировки следующего уровня.
  const [testPassed, setTestPassed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    (async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return;
      const { data } = await supabase.from('level_test_results')
        .select('level, passed').eq('user_id', uid).eq('language', language);
      const m: Record<string, boolean> = {};
      for (const r of (data || []) as any[]) if (r.passed) m[r.level] = true;
      setTestPassed(m);
    })();
  }, [language]);

  // Все курсы данного языка, отсортированы по уровню (A1, A2, B1) и order_index.
  // Группируем по уровню для рендера секциями.
  const courseList = courses
    .filter(c => c.language === language)
    .sort((a, b) => a.level.localeCompare(b.level) || a.order_index - b.order_index);

  const a1Courses = courseList.filter(c => c.level === 'A1');
  const a2Courses = courseList.filter(c => c.level === 'A2');
  const b1Courses = courseList.filter(c => c.level === 'B1');
  const b2Courses = courseList.filter(c => c.level === 'B2');
  const a1AllDone = a1Courses.length > 0 && a1Courses.every(c => progress[c.id]?.completed);
  const a2AllDone = a2Courses.length > 0 && a2Courses.every(c => progress[c.id]?.completed);
  const b1AllDone = b1Courses.length > 0 && b1Courses.every(c => progress[c.id]?.completed);

  // Уровень открыт, если пройдены все темы предыдущего ИЛИ сдан тест предыдущего уровня (≥75%).
  const a2Unlocked = a1AllDone || !!testPassed['A1'];
  const b1Unlocked = a2AllDone || !!testPassed['A2'];
  const b2Unlocked = b1AllDone || !!testPassed['B1'];

  // Тест-подготовка: IELTS для en, CILS для it. Доступна параллельно, не зависит от A1/A2.
  const testPrepLevel = language === 'en' ? 'IELTS' : 'CILS';
  const GRAMMAR_HINT: Record<string, string> = {
    en: 'present, past, articles, modals…',
    it: 'io parlo, tu parli… + il / lo / la / l\u2019',
    es: 'yo soy, hablo… + el / la',
    de: 'ich bin, spreche… + der / die / das',
    fr: 'je suis, parle… + le / la',
  };
  const testPrepCourses = courseList.filter(c => c.level === testPrepLevel);

  const [query, setQuery] = useState('');
  const searchActive = query.trim().length > 0;
  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return [] as LangCourse[];
    return courseList.filter(c => (c.title_ru || '').toLowerCase().includes(t) || (c.description_ru || '').toLowerCase().includes(t));
  }, [query, courseList]);

  const info = LANG_TITLE[language];

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
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, lineHeight: 1.1 }}>{info?.name}</div>
        <button onClick={() => { haptic.tap(); nav(`/languages/${language}/progress`); }} aria-label="Прогресс" style={{ marginLeft: 'auto', width: 36, height: 36, borderRadius: 18, background: 'var(--surface-light)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-heading)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></button>
        <button onClick={() => { haptic.tap(); nav(`/languages/${language}/words`); }} aria-label="Мои слова" style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--surface-light)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-heading)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></button>
        <button onClick={() => { haptic.tap(); nav(`/languages/${language}/achievements`); }} aria-label="Достижения" style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--surface-light)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-heading)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="15" r="6"/><path d="M9 9.5L7 2h10l-2 7.5"/></svg></button>
      </header>

      <div className="page-scroll" style={{ padding: '20px 16px 40px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {courseList.length === 0 && loadingCourses && (
            <div className="edu-cascade" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SkeletonCourseCard /><SkeletonCourseCard /><SkeletonCourseCard /><SkeletonCourseCard />
            </div>
          )}
          {courseList.length === 0 && !loadingCourses && !coursesError && (
            <EmptyState icon={<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.5}}><path d="M12 21V11"/><path d="M12 11C12 7 9 5 4 5c0 5 3 7 8 6z"/><path d="M12 13c0-4 3-6 8-6 0 5-3 7-8 6z"/></svg>} title="Курс скоро появится" subtitle="Темы для этого языка пока наполняются — загляни чуть позже." />
          )}
          {courseList.length === 0 && !loadingCourses && coursesError && (
            <ErrorRetry onRetry={() => { loadCourses(); loadProgress(); }} text="Не удалось загрузить курс" />
          )}

          {courseList.length > 0 && (
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск темы"
                style={{ width: '100%', padding: '11px 12px 11px 36px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 'var(--fs-label)', boxSizing: 'border-box' }} />
            </div>
          )}

          {searchActive ? (
            <div className="edu-cascade" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 'var(--fs-label)' }}>Ничего не найдено</div>
              ) : filtered.map(c => {
                const p = progress[c.id];
                return (
                  <CourseRow key={c.id} c={c} done={!!p?.completed} locked={false} accuracy={p?.best_accuracy}
                    masteryPct={mastery[c.id] && mastery[c.id].total ? Math.round(mastery[c.id].mastered / mastery[c.id].total * 100) : undefined}
                    onTap={() => nav(`/languages/${language}/learn/${c.id}`)} />
                );
              })}
            </div>
          ) : (
          <>
          <button onClick={() => { haptic.tap(); nav(`/languages/${language}/flashcards`); }} className="tap-effect edu-card" style={{ width: '100%', marginBottom: 14, padding: 14, borderRadius: 14, border: '1px solid rgba(124,58,237,0.3)', background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.06) 100%)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: '#7C3AED', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-title)', flexShrink: 0 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12" height="15" rx="2"/><path d="M8 6V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-1"/></svg></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Карточки</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Быстрое повторение: слово → перевод</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button onClick={() => { haptic.tap(); nav(`/languages/${language}/practice`); }} className="tap-effect edu-card" style={{ width: '100%', marginBottom: 14, padding: 14, borderRadius: 14, border: '1px solid rgba(245,158,11,0.3)', background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.06) 100%)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: '#F59E0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-title)', flexShrink: 0 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><rect x="2" y="6" width="20" height="12" rx="4"/></svg></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Тренировки</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Соедини пары · собери слово</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button onClick={() => { haptic.tap(); nav(`/languages/${language}/reading`); }} className="tap-effect edu-card" style={{ width: '100%', marginBottom: 14, padding: 14, borderRadius: 14, border: '1px solid rgba(59,130,246,0.3)', background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.10) 100%)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: '#3B82F6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-title)', flexShrink: 0 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Чтение с пониманием</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>Тексты + вопросы на понимание</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          {/* A1 секция */}
          {a1Courses.length > 0 && (
            <>
              <SectionLabel title="A1 · Базовый" hint="С чего начать" done={a1Courses.filter(c => progress[c.id]?.completed).length} total={a1Courses.length} />
              <div className="edu-cascade" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {a1Courses.map((c, idx) => {
                  const p = progress[c.id];
                  const done = p?.completed;
                  // Внутри A1: первая открыта, следующая после прохождения предыдущей
                  const prev = idx > 0 ? a1Courses[idx - 1] : null;
                  const locked = prev && !progress[prev.id]?.completed;
                  return (
                    <CourseRow key={c.id} c={c} done={!!done} locked={!!locked} accuracy={p?.best_accuracy}
                      onTap={() => nav(`/languages/${language}/learn/${c.id}`)} />
                  );
                })}
              </div>
            </>
          )}

          {/* A2 секция */}
          {a2Courses.length > 0 && (
            <>
              <SectionLabel
                title="A2 · Продолжающий"
                hint={a2Unlocked ? 'Открыто' : 'Пройди все темы A1 или сдай тест A1 (≥75%)'}
                dimmed={!a2Unlocked}
                done={a2Courses.filter(c => progress[c.id]?.completed).length}
                total={a2Courses.length}
              />
              <div className="edu-cascade" style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: a2Unlocked ? 1 : 0.5 }}>
                {a2Courses.map((c, idx) => {
                  const p = progress[c.id];
                  const done = p?.completed;
                  const prev = idx > 0 ? a2Courses[idx - 1] : null;
                  const lockedByPrev = prev && !progress[prev.id]?.completed;
                  const locked = !a2Unlocked || lockedByPrev;
                  return (
                    <CourseRow key={c.id} c={c} done={!!done} locked={!!locked} accuracy={p?.best_accuracy}
                      onTap={() => nav(`/languages/${language}/learn/${c.id}`)} />
                  );
                })}
              </div>
            </>
          )}

          {/* B1 секция */}
          {b1Courses.length > 0 && (
            <>
              <SectionLabel
                title="B1 · Средний"
                hint={b1Unlocked ? 'Открыто' : 'Пройди все темы A2 или сдай тест A2 (≥75%)'}
                dimmed={!b1Unlocked}
                done={b1Courses.filter(c => progress[c.id]?.completed).length}
                total={b1Courses.length}
              />
              <div className="edu-cascade" style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: b1Unlocked ? 1 : 0.5 }}>
                {b1Courses.map((c, idx) => {
                  const p = progress[c.id];
                  const done = p?.completed;
                  const prev = idx > 0 ? b1Courses[idx - 1] : null;
                  const lockedByPrev = prev && !progress[prev.id]?.completed;
                  const locked = !b1Unlocked || lockedByPrev;
                  return (
                    <CourseRow key={c.id} c={c} done={!!done} locked={!!locked} accuracy={p?.best_accuracy}
                      onTap={() => nav(`/languages/${language}/learn/${c.id}`)} />
                  );
                })}
              </div>
            </>
          )}

          {/* B2 секция */}
          {b2Courses.length > 0 && (
            <>
              <SectionLabel
                title="B2 · Выше среднего"
                hint={b2Unlocked ? 'Открыто' : 'Пройди все темы B1 или сдай тест B1 (≥75%)'}
                dimmed={!b2Unlocked}
                done={b2Courses.filter(c => progress[c.id]?.completed).length}
                total={b2Courses.length}
              />
              <div className="edu-cascade" style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: b2Unlocked ? 1 : 0.5 }}>
                {b2Courses.map((c, idx) => {
                  const p = progress[c.id];
                  const done = p?.completed;
                  const prev = idx > 0 ? b2Courses[idx - 1] : null;
                  const lockedByPrev = prev && !progress[prev.id]?.completed;
                  const locked = !b2Unlocked || lockedByPrev;
                  return (
                    <CourseRow key={c.id} c={c} done={!!done} locked={!!locked} accuracy={p?.best_accuracy}
                      onTap={() => nav(`/languages/${language}/learn/${c.id}`)} />
                  );
                })}
              </div>
            </>
          )}

          {/* Грамматика — отдельный тренажёр (спряжение + артикли). Пока для итальянского. */}
          {GRAMMAR_HINT[language] && (
            <>
              <SectionLabel title="Грамматика" hint="Спряжение глаголов и артикли" />
              <button
                onClick={() => { haptic.tap(); nav(`/languages/${language}/grammar`); }}
                className="tap-effect edu-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(139,92,246,0.10) 100%)',
                  border: '1px solid rgba(168,85,247,0.3)',
                  borderRadius: 14, padding: 14, width: '100%',
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 22, background: '#A855F7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>Тренажёр грамматики</div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>{GRAMMAR_HINT[language]}</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </>
          )}

          {/* Тесты уровня */}
          {(() => {
            const unlockedMap: Record<string, boolean> = { A1: true, A2: a2Unlocked, B1: b1Unlocked, B2: b2Unlocked };
            const levels = ['A1', 'A2', 'B1', 'B2'].filter(L => courseList.some(c => c.level === L) && unlockedMap[L]);
            if (levels.length === 0) return null;
            return (
              <>
                <SectionLabel title="Тесты уровня" hint="Проверь себя: слова + грамматика" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {levels.map(L => (
                    <button key={L} onClick={() => { haptic.tap(); nav(`/languages/${language}/test/${L}`); }} className="tap-effect edu-card" style={{
                      flex: '1 1 calc(50% - 4px)', minWidth: 120, padding: '12px 14px', borderRadius: 12,
                      border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text)',
                      fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.5 2 6 2s6-1 6-2v-5"/></svg>Тест {L}
                    </button>
                  ))}
                </div>
                <button onClick={() => { haptic.tap(); nav(`/languages/${language}/review`); }} className="tap-effect edu-card" style={{
                  marginTop: 8, width: '100%', padding: '12px 14px', borderRadius: 12,
                  border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'var(--text)',
                  fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6M21 12A9 9 0 0 0 6 5.3L3 8"/><path d="M21 22v-6h-6M3 12a9 9 0 0 0 15 6.7l3-2.7"/></svg>Повторить слабые слова
                </button>
              </>
            );
          })()}

          {/* Тест-подготовка (IELTS/CILS): открыта параллельно, не зависит от A1/A2 */}
          {testPrepCourses.length > 0 && (
            <>
              <SectionLabel
                title={`${testPrepLevel} · Подготовка к экзамену`}
                hint={language === 'en'
                  ? 'Академическая лексика для IELTS Academic'
                  : 'Формальная лексика для CILS B1/B2'}
              />
              <div className="edu-cascade" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {testPrepCourses.map((c, idx) => {
                  const p = progress[c.id];
                  const done = p?.completed;
                  // Внутри секции — прогрессивная разблокировка
                  const prev = idx > 0 ? testPrepCourses[idx - 1] : null;
                  const locked = prev && !progress[prev.id]?.completed;
                  return (
                    <CourseRow key={c.id} c={c} done={!!done} locked={!!locked} accuracy={p?.best_accuracy}
                      onTap={() => nav(`/languages/${language}/learn/${c.id}`)} />
                  );
                })}
              </div>
            </>
          )}
          </>
          )}
        </div>

        <p style={{
          textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-micro)',
          marginTop: 24, padding: '0 24px', lineHeight: 1.5,
        }}>
          Темы открываются последовательно. Чтобы пройти — набери ≥80% точности.<br/>
          Подготовка к экзамену — параллельный путь с продвинутой лексикой.
        </p>
      </div>
    </div>
  );
}
