-- 092_active_calls.sql (heartbeat-модель)
-- Активный групповой звонок = набор «живых» участников (last_seen свежий).
-- Если клиент жёстко закрылся — строка протухает (>60с) и вычищается, звонок не висит.

CREATE TABLE IF NOT EXISTS public.active_call_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  room_id         TEXT NOT NULL,
  call_type       TEXT NOT NULL DEFAULT 'audio',
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.active_call_participants ENABLE ROW LEVEL SECURITY;

-- Видеть могут участники беседы
DROP POLICY IF EXISTS acp_select ON public.active_call_participants;
CREATE POLICY acp_select ON public.active_call_participants
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.conversation_members m
            WHERE m.conversation_id = active_call_participants.conversation_id AND m.user_id = auth.uid())
  );

-- Менять можно только свою строку (пишем через RPC, но политика на всякий случай)
DROP POLICY IF EXISTS acp_write ON public.active_call_participants;
CREATE POLICY acp_write ON public.active_call_participants
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Heartbeat / вход (идемпотентно): обновляет last_seen + чистит протухшие строки
CREATE OR REPLACE FUNCTION public.heartbeat_call(p_conversation UUID, p_room TEXT, p_type TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM conversation_members m
                 WHERE m.conversation_id = p_conversation AND m.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not a member';
  END IF;
  INSERT INTO active_call_participants(conversation_id, user_id, room_id, call_type, joined_at, last_seen)
  VALUES (p_conversation, auth.uid(), p_room, COALESCE(p_type, 'audio'), NOW(), NOW())
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET last_seen = NOW(), room_id = EXCLUDED.room_id, call_type = EXCLUDED.call_type;
  -- глобальная чистка протухших (клиент умер, не слал heartbeat >60с)
  DELETE FROM active_call_participants WHERE last_seen < NOW() - INTERVAL '60 seconds';
END; $$;

-- Явный выход
CREATE OR REPLACE FUNCTION public.leave_call(p_conversation UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM active_call_participants
  WHERE conversation_id = p_conversation AND user_id = auth.uid();
END; $$;

GRANT EXECUTE ON FUNCTION public.heartbeat_call(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_call(UUID) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.active_call_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
