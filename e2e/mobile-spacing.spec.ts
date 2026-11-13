import { expect, test, authStorageKey } from './workspace-test'
import type { Page } from './workspace-test'
import { fixtureActivities, fixtureProject } from '../src/nbc/test-fixture'
import { pageSeed, projectSeed, taskSeed } from '../src/data/seed'

test.use({ hasTouch: true, isMobile: true })

const CORE_ROUTES = [
  '/projects-progress',
  '/projects-progress/nbc-bp03/overview',
  '/projects-progress/nbc-bp03/activities',
  '/projects-progress/nbc-bp03/update?handler=Tola',
  '/settings/account',
] as const

const OVERFLOW_ROUTES = [
  '/projects',
  '/tasks',
  '/search',
  '/trash',
  '/p/weekly-plan',
  '/projects/website/table',
  '/projects/website/board',
] as const

async function seedAll(page: Page) {
  await page.addInitScript(
    ({ activities, nbcProject, projects, pages, tasks }) => {
      if (!localStorage.getItem('kw-workspace-v1')) {
        localStorage.setItem(
          'kw-workspace-v1',
          JSON.stringify({
            pages,
            tasks,
            projects: [nbcProject, ...projects],
            nbc_activities: activities,
            nbc_submissions: [],
            nbc_summaries: [],
            scratchpad: '',
            taskViews: [],
          }),
        )
      }
    },
    {
      activities: fixtureActivities(),
      nbcProject: fixtureProject,
      projects: projectSeed,
      pages: pageSeed,
      tasks: taskSeed,
    },
  )
}

