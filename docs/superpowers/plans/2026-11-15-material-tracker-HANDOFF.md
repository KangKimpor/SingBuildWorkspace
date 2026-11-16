# Material tracker: handoff (finished 16 November 2026)

Branch `feat/material-tracker`, merged to `main`. Read the spec (`../specs/2026-11-15-material-tracker-design.md`) and the plan (`2026-11-15-material-tracker.md`) for the original brief. This note says where the work ended and how to check it.

## Done

| Plan task | State | Commits |
|---|---|---|
| 1 Migration | done, reviewed, **applied to the live project** | 0bf2daa, f50aa53 |
| 2 Types and formulas | done, reviewed | dad0f13 (and 88e8492) |
| 3 Importer | done, real run clean: exit 0, 0 mismatches on 4,365 formula cells | adc995e, 88e8492 |
| 4 Data module | done, reviewed | 7e464a5 |
| 5 `/admin` page and table | done, reviewed | 407644b |
| 6 Summary and notes tabs | done, wired into the page; D-38 written | 5d5f43b |
| 7 Import and verify | migration and seed applied, checks passed; thumbnails committed | adc995e, 7b4f310 |

`corepack pnpm typecheck`, `lint`, `test` (311 passed, 5 skipped) and `build` all pass at 5d5f43b.

## Live database (already done; do not redo)

- Migrations applied, `20261115021338_material_tracker` included (`supabase migration list --linked` shows local and remote versions matching).
- Access list: `kimpor.kang@singbuild.com`, `soklim.sim@singbuild.com`.
- Seed applied with `supabase db query --linked -f .private/mat-seed.sql` (Management API, so no pooler egress). Counts re-checked on 16 November: BP03 ID 317 items / 121 sections, MEP 39 / 8, Change Log 216 notes; BP04 ID 303 / 89, MEP 45 / 7, Review 192 notes. `kw_mat_items` is 992 kB; `kw_mat_remarks` starts empty at 48 kB.
- Checked in a rolled-back block: listed accounts read and write; another `@singbuild.com` account gets `Not found` and zero rows; anon is denied; the week was 2026-11-15 and turns to 2026-11-22 at Sunday 00:00 Phnom Penh. Security advisor: nothing new.
- Re-running the importer is safe (upserts `data` only, never `edits` or remarks), but needs the two workbooks in `.private/mat/bp03.xlsx` and `.private/mat/bp04.xlsx`, which are not in git. Python needs openpyxl and Pillow.

## Left to the owner

1. Sign in as one of the two accounts and open `/admin`: save a remark, override a percentage and use "Use formula", and compare the Summary tab with the workbook's Summary sheet for two sections. The four checks and the access gate are covered by tests, but no test can sign in to the live project.
2. When the two workbooks change, re-run `python scripts/mat-import.py`; the upsert leaves `edits` and remarks alone and does not delete rows that left the workbook.

## Decisions made along the way

- Weeks are Sunday to Saturday (owner, 15 Nov), shared with Project Progress (D-31).
- Definer function bodies live in `kw_private`; `public.kw_mat_*` are invoker wrappers (Security Advisor).
- Remaining quantity follows Excel `N()`: text in On site counts as 0; blank only when Total is text.
- Sections nest: each section row stores `end` and `level`; the Summary tab lists levels 0 and 1.
- Delta loads ask again for the last 10 seconds so a write that commits during a load is not missed.
- Owner, mid-run: use Fable for all remaining work, no new Opus agents. DeepSeek finished tasks 5 and 6.

## Changes on `main` this branch had to keep (D-37, 15 November)

`main` took D-37 for the security and egress audit, so this branch records its decision as **D-38**.

- **Migration file.** The live project recorded the tracker migration as version `20261115021338` (`supabase migration list`), so the file is `20261115021338_material_tracker.sql`. Keep that name, or `supabase db push` treats it as a second, unapplied migration.
- **Company data is staff-only.** `kw_private.kw_staff()` (true for a non-anonymous JWT whose email ends in `@singbuild.com`) now gates every NBC policy and `kw_nbc_owner()`. The tracker's own allow-list (`kw_private.mat_admins`, both `@singbuild.com`) is stricter, so nothing changes here.
- **Legacy objects moved to `kw_legacy`.** The tracker touches none of them; do not reference them.
- **Realtime sends ids, not rows.** The tracker has no realtime and loads deltas on visibility, which already fits. If live updates are added later, follow the same pattern (`kw_private.broadcast_changes()`); do not add tables to `supabase_realtime`.
- **IndexedDB.** `main` bumped the `kimpor-workspace` Dexie database to version 3 (per-row snapshot). The tracker uses its own database (`DB_NAME` in `src/mat/store.ts`), so there is no version clash.
- **Service worker.** The `public/mat/*.webp` thumbnails are not precached (`globPatterns` has no `webp`). The lazy `/admin` route sits inside the app's single `Suspense`, like the other routes.
