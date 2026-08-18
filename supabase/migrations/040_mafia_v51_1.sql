-- ============================================================
-- 040_mafia_v51_1.sql — v51.1 Мафия: раскрытие ролей + журналист + открытая/закрытая
-- ============================================================

-- 1. Новая настройка: показывать роли при смерти
ALTER TABLE public.mafia_games
  ADD COLUMN IF NOT EXISTS reveal_roles_on_death BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Журналист получает реальное действие — узнаёт точную роль игрока (как шериф, но видит роль)
-- Обновляем check на action_type
ALTER TABLE public.mafia_actions DROP CONSTRAINT IF EXISTS mafia_actions_action_type_check;
ALTER TABLE public.mafia_actions ADD CONSTRAINT mafia_actions_action_type_check
  CHECK (action_type IN ('mafia_kill','don_check','sheriff_check','doctor_heal','maniac_kill','lover_block','journalist_check','vote'));

-- 3. Пересоздаём mafia_create_game с новым параметром
DROP FUNCTION IF EXISTS public.mafia_create_game(TEXT, TEXT, INT, INT, INT, INT, INT);

CREATE OR REPLACE FUNCTION public.mafia_create_game(
  name_param TEXT,
  host_mode_param TEXT DEFAULT 'bot',
  min_players_param INT DEFAULT 4,
  max_players_param INT DEFAULT 20,
  night_seconds_param INT DEFAULT 60,
  day_seconds_param INT DEFAULT 180,
  vote_seconds_param INT DEFAULT 45,
  reveal_roles_on_death_param BOOLEAN DEFAULT TRUE
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  game_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(name_param)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF host_mode_param NOT IN ('bot', 'manual') THEN RAISE EXCEPTION 'Invalid host_mode'; END IF;
  IF min_players_param < 4 THEN RAISE EXCEPTION 'min players >= 4'; END IF;
  IF max_players_param > 20 THEN RAISE EXCEPTION 'max players <= 20'; END IF;
  IF min_players_param > max_players_param THEN RAISE EXCEPTION 'min > max'; END IF;

  INSERT INTO public.mafia_games (
    name, created_by, host_mode, host_user_id,
    min_players, max_players,
    night_seconds, day_seconds, vote_seconds,
    reveal_roles_on_death
  ) VALUES (
    trim(name_param), uid, host_mode_param,
    CASE WHEN host_mode_param = 'manual' THEN uid ELSE NULL END,
    min_players_param, max_players_param,
    night_seconds_param, day_seconds_param, vote_seconds_param,
    reveal_roles_on_death_param
  ) RETURNING id INTO game_id;

  IF host_mode_param = 'bot' THEN
    INSERT INTO public.mafia_players (game_id, user_id, seat_number)
    VALUES (game_id, uid, 1);
  END IF;

  RETURN game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mafia_create_game(TEXT, TEXT, INT, INT, INT, INT, INT, BOOLEAN) TO authenticated;

-- 4. Обновляем mafia_night_action — поддержка journalist_check
CREATE OR REPLACE FUNCTION public.mafia_night_action(
  game_id_param UUID,
  action_type_param TEXT,
  target_user_id_param UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  my_role TEXT;
  target_role TEXT;
  allowed BOOLEAN;
  result_json JSONB := '{}'::JSONB;
  last_heal UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.mafia_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' OR g.phase <> 'night' THEN RAISE EXCEPTION 'Not night phase'; END IF;

  SELECT role INTO my_role FROM public.mafia_players
    WHERE game_id = game_id_param AND user_id = uid AND status = 'alive';
  IF my_role IS NULL THEN RAISE EXCEPTION 'You are not alive in game'; END IF;

  allowed := FALSE;
  IF action_type_param = 'mafia_kill' AND my_role IN ('mafia','don') THEN allowed := TRUE;
  ELSIF action_type_param = 'don_check' AND my_role = 'don' THEN allowed := TRUE;
  ELSIF action_type_param = 'sheriff_check' AND my_role = 'sheriff' THEN allowed := TRUE;
  ELSIF action_type_param = 'doctor_heal' AND my_role = 'doctor' THEN allowed := TRUE;
  ELSIF action_type_param = 'maniac_kill' AND my_role = 'maniac' THEN allowed := TRUE;
  ELSIF action_type_param = 'lover_block' AND my_role = 'lover' THEN allowed := TRUE;
  ELSIF action_type_param = 'journalist_check' AND my_role = 'journalist' THEN allowed := TRUE;
  END IF;
  IF NOT allowed THEN RAISE EXCEPTION 'Not allowed for your role'; END IF;

  IF action_type_param = 'doctor_heal' THEN
    SELECT last_healed_user_id INTO last_heal FROM public.mafia_players
      WHERE game_id = game_id_param AND user_id = uid;
    IF last_heal IS NOT NULL AND last_heal = target_user_id_param THEN
      RAISE EXCEPTION 'Cannot heal same player twice in a row';
    END IF;
    UPDATE public.mafia_players SET last_healed_user_id = target_user_id_param
      WHERE game_id = game_id_param AND user_id = uid;
  END IF;

  IF action_type_param = 'sheriff_check' THEN
    SELECT role INTO target_role FROM public.mafia_players
      WHERE game_id = game_id_param AND user_id = target_user_id_param;
    -- Шериф видит только мафию (Дон ему кажется мирным)
    result_json := jsonb_build_object('is_mafia', target_role = 'mafia');
  ELSIF action_type_param = 'don_check' THEN
    SELECT role INTO target_role FROM public.mafia_players
      WHERE game_id = game_id_param AND user_id = target_user_id_param;
    result_json := jsonb_build_object('is_sheriff', target_role = 'sheriff');
  ELSIF action_type_param = 'journalist_check' THEN
    -- Журналист видит ТОЧНУЮ роль
    SELECT role INTO target_role FROM public.mafia_players
      WHERE game_id = game_id_param AND user_id = target_user_id_param;
    result_json := jsonb_build_object('role', target_role);
  END IF;

  DELETE FROM public.mafia_actions
    WHERE game_id = game_id_param AND day_number = g.day_number
      AND phase = 'night' AND actor_user_id = uid AND action_type = action_type_param;

  INSERT INTO public.mafia_actions (
    game_id, day_number, phase, actor_user_id, action_type, target_user_id, result
  ) VALUES (
    game_id_param, g.day_number, 'night', uid, action_type_param, target_user_id_param, result_json
  );

  RETURN jsonb_build_object('ok', true, 'result', result_json);
END;
$$;

-- 5. Обновляем advance_phase — раскрытие ролей в зависимости от настройки + открытие голосов
CREATE OR REPLACE FUNCTION public.mafia_advance_phase(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  next_phase TEXT;
  next_day INT;
  duration_sec INT;
  killed_mafia_target UUID;
  killed_maniac_target UUID;
  healed_target UUID;
  blocked_user_id UUID;
  killed_users UUID[] := ARRAY[]::UUID[];
  vote_winner UUID;
  vote_max INT;
  vote_tied BOOLEAN;
  alive_count INT;
  mafia_alive INT;
  maniac_alive INT;
  civilians_alive INT;
  winner TEXT := NULL;
  announce_msg TEXT;
  killed_user_id UUID;
  killed_name TEXT;
  killed_role TEXT;
  vote_breakdown TEXT;
  v_rec RECORD;
  expelled_role TEXT;
  expelled_name TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.mafia_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Not playing'; END IF;

  IF g.host_mode = 'manual' THEN
    IF g.host_user_id <> uid THEN RAISE EXCEPTION 'Only host can advance'; END IF;
  ELSIF g.phase_deadline_at IS NOT NULL AND g.phase_deadline_at > NOW() AND g.created_by <> uid THEN
    RAISE EXCEPTION 'Phase not yet expired';
  END IF;

  IF g.phase = 'intro' THEN
    next_phase := 'night';
    next_day := 1;
    duration_sec := g.night_seconds;
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, 1, 'night', 'system', '🌙 Ночь №1. Город засыпает.');

  ELSIF g.phase = 'night' THEN
    -- Любовница блокирует
    SELECT target_user_id INTO blocked_user_id FROM public.mafia_actions
      WHERE game_id = game_id_param AND day_number = g.day_number AND action_type = 'lover_block'
      ORDER BY created_at DESC LIMIT 1;

    -- Мафия (приоритет Дону)
    SELECT a.target_user_id INTO killed_mafia_target FROM public.mafia_actions a
      JOIN public.mafia_players p ON p.user_id = a.actor_user_id AND p.game_id = a.game_id
      WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'mafia_kill'
        AND p.role = 'don'
        AND (blocked_user_id IS NULL OR a.actor_user_id <> blocked_user_id)
      ORDER BY a.created_at DESC LIMIT 1;
    IF killed_mafia_target IS NULL THEN
      SELECT a.target_user_id INTO killed_mafia_target FROM public.mafia_actions a
        WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'mafia_kill'
          AND (blocked_user_id IS NULL OR a.actor_user_id <> blocked_user_id)
        ORDER BY a.created_at DESC LIMIT 1;
    END IF;

    -- Маньяк
    SELECT target_user_id INTO killed_maniac_target FROM public.mafia_actions a
      WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'maniac_kill'
        AND (blocked_user_id IS NULL OR a.actor_user_id <> blocked_user_id)
      ORDER BY a.created_at DESC LIMIT 1;

    -- Доктор
    SELECT target_user_id INTO healed_target FROM public.mafia_actions a
      WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'doctor_heal'
        AND (blocked_user_id IS NULL OR a.actor_user_id <> blocked_user_id)
      ORDER BY a.created_at DESC LIMIT 1;

    -- Смерти
    IF killed_mafia_target IS NOT NULL AND killed_mafia_target <> healed_target THEN
      killed_users := killed_users || killed_mafia_target;
    END IF;
    IF killed_maniac_target IS NOT NULL AND killed_maniac_target <> healed_target AND NOT (killed_maniac_target = ANY(killed_users)) THEN
      killed_users := killed_users || killed_maniac_target;
    END IF;

    IF array_length(killed_users, 1) IS NOT NULL THEN
      UPDATE public.mafia_players SET status = 'dead', died_day = g.day_number
        WHERE game_id = game_id_param AND user_id = ANY(killed_users);
    END IF;

    -- Утреннее сообщение
    IF array_length(killed_users, 1) IS NULL THEN
      announce_msg := '☀ Утро. Этой ночью никто не погиб.';
    ELSE
      announce_msg := '☀ Утро. Этой ночью погибли:';
      FOREACH killed_user_id IN ARRAY killed_users LOOP
        SELECT u.display_name, p.role INTO killed_name, killed_role
          FROM public.users u
          JOIN public.mafia_players p ON p.user_id = u.id AND p.game_id = game_id_param
          WHERE u.id = killed_user_id;
        IF g.reveal_roles_on_death THEN
          announce_msg := announce_msg || E'\n• ' || COALESCE(killed_name, 'игрок') || ' — был ' || COALESCE(killed_role, '');
        ELSE
          announce_msg := announce_msg || E'\n• ' || COALESCE(killed_name, 'игрок');
        END IF;
      END LOOP;
    END IF;
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, g.day_number, 'morning', 'system', announce_msg);

    next_phase := 'day';
    next_day := g.day_number;
    duration_sec := g.day_seconds;

  ELSIF g.phase = 'day' THEN
    next_phase := 'vote';
    next_day := g.day_number;
    duration_sec := g.vote_seconds;
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, g.day_number, 'vote', 'system', '🗳 Голосование. Кого изгнать?');

  ELSIF g.phase = 'vote' THEN
    -- Подсчёт голосов
    SELECT target_user_id, COUNT(*)::INT INTO vote_winner, vote_max
      FROM public.mafia_actions
      WHERE game_id = game_id_param AND day_number = g.day_number AND action_type = 'vote'
      GROUP BY target_user_id
      ORDER BY COUNT(*) DESC LIMIT 1;

    SELECT COUNT(DISTINCT target_user_id) > 1 INTO vote_tied FROM (
      SELECT target_user_id, COUNT(*) cnt FROM public.mafia_actions
        WHERE game_id = game_id_param AND day_number = g.day_number AND action_type = 'vote'
        GROUP BY target_user_id HAVING COUNT(*) = vote_max
    ) t;

    -- Открытие голосов: показываем все голоса
    vote_breakdown := '🗳 Итоги голосования:';
    FOR v_rec IN
      SELECT u.display_name, COUNT(*)::INT vote_count
        FROM public.mafia_actions a
        JOIN public.users u ON u.id = a.target_user_id
        WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'vote'
        GROUP BY u.display_name
        ORDER BY COUNT(*) DESC
    LOOP
      vote_breakdown := vote_breakdown || E'\n• ' || v_rec.display_name || ' — ' || v_rec.vote_count;
    END LOOP;
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, g.day_number, 'vote', 'system', vote_breakdown);

    IF vote_winner IS NOT NULL AND NOT vote_tied THEN
      UPDATE public.mafia_players SET status = 'expelled', died_day = g.day_number
        WHERE game_id = game_id_param AND user_id = vote_winner;
      SELECT u.display_name, p.role INTO expelled_name, expelled_role
        FROM public.users u
        JOIN public.mafia_players p ON p.user_id = u.id AND p.game_id = game_id_param
        WHERE u.id = vote_winner;
      IF g.reveal_roles_on_death THEN
        INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
        VALUES (game_id_param, g.day_number, 'vote', 'system', '⚖ ' || COALESCE(expelled_name, 'Игрок') || ' изгнан. Он был ' || COALESCE(expelled_role, ''));
      ELSE
        INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
        VALUES (game_id_param, g.day_number, 'vote', 'system', '⚖ ' || COALESCE(expelled_name, 'Игрок') || ' изгнан.');
      END IF;
    ELSE
      INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
      VALUES (game_id_param, g.day_number, 'vote', 'system', '🤝 Голоса разделились. Никто не изгнан.');
    END IF;

    next_phase := 'night';
    next_day := g.day_number + 1;
    duration_sec := g.night_seconds;
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, next_day, 'night', 'system', '🌙 Ночь №' || next_day || '. Город засыпает.');
  END IF;

  -- Проверка победы
  SELECT
    COUNT(*) FILTER (WHERE status = 'alive'),
    COUNT(*) FILTER (WHERE status = 'alive' AND role IN ('mafia','don')),
    COUNT(*) FILTER (WHERE status = 'alive' AND role = 'maniac'),
    COUNT(*) FILTER (WHERE status = 'alive' AND role NOT IN ('mafia','don','maniac'))
  INTO alive_count, mafia_alive, maniac_alive, civilians_alive
  FROM public.mafia_players WHERE game_id = game_id_param;

  IF mafia_alive = 0 AND maniac_alive = 0 THEN
    winner := 'civilians';
  ELSIF mafia_alive >= civilians_alive + maniac_alive AND mafia_alive > 0 THEN
    winner := 'mafia';
  ELSIF maniac_alive >= civilians_alive + mafia_alive AND maniac_alive > 0 THEN
    winner := 'maniac';
  END IF;

  IF winner IS NOT NULL THEN
    UPDATE public.mafia_games SET
      status = 'finished',
      phase = 'finished',
      winner_team = winner,
      finished_at = NOW()
    WHERE id = game_id_param;
    -- Раскрытие всех ролей в конце игры
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, g.day_number, 'finished', 'system',
      '🎉 Игра окончена. Победили: ' ||
      CASE winner WHEN 'civilians' THEN 'Мирные' WHEN 'mafia' THEN 'Мафия' ELSE 'Маньяк' END);
    RETURN jsonb_build_object('ok', true, 'finished', true, 'winner', winner);
  END IF;

  UPDATE public.mafia_games SET
    phase = next_phase,
    day_number = next_day,
    phase_started_at = NOW(),
    phase_deadline_at = NOW() + (duration_sec || ' seconds')::INTERVAL
  WHERE id = game_id_param;

  RETURN jsonb_build_object('ok', true, 'phase', next_phase, 'day', next_day);
END;
$$;

-- 6. RPC: получить все роли в конце игры (если finished, видны всем)
CREATE OR REPLACE FUNCTION public.mafia_get_final_roles(game_id_param UUID)
RETURNS TABLE(user_id UUID, role TEXT, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g RECORD;
BEGIN
  SELECT * INTO g FROM public.mafia_games WHERE id = game_id_param;
  IF g.status <> 'finished' THEN RETURN; END IF;
  RETURN QUERY
    SELECT mp.user_id, mp.role::TEXT, mp.status::TEXT FROM public.mafia_players mp
      WHERE mp.game_id = game_id_param;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mafia_get_final_roles(UUID) TO authenticated;

-- 7. RLS: mafia-канал виден только мафии и дону (защита Realtime payload)
DROP POLICY IF EXISTS mafia_messages_select ON public.mafia_messages;
CREATE POLICY mafia_messages_select ON public.mafia_messages FOR SELECT USING (
  channel <> 'mafia' OR
  EXISTS (
    SELECT 1 FROM public.mafia_players p
    WHERE p.game_id = mafia_messages.game_id
      AND p.user_id = auth.uid()
      AND p.role IN ('mafia', 'don')
  )
);

-- DONE
