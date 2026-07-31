-- Private, date-based personal todos. These are intentionally independent from
-- DSA daily_tasks and never participate in practice planning or analytics.

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null check (char_length(btrim(title)) between 1 and 160),
  notes text,
  todo_date date not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint todos_completion_consistent check (
    (is_completed and completed_at is not null)
    or (not is_completed and completed_at is null)
  )
);

create index if not exists todos_user_date_created
  on public.todos(user_id, todo_date, is_completed, created_at);

drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at before update on public.todos
  for each row execute function public.set_updated_at();

alter table public.todos enable row level security;

drop policy if exists "todos_select_own" on public.todos;
create policy "todos_select_own" on public.todos for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "todos_insert_own" on public.todos;
create policy "todos_insert_own" on public.todos for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "todos_update_own" on public.todos;
create policy "todos_update_own" on public.todos for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "todos_delete_own" on public.todos;
create policy "todos_delete_own" on public.todos for delete to authenticated
  using (user_id = (select auth.uid()));
