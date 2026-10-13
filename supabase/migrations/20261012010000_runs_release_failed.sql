-- Task settlement: a run whose credit release failed is marked
-- 'release_failed' for reconciliation (never silently left 'running').
alter table public.runs drop constraint if exists runs_status_check;
alter table public.runs add constraint runs_status_check
  check (status = any (array['queued', 'running', 'completed', 'failed', 'release_failed']));
