-- append_bio_version gains an optional p_expected_version (compare-and-append).
-- Additive: existing callers (5 named args) behave exactly as before because the
-- new parameter defaults to null. Replaced in place (drop 5-arg + create 6-arg in one
-- transaction) so PostgREST never sees two ambiguous overloads.
-- When p_expected_version is set, the append is refused with STALE_BIO_VERSION
-- (errcode 40001) unless the brand's current latest version equals it.
drop function if exists append_bio_version(uuid, jsonb, integer, uuid, text);

create or replace function append_bio_version(
  p_brand_id uuid,
  p_payload jsonb,
  p_score integer,
  p_created_by uuid default null,
  p_discovery_id text default null,
  p_expected_version integer default null
)
returns bios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_version integer;
  v_bio bios%rowtype;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_BIO_PAYLOAD' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('bio:' || p_brand_id::text, 0));
  if not exists (select 1 from brands where id = p_brand_id) then
    raise exception 'BRAND_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_discovery_id is not null then
    select * into v_bio from bios where discovery_id = p_discovery_id;
    if found then
      if v_bio.brand_id <> p_brand_id then
        raise exception 'DISCOVERY_BRAND_MISMATCH' using errcode = '22023';
      end if;
      return v_bio;
    end if;
  end if;
  select coalesce(max(version), 0) into v_current_version
  from bios where brand_id = p_brand_id;
  if p_expected_version is not null and v_current_version <> p_expected_version then
    raise exception 'STALE_BIO_VERSION: expected v%, latest is v%', p_expected_version, v_current_version
      using errcode = '40001';
  end if;
  insert into bios (brand_id, version, payload, score, certified, created_by, discovery_id)
  values (p_brand_id, v_current_version + 1, p_payload, p_score, false, p_created_by, p_discovery_id)
  returning * into v_bio;
  return v_bio;
end;
$$;

revoke all on function append_bio_version(uuid, jsonb, integer, uuid, text, integer) from public, anon, authenticated;
grant execute on function append_bio_version(uuid, jsonb, integer, uuid, text, integer) to service_role;
