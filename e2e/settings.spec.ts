import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './workspace-test'

// Settings has a single Account & sync section since cb8034e removed Appearance; old links redirect to it.
test('old settings links land on Account & sync and calendar integration stays hidden', async ({ page }) => {
  for (const path of ['/settings', '/settings/appearance', '/settings/accounts']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/settings\/account$/)
  }
  await expect(page.locator('.settings-content-heading h2')).toHaveText('Account & sync')
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Reduce motion' })).toHaveCount(0)
  await expect(page.getByText('Manage Google calendars')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add Google account' })).toHaveCount(0)
  await expect(page.locator('a[href="/settings/accounts"]')).toHaveCount(0)
  await page.goto('/calendar/week/today')
  await page.getByRole('button', { name: /^Calendars/ }).click()
  await expect(page.locator('a[href="/settings/accounts"]')).toHaveCount(0)
})

for (const width of [320, 393, 1440]) {
  for (const scheme of ['light'] as const) {
    test(`settings fit and remain accessible at ${width}px in ${scheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/settings/account')
      await expect(page.locator('.settings-content-heading h2')).toHaveText('Account & sync')
      await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
      await expect(page.locator('.settings-page')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
      const { violations } = await new AxeBuilder({ page }).include('.settings-page').analyze()
      expect(violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.target}`)).toEqual([])
      await page.screenshot({ path: `test-results/settings-account-${width}-${scheme}-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' })
    })
  }
}
