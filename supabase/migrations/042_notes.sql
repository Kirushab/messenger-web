-- ============================================================
-- 042_notes.sql — v53 Ноты (обучение нотной грамоте)
-- ============================================================

-- 1. Прогресс пользователя
CREATE TABLE IF NOT EXISTS public.notes_progress (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  total_correct INT NOT NULL DEFAULT 0,
  total_attempts INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  sessions_played INT NOT NULL DEFAULT 0,
  coins_earned_total BIGINT NOT NULL DEFAULT 0,
  coins_earned_today INT NOT NULL DEFAULT 0,
  last_play_date DATE NOT NULL DEFAULT CURRENT_DATE,
  best_treble_score INT NOT NULL DEFAULT 0,
  best_bass_score INT NOT NULL DEFAULT 0,
  best_both_score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Сессии (история партий)
CREATE TABLE IF NOT EXISTS public.notes_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('treble', 'bass', 'both')),
  total_questions INT NOT NULL,
  correct_count INT NOT NULL DEFAULT 0,
  duration_seconds INT NOT NULL DEFAULT 0,
  coins_earned INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_sessions_user ON public.notes_sessions(user_id, created_at DESC);

-- 3. RLS
ALTER TABLE public.notes_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_progress_select ON public.notes_progress;
CREATE POLICY notes_progress_select ON public.notes_progress FOR SELECT USING (true);

DROP POLICY IF EXISTS notes_sessions_select ON public.notes_sessions;
CREATE POLICY notes_sessions_select ON public.notes_sessions FOR SELECT USING (user_id = auth.uid());

-- 4. Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notes_progress; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. RPC: получить мой прогресс (создаёт запись если нет)
CREATE OR REPLACE FUNCTION public.notes_get_my_progress()
RETURNS public.notes_progress LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  p public.notes_progress;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO p FROM public.notes_progress WHERE user_id = uid;
  IF NOT FOUND THEN
    INSERT INTO public.notes_progress (user_id) VALUES (uid) RETURNING * INTO p;
  ELSE
    -- Сброс дневного счётчика если новый день
    IF p.last_play_date < CURRENT_DATE THEN
      UPDATE public.notes_progress
        SET coins_earned_today = 0, last_play_date = CURRENT_DATE
        WHERE user_id = uid RETURNING * INTO p;
    END IF;
  END IF;
  RETURN p;
END;
$$;

