-- 049_event_extras.sql
-- Чек-лист (что взять / принести) и план по дням для событий.

-- ============================================================
-- 1. Чек-лист события
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  done_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  done_at TIMESTAMPTZ,
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_checklist_event_idx ON public.event_checklist(event_id, position);

ALTER TABLE public.event_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_checklist_select" ON public.event_checklist;
CREATE POLICY "event_checklist_select" ON public.event_checklist
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_checklist.event_id AND em.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_checklist.event_id AND e.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_checklist_insert" ON public.event_checklist;
CREATE POLICY "event_checklist_insert" ON public.event_checklist
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_checklist.event_id AND em.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_checklist.event_id AND e.creator_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "event_checklist_update" ON public.event_checklist;
CREATE POLICY "event_checklist_update" ON public.event_checklist
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_checklist.event_id AND em.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_checklist.event_id AND e.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_checklist_delete" ON public.event_checklist;
CREATE POLICY "event_checklist_delete" ON public.event_checklist
  FOR DELETE TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_checklist.event_id AND e.creator_id = auth.uid())
  );

-- ============================================================
-- 2. План по дням
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  day_offset INT NOT NULL DEFAULT 0,
  time_label TEXT,
  title TEXT NOT NULL,
  description TEXT,
  location_name TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_schedule_event_idx ON public.event_schedule(event_id, day_offset, position);

ALTER TABLE public.event_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_schedule_select" ON public.event_schedule;
CREATE POLICY "event_schedule_select" ON public.event_schedule
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_schedule.event_id AND em.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_schedule.event_id AND e.creator_id = auth.uid())
  );

-- Писать только организатор
DROP POLICY IF EXISTS "event_schedule_insert" ON public.event_schedule;
CREATE POLICY "event_schedule_insert" ON public.event_schedule
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_schedule.event_id AND e.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_schedule_update" ON public.event_schedule;
CREATE POLICY "event_schedule_update" ON public.event_schedule
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_schedule.event_id AND e.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "event_schedule_delete" ON public.event_schedule;
CREATE POLICY "event_schedule_delete" ON public.event_schedule
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_schedule.event_id AND e.creator_id = auth.uid())
  );

-- Realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_checklist;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_schedule;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
