-- 091_shared_alarms.sql
-- Общий будильник: автор задаёт время и участников; будит всех участников.
-- (Полноценная побудка при закрытом приложении — на нативной сборке/TestFlight.
--  Здесь — модель данных + срабатывание в открытом приложении.)

CREATE TABLE IF NOT EXISTS public.shared_alarms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES public.events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'Будильник',
  ring_at         TIMESTAMPTZ NOT NULL,
  participant_ids UUID[] NOT NULL DEFAULT '{}',  -- кого будит (помимо автора)
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shared_alarms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_alarms_select ON public.shared_alarms;
CREATE POLICY shared_alarms_select ON public.shared_alarms
  FOR SELECT TO authenticated USING (
    created_by = auth.uid() OR auth.uid() = ANY(participant_ids)
  );

DROP POLICY IF EXISTS shared_alarms_insert ON public.shared_alarms;
CREATE POLICY shared_alarms_insert ON public.shared_alarms
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS shared_alarms_update ON public.shared_alarms;
CREATE POLICY shared_alarms_update ON public.shared_alarms
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS shared_alarms_delete ON public.shared_alarms;
CREATE POLICY shared_alarms_delete ON public.shared_alarms
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS shared_alarms_ring_at_idx ON public.shared_alarms(ring_at);
CREATE INDEX IF NOT EXISTS shared_alarms_event_idx ON public.shared_alarms(event_id);
