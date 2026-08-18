-- ============================================================
-- 014_map_sigmas.sql
-- Карта Sigmas (v27)
-- Юзеры ставят свою точку на карте, видят пины других.
-- Не realtime трекинг — каждый юзер сам ставит и может перемещать.
-- ============================================================

-- Таблица локаций
CREATE TABLE IF NOT EXISTS public.user_locations (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индекс для быстрого поиска видимых
CREATE INDEX IF NOT EXISTS user_locations_visible_idx
  ON public.user_locations(visible) WHERE visible = true;

-- RLS
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Видеть могут все аутентифицированные юзеры (только видимые)
DROP POLICY IF EXISTS "Anyone authenticated can read visible locations" ON public.user_locations;
CREATE POLICY "Anyone authenticated can read visible locations"
  ON public.user_locations FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (visible = true OR user_id = auth.uid())
  );

-- Создать/обновить может только сам юзер свою запись
DROP POLICY IF EXISTS "Users can insert own location" ON public.user_locations;
CREATE POLICY "Users can insert own location"
  ON public.user_locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own location" ON public.user_locations;
CREATE POLICY "Users can update own location"
  ON public.user_locations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own location" ON public.user_locations;
CREATE POLICY "Users can delete own location"
  ON public.user_locations FOR DELETE
  USING (auth.uid() = user_id);

-- Триггер для авто-обновления updated_at
CREATE OR REPLACE FUNCTION public.user_locations_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_locations_updated_at ON public.user_locations;
CREATE TRIGGER user_locations_updated_at
  BEFORE UPDATE ON public.user_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.user_locations_set_updated_at();

-- Realtime для синхронизации: когда кто-то поставил/перенёс точку, остальные сразу видят
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'user_locations уже в публикации';
  END;
END $$;
