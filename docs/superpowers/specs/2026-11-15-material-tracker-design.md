# Material list tracker (BP03 and BP04): design

Date: 15 November 2026. Status: approved by the owner on 15 November 2026.

## Intent

SingBuild tracks material submission and procurement for BP03 and BP04 in two Excel workbooks. The PM team and the Purchase team each write a weekly remark per material, and the stage percentages and quantities are partly calculated and partly typed. The workbooks are 65 MB and 90 MB, are passed around by hand, and last week's remarks are lost when this week's are typed over them.

The tracker moves both lists into the app. Each team gets a "Last week" and a "This week" remark per material, and the week rolls over by itself. It is in development, so only two accounts can see it, at `/admin`.

## Goals

1. Every row and every column of the `ID Material` and `MEP Material` sheets of both workbooks is in the app. The `Summary` sheet is recalculated live. The `Review` (BP04) and `Change Log` (BP03) sheets are kept as read-only lists.
2. Four remark columns per material: PM Last week, PM This week, Purchase Last week, Purchase This week.
3. When a new week starts on Sunday, what was "This week" shows as "Last week" and "This week" is blank. No remark is ever deleted; older weeks stay in the database.
4. The six Percentage columns and the five Quantity columns each follow the workbook formula unless someone types a value. Clearing a typed value returns the cell to the formula.
5. Only `kimpor.kang@singbuild.com` and `soklim.sim@singbuild.com` can open the page or read or write its data. The database enforces this, not only the page.
6. Supabase usage stays negligible against the free plan (500 MB database, 5 GB egress).

## Non-goals (this version)

- Editing columns other than the remarks, percentages and quantities (dates, status, brand and so on are shown read-only).
- Adding, deleting or reordering materials in the app.
- Exporting back to Excel.
- A phone layout. Below 768 px the page says to open it on a tablet or computer.
- Per-team edit rights. Both allowed accounts can edit both teams' remarks.
- A sidebar link. The page is reached only by typing `/admin`.

## Anti-goals

- The tracker's data must not ride on the existing workspace sync (`kw_workspace_write`, realtime, IndexedDB workspace store), because that would send it to all 14 accounts and add to everyone's egress.
- No scheduled job, cron or polling for the weekly rollover.
- No original-size pictures in Supabase or in the repository.
- A wrong formula must not silently change a number: the importer stops on a formula shape it does not know.

## Constraints

- Free Supabase plan. Database is 77 MB today. Follow the egress rules in `AGENTS.md` (name columns, compact RPC responses, no table downloads to check data).
- Sign-in is `@singbuild.com` only (`kw_before_user_created`).
- Source workbooks are private. They go in `.private/` (gitignored) and are never committed. Seed data is not committed either.
- Node 24, `corepack pnpm`, React + Vite + react-router, existing `--pp-*` tokens and table patterns. Record the decision as D-37 in `docs/DECISIONS.md`.

## What is in the workbooks

| | BP03 | BP04 |
|---|---|---|
| `ID Material` rows | 438 | 392 |
| `MEP Material` rows | 47 | 52 |
| Pictures (columns G Image, H Approved Sample) | 254 files, 70 MB | 308 files, 94 MB |
| Text and numbers | under 1 MB | under 1 MB |

Columns, the same in both packages: No, Person In Charge, BP02 Mat Approval, Material Code, Description, Location, Image, Approved Sample, Specification, Brand, Source Location; Material Submission (Plan Submit, Actual Submit, Approved Date, Status); Sample Submission (Plan Submit, Actual Submit, Approved Date); Procurement (Plan Place Order, Actual Place Order, Plan Arrived, Actual Arrived, Remarks); Quantity (Unit, Total by QS, PO by Purchase, Approved SHD, On site, Remaining); Percentage (Not Yet PO, Placed Order, Production In Progress, Waiting For Shipment, Shipping On The Way, Arrived WH & Site); Last Updated.

Rows are either section headers (for example "Wall Finishing", "ACMV SYSTEM") or materials. Many cells hold text where a date or number is expected ("TBC", "Pending", "N/A", "Excluded", "Not in the BOQ"); these are kept exactly as text. Row fill colours carry meaning (legend in W1:W3: green = completed, beige = on tracking, yellow = omitted).

The old single `PM TEAM REMARKS` column is empty in both files and is replaced by the four new columns. The Procurement `Remarks` column (about 300 entries across the four sheets) is kept as its own read-only column. BP04 MEP has three dated "UPDATED ON" columns and a clarification column, all empty; they are dropped.

### Formulas found

Blank whenever Total quantity is blank or zero, unless noted.

| Cell | Formula | Variants seen |
|---|---|---|
| Not Yet PO | 1 − Placed Order | |
| Placed Order | min(1, PO ÷ Total); 0 if PO is blank | BP04: min(1, SHD ÷ PO), blank if PO is blank |
| Production In Progress | typed value | some rows: min(1, SHD ÷ PO) |
| Waiting For Shipment | max(0, Production − Shipping − Arrived) | |
| Shipping On The Way | typed value | |
| Arrived WH & Site | min(1, On site ÷ Total) | |
| Remaining quantity | Total − On site | SHD − On site; Total − SHD |
| Section and sheet rows | average of the material rows below that have a number | |
| MEP Status | Plan Submit + 10 days | |
| Quantity cells such as `=296+8` | the result is stored, the expression is kept as a note | |

