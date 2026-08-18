-- 126: Множественный закреп сообщений (карусель)
-- Новая таблица pinned_messages вместо одиночного conversations.pinned_message_id.

CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  pinned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_messages_conv
  ON public.pinned_messages (conversation_id, pinned_at DESC);

ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

-- Видеть/закреплять/откреплять могут участники беседы
DROP POLICY IF EXISTS pinned_messages_select ON public.pinned_messages;
CREATE POLICY pinned_messages_select ON public.pinned_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = pinned_messages.conversation_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS pinned_messages_insert ON public.pinned_messages;
CREATE POLICY pinned_messages_insert ON public.pinned_messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = pinned_messages.conversation_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS pinned_messages_delete ON public.pinned_messages;
CREATE POLICY pinned_messages_delete ON public.pinned_messages FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = pinned_messages.conversation_id
      AND cm.user_id = auth.uid()
  )
);

-- Перенос существующего одиночного закрепа в новую таблицу
INSERT INTO public.pinned_messages (conversation_id, message_id)
SELECT id, pinned_message_id FROM public.conversations
WHERE pinned_message_id IS NOT NULL
ON CONFLICT (conversation_id, message_id) DO NOTHING;

-- DONE
