import { execFileSync } from 'node:child_process'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { basename, extname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const FORBIDDEN_EXTENSIONS = new Set([
  '.pem',
  '.p8',
  '.key',
  '.crt',
  '.cer',
  '.p12',
  '.pfx',
  '.jks',
  '.keystore',
])
const FORBIDDEN_NAMES = [
  /^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$/i,
  /^(?:credentials?|secrets?)(?:\.[^.]+)*$/i,
  /^(?:service[-_]?account|client[-_]?secret)(?:\.[^.]+)*$/i,
]
/** @type {readonly (readonly [string, RegExp])[]} */
const AIDD_CONTENT = [
  ['personal-path', /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\s/\\]+/],
  ['private-email', /[A-Z0-9._%+-]+@(?:gmail|protonmail|proton|icloud|outlook|yahoo)\.[A-Z]{2,}/i],
  ['recovery-code', /\b(?:mfa|otp|recovery|backup)[-_ ]?(?:code|codes?)\s*[:=]\s*[A-Z0-9-]{6,}\b/i],
]
/** @type {readonly (readonly [string, RegExp])[]} */
const ARTIFACT_CONTENT = [
  ['private-key', /-----BEGIN [^-\r\n]*PRIVATE KEY-----/],
  ['jwt', /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+\b/],
  [
    'provider-token',
    /\b(?:gh[oprsu]_[A-Za-z0-9_]{20,}|sk-(?:ant|or)-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{16,}|polar_oat_[A-Za-z0-9_-]{16,}|whsec_[A-Za-z0-9_-]{16,}|re_[A-Za-z0-9_-]{16,})\b/i,
  ],
  ['signed-url', /[?&](?:token|signature|x-amz-signature)=[^&\s]+/i],
]

/** @typedef {{ path: string, content?: Buffer | string, artifact?: boolean }} AuditEntry */
/** @typedef {{ rule: string, path: string }} Finding */

/** @param {string} value */
function splitNull(value) {
  return value.split('\0').filter(Boolean)
}

/** @param {string[]} args */
function gitText(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

/** @param {string} path */
function stagedContent(path) {
  try {
    return execFileSync('git', ['show', `:${path}`], {
      cwd: ROOT,
      encoding: null,
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return Buffer.alloc(0)
  }
}

/** @param {string} rule @param {string} path @returns {Finding} */
function finding(rule, path) {
  return { rule, path: path.split(sep).join('/') }
}

/** @param {AuditEntry[]} entries @returns {Finding[]} */
export function auditEntries(entries) {
  /** @type {Finding[]} */
  const findings = []
  for (const entry of entries) {
    const path = entry.path.replaceAll('\\', '/')
    const name = basename(path)
    const lower = name.toLowerCase()
    if (path.split('/').includes('.private')) findings.push(finding('private-directory', path))
    if (lower.startsWith('.env') && path !== '.env.example') {
      findings.push(finding('environment-file', path))
    }
    if (FORBIDDEN_EXTENSIONS.has(extname(lower))) {
      findings.push(finding('credential-file', path))
    }
    if (FORBIDDEN_NAMES.some((pattern) => pattern.test(name))) {
      findings.push(finding('credential-bundle', path))
    }

    if (entry.content === undefined) continue
    const buffer = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content)
    if (buffer.includes(0)) continue
    const text = buffer.toString('utf8')
    if (path === '.gitleaksignore') {
      const invalid = text
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#'))
        .some((line) => !/^[0-9a-f]{40}:[^:\r\n]+:[a-z0-9-]+:\d+$/i.test(line))
      if (invalid) findings.push(finding('broad-gitleaks-ignore', path))
    }
    if (path.startsWith('aidd_docs/')) {
      for (const [rule, pattern] of AIDD_CONTENT) {
        if (pattern.test(text)) findings.push(finding(rule, path))
      }
    }
    if (entry.artifact) {
      for (const [rule, pattern] of ARTIFACT_CONTENT) {
        if (pattern.test(text)) findings.push(finding(rule, path))
      }
    }
  }
  return findings
}

/** @param {string} input @returns {Promise<string[]>} */
async function filesUnder(input) {
  const absolute = resolve(ROOT, input)
  const info = await lstat(absolute).catch(() => null)
  if (!info) return []
  if (info.isSymbolicLink()) throw new Error(`Publication audit refuses symlink: ${input}`)
  if (info.isFile()) return [absolute]
  const children = await readdir(absolute, { withFileTypes: true })
  return (
    await Promise.all(
      children.map((child) => filesUnder(relative(ROOT, resolve(absolute, child.name)))),
    )
  ).flat()
}

/** @param {string | undefined} mode @param {string[]} inputs @returns {Promise<AuditEntry[]>} */
async function entriesFor(mode, inputs) {
  if (mode === 'tracked' || mode === 'staged') {
    const paths = splitNull(
      gitText(
        mode === 'tracked'
          ? ['ls-files', '-z']
          : ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
      ),
    )
    return paths.map((path) => ({ path, content: stagedContent(path) }))
  }
  if (mode === 'paths' && inputs.length > 0) {
    const paths = (await Promise.all(inputs.map(filesUnder))).flat()
    return Promise.all(
      paths.map(async (path) => ({
        path: relative(ROOT, path),
        content: await readFile(path),
        artifact: true,
      })),
    )
  }
  throw new Error('Usage: publication-audit.mjs tracked | staged | paths <path...>')
}

async function main() {
  const [mode, ...inputs] = process.argv.slice(2)
  const findings = auditEntries(await entriesFor(mode, inputs))
  if (findings.length === 0) {
    console.log(`Publication audit passed (${mode}).`)
    return
  }
  for (const { rule, path } of findings)
    console.error(`Publication audit failed: ${rule} at ${path}`)
  process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main()