## Approaches considered

**A. Own tables, own load and save, access list in the database (chosen).** Two small tables used only by this page. The page loads a package once, keeps a local copy and afterwards fetches only rows changed since the last load. Saves send one cell. Works against every anti-goal above; costs a migration and a small data module.

**B. Add a `materials` collection to the existing workspace sync.** Least new code, and offline editing comes free. Rejected: every account would download the list on sign-in, hiding it would be a UI trick only, and it adds realtime traffic.

**C. One JSON document per sheet.** Simplest schema (four rows). Rejected: every save rewrites and re-downloads about 150 kB, and two people saving at once overwrite each other.

Chosen: A. The owner handed over the how; this is Claude's call.

## Design

### Access

- `kw_private.mat_admins(email text primary key)` seeded with the two addresses.
- `public.kw_mat_access()` returns boolean: `lower(auth.jwt()->>'email')` is in the list. `security definer`, empty `search_path`, executable by `authenticated` only.
- Row level security on both tables: select and write only when `kw_mat_access()`. Direct table writes are revoked from `authenticated`; writes go through the RPCs below.
- `/admin` calls `kw_mat_access()` once. If false, or signed out, it renders the same "Not found" page as any unknown address.
- Adding a person later is one insert into `kw_private.mat_admins`.

### Data

`public.kw_mat_items`

| Column | Notes |
|---|---|
| `id text primary key` | `bp03-id-0123`: package, sheet, source row. Stable across re-imports. |
| `package text` | `bp03` or `bp04` |
| `sheet text` | `id`, `mep`, `review`, `changelog` |
| `pos int` | display order |
| `kind text` | `section`, `item`, `note` |
| `data jsonb` | the source cells, read-only in the app. Dates as ISO strings, text kept as typed. Includes `mark` (row colour meaning), picture file names, and for each quantity and percentage cell either `{ "f": "<formula key>" }` or `{ "v": <value> }`. |
| `edits jsonb` | typed overrides, keyed by cell (`total`, `po`, `shd`, `onsite`, `remaining`, `notYetPo`, `placed`, `production`, `waiting`, `shipping`, `arrived`). Absent key = use `data`. |
| `updated_at timestamptz`, `updated_by uuid` | |

Index on `(package, updated_at)`.

`public.kw_mat_remarks`

| Column | Notes |
|---|---|
| `item_id text` references `kw_mat_items` | |
| `team text` | `pm` or `purchase` |
| `week_start date` | the Sunday that starts the week |
| `body text` | at most 2,000 characters |
| `updated_at`, `updated_by` | |

Primary key `(item_id, team, week_start)`. Index on `(week_start)`.

Keeping `data` (source) apart from `edits` (typed in the app) means a corrected workbook can be re-imported without wiping what people typed.

### Weeks and the rollover

- A week runs Sunday 00:00 to Saturday 24:00, Cambodia time (`Asia/Phnom_Penh`), the same weeks as Project Progress (D-31). The page reuses `reportingDate`, `weekStart`, `addDays` and `weekLabel` from `src/nbc/submissions.ts`.
- The server decides the week: `kw_private.mat_week()` returns the current Sunday key. The client never sends a week.
- "This week" is the remark whose `week_start` is the current Sunday key. "Last week" is the one for the Sunday before. If a team wrote nothing in a week, that week's cell is blank; older remarks are not pulled forward.
- "Last week" is read-only. "This week" is editable.
- Nothing runs on Saturday night. The first load on Sunday simply asks for the new pair of weeks.

### RPCs (all check `kw_mat_access()`, all return compact results)

- `kw_mat_load(p_package text, p_items_since timestamptz default null, p_remarks_since timestamptz default null)` returns `{ week, items: [...], remarks: [...], now }`. `items` are rows of that package with `updated_at > p_items_since` (all rows when null). `remarks` are only the current and previous week, changed since `p_remarks_since`; when the stored week differs from `week`, the client asks for remarks with null.
- `kw_mat_set_cell(p_id text, p_cell text, p_value jsonb)` sets or removes (`null`) one key in `edits`. Validates the cell name and that the value is a number, or text of at most 60 characters. Returns `updated_at` only.
- `kw_mat_set_remark(p_id text, p_team text, p_body text)` upserts the remark for the current week; an empty body is stored as an empty remark (not deleted), so later loads see the change. Returns the week and `updated_at` only.

Merging one key on the server means two people editing different cells of the same material do not overwrite each other. Two people editing the same cell: the last save wins.

### Formulas in the app

`src/mat/formulas.ts` holds the fixed set of formula keys from the table above as pure functions over a row's effective values (`edits` over `data`). Text in a number cell counts as 0 inside formulas, as Excel's `N()` does in the workbook. Section and sheet averages follow `SUBTOTAL(1, …)`: the mean of the numeric cells below.

