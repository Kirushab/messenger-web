-- ============================================================
-- 037_chess_4p_draw.sql — v49.1 Ничья в 4p + сдача с продолжением
-- ============================================================

-- 1. Поле для ответов на ничью в 4p
-- draw_responses_4p: JSONB вида {"R":"accepted","B":"declined","Y":null,"G":"accepted"}
ALTER TABLE public.chess_games
  ADD COLUMN IF NOT EXISTS draw_responses_4p JSONB;

-- 2. RPC: предложить ничью в 4p
CREATE OR REPLACE FUNCTION public.chess_4p_offer_draw(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  my_color TEXT;
  initial_responses JSONB;
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

  -- Инициатор автоматически согласен
  initial_responses := jsonb_build_object(
    'R', CASE WHEN my_color = 'R' THEN 'accepted' ELSE NULL END,
    'B', CASE WHEN my_color = 'B' THEN 'accepted' ELSE NULL END,
    'Y', CASE WHEN my_color = 'Y' THEN 'accepted' ELSE NULL END,
    'G', CASE WHEN my_color = 'G' THEN 'accepted' ELSE NULL END
  );

  UPDATE public.chess_games SET
    draw_offer_by = uid,
    draw_responses_4p = initial_responses
  WHERE id = game_id_param;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. RPC: ответить на предложение ничьи в 4p
CREATE OR REPLACE FUNCTION public.chess_4p_respond_draw(
  game_id_param UUID,
  accept_param BOOLEAN
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  my_color TEXT;
  responses JSONB;
  all_accepted BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.chess_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.mode <> 'cross_4p' THEN RAISE EXCEPTION 'Not 4p'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Game not playing'; END IF;
  IF g.draw_offer_by IS NULL THEN RAISE EXCEPTION 'No draw offer'; END IF;

  IF g.red_player_id = uid THEN my_color := 'R';
  ELSIF g.blue_player_id = uid THEN my_color := 'B';
  ELSIF g.yellow_player_id = uid THEN my_color := 'Y';
  ELSIF g.green_player_id = uid THEN my_color := 'G';
  ELSE RAISE EXCEPTION 'Not a player';
  END IF;

  IF g.draw_offer_by = uid THEN RAISE EXCEPTION 'Cannot respond to your own offer'; END IF;

  responses := COALESCE(g.draw_responses_4p, '{}'::JSONB);

  IF NOT accept_param THEN
    -- Любой отказ — отменяет предложение
    UPDATE public.chess_games SET
      draw_offer_by = NULL,
      draw_responses_4p = NULL
    WHERE id = game_id_param;
    RETURN jsonb_build_object('ok', true, 'declined', true);
  END IF;

  -- Записываем согласие
  responses := jsonb_set(responses, ARRAY[my_color], '"accepted"'::JSONB, true);

  -- Проверяем — все ли живые игроки согласны
  all_accepted := TRUE;
  IF g.red_player_id IS NOT NULL AND (responses->>'R') IS DISTINCT FROM 'accepted' THEN all_accepted := FALSE; END IF;
  IF all_accepted AND g.blue_player_id IS NOT NULL AND (responses->>'B') IS DISTINCT FROM 'accepted' THEN all_accepted := FALSE; END IF;
  IF all_accepted AND g.yellow_player_id IS NOT NULL AND (responses->>'Y') IS DISTINCT FROM 'accepted' THEN all_accepted := FALSE; END IF;
  IF all_accepted AND g.green_player_id IS NOT NULL AND (responses->>'G') IS DISTINCT FROM 'accepted' THEN all_accepted := FALSE; END IF;

  IF all_accepted THEN
    -- Финализируем как ничью
    UPDATE public.chess_games SET
      status = 'finished',
      result = '1/2-1/2',
      end_reason = 'draw_agreed',
      winner_id = NULL,
      finished_at = NOW(),
      draw_offer_by = NULL,
      draw_responses_4p = NULL
    WHERE id = game_id_param;
    RETURN jsonb_build_object('ok', true, 'drawn', true);
  ELSE
    UPDATE public.chess_games SET
      draw_responses_4p = responses
    WHERE id = game_id_param;
    RETURN jsonb_build_object('ok', true, 'pending', true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.chess_4p_offer_draw(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chess_4p_respond_draw(UUID, BOOLEAN) TO authenticated;

-- DONE
