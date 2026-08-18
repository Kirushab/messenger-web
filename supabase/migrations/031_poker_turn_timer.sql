-- ============================================================
-- 031_poker_turn_timer.sql
-- Патч poker_start_hand и poker_place_action чтобы устанавливать turn_started_at
-- (после применения 030_poker_sidepots_timer.sql)
-- ============================================================

-- Эти функции пересоздаются с минимальным изменением: добавлен UPDATE turn_started_at = NOW()
-- везде где меняется current_seat_position

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
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO tbl FROM public.poker_tables WHERE id = table_id_param FOR UPDATE;
  IF tbl IS NULL THEN RAISE EXCEPTION 'Table not found'; END IF;

  IF tbl.status = 'playing' THEN RAISE EXCEPTION 'Hand already in progress'; END IF;

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
        new_dealer := active_seats[i]; EXIT;
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

  -- ✨ NEW: turn_started_at = NOW()
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
    card1_val := remaining[1]; remaining := remaining[2:];
    card2_val := remaining[1]; remaining := remaining[2:];
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

-- ============================================================
-- poker_place_action: добавляем turn_started_at в финале
-- ============================================================
CREATE OR REPLACE FUNCTION public.poker_place_action(
  table_id_param UUID,
  action_param TEXT,
  amount_param BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF tbl IS NULL OR tbl.current_hand_id IS NULL THEN RAISE EXCEPTION 'No active hand'; END IF;

  SELECT * INTO h FROM public.poker_hands WHERE id = tbl.current_hand_id FOR UPDATE;
  IF h.status <> 'active' THEN RAISE EXCEPTION 'Hand finished'; END IF;

  SELECT * INTO my_seat FROM public.poker_seats
    WHERE table_id = table_id_param AND user_id = uid;
  IF my_seat IS NULL THEN RAISE EXCEPTION 'Not at this table'; END IF;

  IF h.current_seat_position <> my_seat.position THEN RAISE EXCEPTION 'Not your turn'; END IF;

  SELECT * INTO rs FROM public.poker_round_state
    WHERE hand_id = h.id AND round = h.current_round AND seat_position = my_seat.position;

  call_amount := h.current_bet - rs.bet_in_round;
  my_chips := my_seat.chips;

  IF action_param = 'fold' THEN
    UPDATE public.poker_round_state SET status = 'folded'
      WHERE hand_id = h.id AND round = h.current_round AND seat_position = my_seat.position;
    added_to_pot := 0; new_total_bet := rs.bet_in_round;

  ELSIF action_param = 'check' THEN
    IF call_amount > 0 THEN RAISE EXCEPTION 'Cannot check, must call %', call_amount; END IF;
    UPDATE public.poker_round_state SET status = 'acted'
      WHERE hand_id = h.id AND round = h.current_round AND seat_position = my_seat.position;
    added_to_pot := 0; new_total_bet := rs.bet_in_round;

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
    IF amount_param <= h.current_bet THEN RAISE EXCEPTION 'Raise must exceed current bet %', h.current_bet; END IF;
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
    -- ✨ NEW: turn_started_at для нового раунда
    UPDATE public.poker_hands SET turn_started_at = NOW() WHERE id = h.id;
    RETURN jsonb_build_object('ok', true, 'advanced', true);
  END IF;

  next_seat := poker_next_active_seat(h.id, h.current_round, my_seat.position, tbl.max_players);
  -- ✨ NEW: turn_started_at для следующего хода
  UPDATE public.poker_hands
    SET current_seat_position = next_seat, turn_started_at = NOW()
    WHERE id = h.id;

  RETURN jsonb_build_object('ok', true, 'next_seat', next_seat);
END;
$$;
