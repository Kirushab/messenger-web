-- 133_tod_categories.sql (идемпотентный)
-- Пользовательские категории для игры «Правда или Действие» (TruthOrDare).
--  • Каждый пользователь создаёт свои категории: имя, эмодзи, список правд и список действий.
--  • is_public = true публикует категорию в общую библиотеку («Сообщество»).
--  • source_id — ссылка на оригинал, если категория добавлена из сообщества.

CREATE TABLE IF NOT EXISTS public.tod_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎲',
  truths TEXT[] NOT NULL DEFAULT '{}',
  dares TEXT[] NOT NULL DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT false,
  source_id UUID REFERENCES public.tod_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tod_categories_owner_idx ON public.tod_categories(owner_id);
CREATE INDEX IF NOT EXISTS tod_categories_public_idx ON public.tod_categories(is_public) WHERE is_public = true;

ALTER TABLE public.tod_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tod_categories_select ON public.tod_categories;
DROP POLICY IF EXISTS tod_categories_insert ON public.tod_categories;
DROP POLICY IF EXISTS tod_categories_update ON public.tod_categories;
DROP POLICY IF EXISTS tod_categories_delete ON public.tod_categories;

CREATE POLICY tod_categories_select ON public.tod_categories FOR SELECT USING (
  owner_id = auth.uid() OR is_public = true
);
CREATE POLICY tod_categories_insert ON public.tod_categories FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);
CREATE POLICY tod_categories_update ON public.tod_categories FOR UPDATE USING (
  owner_id = auth.uid()
) WITH CHECK (owner_id = auth.uid());
CREATE POLICY tod_categories_delete ON public.tod_categories FOR DELETE USING (
  owner_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.tod_categories_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tod_categories_updated_at ON public.tod_categories;
CREATE TRIGGER tod_categories_updated_at
  BEFORE UPDATE ON public.tod_categories
  FOR EACH ROW EXECUTE FUNCTION public.tod_categories_touch_updated_at();
