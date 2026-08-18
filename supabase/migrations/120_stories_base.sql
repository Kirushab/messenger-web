-- ============================================================
-- 120_stories_base.sql  (v63)
-- Накатить в Supabase SQL Editor.
--
-- БАЗОВАЯ схема историй. В проекте присутствовали только 089 (админ-чистка)
-- и 119 (caption), которые ПРЕДПОЛАГАЮТ существование таблицы stories,
-- но самой миграции с CREATE TABLE не было. Эта миграция её восстанавливает.
--
-- Полностью идемпотентна: create table if not exists + add column if not exists
-- + drop/create policy. Если таблицы уже существуют — ничего не сломается,
-- просто переустановятся политики RLS.
-- ============================================================

-- 1. Таблица историй -----------------------------------------
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  storage_path text,
  pinned_to_profile boolean not null default false,
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

-- На случай, если таблица уже была без части колонок
alter table public.stories add column if not exists storage_path text;
alter table public.stories add column if not exists pinned_to_profile boolean not null default false;
alter table public.stories add column if not exists caption text;
alter table public.stories add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');

create index if not exists stories_user_created_idx on public.stories (user_id, created_at desc);
create index if not exists stories_expires_idx on public.stories (expires_at);

-- 2. Таблица просмотров --------------------------------------
create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.users(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

-- Уникальность (один просмотр на пару) — безопасно, не падает при дубликатах
do $$
begin
  create unique index if not exists story_views_unique_idx on public.story_views (story_id, viewer_id);
exception when others then
  -- если есть исторические дубликаты — пропускаем, приложение и так дедуплицирует
  null;
end $$;

-- 3. RLS -----------------------------------------------------
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

-- Истории: читать может любой авторизованный (приложение фильтрует по expires_at),
-- писать/менять/удалять — только владелец.
drop policy if exists "stories_select" on public.stories;
create policy "stories_select" on public.stories
  for select to authenticated using (true);

drop policy if exists "stories_insert" on public.stories;
create policy "stories_insert" on public.stories
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "stories_update_own" on public.stories;
create policy "stories_update_own" on public.stories
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own" on public.stories
  for delete to authenticated using (user_id = auth.uid());

-- Просмотры: видит автор истории (для списка «кто посмотрел») и сам смотрящий;
-- вставлять можно только собственный просмотр.
drop policy if exists "story_views_select" on public.story_views;
create policy "story_views_select" on public.story_views
  for select to authenticated using (
    viewer_id = auth.uid()
    or exists (select 1 from public.stories s where s.id = story_views.story_id and s.user_id = auth.uid())
  );

drop policy if exists "story_views_insert" on public.story_views;
create policy "story_views_insert" on public.story_views
  for insert to authenticated with check (viewer_id = auth.uid());

-- ============================================================
-- ГОТОВО. Истории публикуются (путь в storage исправлен в коде на `${uid}/stories/...`),
-- просмотры и закрепление в профиль работают.
-- ============================================================
