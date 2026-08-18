-- ============================================================
-- 028_poker_evaluator.sql
-- v43 (часть 2/3): Оценщик покерных комбинаций
-- Восстановлено из живой БД
-- Формат карт: "10S", "AS", "KH", "2C" (rank — 1-2 символа, suit — 1 символ)
-- ============================================================

CREATE OR REPLACE FUNCTION public.poker_card_rank(card text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  r TEXT;
BEGIN
  r := substring(card from 1 for length(card) - 1);
  RETURN CASE r
    WHEN '2' THEN 2 WHEN '3' THEN 3 WHEN '4' THEN 4 WHEN '5' THEN 5
    WHEN '6' THEN 6 WHEN '7' THEN 7 WHEN '8' THEN 8 WHEN '9' THEN 9
    WHEN '10' THEN 10 WHEN 'J' THEN 11 WHEN 'Q' THEN 12 WHEN 'K' THEN 13
    WHEN 'A' THEN 14
    ELSE 0 END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.poker_card_suit(card text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  RETURN substring(card from length(card) for 1);
END;
$function$;

-- Оценщик 5 карт: возвращает BIGINT-силу
-- Формула: type * 759375 + r1*50625 + r2*3375 + r3*225 + r4*15 + r5
-- Type: 0=High Card, 1=Pair, 2=Two Pair, 3=Trips, 4=Straight, 5=Flush,
--       6=Full House, 7=Quads, 8=Straight Flush, 9=Royal Flush
CREATE OR REPLACE FUNCTION public.poker_evaluate_5cards(cards text[])
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  ranks INT[];
  suits TEXT[];
  rank_counts INT[];
  unique_ranks INT[];
  is_flush BOOLEAN;
  is_straight BOOLEAN;
  straight_high INT := 0;
  pair1_rank INT := 0;
  pair2_rank INT := 0;
  trips_rank INT := 0;
  quads_rank INT := 0;
  high1 INT; high2 INT; high3 INT; high4 INT; high5 INT;
  hand_type INT := 0;
  i INT;
  r INT;
BEGIN
  ranks := ARRAY[
    poker_card_rank(cards[1]), poker_card_rank(cards[2]),
    poker_card_rank(cards[3]), poker_card_rank(cards[4]),
    poker_card_rank(cards[5])
  ];
  suits := ARRAY[
    poker_card_suit(cards[1]), poker_card_suit(cards[2]),
    poker_card_suit(cards[3]), poker_card_suit(cards[4]),
    poker_card_suit(cards[5])
  ];

  is_flush := suits[1] = suits[2] AND suits[2] = suits[3]
              AND suits[3] = suits[4] AND suits[4] = suits[5];

  rank_counts := array_fill(0, ARRAY[15]);
  FOR i IN 1..5 LOOP
    rank_counts[ranks[i]] := rank_counts[ranks[i]] + 1;
  END LOOP;

  FOR r IN REVERSE 14..2 LOOP
    IF rank_counts[r] = 4 THEN quads_rank := r;
    ELSIF rank_counts[r] = 3 THEN trips_rank := r;
    ELSIF rank_counts[r] = 2 THEN
      IF pair1_rank = 0 THEN pair1_rank := r;
      ELSE pair2_rank := r;
      END IF;
    END IF;
  END LOOP;

  unique_ranks := ARRAY(SELECT DISTINCT unnest(ranks) ORDER BY 1 DESC);

  IF array_length(unique_ranks, 1) = 5 THEN
    IF unique_ranks[1] - unique_ranks[5] = 4 THEN
      is_straight := true;
      straight_high := unique_ranks[1];
    ELSIF unique_ranks[1] = 14 AND unique_ranks[2] = 5 AND unique_ranks[3] = 4
          AND unique_ranks[4] = 3 AND unique_ranks[5] = 2 THEN
      is_straight := true;
      straight_high := 5;
    ELSE
      is_straight := false;
    END IF;
  ELSE
    is_straight := false;
  END IF;

  IF is_flush AND is_straight AND straight_high = 14 THEN
    hand_type := 9;
    high1 := 14; high2 := 0; high3 := 0; high4 := 0; high5 := 0;
  ELSIF is_flush AND is_straight THEN
    hand_type := 8;
    high1 := straight_high; high2 := 0; high3 := 0; high4 := 0; high5 := 0;
  ELSIF quads_rank > 0 THEN
    hand_type := 7;
    high1 := quads_rank;
    high2 := (SELECT max(r2) FROM unnest(ranks) AS r2 WHERE r2 <> quads_rank);
    high3 := 0; high4 := 0; high5 := 0;
  ELSIF trips_rank > 0 AND pair1_rank > 0 THEN
    hand_type := 6;
    high1 := trips_rank; high2 := pair1_rank;
    high3 := 0; high4 := 0; high5 := 0;
  ELSIF is_flush THEN
    hand_type := 5;
    high1 := unique_ranks[1]; high2 := unique_ranks[2]; high3 := unique_ranks[3];
    high4 := unique_ranks[4]; high5 := unique_ranks[5];
  ELSIF is_straight THEN
    hand_type := 4;
    high1 := straight_high; high2 := 0; high3 := 0; high4 := 0; high5 := 0;
  ELSIF trips_rank > 0 THEN
    hand_type := 3;
    high1 := trips_rank;
    SELECT array_agg(r2 ORDER BY r2 DESC) INTO unique_ranks
      FROM unnest(ranks) AS r2 WHERE r2 <> trips_rank;
    high2 := unique_ranks[1]; high3 := unique_ranks[2];
    high4 := 0; high5 := 0;
  ELSIF pair1_rank > 0 AND pair2_rank > 0 THEN
    hand_type := 2;
    high1 := pair1_rank; high2 := pair2_rank;
    high3 := (SELECT max(r2) FROM unnest(ranks) AS r2
              WHERE r2 <> pair1_rank AND r2 <> pair2_rank);
    high4 := 0; high5 := 0;
  ELSIF pair1_rank > 0 THEN
    hand_type := 1;
    high1 := pair1_rank;
    SELECT array_agg(r2 ORDER BY r2 DESC) INTO unique_ranks
      FROM unnest(ranks) AS r2 WHERE r2 <> pair1_rank;
    high2 := unique_ranks[1]; high3 := unique_ranks[2]; high4 := unique_ranks[3];
    high5 := 0;
  ELSE
    hand_type := 0;
    high1 := unique_ranks[1]; high2 := unique_ranks[2]; high3 := unique_ranks[3];
    high4 := unique_ranks[4]; high5 := unique_ranks[5];
  END IF;

  RETURN hand_type::BIGINT * 759375
       + COALESCE(high1, 0)::BIGINT * 50625
       + COALESCE(high2, 0)::BIGINT * 3375
       + COALESCE(high3, 0)::BIGINT * 225
       + COALESCE(high4, 0)::BIGINT * 15
       + COALESCE(high5, 0)::BIGINT;
END;
$function$;

-- Оценка лучшей руки 5 из 7 (hole 2 + board 5)
CREATE OR REPLACE FUNCTION public.poker_evaluate_hand(hole_cards jsonb, board jsonb)
RETURNS bigint
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  all_cards TEXT[];
  combo TEXT[];
  best BIGINT := 0;
  current_strength BIGINT;
  i1 INT; i2 INT; i3 INT; i4 INT; i5 INT;
  total INT;
BEGIN
  SELECT array_agg(value::TEXT) INTO all_cards FROM (
    SELECT jsonb_array_elements_text(hole_cards) AS value
    UNION ALL
    SELECT jsonb_array_elements_text(board) AS value
  ) t;

  total := array_length(all_cards, 1);
  IF total < 5 THEN RETURN 0; END IF;

  FOR i1 IN 1..(total - 4) LOOP
    FOR i2 IN (i1 + 1)..(total - 3) LOOP
      FOR i3 IN (i2 + 1)..(total - 2) LOOP
        FOR i4 IN (i3 + 1)..(total - 1) LOOP
          FOR i5 IN (i4 + 1)..total LOOP
            combo := ARRAY[all_cards[i1], all_cards[i2], all_cards[i3], all_cards[i4], all_cards[i5]];
            current_strength := poker_evaluate_5cards(combo);
            IF current_strength > best THEN
              best := current_strength;
            END IF;
          END LOOP;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN best;
END;
$function$;

-- Русское название руки по силе
CREATE OR REPLACE FUNCTION public.poker_hand_name(strength bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  hand_type INT;
BEGIN
  hand_type := (strength / 759375)::INT;
  RETURN CASE hand_type
    WHEN 9 THEN 'Роял-флеш'
    WHEN 8 THEN 'Стрит-флеш'
    WHEN 7 THEN 'Каре'
    WHEN 6 THEN 'Фулл-хаус'
    WHEN 5 THEN 'Флеш'
    WHEN 4 THEN 'Стрит'
    WHEN 3 THEN 'Сет'
    WHEN 2 THEN 'Две пары'
    WHEN 1 THEN 'Пара'
    ELSE 'Старшая карта'
  END;
END;
$function$;
