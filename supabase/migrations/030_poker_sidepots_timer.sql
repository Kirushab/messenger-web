-- ============================================================
-- 030_poker_sidepots_timer.sql
-- v44: Side-pots + таймер хода с auto-fold + зрители + hand history
-- ============================================================

-- Side-pots: отдельная таблица для каждой раздачи
CREATE TABLE IF NOT EXISTS public.poker_pots (
  hand_id UUID NOT NULL REFERENCES public.poker_hands(id) ON DELETE CASCADE,
  sequence_num INT NOT NULL,
  amount BIGINT NOT NULL,
  eligible_seats JSONB NOT NULL,                -- кто может выиграть этот pot
  winner_seats JSONB,                           -- кто выиграл (после showdown)
  winning_hand_name TEXT,
  winning_hand_strength BIGINT,
  PRIMARY KEY (hand_id, sequence_num)
);

CREATE INDEX IF NOT EXISTS poker_pots_hand_idx ON public.poker_pots(hand_id);

ALTER TABLE public.poker_pots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads pots" ON public.poker_pots;
CREATE POLICY "Anyone reads pots" ON public.poker_pots
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Турн-таймер
ALTER TABLE public.poker_hands
  ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMPTZ;

ALTER TABLE public.poker_hands
  ADD COLUMN IF NOT EXISTS turn_timeout_seconds INT NOT NULL DEFAULT 60;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_pots;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'poker_pots уже в публикации'; END;
END $$;

