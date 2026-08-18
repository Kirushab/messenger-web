-- ============================================================
-- ФИКС: call_logs.conversation_id может быть null
-- Запусти в Supabase SQL Editor
-- ============================================================

ALTER TABLE public.call_logs ALTER COLUMN conversation_id DROP NOT NULL;
