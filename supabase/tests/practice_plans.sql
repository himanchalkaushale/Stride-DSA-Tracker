-- Run with `supabase test db` after all migrations.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','plans-a@example.test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','plans-b@example.test','',now(),'{}','{}',now(),now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select lives_ok(
  $$ select public.create_practice_plan('Owner A plan', 'manual', null, 2) $$,
  'an owner can create a validated plan'
);
select is((select count(*)::integer from public.plans), 1, 'the owner sees their plan');
select throws_ok(
  $$ select public.create_practice_plan(' ', 'manual', null, 2) $$,
  'Plan name must be between 1 and 120 characters.',
  'blank plan names are rejected'
);

insert into public.problems(owner_id,title,slug,difficulty,is_curated)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A one','a-one-test','easy',false),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A two','a-two-test','medium',false),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A three','a-three-test','hard',false);

insert into public.daily_tasks(user_id,problem_id,task_date,position,status,source)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id, '2026-08-01', row_number() over () - 1, 'planned', 'manual'
from public.problems where owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  format(
    'select public.adopt_tasks_into_plan(%L, %s, array[%s]::uuid[])',
    'Adopted', 2,
    (select string_agg(quote_literal(id::text), ',') from public.daily_tasks)
  ),
  'legacy tasks can be adopted atomically'
);
select is((select count(*)::integer from public.daily_tasks where plan_id is not null), 3, 'adoption attaches every selected task');

-- A standalone task consumes one slot on 2026-08-05. Capacity two therefore
-- places only one adopted task there and spills the rest in stable order.
update public.daily_tasks set plan_id = null where problem_id = (
  select id from public.problems where title = 'A three'
);
update public.daily_tasks set task_date = '2026-08-05' where plan_id is null;
select is(
  public.redistribute_plan_tasks(
    (select id from public.plans where origin = 'adopted'),
    '2026-08-01', '2026-08-05', 2
  ),
  2,
  'redistribution moves every unfinished plan task'
);
select is(
  (select count(*)::integer from public.daily_tasks where task_date = '2026-08-05'),
  2,
  'redistribution counts standalone workload against capacity'
);

update public.daily_tasks set status = 'completed', completed_at = now()
where id = (
  select id from public.daily_tasks
  where plan_id = (select id from public.plans where origin = 'adopted')
  order by task_date, position limit 1
);
select lives_ok(
  $$ select public.delete_practice_plan((select id from public.plans where origin = 'adopted')) $$,
  'safe deletion succeeds'
);
select is(
  (select count(*)::integer from public.daily_tasks where status = 'completed'),
  1,
  'safe deletion preserves completed history'
);

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*)::integer from public.plans), 0, 'RLS hides another owner plans');
select * from finish();
rollback;
