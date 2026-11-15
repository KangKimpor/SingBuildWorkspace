# Material List Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hidden `/admin` page that holds the BP03 and BP04 material lists with weekly PM and Purchase remarks and formula-or-typed quantities and percentages, readable and writable by two accounts only.

**Architecture:** Two dedicated Supabase tables behind an email allow-list, reached only through three RPCs. A self-contained `src/mat/` module loads a package once, caches it locally and then fetches only changed rows. A local Python importer turns the two workbooks into a SQL seed and small WebP thumbnails served by Vercel.

**Tech Stack:** React 19 + Vite + react-router, TypeScript, Vitest + Testing Library, Supabase Postgres (plpgsql, RLS), Python 3 + openpyxl + Pillow for the one-off import.

**Spec:** `docs/superpowers/specs/2026-11-15-material-tracker-design.md`. Read it before any task.

**Who runs what:** Tasks 1 to 6 are coding tasks for Opus 5.5 at high effort. Tasks marked **(Fable)** are run by the session model: import run, applying the migration and seed, verification.

## Global Constraints

- Work on branch `feat/material-tracker`, never on `main`. One commit per task. End commit messages with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- Commands: `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`. Node 24.
- Before the first grep or file read for a codebase question, run `graphify query "<question>"`. After code changes run `graphify update .`.
- No new npm dependency. No realtime channel, no cron, no polling.
- Nothing from the workbooks is committed: source files, `mat-seed.sql` and any real material text stay under `.private/` (gitignored). Test fixtures use made-up materials. The only committed artefacts of the import are the thumbnails in `public/mat/`.
- The tracker must not touch `kw_workspace_write`, the workspace store or the workspace sync.
- Allowed emails, exactly: `kimpor.kang@singbuild.com`, `soklim.sim@singbuild.com`.
- Weeks: Sunday to Saturday in `Asia/Phnom_Penh`. Client reuses `reportingDate`, `weekStart`, `addDays`, `weekLabel` from `src/nbc/submissions.ts`. SQL week key: `(date_trunc('week',(clock_timestamp() at time zone 'Asia/Phnom_Penh')+interval '1 day')::date-1)`.
- Never run a query that returns table contents from the live database. Counts, sums and md5 only.
- SQL functions: `set search_path=''`, schema-qualified names, `revoke ... from public, anon`, grant to `authenticated` only.
- UI uses the `--pp-*` tokens in `src/styles/tokens.css`. No row virtualization (D-34).

## Review Focus

1. **The week rolls over while the page is open.** A remark saved after Saturday midnight lands in the new week on the server. The page must adopt the week the server returns and redraw both columns. Test in Task 4.
2. **Free text typed into a number cell** (`50%`, `0.5`, `1,200`, `N/A`, `Pending`). Percent cells: a number is read as percent (50 means 50%, stored 0.5); quantity cells strip thousands commas; anything non-numeric up to 60 characters is kept as text and counts as 0 in formulas. Test in Task 2.
3. **A save fails or the device is offline.** The typed text stays in the cell, the cell shows an error state and a retry, and no other cell is reverted. Test in Task 5.
4. **A signed-in account that is not on the list, or a signed-out visitor, opens `/admin`.** Same "Not found" page as any unknown address, and no material request is sent. Test in Task 5.
5. **The workbook is imported again after people have typed.** `edits` and remarks survive; rows no longer in the workbook are left in place, not deleted. Test in Task 3.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261115090000_material_tracker.sql` | tables, RLS, allow-list, week function, three RPCs |
| `src/mat/types.ts` | shared types and the column list |
| `src/mat/formulas.ts` | formula keys, effective values, parsing typed input, section averages |
| `src/mat/api.ts` | the four Supabase calls, nothing else |
| `src/mat/store.ts` | cache, delta load, optimistic saves, `useMat` hook |
| `src/mat/MaterialTracker.tsx` | page shell: access gate, package and sheet tabs, toolbar |
| `src/mat/MatTable.tsx` | the material table with editable cells |
| `src/mat/MatSummary.tsx`, `src/mat/MatNotes.tsx` | Summary tab; Review and Change Log tab |
| `src/mat/mat.css` | page styles |
| `scripts/mat-import.py` | one-off workbook import and self-check |
| `src/App.tsx` | one lazy route |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20261115090000_material_tracker.sql`
- Test: `src/test/material-tracker-migration.test.ts` (follow the style of `src/test/egress-optimization.test.ts`, which asserts on migration text)

