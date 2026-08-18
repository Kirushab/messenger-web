-- ============================================================
-- 070_languages_spaced_repetition.sql
-- Spaced Repetition: каждое слово имеет «уровень освоенности» 0-5
-- и «следующая дата показа». Трудные слова возвращаются быстрее.
-- Интервалы: L0=10мин, L1=1д, L2=3д, L3=7д, L4=14д, L5=30д
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_word_memory (
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  word_id        uuid NOT NULL REFERENCES public.language_words(id) ON DELETE CASCADE,
  level          int  NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 5),
  due_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz,
  correct_count  int NOT NULL DEFAULT 0,
  wrong_count    int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, word_id)
);

-- Индекс для быстрого поиска «что у юзера должно показаться сейчас»
CREATE INDEX IF NOT EXISTS idx_user_word_memory_due
  ON public.user_word_memory(user_id, due_at);

-- RLS
ALTER TABLE public.user_word_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User reads own memory" ON public.user_word_memory;
CREATE POLICY "User reads own memory" ON public.user_word_memory FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "User writes own memory" ON public.user_word_memory;
CREATE POLICY "User writes own memory" ON public.user_word_memory FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "User updates own memory" ON public.user_word_memory;
CREATE POLICY "User updates own memory" ON public.user_word_memory FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RPC: записать ответ на слово. Обновляет level и due_at.
DROP FUNCTION IF EXISTS public.record_word_answer(uuid, boolean);

CREATE OR REPLACE FUNCTION public.record_word_answer(
  word_id_param uuid,
  correct_param boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old_level int;
  v_new_level int;
  v_interval interval;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT level INTO v_old_level FROM public.user_word_memory
  WHERE user_id = v_uid AND word_id = word_id_param;
  IF v_old_level IS NULL THEN v_old_level := 0; END IF;

  -- Правильно → +1 уровень (макс 5). Ошибка → сброс до 0.
  IF correct_param THEN
    v_new_level := LEAST(v_old_level + 1, 5);
  ELSE
    v_new_level := 0;
  END IF;

  v_interval := CASE v_new_level
    WHEN 0 THEN INTERVAL '10 minutes'
    WHEN 1 THEN INTERVAL '1 day'
    WHEN 2 THEN INTERVAL '3 days'
    WHEN 3 THEN INTERVAL '7 days'
    WHEN 4 THEN INTERVAL '14 days'
    ELSE        INTERVAL '30 days'
  END;

  INSERT INTO public.user_word_memory
    (user_id, word_id, level, due_at, last_seen_at, correct_count, wrong_count)
  VALUES (v_uid, word_id_param, v_new_level, now() + v_interval, now(),
          CASE WHEN correct_param THEN 1 ELSE 0 END,
          CASE WHEN correct_param THEN 0 ELSE 1 END)
  ON CONFLICT (user_id, word_id) DO UPDATE SET
    level         = v_new_level,
    due_at        = now() + v_interval,
    last_seen_at  = now(),
    correct_count = user_word_memory.correct_count + (CASE WHEN correct_param THEN 1 ELSE 0 END),
    wrong_count   = user_word_memory.wrong_count   + (CASE WHEN correct_param THEN 0 ELSE 1 END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_word_answer(uuid, boolean) TO authenticated;
