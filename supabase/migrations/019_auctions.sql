-- ============================================================
-- 019_auctions.sql
-- Аукционы привилегий в групповых чатах (v34)
-- Слепые ставки, токены сжигаются у победителя.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  min_bid BIGINT NOT NULL DEFAULT 50 CHECK (min_bid >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','cancelled')),
  winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  winning_amount BIGINT,
  total_pool BIGINT NOT NULL DEFAULT 0,
  message_id UUID,                                     -- ссылка на system-сообщение в чате
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auctions_conv_idx ON public.auctions(conversation_id, status);
CREATE INDEX IF NOT EXISTS auctions_active_idx ON public.auctions(status, ends_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS auctions_message_idx ON public.auctions(message_id);

CREATE TABLE IF NOT EXISTS public.auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (auction_id, user_id)
);

CREATE INDEX IF NOT EXISTS auction_bids_auction_idx ON public.auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS auction_bids_user_idx ON public.auction_bids(user_id);

ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

-- Аукционы видят все участники чата
DROP POLICY IF EXISTS "Members can read auctions" ON public.auctions;
CREATE POLICY "Members can read auctions"
  ON public.auctions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = auctions.conversation_id AND cm.user_id = auth.uid()
    )
  );

-- Ставки: пока активный — каждый видит только свою. После окончания — все участники чата видят все.
DROP POLICY IF EXISTS "Bid visibility rules" ON public.auction_bids;
CREATE POLICY "Bid visibility rules"
  ON public.auction_bids FOR SELECT
  USING (
    -- Своя ставка всегда видна
    user_id = auth.uid()
    OR
    -- Чужие — только если аукцион закончен И юзер участник чата
    EXISTS (
      SELECT 1 FROM public.auctions a
      JOIN public.conversation_members cm ON cm.conversation_id = a.conversation_id
      WHERE a.id = auction_bids.auction_id
        AND a.status IN ('ended','cancelled')
        AND cm.user_id = auth.uid()
    )
  );

-- Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'auctions уже в публикации';
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'auction_bids уже в публикации';
  END;
END $$;

-- Триггер updated_at
CREATE OR REPLACE FUNCTION public.auctions_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS auctions_updated_at ON public.auctions;
CREATE TRIGGER auctions_updated_at BEFORE UPDATE ON public.auctions FOR EACH ROW EXECUTE FUNCTION public.auctions_set_updated_at();

CREATE OR REPLACE FUNCTION public.auction_bids_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS auction_bids_updated_at ON public.auction_bids;
CREATE TRIGGER auction_bids_updated_at BEFORE UPDATE ON public.auction_bids FOR EACH ROW EXECUTE FUNCTION public.auction_bids_set_updated_at();

