-- ============================================================
-- 065_languages_streak.sql
-- Streak (дни подряд занятий языками) + обновление RPC.
-- ============================================================

-- Колонки в users для языкового streak (отдельно от daily_checkin streak)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lang_streak          int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lang_streak_last_day date;

-- Пересоздаём RPC с учётом streak'а
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
  v_today        date := CURRENT_DATE;
  v_last_day     date;
  v_old_streak   int;
  v_new_streak   int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF total_param <= 0 THEN RAISE EXCEPTION 'empty session'; END IF;

  v_accuracy := (correct_param * 100 / total_param);
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

  -- Streak logic:
  --   last_day == сегодня      → не меняем (уже засчитан сегодня)
  --   last_day == вчера        → +1
  --   старше или NULL          → reset до 1 (начинаем заново)
  SELECT lang_streak, lang_streak_last_day INTO v_old_streak, v_last_day
  FROM public.users WHERE id = v_uid;

  IF v_last_day = v_today THEN
    v_new_streak := v_old_streak;
  ELSIF v_last_day = v_today - INTERVAL '1 day' THEN
    v_new_streak := COALESCE(v_old_streak, 0) + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  UPDATE public.users
  SET coins                 = COALESCE(coins, 0) + v_coins,
      lang_streak           = v_new_streak,
      lang_streak_last_day  = v_today
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'accuracy', v_accuracy,
    'coins_earned', v_coins,
    'completed', v_accuracy >= 80,
    'streak', v_new_streak,
    'streak_increased', v_new_streak > COALESCE(v_old_streak, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_language_session(uuid, int, int, int) TO authenticated;
