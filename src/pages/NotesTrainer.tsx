import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MusicStaff from '@/components/MusicStaff';
import VirtualPiano from '@/components/VirtualPiano';
import CircleAnswerWheel from '@/components/CircleAnswerWheel';
import AnimatedNumber from '@/components/AnimatedNumber';
import { useNotesStore, type NotesLevel } from '@/stores/notesStore';
import { haptic } from '@/lib/haptics';
import { getStaffTheme } from '@/lib/eduPrefs';
import { triggerConfetti } from '@/lib/confetti';
import { GlyphIcon } from '@/components/icons/AppGlyph';
import { useAuthStore } from '@/stores/authStore';
import { hasFlag } from '@/lib/featureFlags';
import {
  pickRandomNote, NOTE_RU, playMusicNote, playCorrect, playWrong,
  noteCanonical, ACCIDENTAL_PAIRS,
  type MusicNote,
} from '@/lib/musicTheory';

const TOTAL_QUESTIONS = 10;

export default function NotesTrainer() {
  const { level } = useParams<{ level: NotesLevel }>();
  const nav = useNavigate();
  const { user } = useAuthStore();
  const canOpen = hasFlag(user, 'notes');
  const { finishSession, loadProgress } = useNotesStore();

  // Перегенерация сессии — счётчик
  const [sessionId, setSessionId] = useState(0);
  // Все 10 нот сессии — генерируем заранее
  const sessionNotes = useMemo<MusicNote[]>(() => {
    if (!level || !['treble', 'bass', 'both', 'advanced'].includes(level)) return [];
    return Array.from({ length: TOTAL_QUESTIONS }, () => pickRandomNote(level as NotesLevel));
  }, [level, sessionId]);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [feedbackArr, setFeedbackArr] = useState<Array<'correct' | 'wrong' | null>>(
    () => Array(TOTAL_QUESTIONS).fill(null)
  );
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  // Мгновенный режим: без кулдауна и подсветки выбранного — фидбек остаётся на стане (feedbackArr)
  const feedback = null as 'correct' | 'wrong' | null;
  const selectedAnswer = null as string | null;
  const [finished, setFinished] = useState(false);
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const [showPiano, setShowPiano] = useState(false);
  const [notation, setNotation] = useState<'ru' | 'en' | 'both'>(() => {
    return (localStorage.getItem('notes_notation') as 'ru' | 'en' | 'both') || 'ru';
  });
  const [newBest, setNewBest] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const inProgressRef = useRef(false);

  useEffect(() => {
    if (!canOpen) {
      nav('/languages');
      return;
    }
    if (!level || !['treble', 'bass', 'both', 'advanced'].includes(level)) {
      nav('/notes');
      return;
    }
    startTimeRef.current = Date.now();
  }, [canOpen, level, nav, sessionId]);

  const currentNote = sessionNotes[questionIndex] || null;
  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);
  const isAdvanced = level === 'advanced';

  const handleAnswer = (answerCanonical: string) => {
    if (!currentNote || finished) return;

    const correctCanonical = noteCanonical(currentNote);
    const isCorrect = answerCanonical === correctCanonical;

    setFeedbackArr(prev => {
      const next = [...prev];
      next[questionIndex] = isCorrect ? 'correct' : 'wrong';
      return next;
    });

    if (isCorrect) haptic.success(); else haptic.error();
    setFlash(isCorrect ? 'correct' : 'wrong');
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 320);

    if (isCorrect) {
      playCorrect();
      setStreak(s => {
        const ns = s + 1;
        if (ns >= 3 && ns % 3 === 0 && 'vibrate' in navigator) { try { navigator.vibrate([10, 30, 10]); } catch {} }
        return ns;
      });
    } else {
      playWrong();
      setStreak(0);
    }

    const newCorrect = correctCount + (isCorrect ? 1 : 0);
    if (isCorrect) setCorrectCount(newCorrect);

    // Мгновенный переход — без кулдауна
    const nextIndex = questionIndex + 1;
    if (nextIndex >= TOTAL_QUESTIONS) finishGame(newCorrect);
    else setQuestionIndex(nextIndex);
  };

  // Ввод с клавиатуры: 1–7 (До–Си) и буквы C D E F G A B
  useEffect(() => {
    if (finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const digitMap = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      let canonical: string | null = null;
      if (k >= '1' && k <= '7') canonical = digitMap[parseInt(k, 10) - 1];
      else if ('cdefgab'.includes(k) && k.length === 1) canonical = k.toUpperCase();
      if (canonical) { e.preventDefault(); handleAnswer(canonical); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, questionIndex, currentNote, correctCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishGame = async (finalCorrect: number) => {
    if (inProgressRef.current) return;
    inProgressRef.current = true;
    setFinished(true);

    // Уровень-ап: идеальный результат — конфетти + haptic
    if (finalCorrect === TOTAL_QUESTIONS) {
      setTimeout(() => {
        triggerConfetti({
          count: 130,
          colors: ['#FBBF24', '#F59E0B', '#FCD34D', '#FFFFFF', '#FDE047'],
          power: 13,
          duration: 2800,
          spread: Math.PI * 1.1,
        });
        if ('vibrate' in navigator) {
          try { navigator.vibrate([25, 50, 25, 50, 25, 50, 80]); } catch {}
        }
      }, 400);
      // Второй залп через 800мс
      setTimeout(() => {
        triggerConfetti({
          count: 80,
          colors: ['#FBBF24', '#F59E0B', '#FCD34D', '#FFFFFF'],
          power: 11,
          duration: 2200,
        });
      }, 1200);
    }

    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    const result = await finishSession(level as NotesLevel, TOTAL_QUESTIONS, finalCorrect, duration);
    if (result.error) {
      console.error('finishSession', result.error);
    } else {
      setNewBest(result.newBest);
      loadProgress();
    }
  };

  const playCurrentNote = () => {
    if (currentNote) playMusicNote(currentNote, 0.8);
  };

  if (!currentNote) return null;

  if (finished) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div className={correctCount === TOTAL_QUESTIONS ? 'anim-bounce-in notes-perfect-glow' : 'anim-bounce-in'} style={{ marginBottom: 8, color: 'var(--accent)' }}>
            <GlyphIcon name={correctCount === TOTAL_QUESTIONS ? 'confetti' : correctCount >= 8 ? 'trophy' : correctCount >= 6 ? 'smile' : 'workout'} size={56} strokeWidth={1.5} />
          </div>
          <h2 style={{ margin: 0, fontSize: 'var(--fs-title)', color: 'var(--text)' }}>
            {correctCount === TOTAL_QUESTIONS ? 'Идеально!' :
             correctCount >= 8 ? 'Отлично!' :
             correctCount >= 6 ? 'Хорошо' : 'Тренируйся!'}
          </h2>
          <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent)', marginTop: 16, fontVariantNumeric: 'tabular-nums' }}>
            <NotesResultCount target={correctCount} />/{TOTAL_QUESTIONS}
          </div>
          {newBest && (
            <div style={{ marginTop: 8, padding: '4px 12px', background: 'rgba(80,200,120,0.2)', color: '#50c878', borderRadius: 20, fontSize: 'var(--fs-label)', fontWeight: 600 }}>
              Новый рекорд!
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => nav('/notes')} style={{
            flex: 1, padding: 14, background: 'var(--surface-light)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer',
          }}>В меню</button>
          <button onClick={() => {
            setQuestionIndex(0); setCorrectCount(0);
            setFinished(false); setNewBest(false);
            setFeedbackArr(Array(TOTAL_QUESTIONS).fill(null));
            setStreak(0);
            startTimeRef.current = Date.now();
            inProgressRef.current = false;
            setSessionId(s => s + 1); // регенерирует sessionNotes
          }} style={{
            flex: 1, padding: 14, background: 'var(--accent)', color: 'var(--bg)',
            border: 'none', borderRadius: 10, fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer',
          }}>Ещё раз</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {flash && <div className={`notes-flash notes-flash-${flash}`} />}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={() => nav('/notes')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--fs-title)', padding: 0 }}>‹</button>
        <div style={{ fontSize: 'var(--fs-snap14)', fontWeight: 600, color: 'var(--text)' }}>
          {questionIndex + 1} / {TOTAL_QUESTIONS}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => {
            const next = notation === 'ru' ? 'en' : notation === 'en' ? 'both' : 'ru';
            setNotation(next);
            localStorage.setItem('notes_notation', next);
          }} style={{
            padding: '4px 10px', background: 'var(--surface-light)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 8, fontSize: 'var(--fs-micro)', fontWeight: 600, cursor: 'pointer',
          }}>
            {notation === 'ru' ? 'До' : notation === 'en' ? 'C' : 'До·C'}
          </button>
          <button onClick={() => setShowPiano(p => !p)} style={{
            padding: '4px 10px', background: showPiano ? 'var(--accent)' : 'var(--surface-light)',
            color: showPiano ? 'var(--bg)' : 'var(--text)', border: '1px solid var(--border)',
            borderRadius: 8, fontSize: 'var(--fs-micro)', fontWeight: 600, cursor: 'pointer',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v9M12 4v9M16 4v9M3 13h18"/></svg>{showPiano ? 'Скрыть' : 'Пианино'}</span>
          </button>
        </div>
      </div>

      {/* Прогресс-бар */}
      <div style={{ height: 4, background: 'var(--surface-light)', position: 'relative' }}>
        <div style={{
          height: '100%',
          width: `${((questionIndex + (feedback ? 1 : 0)) / TOTAL_QUESTIONS) * 100}%`,
          background: 'var(--accent)',
          transition: 'width 0.3s',
        }} />
      </div>

      <div className="page-scroll" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16, minHeight: 22 }}>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)' }}>Какая это нота?</div>
          {streak >= 3 && (
            <div
              key={`streak-${streak}`}
              className="streak-appear streak-pulse"
              style={{
                fontSize: 'var(--fs-snap14)', fontWeight: 700, color: '#F59E0B',
                background: 'rgba(245, 158, 11, 0.15)',
                padding: '2px 10px', borderRadius: 12,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              🔥 {streak}
            </div>
          )}
        </div>

        {/* Нотный стан — все 10 нот сессии, текущая подсвечена */}
        <div
          key={`session-${sessionId}-${questionIndex}`}
          className={`anim-pop-in ${feedback === 'correct' ? 'notes-correct-flash' : feedback === 'wrong' ? 'notes-wrong-flash' : ''}`}
          style={{
            background: getStaffTheme() === 'white' ? '#ffffff' : '#f8f7f2', padding: '16px 8px', borderRadius: 14, marginBottom: 16,
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-1)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
          }}
        >
          <MusicStaff
            notes={sessionNotes}
            currentIndex={questionIndex}
            feedback={feedbackArr}
            size="medium"
            showAnswer={feedback === 'wrong'}
          />
        </div>

        {/* Кнопка "Сыграть" */}
        <button onClick={playCurrentNote} className="tap-effect" style={{
          padding: 10, background: 'var(--surface-light)', color: 'var(--text)',
          border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-label)', fontWeight: 600,
          cursor: 'pointer', marginBottom: 16,
        }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>Послушать ноту</span></button>
        <div style={{ fontSize: 'var(--fs-snap10)', color: 'var(--muted)', textAlign: 'center', marginTop: -8, marginBottom: 16 }}>
          С клавиатуры: <strong>1–7</strong> или <strong>C D E F G A B</strong>
        </div>

        {/* Круглая шайба ответа — 7 базовых нот по кругу */}
        <CircleAnswerWheel
          notation={notation}
          selectedAnswer={selectedAnswer}
          correctAnswer={currentNote ? noteCanonical(currentNote) : null}
          feedback={feedback}
          onAnswer={handleAnswer}
          disabled={false}
          compact={showPiano}
        />

        {/* Альтерации (только в advanced) — ряд кнопок под шайбой */}
        {isAdvanced && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginTop: 20 }}>
            {ACCIDENTAL_PAIRS.map(pair => {
              const isSelected = selectedAnswer === pair.canonical;
              const correctCanonical = currentNote ? noteCanonical(currentNote) : '';
              const isCorrectAnswer = correctCanonical === pair.canonical;
              let bg = 'var(--surface-light)';
              let color = 'var(--text)';
              let border = '1px solid var(--border)';
              if (feedback) {
                if (isCorrectAnswer) { bg = '#50c878'; color = '#fff'; border = '1px solid #50c878'; }
                else if (isSelected) { bg = '#dc2626'; color = '#fff'; border = '1px solid #dc2626'; }
              }
              return (
                <button
                  key={pair.canonical}
                  onClick={() => handleAnswer(pair.canonical)}
                  className={`tap-effect ${feedback === 'wrong' && isSelected ? 'anim-shake' : ''}`}
                  style={{
                    padding: '10px 2px', background: bg, color, border, borderRadius: 8,
                    fontSize: 'var(--fs-snap10)', fontWeight: 700, cursor: feedback ? 'default' : 'pointer',
                    transition: 'all 0.15s', lineHeight: 1.15,
                  }}
                >
                  {notation === 'ru' ? pair.labelRu :
                   notation === 'en' ? pair.labelEn :
                   <span style={{ display: 'flex', flexDirection: 'column' }}>
                     <span>{pair.labelRu}</span>
                     <span style={{ fontSize: 8, opacity: 0.7 }}>{pair.labelEn}</span>
                   </span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Виртуальное пианино */}
        {showPiano && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginBottom: 6, textAlign: 'center' }}>
              Нажми клавишу чтобы услышать ноту
            </div>
            <VirtualPiano octave={currentNote.clef === 'bass' ? 3 : 4} showLabels={true} notation={notation} />
          </div>
        )}
      </div>

      {/* Счёт */}
      <div style={{
        padding: '8px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-around', fontSize: 'var(--fs-label)', color: 'var(--muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#50c878" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Верно: <strong style={{ color: '#50c878' }}>{correctCount}</strong></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Ошибок: <strong style={{ color: '#dc2626' }}>{questionIndex + (feedback ? 1 : 0) - correctCount}</strong></div>
      </div>
    </div>
  );
}

// Crawl-счётчик правильных ответов в результатах: 0 → target за 900мс
function NotesResultCount({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    // Стартуем с 0 → переключаем на target в следующий тик
    const t = setTimeout(() => setVal(target), 150);
    return () => clearTimeout(t);
  }, [target]);
  return <AnimatedNumber value={val} duration={900} />;
}
