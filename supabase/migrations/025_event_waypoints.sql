-- ============================================================
-- 025_event_waypoints.sql
-- События — итерация D (v41): точки маршрута для поездок
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  arrival_at TIMESTAMPTZ,
  departure_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_waypoints_event_idx ON public.event_waypoints(event_id, sort_order);

ALTER TABLE public.event_waypoints ENABLE ROW LEVEL SECURITY;

-- Видят все участники события
DROP POLICY IF EXISTS "Members read waypoints" ON public.event_waypoints;
CREATE POLICY "Members read waypoints"
  ON public.event_waypoints FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_waypoints.event_id AND em.user_id = auth.uid())
  );

-- Создавать/изменять/удалять может creator события
DROP POLICY IF EXISTS "Creator can write waypoints" ON public.event_waypoints;
CREATE POLICY "Creator can write waypoints"
  ON public.event_waypoints FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_waypoints.event_id AND e.creator_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_waypoints.event_id AND e.creator_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.event_waypoints_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS event_waypoints_updated_at ON public.event_waypoints;
CREATE TRIGGER event_waypoints_updated_at BEFORE UPDATE ON public.event_waypoints FOR EACH ROW EXECUTE FUNCTION public.event_waypoints_set_updated_at();

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_waypoints;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'event_waypoints уже в публикации'; END;
END $$;
