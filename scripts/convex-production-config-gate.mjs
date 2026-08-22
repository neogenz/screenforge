import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { evaluatePreflight } from '../apps/backend/convex/preflight_evaluation.ts'
import { enforceConvexPreflight } from './convex-preflight-gate.mjs'

const VARIABLE_NAME = /^[A-Z][A-Z0-9_]*$/

/** @param {string} source */
export function parseConvexEnvironment(source) {
  /** @type {Record<string, string>} */
  const configuration = {}
  for (const line of source.split(/\r?\n/)) {
    if (!line) continue
    const separator = line.indexOf('=')
    const name = separator < 0 ? '' : line.slice(0, separator)
    if (!VARIABLE_NAME.test(name) || Object.hasOwn(configuration, name)) {
      throw new Error('Convex returned an invalid environment listing.')
    }
    configuration[name] = line.slice(separator + 1)
  }
  if (!Object.keys(configuration).length) {
    throw new Error('Convex returned an empty environment listing.')
  }
  return configuration
}

/** @param {string} source */
export function enforceCandidateProductionConfiguration(source) {
  const result = evaluatePreflight('production', parseConvexEnvironment(source))
  return enforceConvexPreflight(JSON.stringify(result))
}

function selfTest() {
  const valid = [
    'ABUSE_KEY_SECRET=private-value',
    'AUTH_EMAIL_FROM=ScreenForge <hello@screenforge.example>',
    'AUTH_GITHUB_ID=github-client-test',
    'AUTH_GITHUB_SECRET=github-secret-test',
    'AUTH_GOOGLE_ID=google-client-test',
    'AUTH_GOOGLE_SECRET=google-secret-test',
    'AUTH_RESEND_KEY=private-value=with-equals',
    'CHECKOUT_SUCCESS_URL=https://screenforge.example/?checkout=success',
    'CORS_ALLOWED_ORIGINS=https://screenforge.example',
    'POLAR_ACCESS_TOKEN=private-value',
    'POLAR_CLOUD_PRODUCT_ID=private-value',
    'POLAR_SERVER=production',
    'POLAR_WEBHOOK_SECRET=private-value',
    'SITE_URL=https://screenforge.example',
  ].join('\n')

  assert.equal(enforceCandidateProductionConfiguration(valid), 'Convex preflight passed.')
  assert.throws(
    () => enforceCandidateProductionConfiguration(valid.replace('POLAR_SERVER=production', '')),
    /PRODUCTION_REQUIRES_POLAR_PRODUCTION/,
  )
  assert.throws(
    () => enforceCandidateProductionConfiguration('AUTH_RESEND_KEY=secret-value\ninvalid'),
    (error) => error instanceof Error && !error.message.includes('secret-value'),
  )
}

async function main() {
  if (process.argv.includes('--self-test')) {
    selfTest()
    return
  }
  try {
    process.stdin.setEncoding('utf8')
    let source = ''
    for await (const chunk of process.stdin) source += chunk
    console.log(enforceCandidateProductionConfiguration(source))
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Convex production gate failed.')
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main()
