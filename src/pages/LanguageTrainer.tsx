import { useEffect, useRef, useState } from 'react';
import { goBack } from '@/lib/nav';
import { haptic } from '@/lib/haptics';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguagesStore, type LanguageWord, type FinishResult, type Language } from '@/stores/languagesStore';
import { triggerConfetti } from '@/lib/confetti';
import { speak, speechSupported } from '@/lib/speech';
import StreakCelebration from '@/components/StreakCelebration';

type ExerciseType = 'choice' | 'input' | 'listen' | 'completion' | 'word_order';
type Direction   = 'foreign-to-ru' | 'ru-to-foreign';

interface Question {
  word: LanguageWord;
  type: ExerciseType;
  direction: Direction;
  options: string[];
  correctIndex: number;
  correctAnswer: string;
  blankSentence?: string;       // для completion: предложение с ___
  blankTranslation?: string;    // для completion: его перевод (контекст)
  // word_order: слова для сборки + правильный порядок
  wordTokens?: string[];        // токены в банке (перемешанные, могут включать distractor)
  correctOrder?: string[];      // правильная последовательность
  prompt?: string;              // что переводим (русский вариант)
  optionLimit: number;          // первые подходы проще, дальше вариантов становится больше
  exposure: number;             // номер упражнения по этому слову в текущей сессии
}

type LessonPhase = 'learn' | 'practice';

const HEARTS_TOTAL = 5;

const MAX_LEARN_WORDS = 12;

const IconBook = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M8 6h8" />
    <path d="M8 10h6" />
  </svg>
);

const IconSpark = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l1.7 5.2L19 9l-5.3 1.8L12 16l-1.7-5.2L5 9l5.3-1.8L12 2z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
  </svg>
);