-- 6. RPC: завершить сессию + начислить монеты
CREATE OR REPLACE FUNCTION public.notes_finish_session(
  level_param TEXT,
  total_questions_param INT,
  correct_count_param INT,
  duration_seconds_param INT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  p public.notes_progress;
  daily_limit INT := 30;
  coins_to_award INT := 0;
  accuracy NUMERIC;
  remaining_daily INT;
  session_id UUID;
  new_best BOOLEAN := FALSE;
  current_best INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF level_param NOT IN ('treble', 'bass', 'both') THEN RAISE EXCEPTION 'Invalid level'; END IF;
  IF total_questions_param < 1 OR total_questions_param > 100 THEN RAISE EXCEPTION 'Invalid total'; END IF;
  IF correct_count_param < 0 OR correct_count_param > total_questions_param THEN RAISE EXCEPTION 'Invalid correct'; END IF;
  IF duration_seconds_param < 1 OR duration_seconds_param > 7200 THEN RAISE EXCEPTION 'Invalid duration'; END IF;

  -- Получить/создать прогресс
  p := public.notes_get_my_progress();

  -- Подсчёт монет
  accuracy := correct_count_param::NUMERIC / total_questions_param::NUMERIC;
  IF accuracy >= 1.0 THEN coins_to_award := 10;
  ELSIF accuracy >= 0.8 THEN coins_to_award := 5;
  ELSIF accuracy >= 0.6 THEN coins_to_award := 2;
  ELSE coins_to_award := 0;
  END IF;

  -- Бонус за оба ключа
  IF level_param = 'both' AND coins_to_award > 0 THEN
    coins_to_award := coins_to_award + 3;
  END IF;

  -- Защита от подозрительно быстрых сессий (< 1 сек на вопрос)
  IF duration_seconds_param < total_questions_param THEN
    coins_to_award := 0;
  END IF;

  -- Дневной лимит
  remaining_daily := GREATEST(0, daily_limit - p.coins_earned_today);
  coins_to_award := LEAST(coins_to_award, remaining_daily);

  -- Записать сессию
  INSERT INTO public.notes_sessions (
    user_id, level, total_questions, correct_count, duration_seconds, coins_earned
  ) VALUES (
    uid, level_param, total_questions_param, correct_count_param, duration_seconds_param, coins_to_award
  ) RETURNING id INTO session_id;

  -- Проверка нового рекорда
  IF level_param = 'treble' THEN
    SELECT best_treble_score INTO current_best FROM public.notes_progress WHERE user_id = uid;
    IF correct_count_param > current_best THEN
      UPDATE public.notes_progress SET best_treble_score = correct_count_param WHERE user_id = uid;
      new_best := TRUE;
    END IF;
  ELSIF level_param = 'bass' THEN
    SELECT best_bass_score INTO current_best FROM public.notes_progress WHERE user_id = uid;
    IF correct_count_param > current_best THEN
      UPDATE public.notes_progress SET best_bass_score = correct_count_param WHERE user_id = uid;
      new_best := TRUE;
    END IF;
  ELSE
    SELECT best_both_score INTO current_best FROM public.notes_progress WHERE user_id = uid;
    IF correct_count_param > current_best THEN
      UPDATE public.notes_progress SET best_both_score = correct_count_param WHERE user_id = uid;
      new_best := TRUE;
    END IF;
  END IF;

  -- Обновить общий прогресс
  UPDATE public.notes_progress SET
    total_correct = total_correct + correct_count_param,
    total_attempts = total_attempts + total_questions_param,
    best_streak = GREATEST(best_streak, correct_count_param),
    sessions_played = sessions_played + 1,
    coins_earned_today = coins_earned_today + coins_to_award,
    coins_earned_total = coins_earned_total + coins_to_award,
    updated_at = NOW()
  WHERE user_id = uid;

  -- Начислить монеты в Wallet
  IF coins_to_award > 0 THEN
    UPDATE public.wallets SET
      balance = balance + coins_to_award,
      lifetime_earned = lifetime_earned + coins_to_award,
      updated_at = NOW()
    WHERE user_id = uid;

    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (uid, 'game_win', coins_to_award, 'Ноты — обучение',
      jsonb_build_object('notes_session_id', session_id, 'level', level_param, 'accuracy', accuracy));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', session_id,
    'coins_earned', coins_to_award,
    'new_best', new_best,
    'daily_remaining', remaining_daily - coins_to_award
  );
END;
$$;

-- 7. RPC: топ-10 по best_streak
CREATE OR REPLACE FUNCTION public.notes_get_leaderboard()
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  best_streak INT,
  sessions_played INT,
  total_correct INT,
  best_both_score INT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.user_id, u.display_name, u.avatar_url,
      p.best_streak, p.sessions_played, p.total_correct, p.best_both_score
    FROM public.notes_progress p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.sessions_played > 0
    ORDER BY p.best_both_score DESC, p.best_streak DESC, p.total_correct DESC
    LIMIT 10;
END;
$$;

-- 8. RPC: история сессий
CREATE OR REPLACE FUNCTION public.notes_get_my_sessions(limit_param INT DEFAULT 20)
RETURNS SETOF public.notes_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT * FROM public.notes_sessions
    WHERE user_id = uid
    ORDER BY created_at DESC
    LIMIT limit_param;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notes_get_my_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notes_finish_session(TEXT, INT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notes_get_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notes_get_my_sessions(INT) TO authenticated;

-- DONE
