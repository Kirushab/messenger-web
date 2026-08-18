-- ============================================================
-- 086_fix_posts_rls.sql  (v58.53)
-- Чиним RLS на posts/лента.
--
-- Симптомы:
--   • "new row violates row-level security policy for table posts" при создании поста
--   • лента не отображается (пустая)
--
-- Причина: миграция 046_tinder.sql переопределила posts_select (и select на
-- post_media/post_likes/post_comments) через функции tinder_user_id() /
-- has_tinder_access(). Тиндер-лента полностью удалена в v58.50, поэтому эта
-- зависимость устарела. Возвращаем простые и корректные политики из 013.
--
-- Идемпотентно: DROP IF EXISTS + CREATE. Накатывать в Supabase SQL Editor
-- с правами service_role. После — NOTIFY pgrst, 'reload schema';
-- ============================================================

-- На случай если RLS была выключена вручную — гарантируем что включена.
ALTER TABLE public.posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments  ENABLE ROW LEVEL SECURITY;

-- ---------- POSTS ----------
-- Читать может любой залогиненный; писать/менять/удалять — только автор.
DROP POLICY IF EXISTS "posts_select" ON public.posts;
CREATE POLICY "posts_select" ON public.posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "posts_insert" ON public.posts;
CREATE POLICY "posts_insert" ON public.posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts_update" ON public.posts;
CREATE POLICY "posts_update" ON public.posts
  FOR UPDATE TO authenticated USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts_delete" ON public.posts;
CREATE POLICY "posts_delete" ON public.posts
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- ---------- POST_MEDIA ----------
DROP POLICY IF EXISTS "post_media_select" ON public.post_media;
CREATE POLICY "post_media_select" ON public.post_media
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "post_media_insert" ON public.post_media;
CREATE POLICY "post_media_insert" ON public.post_media
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid())
  );

DROP POLICY IF EXISTS "post_media_delete" ON public.post_media;
CREATE POLICY "post_media_delete" ON public.post_media
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid())
  );

-- ---------- POST_LIKES ----------
DROP POLICY IF EXISTS "post_likes_select" ON public.post_likes;
CREATE POLICY "post_likes_select" ON public.post_likes
  FOR SELECT TO authenticated USING (true);

-- ---------- POST_COMMENTS ----------
DROP POLICY IF EXISTS "post_comments_select" ON public.post_comments;
CREATE POLICY "post_comments_select" ON public.post_comments
  FOR SELECT TO authenticated USING (true);

-- Перезагрузить кэш схемы PostgREST
NOTIFY pgrst, 'reload schema';
