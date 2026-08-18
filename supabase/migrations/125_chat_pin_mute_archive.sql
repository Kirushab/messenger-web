-- 125_chat_pin_mute_archive.sql
-- Персональные флаги чата у участника: закрепление, без звука, архив.
-- Хранятся на conversation_members (у каждого юзера — свои), не на conversation.
-- Идемпотентно: безопасно прогонять повторно.

ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS is_muted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Ускоряем выборку «мои закреплённые/архивные» по юзеру.
CREATE INDEX IF NOT EXISTS idx_conv_members_user_flags
  ON conversation_members (user_id, is_pinned, is_archived);
