-- Machine QA is evidence, not an explicit human review decision.
alter table public.outputs drop constraint if exists outputs_status_check;
alter table public.outputs add constraint outputs_status_check
  check (status in ('pending', 'approved', 'flagged', 'rejected', 'needs_review', 'qa_passed'));

-- Preserve independently recorded workflow approval, including an internal
-- approval currently awaiting the client's decision. Returned work is unapproved.
update public.outputs
set status = 'qa_passed'
where kind in ('task', 'task_rerun') and status = 'approved'
  and not (
    (workflow_status in ('internally_approved', 'client_review', 'client_approved')
      and internal_reviewed_by is not null and internal_reviewed_at is not null)
    or (workflow_status = 'client_approved'
      and client_reviewed_by is not null and client_reviewed_at is not null)
  );
