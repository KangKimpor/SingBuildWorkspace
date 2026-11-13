# Phone App Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the phone layout (below 768 px) so viewing project progress is fast and every other function is comfortable, and remove all calendar code.

**Architecture:** Below 768 px the shell renders a phone top bar and a four-tab bar, and the NBC progress screens render purpose-built phone components from `src/nbc/mobile/`. Those components call the existing data, `calculate`, `useUpdateDraft` and submission actions; desktop components are untouched apart from the one switch in `NbcProject.tsx`. Phone styles live in their own CSS files so desktop CSS is not edited except to delete dead phone rules.

**Tech Stack:** React 19, react-router-dom, zustand, plain CSS with tokens, `@tanstack/react-virtual`, Radix dialog/popover, vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-13-mobile-overhaul-design.md` — read it first.

## Global Constraints

- Phone = viewport width below 768 px. Desktop and tablet (768 px and wider) must look and behave exactly as before.
- No database changes, no migrations, no new features, no change to progress calculations, sync or exports.
- No new dependencies.
- Inputs on phone use `font-size: 16px` or larger. Respect `--safe-top` / `--safe-bottom`.
- Touch targets at least 44 × 44 px with at least 8 px between them.
- Spacing steps 8/12/16/24. Side gutter 16 px. Gap under the top bar 12 px.
- Type on phone: page title 22/28 semibold, section title 17/24, body 15/22, small 13/18.
- No horizontal page scroll at 320, 360, 390, 430 px. No vertical scroll box nested inside the page on progress screens.
- Existing URLs keep working (`?wbs=`, `?handler=`, `?location=`, the `aliases` in `NbcProject.tsx`).
- Commands: `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm test`, `corepack pnpm test:e2e --workers=1`. Always `corepack pnpm`, never bare `pnpm`.
- Before the first grep or file read for a codebase question, run `graphify query "<question>"`. After modifying code run `graphify update .`.
- Commit locally on branch `mobile-overhaul` at the end of each task (conventional commit message, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). Never push, never touch `main`.
- Do not touch Supabase. Never run database queries.
- Follow the codebase style: use existing tokens from `src/styles/tokens.css`, existing button classes (`btn-accent`, `btn-secondary`, `ibtn`), lucide icons at `strokeWidth: 1.75`.

## Review Focus

1. **Crossing 768 px mid-session** (rotating a phone, resizing): the view swaps between phone and desktop components without losing an unsaved progress draft. Test in Task 6.
2. **On-screen keyboard in Update Progress:** the focused field must not sit under the bottom bars. The tab bar hides while an input inside `.ph-update` has focus. Test in Task 6.
3. **BP02 scale (16,550 activities):** drill-down renders only the current level; search is deferred and capped at 200 results. Test in Task 4.
4. **Old data and bookmarks:** stored content with `events` / `calendarPreferences`, and `/calendar/...` URLs, load without error and land on the start screen. Test in Task 1.
5. **Deep links to something not there:** `?at=` or `?wbs=` naming an unknown or filtered-out activity shows the top level, never a blank screen. Test in Task 4.
6. **Shared room cells (`coOf`):** a cell split between two handlers appears once in the Progress view (average of halves) and each handler edits only their half in Update. Tests in Tasks 4 and 6.

---

## File Structure

New:

- `src/shell/usePhone.ts` — the one phone breakpoint.
- `src/shell/phoneHeader.ts` — store through which a screen tells the phone top bar its title, back target and actions.
- `src/shell/PhoneTopBar.tsx`, `src/shell/MoreSheet.tsx`, `src/styles/phone.css` — phone shell.
- `src/nbc/mobile/drill.ts` (+ `drill.test.ts`) — pure drill-down model.
- `src/nbc/mobile/PhoneProjects.tsx` — projects list (Progress tab).
- `src/nbc/mobile/PhoneProject.tsx` — project frame: header registration, segmented control, view switch.
- `src/nbc/mobile/PhoneProgress.tsx`, `ActivitySheet.tsx` — drill-down view.
- `src/nbc/mobile/PhoneUpdate.tsx`, `updateList.ts` (+ test) — handler picker and editor list.
- `src/nbc/mobile/Collapsible.tsx` — collapsed section used by Overview on phone.
- `src/nbc/mobile/mobile.css` — all NBC phone styles.
- `e2e/phone.spec.ts` — phone journeys.

Modified: `src/shell/store.ts`, `AppShell.tsx`, `TabBar.tsx`, `TopBar.tsx`, `src/styles/shell.css`, `src/App.tsx`, `src/pages/Projects.tsx`, `src/nbc/NbcProject.tsx`, `src/nbc/overview/Overview.tsx`, `src/pages/Tasks.tsx`, `e2e/mobile-spacing.spec.ts`, plus the calendar deletions in Task 1.

---

### Task 1: Remove the calendar

**Files:**
- Delete: `src/pages/Calendar.tsx`, `src/styles/calendar.css`, `src/calendar/layout.ts`, `src/calendar/recurrence.ts`, `src/test/calendar.test.ts`, `src/test/recurrence.test.ts`, `e2e/calendar-interactions.spec.ts`
- Move: what tasks still need from `src/calendar/time.ts` and `src/calendar/reminders.ts` → `src/lib/time.ts`, `src/lib/reminders.ts` (task reminders only); then delete `src/calendar/`
- Modify: `src/App.tsx`, `src/lib/prefetch.ts`, `src/shell/routes.ts`, `src/shell/AppShell.tsx`, `src/shell/WorkspaceOverlays.tsx`, `src/shell/workspace.ts`, `src/components/QuickAdd.tsx`, `src/components/Reminders.tsx`, `src/data/types.ts`, `src/data/index.ts`, `src/data/persistence.ts`, `src/data/sync.ts`, `src/data/seed.ts`, `src/styles/workspace.css`, `src/pages/workspace-views.css`, `src/pages/Tasks.tsx`, `scripts/figma-screens.mjs`, `scripts/screenshots.mjs`, `index.html`, `docs/UI-CONTRACT.md`, and every test/e2e file that references calendar or events
- Test: `src/test/workspace.test.ts`

**Interfaces:**
- Produces: no `CalendarEvent`, `events`, `saveEvent`, `calendarPreferences`, `setCalendarPreferences`, `openEvent`, `eventId`, `eventPatch` anywhere in `src`. `dueReminders(tasks: Task[], now: Date)` in `src/lib/reminders.ts` covers tasks only.

- [ ] **Step 1: Write the failing tests** in `src/test/workspace.test.ts`:
  - `'ignores retired calendar data in stored content'`: seed `localStorage['kw-workspace-v1']` with a valid content object that also has `events: [{ id: 'e1', title: 'Old' }]` and `calendarPreferences: { weekStart: 1, hour12: false }`; load the store the way the neighbouring tests do; assert it loads without throwing, tasks and pages are intact, and `'events' in useWorkspace.getState()` is `false`.
  - `'no calendar route'`: render the app at `/calendar/day/today` (see `src/test/workspace-refresh.test.tsx` for the render helper) and assert the location ends at the workspace start path, not at `/calendar`.
- [ ] **Step 2: Run** `corepack pnpm test src/test/workspace.test.ts` — expect the two new tests to FAIL.
- [ ] **Step 3: Delete and unwire.** Remove the route and lazy import; add `<Route path="calendar/*" element={<Navigate to="/" replace />} />`. Remove the event editor, event search results and the `CalendarDays` command from `WorkspaceOverlays.tsx`; the "New event" button and `hasReminders` event clause from `AppShell.tsx`; the event option from `QuickAdd.tsx`. Remove the `events` collection from store, persistence and sync so it is neither read, written nor uploaded; unknown keys in stored or remote content are dropped silently. Remove calendar CSS and the `--calendar-*` tokens. Keep task due dates, task reminders and the lucide `CalendarDays` icon where it decorates a due date.
- [ ] **Step 4: Run** `git grep -inE "calendar|CalendarEvent|saveEvent|openEvent" -- src e2e scripts index.html` — expect only: lucide `CalendarDays` icon uses, the `calendar/*` redirect, the two tests above, and the comment in `src/nbc/plan.ts`.
- [ ] **Step 5: Run** `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test` — expect PASS.

---

### Task 2: Phone shell

**Files:**
- Create: `src/shell/usePhone.ts`, `src/shell/phoneHeader.ts`, `src/shell/PhoneTopBar.tsx`, `src/shell/MoreSheet.tsx`, `src/styles/phone.css`
- Modify: `src/shell/store.ts`, `src/shell/AppShell.tsx`, `src/shell/TabBar.tsx`, `src/styles/shell.css`, `src/pages/Tasks.tsx` (header "+" only)
- Test: `src/shell/phoneHeader.test.tsx`, `e2e/phone.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // usePhone.ts
  export const PHONE_QUERY = '(max-width: 767px)'
  export function usePhone(): boolean            // matchMedia, live
  // store.ts
  breakpointFor(width): 'compact' when width < 768 (was 640); 'medium' 768–1023
  type SheetKind = 'quick-add' | 'more' | null
  // phoneHeader.ts
  export interface PhoneHeader { title: string; back?: string; actions?: ReactNode; search?: { value: string; onChange: (v: string) => void; placeholder: string } }
  export function usePhoneHeader(header: PhoneHeader): void   // registers while mounted, clears on unmount
  export const usePhoneHeaderState: () => PhoneHeader | null
  ```
- `PhoneTopBar`: 48 px + `--safe-top`, sticky at top. Left: back arrow link to `header.back` when set. Centre: `header.title` (fallback: the crumb label), one line, ellipsis, 17/24 semibold. Right: `header.actions`, a search icon when `header.search` is set (tapping swaps the bar for a full-width field with a close button), and the sync state as a 44 px icon button whose popover shows the existing text. `data-testid="sync-pill"` stays on the sync control.
- `TabBar`: four `NavLink` tabs with icon + label — Progress (`/projects-progress`), Tasks (`/tasks`), Search (`/search`), More (button, opens `MoreSheet`). No centre "+". Hidden (`display: none`) while `document.activeElement` is an input, textarea or contenteditable (class `shell[data-typing]`, set by a `focusin`/`focusout` listener in `AppShell`).
- `MoreSheet`: `BottomSheet` listing Projects (`/projects`), Pages (first page or `/search`), Trash (`/trash`), Settings (`/settings/account`), each a 52 px row with icon.
- On phone `AppShell` renders `PhoneTopBar` instead of `TopBar`, never renders the drawer `SideSheet`, and `Tasks` gets a "+" `ibtn` in its header that calls `setSheet('quick-add')`.
- `phone.css` (imported by `AppShell`, every rule inside `@media (max-width: 767px)`): `.canvas` gutters and gaps from Global Constraints, the type scale on `.t-title`, `h1`, `h2`, bottom padding of `64px + var(--safe-bottom)` for the tab bar, and Radix dialog/popover content restyled as bottom sheets (full width, top radius 16 px, max-height 90dvh, drag handle).

- [ ] **Step 1: Write the failing tests.**
  - `src/shell/phoneHeader.test.tsx`: `'registers and clears'` — render a component calling `usePhoneHeader({ title: 'A', back: '/x' })`; assert `usePhoneHeaderState()` returns that object; unmount; assert `null`. `'latest wins'` — two mounted components, the later-mounted title is returned; unmounting it restores the first.
  - `e2e/phone.spec.ts` (new file; `test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })`, import `test`/`expect` from `./workspace-test`): `'tab bar has four tabs and no quick-add button'` — at `/tasks`, `getByTestId('tabbar').getByRole('link')` has count 3 with names Progress, Tasks, Search; a button named More exists; no element `.tab-add`. `'More opens the sheet and reaches Settings'` — tap More, tap Settings, URL is `/settings/account`. `'no drawer toggle on phone'` — `.sidebar-toggle` count 0. `'tab bar hides while typing'` — focus the Tasks search input, `tabbar` is hidden; blur, it is visible.
- [ ] **Step 2: Run** `corepack pnpm test src/shell/phoneHeader.test.tsx` — FAIL (module missing).
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run** `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test` — PASS. Update any existing unit test that asserts the 640 breakpoint to 768.
- [ ] **Step 5: Run** `corepack pnpm test:e2e --workers=1 e2e/phone.spec.ts --project=chromium` — PASS.

---

### Task 3: Projects list and project frame

**Files:**
- Create: `src/nbc/mobile/PhoneProjects.tsx`, `src/nbc/mobile/PhoneProject.tsx`, `src/nbc/mobile/mobile.css`
- Modify: `src/pages/Projects.tsx` (the `progressSection && !id` branch), `src/nbc/NbcProject.tsx`, `src/shell/landing.ts`
- Test: `src/nbc/mobile/PhoneProjects.test.tsx`, `e2e/phone.spec.ts`

**Interfaces:**
- Consumes: `usePhone`, `usePhoneHeader` (Task 2).
- Produces:
  ```ts
  // PhoneProjects.tsx
  export default function PhoneProjects(): JSX.Element
  export const shortName = (name: string) => string   // "NBC BP02 – Pan Pacific Hotel" → "NBC BP02"
  // PhoneProject.tsx
  export interface PhoneProjectProps { project: ProjectSummary; view: 'overview' | 'activities' | 'update'; weekText: string; onExport?: () => void; children: ReactNode }
  export function PhoneProject(props: PhoneProjectProps): JSX.Element
  ```
- `PhoneProjects`: header title "Progress". One card per active `nbcBp03` project sorted by BP number: logo tile 40 px, `shortName`, the rest of the name as the client line, overall % (22 px, tabular) right-aligned, a 4 px bar, and a status line built from `projectPlan`/`plannedProgress` ("18.61% behind plan" / "On plan" / "No plan") plus the weekly deadline text from `deadlineNote`. The whole card is a `Link` to `/projects-progress/:id/overview`. Overall comes from the same value the sidebar shows (see `SidebarContent.tsx`); do not run `calculate` over every project on each render — memoize per project.
- `Projects.tsx`: when `usePhone()` is true and `progressSection && !id`, render `PhoneProjects` instead of the redirect. `workspaceStart` in `landing.ts` gains a third parameter `phone: boolean` and returns `/projects-progress` when it is true.
- `PhoneProject`: calls `usePhoneHeader({ title: shortName(project.name), back: '/projects-progress', actions })` where `actions` is a "⋯" menu containing "Export XLSX" (calls `onExport`). Renders a sticky segmented control (`nav.ph-seg`, `aria-label="Project views"`, links Overview · Progress · Update, `aria-current="page"` on the active one, sticky at `top: calc(48px + var(--safe-top))`), then `weekText` as one small muted line, then `children`.
- `NbcProject.tsx`: when `usePhone()`, wrap the view in `PhoneProject` instead of rendering `.nbc-project-header` and `.nbc-tabs`. Views themselves are swapped in Tasks 4–6; until then the existing components render inside the phone frame.

- [ ] **Step 1: Write the failing tests.**
  - `PhoneProjects.test.tsx`: `'shortName'` — `'NBC BP02 – Pan Pacific Hotel'` → `'NBC BP02'`, `'Website'` → `'Website'`. `'lists progress projects with their percent'` — store with `fixtureProject` + `fixtureActivities()` from `src/nbc/test-fixture.ts`; render in a `MemoryRouter`; a link named like `/NBC BP03/` points at `/projects-progress/nbc-bp03/overview` and contains a `%` figure.
  - `e2e/phone.spec.ts`: `'Progress tab lists projects and opens one'` — seed as `e2e/nbc.spec.ts` `setup()` does; go to `/`; expect URL `/projects-progress` and a card for the fixture project; tap it; expect the segmented control with Overview current; expect no `.nbc-project-header`; tap the top-bar back arrow; expect `/projects-progress`.
- [ ] **Step 2: Run** the unit test — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test` — PASS.
- [ ] **Step 5: Run** the phone e2e — PASS.

---

### Task 4: Progress view (drill-down)

**Files:**
- Create: `src/nbc/mobile/drill.ts`, `src/nbc/mobile/drill.test.ts`, `src/nbc/mobile/PhoneProgress.tsx`, `src/nbc/mobile/ActivitySheet.tsx`
- Modify: `src/nbc/NbcProject.tsx`, `src/nbc/mobile/mobile.css`
- Test: `src/nbc/mobile/drill.test.ts`, `src/nbc/mobile/PhoneProgress.test.tsx`, `e2e/phone.spec.ts`

**Interfaces:**
- Consumes: `calculate` (`src/nbc/progress.ts`) result `{ byId, children, progress }`; `activityHandlers` (`src/nbc/handlers.ts`); `percent` (`src/nbc/format.ts`); `usePhoneHeader`.
- Produces:
  ```ts
  // drill.ts
  type Calculation = ReturnType<typeof calculate>
  export interface DrillRow { activity: NbcActivity; group: boolean; leafCount: number; progress: number; previous: number }
  export interface DrillOptions { live: Calculation; before?: Calculation; leaf?: (a: NbcActivity) => boolean }
  /** Children of `parentId` (null = top level) in `order`, keeping only rows that hold at least one leaf passing `leaf`. A `coOf` half is merged into its first half: one row, progress and previous = mean of the halves. */
  export function drillRows(parentId: string | null, options: DrillOptions): DrillRow[]
  /** Ancestors of `id` from the top level down to `id` itself; [] for null or unknown ids. */
  export function drillTrail(byId: ReadonlyMap<string, NbcActivity>, id: string | null): NbcActivity[]
  /** Leaves whose own or any ancestor's "wbs name description" contains `query` (case-insensitive), first `limit` in workbook order. */
  export function drillSearch(query: string, options: DrillOptions, limit?: number /* 200 */): DrillRow[]
  // PhoneProgress.tsx
  export default function PhoneProgress(props: { projectId: string; activities: NbcActivity[]; rollups: { live: Calculation; before?: Calculation } }): JSX.Element
  ```
- `PhoneProgress` behaviour: current level is the `at` search param (an activity id; absent = top level; unknown id = top level). Tapping a group row sets `at` with a normal history push so the phone's back gesture goes up one level. A sideways-scrolling trail (`nav[aria-label="Path"]`): "All" then each `drillTrail` name, last one not a link. Each row (`li.ph-row`, min-height 64 px): name (2-line clamp), small line "`wbs` · `leafCount` activities" for groups or "`wbs` · handler" for leaves, right side this-week `percent(progress)` with a chevron for groups, a 4 px bar, and a `+x.x` / `−x.x` chip when `|progress − previous| > 1e-12`. Tapping a leaf opens `ActivitySheet` (bottom sheet: name, path, Previous week %, This week %, Handler, Remark). Header search (`usePhoneHeader({ search })`) switches the list to `drillSearch` results (deferred with `useDeferredValue`), each showing its path as the small line; "200+ matches, keep typing" when capped. A Filter button with a count badge opens a bottom sheet: Handler (`GlassSelect`, options from `projectHandlers`) and a "Changed this week" switch; both write `?handler=` / `?changed=1`. `?wbs=<code>` opens at that activity's parent with its sheet open. `?location=` is honoured through `activityTags` exactly as `Activities.tsx` does. No virtualization: a level never exceeds a few dozen rows and search is capped.
- `NbcProject.tsx`: on phone, view `activities` renders `PhoneProgress` (lazy import) instead of `Activities`.

- [ ] **Step 1: Write the failing tests** in `drill.test.ts` using `fixtureActivities()`:
  - `'top level returns the roots in order with rolled-up progress'` — `drillRows(null, { live })` ids equal the `parentId === null` activities sorted by `order`; each `progress` equals `live.progress.get(id)`.
  - `'a group row counts its leaves'` — `leafCount` equals the number of `editable` descendants.
  - `'leaf filter prunes empty branches'` — with `leaf: a => a.handler === 'Tola'`, every returned row has at least one Tola leaf beneath it or is one.
  - `'previous comes from before'` — with `before = calculate(activities, baselineMap)` where one leaf is lowered by 0.25, that leaf's row has `progress − previous === 0.25`.
  - `'trail'` — `drillTrail(byId, leafId).map(a => a.wbs)` is each successively longer ancestor code ending in the leaf's; `drillTrail(byId, 'nope')` is `[]`.
  - `'shared cell appears once'` — build three activities: task T (not editable), halves H1 `{ room: 'R1', progress: 1 }` and H2 `{ room: 'R1', coOf: H1.id, progress: 0 }` under T; `drillRows(T.id, …)` has length 1 with `progress === 0.5`.
  - `'search matches ancestors and caps'` — a query equal to a group name returns its leaves; with 500 synthetic matching leaves and `limit` default, length is 200.
  - `'16,550 activities'` — synthetic tree of 16,550 activities; `drillRows(null, …)` and `drillSearch('install', …)` each finish in under 50 ms after `calculate` has run.
- [ ] **Step 2: Run** `corepack pnpm test src/nbc/mobile/drill.test.ts` — FAIL.
- [ ] **Step 3: Implement `drill.ts`.** Build the leaf-count and has-matching-leaf maps once per `(live, leaf)` with a `WeakMap` cache keyed on `live` so repeated calls while drilling are O(children).
- [ ] **Step 4: Run** the drill tests — PASS.
- [ ] **Step 5: Write the failing component test** `PhoneProgress.test.tsx`: `'drills from top level to an activity'` — render at `/projects-progress/nbc-bp03/activities`; every row shows a `%`; click the first group; the trail shows its name; click through to a leaf; a dialog shows "Previous week %" and "This week %". `'unknown at shows the top level'` — render with `?at=nope`; the top-level rows are listed.
- [ ] **Step 6: Implement `PhoneProgress.tsx`, `ActivitySheet.tsx`, styles, and the switch in `NbcProject.tsx`.**
- [ ] **Step 7: Run** `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test` — PASS.
- [ ] **Step 8: Add to `e2e/phone.spec.ts`** `'view progress down to one activity'` — open the fixture project, tap Progress, assert no element inside `main` has `scrollHeight > clientHeight` with `overflow-y` auto/scroll, drill to a leaf, sheet shows its percent; `page.goBack()` twice returns up two levels. Run it — PASS.

---

### Task 5: Overview on phone

**Files:**
- Create: `src/nbc/mobile/Collapsible.tsx`
- Modify: `src/nbc/overview/Overview.tsx`, `src/nbc/overview/Breakdown.tsx`, `src/nbc/mobile/mobile.css`
- Test: `src/nbc/overview/Overview.test.tsx`, `e2e/phone.spec.ts`

**Interfaces:**
- Consumes: `usePhone`.
- Produces: `export function Collapsible(props: { title: string; summary: string; defaultOpen?: boolean; children: ReactNode }): JSX.Element` — a `section` with a 52 px button header (`aria-expanded`), title left, `summary` muted on the right, chevron; children mounted only when open.
- `Overview.tsx` on phone: no `.nbc-ov-head`; KPI grid 2×2 with tiles of 12 px padding, label 13 px, value 20 px semibold, one-line note; then `Attention`; then three `Collapsible`s, all closed by default: "Progress curve" (summary: overall %), "Handler contributions" (summary: "`updated` of `active` updated"), "Completion breakdown" (summary: the name of the furthest-behind row). `Breakdown` takes an optional `limit?: number`; on phone it is 5 with a "Show all `n`" button that removes the limit. Desktop output is unchanged — keep the existing `Overview.test.tsx` assertions passing untouched.

- [ ] **Step 1: Write the failing tests** in `Overview.test.tsx` under a `describe('phone')` that stubs `matchMedia` to match `(max-width: 767px)`: `'shows KPIs and attention, sections collapsed'` — the four KPI labels are present; buttons "Progress curve", "Handler contributions", "Completion breakdown" have `aria-expanded="false"`; the handler table is not in the document. `'breakdown shows five then all'` — expand Completion breakdown; 5 rows; click "Show all"; more than 5 when the fixture has them.
- [ ] **Step 2: Run** `corepack pnpm test src/nbc/overview/Overview.test.tsx` — the phone tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test` — PASS.
- [ ] **Step 5: Add to `e2e/phone.spec.ts`** `'overview fits: KPIs and attention on the first screen'` — the four KPI tiles and the "Needs attention" heading are in the viewport without scrolling at 390×844; page height is under 1,700 px with sections collapsed. Run — PASS.

