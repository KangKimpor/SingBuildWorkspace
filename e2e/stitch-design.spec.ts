import { expect, test } from './workspace-test'
import AxeBuilder from '@axe-core/playwright'
import { fixtureActivities, fixtureProject } from '../src/nbc/test-fixture'

test.use({ hasTouch: true })

for (const width of [1280, 820, 393]) for (const theme of ['light'] as const) {
  test(`Stitch screens retain navigation, data and accessible layouts at ${width} ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.addInitScript((theme) => localStorage.setItem('kw-theme', theme), theme)
    await page.clock.install({ time: new Date('2026-10-28T07:00:00Z') })
    await page.addInitScript(({ project, activities }) => {
      if (!localStorage.getItem('kw-workspace-v1')) localStorage.setItem('kw-workspace-v1', JSON.stringify({
        pages: [], tasks: [], projects: [project], nbc_activities: activities,
        nbc_submissions: [], nbc_summaries: [], scratchpad: '', taskViews: [],
      }))
    }, { project: fixtureProject, activities: fixtureActivities() })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/projects-progress/nbc-bp03/overview')
    await expect(page.locator('.nbc-project')).toBeVisible()
    if (width >= 1024) {
      const sidebar = page.getByTestId('sidebar')
      expect(await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(247, 247, 245)')
      await expect(sidebar).toHaveCSS('width', '264px')
      await expect(page.locator('.topbar .brand-logo')).toHaveCount(0)
      const group = page.getByRole('button', { name: `Collapse ${fixtureProject.name}` })
      await expect(group).toHaveAttribute('aria-expanded', 'true')
      await expect(sidebar.getByText('44%', { exact: true })).toBeVisible()
      const children = page.getByRole('list', { name: `${fixtureProject.name} views`, exact: true })
      await expect(children.getByRole('link')).toHaveCount(3)
      await expect(children.getByRole('link', { name: 'Overview', exact: true })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'Trash', exact: true })).toHaveCount(0)
      await expect(sidebar.getByRole('button', { name: 'Search workspace', exact: true })).toHaveCount(0)
      await expect(sidebar.getByRole('separator', { name: 'Resize sidebar' })).toHaveCount(0)
      const overview = children.getByRole('link', { name: 'Overview', exact: true })
      await overview.click()
      await expect(overview).toHaveAttribute('aria-current', 'page')
      const projectProgress = children.getByRole('link', { name: 'Project Progress', exact: true })
      await projectProgress.click()
      await expect(projectProgress).toHaveAttribute('aria-current', 'page')
      await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toHaveCount(0)
      await page.keyboard.press('ControlOrMeta+Backslash')
      await expect(sidebar).toHaveCSS('width', '70px')
      await page.keyboard.press('ControlOrMeta+Backslash')
      await expect(sidebar).toHaveCSS('width', '264px')
      await page.getByRole('button', { name: `Collapse ${fixtureProject.name}` }).click()
      await expect(page.getByRole('button', { name: `Expand ${fixtureProject.name}` })).toHaveAttribute('aria-expanded', 'false')
      await page.getByRole('button', { name: `Expand ${fixtureProject.name}` }).click()
    } else if (width >= 768) {
      await page.getByRole('button', { name: 'Open sidebar', exact: true }).click()
      const drawer = page.getByRole('dialog', { name: 'Sidebar', exact: true })
      await expect(drawer).toBeVisible()
      await expect(drawer).toHaveCSS('background-color', 'rgb(247, 247, 245)')
      await expect(drawer.getByText('44%', { exact: true })).toBeVisible()
      const children = drawer.getByRole('list', { name: `${fixtureProject.name} views`, exact: true })
      await expect(children.getByRole('link')).toHaveCount(3)
      await children.getByRole('link', { name: 'Project Progress', exact: true }).click()
      await expect(drawer).not.toBeVisible()
      await expect(page.locator('.nbc-tabs a[aria-current=page]')).toHaveText('Project Progress')
    } else {
      await expect(page.getByRole('button', { name: 'Open sidebar', exact: true })).toHaveCount(0)
      await expect(page.locator('.ptopbar')).toContainText('NBC BP03')
      await expect(page.getByTestId('tabbar').getByRole('link')).toHaveCount(3)
    }
    const phone = width < 768
    const nav = phone ? page.getByTestId('tabbar') : page.locator('.nbc-tabs')
    for (const [view, desktopLabel, phoneLabel] of [['overview', 'Overview', 'Overview'], ['activities', 'Project Progress', 'Progress'], ['update', 'Update Progress', 'Update']] as const) {
      const label = phone ? phoneLabel : desktopLabel
      await nav.getByRole('link', { name: label, exact: true }).click()
      await expect(nav.locator('a[aria-current=page]')).toHaveText(label)
      if (!phone) await expect(page.getByRole('heading', { name: fixtureProject.name, exact: true })).toBeVisible()
      if (view === 'overview') {
        await expect(page.locator('.nbc-kpi').filter({ hasText: 'Overall progress' }).locator('strong')).toHaveText('43.75%')
        await expect(page.getByRole('region', { name: 'Project snapshot' })).toContainText('Versus plan')
        if (phone) await page.getByRole('button', { name: /^Completion breakdown/ }).click()
        await page.getByRole('button', { name: 'Work area', exact: true }).click()
        await expect(page.getByRole('region', { name: 'Work area', exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Floor', exact: true }).click()
        await expect(page.getByRole('region', { name: 'Floor / location' })).toBeVisible()
      }
      if (view === 'activities') await expect(page.locator(phone ? '.ph-progress' : '.nbc-wbs')).toBeVisible()
      if (view === 'update') {
        await expect(page.getByRole('heading', { name: 'Who is updating?' })).toBeVisible()
        await page.locator('.nbc-gate-list').getByRole('button', { name: /^Tola/ }).click(); await page.getByRole('button', { name: /^Continue as/ }).click()
        await expect(page.getByRole('button', { name: 'Confirm, no changes', exact: true })).toBeInViewport()
        if (width >= 1024) {
          const toolbar = page.locator('.nbc-update-controls')
          await expect(toolbar.getByText('Due Fri 11:59 PM · 2d left')).toBeVisible()
          await expect(toolbar.getByRole('button', { name: 'Expand editor', exact: true })).toHaveText('Expand')
          await expect(toolbar.getByRole('button', { name: 'Expand all', exact: true })).toBeVisible()
          await expect(toolbar.getByRole('button', { name: 'Collapse all', exact: true })).toBeVisible()
          expect(await toolbar.locator(':scope > *').evaluateAll((items) => new Set(items.map((item) => Math.round(item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2))).size)).toBe(1)
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const scan = await new AxeBuilder({ page }).include('.nbc-project').analyze()
      expect(scan.violations.map(v => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([])
      await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0) })
      await page.screenshot({ path: `docs/screenshots/stitch/${view}-${width}-${theme}-${info.project.name}.png`, fullPage: true, animations: 'disabled' })
    }
    expect(errors).toEqual([])
  })
}
