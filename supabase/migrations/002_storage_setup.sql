-- ============================================================
-- ЭТАП 3: Настройка Storage для файлов
-- Запусти в Supabase SQL Editor
-- ============================================================

-- Делаем бакет публичным для чтения (файлы доступны по URL)
UPDATE storage.buckets
SET public = true
WHERE id = 'chat-files';

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "chat_files_upload" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_read" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_delete" ON storage.objects;

-- Загрузка: авторизованные пользователи
CREATE POLICY "chat_files_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files');

-- Чтение: все (бакет публичный)
CREATE POLICY "chat_files_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'chat-files');

-- Удаление: только свои файлы
CREATE POLICY "chat_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-files' AND (storage.foldername(name))[1] IN (
    SELECT cm.conversation_id::text
    FROM public.conversation_members cm
    WHERE cm.user_id = auth.uid()
  ));