The Summary tab is these averages per section, per sheet.

A cell that holds a typed override shows a small marker and a "Use formula" action. Formula cells show the calculated value in a quieter style so typed and calculated values can be told apart.

### Import (run once, locally)

`scripts/mat-import.py` (Python with openpyxl, same convention as `scripts/nbc-bp03-rooms-extract.py`), run against the workbooks copied into `.private/`:

1. Reads each sheet twice (formulas and cached values). Maps each formula cell to a formula key. Stops with the cell address on any formula it does not recognise.
2. Checks itself: for every formula cell, the value calculated by the mapped formula equals Excel's cached value. Prints mismatches and stops.
3. Writes `.private/mat-seed.sql` (idempotent upserts that touch `data` only, never `edits`).
4. Extracts pictures by their anchor cell (columns G and H), converts each to WebP at 480 px on the long side, names it by content hash, and writes it to `public/mat/`. WMF files (38) are converted when the machine can; any that cannot are listed and skipped. Target total: under 12 MB.

Claude applies the migration and the seed through the Supabase connection, then verifies counts and an `md5` of the keys inside the database (no rows downloaded).

### Pictures

Served by Vercel from `public/mat/`, lazy-loaded, so they use no Supabase storage or egress. Trade-off to accept: these files are not behind the login. The names are unguessable hashes and nothing lists them, but anyone holding an exact address could open that picture. The material data itself is behind the login.

### Page

`/admin`, a lazy-loaded route outside the sidebar. Code under `src/mat/`.

```
Material list                                   Week 15–21 Nov 2026 · Saved
[ BP03 | BP04 ]   [ ID Material | MEP Material | Summary | Review ]
Search…   Person ▾   Status ▾   Mark ▾                       [ Refresh ]

No  Code     Description     │ … │ QUANTITY                  │ PM REMARKS            │ PURCHASE REMARKS      │ PERCENTAGE (%)
                             │   │ Total  PO  SHD  Site  Rem │ Last week │ This week │ Last week │ This week │ NotPO Placed Prod Wait Ship Arr
▾ Wall Finishing                                                                                                42%   58%   30%  10%  5%  15%
12  WP-11    Wallpaper…      │   │ 826    400  400   0   826 │ Waiting…  │ [ type ]  │ PO sent   │ [ type ]  │ 52%   48%   …
```

- No, Code and Description stay frozen while scrolling sideways. Header bands follow the workbook groups.
- Sections collapse. Rows are memoized; no row virtualization (D-34 found it breaks frozen columns).
- Editable cells save on blur or Enter, show a saving and saved state, and keep the typed text if the save fails.
- The header shows the current week's dates so it is clear which week "This week" means.
- Loaded data is cached in IndexedDB per package (its own small store, not the workspace store). Opening the page fetches only changes. Refresh happens on open, on the Refresh button, and when the tab regains focus after more than five minutes. No realtime channel.

### Supabase budget

| Item | Estimate | Limit |
|---|---|---|
| Database | under 2 MB at import; remarks add at most about 9 MB a year if every material got both remarks every week | 500 MB (77 MB used) |
| First load per package per device | about 0.4 MB before compression | 5 GB a month |
| Later loads | a few kB (changed rows only) | |
| A save | under 1 kB | |
| Pictures | 0 (served by Vercel) | |
| Realtime, cron, functions | none | |

## Testing

- Unit: every formula key, including blank and text inputs; section averages; override then clear.
- Unit: week boundaries (Saturday 23:59 and Sunday 00:00 Cambodia time) in the SQL function and in the page's week label.
- Importer self-check (step 2 above) is the proof that app formulas match the workbooks.
- Database: as an account not on the list, select returns no rows and each RPC raises; as a listed account they work.
- Page: a component test for remark edit and rollover display with a mocked client; one e2e that `/admin` shows "Not found" for a non-listed account.
- `corepack pnpm lint`, `typecheck`, `test`, `build`; then `graphify update .`.

## Who builds what

Coding (migration, importer, `src/mat/`, tests) is done by Opus 5.5 at high effort. Fable does the design, the plan, the import run, applying the migration and seed, review and verification.

## Left to the builder

- Mapping workbook fill colours to `mark` values, using the legend cells' own fills.
- Exact column widths, sticky offsets and CSS, within the existing `--pp-*` tokens.
- IndexedDB store shape and the wording of empty and error states.
- Whether Review and Change Log share one component.

## Calls made by Claude (not decided by the owner)

1. (Decided by the owner on 15 November 2026) Weeks run Sunday to Saturday, Cambodia time.
2. Only the remarks, percentages and quantities are editable in this version.
3. Both accounts can edit both teams' remarks.
4. Pictures are shrunk and served by Vercel, outside the login.
5. A blank week stays blank; older remarks are not carried forward.
6. `kimporkang01@gmail.com` is not on the access list; only the two `@singbuild.com` addresses are.
7. No phone layout and no Excel export in this version.
