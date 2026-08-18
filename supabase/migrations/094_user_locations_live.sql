-- 094_user_locations_live.sql
-- Флаг «живой» трансляции. Пока is_live=true и updated_at свежий — точка показывается
-- как live; протухла (приложение закрыли) — клиент её прячет по свежести.
-- Обычные поставленные пины (is_live=false) остаются как раньше.

ALTER TABLE public.user_locations
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT FALSE;
