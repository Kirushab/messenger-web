-- 135_streak_freeze.sql
-- Заморозка языковой серии: поле streak_freezes + учёт в RPC.
-- Идемпотентно. Логика: при пропуске дней авто-тратятся заморозки (1 на пропущенный день),
-- серия сохраняется, если заморозок хватило; +1 заморозка за каждые 7 дней серии (макс 3).
-- Старт у всех — 2.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS streak_freezes int NOT NULL DEFAULT 2;

-- ---- finalize_language_session (с заморозкой) ----
CREATE OR REPLACE FUNCTION public.finalize_language_session(course_id_param uuid, total_param integer, correct_param integer, duration_param integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_accuracy int; v_session_id uuid;
  v_today date := CURRENT_DATE; v_last_day date; v_old_streak int; v_new_streak int;
  v_freezes int; v_freeze_used boolean := false; v_missed int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF total_param <= 0 THEN RAISE EXCEPTION 'empty session'; END IF;
  v_accuracy := (correct_param * 100 / total_param);

  INSERT INTO public.language_sessions (user_id, course_id, ended_at, total, correct, duration_sec, coins_earned)
  VALUES (v_uid, course_id_param, now(), total_param, correct_param, duration_param, 0)
  RETURNING id INTO v_session_id;

  INSERT INTO public.user_language_progress (user_id, course_id, completed, best_accuracy, total_sessions, last_session_at)
  VALUES (v_uid, course_id_param, v_accuracy >= 80, v_accuracy, 1, now())
  ON CONFLICT (user_id, course_id) DO UPDATE
    SET completed = user_language_progress.completed OR (v_accuracy >= 80),
        best_accuracy = GREATEST(user_language_progress.best_accuracy, v_accuracy),
        total_sessions = user_language_progress.total_sessions + 1,
        last_session_at = now();

  SELECT lang_streak, lang_streak_last_day, COALESCE(streak_freezes, 0)
    INTO v_old_streak, v_last_day, v_freezes FROM public.users WHERE id = v_uid;

  IF v_last_day = v_today THEN
    v_new_streak := v_old_streak;
  ELSIF v_last_day = v_today - INTERVAL '1 day' THEN
    v_new_streak := COALESCE(v_old_streak, 0) + 1;
  ELSIF v_last_day IS NOT NULL AND (v_today - v_last_day) > 1 THEN
    v_missed := (v_today - v_last_day) - 1;
    IF v_freezes >= v_missed THEN
      v_freezes := v_freezes - v_missed;
      v_freeze_used := true;
      v_new_streak := COALESCE(v_old_streak, 0) + 1;
    ELSE
      v_new_streak := 1;
    END IF;
  ELSE
    v_new_streak := 1;
  END IF;

  IF v_new_streak > COALESCE(v_old_streak, 0) AND v_new_streak % 7 = 0 THEN
    v_freezes := LEAST(3, v_freezes + 1);
  END IF;

  UPDATE public.users
    SET lang_streak = v_new_streak, lang_streak_last_day = v_today, streak_freezes = v_freezes
    WHERE id = v_uid;

  RETURN jsonb_build_object('session_id', v_session_id, 'accuracy', v_accuracy, 'coins_earned', 0,
    'completed', v_accuracy >= 80, 'streak', v_new_streak, 'streak_increased', v_new_streak > COALESCE(v_old_streak, 0),
    'freezes', v_freezes, 'freeze_used', v_freeze_used);
END; $$;

-- ---- finalize_reading_session (с заморозкой) ----
CREATE OR REPLACE FUNCTION public.finalize_reading_session(passage_id_param uuid, total_param integer, correct_param integer, duration_param integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_accuracy int; v_session_id uuid;
  v_today date := CURRENT_DATE; v_last_day date; v_old_streak int; v_new_streak int;
  v_freezes int; v_freeze_used boolean := false; v_missed int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF total_param <= 0 THEN RAISE EXCEPTION 'empty session'; END IF;
  v_accuracy := (correct_param * 100 / total_param);

  INSERT INTO public.language_passage_sessions (user_id, passage_id, ended_at, total, correct, duration_sec, coins_earned)
  VALUES (v_uid, passage_id_param, now(), total_param, correct_param, duration_param, 0)
  RETURNING id INTO v_session_id;

  SELECT lang_streak, lang_streak_last_day, COALESCE(streak_freezes, 0)
    INTO v_old_streak, v_last_day, v_freezes FROM public.users WHERE id = v_uid;

  IF v_last_day = v_today THEN
    v_new_streak := v_old_streak;
  ELSIF v_last_day = v_today - INTERVAL '1 day' THEN
    v_new_streak := COALESCE(v_old_streak, 0) + 1;
  ELSIF v_last_day IS NOT NULL AND (v_today - v_last_day) > 1 THEN
    v_missed := (v_today - v_last_day) - 1;
    IF v_freezes >= v_missed THEN
      v_freezes := v_freezes - v_missed;
      v_freeze_used := true;
      v_new_streak := COALESCE(v_old_streak, 0) + 1;
    ELSE
      v_new_streak := 1;
    END IF;
  ELSE
    v_new_streak := 1;
  END IF;

  IF v_new_streak > COALESCE(v_old_streak, 0) AND v_new_streak % 7 = 0 THEN
    v_freezes := LEAST(3, v_freezes + 1);
  END IF;

  UPDATE public.users
    SET lang_streak = v_new_streak, lang_streak_last_day = v_today, streak_freezes = v_freezes
    WHERE id = v_uid;

  RETURN jsonb_build_object('session_id', v_session_id, 'accuracy', v_accuracy, 'coins_earned', 0,
    'completed', v_accuracy >= 67, 'streak', v_new_streak, 'streak_increased', v_new_streak > COALESCE(v_old_streak, 0),
    'freezes', v_freezes, 'freeze_used', v_freeze_used);
END; $$;