-- ============================================================
-- RPC: place_auction_bid
-- Атомарно: проверка активности, баланса, списание дельты с баланса
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_auction_bid(
  auction_id_param UUID,
  amount_param BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  auc RECORD;
  existing_bid BIGINT;
  delta BIGINT;
  current_balance BIGINT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF amount_param <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF amount_param > 1000000 THEN RAISE EXCEPTION 'Amount too large'; END IF;

  SELECT * INTO auc FROM public.auctions WHERE id = auction_id_param FOR UPDATE;
  IF auc IS NULL THEN RAISE EXCEPTION 'Auction not found'; END IF;
  IF auc.status <> 'active' THEN RAISE EXCEPTION 'Auction not active'; END IF;
  IF auc.ends_at <= NOW() THEN RAISE EXCEPTION 'Auction already ended'; END IF;
  IF amount_param < auc.min_bid THEN RAISE EXCEPTION 'Bid below minimum'; END IF;

  -- Проверка членства в чате
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = auc.conversation_id AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this chat';
  END IF;

  -- Существующая ставка
  SELECT amount INTO existing_bid
  FROM public.auction_bids
  WHERE auction_id = auction_id_param AND user_id = uid
  FOR UPDATE;

  IF existing_bid IS NOT NULL AND amount_param <= existing_bid THEN
    RAISE EXCEPTION 'New bid must be higher than current';
  END IF;

  delta := amount_param - COALESCE(existing_bid, 0);

  -- Списываем дельту с баланса
  SELECT balance INTO current_balance FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF current_balance IS NULL OR current_balance < delta THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.wallets SET balance = balance - delta WHERE user_id = uid;

  -- Транзакция
  INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (uid, 'auction_bid', -delta, 'Ставка на аукцион',
            jsonb_build_object('auction_id', auction_id_param));

  -- Сохраняем ставку (UPSERT)
  INSERT INTO public.auction_bids (auction_id, user_id, amount)
    VALUES (auction_id_param, uid, amount_param)
  ON CONFLICT (auction_id, user_id) DO UPDATE
    SET amount = amount_param;

  -- Обновляем total_pool
  UPDATE public.auctions
    SET total_pool = total_pool + delta
    WHERE id = auction_id_param;

  RETURN jsonb_build_object('ok', true, 'new_balance', current_balance - delta);
END;
$$;

REVOKE ALL ON FUNCTION public.place_auction_bid(UUID, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.place_auction_bid(UUID, BIGINT) TO authenticated;

-- ============================================================
-- RPC: finalize_auction
-- Определяет победителя, сжигает его ставку, возвращает остальным
-- Может вызвать любой участник чата ПОСЛЕ ends_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_auction(
  auction_id_param UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  auc RECORD;
  winner RECORD;
  bid_row RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO auc FROM public.auctions WHERE id = auction_id_param FOR UPDATE;
  IF auc IS NULL THEN RAISE EXCEPTION 'Auction not found'; END IF;

  IF auc.status <> 'active' THEN
    RETURN jsonb_build_object('ok', true, 'already_finalized', true);
  END IF;

  IF auc.ends_at > NOW() THEN
    RAISE EXCEPTION 'Auction not yet ended';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = auc.conversation_id AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this chat';
  END IF;

  -- Победитель: max amount, при ничьей — кто раньше поставил
  SELECT user_id, amount INTO winner
  FROM public.auction_bids
  WHERE auction_id = auction_id_param
  ORDER BY amount DESC, created_at ASC
  LIMIT 1;

  IF winner IS NULL THEN
    -- Никто не поставил
    UPDATE public.auctions
      SET status = 'ended', winner_id = NULL, winning_amount = NULL
      WHERE id = auction_id_param;
    RETURN jsonb_build_object('ok', true, 'no_bids', true);
  END IF;

  -- Возвращаем токены всем кроме победителя
  FOR bid_row IN
    SELECT user_id, amount FROM public.auction_bids
    WHERE auction_id = auction_id_param AND user_id <> winner.user_id
  LOOP
    UPDATE public.wallets
      SET balance = balance + bid_row.amount
      WHERE user_id = bid_row.user_id;

    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
      VALUES (bid_row.user_id, 'auction_refund', bid_row.amount, 'Возврат проигравшей ставки',
              jsonb_build_object('auction_id', auction_id_param));
  END LOOP;

  -- Запись о сжигании у победителя (баланс не возвращается)
  INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (winner.user_id, 'auction_burn', 0, 'Выигрышная ставка сожжена',
            jsonb_build_object('auction_id', auction_id_param, 'amount', winner.amount));

  -- Обновляем аукцион
  UPDATE public.auctions
    SET status = 'ended',
        winner_id = winner.user_id,
        winning_amount = winner.amount
    WHERE id = auction_id_param;

  RETURN jsonb_build_object('ok', true, 'winner_id', winner.user_id, 'amount', winner.amount);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_auction(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_auction(UUID) TO authenticated;

-- ============================================================
-- RPC: cancel_auction
-- Только создатель, только если статус = active
-- Возвращает все ставки участникам
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_auction(
  auction_id_param UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  auc RECORD;
  bid_row RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO auc FROM public.auctions WHERE id = auction_id_param FOR UPDATE;
  IF auc IS NULL THEN RAISE EXCEPTION 'Auction not found'; END IF;
  IF auc.creator_id <> uid THEN RAISE EXCEPTION 'Only creator can cancel'; END IF;
  IF auc.status <> 'active' THEN RAISE EXCEPTION 'Auction not active'; END IF;

  -- Возвращаем все ставки
  FOR bid_row IN
    SELECT user_id, amount FROM public.auction_bids
    WHERE auction_id = auction_id_param
  LOOP
    UPDATE public.wallets
      SET balance = balance + bid_row.amount
      WHERE user_id = bid_row.user_id;

    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
      VALUES (bid_row.user_id, 'auction_refund', bid_row.amount, 'Аукцион отменён',
              jsonb_build_object('auction_id', auction_id_param));
  END LOOP;

  UPDATE public.auctions SET status = 'cancelled' WHERE id = auction_id_param;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_auction(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_auction(UUID) TO authenticated;
