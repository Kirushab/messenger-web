-- ============================================================
-- 036_chess_4p.sql — v49 Four-Player Chess (cross board 14x14)
-- ============================================================

-- 1. Расширяем chess_games для 4p
ALTER TABLE public.chess_games
  ADD COLUMN IF NOT EXISTS team_mode TEXT DEFAULT 'free_for_all' CHECK (team_mode IN ('free_for_all', 'teams_2v2')),
  ADD COLUMN IF NOT EXISTS red_player_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blue_player_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS yellow_player_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS green_player_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS red_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS blue_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS yellow_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS green_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS state_4p JSONB,
  ADD COLUMN IF NOT EXISTS red_elo_before INTEGER,
  ADD COLUMN IF NOT EXISTS blue_elo_before INTEGER,
  ADD COLUMN IF NOT EXISTS yellow_elo_before INTEGER,
  ADD COLUMN IF NOT EXISTS green_elo_before INTEGER,
  ADD COLUMN IF NOT EXISTS red_elo_after INTEGER,
  ADD COLUMN IF NOT EXISTS blue_elo_after INTEGER,
  ADD COLUMN IF NOT EXISTS yellow_elo_after INTEGER,
  ADD COLUMN IF NOT EXISTS green_elo_after INTEGER;

-- Drop and recreate current_turn check (we need R/B/Y/G + white/black for 2p)
ALTER TABLE public.chess_games DROP CONSTRAINT IF EXISTS chess_games_current_turn_check;
ALTER TABLE public.chess_games
  ADD CONSTRAINT chess_games_current_turn_check
  CHECK (current_turn IN ('white', 'black', 'R', 'B', 'Y', 'G'));

CREATE INDEX IF NOT EXISTS idx_chess_games_red ON public.chess_games(red_player_id);
CREATE INDEX IF NOT EXISTS idx_chess_games_blue ON public.chess_games(blue_player_id);
CREATE INDEX IF NOT EXISTS idx_chess_games_yellow ON public.chess_games(yellow_player_id);
CREATE INDEX IF NOT EXISTS idx_chess_games_green ON public.chess_games(green_player_id);

-- 2. Расширяем chess_moves для 4p (опционально color может быть R/B/Y/G)
ALTER TABLE public.chess_moves DROP CONSTRAINT IF EXISTS chess_moves_player_color_check;
-- player_color остаётся TEXT без CHECK

-- 3. Обновляем RPC create_game для 4p
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
  IF mode_param NOT IN ('classic_2p', 'cross_4p', 'bughouse_4p') THEN RAISE EXCEPTION 'Invalid mode'; END IF;
  IF team_mode_param NOT IN ('free_for_all', 'teams_2v2') THEN RAISE EXCEPTION 'Invalid team_mode'; END IF;

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

