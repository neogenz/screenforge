import { expect, test, type Page } from '@playwright/test'

const isPostHogRequest = (url: string) => url.includes('posthog-js') || url.includes('/posthog/')

async function stubPostHog(page: Page) {
  await page.route('**/posthog/**', (route) => {
    if (route.request().resourceType() === 'script') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ featureFlags: {}, supportedCompression: [] }),
    })
  })
}

async function storedChoice(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('screenforge-privacy-v1') ?? 'null'))
}

test('ne charge rien avant le choix et conserve un refus sans artefact PostHog', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await stubPostHog(page)
  await page.goto('/landing.html', { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)

  await expect(page.getByRole('heading', { name: 'Your privacy, your choice' })).toBeVisible()
  expect(requests.filter(isPostHogRequest)).toEqual([])

  await page.getByRole('button', { name: 'Reject all' }).click()
  await expect(page.getByRole('heading', { name: 'Your privacy, your choice' })).toHaveCount(0)
  expect(await storedChoice(page)).toEqual({ version: 1, analytics: false, diagnostic: false })
  expect(requests.filter(isPostHogRequest)).toEqual([])

  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Your privacy, your choice' })).toHaveCount(0)
  expect(requests.filter(isPostHogRequest)).toEqual([])
})

test('applique chaque finalité, tout accepter puis le retrait global', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await stubPostHog(page)
  await page.goto('/landing.html', { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: 'Choose' }).click()
  const dialog = page.getByRole('dialog', { name: 'Privacy settings' })
  await dialog.getByRole('switch', { name: 'Product analytics' }).click()
  await dialog.getByRole('button', { name: 'Save choices' }).click()
  expect(await storedChoice(page)).toEqual({ version: 1, analytics: true, diagnostic: false })
  await expect.poll(() => requests.some(isPostHogRequest)).toBe(true)

  await page.getByRole('button', { name: 'Privacy settings' }).click()
  await dialog.getByRole('switch', { name: 'Product analytics' }).click()
  await dialog.getByRole('switch', { name: 'Diagnostics' }).click()
  await dialog.getByRole('button', { name: 'Save choices' }).click()
  expect(await storedChoice(page)).toEqual({ version: 1, analytics: false, diagnostic: true })

  await page.getByRole('button', { name: 'Privacy settings' }).click()
  await dialog.getByRole('button', { name: 'Reject all' }).click()
  expect(await storedChoice(page)).toEqual({ version: 1, analytics: false, diagnostic: false })
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((key) => /posthog/i.test(key))),
  ).toEqual([])

  await page.evaluate(() => localStorage.removeItem('screenforge-privacy-v1'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Accept all' }).click()
  expect(await storedChoice(page)).toEqual({ version: 1, analytics: true, diagnostic: true })
})

test('publie une politique bilingue utilisable sans JavaScript', async ({ page }) => {
  await page.route('**/*.js', (route) => route.abort())
  await page.goto('/privacy.html', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Responsable du traitement' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Data controller' })).toBeVisible()
  await expect(page.getByText('Route Cantonale 158, 1963 Vétroz, Suisse')).toBeVisible()
  await expect(page.getByRole('link', { name: 'bonjour@screenforge.app' }).first()).toHaveAttribute(
    'href',
    'mailto:bonjour@screenforge.app',
  )
})
