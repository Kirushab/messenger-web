-- ============================================================
-- CUSTOM STATUSES (v16 → v17)
-- Раздаёт статусы только админ (email = lirikb2002@gmail.com)
-- ============================================================

-- 1. Добавляем колонки для кастомного статуса
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS custom_status_text TEXT,
  ADD COLUMN IF NOT EXISTS custom_status_color TEXT,
  ADD COLUMN IF NOT EXISTS custom_status_emoji TEXT;

-- 2. Политика: только админ может менять custom_status_* у любого пользователя
-- Проверяем через email в auth.users
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email = 'lirikb2002@gmail.com'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Обновляем UPDATE политику на users — разрешаем админу менять чужие статусы
DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = id  -- свой профиль можно всегда
    OR public.is_admin()  -- админ может чужие
  );

-- 4. Разрешаем читать всем (осталось как было)
-- SELECT политика users_select уже существует

-- ============================================================
-- ГОТОВО. После применения этой миграции:
-- - Админ (lirikb2002@gmail.com) может менять custom_status_* у любого юзера
-- - Обычный пользователь может менять только свой профиль (но не custom_status_*, если захочешь — добавь отдельные check constraints)
-- ============================================================
