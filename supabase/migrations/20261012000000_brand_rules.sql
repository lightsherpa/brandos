-- Beat 5: "Save as rule". Corrections from a flagged output become Brand Core
-- rules the next run loads (writer prompt + banned-word check). Append-only;
-- each row is its own audit entry (who, when, from which output). No Brand
-- Core version bump.
create table if not exists public.brand_rules (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null check (kind in ('banned_word', 'guideline')),
  value text not null check (char_length(value) between 1 and 200),
  reason text check (reason is null or char_length(reason) <= 500),
  source_task_id text,
  source_item_index integer,
  source_check_id text,
  created_by uuid,
  created_at timestamptz not null default now(),
  active boolean not null default true
);
create index if not exists brand_rules_brand_idx on public.brand_rules (brand_id, active, created_at desc);
alter table public.brand_rules enable row level security;
-- Server-only access (service role). No client policies on purpose.