**Interfaces — Produces:**
- `kw_private.mat_admins(email text primary key)`, seeded with the two allowed emails (lower case).
- `public.kw_mat_access() returns boolean`: `security definer`, true when `lower(auth.jwt()->>'email')` is in `mat_admins`.
- `kw_private.mat_week() returns date`: the Sunday key from Global Constraints.
- `public.kw_mat_items(id text primary key, package text check in ('bp03','bp04'), sheet text check in ('id','mep','review','changelog'), pos int not null, kind text check in ('section','item','note'), data jsonb not null, edits jsonb not null default '{}', updated_at timestamptz not null default now(), updated_by uuid)`; index `(package, updated_at)`.
- `public.kw_mat_remarks(item_id text references kw_mat_items on delete cascade, team text check in ('pm','purchase'), week_start date, body text not null check (length(body) <= 2000), updated_at timestamptz not null default now(), updated_by uuid, primary key (item_id, team, week_start))`; index `(week_start, updated_at)`.
- RLS on both tables: one `select` policy `to authenticated using ((select public.kw_mat_access()))`. `revoke insert, update, delete ... from authenticated, anon`.
- `public.kw_mat_load(p_package text, p_items_since timestamptz default null, p_remarks_since timestamptz default null) returns jsonb` = `{ "week": "YYYY-MM-DD", "now": "<timestamptz>", "items": [{id,sheet,pos,kind,data,edits,updated_at}], "remarks": [{item_id,team,week_start,body}] }`. Items: that package, `updated_at > p_items_since` or all when null, ordered by `sheet, pos`. Remarks: that package's items, `week_start in (week, week-7)`, `updated_at > p_remarks_since` or all when null. Empty arrays as `[]`, never null.
- `public.kw_mat_set_cell(p_id text, p_cell text, p_value jsonb) returns jsonb` = `{ "updated_at": ... }`. `p_cell` must be one of `total, po, shd, onsite, remaining, notYetPo, placed, production, waiting, shipping, arrived`. `p_value` is json `null` (remove the key), a number, or a string of 1 to 60 characters. Only `kind='item'` rows. Sets `updated_at=now()`, `updated_by=auth.uid()`.
- `public.kw_mat_set_remark(p_id text, p_team text, p_body text) returns jsonb` = `{ "week": ..., "updated_at": ... }`. Upserts `(p_id, p_team, mat_week())` with `btrim(p_body)`. An empty body is stored as `''` (not deleted) so delta loads see the change.
- All three RPCs and `kw_mat_load` are `security definer` and start with `if not public.kw_mat_access() then raise exception 'Not found' using errcode='42501'; end if;`.

- [ ] **Step 1: Write the failing test** `src/test/material-tracker-migration.test.ts`. Read the migration file as text and assert: both table names; `enable row level security` twice; both allowed emails; the Sunday week expression verbatim; each of the four function names followed by `security definer` and `set search_path`; `revoke insert` on both tables; no occurrence of `kw_workspace_write`; no `realtime` and no `cron`.
- [ ] **Step 2:** Run `corepack pnpm test src/test/material-tracker-migration.test.ts`. Expected: fails, file not found.
- [ ] **Step 3: Write the migration** to the interfaces above. Load the `supabase:supabase-postgres-best-practices` skill first.
- [ ] **Step 4:** Run the test. Expected: pass.
- [ ] **Step 5: Commit** `feat(mat): material tracker tables, access list and RPCs`.

Do not apply the migration. Task 7 does that.

---

### Task 2: Types and formulas

**Files:**
- Create: `src/mat/types.ts`, `src/mat/formulas.ts`
- Test: `src/mat/formulas.test.ts`

**Interfaces — Produces:**

