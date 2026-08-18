-- ============================================================
-- 026_poker.sql
-- Покер v42 — фундамент (схема + лобби + sit/stand)
-- Игровая логика (раздача, торги, оценка) будет в v43 → 027_poker_gameplay.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.poker_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  table_type TEXT NOT NULL DEFAULT 'cash' CHECK (table_type IN ('cash', 'sng')),
  max_players INT NOT NULL DEFAULT 6 CHECK (max_players BETWEEN 2 AND 9),
  small_blind BIGINT NOT NULL CHECK (small_blind > 0),
  big_blind BIGINT NOT NULL CHECK (big_blind >= small_blind),
  min_buy_in BIGINT NOT NULL CHECK (min_buy_in > 0),
  max_buy_in BIGINT NOT NULL CHECK (max_buy_in >= min_buy_in),
  allow_rebuy BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  dealer_position INT,
  current_hand_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS poker_tables_status_idx ON public.poker_tables(status, created_at DESC);
CREATE INDEX IF NOT EXISTS poker_tables_creator_idx ON public.poker_tables(creator_id);

CREATE TABLE IF NOT EXISTS public.poker_seats (
  table_id UUID NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  position INT NOT NULL CHECK (position BETWEEN 0 AND 8),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chips BIGINT NOT NULL DEFAULT 0 CHECK (chips >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sitting_out', 'left')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_id, position),
  UNIQUE (table_id, user_id)
);

CREATE INDEX IF NOT EXISTS poker_seats_user_idx ON public.poker_seats(user_id);
CREATE INDEX IF NOT EXISTS poker_seats_table_idx ON public.poker_seats(table_id);

ALTER TABLE public.poker_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads tables" ON public.poker_tables;
CREATE POLICY "Anyone reads tables"
  ON public.poker_tables FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone reads seats" ON public.poker_seats;
CREATE POLICY "Anyone reads seats"
  ON public.poker_seats FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Creator can delete empty table" ON public.poker_tables;
CREATE POLICY "Creator can delete empty table"
  ON public.poker_tables FOR DELETE
  USING (
    creator_id = auth.uid()
    AND status = 'waiting'
    AND (SELECT COUNT(*) FROM public.poker_seats WHERE table_id = poker_tables.id) <= 1
  );

CREATE OR REPLACE FUNCTION public.poker_tables_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS poker_tables_updated_at ON public.poker_tables;
CREATE TRIGGER poker_tables_updated_at BEFORE UPDATE ON public.poker_tables
  FOR EACH ROW EXECUTE FUNCTION public.poker_tables_set_updated_at();

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_tables;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'poker_tables уже в публикации'; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_seats;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'poker_seats уже в публикации'; END;
END $$;

CREATE OR REPLACE FUNCTION public.create_poker_table(
  name_param TEXT,
  table_type_param TEXT,
  max_players_param INT,
  small_blind_param BIGINT,
  big_blind_param BIGINT,
  min_buy_in_param BIGINT,
  max_buy_in_param BIGINT,
  allow_rebuy_param BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  new_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF max_players_param < 2 OR max_players_param > 9 THEN RAISE EXCEPTION 'max_players must be 2-9'; END IF;
  IF small_blind_param <= 0 OR big_blind_param < small_blind_param THEN RAISE EXCEPTION 'Invalid blinds'; END IF;
  IF max_buy_in_param < min_buy_in_param THEN RAISE EXCEPTION 'max_buy_in must be >= min_buy_in'; END IF;
  IF length(trim(name_param)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;

  INSERT INTO public.poker_tables (
    name, creator_id, table_type, max_players,
    small_blind, big_blind, min_buy_in, max_buy_in, allow_rebuy
  )
  VALUES (
    trim(name_param), uid, table_type_param, max_players_param,
    small_blind_param, big_blind_param, min_buy_in_param, max_buy_in_param, allow_rebuy_param
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'table_id', new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_poker_table(TEXT, TEXT, INT, BIGINT, BIGINT, BIGINT, BIGINT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.create_poker_table(TEXT, TEXT, INT, BIGINT, BIGINT, BIGINT, BIGINT, BOOLEAN) TO authenticated;

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
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO tbl FROM public.poker_tables WHERE id = table_id_param FOR UPDATE;
  IF tbl IS NULL THEN RAISE EXCEPTION 'Table not found'; END IF;

  IF buy_in_param < tbl.min_buy_in OR buy_in_param > tbl.max_buy_in THEN
    RAISE EXCEPTION 'Buy-in must be between % and %', tbl.min_buy_in, tbl.max_buy_in;
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
  IF current_balance IS NULL OR current_balance < buy_in_param THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.wallets SET balance = balance - buy_in_param WHERE user_id = uid;
  INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (uid, 'game_buyin', -buy_in_param, 'Buy-in покер: ' || tbl.name,
            jsonb_build_object('table_id', table_id_param));

  INSERT INTO public.poker_seats (table_id, position, user_id, chips)
  VALUES (table_id_param, position_param, uid, buy_in_param);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.poker_sit_down(UUID, INT, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.poker_sit_down(UUID, INT, BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.poker_stand_up(
  table_id_param UUID
)
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

  IF seat.chips > 0 THEN
    UPDATE public.wallets SET balance = balance + seat.chips WHERE user_id = uid;
    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
      VALUES (uid, 'game_cashout', seat.chips, 'Cash-out покер: ' || tbl.name,
              jsonb_build_object('table_id', table_id_param));
  END IF;

  DELETE FROM public.poker_seats WHERE table_id = table_id_param AND user_id = uid;

  RETURN jsonb_build_object('ok', true, 'returned', seat.chips);
END;
$$;

REVOKE ALL ON FUNCTION public.poker_stand_up(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.poker_stand_up(UUID) TO authenticated;
