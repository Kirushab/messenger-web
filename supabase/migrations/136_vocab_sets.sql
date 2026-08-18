-- 136_vocab_sets.sql
-- Свои наборы слов (term/translation) с привязкой к языку и шерингом в «Сообщество».
-- Идемпотентно. Пары хранятся как jsonb-массив [{term, tr}, ...].

CREATE TABLE IF NOT EXISTS public.vocab_sets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT '',
  emoji       text NOT NULL DEFAULT '🗂️',
  language    text NOT NULL DEFAULT 'en',
  pairs       jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public   boolean NOT NULL DEFAULT false,
  source_id   uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vocab_sets_owner  ON public.vocab_sets(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vocab_sets_public ON public.vocab_sets(is_public, updated_at DESC);

ALTER TABLE public.vocab_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vocab_sets_select" ON public.vocab_sets;
CREATE POLICY "vocab_sets_select" ON public.vocab_sets FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR is_public = true);

DROP POLICY IF EXISTS "vocab_sets_insert" ON public.vocab_sets;
CREATE POLICY "vocab_sets_insert" ON public.vocab_sets FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "vocab_sets_update" ON public.vocab_sets;
CREATE POLICY "vocab_sets_update" ON public.vocab_sets FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "vocab_sets_delete" ON public.vocab_sets;
CREATE POLICY "vocab_sets_delete" ON public.vocab_sets FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- updated_at автообновление
CREATE OR REPLACE FUNCTION public.touch_vocab_sets() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_vocab_sets ON public.vocab_sets;
CREATE TRIGGER trg_touch_vocab_sets BEFORE UPDATE ON public.vocab_sets
  FOR EACH ROW EXECUTE FUNCTION public.touch_vocab_sets();