---

### Task 6: Update Progress on phone

**Files:**
- Create: `src/nbc/mobile/updateList.ts`, `src/nbc/mobile/updateList.test.ts`, `src/nbc/mobile/PhoneUpdate.tsx`
- Modify: `src/nbc/NbcProject.tsx`, `src/nbc/update/UpdateProgress.tsx` (export what the phone view needs), `src/nbc/update/HandlerGate.tsx` (phone styles only, via `mobile.css`), `src/nbc/mobile/mobile.css`
- Test: `src/nbc/mobile/updateList.test.ts`, `src/nbc/mobile/PhoneUpdate.test.tsx`, `e2e/phone.spec.ts`

**Interfaces:**
- Consumes: `useUpdateDraft` (returns `confirmed, rows, shown, changed, lowered, contribution, invalid, touched, status, error, busy, text(id), remark(id), setText(id, text), setRemark(id, remark), note, setNote, confirm, edit, remove`), `canUpdate`, `weekLabel`, `submissionId`, `weekStart` (`src/nbc/submissions.ts`), `deadlineNote`, `useNow`, `ConfirmSheet`, `HandlerGate`, `handlerComplete`, `usePhoneHeader`.
- Produces:
  ```ts
  // updateList.ts
  export type UpdateFilter = 'need' | 'chg' | 'all'
  export type UpdateItem =
    | { kind: 'heading'; id: string; path: string }                       // "Level 18 › Guest Room ST1 › Wall Finishes"
    | { kind: 'activity'; id: string; activity: NbcActivity; label: string } // label = room label for room leaves, else activity name
  export interface UpdateListInput { activities: NbcActivity[]; handler: Handler; shown: SubmissionEntry[]; changed: ReadonlySet<string>; problems: ReadonlySet<string>; touched: ReadonlySet<string>; filter: UpdateFilter; query: string; floorId?: string }
  /** Flat, ordered list for the phone editor: a heading before each run of leaves that share a parent path. Same visibility rule as UpdateEditor's `visible`. */
  export function updateItems(input: UpdateListInput): UpdateItem[]
  export function updateCounts(shown: SubmissionEntry[], changedCount: number): Record<UpdateFilter, number>
  // PhoneUpdate.tsx
  export default function PhoneUpdate(props: { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[] }): JSX.Element
  ```
