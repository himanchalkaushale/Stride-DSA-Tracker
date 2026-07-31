-- Defense-in-depth constraints, parent-aware RLS, and least-privilege RPC access.

alter table public.profiles
  add constraint profiles_display_name_length check (char_length(display_name) <= 60) not valid,
  add constraint profiles_timezone_length check (char_length(timezone) between 1 and 80) not valid,
  add constraint profiles_avatar_url_safe check (
    avatar_url is null or (
      char_length(avatar_url) <= 2048
      and avatar_url ~* '^https?://[^[:space:]]+$'
      and avatar_url !~ '[[:cntrl:]]'
      and avatar_url !~* '^https?://[^/]*@'
      and position(chr(92) in avatar_url) = 0
    )
  ) not valid,
  add constraint profiles_languages_size check (
    cardinality(preferred_languages) between 1 and 50
    and octet_length(array_to_string(preferred_languages, '')) <= 4000
  ) not valid,
  add constraint profiles_topics_size check (
    cardinality(active_topics) <= 50
    and octet_length(array_to_string(active_topics, '')) <= 4000
  ) not valid;

alter table public.problems
  add constraint problems_title_trimmed_length check (char_length(btrim(title)) between 2 and 160) not valid,
  add constraint problems_slug_length check (char_length(slug) between 1 and 220) not valid,
  add constraint problems_description_length check (description is null or char_length(description) <= 10000) not valid,
  add constraint problems_topics_size check (
    cardinality(topics) <= 50 and octet_length(array_to_string(topics, '')) <= 4000
  ) not valid,
  add constraint problems_patterns_size check (
    cardinality(patterns) <= 50 and octet_length(array_to_string(patterns, '')) <= 4000
  ) not valid,
  add constraint problems_source_length check (char_length(btrim(source)) between 1 and 120) not valid,
  add constraint problems_external_url_safe check (
    external_url is null or (
      char_length(external_url) <= 2048
      and external_url ~* '^https?://[^[:space:]]+$'
      and external_url !~ '[[:cntrl:]]'
      and external_url !~* '^https?://[^/]*@'
      and position(chr(92) in external_url) = 0
    )
  ) not valid;

alter table public.attempts
  add constraint attempts_language_length check (char_length(btrim(language)) between 1 and 50) not valid,
  add constraint attempts_notes_length check (notes is null or char_length(notes) <= 10000) not valid;

alter table public.solution_revisions
  add constraint revisions_language_length check (char_length(btrim(language)) between 1 and 50) not valid,
  add constraint revisions_code_length check (char_length(code) <= 200000) not valid,
  add constraint revisions_approach_length check (char_length(approach_notes) <= 20000) not valid,
  add constraint revisions_notes_length check (char_length(general_notes) <= 20000) not valid,
  add constraint revisions_time_complexity_length check (time_complexity is null or char_length(time_complexity) <= 100) not valid,
  add constraint revisions_space_complexity_length check (space_complexity is null or char_length(space_complexity) <= 100) not valid;

alter table public.plans
  add constraint plans_source_filename_length check (source_filename is null or char_length(source_filename) <= 255) not valid;

alter table public.todos
  add constraint todos_notes_length check (notes is null or char_length(notes) <= 10000) not valid;

-- A child row is valid only when its owner can also access the referenced problem.
-- This prevents an authenticated client from attaching private problem UUIDs owned
-- by another user to otherwise-owned progress, tasks, attempts, or revisions.
drop policy if exists "user_problems_all_own" on public.user_problems;
create policy "user_problems_all_own" on public.user_problems for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.problems p
      where p.id = problem_id and (p.is_curated or p.owner_id = (select auth.uid()))
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.problems p
      where p.id = problem_id and (p.is_curated or p.owner_id = (select auth.uid()))
    )
  );

drop policy if exists "daily_tasks_all_own" on public.daily_tasks;
create policy "daily_tasks_all_own" on public.daily_tasks for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.problems p
      where p.id = problem_id and (p.is_curated or p.owner_id = (select auth.uid()))
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.problems p
      where p.id = problem_id and (p.is_curated or p.owner_id = (select auth.uid()))
    )
  );

drop policy if exists "attempts_all_own" on public.attempts;
create policy "attempts_all_own" on public.attempts for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.problems p
      where p.id = problem_id and (p.is_curated or p.owner_id = (select auth.uid()))
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.problems p
      where p.id = problem_id and (p.is_curated or p.owner_id = (select auth.uid()))
    )
  );

drop policy if exists "revisions_all_own" on public.solution_revisions;
create policy "revisions_all_own" on public.solution_revisions for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.problems p
      where p.id = problem_id and (p.is_curated or p.owner_id = (select auth.uid()))
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.problems p
      where p.id = problem_id and (p.is_curated or p.owner_id = (select auth.uid()))
    )
  );

-- Bound the atomic import before expanding attacker-controlled JSON.
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
  if jsonb_array_length(p_entries) > 5000 then
    raise exception 'The import cannot contain more than 5000 questions.';
  end if;
  if p_source_filename is not null and char_length(p_source_filename) > 255 then
    raise exception 'The source filename cannot exceed 255 characters.';
  end if;
  if p_daily_capacity not between 1 and 20 then
    raise exception 'Daily capacity must be between 1 and 20.';
  end if;

  insert into public.plans(owner_id, name, origin, source_filename, daily_capacity)
  values (auth.uid(), public.assert_plan_name(p_name), 'csv', nullif(btrim(p_source_filename), ''), p_daily_capacity)
  returning id into plan_uuid;

  for item in select value from jsonb_array_elements(p_entries)
  loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'question') <> 'object' then
      raise exception 'Each import entry must contain a question object.';
    end if;
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

-- PostgreSQL grants function execution to PUBLIC by default. Expose these RPCs
-- only to signed-in users; table RLS remains the authorization backstop.
revoke execute on function public.assert_plan_name(text) from public, anon;
revoke execute on function public.create_practice_plan(text, public.plan_origin, text, integer) from public, anon;
revoke execute on function public.import_practice_plan(text, text, integer, jsonb) from public, anon;
revoke execute on function public.adopt_tasks_into_plan(text, integer, uuid[]) from public, anon;
revoke execute on function public.shift_plan_tasks(uuid, date, integer) from public, anon;
revoke execute on function public.redistribute_plan_tasks(uuid, date, date, integer) from public, anon;
revoke execute on function public.remove_plan_task(uuid) from public, anon;
revoke execute on function public.delete_practice_plan(uuid) from public, anon;

grant execute on function public.create_practice_plan(text, public.plan_origin, text, integer) to authenticated;
grant execute on function public.import_practice_plan(text, text, integer, jsonb) to authenticated;
grant execute on function public.adopt_tasks_into_plan(text, integer, uuid[]) to authenticated;
grant execute on function public.shift_plan_tasks(uuid, date, integer) to authenticated;
grant execute on function public.redistribute_plan_tasks(uuid, date, date, integer) to authenticated;
grant execute on function public.remove_plan_task(uuid) to authenticated;
grant execute on function public.delete_practice_plan(uuid) to authenticated;
