# NBC BP02 progress tracker

## 3 November 2026 — new baseline workbook

`NBC_BP02_Progress_Tracking_by_BOQ_01_November_07_November_updated.xlsx` (SHA-256 `ceaa97da10c3b015929dca51f6c45d44360464a4420736565fd09b084b918c81`) is now the BP02 baseline for percentages, handlers, weights and the stored Excel template. The previous BP02 activities, submissions, summaries and template were replaced; the file's weekly block label was ignored and its values are recorded as the confirmed `2026-10-26` block (six handlers, previous = current, so no weekly change). Week `2026-11-02` is open with no submissions or drafts. BP03 and BP04 were not touched.

**Why the structure changed.** In the new workbook Tola has one MEP row per floor (his tab), while the Progress sheet repeats every MEP task under each room type and links each repeat by formula to that one row (5,471 repeats). The app keeps one activity per handler row, so BP02 now holds Tola's MEP once per floor under that floor, weighted by the sum of the rows that read it. Floor totals and the overall figure equal the workbook exactly (overall 81.3868%, the workbook's BOQ-weighted total in `Progress!P5`; its `N5` block-weighted 83.64% uses fixed 50/5/45 block weights that the app does not model). Room-type group percentages no longer include Tola's MEP. Chhorvaon's sanitary-ware tasks stay inside their room types.

Result: 5,521 activities (2,038 parents, 3,483 editable leaves). Handlers: Sitha 628 · Lychhinh 650 · Chhorvaon 357 · Srun 487 · Kheng 888 · Tola 473. BOQ total USD 4,985,118.99. This is 3,562 fewer rows than before, which also reduces sync size.

**Export.** The stored workbook keeps its own roll-up formulas. The export updates each handler row in place (Chhorvaon's older `.14.3.1` keys are matched), rewrites the handler links of every repeated Progress MEP row to the shared Tola row (also after a reassignment), refreshes floor figures and leaves the template's roll-ups to recalculate on opening. Validation compares leaf global weights; for Tola rows it compares the sum of the Progress rows that read them. Room-group relative weights are not compared because they intentionally differ.

**Database.** No schema migration was needed (all migrations through `20261104091000_nbc_vuth_handler` were already live). A guarded single transaction (`scripts/nbc-bp02-baseline-sql.py` → private `.private/nbc-bp02/sql/`) staged the data, copied the old BP02 rows to `kw_private.nbc_bp02_bk_*_20261103_162856`, replaced activities/template/submissions/summaries and verified counts, the editable rule, the template hash and the overall figure before committing. BP02 has 5,521 activities, 6 confirmed `2026-10-26` submissions and summaries for `2026-10-26` and `2026-11-02`; BP03 (790) and BP04 (382) are unchanged.

Regenerate private files with:

```powershell
python scripts/nbc-bp02-extract.py 'C:/path/NBC_BP02_Progress_Tracking_by_BOQ_01_November_07_November_updated.xlsx'
```

The extractor verifies the workbook's own links (each Progress leaf's formula, value and handler row), every floor against the workbook, total weight, BOQ total and the overall figure.

## Earlier setup (30 October 2026)

NBC BP02 – Pan Pacific Hotel (guestrooms and corridor/lift lobby, L13–L23) was added with project ID `nbc-bp02` and activity IDs `nbc-bp02:<WBS>`. It reuses the shared BOQ workflow (Overview, Project Progress, Update Progress, autosave, history, Excel export). BP02 has its own plan (`BP02_PLAN`) from the weekly report: contract dates 1 Sep 2025 – 20 Jun 2026 and 57 projected points (`SC(p)!B52:BF52`, `B55:BF55`), with a 0% anchor on the commencement date. Very large local workspaces fall back to the IndexedDB snapshot instead of failing a localStorage save.

## Verification

Unit tests (`src/nbc/projects.test.ts`, private BP02 tests) reconcile every node, weight, the BOQ total, the export totals after an edit, and the export hierarchy/floor code after a handler reassignment. `e2e/nbc-bp02.spec.ts` covers the browser journey. Not run after the rebuild: the disposable PostgreSQL check and WebKit.
