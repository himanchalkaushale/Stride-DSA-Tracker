-- Stride DSA Tracker — Phase 1
-- Run in a new Supabase project with the SQL editor or `supabase db push`.

create extension if not exists pgcrypto;

do $$ begin
  create type public.difficulty_level as enum ('easy', 'medium', 'hard');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.problem_status as enum ('backlog', 'in_progress', 'completed', 'review_due', 'archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.task_status as enum ('planned', 'in_progress', 'completed', 'skipped', 'review_due');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.attempt_result as enum ('solved', 'partial', 'failed', 'reviewed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.task_source as enum ('adaptive', 'manual', 'review');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  timezone text not null default 'UTC',
  daily_target smallint not null default 2 check (daily_target between 1 and 8),
  preferred_languages text[] not null default array['TypeScript'],
  active_topics text[] not null default array['Arrays', 'Strings', 'Hashing'],
  difficulty_min public.difficulty_level not null default 'easy',
  difficulty_max public.difficulty_level not null default 'hard',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.problems (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  slug text not null,
  description text,
  difficulty public.difficulty_level not null,
  topics text[] not null default '{}',
  patterns text[] not null default '{}',
  source text not null default 'custom',
  external_url text,
  estimated_minutes smallint not null default 30 check (estimated_minutes between 1 and 600),
  is_curated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curated_has_no_owner check ((is_curated and owner_id is null) or (not is_curated and owner_id is not null))
);
create unique index if not exists problems_curated_slug_unique on public.problems(slug) where owner_id is null;
create unique index if not exists problems_owner_slug_unique on public.problems(owner_id, slug) where owner_id is not null;
create index if not exists problems_topics_gin on public.problems using gin(topics);
create index if not exists problems_patterns_gin on public.problems using gin(patterns);

create table if not exists public.user_problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  status public.problem_status not null default 'backlog',
  bookmarked boolean not null default false,
  confidence smallint check (confidence between 1 and 5),
  priority smallint not null default 0 check (priority between 0 and 5),
  first_started_at timestamptz,
  completed_at timestamptz,
  next_review_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, problem_id)
);
create index if not exists user_problems_user_status on public.user_problems(user_id, status);
create index if not exists user_problems_review_due on public.user_problems(user_id, next_review_at);

create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  task_date date not null,
  position smallint not null default 0 check (position >= 0),
  status public.task_status not null default 'planned',
  source public.task_source not null default 'adaptive',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, problem_id, task_date)
);
create index if not exists daily_tasks_user_date on public.daily_tasks(user_id, task_date, position);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  result public.attempt_result not null,
  language text not null default 'TypeScript',
  duration_minutes smallint not null default 0 check (duration_minutes between 0 and 1440),
  confidence smallint check (confidence between 1 and 5),
  notes text,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists attempts_user_date on public.attempts(user_id, attempted_at desc);
create index if not exists attempts_user_problem on public.attempts(user_id, problem_id);

create table if not exists public.solution_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  language text not null default 'TypeScript',
  code text not null default '',
  approach_notes text not null default '',
  general_notes text not null default '',
  time_complexity text,
  space_complexity text,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists revisions_user_problem on public.solution_revisions(user_id, problem_id, created_at desc);
create unique index if not exists one_current_revision_per_language
  on public.solution_revisions(user_id, problem_id, language) where is_current;

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists problems_set_updated_at on public.problems;
create trigger problems_set_updated_at before update on public.problems for each row execute function public.set_updated_at();
drop trigger if exists user_problems_set_updated_at on public.user_problems;
create trigger user_problems_set_updated_at before update on public.user_problems for each row execute function public.set_updated_at();
drop trigger if exists daily_tasks_set_updated_at on public.daily_tasks;
create trigger daily_tasks_set_updated_at before update on public.daily_tasks for each row execute function public.set_updated_at();
drop trigger if exists solution_revisions_set_updated_at on public.solution_revisions;
create trigger solution_revisions_set_updated_at before update on public.solution_revisions for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.problems enable row level security;
alter table public.user_problems enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.attempts enable row level security;
alter table public.solution_revisions enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "problems_select_curated_or_own" on public.problems for select to authenticated
  using (is_curated or owner_id = (select auth.uid()));
create policy "problems_insert_own" on public.problems for insert to authenticated
  with check (owner_id = (select auth.uid()) and not is_curated);
create policy "problems_update_own" on public.problems for update to authenticated
  using (owner_id = (select auth.uid()) and not is_curated)
  with check (owner_id = (select auth.uid()) and not is_curated);
create policy "problems_delete_own" on public.problems for delete to authenticated
  using (owner_id = (select auth.uid()) and not is_curated);

create policy "user_problems_all_own" on public.user_problems for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "daily_tasks_all_own" on public.daily_tasks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "attempts_all_own" on public.attempts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "revisions_all_own" on public.solution_revisions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Curated starter roadmap. These are shared catalog rows, never user-owned.
insert into public.problems
  (id, title, slug, difficulty, topics, patterns, source, external_url, estimated_minutes, is_curated)
