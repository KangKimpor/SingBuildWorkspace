# Claude Agent Instructions

Refer to [AGENTS.md](AGENTS.md) for full project agent instructions, operational guidelines, and verification commands.

## Supabase Log Query Optimization (Free Plan)

### Optimize usage

Two people asking similar-sounding questions can generate very different amounts of usage, depending on how they ask. These tips help you avoid scanning more data than a question requires — they're habits, not restrictions, and none of them ask you to give up visibility you need.

- **Narrow your time range to what the question needs.** Query cost scales with how much data a query scans, and time range is usually the biggest factor: a 1-day window scans about 7 times less data than a 7-day window. Start with the smallest window that could contain the answer, and widen only if you don't find it. Keep a wide window when you're doing genuine historical or trend analysis on purpose — that's a real use case, only a more expensive one by nature.
- **Filter as part of the query, not after you've pulled the data.** Add filters for source, service, status code, or project before you run a search. A broad, unfiltered query scans everything in its time range, even if you only look at a fraction of the results afterwards. Filtering after the fact doesn't reduce what was already scanned.
- **Use the Logs Explorer for ad-hoc digging, not scripted polling.** Every query scans data again — there's no caching benefit from asking the same question repeatedly. A script that polls the query endpoint on a schedule re-scans on every run, so it can use far more allowance than a person checking manually, even if it usually finds nothing new.
- **Use Log Drains for anything continuous.** If you need an ongoing feed of your logs — for your own monitoring stack, alerting, or archiving — repeatedly querying for what's new since you last checked is one of the most expensive ways to get it, because each check re-scans. Drains stream logs to a destination as they arrive instead.

After you change how you query, check your usage trend over the following few days rather than a single day. Usage varies with how much debugging or investigation you happen to do, so a single day's change isn't a reliable signal on its own.

## Supabase Pooler Egress (Free Plan)

Direct Postgres traffic is billed as "Shared Pooler Egress" and counts against the same 5 GB egress quota as the app. This covers the Supabase CLI (`db dump`, `db query`), `psql`, `COPY ... TO STDOUT` and any MCP `execute_sql` that returns rows. On 8 November 2026 the snapshot archive (D-25) pulled about 106 MB through the pooler in one day, 99.4% of that day's egress. The app itself used under 1 MB (PostgREST, Realtime, Auth and Functions combined).

- **Do not download table contents to check them.** Compute counts, sums and `md5(string_agg(...))` hashes inside the database and return only the result.
- **Select only what the task needs.** Name columns and add `where` and `limit`. Avoid `select *` on `kw_nbc_activities`, `kw_nbc_submissions`, `kw_nbc_templates` (large `data` jsonb and template payloads) and on the `kw_private.nbc_bp0*_bk_*` snapshots.
- **Prefer dropping data that can be regenerated** (the snapshots are reproducible from the source xlsx files under `.private/`) over exporting it.
- **Estimate before any bulk read.** Run `select pg_size_pretty(pg_total_relation_size('schema.table'))` first. If the export is larger than about 10 MB, ask the user before running it.
- **Export at most once, and only the tables that must be kept.** Record the size in `docs/DECISIONS.md`.