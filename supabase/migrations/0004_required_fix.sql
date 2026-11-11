-- Adds a "required correction / acceptance criteria" list to bugs.
-- Safe to run more than once. The app keeps working without it (it just can't store this list yet).
alter table public.bugs
  add column if not exists required_fix text[] not null default '{}';
