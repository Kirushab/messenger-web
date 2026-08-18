-- 123_map_points_category.sql
-- Категория точки интереса (еда/бар/дом/...). Определяет цвет и иконку пина.
-- Идемпотентно. Старые точки остаются с category = NULL (рендерятся зелёными).
ALTER TABLE public.map_points ADD COLUMN IF NOT EXISTS category TEXT;
