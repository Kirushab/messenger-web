-- 105_grammar_progress.sql
-- Прогресс по грамматике: лучший результат на каждую тему (kind).

CREATE TABLE IF NOT EXISTS public.grammar_progress (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language     text NOT NULL,
  kind         text NOT NULL,
  best_correct int  NOT NULL DEFAULT 0,
  best_total   int  NOT NULL DEFAULT 0,
  attempts     int  NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, language, kind)
);

ALTER TABLE public.grammar_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own grammar progress select" ON public.grammar_progress;
CREATE POLICY "own grammar progress select" ON public.grammar_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own grammar progress upsert" ON public.grammar_progress;
CREATE POLICY "own grammar progress upsert" ON public.grammar_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own grammar progress update" ON public.grammar_progress;
CREATE POLICY "own grammar progress update" ON public.grammar_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
