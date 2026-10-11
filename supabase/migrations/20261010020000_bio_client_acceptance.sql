-- Creative Director changes need the user's acceptance before production
-- unlocks (Notion decision 2026-09-09). A version the Creative Director
-- authored is flagged; accepting stamps who/when on that exact version.
alter table public.bios add column if not exists client_acceptance_required boolean not null default false;
alter table public.bios add column if not exists client_accepted_at timestamptz;
alter table public.bios add column if not exists client_accepted_by uuid references public.users(id) on delete set null;
