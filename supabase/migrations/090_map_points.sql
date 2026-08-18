-- 090_map_points.sql
-- Точки интереса на карте (POI): создаёт любой, видны всем либо выбранным людям.

CREATE TABLE IF NOT EXISTS public.map_points (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  icon        TEXT,                       -- эмодзи/ключ иконки
  lng         DOUBLE PRECISION NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all','custom')),
  allowed_ids UUID[] NOT NULL DEFAULT '{}', -- для custom: кому видно (плюс автор всегда)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.map_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS map_points_select ON public.map_points;
CREATE POLICY map_points_select ON public.map_points
  FOR SELECT TO authenticated USING (
    visibility = 'all'
    OR created_by = auth.uid()
    OR auth.uid() = ANY(allowed_ids)
  );

DROP POLICY IF EXISTS map_points_insert ON public.map_points;
CREATE POLICY map_points_insert ON public.map_points
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS map_points_update ON public.map_points;
CREATE POLICY map_points_update ON public.map_points
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS map_points_delete ON public.map_points;
CREATE POLICY map_points_delete ON public.map_points
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS map_points_created_by_idx ON public.map_points(created_by);
