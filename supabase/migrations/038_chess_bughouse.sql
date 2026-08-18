-- ============================================================
-- 038_chess_bughouse.sql — v50 Bughouse 2v2 (тандем)
-- Две доски, 4 игрока в командах. Съеденные фигуры передаются партнёру в drop pool.
-- ============================================================

-- 1. Расширяем chess_games для bughouse
ALTER TABLE public.chess_games
  ADD COLUMN IF NOT EXISTS partner_game_id UUID REFERENCES public.chess_games(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bughouse_match_id UUID,
  ADD COLUMN IF NOT EXISTS white_drop_pool JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS black_drop_pool JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS board_number INT;

CREATE INDEX IF NOT EXISTS idx_chess_games_bughouse ON public.chess_games(bughouse_match_id);

-- 2. RPC: создать bughouse матч (две связанные доски сразу)
CREATE OR REPLACE FUNCTION public.chess_bughouse_create_match(
  name_param TEXT,
  time_control_param TEXT DEFAULT 'blitz_5'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  match_id UUID := gen_random_uuid();
  board1_id UUID;
  board2_id UUID;
  initial_time INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(name_param)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;

  initial_time := public.chess_time_control_ms(time_control_param);

  -- Доска 1
  INSERT INTO public.chess_games (
    name, mode, team_mode, time_control, created_by,
    white_time_ms, black_time_ms,
    current_turn,
    bughouse_match_id, board_number,
    white_drop_pool, black_drop_pool
  ) VALUES (
    trim(name_param) || ' · Доска 1', 'bughouse_4p', 'teams_2v2', time_control_param, uid,
    initial_time, initial_time,
    'white',
    match_id, 1,
    '[]'::JSONB, '[]'::JSONB
  ) RETURNING id INTO board1_id;

  -- Доска 2
  INSERT INTO public.chess_games (
    name, mode, team_mode, time_control, created_by,
    white_time_ms, black_time_ms,
    current_turn,
    bughouse_match_id, board_number, partner_game_id,
    white_drop_pool, black_drop_pool
  ) VALUES (
    trim(name_param) || ' · Доска 2', 'bughouse_4p', 'teams_2v2', time_control_param, uid,
    initial_time, initial_time,
    'white',
    match_id, 2, board1_id,
    '[]'::JSONB, '[]'::JSONB
  ) RETURNING id INTO board2_id;

  -- Связываем обратно (board1 -> board2)
  UPDATE public.chess_games SET partner_game_id = board2_id WHERE id = board1_id;

  RETURN jsonb_build_object('ok', true, 'match_id', match_id, 'board1_id', board1_id, 'board2_id', board2_id);
END;
$$;

-- 3. RPC: сесть за место в bughouse
-- color_param: 'white' или 'black'
-- board_param: 1 или 2
CREATE OR REPLACE FUNCTION public.chess_bughouse_sit_down(
  match_id_param UUID,
  board_param INT,
  color_param TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  target_game RECORD;
  all_4_seated BOOLEAN;
  b1 RECORD;
  b2 RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF color_param NOT IN ('white', 'black') THEN RAISE EXCEPTION 'Invalid color'; END IF;
  IF board_param NOT IN (1, 2) THEN RAISE EXCEPTION 'Invalid board'; END IF;

  -- Получаем целевую доску
  SELECT * INTO target_game FROM public.chess_games
    WHERE bughouse_match_id = match_id_param AND board_number = board_param
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Board not found'; END IF;
  IF target_game.status <> 'waiting' THEN RAISE EXCEPTION 'Match already started'; END IF;

  -- Игрок не должен быть уже в этом матче
  SELECT * INTO b1 FROM public.chess_games WHERE bughouse_match_id = match_id_param AND board_number = 1;
  SELECT * INTO b2 FROM public.chess_games WHERE bughouse_match_id = match_id_param AND board_number = 2;

  IF (b1.white_player_id = uid OR b1.black_player_id = uid OR b2.white_player_id = uid OR b2.black_player_id = uid) THEN
    RAISE EXCEPTION 'You are already seated in this match';
  END IF;

  -- Сажаем
  IF color_param = 'white' THEN
    IF target_game.white_player_id IS NOT NULL THEN RAISE EXCEPTION 'Seat taken'; END IF;
    UPDATE public.chess_games SET white_player_id = uid WHERE id = target_game.id;
  ELSE
    IF target_game.black_player_id IS NOT NULL THEN RAISE EXCEPTION 'Seat taken'; END IF;
    UPDATE public.chess_games SET black_player_id = uid WHERE id = target_game.id;
  END IF;

  -- Проверяем — все 4 места заняты?
  SELECT * INTO b1 FROM public.chess_games WHERE bughouse_match_id = match_id_param AND board_number = 1;
  SELECT * INTO b2 FROM public.chess_games WHERE bughouse_match_id = match_id_param AND board_number = 2;

  all_4_seated := b1.white_player_id IS NOT NULL AND b1.black_player_id IS NOT NULL
              AND b2.white_player_id IS NOT NULL AND b2.black_player_id IS NOT NULL;

  IF all_4_seated THEN
    UPDATE public.chess_games SET
      status = 'playing',
      started_at = NOW(),
      last_move_at = NOW()
    WHERE bughouse_match_id = match_id_param;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. RPC: встать с bughouse (только в waiting)
CREATE OR REPLACE FUNCTION public.chess_bughouse_stand_up(match_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  any_started BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT bool_or(status <> 'waiting') INTO any_started
    FROM public.chess_games WHERE bughouse_match_id = match_id_param;
  IF any_started THEN RAISE EXCEPTION 'Cannot leave running match'; END IF;

  UPDATE public.chess_games
    SET white_player_id = CASE WHEN white_player_id = uid THEN NULL ELSE white_player_id END,
        black_player_id = CASE WHEN black_player_id = uid THEN NULL ELSE black_player_id END
    WHERE bughouse_match_id = match_id_param;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5. RPC: сделать ход в bughouse (обычный ход с captured фигурой)
-- captured_param — тип фигуры если что-то съели ('P','N','B','R','Q'), иначе NULL
CREATE OR REPLACE FUNCTION public.chess_bughouse_make_move(
  game_id_param UUID,
  from_square_param TEXT,
  to_square_param TEXT,
  promotion_param TEXT,
  san_param TEXT,
  fen_after_param TEXT,
  captured_param TEXT,
  is_checkmate_param BOOLEAN,
  is_stalemate_param BOOLEAN
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  partner RECORD;
  player_color TEXT;
  partner_color TEXT;
  next_turn TEXT;
  elapsed_ms INTEGER;
  remaining_white INTEGER;
  remaining_black INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.mode <> 'bughouse_4p' THEN RAISE EXCEPTION 'Not bughouse'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Game not playing'; END IF;

  IF g.white_player_id = uid AND g.current_turn = 'white' THEN player_color := 'white';
  ELSIF g.black_player_id = uid AND g.current_turn = 'black' THEN player_color := 'black';
  ELSE RAISE EXCEPTION 'Not your turn';
  END IF;

  -- Расчёт времени
  remaining_white := g.white_time_ms;
  remaining_black := g.black_time_ms;
  IF g.time_control <> 'unlimited' AND g.last_move_at IS NOT NULL THEN
    elapsed_ms := EXTRACT(EPOCH FROM (NOW() - g.last_move_at)) * 1000;
    IF player_color = 'white' THEN
      remaining_white := GREATEST(0, COALESCE(remaining_white, 0) - elapsed_ms);
    ELSE
      remaining_black := GREATEST(0, COALESCE(remaining_black, 0) - elapsed_ms);
    END IF;
  END IF;

  next_turn := CASE WHEN player_color = 'white' THEN 'black' ELSE 'white' END;

  -- Сохраняем ход
  INSERT INTO public.chess_moves (
    game_id, move_number, player_color, san,
    from_square, to_square, promotion, fen_after, time_ms
  ) VALUES (
    game_id_param, g.move_number, player_color, san_param,
    from_square_param, to_square_param, promotion_param, fen_after_param,
    CASE WHEN player_color = 'white' THEN remaining_white ELSE remaining_black END
  );

  -- Обновляем игру
  UPDATE public.chess_games SET
    fen = fen_after_param,
    current_turn = next_turn,
    move_number = CASE WHEN player_color = 'black' THEN g.move_number + 1 ELSE g.move_number END,
    white_time_ms = remaining_white,
    black_time_ms = remaining_black,
    last_move_at = NOW()
  WHERE id = game_id_param;

  -- Если съели фигуру — передаём партнёру в его drop pool
  -- Партнёр играет ПРОТИВОПОЛОЖНЫМ цветом на партнёрской доске
  IF captured_param IS NOT NULL THEN
    SELECT * INTO partner FROM public.chess_games WHERE id = g.partner_game_id;
    IF FOUND THEN
      -- Я играю player_color. Мой партнёр на партнёрской доске играет противоположным цветом.
      -- Captured фигура была цвета next_turn (противника). Партнёр получает её в свой drop pool.
      -- Drop pool партнёра — это пул фигур его цвета (потому что фигуры сохраняют принадлежность к цвету для placement)
      partner_color := player_color; -- партнёр играет моим цветом (наоборот того с кем я играю)
      IF partner_color = 'white' THEN
        UPDATE public.chess_games
          SET white_drop_pool = white_drop_pool || jsonb_build_array(captured_param)
          WHERE id = partner.id;
      ELSE
        UPDATE public.chess_games
          SET black_drop_pool = black_drop_pool || jsonb_build_array(captured_param)
          WHERE id = partner.id;
      END IF;
    END IF;
  END IF;

  -- Если мат — заканчиваем ОБА стола (выигрывает команда сделавшего мат)
  IF is_checkmate_param OR is_stalemate_param THEN
    PERFORM public.chess_bughouse_finalize(g.bughouse_match_id, game_id_param, player_color, CASE WHEN is_checkmate_param THEN 'checkmate' ELSE 'stalemate' END);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 6. RPC: дроп фигуры из pool
CREATE OR REPLACE FUNCTION public.chess_bughouse_drop(
  game_id_param UUID,
  piece_type_param TEXT,
  to_square_param TEXT,
  san_param TEXT,
  fen_after_param TEXT,
  is_checkmate_param BOOLEAN,
  is_stalemate_param BOOLEAN
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  player_color TEXT;
  next_turn TEXT;
  pool JSONB;
  pool_idx INT;
  found_idx INT := -1;
  i INT;
  elapsed_ms INTEGER;
  remaining_white INTEGER;
  remaining_black INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF piece_type_param NOT IN ('P','N','B','R','Q') THEN RAISE EXCEPTION 'Invalid piece'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.mode <> 'bughouse_4p' THEN RAISE EXCEPTION 'Not bughouse'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Game not playing'; END IF;

  IF g.white_player_id = uid AND g.current_turn = 'white' THEN player_color := 'white';
  ELSIF g.black_player_id = uid AND g.current_turn = 'black' THEN player_color := 'black';
  ELSE RAISE EXCEPTION 'Not your turn';
  END IF;

  pool := CASE WHEN player_color = 'white' THEN g.white_drop_pool ELSE g.black_drop_pool END;

  -- Поищем piece в pool и удалим его
  FOR i IN 0..(jsonb_array_length(pool) - 1) LOOP
    IF (pool->>i) = piece_type_param THEN
      found_idx := i;
      EXIT;
    END IF;
  END LOOP;
  IF found_idx = -1 THEN RAISE EXCEPTION 'Piece not in your pool'; END IF;

  pool := pool - found_idx;

  -- Время
  remaining_white := g.white_time_ms;
  remaining_black := g.black_time_ms;
  IF g.time_control <> 'unlimited' AND g.last_move_at IS NOT NULL THEN
    elapsed_ms := EXTRACT(EPOCH FROM (NOW() - g.last_move_at)) * 1000;
    IF player_color = 'white' THEN remaining_white := GREATEST(0, COALESCE(remaining_white, 0) - elapsed_ms);
    ELSE remaining_black := GREATEST(0, COALESCE(remaining_black, 0) - elapsed_ms);
    END IF;
  END IF;

  next_turn := CASE WHEN player_color = 'white' THEN 'black' ELSE 'white' END;

  -- Сохраняем ход (как drop)
  INSERT INTO public.chess_moves (
    game_id, move_number, player_color, san,
    from_square, to_square, fen_after, time_ms
  ) VALUES (
    game_id_param, g.move_number, player_color, san_param,
    '@'||piece_type_param, to_square_param, fen_after_param,
    CASE WHEN player_color = 'white' THEN remaining_white ELSE remaining_black END
  );

  -- Обновляем game
  UPDATE public.chess_games SET
    fen = fen_after_param,
    current_turn = next_turn,
    move_number = CASE WHEN player_color = 'black' THEN g.move_number + 1 ELSE g.move_number END,
    white_drop_pool = CASE WHEN player_color = 'white' THEN pool ELSE g.white_drop_pool END,
    black_drop_pool = CASE WHEN player_color = 'black' THEN pool ELSE g.black_drop_pool END,
    white_time_ms = remaining_white,
    black_time_ms = remaining_black,
    last_move_at = NOW()
  WHERE id = game_id_param;

  -- Мат/пат
  IF is_checkmate_param OR is_stalemate_param THEN
    PERFORM public.chess_bughouse_finalize(g.bughouse_match_id, game_id_param, player_color, CASE WHEN is_checkmate_param THEN 'checkmate' ELSE 'stalemate' END);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. RPC: финализация матча (заканчиваем обе доски разом)
-- winning_color_param — цвет ПОБЕДИТЕЛЯ на доске где случился мат
-- losing_board_id — id доски где случился мат
CREATE OR REPLACE FUNCTION public.chess_bughouse_finalize(
  match_id_param UUID,
  losing_board_id UUID,
  winning_color_param TEXT,
  reason_param TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  b1 RECORD;
  b2 RECORD;
  team_a_won BOOLEAN;
  -- Команда A = доска 1 белые + доска 2 чёрные
  -- Команда B = доска 1 чёрные + доска 2 белые
BEGIN
  SELECT * INTO b1 FROM public.chess_games WHERE bughouse_match_id = match_id_param AND board_number = 1;
  SELECT * INTO b2 FROM public.chess_games WHERE bughouse_match_id = match_id_param AND board_number = 2;

  IF b1.status = 'finished' THEN RETURN; END IF;

  -- Определяем какая команда выиграла
  -- Победитель на losing_board проиграл (нет — winning_color_param это тот кто СДЕЛАЛ МАТ)
  IF losing_board_id = b1.id THEN
    IF winning_color_param = 'white' THEN team_a_won := TRUE; -- белые на доске 1 это команда A
    ELSE team_a_won := FALSE;
    END IF;
  ELSE
    -- Доска 2
    IF winning_color_param = 'white' THEN team_a_won := FALSE; -- белые на доске 2 это команда B
    ELSE team_a_won := TRUE;
    END IF;
  END IF;

  -- Обновляем обе доски
  -- Доска 1: результат с точки зрения этой доски
  UPDATE public.chess_games SET
    status = 'finished',
    result = CASE WHEN team_a_won THEN '1-0' ELSE '0-1' END, -- белые на доске 1 = команда А
    end_reason = reason_param,
    winner_id = CASE WHEN team_a_won THEN b1.white_player_id ELSE b1.black_player_id END,
    finished_at = NOW()
  WHERE id = b1.id;

  -- Доска 2: цвета зеркальные относительно команды
  UPDATE public.chess_games SET
    status = 'finished',
    result = CASE WHEN team_a_won THEN '0-1' ELSE '1-0' END, -- чёрные на доске 2 = команда А
    end_reason = reason_param,
    winner_id = CASE WHEN team_a_won THEN b2.black_player_id ELSE b2.white_player_id END,
    finished_at = NOW()
  WHERE id = b2.id;
END;
$$;

-- 8. RPC: сдаться в bughouse (твоя команда проигрывает)
CREATE OR REPLACE FUNCTION public.chess_bughouse_resign(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  my_color TEXT;
  winning_color TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.mode <> 'bughouse_4p' THEN RAISE EXCEPTION 'Not bughouse'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Game not playing'; END IF;

  IF g.white_player_id = uid THEN my_color := 'white';
  ELSIF g.black_player_id = uid THEN my_color := 'black';
  ELSE RAISE EXCEPTION 'Not a player';
  END IF;

  winning_color := CASE WHEN my_color = 'white' THEN 'black' ELSE 'white' END;

  PERFORM public.chess_bughouse_finalize(g.bughouse_match_id, game_id_param, winning_color, 'resignation');

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.chess_bughouse_create_match(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_bughouse_sit_down(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_bughouse_stand_up(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_bughouse_make_move(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_bughouse_drop(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_bughouse_resign(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_bughouse_finalize(UUID, UUID, TEXT, TEXT) TO authenticated;

-- DONE
