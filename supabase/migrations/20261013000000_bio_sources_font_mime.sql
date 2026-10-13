-- Allow licensed font uploads (Brand Core foundation: display/body fonts) in
-- the bio-sources bucket. Keeps every existing type; SVG stays disallowed.
-- Applied to production 2026-10-13 (Europe/Madrid) on Oscar's approval.
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct m order by m)
  from unnest(coalesce(allowed_mime_types, '{}') || array['font/ttf','font/otf','font/woff','font/woff2','application/font-woff']) m
)
where id = 'bio-sources' and allowed_mime_types is not null;
