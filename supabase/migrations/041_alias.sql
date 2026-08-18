-- ============================================================
-- 041_alias.sql — v52 Alias (объясняй слова, угадывай командой, бай-ин в Sigmas Coins)
-- ============================================================

-- 1. Встроенный словарь (русский)
CREATE TABLE IF NOT EXISTS public.alias_dictionary (
  id BIGSERIAL PRIMARY KEY,
  word TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  difficulty SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty IN (1, 2, 3))
);

CREATE INDEX IF NOT EXISTS idx_alias_dict_category ON public.alias_dictionary(category);

-- Заливаем базовый словарь (200+ слов)
INSERT INTO public.alias_dictionary(word, category, difficulty) VALUES
-- Простые (1)
('арбуз','еда',1),('банан','еда',1),('виноград','еда',1),('грузовик','транспорт',1),('дом','предметы',1),
('ёлка','природа',1),('журавль','природа',1),('заяц','животные',1),('игла','предметы',1),('кит','животные',1),
('лимон','еда',1),('молоко','еда',1),('нос','тело',1),('окно','предметы',1),('папа','семья',1),
('река','природа',1),('собака','животные',1),('телефон','техника',1),('утка','животные',1),('фонарь','предметы',1),
('хлеб','еда',1),('часы','предметы',1),('школа','места',1),('щётка','предметы',1),('яблоко','еда',1),
('акула','животные',1),('бабочка','животные',1),('велосипед','транспорт',1),('гитара','музыка',1),('дождь','природа',1),
('ель','природа',1),('зонт','предметы',1),('игрушка','предметы',1),('кошка','животные',1),('луна','природа',1),
('мост','предметы',1),('небо','природа',1),('очки','предметы',1),('пирог','еда',1),('ракета','транспорт',1),
('солнце','природа',1),('торт','еда',1),('улица','места',1),('фотограф','профессии',1),('хвост','тело',1),
('цветок','природа',1),('чай','еда',1),('шарф','одежда',1),('юбка','одежда',1),('ящик','предметы',1),
-- Средние (2)
('самолёт','транспорт',2),('водопад','природа',2),('телескоп','техника',2),('компьютер','техника',2),('пирамида','места',2),
('кенгуру','животные',2),('черепаха','животные',2),('дельфин','животные',2),('крокодил','животные',2),('страус','животные',2),
('пожарный','профессии',2),('космонавт','профессии',2),('художник','профессии',2),('повар','профессии',2),('писатель','профессии',2),
('симфония','музыка',2),('гитарист','музыка',2),('концерт','музыка',2),('опера','музыка',2),('балет','музыка',2),
('парусник','транспорт',2),('подводная лодка','транспорт',2),('вертолёт','транспорт',2),('паровоз','транспорт',2),('катер','транспорт',2),
('пельмени','еда',2),('борщ','еда',2),('мороженое','еда',2),('блины','еда',2),('варенье','еда',2),
('библиотека','места',2),('стадион','места',2),('музей','места',2),('театр','места',2),('зоопарк','места',2),
('водопровод','предметы',2),('пылесос','техника',2),('микроволновка','техника',2),('холодильник','техника',2),('телевизор','техника',2),
('радуга','природа',2),('молния','природа',2),('вулкан','природа',2),('айсберг','природа',2),('пустыня','природа',2),
('доктор','профессии',2),('инженер','профессии',2),('программист','профессии',2),('фотограф','профессии',2),('журналист','профессии',2),
('баскетбол','спорт',2),('хоккей','спорт',2),('теннис','спорт',2),('волейбол','спорт',2),('бокс','спорт',2),
('лыжи','спорт',2),('коньки','спорт',2),('гимнастика','спорт',2),('плавание','спорт',2),('бег','спорт',2),
-- Сложные (3)
('меланхолия','абстрактное',3),('эволюция','абстрактное',3),('революция','абстрактное',3),('гипотеза','абстрактное',3),('парадокс','абстрактное',3),
('инфляция','абстрактное',3),('демократия','абстрактное',3),('философия','абстрактное',3),('симметрия','абстрактное',3),('бесконечность','абстрактное',3),
('телепортация','абстрактное',3),('эмпатия','абстрактное',3),('ностальгия','абстрактное',3),('амбиция','абстрактное',3),('гармония','абстрактное',3),
('археолог','профессии',3),('космогония','абстрактное',3),('палеонтолог','профессии',3),('криптография','абстрактное',3),('диалектика','абстрактное',3),
('кофейня','места',3),('обсерватория','места',3),('батискаф','транспорт',3),('голограмма','техника',3),('конструктор','профессии',3),
('флибустьер','профессии',3),('кардиограмма','техника',3),('каллиграфия','абстрактное',3),('синтезатор','техника',3),('магнолия','природа',3),
('эспрессо','еда',3),('бельгийская вафля','еда',3),('капуччино','еда',3),('тирамису','еда',3),('крем-брюле','еда',3),
('хамелеон','животные',3),('тукан','животные',3),('игуана','животные',3),('коала','животные',3),('броненосец','животные',3),
('тостер','техника',3),('эспандер','спорт',3),('арбалет','предметы',3),('сейсмограф','техника',3),('маяк','предметы',3),
('боксёрская груша','спорт',3),('наушники','техника',3),('гироскутер','транспорт',3),('фуникулёр','транспорт',3),('дирижабль','транспорт',3)
ON CONFLICT DO NOTHING;