```ts
// types.ts
export type Pkg = 'bp03' | 'bp04'
export type Sheet = 'id' | 'mep' | 'review' | 'changelog'
export type Team = 'pm' | 'purchase'
export const QTY_CELLS = ['total', 'po', 'shd', 'onsite', 'remaining'] as const
export const PCT_CELLS = ['notYetPo', 'placed', 'production', 'waiting', 'shipping', 'arrived'] as const
export type CellKey = (typeof QTY_CELLS)[number] | (typeof PCT_CELLS)[number]
export type FormulaKey =
  | 'notYetPo' | 'placedPoOverTotal' | 'shdOverPo' | 'waiting' | 'arrived'
  | 'totalMinusOnsite' | 'shdMinusOnsite' | 'totalMinusShd'
export type Scalar = number | string | null
export type Source = { f: FormulaKey } | { v: Scalar }
export type ColKey = 'no' | 'pic' | 'bp02' | 'code' | 'description' | 'location' | 'spec' | 'brand' | 'source'
  | 'msPlan' | 'msActual' | 'msApproved' | 'msStatus' | 'ssPlan' | 'ssActual' | 'ssApproved'
  | 'poPlan' | 'poActual' | 'arrPlan' | 'arrActual' | 'procRemarks' | 'unit' | 'lastUpdated'
export interface MatData {
  cols: Partial<Record<ColKey, Scalar>>        // dates as 'YYYY-MM-DD'; text kept as typed
  cells: Partial<Record<CellKey, Source>>
  mark?: 'done' | 'tracking' | 'omit'
  images?: { image?: string[]; sample?: string[] }  // file names under /mat/
  notes?: Partial<Record<CellKey | ColKey, string>> // e.g. the '=296+8' expression
  note?: string[]                              // kind 'note' rows: the row's cells, left to right
}
export interface MatItem { id: string; package: Pkg; sheet: Sheet; pos: number; kind: 'section' | 'item' | 'note'; data: MatData; edits: Partial<Record<CellKey, number | string>>; updatedAt: string }

// formulas.ts
export function n(value: Scalar | undefined): number            // Excel N(): numbers pass, everything else 0
export function effective(item: MatItem): Record<CellKey, Scalar> // edits over data, formulas resolved
export function isOverride(item: MatItem, cell: CellKey): boolean
export function parseInput(cell: CellKey, text: string): number | string | null // null = clear the override
export function average(items: MatItem[], cell: CellKey): number | null         // mean of numeric effective values
export function formatCell(cell: CellKey, value: Scalar): string
```

Formula rules (inputs are effective values, so an override feeds the cells that depend on it; `total`=Y, `po`=Z, `shd`=AA, `onsite`=AB):

| Key | Result |
|---|---|
| `placedPoOverTotal` | `n(total)=0` → null; `n(po)=0` → 0; else `min(1, po/total)` |
| `shdOverPo` | `n(po)=0` → null; `n(shd)=0` → 0; else `min(1, shd/po)` |
| `notYetPo` | `n(total)=0` → null; placed is not a number → null; else `1 − placed` |
| `waiting` | `n(total)=0` → null; else `max(0, n(production) − n(shipping) − n(arrived))` |
| `arrived` | `n(total)=0` → null; else `min(1, n(onsite)/total)` |
| `totalMinusOnsite`, `shdMinusOnsite`, `totalMinusShd` | either operand is non-empty text → null; else difference with blanks as 0 |

A cell with no source and no edit is null. Wherever Excel would show an error, the result is null. `parseInput` follows Review Focus 2; an empty or whitespace string returns null. `formatCell`: percent cells as whole percent (`52%`), quantities with up to 2 decimals and thousands separators, text as is, null as empty.

- [ ] **Step 1: Write the failing tests.** One `describe` per formula key with the boundary rows of the table above, plus:

