import { expect, test } from './workspace-test'

test.use({ hasTouch: true, isMobile: true })

test('tablet sidebar drawer opens on the first tap and closes after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  let loads = 0
  let sidebarLoads = 0
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.resourceType() === 'document') loads++
    if (/\/assets\/SidebarContent-[^/]+\.js$/.test(request.url())) sidebarLoads++
  })
  await page.route('**/assets/Overlays-*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    await route.continue()
  })
  await page.goto('/')
  const button = page.getByRole('button', { name: 'Open sidebar', exact: true })
  await expect(button).toBeVisible()
  expect(sidebarLoads).toBe(0)
  await button.tap()
  const drawer = page.getByRole('dialog', { name: 'Sidebar', exact: true })
  await expect(drawer).toBeVisible()
  expect(sidebarLoads).toBe(1)
  await expect(drawer).toHaveCSS('transition-property', 'none')
  expect(loads).toBe(1)
  await expect(drawer.getByRole('link', { name: 'Personal projects', exact: true })).toHaveCount(0)
  // The "Projects" heading is a label, not a link: there is no project list page.
  await expect(drawer.getByText('Projects', { exact: true })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Projects', exact: true })).toHaveCount(0)
  await drawer.getByRole('button', { name: 'Close sidebar', exact: true }).tap()
  await expect(drawer).not.toBeVisible()
  await button.tap()
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: 'Close sidebar', exact: true }).tap()
  await expect(drawer).not.toBeVisible()
})

test('phone uses the projects home, top bar and project tab bar without a drawer', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  let loads = 0
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.resourceType() === 'document') loads++
  })
  await page.goto('/')
  await expect(page).toHaveURL(/\/projects-progress$/)
  await expect(page.getByRole('button', { name: 'Open sidebar', exact: true })).toHaveCount(0)
  await expect(page.getByTestId('tabbar')).toHaveCount(0)
  await page.locator('.ptopbar').getByRole('link', { name: 'Settings', exact: true }).tap()
  await expect(page).toHaveURL(/\/settings\/account$/)
  await page.locator('.ptopbar').getByRole('link', { name: 'Back', exact: true }).tap()
  await expect(page).toHaveURL(/\/projects-progress$/)
  await page.goto('/projects-progress/nbc-bp03/overview')
  const tabbar = page.getByTestId('tabbar')
  await expect(tabbar).toBeVisible()
  await tabbar.getByRole('link', { name: 'Progress', exact: true }).tap()
  await expect(page).toHaveURL(/\/projects-progress\/nbc-bp03\/activities$/)
  await tabbar.getByRole('link', { name: 'Update', exact: true }).tap()
  await expect(page).toHaveURL(/\/projects-progress\/nbc-bp03\/update$/)
  expect(loads).toBe(2)
})
