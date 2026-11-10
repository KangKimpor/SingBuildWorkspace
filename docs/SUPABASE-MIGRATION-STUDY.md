# Moving off Supabase: backend analysis and migration study

Written November 8, 2026. Proposal only: nothing here is a recorded decision, and no code, database or hosted setting was changed. The numbers below come from read-only SQL against project `nlcpjdokfvawlpzyfytx` (no log queries, so no log-query quota was used), from the repository, and from public pricing pages read on the same date.

## 1. Recommendation

Move to **Cloudflare's free tier**: one Worker that serves the built app and a small API, **D1** (SQLite) for data, one **Durable Object** for live updates and for serialising NBC writes, and **Better Auth** for Google sign-in. Cloudflare does not charge for D1 data transfer or static asset requests, so the egress wall disappears instead of just moving. The expensive part is not the data (it is tiny) but rewriting about 35 SQL functions, 24 triggers and 43 policies as TypeScript.

Rejected: Neon (same 5 GB egress cap), Firebase Spark (50k reads/day: three cold loads of the BP02 BOQ use it), Convex (1 GiB/month database bandwidth, less than Supabase's 5 GB). Details in section 4.

**Decision gate before any build work.** The Google Calendar sync that D-20 blames for most egress was removed on November 3. Look at Supabase > Usage > Egress for the days since then. If the projected month is well under 5 GB, a cheaper fix exists (section 6, "Egress by design"), and the migration becomes a choice rather than a necessity. I cannot read that dashboard from here.

## 2. What the backend is today

**Hosting and data.** Vercel serves the Vite/React PWA. Supabase Free hosts Postgres, Auth, Realtime and Storage. The app is cloud-first: every collection is a table of `(user_id, id, data jsonb, updated_at)` rows, and the client keeps a local cache (IndexedDB), a pending-write queue, per-collection watermarks and compare-and-swap tokens.

| Item | Measured value |
| --- | --- |
| Database size | about 155 MB of the 500 MB cap |
| Live application data | about 13 MB of JSON. `kw_nbc_activities` has 17,379 rows (BP02: 16,457, about 10 MB, 658 B average, 1.7 KB maximum; BP03: 524; BP04: 398). Pages 53, tasks 7, projects 7, events 6, submissions 38, summaries 6 |
| Snapshot and legacy tables | about 100 MB, mostly the 47 `nbc_bp0*_bk_*` and `*_stage` tables (up to 14 MB each) plus old-app tables (`pages`, `page_versions`, `sync_changes`, `user_settings`, ...) |
| Report templates | `kw_nbc_templates`, 3 rows, base64 .xlsx (BP02 596 kB, BP03 53 kB, BP04 47 kB) |
| Users | 11, of whom 8 signed in during the last 7 days. Identities: 10 Google, 2 email. That implies exactly one user has only an email identity, and the sign-in screen offers Google only |
| Storage | bucket `kw-files` exists with 0 objects |
| Realtime | 9 tables in `supabase_realtime`, plus a private broadcast topic `kw-workspace:<uid>` for hard deletes |
| Edge Functions | 5 active (`attachments`, `backup`, `delete-account`, `keepalive`, `push-register`); nothing in `src` calls `functions.invoke` |
| Extensions | `pg_cron`, `pg_net`, `supabase_vault`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements` |
| Database logic | 35 functions (schemas `public`, `kw_private`), 24 triggers, 43 policies |

**Client surface that has to change** (`@supabase/supabase-js` 2.118.0):

| File | What it uses |
| --- | --- |
| `src/lib/supabase.ts` | Lazy `createClient` with PKCE and persisted session; `hasStoredSession()` reads the `sb-<ref>-auth-token` key |
| `src/data/sync.ts` (910 lines) | `onAuthStateChange`, `getSession`, `realtime.setAuth`; channel `kw-workspace:<uid>` with `postgres_changes` INSERT/UPDATE on 5 tables plus profiles and a broadcast DELETE; PostgREST reads in pages of 1,000 (manifest `id,updated_at`, then `id,data,updated_at` with `in(id)` batches of 150); CAS deletes; RPCs `kw_workspace_write` and `kw_nbc_reassign_activities` |
| `src/nbc/NbcProject.tsx` | Second channel `nbc:<uid>:<project>` on `kw_nbc_activities/submissions/summaries` |
| `src/nbc/submission-actions.ts` | RPC `kw_nbc_submission_write` (save, confirm, reopen, delete, undo) and draft saves through `kw_workspace_write` |
| `src/nbc/export/template.ts` | Reads `kw_nbc_templates` each time the export dialog loads |
| `src/data/files.ts` | Storage `kw-files` upload and signed URLs (unused today) |
| `src/components/AccountSettings.tsx` | `signInWithOAuth` (Google) and `signOut` |
| Tests that mock the client | `cloud-sync`, `egress-optimization`, `startup-hydration`, `nbc-confirm-conflict`, `template`, `AuthGate` |
| Config | `vercel.json` CSP `connect-src` names the Supabase origin; `.env.example` holds the URL and publishable key |

**Server logic that has to be re-implemented**

| Database object | Job |
| --- | --- |
| `kw_workspace_write` | CAS upsert under an advisory lock; allow-list of collections; rejects stale writes to deleted rows; routes `nbc_submissions` to the NBC writer; `nbc_reports` and `nbc_summaries` are server-managed |
| `kw_private.nbc_submission_write` | About 170 lines: save/confirm/reopen/delete/undo, re-chains `previous` values across this and last week, rebuilds weekly summaries, 10-second undo, Phnom Penh week boundaries, Friday deadline |
| `kw_nbc_reassign_activities` | Up to 5,000 activities per call, per-row expected-version map |
| `nbc_activity_guard` | BOQ structure is immutable; only progress, handler, remark, history and `updatedAt` may change; audit history is validated; direct progress edits are blocked |
| `nbc_project_guard`, `nbc_storage_owner_guard`, `nbc_task_guard`, `workspace_deleted` | One company-owned NBC dataset, task-to-activity links, delete broadcast |
| RLS | `own_rows` on personal tables; every signed-in user can read the shared NBC project, activities, submissions, summaries and templates; NBC writes only through the RPCs |
| Legacy | `kw_nbc_reports` (0 rows, frozen), 14 revoked old RPCs, the old-app tables and Edge Functions |

`src/nbc/submissions.ts` already contains `transitionSubmission`, a TypeScript version of the same chain logic used in guest mode. It is the natural oracle for testing the new server code.

## 3. Where the egress and log-query usage come from

| Driver | Evidence | Status |
| --- | --- | --- |
| Google Calendar polling | D-20: 2,393 provider events (about 2 MB) pulled into every client. `pg_stat_statements` still shows 13,470 calendar upserts and about 12,000 calendar and account reads (stats window unknown) | Removed November 3 |
| Cold load of the BP02 BOQ | 16,457 rows x 658 B = about 10.8 MB of `data`, plus the `id` and `updated_at` envelope: roughly 11-12 MB per device cache loss (new device, cleared site data, missing snapshot). 5 GB / 11.5 MB is about 440 such loads | Still present. Upper bound, because I cannot see whether Supabase meters compressed or raw bytes |
| Full reconcile every 14 days | The manifest query returns `id,updated_at` for every row: roughly 1 MB per device for BP02 (estimate) | Still present, small |
| Report template | About 600 kB (BP02) read each time the export dialog loads; not cached | Still present, small |
| Realtime | `postgres_changes` sends the whole row (`data`, up to 1.7 KB per activity) to every subscribed client | Still present, small |
| Pull loop | `pages`, `tasks`, `events` and `profiles` were each SELECTed 3,757-6,808 times (window unknown), one request per collection per pull | Mostly before Realtime replaced polling |
| Log-query quota | Not app traffic. It is consumed by the Logs Explorer, the CLI and MCP log queries during debugging. D-24 added habits to limit it | Disappears with the platform |

The database size is not an egress driver, but about 100 MB of snapshot tables sit inside the 500 MB cap.

## 4. Options checked against current free tiers

| Option | Limits that matter (read November 2026) | Fixes egress? | Verdict |
| --- | --- | --- | --- |
| Supabase Free (today) | 5 GB uncached plus 5 GB cached egress, 500 MB database, 2M Realtime messages, 200 connections, project pauses after a week of inactivity | n/a | Fallback: Pro is $25/month |
| Neon Free | 5 GB public network transfer, 100 CU-hours, small storage cap, no built-in Realtime | No, same cap | Reject |
| Firebase Spark | Firestore 1 GiB, 50k reads/day, 20k writes/day, 10 GiB/month egress; Cloud Storage needs Blaze since February 2026 | Partly | Reject: one BP02 cold load is 16.5k reads |
| Convex Free | 1 GiB/month database bandwidth, 1M function calls, 0.5 GB storage, not Postgres | No, worse | Reject |
| **Cloudflare Workers + D1 + Durable Objects** | D1: 5M rows read/day, 100k rows written/day, 5 GB account total, 500 MB per database, no egress charge. Workers: 100k requests/day, 10 ms CPU per invocation, static assets free and unlimited. Durable Objects: SQLite-backed only on Free, 100k requests/day, WebSocket messages count 20:1 | Yes | **Recommended** |
| Self-hosted Supabase or PocketBase on a free VM | You own uptime, TLS, backups and upgrades | Yes | Not advised for a tool your colleagues rely on |

## 5. Target architecture

One Worker, one origin:

- **Static assets**: the built `dist/` is served by the same Worker. Same origin means cookie sessions work on Safari and iPhone (a separate `workers.dev` API domain would be cross-site and is likely blocked by tracking prevention), no CORS, and `connect-src 'self'` replaces the Supabase origin in the CSP.
- **API (Hono)** replacing PostgREST and the RPCs:
  - `GET /api/sync` takes the per-collection watermarks and returns every collection's delta in one response (one request instead of up to 14).
  - `PUT /api/rows/:collection/:id` is `kw_workspace_write` (CAS on `updated_at`).
  - `DELETE /api/rows/:collection/:id?expected=` is the CAS delete.
  - `POST /api/nbc/submissions/:operation` is `kw_nbc_submission_write`.
  - `POST /api/nbc/activities/reassign` is `kw_nbc_reassign_activities`.
  - `GET /api/nbc/template/:project` serves the template with a long cache lifetime.
- **Authorisation** replaces RLS: personal tables always filter on the session's user id; NBC reads are open to any signed-in user; NBC writes exist only as the two endpoints above, with the same handler allow-list and week rules.
- **D1** holds the same tables with the same `(user_id, id)` keys and `data` JSON, plus generated columns for `project_id`, `week_start` and so on.
- **`NbcWriter` Durable Object** (one per company dataset). D1 has no interactive transactions (a `batch()` is the transaction), so the read-compute-write sequence is serialised by the Durable Object, which replaces `pg_advisory_xact_lock`, and then committed as one `DB.batch()` with `updated_at = ?` guards on the statements.
- **`Hub` Durable Object** (SQLite-backed, WebSocket Hibernation) for live updates. It replaces `postgres_changes` and the DELETE broadcast and sends `{collection, id, updated_at}` so the client can fetch the delta. Fallback if you want zero Durable Object use: while the tab is visible, poll `/api/sync` every 30-60 seconds.
- **Better Auth** with the D1 adapter and the Google provider only (matches the sign-in screen). Cookie session; the localStorage `sb-...-auth-token` probe in `hasStoredSession()` becomes a small non-secret `kw-session-hint` flag.
- **R2** only if attachments come back (10 GB free); there are 0 files now.

Rough free-tier budget (assumption: 11 users, 500 API calls each per day): about 5,500 Worker requests/day against 100k. A BP02 cold load reads 16.5k D1 rows, so about 300 cold loads per day fit in 5M reads.

## 6. Egress by design (worth doing on either platform)

`nbc_activity_guard` already makes the BOQ structure immutable: only progress, handler, remark, history and `updatedAt` may change. A cold load therefore does not need to re-download the structure.

1. Serve the BOQ structure (name, WBS, area, trade, location, baseline, weights) as one versioned, compressed, authenticated blob. Cache it in IndexedDB keyed by baseline version, so it is fetched once per device per baseline.
2. Sync only the mutable overlay (progress, handler, remark, `updatedAt`) and load per-activity history on demand. Estimated cold load: 1-2 MB instead of about 11 MB. This is an estimate to confirm by measurement.
3. Cache the report template in IndexedDB by its version.
4. Send one delta response instead of one request per collection.

On the current Supabase project, items 1-3 can be done without migrating and may be enough, depending on the usage check in section 1.

## 7. Data and auth mapping

**Schema (Postgres to D1).** Write one consolidated `0001_init.sql` from the final schema instead of replaying 30 Postgres migrations. Only these tables are live: `kw_pages`, `kw_projects`, `kw_tasks`, `kw_events`, `kw_profiles`, `kw_nbc_activities`, `kw_nbc_submissions`, `kw_nbc_summaries`, `kw_nbc_templates` (plus the empty `kw_nbc_reports` archive if you want it kept).

- `jsonb` becomes `TEXT` with `CHECK (json_valid(data))`; `->>` becomes `json_extract`. The generated columns (`project_id`, `parent_id`, `wbs`, `week_start`) are supported as stored generated columns.
- `timestamptz` becomes an ISO-8601 UTC string. `updated_at` is the CAS token that clients compare and cache, so after the cutover every client snapshot must be invalidated (bump the snapshot version) once all pending writes have flushed.
- Composite keys `(user_id, id)`, partial and expression unique indexes (for example one submission per project, week and handler) and deferrable foreign keys exist in SQLite; confirm the foreign-key behaviour on D1 in the spike.
- Limits to design around on Free (from third-party summaries of the D1 limits page; confirm): 2 MB per row, 100 KB per statement, 100 bound parameters, 50 queries per Worker invocation, 1,000 statements per batch.
- Bulk load: 17,379 activity rows. Index writes are believed to count toward the 100k rows/day cap, so load first, create indexes after, and in chunks like the existing `.private/nbc-bp03/seed-live-*.sql`. Check `meta.rows_written` on a trial batch.

**Auth.** Better Auth with Google only.

- Keep the 11 user UUIDs as the Better Auth `user.id`, and create one `account` row per Google identity with `accountId` set to the Google subject id stored in Supabase `auth.identities.provider_id`. Ownership (`user_id`) and the user ids stored in NBC data (`confirmedBy`, `editor`) then stay valid, and people do not notice.
- One user has only an email identity. They need to sign in with Google using the same address (enable account linking by verified email) or be mapped by hand.
- Add `https://<new-origin>/api/auth/callback/google` to the Google OAuth client. The client secret lives in Supabase Auth settings and cannot be read back, so use the one from Google Cloud Console. Keep the Supabase callback registered until cutover.
- Guest mode (local only) does not change.

## 8. Phased plan

Sizes are rough: S is a day or less, M a few days, L a week or more of focused work with an agent.

| Phase | Work | Size | Reversible |
| --- | --- | --- | --- |
| P0 | Check post-November-3 egress. Export the 47 snapshot tables to `.private/`, verify the export, then (with your approval, since D-22 chose to leave them) drop them to free about 100 MB | S | Yes until the drop |
| P1 | **Seam.** Add a `CloudTransport` interface and a `supabaseTransport`; move `sync.ts`, `submission-actions.ts`, `NbcProject.tsx`, `template.ts`, `files.ts`, `AccountSettings.tsx` and `supabase.ts` behind it; make the six test files mock the transport. No behaviour change, mergeable on Supabase today | M | Yes |
| P2 | `worker/` project, D1 schema, Better Auth, `/api/sync`, `/api/rows`; tests with `@cloudflare/vitest-pool-workers` | M | Yes |
| P3 | NBC writer and reassign in the `NbcWriter` Durable Object, tested differentially against `transitionSubmission` and recorded Supabase outputs | L | Yes |
| P4 | `Hub` Durable Object for live updates, with the polling fallback | S-M | Yes |
| P5 | Rehearsal: export the 9 live tables, import into a scratch D1, compare row counts, per-row JSON hashes and the BP02/BP03/BP04 totals (your `.private/*/verify*.sql` checks are the model) | M | Yes |
| P6 | Cutover: flush clients, freeze writes, final export and import, deploy, add the Google redirect URI, show a "moved" notice on the old Vercel app, invalidate caches | S | Keep the old deployment and the Supabase project for rollback |
| P7 | Pause, then delete Supabase after the exports are verified. Remove `@supabase/supabase-js`, the CSP origin and env vars. Update `SETUP.md`, `AGENTS.md`/`CLAUDE.md` (the D-24 log rules) and `DECISIONS.md` | S | No |

## 9. Risks and spikes to run before committing

1. **10 ms CPU per Worker invocation on Free.** Spike S1: implement `confirm` for BP02 and measure CPU on the deployed Worker. Whether the same cap applies inside Durable Objects on Free is unconfirmed. Escape hatch if it fails: Workers Paid at $5/month, which is not free.
2. **100k D1 rows written per day.** A baseline reset or re-import of BP02 (17k rows plus indexes) would take most of a day; plan such operations across days.
3. **No interactive transactions on D1.** Mitigated by the `NbcWriter` Durable Object plus one `batch()`; spike S2 proves a concurrent double-confirm resolves cleanly.
4. **Origin change.** iPhone home-screen installs of the PWA tie to the origin and will need reinstalling. A custom domain (only free if you already own one) would avoid a second change later.
5. **Better Auth on D1.** Some write-ups report stale session reads from D1 consistency; test sign-in followed immediately by an API call.
6. **Data location.** SingBuild project data would live with a different vendor; confirm that is acceptable.
7. **Backups and free-tier drift.** D1 has point-in-time restore (Time Travel), with retention that differs by plan (sources say 7 or 30 days; check). Keep a scheduled export as well, and re-verify every limit in section 4 before cutover.

## 10. What I did not check

Supabase's Usage dashboard and Auth settings, Vercel usage, `.env.local`, the Edge Function sources, and the full bodies of about 20 of the 30 migrations. I read `workspace_v1`, `cloud_first_workspaces`, `nbc_bp03_progress`, `nbc_company_access`, `nbc_handler_submissions`, `nbc_multiple_projects`, `nbc_export_template`, `egress_compact_rpc_responses` and `security_advisor_fixes`; later migrations replace some of those function bodies, so the latest definitions (including the Friday deadline and the Vuth handler change) must be taken from the live database when porting.

## Sources

- Supabase Free limits: https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/ and https://www.cloudzero.com/blog/supabase-pricing/
- Cloudflare D1 pricing and limits: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare free tier summary: https://www.cloudflare.com/plans.md
- Durable Objects pricing: https://developers.cloudflare.com/durable-objects/platform/pricing
- Workers limits: https://developers.cloudflare.com/workers/platform/limits
- D1 batch and transactions: https://dev.to/hirodeath/cloudflare-d1-has-no-begin-transaction-so-i-tested-its-limits-and-batch-api-5813
- Neon Free: https://neon.com/faqs/free-plan-limits-and-quotas
- Convex limits: https://docs.convex.dev/production/state/limits
- Firebase Spark: https://dev.to/androve2k/spark-vs-blaze-the-firebase-pricing-guide-i-wish-id-read-sooner-onb
