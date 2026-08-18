-- ============================================================
-- 160_event_flights.sql
-- Блок «Рейс» в путешествиях: каждый участник добавляет свой рейс (номер как на билете) + место.
-- Плюс кэш позиций рейсов для Edge Function (flight-track), чтобы не дёргать AirLabs на каждый опрос.
-- Идемпотентно. Применять в Supabase → SQL Editor.
-- ============================================================

-- 1) Рейсы участников события
CREATE TABLE IF NOT EXISTS public.event_flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  flight_iata TEXT NOT NULL,          -- номер как на билете, напр. SU100
  flight_date DATE,                   -- дата вылета (опционально)
  seat TEXT,                          -- место, напр. 14C (опционально)
  note TEXT,                          -- заметка (опционально)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_flights_event_idx ON public.event_flights(event_id);
CREATE INDEX IF NOT EXISTS event_flights_user_idx ON public.event_flights(user_id);

ALTER TABLE public.event_flights ENABLE ROW LEVEL SECURITY;

-- Читают все аутентифицированные (как и сами события — открытая соцсеть для друзей).
DROP POLICY IF EXISTS "Anyone can read event flights" ON public.event_flights;
CREATE POLICY "Anyone can read event flights"
  ON public.event_flights FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Добавлять/менять/удалять — только свой рейс (каждый сам).
DROP POLICY IF EXISTS "User can insert own flight" ON public.event_flights;
CREATE POLICY "User can insert own flight"
  ON public.event_flights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "User can update own flight" ON public.event_flights;
CREATE POLICY "User can update own flight"
  ON public.event_flights FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "User can delete own flight" ON public.event_flights;
CREATE POLICY "User can delete own flight"
  ON public.event_flights FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at триггер
CREATE OR REPLACE FUNCTION public.event_flights_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS event_flights_updated_at ON public.event_flights;
CREATE TRIGGER event_flights_updated_at BEFORE UPDATE ON public.event_flights
  FOR EACH ROW EXECUTE FUNCTION public.event_flights_set_updated_at();

-- Realtime (список рейсов обновляется у всех участников вживую)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_flights;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'event_flights уже в публикации';
  END;
END $$;

-- 2) Кэш позиций рейсов для Edge Function (TTL ~40с задаётся в самой функции).
--    Доступ только по service role: RLS включён, публичных policy нет (service role обходит RLS).
CREATE TABLE IF NOT EXISTS public.flight_cache (
  flight_iata TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.flight_cache ENABLE ROW LEVEL SECURITY;