- Visibility rule (copy exactly from `UpdateEditor.tsx`): hidden if the leaf has no `shown` entry or the handler cannot update it (`canUpdate`); hidden if `query` does not match the leaf or an ancestor; `all` shows the rest; `chg` shows changed or problem rows; `need` shows rows where not (`previous === 1 && progress === 1`), or problem, or touched.
- `PhoneUpdate` behaviour: without `?handler=` render `HandlerGate` (styled on phone as 56 px list rows so all handlers fit one screen). With a handler: header title "`handler` · Update", header search bound to `query`. Sticky block under the segmented control: one line "`handler` ▾" (button, clears the handler) and the deadline text; then the Needs update / Changed / All control with counts. For room projects a sideways-scrolling floor chip row sets `floorId` (default: first floor with unfinished work for this handler). The list is `updateItems(...)` rendered with `useWindowVirtualizer` (estimate 96 px, measured). Heading rows are 13 px muted text, sticky under the filter block. Activity card: label (15/22, 2-line clamp), "was `percent(previous)`", a numeric input (`inputMode="decimal"`, 56 px wide minimum, 44 px tall, 18 px text, `aria-label="This week % for <wbs>"`) followed by "%", a `+x` chip when changed, "Enter 0 to 100" hint when invalid after a confirm attempt, and "+ Remark" which opens a text input (16 px). Enter moves focus to the next card's input. Bottom bar `div.ph-update-bar` sticky at `bottom: calc(64px + var(--safe-bottom))` (or `var(--safe-bottom)` while the tab bar is hidden): status icon + short text, "`n` changed · `±x.xx`% overall", and the Confirm button (same labels as desktop: "Confirm update" / "Confirm, no changes"; confirmed state shows "Edit" and the delete menu). Confirm opens the existing `ConfirmSheet`. A handler whose work is complete shows the existing "is complete" message.
- The draft must survive a swap between phone and desktop: `useUpdateDraft` already journals edits per `(scope, project, week, handler)`; `PhoneUpdate` must mount it with the same arguments and the same `key` composition `UpdateScreen` uses.
- `NbcProject.tsx`: on phone, view `update` renders `PhoneUpdate` (lazy).

