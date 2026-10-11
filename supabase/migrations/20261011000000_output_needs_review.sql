-- Voice QA that cannot parse a verdict must not approve the output.
-- needs_review is distinct from flagged: the copy was not judged, so it
-- cannot ship as approved.
alter table public.outputs drop constraint if exists outputs_status_check;
alter table public.outputs add constraint outputs_status_check
  check (status in ('pending', 'approved', 'flagged', 'rejected', 'needs_review'));
