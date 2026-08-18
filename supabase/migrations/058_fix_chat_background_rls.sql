-- ============================================================
-- 058_fix_chat_background_rls.sql
-- Фикс RLS-ошибки "new row violates row-level security policy"
-- при применении фона чата.
--
-- Проблема: members_update_admin использует рекурсивный EXISTS на
-- conversation_members, который может конфликтовать с другими политиками
-- при UPDATE собственного chat_background.
--
-- Решение: переписать обе UPDATE-политики через SECURITY DEFINER функцию.
-- ============================================================

-- Безопасная проверка, является ли auth.uid() админом данного чата (без рекурсии)
CREATE OR REPLACE FUNCTION public.is_conversation_admin(c_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = c_id
      AND user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Сбрасываем старые политики
DROP POLICY IF EXISTS "members_update"        ON public.conversation_members;
DROP POLICY IF EXISTS "members_update_admin"  ON public.conversation_members;
DROP POLICY IF EXISTS "members_update_self"   ON public.conversation_members;

-- 1) Юзер обновляет СВОЮ запись (last_read_at, chat_background, и т.п.)
--    Явный WITH CHECK гарантирует, что user_id не сменится на чужой.
CREATE POLICY "members_update_self" ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2) Админ чата может менять любую запись (роли участников и т.д.)
--    Используем SECURITY DEFINER функцию, чтобы не было рекурсии в RLS.
CREATE POLICY "members_update_admin" ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (public.is_conversation_admin(conversation_id))
  WITH CHECK (public.is_conversation_admin(conversation_id));
