import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIST_DOCUMENTS = [
  'apps/web/dist/index.html',
  'apps/web/dist/landing.html',
  'apps/web/dist/landing-fr.html',
]

/**
 * @param {unknown} condition
 * @param {string} message
 * @returns {asserts condition}
 */
function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

/** @param {string} policy */
function directives(policy) {
  return new Map(
    policy
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...values]) => [name, values]),
  )
}

async function configuredPolicy() {
  const config = /** @type {{ headers?: { headers?: { key: string, value: string }[] }[] }} */ (
    JSON.parse(await readFile(resolve(ROOT, 'vercel.json'), 'utf8'))
  )
  const headers = config.headers?.flatMap((entry) => entry.headers ?? []) ?? []
  const entry = headers.find(({ key }) =>
    ['content-security-policy', 'content-security-policy-report-only'].includes(key.toLowerCase()),
  )
  invariant(entry?.value, 'vercel.json must declare a Content-Security-Policy candidate.')
  return entry.value
}

/** @param {string} policy */
function validatePolicy(policy) {
  const parsed = directives(policy)
  const script = parsed.get('script-src') ?? []
  for (const [name, value] of [
    ['default-src', "'self'"],
    ['script-src', "'self'"],
    ['object-src', "'none'"],
    ['base-uri', "'none'"],
    ['frame-ancestors', "'none'"],
    ['form-action', "'self'"],
  ]) {
    invariant(parsed.get(name)?.includes(value), `${name} must contain ${value}.`)
  }
  invariant(!policy.includes('*'), 'CSP must not contain a wildcard.')
  invariant(!script.includes("'unsafe-inline'"), 'script-src must not allow unsafe-inline.')
  invariant(!script.includes("'unsafe-eval'"), 'script-src must not allow unsafe-eval.')
  return script
}

/** @param {string[]} scriptSources */
async function validateBuiltDocuments(scriptSources) {
  for (const relative of DIST_DOCUMENTS) {
    const html = await readFile(resolve(ROOT, relative), 'utf8')
    invariant(!/\son[a-z]+\s*=/i.test(html), `${relative} contains an inline event handler.`)

    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/(?:^|\s)src\s*=/i.test(match[1])) continue
      const hash = `'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`
      invariant(
        scriptSources.includes(hash),
        `${relative} inline script is missing CSP hash ${hash}.`,
      )
    }
  }
}

/**
 * @param {Headers} headers
 * @param {string} name
 * @param {string | undefined} [expected]
 */
function requiredHeader(headers, name, expected) {
  const value = headers.get(name)
  invariant(value, `${name} is missing.`)
  if (expected) invariant(value === expected, `${name} has an unexpected value: ${value}`)
  return value
}

/** @param {string} value */
async function validateDeployment(value) {
  const url = new URL(value)
  invariant(url.protocol === 'https:', 'The deployed audit requires an HTTPS URL.')
  const response = await fetch(url, { redirect: 'follow' })
  invariant(response.ok, `Deployment returned ${response.status}.`)
  invariant(new URL(response.url).protocol === 'https:', 'Deployment redirected away from HTTPS.')

  const policy = requiredHeader(response.headers, 'content-security-policy')
  await validateBuiltDocuments(validatePolicy(policy))
  invariant(
    /\bmax-age=\d+/i.test(requiredHeader(response.headers, 'strict-transport-security')),
    'HSTS needs max-age.',
  )
  requiredHeader(response.headers, 'x-content-type-options', 'nosniff')
  requiredHeader(response.headers, 'referrer-policy', 'strict-origin-when-cross-origin')
  requiredHeader(response.headers, 'permissions-policy', 'camera=(), microphone=(), geolocation=()')
  const verified = new URL(response.url)
  verified.search = ''
  verified.hash = ''
  console.log(`Security headers verified on ${verified}`)
}

const policy = await configuredPolicy()
const scriptSources = validatePolicy(policy)
await validateBuiltDocuments(scriptSources)

const target = process.argv[2]
if (target && target !== '--build-only') await validateDeployment(target)
else console.log('CSP and built inline scripts verified.')