-- 2. Партии
CREATE TABLE IF NOT EXISTS public.alias_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  host_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Настройки
  min_teams INT NOT NULL DEFAULT 2 CHECK (min_teams >= 2 AND min_teams <= 6),
  max_teams INT NOT NULL DEFAULT 4 CHECK (max_teams >= 2 AND max_teams <= 6),
  min_team_size INT NOT NULL DEFAULT 2 CHECK (min_team_size >= 2),
  max_team_size INT NOT NULL DEFAULT 5,
  round_seconds INT NOT NULL DEFAULT 60 CHECK (round_seconds BETWEEN 20 AND 300),
  win_condition_type TEXT NOT NULL DEFAULT 'score' CHECK (win_condition_type IN ('score', 'rounds')),
  win_condition_value INT NOT NULL DEFAULT 30,
  difficulty SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty IN (1, 2, 3)),
  buy_in_coins BIGINT NOT NULL DEFAULT 0 CHECK (buy_in_coins >= 0),
  prize_pool BIGINT NOT NULL DEFAULT 0,
  miss_penalty INT NOT NULL DEFAULT 1, -- штраф за пропуск (0 или 1)

  -- Состояние
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'finished', 'aborted')),
  phase TEXT NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby', 'waiting_explainer', 'explaining', 'between_rounds', 'finished')),
  current_team_id UUID,
  current_explainer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  current_word TEXT,
  current_word_started_at TIMESTAMPTZ,
  round_number INT NOT NULL DEFAULT 0,
  round_started_at TIMESTAMPTZ,
  round_deadline_at TIMESTAMPTZ,
  winner_team_id UUID,

  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alias_games_status ON public.alias_games(status);

-- 3. Команды
CREATE TABLE IF NOT EXISTS public.alias_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.alias_games(id) ON DELETE CASCADE,
  team_number INT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  rounds_played INT NOT NULL DEFAULT 0,
  UNIQUE(game_id, team_number)
);

CREATE INDEX IF NOT EXISTS idx_alias_teams_game ON public.alias_teams(game_id);