values
  ('10000000-0000-4000-8000-000000000001','Two Sum','two-sum','easy',array['Arrays','Hashing'],array['Hash Map'],'LeetCode','https://leetcode.com/problems/two-sum/',20,true),
  ('10000000-0000-4000-8000-000000000002','Best Time to Buy and Sell Stock','best-time-stock','easy',array['Arrays'],array['Running Minimum'],'LeetCode','https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',25,true),
  ('10000000-0000-4000-8000-000000000003','Product of Array Except Self','product-except-self','medium',array['Arrays'],array['Prefix & Suffix'],'LeetCode','https://leetcode.com/problems/product-of-array-except-self/',35,true),
  ('10000000-0000-4000-8000-000000000004','Valid Anagram','valid-anagram','easy',array['Strings','Hashing'],array['Frequency Count'],'LeetCode','https://leetcode.com/problems/valid-anagram/',20,true),
  ('10000000-0000-4000-8000-000000000005','Longest Substring Without Repeating Characters','longest-unique-substring','medium',array['Strings','Sliding Window'],array['Sliding Window'],'LeetCode','https://leetcode.com/problems/longest-substring-without-repeating-characters/',35,true),
  ('10000000-0000-4000-8000-000000000006','Valid Palindrome','valid-palindrome','easy',array['Strings','Two Pointers'],array['Two Pointers'],'LeetCode','https://leetcode.com/problems/valid-palindrome/',20,true),
  ('10000000-0000-4000-8000-000000000007','3Sum','three-sum','medium',array['Arrays','Two Pointers'],array['Sort & Sweep'],'LeetCode','https://leetcode.com/problems/3sum/',45,true),
  ('10000000-0000-4000-8000-000000000008','Reverse Linked List','reverse-linked-list','easy',array['Linked Lists'],array['Pointer Reversal'],'LeetCode','https://leetcode.com/problems/reverse-linked-list/',25,true),
  ('10000000-0000-4000-8000-000000000009','Linked List Cycle','linked-list-cycle','easy',array['Linked Lists','Two Pointers'],array['Fast & Slow Pointers'],'LeetCode','https://leetcode.com/problems/linked-list-cycle/',25,true),
  ('10000000-0000-4000-8000-000000000010','Valid Parentheses','valid-parentheses','easy',array['Stacks & Queues'],array['Stack'],'LeetCode','https://leetcode.com/problems/valid-parentheses/',20,true),
  ('10000000-0000-4000-8000-000000000011','Min Stack','min-stack','medium',array['Stacks & Queues'],array['Auxiliary Stack'],'LeetCode','https://leetcode.com/problems/min-stack/',35,true),
  ('10000000-0000-4000-8000-000000000012','Binary Search','binary-search','easy',array['Binary Search'],array['Binary Search'],'LeetCode','https://leetcode.com/problems/binary-search/',20,true),
  ('10000000-0000-4000-8000-000000000013','Search in Rotated Sorted Array','rotated-array-search','medium',array['Binary Search','Arrays'],array['Modified Binary Search'],'LeetCode','https://leetcode.com/problems/search-in-rotated-sorted-array/',40,true),
  ('10000000-0000-4000-8000-000000000014','Maximum Depth of Binary Tree','tree-max-depth','easy',array['Trees'],array['DFS','Recursion'],'LeetCode','https://leetcode.com/problems/maximum-depth-of-binary-tree/',25,true),
  ('10000000-0000-4000-8000-000000000015','Binary Tree Level Order Traversal','tree-level-order','medium',array['Trees','Stacks & Queues'],array['BFS'],'LeetCode','https://leetcode.com/problems/binary-tree-level-order-traversal/',35,true),
  ('10000000-0000-4000-8000-000000000016','Kth Largest Element in an Array','kth-largest','medium',array['Heaps','Arrays'],array['Heap','Quickselect'],'LeetCode','https://leetcode.com/problems/kth-largest-element-in-an-array/',35,true),
  ('10000000-0000-4000-8000-000000000017','Number of Islands','number-of-islands','medium',array['Graphs'],array['DFS','BFS'],'LeetCode','https://leetcode.com/problems/number-of-islands/',40,true),
  ('10000000-0000-4000-8000-000000000018','Course Schedule','course-schedule','medium',array['Graphs'],array['Topological Sort'],'LeetCode','https://leetcode.com/problems/course-schedule/',45,true),
  ('10000000-0000-4000-8000-000000000019','Combination Sum','combination-sum','medium',array['Backtracking'],array['Backtracking'],'LeetCode','https://leetcode.com/problems/combination-sum/',40,true),
  ('10000000-0000-4000-8000-000000000020','House Robber','house-robber','medium',array['Dynamic Programming'],array['1D Dynamic Programming'],'LeetCode','https://leetcode.com/problems/house-robber/',35,true),
  ('10000000-0000-4000-8000-000000000021','Coin Change','coin-change','medium',array['Dynamic Programming'],array['Unbounded Knapsack'],'LeetCode','https://leetcode.com/problems/coin-change/',45,true),
  ('10000000-0000-4000-8000-000000000022','Jump Game','jump-game','medium',array['Greedy','Dynamic Programming'],array['Greedy Reachability'],'LeetCode','https://leetcode.com/problems/jump-game/',35,true),
  ('10000000-0000-4000-8000-000000000023','Merge Intervals','merge-intervals','medium',array['Arrays'],array['Intervals','Sorting'],'LeetCode','https://leetcode.com/problems/merge-intervals/',35,true),
  ('10000000-0000-4000-8000-000000000024','Trapping Rain Water','trapping-rain-water','hard',array['Arrays','Two Pointers'],array['Two Pointers','Prefix Maximum'],'LeetCode','https://leetcode.com/problems/trapping-rain-water/',55,true)
on conflict (id) do update set
  title = excluded.title,
  difficulty = excluded.difficulty,
  topics = excluded.topics,
  patterns = excluded.patterns,
  external_url = excluded.external_url,
  estimated_minutes = excluded.estimated_minutes,
  updated_at = now();
