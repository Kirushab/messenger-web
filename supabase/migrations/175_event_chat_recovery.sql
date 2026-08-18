-- v411: reliable event participants + self-healing event group chats.
-- Recreates a deleted/missing event chat, restores membership, and keeps archived/past events usable.

-- Older events could theoretically miss their creator in event_members. Repair them so
-- participants are always visible on the event page.
INSERT INTO public.event_members (event_id, user_id, rsvp, invited_by)
SELECT e.id, e.creator_id, 'going', e.creator_id
FROM public.events e
ON CONFLICT (event_id, user_id) DO NOTHING;

-- New event creation: creator owns/administers the linked group chat from the start.
CREATE OR REPLACE FUNCTION public.create_event_with_chat(
  type_param TEXT,
  title_param TEXT,
  description_param TEXT DEFAULT NULL,
  start_at_param TIMESTAMPTZ DEFAULT NOW(),
  end_at_param TIMESTAMPTZ DEFAULT NULL,
  location_name_param TEXT DEFAULT NULL,
  location_lat_param DOUBLE PRECISION DEFAULT NULL,
  location_lng_param DOUBLE PRECISION DEFAULT NULL,
  cover_url_param TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  conv_id UUID;
  ev_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF type_param NOT IN ('party', 'trip') THEN RAISE EXCEPTION 'Invalid type'; END IF;
  IF length(trim(title_param)) = 0 THEN RAISE EXCEPTION 'Title required'; END IF;

  INSERT INTO public.conversations (type, name, created_by, avatar_url)
  VALUES ('group', title_param, uid, cover_url_param)
  RETURNING id INTO conv_id;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (conv_id, uid, 'admin')
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = 'admin';

  INSERT INTO public.events (
    type, creator_id, title, description,
    start_at, end_at,
    location_name, location_lat, location_lng,
    cover_url, conversation_id, status
  )
  VALUES (
    type_param, uid, title_param, description_param,
    start_at_param, end_at_param,
    location_name_param, location_lat_param, location_lng_param,
    cover_url_param, conv_id, 'active'
  )
  RETURNING id INTO ev_id;

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', ev_id,
    'conversation_id', conv_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_event_with_chat(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.create_event_with_chat(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;

-- Self-healing join. If the original group was deleted, events.conversation_id is NULL
-- because of ON DELETE SET NULL; this function transparently creates a replacement.
CREATE OR REPLACE FUNCTION public.join_event_chat(
  event_id_param UUID,
  target_user_id_param UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  ev public.events%ROWTYPE;
  target UUID;
  conv_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO ev
  FROM public.events
  WHERE id = event_id_param
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF ev.status = 'cancelled' THEN RAISE EXCEPTION 'Event cancelled'; END IF;

  target := COALESCE(target_user_id_param, uid);

  IF target <> uid AND ev.creator_id <> uid THEN
    RAISE EXCEPTION 'Only creator can add others';
  END IF;

  conv_id := ev.conversation_id;

  IF conv_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conv_id) THEN
    INSERT INTO public.conversations (type, name, created_by, avatar_url)
    VALUES ('group', ev.title, ev.creator_id, ev.cover_url)
    RETURNING id INTO conv_id;

    UPDATE public.events
    SET conversation_id = conv_id
    WHERE id = event_id_param;
  ELSE
    -- Keep event chat presentation synced with the event after edits.
    UPDATE public.conversations
    SET name = ev.title,
        avatar_url = COALESCE(ev.cover_url, avatar_url),
        updated_at = NOW()
    WHERE id = conv_id;
  END IF;

  -- Creator is always the chat admin.
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (conv_id, ev.creator_id, 'admin')
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = 'admin';

  -- Restore all known event participants to the linked chat. This also repairs old
  -- events where chat membership was manually deleted but event membership remained.
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  SELECT conv_id, em.user_id,
         CASE WHEN em.user_id = ev.creator_id THEN 'admin' ELSE 'member' END
  FROM public.event_members em
  WHERE em.event_id = event_id_param
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  -- The current target must have access before the UI navigates to /chat/:id.
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (conv_id, target, CASE WHEN target = ev.creator_id THEN 'admin' ELSE 'member' END)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  -- Inviting another person also creates event membership as before.
  IF target <> uid THEN
    INSERT INTO public.event_members (event_id, user_id, rsvp, invited_by)
    VALUES (event_id_param, target, NULL, uid)
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'conversation_id', conv_id,
    'recreated', ev.conversation_id IS DISTINCT FROM conv_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_event_chat(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.join_event_chat(UUID, UUID) TO authenticated;

-- Proactively restore missing chats for existing non-cancelled events so old event pages
-- are repaired immediately after applying the migration, not only after the first tap.
DO $$
DECLARE
  ev RECORD;
  conv_id UUID;
BEGIN
  FOR ev IN
    SELECT e.*
    FROM public.events e
    WHERE e.status <> 'cancelled'
      AND (e.conversation_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.conversations c WHERE c.id = e.conversation_id
      ))
  LOOP
    INSERT INTO public.conversations (type, name, created_by, avatar_url)
    VALUES ('group', ev.title, ev.creator_id, ev.cover_url)
    RETURNING id INTO conv_id;

    UPDATE public.events SET conversation_id = conv_id WHERE id = ev.id;

    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    SELECT conv_id, em.user_id,
           CASE WHEN em.user_id = ev.creator_id THEN 'admin' ELSE 'member' END
    FROM public.event_members em
    WHERE em.event_id = ev.id
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    VALUES (conv_id, ev.creator_id, 'admin')
    ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = 'admin';
  END LOOP;
END $$;
