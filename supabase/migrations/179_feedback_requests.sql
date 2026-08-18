-- v430: in-app product feedback / idea / bug requests.
-- Users can submit and read their own requests. Console admins can read/update all.

create table if not exists public.feedback_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('widget','feature','bug')),
  title text not null check (char_length(title) between 3 and 90),
  body text not null check (char_length(body) between 8 and 1800),
  repro_steps text,
  status text not null default 'new' check (status in ('new','planned','in_progress','done','declined')),
  app_version text,
  source_path text,
  page_url text,
  user_agent text,
  viewport text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_requests_user_created_idx
  on public.feedback_requests(user_id, created_at desc);

create index if not exists feedback_requests_status_created_idx
  on public.feedback_requests(status, created_at desc);

alter table public.feedback_requests enable row level security;

drop policy if exists feedback_requests_insert_own on public.feedback_requests;
create policy feedback_requests_insert_own
  on public.feedback_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists feedback_requests_select_own_or_console on public.feedback_requests;
create policy feedback_requests_select_own_or_console
  on public.feedback_requests
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_console_admin());

drop policy if exists feedback_requests_update_console on public.feedback_requests;
create policy feedback_requests_update_console
  on public.feedback_requests
  for update
  to authenticated
  using (public.is_console_admin())
  with check (public.is_console_admin());

-- updated_at without introducing another dependency/function.
create or replace function public.feedback_requests_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_requests_set_updated_at on public.feedback_requests;
create trigger feedback_requests_set_updated_at
before update on public.feedback_requests
for each row execute function public.feedback_requests_touch_updated_at();
