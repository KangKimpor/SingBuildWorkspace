# Phone app overhaul — design

13 November 2026. Status: awaiting approval.

## Intent

Staff open the app on their phones mostly to **look at project progress**. They must also be able to do everything else the app does (update progress, tasks, projects, pages, search, settings). Today the phone layout is the desktop tables restyled with CSS, and it is close to unusable. This work rebuilds the phone experience so viewing progress is fast and everything else is comfortable.

## What is wrong today (390 px, measured on 13 November)

- Update Progress: five rows of controls above the list; the list is a ~390 px inner scroll box with a blank top third. About one activity is visible out of 184.
- Project Progress: each row is a tall card inside another bordered box, about three per screen. Group rows show an item count and **no percentage**.
- Overview: 3,971 px tall (about five screens). The header wraps the title and the due line into a narrow column.
- Navigation: the largest control is a blue "+" that adds a personal task. Workspace and Progress tabs open the same project. The side drawer repeats the same three project views.
- Tasks: five rows of filters before any task.
- Desktop leftovers: "/" keyboard hint in search boxes, "Expand" full-screen button, expand/collapse-all buttons.
- Calendar code is still shipped although the feature was retired.

## Goals

1. Seeing a project's progress, down to one activity, takes a few taps and no sideways scrolling.
2. Every other function works on a phone with 44 px touch targets and one page scroll.
3. One consistent phone layout: same gutters, type sizes, headers, sheets.
4. All calendar code is gone.

## Non-goals

- No change to the desktop or tablet layout (768 px and wider).
- No database changes or migrations. No new features.
- No change to progress calculations, sync, or exports.

## Anti-goals

- A second copy of business logic for phones. Phone views reuse the same data, calculation and draft hooks as desktop.
- A list that scrolls inside the page (nested scroll boxes).
- Anything that makes BP02 (16,550 activities) slower on a phone.

## Constraints

- Phone means viewport width below 768 px. Today the shell switches at 640 and the NBC styles at 767; this work makes both 768 so there is no in-between layout.
- Stack stays as is: React, react-router, zustand, plain CSS with tokens, `@tanstack/react-virtual`, Radix dialog/popover. No new dependencies.
- Existing URLs keep working.
- Inputs use a 16 px font so iOS does not zoom. Safe-area insets are respected top and bottom.
- Decisions are recorded in `docs/DECISIONS.md` (AGENTS.md).

## Approaches considered

- **A. Patch the CSS.** Keep table rows restyled as cards and fix spacing in media queries. Cheapest, but it is how the app got here: a table row cannot become a good phone row, and the nested scroll box and the virtualizer's fixed row height stay.
- **B. Dedicated phone views on the same data (chosen).** Below 768 px the progress screens render purpose-built phone components that reuse the existing hooks and calculations. The shell gets a phone navigation. Desktop files are untouched apart from the switch. More code, but each screen can be designed for a phone.
- **C. A separate phone app under its own routes.** Fully independent, but links would differ by device and routing would be duplicated. Not worth it.

B was chosen by Claude; the owner handed over the how.

## Design

### 1. Shell

- **Top bar**, 48 px plus safe area: back arrow when inside a project or sub-screen, otherwise nothing on the left; page title on one line with ellipsis; sync state as a small icon (tap shows the text), not a wide pill.
- **Bottom tab bar**, four equal tabs: **Progress**, **Tasks**, **Search**, **More**. No centre "+".
  - Progress = the projects list (`/projects-progress`). On phones this route shows the list and does not auto-open the last project.
  - More = a bottom sheet with Projects (workspace boards and tables), Pages, Trash, Settings, and the account row.
- **No side drawer on phones.** Its content lives in the Progress list and the More sheet.
- Adding a task moves to a "+" button in the Tasks header. Quick add stays reachable there.
- Dialogs and popovers open as bottom sheets with a drag handle, full width, max 90% height, scrolling inside.

### 2. Projects list (Progress tab)

One card per project: logo tile, short name ("NBC BP02"), client line, overall % large on the right, a thin bar, and one status line ("18.61% behind plan · 4h left to report"). Tap opens the project.

### 3. Inside a project

- Header: top bar shows back arrow + short project name. Under it a **sticky segmented control**: Overview · Progress · Update. The big title block, logo tile and week line are removed on phones; the week and deadline appear once, as a single small line under the control.
- Export XLSX moves into a "⋯" menu in the top bar.

### 4. Progress view (the main screen)

Drill-down instead of an expanding tree, because the WBS is up to seven levels deep and indentation does not fit in 390 px.

```
‹ NBC BP02                          ⌕  ⋯
[ Overview | Progress | Update ]
All › Level 18 › Guest Room SK1            ← tappable trail, scrolls sideways
──────────────────────────────────────
Wall Finishes                    95.0%  ›
1.8.1.3.1.6 · 4 activities   ▓▓▓▓▓▓▓▓░ +2.5
──────────────────────────────────────
Floor Finishes                   80.0%  ›
1.8.1.3.1.7 · 3 activities   ▓▓▓▓▓▓░░░
```

