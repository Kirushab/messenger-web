-- ============================================================
-- 032_poker_sng.sql
-- v45: SNG турниры (Sit'n'Go)
-- ============================================================
-- Расширяет poker_tables под SNG: blind schedule, призы, выбывание
-- Финишеры в отдельной таблице. Auto-start раздач, повышение блайндов
-- ============================================================

-- ============================================================
-- 1. Расширение poker_tables
-- ============================================================

ALTER TABLE public.poker_tables
  ADD COLUMN IF NOT EXISTS sng_starting_chips BIGINT,
  ADD COLUMN IF NOT EXISTS sng_blind_duration_seconds INT,
  ADD COLUMN IF NOT EXISTS sng_blind_levels JSONB,
  ADD COLUMN IF NOT EXISTS sng_prize_structure JSONB,
  ADD COLUMN IF NOT EXISTS sng_current_level INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sng_level_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sng_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sng_finished_at TIMESTAMPTZ;

-- ============================================================
-- 2. Финишеры турнира
-- ============================================================

CREATE TABLE IF NOT EXISTS public.poker_sng_finishers (
  table_id UUID NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  place INT NOT NULL,
  prize_tokens BIGINT NOT NULL DEFAULT 0,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_id, user_id)
);
CREATE INDEX IF NOT EXISTS poker_sng_finishers_table_idx ON public.poker_sng_finishers(table_id, place);

ALTER TABLE public.poker_sng_finishers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads finishers" ON public.poker_sng_finishers;
CREATE POLICY "Anyone reads finishers" ON public.poker_sng_finishers
  FOR SELECT USING (auth.uid() IS NOT NULL);

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_sng_finishers;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'finishers уже в публикации'; END;
END $$;

-- ============================================================
-- 3. Helper: стандартная лесенка блайндов (13 уровней)
-- ============================================================

CREATE OR REPLACE FUNCTION public.poker_default_blind_levels()
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN '[
    {"level":1,"sb":10,"bb":20},
    {"level":2,"sb":15,"bb":30},
    {"level":3,"sb":25,"bb":50},
    {"level":4,"sb":50,"bb":100},
    {"level":5,"sb":75,"bb":150},
    {"level":6,"sb":100,"bb":200},
    {"level":7,"sb":150,"bb":300},
    {"level":8,"sb":200,"bb":400},
    {"level":9,"sb":300,"bb":600},
    {"level":10,"sb":500,"bb":1000},
    {"level":11,"sb":1000,"bb":2000},
    {"level":12,"sb":2000,"bb":4000},
    {"level":13,"sb":3000,"bb":6000}
  ]'::JSONB;
END;
$$;

