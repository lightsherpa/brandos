-- Version-bound read-only guideline capabilities. Default-off BRAND_BOOK_GUIDELINES.
-- Local/dev only until Oscar explicitly approves production rollout.
create table public.brand_book_shares (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id) on delete cascade,
 bio_id uuid not null references public.bios(id) on delete restrict,
 bio_version integer not null check(bio_version>0),
 created_by uuid not null references public.users(id) on delete restrict,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 scope text not null default 'guidelines_read' check(scope='guidelines_read'),
 locale text not null check(locale in ('en','es','ar')),
 items text[] not null check(cardinality(items)>0 and items <@ array['logos','palette','typography','voice','imagery','strategy']::text[]),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=2097152),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 check(expires_at>created_at and expires_at<=created_at+interval '90 days')
);
create index brand_book_shares_brand_created on public.brand_book_shares(brand_id,created_at desc);
alter table public.brand_book_shares enable row level security;
revoke all on public.brand_book_shares from public,anon,authenticated,service_role;
grant select,insert on public.brand_book_shares to service_role;
grant update(revoked_at) on public.brand_book_shares to service_role;
create function public.protect_brand_book_share() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare b public.bios; w uuid;
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at') or old.revoked_at is not null or new.revoked_at is null then raise exception 'BRAND_BOOK_SHARE_IMMUTABLE';end if;
  return new;
 end if;
 select * into b from public.bios where id=new.bio_id;
 if not found or b.brand_id<>new.brand_id or b.version<>new.bio_version or b.certified is distinct from true or (b.client_acceptance_required and b.client_accepted_at is null) or (b.cert_valid_until is not null and b.cert_valid_until<=now()) then raise exception 'BRAND_BOOK_SHARE_CERTIFIED_VERSION_REQUIRED';end if;
 select workspace_id into w from public.brands where id=new.brand_id;
 if not exists(select 1 from public.workspace_memberships where user_id=new.created_by and workspace_id=w and status='active' and is_owner=true) then raise exception 'BRAND_BOOK_SHARE_OWNER_REQUIRED';end if;
 if new.snapshot#>>'{bio,id}' is distinct from new.bio_id::text or new.snapshot#>>'{bio,version}' is distinct from new.bio_version::text then raise exception 'BRAND_BOOK_SHARE_SNAPSHOT_MISMATCH';end if;
 return new;
end $$;
create trigger protect_brand_book_share before insert or update on public.brand_book_shares for each row execute function public.protect_brand_book_share();
revoke all on function public.protect_brand_book_share() from public,anon,authenticated;
