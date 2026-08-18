-- ============================================================
-- MESSENGER DATABASE SCHEMA
-- Запусти этот SQL в Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away')),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ТАБЛИЦА ЧАТОВ
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  name TEXT,                          -- Название группы (null для direct)
  avatar_url TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. УЧАСТНИКИ ЧАТОВ
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

-- 4. СООБЩЕНИЯ
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id),
  content TEXT NOT NULL DEFAULT '',
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'voice', 'system')),
  reply_to_id UUID REFERENCES public.messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ                -- Soft delete
);

-- 5. ФАЙЛОВЫЕ ВЛОЖЕНИЯ
CREATE TABLE IF NOT EXISTS public.file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ЖУРНАЛ ЗВОНКОВ
CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('audio', 'video')),
  status TEXT DEFAULT 'missed' CHECK (status IN ('missed', 'answered', 'declined', 'ongoing')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  participants UUID[] DEFAULT '{}'
);

-- ============================================================
-- ИНДЕКСЫ (для производительности)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON public.users(display_name);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Включаем RLS на всех таблицах
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- ---- USERS ----
-- Все авторизованные могут видеть профили
CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated USING (true);

-- Свой профиль можно создавать
CREATE POLICY "users_insert" ON public.users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Свой профиль можно обновлять
CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ---- CONVERSATIONS ----
-- Видеть только свои чаты
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  ));

-- Создавать чаты может любой
CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Обновлять чат могут участники
CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE TO authenticated
  USING (id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  ));

-- ---- CONVERSATION MEMBERS ----
-- Видеть участников своих чатов
CREATE POLICY "members_select" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (conversation_id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  ));

-- Добавлять участников (создатель чата или админ)
CREATE POLICY "members_insert" ON public.conversation_members
  FOR INSERT TO authenticated WITH CHECK (true);

-- Обновлять свою запись (last_read_at)
CREATE POLICY "members_update" ON public.conversation_members
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ---- MESSAGES ----
-- Читать сообщения своих чатов
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (conversation_id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  ));

-- Отправлять сообщения в свои чаты
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
    )
  );

-- Обновлять свои сообщения (редактирование, soft delete)
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE TO authenticated USING (sender_id = auth.uid());

-- ---- FILE ATTACHMENTS ----
CREATE POLICY "attachments_select" ON public.file_attachments
  FOR SELECT TO authenticated
  USING (message_id IN (
    SELECT id FROM public.messages WHERE conversation_id IN (
      SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "attachments_insert" ON public.file_attachments
  FOR INSERT TO authenticated WITH CHECK (true);

-- ---- CALL LOGS ----
CREATE POLICY "calls_select" ON public.call_logs
  FOR SELECT TO authenticated
  USING (conversation_id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "calls_insert" ON public.call_logs
  FOR INSERT TO authenticated WITH CHECK (initiated_by = auth.uid());

CREATE POLICY "calls_update" ON public.call_logs
  FOR UPDATE TO authenticated
  USING (conversation_id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  ));

-- ============================================================
-- REALTIME (подписки через WebSocket)
-- ============================================================

-- Включаем Realtime для нужных таблиц
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;

-- ============================================================
-- STORAGE (бакет для файлов)
-- ============================================================

-- Создаём бакет для файлов чата
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', false)
ON CONFLICT DO NOTHING;

-- Политика: загрузка файлов для авторизованных
CREATE POLICY "chat_files_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files');

-- Политика: чтение файлов для авторизованных
CREATE POLICY "chat_files_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files');

-- ============================================================
-- ГОТОВО! Теперь можно запускать приложение.
-- ============================================================
