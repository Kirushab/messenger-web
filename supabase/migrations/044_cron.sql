-- ============================================================
-- 044_cron.sql — v54 Серверный cron (pg_cron) для авто-фаз Мафии и Alias
-- ============================================================

-- 1. Включить расширение pg_cron (требует Supabase Pro или выше)
-- На Free плане SQL завершится с ошибкой — тогда нужно включить через Dashboard → Database → Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 2. СИСТЕМНАЯ функция для Мафии (без auth check)
-- Двигает фазу в bot-режиме когда deadline истёк
CREATE OR REPLACE FUNCTION public.mafia_advance_phase_system(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
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
  SELECT * INTO g FROM public.mafia_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF g.status <> 'playing' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_playing'); END IF;
  IF g.phase_deadline_at IS NULL OR g.phase_deadline_at > NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deadline_not_reached');
  END IF;

  -- Логика идентична mafia_advance_phase, но без auth check
  IF g.phase = 'intro' THEN
    next_phase := 'night'; next_day := 1; duration_sec := g.night_seconds;
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, 1, 'night', 'system', '🌙 Ночь №1. Город засыпает.');

  ELSIF g.phase = 'night' THEN
    SELECT target_user_id INTO blocked_user_id FROM public.mafia_actions
      WHERE game_id = game_id_param AND day_number = g.day_number AND action_type = 'lover_block'
      ORDER BY created_at DESC LIMIT 1;

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

    SELECT target_user_id INTO killed_maniac_target FROM public.mafia_actions a
      WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'maniac_kill'
        AND (blocked_user_id IS NULL OR a.actor_user_id <> blocked_user_id)
      ORDER BY a.created_at DESC LIMIT 1;

    SELECT target_user_id INTO healed_target FROM public.mafia_actions a
      WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'doctor_heal'
        AND (blocked_user_id IS NULL OR a.actor_user_id <> blocked_user_id)
      ORDER BY a.created_at DESC LIMIT 1;

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

    next_phase := 'day'; next_day := g.day_number; duration_sec := g.day_seconds;

  ELSIF g.phase = 'day' THEN
    next_phase := 'vote'; next_day := g.day_number; duration_sec := g.vote_seconds;
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, g.day_number, 'vote', 'system', '🗳 Голосование. Кого изгнать?');

  ELSIF g.phase = 'vote' THEN
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

    vote_breakdown := '🗳 Итоги голосования:';
    FOR v_rec IN
      SELECT u.display_name, COUNT(*)::INT vote_count
        FROM public.mafia_actions a
        JOIN public.users u ON u.id = a.target_user_id
        WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'vote'
        GROUP BY u.display_name ORDER BY COUNT(*) DESC
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

    next_phase := 'night'; next_day := g.day_number + 1; duration_sec := g.night_seconds;
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

  IF mafia_alive = 0 AND maniac_alive = 0 THEN winner := 'civilians';
  ELSIF mafia_alive >= civilians_alive + maniac_alive AND mafia_alive > 0 THEN winner := 'mafia';
  ELSIF maniac_alive >= civilians_alive + mafia_alive AND maniac_alive > 0 THEN winner := 'maniac';
  END IF;

  IF winner IS NOT NULL THEN
    UPDATE public.mafia_games SET status = 'finished', phase = 'finished', winner_team = winner, finished_at = NOW()
    WHERE id = game_id_param;
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, g.day_number, 'finished', 'system',
      '🎉 Игра окончена. Победили: ' ||
      CASE winner WHEN 'civilians' THEN 'Мирные' WHEN 'mafia' THEN 'Мафия' ELSE 'Маньяк' END);
    RETURN jsonb_build_object('ok', true, 'finished', true);
  END IF;

  UPDATE public.mafia_games SET
    phase = next_phase, day_number = next_day,
    phase_started_at = NOW(),
    phase_deadline_at = NOW() + (duration_sec || ' seconds')::INTERVAL
  WHERE id = game_id_param;

  RETURN jsonb_build_object('ok', true, 'phase', next_phase);
END;
$$;

-- 3. Tick для Мафии — обход всех играющих партий
CREATE OR REPLACE FUNCTION public.mafia_tick_all_games()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  game RECORD;
  advanced_count INT := 0;
  total_count INT := 0;
BEGIN
  FOR game IN
    SELECT id FROM public.mafia_games
    WHERE status = 'playing'
      AND host_mode = 'bot'
      AND phase_deadline_at IS NOT NULL
      AND phase_deadline_at < NOW()
    LIMIT 100
  LOOP
    total_count := total_count + 1;
    BEGIN
      PERFORM public.mafia_advance_phase_system(game.id);
      advanced_count := advanced_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- игнорируем ошибки чтобы продолжить с другими играми
    END;
  END LOOP;
  RETURN jsonb_build_object('checked', total_count, 'advanced', advanced_count);
