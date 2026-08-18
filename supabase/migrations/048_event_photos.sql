-- 048_event_photos.sql
-- Общая фотогалерея события: любой участник (rsvp != not_going) может добавить фото.

CREATE TABLE IF NOT EXISTS public.event_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  storage_path TEXT,
  mime_type TEXT NOT NULL,
  width INT,
  height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_photos_event_idx ON public.event_photos(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_photos_user_idx ON public.event_photos(user_id);

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

-- Видят участники события
DROP POLICY IF EXISTS "event_photos_select" ON public.event_photos;
CREATE POLICY "event_photos_select" ON public.event_photos
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_photos.event_id AND em.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_photos.event_id AND e.creator_id = auth.uid()
    )
  );

-- Добавляют участники (rsvp 'going' или 'maybe') или организатор
DROP POLICY IF EXISTS "event_photos_insert" ON public.event_photos;
CREATE POLICY "event_photos_insert" ON public.event_photos
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.event_members em
        WHERE em.event_id = event_photos.event_id
          AND em.user_id = auth.uid()
          AND COALESCE(em.rsvp, 'going') IN ('going', 'maybe')
      )
      OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_photos.event_id AND e.creator_id = auth.uid()
      )
    )
  );

-- Удалить может: автор фото или организатор события
DROP POLICY IF EXISTS "event_photos_delete" ON public.event_photos;
CREATE POLICY "event_photos_delete" ON public.event_photos
  FOR DELETE TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_photos.event_id AND e.creator_id = auth.uid()
    )
  );

-- Realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_photos;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Storage bucket для фоток
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-photos', 'event-photos', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;

-- Policy: загружать может любой authenticated в свою папку (event_id/user_id/...)
DROP POLICY IF EXISTS "event_photos_storage_insert" ON storage.objects;
CREATE POLICY "event_photos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-photos');

DROP POLICY IF EXISTS "event_photos_storage_select" ON storage.objects;
CREATE POLICY "event_photos_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-photos');

DROP POLICY IF EXISTS "event_photos_storage_delete" ON storage.objects;
CREATE POLICY "event_photos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'event-photos' AND owner = auth.uid());