function slug(route: string) {
  return route.replace(/^\//, '').replace(/[/?=&]+/g, '-') || 'home'
}

test('phone top bar absorbs --safe-top with 12 px content gap', async ({ page }) => {
  await seedAll(page)
  await page.setViewportSize({ width: 390, height: 844 })
  for (const route of ['/projects-progress', '/projects-progress/nbc-bp03/overview', '/settings/account']) {
    await page.goto(route)
    const content = page.locator('main > *').first()
    await expect(content).toBeVisible()
    await expect(page.getByText('Loading project progress…')).toHaveCount(0)
    for (const inset of [0, 59]) {
      await page.evaluate((value) => {
        document.documentElement.style.setProperty('--safe-top', `${value}px`)
        window.scrollTo(0, 0)
      }, inset)
      const metrics = await page.evaluate(() => {
        const bar = document.querySelector('.ptopbar')!.getBoundingClientRect()
        const mainChild = document.querySelector('main > *') as HTMLElement
        const style = getComputedStyle(mainChild)
        const box = mainChild.getBoundingClientRect()
        const contentTop = box.top + parseFloat(style.paddingTop)
        return { barY: bar.y, topGap: contentTop - bar.bottom }
      })
      expect(metrics.barY, `${route} safe-top=${inset}`).toBe(0)
      expect(Math.abs(metrics.topGap - 12), `${route} topGap=${metrics.topGap}`).toBeLessThanOrEqual(1)
      await page.evaluate(() => window.scrollTo(0, 160))
      await expect.poll(async () => (await page.locator('.ptopbar').boundingBox())!.y).toBe(0)
    }
  }
})

for (const width of [320, 390, 430]) {
  test(`phone routes meet gutters, targets, input size and overflow at ${width}px`, async ({ page }) => {
    await seedAll(page)
    await page.setViewportSize({ width, height: 844 })
    for (const route of CORE_ROUTES) {
      await page.goto(route)
      const root = page.locator('main > *').first()
      await expect(root).toBeVisible()
      await expect(page.getByText('Loading project progress…')).toHaveCount(0)
      await expect(
        page.locator('.ph-projects, .nbc-overview, .ph-progress, .ph-update, .settings-page').first(),
      ).toBeVisible()

      const report = await page.evaluate(() => {
        const topbar = document.querySelector('.ptopbar')!.getBoundingClientRect()
        const mainChild = document.querySelector('main > *') as HTMLElement
        const style = getComputedStyle(mainChild)
        const box = mainChild.getBoundingClientRect()
        const left = box.left + parseFloat(style.paddingLeft)
        const right = innerWidth - box.right + parseFloat(style.paddingRight)
        const topGap = box.top + parseFloat(style.paddingTop) - topbar.bottom
        const overflow = document.documentElement.scrollWidth > innerWidth

        const badTargets: string[] = []
        const targets = document.querySelectorAll<HTMLElement>(
          'main button, main a, main input, main select, main [role=button], [data-testid=tabbar] button, [data-testid=tabbar] a',
        )
        for (const el of targets) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 && r.height === 0) continue
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.display === 'none') continue
          const maxDim = Math.max(r.width, r.height)
          const minDim = Math.min(r.width, r.height)
          if (maxDim < 43.5 || minDim < 31.5) {
            badTargets.push(
              `${el.tagName.toLowerCase()}.${el.className || ''}("${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28)}") ${r.width.toFixed(1)}x${r.height.toFixed(1)}`,
            )
          }
        }

        const smallInputs: string[] = []
        for (const inp of document.querySelectorAll<HTMLInputElement>('input')) {
          if (['checkbox', 'radio', 'range', 'file', 'hidden'].includes(inp.type)) continue
          const r = inp.getBoundingClientRect()
          if (r.width === 0 && r.height === 0) continue
          const fs = parseFloat(getComputedStyle(inp).fontSize)
          if (fs < 16) smallInputs.push(`${inp.ariaLabel || inp.name || inp.className} ${fs}px`)
        }

        return { left, right, topGap, overflow, badTargets, smallInputs }
      })

      expect(Math.abs(report.left - 16), `${route} left=${report.left}`).toBeLessThanOrEqual(1)
      expect(Math.abs(report.right - 16), `${route} right=${report.right}`).toBeLessThanOrEqual(1)
      expect(Math.abs(report.topGap - 12), `${route} topGap=${report.topGap}`).toBeLessThanOrEqual(1)
      expect(report.overflow, `${route} horizontal overflow`).toBe(false)
      expect(report.badTargets, `${route} undersized targets`).toEqual([])
      expect(report.smallInputs, `${route} inputs < 16px`).toEqual([])

      if (width === 390) {
        await page.screenshot({ path: `test-results/phone-${slug(route)}.png`, animations: 'disabled' })
      }
    }
  })

  test(`legacy routes stay free of horizontal overflow at ${width}px`, async ({ page }) => {
    await seedAll(page)
    await page.setViewportSize({ width, height: 844 })
    for (const route of OVERFLOW_ROUTES) {
      await page.goto(route)
      await expect(page.locator('main > *').first()).toBeVisible()
      await expect(page.getByRole('status').filter({ hasText: /^Loading / })).toHaveCount(0)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      expect(overflow, `${route} horizontal overflow at ${width}px`).toBe(false)
      if (width === 390) {
        await page.screenshot({ path: `test-results/phone-${slug(route)}.png`, animations: 'disabled' })
      }
    }
  })

  test(`sign-in gate fits with 44 px control and no overflow at ${width}px`, async ({ page }) => {
    await page.addInitScript(({ key }) => {
      localStorage.removeItem(key)
    }, { key: authStorageKey })
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/settings/account')
    const btn = page.getByRole('button', { name: 'Continue with Google' })
    await expect(btn).toBeVisible()
    const check = await page.evaluate(() => {
      const card = document.querySelector('.account-auth-card')!
      const cs = getComputedStyle(card)
      const btn = document.querySelector('.account-google')!.getBoundingClientRect()
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        padTop: parseFloat(cs.paddingTop),
        padLeft: parseFloat(cs.paddingLeft),
        btnHeight: btn.height,
        btnWidth: btn.width,
      }
    })
    expect(check.overflow).toBe(false)
    expect(check.padTop).toBe(20)
    expect(check.padLeft).toBe(20)
    expect(check.btnHeight).toBeGreaterThanOrEqual(44)
    expect(check.btnWidth).toBeGreaterThanOrEqual(44)
    if (width === 390) {
      await page.screenshot({ path: 'test-results/phone-signin.png', animations: 'disabled' })
    }
  })
}
