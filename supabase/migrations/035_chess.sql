-- ============================================================
-- 035_chess.sql — v48 SHACHMATY: 2-игрока классика + фундамент для 4p и Bughouse
-- ============================================================

-- 1. ELO в профиле
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS chess_elo INTEGER NOT NULL DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS chess_games_played INTEGER NOT NULL DEFAULT 0;

-- 2. Партии шахмат
CREATE TABLE IF NOT EXISTS public.chess_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'classic_2p' CHECK (mode IN ('classic_2p', 'cross_4p', 'bughouse_4p')),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Время
  time_control TEXT NOT NULL DEFAULT 'unlimited' CHECK (time_control IN ('bullet_1', 'blitz_3', 'blitz_5', 'rapid_10', 'rapid_15', 'unlimited')),
  white_time_ms INTEGER,
  black_time_ms INTEGER,
  last_move_at TIMESTAMPTZ,

  -- Игроки (для classic_2p)
  white_player_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  black_player_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Состояние партии
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'aborted')),
  fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn TEXT NOT NULL DEFAULT '',
  current_turn TEXT NOT NULL DEFAULT 'white' CHECK (current_turn IN ('white', 'black', 'red', 'yellow')),
  move_number INTEGER NOT NULL DEFAULT 1,

  -- Предложение ничьи
  draw_offer_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Результат
  result TEXT CHECK (result IN ('1-0', '0-1', '1/2-1/2', 'aborted')),
  winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  end_reason TEXT CHECK (end_reason IN ('checkmate', 'stalemate', 'resignation', 'timeout', 'draw_agreed', 'threefold_repetition', 'fifty_move_rule', 'insufficient_material', 'aborted')),

  -- Elo
  white_elo_before INTEGER,
  black_elo_before INTEGER,
  white_elo_after INTEGER,
  black_elo_after INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chess_games_status ON public.chess_games(status);
CREATE INDEX IF NOT EXISTS idx_chess_games_white ON public.chess_games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_chess_games_black ON public.chess_games(black_player_id);

-- 3. Зрители
CREATE TABLE IF NOT EXISTS public.chess_spectators (
  game_id UUID NOT NULL REFERENCES public.chess_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, user_id)
);

