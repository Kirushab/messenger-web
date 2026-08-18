-- ============================================================
-- 016_pixel_canvas.sql
-- Pixel-доска (v31)
-- Общий холст 128×128, юзеры ставят по одному пикселю с cooldown 30 сек.
-- Раунды по месяцам — 1-го числа в 00:00 текущий замораживается, стартует новый.
-- ============================================================

-- Раунды
CREATE TABLE IF NOT EXISTS public.pixel_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  archived_image_url TEXT,                     -- картинка архива (для будущей итерации)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pixel_rounds_active_idx ON public.pixel_rounds(ended_at) WHERE ended_at IS NULL;

-- Пиксели
CREATE TABLE IF NOT EXISTS public.pixel_canvas (
  round_id UUID NOT NULL REFERENCES public.pixel_rounds(id) ON DELETE CASCADE,
  x SMALLINT NOT NULL CHECK (x >= 0 AND x < 128),
  y SMALLINT NOT NULL CHECK (y >= 0 AND y < 128),
  color SMALLINT NOT NULL CHECK (color >= 0 AND color < 16),  -- индекс в palette pico-8
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (round_id, x, y)
);

CREATE INDEX IF NOT EXISTS pixel_canvas_round_idx ON public.pixel_canvas(round_id);
CREATE INDEX IF NOT EXISTS pixel_canvas_user_idx ON public.pixel_canvas(user_id);
CREATE INDEX IF NOT EXISTS pixel_canvas_placed_idx ON public.pixel_canvas(placed_at DESC);

-- RLS
ALTER TABLE public.pixel_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pixel_canvas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read rounds" ON public.pixel_rounds;
CREATE POLICY "Anyone authenticated can read rounds"
  ON public.pixel_rounds FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone authenticated can read canvas" ON public.pixel_canvas;
CREATE POLICY "Anyone authenticated can read canvas"
  ON public.pixel_canvas FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Ставить пиксели может любой аутентифицированный, но только текущий раунд (не архивный)
DROP POLICY IF EXISTS "Authenticated can place pixels in active round" ON public.pixel_canvas;
CREATE POLICY "Authenticated can place pixels in active round"
  ON public.pixel_canvas FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.pixel_rounds r
      WHERE r.id = round_id AND r.ended_at IS NULL
    )
  );

-- UPDATE для UPSERT (когда юзер ставит пиксель поверх существующего)
DROP POLICY IF EXISTS "Authenticated can overwrite pixels in active round" ON public.pixel_canvas;
CREATE POLICY "Authenticated can overwrite pixels in active round"
  ON public.pixel_canvas FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.pixel_rounds r
      WHERE r.id = round_id AND r.ended_at IS NULL
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.pixel_rounds r
      WHERE r.id = round_id AND r.ended_at IS NULL
    )
  );

-- Realtime для синхронизации
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_canvas;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'pixel_canvas уже в публикации';
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_rounds;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'pixel_rounds уже в публикации';
  END;
END $$;

-- Создаём первый раунд если ни одного активного нет
INSERT INTO public.pixel_rounds (started_at)
SELECT NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.pixel_rounds WHERE ended_at IS NULL);
