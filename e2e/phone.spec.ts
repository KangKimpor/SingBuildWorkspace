import { expect, test } from './workspace-test'
import type { Page } from './workspace-test'
import { fixtureActivities, fixtureProject } from '../src/nbc/test-fixture'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function setup(page: Page) {
  await page.addInitScript(({ activities, project }) => { if (!localStorage.getItem('kw-workspace-v1')) localStorage.setItem('kw-workspace-v1', JSON.stringify({ pages: [], tasks: [], projects: [project], nbc_activities: activities, nbc_submissions: [], nbc_summaries: [], scratchpad: '', taskViews: [] })) }, { activities: fixtureActivities(), project: fixtureProject })
}

test('no bottom bar outside a project', async ({ page }) => {
  await setup(page)
  await page.goto('/settings/account')
  await expect(page.locator('.ptopbar')).toBeVisible()
  await expect(page.getByTestId('tabbar')).toHaveCount(0)
})

test('project tabs', async ({ page }) => {
  await setup(page)
  await page.goto('/projects-progress/nbc-bp03/overview')
  const links = page.getByTestId('tabbar').getByRole('link')
  await expect(links).toHaveCount(3)
  await expect(links.nth(0)).toHaveAccessibleName('Overview')
  await expect(links.nth(1)).toHaveAccessibleName('Progress')
  await expect(links.nth(2)).toHaveAccessibleName('Update')
  await expect(links.nth(0)).toHaveAttribute('aria-current', 'page')
  await links.nth(1).tap()
  await expect(page).toHaveURL(/\/projects-progress\/nbc-bp03\/activities$/)
  await expect(links.nth(1)).toHaveAttribute('aria-current', 'page')
  await expect(links.nth(0)).not.toHaveAttribute('aria-current', 'page')
})

test('settings from the top bar and back', async ({ page }) => {
  await setup(page)
  // The gear sits on the projects list; inside a project the top bar has a back arrow instead.
  await page.goto('/projects-progress/nbc-bp03/overview')
  await expect(page.locator('.ptopbar')).toContainText('NBC BP03')
  await expect(page.locator('.ptopbar').getByRole('link', { name: 'Settings' })).toHaveCount(0)
  await page.goto('/projects-progress')
  await page.locator('.ptopbar').getByRole('link', { name: 'Settings' }).tap()
  await expect(page).toHaveURL(/\/settings\/account$/)
  await expect(page.locator('.ptopbar')).toContainText('Settings')
  await page.locator('.ptopbar').getByRole('link', { name: 'Back' }).tap()
  await expect(page).toHaveURL(/\/projects-progress$/)
})

test('no drawer toggle on phone', async ({ page }) => {
  await setup(page)
  await page.goto('/projects-progress/nbc-bp03/overview')
  await expect(page.getByTestId('tabbar')).toBeVisible()
  await expect(page.locator('.sidebar-toggle')).toHaveCount(0)
})

test('Progress tab lists projects and opens one', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/projects-progress$/)
  await expect(page.locator('.ptopbar')).toContainText('Progress')
  await expect(page.getByTestId('tabbar')).toHaveCount(0)
  const card = page.getByRole('link', { name: /NBC BP03/ })
  await expect(card).toContainText('%')
  await card.tap()
  await expect(page).toHaveURL(/\/projects-progress\/nbc-bp03\/overview$/)
  await expect(page.getByTestId('tabbar').getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.ptopbar')).toContainText('NBC BP03')
  await expect(page.locator('.nbc-project-header')).toHaveCount(0)
  await expect(page.locator('.nbc-tabs')).toHaveCount(0)
  await page.locator('.ptopbar').getByRole('button', { name: 'Project actions' }).tap()
  await expect(page.getByRole('button', { name: 'Export XLSX' })).toBeEnabled()
  await page.keyboard.press('Escape')
  await page.locator('.ptopbar').getByRole('link', { name: 'Back' }).tap()
  await expect(page).toHaveURL(/\/projects-progress$/)
})

test('tab bar hides while typing', async ({ page }) => {
  await setup(page)
  await page.goto('/projects-progress/nbc-bp03/activities')
  await page.locator('.ptopbar').getByRole('button', { name: 'Search activities' }).tap()
  const search = page.locator('.ptopbar').getByRole('searchbox', { name: 'Search activities' })
  await search.focus()
  await expect(page.getByTestId('tabbar')).toBeHidden()
  await search.blur()
  await expect(page.getByTestId('tabbar')).toBeVisible()
})

test('overview fits: KPIs and attention on the first screen', async ({ page }) => {
  await setup(page)
  await page.goto('/projects-progress/nbc-bp03/overview')
  const kpis = page.locator('.nbc-kpi')
  await expect(kpis).toHaveCount(4)
  for (let i = 0; i < 4; i++) {
    const box = await kpis.nth(i).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
  }
  const attention = page.getByRole('heading', { name: 'Needs attention' })
  await expect(attention).toBeVisible()
  const attentionBox = await attention.boundingBox()
  expect(attentionBox).not.toBeNull()
  expect(attentionBox!.y + attentionBox!.height).toBeLessThanOrEqual(844)
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  expect(height).toBeLessThan(1700)
})

