-- 128: Реакции на истории (видны автору) + ссылка истории на событие

-- ============================================================
-- A. Реакции на истории — видны автору истории и самому реагировавшему
-- ============================================================
CREATE TABLE IF NOT EXISTS public.story_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_story_reactions_story ON public.story_reactions (story_id);

ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

-- Видеть: автор истории или сам реагировавший
DROP POLICY IF EXISTS story_reactions_select ON public.story_reactions;
CREATE POLICY story_reactions_select ON public.story_reactions FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_reactions.story_id AND s.user_id = auth.uid())
);

-- Ставить можно только свою реакцию
DROP POLICY IF EXISTS story_reactions_insert ON public.story_reactions;
CREATE POLICY story_reactions_insert ON public.story_reactions FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- Менять свою (для on-conflict upsert смены эмодзи)
DROP POLICY IF EXISTS story_reactions_update ON public.story_reactions;
CREATE POLICY story_reactions_update ON public.story_reactions FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (user_id = auth.uid());

-- Убрать свою
DROP POLICY IF EXISTS story_reactions_delete ON public.story_reactions;
CREATE POLICY story_reactions_delete ON public.story_reactions FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- B. Ссылка истории на событие (туса/поездка)
-- ============================================================
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stories_event ON public.stories (event_id);

-- DONE
