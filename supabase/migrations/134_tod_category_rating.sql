-- 134_tod_category_rating.sql (идемпотентный)
-- Рейтинг «остроты» категории: 'mild' (😇) или 'spicy' (🌶️). По умолчанию mild.

ALTER TABLE public.tod_categories ADD COLUMN IF NOT EXISTS rating TEXT NOT NULL DEFAULT 'mild';
