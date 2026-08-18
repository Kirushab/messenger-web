-- Personal "Saved Messages" conversation for every user.
-- One private self-only conversation is created lazily on the first chats load.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_saved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saved_owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_saved_owner_unique
  ON public.conversations(saved_owner_id)
  WHERE is_saved = true;

-- A saved conversation may contain only its owner.
CREATE OR REPLACE FUNCTION public.guard_saved_conversation_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
BEGIN
  SELECT saved_owner_id INTO owner_id
  FROM public.conversations
  WHERE id = NEW.conversation_id
    AND is_saved = true;

  IF owner_id IS NOT NULL AND NEW.user_id <> owner_id THEN
    RAISE EXCEPTION 'Saved conversation is private';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_saved_conversation_member_trigger
  ON public.conversation_members;

CREATE TRIGGER guard_saved_conversation_member_trigger
BEFORE INSERT OR UPDATE OF conversation_id, user_id
ON public.conversation_members
FOR EACH ROW
EXECUTE FUNCTION public.guard_saved_conversation_member();

CREATE OR REPLACE FUNCTION public.ensure_saved_conversation()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  cid UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO cid
  FROM public.conversations
  WHERE is_saved = true
    AND saved_owner_id = uid
  LIMIT 1;

  IF cid IS NULL THEN
    BEGIN
      INSERT INTO public.conversations (
        type,
        name,
        created_by,
        is_saved,
        saved_owner_id
      ) VALUES (
        'direct',
        'Избранное',
        uid,
        true,
        uid
      )
      RETURNING id INTO cid;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO cid
      FROM public.conversations
      WHERE is_saved = true
        AND saved_owner_id = uid
      LIMIT 1;
    END;
  END IF;

  INSERT INTO public.conversation_members (
    conversation_id,
    user_id,
    role,
    is_pinned,
    is_archived
  ) VALUES (
    cid,
    uid,
    'admin',
    true,
    false
  )
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    is_pinned = true,
    is_archived = false;

  RETURN cid;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_saved_conversation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_saved_conversation() TO authenticated;
