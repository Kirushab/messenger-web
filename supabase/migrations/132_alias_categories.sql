-- 132_alias_categories.sql
-- Пользовательские категории слов для игры «Крокодил» (AliasLocal).
--  • Каждый пользователь создаёт свои категории (имя, эмодзи, список слов).
--  • is_public = true публикует категорию в общую библиотеку («Сообщество»),
--    откуда любой может добавить её копию себе.
--  • source_id — ссылка на оригинал, если категория добавлена из сообщества
--    (для пометки «уже добавлено» и атрибуции).
--  • Слова храним массивом text[].

CREATE TABLE IF NOT EXISTS public.alias_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📦',
  words TEXT[] NOT NULL DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT false,
  source_id UUID REFERENCES public.alias_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alias_categories_owner_idx ON public.alias_categories(owner_id);
CREATE INDEX IF NOT EXISTS alias_categories_public_idx ON public.alias_categories(is_public) WHERE is_public = true;

ALTER TABLE public.alias_categories ENABLE ROW LEVEL SECURITY;

-- Владелец видит свои; все видят опубликованные
CREATE POLICY alias_categories_select ON public.alias_categories FOR SELECT USING (
  owner_id = auth.uid() OR is_public = true
);
CREATE POLICY alias_categories_insert ON public.alias_categories FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);
CREATE POLICY alias_categories_update ON public.alias_categories FOR UPDATE USING (
  owner_id = auth.uid()
) WITH CHECK (owner_id = auth.uid());
CREATE POLICY alias_categories_delete ON public.alias_categories FOR DELETE USING (
  owner_id = auth.uid()
);

-- updated_at автоматически
CREATE OR REPLACE FUNCTION public.alias_categories_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alias_categories_updated_at ON public.alias_categories;
CREATE TRIGGER alias_categories_updated_at
  BEFORE UPDATE ON public.alias_categories
  FOR EACH ROW EXECUTE FUNCTION public.alias_categories_touch_updated_at();
