# Decisions

## D-07 Stitch supersedes the first Claude UI
The user's supplied Stitch export is the visual reference. Use the updated desktop HTML's cool shell, white content, Lucide icon tiles, compact metadata, and glass navigation. Older tablet exports include beige surfaces, sample collaboration, and inconsistent terminology; reconcile those to Quiet Glass and the brief's single-user/no-AI scope. Reject copying Tailwind CDN HTML into the React app. Five desktop PNGs are failed-fetch text files, so those screens cannot receive a valid pixel comparison.

## D-08 Local UI milestone before backend acceptance
Continue the brief by replacing feature placeholders with usable local screens. Reuse React, Router, Zustand, Radix, existing glass primitives, and CSS tokens without adding application dependencies. Browser localStorage preserves edits, reports write failures, and explicitly labels saved state as local. Reject pretending that Supabase, offline outbox, or Google sync is implemented. This remains short of full phase acceptance; see BUILD-STATUS.md. A future provider migration must preserve local edits.

## D-09 Initial blocks and task interaction
The local editor supports six explicit block types with slash selection and accessible move buttons. It is not a replacement for the full rich editor in Phase 1. Board columns accept desktop drag/drop; the table and inspector offer status selects as keyboard and touch alternatives. Full editor extensions, touch drag sensors, rich task schema, table controls, and calendar overlap/drag behavior remain on the phase checklist.

## D-10 Reference details and accessibility
Keep sample project names and content density but calculate progress from actual sample tasks. Replace member stacks with a single owner, fake sync claims with local state, and stale sample dates with relative local dates. The completion badge uses primary text on its green tint because the success text token failed dark-theme contrast on that surface. Desktop/tablet inspector overlays content rather than squeezing board columns, matching the latest task detail HTML.

## D-11 Invalid branding asset
The checked-in logo SVG contained six bytes of invalid data. Replace it with a valid placeholder K SVG and run the existing icon generator. No new branding or image-generation dependency is needed.

## D-03 Danger and success text colors
`--danger` and `--success` fail 4.5:1 as text on white, so `--danger-text` and `--success-text` exist for text use. Rejected: darkening the base colors (they are fills and icons too).

## D-04 Light yellow palette color (SPEC §9 contrast fix)
`--c-yellow` light changed `#cb912f` to `#bb8420`. Contrast on canvas 2.75:1 to about 3.2:1, meeting the 3:1 icon minimum. Smallest change that passes. Enforced by `src/test/contrast.test.ts`.

## D-05 Specimen token labels use primary text
Dark theme `.swatch code` in `secondary` text failed axe color-contrast over the ambient backdrop. Switched to `--text-primary`. Rejected: raising `--text-secondary`, which is a global token.

## D-06 Tooling
- `pnpm` runs via `corepack pnpm` on this machine (not on PATH). Use cmd, not PowerShell (script policy).
- `workbox-window` added as a dev dependency; `virtual:pwa-register` needs it.
- Helper scripts (screenshots) live outside the repo in `Downloads\kimpor-scripts`.

## D-12 Takeover verification and event names

On October 19 the prior BUILD-STATUS, README, and SETUP files still described the early local-only milestone, although later uncommitted code included BlockNote, scoped IndexedDB/outbox, account flows, and Google integration. Update those documents from current source and test evidence; retain live authenticated acceptance as open. Reject declaring the full brief complete from mocked account tests or a configured calendar endpoint.

Home event buttons now derive their accessible name from all visible card text. Their shorter aria-label omitted visible metadata and failed WebKit's label-content-name-mismatch rule. Reuse the existing Chromium/WebKit axe suite rather than weakening its checks.

## D-13 Release completion

Keep transient Google failures separate from revoked credentials. Use ETags for destructive updates and retain a durable local journal for recurring splits; retries reuse a deterministic replacement ID. A stale deletion loads Google's current event. An offline edit never recreates a remotely deleted event unless the user explicitly invokes Undo.