test('view progress down to one activity', async ({ page }) => {
  const base = fixtureActivities()
  const nested = [
    { ...base[0]!, id: 'nbc:1.6', wbs: '1.6', name: 'Phase 1', parentId: null, order: 0 },
    { ...base[0]!, parentId: 'nbc:1.6', order: 1 },
    base[1]!,
    base[2]!,
  ]
  await page.addInitScript(({ activities, project }) => {
    if (!localStorage.getItem('kw-workspace-v1')) {
      localStorage.setItem('kw-workspace-v1', JSON.stringify({ pages: [], tasks: [], projects: [project], nbc_activities: activities, nbc_submissions: [], nbc_summaries: [], scratchpad: '', taskViews: [] }))
    }
  }, { activities: nested, project: fixtureProject })

  await page.goto('/projects-progress')
  await page.getByRole('link', { name: /NBC BP03/ }).tap()
  await page.getByTestId('tabbar').getByRole('link', { name: 'Progress' }).tap()
  await expect(page).toHaveURL(/\/projects-progress\/nbc-bp03\/activities$/)

  const nestedScroll = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return false
    for (const el of main.querySelectorAll<HTMLElement>('*')) {
      const style = getComputedStyle(el)
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return true
    }
    return false
  })
  expect(nestedScroll).toBe(false)

  await page.getByRole('button', { name: /Phase 1/ }).tap()
  await page.getByRole('button', { name: /Test area/ }).tap()
  await page.getByRole('button', { name: /Install board/ }).tap()

  const sheet = page.getByRole('dialog')
  await expect(sheet).toContainText('Previous week %')
  await expect(sheet).toContainText('25.00%')
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)

  await page.goBack()
  await expect(page.getByRole('button', { name: /Test area/ })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('button', { name: /Phase 1/ })).toBeVisible()
})

test('update a value and confirm on a phone', async ({ page }) => {
  const base = fixtureActivities()
  const extra = Array.from({ length: 5 }, (_, i) => ({
    ...base[2]!,
    id: `nbc:1.6.1.${i + 3}`,
    wbs: `1.6.1.${i + 3}`,
    name: `Install fixture ${i + 1}`,
    progress: 0.2,
    baseline: 0.2,
    order: i + 4,
    relativeWeight: 0,
    globalWeight: 0,
  }))
  await page.addInitScript(({ activities, project }) => {
    if (!localStorage.getItem('kw-workspace-v1')) {
      localStorage.setItem('kw-workspace-v1', JSON.stringify({ pages: [], tasks: [], projects: [project], nbc_activities: activities, nbc_submissions: [], nbc_summaries: [], scratchpad: '', taskViews: [] }))
    }
  }, { activities: [...base, ...extra], project: fixtureProject })

  await page.goto('/projects-progress/nbc-bp03/update')
  await page.getByRole('button', { name: /^Tola/ }).tap()
  await page.getByRole('button', { name: 'Continue as Tola' }).tap()

  const nestedScroll = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return false
    for (const el of main.querySelectorAll<HTMLElement>('*')) {
      const style = getComputedStyle(el)
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return true
    }
    return false
  })
  expect(nestedScroll).toBe(false)

  const cards = page.locator('.ph-ucard')
  await expect(cards.first()).toBeVisible()
  let inViewport = 0
  const count = await cards.count()
  for (let i = 0; i < count; i++) {
    const box = await cards.nth(i).boundingBox()
    if (box && box.y >= 0 && box.y + box.height <= 844) inViewport++
  }
  expect(inViewport).toBeGreaterThanOrEqual(3)

  const input = page.getByLabel('This week % for 1.6.1.2')
  await input.fill('50')
  const bar = page.locator('.ph-update-bar')
  await expect(bar).toContainText('1 changed')

  await bar.getByRole('button', { name: 'Confirm update' }).tap()
  const sheet = page.getByRole('dialog', { name: 'Confirm update' })
  await sheet.getByRole('switch').tap()
  await expect(sheet).toContainText('Install board')
  await sheet.getByRole('button', { name: 'Confirm' }).tap()
  await expect(bar).toContainText('Confirmed')
})

test('focused field is not covered', async ({ page }) => {
  const base = fixtureActivities()
  const extra = Array.from({ length: 10 }, (_, i) => ({
    ...base[2]!,
    id: `nbc:1.6.1.${i + 3}`,
    wbs: `1.6.1.${i + 3}`,
    name: `Install item ${i + 1}`,
    progress: 0.2,
    baseline: 0.2,
    order: i + 4,
    relativeWeight: 0,
    globalWeight: 0,
  }))
  await page.addInitScript(({ activities, project }) => {
    if (!localStorage.getItem('kw-workspace-v1')) {
      localStorage.setItem('kw-workspace-v1', JSON.stringify({ pages: [], tasks: [], projects: [project], nbc_activities: activities, nbc_submissions: [], nbc_summaries: [], scratchpad: '', taskViews: [] }))
    }
  }, { activities: [...base, ...extra], project: fixtureProject })

  await page.goto('/projects-progress/nbc-bp03/update?handler=Tola')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(100)

  const inputs = page.locator('.ph-ucard-input')
  const last = inputs.last()
  await last.focus()
  await expect(page.getByTestId('tabbar')).toBeHidden()
  await page.waitForTimeout(100)

  const inputBox = await last.boundingBox()
  const barBox = await page.locator('.ph-update-bar').boundingBox()
  expect(inputBox).not.toBeNull()
  expect(barBox).not.toBeNull()
  expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(barBox!.y)
})

test('crossing 768 px keeps unsaved draft', async ({ page }) => {
  await setup(page)
  await page.goto('/projects-progress/nbc-bp03/update?handler=Tola')
  const phoneInput = page.getByLabel('This week % for 1.6.1.2')
  await phoneInput.fill('55')

  await page.setViewportSize({ width: 900, height: 800 })
  const desktopInput = page.getByLabel('This week % for 1.6.1.2')
  await expect(desktopInput).toBeVisible()
  await expect(desktopInput).toHaveValue('55')

  await desktopInput.fill('65')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByLabel('This week % for 1.6.1.2')).toHaveValue('65')
})

