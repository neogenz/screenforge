import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIST_DOCUMENTS = [
  'apps/web/dist/index.html',
  'apps/web/dist/landing.html',
  'apps/web/dist/landing-fr.html',
  'apps/web/dist/privacy.html',
]
const CONNECT_SOURCES = new Set([
  "'self'",
  'data:',
  'blob:',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://api.anthropic.com',
  'https://openrouter.ai',
  'https://acrobatic-orca-116.eu-west-1.convex.cloud',
  'wss://acrobatic-orca-116.eu-west-1.convex.cloud',
  'https://acrobatic-orca-116.eu-west-1.convex.site',
  'https://colorful-caterpillar-775.eu-west-1.convex.cloud',
  'wss://colorful-caterpillar-775.eu-west-1.convex.cloud',
  'https://colorful-caterpillar-775.eu-west-1.convex.site',
  'https://eu.i.posthog.com',
])

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
  const entry = headers.find(({ key }) => key.toLowerCase() === 'content-security-policy')
  invariant(entry?.value, 'vercel.json must declare an enforcing Content-Security-Policy.')
  invariant(
    headers.some(({ key, value }) => key.toLowerCase() === 'x-frame-options' && value === 'DENY'),
    'vercel.json must declare X-Frame-Options: DENY.',
  )
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
  invariant(
    parsed.get('worker-src')?.includes('blob:'),
    'worker-src must allow the PostHog replay blob worker.',
  )
  const connect = parsed.get('connect-src') ?? []
  invariant(connect.length > 0, 'connect-src must be explicit.')
  for (const source of connect) {
    invariant(CONNECT_SOURCES.has(source), `connect-src contains an unexpected source: ${source}`)
  }
  return script
}

/** @param {string[]} scriptSources */
async function validateBuiltDocuments(scriptSources) {
  const found = new Set()
  for (const relative of DIST_DOCUMENTS) {
    const html = await readFile(resolve(ROOT, relative), 'utf8')
    invariant(!/\son[a-z]+\s*=/i.test(html), `${relative} contains an inline event handler.`)

    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/(?:^|\s)src\s*=/i.test(match[1])) continue
      const hash = `'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`
      found.add(hash)
      invariant(
        scriptSources.includes(hash),
        `${relative} inline script is missing CSP hash ${hash}.`,
      )
    }
  }
  for (const source of scriptSources.filter((entry) => entry.startsWith("'sha256-"))) {
    invariant(found.has(source), `CSP contains an unused inline script hash ${source}.`)
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

  await validateResponseHeaders(response.headers)
  const verified = new URL(response.url)
  verified.search = ''
  verified.hash = ''
  console.log(`Security headers verified on ${verified}`)
}

/** @param {Headers} headers */
async function validateResponseHeaders(headers) {
  const policy = requiredHeader(headers, 'content-security-policy')
  await validateBuiltDocuments(validatePolicy(policy))
  invariant(
    /\bmax-age=\d+/i.test(requiredHeader(headers, 'strict-transport-security')),
    'HSTS needs max-age.',
  )
  requiredHeader(headers, 'x-content-type-options', 'nosniff')
  requiredHeader(headers, 'x-frame-options', 'DENY')
  requiredHeader(headers, 'referrer-policy', 'strict-origin-when-cross-origin')
  requiredHeader(headers, 'permissions-policy', 'camera=(), microphone=(), geolocation=()')
}

/** @param {string} path */
async function validateHeaderFile(path) {
  const blocks = (await readFile(resolve(path), 'utf8'))
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter((block) => block.startsWith('HTTP/'))
  const lines = blocks.at(-1)?.split(/\r?\n/) ?? []
  invariant(
    lines[0]?.match(/^HTTP\/\S+ 2\d\d\b/),
    'Staged deployment did not return a 2xx response.',
  )
  const headers = new Headers()
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(':')
    if (separator > 0) headers.append(line.slice(0, separator), line.slice(separator + 1).trim())
  }
  await validateResponseHeaders(headers)
  console.log('Security headers verified on staged deployment.')
}

const policy = await configuredPolicy()
const scriptSources = validatePolicy(policy)
await validateBuiltDocuments(scriptSources)

const target = process.argv[2]
if (target === '--headers-file') {
  invariant(process.argv[3], 'Usage: security-headers-audit.mjs --headers-file <path>')
  await validateHeaderFile(process.argv[3])
} else if (target && target !== '--build-only') await validateDeployment(target)
else console.log('CSP and built inline scripts verified.')
