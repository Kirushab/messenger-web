-- ============================================================
-- 089_stories_admin_cleanup.sql  (v58.73)
-- Накатить в Supabase SQL Editor.
--
-- Функции очистки историй для in-app админки. Закреплённые в профиле
-- (pinned_to_profile = true) НЕ удаляются — это архив профиля.
-- Доступ только админу (lirikb2002@gmail.com), как и в чистке медиа.
-- Имена новые (…_v2-style), чтобы не конфликтовать со старыми
-- admin_preview_stories_cleanup/admin_execute_stories_cleanup в БД.
-- ============================================================

create or replace function public.admin_stories_cleanup_preview(cutoff_date timestamptz)
returns table(story_count bigint, pinned_kept bigint)
language plpgsql security definer set search_path to 'public' as $$
declare caller_email text;
begin
  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null or caller_email <> 'lirikb2002@gmail.com' then raise exception 'Forbidden'; end if;
  return query
    select
      count(*) filter (where not coalesce(pinned_to_profile, false))::bigint,
      count(*) filter (where coalesce(pinned_to_profile, false))::bigint
    from public.stories
    where created_at < cutoff_date;
end; $$;

create or replace function public.admin_stories_cleanup_execute(cutoff_date timestamptz)
returns table(deleted bigint, paths text[])
language plpgsql security definer set search_path to 'public' as $$
declare caller_email text; arr text[]; cnt bigint;
begin
  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null or caller_email <> 'lirikb2002@gmail.com' then raise exception 'Forbidden'; end if;

  select array_agg(coalesce(storage_path, media_url)) into arr
    from public.stories
    where created_at < cutoff_date and not coalesce(pinned_to_profile, false);

  with del as (
    delete from public.stories
    where created_at < cutoff_date and not coalesce(pinned_to_profile, false)
    returning 1
  ) select count(*) into cnt from del;

  return query select cnt, coalesce(arr, array[]::text[]);
end; $$;
