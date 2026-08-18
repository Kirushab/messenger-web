-- ============================================================
-- 024_event_expenses.sql
-- События — итерация C (v40): расходы (split bill)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'RUB',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_expenses_event_idx ON public.event_expenses(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_expenses_payer_idx ON public.event_expenses(payer_id);

-- На кого распределена каждая трата
CREATE TABLE IF NOT EXISTS public.event_expense_shares (
  expense_id UUID NOT NULL REFERENCES public.event_expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  share NUMERIC(12, 2) NOT NULL CHECK (share > 0),
  PRIMARY KEY (expense_id, user_id)
);

CREATE INDEX IF NOT EXISTS expense_shares_user_idx ON public.event_expense_shares(user_id);

-- Зафиксированные расчёты ("Иван отдал Кириллу 500")
CREATE TABLE IF NOT EXISTS public.event_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'RUB',
  note TEXT,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS settlements_event_idx ON public.event_settlements(event_id, settled_at DESC);

-- RLS
ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_expense_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_settlements ENABLE ROW LEVEL SECURITY;

-- Видят все участники события
DROP POLICY IF EXISTS "Members read expenses" ON public.event_expenses;
CREATE POLICY "Members read expenses"
  ON public.event_expenses FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_expenses.event_id AND em.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members read shares" ON public.event_expense_shares;
CREATE POLICY "Members read shares"
  ON public.event_expense_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_expenses ee
      JOIN public.event_members em ON em.event_id = ee.event_id
      WHERE ee.id = event_expense_shares.expense_id AND em.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members read settlements" ON public.event_settlements;
CREATE POLICY "Members read settlements"
  ON public.event_settlements FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_settlements.event_id AND em.user_id = auth.uid())
  );

-- INSERT: только участник события (через RPC). Прямой INSERT запрещён
-- UPDATE/DELETE: только payer/from_user

DROP POLICY IF EXISTS "Payer can update expense" ON public.event_expenses;
CREATE POLICY "Payer can update expense"
  ON public.event_expenses FOR UPDATE
  USING (auth.uid() = payer_id);

DROP POLICY IF EXISTS "Payer can delete expense" ON public.event_expenses;
CREATE POLICY "Payer can delete expense"
  ON public.event_expenses FOR DELETE
  USING (auth.uid() = payer_id);

-- Триггеры updated_at
CREATE OR REPLACE FUNCTION public.event_expenses_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS event_expenses_updated_at ON public.event_expenses;
CREATE TRIGGER event_expenses_updated_at BEFORE UPDATE ON public.event_expenses FOR EACH ROW EXECUTE FUNCTION public.event_expenses_set_updated_at();

-- Realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_expenses;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'event_expenses уже в публикации'; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_expense_shares;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'event_expense_shares уже в публикации'; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_settlements;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'event_settlements уже в публикации'; END;
END $$;

-- ============================================================
-- RPC: создание траты с распределением одной транзакцией
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_event_expense(
  event_id_param UUID,
  title_param TEXT,
  amount_param NUMERIC,
  currency_param TEXT,
  shares_param JSONB,         -- [{user_id, share}, ...]
  paid_at_param TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  ev RECORD;
  expense_id UUID;
  share_row JSONB;
  total_share NUMERIC := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF amount_param <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF length(trim(title_param)) = 0 THEN RAISE EXCEPTION 'Title required'; END IF;

  -- Проверка членства
  SELECT * INTO ev FROM public.events WHERE id = event_id_param;
  IF ev IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_members
    WHERE event_id = event_id_param AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this event';
  END IF;

  -- Создаём трату
  INSERT INTO public.event_expenses (event_id, payer_id, title, amount, currency, paid_at)
  VALUES (event_id_param, uid, trim(title_param), amount_param, COALESCE(currency_param, 'RUB'), paid_at_param)
  RETURNING id INTO expense_id;

  -- Создаём распределение по shares
  FOR share_row IN SELECT * FROM jsonb_array_elements(shares_param) LOOP
    INSERT INTO public.event_expense_shares (expense_id, user_id, share)
    VALUES (
      expense_id,
      (share_row->>'user_id')::UUID,
      (share_row->>'share')::NUMERIC
    );
    total_share := total_share + (share_row->>'share')::NUMERIC;
  END LOOP;

  -- Sanity check: сумма shares должна быть равна amount (с погрешностью 0.01)
  IF abs(total_share - amount_param) > 0.01 THEN
    RAISE EXCEPTION 'Sum of shares (%) must equal amount (%)', total_share, amount_param;
  END IF;

  RETURN jsonb_build_object('ok', true, 'expense_id', expense_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_event_expense(UUID, TEXT, NUMERIC, TEXT, JSONB, TIMESTAMPTZ) FROM public;
GRANT EXECUTE ON FUNCTION public.create_event_expense(UUID, TEXT, NUMERIC, TEXT, JSONB, TIMESTAMPTZ) TO authenticated;

-- ============================================================
-- RPC: фиксация settlement
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_event_settlement(
  event_id_param UUID,
  to_user_id_param UUID,
  amount_param NUMERIC,
  currency_param TEXT DEFAULT 'RUB',
  note_param TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF amount_param <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF uid = to_user_id_param THEN RAISE EXCEPTION 'Cannot settle to yourself'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_members
    WHERE event_id = event_id_param AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this event';
  END IF;

  INSERT INTO public.event_settlements (event_id, from_user_id, to_user_id, amount, currency, note)
  VALUES (event_id_param, uid, to_user_id_param, amount_param, currency_param, note_param);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.create_event_settlement(UUID, UUID, NUMERIC, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.create_event_settlement(UUID, UUID, NUMERIC, TEXT, TEXT) TO authenticated;
