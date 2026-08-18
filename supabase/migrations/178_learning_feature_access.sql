-- Access flags for education features: GMAT and music notes trainer.
-- Default is OFF so features are shown only to users explicitly enabled in the admin console.

alter table public.users
  add column if not exists gmat_access boolean not null default false,
  add column if not exists notes_access boolean not null default false;