- [ ] **Step 1: Write the failing tests** in `updateList.test.ts` with `fixtureActivities()` and handler `'Tola'`:
  - `'need hides finished rows'` — an entry with `previous: 1, progress: 1` is absent under `need`, present under `all`.
  - `'touched rows stay under need'` — the same finished entry with its id in `touched` is present.
  - `'chg shows changed and problems only'`.
  - `'headings precede their leaves and are not repeated'` — no two consecutive headings; every activity item is preceded (somewhere before the next heading) by a heading whose `path` joins its ancestors' names with ` › `.
  - `'query matches an ancestor name'`.
  - `'other handlers' leaves never appear'`.
  - `'shared cell: each handler sees only their half'` — with H1 handler Tola and H2 (`coOf: H1.id`) handler Sitha, Tola's list contains H1 not H2, Sitha's contains H2 not H1.
  - `'counts'` — `updateCounts` returns `need` = entries with `previous < 1`, `chg` = `changedCount`, `all` = `shown.length`.
- [ ] **Step 2: Run** `corepack pnpm test src/nbc/mobile/updateList.test.ts` — FAIL.
- [ ] **Step 3: Implement `updateList.ts`.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Write the failing component test** `PhoneUpdate.test.tsx` (model the store setup on `src/nbc/update/UpdateProgress.test.tsx`): `'pick handler, change a value, confirm'` — render at `…/update`; click Tola; type `50` into "This week % for 1.6.1.2"; the bar reads "1 changed"; click "Confirm update"; the confirm dialog lists that activity. `'draft survives a remount'` — type a value, unmount, render the desktop `UpdateProgress` with the same props and `?handler=Tola`; the same input shows the typed value.
- [ ] **Step 6: Implement `PhoneUpdate.tsx`, styles and the switch.**
- [ ] **Step 7: Run** `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test` — PASS.
- [ ] **Step 8: Add to `e2e/phone.spec.ts`:** `'update a value and confirm on a phone'` (same journey in the browser, asserting at least three activity cards are in the viewport at 390×844 and nothing inside `main` scrolls vertically on its own); `'focused field is not covered'` — focus the last visible input; `tabbar` is hidden; the input's bounding box bottom is above the top of `.ph-update-bar`. Run — PASS.

