import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguagesStore, type Language, type LanguagePassage } from '@/stores/languagesStore';
import { triggerConfetti } from '@/lib/confetti';
import { speak, speechSupported, hasVoiceFor } from '@/lib/speech';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { Skeleton } from '@/components/Skeleton';

const LANG_TITLE: Record<Language, { name: string; flag: string }> = {
  en: { name: 'IELTS Reading',  flag: '🇬🇧' },
  it: { name: 'CILS Comprensione', flag: '🇮🇹' },
  es: { name: 'DELE Lectura',   flag: '🇪🇸' },
  de: { name: 'Goethe Lesen',   flag: '🇩🇪' },
  fr: { name: 'DELF Compréhension', flag: '🇫🇷' },
};

export default function LanguageReadings() {
  const nav = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const language = (lang as Language) || 'en';
  const { passages, passageBestAccuracy, loadPassages } = useLanguagesStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { loadPassages(language); /* eslint-disable-next-line */ }, [language]);

  const selectedPassage = passages.find(p => p.id === selectedId);
  const info = LANG_TITLE[language];

  // Если выбран — показываем тренажёр; иначе — список
  if (selectedPassage) {
    return <ReadingTrainer passage={selectedPassage} language={language} onBack={() => setSelectedId(null)} />;
  }

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
        <div style={{ fontSize: 'var(--fs-title)', lineHeight: 1 }}>{info?.flag}</div>
        <div>
          <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>{info?.name}</div>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>Чтение с пониманием</div>
        </div>
      </header>

      <div className="page-scroll" style={{ padding: '20px 16px 40px' }}>
        <p style={{
          textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-caption)',
          margin: '0 0 16px', lineHeight: 1.5, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto',
        }}>
          Прочитай текст, ответь на 3 вопроса.<br/>Для прохождения нужно 2 из 3 правильно.
        </p>

        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {passages.length === 0 && (
            <>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ background: 'var(--surface-2)', boxShadow: 'var(--shadow-1)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <Skeleton width="45%" height={14} />
                  <Skeleton width="100%" height={10} />
                  <Skeleton width="92%" height={10} />
                  <Skeleton width="68%" height={10} />
                </div>
              ))}
            </>
          )}
          {passages.map(p => {
            const acc = passageBestAccuracy[p.id] || 0;
            const done = acc >= 67;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className="tap-effect"
                style={{
                  background: done ? 'rgba(16,185,129,0.12)' : 'var(--surface-light)',
                  border: done ? '1px solid rgba(16,185,129,0.3)' : 'none',
                  borderRadius: 14, padding: 14,
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 22,
                  background: done ? '#10B981' : 'var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--fs-title)', flexShrink: 0,
                }}>{p.topic_emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text)' }}>{p.title_ru}</div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginTop: 2 }}>
                    {p.questions.length} {p.questions.length === 1 ? 'вопрос' : 'вопроса'}
                    {acc > 0 && <span style={{ marginLeft: 6 }}> · лучший результат {acc}%</span>}
                  </div>
                </div>
                {done
                  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                }
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ Тренажёр для одного текста ============

function ReadingTrainer({ passage, language, onBack }: { passage: LanguagePassage; language: Language; onBack: () => void }) {
  const { finishReadingSession, courses, loadCourses } = useLanguagesStore();
  const [phase, setPhase] = useState<'reading' | 'questions' | 'finished'>('reading');
  const [qIdx, setQIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [result, setResult] = useState<any>(null);
  const startedAtRef = useRef<number>(Date.now());
  const [wordMap, setWordMap] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<{ idx: number; w: string; tr: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadCourses();
      const ids = useLanguagesStore.getState().courses.filter(c => c.language === language).map(c => c.id);
      if (!ids.length) return;
      const { data } = await supabase.from('language_words').select('word, translation_ru').in('course_id', ids);
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const w of ((data || []) as any[])) { const k = String(w.word || '').toLowerCase().trim(); if (k && !map[k]) map[k] = w.translation_ru; }
      setWordMap(map);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const onWordTap = (tok: string, idx: number) => {
    const clean = tok.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    const key = clean.toLowerCase();
    if (!key) return;
    haptic.tap();
    setPicked({ idx, w: clean, tr: wordMap[key] || null });
  };

  const current = passage.questions[qIdx];
  const showFeedback = chosen !== null;

  const handlePick = (idx: number) => {
    if (showFeedback) return;
    setChosen(idx);
    if (idx === current.correct) {
      setCorrectCount(c => c + 1);
      try { navigator.vibrate?.(30); } catch {}
    } else {
      try { navigator.vibrate?.([30, 80, 30]); } catch {}
    }
  };

  const handleNext = async () => {
    if (qIdx + 1 < passage.questions.length) {
      setQIdx(i => i + 1);
      setChosen(null);
    } else {
      // Финиш
      const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
      const r = await finishReadingSession(passage.id, passage.questions.length, correctCount, duration);
      if (r) {
        setResult(r);
        setPhase('finished');
        if (r.completed) {
          setTimeout(() => triggerConfetti({
            count: 100,
            colors: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899'],
            duration: 2500,
          }), 200);
        }
      } else {
        onBack();
      }
    }
  };

  // ============ ФАЗА: ЧТЕНИЕ ============
  if (phase === 'reading') {
    return (
      <div className="safe-top" style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        <header style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style={{ fontSize: 'var(--fs-title)' }}>{passage.topic_emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600 }}>{passage.title_ru}</div>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>Прочитай и нажми «Дальше»</div>
          </div>
          {speechSupported() && (
            <button
              onClick={() => speak(passage.passage, language, 'reading')}
              style={{ background: 'var(--surface-light)', border: 'none', width: 36, height: 36, borderRadius: 18, cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Озвучить"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            </button>
          )}
        </header>

        <div className="page-scroll" style={{ padding: 20, flex: 1, paddingBottom: picked ? 96 : 20 }}>
          <div style={{ maxWidth: 580, margin: '0 auto 12px', fontSize: 'var(--fs-micro)', color: 'var(--muted)', textAlign: 'center' }}>
            Нажми на слово, чтобы увидеть перевод
          </div>
          <div style={{ maxWidth: 580, margin: '0 auto', fontSize: 'var(--fs-heading)', lineHeight: 1.7, color: 'var(--text)' }}>
            {passage.passage.split(/(\s+)/).map((tok, i) => (
              /^\s+$/.test(tok) || tok === ''
                ? tok
                : <span key={i} className="rd-word" onClick={() => onWordTap(tok, i)} style={{ cursor: 'pointer', background: picked && picked.idx === i ? 'rgba(59,130,246,0.18)' : 'transparent' }}>{tok}</span>
            ))}
          </div>
        </div>

        {picked && (
          <div className="rd-pop" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, padding: '14px 16px', paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))', background: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -4px 20px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 580, margin: '0 auto' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, color: 'var(--text)' }}>{picked.w}</div>
                <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 2 }}>{picked.tr || 'Нет перевода в словаре'}</div>
              </div>
              {hasVoiceFor(language) && (
                <button onClick={() => speak(picked.w, language)} aria-label="Произнести" className="alias-btn-press" style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: 'var(--surface-light)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
              )}
              <button onClick={() => setPicked(null)} aria-label="Закрыть" style={{ width: 40, height: 40, borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text)', cursor: 'pointer', flexShrink: 0 }}>✕</button>
            </div>
          </div>
        )}

        <div style={{ padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
          <button
            onClick={() => { setPhase('questions'); startedAtRef.current = Date.now(); }}
            style={{
              width: '100%', padding: '14px 0',
              background: 'var(--text)', color: 'var(--bg)',
              border: 'none', borderRadius: 14, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer',
            }}
          >
            К вопросам ({passage.questions.length})
          </button>
        </div>
      </div>
    );
  }

  // ============ ФАЗА: ФИНИШ ============
  if (phase === 'finished' && result) {
    const passed = result.completed;
    return (
      <div className="safe-top" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 72, lineHeight: 1 }}>{passed ? '🎉' : '📚'}</div>
        <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700 }}>{passed ? 'Текст пройден!' : 'Ещё разок'}</div>
        <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', lineHeight: 1.5, maxWidth: 320 }}>
          Точность {result.accuracy}%. {passed ? 'Хорошо понял!' : 'Перечитай и попробуй снова.'}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {result.streak > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: result.streak_increased ? 'rgba(239, 68, 68, 0.15)' : 'var(--surface-light)',
              padding: '8px 16px', borderRadius: 20,
              fontSize: 'var(--fs-body)', fontWeight: 600,
              color: result.streak_increased ? '#EF4444' : 'var(--text)',
            }}>
              🔥 {result.streak} {result.streak === 1 ? 'день' : result.streak < 5 ? 'дня' : 'дней'}
              {result.streak_increased && <span style={{ fontSize: 'var(--fs-micro)', marginLeft: 4 }}>+1</span>}
            </div>
          )}
        </div>

        {/* Перевод текста на финише — для разбора */}
        {passage.passage_ru && (
          <details style={{ marginTop: 14, maxWidth: 580, width: '100%' }}>
            <summary style={{ fontSize: 'var(--fs-label)', color: '#3B82F6', cursor: 'pointer', fontWeight: 600 }}>
              Показать перевод текста
            </summary>
            <div style={{ marginTop: 10, fontSize: 'var(--fs-snap14)', color: 'var(--muted)', textAlign: 'left', lineHeight: 1.6 }}>
              {passage.passage_ru}
            </div>
          </details>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={onBack} style={{ background: 'var(--surface-light)', color: 'var(--text)', border: 'none', padding: '12px 22px', borderRadius: 22, fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer' }}>К списку</button>
          <button onClick={() => { setPhase('reading'); setQIdx(0); setChosen(null); setCorrectCount(0); setResult(null); }} style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', padding: '12px 22px', borderRadius: 22, fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer' }}>
            Ещё раз
          </button>
        </div>
      </div>
    );
  }

  // ============ ФАЗА: ВОПРОСЫ ============
  return (
    <div className="safe-top" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      <div style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { if (confirm('Прервать? Прогресс не сохранится.')) onBack(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style={{ flex: 1, height: 8, background: 'var(--surface-light)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${((qIdx + 1) / passage.questions.length) * 100}%`, height: '100%', background: '#10B981', transition: 'width 300ms' }} />
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>
            {qIdx + 1} / {passage.questions.length}
          </div>
        </div>
      </div>

      {/* Краткое напоминание текста — скрытое, разворачивается по тапу */}
      <details style={{ padding: '0 16px', marginBottom: 8 }}>
        <summary style={{ fontSize: 'var(--fs-caption)', color: '#3B82F6', cursor: 'pointer', userSelect: 'none' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, verticalAlign: 'middle' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Перечитать текст</span></summary>
        <div style={{ marginTop: 8, padding: 12, background: 'var(--surface-light)', borderRadius: 12, fontSize: 'var(--fs-label)', color: 'var(--text)', lineHeight: 1.6, maxHeight: 200, overflowY: 'auto' }}>
          {passage.passage}
        </div>
      </details>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '12px 16px', overflowY: 'auto' }}>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, textAlign: 'center' }}>Вопрос</div>
        <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 600, color: 'var(--text)', marginBottom: 20, lineHeight: 1.4, textAlign: 'center', maxWidth: 580, margin: '0 auto 20px' }}>
          {current.q_ru}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480, width: '100%', margin: '0 auto' }}>
          {current.options.map((opt, i) => {
            const isThisCorrect = i === current.correct;
            const isChosen = i === chosen;
            let bg = 'var(--surface-light)', border = '1px solid transparent', color = 'var(--text)';
            if (showFeedback) {
              if (isThisCorrect)      { bg = 'rgba(16,185,129,0.18)'; border = '1px solid #10B981'; color = '#10B981'; }
              else if (isChosen)      { bg = 'rgba(239,68,68,0.15)';  border = '1px solid #EF4444'; color = '#EF4444'; }
              else                    { color = 'var(--muted)'; }
            }
            return (
              <button
                key={i}
                onClick={() => handlePick(i)}
                disabled={showFeedback}
                className="tap-effect"
                style={{
                  background: bg, border, color,
                  borderRadius: 12, padding: '12px 14px',
                  fontSize: 'var(--fs-body)', fontWeight: 500, cursor: showFeedback ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'background 200ms, border-color 200ms, color 200ms',
                }}
              >{opt}</button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
        {showFeedback && (
          <div style={{
            background: chosen === current.correct ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
            padding: '10px 14px', borderRadius: 12,
            marginBottom: 10, fontSize: 'var(--fs-label)',
            color: chosen === current.correct ? '#10B981' : '#EF4444',
            fontWeight: 600, textAlign: 'center',
          }}>
            {chosen === current.correct ? '✓ Верно' : `✗ Правильный ответ: ${current.options[current.correct]}`}
          </div>
        )}
        <button
          onClick={handleNext}
          disabled={!showFeedback}
          style={{
            width: '100%', padding: '14px 0',
            background: showFeedback ? 'var(--text)' : 'var(--surface-light)',
            color: showFeedback ? 'var(--bg)' : 'var(--muted)',
            border: 'none', borderRadius: 14,
            fontSize: 'var(--fs-body)', fontWeight: 600,
            cursor: showFeedback ? 'pointer' : 'default',
            transition: 'background 200ms',
          }}
        >
          {qIdx + 1 < passage.questions.length
            ? (showFeedback ? 'Дальше' : 'Выбери ответ')
            : (showFeedback ? 'Завершить' : 'Выбери ответ')}
        </button>
      </div>
    </div>
  );
}
