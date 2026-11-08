# Project Agent Instructions

Operational guidelines and instructions for AI agents working in this repository.

## Commands and Environment

- **Node & Package Manager:** Use Node 24 and Corepack pnpm. Always run commands using `corepack pnpm` on Windows:
  - Install: `corepack pnpm install --frozen-lockfile`
  - Dev server: `corepack pnpm dev`
  - Build: `corepack pnpm build`
  - Production preview: `corepack pnpm preview`
  - Lint: `corepack pnpm lint`
  - Typecheck: `corepack pnpm typecheck`
  - Unit tests: `corepack pnpm test`
  - E2E tests: `corepack pnpm test:e2e --workers=1`
- **Shell & Tooling:** Run commands in the Windows environment without modifying PATH assumptions.
- **Documentation:** Record every architectural or non-obvious decision in [docs/DECISIONS.md](docs/DECISIONS.md).

## Supabase Log Query Optimization (Free Plan)

### Optimize usage

Two people asking similar-sounding questions can generate very different amounts of usage, depending on how they ask. These tips help you avoid scanning more data than a question requires — they're habits, not restrictions, and none of them ask you to give up visibility you need.

- **Narrow your time range to what the question needs.** Query cost scales with how much data a query scans, and time range is usually the biggest factor: a 1-day window scans about 7 times less data than a 7-day window. Start with the smallest window that could contain the answer, and widen only if you don't find it. Keep a wide window when you're doing genuine historical or trend analysis on purpose — that's a real use case, only a more expensive one by nature.
- **Filter as part of the query, not after you've pulled the data.** Add filters for source, service, status code, or project before you run a search. A broad, unfiltered query scans everything in its time range, even if you only look at a fraction of the results afterwards. Filtering after the fact doesn't reduce what was already scanned.
- **Use the Logs Explorer for ad-hoc digging, not scripted polling.** Every query scans data again — there's no caching benefit from asking the same question repeatedly. A script that polls the query endpoint on a schedule re-scans on every run, so it can use far more allowance than a person checking manually, even if it usually finds nothing new.
- **Use Log Drains for anything continuous.** If you need an ongoing feed of your logs — for your own monitoring stack, alerting, or archiving — repeatedly querying for what's new since you last checked is one of the most expensive ways to get it, because each check re-scans. Drains stream logs to a destination as they arrive instead.

After you change how you query, check your usage trend over the following few days rather than a single day. Usage varies with how much debugging or investigation you happen to do, so a single day's change isn't a reliable signal on its own.
