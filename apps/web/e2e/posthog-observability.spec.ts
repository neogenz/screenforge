import { expect, test, type Page } from '@playwright/test'

async function stubPostHog(page: Page, requests: { url: string; body: string }[]) {
  await page.route('**/posthog/**', (route) => {
    const request = route.request()
    requests.push({ url: request.url(), body: request.postData() ?? '' })
    if (request.resourceType() === 'script') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    }
    const remoteConfig = request.url().endsWith('/config')
      ? {
          supportedCompression: [],
          autocapture_opt_out: true,
          sessionRecording: { sampleRate: '1' },
          toolbarParams: {},
          toolbarVersion: 'toolbar',
          isAuthenticated: false,
          siteApps: [],
        }
      : { featureFlags: {}, supportedCompression: [] }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(remoteConfig),
    })
  })
}

test('borne événements, URL et replay aux finalités choisies', async ({ page }) => {
  const requests: { url: string; body: string }[] = []
  await stubPostHog(page, requests)
  await page.goto('/landing.html?private=PRIVATE_SENTINEL#fragment')

  await page.getByRole('button', { name: 'Choose' }).click()
  const dialog = page.getByRole('dialog', { name: 'Privacy settings' })
  await dialog.getByRole('switch', { name: 'Product analytics' }).click()
  await dialog.getByRole('button', { name: 'Save choices' }).click()
  await page.evaluate(() =>
    document.addEventListener('click', (event) => event.preventDefault(), {
      capture: true,
      once: true,
    }),
  )
  await page.getByRole('link', { name: 'Open the editor for free' }).first().click()

  await expect
    .poll(() => requests.some(({ body }) => body.includes('screenforge_landing_cta_clicked')))
    .toBe(true)
  expect(requests.map(({ body }) => body).join('')).not.toContain('PRIVATE_SENTINEL')
  expect(requests.some(({ url }) => /recorder|session-recording/i.test(url))).toBe(false)

  await page.evaluate(() =>
    localStorage.setItem(
      'screenforge-privacy-v1',
      JSON.stringify({ version: 1, analytics: false, diagnostic: true }),
    ),
  )
  await page.reload()
  await expect
    .poll(() => requests.some(({ url }) => /recorder|session-recording/i.test(url)))
    .toBe(true)
})
