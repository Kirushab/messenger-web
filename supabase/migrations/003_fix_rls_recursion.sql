-- ============================================================
-- ФИКС: RLS без рекурсии через SECURITY DEFINER функцию
-- Запусти в Supabase SQL Editor
-- ============================================================

-- Функция возвращает conversation_ids текущего пользователя
-- SECURITY DEFINER обходит RLS, избегая рекурсии
CREATE OR REPLACE FUNCTION public.get_my_conversation_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
$$;

-- Теперь пересоздаём политики с использованием этой функции

-- CONVERSATION MEMBERS: видеть участников СВОИХ чатов (не только себя)
DROP POLICY IF EXISTS "members_select" ON public.conversation_members;
CREATE POLICY "members_select" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT public.get_my_conversation_ids()));

-- CONVERSATIONS: видеть свои чаты
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (SELECT public.get_my_conversation_ids())
  );

-- CONVERSATIONS: обновлять свои чаты
DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE TO authenticated
  USING (id IN (SELECT public.get_my_conversation_ids()));

-- MESSAGES: читать сообщения своих чатов
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT public.get_my_conversation_ids()));

-- MESSAGES: отправлять в свои чаты
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (SELECT public.get_my_conversation_ids())
  );

-- CALL LOGS: видеть звонки своих чатов
DROP POLICY IF EXISTS "calls_select" ON public.call_logs;
CREATE POLICY "calls_select" ON public.call_logs
  FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT public.get_my_conversation_ids()));

DROP POLICY IF EXISTS "calls_update" ON public.call_logs;
CREATE POLICY "calls_update" ON public.call_logs
  FOR UPDATE TO authenticated
  USING (conversation_id IN (SELECT public.get_my_conversation_ids()));

-- FILE ATTACHMENTS: видеть вложения своих чатов
DROP POLICY IF EXISTS "attachments_select" ON public.file_attachments;
CREATE POLICY "attachments_select" ON public.file_attachments
  FOR SELECT TO authenticated
  USING (message_id IN (
    SELECT id FROM public.messages
    WHERE conversation_id IN (SELECT public.get_my_conversation_ids())
  ));