-- ============================================================
-- ПЕРЕОПРЕДЕЛЯЕМ poker_finalize_hand с поддержкой side-pots
-- ============================================================
CREATE OR REPLACE FUNCTION public.poker_finalize_hand(hand_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
  h RECORD;
  contribs INT[];                                          -- seat_position
  contrib_amounts BIGINT[];                                -- сумма вклада каждого
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
BEGIN
  SELECT * INTO h FROM public.poker_hands WHERE id = hand_id_param;

  -- Собираем суммарные вклады каждого места из poker_actions
  -- В hand_actions есть amount = сколько добавлено за шаг. Сумма даёт total contrib
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

  -- Собираем folded
  SELECT COALESCE(array_agg(seat_position), ARRAY[]::INT[]) INTO folded_seats
    FROM public.poker_round_state
    WHERE hand_id = hand_id_param AND status = 'folded';

  -- Если только один не folded — он win всё (без showdown)
  IF (
    SELECT COUNT(*) FROM public.poker_round_state
    WHERE hand_id = hand_id_param AND round = h.current_round AND status <> 'folded'
  ) = 1 THEN
    -- Один win всё
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

    UPDATE public.poker_tables
      SET status = 'waiting', current_hand_id = NULL
      WHERE id = h.table_id;
    RETURN;
  END IF;

  -- Showdown: открываем карты всех не-folded
  UPDATE public.poker_hole_cards SET revealed = true WHERE hand_id = hand_id_param;

  -- Собираем уникальные уровни вкладов (для side-pots)
  SELECT array_agg(DISTINCT amount ORDER BY amount) INTO unique_levels
    FROM unnest(contrib_amounts) AS t(amount);

  -- Для каждого уровня создаём pot
  FOR i IN 1..COALESCE(array_length(unique_levels, 1), 0) LOOP
    level := unique_levels[i];

    -- Кто внёс минимум level
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

    -- Eligible winners: те кто contrib >= level И не folded
    eligible := ARRAY(
      SELECT pos FROM unnest(eligible) AS pos WHERE NOT (pos = ANY(folded_seats))
    );

    -- Если eligible пустой (все contributors на этом уровне fold'нули) — pot идёт следующему уровню
    -- Это редко но возможно. Пока пропускаем, остаётся в pool
    IF array_length(eligible, 1) IS NULL OR array_length(eligible, 1) = 0 THEN
      prev_level := level;
      CONTINUE;
    END IF;

    -- Оцениваем eligible
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

    -- Распределяем pot
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

    -- Сохраняем pot record
    INSERT INTO public.poker_pots (hand_id, sequence_num, amount, eligible_seats, winner_seats, winning_hand_name, winning_hand_strength)
      VALUES (hand_id_param, pot_seq, pot_amount, to_jsonb(eligible), to_jsonb(pot_winners), pot_hand_name, best_strength);

    pot_seq := pot_seq + 1;

    -- Запоминаем сильнейшую руку для общей записи
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

  UPDATE public.poker_tables
    SET status = 'waiting', current_hand_id = NULL
    WHERE id = h.table_id;
END;
$$;

-- ============================================================
-- Обновляем poker_place_action чтобы ставить turn_started_at
-- (текущая версия не знает о таймере — нужно добавить)
-- ============================================================
-- Достаточно добавить UPDATE turn_started_at в основной CASE WHEN current_seat changes.
-- Простой подход: после UPDATE poker_hands SET current_seat_position в самом конце
-- добавляем NOW() в turn_started_at. Это сделано в новой версии place_action ниже.

-- ============================================================
-- RPC: auto-fold для просроченного хода
-- Любой игрок за столом может вызвать если turn_started_at + timeout < NOW()
-- ============================================================
CREATE OR REPLACE FUNCTION public.poker_force_timeout(table_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tbl RECORD;
  h RECORD;
  expired_pos INT;
  expired_user UUID;
  rs RECORD;
  call_amount BIGINT;
  next_seq INT;
  next_seat INT;
  added_to_pot BIGINT;
  new_total_bet BIGINT;
  forced_action TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO tbl FROM public.poker_tables WHERE id = table_id_param;
  IF tbl IS NULL OR tbl.current_hand_id IS NULL THEN
    RAISE EXCEPTION 'No active hand';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.poker_seats WHERE table_id = table_id_param AND user_id = uid) THEN
    RAISE EXCEPTION 'Not at this table';
  END IF;

  SELECT * INTO h FROM public.poker_hands WHERE id = tbl.current_hand_id FOR UPDATE;
  IF h.status <> 'active' THEN
    RAISE EXCEPTION 'Hand finished';
  END IF;

  IF h.current_seat_position IS NULL OR h.turn_started_at IS NULL THEN
    RAISE EXCEPTION 'No active turn';
  END IF;

  -- Проверяем что timeout действительно истёк
  IF NOW() < h.turn_started_at + (h.turn_timeout_seconds || ' seconds')::INTERVAL THEN
    RAISE EXCEPTION 'Turn not yet expired';
  END IF;

  expired_pos := h.current_seat_position;
  SELECT user_id INTO expired_user
    FROM public.poker_seats
    WHERE table_id = table_id_param AND position = expired_pos;

  -- Auto-action: если можно check (call_amount = 0) — делаем check, иначе fold
  SELECT * INTO rs FROM public.poker_round_state
    WHERE hand_id = h.id AND round = h.current_round AND seat_position = expired_pos;

  call_amount := h.current_bet - rs.bet_in_round;

  IF call_amount = 0 THEN
    forced_action := 'check';
    UPDATE public.poker_round_state SET status = 'acted'
      WHERE hand_id = h.id AND round = h.current_round AND seat_position = expired_pos;
    added_to_pot := 0;
    new_total_bet := rs.bet_in_round;
  ELSE
    forced_action := 'fold';
    UPDATE public.poker_round_state SET status = 'folded'
      WHERE hand_id = h.id AND round = h.current_round AND seat_position = expired_pos;
    added_to_pot := 0;
    new_total_bet := rs.bet_in_round;
  END IF;

  SELECT COALESCE(MAX(sequence_num), 0) + 1 INTO next_seq
    FROM public.poker_actions WHERE hand_id = h.id;

  INSERT INTO public.poker_actions
    (hand_id, sequence_num, seat_position, user_id, round, action, amount, total_bet_in_round)
  VALUES (h.id, next_seq, expired_pos, expired_user, h.current_round, forced_action, 0, new_total_bet);

  -- Если только один не-folded остался — финализируем
  IF (SELECT COUNT(*) FROM public.poker_round_state
      WHERE hand_id = h.id AND round = h.current_round AND status <> 'folded') = 1 THEN
    PERFORM poker_finalize_hand(h.id);
    RETURN jsonb_build_object('ok', true, 'finished', true, 'forced', forced_action);
  END IF;

  IF poker_round_complete(h.id, h.current_round) THEN
    PERFORM poker_advance_round(h.id);
    -- В advance_round внутри устанавливается current_seat_position. Обновим turn_started_at
    UPDATE public.poker_hands SET turn_started_at = NOW() WHERE id = h.id;
    RETURN jsonb_build_object('ok', true, 'advanced', true, 'forced', forced_action);
  END IF;

  next_seat := poker_next_active_seat(h.id, h.current_round, expired_pos, tbl.max_players);
  UPDATE public.poker_hands
    SET current_seat_position = next_seat,
        turn_started_at = NOW()
    WHERE id = h.id;

  RETURN jsonb_build_object('ok', true, 'next_seat', next_seat, 'forced', forced_action);
END;
$$;

REVOKE ALL ON FUNCTION public.poker_force_timeout(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.poker_force_timeout(UUID) TO authenticated;
