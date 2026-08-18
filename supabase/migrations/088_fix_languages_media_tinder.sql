-- ============================================================
-- 088_fix_languages_media_tinder.sql  (v58.68)
-- Накатить в Supabase SQL Editor.
--
-- 1) Языки/чтение: убрана запись в несуществующую users.coins (кошелёк скрыт),
--    прогрессия (completed) и стрик сохранены. Раньше RPC падали с
--    "column coins does not exist".
-- 2) Очистка медиа: функции переписаны с несуществующей messages.attachments
--    на таблицу file_attachments.
-- 3) Тиндер-ставки: фича удалена — дропаем мёртвые функции.
-- ============================================================

-- ---- 1. ЯЗЫКИ ----
CREATE OR REPLACE FUNCTION public.finalize_language_session(course_id_param uuid, total_param integer, correct_param integer, duration_param integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_accuracy int; v_session_id uuid;
  v_today date := CURRENT_DATE; v_last_day date; v_old_streak int; v_new_streak int;
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

  SELECT lang_streak, lang_streak_last_day INTO v_old_streak, v_last_day FROM public.users WHERE id = v_uid;
  IF v_last_day = v_today THEN v_new_streak := v_old_streak;
  ELSIF v_last_day = v_today - INTERVAL '1 day' THEN v_new_streak := COALESCE(v_old_streak,0)+1;
  ELSE v_new_streak := 1; END IF;
  UPDATE public.users SET lang_streak = v_new_streak, lang_streak_last_day = v_today WHERE id = v_uid;

  RETURN jsonb_build_object('session_id', v_session_id, 'accuracy', v_accuracy, 'coins_earned', 0,
    'completed', v_accuracy >= 80, 'streak', v_new_streak, 'streak_increased', v_new_streak > COALESCE(v_old_streak,0));
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_reading_session(passage_id_param uuid, total_param integer, correct_param integer, duration_param integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_accuracy int; v_session_id uuid;
  v_today date := CURRENT_DATE; v_last_day date; v_old_streak int; v_new_streak int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF total_param <= 0 THEN RAISE EXCEPTION 'empty session'; END IF;
  v_accuracy := (correct_param * 100 / total_param);

  INSERT INTO public.language_passage_sessions (user_id, passage_id, ended_at, total, correct, duration_sec, coins_earned)
  VALUES (v_uid, passage_id_param, now(), total_param, correct_param, duration_param, 0)
  RETURNING id INTO v_session_id;

  SELECT lang_streak, lang_streak_last_day INTO v_old_streak, v_last_day FROM public.users WHERE id = v_uid;
  IF v_last_day = v_today THEN v_new_streak := v_old_streak;
  ELSIF v_last_day = v_today - INTERVAL '1 day' THEN v_new_streak := COALESCE(v_old_streak,0)+1;
  ELSE v_new_streak := 1; END IF;
  UPDATE public.users SET lang_streak = v_new_streak, lang_streak_last_day = v_today WHERE id = v_uid;

  RETURN jsonb_build_object('session_id', v_session_id, 'accuracy', v_accuracy, 'coins_earned', 0,
    'completed', v_accuracy >= 67, 'streak', v_new_streak, 'streak_increased', v_new_streak > COALESCE(v_old_streak,0));
END; $$;

-- ---- 2. ОЧИСТКА МЕДИА (file_attachments) ----
CREATE OR REPLACE FUNCTION public.admin_preview_chat_media_cleanup(cutoff_date timestamptz)
RETURNS TABLE(message_count bigint, attachment_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE caller_email text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS NULL OR caller_email <> 'lirikb2002@gmail.com' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT COUNT(DISTINCT m.id)::bigint, COUNT(fa.id)::bigint
    FROM public.messages m
    JOIN public.file_attachments fa ON fa.message_id = m.id
    WHERE m.created_at < cutoff_date;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_execute_chat_media_cleanup(cutoff_date timestamptz)
RETURNS TABLE(deleted_messages bigint, file_urls text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE caller_email text; urls text[]; cnt bigint;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS NULL OR caller_email <> 'lirikb2002@gmail.com' THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT array_agg(fa.file_url) INTO urls
  FROM public.messages m
  JOIN public.file_attachments fa ON fa.message_id = m.id
  WHERE m.created_at < cutoff_date AND fa.file_url IS NOT NULL;

  WITH del AS (
    DELETE FROM public.messages m
    WHERE m.created_at < cutoff_date
      AND EXISTS (SELECT 1 FROM public.file_attachments fa WHERE fa.message_id = m.id)
    RETURNING 1
  )
  SELECT COUNT(*) INTO cnt FROM del;

  RETURN QUERY SELECT cnt, COALESCE(urls, ARRAY[]::text[]);
END; $$;

-- ---- 3. ТИНДЕР-СТАВКИ (удалены) ----
DROP FUNCTION IF EXISTS public.place_tinder_bet_stake(uuid, bigint);
DROP FUNCTION IF EXISTS public.finalize_tinder_bet(uuid);
DROP FUNCTION IF EXISTS public.create_tinder_bet(uuid, uuid, integer, boolean);
