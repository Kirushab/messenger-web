-- ============================================================
-- 033_poker_chat.sql
-- v46: Чат за покерным столом
-- ============================================================

CREATE TABLE IF NOT EXISTS public.poker_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS poker_chat_table_idx
  ON public.poker_chat_messages(table_id, created_at DESC);

ALTER TABLE public.poker_chat_messages ENABLE ROW LEVEL SECURITY;

-- Все аутентифицированные читают
DROP POLICY IF EXISTS "Anyone reads chat" ON public.poker_chat_messages;
CREATE POLICY "Anyone reads chat" ON public.poker_chat_messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Insert через SECURITY DEFINER функцию (rate-limit + проверки)
DROP POLICY IF EXISTS "Seated players write chat" ON public.poker_chat_messages;
DROP POLICY IF EXISTS "Insert via RPC only" ON public.poker_chat_messages;
CREATE POLICY "Insert via RPC only" ON public.poker_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_chat_messages;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'poker_chat_messages уже в публикации'; END;
END $$;

-- ============================================================
-- RPC: отправить сообщение с rate-limit (1 раз в 2 секунды)
-- Сидящие за столом + зрители могут писать (демократично)
-- ============================================================
CREATE OR REPLACE FUNCTION public.poker_send_chat(
  table_id_param UUID,
  message_param TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  trimmed_message TEXT;
  last_msg_at TIMESTAMPTZ;
  new_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.poker_tables WHERE id = table_id_param) THEN
    RAISE EXCEPTION 'Table not found';
  END IF;

  trimmed_message := trim(message_param);
  IF length(trimmed_message) = 0 THEN
    RAISE EXCEPTION 'Message empty';
  END IF;
  IF char_length(trimmed_message) > 200 THEN
    RAISE EXCEPTION 'Message too long (max 200 chars)';
  END IF;

  -- Rate-limit: 1 сообщение в 2 секунды на стол
  SELECT MAX(created_at) INTO last_msg_at
    FROM public.poker_chat_messages
    WHERE user_id = uid AND table_id = table_id_param;

  IF last_msg_at IS NOT NULL AND NOW() < last_msg_at + INTERVAL '2 seconds' THEN
    RAISE EXCEPTION 'Slow down — please wait a moment';
  END IF;

  INSERT INTO public.poker_chat_messages (table_id, user_id, message)
  VALUES (table_id_param, uid, trimmed_message)
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'id', new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.poker_send_chat(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.poker_send_chat(UUID, TEXT) TO authenticated;
