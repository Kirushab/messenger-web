-- ============================================================
-- 017_chat_backgrounds.sql
-- Фон чата (v32)
-- Каждый юзер видит свой фон (как в Telegram). Глобальный по умолчанию +
-- переопределение для конкретного чата.
-- ============================================================

-- Глобальный фон по умолчанию для каждого юзера
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS default_chat_background TEXT;

-- Переопределение для конкретного чата (на уровне участника)
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS chat_background TEXT;

-- Storage bucket для кастомных фонов (если его нет)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-backgrounds', 'chat-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: каждый юзер может загружать в свою папку
DROP POLICY IF EXISTS "Users can upload their backgrounds" ON storage.objects;
CREATE POLICY "Users can upload their backgrounds"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their backgrounds" ON storage.objects;
CREATE POLICY "Users can update their backgrounds"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'chat-backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their backgrounds" ON storage.objects;
CREATE POLICY "Users can delete their backgrounds"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Anyone can read backgrounds" ON storage.objects;
CREATE POLICY "Anyone can read backgrounds"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-backgrounds');
