-- ============================================================
-- 027_poker_gameplay.sql
-- v43 (часть 1/3): Таблицы для игровой логики покера
-- Реконструирована из живой БД (применена ранее)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.poker_hands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  hand_number INT NOT NULL,
  dealer_position INT NOT NULL,
  current_round TEXT NOT NULL DEFAULT 'preflop'
    CHECK (current_round IN ('preflop','flop','turn','river','showdown','finished')),
  current_seat_position INT,
  board JSONB NOT NULL DEFAULT '[]'::JSONB,
  pot BIGINT NOT NULL DEFAULT 0,
  current_bet BIGINT NOT NULL DEFAULT 0,
  min_raise BIGINT NOT NULL DEFAULT 0,
  last_raiser_position INT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished')),
  winner_positions JSONB,
  winning_amount BIGINT,
  winning_hand_name TEXT,
  winning_hand_strength BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS poker_hands_table_idx ON public.poker_hands(table_id, hand_number DESC);

CREATE TABLE IF NOT EXISTS public.poker_hand_decks (
  hand_id UUID PRIMARY KEY REFERENCES public.poker_hands(id) ON DELETE CASCADE,
  remaining_deck JSONB NOT NULL,
  burn_cards JSONB NOT NULL DEFAULT '[]'::JSONB
);

CREATE TABLE IF NOT EXISTS public.poker_hole_cards (
  hand_id UUID NOT NULL REFERENCES public.poker_hands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  card1 TEXT NOT NULL,
  card2 TEXT NOT NULL,
  revealed BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (hand_id, user_id)
);
CREATE INDEX IF NOT EXISTS poker_hole_cards_hand_idx ON public.poker_hole_cards(hand_id);

CREATE TABLE IF NOT EXISTS public.poker_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id UUID NOT NULL REFERENCES public.poker_hands(id) ON DELETE CASCADE,
  sequence_num INT NOT NULL,
  seat_position INT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  round TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('fold','check','call','bet','raise','all_in','small_blind','big_blind')),
  amount BIGINT NOT NULL DEFAULT 0,
  total_bet_in_round BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hand_id, sequence_num)
);
CREATE INDEX IF NOT EXISTS poker_actions_hand_idx ON public.poker_actions(hand_id, sequence_num);

CREATE TABLE IF NOT EXISTS public.poker_round_state (
  hand_id UUID NOT NULL REFERENCES public.poker_hands(id) ON DELETE CASCADE,
  round TEXT NOT NULL,
  seat_position INT NOT NULL,
  bet_in_round BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','acted','folded','all_in')),
  PRIMARY KEY (hand_id, round, seat_position)
);

ALTER TABLE public.poker_hands         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_hand_decks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_hole_cards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_actions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_round_state   ENABLE ROW LEVEL SECURITY;

-- Все аутентифицированные читают раздачи, действия, состояние раунда
DROP POLICY IF EXISTS "Anyone reads hands" ON public.poker_hands;
CREATE POLICY "Anyone reads hands" ON public.poker_hands
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone reads actions" ON public.poker_actions;
CREATE POLICY "Anyone reads actions" ON public.poker_actions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone reads round state" ON public.poker_round_state;
CREATE POLICY "Anyone reads round state" ON public.poker_round_state
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Карманные карты: видит только свои, или раскрытые на showdown
DROP POLICY IF EXISTS "User sees own hole cards" ON public.poker_hole_cards;
CREATE POLICY "User sees own hole cards" ON public.poker_hole_cards
  FOR SELECT USING (user_id = auth.uid() OR revealed = true);

-- Колода - никому не видна (только SECURITY DEFINER функции)
DROP POLICY IF EXISTS "No one reads deck" ON public.poker_hand_decks;
CREATE POLICY "No one reads deck" ON public.poker_hand_decks
  FOR SELECT USING (false);

-- Realtime publication
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_hands;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'poker_hands уже'; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_actions;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'poker_actions уже'; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_round_state;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'round_state уже'; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_hole_cards;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'hole_cards уже'; END;
END $$;
