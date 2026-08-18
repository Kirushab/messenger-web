-- v417: persistent story-reply context in chat messages.
-- Stores a lightweight snapshot so a reply still renders correctly after the story row is deleted/expired.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS story_reply_snapshot JSONB;

COMMENT ON COLUMN public.messages.story_reply_snapshot IS
  'Snapshot for a comment/reply sent from StoryViewer: story id, author, media URL/type, caption and created_at. Independent of stories row lifecycle.';
