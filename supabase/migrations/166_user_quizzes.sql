-- Конструктор тестов (Обучение → Мои тесты)
create table if not exists user_quizzes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references users(id) on delete cascade,
  title text not null,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table user_quizzes enable row level security;
drop policy if exists "quiz owner all" on user_quizzes;
create policy "quiz owner all" on user_quizzes
  for all using (auth.uid() = owner) with check (auth.uid() = owner);
