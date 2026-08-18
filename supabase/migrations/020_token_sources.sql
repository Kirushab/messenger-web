-- ============================================================
-- 020_token_sources.sql
-- Подключение источников токенов к существующим фичам (v35)
-- За пост, лайк, коммент. Streak-бонусы для daily check-in.
-- ============================================================

-- Лимиты:
--   * Пост: +20 токенов автору, не больше 5 постов в день
--   * Лайк: +5 автору поста (от любого юзера кроме себя). Не больше 50 лайков в день
--   * Коммент: +5 автору поста (от любого кроме себя). Не больше 30 комментов в день
--   * Streak 7 дней daily_checkin подряд: +50
--   * Streak 30 дней подряд: +200

-- ============================================================
-- 1) Триггер на posts: +20 автору при создании
-- ============================================================
CREATE OR REPLACE FUNCTION public.reward_post_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count_today INT;
BEGIN
  -- Не больше 5 постов в день дают токены
  SELECT COUNT(*) INTO count_today
  FROM public.transactions
  WHERE user_id = NEW.author_id
    AND type = 'post_reward'
    AND created_at::date = NOW()::date;

  IF count_today >= 5 THEN
    RETURN NEW;  -- лимит исчерпан, ничего не начисляем
  END IF;

  PERFORM public.award_tokens(
    NEW.author_id,
    20::BIGINT,
    'post_reward',
    'Пост в ленте',
    jsonb_build_object('post_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_reward_trigger ON public.posts;
CREATE TRIGGER posts_reward_trigger
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.reward_post_creation();

-- ============================================================
-- 2) Триггер на post_likes: +5 автору поста
-- ============================================================
CREATE OR REPLACE FUNCTION public.reward_like_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author UUID;
  count_today INT;
BEGIN
  -- Получаем автора поста
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NULL THEN RETURN NEW; END IF;

  -- Лайк от себя не считается
  IF post_author = NEW.user_id THEN RETURN NEW; END IF;

  -- Не больше 50 лайков-наград в день автору
  SELECT COUNT(*) INTO count_today
  FROM public.transactions
  WHERE user_id = post_author
    AND type = 'like_received'
    AND created_at::date = NOW()::date;

  IF count_today >= 50 THEN RETURN NEW; END IF;

  PERFORM public.award_tokens(
    post_author,
    5::BIGINT,
    'like_received',
    'Лайк к посту',
    jsonb_build_object('post_id', NEW.post_id, 'liker_id', NEW.user_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_likes_reward_trigger ON public.post_likes;
CREATE TRIGGER post_likes_reward_trigger
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.reward_like_received();

-- ============================================================
-- 3) Триггер на post_comments: +5 автору поста за комментарий от другого
-- ============================================================
CREATE OR REPLACE FUNCTION public.reward_comment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author UUID;
  count_today INT;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NULL THEN RETURN NEW; END IF;

  -- Коммент от себя не считается
  IF post_author = NEW.author_id THEN RETURN NEW; END IF;

  -- Лимит 30 комментов-наград в день
  SELECT COUNT(*) INTO count_today
  FROM public.transactions
  WHERE user_id = post_author
    AND type = 'comment_received'
    AND created_at::date = NOW()::date;

  IF count_today >= 30 THEN RETURN NEW; END IF;

  PERFORM public.award_tokens(
    post_author,
    5::BIGINT,
    'comment_received',
    'Комментарий к посту',
    jsonb_build_object('post_id', NEW.post_id, 'commenter_id', NEW.author_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_comments_reward_trigger ON public.post_comments;
CREATE TRIGGER post_comments_reward_trigger
  AFTER INSERT ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.reward_comment_received();

-- ============================================================
-- 4) Обновление claim_daily_checkin: streak-бонусы +50 за 7 дней, +200 за 30
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_daily_checkin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  last_checkin TIMESTAMPTZ;
  reward BIGINT := 10;
  streak_len INT := 1;
  expected DATE;
  has_day BOOLEAN;
  bonus BIGINT := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT created_at INTO last_checkin
  FROM public.transactions
  WHERE user_id = uid AND type = 'daily_checkin'
  ORDER BY created_at DESC
  LIMIT 1;

  IF last_checkin IS NOT NULL AND last_checkin::date = NOW()::date THEN
    RAISE EXCEPTION 'Already claimed today';
  END IF;

  -- Считаем длину streak: смотрим назад день за днём
  expected := NOW()::date - INTERVAL '1 day';
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.transactions
      WHERE user_id = uid AND type = 'daily_checkin'
        AND created_at::date = expected
    ) INTO has_day;

    IF NOT has_day THEN EXIT; END IF;
    streak_len := streak_len + 1;
    expected := expected - INTERVAL '1 day';

    -- Защита от бесконечного цикла
    IF streak_len > 365 THEN EXIT; END IF;
  END LOOP;

  -- Базовое начисление
  INSERT INTO public.wallets (user_id, balance, lifetime_earned)
    VALUES (uid, reward, reward)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + reward,
        lifetime_earned = wallets.lifetime_earned + reward;

  INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (uid, 'daily_checkin', reward, 'Ежедневный заход');

  -- Streak бонусы (один раз когда streak достигает 7 или 30)
  IF streak_len = 7 THEN
    bonus := 50;
  ELSIF streak_len = 30 THEN
    bonus := 200;
  END IF;

  IF bonus > 0 THEN
    UPDATE public.wallets
      SET balance = balance + bonus, lifetime_earned = lifetime_earned + bonus
      WHERE user_id = uid;
    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
      VALUES (uid, 'streak_bonus', bonus, 'Streak ' || streak_len || ' дней',
              jsonb_build_object('streak', streak_len));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'amount', reward,
    'streak', streak_len,
    'bonus', bonus
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_checkin() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin() TO authenticated;
