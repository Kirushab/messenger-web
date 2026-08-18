-- ============================================================
-- 029_poker_actions.sql
-- v43 (часть 3/3): RPC игровой логики покера
-- Восстановлено из живой БД
-- ============================================================

-- Перетасовка колоды Fisher-Yates через random()
CREATE OR REPLACE FUNCTION public.poker_shuffle_deck()
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  ranks TEXT[] := ARRAY['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  suits TEXT[] := ARRAY['S','H','D','C'];
  deck TEXT[] := ARRAY[]::TEXT[];
  r TEXT;
  s TEXT;
BEGIN
  FOREACH r IN ARRAY ranks LOOP
    FOREACH s IN ARRAY suits LOOP
      deck := array_append(deck, r || s);
    END LOOP;
  END LOOP;
  RETURN to_jsonb((SELECT array_agg(c ORDER BY random()) FROM unnest(deck) AS c));
END;
$function$;

-- Следующее активное место (не folded и не all_in)
CREATE OR REPLACE FUNCTION public.poker_next_active_seat(
  hand_id_param uuid,
  round_param text,
  current_pos integer,
  max_players integer
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  pos INT;
  i INT;
BEGIN
  FOR i IN 1..max_players LOOP
    pos := (current_pos + i) % max_players;
    IF EXISTS (
      SELECT 1 FROM public.poker_round_state
      WHERE hand_id = hand_id_param AND round = round_param
        AND seat_position = pos AND status NOT IN ('folded', 'all_in')
    ) THEN
      RETURN pos;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

-- Раунд завершён, когда у всех не-fold/не-all-in либо acted, либо bet_in_round = current_bet
CREATE OR REPLACE FUNCTION public.poker_round_complete(
  hand_id_param uuid,
  round_param text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  active_count INT;
  unmatched_count INT;
  current_bet_val BIGINT;
BEGIN
  SELECT current_bet INTO current_bet_val FROM public.poker_hands WHERE id = hand_id_param;

  SELECT COUNT(*) INTO active_count
    FROM public.poker_round_state
    WHERE hand_id = hand_id_param AND round = round_param
      AND status NOT IN ('folded', 'all_in');

  SELECT COUNT(*) INTO unmatched_count
    FROM public.poker_round_state
    WHERE hand_id = hand_id_param AND round = round_param
      AND status NOT IN ('folded', 'all_in')
      AND (status = 'pending' OR bet_in_round < current_bet_val);

  RETURN unmatched_count = 0;
END;
$function$;

-- Финализация раздачи (без side-pots — переопределяется в 030)
CREATE OR REPLACE FUNCTION public.poker_finalize_hand(hand_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  h RECORD;
  tbl RECORD;
  active_seats INT[];
  winner_seats INT[];
  best_strength BIGINT := 0;
  current_strength BIGINT;
  hole RECORD;
  seat_rec RECORD;
  win_amount BIGINT;
  remainder BIGINT;
  hand_name_str TEXT;
BEGIN
  SELECT * INTO h FROM public.poker_hands WHERE id = hand_id_param;
  SELECT * INTO tbl FROM public.poker_tables WHERE id = h.table_id;

  SELECT array_agg(seat_position) INTO active_seats
    FROM public.poker_round_state
    WHERE hand_id = hand_id_param
      AND round = h.current_round
      AND status <> 'folded';

  IF array_length(active_seats, 1) = 1 THEN
    winner_seats := active_seats;
    best_strength := 0;
    hand_name_str := 'Все спасовали';
  ELSE
    UPDATE public.poker_hole_cards SET revealed = true WHERE hand_id = hand_id_param;

    winner_seats := ARRAY[]::INT[];
    FOR hole IN
      SELECT hc.position, hc.card1, hc.card2
      FROM public.poker_hole_cards hc
      WHERE hc.hand_id = hand_id_param
        AND hc.position = ANY(active_seats)
    LOOP
      current_strength := poker_evaluate_hand(
        jsonb_build_array(hole.card1, hole.card2),
        h.board
      );
      IF current_strength > best_strength THEN
        best_strength := current_strength;
        winner_seats := ARRAY[hole.position];
      ELSIF current_strength = best_strength THEN
        winner_seats := array_append(winner_seats, hole.position);
      END IF;
    END LOOP;

    hand_name_str := poker_hand_name(best_strength);
  END IF;

  win_amount := h.pot / array_length(winner_seats, 1);
  remainder := h.pot - win_amount * array_length(winner_seats, 1);

  FOR seat_rec IN SELECT unnest(winner_seats) AS pos LOOP
    UPDATE public.poker_seats
      SET chips = chips + win_amount
      WHERE table_id = h.table_id AND position = seat_rec.pos;
  END LOOP;

  IF remainder > 0 THEN
    UPDATE public.poker_seats
      SET chips = chips + remainder
      WHERE table_id = h.table_id AND position = winner_seats[1];
  END IF;

  UPDATE public.poker_hands
    SET status = 'finished',
        current_round = 'finished',
        current_seat_position = NULL,
        winner_positions = to_jsonb(winner_seats),
        winning_amount = win_amount,
        winning_hand_name = hand_name_str,
        winning_hand_strength = best_strength,
        finished_at = NOW()
    WHERE id = hand_id_param;

  UPDATE public.poker_tables
    SET status = 'waiting', current_hand_id = NULL
    WHERE id = h.table_id;
END;
$function$;

-- Переход на следующий раунд (preflop→flop→turn→river→showdown)
CREATE OR REPLACE FUNCTION public.poker_advance_round(hand_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  h RECORD;
  tbl RECORD;
  next_round TEXT;
  deck_rec RECORD;
  remaining TEXT[];
  burn TEXT[];
  new_board JSONB;
  cards_to_deal INT;
  next_seat INT;
  active_count INT;
BEGIN
  SELECT * INTO h FROM public.poker_hands WHERE id = hand_id_param FOR UPDATE;
  SELECT * INTO tbl FROM public.poker_tables WHERE id = h.table_id;

  SELECT COUNT(*) INTO active_count
    FROM public.poker_round_state
    WHERE hand_id = hand_id_param AND round = h.current_round
      AND status NOT IN ('folded', 'all_in');

  IF (SELECT COUNT(*) FROM public.poker_round_state
      WHERE hand_id = hand_id_param AND round = h.current_round
        AND status <> 'folded') = 1 THEN
    PERFORM poker_finalize_hand(hand_id_param);
    RETURN;
  END IF;

  CASE h.current_round
    WHEN 'preflop' THEN next_round := 'flop'; cards_to_deal := 3;
    WHEN 'flop' THEN next_round := 'turn'; cards_to_deal := 1;
    WHEN 'turn' THEN next_round := 'river'; cards_to_deal := 1;
    WHEN 'river' THEN next_round := 'showdown'; cards_to_deal := 0;
    ELSE next_round := 'finished'; cards_to_deal := 0;
  END CASE;

  IF next_round = 'showdown' OR next_round = 'finished' THEN
    PERFORM poker_finalize_hand(hand_id_param);
    RETURN;
  END IF;

  SELECT * INTO deck_rec FROM public.poker_hand_decks WHERE hand_id = hand_id_param FOR UPDATE;

  remaining := ARRAY(SELECT jsonb_array_elements_text(deck_rec.remaining_deck));
  burn := ARRAY(SELECT jsonb_array_elements_text(deck_rec.burn_cards));

  burn := array_append(burn, remaining[1]);
  remaining := remaining[2:];

  new_board := h.board;
  FOR i IN 1..cards_to_deal LOOP
    new_board := new_board || to_jsonb(remaining[1]);
    remaining := remaining[2:];
  END LOOP;

  UPDATE public.poker_hand_decks
    SET remaining_deck = to_jsonb(remaining), burn_cards = to_jsonb(burn)
    WHERE hand_id = hand_id_param;

  INSERT INTO public.poker_round_state (hand_id, round, seat_position, bet_in_round, status)
  SELECT hand_id_param, next_round, prs.seat_position, 0,
         CASE WHEN prs.status IN ('folded', 'all_in') THEN prs.status ELSE 'pending' END
    FROM public.poker_round_state prs
    WHERE prs.hand_id = hand_id_param AND prs.round = h.current_round;

  next_seat := poker_next_active_seat(hand_id_param, next_round, h.dealer_position, tbl.max_players);

  UPDATE public.poker_hands
    SET current_round = next_round,
        board = new_board,
        current_bet = 0,
        last_raiser_position = NULL,
        min_raise = tbl.big_blind,
        current_seat_position = next_seat
    WHERE id = hand_id_param;
END;
$function$;

-- Запуск раздачи (переопределяется в 031 для добавления turn_started_at)
CREATE OR REPLACE FUNCTION public.poker_start_hand(table_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO tbl FROM public.poker_tables WHERE id = table_id_param FOR UPDATE;
  IF tbl IS NULL THEN RAISE EXCEPTION 'Table not found'; END IF;

  IF tbl.status = 'playing' THEN
    RAISE EXCEPTION 'Hand already in progress';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.poker_seats WHERE table_id = table_id_param AND user_id = uid) THEN
    RAISE EXCEPTION 'Not at this table';
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
    current_seat_position, board, pot, current_bet, min_raise
  ) VALUES (
    table_id_param, hand_num, new_dealer, 'preflop',
    utg_pos, '[]'::JSONB, 0, tbl.big_blind, tbl.big_blind
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
$function$;

REVOKE ALL ON FUNCTION public.poker_start_hand(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.poker_start_hand(uuid) TO authenticated;

-- Действие игрока (переопределяется в 031 для добавления turn_started_at)
CREATE OR REPLACE FUNCTION public.poker_place_action(
  table_id_param uuid,
  action_param text,
  amount_param bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  tbl RECORD;
  h RECORD;
  my_seat RECORD;
  rs RECORD;
  call_amount BIGINT;
  my_chips BIGINT;
  next_seq INT;
  next_seat INT;
  new_total_bet BIGINT;
  added_to_pot BIGINT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO tbl FROM public.poker_tables WHERE id = table_id_param;
  IF tbl IS NULL OR tbl.current_hand_id IS NULL THEN
    RAISE EXCEPTION 'No active hand';
  END IF;

  SELECT * INTO h FROM public.poker_hands WHERE id = tbl.current_hand_id FOR UPDATE;
  IF h.status <> 'active' THEN RAISE EXCEPTION 'Hand finished'; END IF;

  SELECT * INTO my_seat FROM public.poker_seats
    WHERE table_id = table_id_param AND user_id = uid;
  IF my_seat IS NULL THEN RAISE EXCEPTION 'Not at this table'; END IF;

  IF h.current_seat_position <> my_seat.position THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  SELECT * INTO rs FROM public.poker_round_state
    WHERE hand_id = h.id AND round = h.current_round AND seat_position = my_seat.position;
  IF rs IS NULL THEN RAISE EXCEPTION 'Round state missing'; END IF;

  call_amount := h.current_bet - rs.bet_in_round;
  my_chips := my_seat.chips;

  IF action_param = 'fold' THEN
    UPDATE public.poker_round_state SET status = 'folded'
      WHERE hand_id = h.id AND round = h.current_round AND seat_position = my_seat.position;
    added_to_pot := 0;
    new_total_bet := rs.bet_in_round;

  ELSIF action_param = 'check' THEN
    IF call_amount > 0 THEN RAISE EXCEPTION 'Cannot check, must call %', call_amount; END IF;
    UPDATE public.poker_round_state SET status = 'acted'
      WHERE hand_id = h.id AND round = h.current_round AND seat_position = my_seat.position;
    added_to_pot := 0;
    new_total_bet := rs.bet_in_round;

  ELSIF action_param = 'call' THEN
    IF call_amount = 0 THEN RAISE EXCEPTION 'Nothing to call, use check'; END IF;
    added_to_pot := LEAST(call_amount, my_chips);
    new_total_bet := rs.bet_in_round + added_to_pot;
    UPDATE public.poker_seats SET chips = chips - added_to_pot
      WHERE table_id = table_id_param AND position = my_seat.position;
    UPDATE public.poker_round_state
      SET bet_in_round = new_total_bet,
          status = CASE WHEN added_to_pot >= call_amount AND my_chips > added_to_pot THEN 'acted' ELSE 'all_in' END
      WHERE hand_id = h.id AND round = h.current_round AND seat_position = my_seat.position;

  ELSIF action_param = 'raise' OR action_param = 'bet' THEN
    IF amount_param <= h.current_bet THEN
      RAISE EXCEPTION 'Raise must exceed current bet %', h.current_bet;
    END IF;
    IF amount_param < h.current_bet + h.min_raise AND amount_param < rs.bet_in_round + my_chips THEN
      RAISE EXCEPTION 'Min raise is % (total %)', h.min_raise, h.current_bet + h.min_raise;
    END IF;
    added_to_pot := amount_param - rs.bet_in_round;
    IF added_to_pot > my_chips THEN RAISE EXCEPTION 'Not enough chips'; END IF;
    new_total_bet := amount_param;
    UPDATE public.poker_seats SET chips = chips - added_to_pot
      WHERE table_id = table_id_param AND position = my_seat.position;
    UPDATE public.poker_round_state
      SET bet_in_round = new_total_bet,
          status = CASE WHEN added_to_pot = my_chips THEN 'all_in' ELSE 'acted' END
      WHERE hand_id = h.id AND round = h.current_round AND seat_position = my_seat.position;
    UPDATE public.poker_round_state
      SET status = 'pending'
      WHERE hand_id = h.id AND round = h.current_round
        AND seat_position <> my_seat.position
        AND status = 'acted';

  ELSIF action_param = 'all_in' THEN
    added_to_pot := my_chips;
    new_total_bet := rs.bet_in_round + my_chips;
    UPDATE public.poker_seats SET chips = 0
      WHERE table_id = table_id_param AND position = my_seat.position;
    UPDATE public.poker_round_state
      SET bet_in_round = new_total_bet, status = 'all_in'
      WHERE hand_id = h.id AND round = h.current_round AND seat_position = my_seat.position;
    IF new_total_bet > h.current_bet THEN
      UPDATE public.poker_round_state
        SET status = 'pending'
        WHERE hand_id = h.id AND round = h.current_round
          AND seat_position <> my_seat.position
          AND status = 'acted';
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown action %', action_param;
  END IF;

  SELECT COALESCE(MAX(sequence_num), 0) + 1 INTO next_seq
    FROM public.poker_actions WHERE hand_id = h.id;

  INSERT INTO public.poker_actions
    (hand_id, sequence_num, seat_position, user_id, round, action, amount, total_bet_in_round)
  VALUES (h.id, next_seq, my_seat.position, uid, h.current_round, action_param, added_to_pot, new_total_bet);

  UPDATE public.poker_hands
    SET pot = pot + added_to_pot,
        current_bet = GREATEST(current_bet, new_total_bet),
        last_raiser_position = CASE
          WHEN action_param IN ('raise', 'bet') THEN my_seat.position
          WHEN action_param = 'all_in' AND new_total_bet > h.current_bet THEN my_seat.position
          ELSE last_raiser_position
        END,
        min_raise = CASE
          WHEN action_param IN ('raise', 'bet') THEN amount_param - h.current_bet
          ELSE min_raise
        END
    WHERE id = h.id;

  IF (SELECT COUNT(*) FROM public.poker_round_state
      WHERE hand_id = h.id AND round = h.current_round AND status <> 'folded') = 1 THEN
    PERFORM poker_finalize_hand(h.id);
    RETURN jsonb_build_object('ok', true, 'finished', true);
  END IF;

  IF poker_round_complete(h.id, h.current_round) THEN
    PERFORM poker_advance_round(h.id);
    RETURN jsonb_build_object('ok', true, 'advanced', true);
  END IF;

  next_seat := poker_next_active_seat(h.id, h.current_round, my_seat.position, tbl.max_players);
  UPDATE public.poker_hands SET current_seat_position = next_seat WHERE id = h.id;

  RETURN jsonb_build_object('ok', true, 'next_seat', next_seat);
END;
$function$;

REVOKE ALL ON FUNCTION public.poker_place_action(uuid, text, bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.poker_place_action(uuid, text, bigint) TO authenticated;
