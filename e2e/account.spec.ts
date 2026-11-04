import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Auth responses are mocked; service workers must not fetch around those routes.
test.use({ serviceWorkers: 'block' })
const cors = {
  'access-control-allow-origin': 'http://localhost:4173',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers':
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
}

test('sign-in is Google-only and centers Welcome', async ({ page }) => {
  await page.goto('/settings/account')
  const welcome = page.getByRole('heading', { name: 'Welcome', exact: true })
  await expect(welcome).toBeVisible()
  await expect(welcome).toHaveCSS('text-align', 'center')
  await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0)
  await expect(page.getByText('or continue with email', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Email address', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
})

test('Google sign-in goes to the configured provider and exact app callback', async ({ page }) => {
  await page.route('**/auth/v1/authorize?*', (route) =>
    route.fulfill({
      status: 200,
      headers: cors,
      contentType: 'text/html',
      body: '<h1>OAuth provider handoff</h1>',
    }),
  )
  await page.goto('/settings/account')
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/v1\/authorize\?/)
  const destination = new URL(page.url())
  expect(destination.searchParams.get('provider')).toBe('google')
  expect(destination.searchParams.get('redirect_to')).toBe(
    'http://localhost:4173/settings/account',
  )
  expect(destination.searchParams.get('code_challenge')).toBeTruthy()
})

for (const width of [320, 393, 820, 1180, 1920]) {
  test(`Google sign-in fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/settings/account')
    await expect(
      page.getByRole('button', { name: 'Continue with Google', exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
  })
}

for (const scheme of ['light'] as const) {
  test(`Google sign-in accessibility in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.setViewportSize({ width: 393, height: 852 })
    await page.goto('/settings/account')
    await expect(
      page.getByRole('button', { name: 'Continue with Google', exact: true }),
    ).toBeVisible()
    const result = await new AxeBuilder({ page }).analyze()
    expect(
      result.violations
        .filter((v) => ['serious', 'critical'].includes(v.impact || ''))
        .map((v) => `${scheme} ${v.id}: ${v.nodes[0]?.target}`),
    ).toEqual([])
  })
}
