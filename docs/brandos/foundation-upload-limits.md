# Foundation upload limits (hosted)

These caps run on the CaastorOS API (Render) and in the Brand Core inputs client. They are application limits, not assumptions about a local Mac.

| Asset | Max per file | Enforced by |
| --- | --- | --- |
| Reference image | 5 MB | Client `fileIssue` and server `validateUpload` when the upload is reference intake (or carries a reference tag / append flag). Up to 10 images per batch; each file is its own request. |
| Logo (PNG) | 15 MB | Same path, without the reference flag |
| Commercial font | 15 MB | Same path, without the reference flag |
| HTTP body for `POST /api/bios/:brandId/sources/upload` | 16 MB | Perimeter class `upload` (one 15 MB logo or font plus multipart framing). Evidence and avatar use this class too. |

A file inside its cap must clear the body class. The previous 413s happened because `sources/upload` was classified as `api` (1 MB). Logos, fonts, and references all use this one route; there is no separate font or logo upload path.

## Supabase Storage

Production bucket `bio-sources` has `file_size_limit = 26214400` (25 MB) in `supabase/migrations/20260815005000_platform_integrity.sql`. Local config matches that (`supabase/config.toml`, bucket 25MiB; global storage cap 50MiB). Both sit above the 15 MB application cap, so a valid logo or font is not rejected by Storage for size.

Do not lower the bucket limit below 15 MB. The 5 MB reference cap does not need a bucket change: the API rejects those files before they are stored. No production bucket write is part of this change.