const IconHeartBreak = ({ size = 72 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <path d="M40 68s-24-15.2-31.5-29C3.2 29.3 8.8 17 21.2 17c7 0 12 4 15 9.3L40 33l3.8-6.7C46.8 21 51.8 17 58.8 17 71.2 17 76.8 29.3 71.5 39 64 52.8 40 68 40 68z" fill="rgba(239,68,68,.14)" stroke="#EF4444" strokeWidth="3" strokeLinejoin="round" />
    <path d="M43 27l-7 11 9 4-8 12" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconTrophy = ({ size = 72 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <rect x="14" y="12" width="52" height="52" rx="26" fill="rgba(16,185,129,.14)" />
    <path d="M29 21h22v10c0 9-5 15-11 15S29 40 29 31V21z" fill="rgba(16,185,129,.28)" stroke="#10B981" strokeWidth="3" />
    <path d="M29 26h-7c0 8 4 13 10 13M51 26h7c0 8-4 13-10 13" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
    <path d="M40 46v8M31 58h18" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const IconStrong = ({ size = 72 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <rect x="14" y="12" width="52" height="52" rx="26" fill="rgba(59,130,246,.13)" />
    <path d="M25 45c6-1 9-5 11-13l2-8c.6-2.5 4.2-2.4 4.7.1l.8 4.2h7.2c4.2 0 6.8 4.7 4.5 8.2l-5.1 7.9A10 10 0 0 1 41.7 49H31c-3.3 0-6-2.7-6-4z" fill="rgba(59,130,246,.2)" stroke="#3B82F6" strokeWidth="3" strokeLinejoin="round" />
    <path d="M25 45v10h11" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const IconFlame = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22c4 0 7-2.7 7-6.7 0-2.6-1.3-4.8-3.4-6.5.1 2.2-.8 3.8-2.4 4.7.2-3.2-1.3-6.4-4.4-8.5.4 3.6-3.8 6-3.8 10.3C5 19.3 8 22 12 22z" />
  </svg>
);

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Нормализация для проверки ввода: lowercase, trim, без диакритики, без пунктуации.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Левенштейн — для прощения опечаток.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

// Сколько опечаток прощаем
function acceptableTypos(answer: string): number {
  const len = answer.length;
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  return 2;
}

function checkInput(userAnswer: string, expected: string): boolean {
  const a = normalize(userAnswer);
  const b = normalize(expected);
  if (a === b) return true;
  return levenshtein(a, b) <= acceptableTypos(b);
}

// Пытается превратить пример в предложение с пропуском. Если слово найдено
// в example как отдельное слово (с границами) — заменяет на ___. Иначе null.
//   word="hello", example="Hello, how are you?" → "___, how are you?"
//   word="to want", example="I want water." → "I ___ water."  (срезаем "to ")
//   word="volere", example="Voglio dell'acqua." → null  (форма не совпадает)
function makeBlank(word: string, example: string): string | null {
  if (!example) return null;
  // Срезаем "to " у английских глаголов (хранятся как "to want")
  const search = word.replace(/^to\s+/i, '').trim();
  if (!search || search.length < 2) return null;
  // Экранируем спецсимволы regex
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // \b может плохо работать с апострофами/диакритикой, поэтому делаем мягче:
  // ищем как подстроку с не-буквой по краям (или начало/конец строки)
  const re = new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, 'iu');
  if (!re.test(example)) return null;
  return example.replace(re, (_, pre, post) => `${pre}___${post}`);
}

function getUsageHint(word: LanguageWord, courseTitle?: string | null): string {
  const w = word.word.trim();
  const example = word.example || '';
  if (/^(to\s+)/i.test(w)) return 'Используется как действие: в просьбах, планах и коротких бытовых фразах.';
  if (/\?$/.test(example)) return 'Часто встречается в вопросах — обращай внимание на порядок слов и интонацию.';
  if (example.split(/\s+/).length >= 5) return 'Лучше запоминать через целую фразу: так понятнее контекст и место слова в предложении.';
  if (courseTitle) return `Подходит для темы «${courseTitle}»: сначала узнай перевод, потом закрепи в примере.`;
  return 'Сначала запомни смысл и пример, затем потренируй узнавание и самостоятельный ответ.';
}



function optionLimitFor(exposure: number, globalIndex: number): number {
  // Первые подходы к слову не перегружают: 4 варианта, затем 5–6.
  if (exposure <= 1) return 4;
  if (globalIndex < 10) return 5;
  return 6;
}

function createQuestion(words: LanguageWord[], w: LanguageWord, exposure: number, globalIndex: number): Question {
  const audioOk = speechSupported();
  const optionLimit = optionLimitFor(exposure, globalIndex);
  const r = Math.random();
  let type: ExerciseType;

  // Первый вопрос по слову всегда лёгкий: 4 варианта и перевод.
  if (exposure === 1) {
    type = 'choice';
  } else {
    const hasExample = !!w.example && !!w.example_ru && w.example.split(/\s+/).length >= 2 && w.example.split(/\s+/).length <= 14;
    if (hasExample && r < 0.30)          type = 'word_order';
    else if (audioOk && r < 0.38)        type = 'listen';
    else if (r < 0.58)                   type = 'input';
    else if (r < 0.80)                   type = 'completion';
    else                                 type = 'choice';
  }

  // Для completion готовим бланк. Если не получилось — откатываемся на choice.
  let blankSentence: string | undefined;
  let blankTranslation: string | undefined;
  if (type === 'completion') {
    const blank = w.example ? makeBlank(w.word, w.example) : null;
    if (blank) {
      blankSentence = blank;
      blankTranslation = w.example_ru || undefined;
    } else {
      type = 'choice';
    }
  }

  // word_order: разбиваем example на слова, формируем bank с distractor-словами
  let wordTokens: string[] | undefined;
  let correctOrder: string[] | undefined;
  let prompt: string | undefined;
  if (type === 'word_order') {
    const tokens = (w.example || '').split(/\s+/).filter(Boolean);
    if (tokens.length >= 2 && tokens.length <= 14) {
      correctOrder = tokens;
      const distractorPool: string[] = [];
      for (const other of words) {
        if (other.id === w.id) continue;
        const ot = (other.example || '').split(/\s+/).filter(Boolean);
        for (const t of ot) {
          if (!tokens.includes(t) && !distractorPool.includes(t)) distractorPool.push(t);
        }
      }
      const distractorCount = Math.min(5, Math.max(2, Math.round(tokens.length / 3)));
      const distractors = shuffle(distractorPool).slice(0, distractorCount);
      wordTokens = shuffle([...tokens, ...distractors]);
      prompt = w.example_ru || w.translation_ru;
    } else {
      type = 'choice';
    }
  }

  // listen и completion всегда foreign→ru (нужен иностранный текст в задании)
  const direction: Direction = (type === 'listen' || type === 'completion' || exposure === 1)
    ? 'foreign-to-ru'
    : (Math.random() < 0.5 ? 'foreign-to-ru' : 'ru-to-foreign');

  const correctAnswer = type === 'completion'
    ? w.word
    : (direction === 'foreign-to-ru' ? w.translation_ru : w.word);

  const distractors = shuffle(
    words.filter(o => o.id !== w.id)
      .map(o => type === 'completion'
        ? o.word
        : (direction === 'foreign-to-ru' ? o.translation_ru : o.word))
      .filter(Boolean)
  ).slice(0, Math.max(optionLimit + 2, 9));

  const uniqueDistractors = Array.from(new Set(distractors)).filter(d => d !== correctAnswer).slice(0, optionLimit - 1);
  const options = shuffle([correctAnswer, ...uniqueDistractors]);

  return {
    word: w,
    type,
    direction,
    options,
    correctIndex: options.indexOf(correctAnswer),
    correctAnswer,
    blankSentence,
    blankTranslation,
    wordTokens,
    correctOrder,
    prompt,
    optionLimit,
    exposure,
  };
}

// Строим вопросы. Порядок слов уже задан SR-логикой в loadWords (новые → срочные → освоенные).
// Здесь только распределяем тип упражнения и собираем варианты.
function buildQuestions(words: LanguageWord[]): Question[] {
  const learningWords = words.slice(0, MAX_LEARN_WORDS);
  const firstPass = learningWords.map((w, index) => createQuestion(learningWords, w, 1, index));
  const secondPass = learningWords.map((w, index) => createQuestion(learningWords, w, 2, firstPass.length + index));
  return shuffle(firstPass).concat(shuffle(secondPass));
}

export default function LanguageTrainer() {
  const nav = useNavigate();
  const { lang, courseId } = useParams<{ lang: string; courseId: string }>();
  const language = (lang as Language) || 'en';
  const { courses, loadCourses, loadWords, finishSession, recordWordAnswer, streakLastDay } = useLanguagesStore();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [lessonWords, setLessonWords] = useState<LanguageWord[]>([]);
  const [phase, setPhase] = useState<LessonPhase>('learn');
  const [lessonIdx, setLessonIdx] = useState(0);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  // word_order: какие токены юзер уже выбрал (в порядке кликов)
  const [orderTokens, setOrderTokens] = useState<string[]>([]);
  const [inputSubmitted, setInputSubmitted] = useState<{ correct: boolean } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [hearts, setHearts] = useState(HEARTS_TOTAL);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState<FinishResult | null>(null);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [outOfHearts, setOutOfHearts] = useState(false);
  const startedAtRef = useRef<number>(Date.now());
  const wordsRef = useRef<LanguageWord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const course = courses.find(c => c.id === courseId);
  useEffect(() => {
    if (course && courseId) {
      try { localStorage.setItem('edu-last-course', JSON.stringify({ lang: language, courseId, title: course.title_ru, icon: course.icon })); } catch { /* noop */ }
    }
  }, [course, courseId, language]);

  useEffect(() => {
    if (!courseId) return;
    loadCourses();
    (async () => {
      const words = await loadWords(courseId);
      wordsRef.current = words;
      if (words.length === 0) { setLoading(false); return; }
      const visibleWords = words.slice(0, MAX_LEARN_WORDS);
      setLessonWords(visibleWords);
      setQuestions(buildQuestions(visibleWords));
      setPhase('learn');
      setLessonIdx(0);
      setLoading(false);
      startedAtRef.current = Date.now();
    })();
    /* eslint-disable-next-line */
  }, [courseId]);

  const current = questions[idx];
  const currentLessonWord = lessonWords[lessonIdx];
  const isLast = idx === questions.length - 1;
  const showFeedback = chosen !== null || inputSubmitted !== null;
  const totalSteps = lessonWords.length + questions.length;
  const doneSteps = phase === 'learn' ? lessonIdx : lessonWords.length + idx + 1;
  const progressPercent = totalSteps > 0 ? Math.min(100, Math.max(2, (doneSteps / totalSteps) * 100)) : 0;

  // Auto-play аудио на новый вопрос
  useEffect(() => {
    if (!current) return;
    setInputValue('');
    setInputSubmitted(null);
    setChosen(null);
    setOrderTokens([]);

    const shouldPlay = current.type === 'listen' || current.type === 'completion' || current.direction === 'foreign-to-ru';
    if (shouldPlay) {
      // Для completion лучше озвучить ВСЁ предложение (с правильным словом),
      // а не только слово — даёт акустический контекст.
      const textToSpeak = current.type === 'completion' && current.word.example
        ? current.word.example
        : current.word.word;
      const t = setTimeout(() => speak(textToSpeak, language, current.type === 'completion' ? 'example' : 'word'), 150);
      return () => clearTimeout(t);
    }
  }, [idx, current, language]);

  // Фокус на input
  useEffect(() => {
    if (current?.type === 'input' && !showFeedback) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [current, showFeedback]);

  const registerWrong = () => {
    setHearts(h => {
      const nh = h - 1;
      if (nh <= 0) setOutOfHearts(true);
      return nh;
    });
    haptic.error();
  };

  const handlePick = (optionIdx: number) => {
    if (showFeedback) return;
    setChosen(optionIdx);
    const isCorrect = optionIdx === current.correctIndex;
    if (isCorrect) {
      setCorrectCount(c => c + 1);
      haptic.success();
    } else {
      registerWrong();
    }
    // Spaced Repetition: фиксируем ответ для этого слова (fire-and-forget)
    recordWordAnswer(current.word.id, isCorrect);
  };

  const handleSubmitInput = () => {
    if (showFeedback || !current) return;
    const ok = checkInput(inputValue, current.correctAnswer);
    setInputSubmitted({ correct: ok });
    if (ok) {
      setCorrectCount(c => c + 1);
      haptic.success();
    } else {
      registerWrong();
    }
    recordWordAnswer(current.word.id, ok);
  };

  const handleSubmitOrder = () => {
    if (showFeedback || !current || !current.correctOrder) return;
    // Сравнение нормализованных версий
    const userJoined = orderTokens.join(' ');
    const correctJoined = current.correctOrder.join(' ');
    const ok = normalize(userJoined) === normalize(correctJoined);
    setInputSubmitted({ correct: ok });
    if (ok) {
      setCorrectCount(c => c + 1);
      haptic.success();
    } else {
      registerWrong();
    }
    recordWordAnswer(current.word.id, ok);
  };

  const handleNext = async () => {
    if (isLast) {
      const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
      const result = await finishSession(courseId!, questions.length, correctCount, duration);
      if (result) {
        setFinished(result);
        if (result.completed) {
          setTimeout(() => triggerConfetti({
            count: 100,
            colors: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899'],
            duration: 2500,
          }), 200);
        }
        // Если стрик увеличился — Duolingo-style празднование поверх результата.
        // Показываем с небольшой задержкой чтобы основной экран успел отрендериться.
        if (result.streak_increased) {
          setTimeout(() => setStreakModalOpen(true), 500);
        }
      } else {
        goBack(nav, '/languages');
      }
    } else {
      setIdx(i => i + 1);
    }
  };

  const restartSession = async () => {
    setPhase('learn');
    setLessonIdx(0);
    setIdx(0);
    setChosen(null);
    setInputValue('');
    setInputSubmitted(null);
    setCorrectCount(0);
    setHearts(HEARTS_TOTAL);
    setFinished(null);
    setOutOfHearts(false);
    // Перезагружаем слова чтобы получить свежий SR-порядок (после записанных ответов).
    if (courseId) {
      const fresh = await loadWords(courseId);
      wordsRef.current = fresh;
      const visibleWords = fresh.slice(0, MAX_LEARN_WORDS);
      setLessonWords(visibleWords);
      setQuestions(buildQuestions(visibleWords));
    } else {
      const visibleWords = wordsRef.current.slice(0, MAX_LEARN_WORDS);
      setLessonWords(visibleWords);
      setQuestions(buildQuestions(visibleWords));
    }
    startedAtRef.current = Date.now();
  };

  const handleNextLesson = () => {
    haptic.tap();
    if (lessonIdx < lessonWords.length - 1) {
      setLessonIdx(i => i + 1);
    } else {
      setPhase('practice');
      setIdx(0);
      startedAtRef.current = Date.now();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)' }}>
        Загрузка урока…
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: 24 }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.5}}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/></svg>
        <div style={{ fontSize: 'var(--fs-snap16)', fontWeight: 600 }}>В этой теме пока нет слов</div>
        <button onClick={() => goBack(nav, '/languages')} style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', padding: '10px 24px', borderRadius: 22, fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer' }}>Назад</button>
      </div>
    );
  }

  if (phase === 'learn' && currentLessonWord) {
    const example = currentLessonWord.example || currentLessonWord.word;
    const exampleRu = currentLessonWord.example_ru || currentLessonWord.translation_ru;
    return (
      <div className="safe-top" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
        <div style={{ padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => { if (confirm('Прервать урок? Прогресс не сохранится.')) goBack(nav, '/languages'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }} aria-label="Закрыть урок">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div style={{ flex: 1, height: 8, background: 'var(--surface-light)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--accent)', transition: 'width 300ms' }} />
            </div>
            <div style={{ width: 24, height: 24, color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconBook size={20} />
            </div>
          </div>
          {course && <div style={{ marginTop: 6, fontSize: 'var(--fs-micro)', color: 'var(--muted)', textAlign: 'center' }}>Тема: {course.title_ru}</div>}
        </div>

        <div key={currentLessonWord.id} className="language-lesson-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
          <div style={{ maxWidth: 520, width: '100%', margin: '0 auto' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)', borderRadius: 999, padding: '7px 12px', fontSize: 'var(--fs-caption)', fontWeight: 700, marginBottom: 16 }}>
              <IconSpark size={16} />
              Новое слово {lessonIdx + 1} из {lessonWords.length}
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 28, padding: '24px 20px', boxShadow: 'var(--shadow-soft)', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>Запомни</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 'clamp(34px, 9vw, 54px)', lineHeight: 1.05, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{currentLessonWord.word}</div>
                    <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--accent)', marginTop: 8 }}>{currentLessonWord.translation_ru}</div>
                  </div>
                  {speechSupported() && (
                    <button onClick={() => speak(currentLessonWord.word, language, 'word')} aria-label="Произнести слово" className="tap-effect language-speak-button">
                      <span className="language-speak-wave" aria-hidden="true" />
                      <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>
                    </button>
                  )}
                </div>

                <div style={{ marginTop: 22, display: 'grid', gap: 12 }}>
                  <div style={{ padding: 14, borderRadius: 18, background: 'var(--surface-light)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>
                      <IconBook size={16} /> Пример
                    </div>
                    <div style={{ fontSize: 'var(--fs-heading)', color: 'var(--text)', lineHeight: 1.35 }}>{example}</div>
                    <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', lineHeight: 1.4, marginTop: 6 }}>{exampleRu}</div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
          <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', gap: 10 }}>
            <button onClick={() => { haptic.tap(); setPhase('practice'); setIdx(0); startedAtRef.current = Date.now(); }} style={{ flex: 0.9, padding: '14px 0', background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 16, fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>К практике</button>
            <button onClick={handleNextLesson} className="alias-btn-press" style={{ flex: 1.2, padding: '14px 0', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 16, fontSize: 'var(--fs-body)', fontWeight: 800, cursor: 'pointer' }}>
              {lessonIdx < lessonWords.length - 1 ? 'Следующее слово' : 'Начать упражнения'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (outOfHearts) {
    return (
      <div className="safe-top" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 18, padding: 24, textAlign: 'center' }}>
        <IconHeartBreak />
        <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700 }}>Закончились жизни</div>
        <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', lineHeight: 1.5, maxWidth: 280 }}>
          5 ошибок за сессию. Прогресс не сохранён. Попробуй ещё раз — слова повторятся в другом порядке.
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={() => goBack(nav, '/languages')} style={{ background: 'var(--surface-light)', color: 'var(--text)', border: 'none', padding: '12px 22px', borderRadius: 22, fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer' }}>К темам</button>
          <button onClick={restartSession} style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', padding: '12px 22px', borderRadius: 22, fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer' }}>
            Заново
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const passed = finished.completed;
    return (
      <div className="safe-top" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: 24, textAlign: 'center' }}>
        {passed ? <IconTrophy /> : <IconStrong />}
        <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700 }}>{passed ? 'Тема пройдена!' : 'Ещё немного'}</div>
        <div style={{ fontSize: 'var(--fs-snap14)', color: 'var(--muted)', lineHeight: 1.5, maxWidth: 280 }}>
          {passed ? `Точность ${finished.accuracy}%. Можешь переходить дальше.` : `Точность ${finished.accuracy}%. Для прохождения нужно ≥80%.`}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
          {finished.streak > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: finished.streak_increased ? 'rgba(239, 68, 68, 0.15)' : 'var(--surface-light)',
              padding: '8px 16px', borderRadius: 20,
              fontSize: 'var(--fs-body)', fontWeight: 600,
              color: finished.streak_increased ? '#EF4444' : 'var(--text)',
            }}>
              <IconFlame /> {finished.streak} {finished.streak === 1 ? 'день' : finished.streak < 5 ? 'дня' : 'дней'}
              {finished.streak_increased && <span style={{ fontSize: 'var(--fs-micro)', marginLeft: 4 }}>+1</span>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={() => goBack(nav, '/languages')} style={{ background: 'var(--surface-light)', color: 'var(--text)', border: 'none', padding: '12px 22px', borderRadius: 22, fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer' }}>К темам</button>
          <button onClick={restartSession} style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', padding: '12px 22px', borderRadius: 22, fontSize: 'var(--fs-snap14)', fontWeight: 600, cursor: 'pointer' }}>
            Ещё раз
          </button>
        </div>

        <StreakCelebration
          streak={finished.streak}
          lastDay={streakLastDay}
          open={streakModalOpen}
          onClose={() => setStreakModalOpen(false)}
        />
      </div>
    );
  }

  const isCorrect = chosen !== null
    ? chosen === current.correctIndex
    : inputSubmitted?.correct === true;

  return (
    <div className="safe-top" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      <div style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { if (confirm('Прервать урок? Прогресс не сохранится.')) goBack(nav, '/languages'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style={{ flex: 1, height: 8, background: 'var(--surface-light)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--accent)', transition: 'width 300ms' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 'var(--fs-snap14)', color: '#EF4444', fontWeight: 700 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#EF4444"><path d="M12 21s-7-4.5-9.5-9C.8 8 3 4 7 4c2.2 0 3.7 1.3 5 3 1.3-1.7 2.8-3 5-3 4 0 6.2 4 4.5 8-2.5 4.5-9.5 9-9.5 9z"/></svg>
            {hearts}
          </div>
        </div>
        {course && <div style={{ marginTop: 6, fontSize: 'var(--fs-micro)', color: 'var(--muted)', textAlign: 'center' }}>Практика: {course.title_ru}</div>}
      </div>

      <div key={idx} className={`lt-q ${showFeedback ? (isCorrect ? 'lt-correct' : 'lt-wrong') : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
        {current.type === 'listen' ? (
          <>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Что ты услышал?</div>
            <button
              onClick={() => speak(current.word.word, language, 'word')}
              style={{
                width: 100, height: 100, borderRadius: 50,
                background: 'rgba(59,130,246,0.15)', border: '2px solid #3B82F6',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="42" height="42" viewBox="0 0 24 24" fill="#3B82F6"><path d="M11 5L6 9H2v6h4l5 4V5zm4.5 7c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/><path d="M19 12c0-3.53-2.61-6.43-6-6.92v2.02c2.28.45 4 2.46 4 4.9s-1.72 4.45-4 4.9v2.02c3.39-.49 6-3.39 6-6.92z"/></svg>
            </button>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', marginTop: 10 }}>Нажми чтобы повторить</div>
            {showFeedback && (
              <div style={{ marginTop: 14, fontSize: 'var(--fs-heading)', fontWeight: 600, color: 'var(--text)' }}>
                {current.word.word}
              </div>
            )}
          </>
        ) : current.type === 'completion' ? (
          <>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
              Заполни пропуск
            </div>
            {/* Подсказка по-русски (мелко, для контекста) */}
            {current.blankTranslation && (
              <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginBottom: 12, textAlign: 'center', maxWidth: 360 }}>
                {current.blankTranslation}
              </div>
            )}
            {/* Само предложение с ___ */}
            <div style={{
              fontSize: 'var(--fs-title)', fontWeight: 600, color: 'var(--text)',
              textAlign: 'center', lineHeight: 1.4, maxWidth: 480,
            }}>
              {/* Подсветим ___ чтобы было заметно */}
              {current.blankSentence?.split('___').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span style={{
                      display: 'inline-block', minWidth: 70,
                      padding: '2px 12px', margin: '0 4px',
                      borderBottom: showFeedback ? '2px solid #10B981' : '2px solid var(--muted)',
                      color: showFeedback ? '#10B981' : 'transparent',
                      fontWeight: 700,
                    }}>
                      {showFeedback ? current.correctAnswer : '___'}
                    </span>
                  )}
                </span>
              ))}
            </div>
            {speechSupported() && (
              <button
                onClick={() => speak(current.word.example || current.word.word, language, current.word.example ? 'example' : 'word')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', padding: 4, marginTop: 10 }}
                aria-label="Произнести"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
              </button>
            )}
          </>
        ) : current.type === 'word_order' ? (
          <>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
              Переведи предложение
            </div>
            {/* Промпт по-русски */}
            <div style={{
              fontSize: 'var(--fs-title)', fontWeight: 600, color: 'var(--text)',
              textAlign: 'center', lineHeight: 1.3, maxWidth: 480, marginBottom: 18,
            }}>
              {current.prompt}
            </div>
            {/* Зона ответа: выбранные токены */}
            <div style={{
              width: '100%', maxWidth: 480,
              minHeight: 64, padding: '10px 12px',
              background: 'var(--surface-light)',
              borderRadius: 12,
              border: '1px dashed var(--border)',
              display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start', alignContent: 'flex-start',
              marginBottom: 8,
            }}>
              {orderTokens.length === 0 && !showFeedback && (
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', padding: '6px 4px' }}>
                  Тапайте слова в правильном порядке
                </div>
              )}
              {orderTokens.map((tok, idx) => (
                <button
                  key={idx + '-' + tok}
                  onClick={() => !showFeedback && setOrderTokens(prev => prev.filter((_, i) => i !== idx))}
                  disabled={showFeedback}
                  style={{
                    padding: '6px 12px', borderRadius: 8,
                    background: showFeedback
                      ? (isCorrect ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.15)')
                      : 'var(--bg)',
                    border: showFeedback
                      ? (isCorrect ? '1px solid #10B981' : '1px solid #EF4444')
                      : '1px solid var(--border)',
                    color: showFeedback
                      ? (isCorrect ? '#10B981' : '#EF4444')
                      : 'var(--text)',
                    fontSize: 'var(--fs-body)', fontWeight: 500,
                    cursor: showFeedback ? 'default' : 'pointer',
                  }}
                >{tok}</button>
              ))}
            </div>
            {/* Показать правильный ответ при неверном */}
            {showFeedback && !isCorrect && current.correctOrder && (
              <div style={{ fontSize: 'var(--fs-caption)', color: '#10B981', marginBottom: 8, textAlign: 'center', fontStyle: 'italic' }}>
                Правильно: {current.correctOrder.join(' ')}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
              {current.direction === 'foreign-to-ru' ? 'Что это значит?' : 'Как сказать?'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2 }}>
                {current.direction === 'foreign-to-ru' ? current.word.word : current.word.translation_ru}
              </div>
              {current.direction === 'foreign-to-ru' && speechSupported() && (
                <button
                  onClick={() => speak(current.word.word, language, 'word')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', padding: 4 }}
                  aria-label="Произнести"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                </button>
              )}
            </div>
            {showFeedback && current.word.example && (
              <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', textAlign: 'center', maxWidth: 320, marginTop: 6, fontStyle: 'italic' }}>
                «{current.word.example}» — {current.word.example_ru}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ padding: '0 16px 12px', maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box', flexShrink: 0 }}>
        {current.type === 'input' ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !showFeedback && inputValue.trim()) handleSubmitInput(); }}
            disabled={showFeedback}
            placeholder="Твой ответ…"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 'var(--fs-heading)',
              border: `2px solid ${showFeedback ? (inputSubmitted?.correct ? '#10B981' : '#EF4444') : 'var(--border)'}`,
              borderRadius: 12,
              background: 'var(--surface-light)',
              color: 'var(--text)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 200ms',
            }}
          />
        ) : current.type === 'word_order' ? (
          /* Bank токенов для word_order */
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            padding: '12px 4px',
            justifyContent: 'center',
          }}>
            {current.wordTokens?.map((tok, idx) => {
              // Подсчёт сколько раз этот токен использован в orderTokens
              // (если в банке два одинаковых токена)
              const totalInBank = current.wordTokens?.filter(t => t === tok).length || 0;
              const usedSoFar = orderTokens.filter(t => t === tok).length;
              const earlierSameInBank = current.wordTokens?.slice(0, idx).filter(t => t === tok).length || 0;
              const isUsed = (earlierSameInBank + usedSoFar) >= totalInBank;
              void totalInBank; // appease tsc
              return (
                <button
                  key={idx + '-' + tok}
                  onClick={() => !showFeedback && !isUsed && setOrderTokens(prev => [...prev, tok])}
                  disabled={showFeedback || isUsed}
                  style={{
                    padding: '8px 14px', borderRadius: 8,
                    background: isUsed ? 'var(--bg)' : 'var(--surface-light)',
                    border: '1px solid var(--border)',
                    color: isUsed ? 'transparent' : 'var(--text)',
                    fontSize: 'var(--fs-body)', fontWeight: 500,
                    cursor: (showFeedback || isUsed) ? 'default' : 'pointer',
                    opacity: isUsed ? 0.35 : 1,
                    transition: 'opacity 150ms',
                  }}
                >{tok}</button>
              );
            })}
          </div>
        ) : (
          /* maxHeight: 50dvh + overflowY:auto — на маленьких экранах
             до 4 вариантов могут не влезть; позволяем им скроллиться,
             чтобы Дальше-кнопка снизу не пропадала под home-indicator. */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '50dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {current.options.map((opt, i) => {
              const isThisCorrect = i === current.correctIndex;
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
                    borderRadius: 12, padding: '14px 16px',
                    fontSize: 'var(--fs-snap16)', fontWeight: 500, cursor: showFeedback ? 'default' : 'pointer',
                    textAlign: 'left',
                    transition: 'background 200ms, border-color 200ms, color 200ms',
                  }}
                >{opt}</button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
        {showFeedback && (
          <div style={{
            background: isCorrect ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
            padding: '10px 14px', borderRadius: 12,
            marginBottom: 10, fontSize: 'var(--fs-label)', color: isCorrect ? '#10B981' : '#EF4444', fontWeight: 600, textAlign: 'center',
          }}>
            {isCorrect ? 'Правильно' : `Правильный ответ: ${current.correctAnswer}`}
          </div>
        )}
        <button
          className="alias-btn-press"
          onClick={() => {
            if (current.type === 'input' && !showFeedback) handleSubmitInput();
            else if (current.type === 'word_order' && !showFeedback) handleSubmitOrder();
            else if (showFeedback) { haptic.tap(); handleNext(); }
          }}
          disabled={
            current.type === 'input' && !showFeedback ? !inputValue.trim() :
            current.type === 'word_order' && !showFeedback ? orderTokens.length === 0 :
            !showFeedback
          }
          style={{
            width: '100%', padding: '14px 0',
            background: (showFeedback
              || (current.type === 'input' && inputValue.trim())
              || (current.type === 'word_order' && orderTokens.length > 0)
            ) ? 'var(--text)' : 'var(--surface-light)',
            color: (showFeedback
              || (current.type === 'input' && inputValue.trim())
              || (current.type === 'word_order' && orderTokens.length > 0)
            ) ? 'var(--bg)' : 'var(--muted)',
            border: 'none', borderRadius: 14,
            fontSize: 'var(--fs-body)', fontWeight: 600,
            cursor: (showFeedback || (current.type === 'input' && inputValue.trim())) ? 'pointer' : 'default',
            transition: 'background 200ms',
          }}
        >
          {current.type === 'input' && !showFeedback
            ? 'Проверить'
            : isLast
              ? (showFeedback ? 'Завершить' : (current.type === 'input' ? 'Введи ответ' : 'Выбери ответ'))
              : (showFeedback ? 'Дальше' : (current.type === 'input' ? 'Введи ответ' : 'Выбери ответ'))}
        </button>
      </div>
    </div>
  );
}
