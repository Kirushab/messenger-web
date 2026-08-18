-- ============================================================
-- 059_games_fix.sql
-- Фиксы:
--  1) DELETE-политики для chess_games и mafia_games (можно удалить свою игру)
--  2) Обновлённая chess_create_game (на случай если в БД старая версия)
--
-- ВАЖНО: если ошибка "relation public.alias_games does not exist" — нужно
-- предварительно применить 041_alias.sql (он создаёт таблицы Alias).
-- ============================================================

-- ---------- 1. CHESS: DELETE policy ----------
-- Удалить может только создатель игры (или админ через супаpermissions).
DROP POLICY IF EXISTS chess_games_delete ON public.chess_games;
CREATE POLICY chess_games_delete ON public.chess_games
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- ---------- 2. MAFIA: DELETE policy ----------
DROP POLICY IF EXISTS mafia_games_delete ON public.mafia_games;
CREATE POLICY mafia_games_delete ON public.mafia_games
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- ---------- 3. CHESS: пересоздаём chess_create_game ----------
-- Если в БД осталась старая версия без поддержки 4p — пересоздаём её
-- с правильной сигнатурой и валидацией, дающей внятную ошибку.
CREATE OR REPLACE FUNCTION public.chess_create_game(
  name_param TEXT,
  mode_param TEXT DEFAULT 'classic_2p',
  time_control_param TEXT DEFAULT 'unlimited',
  team_mode_param TEXT DEFAULT 'free_for_all'
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  game_id UUID;
  initial_time INTEGER;
  initial_turn TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(name_param)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF mode_param NOT IN ('classic_2p', 'cross_4p', 'bughouse_4p') THEN
    RAISE EXCEPTION 'Invalid mode: %', mode_param;
  END IF;
  IF team_mode_param NOT IN ('free_for_all', 'teams_2v2') THEN
    RAISE EXCEPTION 'Invalid team_mode: %', team_mode_param;
  END IF;

  initial_time := public.chess_time_control_ms(time_control_param);
  initial_turn := CASE WHEN mode_param = 'cross_4p' THEN 'R' ELSE 'white' END;

  INSERT INTO public.chess_games (
    name, mode, time_control, team_mode, created_by,
    white_time_ms, black_time_ms,
    red_time_ms, blue_time_ms, yellow_time_ms, green_time_ms,
    current_turn
  ) VALUES (
    trim(name_param), mode_param, time_control_param,
    CASE WHEN mode_param = 'cross_4p' THEN team_mode_param ELSE 'free_for_all' END,
    uid,
    initial_time, initial_time,
    initial_time, initial_time, initial_time, initial_time,
    initial_turn
  )
  RETURNING id INTO game_id;

  RETURN game_id;
END;
$$;
