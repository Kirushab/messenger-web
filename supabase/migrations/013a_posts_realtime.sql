-- ============================================================
-- POSTS REALTIME (v22)
-- Включает Supabase Realtime для лайков и комментов
-- Запусти ПОСЛЕ 013_posts.sql
-- Если 013_posts уже выполнена — запусти только этот файл
-- ============================================================

-- Безопасное добавление в публикацию (если уже добавлено — игнорируем)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'post_comments уже в публикации';
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'post_likes уже в публикации';
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'posts уже в публикации';
  END;
END $$;
