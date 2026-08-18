-- ============================================================
-- 067_languages_leaderboard.sql
-- Глобальный лидерборд по языкам: топ-20 юзеров.
-- Сортировка: пройденные темы DESC, монетки DESC, стрик DESC.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_language_leaderboard();

CREATE OR REPLACE FUNCTION public.get_language_leaderboard()
RETURNS TABLE (
  user_id          uuid,
  display_name     text,
  avatar_url       text,
  themes_completed bigint,
  current_streak   int,
  total_coins      bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.display_name,
    u.avatar_url,
    COALESCE(p.themes_count, 0)::bigint AS themes_completed,
    COALESCE(u.lang_streak, 0) AS current_streak,
    COALESCE(s.coins_sum, 0)::bigint AS total_coins
  FROM public.users u
  LEFT JOIN (
    SELECT user_id, count(*) AS themes_count
    FROM public.user_language_progress
    WHERE completed = true
    GROUP BY user_id
  ) p ON p.user_id = u.id
  LEFT JOIN (
    SELECT user_id, sum(coins_earned) AS coins_sum
    FROM public.language_sessions
    GROUP BY user_id
  ) s ON s.user_id = u.id
  -- Показываем только тех у кого вообще что-то сделано
  WHERE COALESCE(p.themes_count, 0) > 0
     OR COALESCE(u.lang_streak, 0) > 0
     OR COALESCE(s.coins_sum, 0) > 0
  ORDER BY themes_completed DESC, total_coins DESC, current_streak DESC, u.display_name ASC
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_language_leaderboard() TO authenticated;
