-- Separate private generated media from BIO evidence; video needs its own MIME/size policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('creative-outputs','creative-outputs',false,209715200,array['image/png','image/jpeg','image/webp','video/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Signed access and uploads are service-role only. No broad browser object policy is added.
