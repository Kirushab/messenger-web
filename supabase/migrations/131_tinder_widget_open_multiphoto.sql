-- 131_tinder_widget_open_multiphoto.sql
-- Реворк тиндер-виджета:
--  • RPC create_tinder_bet был удалён в 088 вместе со ставочной механикой.
--    Пересоздаём его БЕЗ гейта is_kirill() — теперь интерактивный виджет
--    (свайп/лайки/комменты, рендерится TinderBetCard) может создать любой
--    участник чата (в UI всё ещё ограничено флагом tinder_access).
--  • Жёсткий лимит длительности (макс 7 дней) убран: ставок больше нет,
--    ends_at чисто косметический, виджет живёт «вечно».
--  • Обложка берётся из первой media поста (position ASC) — мульти-фото
--    поддерживается на стороне поста (post_media), карточка покажет все.
-- Таблицы tinder_bets / tinder_bet_reactions / tinder_bet_comments уже есть.

CREATE OR REPLACE FUNCTION public.create_tinder_bet(
  conversation_id_param UUID,
  post_id_param UUID,
  duration_minutes_param INT,
  visible_bets_param BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  bet_id UUID;
  cover RECORD;
  mins INT;
  ends TIMESTAMPTZ;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Проверка членства в чате (гейта is_kirill больше нет)
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conversation_id_param AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this chat';
  END IF;

  -- Длительность только снизу ограничиваем; верхний предел снят
  mins := GREATEST(COALESCE(duration_minutes_param, 60*24*365), 5);
  ends := NOW() + (mins || ' minutes')::INTERVAL;

  -- Обложка = первая media поста
  SELECT file_url, mime_type INTO cover
  FROM public.post_media
  WHERE post_id = post_id_param
  ORDER BY position
  LIMIT 1;
  IF cover IS NULL THEN RAISE EXCEPTION 'Post has no media'; END IF;

  INSERT INTO public.tinder_bets (
    conversation_id, creator_id, post_id, cover_url, cover_mime,
    ends_at, visible_bets, status, total_pool
  ) VALUES (
    conversation_id_param, uid, post_id_param, cover.file_url, cover.mime_type,
    ends, COALESCE(visible_bets_param, false), 'active', 0
  ) RETURNING id INTO bet_id;

  RETURN jsonb_build_object('ok', true, 'bet_id', bet_id, 'ends_at', ends, 'cover_url', cover.file_url);
END;
$$;

REVOKE ALL ON FUNCTION public.create_tinder_bet(UUID, UUID, INT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.create_tinder_bet(UUID, UUID, INT, BOOLEAN) TO authenticated;
