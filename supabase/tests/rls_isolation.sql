-- Manual RLS verification script for a local Supabase instance.
-- Run after 0001_phase_one.sql with two test users available.

begin;

-- Replace these with auth.users IDs from a local test project.
-- set local request.jwt.claim.sub = 'USER_A_UUID';
-- set local role = 'authenticated';
-- insert into public.user_problems (user_id, problem_id)
-- values ('USER_A_UUID', '10000000-0000-4000-8000-000000000001');
-- select count(*) from public.user_problems; -- expected: 1 for user A

-- set local request.jwt.claim.sub = 'USER_B_UUID';
-- select count(*) from public.user_problems; -- expected: 0 for user B
-- update public.user_problems set bookmarked = true where user_id = 'USER_A_UUID'; -- expected: 0 rows

-- Todo ownership checks:
-- set local request.jwt.claim.sub = 'USER_A_UUID';
-- insert into public.todos (user_id, title, todo_date)
-- values ('USER_A_UUID', 'Private task', current_date);
-- select count(*) from public.todos; -- expected: 1 for user A
--
-- set local request.jwt.claim.sub = 'USER_B_UUID';
-- select count(*) from public.todos; -- expected: 0 for user B
-- update public.todos set title = 'Changed' where user_id = 'USER_A_UUID'; -- expected: 0 rows
-- delete from public.todos where user_id = 'USER_A_UUID'; -- expected: 0 rows

rollback;
