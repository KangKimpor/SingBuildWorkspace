# Material tracker: handoff (15 November 2026)

Branch `feat/material-tracker`. Read the spec (`../specs/2026-11-15-material-tracker-design.md`) and the plan (`2026-11-15-material-tracker.md`) first. This note says where the work stopped.

## Done

| Plan task | State | Commits |
|---|---|---|
| 1 Migration | done, reviewed, **applied to the live project** | 0bf2daa, f50aa53 |
| 2 Types and formulas | done, reviewed | dad0f13 (and 88e8492) |
| 3 Importer | done, real run clean: exit 0, 0 mismatches on 4,365 formula cells | adc995e, 88e8492 |
| 4 Data module | done, reviewed | 7e464a5 |
| 5 `/admin` page and table | committed, **not reviewed yet**: its builder stopped on a usage limit while writing its report | 407644b |
| 6 Summary and notes tabs | components and tests written, **not wired into the page yet**, no D-37 yet | this commit |
| 7 Import and verify | migration and seed applied, checks passed (below); thumbnails committed | this commit |

`corepack pnpm typecheck`, `lint` and `test` (304 passed, 5 skipped) pass at this commit. `build` has not been run on it.

## Live database (already done; do not redo)

- Migration `material_tracker` applied. Access list: `kimpor.kang@singbuild.com`, `soklim.sim@singbuild.com`.
- Seed applied with `supabase db query --linked -f .private/mat-seed.sql` (Management API, so no pooler egress). Counts: BP03 ID 317 items / 121 sections, MEP 39 / 8, Change Log 216 notes; BP04 ID 303 / 89, MEP 45 / 7, Review 192 notes. `kw_mat_items` is 992 kB.
- Checked in a rolled-back block: listed accounts read and write; another `@singbuild.com` account gets `Not found` and zero rows; anon is denied; the week is 2026-11-15 and turns to 2026-11-22 at Sunday 00:00 Phnom Penh. Security advisor: nothing new.
- Re-running the importer is safe (upserts `data` only, never `edits` or remarks), but needs the two workbooks in `.private/mat/bp03.xlsx` and `.private/mat/bp04.xlsx`, which are not in git. Python needs openpyxl and Pillow.

## Next steps

1. Review commit 407644b against `task 5` in the plan (Review Focus 1, 3 and 4 especially). The nested-section rule: averages use `sectionItems()`, collapsing hides `pos` in (section.pos, section.data.end], labels indent by `data.level`.
2. Wire `MatSummary` and `MatNotes` (`src/mat/MatSummary.tsx`, `src/mat/MatNotes.tsx`) into `MaterialTracker.tsx` in place of the placeholders: Summary tab → `<MatSummary items={state.items} />`; Review / Change Log tab → `<MatNotes items={state.items} sheet={...} />`. The `.mat-summary*`, `.mat-plain*`, `.mat-notes`, `.mat-empty` classes still need styles in `mat.css`.
3. Add D-37 to `docs/DECISIONS.md` (content listed in plan task 6).
4. `corepack pnpm build`, then `graphify update .`.
5. Run the app, sign in as a listed account, open `/admin`: save one remark, override one percentage and use "Use formula", compare the Summary tab with the workbook's Summary sheet for two sections.
6. Whole-branch review, then merge to `main` only when the owner says so.

## Decisions made along the way

- Weeks are Sunday to Saturday (owner, 15 Nov), shared with Project Progress (D-31).
- Definer function bodies live in `kw_private`; `public.kw_mat_*` are invoker wrappers (Security Advisor).
- Remaining quantity follows Excel `N()`: text in On site counts as 0; blank only when Total is text.
- Sections nest: each section row stores `end` and `level`; the Summary tab lists levels 0 and 1.
- Delta loads ask again for the last 10 seconds so a write that commits during a load is not missed.
- Owner, mid-run: use Fable for all remaining work, no new Opus agents.
