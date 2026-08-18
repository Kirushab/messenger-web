-- ============================================================
-- 063_languages.sql
-- Тренажёр иностранных языков (EN, IT) с уровнями A1/A2/B1.
-- Курс = (язык, уровень, тема). Слово принадлежит курсу.
-- Сессия = одно прохождение курса. Прогресс = агрегат по юзеру и курсу.
-- ============================================================

-- ============ ТАБЛИЦЫ ============

CREATE TABLE IF NOT EXISTS public.language_courses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language     text NOT NULL CHECK (language IN ('en', 'it')),
  level        text NOT NULL CHECK (level IN ('A1', 'A2', 'B1')),
  theme        text NOT NULL,           -- 'greetings', 'family', 'food', 'numbers', 'daily'
  order_index  int  NOT NULL,
  title_ru     text NOT NULL,           -- название темы по-русски
  icon         text NOT NULL,           -- эмодзи
  description_ru text,
  UNIQUE (language, level, theme)
);

CREATE TABLE IF NOT EXISTS public.language_words (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.language_courses(id) ON DELETE CASCADE,
  word        text NOT NULL,            -- foreign word (e.g. 'hello')
  translation_ru text NOT NULL,         -- русский перевод (e.g. 'привет')
  example     text,                     -- пример предложения на иностранном
  example_ru  text,                     -- его перевод
  order_index int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_language_words_course ON public.language_words(course_id);

CREATE TABLE IF NOT EXISTS public.language_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES public.language_courses(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  total         int  NOT NULL DEFAULT 0,
  correct       int  NOT NULL DEFAULT 0,
  duration_sec  int  NOT NULL DEFAULT 0,
  coins_earned  int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_language_sessions_user ON public.language_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.user_language_progress (
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id        uuid NOT NULL REFERENCES public.language_courses(id) ON DELETE CASCADE,
  completed        boolean NOT NULL DEFAULT false,
  best_accuracy    int  NOT NULL DEFAULT 0,    -- % правильных ответов лучшей сессии
  total_sessions   int  NOT NULL DEFAULT 0,
  last_session_at  timestamptz,
  PRIMARY KEY (user_id, course_id)
);

-- ============ RLS ============

ALTER TABLE public.language_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_words    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_language_progress ENABLE ROW LEVEL SECURITY;

-- Курсы и слова — публичные, любой authenticated может читать
DROP POLICY IF EXISTS "Anyone reads courses" ON public.language_courses;
CREATE POLICY "Anyone reads courses" ON public.language_courses FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone reads words" ON public.language_words;
CREATE POLICY "Anyone reads words" ON public.language_words FOR SELECT
  USING (auth.role() = 'authenticated');

-- Сессии — каждый видит и пишет только свои
DROP POLICY IF EXISTS "User reads own sessions" ON public.language_sessions;
CREATE POLICY "User reads own sessions" ON public.language_sessions FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "User writes own sessions" ON public.language_sessions;
CREATE POLICY "User writes own sessions" ON public.language_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Прогресс — свой видит и обновляет
DROP POLICY IF EXISTS "User reads own progress" ON public.user_language_progress;
CREATE POLICY "User reads own progress" ON public.user_language_progress FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "User writes own progress" ON public.user_language_progress;
CREATE POLICY "User writes own progress" ON public.user_language_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "User updates own progress" ON public.user_language_progress;
CREATE POLICY "User updates own progress" ON public.user_language_progress FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Лидерборд (для будущего v57.95) — все видят чужие сессии для агрегации.
-- Пока оставляю SELECT свой; позже добавим публичные агрегаты через RPC.

-- ============ RPC: finalize_language_session ============
-- Завершает сессию: записывает результат + обновляет прогресс + начисляет монетки.
-- Атомарно. SECURITY DEFINER чтобы можно было обновлять users.coins из-под RLS.

DROP FUNCTION IF EXISTS public.finalize_language_session(uuid, int, int, int);

CREATE OR REPLACE FUNCTION public.finalize_language_session(
  course_id_param  uuid,
  total_param      int,
  correct_param    int,
  duration_param   int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_accuracy     int;
  v_coins        int;
  v_session_id   uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF total_param <= 0 THEN RAISE EXCEPTION 'empty session'; END IF;

  v_accuracy := (correct_param * 100 / total_param);
  -- Монетки: 1 за правильный ответ + бонус 5 если 100% и не меньше 10 вопросов
  v_coins := correct_param + (CASE WHEN v_accuracy = 100 AND total_param >= 10 THEN 5 ELSE 0 END);

  INSERT INTO public.language_sessions (user_id, course_id, ended_at, total, correct, duration_sec, coins_earned)
  VALUES (v_uid, course_id_param, now(), total_param, correct_param, duration_param, v_coins)
  RETURNING id INTO v_session_id;

  INSERT INTO public.user_language_progress (user_id, course_id, completed, best_accuracy, total_sessions, last_session_at)
  VALUES (v_uid, course_id_param, v_accuracy >= 80, v_accuracy, 1, now())
  ON CONFLICT (user_id, course_id) DO UPDATE
  SET completed       = user_language_progress.completed OR (v_accuracy >= 80),
      best_accuracy   = GREATEST(user_language_progress.best_accuracy, v_accuracy),
      total_sessions  = user_language_progress.total_sessions + 1,
      last_session_at = now();

  -- Начисление монет в общий баланс юзера
  UPDATE public.users SET coins = COALESCE(coins, 0) + v_coins WHERE id = v_uid;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'accuracy', v_accuracy,
    'coins_earned', v_coins,
    'completed', v_accuracy >= 80
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_language_session(uuid, int, int, int) TO authenticated;