Recover conflicting page edits into a separate page before accepting the newer cloud version. Use isolated disposable accounts for live ownership/files/offline tests. Keep credentials, user screenshots and raw performance traces outside Git and deployments.

Custom recurrence accepts daily, weekly, monthly and yearly RRULEs; subdaily frequencies are outside the day-based calendar's scope. In-app reminders work while open; background Web Push remains v1.1. Device appearance stays local, while calendar display preferences sync with the workspace profile. Increase desktop page drag handles to 24 px for WCAG target sizing.

## D-14 Browser CI stability and failure evidence

GitHub run 39388636258 passed 118 deterministic checks but timed out waiting for the account form in two WebKit viewport checks. One failure artifact still showed the lazy-route loading screen. All 15 repeated account-layout checks passed locally with the existing two-worker CI setting, so runner contention is a hypothesis rather than a confirmed application defect.

Use one CI worker, following [Playwright's CI guidance](https://playwright.dev/docs/ci#workers), and retain failure traces so another failure includes network and rendering evidence. Keep assertions and retries unchanged. CI starts its own preview server; local runs may reuse an existing preview. A 20-minute browser-suite deadline leaves time for failure artifacts within the 25-minute job limit. Live QA tests retain their explicit trace exclusion. Reject increasing assertion timeouts without evidence of an application timing requirement.

The local full-suite check still encountered one intermittent WebKit timeout inside `axe.runPartial`, despite prompt page and asset loading. The same audit passed three isolated repetitions. Keep this failure explicit in BUILD-STATUS rather than claiming that worker serialization fixes every timeout or adding retries to conceal it.

## D-15 First paint before guest background initialization

Production Lighthouse run 39420463911 failed the existing mobile targets at performance 89 and LCP 2.25 seconds. Guest startup launched the offline-data import before contentful paint. Start that work after the browser reports first contentful paint, with an animation-frame/timer fallback where Paint Timing is unavailable. Keep stored-session and account-route initialization before rendering to preserve account isolation, and retain initialization error handling. A browser regression test fails on the previous ordering; it and the unsupported-API fallback pass repeated Chromium/WebKit checks. Local Lighthouse improves from 94 to 97, but local results do not establish production acceptance.

Run production performance checks for changes to application inputs on `main`, allow manual reruns, and wait for the same commit's successful Vercel status before auditing the production URL. Cancel superseded audits. Keep performance 95, accessibility 100 and LCP under two seconds as the acceptance thresholds.

The first deployed change improved mobile LCP to 2.17 seconds but still scored 89. An Ubuntu CPU trace identified substantial IndexedDB library initialization after paint. When the browser confirms there is no existing `kimpor-workspace` database, defer that initialization until the first click or keydown. Existing databases still restore automatically; missing or failed database enumeration uses the original eager initialization. Direct guest writes retain their synchronous localStorage recovery copy and IndexedDB persistence. Browser checks cover restoring an IndexedDB-only guest note, unsupported APIs, and preserving a fresh guest's first edit through reload. Remove diagnostic CPU profiling from the normal acceptance run.

The subsequent audit still missed the targets and showed substantial initial layout work. Compact Home renders its heading and today's events first, then fills tasks, projects and recent pages after contentful paint. Desktop keeps its full first render. Share the paint scheduler with startup and cancel its observer/frame when the Home effect unmounts. Accessibility audits wait for the final Home section so they still scan all content. Interaction listeners are installed immediately and initialization runs once, including when a click arrives during database enumeration.

## D-16 SingBuild project workspaces and cloud-first writes · October 25, 2026

Team and Personal are persistent private project groups. Default legacy projects to Personal, preserve owner-only RLS, and make the missing membership/permission model explicit. The selected project/group becomes the per-account opening screen; remove Home and hide Calendar navigation while retaining its integration and data.

Remove the task inspector and its opening state rather than retaining hidden detail actions. Keep primary fields in the reference-order table and extra properties in native in-flow details. Search links to the task's project table and focuses its editable title. Reuse glass controls and existing palette tokens, including selector options.

Replace local-outbox-gated writes and periodic workspace reads with an in-memory queue and authenticated Postgres Changes. The cloud remains authoritative; local storage and IndexedDB are optional recovery/cache paths. Rebase independent field changes, recover overlapping drafts in searchable pages, preserve new keystrokes during requests, and reject stale resurrection after hard deletes. Account generation checks isolate async results and subscription cleanup. Filtered Postgres Changes cover inserts/updates; a private topic restricted by account ID signals hard deletes and triggers an RLS-protected refetch. Its invoker-rights trigger sends no record data and has no publicly callable function. Retain Google Calendar polling, ETags, backoff and its durable series journal.

No backend release was authorized. Include the migration and inspect remote configuration read-only; report that the connected project has no workspace publication and disposable session credentials are absent. Use the supplied SingBuild wordmark and its symbol for regenerated proportion-preserving icons, retaining old data identifiers.


## D-17 NBC BP03 project-specific progress · October 26, 2026

Implement one flagged NBC BP03 Team project, using its original WBS and duration/BOQ-derived weights. Include GR&P once as a standalone editable leaf. Keep baseline metadata immutable, with owner-scoped activity/report rows following the current workspace CAS, save queue and recovery conventions. No workbook is shipped to the browser, and no import UI or generic project type is added. The workbook date remains unknown. Generate private seed SQL separately; require production authorization before applying it.

Follow the supplied `NBC-BP03-UX-PLAN.md`: compact persistent header/reporting chip, sticky tabs and BOQ controls, treegrid keyboard support, two sticky columns, phone two-line rows and full-height editing/filter sheets, six KPI tiles and grouped breakdowns. Add only missing NBC row/tab dimension tokens. Existing bottom sheets gain an optional large starting detent with direct Close/Escape handling; their ordinary default is preserved. Gate percentage changes on an open reporting week in client and database. Reuse the normal task table/board for actions; WBS links do not tie task status to mathematical progress.

Finalize canonical snapshots against current database rows under a project lock. Reject duplicate dates and stale proposals; rejected finalization restores a reviewable draft. Keep audit-event IDs stable so coalesced offline writes retain intermediate edits. Corrections create a new later-dated reporting period with selected revised activities and a required reason, retaining the original snapshot and exposing a correction log. Export a weekly UTF-8 CSV for Excel instead of adding a workbook library. Native SVG charts need no chart dependency and include a table alternative.


## D-18 NBC update workflow feedback · October 26, 2026

Move NBC navigation to Projects Progress while retaining its existing owner and Team database metadata. Rename views Project Progress and Update Progress. Keep four steps with the actual large activity editor inside Update; compact summaries and collapsed history prioritize working space. Journal raw input immediately and use the existing save queue for debounced valid edits. Preserve an open draft when leaving, and offer explicit activity cancellation that records a normal correction if a value already autosaved. Keep contribution to the whole project distinct from completion within a handler’s assigned share. Respect collapse state during filtering after opening ancestor context once.

Reuse shared task deletion for notes/Undo. Empty Trash permanently removes trashed pages/tasks with owner and expected-revision checks; queued removal survives offline recovery. Concurrently changed items remain available for review. Hide Design system from navigation without removing its route or existing component checks. No production operations are part of this follow-up.


## D-19 Full-screen progress editing and discard · October 26, 2026

The user clarified that bigger means the page fills the screen, with normal text. Hide shell/project chrome for the Update Progress route and give remaining viewport height to the table. Back offers keep editing, keep the draft, or delete. The user selected undoing the update’s percentages on delete. Restore the preceding finalized values (initial baseline if none), retain remarks/assignments/history, and remove only the open report. Use one owner-checked, revision-checked RPC under the existing project lock for atomic server rollback and deletion. Do not grant direct report deletion or permit deleting finalized snapshots. Reuse the durable save queue for discard intent and refresh canonical activities after acknowledgement. The additional migration is prepared and tested locally only.


## D-20 Remove Google Calendar integration · November 3, 2026

Google Calendar sync consumed most of the Supabase Free Plan egress: a poll across every connected calendar, with 2,393 provider events (about 2 MB) pulled into every client. The user chose to remove it entirely. Delete the client sync loop, push/acknowledge path, event-editor Google fields, `kw-google` Edge Function source, Vercel proxy and CSP entry. Local events stay and now write through the normal workspace queue. Workspace sign-in with Google is separate Supabase Auth and is kept. Database cleanup (provider events and the Google tables) is a separate, explicitly approved step.

## D-21 Automatic PWA updates with a visible notice · November 4, 2026

Users should always run the latest build, so a waiting service worker is no longer gated behind Reload and Later. On discovery the app shows "Update ready. Reloading automatically…" with a spinner, activates the update after a 1.5-second visible grace period and reloads that tab; while activating it changes to "Updating to the latest version…". Hidden tabs activate immediately so the next visit is current, and other open tabs show the same notice and adopt the update when one tab activates it. A failed activation keeps the notice with Retry. Rejected: pure `registerType: 'autoUpdate'`, because the generated client reloads as soon as the new worker activates, leaving no visible updating state; rejected: keeping Later, because it lets tabs sit on stale builds indefinitely.

## D-22 Performance Advisor cleanup · November 7, 2026

The linked project's Performance Advisor reported one WARN (`kw_projects` evaluated a permissive owner policy and a permissive shared-NBC policy on every read) and ten INFO unindexed foreign keys. Consolidate `kw_projects` reads into one SELECT policy and split the owner write policy per action, preserving owner-only writes and authenticated shared-NBC reads. Index the project-scoped manifest queries (`project_id, updated_at, id`), the WBS parent lookup, the owner lookup used by `kw_nbc_owner()`, and the legacy foreign keys still named by the export/delete RPCs. Drop the redundant `kw_profiles.user_id` foreign key because `id = user_id` and `id` already cascades from `auth.users`.

The 47 `kw_private.nbc_bp0*_bk_*` no-primary-key entries are manual import snapshots, not application tables; leave them in place and document archive/removal instead of adding keys. The migration was applied to the linked project on November 7, 2026, and the post-apply isolation test passes; the performance advisor WARN and unindexed-foreign-key entries are cleared.

## D-23 Security Advisor cleanup and transitive dependency pins · November 7, 2026

The old app's 14 legacy `SECURITY DEFINER` RPCs were executable by `anon` and `authenticated` although the current client never calls them. Revoke client `EXECUTE` and keep `service_role` for maintenance; guard each revoke with `to_regprocedure` so a migrations-only database still applies. For the two RPCs the app does use, `kw_nbc_owner()` and `kw_nbc_reassign_activities()`, move the definer body to `kw_private` and expose public `SECURITY INVOKER` wrappers with unchanged names and signatures, following the existing `kw_nbc_submission_write()` pattern. This preserves every RLS policy (function OIDs) and the server-side checks without weakening them. Rejected: rewriting every policy to inline the owner lookup, and dropping the legacy tables in the same change.

Leaked-password protection is not enabled: the organization entitlement `auth.password_hibp` is `hasAccess=false` on the Free plan and the Management API returns 402. Document it as a plan-gated setting rather than a code defect.

Dependabot's remaining open alerts are transitive dev dependencies of `vite-plugin-pwa@2.0.0 → workbox-build@7.4.1`. Pin patched `fast-uri@3.1.9`, `serialize-javascript@7.1.3`, and `glob@14.0.4` (which brings patched `minimatch@11.0.5`) in `pnpm-workspace.yaml`; pnpm 12 ignores `pnpm.overrides` in `package.json`. Override `glob`, not `minimatch`: forcing `minimatch@11` into `glob@11.1.0` makes `globSync` return zero matches and silently empties the PWA precache. `deepmerge@4.3.1` has no patched release and remains open; it is build-time only and never shipped to the browser.

## D-24 Supabase free plan log query limit optimization in agent instructions · November 8, 2026

To avoid exhausting the Supabase Free Plan log query and egress allowances during agentic debugging and maintenance, document explicit log query optimization rules in `AGENTS.md` and `CLAUDE.md`. Agents must:
- Narrow time ranges to the smallest window that could contain the answer (e.g. 1-day vs 7-day scans ~7x less data).
- Filter server-side in the query (by source, service, status code, project) before pulling data.
- Use the Logs Explorer for ad-hoc digging only, never for scripted polling schedules.
- Use Log Drains for continuous feeds or ongoing monitoring stacks.
- Evaluate query usage trends over multi-day spans rather than single-day spikes.

## D-25 Snapshot archive and database size reduction — November 8, 2026

The Free Plan database reached 148 MB of a 500 MB quota, 95 MB of it in 47 dated copies of
`nbc_bp02/03/04` activities, submissions, templates and summaries under `kw_private`. Nothing in
the schema referenced them (no view, function, trigger, policy or foreign key) and the app never
reads them, so they were archived and dropped instead of keeping point-in-time copies inside the
same database.

The archive is a full export — one CSV per table (`COPY ... WITH (FORMAT csv, HEADER true)`),
`schema.sql`, `manifest.json` with per-table rows/size/sha256, and `restore.py` — stored at
`SingBuild's Document/SingBuild Workspace/Supabase DB Archive/2026-11-08/kw-private-snapshots-20261108.zip`
in Google Drive. Every CSV was re-parsed and its row count compared with the source `count(*)`
before anything was dropped.

Also cleared: `cron.job_run_details` (1.7 MB of job history) and the 7 MB of bloat in
`public.kw_nbc_activities` reclaimed with `VACUUM FULL` (28 MB to 18 MB). The staging tables
(`nbc_bp02/03/04_stage`) are kept. Result: 42 MB, down from 148 MB. Rejected: adding primary keys
to the copies (no app benefit) and keeping only the newest snapshot per series (each is
reproducible from the source xlsx and the archive already holds every copy).

## D-26 Pooler egress spike on 8 November 2026 - November 9, 2026

The Supabase usage chart for 8 November showed 106.164 MB of Shared Pooler Egress (99.4% of the day), against 483 KB for PostgREST and 47 KB for Realtime. The app code never connects through the pooler. The spike is the D-25 archive: the 47 `kw_private` snapshot tables (95 MB) were exported with `COPY ... WITH (FORMAT csv)` over the CLI connection, and the database shrank from 148 MB to 42 MB, which matches the egress figure. It was a one-time maintenance cost, not a leak. Add a "Supabase Pooler Egress" section to `AGENTS.md` and `CLAUDE.md`: verify with server-side counts and hashes instead of downloading rows, select named columns only, drop regenerable data instead of exporting it, and ask before any read above about 10 MB.

## D-27 Room cells shared 50/50 by two handlers - November 11, 2026

"Installation Water Closet, Lavatory and Shower" in BP02 is split between Chhorvaon and Tola, each responsible for half. The model stays one handler per leaf: a shared room cell is two sibling leaves under the same task, each with half the relative and global weight, and the second carries `coOf` (the first half's id; id and wbs end in `.2`). Group, floor and project progress therefore come out of `calculate` unchanged, and the second half starts at the first half's progress so the migration (`20261111020544_nbc_bp02_shared_sanitary_ware.sql`) moves no percentage. `roomFloors` keeps `cells` as the first half and adds `co` and `leaves`; the matrix and the read-only Activities view show the cell as the average of its halves, and each handler edits only their own half in the update editor. The Excel export is unchanged in layout: the floor sheet cell is `AVERAGE(first-handler cell, second-handler cell)`, each handler sheet lists the task with their own half, and the client-report patch writes the average into the one printed cell. Reassigning a shared cell is blocked in the UI and in `assignActivities`. Rejected: a `handlers` array on the activity (touches the submission, guard-trigger and handler-completion model).

## D-28 BP02 follows the Weekly 63 report formulas - November 12, 2026

The client's Weekly 63 report weighs the project as 50% Guestroom + 5% Corridor + 45% MEP, with Guestroom and MEP floors weighted by room count and the corridor by floor, so a project figure is no longer the average of the floor figures. The app keeps one tree and two sets of weights that already exist on every row: `globalWeight` (what `calculate().overall` sums) holds the project-wide weighting, and `relativeWeight` (what each row rolls up by) holds the floor-level weighting, so both the headline and each floor/section/group row equal the report. Leaves for cells the report marks N/A are removed rather than kept at weight 0, because the matrix and the update editor would otherwise still ask for them. A room the report renamed on one sheet only is matched by unit number when patching the report. The migration was applied as a temporary function with a dry run that raised its checksums (count, Σweights, Σweights², position-weighted Σweights per floor and section), which matched an independent Python model of the report before anything was committed. Rejected: renaming every task to the report's spelling (only the Weekly 62 → 63 renames were applied; older differences are listed in `docs/NBC-BP02-PROGRESS-TRACKER.md`) and rewriting the tracker workbook export to the report's formulas (out of scope; noted there).

## D-29 Exports follow the report formulas; BP03 export check - November 12, 2026

The BP02 tracker workbook export now uses the Weekly 63 formulas (D-28) instead of its own floors-at-1/11 and plain room averages, so its Overall, the app and the client report agree. Guestroom task weights are not stored per task (the task row holds the sum of its room shares), so the export recovers the report's E from the room that has every task of the group and falls back to the stored weight for data that was not built that way. The report update relabels *Install Single Leaf* to *Install Swing Door (D4)* through a one-entry table (`RELABEL`), so other label differences are never rewritten silently. The BP03 export test compared the export's overall with the app's zone-weighted sum, but since 15aeab3 the BP03 export follows the report (E7 = equal average of the areas, lift car and AV excluded), so the two differ by design (40.8 % against 45.8 % on the older local extract). The test now checks BP03's export against its own area average and keeps the app-equals-export check for BP04, whose zones the app does weigh. Open: BP03's headline in the app is still the zone-weighted figure, not the report's; aligning it would be a database change like D-28 and was not part of this task.

## D-30 Project Progress re-skin: scoped `--pp-*` tokens - November 12, 2026

The new Project Progress look (level tiers, band colors, frozen columns, toolbar, sidebar) uses its own `--pp-*` tokens in `tokens.css` instead of overriding `--text-primary`, `--border-strong` or `--accent`, because those also paint the app shell. Deviations from the brief, each chosen deliberately: (1) the Now % bar and "+x" chip read `data-pct`/`data-delta`/`--pct` set in `WbsTable` and `RoomMatrix` (helper `src/nbc/ui/now-cell.ts`); CSS alone cannot draw them. (2) A phone "Filters" toggle was added to `Activities.tsx`; it opens by default when a handler or area filter is in the URL. (3) The matrix has no level-1 row, so its section row takes the navy tier and its group row the light blue (CSS only). (4) The done-cell green text in room cells was removed (no conditional cell colour). (5) On request, the sidebar was restyled to the prototype (flat edge, plain project rows, 2px bar from `--pct`, tinted active view); its width and background stay, as `stitch-design.spec.ts` asserts them. (6) Link text on the light blue tier uses `--pp-l2-link` (#15508f), since `--pp-accent-ink` is 4.3:1 there.
