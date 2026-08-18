-- 050_event_wishlist_budget.sql
-- Wishlist подарков + Бюджет + Дресс-код для событий.

-- ============================================================
-- 1. Новые поля в events
-- ============================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS budget_per_person BIGINT,
  ADD COLUMN IF NOT EXISTS budget_currency TEXT,
  ADD COLUMN IF NOT EXISTS dress_code TEXT,
  ADD COLUMN IF NOT EXISTS is_birthday BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 2. Wishlist
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  image_url TEXT,
  price_estimate BIGINT,
  price_currency TEXT,
  position INT NOT NULL DEFAULT 0,
  reserved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reserved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_wishlist_event_idx ON public.event_wishlist_items(event_id, position);
CREATE INDEX IF NOT EXISTS event_wishlist_reserved_idx ON public.event_wishlist_items(reserved_by);

ALTER TABLE public.event_wishlist_items ENABLE ROW LEVEL SECURITY;

-- Видят: все участники + организатор
DROP POLICY IF EXISTS "event_wishlist_select" ON public.event_wishlist_items;
CREATE POLICY "event_wishlist_select" ON public.event_wishlist_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_wishlist_items.event_id AND em.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_wishlist_items.event_id AND e.creator_id = auth.uid())
  );

-- Создавать и удалять пункты — только организатор (это его список желаний)
DROP POLICY IF EXISTS "event_wishlist_insert" ON public.event_wishlist_items;
CREATE POLICY "event_wishlist_insert" ON public.event_wishlist_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_wishlist_items.event_id AND e.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_wishlist_delete" ON public.event_wishlist_items;
CREATE POLICY "event_wishlist_delete" ON public.event_wishlist_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_wishlist_items.event_id AND e.creator_id = auth.uid())
  );

-- UPDATE — для бронирования. Доступно участникам и организатору.
-- (Логика «бронь по своему UID» в RPC ниже.)
DROP POLICY IF EXISTS "event_wishlist_update" ON public.event_wishlist_items;
CREATE POLICY "event_wishlist_update" ON public.event_wishlist_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_wishlist_items.event_id AND em.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_wishlist_items.event_id AND e.creator_id = auth.uid())
  );

-- Realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_wishlist_items;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================================
-- 3. RPC: забронировать / снять бронь (атомарно)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reserve_wishlist_item(item_id_param UUID, reserve_param BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  item RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT w.*, e.creator_id, e.is_birthday INTO item
  FROM public.event_wishlist_items w
  JOIN public.events e ON e.id = w.event_id
  WHERE w.id = item_id_param
  FOR UPDATE;

  IF item IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;

  -- Проверка членства в событии
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members WHERE event_id = item.event_id AND user_id = uid
  ) AND item.creator_id <> uid THEN
    RAISE EXCEPTION 'Not a member of this event';
  END IF;

  -- Организатор-именинник не может бронировать (его подарок-сюрприз)
  IF item.is_birthday AND item.creator_id = uid THEN
    RAISE EXCEPTION 'Organizer cannot reserve own wishlist';
  END IF;

  IF reserve_param THEN
    IF item.reserved_by IS NOT NULL AND item.reserved_by <> uid THEN
      RAISE EXCEPTION 'Already reserved by someone else';
    END IF;
    UPDATE public.event_wishlist_items
      SET reserved_by = uid, reserved_at = NOW()
      WHERE id = item_id_param;
  ELSE
    -- Снять бронь — только свою
    IF item.reserved_by IS DISTINCT FROM uid THEN
      RAISE EXCEPTION 'Not your reservation';
    END IF;
    UPDATE public.event_wishlist_items
      SET reserved_by = NULL, reserved_at = NULL
      WHERE id = item_id_param;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_wishlist_item(UUID, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.reserve_wishlist_item(UUID, BOOLEAN) TO authenticated;