```ts
it('an override feeds dependent formulas', () => {
  const item = make({ total: { v: 100 }, po: { v: 50 }, placed: { f: 'placedPoOverTotal' }, notYetPo: { f: 'notYetPo' } }, { po: 80 })
  expect(effective(item).placed).toBe(0.8)
  expect(effective(item).notYetPo).toBeCloseTo(0.2)
  expect(isOverride(item, 'po')).toBe(true)
})
it('text in a number cell counts as 0 and is kept', () => {
  const item = make({ total: { v: 'Not in the BOQ' }, placed: { f: 'placedPoOverTotal' } })
  expect(effective(item).total).toBe('Not in the BOQ')
  expect(effective(item).placed).toBeNull()
})
it('parses typed input', () => {
  expect(parseInput('placed', '50')).toBe(0.5)
  expect(parseInput('placed', '50%')).toBe(0.5)
  expect(parseInput('placed', '0.5')).toBe(0.005)
  expect(parseInput('total', '1,200')).toBe(1200)
  expect(parseInput('total', 'Pending')).toBe('Pending')
  expect(parseInput('total', '   ')).toBeNull()
  expect(() => parseInput('total', 'x'.repeat(61))).toThrow()
})
it('averages only numeric cells', () => {
  expect(average([pct(0.2), pct('N/A'), pct(null), pct(0.6)], 'placed')).toBeCloseTo(0.4)
  expect(average([pct('N/A')], 'placed')).toBeNull()
})
```

- [ ] **Step 2:** Run `corepack pnpm test src/mat/formulas.test.ts`. Expected: fails, module not found.
- [ ] **Step 3: Implement** `types.ts` and `formulas.ts`. Resolve formulas in dependency order (`placed` before `notYetPo`; `production`, `shipping`, `arrived` before `waiting`).
- [ ] **Step 4:** Run the tests, then `corepack pnpm typecheck`. Expected: pass.
- [ ] **Step 5: Commit** `feat(mat): material types and formula rules`.

---

### Task 3: Workbook importer

**Files:**
- Create: `scripts/mat-import.py`, `scripts/mat-import.test.py` (plain `unittest`, builds a tiny workbook in a temp folder with openpyxl)
- Reference: `scripts/nbc-bp03-rooms-extract.py` for house style

**Interfaces:**
- Consumes: the `FormulaKey` names, `CellKey` names, `ColKey` names and `MatData` shape from Task 2, exactly.
- Produces: `python scripts/mat-import.py --bp03 <xlsx> --bp04 <xlsx> --sql .private/mat-seed.sql --images public/mat [--no-images]`. Exit code 0 only when the self-check passes. Prints per sheet: rows, sections, items, formula cells checked, pictures written, pictures skipped.

Rules the importer must follow:
- Find columns by header text in rows 6 and 7, not by letter. BP04 `MEP Material` has its percentage group in different columns from the other three sheets.
- Data starts at row 9. Row 8 is the sheet total and is skipped (the app calculates it). A row is a `section` when it has a label but no material code or quantity and its percentage cells are `SUBTOTAL` formulas or empty. Fully empty rows are skipped.
- Item id: `<pkg>-<sheet>-<source row, 4 digits>`, for example `bp03-id-0104`. `pos` is the source row number.
- Quantity and percentage cells: a formula becomes `{ "f": key }` by matching its shape after replacing row numbers; a typed value becomes `{ "v": value }`. An unrecognised formula in these cells stops the run and names the cell. `=296+8` style arithmetic on constants becomes `{ "v": 304 }` with the expression in `notes`.
- Percentage cells that are empty in BP04 `MEP Material` get the standard keys: `notYetPo`, `placedPoOverTotal`, none, `waiting`, none, `arrived`.
- Every other formula cell (`=L10+10`, `=A10+1`, date sums) is stored as its cached value.
- Dates as `YYYY-MM-DD`; text trimmed of trailing spaces only; nothing else is rewritten.
- `mark`: compare each row's fill in the Material Code column with the fills of the legend cells `W1`, `W2`, `W3` (done, tracking, omit).
- `Review` and `Change Log` sheets: every non-empty row becomes a `note` item with `data.note` = its cells.
- Self-check: for each formula-backed quantity or percentage cell, the value from a Python copy of the Task 2 rules must equal Excel's cached value within 1e-9; a cached Excel error equals null. Section rows: the average of the numeric item cells below equals the cached `SUBTOTAL`. Any mismatch is printed with its cell address and the run exits 1.
- SQL output: one transaction; `insert ... on conflict (id) do update set package, sheet, pos, kind, data = excluded...` and nothing else. Never writes `edits`, never deletes. Statements are chunked so no single statement exceeds 500 kB.
- Pictures: read `xl/drawings/*.xml` anchors; a picture anchored in the Image column goes to `images.image`, in the Approved Sample column to `images.sample`, on its anchor row. Convert to WebP, 480 px on the long side, quality 70, file name = first 16 hex of the sha256 of the output + `.webp`. WMF: try Pillow; on failure add to the skipped list and continue. Pictures anchored outside those two columns are ignored.