END;
$$;

-- 4. СИСТЕМНАЯ функция для Alias — авто-завершение раунда
CREATE OR REPLACE FUNCTION public.alias_finish_round_system(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g RECORD;
  next_team RECORD;
  next_explainer UUID;
  team_rounds INT;
  current_team RECORD;
  total_teams INT;
BEGIN
  SELECT * INTO g FROM public.alias_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;
  IF g.status <> 'playing' OR g.phase NOT IN ('explaining') THEN RETURN jsonb_build_object('ok', false); END IF;
  IF g.round_deadline_at IS NULL OR g.round_deadline_at > NOW() THEN RETURN jsonb_build_object('ok', false); END IF;

  UPDATE public.alias_teams SET rounds_played = rounds_played + 1 WHERE id = g.current_team_id;
  SELECT * INTO current_team FROM public.alias_teams WHERE id = g.current_team_id;

  IF g.win_condition_type = 'score' AND current_team.score >= g.win_condition_value THEN
    PERFORM public.alias_finalize_game(game_id_param);
    RETURN jsonb_build_object('ok', true, 'finished', true);
  END IF;

  IF g.win_condition_type = 'rounds' THEN
    SELECT COUNT(*) INTO total_teams FROM public.alias_teams WHERE game_id = game_id_param;
    SELECT COUNT(*) INTO team_rounds FROM public.alias_teams
      WHERE game_id = game_id_param AND rounds_played >= g.win_condition_value;
    IF team_rounds = total_teams THEN
      PERFORM public.alias_finalize_game(game_id_param);
      RETURN jsonb_build_object('ok', true, 'finished', true);
    END IF;
  END IF;

  SELECT * INTO next_team FROM public.alias_teams
    WHERE game_id = game_id_param AND team_number > current_team.team_number
    ORDER BY team_number LIMIT 1;
  IF NOT FOUND THEN
    SELECT * INTO next_team FROM public.alias_teams
      WHERE game_id = game_id_param ORDER BY team_number LIMIT 1;
  END IF;

  SELECT user_id INTO next_explainer FROM public.alias_players
    WHERE game_id = game_id_param AND team_id = next_team.id
    ORDER BY words_explained ASC, joined_at ASC LIMIT 1;

  UPDATE public.alias_games SET
    phase = 'waiting_explainer',
    current_team_id = next_team.id,
    current_explainer_id = next_explainer,
    round_number = g.round_number + 1,
    current_word = NULL,
    round_started_at = NULL,
    round_deadline_at = NULL
  WHERE id = game_id_param;

  INSERT INTO public.alias_messages (game_id, round_number, is_system, content)
  VALUES (game_id_param, g.round_number + 1, TRUE,
    '⏰ Время раунда истекло. Следующая команда: ' || next_team.name);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5. Tick для Alias
CREATE OR REPLACE FUNCTION public.alias_tick_all_games()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  game RECORD;
  finished_count INT := 0;
  total_count INT := 0;
BEGIN
  FOR game IN
    SELECT id FROM public.alias_games
    WHERE status = 'playing' AND phase = 'explaining'
      AND round_deadline_at IS NOT NULL
      AND round_deadline_at < NOW()
    LIMIT 100
  LOOP
    total_count := total_count + 1;
    BEGIN
      PERFORM public.alias_finish_round_system(game.id);
      finished_count := finished_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
  RETURN jsonb_build_object('checked', total_count, 'finished', finished_count);
END;
$$;

-- 6. Объединённая tick-функция
CREATE OR REPLACE FUNCTION public.sigmas_cron_tick()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  mafia_result JSONB;
  alias_result JSONB;
BEGIN
  mafia_result := public.mafia_tick_all_games();
  alias_result := public.alias_tick_all_games();
  RETURN jsonb_build_object('mafia', mafia_result, 'alias', alias_result, 'ts', NOW());
END;
$$;

-- 7. Регистрация в pg_cron — каждые 5 секунд
-- Если pg_cron не доступен, эта команда не выполнится; см. инструкцию ниже
DO $reg$
BEGIN
  -- Удаляем старую задачу если есть
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sigmas-tick') THEN
    PERFORM cron.unschedule('sigmas-tick');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $reg$;

DO $reg2$
BEGIN
  PERFORM cron.schedule('sigmas-tick', '5 seconds', 'SELECT public.sigmas_cron_tick();');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron registration failed. Enable pg_cron in Supabase Dashboard then run manually.';
END $reg2$;

GRANT EXECUTE ON FUNCTION public.sigmas_cron_tick() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mafia_tick_all_games() TO authenticated;
GRANT EXECUTE ON FUNCTION public.alias_tick_all_games() TO authenticated;

-- DONE
