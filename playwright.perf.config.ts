import { defineConfig, devices } from '@playwright/test'

/** BP02 interaction timings (e2e/perf). Not part of `test:e2e`; run with `corepack pnpm perf:bp02`. */
export default defineConfig({
  testDir: 'e2e/perf',
  testMatch: '**/*.perf.ts',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: process.env.PLAYWRIGHT_SKIP_BUILD ? 'corepack pnpm preview' : 'corepack pnpm build && corepack pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
