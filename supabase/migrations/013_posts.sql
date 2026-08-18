-- ============================================================
-- POSTS / FEED (v20 → v21)
-- Открытая лента, посты с медиа, лайки, комменты, свайпы (Tinder)
-- ============================================================

-- 1. Таблица постов
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  caption TEXT NOT NULL DEFAULT '',
  comments_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Медиа поста (карусель — несколько файлов на пост)
CREATE TABLE IF NOT EXISTS public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Лайки
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- 4. Комментарии
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Свайпы (Tinder-режим): чтобы не показывать снова
CREATE TABLE IF NOT EXISTS public.post_swipes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'skip')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- ИНДЕКСЫ
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_feed ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_media_post ON public.post_media(post_id, position);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id, created_at);

-- updated_at триггер
CREATE OR REPLACE FUNCTION public.set_post_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_updated_at ON public.posts;
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_post_updated_at();

-- ============================================================
-- RLS политики
-- ============================================================

ALTER TABLE public.posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_swipes    ENABLE ROW LEVEL SECURITY;

-- POSTS: читать всем authenticated, писать только свои
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

-- POST_MEDIA: читать всем, писать/удалять только автор поста
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

-- POST_LIKES: читать всем (для счётчика), писать/удалять только свои
DROP POLICY IF EXISTS "post_likes_select" ON public.post_likes;
CREATE POLICY "post_likes_select" ON public.post_likes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "post_likes_insert" ON public.post_likes;
CREATE POLICY "post_likes_insert" ON public.post_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_likes_delete" ON public.post_likes;
CREATE POLICY "post_likes_delete" ON public.post_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- POST_COMMENTS: читать всем, писать любой, редактировать/удалять только автор
DROP POLICY IF EXISTS "post_comments_select" ON public.post_comments;
CREATE POLICY "post_comments_select" ON public.post_comments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "post_comments_insert" ON public.post_comments;
CREATE POLICY "post_comments_insert" ON public.post_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "post_comments_update" ON public.post_comments;
CREATE POLICY "post_comments_update" ON public.post_comments
  FOR UPDATE TO authenticated USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "post_comments_delete" ON public.post_comments;
CREATE POLICY "post_comments_delete" ON public.post_comments
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- POST_SWIPES: только свои (это персональная история свайпов)
DROP POLICY IF EXISTS "post_swipes_select" ON public.post_swipes;
CREATE POLICY "post_swipes_select" ON public.post_swipes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_swipes_insert" ON public.post_swipes;
CREATE POLICY "post_swipes_insert" ON public.post_swipes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_swipes_delete" ON public.post_swipes;
CREATE POLICY "post_swipes_delete" ON public.post_swipes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET для медиа постов
-- ============================================================

-- Создание бакета (или обновить если есть)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage политики
DROP POLICY IF EXISTS "post_media_upload" ON storage.objects;
CREATE POLICY "post_media_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "post_media_read" ON storage.objects;
CREATE POLICY "post_media_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'post-media');

DROP POLICY IF EXISTS "post_media_delete_own" ON storage.objects;
CREATE POLICY "post_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- ГОТОВО.
-- После применения этой миграции в Supabase Dashboard → SQL Editor:
-- - Бакет 'post-media' создан и публичный
-- - 5 таблиц + RLS готовы
-- - Юзеры могут заливать медиа в свою папку <user_id>/...
-- - Все могут читать любые посты (открытая лента)
-- - Лайки/комменты/свайпы работают только за себя
-- ============================================================
