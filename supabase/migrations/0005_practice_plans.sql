-- First-class practice plans, atomic CSV imports, and missed-day recovery.

do $$ begin
  create type public.plan_origin as enum ('csv', 'manual', 'adopted');
exception when duplicate_object then null; end $$;


create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  origin public.plan_origin not null default 'manual',
  source_filename text,
  daily_capacity smallint not null default 2 check (daily_capacity between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_tasks
  add column if not exists plan_id uuid references public.plans(id) on delete set null;

create index if not exists plans_owner_updated on public.plans(owner_id, updated_at desc);
create index if not exists daily_tasks_plan_date on public.daily_tasks(plan_id, task_date, position);

create or replace function public.validate_daily_task_plan_owner()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.plan_id is not null and not exists (
    select 1 from public.plans where id = new.plan_id and owner_id = new.user_id
  ) then
    raise exception 'The selected plan does not belong to this task owner.';
  end if;
  return new;
end;
$$;
drop trigger if exists daily_tasks_validate_plan_owner on public.daily_tasks;
create trigger daily_tasks_validate_plan_owner before insert or update of plan_id, user_id
  on public.daily_tasks for each row execute function public.validate_daily_task_plan_owner();

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
create policy "plans_all_own" on public.plans for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create or replace function public.assert_plan_name(value text)
returns text language plpgsql immutable set search_path = '' as $$
declare cleaned text := btrim(value);
begin
  if cleaned is null or char_length(cleaned) not between 1 and 120 then
    raise exception 'Plan name must be between 1 and 120 characters.';
  end if;
  return cleaned;
end;
$$;

create or replace function public.create_practice_plan(
  p_name text,
  p_origin public.plan_origin default 'manual',
  p_source_filename text default null,
  p_daily_capacity integer default 2
) returns public.plans
language plpgsql security invoker set search_path = ''
as $$
declare result public.plans;
begin
  if p_daily_capacity not between 1 and 20 then
    raise exception 'Daily capacity must be between 1 and 20.';
  end if;
  insert into public.plans(owner_id, name, origin, source_filename, daily_capacity)
  values (auth.uid(), public.assert_plan_name(p_name), p_origin, nullif(btrim(p_source_filename), ''), p_daily_capacity)
  returning * into result;
  return result;
end;
$$;

-- Each JSON entry contains task_date and a question object using database column names.
-- The whole function is one transaction: any bad question/task rolls everything back.
create or replace function public.import_practice_plan(
  p_name text,
  p_source_filename text,
  p_daily_capacity integer,
  p_entries jsonb
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  plan_uuid uuid;
  item jsonb;
  question jsonb;
  problem_uuid uuid;
  task_day date;
  task_position integer;
  base_slug text;
begin
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'The import must contain at least one question.';
  end if;
  if p_daily_capacity not between 1 and 20 then
    raise exception 'Daily capacity must be between 1 and 20.';
  end if;

  insert into public.plans(owner_id, name, origin, source_filename, daily_capacity)
  values (auth.uid(), public.assert_plan_name(p_name), 'csv', nullif(btrim(p_source_filename), ''), p_daily_capacity)
  returning id into plan_uuid;

  for item in select value from jsonb_array_elements(p_entries)
  loop
    question := item -> 'question';
    task_day := (item ->> 'task_date')::date;
    task_position := coalesce((item ->> 'position')::integer, 0);
    if task_position < 0 then raise exception 'Task position cannot be negative.'; end if;
    base_slug := coalesce(nullif(regexp_replace(lower(btrim(question ->> 'title')), '[^a-z0-9]+', '-', 'g'), ''), 'problem');

    insert into public.problems(
      owner_id, title, slug, description, difficulty, topics, patterns,
      source, external_url, estimated_minutes, is_curated
    ) values (
      auth.uid(), btrim(question ->> 'title'),
      trim(both '-' from base_slug) || '-' || substr(gen_random_uuid()::text, 1, 8),
      nullif(question ->> 'description', ''),
      coalesce((question ->> 'difficulty')::public.difficulty_level, 'medium'),
      coalesce(array(select jsonb_array_elements_text(question -> 'topics')), '{}'),
      coalesce(array(select jsonb_array_elements_text(question -> 'patterns')), '{}'),
      coalesce(nullif(btrim(question ->> 'source'), ''), 'CSV import'),
      nullif(question ->> 'external_url', ''),
      coalesce((question ->> 'estimated_minutes')::integer, 30),
      false
    ) returning id into problem_uuid;

    insert into public.daily_tasks(user_id, problem_id, plan_id, task_date, position, status, source)
    values (auth.uid(), problem_uuid, plan_uuid, task_day, task_position, 'planned', 'manual');
  end loop;
  return plan_uuid;
end;
$$;

create or replace function public.adopt_tasks_into_plan(
  p_name text,
  p_daily_capacity integer,
  p_task_ids uuid[]
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare plan_uuid uuid; found_count integer;
begin
  if coalesce(array_length(p_task_ids, 1), 0) = 0 then
    raise exception 'Select at least one scheduled task.';
  end if;
  if p_daily_capacity not between 1 and 20 then
    raise exception 'Daily capacity must be between 1 and 20.';
  end if;
  select count(*) into found_count from public.daily_tasks
    where id = any(p_task_ids) and user_id = auth.uid() and plan_id is null;
  if found_count <> array_length(p_task_ids, 1) then
    raise exception 'One or more tasks are unavailable or already belong to a plan.';
  end if;
  insert into public.plans(owner_id, name, origin, daily_capacity)
    values (auth.uid(), public.assert_plan_name(p_name), 'adopted', p_daily_capacity)
    returning id into plan_uuid;
  update public.daily_tasks set plan_id = plan_uuid where id = any(p_task_ids);
  return plan_uuid;
end;
$$;

create or replace function public.shift_plan_tasks(
  p_plan_id uuid,
  p_from_date date,
  p_days integer
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare affected integer; conflict_text text;
begin
  if p_days not between 1 and 365 then raise exception 'Shift must be between 1 and 365 days.'; end if;
  if not exists(select 1 from public.plans where id = p_plan_id and owner_id = auth.uid()) then
    raise exception 'Plan not found.';
  end if;

  select string_agg(p.title || ' on ' || (moving.task_date + p_days)::text, ', ')
  into conflict_text
  from public.daily_tasks moving
  join public.problems p on p.id = moving.problem_id
  join public.daily_tasks existing on existing.user_id = moving.user_id
    and existing.problem_id = moving.problem_id
    and existing.task_date = moving.task_date + p_days
    and (existing.plan_id is distinct from p_plan_id or existing.task_date < p_from_date
      or existing.status not in ('planned','in_progress','review_due'))
  where moving.plan_id = p_plan_id and moving.user_id = auth.uid()
    and moving.task_date >= p_from_date
    and moving.status in ('planned','in_progress','review_due');
  if conflict_text is not null then
    raise exception 'Cannot shift because these questions are already scheduled: %', conflict_text;
  end if;

  create temporary table shift_moves(task_id uuid primary key, new_date date) on commit drop;
  insert into shift_moves
    select id, task_date + p_days from public.daily_tasks
    where plan_id = p_plan_id and user_id = auth.uid() and task_date >= p_from_date
      and status in ('planned','in_progress','review_due');
  get diagnostics affected = row_count;
  -- Vacate original dates first so overlapping forward moves cannot trip the unique index.
  update public.daily_tasks d set task_date = d.task_date + 365000
    from shift_moves m where d.id = m.task_id;
  update public.daily_tasks d set task_date = m.new_date
    from shift_moves m where d.id = m.task_id;
  return affected;
end;
$$;

create or replace function public.redistribute_plan_tasks(
  p_plan_id uuid,
  p_from_date date,
  p_start_date date,
  p_capacity integer
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  moving record;
  cursor_day date := p_start_date;
  day_load integer;
  day_position integer;
  conflict_exists boolean;
  affected integer := 0;
begin
  if p_capacity not between 1 and 20 then raise exception 'Daily capacity must be between 1 and 20.'; end if;
  if not exists(select 1 from public.plans where id = p_plan_id and owner_id = auth.uid()) then
    raise exception 'Plan not found.';
  end if;

  create temporary table plan_moves(task_id uuid primary key, new_date date, new_position integer) on commit drop;
  for moving in
    select id, problem_id from public.daily_tasks
    where plan_id = p_plan_id and user_id = auth.uid() and task_date >= p_from_date
      and status in ('planned','in_progress','review_due')
    order by task_date, position, created_at, id
  loop
    loop
      select count(*) into day_load from public.daily_tasks d
        where d.user_id = auth.uid() and d.task_date = cursor_day
          and d.status in ('planned','in_progress','review_due')
          and (d.plan_id is distinct from p_plan_id or d.task_date < p_from_date
            or d.status not in ('planned','in_progress','review_due'));
      day_load := day_load + (select count(*) from plan_moves where new_date = cursor_day);
      if day_load >= p_capacity then cursor_day := cursor_day + 1; continue; end if;

      select exists(
        select 1 from public.daily_tasks d
        where d.user_id = auth.uid() and d.problem_id = moving.problem_id and d.task_date = cursor_day
          and (d.plan_id is distinct from p_plan_id or d.task_date < p_from_date
            or d.status not in ('planned','in_progress','review_due'))
        union all
        select 1 from plan_moves pm join public.daily_tasks d on d.id = pm.task_id
          where d.problem_id = moving.problem_id and pm.new_date = cursor_day
      ) into conflict_exists;
      if conflict_exists then
        raise exception 'Cannot redistribute because a question would be scheduled twice on %.', cursor_day;
      end if;

      select coalesce(max(position), -1) + 1 into day_position
      from public.daily_tasks where user_id = auth.uid() and task_date = cursor_day
        and (plan_id is distinct from p_plan_id or task_date < p_from_date
          or status not in ('planned','in_progress','review_due'));
      day_position := day_position + (select count(*) from plan_moves where new_date = cursor_day);
      insert into plan_moves values (moving.id, cursor_day, day_position);
      affected := affected + 1;
      exit;
    end loop;
  end loop;

  -- Vacate original dates before placing rows; this keeps a move onto another
  -- moving row's old date atomic under the existing immediate unique constraint.
  update public.daily_tasks d set task_date = d.task_date + 365000
    from plan_moves m where d.id = m.task_id;
  update public.daily_tasks d set task_date = m.new_date, position = m.new_position
    from plan_moves m where d.id = m.task_id;
  return affected;
end;
$$;

create or replace function public.remove_plan_task(p_task_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare task_status public.task_status;
begin
  select status into task_status from public.daily_tasks
    where id = p_task_id and user_id = auth.uid() and plan_id is not null;
  if not found then raise exception 'Plan entry not found.'; end if;
  if task_status in ('completed','skipped') then
    update public.daily_tasks set plan_id = null where id = p_task_id;
    return 'detached';
  end if;
  delete from public.daily_tasks where id = p_task_id;
  return 'deleted';
end;
$$;

create or replace function public.delete_practice_plan(p_plan_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.plans where id = p_plan_id and owner_id = auth.uid()) then
    raise exception 'Plan not found.';
  end if;
  delete from public.daily_tasks where plan_id = p_plan_id
    and status in ('planned','in_progress','review_due');
  update public.daily_tasks set plan_id = null where plan_id = p_plan_id;
  delete from public.plans where id = p_plan_id;
end;
$$;

grant execute on function public.create_practice_plan(text, public.plan_origin, text, integer) to authenticated;
grant execute on function public.import_practice_plan(text, text, integer, jsonb) to authenticated;
grant execute on function public.adopt_tasks_into_plan(text, integer, uuid[]) to authenticated;
grant execute on function public.shift_plan_tasks(uuid, date, integer) to authenticated;
grant execute on function public.redistribute_plan_tasks(uuid, date, date, integer) to authenticated;
grant execute on function public.remove_plan_task(uuid) to authenticated;
grant execute on function public.delete_practice_plan(uuid) to authenticated;
