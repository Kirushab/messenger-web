-- 047_tinder_bets.sql
-- Виджет ставок в чате: оценка Tinder-поста по внешности через слепые/открытые ставки коинами.
-- Все ставки списываются у участников и зачисляются в кошелёк TINDER аккаунта.
-- Победитель = тот, кто сделал максимальную ставку.
-- Создавать tinder-bet может только Kirill (lirikb2002@gmail.com).

-- ============================================================
-- 1. Хелпер: текущий юзер - это Kirill?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_kirill()
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND email = 'lirikb2002@gmail.com'
  );
$$;

-- ============================================================
-- 2. Таблица tinder_bets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tinder_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  cover_url TEXT NOT NULL,            -- копия первой media-картинки поста (чтобы RLS posts не мешало)
  cover_mime TEXT,
  ends_at TIMESTAMPTZ NOT NULL,
  visible_bets BOOLEAN NOT NULL DEFAULT false, -- видны ли ставки до конца
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','cancelled')),
  winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  winning_amount BIGINT,
  total_pool BIGINT NOT NULL DEFAULT 0,
  message_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tinder_bets_conv_idx ON public.tinder_bets(conversation_id, status);
CREATE INDEX IF NOT EXISTS tinder_bets_active_idx ON public.tinder_bets(status, ends_at) WHERE status = 'active';

-- ============================================================
-- 3. Таблица ставок
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tinder_bet_stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID NOT NULL REFERENCES public.tinder_bets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bet_id, user_id)
);

CREATE INDEX IF NOT EXISTS tinder_bet_stakes_bet_idx ON public.tinder_bet_stakes(bet_id);

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.tinder_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tinder_bet_stakes ENABLE ROW LEVEL SECURITY;

-- Bets видят все участники чата
DROP POLICY IF EXISTS "tinder_bets_select" ON public.tinder_bets;
CREATE POLICY "tinder_bets_select" ON public.tinder_bets
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = tinder_bets.conversation_id AND cm.user_id = auth.uid()
    )
  );

-- Ставки:
--   * свою — всегда видишь
--   * чужие — видны если visible_bets = true (открытый режим) ИЛИ bet завершён
DROP POLICY IF EXISTS "tinder_bet_stakes_select" ON public.tinder_bet_stakes;
CREATE POLICY "tinder_bet_stakes_select" ON public.tinder_bet_stakes
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tinder_bets b
      JOIN public.conversation_members cm ON cm.conversation_id = b.conversation_id
      WHERE b.id = tinder_bet_stakes.bet_id
        AND cm.user_id = auth.uid()
        AND (b.visible_bets = true OR b.status IN ('ended','cancelled'))
    )
  );

-- Realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tinder_bets; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tinder_bet_stakes; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================================
-- 5. RPC: create_tinder_bet — создаёт ставку (только Kirill)
-- Возвращает ID нового bet и URL обложки
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_tinder_bet(
  conversation_id_param UUID,
  post_id_param UUID,
  duration_minutes_param INT,
  visible_bets_param BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  bet_id UUID;
  cover RECORD;
  ends TIMESTAMPTZ;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_kirill() THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF duration_minutes_param < 5 OR duration_minutes_param > 60*24*7 THEN
    RAISE EXCEPTION 'Duration must be 5 minutes to 7 days';
  END IF;
  -- Проверка членства в чате
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conversation_id_param AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this chat';
  END IF;
  -- Получаем обложку поста
  SELECT file_url, mime_type INTO cover
  FROM public.post_media
  WHERE post_id = post_id_param
  ORDER BY position
  LIMIT 1;
  IF cover IS NULL THEN RAISE EXCEPTION 'Post has no media'; END IF;

  ends := NOW() + (duration_minutes_param || ' minutes')::INTERVAL;

  INSERT INTO public.tinder_bets (
    conversation_id, creator_id, post_id, cover_url, cover_mime,
    ends_at, visible_bets, status, total_pool
  ) VALUES (
    conversation_id_param, uid, post_id_param, cover.file_url, cover.mime_type,
    ends, visible_bets_param, 'active', 0
  ) RETURNING id INTO bet_id;

  RETURN jsonb_build_object('ok', true, 'bet_id', bet_id, 'ends_at', ends, 'cover_url', cover.file_url);
END;
$$;

REVOKE ALL ON FUNCTION public.create_tinder_bet(UUID, UUID, INT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.create_tinder_bet(UUID, UUID, INT, BOOLEAN) TO authenticated;

-- ============================================================
-- 6. RPC: place_tinder_bet_stake — поставить или повысить
-- Сразу списываем дельту с юзера И зачисляем в кошелёк TINDER.
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_tinder_bet_stake(
  bet_id_param UUID,
  amount_param BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  bet RECORD;
  existing_amount BIGINT;
  delta BIGINT;
  current_balance BIGINT;
  tinder_id UUID := public.tinder_user_id();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF amount_param <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF amount_param > 1000000 THEN RAISE EXCEPTION 'Amount too large'; END IF;
  IF tinder_id IS NULL THEN RAISE EXCEPTION 'TINDER account not configured'; END IF;
  IF uid = tinder_id THEN RAISE EXCEPTION 'TINDER account cannot bet'; END IF;

  SELECT * INTO bet FROM public.tinder_bets WHERE id = bet_id_param FOR UPDATE;
  IF bet IS NULL THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF bet.status <> 'active' THEN RAISE EXCEPTION 'Bet not active'; END IF;
  IF bet.ends_at <= NOW() THEN RAISE EXCEPTION 'Bet already ended'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = bet.conversation_id AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this chat';
  END IF;

  SELECT amount INTO existing_amount
  FROM public.tinder_bet_stakes
  WHERE bet_id = bet_id_param AND user_id = uid
  FOR UPDATE;

  IF existing_amount IS NOT NULL AND amount_param <= existing_amount THEN
    RAISE EXCEPTION 'New amount must be higher than current';
  END IF;
  delta := amount_param - COALESCE(existing_amount, 0);

  -- Списываем у юзера
  SELECT balance INTO current_balance FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF current_balance IS NULL OR current_balance < delta THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  UPDATE public.wallets SET balance = balance - delta WHERE user_id = uid;

  -- Зачисляем TINDER (создаём кошелёк если нужно)
  INSERT INTO public.wallets (user_id, balance, lifetime_earned)
    VALUES (tinder_id, delta, delta)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.wallets.balance + delta,
        lifetime_earned = public.wallets.lifetime_earned + delta;

  -- Транзакции
  INSERT INTO public.transactions (user_id, type, amount, counterpart_id, description, metadata)
    VALUES (uid, 'tinder_bet_stake', -delta, tinder_id, 'Ставка на Tinder', jsonb_build_object('bet_id', bet_id_param));
  INSERT INTO public.transactions (user_id, type, amount, counterpart_id, description, metadata)
    VALUES (tinder_id, 'tinder_bet_receive', delta, uid, 'Ставка от ' || COALESCE((SELECT display_name FROM public.users WHERE id = uid),'user'), jsonb_build_object('bet_id', bet_id_param));

  -- UPSERT ставки
  INSERT INTO public.tinder_bet_stakes (bet_id, user_id, amount)
    VALUES (bet_id_param, uid, amount_param)
  ON CONFLICT (bet_id, user_id) DO UPDATE SET amount = amount_param, updated_at = NOW();

  UPDATE public.tinder_bets
    SET total_pool = total_pool + delta, updated_at = NOW()
    WHERE id = bet_id_param;

  RETURN jsonb_build_object('ok', true, 'new_balance', current_balance - delta, 'my_amount', amount_param);
END;
$$;

REVOKE ALL ON FUNCTION public.place_tinder_bet_stake(UUID, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.place_tinder_bet_stake(UUID, BIGINT) TO authenticated;

-- ============================================================
-- 7. RPC: finalize_tinder_bet — определяет победителя
-- Может вызвать любой участник после ends_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_tinder_bet(
  bet_id_param UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  bet RECORD;
  win RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO bet FROM public.tinder_bets WHERE id = bet_id_param FOR UPDATE;
  IF bet IS NULL THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF bet.status <> 'active' THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;
  IF bet.ends_at > NOW() THEN RAISE EXCEPTION 'Bet not ended yet'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = bet.conversation_id AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this chat';
  END IF;

  -- Победитель — самая высокая ставка (если ставок не было, остаётся NULL)
  SELECT user_id, amount INTO win
  FROM public.tinder_bet_stakes
  WHERE bet_id = bet_id_param
  ORDER BY amount DESC, created_at ASC
  LIMIT 1;

  UPDATE public.tinder_bets
    SET status = 'ended',
        winner_id = win.user_id,
        winning_amount = win.amount,
        updated_at = NOW()
    WHERE id = bet_id_param;

  RETURN jsonb_build_object('ok', true, 'winner_id', win.user_id, 'winning_amount', win.amount);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_tinder_bet(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_tinder_bet(UUID) TO authenticated;

-- ============================================================
-- 8. Cron: автоматическая финализация каждые 60 секунд
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cron_schedule') THEN
    -- cron уже в наличии (через pg_cron)
    PERFORM cron.unschedule('tinder-bets-finalize')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tinder-bets-finalize');
    PERFORM cron.schedule('tinder-bets-finalize', '* * * * *', $cron$
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN SELECT id FROM public.tinder_bets WHERE status = 'active' AND ends_at <= NOW() LOOP
          UPDATE public.tinder_bets
            SET status = 'ended',
                winner_id = (SELECT user_id FROM public.tinder_bet_stakes WHERE bet_id = r.id ORDER BY amount DESC, created_at ASC LIMIT 1),
                winning_amount = (SELECT amount FROM public.tinder_bet_stakes WHERE bet_id = r.id ORDER BY amount DESC, created_at ASC LIMIT 1),
                updated_at = NOW()
            WHERE id = r.id;
        END LOOP;
      END $$;
    $cron$);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available, skipping schedule';
END $$;
