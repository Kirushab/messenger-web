import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';

export type Language = 'en' | 'it' | 'es' | 'de' | 'fr';
export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'IELTS' | 'CILS';

export interface LanguageCourse {
  id: string;
  language: Language;
  level: Level;
  theme: string;
  order_index: number;
  title_ru: string;
  icon: string;
  description_ru: string | null;
}

export interface LanguageWord {
  id: string;
  course_id: string;
  word: string;
  translation_ru: string;
  example: string | null;
  example_ru: string | null;
  order_index: number;
}

export interface CourseProgress {
  course_id: string;
  completed: boolean;
  best_accuracy: number;
  total_sessions: number;
  last_session_at: string | null;
}

export interface FinishResult {
  session_id: string;
  accuracy: number;
  coins_earned: number;
  completed: boolean;
  streak: number;
  streak_increased: boolean;
  freezes?: number;
  freeze_used?: boolean;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  themes_completed: number;
  current_streak: number;
  total_coins: number;
}

// ============ Чтение ============
export interface PassageQuestion {
  q_ru: string;
  options: string[];
  correct: number;
}

export interface LanguagePassage {
  id: string;
  language: Language;
  level: string;
  order_index: number;
  title_ru: string;
  topic_emoji: string;
  passage: string;
  passage_ru: string | null;
  questions: PassageQuestion[];
}

export interface PassageSession {
  passage_id: string;
  best_accuracy: number;
  sessions_count: number;
}

export interface ReadingFinishResult {
  session_id: string;
  accuracy: number;
  coins_earned: number;
  completed: boolean;
  streak: number;
  streak_increased: boolean;
  freezes?: number;
  freeze_used?: boolean;
}

interface LangState {
  courses: LanguageCourse[];
  progress: Record<string, CourseProgress>;   // courseId → progress
  loadingCourses: boolean;
  streak: number;                             // users.lang_streak
  streakLastDay: string | null;               // users.lang_streak_last_day
  leaderboard: LeaderboardEntry[];
  passages: LanguagePassage[];
  passageBestAccuracy: Record<string, number>; // passageId → best accuracy
  dailyCount: number;                          // слов отвечено сегодня (по last_seen_at)
  dueCounts: Record<string, number>;           // language → слов на повторение (due_at ≤ now)
  coursesError: boolean;
  leaderboardError: boolean;
  freezes: number;
  mastery: Record<string, { total: number; learning: number; mastered: number }>;

  loadCourses: () => Promise<void>;
  loadProgress: () => Promise<void>;
  loadMastery: (language: Language) => Promise<void>;
  loadStreak: () => Promise<void>;
  loadLeaderboard: () => Promise<void>;
  loadPassages: (language: Language) => Promise<void>;
  loadDailyCount: () => Promise<void>;
  loadDueCounts: () => Promise<void>;
  loadWords: (courseId: string) => Promise<LanguageWord[]>;
  recordWordAnswer: (wordId: string, correct: boolean) => Promise<void>;
  finishSession: (courseId: string, total: number, correct: number, durationSec: number) => Promise<FinishResult | null>;
  finishReadingSession: (passageId: string, total: number, correct: number, durationSec: number) => Promise<ReadingFinishResult | null>;
}

