-- 046_tinder.sql
-- Tinder режим: идентификация TINDER аккаунта + whitelist доступа

-- ============================================================
-- 1. Whitelist доступа к Tinder ленте
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tinder_access (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Функция: получить ID TINDER аккаунта (по email)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tinder_user_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT id FROM public.users WHERE email = 'tinder@sigmas.local' LIMIT 1;
$$;

-- ============================================================
-- 3. Функция: имеет ли текущий пользователь доступ к Tinder ленте
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_tinder_access()
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tinder_access WHERE user_id = auth.uid()
  ) OR auth.uid() = public.tinder_user_id();
$$;

-- ============================================================
-- 4. RLS на tinder_access
-- ============================================================
ALTER TABLE public.tinder_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tinder_access_select" ON public.tinder_access;
CREATE POLICY "tinder_access_select" ON public.tinder_access
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tinder_access_insert" ON public.tinder_access;
CREATE POLICY "tinder_access_insert" ON public.tinder_access
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = public.tinder_user_id());

DROP POLICY IF EXISTS "tinder_access_delete" ON public.tinder_access;
CREATE POLICY "tinder_access_delete" ON public.tinder_access
  FOR DELETE TO authenticated
  USING (auth.uid() = public.tinder_user_id());

-- ============================================================
-- 5. Обновляем RLS на posts:
--   - Посты НЕ от TINDER юзера — видны всем (как было)
--   - Посты от TINDER юзера — видны только тем, кто в whitelist (или самому TINDER)
-- ============================================================
DROP POLICY IF EXISTS "posts_select" ON public.posts;
CREATE POLICY "posts_select" ON public.posts
  FOR SELECT TO authenticated USING (
    author_id IS DISTINCT FROM public.tinder_user_id()
    OR public.has_tinder_access()
  );

-- ============================================================
-- 6. Аналогичная защита для post_media, post_likes, post_comments, post_swipes
-- (через JOIN на posts.author_id)
-- ============================================================
DROP POLICY IF EXISTS "post_media_select" ON public.post_media;
CREATE POLICY "post_media_select" ON public.post_media
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_media.post_id
        AND (p.author_id IS DISTINCT FROM public.tinder_user_id() OR public.has_tinder_access())
    )
  );

DROP POLICY IF EXISTS "post_likes_select" ON public.post_likes;
CREATE POLICY "post_likes_select" ON public.post_likes
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_likes.post_id
        AND (p.author_id IS DISTINCT FROM public.tinder_user_id() OR public.has_tinder_access())
    )
  );

DROP POLICY IF EXISTS "post_comments_select" ON public.post_comments;
CREATE POLICY "post_comments_select" ON public.post_comments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_comments.post_id
        AND (p.author_id IS DISTINCT FROM public.tinder_user_id() OR public.has_tinder_access())
    )
  );

-- ============================================================
-- 7. (view tinder_posts удалён — он создавал SECURITY DEFINER view,
--     что обходит RLS. Клиент работает через posts с фильтром автора.)
-- ============================================================
DROP VIEW IF EXISTS public.tinder_posts;