- [ ] **Step 1: Write the failing test** `scripts/mat-import.test.py`: build a workbook with one section and three items (one standard, one with text in Total, one with a typed percentage), run the importer with `--no-images`, and assert the SQL contains the three ids, `"f": "placedPoOverTotal"`, the text total, and no `edits`. A second test changes a formula to `=Y10*2` and asserts exit code 1 with the cell address in the output. A third runs the importer twice and asserts identical output.
- [ ] **Step 2:** Run `python scripts/mat-import.test.py`. Expected: fails.
- [ ] **Step 3: Implement** `scripts/mat-import.py`.
- [ ] **Step 4:** Run the test. Expected: pass.
- [ ] **Step 5: Commit** `feat(mat): workbook importer with formula self-check`.

Do not run it on the real workbooks. Task 7 does that.

---

### Task 4: Data module

**Files:**
- Create: `src/mat/api.ts`, `src/mat/store.ts`
- Test: `src/mat/store.test.ts` (mock `./api`)

**Interfaces:**
- Consumes: RPC shapes from Task 1; types from Task 2; `initializeSupabase` from `src/lib/supabase.ts`.
- Produces:

```ts
// api.ts — thin wrappers, throw Error on any Supabase error
export function fetchAccess(): Promise<boolean>
export function fetchPackage(pkg: Pkg, itemsSince: string | null, remarksSince: string | null): Promise<{ week: string; now: string; items: MatItem[]; remarks: { itemId: string; team: Team; weekStart: string; body: string }[] }>
export function saveCell(id: string, cell: CellKey, value: number | string | null): Promise<void>
export function saveRemark(id: string, team: Team, body: string): Promise<{ week: string }>

// store.ts
export const remarkKey = (itemId: string, team: Team, week: string) => `${itemId}:${team}:${week}`
export interface MatState { week: string; items: MatItem[]; remarks: Record<string, string>; syncedAt: string }
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
export function useMat(pkg: Pkg): {
  state: MatState | null
  loading: boolean
  error: string | null
  saveStatus: SaveStatus
  refresh(): Promise<void>
  setCell(id: string, cell: CellKey, value: number | string | null): Promise<void>  // rejects on failure
  setRemark(id: string, team: Team, body: string): Promise<void>                    // rejects on failure
}
```

Behaviour:
- Cache one `MatState` per package in IndexedDB database `kw-mat`, store `packages`, key = package. If IndexedDB is unavailable the module still works without a cache.
- `refresh`: with a cache, call `fetchPackage(pkg, syncedAt, week === currentWeek ? syncedAt : null)` and merge by id; without one, call with nulls. `syncedAt` becomes the server's `now`. When the server's `week` differs from the cached one, drop cached remarks older than `week − 7`.
- `setCell` and `setRemark` update state at once, then save. On failure the state returns to its previous value for that cell only and the promise rejects.
- If `saveRemark` returns a `week` different from `state.week`, call `refresh()` (Review Focus 1).
- Auto refresh on mount, and when the document becomes visible after more than 5 minutes hidden. No timers.

