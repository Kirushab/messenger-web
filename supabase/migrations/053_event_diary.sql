-- 053_event_diary.sql
-- Travel diary — общая хроника поездки по дням.

CREATE TABLE IF NOT EXISTS public.event_diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb, -- массив { url, storage_path }
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE, -- какой день поездки
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_diary_event_date_idx
  ON public.event_diary_entries(event_id, entry_date, created_at);
CREATE INDEX IF NOT EXISTS event_diary_user_idx
  ON public.event_diary_entries(user_id);

ALTER TABLE public.event_diary_entries ENABLE ROW LEVEL SECURITY;

-- Видят: все участники + создатель события
DROP POLICY IF EXISTS "event_diary_select" ON public.event_diary_entries;
CREATE POLICY "event_diary_select" ON public.event_diary_entries
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_diary_entries.event_id AND em.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_diary_entries.event_id AND e.creator_id = auth.uid())
  );

-- Пишут: участники события и создатель
DROP POLICY IF EXISTS "event_diary_insert" ON public.event_diary_entries;
CREATE POLICY "event_diary_insert" ON public.event_diary_entries
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.event_members em WHERE em.event_id = event_diary_entries.event_id AND em.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_diary_entries.event_id AND e.creator_id = auth.uid())
    )
  );

-- Редактирует / удаляет: автор записи или создатель события
DROP POLICY IF EXISTS "event_diary_update" ON public.event_diary_entries;
CREATE POLICY "event_diary_update" ON public.event_diary_entries
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "event_diary_delete" ON public.event_diary_entries;
CREATE POLICY "event_diary_delete" ON public.event_diary_entries
  FOR DELETE TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_diary_entries.event_id AND e.creator_id = auth.uid())
  );

-- Realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_diary_entries;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Storage bucket для дневниковых фото
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-diary', 'event-diary', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "event_diary_storage_insert" ON storage.objects;
CREATE POLICY "event_diary_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-diary');

DROP POLICY IF EXISTS "event_diary_storage_select" ON storage.objects;
CREATE POLICY "event_diary_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-diary');

DROP POLICY IF EXISTS "event_diary_storage_delete" ON storage.objects;
CREATE POLICY "event_diary_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'event-diary' AND owner = auth.uid());