-- 4. RPC: сесть за цвет 4p
CREATE OR REPLACE FUNCTION public.chess_4p_sit_down(
  game_id_param UUID,
  color_param TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  all_seated BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF color_param NOT IN ('R', 'B', 'Y', 'G') THEN RAISE EXCEPTION 'Invalid color'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.mode <> 'cross_4p' THEN RAISE EXCEPTION 'Not a 4p game'; END IF;
  IF g.status <> 'waiting' THEN RAISE EXCEPTION 'Game already started'; END IF;

  -- Игрок не может сесть на 2+ места
  IF (g.red_player_id = uid AND color_param <> 'R')
     OR (g.blue_player_id = uid AND color_param <> 'B')
     OR (g.yellow_player_id = uid AND color_param <> 'Y')
     OR (g.green_player_id = uid AND color_param <> 'G') THEN
    RAISE EXCEPTION 'You already taken another color';
  END IF;

  IF color_param = 'R' THEN
    IF g.red_player_id IS NOT NULL AND g.red_player_id <> uid THEN RAISE EXCEPTION 'Red seat taken'; END IF;
    UPDATE public.chess_games SET red_player_id = uid WHERE id = game_id_param;
  ELSIF color_param = 'B' THEN
    IF g.blue_player_id IS NOT NULL AND g.blue_player_id <> uid THEN RAISE EXCEPTION 'Blue seat taken'; END IF;
    UPDATE public.chess_games SET blue_player_id = uid WHERE id = game_id_param;
  ELSIF color_param = 'Y' THEN
    IF g.yellow_player_id IS NOT NULL AND g.yellow_player_id <> uid THEN RAISE EXCEPTION 'Yellow seat taken'; END IF;
    UPDATE public.chess_games SET yellow_player_id = uid WHERE id = game_id_param;
  ELSE
    IF g.green_player_id IS NOT NULL AND g.green_player_id <> uid THEN RAISE EXCEPTION 'Green seat taken'; END IF;
    UPDATE public.chess_games SET green_player_id = uid WHERE id = game_id_param;
  END IF;

  -- Если все 4 сидят — старт партии
  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param;
  all_seated := g.red_player_id IS NOT NULL AND g.blue_player_id IS NOT NULL
            AND g.yellow_player_id IS NOT NULL AND g.green_player_id IS NOT NULL;

  IF all_seated THEN
    UPDATE public.chess_games SET
      status = 'playing',
      started_at = NOW(),
      last_move_at = NOW(),
      red_elo_before = (SELECT chess_elo FROM public.users WHERE id = g.red_player_id),
      blue_elo_before = (SELECT chess_elo FROM public.users WHERE id = g.blue_player_id),
      yellow_elo_before = (SELECT chess_elo FROM public.users WHERE id = g.yellow_player_id),
      green_elo_before = (SELECT chess_elo FROM public.users WHERE id = g.green_player_id)
    WHERE id = game_id_param;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5. RPC: встать с 4p
CREATE OR REPLACE FUNCTION public.chess_4p_stand_up(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'waiting' THEN RAISE EXCEPTION 'Cannot leave running game'; END IF;

  IF g.red_player_id = uid THEN UPDATE public.chess_games SET red_player_id = NULL WHERE id = game_id_param;
  ELSIF g.blue_player_id = uid THEN UPDATE public.chess_games SET blue_player_id = NULL WHERE id = game_id_param;
  ELSIF g.yellow_player_id = uid THEN UPDATE public.chess_games SET yellow_player_id = NULL WHERE id = game_id_param;
  ELSIF g.green_player_id = uid THEN UPDATE public.chess_games SET green_player_id = NULL WHERE id = game_id_param;
  ELSE RAISE EXCEPTION 'Not seated';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 6. RPC: сделать ход в 4p (валидация на клиенте, тут просто сохраняем state)
CREATE OR REPLACE FUNCTION public.chess_4p_make_move(
  game_id_param UUID,
  state_after_param JSONB,
  player_color_param TEXT,
  next_turn_param TEXT,
  from_square_param TEXT,
  to_square_param TEXT,
  is_game_over_param BOOLEAN,
  scores_param JSONB,
  alive_param JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  expected_uid UUID;
  elapsed_ms INTEGER;
  current_time_ms INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF player_color_param NOT IN ('R', 'B', 'Y', 'G') THEN RAISE EXCEPTION 'Invalid color'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.mode <> 'cross_4p' THEN RAISE EXCEPTION 'Not 4p'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Game not in playing state'; END IF;

  -- Проверка: ходит правильный игрок
  expected_uid := CASE player_color_param
    WHEN 'R' THEN g.red_player_id
    WHEN 'B' THEN g.blue_player_id
    WHEN 'Y' THEN g.yellow_player_id
    WHEN 'G' THEN g.green_player_id
  END;

  IF expected_uid <> uid THEN RAISE EXCEPTION 'Not your color'; END IF;
  IF g.current_turn <> player_color_param THEN RAISE EXCEPTION 'Not your turn'; END IF;

  -- Расчёт времени
  IF g.time_control <> 'unlimited' AND g.last_move_at IS NOT NULL THEN
    elapsed_ms := EXTRACT(EPOCH FROM (NOW() - g.last_move_at)) * 1000;
    current_time_ms := CASE player_color_param
      WHEN 'R' THEN g.red_time_ms
      WHEN 'B' THEN g.blue_time_ms
      WHEN 'Y' THEN g.yellow_time_ms
      WHEN 'G' THEN g.green_time_ms
    END;
    current_time_ms := GREATEST(0, COALESCE(current_time_ms, 0) - elapsed_ms);
  END IF;

  -- Сохраняем ход
  INSERT INTO public.chess_moves (
    game_id, move_number, player_color, san,
    from_square, to_square, promotion, fen_after, time_ms
  ) VALUES (
    game_id_param, g.move_number, player_color_param, '',
    from_square_param, to_square_param, NULL, '', current_time_ms
  );

  -- Обновляем состояние
  UPDATE public.chess_games SET
    state_4p = state_after_param,
    current_turn = next_turn_param,
    move_number = CASE WHEN player_color_param = 'G' THEN g.move_number + 1 ELSE g.move_number END,
    last_move_at = NOW(),
    red_time_ms = CASE WHEN player_color_param = 'R' THEN current_time_ms ELSE g.red_time_ms END,
    blue_time_ms = CASE WHEN player_color_param = 'B' THEN current_time_ms ELSE g.blue_time_ms END,
    yellow_time_ms = CASE WHEN player_color_param = 'Y' THEN current_time_ms ELSE g.yellow_time_ms END,
    green_time_ms = CASE WHEN player_color_param = 'G' THEN current_time_ms ELSE g.green_time_ms END,
    draw_offer_by = NULL
  WHERE id = game_id_param;

  -- Если игра окончена — финализация
  IF is_game_over_param THEN
    PERFORM public.chess_4p_finalize(game_id_param, scores_param, alive_param);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. RPC: финализация 4p (с расчётом победителей и Elo)
CREATE OR REPLACE FUNCTION public.chess_4p_finalize(
  game_id_param UUID,
  scores_param JSONB,
  alive_param JSONB
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g RECORD;
  r_score INT; b_score INT; y_score INT; g_score INT;
  r_alive BOOL; b_alive BOOL; y_alive BOOL; g_alive BOOL;
  winner_uid UUID;
  winner_color TEXT;
  team_red_yellow INT;
  team_blue_green INT;
  max_score INT;
  -- Elo (simplified for 4p: average opponents)
  avg_opp_elo NUMERIC;
  k INT;
  expected NUMERIC;
  score NUMERIC;
  new_elo INT;
BEGIN
  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF g.status = 'finished' THEN RETURN; END IF;

  r_score := COALESCE((scores_param->>'R')::INT, 0);
  b_score := COALESCE((scores_param->>'B')::INT, 0);
  y_score := COALESCE((scores_param->>'Y')::INT, 0);
  g_score := COALESCE((scores_param->>'G')::INT, 0);
  r_alive := COALESCE((alive_param->>'R')::BOOL, false);
  b_alive := COALESCE((alive_param->>'B')::BOOL, false);
  y_alive := COALESCE((alive_param->>'Y')::BOOL, false);
  g_alive := COALESCE((alive_param->>'G')::BOOL, false);

  IF g.team_mode = 'teams_2v2' THEN
    -- Партнёры: Red+Yellow vs Blue+Green
    team_red_yellow := r_score + y_score;
    team_blue_green := b_score + g_score;
    IF team_red_yellow > team_blue_green THEN
      winner_color := 'RY';
      winner_uid := g.red_player_id;  -- условный winner (любой из команды)
    ELSIF team_blue_green > team_red_yellow THEN
      winner_color := 'BG';
      winner_uid := g.blue_player_id;
    ELSE
      winner_color := 'DRAW';
      winner_uid := NULL;
    END IF;
  ELSE
    -- FFA: победитель — игрок с наивысшим очком
    max_score := GREATEST(r_score, b_score, y_score, g_score);
    IF r_score = max_score THEN winner_color := 'R'; winner_uid := g.red_player_id;
    ELSIF b_score = max_score THEN winner_color := 'B'; winner_uid := g.blue_player_id;
    ELSIF y_score = max_score THEN winner_color := 'Y'; winner_uid := g.yellow_player_id;
    ELSE winner_color := 'G'; winner_uid := g.green_player_id;
    END IF;
  END IF;

  -- Простой расчёт Elo: K=16 для опытных, K=32 для новичков; expected = 0.25, score = победитель=1, остальные=0
  -- Для 4p упрощение: победитель +K*0.75, остальные -K/3
  IF g.red_player_id IS NOT NULL THEN
    k := CASE WHEN (SELECT chess_games_played FROM public.users WHERE id = g.red_player_id) < 30 THEN 32 ELSE 16 END;
    IF g.team_mode = 'teams_2v2' THEN
      IF winner_color = 'RY' THEN new_elo := g.red_elo_before + ROUND(k * 0.5);
      ELSIF winner_color = 'BG' THEN new_elo := g.red_elo_before - ROUND(k * 0.5);
      ELSE new_elo := g.red_elo_before;
      END IF;
    ELSE
      IF winner_color = 'R' THEN new_elo := g.red_elo_before + ROUND(k * 0.75);
      ELSE new_elo := g.red_elo_before - ROUND(k / 3.0);
      END IF;
    END IF;
    UPDATE public.users SET chess_elo = new_elo, chess_games_played = chess_games_played + 1 WHERE id = g.red_player_id;
    UPDATE public.chess_games SET red_elo_after = new_elo WHERE id = game_id_param;
  END IF;

  IF g.blue_player_id IS NOT NULL THEN
    k := CASE WHEN (SELECT chess_games_played FROM public.users WHERE id = g.blue_player_id) < 30 THEN 32 ELSE 16 END;
    IF g.team_mode = 'teams_2v2' THEN
      IF winner_color = 'BG' THEN new_elo := g.blue_elo_before + ROUND(k * 0.5);
      ELSIF winner_color = 'RY' THEN new_elo := g.blue_elo_before - ROUND(k * 0.5);
      ELSE new_elo := g.blue_elo_before;
      END IF;
    ELSE
      IF winner_color = 'B' THEN new_elo := g.blue_elo_before + ROUND(k * 0.75);
      ELSE new_elo := g.blue_elo_before - ROUND(k / 3.0);
      END IF;
    END IF;
    UPDATE public.users SET chess_elo = new_elo, chess_games_played = chess_games_played + 1 WHERE id = g.blue_player_id;
    UPDATE public.chess_games SET blue_elo_after = new_elo WHERE id = game_id_param;
  END IF;

  IF g.yellow_player_id IS NOT NULL THEN
    k := CASE WHEN (SELECT chess_games_played FROM public.users WHERE id = g.yellow_player_id) < 30 THEN 32 ELSE 16 END;
    IF g.team_mode = 'teams_2v2' THEN
      IF winner_color = 'RY' THEN new_elo := g.yellow_elo_before + ROUND(k * 0.5);
      ELSIF winner_color = 'BG' THEN new_elo := g.yellow_elo_before - ROUND(k * 0.5);
      ELSE new_elo := g.yellow_elo_before;
      END IF;
    ELSE
      IF winner_color = 'Y' THEN new_elo := g.yellow_elo_before + ROUND(k * 0.75);
      ELSE new_elo := g.yellow_elo_before - ROUND(k / 3.0);
      END IF;
    END IF;
    UPDATE public.users SET chess_elo = new_elo, chess_games_played = chess_games_played + 1 WHERE id = g.yellow_player_id;
    UPDATE public.chess_games SET yellow_elo_after = new_elo WHERE id = game_id_param;
  END IF;

  IF g.green_player_id IS NOT NULL THEN
    k := CASE WHEN (SELECT chess_games_played FROM public.users WHERE id = g.green_player_id) < 30 THEN 32 ELSE 16 END;
    IF g.team_mode = 'teams_2v2' THEN
      IF winner_color = 'BG' THEN new_elo := g.green_elo_before + ROUND(k * 0.5);
      ELSIF winner_color = 'RY' THEN new_elo := g.green_elo_before - ROUND(k * 0.5);
      ELSE new_elo := g.green_elo_before;
      END IF;
    ELSE
      IF winner_color = 'G' THEN new_elo := g.green_elo_before + ROUND(k * 0.75);
      ELSE new_elo := g.green_elo_before - ROUND(k / 3.0);
      END IF;
    END IF;
    UPDATE public.users SET chess_elo = new_elo, chess_games_played = chess_games_played + 1 WHERE id = g.green_player_id;
    UPDATE public.chess_games SET green_elo_after = new_elo WHERE id = game_id_param;
  END IF;

  UPDATE public.chess_games SET
    status = 'finished',
    result = CASE winner_color WHEN 'DRAW' THEN '1/2-1/2' ELSE '1-0' END,
    end_reason = 'checkmate',
    winner_id = winner_uid,
    finished_at = NOW()
  WHERE id = game_id_param;
END;
$$;

-- 8. RPC: сдаться в 4p
CREATE OR REPLACE FUNCTION public.chess_4p_resign(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  my_color TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.mode <> 'cross_4p' THEN RAISE EXCEPTION 'Not 4p'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Game not playing'; END IF;

  IF g.red_player_id = uid THEN my_color := 'R';
  ELSIF g.blue_player_id = uid THEN my_color := 'B';
  ELSIF g.yellow_player_id = uid THEN my_color := 'Y';
  ELSIF g.green_player_id = uid THEN my_color := 'G';
  ELSE RAISE EXCEPTION 'Not a player';
  END IF;

  RETURN jsonb_build_object('ok', true, 'resigned_color', my_color);
END;
$$;

GRANT EXECUTE ON FUNCTION public.chess_create_game(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_4p_sit_down(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_4p_stand_up(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_4p_make_move(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_4p_resign(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_4p_finalize(UUID, JSONB, JSONB) TO authenticated;

-- DONE
