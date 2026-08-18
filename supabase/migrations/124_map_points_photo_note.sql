-- 124_map_points_photo_note.sql
-- Фото и заметка для точки интереса. Идемпотентно.
ALTER TABLE public.map_points ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.map_points ADD COLUMN IF NOT EXISTS note TEXT;

-- Storage bucket для фото точек (публичное чтение, запись только в свою папку)
INSERT INTO storage.buckets (id, name, public)
VALUES ('map-point-photos', 'map-point-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload map point photos" ON storage.objects;
CREATE POLICY "Users can upload map point photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'map-point-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update map point photos" ON storage.objects;
CREATE POLICY "Users can update map point photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'map-point-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete map point photos" ON storage.objects;
CREATE POLICY "Users can delete map point photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'map-point-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Anyone can read map point photos" ON storage.objects;
CREATE POLICY "Anyone can read map point photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'map-point-photos');