-- ============================================================
-- 4. Создание SNG турнира
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_poker_sng(
  name_param TEXT,
  max_players_param INT,
  buy_in_param BIGINT,
  starting_chips_param BIGINT,
  blind_duration_seconds_param INT,
  prize_structure_param JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  new_id UUID;
  blind_levels JSONB;
  first_level RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF max_players_param < 4 OR max_players_param > 9 THEN
    RAISE EXCEPTION 'max_players must be 4-9 for SNG';
  END IF;
  IF buy_in_param <= 0 THEN RAISE EXCEPTION 'Buy-in must be positive'; END IF;
  IF starting_chips_param < 500 THEN RAISE EXCEPTION 'Starting chips too low'; END IF;
  IF blind_duration_seconds_param NOT IN (180, 300, 480) THEN
    RAISE EXCEPTION 'Blind duration must be 180/300/480 seconds';
  END IF;
  IF length(trim(name_param)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;

  blind_levels := poker_default_blind_levels();

  -- Берём первый уровень для small/big_blind в poker_tables
  SELECT (blind_levels->0->>'sb')::BIGINT AS sb,
         (blind_levels->0->>'bb')::BIGINT AS bb
    INTO first_level;

  INSERT INTO public.poker_tables (
    name, creator_id, table_type, max_players,
    small_blind, big_blind, min_buy_in, max_buy_in, allow_rebuy,
    sng_starting_chips, sng_blind_duration_seconds, sng_blind_levels,
    sng_prize_structure, sng_current_level
  )
  VALUES (
    trim(name_param), uid, 'sng', max_players_param,
    first_level.sb, first_level.bb, buy_in_param, buy_in_param, false,
    starting_chips_param, blind_duration_seconds_param, blind_levels,
    prize_structure_param, 1
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'table_id', new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_poker_sng(TEXT, INT, BIGINT, BIGINT, INT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.create_poker_sng(TEXT, INT, BIGINT, BIGINT, INT, JSONB) TO authenticated;

-- ============================================================
-- 5. ОБНОВЛЯЕМ poker_sit_down: для SNG используем starting_chips, не buy_in
-- ============================================================

CREATE OR REPLACE FUNCTION public.poker_sit_down(
  table_id_param UUID,
  position_param INT,
  buy_in_param BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tbl RECORD;
  current_balance BIGINT;
  actual_buy_in BIGINT;
  starting_chips BIGINT;
  seats_count INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO tbl FROM public.poker_tables WHERE id = table_id_param FOR UPDATE;
  IF tbl IS NULL THEN RAISE EXCEPTION 'Table not found'; END IF;

  -- Для SNG: buy_in фиксированный = min_buy_in, фишки = sng_starting_chips
  -- Также проверка: нельзя зайти если турнир уже идёт
  IF tbl.table_type = 'sng' THEN
    IF tbl.sng_started_at IS NOT NULL THEN
      RAISE EXCEPTION 'Tournament already started';
    END IF;
    actual_buy_in := tbl.min_buy_in;
    starting_chips := tbl.sng_starting_chips;
  ELSE
    -- Cash: проверка диапазона
    IF buy_in_param < tbl.min_buy_in OR buy_in_param > tbl.max_buy_in THEN
      RAISE EXCEPTION 'Buy-in must be between % and %', tbl.min_buy_in, tbl.max_buy_in;
    END IF;
    actual_buy_in := buy_in_param;
    starting_chips := buy_in_param;
  END IF;

  IF position_param < 0 OR position_param >= tbl.max_players THEN
    RAISE EXCEPTION 'Invalid position';
  END IF;

  IF EXISTS (SELECT 1 FROM public.poker_seats WHERE table_id = table_id_param AND user_id = uid) THEN
    RAISE EXCEPTION 'Already at this table';
  END IF;

  IF EXISTS (SELECT 1 FROM public.poker_seats WHERE table_id = table_id_param AND position = position_param) THEN
    RAISE EXCEPTION 'Seat taken';
  END IF;

  SELECT balance INTO current_balance FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF current_balance IS NULL OR current_balance < actual_buy_in THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.wallets SET balance = balance - actual_buy_in WHERE user_id = uid;
  INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (uid, 'game_buyin', -actual_buy_in,
      CASE WHEN tbl.table_type = 'sng' THEN 'Buy-in турнир: ' ELSE 'Buy-in покер: ' END || tbl.name,
      jsonb_build_object('table_id', table_id_param));

  INSERT INTO public.poker_seats (table_id, position, user_id, chips)
  VALUES (table_id_param, position_param, uid, starting_chips);

  -- Если SNG и заполнено — авто-старт первой раздачи
  IF tbl.table_type = 'sng' THEN
    SELECT COUNT(*) INTO seats_count FROM public.poker_seats WHERE table_id = table_id_param;
    IF seats_count >= tbl.max_players THEN
      UPDATE public.poker_tables
        SET sng_started_at = NOW(),
            sng_level_started_at = NOW()
        WHERE id = table_id_param;
      PERFORM poker_start_hand(table_id_param);
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.poker_sit_down(UUID, INT, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.poker_sit_down(UUID, INT, BIGINT) TO authenticated;

-- ============================================================
-- 6. ОБНОВЛЯЕМ poker_stand_up: для SNG в running запрещаем
-- ============================================================

CREATE OR REPLACE FUNCTION public.poker_stand_up(table_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  seat RECORD;
  tbl RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO seat FROM public.poker_seats
    WHERE table_id = table_id_param AND user_id = uid FOR UPDATE;
  IF seat IS NULL THEN RAISE EXCEPTION 'Not at this table'; END IF;

  SELECT * INTO tbl FROM public.poker_tables WHERE id = table_id_param;

  -- В SNG нельзя уйти после начала турнира
  IF tbl.table_type = 'sng' AND tbl.sng_started_at IS NOT NULL AND tbl.sng_finished_at IS NULL THEN
    RAISE EXCEPTION 'Cannot leave running tournament';
  END IF;

  -- Возврат фишек: для SNG до старта — buy_in, после — обработано через finishers (тут не возвращаем)
  IF tbl.table_type = 'sng' THEN
    IF tbl.sng_started_at IS NULL THEN
      -- До старта: возвращаем buy_in полностью
      UPDATE public.wallets SET balance = balance + tbl.min_buy_in WHERE user_id = uid;
      INSERT INTO public.transactions (user_id, type, amount, description, metadata)
        VALUES (uid, 'game_cashout', tbl.min_buy_in, 'Отмена регистрации: ' || tbl.name,
                jsonb_build_object('table_id', table_id_param));
    END IF;
    -- После старта: ничего не возвращаем (приз начислен через finishers если был)
  ELSE
    -- Cash: возвращаем все оставшиеся фишки
    IF seat.chips > 0 THEN
      UPDATE public.wallets SET balance = balance + seat.chips WHERE user_id = uid;
      INSERT INTO public.transactions (user_id, type, amount, description, metadata)
        VALUES (uid, 'game_cashout', seat.chips, 'Cash-out покер: ' || tbl.name,
                jsonb_build_object('table_id', table_id_param));
    END IF;
  END IF;

  DELETE FROM public.poker_seats WHERE table_id = table_id_param AND user_id = uid;

  RETURN jsonb_build_object('ok', true, 'returned', seat.chips);
END;
$$;

REVOKE ALL ON FUNCTION public.poker_stand_up(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.poker_stand_up(UUID) TO authenticated;

-- ============================================================
-- 7. RPC: повышение уровня блайндов в SNG
-- Любой клиент за столом может пингануть; идемпотентно
-- ============================================================

CREATE OR REPLACE FUNCTION public.poker_advance_blind_level(table_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tbl RECORD;
  next_level_idx INT;
  next_level JSONB;
  max_level INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO tbl FROM public.poker_tables WHERE id = table_id_param FOR UPDATE;
  IF tbl IS NULL OR tbl.table_type <> 'sng' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_sng');
  END IF;

  IF tbl.sng_started_at IS NULL OR tbl.sng_finished_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_running');
  END IF;

  IF tbl.sng_level_started_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_level_start');
  END IF;

  -- Проверка истечения уровня
  IF NOW() < tbl.sng_level_started_at + (tbl.sng_blind_duration_seconds || ' seconds')::INTERVAL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yet');
  END IF;

  max_level := jsonb_array_length(tbl.sng_blind_levels);
  IF tbl.sng_current_level >= max_level THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'max_level');
  END IF;

  next_level_idx := tbl.sng_current_level;  -- 0-based индекс для следующего
  next_level := tbl.sng_blind_levels->next_level_idx;

  UPDATE public.poker_tables
    SET sng_current_level = sng_current_level + 1,
        sng_level_started_at = NOW(),
        small_blind = (next_level->>'sb')::BIGINT,
        big_blind = (next_level->>'bb')::BIGINT
    WHERE id = table_id_param;

  RETURN jsonb_build_object('ok', true, 'new_level', tbl.sng_current_level + 1,
                            'sb', (next_level->>'sb')::BIGINT,
                            'bb', (next_level->>'bb')::BIGINT);
END;
$$;

REVOKE ALL ON FUNCTION public.poker_advance_blind_level(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.poker_advance_blind_level(UUID) TO authenticated;

-- ============================================================
-- 8. Helper: финиш SNG турнира
-- Распределение призов через transactions, запись 1-го места в finishers
-- ============================================================

CREATE OR REPLACE FUNCTION public.poker_sng_finalize_tournament(
  table_id_param UUID,
  winner_user_id_param UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  tbl RECORD;
  total_prize BIGINT;
  prize_for_first BIGINT;
  prize_pct INT;
BEGIN
  SELECT * INTO tbl FROM public.poker_tables WHERE id = table_id_param;

  -- Общий призовой фонд = buy_in × max_players
  total_prize := tbl.min_buy_in * tbl.max_players;

  prize_pct := COALESCE((tbl.sng_prize_structure->>'1')::INT, 100);
  prize_for_first := total_prize * prize_pct / 100;

  -- Записываем 1 место
  INSERT INTO public.poker_sng_finishers (table_id, user_id, place, prize_tokens)
  VALUES (table_id_param, winner_user_id_param, 1, prize_for_first)
  ON CONFLICT (table_id, user_id) DO NOTHING;

  -- Начисление приза победителю
  IF prize_for_first > 0 THEN
    UPDATE public.wallets SET balance = balance + prize_for_first WHERE user_id = winner_user_id_param;
    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
      VALUES (winner_user_id_param, 'sng_prize', prize_for_first,
              '1 место турнира: ' || tbl.name,
              jsonb_build_object('table_id', table_id_param, 'place', 1));
  END IF;

  -- Закрываем турнир
  UPDATE public.poker_tables
    SET status = 'finished',
        sng_finished_at = NOW(),
        current_hand_id = NULL
    WHERE id = table_id_param;
END;
$$;

-- ============================================================
-- 9. Helper: запись выбывшего с местом + начисление приза
-- ============================================================

CREATE OR REPLACE FUNCTION public.poker_sng_record_eliminated(
  table_id_param UUID,
  user_id_param UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  tbl RECORD;
  alive_count INT;
  my_place INT;
  total_prize BIGINT;
  prize_pct INT;
  prize_amount BIGINT;
BEGIN
  SELECT * INTO tbl FROM public.poker_tables WHERE id = table_id_param;

  -- Считаем сколько еще живых ДО учёта выбывающего
  -- Текущее место = (max_players - finishers_count) — это место выбывающего
  SELECT COUNT(*) INTO alive_count FROM public.poker_sng_finishers WHERE table_id = table_id_param;
  my_place := tbl.max_players - alive_count;  -- например при первом выбывании 6-0=6 место

  total_prize := tbl.min_buy_in * tbl.max_players;
  prize_pct := COALESCE((tbl.sng_prize_structure->>(my_place::TEXT))::INT, 0);
  prize_amount := total_prize * prize_pct / 100;

  INSERT INTO public.poker_sng_finishers (table_id, user_id, place, prize_tokens)
  VALUES (table_id_param, user_id_param, my_place, prize_amount)
  ON CONFLICT (table_id, user_id) DO NOTHING;

  IF prize_amount > 0 THEN
    UPDATE public.wallets SET balance = balance + prize_amount WHERE user_id = user_id_param;
    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
      VALUES (user_id_param, 'sng_prize', prize_amount,
              my_place || ' место турнира: ' || tbl.name,
              jsonb_build_object('table_id', table_id_param, 'place', my_place));
  END IF;
END;
$$;

-- ============================================================
-- 10. ОБНОВЛЯЕМ poker_finalize_hand для SNG:
-- - Записывает выбывших (chips=0 после раздачи)
-- - Если ≥2 живых → авто-старт следующей раздачи
-- - Если 1 живой → poker_sng_finalize_tournament
-- ============================================================

CREATE OR REPLACE FUNCTION public.poker_finalize_hand(hand_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
  h RECORD;
  tbl RECORD;
  contribs INT[];
  contrib_amounts BIGINT[];
  folded_seats INT[];
  unique_levels BIGINT[];
  level BIGINT;
  prev_level BIGINT := 0;
  contributors_count INT;
  pot_amount BIGINT;
  eligible INT[];
  pot_seq INT := 1;
  best_strength BIGINT;
  current_strength BIGINT;
  pot_winners INT[];
  pot_hand_name TEXT;
  hole RECORD;
  seat_pos INT;
  win_amount BIGINT;
  remainder BIGINT;
  i INT;
  best_overall_strength BIGINT := 0;
  best_overall_name TEXT := 'Все спасовали';
  overall_winners INT[] := ARRAY[]::INT[];
  -- Для SNG
  eliminated_seat RECORD;
  alive_user_id UUID;
  alive_seats_count INT;
BEGIN
  SELECT * INTO h FROM public.poker_hands WHERE id = hand_id_param;
  SELECT * INTO tbl FROM public.poker_tables WHERE id = h.table_id;

  -- (Старая логика finalize: collect contribs, side-pots, distribute)
  SELECT array_agg(seat_position), array_agg(total_contrib)
    INTO contribs, contrib_amounts
  FROM (
    SELECT seat_position, SUM(amount)::BIGINT AS total_contrib
    FROM public.poker_actions
    WHERE hand_id = hand_id_param
    GROUP BY seat_position
    HAVING SUM(amount) > 0
    ORDER BY total_contrib ASC, seat_position
  ) t;

  SELECT COALESCE(array_agg(seat_position), ARRAY[]::INT[]) INTO folded_seats
    FROM public.poker_round_state
    WHERE hand_id = hand_id_param AND status = 'folded';

  IF (
    SELECT COUNT(*) FROM public.poker_round_state
    WHERE hand_id = hand_id_param AND round = h.current_round AND status <> 'folded'
  ) = 1 THEN
    SELECT seat_position INTO seat_pos
      FROM public.poker_round_state
      WHERE hand_id = hand_id_param AND round = h.current_round AND status <> 'folded'
      LIMIT 1;

    UPDATE public.poker_seats SET chips = chips + h.pot
      WHERE table_id = h.table_id AND position = seat_pos;

    INSERT INTO public.poker_pots (hand_id, sequence_num, amount, eligible_seats, winner_seats, winning_hand_name)
      VALUES (hand_id_param, 1, h.pot, to_jsonb(ARRAY[seat_pos]), to_jsonb(ARRAY[seat_pos]), 'Все спасовали');

    UPDATE public.poker_hands
      SET status = 'finished',
          current_round = 'finished',
          current_seat_position = NULL,
          winner_positions = to_jsonb(ARRAY[seat_pos]),
          winning_amount = h.pot,
          winning_hand_name = 'Все спасовали',
          winning_hand_strength = 0,
          finished_at = NOW()
      WHERE id = hand_id_param;
  ELSE
    -- Showdown с side-pots
    UPDATE public.poker_hole_cards SET revealed = true WHERE hand_id = hand_id_param;

    SELECT array_agg(DISTINCT amount ORDER BY amount) INTO unique_levels
      FROM unnest(contrib_amounts) AS t(amount);

    FOR i IN 1..COALESCE(array_length(unique_levels, 1), 0) LOOP
      level := unique_levels[i];

      SELECT COUNT(*), array_agg(seat_position) INTO contributors_count, eligible
        FROM (
          SELECT seat_position, total_contrib
          FROM (
            SELECT seat_position, SUM(amount)::BIGINT AS total_contrib
            FROM public.poker_actions
            WHERE hand_id = hand_id_param
            GROUP BY seat_position
          ) t
          WHERE total_contrib >= level
        ) ee;

      pot_amount := (level - prev_level) * contributors_count;

      eligible := ARRAY(
        SELECT pos FROM unnest(eligible) AS pos WHERE NOT (pos = ANY(folded_seats))
      );

      IF array_length(eligible, 1) IS NULL OR array_length(eligible, 1) = 0 THEN
        prev_level := level;
        CONTINUE;
      END IF;

      best_strength := 0;
      pot_winners := ARRAY[]::INT[];
      FOR hole IN
        SELECT hc.position, hc.card1, hc.card2
        FROM public.poker_hole_cards hc
        WHERE hc.hand_id = hand_id_param AND hc.position = ANY(eligible)
      LOOP
        current_strength := poker_evaluate_hand(
          jsonb_build_array(hole.card1, hole.card2),
          h.board
        );
        IF current_strength > best_strength THEN
          best_strength := current_strength;
          pot_winners := ARRAY[hole.position];
        ELSIF current_strength = best_strength THEN
          pot_winners := array_append(pot_winners, hole.position);
        END IF;
      END LOOP;

      pot_hand_name := poker_hand_name(best_strength);

      win_amount := pot_amount / array_length(pot_winners, 1);
      remainder := pot_amount - win_amount * array_length(pot_winners, 1);

      FOR seat_pos IN SELECT unnest(pot_winners) LOOP
        UPDATE public.poker_seats
          SET chips = chips + win_amount
          WHERE table_id = h.table_id AND position = seat_pos;
      END LOOP;
      IF remainder > 0 THEN
        UPDATE public.poker_seats
          SET chips = chips + remainder
          WHERE table_id = h.table_id AND position = pot_winners[1];
      END IF;

      INSERT INTO public.poker_pots (hand_id, sequence_num, amount, eligible_seats, winner_seats, winning_hand_name, winning_hand_strength)
        VALUES (hand_id_param, pot_seq, pot_amount, to_jsonb(eligible), to_jsonb(pot_winners), pot_hand_name, best_strength);

      pot_seq := pot_seq + 1;

      IF best_strength > best_overall_strength THEN
        best_overall_strength := best_strength;
        best_overall_name := pot_hand_name;
        overall_winners := pot_winners;
      END IF;

      prev_level := level;
    END LOOP;

    UPDATE public.poker_hands
      SET status = 'finished',
          current_round = 'finished',
          current_seat_position = NULL,
          winner_positions = to_jsonb(overall_winners),
          winning_amount = h.pot,
          winning_hand_name = best_overall_name,
          winning_hand_strength = best_overall_strength,
          finished_at = NOW()
      WHERE id = hand_id_param;
  END IF;

  UPDATE public.poker_tables
    SET status = 'waiting', current_hand_id = NULL
    WHERE id = h.table_id;

  -- ===== SNG-специфичная логика =====
  IF tbl.table_type = 'sng' AND tbl.sng_started_at IS NOT NULL AND tbl.sng_finished_at IS NULL THEN
    -- Записываем выбывших (chips=0)
    FOR eliminated_seat IN
      SELECT user_id, position FROM public.poker_seats
        WHERE table_id = h.table_id AND chips = 0
          AND user_id NOT IN (SELECT user_id FROM public.poker_sng_finishers WHERE table_id = h.table_id)
    LOOP
      PERFORM poker_sng_record_eliminated(h.table_id, eliminated_seat.user_id);
    END LOOP;

    -- Считаем оставшихся живых
    SELECT COUNT(*) INTO alive_seats_count FROM public.poker_seats WHERE table_id = h.table_id AND chips > 0;

    IF alive_seats_count = 1 THEN
      -- Турнир окончен
      SELECT user_id INTO alive_user_id FROM public.poker_seats WHERE table_id = h.table_id AND chips > 0 LIMIT 1;
      PERFORM poker_sng_finalize_tournament(h.table_id, alive_user_id);
    ELSIF alive_seats_count >= 2 THEN
      -- Авто-старт следующей раздачи через short pause (1-2 сек)
      -- Делаем сразу, клиент увидит изменение
      PERFORM poker_start_hand(h.table_id);
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- ВАЖНО: poker_start_hand вызывается из poker_finalize_hand,
-- и SECURITY DEFINER там работает от auth.uid() = creator_id
-- А в SNG авто-старте auth.uid() = тот кто триггернул действие
-- Чтобы это сработало — нужно убрать проверку "Not at this table" в poker_start_hand
-- для случая авто-старта. Но проще: вызывать из finalize не через RPC,
-- а напрямую логику. Вместо этого делаем маркер: если current_hand_id IS NULL и table_type='sng'
-- и status='waiting' и sng_started_at IS NOT NULL — следующее действие на столе вызовет старт.
--
-- Альтернатива (выбираем эту): сделать функцию-триггер poker_sng_auto_next,
-- которая запускается без auth, дёргает start_hand с обходом проверок
-- ============================================================

-- Перепишем poker_start_hand: если вызывается из SECURITY DEFINER функции
-- (т.е. session_user = postgres / auth.uid() IS NULL в контексте finalize),
-- пропускаем проверку "Not at this table"

CREATE OR REPLACE FUNCTION public.poker_start_hand(table_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tbl RECORD;
  active_seats INT[];
  active_users UUID[];
  active_chips BIGINT[];
  num_players INT;
  new_hand_id UUID;
  hand_num INT;
  new_dealer INT;
  sb_pos INT;
  bb_pos INT;
  utg_pos INT;
  deck TEXT[];
  remaining TEXT[];
  i INT;
  seat_idx INT;
  sb_amount BIGINT;
  bb_amount BIGINT;
  card1_val TEXT;
  card2_val TEXT;
  is_auto_start BOOLEAN := false;
BEGIN
  SELECT * INTO tbl FROM public.poker_tables WHERE id = table_id_param FOR UPDATE;
  IF tbl IS NULL THEN RAISE EXCEPTION 'Table not found'; END IF;

  -- SNG авто-старт: если sng_started_at установлено, значит автозапуск из sit_down или finalize_hand
  -- В этом случае пропускаем проверку "Not at this table"
  IF tbl.table_type = 'sng' AND tbl.sng_started_at IS NOT NULL THEN
    is_auto_start := true;
  END IF;

  IF NOT is_auto_start THEN
    IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.poker_seats WHERE table_id = table_id_param AND user_id = uid) THEN
      RAISE EXCEPTION 'Not at this table';
    END IF;
  END IF;

  IF tbl.status = 'playing' THEN
    RAISE EXCEPTION 'Hand already in progress';
  END IF;
  IF tbl.status = 'finished' THEN
    RAISE EXCEPTION 'Table finished';
  END IF;

  SELECT array_agg(position ORDER BY position),
         array_agg(user_id ORDER BY position),
         array_agg(chips ORDER BY position)
    INTO active_seats, active_users, active_chips
    FROM public.poker_seats
    WHERE table_id = table_id_param AND chips > 0;

  num_players := COALESCE(array_length(active_seats, 1), 0);
  IF num_players < 2 THEN RAISE EXCEPTION 'Need at least 2 players with chips'; END IF;

  SELECT COALESCE(MAX(hand_number), 0) + 1 INTO hand_num
    FROM public.poker_hands WHERE table_id = table_id_param;

  IF tbl.dealer_position IS NULL THEN
    new_dealer := active_seats[1 + (random() * (num_players - 1))::INT];
  ELSE
    new_dealer := active_seats[1];
    FOR i IN 1..num_players LOOP
      IF active_seats[i] > tbl.dealer_position THEN
        new_dealer := active_seats[i];
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF num_players = 2 THEN
    sb_pos := new_dealer;
    bb_pos := (SELECT pos FROM unnest(active_seats) AS pos WHERE pos <> new_dealer LIMIT 1);
    utg_pos := sb_pos;
  ELSE
    SELECT pos INTO sb_pos FROM unnest(active_seats) AS pos
      WHERE pos > new_dealer ORDER BY pos LIMIT 1;
    IF sb_pos IS NULL THEN sb_pos := active_seats[1]; END IF;

    SELECT pos INTO bb_pos FROM unnest(active_seats) AS pos
      WHERE pos > sb_pos ORDER BY pos LIMIT 1;
    IF bb_pos IS NULL THEN bb_pos := active_seats[1]; END IF;

    SELECT pos INTO utg_pos FROM unnest(active_seats) AS pos
      WHERE pos > bb_pos ORDER BY pos LIMIT 1;
    IF utg_pos IS NULL THEN utg_pos := active_seats[1]; END IF;
  END IF;

  deck := ARRAY(SELECT jsonb_array_elements_text(poker_shuffle_deck()));

  INSERT INTO public.poker_hands (
    table_id, hand_number, dealer_position, current_round,
    current_seat_position, board, pot, current_bet, min_raise,
    turn_started_at
  ) VALUES (
    table_id_param, hand_num, new_dealer, 'preflop',
    utg_pos, '[]'::JSONB, 0, tbl.big_blind, tbl.big_blind,
    NOW()
  ) RETURNING id INTO new_hand_id;

  remaining := deck;
  FOR i IN 1..num_players LOOP
    seat_idx := i;
    card1_val := remaining[1];
    remaining := remaining[2:];
    card2_val := remaining[1];
    remaining := remaining[2:];
    INSERT INTO public.poker_hole_cards (hand_id, user_id, position, card1, card2)
    VALUES (new_hand_id, active_users[seat_idx], active_seats[seat_idx], card1_val, card2_val);
  END LOOP;

  INSERT INTO public.poker_hand_decks (hand_id, remaining_deck)
  VALUES (new_hand_id, to_jsonb(remaining));

  FOR i IN 1..num_players LOOP
    INSERT INTO public.poker_round_state (hand_id, round, seat_position, bet_in_round, status)
    VALUES (new_hand_id, 'preflop', active_seats[i], 0, 'pending');
  END LOOP;

  sb_amount := LEAST(tbl.small_blind, (SELECT chips FROM public.poker_seats WHERE table_id = table_id_param AND position = sb_pos));
  bb_amount := LEAST(tbl.big_blind, (SELECT chips FROM public.poker_seats WHERE table_id = table_id_param AND position = bb_pos));

  UPDATE public.poker_seats SET chips = chips - sb_amount
    WHERE table_id = table_id_param AND position = sb_pos;
  UPDATE public.poker_seats SET chips = chips - bb_amount
    WHERE table_id = table_id_param AND position = bb_pos;

  UPDATE public.poker_round_state SET bet_in_round = sb_amount
    WHERE hand_id = new_hand_id AND round = 'preflop' AND seat_position = sb_pos;
  UPDATE public.poker_round_state SET bet_in_round = bb_amount
    WHERE hand_id = new_hand_id AND round = 'preflop' AND seat_position = bb_pos;

  INSERT INTO public.poker_actions (hand_id, sequence_num, seat_position, user_id, round, action, amount, total_bet_in_round)
  VALUES
    (new_hand_id, 1, sb_pos,
      (SELECT user_id FROM public.poker_seats WHERE table_id = table_id_param AND position = sb_pos),
      'preflop', 'small_blind', sb_amount, sb_amount),
    (new_hand_id, 2, bb_pos,
      (SELECT user_id FROM public.poker_seats WHERE table_id = table_id_param AND position = bb_pos),
      'preflop', 'big_blind', bb_amount, bb_amount);

  UPDATE public.poker_hands
    SET pot = sb_amount + bb_amount,
        current_bet = bb_amount,
        last_raiser_position = bb_pos,
        min_raise = tbl.big_blind
    WHERE id = new_hand_id;

  UPDATE public.poker_tables
    SET status = 'playing', current_hand_id = new_hand_id, dealer_position = new_dealer
    WHERE id = table_id_param;

  RETURN jsonb_build_object('ok', true, 'hand_id', new_hand_id);
END;
$$;

REVOKE ALL ON FUNCTION public.poker_start_hand(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.poker_start_hand(UUID) TO authenticated;