-- 4. Ходы (для истории, реплея, антирчита)
CREATE TABLE IF NOT EXISTS public.chess_moves (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.chess_games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  player_color TEXT NOT NULL,
  san TEXT NOT NULL,
  from_square TEXT NOT NULL,
  to_square TEXT NOT NULL,
  promotion TEXT,
  fen_after TEXT NOT NULL,
  time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chess_moves_game ON public.chess_moves(game_id, move_number);

-- 5. RLS
ALTER TABLE public.chess_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_spectators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_moves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chess_games_select ON public.chess_games;
CREATE POLICY chess_games_select ON public.chess_games FOR SELECT USING (true);

DROP POLICY IF EXISTS chess_games_insert ON public.chess_games;
CREATE POLICY chess_games_insert ON public.chess_games FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS chess_games_update ON public.chess_games;
CREATE POLICY chess_games_update ON public.chess_games FOR UPDATE USING (
  auth.uid() = white_player_id OR auth.uid() = black_player_id OR auth.uid() = created_by
);

DROP POLICY IF EXISTS chess_spectators_select ON public.chess_spectators;
CREATE POLICY chess_spectators_select ON public.chess_spectators FOR SELECT USING (true);

DROP POLICY IF EXISTS chess_spectators_insert ON public.chess_spectators;
CREATE POLICY chess_spectators_insert ON public.chess_spectators FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS chess_spectators_delete ON public.chess_spectators;
CREATE POLICY chess_spectators_delete ON public.chess_spectators FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS chess_moves_select ON public.chess_moves;
CREATE POLICY chess_moves_select ON public.chess_moves FOR SELECT USING (true);

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_spectators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_moves;

-- 7. Time control в миллисекунды
CREATE OR REPLACE FUNCTION public.chess_time_control_ms(tc TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE tc
    WHEN 'bullet_1' THEN 60000
    WHEN 'blitz_3' THEN 180000
    WHEN 'blitz_5' THEN 300000
    WHEN 'rapid_10' THEN 600000
    WHEN 'rapid_15' THEN 900000
    ELSE NULL
  END;
$$;

-- 8. RPC: создать стол
CREATE OR REPLACE FUNCTION public.chess_create_game(
  name_param TEXT,
  mode_param TEXT DEFAULT 'classic_2p',
  time_control_param TEXT DEFAULT 'unlimited'
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  game_id UUID;
  initial_time INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(name_param)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF mode_param NOT IN ('classic_2p', 'cross_4p', 'bughouse_4p') THEN RAISE EXCEPTION 'Invalid mode'; END IF;

  initial_time := public.chess_time_control_ms(time_control_param);

  INSERT INTO public.chess_games (
    name, mode, time_control, created_by,
    white_time_ms, black_time_ms
  ) VALUES (
    trim(name_param), mode_param, time_control_param, uid,
    initial_time, initial_time
  )
  RETURNING id INTO game_id;

  RETURN game_id;
END;
$$;

-- 9. RPC: сесть за цвет (white/black)
CREATE OR REPLACE FUNCTION public.chess_sit_down(
  game_id_param UUID,
  color_param TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF color_param NOT IN ('white', 'black') THEN RAISE EXCEPTION 'Invalid color'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'waiting' THEN RAISE EXCEPTION 'Game already started'; END IF;
  IF g.mode <> 'classic_2p' THEN RAISE EXCEPTION 'Only classic_2p supported in v48'; END IF;

  -- Не дать сесть на оба места
  IF (g.white_player_id = uid AND color_param = 'black') OR (g.black_player_id = uid AND color_param = 'white') THEN
    RAISE EXCEPTION 'You already taken the other color';
  END IF;

  IF color_param = 'white' THEN
    IF g.white_player_id IS NOT NULL AND g.white_player_id <> uid THEN RAISE EXCEPTION 'White seat taken'; END IF;
    UPDATE public.chess_games SET white_player_id = uid WHERE id = game_id_param;
  ELSE
    IF g.black_player_id IS NOT NULL AND g.black_player_id <> uid THEN RAISE EXCEPTION 'Black seat taken'; END IF;
    UPDATE public.chess_games SET black_player_id = uid WHERE id = game_id_param;
  END IF;

  -- Если оба сидят — старт партии
  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param;
  IF g.white_player_id IS NOT NULL AND g.black_player_id IS NOT NULL THEN
    UPDATE public.chess_games SET
      status = 'playing',
      started_at = NOW(),
      last_move_at = NOW(),
      white_elo_before = (SELECT chess_elo FROM public.users WHERE id = g.white_player_id),
      black_elo_before = (SELECT chess_elo FROM public.users WHERE id = g.black_player_id)
    WHERE id = game_id_param;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 10. RPC: встать со стола
CREATE OR REPLACE FUNCTION public.chess_stand_up(game_id_param UUID)
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

  IF g.white_player_id = uid THEN
    UPDATE public.chess_games SET white_player_id = NULL WHERE id = game_id_param;
  ELSIF g.black_player_id = uid THEN
    UPDATE public.chess_games SET black_player_id = NULL WHERE id = game_id_param;
  ELSE
    RAISE EXCEPTION 'Not seated';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 11. RPC: записать ход (валидация на клиенте через chess.js, тут просто сохраняем)
CREATE OR REPLACE FUNCTION public.chess_make_move(
  game_id_param UUID,
  from_square_param TEXT,
  to_square_param TEXT,
  promotion_param TEXT,
  san_param TEXT,
  fen_after_param TEXT,
  pgn_after_param TEXT,
  is_checkmate_param BOOLEAN,
  is_stalemate_param BOOLEAN,
  is_draw_param BOOLEAN,
  is_threefold_param BOOLEAN,
  is_insufficient_param BOOLEAN
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  player_color TEXT;
  next_turn TEXT;
  initial_time INTEGER;
  elapsed_ms INTEGER;
  remaining_white INTEGER;
  remaining_black INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Game not in playing state'; END IF;

  -- Чей ход
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

  -- Обновляем партию
  UPDATE public.chess_games SET
    fen = fen_after_param,
    pgn = pgn_after_param,
    current_turn = next_turn,
    move_number = CASE WHEN player_color = 'black' THEN g.move_number + 1 ELSE g.move_number END,
    white_time_ms = remaining_white,
    black_time_ms = remaining_black,
    last_move_at = NOW(),
    -- Сбрасываем предложение ничьи при ходе
    draw_offer_by = NULL
  WHERE id = game_id_param;

  -- Проверка завершения партии
  IF is_checkmate_param THEN
    PERFORM public.chess_finalize_game(
      game_id_param,
      CASE WHEN player_color = 'white' THEN '1-0' ELSE '0-1' END,
      'checkmate',
      CASE WHEN player_color = 'white' THEN g.white_player_id ELSE g.black_player_id END
    );
  ELSIF is_stalemate_param THEN
    PERFORM public.chess_finalize_game(game_id_param, '1/2-1/2', 'stalemate', NULL);
  ELSIF is_threefold_param THEN
    PERFORM public.chess_finalize_game(game_id_param, '1/2-1/2', 'threefold_repetition', NULL);
  ELSIF is_insufficient_param THEN
    PERFORM public.chess_finalize_game(game_id_param, '1/2-1/2', 'insufficient_material', NULL);
  ELSIF is_draw_param THEN
    PERFORM public.chess_finalize_game(game_id_param, '1/2-1/2', 'fifty_move_rule', NULL);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 12. RPC: финализация партии (внутренняя)
CREATE OR REPLACE FUNCTION public.chess_finalize_game(
  game_id_param UUID,
  result_param TEXT,
  reason_param TEXT,
  winner_id_param UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g RECORD;
  k_white INTEGER;
  k_black INTEGER;
  expected_white NUMERIC;
  expected_black NUMERIC;
  score_white NUMERIC;
  score_black NUMERIC;
  new_white_elo INTEGER;
  new_black_elo INTEGER;
BEGIN
  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF g.status = 'finished' THEN RETURN; END IF;

  -- Расчёт Elo (стандартная формула)
  k_white := CASE WHEN (SELECT chess_games_played FROM public.users WHERE id = g.white_player_id) < 30 THEN 32 ELSE 16 END;
  k_black := CASE WHEN (SELECT chess_games_played FROM public.users WHERE id = g.black_player_id) < 30 THEN 32 ELSE 16 END;

  expected_white := 1.0 / (1.0 + POWER(10, (g.black_elo_before - g.white_elo_before)::NUMERIC / 400.0));
  expected_black := 1.0 / (1.0 + POWER(10, (g.white_elo_before - g.black_elo_before)::NUMERIC / 400.0));

  IF result_param = '1-0' THEN
    score_white := 1; score_black := 0;
  ELSIF result_param = '0-1' THEN
    score_white := 0; score_black := 1;
  ELSE
    score_white := 0.5; score_black := 0.5;
  END IF;

  new_white_elo := g.white_elo_before + ROUND(k_white * (score_white - expected_white));
  new_black_elo := g.black_elo_before + ROUND(k_black * (score_black - expected_black));

  -- Обновляем профили
  IF g.white_player_id IS NOT NULL THEN
    UPDATE public.users SET chess_elo = new_white_elo, chess_games_played = chess_games_played + 1
      WHERE id = g.white_player_id;
  END IF;
  IF g.black_player_id IS NOT NULL THEN
    UPDATE public.users SET chess_elo = new_black_elo, chess_games_played = chess_games_played + 1
      WHERE id = g.black_player_id;
  END IF;

  UPDATE public.chess_games SET
    status = 'finished',
    result = result_param,
    end_reason = reason_param,
    winner_id = winner_id_param,
    white_elo_after = new_white_elo,
    black_elo_after = new_black_elo,
    finished_at = NOW()
  WHERE id = game_id_param;
END;
$$;

-- 13. RPC: сдаться
CREATE OR REPLACE FUNCTION public.chess_resign(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  result_str TEXT;
  winner_uid UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Game not playing'; END IF;

  IF g.white_player_id = uid THEN
    result_str := '0-1'; winner_uid := g.black_player_id;
  ELSIF g.black_player_id = uid THEN
    result_str := '1-0'; winner_uid := g.white_player_id;
  ELSE
    RAISE EXCEPTION 'Not a player';
  END IF;

  PERFORM public.chess_finalize_game(game_id_param, result_str, 'resignation', winner_uid);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 14. RPC: предложить ничью
CREATE OR REPLACE FUNCTION public.chess_offer_draw(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Game not playing'; END IF;
  IF uid <> g.white_player_id AND uid <> g.black_player_id THEN RAISE EXCEPTION 'Not a player'; END IF;

  UPDATE public.chess_games SET draw_offer_by = uid WHERE id = game_id_param;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 15. RPC: принять/отклонить ничью
CREATE OR REPLACE FUNCTION public.chess_respond_draw(
  game_id_param UUID,
  accept_param BOOLEAN
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Game not playing'; END IF;
  IF g.draw_offer_by IS NULL THEN RAISE EXCEPTION 'No draw offer'; END IF;
  IF g.draw_offer_by = uid THEN RAISE EXCEPTION 'Cannot respond to own offer'; END IF;
  IF uid <> g.white_player_id AND uid <> g.black_player_id THEN RAISE EXCEPTION 'Not a player'; END IF;

  IF accept_param THEN
    PERFORM public.chess_finalize_game(game_id_param, '1/2-1/2', 'draw_agreed', NULL);
  ELSE
    UPDATE public.chess_games SET draw_offer_by = NULL WHERE id = game_id_param;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 16. RPC: тайм-аут (вызывается клиентом когда видит что время истекло)
CREATE OR REPLACE FUNCTION public.chess_force_timeout(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g RECORD;
  loser_color TEXT;
  result_str TEXT;
  winner_uid UUID;
  remaining_white INTEGER;
  remaining_black INTEGER;
  elapsed_ms INTEGER;
BEGIN
  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' THEN RETURN jsonb_build_object('ok', false); END IF;
  IF g.time_control = 'unlimited' THEN RETURN jsonb_build_object('ok', false); END IF;

  remaining_white := g.white_time_ms;
  remaining_black := g.black_time_ms;
  IF g.last_move_at IS NOT NULL THEN
    elapsed_ms := EXTRACT(EPOCH FROM (NOW() - g.last_move_at)) * 1000;
    IF g.current_turn = 'white' THEN
      remaining_white := GREATEST(0, COALESCE(remaining_white, 0) - elapsed_ms);
    ELSE
      remaining_black := GREATEST(0, COALESCE(remaining_black, 0) - elapsed_ms);
    END IF;
  END IF;

  IF remaining_white <= 0 THEN
    loser_color := 'white'; result_str := '0-1'; winner_uid := g.black_player_id;
  ELSIF remaining_black <= 0 THEN
    loser_color := 'black'; result_str := '1-0'; winner_uid := g.white_player_id;
  ELSE
    RETURN jsonb_build_object('ok', false);
  END IF;

  PERFORM public.chess_finalize_game(game_id_param, result_str, 'timeout', winner_uid);
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.chess_create_game(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_sit_down(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_stand_up(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_make_move(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_resign(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_offer_draw(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_respond_draw(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_force_timeout(UUID) TO authenticated;

-- DONE
