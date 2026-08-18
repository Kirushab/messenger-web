-- ============================================================
-- 023_events_chat.sql
-- События — итерация B (v39)
-- RPC для атомарного создания события с групповым чатом
-- + добавления участников в чат при invite/RSVP
-- ============================================================

-- Создание события с автоматическим групповым чатом одной транзакцией
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

  -- 1) Создаём групповой чат
  INSERT INTO public.conversations (type, title, created_by, avatar_url)
  VALUES ('group', title_param, uid, cover_url_param)
  RETURNING id INTO conv_id;

  -- 2) Добавляем creator в чат
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (conv_id, uid);

  -- 3) Создаём событие
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

  -- Триггер event_creator_auto_member автоматически добавит creator в event_members со статусом going

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', ev_id,
    'conversation_id', conv_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_event_with_chat(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.create_event_with_chat(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;

-- ============================================================
-- Добавление юзеров в чат события (invite или join)
-- ============================================================
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
  ev RECORD;
  target UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO ev FROM public.events WHERE id = event_id_param;
  IF ev IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF ev.conversation_id IS NULL THEN RAISE EXCEPTION 'No chat for this event'; END IF;
  IF ev.status = 'cancelled' THEN RAISE EXCEPTION 'Event cancelled'; END IF;

  target := COALESCE(target_user_id_param, uid);

  -- Если не себя — должен быть creator
  IF target <> uid AND ev.creator_id <> uid THEN
    RAISE EXCEPTION 'Only creator can add others';
  END IF;

  -- Добавляем в conversation_members
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (ev.conversation_id, target)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  -- Если приглашаем кого-то — автоматически добавляем его в event_members
  IF target <> uid THEN
    INSERT INTO public.event_members (event_id, user_id, rsvp, invited_by)
    VALUES (event_id_param, target, NULL, uid)
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.join_event_chat(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.join_event_chat(UUID, UUID) TO authenticated;

-- ============================================================
-- Backfill: для уже созданных events без conversation_id создаём чат
-- ============================================================
DO $$
DECLARE
  ev RECORD;
  conv_id UUID;
BEGIN
  FOR ev IN SELECT * FROM public.events WHERE conversation_id IS NULL LOOP
    INSERT INTO public.conversations (type, title, created_by, avatar_url)
    VALUES ('group', ev.title, ev.creator_id, ev.cover_url)
    RETURNING id INTO conv_id;

    -- Добавляем всех существующих event_members в чат
    INSERT INTO public.conversation_members (conversation_id, user_id)
    SELECT conv_id, user_id FROM public.event_members WHERE event_id = ev.id
    ON CONFLICT DO NOTHING;

    UPDATE public.events SET conversation_id = conv_id WHERE id = ev.id;
  END LOOP;
END $$;
