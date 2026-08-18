-- ============================================================
-- 039_mafia.sql — v51 Mafia (роли + фазы + голосование + чат)
-- ============================================================

-- 1. Партии
CREATE TABLE IF NOT EXISTS public.mafia_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  host_mode TEXT NOT NULL DEFAULT 'bot' CHECK (host_mode IN ('bot', 'manual')),
  host_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  min_players INT NOT NULL DEFAULT 4,
  max_players INT NOT NULL DEFAULT 20,

  -- Длительности фаз (секунды)
  night_seconds INT NOT NULL DEFAULT 60,
  day_seconds INT NOT NULL DEFAULT 180,
  vote_seconds INT NOT NULL DEFAULT 45,
  intro_seconds INT NOT NULL DEFAULT 30,

  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'finished', 'aborted')),
  phase TEXT NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby','intro','night','morning','day','vote','finished')),
  day_number INT NOT NULL DEFAULT 0,
  phase_started_at TIMESTAMPTZ,
  phase_deadline_at TIMESTAMPTZ, -- к этому времени фаза должна закончиться (для бот-режима)

  winner_team TEXT CHECK (winner_team IN ('civilians', 'mafia', 'maniac')),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mafia_games_status ON public.mafia_games(status);

-- 2. Игроки в партии
CREATE TABLE IF NOT EXISTS public.mafia_players (
  game_id UUID NOT NULL REFERENCES public.mafia_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seat_number INT NOT NULL,
  role TEXT CHECK (role IN ('civilian','mafia','don','sheriff','doctor','maniac','journalist','lover')),
  status TEXT NOT NULL DEFAULT 'alive' CHECK (status IN ('alive','dead','expelled')),
  -- Доктор не может лечить одного и того же подряд
  last_healed_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  died_day INT,
  PRIMARY KEY (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mafia_players_game ON public.mafia_players(game_id);

-- 3. Ночные действия
CREATE TABLE IF NOT EXISTS public.mafia_actions (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.mafia_games(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  phase TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('mafia_kill','don_check','sheriff_check','doctor_heal','maniac_kill','lover_block','journalist_publish','vote')),
  target_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mafia_actions_game_day ON public.mafia_actions(game_id, day_number);

-- 4. Чат
CREATE TABLE IF NOT EXISTS public.mafia_messages (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.mafia_games(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  phase TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('general','mafia','system')),
  sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mafia_messages_game_channel ON public.mafia_messages(game_id, channel);

-- 5. RLS
ALTER TABLE public.mafia_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mafia_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mafia_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mafia_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mafia_games_select ON public.mafia_games;
CREATE POLICY mafia_games_select ON public.mafia_games FOR SELECT USING (true);

DROP POLICY IF EXISTS mafia_games_insert ON public.mafia_games;
CREATE POLICY mafia_games_insert ON public.mafia_games FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS mafia_games_update ON public.mafia_games;
CREATE POLICY mafia_games_update ON public.mafia_games FOR UPDATE USING (true);

DROP POLICY IF EXISTS mafia_players_select ON public.mafia_players;
CREATE POLICY mafia_players_select ON public.mafia_players FOR SELECT USING (true);
-- Роли скроем через VIEW

DROP POLICY IF EXISTS mafia_players_insert ON public.mafia_players;
CREATE POLICY mafia_players_insert ON public.mafia_players FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS mafia_actions_select ON public.mafia_actions;
CREATE POLICY mafia_actions_select ON public.mafia_actions FOR SELECT USING (
  actor_user_id = auth.uid()
);

DROP POLICY IF EXISTS mafia_messages_select ON public.mafia_messages;
CREATE POLICY mafia_messages_select ON public.mafia_messages FOR SELECT USING (true);
-- Дополнительно скроем mafia-чат через RPC чтения

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mafia_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mafia_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mafia_messages;

-- 7. RPC: создать партию
CREATE OR REPLACE FUNCTION public.mafia_create_game(
  name_param TEXT,
  host_mode_param TEXT DEFAULT 'bot',
  min_players_param INT DEFAULT 4,
  max_players_param INT DEFAULT 20,
  night_seconds_param INT DEFAULT 60,
  day_seconds_param INT DEFAULT 180,
  vote_seconds_param INT DEFAULT 45
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
    night_seconds, day_seconds, vote_seconds
  ) VALUES (
    trim(name_param), uid, host_mode_param,
    CASE WHEN host_mode_param = 'manual' THEN uid ELSE NULL END,
    min_players_param, max_players_param,
    night_seconds_param, day_seconds_param, vote_seconds_param
  ) RETURNING id INTO game_id;

  -- Хост manual сразу присоединяется как игрок? — нет, ему предлагается отдельно
  -- Но создатель в bot режиме автоматически становится игроком
  IF host_mode_param = 'bot' THEN
    INSERT INTO public.mafia_players (game_id, user_id, seat_number)
    VALUES (game_id, uid, 1);
  END IF;

  RETURN game_id;
END;
$$;

-- 8. RPC: присоединиться
CREATE OR REPLACE FUNCTION public.mafia_join_game(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  cnt INT;
  next_seat INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.mafia_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'lobby' THEN RAISE EXCEPTION 'Game already started'; END IF;

  -- Хост manual не играет
  IF g.host_mode = 'manual' AND g.host_user_id = uid THEN
    RAISE EXCEPTION 'Host cannot play in manual mode';
  END IF;

  -- Уже в партии?
  IF EXISTS (SELECT 1 FROM public.mafia_players WHERE game_id = game_id_param AND user_id = uid) THEN
    RAISE EXCEPTION 'Already in game';
  END IF;

  SELECT COUNT(*) INTO cnt FROM public.mafia_players WHERE game_id = game_id_param;
  IF cnt >= g.max_players THEN RAISE EXCEPTION 'Game full'; END IF;

  next_seat := cnt + 1;

  INSERT INTO public.mafia_players (game_id, user_id, seat_number)
  VALUES (game_id_param, uid, next_seat);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 9. RPC: выйти (только в lobby)
CREATE OR REPLACE FUNCTION public.mafia_leave_game(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO g FROM public.mafia_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'lobby' THEN RAISE EXCEPTION 'Cannot leave running game'; END IF;

  DELETE FROM public.mafia_players WHERE game_id = game_id_param AND user_id = uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 10. RPC: старт игры (раздача ролей)
CREATE OR REPLACE FUNCTION public.mafia_start_game(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  cnt INT;
  mafia_count INT;
  has_don BOOLEAN;
  has_maniac BOOLEAN;
  has_sheriff BOOLEAN := TRUE;
  has_doctor BOOLEAN := TRUE;
  has_journalist BOOLEAN;
  has_lover BOOLEAN;
  players_arr UUID[];
  i INT;
  shuffled UUID[];
  role_idx INT;
  assigned_roles TEXT[];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.mafia_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'lobby' THEN RAISE EXCEPTION 'Already started'; END IF;

  -- Только хост или (в bot режиме) — создатель
  IF g.host_mode = 'manual' THEN
    IF g.host_user_id <> uid THEN RAISE EXCEPTION 'Only host can start'; END IF;
  ELSE
    IF g.created_by <> uid THEN RAISE EXCEPTION 'Only creator can start'; END IF;
  END IF;

  SELECT COUNT(*) INTO cnt FROM public.mafia_players WHERE game_id = game_id_param;
  IF cnt < g.min_players THEN RAISE EXCEPTION 'Need at least % players', g.min_players; END IF;

  -- Распределение ролей
  -- Мафия: примерно 1/4 от игроков
  mafia_count := GREATEST(1, FLOOR(cnt::NUMERIC / 4));

  -- Включаем дона если мафия >= 2
  has_don := mafia_count >= 2;
  -- Маньяк только если игроков >= 7
  has_maniac := cnt >= 7;
  -- Журналист если >= 6
  has_journalist := cnt >= 6;
  -- Любовница если >= 8
  has_lover := cnt >= 8;

  -- Собираем roles array
  assigned_roles := ARRAY[]::TEXT[];

  -- Мафия
  IF has_don THEN
    assigned_roles := assigned_roles || 'don';
    FOR i IN 1..(mafia_count - 1) LOOP assigned_roles := assigned_roles || 'mafia'; END LOOP;
  ELSE
    FOR i IN 1..mafia_count LOOP assigned_roles := assigned_roles || 'mafia'; END LOOP;
  END IF;

  -- Спецроли мирных
  assigned_roles := assigned_roles || 'sheriff';
  assigned_roles := assigned_roles || 'doctor';
  IF has_journalist THEN assigned_roles := assigned_roles || 'journalist'; END IF;
  IF has_lover THEN assigned_roles := assigned_roles || 'lover'; END IF;
  IF has_maniac THEN assigned_roles := assigned_roles || 'maniac'; END IF;

  -- Остальные — мирные
  WHILE array_length(assigned_roles, 1) < cnt LOOP
    assigned_roles := assigned_roles || 'civilian';
  END LOOP;

  -- Подмешиваем массив (Fisher-Yates через PostgreSQL)
  SELECT array_agg(role ORDER BY random()) INTO assigned_roles FROM unnest(assigned_roles) role;

  -- Собираем игроков
  SELECT array_agg(user_id ORDER BY seat_number) INTO players_arr
  FROM public.mafia_players WHERE game_id = game_id_param;

  -- Назначаем роли
  FOR i IN 1..array_length(players_arr, 1) LOOP
    UPDATE public.mafia_players
      SET role = assigned_roles[i]
      WHERE game_id = game_id_param AND user_id = players_arr[i];
  END LOOP;

  -- Стартуем партию
  UPDATE public.mafia_games SET
    status = 'playing',
    phase = 'intro',
    day_number = 0,
    phase_started_at = NOW(),
    phase_deadline_at = NOW() + (g.intro_seconds || ' seconds')::INTERVAL,
    started_at = NOW()
  WHERE id = game_id_param;

  -- Системное сообщение
  INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
  VALUES (game_id_param, 0, 'intro', 'system', 'Город просыпается. Знакомство.');

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 11. RPC: получить свою роль (защищённо)
CREATE OR REPLACE FUNCTION public.mafia_get_my_role(game_id_param UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  my_role TEXT;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT role INTO my_role FROM public.mafia_players
    WHERE game_id = game_id_param AND user_id = uid;
  RETURN my_role;
END;
$$;

-- 12. RPC: получить мафию (видна только мафии и дону)
CREATE OR REPLACE FUNCTION public.mafia_get_mafia_team(game_id_param UUID)
RETURNS TABLE(user_id UUID, role TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  my_role TEXT;
BEGIN
  SELECT mp.role INTO my_role FROM public.mafia_players mp
    WHERE mp.game_id = game_id_param AND mp.user_id = uid;
  IF my_role NOT IN ('mafia', 'don') THEN RETURN; END IF;
  RETURN QUERY
    SELECT mp.user_id, mp.role::TEXT FROM public.mafia_players mp
      WHERE mp.game_id = game_id_param AND mp.role IN ('mafia', 'don');
END;
$$;

-- 13. RPC: записать ночное действие
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

  -- Проверка разрешений по роли
  allowed := FALSE;
  IF action_type_param = 'mafia_kill' AND my_role IN ('mafia','don') THEN allowed := TRUE;
  ELSIF action_type_param = 'don_check' AND my_role = 'don' THEN allowed := TRUE;
  ELSIF action_type_param = 'sheriff_check' AND my_role = 'sheriff' THEN allowed := TRUE;
  ELSIF action_type_param = 'doctor_heal' AND my_role = 'doctor' THEN allowed := TRUE;
  ELSIF action_type_param = 'maniac_kill' AND my_role = 'maniac' THEN allowed := TRUE;
  ELSIF action_type_param = 'lover_block' AND my_role = 'lover' THEN allowed := TRUE;
  END IF;
  IF NOT allowed THEN RAISE EXCEPTION 'Not allowed for your role'; END IF;

  -- Доктор не может лечить одного и того же подряд
  IF action_type_param = 'doctor_heal' THEN
    SELECT last_healed_user_id INTO last_heal FROM public.mafia_players
      WHERE game_id = game_id_param AND user_id = uid;
    IF last_heal IS NOT NULL AND last_heal = target_user_id_param THEN
      RAISE EXCEPTION 'Cannot heal same player twice in a row';
    END IF;
    UPDATE public.mafia_players SET last_healed_user_id = target_user_id_param
      WHERE game_id = game_id_param AND user_id = uid;
  END IF;

  -- Шериф/Дон проверка — даём результат
  IF action_type_param = 'sheriff_check' THEN
    SELECT role INTO target_role FROM public.mafia_players
      WHERE game_id = game_id_param AND user_id = target_user_id_param;
    -- Дон показывается как мирный
    result_json := jsonb_build_object('is_mafia', target_role IN ('mafia'));
  ELSIF action_type_param = 'don_check' THEN
    SELECT role INTO target_role FROM public.mafia_players
      WHERE game_id = game_id_param AND user_id = target_user_id_param;
    result_json := jsonb_build_object('is_sheriff', target_role = 'sheriff');
  END IF;

  -- Удаляем предыдущее действие этого actor этого типа сегодня (можно менять решение)
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

-- 14. RPC: проголосовать (днём)
CREATE OR REPLACE FUNCTION public.mafia_vote(
  game_id_param UUID,
  target_user_id_param UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  my_status TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.mafia_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' OR g.phase <> 'vote' THEN RAISE EXCEPTION 'Not vote phase'; END IF;

  SELECT status INTO my_status FROM public.mafia_players
    WHERE game_id = game_id_param AND user_id = uid;
  IF my_status <> 'alive' THEN RAISE EXCEPTION 'Dead cannot vote'; END IF;

  -- Удаляем старый голос сегодня
  DELETE FROM public.mafia_actions
    WHERE game_id = game_id_param AND day_number = g.day_number
      AND phase = 'vote' AND actor_user_id = uid AND action_type = 'vote';

  INSERT INTO public.mafia_actions (game_id, day_number, phase, actor_user_id, action_type, target_user_id)
  VALUES (game_id_param, g.day_number, 'vote', uid, 'vote', target_user_id_param);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 15. RPC: переход к следующей фазе (вызывается ботом по таймеру или хостом)
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
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.mafia_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' THEN RAISE EXCEPTION 'Not playing'; END IF;

  -- Право на advance:
  -- manual mode → только хост
  -- bot mode → любой если phase_deadline_at прошёл, или хост в любое время
  IF g.host_mode = 'manual' THEN
    IF g.host_user_id <> uid THEN RAISE EXCEPTION 'Only host can advance'; END IF;
  ELSIF g.phase_deadline_at IS NOT NULL AND g.phase_deadline_at > NOW() AND g.created_by <> uid THEN
    -- Не разрешаем досрочный advance кроме создателя в bot режиме
    RAISE EXCEPTION 'Phase not yet expired';
  END IF;

  -- Логика перехода фаз
  IF g.phase = 'intro' THEN
    next_phase := 'night';
    next_day := 1;
    duration_sec := g.night_seconds;
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, 1, 'night', 'system', 'Ночь №1. Город засыпает.');

  ELSIF g.phase = 'night' THEN
    -- Разрешаем ночь
    -- 1. Любовница блокирует — её цель не действует
    SELECT target_user_id INTO blocked_user_id FROM public.mafia_actions
      WHERE game_id = game_id_param AND day_number = g.day_number AND action_type = 'lover_block'
      ORDER BY created_at DESC LIMIT 1;

    -- 2. Мафия выбирает (берём цель доном если он действовал, иначе любой мафии)
    SELECT target_user_id INTO killed_mafia_target FROM public.mafia_actions a
      JOIN public.mafia_players p ON p.user_id = a.actor_user_id AND p.game_id = a.game_id
      WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'mafia_kill'
        AND p.role = 'don'
        AND (blocked_user_id IS NULL OR a.actor_user_id <> blocked_user_id)
      ORDER BY a.created_at DESC LIMIT 1;
    IF killed_mafia_target IS NULL THEN
      SELECT target_user_id INTO killed_mafia_target FROM public.mafia_actions a
        WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'mafia_kill'
          AND (blocked_user_id IS NULL OR a.actor_user_id <> blocked_user_id)
        ORDER BY a.created_at DESC LIMIT 1;
    END IF;

    -- 3. Маньяк
    SELECT target_user_id INTO killed_maniac_target FROM public.mafia_actions a
      WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'maniac_kill'
        AND (blocked_user_id IS NULL OR a.actor_user_id <> blocked_user_id)
      ORDER BY a.created_at DESC LIMIT 1;

    -- 4. Доктор лечит
    SELECT target_user_id INTO healed_target FROM public.mafia_actions a
      WHERE a.game_id = game_id_param AND a.day_number = g.day_number AND a.action_type = 'doctor_heal'
        AND (blocked_user_id IS NULL OR a.actor_user_id <> blocked_user_id)
      ORDER BY a.created_at DESC LIMIT 1;

    -- Применяем смерти
    IF killed_mafia_target IS NOT NULL AND killed_mafia_target <> healed_target THEN
      killed_users := killed_users || killed_mafia_target;
    END IF;
    IF killed_maniac_target IS NOT NULL AND killed_maniac_target <> healed_target AND NOT (killed_maniac_target = ANY(killed_users)) THEN
      killed_users := killed_users || killed_maniac_target;
    END IF;

    -- Записываем в статусы
    IF array_length(killed_users, 1) IS NOT NULL THEN
      UPDATE public.mafia_players SET status = 'dead', died_day = g.day_number
        WHERE game_id = game_id_param AND user_id = ANY(killed_users);
    END IF;

    -- Сообщения утра
    IF array_length(killed_users, 1) IS NULL THEN
      announce_msg := 'Утро. Этой ночью никто не погиб.';
    ELSIF array_length(killed_users, 1) = 1 THEN
      announce_msg := 'Утро. Этой ночью погиб игрок.';
    ELSE
      announce_msg := 'Утро. Этой ночью погибли ' || array_length(killed_users, 1) || ' игрока.';
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
    VALUES (game_id_param, g.day_number, 'vote', 'system', 'Голосование. Кого изгнать?');

  ELSIF g.phase = 'vote' THEN
    -- Подсчёт голосов
    SELECT target_user_id, COUNT(*)::INT INTO vote_winner, vote_max
      FROM public.mafia_actions
      WHERE game_id = game_id_param AND day_number = g.day_number AND action_type = 'vote'
      GROUP BY target_user_id
      ORDER BY COUNT(*) DESC LIMIT 1;

    -- Проверка ничьи
    SELECT COUNT(DISTINCT target_user_id) > 1 INTO vote_tied FROM (
      SELECT target_user_id, COUNT(*) cnt FROM public.mafia_actions
        WHERE game_id = game_id_param AND day_number = g.day_number AND action_type = 'vote'
        GROUP BY target_user_id HAVING COUNT(*) = vote_max
    ) t;

    IF vote_winner IS NOT NULL AND NOT vote_tied THEN
      UPDATE public.mafia_players SET status = 'expelled', died_day = g.day_number
        WHERE game_id = game_id_param AND user_id = vote_winner;
      INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
      VALUES (game_id_param, g.day_number, 'vote', 'system', 'Игрок изгнан.');
    ELSE
      INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
      VALUES (game_id_param, g.day_number, 'vote', 'system', 'Голоса разделились. Никто не изгнан.');
    END IF;

    next_phase := 'night';
    next_day := g.day_number + 1;
    duration_sec := g.night_seconds;
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, next_day, 'night', 'system', 'Ночь №' || next_day || '. Город засыпает.');
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
    INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, content)
    VALUES (game_id_param, g.day_number, 'finished', 'system', 'Игра окончена. Победили: ' || winner);
    RETURN jsonb_build_object('ok', true, 'finished', true, 'winner', winner);
  END IF;

  -- Переход
  UPDATE public.mafia_games SET
    phase = next_phase,
    day_number = next_day,
    phase_started_at = NOW(),
    phase_deadline_at = NOW() + (duration_sec || ' seconds')::INTERVAL
  WHERE id = game_id_param;

  RETURN jsonb_build_object('ok', true, 'phase', next_phase, 'day', next_day);
END;
$$;

-- 16. RPC: отправить сообщение в чат
CREATE OR REPLACE FUNCTION public.mafia_send_message(
  game_id_param UUID,
  channel_param TEXT,
  content_param TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  my_role TEXT;
  my_status TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF channel_param NOT IN ('general','mafia') THEN RAISE EXCEPTION 'Invalid channel'; END IF;
  IF length(trim(content_param)) = 0 THEN RAISE EXCEPTION 'Empty message'; END IF;
  IF length(content_param) > 500 THEN RAISE EXCEPTION 'Message too long'; END IF;

  SELECT * INTO g FROM public.mafia_games WHERE id = game_id_param;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;

  SELECT role, status INTO my_role, my_status FROM public.mafia_players
    WHERE game_id = game_id_param AND user_id = uid;
  IF my_role IS NULL THEN RAISE EXCEPTION 'Not in game'; END IF;

  -- В mafia-чат могут писать только мафия и дон
  IF channel_param = 'mafia' AND my_role NOT IN ('mafia','don') THEN
    RAISE EXCEPTION 'Not in mafia';
  END IF;

  -- В общий чат — днём, в mafia-чат — ночью
  IF channel_param = 'general' AND g.phase = 'night' AND my_status = 'alive' THEN
    -- Живым нельзя писать в общий ночью (мафии нужно тайно)
    RAISE EXCEPTION 'Cannot write in general at night';
  END IF;

  INSERT INTO public.mafia_messages (game_id, day_number, phase, channel, sender_user_id, content)
  VALUES (game_id_param, g.day_number, g.phase, channel_param, uid, trim(content_param));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 17. RPC: получить сообщения мафии (только если я мафия)
CREATE OR REPLACE FUNCTION public.mafia_get_mafia_messages(game_id_param UUID, limit_param INT DEFAULT 100)
RETURNS TABLE(id BIGINT, content TEXT, sender_user_id UUID, day_number INT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  my_role TEXT;
BEGIN
  SELECT role INTO my_role FROM public.mafia_players
    WHERE game_id = game_id_param AND user_id = uid;
  IF my_role NOT IN ('mafia','don') THEN RETURN; END IF;
  RETURN QUERY
    SELECT m.id, m.content, m.sender_user_id, m.day_number, m.created_at
      FROM public.mafia_messages m
      WHERE m.game_id = game_id_param AND m.channel = 'mafia'
      ORDER BY m.created_at DESC LIMIT limit_param;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mafia_create_game(TEXT, TEXT, INT, INT, INT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mafia_join_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mafia_leave_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mafia_start_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mafia_get_my_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mafia_get_mafia_team(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mafia_night_action(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mafia_vote(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mafia_advance_phase(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mafia_send_message(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mafia_get_mafia_messages(UUID, INT) TO authenticated;

-- DONE