---

### Task 7: Tasks and the remaining screens

**Files:**
- Modify: `src/pages/Tasks.tsx`, `src/pages/Projects.tsx`, `src/pages/PageEditor.tsx`, `src/pages/Trash.tsx`, `src/pages/Settings.tsx`, `src/shell/WorkspaceOverlays.tsx` (`SearchPage`), `src/components/AuthGate.tsx`, `src/components/ProjectBoard.tsx`, `src/components/TaskTable.tsx`, `src/components/QuickAdd.tsx`, `src/styles/phone.css`, and the per-screen CSS files only to delete phone rules that `phone.css` replaces
- Test: `e2e/mobile-spacing.spec.ts`, `e2e/phone.spec.ts`

**Interfaces:**
- Consumes: `usePhone`, `usePhoneHeader`, `BottomSheet` (`src/shell/Overlays.tsx`).

- [ ] **Step 1: Rewrite `e2e/mobile-spacing.spec.ts`** for widths 320, 390, 430 and routes `/projects-progress`, `/projects-progress/nbc-bp03/overview`, `…/activities`, `…/update?handler=Tola`, `/projects`, `/projects/website/table`, `/projects/website/board`, `/tasks`, `/settings/account`, `/p/weekly-plan`, `/search`, `/trash` (seed the NBC fixture as `e2e/nbc.spec.ts` does). For each: content left and right inset is 16 px; gap between the phone top bar and the first content is 12 px; `document.documentElement.scrollWidth <= innerWidth`; every visible `button, a, input, select, [role=button]` inside `main` and the tab bar is at least 44 px in one dimension and 32 px in the other; no visible input has computed `font-size` under 16 px; top bar `y === 0` with `--safe-top` at 0 and at 59. Screenshot each route at 390 into `test-results/phone-<route>.png`.
- [ ] **Step 2: Run** `corepack pnpm test:e2e --workers=1 e2e/mobile-spacing.spec.ts --project=chromium` — expect failures listing the offending routes.
- [ ] **Step 3: Tasks screen.** On phone: `usePhoneHeader({ title: 'My tasks', actions: <+ button>, search })`; remove the page `h1`, the blurb, the big "New task" button and the inline search; keep the All / Project tasks / Personal tabs; replace the four selects and Saved views with one "Filter" button (count badge = number of non-default filters) that opens a `BottomSheet` containing them; a group with no tasks renders as one 44 px muted line ("Overdue · none") instead of a card.
- [ ] **Step 4: Remaining screens.** Each registers its title with `usePhoneHeader` and drops its own large heading on phone. Project table: sideways scroll inside its own area with the first column sticky. Project board: columns scroll sideways with snap, one column ≈ 86% of the width. Search page: the field is focused on open, results are 56 px rows. Settings: sections stacked, rows 52 px. Trash: rows 56 px with the restore action as an `ibtn`. Sign-in: card padding 20 px, no change in copy. Remove every `<kbd>` hint and the "Expand" full-screen and expand/collapse-all controls on phone.
- [ ] **Step 5: Run** the spacing spec until it passes at all three widths in chromium, then once with `--project=webkit`.
- [ ] **Step 6: Run** `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test` — PASS.

