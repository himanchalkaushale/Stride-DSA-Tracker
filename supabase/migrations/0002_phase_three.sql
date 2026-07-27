-- Stride DSA Tracker — Phase 3
-- Apply after 0001_phase_one.sql.

alter table public.profiles
  add column if not exists planner_last_generated_date date;

comment on column public.profiles.planner_last_generated_date is
  'The user-local calendar date most recently initialized by the adaptive planner.';
