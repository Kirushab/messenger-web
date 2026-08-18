-- 096_forwarded_messages.sql
-- Пересылка сообщений (как в Telegram): храним исходного автора.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS forwarded_from_name TEXT,
  ADD COLUMN IF NOT EXISTS forwarded_from_id   UUID;
