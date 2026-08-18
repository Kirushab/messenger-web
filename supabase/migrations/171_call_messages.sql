-- 171_call_messages.sql
-- Карточки звонков в общей ленте сообщений.

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_type_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_type_check
  CHECK (type IN (
    'text',
    'image',
    'file',
    'voice',
    'album',
    'system',
    'location',
    'poll',
    'call'
  ));