export const useLanguagesStore = create<LangState>((set, get) => ({
  courses: [],
  progress: {},
  loadingCourses: false,
  streak: 0,
  streakLastDay: null,
  leaderboard: [],
  passages: [],
  passageBestAccuracy: {},
  dailyCount: 0,
  dueCounts: {},
  coursesError: false,
  leaderboardError: false,
  freezes: 0,
  mastery: {},

  loadCourses: async () => {
    if (get().courses.length > 0) return; // кэш, перезагрузка не нужна
    set({ loadingCourses: true, coursesError: false });
    const { data, error } = await supabase
      .from('language_courses')
      .select('*')
      .order('language')
      .order('level')
      .order('order_index');
    if (error) { console.error('loadCourses', error); set({ loadingCourses: false, coursesError: true }); return; }
    set({ courses: (data || []) as LanguageCourse[], loadingCourses: false, coursesError: false });
  },

  loadDailyCount: async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { count, error } = await supabase
      .from('user_word_memory')
      .select('word_id', { count: 'exact', head: true })
      .gte('last_seen_at', start.toISOString());
    if (error) return;
    set({ dailyCount: count || 0 });
  },

  loadDueCounts: async () => {
    await get().loadCourses();
    const courseLang: Record<string, string> = {};
    for (const c of get().courses) courseLang[c.id] = (c as any).language;
    const { data: due, error } = await supabase
      .from('user_word_memory')
      .select('word_id')
      .lte('due_at', new Date().toISOString());
    if (error || !due || due.length === 0) { set({ dueCounts: {} }); return; }
    const dueIds = (due as any[]).map(d => d.word_id);
    const { data: words, error: e2 } = await supabase
      .from('language_words')
      .select('id, course_id')
      .in('id', dueIds);
    if (e2 || !words) { set({ dueCounts: {} }); return; }
    const counts: Record<string, number> = {};
    for (const w of words as any[]) {
      const lang = courseLang[w.course_id];
      if (lang) counts[lang] = (counts[lang] || 0) + 1;
    }
    set({ dueCounts: counts });
  },

  loadProgress: async () => {
    const { data, error } = await supabase
      .from('user_language_progress')
      .select('course_id, completed, best_accuracy, total_sessions, last_session_at');
    if (error) { console.error('loadProgress', error); return; }
    const map: Record<string, CourseProgress> = {};
    for (const row of (data || []) as CourseProgress[]) map[row.course_id] = row;
    set({ progress: map });
  },

  // Освоенность слов по темам языка (для кольца на плитке и экрана прогресса).
  // Освоено: SRS-уровень ≥ 5; осваивается: есть память, уровень < 5; новое: памяти нет.
  loadMastery: async (language) => {
    await get().loadCourses();
    const courseIds = get().courses.filter(c => c.language === language).map(c => c.id);
    if (courseIds.length === 0) { set({ mastery: {} }); return; }
    const { data: words } = await supabase
      .from('language_words')
      .select('id, course_id')
      .in('course_id', courseIds);
    if (!words || words.length === 0) { set({ mastery: {} }); return; }
    const wordCourse: Record<string, string> = {};
    const stats: Record<string, { total: number; learning: number; mastered: number }> = {};
    for (const cid of courseIds) stats[cid] = { total: 0, learning: 0, mastered: 0 };
    for (const w of words as any[]) { wordCourse[w.id] = w.course_id; if (stats[w.course_id]) stats[w.course_id].total++; }
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (uid) {
      // Берём всю память пользователя (его данные, ограничено) и фильтруем по словам языка — без огромного in().
      const { data: mem } = await supabase
        .from('user_word_memory')
        .select('word_id, level')
        .eq('user_id', uid);
      for (const m of (mem || []) as any[]) {
        const cid = wordCourse[m.word_id];
        if (!cid || !stats[cid]) continue;
        if ((m.level ?? 0) >= 5) stats[cid].mastered++;
        else stats[cid].learning++;
      }
    }
    set({ mastery: stats });
  },

  // Тянем lang_streak и lang_streak_last_day из users.
  // Если день не сегодня и не вчера — стрик технически сломан, но в БД его сбросит
  // ближайшая сессия. Здесь только отображение.
  loadStreak: async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from('users')
      .select('lang_streak, lang_streak_last_day, streak_freezes')
      .eq('id', uid)
      .maybeSingle();
    if (error || !data) return;
    set({ streak: data.lang_streak ?? 0, streakLastDay: data.lang_streak_last_day ?? null, freezes: (data as any).streak_freezes ?? 0 });
  },

  loadLeaderboard: async () => {
    const { data, error } = await supabase.rpc('get_language_leaderboard');
    if (error) { console.error('loadLeaderboard', error); set({ leaderboardError: true }); return; }
    set({ leaderboard: (data || []) as LeaderboardEntry[], leaderboardError: false });
  },

  // Загружает тексты для языка + лучшую точность юзера по каждому
  loadPassages: async (language) => {
    const { data, error } = await supabase
      .from('language_passages')
      .select('*')
      .eq('language', language)
      .order('order_index');
    if (error) { console.error('loadPassages', error); return; }
    set({ passages: (data || []) as LanguagePassage[] });

    // Параллельно — лучший результат юзера по каждому тексту (max accuracy)
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return;
    const passageIds = (data || []).map(p => p.id);
    if (passageIds.length === 0) return;
    const { data: sessions } = await supabase
      .from('language_passage_sessions')
      .select('passage_id, total, correct')
      .eq('user_id', uid)
      .in('passage_id', passageIds);
    const best: Record<string, number> = {};
    for (const s of (sessions || []) as any[]) {
      if (!s.total) continue;
      const acc = Math.round((s.correct * 100) / s.total);
      if (acc > (best[s.passage_id] || 0)) best[s.passage_id] = acc;
    }
    set({ passageBestAccuracy: best });
  },

  finishReadingSession: async (passageId, total, correct, durationSec) => {
    const { data, error } = await supabase.rpc('finalize_reading_session', {
      passage_id_param: passageId,
      total_param: total,
      correct_param: correct,
      duration_param: durationSec,
    });
    if (error) { console.error('finishReadingSession', error); return null; }
    const result = data as ReadingFinishResult;
    // Обновим локально лучший результат
    const accuracy = Math.round((correct * 100) / total);
    set(state => ({
      passageBestAccuracy: {
        ...state.passageBestAccuracy,
        [passageId]: Math.max(state.passageBestAccuracy[passageId] || 0, accuracy),
      },
      streak: result.streak,
      streakLastDay: new Date().toISOString().slice(0, 10),
      freezes: result.freezes ?? state.freezes,
    }));
    if (result.freeze_used) toast.info('🧊 Заморозка использована — серия сохранена!');
    return result;
  },

  loadWords: async (courseId) => {
    const { data, error } = await supabase
      .from('language_words')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index');
    if (error) { console.error('loadWords', error); return []; }
    const words = (data || []) as LanguageWord[];

    // Spaced Repetition: подгружаем память юзера и сортируем слова.
    // Новые → срочные (due ≤ сейчас) → освоенные (due в будущем).
    // Внутри каждой группы — случайный порядок, чтобы сессии не повторялись.
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid || words.length === 0) return words;

    const { data: memory } = await supabase
      .from('user_word_memory')
      .select('word_id, level, due_at, wrong_count')
      .eq('user_id', uid)
      .in('word_id', words.map(w => w.id));

    const memMap: Record<string, { level: number; due_at: string; wrong_count: number }> = {};
    for (const m of (memory || []) as any[]) memMap[m.word_id] = { level: m.level, due_at: m.due_at, wrong_count: m.wrong_count ?? 0 };

    const now = Date.now();
    const shuf = <T,>(a: T[]) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

    const freshWords    = shuf(words.filter(w => !memMap[w.id]));
    // Адаптивно: среди слов на повторение слабые (с большим числом ошибок) идут раньше; равные — в случайном порядке.
    const dueWords      = words
      .filter(w => memMap[w.id] && new Date(memMap[w.id].due_at).getTime() <= now)
      .sort((a, b) => ((memMap[b.id]?.wrong_count || 0) - (memMap[a.id]?.wrong_count || 0)) || (Math.random() - 0.5));
    const masteredWords = shuf(words.filter(w => memMap[w.id] && new Date(memMap[w.id].due_at).getTime() >  now));

    return [...freshWords, ...dueWords, ...masteredWords];
  },

  // Записать факт ответа на слово. Fire-and-forget — не ждём результата.
  // RPC обновит уровень и due_at в user_word_memory.
  recordWordAnswer: async (wordId, correct) => {
    const { error } = await supabase.rpc('record_word_answer', {
      word_id_param: wordId,
      correct_param: correct,
    });
    if (error) console.error('recordWordAnswer', error);
  },

  finishSession: async (courseId, total, correct, durationSec) => {
    const { data, error } = await supabase.rpc('finalize_language_session', {
      course_id_param: courseId,
      total_param: total,
      correct_param: correct,
      duration_param: durationSec,
    });
    if (error) { console.error('finishSession', error); return null; }
    const result = data as FinishResult;
    // Перезагружаем прогресс и стрик чтобы лобби/курсы обновились
    await get().loadProgress();
    set({ streak: result.streak, streakLastDay: new Date().toISOString().slice(0, 10), freezes: result.freezes ?? get().freezes });
    if (result.freeze_used) toast.info('🧊 Заморозка использована — серия сохранена!');
    return result;
  },
}));