- A row is about 64 px: name (two lines max), WBS code and count in small text, this-week % right-aligned, a thin bar, and a "+x" chip when it changed this week.
- Tapping a group opens its children. Tapping an activity opens a bottom sheet: previous %, this week %, handler, remark, WBS path.
- The page itself scrolls. Long levels are virtualized against the window.
- Search is an icon in the top bar that opens a full-width field; results are a flat list with the path under each name.
- One **Filter** button (with a count badge) opens a sheet: handler, "changed this week".
- Room projects (BP02, BP03 where applicable) use the same drill-down: floor → room type → trade → activity. The room matrix is not shown on phones.
- `?wbs=`, `?handler=` and `?location=` links open at the right level.

### 5. Overview

Order: four compact KPI tiles (2×2, about 72 px each) → Needs attention → Progress curve → Handler contributions → Completion breakdown. The last three are collapsed to a one-line summary with a chevron; Completion breakdown opens showing the five furthest behind with "Show all". Target: the first screen shows the KPIs and the start of Needs attention.

### 6. Update Progress

- Handler picker: plain list rows (name, activity count, status chip), all six visible without scrolling.
- Editor:
  - Sticky top: handler name (tap to change) and the deadline in one line; then the Needs update / Changed / All segmented control. Search is the top-bar icon.
  - The page scrolls. Activities are grouped under small sticky path headings ("Level 18 › Guest Room ST1 › Wall Finishes").
  - Each activity is one compact card: name, "was 95%", a large numeric field (decimal keypad), and "+ Remark".
  - Sticky bottom bar above the tab bar: "3 changed · 81.4% overall" and the Confirm button.
- Room projects edit through the same list (floor chips at the top to narrow), not the matrix.
- Autosave, draft, validation and confirm behaviour are unchanged; the phone view calls the existing `useUpdateDraft` and submission actions.

### 7. Tasks

Header: "My tasks" + "+" button. All / Project / Personal tabs stay. Search is the top-bar icon. All selects and Saved views move into one Filter sheet. Empty groups collapse to a single muted line.

### 8. Every other screen

Projects list, project table and board, page editor, search, trash, settings, sign-in, and all sheets get a consistency pass:

- 16 px side gutters, 12 px gap under the top bar, 8/12/16/24 spacing steps.
- Type: page title 22/28 semibold, section title 17/24, body 15/22, small 13/18.
- Touch targets at least 44 px; at least 8 px between them.
- No horizontal page scroll at 320, 360, 390 and 430 px.
- Tables that cannot become lists (project table) scroll sideways inside their own area with the first column frozen.

### 9. Calendar removal

Delete `src/pages/Calendar.tsx`, `src/styles/calendar.css`, the `calendar/:view/:date` route, the calendar crumb, prefetch entry, calendar CSS in `workspace.css` and `workspace-views.css`, the event editor in `WorkspaceOverlays.tsx`, the event option in Quick add, event search results, `calendarPreferences`, the `events` collection in the client store and sync, event seeds, and the calendar tests and e2e spec. Anything under `src/calendar` that tasks still need (date helpers, task reminders) moves to `src/lib`. A stored `events` array or `calendarPreferences` in existing local or cloud data is ignored on load, never an error. The Supabase table and its rows are left alone.

## Verification

- `corepack pnpm typecheck`, `lint`, `test`, and `test:e2e --workers=1` pass.
- `e2e/mobile-spacing.spec.ts` is rewritten for the new layout and covers 320, 390 and 430 px: gutters, no overflow, 44 px targets, no nested vertical scroll on progress screens.
- New phone e2e: open project → drill to an activity → see its %; pick handler → change a value → confirm.
- Before/after screenshots of every screen at 390 px, reviewed by Claude before hand-back.
- BP02 on a phone profile: drill-down level renders stay under the existing `perf:bp02` budget.

## Left to the builder

Component and file names, exact CSS, animation details, whether the phone views live in `src/nbc/mobile/` or beside their desktop twins, and how the top bar learns the current screen's title and actions.

## Claude's calls (not yet confirmed by the owner)

- Drill-down instead of an expanding tree.
- Four tabs (Progress, Tasks, Search, More) and no drawer or centre "+".
- Room matrix not shown on phones.
- Phone breakpoint unified at 768 px.
- Calendar removal leaves the database untouched.

## Build order

1. Calendar removal.
2. Shell (top bar, tab bar, More sheet, sheets) and shared phone styles.
3. Projects list and project header.
4. Progress view.
5. Overview.
6. Update Progress.
7. Tasks and the remaining screens.
8. Tests, screenshots, DECISIONS entry.

Code is written by Opus at high effort; design, planning and review by Fable.
