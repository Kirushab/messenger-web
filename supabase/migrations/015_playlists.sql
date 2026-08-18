-- ============================================================
-- 015_playlists.sql
-- Музыка через Spotify Collaborative Playlists (v30)
-- В нашей БД хранятся ТОЛЬКО метаданные: ссылка на Spotify, название,
-- категория. Сами треки и логика воспроизведения — на стороне Spotify.
-- ============================================================

-- Таблица плейлистов
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  -- Категории: car, party, workout, work, relax, other
  spotify_url TEXT NOT NULL,
  spotify_id TEXT,             -- извлечённый ID для embed (вычисляется на клиенте при создании)
  cover_url TEXT,              -- опционально, иначе градиент по категории
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playlists_owner_idx ON public.playlists(owner_id);
CREATE INDEX IF NOT EXISTS playlists_archived_idx ON public.playlists(archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS playlists_category_idx ON public.playlists(category);
CREATE INDEX IF NOT EXISTS playlists_created_idx ON public.playlists(created_at DESC);

-- RLS
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- Видеть могут все аутентифицированные
DROP POLICY IF EXISTS "Anyone authenticated can read playlists" ON public.playlists;
CREATE POLICY "Anyone authenticated can read playlists"
  ON public.playlists FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Создавать может любой аутентифицированный
DROP POLICY IF EXISTS "Authenticated can create playlists" ON public.playlists;
CREATE POLICY "Authenticated can create playlists"
  ON public.playlists FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Изменять/удалять — только owner
DROP POLICY IF EXISTS "Owner can update own playlists" ON public.playlists;
CREATE POLICY "Owner can update own playlists"
  ON public.playlists FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owner can delete own playlists" ON public.playlists;
CREATE POLICY "Owner can delete own playlists"
  ON public.playlists FOR DELETE
  USING (auth.uid() = owner_id);

-- Триггер updated_at
CREATE OR REPLACE FUNCTION public.playlists_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS playlists_updated_at ON public.playlists;
CREATE TRIGGER playlists_updated_at
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW
  EXECUTE FUNCTION public.playlists_set_updated_at();

-- Realtime — чтобы новые плейлисты появлялись у всех мгновенно
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'playlists уже в публикации';
  END;
END $$;
