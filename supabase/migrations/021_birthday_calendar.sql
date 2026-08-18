-- ============================================================
-- 021_birthday_calendar.sql
-- Поле дня рождения у юзеров + privacy-флаг (v37)
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS birthday DATE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS birthday_visible BOOLEAN NOT NULL DEFAULT true;

-- Индекс для быстрого поиска дней рождения по месяцу/дню
CREATE INDEX IF NOT EXISTS users_birthday_visible_idx
  ON public.users(birthday)
  WHERE birthday IS NOT NULL AND birthday_visible = true;
