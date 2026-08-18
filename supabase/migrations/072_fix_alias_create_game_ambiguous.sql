-- ============================================================
-- 072_fix_alias_create_game_ambiguous.sql
-- Фикс: в alias_create_game была локальная переменная `game_id UUID`,
-- которая конфликтовала с колонкой `alias_teams.game_id` в INSERT-loop.
-- Postgres падал с: «column reference "game_id" is ambiguous».
-- Переименовываем локальную переменную в `v_game_id`.
-- ============================================================

CREATE OR REPLACE FUNCTION public.alias_create_game(
  name_param TEXT,
  min_teams_param INT DEFAULT 2,
  max_teams_param INT DEFAULT 4,
  min_team_size_param INT DEFAULT 2,
  max_team_size_param INT DEFAULT 5,
  round_seconds_param INT DEFAULT 60,
  win_condition_type_param TEXT DEFAULT 'score',
  win_condition_value_param INT DEFAULT 30,
  difficulty_param SMALLINT DEFAULT 2,
  buy_in_coins_param BIGINT DEFAULT 0,
  miss_penalty_param INT DEFAULT 1
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  v_game_id UUID;
  team_colors TEXT[] := ARRAY['#dc2626', '#2563eb', '#16a34a', '#eab308', '#a855f7', '#ec4899'];
  i INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(name_param)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF win_condition_type_param NOT IN ('score', 'rounds') THEN RAISE EXCEPTION 'Invalid win condition'; END IF;
  IF min_teams_param > max_teams_param THEN RAISE EXCEPTION 'min_teams > max_teams'; END IF;
  IF min_team_size_param > max_team_size_param THEN RAISE EXCEPTION 'min_team_size > max_team_size'; END IF;

  INSERT INTO public.alias_games (
    name, host_user_id,
    min_teams, max_teams, min_team_size, max_team_size,
    round_seconds, win_condition_type, win_condition_value,
    difficulty, buy_in_coins, miss_penalty
  ) VALUES (
    trim(name_param), uid,
    min_teams_param, max_teams_param, min_team_size_param, max_team_size_param,
    round_seconds_param, win_condition_type_param, win_condition_value_param,
    difficulty_param, buy_in_coins_param, miss_penalty_param
  ) RETURNING id INTO v_game_id;

  -- Создаём пустые команды по max_teams
  FOR i IN 1..max_teams_param LOOP
    INSERT INTO public.alias_teams (game_id, team_number, name, color)
    VALUES (v_game_id, i, 'Команда ' || i, team_colors[((i-1) % array_length(team_colors,1)) + 1]);
  END LOOP;

  RETURN v_game_id;
END;
$$;
