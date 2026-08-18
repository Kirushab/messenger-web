-- 052_event_trip_extras.sql
-- Личный багаж, места к посещению, shopping list, транспорт, категории бюджета.

-- ============================================================
-- 0. Категории к расходам (event_expenses)
-- ============================================================
ALTER TABLE public.event_expenses
  ADD COLUMN IF NOT EXISTS category TEXT;

-- ============================================================
-- 1. Личный багаж (у каждого свой)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_packing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_packing_user_event_idx ON public.event_packing_items(user_id, event_id, position);

ALTER TABLE public.event_packing_items ENABLE ROW LEVEL SECURITY;

-- Каждый видит и редактирует только свой багаж
DROP POLICY IF EXISTS "event_packing_select" ON public.event_packing_items;
CREATE POLICY "event_packing_select" ON public.event_packing_items
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "event_packing_insert" ON public.event_packing_items;
CREATE POLICY "event_packing_insert" ON public.event_packing_items
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_packing_items.event_id AND em.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_packing_items.event_id AND e.creator_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "event_packing_update" ON public.event_packing_items;
CREATE POLICY "event_packing_update" ON public.event_packing_items
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "event_packing_delete" ON public.event_packing_items;
CREATE POLICY "event_packing_delete" ON public.event_packing_items
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 2. Места к посещению (общее для участников)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location_name TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  image_url TEXT,
  url TEXT,
  category TEXT, -- 'restaurant', 'attraction', 'bar', 'museum' и т.д.
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_places_event_idx ON public.event_places(event_id, position);

ALTER TABLE public.event_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_places_select" ON public.event_places;
CREATE POLICY "event_places_select" ON public.event_places
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_places.event_id AND em.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_places.event_id AND e.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_places_insert" ON public.event_places;
CREATE POLICY "event_places_insert" ON public.event_places
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_places.event_id AND em.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_places.event_id AND e.creator_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "event_places_update" ON public.event_places;
CREATE POLICY "event_places_update" ON public.event_places
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_places.event_id AND e.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_places_delete" ON public.event_places;
CREATE POLICY "event_places_delete" ON public.event_places
  FOR DELETE TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_places.event_id AND e.creator_id = auth.uid())
  );

-- ============================================================
-- 3. Комментарии к местам
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_place_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES public.event_places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_place_comments_place_idx ON public.event_place_comments(place_id, created_at);

ALTER TABLE public.event_place_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_place_comments_select" ON public.event_place_comments;
CREATE POLICY "event_place_comments_select" ON public.event_place_comments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.event_places p
      JOIN public.events e ON e.id = p.event_id
      WHERE p.id = event_place_comments.place_id
        AND (
          e.creator_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = p.event_id AND em.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "event_place_comments_insert" ON public.event_place_comments;
CREATE POLICY "event_place_comments_insert" ON public.event_place_comments
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.event_places p
      JOIN public.events e ON e.id = p.event_id
      WHERE p.id = event_place_comments.place_id
        AND (
          e.creator_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = p.event_id AND em.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "event_place_comments_delete" ON public.event_place_comments;
CREATE POLICY "event_place_comments_delete" ON public.event_place_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 4. Shopping list (общий)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  qty TEXT, -- "2 кг", "5 шт"
  done BOOLEAN NOT NULL DEFAULT false,
  done_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  done_at TIMESTAMPTZ,
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_shopping_event_idx ON public.event_shopping_items(event_id, position);

ALTER TABLE public.event_shopping_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_shopping_select" ON public.event_shopping_items;
CREATE POLICY "event_shopping_select" ON public.event_shopping_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_shopping_items.event_id AND em.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_shopping_items.event_id AND e.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_shopping_insert" ON public.event_shopping_items;
CREATE POLICY "event_shopping_insert" ON public.event_shopping_items
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_shopping_items.event_id AND em.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_shopping_items.event_id AND e.creator_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "event_shopping_update" ON public.event_shopping_items;
CREATE POLICY "event_shopping_update" ON public.event_shopping_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_shopping_items.event_id AND em.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_shopping_items.event_id AND e.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_shopping_delete" ON public.event_shopping_items;
CREATE POLICY "event_shopping_delete" ON public.event_shopping_items
  FOR DELETE TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_shopping_items.event_id AND e.creator_id = auth.uid())
  );

-- ============================================================
-- 5. Транспорт (рейсы / поезда / автобусы / машины)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- кто едет; NULL = общая инфа
  kind TEXT NOT NULL DEFAULT 'flight', -- flight | train | bus | car | other
  carrier TEXT,
  number TEXT,
  from_place TEXT,
  to_place TEXT,
  depart_at TIMESTAMPTZ,
  arrive_at TIMESTAMPTZ,
  seat TEXT,
  url TEXT,
  notes TEXT,
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_transport_event_idx ON public.event_transport(event_id, depart_at, position);

ALTER TABLE public.event_transport ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_transport_select" ON public.event_transport;
CREATE POLICY "event_transport_select" ON public.event_transport
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_transport.event_id AND em.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_transport.event_id AND e.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_transport_insert" ON public.event_transport;
CREATE POLICY "event_transport_insert" ON public.event_transport
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_transport.event_id AND em.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_transport.event_id AND e.creator_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "event_transport_update" ON public.event_transport;
CREATE POLICY "event_transport_update" ON public.event_transport
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid()
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_transport.event_id AND e.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_transport_delete" ON public.event_transport;
CREATE POLICY "event_transport_delete" ON public.event_transport
  FOR DELETE TO authenticated USING (
    created_by = auth.uid()
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_transport.event_id AND e.creator_id = auth.uid())
  );

-- ============================================================
-- Realtime
-- ============================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_packing_items;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_places;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_place_comments;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_shopping_items;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_transport;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
