-- Public reads are required by email clients. Uploads remain service-role only;
-- no browser write policy is added to storage.objects.
insert into storage.buckets (id, name, public)
values ('email-assets', 'email-assets', true)
on conflict (id) do update set name = excluded.name, public = excluded.public;