-- 4. Игроки
CREATE TABLE IF NOT EXISTS public.alias_players (
  game_id UUID NOT NULL REFERENCES public.alias_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.alias_teams(id) ON DELETE SET NULL,
  buy_in_paid BIGINT NOT NULL DEFAULT 0,
  words_explained INT NOT NULL DEFAULT 0,
  words_guessed INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_alias_players_team ON public.alias_players(team_id);

-- 5. История слов раунда
CREATE TABLE IF NOT EXISTS public.alias_round_words (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.alias_games(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  team_id UUID NOT NULL REFERENCES public.alias_teams(id) ON DELETE CASCADE,
  explainer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('guessed', 'skipped')),
  score_change INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alias_round_words_game ON public.alias_round_words(game_id, round_number);

-- 6. Чат угадываний
CREATE TABLE IF NOT EXISTS public.alias_messages (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.alias_games(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.alias_teams(id) ON DELETE SET NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alias_messages_game ON public.alias_messages(game_id, created_at);

-- 7. RLS
ALTER TABLE public.alias_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alias_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alias_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alias_round_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alias_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alias_games_select ON public.alias_games;
CREATE POLICY alias_games_select ON public.alias_games FOR SELECT USING (true);

DROP POLICY IF EXISTS alias_teams_select ON public.alias_teams;
CREATE POLICY alias_teams_select ON public.alias_teams FOR SELECT USING (true);

DROP POLICY IF EXISTS alias_players_select ON public.alias_players;
CREATE POLICY alias_players_select ON public.alias_players FOR SELECT USING (true);

DROP POLICY IF EXISTS alias_round_words_select ON public.alias_round_words;
CREATE POLICY alias_round_words_select ON public.alias_round_words FOR SELECT USING (true);

DROP POLICY IF EXISTS alias_messages_select ON public.alias_messages;
CREATE POLICY alias_messages_select ON public.alias_messages FOR SELECT USING (true);

-- 8. Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alias_games;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alias_teams;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alias_players;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alias_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. RPC: создать партию
CREATE OR REPLACE FUNCTION public.alias_create_game(
  name_param TEXT,
  min_teams_param INT DEFAULT 2,
  max_teams_param INT DEFAULT 4,
  min_team_size_param INT DEFAULT 2,
  max_team_size_param INT DEFAULT 5,
  round_seconds_param INT DEFAULT 60,
  win_condition_type_param TEXT DEFAULT 'score',
  win_condition_value_param INT DEFAULT 30,
  difficulty_param SMALLINT DEFAULT 2,
  buy_in_coins_param BIGINT DEFAULT 0,
  miss_penalty_param INT DEFAULT 1
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  game_id UUID;
  team_colors TEXT[] := ARRAY['#dc2626', '#2563eb', '#16a34a', '#eab308', '#a855f7', '#ec4899'];
  i INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(name_param)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF win_condition_type_param NOT IN ('score', 'rounds') THEN RAISE EXCEPTION 'Invalid win condition'; END IF;
  IF min_teams_param > max_teams_param THEN RAISE EXCEPTION 'min_teams > max_teams'; END IF;
  IF min_team_size_param > max_team_size_param THEN RAISE EXCEPTION 'min_team_size > max_team_size'; END IF;

  INSERT INTO public.alias_games (
    name, host_user_id,
    min_teams, max_teams, min_team_size, max_team_size,
    round_seconds, win_condition_type, win_condition_value,
    difficulty, buy_in_coins, miss_penalty
  ) VALUES (
    trim(name_param), uid,
    min_teams_param, max_teams_param, min_team_size_param, max_team_size_param,
    round_seconds_param, win_condition_type_param, win_condition_value_param,
    difficulty_param, buy_in_coins_param, miss_penalty_param
  ) RETURNING id INTO game_id;

  -- Создаём пустые команды по max_teams
  FOR i IN 1..max_teams_param LOOP
    INSERT INTO public.alias_teams (game_id, team_number, name, color)
    VALUES (game_id, i, 'Команда ' || i, team_colors[((i-1) % array_length(team_colors,1)) + 1]);
  END LOOP;

  RETURN game_id;
END;
$$;

-- 10. RPC: присоединиться к команде (с бай-ином)
CREATE OR REPLACE FUNCTION public.alias_join_team(
  game_id_param UUID,
  team_id_param UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  team_size INT;
  current_balance BIGINT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.alias_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'lobby' THEN RAISE EXCEPTION 'Game already started'; END IF;

  -- Уже играет?
  IF EXISTS (SELECT 1 FROM public.alias_players WHERE game_id = game_id_param AND user_id = uid) THEN
    RAISE EXCEPTION 'You are already in this game';
  END IF;

  -- Команда существует и не переполнена?
  IF NOT EXISTS (SELECT 1 FROM public.alias_teams WHERE id = team_id_param AND game_id = game_id_param) THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  SELECT COUNT(*) INTO team_size FROM public.alias_players WHERE team_id = team_id_param;
  IF team_size >= g.max_team_size THEN RAISE EXCEPTION 'Team full'; END IF;

  -- Списываем бай-ин
  IF g.buy_in_coins > 0 THEN
    SELECT balance INTO current_balance FROM public.wallets WHERE user_id = uid FOR UPDATE;
    IF current_balance IS NULL OR current_balance < g.buy_in_coins THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;

    UPDATE public.wallets SET balance = balance - g.buy_in_coins WHERE user_id = uid;
    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (uid, 'game_buyin', -g.buy_in_coins, 'Alias buy-in', jsonb_build_object('alias_game_id', game_id_param));

    UPDATE public.alias_games SET prize_pool = prize_pool + g.buy_in_coins WHERE id = game_id_param;
  END IF;

  INSERT INTO public.alias_players (game_id, user_id, team_id, buy_in_paid)
  VALUES (game_id_param, uid, team_id_param, g.buy_in_coins);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 11. RPC: выйти из партии (только в лобби) — возврат бай-ина
CREATE OR REPLACE FUNCTION public.alias_leave_game(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  player RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO g FROM public.alias_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'lobby' THEN RAISE EXCEPTION 'Cannot leave running game'; END IF;

  SELECT * INTO player FROM public.alias_players WHERE game_id = game_id_param AND user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not in game'; END IF;

  -- Возврат бай-ина
  IF player.buy_in_paid > 0 THEN
    UPDATE public.wallets SET balance = balance + player.buy_in_paid WHERE user_id = uid;
    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (uid, 'game_win', player.buy_in_paid, 'Alias buy-in refund', jsonb_build_object('alias_game_id', game_id_param));

    UPDATE public.alias_games SET prize_pool = prize_pool - player.buy_in_paid WHERE id = game_id_param;
  END IF;

  DELETE FROM public.alias_players WHERE game_id = game_id_param AND user_id = uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 12. Helper: выбрать случайное слово из словаря
CREATE OR REPLACE FUNCTION public.alias_pick_word(difficulty_param SMALLINT, exclude_words TEXT[])
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  picked_word TEXT;
BEGIN
  SELECT word INTO picked_word FROM public.alias_dictionary
    WHERE difficulty <= difficulty_param
      AND (exclude_words IS NULL OR NOT (word = ANY(exclude_words)))
    ORDER BY random() LIMIT 1;
  RETURN COALESCE(picked_word, '???');
END;
$$;

-- 13. RPC: старт игры (хост, минимум команд заполнены)
CREATE OR REPLACE FUNCTION public.alias_start_game(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  ready_teams INT;
  first_team UUID;
  first_explainer UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.alias_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'lobby' THEN RAISE EXCEPTION 'Already started'; END IF;
  IF g.host_user_id <> uid THEN RAISE EXCEPTION 'Only host can start'; END IF;

  -- Проверяем что минимум min_teams команд имеют >= min_team_size игроков
  SELECT COUNT(*) INTO ready_teams FROM (
    SELECT t.id FROM public.alias_teams t
      JOIN public.alias_players p ON p.team_id = t.id
      WHERE t.game_id = game_id_param
      GROUP BY t.id
      HAVING COUNT(p.user_id) >= g.min_team_size
  ) ready;
  IF ready_teams < g.min_teams THEN
    RAISE EXCEPTION 'Need at least % teams with % players each', g.min_teams, g.min_team_size;
  END IF;

  -- Удаляем пустые команды
  DELETE FROM public.alias_teams WHERE game_id = game_id_param
    AND id NOT IN (SELECT DISTINCT team_id FROM public.alias_players WHERE game_id = game_id_param AND team_id IS NOT NULL);

  -- Первая команда — с наименьшим team_number
  SELECT id INTO first_team FROM public.alias_teams
    WHERE game_id = game_id_param ORDER BY team_number LIMIT 1;

  -- Первый объясняющий — первый игрок в команде по joined_at
  SELECT user_id INTO first_explainer FROM public.alias_players
    WHERE game_id = game_id_param AND team_id = first_team ORDER BY joined_at LIMIT 1;

  UPDATE public.alias_games SET
    status = 'playing',
    phase = 'waiting_explainer',
    current_team_id = first_team,
    current_explainer_id = first_explainer,
    round_number = 1,
    started_at = NOW()
  WHERE id = game_id_param;

  INSERT INTO public.alias_messages (game_id, round_number, is_system, content)
  VALUES (game_id_param, 1, TRUE, '🎬 Партия началась! Объясняющий готовится...');

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 14. RPC: начать раунд (объясняющий нажимает "Готов")
CREATE OR REPLACE FUNCTION public.alias_start_round(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  new_word TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.alias_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' OR g.phase <> 'waiting_explainer' THEN RAISE EXCEPTION 'Not in waiting phase'; END IF;
  IF g.current_explainer_id <> uid THEN RAISE EXCEPTION 'Only current explainer can start round'; END IF;

  new_word := public.alias_pick_word(g.difficulty::SMALLINT,
    (SELECT array_agg(word) FROM public.alias_round_words WHERE game_id = game_id_param));

  UPDATE public.alias_games SET
    phase = 'explaining',
    current_word = new_word,
    current_word_started_at = NOW(),
    round_started_at = NOW(),
    round_deadline_at = NOW() + (g.round_seconds || ' seconds')::INTERVAL
  WHERE id = game_id_param;

  RETURN jsonb_build_object('ok', true, 'word', new_word);
END;
$$;

-- 15. RPC: получить текущее слово (видно только объясняющему и хосту)
CREATE OR REPLACE FUNCTION public.alias_get_current_word(game_id_param UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
BEGIN
  SELECT * INTO g FROM public.alias_games WHERE id = game_id_param;
  IF g.current_explainer_id = uid OR g.host_user_id = uid THEN
    RETURN g.current_word;
  END IF;
  RETURN NULL;
END;
$$;

-- 16. RPC: отметить угадано / пропустить (объясняющий или хост)
CREATE OR REPLACE FUNCTION public.alias_mark_word(
  game_id_param UUID,
  guessed_param BOOLEAN  -- true = угадано (+1), false = пропустить (-miss_penalty)
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  score_change INT;
  new_word TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.alias_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' OR g.phase <> 'explaining' THEN RAISE EXCEPTION 'Not in explaining phase'; END IF;
  IF g.current_explainer_id <> uid AND g.host_user_id <> uid THEN
    RAISE EXCEPTION 'Only explainer or host can mark word';
  END IF;
  IF g.round_deadline_at < NOW() THEN
    RAISE EXCEPTION 'Round already finished';
  END IF;

  IF guessed_param THEN
    score_change := 1;
  ELSE
    score_change := -g.miss_penalty;
  END IF;

  -- Записываем слово
  INSERT INTO public.alias_round_words (game_id, round_number, team_id, explainer_id, word, status, score_change)
  VALUES (game_id_param, g.round_number, g.current_team_id, g.current_explainer_id, g.current_word,
    CASE WHEN guessed_param THEN 'guessed' ELSE 'skipped' END, score_change);

  -- Обновляем счёт команды
  UPDATE public.alias_teams SET score = score + score_change WHERE id = g.current_team_id;

  -- Счётчики игрока
  IF guessed_param THEN
    UPDATE public.alias_players SET words_explained = words_explained + 1
      WHERE game_id = game_id_param AND user_id = g.current_explainer_id;
  END IF;

  -- Берём следующее слово
  new_word := public.alias_pick_word(g.difficulty::SMALLINT,
    (SELECT array_agg(word) FROM public.alias_round_words WHERE game_id = game_id_param));

  UPDATE public.alias_games SET
    current_word = new_word,
    current_word_started_at = NOW()
  WHERE id = game_id_param;

  RETURN jsonb_build_object('ok', true, 'next_word', new_word, 'score_change', score_change);
END;
$$;

-- 17. RPC: завершить раунд (по таймеру или вручную хостом)
CREATE OR REPLACE FUNCTION public.alias_finish_round(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  next_team RECORD;
  next_explainer UUID;
  team_rounds INT;
  current_team RECORD;
  winning_team RECORD;
  total_rounds_per_team INT;
  total_teams INT;
  all_teams_done BOOLEAN := FALSE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.alias_games WHERE id = game_id_param FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.status <> 'playing' OR g.phase NOT IN ('explaining', 'waiting_explainer') THEN
    RAISE EXCEPTION 'Wrong phase';
  END IF;

  -- Право — текущий объясняющий или хост или (если deadline истёк) кто угодно
  IF g.current_explainer_id <> uid AND g.host_user_id <> uid
     AND (g.round_deadline_at IS NULL OR g.round_deadline_at > NOW()) THEN
    RAISE EXCEPTION 'Cannot finish round yet';
  END IF;

  -- Прибавляем команде +1 раунд
  UPDATE public.alias_teams SET rounds_played = rounds_played + 1 WHERE id = g.current_team_id;

  -- Проверка победы
  SELECT * INTO current_team FROM public.alias_teams WHERE id = g.current_team_id;

  IF g.win_condition_type = 'score' AND current_team.score >= g.win_condition_value THEN
    PERFORM public.alias_finalize_game(game_id_param);
    RETURN jsonb_build_object('ok', true, 'finished', true);
  END IF;

  -- Проверка по раундам: все команды сыграли N раз?
  IF g.win_condition_type = 'rounds' THEN
    SELECT COUNT(*) INTO total_teams FROM public.alias_teams WHERE game_id = game_id_param;
    SELECT COUNT(*) INTO team_rounds FROM public.alias_teams
      WHERE game_id = game_id_param AND rounds_played >= g.win_condition_value;
    IF team_rounds = total_teams THEN
      PERFORM public.alias_finalize_game(game_id_param);
      RETURN jsonb_build_object('ok', true, 'finished', true);
    END IF;
  END IF;

  -- Следующая команда — по team_number (циклически)
  SELECT * INTO next_team FROM public.alias_teams
    WHERE game_id = game_id_param AND team_number > current_team.team_number
    ORDER BY team_number LIMIT 1;
  IF NOT FOUND THEN
    SELECT * INTO next_team FROM public.alias_teams
      WHERE game_id = game_id_param ORDER BY team_number LIMIT 1;
  END IF;

  -- В команде объясняющие сменяются по очереди (по joined_at)
  -- Берём последнего объясняющего в команде и следующего
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
    '🔄 Раунд ' || (g.round_number + 1) || '. Очередь: ' || next_team.name);

  RETURN jsonb_build_object('ok', true, 'next_team_id', next_team.id);
END;
$$;

-- 18. RPC: финализация партии + раздача призов
CREATE OR REPLACE FUNCTION public.alias_finalize_game(game_id_param UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g RECORD;
  winning_team RECORD;
  winners_count INT;
  prize_per_winner BIGINT;
  player_id UUID;
BEGIN
  SELECT * INTO g FROM public.alias_games WHERE id = game_id_param FOR UPDATE;
  IF g.status = 'finished' THEN RETURN jsonb_build_object('ok', true); END IF;

  -- Команда с максимальным счётом (если ничья — берём первую)
  SELECT * INTO winning_team FROM public.alias_teams
    WHERE game_id = game_id_param ORDER BY score DESC, team_number ASC LIMIT 1;

  -- Раздача призового пула
  IF g.prize_pool > 0 AND winning_team.id IS NOT NULL THEN
    SELECT COUNT(*) INTO winners_count FROM public.alias_players
      WHERE game_id = game_id_param AND team_id = winning_team.id;
    IF winners_count > 0 THEN
      prize_per_winner := g.prize_pool / winners_count;
      FOR player_id IN
        SELECT user_id FROM public.alias_players
        WHERE game_id = game_id_param AND team_id = winning_team.id
      LOOP
        UPDATE public.wallets SET balance = balance + prize_per_winner,
          lifetime_earned = lifetime_earned + prize_per_winner
          WHERE user_id = player_id;
        INSERT INTO public.transactions (user_id, type, amount, description, metadata)
        VALUES (player_id, 'game_win', prize_per_winner, 'Alias win',
          jsonb_build_object('alias_game_id', game_id_param, 'team_id', winning_team.id));
      END LOOP;
    END IF;
  END IF;

  UPDATE public.alias_games SET
    status = 'finished',
    phase = 'finished',
    winner_team_id = winning_team.id,
    finished_at = NOW()
  WHERE id = game_id_param;

  INSERT INTO public.alias_messages (game_id, round_number, is_system, content)
  VALUES (game_id_param, g.round_number, TRUE,
    '🎉 Партия окончена! Победила ' || winning_team.name || ' со счётом ' || winning_team.score);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 19. RPC: отправить угадку в чат
CREATE OR REPLACE FUNCTION public.alias_send_guess(game_id_param UUID, content_param TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  g RECORD;
  my_team UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(content_param)) = 0 THEN RAISE EXCEPTION 'Empty'; END IF;
  IF length(content_param) > 200 THEN RAISE EXCEPTION 'Too long'; END IF;

  SELECT * INTO g FROM public.alias_games WHERE id = game_id_param;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;

  SELECT team_id INTO my_team FROM public.alias_players WHERE game_id = game_id_param AND user_id = uid;

  INSERT INTO public.alias_messages (game_id, round_number, sender_user_id, team_id, content)
  VALUES (game_id_param, g.round_number, uid, my_team, trim(content_param));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.alias_create_game(TEXT, INT, INT, INT, INT, INT, TEXT, INT, SMALLINT, BIGINT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alias_join_team(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alias_leave_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alias_start_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alias_start_round(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alias_get_current_word(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alias_mark_word(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alias_finish_round(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alias_finalize_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alias_send_guess(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alias_pick_word(SMALLINT, TEXT[]) TO authenticated;

-- DONE
