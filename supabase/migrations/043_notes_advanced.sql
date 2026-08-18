-- ============================================================
-- 043_notes_advanced.sql — v53.2 Ноты: уровень "Альтерации" (диезы/бемоли)
-- ============================================================

-- 1. Колонка для лучшего результата на advanced
ALTER TABLE public.notes_progress
  ADD COLUMN IF NOT EXISTS best_advanced_score INT NOT NULL DEFAULT 0;

-- 2. Обновляем check на level в sessions
ALTER TABLE public.notes_sessions DROP CONSTRAINT IF EXISTS notes_sessions_level_check;
ALTER TABLE public.notes_sessions ADD CONSTRAINT notes_sessions_level_check
  CHECK (level IN ('treble', 'bass', 'both', 'advanced'));

-- 3. Пересоздаём notes_finish_session с поддержкой advanced
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
  IF level_param NOT IN ('treble', 'bass', 'both', 'advanced') THEN RAISE EXCEPTION 'Invalid level'; END IF;
  IF total_questions_param < 1 OR total_questions_param > 100 THEN RAISE EXCEPTION 'Invalid total'; END IF;
  IF correct_count_param < 0 OR correct_count_param > total_questions_param THEN RAISE EXCEPTION 'Invalid correct'; END IF;
  IF duration_seconds_param < 1 OR duration_seconds_param > 7200 THEN RAISE EXCEPTION 'Invalid duration'; END IF;

  p := public.notes_get_my_progress();

  accuracy := correct_count_param::NUMERIC / total_questions_param::NUMERIC;

  IF level_param = 'advanced' THEN
    -- Увеличенные награды для уровня с альтерациями
    IF accuracy >= 1.0 THEN coins_to_award := 15;
    ELSIF accuracy >= 0.8 THEN coins_to_award := 8;
    ELSIF accuracy >= 0.6 THEN coins_to_award := 3;
    ELSE coins_to_award := 0;
    END IF;
  ELSE
    IF accuracy >= 1.0 THEN coins_to_award := 10;
    ELSIF accuracy >= 0.8 THEN coins_to_award := 5;
    ELSIF accuracy >= 0.6 THEN coins_to_award := 2;
    ELSE coins_to_award := 0;
    END IF;
    IF level_param = 'both' AND coins_to_award > 0 THEN
      coins_to_award := coins_to_award + 3;
    END IF;
  END IF;

  -- Анти-чит
  IF duration_seconds_param < total_questions_param THEN
    coins_to_award := 0;
  END IF;

  -- Дневной лимит
  remaining_daily := GREATEST(0, daily_limit - p.coins_earned_today);
  coins_to_award := LEAST(coins_to_award, remaining_daily);

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
  ELSIF level_param = 'both' THEN
    SELECT best_both_score INTO current_best FROM public.notes_progress WHERE user_id = uid;
    IF correct_count_param > current_best THEN
      UPDATE public.notes_progress SET best_both_score = correct_count_param WHERE user_id = uid;
      new_best := TRUE;
    END IF;
  ELSE
    SELECT best_advanced_score INTO current_best FROM public.notes_progress WHERE user_id = uid;
    IF correct_count_param > current_best THEN
      UPDATE public.notes_progress SET best_advanced_score = correct_count_param WHERE user_id = uid;
      new_best := TRUE;
    END IF;
  END IF;

  -- Обновляем общий прогресс
  UPDATE public.notes_progress SET
    total_correct = total_correct + correct_count_param,
    total_attempts = total_attempts + total_questions_param,
    best_streak = GREATEST(best_streak, correct_count_param),
    sessions_played = sessions_played + 1,
    coins_earned_today = coins_earned_today + coins_to_award,
    coins_earned_total = coins_earned_total + coins_to_award,
    updated_at = NOW()
  WHERE user_id = uid;

  -- Начисляем монеты
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

-- 4. Обновляем leaderboard — учитываем advanced как высший приоритет
CREATE OR REPLACE FUNCTION public.notes_get_leaderboard()
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  best_streak INT,
  sessions_played INT,
  total_correct INT,
  best_both_score INT,
  best_advanced_score INT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.user_id, u.display_name, u.avatar_url,
      p.best_streak, p.sessions_played, p.total_correct,
      p.best_both_score, p.best_advanced_score
    FROM public.notes_progress p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.sessions_played > 0
    ORDER BY p.best_advanced_score DESC, p.best_both_score DESC, p.best_streak DESC
    LIMIT 10;
END;
$$;

-- DONE
