-- Remove the shared starter catalog and keep planning entirely user-controlled.
-- User-created questions have is_curated = false and are not affected.

delete from public.problems
where is_curated = true;

comment on column public.profiles.planner_last_generated_date is
  'Legacy planner field retained for compatibility; daily plans are now created manually.';
