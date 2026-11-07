# Supabase Performance Advisor review · November 7, 2026

## What the advisor reported

| Check | Level | Count | Where |
| --- | --- | --- | --- |
| `multiple_permissive_policies` | WARN | 1 | `public.kw_projects` (`own_rows` + `nbc_company_read` for `authenticated` SELECT) |
| `unindexed_foreign_keys` | INFO | 10 | `kw_nbc_activities`, `kw_profiles`, and legacy tables |
| `no_primary_key` | INFO | 47 | `kw_private.nbc_bp0*_bk_*` snapshot tables |

Only the WARN and the active-table indexes affect the running app. The 47 no-primary-key
entries are copies made before NBC imports, not application tables.

## Fixes in `20261107130000_kw_performance_advisor_fixes.sql`

### 1. One SELECT policy for `kw_projects`

Before, every read evaluated both permissive policies:

- `own_rows` — `auth.uid() = user_id`, for all commands
- `nbc_company_read` — any authenticated user may read `data->>'nbcBp03' = 'true'`

The migration keeps one `SELECT` policy with the same union of access:

```sql
(select auth.uid()) is not null
and ((select auth.uid()) = user_id or data->>'nbcBp03' = 'true')
```

The owner write path is split into explicit `INSERT`, `UPDATE`, and `DELETE` policies.
The resulting access rules are unchanged:

- the owner can read and write their own projects;
- any authenticated user can read the shared NBC projects;
- nobody else can insert, update, or delete another account's project.

The existing `nbc_project_guard` and `nbc_storage_owner_guard` triggers still enforce the
NBC administrative rules.

### 2. Indexes for the sync path

The client downloads an `id, updated_at` manifest for one project and orders it by
`updated_at`. The old `(user_id, project_id)` index cannot serve a project-only filter,
so PostgreSQL scanned the whole BOQ and sorted it on every sync. New indexes:

- `kw_nbc_activities(project_id, updated_at, id)`
- `kw_nbc_submissions(project_id, updated_at, id)`
- `kw_nbc_activities(user_id, parent_id) where parent_id is not null` (WBS tree / FK cascade)
- `kw_projects(user_id) where data->>'nbcBp03' = 'true'` (used by `kw_nbc_owner()`)

Measured on the linked project with `EXPLAIN (ANALYZE, BUFFERS)` as the authenticated owner,
project `nbc-bp02`, first 1,000 manifest rows:

| | Plan | Time | Shared buffers |
| --- | --- | --- | --- |
| Before | Seq Scan → top-N Sort | 78 ms | 2,764 |
| After | Index Scan on `kw_nbc_activities_project_sync_idx` | 16 ms | 273 |

The incremental delta (`updated_at > watermark`) now reads 0 rows in about 1.3 ms instead of
scanning the full project. The absolute numbers include transaction/index-build overhead; the
plan shape is the durable improvement.

### 3. Redundant `kw_profiles` foreign key

`kw_profiles` has `check (id = user_id)`, and `id` already references `auth.users(id) on delete
cascade`. `kw_profiles_user_id_fkey` therefore adds a second, unindexed cascade path for the
same value. It is dropped.

### 4. Legacy-table foreign keys

These tables are kept because `delete_my_cloud_data()` and `export_cloud_data()` still name
them. They are historical (data is from October 16–20), but their FKs are indexed so account
deletion does not scan them:

- `calendar_oauth_requests(user_id)`
- `connected_accounts(user_id)`
- `page_doc_updates(user_id, page_id)`
- `page_versions(user_id, page_id)`
- `push_subscriptions(user_id)`
- `tags(user_id)`
- `kw_oauth_states(user_id)`

The `do` block guards each table with `to_regclass`, so a fresh database built only from
`supabase/migrations` still applies.

## The 47 no-primary-key tables

They are manual snapshots such as:

```text
kw_private.nbc_bp02_bk_activities_20261103_162856
kw_private.nbc_bp02_bk_templates_20261105_152646
kw_private.nbc_bp04_bk_summaries_20261107_032746_cweights
```

They are not referenced by the app or by any database function. There are 47 of them and they
take about 95 MB. Adding primary keys to copies has no app benefit; the sensible options are:

1. **Keep them** and accept the `no_primary_key` INFO entries. They are snapshots.
2. **Archive and drop them** once the imports are verified. List them first:

```sql
select n.nspname, c.relname, pg_size_pretty(pg_total_relation_size(c.oid)) as size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'kw_private'
  and c.relkind = 'r'
  and c.relname like '%\_bk\_%' escape '\'
order by pg_total_relation_size(c.oid) desc;
```

Do not drop `kw_private.nbc_bp02_stage`, `nbc_bp03_stage`, or `nbc_bp04_stage` — those are
staging tables, not dated snapshots, and they already have primary keys.

## Applying and verifying

```sh
supabase db push
supabase db advisors --linked --type performance --level info
```

The migration was validated against the linked project inside a transaction and rolled back,
then applied to the linked project on November 7, 2026. The post-apply isolation test passes,
and the performance advisor no longer reports `multiple_permissive_policies` or
`unindexed_foreign_keys`. The remaining entries are the 47 `no_primary_key` snapshots and
`unused_index` INFOs for the new indexes, which reset their statistics when created and will be
used by normal syncs and account deletion.

## Security Advisor follow-up — November 7, 2026

`20261107140000_security_advisor_fixes.sql` clears the remaining SECURITY DEFINER warnings
without removing the RPCs the app uses:

- The 14 legacy definer RPCs from the old app (`apply_calendar_changes`,
  `compact_page_document`, `connected_account_list`, `delete_my_cloud_data`,
  `export_cloud_data`, `export_owner_data`, `health_check`, `notify_workspace`,
  `pull_changes`, `purge_entities`, `push_changes`, `register_attachment`,
  `server_storage_usage`, `storage_usage`) are no longer executable by `anon` or
  `authenticated`. The current client never calls them; `service_role` keeps access for
  maintenance. Each revoke is guarded with `to_regprocedure`, so a fresh database built only
  from `supabase/migrations` still applies.
- `kw_nbc_owner()` and `kw_nbc_reassign_activities()` stay callable by `authenticated`, but
  their `SECURITY DEFINER` bodies moved to `kw_private`. Public `SECURITY INVOKER` wrappers
  keep the same names, signatures and server-side checks, matching the existing
  `kw_nbc_submission_write()` pattern. RLS policies keep working because PostgreSQL stores
  the function OID, not the schema-qualified name.

Post-apply verification: all 28 SECURITY DEFINER warnings are gone, the isolation test passes
(owner isolation, stale-write rejection, shared-NBC read, cross-user write denial,
service-table denial), and the ACL matrix shows `anon=false`, `authenticated=false`,
`service_role=true` on the legacy functions and `anon=false`, `authenticated=true`,
`definer=false` on the public wrappers.

### Leaked-password protection is plan-gated

The only remaining Security Advisor WARN is `auth_leaked_password_protection`. Enabling it
against HaveIBeenPwned is an Auth setting, not SQL. The Management API
(`PATCH /v1/projects/nlcpjdokfvawlpzyfytx/config/auth` with `password_hibp_enabled=true`)
returns **402 Payment Required**, and the organization entitlement `auth.password_hibp`
reports `hasAccess=false`. The project is on the Free plan. Enable it from Authentication
settings after upgrading the plan; no repo change can bypass the entitlement.

## Not changed here

The 47 snapshot tables and the staging tables are untouched; see the archive/removal options
above. Removing the legacy tables also requires updating `delete_my_cloud_data()` and
`export_cloud_data()`, which still name them.
