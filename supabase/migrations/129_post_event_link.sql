-- 129: Ссылка поста на событие (туса/поездка)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_event ON public.posts (event_id);
-- DONE
