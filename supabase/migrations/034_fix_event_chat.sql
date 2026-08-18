-- ============================================================
-- 034_fix_event_chat.sql
-- v47: Фикс RPC create_event_with_chat — колонка conversations.title
--      на самом деле называется name (или вообще отсутствует)
-- ============================================================

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

  -- 1) Создаём групповой чат (используем name, не title)
  INSERT INTO public.conversations (type, name, created_by, avatar_url)
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

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', ev_id,
    'conversation_id', conv_id
  );
END;
$$;
