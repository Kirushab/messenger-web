-- 110_level_test_results.sql
-- Результаты теста уровня (лучший % на язык+уровень).

CREATE TABLE IF NOT EXISTS public.level_test_results (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language   text NOT NULL,
  level      text NOT NULL,
  best_pct   int  NOT NULL DEFAULT 0,
  passed     boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, language, level)
);

ALTER TABLE public.level_test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own level test select" ON public.level_test_results;
CREATE POLICY "own level test select" ON public.level_test_results
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own level test insert" ON public.level_test_results;
CREATE POLICY "own level test insert" ON public.level_test_results
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own level test update" ON public.level_test_results;
CREATE POLICY "own level test update" ON public.level_test_results
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