- [ ] **Step 1: Write the failing tests**: first load calls `fetchPackage('bp03', null, null)`; second mount calls it with the cached `syncedAt` and merges one changed item; `setCell` is visible before the save resolves; a rejected `saveCell` restores the old value and rejects; `saveRemark` returning another week triggers a second `fetchPackage` with `remarksSince` null; a week change drops remarks older than last week.
- [ ] **Step 2:** Run `corepack pnpm test src/mat/store.test.ts`. Expected: fails.
- [ ] **Step 3: Implement** `api.ts` and `store.ts`.
- [ ] **Step 4:** Run the tests and `corepack pnpm typecheck`. Expected: pass.
- [ ] **Step 5: Commit** `feat(mat): package loading, cache and saves`.

---

### Task 5: Page and material table

**Files:**
- Create: `src/mat/MaterialTracker.tsx`, `src/mat/MatTable.tsx`, `src/mat/mat.css`
- Modify: `src/App.tsx` (add `const MaterialTracker = lazy(() => import('@/mat/MaterialTracker'))` and `<Route path="admin" element={<MaterialTracker />} />` before the `*` route; move the `*` route's element into a small exported `NotFound` component so both use it)
- Test: `src/mat/MaterialTracker.test.tsx`

**Interfaces:**
- Consumes: `useMat`, `remarkKey`, `fetchAccess` (Task 4); `effective`, `isOverride`, `parseInput`, `average`, `formatCell` (Task 2); `weekLabel`, `addDays` from `src/nbc/submissions.ts`.
- Produces: default export `MaterialTracker`; `MatTable({ items, state, onCell, onRemark }: …)`.

Behaviour:
- On mount call `fetchAccess()`. While pending show the standard skeleton. If false or it throws, render `NotFound` and call nothing else.
- Below 768 px (`usePhone` from `src/shell/usePhone.ts`) show one line: "Open the material list on a tablet or computer."
- Header: title "Material list", `Week ${weekLabel(state.week)}`, save status text (`Saving…`, `Saved`, `Could not save`), Refresh button.
- Tabs: package (`BP03`, `BP04`), then sheet (`ID Material`, `MEP Material`, `Summary`, and `Change Log` for BP03 or `Review` for BP04). Selection lives in the query string (`?p=bp04&s=mep`). Summary and notes tabs render a placeholder until Task 6.
- Toolbar: search over code and description; filters for Person In Charge, Status and Mark built from the values present.
- Table columns in this order: No, Code, Description (these three frozen); Person In Charge, BP02 Mat Approval, Location, Image, Approved Sample, Specification, Brand, Source Location; Material Submission ×4; Sample Submission ×3; Procurement ×5 including its Remarks; Quantity: Unit + 5; PM Remarks: Last week, This week; Purchase Remarks: Last week, This week; Percentage ×6; Last Updated. Two header rows with the group bands.
- Section rows collapse and show `average` of each percentage cell over their items. A first row shows the sheet average.
- Row `mark` tints the frozen cells (done, tracking, omit) with a legend in the toolbar.
- Editable cells: the five quantity cells, six percentage cells, and the two "This week" remark cells. "Last week" is plain text. Quantity and percentage inputs commit on Enter or blur through `parseInput`; Escape cancels. An override shows a marker and a "Use formula" button that calls `onCell(id, cell, null)`. Remarks use a textarea that commits on blur or Ctrl+Enter, limit 2,000 characters.
- A failed save keeps the typed text in the cell, marks it with `aria-invalid` and shows a Retry button for that cell (Review Focus 3).
- Pictures: `<img loading="lazy" src={`/mat/${name}`}>` thumbnails; click opens the same file in a dialog.
- Rows are `memo`ised on the item object and its three remark strings. Every input has an accessible name (`"<code> <column>"`).

- [ ] **Step 1: Write the failing tests** with `./api` mocked: access false renders "Not found" and `fetchPackage` is never called (Review Focus 4); access true renders a made-up item with its last-week remark as text and this-week remark in a textbox; typing a remark and blurring calls `saveRemark(id, 'pm', text)`; typing `50` in Placed Order calls `saveCell(id, 'placed', 0.5)` and the Not Yet PO cell shows `50%`; "Use formula" calls `saveCell(id, 'placed', null)`; a rejected `saveCell` leaves the typed text, sets `aria-invalid` and shows Retry; the header shows the week label for `state.week`.
- [ ] **Step 2:** Run `corepack pnpm test src/mat/MaterialTracker.test.tsx`. Expected: fails.
- [ ] **Step 3: Implement** the page, table and CSS. Load the `impeccable` skill for the visual pass; stay inside `--pp-*` tokens and the frozen-column pattern of `src/nbc/ui/WbsTable.tsx`.
- [ ] **Step 4:** Run `corepack pnpm test`, `corepack pnpm lint`, `corepack pnpm typecheck`. Expected: all pass, including the existing navigation tests for the Not found page.
- [ ] **Step 5: Commit** `feat(mat): hidden /admin material list page`.

---

### Task 6: Summary and notes tabs, decision record

**Files:**
- Create: `src/mat/MatSummary.tsx`, `src/mat/MatNotes.tsx`
- Modify: `src/mat/MaterialTracker.tsx` (replace the placeholders), `docs/DECISIONS.md` (add D-37)
- Test: `src/mat/MatSummary.test.tsx`

**Interfaces — Consumes:** `MatState`, `average`, `formatCell`.

- `MatSummary({ items })`: two blocks, ID Material and MEP Material. Each has one row for the sheet and one per section: Description, number of items with a numeric Placed Order value, then the six percentage averages. Same figures as the table's section rows.
- `MatNotes({ items })`: a plain read-only table of the `note` rows of that package, first row of each block as its header.
- D-37 in `docs/DECISIONS.md`, in the style of D-36: why own tables and RPCs instead of the workspace sync, the allow-list, Sunday weeks shared with D-31, source `data` kept apart from `edits`, pictures served by Vercel outside the login, and the usage estimate from the spec.

- [ ] **Step 1: Write the failing test**: three made-up items in two sections give the expected counts and averages; a section whose items are all text shows an empty cell.
- [ ] **Step 2:** Run it. Expected: fails.
- [ ] **Step 3: Implement** both components, wire the tabs, write D-37.
- [ ] **Step 4:** Run `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`, then `graphify update .`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(mat): summary and notes tabs; record D-37`.

---

### Task 7 (Fable): Import, apply, verify

- [ ] **Step 1:** Copy both workbooks from `Downloads` into `.private/mat/`. Run `python scripts/mat-import.py` on them. Expected: exit 0, self-check clean. If it reports mismatches or unknown formulas, send the list back to the Task 2 or 3 coder; do not hand-edit the seed.
- [ ] **Step 2:** Check `public/mat/` total size is under 12 MB and note the skipped-picture list.
- [ ] **Step 3:** Run `get_advisors` and `list_tables`, then apply the migration with `apply_migration`.
- [ ] **Step 4:** Apply `.private/mat-seed.sql` in chunks with `execute_sql`.
- [ ] **Step 5:** Verify inside the database, returning one row: counts by package, sheet and kind equal the importer's printed counts; `pg_size_pretty(pg_total_relation_size('public.kw_mat_items'))` is under 3 MB.
- [ ] **Step 6:** Access check in one statement each, using `set local role authenticated` and `set local request.jwt.claims`: a listed email gets `kw_mat_access() = true` and a non-zero item count; another `@singbuild.com` email gets false, zero rows from a direct select, and an exception from `kw_mat_load`, `kw_mat_set_cell` and `kw_mat_set_remark`. Roll each back.
- [ ] **Step 7:** Week check: `select kw_private.mat_week()` returns `2026-11-15` today, and the same expression evaluated for `2026-11-21 23:59+07` and `2026-11-22 00:00+07` returns `2026-11-15` and `2026-11-22`.
- [ ] **Step 8:** Run `get_advisors` again; fix any new finding that names a `kw_mat_*` object.
- [ ] **Step 9:** Commit the thumbnails `chore(mat): material thumbnails`. Run the app locally, open `/admin` signed in as a listed account, and check one remark save, one percentage override and its "Use formula", and the Summary tab against the workbook's Summary sheet for two sections.
- [ ] **Step 10:** Request a whole-branch code review, fix findings, and report. Merging to `main` and deploying happen only when the owner says so.
