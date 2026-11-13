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
  const search = page.getByLabel('Search activities')
  await search.focus()
  await expect(page.getByTestId('tabbar')).toBeHidden()
  await search.blur()
  await expect(page.getByTestId('tabbar')).toBeVisible()
})
