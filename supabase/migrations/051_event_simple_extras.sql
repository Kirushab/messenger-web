-- 051_event_simple_extras.sql
-- Заметки организатора, точка сбора, +1 plus_ones.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organizer_notes TEXT,
  ADD COLUMN IF NOT EXISTS meeting_point TEXT,
  ADD COLUMN IF NOT EXISTS meeting_point_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS meeting_point_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS meeting_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plus_ones_limit INT NOT NULL DEFAULT 0; -- 0 = запрещено приводить, N = можно до N

-- Сколько кто приведёт (хранится в event_members)
ALTER TABLE public.event_members
  ADD COLUMN IF NOT EXISTS plus_ones INT NOT NULL DEFAULT 0;
