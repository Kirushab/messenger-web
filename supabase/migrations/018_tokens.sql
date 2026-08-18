-- ============================================================
-- 018_tokens.sql
-- Внутренние токены (v33)
-- Чисто игровая валюта (никакой связи с реальными деньгами).
-- Стартовый бонус 1000 при регистрации, daily check-in 10/день,
-- P2P-переводы, история транзакций.
-- ============================================================

-- Кошелёк (один на юзера)
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallets_lifetime_idx ON public.wallets(lifetime_earned DESC);

-- История транзакций
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                    -- 'starter' | 'daily_checkin' | 'streak_bonus' | 'transfer_in' | 'transfer_out' | 'gift_sent' | 'gift_received' | 'post_reward' | 'like_received' | 'comment_received' | 'game_buyin' | 'game_win' | 'auction_bid' | 'auction_win' | etc
  amount BIGINT NOT NULL,                -- Положительная для входящих, отрицательная для исходящих
  counterpart_id UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- Для transfer/gift — другой юзер
  description TEXT,
  metadata JSONB,                        -- Доп.данные (ID игры, ID поста, ID аукциона и т.д.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_user_idx ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_type_idx ON public.transactions(type);
CREATE INDEX IF NOT EXISTS transactions_user_type_date_idx ON public.transactions(user_id, type, created_at DESC);

-- RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Свой кошелёк видишь, чужие — нельзя (только сумма lifetime для лидербордов через отдельную view если понадобится)
DROP POLICY IF EXISTS "Users can read own wallet" ON public.wallets;
CREATE POLICY "Users can read own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

-- Транзакции — видишь только свои (где ты user_id)
DROP POLICY IF EXISTS "Users can read own transactions" ON public.transactions;
CREATE POLICY "Users can read own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE напрямую запрещены — только через RPC функции с SECURITY DEFINER
-- Это защищает от того чтобы юзер не мог вручную начислить себе токенов

-- Триггер updated_at для wallets
CREATE OR REPLACE FUNCTION public.wallets_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wallets_updated_at ON public.wallets;
CREATE TRIGGER wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.wallets_set_updated_at();

-- Realtime для синхронизации баланса между устройствами
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'wallets уже в публикации';
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'transactions уже в публикации';
  END;
END $$;

-- ============================================================
-- RPC функции
-- ============================================================

-- 1) P2P-перевод токенов другому юзеру
CREATE OR REPLACE FUNCTION public.transfer_tokens(
  to_user_id_param UUID,
  amount_param BIGINT,
  description_param TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_user UUID := auth.uid();
  current_balance BIGINT;
BEGIN
  IF from_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF from_user = to_user_id_param THEN
    RAISE EXCEPTION 'Cannot transfer to yourself';
  END IF;
  IF amount_param <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF amount_param > 1000000 THEN
    RAISE EXCEPTION 'Amount too large';
  END IF;

  -- Lock + проверка баланса
  SELECT balance INTO current_balance
  FROM public.wallets
  WHERE user_id = from_user
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
  IF current_balance < amount_param THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Проверим что получатель существует
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = to_user_id_param) THEN
    RAISE EXCEPTION 'Recipient not found';
  END IF;

  -- Списываем у отправителя
  UPDATE public.wallets
    SET balance = balance - amount_param
    WHERE user_id = from_user;

  -- Начисляем получателю (создаём кошелёк если нет)
  INSERT INTO public.wallets (user_id, balance, lifetime_earned)
    VALUES (to_user_id_param, amount_param, amount_param)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + amount_param,
        lifetime_earned = wallets.lifetime_earned + amount_param;

  -- Записываем 2 транзакции
  INSERT INTO public.transactions (user_id, type, amount, counterpart_id, description) VALUES
    (from_user, 'transfer_out', -amount_param, to_user_id_param, description_param),
    (to_user_id_param, 'transfer_in', amount_param, from_user, description_param);

  RETURN jsonb_build_object('ok', true, 'new_balance', current_balance - amount_param);
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_tokens(UUID, BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.transfer_tokens(UUID, BIGINT, TEXT) TO authenticated;

-- 2) Daily check-in
CREATE OR REPLACE FUNCTION public.claim_daily_checkin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  last_checkin TIMESTAMPTZ;
  reward BIGINT := 10;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Последний daily check-in
  SELECT created_at INTO last_checkin
  FROM public.transactions
  WHERE user_id = uid AND type = 'daily_checkin'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Если уже сегодня — отказ
  IF last_checkin IS NOT NULL AND last_checkin::date = NOW()::date THEN
    RAISE EXCEPTION 'Already claimed today';
  END IF;

  -- Начисляем
  INSERT INTO public.wallets (user_id, balance, lifetime_earned)
    VALUES (uid, reward, reward)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + reward,
        lifetime_earned = wallets.lifetime_earned + reward;

  INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (uid, 'daily_checkin', reward, 'Ежедневный заход');

  RETURN jsonb_build_object('ok', true, 'amount', reward);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_checkin() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin() TO authenticated;

-- 3) Универсальная функция начисления за активность (для постов, лайков, комментов и т.д.)
-- Вызывается из других триггеров. Не требует SECURITY DEFINER если вызывается из других функций
-- но мы делаем её доступной для клиента с проверкой типа (чтобы клиент не мог любые типы дёргать)
CREATE OR REPLACE FUNCTION public.award_tokens(
  user_id_param UUID,
  amount_param BIGINT,
  type_param TEXT,
  description_param TEXT DEFAULT NULL,
  metadata_param JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF amount_param <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  INSERT INTO public.wallets (user_id, balance, lifetime_earned)
    VALUES (user_id_param, amount_param, amount_param)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + amount_param,
        lifetime_earned = wallets.lifetime_earned + amount_param;

  INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (user_id_param, type_param, amount_param, description_param, metadata_param);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.award_tokens(UUID, BIGINT, TEXT, TEXT, JSONB) FROM public;
-- Эту функцию НЕ делаем доступной клиенту напрямую — будем вызывать только из других серверных функций
-- GRANT EXECUTE ON FUNCTION public.award_tokens(UUID, BIGINT, TEXT, TEXT, JSONB) TO authenticated;

-- ============================================================
-- Триггер: при создании нового юзера автоматически создаём кошелёк со стартовым 1000
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance, lifetime_earned)
    VALUES (NEW.id, 1000, 1000)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (NEW.id, 'starter', 1000, 'Стартовый бонус');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_wallet_create ON public.users;
CREATE TRIGGER on_user_wallet_create
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_wallet();

-- ============================================================
-- Backfill для существующих юзеров: создаём кошельки и стартовые транзакции
-- ============================================================
INSERT INTO public.wallets (user_id, balance, lifetime_earned)
SELECT id, 1000, 1000 FROM public.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.transactions (user_id, type, amount, description)
SELECT u.id, 'starter', 1000, 'Стартовый бонус'
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t
  WHERE t.user_id = u.id AND t.type = 'starter'
);
