-- 111_grammar_leaderboard.sql
-- Функция рейтинга грамматики. SECURITY DEFINER: читает grammar_progress всех пользователей,
-- но наружу отдаёт ТОЛЬКО агрегат (имя, аватар, число тем на 100%, сумма верных) — без сырых строк.

CREATE OR REPLACE FUNCTION public.grammar_leaderboard(p_language text)
RETURNS TABLE (
  user_id       uuid,
  display_name  text,
  avatar_url    text,
  mastered      int,
  total_correct int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gp.user_id,
         u.display_name,
         u.avatar_url,
         COUNT(*) FILTER (WHERE gp.best_total > 0 AND gp.best_correct = gp.best_total)::int AS mastered,
         COALESCE(SUM(gp.best_correct), 0)::int AS total_correct
  FROM public.grammar_progress gp
  JOIN public.users u ON u.id = gp.user_id
  WHERE gp.language = p_language
  GROUP BY gp.user_id, u.display_name, u.avatar_url
  HAVING COALESCE(SUM(gp.attempts), 0) > 0
  ORDER BY mastered DESC, total_correct DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.grammar_leaderboard(text) FROM public;
GRANT EXECUTE ON FUNCTION public.grammar_leaderboard(text) TO authenticated;
