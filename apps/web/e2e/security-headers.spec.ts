import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

test('la publication applique une CSP bloquante et interdit tout framing', async () => {
  const root = fileURLToPath(new URL('../../..', import.meta.url))
  const config = JSON.parse(await readFile(`${root}/vercel.json`, 'utf8')) as {
    headers: { headers: { key: string; value: string }[] }[]
  }
  const headers = new Map(
    config.headers
      .flatMap((entry) => entry.headers)
      .map(({ key, value }) => [key.toLowerCase(), value]),
  )
  const policy = headers.get('content-security-policy') ?? ''

  expect(headers.has('content-security-policy-report-only')).toBe(false)
  expect(policy).toContain("frame-ancestors 'none'")
  expect(policy).toContain("object-src 'none'")
  expect(policy).toContain("base-uri 'none'")
  expect(policy).not.toContain("'unsafe-eval'")
  expect(policy).not.toMatch(/(?:^|\s)\*(?:\s|;|$)/)
  expect(headers.get('x-frame-options')).toBe('DENY')
})
