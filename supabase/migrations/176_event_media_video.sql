-- v412: event gallery becomes photo + video media.
ALTER TABLE public.event_photos
  ADD COLUMN IF NOT EXISTS preview_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_path TEXT;

COMMENT ON COLUMN public.event_photos.preview_url IS 'Poster/thumbnail URL for event video media';
COMMENT ON COLUMN public.event_photos.preview_path IS 'Storage path for generated event video poster';

-- Allow event videos in the existing public event-photos bucket.
-- Keep one bucket/table so existing gallery data and realtime keep working.
UPDATE storage.buckets
SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg','image/png','image/webp','image/heic','image/heif',
    'video/mp4','video/quicktime','video/webm','video/x-m4v','video/hevc','video/mpeg','video/3gpp'
  ]
WHERE id = 'event-photos';
