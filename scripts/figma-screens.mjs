import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { pageSeed, projectSeed, taskSeed } from '../src/data/seed.ts'
import { fixtureActivities, fixtureProject } from '../src/nbc/test-fixture.ts'

// Ground-truth screens for the Figma port. Seeds the same guest workspace the
// e2e suite uses, plus the NBC fixture project so the progress screens have data.
const baseURL = process.env.PREVIEW_URL || 'http://localhost:5173'
const out = new URL('../docs/screenshots/figma/', import.meta.url)
await mkdir(out, { recursive: true })

const authKey = 'sb-nlcpjdokfvawlpzyfytx-auth-token'
const authValue = JSON.stringify({
  access_token: 'workspace-ui-test',
  refresh_token: 'workspace-ui-test',
  expires_at: 4102444800,
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'guest', aud: 'authenticated', email: 'ui@example.invalid', user_metadata: {} },
})

const content = {
  pages: pageSeed,
  projects: [...projectSeed, fixtureProject],
  tasks: taskSeed,
  nbc_activities: fixtureActivities(),
  nbc_submissions: [],
  nbc_summaries: [],
  scratchpad:
    'Review the Quiet Glass tokens and verify the Safari blur fallback before the next milestone.',
  taskViews: [],
}

const desktop = [
  ['progress', '/projects-progress'],
  ['nbc-overview', '/projects-progress/nbc-bp03/overview'],
  ['nbc-activities', '/projects-progress/nbc-bp03/activities'],
  ['nbc-update', '/projects-progress/nbc-bp03/update'],
  ['nbc-issues', '/projects-progress/nbc-bp03/issues'],
  ['projects', '/projects?workspace=personal'],
  ['projects-team', '/projects?workspace=team'],
  ['project-table', '/projects/website/table'],
  ['project-board', '/projects/website/board'],
  ['tasks', '/tasks'],
  ['page', '/p/weekly-plan'],
  ['settings-appearance', '/settings/appearance'],
  ['settings-account', '/settings/account'],
  ['trash', '/trash'],
  ['search', '/search?q=design'],
  ['design', '/design'],
]

const mobile = [
  ['progress', '/projects-progress'],
  ['nbc-activities', '/projects-progress/nbc-bp03/activities'],
  ['nbc-update', '/projects-progress/nbc-bp03/update'],
  ['projects', '/projects?workspace=personal'],
  ['project-table', '/projects/website/table'],
  ['project-board', '/projects/website/board'],
  ['tasks', '/tasks'],
  ['pages', '/p/weekly-plan'],
  ['settings-appearance', '/settings/appearance'],
  ['trash', '/trash'],
]

const browser = await chromium.launch()
let captured = 0

async function capture(viewport, screens, prefix, overlays) {
  const context = await browser.newContext({
    viewport,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    timezoneId: 'Asia/Bangkok',
    hasTouch: viewport.width < 640,
  })
  await context.addInitScript(({ authKey, authValue, content }) => {
    localStorage.setItem(authKey, authValue)
    localStorage.setItem('kw-workspace-v1', content)
  }, { authKey, authValue, content: JSON.stringify(content) })
  const page = await context.newPage()
  try {
    for (const [name, route] of screens) {
      await page.goto(`${baseURL}${route}`)
      await page.waitForLoadState('networkidle')
      await page.locator('.shell, .auth-page').first().waitFor()
      await page.waitForTimeout(350)
      const file = fileURLToPath(new URL(`${prefix}-${name}.png`, out))
      await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' })
      captured++
      console.log(`${prefix}-${name}`)
    }
    if (overlays) {
      // Command palette overlay.
      await page.goto(`${baseURL}/tasks`)
      await page.waitForLoadState('networkidle')
      const palette = page.getByRole('button', { name: 'Open command palette', exact: true })
      if (await palette.count()) {
        await palette.first().click()
        await page.getByRole('dialog').first().waitFor()
        await page.screenshot({
          path: fileURLToPath(new URL(`${prefix}-command-palette.png`, out)),
          animations: 'disabled',
        })
        captured++
        await page.keyboard.press('Escape')
      }
    }
  } finally {
    await context.close()
  }
}

try {
  await capture({ width: 1440, height: 900 }, desktop, 'desktop', true)
  await capture({ width: 393, height: 852 }, mobile, 'mobile', false)
  // Signed-out sign-in screen.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(`${baseURL}/tasks`)
  await page.locator('.auth-page').waitFor()
  await page.waitForTimeout(300)
  await page.screenshot({
    path: fileURLToPath(new URL('desktop-sign-in.png', out)),
    animations: 'disabled',
  })
  captured++
  await context.close()
} finally {
  await browser.close()
}

console.log(`Captured ${captured} screenshots in docs/screenshots/figma`)
