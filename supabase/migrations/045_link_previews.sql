-- ============================================================
-- 045_link_previews.sql — кеш превью ссылок + storage bucket
-- ============================================================

-- Таблица кеша превью
CREATE TABLE IF NOT EXISTS public.link_previews (
  url TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  publisher TEXT,
  image_url TEXT,
  image_path TEXT,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  failed BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_link_previews_expires ON public.link_previews(expires_at);

ALTER TABLE public.link_previews ENABLE ROW LEVEL SECURITY;

-- Чтение для всех authenticated
DROP POLICY IF EXISTS "Authenticated can read link_previews" ON public.link_previews;
CREATE POLICY "Authenticated can read link_previews" ON public.link_previews
  FOR SELECT TO authenticated USING (true);

-- Storage bucket для превью (публичный)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'link-previews',
  'link-previews',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (публичное чтение)
DROP POLICY IF EXISTS "Public read link previews" ON storage.objects;
CREATE POLICY "Public read link previews" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'link-previews');

-- Очистка протухшего кеша
CREATE OR REPLACE FUNCTION public.cleanup_link_previews()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  WITH d AS (
    DELETE FROM public.link_previews WHERE expires_at < NOW() RETURNING image_path
  )
  SELECT COUNT(*) INTO deleted_count FROM d;
  RETURN deleted_count;
END;
$$;

-- Регистрируем в pg_cron (раз в день)
DO $reg$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-link-previews') THEN
    PERFORM cron.unschedule('cleanup-link-previews');
  END IF;
  PERFORM cron.schedule('cleanup-link-previews', '0 4 * * *', 'SELECT public.cleanup_link_previews();');
EXCEPTION WHEN OTHERS THEN NULL;
END $reg$;

-- DONE