---

### Task 8: Clean-up and full verification

**Files:**
- Modify: `src/nbc/nbc.css`, `src/nbc/activities/activities.css`, `src/nbc/ui/ui.css`, `src/nbc/ui/room-matrix.css`, `src/nbc/update/update.css`, `src/nbc/overview/overview.css` (delete `max-width: 767px` / `639px` / `640px` rule blocks that styled the old phone layout of components no longer rendered on phone), every e2e spec that asserted the old phone layout, `docs/DECISIONS.md`, `docs/UI-CONTRACT.md`

- [ ] **Step 1: Delete dead phone CSS.** For each `@media (max-width: …)` block at or below 767 px in the files above, delete it if every selector in it targets a component that is not rendered below 768 px any more (`.nbc-activities .nbc-wbs…`, `.nbc-update…` table rules, `.nbc-project-header`, `.nbc-tabs`). Keep blocks for components still shared (`.nbc-kpi`, `HandlerGate`, `ConfirmSheet`, `Attention`).
- [ ] **Step 2: Run** `corepack pnpm build` — PASS, and `node scripts/check-budgets.mjs` if the build does not already run it — within budget.
- [ ] **Step 3: Run** `corepack pnpm test:e2e --workers=1` (both browsers). Fix specs that assert removed phone UI (`.tab-add`, the drawer on compact, the 640 breakpoint, calendar) to assert the new behaviour; do not weaken desktop assertions.
- [ ] **Step 4: Add D-35 to `docs/DECISIONS.md`** ("Phone app overhaul: dedicated phone views below 768 px; calendar removed") covering: why dedicated views instead of CSS, the 640 → 768 breakpoint change, drill-down instead of a tree, no room matrix on phone, four-tab navigation, calendar client code removed with the database left as is. Update the shell and breakpoint sections of `docs/UI-CONTRACT.md` to match.
- [ ] **Step 5: Run** `graphify update .`
- [ ] **Step 6: Run** `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test` one last time — PASS.
