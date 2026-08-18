-- 130: Истории, привязанные к событию (event_id IS NOT NULL), НЕ удаляются
-- админ-очисткой — это архив «Моментов события» (как и закреплённые в профиле).
-- Зависит от 128 (колонка stories.event_id). Сигнатуры функций не меняются —
-- меняется только условие, что считать удаляемым.

create or replace function public.admin_stories_cleanup_preview(cutoff_date timestamptz)
returns table(story_count bigint, pinned_kept bigint)
language plpgsql security definer set search_path to 'public' as $$
declare caller_email text;
begin
  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null or caller_email <> 'lirikb2002@gmail.com' then raise exception 'Forbidden'; end if;
  return query
    select
      count(*) filter (where not coalesce(pinned_to_profile, false) and event_id is null)::bigint,
      count(*) filter (where coalesce(pinned_to_profile, false) or event_id is not null)::bigint
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
    where created_at < cutoff_date and not coalesce(pinned_to_profile, false) and event_id is null;

  with del as (
    delete from public.stories
    where created_at < cutoff_date and not coalesce(pinned_to_profile, false) and event_id is null
    returning 1
  ) select count(*) into cnt from del;

  return query select cnt, coalesce(arr, array[]::text[]);
end; $$;

-- DONE
