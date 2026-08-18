-- 119_stories_caption.sql
-- Подпись к истории (текстовое описание, добавляется в редакторе истории).
-- Идемпотентно: колонка добавляется только если её ещё нет.

ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS caption text;
