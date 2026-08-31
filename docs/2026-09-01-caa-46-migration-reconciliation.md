# CAA-46 migration reconciliation

Date: 2026-09-01  
Target inspected: `caastor-staging`

## Safety boundary

The staging checks were read-only:

- `supabase migration list --linked`
- `supabase migration fetch --linked` into the Paperclip run scratch directory

No migration push or repair, remote SQL execution, production credential use, or
production mutation was performed.

## Declared versus applied

At the time of the read-only staging check, the repository declared 15
migration files. Staging reported the same 15 applied versions, with no
local-only or remote-only version. An isolated history fetch also confirmed
that the stored migration names line up one-for-one.

| Version | Repository and staging name |
| --- | --- |
| `20260524183348` | `init` |
| `20260524185323` | `grants_and_admin_rls` |
| `20260527000000` | `brandolph_memory` |
| `20260708120000` | `notifications` |
| `20260805000000` | `new_workspace_credit_grant` |
| `20260815000000` | `m1_gate_and_hardening` |
| `20260815005000` | `platform_integrity` |
| `20260815010000` | `m2_certification` |
| `20260815020000` | `m3_discovery` |
| `20260815030000` | `m5_locale` |
| `20260815040000` | `p3_hardening` |
| `20260815050000` | `lang_management` |
| `20260816000000` | `scoped_access_and_opex` |
| `20260816010000` | `atomic_workspace_ownership` |
| `20260817000000` | `invitation_role_policy` |

The RC branch now declares a 16th, append-only migration:
`20260901000000_delegation_token_hash.sql` (CAA-51). It landed after the staging
reconciliation and is therefore **repository-only / not established as applied
on staging**. It does not rename or reorder any of the reconciled 15 versions,
so it does not change the platform-integrity rename decision below. It must be
included in the disposable zero-to-head run and explicitly coordinated with
the CAA-51 application deploy: the old server writes `token`, while the new
server writes `token_hash`, and the migration drops `token`.

## Rename finding

Git records a 100% rename from
`20260815000000_platform_integrity.sql` to
`20260815005000_platform_integrity.sql`. The historical and current files are
byte-for-byte identical, with SHA-256:

`6bc88ca934e3cd63c53c0faf92d2ab27f9b72bc46efa7054b07ac075108e7fab`

The staging history establishes that the platform migration did **not** run
under its former timestamp. The applied `20260815000000` slot is named
`m1_gate_and_hardening`; `platform_integrity` is separately recorded and
applied at `20260815005000`.

## Rollout decision

**Accept the rename/reorder.** Do not add a forward-fix migration or a no-op
guard.

Staging and the repository already agree on the intended order: M1 first,
platform integrity second. Adding another migration would increase rollout
risk without changing the desired database state.

## Clean-database verification

The disposable zero-to-head run of all 16 current migrations is not yet
complete. Docker Desktop was launched in two separate CAA-46 heartbeats, but
`docker info` could not connect to
`/Users/oscarmottaquintana/.docker/run/docker.sock` after bounded readiness
windows. `supabase db dump` independently reported that the Docker daemon was
unavailable. No disposable database started and no repository schema was
mutated.

The 2026-09-01 continuation rechecked the host before attempting any reset:

```text
$ docker info --format '{{.ServerVersion}}'
failed to connect to the docker API at
unix:///Users/oscarmottaquintana/.docker/run/docker.sock: connect: no such file or directory
```

There is no host `postgres`, `initdb`, `createdb`, `psql`, or `pg_isready`
binary available as a credible Docker-free fallback. Consequently, a local
`supabase db reset` cannot run on this host until Docker's engine is available.
No remote database was used as a disposable substitute.

Unblock owner: Brandolph/operator with access to this Mac.

Required action: open Docker Desktop and wait until it visibly reports
**Engine running**, then re-run CAA-46. Hopper should run the current 16-file
migration chain from zero against the disposable local database and append the
passing command/output here. No staging or production action is required for
this verification.

The eventual live rollout of `20260901000000_delegation_token_hash.sql` is a
separate production-affecting action and was **not performed here**. It must
follow the lockstep sequence in
`docs/2026-09-01-caa-51-delegation-token-hardening.md` with CEO/operator
approval; do not independently push this migration.
